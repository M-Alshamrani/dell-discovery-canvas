// diagnostics/_v2TestFixtures.js
//
// rc.7 / 7e-8b..d · Test-only consolidation file for all v2 fixture
// builders. Single import surface for `diagnostics/appSpec.js`.
//
// rc.7 / 7e-8d-4: state/sessionStore.js DELETED. Pure helpers
//                  (createEmptySession + migrateLegacySession +
//                  isFreshSession + the IIFE-initialized session
//                  singleton) inlined here.
// rc.7 / 7e-8d-5 (THIS COMMIT): the 3 interaction modules
//                  (matrixCommands + gapsCommands + desiredStateSync)
//                  DELETED. Function bodies inlined here.
//
// Why this is safe per RULES §16 CH34:
//   - V-ANTI-V2-IMPORT-1 + V-ANTI-V2-IMPORT-2 (production source-grep
//     tests) scope themselves to PRODUCTION files. _v2TestFixtures.js
//     lives in `diagnostics/`, not production. Neither test trips.
//   - V-FLOW-V3-PURE-1/2/3/4/5 source-grep for the v2 file paths at
//     HTTP HEAD. All 5 paths now 404. **All 5 GREEN.**
//
// Authority: SPEC §S40 + RULES §16 CH34 + project_v3_pure_arc.md.

// ─── shared imports ────────────────────────────────────────────────
import { LEGACY_DRIVER_LABEL_TO_ID, LAYERS } from "../core/config.js";
import { createDemoSession as createDemoSessionImpl } from "../state/demoSession.js";
import { emitSessionChanged } from "../core/sessionEvents.js";
import { clear as clearAiUndoStack } from "../state/aiUndoStack.js";
import { normalizeServices } from "../core/services.js";
import { markSaved } from "../core/saveStatus.js";
import { validateInstance, validateGap } from "../core/models.js";
import {
  DISPOSITION_ACTIONS as TAXONOMY_ACTIONS,
  ACTION_TO_GAP_TYPE  as TAXONOMY_ACTION_MAP,
  validateActionLinks,
  requiresAtLeastOneCurrent,
  requiresAtLeastOneDesired
} from "../core/taxonomy.js";

// Re-export createDemoSession so tests that pulled it from sessionStore
// keep working without changing their import.
export { createDemoSession } from "../state/demoSession.js";

// ═══════════════════════════════════════════════════════════════════
// === FROM state/sessionStore.js (deleted in 7e-8d-4) ===============
// ═══════════════════════════════════════════════════════════════════

// ─── createEmptySession (PURE) ─────────────────────────────────────
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

  s.gaps.forEach(function(g) {
    if (typeof g.reviewed !== "boolean") {
      g.reviewed = !((g.relatedDesiredInstanceIds || []).length > 0);
    }
  });

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

// ═══════════════════════════════════════════════════════════════════
// === FROM interactions/matrixCommands.js (deleted in 7e-8d-5) ======
// ═══════════════════════════════════════════════════════════════════

function _mxUid() { return "inst-" + Math.random().toString(36).slice(2, 9); }

export function addInstance(session, props) {
  var defaultCriticality = (props.state === "current" && !props.criticality) ? "Low" : undefined;
  var inst = {
    id:              props.id              || _mxUid(),
    state:           props.state,
    layerId:         props.layerId,
    environmentId:   props.environmentId,
    label:           props.label,
    vendor:          props.vendor          || "",
    vendorGroup:     props.vendorGroup     || "custom",
    criticality:     props.criticality     || defaultCriticality,
    priority:        props.priority        || undefined,
    timeline:        props.timeline        || undefined,
    notes:           props.notes           || "",
    originId:        props.originId        || undefined,
    disposition:     props.disposition     || undefined,
    mappedAssetIds:  props.mappedAssetIds  || undefined
  };
  Object.keys(inst).forEach(function(k) { if (inst[k] === undefined) delete inst[k]; });
  validateInstance(inst);
  (session.instances = session.instances || []).push(inst);
  return inst;
}

