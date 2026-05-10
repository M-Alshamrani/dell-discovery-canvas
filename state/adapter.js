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
// rc.7 / 7e-2 · v3-pure adapter completion per SPEC §S40 — full
// instance + gap write surface (no v2 dual-running). MatrixView /
// GapsEditView / desiredStateSync consume these in 7e-3..7e-4.
import {
  addInstance,
  updateInstance,
  removeInstance,
  linkOrigin,
  mapWorkloadAssets,
  applyAiInstanceMutation
} from "./collections/instanceActions.js";
import {
  addGap,
  updateGap,
  removeGap,
  attachInstances
} from "./collections/gapActions.js";
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
// rc.7 R8 #4 (v3-invariant-enforcement arc · 2026-05-09) · phase-conflict
// pure read-only check used by _gapLinkInstance to enforce L8 / P6
// (RULES.md §5 L8 + §3 P6): linkDesiredInstance MUST refuse the link
// with PHASE_CONFLICT_NEEDS_ACK when gap.phase != desired.priority and
// opts.acknowledged !== true. Preserves the v2.4.12 footgun-killer at
// the v3 helper layer so AI write-paths can't bypass the confirm.
import { confirmPhaseOnLink } from "./dispositionLogic.js";

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

// rc.8.b / R7 (per SPEC §S46.10/§S46.11 + CH36.h + CH34) - AI-mutation
// commit helper. Routes through commitAction so the Canvas Chat layer
// (which is forbidden from importing state/collections/* per CH2) can
// dispatch AI mutations via this adapter helper. Stamps aiTag on the
// mutated instance; downstream subscribers re-render including the
// MatrixView "Done by AI" badge.
export function commitAiInstanceMutation(instanceId, patch, runMeta) {
  return commitAction(applyAiInstanceMutation, instanceId, patch, runMeta);
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

// ─── rc.7 / 7e-2 · v3-pure instance + gap write surface ──────────────────────
// Per SPEC §S40 — these helpers replace the v2 interactions/matrixCommands.js
// and interactions/gapsCommands.js surfaces entirely. MatrixView (7e-3),
// GapsEditView + desiredStateSync (7e-4), and AI machinery (7e-5) consume
// them. NO catalog-ref-keyed cutover variants — v3-pure mode keys all
// writes by UUID. Callers (views) own UUID resolution at click time.

// Instance writes ---------------------------------------------------------
export function commitInstanceAdd(input) {
  return commitAction(addInstance, input);
}

export function commitInstanceUpdate(instanceId, patch) {
  return commitAction(updateInstance, instanceId, patch);
}

export function commitInstanceRemove(instanceId) {
  return commitAction(removeInstance, instanceId);
}

// Convenience wrappers for the matrix UI's frequent single-field edits.
// All three route through commitInstanceUpdate; named helpers exist so
// the view call-sites read intentionally (and so V-FLOW vectors can
// source-grep for the specific helper).
export function commitInstanceSetCriticality(instanceId, criticality) {
  return commitAction(updateInstance, instanceId, { criticality });
}

export function commitInstanceSetDisposition(instanceId, disposition) {
  return commitAction(updateInstance, instanceId, { disposition });
}

export function commitInstanceSetPriority(instanceId, priority) {
  // priority is desired-only per InstanceSchema superRefine; null clears.
  return commitAction(updateInstance, instanceId, { priority });
}

export function commitInstanceSetNotes(instanceId, notes) {
  return commitAction(updateInstance, instanceId, { notes });
}

export function commitInstanceSetVendor(instanceId, vendor, vendorGroup) {
  return commitAction(updateInstance, instanceId, { vendor, vendorGroup });
}

// Cross-cutting linkage. originId on a desired instance points at a
// current instance; linkOrigin handles the cross-env case.
export function commitInstanceSetOrigin(desiredInstanceId, currentInstanceId) {
  return commitAction(linkOrigin, desiredInstanceId, currentInstanceId);
}

// Workload mappedAssetIds (Tab 4). Only valid on layerId==='workload'
// per InstanceSchema superRefine; the action enforces the invariant
// at commit time.
export function commitWorkloadMap(workloadInstanceId, assetInstanceIds) {
  return commitAction(mapWorkloadAssets, workloadInstanceId, assetInstanceIds);
}

// Gap writes --------------------------------------------------------------
export function commitGapAdd(input) {
  return commitAction(addGap, input);
}

export function commitGapUpdate(gapId, patch) {
  return commitAction(updateGap, gapId, patch);
}

export function commitGapRemove(gapId) {
  return commitAction(removeGap, gapId);
}

// Cross-cutting gap linkage. The gap stores arrays of instance UUIDs;
// the link/unlink helpers fetch the current arrays, apply the change,
// and commit the next arrays through attachInstances. Idempotent.
//
// rc.7 R8 #4 (v3-invariant-enforcement arc · 2026-05-09) · L8 / P6
// phase-conflict-acknowledgment gate is enforced HERE (when side ===
// "desired"). Pre-fix the helper ignored opts entirely; UI was the
// only safety-net (caller-layer enforcement). v3 AI write-paths could
// silently link a desired tile to a phase-mismatched gap, leaving the
// tile's priority and the gap's phase out of sync until the user
// noticed. Now atomic: opts.acknowledged !== true + conflict → refuse
// with PHASE_CONFLICT_NEEDS_ACK + the conflict details so the caller
// can surface a confirmation modal. Idempotent (already-linked is a
// no-op pre-gate so it doesn't trip on re-link).
function _gapLinkInstance(gapId, instanceId, side, opts) {
  // side: "current" or "desired"; opts: { acknowledged?: bool } (desired only)
  const eng = getActiveEngagement();
  if (!eng || !eng.gaps || !eng.gaps.byId) {
    return { ok: false, error: "no active engagement" };
  }
  const gap = eng.gaps.byId[gapId];
  if (!gap) {
    return { ok: false, error: "gap '" + gapId + "' not found" };
  }
  const field = side === "desired" ? "relatedDesiredInstanceIds" : "relatedCurrentInstanceIds";
  const cur = Array.isArray(gap[field]) ? gap[field] : [];
  if (cur.indexOf(instanceId) >= 0) return { ok: true, engagement: eng };  // already linked (idempotent)

  // R8 #4 / L8 / P6 · phase-conflict gate (desired side only)
  if (side === "desired") {
    const acknowledged = !!(opts && opts.acknowledged === true);
    const check = confirmPhaseOnLink(eng, gapId, instanceId);
    if (check && check.status === "conflict" && !acknowledged) {
      return {
        ok: false,
        errors: [{
          path: "acknowledged",
          message: "Linking '" + check.desiredLabel + "' to a gap in phase '" +
                   check.gapPhase + "' would reassign the tile's priority from '" +
                   check.currentPriority + "' to '" + check.targetPriority +
                   "'. Pass { acknowledged: true } to confirm.",
          code: "PHASE_CONFLICT_NEEDS_ACK",
          details: {
            currentPriority: check.currentPriority,
            targetPriority:  check.targetPriority,
            gapPhase:        check.gapPhase,
            desiredLabel:    check.desiredLabel
          }
        }]
      };
    }
  }

  const next = cur.concat([instanceId]);
  const patch = side === "desired"
    ? { relatedDesiredInstanceIds: next }
    : { relatedCurrentInstanceIds: next };
  return commitAction(updateGap, gapId, patch);
}

function _gapUnlinkInstance(gapId, instanceId, side) {
  const eng = getActiveEngagement();
  if (!eng || !eng.gaps || !eng.gaps.byId) {
    return { ok: false, error: "no active engagement" };
  }
  const gap = eng.gaps.byId[gapId];
  if (!gap) {
    return { ok: false, error: "gap '" + gapId + "' not found" };
  }
  const field = side === "desired" ? "relatedDesiredInstanceIds" : "relatedCurrentInstanceIds";
  const cur = Array.isArray(gap[field]) ? gap[field] : [];
  const next = cur.filter(id => id !== instanceId);
  if (next.length === cur.length) return { ok: true, engagement: eng };  // no-op
  const patch = side === "desired"
    ? { relatedDesiredInstanceIds: next }
    : { relatedCurrentInstanceIds: next };
  return commitAction(updateGap, gapId, patch);
}

export function commitGapLinkCurrentInstance(gapId, instanceId) {
  return _gapLinkInstance(gapId, instanceId, "current");
}
// rc.7 R8 #4 · opts.acknowledged is the L8 / P6 phase-conflict opt-in.
// When the caller has already confirmed with the user (or when the
// caller is sure no conflict exists) it passes { acknowledged: true }.
// Otherwise the helper refuses the link with PHASE_CONFLICT_NEEDS_ACK
// when there's a conflict, so AI write-paths can't bypass the modal.
export function commitGapLinkDesiredInstance(gapId, instanceId, opts) {
  return _gapLinkInstance(gapId, instanceId, "desired", opts);
}
export function commitGapUnlinkCurrentInstance(gapId, instanceId) {
  return _gapUnlinkInstance(gapId, instanceId, "current");
}
export function commitGapUnlinkDesiredInstance(gapId, instanceId) {
  return _gapUnlinkInstance(gapId, instanceId, "desired");
}

export function commitGapSetDriver(gapId, driverId) {
  // driverId is the v3 driver UUID (or null to clear). View call-sites
  // that hold the v2-style businessDriverId resolve via
  // commitGapSetDriverByBusinessDriverId below.
  return commitAction(updateGap, gapId, { driverId });
}

export function commitGapAttachInstances(gapId, { current = [], desired = [] }) {
  return commitAction(attachInstances, gapId, { current, desired });
}

// Convenience for views that hold the v2-style businessDriverId
// (e.g. "cyber_resilience") rather than the v3 driver UUID. This
// wrapper retires alongside the rest of the *ByBusinessDriverId
// helpers at 7e-8 (per SPEC §S40 deletion-readiness checklist).
export function commitGapSetDriverByBusinessDriverId(gapId, businessDriverId) {
  if (businessDriverId === null || businessDriverId === undefined) {
    return commitAction(updateGap, gapId, { driverId: null });
  }
  const eng = getActiveEngagement();
  if (!eng || !eng.drivers || !Array.isArray(eng.drivers.allIds)) {
    return { ok: false, error: "no active engagement" };
  }
  for (const id of eng.drivers.allIds) {
    const d = eng.drivers.byId[id];
    if (d && d.businessDriverId === businessDriverId) {
      return commitAction(updateGap, gapId, { driverId: d.id });
    }
  }
  return { ok: false, error: "no v3 driver with businessDriverId='" + businessDriverId + "'" };
}

// AI proposal application -----------------------------------------------
// commitProposeAndApply replaces interactions/aiCommands.js's
// applyProposal + applyAllProposals v2 dispatch (which mutated session
// in place via setPathFromRoot / WRITE_RESOLVERS). The v3-pure version
// takes an array of `{path, after}` proposals and applies them as a
// single transactional engagement update — one commitAction call,
// one setActiveEngagement, one emit, one undo entry.
//
// Path → action resolution lives in core/bindingResolvers.js
// WRITE_RESOLVERS (rewritten in 7e-5 to dispatch via this helper).
// The signature here is intentionally narrow: it accepts a function
// that takes the engagement and returns the next engagement (or
// {ok, engagement, errors}). Callers compose path-specific actions
// into that function.
export function commitProposeAndApply(actionFn, ...args) {
  return commitAction(actionFn, ...args);
}
