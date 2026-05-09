// services/programsService.js — pure functions, no session mutation.
// SPEC §5.2.1 · Programs-hierarchy helpers for Tab 5 Roadmap and Tab 4 UI.
//
// Last audited v2.4.16 · 2026-04-29 · per docs/TAXONOMY.md §6.5.
// Driver suggestion ladder D1-D9 (RULES §8): regex-on-text-fields fallback
// when gap.driverId is absent. Deterministic; only wins if proposed driver
// is in session.customer.drivers[] (no ghost programs).
// Closed-gap behavior: NONE of these helpers filter by gap.status — they
// resolve a driver for any gap passed in. Caller-side filtering (Tab 5
// reporting views) determines which gaps reach these functions.
// Hidden-env behavior: ladder rule D4 ("touches publicCloud") inspects
// gap.affectedEnvironments + linked instances; doesn't consider visibility.

import { BUSINESS_DRIVERS } from "../core/config.js";
// rc.7 / 7e-8 BUG-044 fix · v3 engagement read for UUID->businessDriverId
// resolution in driverLabel. v3 stores drivers as
// engagement.drivers.byId[uuid] = { id, businessDriverId, priority, outcomes }.
// gap.driverId in v3 is the UUID; the catalog label lives at
// BUSINESS_DRIVERS keyed by businessDriverId (the v2 typeId, e.g.
// "cyber_resilience"). Without this resolution the UI rendered the
// raw UUID after the ★/☆ glyph (BUG-044 visible repro).
import { getActiveEngagement } from "../state/engagementStore.js";

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

// v2.4.11 · A5 · WHY did this driver get assigned? Returns a structured
// answer the UI can render into a chip ("Auto-suggested driver: X
// because Y. [Override]"). Source = "explicit" when gap.driverId is
// set; "suggested" when a ladder rule matched; "none" when nothing
// suggested. Mirrors the rule ladder in suggestDriverId.
export function effectiveDriverReason(gap, session) {
  if (gap && gap.driverId) {
    return { driverId: gap.driverId, source: "explicit", reason: "explicitly set on this gap" };
  }
  var addedIds = new Set(
    ((session && session.customer && session.customer.drivers) || []).map(function(d) { return d.id; })
  );
  function propose(id) { return addedIds.has(id) ? id : null; }
  var mappedLower = (gap && gap.mappedDellSolutions || "").toLowerCase();
  var notesLower  = (gap && gap.notes || "").toLowerCase();
  var descLower   = (gap && gap.description || "").toLowerCase();
  var textBlob    = notesLower + " " + descLower;
  var envs = (gap && gap.affectedEnvironments) || [];
  var linkedInstances = ((session && session.instances) || []).filter(function(i) {
    return ((gap && gap.relatedCurrentInstanceIds) || []).indexOf(i.id) >= 0 ||
           ((gap && gap.relatedDesiredInstanceIds) || []).indexOf(i.id) >= 0;
  });
  var linkedInPublicCloud = linkedInstances.some(function(i) { return i.environmentId === "publicCloud"; });
  var hit;

  if (gap && gap.layerId === "dataProtection" && (hit = propose("cyber_resilience"))) {
    return { driverId: hit, source: "suggested", reason: "primary layer is Data Protection" };
  }
  if (mappedLower.indexOf("cyber") >= 0 && (hit = propose("cyber_resilience"))) {
    return { driverId: hit, source: "suggested", reason: "mapped solutions mention 'cyber'" };
  }
  if (gap && gap.gapType === "ops" && (hit = propose("ops_simplicity"))) {
    return { driverId: hit, source: "suggested", reason: "Operational / Services gap type" };
  }
  if ((envs.indexOf("publicCloud") >= 0 || linkedInPublicCloud) && (hit = propose("cloud_strategy"))) {
    return { driverId: hit, source: "suggested", reason: "touches Public Cloud (directly or via linked tile)" };
  }
  if (gap && gap.gapType === "consolidate" && (hit = propose("cost_optimization"))) {
    return { driverId: hit, source: "suggested", reason: "Consolidate gaps are typically cost-driven" };
  }
  if (gap && gap.gapType === "replace" &&
      ["compute", "storage", "virtualization"].indexOf(gap.layerId) >= 0 &&
      (hit = propose("modernize_infra"))) {
    return { driverId: hit, source: "suggested", reason: "Replace on " + gap.layerId + " layer" };
  }
  if (gap && gap.gapType === "introduce" && gap.layerId === "infrastructure" &&
      /(^|\W)(ai|ml|gpu)(\W|$)/i.test(descLower + " " + notesLower) &&
      (hit = propose("ai_data"))) {
    return { driverId: hit, source: "suggested", reason: "Introduce + AI/ML/GPU keywords in description/notes" };
  }
  if (/compliance|audit|nis2|gdpr|hipaa|pci/i.test(textBlob) &&
      (hit = propose("compliance_sovereignty"))) {
    return { driverId: hit, source: "suggested", reason: "compliance/audit framework keywords in description/notes" };
  }
  if (/energy|carbon|sustainab|esg/i.test(textBlob) &&
      (hit = propose("sustainability"))) {
    return { driverId: hit, source: "suggested", reason: "energy/carbon/ESG keywords in description/notes" };
  }
  return { driverId: null, source: "none", reason: "no suggestion rule matched (lands in Unassigned swimlane)" };
}

/**
 * Human label lookup. Accepts EITHER a v2 catalog typeId
 * (e.g. "cyber_resilience") OR a v3 UUID (gap.driverId in v3 storage).
 *
 * BUG-044 fix · pre-fix this returned null for v3 UUIDs and the caller
 * (GapsEditView gap-card render) fell through to display the raw UUID
 * after the ★ glyph. Now: resolve the UUID via engagement.drivers.byId
 * to its businessDriverId (catalog typeId), then look up the label.
 */
export function driverLabel(driverId) {
  if (!driverId) return null;
  // v2 path: directly a catalog typeId.
  var d = BUSINESS_DRIVERS.find(function(b) { return b.id === driverId; });
  if (d) return d.label;
  // v3 path: driverId is a UUID; resolve via the active engagement's
  // drivers collection to get the businessDriverId (catalog typeId),
  // then look up the catalog label.
  try {
    var eng = getActiveEngagement();
    var v3d = eng && eng.drivers && eng.drivers.byId && eng.drivers.byId[driverId];
    if (v3d && v3d.businessDriverId) {
      var d2 = BUSINESS_DRIVERS.find(function(b) { return b.id === v3d.businessDriverId; });
      return d2 ? d2.label : v3d.businessDriverId;
    }
  } catch (e) { /* defensive · driverLabel must never throw on the render path */ }
  // BUG-A / SPEC §S43.3 closure · driverId looked like a UUID/typeId but
  // resolved to no driver record. Pre-fix returned null, leaving the
  // caller free to fall back to displaying the raw UUID. Now returns a
  // structured placeholder so the UI surface has no path to leak a UUID.
  // The engagementIntegrity scrubber (layer 1) nulls out orphan driverIds
  // at rehydrate; this layer-2 placeholder catches any orphans that
  // survive a single in-session edit (e.g. driver removed before next
  // reload). Distinguishable from the explicit null case (driverId
  // absent) by the caller checking !driverId before invoking.
  return "(unknown driver)";
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