export function updateInstance(session, instanceId, patch) {
  var list = session.instances || [];
  var idx  = list.findIndex(function(i) { return i.id === instanceId; });
  if (idx === -1) throw new Error("Instance '" + instanceId + "' not found");
  var updated = Object.assign({}, list[idx], patch);
  Object.keys(updated).forEach(function(k) { if (updated[k] === undefined) delete updated[k]; });
  validateInstance(updated);
  list[idx] = updated;
  return updated;
}

export function deleteInstance(session, instanceId) {
  var list = session.instances || [];
  var idx  = list.findIndex(function(i) { return i.id === instanceId; });
  if (idx === -1) throw new Error("Instance '" + instanceId + "' not found");
  list.splice(idx, 1);
}

export function moveInstance(session, instanceId, move) {
  var patch = {};
  if (move && move.newLayerId)       patch.layerId       = move.newLayerId;
  if (move && move.newEnvironmentId) patch.environmentId = move.newEnvironmentId;
  if (move && move.newState)         patch.state         = move.newState;
  return updateInstance(session, instanceId, patch);
}

function _mxFindInstance(session, id, label) {
  var inst = (session.instances || []).find(function(i) { return i.id === id; });
  if (!inst) throw new Error(label + ": instance '" + id + "' not found");
  return inst;
}

export function mapAsset(session, workloadId, assetId) {
  if (workloadId === assetId) throw new Error("mapAsset: a workload cannot map to itself");
  var workload = _mxFindInstance(session, workloadId, "mapAsset");
  var asset    = _mxFindInstance(session, assetId,    "mapAsset");
  if (workload.layerId !== "workload") {
    throw new Error("mapAsset: source '" + workload.label + "' is not a workload-layer instance");
  }
  if (asset.layerId === "workload") {
    throw new Error("mapAsset: target '" + asset.label + "' is also a workload — workloads only map to infrastructure layers");
  }
  if (asset.state !== workload.state) {
    throw new Error("mapAsset: state mismatch — " + workload.state + " workload cannot map a " + asset.state + " asset");
  }
  if (asset.environmentId !== workload.environmentId) {
    throw new Error("mapAsset: environment mismatch — workload is in " +
      workload.environmentId + ", asset is in " + asset.environmentId +
      ". Create a separate workload tile in '" + asset.environmentId +
      "' to model hybrid deployments.");
  }
  workload.mappedAssetIds = workload.mappedAssetIds || [];
  if (workload.mappedAssetIds.indexOf(assetId) < 0) workload.mappedAssetIds.push(assetId);
  validateInstance(workload);
  return workload;
}

export function unmapAsset(session, workloadId, assetId) {
  var workload = _mxFindInstance(session, workloadId, "unmapAsset");
  workload.mappedAssetIds = (workload.mappedAssetIds || []).filter(function(id) { return id !== assetId; });
  validateInstance(workload);
  return workload;
}

export function proposeCriticalityUpgrades(session, workloadId) {
  var CRIT_RANK = { Low: 1, Medium: 2, High: 3 };
  var workload = _mxFindInstance(session, workloadId, "proposeCriticalityUpgrades");
  if (workload.layerId !== "workload") {
    throw new Error("proposeCriticalityUpgrades: '" + workload.label + "' is not a workload-layer instance");
  }
  var workloadRank = CRIT_RANK[workload.criticality] || 0;
  if (!workloadRank) return [];
  var proposals = [];
  (workload.mappedAssetIds || []).forEach(function(assetId) {
    var asset = (session.instances || []).find(function(i) { return i.id === assetId; });
    if (!asset) return;
    var assetRank = CRIT_RANK[asset.criticality] || 0;
    if (assetRank < workloadRank) {
      proposals.push({
        assetId:        asset.id,
        label:          asset.label,
        layerId:        asset.layerId,
        currentCrit:    asset.criticality || null,
        newCrit:        workload.criticality
      });
    }
  });
  return proposals;
}

