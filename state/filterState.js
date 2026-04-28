// state/filterState.js , v2.4.14
//
// Tiny pub/sub for cross-tab filter state. Filters live as data
// attributes on document.body so CSS rules can dim non-matching cards
// without JS reflow on every chip click. Persisted to localStorage so
// the user's filter view survives page refresh.
//
// API:
//   getActiveValue(dim)            string | null . the currently-active value for one dimension
//   toggleValue(dim, value)        if active = clear; else set
//   clearDim(dim)                  clear one dimension
//   clearAll()                     clear every dimension
//   subscribe(fn)                  fn(snapshot) called on every change; returns unsub
//   _resetForTests()
//
// Snapshot shape: { services: "migration", layer: null, ... }
//
// v2.4.14 ships with the "services" dimension only. Other dimensions
// (layer, gapType, environment, driver) are reserved in DIMS for
// later releases without breaking the contract.

var STORAGE_KEY = "dd_filter_state_v1";
// v2.4.15 . FB7 . full set of cross-tab filter dimensions wired
// end-to-end. body[data-filter-<dim>] + .gap-card .filter-match-<dim>
// CSS rules combine (via :not chain) for AND-combine semantics.
var DIMS = ["services", "layer", "domain", "urgency", "gapType", "environment", "driver"];

var state = loadState();
var listeners = [];

export function getActiveValue(dim) {
  if (DIMS.indexOf(dim) < 0) return null;
  var v = state[dim];
  return (typeof v === "string" && v.length > 0) ? v : null;
}

export function getSnapshot() {
  return Object.assign({}, state);
}

export function toggleValue(dim, value) {
  if (DIMS.indexOf(dim) < 0) return;
  if (typeof value !== "string" || value.length === 0) return;
  if (state[dim] === value) {
    delete state[dim];
  } else {
    state[dim] = value;
  }
  persist();
  applyToBody();
  notify();
}

export function clearDim(dim) {
  if (DIMS.indexOf(dim) < 0) return;
  if (state[dim] != null) {
    delete state[dim];
    persist();
    applyToBody();
    notify();
  }
}

export function clearAll() {
  state = {};
  persist();
  applyToBody();
  notify();
}

export function subscribe(fn) {
  if (typeof fn !== "function") return function() {};
  listeners.push(fn);
  return function unsub() {
    listeners = listeners.filter(function(l) { return l !== fn; });
  };
}

// Apply current state to document.body data attributes. Idempotent.
// Called on every change + once at module load below.
export function applyToBody() {
  if (typeof document === "undefined" || !document.body) return;
  DIMS.forEach(function(dim) {
    var attr = "data-filter-" + dim;
    var v = state[dim];
    if (typeof v === "string" && v.length > 0) {
      document.body.setAttribute(attr, v);
    } else {
      document.body.removeAttribute(attr);
    }
  });
}

export function _resetForTests() {
  state = {};
  listeners = [];
  applyToBody();
}

// v2.4.15 . re-read state from localStorage + re-apply to body. Used by
// the diagnostics test runner's afterRestore callback so that, after
// runIsolated restores the snapshotted localStorage, the filter
// in-memory state and body data attributes follow suit. Without this,
// _resetForTests calls in tests leave filterState in {} even though
// localStorage has been restored to the user's pre-test snapshot.
export function _reloadFromStorage() {
  state = loadState();
  applyToBody();
}

function persist() {
  try {
    if (Object.keys(state).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (e) { /* ignore */ }
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    var out = {};
    DIMS.forEach(function(dim) {
      if (typeof parsed[dim] === "string" && parsed[dim].length > 0) out[dim] = parsed[dim];
    });
    return out;
  } catch (e) { return {}; }
}

function notify() {
  var snapshot = getSnapshot();
  listeners.slice().forEach(function(fn) {
    try { fn(snapshot); } catch (e) { /* swallow */ }
  });
}

// Apply on module load so a refresh restores the user's filter view.
applyToBody();
