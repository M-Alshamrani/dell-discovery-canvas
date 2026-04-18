// interactions/matrixCommands.js -- ONLY place that mutates session.instances

import { validateInstance } from "../core/models.js";

function uid() { return "inst-" + Math.random().toString(36).slice(2, 9); }

export function addInstance(session, props) {
  // Criticality default: new current instances default to "Low" (SPEC §2.2 + Phase 4).
  // Desired instances never get a criticality default (they use priority instead).
  var defaultCriticality = (props.state === "current" && !props.criticality) ? "Low" : undefined;

  var inst = {
    id:            props.id            || uid(),
    state:         props.state,
    layerId:       props.layerId,
    environmentId: props.environmentId,
    label:         props.label,
    vendor:        props.vendor        || "",
    vendorGroup:   props.vendorGroup   || "custom",
    criticality:   props.criticality   || defaultCriticality,
    priority:      props.priority      || undefined,
    timeline:      props.timeline      || undefined,
    notes:         props.notes         || "",
    originId:      props.originId      || undefined,
    disposition:   props.disposition   || undefined
  };
  // Remove undefined keys for cleanliness
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
  // Remove undefined keys
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
