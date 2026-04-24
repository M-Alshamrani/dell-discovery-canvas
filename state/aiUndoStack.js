// state/aiUndoStack.js — Phase 19e / v2.4.5
//
// Persistent undo stack for AI-applied mutations. Every apply-on-confirm
// flow pushes a labelled snapshot BEFORE mutating the session. The
// header's "↶ Undo last AI change" chip calls undoLast() to roll back.
//
// v2.4.5 changes vs v2.4.4:
//   - Persisted to localStorage under `ai_undo_v1` (survives page reload).
//   - Bounded to MAX_DEPTH=10 entries; oldest dropped on overflow.
//   - Cleared on resetSession / resetToDemo (sessionStore calls clear()).
//   - Emits `session-changed` on undoLast so views re-render cleanly.
//   - undoAll() reverses every stacked entry and leaves the session at
//     the oldest snapshot (one-click "undo-all" for the header tooltip).

import { session, replaceSession, saveToLocalStorage } from "./sessionStore.js";
import { emitSessionChanged } from "../core/sessionEvents.js";

var MAX_DEPTH   = 10;
var STORAGE_KEY = "ai_undo_v1";

var stack = loadFromStorage();   // [{ label, snapshot, timestamp }]
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
  persistToStorage();
  notify();
}

export function undoLast() {
  if (stack.length === 0) return null;
  var entry = stack.pop();
  try {
    replaceSession(entry.snapshot);
    saveToLocalStorage();
    persistToStorage();
    emitSessionChanged("ai-undo", entry.label || "");
  } catch (e) {
    // If replaceSession isn't available, fall back to a shallow merge.
    // Better to leave a trace than silently no-op.
    console.error("[aiUndoStack] undoLast failed:", e);
  }
  notify();
  return entry;
}

// v2.4.5 — reverse every stacked entry in one shot. Restores the
// snapshot at the *bottom* of the stack (the oldest = state before any
// AI changes tracked so far), then clears.
export function undoAll() {
  if (stack.length === 0) return 0;
  var count = stack.length;
  var oldest = stack[0];
  try {
    replaceSession(oldest.snapshot);
    saveToLocalStorage();
    stack = [];
    persistToStorage();
    emitSessionChanged("ai-undo", "Undo all (" + count + ")");
  } catch (e) {
    console.error("[aiUndoStack] undoAll failed:", e);
  }
  notify();
  return count;
}

export function canUndo() { return stack.length > 0; }

export function peekLabel() {
  if (stack.length === 0) return null;
  return stack[stack.length - 1].label;
}

export function depth() { return stack.length; }

// v2.4.5 — label list, newest first. Used by the header tooltip to show
// "what will be rolled back" in order.
export function recentLabels(maxCount) {
  var limit = typeof maxCount === "number" ? maxCount : stack.length;
  return stack.slice(-limit).reverse().map(function(e) { return e.label || "AI change"; });
}

// v2.4.5 — drop the entire stack. Called from sessionStore.resetSession
// and sessionStore.resetToDemo so the undo history doesn't survive a
// deliberate "start over" action (those reset flows themselves are
// undoable via Load demo / Export before reset — not via this chip).
export function clear() {
  if (stack.length === 0) return;
  stack = [];
  persistToStorage();
  notify();
}

// Exposed for tests.
export function _resetForTests() { stack = []; persistToStorage(); notify(); }

function cloneSession() {
  // Session is pure JSON per the project's architecture invariant, so
  // structured-clone-equivalent via JSON round-trip is safe.
  try { return JSON.parse(JSON.stringify(session)); }
  catch (e) { return {}; }
}

function persistToStorage() {
  try {
    // Guard against non-browser contexts (tests may run headless in the
    // future). Typeof check avoids hard failure.
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stack));
  } catch (e) {
    // Quota exceeded or disabled — best-effort; undo still works
    // in-memory until reload.
  }
}

function loadFromStorage() {
  try {
    if (typeof localStorage === "undefined") return [];
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Trim to MAX_DEPTH in case a prior version wrote more.
    while (parsed.length > MAX_DEPTH) parsed.shift();
    return parsed.filter(function(e) {
      return e && typeof e === "object" && e.snapshot && typeof e.snapshot === "object";
    });
  } catch (e) { return []; }
}
