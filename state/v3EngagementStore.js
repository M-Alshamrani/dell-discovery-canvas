// state/v3EngagementStore.js
//
// SPEC §S19.3 · active-engagement source-of-truth for v3.0.
// Single in-memory engagement object + pub/sub. Co-exists with v2.x
// state/sessionState.js during the adapter migration window (S19.3).
// Once Reporting (Tab 6) lands GREEN, sessionState is dead code from a
// runtime perspective but is NOT deleted (rollback anchor + v2.x AI
// admin still reads it per project_v2x_admin_deferred.md).
//
// Forbidden (R19.5, F19.5.5):
//   - exposing the engagement by deep reference for write
//   - mutating engagement state outside §S4 action functions
//
// Authority: docs/v3.0/SPEC.md §S19.3 · docs/RULES.md §15.

let _active = null;
const _subs = new Set();

export function getActiveEngagement() {
  return _active;
}

export function setActiveEngagement(eng) {
  _active = eng;
  _emit();
}

export function subscribeActiveEngagement(fn) {
  _subs.add(fn);
  return function unsubscribe() { _subs.delete(fn); };
}

function _emit() {
  _subs.forEach(fn => {
    try { fn(_active); }
    catch (e) { console.error("[v3EngagementStore] subscriber threw:", e); }
  });
}

// commitAction(actionFn, ...args)
// Wraps a §S4 action function. The action runs against the active
// engagement, returns { ok, engagement, errors? }; on success the
// store swaps to the new immutable engagement and emits to subs.
// On validation failure, the active engagement is unchanged and
// no emit fires; the caller receives the result and surfaces errors.
export function commitAction(actionFn, ...args) {
  if (!_active) {
    throw new Error("commitAction: no active engagement; call setActiveEngagement first");
  }
  const result = actionFn(_active, ...args);
  if (result && result.ok === false) {
    return result;
  }
  const next = (result && result.engagement) ? result.engagement : result;
  if (next === _active) return result;
  _active = next;
  _emit();
  return result;
}

// _resetForTests · used between describe blocks to avoid pollution.
// Mirrors core/skillsEvents.js._resetForTests pattern.
export function _resetForTests() {
  _active = null;
  _subs.clear();
}
