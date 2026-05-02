// services/chatService.js
//
// SPEC §S20 · Canvas Chat — chat-shape entry point. Orchestrates:
//   1. Assembles the 5-layer system prompt (services/systemPromptAssembler).
//   2. Streams a provider call, accumulating tokens via onToken.
//   3. If the provider emits tool_use, resolves the tool locally via
//      CHAT_TOOLS against the active engagement, feeds the tool_result
//      back as a user-role message, and streams a second provider call
//      whose tokens form the final user-visible response.
//   4. Returns { response, provenance } and emits onComplete.
//
// Provider injection: opts.provider is required for v1 (the real-
// provider streaming-over-fetch wiring lands when AI item 6 / real-LLM
// smoke fires). Test paths inject `createMockChatProvider(...)`; the
// chat overlay UI injects a thin wrapper around aiService that does
// streaming + tool_use + cache_control. Both share this orchestration.
//
// Forbidden (RULES §16 + SPEC §S20.13):
//   - importing state/sessionState.js (CH1)
//   - importing state/collections/*Actions.js (CH2 read-only v1)
//   - mutating engagement (chat is read-only)
//
// Authority: docs/v3.0/SPEC.md §S20.5 + §S20.8 ·
//            docs/v3.0/TESTS.md §T20 V-CHAT-{4,5,11} ·
//            docs/RULES.md §16.

import { buildSystemPrompt }  from "./systemPromptAssembler.js";
import { CHAT_TOOLS }         from "./chatTools.js";
import { getContractChecksum } from "../core/dataContract.js";

// SPEC §S20.16 + §S25.5 first-turn handshake regex.
// LLM is instructed to emit `[contract-ack v3.0 sha=<8-char-hex>]` as
// the EXACT first line of its first response.
const HANDSHAKE_RE = /^\[contract-ack\s+v3\.0\s+sha=([0-9a-f]{8})\]\s*\n?/i;

// providerCapabilities(providerKey)
// → { streaming: bool, toolUse: bool, caching: bool }
//
// Static capability table keyed on the provider identifiers used in
// core/aiConfig.js. Drives both the chat surface (which chooses
// streaming vs blocking dispatch) and the system-prompt assembler
// (which emits cache_control markers only for caching-capable
// providers).
export function providerCapabilities(providerKey) {
  switch (providerKey) {
    case "anthropic":
      return { streaming: true, toolUse: true, caching: true };
    case "openai-compatible":
    case "local":
      return { streaming: true, toolUse: true, caching: false };
    case "gemini":
      return { streaming: true, toolUse: true, caching: false };
    case "dellSalesChat":
      // TO CONFIRM with Dell IT contact (per SPEC §S7.4 TO CONFIRM).
      // Conservative defaults until the streaming + tool-use shape is
      // documented.
      return { streaming: false, toolUse: false, caching: false };
    case "mock":
      return { streaming: true, toolUse: true, caching: false };
    default:
      return { streaming: false, toolUse: false, caching: false };
  }
}

