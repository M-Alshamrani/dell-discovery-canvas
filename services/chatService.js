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
// Provider injection: opts.provider is required. The chat overlay UI
// injects a thin wrapper around aiService that does streaming + tool_use
// + cache_control. Per `feedback_no_mocks.md` (LOCKED 2026-05-05) +
// rc.7-arc-1 (this commit), there is NO mock provider. All test
// coverage of streamChat behavior is via PREFLIGHT 5b real-LLM smoke
// at tag time; orchestration unit tests have been retired.
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
// Sub-arc D (rc.10) · ActionProposalSchema is the canonical Zod schema
// for validating proposeAction tool args at runtime. Per SPEC §S20.4.1.3
// + RULES §16 CH38(a): the chat invokes the proposeAction tool with
// structured args; chatService captures + validates each call's input
// into the envelope's proposedActions[] field. Bad input is dropped
// with a console.warn (eval harness detects no-proposal-where-expected
// as a restraint signal · not a chat-side error).
import { ActionProposalSchema } from "../schema/actionProposal.js";
// SPEC §S37 + RULES §16 CH33 — grounding contract recast (rc.6).
// streamChat invokes the deterministic retrieval router BEFORE
// assembling the system prompt; selector results are inlined into
// Layer 4 by buildSystemPrompt. After the LLM responds, streamChat
// runs verifyGrounding on the visible response; flagged entity
// references → attached as result.groundingViolations on the
// onComplete envelope (Sub-arc B 2026-05-13 SOFT-WARN demote of
// R37.6: the response itself is PRESERVED unchanged; CanvasChatOverlay
// renders the violations as a severity-tiered footer block below the
// assistant bubble).
import { route as groundingRoute } from "./groundingRouter.js";
import { verifyGrounding }         from "./groundingVerifier.js";
// SPEC §S20.16 + §S25.5 + BUG-020 fix (2026-05-03) — handshake regex
// + strip helper now live in services/chatHandshake.js so chatService,
// chatMemory, AND CanvasChatOverlay (streaming-time onToken path) all
// share one source-of-truth pattern + idempotent strip.
import { HANDSHAKE_RE, HANDSHAKE_STRIP_RE } from "./chatHandshake.js";
// BUG-013 Path B (2026-05-03) — defensive UUID scrub. The role section +
// selector enrichment (Path A, commit `d324971`) reduce but don't
// eliminate UUID leakage in prose. This runtime scrub replaces bare
// v3-format UUIDs with resolved labels (or `[unknown reference]`) and
// is applied to the visible response as a final pass.
import { buildLabelMap, buildManifestLabelMap, scrubUuidsInProse } from "./uuidScrubber.js";

// SPEC §S20.5.2 + RULES §16 CH10 — multi-round tool chaining safety cap.
// Prevents runaway tool loops if the model never emits a text-only
// response. Empirically 5 rounds covers every legitimate question
// against the §S5 selectors (most need 1-2; the densest cross-cuts
// 3-4). On cap, streamChat surfaces a clear notice in the response.
export const MAX_TOOL_ROUNDS = 5;

