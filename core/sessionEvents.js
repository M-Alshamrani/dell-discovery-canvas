// core/sessionEvents.js — Phase 19e / v2.4.5 Foundations Refresh
//
// Tiny pub/sub for "session state has changed" notifications. AI apply /
// undo / reset-to-demo / reset-empty all emit; views subscribe in
// `app.js` to re-render the current stage with fresh session data.
//
// Without this bus, the v2.4.4 bugs are:
//   - AI apply mutates a tile in place; the tab view keeps its closure
//     references but the visible card never repaints → driver tile
//     appears to vanish.
//   - Undo restores session state but the current tab has already
//     rendered from the pre-undo data; the view blanks or shows a
//     stale "selected" entity that no longer exists.
//
// The contract: every write that goes through `interactions/aiCommands.js`
// OR rewrites the session root (reset/demo/replace) emits `"session-changed"`
// with a `{ reason, label }` payload. Subscribers MUST re-resolve any
// selected entity by id against live session data before re-rendering.
// It is safe for handlers to call `renderStage()` directly — the event
// is not fired during a render pass.

import { markSaving } from "./saveStatus.js";

var listeners = [];

// Subscribe to session-changed events.
// Returns an unsubscribe function.
export function onSessionChanged(fn) {
  if (typeof fn !== "function") return function() {};
  listeners.push(fn);
  return function unsubscribe() {
    listeners = listeners.filter(function(l) { return l !== fn; });
  };
}

// Emit a session-changed event. `reason` identifies the caller for
// debugging/telemetry; `label` is the human-readable action (e.g. the
// undo-stack entry label) for views that want to flash a toast.
// Reasons reserved so far:
//   "ai-apply"       — applyProposal / applyAllProposals after success
//   "ai-undo"        — aiUndoStack.undoLast after restore
//   "session-reset"  — resetSession
//   "session-demo"   — resetToDemo
//   "session-replace"— replaceSession (e.g. import)
export function emitSessionChanged(reason, label) {
  var evt = { reason: reason || "unknown", label: label || "" };
  // v2.4.13 S2A , flip topbar indicator to "Saving..." for the brief
  // window between change and writeback. saveToLocalStorage will flip it
  // back to "saved"/"demo" on its next call. Skip during the test runner
  // afterRestore emit so VT26 etc. don't see flicker.
  if (reason !== "session-replace" || (label || "").indexOf("Tests complete") < 0) {
    markSaving();
  }
  listeners.slice().forEach(function(fn) {
    try { fn(evt); }
    catch (e) { /* never let a handler throw out of the bus */ }
  });
}

// Test-only reset.
export function _resetForTests() { listeners = []; }
