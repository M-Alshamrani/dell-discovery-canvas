// services/chatHandshake.js — SPEC §S20.16 + §S25.5 + BUG-020 fix
//
// Single source of truth for the first-turn handshake regex constants.
// Previously these lived as private consts in services/chatService.js,
// so the chat overlay's onToken streaming-time path had no way to
// re-strip incremental tokens, leaving a brief on-screen leak when
// Gemini (or another model) emitted the handshake on a subsequent
// turn (BUG-020 user-reported 2026-05-02 LATE EVENING).
//
// Two regexes:
//
//   HANDSHAKE_RE — strict, anchored, captures the sha. Used by
//   chatService.streamChat to detect + validate the FIRST line of the
//   FIRST response. Anchored to the start so it only matches the
//   intended first-turn position.
//
//   HANDSHAKE_STRIP_RE — permissive, global, strips ANY occurrence
//   anywhere in the response. Tolerates leading whitespace, an
//   optional opening bracket (Gemini sometimes drops the brackets
//   per BUG-016 / 2026-05-02 PM user report). Applied to the visible
//   response unconditionally and now ALSO at streaming time in the
//   chat overlay's onToken handler (BUG-020 fix per §S31 sibling
//   discipline) and in chatMemory.loadTranscript (BUG-016).
//
// stripHandshake(text) is the canonical strip helper — applies
// HANDSHAKE_STRIP_RE then trims leading whitespace. Idempotent; cheap.
// Returns the cleaned text. Callers in chatService + chatMemory +
// CanvasChatOverlay all use this single function so the contract
// surfaces in exactly one place.
//
// Authority: docs/v3.0/SPEC.md §S20.16 · docs/RULES.md §16 CH18.

export const HANDSHAKE_RE       = /^\s*\[contract-ack\s+v3\.0\s+sha=([0-9a-f]{8})\]\s*\n?/i;
export const HANDSHAKE_STRIP_RE = /(?:^|[\s*_>])\[?\s*contract-ack\s+v3\.0\s+sha=[0-9a-f]{8}\s*\]?\s*\n?/gi;

export function stripHandshake(text) {
  if (typeof text !== "string" || text.length === 0) return text;
  return text.replace(HANDSHAKE_STRIP_RE, "").replace(/^\s+/, "");
}
