// diagnostics/_v2TestFixtures.js
//
// rc.7 / 7e-8b · Test-only shim that gives `diagnostics/appSpec.js` ONE
// import surface for all v2 fixture builders.
//
// rc.7 / 7e-8d-4 (CURRENT): the sessionStore.js re-exports got INLINED
// here as actual function bodies. state/sessionStore.js is now DELETED.
// The 3 v2 interaction modules (matrixCommands, gapsCommands,
// desiredStateSync) are still re-exports; 7e-8d-5 inlines them and
// deletes their files.
//
// Why this is safe per RULES §16 CH34:
//   - V-ANTI-V2-IMPORT-1 forbids PRODUCTION files from importing
//     state/sessionStore.js. Test fixtures live in `diagnostics/`,
//     not production. The grep test scopes itself to production
//     paths so this file does NOT trip it.
//   - V-ANTI-V2-IMPORT-2 same scoping for the 3 interaction modules.
//
// Authority: SPEC §S40 + RULES §16 CH34 + project_v3_pure_arc.md.

// rc.7 / 7e-8d-4 · sessionStore.js dependencies pulled in here:
import { LEGACY_DRIVER_LABEL_TO_ID } from "../core/config.js";
import { createDemoSession as createDemoSessionImpl } from "../state/demoSession.js";
import { emitSessionChanged } from "../core/sessionEvents.js";
import { clear as clearAiUndoStack } from "../state/aiUndoStack.js";
import { setPrimaryLayer, deriveProjectId } from "../interactions/gapsCommands.js";
import { normalizeServices } from "../core/services.js";
import { markSaved } from "../core/saveStatus.js";

// Re-export createDemoSession so tests that pulled it from sessionStore
// keep working without changing their import.
export { createDemoSession } from "../state/demoSession.js";

// ─── createEmptySession (PURE) ─────────────────────────────────────
// Builds a v2-shape empty session object. Fresh sessionId per call.
// Was: state/sessionStore.js createEmptySession.
export function createEmptySession() {
  return {
    sessionId:    "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    isDemo:       false,
    customer: {
      name:           "",
      vertical:       "",
      segment:        "",
      industry:       "",
      region:         "",
      drivers:        []
    },
    sessionMeta: {
      date:          new Date().toISOString().slice(0, 10),
      presalesOwner: "",
      status:        "Draft",
      version:       "2.0"
    },
    environments: [],
    instances:  [],
    gaps:       []
  };
}

