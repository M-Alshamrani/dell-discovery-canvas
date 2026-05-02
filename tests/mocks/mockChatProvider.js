// tests/mocks/mockChatProvider.js
//
// THIN RE-EXPORT from services/mockChatProvider.js (the canonical
// production-located path) per SPEC §S22 + RULES §17.
//
// History: this module USED to be the canonical implementation.
// Production code (CanvasChatOverlay) imported from here at runtime,
// which violated production-from-tests layering (BUG-007). The fix
// (commit at v3.0.0-rc.2) moved the implementation to
// `services/mockChatProvider.js`; this path remains as a re-export
// so existing V-CHAT-* test imports keep working without changes.
//
// New code should import from `services/mockChatProvider.js` directly.

export { createMockChatProvider } from "../../services/mockChatProvider.js";
