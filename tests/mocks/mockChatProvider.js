// tests/mocks/mockChatProvider.js
//
// SPEC §S14.4 mock-list extension · deterministic chat provider for
// V-CHAT-* vectors. Streams pre-canned responses token-by-token (or
// emits tool_use blocks) on demand. Per S20.11 also drives the chat
// surface when the user has Mock toggled in the Lab — production-safe
// for offline smoke + deterministic test paths.
//
// Streaming protocol (matches what chatService consumes):
//   yield { kind: "text",      token: "<word or whitespace>" }
//   yield { kind: "done",      text:  "<full text>" }
//   yield { kind: "tool_use",  name:  "<tool>", input: { ... } }
//
// Each call to provider.stream({ messages, tools }) advances one entry
// in opts.responses. Throws if scripted responses are exhausted (the
// test fixture has a bug if this happens).
//
// Authority: docs/v3.0/SPEC.md §S20.11 · docs/v3.0/TESTS.md §T20
//            V-CHAT-{4,5,11}.

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