// ─── migrateLegacySession (PURE) ───────────────────────────────────
// Rewrites pre-v2 / v2.x raw session objects into the v2.4.x shape
// many tests still build fixtures around. Was: state/sessionStore.js
// migrateLegacySession. Body copied verbatim except the import
// resolutions above.
export function migrateLegacySession(raw) {
  var s = raw || {};
  if (!s.customer || typeof s.customer !== "object") s.customer = {};
  var c = s.customer;

  if (typeof c.name     === "undefined") c.name     = "";
  if (typeof c.vertical === "undefined") c.vertical = c.segment || c.industry || "";
  if (typeof c.segment  === "undefined") c.segment  = "";
  if (typeof c.industry === "undefined") c.industry = "";
  if (typeof c.region   === "undefined") c.region   = "";

  if (!Array.isArray(c.drivers)) {
    var legacyLabel    = c.primaryDriver;
    var legacyOutcomes = s.businessOutcomes;
    if (legacyLabel && LEGACY_DRIVER_LABEL_TO_ID[legacyLabel]) {
      c.drivers = [{
        id:       LEGACY_DRIVER_LABEL_TO_ID[legacyLabel],
        priority: "High",
        outcomes: legacyOutcomes || ""
      }];
    } else {
      c.drivers = [];
    }
  }
  delete c.primaryDriver;
  delete s.businessOutcomes;

  if (!Array.isArray(s.instances)) s.instances = [];
  if (!Array.isArray(s.gaps))      s.gaps      = [];

  // v2.4.15 dynamic environment model + alias drain.
  var legacyAliases = (s.environmentAliases && typeof s.environmentAliases === "object")
    ? s.environmentAliases : null;

  if (!Array.isArray(s.environments)) {
    var referenced = {};
    s.instances.forEach(function(i) {
      if (i && typeof i.environmentId === "string" && i.environmentId.length > 0) {
        referenced[i.environmentId] = true;
      }
    });
    s.gaps.forEach(function(g) {
      if (g && Array.isArray(g.affectedEnvironments)) {
        g.affectedEnvironments.forEach(function(envId) {
          if (typeof envId === "string" && envId.length > 0) referenced[envId] = true;
        });
      }
    });
    s.environments = Object.keys(referenced).map(function(id) {
      return { id: id, hidden: false };
    });
  }

  // Per-entry hygiene.
  var seenIds = {};
  s.environments = s.environments.filter(function(e) {
    if (!e || typeof e.id !== "string" || e.id.length === 0) return false;
    if (seenIds[e.id]) return false;
    seenIds[e.id] = true;
    return true;
  }).map(function(e) {
    var out = Object.assign({}, e);
    if (typeof out.hidden !== "boolean") out.hidden = false;
    if (legacyAliases && typeof legacyAliases[out.id] === "string" &&
        legacyAliases[out.id].trim().length > 0 &&
        (typeof out.alias !== "string" || out.alias.length === 0)) {
      out.alias = legacyAliases[out.id].trim();
    }
    return out;
  });
  if ("environmentAliases" in s) delete s.environmentAliases;

  // v2.1 rule 6: default `reviewed` on any gap missing it.
  s.gaps.forEach(function(g) {
    if (typeof g.reviewed !== "boolean") {
      g.reviewed = !((g.relatedDesiredInstanceIds || []).length > 0);
    }
  });

  // v2.4.8 Phase 17: coerce retired "rationalize" disposition/gapType.
  s.gaps.forEach(function(g) {
    if (g && g.gapType === "rationalize") {
      console.warn("[migrate · Phase 17] coercing gap.gapType 'rationalize' → 'ops' on gap " + g.id);
      g.gapType = "ops";
    }
  });
  s.instances.forEach(function(i) {
    if (i && i.disposition === "rationalize") {
      console.warn("[migrate · Phase 17] coercing instance.disposition 'rationalize' → 'retire' on " + i.id);
      i.disposition = "retire";
    }
  });

  // v2.4.9 / .11 / .12 backfills.
  s.gaps.forEach(function(g) {
    if (!g || !g.layerId) return;
    var alreadyOk = Array.isArray(g.affectedLayers) &&
                    g.affectedLayers.length > 0 &&
                    g.affectedLayers[0] === g.layerId;
    if (!alreadyOk) setPrimaryLayer(g, g.layerId);
    if (!g.projectId) g.projectId = deriveProjectId(g);
    if (typeof g.urgencyOverride !== "boolean") g.urgencyOverride = false;
    if (!Array.isArray(g.services)) {
      g.services = [];
    } else {
      g.services = normalizeServices(g.services);
    }
  });

  if (!s.sessionMeta || typeof s.sessionMeta !== "object") {
    s.sessionMeta = {
      date:          new Date().toISOString().slice(0, 10),
      presalesOwner: "",
      status:        "Draft",
      version:       "2.0"
    };
  }

  if (!s.sessionId) {
    s.sessionId = "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  }

  return s;
}

// ─── session (test-fixture mutable singleton) ──────────────────────
// Was: state/sessionStore.js's `let session` IIFE-initialized from
// localStorage at module load. This fixture version IS still IIFE-
// initialized so tests that import {session} get a populated v2-shape
// object with whatever was persisted from a prior test run; the
// runIsolated harness wraps each test pass in a localStorage snapshot
// so cross-test pollution is bounded.
const STORAGE_KEY = "dell_discovery_v1";

export let session = (function() {
  try {
    var raw = (typeof localStorage !== "undefined") ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      var s = migrateLegacySession(JSON.parse(raw));
      try { markSaved({ isDemo: !!s.isDemo }); } catch (e) { /* swallow */ }
      return s;
    }
  } catch(e) {}
  return migrateLegacySession(createEmptySession());
})();

