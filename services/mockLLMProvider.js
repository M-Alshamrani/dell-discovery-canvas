// services/mockLLMProvider.js
//
// SPEC §S22 · production-located mock LLM provider. Architectural
// fix for BUG-006: previously V3SkillBuilder imported from
// `tests/mocks/mockLLMProvider.js` at runtime, violating
// production-from-tests anti-pattern (per RULES §17 / SPEC §S23).
//
// The Mock toggle in the v3.0 Skill Builder Lab is a legitimate
// production UX feature (free, deterministic, offline-safe). Its
// provider lives here.
//
// Status: STUB v3.0.0-rc.2 RED-first. Throws "not implemented".
// Real impl ships in the next commit (moves the logic currently
// in `tests/mocks/mockLLMProvider.js` here).
//
// Forbidden (per RULES §17 / SPEC §S23):
//   - importing from tests/
//   - live network code
//   - non-deterministic randomness
//
// Authority: docs/v3.0/SPEC.md §S22 · docs/v3.0/TESTS.md §T22 V-MOCK-2 ·
//            docs/RULES.md §17.

// createMockLLMProvider({ defaultResponse }) → provider
// Same shape as the existing tests/mocks/mockLLMProvider.js (V-PROD
// contract): provider exposes `async complete({prompt})` returning
// `{model, text}` deterministically.
export function createMockLLMProvider(_opts) {
  throw new Error("services/mockLLMProvider.createMockLLMProvider: not implemented (rc.2 RED-first)");
}