// ═══════════════════════════════════════════════════════════════════
// === FROM interactions/desiredStateSync.js (deleted in 7e-8d-5) ====
// (Inlined BEFORE gapsCommands because gapsCommands references
//  confirmPhaseOnLink. JS hoisting handles this for `function`
//  declarations either way; ordering is for readability.)
// ═══════════════════════════════════════════════════════════════════

export var DISPOSITION_ACTIONS = TAXONOMY_ACTIONS;
export var ACTION_TO_GAP_TYPE  = TAXONOMY_ACTION_MAP;

export function getDesiredCounterpart(session, currentInstanceId) {
  return (session.instances || []).find(function(i) {
    return i.state === "desired" && i.originId === currentInstanceId;
  });
}

export function getCurrentSource(session, desiredInstance) {
  if (!desiredInstance || !desiredInstance.originId) return null;
  return (session.instances || []).find(function(i) {
    return i.id === desiredInstance.originId;
  });
}

function _dssPriorityToPhase(priority) {
  if (priority === "Now")   return "now";
  if (priority === "Next")  return "next";
  if (priority === "Later") return "later";
  return null;
}

export function buildGapFromDisposition(session, desiredInst) {
  var action  = desiredInst && desiredInst.disposition;
  var gapType = ACTION_TO_GAP_TYPE[action];
  if (gapType === null || gapType === undefined) return null;

  var sourceInst = getCurrentSource(session, desiredInst);

  var layerLabel = "";
  if (typeof LAYERS !== "undefined") {
    var found = LAYERS.find(function(l) { return l.id === desiredInst.layerId; });
    layerLabel = found ? found.label : desiredInst.layerId;
  } else {
    layerLabel = desiredInst.layerId;
  }

  var actionLabel = DISPOSITION_ACTIONS.find(function(a) { return a.id === action; });
  var label = actionLabel ? actionLabel.label : action;

  var description;
  if (sourceInst && desiredInst.label && desiredInst.label !== sourceInst.label) {
    description = label + " " + sourceInst.label + " → " + desiredInst.label + " [" + layerLabel + "]";
  } else if (sourceInst) {
    description = label + ": " + sourceInst.label + " [" + layerLabel + "]";
  } else {
    description = label + " " + desiredInst.label + " [" + layerLabel + "]";
  }

  var phase = _dssPriorityToPhase(desiredInst.priority) || "next";
  var urgency = (sourceInst && sourceInst.criticality) ? sourceInst.criticality : "Medium";

  var currentIds = sourceInst ? [sourceInst.id] : [];
  var desiredIds = [desiredInst.id];

  var notes;
  if (action === "ops") {
    notes = "Operational / services work: " + description;
  } else if (action === "introduce") {
    notes = "Net-new: " + desiredInst.label + ". No current technology to replace.";
  } else if (sourceInst) {
    notes = "From workshop: " + label + " " + sourceInst.label;
    if (desiredInst.label && desiredInst.label !== sourceInst.label) {
      notes += " → " + desiredInst.label;
    }
    notes += ".";
  } else {
    notes = "From workshop: " + label + " " + desiredInst.label + ".";
  }

  return {
    description:               description,
    layerId:                   desiredInst.layerId,
    affectedLayers:            [],
    affectedEnvironments:      desiredInst.environmentId ? [desiredInst.environmentId] : [],
    gapType:                   gapType,
    urgency:                   urgency,
    phase:                     phase,
    mappedDellSolutions:       "",
    notes:                     notes,
    relatedCurrentInstanceIds: currentIds,
    relatedDesiredInstanceIds: desiredIds,
    status:                    "open",
    reviewed:                  false
  };
}

