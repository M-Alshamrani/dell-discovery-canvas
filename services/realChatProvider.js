// services/realChatProvider.js
//
// SPEC §S20.5 + §S20.8 + §S20.18 + §S26 · adapter from the v3 chat-stream
// protocol (`async *stream({messages, tools}) yield {kind, ...}`) to the
// services/aiService.js chatCompletion + streamCompletion call shapes.
//
// Phase A (2026-05-02 LATE EVENING) — generic LLM connector. Tool-use
// is now wired for ALL three provider kinds: anthropic, openai-compatible,
// and gemini (per SPEC §S26 + RULES §16 CH20). chatService emits
// Anthropic-canonical content-block messages for the round-2 turn; each
// wire builder in aiService translates to the native shape. Tool-call
// extraction is dispatched by providerKind in extractToolCalls.
//
// SSE per-token streaming is still Anthropic-only (rc.2). For openai-
// compatible + gemini we use the non-streaming chatCompletion path and
// yield a single `{kind:"text"}` event with the whole payload. Phase A3
// will extend streamCompletion to OpenAI SSE.
//
// Forbidden (RULES §16):
//   - importing state/sessionState.js
//   - importing state/collections/* (read-only)
//
// Authority: docs/v3.0/SPEC.md §S20.5.1 + §S20.8 + §S20.18 + §S26 ·
//            `services/aiService.js` chatCompletion / extractToolCalls ·
//            docs/RULES.md §16 CH19 + CH20.

import { chatCompletion, streamCompletion, extractToolCalls } from "./aiService.js";

// providerKey → providerKind map (mirrors aiService.PROVIDER_FROM_KEY;
// kept local to avoid a public export). All "openai-compatible"-shaped
// providers (local LLM, Dell Sales Chat, future vendors) share the same
// wire/extract path.
const PROVIDER_KIND_FOR_KEY = {
  local:         "openai-compatible",
  anthropic:     "anthropic",
  gemini:        "gemini",
  dellSalesChat: "openai-compatible"
};

// createRealChatProvider({ providerKey, baseUrl, model, fallbackModels?,
//                          apiKey?, stream?, fetchImpl? })
//   → { stream({messages, tools, cacheControl}) → AsyncIterable<event>,
//        callsRecorded, capabilities }
//
// `messages` is the system + transcript + user message array assembled
// by chatService. `tools` is the CHAT_TOOLS array (with `invoke`); we
// strip the function before forwarding to the wire builder since
// closures are not serializable. `cacheControl` is the array of message
// indices that carry the Anthropic ephemeral cache_control marker.
//
// `stream:true` (default for Anthropic) routes through streamCompletion
// (SSE per-token). `stream:false` keeps the legacy non-streaming path.
// `fetchImpl` is an optional override (rc.7-arc-1: stubbed-fetch tests
// retired per feedback_no_mocks.md; the override remains in the API
// for legitimate fetch-replacement use cases like an alternative
// transport, but is no longer exercised by tests).
export function createRealChatProvider(opts) {
  const providerConfig = opts || {};
  const callsRecorded = [];
  const providerKind  = PROVIDER_KIND_FOR_KEY[providerConfig.providerKey] || "openai-compatible";

  // Phase A — tool-use is supported across all three provider kinds.
  // Each builder in aiService translates the canonical content blocks
  // to its native wire shape; extractToolCalls dispatches by kind.
  const supportsToolUse  = true;
  // SSE per-token streaming is Anthropic-only today (Phase A3 extends
  // to OpenAI). Opt-out via stream:false for legitimate use cases.
  const supportsStream   = providerConfig.providerKey === "anthropic";
  const wantsStream      = providerConfig.stream !== false && supportsStream;
  // cache_control is Anthropic-specific.
  const supportsCaching  = providerConfig.providerKey === "anthropic";

  const capabilities = {
    streaming: wantsStream,
    toolUse:   supportsToolUse,
    caching:   supportsCaching
  };

  return {
    callsRecorded,
    capabilities,

    async *stream(call) {
      const messages = (call && call.messages) || [];
      const wireTools = supportsToolUse
        ? toWireTools(call && call.tools)
        : [];

      // SPEC §S20.19 — cacheControl indices flow from systemPromptAssembler
      // through chatService into the wire builder, so the Anthropic stable
      // prefix gets `cache_control: ephemeral` on every turn (5-min TTL).
      // Caching savings only apply for anthropic; other providers ignore.
      const cacheControl = (call && Array.isArray(call.cacheControl)) ? call.cacheControl : [];

      callsRecorded.push({
        messages,
        tools:        wireTools,
        cacheControl: cacheControl,
        streaming:    wantsStream,
        at:           new Date().toISOString()
      });

      const wireOpts = {
        providerKey:    providerConfig.providerKey,
        baseUrl:        providerConfig.baseUrl,
        model:          providerConfig.model,
        fallbackModels: providerConfig.fallbackModels || [],
        apiKey:         providerConfig.apiKey || "",
        messages,
        tools:          wireTools.length > 0 ? wireTools : undefined,
        cacheControl:   cacheControl.length > 0 ? cacheControl : undefined,
        fetchImpl:      providerConfig.fetchImpl
      };

      // SSE streaming path (Anthropic only in rc.2). Yields events 1:1
      // from streamCompletion's generator — text tokens stream as they
      // arrive; tool_use surfaces on content_block_stop with the
      // accumulated input JSON.
      if (wantsStream) {
        try {
          for await (const evt of streamCompletion(wireOpts)) {
            yield evt;
          }
        } catch (e) {
          const msg = "Provider error: " + (e && e.message || String(e));
          yield { kind: "text", token: msg };
          yield { kind: "done", text:  msg };
        }
        return;
      }

      // Non-streaming path (default for non-Anthropic; opt-in for
      // Anthropic via stream:false).
      let response;
      try {
        response = await chatCompletion(wireOpts);
      } catch (e) {
        const msg = "Provider error: " + (e && e.message || String(e));
        yield { kind: "text", token: msg };
        yield { kind: "done", text:  msg };
        return;
      }

      // SPEC §S26.3 — provider-dispatched tool-call extraction.
      // Same {kind:"tool_use",...} event shape regardless of provider.
      const toolCalls = extractToolCalls(providerKind, response && response.raw);
      for (const tu of toolCalls) {
        yield { kind: "tool_use", name: tu.name, input: tu.input || {}, id: tu.id };
      }

      const text = (response && typeof response.text === "string") ? response.text : "";
      if (text.length > 0) {
        yield { kind: "text", token: text };
      }
      yield { kind: "done", text };
    }
  };
}

// Strip non-serializable fields (notably `invoke`) from CHAT_TOOLS to
// produce the canonical wire-shape `{name, description, input_schema}`.
// Each provider's wire builder in aiService translates input_schema to
// its native field name (anthropic keeps it; openai-compatible renames
// to `parameters`; gemini wraps in functionDeclarations + parameters).
function toWireTools(tools) {
  if (!Array.isArray(tools)) return [];
  return tools.map(function(t) {
    return {
      name:         t.name,
      description:  t.description,
      input_schema: t.input_schema || { type: "object", properties: {} }
    };
  });
}
