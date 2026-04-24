// interactions/gapsCommands.js — ONLY place that mutates session.gaps
//
// v2.4.8 · Phase 17 · enforce the 7-term Action taxonomy's mandatory-link
// rules on reviewed gaps (bypassed for reviewed: false auto-drafts, which
// are mid-workflow). See core/taxonomy.js for the rule table.

import { validateGap } from "../core/models.js";
import { validateActionLinks } from "../core/taxonomy.js";

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
