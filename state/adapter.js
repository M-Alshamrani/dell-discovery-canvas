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
import { commitAction }        from "./engagementStore.js";
import { updateCustomer }      from "./collections/customerActions.js";
import {
  updateInstance,
  mapWorkloadAssets
} from "./collections/instanceActions.js";
import { updateGap } from "./collections/gapActions.js";

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
