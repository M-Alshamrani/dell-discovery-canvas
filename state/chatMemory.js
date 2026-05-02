// state/chatMemory.js
//
// SPEC §S20.9 · Per-engagement chat-transcript persistence.
// localStorage key shape: `dell-canvas-chat::<engagementId>`. Each
// engagement has its own transcript; switching engagements yields a
// fresh chat (CH9). Rolling-window summarization (CH11) collapses older
// turns into one synthetic PRIOR CONTEXT system message when the
// transcript exceeds CHAT_TRANSCRIPT_WINDOW messages.
//
// Forbidden (CH5): persisting API keys, OAuth tokens, or any field
// tagged sensitive in core/aiConfig.js. The persistence shape MUST
// only carry { role, content, at, provenance? } per message; anything
// else gets stripped at saveTranscript boundary.
//
// Authority: docs/v3.0/SPEC.md §S20.9 · docs/v3.0/TESTS.md §T20
//            V-CHAT-{6,7,8} · docs/RULES.md §16 CH5/CH9/CH11.

export const CHAT_TRANSCRIPT_WINDOW = 30;
export const CHAT_TRANSCRIPT_TOKEN_BUDGET = 12000;
export const TRANSCRIPT_KEY_PREFIX = "dell-canvas-chat::";

function emptyTranscript() {
  return { messages: [], summary: null };
}

// loadTranscript(engagementId) → { messages, summary }
//
// BUG-015 / BUG-016 backfill (2026-05-02 PM): pre-fix, the handshake
// prefix `[contract-ack v3.0 sha=<8>]` could leak into assistant
// messages and get persisted to localStorage. On reload the leak
// reappears even after the chatService strip is fixed. We strip it
// at LOAD time too so old transcripts heal automatically — same
// regex chatService uses post-fix (bracket-optional, global).
const HANDSHAKE_STRIP_RE_LOAD = /(?:^|[\s*_>])\[?\s*contract-ack\s+v3\.0\s+sha=[0-9a-f]{8}\s*\]?\s*\n?/gi;

export function loadTranscript(engagementId) {
  if (!engagementId) return emptyTranscript();
  try {
    const raw = localStorage.getItem(TRANSCRIPT_KEY_PREFIX + engagementId);
    if (!raw) return emptyTranscript();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.messages)) return emptyTranscript();
    return {
      messages: parsed.messages.map(m => {
        if (m && m.role === "assistant" && typeof m.content === "string") {
          return Object.assign({}, m, {
            content: m.content.replace(HANDSHAKE_STRIP_RE_LOAD, "").replace(/^\s+/, "")
          });
        }
        return m;
      }),
      summary:  parsed.summary || null
    };
  } catch (_e) {
    // Corrupt entry; treat as empty. Don't bubble — chat surface should
    // recover gracefully. Caller can inspect via _getLoadError() if added later.
    return emptyTranscript();
  }
}

// saveTranscript(engagementId, transcript) → void
export function saveTranscript(engagementId, transcript) {
  if (!engagementId) return;
  if (!transcript || !Array.isArray(transcript.messages)) return;
  try {
    // Strip to the safe shape per CH5 — only role / content / at /
    // optional provenance survives. Anything else (api keys, internal
    // bookkeeping) is dropped.
    const safe = {
      messages: transcript.messages.map(m => {
        const out = {
          role:    m.role,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          at:      m.at || new Date().toISOString()
        };
        if (m.provenance) out.provenance = m.provenance;
        return out;
      }),
      summary: transcript.summary || null
    };
    localStorage.setItem(TRANSCRIPT_KEY_PREFIX + engagementId, JSON.stringify(safe));
  } catch (e) {
    console.warn("[chatMemory] saveTranscript failed:", e && e.message);
  }
}

// clearTranscript(engagementId) → void
export function clearTranscript(engagementId) {
  if (!engagementId) return;
  try {
    localStorage.removeItem(TRANSCRIPT_KEY_PREFIX + engagementId);
  } catch (e) {
    console.warn("[chatMemory] clearTranscript failed:", e && e.message);
  }
}

// summarizeIfNeeded(transcript) → transcript'
//
// When transcript.messages.length > CHAT_TRANSCRIPT_WINDOW, collapses
// the oldest (length - (window - 1)) messages into one synthetic
// {role:"system", content:"PRIOR CONTEXT: ..."} message so the post-
// summary length is exactly CHAT_TRANSCRIPT_WINDOW.
//
// v1 deterministic summarization: textual concatenation of role +
// truncated content, joined with " | ". v2 may swap to provider-
// generated summaries (slower + non-deterministic). The deterministic
// path is intentionally preserved for V-CHAT-7 (idempotency).
//
// Idempotent: re-running on an already-summarized transcript with
// length === window returns the input unchanged (no further compression).
export function summarizeIfNeeded(transcript) {
  if (!transcript || !Array.isArray(transcript.messages)) return transcript;
  const msgs = transcript.messages;
  if (msgs.length <= CHAT_TRANSCRIPT_WINDOW) return transcript;

  const keepFromIndex = msgs.length - (CHAT_TRANSCRIPT_WINDOW - 1);
  const toCollapse    = msgs.slice(0, keepFromIndex);
  const kept          = msgs.slice(keepFromIndex);

  const summaryText = "PRIOR CONTEXT: " + toCollapse
    .map(m => "[" + m.role + "] " + (m.content || "").slice(0, 200))
    .join(" | ");

  return {
    messages: [
      { role: "system", content: summaryText, at: new Date().toISOString() },
      ...kept
    ],
    summary: transcript.summary || null
  };
}

// _resetForTests · removes every chat-memory key from localStorage.
// Used between describe blocks per §S14 boundary 1 (test harness
// only).
export function _resetForTests() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(TRANSCRIPT_KEY_PREFIX) === 0) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch (_e) { /* swallow per S14 */ }
}
