// core/saveStatus.js , v2.4.13 S2A
//
// Tracks the topbar save-status indicator state. Subscribers (app.js
// renderSessionStrip) repaint the secondary line whenever status changes.
//
// State machine:
//   "idle"   -> no session yet (fresh canvas, customer.name empty)
//   "saving" -> transient pulse around an emitSessionChanged + writeback
//   "saved"  -> last writeback succeeded; savedAt = timestamp
//   "demo"   -> session.isDemo === true (overrides "saved")
//
// state/sessionStore.saveToLocalStorage() calls markSaved() after each
// successful localStorage write. core/sessionEvents.emitSessionChanged()
// calls markSaving() before emitting so the visible state pulses to
// "Saving..." for ~250ms, then snaps to "Saved just now" on the next
// write. Renderers subscribe via onStatusChange.

var listeners = [];
var status    = "idle";
var savedAt   = 0;

export function getStatus() {
  return { status: status, savedAt: savedAt };
}

export function markIdle() {
  status  = "idle";
  savedAt = 0;
  notify();
}

export function markSaving() {
  status = "saving";
  notify();
}

export function markSaved(opts) {
  var isDemo = !!(opts && opts.isDemo);
  status  = isDemo ? "demo" : "saved";
  savedAt = Date.now();
  notify();
}

export function onStatusChange(fn) {
  if (typeof fn !== "function") return function() {};
  listeners.push(fn);
  return function unsubscribe() {
    listeners = listeners.filter(function(l) { return l !== fn; });
  };
}

export function _resetForTests() {
  listeners = [];
  status    = "idle";
  savedAt   = 0;
}

function notify() {
  var snapshot = { status: status, savedAt: savedAt };
  listeners.slice().forEach(function(fn) {
    try { fn(snapshot); }
    catch (e) { /* swallow */ }
  });
}
