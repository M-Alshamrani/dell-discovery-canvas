// state/collections/instanceActions.js — v3.0 · SPEC sec S4.1.2 + sec S4.1.1
//
// Instance actions also maintain the byState secondary index. Per
// SPEC sec S4.1.1: indexes are explicitly named and rebuilt by pure
// functions on mutation.

import { InstanceSchema, createEmptyInstance } from "../../schema/instance.js";

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// Rebuild the byState secondary index from byId.state. Pure helper.
function rebuildByState(byId, allIds) {
  const current = [];
  const desired = [];
  for (const id of allIds) {
    const inst = byId[id];
    if (inst.state === "current") current.push(id);
    else if (inst.state === "desired") desired.push(id);
  }
  return { current, desired };
}

export function addInstance(engagement, input) {
  const now = new Date().toISOString();
  const draft = createEmptyInstance({
    ...input,
    id:           newId(),
    engagementId: engagement.meta.engagementId,
    createdAt:    now,
    updatedAt:    now
  });
  const result = InstanceSchema.safeParse(draft);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(i => ({
        path: i.path.join("."), message: i.message, code: i.code
      }))
    };
  }
  const inst = result.data;
  const newById   = { ...engagement.instances.byId, [inst.id]: inst };
  const newAllIds = [...engagement.instances.allIds, inst.id];
  return {
    ok: true,
    engagement: {
      ...engagement,
      instances: {
        byId:    newById,
        allIds:  newAllIds,
        byState: rebuildByState(newById, newAllIds)
      },
      meta: { ...engagement.meta, updatedAt: now }
    }
  };
}

export function updateInstance(engagement, instanceId, patch) {
  const existing = engagement.instances.byId[instanceId];
  if (!existing) {
    return { ok: false, errors: [{ path: "instanceId", message: "Instance not found", code: "not_found" }] };
  }
  const now = new Date().toISOString();
  // rc.8.b / R7 (per SPEC §S46.11 / CH36.h auto-clear contract):
  // engineer save on an AI-tagged instance strips aiTag. Ownership
  // transfers from AI to engineer the moment they commit a change.
  // applyAiInstanceMutation below is the ONLY path that re-stamps aiTag.
  const merged = { ...existing, ...patch,
                   id: existing.id, engagementId: existing.engagementId,
                   createdAt: existing.createdAt, updatedAt: now,
                   aiTag: null };
  const result = InstanceSchema.safeParse(merged);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(i => ({
        path: i.path.join("."), message: i.message, code: i.code
      }))
    };
  }
  const newById = { ...engagement.instances.byId, [instanceId]: result.data };
  return {
    ok: true,
    engagement: {
      ...engagement,
      instances: {
        byId:    newById,
        allIds:  engagement.instances.allIds,
        byState: rebuildByState(newById, engagement.instances.allIds)
      },
      meta: { ...engagement.meta, updatedAt: now }
    }
  };
}

export function removeInstance(engagement, instanceId) {
  if (!engagement.instances.byId[instanceId]) return { ok: true, engagement };
  const { [instanceId]: _removed, ...remaining } = engagement.instances.byId;
  const newAllIds = engagement.instances.allIds.filter(id => id !== instanceId);
  const now = new Date().toISOString();
  return {
    ok: true,
    engagement: {
      ...engagement,
      instances: {
        byId:    remaining,
        allIds:  newAllIds,
        byState: rebuildByState(remaining, newAllIds)
      },
      meta: { ...engagement.meta, updatedAt: now }
    }
  };
}

// Convenience wrappers for the cross-cutting relationships per SPEC sec 3.7.
// linkOrigin sets desired.originId -> current id (cross-env supported).
export function linkOrigin(engagement, desiredInstanceId, currentInstanceId) {
  return updateInstance(engagement, desiredInstanceId, { originId: currentInstanceId });
}

