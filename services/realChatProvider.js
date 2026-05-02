// services/realChatProvider.js
//
// SPEC §S20.5 + §S20.8 · adapter from the v3 chat-streaming protocol
// (`async *stream({messages, tools}) yield {kind, ...}`) to the
// existing v2.4.5.1 services/aiService.js chatCompletion call shape.
//
// v1: NO per-token streaming. Calls chatCompletion (which handles
// retry + fallback + provider-specific request shape), receives the
// full response text, then yields the whole thing as a single
// {kind: "text", token: <fullText>} event followed by {kind: "done"}.
// The chat overlay still feels responsive because chatCompletion is
// fast for short responses; for long responses, a true SSE streaming
// path lands in chunk E.
//
// v1: NO tool-use round-trip. The aiService.chatCompletion call
// returns plain text only. If the user's question requires a
// selector (e.g. "how many gaps"), the chat overlay renders the
// model's plain-text answer; the canvas-context system prompt is
// rich enough that the model can answer most questions from the
// inlined snapshot. Tool-use over the real provider lands in chunk E
// (Anthropic + OpenAI + Gemini all expose function-calling shapes
// distinct enough to warrant their own request builder).
//
// Forbidden (RULES §16):
//   - importing state/sessionState.js
//   - importing state/collections/* (read-only)
//
// Authority: docs/v3.0/SPEC.md §S20.5.1 + §S20.8 · `services/aiService.js`
//            chatCompletion contract.

import { chatCompletion } from "./aiService.js";

// createRealChatProvider({ providerKey, baseUrl, model, fallbackModels?, apiKey? })
//   → { stream({messages, tools}) → AsyncIterable<event>, callsRecorded }
//
// `messages` is the system + transcript + user message array assembled
// by chatService. `tools` is ignored in v1 (tool-use lands in chunk E).
// Each call to stream() pushes a record into callsRecorded for parity
// with mockChatProvider — useful if a future browser smoke wants to
// inspect what was sent on the wire.
export function createRealChatProvider(opts) {
  const providerConfig = opts || {};
  const callsRecorded = [];
  const capabilities = { streaming: false, toolUse: false, caching: false };

  return {
    callsRecorded,
    capabilities,

    async *stream(call) {
      const messages = (call && call.messages) || [];
      callsRecorded.push({
        messages,
        tools: call && call.tools,
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
          messages
        });
      } catch (e) {
        // Surface upstream errors as a chat-shape text event so the chat
        // overlay can render the failure inline rather than crashing.
        const msg = "Provider error: " + (e && e.message || String(e));
        yield { kind: "text", token: msg };
        yield { kind: "done", text:  msg };
        return;
      }

      const text = (response && typeof response.text === "string") ? response.text : "";
      // v1: emit the full response as ONE text event. Per-token streaming
      // for SSE-capable providers ships in chunk E. The chat UI handles
      // either shape (one big event or many small ones) identically.
      if (text.length > 0) {
        yield { kind: "text", token: text };
      }
      yield { kind: "done", text };
    }
  };
}
