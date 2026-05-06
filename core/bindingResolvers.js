// core/bindingResolvers.js -- v3-pure write-resolver dispatch (rc.7 / 7e-5).
//
// Per SPEC §S40 + RULES §16 CH34. Every writable `context.*` path in
// `FIELD_MANIFEST` MUST have a matching action function here. The
// action takes (engagement, context, value) and returns a §S4-shaped
// { ok, engagement, errors? } result. `applyProposal` (interactions/
// aiCommands.js) routes the action through commitAction so AI writes
// land via the v3 engagement store with provenance preserved
// end-to-end.
//
// Doctrinal shift from the v2 (pre-7e-5) implementation:
//   - Resolvers no longer take `session` and mutate in place. They
//     take the immutable engagement and return the next engagement.
//   - context.selectedX.id values are interpreted as v3 IDs:
//       drivers : context.selectedDriver.id == businessDriverId (catalog
//                 ref like "cyber_resilience"); resolved to v3 driver
//                 UUID via _findDriverByBusinessDriverId.
//       gaps    : context.selectedGap.id == v3 gap UUID.
//       insts   : context.selectedInstance.id == v3 instance UUID.
//   - The v2 `session.*` direct-write path is RETIRED. AI writes
//     against v3-canonical paths only; any session.* proposal is
//     rejected at applyProposal-time per F40.4.6.
//
// Adding a new writable field = one FIELD_MANIFEST entry + one action
// function here.

import { normalizeServices } from "./services.js";
import { commitAction } from "../state/engagementStore.js";
import { updateDriver }   from "../state/collections/driverActions.js";
import { updateInstance } from "../state/collections/instanceActions.js";
import { updateGap }      from "../state/collections/gapActions.js";

// ── helpers ──────────────────────────────────────────────────────────
function _findDriverByBusinessDriverId(engagement, businessDriverId) {
  if (!engagement || !engagement.drivers || !Array.isArray(engagement.drivers.allIds)) return null;
  for (const id of engagement.drivers.allIds) {
    const d = engagement.drivers.byId[id];
    if (d && d.businessDriverId === businessDriverId) return d;
  }
  return null;
}

function _notFound(path, id) {
  return { ok: false, errors: [{ path, message: "'" + id + "' not found in v3 engagement", code: "not_found" }] };
}

// ── action functions per writable path ─────────────────────────────
//
// Each entry is a §S4 action function: (engagement, context, value)
// -> { ok, engagement, errors? }. applyProposal wraps the call in
// commitAction so the engagementStore commits + emits atomically.

