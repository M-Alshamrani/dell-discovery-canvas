// interactions/matrixCommands.js -- ONLY place that mutates session.instances

import { validateInstance } from "../core/models.js";

function uid() { return "inst-" + Math.random().toString(36).slice(2, 9); }

export function addInstance(session, props) {
  // Criticality default: new current instances default to "Low" (SPEC §2.2 + Phase 4).
  // Desired instances never get a criticality default (they use priority instead).
  var defaultCriticality = (props.state === "current" && !props.criticality) ? "Low" : undefined;

  var inst = {
    id:              props.id              || uid(),
    state:           props.state,
    layerId:         props.layerId,
    environmentId:   props.environmentId,
    label:           props.label,
    vendor:          props.vendor          || "",
    vendorGroup:     props.vendorGroup     || "custom",
    criticality:     props.criticality     || defaultCriticality,
    priority:        props.priority        || undefined,
    timeline:        props.timeline        || undefined,
    notes:           props.notes           || "",
    originId:        props.originId        || undefined,
    disposition:     props.disposition     || undefined,
    // v2.3.1 / Phase 16 — only defined when the caller passes it (typically
    // workload-layer instances). validateInstance enforces the layer rule.
    mappedAssetIds:  props.mappedAssetIds  || undefined
  };
  // Remove undefined keys for cleanliness
  Object.keys(inst).forEach(function(k) { if (inst[k] === undefined) delete inst[k]; });
  validateInstance(inst);
  (session.instances = session.instances || []).push(inst);
  return inst;
}

export function updateInstance(session, instanceId, patch) {
  var list = session.instances || [];
  var idx  = list.findIndex(function(i) { return i.id === instanceId; });
  if (idx === -1) throw new Error("Instance '" + instanceId + "' not found");
  var updated = Object.assign({}, list[idx], patch);
  // Remove undefined keys
  Object.keys(updated).forEach(function(k) { if (updated[k] === undefined) delete updated[k]; });
  validateInstance(updated);
  list[idx] = updated;
  return updated;
}

export function deleteInstance(session, instanceId) {
  var list = session.instances || [];
  var idx  = list.findIndex(function(i) { return i.id === instanceId; });
  if (idx === -1) throw new Error("Instance '" + instanceId + "' not found");
  list.splice(idx, 1);
}

export function moveInstance(session, instanceId, move) {
  var patch = {};
  if (move && move.newLayerId)       patch.layerId       = move.newLayerId;
  if (move && move.newEnvironmentId) patch.environmentId = move.newEnvironmentId;
  if (move && move.newState)         patch.state         = move.newState;
  return updateInstance(session, instanceId, patch);
}

// ── v2.3.1 / Phase 16 · Workload Mapping ───────────────────────────────
// A workload instance (layerId === "workload") may map (N-to-N) to any
// number of asset instances on the other five layers. Mapping is a
// property of the workload (workload.mappedAssetIds[]); assets carry no
// back-reference (cleaner cascade behaviour, same model as gap-link).

function findInstance(session, id, label) {
  var inst = (session.instances || []).find(function(i) { return i.id === id; });
  if (!inst) throw new Error(label + ": instance '" + id + "' not found");
  return inst;
}

export function mapAsset(session, workloadId, assetId) {
  if (workloadId === assetId) throw new Error("mapAsset: a workload cannot map to itself");
  var workload = findInstance(session, workloadId, "mapAsset");
  var asset    = findInstance(session, assetId,    "mapAsset");
  if (workload.layerId !== "workload") {
    throw new Error("mapAsset: source '" + workload.label + "' is not a workload-layer instance");
  }
  if (asset.layerId === "workload") {
    throw new Error("mapAsset: target '" + asset.label + "' is also a workload — workloads only map to infrastructure layers");
  }
  if (asset.state !== workload.state) {
    throw new Error("mapAsset: state mismatch — " + workload.state + " workload cannot map a " + asset.state + " asset");
  }
  // v2.3.1 — same-environment requirement: a workload instance lives in a
  // specific environment; its mapped infrastructure must run there too.
  // Hybrid workloads (e.g. coreDc + publicCloud) are modelled by creating
  // one workload tile per environment, each mapping to the local stack.
  if (asset.environmentId !== workload.environmentId) {
    throw new Error("mapAsset: environment mismatch — workload is in " +
      workload.environmentId + ", asset is in " + asset.environmentId +
      ". Create a separate workload tile in '" + asset.environmentId +
      "' to model hybrid deployments.");
  }
  workload.mappedAssetIds = workload.mappedAssetIds || [];
  if (workload.mappedAssetIds.indexOf(assetId) < 0) workload.mappedAssetIds.push(assetId);
  validateInstance(workload);
  return workload;
}

export function unmapAsset(session, workloadId, assetId) {
  var workload = findInstance(session, workloadId, "unmapAsset");
  workload.mappedAssetIds = (workload.mappedAssetIds || []).filter(function(id) { return id !== assetId; });
  validateInstance(workload);
  return workload;
}

// Returns the proposed criticality upgrades for assets mapped to this
// workload. Pure / non-mutating — the caller decides which proposals to
// apply (typically via per-asset confirm in the UI, then updateInstance).
//
// Upward-only by design: an asset whose criticality already meets or
// exceeds the workload's is left alone. Per CHANGELOG_PLAN § Item 3.
export function proposeCriticalityUpgrades(session, workloadId) {
  var CRIT_RANK = { Low: 1, Medium: 2, High: 3 };
  var workload = findInstance(session, workloadId, "proposeCriticalityUpgrades");
  if (workload.layerId !== "workload") {
    throw new Error("proposeCriticalityUpgrades: '" + workload.label + "' is not a workload-layer instance");
  }
  var workloadRank = CRIT_RANK[workload.criticality] || 0;
  if (!workloadRank) return []; // workload has no criticality set yet

  var proposals = [];
  (workload.mappedAssetIds || []).forEach(function(assetId) {
    var asset = (session.instances || []).find(function(i) { return i.id === assetId; });
    if (!asset) return; // tolerate dangling refs without throwing
    var assetRank = CRIT_RANK[asset.criticality] || 0;
    if (assetRank < workloadRank) {
      proposals.push({
        assetId:        asset.id,
        label:          asset.label,
        layerId:        asset.layerId,
        currentCrit:    asset.criticality || null,
        newCrit:        workload.criticality
      });
    }
  });
  return proposals;
}
