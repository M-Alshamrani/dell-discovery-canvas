// state/collections/gapActions.js — v3.0 · SPEC sec S4.1.2

import { GapSchema, createEmptyGap } from "../../schema/gap.js";

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

export function addGap(engagement, input) {
  const now = new Date().toISOString();
  const draft = createEmptyGap({
    ...input,
    id:           newId(),
    engagementId: engagement.meta.engagementId,
    createdAt:    now,
    updatedAt:    now
  });
  const result = GapSchema.safeParse(draft);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(i => ({
        path: i.path.join("."), message: i.message, code: i.code
      }))
    };
  }
  const gap = result.data;
  return {
    ok: true,
    engagement: {
      ...engagement,
      gaps: {
        byId:   { ...engagement.gaps.byId, [gap.id]: gap },
        allIds: [...engagement.gaps.allIds, gap.id]
      },
      meta: { ...engagement.meta, updatedAt: now }
    }
  };
}

export function updateGap(engagement, gapId, patch) {
  const existing = engagement.gaps.byId[gapId];
  if (!existing) {
    return { ok: false, errors: [{ path: "gapId", message: "Gap not found", code: "not_found" }] };
  }
  const now = new Date().toISOString();
  const merged = { ...existing, ...patch,
                   id: existing.id, engagementId: existing.engagementId,
                   createdAt: existing.createdAt, updatedAt: now };
  const result = GapSchema.safeParse(merged);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(i => ({
        path: i.path.join("."), message: i.message, code: i.code
      }))
    };
  }
  return {
    ok: true,
    engagement: {
      ...engagement,
      gaps: {
        ...engagement.gaps,
        byId: { ...engagement.gaps.byId, [gapId]: result.data }
      },
      meta: { ...engagement.meta, updatedAt: now }
    }
  };
}

export function removeGap(engagement, gapId) {
  if (!engagement.gaps.byId[gapId]) return { ok: true, engagement };
  const { [gapId]: _removed, ...remaining } = engagement.gaps.byId;
  const now = new Date().toISOString();
  return {
    ok: true,
    engagement: {
      ...engagement,
      gaps: {
        byId:   remaining,
        allIds: engagement.gaps.allIds.filter(id => id !== gapId)
      },
      meta: { ...engagement.meta, updatedAt: now }
    }
  };
}

// Cross-cutting helpers per SPEC sec 3.7.
export function attachServices(engagement, gapId, serviceIds) {
  return updateGap(engagement, gapId, { services: serviceIds });
}

export function attachInstances(engagement, gapId, { current = [], desired = [] }) {
  return updateGap(engagement, gapId, {
    relatedCurrentInstanceIds: current,
    relatedDesiredInstanceIds: desired
  });
}
