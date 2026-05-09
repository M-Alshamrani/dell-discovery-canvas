// state/aiUndoStack.js -- v3-pure undo stack (rc.7 / 7e-5).
//
// Per SPEC §S40 (v3-pure architecture). Snapshots the v3 engagement
// object before every AI mutation; undo restores by setActiveEngagement.
// The engagement is immutable per commit (every commitAction returns a
// new reference per §S4 action contract), so a snapshot is just a
// retained reference + JSON round-trip for safety against external
// mutation.
//
// The "↶ Undo last AI change" header chip calls undoLast() to roll
// back. Stack persists to localStorage under `ai_undo_v1` (carried
// over from v2 storage key for continuity; no migration concern since
// stale snapshots from v2 fail v3 EngagementSchema validation on
// restore and are silently dropped).
//
// Bounded to MAX_DEPTH=10 entries; oldest dropped on overflow.
// Cleared on resetSession / engagement reset.

import { getActiveEngagement, setActiveEngagement } from "./engagementStore.js";
import { EngagementSchema } from "../schema/engagement.js";
// rc.7 / 7e-8 Step K · core/sessionEvents.js DELETED. setActiveEngagement
// above already emits to subscribeActiveEngagement listeners; the only
// thing the legacy emitSessionChanged("ai-undo", ...) did beyond that
// was pulse markSaving() for the topbar — kept via direct call below.
import { markSaving } from "../core/saveStatus.js";

var MAX_DEPTH   = 10;
var STORAGE_KEY = "ai_undo_v1";

var stack = loadFromStorage();   // [{ label, snapshot, timestamp }]
var listeners = [];

export function onUndoChange(fn) {
  listeners.push(fn);
  return function unsubscribe() { listeners = listeners.filter(function(l) { return l !== fn; }); };
}

function notify() { listeners.forEach(function(fn) { try { fn(); } catch (e) { /* don't let UI errors break the stack */ } }); }

// push(label, optionalSnapshot) -- captures the CURRENT engagement
// (immutable reference) before an AI commit. Caller MUST push BEFORE
// the commit, so undo restores the pre-commit state. The optional
// argument lets tests inject a specific snapshot for deterministic
// rollback (mirrors v2 contract).
export function push(label, optionalSnapshot) {
  var snap = optionalSnapshot || cloneEngagement();
  stack.push({
    label:     typeof label === "string" ? label : "AI change",
    snapshot:  snap,
    timestamp: Date.now()
  });
  while (stack.length > MAX_DEPTH) stack.shift();
  persistToStorage();
  notify();
}

export function undoLast() {
  if (stack.length === 0) return null;
  var entry = stack.pop();
  try {
    if (entry.snapshot) {
      // Validate snapshot before installing — guards against legacy v2
      // snapshots in localStorage from a pre-7e-5 session.
      var validation = EngagementSchema.safeParse(entry.snapshot);
      if (validation.success) {
        setActiveEngagement(validation.data);
      } else {
        console.warn("[aiUndoStack] undoLast: snapshot schema-invalid; skipping restore");
      }
    }
    persistToStorage();
    markSaving(); // Step K · was: emitSessionChanged("ai-undo", entry.label || "")
  } catch (e) {
    console.error("[aiUndoStack] undoLast failed:", e);
  }
  notify();
  return entry;
}

// Reverse every stacked entry in one shot. Restores the snapshot at
// the *bottom* of the stack (the oldest = state before any AI changes
// tracked so far), then clears.
export function undoAll() {
  if (stack.length === 0) return 0;
  var count = stack.length;
  var oldest = stack[0];
  try {
    if (oldest.snapshot) {
      var validation = EngagementSchema.safeParse(oldest.snapshot);
      if (validation.success) {
        setActiveEngagement(validation.data);
      } else {
        console.warn("[aiUndoStack] undoAll: oldest snapshot schema-invalid; skipping restore");
      }
    }
    stack = [];
    persistToStorage();
    markSaving(); // Step K · was: emitSessionChanged("ai-undo", "Undo all (...)")
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

export function recentLabels(maxCount) {
  var limit = typeof maxCount === "number" ? maxCount : stack.length;
  return stack.slice(-limit).reverse().map(function(e) { return e.label || "AI change"; });
}

export function clear() {
  if (stack.length === 0) return;
  stack = [];
  persistToStorage();
  notify();
}

export function _resetForTests() { stack = []; persistToStorage(); notify(); }

function cloneEngagement() {
  // The engagement object is immutable per §S4 (every commitAction
  // returns a new reference), so we COULD retain the reference
  // directly. We JSON round-trip for two reasons:
  //   (a) defensive against any external code that mutates a returned
  //       engagement (forbidden by F19.5.5 but cheap to harden);
  //   (b) the snapshot persists to localStorage as JSON anyway —
  //       round-tripping at push time matches the persistence shape.
  try {
    var eng = getActiveEngagement();
    return eng ? JSON.parse(JSON.stringify(eng)) : null;
  } catch (e) { return null; }
}

function persistToStorage() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stack));
  } catch (e) {
    /* quota exceeded / disabled — best-effort; in-memory still works */
  }
}

function loadFromStorage() {
  try {
    if (typeof localStorage === "undefined") return [];
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    while (parsed.length > MAX_DEPTH) parsed.shift();
    return parsed.filter(function(e) {
      return e && typeof e === "object" && e.snapshot && typeof e.snapshot === "object";
    });
  } catch (e) { return []; }
}
