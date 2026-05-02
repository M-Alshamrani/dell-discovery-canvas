// state/chatMemory.js
//
// SPEC §S20.9 · Per-engagement chat-transcript persistence.
// localStorage key shape: `dell-canvas-chat::<engagementId>`.
// Switching engagements (when v3.1 multi-engagement lands) yields a
// fresh transcript per CH9.
//
// Rolling-window summarization (CH11) triggers when the transcript
// exceeds CHAT_TRANSCRIPT_WINDOW messages OR CHAT_TRANSCRIPT_TOKEN_BUDGET
// tokens; older turns collapse into one synthetic
// `{role:"system", content:"PRIOR CONTEXT: <summary>"}` message.
//
// Forbidden (CH5): persisting API keys, OAuth tokens, or anything
// tagged sensitive in core/aiConfig.js. Only the user-typed messages +
// model responses are persisted.
//
// Status: STUB (rc.2 RED-first 2026-05-02).
//
// Authority: docs/v3.0/SPEC.md §S20.9 · docs/v3.0/TESTS.md §T20
//            V-CHAT-{6,7,8} · docs/RULES.md §16 CH5+CH9+CH11.

export const CHAT_TRANSCRIPT_WINDOW = 30;
export const CHAT_TRANSCRIPT_TOKEN_BUDGET = 12000;
export const TRANSCRIPT_KEY_PREFIX = "dell-canvas-chat::";

const EMPTY_TRANSCRIPT = Object.freeze({ messages: [], summary: null });

// loadTranscript(engagementId) → { messages, summary }
// Returns existing transcript or {messages: [], summary: null} if none.
export function loadTranscript(_engagementId) {
  // Stub: always returns empty transcript regardless of saves.
  return { messages: [], summary: null };
}

// saveTranscript(engagementId, transcript) → void
// Atomic localStorage write. Validates transcript shape before save.
export function saveTranscript(_engagementId, _transcript) {
  /* stub: intentional no-op for RED-first */
}

// clearTranscript(engagementId) → void
// Removes the localStorage key. UI calls after user confirms in a
// Notify modal.
export function clearTranscript(_engagementId) {
  /* stub: intentional no-op for RED-first */
}

// summarizeIfNeeded(transcript) → transcript'
// When transcript exceeds CHAT_TRANSCRIPT_WINDOW or
// CHAT_TRANSCRIPT_TOKEN_BUDGET, collapses older turns into one synthetic
// {role:"system", content:"PRIOR CONTEXT: <summary>"} message via the
// active provider. Idempotent: re-running on an already-summarized
// transcript compresses the older summary further only if the rolling
// window grew again.
export function summarizeIfNeeded(transcript) {
  // Stub: returns input verbatim regardless of length.
  return transcript;
}

// _resetForTests · clears all chat-memory localStorage keys. Used
// between describe blocks to avoid pollution across V-CHAT vectors.
export function _resetForTests() {
  /* stub: intentional no-op for RED-first */
}
