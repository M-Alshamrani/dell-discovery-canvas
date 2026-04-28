// state/filterState.js , v2.4.14, multi-select v2.4.15-polish iter-4
//
// Cross-tab filter state. Filters live as data attributes on
// document.body so CSS rules can dim non-matching cards without JS
// reflow on every chip click. Persisted to localStorage so the user's
// filter view survives page refresh.
//
// v2.4.15-polish iter-4 . MULTI-SELECT. State per dim is now an array
// of values (was: single string). User can combine within a dim
// ("replace + ops", "compute + storage + virtualization", "Main +
// DR"). Multi-dim AND-combine still applies. body[data-filter-<dim>]
// is the space-joined value list when any active; CSS dim rules
// continue to use the attribute-presence selector unchanged.
//
// API:
//   getActiveValues(dim)        Array<string> . the active values for one dimension (empty array when none)
//   getActiveValue(dim)         string | null . LEGACY: returns the first active value (kept for v2.4.14 callers)
//   isActive(dim, value)        boolean . convenience
//   toggleValue(dim, value)     toggle membership in the array
//   setValues(dim, values)      replace the array wholesale
//   clearDim(dim)               clear one dimension
//   clearAll()                  clear every dimension and toggle
//   subscribe(fn)               fn(snapshot) called on every change; returns unsub
//   getSnapshot()               { services: ["migration","training"], layer: ["compute"], ... }
//   _resetForTests()
//
// Snapshot shape: { <dim>: Array<string> } when active; key absent or
// empty array when no values. Toggles live in a separate sub-store
// (TOGGLES_KEY) accessed via getToggle / setToggle / getToggles.

var STORAGE_KEY = "dd_filter_state_v1";
var TOGGLES_KEY = "dd_filter_toggles_v1";
// v2.4.15-polish iter-4 . removed "domain" per user direction (Tab 4
// FilterBar now exposes Service / Layer / Environment / Gap type /
// Urgency). "domain" stays available for any caller that still
// references it; it just isn't surfaced in the UI.
var DIMS = ["services", "layer", "domain", "urgency", "gapType", "environment", "driver"];
var TOGGLE_KEYS = ["needsReviewOnly", "showClosedGaps"];

var state = loadState();
var toggles = loadToggles();
var listeners = [];

// Always returns an Array<string>. Empty array means "no filter on
// this dim". Internally state[dim] may be undefined or an array.
export function getActiveValues(dim) {
  if (DIMS.indexOf(dim) < 0) return [];
  var v = state[dim];
  return Array.isArray(v) ? v.slice() : [];
}

// LEGACY single-value getter. Returns the FIRST active value or null.
// Kept so v2.4.14 callers (e.g. SummaryRoadmapView) keep working
// while consumers migrate to getActiveValues. New code should use
// getActiveValues + a "is in" check.
export function getActiveValue(dim) {
  var arr = getActiveValues(dim);
  return arr.length > 0 ? arr[0] : null;
}

export function isActive(dim, value) {
  return getActiveValues(dim).indexOf(value) >= 0;
}

export function getSnapshot() {
  var out = {};
  DIMS.forEach(function(d) {
    if (Array.isArray(state[d]) && state[d].length > 0) {
      out[d] = state[d].slice();
    }
  });
  return out;
}

// v2.4.15-polish iter-4 . toggleValue now toggles MEMBERSHIP in the
// dim's array (was: single-value swap). Add when not present, remove
// when present. Preserves order of insertion so the UI can render
// active chips in user-toggle order.
export function toggleValue(dim, value) {
  if (DIMS.indexOf(dim) < 0) return;
  if (typeof value !== "string" || value.length === 0) return;
  var arr = Array.isArray(state[dim]) ? state[dim].slice() : [];
  var idx = arr.indexOf(value);
  if (idx >= 0) arr.splice(idx, 1);
  else          arr.push(value);
  if (arr.length === 0) delete state[dim];
  else                  state[dim] = arr;
  persist();
  applyToBody();
  notify();
}

