// tests/mocks/mockLLMProvider.js
//
// THIN RE-EXPORT from services/mockLLMProvider.js (the canonical
// production-located path) per SPEC §S22 + RULES §17.
//
// History: this module USED to be the canonical implementation.
// Production code (V3SkillBuilder) imported from here at runtime,
// which violated production-from-tests layering (BUG-006). The fix
// (commit at v3.0.0-rc.2) moved the implementation to
// `services/mockLLMProvider.js`; this path remains as a re-export
// so existing V-PROD-* + V-DRIFT-* test imports keep working
// without changes.
//
// New code should import from `services/mockLLMProvider.js` directly.

export { createMockLLMProvider } from "../../services/mockLLMProvider.js";
