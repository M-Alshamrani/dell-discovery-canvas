// services/mockLLMProvider.js
//
// SPEC §S22 · production-located mock LLM provider. Architectural
// fix for BUG-006: previously V3SkillBuilder imported from
// `tests/mocks/mockLLMProvider.js` at runtime, violating
// production-from-tests anti-pattern (per RULES §17 / SPEC §S23).
//
// The Mock toggle in the v3.0 Skill Builder Lab is a legitimate
// production UX feature (free, deterministic, offline-safe). Its
// provider lives here. The test path
// `tests/mocks/mockLLMProvider.js` now thin-re-exports from this
// file so V-PROD-* test imports keep working without modification.
//
// Forbidden (per RULES §17 / SPEC §S23):
//   - importing from tests/
//   - live network code
//   - non-deterministic randomness
//
// Authority: docs/v3.0/SPEC.md §S22 · docs/v3.0/TESTS.md §T22 V-MOCK-2 ·
//            docs/RULES.md §17.

// createMockLLMProvider({ responses?, defaultResponse? }) → provider
//
//   responses: { [prompt:string]: { model, text } }   -- exact-match prompt → response
//   defaultResponse: { model, text }                  -- fallback if no exact match
//   (if neither present: returns a fallback echoing the prompt prefix
//    so tests can verify the LLM was actually called with the resolved prompt.)
export function createMockLLMProvider({ responses = {}, defaultResponse } = {}) {
  return {
    async complete({ prompt }) {
      if (responses[prompt]) return responses[prompt];
      if (defaultResponse) return defaultResponse;
      return {
        model: "mock-fallback",
        text:  "Mock response for prompt starting with: " + prompt.slice(0, 50)
      };
    }
  };
}
