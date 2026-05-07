// state/engagementStore.js
//
// SPEC §S19.3 + §S31 · active-engagement source-of-truth for v3.0.
// Single in-memory engagement object + pub/sub + localStorage
// persistence with rehydrate-on-boot.
//
// Co-exists with v2.x state/sessionState.js during the adapter
// migration window (S19.3). Once Reporting (Tab 6) lands GREEN,
// sessionState is dead code from a runtime perspective but is NOT
// deleted (rollback anchor + v2.x AI admin still reads it per
// project_v2x_admin_deferred.md).
//
// **Persistence (§S31)** — fix for BUG-019 (page-reload race where v2
// rehydrated but v3 stayed null → AI saw "empty canvas" against a
// populated UI):
//   - Every state change persists to localStorage.v3_engagement_v1.
//   - Module load rehydrates from that key, validating through
//     EngagementSchema.safeParse(...). Failure → wipe + log + start
//     fresh (corrupt-cache safety).
//   - The bridge's existing customer-shallow-merge keeps working: the
//     rehydrated engagement comes back, the latest v2 customer patch
//     applies on top, gaps/drivers/etc. survive across reload.
//
// Forbidden (R19.5 + F19.5.5):
//   - exposing the engagement by deep reference for write
//   - mutating engagement state outside §S4 action functions
//   - persisting transient computed state (selector caches, view-models)
//   - any module other than engagementStore reading or writing the
//     v3_engagement_v1 localStorage key
//
// Authority: docs/v3.0/SPEC.md §S19.3 + §S31 · docs/RULES.md §15 + §16 CH27.

import { EngagementSchema } from "../schema/engagement.js";
// rc.7 / 7e-8d-3 · the v2 sessionBridge is RETIRED. Pre-deletion the
// bridge subscribed to subscribeActiveEngagement and re-emitted
// session-changed("v3-mirror") so legacy onSessionChanged listeners
// (app.js's tab re-render handler, the V-FLOW-* tests, env-hide UX
// flows) saw the change. With the bridge gone, engagementStore must
// emit session-changed itself on every commit so those listeners
// continue to fire. Single source of truth for "engagement changed":
// engagementStore._emit() pulses BOTH local subscribers AND the
// session-changed bus.
import { emitSessionChanged } from "../core/sessionEvents.js";

const STORAGE_KEY = "v3_engagement_v1";

let _active = null;
const _subs = new Set();

// Module-load rehydrate (§S31 R31.2). Best-effort; corrupt cache wipes
// + starts fresh so a single bad localStorage entry can never brick boot.
_rehydrateFromStorage();

export function getActiveEngagement() {
  return _active;
}

export function setActiveEngagement(eng) {
  _active = eng;
  _persist();
  _emit();
}

export function subscribeActiveEngagement(fn) {
  _subs.add(fn);
  return function unsubscribe() { _subs.delete(fn); };
}

function _emit() {
  _subs.forEach(fn => {
    try { fn(_active); }
    catch (e) { console.error("[engagementStore] subscriber threw:", e); }
  });
  // rc.7 / 7e-8d-3 · also fire the legacy session-changed bus for
  // backward-compat with onSessionChanged listeners (app.js tab re-
  // render, env-hide test SD5 + V-FLOW-* listeners). The "v3-commit"
  // reason is the v3-pure successor to the bridge's "v3-mirror"
  // reason; the regex SD5/SD6/etc. use (/hide|env|v3-mirror|v3-commit/)
  // covers both. Wrapped in try/catch so a failing subscriber never
  // breaks the engagementStore commit pipeline.
  try { emitSessionChanged("v3-commit", "engagement updated"); }
  catch (e) { console.error("[engagementStore] emitSessionChanged threw:", e); }
}

// _persist · write the active engagement to localStorage. Wrapped in
// try/catch (§S31 R31.3) so quota-exceeded / disabled-storage failures
// degrade silently to in-memory-only — chat keeps working, only the
// rehydrate-after-reload promise is lost.
function _persist() {
  try {
    if (_active === null || _active === undefined) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_e) { /* ignore */ }
      return;
    }
    const json = JSON.stringify(_active);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    // Quota-exceeded / private-mode / disabled-storage. Log once and
    // continue — the in-memory state is still authoritative for this
    // session.
    console.warn("[engagementStore] _persist failed:", e && e.message || e);
  }
}

// _rehydrateFromStorage · read + parse + validate + install.
// Returns true on success, false on miss / malformed / schema-invalid.
// Exported with the underscore-prefix internal naming so V-FLOW-
// REHYDRATE tests can drive it explicitly. Production code should NOT
// call this; the module-load self-call covers the boot path.
export function _rehydrateFromStorage() {
  let raw;
  try { raw = localStorage.getItem(STORAGE_KEY); }
  catch (e) {
    console.warn("[engagementStore] _rehydrateFromStorage: localStorage.getItem failed:", e && e.message || e);
    return false;
  }
  if (raw === null || raw === undefined || raw === "") return false;

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) {
    console.warn("[engagementStore] rehydrate: malformed JSON; wiping cache and starting fresh");
    try { localStorage.removeItem(STORAGE_KEY); } catch (_e) { /* ignore */ }
    return false;
  }

  const result = EngagementSchema.safeParse(parsed);
  if (!result.success) {
    console.warn("[engagementStore] rehydrate: schema-invalid; wiping cache and starting fresh");
    try { localStorage.removeItem(STORAGE_KEY); } catch (_e) { /* ignore */ }
    return false;
  }

  _active = result.data;
  // Don't emit on rehydrate — subscribers haven't subscribed yet at
  // module load, and a synthetic emit would be misleading anyway. The
  // first real emit will be the first user action (or the bridge's
  // customer-merge after session-changed).
  return true;
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
  _persist();
  _emit();
  return result;
}

// _resetForTests · used between describe blocks to avoid pollution.
// Mirrors core/skillsEvents.js._resetForTests pattern.
//
// Default behavior (no arg) clears BOTH in-memory state AND the
// persisted localStorage entry — required for cross-describe-block
// isolation (§S31 R31.4).
//
// _resetForTests({ keepStorage: true }) clears only in-memory state,
// preserving localStorage so V-FLOW-REHYDRATE-1 can simulate a page
// reload (drop in-memory, then call _rehydrateFromStorage explicitly).
export function _resetForTests(opts) {
  _active = null;
  _subs.clear();
  if (!opts || !opts.keepStorage) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_e) { /* ignore */ }
  }
}
