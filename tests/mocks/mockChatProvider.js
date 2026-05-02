// tests/mocks/mockChatProvider.js
//
// SPEC §S14.4 mock-list extension · deterministic chat provider for
// V-CHAT-* vectors. Streams pre-canned responses token-by-token (or
// emits tool_use blocks) on demand. NOT for production use; imported
// only by the test suite + (per S20.11) by the chat surface when the
// user has Mock toggled in the Lab.
//
// Status: STUB (rc.2 RED-first 2026-05-02).
//
// Authority: docs/v3.0/SPEC.md §S20.11 · docs/v3.0/TESTS.md §T20
//            V-CHAT-{4,5,11}.

// createMockChatProvider({ responses })
//   responses: Array<
//     | { kind: "text",     text: string }
//     | { kind: "tool_use", name: string, input: object }
//   >
//
// Returns a provider that exposes:
//   - stream({ messages, tools }) → AsyncIterable<{token? text? tool_use?}>
//     (yields tokens of the next text response, OR a tool_use block,
//      then ends; each call advances one entry in `responses`)
//   - callsRecorded: Array<{ messages, tools, at }>  (for assertions)
//
// Per S14.5 anti-cheat: this provider is on the closed mock-list. It
// is never used to bypass the chat layer's own logic.
export function createMockChatProvider(_opts) {
  // Stub: minimal shape so V-CHAT-{4,5,11} tests can probe; real impl
  // returns a streamable provider that walks `responses` deterministically.
  return {
    callsRecorded: [],
    async stream(_call) {
      throw new Error("mockChatProvider.stream: not implemented (rc.2 RED-first)");
    },
    capabilities: { streaming: true, toolUse: true, caching: false }
  };
}
