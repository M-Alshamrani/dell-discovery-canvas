// core/services.js — Phase 19l / v2.4.12
//
// Catalog of professional-services "engagement shape" categories that can
// be attached to any gap as a multi-select facet. The chips appear on the
// Tab 4 gap detail panel; rolled-up per project on the Tab 5.5 Roadmap;
// and rolled-up across the whole session on the new Reporting "Services
// scope" sub-tab.
//
// Services are NOT a separate gap type — they are a facet of any gap.
// A Replace gap implies migration + deployment. A Consolidate gap implies
// migration + integration + knowledge_transfer. SUGGESTED_SERVICES_BY_GAP_TYPE
// drives an OPT-IN "SUGGESTED" eyebrow row above the chip selector: chips
// appear greyed but are NOT auto-selected. User clicks to add. Less
// surprising than auto-applying.

export const SERVICE_TYPES = [
  { id: "assessment",         label: "Assessment / Health check",   hint: "Pre-engagement audit before the work starts" },
  { id: "migration",          label: "Migration",                   hint: "Move data / workloads from current to desired platform" },
  { id: "deployment",         label: "Deployment / Install",        hint: "Build out the desired-state system" },
  { id: "integration",        label: "Integration",                 hint: "Connect to existing systems, APIs, identity, monitoring" },
  { id: "training",           label: "Training",                    hint: "Skill the customer's ops team on the new platform" },
  { id: "knowledge_transfer", label: "Knowledge transfer",          hint: "Hand-off documentation + walkthroughs" },
  { id: "runbook",            label: "Runbook authoring",           hint: "Operational playbooks (DR, incident response, change-mgmt)" },
  { id: "managed",            label: "Managed services",            hint: "Ongoing operational support contract" },
  { id: "decommissioning",    label: "Decommissioning",             hint: "Safe removal + data archive of retired systems" },
  { id: "custom_dev",         label: "Custom development",          hint: "Bespoke connectors, scripts, tooling" }
];

// Auto-suggest map (gapType → suggested services). UX is OPT-IN per the
// approved pick: chips appear under a "SUGGESTED" eyebrow but are NOT
// pre-selected. User clicks to add. Less surprising than auto-applying.
//
// Keys correspond to GAP_TYPES (`core/taxonomy.js`):
//   - replace, consolidate, introduce, enhance, ops
//   - keep gaps have null gapType → no suggestions
export const SUGGESTED_SERVICES_BY_GAP_TYPE = {
  replace:     ["migration", "deployment"],
  consolidate: ["migration", "integration", "knowledge_transfer"],
  introduce:   ["deployment", "training"],
  enhance:     ["assessment"],
  ops:         ["runbook"]
  // keep gaps have null gapType → no suggested services
};

// Convenience: array of all valid service ids — used by validateGap to
// reject unknown ids, and by normalizeServices to drop unknowns.
export const SERVICE_IDS = SERVICE_TYPES.map(function(s) { return s.id; });

// Look up a service's display label by id. Returns null on miss.
export function serviceLabel(id) {
  var hit = SERVICE_TYPES.find(function(s) { return s.id === id; });
  return hit ? hit.label : null;
}

// Normalize a services array: drop duplicates, drop unknowns, preserve
// caller's first-occurrence ordering. Pure function.
export function normalizeServices(arr) {
  if (!Array.isArray(arr)) return [];
  var seen = {};
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var id = arr[i];
    if (typeof id !== "string") continue;
    if (SERVICE_IDS.indexOf(id) < 0) continue;   // drop unknowns silently
    if (seen[id]) continue;                       // dedupe
    seen[id] = true;
    out.push(id);
  }
  return out;
}

// Return the suggested chips for a gapType, minus chips the user has
// already selected. Used by the gap detail panel's "SUGGESTED" eyebrow.
export function suggestedFor(gapType, selected) {
  var sug = SUGGESTED_SERVICES_BY_GAP_TYPE[gapType] || [];
  var sel = Array.isArray(selected) ? selected : [];
  return sug.filter(function(id) { return sel.indexOf(id) < 0; });
}
