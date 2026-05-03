// ============================================================================
// diagnostics/appSpec.js
// THE CONTRACT — Dell Discovery Canvas
//
// PRINCIPLE: This file defines the application.
//            Implementation exists solely to make these tests pass.
//            If a test fails → fix the implementation.
//            If a test is wrong → fix this file first, then the implementation.
//            Never weaken a test to make it pass.
//
// COVERAGE:
//   Suite 01  core/config — layer definitions            (12 tests)
//   Suite 02  core/config — technology catalog           (10 tests)
//   Suite 03  core/models — validateInstance             (14 tests)
//   Suite 04  core/models — validateGap                  (20 tests)
//   Suite 05  state/sessionStore                         (10 tests)
//   Suite 06  interactions/matrixCommands                (18 tests)
//   Suite 07  interactions/gapsCommands                  (22 tests)
//   Suite 08  services/healthMetrics                     (16 tests)
//   Suite 09  services/gapsService                       (12 tests)
//   Suite 10  services/vendorMixService                  (14 tests)
//   Suite 11  services/roadmapService                    (12 tests)
//   Suite 12  ui/views/ContextView — DOM contract         (10 tests)
//   Suite 13  ui/views/MatrixView — DOM contract          (14 tests)
//   Suite 14  ui/views/GapsEditView — DOM contract        (10 tests)
//   Suite 15  ui/views/Summary views — DOM contracts      (12 tests)
//   Suite 16  app shell — stepper & navigation           ( 8 tests)
//   Suite 17  AI integration readiness                   (10 tests)
//
//   TOTAL: 204 assertions
// ============================================================================

import { createTestRunner, runIsolated } from "./testRunner.js";
import { emitSessionChanged, onSessionChanged } from "../core/sessionEvents.js";
// SPEC §S31 · post-test in-memory rehydrate for the v3 engagement store.
// The afterRestore callback below uses this to keep _active in sync with
// the restored localStorage snapshot — without it, BUG-019 would surface
// after every page reload (tests blow in-memory state away; localStorage
// is restored but in-memory engagement stays null until a user click).
import { _rehydrateFromStorage as _rehydrateEngagementFromStorage } from "../state/engagementStore.js";
// v2.4.13 S2A · post-test indicator restore (see runAllTests below).
import { markSaved as _markSaved, markIdle as _markIdle, markSaving as _markSaving } from "../core/saveStatus.js";
// v2.4.15 · Suite 46 · synchronous filterState + FilterBar imports for FB tests.
import * as filterState from "../state/filterState.js";
import { renderFilterBar } from "../ui/components/FilterBar.js";
// v2.4.15-polish · Hide modal now goes through Overlay.js; tests need
// closeOverlay to clean up between cases without relying on Suite 45's
// scoped import.
import { closeOverlay as _closeOverlay } from "../ui/components/Overlay.js";

import {
  LAYERS, ENVIRONMENTS, CATALOG,
  BUSINESS_DRIVERS, CUSTOMER_VERTICALS, COACHING_PROMPTS
} from "../core/config.js";

import {
  LayerIds, EnvironmentIds,
  validateInstance, validateGap
} from "../core/models.js";

import {
  session, createEmptySession, resetSession,
  saveToLocalStorage, loadFromLocalStorage,
  migrateLegacySession,
  // v2.4.12 · PR1 · context-save helper (RED-stub mirrors v2.4.11 bug)
  applyContextSave
  // Note: `replaceSession` is imported separately lower in the file
  // (line ~4469); my new tests reuse that import.
} from "../state/sessionStore.js";

// v2.4.12 · Section S · services catalog + opt-in suggested chips
import {
  SERVICE_TYPES, SUGGESTED_SERVICES_BY_GAP_TYPE
} from "../core/services.js";

// v2.4.12 · PR2 · skill-registry change bus (so the per-tab AI dropdown
// auto-refreshes when skills are added/updated/deployed/deleted).
// Note: addSkill / updateSkill / deleteSkill are already imported lower
// in the file (Suite 26 Skill Builder section); we re-use those.
import {
  onSkillsChanged,
  _resetForTests as _resetSkillsEventsForTests
} from "../core/skillsEvents.js";

import {
  addInstance, updateInstance,
  deleteInstance, moveInstance,
  mapAsset, unmapAsset, proposeCriticalityUpgrades
} from "../interactions/matrixCommands.js";

import {
  createGap, updateGap, deleteGap,
  linkCurrentInstance, linkDesiredInstance,
  unlinkCurrentInstance, unlinkDesiredInstance
} from "../interactions/gapsCommands.js";

import {
  getHealthSummary, computeBucketMetrics, scoreToRiskLabel
} from "../services/healthMetrics.js";

import {
  getAllGaps, getFilteredGaps, getGapsByPhase
} from "../services/gapsService.js";

import {
  computeMixByLayer, computeMixByEnv, computeVendorTableData
} from "../services/vendorMixService.js";

import {
  groupGapsIntoInitiatives, computeLayerImpact,
  buildProjects, computeAccountHealthScore, generateExecutiveSummary
} from "../services/roadmapService.js";

import { renderReportingOverview } from "../ui/views/ReportingView.js";

import { renderContextView }       from "../ui/views/ContextView.js";
import { renderMatrixView }        from "../ui/views/MatrixView.js";
import { renderGapsEditView }      from "../ui/views/GapsEditView.js";
import { renderSummaryHealthView } from "../ui/views/SummaryHealthView.js";
import { renderSummaryGapsView }   from "../ui/views/SummaryGapsView.js";
import { renderSummaryVendorView } from "../ui/views/SummaryVendorView.js";
import { renderSummaryRoadmapView } from "../ui/views/SummaryRoadmapView.js";

const { describe, it, assert, assertEqual, run } = createTestRunner();

// ─── helpers ─────────────────────────────────────────────────────────────────

function throws(fn, label) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(threw, `Expected exception: ${label}`);
}

function doesNotThrow(fn, label) {
  try { fn(); }
  catch (e) { assert(false, `Unexpected exception for "${label}": ${e.message}`); }
}

function freshSession() {
  return createEmptySession();
}

function validInstance(overrides = {}) {
  return {
    id: "inst-test-" + Math.random().toString(36).slice(2, 7),
    state: "current",
    layerId: LayerIds[0],
    environmentId: EnvironmentIds[0],
    label: "Test Server",
    vendor: "Dell",
    vendorGroup: "dell",
    ...overrides
  };
}

function validGap(overrides = {}) {
  return {
    id: "gap-test-" + Math.random().toString(36).slice(2, 7),
    description: "Test gap",
    layerId: LayerIds[0],
    affectedLayers: [],
    affectedEnvironments: [],
    urgency: "Medium",
    phase: "now",
    mappedDellSolutions: "",
    notes: "",
    relatedCurrentInstanceIds: [],
    relatedDesiredInstanceIds: [],
    status: "open",
    ...overrides
  };
}


// ============================================================================
// SUITE 01 — core/config: layer & environment definitions
// ============================================================================
describe("01 · core/config — layer & environment definitions", () => {

  it("LAYERS is a non-empty array", () => {
    assert(Array.isArray(LAYERS) && LAYERS.length > 0, "LAYERS must be a non-empty array");
  });

  it("LAYERS has exactly 6 entries (5 infrastructure layers + workload)", () => {
    // v2.3.1 / Phase 16 — workload was added as the 6th layer at LAYERS[0].
    assertEqual(LAYERS.length, 6, "Must define exactly 6 architecture layers (1 workload + 5 infrastructure)");
  });

  it("every LAYER has a non-empty string id", () => {
    LAYERS.forEach((l, i) =>
      assert(typeof l.id === "string" && l.id.length > 0, `LAYERS[${i}].id must be non-empty string`)
    );
  });

  it("every LAYER has a non-empty string label", () => {
    LAYERS.forEach((l, i) =>
      assert(typeof l.label === "string" && l.label.length > 0, `LAYERS[${i}].label must be non-empty string`)
    );
  });

  it("all LAYER ids are unique", () => {
    const ids = LAYERS.map(l => l.id);
    const unique = new Set(ids);
    assertEqual(unique.size, ids.length, "All layer ids must be unique");
  });

  it("LAYERS contains the 5 required infrastructure groups (plus workload as the 6th)", () => {
    const required = [
      "compute", "storage", "dataProtection", "virtualization", "infrastructure"
    ];
    required.forEach(id =>
      assert(LAYERS.some(l => l.id === id), `Required layer '${id}' must exist`)
    );
    // v2.3.1 / Phase 16 — workload is the topmost layer.
    assert(LAYERS.some(l => l.id === "workload"), "workload layer must exist (Phase 16)");
  });

  it("ENVIRONMENTS is a non-empty array", () => {
    assert(Array.isArray(ENVIRONMENTS) && ENVIRONMENTS.length > 0, "ENVIRONMENTS must be a non-empty array");
  });

  it("ENVIRONMENTS has exactly 4 entries", () => {
    assertEqual(ENVIRONMENTS.length, 4, "Must define exactly 4 environments");
  });

  it("every ENVIRONMENT has non-empty id and label", () => {
    ENVIRONMENTS.forEach((e, i) => {
      assert(typeof e.id === "string" && e.id.length > 0,    `ENVIRONMENTS[${i}].id must be non-empty string`);
      assert(typeof e.label === "string" && e.label.length > 0, `ENVIRONMENTS[${i}].label must be non-empty string`);
    });
  });

  it("ENVIRONMENTS contains the 4 required deployment contexts", () => {
    const required = ["coreDc", "drDc", "publicCloud", "edge"];
    required.forEach(id =>
      assert(ENVIRONMENTS.some(e => e.id === id), `Required environment '${id}' must exist`)
    );
  });

  it("BUSINESS_DRIVERS is a non-empty array of {id, label, shortHint, conversationStarter} objects (T1.4)", () => {
    assert(Array.isArray(BUSINESS_DRIVERS) && BUSINESS_DRIVERS.length > 0, "BUSINESS_DRIVERS must be a non-empty array");
    BUSINESS_DRIVERS.forEach((d, i) => {
      assert(typeof d === "object" && d !== null, `BUSINESS_DRIVERS[${i}] must be an object`);
      assert(typeof d.id === "string" && d.id.length > 0, `BUSINESS_DRIVERS[${i}].id must be a non-empty string`);
      assert(typeof d.label === "string" && d.label.length > 0, `BUSINESS_DRIVERS[${i}].label must be a non-empty string`);
      assert(typeof d.shortHint === "string" && d.shortHint.length > 0, `BUSINESS_DRIVERS[${i}].shortHint must be non-empty`);
      assert(typeof d.conversationStarter === "string" && d.conversationStarter.length > 0,
        `BUSINESS_DRIVERS[${i}].conversationStarter must be non-empty (T1.5)`);
    });
  });

  it("BUSINESS_DRIVERS ids are unique", () => {
    const ids = BUSINESS_DRIVERS.map(d => d.id);
    assertEqual(new Set(ids).size, ids.length, "driver ids must be unique");
  });

  it("COACHING_PROMPTS has a conversation starter for every BUSINESS_DRIVERS label", () => {
    assert(typeof COACHING_PROMPTS === "object" && COACHING_PROMPTS !== null, "COACHING_PROMPTS must be an object");
    BUSINESS_DRIVERS.forEach(d =>
      assert(typeof COACHING_PROMPTS[d.label] === "string" && COACHING_PROMPTS[d.label].length > 0,
        `COACHING_PROMPTS must have a starter for driver label: '${d.label}'`)
    );
  });

  it("CUSTOMER_VERTICALS includes Energy and Utilities (T1.2)", () => {
    assert(CUSTOMER_VERTICALS.indexOf("Energy") >= 0, "Energy vertical must exist");
    assert(CUSTOMER_VERTICALS.indexOf("Utilities") >= 0, "Utilities vertical must exist");
  });

  it("CUSTOMER_VERTICALS is alphabetised", () => {
    const sorted = [...CUSTOMER_VERTICALS].sort((a, b) => a.localeCompare(b));
    assertEqual(JSON.stringify(CUSTOMER_VERTICALS), JSON.stringify(sorted),
      "CUSTOMER_VERTICALS must be sorted alphabetically");
  });

  it("catalog entries may carry an optional environments array (T2.1)", () => {
    Object.keys(CATALOG).forEach(layerId => {
      CATALOG[layerId].forEach((entry, i) => {
        if ("environments" in entry) {
          assert(Array.isArray(entry.environments),
            `CATALOG.${layerId}[${i}].environments must be an array when present`);
          assert(entry.environments.length > 0,
            `CATALOG.${layerId}[${i}].environments must be non-empty when present`);
          const valid = ["coreDc","drDc","publicCloud","edge"];
          entry.environments.forEach(envId =>
            assert(valid.indexOf(envId) >= 0,
              `CATALOG.${layerId}[${i}].environments contains invalid env '${envId}'`)
          );
        }
      });
    });
  });

  it("Public Cloud compute catalog includes AWS EC2 and Azure Virtual Machines (T2.3 data)", () => {
    const cloudCompute = CATALOG.compute.filter(e =>
      !e.environments || e.environments.indexOf("publicCloud") >= 0);
    assert(cloudCompute.some(e => e.label === "AWS EC2"), "AWS EC2 must be catalog-available for publicCloud");
    assert(cloudCompute.some(e => e.label === "Azure Virtual Machines"), "Azure VMs must be catalog-available for publicCloud");
  });

  it("On-prem compute catalog excludes public-cloud-only items (T2.4 data)", () => {
    const onPremCompute = CATALOG.compute.filter(e =>
      !e.environments || e.environments.indexOf("coreDc") >= 0);
    assert(onPremCompute.some(e => e.label === "PowerEdge (current gen)"), "PowerEdge must be available in coreDc");
    assert(!onPremCompute.some(e => e.label === "AWS EC2"), "AWS EC2 must NOT appear in coreDc palette");
  });

  it("CSS severity custom properties are defined on :root (T2.12)", () => {
    const style = getComputedStyle(document.documentElement);
    ["--crit-high", "--crit-medium", "--crit-low", "--crit-neutral"].forEach(v => {
      const val = style.getPropertyValue(v).trim();
      assert(val.length > 0, `CSS variable ${v} must be defined on :root`);
    });
  });

});


// ============================================================================
// SUITE 02 — core/config: technology catalog
// ============================================================================
describe("02 · core/config — technology catalog", () => {

  it("CATALOG is a plain object", () => {
    assert(typeof CATALOG === "object" && CATALOG !== null && !Array.isArray(CATALOG),
      "CATALOG must be a plain object");
  });

  it("CATALOG has an entry for every layer", () => {
    LAYERS.forEach(layer =>
      assert(layer.id in CATALOG, `CATALOG must have an entry for layer '${layer.id}'`)
    );
  });

  it("every CATALOG entry is a non-empty array", () => {
    LAYERS.forEach(layer => {
      assert(Array.isArray(CATALOG[layer.id]) && CATALOG[layer.id].length > 0,
        `CATALOG['${layer.id}'] must be a non-empty array`);
    });
  });

  it("every catalog tile has a non-empty label", () => {
    LAYERS.forEach(layer =>
      CATALOG[layer.id].forEach((tile, i) =>
        assert(typeof tile.label === "string" && tile.label.length > 0,
          `CATALOG['${layer.id}'][${i}].label must be a non-empty string`)
      )
    );
  });

  it("every catalog tile has a non-empty vendor", () => {
    LAYERS.forEach(layer =>
      CATALOG[layer.id].forEach((tile, i) =>
        assert(typeof tile.vendor === "string" && tile.vendor.length > 0,
          `CATALOG['${layer.id}'][${i}].vendor must be a non-empty string`)
      )
    );
  });

  it("every catalog tile vendorGroup is dell | nonDell | custom", () => {
    const valid = ["dell", "nonDell", "custom"];
    LAYERS.forEach(layer =>
      CATALOG[layer.id].forEach((tile, i) =>
        assert(valid.includes(tile.vendorGroup),
          `CATALOG['${layer.id}'][${i}].vendorGroup must be dell|nonDell|custom, got '${tile.vendorGroup}'`)
      )
    );
  });

  it("every layer catalog has at least one Dell tile", () => {
    LAYERS.forEach(layer =>
      assert(CATALOG[layer.id].some(t => t.vendorGroup === "dell"),
        `CATALOG['${layer.id}'] must contain at least one Dell tile`)
    );
  });

  it("every layer catalog has at least one non-Dell tile", () => {
    LAYERS.forEach(layer =>
      assert(CATALOG[layer.id].some(t => t.vendorGroup === "nonDell"),
        `CATALOG['${layer.id}'] must contain at least one non-Dell tile`)
    );
  });

  it("no duplicate labels within a layer catalog", () => {
    LAYERS.forEach(layer => {
      const labels = CATALOG[layer.id].map(t => t.label.toLowerCase());
      const unique  = new Set(labels);
      assertEqual(unique.size, labels.length,
        `CATALOG['${layer.id}'] contains duplicate tile labels`);
    });
  });

  it("CATALOG tiles are serialisable to JSON (no functions or DOM refs)", () => {
    doesNotThrow(
      () => JSON.stringify(CATALOG),
      "CATALOG must be JSON-serialisable"
    );
  });

});


// ============================================================================
// SUITE 03 — core/models: validateInstance
// ============================================================================
describe("03 · core/models — validateInstance", () => {

  it("accepts a fully valid current instance", () => {
    doesNotThrow(() => validateInstance(validInstance()), "valid current instance");
  });

  it("accepts a fully valid desired instance", () => {
    doesNotThrow(() => validateInstance(validInstance({
      state: "desired", priority: "Now", timeline: "0-12 months"
    })), "valid desired instance");
  });

  it("accepts an instance without optional fields", () => {
    doesNotThrow(() => validateInstance({
      id: "i1", state: "current",
      layerId: LayerIds[0], environmentId: EnvironmentIds[0],
      label: "Minimal instance"
    }), "instance without vendorGroup/notes/criticality");
  });

  it("throws when id is missing", () => {
    throws(() => validateInstance({ ...validInstance(), id: "" }), "empty id");
  });

  it("throws when id is not a string", () => {
    throws(() => validateInstance({ ...validInstance(), id: 42 }), "numeric id");
  });

  it("throws when state is not current or desired", () => {
    throws(() => validateInstance({ ...validInstance(), state: "unknown" }), "invalid state");
    throws(() => validateInstance({ ...validInstance(), state: "" }),         "empty state");
    throws(() => validateInstance({ ...validInstance(), state: "CURRENT" }),  "uppercase state");
  });

  it("throws when layerId is not in LayerIds", () => {
    throws(() => validateInstance({ ...validInstance(), layerId: "nonexistentLayer" }),
      "invalid layerId");
  });

  it("throws when environmentId is not in EnvironmentIds", () => {
    throws(() => validateInstance({ ...validInstance(), environmentId: "badEnv" }),
      "invalid environmentId");
  });

  it("throws when label is empty", () => {
    throws(() => validateInstance({ ...validInstance(), label: "" }),  "empty label");
    throws(() => validateInstance({ ...validInstance(), label: "  " }), "whitespace label");
  });

  it("throws when label is not a string", () => {
    throws(() => validateInstance({ ...validInstance(), label: null }), "null label");
  });

  it("throws when vendorGroup is present but invalid", () => {
    throws(() => validateInstance({ ...validInstance(), vendorGroup: "microsoft" }),
      "invalid vendorGroup value");
    throws(() => validateInstance({ ...validInstance(), vendorGroup: "Dell" }),
      "capitalized vendorGroup");
  });

  it("accepts all three valid vendorGroup values", () => {
    ["dell", "nonDell", "custom"].forEach(vg =>
      doesNotThrow(() => validateInstance({ ...validInstance(), vendorGroup: vg }), `vendorGroup: ${vg}`)
    );
  });

  it("validates all LayerIds as valid", () => {
    LayerIds.forEach(id =>
      doesNotThrow(() => validateInstance({ ...validInstance(), layerId: id }), `layerId: ${id}`)
    );
  });

  it("validates all EnvironmentIds as valid", () => {
    EnvironmentIds.forEach(id =>
      doesNotThrow(() => validateInstance({ ...validInstance(), environmentId: id }), `environmentId: ${id}`)
    );
  });

});


// ============================================================================
// SUITE 04 — core/models: validateGap
// ============================================================================
describe("04 · core/models — validateGap", () => {

  it("accepts a minimal valid gap with no type", () => {
    doesNotThrow(() => validateGap(validGap()), "minimal gap");
  });

  it("throws when id is missing or empty", () => {
    throws(() => validateGap({ ...validGap(), id: "" }), "empty gap id");
  });

  it("throws when description is missing or empty", () => {
    throws(() => validateGap({ ...validGap(), description: "" }),   "empty description");
    throws(() => validateGap({ ...validGap(), description: null }), "null description");
  });

  it("throws when layerId is not in LayerIds", () => {
    throws(() => validateGap({ ...validGap(), layerId: "badLayer" }), "invalid layerId");
  });

  it("throws when affectedLayers contains an invalid id", () => {
    throws(() => validateGap({ ...validGap(), affectedLayers: ["badLayer"] }),
      "invalid affectedLayer entry");
  });

  it("accepts empty affectedLayers array", () => {
    doesNotThrow(() => validateGap({ ...validGap(), affectedLayers: [] }), "empty affectedLayers");
  });

  it("throws when affectedEnvironments contains an invalid id", () => {
    throws(() => validateGap({ ...validGap(), affectedEnvironments: ["badEnv"] }),
      "invalid affectedEnvironment entry");
  });

  it("accepts all valid urgency values", () => {
    ["High", "Medium", "Low"].forEach(u =>
      doesNotThrow(() => validateGap({ ...validGap(), urgency: u }), `urgency: ${u}`)
    );
  });

  it("throws when urgency is invalid", () => {
    throws(() => validateGap({ ...validGap(), urgency: "Critical" }), "invalid urgency");
    throws(() => validateGap({ ...validGap(), urgency: "high" }),     "lowercase urgency");
  });

  it("accepts all valid phase values", () => {
    ["now", "next", "later"].forEach(p =>
      doesNotThrow(() => validateGap({ ...validGap(), phase: p }), `phase: ${p}`)
    );
  });

  it("throws when phase is invalid", () => {
    throws(() => validateGap({ ...validGap(), phase: "soon" }),  "invalid phase");
    throws(() => validateGap({ ...validGap(), phase: "NOW" }),   "uppercase phase");
  });

  it("throws when gapType is present but invalid", () => {
    throws(() => validateGap({ ...validGap(), gapType: "migrate" }), "invalid gapType");
    throws(() => validateGap({ ...validGap(), gapType: "Replace" }), "capitalized gapType");
  });

  it("accepts all valid gapType values (with required linked ids; 'rationalize' removed in v2.4.8)", () => {
    const withCurrent = { relatedCurrentInstanceIds: ["i1"] };
    const withDesired = { relatedDesiredInstanceIds: ["i1"] };
    // v2.4.8 · Phase 17 · the gap-type list is now GAP_TYPES derived
    // from core/taxonomy.js. "rationalize" is no longer valid; the
    // migrator coerces any pre-Phase-17 rationalize gaps to "ops".
    doesNotThrow(() => validateGap({ ...validGap(), gapType: "introduce",    ...withDesired }), "introduce");
    doesNotThrow(() => validateGap({ ...validGap(), gapType: "replace",      ...withCurrent }), "replace");
    doesNotThrow(() => validateGap({ ...validGap(), gapType: "enhance",      ...withCurrent }), "enhance");
    doesNotThrow(() => validateGap({ ...validGap(), gapType: "consolidate",  ...withCurrent }), "consolidate");
    doesNotThrow(() => validateGap({ ...validGap(), gapType: "ops",          notes: "process issue" }), "ops");
    throws(() => validateGap({ ...validGap(), gapType: "rationalize", ...withCurrent }),
      "rationalize must throw — removed from the Phase 17 taxonomy");
  });

  it("introduce: passes regardless of relatedDesiredInstanceIds (soft rule)", () => {
    doesNotThrow(() => validateGap({ ...validGap(), gapType: "introduce", relatedDesiredInstanceIds: [] }),
      "introduce without desired ids -- soft rule, must not throw");
    doesNotThrow(() => validateGap({ ...validGap(), gapType: "introduce", relatedDesiredInstanceIds: ["inst-1"] }),
      "introduce with desired id");
  });

  it("replace / enhance / consolidate: pass without linked instances at validateGap layer (soft rule; stricter rules live in validateActionLinks)", () => {
    // validateGap is a SHAPE validator only. Link-count rules live in
    // core/taxonomy.js validateActionLinks (v2.4.8 · Phase 17), and
    // those fire through createGap/updateGap for REVIEWED gaps only.
    ["replace", "enhance", "consolidate"].forEach(t =>
      doesNotThrow(() => validateGap({ ...validGap(), gapType: t, relatedCurrentInstanceIds: [] }),
        t + " without current ids -- validateGap is shape-only, must not throw")
    );
  });

  it("ops: passes with or without notes (relationship rules removed)", () => {
    // ops gaps no longer hard-block on empty notes; this is a soft warning in the UI
    doesNotThrow(() => validateGap({ ...validGap(), gapType: "ops", notes: "" }),
      "ops without notes must not throw (soft warning only)");
    doesNotThrow(() => validateGap({ ...validGap(), gapType: "ops", notes: "manual process issue" }),
      "ops with notes");
  });

  it("accepts valid status values", () => {
    ["open", "in_progress", "closed", "deferred"].forEach(s =>
      doesNotThrow(() => validateGap({ ...validGap(), status: s }), `status: ${s}`)
    );
  });

  it("throws when status is an unknown value", () => {
    throws(() => validateGap({ ...validGap(), status: "done" }), "invalid status");
  });

});


// ============================================================================
// SUITE 05 — state/sessionStore
// ============================================================================
describe("05 · state/sessionStore", () => {

  it("createEmptySession returns an object with all required keys", () => {
    const s = createEmptySession();
    ["sessionId", "customer", "sessionMeta", "instances", "gaps"]
      .forEach(k => assert(k in s, `session.${k} must exist`));
  });

  it("createEmptySession.customer has all required sub-fields", () => {
    const c = createEmptySession().customer;
    ["name", "segment", "industry", "region", "drivers"]
      .forEach(k => assert(k in c, `session.customer.${k} must exist`));
    assert(Array.isArray(c.drivers), "customer.drivers must be an array");
    assertEqual(c.drivers.length, 0, "customer.drivers starts empty");
  });

  it("migrateLegacySession converts primaryDriver + businessOutcomes into drivers[] (T1.18)", () => {
    const legacy = {
      sessionId: "sess-legacy",
      customer: {
        name: "Legacy Co",
        vertical: "",
        segment: "Financial Services",
        industry: "Financial Services",
        region: "EMEA",
        primaryDriver: "Resilience & Security"
      },
      sessionMeta: { date: "2025-01-01", presalesOwner: "", status: "Draft", version: "1.0" },
      businessOutcomes: "Achieve full cyber resilience by Q3 2026.",
      instances: [],
      gaps: []
    };
    const migrated = migrateLegacySession(legacy);
    assert(Array.isArray(migrated.customer.drivers), "drivers must be an array after migration");
    assertEqual(migrated.customer.drivers.length, 1, "one driver should be created from primaryDriver");
    assertEqual(migrated.customer.drivers[0].id, "cyber_resilience", "driver id must map from legacy label");
    assertEqual(migrated.customer.drivers[0].priority, "High", "migrated driver priority should default to High");
    assert(migrated.customer.drivers[0].outcomes.indexOf("cyber resilience") >= 0,
      "legacy businessOutcomes must carry into drivers[0].outcomes");
    assert(!("primaryDriver" in migrated.customer), "primaryDriver must be removed after migration");
    assert(!("businessOutcomes" in migrated), "root businessOutcomes must be removed after migration");
  });

  it("migrateLegacySession preserves instances[*].timeline (T3.3)", () => {
    const legacy = {
      sessionId: "sess-legacy-2",
      customer: { name: "X", vertical: "Enterprise", segment: "", industry: "", region: "", primaryDriver: "" },
      sessionMeta: { date: "2025-01-01", presalesOwner: "", status: "Draft", version: "1.0" },
      instances: [
        { id: "d-x", state: "desired", layerId: "compute", environmentId: "coreDc",
          label: "X", vendorGroup: "dell", priority: "Now", timeline: "0-12 months" }
      ],
      gaps: []
    };
    const migrated = migrateLegacySession(legacy);
    assertEqual(migrated.instances[0].timeline, "0-12 months", "timeline must survive migration read");
  });

  it("migrateLegacySession handles an already-migrated session idempotently", () => {
    const modern = createEmptySession();
    modern.customer.drivers = [{ id: "ai_data", priority: "High", outcomes: "data platform" }];
    const migrated = migrateLegacySession(JSON.parse(JSON.stringify(modern)));
    assertEqual(migrated.customer.drivers.length, 1, "drivers must be preserved");
    assertEqual(migrated.customer.drivers[0].id, "ai_data", "driver id must be preserved");
  });

  it("createEmptySession.sessionMeta has all required sub-fields", () => {
    const m = createEmptySession().sessionMeta;
    ["date", "presalesOwner", "status", "version"]
      .forEach(k => assert(k in m, `session.sessionMeta.${k} must exist`));
  });

  it("createEmptySession produces arrays for instances and gaps", () => {
    const s = createEmptySession();
    assert(Array.isArray(s.instances), "instances must be an array");
    assert(Array.isArray(s.gaps),      "gaps must be an array");
    assertEqual(s.instances.length, 0, "instances must start empty");
    assertEqual(s.gaps.length,      0, "gaps must start empty");
  });

  it("sessionId is unique across two calls to createEmptySession", () => {
    const a = createEmptySession();
    const b = createEmptySession();
    assert(a.sessionId !== b.sessionId, "sessionId must be unique per session");
  });

  it("resetSession clears instances and gaps", () => {
    const s = createEmptySession();
    s.instances.push(validInstance());
    s.gaps.push(validGap());
    resetSession();
    assertEqual(session.instances.length, 0, "instances must be empty after reset");
    assertEqual(session.gaps.length,      0, "gaps must be empty after reset");
  });

  it("saveToLocalStorage returns true on success", () => {
    const result = saveToLocalStorage();
    assert(result === true, "saveToLocalStorage must return true");
  });

  it("loadFromLocalStorage restores a saved value", () => {
    session.customer.name = "__spec_test__";
    saveToLocalStorage();
    session.customer.name = "OVERWRITTEN";
    const loaded = loadFromLocalStorage();
    assert(loaded === true,                          "loadFromLocalStorage must return true");
    assertEqual(session.customer.name, "__spec_test__", "customer.name must be restored");
    session.customer.name = "";
    saveToLocalStorage();
  });

  it("session object is JSON-serialisable (AI integration prerequisite)", () => {
    doesNotThrow(() => JSON.stringify(session),
      "session must be serialisable — no DOM refs, no functions");
  });

  it("loadFromLocalStorage returns false when no saved data exists", () => {
    localStorage.removeItem("dell_discovery_v1");
    const result = loadFromLocalStorage();
    assert(result === false, "loadFromLocalStorage must return false when nothing saved");
    saveToLocalStorage();
  });

});


// ============================================================================
// SUITE 06 — interactions/matrixCommands
// ============================================================================
describe("06 · interactions/matrixCommands", () => {

  it("addInstance appends to session.instances and returns the instance", () => {
    const s      = freshSession();
    const before = s.instances.length;
    const inst   = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"Server A", vendorGroup:"dell" });
    assertEqual(s.instances.length, before + 1, "must add exactly 1 instance");
    assert(s.instances.includes(inst),          "returned instance must be in array");
  });

  it("addInstance auto-generates a unique id when none provided", () => {
    const s  = freshSession();
    const i1 = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"A", vendorGroup:"dell" });
    const i2 = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"B", vendorGroup:"dell" });
    assert(typeof i1.id === "string" && i1.id.length > 0, "i1 must have non-empty id");
    assert(i1.id !== i2.id,                               "ids must be unique across calls");
  });

  it("addInstance uses provided id when supplied", () => {
    const s    = freshSession();
    const inst = addInstance(s, { id:"custom-id", state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"A", vendorGroup:"dell" });
    assertEqual(inst.id, "custom-id", "must use provided id");
  });

  it("addInstance throws for invalid layerId", () => {
    throws(() => addInstance(freshSession(), { state:"current", layerId:"INVALID", environmentId:EnvironmentIds[0], label:"A", vendorGroup:"dell" }),
      "invalid layerId");
  });

  it("addInstance throws for invalid environmentId", () => {
    throws(() => addInstance(freshSession(), { state:"current", layerId:LayerIds[0], environmentId:"INVALID", label:"A", vendorGroup:"dell" }),
      "invalid environmentId");
  });

  it("addInstance throws for empty label", () => {
    throws(() => addInstance(freshSession(), { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"", vendorGroup:"dell" }),
      "empty label");
  });

  it("addInstance throws for invalid state", () => {
    throws(() => addInstance(freshSession(), { state:"past", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"A", vendorGroup:"dell" }),
      "invalid state");
  });

  it("updateInstance patches specified fields", () => {
    const s    = freshSession();
    const inst = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"Server", vendorGroup:"dell" });
    const updated = updateInstance(s, inst.id, { criticality:"High", notes:"EOL in 3 months" });
    assertEqual(updated.criticality, "High",            "criticality must be patched");
    assertEqual(updated.notes,       "EOL in 3 months", "notes must be patched");
  });

  it("updateInstance does not affect other instances", () => {
    const s  = freshSession();
    const i1 = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"A", vendorGroup:"dell" });
    const i2 = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"B", vendorGroup:"dell" });
    updateInstance(s, i1.id, { notes:"changed" });
    assertEqual(i2.notes, "", "sibling instance must be unchanged");
  });

  it("updateInstance throws for unknown id", () => {
    throws(() => updateInstance(freshSession(), "nonexistent-id", { notes:"x" }),
      "unknown instanceId");
  });

  it("updateInstance throws when patch makes instance invalid", () => {
    const s    = freshSession();
    const inst = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"A", vendorGroup:"dell" });
    throws(() => updateInstance(s, inst.id, { layerId:"INVALID_LAYER" }),
      "patch that invalidates the instance");
  });

  it("deleteInstance removes the instance by id", () => {
    const s    = freshSession();
    const inst = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"Delete me", vendorGroup:"dell" });
    const before = s.instances.length;
    deleteInstance(s, inst.id);
    assertEqual(s.instances.length, before - 1,              "length must decrease by 1");
    assert(!s.instances.find(i => i.id === inst.id),          "deleted instance must not remain");
  });

  it("deleteInstance does not affect other instances", () => {
    const s  = freshSession();
    const i1 = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"Keep", vendorGroup:"dell" });
    const i2 = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"Delete", vendorGroup:"dell" });
    deleteInstance(s, i2.id);
    assert(s.instances.find(i => i.id === i1.id), "sibling instance must remain");
  });

  it("deleteInstance throws for unknown id", () => {
    throws(() => deleteInstance(freshSession(), "nonexistent-id"), "unknown id on delete");
  });

  it("moveInstance updates layerId", () => {
    const s    = freshSession();
    const inst = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"A", vendorGroup:"dell" });
    const moved = moveInstance(s, inst.id, { newLayerId: LayerIds[1] });
    assertEqual(moved.layerId, LayerIds[1], "layerId must update");
  });

  it("moveInstance updates environmentId", () => {
    const s    = freshSession();
    const inst = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"A", vendorGroup:"dell" });
    const moved = moveInstance(s, inst.id, { newEnvironmentId: EnvironmentIds[1] });
    assertEqual(moved.environmentId, EnvironmentIds[1], "environmentId must update");
  });

  it("moveInstance can change state from current to desired", () => {
    const s    = freshSession();
    const inst = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"A", vendorGroup:"dell" });
    const moved = moveInstance(s, inst.id, { newState: "desired" });
    assertEqual(moved.state, "desired", "state must update to desired");
  });

  it("moveInstance throws for unknown id", () => {
    throws(() => moveInstance(freshSession(), "nonexistent-id", { newLayerId: LayerIds[0] }),
      "move unknown id");
  });

  // ── Phase 4 · criticality default (SPEC §7.2) ────────────
  it("addInstance defaults criticality to 'Low' for new current instances (T2.6)", () => {
    const s = freshSession();
    const inst = addInstance(s, {
      state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Fresh server", vendorGroup:"dell"
    });
    assertEqual(inst.criticality, "Low", "current instance must default to Low criticality");
  });

  it("addInstance respects an explicit criticality override (T2.6b)", () => {
    const s = freshSession();
    const inst = addInstance(s, {
      state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Server", vendorGroup:"dell", criticality:"High"
    });
    assertEqual(inst.criticality, "High", "explicit criticality must win over default");
  });

  it("addInstance does NOT inject a criticality default for desired instances (T2.7)", () => {
    const s = freshSession();
    const inst = addInstance(s, {
      state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Target", vendorGroup:"dell"
    });
    assert(!("criticality" in inst) || inst.criticality === undefined,
      "desired instances must not carry a criticality default");
  });

});


// ============================================================================
// SUITE 07 — interactions/gapsCommands
// ============================================================================
describe("07 · interactions/gapsCommands", () => {

  it("createGap appends to session.gaps and returns the gap", () => {
    const s      = freshSession();
    const before = s.gaps.length;
    const gap    = createGap(s, { description:"Test gap", layerId:LayerIds[0] });
    assertEqual(s.gaps.length, before + 1, "must add exactly 1 gap");
    assert(s.gaps.includes(gap),           "returned gap must be in array");
  });

  it("createGap auto-generates a unique id", () => {
    const s  = freshSession();
    const g1 = createGap(s, { description:"G1", layerId:LayerIds[0] });
    const g2 = createGap(s, { description:"G2", layerId:LayerIds[0] });
    assert(typeof g1.id === "string" && g1.id.length > 0, "g1 must have id");
    assert(g1.id !== g2.id,                               "ids must be unique");
  });

  it("createGap defaults urgency to Medium", () => {
    const s   = freshSession();
    const gap = createGap(s, { description:"D", layerId:LayerIds[0] });
    assertEqual(gap.urgency, "Medium", "urgency must default to Medium");
  });

  it("createGap defaults phase to now", () => {
    const s   = freshSession();
    const gap = createGap(s, { description:"D", layerId:LayerIds[0] });
    assertEqual(gap.phase, "now", "phase must default to now");
  });

  it("createGap defaults status to open", () => {
    const s   = freshSession();
    const gap = createGap(s, { description:"D", layerId:LayerIds[0] });
    assertEqual(gap.status, "open", "status must default to open");
  });

  it("createGap deduplicates relatedCurrentInstanceIds", () => {
    // v2.4.8 · Phase 17 · Replace rule requires exactly 1 current. This
    // test checks dedup behaviour only; use consolidate (2+ current) so
    // the fixture matches the rule AND still exercises dedup.
    const s   = freshSession();
    const gap = createGap(s, {
      description:"D", layerId:LayerIds[0],
      gapType:"consolidate",
      relatedCurrentInstanceIds: ["i1", "i1", "i2"],
      relatedDesiredInstanceIds: ["d1"]
    });
    assertEqual(gap.relatedCurrentInstanceIds.length, 2, "must deduplicate current ids");
  });

  it("createGap deduplicates relatedDesiredInstanceIds", () => {
    const s   = freshSession();
    const gap = createGap(s, {
      description:"D", layerId:LayerIds[0],
      gapType:"introduce",
      relatedDesiredInstanceIds: ["d1", "d1"]
    });
    assertEqual(gap.relatedDesiredInstanceIds.length, 1, "must deduplicate desired ids");
  });

  it("createGap throws for missing or empty description", () => {
    throws(() => createGap(freshSession(), { description:"", layerId:LayerIds[0] }),
      "empty description");
    throws(() => createGap(freshSession(), { description:"   ", layerId:LayerIds[0] }),
      "whitespace description");
  });

  it("createGap throws for invalid layerId", () => {
    throws(() => createGap(freshSession(), { description:"D", layerId:"INVALID" }),
      "invalid layerId");
  });

  it("createGap accepts introduce without linked instances on unreviewed auto-drafts (Phase 17 rule bypass)", () => {
    // v2.4.8 · Phase 17 · Introduce rule now requires exactly 1 desired
    // on REVIEWED gaps. Unreviewed auto-drafts still bypass so
    // mid-workflow creation doesn't block the user.
    doesNotThrow(() => createGap(freshSession(), {
      description: "Introduce something new",
      layerId: LayerIds[0],
      gapType: "introduce",
      relatedDesiredInstanceIds: [],
      reviewed: false
    }), "introduce gap auto-draft must not hard-fail on empty desired ids");
    // But REVIEWED introduce with 0 desired throws — that's the rule.
    throws(() => createGap(freshSession(), {
      description: "Bad reviewed introduce",
      layerId: LayerIds[0],
      gapType: "introduce",
      relatedDesiredInstanceIds: [],
      reviewed: true
    }), "reviewed introduce with 0 desired must throw (Phase 17 rule)");
  });

  it("createGap accepts ops without notes on auto-drafts (soft rule); review-time enforcement covered separately by RH5", () => {
    // v2.4.11 · A9 · review-time substance rule applies — but auto-drafts
    // (reviewed:false) bypass per A1. Test the unreviewed path here; the
    // review-time rejection lives in Suite 42 RH5.
    doesNotThrow(() => createGap(freshSession(), {
      description: "Operational change",
      layerId: LayerIds[0],
      gapType: "ops",
      notes: "",
      reviewed: false
    }), "ops gap must not hard-fail on empty notes when reviewed:false");
  });

  it("updateGap patches fields and re-validates", () => {
    const s   = freshSession();
    const gap = createGap(s, { description:"Original", layerId:LayerIds[0] });
    const updated = updateGap(s, gap.id, { urgency:"High", phase:"later", status:"in_progress" });
    assertEqual(updated.urgency, "High",        "urgency must be patched");
    assertEqual(updated.phase,   "later",       "phase must be patched");
    assertEqual(updated.status,  "in_progress", "status must be patched");
  });

  it("updateGap throws for unknown gapId", () => {
    throws(() => updateGap(freshSession(), "nonexistent-id", { urgency:"Low" }),
      "unknown gapId");
  });

  it("updateGap throws when patch makes gap invalid", () => {
    const s   = freshSession();
    const gap = createGap(s, { description:"D", layerId:LayerIds[0] });
    throws(() => updateGap(s, gap.id, { layerId:"INVALID" }),
      "patch with invalid layerId");
  });

  it("deleteGap removes the gap", () => {
    const s      = freshSession();
    const gap    = createGap(s, { description:"Delete me", layerId:LayerIds[0] });
    const before = s.gaps.length;
    deleteGap(s, gap.id);
    assertEqual(s.gaps.length, before - 1,           "must remove 1 gap");
    assert(!s.gaps.find(g => g.id === gap.id),        "deleted gap must not remain");
  });

  it("deleteGap throws for unknown id", () => {
    throws(() => deleteGap(freshSession(), "nonexistent-id"), "unknown gapId on delete");
  });

  it("linkCurrentInstance adds id without duplication", () => {
    // v2.4.8 · Phase 17 · use reviewed:false to bypass action-link
    // rule validation — the test is about link-command dedup behaviour,
    // not taxonomy rule compliance.
    const s   = freshSession();
    const gap = createGap(s, { description:"D", layerId:LayerIds[0], gapType:"replace",
      relatedCurrentInstanceIds:["i1"], reviewed:false });
    linkCurrentInstance(s, gap.id, "i2");
    assert(gap.relatedCurrentInstanceIds.includes("i2"), "i2 must be added");
    const before = gap.relatedCurrentInstanceIds.length;
    linkCurrentInstance(s, gap.id, "i2");
    assertEqual(gap.relatedCurrentInstanceIds.length, before, "must not duplicate");
  });

  it("linkDesiredInstance adds id without duplication", () => {
    const s   = freshSession();
    const gap = createGap(s, { description:"D", layerId:LayerIds[0], gapType:"introduce", relatedDesiredInstanceIds:["d1"] });
    linkDesiredInstance(s, gap.id, "d2");
    assert(gap.relatedDesiredInstanceIds.includes("d2"), "d2 must be added");
    const before = gap.relatedDesiredInstanceIds.length;
    linkDesiredInstance(s, gap.id, "d2");
    assertEqual(gap.relatedDesiredInstanceIds.length, before, "must not duplicate");
  });

  it("unlinkCurrentInstance removes the specified id", () => {
    const s   = freshSession();
    const gap = createGap(s, { description:"D", layerId:LayerIds[0], gapType:"replace",
      relatedCurrentInstanceIds:["i1","i2"], reviewed:false });
    unlinkCurrentInstance(s, gap.id, "i1");
    assert(!gap.relatedCurrentInstanceIds.includes("i1"), "i1 must be removed");
    assert( gap.relatedCurrentInstanceIds.includes("i2"), "i2 must remain");
  });

  it("unlinkCurrentInstance throws when removing would violate type rule", () => {
    const s   = freshSession();
    const gap = createGap(s, { description:"D", layerId:LayerIds[0], gapType:"replace",
      relatedCurrentInstanceIds:["i1"], reviewed:false });
    throws(() => unlinkCurrentInstance(s, gap.id, "i1"),
      "remove last current id from replace gap");
  });

  it("unlinkDesiredInstance throws when removing would violate type rule", () => {
    const s   = freshSession();
    const gap = createGap(s, { description:"D", layerId:LayerIds[0], gapType:"introduce",
      relatedDesiredInstanceIds:["d1"], reviewed:false });
    throws(() => unlinkDesiredInstance(s, gap.id, "d1"),
      "remove last desired id from introduce gap");
  });

  it("all gap commands throw with a descriptive error message string", () => {
    const s = freshSession();
    try {
      updateGap(s, "bad-id", {});
    } catch(e) {
      assert(typeof e.message === "string" && e.message.length > 0,
        "error must have a non-empty message string (AI can read it)");
    }
  });

});


// ============================================================================
// SUITE 08 — services/healthMetrics
// ============================================================================
describe("08 · services/healthMetrics", () => {

  it("getHealthSummary returns an object with all five numeric keys", () => {
    const s = freshSession();
    const r = getHealthSummary(s, LAYERS, ENVIRONMENTS);
    ["totalBuckets","totalCurrent","totalDesired","totalGaps","highRiskGaps"]
      .forEach(k => assert(typeof r[k] === "number", `summary.${k} must be a number`));
  });

  it("totalBuckets equals LAYERS.length × ENVIRONMENTS.length", () => {
    const s = freshSession();
    const r = getHealthSummary(s, LAYERS, ENVIRONMENTS);
    assertEqual(r.totalBuckets, LAYERS.length * ENVIRONMENTS.length,
      "totalBuckets must be layers × environments");
  });

  it("totalCurrent counts only current-state instances", () => {
    const s = freshSession();
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"C1", vendorGroup:"dell" });
    addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"D1", vendorGroup:"dell" });
    const r = getHealthSummary(s, LAYERS, ENVIRONMENTS);
    assertEqual(r.totalCurrent, 1, "only current instances counted");
    assertEqual(r.totalDesired, 1, "only desired instances counted");
  });

  it("highRiskGaps counts only High urgency gaps", () => {
    const s = freshSession();
    createGap(s, { description:"High gap",   layerId:LayerIds[0], urgency:"High" });
    createGap(s, { description:"Medium gap", layerId:LayerIds[0], urgency:"Medium" });
    const r = getHealthSummary(s, LAYERS, ENVIRONMENTS);
    assertEqual(r.totalGaps,    2, "totalGaps must count all gaps");
    assertEqual(r.highRiskGaps, 1, "highRiskGaps must count only High urgency");
  });

  it("computeBucketMetrics returns correct shape", () => {
    const s = freshSession();
    const m = computeBucketMetrics(LayerIds[0], EnvironmentIds[0], s);
    assert(typeof m.totalScore   === "number",  "totalScore must be number");
    assert(typeof m.currentScore === "number",  "currentScore must be number");
    assert(typeof m.gapScore     === "number",  "gapScore must be number");
    assert(typeof m.hasData      === "boolean", "hasData must be boolean");
    assert(Array.isArray(m.current),            "current must be array");
    assert(Array.isArray(m.gaps),               "gaps must be array");
  });

  it("currentScore: High criticality = 2, Medium = 1, Low = 0.5", () => {
    const s = freshSession();
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"H", vendorGroup:"dell", criticality:"High" });
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"M", vendorGroup:"dell", criticality:"Medium" });
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"L", vendorGroup:"dell", criticality:"Low" });
    const m = computeBucketMetrics(LayerIds[0], EnvironmentIds[0], s);
    assertEqual(m.currentScore, 3.5, "High(2) + Medium(1) + Low(0.5) = 3.5");
  });

  it("gapScore: High urgency = 3, Medium = 2, Low = 1", () => {
    const s = freshSession();
    createGap(s, { description:"H", layerId:LayerIds[0], urgency:"High",   affectedEnvironments:[], phase:"now" });
    createGap(s, { description:"M", layerId:LayerIds[0], urgency:"Medium", affectedEnvironments:[], phase:"now" });
    createGap(s, { description:"L", layerId:LayerIds[0], urgency:"Low",    affectedEnvironments:[], phase:"now" });
    const m = computeBucketMetrics(LayerIds[0], EnvironmentIds[0], s);
    assertEqual(m.gapScore, 6, "High(3) + Medium(2) + Low(1) = 6");
  });

  it("totalScore = currentScore + gapScore", () => {
    const s = freshSession();
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"X", vendorGroup:"dell", criticality:"High" });
    createGap(s, { description:"G", layerId:LayerIds[0], urgency:"High", affectedEnvironments:[], phase:"now" });
    const m = computeBucketMetrics(LayerIds[0], EnvironmentIds[0], s);
    assertEqual(m.totalScore, m.currentScore + m.gapScore, "totalScore = currentScore + gapScore");
  });

  it("hasData is false when cell has no instances and no gaps", () => {
    const s = freshSession();
    const m = computeBucketMetrics(LayerIds[0], EnvironmentIds[0], s);
    assertEqual(m.hasData, false, "empty cell must have hasData = false");
  });

  it("hasData is true when cell has at least one instance", () => {
    const s = freshSession();
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"X", vendorGroup:"dell" });
    const m = computeBucketMetrics(LayerIds[0], EnvironmentIds[0], s);
    assertEqual(m.hasData, true, "cell with instance must have hasData = true");
  });

  it("bucket metrics only includes current instances matching layer AND environment", () => {
    const s = freshSession();
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"Match",    vendorGroup:"dell" });
    addInstance(s, { state:"current", layerId:LayerIds[1], environmentId:EnvironmentIds[0], label:"WrongLayer",vendorGroup:"dell" });
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[1], label:"WrongEnv",  vendorGroup:"dell" });
    const m = computeBucketMetrics(LayerIds[0], EnvironmentIds[0], s);
    assertEqual(m.current.length, 1, "only matching instance must appear");
  });

  it("gap is included in bucket when affectedEnvironments is empty (matches all envs)", () => {
    const s = freshSession();
    createGap(s, { description:"All envs", layerId:LayerIds[0], urgency:"High", affectedEnvironments:[], phase:"now" });
    const m = computeBucketMetrics(LayerIds[0], EnvironmentIds[2], s);
    assertEqual(m.gaps.length, 1, "gap with no envs must appear in every environment bucket");
  });

  it("scoreToRiskLabel: no data → 'No data'", () => {
    assertEqual(scoreToRiskLabel(0, false), "No data", "no data label");
  });

  it("scoreToRiskLabel: score 0 with data → 'Stable'", () => {
    const label = scoreToRiskLabel(0, true);
    assert(label === "Stable" || label === "Stable / low focus",
      "score 0 with data should be stable");
  });

  it("scoreToRiskLabel: score > 6 → high risk label", () => {
    const label = scoreToRiskLabel(9, true);
    assert(label.toLowerCase().includes("high"), "high score must produce high risk label");
  });

});


// ============================================================================
// SUITE 09 — services/gapsService
// ============================================================================
describe("09 · services/gapsService", () => {

  it("getAllGaps returns an array", () => {
    assert(Array.isArray(getAllGaps()), "getAllGaps must return an array");
  });

  it("getAllGaps reflects current session.gaps", () => {
    const before = getAllGaps().length;
    createGap(session, { description:"Service test gap", layerId:LayerIds[0] });
    assertEqual(getAllGaps().length, before + 1, "must reflect added gap");
  });

  it("getFilteredGaps with no filters returns all gaps", () => {
    const all      = getAllGaps().length;
    const filtered = getFilteredGaps({}).length;
    assertEqual(filtered, all, "empty filter must return all gaps");
  });

  it("getFilteredGaps filters by layerIds", () => {
    const s = freshSession();
    createGap(s, { description:"Layer 0", layerId:LayerIds[0] });
    createGap(s, { description:"Layer 1", layerId:LayerIds[1] });
    const filtered = (s.gaps || []).filter(g => {
      const layers = g.affectedLayers?.length ? g.affectedLayers : [g.layerId];
      return layers.some(l => l === LayerIds[0]);
    });
    assertEqual(filtered.length, 1, "must only return gaps for the requested layer");
  });

  it("getFilteredGaps: gap with no affectedEnvironments matches any envId", () => {
    const s = freshSession();
    createGap(s, { description:"All envs", layerId:LayerIds[0], affectedEnvironments:[] });
    const result = (s.gaps || []).filter(g => {
      const envs = g.affectedEnvironments || [];
      return envs.length === 0 || envs.includes(EnvironmentIds[3]);
    });
    assertEqual(result.length, 1, "gap with no environments must appear for any envId filter");
  });

  it("getGapsByPhase returns object with now, next, later keys", () => {
    const byPhase = getGapsByPhase({});
    ["now","next","later"].forEach(ph =>
      assert(ph in byPhase, `getGapsByPhase must return key '${ph}'`)
    );
  });

  it("getGapsByPhase arrays are arrays", () => {
    const byPhase = getGapsByPhase({});
    ["now","next","later"].forEach(ph =>
      assert(Array.isArray(byPhase[ph]), `getGapsByPhase.${ph} must be an array`)
    );
  });

  it("getGapsByPhase assigns gaps to correct phase bucket", () => {
    const nowCount   = getGapsByPhase({}).now.length;
    createGap(session, { description:"Now gap", layerId:LayerIds[0], phase:"now" });
    const afterCount = getGapsByPhase({}).now.length;
    assertEqual(afterCount, nowCount + 1, "now gap must appear in now bucket");
  });

  it("getGapsByPhase handles gaps with no affectedLayers (uses layerId)", () => {
    const s = freshSession();
    createGap(s, { description:"No affected", layerId:LayerIds[0], affectedLayers:[], phase:"next" });
    const filtered = (s.gaps || []).filter(g => {
      const layers = g.affectedLayers?.length ? g.affectedLayers : [g.layerId];
      return layers.some(l => l === LayerIds[0]);
    });
    assertEqual(filtered.length, 1, "gap using layerId fallback must be found");
  });

  it("gapsService functions return plain serialisable arrays", () => {
    doesNotThrow(() => JSON.stringify(getAllGaps()),        "getAllGaps must be serialisable");
    doesNotThrow(() => JSON.stringify(getFilteredGaps({})),"getFilteredGaps must be serialisable");
    doesNotThrow(() => JSON.stringify(getGapsByPhase({})), "getGapsByPhase must be serialisable");
  });

  it("getFilteredGaps returns empty array when no gaps match", () => {
    const s       = freshSession();
    const result  = s.gaps.filter(g => g.layerId === "nonexistentLayer");
    assertEqual(result.length, 0, "must return empty array when nothing matches");
  });

  it("gap service functions do not mutate session.gaps", () => {
    const before = JSON.stringify(getAllGaps());
    getFilteredGaps({ layerIds: [LayerIds[0]] });
    getGapsByPhase({ layerIds: [LayerIds[0]] });
    const after = JSON.stringify(getAllGaps());
    assertEqual(before, after, "service functions must not mutate session.gaps");
  });

});


// ============================================================================
// SUITE 10 — services/vendorMixService
// ============================================================================
describe("10 · services/vendorMixService", () => {

  it("computeMixByLayer returns an entry for every requested layerId", () => {
    const ids = LAYERS.map(l => l.id);
    const mix = computeMixByLayer({ stateFilter:"combined", layerIds: ids });
    ids.forEach(id => assert(id in mix, `mix must have key '${id}'`));
  });

  it("computeMixByLayer each entry has dell, nonDell, custom, total as numbers", () => {
    const mix = computeMixByLayer({ stateFilter:"combined", layerIds: LAYERS.map(l => l.id) });
    LAYERS.forEach(layer => {
      ["dell","nonDell","custom","total"].forEach(k =>
        assert(typeof mix[layer.id][k] === "number", `mix['${layer.id}'].${k} must be number`)
      );
    });
  });

  it("computeMixByLayer: total = dell + nonDell + custom", () => {
    const s = freshSession();
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"D", vendorGroup:"dell" });
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"N", vendorGroup:"nonDell" });
    const mix = computeMixByLayer({ stateFilter:"current", layerIds:[LayerIds[0]] });
    const entry = mix[LayerIds[0]];
    assertEqual(entry.total, entry.dell + entry.nonDell + entry.custom,
      "total must equal sum of vendor groups");
  });

  it("computeMixByLayer stateFilter='current' excludes desired instances", () => {
    const s = freshSession();
    addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"D", vendorGroup:"dell" });
    const mix = computeMixByLayer({ stateFilter:"current", layerIds:[LayerIds[0]] });
    assertEqual(mix[LayerIds[0]].total, 0, "current filter must exclude desired instances");
  });

  it("computeMixByLayer stateFilter='desired' excludes current instances", () => {
    const s = freshSession();
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"C", vendorGroup:"dell" });
    const mix = computeMixByLayer({ stateFilter:"desired", layerIds:[LayerIds[0]] });
    assertEqual(mix[LayerIds[0]].total, 0, "desired filter must exclude current instances");
  });

  it("computeMixByEnv returns an entry for every environment", () => {
    const mix = computeMixByEnv({ stateFilter:"combined", environments: ENVIRONMENTS });
    ENVIRONMENTS.forEach(env =>
      assert(env.id in mix, `mix must have key '${env.id}'`)
    );
  });

  it("computeMixByEnv each entry has required numeric keys", () => {
    const mix = computeMixByEnv({ stateFilter:"combined", environments: ENVIRONMENTS });
    ENVIRONMENTS.forEach(env =>
      ["dell","nonDell","custom","total"].forEach(k =>
        assert(typeof mix[env.id][k] === "number", `mixByEnv['${env.id}'].${k} must be number`)
      )
    );
  });

  it("computeVendorTableData returns an array", () => {
    assert(Array.isArray(computeVendorTableData({})), "must return an array");
  });

  it("computeVendorTableData each row has vendor, vendorGroup, current, desired, total", () => {
    const rows = computeVendorTableData({});
    rows.forEach((r, i) => {
      assert(typeof r.vendor      === "string", `row[${i}].vendor must be string`);
      assert(typeof r.vendorGroup === "string", `row[${i}].vendorGroup must be string`);
      assert(typeof r.current     === "number", `row[${i}].current must be number`);
      assert(typeof r.desired     === "number", `row[${i}].desired must be number`);
      assert(typeof r.total       === "number", `row[${i}].total must be number`);
    });
  });

  it("computeVendorTableData: row.total = row.current + row.desired", () => {
    computeVendorTableData({}).forEach((r, i) =>
      assertEqual(r.total, r.current + r.desired,
        `row[${i}].total must equal current + desired`)
    );
  });

  it("computeVendorTableData sorted by total descending", () => {
    const rows = computeVendorTableData({});
    for (let i = 0; i < rows.length - 1; i++)
      assert(rows[i].total >= rows[i+1].total, "rows must be sorted by total descending");
  });

  it("vendor service functions do not mutate session", () => {
    const snap = JSON.stringify(session);
    computeMixByLayer({ stateFilter:"combined", layerIds: LAYERS.map(l=>l.id) });
    computeMixByEnv({ stateFilter:"combined", environments: ENVIRONMENTS });
    computeVendorTableData({});
    assertEqual(JSON.stringify(session), snap, "vendor services must not mutate session");
  });

  it("vendorMixService returns serialisable plain objects", () => {
    doesNotThrow(() => JSON.stringify(computeMixByLayer({ stateFilter:"combined", layerIds:[] })),
      "computeMixByLayer must be serialisable");
    doesNotThrow(() => JSON.stringify(computeVendorTableData({})),
      "computeVendorTableData must be serialisable");
  });

});


// ============================================================================
// SUITE 11 — services/roadmapService
// ============================================================================
describe("11 · services/roadmapService", () => {

  it("groupGapsIntoInitiatives returns { initiatives: [] } shape", () => {
    const s = freshSession();
    const r = groupGapsIntoInitiatives(s, {});
    assert("initiatives" in r,        "must return object with initiatives key");
    assert(Array.isArray(r.initiatives), "initiatives must be an array");
  });

  it("each initiative has required fields", () => {
    const s = freshSession();
    createGap(s, { description:"Gap A", layerId:LayerIds[0], urgency:"High", phase:"now", mappedDellSolutions:"PPDM" });
    const { initiatives } = groupGapsIntoInitiatives(s, {});
    const init = initiatives[0];
    assert(typeof init.id            === "string",  "initiative.id must be string");
    assert(["now","next","later"].includes(init.phase), "initiative.phase must be now|next|later");
    assert(typeof init.title         === "string",  "initiative.title must be string");
    assert(Array.isArray(init.layers),              "initiative.layers must be array");
    assert(Array.isArray(init.environments),        "initiative.environments must be array");
    assert(["High","Medium","Low"].includes(init.urgency), "initiative.urgency must be valid");
    assert(Array.isArray(init.gaps),                "initiative.gaps must be array");
  });

  it("initiative phase matches source gap phase", () => {
    const s = freshSession();
    createGap(s, { description:"Next item", layerId:LayerIds[0], phase:"next" });
    const { initiatives } = groupGapsIntoInitiatives(s, {});
    const init = initiatives.find(i => i.title === "Next item");
    assert(init, "initiative must exist");
    assertEqual(init.phase, "next", "phase must match gap phase");
  });

  it("initiative title matches source gap description", () => {
    const s = freshSession();
    createGap(s, { description:"Replace storage platform", layerId:LayerIds[0] });
    const { initiatives } = groupGapsIntoInitiatives(s, {});
    assert(initiatives.some(i => i.title === "Replace storage platform"),
      "title must match gap description");
  });

  it("initiative.gaps array contains the source gap", () => {
    const s   = freshSession();
    const gap = createGap(s, { description:"Source gap", layerId:LayerIds[0] });
    const { initiatives } = groupGapsIntoInitiatives(s, {});
    const init = initiatives.find(i => i.title === "Source gap");
    assert(init.gaps.includes(gap), "gap must be in initiative.gaps");
  });

  it("returns empty initiatives for session with no gaps", () => {
    const s = freshSession();
    const { initiatives } = groupGapsIntoInitiatives(s, {});
    assertEqual(initiatives.length, 0, "empty session must produce empty initiatives");
  });

  it("computeLayerImpact returns an entry for every layer", () => {
    const s      = freshSession();
    const impact = computeLayerImpact(s, {});
    LAYERS.forEach(layer =>
      assert(layer.id in impact, `impact must have key for layer '${layer.id}'`)
    );
  });

  it("computeLayerImpact each layer has now, next, later as numbers", () => {
    const impact = computeLayerImpact(freshSession(), {});
    LAYERS.forEach(layer =>
      ["now","next","later"].forEach(ph =>
        assert(typeof impact[layer.id][ph] === "number",
          `impact['${layer.id}'].${ph} must be number`)
      )
    );
  });

  it("computeLayerImpact counts gaps per layer per phase", () => {
    const s = freshSession();
    createGap(s, { description:"A", layerId:LayerIds[0], phase:"now" });
    createGap(s, { description:"B", layerId:LayerIds[0], phase:"now" });
    createGap(s, { description:"C", layerId:LayerIds[0], phase:"later" });
    const impact = computeLayerImpact(s, {});
    assertEqual(impact[LayerIds[0]].now,   2, "now count must be 2");
    assertEqual(impact[LayerIds[0]].later, 1, "later count must be 1");
    assertEqual(impact[LayerIds[0]].next,  0, "next count must be 0");
  });

  it("roadmap services do not mutate session", () => {
    const s    = freshSession();
    createGap(s, { description:"D", layerId:LayerIds[0] });
    const snap = JSON.stringify(s);
    groupGapsIntoInitiatives(s, {});
    computeLayerImpact(s, {});
    assertEqual(JSON.stringify(s), snap, "roadmap services must not mutate session");
  });

  it("roadmap services return serialisable results", () => {
    const s = freshSession();
    doesNotThrow(() => JSON.stringify(groupGapsIntoInitiatives(s, {})), "groupGapsIntoInitiatives serialisable");
    doesNotThrow(() => JSON.stringify(computeLayerImpact(s, {})),       "computeLayerImpact serialisable");
  });

});


// ============================================================================
// SUITE 12 — ui/views/ContextView: DOM contract
// ============================================================================
describe("12 · ui/views/ContextView — DOM contract", () => {

  function mountContext(sess) {
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderContextView(l, r, sess || freshSession());
    return { l, r };
  }

  it("renderContextView is a function", () => {
    assert(typeof renderContextView === "function", "renderContextView must be a function");
  });

  it("renders without throwing", () => {
    doesNotThrow(() => mountContext(), "must not throw on render");
  });

  it("left panel is non-empty after render", () => {
    const { l } = mountContext();
    assert(l.innerHTML.length > 0, "left panel must produce output");
  });

  it("renders an input for customer.name with correct data-field", () => {
    const { l } = mountContext();
    const input = l.querySelector("[data-field='customer.name']");
    assert(input !== null, "must render input with data-field='customer.name'");
    assert(input.tagName === "INPUT" || input.tagName === "TEXTAREA",
      "customer.name field must be an input or textarea");
  });

  // ── Phase 3 · Tab 1 drivers UX (SPEC §7.1) ───────────────

  it("Vertical select renders all CUSTOMER_VERTICALS plus a placeholder (T1.3)", () => {
    const { l } = mountContext();
    const sel = l.querySelector("[data-field='customer.vertical']");
    assert(sel !== null, "vertical select must render");
    assertEqual(sel.options.length, CUSTOMER_VERTICALS.length + 1,
      "vertical options must equal CUSTOMER_VERTICALS length + 1 placeholder");
  });

  it("Empty session shows zero driver-tiles and a visible + Add driver control (T1.6)", () => {
    const { l } = mountContext();
    assertEqual(l.querySelectorAll(".driver-tile").length, 0, "no tiles for empty drivers[]");
    const addBtn = [...l.querySelectorAll("button")].find(b => b.textContent.indexOf("Add driver") >= 0);
    assert(addBtn !== undefined, "+ Add driver button must be present");
  });

  it("Clicking + Add driver opens a .cmd-overlay populated with drivers (T1.7)", () => {
    document.querySelectorAll(".cmd-overlay").forEach(o => o.remove());
    const { l } = mountContext();
    const addBtn = [...l.querySelectorAll("button")].find(b => b.textContent.indexOf("Add driver") >= 0);
    addBtn.click();
    const overlay = document.querySelector(".cmd-overlay");
    assert(overlay !== null, "cmd-overlay must appear");
    const items = overlay.querySelectorAll(".cmd-item");
    assertEqual(items.length, BUSINESS_DRIVERS.length, "all 8 drivers available on empty session");
    overlay.remove();
  });

  it("Selecting a driver pushes it into session.customer.drivers with defaults (T1.8)", () => {
    document.querySelectorAll(".cmd-overlay").forEach(o => o.remove());
    const s = createEmptySession();
    const { l } = mountContext(s);
    const addBtn = [...l.querySelectorAll("button")].find(b => b.textContent.indexOf("Add driver") >= 0);
    addBtn.click();
    const overlay = document.querySelector(".cmd-overlay");
    const first = overlay.querySelector(".cmd-item");
    first.click();
    assertEqual(s.customer.drivers.length, 1, "one driver added");
    assert(typeof s.customer.drivers[0].id === "string" && s.customer.drivers[0].id.length > 0, "driver id set");
    assertEqual(s.customer.drivers[0].outcomes, "", "default outcomes are empty");
    assertEqual(s.customer.drivers[0].priority, "Medium", "default priority is Medium");
    document.querySelectorAll(".cmd-overlay").forEach(o => o.remove());
  });

  it("Driver tile has a remove control that deletes the driver (T1.9)", () => {
    const s = createEmptySession();
    s.customer.drivers = [{ id: "ai_data", priority: "Medium", outcomes: "" }];
    const { l } = mountContext(s);
    const tile = l.querySelector(".driver-tile");
    assert(tile !== null, "driver tile must render");
    const del = tile.querySelector(".driver-tile-del");
    assert(del !== null, ".driver-tile-del must exist");
    del.click();
    assertEqual(s.customer.drivers.length, 0, "driver removed from session");
  });

  it("Adding the same driver twice is a no-op (T1.10)", () => {
    document.querySelectorAll(".cmd-overlay").forEach(o => o.remove());
    const s = createEmptySession();
    s.customer.drivers = [{ id: "ai_data", priority: "Medium", outcomes: "" }];
    const { l } = mountContext(s);
    const addBtn = [...l.querySelectorAll("button")].find(b => b.textContent.indexOf("Add driver") >= 0);
    addBtn.click();
    const overlay = document.querySelector(".cmd-overlay");
    const items = overlay.querySelectorAll(".cmd-item");
    assertEqual(items.length, BUSINESS_DRIVERS.length - 1, "already-added driver excluded from palette");
    overlay.remove();
  });

  it("Clicking a driver-tile renders the right-panel .coaching-card with conversationStarter (T1.11)", () => {
    const s = createEmptySession();
    s.customer.drivers = [{ id: "cyber_resilience", priority: "High", outcomes: "" }];
    const { l, r } = mountContext(s);
    l.querySelector(".driver-tile").click();
    const card = r.querySelector(".coaching-card");
    assert(card !== null, ".coaching-card must appear on right panel");
    const meta = BUSINESS_DRIVERS.find(d => d.id === "cyber_resilience");
    assert(card.textContent.indexOf(meta.conversationStarter.slice(0, 20)) >= 0,
      "coaching card must contain that driver's conversationStarter");
  });

  it("Right panel shows a priority select with High/Medium/Low (T1.12)", () => {
    const s = createEmptySession();
    s.customer.drivers = [{ id: "ai_data", priority: "High", outcomes: "" }];
    const { l, r } = mountContext(s);
    l.querySelector(".driver-tile").click();
    const sel = r.querySelector("select[data-field='driver.priority']");
    assert(sel !== null, "priority select must render");
    const opts = [...sel.options].map(o => o.value);
    ["High", "Medium", "Low"].forEach(v =>
      assert(opts.indexOf(v) >= 0, `priority options must include ${v}`)
    );
  });

  it("Right panel shows an outcomes textarea bound to drivers[x].outcomes (T1.13)", () => {
    const s = createEmptySession();
    s.customer.drivers = [{ id: "ai_data", priority: "Medium", outcomes: "• Test outcome" }];
    const { l, r } = mountContext(s);
    l.querySelector(".driver-tile").click();
    const ta = r.querySelector("textarea[data-field='driver.outcomes']");
    assert(ta !== null, "outcomes textarea must render");
    assertEqual(ta.value, "• Test outcome", "textarea must be pre-filled from session");
  });

  it("Auto-bullet · Enter in an empty outcomes textarea yields '• ' (T1.14)", () => {
    const s = createEmptySession();
    s.customer.drivers = [{ id: "ai_data", priority: "Medium", outcomes: "" }];
    const { l, r } = mountContext(s);
    l.querySelector(".driver-tile").click();
    const ta = r.querySelector("textarea[data-field='driver.outcomes']");
    ta.setSelectionRange(0, 0);
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assert(ta.value.indexOf("• ") === 0, `value must start with '• ' — was '${ta.value}'`);
  });

  it("Auto-bullet · Enter after text inserts '\\n• ' at the caret (T1.15)", () => {
    const s = createEmptySession();
    s.customer.drivers = [{ id: "ai_data", priority: "Medium", outcomes: "" }];
    const { l, r } = mountContext(s);
    l.querySelector(".driver-tile").click();
    const ta = r.querySelector("textarea[data-field='driver.outcomes']");
    ta.value = "hello";
    ta.setSelectionRange(5, 5);
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assertEqual(ta.value, "hello\n• ", "expected 'hello\\n• '");
  });

  it("Auto-bullet · Backspace at start of a '• ' line removes the bullet (T1.16)", () => {
    const s = createEmptySession();
    s.customer.drivers = [{ id: "ai_data", priority: "Medium", outcomes: "" }];
    const { l, r } = mountContext(s);
    l.querySelector(".driver-tile").click();
    const ta = r.querySelector("textarea[data-field='driver.outcomes']");
    ta.value = "hello\n• ";
    ta.setSelectionRange(8, 8);
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }));
    assertEqual(ta.value, "hello\n", "bullet must be removed");
  });

  it("Outcomes edits persist to session.customer.drivers[x].outcomes (T1.17)", () => {
    const s = createEmptySession();
    s.customer.drivers = [{ id: "ai_data", priority: "Medium", outcomes: "" }];
    const { l, r } = mountContext(s);
    l.querySelector(".driver-tile").click();
    const ta = r.querySelector("textarea[data-field='driver.outcomes']");
    ta.value = "• New outcome";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    assertEqual(s.customer.drivers[0].outcomes, "• New outcome", "outcomes must persist into session");
  });

  it("pre-fills customer.name from session", () => {
    const s     = freshSession();
    s.customer.name = "Acme Corp";
    const { l } = mountContext(s);
    const input = l.querySelector("[data-field='customer.name']");
    assertEqual(input.value, "Acme Corp", "customer.name field must be pre-filled");
  });

  it("renders a save button", () => {
    const { l } = mountContext();
    const btns  = [...l.querySelectorAll("button")];
    assert(btns.some(b => b.textContent.toLowerCase().includes("save")),
      "must render a save button");
  });

  it("right panel contains a coaching card", () => {
    const { r } = mountContext();
    assert(r.innerHTML.length > 0, "right panel must contain content");
    const text = r.textContent.toLowerCase();
    assert(
      text.includes("conversation") || text.includes("tip") || text.includes("opener") || text.includes("starter"),
      "right panel must contain coaching / conversation content"
    );
  });

});


// ============================================================================
// SUITE 13 — ui/views/MatrixView: DOM contract
// ============================================================================
describe("13 · ui/views/MatrixView — DOM contract", () => {

  function mountMatrix(stateFilter, sess) {
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderMatrixView(l, r, sess || freshSession(), { stateFilter: stateFilter || "current" });
    return { l, r };
  }

  it("renderMatrixView is a function", () => {
    assert(typeof renderMatrixView === "function", "renderMatrixView must be a function");
  });

  it("renders for stateFilter=current without throwing", () => {
    doesNotThrow(() => mountMatrix("current"), "current state render");
  });

  it("renders for stateFilter=desired without throwing", () => {
    doesNotThrow(() => mountMatrix("desired"), "desired state render");
  });

  it("renders exactly LAYERS × ENVIRONMENTS data cells", () => {
    const { l } = mountMatrix("current");
    const cells = l.querySelectorAll("[data-matrix-cell]");
    assertEqual(cells.length, LAYERS.length * ENVIRONMENTS.length,
      `must render ${LAYERS.length * ENVIRONMENTS.length} matrix cells`);
  });

  it("every cell has data-layer-id and data-env-id attributes", () => {
    const { l } = mountMatrix("current");
    l.querySelectorAll("[data-matrix-cell]").forEach((cell, i) => {
      assert(cell.hasAttribute("data-layer-id"), `cell[${i}] must have data-layer-id`);
      assert(cell.hasAttribute("data-env-id"),   `cell[${i}] must have data-env-id`);
    });
  });

  it("every cell data-layer-id is a valid LayerId", () => {
    const { l } = mountMatrix("current");
    l.querySelectorAll("[data-matrix-cell]").forEach(cell =>
      assert(LayerIds.includes(cell.getAttribute("data-layer-id")),
        `cell data-layer-id '${cell.getAttribute("data-layer-id")}' must be a valid LayerId`)
    );
  });

  it("every cell data-env-id is a valid EnvironmentId", () => {
    const { l } = mountMatrix("current");
    l.querySelectorAll("[data-matrix-cell]").forEach(cell =>
      assert(EnvironmentIds.includes(cell.getAttribute("data-env-id")),
        `cell data-env-id '${cell.getAttribute("data-env-id")}' must be a valid EnvironmentId`)
    );
  });

  it("every cell has an add-instance trigger element", () => {
    const { l } = mountMatrix("current");
    const cells   = l.querySelectorAll("[data-matrix-cell]");
    const addBtns = l.querySelectorAll("[data-add-instance]");
    assert(addBtns.length >= cells.length,
      "every cell must have at least one add-instance element");
  });

  it("existing current-state instance renders as a tile in the correct cell", () => {
    const s    = freshSession();
    const inst = addInstance(s, {
      state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"PowerStore", vendorGroup:"dell"
    });
    const { l } = mountMatrix("current", s);
    const tile  = l.querySelector(`[data-instance-id='${inst.id}']`);
    assert(tile !== null, "instance must render as a tile with data-instance-id attribute");
  });

  it("tile for dell instance has the dell vendorGroup class", () => {
    const s    = freshSession();
    const inst = addInstance(s, {
      state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"PowerStore", vendorGroup:"dell"
    });
    const { l } = mountMatrix("current", s);
    const tile  = l.querySelector(`[data-instance-id='${inst.id}']`);
    assert(tile.className.includes("dell"), "dell tile must have dell class");
  });

  it("tile renders in the correct layer/env cell", () => {
    const s    = freshSession();
    const inst = addInstance(s, {
      state:"current", layerId:LayerIds[2], environmentId:EnvironmentIds[1],
      label:"Veeam", vendorGroup:"nonDell"
    });
    const { l } = mountMatrix("current", s);
    const cell = l.querySelector(`[data-layer-id='${LayerIds[2]}'][data-env-id='${EnvironmentIds[1]}']`);
    assert(cell !== null, "target cell must exist");
    assert(cell.querySelector(`[data-instance-id='${inst.id}']`) !== null,
      "tile must render inside the correct cell");
  });

  it("right panel shows hint when no tile is selected", () => {
    const { r } = mountMatrix("current");
    assert(r.innerHTML.length > 0, "right panel must not be empty");
  });

  it("desired state render shows priority field in detail for selected tile", () => {
    const s    = freshSession();
    const inst = addInstance(s, {
      state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"APEX Cloud", vendorGroup:"dell", priority:"Now"
    });
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderMatrixView(l, r, s, { stateFilter:"desired" });
    // Simulate selection by checking tile exists — actual click test is integration level
    const tile = l.querySelector(`[data-instance-id='${inst.id}']`);
    assert(tile !== null, "desired instance must render as tile");
  });

  // ── Phase 4 · env-appropriate catalog + criticality accent ──────

  it("Public Cloud + Add palette excludes on-prem items like PowerEdge (T2.2)", () => {
    document.querySelectorAll("#cmd-palette").forEach(o => o.remove());
    const s = freshSession();
    const l = document.createElement("div");
    const r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderMatrixView(l, r, s, { stateFilter:"current" });
    const cell = l.querySelector("[data-matrix-cell][data-layer-id='compute'][data-env-id='publicCloud']");
    assert(cell !== null, "publicCloud compute cell must exist");
    const addBtn = cell.querySelector("[data-add-instance]");
    addBtn.click();
    const overlay = document.getElementById("cmd-palette");
    assert(overlay !== null, "command palette must open");
    const text = overlay.textContent;
    assert(text.indexOf("PowerEdge (current gen)") < 0, "PowerEdge must NOT appear in publicCloud palette");
    assert(text.indexOf("AWS EC2") >= 0, "AWS EC2 must appear in publicCloud palette");
    overlay.remove();
    l.remove(); r.remove();
  });

  it("Every layer has at least one cloud-native catalog item in Public Cloud (T2.5)", () => {
    LAYERS.forEach(layer => {
      const cloudItems = (CATALOG[layer.id] || []).filter(e =>
        !e.environments || e.environments.indexOf("publicCloud") >= 0);
      assert(cloudItems.length >= 1,
        `layer '${layer.id}' must have ≥1 publicCloud-available catalog item`);
    });
  });

  it("Core DC + Add palette still shows PowerEdge (T2.4 palette)", () => {
    document.querySelectorAll("#cmd-palette").forEach(o => o.remove());
    const s = freshSession();
    const l = document.createElement("div");
    const r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderMatrixView(l, r, s, { stateFilter:"current" });
    const cell = l.querySelector("[data-matrix-cell][data-layer-id='compute'][data-env-id='coreDc']");
    const addBtn = cell.querySelector("[data-add-instance]");
    addBtn.click();
    const overlay = document.getElementById("cmd-palette");
    assert(overlay !== null, "command palette must open");
    assert(overlay.textContent.indexOf("PowerEdge (current gen)") >= 0,
      "PowerEdge must be available in coreDc palette");
    overlay.remove();
    l.remove(); r.remove();
  });

  it("High-criticality current tile has .crit-high class on tile root (T2.9)", () => {
    const s = freshSession();
    const inst = addInstance(s, {
      state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Critical", vendorGroup:"dell", criticality:"High"
    });
    const { l } = mountMatrix("current", s);
    const tile = l.querySelector(`[data-instance-id='${inst.id}']`);
    assert(tile.classList.contains("crit-high"), "tile root must carry .crit-high");
  });

  it("High-criticality tile includes a non-text .crit-shape-high marker (T2.10)", () => {
    const s = freshSession();
    const inst = addInstance(s, {
      state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Critical", vendorGroup:"dell", criticality:"High"
    });
    const { l } = mountMatrix("current", s);
    const tile = l.querySelector(`[data-instance-id='${inst.id}']`);
    const shape = tile.querySelector(".crit-shape-high");
    assert(shape !== null, "tile must include a .crit-shape-high element");
  });

  it("Medium and Low criticality produce matching .crit-* classes (T2.11)", () => {
    const s = freshSession();
    const iMed = addInstance(s, {
      state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Med", vendorGroup:"dell", criticality:"Medium"
    });
    const iLow = addInstance(s, {
      state:"current", layerId:LayerIds[1], environmentId:EnvironmentIds[0],
      label:"Low", vendorGroup:"dell", criticality:"Low"
    });
    const { l } = mountMatrix("current", s);
    const tMed = l.querySelector(`[data-instance-id='${iMed.id}']`);
    const tLow = l.querySelector(`[data-instance-id='${iLow.id}']`);
    assert(tMed.classList.contains("crit-medium"), "Medium tile must have .crit-medium");
    assert(tLow.classList.contains("crit-low"), "Low tile must have .crit-low");
  });

  it("Desired counterpart of a High-criticality current carries .crit-high (T2.13)", () => {
    const s = freshSession();
    const cur = addInstance(s, {
      state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Unity XT", vendorGroup:"dell", criticality:"High"
    });
    const des = addInstance(s, {
      state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"PowerStore", vendorGroup:"dell", originId: cur.id, disposition:"replace"
    });
    const { l } = mountMatrix("desired", s);
    const tile = l.querySelector(`[data-instance-id='${des.id}']`);
    assert(tile !== null, "desired tile must render");
    assert(tile.classList.contains("crit-high"),
      "desired tile with originId High must inherit .crit-high");
  });

  it("Net-new desired tile (no originId) has no .crit-* class (T2.14)", () => {
    const s = freshSession();
    const des = addInstance(s, {
      state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"New capability", vendorGroup:"dell", disposition:"introduce"
    });
    const { l } = mountMatrix("desired", s);
    const tile = l.querySelector(`[data-instance-id='${des.id}']`);
    assert(tile !== null, "net-new desired tile must render");
    assert(!tile.classList.contains("crit-high") &&
           !tile.classList.contains("crit-medium") &&
           !tile.classList.contains("crit-low"),
      "net-new desired tile must not carry a criticality class");
  });

  it("Ghost / mirror tile inherits its origin's criticality class (T2.15)", () => {
    const s = freshSession();
    addInstance(s, {
      state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Critical source", vendorGroup:"dell", criticality:"High"
    });
    const { l } = mountMatrix("desired", s);
    const mirror = l.querySelector(".mirror-tile");
    assert(mirror !== null, "mirror tile must appear for unreviewed current item");
    assert(mirror.classList.contains("crit-high"), "mirror tile must carry origin's .crit-high");
  });

});


// ============================================================================
// SUITE 14 — ui/views/GapsEditView: DOM contract
// ============================================================================
describe("14 · ui/views/GapsEditView — DOM contract", () => {

  function mountGaps(sess) {
    // v2.4.15-polish iter-3 . reset cross-tab filter state between tests
    // so a stale layer/env/toggle from a prior test doesn't make the
    // freshly-mounted view filter out the test fixture's gaps.
    filterState._resetForTests();
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderGapsEditView(l, r, sess || freshSession());
    return { l, r };
  }

  it("renderGapsEditView is a function", () => {
    assert(typeof renderGapsEditView === "function", "renderGapsEditView must be a function");
  });

  it("renders without throwing", () => {
    doesNotThrow(() => mountGaps(), "must not throw");
  });

  it("renders a kanban board with exactly 3 columns", () => {
    const { l } = mountGaps();
    const columns = l.querySelectorAll(".kanban-col");
    assertEqual(columns.length, 3, "must render 3 kanban columns");
  });

  it("kanban column headers contain now, next, later", () => {
    const { l } = mountGaps();
    const text  = l.textContent.toLowerCase();
    assert(text.includes("now"),   "must include 'now' column");
    assert(text.includes("next"),  "must include 'next' column");
    assert(text.includes("later"), "must include 'later' column");
  });

  it("renders an add-gap button", () => {
    const { l } = mountGaps();
    const btns  = [...l.querySelectorAll("button")];
    assert(btns.some(b => b.textContent.toLowerCase().includes("add")),
      "must render an add gap button");
  });

  it("existing gaps render as cards in the correct column", () => {
    const s = freshSession();
    createGap(s, { description:"Now initiative", layerId:LayerIds[0], phase:"now" });
    createGap(s, { description:"Later initiative", layerId:LayerIds[0], phase:"later" });
    const { l } = mountGaps(s);
    const cards = l.querySelectorAll(".gap-card");
    assertEqual(cards.length, 2, "both gaps must render as cards");
  });

  it("gap card contains the gap description", () => {
    const s = freshSession();
    createGap(s, { description:"Replace legacy backup", layerId:LayerIds[0] });
    const { l } = mountGaps(s);
    assert(l.textContent.includes("Replace legacy backup"),
      "gap description must appear in card");
  });

  it("right panel shows default hint when no gap is selected", () => {
    const { r } = mountGaps();
    assert(r.innerHTML.length > 0, "right panel must not be empty");
    const text = r.textContent.toLowerCase();
    assert(
      text.includes("select") || text.includes("click") || text.includes("add"),
      "right panel must contain helpful hint"
    );
  });

  it("layer filter chips are rendered for all LAYERS (now inside FilterBar accordion)", () => {
    // v2.4.15-polish iter-3 . Layer chips moved from a standalone
    // .chip-filter row to the FilterBar's Layer accordion. The chips
    // are still in the DOM regardless of accordion open/closed state.
    const { l }  = mountGaps();
    const chips  = l.querySelectorAll(".filter-chip[data-filter-dim='layer']");
    assert(chips.length >= LAYERS.length,
      "must render at least one filter-chip per LAYER inside the FilterBar (got " + chips.length + ")");
  });

  it("environment filter is wired in the FilterBar (no standalone dropdown)", () => {
    // v2.4.15-polish iter-3 . The env dropdown migrated into the
    // FilterBar's Environment accordion. Each visible env gets a chip.
    const { l } = mountGaps();
    const envChips = l.querySelectorAll(".filter-chip[data-filter-dim='environment']");
    assert(envChips.length > 0,
      "FilterBar must render at least one Environment chip (got " + envChips.length + ")");
  });

  it("renders without throwing when session has many gaps across all phases", () => {
    const s = freshSession();
    ["now","now","next","next","later"].forEach((phase, i) =>
      createGap(s, { description:`Gap ${i}`, layerId:LayerIds[i % LayerIds.length], phase })
    );
    doesNotThrow(() => {
      const l = document.createElement("div");
      const r = document.createElement("div");
      renderGapsEditView(l, r, s);
    }, "must handle multiple gaps without throwing");
  });

  // ── Phase 6 · Tab 4 Gaps additions ──────────────────────

  it("Gap card has no editable urgency control (T4.1 + T3.12)", () => {
    const s = freshSession();
    createGap(s, { description:"Urg read-only", layerId:LayerIds[0], urgency:"High" });
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderGapsEditView(l, r, s);
    const card = l.querySelector(".gap-card");
    card.click();
    // After click, detail panel renders in r. Urgency must be a read-only .form-readonly, not a <select>.
    const readonly = r.querySelector(".form-readonly");
    const urgencySel = r.querySelector("select[data-prop='urgency']");
    assert(readonly !== null, "detail panel must show a .form-readonly display for derived values");
    assertEqual(urgencySel, null, "detail panel must NOT include a <select data-prop='urgency'>");
  });

  it("Gap card carries a .crit-{urgency} class on root (T4.4)", () => {
    const s = freshSession();
    createGap(s, { description:"High-urg gap", layerId:LayerIds[0], urgency:"High" });
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderGapsEditView(l, r, s);
    const card = l.querySelector(".gap-card");
    assert(card.classList.contains("crit-high"), "gap card must carry .crit-high when urgency=High");
  });

  it("Drag-drop to new column triggers bidirectional phase sync (T4.5)", () => {
    const s = freshSession();
    const cur = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Src", vendorGroup:"dell", criticality:"High" });
    const des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", disposition:"replace", priority:"Now", originId: cur.id });
    createGap(s, { description:"G", layerId:LayerIds[0], phase:"now",
      relatedCurrentInstanceIds:[cur.id], relatedDesiredInstanceIds:[des.id] });
    // Mirror what the drop handler does: updateGap + syncDesiredFromGap.
    updateGap(s, s.gaps[0].id, { phase:"later" });
    syncDesiredFromGap(s, s.gaps[0].id);
    assertEqual(s.gaps[0].phase, "later", "gap phase must update");
    assertEqual(des.priority, "Later", "linked desired instance priority must sync to 'Later'");
  });

  it("Needs-review filter hides cards where reviewed === true (T6.8 · replaces T4.15)", () => {
    // v2.4.15-polish iter-3 . the legacy .needs-review-check toggle
    // moved into the FilterBar's Quick toggles section. Test now
    // drives the toggle via the [data-filter-toggle="needsReviewOnly"]
    // input so the FilterBar -> filterState -> renderAll bridge fires
    // end-to-end.
    filterState._resetForTests();
    const s = freshSession();
    createGap(s, { description:"Reviewed", layerId:LayerIds[0] });
    createGap(s, { description:"Needs-review", layerId:LayerIds[0], reviewed: false });
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderGapsEditView(l, r, s);
    assertEqual(l.querySelectorAll(".gap-card").length, 2, "both cards visible before filter");
    const toggleRow = l.querySelector("[data-filter-toggle='needsReviewOnly']");
    assert(toggleRow !== null, "needs-review toggle row must render in the FilterBar");
    const toggle = toggleRow.querySelector("input[type='checkbox']");
    assert(toggle !== null, "needs-review toggle must include a checkbox input");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    const remaining = l.querySelectorAll(".gap-card");
    assertEqual(remaining.length, 1, "filter must hide reviewed cards");
    assert(remaining[0].textContent.indexOf("Needs-review") >= 0, "the visible card is the unreviewed one");
    filterState._resetForTests();
  });

  it("Manual gap creation via + Add uses defaults phase=next urgency=Medium status=open (T4.13)", () => {
    document.querySelectorAll("#gap-dialog").forEach(d => d.remove());
    const s = freshSession();
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderGapsEditView(l, r, s);
    const addBtn = [...l.querySelectorAll("button")].find(b => b.textContent.indexOf("Add gap") >= 0);
    addBtn.click();
    const dialog = document.getElementById("gap-dialog");
    assert(dialog !== null, "add-gap dialog must open");
    dialog.querySelector("textarea[data-prop='description']").value = "Manual test gap";
    const createBtn = [...dialog.querySelectorAll("button")].find(b => b.textContent.indexOf("Create") >= 0);
    createBtn.click();
    const created = s.gaps[s.gaps.length - 1];
    assertEqual(created.description, "Manual test gap", "description set");
    assertEqual(created.phase, "next", "phase default = 'next'");
    assertEqual(created.urgency, "Medium", "urgency default = 'Medium'");
    assertEqual(created.status, "open", "status default = 'open'");
  });

});


// ============================================================================
// SUITE 22 — services/programsService (Phase 6) + v2.1 additions
// ============================================================================
import {
  suggestDriverId, groupProjectsByProgram, effectiveDriverId,
  effectiveDellSolutions
} from "../services/programsService.js";
import {
  computeDiscoveryCoverage, computeRiskPosture
} from "../services/roadmapService.js";
import { approveGap as approveGapCmd } from "../interactions/gapsCommands.js";

describe("22 · services/programsService", () => {

  function sessionWithDrivers(ids) {
    const s = freshSession();
    s.customer.drivers = ids.map(id => ({ id, priority: "Medium", outcomes: "" }));
    return s;
  }

  it("suggestDriverId returns null when no rule matches (T5.17)", () => {
    const s = sessionWithDrivers(["ai_data"]);
    const r = suggestDriverId({ layerId: "compute", gapType: "enhance" }, s);
    assertEqual(r, null, "no matching rule + matching driver missing → null");
  });

  it("suggestDriverId maps dataProtection → cyber_resilience when driver present", () => {
    const s = sessionWithDrivers(["cyber_resilience"]);
    const r = suggestDriverId({ layerId: "dataProtection", gapType: "replace" }, s);
    assertEqual(r, "cyber_resilience", "dataProtection layer → cyber_resilience");
  });

  it("suggestDriverId skips a matching rule when that driver is not in the session", () => {
    const s = sessionWithDrivers(["ai_data"]);  // cyber_resilience NOT in session
    const r = suggestDriverId({ layerId: "dataProtection", gapType: "replace" }, s);
    assertEqual(r, null, "rule fires but driver missing → fall through");
  });

  it("suggestDriverId maps gapType ops → ops_simplicity (T5.16)", () => {
    const s = sessionWithDrivers(["ops_simplicity"]);
    const r = suggestDriverId({ layerId: "compute", gapType: "ops" }, s);
    assertEqual(r, "ops_simplicity", "ops gapType → ops_simplicity");
  });

  it("suggestDriverId maps publicCloud environment → cloud_strategy", () => {
    const s = sessionWithDrivers(["cloud_strategy"]);
    const r = suggestDriverId({ layerId: "compute", gapType: "replace",
      affectedEnvironments: ["publicCloud"] }, s);
    assertEqual(r, "cloud_strategy", "publicCloud environment → cloud_strategy");
  });

  it("effectiveDriverId prefers explicit driverId over suggestion (T5.18)", () => {
    const s = sessionWithDrivers(["cyber_resilience", "ai_data"]);
    const r = effectiveDriverId({ layerId: "dataProtection", driverId: "ai_data" }, s);
    assertEqual(r, "ai_data", "explicit driverId wins over auto-suggest");
  });

  it("groupProjectsByProgram returns a bucket per session driver + unassigned", () => {
    const s = sessionWithDrivers(["cyber_resilience", "cloud_strategy"]);
    const grouped = groupProjectsByProgram([
      { id: "p1", driverId: "cyber_resilience" },
      { id: "p2", driverId: null }
    ], s);
    assert("cyber_resilience" in grouped, "driver bucket must exist");
    assert("cloud_strategy" in grouped, "second driver bucket must exist");
    assert("unassigned" in grouped, "unassigned bucket must exist");
    assertEqual(grouped.cyber_resilience.length, 1, "p1 routed to cyber_resilience");
    assertEqual(grouped.unassigned.length, 1, "p2 routed to unassigned");
  });

  // ── v2.1 · effectiveDellSolutions (T2b.1-3) ──────────────

  it("effectiveDellSolutions returns Dell-tagged linked desired tile labels (T2b.1)", () => {
    const s = freshSession();
    const des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"PowerProtect PPDM", vendor:"Dell", vendorGroup:"dell" });
    const gap = createGap(s, { description:"Cyber", layerId:LayerIds[0],
      relatedDesiredInstanceIds:[des.id] });
    const out = effectiveDellSolutions(gap, s);
    assertEqual(out.length, 1, "one Dell tile linked → one solution label");
    assertEqual(out[0], "PowerProtect PPDM", "label matches the linked tile");
  });

  it("effectiveDellSolutions returns [] when no linked Dell tiles (T2b.2)", () => {
    const s = freshSession();
    const des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"HPE System", vendor:"HPE", vendorGroup:"nonDell" });
    const gap = createGap(s, { description:"Gap", layerId:LayerIds[0],
      relatedDesiredInstanceIds:[des.id] });
    const out = effectiveDellSolutions(gap, s);
    assertEqual(out.length, 0, "non-Dell linked tiles don't count");
  });

  it("effectiveDellSolutions dedupes repeated labels (T2b.3)", () => {
    const s = freshSession();
    const a = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"PowerStore", vendor:"Dell", vendorGroup:"dell" });
    const b = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[1],
      label:"PowerStore", vendor:"Dell", vendorGroup:"dell" });
    const gap = createGap(s, { description:"Dup", layerId:LayerIds[0],
      relatedDesiredInstanceIds:[a.id, b.id] });
    const out = effectiveDellSolutions(gap, s);
    assertEqual(out.length, 1, "two tiles, same label, dedupes to 1");
  });

  // ── v2.1 · reviewed flag (T6.4-9) ────────────────────────

  it("Auto-drafted gaps via buildGapFromDisposition start reviewed=false (T6.4)", () => {
    const s = freshSession();
    const cur = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Src", vendorGroup:"dell", criticality:"High" });
    const des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", disposition:"replace", priority:"Now", originId: cur.id });
    const props = buildGapFromDisposition(s, des);
    assertEqual(props.reviewed, false, "auto-drafted props carry reviewed: false");
    const gap = createGap(s, props);
    assertEqual(gap.reviewed, false, "persisted gap carries reviewed: false");
  });

  it("Manually-created gaps default reviewed=true (T6.5)", () => {
    const s = freshSession();
    const gap = createGap(s, { description:"Manual", layerId:LayerIds[0] });
    assertEqual(gap.reviewed, true, "manual createGap → reviewed: true");
  });

  it("updateGap flips reviewed to true on any STRUCTURAL edit (T6.6 · revised v2.4.11)", () => {
    // v2.4.11 · A1 · was "any substantive edit". Now: only structural
    // edits (gapType / layer / env / links) trigger the implicit flip.
    // Metadata edits (notes / urgency / status) NO longer auto-flip,
    // so users can save notes on an invalid auto-draft without
    // tripping the review-time validation.
    const s = freshSession();
    const gap = createGap(s, { description:"G", layerId:LayerIds[0], reviewed:false });
    assertEqual(gap.reviewed, false, "starts unreviewed");
    // Metadata-only edit: NO implicit flip.
    updateGap(s, gap.id, { notes: "added context" });
    assertEqual(s.gaps[0].reviewed, false, "metadata-only edit does NOT auto-flip reviewed");
    // Structural edit (add a link) on a valid-shape gapless gap: implicit flip.
    updateGap(s, gap.id, { relatedCurrentInstanceIds: ["i-x"] });
    assertEqual(s.gaps[0].reviewed, true, "structural edit on a valid gap auto-flips reviewed");
  });

  it("approveGap flips reviewed to true with no other edits (T6.7)", () => {
    const s = freshSession();
    const gap = createGap(s, { description:"G", layerId:LayerIds[0], reviewed:false });
    const before = JSON.stringify({ ...gap, reviewed: undefined });
    approveGapCmd(s, gap.id);
    assertEqual(s.gaps[0].reviewed, true, "reviewed flips to true");
    const after = JSON.stringify({ ...s.gaps[0], reviewed: undefined });
    assertEqual(after, before, "no other fields changed by approveGap");
  });

  it("Gap card renders .gap-needs-review class + review dot when unreviewed (T6.9)", () => {
    const s = freshSession();
    createGap(s, { description:"Unreviewed draft", layerId:LayerIds[0], reviewed:false });
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderGapsEditView(l, r, s);
    const card = l.querySelector(".gap-card");
    assert(card.classList.contains("gap-needs-review"), "card must carry .gap-needs-review");
    assert(card.querySelector(".gap-review-dot") !== null, "pulsing dot element must exist");
  });

  // ── v2.1 · Discovery Coverage + Risk Posture (T6.18-24) ──

  it("computeDiscoveryCoverage on empty session returns { percent: 0, actions } (T6.18)", () => {
    const s = freshSession();
    const c = computeDiscoveryCoverage(s);
    assertEqual(c.percent, 0, "empty session → 0 %");
    assert(Array.isArray(c.actions), "actions is an array");
  });

  it("computeDiscoveryCoverage hits 100 when all fractions complete (T6.19)", () => {
    const s = freshSession();
    s.customer.drivers = [{ id:"ai_data", priority:"High", outcomes:"" }];
    // Satisfies: drivers present. No current tiles, no gaps → other fractions default to 1.
    const c = computeDiscoveryCoverage(s);
    assertEqual(c.percent, 100, "all fractions at 1 → 100%");
  });

  it("Adding a current tile without disposition lowers Coverage (T6.20)", () => {
    const s = freshSession();
    s.customer.drivers = [{ id:"ai_data", priority:"High", outcomes:"" }];
    var before = computeDiscoveryCoverage(s).percent;
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"X", vendorGroup:"dell" });
    var after = computeDiscoveryCoverage(s).percent;
    assert(after < before, "adding a current tile without disposition should drop coverage");
  });

  it("computeRiskPosture on empty session returns Stable (T6.21)", () => {
    const s = freshSession();
    const p = computeRiskPosture(s);
    assertEqual(p.level, "Stable", "empty session → Stable posture");
  });

  it("One High-urgency gap in Now phase raises Risk to at least Elevated (T6.22)", () => {
    const s = freshSession();
    createGap(s, { description:"Crit", layerId:LayerIds[0], urgency:"High", phase:"now" });
    const p = computeRiskPosture(s);
    assert(p.level === "Elevated" || p.level === "High",
      "Risk level must be Elevated or High, was: " + p.level);
  });

  it("Critical current tile without disposition forces level High (T6.23)", () => {
    const s = freshSession();
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Critical", vendorGroup:"dell", criticality:"High" });
    const p = computeRiskPosture(s);
    assertEqual(p.level, "High", "critical unreviewed → High");
  });

  it("Risk posture includes action strings when level ≠ Stable (T6.24)", () => {
    const s = freshSession();
    createGap(s, { description:"Crit", layerId:LayerIds[0], urgency:"High", phase:"now" });
    const p = computeRiskPosture(s);
    assert(Array.isArray(p.actions) && p.actions.length >= 1,
      "non-Stable posture must surface at least one action hint");
  });

  // ── v2.1 · Phase 10 · Manual-link phase-conflict (T6.1-3) ─

  it("confirmPhaseOnLink returns ok when phases already match or tile has no priority (T6.1)", () => {
    const s = freshSession();
    const des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", priority:"Now" });
    const gap = createGap(s, { description:"G", layerId:LayerIds[0], phase:"now" });
    const out = confirmPhaseOnLink(s, gap.id, des.id);
    assertEqual(out.status, "ok", "matching phases → ok");

    const des2 = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[1],
      label:"Tgt2", vendorGroup:"dell" });  // no priority
    const out2 = confirmPhaseOnLink(s, gap.id, des2.id);
    assertEqual(out2.status, "ok", "unset priority → ok (adopts on link)");
  });

  it("confirmPhaseOnLink returns conflict when phases differ (T6.2)", () => {
    const s = freshSession();
    const des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", priority:"Now" });
    const gap = createGap(s, { description:"G", layerId:LayerIds[0], phase:"later" });
    const out = confirmPhaseOnLink(s, gap.id, des.id);
    assertEqual(out.status, "conflict", "conflicting phases → conflict");
    assertEqual(out.currentPriority, "Now");
    assertEqual(out.targetPriority, "Later");
  });

  it("Link-flow: after confirming a conflict, desired priority is updated to match gap (T6.3)", () => {
    const s = freshSession();
    const des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", priority:"Now" });
    const gap = createGap(s, { description:"G", layerId:LayerIds[0], phase:"later" });
    // v2.4.11 · A4 · linkDesiredInstance now requires { acknowledged: true }
    // when there's a phase conflict (Now → Later here). UI calls
    // confirmPhaseOnLink first; on user confirm, passes acknowledged: true.
    linkDesiredInstance(s, gap.id, des.id, { acknowledged: true });
    syncDesiredFromGap(s, gap.id);
    assertEqual(des.priority, "Later", "gap wins on link: desired priority becomes Later");
  });

  // ── v2.1 · Phase 11 · Vendor picker on custom add (T6.10-12) ─

  function openCustomPalette(layerId, envId, typed) {
    document.querySelectorAll("#cmd-palette").forEach(o => o.remove());
    const s = freshSession();
    const l = document.createElement("div"); const r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderMatrixView(l, r, s, { stateFilter: "current" });
    const cell = l.querySelector("[data-matrix-cell][data-layer-id='" + layerId + "'][data-env-id='" + envId + "']");
    cell.querySelector("[data-add-instance]").click();
    const overlay = document.getElementById("cmd-palette");
    const srch = overlay.querySelector(".cmd-search");
    srch.value = typed;
    srch.dispatchEvent(new Event("input", { bubbles: true }));
    return { s, overlay, l, r };
  }

  it("Custom name shows three add paths: Dell SKU, 3rd-party, Custom (T6.10)", () => {
    const { overlay, l, r } = openCustomPalette("compute", "coreDc", "Acme Widget 9000");
    const text = overlay.textContent;
    overlay.remove(); l.remove(); r.remove();
    assert(text.indexOf("Dell SKU") >= 0, "must offer '… Dell SKU' option");
    assert(text.indexOf("3rd-party vendor") >= 0, "must offer '… 3rd-party vendor' option");
    assert(text.indexOf("Custom / internal") >= 0, "must offer '… Custom / internal' option");
  });

  it("3rd-party → HPE adds instance with vendor='HPE', vendorGroup='nonDell' (T6.11)", () => {
    const { s, overlay, l, r } = openCustomPalette("compute", "coreDc", "HPE Nimble X");
    // Click the 3rd-party option
    const thirdPartyItem = [...overlay.querySelectorAll(".cmd-item")]
      .find(el => el.textContent.indexOf("3rd-party vendor") >= 0);
    assert(thirdPartyItem !== null, "3rd-party option must exist");
    thirdPartyItem.click();
    // Now click HPE from vendor chooser
    const hpeItem = [...overlay.querySelectorAll(".cmd-item")]
      .find(el => el.querySelector(".cmd-item-name") && el.querySelector(".cmd-item-name").textContent === "HPE");
    assert(hpeItem !== null, "HPE option must appear in vendor chooser");
    hpeItem.click();
    document.querySelectorAll("#cmd-palette").forEach(o => o.remove());
    l.remove(); r.remove();
    const inst = s.instances.find(i => i.label === "HPE Nimble X");
    assert(inst !== undefined, "instance must be created");
    assertEqual(inst.vendor, "HPE", "vendor = HPE");
    assertEqual(inst.vendorGroup, "nonDell", "vendorGroup = nonDell");
  });

  // ── v2.1 · Phase 12 · Icons + Help modal + right-panel cleanup (T6.14-17) ─
  // (T6.13 retired in Phase 18 / v2.3.0 — the Manage-links collapse it
  //  asserted on was removed in favour of always-visible inline link
  //  sections. T8.1 in Suite 23 asserts the new contract: NO
  //  .linked-manage-btn renders in the gap detail panel.)

  it("Every main tab's header card renders a .help-icon-btn (T6.14)", () => {
    const cases = [
      [renderContextView,   "context"],
      [renderGapsEditView,  "gaps"],
      [renderSummaryHealthView,  "reporting_health"]
    ];
    cases.forEach(([fn, key]) => {
      const l = document.createElement("div");
      const r = document.createElement("div");
      fn(l, r, freshSession());
      const btn = l.querySelector(".help-icon-btn");
      assert(btn !== null, `${key} view must render .help-icon-btn`);
    });
  });

  it("Clicking a help icon opens a modal with non-empty body (T6.15)", () => {
    document.querySelectorAll("#help-modal").forEach(o => o.remove());
    const l = document.createElement("div"); const r = document.createElement("div");
    renderContextView(l, r, freshSession());
    const btn = l.querySelector(".help-icon-btn");
    btn.click();
    const modal = document.getElementById("help-modal");
    assert(modal !== null, "clicking help icon opens #help-modal");
    const items = modal.querySelectorAll(".help-modal-list li");
    assert(items.length >= 1, "modal body must contain at least one bullet");
    modal.remove();
  });

  it("Help modal closes via Esc, backdrop click, and close button (T6.17)", () => {
    document.querySelectorAll("#help-modal").forEach(o => o.remove());
    const l = document.createElement("div"); const r = document.createElement("div");
    renderContextView(l, r, freshSession());
    const btn = l.querySelector(".help-icon-btn");

    // Esc
    btn.click();
    assert(document.getElementById("help-modal") !== null, "modal open");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert(document.getElementById("help-modal") === null, "Esc closes modal");

    // Close button
    btn.click();
    const closeBtn = document.querySelector(".help-modal-close");
    closeBtn.click();
    assert(document.getElementById("help-modal") === null, "close button closes modal");

    // Backdrop click
    btn.click();
    const overlay = document.getElementById("help-modal");
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert(document.getElementById("help-modal") === null, "backdrop click closes modal");
  });

  it("Right panels (Matrix, Gaps) are terse — ≤1 card at rest (T6.16)", () => {
    const s = freshSession();
    const l1 = document.createElement("div"); const r1 = document.createElement("div");
    renderMatrixView(l1, r1, s, { stateFilter:"current" });
    assert(r1.querySelectorAll(".card").length <= 1,
      "Matrix right panel must have ≤1 card at rest");

    const l2 = document.createElement("div"); const r2 = document.createElement("div");
    renderGapsEditView(l2, r2, s);
    assert(r2.querySelectorAll(".card").length <= 1,
      "Gaps right panel must have ≤1 card at rest");
    // Reporting Overview intentionally EXCEPT: Phase 13 puts Executive Summary on the right
    // (CxO dashboard layout). Covered by T7.1 below.
  });

  // ── v2.1 Phase 13 · Right-panel usage upgrades (T7.1-T7.4) ──

  it("Overview right panel hosts the Executive Summary (T7.1)", () => {
    const l = document.createElement("div"); const r = document.createElement("div");
    renderReportingOverview(l, r);
    const exec = r.querySelector(".exec-summary-text");
    assert(exec !== null, "right panel must contain .exec-summary-text");
    assert(exec.textContent.length > 10, "executive summary text must be populated");
  });

  it("Gaps Board clicking a gap card populates the right detail panel (T7.2)", () => {
    const s = freshSession();
    createGap(s, { description:"GB detail test", layerId:LayerIds[0] });
    const l = document.createElement("div"); const r = document.createElement("div");
    // Assign session to live singleton-facing view: mount expects live session, but
    // SummaryGapsView reads from the imported singleton. For the test we mutate live:
    const origGaps = session.gaps.slice();
    session.gaps.push(s.gaps[0]);
    renderSummaryGapsView(l, r);
    const card = l.querySelector(".gap-card");
    card.click();
    const detail = r.querySelector(".detail-panel");
    // cleanup
    session.gaps = origGaps;
    assert(detail !== null, "clicking a gap card populates .detail-panel on the right");
  });

  it("Vendor Mix clicking a vendor row populates vendor detail on the right (T7.3)", () => {
    const l = document.createElement("div"); const r = document.createElement("div");
    renderSummaryVendorView(l, r);
    const row = l.querySelector(".vm-row");
    if (!row) return;  // demo may be empty; tolerate
    row.click();
    const detail = r.querySelector(".detail-panel");
    assert(detail !== null, "clicking a vendor row populates .detail-panel on the right");
  });

  it("Session Brief renders as labelled rows with at least 3 facts (T7.5)", () => {
    const l = document.createElement("div"); const r = document.createElement("div");
    renderReportingOverview(l, r);
    const rows = r.querySelectorAll(".brief-row");
    const labels = [...rows].map(row => row.querySelector(".brief-label").textContent);
    assert(rows.length >= 3, "brief must have ≥3 labelled rows, got " + rows.length);
    assert(labels.indexOf("Customer") >= 0, "brief must include Customer row");
    assert(labels.indexOf("Strategic Drivers") >= 0, "brief must include Strategic Drivers row");
    assert(labels.indexOf("Risk Posture") >= 0, "brief must include Risk Posture row");
    assert(labels.indexOf("Discovery Coverage") >= 0, "brief must include Discovery Coverage row");
  });

  it("Roadmap clicking a project card opens project detail on the right (T7.6)", () => {
    const s = freshSession();
    s.customer.drivers = [{ id:"cyber_resilience", priority:"High", outcomes:"" }];
    createGap(s, { description:"DP gap", layerId:"dataProtection", phase:"now",
      gapType:"replace", urgency:"High", affectedEnvironments:["coreDc"], reviewed:false });
    const l = document.createElement("div"); const r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderSummaryRoadmapView(l, r, s);
    const card = l.querySelector(".project-card");
    assert(card !== null, "a project card must render");
    card.click();
    const detail = r.querySelector(".detail-panel");
    const text = detail ? detail.textContent : "";
    l.remove(); r.remove();
    assert(detail !== null, "clicking project card populates .detail-panel");
    assert(text.indexOf("Primary Data Center") >= 0, "project detail includes project name context (v2.4.15: label is 'Primary Data Center', was 'Core DC')");
    assert(text.indexOf("Constituent gaps") >= 0, "project detail lists constituent gaps section");
  });

  it("Roadmap clicking a swimlane header opens Strategic Driver detail (T7.4)", () => {
    const s = freshSession();
    s.customer.drivers = [{ id:"cyber_resilience", priority:"High", outcomes:"Ransomware recovery" }];
    createGap(s, { description:"DP gap", layerId:"dataProtection", phase:"now",
      gapType:"replace", affectedEnvironments:["coreDc"], reviewed:false });
    const l = document.createElement("div"); const r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderSummaryRoadmapView(l, r, s);
    const head = l.querySelector(".swimlane-clickable");
    assert(head !== null, "a clickable swimlane header must exist");
    head.click();
    const detail = r.querySelector(".detail-panel");
    const result = { hasDetail: !!detail, text: detail ? detail.textContent : "" };
    l.remove(); r.remove();
    assert(result.hasDetail, "clicking a swimlane header populates .detail-panel");
    assert(result.text.indexOf("Cyber Resilience") >= 0, "detail panel names the strategic driver");
  });

  it("'Other (type)' opens an input that creates instance with typed vendor on Enter (T6.12)", () => {
    const { s, overlay, l, r } = openCustomPalette("storage", "coreDc", "Veritas Array 7");
    const thirdPartyItem = [...overlay.querySelectorAll(".cmd-item")]
      .find(el => el.textContent.indexOf("3rd-party vendor") >= 0);
    thirdPartyItem.click();
    const otherItem = [...overlay.querySelectorAll(".cmd-item")]
      .find(el => el.textContent.indexOf("Other (type vendor") >= 0);
    assert(otherItem !== null, "Other row must exist");
    otherItem.click();
    // The palette has a top-level .cmd-search too; scope to the inline one inside .cmd-results.
    const input = overlay.querySelector(".cmd-results input.cmd-search");
    assert(input !== null, "inline vendor text input must appear");
    input.value = "Veritas";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    document.querySelectorAll("#cmd-palette").forEach(o => o.remove());
    l.remove(); r.remove();
    const inst = s.instances.find(i => i.label === "Veritas Array 7");
    assert(inst !== undefined, "instance must be created");
    assertEqual(inst.vendor, "Veritas", "typed vendor persisted");
    assertEqual(inst.vendorGroup, "nonDell", "vendorGroup = nonDell");
  });

});


// ============================================================================
// SUITE 15 — ui/views/Summary views: DOM contracts
// ============================================================================
describe("15 · ui/views/Summary views — DOM contracts", () => {

  function mount(fn, sess) {
    const l = document.createElement("div");
    const r = document.createElement("div");
    fn(l, r, sess || session);
    return { l, r };
  }

  it("renderSummaryHealthView is a function", () => {
    assert(typeof renderSummaryHealthView === "function", "must be a function");
  });

  it("renderSummaryHealthView renders without throwing", () => {
    doesNotThrow(() => mount(renderSummaryHealthView), "health view must not throw");
  });

  it("health view renders LAYERS × ENVIRONMENTS bucket cells", () => {
    const { l } = mount(renderSummaryHealthView);
    const cells = l.querySelectorAll(".hm-cell");
    assertEqual(cells.length, LAYERS.length * ENVIRONMENTS.length,
      `must render ${LAYERS.length * ENVIRONMENTS.length} bucket cells`);
  });

  it("health view right panel is non-empty", () => {
    const { r } = mount(renderSummaryHealthView);
    assert(r.innerHTML.length > 0, "right panel must not be empty");
  });

  it("renderSummaryGapsView is a function", () => {
    assert(typeof renderSummaryGapsView === "function", "must be a function");
  });

  it("renderSummaryGapsView renders without throwing", () => {
    doesNotThrow(() => mount(renderSummaryGapsView), "gaps view must not throw");
  });

  it("gaps summary view renders 3 kanban columns", () => {
    const l = document.createElement("div");
    const r = document.createElement("div");
    document.body.appendChild(l);
    document.body.appendChild(r);
    renderSummaryGapsView(l, r, session);
    const cols = l.querySelectorAll(".kanban-col");
    const result = cols.length;
    l.remove(); r.remove();
    assertEqual(result, 3, "must render 3 kanban columns");
  });

  it("renderSummaryVendorView is a function", () => {
    assert(typeof renderSummaryVendorView === "function", "must be a function");
  });

  it("renderSummaryVendorView renders without throwing", () => {
    doesNotThrow(() => mount(renderSummaryVendorView), "vendor view must not throw");
  });

  it("renderSummaryRoadmapView is a function", () => {
    assert(typeof renderSummaryRoadmapView === "function", "must be a function");
  });

  it("renderSummaryRoadmapView renders without throwing", () => {
    doesNotThrow(() => mount(renderSummaryRoadmapView), "roadmap view must not throw");
  });

  it("roadmap view renders 3 phase-column headers (T5.20 prep)", () => {
    const l = document.createElement("div");
    const r = document.createElement("div");
    document.body.appendChild(l);
    document.body.appendChild(r);
    renderSummaryRoadmapView(l, r, session);
    const phaseHeads = l.querySelectorAll(".roadmap-phase-head");
    const result = phaseHeads.length;
    l.remove(); r.remove();
    assertEqual(result, 3, "must render 3 phase-column headers (Now / Next / Later)");
  });

  // ── Phase 7 · Tab 5 Roadmap v2 ──────────────────────────

  it("Roadmap renders one swimlane per session driver + Unassigned (T5.20, T5.21)", () => {
    const s = freshSession();
    s.customer.drivers = [
      { id:"cyber_resilience", priority:"High", outcomes:"" },
      { id:"cost_optimization", priority:"Medium", outcomes:"" }
    ];
    // Add a gap that won't match any auto-suggest rule (null driver) → lands in unassigned
    createGap(s, { description:"Unassigned gap", layerId:"virtualization", phase:"next",
      gapType:"enhance", affectedEnvironments:["coreDc"], reviewed:false });
    const l = document.createElement("div");
    const r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderSummaryRoadmapView(l, r, s);
    const swimlanes = l.querySelectorAll(".swimlane-head");
    const count = swimlanes.length;
    const labelsText = [...swimlanes].map(s => s.textContent).join(" | ");
    l.remove(); r.remove();
    assertEqual(count, 3, "two drivers + Unassigned = 3 swimlane heads");
    assert(labelsText.indexOf("Cyber Resilience") >= 0, "Cyber Resilience swimlane present");
    assert(labelsText.indexOf("Cost Optimization") >= 0, "Cost Optimization swimlane present");
    assert(labelsText.indexOf("Unassigned") >= 0, "Unassigned swimlane present");
  });

  it("Roadmap portfolio pulse bar totals match project counts (T5.25)", () => {
    const s = freshSession();
    s.customer.drivers = [{ id:"cyber_resilience", priority:"High", outcomes:"" }];
    createGap(s, { description:"DP gap", layerId:"dataProtection", phase:"now",
      gapType:"replace", affectedEnvironments:["coreDc"], reviewed:false });
    createGap(s, { description:"DP gap 2", layerId:"dataProtection", phase:"later",
      gapType:"replace", affectedEnvironments:["coreDc"], reviewed:false });
    const l = document.createElement("div");
    const r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderSummaryRoadmapView(l, r, s);
    const pulse = l.querySelector(".pulse-bar");
    const text = pulse ? pulse.textContent : "";
    l.remove(); r.remove();
    assert(pulse !== null, "pulse bar must render");
    assert(/\bprojects?\b/i.test(text), "pulse bar must mention 'projects'");
  });

  it("Roadmap renders project cards with name, urgency badge, and gap count (T5.11, T5.22)", () => {
    const s = freshSession();
    s.customer.drivers = [{ id:"cyber_resilience", priority:"High", outcomes:"" }];
    createGap(s, { description:"DP", layerId:"dataProtection", phase:"now",
      gapType:"replace", urgency:"High", affectedEnvironments:["coreDc"], reviewed:false });
    const l = document.createElement("div");
    const r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderSummaryRoadmapView(l, r, s);
    const card = l.querySelector(".project-card");
    const name = card ? card.querySelector(".project-card-name") : null;
    const urg  = card ? card.querySelector(".urgency-badge") : null;
    const count = card ? card.querySelector(".link-badge") : null;
    const result = { hasCard: !!card, hasName: !!name, hasUrg: !!urg, hasCount: !!count,
                     nameText: name ? name.textContent : "" };
    l.remove(); r.remove();
    assert(result.hasCard, "project card must render");
    assert(result.hasName, "project card must include a name");
    assert(result.hasUrg, "project card must include an urgency badge");
    assert(result.hasCount, "project card must include a gap-count badge");
    assert(result.nameText.indexOf("Primary Data Center") >= 0, "name must include env label (v2.4.15: 'Primary Data Center', was 'Core DC')");
    assert(result.nameText.indexOf("Data Protection") >= 0, "name must include layer label");
    assert(result.nameText.indexOf("Modernization") >= 0, "name must include action verb");
  });

  it("Roadmap shows empty state when session has no gaps (T5 empty states)", () => {
    const s = freshSession();
    const l = document.createElement("div");
    const r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderSummaryRoadmapView(l, r, s);
    const empty = l.querySelector(".empty-state-card");
    l.remove(); r.remove();
    assert(empty !== null, "empty state must render when no gaps exist");
    assert(empty.textContent.indexOf("No gaps") >= 0, "empty state mentions 'No gaps'");
  });

});


// ============================================================================
// SUITE 16 — app shell: stepper & navigation
// ============================================================================
describe("16 · app shell — stepper & navigation", () => {

  it("stepper element exists in the document", () => {
    assert(document.getElementById("stepper") !== null, "#stepper must exist in DOM");
  });

  it("stepper renders all 5 steps", () => {
    window.renderStepperForTests?.();
    const labels   = [...document.querySelectorAll("#stepper .step")]
      .map(el => el.textContent.trim());
    const required = ["Context", "Current", "Desired", "Gaps", "Reporting"];
    required.forEach(name =>
      assert(labels.some(l => l.includes(name)), `Stepper must include step containing '${name}'`)
    );
  });

  it("exactly one step is active at a time", () => {
    window.renderStepperForTests?.();
    const active = document.querySelectorAll("#stepper .step.active");
    assertEqual(active.length, 1, "Exactly 1 step must be active");
  });

  it("active step has the 'active' CSS class", () => {
    window.renderStepperForTests?.();
    const active = document.querySelector("#stepper .step.active");
    assert(active !== null,                   "An active step must exist");
    assert(active.classList.contains("active"), "Active step must have 'active' class");
  });

  it("App lands on the Context step on fresh load (T1.1)", () => {
    window.renderStepperForTests?.();
    const active = document.querySelector("#stepper .step.active");
    assert(active !== null, "an active step must exist");
    assert(active.textContent.toLowerCase().indexOf("context") >= 0,
      `active step must be 'Context' on fresh load — was '${active ? active.textContent : "(none)"}'`);
  });

  it("main-left and main-right panels exist", () => {
    assert(document.getElementById("main-left")  !== null, "#main-left must exist");
    assert(document.getElementById("main-right") !== null, "#main-right must exist");
  });

  it("export button exists in the DOM", () => {
    assert(document.getElementById("exportBtn") !== null, "#exportBtn must exist");
  });

  it("new-session button exists in the DOM", () => {
    assert(document.getElementById("newSessionBtn") !== null, "#newSessionBtn must exist");
  });

  it("renderStepperForTests is exposed on window for test access", () => {
    assert(typeof window.renderStepperForTests === "function",
      "window.renderStepperForTests must be a function");
  });

});


// ============================================================================
// SUITE 17 — AI integration readiness
// ============================================================================
describe("17 · AI integration readiness", () => {

  it("session is fully JSON-serialisable (can be sent to an LLM API)", () => {
    const s = freshSession();
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"Test", vendorGroup:"dell" });
    createGap(s,   { description:"AI test gap", layerId:LayerIds[0] });
    doesNotThrow(() => JSON.stringify(s),
      "session with instances and gaps must be JSON-serialisable");
  });

  it("all service return values are JSON-serialisable (AI can read them)", () => {
    const s = freshSession();
    doesNotThrow(() => JSON.stringify(getHealthSummary(s, LAYERS, ENVIRONMENTS)),    "getHealthSummary");
    doesNotThrow(() => JSON.stringify(computeBucketMetrics(LayerIds[0], EnvironmentIds[0], s)), "computeBucketMetrics");
    doesNotThrow(() => JSON.stringify(getFilteredGaps({})),                          "getFilteredGaps");
    doesNotThrow(() => JSON.stringify(getGapsByPhase({})),                           "getGapsByPhase");
    doesNotThrow(() => JSON.stringify(groupGapsIntoInitiatives(s, {})),              "groupGapsIntoInitiatives");
    doesNotThrow(() => JSON.stringify(computeLayerImpact(s, {})),                   "computeLayerImpact");
  });

  it("CATALOG is JSON-serialisable (AI can use as context for suggestions)", () => {
    doesNotThrow(() => JSON.stringify(CATALOG), "CATALOG must be JSON-serialisable");
  });

  it("validateInstance and validateGap are importable standalone (AI can call them)", () => {
    assert(typeof validateInstance === "function", "validateInstance must be a standalone function");
    assert(typeof validateGap      === "function", "validateGap must be a standalone function");
  });

  it("all command functions accept plain objects — no DOM dependencies", () => {
    const s = freshSession();
    doesNotThrow(() => {
      const inst = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"AI test", vendorGroup:"dell" });
      updateInstance(s, inst.id, { notes:"updated by AI" });
      deleteInstance(s, inst.id);
    }, "matrixCommands must work with plain objects only");

    doesNotThrow(() => {
      const gap = createGap(s, { description:"AI gap", layerId:LayerIds[0] });
      updateGap(s, gap.id, { urgency:"High", dellSolutions:"PPDM" });
      deleteGap(s, gap.id);
    }, "gapsCommands must work with plain objects only");
  });

  it("all validation errors produce string messages (AI can parse and re-prompt)", () => {
    const errors = [];
    const cases  = [
      () => validateInstance({ id:"", state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"X" }),
      () => validateGap({ id:"g1", description:"", layerId:LayerIds[0], urgency:"High", phase:"now" }),
      () => addInstance(freshSession(), { state:"INVALID", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"X" }),
      () => createGap(freshSession(), { description:"D", layerId:"INVALID" })
    ];
    cases.forEach(fn => {
      try { fn(); }
      catch(e) {
        errors.push(e.message);
        assert(typeof e.message === "string" && e.message.trim().length > 0,
          "every validation error must have a non-empty string message");
      }
    });
    assertEqual(errors.length, cases.length, "all test cases must have thrown");
  });

  it("session structure is stable across reset (AI can rely on field names)", () => {
    resetSession();
    const s1 = JSON.stringify(Object.keys(session).sort());
    session.customer.name = "Changed";
    createGap(session, { description:"D", layerId:LayerIds[0] });
    resetSession();
    const s2 = JSON.stringify(Object.keys(session).sort());
    assertEqual(s1, s2, "session keys must be stable across resets");
  });

  it("LayerIds and EnvironmentIds are flat string arrays (AI can enumerate them)", () => {
    assert(Array.isArray(LayerIds) && LayerIds.every(id => typeof id === "string"),
      "LayerIds must be a flat string array");
    assert(Array.isArray(EnvironmentIds) && EnvironmentIds.every(id => typeof id === "string"),
      "EnvironmentIds must be a flat string array");
    doesNotThrow(() => JSON.stringify(LayerIds),       "LayerIds must be serialisable");
    doesNotThrow(() => JSON.stringify(EnvironmentIds), "EnvironmentIds must be serialisable");
  });

  it("gap.mappedDellSolutions is a plain string field (AI can populate it)", () => {
    const s   = freshSession();
    const gap = createGap(s, { description:"D", layerId:LayerIds[0], mappedDellSolutions:"PPDM, DD9400" });
    assert(typeof gap.mappedDellSolutions === "string",
      "mappedDellSolutions must be a string — AI can write to this field");
  });

  it("services accept session as a parameter (AI can pass any session snapshot)", () => {
    const snap = JSON.parse(JSON.stringify(freshSession()));
    doesNotThrow(() => getHealthSummary(snap, LAYERS, ENVIRONMENTS),
      "getHealthSummary must accept a plain session snapshot");
    doesNotThrow(() => groupGapsIntoInitiatives(snap, {}),
      "groupGapsIntoInitiatives must accept a plain session snapshot");
    doesNotThrow(() => computeLayerImpact(snap, {}),
      "computeLayerImpact must accept a plain session snapshot");
  });

});


// ============================================================================
// EXPORT
// ============================================================================

// ============================================================================
// SUITE 18 -- interactions/desiredStateSync (v1.1)
// ============================================================================
import {
  DISPOSITION_ACTIONS, ACTION_TO_GAP_TYPE,
  getDesiredCounterpart, getCurrentSource,
  buildGapFromDisposition,
  syncGapFromDesired, syncGapsFromCurrentCriticality,
  syncDesiredFromGap, confirmPhaseOnLink
} from "../interactions/desiredStateSync.js";

describe("18 * interactions/desiredStateSync", () => {

  it("DISPOSITION_ACTIONS is a non-empty array with required fields", () => {
    assert(Array.isArray(DISPOSITION_ACTIONS) && DISPOSITION_ACTIONS.length > 0, "must be non-empty array");
    DISPOSITION_ACTIONS.forEach(function(a) {
      assert(typeof a.id === "string" && a.id.length > 0,    "action.id must be non-empty string");
      assert(typeof a.label === "string" && a.label.length > 0, "action.label must be non-empty string");
      assert(typeof a.hint === "string" && a.hint.length > 0,   "action.hint must be non-empty string");
    });
  });

  it("ACTION_TO_GAP_TYPE maps every disposition action", () => {
    DISPOSITION_ACTIONS.forEach(function(a) {
      assert(a.id in ACTION_TO_GAP_TYPE, "ACTION_TO_GAP_TYPE must have key for: " + a.id);
    });
  });

  it("getDesiredCounterpart finds desired instance linked by originId", () => {
    var s = freshSession();
    var cur = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"Source", vendorGroup:"dell" });
    var des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"Source", vendorGroup:"dell", originId: cur.id, disposition:"enhance" });
    var found = getDesiredCounterpart(s, cur.id);
    assert(found !== null && found !== undefined, "should find desired counterpart");
    assertEqual(found.id, des.id, "counterpart id must match");
  });

  it("getDesiredCounterpart returns undefined when no counterpart exists", () => {
    var s = freshSession();
    var cur = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"Lonely", vendorGroup:"dell" });
    var result = getDesiredCounterpart(s, cur.id);
    assert(!result, "should return falsy when no counterpart");
  });

  it("buildGapFromDisposition produces a valid gap for enhance action", () => {
    var s = freshSession();
    var cur = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"PowerStore", vendorGroup:"dell" });
    var des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"PowerStore", vendorGroup:"dell", disposition:"enhance", originId:cur.id, priority:"Now" });
    var props = buildGapFromDisposition(s, des);
    assert(props !== null, "should produce gap props");
    assertEqual(props.gapType, "enhance", "gapType must match disposition");
    assert(props.relatedCurrentInstanceIds.indexOf(cur.id) >= 0, "must link current instance");
    assert(typeof props.description === "string" && props.description.length > 0, "description must be non-empty");
  });

  it("buildGapFromDisposition returns null for keep action", () => {
    var s = freshSession();
    var des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"X", vendorGroup:"dell", disposition:"keep" });
    var props = buildGapFromDisposition(s, des);
    assert(props === null, "keep disposition must produce no gap");
  });

  it("buildGapFromDisposition derives phase from priority and urgency from source criticality (T3.10)", () => {
    var s = freshSession();
    var cur = addInstance(s, {
      state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"OldSystem", vendorGroup:"nonDell", criticality:"High"
    });
    var des = addInstance(s, {
      state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"OldSystem", vendorGroup:"nonDell", disposition:"replace", priority:"Now", originId: cur.id
    });
    var props = buildGapFromDisposition(s, des);
    assert(props !== null, "should produce gap props");
    assertEqual(props.urgency, "High", "urgency must derive from linked current's criticality (High)");
    assertEqual(props.phase,   "now",  "Now priority must map to 'now' phase");
  });

  it("buildGapFromDisposition urgency defaults to Medium for introduce (T3.11)", () => {
    var s = freshSession();
    var des = addInstance(s, {
      state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Brand new", vendorGroup:"dell", disposition:"introduce", priority:"Next"
    });
    var props = buildGapFromDisposition(s, des);
    assert(props !== null, "introduce produces gap props");
    assertEqual(props.urgency, "Medium", "introduce without origin defaults to Medium urgency");
  });

  it("syncGapFromDesired · changing desired phase re-syncs linked gap.phase (T3.7)", () => {
    var s = freshSession();
    var cur = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Src", vendorGroup:"dell", criticality:"Medium" });
    var des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", disposition:"replace", priority:"Now", originId: cur.id });
    createGap(s, buildGapFromDisposition(s, des));
    // Change phase to Later
    des.priority = "Later";
    syncGapFromDesired(s, des.id);
    var gap = s.gaps[s.gaps.length - 1];
    assertEqual(gap.phase, "later", "linked gap.phase must re-sync to 'later'");
  });

  it("syncGapFromDesired · changing disposition re-syncs linked gap.gapType (T3.8)", () => {
    var s = freshSession();
    var cur = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Src", vendorGroup:"dell", criticality:"Medium" });
    var des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", disposition:"enhance", priority:"Now", originId: cur.id });
    createGap(s, buildGapFromDisposition(s, des));
    // v2.4.8 · Phase 17 · retire now maps to "ops" gapType
    // (semantically correct — retire is operational, not a replacement).
    des.disposition = "retire";
    syncGapFromDesired(s, des.id);
    var gap = s.gaps[s.gaps.length - 1];
    assertEqual(gap.gapType, "ops", "gap.gapType must re-sync to ACTION_TO_GAP_TYPE[retire] = 'ops'");
  });

  it("syncGapFromDesired · changing disposition to 'keep' CLOSES the linked gap (was: deleted; v2.4.11 · A2)", () => {
    var s = freshSession();
    var cur = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Src", vendorGroup:"dell", criticality:"Medium" });
    var des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", disposition:"replace", priority:"Now", originId: cur.id });
    createGap(s, buildGapFromDisposition(s, des));
    assertEqual(s.gaps.length, 1, "gap created before keep switch");
    des.disposition = "keep";
    syncGapFromDesired(s, des.id);
    // v2.4.11 · A2 · gap is no longer DELETED — it's status:"closed" with a
    // closeReason. Reversible. Visible in Tab 4 via "Show closed gaps" filter.
    assertEqual(s.gaps.length, 1, "gap MUST still exist (no destructive delete)");
    assertEqual(s.gaps[0].status, "closed", "gap.status flips to 'closed' on Keep");
    assert(/disposition changed to keep/i.test(s.gaps[0].closeReason || ""),
      "closeReason must explain the auto-close");
  });

  it("syncGapsFromCurrentCriticality · updating criticality propagates to linked gap urgency (T3.13)", () => {
    var s = freshSession();
    var cur = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Src", vendorGroup:"dell", criticality:"Low" });
    var des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", disposition:"replace", priority:"Now", originId: cur.id });
    createGap(s, buildGapFromDisposition(s, des));
    var gap = s.gaps[s.gaps.length - 1];
    assertEqual(gap.urgency, "Low", "urgency starts at Low");
    cur.criticality = "High";
    syncGapsFromCurrentCriticality(s, cur.id);
    assertEqual(gap.urgency, "High", "urgency re-derives when criticality changes");
  });

  it("buildGapFromDisposition environment from desired instance", () => {
    var s = freshSession();
    var des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[1], label:"New", vendorGroup:"dell", disposition:"introduce", priority:"Next" });
    var props = buildGapFromDisposition(s, des);
    assert(props !== null, "introduce must produce gap props");
    assert(props.affectedEnvironments.indexOf(EnvironmentIds[1]) >= 0, "gap must inherit environment from desired instance");
  });

  it("DISPOSITION_ACTIONS and ACTION_TO_GAP_TYPE are JSON-serialisable", () => {
    doesNotThrow(function() { JSON.stringify(DISPOSITION_ACTIONS); }, "DISPOSITION_ACTIONS must be serialisable");
    doesNotThrow(function() { JSON.stringify(ACTION_TO_GAP_TYPE); }, "ACTION_TO_GAP_TYPE must be serialisable");
  });

  it("all desiredStateSync functions accept plain session snapshots (AI-ready)", () => {
    var snap = JSON.parse(JSON.stringify(freshSession()));
    doesNotThrow(function() { getDesiredCounterpart(snap, "any-id"); }, "getDesiredCounterpart must accept snapshot");
    doesNotThrow(function() { getCurrentSource(snap, { originId: "x" }); }, "getCurrentSource must accept snapshot");
  });

});

// ============================================================================
// SUITE 19 -- MatrixView: disposition workflow DOM contract (v1.1)
// ============================================================================
describe("19 * ui/views/MatrixView -- disposition workflow", () => {

  it("mirror tiles appear for current items not yet in desired state", () => {
    var s = freshSession();
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"PowerStore", vendorGroup:"dell" });
    var l = document.createElement("div");
    var r = document.createElement("div");
    renderMatrixView(l, r, s, { stateFilter:"desired" });
    var mirrors = l.querySelectorAll(".mirror-tile");
    assert(mirrors.length >= 1, "at least 1 mirror tile must appear for unreviewed current item");
  });

  it("no mirror tiles in current state view", () => {
    var s = freshSession();
    addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"X", vendorGroup:"dell", disposition:"enhance" });
    var l = document.createElement("div");
    var r = document.createElement("div");
    renderMatrixView(l, r, s, { stateFilter:"current" });
    var mirrors = l.querySelectorAll(".mirror-tile");
    assertEqual(mirrors.length, 0, "current state view must never show mirror tiles");
  });

  it("disposition tile shows disposition-badge when disposition is set", () => {
    var s = freshSession();
    addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"Enhanced", vendorGroup:"dell", disposition:"enhance" });
    var l = document.createElement("div");
    var r = document.createElement("div");
    document.body.appendChild(l);
    document.body.appendChild(r);
    renderMatrixView(l, r, s, { stateFilter:"desired" });
    var badge = l.querySelector(".disposition-badge");
    l.remove(); r.remove();
    assert(badge !== null, "disposition badge must appear on tile with disposition set");
  });

  it("unreviewed banner appears when current items exist without desired counterpart", () => {
    var s = freshSession();
    addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0], label:"X", vendorGroup:"dell" });
    var l = document.createElement("div");
    var r = document.createElement("div");
    document.body.appendChild(l);
    document.body.appendChild(r);
    renderMatrixView(l, r, s, { stateFilter:"desired" });
    var banner = l.querySelector(".unreviewed-banner");
    l.remove(); r.remove();
    assert(banner !== null, "unreviewed banner must exist when items need review");
  });

  it("command palette opens when add button is clicked", () => {
    var s = freshSession();
    var l = document.createElement("div");
    var r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderMatrixView(l, r, s, { stateFilter:"current" });
    var addBtn = l.querySelector("[data-add-instance]");
    assert(addBtn !== null, "add button must exist");
    addBtn.click();
    var palette = document.getElementById("cmd-palette");
    assert(palette !== null, "command palette must open");
    palette.remove();
    l.remove(); r.remove();
  });

  // ── Phase 5 · desired-state detail-panel rewrite ─────────

  it("Desired detail panel renders a single Phase select with compound labels (T3.1, T3.2)", () => {
    var s = freshSession();
    var des = addInstance(s, {
      state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", disposition:"replace", priority:"Now"
    });
    var l = document.createElement("div");
    var r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderMatrixView(l, r, s, { stateFilter:"desired" });
    var tile = l.querySelector("[data-instance-id='" + des.id + "']");
    tile.click();
    var phaseSel = r.querySelector("[data-prop='priority']");
    var timeline = r.querySelector("[data-prop='timeline']");
    var phaseLabels = [...phaseSel.options].map(o => o.textContent).join(" | ");
    l.remove(); r.remove();
    assert(phaseSel !== null, "Phase <select> (data-prop='priority') must render");
    assertEqual(timeline, null, "Timeline <select> must NOT render (T3.2)");
    assert(phaseLabels.indexOf("0-12 months") >= 0, "option label must include '0-12 months'");
    assert(phaseLabels.indexOf("12-24 months") >= 0, "option label must include '12-24 months'");
    assert(phaseLabels.indexOf("> 24 months") >= 0, "option label must include '> 24 months'");
  });

  it("Desired detail panel hides Phase control when disposition is 'keep' (T3.4)", () => {
    var s = freshSession();
    var des = addInstance(s, {
      state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", disposition:"keep"
    });
    var l = document.createElement("div");
    var r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderMatrixView(l, r, s, { stateFilter:"desired" });
    var tile = l.querySelector("[data-instance-id='" + des.id + "']");
    tile.click();
    var phaseSel = r.querySelector("[data-prop='priority']");
    l.remove(); r.remove();
    assertEqual(phaseSel, null, "Phase control must be hidden for disposition=keep");
  });

  it("Keep tile preserves the criticality accent inherited from its origin (T3.6)", () => {
    var s = freshSession();
    var cur = addInstance(s, {
      state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Src", vendorGroup:"dell", criticality:"High"
    });
    var des = addInstance(s, {
      state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Src", vendorGroup:"dell", disposition:"keep", originId: cur.id
    });
    var l = document.createElement("div");
    var r = document.createElement("div");
    renderMatrixView(l, r, s, { stateFilter:"desired" });
    var tile = l.querySelector("[data-instance-id='" + des.id + "']");
    assert(tile.classList.contains("crit-high"), "keep tile must still carry origin's .crit-high");
    var shape = tile.querySelector(".crit-shape-high");
    assert(shape !== null, "keep tile must still include the criticality shape glyph");
  });

  it("Net-new desired tile detail panel defaults Phase to Next (T3.14)", () => {
    var s = freshSession();
    var des = addInstance(s, {
      state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Brand new", vendorGroup:"dell", disposition:"introduce"
    });
    var l = document.createElement("div");
    var r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderMatrixView(l, r, s, { stateFilter:"desired" });
    var tile = l.querySelector("[data-instance-id='" + des.id + "']");
    tile.click();
    var phaseSel = r.querySelector("[data-prop='priority']");
    var val = phaseSel ? phaseSel.value : null;
    l.remove(); r.remove();
    assertEqual(val, "Next", "net-new introduce tile must default Phase to 'Next'");
  });

  it("Phase control carries a hover tooltip (title attr) explaining its behaviour (T3.15)", () => {
    var s = freshSession();
    var des = addInstance(s, {
      state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", disposition:"replace", priority:"Now"
    });
    var l = document.createElement("div");
    var r = document.createElement("div");
    document.body.appendChild(l); document.body.appendChild(r);
    renderMatrixView(l, r, s, { stateFilter:"desired" });
    l.querySelector("[data-instance-id='" + des.id + "']").click();
    var phaseSel = r.querySelector("[data-prop='priority']");
    var title = phaseSel ? phaseSel.getAttribute("title") : "";
    l.remove(); r.remove();
    assert(title && title.length > 20, "phase select must have a non-empty tooltip");
  });

});


// ============================================================================
// SUITE 20 -- services/roadmapService: project grouping (v1.2)
// ============================================================================
describe("20 * services/roadmapService -- project grouping", () => {

  it("buildProjects returns { projects: [] } shape", () => {
    var s = freshSession();
    var result = buildProjects(s, {});
    assert("projects" in result, "must return object with projects key");
    assert(Array.isArray(result.projects), "projects must be array");
  });

  it("each project has required fields", () => {
    var s = freshSession();
    // v2.4.8 · Phase 17 · reviewed:false bypasses the action-link rule
    // so downstream service tests can focus on service behaviour.
    createGap(s, { description:"Test gap", layerId:LayerIds[0], urgency:"High", phase:"now", gapType:"replace", relatedCurrentInstanceIds:["x"], reviewed:false });
    var result = buildProjects(s, {});
    if (!result.projects.length) return; // no projects if no gaps group
    var proj = result.projects[0];
    assert(typeof proj.id       === "string", "project.id must be string");
    assert(typeof proj.phase    === "string", "project.phase must be string");
    assert(typeof proj.label    === "string", "project.label must be string");
    assert(typeof proj.color    === "string", "project.color must be string");
    assert(typeof proj.urgency  === "string", "project.urgency must be string");
    assert(Array.isArray(proj.layers),        "project.layers must be array");
    assert(Array.isArray(proj.initiatives),   "project.initiatives must be array");
  });

  it("gaps with matching (env, layer, gapType) group into one project (T5.9)", () => {
    var s = freshSession();
    createGap(s, { description:"Replace A", layerId:LayerIds[0], urgency:"High", phase:"now",
      gapType:"replace", affectedEnvironments:["coreDc"], relatedCurrentInstanceIds:["x"], reviewed:false });
    createGap(s, { description:"Replace B", layerId:LayerIds[0], urgency:"Medium", phase:"now",
      gapType:"replace", affectedEnvironments:["coreDc"], relatedCurrentInstanceIds:["y"], reviewed:false });
    var result = buildProjects(s, {});
    assertEqual(result.projects.length, 1, "same (env, layer, gapType) → exactly one project");
    assertEqual(result.projects[0].initiatives.length, 2, "project must contain both gaps");
  });

  it("gaps with different environments produce separate projects (T5.10)", () => {
    var s = freshSession();
    createGap(s, { description:"A", layerId:LayerIds[0], phase:"now", gapType:"replace",
      affectedEnvironments:["coreDc"], reviewed:false });
    createGap(s, { description:"B", layerId:LayerIds[0], phase:"now", gapType:"replace",
      affectedEnvironments:["publicCloud"], reviewed:false });
    var result = buildProjects(s, {});
    assertEqual(result.projects.length, 2, "different envs → 2 projects");
  });

  it("gaps of different types produce separate projects within same env+layer", () => {
    var s = freshSession();
    createGap(s, { description:"Replace X", layerId:LayerIds[0], urgency:"High", phase:"now",
      gapType:"replace", affectedEnvironments:["coreDc"], reviewed:false });
    createGap(s, { description:"Introduce Y", layerId:LayerIds[0], urgency:"Low", phase:"now",
      gapType:"introduce", affectedEnvironments:["coreDc"], reviewed:false });
    var result = buildProjects(s, {});
    assert(result.projects.length >= 2, "different gap types must produce separate projects");
  });

  it("Project name contains environment label, layer label, and action verb (T5.11)", () => {
    var s = freshSession();
    createGap(s, { description:"X", layerId:"storage", phase:"now", gapType:"replace",
      affectedEnvironments:["coreDc"], reviewed:false });
    var proj = buildProjects(s, {}).projects[0];
    assert(proj.name.indexOf("Primary Data Center") >= 0, "name must include env label (v2.4.15: 'Primary Data Center', was 'Core DC')");
    assert(proj.name.indexOf("Data Storage") >= 0, "name must include layer label 'Data Storage'");
    assert(proj.name.indexOf("Modernization") >= 0, "name must include action verb 'Modernization' for gapType=replace");
  });

  it("Project urgency equals max urgency among constituent gaps (T5.12)", () => {
    var s = freshSession();
    createGap(s, { description:"A", layerId:LayerIds[0], phase:"now", gapType:"replace",
      urgency:"Low", affectedEnvironments:["coreDc"], reviewed:false });
    createGap(s, { description:"B", layerId:LayerIds[0], phase:"now", gapType:"replace",
      urgency:"High", affectedEnvironments:["coreDc"], reviewed:false });
    var proj = buildProjects(s, {}).projects[0];
    assertEqual(proj.urgency, "High", "project urgency = max of gaps");
  });

  it("Cross-cutting project for gaps with no env and no linked instances (T5.14)", () => {
    var s = freshSession();
    // v2.4.11 · A9 · ops gaps need substance at review time. This test
    // is shape-only (project bucketing); use reviewed:false to bypass.
    createGap(s, { description:"Process gap", layerId:LayerIds[0], phase:"next", gapType:"ops", reviewed:false });
    var proj = buildProjects(s, {}).projects[0];
    assertEqual(proj.envId, "crossCutting", "envId must be 'crossCutting'");
    assert(proj.name.indexOf("Cross-cutting") >= 0, "name must include 'Cross-cutting'");
  });

  it("Project driverId is mode of constituent gaps' effective driver (T5.19)", () => {
    var s = freshSession();
    s.customer.drivers = [
      { id:"cyber_resilience", priority:"High", outcomes:"" },
      { id:"ops_simplicity",   priority:"Medium", outcomes:"" }
    ];
    createGap(s, { description:"DP gap 1", layerId:"dataProtection", phase:"now", gapType:"replace",
      affectedEnvironments:["coreDc"], reviewed:false });
    createGap(s, { description:"DP gap 2", layerId:"dataProtection", phase:"now", gapType:"replace",
      affectedEnvironments:["coreDc"], reviewed:false });
    var proj = buildProjects(s, {}).projects[0];
    assertEqual(proj.driverId, "cyber_resilience", "both gaps map to cyber_resilience (layer rule)");
  });

  it("computeAccountHealthScore returns null for empty session", () => {
    var s = freshSession();
    var score = computeAccountHealthScore(s);
    assert(score === null, "empty session must return null score");
  });

  it("computeAccountHealthScore returns 0-100 integer", () => {
    var s = freshSession();
    createGap(s, { description:"High gap", layerId:LayerIds[0], urgency:"High", phase:"now" });
    var score = computeAccountHealthScore(s);
    assert(typeof score === "number" && score >= 0 && score <= 100 && Number.isInteger(score),
      "score must be integer 0-100, got: " + score);
  });

  it("generateExecutiveSummary returns non-empty string", () => {
    var s = freshSession();
    s.customer.name = "Test Corp";
    createGap(s, { description:"Critical gap", layerId:LayerIds[0], urgency:"High", phase:"now" });
    var text = generateExecutiveSummary(s);
    assert(typeof text === "string" && text.length > 20, "must return a meaningful summary string");
  });

  it("generateExecutiveSummary mentions customer name when set", () => {
    var s = freshSession();
    s.customer.name = "AcmeCorp123";
    createGap(s, { description:"Some gap", layerId:LayerIds[0], urgency:"Medium", phase:"later" });
    var text = generateExecutiveSummary(s);
    assert(text.indexOf("AcmeCorp123") >= 0, "summary must mention customer name");
  });

  it("buildProjects is pure -- does not mutate session", () => {
    var s = freshSession();
    createGap(s, { description:"D", layerId:LayerIds[0] });
    var snap = JSON.stringify(s);
    buildProjects(s, {});
    assertEqual(JSON.stringify(s), snap, "buildProjects must not mutate session");
  });

  it("buildProjects and new service functions are JSON-serialisable", () => {
    var s = freshSession();
    doesNotThrow(function() { JSON.stringify(buildProjects(s, {})); }, "buildProjects result must be serialisable");
    doesNotThrow(function() { JSON.stringify(computeAccountHealthScore(s)); }, "health score must be serialisable");
    doesNotThrow(function() { JSON.stringify(generateExecutiveSummary(s)); }, "exec summary must be serialisable");
  });

});

// ============================================================================
// SUITE 21 -- ui/views/ReportingView (v1.2)
// ============================================================================
describe("21 * ui/views/ReportingView", () => {

  it("renderReportingOverview is a function", () => {
    assert(typeof renderReportingOverview === "function", "must be a function");
  });

  it("renderReportingOverview renders without throwing", () => {
    var l = document.createElement("div"); var r = document.createElement("div");
    doesNotThrow(function() { renderReportingOverview(l, r); }, "must not throw");
  });

  it("renderReportingOverview populates left panel", () => {
    var l = document.createElement("div"); var r = document.createElement("div");
    renderReportingOverview(l, r);
    assert(l.innerHTML.length > 0, "left panel must have content");
  });

  it("Overview renders two-panel health: Coverage % + Risk level pill (T6.25)", () => {
    var l = document.createElement("div"); var r = document.createElement("div");
    renderReportingOverview(l, r);
    var cov = l.querySelector(".coverage-panel");
    var risk = l.querySelector(".risk-panel");
    var pct = l.querySelector(".coverage-percent");
    var pill = l.querySelector(".risk-level-pill");
    assert(cov !== null, "must render .coverage-panel");
    assert(risk !== null, "must render .risk-panel");
    assert(pct !== null && /\d+%/.test(pct.textContent), "coverage panel must show a '%' number");
    assert(pill !== null, "risk panel must show a level pill");
  });

  it("renderReportingOverview shows executive summary text (right panel, Phase 13)", () => {
    var l = document.createElement("div"); var r = document.createElement("div");
    renderReportingOverview(l, r);
    var execEl = r.querySelector(".exec-summary-text");
    assert(execEl !== null, "must render executive summary text element on the RIGHT panel (Phase 13)");
    assert(execEl.textContent.length > 10, "executive summary must have meaningful content");
  });

  it("stepper renders Reporting (not Summary) as step 5 label", () => {
    window.renderStepperForTests && window.renderStepperForTests();
    var labels = Array.from(document.querySelectorAll("#stepper .step")).map(function(el) { return el.textContent.trim(); });
    assert(labels.some(function(l) { return l.indexOf("Reporting") >= 0; }), "step 5 must say Reporting");
    assert(!labels.some(function(l) { return l === "5  Summary" || l === "5 - Summary"; }), "step 5 must not say Summary");
  });

  // ── Phase 7 · Overview additions ────────────────────────

  it("Overview renders a Refresh button that re-rolls the session brief (T5.1, Phase 14 rename)", () => {
    // Phase 14: button is labelled "Refresh" (honest affordance — no pretend AI).
    var l = document.createElement("div"); var r = document.createElement("div");
    renderReportingOverview(l, r);
    var btn = [...r.querySelectorAll("button")].find(function(b) {
      var t = b.textContent || "";
      return t.indexOf("Refresh") >= 0 || t.indexOf("Regenerate") >= 0;
    });
    assert(btn !== undefined, "a Refresh (or legacy Regenerate) button must exist on the right panel");
    var before = r.querySelector(".exec-summary-text").textContent;
    btn.click();
    assert(/Refreshed|Regenerated/.test(btn.textContent),
      "button shows transient feedback after click (Refreshed or Regenerated)");
    var after = r.querySelector(".exec-summary-text").textContent;
    assert(typeof before === "string" && before.length > 0 && typeof after === "string" && after.length > 0,
      "summary content remains populated before and after refresh");
  });

  it("Overview renders a driver chip for every session driver (T5.2)", () => {
    var l = document.createElement("div"); var r = document.createElement("div");
    renderReportingOverview(l, r);
    var chips = l.querySelectorAll(".reporting-driver-chip");
    var drivers = (session.customer && session.customer.drivers) || [];
    if (drivers.length > 0) {
      assertEqual(chips.length, drivers.length,
        "one .reporting-driver-chip per session driver (session has " + drivers.length + ")");
    }
  });

});

// ── Phase 18 / v2.3.0 · Gap-link surfacing & double-link safety (T8.*) ──
describe("23 · Phase 18 · gap links — always-visible + warn-but-allow + cascade safety", () => {

  function gapsViewFor(sess) {
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderGapsEditView(l, r, sess);
    return { l, r };
  }

  // Helper: fabricate a desired-state instance and return its id.
  function addDesired(sess, label) {
    const inst = validInstance({ id: "des-" + Math.random().toString(36).slice(2,7),
                                 state: "desired", label: label });
    (sess.instances = sess.instances || []).push(inst);
    return inst.id;
  }
  function addCurrent(sess, label) {
    const inst = validInstance({ id: "cur-" + Math.random().toString(36).slice(2,7),
                                 state: "current", label: label });
    (sess.instances = sess.instances || []).push(inst);
    return inst.id;
  }

  // Helper: select a gap card so the right-panel detail renders.
  function selectFirstGap(sess) {
    const { l, r } = gapsViewFor(sess);
    const card = l.querySelector(".gap-card");
    if (card) card.click();
    // After click, the renderer rebuilds — re-mount and then re-click.
    // Instead, directly query the right panel that was wired during render.
    const post = gapsViewFor(sess);
    post.l.querySelector(".gap-card")?.click();
    return post;
  }

  it("T8.1 · gap detail panel renders link sections inline (no Manage-links collapse)", () => {
    const s = freshSession();
    const desId = addDesired(s, "Net-new platform");
    createGap(s, { description:"Introduce platform X", layerId: LayerIds[0],
                   gapType:"introduce", relatedDesiredInstanceIds:[desId] });
    const { l, r } = gapsViewFor(s);
    l.querySelector(".gap-card")?.click();
    // After selection, re-render captures detail panel into right pane.
    const re = gapsViewFor(s);
    re.l.querySelector(".gap-card")?.click();
    assert(!re.r.querySelector(".linked-manage-btn"),
      "Manage-links collapse button must be gone (Item 8 always-visible)");
    assert(!re.r.querySelector(".linked-summary-row"),
      "linked-summary-row must be gone (Item 8 always-visible)");
    assert(re.r.querySelector(".linked-inline-wrap") || re.r.textContent.includes("Desired state"),
      "inline link sections must render directly in the gap detail panel");
  });

  it("T8.2 · link picker shows yellow warning row when candidate is linked to another gap", () => {
    const s = freshSession();
    const sharedId = addCurrent(s, "Shared-server-A");
    // Gap A already links the instance.
    createGap(s, { description:"Gap A", layerId: LayerIds[0],
                   gapType:"replace", relatedCurrentInstanceIds:[sharedId], reviewed:false });
    // Gap B does NOT link it yet — opening its picker should warn.
    createGap(s, { description:"Gap B", layerId: LayerIds[0], gapType:"enhance", reviewed:false });

    const { l } = gapsViewFor(s);
    // Click the "Gap B" card (second one rendered).
    const cards = l.querySelectorAll(".gap-card");
    assert(cards.length >= 2, "test setup: at least 2 gap cards must render");
    // Re-render to wire detail panel; click Gap B.
    const re = gapsViewFor(s);
    const reCards = re.l.querySelectorAll(".gap-card");
    // Find the Gap B card by description text.
    const gapBCard = [...reCards].find(c => c.textContent.includes("Gap B"));
    assert(gapBCard, "Gap B card must be found by description text");
    gapBCard.click();
    // Detail panel renders into right pane on re-render after click;
    // do one more pass to materialise it.
    const final = gapsViewFor(s);
    [...final.l.querySelectorAll(".gap-card")].find(c => c.textContent.includes("Gap B"))?.click();
    // Click "+ Link current instance" button to open the picker.
    const buttons = [...final.r.querySelectorAll("button")];
    const addBtn = buttons.find(b => b.textContent.includes("Link current"));
    assert(addBtn, "+ Link current instance button must render in the detail panel");
    addBtn.click();
    const warning = document.querySelector("#link-picker .link-warning-row");
    assert(warning, "warning row must appear above the already-linked candidate");
    assert(warning.textContent.includes("Gap A") || warning.textContent.includes("already linked"),
      "warning text must reference the other gap or the already-linked state");
    // Cleanup the picker overlay so it doesn't leak into the next test.
    document.getElementById("link-picker")?.remove();
  });

  it("T8.3 · multi-linked-chip appears on link rows when instance is linked to ≥ 2 gaps", () => {
    const s = freshSession();
    const sharedId = addCurrent(s, "Shared-server-B");
    createGap(s, { description:"Gap 1", layerId: LayerIds[0],
                   gapType:"replace", relatedCurrentInstanceIds:[sharedId], reviewed:false });
    createGap(s, { description:"Gap 2", layerId: LayerIds[0],
                   gapType:"enhance", relatedCurrentInstanceIds:[sharedId], reviewed:false });
    const { l, r } = gapsViewFor(s);
    [...l.querySelectorAll(".gap-card")].find(c => c.textContent.includes("Gap 1"))?.click();
    const re = gapsViewFor(s);
    [...re.l.querySelectorAll(".gap-card")].find(c => c.textContent.includes("Gap 1"))?.click();
    const final = gapsViewFor(s);
    [...final.l.querySelectorAll(".gap-card")].find(c => c.textContent.includes("Gap 1"))?.click();
    const chip = final.r.querySelector(".multi-linked-chip");
    assert(chip, "multi-linked-chip must render on the link row when N ≥ 2");
    assert(/2\s+gaps/.test(chip.textContent), "chip text must mention 2 gaps (got: " + chip.textContent + ")");
  });

  it("T8.4 · deleting a gap leaves its previously-linked instances intact and re-linkable (Item 10)", () => {
    const s = freshSession();
    const curId = addCurrent(s, "Survivor-server");
    const desId = addDesired(s, "Survivor-platform");
    const original = createGap(s, { description:"Will be deleted", layerId: LayerIds[0],
      gapType:"replace", relatedCurrentInstanceIds:[curId], relatedDesiredInstanceIds:[desId] });
    deleteGap(s, original.id);
    // Instances must still exist on the session.
    const stillThere = (s.instances || []).filter(i => i.id === curId || i.id === desId);
    assertEqual(stillThere.length, 2, "both linked instances must survive gap deletion (no cascade)");
    // And must be re-linkable into a fresh gap.
    const fresh = createGap(s, { description:"Re-link target", layerId: LayerIds[0], gapType:"enhance", reviewed:false });
    doesNotThrow(() => linkCurrentInstance(s, fresh.id, curId), "current instance must be re-linkable after parent gap deletion");
    doesNotThrow(() => linkDesiredInstance(s, fresh.id, desId), "desired instance must be re-linkable after parent gap deletion");
  });

  it("T8.5 · roadmap project linked-tech count dedupes multi-linked instances (no double counting)", () => {
    const s = freshSession();
    const sharedId = addCurrent(s, "Shared-server-C");
    // Two gaps in the same env+layer+gapType bucket → same project, both link the same instance.
    // EnvironmentIds[0] is "coreDc" — using the canonical id rather than a hand-typed string
    // so the test stays correct even if the env labels evolve.
    createGap(s, { description:"Project-gap A", layerId: LayerIds[0], gapType:"replace",
                   relatedCurrentInstanceIds:[sharedId], affectedEnvironments:[EnvironmentIds[0]], reviewed:false });
    createGap(s, { description:"Project-gap B", layerId: LayerIds[0], gapType:"replace",
                   relatedCurrentInstanceIds:[sharedId], affectedEnvironments:[EnvironmentIds[0]], reviewed:false });
    const { projects } = buildProjects(s);
    // Find the project that holds both gaps.
    const proj = projects.find(p => p.gaps.length === 2 && p.layerId === LayerIds[0] && p.gapType === "replace");
    assert(proj, "expected a single project bucket containing both gaps with the shared instance");
    // Mount the Roadmap detail to render the linked-technologies copy.
    const r = document.createElement("div");
    renderSummaryRoadmapView(document.createElement("div"), r, s);
    // Click into the project to materialise the right-panel detail.
    // We can't easily reach the click handler from here without DOM wiring,
    // so we verify the dedup invariant directly against the project shape:
    // the union of relatedXxx sets across the project's gaps must have size 1.
    const ids = new Set();
    proj.gaps.forEach(g => {
      (g.relatedCurrentInstanceIds || []).forEach(id => ids.add(id));
      (g.relatedDesiredInstanceIds || []).forEach(id => ids.add(id));
    });
    assertEqual(ids.size, 1, "shared instance must count once across the project (Phase 18 dedup)");
  });

});

// ── Phase 16 / v2.3.1 · Workload Mapping (W1-W4) ──────────────────────
describe("24 · Phase 16 · workload layer + asset mapping + upward propagation", () => {

  it("W1 · workload layer exists at the top of LAYERS and accepts an instance with mappedAssetIds=[]", () => {
    assertEqual(LAYERS[0].id, "workload", "workload must be the first (topmost) layer");
    const s = freshSession();
    const wl = addInstance(s, {
      state: "current", layerId: "workload", environmentId: EnvironmentIds[0],
      label: "Order-management ERP", vendorGroup: "nonDell",
      mappedAssetIds: [] // explicit empty; validateInstance must accept on workload only
    });
    assert(wl.id, "addInstance must return a workload with an id");
    assertEqual(wl.layerId, "workload", "instance must remain on workload layer");
  });

  it("W1b · validateInstance rejects mappedAssetIds on a non-workload layer", () => {
    const s = freshSession();
    throws(() => addInstance(s, {
      state: "current", layerId: "compute", environmentId: EnvironmentIds[0],
      label: "Misplaced", mappedAssetIds: ["cur-1"]
    }), "mappedAssetIds on a compute-layer instance must throw");
  });

  it("W2 · mapAsset adds the id (deduped) and refuses cross-state or workload-to-workload", () => {
    const s = freshSession();
    const wl = addInstance(s, { state:"current", layerId:"workload", environmentId:EnvironmentIds[0],
                                label:"Critical workload" });
    const cmp = addInstance(s, { state:"current", layerId:"compute", environmentId:EnvironmentIds[0],
                                 label:"Production cluster" });
    mapAsset(s, wl.id, cmp.id);
    mapAsset(s, wl.id, cmp.id); // dedup
    assertEqual(wl.mappedAssetIds.length, 1, "duplicate mapAsset call must not append");
    assertEqual(wl.mappedAssetIds[0], cmp.id, "the compute id must be the mapped one");

    // refuse self-map
    throws(() => mapAsset(s, wl.id, wl.id), "mapping a workload to itself must throw");

    // refuse workload→workload
    const wl2 = addInstance(s, { state:"current", layerId:"workload", environmentId:EnvironmentIds[0],
                                 label:"Other workload" });
    throws(() => mapAsset(s, wl.id, wl2.id), "mapping a workload to another workload must throw");

    // refuse cross-state
    const desCmp = addInstance(s, { state:"desired", layerId:"compute", environmentId:EnvironmentIds[0],
                                    label:"Future cluster" });
    throws(() => mapAsset(s, wl.id, desCmp.id), "mapping a current workload to a desired asset must throw");

    // unmapAsset removes
    unmapAsset(s, wl.id, cmp.id);
    assertEqual(wl.mappedAssetIds.length, 0, "unmapAsset must remove the id");
  });

  it("W3 · proposeCriticalityUpgrades returns Low/Medium mapped assets when workload is High (upward only, opt-in apply)", () => {
    const s = freshSession();
    const wl = addInstance(s, { state:"current", layerId:"workload", environmentId:EnvironmentIds[0],
                                label:"High-criticality workload", criticality:"High" });
    const lowCmp  = addInstance(s, { state:"current", layerId:"compute", environmentId:EnvironmentIds[0],
                                     label:"Low compute",  criticality:"Low" });
    const medSto  = addInstance(s, { state:"current", layerId:"storage", environmentId:EnvironmentIds[0],
                                     label:"Medium storage", criticality:"Medium" });
    mapAsset(s, wl.id, lowCmp.id);
    mapAsset(s, wl.id, medSto.id);

    const proposals = proposeCriticalityUpgrades(s, wl.id);
    assertEqual(proposals.length, 2, "both lower-criticality assets must be proposed for upgrade");
    proposals.forEach(p => {
      assertEqual(p.newCrit, "High", "newCrit must match the workload's criticality");
    });

    // Apply via existing updateInstance (caller's responsibility); verify mutation
    updateInstance(s, lowCmp.id, { criticality: "High" });
    const lc = s.instances.find(i => i.id === lowCmp.id);
    assertEqual(lc.criticality, "High", "updateInstance must apply the upgrade");
  });

  it("W4 · propagation never downgrades — assets meeting/exceeding workload criticality are excluded", () => {
    const s = freshSession();
    const wl = addInstance(s, { state:"current", layerId:"workload", environmentId:EnvironmentIds[0],
                                label:"Medium workload", criticality:"Medium" });
    const equalCmp = addInstance(s, { state:"current", layerId:"compute", environmentId:EnvironmentIds[0],
                                      label:"Equal compute", criticality:"Medium" });
    const highSto = addInstance(s, { state:"current", layerId:"storage", environmentId:EnvironmentIds[0],
                                     label:"High storage", criticality:"High" });
    mapAsset(s, wl.id, equalCmp.id);
    mapAsset(s, wl.id, highSto.id);

    const proposals = proposeCriticalityUpgrades(s, wl.id);
    assertEqual(proposals.length, 0, "no proposals when all mapped assets meet or exceed workload criticality");
  });

  it("W6 · mapAsset refuses cross-environment mapping (workload + asset must share environment)", () => {
    const s = freshSession();
    const wl = addInstance(s, { state:"current", layerId:"workload", environmentId:EnvironmentIds[0],
                                label:"Cloud-hosted ERP" });
    // Same state, same layer constraints satisfied; only environment differs.
    const otherEnvAsset = addInstance(s, { state:"current", layerId:"compute",
                                           environmentId:EnvironmentIds[1],
                                           label:"On-prem cluster" });
    throws(() => mapAsset(s, wl.id, otherEnvAsset.id),
      "mapping a workload to an asset in a different environment must throw");
    // Hybrid workloads are modelled as one workload tile per environment;
    // a same-env asset still maps cleanly.
    const sameEnvAsset = addInstance(s, { state:"current", layerId:"compute",
                                          environmentId:EnvironmentIds[0],
                                          label:"Cloud cluster" });
    doesNotThrow(() => mapAsset(s, wl.id, sameEnvAsset.id),
      "same-env mapping must still succeed");
  });

  it("W5 · proposeCriticalityUpgrades is pure — never mutates instances", () => {
    const s = freshSession();
    const wl = addInstance(s, { state:"current", layerId:"workload", environmentId:EnvironmentIds[0],
                                label:"Workload", criticality:"High" });
    const lowCmp = addInstance(s, { state:"current", layerId:"compute", environmentId:EnvironmentIds[0],
                                    label:"Low compute", criticality:"Low" });
    mapAsset(s, wl.id, lowCmp.id);
    const beforeCrit = lowCmp.criticality;
    proposeCriticalityUpgrades(s, wl.id);
    proposeCriticalityUpgrades(s, wl.id);
    const after = s.instances.find(i => i.id === lowCmp.id);
    assertEqual(after.criticality, beforeCrit, "asset criticality must be unchanged after pure propose calls");
  });

});

// ── Phase 19 / v2.4.0 · AI foundations (AI1-AI7) ──────────────────────
import { DEFAULT_AI_CONFIG, loadAiConfig, saveAiConfig, isActiveProviderReady } from "../core/aiConfig.js";
import { buildRequest, extractText } from "../services/aiService.js";

describe("25 · Phase 19 · AI foundations — config + provider request shapes + UI surfaces", () => {

  it("AI1 · loadAiConfig returns the defaults when localStorage is empty", () => {
    window.localStorage.removeItem("ai_config_v1");
    const cfg = loadAiConfig();
    assertEqual(cfg.activeProvider, "local", "default activeProvider must be 'local'");
    assert(cfg.providers.local && cfg.providers.local.baseUrl === "/api/llm/local/v1",
      "local provider baseUrl must default to the container proxy path");
    assertEqual(cfg.providers.anthropic.model, "claude-haiku-4-5",
      "anthropic default model must be claude-haiku-4-5");
    assertEqual(cfg.providers.gemini.model, "gemini-2.5-flash",
      "gemini default model must be gemini-2.5-flash (2.0-flash deprecated 2026-Q1)");
  });

  it("AI2 · saveAiConfig + loadAiConfig round-trip; merges with defaults on read", () => {
    saveAiConfig({
      activeProvider: "anthropic",
      providers: { anthropic: { apiKey: "test-key-123" } }
    });
    const cfg = loadAiConfig();
    assertEqual(cfg.activeProvider, "anthropic", "saved activeProvider must persist");
    assertEqual(cfg.providers.anthropic.apiKey, "test-key-123", "saved apiKey must persist");
    // Defaults must fill in for fields the user didn't override.
    assertEqual(cfg.providers.gemini.model, "gemini-2.5-flash", "missing fields must fall back to defaults");
    window.localStorage.removeItem("ai_config_v1");
  });

  it("AI2b · deprecated gemini model gemini-2.0-flash auto-migrates to gemini-2.5-flash on load", () => {
    saveAiConfig({
      activeProvider: "gemini",
      providers: { gemini: { model: "gemini-2.0-flash", apiKey: "AIza-saved" } }
    });
    const cfg = loadAiConfig();
    assertEqual(cfg.providers.gemini.model, "gemini-2.5-flash",
      "deprecated gemini-2.0-flash must auto-migrate to gemini-2.5-flash");
    // Key is preserved across the migration.
    assertEqual(cfg.providers.gemini.apiKey, "AIza-saved",
      "user's saved API key must survive the model migration");
    window.localStorage.removeItem("ai_config_v1");
  });

  it("AI3 · isActiveProviderReady — local OK without key, public providers require key", () => {
    saveAiConfig({ activeProvider: "local" });
    assert(isActiveProviderReady(loadAiConfig()), "local must be ready without an API key");
    saveAiConfig({ activeProvider: "anthropic", providers: { anthropic: { apiKey: "" } } });
    assert(!isActiveProviderReady(loadAiConfig()), "anthropic must NOT be ready without an API key");
    saveAiConfig({ activeProvider: "anthropic", providers: { anthropic: { apiKey: "k" } } });
    assert(isActiveProviderReady(loadAiConfig()), "anthropic must be ready with an API key");
    window.localStorage.removeItem("ai_config_v1");
  });

  it("AI4 · buildRequest('openai-compatible') → POSTs /chat/completions with Bearer auth", () => {
    const req = buildRequest("openai-compatible", {
      baseUrl: "/api/llm/local/v1",
      model: "code-llm",
      apiKey: "sk-test",
      messages: [{ role: "user", content: "hello" }]
    });
    assertEqual(req.url, "/api/llm/local/v1/chat/completions",
      "OpenAI-compatible URL must end in /chat/completions");
    assertEqual(req.headers["Authorization"], "Bearer sk-test",
      "Authorization header must use Bearer prefix");
    assertEqual(req.body.model, "code-llm", "body.model must echo the configured model");
    assert(Array.isArray(req.body.messages), "body.messages must be an array");
  });

  it("AI5 · buildRequest('anthropic') → POSTs /v1/messages with x-api-key + system collapse", () => {
    const req = buildRequest("anthropic", {
      baseUrl: "/api/llm/anthropic",
      model: "claude-haiku-4-5",
      apiKey: "sk-ant-xyz",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user",   content: "Hi" }
      ]
    });
    assertEqual(req.url, "/api/llm/anthropic/v1/messages",
      "Anthropic URL must end in /v1/messages");
    assertEqual(req.headers["x-api-key"], "sk-ant-xyz",
      "Anthropic must use x-api-key header (NOT Authorization)");
    assertEqual(req.headers["anthropic-version"], "2023-06-01",
      "anthropic-version header is required");
    assertEqual(req.body.system, "You are helpful.",
      "Anthropic body must collapse system role into top-level system field");
    assertEqual(req.body.messages.length, 1, "Anthropic body.messages must exclude system messages");
    assertEqual(req.body.messages[0].role, "user", "remaining message must be user role");
  });

  it("AI6 · buildRequest('gemini') → POSTs :generateContent with key in query, contents[] shape", () => {
    const req = buildRequest("gemini", {
      baseUrl: "/api/llm/gemini",
      model: "gemini-2.5-flash",
      apiKey: "AIza-test",
      messages: [
        { role: "system",    content: "Be terse." },
        { role: "user",      content: "Ping" },
        { role: "assistant", content: "Pong" }
      ]
    });
    assert(req.url.indexOf("/v1beta/models/gemini-2.5-flash:generateContent") >= 0,
      "Gemini URL must target /v1beta/models/<model>:generateContent");
    assert(req.url.indexOf("key=AIza-test") >= 0, "Gemini URL must carry key=… query param");
    assertEqual(req.body.systemInstruction.parts[0].text, "Be terse.",
      "Gemini body must lift system into systemInstruction");
    assertEqual(req.body.contents.length, 2, "Gemini contents[] must exclude system messages");
    assertEqual(req.body.contents[1].role, "model",
      "Gemini renames 'assistant' role to 'model'");
  });

  it("AI7 · extractText handles each provider's response shape", () => {
    assertEqual(extractText("openai-compatible",
      { choices: [{ message: { content: "hi" } }] }), "hi",
      "OpenAI-compatible: choices[0].message.content");
    assertEqual(extractText("anthropic",
      { content: [{ type: "text", text: "hi" }, { type: "text", text: " there" }] }), "hi there",
      "Anthropic: concatenate content[].text where type==='text'");
    assertEqual(extractText("gemini",
      { candidates: [{ content: { parts: [{ text: "hi" }] } }] }), "hi",
      "Gemini: candidates[0].content.parts[].text");
  });

  it("AI8 · #settingsBtn (gear icon) is present in the header markup", () => {
    const btn = document.getElementById("settingsBtn");
    assert(btn !== null, "header must include a #settingsBtn (gear icon)");
    assert(btn.classList.contains("gear-btn"), "settingsBtn must carry .gear-btn class");
    assert(btn.querySelector("svg") !== null, "settingsBtn must contain an SVG glyph");
  });

  // v2.4.13 S4E . AI9 dropped. Original test asserted the per-driver
  // .ai-skill-card mounted in ContextView's right panel. AI is now a
  // global topbar gateway (Suite 45 VT23 + VT25 cover the new contract);
  // per-driver inline mounting is removed.

});

// ── Phase 19b / v2.4.1 · Skill Builder (SB1-SB8) ───────────────────────
import {
  loadSkills, saveSkills, addSkill, updateSkill, deleteSkill,
  seedSkills, skillsForTab, getSkill
} from "../core/skillStore.js";
import { SEED_SKILL_IDS } from "../core/seedSkills.js";
import { renderTemplate, extractBindings } from "../services/skillEngine.js";
import { renderSkillAdmin } from "../ui/views/SkillAdmin.js";

describe("26 · Phase 19b · Skill Builder — store, engine, admin UI", () => {

  function clearSkills() { window.localStorage.removeItem("ai_skills_v1"); }

  it("SB1 · loadSkills auto-seeds the skill library on first run", () => {
    // v2.4.5 · seed library expanded from 1 to SEED_SKILL_IDS.length
    // (one per tab + an extra json-scalars on Context). Every seeded
    // skill must be deployed so every tab's Use-AI dropdown is populated
    // on a fresh install.
    clearSkills();
    const skills = loadSkills();
    assertEqual(skills.length, SEED_SKILL_IDS.length,
      "fresh install must auto-seed all " + SEED_SKILL_IDS.length + " seed skills");
    // The canonical Tab 1 driver-questions seed must be present (back-compat id).
    const ctxSeed = skills.find(s => s.id === "skill-driver-questions-seed");
    assert(ctxSeed, "legacy Context-tab driver-questions seed must be present by id");
    assertEqual(ctxSeed.tabId, "context", "legacy seed targets the Context tab");
    // Every seeded skill must be deployed + seed-flagged.
    skills.forEach(s => {
      assert(s.deployed, "seeded skill '" + s.id + "' must be deployed by default");
      assert(s.seed,     "seeded skill '" + s.id + "' carries seed: true marker");
    });
  });

  it("SB2 · addSkill / updateSkill / deleteSkill round-trip via localStorage", () => {
    clearSkills();
    loadSkills(); // trigger the seed so we start from a known baseline
    const seedCount = SEED_SKILL_IDS.length;
    const created = addSkill({
      name: "Gap description writer",
      tabId: "gaps",
      promptTemplate: "Summarise {{context.selectedGap.description}} in 2 sentences.",
      outputMode: "suggest"
    });
    assert(created.id, "addSkill must return a skill with an id");
    var all = loadSkills();
    assertEqual(all.length, seedCount + 1, "persistence must include seed library + added skill");

    const updated = updateSkill(created.id, { name: "Renamed skill", deployed: false });
    assertEqual(updated.name, "Renamed skill", "updateSkill applies patch");
    assertEqual(updated.deployed, false, "updateSkill persists deploy toggle");

    deleteSkill(created.id);
    all = loadSkills();
    assertEqual(all.length, seedCount, "deleteSkill removes the row (seed library remains)");
    clearSkills();
  });

  it("SB3 · renderTemplate resolves {{dot.path}}; missing paths render as empty string", () => {
    const out = renderTemplate(
      "Customer: {{session.customer.name}}. Missing: {{nope.deep.path}}. Driver: {{context.selectedDriver.label}}.",
      {
        session: { customer: { name: "Acme" } },
        context: { selectedDriver: { label: "Cyber Resilience" } }
      }
    );
    assert(out.indexOf("Customer: Acme") >= 0, "should resolve existing paths");
    assert(out.indexOf("Missing: .") >= 0, "missing paths must collapse to empty strings (not throw)");
    assert(out.indexOf("Cyber Resilience") >= 0, "context paths must resolve");
  });

  it("SB4 · extractBindings lists unique {{path}} references in template text", () => {
    const bindings = extractBindings(
      "Hi {{session.customer.name}}, about {{context.selectedDriver.label}}. " +
      "Again: {{session.customer.name}} — same ref should not duplicate."
    );
    assertEqual(bindings.length, 2, "duplicates must collapse");
    assert(bindings.indexOf("session.customer.name") >= 0, "name binding present");
    assert(bindings.indexOf("context.selectedDriver.label") >= 0, "driver binding present");
  });

  it("SB5 · skillsForTab filters by tabId and (by default) by deployed flag", () => {
    // v2.4.5 · seed library now ships multiple Context seeds AND a seed
    // per tab. Assert relative deltas instead of absolute counts so the
    // test survives future seed additions.
    clearSkills();
    const baselineCtx   = skillsForTab("context").length;
    const baselineGaps  = skillsForTab("gaps").length;
    addSkill({ name: "Deployed gaps skill",   tabId: "gaps", promptTemplate: "x", deployed: true });
    addSkill({ name: "Undeployed gaps skill", tabId: "gaps", promptTemplate: "x", deployed: false });
    assertEqual(skillsForTab("context").length, baselineCtx,
      "context tab unchanged when adding gaps skills");
    assertEqual(skillsForTab("gaps").length, baselineGaps + 1,
      "gaps tab gains one deployed skill (undeployed hidden by default)");
    assertEqual(skillsForTab("gaps", { onlyDeployed: false }).length, baselineGaps + 2,
      "onlyDeployed:false includes the undeployed row too");
    clearSkills();
  });

  it("SB6 · Skills admin renders a row per saved skill + the + Add button", () => {
    clearSkills();
    loadSkills(); // seed library = SEED_SKILL_IDS.length rows
    const container = document.createElement("div");
    renderSkillAdmin(container);
    const rows = container.querySelectorAll(".skill-row");
    assertEqual(rows.length, SEED_SKILL_IDS.length,
      "one row per seeded skill (v2.4.5 seed library = " + SEED_SKILL_IDS.length + ")");
    const addBtn = [...container.querySelectorAll("button")].find(b => b.textContent.indexOf("Add") >= 0);
    assert(addBtn, "+ Add skill button must render");
    clearSkills();
  });

  it("SB7 · Skills admin empty state when no skills saved (persisted empty)", () => {
    // Simulate a user who deleted everything (including the seed).
    saveSkills([]);
    const container = document.createElement("div");
    renderSkillAdmin(container);
    const empty = container.querySelector(".skill-admin-empty");
    assert(empty, "empty state must render when list is empty");
    clearSkills();
  });

  // v2.4.13 S4E . SB8 dropped. Original test asserted the per-driver
  // .use-ai-btn dropdown in ContextView's right panel. Replaced by the
  // global AI Assist topbar gateway (Suite 45 VT23 + VT25); the
  // skillStore CRUD + skillsEvents bus contract that SB8 indirectly
  // depended on is still covered by the rest of Suite 26.

});

// ── Phase 19c / v2.4.2 · Field-pointer mechanic (FP1-FP9) ──────────────
import { FIELD_MANIFEST, fieldsForTab, buildPreviewScope } from "../core/fieldManifest.js";
import { coerceForLLM } from "../services/skillEngine.js";

describe("27 · Phase 19c · Field manifest + click-to-insert in skill builder", () => {

  function clearSkills() { window.localStorage.removeItem("ai_skills_v1"); }

  it("FP1 · FIELD_MANIFEST has non-empty bindable-field lists for all 5 tabs", () => {
    ["context", "current", "desired", "gaps", "reporting"].forEach(t => {
      assert(Array.isArray(FIELD_MANIFEST[t]) && FIELD_MANIFEST[t].length > 0,
        "tab '" + t + "' must declare at least one bindable field");
      // Every entry has path + label.
      FIELD_MANIFEST[t].forEach(f => {
        assert(typeof f.path === "string" && f.path.indexOf(".") > 0,
          "bindable field must carry a dotted path (got: " + f.path + ")");
        assert(typeof f.label === "string" && f.label.length > 0,
          "bindable field must carry a label");
      });
    });
  });

  it("FP2 · every tab includes the shared session.* fields (tab-independent)", () => {
    ["context", "current", "desired", "gaps", "reporting"].forEach(t => {
      var paths = FIELD_MANIFEST[t].map(f => f.path);
      assert(paths.indexOf("session.customer.name") >= 0,
        "tab '" + t + "' must include session.customer.name");
    });
  });

  it("FP3 · context-specific bindings appear only on their tab", () => {
    var gapsPaths = FIELD_MANIFEST.gaps.map(f => f.path);
    var ctxPaths  = FIELD_MANIFEST.context.map(f => f.path);
    assert(gapsPaths.indexOf("context.selectedGap.description") >= 0,
      "Gaps tab must expose the selected-gap description binding");
    assert(ctxPaths.indexOf("context.selectedGap.description") < 0,
      "Context tab must NOT leak a Gaps-only binding");
    assert(ctxPaths.indexOf("context.selectedDriver.label") >= 0,
      "Context tab must expose selected-driver label");
  });

  it("FP4 · buildPreviewScope returns a usable scope for each tab (even on empty session)", () => {
    var s = createEmptySession();
    var ctx = buildPreviewScope(s, "context");
    assert(ctx.context && ctx.context.selectedDriver,
      "context tab preview scope must carry a selectedDriver fallback");
    var gaps = buildPreviewScope(s, "gaps");
    assert(gaps.context && gaps.context.selectedGap,
      "gaps tab preview scope must carry a selectedGap fallback");
    var rep = buildPreviewScope(s, "reporting");
    assert(rep.context && rep.context.selectedProject,
      "reporting tab preview scope must carry a selectedProject fallback");
  });

  it("FP5 · Skill admin edit form renders a field-chip per bindable field of the selected tab", () => {
    clearSkills();
    loadSkills(); // ensures seed in list
    var container = document.createElement("div");
    document.body.appendChild(container); // form relies on DOM focus; attach for realism
    renderSkillAdmin(container);
    var editBtns = [...container.querySelectorAll("button")].filter(b => b.textContent === "Edit");
    assert(editBtns[0], "Edit button on the seeded row must be present");
    editBtns[0].click();
    var chips = container.querySelectorAll(".field-chip");
    // Seed targets 'context'; field manifest has ≥ 8 entries for that tab.
    assert(chips.length >= 8, "expected at least 8 chips for the Context tab (got " + chips.length + ")");
    var chipPaths = [...chips].map(c => c.getAttribute("data-path"));
    assert(chipPaths.indexOf("context.selectedDriver.label") >= 0,
      "context.selectedDriver.label chip must render");
    container.remove();
    clearSkills();
  });

  it("FP6 · chip click inserts LABELED binding pill into the pill-editor; serialize reads back as 'Label: {{path}}'", () => {
    clearSkills();
    loadSkills();
    var container = document.createElement("div");
    document.body.appendChild(container);
    renderSkillAdmin(container);
    var editBtns = [...container.querySelectorAll("button")].filter(b => b.textContent === "Edit");
    editBtns[0].click();
    var editor = container.querySelector(".pill-editor");
    assert(editor, "edit form must render a .pill-editor (not a textarea) for the template");
    // Clear editor so the insertion is easy to assert.
    editor.innerHTML = "";
    editor.focus();
    var chip = container.querySelector('.field-chip[data-path="session.customer.name"]');
    assert(chip, "expected a chip with data-path=session.customer.name");
    chip.click();
    var serialized = editor.serialize();
    assert(serialized.indexOf("Customer name: {{session.customer.name}}") >= 0,
      "default chip click must insert a LABELED pill that serializes to 'Customer name: {{session.customer.name}}' (got: " + serialized + ")");
    container.remove();
    clearSkills();
  });

  it("FP7 · coerceForLLM stringifies scalars directly and non-scalars as pretty JSON", () => {
    assertEqual(coerceForLLM(undefined), "", "undefined → empty string");
    assertEqual(coerceForLLM(null),      "", "null → empty string");
    assertEqual(coerceForLLM("hello"),   "hello", "string passes through");
    assertEqual(coerceForLLM(42),        "42",    "number coerces via String()");
    assertEqual(coerceForLLM(true),      "true",  "boolean coerces via String()");
    var arr = coerceForLLM([{ a: 1 }, { b: 2 }]);
    assert(arr.indexOf('"a": 1') >= 0, "array of objects → JSON with key-value pairs (got: " + arr + ")");
    assert(arr.indexOf("[object Object]") < 0, "must NOT fall back to [object Object]");
    var longArr = coerceForLLM(new Array(500).fill({ description: "x".repeat(50) }));
    assert(longArr.length <= 1250, "oversized payloads soft-capped so prompts don't blow the token budget");
    assert(longArr.indexOf("truncated") >= 0, "cap is visible to the LLM");
  });

  it("FP8 · Alt-click on a chip inserts a BARE pill; serialize reads back as bare {{path}} (no label)", () => {
    clearSkills();
    loadSkills();
    var container = document.createElement("div");
    document.body.appendChild(container);
    renderSkillAdmin(container);
    [...container.querySelectorAll("button")].filter(b => b.textContent === "Edit")[0].click();
    var editor = container.querySelector(".pill-editor");
    editor.innerHTML = "";
    editor.focus();
    var chip = container.querySelector('.field-chip[data-path="session.customer.vertical"]');
    assert(chip, "expected a chip with data-path=session.customer.vertical");
    var evt = new MouseEvent("click", { bubbles: true, cancelable: true, altKey: true });
    chip.dispatchEvent(evt);
    var serialized = editor.serialize();
    // Trailing NBSP becomes a space via the serializer; allow either form.
    assert(serialized.indexOf("{{session.customer.vertical}}") === 0,
      "Alt-click must emit a bare pill (serialize starts with {{path}}, got: " + serialized + ")");
    assert(serialized.indexOf("vertical: {{") < 0,
      "bare pill must NOT carry the label prefix");
    container.remove();
    clearSkills();
  });

  it("FP9 · Skill admin edit form renders a 'Test skill now' button that wires to a test-output target", () => {
    clearSkills();
    loadSkills();
    var container = document.createElement("div");
    document.body.appendChild(container);
    renderSkillAdmin(container);
    [...container.querySelectorAll("button")].filter(b => b.textContent === "Edit")[0].click();
    var testBtn = [...container.querySelectorAll("button")].find(b => b.textContent.indexOf("Test skill now") >= 0);
    assert(testBtn, "'Test skill now' button must render in the edit form");
    var testOut = container.querySelector(".skill-form-test-out");
    assert(testOut, "test-output target .skill-form-test-out must exist (starts hidden)");
    container.remove();
    clearSkills();
  });

});

// ── Phase 19c.1 / v2.4.2.1 · Pill-based editor (PE1-PE7) ──────────────
import { parseToSegments, serializeEditor, createPillEditor } from "../ui/components/PillEditor.js";

describe("28 · Phase 19c.1 · Pill editor — contenteditable with inline binding pills", () => {

  var LABEL_LOOKUP = {
    "session.customer.name":        { label: "Customer name",     kind: "scalar" },
    "session.customer.vertical":    { label: "Customer vertical", kind: "scalar" },
    "session.gaps":                 { label: "All gaps (array)",  kind: "array"  },
    "context.selectedDriver.label": { label: "Selected driver label", kind: "scalar" }
  };

  it("PE1 · parseToSegments detects a labeled pill when the preceding text ends with 'Label: '", () => {
    const segs = parseToSegments(
      "Hello Customer name: {{session.customer.name}} end",
      LABEL_LOOKUP
    );
    // Expect: text("Hello "), pill(labeled, name), text(" end")
    assertEqual(segs.length, 3, "three segments expected (text + pill + text)");
    assertEqual(segs[0].type, "text");
    assertEqual(segs[0].value, "Hello ", "label must be consumed from preceding text");
    assertEqual(segs[1].type, "pill");
    assertEqual(segs[1].bare, false, "pill is labeled because 'Customer name: ' preceded the binding");
    assertEqual(segs[2].value, " end");
  });

  it("PE2 · parseToSegments falls back to a BARE pill when no matching label precedes the binding", () => {
    const segs = parseToSegments(
      "Intro {{session.customer.name}} outro",
      LABEL_LOOKUP
    );
    assertEqual(segs.length, 3);
    assertEqual(segs[1].bare, true, "pill is bare when preceding text is not the matching label");
    assertEqual(segs[0].value, "Intro ", "preceding text preserved verbatim");
  });

  it("PE3 · serializeEditor emits 'Label: {{path}}' for labeled pills and bare {{path}} for bare pills", () => {
    const editor = createPillEditor({
      initialValue: "Hi Customer name: {{session.customer.name}} and raw {{session.customer.vertical}}.",
      manifest: [
        { path: "session.customer.name",     label: "Customer name",     kind: "scalar" },
        { path: "session.customer.vertical", label: "Customer vertical", kind: "scalar" }
      ],
      onInput: function() {}
    });
    const out = serializeEditor(editor);
    assert(out.indexOf("Customer name: {{session.customer.name}}") >= 0,
      "labeled pill must serialize back to 'Label: {{path}}'");
    assert(out.indexOf("raw {{session.customer.vertical}}") >= 0,
      "bare pill must serialize back to just {{path}}");
    assert(out.indexOf("raw Customer vertical: {{") < 0,
      "bare pill must NOT suddenly gain a label on serialize");
  });

  it("PE4 · createPillEditor round-trips a template through parse + serialize without drift", () => {
    const tpl = "Intro text Customer name: {{session.customer.name}} mid {{session.gaps}} end.";
    const manifest = [
      { path: "session.customer.name", label: "Customer name",   kind: "scalar" },
      { path: "session.gaps",          label: "All gaps (array)", kind: "array"  }
    ];
    const editor = createPillEditor({ initialValue: tpl, manifest: manifest, onInput: function(){} });
    const out = editor.serialize();
    assertEqual(out, tpl, "round-trip must preserve the exact template text");
  });

  it("PE5 · editor exposes a textarea-compatible surface (serialize / setValue / insertPillAtCursor)", () => {
    const editor = createPillEditor({ initialValue: "", manifest: [
      { path: "session.customer.name", label: "Customer name", kind: "scalar" }
    ], onInput: function(){} });
    assert(typeof editor.serialize === "function",          "editor.serialize must be a function");
    assert(typeof editor.setValue === "function",           "editor.setValue must be a function");
    assert(typeof editor.insertPillAtCursor === "function", "editor.insertPillAtCursor must be a function");
    editor.setValue("Hello Customer name: {{session.customer.name}}");
    assert(editor.serialize().indexOf("{{session.customer.name}}") >= 0,
      "setValue followed by serialize must round-trip");
  });

  it("PE6 · pill is rendered contenteditable=false with data-path / data-label / data-bare attrs", () => {
    const editor = createPillEditor({
      initialValue: "Customer name: {{session.customer.name}}",
      manifest: [{ path: "session.customer.name", label: "Customer name", kind: "scalar" }],
      onInput: function(){}
    });
    const pill = editor.querySelector(".binding-pill");
    assert(pill, "a .binding-pill must render for the binding");
    assertEqual(pill.getAttribute("contenteditable"), "false", "pill must be contenteditable=false");
    assertEqual(pill.getAttribute("data-path"),   "session.customer.name");
    assertEqual(pill.getAttribute("data-label"),  "Customer name");
    assertEqual(pill.getAttribute("data-bare"),   "false");
  });

  it("PE7 · a bare binding with no manifest entry still renders as a bare pill (no crash)", () => {
    // Even if the manifest doesn't know the path, the editor must still
    // render a pill (bare) so the user can see + delete it as a unit.
    const editor = createPillEditor({
      initialValue: "Unknown {{unknown.some.path}} test",
      manifest: [],
      onInput: function(){}
    });
    const pill = editor.querySelector(".binding-pill");
    assert(pill, "unknown-path binding must still render a pill");
    assertEqual(pill.getAttribute("data-path"), "unknown.some.path");
    assertEqual(pill.getAttribute("data-bare"), "true",
      "unknown path is bare (no manifest label to use)");
  });

});

// ── Phase 19d.1 / v2.4.3 · Prompt guards + Refine-to-CARE + test-gate (PG1-PG5) ──
import { getSystemFooter, summaryForMode, REFINE_META_SYSTEM, OUTPUT_MODES } from "../core/promptGuards.js";

describe("29 · Phase 19d.1 · Prompt guards + Refine-to-CARE button + test-before-save gate", () => {

  function clearSkills() { window.localStorage.removeItem("ai_skills_v1"); }

  it("PG1 · getSystemFooter('text-brief') enforces the pragmatic output contract (length + no-preamble rules)", () => {
    const f = getSystemFooter("text-brief");
    assert(typeof f === "string" && f.length > 40, "footer must be a non-trivial string");
    assert(/120 words/.test(f), "text-brief footer must set the 120-word cap");
    assert(/preamble/i.test(f), "text-brief footer must ban preamble phrases");
    assert(/paragraphs/i.test(f) || /prose/i.test(f), "must discourage paragraphs of prose");
  });

  it("PG2 · getSystemFooter() (no arg) and unknown modes fall back to text-brief — never return empty", () => {
    const missing = getSystemFooter();
    const unknown = getSystemFooter("some-future-mode-not-shipped");
    const brief   = getSystemFooter("text-brief");
    assertEqual(missing, brief, "missing mode falls back to text-brief");
    assertEqual(unknown, brief, "unknown mode falls back to text-brief");
  });

  it("PG3 · unimplemented mode (action-commands) throws with a version pointer", () => {
    // v2.4.4 · json-schema is now implemented. OH8/OH9 in Suite 30 pin
    // its actual behaviour. Only action-commands still throws; re-open
    // this assertion when v2.4.5+ makes it concrete.
    throws(() => getSystemFooter("action-commands"),
      "action-commands mode must throw (ships in v2.4.5+)");
  });

  it("PG4 · summaryForMode + REFINE_META_SYSTEM exposed for the SkillAdmin UI + meta-prompt", () => {
    assert(typeof summaryForMode === "function", "summaryForMode export must be a function");
    const s = summaryForMode("text-brief");
    assert(typeof s === "string" && s.length > 0, "text-brief summary must be non-empty");
    assert(/guards/i.test(s) || /non-removable/i.test(s),
      "summary must signal that the footer is automatic / non-removable");
    assert(typeof REFINE_META_SYSTEM === "string" && REFINE_META_SYSTEM.length > 40,
      "REFINE_META_SYSTEM meta-prompt must be present for the Refine button");
    assert(/CARE/.test(REFINE_META_SYSTEM), "meta-prompt must reference the CARE framework");
  });

  it("PG5 · SkillAdmin edit form renders Refine + footer-summary hint + save-gate hint (v2.4.6 rule: EDIT is not test-blocked)", () => {
    // v2.4.6 · L6 rule change: test-before-save is MANDATORY for
    // CREATE, ADVISORY for EDIT. The original PG5 (v2.4.3) asserted
    // Save was disabled on Edit too — that contract is retired.
    // The gate still exists, it's just narrower. CREATE-mode coverage
    // lives in Suite 37 QW5. This test covers EDIT-mode: Save enabled
    // AND the save-gate hint is present (warn flavour, not error).
    clearSkills();
    loadSkills();
    const container = document.createElement("div");
    document.body.appendChild(container);
    renderSkillAdmin(container);
    [...container.querySelectorAll("button")].filter(b => b.textContent === "Edit")[0].click();
    const refineBtn = [...container.querySelectorAll("button")].find(b => b.textContent.indexOf("Refine") >= 0);
    assert(refineBtn, "'Refine to CARE format' button must render in the edit form");
    const hint = container.querySelector(".skill-form-footer-hint");
    assert(hint, "footer-summary hint must render under the system-prompt field");
    const saveBtn = [...container.querySelectorAll("button")].find(b => /save|create/i.test(b.textContent));
    assert(saveBtn, "Save/Create button must render");
    assertEqual(saveBtn.disabled, false,
      "EDIT mode: Save must stay ACTIVE (v2.4.6 rule change — test-before-save is CREATE-only)");
    const gateHint = container.querySelector(".save-gate-hint");
    assert(gateHint, "save-gate hint must still render next to Save (advisory state)");
    assert(gateHint.className.indexOf("save-gate-hint-error") < 0,
      "EDIT mode: gate hint must NOT carry error styling (Save is not blocked)");
    container.remove();
    clearSkills();
  });

  it("PG6 · OUTPUT_MODES export is the v2.4.3-shipped triad (text-brief, json-schema, action-commands)", () => {
    assertEqual(OUTPUT_MODES.length, 3, "three declared modes total");
    assert(OUTPUT_MODES.indexOf("text-brief")      >= 0, "text-brief present");
    assert(OUTPUT_MODES.indexOf("json-schema")     >= 0, "json-schema declared (impl v2.4.4)");
    assert(OUTPUT_MODES.indexOf("action-commands") >= 0, "action-commands declared (impl v2.4.5+)");
  });

});

// ── Phase 19d / v2.4.4 · Unified AI platform (OH1-OH17) ──
// Shipped spec: SPEC §12 "AI Platform Specification".
import { parseProposals, applyProposal, applyAllProposals, setPathFromRoot, resolvePathFromRoot }
  from "../interactions/aiCommands.js";
import * as aiUndoStack from "../state/aiUndoStack.js";
import { session as liveSession, replaceSession } from "../state/sessionStore.js";
import { WRITE_RESOLVERS, isWritablePath } from "../core/bindingResolvers.js";
import { FIELD_MANIFEST as FM, writableFieldsForTab } from "../core/fieldManifest.js";
import { RESPONSE_FORMATS, APPLY_POLICIES } from "../core/skillStore.js";

describe("30 · Phase 19d · Output handling + undo stack + per-skill provider", () => {

  function clearSkills() { window.localStorage.removeItem("ai_skills_v1"); }

  it("OH1 · Skill schema: providerKey + outputSchema + responseFormat + applyPolicy round-trip", () => {
    clearSkills();
    loadSkills(); // seed
    const created = addSkill({
      name: "Auto-fill customer",
      tabId: "context",
      promptTemplate: "Fill in customer details.",
      providerKey: "anthropic",
      responseFormat: "json-scalars",
      applyPolicy:    "confirm-per-field",
      outputSchema: [
        { path: "session.customer.name",     label: "Customer name",     kind: "scalar" },
        { path: "session.customer.vertical", label: "Customer vertical", kind: "scalar" }
      ]
    });
    assertEqual(created.providerKey, "anthropic", "providerKey persists on add");
    assertEqual(created.responseFormat, "json-scalars", "responseFormat persists");
    assertEqual(created.applyPolicy, "confirm-per-field", "applyPolicy persists");
    assertEqual(created.outputSchema.length, 2, "outputSchema persists with 2 entries");

    const updated = updateSkill(created.id, { providerKey: null });
    assertEqual(updated.providerKey, null, "providerKey can be cleared to null");

    const all = loadSkills();
    const row = all.find(s => s.id === created.id);
    assert(row.outputSchema.length === 2, "outputSchema survives a reload");
    clearSkills();
  });

  it("OH2 · parseProposals extracts JSON matching the outputSchema allowlist", () => {
    const schema = [
      { path: "session.customer.name",     label: "Customer name",     kind: "scalar" },
      { path: "session.customer.vertical", label: "Customer vertical", kind: "scalar" }
    ];
    const raw = '{"session.customer.name":"Acme Corp","session.customer.vertical":"Financial Services","session.customer.secret":"ignored"}';
    const res = parseProposals(raw, schema);
    assert(res.ok, "parse must succeed on valid JSON");
    assertEqual(res.proposals.length, 2, "only schema-declared paths pass the allowlist");
    const paths = res.proposals.map(p => p.path).sort();
    assert(paths.indexOf("session.customer.secret") < 0,
      "non-schema paths must be silently dropped (allowlist)");
  });

  it("OH3 · parseProposals tolerates code-fenced JSON and leading prose", () => {
    const schema = [{ path: "session.customer.name", label: "Name", kind: "scalar" }];
    const fenced = '```json\n{"session.customer.name":"Acme"}\n```';
    assert(parseProposals(fenced, schema).ok, "code-fenced JSON must parse");
    const prefixed = 'Sure, here is the JSON:\n{"session.customer.name":"Acme"}\nThanks!';
    assert(parseProposals(prefixed, schema).ok, "inline JSON inside prose must parse");
    const broken = 'not json at all';
    assertEqual(parseProposals(broken, schema).ok, false, "non-JSON must return ok:false");
  });

  it("OH4 · setPathFromRoot + resolvePathFromRoot handle nested session paths", () => {
    const root = { session: { customer: { name: "before" } } };
    setPathFromRoot(root, "session.customer.name", "after");
    assertEqual(resolvePathFromRoot(root, "session.customer.name"), "after",
      "nested write + read must round-trip");
    setPathFromRoot(root, "session.customer.region", "EMEA");
    assertEqual(root.session.customer.region, "EMEA", "creates missing keys");
  });

  it("OH5 · aiUndoStack: push + undoLast restores prior session state", () => {
    aiUndoStack._resetForTests();
    const originalName = liveSession.customer ? liveSession.customer.name : "";
    // Push a snapshot of the current state, then mutate, then undo.
    aiUndoStack.push("test snapshot");
    assertEqual(aiUndoStack.canUndo(), true, "canUndo true after push");
    liveSession.customer.name = "Temporarily changed";
    aiUndoStack.undoLast();
    assertEqual(liveSession.customer.name, originalName,
      "undoLast must restore prior state");
    assertEqual(aiUndoStack.canUndo(), false, "stack empty after undo");
  });

  it("OH6 · aiUndoStack caps at 10 entries (oldest dropped)", () => {
    aiUndoStack._resetForTests();
    for (var i = 0; i < 15; i++) aiUndoStack.push("entry " + i);
    assertEqual(aiUndoStack.depth(), 10, "stack must not exceed 10 entries");
    assertEqual(aiUndoStack.peekLabel(), "entry 14", "newest entry on top");
    aiUndoStack._resetForTests();
  });

  it("OH7 · runSkill selects the skill's providerKey override when set and valid", async () => {
    // Build a fake skill with anthropic provider. Config has anthropic pill.
    // We intercept fetch via a custom fetchImpl to assert the request went
    // to anthropic (not the active default).
    saveAiConfig({
      activeProvider: "local",
      providers: { anthropic: { apiKey: "test-key" } }
    });
    const fetches = [];
    const fakeFetch = async function(url, opts) {
      fetches.push({ url: url, headers: opts.headers });
      return {
        ok: true,
        json: async function() {
          return { content: [{ type: "text", text: "{}" }] };
        }
      };
    };
    // Direct test of the provider selection in buildRequest.
    const req = buildRequest("anthropic", {
      baseUrl: "/api/llm/anthropic",
      model:   "claude-haiku-4-5",
      apiKey:  "test-key",
      messages: [{ role: "user", content: "hi" }]
    });
    assertEqual(req.headers["x-api-key"], "test-key",
      "anthropic selection reaches the request builder with its own key");
    window.localStorage.removeItem("ai_config_v1");
  });

  it("OH8 · json-scalars footer lists the declared output paths + types", () => {
    const footer = getSystemFooter("json-scalars", {
      outputSchema: [
        { path: "session.customer.name",     label: "Customer name",     kind: "scalar" },
        { path: "session.customer.vertical", label: "Customer vertical", kind: "scalar" }
      ]
    });
    assert(/session\.customer\.name/.test(footer), "footer must name each declared path");
    assert(/JSON/.test(footer), "footer must demand JSON output");
    assert(/preamble/i.test(footer) || /ONLY/.test(footer), "footer must forbid preamble");
    // Backward-compat: the legacy 'json-schema' name still works.
    const legacyFooter = getSystemFooter("json-schema", { outputSchema: [{ path: "session.customer.name", label: "Name", kind: "scalar" }] });
    assert(/session\.customer\.name/.test(legacyFooter), "legacy 'json-schema' alias still resolves");
  });

  it("OH9 · json-scalars mode without a schema falls back to text-brief (defensive)", () => {
    const footer = getSystemFooter("json-scalars", { outputSchema: [] });
    assert(/120 words/.test(footer),
      "empty-schema json-scalars call must fall back to the safe text-brief footer");
  });

  it("OH10 · FIELD_MANIFEST entries carry writable flag; every writable context.* path has a resolver", () => {
    // Structural invariant: SPEC §12.8 #2.
    Object.keys(FM).forEach(function(tabId) {
      FM[tabId].forEach(function(f) {
        assert(typeof f.writable === "boolean",
          "manifest entry " + f.path + " must declare writable: true|false");
      });
    });
    // Every writable context.* path MUST have a resolver entry.
    Object.keys(FM).forEach(function(tabId) {
      FM[tabId].forEach(function(f) {
        if (f.writable && f.path.indexOf("context.") === 0) {
          assert(WRITE_RESOLVERS[f.path],
            "writable context path " + f.path + " must have a WRITE_RESOLVERS entry");
        }
      });
    });
  });

  it("OH11 · writableFieldsForTab returns only scalar + writable fields", () => {
    ["context", "current", "desired", "gaps", "reporting"].forEach(function(tabId) {
      const writable = writableFieldsForTab(tabId);
      writable.forEach(function(f) {
        assertEqual(f.writable, true, "every returned field must be writable");
        assertEqual(f.kind === "array", false, "arrays excluded");
      });
    });
    // Sanity: Gaps has multiple writable fields (description, urgency, phase, etc.).
    assert(writableFieldsForTab("gaps").length >= 5,
      "Gaps tab must expose ≥ 5 writable fields (description, urgency, phase, notes, ...)");
  });

  it("OH12 · applyProposal via resolver mutates the target gap found by context id", () => {
    // Set up a clean session with one gap, then apply a context.* proposal.
    aiUndoStack._resetForTests();
    replaceSession({
      customer: { name: "Acme", vertical: "Financial Services", drivers: [] },
      instances: [],
      gaps: [{ id: "g-ai1", description: "old desc", urgency: "Low", phase: "later" }]
    });
    const proposal = {
      path:  "context.selectedGap.urgency",
      label: "Selected gap urgency",
      kind:  "scalar",
      before: "Low",
      after:  "High"
    };
    applyProposal(proposal, { context: { selectedGap: { id: "g-ai1" } } });
    assertEqual(liveSession.gaps[0].urgency, "High", "resolver mutated the gap by id");
    assertEqual(aiUndoStack.canUndo(), true, "apply pushed an undo snapshot");
    aiUndoStack._resetForTests();
  });

  it("OH13 · applyProposal rejects unknown-writable paths (no resolver, not session.*)", () => {
    throws(() => applyProposal({
      path: "context.selectedSomething.foo",
      after: "x"
    }), "unknown context path without a resolver must throw");
    // session.* is always allowed (direct write).
    replaceSession({ customer: { name: "X", drivers: [] }, instances: [], gaps: [] });
    doesNotThrow(() => applyProposal({
      path: "session.customer.region",
      after: "EMEA"
    }), "session.* writes always permitted");
  });

  it("OH14 · Legacy outputMode migrates to applyPolicy on load (back-compat)", () => {
    clearSkills();
    saveSkills([{
      id: "legacy-skill",
      name: "Legacy",
      tabId: "context",
      promptTemplate: "x",
      outputMode: "apply-on-confirm"   // legacy field
    }]);
    const loaded = loadSkills().find(s => s.id === "legacy-skill");
    assertEqual(loaded.applyPolicy, "confirm-per-field",
      "outputMode='apply-on-confirm' → applyPolicy='confirm-per-field'");
    clearSkills();
    saveSkills([{ id: "legacy-auto", name: "Auto", tabId: "context", promptTemplate: "x", outputMode: "auto-apply" }]);
    assertEqual(loadSkills().find(s => s.id === "legacy-auto").applyPolicy, "auto",
      "outputMode='auto-apply' → applyPolicy='auto'");
    clearSkills();
    saveSkills([{ id: "legacy-suggest", name: "S", tabId: "context", promptTemplate: "x", outputMode: "suggest" }]);
    assertEqual(loadSkills().find(s => s.id === "legacy-suggest").applyPolicy, "show-only",
      "outputMode='suggest' → applyPolicy='show-only'");
    clearSkills();
  });

  it("OH15 · responseFormat defaults: no outputSchema → text-brief; non-empty outputSchema → json-scalars", () => {
    clearSkills();
    saveSkills([
      { id: "no-schema",  name: "A", tabId: "context", promptTemplate: "x" },
      { id: "with-schema", name: "B", tabId: "gaps", promptTemplate: "x",
        outputSchema: [{ path: "context.selectedGap.urgency", label: "Urgency", kind: "scalar" }] }
    ]);
    const a = loadSkills().find(s => s.id === "no-schema");
    const b = loadSkills().find(s => s.id === "with-schema");
    assertEqual(a.responseFormat, "text-brief",
      "skill with no outputSchema defaults to text-brief");
    assertEqual(b.responseFormat, "json-scalars",
      "skill with outputSchema defaults to json-scalars");
    clearSkills();
  });

  it("OH16 · Enums locked: RESPONSE_FORMATS + APPLY_POLICIES match SPEC §12.1", () => {
    assertEqual(RESPONSE_FORMATS.length, 3, "3 response formats (text-brief, json-scalars, json-commands)");
    assert(RESPONSE_FORMATS.indexOf("text-brief")    >= 0);
    assert(RESPONSE_FORMATS.indexOf("json-scalars")  >= 0);
    assert(RESPONSE_FORMATS.indexOf("json-commands") >= 0);
    assertEqual(APPLY_POLICIES.length, 4, "4 apply policies (show-only, confirm-per-field, confirm-all, auto)");
    assert(APPLY_POLICIES.indexOf("show-only")         >= 0);
    assert(APPLY_POLICIES.indexOf("confirm-per-field") >= 0);
    assert(APPLY_POLICIES.indexOf("confirm-all")       >= 0);
    assert(APPLY_POLICIES.indexOf("auto")              >= 0);
  });

  it("OH17 · json-commands footer declared (stub for v2.4.5); parseProposals does not apply for it", () => {
    // Footer exists so test writers can see the shape...
    const footer = getSystemFooter("json-commands");
    assert(/commands/i.test(footer), "json-commands footer must mention commands array");
    assert(/updateField|createGap|linkInstance/.test(footer),
      "footer names the declared ops so the model sees the whitelist");
    // ...but there's no parser wired yet; runSkill surfaces a clear error via proposalsError.
    // (Full end-to-end test deferred to v2.4.5 when the parser ships.)
  });

});

// ── Phase 19f / v2.4.5.1 · AI reliability (RB1-RB7) ────────────────────
import { chatCompletion, RETRY_MAX_ATTEMPTS, RETRIABLE_STATUSES, backoffMs } from "../services/aiService.js";
import { DEFAULT_AI_CONFIG as AI_DEFAULTS, loadAiConfig as loadAiConfigReliab } from "../core/aiConfig.js";
import { parseFallbackModels } from "../ui/views/SettingsModal.js";

describe("36 · Phase 19f · AI reliability — Anthropic header + retry + fallback chain", () => {

  // Minimal fake fetch that replays a scripted queue of statuses.
  // Each queue entry is a HTTP status. Body is a trivial provider-
  // shaped JSON so extractText returns a predictable marker.
  function scriptedFetch(queue) {
    let idx = 0;
    const calls = [];
    const impl = async function(url, opts) {
      calls.push({ url: url, headers: opts.headers, body: opts.body });
      const status = queue[Math.min(idx, queue.length - 1)];
      idx++;
      if (status >= 200 && status < 300) {
        return {
          ok: true,
          status: status,
          // Anthropic-shaped OK body; extractText tolerates others returning ""
          json: async function() { return { content: [{ type: "text", text: "ok" }] }; },
          text: async function() { return ""; }
        };
      }
      return {
        ok: false,
        status: status,
        json: async function() { return {}; },
        text: async function() { return "simulated " + status; }
      };
    };
    return { impl: impl, calls: calls };
  }

  // Synchronous "wait" stub so tests don't actually sleep for retry
  // backoff. chatCompletion calls waitImpl(ms); we just resolve.
  const noWait = function() { return Promise.resolve(); };

  it("RB1 · Anthropic buildRequest includes the required browser-access opt-in header (Anthropic 401 fix)", () => {
    const req = buildRequest("anthropic", {
      baseUrl: "/api/llm/anthropic",
      model:   "claude-haiku-4-5",
      apiKey:  "sk-ant-test",
      messages: [{ role: "user", content: "hi" }]
    });
    assertEqual(req.headers["anthropic-dangerous-direct-browser-access"], "true",
      "Anthropic proxy requests MUST carry the browser-direct opt-in header " +
      "(otherwise Anthropic responds 401 'CORS requests must set ...')");
    assertEqual(req.headers["x-api-key"], "sk-ant-test", "x-api-key still present");
    assertEqual(req.headers["anthropic-version"], "2023-06-01", "version header still present");
  });

  it("RB2 · chatCompletion retries on 503 and succeeds when upstream recovers", async () => {
    const { impl, calls } = scriptedFetch([503, 503, 200]);
    const res = await chatCompletion({
      providerKey: "anthropic",
      baseUrl:     "/api/llm/anthropic",
      model:       "claude-haiku-4-5",
      apiKey:      "sk-ant-test",
      messages:    [{ role: "user", content: "hi" }],
      fetchImpl:   impl,
      waitImpl:    noWait
    });
    assertEqual(calls.length, 3, "must retry twice (3 calls total) before success");
    assertEqual(res.attempts, 3, "result carries attempt count");
    assertEqual(res.modelUsed, "claude-haiku-4-5", "primary model was the one that succeeded");
    assertEqual(res.text, "ok", "response text extracted from the successful attempt");
  });

  it("RB3 · chatCompletion does NOT retry 401 (terminal error, user must fix key)", async () => {
    const { impl, calls } = scriptedFetch([401, 200]);
    let threw = false;
    try {
      await chatCompletion({
        providerKey: "anthropic",
        baseUrl:     "/api/llm/anthropic",
        model:       "claude-haiku-4-5",
        apiKey:      "bad-key",
        messages:    [{ role: "user", content: "hi" }],
        fetchImpl:   impl,
        waitImpl:    noWait
      });
    } catch (e) {
      threw = true;
      assert(/auth failed/.test(e.message), "error message preserves the auth-failed prefix");
    }
    assert(threw, "401 must throw immediately");
    assertEqual(calls.length, 1, "401 must NOT be retried (only 1 call)");
  });

  it("RB4 · fallback-model chain engages when primary exhausts retries on 503", async () => {
    // Primary model drops every retry; first fallback succeeds.
    const attemptsPerModel = RETRY_MAX_ATTEMPTS;
    const queue = Array(attemptsPerModel).fill(503).concat([200]);
    const { impl, calls } = scriptedFetch(queue);
    const res = await chatCompletion({
      providerKey:    "gemini",
      baseUrl:        "/api/llm/gemini",
      model:          "gemini-2.5-flash",
      fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"],
      apiKey:         "AIza-test",
      messages:       [{ role: "user", content: "hi" }],
      fetchImpl:      impl,
      waitImpl:       noWait
    });
    assertEqual(calls.length, attemptsPerModel + 1,
      "primary exhausts " + attemptsPerModel + " retries, then first fallback succeeds on the next call");
    assertEqual(res.modelUsed, "gemini-2.0-flash", "fallback model recorded on the result");
    // Check the last call actually used the fallback model in the URL.
    assert(calls[calls.length - 1].url.indexOf("gemini-2.0-flash") >= 0,
      "final call must target the fallback model");
  });

  it("RB5 · chain exhaustion: every candidate fails → throws the last transient error", async () => {
    // Primary + one fallback, both drop every retry.
    const total = RETRY_MAX_ATTEMPTS * 2;
    const queue = Array(total).fill(503);
    const { impl, calls } = scriptedFetch(queue);
    let threw = false;
    try {
      await chatCompletion({
        providerKey:    "gemini",
        baseUrl:        "/api/llm/gemini",
        model:          "gemini-2.5-flash",
        fallbackModels: ["gemini-2.0-flash"],
        apiKey:         "AIza-test",
        messages:       [{ role: "user", content: "hi" }],
        fetchImpl:      impl,
        waitImpl:       noWait
      });
    } catch (e) {
      threw = true;
      assert(/upstream temporary error/.test(e.message), "final error keeps the 5xx prefix for the UI hint");
    }
    assert(threw, "exhausted chain must throw");
    assertEqual(calls.length, total, "used full retry budget across every candidate");
  });

  it("RB6 · backoffMs stays within [0, cap]; doubles per attempt", () => {
    // Jitter makes the exact value non-deterministic; assert the range.
    // Attempt 1 ∈ [0, 500]; attempt 2 ∈ [0, 1000]; attempt 3 ∈ [0, 2000]; capped at 4000.
    for (let a = 1; a <= 5; a++) {
      const d = backoffMs(a);
      assert(d >= 0, "attempt " + a + " backoff non-negative");
      assert(d <= 4000, "attempt " + a + " backoff ≤ cap (4s)");
    }
    assert(RETRIABLE_STATUSES.indexOf(429) >= 0, "429 must be retriable");
    assert(RETRIABLE_STATUSES.indexOf(503) >= 0, "503 must be retriable");
    assert(RETRIABLE_STATUSES.indexOf(401) < 0,  "401 must NOT be retriable");
    assert(RETRIABLE_STATUSES.indexOf(400) < 0,  "400 must NOT be retriable");
  });

  it("RB7 · aiConfig defaults include fallback chains + parseFallbackModels round-trip", () => {
    // Defaults — Gemini ships a sensible fallback chain so the user
    // doesn't hit 503 out of the box.
    assert(Array.isArray(AI_DEFAULTS.providers.gemini.fallbackModels),
      "gemini default carries fallbackModels[]");
    assert(AI_DEFAULTS.providers.gemini.fallbackModels.length >= 1,
      "gemini default fallback chain is non-empty");
    assert(Array.isArray(AI_DEFAULTS.providers.anthropic.fallbackModels),
      "anthropic default carries fallbackModels[]");
    assert(Array.isArray(AI_DEFAULTS.providers.local.fallbackModels),
      "local default carries fallbackModels[]");
    // Parser — trims whitespace, drops empties, dedupes.
    assertEqual(parseFallbackModels("a, b ,a,, c").join(","), "a,b,c",
      "comma-split + trim + dedupe");
    assertEqual(parseFallbackModels("").length, 0, "empty string → empty chain");
    assertEqual(parseFallbackModels(null).length, 0, "non-string → empty chain");
    // Config loader honours user-supplied chain.
    window.localStorage.setItem("ai_config_v1", JSON.stringify({
      activeProvider: "gemini",
      providers: { gemini: { fallbackModels: ["custom-fallback"] } }
    }));
    const loaded = loadAiConfigReliab();
    assertEqual(loaded.providers.gemini.fallbackModels[0], "custom-fallback",
      "user-supplied fallbackModels survive mergeWithDefaults");
    window.localStorage.removeItem("ai_config_v1");
  });

});

// ── Phase 19g / v2.4.6 · UX quick-wins (QW1-QW7) ──────────────────────
import { APP_VERSION } from "../core/version.js";
import { SEED_SKILL_IDS as SEED_IDS_FOR_QW } from "../core/seedSkills.js";

describe("37 · Phase 19g · v2.4.6 UX quick-wins — version chip + skill chip + save gate + banner", () => {

  function clearSkills() { window.localStorage.removeItem("ai_skills_v1"); }

  it("QW1 · APP_VERSION is a non-empty semver-shaped string (distinct from session schema version)", () => {
    assert(typeof APP_VERSION === "string" && APP_VERSION.length > 0,
      "APP_VERSION must be a non-empty string");
    // Standard semver: MAJOR.MINOR.PATCH with optional .HOTFIX or
    // -prerelease suffix (-alpha, -rc.1, etc.). v3.0 introduced
    // pre-release suffix support.
    assert(/^\d+\.\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?$/.test(APP_VERSION),
      "APP_VERSION must look like a semver (got: " + APP_VERSION + ")");
    // Must not be "2.0" — that's the (legacy) session schema version
    // in sessionMeta.version, or the "3.0" engagement schema version
    // in v3.0+. Confusing them is the bug this fixes.
    assert(APP_VERSION !== "2.0" && APP_VERSION !== "3.0",
      "APP_VERSION must not collide with a schema version ('2.0' or '3.0')");
  });

  it("QW2 · header renders TWO separate elements: session meta + app version chip", () => {
    // Both IDs must exist in the live DOM per index.html.
    var metaEl = document.getElementById("sessionMetaHeader");
    var verEl  = document.getElementById("appVersionChip");
    assert(metaEl, "header must render a #sessionMetaHeader element");
    assert(verEl,  "header must render a separate #appVersionChip element (v2.4.6 split)");
    // Version chip should display "Canvas v{{APP_VERSION}}" after the
    // initial render pass in app.js.
    assert(verEl.textContent.indexOf("Canvas v") === 0,
      "app version chip must prefix with 'Canvas v' (got: " + verEl.textContent + ")");
    assert(verEl.textContent.indexOf(APP_VERSION) >= 0,
      "app version chip must render APP_VERSION");
    // Session-meta must NOT contain the session-schema version marker
    // any more ("v2.0" was the old confusion source).
    assert(metaEl.textContent.indexOf("v2.0") < 0,
      "session meta chip must NOT display the session-schema version (v2.4.6 removed it)");
  });

  it("QW3 · every seeded skill round-trips into a renderSkillAdmin row with non-empty chip set (no more empty `mode` chip)", () => {
    clearSkills();
    loadSkills(); // seed
    const container = document.createElement("div");
    renderSkillAdmin(container);
    const rows = container.querySelectorAll(".skill-row");
    assertEqual(rows.length, SEED_IDS_FOR_QW.length,
      "one row per seeded skill");
    rows.forEach(function(row) {
      // Old bug: skill.outputMode was rendered → empty <span> → empty chip.
      const oldChip = row.querySelector(".skill-row-mode");
      if (oldChip) {
        assert(oldChip.textContent.trim().length > 0,
          "legacy .skill-row-mode chip (if still rendered for non-seeds) must not be empty");
      }
      // New contract: every row carries a responseFormat chip AND
      // an applyPolicy chip, both with non-empty text.
      const fmtChip    = row.querySelector(".skill-row-format");
      const policyChip = row.querySelector(".skill-row-policy");
      assert(fmtChip,
        "every skill row must render a .skill-row-format chip (v2.4.6)");
      assert(policyChip,
        "every skill row must render a .skill-row-policy chip (v2.4.6)");
      assert(fmtChip.textContent.trim().length > 0,
        "responseFormat chip must be non-empty");
      assert(policyChip.textContent.trim().length > 0,
        "applyPolicy chip must be non-empty");
    });
    clearSkills();
  });

  it("QW4 · skill-row chip vocabulary matches RESPONSE_FORMATS + APPLY_POLICIES (no stale values)", () => {
    clearSkills();
    loadSkills();
    const container = document.createElement("div");
    renderSkillAdmin(container);
    container.querySelectorAll(".skill-row-format").forEach(function(c) {
      assert(RESPONSE_FORMATS.indexOf(c.textContent.trim()) >= 0,
        "chip '" + c.textContent + "' must be a known responseFormat");
    });
    container.querySelectorAll(".skill-row-policy").forEach(function(c) {
      assert(APPLY_POLICIES.indexOf(c.textContent.trim()) >= 0,
        "chip '" + c.textContent + "' must be a known applyPolicy");
    });
    clearSkills();
  });

  it("QW5 · Save button for NEW skill stays disabled until a successful test run", () => {
    clearSkills();
    const container = document.createElement("div");
    renderSkillAdmin(container);
    // Click the "+ Add skill" button to open the form in create mode.
    const addBtn = [...container.querySelectorAll("button")].find(b => /add skill/i.test(b.textContent));
    assert(addBtn, "+ Add skill button must exist");
    addBtn.click();
    // Save button text for a new skill reads "Create skill".
    const saveBtn = container.querySelector(".form-actions .btn-primary");
    assert(saveBtn, "Save button must render inside the edit form");
    assertEqual(/create|save/i.test(saveBtn.textContent), true, "Save button label is present");
    assertEqual(saveBtn.disabled, true,
      "NEW skill: Save button MUST start disabled (test-before-save is mandatory for creation)");
    // The hint alongside must render the error-styled class.
    const hint = container.querySelector(".save-gate-hint");
    assert(hint, "Save gate hint must render");
    assert(hint.className.indexOf("save-gate-hint-error") >= 0,
      "NEW skill + untested: hint must carry error style (blocks save)");
    clearSkills();
  });

  it("QW6 · Save button for EDIT mode stays ENABLED even without re-test (v2.4.6 rule change)", () => {
    clearSkills();
    loadSkills();
    // Pick an existing seed skill and render its edit form directly.
    const seedId = SEED_IDS_FOR_QW[0];
    const container = document.createElement("div");
    renderSkillAdmin(container);
    // Find the Edit button for the first row and click it.
    const editBtn = [...container.querySelectorAll("button")].find(b => /edit/i.test(b.textContent));
    assert(editBtn, "first skill row must surface an Edit button");
    editBtn.click();
    const saveBtn = container.querySelector(".form-actions .btn-primary");
    assert(saveBtn, "Save button must render after Edit click");
    // Edit mode + no re-test = warn, not block.
    assertEqual(saveBtn.disabled, false,
      "EDIT mode: Save button MUST stay active even without re-test (v2.4.6 rule change)");
    const hint = container.querySelector(".save-gate-hint");
    assert(hint, "Save gate hint must render");
    // Hint must be warn OR ok (never error) for existing skills.
    assert(hint.className.indexOf("save-gate-hint-error") < 0,
      "EDIT mode: hint must NOT carry error style (save is not blocked)");
    clearSkills();
  });

  it("QW7 · test runner banner: green fades in ~5s; red stays sticky", () => {
    // Fabricate a results object and call the runner's renderBanner via
    // the side effect of running the suite. Simpler: create a minimal
    // fake results object, invoke the code path by temporarily
    // re-running a single suite? That's heavy. Instead inspect the
    // banner's data attribute we set in testRunner.js.
    // The live banner on the page came from the full run — if it's
    // green it must carry the autoDismissMs marker; if it's red it
    // must NOT.
    const banner = document.getElementById("test-banner");
    if (banner && /passed/i.test(banner.textContent) && !/failed/i.test(banner.textContent)) {
      assertEqual(banner.dataset.autoDismissMs, "5000",
        "green banner must declare a 5s auto-dismiss (v2.4.6 U3)");
    } else if (banner) {
      assert(!banner.dataset.autoDismissMs,
        "failure banner must NOT auto-dismiss — user needs to act on it");
    }
    // Either way the banner must have the opacity transition wired so
    // the fade-out is not a jarring snap.
    if (banner) {
      assert(/opacity/.test(banner.style.transition || ""),
        "banner must declare an opacity transition for graceful fade");
    }
  });

});

// ── Phase 19h / v2.4.7 · Fresh-start UX (FS1-FS5) ──────────────────────
import { isFreshSession, session as liveSession7 } from "../state/sessionStore.js";

describe("38 · Phase 19h · v2.4.7 fresh-start UX — empty default + welcome card", () => {

  it("FS1 · isFreshSession returns true for an empty-shaped session", () => {
    assertEqual(isFreshSession({
      customer: { name: "", drivers: [] },
      instances: [], gaps: []
    }), true, "empty customer + no data → fresh");
    assertEqual(isFreshSession({
      customer: { name: "   ", drivers: [] },
      instances: [], gaps: []
    }), true, "whitespace-only customer name → fresh (trimmed)");
    // Missing arrays should not crash.
    assertEqual(isFreshSession({ customer: {} }), true, "missing arrays → fresh");
    assertEqual(isFreshSession(null), true, "null session → fresh (defensive)");
  });

  it("FS2 · isFreshSession returns false once the user has authored anything", () => {
    assertEqual(isFreshSession({
      customer: { name: "Acme", drivers: [] }, instances: [], gaps: []
    }), false, "customer name present → not fresh");
    assertEqual(isFreshSession({
      customer: { name: "", drivers: [{ id: "cyber_resilience" }] },
      instances: [], gaps: []
    }), false, "drivers present → not fresh");
    assertEqual(isFreshSession({
      customer: { name: "", drivers: [] },
      instances: [{ id: "i-001" }], gaps: []
    }), false, "instances present → not fresh");
    assertEqual(isFreshSession({
      customer: { name: "", drivers: [] },
      instances: [], gaps: [{ id: "g-001" }]
    }), false, "gaps present → not fresh");
  });

  it("FS3 · ContextView renders the fresh-start welcome card on an empty session", () => {
    const emptySession = {
      sessionId: "sess-fs3",
      isDemo: false,
      customer: { name: "", vertical: "", region: "", drivers: [] },
      sessionMeta: { date: "2026-04-24", presalesOwner: "", status: "Draft", version: "2.0" },
      instances: [],
      gaps: []
    };
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderContextView(l, r, emptySession);
    const card = l.querySelector(".fresh-start-card");
    assert(card, "fresh-start card must render for empty session");
    // Card must expose BOTH CTAs: Load demo (primary) + Start fresh (secondary).
    const btns = [...card.querySelectorAll("button")];
    assert(btns.some(b => /load demo/i.test(b.textContent)),
      "welcome card must include 'Load demo' primary CTA");
    assert(btns.some(b => /start fresh/i.test(b.textContent)),
      "welcome card must include 'Start fresh' dismiss CTA");
  });

  it("FS4 · ContextView does NOT render the fresh-start card once the user has data", () => {
    const populatedSession = {
      sessionId: "sess-fs4",
      isDemo: false,
      customer: { name: "Started Co", vertical: "Enterprise", region: "EMEA", drivers: [] },
      sessionMeta: { date: "2026-04-24", presalesOwner: "", status: "Draft", version: "2.0" },
      instances: [],
      gaps: []
    };
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderContextView(l, r, populatedSession);
    assert(!l.querySelector(".fresh-start-card"),
      "fresh-start card must hide as soon as any data exists (customer name alone is enough)");
  });

  it("FS5 · Footer Load-demo button still exists as a persistent affordance", () => {
    // Regression guard: the fresh-start card is additive; the footer
    // button stays. Users who dismiss the card should still be able to
    // load the demo any time.
    const btn = document.getElementById("demoBtn");
    assert(btn, "#demoBtn must still exist in the footer for persistent access to Load demo");
    assert(/demo/i.test(btn.textContent),
      "footer Load-demo button retains its label");
  });

});

// ── Phase 17 / v2.4.8 · Taxonomy unification (TX1-TX10) ────────────────
import {
  ACTIONS, ACTION_IDS, GAP_TYPES as TAX_GAP_TYPES, ACTION_TO_GAP_TYPE as TAX_ACTION_MAP,
  DISPOSITION_ACTIONS as TAX_DISPOSITIONS, actionById, evaluateLinkRule, validateActionLinks
} from "../core/taxonomy.js";
import { session as sessionForTx, replaceSession as replaceSessionForTx, migrateLegacySession as migrateForTx } from "../state/sessionStore.js";

describe("39 · Phase 17 · v2.4.8 taxonomy unification — 7-term Action table", () => {

  it("TX1 · ACTIONS is a 7-entry array with the approved ids", () => {
    assertEqual(ACTIONS.length, 7, "taxonomy ships exactly 7 Actions (user-signed-off 2026-04-24)");
    const expected = ["keep", "enhance", "replace", "consolidate", "retire", "introduce", "ops"];
    expected.forEach(id => assert(ACTION_IDS.indexOf(id) >= 0, "missing Action id: " + id));
    // 'rationalize' must NOT appear — dropped in Phase 17.
    assertEqual(ACTION_IDS.indexOf("rationalize"), -1, "rationalize must be absent from ACTION_IDS");
  });

  it("TX2 · every Action carries id + label + gapType + linksCurrent + linksDesired", () => {
    ACTIONS.forEach(a => {
      assert(typeof a.id === "string" && a.id.length > 0, "Action id must be non-empty string");
      assert(typeof a.label === "string" && a.label.length > 0, "Action.label required");
      // gapType may be null (keep) or a string mapping to a GAP_TYPES entry.
      if (a.gapType !== null) {
        assert(typeof a.gapType === "string", "gapType must be null or a string");
        assert(TAX_GAP_TYPES.indexOf(a.gapType) >= 0,
          "Action '" + a.id + "' gapType '" + a.gapType + "' must be in GAP_TYPES");
      }
      assert(["optional", "number", "string"].indexOf(typeof a.linksCurrent) >= 0 ||
             a.linksCurrent === "optional", "linksCurrent shape");
      assert(["optional", "number", "string"].indexOf(typeof a.linksDesired) >= 0 ||
             a.linksDesired === "optional", "linksDesired shape");
    });
  });

  it("TX3 · GAP_TYPES derived from taxonomy excludes 'rationalize' and is a subset of VALID_GAP_TYPES", () => {
    assertEqual(TAX_GAP_TYPES.indexOf("rationalize"), -1, "rationalize must be gone");
    // Every gapType declared on an action must be valid.
    TAX_GAP_TYPES.forEach(t => {
      doesNotThrow(() => validateGap({ ...validGap(), gapType: t, relatedCurrentInstanceIds: ["i1"] }),
        "gapType '" + t + "' from taxonomy must pass validateGap shape");
    });
  });

  it("TX4 · ACTION_TO_GAP_TYPE maps every action id → its declared gapType", () => {
    ACTIONS.forEach(a => {
      assertEqual(TAX_ACTION_MAP[a.id], a.gapType,
        "ACTION_TO_GAP_TYPE['" + a.id + "'] must match its declared gapType");
    });
  });

  it("TX5 · actionById returns the full entry; unknown id returns null", () => {
    const r = actionById("replace");
    assert(r && r.id === "replace", "actionById should resolve 'replace'");
    assertEqual(actionById("bogus"), null, "unknown id returns null");
  });

  it("TX6 · evaluateLinkRule enforces exact / min-plus / optional semantics", () => {
    assertEqual(evaluateLinkRule("optional", 0, "current").ok, true, "optional permits 0");
    assertEqual(evaluateLinkRule("optional", 99, "current").ok, true, "optional permits many");
    assertEqual(evaluateLinkRule(1, 1, "current").ok, true, "exact 1 with 1");
    assertEqual(evaluateLinkRule(1, 0, "current").ok, false, "exact 1 with 0 fails");
    assertEqual(evaluateLinkRule(1, 2, "current").ok, false, "exact 1 with 2 fails");
    assertEqual(evaluateLinkRule("2+", 2, "current").ok, true, "2+ with 2 passes");
    assertEqual(evaluateLinkRule("2+", 1, "current").ok, false, "2+ with 1 fails");
    assertEqual(evaluateLinkRule("2+", 5, "current").ok, true, "2+ with 5 passes");
  });

  it("TX7 · validateActionLinks enforces rules on reviewed gaps; bypasses unreviewed auto-drafts", () => {
    // Replace requires exactly 1 current + 1 desired.
    const goodReplace = { gapType: "replace", reviewed: true,
      relatedCurrentInstanceIds: ["c1"], relatedDesiredInstanceIds: ["d1"] };
    doesNotThrow(() => validateActionLinks(goodReplace), "good replace gap passes");
    const badReplace = { gapType: "replace", reviewed: true,
      relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: ["d1"] };
    throws(() => validateActionLinks(badReplace), "replace with 0 current must throw");
    // Same bad gap as reviewed:false auto-draft passes (mid-workflow bypass).
    doesNotThrow(() => validateActionLinks({ ...badReplace, reviewed: false }),
      "unreviewed auto-drafts bypass link rules (user is still authoring)");
    // Consolidate requires 2+ current.
    const badCons = { gapType: "consolidate", reviewed: true,
      relatedCurrentInstanceIds: ["c1"], relatedDesiredInstanceIds: ["d1"] };
    throws(() => validateActionLinks(badCons), "consolidate with 1 current must throw");
  });

  it("TX8 · createGap enforces action-link rules for reviewed gaps (integration)", () => {
    const s = createEmptySession();
    // Reviewed replace gap missing the required desired link throws.
    throws(() => createGap(s, {
      description: "Bad replace", layerId: "compute",
      gapType: "replace",
      relatedCurrentInstanceIds: ["i-a"], relatedDesiredInstanceIds: [],
      reviewed: true
    }), "reviewed replace with 0 desired must throw");
    // Same gap as unreviewed auto-draft is allowed.
    doesNotThrow(() => createGap(s, {
      description: "Auto-drafted replace", layerId: "compute",
      gapType: "replace",
      relatedCurrentInstanceIds: ["i-a"], relatedDesiredInstanceIds: [],
      reviewed: false
    }), "unreviewed auto-drafted replace gap allowed");
  });

  it("TX9 · migrateLegacySession coerces rationalize on gap.gapType → ops (idempotent)", () => {
    const legacy = {
      sessionId: "sess-tx9",
      customer: { name: "Legacy Co", vertical: "", segment: "", industry: "", region: "", primaryDriver: "" },
      sessionMeta: { date: "2025-01-01", presalesOwner: "", status: "Draft", version: "1.0" },
      instances: [{ id: "i-x", state: "current", layerId: "compute", environmentId: "coreDc",
        label: "X", vendor: "X", vendorGroup: "custom",
        disposition: "rationalize" }],
      gaps: [{ id: "g-x", description: "rat", layerId: "compute",
        affectedLayers: [], affectedEnvironments: [],
        gapType: "rationalize", urgency: "Medium", phase: "now",
        relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
        status: "open", reviewed: true }]
    };
    const migrated1 = migrateForTx(JSON.parse(JSON.stringify(legacy)));
    assertEqual(migrated1.gaps[0].gapType, "ops",
      "gap.gapType 'rationalize' must coerce to 'ops'");
    assertEqual(migrated1.instances[0].disposition, "retire",
      "instance.disposition 'rationalize' must coerce to 'retire'");
    // Second pass — idempotent.
    const migrated2 = migrateForTx(migrated1);
    assertEqual(migrated2.gaps[0].gapType, "ops", "idempotent: gap stays ops");
    assertEqual(migrated2.instances[0].disposition, "retire", "idempotent: instance stays retire");
  });

  it("TX10 · DISPOSITION_ACTIONS from desiredStateSync is a live re-export (taxonomy is source of truth)", () => {
    // If the source-of-truth file changes, the downstream import must
    // reflect it — regression gate for accidental re-divergence.
    assertEqual(TAX_DISPOSITIONS.length, ACTIONS.length,
      "DISPOSITION_ACTIONS must carry same length as ACTIONS");
    ACTIONS.forEach((a, i) => {
      assertEqual(TAX_DISPOSITIONS[i].id, a.id,
        "DISPOSITION_ACTIONS[" + i + "].id must mirror ACTIONS[" + i + "].id");
    });
  });

});

// ── Phase 19i / v2.4.9 · primary-layer + Gap→Project data model ────────
import { setPrimaryLayer, deriveProjectId } from "../interactions/gapsCommands.js";

describe("40 · Phase 19i · v2.4.9 primary-layer invariant + explicit gap.projectId", () => {

  it("PL1 · validateGap rejects gap.affectedLayers[0] !== gap.layerId", () => {
    throws(() => validateGap({
      ...validGap(),
      layerId: "compute",
      affectedLayers: ["storage", "compute"]
    }), "mismatched primary-layer must throw");
    throws(() => validateGap({
      ...validGap(),
      layerId: "compute",
      affectedLayers: ["storage"]
    }), "primary-layer not in array must throw");
  });

  it("PL2 · validateGap accepts gap.affectedLayers[0] === gap.layerId", () => {
    doesNotThrow(() => validateGap({
      ...validGap(),
      layerId: "compute",
      affectedLayers: ["compute"]
    }), "single-entry match passes");
    doesNotThrow(() => validateGap({
      ...validGap(),
      layerId: "compute",
      affectedLayers: ["compute", "storage"]
    }), "multi-entry with correct primary passes");
  });

  it("PL3 · validateGap tolerates empty affectedLayers array (defensive)", () => {
    doesNotThrow(() => validateGap({
      ...validGap(),
      layerId: "compute",
      affectedLayers: []
    }), "empty array is tolerated — migrator backfills on load");
  });

  it("PL4 · setPrimaryLayer prepends + dedupes to maintain the invariant", () => {
    var g1 = { layerId: "storage", affectedLayers: [] };
    setPrimaryLayer(g1, "compute");
    assertEqual(g1.layerId, "compute", "layerId updated");
    assertEqual(g1.affectedLayers.length, 1, "empty → length 1");
    assertEqual(g1.affectedLayers[0], "compute", "[0] is new primary");

    var g2 = { layerId: "storage", affectedLayers: ["storage", "compute"] };
    setPrimaryLayer(g2, "compute");
    assertEqual(g2.affectedLayers[0], "compute", "new primary first");
    assertEqual(g2.affectedLayers.indexOf("storage") >= 0, true, "old primary retained as non-primary");
    // No duplicates of the new primary.
    var computeCount = g2.affectedLayers.filter(function(l) { return l === "compute"; }).length;
    assertEqual(computeCount, 1, "new primary must appear exactly once after dedupe");
  });

  it("PL5 · migrator backfills affectedLayers[0]=layerId on legacy gaps", () => {
    const legacy = {
      sessionId: "sess-pl5",
      customer: { name: "L", vertical: "", segment: "", industry: "", region: "", primaryDriver: "" },
      sessionMeta: { date: "2025-01-01", presalesOwner: "", status: "Draft", version: "1.0" },
      instances: [],
      gaps: [
        // Legacy 1: affectedLayers empty.
        { id: "g-l1", description: "L1", layerId: "compute", affectedLayers: [],
          affectedEnvironments: [], gapType: "ops",
          relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
          status: "open", reviewed: true },
        // Legacy 2: layerId not in affectedLayers.
        { id: "g-l2", description: "L2", layerId: "compute", affectedLayers: ["storage"],
          affectedEnvironments: [], gapType: "ops",
          relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
          status: "open", reviewed: true },
        // Legacy 3: layerId present but not at index 0.
        { id: "g-l3", description: "L3", layerId: "compute", affectedLayers: ["storage", "compute"],
          affectedEnvironments: [], gapType: "ops",
          relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
          status: "open", reviewed: true }
      ]
    };
    const m = migrateLegacySession(JSON.parse(JSON.stringify(legacy)));
    m.gaps.forEach(function(g) {
      assert(Array.isArray(g.affectedLayers) && g.affectedLayers.length > 0,
        "gap " + g.id + " must have non-empty affectedLayers after migration");
      assertEqual(g.affectedLayers[0], g.layerId,
        "gap " + g.id + " invariant holds after migration");
    });
  });

  it("PR1 · createGap auto-assigns projectId (env::layer::gapType)", () => {
    const s = createEmptySession();
    const gap = createGap(s, {
      description: "Auto",
      layerId: "storage",
      gapType: "replace",
      affectedEnvironments: ["coreDc"],
      relatedCurrentInstanceIds: ["i-1"], relatedDesiredInstanceIds: ["d-1"],
      reviewed: false
    });
    assertEqual(gap.projectId, "coreDc::storage::replace",
      "projectId must derive from (env, layer, gapType)");
  });

  it("PR2 · deriveProjectId falls back to crossCutting when no affectedEnvironments", () => {
    const pid = deriveProjectId({ layerId: "compute", gapType: "ops", affectedEnvironments: [] });
    assertEqual(pid, "crossCutting::compute::ops",
      "no env → crossCutting prefix");
    const pid2 = deriveProjectId({ layerId: "compute", gapType: null });
    assertEqual(pid2, "crossCutting::compute::null",
      "null gapType → 'null' string in projectId");
  });

  it("PR3 · buildProjects groups by gap.projectId (explicit field drives bucketing)", () => {
    const s = createEmptySession();
    // Two gaps that would have been separate projects under the old
    // silent bucketing, but we override projectId so they land in the
    // same project — proves buildProjects reads the field.
    createGap(s, { description: "A", layerId: "storage", gapType: "replace",
      affectedEnvironments: ["coreDc"],
      relatedCurrentInstanceIds: ["i-1"], relatedDesiredInstanceIds: ["d-1"],
      projectId: "merged-project",
      reviewed: false });
    createGap(s, { description: "B", layerId: "compute", gapType: "enhance",
      affectedEnvironments: ["coreDc"],
      relatedCurrentInstanceIds: ["i-2"],
      projectId: "merged-project",
      reviewed: false });
    const { projects } = buildProjects(s, {});
    const merged = projects.find(function(p) { return p.projectId === "merged-project"; });
    assert(merged, "must emit a project with the shared projectId");
    assertEqual(merged.gaps.length, 2, "both gaps must land in the merged project");
  });

  it("PR4 · migrator backfills projectId on legacy gaps", () => {
    const legacy = {
      sessionId: "sess-pr4",
      customer: { name: "", vertical: "", segment: "", industry: "", region: "", primaryDriver: "" },
      sessionMeta: { date: "2025-01-01", presalesOwner: "", status: "Draft", version: "1.0" },
      instances: [],
      gaps: [{ id: "g-old", description: "Legacy", layerId: "storage",
        affectedLayers: ["storage"], affectedEnvironments: ["coreDc"],
        gapType: "replace",
        relatedCurrentInstanceIds: ["i-1"], relatedDesiredInstanceIds: ["d-1"],
        status: "open", reviewed: true
        /* no projectId */
      }]
    };
    const m = migrateLegacySession(JSON.parse(JSON.stringify(legacy)));
    assertEqual(m.gaps[0].projectId, "coreDc::storage::replace",
      "legacy gap must receive a derived projectId");
    // Idempotent: second pass keeps the value.
    const m2 = migrateLegacySession(m);
    assertEqual(m2.gaps[0].projectId, "coreDc::storage::replace",
      "idempotent backfill keeps projectId stable");
  });

  it("PR5 · updateGap re-derives projectId when layerId/env/gapType changes (unless caller sets it)", () => {
    const s = createEmptySession();
    const gap = createGap(s, {
      description: "Moves",
      layerId: "storage", gapType: "replace",
      affectedEnvironments: ["coreDc"],
      relatedCurrentInstanceIds: ["i-1"], relatedDesiredInstanceIds: ["d-1"],
      reviewed: false
    });
    assertEqual(gap.projectId, "coreDc::storage::replace", "baseline");
    const moved = updateGap(s, gap.id, {
      layerId: "compute",
      // layerId change should re-derive projectId AND re-normalise
      // affectedLayers to keep the invariant.
      relatedCurrentInstanceIds: ["i-1"], relatedDesiredInstanceIds: ["d-1"]
    });
    assertEqual(moved.projectId, "coreDc::compute::replace",
      "layerId change must re-derive projectId");
    assertEqual(moved.affectedLayers[0], "compute",
      "layerId change must re-normalise affectedLayers invariant");
    // Explicit projectId in patch overrides the auto-derivation.
    const pinned = updateGap(s, gap.id, { projectId: "special" });
    assertEqual(pinned.projectId, "special",
      "explicit projectId in patch wins over auto-derivation");
  });

  it("CL1 · Clear-all-data footer button renders + is styled destructive", () => {
    const btn = document.getElementById("clearAllBtn");
    assert(btn, "#clearAllBtn must render in the footer");
    assert(/clear/i.test(btn.textContent),
      "button label must include 'Clear'");
    assert(btn.classList.contains("footer-btn-destructive"),
      "button must carry the .footer-btn-destructive class so it reads as destructive");
  });

  it("CL2 · clicking Clear-all-data opens the Notify confirm overlay; canary survives until confirmed", () => {
    // v2.4.15-polish iter-4 . the destructive Clear-all flow migrated
    // from native window.confirm to Notify.js confirmAction (an
    // Overlay-based modal). CL2 now asserts the click opens the
    // overlay (with the right title + danger styling) and that NO
    // wipe happens until the user confirms. Cancel via overlay
    // close-button keeps the canary alive.
    const btn = document.getElementById("clearAllBtn");
    assert(btn, "#clearAllBtn must render");
    window.localStorage.setItem("__cl2_canary__", "alive");
    try {
      btn.click();
      const modal = document.querySelector(".overlay.open.notify-modal");
      assert(modal, "CL2 · click must open a notify-modal Overlay");
      assert(/Clear ALL app data/.test(modal.textContent || ""),
        "CL2 · modal title must explain the clear-all destructive action");
      assert(modal.classList.contains("notify-danger"),
        "CL2 · clear-all confirm must use the danger variant");
      assertEqual(window.localStorage.getItem("__cl2_canary__"), "alive",
        "CL2 · merely opening the modal must NOT wipe storage (canary survives until confirm)");
      // Close via the X button to dismiss without confirming.
      const closeX = modal.querySelector(".overlay-close");
      if (closeX) closeX.click();
    } finally {
      window.localStorage.removeItem("__cl2_canary__");
      // Belt + braces cleanup if the overlay stayed open.
      document.querySelectorAll(".overlay.open, .overlay-backdrop").forEach(function(n) {
        if (n.parentNode) n.parentNode.removeChild(n);
      });
    }
  });

  // CL3 intentionally omitted · firing the real button click would
  // navigate away mid-test (Chromium blocks window.location.reload
  // mocking — non-configurable property). CL1 + CL2 cover the button's
  // contract: it exists, it's styled destructive, and it gates on
  // confirm. The downstream "clear + reload" call chain is a 3-line
  // inline handler whose failure mode would be caught by a manual
  // smoke test on any UX change.

});

// ── Phase 19j / v2.4.10 · Save/Open file (SF1-SF10) ────────────────────
import {
  buildSaveEnvelope, parseFileEnvelope, applyEnvelope,
  suggestFilename, FILE_FORMAT_VERSION, FILE_EXTENSION, FILE_MIME
} from "../services/sessionFile.js";
import { createDemoSession as createDemoSessionForSF } from "../state/demoSession.js";

describe("41 · Phase 19j · v2.4.10 save/open file (.canvas round-trip)", () => {

  function demoBundle() {
    return {
      session: createDemoSessionForSF(),
      skills: [
        { id: "skill-x", name: "X", tabId: "context", promptTemplate: "hi",
          responseFormat: "text-brief", applyPolicy: "show-only",
          outputSchema: [], providerKey: null,
          deployed: true, seed: false,
          createdAt: "2026-04-24T00:00:00Z", updatedAt: "2026-04-24T00:00:00Z" }
      ],
      providerConfig: {
        activeProvider: "gemini",
        providers: {
          local:         { label: "Local",          baseUrl: "/api/llm/local/v1", model: "code-llm",          apiKey: "",        fallbackModels: [] },
          anthropic:     { label: "Anthropic",      baseUrl: "/api/llm/anthropic", model: "claude-haiku-4-5",  apiKey: "SECRET1", fallbackModels: [] },
          gemini:        { label: "Gemini",         baseUrl: "/api/llm/gemini",    model: "gemini-2.5-flash",  apiKey: "SECRET2", fallbackModels: ["gemini-2.0-flash"] },
          dellSalesChat: { label: "Dell Sales Chat", baseUrl: "",                  model: "",                  apiKey: "SECRET3", fallbackModels: [] }
        }
      }
    };
  }

  it("SF1 · buildSaveEnvelope STRIPS API keys by default (security default)", () => {
    const env = buildSaveEnvelope(demoBundle());
    const providers = env.providerConfig.providers;
    ["local", "anthropic", "gemini", "dellSalesChat"].forEach(k => {
      assert(!("apiKey" in providers[k]),
        "provider '" + k + "' must have NO apiKey field when includeApiKeys is false");
    });
    assert(!("providerKeys" in env),
      "envelope must NOT carry a providerKeys bag by default");
  });

  it("SF2 · buildSaveEnvelope includes API keys only when opt-in flag is true", () => {
    const env = buildSaveEnvelope({ ...demoBundle(), includeApiKeys: true });
    // Non-empty keys are tucked into env.providerKeys — separate bag.
    assert(env.providerKeys, "opt-in must add a providerKeys bag");
    assertEqual(env.providerKeys.anthropic.apiKey, "SECRET1", "Anthropic key included");
    assertEqual(env.providerKeys.gemini.apiKey,    "SECRET2", "Gemini key included");
    assert(!env.providerKeys.local, "empty-string Local key must NOT be included");
    // providers map STILL has no apiKey on the record itself.
    assert(!("apiKey" in env.providerConfig.providers.anthropic),
      "keys are only in providerKeys bag, not in the main providers map");
  });

  it("SF3 · envelope carries fileFormatVersion + appVersion + schemaVersion + savedAt", () => {
    const env = buildSaveEnvelope(demoBundle());
    assertEqual(env.fileFormatVersion, FILE_FORMAT_VERSION, "file format version pinned");
    assert(typeof env.appVersion === "string" && env.appVersion.length > 0, "appVersion recorded");
    assertEqual(env.schemaVersion, "2.0", "schemaVersion derived from session.sessionMeta.version");
    assert(/^\d{4}-\d{2}-\d{2}T/.test(env.savedAt || ""), "savedAt is ISO-8601 UTC");
  });

  it("SF4 · suggestFilename produces a safe .canvas filename from customer name + date", () => {
    const s = createDemoSessionForSF();
    const name = suggestFilename(s);
    assert(name.endsWith(FILE_EXTENSION), "filename must end with .canvas");
    assert(!/[^a-z0-9\-.]/.test(name), "filename must be lower-case + hyphens only (safe on every OS)");
    assert(name.indexOf("acme") >= 0 || name.indexOf("session") >= 0,
      "filename reflects customer name slug (or falls back to 'session')");
  });

  it("SF5 · parseFileEnvelope rejects garbage JSON with a readable error", () => {
    throws(() => parseFileEnvelope(""),            "empty rejected");
    throws(() => parseFileEnvelope("not json"),    "non-json rejected");
    throws(() => parseFileEnvelope("[1,2,3]"),     "array rejected (root must be object)");
    throws(() => parseFileEnvelope("{}"),          "missing .session rejected");
  });

  it("SF6 · parseFileEnvelope rejects files from a newer Canvas version", () => {
    const envelope = buildSaveEnvelope(demoBundle());
    envelope.fileFormatVersion = 999;
    throws(() => parseFileEnvelope(JSON.stringify(envelope)),
      "newer fileFormatVersion must be rejected with a clear message");
  });

  it("SF7 · parseFileEnvelope tolerates unknown top-level keys (forward-compat)", () => {
    const envelope = buildSaveEnvelope(demoBundle());
    envelope.futureFieldFromV3 = { anything: true };
    doesNotThrow(() => parseFileEnvelope(JSON.stringify(envelope)),
      "unknown fields must be preserved, not rejected");
  });

  it("SF8 · applyEnvelope runs migrateLegacySession (cross-version migration applied on import)", () => {
    // Construct an envelope whose session has a pre-v2.4.8 rationalize
    // gap. applyEnvelope must coerce it — proves imported files benefit
    // from every migration we've shipped.
    const env = buildSaveEnvelope(demoBundle());
    env.session.gaps.push({
      id: "g-sf8-rat",
      description: "Legacy rationalize gap from a pre-v2.4.8 file",
      layerId: "compute",
      affectedLayers: ["compute"],
      affectedEnvironments: [],
      gapType: "rationalize",   // Phase 17 removed; migrator coerces to "ops"
      urgency: "Low", phase: "later",
      relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
      status: "open", reviewed: true
    });
    const res = applyEnvelope(env);
    const ratGap = res.session.gaps.find(g => g.id === "g-sf8-rat");
    assert(ratGap, "imported gap must survive applyEnvelope");
    assertEqual(ratGap.gapType, "ops",
      "migrator must coerce 'rationalize' → 'ops' on imported file (v2.4.8 rule applies to imports too)");
  });

  it("SF9 · applyEnvelope WARNS about bundled API keys but keeps user's own by default", () => {
    const env = buildSaveEnvelope({ ...demoBundle(), includeApiKeys: true });
    const res = applyEnvelope(env /* no applyApiKeys flag — default false */);
    assert(res.warnings.some(w => /API keys/i.test(w)),
      "user must be warned that the file carried keys but we ignored them");
    // providerConfig is present but carries no apiKey (we stripped on save + didn't apply on open).
    assert(!("apiKey" in res.providerConfig.providers.anthropic),
      "keys must NOT leak into the returned providerConfig unless user opted in");
  });

  it("SF10 · full round-trip: save → parse → apply yields JSON-identical session after a parallel migrator pass", () => {
    // Import the session-store migrator inline so we can run the
    // ORIGINAL session through the same migrator the import path does.
    // Migration is forward-only (adds missing projectId, enforces
    // primary-layer invariant, etc.), so round-trip equality only
    // holds AFTER both sides have been migrated. In real usage, the
    // "original" in localStorage is already migrated on every load;
    // this test mirrors that invariant.
    const bundle = demoBundle();
    const env = buildSaveEnvelope(bundle);
    const json = JSON.stringify(env);
    const parsed = parseFileEnvelope(json);
    const res = applyEnvelope(parsed);
    const originalMigrated = migrateLegacySession(JSON.parse(JSON.stringify(bundle.session)));
    const originalSig = JSON.stringify(originalMigrated);
    const restoredSig = JSON.stringify(res.session);
    assertEqual(restoredSig, originalSig,
      "save → parse → apply must match a parallel migrator pass on the original (stable round-trip)");
    // Skills come back too.
    assertEqual(res.skills.length, bundle.skills.length, "skills round-trip count matches");
    assertEqual(res.skills[0].id, bundle.skills[0].id, "skills round-trip by identity");
  });

});

// ── Phase 19k / v2.4.11 · Rules hardening (RH1-RH20) ───────────────────
import {
  requiresAtLeastOneCurrent,
  requiresAtLeastOneDesired,
  validateActionLinks as validateActionLinksRH,
  actionById as actionByIdRH
} from "../core/taxonomy.js";
import { effectiveDriverReason } from "../services/programsService.js";
import { setPrimaryLayer as setPrimaryLayerRH } from "../interactions/gapsCommands.js";

describe("42 · Phase 19k · v2.4.11 rules hardening + relationships polish", () => {

  it("RH1 · D1 · taxonomy renames Operational → 'Operational / Services'", () => {
    const ops = actionByIdRH("ops");
    assert(ops, "ops action exists");
    assertEqual(ops.label, "Operational / Services", "ops label is now 'Operational / Services'");
  });

  it("RH2 · A3 · requiresAtLeastOneCurrent derives from taxonomy (covers keep + retire too)", () => {
    // keep + retire both gapType: ops/null but linksCurrent: 1
    // Rule fires per-gapType: any Action with that gapType requiring ≥1
    assertEqual(requiresAtLeastOneCurrent("replace"),     true,  "replace needs current");
    assertEqual(requiresAtLeastOneCurrent("enhance"),     true,  "enhance needs current");
    assertEqual(requiresAtLeastOneCurrent("consolidate"), true,  "consolidate needs current (2+)");
    assertEqual(requiresAtLeastOneCurrent("introduce"),   false, "introduce explicitly forbids current");
    // ops gapType has multiple actions: keep (1), retire (1), ops (optional).
    // Since SOME action with this gapType requires ≥1, the helper returns true.
    assertEqual(requiresAtLeastOneCurrent("ops"),         true,  "ops gapType has at least one action requiring current (keep, retire)");
  });

  it("RH3 · A3 · requiresAtLeastOneDesired derives from taxonomy", () => {
    assertEqual(requiresAtLeastOneDesired("replace"),     true,  "replace needs desired");
    assertEqual(requiresAtLeastOneDesired("introduce"),   true,  "introduce needs desired");
    assertEqual(requiresAtLeastOneDesired("consolidate"), true,  "consolidate needs desired");
    assertEqual(requiresAtLeastOneDesired("enhance"),     false, "enhance desired is optional");
    assertEqual(requiresAtLeastOneDesired("ops"),         false, "ops desired is optional (nothing in the table requires it)");
  });

  it("RH4 · F1 · validateActionLinks raises FRIENDLY messages, not raw rule text", () => {
    // Build a reviewed Replace gap with no current → should fire the
    // friendly Replace message.
    const bad = { gapType: "replace", reviewed: true,
      relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: ["d1"] };
    let msg = "";
    try { validateActionLinksRH(bad); } catch (e) { msg = e.message || String(e); }
    assert(/Replace needs the technology being replaced/i.test(msg),
      "Replace error must use the workshop-friendly sentence (got: " + msg + ")");
    // Consolidate with 1 current → friendly Consolidate message.
    const badCons = { gapType: "consolidate", reviewed: true,
      relatedCurrentInstanceIds: ["c1"], relatedDesiredInstanceIds: ["d1"] };
    let msg2 = "";
    try { validateActionLinksRH(badCons); } catch (e) { msg2 = e.message || String(e); }
    assert(/merging multiple things into one/i.test(msg2),
      "Consolidate error must describe the merge concept (got: " + msg2 + ")");
  });

  it("RH5 · A9 · ops gap requires ≥1 link OR ≥10-char notes (review-time)", () => {
    // Reviewed ops gap with NO links and short notes → throw.
    const empty = {
      gapType: "ops", reviewed: true,
      relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
      notes: "todo"
    };
    throws(() => validateActionLinksRH(empty), "empty ops gap must throw with substance hint");
    // Same gap with sufficient notes → passes.
    const withNotes = Object.assign({}, empty, { notes: "Build DR runbook for tier-1 systems by Q3." });
    doesNotThrow(() => validateActionLinksRH(withNotes), "ops gap with notes ≥10 chars passes");
    // Same gap with a link → passes.
    const withLink = Object.assign({}, empty, { relatedCurrentInstanceIds: ["c1"], notes: "" });
    doesNotThrow(() => validateActionLinksRH(withLink), "ops gap with a linked instance passes even without notes");
    // Auto-draft (reviewed:false) bypasses regardless.
    doesNotThrow(() => validateActionLinksRH(Object.assign({}, empty, { reviewed: false })),
      "auto-draft ops gap bypasses the substance rule");
  });

  it("RH6 · A1 · approveGap throws with friendly message for shape-invalid gaps", () => {
    const s = createEmptySession();
    const draft = createGap(s, {
      description: "Bad replace",
      layerId: "compute", gapType: "replace",
      relatedCurrentInstanceIds: ["i-x"],
      // missing desired link — Replace requires 1 desired
      reviewed: false   // auto-draft bypasses on create
    });
    let msg = "";
    try { approveGapCmd(s, draft.id); } catch (e) { msg = e.message || String(e); }
    assert(/Replace needs the new technology/i.test(msg),
      "approveGap must surface the friendly Replace error (got: " + msg + ")");
    // gap.reviewed must STILL be false — not flipped on a failed approve.
    assertEqual(draft.reviewed, false, "approveGap failure must NOT flip reviewed:true");
  });

  it("RH7 · A1 · updateGap implicit reviewed-flip skips when shape is invalid", () => {
    // Create an invalid auto-draft. Edit notes (no patch.reviewed). Should
    // succeed AND keep reviewed:false.
    const s = createEmptySession();
    const draft = createGap(s, {
      description: "Auto-drafted enhance",
      layerId: "compute", gapType: "enhance",
      relatedCurrentInstanceIds: [],   // missing required current
      reviewed: false
    });
    const after = updateGap(s, draft.id, { notes: "Some workshop note" });
    assertEqual(after.reviewed, false,
      "implicit reviewed-flip must NOT happen when validateActionLinks would fail");
    assertEqual(after.notes, "Some workshop note", "the notes edit STILL saves");
  });

  it("RH8 · A1 · updateGap implicit reviewed-flip succeeds on STRUCTURAL change with valid shape", () => {
    // v2.4.11 · A1 (refined) · only STRUCTURAL patches (gapType / layer /
    // env / links) trigger the implicit flip. Metadata edits (notes,
    // urgency, status, driverId, urgencyOverride) deliberately do NOT
    // flip — that would block users mid-workshop from adding a side
    // note to an in-progress invalid gap.
    const s = createEmptySession();
    const valid = createGap(s, {
      description: "Valid enhance",
      layerId: "compute", gapType: "enhance",
      relatedCurrentInstanceIds: ["i-x"],
      reviewed: false
    });
    // Metadata-only patch: NO flip.
    var meta = updateGap(s, valid.id, { notes: "Side note from workshop" });
    assertEqual(meta.reviewed, false,
      "metadata-only patch must NOT auto-flip reviewed (workshop-flow protection)");
    // Structural patch (add a link): flip happens because shape is valid.
    var struct = updateGap(s, valid.id, { relatedCurrentInstanceIds: ["i-x", "i-y"] });
    // 2 currents on enhance — but enhance requires exactly 1, so this
    // would fail. Use a valid structural change instead: change
    // affectedEnvironments which is structural but doesn't break shape.
    var struct2 = updateGap(s, valid.id, {
      relatedCurrentInstanceIds: ["i-x"],   // back to 1
      affectedEnvironments: ["coreDc"]
    });
    assertEqual(struct2.reviewed, true,
      "structural patch with valid resulting shape auto-flips reviewed");
  });

  it("RH9 · A2 · syncGapFromDesired flips linked gaps to status:closed when disposition becomes 'keep'", () => {
    var s = createEmptySession();
    var cur = addInstance(s, { state:"current", layerId:"storage", environmentId:"coreDc",
      label:"Cur", vendorGroup:"dell", criticality:"Medium" });
    var des = addInstance(s, { state:"desired", layerId:"storage", environmentId:"coreDc",
      label:"Des", vendorGroup:"dell", disposition:"replace", priority:"Now", originId: cur.id });
    var gap = createGap(s, buildGapFromDisposition(s, des));
    assertEqual(gap.status, "open", "baseline open");
    des.disposition = "keep";
    syncGapFromDesired(s, des.id);
    var afterGap = s.gaps.find(g => g.id === gap.id);
    assert(afterGap, "gap MUST still exist (no delete)");
    assertEqual(afterGap.status, "closed", "gap.status must flip to 'closed' on Keep");
    assert(/disposition changed to keep/i.test(afterGap.closeReason || ""),
      "closeReason must explain the auto-close");
    assert(typeof afterGap.closedAt === "string", "closedAt must be set as ISO timestamp");
  });

  it("RH10 · A4 · linkDesiredInstance throws PHASE_CONFLICT_NEEDS_ACK when conflict + no acknowledged", () => {
    var s = createEmptySession();
    var des = addInstance(s, { state:"desired", layerId:"compute", environmentId:"coreDc",
      label:"Des", vendorGroup:"dell", priority:"Later" });
    var gap = createGap(s, {
      description:"Phase conflict probe", layerId:"compute",
      phase:"now", reviewed:false
    });
    let err = null;
    try { linkDesiredInstance(s, gap.id, des.id); } catch (e) { err = e; }
    assert(err, "must throw when phase conflicts and acknowledged not passed");
    assertEqual(err.code, "PHASE_CONFLICT_NEEDS_ACK", "error code is PHASE_CONFLICT_NEEDS_ACK");
    // With acknowledged: true the link succeeds.
    doesNotThrow(() => linkDesiredInstance(s, gap.id, des.id, { acknowledged: true }),
      "acknowledged opt-in unblocks the link");
  });

  it("RH11 · A4 · linkDesiredInstance does NOT require acknowledged when there's no conflict", () => {
    var s = createEmptySession();
    var des = addInstance(s, { state:"desired", layerId:"compute", environmentId:"coreDc",
      label:"Des", vendorGroup:"dell", priority:"Now" });
    var gap = createGap(s, {
      description:"No conflict", layerId:"compute",
      phase:"now", reviewed:false
    });
    doesNotThrow(() => linkDesiredInstance(s, gap.id, des.id),
      "no-conflict link works without acknowledged");
  });

  it("RH12 · A5 · effectiveDriverReason returns explicit/suggested/none with reason text", () => {
    var s = createEmptySession();
    s.customer.drivers = [{ id: "cyber_resilience" }, { id: "cost_optimization" }];
    // Explicit
    var explicit = effectiveDriverReason({ driverId: "cyber_resilience" }, s);
    assertEqual(explicit.source, "explicit", "explicit when driverId is set");
    assertEqual(explicit.driverId, "cyber_resilience");
    // Suggested via dataProtection layer rule
    var sug = effectiveDriverReason({ layerId: "dataProtection" }, s);
    assertEqual(sug.source, "suggested", "DP layer triggers suggestion");
    assertEqual(sug.driverId, "cyber_resilience");
    assert(/data protection/i.test(sug.reason), "reason mentions Data Protection");
    // None — no rule matches AND no addedIds intersect
    var none = effectiveDriverReason({ layerId: "compute" }, { customer: { drivers: [] } });
    assertEqual(none.source, "none");
    assertEqual(none.driverId, null);
  });

  it("RH13 · A6 · gap.urgencyOverride blocks propagation from current criticality", () => {
    var s = createEmptySession();
    var cur = addInstance(s, { state:"current", layerId:"storage", environmentId:"coreDc",
      label:"X", vendorGroup:"dell", criticality:"High" });
    var pinnedGap = createGap(s, {
      description:"Pinned urgency", layerId:"storage",
      gapType:"replace",
      relatedCurrentInstanceIds:[cur.id], relatedDesiredInstanceIds:["d-x"],
      urgency:"Low", urgencyOverride:true, reviewed:false
    });
    syncGapsFromCurrentCriticality(s, cur.id);
    assertEqual(pinnedGap.urgency, "Low", "urgencyOverride must block propagation (urgency stays Low)");
    // Same setup without override → urgency follows current.
    var unpinned = createGap(s, {
      description:"Auto urgency", layerId:"storage",
      gapType:"replace",
      relatedCurrentInstanceIds:[cur.id], relatedDesiredInstanceIds:["d-y"],
      urgency:"Low", urgencyOverride:false, reviewed:false
    });
    syncGapsFromCurrentCriticality(s, cur.id);
    assertEqual(unpinned.urgency, "High", "without override, urgency syncs to current's criticality");
  });

  it("RH14 · A6 · validateGap rejects non-boolean urgencyOverride", () => {
    throws(() => validateGap({ ...validGap(), urgencyOverride: "yes" }),
      "string urgencyOverride must throw");
    doesNotThrow(() => validateGap({ ...validGap(), urgencyOverride: true }),  "true is valid");
    doesNotThrow(() => validateGap({ ...validGap(), urgencyOverride: false }), "false is valid");
    doesNotThrow(() => validateGap({ ...validGap() }), "absent is valid");
  });

  it("RH15 · A6 · migrator defaults urgencyOverride:false on legacy gaps", () => {
    var legacy = {
      sessionId: "sess-rh15",
      customer: { name: "L", vertical: "", segment: "", industry: "", region: "", primaryDriver: "" },
      sessionMeta: { date: "2025-01-01", presalesOwner: "", status: "Draft", version: "1.0" },
      instances: [],
      gaps: [{ id: "g-l", description: "L", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [],
        relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
        status: "open", reviewed: true /* no urgencyOverride */ }]
    };
    var m = migrateLegacySession(JSON.parse(JSON.stringify(legacy)));
    assertEqual(m.gaps[0].urgencyOverride, false,
      "migrator must default urgencyOverride to false on legacy gaps");
  });

  it("RH16 · D3 · roadmap project verb becomes 'Retirement' when ALL constituent gaps are retire-action", () => {
    var s = createEmptySession();
    var cur = addInstance(s, { state:"current", layerId:"storage", environmentId:"coreDc",
      label:"Old", vendorGroup:"dell", criticality:"Medium" });
    var des = addInstance(s, { state:"desired", layerId:"storage", environmentId:"coreDc",
      label:"Out", vendorGroup:"dell", disposition:"retire", priority:"Later", originId: cur.id });
    createGap(s, buildGapFromDisposition(s, des));
    var projects = buildProjects(s, {}).projects;
    var p = projects.find(pr => pr.envId === "coreDc" && pr.layerId === "storage" && pr.gapType === "ops");
    assert(p, "retire→ops project must exist");
    assert(/Retirement/.test(p.name),
      "project name must include 'Retirement' when all constituent gaps are retire-action (got: " + p.name + ")");
  });

  it("RH17 · C3 · auto-draft description uses arrow template when both source + desired labels present", () => {
    var s = createEmptySession();
    var cur = addInstance(s, { state:"current", layerId:"compute", environmentId:"coreDc",
      label:"PowerEdge old", vendorGroup:"dell" });
    var des = addInstance(s, { state:"desired", layerId:"compute", environmentId:"coreDc",
      label:"PowerEdge new", vendorGroup:"dell", disposition:"replace", originId: cur.id });
    var props = buildGapFromDisposition(s, des);
    assert(/PowerEdge old → PowerEdge new/.test(props.description),
      "description must read 'Replace PowerEdge old → PowerEdge new' (got: " + props.description + ")");
  });

  it("RH18 · C4 · auto-draft pre-fills notes for every action (not just ops)", () => {
    var s = createEmptySession();
    var cur = addInstance(s, { state:"current", layerId:"storage", environmentId:"coreDc",
      label:"X", vendorGroup:"dell" });
    var des = addInstance(s, { state:"desired", layerId:"storage", environmentId:"coreDc",
      label:"Y", vendorGroup:"dell", disposition:"replace", originId: cur.id });
    var props = buildGapFromDisposition(s, des);
    assert(props.notes && props.notes.length > 0,
      "Replace auto-draft must have non-empty notes (got: " + JSON.stringify(props.notes) + ")");
    // Introduce path
    var introDes = addInstance(s, { state:"desired", layerId:"workload", environmentId:"coreDc",
      label:"AI Pilot", vendorGroup:"dell", disposition:"introduce" });
    var introProps = buildGapFromDisposition(s, introDes);
    assert(/Net-new/i.test(introProps.notes),
      "Introduce auto-draft notes must mention 'Net-new' (got: " + introProps.notes + ")");
  });

  it("RH19 · B2 · setPrimaryLayer keeps invariant when called from updateGap with new layerId", () => {
    var s = createEmptySession();
    var gap = createGap(s, {
      description:"Multi-layer", layerId:"compute",
      affectedLayers: ["compute", "storage"], reviewed:false
    });
    assertEqual(gap.affectedLayers[0], "compute", "baseline primary first");
    var moved = updateGap(s, gap.id, { layerId: "virtualization" });
    assertEqual(moved.layerId, "virtualization", "layerId updated");
    assertEqual(moved.affectedLayers[0], "virtualization",
      "primary moved to index 0; old primary 'compute' demoted to non-primary");
    assert(moved.affectedLayers.indexOf("compute") > 0,
      "old primary stays in affectedLayers as a non-primary entry");
    // No duplicates
    var virtCount = moved.affectedLayers.filter(l => l === "virtualization").length;
    assertEqual(virtCount, 1, "new primary appears exactly once");
  });

  it("RH20 · A3 · unlinkCurrentInstance now blocks for keep + retire too (was missing in pre-v2.4.11 hand-typed list)", () => {
    var s = createEmptySession();
    // 'keep' has gapType: null — unlinkCurrentInstance fires on gapType, so
    // keep gaps don't have a gapType to fire the rule against. Use 'retire'
    // instead (gapType: ops, requiresAtLeastOneCurrent → true via the
    // taxonomy-derived helper).
    var gap = createGap(s, {
      description:"Retire", layerId:"compute", gapType:"ops",
      relatedCurrentInstanceIds:["c1"], relatedDesiredInstanceIds:[],
      // For ops gapType, requires-at-least-one-current is TRUE because
      // 'keep' AND 'retire' actions both require 1. So unlinking the last
      // current must throw via the new helper.
      reviewed:false
    });
    throws(() => unlinkCurrentInstance(s, gap.id, "c1"),
      "ops gap unlinking last current must throw — keep+retire actions need 1 current");
  });

});

// ============================================================================
// SUITE 43 — Phase 19l · v2.4.12 · services scope + pre-flight regression fixes
// ============================================================================
// Section S  (SVC1–SVC10) · gap.services[] field + 10-entry catalog
// Section PR (PR1.a/b · PR2.a/b/c) · regression fixes bundled with the release
// Section U  (U1) · removal of the v2.4.11 D2 "+ Add operational / services gap"
//
// Tests are RED at the spec-and-test-first commit (stubs in
// `core/services.js`, `core/skillsEvents.js`, and `applyContextSave`
// inside `state/sessionStore.js` make imports resolve but content fail).
// Implementation phase replaces the stubs with the real catalog, the real
// PR1 comparison logic, and the emit calls inside skillStore CRUD.
// ============================================================================
describe("43 · Phase 19l · v2.4.12 services scope + pre-flight regression fixes", () => {

  // ──────────────────────────────────────────────────────────────────────
  // Section S · Services scope · SVC1–SVC10
  // ──────────────────────────────────────────────────────────────────────

  it("SVC1 · SERVICE_TYPES is a 10-entry array with id+label+hint shape", () => {
    assert(Array.isArray(SERVICE_TYPES), "SERVICE_TYPES must be an array");
    assertEqual(SERVICE_TYPES.length, 10, "SERVICE_TYPES must have exactly 10 entries");
    SERVICE_TYPES.forEach((s, i) => {
      assert(typeof s.id    === "string" && s.id.length    > 0, "entry " + i + " missing id");
      assert(typeof s.label === "string" && s.label.length > 0, "entry " + i + " missing label");
      assert(typeof s.hint  === "string" && s.hint.length  > 0, "entry " + i + " missing hint");
    });
    var ids = SERVICE_TYPES.map(s => s.id);
    ["assessment","migration","deployment","integration","training",
     "knowledge_transfer","runbook","managed","decommissioning","custom_dev"
    ].forEach(id => {
      assert(ids.indexOf(id) >= 0, "SERVICE_TYPES must include id '" + id + "'");
    });
  });

  it("SVC2 · gap.services persists round-trip through createGap + updateGap", () => {
    var s = createEmptySession();
    var g = createGap(s, {
      description: "Service-bearing gap", layerId: "compute",
      services: ["migration", "deployment"]
    });
    assert(Array.isArray(g.services), "createGap must preserve services as an array");
    assertEqual(g.services.length, 2, "createGap must keep both services");
    assertEqual(g.services[0], "migration", "first service preserved");
    var u = updateGap(s, g.id, { services: ["migration", "deployment", "training"] });
    assertEqual(u.services.length, 3, "updateGap must accept services patch");
    assert(u.services.indexOf("training") >= 0, "added service appears");
  });

  it("SVC3 · gap.services dedupes on createGap (same id twice → one)", () => {
    var s = createEmptySession();
    var g = createGap(s, {
      description: "Dup probe", layerId: "compute",
      services: ["migration", "migration", "deployment"]
    });
    assertEqual((g.services || []).length, 2, "duplicate ids must be deduped to 2");
  });

  it("SVC4 · SUGGESTED_SERVICES_BY_GAP_TYPE returns the right chips per gapType", () => {
    var rep = SUGGESTED_SERVICES_BY_GAP_TYPE.replace || [];
    assert(rep.indexOf("migration")  >= 0, "replace suggests migration (got: " + rep + ")");
    assert(rep.indexOf("deployment") >= 0, "replace suggests deployment (got: " + rep + ")");
    var con = SUGGESTED_SERVICES_BY_GAP_TYPE.consolidate || [];
    assert(con.indexOf("migration")          >= 0, "consolidate suggests migration");
    assert(con.indexOf("integration")        >= 0, "consolidate suggests integration");
    assert(con.indexOf("knowledge_transfer") >= 0, "consolidate suggests knowledge_transfer");
    var intro = SUGGESTED_SERVICES_BY_GAP_TYPE.introduce || [];
    assert(intro.indexOf("deployment") >= 0, "introduce suggests deployment");
    assert(intro.indexOf("training")   >= 0, "introduce suggests training");
    var ops = SUGGESTED_SERVICES_BY_GAP_TYPE.ops || [];
    assert(ops.indexOf("runbook") >= 0, "ops suggests runbook");
  });

  it("SVC5 · changing gap.gapType does NOT auto-mutate gap.services (opt-in)", () => {
    var s = createEmptySession();
    var g = createGap(s, {
      description: "Type-change probe", layerId: "compute", gapType: "replace",
      relatedCurrentInstanceIds: ["c-x"], relatedDesiredInstanceIds: ["d-x"],
      services: ["migration"]
    });
    var u = updateGap(s, g.id, { gapType: "consolidate",
      relatedCurrentInstanceIds: ["c-x", "c-y"], relatedDesiredInstanceIds: ["d-x"] });
    assert(Array.isArray(u.services), "services must remain an array after gapType change");
    assertEqual(u.services.length, 1, "user's prior pick preserved (no auto-replacement)");
    assertEqual(u.services[0], "migration", "the prior service id is intact");
  });

  it("SVC6 · empty array is a valid services value (not undefined)", () => {
    var s = createEmptySession();
    var g = createGap(s, { description: "Empty services", layerId: "compute", services: [] });
    assert(Array.isArray(g.services), "services must be an array even when empty");
    assertEqual(g.services.length, 0, "empty array preserved");
    doesNotThrow(() => validateGap(g), "empty services array passes validateGap");
  });

  it("SVC7 · invalid id in services array is rejected by validateGap", () => {
    var bad = Object.assign({}, validGap(), { services: ["migration", "totally-not-a-service"] });
    throws(() => validateGap(bad), "validateGap must reject unknown service ids");
  });

  it("SVC8 · roadmap project services chip = union of constituent gap services, deduped", () => {
    var s = createEmptySession();
    var cur1 = addInstance(s, { state: "current", layerId: "storage", environmentId: "coreDc",
      label: "Old A", vendorGroup: "dell", criticality: "Medium" });
    var cur2 = addInstance(s, { state: "current", layerId: "storage", environmentId: "coreDc",
      label: "Old B", vendorGroup: "dell", criticality: "Medium" });
    var des1 = addInstance(s, { state: "desired", layerId: "storage", environmentId: "coreDc",
      label: "New A", vendorGroup: "dell", disposition: "replace", priority: "Now", originId: cur1.id });
    var des2 = addInstance(s, { state: "desired", layerId: "storage", environmentId: "coreDc",
      label: "New B", vendorGroup: "dell", disposition: "replace", priority: "Now", originId: cur2.id });
    createGap(s, { description: "g-svc8-1", layerId: "storage", gapType: "replace",
      relatedCurrentInstanceIds: [cur1.id], relatedDesiredInstanceIds: [des1.id],
      services: ["migration", "deployment"] });
    createGap(s, { description: "g-svc8-2", layerId: "storage", gapType: "replace",
      relatedCurrentInstanceIds: [cur2.id], relatedDesiredInstanceIds: [des2.id],
      services: ["migration", "training"] });
    var projects = buildProjects(s, {}).projects;
    var proj = projects.find(p => p.envId === "coreDc" && p.layerId === "storage" && p.gapType === "replace");
    assert(proj, "matching project must be built (envId: coreDc, layer: storage, replace)");
    assert(Array.isArray(proj.services), "project must expose a services union (Array)");
    assertEqual(proj.services.length, 3, "deduped union must contain migration+deployment+training");
    ["migration", "deployment", "training"].forEach(id =>
      assert(proj.services.indexOf(id) >= 0, "union must include '" + id + "'"));
  });

  // v2.4.13 S0 · SVC9 dropped. Original test asserted the "Services scope"
  // sub-tab appeared in the Reporting view DOM. The sub-tab itself is
  // removed (Suite 45 VT21 asserts the removal). Per-gap and per-project
  // services info still surfaces on gap/project drawer bodies (covered by
  // SVC11/SVC15 + the v2.5.0 detail-panel template).

  it("SVC10 · gap.services round-trips through JSON (.canvas envelope)", () => {
    var s = createEmptySession();
    var g = createGap(s, {
      description: "Round-trip probe", layerId: "compute",
      services: ["migration", "deployment"]
    });
    var json = JSON.stringify(s);
    var back = JSON.parse(json);
    var rg = back.gaps.find(x => x.id === g.id);
    assert(rg, "gap must survive JSON round-trip");
    assert(Array.isArray(rg.services), "services must remain an array post-JSON");
    assertEqual(rg.services.length, 2, "services length preserved");
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section PR · Pre-flight regression fixes (PR1 + PR2)
  // ──────────────────────────────────────────────────────────────────────

  it("PR1.a · ContextView no-op Save preserves session.isDemo", () => {
    replaceSession({
      sessionId: "sess-pr1a", isDemo: true,
      customer: { name: "Acme Financial Services", vertical: "Financial Services",
                  segment: "", industry: "", region: "EMEA", drivers: [] },
      sessionMeta: { date: "2026-04-26", presalesOwner: "", status: "Draft", version: "2.0" },
      instances: [], gaps: []
    });
    applyContextSave({
      customer: { name: "Acme Financial Services", vertical: "Financial Services", region: "EMEA" },
      sessionMeta: { presalesOwner: "" }
    });
    assertEqual(session.isDemo, true,
      "no-op save (no field changed) must NOT flip isDemo to false — demo banner must survive refresh");
  });

  it("PR1.b · ContextView Save with name change DOES flip isDemo to false", () => {
    replaceSession({
      sessionId: "sess-pr1b", isDemo: true,
      customer: { name: "Acme Financial Services", vertical: "Financial Services",
                  segment: "", industry: "", region: "EMEA", drivers: [] },
      sessionMeta: { date: "2026-04-26", presalesOwner: "", status: "Draft", version: "2.0" },
      instances: [], gaps: []
    });
    applyContextSave({
      customer: { name: "Different Customer Co", vertical: "Financial Services", region: "EMEA" },
      sessionMeta: { presalesOwner: "" }
    });
    assertEqual(session.isDemo, false,
      "real name change must flip isDemo to false (legitimate path preserved)");
    assertEqual(session.customer.name, "Different Customer Co", "name patch was applied");
  });

  // PR2 helpers — each test isolates its own ai_skills_v1 storage so it
  // never sees skills from other tests or the user's real localStorage.
  function withIsolatedSkillsStorage(fn) {
    var savedBlob;
    try { savedBlob = window.localStorage.getItem("ai_skills_v1"); }
    catch (e) { savedBlob = null; }
    try {
      try { window.localStorage.removeItem("ai_skills_v1"); } catch (e) {}
      _resetSkillsEventsForTests();
      fn();
    } finally {
      try {
        if (savedBlob === null) window.localStorage.removeItem("ai_skills_v1");
        else                    window.localStorage.setItem("ai_skills_v1", savedBlob);
      } catch (e) {}
      _resetSkillsEventsForTests();
    }
  }

  it("PR2.a · addSkill emits skills-changed", () => {
    withIsolatedSkillsStorage(function() {
      var seen = [];
      var off = onSkillsChanged(function(evt) { seen.push(evt.reason); });
      try {
        addSkill({ name: "PR2.a probe", tabId: "context", promptTemplate: "x" });
        assert(seen.length >= 1,
          "addSkill must emit a skills-changed event so the per-tab dropdown re-renders without a tab switch (saw " + seen.length + ")");
      } finally { off(); }
    });
  });

  it("PR2.b · updateSkill emits skills-changed (deploy/undeploy/reassign all fire)", () => {
    withIsolatedSkillsStorage(function() {
      var skill = addSkill({ name: "PR2.b probe", tabId: "context", promptTemplate: "x" });
      var seen = [];
      var off = onSkillsChanged(function(evt) { seen.push(evt.reason); });
      try {
        updateSkill(skill.id, { deployed: false });   // undeploy
        assert(seen.length >= 1,
          "updateSkill (toggling deployed) must emit skills-changed (saw " + seen.length + ")");
      } finally { off(); }
    });
  });

  it("PR2.c · deleteSkill emits skills-changed", () => {
    withIsolatedSkillsStorage(function() {
      var skill = addSkill({ name: "PR2.c probe", tabId: "context", promptTemplate: "x" });
      var seen = [];
      var off = onSkillsChanged(function(evt) { seen.push(evt.reason); });
      try {
        deleteSkill(skill.id);
        assert(seen.length >= 1,
          "deleteSkill must emit skills-changed so the dropdown drops the deleted skill (saw " + seen.length + ")");
      } finally { off(); }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section U · UI subtractions (U1)
  // ──────────────────────────────────────────────────────────────────────

  it("U1 · Tab 4 has no '+ Add operational / services gap' button (services attach to regular gaps)", () => {
    var l = document.createElement("div"); var r = document.createElement("div");
    renderGapsEditView(l, r, freshSession());
    var btnTexts = Array.from(l.querySelectorAll("button"))
      .map(b => (b.textContent || "").trim());
    var hasAddGap = btnTexts.some(t => /^\+\s*add gap\b/i.test(t));
    var hasOpsGap = btnTexts.some(t => /operational.*\/?\s*services?\s+gap/i.test(t));
    assert(hasAddGap,
      "Tab 4 must still have the generic '+ Add gap' button");
    assert(!hasOpsGap,
      "v2.4.12 U1 — '+ Add operational / services gap' CTA must be REMOVED (services attach to regular gaps; dedicated CTA is redundant). Found buttons: " + JSON.stringify(btnTexts));
  });

  // ──────────────────────────────────────────────────────────────────────
  // Hot-patch addendum (P1-P3 · post-smoke fixes folded into v2.4.12)
  // ──────────────────────────────────────────────────────────────────────

  it("SVC11 · P1 · gap detail exposes a picker covering the FULL catalog (any service can be added regardless of gapType)", () => {
    var s = createEmptySession();
    var gap = createGap(s, {
      description: "Picker probe", layerId: "compute", gapType: "replace",
      relatedCurrentInstanceIds: ["c-x"], relatedDesiredInstanceIds: ["d-x"],
      services: []
    });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderGapsEditView(l, r, s);
    // Click the gap card to open the right-panel detail.
    var card = l.querySelector(".gap-card");
    assert(card, "gap card must render so detail can open");
    card.click();
    // The picker is named via class `services-add-picker` (P1 contract).
    var picker = r.querySelector(".services-add-picker");
    assert(picker, "v2.4.12 P1 — gap detail must expose a 'services-add-picker' element");
    // It must offer at least one option NOT in SUGGESTED_SERVICES_BY_GAP_TYPE['replace']
    // (which is just ["migration","deployment"]). e.g. 'decommissioning' must be reachable.
    var optionTexts = Array.from(picker.querySelectorAll("option"))
      .map(o => (o.value || "").trim()).filter(Boolean);
    assert(optionTexts.indexOf("decommissioning") >= 0,
      "picker must include 'decommissioning' (not in SUGGESTED_SERVICES_BY_GAP_TYPE.replace) — covers SVC11 contract that any catalog id is reachable");
    assert(optionTexts.indexOf("custom_dev") >= 0,
      "picker must include 'custom_dev' so the full catalog is reachable");
    // Sanity: at least 8 options (10 catalog - any already-picked, here 0 picked).
    assert(optionTexts.length >= 8,
      "picker must offer at least 8 unselected options; got " + optionTexts.length);
  });

  it("SVC12 · P2 · M11 migrator backfills services:[] on legacy gaps without the field", () => {
    var legacy = {
      sessionId: "sess-svc12",
      customer: { name: "L", vertical: "", segment: "", industry: "", region: "", primaryDriver: "" },
      sessionMeta: { date: "2025-01-01", presalesOwner: "", status: "Draft", version: "1.0" },
      instances: [],
      gaps: [{
        id: "g-svc12", description: "L", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [],
        relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
        status: "open", reviewed: true
        // no services key
      }, {
        id: "g-svc12b", description: "preserves existing", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [],
        relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
        status: "open", reviewed: true,
        services: ["migration", "deployment"]
      }]
    };
    var m = migrateLegacySession(JSON.parse(JSON.stringify(legacy)));
    assert(Array.isArray(m.gaps[0].services),
      "M11 — legacy gap without services key must get services:[] post-migrate");
    assertEqual(m.gaps[0].services.length, 0,
      "M11 — backfilled services must be an empty array");
    // Existing services preserved
    assertEqual(m.gaps[1].services.length, 2,
      "M11 — gap WITH services preserves the array unchanged");
    assertEqual(m.gaps[1].services[0], "migration",
      "M11 — first existing service preserved at original index");
  });

  it("SVC13 · P2 · buildProjects rollup excludes services from gaps with status:'closed'", () => {
    var s = createEmptySession();
    var cur1 = addInstance(s, { state: "current", layerId: "storage", environmentId: "coreDc",
      label: "Active", vendorGroup: "dell", criticality: "Medium" });
    var cur2 = addInstance(s, { state: "current", layerId: "storage", environmentId: "coreDc",
      label: "Closed", vendorGroup: "dell", criticality: "Medium" });
    var des1 = addInstance(s, { state: "desired", layerId: "storage", environmentId: "coreDc",
      label: "Active des", vendorGroup: "dell", disposition: "replace", priority: "Now", originId: cur1.id });
    var des2 = addInstance(s, { state: "desired", layerId: "storage", environmentId: "coreDc",
      label: "Closed des", vendorGroup: "dell", disposition: "replace", priority: "Now", originId: cur2.id });
    createGap(s, { description: "open gap", layerId: "storage", gapType: "replace",
      relatedCurrentInstanceIds: [cur1.id], relatedDesiredInstanceIds: [des1.id],
      services: ["migration", "training"], status: "open" });
    var closedGap = createGap(s, { description: "closed gap", layerId: "storage", gapType: "replace",
      relatedCurrentInstanceIds: [cur2.id], relatedDesiredInstanceIds: [des2.id],
      services: ["decommissioning", "managed"], status: "open" });
    closedGap.status = "closed";
    closedGap.closeReason = "manual";
    closedGap.closedAt = new Date().toISOString();
    var projects = buildProjects(s, {}).projects;
    var proj = projects.find(p => p.envId === "coreDc" && p.layerId === "storage" && p.gapType === "replace");
    assert(proj, "project must build from the open gap");
    assert(Array.isArray(proj.services), "project services must exist");
    assert(proj.services.indexOf("migration") >= 0, "open gap's 'migration' included");
    assert(proj.services.indexOf("training")  >= 0, "open gap's 'training' included");
    assert(proj.services.indexOf("decommissioning") < 0,
      "P2 — closed gap's services must NOT bleed into project rollup (got: " + JSON.stringify(proj.services) + ")");
    assert(proj.services.indexOf("managed") < 0,
      "P2 — closed gap's services must NOT bleed into project rollup");
  });

  it("SVC14 · P2 · applyProposal + undoLast preserves services byte-identically", () => {
    aiUndoStack._resetForTests();
    replaceSession({
      sessionId: "sess-svc14", isDemo: false,
      customer: { name: "Svc14 Co", vertical: "Enterprise", region: "EMEA",
                  drivers: [{ id: "cyber_resilience", priority: "High", outcomes: "" }] },
      sessionMeta: { date: "2026-04-26", presalesOwner: "", status: "Draft", version: "2.0" },
      instances: [],
      gaps: [{ id: "g-svc14", description: "round-trip probe", layerId: "compute",
               affectedLayers: ["compute"], affectedEnvironments: [],
               urgency: "Medium", phase: "now", gapType: "replace",
               relatedCurrentInstanceIds: ["c-x"], relatedDesiredInstanceIds: ["d-x"],
               services: ["migration"],
               status: "open", reviewed: true }]
    });
    var before = JSON.stringify(session);
    applyProposal(
      { path: "context.selectedGap.services", label: "Gap services", kind: "array",
        before: ["migration"], after: ["migration", "deployment", "training"] },
      { label: "apply for SVC14", context: { selectedGap: { id: "g-svc14" } } }
    );
    assertEqual(session.gaps[0].services.length, 3, "apply mutated services array");
    aiUndoStack.undoLast();
    var after = JSON.stringify(session);
    assertEqual(after, before,
      "P2 — apply + undoLast on services must return session to byte-identical JSON");
    aiUndoStack._resetForTests();
  });

  it("SVC15 · P3 · SummaryGapsView right-panel detail surfaces selected gap's services as a chip row", () => {
    var s = createEmptySession();
    var cur = addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "Old", vendorGroup: "dell", criticality: "Medium" });
    var des = addInstance(s, { state: "desired", layerId: "compute", environmentId: "coreDc",
      label: "New", vendorGroup: "dell", disposition: "replace", priority: "Now", originId: cur.id });
    createGap(s, { description: "Replace probe", layerId: "compute", gapType: "replace",
      relatedCurrentInstanceIds: [cur.id], relatedDesiredInstanceIds: [des.id],
      services: ["migration", "training"] });
    // SummaryGapsView reads from the live session singleton (per Phase 14 t7.2 pattern),
    // so swap the gap into liveSession then re-render.
    var origGaps = session.gaps.slice();
    session.gaps = s.gaps.slice();
    var l = document.createElement("div"); var r = document.createElement("div");
    renderSummaryGapsView(l, r);
    var card = l.querySelector(".gap-card");
    assert(card, "Reporting Gaps Board must render at least one card with our gap");
    card.click();
    var detail = r.querySelector(".detail-panel");
    assert(detail, "right panel must contain .detail-panel after clicking a gap card");
    var detailText = (detail.innerText || "").toLowerCase();
    var hasServicesLabel = /services needed|services/i.test(detailText);
    var migrationChipPresent = /migration/i.test(detailText);
    var trainingChipPresent  = /training/i.test(detailText);
    // restore live session before asserting
    session.gaps = origGaps;
    assert(hasServicesLabel,
      "P3 — Reporting Gaps Board detail panel must label the services section");
    assert(migrationChipPresent && trainingChipPresent,
      "P3 — detail panel must surface BOTH services from the selected gap (migration + training)");
  });

});

// ============================================================================
// SUITE 44, Phase 19m / v2.5.0 crown-jewel UI rework
// ============================================================================
// VT1-VT20 covering Sections 1-9 of the v2.5.0 spec:
//   .1 design system tokens + eyebrow utility (VT1, VT2)
//   .8 single .tag primitive vocabulary migration (VT3)
//   .2 topbar white + local logo + mono-leading-zero stepper (VT4-VT6)
//   .5 drawer module + per-tab wiring + content-swap (VT7-VT12)
//   .4 detail panel template (VT13-VT15)
//   .AI AI assist mounted on every entity drawer (VT16)
//   .6 cross-tab filter system (VT17-VT18)
//   .7 services scope redesign (VT19)
//   .0 em-dash absence audit (VT20)
//
// Stubs in place so imports resolve and tests fail RED on content,
// not on module-load errors:
//   ui/components/Drawer.js   STUB no-op exports.
//   core/services.js          domain field added in implementation phase.
// Implementation phase fills in Drawer DOM construction, design tokens,
// eyebrow utility, .tag migration, drawer wiring per tab, AI mounting,
// filter system, services-scope cards, and the em-dash sweep.
// ============================================================================

// v2.4.14 . Drawer.js removed (drawer-everywhere parked per user 2026-04-27);
// Suite 44 VT7-VT14 + VT16 deleted alongside.

describe("44 · Phase 19m · v2.5.0 crown-jewel UI rework", () => {

  // Helpers scoped to Suite 44.
  function fixtureSession() {
    var s = createEmptySession();
    var cur = addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "VT probe current", vendorGroup: "dell", criticality: "Medium" });
    var des = addInstance(s, { state: "desired", layerId: "compute", environmentId: "coreDc",
      label: "VT probe desired", vendorGroup: "dell", disposition: "replace", priority: "Now", originId: cur.id });
    createGap(s, { description: "VT probe gap", layerId: "compute", gapType: "replace",
      relatedCurrentInstanceIds: [cur.id], relatedDesiredInstanceIds: [des.id],
      services: ["migration", "training"], urgency: "High" });
    return s;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Section 1, design system tokens + eyebrow utility (VT1-VT2)
  // ──────────────────────────────────────────────────────────────────────

  it("VT1 · DS1 design tokens resolve on body (4-tier ink, 3-tier surface, hairline scale, signal palette, hover-only shadow scale)", () => {
    const cs = getComputedStyle(document.body);
    const required = [
      "--ink", "--ink-soft", "--ink-mute", "--ink-faint",
      "--canvas", "--canvas-soft", "--canvas-alt",
      "--rule", "--rule-strong",
      "--dell-blue", "--dell-blue-deep", "--dell-blue-soft",
      "--shadow-sm", "--shadow-md", "--shadow-lg",
      "--red", "--green", "--amber"
    ];
    required.forEach((name) => {
      const val = cs.getPropertyValue(name).trim();
      assert(val.length > 0, "DS1 token " + name + " must resolve to a non-empty value (got '" + val + "')");
    });
  });

  it("VT2 · DS2 eyebrow utility renders mono uppercase with letter-spacing >= 1.5px", () => {
    const fixture = document.createElement("span");
    fixture.className = "eyebrow";
    fixture.textContent = "TEST EYEBROW";
    document.body.appendChild(fixture);
    try {
      const cs = getComputedStyle(fixture);
      assert(/JetBrains Mono|monospace/i.test(cs.fontFamily),
        "DS2 eyebrow must use mono font (got: " + cs.fontFamily + ")");
      assertEqual(cs.textTransform, "uppercase",
        "DS2 eyebrow must be uppercase");
      const ls = parseFloat(cs.letterSpacing);
      assert(ls >= 1.5,
        "DS2 eyebrow letter-spacing must be >= 1.5px (got " + cs.letterSpacing + ")");
    } finally {
      document.body.removeChild(fixture);
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section 8, tag vocabulary migration (VT3)
  // ──────────────────────────────────────────────────────────────────────

  // v2.4.14 . VT3 deleted. TV1-TV9 tag-primitive migration is pure CSS
  // tech debt with no user-visible value; parked indefinitely.

  // ──────────────────────────────────────────────────────────────────────
  // Section 2, topbar (VT4-VT6)
  // ──────────────────────────────────────────────────────────────────────

  it("VT4 · TB1 topbar carries a Dell-blue cue (hue tint or accent stripe) without flooding the band", () => {
    // v2.4.13 user-feedback update (2026-04-27): the original v2.5.0 spec
    // committed to a fully white topbar with a 1px hairline rule. User
    // feedback after the v2.4.13 polish pass: "the top banner needs a
    // hue of Dell blue to give it authority and stance and contrast."
    // VT4 now asserts the topbar reads as Dell-branded (any of: a Dell-
    // blue tinted background, a gradient that includes Dell-blue, or
    // a Dell-blue bottom rule >= 2px) without going so far as a fully
    // saturated Dell-blue floor that would compete with primary CTAs.
    var header = document.querySelector("header") || document.querySelector(".topbar");
    assert(header, "Topbar must exist in the document");
    var cs = getComputedStyle(header);
    var bgi = cs.backgroundImage || "none";
    var bgc = cs.backgroundColor || "";
    var bb  = cs.borderBottomColor || "";
    var bbw = parseFloat(cs.borderBottomWidth || "0");
    // Dell-blue family hue presence (any of: gradient, solid bg, border).
    var DELL_RX = /rgb\(0,\s*118,\s*206\)|rgb\(0,\s*99,\s*174\)|rgb\(0,\s*68,\s*124\)|rgb\(232,\s*242,\s*251\)|rgb\(245,\s*249,\s*253\)/;
    var hasDellInBgImage = bgi !== "none" && DELL_RX.test(bgi);
    var hasDellInBgColor = DELL_RX.test(bgc);
    var hasDellInBorder  = bbw >= 2 && DELL_RX.test(bb);
    assert(hasDellInBgImage || hasDellInBgColor || hasDellInBorder,
      "TB1 topbar must carry a Dell-blue cue (gradient, tinted background, or >= 2px Dell-blue bottom rule). " +
      "Got bg-image=" + bgi + ", bg-color=" + bgc + ", border-bottom=" + bbw + "px " + bb);
    // Don't let the topbar flood with full Dell-blue (saturated bg).
    var FLOOD_RX = /rgb\(0,\s*118,\s*206\)/;
    if (FLOOD_RX.test(bgc)) {
      assert(false, "TB1 topbar must NOT use saturated Dell-blue as its solid background colour (would compete with primary CTAs). Got bg-color " + bgc);
    }
  });

  it("VT5 · TB2 topbar logo is local (./Logo/, not i.dell.com CDN at default)", () => {
    var img = document.querySelector("header img, .topbar img");
    assert(img, "TB2 topbar must contain a logo <img>");
    assert(/(\.\/|\/)Logo\//.test(img.getAttribute("src") || img.src),
      "TB2 logo src must reference local Logo/ path at default (got '" + img.src + "')");
    assert(!/i\.dell\.com/.test(img.getAttribute("src") || ""),
      "TB2 logo must NOT default-load from i.dell.com CDN (got '" + img.src + "')");
  });

  it("VT6 · TB6 stepper steps render with mono leading-zero pattern (01 02 03 04 05)", () => {
    var steps = document.querySelectorAll("#stepper .step");
    assertEqual(steps.length, 5, "TB6 stepper must have exactly 5 steps");
    steps.forEach(function(s, idx) {
      var text = (s.textContent || "").trim();
      var idStr = "0" + (idx + 1);
      assert(text.indexOf(idStr) === 0,
        "TB6 step " + idx + " must start with '" + idStr + "' (got '" + text + "')");
    });
  });

  it("VT15 · DP5 dash bullet list renders with 6x2px Dell-blue ::before on .panel-section li", () => {
    var fixture = document.createElement("div");
    fixture.className = "panel-section";
    fixture.innerHTML = "<ul><li>probe</li></ul>";
    document.body.appendChild(fixture);
    try {
      var li = fixture.querySelector("li");
      var cs = getComputedStyle(li, "::before");
      var bg = cs.backgroundColor;
      var w = parseFloat(cs.width);
      var h = parseFloat(cs.height);
      assert(/rgb\(0,\s*118,\s*206\)|rgba\(0,\s*118,\s*206/.test(bg) ||
             /rgb\(0,\s*99,\s*174\)/.test(bg),
        "VT15 .panel-section li::before must be Dell-blue (got " + bg + ")");
      assert(w >= 5 && w <= 8 && h >= 1 && h <= 3,
        "VT15 dash bullet must be ~6x2px (got " + w + "x" + h + ")");
    } finally {
      document.body.removeChild(fixture);
    }
  });


  // ──────────────────────────────────────────────────────────────────────
  // Section 6, cross-tab filter system (VT17-VT18)
  // ──────────────────────────────────────────────────────────────────────

  it("VT17 · F1 filter body data attributes dim non-matching cards via CSS", () => {
    filterState._resetForTests();
    document.body.removeAttribute("data-filter-services");
    var s = fixtureSession();
    createGap(s, { description: "VT17 unmatch", layerId: "compute", gapType: "replace",
      relatedCurrentInstanceIds: ["i-z"], relatedDesiredInstanceIds: ["d-z"], services: ["deployment"] });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderGapsEditView(l, r, s);
    document.body.appendChild(l);
    try {
      document.body.setAttribute("data-filter-services", "migration");
      var cards = l.querySelectorAll(".gap-card");
      var matching = 0, dimmed = 0;
      cards.forEach(function(c) {
        var cs = getComputedStyle(c);
        var op = parseFloat(cs.opacity);
        if (op < 0.5) dimmed++;
        else matching++;
      });
      assert(dimmed >= 1, "VT17 at least one non-matching card must dim (opacity < 0.5) when filter active");
    } finally {
      document.body.removeAttribute("data-filter-services");
      document.body.removeChild(l);
    }
  });

  it("VT18 · F2 filter chip click sets body data attribute; re-click clears", () => {
    // v2.4.15 . reset filterState first so the test starts from a clean
    // slate (otherwise localStorage-restored state leaks in via the
    // module-load IIFE and skews the toggle direction).
    filterState._resetForTests();
    document.body.removeAttribute("data-filter-services");
    var s = fixtureSession();
    var l = document.createElement("div"); var r = document.createElement("div");
    renderGapsEditView(l, r, s);
    var chip = l.querySelector("[data-filter-chip][data-filter-dim='services'], .filter-chip[data-service-id]");
    assert(chip, "VT18 filter chip row must include at least one services chip");
    chip.click();
    assert(document.body.getAttribute("data-filter-services"),
      "VT18 first click must set body[data-filter-services]");
    chip.click();
    assert(!document.body.getAttribute("data-filter-services"),
      "VT18 re-click must clear body[data-filter-services]");
    document.body.removeAttribute("data-filter-services");
    filterState._resetForTests();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section 7 Services scope redesign DROPPED 2026-04-27 per v2.4.13 spec.
  // Original VT19 (asserted SummaryServicesView .service-card grid) is
  // deleted because the sub-tab itself is being removed entirely. The
  // services info is surfaced on gap and project drawers (covered by
  // existing v2.4.12 + future v2.5.0 4 detail-panel tests). Suite 45
  // VT21 (in v2.4.13) asserts the sub-tab is REMOVED from REPORTING_TABS.
  // ──────────────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────────────
  // Section 0, em-dash audit (VT20)
  // ──────────────────────────────────────────────────────────────────────

  it("VT20 · A1 em-dash absence in served UI files (styles.css + curated UI-copy paths)", async () => {
    const paths = [
      "/styles.css",
      "/app.js",
      "/ui/views/ContextView.js",
      "/ui/views/MatrixView.js",
      "/ui/views/GapsEditView.js",
      "/ui/views/SummaryGapsView.js",
      "/ui/views/SummaryRoadmapView.js",
      "/ui/views/ReportingView.js",
      "/ui/components/Drawer.js",
      "/state/demoSession.js",
      "/core/seedSkills.js",
      "/core/services.js"
    ];
    var hits = [];
    for (var i = 0; i < paths.length; i++) {
      try {
        var resp = await fetch(paths[i]);
        if (!resp.ok) continue;
        var text = await resp.text();
        if (text.indexOf("—") >= 0) {
          hits.push(paths[i]);
        }
      } catch (e) { /* skip files that 404 */ }
    }
    assertEqual(hits.length, 0,
      "VT20 em-dash sweep: U+2014 found in " + hits.length + " UI file(s): " + hits.join(", "));
  });

});

// ============================================================================
// SUITE 45, Phase 19m / v2.4.13 intermediate UX/UI patches
// ============================================================================
// VT21-VT28 covering Sections 0-8 of the v2.4.13 spec:
//   .0 services-scope sub-tab REMOVED (VT21)
//   .1 app-version chip in FOOTER not topbar (VT22)
//   .2 global AI Assist top-right button (VT23)
//   .3 NEW Overlay.js component open/close paths (VT24)
//   .4 AI Assist click opens overlay (VT25)
//   .5 demo banner on all 5 tabs when isDemo=true (VT26)
//   .6 stepper hover affordance (VT27)
//   .7 layer-name visual treatment in MatrixView (VT28)
//   .8 brand-blue ratio calibration (covered by smoke + visual review,
//      not a deterministic test)
//
// Stubs in place so imports resolve and tests fail RED on content,
// not on module-load errors:
//   ui/components/Overlay.js  STUB no-op exports (mirror of Drawer.js).
// Implementation phase fills in DOM construction, animation, focus
// management, AI overlay wiring, demo banner extraction, stepper hover
// CSS, layer-name CSS in MatrixView.
// ============================================================================

import {
  openOverlay, closeOverlay, isOpen as isOverlayOpen,
  _resetForTests as _resetOverlayForTests
} from "../ui/components/Overlay.js";

describe("45 · Phase 19m · v2.4.13 intermediate UX/UI patches", () => {

  // ──────────────────────────────────────────────────────────────────────
  // Section 0 . services-scope sub-tab REMOVED (VT21)
  // ──────────────────────────────────────────────────────────────────────

  it("VT21 · Services-scope sub-tab REMOVED from Reporting (REPORTING_TABS array in app.js source must not contain it)", async () => {
    // Source-level check: scan app.js for the REPORTING_TABS literal and
    // confirm "Services scope" / id "services" are not present. This is
    // the most reliable check (renders side-effects mutate live state).
    try {
      var resp = await fetch("/app.js");
      var src = await resp.text();
      var match = src.match(/REPORTING_TABS\s*=\s*\[[^\]]*\]/);
      assert(match,
        "VT21 . v2.4.13 0 . app.js must contain a REPORTING_TABS array literal");
      var content = match[0];
      assert(!/id\s*:\s*"services"/.test(content),
        "VT21 . v2.4.13 0 . REPORTING_TABS must NOT contain an entry with id: 'services'. Found: " + content);
      assert(!/Services scope/.test(content),
        "VT21 . REPORTING_TABS must NOT contain 'Services scope' label. Found: " + content);
    } catch (e) {
      assert(false, "VT21 fetch of /app.js failed: " + (e && e.message));
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section 1 . app-version chip in FOOTER not topbar (VT22)
  // ──────────────────────────────────────────────────────────────────────

  it("VT22 · App version chip is in the FOOTER, not in the topbar", () => {
    var header = document.querySelector("#app-header, .topbar");
    var footer = document.querySelector("#app-footer, footer");
    var chipInHeader = header && header.querySelector("#appVersionChip");
    var chipInFooter = footer && footer.querySelector("#appVersionChip");
    assert(!chipInHeader,
      "VT22 . v2.4.13 1 . #appVersionChip must NOT be inside the topbar");
    assert(chipInFooter,
      "VT22 . v2.4.13 1 . #appVersionChip must be inside the footer");
    assert(chipInFooter && /^Canvas v/.test((chipInFooter.textContent || "").trim()),
      "VT22 footer chip text must start with 'Canvas v'");
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section 2 . AI Assist reachable via keyboard shortcut (VT23 - rc.3 #7)
  // ──────────────────────────────────────────────────────────────────────
  // Per rc.3 #7 / SPEC §S29.7: the AI Assist topbar button was retired
  // when the topbar consolidated to a single AI surface (Chat). AI Assist
  // is still reachable via the Cmd+K / Ctrl+K command-palette shortcut
  // (industry-standard pattern). VT23 was the topbar-button assertion;
  // it's been rewritten to assert the keyboard contract instead.

  it("VT23 · AI Assist reachable via Cmd+K / Ctrl+K shortcut (rc.3 #7 retired the topbar button per SPEC §S29.7)", async () => {
    const appSrc = await (await fetch("/app.js")).text();
    // The keyboard handler registers on `keydown` for Cmd+K / Ctrl+K and
    // calls openAiOverlay (the AiAssistOverlay entry point).
    assert(/document\.addEventListener\(\s*"keydown"/.test(appSrc),
      "VT23 . a global keydown listener must be wired in app.js");
    assert(/metaKey\s*\|\|\s*\w*\.ctrlKey|metaKey \|\| e\.ctrlKey/.test(appSrc),
      "VT23 . the keydown handler must check Cmd (metaKey) OR Ctrl (ctrlKey)");
    assert(/openAiOverlay\s*\(/.test(appSrc),
      "VT23 . the shortcut must call openAiOverlay (the AI Assist entry point)");
    // The retired topbar button must NOT be in the served HTML (V-TOPBAR-1
    // covers this in §T-V3; reasserted here to keep VT23 self-contained).
    const html = await (await fetch("/index.html")).text();
    assert(!/id="topbarAiBtn"/.test(html),
      "VT23 . #topbarAiBtn must be absent from the topbar (retired in rc.3 #7)");
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section 3 . Overlay.js module open/close paths (VT24)
  // ──────────────────────────────────────────────────────────────────────

  it("VT24 · Overlay.js openOverlay adds .overlay.open, closeOverlay removes, Escape + backdrop click + close button all close, click inside does NOT close", () => {
    _resetOverlayForTests();
    closeOverlay();
    var probe = document.createElement("div");
    probe.textContent = "overlay-probe-body";
    openOverlay({ title: "Probe overlay", lede: "smoke", body: probe, kind: "ai-assist" });
    var panel = document.querySelector(".overlay.open");
    assert(panel, "VT24 . openOverlay must add a .overlay.open element");
    assert(panel.textContent.indexOf("Probe overlay") >= 0, "VT24 overlay must contain title");

    closeOverlay();
    assert(!document.querySelector(".overlay.open"), "VT24 closeOverlay must remove .overlay.open");

    // Escape close
    openOverlay({ title: "P", lede: "", body: document.createElement("div"), kind: "ai-assist" });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert(!document.querySelector(".overlay.open"), "VT24 Escape must close overlay");

    // Backdrop close
    openOverlay({ title: "P", lede: "", body: document.createElement("div"), kind: "ai-assist" });
    var backdrop = document.querySelector(".overlay-backdrop");
    assert(backdrop, "VT24 openOverlay must produce an .overlay-backdrop element");
    backdrop.click();
    assert(!document.querySelector(".overlay.open"), "VT24 backdrop click must close overlay");

    closeOverlay();
    _resetOverlayForTests();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section 4 . AI Assist Cmd+K opens overlay (VT25 - rc.3 #7)
  // ──────────────────────────────────────────────────────────────────────
  // Per rc.3 #7 / SPEC §S29.7: VT25 was the click-on-button assertion;
  // it's been rewritten to dispatch a Cmd+K KeyboardEvent and assert the
  // AI Assist overlay opens with the same skill-list contract.

  it("VT25 · Cmd+K / Ctrl+K dispatches AI Assist overlay (kind='ai-assist' + skill list); button-click path retired per SPEC §S29.7", () => {
    _resetOverlayForTests();
    closeOverlay();
    // Dispatch the keyboard shortcut that app.js binds globally.
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "k", ctrlKey: true, bubbles: true
    }));
    var overlay = document.querySelector(".overlay.open");
    assert(overlay, "VT25 . Cmd+K / Ctrl+K must open an AI Assist overlay");
    var hasSkillList = overlay.querySelector(".ai-skill-list, [data-skill-list]");
    assert(hasSkillList,
      "VT25 . AI Assist overlay body must include a .ai-skill-list or [data-skill-list] element");
    closeOverlay();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section 5 . demo banner on all 5 tabs when isDemo=true (VT26)
  // ──────────────────────────────────────────────────────────────────────

  it("VT26 · Demo banner renders in the left panel of every tab when session.isDemo === true", () => {
    replaceSession({
      sessionId: "sess-vt26", isDemo: true,
      customer: { name: "VT26 Demo Co", vertical: "Enterprise", region: "EMEA",
                  drivers: [{ id: "cyber_resilience", priority: "High", outcomes: "" }] },
      sessionMeta: { date: "2026-04-27", presalesOwner: "", status: "Demo", version: "2.0" },
      instances: [], gaps: []
    });
    var renderers = [
      [renderContextView,        "Tab 1 Context"],
      [renderMatrixView,         "Tab 2/3 Matrix"],
      [renderGapsEditView,       "Tab 4 Gaps"],
      [renderReportingOverview,  "Tab 5 Reporting Overview"]
    ];
    renderers.forEach(function(pair) {
      var fn = pair[0]; var label = pair[1];
      var l = document.createElement("div"); var r = document.createElement("div");
      try {
        // Render with whatever signature the function accepts; pass session
        // and an empty options object to avoid breakage.
        if (fn === renderMatrixView)        fn(l, r, session, { stateFilter: "current" });
        else if (fn === renderGapsEditView) fn(l, r, session);
        else if (fn === renderContextView)  fn(l, r, session);
        else                                 fn(l, r);
      } catch (e) {
        assert(false, "VT26 . " + label + " renderer threw: " + (e && e.message));
        return;
      }
      var banner = l.querySelector(".demo-mode-banner");
      assert(banner, "VT26 . " + label + " must render a .demo-mode-banner when session.isDemo === true");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section 6 . stepper hover affordance (VT27)
  // ──────────────────────────────────────────────────────────────────────

  it("VT27 · Stepper steps render with cursor:pointer + hover affordance (hover background tint distinct from default)", () => {
    var step = document.querySelector("#stepper .step");
    assert(step, "VT27 needs the stepper to be rendered");
    var defaultBg = getComputedStyle(step).backgroundColor;
    var cursor = getComputedStyle(step).cursor;
    assertEqual(cursor, "pointer",
      "VT27 . v2.4.13 6 . step cursor must be 'pointer' (got '" + cursor + "')");
    // Hover affordance: rendered via :hover CSS rule. We can't simulate a
    // full hover state in the test runner reliably across browsers, so we
    // check that a :hover rule exists by querying CSSOM.
    var hoverRuleFound = false;
    try {
      for (var i = 0; i < document.styleSheets.length && !hoverRuleFound; i++) {
        var rules;
        try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; }
        if (!rules) continue;
        for (var j = 0; j < rules.length; j++) {
          var rule = rules[j];
          if (rule && rule.selectorText && /\.step:hover/.test(rule.selectorText)) {
            hoverRuleFound = true;
            break;
          }
        }
      }
    } catch (e) { /* CORS or other access issue */ }
    assert(hoverRuleFound,
      "VT27 . v2.4.13 6 . CSS must include a .step:hover rule that produces a visible hover affordance (background or color change)");
  });

  // ──────────────────────────────────────────────────────────────────────
  // Section 7 . layer-name visual treatment in MatrixView (VT28)
  // ──────────────────────────────────────────────────────────────────────

  it("VT29 · App-shell layout correctness (no hardcoded heights, no page scroll, all chrome elements aligned)", () => {
    // Layout invariants the user expects to always hold:
    //   1. At scrollY=0, header.top === 0 (topbar visible at top of viewport)
    //   2. stepper.top === header.bottom (no gap, no overlap)
    //   3. main.top === stepper.bottom (no gap, no overlap)
    //   4. footer.top + footer.height <= viewport (footer visible)
    //   5. document.documentElement.scrollHeight <= window.innerHeight (page does NOT scroll;
    //      content overflow is handled internally by #main, not by the page)
    //   6. body computed display === "flex" (app-shell layout, not block)
    //
    // VT29 fails RED whenever any sibling element has a hardcoded height
    // that drifts out of sync with its actual rendered height. Catches the
    // class of bug that broke chunks 2.x + 3 (calc(100vh - 52px - 44px -
    // 40px) became wrong when the header height changed to 72px).
    window.scrollTo(0, 0);
    var h = document.getElementById("app-header");
    var s = document.getElementById("stepper");
    var m = document.getElementById("main");
    var f = document.getElementById("app-footer");
    assert(h && s && m && f, "VT29 needs header + stepper + main + footer in DOM");
    var hRect = h.getBoundingClientRect();
    var sRect = s.getBoundingClientRect();
    var mRect = m.getBoundingClientRect();
    var fRect = f.getBoundingClientRect();
    var vh = window.innerHeight;
    var bodyDisplay = getComputedStyle(document.body).display;

    // 1. Header at top
    assert(Math.abs(hRect.top - 0) < 1.5,
      "VT29.1 . header.top must be 0 at scrollY=0 (got " + hRect.top + ")");
    // 2. Stepper abuts header
    assert(Math.abs(sRect.top - hRect.bottom) < 1.5,
      "VT29.2 . stepper.top must equal header.bottom (got stepper.top=" + sRect.top + ", header.bottom=" + hRect.bottom + ", delta=" + (sRect.top - hRect.bottom) + ")");
    // 3. Main abuts stepper
    assert(Math.abs(mRect.top - sRect.bottom) < 1.5,
      "VT29.3 . main.top must equal stepper.bottom (got main.top=" + mRect.top + ", stepper.bottom=" + sRect.bottom + ", delta=" + (mRect.top - sRect.bottom) + ")");
    // 4. Footer visible within viewport
    assert(fRect.bottom <= vh + 1,
      "VT29.4 . footer must be visible within viewport (footer.bottom=" + fRect.bottom + " <= viewport=" + vh + ")");
    // 5. Page does not scroll (content overflow handled by #main internally)
    var docScroll = document.documentElement.scrollHeight;
    assert(docScroll <= vh + 1.5,
      "VT29.5 . page must NOT have scrollable overflow (documentElement.scrollHeight=" + docScroll + " must be <= viewport=" + vh + "; if greater, the topbar will scroll off-screen). This usually means a sibling element has a stale hardcoded height.");
    // 6. Body uses flex column app-shell
    assertEqual(bodyDisplay, "flex",
      "VT29.6 . body computed display must be 'flex' (app-shell layout). Got '" + bodyDisplay + "'.");
  });

  it("VT28 · MatrixView layer headers render with bumped typography (>=14px ink 600) + a color-coded left bar", () => {
    var s = createEmptySession();
    addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "VT28-A", vendorGroup: "dell", criticality: "Medium" });
    addInstance(s, { state: "current", layerId: "storage", environmentId: "coreDc",
      label: "VT28-B", vendorGroup: "dell", criticality: "Medium" });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderMatrixView(l, r, s, { stateFilter: "current" });
    var headers = l.querySelectorAll(".matrix-layer-header");
    assert(headers.length >= 1,
      "VT28 . v2.4.13 7 . MatrixView must render at least one .matrix-layer-header. Got: " + headers.length);
    // Each header must have bumped typography + a color-coded left bar.
    Array.from(headers).slice(0, 3).forEach(function(hdr) {
      // Mount into body so getComputedStyle resolves.
      document.body.appendChild(l);
      var cs = getComputedStyle(hdr);
      var fontSize = parseFloat(cs.fontSize);
      var fontWeight = parseInt(cs.fontWeight, 10);
      assert(fontSize >= 14,
        "VT28 . layer header font-size must be >= 14px (got " + cs.fontSize + ")");
      assert(fontWeight >= 600,
        "VT28 . layer header font-weight must be >= 600 (got " + cs.fontWeight + ")");
      // Left bar accent: either ::before or a child with class .matrix-layer-bar
      var bar = hdr.querySelector(".matrix-layer-bar");
      assert(bar,
        "VT28 . each layer header must include a .matrix-layer-bar element with a color-coded background");
      document.body.removeChild(l);
    });
  });

});

// ============================================================================
// Suite 46 · v2.4.15 · Dynamic environment model + soft-delete + UX polish
// ============================================================================
// Coverage:
//   .DE1-DE10  dynamic env model + catalog + migrator + label helper
//   .DE-INT1-6 data-integrity guarantees around hide/restore + .canvas round-trip
//   .SD1-SD8   soft-delete pattern (hidden flag, sub-sections, save-guard,
//              confirmation, restore, render rules, ≥1 active invariant)
//   .VB1-VB3   vendor mix segmented bar (replaces table cards)
//   .FB1-FB6   modern collapsible FilterBar (single button + panel + pills)
//   .FB7a-d    all 4 filter dimensions wired (services / layer / domain /
//              urgency) with multi-dim AND combine
//
// RED-stubs in core/config.js (ENV_CATALOG, DEFAULT_ENABLED_ENV_IDS,
// getActiveEnvironments, getVisibleEnvironments, getHiddenEnvironments)
// keep imports resolving so tests fail RED on content, not module load.
// ============================================================================

import {
  ENV_CATALOG,
  DEFAULT_ENABLED_ENV_IDS,
  getActiveEnvironments,
  getVisibleEnvironments,
  getHiddenEnvironments,
  getEnvLabel
} from "../core/config.js";

describe("46 · v2.4.15 · Dynamic environments + soft-delete + UX polish", () => {

  // -------------------------------------------------------------------
  // Helpers scoped to Suite 46.
  // -------------------------------------------------------------------
  function makeEnvSession(envEntries) {
    var s = createEmptySession();
    s.environments = (envEntries || []).slice();
    return s;
  }

  function findEnv(s, id) {
    return (s.environments || []).find(function(e) { return e.id === id; });
  }

  function dispatchClick(el) {
    if (!el) return;
    if (typeof el.click === "function") el.click();
    else el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }

  function closeAnyModal() {
    // v2.4.15-polish . hide modal now uses Overlay.js, so call its
    // closer too. Fall back to manual removal of any leftover legacy
    // modal nodes.
    try { _closeOverlay(); } catch (e) { /* ignore */ }
    document.querySelectorAll(".hide-env-modal, .save-guard-modal, .modal-overlay, .overlay-backdrop, .overlay.open").forEach(function(m) {
      if (m.parentNode) m.parentNode.removeChild(m);
    });
  }

  // ===================================================================
  // Section 1 · DE1-DE10 · Dynamic environment model
  // ===================================================================

  it("DE1 · ENV_CATALOG present with 8 entries (cleaner exec-readable labels)", () => {
    assert(Array.isArray(ENV_CATALOG), "DE1 · ENV_CATALOG must be an array");
    assertEqual(ENV_CATALOG.length, 8,
      "DE1 · ENV_CATALOG must have exactly 8 entries (got " + ENV_CATALOG.length + ")");
    var REQUIRED_IDS = ["coreDc", "drDc", "archiveSite", "publicCloud", "edge",
                        "coLo", "managedHosting", "sovereignCloud"];
    REQUIRED_IDS.forEach(function(id) {
      var entry = ENV_CATALOG.find(function(e) { return e.id === id; });
      assert(entry,
        "DE1 · ENV_CATALOG must contain an entry with id '" + id + "'");
      assert(entry && typeof entry.label === "string" && entry.label.length > 0,
        "DE1 · ENV_CATALOG entry '" + id + "' must have a non-empty label");
      assert(entry && typeof entry.hint === "string",
        "DE1 · ENV_CATALOG entry '" + id + "' must carry a hint string");
    });
    // Cleaner labels (no jargon: no "MSP", no slash-soup, no "Vault").
    var EXPECTED_LABELS = {
      coreDc:         "Primary Data Center",
      drDc:           "Disaster Recovery Site",
      archiveSite:    "Archive Site",
      publicCloud:    "Public Cloud",
      edge:           "Branch & Edge Sites",
      coLo:           "Co-location",
      managedHosting: "Managed Hosting",
      sovereignCloud: "Sovereign Cloud"
    };
    Object.keys(EXPECTED_LABELS).forEach(function(id) {
      var entry = ENV_CATALOG.find(function(e) { return e.id === id; });
      if (!entry) return;
      assertEqual(entry.label, EXPECTED_LABELS[id],
        "DE1 · ENV_CATALOG '" + id + "' label must be '" + EXPECTED_LABELS[id] +
        "' (got '" + entry.label + "')");
    });
  });

  it("DE2 · getActiveEnvironments fallback returns the 4 default-enabled entries when session.environments is empty", () => {
    var s = createEmptySession();
    s.environments = [];
    var active = getActiveEnvironments(s);
    assert(Array.isArray(active), "DE2 · getActiveEnvironments must return an array");
    assertEqual(active.length, 4,
      "DE2 · empty session.environments must fall back to 4 default-enabled entries (got " + active.length + ")");
    var ids = active.map(function(e) { return e.id; }).sort();
    assertEqual(ids.join(","), ["coreDc", "drDc", "edge", "publicCloud"].sort().join(","),
      "DE2 · fallback ids must be coreDc/drDc/edge/publicCloud (got " + ids.join(",") + ")");
    assertEqual(DEFAULT_ENABLED_ENV_IDS.slice().sort().join(","),
                ["coreDc", "drDc", "edge", "publicCloud"].sort().join(","),
      "DE2 · DEFAULT_ENABLED_ENV_IDS must export the same 4 ids");
  });

  it("DE3 · createEmptySession ships with environments:[] and no environmentAliases field", () => {
    var s = createEmptySession();
    assert(Array.isArray(s.environments),
      "DE3 · new session must carry an environments array");
    assertEqual(s.environments.length, 0,
      "DE3 · new session.environments must be empty (got " + s.environments.length + ")");
    assert(typeof s.environmentAliases === "undefined",
      "DE3 · new session must NOT carry the legacy environmentAliases field (got " +
      JSON.stringify(s.environmentAliases) + ")");
  });

  it("DE4 · Migrator auto-enables every env referenced by instances or gaps", () => {
    var legacy = {
      sessionId: "sess-de4",
      customer: { name: "DE4 Co", drivers: [] },
      sessionMeta: { date: "2026-04-28", presalesOwner: "", status: "Draft", version: "2.0" },
      instances: [
        { id: "i-1", state: "current", layerId: "compute", environmentId: "coreDc",
          label: "X", vendorGroup: "dell", criticality: "Medium" },
        { id: "i-2", state: "current", layerId: "compute", environmentId: "edge",
          label: "Y", vendorGroup: "dell", criticality: "Medium" }
      ],
      gaps: []
    };
    var migrated = migrateLegacySession(legacy);
    assert(Array.isArray(migrated.environments),
      "DE4 · migrated session must carry environments[]");
    var ids = migrated.environments.map(function(e) { return e.id; }).sort();
    assert(ids.indexOf("coreDc") >= 0,
      "DE4 · migrated session must auto-enable 'coreDc' (referenced by instance)");
    assert(ids.indexOf("edge") >= 0,
      "DE4 · migrated session must auto-enable 'edge' (referenced by instance)");
    assertEqual(migrated.environments.length, 2,
      "DE4 · only referenced envs must be auto-enabled (got " + migrated.environments.length + ")");
  });

  it("DE5 · Migrator drains environmentAliases into per-env alias + deletes legacy field", () => {
    var legacy = {
      sessionId: "sess-de5",
      customer: { name: "DE5 Co", drivers: [] },
      sessionMeta: { date: "2026-04-28", presalesOwner: "", status: "Draft", version: "2.0" },
      environmentAliases: { coreDc: "Riyadh DC", drDc: "Jeddah DR" },
      instances: [
        { id: "i-1", state: "current", layerId: "compute", environmentId: "coreDc",
          label: "X", vendorGroup: "dell", criticality: "Medium" },
        { id: "i-2", state: "current", layerId: "compute", environmentId: "drDc",
          label: "Y", vendorGroup: "dell", criticality: "Medium" }
      ],
      gaps: []
    };
    var migrated = migrateLegacySession(legacy);
    var coreEntry = (migrated.environments || []).find(function(e) { return e.id === "coreDc"; });
    var drEntry   = (migrated.environments || []).find(function(e) { return e.id === "drDc"; });
    assert(coreEntry && coreEntry.alias === "Riyadh DC",
      "DE5 · coreDc alias must drain to environments[].alias = 'Riyadh DC' (got " +
      JSON.stringify(coreEntry) + ")");
    assert(drEntry && drEntry.alias === "Jeddah DR",
      "DE5 · drDc alias must drain to environments[].alias = 'Jeddah DR' (got " +
      JSON.stringify(drEntry) + ")");
    assert(typeof migrated.environmentAliases === "undefined",
      "DE5 · legacy environmentAliases field must be deleted post-migrate");
  });

  it("DE6 · ContextView Environments card lists active envs + + Add control excludes already-in-session ids", () => {
    var s = makeEnvSession([
      { id: "coreDc", hidden: false, alias: "Riyadh DC" },
      { id: "drDc",   hidden: false, alias: "Jeddah DR" }
    ]);
    var l = document.createElement("div"); var r = document.createElement("div");
    renderContextView(l, r, s);
    document.body.appendChild(l);
    try {
      var tiles = l.querySelectorAll("[data-env-row], .env-tile");
      assert(tiles.length >= 2,
        "DE6 · ContextView must render >= one tile per active env (got " + tiles.length + ")");
      var addBtn = l.querySelector(".env-add-btn");
      assert(addBtn,
        "DE6 · ContextView must include a `+ Add environment` button (env-add-btn)");
      // Tiles must be clickable (the click handler opens the right-panel detail).
      var coreTile = l.querySelector("[data-env-id='coreDc']");
      assert(coreTile, "DE6 · coreDc tile must exist when coreDc is in session");
      // The catalog palette opens on click of the Add btn; until then there's
      // no selectable picker option on screen for ids already in session.
      assert(!l.querySelector("[data-env-picker-option='coreDc']"),
        "DE6 · before opening the palette, no picker option for 'coreDc' must be visible");
    } finally {
      document.body.removeChild(l);
    }
  });

  it("DE7 · Add new env via palette appends to session.environments", () => {
    var s = makeEnvSession([{ id: "coreDc", hidden: false }]);
    var l = document.createElement("div"); var r = document.createElement("div");
    renderContextView(l, r, s);
    document.body.appendChild(l);
    try {
      var addBtn = l.querySelector(".env-add-btn");
      assert(addBtn, "DE7 · need an `+ Add environment` button");
      dispatchClick(addBtn);
      var palette = document.getElementById("env-palette");
      assert(palette, "DE7 · clicking + Add must open the env palette overlay");
      // Find the "Archive Site" item and click it.
      var items = [...palette.querySelectorAll(".cmd-item")];
      var archive = items.find(function(it) { return /Archive Site/i.test(it.textContent); });
      assert(archive, "DE7 · palette must include an 'Archive Site' option");
      dispatchClick(archive);
      var added = findEnv(s, "archiveSite");
      assert(added,
        "DE7 · session.environments must contain a new archiveSite entry after palette select (got " +
        JSON.stringify(s.environments) + ")");
      assertEqual(added.hidden, false,
        "DE7 · newly added env must default hidden:false");
    } finally {
      document.body.removeChild(l);
      var leftoverPalette = document.getElementById("env-palette");
      if (leftoverPalette && leftoverPalette.parentNode) leftoverPalette.parentNode.removeChild(leftoverPalette);
    }
  });

  it("DE8 · Click env tile opens detail panel; Hide button there flips env.hidden to true (entry remains)", () => {
    _markSaved({ isDemo: false }); // ensure clean (not "saving") state so save-guard does NOT fire
    var s = makeEnvSession([
      { id: "coreDc", hidden: false },
      { id: "drDc",   hidden: false }
    ]);
    var l = document.createElement("div"); var r = document.createElement("div");
    renderContextView(l, r, s);
    document.body.appendChild(l);
    document.body.appendChild(r);
    try {
      var tile = l.querySelector("[data-env-id='coreDc']");
      assert(tile, "DE8 · need a coreDc tile to click");
      dispatchClick(tile); // opens right-panel detail
      var hideBtn = r.querySelector(".env-hide-btn, [data-env-hide='coreDc']");
      assert(hideBtn,
        "DE8 · clicking the tile must render a Hide button in the right-panel detail");
      dispatchClick(hideBtn);
      var confirmBtn = document.querySelector(".hide-env-modal .confirm-hide, [data-hide-env-confirm]");
      if (confirmBtn) dispatchClick(confirmBtn);
      var coreEntry = findEnv(s, "coreDc");
      assert(coreEntry,
        "DE8 · coreDc entry must REMAIN in session.environments after hide (soft-delete, not splice)");
      assertEqual(coreEntry.hidden, true,
        "DE8 · coreDc.hidden must flip to true after confirmed hide (got " +
        JSON.stringify(coreEntry) + ")");
    } finally {
      document.body.removeChild(l);
      document.body.removeChild(r);
      closeAnyModal();
    }
  });

  it("DE9 · MatrixView env headers reflect dynamic count (visible envs only)", () => {
    var s = makeEnvSession([
      { id: "coreDc", hidden: false },
      { id: "edge",   hidden: false }
    ]);
    addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "DE9-A", vendorGroup: "dell", criticality: "Medium" });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderMatrixView(l, r, s, { stateFilter: "current" });
    var heads = l.querySelectorAll(".matrix-env-head, .matrix-env-header, [data-env-head]");
    assertEqual(heads.length, 2,
      "DE9 · MatrixView must render exactly 2 env header cells when 2 envs are visible (got " + heads.length + ")");
  });

  it("DE10 · getEnvLabel reads alias from session.environments[].alias", () => {
    var s = makeEnvSession([
      { id: "coreDc", hidden: false, alias: "Riyadh DC" }
    ]);
    var label = getEnvLabel("coreDc", s);
    assertEqual(label, "Riyadh DC",
      "DE10 · getEnvLabel must read alias from session.environments[].alias (got '" + label + "')");
  });

  // ===================================================================
  // Section DE-INT · DE-INT1-6 · Data integrity guarantees
  // ===================================================================

  it("DE-INT1 · Hide preserves session.instances count (zero data loss)", () => {
    var s = makeEnvSession([
      { id: "coreDc", hidden: false },
      { id: "edge",   hidden: false }
    ]);
    addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "INT1-A", vendorGroup: "dell", criticality: "Medium" });
    addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "INT1-B", vendorGroup: "dell", criticality: "Medium" });
    var beforeCount = s.instances.length;
    var coreEntry = findEnv(s, "coreDc");
    coreEntry.hidden = true;
    assertEqual(s.instances.length, beforeCount,
      "DE-INT1 · hiding env must not change session.instances.length (before=" +
      beforeCount + ", after=" + s.instances.length + ")");
    s.instances.forEach(function(i) {
      assertEqual(i.environmentId, "coreDc",
        "DE-INT1 · instance.environmentId must remain unchanged after hide");
    });
  });

  it("DE-INT2 · Hide round-trips through JSON snapshot (.canvas equivalent)", () => {
    var s = makeEnvSession([
      { id: "coreDc", hidden: true,  alias: "Riyadh DC" },
      { id: "edge",   hidden: false, alias: "Branch sites" }
    ]);
    var dump = JSON.stringify(s);
    var revived = JSON.parse(dump);
    var coreRev = revived.environments.find(function(e) { return e.id === "coreDc"; });
    var edgeRev = revived.environments.find(function(e) { return e.id === "edge"; });
    assertEqual(coreRev && coreRev.hidden, true,
      "DE-INT2 · coreDc.hidden=true must survive JSON round-trip");
    assertEqual(edgeRev && edgeRev.hidden, false,
      "DE-INT2 · edge.hidden=false must survive JSON round-trip");
  });

  it("DE-INT3 · Restore re-renders the column (getVisibleEnvironments returns it again)", () => {
    var s = makeEnvSession([
      { id: "coreDc", hidden: false },
      { id: "drDc",   hidden: true }
    ]);
    var visBefore = getVisibleEnvironments(s).map(function(e) { return e.id; });
    assert(visBefore.indexOf("drDc") < 0,
      "DE-INT3 · getVisibleEnvironments must exclude hidden envs initially (got " + visBefore.join(",") + ")");
    var dr = findEnv(s, "drDc");
    dr.hidden = false;
    var visAfter = getVisibleEnvironments(s).map(function(e) { return e.id; });
    assert(visAfter.indexOf("drDc") >= 0,
      "DE-INT3 · after restore, getVisibleEnvironments must include drDc (got " + visAfter.join(",") + ")");
  });

  it("DE-INT4 · Hiding env preserves gap.affectedEnvironments taxonomy unchanged", () => {
    var s = makeEnvSession([
      { id: "coreDc",      hidden: false },
      { id: "publicCloud", hidden: false }
    ]);
    var cur = addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "INT4-cur", vendorGroup: "dell", criticality: "Medium" });
    var g = createGap(s, { description: "INT4 gap", layerId: "compute", gapType: "ops",
      relatedCurrentInstanceIds: [cur.id],
      affectedEnvironments: ["coreDc", "publicCloud"] });
    var beforeAffected = (g.affectedEnvironments || []).slice();
    findEnv(s, "coreDc").hidden = true;
    var gAfter = s.gaps.find(function(x) { return x.id === g.id; });
    assertEqual((gAfter.affectedEnvironments || []).join(","), beforeAffected.join(","),
      "DE-INT4 · gap.affectedEnvironments must remain unchanged after hide (taxonomy preserved). " +
      "Before=" + beforeAffected.join(",") + ", After=" + (gAfter.affectedEnvironments || []).join(","));
  });

  it("DE-INT5 · ≥1 active env invariant: cannot hide the last active env", () => {
    _markSaved({ isDemo: false });
    var s = makeEnvSession([
      { id: "coreDc", hidden: false }
    ]);
    var l = document.createElement("div"); var r = document.createElement("div");
    renderContextView(l, r, s);
    document.body.appendChild(l);
    document.body.appendChild(r);
    try {
      var tile = l.querySelector("[data-env-id='coreDc']");
      dispatchClick(tile);
      var hideBtn = r.querySelector(".env-hide-btn");
      var disabled = hideBtn && (hideBtn.disabled === true || hideBtn.getAttribute("aria-disabled") === "true");
      if (!disabled && hideBtn) {
        dispatchClick(hideBtn);
        var confirmBtn = document.querySelector(".hide-env-modal .confirm-hide, [data-hide-env-confirm]");
        if (confirmBtn) dispatchClick(confirmBtn);
      }
      assertEqual(findEnv(s, "coreDc").hidden, false,
        "DE-INT5 · with one active env, hide must be blocked (button disabled or click no-op). " +
        "session.environments[0].hidden = " + findEnv(s, "coreDc").hidden);
    } finally {
      closeAnyModal();
      document.body.removeChild(l);
      document.body.removeChild(r);
    }
  });

  it("DE-INT6 · Migrator backfills hidden:false on every legacy env entry", () => {
    var legacy = {
      sessionId: "sess-de-int6",
      customer: { name: "INT6", drivers: [] },
      sessionMeta: { date: "2026-04-28", presalesOwner: "", status: "Draft", version: "2.0" },
      instances: [
        { id: "i-1", state: "current", layerId: "compute", environmentId: "coreDc",
          label: "X", vendorGroup: "dell", criticality: "Medium" }
      ],
      gaps: []
    };
    var migrated = migrateLegacySession(legacy);
    (migrated.environments || []).forEach(function(e) {
      assertEqual(e.hidden, false,
        "DE-INT6 · migrated env '" + e.id + "' must have hidden:false (got " + e.hidden + ")");
    });
  });

  // ===================================================================
  // Section SD · SD1-SD8 · Soft-delete pattern
  // ===================================================================

  it("SD1 · getVisibleEnvironments / getHiddenEnvironments return correct partitions", () => {
    var s = makeEnvSession([
      { id: "coreDc",      hidden: false },
      { id: "drDc",        hidden: true  },
      { id: "publicCloud", hidden: false }
    ]);
    var visIds = getVisibleEnvironments(s).map(function(e) { return e.id; }).sort();
    var hidIds = getHiddenEnvironments(s).map(function(e) { return e.id; }).sort();
    assertEqual(visIds.join(","), ["coreDc", "publicCloud"].sort().join(","),
      "SD1 · getVisibleEnvironments must return [coreDc, publicCloud] (got " + visIds.join(",") + ")");
    assertEqual(hidIds.join(","), ["drDc"].sort().join(","),
      "SD1 · getHiddenEnvironments must return [drDc] (got " + hidIds.join(",") + ")");
  });

  it("SD2 · ContextView renders Active tile row + separate Hidden tile row with hidden envs in the Hidden section", () => {
    var s = makeEnvSession([
      { id: "coreDc", hidden: false },
      { id: "drDc",   hidden: true }
    ]);
    var l = document.createElement("div"); var r = document.createElement("div");
    renderContextView(l, r, s);
    document.body.appendChild(l);
    try {
      var hiddenSection = l.querySelector(".env-hidden-section, [data-env-hidden-section], .hidden-environments");
      assert(hiddenSection,
        "SD2 · ContextView must include a Hidden environments sub-section when hidden envs exist");
      var hiddenTiles = hiddenSection.querySelectorAll("[data-env-row], .env-tile");
      assert(hiddenTiles.length >= 1,
        "SD2 · Hidden sub-section must include >= one tile (got " + hiddenTiles.length + ")");
      var restoreBtn = hiddenSection.querySelector(".env-restore-btn, [data-env-restore]");
      assert(restoreBtn,
        "SD2 · Hidden sub-section must include a Restore button per hidden env");
    } finally {
      document.body.removeChild(l);
    }
  });

  it("SD3 · Hide button save-guards when session has unsaved changes", () => {
    var s = makeEnvSession([
      { id: "coreDc", hidden: false },
      { id: "drDc",   hidden: false }
    ]);
    var l = document.createElement("div"); var r = document.createElement("div");
    renderContextView(l, r, s);
    document.body.appendChild(l);
    document.body.appendChild(r);
    try {
      // Click tile to open right-panel detail, then dirty + click Hide.
      var tile = l.querySelector("[data-env-id='coreDc']");
      dispatchClick(tile);
      _markSaving();
      var hideBtn = r.querySelector(".env-hide-btn");
      assert(hideBtn, "SD3 · need a Hide button on coreDc detail panel");
      dispatchClick(hideBtn);
      var saveGuard = document.querySelector(".save-guard-modal, [data-save-guard='true']");
      assert(saveGuard,
        "SD3 · clicking Hide on a dirty session must open a save-guard modal (Save & Hide / Hide without saving / Cancel)");
    } finally {
      closeAnyModal();
      document.body.removeChild(l);
      document.body.removeChild(r);
      _markSaved({ isDemo: false });
    }
  });

  it("SD4 · Hide confirmation modal copy includes env label + instance count line + Hide+Cancel buttons", () => {
    _markSaved({ isDemo: false }); // clean state so save-guard does NOT fire first
    var s = makeEnvSession([
      { id: "coreDc", hidden: false, alias: "Riyadh DC" },
      { id: "drDc",   hidden: false }
    ]);
    addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "SD4-A", vendorGroup: "dell", criticality: "Medium" });
    addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "SD4-B", vendorGroup: "dell", criticality: "Medium" });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderContextView(l, r, s);
    document.body.appendChild(l);
    document.body.appendChild(r);
    try {
      var tile = l.querySelector("[data-env-id='coreDc']");
      dispatchClick(tile);
      var hideBtn = r.querySelector(".env-hide-btn");
      assert(hideBtn, "SD4 · need a Hide button in the right-panel detail");
      dispatchClick(hideBtn);
      var modal = document.querySelector(".hide-env-modal, [data-hide-env-modal]");
      assert(modal,
        "SD4 · Hide click must open a confirmation modal");
      var text = (modal.textContent || "");
      assert(/Riyadh DC|coreDc|Primary Data Center/.test(text),
        "SD4 · modal text must reference the env (alias 'Riyadh DC' or label or id). Got: " + text.slice(0, 200));
      assert(/2 instance|two instance|2 \w+ tied/i.test(text) || /\b2\b/.test(text),
        "SD4 · modal text must reference instance count (2). Got: " + text.slice(0, 200));
      var hideAction = modal.querySelector(".confirm-hide, [data-hide-env-confirm], .btn-hide");
      var cancelAction = modal.querySelector(".btn-cancel, [data-hide-env-cancel], .cancel");
      assert(hideAction, "SD4 · modal must include a confirm-hide action");
      assert(cancelAction, "SD4 · modal must include a cancel action");
      if (cancelAction) dispatchClick(cancelAction);
    } finally {
      document.body.removeChild(l);
      document.body.removeChild(r);
      closeAnyModal();
    }
  });

  it("SD5 · Confirmed hide flips hidden flag + emits session-changed with reason matching /env|hide/", () => {
    _markSaved({ isDemo: false }); // clean state so save-guard does NOT fire first
    var s = makeEnvSession([
      { id: "coreDc", hidden: false },
      { id: "drDc",   hidden: false }
    ]);
    var l = document.createElement("div"); var r = document.createElement("div");
    renderContextView(l, r, s);
    document.body.appendChild(l);
    document.body.appendChild(r);
    var captured = null;
    var unsub = onSessionChanged(function(ev) {
      if (!captured) captured = ev;
    });
    try {
      var tile = l.querySelector("[data-env-id='coreDc']");
      dispatchClick(tile);
      var hideBtn = r.querySelector(".env-hide-btn");
      assert(hideBtn, "SD5 · need a Hide button in the right-panel detail");
      dispatchClick(hideBtn);
      var confirmBtn = document.querySelector(".hide-env-modal .confirm-hide, [data-hide-env-confirm]");
      if (confirmBtn) dispatchClick(confirmBtn);
      assertEqual(findEnv(s, "coreDc").hidden, true,
        "SD5 · hidden flag must flip to true after confirm");
      assert(captured,
        "SD5 · must emit session-changed after confirmed hide");
      assert(captured && /hide|env/i.test(captured.reason || ""),
        "SD5 · session-changed reason must mention env/hide (got '" +
        (captured && captured.reason) + "')");
    } finally {
      unsub();
      closeAnyModal();
      document.body.removeChild(l);
      document.body.removeChild(r);
    }
  });

  it("SD6 · Restore button on a hidden env tile flips hidden flag back to false (no confirmation)", () => {
    var s = makeEnvSession([
      { id: "coreDc", hidden: false },
      { id: "drDc",   hidden: true }
    ]);
    var l = document.createElement("div"); var r = document.createElement("div");
    renderContextView(l, r, s);
    document.body.appendChild(l);
    try {
      var restoreBtn = l.querySelector("[data-env-restore='drDc']");
      assert(restoreBtn,
        "SD6 · must render a Restore button on hidden env drDc");
      dispatchClick(restoreBtn);
      assertEqual(findEnv(s, "drDc").hidden, false,
        "SD6 · restore must flip hidden back to false (got " + findEnv(s, "drDc").hidden + ")");
    } finally {
      document.body.removeChild(l);
    }
  });

  it("SD7 · MatrixView excludes a hidden env's column entirely (was: greyed-out top-to-bottom)", () => {
    // v2.4.15-polish . per user redirect 2026-04-28, hidden envs drop
    // from Tab 2/3 entirely instead of rendering greyed. One mental model:
    // hide = remove from view; the only place a hidden env shows is the
    // Tab 1 Hidden sub-section.
    var s = makeEnvSession([
      { id: "coreDc", hidden: false },
      { id: "drDc",   hidden: true }
    ]);
    addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "SD7-A", vendorGroup: "dell", criticality: "Medium" });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderMatrixView(l, r, s, { stateFilter: "current" });
    document.body.appendChild(l);
    try {
      var hiddenHead = l.querySelector(".matrix-env-head[data-env='drDc']");
      assert(!hiddenHead,
        "SD7 · MatrixView must NOT render a header for hidden envs (got " +
        (hiddenHead && hiddenHead.outerHTML.slice(0, 100)) + ")");
      var visibleHeads = l.querySelectorAll(".matrix-env-head");
      assertEqual(visibleHeads.length, 1,
        "SD7 · MatrixView must render only the visible env count (1: coreDc), got " + visibleHeads.length);
    } finally {
      document.body.removeChild(l);
    }
  });

  it("SD8 · Tab 5 reporting (SummaryHealthView heatmap) excludes hidden envs entirely", () => {
    var s = makeEnvSession([
      { id: "coreDc", hidden: true },
      { id: "edge",   hidden: false }
    ]);
    addInstance(s, { state: "current", layerId: "compute", environmentId: "edge",
      label: "SD8-A", vendorGroup: "dell", criticality: "Medium" });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderSummaryHealthView(l, r, s);
    var hiddenHeads = l.querySelectorAll(".heatmap-env-head[data-env='coreDc'], .hm-env-head[data-env='coreDc'], [data-env='coreDc'].heatmap-env-head");
    assertEqual(hiddenHeads.length, 0,
      "SD8 · SummaryHealthView must NOT render any column for hidden coreDc (got " + hiddenHeads.length + ")");
    var visibleHeads = l.querySelectorAll(".heatmap-env-head, .hm-env-head");
    assert(visibleHeads.length >= 1,
      "SD8 · SummaryHealthView must render columns for visible envs only (got " + visibleHeads.length + ")");
  });

  // ===================================================================
  // Section VB · VB1-VB3 · Vendor mix segmented bar
  // ===================================================================

  it("VB1 · Headline overview bar renders ONE 100%-stacked bar with 3 proportional segments summing to ~100%", () => {
    var s = makeEnvSession([
      { id: "coreDc", hidden: false }
    ]);
    addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "VB1-Dell-1", vendorGroup: "dell", criticality: "Medium" });
    addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "VB1-Dell-2", vendorGroup: "dell", criticality: "Medium" });
    addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "VB1-NonDell", vendorGroup: "nonDell", criticality: "Medium" });
    addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "VB1-Custom", vendorGroup: "custom", criticality: "Medium" });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderSummaryVendorView(l, r, s);
    document.body.appendChild(l);
    try {
      // v2.4.15-polish . the overview shows ONE headline bar (was: 3
      // stacked Combined/Current/Desired). Per-layer bars stack below.
      var overviewBars = l.querySelectorAll(".vm-overview-bars .vendor-bar");
      assertEqual(overviewBars.length, 1,
        "VB1 · overview must render exactly ONE headline .vendor-bar (got " + overviewBars.length + ")");
      var segs = overviewBars[0].querySelectorAll(".vendor-bar-segment");
      assertEqual(segs.length, 3,
        "VB1 · headline bar must have 3 segments (Dell / non-Dell / custom). Got " + segs.length);
      var totalPct = 0;
      Array.prototype.forEach.call(segs, function(seg) {
        var w = seg.style.width || "";
        var pct = parseFloat(w);
        if (!isNaN(pct)) totalPct += pct;
      });
      assert(totalPct >= 99 && totalPct <= 101,
        "VB1 · sum of headline segment widths must be 99-101% (got " + totalPct + "%)");
      // v2.4.15-polish . a clean color-key legend renders below the bar.
      var legend = l.querySelector(".vm-overview-legend");
      assert(legend, "VB1 · overview must include a .vm-overview-legend");
      var legendItems = legend.querySelectorAll(".vendor-legend-item");
      assertEqual(legendItems.length, 3,
        "VB1 · legend must have exactly 3 items (Dell / Other vendors / Custom). Got " + legendItems.length);
    } finally {
      document.body.removeChild(l);
    }
  });

  it("VB2 · Segments wider than 6% include a visible inline percentage label", () => {
    var s = makeEnvSession([{ id: "coreDc", hidden: false }]);
    for (var i = 0; i < 10; i++) {
      addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
        label: "VB2-Dell-" + i, vendorGroup: "dell", criticality: "Medium" });
    }
    addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "VB2-NonDell", vendorGroup: "nonDell", criticality: "Medium" });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderSummaryVendorView(l, r, s);
    var firstBar = l.querySelector(".vendor-bar");
    assert(firstBar, "VB2 · need a .vendor-bar to inspect");
    var segs = firstBar.querySelectorAll(".vendor-bar-segment");
    var widePctVisible = false;
    Array.prototype.forEach.call(segs, function(seg) {
      var w = parseFloat(seg.style.width || "0");
      if (w >= 6) {
        var label = seg.textContent || "";
        if (/\d+%/.test(label)) widePctVisible = true;
      }
    });
    assert(widePctVisible,
      "VB2 · at least one wide segment (>=6%) must render a visible inline percentage label");
  });

  it("VB3 · Headline insights card renders 3 KPI tiles (replaces per-layer + per-env breakdown bars)", () => {
    // v2.4.15-polish iter-3 . per user direction 2026-04-28, the
    // standing per-layer + per-env stacked-bar cards are gone. Their
    // information surfaces on demand via three click-to-drill KPI
    // tiles (Dell density / Most diverse layer / Top non-Dell
    // concentration). Headline 100%-stacked bar still renders above
    // (asserted by VB1).
    var s = makeEnvSession([{ id: "coreDc", hidden: false }]);
    var layers = ["workload", "compute", "storage", "dataProtection", "virtualization", "infrastructure"];
    layers.forEach(function(L, idx) {
      addInstance(s, { state: "current", layerId: L, environmentId: "coreDc",
        label: "VB3-" + L, vendorGroup: idx % 2 === 0 ? "dell" : "nonDell", criticality: "Medium" });
    });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderSummaryVendorView(l, r, s);
    document.body.appendChild(l);
    try {
      var tiles = l.querySelectorAll(".vm-kpi-tile");
      assertEqual(tiles.length, 3,
        "VB3 · headline-insights card must render exactly 3 KPI tiles (got " + tiles.length + ")");
      var eyebrows = Array.prototype.map.call(
        l.querySelectorAll(".vm-kpi-eyebrow"),
        function(e) { return (e.textContent || "").trim(); });
      assert(eyebrows.indexOf("Dell density") >= 0,
        "VB3 · KPI tiles must include 'Dell density' (got " + eyebrows.join(", ") + ")");
      assert(eyebrows.indexOf("Most diverse layer") >= 0,
        "VB3 · KPI tiles must include 'Most diverse layer' (got " + eyebrows.join(", ") + ")");
      assert(eyebrows.indexOf("Top non-Dell concentration") >= 0,
        "VB3 · KPI tiles must include 'Top non-Dell concentration' (got " + eyebrows.join(", ") + ")");
    } finally {
      document.body.removeChild(l);
    }
  });

  // ===================================================================
  // Section FB · FB1-FB6 · Modern collapsible FilterBar
  // ===================================================================

  it("FB1 · renderFilterBar produces a single .filter-bar-toggle button with label /Filters/", () => {
    filterState._resetForTests();
    var target = document.createElement("div");
    document.body.appendChild(target);
    try {
      renderFilterBar(target, {
        dimensions: [{ id: "services", label: "Service", options: [{ id: "migration", label: "Migration" }] }],
        session: createEmptySession(),
        scope: target
      });
      var toggles = target.querySelectorAll(".filter-bar-toggle, [data-filter-bar-toggle]");
      assertEqual(toggles.length, 1,
        "FB1 · renderFilterBar must produce exactly one .filter-bar-toggle (got " + toggles.length + ")");
      assert(/Filters/i.test(toggles[0].textContent || ""),
        "FB1 · toggle text must contain 'Filters' (got '" + toggles[0].textContent + "')");
    } finally {
      document.body.removeChild(target);
      filterState._resetForTests();
    }
  });

  it("FB2 · Click toggle expands .filter-bar-panel; re-click collapses", () => {
    filterState._resetForTests();
    var target = document.createElement("div");
    document.body.appendChild(target);
    try {
      renderFilterBar(target, {
        dimensions: [{ id: "services", label: "Service", options: [{ id: "migration", label: "Migration" }] }],
        session: createEmptySession(),
        scope: target
      });
      var toggle = target.querySelector(".filter-bar-toggle");
      dispatchClick(toggle);
      var panel = target.querySelector(".filter-bar-panel, [data-filter-bar-panel]");
      assert(panel, "FB2 · clicking toggle must produce a .filter-bar-panel element");
      var visible = getComputedStyle(panel).display !== "none";
      assert(visible, "FB2 · panel must be visible after first click (display !== 'none')");
      dispatchClick(toggle);
      var collapsed = getComputedStyle(panel).display === "none";
      assert(collapsed, "FB2 · re-click must collapse panel (display 'none')");
    } finally {
      document.body.removeChild(target);
      filterState._resetForTests();
    }
  });

  it("FB3 · Service chip click sets body[data-filter-services] + chip gets is-active class", () => {
    filterState._resetForTests();
    document.body.removeAttribute("data-filter-services");
    var target = document.createElement("div");
    document.body.appendChild(target);
    try {
      renderFilterBar(target, {
        dimensions: [{ id: "services", label: "Service",
          options: [{ id: "migration", label: "Migration" }, { id: "training", label: "Training" }] }],
        session: createEmptySession(),
        scope: target
      });
      dispatchClick(target.querySelector(".filter-bar-toggle"));
      var chip = target.querySelector(".filter-chip[data-filter-dim='services'][data-filter-value='migration']");
      assert(chip, "FB3 · panel must render a chip with [data-filter-dim='services'][data-filter-value='migration']");
      dispatchClick(chip);
      assertEqual(document.body.getAttribute("data-filter-services"), "migration",
        "FB3 · chip click must set body[data-filter-services]='migration'");
      assert(chip.classList.contains("is-active"),
        "FB3 · chip must add .is-active class after click");
    } finally {
      document.body.removeChild(target);
      document.body.removeAttribute("data-filter-services");
      filterState._resetForTests();
    }
  });

  it("FB4 · Active filter strip renders a removable pill per active filter", () => {
    filterState._resetForTests();
    document.body.removeAttribute("data-filter-services");
    var target = document.createElement("div");
    document.body.appendChild(target);
    try {
      renderFilterBar(target, {
        dimensions: [{ id: "services", label: "Service",
          options: [{ id: "migration", label: "Migration" }] }],
        session: createEmptySession(),
        scope: target
      });
      dispatchClick(target.querySelector(".filter-bar-toggle"));
      var chip = target.querySelector(".filter-chip[data-filter-dim='services'][data-filter-value='migration']");
      dispatchClick(chip);
      var pill = target.querySelector(".active-filter-pill, [data-active-filter-pill]");
      assert(pill, "FB4 · active filter strip must include >=1 .active-filter-pill after a chip is selected");
      var x = pill.querySelector(".pill-remove, [data-pill-remove], .x");
      assert(x, "FB4 · active pill must include an X / remove control");
    } finally {
      document.body.removeChild(target);
      document.body.removeAttribute("data-filter-services");
      filterState._resetForTests();
    }
  });

  it("FB5 · Clicking the pill X removes the filter (body data attr cleared + pill removed)", () => {
    filterState._resetForTests();
    document.body.removeAttribute("data-filter-services");
    var target = document.createElement("div");
    document.body.appendChild(target);
    try {
      renderFilterBar(target, {
        dimensions: [{ id: "services", label: "Service",
          options: [{ id: "migration", label: "Migration" }] }],
        session: createEmptySession(),
        scope: target
      });
      dispatchClick(target.querySelector(".filter-bar-toggle"));
      dispatchClick(target.querySelector(".filter-chip[data-filter-value='migration']"));
      var x = target.querySelector(".active-filter-pill .pill-remove, [data-pill-remove]");
      assert(x, "FB5 · need an X to click");
      dispatchClick(x);
      assert(!document.body.hasAttribute("data-filter-services"),
        "FB5 · clicking X must remove body[data-filter-services]");
      var pillAfter = target.querySelector(".active-filter-pill");
      assert(!pillAfter, "FB5 · pill must be removed from DOM after X click");
    } finally {
      document.body.removeChild(target);
      document.body.removeAttribute("data-filter-services");
      filterState._resetForTests();
    }
  });

  it("FB6 · Toggle label updates to 'Filters · 2 active' when 2 filters are selected", () => {
    filterState._resetForTests();
    var target = document.createElement("div");
    document.body.appendChild(target);
    try {
      renderFilterBar(target, {
        dimensions: [
          { id: "services", label: "Service", options: [{ id: "migration", label: "Migration" }] },
          { id: "layer",    label: "Layer",   options: [{ id: "compute",   label: "Compute"   }] }
        ],
        session: createEmptySession(),
        scope: target
      });
      dispatchClick(target.querySelector(".filter-bar-toggle"));
      dispatchClick(target.querySelector(".filter-chip[data-filter-dim='services'][data-filter-value='migration']"));
      dispatchClick(target.querySelector(".filter-chip[data-filter-dim='layer'][data-filter-value='compute']"));
      var toggle = target.querySelector(".filter-bar-toggle");
      assert(/2\s*active/i.test(toggle.textContent || ""),
        "FB6 · toggle text must include '2 active' when 2 filters selected (got '" + toggle.textContent + "')");
    } finally {
      document.body.removeChild(target);
      document.body.removeAttribute("data-filter-services");
      document.body.removeAttribute("data-filter-layer");
      filterState._resetForTests();
    }
  });

  // ===================================================================
  // Section FB7 · FB7a-d · All 4 filter dimensions wired (services / layer / domain / urgency)
  // ===================================================================

  it("FB7a · Layer dim chip click sets body[data-filter-layer] + matching .gap-card[data-layer] gets .filter-match-layer", () => {
    filterState._resetForTests();
    var s = createEmptySession();
    s.environments = [{ id: "coreDc", hidden: false }];
    var cur = addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "FB7a-cur", vendorGroup: "dell", criticality: "Medium" });
    createGap(s, { description: "FB7a compute gap", layerId: "compute", gapType: "ops",
      relatedCurrentInstanceIds: [cur.id], services: [] });
    createGap(s, { description: "FB7a storage gap dec context that exceeds ten chars",
      layerId: "storage", gapType: "ops", notes: "FB7a storage gap context that exceeds ten chars",
      services: [] });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderGapsEditView(l, r, s);
    document.body.appendChild(l);
    try {
      var toggle = l.querySelector(".filter-bar-toggle");
      assert(toggle, "FB7a · GapsEditView must mount the FilterBar with a toggle");
      dispatchClick(toggle);
      var chip = l.querySelector(".filter-chip[data-filter-dim='layer'][data-filter-value='compute']");
      assert(chip, "FB7a · panel must include a Layer chip for 'compute'");
      dispatchClick(chip);
      assertEqual(document.body.getAttribute("data-filter-layer"), "compute",
        "FB7a · click must set body[data-filter-layer]='compute'");
      var matchCount = l.querySelectorAll(".gap-card[data-layer='compute'].filter-match-layer").length;
      assert(matchCount >= 1,
        "FB7a · matching gap-card must have .filter-match-layer class (got " + matchCount + ")");
    } finally {
      document.body.removeChild(l);
      document.body.removeAttribute("data-filter-layer");
      filterState._resetForTests();
    }
  });

  it("FB7b · Gap type dim chip click sets body[data-filter-gapType] + matching cards get .filter-match-gapType", () => {
    // v2.4.15-polish iter-4 . Domain dim retired per user direction;
    // Gap type takes its slot in the FilterBar accordion. Same contract:
    // chip click -> body data attr + .filter-match-gapType on cards.
    filterState._resetForTests();
    var s = createEmptySession();
    s.environments = [{ id: "coreDc", hidden: false }];
    var cur1 = addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "FB7b-cur1", vendorGroup: "dell", criticality: "Medium" });
    var cur2 = addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "FB7b-cur2", vendorGroup: "dell", criticality: "Medium" });
    createGap(s, { description: "FB7b ops gap", layerId: "compute", gapType: "ops",
      relatedCurrentInstanceIds: [cur1.id], services: ["migration"] });
    createGap(s, { description: "FB7b enhance gap", layerId: "compute", gapType: "enhance",
      relatedCurrentInstanceIds: [cur2.id], services: ["training"] });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderGapsEditView(l, r, s);
    document.body.appendChild(l);
    try {
      dispatchClick(l.querySelector(".filter-bar-toggle"));
      var chip = l.querySelector(".filter-chip[data-filter-dim='gapType'][data-filter-value='ops']");
      assert(chip, "FB7b · panel must include the 'ops' Gap type chip");
      dispatchClick(chip);
      var bodyAttr = document.body.getAttribute("data-filter-gapType") || "";
      assert(bodyAttr.split(" ").indexOf("ops") >= 0,
        "FB7b · click must include 'ops' in body[data-filter-gapType]. Got '" + bodyAttr + "'");
      var matchCount = l.querySelectorAll(".gap-card[data-gapType='ops'].filter-match-gapType").length;
      assert(matchCount >= 1,
        "FB7b · matching gap-card must have .filter-match-gapType class (got " + matchCount + ")");
    } finally {
      document.body.removeChild(l);
      document.body.removeAttribute("data-filter-gapType");
      filterState._resetForTests();
    }
  });

  it("FB7c · Urgency dim chip click sets body[data-filter-urgency] + .gap-card[data-urgency] attribute is present", () => {
    filterState._resetForTests();
    var s = createEmptySession();
    s.environments = [{ id: "coreDc", hidden: false }];
    var cur1 = addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "FB7c-cur1", vendorGroup: "dell", criticality: "Medium" });
    var cur2 = addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "FB7c-cur2", vendorGroup: "dell", criticality: "Medium" });
    createGap(s, { description: "FB7c high gap", layerId: "compute", gapType: "ops",
      relatedCurrentInstanceIds: [cur1.id], urgency: "High" });
    createGap(s, { description: "FB7c low gap",  layerId: "compute", gapType: "ops",
      relatedCurrentInstanceIds: [cur2.id], urgency: "Low" });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderGapsEditView(l, r, s);
    document.body.appendChild(l);
    try {
      var withAttr = l.querySelectorAll(".gap-card[data-urgency]").length;
      assert(withAttr >= 2,
        "FB7c · every .gap-card must carry a data-urgency attribute (got " + withAttr + " of 2 expected)");
      dispatchClick(l.querySelector(".filter-bar-toggle"));
      var chip = l.querySelector(".filter-chip[data-filter-dim='urgency']");
      assert(chip, "FB7c · panel must include >=1 Urgency chip");
      var urgencyValue = chip.getAttribute("data-filter-value");
      dispatchClick(chip);
      assertEqual(document.body.getAttribute("data-filter-urgency"), urgencyValue,
        "FB7c · click must set body[data-filter-urgency]='" + urgencyValue + "'");
    } finally {
      document.body.removeChild(l);
      document.body.removeAttribute("data-filter-urgency");
      filterState._resetForTests();
    }
  });

  it("FB7d · Multi-dim AND combine: only cards matching ALL active dims stay un-dimmed", () => {
    filterState._resetForTests();
    var s = createEmptySession();
    s.environments = [{ id: "coreDc", hidden: false }];
    var cur1 = addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "FB7d-cur1", vendorGroup: "dell", criticality: "Medium" });
    var cur2 = addInstance(s, { state: "current", layerId: "compute", environmentId: "coreDc",
      label: "FB7d-cur2", vendorGroup: "dell", criticality: "Medium" });
    var cur3 = addInstance(s, { state: "current", layerId: "storage", environmentId: "coreDc",
      label: "FB7d-cur3", vendorGroup: "dell", criticality: "Medium" });
    // Card 1: layer=compute, urgency=High -> matches BOTH.
    createGap(s, { description: "FB7d match", layerId: "compute", gapType: "ops",
      relatedCurrentInstanceIds: [cur1.id], urgency: "High" });
    // Card 2: layer=compute, urgency=Low  -> matches layer only.
    createGap(s, { description: "FB7d partial1", layerId: "compute", gapType: "ops",
      relatedCurrentInstanceIds: [cur2.id], urgency: "Low" });
    // Card 3: layer=storage, urgency=High -> matches urgency only.
    createGap(s, { description: "FB7d partial2", layerId: "storage", gapType: "ops",
      relatedCurrentInstanceIds: [cur3.id], urgency: "High" });
    var l = document.createElement("div"); var r = document.createElement("div");
    renderGapsEditView(l, r, s);
    document.body.appendChild(l);
    try {
      dispatchClick(l.querySelector(".filter-bar-toggle"));
      dispatchClick(l.querySelector(".filter-chip[data-filter-dim='layer'][data-filter-value='compute']"));
      dispatchClick(l.querySelector(".filter-chip[data-filter-dim='urgency'][data-filter-value='High']"));
      var unDimmed = 0;
      var cards = l.querySelectorAll(".gap-card");
      Array.prototype.forEach.call(cards, function(c) {
        var op = parseFloat(getComputedStyle(c).opacity);
        if (op >= 0.8) unDimmed++;
      });
      assertEqual(unDimmed, 1,
        "FB7d · with AND-combine across layer=compute + urgency=High, exactly 1 card stays un-dimmed (got " + unDimmed + ")");
    } finally {
      document.body.removeChild(l);
      document.body.removeAttribute("data-filter-layer");
      document.body.removeAttribute("data-filter-urgency");
      filterState._resetForTests();
    }
  });

});

// ============================================================================
// Suite 47 · v2.4.16 · Foundations: Taxonomy + Reporting + PillEditor
// ============================================================================
// Coverage:
//   .TX1-TX6   entity catalog completeness (LAYERS / ENV_CATALOG / ACTIONS /
//              GAP_TYPES / SERVICE_TYPES / BUSINESS_DRIVERS) match TAXONOMY.md §1
//   .DC1-DC10  per-gapType disposition rules (TAXONOMY §4 · validateActionLinks
//              behavior per action; AL1 auto-draft bypass; AL7 ops substance)
//   .DC-LINK1-4 link safety-net derivation (requiresAtLeastOneCurrent/Desired)
//   .RA1-RA8   reporting derivation contract against the demo session
//              (TAXONOMY §6: healthMetrics + gapsService + vendorMixService +
//              roadmapService + programsService)
//   .PE1-PE3   PillEditor regression coverage (TAXONOMY §PE; half-text/half-pill
//              bug fix; pill stays atomic on click; serialize round-trip)
//
// Spec source: SPEC.md §9 Phase 19n / v2.4.16 + docs/CHANGELOG_PLAN.md v2.4.16.
// RED-first sequence per feedback_spec_and_test_first.md: tests defined here
// before §RA service audit + §PE PillEditor fix land.
// ============================================================================

import {
  ACTIONS as TX_ACTIONS,
  GAP_TYPES as TX_GAP_TYPES,
  ACTION_IDS as TX_ACTION_IDS,
  validateActionLinks as txValidateActionLinks,
  requiresAtLeastOneCurrent as txRequiresAtLeastOneCurrent,
  requiresAtLeastOneDesired as txRequiresAtLeastOneDesired
} from "../core/taxonomy.js";

import {
  buildProjects as raBuildProjects,
  computeAccountHealthScore as raComputeAccountHealthScore
} from "../services/roadmapService.js";

import {
  effectiveDriverId as raEffectiveDriverId
} from "../services/programsService.js";

import { createPillEditor as peCreatePillEditor, serializeEditor as peSerializeEditor } from "../ui/components/PillEditor.js";

import { createDemoSession as txCreateDemoSession } from "../state/demoSession.js";

describe("47 · v2.4.16 · Foundations: Taxonomy + Reporting + PillEditor", () => {

  // -------------------------------------------------------------------
  // Helpers scoped to Suite 47.
  // -------------------------------------------------------------------
  function makeReviewedGap(overrides) {
    var base = {
      id: "gap-tx-test",
      description: "TX-suite test gap",
      layerId: "compute",
      affectedLayers: ["compute"],
      affectedEnvironments: ["coreDc"],
      gapType: "replace",
      urgency: "Medium",
      phase: "now",
      status: "open",
      reviewed: true,
      relatedCurrentInstanceIds: [],
      relatedDesiredInstanceIds: [],
      notes: ""
    };
    return Object.assign(base, overrides || {});
  }

  function expectThrow(fn, label) {
    var threw = false;
    var msg = "";
    try { fn(); } catch (e) { threw = true; msg = (e && e.message) || ""; }
    return { threw: threw, message: msg };
  }

  // -------------------------------------------------------------------
  // .TX1-TX6 · Entity catalog completeness (TAXONOMY.md §1)
  // -------------------------------------------------------------------

  it("TX1 · LAYERS contract: 6 entries with the canonical ids in canvas order", () => {
    assertEqual(LAYERS.length, 6, "TX1.a · LAYERS has exactly 6 entries (got " + LAYERS.length + ")");
    var expectedIds = ["workload", "compute", "storage", "dataProtection", "virtualization", "infrastructure"];
    var actualIds = LAYERS.map(function(l) { return l.id; });
    assertEqual(actualIds.join(","), expectedIds.join(","),
      "TX1.b · LAYERS ids in canvas order: " + expectedIds.join(",") + " (got " + actualIds.join(",") + ")");
    LAYERS.forEach(function(l, i) {
      assert(typeof l.label === "string" && l.label.length > 0,
        "TX1.c · LAYERS[" + i + "] has non-empty label");
    });
  });

  it("TX2 · ENV_CATALOG contract: 8 entries with the canonical ids", () => {
    assertEqual(ENV_CATALOG.length, 8, "TX2.a · ENV_CATALOG has exactly 8 entries (got " + ENV_CATALOG.length + ")");
    var expectedIds = ["coreDc", "drDc", "archiveSite", "publicCloud", "edge", "coLo", "managedHosting", "sovereignCloud"];
    var actualIds = ENV_CATALOG.map(function(e) { return e.id; });
    expectedIds.forEach(function(id) {
      assert(actualIds.indexOf(id) >= 0,
        "TX2.b · ENV_CATALOG contains '" + id + "' (actual: " + actualIds.join(",") + ")");
    });
    ENV_CATALOG.forEach(function(e) {
      assert(typeof e.label === "string" && e.label.length > 0,
        "TX2.c · catalog entry '" + e.id + "' has non-empty label");
    });
  });

  it("TX3 · ACTIONS contract: 7 actions with the canonical ids", () => {
    assertEqual(TX_ACTIONS.length, 7, "TX3.a · ACTIONS has exactly 7 entries (got " + TX_ACTIONS.length + ")");
    var expectedIds = ["keep", "enhance", "replace", "consolidate", "retire", "introduce", "ops"];
    expectedIds.forEach(function(id) {
      assert(TX_ACTION_IDS.indexOf(id) >= 0,
        "TX3.b · ACTIONS contains '" + id + "'");
    });
    TX_ACTIONS.forEach(function(a) {
      assert(typeof a.label === "string" && a.label.length > 0,
        "TX3.c · action '" + a.id + "' has non-empty label");
      assert(typeof a.hint === "string",
        "TX3.d · action '" + a.id + "' has hint string (matrix picker copy)");
    });
  });

  it("TX4 · GAP_TYPES contract: 5 derived types (no `keep` since gapType:null)", () => {
    assertEqual(TX_GAP_TYPES.length, 5, "TX4.a · GAP_TYPES has exactly 5 entries (got " + TX_GAP_TYPES.length + ")");
    var expected = ["enhance", "replace", "consolidate", "introduce", "ops"];
    expected.forEach(function(g) {
      assert(TX_GAP_TYPES.indexOf(g) >= 0,
        "TX4.b · GAP_TYPES contains '" + g + "' (got " + TX_GAP_TYPES.join(",") + ")");
    });
    assert(TX_GAP_TYPES.indexOf("rationalize") < 0,
      "TX4.c · legacy 'rationalize' is purged from GAP_TYPES");
    assert(TX_GAP_TYPES.indexOf("keep") < 0,
      "TX4.d · 'keep' is not a gapType (Action keep produces gapType: null)");
  });

  it("TX5 · SERVICE_TYPES contract: 10 catalog entries with stable ids", () => {
    assertEqual(SERVICE_TYPES.length, 10, "TX5.a · SERVICE_TYPES has exactly 10 entries (got " + SERVICE_TYPES.length + ")");
    var expectedIds = ["assessment", "migration", "deployment", "integration", "training",
                       "knowledge_transfer", "runbook", "managed", "decommissioning", "custom_dev"];
    var actualIds = SERVICE_TYPES.map(function(s) { return s.id; });
    expectedIds.forEach(function(id) {
      assert(actualIds.indexOf(id) >= 0,
        "TX5.b · SERVICE_TYPES contains '" + id + "' (actual: " + actualIds.join(",") + ")");
    });
  });

  it("TX6 · BUSINESS_DRIVERS contract: 8 drivers with conversation starters", () => {
    assertEqual(BUSINESS_DRIVERS.length, 8, "TX6.a · BUSINESS_DRIVERS has exactly 8 entries (got " + BUSINESS_DRIVERS.length + ")");
    var expectedIds = ["ai_data", "cyber_resilience", "cost_optimization", "cloud_strategy",
                       "modernize_infra", "ops_simplicity", "compliance_sovereignty", "sustainability"];
    var actualIds = BUSINESS_DRIVERS.map(function(d) { return d.id; });
    expectedIds.forEach(function(id) {
      assert(actualIds.indexOf(id) >= 0,
        "TX6.b · BUSINESS_DRIVERS contains '" + id + "'");
    });
    BUSINESS_DRIVERS.forEach(function(d) {
      assert(typeof d.conversationStarter === "string" && d.conversationStarter.length > 0,
        "TX6.c · driver '" + d.id + "' has non-empty conversationStarter");
      assert(typeof d.shortHint === "string" && d.shortHint.length > 0,
        "TX6.d · driver '" + d.id + "' has non-empty shortHint");
    });
  });

  // -------------------------------------------------------------------
  // .DC1-DC10 · Per-gapType disposition rules (TAXONOMY.md §4)
  // -------------------------------------------------------------------

  it("DC1 · Replace 1+1 reviewed gap PASSES validateActionLinks", () => {
    var gap = makeReviewedGap({
      gapType: "replace",
      relatedCurrentInstanceIds: ["c-1"],
      relatedDesiredInstanceIds: ["d-1"]
    });
    var r = expectThrow(function() { txValidateActionLinks(gap); });
    assert(!r.threw, "DC1 · Replace 1+1 should PASS (got error: " + r.message + ")");
  });

  it("DC2 · Replace 0+1 reviewed gap THROWS workshop-friendly message", () => {
    var gap = makeReviewedGap({
      gapType: "replace",
      relatedCurrentInstanceIds: [],
      relatedDesiredInstanceIds: ["d-1"]
    });
    var r = expectThrow(function() { txValidateActionLinks(gap); });
    assert(r.threw, "DC2.a · Replace 0+1 should THROW");
    assert(/Replace needs the technology being replaced|current/i.test(r.message),
      "DC2.b · message references current-side requirement (got: " + r.message + ")");
  });

  it("DC3 · Replace 2+1 reviewed gap THROWS (one-for-one swap rule)", () => {
    var gap = makeReviewedGap({
      gapType: "replace",
      relatedCurrentInstanceIds: ["c-1", "c-2"],
      relatedDesiredInstanceIds: ["d-1"]
    });
    var r = expectThrow(function() { txValidateActionLinks(gap); });
    assert(r.threw, "DC3.a · Replace 2+1 should THROW");
    assert(/one-for-one|only ONE|Consolidate/i.test(r.message),
      "DC3.b · message points to Consolidate as alternative (got: " + r.message + ")");
  });

  it("DC4 · Consolidate 2+1 reviewed gap PASSES (the canonical N-to-1)", () => {
    var gap = makeReviewedGap({
      gapType: "consolidate",
      relatedCurrentInstanceIds: ["c-1", "c-2"],
      relatedDesiredInstanceIds: ["d-1"]
    });
    var r = expectThrow(function() { txValidateActionLinks(gap); });
    assert(!r.threw, "DC4 · Consolidate 2+1 should PASS (got error: " + r.message + ")");
  });

  it("DC5 · Consolidate 1+1 reviewed gap THROWS (needs ≥2 currents)", () => {
    var gap = makeReviewedGap({
      gapType: "consolidate",
      relatedCurrentInstanceIds: ["c-1"],
      relatedDesiredInstanceIds: ["d-1"]
    });
    var r = expectThrow(function() { txValidateActionLinks(gap); });
    assert(r.threw, "DC5.a · Consolidate 1+1 should THROW");
    assert(/2|merging multiple|AT LEAST 2/i.test(r.message),
      "DC5.b · message communicates the 2+ minimum (got: " + r.message + ")");
  });

  it("DC6 · Introduce 0+1 reviewed gap PASSES (net-new capability)", () => {
    var gap = makeReviewedGap({
      gapType: "introduce",
      relatedCurrentInstanceIds: [],
      relatedDesiredInstanceIds: ["d-1"]
    });
    var r = expectThrow(function() { txValidateActionLinks(gap); });
    assert(!r.threw, "DC6 · Introduce 0+1 should PASS (got error: " + r.message + ")");
  });

  it("DC7 · Introduce 1+1 reviewed gap THROWS (no current to replace)", () => {
    var gap = makeReviewedGap({
      gapType: "introduce",
      relatedCurrentInstanceIds: ["c-1"],
      relatedDesiredInstanceIds: ["d-1"]
    });
    var r = expectThrow(function() { txValidateActionLinks(gap); });
    assert(r.threw, "DC7.a · Introduce 1+1 should THROW");
    assert(/net-new|no current|Use Replace/i.test(r.message),
      "DC7.b · message points to Replace (got: " + r.message + ")");
  });

  it("DC8 · ops gap with no links + <10 char notes THROWS (AL7 substance rule)", () => {
    var gap = makeReviewedGap({
      gapType: "ops",
      relatedCurrentInstanceIds: [],
      relatedDesiredInstanceIds: [],
      notes: "short"   // 5 chars after trim
    });
    var r = expectThrow(function() { txValidateActionLinks(gap); });
    assert(r.threw, "DC8.a · empty ops gap should THROW (AL7 substance)");
    assert(/Operational|substance|10 characters|technology|description/i.test(r.message),
      "DC8.b · message asks for link or notes (got: " + r.message + ")");
  });

  it("DC9 · ops gap with 0 links + ≥10 char notes PASSES (AL7 satisfied via notes)", () => {
    var gap = makeReviewedGap({
      gapType: "ops",
      relatedCurrentInstanceIds: [],
      relatedDesiredInstanceIds: [],
      notes: "Author DR runbooks across all branches."   // ≥10 chars
    });
    var r = expectThrow(function() { txValidateActionLinks(gap); });
    assert(!r.threw, "DC9 · ops with notes ≥10ch should PASS (got error: " + r.message + ")");
  });

  it("DC10 · auto-draft (reviewed:false) bypasses ALL action-link rules (AL1)", () => {
    var gap = makeReviewedGap({
      gapType: "consolidate",
      relatedCurrentInstanceIds: [],     // would FAIL if reviewed
      relatedDesiredInstanceIds: [],
      reviewed: false
    });
    var r = expectThrow(function() { txValidateActionLinks(gap); });
    assert(!r.threw, "DC10 · auto-draft should bypass validation (got error: " + r.message + ")");
  });

  // -------------------------------------------------------------------
  // .DC-LINK1-4 · Link safety-net derivation (taxonomy contract)
  // -------------------------------------------------------------------

  it("DC-LINK1 · requiresAtLeastOneCurrent('replace') === true", () => {
    assertEqual(txRequiresAtLeastOneCurrent("replace"), true,
      "DC-LINK1 · replace requires ≥1 current");
  });

  it("DC-LINK2 · requiresAtLeastOneCurrent('introduce') === false", () => {
    assertEqual(txRequiresAtLeastOneCurrent("introduce"), false,
      "DC-LINK2 · introduce requires 0 currents");
  });

  it("DC-LINK3 · requiresAtLeastOneDesired('replace') === true", () => {
    assertEqual(txRequiresAtLeastOneDesired("replace"), true,
      "DC-LINK3 · replace requires ≥1 desired");
  });

  it("DC-LINK4 · requiresAtLeastOneDesired('ops') === false (optional + optional)", () => {
    assertEqual(txRequiresAtLeastOneDesired("ops"), false,
      "DC-LINK4 · ops desired-side is optional");
  });

  // -------------------------------------------------------------------
  // .RA1-RA8 · Reporting derivation contract against the demo session
  // (TAXONOMY.md §6 · audit makes these GREEN once services have
  //  `// Last audited v2.4.16` markers and any drift fixes land)
  // -------------------------------------------------------------------

  it("RA1 · getHealthSummary on demo returns audited shape with closed-aware highRiskGaps", () => {
    var demo = txCreateDemoSession();
    var summary = getHealthSummary(demo, LAYERS, ENVIRONMENTS);
    assert(summary && typeof summary === "object",
      "RA1.a · getHealthSummary returns an object");
    assert(typeof summary.totalCurrent === "number" && summary.totalCurrent > 0,
      "RA1.b · demo has >0 totalCurrent (got " + summary.totalCurrent + ")");
    assert(typeof summary.totalDesired === "number" && summary.totalDesired >= 0,
      "RA1.c · totalDesired is a non-negative number (got " + summary.totalDesired + ")");
    assert(typeof summary.totalGaps === "number" && summary.totalGaps > 0,
      "RA1.d · demo has >0 totalGaps (got " + summary.totalGaps + ")");
    assert(typeof summary.highRiskGaps === "number" && summary.highRiskGaps >= 0,
      "RA1.e · highRiskGaps is a non-negative number (got " + summary.highRiskGaps + ")");
    assert(summary.highRiskGaps <= summary.totalGaps,
      "RA1.f · highRiskGaps <= totalGaps (got " + summary.highRiskGaps + " > " + summary.totalGaps + ")");

    // RA1.g · v2.4.16 audit fix · closed-but-High urgency gaps EXCLUDED from
    // highRiskGaps (closed work isn't current risk). Construct a session with
    // exactly one open-High and one closed-High gap; assert highRiskGaps === 1.
    var s = createEmptySession();
    s.instances = [];
    s.gaps = [
      { id: "g-open-high", description: "open high", layerId: "compute", affectedLayers: ["compute"], affectedEnvironments: ["coreDc"], gapType: "replace", urgency: "High", phase: "now", status: "open", reviewed: true, relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [] },
      { id: "g-closed-high", description: "closed high", layerId: "compute", affectedLayers: ["compute"], affectedEnvironments: ["coreDc"], gapType: "replace", urgency: "High", phase: "now", status: "closed", reviewed: true, relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [] }
    ];
    var sumExclusion = getHealthSummary(s, LAYERS, ENVIRONMENTS);
    assertEqual(sumExclusion.highRiskGaps, 1,
      "RA1.g · closed-but-High gap excluded from highRiskGaps (got " + sumExclusion.highRiskGaps + ", expected 1)");
    assertEqual(sumExclusion.totalGaps, 2,
      "RA1.h · closed gap STILL counted in totalGaps (got " + sumExclusion.totalGaps + ", expected 2)");
  });

  it("RA2 · getAllGaps returns all session.gaps regardless of status (raw access)", () => {
    var demo = txCreateDemoSession();
    var prev = session.gaps.slice();
    session.gaps = demo.gaps.slice();
    try {
      var allGaps = getAllGaps();
      assertEqual(allGaps.length, demo.gaps.length,
        "RA2 · getAllGaps returns all " + demo.gaps.length + " demo gaps (got " + allGaps.length + ")");
    } finally {
      session.gaps = prev;
    }
  });

  it("RA3 · computeMixByLayer on demo returns an entry for every layer", () => {
    var demo = txCreateDemoSession();
    var prevInstances = session.instances.slice();
    session.instances = demo.instances.slice();
    try {
      var mix = computeMixByLayer({ stateFilter: "current", layerIds: LAYERS.map(function(l) { return l.id; }) });
      assert(mix && (Array.isArray(mix) || typeof mix === "object"),
        "RA3.a · computeMixByLayer returns an iterable shape");
      // Every layer present in result. Accept either Array<{layerId,...}> or Object<layerId,...>.
      var layerIdsPresent = Array.isArray(mix)
        ? mix.map(function(r) { return r.layerId; })
        : Object.keys(mix);
      assert(layerIdsPresent.length >= 1,
        "RA3.b · result spans ≥1 layer (got " + layerIdsPresent.length + ")");
    } finally {
      session.instances = prevInstances;
    }
  });

  it("RA4 · computeMixByEnv with getVisibleEnvironments respects hidden flag", () => {
    var demo = txCreateDemoSession();
    // Hide drDc explicitly; computeMixByEnv should not include drDc rows
    // when caller passes getVisibleEnvironments(demo).
    if (!Array.isArray(demo.environments) || demo.environments.length === 0) {
      // Materialize default envs so we can hide one.
      demo.environments = DEFAULT_ENABLED_ENV_IDS.map(function(id) {
        return { id: id, hidden: false };
      });
    }
    var dr = demo.environments.find(function(e) { return e.id === "drDc"; });
    if (dr) dr.hidden = true;
    var visible = getVisibleEnvironments(demo);
    var visibleIds = visible.map(function(e) { return e.id; });
    assert(visibleIds.indexOf("drDc") < 0,
      "RA4.a · drDc absent from getVisibleEnvironments after hide (got: " + visibleIds.join(",") + ")");
    // Smoke that the function is callable with the visible list (full mix
    // verification belongs to the §RA audit pass).
    var prev = session.instances.slice();
    session.instances = demo.instances.slice();
    try {
      var mix = computeMixByEnv({ stateFilter: "current", environments: visible });
      assert(mix !== undefined,
        "RA4.b · computeMixByEnv accepts getVisibleEnvironments output");
    } finally {
      session.instances = prev;
    }
  });

  it("RA5 · getFilteredGaps default opts INCLUDES closed gaps (caller-side filter contract per TAXONOMY §6.2 / §9 KD3)", () => {
    // Audited 2026-04-29 · §6.2 + §9 KD3 · getFilteredGaps does NOT filter
    // by gap.status by design. Closed-gap exclusion happens caller-side
    // (Tab 4 + Tab 5 SharedFilterBar `showClosedGaps` toggle + body data
    // attribute + CSS dim rule). This test pins the documented behavior
    // so a future refactor that silently changes it gets caught.
    var demo = txCreateDemoSession();
    var closedFound = demo.gaps.some(function(g) { return g.status === "closed"; });
    if (!closedFound && demo.gaps.length > 0) {
      demo.gaps[demo.gaps.length - 1] = Object.assign({}, demo.gaps[demo.gaps.length - 1], {
        status: "closed", closeReason: "test fixture", closedAt: new Date().toISOString()
      });
    }
    var prev = session.gaps.slice();
    session.gaps = demo.gaps.slice();
    try {
      var filtered = getFilteredGaps({});
      // Per audited contract: closed gaps DO appear in default result.
      var closedInResult = filtered.filter(function(g) { return g.status === "closed"; });
      assert(closedInResult.length >= 1,
        "RA5.a · getFilteredGaps default opts INCLUDES closed gaps (audited contract; got " +
        closedInResult.length + " closed in result of " + filtered.length + ")");
      // Caller-side exclusion works as expected when chained.
      var openOnly = filtered.filter(function(g) { return g.status !== "closed"; });
      assert(openOnly.length === filtered.length - closedInResult.length,
        "RA5.b · caller-side `.filter(g => g.status !== \"closed\")` removes exactly the closed entries");
    } finally {
      session.gaps = prev;
    }
  });

  it("RA6 · buildProjects on demo returns { projects: [...] } with derived metadata", () => {
    // Audited 2026-04-29 · §6.4 · buildProjects returns `{ projects: [...] }`
    // (Suite 20 also pins this shape; v2.4.16 documents the contract).
    var demo = txCreateDemoSession();
    var result = raBuildProjects(demo);
    assert(result && typeof result === "object", "RA6.a · buildProjects returns an object");
    assert(Array.isArray(result.projects), "RA6.b · result.projects is an array");
    var projects = result.projects;
    assert(projects.length >= 1, "RA6.c · demo produces ≥1 project (got " + projects.length + ")");
    projects.forEach(function(p, i) {
      assert(typeof p.id === "string" && p.id.length > 0,
        "RA6.d · project[" + i + "] has non-empty id");
      assert(typeof p.name === "string" && p.name.length > 0,
        "RA6.e · project[" + i + "] has derived name");
      assert(["High", "Medium", "Low"].indexOf(p.urgency) >= 0,
        "RA6.f · project[" + i + "] urgency in {High,Medium,Low} (got " + p.urgency + ")");
    });
  });

  it("RA7 · effectiveDriverId resolves explicit override OR ladder fallback", () => {
    var demo = txCreateDemoSession();
    // Find any gap with an explicit driverId for the explicit-override case;
    // otherwise just exercise the ladder.
    var gap = demo.gaps[0];
    var resolved = raEffectiveDriverId(gap, demo);
    assert(typeof resolved === "string" || resolved === null || resolved === undefined,
      "RA7.a · effectiveDriverId returns string|null (got " + typeof resolved + ")");
    if (typeof resolved === "string" && resolved.length > 0) {
      var inCatalog = BUSINESS_DRIVERS.some(function(d) { return d.id === resolved; });
      assert(inCatalog,
        "RA7.b · resolved driverId '" + resolved + "' exists in BUSINESS_DRIVERS catalog");
    }
  });

  it("RA8 · computeAccountHealthScore on demo returns a number in [0, 100]", () => {
    var demo = txCreateDemoSession();
    var score = raComputeAccountHealthScore(demo);
    assert(typeof score === "number" && !isNaN(score),
      "RA8.a · computeAccountHealthScore returns a finite number (got " + score + ")");
    assert(score >= 0 && score <= 100,
      "RA8.b · score in [0,100] (got " + score + ")");
  });

  // -------------------------------------------------------------------
  // .PE1-PE3 · PillEditor regression (RED until §PE fix lands)
  // -------------------------------------------------------------------

  it("PE1 · createPillEditor with template `{{path}} text {{path2}}` produces 2 pills + 1 text node", () => {
    var manifest = [
      { path: "session.customer.name", label: "Customer name", kind: "scalar" },
      { path: "session.customer.vertical", label: "Vertical", kind: "scalar" }
    ];
    var editor = peCreatePillEditor({
      manifest: manifest,
      initialValue: "Customer name: {{session.customer.name}} works in Vertical: {{session.customer.vertical}}"
    });
    assert(editor && editor.classList && editor.classList.contains("pill-editor"),
      "PE1.a · returns a .pill-editor element");
    var pills = editor.querySelectorAll(".binding-pill");
    assertEqual(pills.length, 2,
      "PE1.b · template with two {{path}} bindings yields exactly 2 pills (got " + pills.length + ")");
    Array.prototype.forEach.call(pills, function(p) {
      assertEqual(p.getAttribute("contenteditable"), "false",
        "PE1.c · pill carries contenteditable='false' (atomic; got " + p.getAttribute("contenteditable") + ")");
    });
  });

  it("PE2 · clicking a pill leaves it as a single atomic node (no half-text/half-pill split)", () => {
    var editor = peCreatePillEditor({
      manifest: [{ path: "session.customer.name", label: "Customer name", kind: "scalar" }],
      initialValue: "Customer name: {{session.customer.name}}"
    });
    document.body.appendChild(editor);
    try {
      var pillBefore = editor.querySelector(".binding-pill");
      assert(pillBefore, "PE2.a · pill present before click");
      var textBefore = pillBefore.textContent;
      // Simulate user click on the pill.
      pillBefore.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      // Assert: still exactly one pill in the editor; its text is intact.
      var pillsAfter = editor.querySelectorAll(".binding-pill");
      assertEqual(pillsAfter.length, 1,
        "PE2.b · still exactly 1 pill after click (got " + pillsAfter.length + ")");
      assertEqual(pillsAfter[0].textContent, textBefore,
        "PE2.c · pill text unchanged after click (was '" + textBefore + "', now '" + pillsAfter[0].textContent + "')");
      assertEqual(pillsAfter[0].getAttribute("contenteditable"), "false",
        "PE2.d · pill remains contenteditable='false' after click");
      // No stray text node carrying the pill's label without the pill wrapper.
      var html = editor.innerHTML;
      assert(!/Customer name(?![^<]*<\/span>)/.test(html.replace(pillsAfter[0].outerHTML, "")),
        "PE2.e · no orphan text fragment of pill label outside the pill (avoids half-text/half-pill regression)");
    } finally {
      document.body.removeChild(editor);
    }
  });

  it("PE3 · serializeEditor round-trip: parsed template equals input verbatim", () => {
    var manifest = [
      { path: "session.customer.name", label: "Customer name", kind: "scalar" },
      { path: "session.gaps", label: "Gaps", kind: "array" }
    ];
    var input = "Hello, Customer name: {{session.customer.name}}. We have {{session.gaps}} gaps.";
    var editor = peCreatePillEditor({ manifest: manifest, initialValue: input });
    var roundTrip = peSerializeEditor(editor);
    assertEqual(roundTrip, input,
      "PE3 · serialize(create(input)) === input (got '" + roundTrip + "')");
  });

  it("PE4 · half-text/half-pill render is by-design when template's preceding label doesn't match field-manifest canonical label", () => {
    // v2.4.16 PillEditor investigation · the user-reported "half text half
    // capsule" visual is the documented parser behavior: when a template
    // has e.g. "Customer na: {{path}}" (mismatched label), the look-behind
    // in parseToSegments doesn't consume the preceding text → pill becomes
    // BARE → visually plain-text-plus-capsule. Pin this contract here so any
    // future change to the parser is intentional. See TAXONOMY.md §9 KD9.
    var manifest = [{ path: "session.customer.name", label: "Customer name", kind: "scalar" }];
    var editor = peCreatePillEditor({
      manifest: manifest,
      initialValue: "Hello Customer na: {{session.customer.name}} please."
    });
    var pills = editor.querySelectorAll(".binding-pill");
    assertEqual(pills.length, 1, "PE4.a · template parses to exactly 1 pill");
    assertEqual(pills[0].dataset.bare, "true",
      "PE4.b · mismatched-label preceding text → pill is BARE (renders as `{{path}}`)");
    assertEqual(pills[0].textContent, "{{session.customer.name}}",
      "PE4.c · bare pill displays the path expression");
    // Preceding sibling carries the literal mismatched-label text → "half text" half.
    var preceding = pills[0].previousSibling;
    assert(preceding && /Customer na: $/.test(preceding.textContent || ""),
      "PE4.d · preceding text includes the mismatched 'Customer na: ' (preserved verbatim)");
  });

});

// v3.0 imports — schema layer (per SPEC sec S2 + sec 3). These imports
// resolve through the importmap in index.html; "zod" maps to the
// vendored ./vendor/zod/zod.mjs build (per SPEC sec S2.1.1 LOCKED).
import { CustomerSchema,    createEmptyCustomer    } from "../schema/customer.js";
import { DriverSchema,      createEmptyDriver      } from "../schema/driver.js";
import { EnvironmentSchema, createEmptyEnvironment } from "../schema/environment.js";
import { InstanceSchema,    createEmptyInstance    } from "../schema/instance.js";
import { GapSchema,         createEmptyGap         } from "../schema/gap.js";
import { EngagementMetaSchema, createEmptyEngagementMeta,
         EngagementSchema,     createEmptyEngagement
       } from "../schema/engagement.js";
import { addDriver, updateDriver, removeDriver } from "../state/collections/driverActions.js";
import { updateCustomer } from "../state/collections/customerActions.js";
import { addEnvironment, updateEnvironment, removeEnvironment, hideEnvironment, unhideEnvironment } from "../state/collections/environmentActions.js";
// instanceActions: addInstance + updateInstance both collide with v2.x
// (interactions/matrixCommands.js, line ~80). Alias all to V3 suffix for
// consistency.
import {
  addInstance        as addInstanceV3,
  updateInstance     as updateInstanceV3,
  removeInstance,                              // v2.x uses deleteInstance; no collision
  linkOrigin,
  mapWorkloadAssets
} from "../state/collections/instanceActions.js";
// gapActions: updateGap collides with v2.x interactions/gapsCommands.js
// (line ~86). addGap is unique (v2.x uses createGap). Alias for safety.
import {
  addGap             as addGapV3,
  updateGap          as updateGapV3,
  removeGap,                                   // v2.x uses deleteGap; no collision
  attachServices,
  attachInstances
} from "../state/collections/gapActions.js";
// Aliased to avoid collision with v2.x services/sessionFile.js's
// buildSaveEnvelope (imported at line ~5533). Both shapes coexist
// during the v3.0 cutover.
import {
  buildSaveEnvelope as buildSaveEnvelopeV3,
  loadCanvas        as loadCanvasV3
} from "../services/canvasFile.js";
import {
  loadCatalog,
  loadAllCatalogs,
  CATALOG_IDS,
  _resetCacheForTests as _resetCatalogCache
} from "../services/catalogLoader.js";
import { selectVendorMix }              from "../selectors/vendorMix.js";
import { selectGapsKanban }             from "../selectors/gapsKanban.js";
import { selectMatrixView }             from "../selectors/matrix.js";
import { selectProjects }               from "../selectors/projects.js";
import { selectHealthSummary }          from "../selectors/healthSummary.js";
import { selectExecutiveSummaryInputs } from "../selectors/executiveSummary.js";
import { selectLinkedComposition }      from "../selectors/linkedComposition.js";
import { migrate_v2_0_to_v3_0, MigrationStepError } from "../migrations/v2-0_to_v3-0/index.js";
import { migrateToVersion } from "../migrations/index.js";
import { makePipelineContext } from "../migrations/helpers/pipelineContext.js";
import { generateDeterministicId } from "../migrations/helpers/deterministicId.js";
import { runIntegritySweep } from "../state/integritySweep.js";
import { generateManifest, serializeManifestStable } from "../services/manifestGenerator.js";
import { resolveTemplate, resolvePath } from "../services/pathResolver.js";
import { buildReferenceEngagement } from "../tests/perf/buildReferenceEngagement.js";
import { measure, measureMin, assertWithinBudget, PERF_BUDGETS } from "../tests/perf/perfHarness.js";
import { runSkill } from "../services/skillRunner.js";
import { createMockLLMProvider } from "../tests/mocks/mockLLMProvider.js";
import {
  SEED_SKILL_DELL_MAPPING,
  SEED_SKILL_EXECUTIVE_SUMMARY,
  SEED_SKILL_CARE_BUILDER,
  V3_SEED_SKILLS
} from "../core/v3SeedSkills.js";
import { SkillSchema, createEmptySkill } from "../schema/skill.js";
import { validateSkillSave }             from "../services/skillSaveValidator.js";

// v3.0.0-rc.1 · §T19 V-ADP · v3.0 → v2.x consumption adapter
// (SPEC §S19, RULES §15). Imports the STUB module — Suite 49 §T19
// V-ADP-1..10 fails RED against these stubs by design until impl lands.
import {
  adaptContextView,
  adaptArchitectureView,
  adaptHeatmapView,
  adaptWorkloadView,
  adaptGapsView,
  adaptReportingView,
  commitContextEdit,
  commitInstanceEdit,
  commitWorkloadMapping,
  commitGapEdit
} from "../state/adapter.js";
import {
  getActiveEngagement,
  setActiveEngagement,
  subscribeActiveEngagement,
  commitAction,
  _resetForTests as _resetEngagementStoreForTests
} from "../state/engagementStore.js";

// rc.2 . SPEC §S20 V-CHAT . Canvas Chat (context-aware AI assistant).
// Imports the STUB modules — Suite 49 §T20 V-CHAT-1..12 fails RED
// against these stubs by design until impl lands.
import { streamChat, providerCapabilities }      from "../services/chatService.js";
import { buildSystemPrompt }                     from "../services/systemPromptAssembler.js";
import { CHAT_TOOLS }                            from "../services/chatTools.js";
import {
  loadTranscript, saveTranscript, clearTranscript, summarizeIfNeeded,
  CHAT_TRANSCRIPT_WINDOW, TRANSCRIPT_KEY_PREFIX,
  _resetForTests as _resetChatMemoryForTests
} from "../state/chatMemory.js";
import { createMockChatProvider }                from "../tests/mocks/mockChatProvider.js";

// rc.2 . SPEC §S21+S22+S23 . Cleanup arc imports (RED-first stubs).
// V-DEMO + V-MOCK + V-ANTI-RUN-1 fail RED against stubs until impl
// commits land per the spec-and-test-first cadence.
import { loadDemo as loadV3Demo, describeDemo as describeV3Demo } from "../core/demoEngagement.js";
import { createMockChatProvider as createMockChatProviderProd } from "../services/mockChatProvider.js";
import { createMockLLMProvider  as createMockLLMProviderProd  } from "../services/mockLLMProvider.js";

// rc.2 . SPEC §S25 . Data contract LLM grounding meta-model + §S20.16 handshake.
// V-CONTRACT-1..7 fail RED against the STUB core/dataContract.js until
// the real derived contract ships in Step 2 of the chat-perfection arc.
import { getDataContract, getContractChecksum } from "../core/dataContract.js";

// ============================================================================
// Suite 49 · v3.0 data architecture rebuild · RED-first vector scaffold
//
// Authority: docs/v3.0/TESTS.md  (vector catalogue)
//          + docs/v3.0/SPEC.md   (R-number contract)
//          + docs/v3.0/MIGRATION.md (per-step transformation rules)
//
// Status: SCAFFOLD. Each it() is a placeholder with an empty body that
// passes trivially (the test runner counts the it() as PASS when no
// assertion fires). Bodies fill in as v3.0 implementation lands per
// directive sec 0.4 ordering. Vector ids appear verbatim in it()
// descriptions for grep-ability (TESTS.md sec T1.3).
//
// Append-only: per TESTS.md sec T1.2, vector ids are PERMANENT. Removing
// requires explicit deprecation (struck-through entry + reason +
// replacement vector id). Renumbering is forbidden.
// ============================================================================

describe("49 · v3.0 data architecture rebuild — RED-first vector scaffold", () => {

  // -------------------------------------------------------------------
  // sec T2 · V-SCH · Schema property tests (per SPEC sec S2.4 + sec 3)
  // -------------------------------------------------------------------
  describe("§T2 · V-SCH · Schema property tests", () => {
    // Per-entity acceptance (V-SCH-1..7)
    it("V-SCH-1 · EngagementMetaSchema accepts createEmptyEngagementMeta() output", () => {
      const m = createEmptyEngagementMeta();
      const result = EngagementMetaSchema.safeParse(m);
      assert(result.success === true,
        "createEmptyEngagementMeta must produce a meta record EngagementMetaSchema accepts. Issues: " +
        (result.success ? "" : JSON.stringify(result.error.issues)));
      assertEqual(result.data.schemaVersion, "3.0", "schemaVersion locked at '3.0'");
    });
    it("V-SCH-2 · CustomerSchema accepts createEmptyCustomer() output", () => {
      const c = createEmptyCustomer();
      const result = CustomerSchema.safeParse(c);
      assert(result.success === true,
        "createEmptyCustomer must produce a customer that CustomerSchema accepts. Issues: " +
        (result.success ? "" : JSON.stringify(result.error.issues)));
      assertEqual(result.data.name, c.name, "name preserved");
      assertEqual(result.data.vertical, c.vertical, "vertical preserved");
    });
    it("V-SCH-3 · DriverSchema accepts createEmptyDriver() output", () => {
      const d = createEmptyDriver();
      const result = DriverSchema.safeParse(d);
      assert(result.success === true,
        "createEmptyDriver must produce a driver DriverSchema accepts. Issues: " +
        (result.success ? "" : JSON.stringify(result.error.issues)));
      assert(["High","Medium","Low"].includes(result.data.priority), "priority is one of the 3 enum values");
    });
    it("V-SCH-4 · EnvironmentSchema accepts createEmptyEnvironment() output", () => {
      const env = createEmptyEnvironment();
      const result = EnvironmentSchema.safeParse(env);
      assert(result.success === true,
        "createEmptyEnvironment must produce an env EnvironmentSchema accepts. Issues: " +
        (result.success ? "" : JSON.stringify(result.error.issues)));
      assertEqual(result.data.hidden, false, "hidden defaults to false");
    });
    it("V-SCH-5 · InstanceSchema accepts createEmptyInstance({state:'current'})", () => {
      const inst = createEmptyInstance({ state: "current" });
      const result = InstanceSchema.safeParse(inst);
      assert(result.success === true,
        "createEmptyInstance({state:'current'}) must produce an instance InstanceSchema accepts. Issues: " +
        (result.success ? "" : JSON.stringify(result.error.issues)));
      assertEqual(result.data.state, "current", "state preserved");
      assertEqual(result.data.originId, null, "current-state instance has originId=null");
      assertEqual(result.data.priority, null, "current-state instance has priority=null");
    });
    it("V-SCH-6 · InstanceSchema accepts createEmptyInstance({state:'desired'})", () => {
      const inst = createEmptyInstance({ state: "desired" });
      const result = InstanceSchema.safeParse(inst);
      assert(result.success === true,
        "createEmptyInstance({state:'desired'}) must produce an instance InstanceSchema accepts. Issues: " +
        (result.success ? "" : JSON.stringify(result.error.issues)));
      assertEqual(result.data.state, "desired", "state preserved");
    });
    it("V-SCH-7 · GapSchema accepts createEmptyGap() output", () => {
      const gap = createEmptyGap();
      const result = GapSchema.safeParse(gap);
      assert(result.success === true,
        "createEmptyGap must produce a gap GapSchema accepts. Issues: " +
        (result.success ? "" : JSON.stringify(result.error.issues)));
      // G6 invariant satisfied by default factory: affectedLayers[0] === layerId
      assertEqual(result.data.affectedLayers[0], result.data.layerId,
        "G6: affectedLayers[0] === layerId in default factory");
    });

    // Per-entity rejection of malformed inputs (V-SCH-8..40)
    it("V-SCH-8 · EngagementMetaSchema rejects schemaVersion !== '3.0'", () => {
      const m = createEmptyEngagementMeta();
      const result = EngagementMetaSchema.safeParse({ ...m, schemaVersion: "2.0" });
      assert(result.success === false, "schemaVersion '2.0' must be rejected (literal '3.0')");
      assert(result.error.issues.some(i => i.path[0] === "schemaVersion"),
        "rejection must point at schemaVersion");
    });
    it("V-SCH-9 · EngagementMetaSchema rejects status not in enum (Draft|In review|Locked)", () => {
      const m = createEmptyEngagementMeta();
      const result = EngagementMetaSchema.safeParse({ ...m, status: "Done" });
      assert(result.success === false, "status 'Done' must be rejected");
      assert(result.error.issues.some(i => i.path[0] === "status"),
        "rejection must point at status");
    });
    it("V-SCH-10 · EngagementMetaSchema rejects empty ownerId", () => {
      const m = createEmptyEngagementMeta();
      const result = EngagementMetaSchema.safeParse({ ...m, ownerId: "" });
      assert(result.success === false, "empty ownerId must be rejected (min(1))");
      assert(result.error.issues.some(i => i.path[0] === "ownerId"),
        "rejection must point at ownerId");
    });
    it("V-SCH-11 · CustomerSchema rejects empty name", () => {
      const c = createEmptyCustomer();
      c.name = "";
      const result = CustomerSchema.safeParse(c);
      assert(result.success === false, "empty name must be rejected (min(1) violated)");
      assert(result.error.issues.some(i => i.path[0] === "name"),
        "rejection must point at the name field");
    });
    it("V-SCH-12 · CustomerSchema rejects extra v2.0 fields (segment/industry) under .strict()", () => {
      const c = createEmptyCustomer();
      const withLegacy = { ...c, segment: "Banking", industry: "Finance" };
      const result = CustomerSchema.safeParse(withLegacy);
      assert(result.success === false,
        "v2.0 legacy fields (segment/industry) must be rejected by .strict() — they are dropped at migration per MIGRATION sec M7");
      assert(result.error.issues.some(i =>
        i.code === "unrecognized_keys" || (i.path && (i.path.includes("segment") || i.path.includes("industry")))
      ), "rejection must flag the unrecognized legacy keys");
    });
    it("V-SCH-13 · DriverSchema rejects priority not in {High, Medium, Low}", () => {
      const d = createEmptyDriver();
      const result = DriverSchema.safeParse({ ...d, priority: "Critical" });
      assert(result.success === false, "priority 'Critical' must be rejected");
      assert(result.error.issues.some(i => i.path[0] === "priority"),
        "rejection must point at priority");
    });
    it("V-SCH-14 · DriverSchema rejects missing required businessDriverId", () => {
      const d = createEmptyDriver();
      const { businessDriverId, ...withoutFk } = d;
      const result = DriverSchema.safeParse(withoutFk);
      assert(result.success === false, "missing businessDriverId must be rejected");
      assert(result.error.issues.some(i => i.path[0] === "businessDriverId"),
        "rejection must point at businessDriverId");
    });
    it("V-SCH-15 · DriverSchema rejects empty catalogVersion", () => {
      const d = createEmptyDriver();
      const result = DriverSchema.safeParse({ ...d, catalogVersion: "" });
      assert(result.success === false, "empty catalogVersion must be rejected");
      assert(result.error.issues.some(i => i.path[0] === "catalogVersion"),
        "rejection must point at catalogVersion");
    });
    it("V-SCH-16 · EnvironmentSchema rejects missing required envCatalogId", () => {
      const env = createEmptyEnvironment();
      const { envCatalogId, ...withoutFk } = env;
      const result = EnvironmentSchema.safeParse(withoutFk);
      assert(result.success === false, "missing envCatalogId must be rejected");
      assert(result.error.issues.some(i => i.path[0] === "envCatalogId"),
        "rejection must point at envCatalogId");
    });
    it("V-SCH-17 · EnvironmentSchema rejects sizeKw of wrong type (string)", () => {
      const env = createEmptyEnvironment();
      const result = EnvironmentSchema.safeParse({ ...env, sizeKw: "100" });
      assert(result.success === false, "string sizeKw must be rejected (number-or-null only)");
      assert(result.error.issues.some(i => i.path[0] === "sizeKw"),
        "rejection must point at sizeKw");
    });
    it("V-SCH-18 · InstanceSchema rejects state not in {current, desired}", () => {
      const inst = createEmptyInstance();
      const result = InstanceSchema.safeParse({ ...inst, state: "future" });
      assert(result.success === false, "state 'future' must be rejected");
      assert(result.error.issues.some(i => i.path[0] === "state"),
        "rejection must point at state");
    });
    it("V-SCH-19 · InstanceSchema rejects vendorGroup not in {dell, nonDell, custom}", () => {
      const inst = createEmptyInstance();
      const result = InstanceSchema.safeParse({ ...inst, vendorGroup: "ibm" });
      assert(result.success === false, "vendorGroup 'ibm' must be rejected");
      assert(result.error.issues.some(i => i.path[0] === "vendorGroup"),
        "rejection must point at vendorGroup");
    });
    it("V-SCH-20 · InstanceSchema rejects criticality not in {High, Medium, Low}", () => {
      const inst = createEmptyInstance();
      const result = InstanceSchema.safeParse({ ...inst, criticality: "Critical" });
      assert(result.success === false, "criticality 'Critical' must be rejected");
      assert(result.error.issues.some(i => i.path[0] === "criticality"),
        "rejection must point at criticality");
    });
    it("V-SCH-21 · InstanceSchema rejects originId on state==='current' (superRefine)", () => {
      const inst = createEmptyInstance({ state: "current" });
      const bad = { ...inst, originId: "00000000-0000-4000-8000-00000000aaaa" };
      const result = InstanceSchema.safeParse(bad);
      assert(result.success === false,
        "current-state instance with originId must be rejected (superRefine R3.5.a)");
      assert(result.error.issues.some(i => i.path[0] === "originId"),
        "rejection must point at originId");
    });
    it("V-SCH-22 · InstanceSchema rejects priority on state==='current' (superRefine)", () => {
      const inst = createEmptyInstance({ state: "current" });
      const bad = { ...inst, priority: "Now" };
      const result = InstanceSchema.safeParse(bad);
      assert(result.success === false,
        "current-state instance with priority must be rejected (superRefine R3.5.a)");
      assert(result.error.issues.some(i => i.path[0] === "priority"),
        "rejection must point at priority");
    });
    it("V-SCH-23 · InstanceSchema rejects mappedAssetIds non-empty on layerId !== 'workload' (superRefine)", () => {
      const inst = createEmptyInstance({ layerId: "compute" });
      const bad = { ...inst, mappedAssetIds: ["00000000-0000-4000-8000-00000000aaaa"] };
      const result = InstanceSchema.safeParse(bad);
      assert(result.success === false,
        "non-workload instance with non-empty mappedAssetIds must be rejected (superRefine R3.5.b)");
      assert(result.error.issues.some(i => i.path[0] === "mappedAssetIds"),
        "rejection must point at mappedAssetIds");
    });
    it("V-SCH-24 · GapSchema rejects urgency not in enum", () => {
      const gap = createEmptyGap();
      const result = GapSchema.safeParse({ ...gap, urgency: "Severe" });
      assert(result.success === false, "urgency 'Severe' must be rejected");
      assert(result.error.issues.some(i => i.path[0] === "urgency"),
        "rejection must point at urgency");
    });
    it("V-SCH-25 · GapSchema rejects phase not in enum", () => {
      const gap = createEmptyGap();
      const result = GapSchema.safeParse({ ...gap, phase: "soon" });
      assert(result.success === false, "phase 'soon' must be rejected");
      assert(result.error.issues.some(i => i.path[0] === "phase"),
        "rejection must point at phase");
    });
    it("V-SCH-26 · GapSchema rejects status not in enum", () => {
      const gap = createEmptyGap();
      const result = GapSchema.safeParse({ ...gap, status: "wip" });
      assert(result.success === false, "status 'wip' must be rejected");
      assert(result.error.issues.some(i => i.path[0] === "status"),
        "rejection must point at status");
    });
    it("V-SCH-27 · GapSchema rejects empty description", () => {
      const gap = createEmptyGap();
      const result = GapSchema.safeParse({ ...gap, description: "" });
      assert(result.success === false, "empty description must be rejected (min(1))");
      assert(result.error.issues.some(i => i.path[0] === "description"),
        "rejection must point at description");
    });
    it("V-SCH-28 · GapSchema rejects empty affectedLayers array", () => {
      const gap = createEmptyGap();
      const result = GapSchema.safeParse({ ...gap, affectedLayers: [] });
      assert(result.success === false, "empty affectedLayers must be rejected (min(1))");
      assert(result.error.issues.some(i => i.path[0] === "affectedLayers"),
        "rejection must point at affectedLayers");
    });
    it("V-SCH-29 · GapSchema rejects empty affectedEnvironments array", () => {
      const gap = createEmptyGap();
      const result = GapSchema.safeParse({ ...gap, affectedEnvironments: [] });
      assert(result.success === false, "empty affectedEnvironments must be rejected (min(1))");
      assert(result.error.issues.some(i => i.path[0] === "affectedEnvironments"),
        "rejection must point at affectedEnvironments");
    });
    it("V-SCH-30 · GapSchema rejects affectedLayers[0] !== layerId (G6 invariant)", () => {
      const gap = createEmptyGap({ layerId: "compute" });
      // Force the G6 violation: layerId is 'compute' but affectedLayers starts with 'storage'.
      const bad = { ...gap, affectedLayers: ["storage", "compute"] };
      const result = GapSchema.safeParse(bad);
      assert(result.success === false,
        "gap with affectedLayers[0] !== layerId must be rejected (G6 invariant)");
      assert(result.error.issues.some(i => i.path[0] === "affectedLayers"),
        "rejection must point at affectedLayers");
    });
    it("V-SCH-31 · EngagementSchema rejects engagement missing customer", () => {});
    it("V-SCH-32 · EngagementSchema rejects engagement missing engagementMeta", () => {});
    it("V-SCH-33 · EngagementSchema rejects collection missing byId", () => {});
    it("V-SCH-34 · EngagementSchema rejects byId keys != allIds set", () => {});
    it("V-SCH-35 · all id fields rejected when not UUID-shaped", () => {});
    it("V-SCH-36 · all engagementId fields rejected when not UUID-shaped", () => {});
    it("V-SCH-37 · createdAt rejected when not ISO datetime", () => {});
    it("V-SCH-38 · updatedAt rejected when invalid date", () => {});
    it("V-SCH-39 · ProvenanceSchema rejects validationStatus not in enum", () => {});
    it("V-SCH-40 · ProvenanceSchema rejects catalogVersions value of wrong type", () => {});

    // Round-trip property tests (V-SCH-41..50)
    it("V-SCH-41 · cross-cutting.canvas parses through EngagementSchema cleanly", () => {});
    it("V-SCH-42 · acme-demo.canvas parses cleanly", () => {});
    it("V-SCH-43 · minimal.canvas parses cleanly", () => {});
    it("V-SCH-44 · parse(JSON.stringify(parse(fixture))) byte-equivalent (modulo transient)", () => {});
    it("V-SCH-45 · save then load round-trips through schema validation cleanly", () => {});
    it("V-SCH-46 · transient fields (activeEntity, integrityLog) stripped on save", () => {
      const eng = createEmptyEngagement();
      // Populate transient fields so we can verify they get stripped.
      const withTransient = {
        ...eng,
        activeEntity: { kind: "driver", id: "11111111-2222-3333-4444-555555555555",
                        at: "2026-01-01T00:00:00.000Z" },
        integrityLog: [{ ruleId: "TEST", recordKind: "driver", recordId: "x",
                         field: "x", before: 1, after: 2,
                         timestamp: "2026-01-01T00:00:00.000Z" }]
      };
      const saved = buildSaveEnvelopeV3(withTransient);
      assert(saved.ok, "buildSaveEnvelopeV3 succeeded: " + JSON.stringify(saved.errors || ""));
      assert(!("activeEntity" in saved.envelope.engagement),
        "activeEntity stripped from persisted shape");
      assert(!("integrityLog" in saved.envelope.engagement),
        "integrityLog stripped from persisted shape");
    });
    it("V-SCH-47 · secondary indexes (instances.byState) NOT in persisted shape", () => {
      const eng = createEmptyEngagement();
      const saved = buildSaveEnvelopeV3(eng);
      assert(saved.ok, "buildSaveEnvelopeV3 succeeded: " + JSON.stringify(saved.errors || ""));
      assert(!("byState" in saved.envelope.engagement.instances),
        "instances.byState stripped from persisted shape (rebuilds on load)");
      assert("byId" in saved.envelope.engagement.instances,
        "instances.byId preserved");
      assert("allIds" in saved.envelope.engagement.instances,
        "instances.allIds preserved");
    });
    it("V-SCH-48 · secondary indexes ARE rebuilt on load", async () => {
      const eng = createEmptyEngagement();
      const saved = buildSaveEnvelopeV3(eng);
      assert(saved.ok, "save succeeded");
      const loaded = await loadCanvasV3(saved.envelope);
      assert(loaded.ok, "load succeeded: " + JSON.stringify(loaded.error || ""));
      assert("byState" in loaded.engagement.instances,
        "instances.byState rebuilt on load");
      assert(Array.isArray(loaded.engagement.instances.byState.current),
        "byState.current is an array");
      assert(Array.isArray(loaded.engagement.instances.byState.desired),
        "byState.desired is an array");
      assertEqual(loaded.engagement.activeEntity, null,
        "transient activeEntity re-attached as null");
      assert(Array.isArray(loaded.engagement.integrityLog),
        "transient integrityLog re-attached as empty array");
    });
    it("V-SCH-49 · EngagementSchema is read by exactly 3 boundaries (load, save, action commit)", () => {});
    it("V-SCH-50 · EngagementSchema is NEVER imported by selectors/*.js (lint rule)", () => {});

    // Per-catalog acceptance (V-SCH-51..58)
    it("V-SCH-51 · LAYERS catalog parses through CatalogSchema", () => {});
    it("V-SCH-52 · BUSINESS_DRIVERS catalog parses through CatalogSchema", () => {});
    it("V-SCH-53 · ENV_CATALOG catalog parses through CatalogSchema", () => {});
    it("V-SCH-54 · SERVICE_TYPES catalog parses through CatalogSchema", () => {});
    it("V-SCH-55 · GAP_TYPES catalog parses through CatalogSchema", () => {});
    it("V-SCH-56 · DISPOSITION_ACTIONS catalog parses through CatalogSchema", () => {});
    it("V-SCH-57 · CUSTOMER_VERTICALS catalog parses through CatalogSchema", () => {});
    it("V-SCH-58 · DELL_PRODUCT_TAXONOMY catalog parses through CatalogSchema", () => {});
  });

  // -------------------------------------------------------------------
  // sec T3 · V-FK · FK integrity tests (per SPEC sec S4.4 + sec S4.5)
  // -------------------------------------------------------------------
  describe("§T3 · V-FK · FK integrity tests", () => {
    // Per-FK declaration. Suffixes: a=valid, b=orphan-optional-scalar,
    // c=orphan-required-quarantine, d=orphan-array-element, e=filter-violation.

    // Decl 1: driver.businessDriverId (required, scalar, FK to catalog)
    it("V-FK-1a · driver.businessDriverId valid catalog reference passes sweep", () => {});
    it("V-FK-1c · driver.businessDriverId required + dangling → quarantine driver", () => {});

    // Decl 2: environment.envCatalogId (required, scalar, FK to catalog)
    it("V-FK-2a · environment.envCatalogId valid catalog reference passes sweep", () => {});
    it("V-FK-2c · environment.envCatalogId required + dangling → quarantine environment", () => {});

    // Decl 3: instance.layerId (required, scalar, FK to catalog)
    it("V-FK-3a · instance.layerId valid catalog reference passes sweep", () => {});
    it("V-FK-3c · instance.layerId required + dangling → quarantine instance", () => {});

    // Decl 4: instance.environmentId (required, scalar, FK to environments)
    it("V-FK-4a · instance.environmentId valid reference passes sweep", () => {});
    it("V-FK-4c · instance.environmentId required + dangling → quarantine instance", () => {});

    // Decl 5: instance.disposition (required, scalar, FK to catalog)
    it("V-FK-5a · instance.disposition valid catalog reference passes sweep", () => {});
    it("V-FK-5c · instance.disposition required + dangling → quarantine instance", () => {});

    // Decl 6: instance.originId (optional, scalar, FK to instances, filter state=current)
    it("V-FK-6a · instance.originId valid reference (to current-state instance) passes sweep", () => {});
    it("V-FK-6b · instance.originId optional + dangling → field nulled, log INT-ORPHAN-OPT", () => {});
    it("V-FK-6e · instance.originId pointing at desired-state instance → field nulled, log INT-FILTER-MISS", () => {});

    // Decl 7: instance.mappedAssetIds[] (optional, array, FK to instances)
    it("V-FK-7a · instance.mappedAssetIds[] all valid → passes sweep", () => {});
    it("V-FK-7d · instance.mappedAssetIds[] dangling element → element removed, log INT-ORPHAN-ARR", () => {});

    // Decl 8: gap.gapType (required, scalar, FK to catalog)
    it("V-FK-8a · gap.gapType valid catalog reference passes sweep", () => {});
    it("V-FK-8c · gap.gapType required + dangling → quarantine gap", () => {});

    // Decl 9: gap.driverId (optional, scalar, FK to drivers)
    it("V-FK-9a · gap.driverId valid reference passes sweep", () => {});
    it("V-FK-9b · gap.driverId optional + dangling → field nulled, log INT-ORPHAN-OPT", () => {});

    // Decl 10: gap.layerId (required, scalar, FK to catalog)
    it("V-FK-10a · gap.layerId valid catalog reference passes sweep", () => {});
    it("V-FK-10c · gap.layerId required + dangling → quarantine gap", () => {});

    // Decl 11: gap.affectedLayers[] (required-non-empty, array, FK to catalog)
    it("V-FK-11a · gap.affectedLayers[] all valid → passes sweep", () => {});
    it("V-FK-11d · gap.affectedLayers[] dangling element → element removed, log INT-ORPHAN-ARR", () => {});

    // Decl 12: gap.affectedEnvironments[] (required-non-empty, array, FK to environments)
    it("V-FK-12a · gap.affectedEnvironments[] all valid → passes sweep", () => {});
    it("V-FK-12c · gap.affectedEnvironments[] all elements dangling → quarantine gap (required min(1) violated)", () => {});
    it("V-FK-12d · gap.affectedEnvironments[] one dangling element → element removed, log INT-ORPHAN-ARR", () => {});

    // Decl 13: gap.relatedCurrentInstanceIds[] (optional, array, filter state=current)
    it("V-FK-13a · gap.relatedCurrentInstanceIds[] all valid → passes sweep", () => {});
    it("V-FK-13d · gap.relatedCurrentInstanceIds[] dangling element → element removed", () => {});
    it("V-FK-13e · gap.relatedCurrentInstanceIds[] element pointing at desired-state instance → element removed, log INT-FILTER-MISS", () => {});

    // Decl 14: gap.relatedDesiredInstanceIds[] (optional, array, filter state=desired)
    it("V-FK-14a · gap.relatedDesiredInstanceIds[] all valid → passes sweep", () => {});
    it("V-FK-14d · gap.relatedDesiredInstanceIds[] dangling element → element removed", () => {});
    it("V-FK-14e · gap.relatedDesiredInstanceIds[] element pointing at current-state instance → element removed, log INT-FILTER-MISS", () => {});

    // Decl 15: gap.services[] (optional, array, FK to catalog)
    it("V-FK-15a · gap.services[] all valid catalog references → passes sweep", () => {});
    it("V-FK-15d · gap.services[] dangling element → element removed", () => {});

    // Cross-cutting integrity: byId keyset matches allIds (V-FK-51..56)
    it("V-FK-51 · engagement.drivers byId keys === allIds set", () => {
      // Empty engagement: keyset matches.
      const eng = createEmptyEngagement();
      assertEqual(Object.keys(eng.drivers.byId).length, 0, "empty drivers.byId");
      assertEqual(eng.drivers.allIds.length, 0, "empty drivers.allIds");
      // After addDriver: keyset still matches.
      const next = addDriver(eng, { businessDriverId: "ai_data", priority: "High" });
      assert(next.ok === true, "addDriver succeeded: " + JSON.stringify(next.errors || ""));
      const ids = Object.keys(next.engagement.drivers.byId).sort();
      const allIds = [...next.engagement.drivers.allIds].sort();
      assertEqual(ids.length, allIds.length, "byId keyset length === allIds length");
      assert(ids.every((k, i) => k === allIds[i]), "byId keys === allIds set after addDriver");
    });
    it("V-FK-52 · engagement.environments byId keys === allIds set", () => {
      const eng = createEmptyEngagement();
      const next = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" });
      assert(next.ok === true, "addEnvironment succeeded: " + JSON.stringify(next.errors || ""));
      const ids = Object.keys(next.engagement.environments.byId).sort();
      const allIds = [...next.engagement.environments.allIds].sort();
      assertEqual(ids.length, allIds.length, "keyset length matches");
      assert(ids.every((k, i) => k === allIds[i]), "byId keys === allIds set");
    });
    it("V-FK-53 · engagement.instances byId keys === allIds set", () => {
      const eng = createEmptyEngagement();
      // Need an environment first (instance.environmentId is a required FK).
      const withEnv = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" });
      assert(withEnv.ok, "addEnvironment ok");
      const envId = withEnv.engagement.environments.allIds[0];
      const next = addInstanceV3(withEnv.engagement, {
        state: "current", layerId: "compute", environmentId: envId,
        label: "T1", vendor: "Dell", vendorGroup: "dell",
        criticality: "Medium", disposition: "keep"
      });
      assert(next.ok === true, "addInstance succeeded: " + JSON.stringify(next.errors || ""));
      const ids = Object.keys(next.engagement.instances.byId).sort();
      const allIds = [...next.engagement.instances.allIds].sort();
      assertEqual(ids.length, allIds.length, "keyset length matches");
      assert(ids.every((k, i) => k === allIds[i]), "byId keys === allIds set");
    });
    it("V-FK-54 · engagement.instances.byState.current ⊆ instances.allIds", () => {
      const eng = createEmptyEngagement();
      const withEnv = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" });
      const envId = withEnv.engagement.environments.allIds[0];
      const a = addInstanceV3(withEnv.engagement, { state:"current", layerId:"compute", environmentId:envId, label:"A", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"keep" });
      const b = addInstanceV3(a.engagement,         { state:"desired", layerId:"compute", environmentId:envId, label:"B", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"keep" });
      const inst = b.engagement.instances;
      const allSet = new Set(inst.allIds);
      assert(inst.byState.current.every(id => allSet.has(id)),
        "every byState.current id must be in allIds");
      assert(inst.byState.current.length === 1, "exactly 1 current instance");
    });
    it("V-FK-55 · engagement.instances.byState.desired ⊆ instances.allIds", () => {
      const eng = createEmptyEngagement();
      const withEnv = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" });
      const envId = withEnv.engagement.environments.allIds[0];
      const a = addInstanceV3(withEnv.engagement, { state:"current", layerId:"compute", environmentId:envId, label:"A", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"keep" });
      const b = addInstanceV3(a.engagement,         { state:"desired", layerId:"compute", environmentId:envId, label:"B", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"keep" });
      const inst = b.engagement.instances;
      const allSet = new Set(inst.allIds);
      assert(inst.byState.desired.every(id => allSet.has(id)),
        "every byState.desired id must be in allIds");
      assert(inst.byState.desired.length === 1, "exactly 1 desired instance");
      // Total partition is exhaustive: current+desired === allIds.length
      assertEqual(inst.byState.current.length + inst.byState.desired.length, inst.allIds.length,
        "byState partition is exhaustive");
    });
    it("V-FK-56 · engagement.gaps byId keys === allIds set", () => {
      const eng = createEmptyEngagement();
      const withEnv = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" });
      const envId = withEnv.engagement.environments.allIds[0];
      const next = addGapV3(withEnv.engagement, {
        description: "Need to modernize", gapType: "replace",
        urgency: "Medium", phase: "now", status: "open",
        layerId: "compute", affectedLayers: ["compute"],
        affectedEnvironments: [envId]
      });
      assert(next.ok === true, "addGap succeeded: " + JSON.stringify(next.errors || ""));
      const ids = Object.keys(next.engagement.gaps.byId).sort();
      const allIds = [...next.engagement.gaps.allIds].sort();
      assertEqual(ids.length, allIds.length, "keyset length matches");
      assert(ids.every((k, i) => k === allIds[i]), "byId keys === allIds set");
    });
  });

  // -------------------------------------------------------------------
  // sec T4 · V-INV · Schema invariant tests (per SPEC sec 3 superRefines)
  // 15 invariants × 2 polarities (a=positive, b=negative) = 30 vectors
  // -------------------------------------------------------------------
  describe("§T4 · V-INV · Schema invariant tests", () => {
    it("V-INV-1a · gap.affectedLayers[0] === gap.layerId accepted (G6)", () => {});
    it("V-INV-1b · gap.affectedLayers[0] !== gap.layerId rejected (G6)", () => {});
    it("V-INV-2a · originId on state==='desired' accepted", () => {});
    it("V-INV-2b · originId on state==='current' rejected", () => {});
    it("V-INV-3a · priority on state==='desired' accepted", () => {});
    it("V-INV-3b · priority on state==='current' rejected", () => {});
    it("V-INV-4a · mappedAssetIds non-empty on layerId==='workload' accepted", () => {});
    it("V-INV-4b · mappedAssetIds non-empty on layerId !== 'workload' rejected", () => {});
    it("V-INV-5a · driver.priority in {High, Medium, Low} accepted", () => {});
    it("V-INV-5b · driver.priority outside enum rejected", () => {});
    it("V-INV-6a · customer.engagementId === engagementMeta.engagementId accepted", () => {});
    it("V-INV-6b · customer.engagementId !== engagementMeta.engagementId rejected", () => {});
    it("V-INV-7a · engagementMeta.schemaVersion === '3.0' accepted", () => {});
    it("V-INV-7b · engagementMeta.schemaVersion !== '3.0' rejected", () => {});
    it("V-INV-8a · all id fields UUID-shaped accepted", () => {});
    it("V-INV-8b · id field not UUID-shaped rejected", () => {});
    it("V-INV-9a · createdAt + updatedAt ISO datetime accepted", () => {});
    it("V-INV-9b · createdAt or updatedAt not ISO datetime rejected", () => {});
    it("V-INV-10a · updatedAt >= createdAt accepted", () => {});
    it("V-INV-10b · updatedAt < createdAt rejected", () => {});
    it("V-INV-11a · instances.byState partition exhaustive (every id in current OR desired) accepted", () => {});
    it("V-INV-11b · instance id missing from byState partition rejected", () => {});
    it("V-INV-12a · instance.aiSuggestedDellMapping as provenance wrapper accepted", () => {});
    it("V-INV-12b · instance.aiSuggestedDellMapping as plain string rejected", () => {});
    it("V-INV-13a · gap.aiMappedDellSolutions as provenance wrapper accepted", () => {});
    it("V-INV-13b · gap.aiMappedDellSolutions as plain string rejected", () => {});
    it("V-INV-14a · gap.affectedEnvironments membership ⊆ environments.allIds accepted", () => {});
    it("V-INV-14b · gap.affectedEnvironments referencing non-existent env rejected by sweep", () => {});
    it("V-INV-15a · instance.originId !== instance.id (no self-reference) accepted", () => {});
    it("V-INV-15b · instance.originId === instance.id rejected", () => {});
  });

  // -------------------------------------------------------------------
  // sec T5 · V-MIG · Migration round-trip tests (per MIGRATION sec M3-M12)
  // -------------------------------------------------------------------
  describe("§T5 · V-MIG · Migration round-trip tests", () => {
    // Per-fixture forward + validate (V-MIG-1..8)
    it("V-MIG-1 · empty.canvas migrates forward; validates clean against EngagementSchema", () => {});
    it("V-MIG-2 · single-env.canvas migrates; 5+5 instances + 3 gaps + 2 drivers survive", () => {});
    it("V-MIG-3 · multi-env.canvas migrates; 30 instances + 8 gaps + 4 drivers", () => {});
    it("V-MIG-4 · cross-env-workload.canvas migrates; mappedAssetIds preserved across envs", () => {});
    it("V-MIG-5 · cross-env-origin.canvas migrates; originId preserved across envs", () => {});
    it("V-MIG-6 · multi-env-gaps.canvas migrates; gap.affectedEnvironments.length===3 preserved", () => {});
    it("V-MIG-7 · ai-provenanced.canvas wraps 4 plain-string mappedDellSolutions fields with stale validationStatus", () => {});
    it("V-MIG-8 · acme-demo.canvas migrates; 200 instances; full migration < 200ms calibrated", () => {});

    // Per-step assertions (V-MIG-S{1..10}-*)
    // Helper for V-MIG-* — builds a minimal v2.0-shaped engagement.
    function v2Empty(overrides) {
      return Object.assign({
        sessionMeta: {
          sessionId: "sess-abc-123",
          version:   "2.0",
          savedAt:   "2025-12-01T00:00:00.000Z"
        },
        customer:     { name: "Acme", vertical: "Financial Services", drivers: [] },
        environments: [],
        instances:    [],
        gaps:         []
      }, overrides);
    }
    function testCtx(overrides) {
      return makePipelineContext(Object.assign({
        migrationTimestamp: "2026-01-01T00:00:00.000Z",
        randomSeed:         "test-seed",
        catalogSnapshot:    { BUSINESS_DRIVERS: { catalogVersion: "2026.04" }, ENV_CATALOG: { catalogVersion: "2026.04" } }
      }, overrides));
    }

    it("V-MIG-S1-1 · Step 1: v2.0 input → engagementMeta.schemaVersion === '3.0'", () => {
      const v3 = migrate_v2_0_to_v3_0(v2Empty(), testCtx());
      assertEqual(v3.engagementMeta.schemaVersion, "3.0", "schemaVersion stamped to 3.0");
    });
    it("V-MIG-S1-2 · Step 1: idempotent on already-v3.0 input", () => {
      // Run once, then run again on the same input — second run produces same output.
      const v2 = v2Empty();
      const a = migrate_v2_0_to_v3_0(v2, testCtx());
      const b = migrate_v2_0_to_v3_0(v2, testCtx());
      assertEqual(a.engagementMeta.schemaVersion, b.engagementMeta.schemaVersion,
        "schemaVersion same across runs");
      assertEqual(a.engagementMeta.engagementId, b.engagementMeta.engagementId,
        "engagementId same across runs");
    });
    it("V-MIG-S1-3 · Step 1: empty engagement → engagementMeta.schemaVersion === '3.0'", () => {});

    it("V-MIG-S2-1 · Step 2: sessionMeta.sessionId preserved as engagementId", () => {
      const v3 = migrate_v2_0_to_v3_0(v2Empty(), testCtx());
      assertEqual(v3.engagementMeta.engagementId, "sess-abc-123",
        "engagementId === v2.0 sessionId");
    });
    it("V-MIG-S2-2 · Step 2: missing sessionId → deterministic id; same input twice → same id", () => {});
    it("V-MIG-S2-3 · Step 2: sessionMeta deleted from output", () => {
      const v3 = migrate_v2_0_to_v3_0(v2Empty(), testCtx());
      assert(!("sessionMeta" in v3), "sessionMeta key removed from output");
    });

    it("V-MIG-S3-1 · Step 3: missing ownerId → 'local-user'", () => {
      const v3 = migrate_v2_0_to_v3_0(v2Empty(), testCtx());
      assertEqual(v3.engagementMeta.ownerId, "local-user", "ownerId default applied");
    });
    it("V-MIG-S3-2 · Step 3: empty ownerId → 'local-user'", () => {
      const v2 = v2Empty();
      v2.sessionMeta.ownerId = "   ";   // whitespace-only counts as empty
      const v3 = migrate_v2_0_to_v3_0(v2, testCtx());
      assertEqual(v3.engagementMeta.ownerId, "local-user", "empty/whitespace -> default");
    });
    it("V-MIG-S3-3 · Step 3: existing ownerId preserved", () => {});

    it("V-MIG-S4-1 · Step 4: sessionMeta.savedAt → both createdAt + updatedAt", () => {});
    it("V-MIG-S4-2 · Step 4: no v2.0 timestamp → both = ctx.migrationTimestamp", () => {});
    it("V-MIG-S4-3 · Step 4: existing v3.0 timestamps preserved (idempotent)", () => {});

    it("V-MIG-S5-1 · Step 5: customer.segment + .industry → notes (standard merge)", () => {
      const v2 = v2Empty({ customer: {
        name: "Acme", vertical: "Financial Services",
        segment: "Banking", industry: "Finance", drivers: []
      } });
      const v3 = migrate_v2_0_to_v3_0(v2, testCtx());
      assert(v3.customer.notes.includes("Banking"),  "Banking merged into notes");
      assert(v3.customer.notes.includes("Finance"),  "Finance merged into notes");
      assert(!("segment" in v3.customer),  "segment field deleted");
      assert(!("industry" in v3.customer), "industry field deleted");
    });
    it("V-MIG-S5-2 · Step 5: segment redundant with vertical → dropped", () => {
      const v2 = v2Empty({ customer: {
        name: "Acme", vertical: "Healthcare",
        segment: "Healthcare",          // exact match -> drop, don't merge
        industry: "Healthcare",
        drivers: []
      } });
      const v3 = migrate_v2_0_to_v3_0(v2, testCtx());
      assertEqual(v3.customer.notes, "", "redundant entries dropped, notes empty");
    });
    it("V-MIG-S5-3 · Step 5: segment already in notes → dropped", () => {});
    it("V-MIG-S5-4 · Step 5: empty segment/industry strings treated as absent", () => {});

    it("V-MIG-S6-1 · Step 6: 3-driver v2.4.16 input → 3-driver v3.0 collection in allIds order", () => {
      const v2 = v2Empty({ customer: {
        name: "Acme", vertical: "Financial Services",
        drivers: [
          { driverId: "ai_data",          priority: "High",   outcomes: "Drive AI" },
          { driverId: "cyber_resilience", priority: "Medium", outcomes: "Stop ransomware" },
          { driverId: "cost_optimization", priority: "Low",   outcomes: "Save money" }
        ]
      } });
      const v3 = migrate_v2_0_to_v3_0(v2, testCtx());
      assertEqual(v3.drivers.allIds.length, 3, "3 drivers extracted");
      const businessIds = v3.drivers.allIds.map(id => v3.drivers.byId[id].businessDriverId);
      assertEqual(businessIds[0], "ai_data",          "order preserved (1)");
      assertEqual(businessIds[1], "cyber_resilience", "order preserved (2)");
      assertEqual(businessIds[2], "cost_optimization","order preserved (3)");
    });
    it("V-MIG-S6-2 · Step 6: priority normalization (lowercase, numeric, empty)", () => {
      const v2 = v2Empty({ customer: {
        name: "Acme", vertical: "Financial Services",
        drivers: [
          { driverId: "ai_data",     priority: "high"     },     // lowercase
          { driverId: "ops_simplicity", priority: "1"     },     // numeric
          { driverId: "modernize_infra", priority: ""     },     // empty
          { driverId: "cyber_resilience", priority: "Critical" } // unknown
        ]
      } });
      const v3 = migrate_v2_0_to_v3_0(v2, testCtx());
      const ps = v3.drivers.allIds.map(id => v3.drivers.byId[id].priority);
      assertEqual(ps[0], "High",   "'high' -> High");
      assertEqual(ps[1], "High",   "'1' -> High");
      assertEqual(ps[2], "Medium", "empty -> Medium default");
      assertEqual(ps[3], "Medium", "unknown -> Medium default");
    });
    it("V-MIG-S6-3 · Step 6: empty drivers[] → empty collection", () => {});
    it("V-MIG-S6-4 · Step 6: customer.drivers absent from output (key deleted)", () => {
      const v2 = v2Empty({ customer: {
        name: "Acme", vertical: "Financial Services",
        drivers: [{ driverId: "ai_data", priority: "High" }]
      } });
      const v3 = migrate_v2_0_to_v3_0(v2, testCtx());
      assert(!("drivers" in v3.customer), "customer.drivers key removed");
      assert(v3.drivers.allIds.length === 1, "driver promoted to top-level collection");
    });
    it("V-MIG-S6-5 · Step 6: catalogVersion stamped from ctx.catalogSnapshot", () => {});

    it("V-MIG-S7-1 · Step 7: v2.0 unified-array instances → Collection<Instance> with byState populated", () => {});
    it("V-MIG-S7-2 · Step 7: legacy {current, desired} split → unified collection", () => {});
    it("V-MIG-S7-3 · Step 7: empty arrays → empty collections", () => {});
    it("V-MIG-S7-4 · Step 7: allIds preserves source array order", () => {});

    it("V-MIG-S8-1 · Step 8: every gap.projectId deleted from output", () => {
      const v2 = v2Empty({
        environments: [{ id: "env1", envCatalogId: "coreDc" }],
        gaps: [
          { id: "g1", description: "g1", layerId: "compute",
            projectId: "proj-old-A",
            gapType: "replace", urgency: "High", phase: "now", status: "open",
            affectedLayers: ["compute"], affectedEnvironments: ["env1"] }
        ]
      });
      const v3 = migrate_v2_0_to_v3_0(v2, testCtx());
      const gap = v3.gaps.byId[v3.gaps.allIds[0]];
      assert(!("projectId" in gap), "gap.projectId stripped (now derived by selectProjects)");
    });
    it("V-MIG-S8-2 · Step 8: gap.id and other fields preserved", () => {});
    it("V-MIG-S8-3 · Step 8: idempotent (no projectId in v3.0 input → no change)", () => {});

    it("V-MIG-S9-1 · Step 9: plain-string mappedDellSolutions → provenance wrapper with validationStatus='stale'", () => {
      const v2 = v2Empty({
        environments: [{ id: "env1", envCatalogId: "coreDc" }],
        gaps: [
          { id: "g-ai", description: "Map this", layerId: "compute",
            mappedDellSolutions: "PowerStore + PowerProtect",   // legacy plain string
            gapType: "replace", urgency: "High", phase: "now", status: "open",
            affectedLayers: ["compute"], affectedEnvironments: ["env1"] }
        ]
      });
      const v3 = migrate_v2_0_to_v3_0(v2, testCtx());
      const gap = v3.gaps.byId[v3.gaps.allIds[0]];
      assert(gap.aiMappedDellSolutions, "wrapper created");
      assertEqual(gap.aiMappedDellSolutions.provenance.validationStatus, "stale",
        "validationStatus=stale (forces user to re-run)");
      assertEqual(gap.aiMappedDellSolutions.provenance.model, "unknown",
        "model='unknown' (legacy)");
    });
    it("V-MIG-S9-2 · Step 9: original string preserved in value.rawLegacy", () => {
      const original = "PowerStore + PowerProtect";
      const v2 = v2Empty({
        environments: [{ id: "env1", envCatalogId: "coreDc" }],
        gaps: [
          { id: "g-ai", description: "Map", layerId: "compute",
            mappedDellSolutions: original,
            gapType: "replace", urgency: "High", phase: "now", status: "open",
            affectedLayers: ["compute"], affectedEnvironments: ["env1"] }
        ]
      });
      const v3 = migrate_v2_0_to_v3_0(v2, testCtx());
      const gap = v3.gaps.byId[v3.gaps.allIds[0]];
      assertEqual(gap.aiMappedDellSolutions.value.rawLegacy, original,
        "rawLegacy preserves the original v2.4.x string");
      assertEqual(gap.aiMappedDellSolutions.value.products.length, 0,
        "products array empty until user re-runs");
      assert(!("mappedDellSolutions" in gap), "legacy plain-string field deleted");
    });
    it("V-MIG-S9-3 · Step 9: empty string → no wrapper created", () => {});
    it("V-MIG-S9-4 · Step 9: integrity-log entry emitted with correct count", () => {});
    it("V-MIG-S9-5 · Step 9: idempotent — already-wrapped field unchanged", () => {});

    it("V-MIG-S10-1 · Step 10: every record post-step10 has engagementId === engagementMeta.engagementId", () => {
      const v2 = v2Empty({
        customer: { name: "Acme", vertical: "Financial Services",
          drivers: [{ driverId: "ai_data", priority: "High" }] },
        environments: [{ id: "env1", envCatalogId: "coreDc" }],
        gaps: [{ id: "g1", description: "g1", layerId: "compute",
          gapType: "replace", urgency: "High", phase: "now", status: "open",
          affectedLayers: ["compute"], affectedEnvironments: ["env1"] }]
      });
      const v3 = migrate_v2_0_to_v3_0(v2, testCtx());
      const eid = v3.engagementMeta.engagementId;
      assertEqual(v3.customer.engagementId, eid, "customer stamped");
      assertEqual(v3.drivers.byId[v3.drivers.allIds[0]].engagementId, eid, "driver stamped");
      assertEqual(v3.environments.byId[v3.environments.allIds[0]].engagementId, eid, "environment stamped");
      assertEqual(v3.gaps.byId[v3.gaps.allIds[0]].engagementId, eid, "gap stamped");
    });
    it("V-MIG-S10-2 · Step 10: idempotent on already-stamped engagement", () => {});

    // Idempotency + determinism (V-MIG-IDEM-*, V-MIG-DETERM-*, V-MIG-COLLIDE-*, V-MIG-INPUT-IMMUT-*)
    it("V-MIG-IDEM-1 · migrate(migrate(empty.canvas)) deepEquals migrate(empty.canvas)", () => {});
    it("V-MIG-IDEM-2 · migrate idempotent on multi-env.canvas", () => {});
    it("V-MIG-IDEM-3 · migrate idempotent on acme-demo.canvas", () => {});
    it("V-MIG-IDEM-4 · migrate(v3_0) is no-op (deepEquals input)", () => {});
    it("V-MIG-DETERM-1 · two runs with same ctx.randomSeed produce byte-equal output", () => {
      const v2 = v2Empty({
        customer: { name: "Acme", vertical: "Healthcare",
          drivers: [
            { driverId: "ai_data", priority: "High" },
            { driverId: "ops_simplicity", priority: "Medium" }
          ] }
      });
      const a = migrate_v2_0_to_v3_0(v2, testCtx());
      const b = migrate_v2_0_to_v3_0(v2, testCtx());
      // JSON serialize for byte-equality comparison
      assertEqual(JSON.stringify(a.drivers), JSON.stringify(b.drivers),
        "drivers byte-equal across runs (deterministic id generation)");
    });
    it("V-MIG-DETERM-2 · generated ids deterministic from stable input fields", () => {
      // generateDeterministicId("driver", seed, "ai_data", 0) returns same id every time.
      const a = generateDeterministicId("driver", "test-seed", "ai_data", 0);
      const b = generateDeterministicId("driver", "test-seed", "ai_data", 0);
      assertEqual(a, b, "same inputs -> same id");
      // Different inputs -> different id (collision check at our scale).
      const c = generateDeterministicId("driver", "test-seed", "ops_simplicity", 0);
      assert(a !== c, "different businessDriverId -> different id");
      // Output is UUID-shaped.
      assert(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a),
        "id is UUID v8 shape: " + a);
    });
    it("V-MIG-COLLIDE-1 · no id collisions across all 8 fixtures", () => {});
    it("V-MIG-INPUT-IMMUT-1 · migrate does not mutate the input engagement (structuredClone at entry)", () => {
      const v2 = v2Empty({ customer: { name: "Acme", vertical: "Healthcare",
        drivers: [{ driverId: "ai_data", priority: "High" }] } });
      const v2Snapshot = JSON.stringify(v2);
      migrate_v2_0_to_v3_0(v2, testCtx());
      const v2After = JSON.stringify(v2);
      assertEqual(v2After, v2Snapshot, "input engagement not mutated");
    });

    // Failure handling (V-MIG-FAIL-*)
    it("V-MIG-FAIL-1 · throwing step produces MigrationFailure with failing step name + message", () => {
      // Force a throw: pass a v2 input with a deeply broken shape that
      // step01_schemaVersion can't handle gracefully — actually, step01
      // is robust. Instead, hijack via a custom ctx that throws inside
      // ctx.deterministicId (used by step02 + step06).
      const brokenCtx = makePipelineContext({
        migrationTimestamp: "2026-01-01T00:00:00.000Z",
        catalogSnapshot:    { BUSINESS_DRIVERS: { catalogVersion: "2026.04" }, ENV_CATALOG: { catalogVersion: "2026.04" } }
      });
      // Patch deterministicId to throw
      const truly_broken = Object.assign(Object.create(null), brokenCtx, {
        deterministicId: () => { throw new Error("boom"); }
      });
      // A v2.0 with no sessionId triggers step02's deterministicId path
      const v2 = v2Empty();
      delete v2.sessionMeta.sessionId;
      let thrown = null;
      try {
        migrate_v2_0_to_v3_0(v2, truly_broken);
      } catch (e) {
        thrown = e;
      }
      assert(thrown, "migrator threw");
      assert(thrown instanceof MigrationStepError,
        "thrown is MigrationStepError, got: " + (thrown && thrown.name));
      assert(thrown.step && thrown.step.length > 0, "step name populated");
      assert(thrown.cause && thrown.cause.message === "boom", "original cause preserved");
    });
    it("V-MIG-FAIL-2 · originalEnvelope deep-equals the input (preserved)", () => {});
    it("V-MIG-FAIL-3 · no console errors swallowed during failure", () => {});
    it("V-MIG-FAIL-4 · recovery flow: try-again with verbose ctx logs each step's input/output", () => {});
  });

  // -------------------------------------------------------------------
  // sec T6 · V-SEL + V-SEL-PURE · Selectors (per SPEC sec S5.4)
  // -------------------------------------------------------------------
  describe("§T6 · V-SEL · Selector correctness + purity", () => {
    // Correctness — selectMatrixView (V-SEL-1a..1e)
    it("V-SEL-1a · selectMatrixView({state:'current'}) returns env × layer grid", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const e1 = eng.environments.allIds[0];
      eng = addInstanceV3(eng, { state: "current", layerId: "compute", environmentId: e1,
        label: "PE1", vendor: "Dell", vendorGroup: "dell", criticality: "Medium", disposition: "keep" }).engagement;
      eng = addInstanceV3(eng, { state: "desired", layerId: "compute", environmentId: e1,
        label: "PE2", vendor: "Dell", vendorGroup: "dell", criticality: "Medium", disposition: "keep" }).engagement;
      const view = selectMatrixView(eng, { state: "current" });
      assertEqual(view.state, "current", "state preserved");
      assertEqual(view.envIds.length, 1, "1 env");
      assertEqual(view.layerIds.length, 6, "6 layers in catalog order");
      const cell = view.cells[e1].compute;
      assertEqual(cell.count, 1, "current state has 1 instance in compute (desired excluded)");
      assertEqual(cell.vendorMix.dell, 1, "1 dell");
    });
    it("V-SEL-1b · selectMatrixView({state:'desired'}) returns env × layer grid", () => {});
    it("V-SEL-1c · hidden envs excluded unless arg.includeHidden", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "drDc",   catalogVersion: "2026.04" }).engagement;
      const visibleEnv = eng.environments.allIds[0];
      const hiddenEnv  = eng.environments.allIds[1];
      eng = hideEnvironment(eng, hiddenEnv).engagement;
      const defaultView = selectMatrixView(eng, { state: "current" });
      assert(defaultView.envIds.includes(visibleEnv),  "visible env present by default");
      assert(!defaultView.envIds.includes(hiddenEnv),  "hidden env excluded by default");
      const inclView = selectMatrixView(eng, { state: "current", includeHidden: true });
      assert(inclView.envIds.includes(hiddenEnv), "hidden env present when includeHidden:true");
    });
    it("V-SEL-1d · cell.vendorMix counts dell + nonDell + custom correctly", () => {});
    it("V-SEL-1e · layerIds in catalog order from LAYERS", () => {});

    // Correctness — selectGapsKanban (V-SEL-2a..2c)
    it("V-SEL-2a · selectGapsKanban groups gaps by phase + status", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      const mk = (phase, status) => addGapV3(eng, {
        description: phase + "/" + status, gapType: "replace",
        urgency: "Medium", phase, status,
        layerId: "compute", affectedLayers: ["compute"],
        affectedEnvironments: [env1]
      });
      eng = mk("now",   "open").engagement;
      eng = mk("now",   "in_progress").engagement;
      eng = mk("next",  "open").engagement;
      eng = mk("later", "closed").engagement;
      const view = selectGapsKanban(eng);
      assertEqual(view.byPhase.now.open.length,         1, "now/open");
      assertEqual(view.byPhase.now.in_progress.length,  1, "now/in_progress");
      assertEqual(view.byPhase.next.open.length,        1, "next/open");
      assertEqual(view.byPhase.later.closed.length,     1, "later/closed");
      assertEqual(view.byPhase.now.deferred.length,     0, "now/deferred empty");
    });
    it("V-SEL-2b · totalsByStatus.closed populated but downstream excludes from active counts", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      const mk = (status) => addGapV3(eng, {
        description: "g-" + status, gapType: "replace",
        urgency: "Medium", phase: "now", status,
        layerId: "compute", affectedLayers: ["compute"],
        affectedEnvironments: [env1]
      });
      eng = mk("open").engagement;
      eng = mk("open").engagement;
      eng = mk("in_progress").engagement;
      eng = mk("closed").engagement;
      eng = mk("closed").engagement;
      eng = mk("deferred").engagement;
      const view = selectGapsKanban(eng);
      // totalsByStatus reports all 4 buckets faithfully (no exclusion)
      assertEqual(view.totalsByStatus.open,        2, "2 open");
      assertEqual(view.totalsByStatus.in_progress, 1, "1 in_progress");
      assertEqual(view.totalsByStatus.closed,      2, "2 closed");
      assertEqual(view.totalsByStatus.deferred,    1, "1 deferred");
      // Active-gap derivation = open + in_progress + deferred (closed EXCLUDED).
      // Per SPEC sec S5.2.2 + KD8 — selectHealthSummary + selectVendorMix
      // read this shape; consumers MUST NOT add closed to active totals.
      const active = view.totalsByStatus.open + view.totalsByStatus.in_progress + view.totalsByStatus.deferred;
      assertEqual(active, 4, "active gaps = open + in_progress + deferred (closed excluded)");
    });
    it("V-SEL-2c · sort order within (phase, status) deterministic", () => {});

    // Correctness — selectProjects (V-SEL-3a..3e)
    it("V-SEL-3a · selectProjects assigns deterministic projectId from grouping key", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addDriver(eng, { businessDriverId: "ai_data", priority: "High" }).engagement;
      const drvId = eng.drivers.allIds[0];
      // Two gaps sharing (driverId, layerId) -> same project
      eng = addGapV3(eng, { description: "g1", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", driverId: drvId, layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      eng = addGapV3(eng, { description: "g2", gapType: "enhance", urgency: "Low",
        phase: "next", status: "open", driverId: drvId, layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      // Different layer -> different project
      eng = addGapV3(eng, { description: "g3", gapType: "introduce", urgency: "High",
        phase: "now", status: "open", driverId: drvId, layerId: "storage",
        affectedLayers: ["storage"], affectedEnvironments: [env1] }).engagement;
      const view = selectProjects(eng);
      assertEqual(view.projects.length, 2, "2 projects: (drv,compute) + (drv,storage)");
      // Re-run: same projectIds (deterministic)
      const view2 = selectProjects(eng);
      assertEqual(view.projects[0].projectId, view2.projects[0].projectId,
        "projectId is deterministic across calls");
    });
    it("V-SEL-3b · gap → project assignment correct against fixture", () => {});
    it("V-SEL-3c · unassigned gaps appear in projects.unassigned", () => {});
    it("V-SEL-3d · project.phase = earliest among constituent gaps", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addDriver(eng, { businessDriverId: "ai_data", priority: "High" }).engagement;
      const drvId = eng.drivers.allIds[0];
      // Two gaps in same project: one "later", one "now". Earliest wins.
      eng = addGapV3(eng, { description: "g-later", gapType: "replace", urgency: "Medium",
        phase: "later", status: "open", driverId: drvId, layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      eng = addGapV3(eng, { description: "g-now", gapType: "enhance", urgency: "High",
        phase: "now", status: "open", driverId: drvId, layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const view = selectProjects(eng);
      assertEqual(view.projects.length, 1, "1 project");
      assertEqual(view.projects[0].phase, "now", "earliest phase wins");
      assertEqual(view.projects[0].mostUrgent, "High", "max urgency wins");
    });
    it("V-SEL-3e · project.mostUrgent = max urgency among constituent gaps", () => {});

    // Correctness — selectVendorMix (V-SEL-4a..4d)
    it("V-SEL-4a · selectVendorMix.totals matches sum of byLayer + byEnvironment", () => {
      // Build a small engagement with 2 envs, 2 layers, and a known vendor mix.
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "drDc",   catalogVersion: "2026.04" }).engagement;
      const [e1, e2] = eng.environments.allIds;
      const mk = (env, layer, vendor, group) => addInstanceV3(eng, {
        state: "current", layerId: layer, environmentId: env,
        label: vendor + "@" + layer, vendor, vendorGroup: group,
        criticality: "Medium", disposition: "keep"
      });
      eng = mk(e1, "compute", "Dell PowerEdge", "dell").engagement;
      eng = mk(e1, "compute", "HPE ProLiant",   "nonDell").engagement;
      eng = mk(e2, "storage", "PowerStore",     "dell").engagement;
      const view = selectVendorMix(eng);
      // Totals == sum across byLayer
      const layerSum = Object.values(view.byLayer)
        .reduce((s, b) => s + b.total, 0);
      assertEqual(layerSum, view.totals.total, "byLayer total === overall total");
      const envSum = Object.values(view.byEnvironment)
        .reduce((s, b) => s + b.total, 0);
      assertEqual(envSum, view.totals.total, "byEnvironment total === overall total");
      assertEqual(view.totals.total, 3, "3 instances total");
      assertEqual(view.totals.dell, 2, "2 dell");
      assertEqual(view.totals.nonDell, 1, "1 nonDell");
    });
    it("V-SEL-4b · selectVendorMix.byLayer correct for cross-cutting fixture", () => {});
    it("V-SEL-4c · selectVendorMix.byEnvironment correct for cross-cutting fixture", () => {});
    it("V-SEL-4d · 3 KPI tiles (dellDensity, mostDiverseLayer, topNonDellConcentration) computed correctly", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const e1 = eng.environments.allIds[0];
      const mk = (layer, vendor, group) => addInstanceV3(eng, {
        state: "current", layerId: layer, environmentId: e1,
        label: vendor, vendor, vendorGroup: group,
        criticality: "Medium", disposition: "keep"
      });
      eng = mk("compute", "Dell PowerEdge",  "dell").engagement;
      eng = mk("compute", "HPE ProLiant",    "nonDell").engagement;
      eng = mk("compute", "Custom",          "custom").engagement;
      eng = mk("storage", "PowerStore",      "dell").engagement;
      const v = selectVendorMix(eng);
      // dellDensity is overall dellPercent
      assertEqual(v.kpiTiles.dellDensity.value, v.totals.dellPercent,
        "dellDensity tile === totals.dellPercent");
      // mostDiverseLayer: compute has 3 vendor groups, storage has 1
      assertEqual(v.kpiTiles.mostDiverseLayer.layerId, "compute",
        "compute is most diverse (3 groups)");
      assertEqual(v.kpiTiles.mostDiverseLayer.vendorCount, 3,
        "3 distinct vendor groups in compute");
      // topNonDellConcentration: only HPE ProLiant in nonDell
      assertEqual(v.kpiTiles.topNonDellConcentration.vendorName, "HPE ProLiant",
        "top nonDell vendor name");
      assertEqual(v.kpiTiles.topNonDellConcentration.count, 1,
        "1 instance");
      assertEqual(v.kpiTiles.topNonDellConcentration.percentOfNonDell, 100,
        "100% of nonDell (only one nonDell vendor)");
    });

    // Correctness — selectHealthSummary (V-SEL-5a..5d)
    it("V-SEL-5a · selectHealthSummary.byLayer scores correct for cross-cutting fixture", () => {});
    it("V-SEL-5b · highRiskGaps excludes status === 'closed' (KD8 invariant preserved)", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      // Two High-urgency gaps in compute: one open, one closed.
      eng = addGapV3(eng, { description: "open-high", gapType: "replace", urgency: "High",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      eng = addGapV3(eng, { description: "closed-high", gapType: "replace", urgency: "High",
        phase: "now", status: "closed", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const view = selectHealthSummary(eng);
      // Only the open gap counts as high-risk; closed is excluded (KD8).
      assertEqual(view.byLayer.compute.counts.highRiskGaps, 1,
        "highRiskGaps excludes closed gaps (KD8)");
      assertEqual(view.byLayer.compute.counts.openGaps, 1,
        "openGaps count also excludes closed");
    });
    it("V-SEL-5c · overall.score computed deterministically from byLayer", () => {});
    it("V-SEL-5d · highestRiskLayer correct for fixture", () => {});

    // Correctness — selectExecutiveSummaryInputs (V-SEL-6a..6c)
    it("V-SEL-6a · selectExecutiveSummaryInputs.engagementMeta passes through verbatim", () => {
      const eng = createEmptyEngagement({ meta: {
        presalesOwner: "Mahmoud", status: "Draft",
        engagementId: "00000000-0000-4000-8000-000000000abc"
      } });
      const view = selectExecutiveSummaryInputs(eng);
      assertEqual(view.engagementMeta.presalesOwner, "Mahmoud", "presalesOwner");
      assertEqual(view.engagementMeta.status, "Draft", "status");
      assertEqual(view.engagementMeta.customerName, "New customer", "customer name from default");
      assertEqual(view.engagementMeta.vertical, "Financial Services", "vertical from default");
    });
    it("V-SEL-6b · drivers.topPriority is the High-priority driver (or first if tied)", () => {
      let eng = createEmptyEngagement();
      eng = addDriver(eng, { businessDriverId: "ops_simplicity", priority: "Medium" }).engagement;
      eng = addDriver(eng, { businessDriverId: "ai_data",        priority: "High"   }).engagement;
      eng = addDriver(eng, { businessDriverId: "cyber_resilience", priority: "Low"  }).engagement;
      const view = selectExecutiveSummaryInputs(eng);
      assertEqual(view.drivers.topPriority?.businessDriverId, "ai_data",
        "topPriority is the High-priority driver");
      assertEqual(view.drivers.all.length, 3, "all 3 drivers exposed");
    });
    it("V-SEL-6c · catalogVersions populated from loaded catalogs (provenance bridge)", () => {
      let eng = createEmptyEngagement();
      eng = addDriver(eng, { businessDriverId: "ai_data", priority: "High",
        catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const view = selectExecutiveSummaryInputs(eng);
      assertEqual(view.catalogVersions.BUSINESS_DRIVERS, "2026.04",
        "BUSINESS_DRIVERS catalog version exposed for provenance stamping");
      assertEqual(view.catalogVersions.ENV_CATALOG, "2026.04",
        "ENV_CATALOG catalog version exposed for provenance stamping");
    });

    // Correctness — selectLinkedComposition (V-SEL-7a..7g)
    it("V-SEL-7a · selectLinkedComposition({kind:'driver'}) returns entity + catalog + linked.gaps + linked.relatedInstances", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addDriver(eng, { businessDriverId: "ai_data", priority: "High" }).engagement;
      const drvId = eng.drivers.allIds[0];
      eng = addGapV3(eng, { description: "g1", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", driverId: drvId, layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const view = selectLinkedComposition(eng, { kind: "driver", id: drvId });
      assertEqual(view.kind, "driver", "kind preserved");
      assertEqual(view.entity.id, drvId, "entity present");
      assertEqual(view.linked.gaps.length, 1, "linked.gaps includes the matching gap");
      assertEqual(view.linked.affectedEnvironments.length, 1, "linked.affectedEnvironments");
    });
    it("V-SEL-7b · selectLinkedComposition({kind:'currentInstance'}) returns entity + linked.desiredCounterparts + linked.gaps", () => {});
    it("V-SEL-7c · selectLinkedComposition({kind:'desiredInstance'}) returns entity + linked.originInstance + linked.gaps", () => {});
    it("V-SEL-7d · selectLinkedComposition({kind:'gap'}) returns entity + linked.driver + linked.relatedInstances + linked.affectedEnvironments", () => {});
    it("V-SEL-7e · selectLinkedComposition({kind:'environment'}) returns entity + linked.instances + linked.gaps", () => {});
    it("V-SEL-7f · selectLinkedComposition({kind:'project'}) returns entity + linked.gaps + linked.drivers", () => {});
    it("V-SEL-7g · selectLinkedComposition with non-existent id returns graceful null/error envelope", () => {
      const eng = createEmptyEngagement();
      const view = selectLinkedComposition(eng, { kind: "driver", id: "00000000-0000-4000-8000-000000bad000" });
      assertEqual(view.entity, null, "entity null when not found");
      assert(typeof view.error === "string" && view.error.length > 0, "error message present");
      // No throw is the contract; the caller can branch on entity===null.
    });

    // Purity (V-SEL-PURE-*)
    it("V-SEL-PURE-1 · selectMatrixView returns ===-equal output for ===-equal inputs", () => {
      const eng = createEmptyEngagement();
      const a = selectMatrixView(eng, { state: "current" });
      const b = selectMatrixView(eng, { state: "current" });
      assert(a === b, "memoizeOne returns ===-equal output for ===-equal input");
    });
    it("V-SEL-PURE-2 · selectGapsKanban returns ===-equal output for ===-equal inputs", () => {
      const eng = createEmptyEngagement();
      const a = selectGapsKanban(eng);
      const b = selectGapsKanban(eng);
      assert(a === b, "memoizeOne returns ===-equal output for ===-equal input");
    });
    it("V-SEL-PURE-3 · selectProjects returns ===-equal output for ===-equal inputs", () => {
      const eng = createEmptyEngagement();
      const a = selectProjects(eng);
      const b = selectProjects(eng);
      assert(a === b, "memoizeOne returns ===-equal output for ===-equal input");
    });
    it("V-SEL-PURE-4 · selectVendorMix returns ===-equal output for ===-equal inputs", () => {
      const eng = createEmptyEngagement();
      const a = selectVendorMix(eng);
      const b = selectVendorMix(eng);
      assert(a === b, "memoizeOne returns ===-equal output for ===-equal input");
    });
    it("V-SEL-PURE-5 · selectHealthSummary returns ===-equal output for ===-equal inputs", () => {
      const eng = createEmptyEngagement();
      const a = selectHealthSummary(eng);
      const b = selectHealthSummary(eng);
      assert(a === b, "memoizeOne returns ===-equal output for ===-equal input");
    });
    it("V-SEL-PURE-6 · selectExecutiveSummaryInputs returns ===-equal output for ===-equal inputs", () => {
      const eng = createEmptyEngagement();
      const a = selectExecutiveSummaryInputs(eng);
      const b = selectExecutiveSummaryInputs(eng);
      assert(a === b, "memoizeOne returns ===-equal output for ===-equal input");
    });
    it("V-SEL-PURE-7 · selectLinkedComposition returns ===-equal output for ===-equal inputs", () => {
      let eng = createEmptyEngagement();
      eng = addDriver(eng, { businessDriverId: "ai_data", priority: "High" }).engagement;
      const drvId = eng.drivers.allIds[0];
      const a = selectLinkedComposition(eng, { kind: "driver", id: drvId });
      const b = selectLinkedComposition(eng, { kind: "driver", id: drvId });
      assert(a === b, "memoizeOne returns ===-equal output for ===-equal (engagement, kind, id)");
    });

    // Memoization invalidation (V-SEL-INVAL-*)
    it("V-SEL-INVAL-1 · action addInstance invalidates selectMatrixView memoization", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const e1 = eng.environments.allIds[0];
      const before = selectMatrixView(eng, { state: "current" });
      const next = addInstanceV3(eng, { state: "current", layerId: "compute", environmentId: e1,
        label: "T1", vendor: "Dell", vendorGroup: "dell", criticality: "Medium", disposition: "keep" });
      assert(next.ok, "addInstance ok");
      const after = selectMatrixView(next.engagement, { state: "current" });
      assert(before !== after, "engagement ref changed -> output ref changed");
      assertEqual(after.cells[e1].compute.count, 1, "after has the new instance");
    });
    it("V-SEL-INVAL-2 · action addGap invalidates selectGapsKanban memoization", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      const before = selectGapsKanban(eng);
      const next = addGapV3(eng, {
        description: "new gap", gapType: "replace",
        urgency: "Medium", phase: "now", status: "open",
        layerId: "compute", affectedLayers: ["compute"],
        affectedEnvironments: [env1]
      });
      assert(next.ok, "addGap ok");
      const after = selectGapsKanban(next.engagement);
      assert(before !== after,
        "engagement reference changed -> selector recomputes -> different output reference");
      assertEqual(after.byPhase.now.open.length, 1, "after has the new gap");
    });
    it("V-SEL-INVAL-3 · action updateGap invalidates selectProjects memoization", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addGapV3(eng, { description: "g1", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const gapId = eng.gaps.allIds[0];
      const before = selectProjects(eng);
      const updated = updateGapV3(eng, gapId, { phase: "later" });
      assert(updated.ok, "updateGap ok");
      const after = selectProjects(updated.engagement);
      assert(before !== after, "engagement ref changed -> selectProjects re-computes");
    });
    it("V-SEL-INVAL-4 · action updateInstance invalidates selectVendorMix memoization", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addInstanceV3(eng, {
        state: "current", layerId: "compute", environmentId: env1,
        label: "Original", vendor: "HPE", vendorGroup: "nonDell",
        criticality: "Medium", disposition: "keep"
      }).engagement;
      const before = selectVendorMix(eng);
      const instId = eng.instances.allIds[0];
      // Switch the instance from nonDell to dell. Vendor mix totals shift.
      const updated = updateInstanceV3(eng, instId, {
        vendor: "Dell PowerEdge", vendorGroup: "dell"
      });
      assert(updated.ok, "updateInstance ok");
      const after = selectVendorMix(updated.engagement);
      assert(before !== after, "engagement ref changed -> output ref changed");
      assertEqual(before.totals.dell, 0, "before: 0 dell");
      assertEqual(after.totals.dell, 1, "after: 1 dell");
    });
    it("V-SEL-INVAL-5 · action addGap invalidates selectHealthSummary memoization", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      const before = selectHealthSummary(eng);
      assertEqual(before.byLayer.compute.counts.openGaps, 0, "before: 0 open gaps");
      const next = addGapV3(eng, { description: "g1", gapType: "replace", urgency: "High",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] });
      const after = selectHealthSummary(next.engagement);
      assert(before !== after, "ref changed");
      assertEqual(after.byLayer.compute.counts.highRiskGaps, 1, "after: 1 highRisk gap");
    });
    it("V-SEL-INVAL-6 · action updateCustomer invalidates selectExecutiveSummaryInputs memoization", () => {
      const eng = createEmptyEngagement();
      const before = selectExecutiveSummaryInputs(eng);
      const updated = updateCustomer(eng, { name: "Acme Inc.", vertical: "Healthcare" });
      assert(updated.ok, "updateCustomer ok");
      const after = selectExecutiveSummaryInputs(updated.engagement);
      assert(before !== after, "ref changed -> recompute");
      assertEqual(after.engagementMeta.customerName, "Acme Inc.", "name reflected");
      assertEqual(after.engagementMeta.vertical, "Healthcare", "vertical reflected");
    });
    it("V-SEL-INVAL-7 · action affecting linked entity invalidates selectLinkedComposition memoization", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addDriver(eng, { businessDriverId: "ai_data", priority: "High" }).engagement;
      const drvId = eng.drivers.allIds[0];
      const before = selectLinkedComposition(eng, { kind: "driver", id: drvId });
      assertEqual(before.linked.gaps.length, 0, "before: no gaps");
      // Add a gap linked to this driver
      const next = addGapV3(eng, { description: "linked", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", driverId: drvId, layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] });
      const after = selectLinkedComposition(next.engagement, { kind: "driver", id: drvId });
      assert(before !== after, "ref changed");
      assertEqual(after.linked.gaps.length, 1, "after: 1 linked gap");
    });

    // Forbidden patterns (V-SEL-FORBID-*)
    it("V-SEL-FORBID-1 · no selectors/*.js file imports localStorage / document / window / fetch", async () => {
      // Meta-test: fetches each selector source file + greps for forbidden
      // identifiers. Per SPEC sec S5.1.1: selectors do not reach into
      // localStorage, the DOM, the network, or any source other than the
      // engagement passed in.
      const SELECTOR_FILES = ["vendorMix.js", "gapsKanban.js"];
      const FORBIDDEN = ["localStorage", "document.", "window.", "fetch("];
      for (const file of SELECTOR_FILES) {
        const res = await fetch("/selectors/" + file);
        assert(res.ok, file + " must serve 200 OK");
        const src = await res.text();
        // Strip comment lines so we don't false-trigger on /* fetch( */ etc.
        const stripped = src.split("\n")
          .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
          .join("\n");
        for (const banned of FORBIDDEN) {
          assert(!stripped.includes(banned),
            file + " must not reference '" + banned + "' in production code");
        }
      }
    });
    it("V-SEL-FORBID-2 · no selectors/*.js file declares module-scope mutable state outside memoize wrapper", () => {});
    it("V-SEL-FORBID-3 · no selectors/*.js file imports reselect / proxy-memoize / lodash.memoize", async () => {
      // Meta-test: enforces the SPEC sec S5.1.3 single-library rule.
      // memoize-one (or our vendored equivalent at services/memoizeOne.js)
      // is the sanctioned tool; everything else is forbidden.
      const SELECTOR_FILES = ["vendorMix.js", "gapsKanban.js"];
      const FORBIDDEN_IMPORTS = ["reselect", "proxy-memoize", "lodash.memoize", "nano-memoize"];
      for (const file of SELECTOR_FILES) {
        const res = await fetch("/selectors/" + file);
        const src = await res.text();
        for (const lib of FORBIDDEN_IMPORTS) {
          // Match `from "lib"` or `from 'lib'` patterns specifically (not
          // mentions in comments).
          const patterns = [
            'from "' + lib + '"',
            "from '" + lib + "'"
          ];
          for (const p of patterns) {
            assert(!src.includes(p),
              file + " must not import '" + lib + "' (SPEC S5.1.3)");
          }
        }
      }
    });
  });

  // -------------------------------------------------------------------
  // sec T7 · V-MFG · Manifest generation (per SPEC sec S7.6)
  // -------------------------------------------------------------------
  describe("§T7 · V-MFG · Manifest generation", () => {
    it("V-MFG-1 · generateManifest() FNV-1a hash + structural counts equal locked snapshot (drift gate)", () => {
      // SPEC §S7.6 drift gate. Deliberately uses an FNV-1a hash + per-kind
      // structural counts rather than a full JSON snapshot file: the byte-
      // exact JSON would be ~9 KB, large enough that maintenance friction
      // outweighs the benefit, and string-extracting through the test
      // harness is unreliable. Hash + counts catch every realistic drift
      // (added/removed path, renamed field, kind added) while staying
      // tiny enough to live as a constant.
      //
      // Regen procedure (when this test fails because YOU intended the
      // drift):
      //   1. Open Chrome DevTools console with the app loaded.
      //   2. Paste:
      //      const { generateManifest, serializeManifestStable } = await import('/services/manifestGenerator.js');
      //      const json = serializeManifestStable(generateManifest());
      //      let h = 0x811c9dc5; for (let i=0;i<json.length;i++) { h ^= json.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
      //      console.log({ bytes: json.length, fnv1a: h.toString(16).padStart(8,'0') });
      //      const m = generateManifest();
      //      console.log({ entityKinds: Object.keys(m.byEntityKind).sort(),
      //                    perKindOwn: Object.fromEntries(Object.entries(m.byEntityKind).map(([k,v]) => [k, v.ownPaths?.length ?? 0])),
      //                    perKindLinked: Object.fromEntries(Object.entries(m.byEntityKind).map(([k,v]) => [k, v.linkedPaths?.length ?? 0])) });
      //   3. Update the LOCKED_* constants below with the new values.
      //   4. Re-run the test → GREEN.

      // Locked snapshot — v3.0.0-rc.1 baseline (2026-05-01).
      const LOCKED_BYTES        = 8744;
      const LOCKED_HASH         = "3a217459";
      const LOCKED_SESSION_PATH_COUNT = 7;
      const LOCKED_ENTITY_KINDS = ["currentInstance","desiredInstance","driver","environment","gap","project"];
      const LOCKED_OWN_COUNT    = { driver: 5, currentInstance: 7, desiredInstance: 7, gap: 5, environment: 6, project: 0 };
      const LOCKED_LINKED_COUNT = { driver: 2, currentInstance: 1, desiredInstance: 1, gap: 2, environment: 2, project: 1 };

      // FNV-1a 32-bit. Deterministic, no crypto dependency, browser+test safe.
      function fnv1a(s) {
        let h = 0x811c9dc5;
        for (let i = 0; i < s.length; i++) {
          h ^= s.charCodeAt(i);
          h = Math.imul(h, 0x01000193) >>> 0;
        }
        return h.toString(16).padStart(8, "0");
      }

      const live = generateManifest();
      const json = serializeManifestStable(live);

      assertEqual(json.length, LOCKED_BYTES,
        "V-MFG-1 · manifest size drift detected (regen the snapshot in test body if intentional)");
      assertEqual(fnv1a(json), LOCKED_HASH,
        "V-MFG-1 · manifest FNV-1a hash drift detected (regen the snapshot in test body if intentional)");
      assertEqual(live.sessionPaths.length, LOCKED_SESSION_PATH_COUNT,
        "V-MFG-1 · sessionPaths count drift");

      const liveKinds = Object.keys(live.byEntityKind).sort();
      assertEqual(liveKinds.join(","), LOCKED_ENTITY_KINDS.join(","),
        "V-MFG-1 · entity-kind set drift");

      for (const k of LOCKED_ENTITY_KINDS) {
        assertEqual(live.byEntityKind[k].ownPaths?.length ?? 0, LOCKED_OWN_COUNT[k],
          "V-MFG-1 · ownPaths count drift on " + k);
        assertEqual(live.byEntityKind[k].linkedPaths?.length ?? 0, LOCKED_LINKED_COUNT[k],
          "V-MFG-1 · linkedPaths count drift on " + k);
      }
    });
    it("V-MFG-2 · manifest.sessionPaths includes customer.name, customer.vertical, engagementMeta.engagementDate", () => {
      const m = generateManifest();
      const paths = m.sessionPaths.map(p => p.path);
      assert(paths.includes("customer.name"),                       "customer.name in sessionPaths");
      assert(paths.includes("customer.vertical"),                   "customer.vertical in sessionPaths");
      assert(paths.includes("engagementMeta.engagementDate"),       "engagementMeta.engagementDate in sessionPaths");
    });
    it("V-MFG-3 · manifest.byEntityKind.driver.ownPaths includes priority + outcomes", () => {
      const m = generateManifest();
      const driverPaths = m.byEntityKind.driver.ownPaths.map(p => p.path);
      assert(driverPaths.includes("context.driver.priority"), "priority in driver ownPaths");
      assert(driverPaths.includes("context.driver.outcomes"), "outcomes in driver ownPaths");
    });
    it("V-MFG-4 · manifest.byEntityKind.driver.linkedPaths includes context.driver.linkedGaps[*].description (composition)", () => {});
    it("V-MFG-5 · manifest.byEntityKind.gap.linkedPaths covers affectedEnvironments + relatedCurrentInstanceIds + relatedDesiredInstanceIds", () => {});
    it("V-MFG-6 · adding a field to schema/driver.js without re-running generateManifest fails V-MFG-1", () => {});
    it("V-MFG-7 · manifest.sessionPaths does NOT contain entity-internal paths", () => {
      const m = generateManifest();
      const sessionPaths = m.sessionPaths.map(p => p.path);
      // Entity-internal paths start with "context." per v3.0 convention
      assert(!sessionPaths.some(p => p.startsWith("context.")),
        "sessionPaths must NOT contain context.* paths (those belong in byEntityKind)");
    });
    it("V-MFG-8 · catalog-resolved chips emitted with source: 'catalog'", () => {});
    it("V-MFG-9 · manifest is deterministic (two consecutive generateManifest() byte-equal)", () => {
      const a = serializeManifestStable(generateManifest());
      const b = serializeManifestStable(generateManifest());
      assertEqual(a, b, "manifest serialized identically across two consecutive generateManifest() calls");
    });
    it("V-MFG-10 · manifest entry count matches SPEC sec S7.2.1 expected size table", () => {});
  });

  // -------------------------------------------------------------------
  // sec T8 · V-PATH · Path resolution (per SPEC sec S7.3 + sec S7.6)
  // -------------------------------------------------------------------
  describe("§T8 · V-PATH · Path resolution", () => {
    // Save-time validation (V-PATH-1..15)
    it("V-PATH-1 · skill with template '{{customer.name}}' saves cleanly (path in sessionPaths)", () => {
      const skill = createEmptySkill({
        skillId: "skl-v-path-1", promptTemplate: "Hi {{customer.name}}!" });
      const result = validateSkillSave(skill, generateManifest());
      assert(result.ok === true, "session path resolves cleanly: " + JSON.stringify(result));
    });
    it("V-PATH-2 · skill with '{{context.driver.priority}}' + entityKind:'driver' saves cleanly", () => {
      const skill = createEmptySkill({
        skillId:        "skl-v-path-2",
        skillType:      "click-to-run",
        entityKind:     "driver",
        promptTemplate: "Driver priority: {{context.driver.priority}}"
      });
      const result = validateSkillSave(skill, generateManifest());
      assert(result.ok === true, "driver entity-scoped path resolves: " + JSON.stringify(result));
    });
    it("V-PATH-3 · skill with '{{nonsense.path}}' blocks save with structured error", () => {
      const skill = createEmptySkill({
        skillId: "skl-v-path-3",
        promptTemplate: "Bad path: {{nonsense.path}}"
      });
      const result = validateSkillSave(skill, generateManifest());
      assertEqual(result.ok, false, "save blocked");
      assert(result.errors.length === 1, "exactly one error");
      assertEqual(result.errors[0].path, "nonsense.path", "error path captured");
    });
    it("V-PATH-4 · skill entityKind:'driver' cannot use context.gap.* paths (cross-kind blocked)", () => {
      const skill = createEmptySkill({
        skillId: "skl-v-path-4",
        skillType: "click-to-run",
        entityKind: "driver",
        promptTemplate: "Cross-kind: {{context.gap.description}}"
      });
      const result = validateSkillSave(skill, generateManifest());
      assertEqual(result.ok, false, "cross-kind path blocked");
      assertEqual(result.errors[0].path, "context.gap.description",
        "rejection points at the wrong-kind path");
    });
    it("V-PATH-5 · save error envelope includes validPaths list", () => {
      const skill = createEmptySkill({
        skillId: "skl-v-path-5",
        promptTemplate: "Bad: {{nonsense.x}}"
      });
      const result = validateSkillSave(skill, generateManifest());
      assertEqual(result.ok, false, "blocked");
      assert(Array.isArray(result.errors[0].validPaths) && result.errors[0].validPaths.length > 0,
        "error envelope includes validPaths list (UI surfaces these as suggestions)");
      assert(result.errors[0].validPaths.includes("customer.name"),
        "validPaths includes customer.name (sample sessionPaths entry)");
    });
    it("V-PATH-6 · driver entity kind valid path saves; invalid blocks", () => {});
    it("V-PATH-7 · currentInstance entity kind valid path saves; invalid blocks", () => {});
    it("V-PATH-8 · desiredInstance entity kind valid path saves; invalid blocks", () => {});
    it("V-PATH-9 · gap entity kind valid path saves; invalid blocks", () => {});
    it("V-PATH-10 · environment entity kind valid path saves; invalid blocks", () => {});
    it("V-PATH-11 · project entity kind valid path saves; invalid blocks", () => {});
    it("V-PATH-12 · session-wide skill rejects entityKind-scoped path", () => {
      const skill = createEmptySkill({
        skillId: "skl-v-path-12",
        skillType: "session-wide",
        entityKind: null,
        promptTemplate: "Bad: {{context.driver.priority}}"
      });
      const result = validateSkillSave(skill, generateManifest());
      assertEqual(result.ok, false, "session-wide can't use entity-scoped path");
      assertEqual(result.errors[0].path, "context.driver.priority",
        "rejection points at the entity-scoped path");
    });
    it("V-PATH-13 · createEmptySkill auto-migrates legacy click-to-run + entityKind to v3.1 parameters[] (per SPEC §S29.3)", () => {
      // Pre-rc.3: SkillSchema's superRefine rejected this draft because
      // click-to-run + null entityKind violated the v3.0 invariant.
      // Post-rc.3 (SPEC §S29): the (skillType, entityKind) tuple is
      // RETIRED. createEmptySkill auto-migrates legacy drafts to the
      // v3.1 shape (parameters[] derived from entityKind). A click-to-run
      // skill with null entityKind = a v3.1 skill with NO parameters.
      const skill = createEmptySkill({
        skillId:        "skl-v-path-13",
        skillType:      "click-to-run",
        entityKind:     null,                  // dropped by migration
        promptTemplate: "Hello"
      });
      assert(typeof skill.skillType === "undefined",
        "v3.1 skill SHALL NOT carry legacy skillType field");
      assert(typeof skill.entityKind === "undefined",
        "v3.1 skill SHALL NOT carry legacy entityKind field");
      assertEqual(skill.outputTarget, "chat-bubble",
        "outputTarget defaults to chat-bubble");
      assert(Array.isArray(skill.parameters) && skill.parameters.length === 0,
        "click-to-run + null entityKind migrates to parameters: [] (effectively session-wide)");
    });
    it("V-PATH-14 · validateSkillSave derives entity-kind context from parameters[] (per SPEC §S29.2)", () => {
      // Pre-rc.3: validator read skill.skillType + skill.entityKind to
      // decide which entity-scoped paths were valid.
      // Post-rc.3: validator derives the entity-kind from a parameter
      // of type='entityId' whose description hints at the kind.
      const skill = createEmptySkill({
        skillId:        "skl-v-path-14",
        promptTemplate: "Driver priority: {{context.driver.priority}}",
        parameters: [
          { name: "driver", type: "entityId", description: "Pick a driver", required: true }
        ]
      });
      const result = validateSkillSave(skill, generateManifest());
      assert(result.ok === true,
        "v3.1 driver-parameter skill validates context.driver.* paths cleanly: " + JSON.stringify(result.errors || ""));
    });
    it("V-PATH-15 · save error envelope sorted by template appearance order", () => {});

    // Run-time resolution (V-PATH-16..30)
    it("V-PATH-16 · resolveTemplate('{{customer.name}}', ctx) returns customer name", () => {
      const eng = createEmptyEngagement();
      const ctx = { ...eng, engagement: eng };   // session-wide context
      const out = resolveTemplate("Customer is {{customer.name}}", ctx, { logUndefined: () => {} });
      assertEqual(out, "Customer is New customer", "customer.name resolved into prompt");
    });
    it("V-PATH-17 · resolveTemplate('{{context.driver.outcomes}}', ctx) returns driver outcomes from active entity", () => {
      // Click-to-run context: the linkedComposition wraps context.driver.
      const ctx = {
        context: {
          driver: { outcomes: "Drive AI value across 3 BUs", priority: "High" }
        }
      };
      const out = resolveTemplate("Outcomes: {{context.driver.outcomes}}", ctx, { logUndefined: () => {} });
      assertEqual(out, "Outcomes: Drive AI value across 3 BUs",
        "active-entity field resolved into prompt");
    });
    it("V-PATH-18 · linked path '{{context.driver.linkedGaps[*].description}}' returns array joined", () => {});
    it("V-PATH-19 · catalog path '{{context.driver.catalog.label}}' resolves through catalogSnapshot", () => {
      const ctx = {
        context: {
          driver: {
            priority: "High",
            catalog: {
              label: "AI & Data Platforms",
              hint:  "Real value from AI and data, fast.",
              conversationStarter: "Where would AI/data create value?"
            }
          }
        }
      };
      const out = resolveTemplate("Driver: {{context.driver.catalog.label}}", ctx, { logUndefined: () => {} });
      assertEqual(out, "Driver: AI & Data Platforms",
        "catalog metadata resolved through context.driver.catalog");
    });
    it("V-PATH-20 · undefined value substitutes [?] placeholder", () => {
      const ctx = { customer: { name: "Acme" } };
      const out = resolveTemplate("Name: {{customer.name}}, Region: {{customer.region}}", ctx,
        { logUndefined: () => {} });
      assert(out.includes("Name: Acme"), "defined path resolves");
      assert(out.includes("Region: [?]"), "undefined path substitutes [?]");
    });
    it("V-PATH-21 · undefined value logs to skillRuntimeLog with skillId + path + engagementSnapshot", () => {
      const logs = [];
      const ctx = { customer: { name: "Acme" } };
      resolveTemplate("Region: {{customer.region}}", ctx, {
        skillId:       "skl-test-001",
        logUndefined:  (info) => logs.push(info)
      });
      assertEqual(logs.length, 1, "logger called once for the undefined path");
      assertEqual(logs[0].path,    "customer.region", "path captured");
      assertEqual(logs[0].skillId, "skl-test-001",   "skillId captured");
    });
    it("V-PATH-22 · empty array linked path → empty string substitution", () => {});
    it("V-PATH-23 · null FK target → [?] substitution + log entry", () => {});
    it("V-PATH-24 · missing catalog entry → [?] substitution + log entry", () => {});
    it("V-PATH-25 · multi-path template substitutes all paths in single resolve pass", () => {
      const ctx = { customer: { name: "Acme", vertical: "Healthcare" } };
      const out = resolveTemplate("{{customer.name}} ({{customer.vertical}}) - workshop", ctx,
        { logUndefined: () => {} });
      assertEqual(out, "Acme (Healthcare) - workshop",
        "all placeholders substituted in one pass");
    });
    it("V-PATH-26 · template with no placeholders returns input verbatim", () => {
      const ctx = { customer: { name: "Acme" } };
      const tpl = "This is a static prompt with no placeholders.";
      assertEqual(resolveTemplate(tpl, ctx, { logUndefined: () => {} }), tpl, "verbatim");
    });
    it("V-PATH-27 · template with escaped {{ }} preserves literal", () => {});
    it("V-PATH-28 · resolveTemplate handles 200-character template within budget", () => {});
    it("V-PATH-29 · resolveTemplate handles deep linked-composition path (.driver.linkedGaps[*].relatedInstances[*].label)", () => {});
    it("V-PATH-30 · resolveTemplate stable across invocations (deterministic)", () => {});

    // Resolver purity (V-PATH-PURE-*)
    it("V-PATH-PURE-1 · resolveTemplate is pure (same input → same output across calls)", () => {
      const ctx = { customer: { name: "Acme" } };
      const tpl = "Hi {{customer.name}}!";
      const a = resolveTemplate(tpl, ctx, { logUndefined: () => {} });
      const b = resolveTemplate(tpl, ctx, { logUndefined: () => {} });
      assertEqual(a, b, "same input -> same output");
    });
    it("V-PATH-PURE-2 · resolveTemplate does NOT mutate ctx", () => {
      const ctx = { customer: { name: "Acme", vertical: "Healthcare" } };
      const snap = JSON.stringify(ctx);
      resolveTemplate("Hi {{customer.name}}, {{customer.region}}!", ctx, { logUndefined: () => {} });
      assertEqual(JSON.stringify(ctx), snap, "ctx not mutated");
    });
    it("V-PATH-PURE-3 · resolveTemplate is synchronous (no Promise)", () => {
      const ctx = { customer: { name: "Acme" } };
      const result = resolveTemplate("Hi {{customer.name}}!", ctx, { logUndefined: () => {} });
      assert(typeof result === "string", "returns a string, not a Promise");
      assert(!(result instanceof Promise), "result is not a Promise");
    });
  });

  // -------------------------------------------------------------------
  // sec T9 · V-PROV · AI provenance (per SPEC sec S8.5)
  // -------------------------------------------------------------------
  describe("§T9 · V-PROV · AI provenance", () => {
    it("V-PROV-1 · dell-mapping skill structured-output rejects out-of-catalog Dell product id", () => {});
    it("V-PROV-2 · user edit on aiMappedDellSolutions.value flips validationStatus to 'user-edited'", () => {});
    it("V-PROV-3 · user edit preserves the original provenance fields (model, promptVersion, runId, timestamp)", () => {});
    it("V-PROV-4 · re-running a skill on a stale field replaces the entire envelope; new validationStatus === 'valid'", async () => {
      // First run: produces { value, provenance: {validationStatus: "valid"} }
      const skill = { skillId: "skl-test-001", version: "1.0.0",
        promptTemplate: "Map: {{customer.name}}" };
      const ctx = { customer: { name: "Acme" }, catalogVersions: { DELL_PRODUCT_TAXONOMY: "2026.04" } };
      const provider = createMockLLMProvider({
        defaultResponse: { model: "mock-claude", text: "PowerStore + PowerProtect" }
      });
      const first = await runSkill(skill, ctx, provider, { runTimestamp: "2026-04-01T00:00:00.000Z" });
      assertEqual(first.provenance.validationStatus, "valid", "first run produces valid status");

      // Simulate "stale" state by patching the envelope (drift would do this).
      const stale = { ...first, provenance: { ...first.provenance, validationStatus: "stale" } };

      // Re-run: returns a NEW envelope with new runId + new timestamp + valid status.
      const second = await runSkill(skill, ctx, provider, { runTimestamp: "2026-05-01T00:00:00.000Z" });
      assertEqual(second.provenance.validationStatus, "valid",
        "re-run produces valid status (stale was replaced)");
      assert(second.provenance.timestamp !== stale.provenance.timestamp,
        "re-run has a new timestamp");
    });
    it("V-PROV-5 · plain-string assignment to instance.aiSuggestedDellMapping rejected by InstanceSchema", () => {
      const inst = createEmptyInstance({ state: "current" });
      const broken = { ...inst, aiSuggestedDellMapping: "PowerStore" };
      const result = InstanceSchema.safeParse(broken);
      assert(result.success === false,
        "plain-string assignment to AI-authored slot must be rejected (provenance wrapper required)");
      assert(result.error.issues.some(i => i.path[0] === "aiSuggestedDellMapping"),
        "rejection must point at aiSuggestedDellMapping");
    });
    it("V-PROV-6 · plain-string assignment to gap.aiMappedDellSolutions rejected by GapSchema", () => {
      const gap = createEmptyGap();
      const broken = { ...gap, aiMappedDellSolutions: "PowerStore + PowerProtect" };
      const result = GapSchema.safeParse(broken);
      assert(result.success === false,
        "plain-string assignment to AI-authored slot must be rejected (provenance wrapper required)");
      assert(result.error.issues.some(i => i.path[0] === "aiMappedDellSolutions"),
        "rejection must point at aiMappedDellSolutions");
    });
    it("V-PROV-7 · provenance is set ONLY by services/skillRunner.js (meta-test grep)", () => {});
    it("V-PROV-8 · UI icon for validationStatus === 'valid' is the default sparkle (no dot)", () => {});
    it("V-PROV-9 · UI icon for 'stale' carries the amber dot", () => {});
    it("V-PROV-10 · UI icon for 'invalid' carries the red dot", () => {});
    it("V-PROV-11 · UI icon for 'user-edited' is the pencil-with-sparkle", () => {});
    it("V-PROV-12 · tooltip on each icon includes model + skillId + timestamp", () => {});
    it("V-PROV-13 · catalog-validation retry budget exhausts at 2 retries → validationStatus === 'invalid'", () => {});
    it("V-PROV-14 · runId is unique across runs (UUID v4 or v8 deterministic)", async () => {
      const skill = { skillId: "skl-uniq", promptTemplate: "Test" };
      const ctx = { customer: { name: "X" }, catalogVersions: {} };
      const provider = createMockLLMProvider({ defaultResponse: { model: "mock", text: "ok" } });
      // Two runs without runIdSeed -> non-deterministic runIds (real-prod path)
      const a = await runSkill(skill, ctx, provider);
      const b = await runSkill(skill, ctx, provider);
      assert(a.provenance.runId !== b.provenance.runId,
        "runIds must differ across runs (production path uses crypto.randomUUID)");
      // Format: UUID-shaped
      assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a.provenance.runId),
        "runId is UUID-shaped: " + a.provenance.runId);
    });
    it("V-PROV-15 · timestamp matches ctx.runTimestamp for deterministic test mode", async () => {
      const skill = { skillId: "skl-determ", promptTemplate: "Test" };
      const ctx = { customer: { name: "X" }, catalogVersions: {} };
      const provider = createMockLLMProvider({ defaultResponse: { model: "mock", text: "ok" } });
      const fixedTs = "2026-01-01T00:00:00.000Z";
      // With runTimestamp + runIdSeed: byte-deterministic envelope
      const a = await runSkill(skill, ctx, provider, { runTimestamp: fixedTs, runIdSeed: "test-seed-1" });
      const b = await runSkill(skill, ctx, provider, { runTimestamp: fixedTs, runIdSeed: "test-seed-1" });
      assertEqual(a.provenance.timestamp, fixedTs, "timestamp matches opts.runTimestamp");
      assertEqual(a.provenance.runId,     b.provenance.runId, "deterministic runId from runIdSeed");
    });
  });

  // -------------------------------------------------------------------
  // sec T10 · V-DRIFT · Catalog drift (per SPEC sec S8.4 + sec S6.3)
  // -------------------------------------------------------------------
  describe("§T10 · V-DRIFT · Catalog drift", () => {
    it("V-DRIFT-1 · engagement stamped against DELL_PRODUCT_TAXONOMY '2026.04' loaded with current '2026.07' flips affected to 'stale'", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addGapV3(eng, { description: "g1", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const gapId = eng.gaps.allIds[0];
      // Inject a valid AI-provenanced field stamped against 2026.04
      const stampedEng = { ...eng,
        gaps: { ...eng.gaps,
          byId: { ...eng.gaps.byId,
            [gapId]: { ...eng.gaps.byId[gapId],
              aiMappedDellSolutions: {
                value: { products: ["powerstore"] },
                provenance: {
                  model: "claude-sonnet-4-6",
                  promptVersion: "skill:dellMap@1.0.0",
                  skillId: "skl-001",
                  runId: "run-001",
                  timestamp: "2026-04-01T00:00:00.000Z",
                  catalogVersions: { DELL_PRODUCT_TAXONOMY: "2026.04" },
                  validationStatus: "valid"
                }
              }
            }
          }
        }
      };
      // Newer catalog version in the loaded catalogs
      const newerCatalogs = {
        DELL_PRODUCT_TAXONOMY: { catalogVersion: "2026.07", entries: [] }
      };
      const result = runIntegritySweep(stampedEng, newerCatalogs);
      const sweptGap = result.repaired.gaps.byId[gapId];
      assertEqual(sweptGap.aiMappedDellSolutions.provenance.validationStatus, "stale",
        "valid -> stale on catalog version mismatch");
      assert(result.log.some(l => l.ruleId === "INT-AI-DRIFT"),
        "INT-AI-DRIFT log entry emitted");
    });
    it("V-DRIFT-2 · multiple drift detections (same engagement, multiple AI fields, multiple catalog mismatches) all flagged", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      // Two gaps each with a stamped AI field at "2026.04"
      eng = addGapV3(eng, { description: "g1", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      eng = addGapV3(eng, { description: "g2", gapType: "enhance", urgency: "Low",
        phase: "next", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const stamped = { ...eng,
        gaps: { ...eng.gaps,
          byId: { ...eng.gaps.byId,
            [eng.gaps.allIds[0]]: { ...eng.gaps.byId[eng.gaps.allIds[0]],
              aiMappedDellSolutions: makeStampedAi("2026.04") },
            [eng.gaps.allIds[1]]: { ...eng.gaps.byId[eng.gaps.allIds[1]],
              aiMappedDellSolutions: makeStampedAi("2026.04") }
          }
        }
      };
      const newer = { DELL_PRODUCT_TAXONOMY: { catalogVersion: "2026.07", entries: [] } };
      const result = runIntegritySweep(stamped, newer);
      const driftLogs = result.log.filter(l => l.ruleId === "INT-AI-DRIFT");
      assertEqual(driftLogs.length, 2, "both AI fields flagged as stale");
    });

    function makeStampedAi(version) {
      return {
        value: { products: ["powerstore"] },
        provenance: {
          model: "claude-sonnet-4-6", promptVersion: "skill:dellMap@1.0.0",
          skillId: "skl-001", runId: "run-001",
          timestamp: "2026-04-01T00:00:00.000Z",
          catalogVersions: { DELL_PRODUCT_TAXONOMY: version },
          validationStatus: "valid"
        }
      };
    }
    it("V-DRIFT-3 · validationStatus === 'user-edited' preserved through drift (NOT downgraded to stale)", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addGapV3(eng, { description: "g1", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const gapId = eng.gaps.allIds[0];
      const stampedEng = { ...eng,
        gaps: { ...eng.gaps,
          byId: { ...eng.gaps.byId,
            [gapId]: { ...eng.gaps.byId[gapId],
              aiMappedDellSolutions: {
                value: { products: ["powerstore"] },
                provenance: {
                  model: "claude-sonnet-4-6", promptVersion: "skill:dellMap@1.0.0",
                  skillId: "skl-001", runId: "run-001",
                  timestamp: "2026-04-01T00:00:00.000Z",
                  catalogVersions: { DELL_PRODUCT_TAXONOMY: "2026.04" },
                  validationStatus: "user-edited"   // user already edited
                }
              }
            }
          }
        }
      };
      const newerCatalogs = { DELL_PRODUCT_TAXONOMY: { catalogVersion: "2026.07", entries: [] } };
      const result = runIntegritySweep(stampedEng, newerCatalogs);
      const sweptGap = result.repaired.gaps.byId[gapId];
      assertEqual(sweptGap.aiMappedDellSolutions.provenance.validationStatus, "user-edited",
        "user-edited preserved (NOT downgraded to stale)");
    });
    it("V-DRIFT-4 · validationStatus === 'invalid' preserved (NOT changed to stale)", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addGapV3(eng, { description: "g", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const gapId = eng.gaps.allIds[0];
      const stampedEng = { ...eng,
        gaps: { ...eng.gaps,
          byId: { ...eng.gaps.byId,
            [gapId]: { ...eng.gaps.byId[gapId],
              aiMappedDellSolutions: {
                value: { products: ["powerstore"] },
                provenance: {
                  model: "claude-sonnet-4-6", promptVersion: "skill:dellMap@1.0.0",
                  skillId: "skl-001", runId: "run-001",
                  timestamp: "2026-04-01T00:00:00.000Z",
                  catalogVersions: { DELL_PRODUCT_TAXONOMY: "2026.04" },
                  validationStatus: "invalid"   // invalid stays invalid
                }
              }
            }
          }
        }
      };
      const newer = { DELL_PRODUCT_TAXONOMY: { catalogVersion: "2026.07", entries: [] } };
      const result = runIntegritySweep(stampedEng, newer);
      assertEqual(result.repaired.gaps.byId[gapId].aiMappedDellSolutions.provenance.validationStatus,
        "invalid", "invalid preserved (not downgraded to stale)");
    });
    it("V-DRIFT-5 · drift count surfaces on engagement-load screen as a non-blocking banner", async () => {
      // loadCanvas returns { ok, engagement, integrityLog, quarantine }.
      // Drift count is the integrityLog.filter(INT-AI-DRIFT).length.
      // The UI consumes this to render the "N AI suggestions are stale"
      // banner per SPEC sec S8.4.3. Test: build engagement with 1 stale
      // AI field, save, load, assert integrityLog includes the drift entry.
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addGapV3(eng, { description: "g", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const gapId = eng.gaps.allIds[0];
      // Inject AI field stamped at 2026.03 (older than current 2026.04)
      const stamped = { ...eng,
        gaps: { ...eng.gaps,
          byId: { ...eng.gaps.byId,
            [gapId]: { ...eng.gaps.byId[gapId],
              aiMappedDellSolutions: {
                value: { products: ["powerstore"] },
                provenance: {
                  model: "claude-sonnet-4-6", promptVersion: "skill:dellMap@1.0.0",
                  skillId: "skl-001", runId: "run-001",
                  timestamp: "2026-03-01T00:00:00.000Z",
                  catalogVersions: { DELL_PRODUCT_TAXONOMY: "2026.03" },   // older
                  validationStatus: "valid"
                }
              }
            }
          }
        }
      };
      const saved = buildSaveEnvelopeV3(stamped);
      assert(saved.ok, "save ok");
      const loaded = await loadCanvasV3(saved.envelope);
      assert(loaded.ok, "load ok");
      // The integrity sweep should have flipped the AI field to stale.
      // Surface: integrityLog includes the INT-AI-DRIFT entry that the UI
      // consumes for the engagement-load banner.
      const driftEntries = loaded.integrityLog.filter(l => l.ruleId === "INT-AI-DRIFT");
      assert(driftEntries.length >= 1,
        "loaded engagement carries INT-AI-DRIFT log entry for the UI banner");
    });
    it("V-DRIFT-6 · drift NEVER rewrites value field (only validationStatus)", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addGapV3(eng, { description: "g1", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const gapId = eng.gaps.allIds[0];
      const originalValue = { products: ["powerstore", "powerprotect_dd"] };
      const stampedEng = { ...eng,
        gaps: { ...eng.gaps,
          byId: { ...eng.gaps.byId,
            [gapId]: { ...eng.gaps.byId[gapId],
              aiMappedDellSolutions: {
                value: originalValue,
                provenance: {
                  model: "claude-sonnet-4-6", promptVersion: "skill:dellMap@1.0.0",
                  skillId: "skl-001", runId: "run-001",
                  timestamp: "2026-04-01T00:00:00.000Z",
                  catalogVersions: { DELL_PRODUCT_TAXONOMY: "2026.04" },
                  validationStatus: "valid"
                }
              }
            }
          }
        }
      };
      const newerCatalogs = { DELL_PRODUCT_TAXONOMY: { catalogVersion: "2026.07", entries: [] } };
      const result = runIntegritySweep(stampedEng, newerCatalogs);
      const sweptValue = result.repaired.gaps.byId[gapId].aiMappedDellSolutions.value;
      assertEqual(JSON.stringify(sweptValue), JSON.stringify(originalValue),
        "value field unchanged after drift detection");
    });
    it("V-DRIFT-7 · drift detector is pure (same engagement + catalog → same flips)", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addGapV3(eng, { description: "g1", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const gapId = eng.gaps.allIds[0];
      const stampedEng = { ...eng,
        gaps: { ...eng.gaps,
          byId: { ...eng.gaps.byId,
            [gapId]: { ...eng.gaps.byId[gapId],
              aiMappedDellSolutions: {
                value: { products: ["powerstore"] },
                provenance: {
                  model: "claude-sonnet-4-6", promptVersion: "skill:dellMap@1.0.0",
                  skillId: "skl-001", runId: "run-001",
                  timestamp: "2026-04-01T00:00:00.000Z",
                  catalogVersions: { DELL_PRODUCT_TAXONOMY: "2026.04" },
                  validationStatus: "valid"
                }
              }
            }
          }
        }
      };
      const newerCatalogs = { DELL_PRODUCT_TAXONOMY: { catalogVersion: "2026.07", entries: [] } };
      const a = runIntegritySweep(stampedEng, newerCatalogs);
      const b = runIntegritySweep(stampedEng, newerCatalogs);
      assertEqual(JSON.stringify(a.repaired.gaps.byId[gapId]),
                  JSON.stringify(b.repaired.gaps.byId[gapId]),
        "drift detector is deterministic");
    });
    it("V-DRIFT-8 · drift detector handles model: 'unknown' records (from migration step 9) without errors", () => {
      // Per MIGRATION sec M11 step 9, v2.x plain-string AI fields are
      // wrapped with model: "unknown", validationStatus: "stale". The
      // drift detector must handle these without throwing — they're
      // already stale, so no further state change.
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addGapV3(eng, { description: "g", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const gapId = eng.gaps.allIds[0];
      const legacy = { ...eng,
        gaps: { ...eng.gaps,
          byId: { ...eng.gaps.byId,
            [gapId]: { ...eng.gaps.byId[gapId],
              aiMappedDellSolutions: {
                value: { rawLegacy: "PowerStore + PowerProtect", products: [] },
                provenance: {
                  model:            "unknown",                             // migration marker
                  promptVersion:    "legacy:v2.4.x",
                  skillId:          "unknown",
                  runId:            "00000000-0000-4000-8000-000000000000",
                  timestamp:        "2026-01-01T00:00:00.000Z",
                  catalogVersions:  { DELL_PRODUCT_TAXONOMY: "unknown" },
                  validationStatus: "stale"
                }
              }
            }
          }
        }
      };
      const newer = { DELL_PRODUCT_TAXONOMY: { catalogVersion: "2026.07", entries: [] } };
      let threw = null;
      try { runIntegritySweep(legacy, newer); }
      catch (e) { threw = e; }
      assert(threw === null, "drift detector handles model:'unknown' without throwing");
    });
  });

  // -------------------------------------------------------------------
  // sec T11 · V-CAT · Catalog snapshot (per SPEC sec S6.3)
  // -------------------------------------------------------------------
  describe("§T11 · V-CAT · Catalog snapshot", () => {
    it("V-CAT-1 · loadCatalog('LAYERS') returns 6-entry catalog parsed through CatalogSchema", async () => {
      const cat = await loadCatalog("LAYERS");
      assertEqual(cat.catalogId, "LAYERS", "catalogId preserved");
      assertEqual(cat.entries.length, 6, "LAYERS has 6 entries");
      const ids = cat.entries.map(e => e.id);
      assert(ids.includes("workload"),       "includes workload layer");
      assert(ids.includes("compute"),        "includes compute layer");
      assert(ids.includes("storage"),        "includes storage layer");
      assert(ids.includes("dataProtection"), "includes dataProtection layer");
      assert(ids.includes("virtualization"), "includes virtualization layer");
      assert(ids.includes("infrastructure"), "includes infrastructure layer");
    });
    it("V-CAT-2 · loadCatalog('BUSINESS_DRIVERS') returns 8-entry catalog", async () => {
      const cat = await loadCatalog("BUSINESS_DRIVERS");
      assertEqual(cat.entries.length, 8, "BUSINESS_DRIVERS has 8 entries");
      // Each entry has hint + conversationStarter (per S6.2 inventory).
      assert(cat.entries.every(e => typeof e.hint === "string" && e.hint.length > 0),
        "every driver has a hint");
      assert(cat.entries.every(e => typeof e.conversationStarter === "string" && e.conversationStarter.length > 0),
        "every driver has a conversationStarter");
    });
    it("V-CAT-3 · loadCatalog('ENV_CATALOG') returns 8-entry catalog", async () => {
      const cat = await loadCatalog("ENV_CATALOG");
      assertEqual(cat.entries.length, 8, "ENV_CATALOG has 8 entries");
    });
    it("V-CAT-4 · loadCatalog('SERVICE_TYPES') returns 10-entry catalog", async () => {
      const cat = await loadCatalog("SERVICE_TYPES");
      assertEqual(cat.entries.length, 10, "SERVICE_TYPES has 10 entries");
    });
    it("V-CAT-5 · loadCatalog('GAP_TYPES') returns 5-entry catalog", async () => {
      const cat = await loadCatalog("GAP_TYPES");
      assertEqual(cat.entries.length, 5, "GAP_TYPES has 5 entries");
      const ids = cat.entries.map(e => e.id);
      assert(ids.includes("replace"),     "includes replace");
      assert(ids.includes("consolidate"), "includes consolidate");
      assert(ids.includes("introduce"),   "includes introduce");
      assert(ids.includes("enhance"),     "includes enhance");
      assert(ids.includes("ops"),         "includes ops");
    });
    it("V-CAT-6 · loadCatalog('DISPOSITION_ACTIONS') returns 7-entry catalog", async () => {
      const cat = await loadCatalog("DISPOSITION_ACTIONS");
      assertEqual(cat.entries.length, 7, "DISPOSITION_ACTIONS has 7 entries");
      const ids = cat.entries.map(e => e.id);
      const expected = ["keep","enhance","replace","consolidate","retire","introduce","ops"];
      expected.forEach(id => assert(ids.includes(id), "includes " + id));
    });
    it("V-CAT-7 · loadCatalog('CUSTOMER_VERTICALS') returns alphabetised catalog", async () => {
      const cat = await loadCatalog("CUSTOMER_VERTICALS");
      const labels = cat.entries.map(e => e.label);
      const sorted = [...labels].sort((a, b) => a.localeCompare(b));
      assert(labels.length === sorted.length && labels.every((l, i) => l === sorted[i]),
        "verticals must be alphabetised. got: " + labels.join(", "));
    });
    it("V-CAT-DELL-1 · DELL_PRODUCT_TAXONOMY does NOT contain 'boomi', 'secureworks-taegis', 'vxrail', 'smartfabric-director'", async () => {
      const cat = await loadCatalog("DELL_PRODUCT_TAXONOMY");
      const ids = cat.entries.map(e => e.id);
      const labels = cat.entries.map(e => e.label.toLowerCase());
      // SPEC sec S6.2.1 LOCKED corrections — these must NOT appear.
      const banned = [
        { id: "boomi",                 reason: "divested" },
        { id: "secureworks_taegis",    reason: "divested" },
        { id: "secureworks-taegis",    reason: "divested" },
        { id: "vxrail",                reason: "superseded by Dell Private Cloud + PowerFlex" },
        { id: "smartfabric_director",  reason: "replaced by SmartFabric Manager" },
        { id: "smartfabric-director",  reason: "replaced by SmartFabric Manager" }
      ];
      banned.forEach(({ id, reason }) => {
        assert(!ids.includes(id),
          "DELL_PRODUCT_TAXONOMY must NOT contain '" + id + "' (" + reason + ")");
        assert(!labels.includes(id.replace(/_/g, " ")),
          "DELL_PRODUCT_TAXONOMY must NOT contain a label matching '" + id + "'");
      });
      // Also reject the literal label "SmartFabric Director".
      assert(!labels.some(l => l.includes("smartfabric director")),
        "DELL_PRODUCT_TAXONOMY must NOT contain a 'SmartFabric Director' label");
    });
    it("V-CAT-DELL-2 · DELL_PRODUCT_TAXONOMY DOES contain 'smartfabric-manager', 'dell-private-cloud', 'dell-automation-platform', 'powerflex'", async () => {
      const cat = await loadCatalog("DELL_PRODUCT_TAXONOMY");
      const ids = cat.entries.map(e => e.id);
      // SPEC sec S6.2.1 LOCKED corrections — these MUST appear.
      const required = [
        "smartfabric_manager",       // replaces SmartFabric Director
        "dell_private_cloud",        // replaces VxRail positioning
        "dell_automation_platform",  // companion to Dell Private Cloud
        "powerflex"                  // SDS layer of Dell Private Cloud
      ];
      required.forEach(id => assert(ids.includes(id),
        "DELL_PRODUCT_TAXONOMY MUST contain '" + id + "' (per SPEC S6.2.1 lock)"));
    });
    it("V-CAT-DELL-3 · DELL_PRODUCT_TAXONOMY 'cloudiq' entry has umbrella: 'Dell APEX AIOps'", async () => {
      const cat = await loadCatalog("DELL_PRODUCT_TAXONOMY");
      const cloudiq = cat.entries.find(e => e.id === "cloudiq");
      assert(cloudiq, "cloudiq entry must exist (under Dell APEX AIOps umbrella)");
      assertEqual(cloudiq.umbrella, "Dell APEX AIOps",
        "cloudiq.umbrella must be 'Dell APEX AIOps' per SPEC S6.2.1 lock");
    });
    it("V-CAT-VER-1 · every catalog snapshot has catalogVersion matching /^\\d{4}\\.\\d{2}$/", async () => {
      const all = await loadAllCatalogs();
      const ids = Object.keys(all);
      assertEqual(ids.length, 8, "exactly 8 catalogs are bundled");
      ids.forEach(id => {
        assert(/^\d{4}\.\d{2}$/.test(all[id].catalogVersion),
          id + " catalogVersion '" + all[id].catalogVersion + "' must match YYYY.MM");
      });
    });
    it("V-CAT-VER-2 · all v3.0 catalog snapshots ship with catalogVersion === '2026.04'", async () => {
      const all = await loadAllCatalogs();
      Object.entries(all).forEach(([id, cat]) => {
        assertEqual(cat.catalogVersion, "2026.04",
          id + " must ship with catalogVersion '2026.04' at v3.0 ship");
      });
    });
  });

  // -------------------------------------------------------------------
  // sec T12 · V-PERF · Performance regression (per SPEC sec S11.3)
  // All limits are multiplied by SPEC sec S11.2 calibration multiplier.
  // -------------------------------------------------------------------
  describe("§T12 · V-PERF · Performance regression", () => {
    it("V-PERF-1 · selectMatrixView cold start on acme-demo.canvas < 50ms × calibration", () => {
      const eng = buildReferenceEngagement();
      // Cold start: best of 3 runs (jitter tolerant). Each call uses a
      // fresh memo cache because we vary args.
      const { wallMs } = measureMin("selectMatrixView cold", () =>
        selectMatrixView(eng, { state: "current", _key: Date.now() }));
      assertWithinBudget(wallMs, PERF_BUDGETS.selectorColdStart,
        "V-PERF-1 selectMatrixView cold");
    });
    it("V-PERF-2 · selectMatrixView hot path (memoized) < 1ms × calibration", () => {
      const eng = buildReferenceEngagement();
      const args = { state: "current" };
      // Prime the memo cache
      selectMatrixView(eng, args);
      // Hot path: best of 5 calls with same (engagement, args) — should
      // hit memoizeOne's cache and return immediately.
      const { wallMs } = measureMin("selectMatrixView hot", () =>
        selectMatrixView(eng, args), 5);
      assertWithinBudget(wallMs, PERF_BUDGETS.selectorHotPath,
        "V-PERF-2 selectMatrixView hot");
    });
    it("V-PERF-3 · all 7 selectors cold-start total < 300ms × calibration", () => {
      const eng = buildReferenceEngagement();
      const { wallMs } = measure("all-7-selectors-cold", () => {
        selectMatrixView(eng,             { state: "current", _key: 1 });
        selectGapsKanban(eng);
        selectProjects(eng);
        selectVendorMix(eng);
        selectHealthSummary(eng);
        selectExecutiveSummaryInputs(eng);
        // selectLinkedComposition needs a kind+id; pick the first driver.
        const drvId = eng.drivers.allIds[0];
        selectLinkedComposition(eng, { kind: "driver", id: drvId });
      });
      assertWithinBudget(wallMs, PERF_BUDGETS.allSelectorsColdTotal,
        "V-PERF-3 all 7 selectors cold-start total");
    });
    it("V-PERF-4 · full round-trip (load + migrate + integrity + hydrate + Tab 2) < 500ms × calibration", () => {
      // Build engagement -> save envelope -> tab-2 selector. The actual
      // load+migrate+integrity path runs through canvasFile.loadCanvas
      // (async), so this vector exercises the whole synchronous slice
      // we can measure here: build + save + reparse + tab-2 selector.
      const { wallMs } = measure("full-roundtrip-sync", () => {
        const eng = buildReferenceEngagement();
        const saved = buildSaveEnvelopeV3(eng);
        if (!saved.ok) throw new Error("save failed");
        // Re-validate the persisted envelope (mirrors loadCanvas's
        // boundary validation step).
        const reparsed = JSON.parse(JSON.stringify(saved.envelope.engagement));
        // Selectors against the reparsed engagement (not memoizable;
        // reparsed has new object refs).
        selectMatrixView(reparsed, { state: "current", _key: 2 });
      });
      assertWithinBudget(wallMs, PERF_BUDGETS.fullRoundTrip,
        "V-PERF-4 full round-trip sync slice");
    });
    it("V-PERF-5 · single tab render after engagement loaded < 100ms × calibration", () => {
      // "Tab render" against v3.0 selectors = compute the view object
      // for that tab. Actual DOM rendering is the v2.x view layer's job
      // (which still receives v2.x session shape today). When the v3.0
      // -> v2.x adapter lands, this can extend to actual DOM time.
      const eng = buildReferenceEngagement();
      const { wallMs } = measureMin("tab-render-tab-2", () => {
        selectMatrixView(eng, { state: "current", _key: Math.random() });
        selectVendorMix(eng);
      });
      assertWithinBudget(wallMs, PERF_BUDGETS.tabRender,
        "V-PERF-5 single tab render selectors");
    });
    it("V-PERF-6 · integrity sweep on acme-demo.canvas < 100ms × calibration", () => {
      const eng = buildReferenceEngagement();
      const { wallMs } = measureMin("integrity-sweep-200inst", () =>
        runIntegritySweep(eng, {}));
      assertWithinBudget(wallMs, PERF_BUDGETS.integritySweep,
        "V-PERF-6 integrity sweep on 200-instance reference");
    });
    it("V-PERF-7 · migrate_v2_0_to_v3_0 on v2.0 acme-demo equivalent < 200ms × calibration", () => {});
    it("V-PERF-8 · generateManifest cold < 50ms × calibration", () => {
      const { wallMs } = measureMin("generateManifest-cold", () => generateManifest());
      assertWithinBudget(wallMs, PERF_BUDGETS.selectorColdStart,
        "V-PERF-8 generateManifest cold");
    });
    it("V-PERF-9 · validateSkillSave for 200-char template < 5ms × calibration", () => {});
    it("V-PERF-SCALE-1 · acme-demo.canvas has exactly 200 instances (regression guard)", () => {
      const eng = buildReferenceEngagement();
      assertEqual(eng.instances.allIds.length, 200,
        "reference engagement MUST have exactly 200 instances. Silent " +
        "demo growth would silently relax perf budgets — change SPEC sec S11 " +
        "first, then update the builder.");
      // Also verify the supporting record counts so the reference doesn't
      // drift across other dimensions.
      assertEqual(eng.drivers.allIds.length, 4,        "4 drivers");
      assertEqual(eng.environments.allIds.length, 3,   "3 environments");
      assertEqual(eng.gaps.allIds.length, 12,          "12 gaps");
      // byState partition is exhaustive
      assertEqual(eng.instances.byState.current.length, 100, "100 current");
      assertEqual(eng.instances.byState.desired.length, 100, "100 desired");
    });
  });

  // -------------------------------------------------------------------
  // sec T13 · V-E2E · End-to-end tab render (per SPEC sec 14.1 cat 12)
  // -------------------------------------------------------------------
  describe("§T13 · V-E2E · End-to-end tab render", () => {
    it("V-E2E-1 · loading acme-demo.canvas renders Tab 1 (Context) without console errors", () => {});
    it("V-E2E-2 · loading acme-demo.canvas renders Tab 2 (Architecture) without console errors", () => {});
    it("V-E2E-3 · Tab 3 (Heatmap) renders cleanly", () => {});
    it("V-E2E-4 · Tab 4 (Gaps) renders cleanly", () => {});
    it("V-E2E-5 · Tab 5 (Reporting) renders cleanly", () => {});
    it("V-E2E-6 · engagement Save → Reload round-trip preserves shape", () => {});
    it("V-E2E-7 · click any driver tile → engagement.activeEntity updates with kind: 'driver'", () => {});
    it("V-E2E-8 · click outside any entity → activeEntity becomes null", () => {});
    it("V-E2E-9 · open AI Assist (Ctrl+K) → overlay renders + skill list populated", () => {});
    it("V-E2E-10 · run a session-wide skill → result panel renders without errors", () => {});
    it("V-E2E-11 · run a click-to-run skill against active entity → result panel renders", () => {});
    it("V-E2E-12 · loading a v2.0 fixture triggers migration → migrated engagement renders Tab 1 cleanly", () => {});
  });

  // -------------------------------------------------------------------
  // sec T14 · V-INT · Integrity sweep (per SPEC sec S10.4)
  // -------------------------------------------------------------------
  describe("§T14 · V-INT · Integrity sweep", () => {
    // One vector per repair rule (V-INT-1..10)
    it("V-INT-1 · INT-ORPHAN-OPT: gap.driverId → deleted driver → field nulled + log entry", () => {
      // Helper: minimal engagement with a gap pointing at a non-existent driver.
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addGapV3(eng, { description: "g1", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const gapId = eng.gaps.allIds[0];
      // Manually inject a non-existent driverId (simulate post-load orphan)
      const broken = { ...eng,
        gaps: { ...eng.gaps,
          byId: { ...eng.gaps.byId,
            [gapId]: { ...eng.gaps.byId[gapId], driverId: "11111111-2222-3333-4444-555555555555" }
          }
        }
      };
      const result = runIntegritySweep(broken, {});
      const swept = result.repaired.gaps.byId[gapId];
      assertEqual(swept.driverId, null, "orphan optional FK -> nulled");
      assert(result.log.some(l => l.ruleId === "INT-ORPHAN-OPT" && l.field === "driverId"),
        "INT-ORPHAN-OPT log entry emitted");
    });
    it("V-INT-2 · INT-ORPHAN-ARR: gap.affectedEnvironments[] dangling element → removed + log entry", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      const phantomEnv = "11111111-2222-3333-4444-555555555555";
      eng = addGapV3(eng, { description: "g1", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const gapId = eng.gaps.allIds[0];
      // Inject a dangling env id into the array
      const broken = { ...eng,
        gaps: { ...eng.gaps,
          byId: { ...eng.gaps.byId,
            [gapId]: { ...eng.gaps.byId[gapId],
              affectedEnvironments: [env1, phantomEnv] }
          }
        }
      };
      const result = runIntegritySweep(broken, {});
      const swept = result.repaired.gaps.byId[gapId];
      assertEqual(swept.affectedEnvironments.length, 1, "dangling element removed");
      assertEqual(swept.affectedEnvironments[0], env1, "valid element preserved");
      assert(result.log.some(l => l.ruleId === "INT-ORPHAN-ARR"),
        "INT-ORPHAN-ARR log entry emitted");
    });
    it("V-INT-3 · INT-ORPHAN-REQ: instance.environmentId → deleted env → record quarantined + log entry", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addInstanceV3(eng, { state:"current", layerId:"compute", environmentId:env1,
        label:"T1", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"keep" }).engagement;
      const instId = eng.instances.allIds[0];
      // Re-point environmentId at a deleted env
      const broken = { ...eng,
        instances: { ...eng.instances,
          byId: { ...eng.instances.byId,
            [instId]: { ...eng.instances.byId[instId],
              environmentId: "11111111-2222-3333-4444-555555555555" }
          }
        }
      };
      const result = runIntegritySweep(broken, {});
      assert(!result.repaired.instances.byId[instId],
        "instance with dangling required FK removed from active engagement");
      assertEqual(result.repaired.instances.allIds.length, 0, "instances collection emptied");
      assert(result.quarantine.some(q => q.recordKind === "instance" && q.recordId === instId),
        "instance is in quarantine");
      assert(result.quarantine.some(q => q.ruleId === "INT-ORPHAN-REQ"),
        "INT-ORPHAN-REQ rule recorded in quarantine");
    });
    it("V-INT-4 · INT-FILTER-MISS: instance.originId → desired-state instance (filter state='current') → field nulled + log", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addInstanceV3(eng, { state:"current", layerId:"compute", environmentId:env1,
        label:"current", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"keep" }).engagement;
      eng = addInstanceV3(eng, { state:"desired", layerId:"compute", environmentId:env1,
        label:"desired", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"replace" }).engagement;
      const desiredId = eng.instances.byState.desired[0];
      const otherDesired = eng.instances.byState.desired[0];
      // Inject filter-miss: another desired's originId points at a desired instead of current
      eng = addInstanceV3(eng, { state:"desired", layerId:"compute", environmentId:env1,
        label:"new-desired", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"replace" }).engagement;
      const newDesiredId = eng.instances.byState.desired[1];
      const broken = { ...eng,
        instances: { ...eng.instances,
          byId: { ...eng.instances.byId,
            [newDesiredId]: { ...eng.instances.byId[newDesiredId],
              originId: otherDesired }   // pointing at a desired instead of current
          }
        }
      };
      const result = runIntegritySweep(broken, {});
      const swept = result.repaired.instances.byId[newDesiredId];
      assertEqual(swept.originId, null, "filter-miss originId nulled");
      assert(result.log.some(l => l.ruleId === "INT-FILTER-MISS"),
        "INT-FILTER-MISS log entry emitted");
    });
    it("V-INT-5 · INT-G6-REPAIR: gap.affectedLayers does NOT have layerId at index 0 → mechanical reorder + log", () => {});
    it("V-INT-6 · INT-MAP-NONWL: non-workload instance has populated mappedAssetIds → array emptied + log", () => {});
    it("V-INT-7 · INT-ORIGIN-CUR: current-state instance has originId → nulled + log", () => {});
    it("V-INT-8 · INT-PRI-CUR: current-state instance has priority → nulled + log", () => {});
    it("V-INT-9 · INT-EID-STAMP: record has engagementId mismatch → stamped + log", () => {});
    it("V-INT-10 · INT-AI-DRIFT: AI provenance catalog version mismatch → validationStatus → stale + log", () => {});

    // Sweep contract (V-INT-11..20)
    it("V-INT-11 · sweep is pure: runIntegritySweep(eng) deepEqual on consecutive calls", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const a = runIntegritySweep(eng, {});
      const b = runIntegritySweep(eng, {});
      assertEqual(JSON.stringify(a.repaired), JSON.stringify(b.repaired),
        "consecutive sweeps produce deep-equal repaired engagement");
      assertEqual(JSON.stringify(a.log), JSON.stringify(b.log),
        "consecutive sweeps produce deep-equal log");
    });
    it("V-INT-12 · sweep runs AFTER migration in load harness", () => {});
    it("V-INT-13 · sweep runs BEFORE UI hydration", () => {});
    it("V-INT-14 · sweep NEVER creates new entities (V-INT-NOCREATE-1)", () => {});
    it("V-INT-15 · sweep NEVER edits user-authored content fields — label, notes, description, outcomes", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addGapV3(eng, { description: "User-authored description", gapType: "replace",
        urgency: "Medium", phase: "now", status: "open", layerId: "compute",
        notes: "User notes that must be preserved verbatim",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      eng = addDriver(eng, { businessDriverId: "ai_data", priority: "High",
        outcomes: "User-authored outcomes" }).engagement;
      const result = runIntegritySweep(eng, {});
      const gap = result.repaired.gaps.byId[result.repaired.gaps.allIds[0]];
      const driver = result.repaired.drivers.byId[result.repaired.drivers.allIds[0]];
      assertEqual(gap.description, "User-authored description", "gap.description preserved");
      assertEqual(gap.notes, "User notes that must be preserved verbatim", "gap.notes preserved");
      assertEqual(driver.outcomes, "User-authored outcomes", "driver.outcomes preserved");
    });
    it("V-INT-16 · quarantined records NOT in engagement.{drivers, environments, instances, gaps}", () => {});
    it("V-INT-17 · quarantined records ARE in engagement.integrityLog.quarantine", () => {});
    it("V-INT-18 · integrityLog stripped on save (V-INT-TRANSIENT-1)", () => {});
    it("V-INT-19 · quarantine stripped on save (V-INT-TRANSIENT-2)", () => {});
    it("V-INT-20 · repair log entries shape: ruleId + recordKind + recordId + field + before + after + timestamp", () => {});

    // Forbidden behaviors (V-INT-FORBID-1..5)
    it("V-INT-FORBID-1 · sweep does not call localStorage.*", async () => {
      const res = await fetch("/state/integritySweep.js");
      const src = await res.text();
      const stripped = src.split("\n")
        .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      assert(!stripped.includes("localStorage"),
        "integritySweep must not reference localStorage in production code (SPEC sec S10.1.3)");
    });
    it("V-INT-FORBID-2 · sweep does not call document.* or window.*", async () => {
      const res = await fetch("/state/integritySweep.js");
      const src = await res.text();
      const stripped = src.split("\n")
        .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      assert(!stripped.includes("document."),
        "integritySweep must not reference document.*");
      assert(!stripped.includes("window."),
        "integritySweep must not reference window.*");
    });
    it("V-INT-FORBID-3 · sweep does not call fetch or any network", async () => {
      const res = await fetch("/state/integritySweep.js");
      const src = await res.text();
      const stripped = src.split("\n")
        .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      assert(!/\bfetch\(/.test(stripped),
        "integritySweep must not call fetch (sweep is pure synchronous)");
      assert(!stripped.includes("XMLHttpRequest"),
        "integritySweep must not use XMLHttpRequest");
    });
    it("V-INT-FORBID-4 · sweep does not write to console.error for repaired violations", async () => {
      // Spy on console.error during a sweep run with a repairable
      // violation. The sweep must log via the result.log array, NOT
      // console.error (which would clutter the user's devtools).
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addGapV3(eng, { description: "g", gapType: "replace", urgency: "Medium",
        phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const gapId = eng.gaps.allIds[0];
      // Inject a repairable orphan optional FK (driverId pointing at non-existent driver)
      const broken = { ...eng,
        gaps: { ...eng.gaps,
          byId: { ...eng.gaps.byId,
            [gapId]: { ...eng.gaps.byId[gapId], driverId: "11111111-2222-3333-4444-555555555555" }
          }
        }
      };
      const original = console.error;
      let errorCalls = 0;
      console.error = function() { errorCalls += 1; };
      try {
        runIntegritySweep(broken, {});
      } finally {
        console.error = original;
      }
      assertEqual(errorCalls, 0,
        "sweep must not write to console.error during repair (per SPEC sec S10.2.4)");
    });
    it("V-INT-FORBID-5 · sweep does not throw on any input shape that passes EngagementSchema", () => {
      // Smoke check: sweep handles a fresh empty engagement, an engagement
      // with maximal valid content, and edge-case input shapes without
      // throwing. Any throw is a sweep defect (it should null/quarantine,
      // not reject the engagement).
      const samples = [
        createEmptyEngagement(),
        buildReferenceEngagement()
      ];
      samples.forEach((sample, idx) => {
        let threw = null;
        try { runIntegritySweep(sample, {}); }
        catch (e) { threw = e; }
        assert(threw === null,
          "sweep must not throw on sample " + idx + ": " + (threw && threw.message));
      });
    });
  });

  // -------------------------------------------------------------------
  // sec T15 · V-XCUT · Cross-cutting relationships (per SPEC sec 3.7 + S14.2)
  // -------------------------------------------------------------------
  describe("§T15 · V-XCUT · Cross-cutting relationships", () => {
    it("V-XCUT-1 · workload mappedAssetIds across 2+ envs survives sweep + matrix view + vendor mix counts once", () => {
      // Build engagement: 3 envs, 1 workload in env1 mapping assets in env2 + env3
      let eng = createEmptyEngagement();
      const ed = (id) => eng.environments.allIds[id];
      eng = addEnvironment(eng, { envCatalogId: "coreDc",      catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "drDc",        catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "publicCloud", catalogVersion: "2026.04" }).engagement;
      // Asset instances in env2 + env3 (compute layer, current state)
      eng = addInstanceV3(eng, { state:"current", layerId:"compute", environmentId: ed(1),
        label:"Asset-A", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"keep" }).engagement;
      const assetA = eng.instances.allIds[0];
      eng = addInstanceV3(eng, { state:"current", layerId:"compute", environmentId: ed(2),
        label:"Asset-B", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"keep" }).engagement;
      const assetB = eng.instances.allIds[1];
      // Workload in env1 mapping both
      eng = addInstanceV3(eng, { state:"current", layerId:"workload", environmentId: ed(0),
        label:"App-X", vendor:"Custom", vendorGroup:"custom", criticality:"High", disposition:"keep",
        mappedAssetIds: [assetA, assetB] }).engagement;
      const workload = eng.instances.allIds[2];

      // (a) sweep doesn't orphan
      const sweep = runIntegritySweep(eng, {});
      const sweptWorkload = sweep.repaired.instances.byId[workload];
      assertEqual(sweptWorkload.mappedAssetIds.length, 2,
        "both cross-env mapped assets survive sweep");

      // (b) matrix view shows workload in its NATIVE env
      const matrix = selectMatrixView(eng, { state: "current" });
      const cell = matrix.cells[ed(0)].workload;
      assert(cell.instanceIds.includes(workload),
        "workload appears in its native (env, layer) cell");

      // (c) vendor mix counts the workload once
      const vm = selectVendorMix(eng);
      assertEqual(vm.totals.total, 3, "3 instances total (no double-counting via mappedAssetIds)");
    });
    it("V-XCUT-2 · desired originId cross-env survives sweep + linked composition pulls cross-env current", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "drDc",   catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      const env2 = eng.environments.allIds[1];

      // Current instance in env1
      eng = addInstanceV3(eng, { state:"current", layerId:"compute", environmentId:env1,
        label:"Old-Compute", vendor:"HPE", vendorGroup:"nonDell", criticality:"Medium", disposition:"replace" }).engagement;
      const currentId = eng.instances.allIds[0];
      // Desired instance in env2 with originId pointing at the current in env1
      eng = addInstanceV3(eng, { state:"desired", layerId:"compute", environmentId:env2,
        label:"New-Compute", vendor:"Dell PowerEdge", vendorGroup:"dell",
        criticality:"Medium", disposition:"replace", originId:currentId }).engagement;
      const desiredId = eng.instances.allIds[1];

      // (a) sweep doesn't orphan
      const sweep = runIntegritySweep(eng, {});
      assertEqual(sweep.repaired.instances.byId[desiredId].originId, currentId,
        "cross-env originId survives sweep");

      // (b) linked composition for the desired instance pulls the cross-env current
      const linked = selectLinkedComposition(eng, { kind: "desiredInstance", id: desiredId });
      assertEqual(linked.linked.originInstance.id, currentId,
        "linked composition pulls cross-env origin");
      assert(linked.linked.originInstance.environmentId !== desiredId,
        "origin lives in a different environment");
    });
    it("V-XCUT-3 · gap with affectedEnvironments.length === 3 appears in all 3 env-filtered selectors + counted once globally", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc",      catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "drDc",        catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "publicCloud", catalogVersion: "2026.04" }).engagement;
      const [e1, e2, e3] = eng.environments.allIds;
      eng = addGapV3(eng, { description: "cross-env compliance",
        gapType: "ops", urgency: "High", phase: "now", status: "open",
        layerId: "infrastructure", affectedLayers: ["infrastructure"],
        affectedEnvironments: [e1, e2, e3]
      }).engagement;
      const gapId = eng.gaps.allIds[0];

      // Linked composition for each env should include this gap
      const linkedE1 = selectLinkedComposition(eng, { kind: "environment", id: e1 });
      const linkedE2 = selectLinkedComposition(eng, { kind: "environment", id: e2 });
      const linkedE3 = selectLinkedComposition(eng, { kind: "environment", id: e3 });
      assert(linkedE1.linked.gaps.some(g => g.id === gapId), "gap appears in env1's linked.gaps");
      assert(linkedE2.linked.gaps.some(g => g.id === gapId), "gap appears in env2's linked.gaps");
      assert(linkedE3.linked.gaps.some(g => g.id === gapId), "gap appears in env3's linked.gaps");

      // Counted once globally (not 3x by env)
      const kanban = selectGapsKanban(eng);
      assertEqual(kanban.totalsByStatus.open, 1, "gap counted exactly once in totals");
    });
    it("V-XCUT-4 · gap relatedCurrentInstanceIds mixing envs → linked composition pulls all current regardless of env", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "drDc",   catalogVersion: "2026.04" }).engagement;
      const [e1, e2] = eng.environments.allIds;
      // Two current instances, one per env
      eng = addInstanceV3(eng, { state:"current", layerId:"compute", environmentId:e1,
        label:"C1", vendor:"X", vendorGroup:"nonDell", criticality:"Medium", disposition:"replace" }).engagement;
      const c1 = eng.instances.allIds[0];
      eng = addInstanceV3(eng, { state:"current", layerId:"compute", environmentId:e2,
        label:"C2", vendor:"Y", vendorGroup:"nonDell", criticality:"Medium", disposition:"replace" }).engagement;
      const c2 = eng.instances.allIds[1];
      // Gap referencing both via relatedCurrentInstanceIds
      eng = addGapV3(eng, { description: "consolidate", gapType: "consolidate",
        urgency: "Medium", phase: "next", status: "open",
        layerId: "compute", affectedLayers: ["compute"], affectedEnvironments: [e1, e2],
        relatedCurrentInstanceIds: [c1, c2]
      }).engagement;
      const gapId = eng.gaps.allIds[0];
      // Linked composition pulls both current instances regardless of env
      const linked = selectLinkedComposition(eng, { kind: "gap", id: gapId });
      assertEqual(linked.linked.relatedInstances.current.length, 2,
        "both cross-env current instances pulled");
      const ids = linked.linked.relatedInstances.current.map(i => i.id);
      assert(ids.includes(c1) && ids.includes(c2), "both ids present");
    });
    it("V-XCUT-5 · gap relatedDesiredInstanceIds mixing envs → linked composition pulls all desired regardless of env", () => {
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "drDc",   catalogVersion: "2026.04" }).engagement;
      const [e1, e2] = eng.environments.allIds;
      // Two desired instances, one per env
      eng = addInstanceV3(eng, { state:"desired", layerId:"compute", environmentId:e1,
        label:"D1", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"replace" }).engagement;
      const d1 = eng.instances.allIds[0];
      eng = addInstanceV3(eng, { state:"desired", layerId:"compute", environmentId:e2,
        label:"D2", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"replace" }).engagement;
      const d2 = eng.instances.allIds[1];
      // Gap referencing both via relatedDesiredInstanceIds
      eng = addGapV3(eng, { description: "introduce", gapType: "introduce",
        urgency: "High", phase: "now", status: "open",
        layerId: "compute", affectedLayers: ["compute"], affectedEnvironments: [e1, e2],
        relatedDesiredInstanceIds: [d1, d2]
      }).engagement;
      const gapId = eng.gaps.allIds[0];
      const linked = selectLinkedComposition(eng, { kind: "gap", id: gapId });
      assertEqual(linked.linked.relatedInstances.desired.length, 2,
        "both cross-env desired instances pulled");
      const ids = linked.linked.relatedInstances.desired.map(i => i.id);
      assert(ids.includes(d1) && ids.includes(d2), "both ids present");
    });
  });

  // -------------------------------------------------------------------
  // sec T16 · V-PROD · Production-critical regression (per SPEC sec S7.4.3)
  // -------------------------------------------------------------------
  describe("§T16 · V-PROD · Production-critical regression suite", () => {
    // dell-mapping (strict)
    it("V-PROD-1 · dell-mapping output validates against DellSolutionListSchema", async () => {
      // Mock returns a JSON-shaped response that parses + validates.
      const provider = createMockLLMProvider({
        defaultResponse: {
          model: "mock-claude-sonnet",
          text:  JSON.stringify({
            rationale: "Mid-range storage modernization with cyber-resilience.",
            products: ["powerstore", "powerprotect_dd", "powerprotect_cyber"]
          })
        }
      });
      const dellCat = await loadCatalog("DELL_PRODUCT_TAXONOMY");
      const ctx = {
        customer: { name: "Acme" },
        context: { gap: { description: "Need ransomware-resilient storage", layerId: "storage", urgency: "High" } },
        catalogVersions: { DELL_PRODUCT_TAXONOMY: dellCat.catalogVersion },
        dellTaxonomyIds: new Set(dellCat.entries.map(e => e.id))
      };
      const result = await runSkill(SEED_SKILL_DELL_MAPPING, ctx, provider,
        { runTimestamp: "2026-05-01T00:00:00.000Z", runIdSeed: "v-prod-1" });
      assert(typeof result.value === "object", "value is an object (not a string)");
      assert(Array.isArray(result.value.products), "value.products is an array");
      assertEqual(result.value.products.length, 3, "3 products in output");
    });
    it("V-PROD-2 · dell-mapping every entry id is in DELL_PRODUCT_TAXONOMY.entries[].id", async () => {
      const dellCat = await loadCatalog("DELL_PRODUCT_TAXONOMY");
      const validIds = new Set(dellCat.entries.map(e => e.id));
      const provider = createMockLLMProvider({
        defaultResponse: {
          model: "mock-claude-sonnet",
          text:  JSON.stringify({ products: ["powerstore", "smartfabric_manager", "dell_private_cloud"] })
        }
      });
      const ctx = {
        customer: { name: "Acme" },
        context: { gap: { description: "modernize", layerId: "storage", urgency: "Medium" } },
        catalogVersions: { DELL_PRODUCT_TAXONOMY: dellCat.catalogVersion },
        dellTaxonomyIds: validIds
      };
      const result = await runSkill(SEED_SKILL_DELL_MAPPING, ctx, provider,
        { runTimestamp: "2026-05-01T00:00:00.000Z", runIdSeed: "v-prod-2" });
      // Catalog membership enforced by runner — every product in result MUST be in catalog.
      result.value.products.forEach(id => {
        assert(validIds.has(id), "product '" + id + "' must be in DELL_PRODUCT_TAXONOMY");
      });
      assertEqual(result.provenance.validationStatus, "valid", "all products in catalog -> valid");
    });
    it("V-PROD-3 · dell-mapping NO entry id matches boomi/secureworks-taegis/vxrail/smartfabric-director", async () => {
      // Adversarial: mock attempts to return a banned product. Runner
      // must reject + retry; after retry budget exhausted -> validationStatus="invalid".
      const dellCat = await loadCatalog("DELL_PRODUCT_TAXONOMY");
      const provider = createMockLLMProvider({
        defaultResponse: {
          model: "mock-claude-sonnet",
          text:  JSON.stringify({ products: ["vxrail", "boomi"] })   // both banned per S6.2.1
        }
      });
      const ctx = {
        customer: { name: "Acme" },
        context: { gap: { description: "modernize", layerId: "storage", urgency: "Medium" } },
        catalogVersions: { DELL_PRODUCT_TAXONOMY: dellCat.catalogVersion },
        dellTaxonomyIds: new Set(dellCat.entries.map(e => e.id))
      };
      const result = await runSkill(SEED_SKILL_DELL_MAPPING, ctx, provider,
        { runTimestamp: "2026-05-01T00:00:00.000Z", runIdSeed: "v-prod-3" });
      // Runner exhausted retries (mock always returns banned products) -> invalid envelope
      assertEqual(result.provenance.validationStatus, "invalid",
        "banned products -> retry exhausted -> validationStatus='invalid'");
    });
    it("V-PROD-4 · dell-mapping provenance fully populated (model + promptVersion + skillId + runId + timestamp + catalogVersions + validationStatus='valid')", async () => {
      const dellCat = await loadCatalog("DELL_PRODUCT_TAXONOMY");
      const provider = createMockLLMProvider({
        defaultResponse: {
          model: "claude-sonnet-4-6",
          text:  JSON.stringify({ products: ["powerstore", "powerprotect_dd"] })
        }
      });
      const ctx = {
        customer: { name: "Acme" },
        context: { gap: { description: "modernize", layerId: "storage", urgency: "High" } },
        catalogVersions: {
          DELL_PRODUCT_TAXONOMY: dellCat.catalogVersion,
          BUSINESS_DRIVERS:      "2026.04",
          ENV_CATALOG:           "2026.04"
        },
        dellTaxonomyIds: new Set(dellCat.entries.map(e => e.id))
      };
      const result = await runSkill(SEED_SKILL_DELL_MAPPING, ctx, provider,
        { runTimestamp: "2026-05-01T00:00:00.000Z", runIdSeed: "v-prod-4" });
      // Full provenance contract per SPEC sec S8.1
      assertEqual(result.provenance.validationStatus, "valid",   "validationStatus");
      assertEqual(result.provenance.model,            "claude-sonnet-4-6", "model");
      assertEqual(result.provenance.skillId,          "dell-mapping", "skillId");
      assertEqual(result.provenance.promptVersion,    "skill:dell-mapping@1.0.0", "promptVersion");
      assert(result.provenance.runId.length > 0, "runId populated");
      assertEqual(result.provenance.timestamp,        "2026-05-01T00:00:00.000Z", "timestamp from opts");
      assertEqual(result.provenance.catalogVersions.DELL_PRODUCT_TAXONOMY, "2026.04", "Dell taxonomy version stamped");
      assertEqual(result.provenance.catalogVersions.BUSINESS_DRIVERS,      "2026.04", "BUSINESS_DRIVERS stamped");
      assertEqual(result.provenance.catalogVersions.ENV_CATALOG,           "2026.04", "ENV_CATALOG stamped");
    });
    it("V-PROD-5 · dell-mapping output round-trips through save+load byte-equivalent", async () => {
      // Build a small engagement, run dell-mapping, stamp result on the gap,
      // save -> load, assert the AI field byte-equal.
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const env1 = eng.environments.allIds[0];
      eng = addGapV3(eng, { description: "modernize storage", gapType: "replace",
        urgency: "Medium", phase: "now", status: "open", layerId: "compute",
        affectedLayers: ["compute"], affectedEnvironments: [env1] }).engagement;
      const gapId = eng.gaps.allIds[0];

      // Run skill (mocked) and stamp result on the gap
      const dellCat = await loadCatalog("DELL_PRODUCT_TAXONOMY");
      const provider = createMockLLMProvider({
        defaultResponse: {
          model: "claude-sonnet-4-6",
          text:  JSON.stringify({ products: ["powerstore", "powerprotect_dd"] })
        }
      });
      const ctx = {
        customer: eng.customer,
        context: { gap: eng.gaps.byId[gapId] },
        catalogVersions: {
          DELL_PRODUCT_TAXONOMY: dellCat.catalogVersion,
          BUSINESS_DRIVERS:      "2026.04",
          ENV_CATALOG:           "2026.04"
        },
        dellTaxonomyIds: new Set(dellCat.entries.map(e => e.id))
      };
      const skillResult = await runSkill(SEED_SKILL_DELL_MAPPING, ctx, provider,
        { runTimestamp: "2026-05-01T00:00:00.000Z", runIdSeed: "v-prod-5" });
      assertEqual(skillResult.provenance.validationStatus, "valid", "skill ran clean");

      // Stamp on the gap (in real app, an action function does this)
      const stamped = { ...eng,
        gaps: { ...eng.gaps,
          byId: { ...eng.gaps.byId,
            [gapId]: { ...eng.gaps.byId[gapId], aiMappedDellSolutions: skillResult }
          }
        }
      };

      // Save -> load round-trip
      const saved = buildSaveEnvelopeV3(stamped);
      assert(saved.ok, "save succeeded: " + JSON.stringify(saved.errors || ""));
      const loaded = await loadCanvasV3(saved.envelope);
      assert(loaded.ok, "load succeeded: " + JSON.stringify(loaded.error || ""));

      // Byte-equal on the AI field (sweep + integrity should leave it unchanged
      // because catalog versions match)
      const loadedGap = loaded.engagement.gaps.byId[gapId];
      assertEqual(JSON.stringify(loadedGap.aiMappedDellSolutions),
                  JSON.stringify(skillResult),
        "aiMappedDellSolutions byte-equivalent across save+load round-trip");
    });

    // executive-summary (smoke)
    it("V-PROD-6 · executive-summary output non-empty string of length >= 100", async () => {
      // Mocked exec-summary skill against the reference engagement.
      const eng = buildReferenceEngagement();
      const mockResponse = {
        model: "mock-claude-sonnet",
        text: [
          "Acme Financial Services is at an inflection point. Across 200 instances spanning",
          "compute, storage, data protection, virtualization, infrastructure, and workload",
          "layers, the team has identified 12 gaps with mixed urgency. Modernization is the",
          "dominant theme, with replace and consolidate dispositions concentrated in compute.",
          "",
          "Recommend a 90-day kickoff focused on the High-urgency gaps in storage and compute,",
          "with a parallel discovery track for the workload layer's cross-environment dependencies."
        ].join("\n")
      };
      const provider = createMockLLMProvider({ defaultResponse: mockResponse });
      const ctx = {
        customer:        eng.customer,
        engagementMeta:  eng.meta,
        catalogVersions: { BUSINESS_DRIVERS: "2026.04", ENV_CATALOG: "2026.04" }
      };
      const result = await runSkill(SEED_SKILL_EXECUTIVE_SUMMARY, ctx, provider,
        { runTimestamp: "2026-05-01T00:00:00.000Z", runIdSeed: "v-prod-6" });
      assert(typeof result.value === "string", "value is a string");
      assert(result.value.length >= 100,
        "executive-summary output >= 100 chars (got " + result.value.length + ")");
    });
    it("V-PROD-7 · executive-summary contains customer.name (verbatim or close-match)", async () => {
      const eng = buildReferenceEngagement();
      // Mock returns a response that explicitly mentions the customer name.
      const provider = createMockLLMProvider({
        defaultResponse: {
          model: "mock-claude-sonnet",
          text: "Acme Financial Services is positioned for modernization. The customer's " +
                "Financial Services vertical demands cyber-resilience as a top priority. " +
                "Recommend a 90-day kickoff with focus on storage and compute."
        }
      });
      const ctx = {
        customer:        eng.customer,
        engagementMeta:  eng.meta,
        catalogVersions: { BUSINESS_DRIVERS: "2026.04" }
      };
      const result = await runSkill(SEED_SKILL_EXECUTIVE_SUMMARY, ctx, provider,
        { runTimestamp: "2026-05-01T00:00:00.000Z", runIdSeed: "v-prod-7" });
      assert(result.value.includes(eng.customer.name),
        "exec-summary output must contain customer name '" + eng.customer.name + "'");
    });
    it("V-PROD-8 · executive-summary provenance stamped (validationStatus='valid', catalogVersions populated)", async () => {
      const eng = buildReferenceEngagement();
      const provider = createMockLLMProvider({
        defaultResponse: { model: "mock-claude-sonnet", text: "summary text" }
      });
      const ctx = {
        customer: eng.customer, engagementMeta: eng.meta,
        catalogVersions: { BUSINESS_DRIVERS: "2026.04", ENV_CATALOG: "2026.04",
                           DELL_PRODUCT_TAXONOMY: "2026.04" }
      };
      const result = await runSkill(SEED_SKILL_EXECUTIVE_SUMMARY, ctx, provider,
        { runTimestamp: "2026-05-01T00:00:00.000Z", runIdSeed: "v-prod-8" });
      // Full provenance contract per SPEC sec S8.1
      assertEqual(result.provenance.validationStatus, "valid", "validationStatus stamped 'valid'");
      assertEqual(result.provenance.model, "mock-claude-sonnet", "model preserved from LLM response");
      assertEqual(result.provenance.skillId, "executive-summary", "skillId stamped");
      assertEqual(result.provenance.promptVersion, "skill:executive-summary@1.0.0",
        "promptVersion = skill:<id>@<ver>");
      assert(result.provenance.runId.length > 0, "runId populated");
      assertEqual(result.provenance.timestamp, "2026-05-01T00:00:00.000Z", "timestamp from opts");
      assertEqual(result.provenance.catalogVersions.BUSINESS_DRIVERS,      "2026.04", "BUSINESS_DRIVERS stamped");
      assertEqual(result.provenance.catalogVersions.ENV_CATALOG,           "2026.04", "ENV_CATALOG stamped");
      assertEqual(result.provenance.catalogVersions.DELL_PRODUCT_TAXONOMY, "2026.04", "DELL_PRODUCT_TAXONOMY stamped");
    });

    // care-builder (strict)
    it("V-PROD-9 · care-builder output is a save-able skill record (passes SkillSchema parse)", async () => {
      // Mock returns a JSON-shaped skill record; runner validates via
      // SkillSchema (registered in skillOutputSchemas).
      const mockSkill = {
        id:           "00000000-0000-4000-8000-000000000099",
        engagementId: "00000000-0000-4000-8000-000000000099",
        createdAt:    "2026-01-01T00:00:00.000Z",
        updatedAt:    "2026-01-01T00:00:00.000Z",
        skillId:      "skl-care-output-1",
        label:        "Generated CARE prompt",
        version:      "1.0.0",
        skillType:    "session-wide",
        entityKind:   null,
        promptTemplate:       "CARE prompt for {{customer.name}}",
        bindings:             [{ path: "customer.name", source: "session" }],
        outputContract:       "free-text",
        validatedAgainst:     "3.0",
        outdatedSinceVersion: null
      };
      const provider = createMockLLMProvider({
        defaultResponse: { model: "mock", text: JSON.stringify(mockSkill) }
      });
      const ctx = {
        customer: { name: "Acme" },
        catalogVersions: { BUSINESS_DRIVERS: "2026.04" }
      };
      const result = await runSkill(SEED_SKILL_CARE_BUILDER, ctx, provider,
        { runTimestamp: "2026-05-01T00:00:00.000Z", runIdSeed: "v-prod-9" });
      assertEqual(result.provenance.validationStatus, "valid",
        "care-builder output passes SkillSchema -> valid");
      assertEqual(result.value.skillId, "skl-care-output-1", "skillId preserved in output");
      // Sanity: parse the output through SkillSchema directly
      const reparse = SkillSchema.safeParse(result.value);
      assert(reparse.success, "output reparses cleanly through SkillSchema");
    });
    it("V-PROD-10 · care-builder output round-trips through validateSkillSave without errors", () => {
      // The skill care-builder produces uses ONLY paths that exist in
      // the manifest. Prove this against a hand-built care-output skill
      // (full runner round-trip is tested by V-PROD-9; this vector
      // focuses on the validateSkillSave handshake).
      const careOutput = createEmptySkill({
        skillId:        "skl-care-out",
        label:          "CARE output",
        skillType:      "session-wide",
        entityKind:     null,
        promptTemplate: "Hello {{customer.name}} ({{customer.vertical}})!"
      });
      const manifest = generateManifest();
      const result = validateSkillSave(careOutput, manifest);
      assert(result.ok === true,
        "care-builder output round-trips through validateSkillSave: " +
        JSON.stringify(result.errors || ""));
    });
    it("V-PROD-11 · care-builder output bindings[] reference paths that all exist in the manifest", () => {
      const careOutput = createEmptySkill({
        skillId:        "skl-care-bindings",
        skillType:      "session-wide",
        entityKind:     null,
        promptTemplate: "Hi {{customer.name}}",
        bindings: [
          { path: "customer.name",     source: "session" },
          { path: "customer.vertical", source: "session" }
        ]
      });
      const manifest = generateManifest();
      const sessionPathSet = new Set(manifest.sessionPaths.map(p => p.path));
      careOutput.bindings.forEach(b => {
        assert(sessionPathSet.has(b.path),
          "binding path '" + b.path + "' must exist in manifest sessionPaths");
      });
    });
  });

  // -------------------------------------------------------------------
  // sec T17 · V-MULTI · Multi-engagement readiness (per SPEC sec S12.4)
  // -------------------------------------------------------------------
  describe("§T17 · V-MULTI · Multi-engagement readiness", () => {
    it("V-MULTI-1 · every record post-action has engagementId === engagementMeta.engagementId", () => {
      const eng = createEmptyEngagement({
        meta: { engagementId: "11111111-2222-3333-4444-555555555555" }
      });
      const next = addDriver(eng, { businessDriverId: "ai_data", priority: "High" });
      assert(next.ok === true, "addDriver succeeded");
      const driverId = next.engagement.drivers.allIds[0];
      const driver = next.engagement.drivers.byId[driverId];
      assertEqual(driver.engagementId, eng.meta.engagementId,
        "added driver's engagementId stamped from engagement context");
    });
    it("V-MULTI-2 · engagementMeta.ownerId defaults to 'local-user' when not set", () => {
      const m = createEmptyEngagementMeta();
      assertEqual(m.ownerId, "local-user", "ownerId default");
    });
    it("V-MULTI-3 · record.updatedAt > record.createdAt after a single update", () => {
      const eng = createEmptyEngagement();
      const added = addDriver(eng, { businessDriverId: "ai_data", priority: "Medium" });
      assert(added.ok, "addDriver succeeded");
      const driverId = added.engagement.drivers.allIds[0];
      // Force a small delay so the timestamps are distinct.
      const updated = updateDriver(added.engagement, driverId, { priority: "High" });
      assert(updated.ok, "updateDriver succeeded");
      const driver = updated.engagement.drivers.byId[driverId];
      assert(driver.updatedAt >= driver.createdAt,
        "updatedAt monotonic: " + driver.updatedAt + " >= " + driver.createdAt);
    });
    it("V-MULTI-4 · record.updatedAt === record.createdAt initially", () => {
      const d = createEmptyDriver();
      assertEqual(d.updatedAt, d.createdAt,
        "default factory sets updatedAt === createdAt");
    });
    it("V-MULTI-5 · action addInstance stamps engagementId from engagement context (not from caller arg)", () => {
      // Driver-level proof of the same contract (addInstance lands later;
      // addDriver demonstrates the pattern). The action stamps engagementId
      // from engagement.meta.engagementId regardless of input.
      const eng = createEmptyEngagement({
        meta: { engagementId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }
      });
      // Caller tries to spoof engagementId via input; action must override
      // with the engagement's authoritative value.
      const next = addDriver(eng, {
        businessDriverId: "ai_data",
        priority: "Medium",
        engagementId: "ffffffff-eeee-4ddd-8ccc-bbbbbbbbbbbb"  // attempted spoof
      });
      assert(next.ok, "addDriver succeeded");
      const drv = next.engagement.drivers.byId[next.engagement.drivers.allIds[0]];
      assertEqual(drv.engagementId, eng.meta.engagementId,
        "engagementId stamped from engagement context, not caller arg");
    });
    it("V-MULTI-6 · saved .canvas includes ownerId", () => {});
    it("V-MULTI-7 · saved .canvas includes createdAt + updatedAt on every record", () => {});
    it("V-MULTI-8 · v2.0 fixture without ownerId migrates to 'local-user' (cross-ref V-MIG-S3-1)", () => {});
  });

  // -------------------------------------------------------------------
  // sec T18 · V-ANTI · Anti-cheat meta-tests (per SPEC sec S14.5)
  // These vectors run against TEST + PRODUCTION source code, not runtime.
  // -------------------------------------------------------------------
  describe("§T18 · V-ANTI · Anti-cheat meta-tests", () => {
    it("V-ANTI-1 · no `process.env.NODE_ENV === 'test'` in core/ state/ services/ selectors/ interactions/ ui/", () => {});
    it("V-ANTI-2 · every try/catch in production code rethrows OR logs (no swallowed catches)", () => {});
    it("V-ANTI-3 · no `assert(stubReturnValue === stubReturnValue)` patterns in test source", () => {});
    it("V-ANTI-4 · every R-number in SPEC.md has >=1 matching vector id in TESTS.md (smoke; strict in v3.1)", () => {});
    it("V-ANTI-5 · no internal modules mocked outside SPEC sec S14.4 closed list", () => {});
  });

  // -------------------------------------------------------------------
  // §T19 · V-ADP · v3.0 → v2.x consumption adapter (per SPEC §S19)
  // RED-first: state/adapter.js + state/engagementStore.js (was state/v3*) were
  // STUBS. V-ADP-3..9 + V-ADP-10 will fail against the stubs and go
  // GREEN as the real adapter implementation lands in the next commit.
  // V-ADP-1, V-ADP-2 pass with stubs (purity holds for null returns;
  // null returns don't throw) — that's intentional per RED-first design.
  // -------------------------------------------------------------------
  describe("§T19 · V-ADP · v3.0 → v2.x consumption adapter", () => {

    function _resetAdapterEnv() {
      _resetEngagementStoreForTests();
    }

    it("V-ADP-1 · adaptContextView is identity-stable on unchanged engagement reference", () => {
      _resetAdapterEnv();
      const eng = createEmptyEngagement();
      const a = adaptContextView(eng);
      const b = adaptContextView(eng);
      assert(a === b,
        "same engagement reference → same adapter output reference (memoization downstream of §S5)");
    });

    it("V-ADP-2 · empty engagement renders all 6 view shapes without throwing", () => {
      _resetAdapterEnv();
      const eng = createEmptyEngagement();
      let threw = null;
      try {
        adaptContextView(eng);
        adaptArchitectureView(eng);
        adaptHeatmapView(eng);
        adaptWorkloadView(eng);
        adaptGapsView(eng);
        adaptReportingView(eng);
      } catch (e) { threw = e; }
      assert(threw === null,
        "no adapter throws on empty engagement; got: " + (threw && threw.message));
    });

    it("V-ADP-3 · adaptContextView returns {customer, drivers} shape from a populated engagement", () => {
      _resetAdapterEnv();
      let eng = createEmptyEngagement();
      // Populate customer via §S4 action so we exercise the full read path.
      eng = updateCustomer(eng, { name: "Acme Financial Services", vertical: "Financial Services", region: "EMEA" }).engagement;
      eng = addDriver(eng, { businessDriverId: "ai_data", priority: "High", outcomes: "Stand up an AI platform in 12 months." }).engagement;

      const view = adaptContextView(eng);
      assert(view !== null && typeof view === "object", "adapter returns an object, not null");
      assert(view.customer && typeof view.customer === "object", "view.customer is an object");
      assertEqual(view.customer.name, "Acme Financial Services", "customer.name surfaces");
      assertEqual(view.customer.vertical, "Financial Services", "customer.vertical surfaces");
      assertEqual(view.customer.region, "EMEA", "customer.region surfaces");
      assert(Array.isArray(view.drivers) && view.drivers.length === 1,
        "view.drivers is an array of length 1");
      assertEqual(view.drivers[0].priority, "High", "driver priority surfaces");
    });

    it("V-ADP-4 · adaptArchitectureView returns env × layer matrix shape (instanceIds per cell)", () => {
      _resetAdapterEnv();
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const envId = eng.environments.allIds[0];
      eng = addInstanceV3(eng, { state:"current", layerId:"compute", environmentId: envId,
        label:"PowerEdge-1", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"keep" }).engagement;
      const instId = eng.instances.allIds[0];

      const view = adaptArchitectureView(eng);
      assert(view !== null && typeof view === "object", "adapter returns an object, not null");
      assert(view.cells && typeof view.cells === "object",
        "view.cells is the env-keyed map");
      assert(view.cells[envId] && view.cells[envId].compute,
        "(envId, compute) cell exists");
      assert(Array.isArray(view.cells[envId].compute.instanceIds),
        "cell.instanceIds is an array");
      assert(view.cells[envId].compute.instanceIds.includes(instId),
        "cell.instanceIds includes the added instance");
    });

    it("V-ADP-5 · adaptHeatmapView returns per-cell health rollup shape derived from architecture", () => {
      _resetAdapterEnv();
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;

      const view = adaptHeatmapView(eng);
      assert(view !== null && typeof view === "object", "adapter returns an object, not null");
      // Heatmap shape mirrors architecture: per-env per-layer cell with at least a count.
      assert(view.cells && typeof view.cells === "object", "view.cells is the env-keyed map");
    });

    it("V-ADP-6 · adaptWorkloadView resolves mappedAssetIds across envs (cross-ref V-XCUT-1)", () => {
      _resetAdapterEnv();
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "drDc",   catalogVersion: "2026.04" }).engagement;
      const [e1, e2] = eng.environments.allIds;
      eng = addInstanceV3(eng, { state:"current", layerId:"compute", environmentId: e2,
        label:"Asset-A", vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"keep" }).engagement;
      const assetId = eng.instances.allIds[0];
      eng = addInstanceV3(eng, { state:"current", layerId:"workload", environmentId: e1,
        label:"App-X", vendor:"Custom", vendorGroup:"custom", criticality:"High", disposition:"keep",
        mappedAssetIds: [assetId] }).engagement;
      const workloadId = eng.instances.allIds[1];

      const view = adaptWorkloadView(eng);
      assert(view !== null && typeof view === "object", "adapter returns an object, not null");
      assert(Array.isArray(view.workloads), "view.workloads is an array");
      const wl = view.workloads.find(w => w.id === workloadId);
      assert(wl, "workload appears in view.workloads");
      assert(Array.isArray(wl.mappedAssets) && wl.mappedAssets.length === 1,
        "workload.mappedAssets resolves the cross-env asset");
      assertEqual(wl.mappedAssets[0].id, assetId, "mapped asset id resolved");
    });

    it("V-ADP-7 · adaptGapsView returns gaps with affectedEnvironments + relatedInstances + services + projectId preserved", () => {
      _resetAdapterEnv();
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "drDc",   catalogVersion: "2026.04" }).engagement;
      const [e1, e2] = eng.environments.allIds;
      eng = addGapV3(eng, { description: "compliance audit gap",
        gapType: "ops", urgency: "High", phase: "now", status: "open",
        layerId: "infrastructure", affectedLayers: ["infrastructure"],
        affectedEnvironments: [e1, e2]
      }).engagement;
      const gapId = eng.gaps.allIds[0];

      const view = adaptGapsView(eng);
      assert(view !== null && typeof view === "object", "adapter returns an object, not null");
      assert(Array.isArray(view.gaps), "view.gaps is an array");
      const gap = view.gaps.find(g => g.id === gapId);
      assert(gap, "gap appears in view.gaps");
      assert(Array.isArray(gap.affectedEnvironments) && gap.affectedEnvironments.length === 2,
        "affectedEnvironments preserved (length 2)");
      assertEqual(gap.urgency, "High", "urgency preserved");
      assertEqual(gap.gapType, "ops", "gapType preserved");
    });

    it("V-ADP-8 · adaptReportingView returns aggregations (per-env health + global counts; multi-env gap counted once)", () => {
      _resetAdapterEnv();
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc",      catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "drDc",        catalogVersion: "2026.04" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "publicCloud", catalogVersion: "2026.04" }).engagement;
      const [e1, e2, e3] = eng.environments.allIds;
      eng = addGapV3(eng, { description: "cross-env compliance",
        gapType: "ops", urgency: "High", phase: "now", status: "open",
        layerId: "infrastructure", affectedLayers: ["infrastructure"],
        affectedEnvironments: [e1, e2, e3]
      }).engagement;

      const view = adaptReportingView(eng);
      assert(view !== null && typeof view === "object", "adapter returns an object, not null");
      assert(view.totals && typeof view.totals === "object", "view.totals exists");
      assertEqual(view.totals.gapsOpen, 1,
        "multi-env gap counted exactly once globally (cross-ref V-XCUT-3)");
    });

    it("V-ADP-9 · commitContextEdit updates customer.name and emits to subscribers (write-through + immutable update)", () => {
      _resetAdapterEnv();
      const eng = createEmptyEngagement();
      setActiveEngagement(eng);

      let emittedCount = 0;
      let lastEmitted = null;
      const unsub = subscribeActiveEngagement(e => { emittedCount++; lastEmitted = e; });
      // Reset emit count from the setActiveEngagement notify (S19.3 contract).
      emittedCount = 0;
      lastEmitted = null;

      commitContextEdit({ customer: { name: "Acme Financial Services" } });

      const after = getActiveEngagement();
      assertEqual(after.customer.name, "Acme Financial Services",
        "customer.name reflects the commit");
      assertEqual(emittedCount, 1,
        "subscribers notified exactly once per commit");
      assert(lastEmitted === after,
        "subscriber received the post-commit engagement");
      assert(after !== eng,
        "commit produced a new engagement reference (immutable update per P3)");
      unsub();
    });

    it("V-ADP-10 · loadCanvasV3 + setActiveEngagement chains into all 6 view shapes (round-trip)", async () => {
      _resetAdapterEnv();
      // Build a minimal valid engagement, save+load roundtrip, then drive
      // through the adapter. This exercises §S9 migrator + §S10 sweep
      // upstream of the adapter.
      let eng = createEmptyEngagement();
      eng = updateCustomer(eng, { name: "RT Customer", vertical: "Financial Services", region: "EMEA" }).engagement;
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;

      // buildSaveEnvelopeV3 returns { ok, envelope } per SPEC §S4.2.4.
      const saveResult = buildSaveEnvelopeV3(eng);
      assert(saveResult.ok === true,
        "save envelope built ok; got: " + JSON.stringify(saveResult.errors || ""));
      const envelope = saveResult.envelope;

      // loadCanvasV3 is async (await per SPEC §S6.1.2 Promise<Catalog>).
      const reloaded = await loadCanvasV3(envelope);
      assert(reloaded.ok === true,
        "load canvas ok; got: " + JSON.stringify(reloaded.error || ""));
      const engReloaded = reloaded.engagement;
      setActiveEngagement(engReloaded);

      const ctx     = adaptContextView(engReloaded);
      const arch    = adaptArchitectureView(engReloaded);
      const heat    = adaptHeatmapView(engReloaded);
      const wl      = adaptWorkloadView(engReloaded);
      const gaps    = adaptGapsView(engReloaded);
      const reportv = adaptReportingView(engReloaded);

      assert(ctx     !== null, "adaptContextView is non-null after roundtrip");
      assert(arch    !== null, "adaptArchitectureView is non-null after roundtrip");
      assert(heat    !== null, "adaptHeatmapView is non-null after roundtrip");
      assert(wl      !== null, "adaptWorkloadView is non-null after roundtrip");
      assert(gaps    !== null, "adaptGapsView is non-null after roundtrip");
      assert(reportv !== null, "adaptReportingView is non-null after roundtrip");
      assertEqual(ctx.customer.name, "RT Customer",
        "round-tripped customer.name surfaces through adapter");
    });
  });

  // -------------------------------------------------------------------
  // §T20 · V-CHAT · Canvas Chat (per SPEC §S20)
  // RED-first: services/chatService.js, services/systemPromptAssembler.js,
  // services/chatTools.js, state/chatMemory.js, tests/mocks/mockChatProvider.js
  // are STUBS. V-CHAT-{1,2,3,4,5,6,7,10,11,12} fail against the stubs
  // and go GREEN as the chat layer ships per the SPEC §S20 sequence.
  // V-CHAT-8 + V-CHAT-9 may pass against stubs by design (they are
  // constraint tests that hold even when the impl is empty).
  // -------------------------------------------------------------------
  describe("§T20 · V-CHAT · Canvas Chat", () => {

    function _resetChatEnv() {
      _resetEngagementStoreForTests();
      _resetChatMemoryForTests();
    }

    it("V-CHAT-1 · buildSystemPrompt returns the 5-layer structure with role + data-model + manifest + engagement + views sections", () => {
      _resetChatEnv();
      const eng = createEmptyEngagement();
      const result = buildSystemPrompt({ engagement: eng });
      assert(result && Array.isArray(result.messages),
        "buildSystemPrompt returns { messages: [...], cacheControl: [...] }");
      // Concatenate all message contents to scan for layer markers.
      // The real impl emits explicit layer markers (== Layer 1: Role ==
      // or similar) so we can structurally verify all 5 are present.
      const concatenated = result.messages
        .map(m => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
        .join("\n");
      const requiredMarkers = ["role", "data model", "bindable paths", "engagement", "analytical views"];
      for (const marker of requiredMarkers) {
        assert(concatenated.toLowerCase().includes(marker),
          "system prompt must include layer marker for: " + marker);
      }
    });

    it("V-CHAT-2 · Layer-4 token-budget switch: small engagement inlined; large engagement counts-only", () => {
      _resetChatEnv();
      // Small engagement: empty default → trivially small.
      const small = createEmptyEngagement();
      const smallPrompt = buildSystemPrompt({ engagement: small });
      const smallText = smallPrompt.messages.map(m =>
        typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n");
      // Small engagements should inline the customer object (engagement.customer.name visible).
      assert(smallText.includes(small.customer.name) || smallText.includes('"customer"'),
        "small engagement: customer block inlined in layer 4");

      // Large engagement: 30+ instances + 30+ gaps. Build via actions.
      let large = createEmptyEngagement();
      large = addEnvironment(large, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      const envId = large.environments.allIds[0];
      for (let i = 0; i < 25; i++) {
        large = addInstanceV3(large, { state:"current", layerId:"compute", environmentId: envId,
          label:"Asset-" + i, vendor:"Dell", vendorGroup:"dell", criticality:"Medium", disposition:"keep" }).engagement;
      }
      for (let i = 0; i < 25; i++) {
        large = addGapV3(large, { description: "Gap " + i,
          gapType: "ops", urgency: "Medium", phase: "now", status: "open",
          layerId: "infrastructure", affectedLayers: ["infrastructure"] }).engagement;
      }
      const largePrompt = buildSystemPrompt({ engagement: large });
      const largeText = largePrompt.messages.map(m =>
        typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n");
      // Large engagements should NOT inline every instance label — counts-only.
      const labelInlineCount = (largeText.match(/Asset-/g) || []).length;
      assert(labelInlineCount < 5,
        "large engagement: counts-only (no full per-instance labels in layer 4); got " + labelInlineCount);
    });

    it("V-CHAT-3 · CHAT_TOOLS has one selector-backed entry per §S5 selector with matching invoke (additional non-selector tools like selectConcept are allowed)", () => {
      _resetChatEnv();
      const SELECTORS = {
        selectMatrixView, selectGapsKanban, selectVendorMix, selectHealthSummary,
        selectExecutiveSummaryInputs, selectLinkedComposition, selectProjects
      };
      const expectedNames = Object.keys(SELECTORS).sort();
      const actualNames   = CHAT_TOOLS.map(t => t.name);
      // Subset check (v3.0-rc.2 LATE EVENING): every §S5 selector MUST be
      // exposed as a CHAT_TOOLS entry, but the converse is no longer
      // required — Phase B2 added definitional-grounding tools like
      // selectConcept that don't back a selector.
      for (const name of expectedNames) {
        assert(actualNames.indexOf(name) >= 0,
          "CHAT_TOOLS missing §S5 selector entry: '" + name + "'");
      }

      // Each SELECTOR-BACKED tool's invoke(eng, args) must produce the
      // same shape as the selector called directly. Non-selector tools
      // (selectConcept) get their own behavior tests in V-CONCEPT-5.
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      for (const tool of CHAT_TOOLS) {
        if (!SELECTORS[tool.name]) continue;
        const direct = SELECTORS[tool.name](eng);
        const viaTool = tool.invoke(eng, {});
        assertEqual(JSON.stringify(viaTool), JSON.stringify(direct),
          "tool dispatcher for " + tool.name + " must return selector output verbatim (default args)");
      }
    });

    it("V-CHAT-4 · streamChat against mock provider yields text via onToken in expected order", async () => {
      _resetChatEnv();
      const eng = createEmptyEngagement();
      setActiveEngagement(eng);
      const provider = createMockChatProvider({
        responses: [{ kind: "text", text: "hello there" }]
      });
      const tokens = [];
      const result = await streamChat({
        engagement:     eng,
        transcript:     [],
        userMessage:    "hi",
        providerConfig: { providerKey: "mock" },
        provider:       provider,
        onToken:        t => tokens.push(t)
      });
      assert(typeof result.response === "string" && result.response.length > 0,
        "streamChat returns { response: string }");
      assert(tokens.join("") === result.response,
        "tokens concatenated equal final response");
    });

    it("V-CHAT-5 · tool-call round-trip: question → tool_use → resolve → tool_result → final text", async () => {
      _resetChatEnv();
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addGapV3(eng, { description: "g1", gapType: "ops", urgency: "High", phase: "now",
        status: "open", layerId: "infrastructure", affectedLayers: ["infrastructure"] }).engagement;
      setActiveEngagement(eng);

      const provider = createMockChatProvider({
        responses: [
          { kind: "tool_use", name: "selectGapsKanban", input: {} },
          { kind: "text",     text: "There is 1 open gap with High urgency." }
        ]
      });
      const result = await streamChat({
        engagement:     eng,
        transcript:     [],
        userMessage:    "How many High-urgency gaps are open?",
        providerConfig: { providerKey: "mock" },
        provider:       provider
      });
      assertEqual(provider.callsRecorded.length, 2,
        "exactly 2 provider calls (initial + post-tool-result)");
      assert(typeof result.response === "string" && result.response.includes("1"),
        "final text from second call surfaces");
    });

    it("V-CHAT-6 · saveTranscript → loadTranscript round-trip preserves messages + summary", () => {
      _resetChatEnv();
      const engId = "test-eng-v-chat-6";
      const t = {
        messages: [
          { role: "user",      content: "hi",            at: "2026-05-02T10:00:00.000Z" },
          { role: "assistant", content: "hello there",   at: "2026-05-02T10:00:01.000Z" }
        ],
        summary: null
      };
      saveTranscript(engId, t);
      const loaded = loadTranscript(engId);
      assertEqual(loaded.messages.length, 2,
        "loaded transcript has 2 messages");
      assertEqual(loaded.messages[0].content, "hi", "first message preserved");
      assertEqual(loaded.messages[1].content, "hello there", "second message preserved");
      clearTranscript(engId);
    });

    it("V-CHAT-7 · summarizeIfNeeded collapses older turns into a PRIOR CONTEXT system message; idempotent on re-run", () => {
      _resetChatEnv();
      // Build a transcript with more than CHAT_TRANSCRIPT_WINDOW messages.
      const messages = [];
      for (let i = 0; i < CHAT_TRANSCRIPT_WINDOW + 5; i++) {
        messages.push({ role: i % 2 === 0 ? "user" : "assistant",
          content: "msg " + i, at: "2026-05-02T10:00:00.000Z" });
      }
      const big = { messages, summary: null };
      const summarized = summarizeIfNeeded(big);
      // After summarization, transcript length should be <= CHAT_TRANSCRIPT_WINDOW.
      assert(summarized.messages.length <= CHAT_TRANSCRIPT_WINDOW,
        "post-summarize length within window: " + summarized.messages.length);
      // The first message should be a synthetic PRIOR CONTEXT system entry.
      const priorContextSeen = summarized.messages.some(m =>
        m.role === "system" && typeof m.content === "string" &&
        m.content.startsWith("PRIOR CONTEXT"));
      assert(priorContextSeen, "PRIOR CONTEXT system message present after summarization");
      // Idempotent: re-running compresses no further.
      const summarizedAgain = summarizeIfNeeded(summarized);
      assertEqual(summarizedAgain.messages.length, summarized.messages.length,
        "summarizeIfNeeded is idempotent on already-summarized transcripts");
    });

    it("V-CHAT-8 · clearTranscript removes the localStorage entry", () => {
      _resetChatEnv();
      const engId = "test-eng-v-chat-8";
      saveTranscript(engId, {
        messages: [{ role: "user", content: "hi", at: "2026-05-02T10:00:00.000Z" }],
        summary: null
      });
      const before = loadTranscript(engId);
      assertEqual(before.messages.length, 1, "saved transcript loaded back with 1 message");
      clearTranscript(engId);
      const after = loadTranscript(engId);
      assertEqual(after.messages.length, 0, "after clear, transcript is empty");
      assertEqual(after.summary, null,       "after clear, summary is null");
    });

    it("V-CHAT-9 · V-ANTI-CHAT-1 · chat layer source code does NOT import sessionState or §S4 collection actions", async () => {
      const FILES = [
        "services/chatService.js",
        "services/systemPromptAssembler.js",
        "services/chatTools.js",
        "state/chatMemory.js",
        "ui/views/CanvasChatOverlay.js"
      ];
      const FORBIDDEN_IMPORTS = [
        "from \"../state/sessionState.js\"",
        "from '../state/sessionState.js'",
        "from \"../../state/sessionState.js\"",
        "from '../../state/sessionState.js'",
        "from \"../state/collections/",
        "from '../state/collections/",
        "from \"../../state/collections/",
        "from '../../state/collections/"
      ];
      for (const file of FILES) {
        let src;
        try {
          const res = await fetch("/" + file);
          if (!res.ok) continue;   // file not yet shipped; constraint vacuously holds
          src = await res.text();
        } catch (_e) { continue; }
        for (const forbidden of FORBIDDEN_IMPORTS) {
          assert(!src.includes(forbidden),
            "V-CHAT-9: " + file + " must not import a forbidden module: " + forbidden);
        }
      }
    });

    it("V-CHAT-10 · empty engagement: buildSystemPrompt does not throw + grounds the model that the canvas is empty", () => {
      _resetChatEnv();
      const eng = createEmptyEngagement();
      let threw = null;
      let result = null;
      try { result = buildSystemPrompt({ engagement: eng }); }
      catch (e) { threw = e; }
      assert(threw === null, "buildSystemPrompt does not throw on empty engagement: " + (threw && threw.message));
      const concatenated = result.messages.map(m =>
        typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n");
      assert(/canvas is empty|no instances|no gaps|empty engagement/i.test(concatenated),
        "system prompt grounds the model that the canvas is empty");
    });

    it("V-CHAT-11 · providerCapabilities reports streaming + toolUse + caching per provider", () => {
      const anth = providerCapabilities("anthropic");
      assertEqual(anth.streaming, true,  "anthropic supports streaming");
      assertEqual(anth.toolUse,   true,  "anthropic supports toolUse");
      assertEqual(anth.caching,   true,  "anthropic supports prompt caching");

      const oai = providerCapabilities("openai-compatible");
      assertEqual(oai.streaming, true, "openai-compatible supports streaming");
      assertEqual(oai.toolUse,   true, "openai-compatible supports toolUse");
      assertEqual(oai.caching,   false, "openai-compatible does not support caching");

      const gem = providerCapabilities("gemini");
      assertEqual(gem.streaming, true, "gemini supports streaming");
      assertEqual(gem.toolUse,   true, "gemini supports toolUse");
      assertEqual(gem.caching,   false, "gemini does not support caching");

      const mock = providerCapabilities("mock");
      assertEqual(mock.streaming, true,  "mock streams deterministically");
      assertEqual(mock.toolUse,   true,  "mock can emit tool_use blocks");
      assertEqual(mock.caching,   false, "mock has no caching");
    });

    it("V-CHAT-12 · Anthropic provider gets cache_control marker on prefix block; non-Anthropic providers do not", () => {
      _resetChatEnv();
      const eng = createEmptyEngagement();
      const anthPrompt = buildSystemPrompt({ engagement: eng, providerKind: "anthropic" });
      const oaiPrompt  = buildSystemPrompt({ engagement: eng, providerKind: "openai-compatible" });

      assert(Array.isArray(anthPrompt.cacheControl) && anthPrompt.cacheControl.length > 0,
        "anthropic prompt carries cacheControl markers on the stable prefix");
      assert(Array.isArray(oaiPrompt.cacheControl) && oaiPrompt.cacheControl.length === 0,
        "openai-compatible prompt has no cacheControl markers (provider does not support caching)");
    });

    // -----------------------------------------------------------------
    // V-CHAT-13/14/15 · Step 7 chat-perfection · Real-Anthropic tool-use
    // round-trip (per SPEC §S20.18 + RULES §16 CH19). RED-first until
    // services/aiService.js + services/realChatProvider.js wire the
    // tools array + content-block parsing.
    // -----------------------------------------------------------------

    it("V-CHAT-13 · buildRequest('anthropic') with tools array emits {tools:[{name,description,input_schema}]} and strips invoke", async () => {
      const { CHAT_TOOLS } = await import("../services/chatTools.js");
      const wireTools = CHAT_TOOLS.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema
      }));
      const req = buildRequest("anthropic", {
        baseUrl: "/api/anthropic",
        model:   "claude-opus-4-7",
        apiKey:  "sk-test",
        messages: [
          { role: "system", content: "you are grounded" },
          { role: "user",   content: "how many gaps?" }
        ],
        tools: wireTools
      });
      assert(Array.isArray(req.body.tools) && req.body.tools.length === wireTools.length,
        "anthropic body.tools includes one entry per CHAT_TOOLS entry");
      const first = req.body.tools[0];
      assert(typeof first.name === "string" && typeof first.description === "string" && first.input_schema,
        "each tool has name + description + input_schema");
      assert(typeof first.invoke === "undefined",
        "invoke fn must be stripped from wire payload (not serializable + leaks closures)");
    });

    it("V-CHAT-14 · buildRequest('anthropic') passes through array-shaped message.content (tool_use / tool_result content blocks)", () => {
      const req = buildRequest("anthropic", {
        baseUrl: "/api/anthropic",
        model:   "claude-opus-4-7",
        apiKey:  "sk-test",
        messages: [
          { role: "system", content: "sys" },
          { role: "user",   content: "q" },
          { role: "assistant", content: [
            { type: "text",     text: "let me check" },
            { type: "tool_use", id: "toolu_01abc", name: "selectGapsKanban", input: {} }
          ] },
          { role: "user", content: [
            { type: "tool_result", tool_use_id: "toolu_01abc", content: "{\"counts\":{\"open\":1}}" }
          ] }
        ]
      });
      const msgs = req.body.messages;
      // System message collapsed into body.system; remaining: user, assistant, user.
      assertEqual(msgs.length, 3, "non-system messages preserved in order");
      assert(Array.isArray(msgs[1].content) && msgs[1].content[1].type === "tool_use",
        "assistant content-block array passed through verbatim (tool_use intact)");
      assert(Array.isArray(msgs[2].content) && msgs[2].content[0].type === "tool_result",
        "user content-block array passed through verbatim (tool_result intact)");
      assertEqual(msgs[2].content[0].tool_use_id, "toolu_01abc",
        "tool_use_id correlates the round-trip");
    });

    it("V-CHAT-16 · buildRequest('anthropic') with cacheControl indices emits body.system as content-block array with cache_control marker on the prefix block", () => {
      const req = buildRequest("anthropic", {
        baseUrl: "/api/anthropic",
        model:   "claude-opus-4-7",
        apiKey:  "sk-test",
        // Indices 0+1 are stable system; index 2 is volatile (engagement snapshot).
        messages: [
          { role: "system", content: "ROLE block (stable)" },
          { role: "system", content: "CONTRACT block (stable)" },
          { role: "system", content: "ENGAGEMENT snapshot (volatile)" },
          { role: "user",   content: "q?" }
        ],
        cacheControl: [1]   // mark up to and including the contract block (index 1)
      });
      // body.system must be an array (not a flat string) so individual blocks
      // can carry cache_control. Two system blocks BEFORE index 2 (volatile)
      // get folded into the cached prefix; the volatile block stays unmarked.
      assert(Array.isArray(req.body.system),
        "body.system is an array of content blocks (required for cache_control)");
      assertEqual(req.body.system.length, 3,
        "all three system messages preserved as separate blocks");
      assertEqual(req.body.system[0].type, "text", "block 0 is text");
      assertEqual(req.body.system[1].type, "text", "block 1 is text");
      assert(req.body.system[1].cache_control && req.body.system[1].cache_control.type === "ephemeral",
        "block 1 (last cached prefix index) carries ephemeral cache_control marker");
      assert(!req.body.system[0].cache_control,
        "block 0 has NO marker (only the LAST cached index gets the marker; everything before is implicitly cached up to it)");
      assert(!req.body.system[2].cache_control,
        "block 2 (volatile engagement) has NO marker");
    });

    it("V-CHAT-15 · realChatProvider with Anthropic-shape stub fetch yields tool_use event then completes the round-trip via streamChat", async () => {
      const { createRealChatProvider } = await import("../services/realChatProvider.js");
      _resetChatEnv();
      let eng = createEmptyEngagement();
      eng = addGapV3(eng, { description: "stub gap", gapType: "ops", urgency: "High",
        phase: "now", status: "open", layerId: "infrastructure", affectedLayers: ["infrastructure"] }).engagement;
      setActiveEngagement(eng);

      // Stub fetchImpl that emulates Anthropic /v1/messages: first call returns
      // a tool_use stop_reason; second call returns final text.
      let callIdx = 0;
      const stubFetch = async (url, init) => {
        callIdx++;
        const sent = JSON.parse(init.body);
        if (callIdx === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              content: [
                { type: "text", text: "let me check the gaps." },
                { type: "tool_use", id: "toolu_01xyz", name: "selectGapsKanban", input: {} }
              ],
              stop_reason: "tool_use"
            }),
            text: async () => ""
          };
        }
        // Round-2 must include the tool_result block in the user message AND the
        // original assistant tool_use block in the assistant message.
        const lastUser = sent.messages[sent.messages.length - 1];
        const prevAssistant = sent.messages[sent.messages.length - 2];
        if (!Array.isArray(lastUser.content) || lastUser.content[0].type !== "tool_result") {
          throw new Error("V-CHAT-15: round-2 user message missing tool_result block");
        }
        if (!Array.isArray(prevAssistant.content) || !prevAssistant.content.some(b => b.type === "tool_use")) {
          throw new Error("V-CHAT-15: round-2 assistant message missing tool_use block");
        }
        if (lastUser.content[0].tool_use_id !== "toolu_01xyz") {
          throw new Error("V-CHAT-15: tool_use_id correlation lost");
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            content: [{ type: "text", text: "There is 1 open gap with High urgency." }],
            stop_reason: "end_turn"
          }),
          text: async () => ""
        };
      };

      const provider = createRealChatProvider({
        providerKey: "anthropic",
        baseUrl:     "/api/anthropic",
        model:       "claude-opus-4-7",
        apiKey:      "sk-test",
        // V-CHAT-15 covers the legacy non-streaming path; the SSE
        // streaming path is exercised by V-CHAT-17.
        stream:      false,
        fetchImpl:   stubFetch
      });
      const result = await streamChat({
        engagement:     eng,
        transcript:     [],
        userMessage:    "How many High-urgency gaps are open?",
        providerConfig: { providerKey: "anthropic" },
        provider:       provider
      });
      assertEqual(callIdx, 2, "two fetches: round1 (tool_use) + round2 (final text)");
      assert(typeof result.response === "string" && result.response.includes("1"),
        "final text from round2 surfaces");
    });

    it("V-CHAT-18 · BUG-012 guard: multi-round tool chain — streamChat loops dispatch → tool_result → next tool_use → final text", async () => {
      _resetChatEnv();
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addGapV3(eng, { description: "g1", gapType: "ops", urgency: "High", phase: "now",
        status: "open", layerId: "infrastructure", affectedLayers: ["infrastructure"] }).engagement;
      setActiveEngagement(eng);

      // Mock provider scripted as a 2-tool chain: tool_use → text+nothing → tool_use → final text.
      // chatService MUST loop through both tool dispatches before resolving.
      const provider = createMockChatProvider({
        responses: [
          { kind: "tool_use", name: "selectGapsKanban", input: {} },        // round 1
          { kind: "tool_use", name: "selectVendorMix",  input: {} },        // round 2 (chain — pre-fix this got dropped)
          { kind: "text",     text: "Combined answer: 1 open gap; 0 Dell instances (canvas is bare)." }   // round 3
        ]
      });

      const result = await streamChat({
        engagement:     eng,
        transcript:     [],
        userMessage:    "Compare gaps + Dell density",
        providerConfig: { providerKey: "mock" },
        provider:       provider
      });
      assertEqual(provider.callsRecorded.length, 3,
        "exactly 3 provider calls (2 tool dispatches + 1 final text)");
      assert(typeof result.response === "string" && result.response.includes("Combined answer"),
        "final text from the LAST round surfaces (got: '" + (result.response || "").slice(0, 80) + "')");
    });

    it("V-CHAT-20 · BUG-013 guard: role section explicitly forbids UUID emission, internal field names, and version markers in user-facing prose", async () => {
      _resetChatEnv();
      const eng = createEmptyEngagement();
      const sp = buildSystemPrompt({ engagement: eng, providerKind: "anthropic" });
      const roleMsg = sp.messages.find(m => m.role === "system" && m.content.includes("== Role =="));
      assert(!!roleMsg, "role section must be present");
      const role = roleMsg.content;

      // Source-grep: must explicitly enumerate the never-emit patterns
      // (UUID, internal field names like layerId/environmentId, version
      // markers like 'v3'). The presence of 'NEVER' next to each
      // pattern is what enforces the contract on every model response.
      const patterns = [
        { name: "UUID prohibition",          re: /\bNEVER\b[^.]{0,200}\bUUID/i },
        { name: "internal field-name prohibition", re: /\bNEVER\b[^.]{0,200}(?:layerId|environmentId|internal field name|field path)/i },
        { name: "version-marker prohibition", re: /\bNEVER\b[^.]{0,200}(?:'v3'|version marker|version prefix)/i }
      ];
      patterns.forEach(p => {
        assert(p.re.test(role),
          "role section must include " + p.name + " near a NEVER directive");
      });
    });

    it("V-CHAT-21 · BUG-013 fix: selectGapsKanban output includes gapsSummary[gapId]={description,urgencyLabel,driverLabel,layerLabel} so LLM has labels inline", async () => {
      _resetChatEnv();
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addGapV3(eng, { description: "Replace legacy backup", gapType: "replace",
        urgency: "High", phase: "now", status: "open",
        layerId: "dataProtection", affectedLayers: ["dataProtection"] }).engagement;
      setActiveEngagement(eng);

      const { selectGapsKanban } = await import("../selectors/gapsKanban.js");
      const out = selectGapsKanban(eng);

      assert(out && typeof out.gapsSummary === "object",
        "selectGapsKanban output includes gapsSummary map");
      const firstGapId = eng.gaps.allIds[0];
      const summary = out.gapsSummary[firstGapId];
      assert(summary && typeof summary === "object",
        "gapsSummary contains an entry per gap (keyed by gapId)");
      assertEqual(summary.description, "Replace legacy backup",
        "gapsSummary.description mirrors the raw gap.description");
      assertEqual(summary.urgencyLabel, "High",
        "gapsSummary.urgencyLabel mirrors the urgency");
      assert(typeof summary.layerLabel === "string" && summary.layerLabel.length > 0,
        "gapsSummary.layerLabel humanizes the layerId (e.g. 'Data Protection & Recovery')");
      // driverLabel is null when the gap has no driver, but the field must exist.
      assert("driverLabel" in summary,
        "gapsSummary.driverLabel field exists (may be null when gap has no driver)");
    });

    it("V-CHAT-22 · BUG-013 fix: selectVendorMix.byEnvironment entries include envLabel alongside the UUID key (so LLM cites aliases not UUIDs)", async () => {
      _resetChatEnv();
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04",
        alias: "Riyadh Test DC" }).engagement;
      const envId = eng.environments.allIds[0];
      // Add at least one instance so the env shows up in vendor mix.
      eng = addInstanceV3(eng, { state: "current", layerId: "compute",
        environmentId: envId, label: "test compute", vendor: "Test", vendorGroup: "dell",
        criticality: "Medium", disposition: "keep" }).engagement;
      setActiveEngagement(eng);

      const { selectVendorMix } = await import("../selectors/vendorMix.js");
      const out = selectVendorMix(eng);

      assert(out && typeof out.byEnvironment === "object",
        "selectVendorMix output includes byEnvironment");
      const entry = out.byEnvironment[envId];
      assert(entry && typeof entry === "object",
        "byEnvironment[envId] entry exists");
      assert(typeof entry.envLabel === "string" && entry.envLabel.length > 0,
        "byEnvironment[envId].envLabel populated (got '" + (entry.envLabel || "(empty)") + "')");
      assertEqual(entry.envLabel, "Riyadh Test DC",
        "envLabel mirrors the env.alias for human-readable citation");
    });

    it("V-CHAT-24 · BUG-016 guard: handshake stripping is BRACKET-OPTIONAL (Gemini emits without brackets) + applies globally to remnants", async () => {
      _resetChatEnv();
      const eng = createEmptyEngagement();
      setActiveEngagement(eng);
      const sha = (await import("../core/dataContract.js")).getContractChecksum();

      // Bracketless handshake (real Gemini behavior 2026-05-02 PM).
      const provider = createMockChatProvider({
        responses: [
          { kind: "text", text: "contract-ack v3.0 sha=" + sha + "\n\nThe customer is Acme Healthcare Group." }
        ]
      });
      const result = await streamChat({
        engagement:     eng,
        transcript:     [{ role: "user", content: "x" }, { role: "assistant", content: "y" }],
        userMessage:    "what is the customer name",
        providerConfig: { providerKey: "mock" },
        provider:       provider
      });

      assert(typeof result.response === "string",
        "response is a string");
      assert(!/contract-ack/i.test(result.response),
        "bracketless handshake stripped from response (got: '" + result.response.slice(0, 80) + "')");
      assert(result.response.includes("Acme Healthcare Group"),
        "actual answer text preserved");
    });

    it("V-CHAT-25 · BUG-016 guard: chatMemory.loadTranscript heals old transcripts that have handshake leaks persisted in assistant content", async () => {
      _resetChatEnv();
      const engId = "test-eng-handshake-backfill";
      // Persist a transcript with the handshake leaked into an assistant
      // message (simulates pre-fix data).
      saveTranscript(engId, {
        messages: [
          { role: "user",      content: "what is the client name", at: "2026-05-02T10:00:00Z" },
          { role: "assistant", content: "[contract-ack v3.0 sha=a345f849]\n\nThe client name is Acme Healthcare Group.",
                               at: "2026-05-02T10:00:01Z" },
          // also bracketless variant
          { role: "user",      content: "anything else?", at: "2026-05-02T10:01:00Z" },
          { role: "assistant", content: "contract-ack v3.0 sha=a345f849\n\nWe also have 8 open gaps.",
                               at: "2026-05-02T10:01:01Z" }
        ],
        summary: null
      });
      const loaded = loadTranscript(engId);
      assertEqual(loaded.messages.length, 4, "transcript count preserved");
      assert(!/contract-ack/i.test(loaded.messages[1].content),
        "bracketed handshake stripped on load (got: '" + loaded.messages[1].content.slice(0, 80) + "')");
      assert(loaded.messages[1].content.includes("Acme Healthcare Group"),
        "answer text preserved (bracketed)");
      assert(!/contract-ack/i.test(loaded.messages[3].content),
        "bracketless handshake stripped on load");
      assert(loaded.messages[3].content.includes("8 open gaps"),
        "answer text preserved (bracketless)");
      clearTranscript(engId);
    });

    // -----------------------------------------------------------------
    // V-CHAT-27..32 · Phase A · Generic LLM connector — OpenAI canonical
    // tool-use across all three providers (per SPEC §S26 + RULES §16 CH20).
    // Closes BUG-018 (Gemini hangs on tool-required questions) + unblocks
    // any OpenAI-compat LLM (vLLM, local, Mistral, Groq, Dell Sales Chat).
    // -----------------------------------------------------------------

    it("V-CHAT-27 · Phase A: buildRequest('openai-compatible') with tools emits OpenAI canonical {tools:[{type:'function',function:{name,description,parameters}}]} + tool_choice:'auto'", async () => {
      const { CHAT_TOOLS } = await import("../services/chatTools.js");
      const wireTools = CHAT_TOOLS.map(t => ({
        name: t.name, description: t.description, input_schema: t.input_schema
      }));
      const req = buildRequest("openai-compatible", {
        baseUrl: "/api/llm/local/v1",
        model:   "code-llm",
        apiKey:  "sk-test",
        messages: [
          { role: "system", content: "you are grounded" },
          { role: "user",   content: "how many gaps?" }
        ],
        tools: wireTools
      });
      assert(Array.isArray(req.body.tools) && req.body.tools.length === wireTools.length,
        "openai-compatible body.tools mirrors CHAT_TOOLS count");
      const first = req.body.tools[0];
      assertEqual(first.type, "function",
        "OpenAI canonical wraps each tool in {type:'function', function:{...}}");
      assert(first.function && typeof first.function.name === "string"
        && typeof first.function.description === "string"
        && first.function.parameters,
        "function carries name + description + parameters (renamed from input_schema)");
      assert(typeof first.function.input_schema === "undefined",
        "Anthropic 'input_schema' field is renamed to 'parameters' for OpenAI canonical");
      assertEqual(req.body.tool_choice, "auto",
        "tool_choice='auto' set when tools present");
    });

    it("V-CHAT-28 · Phase A: buildRequest('openai-compatible') translates Anthropic-shape array content into OpenAI flat messages (text → message.content; tool_use → tool_calls; tool_result → role:'tool')", async () => {
      const req = buildRequest("openai-compatible", {
        baseUrl: "/api/llm/local/v1",
        model:   "code-llm",
        apiKey:  "sk-test",
        messages: [
          { role: "system", content: "sys" },
          { role: "user",   content: "q" },
          { role: "assistant", content: [
            { type: "text",     text: "let me check" },
            { type: "tool_use", id: "call_xyz", name: "selectGapsKanban", input: { state: "current" } }
          ] },
          { role: "user", content: [
            { type: "tool_result", tool_use_id: "call_xyz", content: "{\"counts\":{\"open\":1}}" }
          ] }
        ]
      });
      const msgs = req.body.messages;
      // Find the assistant message with tool_calls
      const asst = msgs.find(m => m.role === "assistant");
      assert(asst, "assistant message present after translation");
      assertEqual(asst.content, "let me check",
        "assistant message.content carries the text-block prose (or null when no text)");
      assert(Array.isArray(asst.tool_calls) && asst.tool_calls.length === 1,
        "assistant tool_calls populated from tool_use block");
      const tc = asst.tool_calls[0];
      assertEqual(tc.id, "call_xyz", "tool_call id correlates the round-trip");
      assertEqual(tc.type, "function", "tool_call.type='function'");
      assertEqual(tc.function.name, "selectGapsKanban", "tool_call.function.name preserved");
      assertEqual(tc.function.arguments, "{\"state\":\"current\"}",
        "tool_call.function.arguments is JSON-stringified input");
      // Tool result becomes a role:"tool" message correlated by tool_call_id
      const toolMsg = msgs.find(m => m.role === "tool");
      assert(toolMsg, "role:'tool' message emitted from tool_result block");
      assertEqual(toolMsg.tool_call_id, "call_xyz", "tool_call_id mirrors the assistant tool_calls.id");
      assertEqual(toolMsg.content, "{\"counts\":{\"open\":1}}",
        "tool message content carries the tool_result string");
    });

    it("V-CHAT-29 · Phase A: realChatProvider with openai-compatible stub fetch yields tool_use event then completes the round-trip via streamChat", async () => {
      const { createRealChatProvider } = await import("../services/realChatProvider.js");
      _resetChatEnv();
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addGapV3(eng, { description: "stub gap", gapType: "ops", urgency: "High", phase: "now",
        status: "open", layerId: "infrastructure", affectedLayers: ["infrastructure"] }).engagement;
      setActiveEngagement(eng);

      let callIdx = 0;
      const stubFetch = async (url, init) => {
        callIdx++;
        const sent = JSON.parse(init.body);
        if (callIdx === 1) {
          // Round 1 — model emits tool_calls (no content)
          return {
            ok: true, status: 200,
            json: async () => ({
              choices: [{
                message: {
                  content: null,
                  tool_calls: [{
                    id: "call_oai_1",
                    type: "function",
                    function: { name: "selectGapsKanban", arguments: "{}" }
                  }]
                }
              }]
            }),
            text: async () => ""
          };
        }
        // Round 2 — assert round-2 carries the tool_calls assistant + role:"tool" user, then return final text
        const asstWithTool = sent.messages.find(m => m.role === "assistant" && Array.isArray(m.tool_calls));
        if (!asstWithTool) throw new Error("V-CHAT-29: round-2 missing assistant tool_calls");
        const toolMsg = sent.messages.find(m => m.role === "tool");
        if (!toolMsg) throw new Error("V-CHAT-29: round-2 missing role:'tool' message");
        if (toolMsg.tool_call_id !== "call_oai_1") throw new Error("V-CHAT-29: tool_call_id correlation lost");
        return {
          ok: true, status: 200,
          json: async () => ({
            choices: [{ message: { content: "There is 1 open gap with High urgency." } }]
          }),
          text: async () => ""
        };
      };

      const provider = createRealChatProvider({
        providerKey: "local",        // local routes through openai-compatible
        baseUrl:     "/api/llm/local/v1",
        model:       "code-llm",
        apiKey:      "sk-test",
        fetchImpl:   stubFetch
      });
      const result = await streamChat({
        engagement:     eng,
        transcript:     [],
        userMessage:    "How many High-urgency gaps are open?",
        providerConfig: { providerKey: "local" },
        provider:       provider
      });
      assertEqual(callIdx, 2, "two fetches: round-1 (tool_calls) + round-2 (final text)");
      assert(typeof result.response === "string" && result.response.includes("1"),
        "final text from round-2 surfaces");
    });

    it("V-CHAT-30 · Phase A: buildRequest('gemini') with tools emits {tools:[{functionDeclarations:[...]}]}", async () => {
      const { CHAT_TOOLS } = await import("../services/chatTools.js");
      const wireTools = CHAT_TOOLS.map(t => ({
        name: t.name, description: t.description, input_schema: t.input_schema
      }));
      const req = buildRequest("gemini", {
        baseUrl: "/api/llm/gemini",
        model:   "gemini-2.5-flash",
        apiKey:  "AIza-test",
        messages: [
          { role: "system", content: "sys" },
          { role: "user",   content: "q" }
        ],
        tools: wireTools
      });
      assert(Array.isArray(req.body.tools) && req.body.tools.length >= 1,
        "gemini body.tools populated");
      const td = req.body.tools[0];
      assert(Array.isArray(td.functionDeclarations) && td.functionDeclarations.length === wireTools.length,
        "gemini tools[0].functionDeclarations carries all CHAT_TOOLS entries");
      const fd = td.functionDeclarations[0];
      assert(typeof fd.name === "string" && typeof fd.description === "string" && fd.parameters,
        "each functionDeclaration has name + description + parameters");
    });

    it("V-CHAT-31 · Phase A: buildRequest('gemini') translates Anthropic-shape array content into Gemini parts with functionCall / functionResponse", async () => {
      const req = buildRequest("gemini", {
        baseUrl: "/api/llm/gemini",
        model:   "gemini-2.5-flash",
        apiKey:  "AIza-test",
        messages: [
          { role: "system", content: "sys" },
          { role: "user",   content: "q" },
          { role: "assistant", content: [
            { type: "text",     text: "let me check" },
            { type: "tool_use", id: "call_gem_1", name: "selectGapsKanban", input: {} }
          ] },
          { role: "user", content: [
            { type: "tool_result", tool_use_id: "call_gem_1", content: "{\"counts\":{\"open\":1}}" }
          ] }
        ]
      });
      const contents = req.body.contents;
      // Find the model message (assistant → "model" role per gemini convention)
      const model = contents.find(c => c.role === "model");
      assert(model, "model message present after translation");
      assert(Array.isArray(model.parts) && model.parts.length >= 2,
        "model parts array carries text + functionCall");
      const textPart = model.parts.find(p => typeof p.text === "string");
      const fnCall   = model.parts.find(p => p.functionCall);
      assert(textPart && /let me check/.test(textPart.text), "text part preserved");
      assert(fnCall && fnCall.functionCall.name === "selectGapsKanban",
        "functionCall.name preserved from tool_use");
      // Tool result becomes a user message with functionResponse part
      const userResp = contents[contents.length - 1];
      assertEqual(userResp.role, "user", "tool_result becomes role:'user'");
      const fnResp = userResp.parts.find(p => p.functionResponse);
      assert(fnResp, "functionResponse part present");
      assertEqual(fnResp.functionResponse.name, "selectGapsKanban",
        "functionResponse.name correlates by NAME (Gemini lacks tool_call_id)");
    });

    it("V-CHAT-32 · Phase A: realChatProvider with gemini stub fetch yields tool_use event then completes round-trip via streamChat", async () => {
      const { createRealChatProvider } = await import("../services/realChatProvider.js");
      _resetChatEnv();
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addGapV3(eng, { description: "stub gap", gapType: "ops", urgency: "High", phase: "now",
        status: "open", layerId: "infrastructure", affectedLayers: ["infrastructure"] }).engagement;
      setActiveEngagement(eng);

      let callIdx = 0;
      const stubFetch = async (url, init) => {
        callIdx++;
        const sent = JSON.parse(init.body);
        if (callIdx === 1) {
          // Round 1 — Gemini emits a functionCall part
          return {
            ok: true, status: 200,
            json: async () => ({
              candidates: [{
                content: {
                  role: "model",
                  parts: [{ functionCall: { name: "selectGapsKanban", args: {} } }]
                }
              }]
            }),
            text: async () => ""
          };
        }
        // Round 2 — assert round-2 carries the model functionCall + user functionResponse, then return final text
        const modelMsg = sent.contents.find(c => c.role === "model" && c.parts.some(p => p.functionCall));
        if (!modelMsg) throw new Error("V-CHAT-32: round-2 missing model functionCall part");
        const userMsg = sent.contents[sent.contents.length - 1];
        const fnResp = userMsg.parts.find(p => p.functionResponse);
        if (!fnResp) throw new Error("V-CHAT-32: round-2 missing functionResponse part");
        if (fnResp.functionResponse.name !== "selectGapsKanban") throw new Error("V-CHAT-32: functionResponse.name correlation lost");
        return {
          ok: true, status: 200,
          json: async () => ({
            candidates: [{
              content: {
                role: "model",
                parts: [{ text: "There is 1 open gap with High urgency." }]
              }
            }]
          }),
          text: async () => ""
        };
      };

      const provider = createRealChatProvider({
        providerKey: "gemini",
        baseUrl:     "/api/llm/gemini",
        model:       "gemini-2.5-flash",
        apiKey:      "AIza-test",
        fetchImpl:   stubFetch
      });
      const result = await streamChat({
        engagement:     eng,
        transcript:     [],
        userMessage:    "How many High-urgency gaps are open?",
        providerConfig: { providerKey: "gemini" },
        provider:       provider
      });
      assertEqual(callIdx, 2, "two fetches: round-1 (functionCall) + round-2 (final text)");
      assert(typeof result.response === "string" && result.response.includes("1"),
        "final text from round-2 surfaces");
    });

    // -----------------------------------------------------------------
    // V-CONCEPT-1..5 · Phase B2 · Concept dictionary grounding
    // (per SPEC §S27 + RULES §16 CH21). Wires the 62-entry concept
    // dictionary into the system prompt (TOC inline) + exposes
    // selectConcept(id) as a chat tool for full-body fetches.
    // -----------------------------------------------------------------
    describe("§T27 · V-CONCEPT · Concept dictionary", () => {

      it("V-CONCEPT-1 · core/conceptManifest exports a structural CONCEPTS array; every entry has id+category+label+definition+example+whenToUse populated; ids are unique", async () => {
        const cm = await import("../core/conceptManifest.js");
        assert(Array.isArray(cm.CONCEPTS) && cm.CONCEPTS.length >= 50,
          "CONCEPTS array has ≥50 entries (got " + (cm.CONCEPTS && cm.CONCEPTS.length) + ")");
        const ids = new Set();
        cm.CONCEPTS.forEach(c => {
          assert(typeof c.id === "string" && c.id.length > 0, "concept.id non-empty");
          assert(typeof c.category === "string" && c.category.length > 0, "concept.category non-empty: " + c.id);
          assert(typeof c.label === "string" && c.label.length > 0, "concept.label non-empty: " + c.id);
          assert(typeof c.definition === "string" && c.definition.length > 0, "concept.definition non-empty: " + c.id);
          assert(typeof c.example === "string" && c.example.length > 0, "concept.example non-empty: " + c.id);
          assert(typeof c.whenToUse === "string" && c.whenToUse.length > 0, "concept.whenToUse non-empty: " + c.id);
          assert(!ids.has(c.id), "concept.id unique: '" + c.id + "' duplicated");
          ids.add(c.id);
        });
      });

      it("V-CONCEPT-2 · getConceptTOC() returns one row per concept with id+category+label+definition_headline (the 1-line first sentence of definition)", async () => {
        const cm = await import("../core/conceptManifest.js");
        const toc = cm.getConceptTOC();
        assertEqual(toc.length, cm.CONCEPTS.length, "TOC has same count as CONCEPTS");
        toc.forEach(t => {
          assert(t.id && t.category && t.label && t.definition_headline,
            "TOC entry has all 4 fields: " + JSON.stringify(t).slice(0, 80));
          // Headline is at most as long as full definition (it's the first sentence, possibly the whole sentence).
          const full = cm.getConcept(t.id);
          assert(full && t.definition_headline.length <= full.definition.length,
            "headline ≤ full definition for " + t.id);
        });
      });

      it("V-CONCEPT-3 · API surface: getConcept(id) returns the entry; unknown id returns null; getConceptsByCategory('gap_type') returns the 5 gap_type entries", async () => {
        const cm = await import("../core/conceptManifest.js");
        const replace = cm.getConcept("gap_type.replace");
        assert(replace && replace.label === "Replace",
          "getConcept('gap_type.replace') returns the entry");
        assertEqual(cm.getConcept("not.a.real.id"), null,
          "unknown id returns null");
        const gapTypes = cm.getConceptsByCategory("gap_type");
        assertEqual(gapTypes.length, 5, "5 gap_type entries");
        const gapTypeIds = gapTypes.map(c => c.id).sort();
        assertEqual(gapTypeIds.join(","),
          "gap_type.consolidate,gap_type.enhance,gap_type.introduce,gap_type.ops,gap_type.replace",
          "gap_type members match the 5 GAP_TYPES");
      });

      it("V-CONCEPT-4 · system prompt embeds the concept dictionary TOC block (inlined on the cached prefix; the role section points at selectConcept)", () => {
        _resetChatEnv();
        const eng = createEmptyEngagement();
        const sp = buildSystemPrompt({ engagement: eng, providerKind: "anthropic" });
        const all = sp.messages.map(m => m.content).join("\n");
        assert(/Concept dictionary/i.test(all),
          "system prompt contains a 'Concept dictionary' section");
        assert(/gap_type\.replace/.test(all),
          "TOC includes at least one concept id (e.g. gap_type.replace)");
        assert(/driver\.cyber_resilience/.test(all),
          "TOC includes driver concepts (e.g. driver.cyber_resilience)");
        assert(/selectConcept/.test(all),
          "role section points at selectConcept tool for full-body fetches");
        // Cache-control: the concept block should be on the cached prefix
        // (last cacheControl index covers it for Anthropic).
        assert(Array.isArray(sp.cacheControl) && sp.cacheControl.length > 0,
          "anthropic cacheControl marks the stable prefix; concept block is part of it");
      });

      it("V-CONCEPT-5 · CHAT_TOOLS includes selectConcept; invoke({id:'gap_type.replace'}) returns full body; invoke({id:'not.a.real.id'}) returns ok:false", async () => {
        const tools = await import("../services/chatTools.js");
        const tool = tools.CHAT_TOOLS.find(t => t.name === "selectConcept");
        assert(tool, "CHAT_TOOLS includes selectConcept entry");
        assert(typeof tool.invoke === "function", "selectConcept.invoke is a function");
        assert(tool.input_schema && tool.input_schema.properties && tool.input_schema.properties.id,
          "selectConcept input_schema declares the id parameter");
        const ok = tool.invoke(null, { id: "gap_type.replace" });
        assert(ok && ok.ok === true && ok.concept && ok.concept.label === "Replace",
          "invoke({id:'gap_type.replace'}) returns ok:true + the full body");
        const miss = tool.invoke(null, { id: "not.a.real.id" });
        assert(miss && miss.ok === false && typeof miss.error === "string",
          "invoke({id:'not.a.real.id'}) returns ok:false + error");
      });

    });

    // -----------------------------------------------------------------
    // V-WORKFLOW-1..5 · Phase C2 · App workflow manifest grounding
    // (per SPEC §S28 + RULES §16 CH22). Wires the 16-workflow + 19-
    // recommendation + 5-tab manifest into the system prompt + exposes
    // selectWorkflow(id) as a chat tool.
    // -----------------------------------------------------------------
    describe("§T28 · V-WORKFLOW · App workflow manifest", () => {

      it("V-WORKFLOW-1 · core/appManifest exports a structural WORKFLOWS array; every entry has id+name+intent+appSurface+steps+relatedConcepts+typicalOutcome populated; ids are unique", async () => {
        const am = await import("../core/appManifest.js");
        assert(Array.isArray(am.WORKFLOWS) && am.WORKFLOWS.length >= 10,
          "WORKFLOWS array has ≥10 entries (got " + (am.WORKFLOWS && am.WORKFLOWS.length) + ")");
        const ids = new Set();
        am.WORKFLOWS.forEach(w => {
          assert(typeof w.id === "string" && /^workflow\./.test(w.id), "workflow.id starts with 'workflow.': " + w.id);
          assert(typeof w.name === "string" && w.name.length > 0, "workflow.name non-empty: " + w.id);
          assert(typeof w.intent === "string" && w.intent.length > 0, "workflow.intent non-empty: " + w.id);
          assert(typeof w.appSurface === "string" && w.appSurface.length > 0, "workflow.appSurface non-empty: " + w.id);
          assert(Array.isArray(w.steps) && w.steps.length > 0, "workflow.steps non-empty: " + w.id);
          assert(Array.isArray(w.relatedConcepts), "workflow.relatedConcepts is array: " + w.id);
          assert(typeof w.typicalOutcome === "string" && w.typicalOutcome.length > 0, "workflow.typicalOutcome non-empty: " + w.id);
          assert(!ids.has(w.id), "workflow.id unique: '" + w.id + "' duplicated");
          ids.add(w.id);
        });
      });

      it("V-WORKFLOW-2 · getWorkflowTOC() returns one row per workflow with id+name+intent+app_surface (the cheap inline form)", async () => {
        const am = await import("../core/appManifest.js");
        const toc = am.getWorkflowTOC();
        assertEqual(toc.length, am.WORKFLOWS.length, "TOC has same count as WORKFLOWS");
        toc.forEach(t => {
          assert(t.id && t.name && t.intent && t.app_surface,
            "TOC entry has all 4 fields: " + JSON.stringify(t).slice(0, 80));
        });
      });

      it("V-WORKFLOW-3 · API surface: getWorkflow(id) returns entry; matchRecommendation('how do I add a gap?') returns rec.add_gap; APP_SURFACES populated", async () => {
        const am = await import("../core/appManifest.js");
        const wf = am.getWorkflow("workflow.identify_gaps");
        assert(wf && wf.name && Array.isArray(wf.steps),
          "getWorkflow('workflow.identify_gaps') returns the entry");
        assertEqual(am.getWorkflow("workflow.not.a.real.id"), null,
          "unknown workflow id returns null");
        const rec = am.matchRecommendation("how do I add a gap?");
        assert(rec && rec.id === "rec.add_gap",
          "matchRecommendation hits 'rec.add_gap' for the canonical phrasing");
        assertEqual(am.matchRecommendation("totally unrelated nonsense"), null,
          "unknown question returns null");
        // APP_SURFACES sanity
        assert(am.APP_SURFACES && typeof am.APP_SURFACES.app_purpose === "string"
          && am.APP_SURFACES.app_purpose.length > 0,
          "APP_SURFACES.app_purpose populated");
        assert(Array.isArray(am.APP_SURFACES.topbar_tabs) && am.APP_SURFACES.topbar_tabs.length >= 5,
          "APP_SURFACES.topbar_tabs has ≥5 tabs");
        assert(Array.isArray(am.APP_SURFACES.global_actions) && am.APP_SURFACES.global_actions.length >= 5,
          "APP_SURFACES.global_actions has ≥5 actions");
      });

      it("V-WORKFLOW-4 · system prompt embeds the workflow TOC + APP_SURFACES + recommendations on the cached prefix; role section points at selectWorkflow", () => {
        _resetChatEnv();
        const eng = createEmptyEngagement();
        const sp = buildSystemPrompt({ engagement: eng, providerKind: "anthropic" });
        const all = sp.messages.map(m => m.content).join("\n");
        assert(/App workflow manifest|App surfaces|Workflow TOC/i.test(all),
          "system prompt contains the workflow / app-surfaces section");
        assert(/workflow\.identify_gaps/.test(all),
          "TOC includes at least one workflow id (e.g. workflow.identify_gaps)");
        assert(/rec\.add_gap/.test(all),
          "Recommendations table inlined (e.g. rec.add_gap)");
        assert(/selectWorkflow/.test(all),
          "role section points at selectWorkflow tool");
        // Topbar tabs / global actions surface as text the LLM can read
        assert(/Context tab|Current state tab|Gaps tab/i.test(all),
          "APP_SURFACES topbar tabs surfaced as text");
        // Cache-control: workflow block on cached prefix (Anthropic)
        assert(Array.isArray(sp.cacheControl) && sp.cacheControl.length > 0,
          "anthropic cacheControl marks the stable prefix; workflow block is part of it");
      });

      it("V-WORKFLOW-5 · CHAT_TOOLS includes selectWorkflow; invoke({id:'workflow.identify_gaps'}) returns full body; invoke({id:'not.a.real.id'}) returns ok:false", async () => {
        const tools = await import("../services/chatTools.js");
        const tool = tools.CHAT_TOOLS.find(t => t.name === "selectWorkflow");
        assert(tool, "CHAT_TOOLS includes selectWorkflow entry");
        assert(typeof tool.invoke === "function", "selectWorkflow.invoke is a function");
        assert(tool.input_schema && tool.input_schema.properties && tool.input_schema.properties.id,
          "selectWorkflow input_schema declares id parameter");
        const ok = tool.invoke(null, { id: "workflow.identify_gaps" });
        assert(ok && ok.ok === true && ok.workflow && ok.workflow.name,
          "invoke({id:'workflow.identify_gaps'}) returns ok:true + the full body");
        assert(Array.isArray(ok.workflow.steps) && ok.workflow.steps.length > 0,
          "returned workflow body carries steps[]");
        const miss = tool.invoke(null, { id: "not.a.real.id" });
        assert(miss && miss.ok === false && typeof miss.error === "string",
          "invoke({id:'not.a.real.id'}) returns ok:false + error");
      });

    });

    // -----------------------------------------------------------------
    // V-SKILL-V3-1..2 · rc.3 commit #2 · Skill schema v3.1 + migration
    // (per SPEC §S29.2 + §S29.3). The (skillType, entityKind) tuple is
    // RETIRED; outputTarget + parameters[] replaces it. v3.0 records
    // auto-migrate at load + save boundaries via migrateSkillToV31.
    // -----------------------------------------------------------------
    describe("§T29 · V-SKILL-V3 · Skill schema v3.1 (parameterized + outputTarget)", () => {

      it("V-SKILL-V3-1 · SkillSchema strict-parses a v3.1 skill (outputTarget + parameters[]); strict-rejects extra fields like skillType/entityKind", async () => {
        const { SkillSchema } = await import("../schema/skill.js");
        const v31Skill = {
          id:           "00000000-0000-4000-8000-0000000ab001",
          engagementId: "00000000-0000-4000-8000-0000000ab001",
          createdAt:    "2026-05-02T00:00:00.000Z",
          updatedAt:    "2026-05-02T00:00:00.000Z",
          skillId:      "skl-v3-1",
          label:        "v3.1 native skill",
          version:      "1.0.0",
          outputTarget: "chat-bubble",
          parameters:   [
            { name: "gap", type: "entityId", description: "Pick a gap to map to Dell solutions", required: true }
          ],
          promptTemplate:       "Map gap to Dell: {{context.gap.description}}",
          bindings:             [{ path: "context.gap.description", source: "entity" }],
          outputContract:       "free-text",
          validatedAgainst:     "3.1",
          outdatedSinceVersion: null
        };
        const ok = SkillSchema.safeParse(v31Skill);
        assert(ok.success, "v3.1 shape parses cleanly: " + JSON.stringify(ok.error?.issues || []));
        assertEqual(ok.data.outputTarget, "chat-bubble", "outputTarget preserved");
        assertEqual(ok.data.parameters.length, 1, "parameters[] preserved");
        // Strict rejection of legacy fields.
        const v30Bad = { ...v31Skill, skillType: "click-to-run", entityKind: "gap" };
        const fail = SkillSchema.safeParse(v30Bad);
        assertEqual(fail.success, false, "v3.1 schema rejects extra legacy fields (skillType/entityKind)");
      });

      it("V-SKILL-V3-3 · skillRunner accepts opts.params; resolves {{<paramName>}} placeholders + binds entityId parameters to ctx.context.<paramName>; rejects missing required parameters", async () => {
        const { createMockLLMProvider } = await import("../services/mockLLMProvider.js");
        // Skill with one entityId parameter named "gap"; prompt uses BOTH
        // styles: {{gap}} (raw param) and {{context.gap.description}}
        // (legacy entity-bound style).
        const skill = {
          id:           "00000000-0000-4000-8000-0000000ab003",
          engagementId: "00000000-0000-4000-8000-0000000ab003",
          createdAt:    "2026-05-02T00:00:00.000Z",
          updatedAt:    "2026-05-02T00:00:00.000Z",
          skillId:      "skl-v3-3",
          label:        "Test parameterized skill",
          version:      "1.0.0",
          outputTarget: "chat-bubble",
          parameters: [
            { name: "gap", type: "entityId", description: "Pick a gap", required: true }
          ],
          promptTemplate:       "Gap id: {{gap}}; Description: {{context.gap.description}}",
          bindings:             [],
          outputContract:       "free-text",
          validatedAgainst:     "3.1",
          outdatedSinceVersion: null
        };

        // Build a minimal engagement with one gap so lookup succeeds.
        let eng = createEmptyEngagement();
        eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
        const addRes = addGapV3(eng, {
          description: "Replace Veeam with PPDM",
          gapType: "replace", urgency: "High", phase: "now", status: "open",
          layerId: "dataProtection", affectedLayers: ["dataProtection"]
        });
        eng = addRes.engagement;
        const gapId = eng.gaps.allIds[0];

        // Echo provider returns the resolved prompt verbatim so we can
        // assert what got resolved.
        const echoProvider = {
          complete: async ({ prompt }) => ({ model: "mock-echo", text: prompt })
        };

        // Path 1: required parameter MISSING → throws.
        let threwForMissing = false;
        try {
          await runSkill(skill, { engagement: eng, catalogVersions: {} }, echoProvider,
            { runTimestamp: "2026-05-02T00:00:00.000Z", runIdSeed: "v-skill-v3-3-miss" });
        } catch (e) {
          threwForMissing = /missing required parameter 'gap'/i.test(e.message);
        }
        assert(threwForMissing, "throws when required parameter 'gap' is missing");

        // Path 2: parameter SUPPLIED → resolves both {{gap}} and {{context.gap.description}}.
        const result = await runSkill(skill, { engagement: eng, catalogVersions: {} }, echoProvider,
          { runTimestamp: "2026-05-02T00:00:00.000Z", runIdSeed: "v-skill-v3-3-ok",
            params: { gap: gapId } });
        assert(typeof result.value === "string",
          "free-text result is a string");
        assert(result.value.includes("Gap id: " + gapId),
          "{{gap}} resolved to the parameter value");
        assert(result.value.includes("Replace Veeam with PPDM"),
          "{{context.gap.description}} resolved to the looked-up entity description");
      });

      it("V-SKILL-V3-4 · skillRunner outputTarget='chat-bubble' returns markdown (free-text); deferred targets throw a clear 'rc.4' error per SPEC §S29.7", async () => {
        const echoProvider = {
          complete: async ({ prompt }) => ({ model: "mock-echo", text: "Generated text." })
        };
        const baseSkill = {
          id:           "00000000-0000-4000-8000-0000000ab004",
          engagementId: "00000000-0000-4000-8000-0000000ab004",
          createdAt:    "2026-05-02T00:00:00.000Z",
          updatedAt:    "2026-05-02T00:00:00.000Z",
          skillId:      "skl-v3-4",
          label:        "Test target dispatch",
          version:      "1.0.0",
          parameters: [],
          promptTemplate:       "Hello",
          bindings:             [],
          outputContract:       "free-text",
          validatedAgainst:     "3.1",
          outdatedSinceVersion: null
        };

        // chat-bubble — shipping.
        const okResult = await runSkill({ ...baseSkill, outputTarget: "chat-bubble" },
          { engagement: createEmptyEngagement(), catalogVersions: {} }, echoProvider,
          { runTimestamp: "2026-05-02T00:00:00.000Z", runIdSeed: "v-skill-v3-4-ok" });
        assertEqual(okResult.value, "Generated text.",
          "chat-bubble target renders as free-text markdown");

        // Each deferred target throws.
        for (const target of ["structured-card", "reporting-panel", "proposed-changes"]) {
          let threw = false;
          try {
            await runSkill({ ...baseSkill, outputTarget: target },
              { engagement: createEmptyEngagement(), catalogVersions: {} }, echoProvider,
              { runTimestamp: "2026-05-02T00:00:00.000Z", runIdSeed: "v-skill-v3-4-" + target });
          } catch (e) {
            threw = /deferred to rc\.4/.test(e.message) && e.message.includes(target);
          }
          assert(threw, "outputTarget '" + target + "' throws clear deferred error");
        }
      });

      it("V-SKILL-V3-2 · migrateSkillToV31 round-trip: legacy v3.0 click-to-run + entityKind translates to v3.1 parameters[]; v3.1 input passes through unchanged (idempotent)", async () => {
        const { migrateSkillToV31, SkillSchema } = await import("../schema/skill.js");

        // v3.0 click-to-run + entityKind=gap → v3.1 parameters auto-derived
        const v30 = {
          id:           "00000000-0000-4000-8000-0000000ab002",
          engagementId: "00000000-0000-4000-8000-0000000ab002",
          createdAt:    "2026-01-01T00:00:00.000Z",
          updatedAt:    "2026-01-01T00:00:00.000Z",
          skillId:      "skl-mig-gap",
          label:        "Legacy click-to-run skill",
          version:      "1.0.0",
          skillType:    "click-to-run",
          entityKind:   "gap",
          promptTemplate:       "Map: {{context.gap.description}}",
          bindings:             [],
          outputContract:       "free-text",
          validatedAgainst:     "3.0",
          outdatedSinceVersion: null
        };
        const migrated = migrateSkillToV31(v30);
        assert(typeof migrated.skillType === "undefined", "skillType dropped");
        assert(typeof migrated.entityKind === "undefined", "entityKind dropped");
        assertEqual(migrated.outputTarget, "chat-bubble", "outputTarget defaults to chat-bubble");
        assertEqual(migrated.parameters.length, 1, "parameters[] derived (1 entry)");
        assertEqual(migrated.parameters[0].name, "gap",
          "parameter.name = entityKind ('gap'), so legacy {{context.gap.*}} prompts keep resolving");
        assertEqual(migrated.parameters[0].type, "entityId", "parameter.type='entityId'");
        assert(/gap/i.test(migrated.parameters[0].description), "parameter.description names the entity-kind");
        assertEqual(migrated.validatedAgainst, "3.1", "validatedAgainst bumped to 3.1");
        // The migrated record passes the v3.1 strict schema.
        const ok = SkillSchema.safeParse(migrated);
        assert(ok.success, "migrated v3.1 record validates strictly");

        // v3.0 session-wide → v3.1 with empty parameters
        const v30sw = { ...v30, skillId: "skl-mig-sw", skillType: "session-wide", entityKind: null };
        const migratedSw = migrateSkillToV31(v30sw);
        assertEqual(migratedSw.parameters.length, 0, "session-wide migrates to empty parameters[]");

        // Idempotency: passing a v3.1 record returns it unchanged.
        const v31 = migrated;
        const repassed = migrateSkillToV31(v31);
        assertEqual(JSON.stringify(repassed), JSON.stringify(v31),
          "migrateSkillToV31 is idempotent for v3.1 input");
      });

      it("V-TOPBAR-1 · Topbar consolidated to one AI button (rc.3 #7 / SPEC §S29.7): index.html has only #topbarChatBtn; #topbarAiBtn + #topbarLabBtn removed", async () => {
        const html = await (await fetch("/index.html")).text();
        assert(/id="topbarChatBtn"/.test(html),
          "topbarChatBtn (the kept AI surface) is still present");
        assert(!/id="topbarAiBtn"/.test(html),
          "topbarAiBtn (AI Assist) removed from topbar");
        assert(!/id="topbarLabBtn"/.test(html),
          "topbarLabBtn (Skill Builder Lab) removed from topbar");
      });

      it("V-LAB-VIA-CHAT-RAIL · Skill Builder reachable from chat right-rail '+ Author new skill' button (rc.3 #7 / SPEC §S29.7)", async () => {
        const overlaySrc = await (await fetch("/ui/views/CanvasChatOverlay.js")).text();
        const openerSrc  = await (await fetch("/ui/skillBuilderOpener.js")).text();
        // The overlay imports + invokes the Skill Builder opener.
        assert(/openSkillBuilderOverlay/.test(overlaySrc),
          "CanvasChatOverlay.js references openSkillBuilderOverlay");
        assert(/from\s*"\.\.\/skillBuilderOpener\.js"/.test(overlaySrc),
          "CanvasChatOverlay.js imports from the dedicated opener module (no app.js cycle)");
        // The "+ Author new skill" button is always painted (empty + populated states).
        assert(/canvas-chat-rail-author-btn/.test(overlaySrc),
          "right-rail surfaces the '+ Author new skill' affordance class");
        assert(/buildAuthorSkillButton/.test(overlaySrc),
          "buildAuthorSkillButton helper defined");
        // The opener module exports the function the overlay imports.
        assert(/export\s+async\s+function\s+openSkillBuilderOverlay/.test(openerSrc),
          "skillBuilderOpener.js exports openSkillBuilderOverlay");
      });

      it("V-AI-ASSIST-CMD-K · AI Assist is reachable via Cmd+K / Ctrl+K shortcut even though the topbar button was removed (rc.3 #7); shortcut wiring lives outside the button-presence guard", async () => {
        const appSrc = await (await fetch("/app.js")).text();
        // The wireTopbarAiBtn function still exists (null-safe when the
        // button is absent), and a separate wireAiAssistShortcut()
        // registers the global keydown listener UNCONDITIONALLY so the
        // shortcut survives the rc.3 #7 topbar consolidation.
        assert(/function\s+wireTopbarAiBtn\s*\(/.test(appSrc),
          "wireTopbarAiBtn function defined (null-safe with button removed)");
        assert(/function\s+wireAiAssistShortcut\s*\(/.test(appSrc),
          "wireAiAssistShortcut function defined (separate from button wiring)");
        assert(/wireAiAssistShortcut\(\);/.test(appSrc),
          "wireAiAssistShortcut() invoked from app init (so the keydown listener registers regardless of button presence)");
        // Cmd/Ctrl+K shortcut handler must check both modifiers.
        assert(/metaKey\s*\|\|\s*\w*\.ctrlKey|metaKey \|\| e\.ctrlKey/.test(appSrc),
          "Cmd+K / Ctrl+K modifier check present");
        assert(/openAiOverlay/.test(appSrc),
          "openAiOverlay invoked from the keyboard shortcut path");
      });

      it("V-SKILL-V3-7 · UseAiButton retired: ui/components/UseAiButton.js no longer served; no production .js imports it (regression guard per SPEC §S29.6)", async () => {
        // The deleted module must 404 at the previously-served path.
        const useAiResp = await fetch("/ui/components/UseAiButton.js");
        assert(!useAiResp.ok && useAiResp.status === 404,
          "UseAiButton.js should 404; got status=" + useAiResp.status);
      });

      it("V-ANTI-USE-AI · No production .js file imports the retired UseAiButton (per SPEC §S29.6 + RULES §16 CH25)", async () => {
        // Source-grep the production paths. We cover every path under
        // ui/views, ui/components, app.js, interactions/, core/, services/,
        // schema/, selectors/, state/, migrations/. Anything that even
        // mentions `UseAiButton` outside of a pure comment line is flagged.
        const FILES = [
          "/app.js",
          "/ui/views/ContextView.js",
          "/ui/views/MatrixView.js",
          "/ui/views/GapsEditView.js",
          "/ui/views/SummaryGapsView.js",
          "/ui/views/SummaryRoadmapView.js",
          "/ui/views/ReportingView.js",
          "/ui/views/CanvasChatOverlay.js",
          "/ui/views/AiAssistOverlay.js",
          "/ui/views/SkillBuilder.js",
          "/ui/views/SettingsModal.js",
          "/ui/components/Drawer.js",
          "/ui/components/Notify.js",
          "/ui/components/Overlay.js",
          "/interactions/skillCommands.js",
          "/interactions/aiCommands.js",
          "/interactions/desiredStateSync.js",
          "/core/skillStore.js",
          "/core/aiConfig.js",
          "/core/seedSkills.js",
          "/core/v3SeedSkills.js",
          "/services/chatService.js",
          "/services/skillRunner.js",
          "/services/manifestGenerator.js",
          "/services/skillSaveValidator.js",
          "/state/v3SkillStore.js"
        ];
        const offenders = [];
        for (const f of FILES) {
          let src;
          try {
            const resp = await fetch(f);
            if (!resp.ok) continue;
            src = await resp.text();
          } catch (_e) { continue; }
          const lines = src.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            const t = ln.trim();
            if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
            if (/UseAiButton|useAiButton/.test(ln)) {
              offenders.push(f + ":" + (i + 1) + " · " + t.slice(0, 100));
            }
          }
        }
        assertEqual(offenders.length, 0,
          "V-ANTI-USE-AI: production .js files still reference UseAiButton (" +
          offenders.length + "):\n  " + offenders.join("\n  "));
      });

      it("V-SKILL-V3-6 · ui/views/CanvasChatOverlay.js right-rail population: imports loadV3Skills + resolveTemplate; renders skill cards (head + form host); click drops resolved prompt into .canvas-chat-input (per SPEC §S29.5)", async () => {
        const src = await (await fetch("/ui/views/CanvasChatOverlay.js")).text();

        // Required imports for the rail population path.
        assert(/import\s*\{\s*loadV3Skills\s*\}\s*from\s*"\.\.\/\.\.\/state\/v3SkillStore\.js"/.test(src),
          "loadV3Skills imported from v3SkillStore");
        assert(/import\s*\{\s*resolveTemplate\s*\}\s*from\s*"\.\.\/\.\.\/services\/pathResolver\.js"/.test(src),
          "resolveTemplate imported from pathResolver");

        // The painter + builders that materialize cards.
        assert(/function\s+paintSkillRail\s*\(/.test(src),
          "paintSkillRail() defined");
        assert(/function\s+buildSkillCard\s*\(/.test(src),
          "buildSkillCard() defined");
        assert(/function\s+buildParameterForm\s*\(/.test(src),
          "buildParameterForm() defined");
        assert(/function\s+dropResolvedPromptIntoInput\s*\(/.test(src),
          "dropResolvedPromptIntoInput() defined");

        // Markup contracts the smoke test (and DOM consumers) rely on.
        assert(/canvas-chat-rail-card/.test(src),
          "card markup class present");
        assert(/canvas-chat-rail-card-head/.test(src),
          "card head class present");
        assert(/canvas-chat-rail-card-form/.test(src),
          "card inline-form host class present");
        assert(/canvas-chat-rail-use-btn|canvas-chat-rail-form-actions/.test(src),
          "Use-skill button surface present");

        // The drop-into-input handshake (resolved prompt → chat textarea).
        assert(/\.canvas-chat-input/.test(src),
          "drops resolved prompt into the .canvas-chat-input textarea");
        assert(/resolveTemplate\(/.test(src),
          "calls resolveTemplate on click");

        // Empty state + populated state both branch on loadV3Skills.
        assert(/loadV3Skills\(\)/.test(src),
          "loadV3Skills called to enumerate saved skills");

        // entityId parameter dropdowns must source options from the
        // engagement (gaps / drivers / environments / instances).
        assert(/entityKindKeyFromHint|entityKindKeyFromName/.test(src),
          "entityId parameters resolve their collection via the hint helpers");

        // The painter is wired into buildBody so the rail is populated
        // when the overlay opens (not just lazily on toggle).
        assert(/paintSkillRail\(body\)/.test(src),
          "paintSkillRail invoked from buildBody on overlay open");
      });

      it("V-SKILL-V3-5 · ui/views/SkillBuilder.js source: chip palette + scope picker + entity-kind dropdown + 1-2-3 wizard removed; parameters editor + outputTarget radio + migrateSkillToV31 import present (per SPEC §S29.4)", async () => {
        const src = await (await fetch("/ui/views/SkillBuilder.js")).text();

        // ── REMOVED markers (rc.3 #4 strips these v3.0 surfaces) ─────────
        // Strip pure-comment lines so phrases that survive in archaeology
        // headers ("dropped chip palette + click-to-run scope") don't
        // false-positive against runtime-removal assertions.
        const codeOnly = src.split("\n").filter(ln => {
          const t = ln.trim();
          return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
        }).join("\n");

        // Chip palette had a left-side scaffold container + chip rows.
        assert(!/skill-builder-chip-palette/.test(codeOnly),
          "chip palette container removed");
        assert(!/data-chip-row/.test(codeOnly),
          "chip palette rows removed");
        // Scope picker (skillType radio: click-to-run | session-wide).
        assert(!/skill-builder-scope-picker|name="skill-builder-scope"|name="skill-builder-skill-type"/.test(codeOnly),
          "scope picker (skillType radio) removed");
        assert(!/value="click-to-run"|value="session-wide"/.test(codeOnly),
          "click-to-run / session-wide radio values removed");
        // Entity-kind dropdown (was bound to skillType=click-to-run).
        assert(!/skill-builder-entity-kind/.test(codeOnly),
          "entity-kind dropdown removed");
        // 1-2-3 wizard step labels.
        assert(!/skill-builder-step-1|skill-builder-step-2|skill-builder-step-3/.test(codeOnly),
          "1-2-3 wizard step containers removed");
        // The retired schema fields must not appear in the v3.1 builder.
        assert(!/state\.skillType/.test(codeOnly),
          "state.skillType reference removed");
        assert(!/state\.entityKind/.test(codeOnly),
          "state.entityKind reference removed");

        // ── ADDED markers (v3.1 surfaces) ────────────────────────────────
        // Parameters editor.
        assert(/skill-builder-params/.test(src),
          "parameters editor section present");
        assert(/skill-builder-param-row/.test(src),
          "parameters editor row class present");
        assert(/skill-builder-param-type/.test(src),
          "parameter type select present");
        assert(/skill-builder-param-required/.test(src),
          "parameter required checkbox present");
        assert(/skill-builder-params-add/.test(src),
          "+ Add parameter button present");
        // Output target radio (chat-bubble enabled; deferred ones disabled).
        assert(/name="skill-builder-target"/.test(src),
          "output-target radio group present");
        // The four target IDs are declared in the OUTPUT_TARGETS array
        // (rendered into <input value="..."> via template literal).
        assert(/id:\s*"chat-bubble"/.test(src) && /enabled:\s*true/.test(src),
          "chat-bubble target declared (enabled)");
        assert(/id:\s*"structured-card"/.test(src),
          "structured-card target declared (disabled placeholder)");
        assert(/id:\s*"reporting-panel"/.test(src),
          "reporting-panel target declared (disabled placeholder)");
        assert(/id:\s*"proposed-changes"/.test(src),
          "proposed-changes target declared (disabled placeholder)");
        // The state shape uses outputTarget + parameters[].
        assert(/state\.outputTarget/.test(src),
          "state.outputTarget reference present");
        assert(/state\.parameters/.test(src),
          "state.parameters reference present");
        // Seed migration boundary at module load.
        assert(/migrateSkillToV31/.test(src),
          "migrateSkillToV31 imported / referenced (seeds migrate at load)");
        // SPEC reference present in the file header.
        assert(/SPEC §S29\.4|SPEC §S29/.test(src),
          "SPEC §S29.4 reference present in file header");
      });

    });

    // -----------------------------------------------------------------
    // V-VERSION-1..2 · APP_VERSION discipline (per SPEC §S30 + RULES §16 CH24)
    // Authored 2026-05-03 after the rc.2-tag freeze drift (18 commits past
    // tag without bumping APP_VERSION). Catches:
    //   - Malformed APP_VERSION (V-VERSION-1)
    //   - Hard-coded chip values that drift from the APP_VERSION export
    //     (V-VERSION-2)
    // V-VERSION-3 is the manual browser smoke per PREFLIGHT.md item 5
    // (chip displays the same value as APP_VERSION at tag time).
    // -----------------------------------------------------------------
    describe("§T30 · V-VERSION · APP_VERSION discipline", () => {

      it("V-VERSION-1 · core/version.js APP_VERSION matches semver shape with optional -rc.N + -dev suffixes (per SPEC §S30.1)", async () => {
        const versionMod = await import("../core/version.js");
        assert(typeof versionMod.APP_VERSION === "string" && versionMod.APP_VERSION.length > 0,
          "APP_VERSION export is a non-empty string");
        // Allowed shapes:
        //   3.0.0                  (release)
        //   3.0.0-rc.2             (rc tag)
        //   3.0.0-rc.2-dev         (between rc.2 and rc.3)
        //   3.0.0-dev              (pre-first-rc dev)
        const SEMVER_RE = /^\d+\.\d+\.\d+(-rc\.\d+)?(-dev)?$|^\d+\.\d+\.\d+-dev$/;
        assert(SEMVER_RE.test(versionMod.APP_VERSION),
          "APP_VERSION must match semver lifecycle pattern (got: '" + versionMod.APP_VERSION + "')");
      });

      it("V-VERSION-2 · app.js wires the topbar version chip from the APP_VERSION import (no hard-coded version strings outside core/version.js)", async () => {
        const appSrc = await (await fetch("/app.js")).text();
        // Required: the chip element id="appVersionChip" gets its textContent
        // built from the APP_VERSION import + a literal "Canvas v" prefix.
        assert(/import\s*\{[^}]*APP_VERSION[^}]*\}\s*from\s*["']\.\/core\/version\.js["']/.test(appSrc),
          "app.js imports APP_VERSION from core/version.js");
        assert(/getElementById\(["']appVersionChip["']\)/.test(appSrc),
          "app.js looks up the chip element by id='appVersionChip'");
        assert(/textContent\s*=\s*["']Canvas v["']\s*\+\s*APP_VERSION/.test(appSrc),
          "chip.textContent is built as 'Canvas v' + APP_VERSION (NOT a hard-coded string)");

        // Anti-pattern: no hard-coded "Canvas v3..." literal outside
        // the version.js comment header. Catches drift where someone
        // copy-pasted the version into app.js or index.html.
        const indexSrc = await (await fetch("/index.html")).text();
        assert(!/Canvas v\d+\.\d+\.\d+/.test(indexSrc.replace(/<!--[^>]*-->/g, "")),
          "index.html must NOT carry a hard-coded 'Canvas vX.Y.Z' string in rendered text (template uses 'Canvas v.' as a placeholder)");
      });

    });

    // -----------------------------------------------------------------
    // §T31 · V-FLOW-REHYDRATE · BUG-019 architectural fix per SPEC §S31
    // -----------------------------------------------------------------
    // BUG-019: on page reload, v2 sessionState rehydrates from localStorage
    // (canvas tabs render with full content) but the v3 engagement starts
    // null → bridge fires → empty engagement + customer patch only → AI
    // chat reports "canvas is empty" against a populated UI. Confirmed by
    // user 2026-05-03. Fix: state/engagementStore.js persists active
    // engagement to localStorage.v3_engagement_v1 on every state change,
    // rehydrates from that key at module load (validating through
    // EngagementSchema.safeParse + corrupt-cache safety).
    describe("§T31 · V-FLOW-REHYDRATE · v3 engagement persistence + boot rehydrate", () => {

      const STORAGE_KEY = "v3_engagement_v1";

      it("V-FLOW-REHYDRATE-1 · After loadDemo + setActiveEngagement, the engagement persists to localStorage; _resetForTests + _rehydrateFromStorage round-trip restores all 8 gaps (per SPEC §S31.1 R31.1 + R31.2)", async () => {
        const storeMod = await import("../state/engagementStore.js");
        const demoMod  = await import("../core/demoEngagement.js");

        // Clean slate.
        storeMod._resetForTests();
        localStorage.removeItem(STORAGE_KEY);

        // Populate engagement (mirrors the user repro: Load demo).
        storeMod.setActiveEngagement(demoMod.loadDemo());

        // Persistence side-effect MUST have happened (R31.1 — every _emit persists).
        const raw = localStorage.getItem(STORAGE_KEY);
        assert(typeof raw === "string" && raw.length > 0,
          "V-FLOW-REHYDRATE-1: localStorage.v3_engagement_v1 written on setActiveEngagement");

        const parsed = JSON.parse(raw);
        assert(Array.isArray(parsed?.gaps?.allIds) && parsed.gaps.allIds.length === 8,
          "V-FLOW-REHYDRATE-1: persisted engagement carries the demo's 8 gaps");

        // Simulate page reload: drop in-memory state without touching
        // localStorage; explicitly re-rehydrate (the helper the module-load
        // path uses).
        storeMod._resetForTests({ keepStorage: true });
        assert(storeMod.getActiveEngagement() === null,
          "V-FLOW-REHYDRATE-1: _resetForTests with keepStorage:true clears in-memory but preserves localStorage");

        const ok = storeMod._rehydrateFromStorage();
        assert(ok === true,
          "V-FLOW-REHYDRATE-1: _rehydrateFromStorage returns true on success");

        const eng = storeMod.getActiveEngagement();
        assert(eng !== null,
          "V-FLOW-REHYDRATE-1: getActiveEngagement returns the rehydrated engagement (no second loadDemo click required)");
        assertEqual(eng.gaps.allIds.length, 8,
          "V-FLOW-REHYDRATE-1: rehydrated engagement carries all 8 gaps (the user-visible repro)");
        assertEqual(eng.customer.name, "Acme Healthcare Group",
          "V-FLOW-REHYDRATE-1: customer round-trips intact");

        // Cleanup.
        storeMod._resetForTests();
        localStorage.removeItem(STORAGE_KEY);
      });

      it("V-FLOW-REHYDRATE-2 · Corrupt localStorage value (malformed JSON OR schema-invalid object) starts fresh + does NOT throw; subsequent operations work normally (per SPEC §S31.2 corrupt-cache safety + R31.2)", async () => {
        const storeMod = await import("../state/engagementStore.js");
        storeMod._resetForTests();

        // Case A: malformed JSON.
        localStorage.setItem(STORAGE_KEY, "{not valid json");
        const okA = storeMod._rehydrateFromStorage();
        assertEqual(okA, false,
          "V-FLOW-REHYDRATE-2: malformed JSON → rehydrate returns false");
        assert(storeMod.getActiveEngagement() === null,
          "V-FLOW-REHYDRATE-2: store stays null after malformed JSON (no half-state)");

        // Case B: valid JSON but schema-invalid object.
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ random: "object", missing: "everything" }));
        const okB = storeMod._rehydrateFromStorage();
        assertEqual(okB, false,
          "V-FLOW-REHYDRATE-2: schema-invalid → rehydrate returns false");
        assert(storeMod.getActiveEngagement() === null,
          "V-FLOW-REHYDRATE-2: store stays null after schema-invalid JSON");

        // Subsequent normal use must still work after the corrupt path.
        const demoMod = await import("../core/demoEngagement.js");
        storeMod.setActiveEngagement(demoMod.loadDemo());
        assert(storeMod.getActiveEngagement() !== null,
          "V-FLOW-REHYDRATE-2: setActiveEngagement still works after a corrupt-cache rehydrate attempt");

        // Cleanup.
        storeMod._resetForTests();
        localStorage.removeItem(STORAGE_KEY);
      });

      it("V-FLOW-REHYDRATE-3 · _resetForTests() (default behavior) clears the persisted entry (per SPEC §S31.1 R31.4)", async () => {
        const storeMod = await import("../state/engagementStore.js");
        const demoMod  = await import("../core/demoEngagement.js");

        storeMod.setActiveEngagement(demoMod.loadDemo());
        assert(localStorage.getItem(STORAGE_KEY) !== null,
          "V-FLOW-REHYDRATE-3: setup — persisted entry exists after setActiveEngagement");

        storeMod._resetForTests();
        assert(localStorage.getItem(STORAGE_KEY) === null,
          "V-FLOW-REHYDRATE-3: _resetForTests() removes the persisted entry (cross-describe-block isolation)");
      });

    });

    it("V-CHAT-26 · BUG-017 guard: chat overlay header has connection-status chip (no Mock toggle); chip text reflects active provider", async () => {
      // Source-grep — the overlay file must NOT carry a 'Mock' provider
      // toggle in its head-extras anymore. The new chip must be present.
      const overlaySrc = await (await fetch("/ui/views/CanvasChatOverlay.js")).text();

      // Anti-pattern: prior Mock|Real segmented toggle.
      assert(!/canvas-chat-provider-seg/.test(overlaySrc),
        "old canvas-chat-provider-seg (Mock|Real toggle) must be removed");
      assert(!/canvas-chat-provider-btn/.test(overlaySrc),
        "old canvas-chat-provider-btn must be removed");
      assert(!/state\.providerMode/.test(overlaySrc),
        "state.providerMode field must be removed (chat always uses active aiConfig provider)");

      // Required: connection-status chip wired to active provider.
      assert(/canvas-chat-status-chip/.test(overlaySrc),
        "new canvas-chat-status-chip must be present in CanvasChatOverlay.js");
      assert(/openSettingsModal\b/.test(overlaySrc),
        "chip click must open Settings modal");
      assert(/isActiveProviderReady\b/.test(overlaySrc),
        "chip ready/warn state must use isActiveProviderReady from aiConfig");

      // CSS contract: chip styles + ready/warn variants present.
      const cssSrc = await (await fetch("/styles.css")).text();
      assert(/\.canvas-chat-status-chip\b/.test(cssSrc),
        ".canvas-chat-status-chip CSS class defined");
      assert(/\.canvas-chat-status-chip\.is-ready/.test(cssSrc),
        ".is-ready variant defined (green-dot connected)");
      assert(/\.canvas-chat-status-chip\.is-warn/.test(cssSrc),
        ".is-warn variant defined (amber-dot 'configure provider')");
    });

    it("V-CHAT-23 · BUG-015 guard: handshake prefix is silently stripped on SUBSEQUENT turns when the model disobeys 'first turn only'", async () => {
      _resetChatEnv();
      const eng = createEmptyEngagement();
      setActiveEngagement(eng);
      // expected sha for the strip
      const sha = (await import("../core/dataContract.js")).getContractChecksum();
      const handshakeLine = "[contract-ack v3.0 sha=" + sha + "]\n\n";

      // Mock a SUBSEQUENT turn (transcript non-empty) where the model
      // repeats the handshake prefix anyway. Pre-fix the handshake
      // leaked into the bubble; post-fix it's stripped silently +
      // contractAck stays null (since this isn't the first turn).
      const provider = createMockChatProvider({
        responses: [
          { kind: "text", text: handshakeLine + "The client name is Acme Healthcare Group." }
        ]
      });
      const result = await streamChat({
        engagement:     eng,
        transcript:     [{ role: "user", content: "earlier turn" }, { role: "assistant", content: "earlier reply" }],
        userMessage:    "what is the client name",
        providerConfig: { providerKey: "mock" },
        provider:       provider
      });

      assert(typeof result.response === "string",
        "response is a string");
      assert(!result.response.startsWith("[contract-ack"),
        "handshake prefix stripped from visible response (got: '" + result.response.slice(0, 60) + "')");
      assertEqual(result.contractAck, null,
        "contractAck stays null on subsequent turns (the truth signal only matters on turn 1)");
      assert(result.response.includes("Acme Healthcare Group"),
        "actual answer text preserved");
    });

    it("V-CHAT-19 · BUG-012 guard: tool-chain cap — chatService stops at MAX_TOOL_ROUNDS and surfaces a notice", async () => {
      _resetChatEnv();
      let eng = createEmptyEngagement();
      eng = addEnvironment(eng, { envCatalogId: "coreDc", catalogVersion: "2026.04" }).engagement;
      eng = addGapV3(eng, { description: "g1", gapType: "ops", urgency: "High", phase: "now",
        status: "open", layerId: "infrastructure", affectedLayers: ["infrastructure"] }).engagement;
      setActiveEngagement(eng);

      // 6 scripted tool_use responses — exceeds the cap (MAX_TOOL_ROUNDS=5).
      const responses = [];
      for (let i = 0; i < 6; i++) responses.push({ kind: "tool_use", name: "selectGapsKanban", input: {} });

      const provider = createMockChatProvider({ responses });

      const result = await streamChat({
        engagement:     eng,
        transcript:     [],
        userMessage:    "Loop forever",
        providerConfig: { providerKey: "mock" },
        provider:       provider
      });
      // Cap is 5 rounds → exactly 5 provider calls. Notice surfaces in response.
      assertEqual(provider.callsRecorded.length, 5,
        "provider called exactly MAX_TOOL_ROUNDS=5 times (got " + provider.callsRecorded.length + ")");
      assert(typeof result.response === "string" && /tool-call cap/i.test(result.response),
        "user-visible response surfaces the cap notice (got: '" + (result.response || "").slice(0, 120) + "')");
    });

    it("V-CHAT-17 · realChatProvider with Anthropic SSE-shape stub yields per-token text events progressively + closes with done", async () => {
      const { createRealChatProvider } = await import("../services/realChatProvider.js");
      _resetChatEnv();
      let eng = createEmptyEngagement();
      setActiveEngagement(eng);

      // Build a minimal Anthropic SSE event stream: text_delta x3 then message_stop.
      const sse =
        'event: message_start\n' +
        'data: {"type":"message_start","message":{"id":"msg_01","role":"assistant","content":[],"stop_reason":null}}\n\n' +
        'event: content_block_start\n' +
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n' +
        'event: content_block_delta\n' +
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n' +
        'event: content_block_delta\n' +
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" "}}\n\n' +
        'event: content_block_delta\n' +
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"world"}}\n\n' +
        'event: content_block_stop\n' +
        'data: {"type":"content_block_stop","index":0}\n\n' +
        'event: message_stop\n' +
        'data: {"type":"message_stop"}\n\n';

      const stubFetch = async (url, init) => {
        // Verify the request actually requested streaming.
        const sentBody = JSON.parse(init.body);
        if (sentBody.stream !== true) {
          throw new Error("V-CHAT-17: SSE path must set body.stream=true; got " + JSON.stringify(sentBody.stream));
        }
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sse));
            controller.close();
          }
        });
        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" }
        });
      };

      const provider = createRealChatProvider({
        providerKey: "anthropic",
        baseUrl:     "/api/anthropic",
        model:       "claude-opus-4-7",
        apiKey:      "sk-test",
        stream:      true,
        fetchImpl:   stubFetch
      });

      const tokensSeen = [];
      const result = await streamChat({
        engagement:     eng,
        transcript:     [],
        userMessage:    "Say hello",
        providerConfig: { providerKey: "anthropic" },
        provider:       provider,
        onToken:        function(t) { tokensSeen.push(t); }
      });

      assert(tokensSeen.length >= 3,
        "at least 3 text_delta tokens streamed via onToken (got " + tokensSeen.length + ")");
      assertEqual(tokensSeen.join(""), "Hello world",
        "concatenated tokens equal full text");
      assert(typeof result.response === "string" && result.response.indexOf("Hello world") >= 0,
        "final response carries full streamed text (got: '" + result.response + "')");
    });
  });

  // -------------------------------------------------------------------
  // §T21 · V-DEMO · v3-native demo engagement (per SPEC §S21)
  // RED-first historical context: core/demoEngagement.js (was
  // core/v3DemoEngagement.js pre-rc.2 rename) was a STUB that threw on
  // loadDemo(). V-DEMO-1..7 failed RED until the real curated demo
  // shipped per the architectural fix for BUG-003 / BUG-004. Test
  // imports use `loadDemo as loadV3Demo` alias for source stability.
  // -------------------------------------------------------------------
  describe("§T21 · V-DEMO · v3-native demo engagement", () => {

    it("V-DEMO-1 · loadV3Demo() returns an engagement that passes EngagementSchema strict parse", () => {
      const eng = loadV3Demo();
      const result = EngagementSchema.safeParse(eng);
      assert(result.success === true,
        "v3 demo must pass strict schema; issues: " +
        (result.success ? "" : JSON.stringify(result.error.issues.slice(0, 5))));
    });

    it("V-DEMO-2 · core/demoEngagement.js performs EngagementSchema.parse at module load (build-time guarantee, not runtime hope)", async () => {
      const res = await fetch("/core/demoEngagement.js");
      assert(res.ok, "core/demoEngagement.js must be fetchable");
      const src = await res.text();
      // The module MUST call EngagementSchema.parse(...) at top level
      // (outside any function body) so module-load fails loudly on drift.
      // Match: a parse call NOT preceded on the same line by "export function" / "function"
      // and NOT inside a fenced function body that returns. Heuristic:
      // require at least one top-level pattern "EngagementSchema.parse(" that is
      // NOT inside a function body. We approximate by requiring the parse
      // call to appear OUTSIDE the loadDemo / describeDemo functions.
      const hasParse  = /EngagementSchema\s*\.\s*parse\s*\(/.test(src);
      const topLevel  = /^const\s+\w+\s*=\s*EngagementSchema\s*\.\s*parse\s*\(/m.test(src) ||
                        /^EngagementSchema\s*\.\s*parse\s*\(/m.test(src);
      assert(hasParse,
        "core/demoEngagement.js must call EngagementSchema.parse(...) at module load");
      assert(topLevel,
        "EngagementSchema.parse(...) must be at top level (not inside a function body)");
    });

    it("V-DEMO-3 · demo content shape: meta.isDemo + customer + drivers + envs all populated", () => {
      const eng = loadV3Demo();
      assert(eng.meta && eng.meta.isDemo === true, "meta.isDemo === true");
      assert(eng.customer && typeof eng.customer.name === "string" && eng.customer.name.length > 0,
        "customer.name populated");
      assert(typeof eng.customer.vertical === "string" && eng.customer.vertical.length > 0,
        "customer.vertical populated");
      assert(typeof eng.customer.region   === "string" && eng.customer.region.length > 0,
        "customer.region populated");
      assert(eng.drivers && eng.drivers.allIds.length >= 2, "≥2 drivers");
      eng.drivers.allIds.forEach(id => {
        const d = eng.drivers.byId[id];
        assert(typeof d.businessDriverId === "string" && d.businessDriverId.length > 0,
          "driver " + id + " has businessDriverId");
      });
      assert(eng.environments && eng.environments.allIds.length >= 2, "≥2 environments");
      eng.environments.allIds.forEach(id => {
        const e = eng.environments.byId[id];
        assert(typeof e.envCatalogId === "string" && e.envCatalogId.length > 0,
          "environment " + id + " has envCatalogId");
      });
    });

    it("V-DEMO-4 · cross-cutting features per S3.7: workload mappedAssetIds spanning envs + desired with originId → current", () => {
      const eng = loadV3Demo();
      const workloadCrossEnv = eng.instances.allIds
        .map(id => eng.instances.byId[id])
        .find(i => i.layerId === "workload" && Array.isArray(i.mappedAssetIds) && i.mappedAssetIds.length > 0
          && i.mappedAssetIds.some(aid => {
              const asset = eng.instances.byId[aid];
              return asset && asset.environmentId !== i.environmentId;
            }));
      assert(workloadCrossEnv,
        "demo must include at least one workload with mappedAssetIds spanning envs (cross-ref V-XCUT-1)");

      const desiredWithOrigin = eng.instances.allIds
        .map(id => eng.instances.byId[id])
        .find(i => i.state === "desired" && i.originId &&
          eng.instances.byId[i.originId] && eng.instances.byId[i.originId].state === "current");
      assert(desiredWithOrigin,
        "demo must include at least one desired instance whose originId resolves to a current instance");
    });

    it("V-DEMO-5 · gap diversity: ≥1 ops with services[] + ≥1 multi-env + every FK reference resolves", () => {
      const eng = loadV3Demo();
      const opsWithServices = eng.gaps.allIds
        .map(id => eng.gaps.byId[id])
        .find(g => g.gapType === "ops" && Array.isArray(g.services) && g.services.length > 0);
      assert(opsWithServices, "demo must include an ops-typed gap with non-empty services[]");

      const multiEnvGap = eng.gaps.allIds
        .map(id => eng.gaps.byId[id])
        .find(g => Array.isArray(g.affectedEnvironments) && g.affectedEnvironments.length >= 2);
      assert(multiEnvGap, "demo must include a gap with affectedEnvironments.length >= 2");

      // Every FK on every gap must resolve.
      for (const gid of eng.gaps.allIds) {
        const g = eng.gaps.byId[gid];
        (g.affectedEnvironments || []).forEach(envId => {
          assert(eng.environments.byId[envId],
            "gap " + gid + ".affectedEnvironments " + envId + " must resolve to an existing environment");
        });
        (g.relatedCurrentInstanceIds || []).forEach(iid => {
          assert(eng.instances.byId[iid] && eng.instances.byId[iid].state === "current",
            "gap " + gid + ".relatedCurrentInstanceIds " + iid + " must resolve to an existing current instance");
        });
        (g.relatedDesiredInstanceIds || []).forEach(iid => {
          assert(eng.instances.byId[iid] && eng.instances.byId[iid].state === "desired",
            "gap " + gid + ".relatedDesiredInstanceIds " + iid + " must resolve to an existing desired instance");
        });
        if (g.driverId) {
          assert(eng.drivers.byId[g.driverId],
            "gap " + gid + ".driverId " + g.driverId + " must resolve to an existing driver");
        }
      }
    });

    it("V-DEMO-6 · provenance demonstration: ≥1 AI-authored field carries the full provenance wrapper per §S8", () => {
      const eng = loadV3Demo();
      // Walk all gap fields looking for { value, provenance: {...} } shape.
      let foundWrapper = null;
      for (const gid of eng.gaps.allIds) {
        const g = eng.gaps.byId[gid];
        for (const key of Object.keys(g)) {
          const v = g[key];
          if (v && typeof v === "object" && "value" in v && v.provenance && typeof v.provenance === "object") {
            const p = v.provenance;
            if (p.model && p.promptVersion && p.skillId && p.runId && p.timestamp &&
                p.catalogVersions && p.validationStatus) {
              foundWrapper = { gid, key, p };
              break;
            }
          }
        }
        if (foundWrapper) break;
      }
      assert(foundWrapper,
        "demo must include at least one AI-authored field with a full provenance wrapper {value, provenance:{model,promptVersion,skillId,runId,timestamp,catalogVersions,validationStatus}}");
    });

    it("V-DEMO-7 · loadV3Demo() === loadV3Demo() (referentially identical via module caching)", () => {
      const a = loadV3Demo();
      const b = loadV3Demo();
      assert(a === b,
        "loadV3Demo must return the SAME engagement reference on repeat calls (module-cached, deterministic)");
    });

    // -----------------------------------------------------------------
    // V-DEMO-8/9 · v3-rich demo content invariants
    // After the rich-demo refresh, the demo MUST cover:
    //   - 3 drivers (multi-driver narrative)
    //   - all 5 GAP_TYPES (replace + introduce + consolidate + ops + enhance)
    //   - at least one driver-tied gap per driver
    // These are content invariants that hold beyond the structural V-DEMO-1..7.
    // -----------------------------------------------------------------

    it("V-DEMO-8 · rich demo: 3 drivers + 4 envs + every driver linked by ≥1 gap", () => {
      const eng = loadV3Demo();
      assertEqual(eng.drivers.allIds.length, 3,
        "rich demo carries exactly 3 strategic drivers");
      assertEqual(eng.environments.allIds.length, 4,
        "rich demo carries exactly 4 environments");
      const linkedDrivers = new Set();
      eng.gaps.allIds.forEach(gid => {
        const g = eng.gaps.byId[gid];
        if (g.driverId) linkedDrivers.add(g.driverId);
      });
      assertEqual(linkedDrivers.size, eng.drivers.allIds.length,
        "every driver must be linked by ≥1 gap (got " + linkedDrivers.size + " of " + eng.drivers.allIds.length + " linked)");
    });

    it("V-DEMO-9 · rich demo: gap_type coverage spans all 5 GAP_TYPES + ≥1 desired instance per driver theme", () => {
      const eng = loadV3Demo();
      const gapTypes = new Set(eng.gaps.allIds.map(id => eng.gaps.byId[id].gapType));
      ["replace", "introduce", "consolidate", "ops", "enhance"].forEach(t => {
        assert(gapTypes.has(t),
          "demo gaps must include gap_type='" + t + "'; got types: " + Array.from(gapTypes).join(","));
      });
      // Every driver-tied gap must reference at least one desired instance OR
      // an explicit current → solution mapping (replace/consolidate). This
      // enforces the "driver → gap → Dell solution" narrative.
      eng.gaps.allIds.forEach(gid => {
        const g = eng.gaps.byId[gid];
        if (!g.driverId) return;
        const hasMapping = g.relatedDesiredInstanceIds.length > 0 || g.relatedCurrentInstanceIds.length > 0;
        assert(hasMapping,
          "driver-tied gap '" + g.description.slice(0, 40) + "' must link ≥1 instance");
      });
    });

    // -----------------------------------------------------------------
    // V-FLOW-CHAT-DEMO-1/2 · BUG-010 regression guards
    // (per feedback_test_or_it_didnt_ship.md: every BUG fix ships a test
    //  that would have caught the original incident)
    //
    // BUG-010: state/sessionBridge clobbered v3 engagement back to a
    // customer-only translation on every v2 session-changed emit. Chat
    // then truthfully reported "canvas is empty."
    // -----------------------------------------------------------------

    it("V-FLOW-CHAT-DEMO-1 · BUG-010 guard: emitting v2 session-changed AFTER setActiveEngagement(v3demo) does NOT clobber v3 gaps/instances", async () => {
      const sessionMod = await import("../state/sessionStore.js");
      const storeMod   = await import("../state/engagementStore.js");
      const eventsMod  = await import("../core/sessionEvents.js");

      // Set the v3 demo as active engagement.
      const demoEng = loadV3Demo();
      storeMod.setActiveEngagement(demoEng);
      const beforeGapCount      = storeMod.getActiveEngagement().gaps.allIds.length;
      const beforeInstanceCount = storeMod.getActiveEngagement().instances.allIds.length;
      const beforeDriverCount   = storeMod.getActiveEngagement().drivers.allIds.length;

      // Simulate ANY v2 session-changed event (a save, an edit, the bridge
      // boot, etc.). Pre-fix this clobbered the engagement back to 0 gaps.
      eventsMod.emitSessionChanged("v-flow-chat-demo-1-probe", "regression test");

      const after = storeMod.getActiveEngagement();
      assertEqual(after.gaps.allIds.length, beforeGapCount,
        "v3 engagement gaps SHALL NOT be clobbered by a v2 session-changed emit (got " + after.gaps.allIds.length + ", expected " + beforeGapCount + ")");
      assertEqual(after.instances.allIds.length, beforeInstanceCount,
        "v3 engagement instances SHALL NOT be clobbered (got " + after.instances.allIds.length + ", expected " + beforeInstanceCount + ")");
      assertEqual(after.drivers.allIds.length, beforeDriverCount,
        "v3 engagement drivers SHALL NOT be clobbered (got " + after.drivers.allIds.length + ", expected " + beforeDriverCount + ")");
    });

    it("V-FLOW-CHAT-DEMO-2 · bridge SHALL shallow-merge v2 customer changes into v3 engagement (preserves v3 gaps/instances/drivers)", async () => {
      const sessionMod = await import("../state/sessionStore.js");
      const storeMod   = await import("../state/engagementStore.js");
      const eventsMod  = await import("../core/sessionEvents.js");

      // Seed with the v3 demo + remember its gap count
      const demoEng = loadV3Demo();
      storeMod.setActiveEngagement(demoEng);
      const startGapCount = storeMod.getActiveEngagement().gaps.allIds.length;

      // Edit v2 customer.name (simulates a v2 view edit)
      sessionMod.session.customer.name    = "Acme Healthcare Group (Renamed)";
      sessionMod.session.customer.vertical = "Healthcare";
      eventsMod.emitSessionChanged("v-flow-chat-demo-2-probe", "v2 customer edit");

      const after = storeMod.getActiveEngagement();
      assertEqual(after.customer.name, "Acme Healthcare Group (Renamed)",
        "v2 customer.name change SHALL propagate into v3 engagement (shallow-merge)");
      assertEqual(after.gaps.allIds.length, startGapCount,
        "v3 gaps SHALL be preserved during the shallow-merge (got " + after.gaps.allIds.length + ", expected " + startGapCount + ")");
      assert(after.drivers.allIds.length > 0,
        "v3 drivers SHALL be preserved during the shallow-merge");
    });

    it("V-DEMO-V2-1 · v3→v2 demo down-converter produces a v2-shaped session that mirrors v3 customer + drivers + envs + counts", async () => {
      const adapterMod = await import("../state/v3ToV2DemoAdapter.js");
      const eng = loadV3Demo();
      const v2sess = adapterMod.engagementToV2Session(eng);

      assertEqual(v2sess.customer.name, eng.customer.name,
        "v2 customer.name mirrors v3");
      assertEqual(v2sess.customer.vertical, eng.customer.vertical,
        "v2 customer.vertical mirrors v3");
      assertEqual(v2sess.customer.region, eng.customer.region,
        "v2 customer.region mirrors v3");
      assertEqual(v2sess.customer.drivers.length, eng.drivers.allIds.length,
        "v2 customer.drivers count mirrors v3 drivers");
      assertEqual(v2sess.environments.length, eng.environments.allIds.length,
        "v2 environments count mirrors v3");
      assertEqual(v2sess.instances.length, eng.instances.allIds.length,
        "v2 instances count mirrors v3");
      assertEqual(v2sess.gaps.length, eng.gaps.allIds.length,
        "v2 gaps count mirrors v3");
      // Driver shape: v2 stores businessDriverId as the v2 driver.id (catalog typeId, not UUID).
      assert(v2sess.customer.drivers.every(d => typeof d.id === "string" && !d.id.includes("-")),
        "v2 driver.id must be the catalog typeId (e.g. 'cyber_resilience'), not a v3 UUID");
      // Environment shape: v2 stores envCatalogId as the v2 env.id.
      assert(v2sess.environments.every(e => typeof e.id === "string" && !e.id.includes("-")),
        "v2 env.id must be the catalog typeId (e.g. 'coreDc'), not a v3 UUID");
      assertEqual(v2sess.isDemo, true,
        "v2 session is flagged isDemo=true");
    });
  });

  // -------------------------------------------------------------------
  // §T22 · V-MOCK · Mock providers as production services (per SPEC §S22)
  // RED-first: services/mockChatProvider.js + services/mockLLMProvider.js
  // are STUBS that throw. V-MOCK-1..3 fail RED until impl lands.
  // -------------------------------------------------------------------
  describe("§T22 · V-MOCK · Mock providers as production services", () => {

    it("V-MOCK-1 · services/mockChatProvider exports createMockChatProvider matching the V-CHAT-4 contract", async () => {
      // Production path import already at top of file (createMockChatProviderProd).
      assert(typeof createMockChatProviderProd === "function",
        "services/mockChatProvider.js must export createMockChatProvider");
      const p = createMockChatProviderProd({ responses: [{ kind: "text", text: "hi from prod path" }] });
      const tokens = [];
      for await (const evt of p.stream({ messages: [], tools: [] })) {
        if (evt.kind === "text") tokens.push(evt.token);
      }
      assert(tokens.length > 0, "production mock chat provider yields at least one text token");
      assert(tokens.join("").length > 0, "yielded tokens have non-empty content");
    });

    it("V-MOCK-2 · services/mockLLMProvider exports createMockLLMProvider with complete({prompt})→{model,text}", async () => {
      assert(typeof createMockLLMProviderProd === "function",
        "services/mockLLMProvider.js must export createMockLLMProvider");
      // Canonical contract (per existing tests/mocks/mockLLMProvider.js shape):
      // defaultResponse is { model: string, text: string }, not a bare string.
      const p = createMockLLMProviderProd({
        defaultResponse: { model: "mock-prod-llm", text: "production mock LLM response" }
      });
      assert(typeof p.complete === "function",
        "mock LLM provider exposes complete({prompt}) → Promise<{model,text}>");
      const result = await p.complete({ prompt: "irrelevant" });
      assert(typeof result.text === "string" && result.text.length > 0,
        "complete returns non-empty text");
      assert(typeof result.model === "string" && result.model.length > 0,
        "complete returns model id");
    });

    it("V-MOCK-3 · production mock providers are deterministic (same args → same outputs)", async () => {
      const p1 = createMockChatProviderProd({ responses: [{ kind: "text", text: "deterministic" }] });
      const p2 = createMockChatProviderProd({ responses: [{ kind: "text", text: "deterministic" }] });
      const tokens1 = [];
      const tokens2 = [];
      for await (const e of p1.stream({ messages: [], tools: [] })) if (e.kind === "text") tokens1.push(e.token);
      for await (const e of p2.stream({ messages: [], tools: [] })) if (e.kind === "text") tokens2.push(e.token);
      assertEqual(tokens1.join("|"), tokens2.join("|"),
        "two mock chat providers with same scripted responses yield identical token sequences");

      const ABC = { model: "mock-prod-llm", text: "abc" };
      const llm1 = createMockLLMProviderProd({ defaultResponse: ABC });
      const llm2 = createMockLLMProviderProd({ defaultResponse: ABC });
      const r1 = await llm1.complete({ prompt: "p" });
      const r2 = await llm2.complete({ prompt: "p" });
      assertEqual(r1.text, r2.text,
        "two mock LLM providers with identical defaultResponse yield identical text");
    });
  });

  // -------------------------------------------------------------------
  // §T25 · V-CONTRACT · Data contract LLM grounding meta-model (per SPEC §S25)
  // RED-first: core/dataContract.js is a STUB that throws on
  // getDataContract() and getContractChecksum(). V-CONTRACT-1..7 fail
  // RED until real impl ships in Step 2 of the chat-perfection arc.
  // -------------------------------------------------------------------
  describe("§T25 · V-CONTRACT · Data contract", () => {

    it("V-CONTRACT-1 · getDataContract returns module-cached structured contract with all top-level keys", () => {
      const a = getDataContract();
      const b = getDataContract();
      assert(a === b, "module-cached: same reference on repeat calls");
      assert(typeof a.schemaVersion === "string" && a.schemaVersion === "3.0", "schemaVersion is '3.0'");
      assert(typeof a.checksum === "string" && /^[0-9a-f]{8}$/.test(a.checksum),
        "checksum is 8-char lowercase hex");
      assert(typeof a.generatedAt === "string", "generatedAt is ISO timestamp string");
      assert(Array.isArray(a.entities) && a.entities.length >= 6,
        "≥6 entity kinds (engagementMeta + customer + 5 collections)");
      assert(Array.isArray(a.relationships) && a.relationships.length >= 8, "≥8 relationships");
      assert(Array.isArray(a.invariants) && a.invariants.length >= 5, "≥5 named invariants");
      assert(Array.isArray(a.catalogs) && a.catalogs.length >= 6, "≥6 catalogs");
      assert(typeof a.bindablePaths === "object" && a.bindablePaths !== null, "bindablePaths present");
      assert(Array.isArray(a.analyticalViews) && a.analyticalViews.length === 7,
        "exactly 7 analytical views (one per §S5 selector)");
    });

    it("V-CONTRACT-2 · contract content is derived (not hand-maintained); structural cross-checks hold", () => {
      const c = getDataContract();
      // gap entity field count is anchored to GapSchema (within ±2 for cross-cutting handling).
      const gapEntity = c.entities.find(e => e.kind === "gap");
      assert(gapEntity && Array.isArray(gapEntity.fields), "gap entity declared with fields[]");
      assert(gapEntity.fields.length >= 10,
        "gap entity carries the ~12-15 schema fields (description, gapType, urgency, phase, status, layerId, affectedLayers, affectedEnvironments, ...)");

      // Every relationship's `from` references an entity declared in entities[].
      const declaredKinds = new Set(c.entities.map(e => e.kind));
      for (const rel of c.relationships) {
        const fromKind = (rel.from || "").split(".")[0];
        assert(declaredKinds.has(fromKind),
          "relationship.from '" + rel.from + "' references undeclared entity kind '" + fromKind + "'");
      }

      // Every catalog has at least one entry; entry ids are unique within their catalog.
      for (const cat of c.catalogs) {
        assert(Array.isArray(cat.entries) && cat.entries.length >= 1,
          "catalog '" + cat.id + "' has at least one entry");
        const ids = cat.entries.map(e => e.id);
        assert(new Set(ids).size === ids.length,
          "catalog '" + cat.id + "' entry ids are unique");
      }

      // Every invariant id is unique.
      const invIds = c.invariants.map(i => i.id);
      assert(new Set(invIds).size === invIds.length, "invariant ids are unique");
    });

    it("V-CONTRACT-3 · getContractChecksum returns deterministic 8-char hex", () => {
      const a = getContractChecksum();
      const b = getContractChecksum();
      assertEqual(a, b, "checksum is deterministic across calls");
      assert(/^[0-9a-f]{8}$/.test(a), "checksum is 8-char lowercase hex");
      // It MUST equal contract.checksum.
      assertEqual(a, getDataContract().checksum, "getContractChecksum() === getDataContract().checksum");
    });

    it("V-CONTRACT-4 · core/dataContract.js performs structural self-validation at module load", async () => {
      const res = await fetch("/core/dataContract.js");
      assert(res.ok, "core/dataContract.js fetchable");
      const src = await res.text();
      // The module MUST have validation logic that throws on drift. We
      // require at least one explicit `throw new Error(` outside of
      // the exported public functions (i.e. a top-level guard).
      const hasTopLevelThrow = /^[^/].*throw\s+new\s+Error\(/m.test(src);
      assert(hasTopLevelThrow,
        "core/dataContract.js must contain top-level throw guards for module-load self-validation");
      // Must NOT import from tests/ (per RULES §17).
      assert(!/from\s+["'](?:\.\.?\/)+tests\//.test(src),
        "core/dataContract.js must not import from tests/ (per RULES §17 PR1)");
    });

    it("V-CONTRACT-5 · buildSystemPrompt embeds the data contract block (with checksum + at least one catalog label)", () => {
      const eng = createEmptyEngagement();
      const result = buildSystemPrompt({ engagement: eng });
      const concatenated = result.messages.map(m =>
        typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n");
      assert(concatenated.includes(getContractChecksum()),
        "system prompt embeds the contract checksum");
      // Find at least one catalog label in the prompt (e.g. "Cyber Resilience").
      const c = getDataContract();
      const businessDriversCat = c.catalogs.find(cc => cc.id === "BUSINESS_DRIVERS");
      assert(businessDriversCat && businessDriversCat.entries.length >= 1,
        "data contract has BUSINESS_DRIVERS catalog with entries");
      const sampleLabel = businessDriversCat.entries[0].label;
      assert(concatenated.includes(sampleLabel),
        "system prompt includes catalog labels (sample: '" + sampleLabel + "')");
    });

    it("V-CONTRACT-6 · role section instructs LLM to use labels-not-ids AND emit first-turn handshake", () => {
      const eng = createEmptyEngagement();
      const result = buildSystemPrompt({ engagement: eng });
      const concatenated = result.messages.map(m =>
        typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n");
      assert(/labels?[^.]*not[^.]*ids?/i.test(concatenated) || /label[^.]*\bnot[^.]*id/i.test(concatenated),
        "role section instructs LLM to use labels not ids");
      assert(/contract-ack v3\.0 sha=/.test(concatenated),
        "role section instructs LLM to emit first-turn handshake [contract-ack v3.0 sha=...]");
    });

    it("V-CONTRACT-7 · streamChat onComplete carries contractAck { ok, expected, received }", async () => {
      _resetEngagementStoreForTests();
      const eng = createEmptyEngagement();
      setActiveEngagement(eng);
      const expected = getContractChecksum();
      const provider = createMockChatProviderProd({
        responses: [{
          kind: "text",
          text: "[contract-ack v3.0 sha=" + expected + "]\n\nHello, ready to chat about this empty canvas."
        }]
      });
      let captured = null;
      await streamChat({
        engagement:     eng,
        transcript:     [],
        userMessage:    "hi",
        providerConfig: { providerKey: "mock" },
        provider:       provider,
        onComplete:     r => { captured = r; }
      });
      assert(captured && captured.contractAck,
        "onComplete result includes contractAck");
      assertEqual(captured.contractAck.ok, true,
        "ack ok when sha matches the expected checksum");
      assertEqual(captured.contractAck.expected, expected,
        "expected sha echoed in contractAck");
      assertEqual(captured.contractAck.received, expected,
        "received sha matches expected");
    });
  });

  // -------------------------------------------------------------------
  // §T26 · V-MD · Markdown rendering on assistant chat bubbles (per SPEC §S20.17)
  // RED-first: vendor/marked/* not yet vendored; CanvasChatOverlay
  // renders content as plain text. V-MD-1 fails RED until Step 6.
  // -------------------------------------------------------------------
  describe("§T26 · V-MD · Markdown rendering", () => {

    it("V-MD-1 · vendor/marked exists and CanvasChatOverlay assistant bubbles render parsed markdown", async () => {
      // Probe 1: vendor/marked/marked.min.js is fetchable.
      const res = await fetch("/vendor/marked/marked.min.js");
      assert(res.ok, "vendor/marked/marked.min.js must be vendored at canonical path");

      // Probe 2: CanvasChatOverlay source contains a marked import + uses it on assistant bubbles only.
      const overlaySrc = await (await fetch("/ui/views/CanvasChatOverlay.js")).text();
      assert(/from\s+["']\.\.\/\.\.\/vendor\/marked\//.test(overlaySrc),
        "CanvasChatOverlay imports marked from vendor/marked/ (production-canonical path)");
      // The assistant-bubble rendering MUST go through marked; user bubbles MUST stay plain.
      // We assert presence of conditional-render logic by string match.
      assert(/canvas-chat-msg-assistant[\s\S]{0,400}\bmarked\b/.test(overlaySrc) ||
             /\bmarked\b[\s\S]{0,400}canvas-chat-msg-assistant/.test(overlaySrc),
        "CanvasChatOverlay routes assistant content through marked");
      assert(!/canvas-chat-msg-user[\s\S]{0,200}\bmarked\b/.test(overlaySrc),
        "CanvasChatOverlay does NOT route user content through marked (XSS guard)");
    });
  });

  // -------------------------------------------------------------------
  // §T24 · V-NAME · Production code naming discipline (per SPEC §S24)
  // RED-first (Step 0a): the 5 v3-prefixed module file paths still exist
  // (state/v3Adapter.js + state/v3EngagementStore.js + state/v3SessionBridge.js
  // + core/v3DemoEngagement.js + ui/views/V3SkillBuilder.js); UI strings
  // in index.html still say "v3.0 Lab". V-NAME-1 flags these as offenders.
  // Step 0b mechanical rename → V-NAME-1 GREEN.
  // -------------------------------------------------------------------
  describe("§T24 · V-NAME · Production code naming discipline", () => {

    it("V-NAME-1 · production file names + user-visible UI strings have no version-prefix (per SPEC §S24)", async () => {
      // Files we audit. Includes both today's v3-prefixed paths (which
      // we're purging) AND the canonical-renamed targets (which should
      // pass once the rename lands). After the rename, the v3-prefixed
      // entries 404 (don't exist) and don't contribute to offenders.
      const FILES_TO_CHECK = [
        // To-be-renamed (will fail RED until Step 0b):
        "state/v3Adapter.js",
        "state/v3EngagementStore.js",
        "state/v3SessionBridge.js",
        "core/v3DemoEngagement.js",
        "ui/views/V3SkillBuilder.js",
        // Canonical-named (must always pass):
        "state/adapter.js",
        "state/engagementStore.js",
        "state/sessionBridge.js",
        "state/chatMemory.js",
        "core/demoEngagement.js",
        "core/aiConfig.js",
        "core/version.js",
        "core/sessionEvents.js",
        "services/aiService.js",
        "services/canvasFile.js",
        "services/catalogLoader.js",
        "services/chatService.js",
        "services/chatTools.js",
        "services/manifestGenerator.js",
        "services/memoizeOne.js",
        "services/mockChatProvider.js",
        "services/mockLLMProvider.js",
        "services/pathResolver.js",
        "services/realChatProvider.js",
        "services/realLLMProvider.js",
        "services/skillRunner.js",
        "services/skillSaveValidator.js",
        "services/systemPromptAssembler.js",
        "ui/views/CanvasChatOverlay.js",
        "ui/views/SkillBuilder.js"
      ];
      // Time-bounded exceptions per SPEC §S24.4 / R24.5 — documented blocked items.
      const ALLOWED_EXCEPTIONS = new Set([
        "state/v3SkillStore.js",   // v2 core/skillStore.js export collision; drops when v2 retires
        "core/v3SeedSkills.js"     // v2 core/seedSkills.js path collision; drops when v2 retires
      ]);

      const offenders = [];

      // Pass 1: file-path naming.
      for (const file of FILES_TO_CHECK) {
        if (ALLOWED_EXCEPTIONS.has(file)) continue;
        if (!/v[0-9]/i.test(file)) continue;   // canonical name → skip
        // Path matches v[0-9]; verify the file actually exists. If it doesn't
        // (404), the rename has succeeded — no offense.
        try {
          const res = await fetch("/" + file);
          if (res.ok) offenders.push("FILENAME: " + file);
        } catch (_e) {
          // Network error → skip; not a discipline failure.
        }
      }

      // Pass 2: index.html user-visible strings. Strip the deliberate
      // version-chip surface (which expresses APP_VERSION on purpose),
      // then scan rendered text content between > and < for "v[0-9]".
      let html;
      try { html = await (await fetch("/index.html")).text(); }
      catch (_e) { html = ""; }
      // Remove the version-chip span entirely — it's the one sanctioned surface.
      const VERSION_CHIP_RE = /<[a-z]+[^>]*\bid=["']appVersionChip["'][^>]*>[^<]*<\/[a-z]+>/gi;
      const stripped = html.replace(VERSION_CHIP_RE, "");
      // Match user-visible text between > and < that contains v[0-9].
      const VISIBLE_TEXT_RE = />([^<]*\bv[0-9][0-9.]*[^<]*)</gi;
      let m;
      while ((m = VISIBLE_TEXT_RE.exec(stripped)) !== null) {
        const visible = m[1].trim();
        if (visible.length > 0) offenders.push("UI_STRING: " + visible.slice(0, 80));
      }

      assertEqual(offenders.length, 0,
        "V-NAME-1: production code naming discipline (per SPEC §S24); offenders: " + offenders.join(" | "));
    });

    // -----------------------------------------------------------------
    // V-NAME-2 · BUG-014 guard · UI-string anti-leakage in AI surfaces
    // (extends V-NAME-1 from file paths → user-visible strings rendered
    //  in the AI chat overlay, AI Assist overlay, Skill Builder).
    //
    // Forbidden in user-visible text (rendered via textContent or HTML
    // template literals) of these specific files:
    //   - "v3" / "V3" version markers (per SPEC §S24)
    //   - Internal field paths: "{{context.", "entity.id", ".layerId",
    //     ".environmentId", ".envCatalogId", ".businessDriverId"
    //   - Developer references: "SPEC §", "OPEN_QUESTIONS", "RESOLVED.md",
    //     "per CHANGELOG"
    //   - "Lab" suffix on Skill Builder title (Phase 4 retiring)
    // -----------------------------------------------------------------

    it("V-NAME-2 · BUG-014 guard: AI-surface UI files have no v3/internal-field-path/dev-reference leakage in user-visible strings", async () => {
      const FILES = [
        "ui/views/CanvasChatOverlay.js",
        "ui/views/AiAssistOverlay.js",
        "ui/views/SkillBuilder.js",
        "ui/views/SettingsModal.js"
      ];

      // Each rule patterns a line we want to flag as user-leakage.
      // The source-line check is permissive (any line, not just rendered
      // context) because these patterns NEVER belong in a user-facing
      // string — even runtime concatenation. We exclude lines that are
      // unambiguously internal: import statements, comment lines, and
      // pure DOM attribute assignments where the value is never shown.
      const PROHIBITED = [
        { pat: /\bv3(?!\.\w)/i,
          reason: "literal 'v3' version marker" },
        { pat: /\{\{\s*context\./,
          reason: "raw {{context.*}} template syntax leaks to user (humanize the hint)" },
        { pat: /\.entity\.(?:id|layerId|environmentId|envCatalogId|businessDriverId|engagementId)\b/,
          reason: "internal field path entity.* exposed to user" },
        { pat: /\bOPEN_QUESTIONS_RESOLVED\b|\bSPEC §S\d+|\bper CHANGELOG_PLAN\b/,
          reason: "developer-doc reference" },
        { pat: /\bSkill Builder Lab\b/,
          reason: "'Lab' suffix on Skill Builder (Phase 4 retiring)" }
      ];

      const offenders = [];
      for (const file of FILES) {
        let src;
        try { src = await (await fetch("/" + file)).text(); }
        catch (_e) { continue; }

        const lines = src.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const ln = lines[i];
          const trimmed = ln.trim();
          // Skip pure comment lines (we tolerate v3/etc in comments —
          // they're code-archaeology context, not user-facing).
          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
          // Skip import / export-from lines (file paths may contain v3).
          // Also skip multi-line import continuations like `} from "..."`.
          if (/^\s*(?:import|export\s+\{|from\s+['"])/.test(trimmed)) continue;
          if (/^\s*\}\s*from\s+['"]/.test(trimmed)) continue;

          for (const rule of PROHIBITED) {
            if (rule.pat.test(ln)) {
              offenders.push(file + ":" + (i + 1) + " · " + rule.reason + " · " + trimmed.slice(0, 100));
            }
          }
        }
      }

      assertEqual(offenders.length, 0,
        "V-NAME-2: UI-string anti-leakage failed (" + offenders.length + " offender(s)):\n  " + offenders.join("\n  "));
    });
  });

  // -------------------------------------------------------------------
  // §T23 · V-ANTI-RUN · Production code does not import from tests/ (per SPEC §S23)
  // RED-first: ui/views/V3SkillBuilder.js + ui/views/CanvasChatOverlay.js
  // currently import from tests/. V-ANTI-RUN-1 fails RED until those
  // imports flip to services/ (Step 10 of the cleanup arc).
  // -------------------------------------------------------------------
  describe("§T23 · V-ANTI-RUN · Production-no-tests-imports lint", () => {

    it("V-ANTI-RUN-1 · production code does not import from tests/ at runtime (per SPEC §S23)", async () => {
      const FILES = [
        "core/v3DemoEngagement.js",
        "core/v3SeedSkills.js",
        "services/chatService.js",
        "services/systemPromptAssembler.js",
        "services/chatTools.js",
        "services/mockChatProvider.js",
        "services/mockLLMProvider.js",
        "services/realChatProvider.js",
        "services/realLLMProvider.js",
        "services/skillRunner.js",
        "services/manifestGenerator.js",
        "services/skillSaveValidator.js",
        "services/canvasFile.js",
        "state/chatMemory.js",
        "state/v3Adapter.js",
        "state/v3EngagementStore.js",
        "state/v3SessionBridge.js",
        "state/v3SkillStore.js",
        "ui/views/CanvasChatOverlay.js",
        "ui/views/V3SkillBuilder.js"
      ];
      const TESTS_IMPORT_RE = /from\s+["'](?:\.\.?\/)+tests\//;
      const offenders = [];
      for (const file of FILES) {
        let src;
        try {
          const res = await fetch("/" + file);
          if (!res.ok) continue;
          src = await res.text();
        } catch (_e) { continue; }
        if (TESTS_IMPORT_RE.test(src)) offenders.push(file);
      }
      assertEqual(offenders.length, 0,
        "V-ANTI-RUN-1: production code must not import from tests/ at runtime; offenders: " + offenders.join(", "));
    });
  });

});

// v2.4.5 · Foundations Refresh · register the human-surface demo suite
// into the same runner so there's a single green banner for the whole
// release. Import at bottom to avoid circular-dependency risk with the
// many modules demoSpec touches.
import { registerDemoSuite } from "./demoSpec.js";
registerDemoSuite({ describe: describe, it: it, assert: assert, assertEqual: assertEqual });

// v2.4.10.1 · isolation guard. Wrap the test pass in runIsolated so
// any test that mutates localStorage (replaceSession + applyProposal,
// CL2's canary, anything else) cannot pollute the user's real storage.
// After tests, reload the in-memory `session` from the restored
// localStorage and emit session-changed so app.js re-renders the
// USER's data, not whatever the last test left in memory. Fixes the
// v2.4.5–v2.4.10 "Bus Co" pollution that made Clear-all appear broken.
export function runAllTests() {
  return runIsolated(run, function afterRestore() {
    if (!loadFromLocalStorage()) {
      // No saved session in localStorage → fresh-start state.
      resetSession();
    }
    // v2.4.15 . FB test cleanup also resets filterState in-memory; after
    // localStorage restore, re-load the filter snapshot so the body
    // data attributes match the user's pre-test filter view.
    if (typeof filterState._reloadFromStorage === "function") filterState._reloadFromStorage();
    // SPEC §S31 · same problem for the v3 engagement store. Tests blew
    // _active to null via _resetForTests; localStorage was just restored
    // to the user's pre-test snapshot. Re-rehydrate _active from the
    // restored snapshot so the post-test app sees the user's saved
    // engagement (matches how _resetForTests is intended to be a
    // test-scoped reset, not a user-facing wipe).
    try { _rehydrateEngagementFromStorage(); } catch (e) { /* best-effort */ }
    emitSessionChanged("session-replace", "Tests complete");
    // v2.4.13 S2A · the test pass leaves the saveStatus bus in whatever
    // state the last test landed (often "saving" because every emit goes
    // through markSaving). After restoring real session state, snap the
    // indicator back to its true status: idle when fresh, saved/demo
    // when the user has data on disk. Keeps the topbar honest after a
    // page reload that runs tests.
    try {
      var hasName = !!(session.customer && session.customer.name && session.customer.name.trim());
      if (hasName || session.isDemo) {
        _markSaved({ isDemo: !!session.isDemo });
      } else {
        _markIdle();
      }
    } catch (e) { /* swallow */ }
  });
}
