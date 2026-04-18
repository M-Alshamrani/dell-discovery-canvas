// core/models.js -- validation (simplified: warn don't block on relationships)

import { LAYERS, ENVIRONMENTS } from "./config.js";

export const LayerIds       = LAYERS.map(function(l) { return l.id; });
export const EnvironmentIds = ENVIRONMENTS.map(function(e) { return e.id; });

var VALID_STATES    = ["current", "desired"];
var VALID_PHASES    = ["now", "next", "later"];
var VALID_URGENCY   = ["High", "Medium", "Low"];
var VALID_GAP_TYPES = ["rationalize","enhance","replace","introduce","consolidate","ops"];
var VALID_VG        = ["dell", "nonDell", "custom"];
var VALID_STATUS    = ["open", "in_progress", "closed", "deferred"];

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Validation failed");
}

export function validateInstance(inst) {
  assert(inst && typeof inst === "object",                                  "Instance must be an object");
  assert(typeof inst.id === "string" && inst.id.trim().length > 0,         "Instance.id must be a non-empty string");
  assert(VALID_STATES.includes(inst.state),                                "Instance.state must be 'current' or 'desired'");
  assert(LayerIds.includes(inst.layerId),                                  "Instance.layerId '" + inst.layerId + "' is not a valid layer");
  assert(EnvironmentIds.includes(inst.environmentId),                      "Instance.environmentId '" + inst.environmentId + "' is not a valid environment");
  assert(typeof inst.label === "string" && inst.label.trim().length > 0,   "Instance.label must be a non-empty string");
  if (inst.vendorGroup !== undefined) {
    assert(VALID_VG.includes(inst.vendorGroup),                            "Instance.vendorGroup must be dell, nonDell, or custom");
  }
  // originId and disposition are optional free-form fields -- no validation needed
}

export function validateGap(gap) {
  assert(gap && typeof gap === "object",                                            "Gap must be an object");
  assert(typeof gap.id === "string" && gap.id.trim().length > 0,                   "Gap.id must be a non-empty string");
  assert(typeof gap.description === "string" && gap.description.trim().length > 0, "Gap description must not be empty");
  assert(LayerIds.includes(gap.layerId),                                           "Gap.layerId '" + gap.layerId + "' is not a valid layer");

  if (Array.isArray(gap.affectedLayers)) {
    gap.affectedLayers.forEach(function(l) {
      assert(LayerIds.includes(l), "Gap.affectedLayers contains invalid layer: '" + l + "'");
    });
  }
  if (Array.isArray(gap.affectedEnvironments)) {
    gap.affectedEnvironments.forEach(function(e) {
      assert(EnvironmentIds.includes(e), "Gap.affectedEnvironments contains invalid environment: '" + e + "'");
    });
  }

  var urgency = gap.urgency || "Medium";
  var phase   = gap.phase   || "now";
  assert(VALID_URGENCY.includes(urgency), "Gap.urgency must be High, Medium, or Low");
  assert(VALID_PHASES.includes(phase),    "Gap.phase must be now, next, or later");

  if (gap.gapType) {
    assert(VALID_GAP_TYPES.includes(gap.gapType),
      "Gap.gapType must be one of: " + VALID_GAP_TYPES.join(", "));
  }
  if (gap.status) {
    assert(VALID_STATUS.includes(gap.status),
      "Gap.status must be one of: " + VALID_STATUS.join(", "));
  }

  // NOTE: relationship rules (relatedCurrentInstanceIds, relatedDesiredInstanceIds)
  // are intentionally NOT validated here. They are soft constraints shown as
  // UI warnings, not hard blocks. This prevents frustrating save failures.
}
