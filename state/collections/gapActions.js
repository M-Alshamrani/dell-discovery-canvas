// state/collections/gapActions.js — v3.0 · SPEC sec S4.1.2
//
// R8 #1 (rc.7 v3-invariant-enforcement arc · 2026-05-09): updateGap now
// enforces validateActionLinks (AL10 / TX13.10) atomically when the patch
// flips reviewed:true OR when a structural field (gapType / layerId /
// affectedLayers / affectedEnvironments / relatedCurrent/DesiredInstanceIds)
// changes on an already-reviewed gap. Pure metadata patches (urgency, notes,
// phase, status, driverId, urgencyOverride, etc.) on an already-reviewed-
// but-shape-invalid gap STILL succeed — that's the v2.4.11 A1 contract:
// the user can save a side note on a gap with a violation; the soft chip
// in the UI flags it. AL10 only fires on the "I'm done" moment (explicit
// reviewed:true flip) or when the structural shape changes.
//
// Pre-fix v3 only ran GapSchema.safeParse (which checks shape but not
// link-count rules). Caller-layer enforcement was the workaround
// (validateActionLinks(probe-with-reviewed:true) before commitGapEdit).
// That worked for hand-coded UI flows but left the AL10 gate optional
// for any future caller (AI write paths, integrations, etc). R8 #1 makes
// the gate atomic at the helper layer per the v2 contract.

import { GapSchema, createEmptyGap } from "../../schema/gap.js";
import { validateActionLinks } from "../../core/taxonomy.js";

// Fields whose change can plausibly violate the Action's link-count rules
// or move the gap into a different Action category. Pure metadata patches
// (urgency, notes, phase, status, driverId, urgencyOverride, services,
// mappedDellSolutions, description) are NOT in this list — they can update
// freely even on a reviewed gap with a pre-existing AL10 violation.
const _STRUCTURAL_FIELDS = [
  "gapType", "layerId", "affectedLayers", "affectedEnvironments",
  "relatedCurrentInstanceIds", "relatedDesiredInstanceIds"
];

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

  // R8 #5 · setPrimaryLayer auto-rebalance (RULES G6 · 2026-05-09)
  // When caller patches layerId WITHOUT also patching affectedLayers,
  // auto-derive affectedLayers so:
  //   - new layerId moves to index 0 (G6: affectedLayers[0] === layerId)
  //   - old primary demoted to non-primary entry (preserved at later index)
  //   - no duplicates (filter then prepend)
  // Pre-fix v3 callers that updated layerId alone hit a G6 schema error
  // (caller had to also rewrite affectedLayers manually). This was a v3
  // ergonomics regression vs. v2 setPrimaryLayer; R8 #5 closes it. If
  // the caller passes BOTH layerId AND affectedLayers, we respect the
  // caller's intent (no auto-derivation) — schema still enforces G6.
  let effectivePatch = patch;
  if (typeof patch.layerId === "string" && patch.layerId.length > 0
      && !Array.isArray(patch.affectedLayers)) {
    const newPrimary = patch.layerId;
    const existingLayers = Array.isArray(existing.affectedLayers) ? existing.affectedLayers : [];
    const rest = existingLayers.filter(l => l !== newPrimary);
    effectivePatch = { ...patch, affectedLayers: [newPrimary, ...rest] };
  }

  const merged = { ...existing, ...effectivePatch,
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
  // R8 #1 · AL10 / TX13.10 · enforce action-link rules atomically when:
  //   (a) caller explicitly flips reviewed:true ("I'm done with this gap")
  //   (b) caller patches a structural field AND the merged gap is reviewed
  // Skipped for pure metadata patches on a reviewed-but-AL10-violating gap
  // (per v2.4.11 A1 contract: side notes, urgency, phase changes etc. save
  // freely; UI surfaces the violation as a soft chip on the gap detail).
  // Skipped entirely when the merged gap is reviewed:false (validateActionLinks
  // bypasses on unreviewed gaps anyway, but checking here avoids the call).
  const explicitReviewedFlip = patch.reviewed === true;
  const hasStructuralPatch = _STRUCTURAL_FIELDS.some(f => patch[f] !== undefined);
  const shouldValidateLinks =
    (explicitReviewedFlip) ||
    (hasStructuralPatch && result.data.reviewed === true);
  if (shouldValidateLinks) {
    try {
      validateActionLinks(result.data);
    } catch (e) {
      return {
        ok: false,
        errors: [{ path: "actionLinks", message: (e && e.message) || String(e), code: "AL10_VIOLATION" }]
      };
    }
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