// SPEC §S20.4.1.4 + RULES §16 CH38(b) — Sub-arc D Step 3.9
// chat-says-vs-chat-does guard. Detects the hallucination pattern
// observed across 4 regression baselines (d73ce60 · cdd367a · 5466ea3
// · ae33705): chat writes prose claiming an action was taken ("I've
// proposed X" / "Done. I've proposed Y" / "Proposal submitted ✓" /
// "now proposed for your review") while proposedActions: []. The
// pattern is structural LLM inconsistency under cognitive load · NOT
// prompt-text-fixable. Application-layer detection at chatService
// output time is deterministic + 100% reproducible + provider-
// agnostic.
//
// Coverage (derived empirically from 4 regression baselines):
//   - "I've proposed" / "I have proposed" / "I've added" / "I've submitted"
//   - "I've captured" / "I've marked" / "I've created"
//   - "Proposal submitted" / "Proposal is in your panel"
//   - "Proposal is ready" / "Proposal recorded"
//   - "now proposed for your review"
//
// False-positive avoidance: deliberately excludes bare "Captured."
// (legitimate when chat fires the tool · ACT-INST-CUR-2/3 use this
// preamble + actually fire) · tutorial-mode responses ("Got it · here's
// how to capture it manually") · generic agreement phrases ("That's
// two clear signals").
export const HALLUCINATION_RE =
  /(?:I'?ve|I\s+have)\s+(?:propose[ds]?|added|submitted|captured|marked|created)|Proposal\s+(?:submitted|is\s+in\s+your\s+panel|is\s+ready|recorded)|now\s+propose[ds]?\s+for\s+your\s+review/i;

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
// (Production path: `services/realChatProvider.js`. No mock providers
// exist post-rc.7-arc-1; see feedback_no_mocks.md.)
//
// One tool-use round trip is supported in v1 (CH10): provider may emit
// at most one tool_use in the first call; the dispatcher resolves it
// and runs a second call whose tokens become the visible response.
// Multi-turn tool chains are v3.1.
export async function streamChat(opts) {
  const engagement     = opts && opts.engagement;
  const transcript     = (opts && opts.transcript) || [];
  const userMessage    = (opts && opts.userMessage) || "";
  const providerConfig = (opts && opts.providerConfig) || {};
  const provider       = opts && opts.provider;
  const onToken        = (opts && opts.onToken)    || function() {};
  const onComplete     = (opts && opts.onComplete) || function() {};
  // Per SPEC §S34 R34.2 (rc.4-dev / Arc 3) - thinking-state callbacks.
  // onToolUse fires once per tool dispatch BEFORE the tool runs; chat
  // overlay paints a per-tool status pill. onRoundStart fires at each
  // multi-round iteration; overlay paints the round badge for round >= 2.
  const onToolUse      = (opts && opts.onToolUse)    || function() {};
  const onRoundStart   = (opts && opts.onRoundStart) || function() {};

  if (!provider || typeof provider.stream !== "function") {
    throw new Error("streamChat: opts.provider with .stream() is required");
  }

  // Resolve providerKind for the assembler's cache_control branch.
  const providerKind = mapProviderKindForAssembler(providerConfig.providerKey);

  // SPEC §S37.3.1 + R37.2 + RULES §16 CH33 (a)+(b) — invoke the
  // deterministic grounding router BEFORE assembling the system prompt.
  // The router classifies the user message → list of selector calls;
  // results are inlined into Layer 4 by buildSystemPrompt, so the LLM
  // sees the engagement data BEFORE answering (RAG-by-construction,
  // not chat-with-tools-as-hope).
  const routerOutput = groundingRoute({
    userMessage: userMessage,
    transcript:  transcript,
    engagement:  engagement
  });

  // Layer 1+2+3+5+4 — system prompt (cached prefix + router-driven Layer 4).
  const systemPrompt = buildSystemPrompt({ engagement, providerKind, routerOutput });

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
  // Sub-arc D (rc.10 · SPEC §S20.4.1.3 + RULES §16 CH38) · accumulator
  // for proposeAction tool calls across rounds. Each valid proposal
  // appended; surfaced in the result envelope as proposedActions[]
  // for engineer-facing review at Sub-arc D Step 4 (preview modal +
  // Apply button). At stub stage this array sits in the envelope and
  // the eval harness reads it.
  const proposedActions = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Per §S34 R34.2 - signal round start to the overlay so it can
    // paint the multi-round badge for round >= 2 (1-indexed user view).
    try { onRoundStart({ round: round + 1, totalRounds: MAX_TOOL_ROUNDS }); }
    catch (e) { console.warn("[chatService] onRoundStart threw:", e && e.message); }

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
    // Per §S34 R34.2 - signal tool dispatch BEFORE invoke so the overlay
    // can paint the per-tool status pill while the tool runs.
    try { onToolUse({ name: result.toolUse.name, args: result.toolUse.input || {} }); }
    catch (e) { console.warn("[chatService] onToolUse threw:", e && e.message); }
    // Sub-arc D (rc.10) · proposeAction is a structurally-special tool
    // (records intent rather than fetching data). Capture the validated
    // args into proposedActions[] for the envelope. Invalid input is
    // dropped with a console.warn; the eval harness reads
    // envelope.proposedActions and scores the action-correctness
    // rubric (§S48.2) · empty array on a case that warranted a
    // proposal = restraint failure.
    if (result.toolUse.name === "proposeAction") {
      const parsed = ActionProposalSchema.safeParse(result.toolUse.input || {});
      if (parsed.success) {
        proposedActions.push(parsed.data);
      } else {
        console.warn("[chatService] proposeAction received malformed input (dropped from envelope.proposedActions):",
          JSON.stringify(parsed.error?.issues || parsed.error).slice(0, 500));
      }
    }
    const toolResult = tool.invoke(engagement, result.toolUse.input || {});

    // Anthropic-shape content blocks (per SPEC §S20.18 + RULES §16 CH19).
    // Real Anthropic REQUIRES the assistant message to replay all content
    // blocks (preamble text + tool_use with id), and the user message to
    // carry the tool_result block correlated by tool_use_id. Non-Anthropic
    // providers tolerate the array shape (translated by aiService).
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
  // Always strip the handshake — strict + permissive passes. Strict
  // pass captures the sha for first-turn ack validation; permissive
  // pass scrubs any remnant (bracketless, multiple, mid-response).
  const handshakeMatch = HANDSHAKE_RE.exec(finalResponse);
  let visibleResponse = finalResponse.replace(HANDSHAKE_STRIP_RE, "").replace(/^\s+/, "");
  // BUG-013 Path B · final UUID scrub. Replace bare v3-format UUIDs in
  // the visible response with resolved labels (gap description /
  // driver label / environment alias / instance label) or
  // `[unknown reference]` for orphans. Skips fenced + inline code so
  // legitimate JSON examples remain intact.
  // SPEC §S34.3 (rc.4-dev / Arc 3c) - merged label map covers both
  // engagement UUIDs (BUG-013) and manifest workflow/concept ids
  // (BUG-024) in a single scrub pass.
  visibleResponse = scrubUuidsInProse(visibleResponse, Object.assign({}, buildManifestLabelMap(), buildLabelMap(engagement)));
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

  // SPEC §S37.3.2 + R37.6 + RULES §16 CH33 (c) — runtime grounding
  // verification. After all post-stream scrubbing (handshake strip +
  // UUID scrub) but BEFORE return, cross-reference the visible response
  // against the engagement.
  //
  // Sub-arc B 2026-05-13 · R37.6 SOFT-WARN demote: the response is
  // PRESERVED unchanged on ok:false. The groundingViolations array
  // (with per-violation severity field per R37.13) flows through to
  // the onComplete envelope as result.groundingViolations; the chat
  // overlay renders them as a severity-tiered footer block below the
  // assistant bubble. The previous BLOCK behavior (response replaced
  // with a render-error template) is RETIRED per user direction
  // (BUG-062 expansion: "the AI assistance should not be strict as it
  // is now to block the output once it reached the chat box, but
  // should instead receive it and let us optimize the responses from
  // the LLM, and make sure their responses are fully context-aware
  // and guardrailed by intelligence of the LLM not by the force of
  // override in the app").
  let groundingViolations = [];
  try {
    const verifyResult = verifyGrounding(visibleResponse, engagement);
    if (verifyResult && verifyResult.ok === false) {
      groundingViolations = verifyResult.violations || [];
      // Sub-arc B: NO reassignment of visibleResponse. Response flows
      // through unchanged. The violations are attached to the onComplete
      // envelope below and rendered by the overlay as annotations.
      console.warn("[chatService] groundingViolations annotated (response preserved per R37.6 SOFT-WARN):",
        JSON.stringify(groundingViolations).slice(0, 400));
    }
  } catch (e) {
    // Verifier failure must NOT swallow the assistant turn; log + continue.
    console.warn("[chatService] verifyGrounding threw:", e && e.message);
  }

  // Sub-arc D (rc.10) · proposedActions[] added to envelope per
  // SPEC §S20.4.1.3 + RULES §16 CH38(b). Always present; empty array
  // when the chat did not call proposeAction. Downstream consumers
  // (eval harness, future preview modal) check proposedActions.length
  // > 0 to determine emission.
  //
  // Sub-arc D Step 3.9 (rc.10) · chat-says-vs-chat-does guard per
  // SPEC §S20.4.1.4 + RULES §16 CH38(b) extension. Detects the
  // hallucination pattern (chat writes "I've proposed X" without
  // actually firing the tool) at chatService output time. Always
  // present in envelope · null when not detected · object with
  // { detected, matchedPhrase, reason } when detected. Step 5
  // preview-modal renders the warning as "⚠ Chat described an
  // action but did not emit a structured proposal."
  let proposalEmissionWarning = null;
  if (proposedActions.length === 0 && HALLUCINATION_RE.test(visibleResponse)) {
    const match = visibleResponse.match(HALLUCINATION_RE);
    proposalEmissionWarning = {
      detected: true,
      matchedPhrase: match ? match[0] : "(pattern matched but no exact substring captured)",
      reason: "Chat described an action in prose without invoking the proposeAction tool. Engineer review recommended."
    };
    console.warn("[chatService] proposalEmissionWarning detected (hallucination pattern matched · proposedActions: [] · matchedPhrase=" +
      JSON.stringify(proposalEmissionWarning.matchedPhrase) + ")");
  }
  const result = { response: visibleResponse, provenance, contractAck, groundingViolations, proposedActions, proposalEmissionWarning };
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
