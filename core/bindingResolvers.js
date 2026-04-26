// core/bindingResolvers.js — Phase 19d / v2.4.4
//
// Write resolvers for `context.*` paths. Every writable `context.*` entry
// in `FIELD_MANIFEST` MUST have a matching resolver here. `applyProposal`
// calls the resolver with (session, context, value) at apply time —
// the resolver finds the target entity in session state (by id, taken
// from the runtime context) and mutates it in place.
//
// Safety invariants:
// - Never mutate anything outside `session.*`. Resolvers may only reach
//   into session.customer.drivers / session.instances / session.gaps.
// - If the target entity cannot be found (e.g. user deselected or
//   deleted it mid-run), throw — applyProposal converts to a UI error.
// - Keep each resolver narrow and predictable. Business-logic cascades
//   (e.g. "changing a gap's phase syncs linked desired tiles") belong
//   in v2.4.5+ action-commands via the existing interactions/* modules,
//   NOT here. This keeps scalar writes cheap and undoable as single
//   snapshot boundaries.
//
// See SPEC §12.2 for the contract. Adding a new writable field =
// one FIELD_MANIFEST entry + one resolver here.

import { normalizeServices } from "./services.js";

function findDriverById(session, id) {
  var drivers = (session && session.customer && session.customer.drivers) || [];
  return drivers.find(function(d) { return d && d.id === id; });
}
function findGapById(session, id) {
  return ((session && session.gaps) || []).find(function(g) { return g && g.id === id; });
}
function findInstanceById(session, id) {
  return ((session && session.instances) || []).find(function(i) { return i && i.id === id; });
}

export var WRITE_RESOLVERS = {
  // ── Context tab — writable driver fields ──
  "context.selectedDriver.priority": function(session, context, value) {
    var id = context && context.selectedDriver && context.selectedDriver.id;
    var driver = findDriverById(session, id);
    if (!driver) throw new Error("Driver '" + id + "' not found in session");
    driver.priority = value;
  },
  "context.selectedDriver.outcomes": function(session, context, value) {
    var id = context && context.selectedDriver && context.selectedDriver.id;
    var driver = findDriverById(session, id);
    if (!driver) throw new Error("Driver '" + id + "' not found in session");
    driver.outcomes = value;
  },

  // ── Current/Desired tabs — writable instance fields ──
  "context.selectedInstance.criticality": function(session, context, value) {
    var id = context && context.selectedInstance && context.selectedInstance.id;
    var inst = findInstanceById(session, id);
    if (!inst) throw new Error("Instance '" + id + "' not found in session");
    inst.criticality = value;
  },
  "context.selectedInstance.notes": function(session, context, value) {
    var id = context && context.selectedInstance && context.selectedInstance.id;
    var inst = findInstanceById(session, id);
    if (!inst) throw new Error("Instance '" + id + "' not found in session");
    inst.notes = value;
  },
  "context.selectedInstance.disposition": function(session, context, value) {
    var id = context && context.selectedInstance && context.selectedInstance.id;
    var inst = findInstanceById(session, id);
    if (!inst) throw new Error("Instance '" + id + "' not found in session");
    inst.disposition = value;
  },
  "context.selectedInstance.priority": function(session, context, value) {
    var id = context && context.selectedInstance && context.selectedInstance.id;
    var inst = findInstanceById(session, id);
    if (!inst) throw new Error("Instance '" + id + "' not found in session");
    inst.priority = value;
  },

  // ── Gaps tab — writable gap fields ──
  "context.selectedGap.description": function(session, context, value) {
    var id = context && context.selectedGap && context.selectedGap.id;
    var gap = findGapById(session, id);
    if (!gap) throw new Error("Gap '" + id + "' not found in session");
    gap.description = value;
  },
  "context.selectedGap.gapType": function(session, context, value) {
    var id = context && context.selectedGap && context.selectedGap.id;
    var gap = findGapById(session, id);
    if (!gap) throw new Error("Gap '" + id + "' not found in session");
    gap.gapType = value;
  },
  "context.selectedGap.urgency": function(session, context, value) {
    var id = context && context.selectedGap && context.selectedGap.id;
    var gap = findGapById(session, id);
    if (!gap) throw new Error("Gap '" + id + "' not found in session");
    gap.urgency = value;
  },
  "context.selectedGap.phase": function(session, context, value) {
    var id = context && context.selectedGap && context.selectedGap.id;
    var gap = findGapById(session, id);
    if (!gap) throw new Error("Gap '" + id + "' not found in session");
    gap.phase = value;
  },
  "context.selectedGap.status": function(session, context, value) {
    var id = context && context.selectedGap && context.selectedGap.id;
    var gap = findGapById(session, id);
    if (!gap) throw new Error("Gap '" + id + "' not found in session");
    gap.status = value;
  },
  "context.selectedGap.notes": function(session, context, value) {
    var id = context && context.selectedGap && context.selectedGap.id;
    var gap = findGapById(session, id);
    if (!gap) throw new Error("Gap '" + id + "' not found in session");
    gap.notes = value;
  },
  // v2.4.12 · gap.services multi-select. AI skills may emit either a
  // JSON array of ids OR a comma-separated string; we normalize both
  // shapes through normalizeServices (drops unknowns, dedupes).
  "context.selectedGap.services": function(session, context, value) {
    var id = context && context.selectedGap && context.selectedGap.id;
    var gap = findGapById(session, id);
    if (!gap) throw new Error("Gap '" + id + "' not found in session");
    var arr;
    if (Array.isArray(value)) {
      arr = value;
    } else if (typeof value === "string") {
      // accept "migration, deployment, training" or "migration deployment training"
      arr = value.split(/[\s,]+/).map(function(s) { return s.trim(); }).filter(Boolean);
    } else {
      arr = [];
    }
    gap.services = normalizeServices(arr);
  },
  "context.selectedGap.driverId": function(session, context, value) {
    var id = context && context.selectedGap && context.selectedGap.id;
    var gap = findGapById(session, id);
    if (!gap) throw new Error("Gap '" + id + "' not found in session");
    if (value === null || value === "" || value === undefined) delete gap.driverId;
    else gap.driverId = value;
  }
};

// Is a path eligible for AI write? True iff:
//   - rooted at 'session.*' (applyProposal does direct setPath), OR
//   - rooted at 'context.*' AND we have a resolver for it.
export function isWritablePath(path) {
  if (typeof path !== "string") return false;
  if (path.indexOf("session.") === 0) return true;
  return Object.prototype.hasOwnProperty.call(WRITE_RESOLVERS, path);
}
