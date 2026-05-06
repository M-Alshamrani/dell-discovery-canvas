// state/adapter.js
//
// SPEC §S19 · v3.0 → v2.x consumption adapter.
// SPEC-only annex (not in data-architecture-directive.md). The five
// existing v2.x view tabs (Context · Architecture · Heatmap · Workload
// Mapping · Gaps · Reporting) read v3.0 engagement data through this
// thin module instead of state/sessionState.js. The v3.0 Lab tab reads
// engagementStore directly; it is not part of the adapter migration
// window (R19.10).
//
// Read selectors are pure + memoized on engagement reference (R19.5).
// Where a §S5 selector already returns the right shape (matrix), we
// delegate verbatim so the §S5 memoization is inherited (F19.5.4).
// Where the v2.x view shape differs (context, workload, gaps,
// reporting), we use memoize-one keyed on engagement reference — the
// same pattern §S5 selectors use.
//
// Write helpers all route through commitAction(actionFn, ...) so writes
// land via §S4 action functions on the engagementStore. No raw mutation
// (R19.4 + F19.5.2).
//
// Forbidden (R19.6, R19.2, R19.7, F19.5.x):
//   - importing state/sessionState.js
//   - mutating engagement objects directly
//   - per-call hashmap caches outside the project-blessed memoize-one
//
// Authority: docs/v3.0/SPEC.md §S19 · docs/v3.0/TESTS.md §T19 V-ADP-* ·
//            docs/RULES.md §15.

import { memoizeOne } from "../services/memoizeOne.js";
import { selectMatrixView }    from "../selectors/matrix.js";
import { selectHealthSummary } from "../selectors/healthSummary.js";
import { commitAction, getActiveEngagement } from "./engagementStore.js";
import { updateCustomer }      from "./collections/customerActions.js";
import {
  updateInstance,
  mapWorkloadAssets
} from "./collections/instanceActions.js";
import { updateGap } from "./collections/gapActions.js";
// rc.7 / 7b · Tab 1 Context migration · driver write helpers per
// SPEC §S19.3.1 cutover-window bidirectional sync. ContextView
// consumes these helpers in rc.7 / 7c.
import {
  addDriver,
  updateDriver,
  removeDriver
} from "./collections/driverActions.js";
// rc.7 / 7d · Tab 1 Context migration · environment write helpers per
// SPEC §S19.3.1 cutover-window bidirectional sync. ContextView
// consumes these helpers in rc.7 / 7d-2.
import {
  addEnvironment,
  updateEnvironment,
  hideEnvironment,
  unhideEnvironment,
  removeEnvironment
} from "./collections/environmentActions.js";

// ─── view-shape selectors (R19.1 read side) ──────────────────────────────────

function _computeContext(eng) {
  return {
    customer: eng.customer,
    drivers: eng.drivers.allIds.map(id => eng.drivers.byId[id])
  };
}
const _adaptContextViewMemo = memoizeOne(
  _computeContext,
  ([engA], [engB]) => engA === engB
);
export function adaptContextView(eng) {
  if (!eng) return null;
  return _adaptContextViewMemo(eng);
}

// Architecture + Heatmap delegate to selectMatrixView (already memoized
// on engagement reference per §S5.2.1). Heatmap shares the matrix shape
// in v3.0 (the v2.x heatmap derives further from this same data).
export function adaptArchitectureView(eng) {
  if (!eng) return null;
  return selectMatrixView(eng, { state: "current" });
}
export function adaptHeatmapView(eng) {
  if (!eng) return null;
  return selectMatrixView(eng, { state: "current" });
}

function _computeWorkload(eng) {
  const workloads = eng.instances.allIds
    .map(id => eng.instances.byId[id])
    .filter(inst => inst.layerId === "workload" && inst.state === "current")
    .map(wl => ({
      ...wl,
      mappedAssets: (wl.mappedAssetIds || [])
        .map(aid => eng.instances.byId[aid])
        .filter(Boolean)
    }));
  return { workloads };
}
const _adaptWorkloadViewMemo = memoizeOne(
  _computeWorkload,
  ([a], [b]) => a === b
);
export function adaptWorkloadView(eng) {
  if (!eng) return null;
  return _adaptWorkloadViewMemo(eng);
}

function _computeGaps(eng) {
  return {
    gaps: eng.gaps.allIds.map(id => eng.gaps.byId[id])
  };
}
const _adaptGapsViewMemo = memoizeOne(
  _computeGaps,
  ([a], [b]) => a === b
);
export function adaptGapsView(eng) {
  if (!eng) return null;
  return _adaptGapsViewMemo(eng);
}

function _computeReporting(eng) {
  const health = selectHealthSummary(eng);
  const openGaps = eng.gaps.allIds
    .map(id => eng.gaps.byId[id])
    .filter(g => g.status === "open").length;
  return {
    totals: {
      gapsOpen: openGaps
    },
    health
  };
}
const _adaptReportingViewMemo = memoizeOne(
  _computeReporting,
  ([a], [b]) => a === b
);
export function adaptReportingView(eng) {
  if (!eng) return null;
  return _adaptReportingViewMemo(eng);
}

// ─── write-through helpers (R19.1 write side, R19.4) ─────────────────────────

export function commitContextEdit(patch) {
  if (patch && patch.customer) {
    return commitAction(updateCustomer, patch.customer);
  }
  return null;
}

// rc.7 / 7b · Tab 1 Context migration · driver write helpers.
//
// Per SPEC §S19.3.1 cutover-window bidirectional sync: writes go v3-first
// through commitAction → engagementStore. The sessionBridge.js v3→v2
// mirror (added in rc.7 / 7c) keeps v2 session.drivers in sync for any
// non-migrated v2.x view that still reads it.
//
// Authority: SPEC §S19.1 (R19.1 write helpers) + §S19.3.1 (cutover sync).

