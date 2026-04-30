// selectors/projects.js — v3.0 · SPEC sec S5.2.3
//
// Pure memoized selector: engagement -> ProjectGrouping.
//
// Replaces the v2.x stored gap.projectId field. Per MIGRATION sec M10
// the migrator drops projectId; project membership is now DERIVED at
// projection time using deterministic grouping rules.
//
// Grouping rule (v3.0): gaps with the same (driverId, layerId) form
// one project. The projectId is a deterministic hash of the grouping
// key so the same key produces the same id across runs (required by
// SPEC S5.1.4 determinism).
//
// Output shape (per SPEC S5.2.3):
//   {
//     projects: [{
//       projectId, label, gapIds[], driverIds[],
//       affectedEnvironmentIds[], phase, mostUrgent
//     }],
//     unassigned: GapId[]
//   }

import { memoizeOne } from "../services/memoizeOne.js";

const PHASE_ORDER = { now: 0, next: 1, later: 2 };
const URGENCY_ORDER = { Low: 0, Medium: 1, High: 2 };

// Deterministic projectId from (driverId, layerId). Stable across runs.
function projectKeyOf(driverId, layerId) {
  // driverId may be null (unassigned-driver gaps). Use a literal "no-driver" marker.
  return "proj-" + (driverId || "no-driver") + "-" + layerId;
}

function compute(engagement) {
  const buckets = new Map();   // projectId -> bucket
  const unassigned = [];

  for (const gapId of engagement.gaps.allIds) {
    const gap = engagement.gaps.byId[gapId];
    // v3.0 grouping rule: by (driverId, layerId). Gaps without layerId
    // (shouldn't happen — layerId is required by GapSchema) go to unassigned.
    if (!gap.layerId) {
      unassigned.push(gap.id);
      continue;
    }
    const key = projectKeyOf(gap.driverId, gap.layerId);
    if (!buckets.has(key)) {
      buckets.set(key, {
        projectId: key,
        label: deriveLabel(gap, engagement),
        gapIds: [],
        driverIds: new Set(),
        affectedEnvironmentIds: new Set(),
        phaseRank: 9,
        urgencyRank: -1
      });
    }
    const b = buckets.get(key);
    b.gapIds.push(gap.id);
    if (gap.driverId) b.driverIds.add(gap.driverId);
    for (const e of gap.affectedEnvironments) b.affectedEnvironmentIds.add(e);
    // earliest phase wins
    const pr = PHASE_ORDER[gap.phase] ?? 9;
    if (pr < b.phaseRank) b.phaseRank = pr;
    // max urgency wins
    const ur = URGENCY_ORDER[gap.urgency] ?? -1;
    if (ur > b.urgencyRank) b.urgencyRank = ur;
  }

  const projects = [];
  for (const b of buckets.values()) {
    projects.push({
      projectId: b.projectId,
      label: b.label,
      gapIds: b.gapIds,
      driverIds: [...b.driverIds],
      affectedEnvironmentIds: [...b.affectedEnvironmentIds],
      phase: phaseFromRank(b.phaseRank),
      mostUrgent: urgencyFromRank(b.urgencyRank)
    });
  }
  return { projects, unassigned };
}

function deriveLabel(gap, engagement) {
  const driver = gap.driverId ? engagement.drivers.byId[gap.driverId] : null;
  const driverLabel = driver ? "driver:" + driver.businessDriverId : "no-driver";
  return driverLabel + " / " + gap.layerId;
}

function phaseFromRank(r) {
  if (r === 0) return "now";
  if (r === 1) return "next";
  if (r === 2) return "later";
  return "later";   // shouldn't happen
}
function urgencyFromRank(r) {
  if (r === 2) return "High";
  if (r === 1) return "Medium";
  if (r === 0) return "Low";
  return "Low";
}

export const selectProjects = memoizeOne(compute, ([a], [b]) => a === b);
