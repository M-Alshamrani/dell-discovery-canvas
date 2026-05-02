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

// SPEC §S20.5.2 + RULES §16 CH10 — multi-round tool chaining safety cap.
// Prevents runaway tool loops if the model never emits a text-only
// response. Empirically 5 rounds covers every legitimate question
// against the §S5 selectors (most need 1-2; the densest cross-cuts
// 3-4). On cap, streamChat surfaces a clear notice in the response.
export const MAX_TOOL_ROUNDS = 5;

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

  // SPEC §S20.5.2 + RULES §16 CH10 — multi-round tool chaining loop.
  // Stream → if tool_use, dispatch + append assistant content blocks +
  // user tool_result block → loop. Terminates when the model emits
  // text-only response (no tool_use) OR MAX_TOOL_ROUNDS hit (safety
  // cap to prevent runaway chains; surfaces a notice if reached).
  // Pre-fix (BUG-012): hard-capped at 1 round. Q1 + Q2 in the user's
  // 2026-05-02 PM transcript stuck on the round-2 preamble because the
  // chain dropped silently.
  let messages       = baseMessages;
  let lastTextResponse = "";   // tracks the most recent text-only LLM response (the "answer")
  let allRoundsText  = "";     // accumulated text across all rounds (used if cap is hit with no text-only round)
  let chainCap       = false;  // true if MAX_TOOL_ROUNDS reached without text-only response
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await streamOneRound(provider, messages, onToken, systemPrompt.cacheControl);
    if (result.text) allRoundsText += (allRoundsText ? "\n\n" : "") + result.text;

    if (!result.toolUse) {
      // Text-only response — chain terminates with this as the answer.
      lastTextResponse = result.text;
      break;
    }

    const tool = CHAT_TOOLS.find(t => t.name === result.toolUse.name);
    if (!tool) {
      throw new Error("streamChat: provider requested unknown tool '" + result.toolUse.name + "'");
    }
    const toolResult = tool.invoke(engagement, result.toolUse.input || {});

    // Anthropic-shape content blocks (per SPEC §S20.18 + RULES §16 CH19).
    // Real Anthropic REQUIRES the assistant message to replay all content
    // blocks (preamble text + tool_use with id), and the user message to
    // carry the tool_result block correlated by tool_use_id. Mock + non-
    // Anthropic providers tolerate the array shape (rc.3 will widen).
    const toolUseId = result.toolUse.id || ("toolu_" + Math.random().toString(36).slice(2, 12));
    const assistantBlocks = [];
    if (result.text) assistantBlocks.push({ type: "text", text: result.text });
    assistantBlocks.push({
      type:  "tool_use",
      id:    toolUseId,
      name:  result.toolUse.name,
      input: result.toolUse.input || {}
    });
    const userBlocks = [{
      type:         "tool_result",
      tool_use_id:  toolUseId,
      content:      safeStringify(toolResult)
    }];
    messages = messages.concat([
      { role: "assistant", content: assistantBlocks },
      { role: "user",      content: userBlocks }
    ]);

    // If we just consumed the LAST allowed round and the model is still
    // calling tools, mark the cap and break. The notice is appended below.
    if (round === MAX_TOOL_ROUNDS - 1) {
      chainCap = true;
    }
  }

  // Compose final response. Three cases:
  //   - text-only termination → lastTextResponse is the answer
  //   - cap hit with no text-only → use the accumulated text + cap notice
  //   - cap hit but the very last round HAD a text preamble → include it + notice
  let finalResponse = lastTextResponse;
  if (chainCap) {
    const accumulated = allRoundsText || "";
    finalResponse = (accumulated ? accumulated + "\n\n" : "") +
      "_(tool-call cap reached after " + MAX_TOOL_ROUNDS +
      " rounds — ask me to continue if you need more detail)_";
  }

  // Provenance per SPEC §S8.1 — every assistant turn carries the
  // model + runId + timestamp + (when known) catalogVersions.
  const provenance = {
    model:           providerConfig.providerKey || "unknown",
    runId:           genRunId(),
    timestamp:       new Date().toISOString(),
    catalogVersions: (engagement && engagement.meta && engagement.meta.catalogVersions) || {}
  };

  // SPEC §S20.16 + §S25.5 handshake parsing.
  // ON THE FIRST TURN, the LLM is INSTRUCTED to emit
  // [contract-ack v3.0 sha=<8>] as its first line. We parse, validate
  // sha, strip from the visible response, and report ack-status via
  // contractAck.
  // ON SUBSEQUENT TURNS, the role section forbids the prefix — but
  // some models (notably Gemini) repeat it intermittently (BUG-015,
  // 2026-05-02 PM). Defensively strip the handshake regardless of
  // turn so it never leaks into the rendered bubble. ContractAck is
  // ONLY populated on the first turn (the place its truth signal
  // actually matters); on subsequent turns we silently strip + leave
  // contractAck null.
  let contractAck = null;
  let visibleResponse = finalResponse;
  const handshakeMatch = HANDSHAKE_RE.exec(finalResponse);
  if (handshakeMatch) {
    visibleResponse = finalResponse.slice(handshakeMatch[0].length).replace(/^\s*\n/, "");
  }
  if (transcript.length === 0) {
    const expected = getContractChecksum();
    if (handshakeMatch) {
      const received = handshakeMatch[1].toLowerCase();
      contractAck = {
        ok:       received === expected,
        expected: expected,
        received: received
      };
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
async function streamOneRound(provider, messages, onToken, cacheControl) {
  let text = "";
  let toolUse = null;
  const iter = provider.stream({ messages, tools: CHAT_TOOLS, cacheControl: cacheControl || [] });
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
