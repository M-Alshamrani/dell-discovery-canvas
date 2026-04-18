// services/programsService.js — pure functions, no session mutation.
// SPEC §5.2.1 · Programs-hierarchy helpers for Tab 5 Roadmap and Tab 4 UI.

import { BUSINESS_DRIVERS } from "../core/config.js";

/**
 * Suggest a program (driverId) for a gap using a deterministic rule ladder.
 * A rule only "wins" if the proposed driverId is present in session.customer.drivers[];
 * otherwise the rule falls through to the next. This prevents ghost programs appearing
 * in the Roadmap for drivers the presales never added.
 *
 * Returns driverId | null.
 */
export function suggestDriverId(gap, session) {
  if (!gap) return null;

  var addedIds = new Set(
    ((session && session.customer && session.customer.drivers) || []).map(function(d) { return d.id; })
  );

  function propose(id) { return addedIds.has(id) ? id : null; }

  var mappedLower = (gap.mappedDellSolutions || "").toLowerCase();
  var notesLower  = (gap.notes || "").toLowerCase();
  var descLower   = (gap.description || "").toLowerCase();
  var textBlob    = notesLower + " " + descLower;

  var envs = gap.affectedEnvironments || [];
  var linkedInstances = ((session && session.instances) || []).filter(function(i) {
    return (gap.relatedCurrentInstanceIds || []).indexOf(i.id) >= 0 ||
           (gap.relatedDesiredInstanceIds || []).indexOf(i.id) >= 0;
  });
  var linkedInPublicCloud = linkedInstances.some(function(i) { return i.environmentId === "publicCloud"; });

  var hit;

  // 1. Data-protection layer → Cyber Resilience
  if (gap.layerId === "dataProtection" && (hit = propose("cyber_resilience"))) return hit;

  // 2. Mapped solutions mention "cyber" → Cyber Resilience
  if (mappedLower.indexOf("cyber") >= 0 && (hit = propose("cyber_resilience"))) return hit;

  // 3. Ops gapType → Operational Simplicity
  if (gap.gapType === "ops" && (hit = propose("ops_simplicity"))) return hit;

  // 4. Public Cloud touched (directly or via linked instances) → Cloud Strategy
  if ((envs.indexOf("publicCloud") >= 0 || linkedInPublicCloud) && (hit = propose("cloud_strategy"))) return hit;

  // 5. Consolidate gapType → Cost Optimization
  if (gap.gapType === "consolidate" && (hit = propose("cost_optimization"))) return hit;

  // 6. Replace on compute/storage/virtualization → Modernize Aging Infra
  if (gap.gapType === "replace" &&
      ["compute", "storage", "virtualization"].indexOf(gap.layerId) >= 0 &&
      (hit = propose("modernize_infra"))) return hit;

  // 7. Introduce + infrastructure + AI/ML/GPU mention → AI & Data Platforms
  if (gap.gapType === "introduce" && gap.layerId === "infrastructure" &&
      /(^|\W)(ai|ml|gpu)(\W|$)/i.test(descLower + " " + notesLower) &&
      (hit = propose("ai_data"))) return hit;

  // 8. Compliance / audit / regulated frameworks → Compliance & Sovereignty
  if (/compliance|audit|nis2|gdpr|hipaa|pci/i.test(textBlob) &&
      (hit = propose("compliance_sovereignty"))) return hit;

  // 9. Energy / carbon / ESG → Sustainability
  if (/energy|carbon|sustainab|esg/i.test(textBlob) &&
      (hit = propose("sustainability"))) return hit;

  // 10. Fallback
  return null;
}

/**
 * Group projects into a dict keyed by driverId. "unassigned" collects projects
 * whose effective driverId is null or points to a driver no longer in the session.
 */
export function groupProjectsByProgram(projects, session) {
  var addedIds = new Set(
    ((session && session.customer && session.customer.drivers) || []).map(function(d) { return d.id; })
  );
  var result = { unassigned: [] };
  addedIds.forEach(function(id) { result[id] = []; });
  (projects || []).forEach(function(p) {
    if (p.driverId && addedIds.has(p.driverId)) {
      result[p.driverId].push(p);
    } else {
      result.unassigned.push(p);
    }
  });
  return result;
}

/** Resolve an effective driverId for a gap: explicit override wins, else suggest. */
export function effectiveDriverId(gap, session) {
  if (gap && gap.driverId) return gap.driverId;
  return suggestDriverId(gap, session);
}

/** Human label lookup. */
export function driverLabel(driverId) {
  var d = BUSINESS_DRIVERS.find(function(b) { return b.id === driverId; });
  return d ? d.label : null;
}

/**
 * v2.1 · derive the effective list of Dell solutions for a gap.
 * Replaces free-text `mappedDellSolutions`. Rule: labels of linked desired
 * instances with `vendorGroup === "dell"`, deduped.
 */
export function effectiveDellSolutions(gap, session) {
  if (!gap || !session) return [];
  var ids = gap.relatedDesiredInstanceIds || [];
  var out = [];
  (session.instances || []).forEach(function(inst) {
    if (inst.state !== "desired") return;
    if (inst.vendorGroup !== "dell") return;
    if (ids.indexOf(inst.id) < 0) return;
    if (out.indexOf(inst.label) < 0) out.push(inst.label);
  });
  return out;
}
