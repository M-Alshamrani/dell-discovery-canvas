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
  const merged = { ...existing, ...patch,
                   id: existing.id, engagementId: existing.engagementId,
                   createdAt: existing.createdAt, updatedAt: now };
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

// mapWorkloadAssets sets workload.mappedAssetIds (cross-env supported).
export function mapWorkloadAssets(engagement, workloadInstanceId, assetIds) {
  return updateInstance(engagement, workloadInstanceId, { mappedAssetIds: assetIds });
}