// mapWorkloadAssets sets workload.mappedAssetIds, enforcing the workload-
// to-asset relationship invariants (R8 #2, rc.7 v3-invariant-enforcement
// arc · 2026-05-09). Pre-fix this was a thin updateInstance wrapper with
// NO enforcement: ANY caller (UI, AI write paths, integrations) could map
// a workload to itself, to another workload, to a cross-state/cross-env
// asset, or to an asset being retired (BUG-040). Now atomic in the helper
// per the v2.3.1 / Phase 16 contract preserved in HANDOFF "Open R8 backlog"
// item #2.
//
// Invariants enforced (all atomic; first violation aborts the commit):
//   I1 · workload.layerId === "workload" (only workload-layer instances
//        carry mappedAssetIds; other layers reject the call entirely)
//   I2 · dedupe assetIds (silent — duplicates collapse to a unique set;
//        order-preserving for the first occurrence)
//   I3 · asset must exist in engagement.instances.byId (no dangling refs)
//   I4 · workloadId NOT in the asset list (self-map forbidden — a workload
//        cannot be its own infrastructure)
//   I5 · asset.layerId !== "workload" (workload→workload forbidden;
//        workloads only map to infrastructure layers — compute / storage /
//        network / data-protection / virtualization / infrastructure)
//   I6 · asset.state === workload.state (current workload maps current
//        infra; desired workload maps desired infra; cross-state mapping
//        leaks lifecycle boundaries)
//   I7 · asset.environmentId === workload.environmentId (a workload lives
//        in one environment; its mapped infrastructure must run there too.
//        Hybrid workloads are modelled by creating one workload tile per
//        environment, each mapping to its local stack — same-env constraint
//        is the v2.3.1 contract preserved)
//   I8 · asset.disposition !== "retire" (BUG-040: workload cannot map to
//        an asset being retired — that creates dangling references when
//        the asset is removed; the user should map to the replacement
//        desired-state asset instead. If the user intends to track a
//        retiring dependency, they should NOT pin it via mappedAssetIds —
//        that signal belongs in a different model · workload.transitionPlan
//        or similar v3.1 schema-widening work · BUG-040 / BUG-039 family)
export function mapWorkloadAssets(engagement, workloadInstanceId, assetIds) {
  const workload = engagement.instances.byId[workloadInstanceId];
  if (!workload) {
    return { ok: false, errors: [{ path: "workloadInstanceId",
      message: "Workload instance '" + workloadInstanceId + "' not found",
      code: "WORKLOAD_NOT_FOUND" }] };
  }
  // I1
  if (workload.layerId !== "workload") {
    return { ok: false, errors: [{ path: "workloadInstanceId",
      message: "mapWorkloadAssets: source '" + (workload.label || workload.id) + "' is not a workload-layer instance (layerId='" + workload.layerId + "')",
      code: "MAP_NOT_WORKLOAD_SOURCE" }] };
  }
  if (!Array.isArray(assetIds)) {
    return { ok: false, errors: [{ path: "assetIds",
      message: "assetIds must be an array",
      code: "MAP_INVALID_ARG" }] };
  }
  // I2 · dedupe (order-preserving, first occurrence wins)
  const seen = new Set();
  const dedupedAssetIds = [];
  for (const id of assetIds) {
    if (typeof id !== "string" || id.length === 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    dedupedAssetIds.push(id);
  }
  // I3..I8 · per-asset gate
  for (const assetId of dedupedAssetIds) {
    // I4 · self-map
    if (assetId === workloadInstanceId) {
      return { ok: false, errors: [{ path: "assetIds",
        message: "mapWorkloadAssets: a workload cannot map to itself",
        code: "MAP_SELF" }] };
    }
    const asset = engagement.instances.byId[assetId];
    // I3 · existence
    if (!asset) {
      return { ok: false, errors: [{ path: "assetIds",
        message: "mapWorkloadAssets: asset instance '" + assetId + "' not found",
        code: "MAP_ASSET_NOT_FOUND" }] };
    }
    // I5 · workload→workload forbidden
    if (asset.layerId === "workload") {
      return { ok: false, errors: [{ path: "assetIds",
        message: "mapWorkloadAssets: target '" + (asset.label || asset.id) + "' is itself a workload — workloads only map to infrastructure layers",
        code: "MAP_WORKLOAD_TO_WORKLOAD" }] };
    }
    // I6 · state mismatch
    if (asset.state !== workload.state) {
      return { ok: false, errors: [{ path: "assetIds",
        message: "mapWorkloadAssets: state mismatch — " + workload.state + " workload cannot map to a " + asset.state + " asset",
        code: "MAP_STATE_MISMATCH" }] };
    }
    // I7 · cross-env mismatch
    if (asset.environmentId !== workload.environmentId) {
      return { ok: false, errors: [{ path: "assetIds",
        message: "mapWorkloadAssets: environment mismatch — workload is in " +
          workload.environmentId + ", asset is in " + asset.environmentId +
          ". Create a separate workload tile in '" + asset.environmentId +
          "' to model hybrid deployments.",
        code: "MAP_ENV_MISMATCH" }] };
    }
    // I8 · BUG-040 · retired-asset gate
    if (asset.disposition === "retire") {
      return { ok: false, errors: [{ path: "assetIds",
        message: "mapWorkloadAssets: target '" + (asset.label || asset.id) + "' has disposition 'retire' — cannot map a workload to an asset being retired (BUG-040). Map to the replacement desired-state asset instead.",
        code: "MAP_TO_RETIRED_ASSET" }] };
    }
  }
  // All invariants pass · delegate to updateInstance for the actual commit.
  return updateInstance(engagement, workloadInstanceId, { mappedAssetIds: dedupedAssetIds });
}

// ─── rc.8.b / R7 · applyAiInstanceMutation (per SPEC §S46.10/§S46.11 / CH36.h) ──
//
// AI-authored mutation path. Stamps `aiTag = runMeta` on the mutated
// instance. Distinct from updateInstance — that one STRIPS aiTag (auto-
// clear contract). Used by ui/views/CanvasChatOverlay.js applyMutations
// for both 'ask' (post-approval) and 'auto-tag' (immediate) policies.
//
// Scope: instances ONLY. Drivers / environments / gaps / customer /
// engagementMeta have NO equivalent action; AI mutations against them
// are forbidden in v3.0 GA.
//
// Shape: applyAiInstanceMutation(engagement, instanceId, patch, runMeta)
//   runMeta = { skillId, runId, mutatedAt }
export function applyAiInstanceMutation(engagement, instanceId, patch, runMeta) {
  const existing = engagement.instances.byId[instanceId];
  if (!existing) {
    return { ok: false, errors: [{ path: "instanceId",
      message: "Instance not found", code: "not_found" }] };
  }
  if (!runMeta || typeof runMeta !== "object" ||
      !runMeta.skillId || !runMeta.runId || !runMeta.mutatedAt) {
    return { ok: false, errors: [{ path: "runMeta",
      message: "runMeta { skillId, runId, mutatedAt } required for AI mutation",
      code: "missing_runmeta" }] };
  }
  const now = new Date().toISOString();
  const merged = { ...existing, ...(patch || {}),
                   id: existing.id, engagementId: existing.engagementId,
                   createdAt: existing.createdAt, updatedAt: now,
                   aiTag: { skillId: runMeta.skillId, runId: runMeta.runId, mutatedAt: runMeta.mutatedAt } };
  const result = InstanceSchema.safeParse(merged);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(i => ({
        path: i.path.join("."), message: i.message, code: i.code
      }))
    };
  }
  const newById = { ...engagement.instances.byId, [instanceId]: result.data };
  return {
    ok: true,
    engagement: {
      ...engagement,
      instances: {
        byId:    newById,
        allIds:  engagement.instances.allIds,
        byState: rebuildByState(newById, engagement.instances.allIds)
      },
      meta: { ...engagement.meta, updatedAt: now }
    }
  };
}
