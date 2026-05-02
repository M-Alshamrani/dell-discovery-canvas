// services/mockChatProvider.js
//
// SPEC §S22 · production-located mock chat provider. Architectural
// fix for BUG-007: previously CanvasChatOverlay imported from
// `tests/mocks/mockChatProvider.js` at runtime, violating
// production-from-tests anti-pattern (per RULES §17 / SPEC §S23).
//
// The Mock toggle in the chat overlay is a legitimate production
// UX feature (free, deterministic, offline-safe). Its provider
// lives here. The test path `tests/mocks/mockChatProvider.js` now
// thin-re-exports from this file so V-CHAT-* test imports keep
// working without modification.
//
// Streaming protocol (matches what chatService consumes):
//   yield { kind: "text",      token: "<word or whitespace>" }
//   yield { kind: "done",      text:  "<full text>" }
//   yield { kind: "tool_use",  name:  "<tool>", input: { ... } }
//
// Each call to provider.stream({ messages, tools }) advances one
// entry in opts.responses. Throws if scripted responses are
// exhausted (the test/UI scripted the wrong number of turns).
//
// Forbidden (per RULES §17 / SPEC §S23):
//   - importing from tests/ (this IS the canonical path; tests
//     re-export from here, never the reverse)
//   - live network code (mock = deterministic, no I/O)
//   - non-deterministic randomness without an explicit seed
//
// Authority: docs/v3.0/SPEC.md §S22 · docs/v3.0/TESTS.md §T22 V-MOCK-1 ·
//            docs/RULES.md §16 CH14 + §17.

export function createMockChatProvider(opts) {
  const responses = (opts && Array.isArray(opts.responses)) ? opts.responses.slice() : [];
  const callsRecorded = [];
  let callIdx = 0;

  return {
    callsRecorded,
    capabilities: { streaming: true, toolUse: true, caching: false },

    async *stream(call) {
      callsRecorded.push({
        messages: call && call.messages,
        tools:    call && call.tools,
        at:       new Date().toISOString()
      });

      if (callIdx >= responses.length) {
        throw new Error("mockChatProvider.stream: no more scripted responses (call #" + (callIdx + 1) + ")");
      }
      const r = responses[callIdx++];

      if (r.kind === "tool_use") {
        yield { kind: "tool_use", name: r.name, input: r.input || {} };
        return;
      }

      if (r.kind === "text" || !r.kind) {
        const text = r.text || "";
        // Tokenize on whitespace so "hello there" → ["hello", " ", "there"].
        // Yield each as a token; matches the streaming feel real providers give.
        const tokens = text.split(/(\s+)/).filter(t => t.length > 0);
        for (const t of tokens) {
          yield { kind: "text", token: t };
        }
        yield { kind: "done", text };
        return;
      }

      throw new Error("mockChatProvider.stream: unknown response kind '" + r.kind + "'");
    }
  };
}
