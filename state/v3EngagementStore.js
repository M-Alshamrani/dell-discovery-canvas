// state/v3EngagementStore.js
//
// SPEC §S19.3 · active-engagement source-of-truth for v3.0.
// Single in-memory engagement object + pub/sub. Co-exists with v2.x
// state/sessionState.js during the adapter migration window (S19.3).
// Once Reporting (Tab 6) lands GREEN, sessionState is dead code from
// a runtime perspective but is NOT deleted (rollback anchor + v2.x
// AI admin still reads it per project_v2x_admin_deferred.md).
//
// Status: STUB v3.0.0-rc.1. setActiveEngagement / getActiveEngagement /
// subscribeActiveEngagement are functional minimums so V-ADP-9 round-trip
// chains compile and run. commitAction is intentionally a no-op so the
// V-ADP-9 mutation assertion fails RED until impl lands.
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
  // Notify subscribers on every set (mirrors final commit-emit contract).
  _subs.forEach(fn => { try { fn(_active); } catch (_e) { /* swallow per S14 boundary */ } });
}

export function subscribeActiveEngagement(fn) {
  _subs.add(fn);
  return function unsubscribe() { _subs.delete(fn); };
}

// commitAction(actionFn, ...args)
// STUB: in the real implementation, this wraps a §S4 action function
// (e.g. updateCustomer), runs it against _active, replaces _active with
// the new immutable engagement, and emits to subscribers. For RED-first,
// the stub does NOTHING so V-ADP-9 fails with a real engagement-unchanged
// assertion until impl lands.
export function commitAction(_actionFn, ..._args) {
  /* stub: intentional no-op for RED-first */
}

// _resetForTests · used between describe blocks to avoid pollution.
// Mirrors core/skillsEvents.js._resetForTests pattern.
export function _resetForTests() {
  _active = null;
  _subs.clear();
}