// streamChat({engagement, transcript, userMessage, providerConfig,
//             provider, onToken?, onComplete?, options?})
//   → Promise<{ response: string, provenance: object }>
//
// `transcript` is an array of prior messages [{role, content, ...}].
// `provider` MUST expose `async *stream({messages, tools})` yielding
//   - { kind: "text",     token: string }
//   - { kind: "done",     text:  string }
//   - { kind: "tool_use", name:  string, input: object }
// (See `tests/mocks/mockChatProvider.js` for the canonical shape.)
//
// One tool-use round trip is supported in v1 (CH10): provider may emit
// at most one tool_use in the first call; the dispatcher resolves it
// and runs a second call whose tokens become the visible response.
// Multi-turn tool chains are v3.1.
export async function streamChat(opts) {
  const engagement     = opts && opts.engagement;
  const transcript     = (opts && opts.transcript) || [];
  const userMessage    = (opts && opts.userMessage) || "";
  const providerConfig = (opts && opts.providerConfig) || { providerKey: "mock" };
  const provider       = opts && opts.provider;
  const onToken        = (opts && opts.onToken)    || function() {};
  const onComplete     = (opts && opts.onComplete) || function() {};

  if (!provider || typeof provider.stream !== "function") {
    throw new Error("streamChat: opts.provider with .stream() is required");
  }

  // Resolve providerKind for the assembler's cache_control branch.
  const providerKind = mapProviderKindForAssembler(providerConfig.providerKey);

  // Layer 1+2+3+5+4 — system prompt (cached prefix + volatile snapshot).
  const systemPrompt = buildSystemPrompt({ engagement, providerKind });

  // Build the initial conversation: system messages + prior transcript +
  // current user turn. We do not summarize transcript here; that is the
  // caller's responsibility (chatMemory.summarizeIfNeeded before this).
  const baseMessages = [].concat(
    systemPrompt.messages,
    transcript.map(t => ({ role: t.role, content: t.content })),
    [{ role: "user", content: userMessage }]
  );

  // First provider call.
  const round1 = await streamOneRound(provider, baseMessages, onToken);

  // If the provider emitted a tool_use, resolve + send tool_result back.
  let finalResponse = round1.text;
  if (round1.toolUse) {
    const tool = CHAT_TOOLS.find(t => t.name === round1.toolUse.name);
    if (!tool) {
      throw new Error("streamChat: provider requested unknown tool '" + round1.toolUse.name + "'");
    }
    const toolResult = tool.invoke(engagement, round1.toolUse.input || {});

    // SPEC §S20.18 + RULES §16 CH19 — Anthropic-shape content-block
    // round-trip. Real Anthropic REQUIRES the assistant message to
    // replay the same content blocks (preamble text + tool_use with id)
    // and the user message to carry a tool_result block correlated by
    // tool_use_id. Mock + OpenAI/Gemini providers ignore the array
    // shape (mock streams scripted responses; OpenAI/Gemini wire shape
    // is on the rc.3 roadmap).
    const toolUseId = round1.toolUse.id || ("toolu_" + Math.random().toString(36).slice(2, 12));
    const assistantBlocks = [];
    if (round1.text) assistantBlocks.push({ type: "text", text: round1.text });
    assistantBlocks.push({
      type:  "tool_use",
      id:    toolUseId,
      name:  round1.toolUse.name,
      input: round1.toolUse.input || {}
    });
    const userBlocks = [{
      type:         "tool_result",
      tool_use_id:  toolUseId,
      content:      safeStringify(toolResult)
    }];
    const followupMessages = baseMessages.concat([
      { role: "assistant", content: assistantBlocks },
      { role: "user",      content: userBlocks }
    ]);

    const round2 = await streamOneRound(provider, followupMessages, onToken);
    finalResponse = round2.text;
  }

  // Provenance per SPEC §S8.1 — every assistant turn carries the
  // model + runId + timestamp + (when known) catalogVersions.
  const provenance = {
    model:           providerConfig.providerKey || "unknown",
    runId:           genRunId(),
    timestamp:       new Date().toISOString(),
    catalogVersions: (engagement && engagement.meta && engagement.meta.catalogVersions) || {}
  };

  // SPEC §S20.16 + §S25.5 first-turn handshake parsing.
  // ON THE FIRST TURN ONLY (transcript is empty), the LLM's response
  // MUST start with [contract-ack v3.0 sha=<8>]. We parse, strip from
  // the visible response, and report ack-status via contractAck.
  // On subsequent turns (transcript non-empty), the prefix is forbidden
  // by the role section; we don't parse and contractAck is null.
  let contractAck = null;
  let visibleResponse = finalResponse;
  if (transcript.length === 0) {
    const expected = getContractChecksum();
    const m = HANDSHAKE_RE.exec(finalResponse);
    if (m) {
      const received = m[1].toLowerCase();
      contractAck = {
        ok:       received === expected,
        expected: expected,
        received: received
      };
      // Strip the handshake line from the visible response.
      visibleResponse = finalResponse.slice(m[0].length).replace(/^\s*\n/, "");
    } else {
      contractAck = {
        ok:       false,
        expected: expected,
        received: null
      };
    }
  }

  const result = { response: visibleResponse, provenance, contractAck };
  try { onComplete(result); } catch (e) { console.warn("[chatService] onComplete threw:", e && e.message); }
  return result;
}

// streamOneRound: drains one provider.stream() call. Returns the
// accumulated text + at most one tool_use envelope. v1 enforces "at
// most one tool_use" per round per CH10; if the provider emits more,
// only the first is honored.
async function streamOneRound(provider, messages, onToken) {
  let text = "";
  let toolUse = null;
  const iter = provider.stream({ messages, tools: CHAT_TOOLS });
  for await (const evt of iter) {
    if (!evt) continue;
    if (evt.kind === "text" && typeof evt.token === "string") {
      text += evt.token;
      try { onToken(evt.token); } catch (e) { console.warn("[chatService] onToken threw:", e && e.message); }
    } else if (evt.kind === "tool_use" && !toolUse) {
      toolUse = { name: evt.name, input: evt.input || {}, id: evt.id || null };
    }
    // evt.kind === "done" is informational; we accumulate text directly.
  }
  return { text, toolUse };
}

function mapProviderKindForAssembler(providerKey) {
  switch (providerKey) {
    case "anthropic":         return "anthropic";
    case "gemini":            return "gemini";
    case "mock":              return "mock";
    case "openai-compatible":
    case "local":
    default:                  return "openai-compatible";
  }
}

function genRunId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "run-" + Date.now() + "-" + Math.floor(Math.random() * 1e9).toString(16);
}

function safeStringify(value) {
  try { return JSON.stringify(value); }
  catch (_e) { return "<unserializable>"; }
}