export function commitDriverAdd(input) {
  return commitAction(addDriver, input);
}

export function commitDriverUpdate(driverId, patch) {
  return commitAction(updateDriver, driverId, patch);
}

export function commitDriverRemove(driverId) {
  return commitAction(removeDriver, driverId);
}

// rc.7 / 7c · cutover-window helpers — v2 ContextView holds drivers in
// an array keyed by `id = businessDriverId` (the catalog reference,
// e.g. "cyber_resilience"). v3 driver records key by UUID. These
// "*ByBusinessDriverId" helpers do the catalog-ref → UUID lookup
// internally so the ContextView call site can stay readable + keep its
// existing `d.id` references during migration. They retire once
// ContextView reads from `adaptContextView(...)` and consumes the v3
// driver shape natively (likely rc.7 / 7d or later).

function _findDriverByBusinessDriverId(businessDriverId) {
  const eng = getActiveEngagement();
  if (!eng || !eng.drivers || !Array.isArray(eng.drivers.allIds)) return null;
  for (const id of eng.drivers.allIds) {
    const d = eng.drivers.byId[id];
    if (d && d.businessDriverId === businessDriverId) return d;
  }
  return null;
}

export function commitDriverUpdateByBusinessDriverId(businessDriverId, patch) {
  const d = _findDriverByBusinessDriverId(businessDriverId);
  if (!d) {
    return { ok: false, error: "no v3 driver with businessDriverId='" + businessDriverId + "'" };
  }
  return commitAction(updateDriver, d.id, patch);
}

export function commitDriverRemoveByBusinessDriverId(businessDriverId) {
  const d = _findDriverByBusinessDriverId(businessDriverId);
  if (!d) {
    return { ok: false, error: "no v3 driver with businessDriverId='" + businessDriverId + "'" };
  }
  return commitAction(removeDriver, d.id);
}

export function commitInstanceEdit(_layerId, _envId, instancePatch) {
  if (!instancePatch || !instancePatch.id) {
    throw new Error("commitInstanceEdit: instancePatch.id required");
  }
  const { id, ...patch } = instancePatch;
  return commitAction(updateInstance, id, patch);
}

export function commitWorkloadMapping(workloadId, mappedAssetIds) {
  return commitAction(mapWorkloadAssets, workloadId, mappedAssetIds);
}

export function commitGapEdit(gapId, patch) {
  return commitAction(updateGap, gapId, patch);
}

// rc.7 / 7d · Tab 1 Context migration · environment write helpers.
//
// Per SPEC §S19.3.1 cutover-window bidirectional sync: writes go v3-first
// through commitAction → engagementStore. The sessionBridge.js v3→v2
// environment mirror (added in rc.7 / 7d-2) keeps v2 session.environments
// in sync for any non-migrated v2.x view that still reads it.
//
// Authority: SPEC §S19.1 (R19.1 write helpers) + §S19.3.1 (cutover sync).

export function commitEnvAdd(input) {
  return commitAction(addEnvironment, input);
}

export function commitEnvUpdate(envId, patch) {
  return commitAction(updateEnvironment, envId, patch);
}

export function commitEnvHide(envId) {
  return commitAction(hideEnvironment, envId);
}

export function commitEnvUnhide(envId) {
  return commitAction(unhideEnvironment, envId);
}

export function commitEnvRemove(envId) {
  return commitAction(removeEnvironment, envId);
}

// rc.7 / 7d · cutover-window helpers — v2 ContextView holds environments
// in an array keyed by `id = envCatalogId` (the catalog reference, e.g.
// "coreDc"). v3 environment records key by UUID. These "*ByCatalogId"
// helpers do the catalog-ref → UUID lookup internally so the ContextView
// call site can stay readable + keep its existing `e.id` references
// during migration. They retire once ContextView reads from the v3
// adaptContextView shape natively (post-rc.7 / 7d).

function _findEnvByCatalogId(envCatalogId) {
  const eng = getActiveEngagement();
  if (!eng || !eng.environments || !Array.isArray(eng.environments.allIds)) return null;
  for (const id of eng.environments.allIds) {
    const e = eng.environments.byId[id];
    if (e && e.envCatalogId === envCatalogId) return e;
  }
  return null;
}

export function commitEnvUpdateByCatalogId(envCatalogId, patch) {
  const e = _findEnvByCatalogId(envCatalogId);
  if (!e) {
    return { ok: false, error: "no v3 environment with envCatalogId='" + envCatalogId + "'" };
  }
  return commitAction(updateEnvironment, e.id, patch);
}

export function commitEnvHideByCatalogId(envCatalogId) {
  const e = _findEnvByCatalogId(envCatalogId);
  if (!e) {
    return { ok: false, error: "no v3 environment with envCatalogId='" + envCatalogId + "'" };
  }
  return commitAction(hideEnvironment, e.id);
}

export function commitEnvUnhideByCatalogId(envCatalogId) {
  const e = _findEnvByCatalogId(envCatalogId);
  if (!e) {
    return { ok: false, error: "no v3 environment with envCatalogId='" + envCatalogId + "'" };
  }
  return commitAction(unhideEnvironment, e.id);
}

export function commitEnvRemoveByCatalogId(envCatalogId) {
  const e = _findEnvByCatalogId(envCatalogId);
  if (!e) {
    return { ok: false, error: "no v3 environment with envCatalogId='" + envCatalogId + "'" };
  }
  return commitAction(removeEnvironment, e.id);
}
