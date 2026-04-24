// state/aiUndoStack.js — Phase 19d / v2.4.4
//
// In-memory undo stack for AI-applied mutations. Every apply-on-confirm
// flow pushes a labelled snapshot BEFORE mutating the session. The
// header's "↶ Undo last AI change" chip calls undoLast() to roll back.
//
// Not persisted across page reloads. A session reload clears the stack
// — the user already has export-JSON as their durable rollback path,
// and persisting the stack across reloads would grow localStorage.

import { session, replaceSession, saveToLocalStorage } from "./sessionStore.js";

var MAX_DEPTH = 10;
var stack = [];   // [{ label, snapshot, timestamp }]
var listeners = [];

// Subscribe — called after every push/undo. UI re-renders the chip.
export function onUndoChange(fn) {
  listeners.push(fn);
  return function unsubscribe() { listeners = listeners.filter(function(l) { return l !== fn; }); };
}

function notify() { listeners.forEach(function(fn) { try { fn(); } catch (e) { /* don't let UI errors break the stack */ } }); }

export function push(label, optionalSnapshot) {
  var snap = optionalSnapshot || cloneSession();
  stack.push({
    label:     typeof label === "string" ? label : "AI change",
    snapshot:  snap,
    timestamp: Date.now()
  });
  // Drop oldest when over cap.
  while (stack.length > MAX_DEPTH) stack.shift();
  notify();
}

export function undoLast() {
  if (stack.length === 0) return null;
  var entry = stack.pop();
  try {
    replaceSession(entry.snapshot);
    saveToLocalStorage();
  } catch (e) {
    // If replaceSession isn't available, fall back to a shallow merge.
    // Better to leave a trace than silently no-op.
    console.error("[aiUndoStack] undoLast failed:", e);
  }
  notify();
  return entry;
}

export function canUndo() { return stack.length > 0; }

export function peekLabel() {
  if (stack.length === 0) return null;
  return stack[stack.length - 1].label;
}

export function depth() { return stack.length; }

// Exposed for tests.
export function _resetForTests() { stack = []; notify(); }

function cloneSession() {
  // Session is pure JSON per the project's architecture invariant, so
  // structured-clone-equivalent via JSON round-trip is safe.
  try { return JSON.parse(JSON.stringify(session)); }
  catch (e) { return {}; }
}