export var WRITE_RESOLVERS = {
  // Drivers ----------------------------------------------------------
  "context.selectedDriver.priority": function(engagement, context, value) {
    const id = context && context.selectedDriver && context.selectedDriver.id;
    const d = _findDriverByBusinessDriverId(engagement, id);
    if (!d) return _notFound("selectedDriver.id", id);
    return updateDriver(engagement, d.id, { priority: value });
  },
  "context.selectedDriver.outcomes": function(engagement, context, value) {
    const id = context && context.selectedDriver && context.selectedDriver.id;
    const d = _findDriverByBusinessDriverId(engagement, id);
    if (!d) return _notFound("selectedDriver.id", id);
    return updateDriver(engagement, d.id, { outcomes: typeof value === "string" ? value : "" });
  },

  // Instances --------------------------------------------------------
  "context.selectedInstance.criticality": function(engagement, context, value) {
    const id = context && context.selectedInstance && context.selectedInstance.id;
    if (!engagement.instances || !engagement.instances.byId[id]) return _notFound("selectedInstance.id", id);
    return updateInstance(engagement, id, { criticality: value });
  },
  "context.selectedInstance.notes": function(engagement, context, value) {
    const id = context && context.selectedInstance && context.selectedInstance.id;
    if (!engagement.instances || !engagement.instances.byId[id]) return _notFound("selectedInstance.id", id);
    return updateInstance(engagement, id, { notes: typeof value === "string" ? value : "" });
  },
  "context.selectedInstance.disposition": function(engagement, context, value) {
    const id = context && context.selectedInstance && context.selectedInstance.id;
    if (!engagement.instances || !engagement.instances.byId[id]) return _notFound("selectedInstance.id", id);
    return updateInstance(engagement, id, { disposition: value });
  },
  "context.selectedInstance.priority": function(engagement, context, value) {
    const id = context && context.selectedInstance && context.selectedInstance.id;
    if (!engagement.instances || !engagement.instances.byId[id]) return _notFound("selectedInstance.id", id);
    // v3 schema: priority is desired-only, nullable. Empty/null clears.
    return updateInstance(engagement, id, { priority: value || null });
  },

  // Gaps -------------------------------------------------------------
  "context.selectedGap.description": function(engagement, context, value) {
    const id = context && context.selectedGap && context.selectedGap.id;
    if (!engagement.gaps || !engagement.gaps.byId[id]) return _notFound("selectedGap.id", id);
    return updateGap(engagement, id, { description: value });
  },
  "context.selectedGap.gapType": function(engagement, context, value) {
    const id = context && context.selectedGap && context.selectedGap.id;
    if (!engagement.gaps || !engagement.gaps.byId[id]) return _notFound("selectedGap.id", id);
    return updateGap(engagement, id, { gapType: value });
  },
  "context.selectedGap.urgency": function(engagement, context, value) {
    const id = context && context.selectedGap && context.selectedGap.id;
    if (!engagement.gaps || !engagement.gaps.byId[id]) return _notFound("selectedGap.id", id);
    return updateGap(engagement, id, { urgency: value });
  },
  "context.selectedGap.phase": function(engagement, context, value) {
    const id = context && context.selectedGap && context.selectedGap.id;
    if (!engagement.gaps || !engagement.gaps.byId[id]) return _notFound("selectedGap.id", id);
    return updateGap(engagement, id, { phase: value });
  },
  "context.selectedGap.status": function(engagement, context, value) {
    const id = context && context.selectedGap && context.selectedGap.id;
    if (!engagement.gaps || !engagement.gaps.byId[id]) return _notFound("selectedGap.id", id);
    return updateGap(engagement, id, { status: value });
  },
  "context.selectedGap.notes": function(engagement, context, value) {
    const id = context && context.selectedGap && context.selectedGap.id;
    if (!engagement.gaps || !engagement.gaps.byId[id]) return _notFound("selectedGap.id", id);
    return updateGap(engagement, id, { notes: typeof value === "string" ? value : "" });
  },
  "context.selectedGap.services": function(engagement, context, value) {
    const id = context && context.selectedGap && context.selectedGap.id;
    if (!engagement.gaps || !engagement.gaps.byId[id]) return _notFound("selectedGap.id", id);
    let arr;
    if (Array.isArray(value)) {
      arr = value;
    } else if (typeof value === "string") {
      arr = value.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    } else {
      arr = [];
    }
    return updateGap(engagement, id, { services: normalizeServices(arr) });
  },
  "context.selectedGap.driverId": function(engagement, context, value) {
    const id = context && context.selectedGap && context.selectedGap.id;
    if (!engagement.gaps || !engagement.gaps.byId[id]) return _notFound("selectedGap.id", id);
    // v3 gap.driverId is a v3 driver UUID (or null). Skills typically
    // emit businessDriverId (catalog ref); resolve here.
    let v3DriverId = null;
    if (value && typeof value === "string") {
      const d = _findDriverByBusinessDriverId(engagement, value);
      if (d) v3DriverId = d.id;
      // If the value already looks like a UUID and resolves to an
      // existing driver, accept it directly.
      else if (engagement.drivers && engagement.drivers.byId[value]) v3DriverId = value;
    }
    return updateGap(engagement, id, { driverId: v3DriverId });
  }
};

// Path eligibility for AI write. v3-pure mode rejects v2 session.*
// paths entirely (per SPEC §S40.4 F40.4.6). Only context.* paths with
// a registered resolver are writable.
export function isWritablePath(path) {
  if (typeof path !== "string") return false;
  return Object.prototype.hasOwnProperty.call(WRITE_RESOLVERS, path);
}

// applyResolver(path, context, value) -- helper for the AI dispatch
// path. Looks up the resolver, runs it through commitAction so the
// write goes via the v3 engagementStore. Returns the commitAction
// result ({ ok, engagement, errors? }).
export function applyResolver(path, context, value) {
  const resolver = WRITE_RESOLVERS[path];
  if (typeof resolver !== "function") {
    return { ok: false, errors: [{ path, message: "no resolver registered for path", code: "no_resolver" }] };
  }
  return commitAction(resolver, context, value);
}
