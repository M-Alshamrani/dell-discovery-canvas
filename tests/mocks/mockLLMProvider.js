// tests/mocks/mockLLMProvider.js — v3.0 · SPEC sec S14.4 boundary 1
//
// LLM provider is one of the four sanctioned mock targets. v3.0 mock
// returns canned responses keyed by prompt hash so tests are
// deterministic.
//
// Usage:
//   const provider = createMockLLMProvider({
//     responses: {
//       "Hello, world": { model: "mock-claude", text: "Hi there." }
//     },
//     defaultResponse: { model: "mock-default", text: "Mock response" }
//   });
//   const r = await provider.complete({ prompt: "Hello, world" });

export function createMockLLMProvider({ responses = {}, defaultResponse } = {}) {
  return {
    async complete({ prompt }) {
      if (responses[prompt]) return responses[prompt];
      if (defaultResponse) return defaultResponse;
      // Fallback: echo the prompt prefix so tests can verify the LLM was
      // actually called with the resolved prompt.
      return {
        model: "mock-fallback",
        text:  "Mock response for prompt starting with: " + prompt.slice(0, 50)
      };
    }
  };
}
