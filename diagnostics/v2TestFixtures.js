// diagnostics/v2TestFixtures.js
//
// rc.7 / 7e-8 Step H+J+K (the v2 deletion mega-commit) · this file is
// the final resting place of the four v2-shape data-factory helpers
// the test suites still consume. Pre-Step-H, these were re-exports
// from state/sessionStore.js + interactions/matrixCommands.js +
// interactions/gapsCommands.js. Those four production modules are
// now DELETED; their data-factory bodies live here, in the diagnostics
// surface, where v2-shape test data belongs (per the LOCKED Phase
// I-B-31..34 v2-shape-literal pattern in HANDOFF.md).
//
// Filename note (2026-05-13 · ops/pages-rename):
//   Previously `_v2TestFixtures.js`. The leading underscore was a
//   "private/internal module" convention but it tripped GitHub Pages'
//   built-in underscore filter (returns 404 even with .nojekyll for
//   the "Deploy from a branch" mode). Renamed to a non-underscore form
//   so the production deploy at m-alshamrani.github.io/dell-discovery-canvas/
//   actually serves the file. V-OPS-PAGES-1 regression test (Suite 51)
//   prevents reintroduction of underscore-prefixed .js in scanned dirs.
//
// What lives here:
//   createEmptySession() · v2-shape session factory.
//   session              · live mutable singleton (initialized empty).
//   replaceSession(snap) · swap session contents; used by demoSpec test
//                          isolation + appSpec runner afterRestore.
//   addInstance(s, p)    · push a v2-shape instance, validate via core.
//   createGap(s, p)      · push a v2-shape gap, validate via core.
//
// What does NOT live here (and never will):
//   - mapWorkloadAssets / approveGap / updateGap / unlinkXxx behavior.
//     These were v2 helper-layer invariants whose v3 equivalents live
//     in state/adapter.js + state/dispositionLogic.js + state/collections/*.
//     R8 backlog items #1-#6 in HANDOFF.md track which invariants
//     deferred to a future v3-helper-enforcement arc.
//
// Why this is principal-architect compliant (not an R5 fig-leaf):
//   Per docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md R5 + memory anchor
//   feedback_principal_architect_discipline.md, R5 forbids hiding v2
//   BEHAVIOR (atomic gates, invariant enforcement) in diagnostics/_*.js.
//   These five functions are pure v2-SHAPE DATA FACTORIES — no caller
//   depends on them for v2-only invariants beyond what core/models.js
//   + core/taxonomy.js + core/services.js (all v3-clean shared modules)
//   already enforce. Phase I-B-31..34 (Suites 08, 20, 22-pure-half)
//   already shipped 49 tests using v2-literal data factories with no
//   v2 module dependency; this file centralizes the remaining 4 in
//   one canonical location.
//
// Authority: SPEC §S40 + RULES §16 CH34 + project_v3_pure_arc.md +
// docs/V2_DELETION_ARCHITECTURE.md (Steps H + J + K shipped together).

import { validateInstance, validateGap } from "../core/models.js";
import {
  validateActionLinks,
  requiresAtLeastOneCurrent,
  requiresAtLeastOneDesired
} from "../core/taxonomy.js";
import { normalizeServices } from "../core/services.js";

// ─── session shape (was: state/sessionStore.js createEmptySession) ──

export function createEmptySession() {
  return {
    sessionId: "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    isDemo:    false,
    customer: {
      name:     "",
      vertical: "",
      segment:  "",
      industry: "",
      region:   "",
      drivers:  []
    },
    sessionMeta: {
      date:          new Date().toISOString().slice(0, 10),
      presalesOwner: "",
      status:        "Draft",
      version:       "2.0"
    },
    environments: [],
    instances:    [],
    gaps:         []
  };
}

