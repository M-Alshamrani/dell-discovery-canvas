// services/realChatProvider.js
//
// SPEC §S20.5 + §S20.8 + §S20.18 · adapter from the v3 chat-streaming
// protocol (`async *stream({messages, tools}) yield {kind, ...}`) to the
// existing services/aiService.js chatCompletion call shape.
//
// rc.2 (Step 7) — Anthropic tool-use round-trip is wired (per RULES §16
// CH19): the wire-shape `tools` array (name + description + input_schema)
// is forwarded to chatCompletion; the response's content blocks are
// scanned for `tool_use`; if found, a `{kind:"tool_use", name, input, id}`
// event is yielded for chatService to round-trip through CHAT_TOOLS.
// chatService then re-issues with the assistant content blocks + a
// `tool_result` block in the user message (Anthropic-shape; aiService
// passes array-content through verbatim).
//
// Per-token SSE streaming is still chunk E (Step 8). Today the real
// provider call is non-streaming: chatCompletion returns the full text,
// and we yield a single `{kind:"text"}` event with the whole payload.
// The chat overlay renders identically either way.
//
// Tool-use over OpenAI / Gemini lands in rc.3 (their function-calling
// shapes differ enough to deserve their own request builders).
//
// Forbidden (RULES §16):
//   - importing state/sessionState.js
//   - importing state/collections/* (read-only)
//
// Authority: docs/v3.0/SPEC.md §S20.5.1 + §S20.8 + §S20.18 ·
//            `services/aiService.js` chatCompletion contract ·
//            docs/RULES.md §16 CH19.

import { chatCompletion } from "./aiService.js";

// createRealChatProvider({ providerKey, baseUrl, model, fallbackModels?,
//                          apiKey?, fetchImpl? })
//   → { stream({messages, tools}) → AsyncIterable<event>, callsRecorded,
//        capabilities }
//
// `messages` is the system + transcript + user message array assembled
// by chatService. `tools` is the CHAT_TOOLS array (with `invoke`); we
// strip the function before forwarding to chatCompletion since closures
// are not serializable. `fetchImpl` is an optional override for tests
// (V-CHAT-15 uses this to stub the Anthropic /v1/messages endpoint).
export function createRealChatProvider(opts) {
  const providerConfig = opts || {};
  const callsRecorded = [];
  // toolUse capability is true ONLY for Anthropic in rc.2; OpenAI +
  // Gemini wire builders ship in rc.3.
  const supportsToolUse = providerConfig.providerKey === "anthropic";
  const capabilities = { streaming: false, toolUse: supportsToolUse, caching: supportsToolUse };

  return {
    callsRecorded,
    capabilities,

    async *stream(call) {
      const messages = (call && call.messages) || [];
      const wireTools = supportsToolUse
        ? toWireTools(call && call.tools)
        : [];

      callsRecorded.push({
        messages,
        tools: wireTools,
        at:    new Date().toISOString()
      });

      let response;
      try {
        response = await chatCompletion({
          providerKey:    providerConfig.providerKey,
          baseUrl:        providerConfig.baseUrl,
          model:          providerConfig.model,
          fallbackModels: providerConfig.fallbackModels || [],
          apiKey:         providerConfig.apiKey || "",
          messages,
          tools:          wireTools.length > 0 ? wireTools : undefined,
          fetchImpl:      providerConfig.fetchImpl
        });
      } catch (e) {
        // Surface upstream errors as a chat-shape text event so the chat
        // overlay can render the failure inline rather than crashing.
        const msg = "Provider error: " + (e && e.message || String(e));
        yield { kind: "text", token: msg };
        yield { kind: "done", text:  msg };
        return;
      }

      // For Anthropic, scan raw content blocks for tool_use BEFORE
      // emitting text. chatService captures only the first tool_use per
      // round (per CH10), so order doesn't matter — but yielding tool_use
      // first matches the natural Anthropic stream-event order.
      const toolUseBlocks = supportsToolUse ? extractToolUseBlocks(response && response.raw) : [];
      for (const tu of toolUseBlocks) {
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
// produce the Anthropic wire shape. Anthropic's tools schema is
// {name, description, input_schema}; extras are silently dropped by the
// API but waste prompt tokens.
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

// extractToolUseBlocks(rawAnthropicResponse) → [{ id, name, input }]
// Anthropic returns content as an array of blocks; tool_use blocks have
// {type:"tool_use", id, name, input}. We collect all of them; chatService
// honors only the first per round.
function extractToolUseBlocks(raw) {
  if (!raw || !Array.isArray(raw.content)) return [];
  const out = [];
  for (const b of raw.content) {
    if (b && b.type === "tool_use" && typeof b.name === "string") {
      out.push({ id: b.id || null, name: b.name, input: b.input || {} });
    }
  }
  return out;
}
