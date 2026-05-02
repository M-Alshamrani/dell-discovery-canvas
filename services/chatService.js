// services/chatService.js
//
// SPEC §S20 · Canvas Chat — chat-shape entry point that wraps aiService
// for streaming + tool-use + Anthropic prompt-caching. Reuses
// `aiService.chatCompletion` for the non-streaming, non-tool-use path
// where appropriate; adds streaming SSE handling, tool-call round-trip,
// and provider feature detection on top.
//
// Status: STUB (rc.2 RED-first 2026-05-02). V-CHAT-* fail RED against
// these stubs by design until impl lands. Per
// `feedback_spec_and_test_first.md`, the spec + tests + scaffold ship
// before implementation.
//
// Forbidden (per RULES §16 + SPEC §S20.13):
//   - importing state/sessionState.js
//   - importing state/collections/*Actions.js (read-only v1 boundary)
//   - mutating engagement state from chat
//
// Authority: docs/v3.0/SPEC.md §S20 · docs/v3.0/TESTS.md §T20 V-CHAT-* ·
//            docs/RULES.md §16.

// streamChat({engagement, transcript, userMessage, providerConfig,
//             provider?, onToken?, onToolCall?, onComplete?})
// → Promise<{ response: string, provenance: object }>
//
// `provider` is optional injection for tests; production reads from
// providerConfig and dispatches to the active provider. `onToken` is
// invoked once per streamed token. `onToolCall` is invoked when the
// model emits a tool_use; the dispatcher resolves the call locally
// against the active engagement and feeds the tool_result back.
export async function streamChat(_opts) {
  throw new Error("streamChat: not implemented (SPEC §S20 stub; rc.2 RED-first)");
}

// providerCapabilities(providerKey)
// → { streaming: bool, toolUse: bool, caching: bool }
//
// Provider feature detection. Determines whether streamChat uses the
// streaming + tool-use code paths or falls back to context-dump +
// non-streaming for the given provider.
export function providerCapabilities(_providerKey) {
  // Stub default: capabilities all false. Real impl returns true for
  // known providers (anthropic = streaming+toolUse+caching, etc).
  return { streaming: false, toolUse: false, caching: false };
}
