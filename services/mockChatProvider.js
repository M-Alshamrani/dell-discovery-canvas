// services/mockChatProvider.js
//
// SPEC §S22 · production-located mock chat provider. Architectural
// fix for BUG-007: previously CanvasChatOverlay imported from
// `tests/mocks/mockChatProvider.js` at runtime, violating
// production-from-tests anti-pattern (per RULES §17 / SPEC §S23).
//
// The Mock toggle in the chat overlay is a legitimate production UX
// feature (free, deterministic, offline-safe). Its provider lives
// here.
//
// Status: STUB v3.0.0-rc.2 RED-first. Throws "not implemented".
// Real impl ships in the next commit (moves the logic currently in
// `tests/mocks/mockChatProvider.js` here; the test path becomes a
// thin re-export, or callers migrate to this path directly).
//
// Forbidden (per RULES §17 / SPEC §S23):
//   - importing from tests/ (this IS the canonical path; tests
//     re-export from here, never the reverse)
//   - live network code (mock = deterministic, no I/O)
//   - non-deterministic randomness without an explicit seed param
//
// Authority: docs/v3.0/SPEC.md §S22 · docs/v3.0/TESTS.md §T22 V-MOCK-1 ·
//            docs/RULES.md §16 CH14 + §17.

// createMockChatProvider({ responses }) → provider
// Same shape as the existing tests/mocks/mockChatProvider.js (V-CHAT-4/5
// contract): provider exposes `async *stream({messages, tools})` yielding
// {kind:"text",token} / {kind:"done",text} / {kind:"tool_use",name,input}
// events deterministically per scripted responses, plus `callsRecorded`
// for assertion-friendly inspection.
export function createMockChatProvider(_opts) {
  throw new Error("services/mockChatProvider.createMockChatProvider: not implemented (rc.2 RED-first)");
}