export function syncGapFromDesired(session, desiredInstanceId) {
  var desiredInst = (session.instances || []).find(function(i) {
    return i.id === desiredInstanceId && i.state === "desired";
  });
  if (!desiredInst) return;

  var linkedGaps = (session.gaps || []).filter(function(g) {
    return (g.relatedDesiredInstanceIds || []).indexOf(desiredInstanceId) >= 0;
  });

  if (desiredInst.disposition === "keep") {
    linkedGaps.forEach(function(gap) {
      if (gap.status === "closed") return;
      gap.status = "closed";
      gap.closeReason = "auto: disposition changed to keep on " + (desiredInst.label || desiredInst.id);
      gap.closedAt = new Date().toISOString();
    });
    return;
  }

  linkedGaps.forEach(function(gap) {
    var newPhase = _dssPriorityToPhase(desiredInst.priority);
    if (newPhase) gap.phase = newPhase;

    if (desiredInst.disposition) {
      var newGapType = ACTION_TO_GAP_TYPE[desiredInst.disposition];
      if (newGapType) gap.gapType = newGapType;
    }

    if (gap.urgencyOverride === true) return;

    if (desiredInst.originId) {
      var origin = (session.instances || []).find(function(i) { return i.id === desiredInst.originId; });
      if (origin && origin.criticality) gap.urgency = origin.criticality;
    } else {
      gap.urgency = "Medium";
    }
  });
}

export function syncDesiredFromGap(session, gapId) {
  var gap = (session.gaps || []).find(function(g) { return g.id === gapId; });
  if (!gap) return;
  var phaseToPriority = { now: "Now", next: "Next", later: "Later" };
  var targetPriority = phaseToPriority[gap.phase];
  if (!targetPriority) return;
  (gap.relatedDesiredInstanceIds || []).forEach(function(desId) {
    var des = (session.instances || []).find(function(i) {
      return i.id === desId && i.state === "desired";
    });
    if (des) des.priority = targetPriority;
  });
}

export function confirmPhaseOnLink(session, gapId, desiredInstanceId) {
  var gap = (session.gaps || []).find(function(g) { return g.id === gapId; });
  var des = (session.instances || []).find(function(i) {
    return i.id === desiredInstanceId && i.state === "desired";
  });
  if (!gap || !des) return { status: "ok" };
  var phaseToPriority = { now: "Now", next: "Next", later: "Later" };
  var targetPriority = phaseToPriority[gap.phase];
  if (!des.priority || des.priority === targetPriority) return { status: "ok" };
  return {
    status:          "conflict",
    currentPriority: des.priority,
    targetPriority:  targetPriority,
    desiredLabel:    des.label,
    gapPhase:        gap.phase
  };
}