// ─── isFreshSession (PURE) ─────────────────────────────────────────
export function isFreshSession(s) {
  var x = (arguments.length === 0) ? session : s;
  if (!x || typeof x !== "object") return true;
  var c = x.customer || {};
  if (c.name && c.name.trim().length > 0) return false;
  if (Array.isArray(c.drivers) && c.drivers.length > 0) return false;
  if (Array.isArray(x.instances) && x.instances.length > 0) return false;
  if (Array.isArray(x.gaps) && x.gaps.length > 0) return false;
  return true;
}

// ─── mutating helpers (operate on the test-fixture session) ────────
// Pre-7e-8d-4 these lived in state/sessionStore.js as production
// helpers. Post-deletion they survive ONLY here as test-fixture
// shims that mutate the local `session` singleton + emit on the
// session-changed bus so legacy tests keep their assertion shape.
// Production code routes through state/engagementStore.js +
// state/adapter.js instead.

export function resetSession() {
  var fresh = createEmptySession();
  Object.keys(session).forEach(function(k) { delete session[k]; });
  Object.assign(session, fresh);
  clearAiUndoStack();
  emitSessionChanged("session-reset", "New session");
}

export function resetToDemo() {
  var demo = migrateLegacySession(createDemoSessionImpl());
  Object.keys(session).forEach(function(k) { delete session[k]; });
  Object.assign(session, demo);
  clearAiUndoStack();
  emitSessionChanged("session-demo", "Loaded demo session");
}

export function replaceSession(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  Object.keys(session).forEach(function(k) { delete session[k]; });
  Object.assign(session, snapshot);
}

export function applyContextSave(patch) {
  var p = patch || {};
  var changed = false;
  if (p.customer && typeof p.customer === "object") {
    Object.keys(p.customer).forEach(function(k) {
      if (k === "drivers") return;
      if (session.customer[k] !== p.customer[k]) {
        session.customer[k] = p.customer[k];
        changed = true;
      }
    });
  }
  if (p.sessionMeta && typeof p.sessionMeta === "object") {
    Object.keys(p.sessionMeta).forEach(function(k) {
      if (session.sessionMeta[k] !== p.sessionMeta[k]) {
        session.sessionMeta[k] = p.sessionMeta[k];
        changed = true;
      }
    });
  }
  if (changed && session.customer.name && session.customer.name.trim()) {
    session.isDemo = false;
  }
  if (changed) emitSessionChanged("context-save", "Save context");
  saveToLocalStorage();
  return session;
}

export function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    markSaved({ isDemo: !!session.isDemo });
    return true;
  } catch(e) {
    console.warn("Save failed:", e);
    return false;
  }
}

export function loadFromLocalStorage() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    var migrated = migrateLegacySession(JSON.parse(raw));
    Object.keys(session).forEach(function(k) { delete session[k]; });
    Object.assign(session, migrated);
    markSaved({ isDemo: !!session.isDemo });
    return true;
  } catch(e) {
    console.warn("Load failed:", e);
    return false;
  }
}

// ─── from interactions/matrixCommands.js (still re-export; 7e-8d-5 inlines) ─
export {
  addInstance,
  updateInstance,
  deleteInstance,
  moveInstance,
  mapAsset,
  unmapAsset,
  proposeCriticalityUpgrades
} from "../interactions/matrixCommands.js";

// ─── from interactions/gapsCommands.js (still re-export; 7e-8d-5 inlines) ───
// setPrimaryLayer + deriveProjectId are already imported above (for
// migrateLegacySession's internal use); re-export the same locals so
// test consumers of this shim get the same symbols. The other gaps-
// commands exports re-export from the v2 module directly until 7e-8d-5
// inlines them too.
export { setPrimaryLayer, deriveProjectId };
export {
  createGap,
  approveGap,
  updateGap,
  deleteGap,
  linkCurrentInstance,
  linkDesiredInstance,
  unlinkCurrentInstance,
  unlinkDesiredInstance,
  setGapDriverId
} from "../interactions/gapsCommands.js";

// ─── from interactions/desiredStateSync.js (still re-export; 7e-8d-5 inlines) ─
export {
  DISPOSITION_ACTIONS,
  ACTION_TO_GAP_TYPE,
  getDesiredCounterpart,
  getCurrentSource,
  buildGapFromDisposition,
  syncGapFromDesired,
  syncDesiredFromGap,
  confirmPhaseOnLink,
  syncGapsFromCurrentCriticality
} from "../interactions/desiredStateSync.js";
