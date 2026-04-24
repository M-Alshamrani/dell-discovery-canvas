// interactions/gapsCommands.js — ONLY place that mutates session.gaps
//
// v2.4.8 · Phase 17 · enforce the 7-term Action taxonomy's mandatory-link
// rules on reviewed gaps (bypassed for reviewed: false auto-drafts, which
// are mid-workflow). See core/taxonomy.js for the rule table.
//
// v2.4.9 · primary-layer invariant · affectedLayers[0] === layerId is now
// enforced by validateGap. setPrimaryLayer() below is the ONLY safe way to
// change a gap's primary layer — it updates layerId AND reorders/dedupes
// affectedLayers in lockstep. createGap + updateGap call it internally so
// UI callers don't have to remember the rule.
//
// v2.4.9 · explicit projectId · gap.projectId replaces the silent
// env::layer::gapType bucketing that buildProjects used to compute on the
// fly. Every gap is auto-assigned a projectId on create; the migrator
// backfills existing sessions. This makes the Gap→Project relationship
// visible + queryable for the crown-jewel rework (v2.5.0).

import { validateGap } from "../core/models.js";
import { validateActionLinks } from "../core/taxonomy.js";

// v2.4.9 · maintain the primary-layer invariant in one place.
// layerId becomes the first entry of affectedLayers; any subsequent
// duplicate of layerId elsewhere in the array is removed.
export function setPrimaryLayer(gap, layerId) {
  if (!gap || typeof layerId !== "string" || layerId.length === 0) return;
  gap.layerId = layerId;
  var existing = Array.isArray(gap.affectedLayers) ? gap.affectedLayers : [];
  var rest = existing.filter(function(l) { return l !== layerId; });
  gap.affectedLayers = [layerId].concat(rest);
}

// v2.4.9 · derive a deterministic projectId from a gap. Replaces the
// silent bucketing inside services/roadmapService.js buildProjects.
// Two gaps with matching (primary environment, primary layer, gapType)
// land in the same project — same rule as the pre-v2.4.9 key.
export function deriveProjectId(gap) {
  if (!gap) return "unknown::unknown::unknown";
  var env = (Array.isArray(gap.affectedEnvironments) && gap.affectedEnvironments[0])
    || "crossCutting";
  var layer = gap.layerId || "unknown";
  var type = gap.gapType || "null";
  return env + "::" + layer + "::" + type;
}

function uid() { return "gap-" + Math.random().toString(36).slice(2, 9); }

// v2.1 helper: any post-create mutation flips a gap to reviewed.
function markReviewed(gap) { if (gap) gap.reviewed = true; }

export function createGap(session, props) {
  const gap = {
    id:                        props.id || uid(),
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
    status:                    props.status                    || "open",
    // v2.1 · reviewed default: auto-drafted from a disposition (has linked desired + matches
    // buildGapFromDisposition output) passes `reviewed: false` explicitly; everything else
    // defaults to true (manual creation = pre-approved).
    reviewed:                  props.reviewed === false ? false : true
  };
  if (props.driverId) gap.driverId = props.driverId;
  // v2.4.9 · ensure primary-layer invariant holds from creation onward.
  if (gap.layerId) setPrimaryLayer(gap, gap.layerId);
  // v2.4.9 · auto-assign projectId if caller didn't supply one.
  if (!props.projectId && gap.layerId) gap.projectId = deriveProjectId(gap);
  else if (props.projectId)            gap.projectId = props.projectId;
  validateGap(gap);
  validateActionLinks(gap);   // v2.4.8 · Phase 17 (no-op on reviewed:false)
  (session.gaps = session.gaps || []).push(gap);
  return gap;
}

// v2.1 — explicit approval without other edits.
export function approveGap(session, gapId) {
  const gap = (session.gaps || []).find(g => g.id === gapId);
  if (!gap) throw new Error(`approveGap: gap '${gapId}' not found`);
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
  // v2.1 · substantive edits flip the gap to reviewed. (Passing an explicit reviewed: false
  // in patch is respected — that's how approveGap-adjacent workflows could undo if needed.)
  if (patch.reviewed === undefined) updated.reviewed = true;
  // v2.4.9 · if caller changed layerId, re-normalise affectedLayers
  // through setPrimaryLayer so the invariant still holds.
  if (patch.layerId !== undefined) setPrimaryLayer(updated, patch.layerId);
  // v2.4.9 · if layerId / affectedEnvironments / gapType changed, the
  // gap may have moved into a different project. Re-derive unless the
  // caller explicitly set projectId.
  if (patch.projectId === undefined &&
      (patch.layerId !== undefined ||
       patch.affectedEnvironments !== undefined ||
       patch.gapType !== undefined)) {
    updated.projectId = deriveProjectId(updated);
  }
  validateGap(updated);
  validateActionLinks(updated);   // v2.4.8 · Phase 17
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
  markReviewed(gap);
  validateGap(gap);
  return gap;
}

export function linkDesiredInstance(session, gapId, instanceId) {
  const gap = (session.gaps || []).find(g => g.id === gapId);
  if (!gap) throw new Error(`linkDesiredInstance: gap '${gapId}' not found`);
  if (!gap.relatedDesiredInstanceIds.includes(instanceId))
    gap.relatedDesiredInstanceIds.push(instanceId);
  markReviewed(gap);
  validateGap(gap);
  return gap;
}

export function unlinkCurrentInstance(session, gapId, instanceId) {
  const gap = (session.gaps || []).find(g => g.id === gapId);
  if (!gap) throw new Error(`unlinkCurrentInstance: gap '${gapId}' not found`);
  // v2.4.8 · Phase 17 · rationalize dropped from the taxonomy. Kept
  // the same narrow "can't unlink if this gap type requires a current"
  // safety net here; the broader rules live in validateActionLinks.
  const currentTypes = ["enhance","replace","consolidate"];
  const afterRemoval = (gap.relatedCurrentInstanceIds || []).filter(id => id !== instanceId);
  if (currentTypes.includes(gap.gapType) && afterRemoval.length === 0) {
    throw new Error(`Cannot unlink: a '${gap.gapType}' gap requires at least one current technology linked`);
  }
  gap.relatedCurrentInstanceIds = afterRemoval;
  markReviewed(gap);
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
  markReviewed(gap);
  return gap;
}

export function unlinkDesiredInstance(session, gapId, instanceId) {
  const gap = (session.gaps || []).find(g => g.id === gapId);
  if (!gap) throw new Error(`unlinkDesiredInstance: gap '${gapId}' not found`);
  const desiredTypes = ["introduce","enhance","replace","consolidate"];
  const afterRemoval = (gap.relatedDesiredInstanceIds || []).filter(id => id !== instanceId);
  if (desiredTypes.includes(gap.gapType) && afterRemoval.length === 0) {
    throw new Error(`Cannot unlink: a '${gap.gapType}' gap requires at least one desired technology linked`);
  }
  gap.relatedDesiredInstanceIds = afterRemoval;
  markReviewed(gap);
  validateGap(gap);
  return gap;
}