export function syncGapsFromCurrentCriticality(session, currentInstanceId) {
  var curInst = (session.instances || []).find(function(i) {
    return i.id === currentInstanceId && i.state === "current";
  });
  if (!curInst || !curInst.criticality) return;
  (session.gaps || []).forEach(function(gap) {
    if ((gap.relatedCurrentInstanceIds || []).indexOf(currentInstanceId) >= 0) {
      if (gap.urgencyOverride === true) return;
      gap.urgency = curInst.criticality;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// === FROM interactions/gapsCommands.js (deleted in 7e-8d-5) ========
// ═══════════════════════════════════════════════════════════════════

export function setPrimaryLayer(gap, layerId) {
  if (!gap || typeof layerId !== "string" || layerId.length === 0) return;
  gap.layerId = layerId;
  var existing = Array.isArray(gap.affectedLayers) ? gap.affectedLayers : [];
  var rest = existing.filter(function(l) { return l !== layerId; });
  gap.affectedLayers = [layerId].concat(rest);
}

export function deriveProjectId(gap) {
  if (!gap) return "unknown::unknown::unknown";
  var env = (Array.isArray(gap.affectedEnvironments) && gap.affectedEnvironments[0])
    || "crossCutting";
  var layer = gap.layerId || "unknown";
  var type = gap.gapType || "null";
  return env + "::" + layer + "::" + type;
}

function _gpUid() { return "gap-" + Math.random().toString(36).slice(2, 9); }
function _gpMarkReviewed(gap) { if (gap) gap.reviewed = true; }

export function createGap(session, props) {
  const gap = {
    id:                        props.id || _gpUid(),
    description:               (typeof props.description === 'string' && props.description.trim().length > 0) ? props.description : undefined,
    layerId:                   props.layerId,
    affectedLayers:            props.affectedLayers            || [],
    affectedEnvironments:      props.affectedEnvironments      || [],
    gapType:                   props.gapType                   || undefined,
    urgency:                   props.urgency                   || "Medium",
    phase:                     props.phase                     || "now",
    mappedDellSolutions:       props.mappedDellSolutions       || "",
    notes:                     props.notes                     || "",
    relatedCurrentInstanceIds: props.relatedCurrentInstanceIds ? [...new Set(props.relatedCurrentInstanceIds)] : [],
    relatedDesiredInstanceIds: props.relatedDesiredInstanceIds  ? [...new Set(props.relatedDesiredInstanceIds)]  : [],
    services:                  normalizeServices(props.services),
    status:                    props.status                    || "open",
    reviewed:                  props.reviewed === false ? false : true
  };
  if (props.driverId) gap.driverId = props.driverId;
  gap.urgencyOverride = props.urgencyOverride === true;
  if (gap.layerId) setPrimaryLayer(gap, gap.layerId);
  if (!props.projectId && gap.layerId) gap.projectId = deriveProjectId(gap);
  else if (props.projectId)            gap.projectId = props.projectId;
  validateGap(gap);
  validateActionLinks(gap);
  (session.gaps = session.gaps || []).push(gap);
  return gap;
}

export function approveGap(session, gapId) {
  const gap = (session.gaps || []).find(g => g.id === gapId);
  if (!gap) throw new Error(`approveGap: gap '${gapId}' not found`);
  const probe = Object.assign({}, gap, { reviewed: true });
  validateActionLinks(probe);
  gap.reviewed = true;
  return gap;
}

export function updateGap(session, gapId, patch) {
  const list = session.gaps || [];
  const idx  = list.findIndex(g => g.id === gapId);
  if (idx === -1) throw new Error(`updateGap: gap '${gapId}' not found`);
  const updated = { ...list[idx], ...patch };
  if (patch.relatedCurrentInstanceIds) updated.relatedCurrentInstanceIds = [...new Set(patch.relatedCurrentInstanceIds)];
  if (patch.relatedDesiredInstanceIds)  updated.relatedDesiredInstanceIds  = [...new Set(patch.relatedDesiredInstanceIds)];
  if (patch.services !== undefined) updated.services = normalizeServices(patch.services);

  var STRUCTURAL_FIELDS = [
    "gapType", "layerId", "affectedLayers", "affectedEnvironments",
    "relatedCurrentInstanceIds", "relatedDesiredInstanceIds"
  ];
  var hasStructuralPatch = STRUCTURAL_FIELDS.some(function(f) { return patch[f] !== undefined; });

  if (patch.reviewed === true || patch.reviewed === false) {
    updated.reviewed = patch.reviewed;
  } else if (hasStructuralPatch) {
    var probe = Object.assign({}, updated, { reviewed: true });
    try {
      validateActionLinks(probe);
      updated.reviewed = true;
    } catch (e) {
      if (typeof updated.reviewed !== "boolean") updated.reviewed = false;
    }
  }

  if (patch.layerId !== undefined) setPrimaryLayer(updated, patch.layerId);
  if (patch.projectId === undefined &&
      (patch.layerId !== undefined ||
       patch.affectedEnvironments !== undefined ||
       patch.gapType !== undefined)) {
    updated.projectId = deriveProjectId(updated);
  }
  validateGap(updated);
  var shouldValidateLinks =
    (patch.reviewed === true) ||
    (hasStructuralPatch && updated.reviewed === true);
  if (shouldValidateLinks) validateActionLinks(updated);
  list[idx] = updated;
  return updated;
}

export function deleteGap(session, gapId) {
  const list = session.gaps || [];
  const idx  = list.findIndex(g => g.id === gapId);
  if (idx === -1) throw new Error(`deleteGap: gap '${gapId}' not found`);
  list.splice(idx, 1);
}

export function linkCurrentInstance(session, gapId, instanceId) {
  const gap = (session.gaps || []).find(g => g.id === gapId);
  if (!gap) throw new Error(`linkCurrentInstance: gap '${gapId}' not found`);
  if (!gap.relatedCurrentInstanceIds.includes(instanceId))
    gap.relatedCurrentInstanceIds.push(instanceId);
  _gpMarkReviewed(gap);
  validateGap(gap);
  return gap;
}

export function linkDesiredInstance(session, gapId, instanceId, opts) {
  const gap = (session.gaps || []).find(g => g.id === gapId);
  if (!gap) throw new Error(`linkDesiredInstance: gap '${gapId}' not found`);
  const conflict = confirmPhaseOnLink(session, gapId, instanceId);
  if (conflict && conflict.status === "conflict" && !(opts && opts.acknowledged === true)) {
    const e = new Error(
      `Linking '${conflict.desiredLabel}' (${conflict.currentPriority}) to a gap in phase '${conflict.gapPhase}' will change the tile's priority to '${conflict.targetPriority}'. ` +
      `Confirm in the UI, then re-call with { acknowledged: true }.`
    );
    e.code = "PHASE_CONFLICT_NEEDS_ACK";
    e.conflict = conflict;
    throw e;
  }
  if (!gap.relatedDesiredInstanceIds.includes(instanceId))
    gap.relatedDesiredInstanceIds.push(instanceId);
  _gpMarkReviewed(gap);
  validateGap(gap);
  return gap;
}

export function unlinkCurrentInstance(session, gapId, instanceId) {
  const gap = (session.gaps || []).find(g => g.id === gapId);
  if (!gap) throw new Error(`unlinkCurrentInstance: gap '${gapId}' not found`);
  const afterRemoval = (gap.relatedCurrentInstanceIds || []).filter(id => id !== instanceId);
  if (requiresAtLeastOneCurrent(gap.gapType) && afterRemoval.length === 0) {
    throw new Error(`Cannot unlink: a '${gap.gapType}' gap requires at least one current technology linked`);
  }
  gap.relatedCurrentInstanceIds = afterRemoval;
  _gpMarkReviewed(gap);
  validateGap(gap);
  return gap;
}

export function setGapDriverId(session, gapId, driverId) {
  const gap = (session.gaps || []).find(g => g.id === gapId);
  if (!gap) throw new Error(`setGapDriverId: gap '${gapId}' not found`);
  if (driverId === null || driverId === "" || driverId === undefined) {
    delete gap.driverId;
  } else {
    gap.driverId = driverId;
  }
  _gpMarkReviewed(gap);
  return gap;
}

export function unlinkDesiredInstance(session, gapId, instanceId) {
  const gap = (session.gaps || []).find(g => g.id === gapId);
  if (!gap) throw new Error(`unlinkDesiredInstance: gap '${gapId}' not found`);
  const afterRemoval = (gap.relatedDesiredInstanceIds || []).filter(id => id !== instanceId);
  if (requiresAtLeastOneDesired(gap.gapType) && afterRemoval.length === 0) {
    throw new Error(`Cannot unlink: a '${gap.gapType}' gap requires at least one desired technology linked`);
  }
  gap.relatedDesiredInstanceIds = afterRemoval;
  _gpMarkReviewed(gap);
  validateGap(gap);
  return gap;
}
