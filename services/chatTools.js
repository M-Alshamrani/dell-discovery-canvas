// services/chatTools.js
//
// SPEC §S20.5.3 · Tool definitions for the §S5 selectors. Each entry
// pairs a selector with a JSON-Schema input shape + dispatcher. The
// LLM emits tool_use blocks against these names; streamChat resolves
// the call locally by invoking the dispatcher against the active
// engagement, then feeds the tool_result back to the model for the
// final text response.
//
// One tool entry per §S5 selector (V-CHAT-3 enforces). Adding a
// selector to §S5 without adding a tool here fails V-CHAT-3.
//
// Status: STUB (rc.2 RED-first 2026-05-02). Empty array; real impl
// adds 7 entries (one per §S5 selector).
//
// Authority: docs/v3.0/SPEC.md §S20.5 · docs/v3.0/TESTS.md §T20 V-CHAT-3.

export const CHAT_TOOLS = [];