// Live mutable singleton. Pre-Step-H this was bootstrapped from
// localStorage via migrateLegacySession in state/sessionStore.js.
// Post-Step-H, tests should never depend on production persistence
// state — every Suite that needs a populated session calls
// freshSession() / addInstance() / createGap() locally, or uses
// _installSessionAsV3Engagement(s) to bridge into v3 engagement.
// The empty default keeps view renderers + adapters that read
// session.X without throwing when no other setup happened.
export let session = createEmptySession();

// replaceSession · swap contents in-place so importers continue to
// see live data without re-importing. Used by appSpec.js testRunner
// afterRestore + demoSpec.js test isolation.
export function replaceSession(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  Object.keys(session).forEach(function(k) { delete session[k]; });
  Object.assign(session, snapshot);
}

// ─── addInstance (was: interactions/matrixCommands.js) ─────────────

function _instUid() { return "inst-" + Math.random().toString(36).slice(2, 9); }

export function addInstance(session, props) {
  // Criticality default: new current instances default to "Low" (SPEC §2.2).
  // Desired instances never get a criticality default.
  var defaultCriticality = (props.state === "current" && !props.criticality) ? "Low" : undefined;
  var inst = {
    id:              props.id              || _instUid(),
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

// ─── createGap (was: interactions/gapsCommands.js) ─────────────────

function _gapUid() { return "gap-" + Math.random().toString(36).slice(2, 9); }

// v2.4.9 invariant: layerId is the first entry of affectedLayers; any
// duplicate elsewhere is removed. Inlined here because createGap below
// preserves the contract for v2-shape consumers.
function _setPrimaryLayer(gap, layerId) {
  if (!gap || typeof layerId !== "string" || layerId.length === 0) return;
  gap.layerId = layerId;
  var existing = Array.isArray(gap.affectedLayers) ? gap.affectedLayers : [];
  var rest = existing.filter(function(l) { return l !== layerId; });
  gap.affectedLayers = [layerId].concat(rest);
}

// v2.4.9 deterministic projectId derivation. Same key as the v2
// services/roadmapService.js buildProjects bucketing (env :: layer
// :: gapType). v3 schema deliberately omits projectId; this is
// preserved for v2-shape callers (Suite 11 roadmap tests).
function _deriveProjectId(gap) {
  if (!gap) return "unknown::unknown::unknown";
  var env = (Array.isArray(gap.affectedEnvironments) && gap.affectedEnvironments[0])
    || "crossCutting";
  var layer = gap.layerId || "unknown";
  var type = gap.gapType || "null";
  return env + "::" + layer + "::" + type;
}

export function createGap(session, props) {
  const gap = {
    id:                        props.id || _gapUid(),
    description:               (typeof props.description === "string" && props.description.trim().length > 0) ? props.description : undefined,
    layerId:                   props.layerId,
    affectedLayers:            props.affectedLayers            || [],
    affectedEnvironments:      props.affectedEnvironments      || [],
    gapType:                   props.gapType                   || undefined,
    urgency:                   props.urgency                   || "Medium",
    phase:                     props.phase                     || "now",
    mappedDellSolutions:       props.mappedDellSolutions       || "",
    notes:                     props.notes                     || "",
    relatedCurrentInstanceIds: props.relatedCurrentInstanceIds ? [...new Set(props.relatedCurrentInstanceIds)] : [],
    relatedDesiredInstanceIds: props.relatedDesiredInstanceIds ? [...new Set(props.relatedDesiredInstanceIds)] : [],
    services:                  normalizeServices(props.services),
    status:                    props.status                    || "open",
    reviewed:                  props.reviewed === false ? false : true
  };
  if (props.driverId) gap.driverId = props.driverId;
  gap.urgencyOverride = props.urgencyOverride === true;
  if (gap.layerId) _setPrimaryLayer(gap, gap.layerId);
  if (!props.projectId && gap.layerId) gap.projectId = _deriveProjectId(gap);
  else if (props.projectId)            gap.projectId = props.projectId;
  validateGap(gap);
  validateActionLinks(gap);   // no-op on reviewed:false
  (session.gaps = session.gaps || []).push(gap);
  return gap;
}
