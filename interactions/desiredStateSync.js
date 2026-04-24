// interactions/desiredStateSync.js
// Bridges current state -> desired state via disposition workflow
//
// v2.4.8 · Phase 17 · DISPOSITION_ACTIONS + ACTION_TO_GAP_TYPE now come
// from core/taxonomy.js, the single source of truth for the 7-term
// Action table. Keeps the export names stable for back-compat callers
// (MatrixView, tests).

import { LAYERS } from "../core/config.js";
import {
  DISPOSITION_ACTIONS as TAXONOMY_ACTIONS,
  ACTION_TO_GAP_TYPE  as TAXONOMY_ACTION_MAP
} from "../core/taxonomy.js";

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

  var description = sourceInst
    ? label + ": " + sourceInst.label + " [" + layerLabel + "]"
    : label + " " + desiredInst.label + " [" + layerLabel + "]";

  // Phase = priority → now/next/later (SPEC §7.3).
  // Default "next" matches the introduce-default used by the UI.
  var phase = priorityToPhase(desiredInst.priority) || "next";

  // Urgency is STRICT-DERIVED (SPEC §5.2.1 + T3.10/T3.11):
  //   mirror → linked current's criticality
  //   introduce → "Medium"
  var urgency = (sourceInst && sourceInst.criticality) ? sourceInst.criticality : "Medium";

  var currentIds = sourceInst ? [sourceInst.id] : [];
  var desiredIds = [desiredInst.id];

  // ops gap needs non-empty notes (from models) -- prefill
  var notes = action === "ops"
    ? "Operational change: " + description
    : "";

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
    // v2.1 · auto-drafted from a disposition starts unreviewed — surfaces the pulsing dot.
    reviewed:                  false
  };
}

// ---------------------------------------------------------------------------
// Phase 5 sync helpers (SPEC §6.3)
// ---------------------------------------------------------------------------

function priorityToPhase(priority) {
  if (priority === "Now")   return "now";
  if (priority === "Next")  return "next";
  if (priority === "Later") return "later";
  return null;
}

/**
 * Re-derive a linked gap's phase, gapType, and urgency from its source desired
 * instance. Call after mutating `desiredInstance.priority` or `.disposition`.
 * For `keep` disposition, linked gaps are deleted outright — no change = no gap.
 */
export function syncGapFromDesired(session, desiredInstanceId) {
  var desiredInst = (session.instances || []).find(function(i) {
    return i.id === desiredInstanceId && i.state === "desired";
  });
  if (!desiredInst) return;

  var linkedGaps = (session.gaps || []).filter(function(g) {
    return (g.relatedDesiredInstanceIds || []).indexOf(desiredInstanceId) >= 0;
  });

  // Keep disposition → no gap exists for this desired instance.
  if (desiredInst.disposition === "keep") {
    linkedGaps.forEach(function(gap) {
      var idx = session.gaps.indexOf(gap);
      if (idx >= 0) session.gaps.splice(idx, 1);
    });
    return;
  }

  linkedGaps.forEach(function(gap) {
    var newPhase = priorityToPhase(desiredInst.priority);
    if (newPhase) gap.phase = newPhase;

    if (desiredInst.disposition) {
      var newGapType = ACTION_TO_GAP_TYPE[desiredInst.disposition];
      if (newGapType) gap.gapType = newGapType;
    }

    if (desiredInst.originId) {
      var origin = (session.instances || []).find(function(i) { return i.id === desiredInst.originId; });
      if (origin && origin.criticality) gap.urgency = origin.criticality;
    } else {
      gap.urgency = "Medium";
    }
  });
}

/**
 * Reverse sync: when a gap's phase is changed (e.g. by Tab 4 drag-drop),
 * propagate the new phase back to every linked desired instance's `priority`.
 * Keeps "desired priority" and "gap phase" in lockstep — single source of truth
 * (SPEC §7.3 / T4.5).
 */
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

/**
 * v2.1 · Inspect what would happen if a desired instance were linked to a gap.
 * Returns either `{ status: "ok" }` (phases already match) or
 * `{ status: "conflict", currentPriority, targetPriority, desiredLabel, gapPhase }`
 * so the caller can raise a confirmation modal. Does not mutate.
 */
export function confirmPhaseOnLink(session, gapId, desiredInstanceId) {
  var gap = (session.gaps || []).find(function(g) { return g.id === gapId; });
  var des = (session.instances || []).find(function(i) {
    return i.id === desiredInstanceId && i.state === "desired";
  });
  if (!gap || !des) return { status: "ok" };  // no-op caller still links

  var phaseToPriority = { now: "Now", next: "Next", later: "Later" };
  var targetPriority = phaseToPriority[gap.phase];

  // Accept when tile has no priority yet OR priorities already match.
  if (!des.priority || des.priority === targetPriority) return { status: "ok" };

  return {
    status:          "conflict",
    currentPriority: des.priority,
    targetPriority:  targetPriority,
    desiredLabel:    des.label,
    gapPhase:        gap.phase
  };
}

/**
 * Re-derive urgency of every gap linked to a given current instance. Call
 * after mutating `currentInstance.criticality`.
 */
export function syncGapsFromCurrentCriticality(session, currentInstanceId) {
  var curInst = (session.instances || []).find(function(i) {
    return i.id === currentInstanceId && i.state === "current";
  });
  if (!curInst || !curInst.criticality) return;

  (session.gaps || []).forEach(function(gap) {
    if ((gap.relatedCurrentInstanceIds || []).indexOf(currentInstanceId) >= 0) {
      gap.urgency = curInst.criticality;
    }
  });
}
