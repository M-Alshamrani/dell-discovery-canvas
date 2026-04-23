// core/fieldManifest.js — Phase 19c / v2.4.2
//
// Per-tab list of bindable fields for the skill builder's click-to-insert
// mechanic. Each entry declares a dot-path (consumed by the template
// engine at run time) and a human-readable label (shown in the picker
// chip). Grouped by source — `session.*` fields are tab-independent
// (always available); `context.*` fields are the currently-selected row
// on that tab at run time.
//
// Adding a new binding = add an entry here. No engine changes needed.
// Adding a new tab = add a new top-level key AND wire the tab view to
// pass the matching context object into useAiButton's getContext().

var SESSION_FIELDS = [
  { path: "session.customer.name",     label: "Customer name",                 kind: "scalar" },
  { path: "session.customer.vertical", label: "Customer vertical",             kind: "scalar" },
  { path: "session.customer.region",   label: "Customer region",               kind: "scalar" },
  { path: "session.customer.drivers",  label: "All drivers (array)",           kind: "array"  },
  { path: "session.instances",         label: "All instances (array)",         kind: "array"  },
  { path: "session.gaps",              label: "All gaps (array)",              kind: "array"  }
];

export const FIELD_MANIFEST = {
  context: SESSION_FIELDS.concat([
    { path: "context.selectedDriver.id",        label: "Selected driver id",       kind: "scalar" },
    { path: "context.selectedDriver.label",     label: "Selected driver label",    kind: "scalar" },
    { path: "context.selectedDriver.shortHint", label: "Selected driver hint",     kind: "scalar" },
    { path: "context.selectedDriver.priority",  label: "Selected driver priority", kind: "scalar" },
    { path: "context.selectedDriver.outcomes",  label: "Selected driver outcomes", kind: "scalar" }
  ]),
  current: SESSION_FIELDS.concat([
    { path: "context.selectedInstance.label",         label: "Selected tile label",        kind: "scalar" },
    { path: "context.selectedInstance.vendor",        label: "Selected tile vendor",       kind: "scalar" },
    { path: "context.selectedInstance.vendorGroup",   label: "Selected tile vendor group", kind: "scalar" },
    { path: "context.selectedInstance.criticality",   label: "Selected tile criticality",  kind: "scalar" },
    { path: "context.selectedInstance.notes",         label: "Selected tile notes",        kind: "scalar" },
    { path: "context.selectedInstance.layerId",       label: "Selected tile layer",        kind: "scalar" },
    { path: "context.selectedInstance.environmentId", label: "Selected tile environment",  kind: "scalar" }
  ]),
  desired: SESSION_FIELDS.concat([
    { path: "context.selectedInstance.label",         label: "Selected tile label",           kind: "scalar" },
    { path: "context.selectedInstance.vendor",        label: "Selected tile vendor",          kind: "scalar" },
    { path: "context.selectedInstance.disposition",   label: "Selected tile disposition",     kind: "scalar" },
    { path: "context.selectedInstance.priority",      label: "Selected tile phase (priority)",kind: "scalar" },
    { path: "context.selectedInstance.notes",         label: "Selected tile notes",           kind: "scalar" },
    { path: "context.selectedInstance.layerId",       label: "Selected tile layer",           kind: "scalar" },
    { path: "context.selectedInstance.environmentId", label: "Selected tile environment",     kind: "scalar" },
    { path: "context.selectedInstance.originId",      label: "Selected tile current origin",  kind: "scalar" }
  ]),
  gaps: SESSION_FIELDS.concat([
    { path: "context.selectedGap.description",                  label: "Selected gap description",              kind: "scalar" },
    { path: "context.selectedGap.gapType",                      label: "Selected gap type",                     kind: "scalar" },
    { path: "context.selectedGap.urgency",                      label: "Selected gap urgency",                  kind: "scalar" },
    { path: "context.selectedGap.phase",                        label: "Selected gap phase",                    kind: "scalar" },
    { path: "context.selectedGap.status",                       label: "Selected gap status",                   kind: "scalar" },
    { path: "context.selectedGap.notes",                        label: "Selected gap notes",                    kind: "scalar" },
    { path: "context.selectedGap.driverId",                     label: "Selected gap driver id",                kind: "scalar" },
    { path: "context.selectedGap.layerId",                      label: "Selected gap primary layer",            kind: "scalar" },
    { path: "context.selectedGap.affectedLayers",               label: "Selected gap affected layers (array)",  kind: "array"  },
    { path: "context.selectedGap.affectedEnvironments",         label: "Selected gap affected envs (array)",    kind: "array"  },
    { path: "context.selectedGap.relatedCurrentInstanceIds",    label: "Selected gap linked current (array)",   kind: "array"  },
    { path: "context.selectedGap.relatedDesiredInstanceIds",    label: "Selected gap linked desired (array)",   kind: "array"  }
  ]),
  reporting: SESSION_FIELDS.concat([
    { path: "context.selectedProject.name",        label: "Selected project name",          kind: "scalar" },
    { path: "context.selectedProject.gapCount",    label: "Selected project gap count",     kind: "scalar" },
    { path: "context.selectedProject.urgency",     label: "Selected project urgency",       kind: "scalar" },
    { path: "context.selectedProject.phase",       label: "Selected project phase",         kind: "scalar" },
    { path: "context.selectedProject.driverId",    label: "Selected project driver id",     kind: "scalar" },
    { path: "context.selectedProject.dellSolutions", label: "Selected project Dell solutions (array)", kind: "array" }
  ])
};

export function fieldsForTab(tabId) {
  return FIELD_MANIFEST[tabId] || [];
}

// Build a plausible preview scope so the live-preview panel can render
// the template even on a fresh session. Fills in placeholder objects
// for "selected" entries when no real selection exists.
export function buildPreviewScope(session, tabId) {
  var s = session || {};
  var cust = s.customer || {};
  var drivers   = Array.isArray(cust.drivers) ? cust.drivers : [];
  var instances = Array.isArray(s.instances)  ? s.instances  : [];
  var gaps      = Array.isArray(s.gaps)       ? s.gaps       : [];

  var preview = { session: s, context: {} };
  if (tabId === "context") {
    preview.context.selectedDriver = drivers[0] || { id: "—", label: "(no driver selected)", priority: "", shortHint: "", outcomes: "" };
  } else if (tabId === "current" || tabId === "desired") {
    var byState = instances.filter(function(i) { return i.state === (tabId === "current" ? "current" : "desired"); });
    preview.context.selectedInstance = byState[0] || { label: "(no tile selected)" };
  } else if (tabId === "gaps") {
    preview.context.selectedGap = gaps[0] || { description: "(no gap selected)", relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [] };
  } else if (tabId === "reporting") {
    preview.context.selectedProject = { name: "(no project selected)", gapCount: 0, urgency: "", phase: "", dellSolutions: [] };
  }
  return preview;
}