// Replace a dim's value list wholesale. Used when callers want to
// drive the state from a different UI surface (e.g. drag-select).
export function setValues(dim, values) {
  if (DIMS.indexOf(dim) < 0) return;
  var arr = Array.isArray(values)
    ? values.filter(function(v) { return typeof v === "string" && v.length > 0; })
    : [];
  if (arr.length === 0) delete state[dim];
  else                  state[dim] = arr.slice();
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
  toggles = {};
  persist();
  persistToggles();
  applyToBody();
  notify();
}

export function getToggle(key) {
  if (TOGGLE_KEYS.indexOf(key) < 0) return false;
  return !!toggles[key];
}
export function setToggle(key, value) {
  if (TOGGLE_KEYS.indexOf(key) < 0) return;
  var v = !!value;
  if ((toggles[key] || false) === v) return;
  if (v) toggles[key] = true; else delete toggles[key];
  persistToggles();
  applyToBody();
  notify();
}
export function getToggles() {
  var out = {};
  TOGGLE_KEYS.forEach(function(k) { out[k] = !!toggles[k]; });
  return out;
}

export function subscribe(fn) {
  if (typeof fn !== "function") return function() {};
  listeners.push(fn);
  return function unsub() {
    listeners = listeners.filter(function(l) { return l !== fn; });
  };
}

// Apply current state to document.body data attributes. Idempotent.
// v2.4.15-polish iter-4 . body attr value is the space-joined list of
// active values for that dim. CSS attribute-presence selectors
// (body[data-filter-services]) continue to match because we only set
// the attribute when at least one value is active.
export function applyToBody() {
  if (typeof document === "undefined" || !document.body) return;
  DIMS.forEach(function(dim) {
    var attr = "data-filter-" + dim;
    var arr = state[dim];
    if (Array.isArray(arr) && arr.length > 0) {
      document.body.setAttribute(attr, arr.join(" "));
    } else {
      document.body.removeAttribute(attr);
    }
  });
  TOGGLE_KEYS.forEach(function(k) {
    var attr = "data-toggle-" + k;
    if (toggles[k]) document.body.setAttribute(attr, "true");
    else            document.body.removeAttribute(attr);
  });
}

export function _resetForTests() {
  state = {};
  toggles = {};
  listeners = [];
  try {
    localStorage.removeItem("dd_filter_panel_open_v1");
    localStorage.removeItem("dd_filter_dim_open_v1");
  } catch (e) { /* ignore */ }
  applyToBody();
}

export function _reloadFromStorage() {
  state = loadState();
  toggles = loadToggles();
  applyToBody();
}

function persistToggles() {
  try {
    var live = {};
    TOGGLE_KEYS.forEach(function(k) { if (toggles[k]) live[k] = true; });
    if (Object.keys(live).length === 0) localStorage.removeItem(TOGGLES_KEY);
    else                                  localStorage.setItem(TOGGLES_KEY, JSON.stringify(live));
  } catch (e) { /* ignore */ }
}
function loadToggles() {
  try {
    var raw = localStorage.getItem(TOGGLES_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    var out = {};
    TOGGLE_KEYS.forEach(function(k) { if (parsed[k]) out[k] = true; });
    return out;
  } catch (e) { return {}; }
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

// v2.4.15-polish iter-4 . loadState now accepts BOTH the legacy
// single-string-per-dim shape (pre-iter-4 sessions) and the new
// array-per-dim shape. Coerces strings to single-element arrays so
// users on a stored older snapshot don't lose their active filters
// after an upgrade.
function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    var out = {};
    DIMS.forEach(function(dim) {
      var v = parsed[dim];
      if (Array.isArray(v)) {
        var arr = v.filter(function(x) { return typeof x === "string" && x.length > 0; });
        if (arr.length > 0) out[dim] = arr;
      } else if (typeof v === "string" && v.length > 0) {
        out[dim] = [v];
      }
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
