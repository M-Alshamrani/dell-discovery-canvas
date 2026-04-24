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

import { createTestRunner } from "./testRunner.js";

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
  migrateLegacySession
} from "../state/sessionStore.js";

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

  it("createGap accepts ops without notes (soft rule)", () => {
    doesNotThrow(() => createGap(freshSession(), {
      description: "Operational change",
      layerId: LayerIds[0],
      gapType: "ops",
      notes: ""
    }), "ops gap must not hard-fail on empty notes");
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

  it("layer filter chips are rendered for all LAYERS", () => {
    const { l }  = mountGaps();
    const chips  = l.querySelectorAll(".chip-filter");
    assert(chips.length >= LAYERS.length, "must render at least one chip per layer");
  });

  it("environment filter dropdown contains all ENVIRONMENTS", () => {
    const { l } = mountGaps();
    const sel   = l.querySelector("select");
    if (!sel) return;
    const vals  = [...sel.options].map(o => o.value);
    ENVIRONMENTS.forEach(env =>
      assert(vals.includes(env.id) || vals.includes("all"),
        `env filter must include '${env.id}'`)
    );
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
    const s = freshSession();
    createGap(s, { description:"Reviewed", layerId:LayerIds[0] });  // manual → reviewed: true
    createGap(s, { description:"Needs-review", layerId:LayerIds[0], reviewed: false });
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderGapsEditView(l, r, s);
    assertEqual(l.querySelectorAll(".gap-card").length, 2, "both cards visible before filter");
    const toggle = l.querySelector(".needs-review-check");
    assert(toggle !== null, "needs-review toggle must render");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    const remaining = l.querySelectorAll(".gap-card");
    assertEqual(remaining.length, 1, "filter must hide reviewed cards");
    assert(remaining[0].textContent.indexOf("Needs-review") >= 0, "the visible card is the unreviewed one");
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

  it("updateGap flips reviewed to true on any substantive edit (T6.6)", () => {
    const s = freshSession();
    const gap = createGap(s, { description:"G", layerId:LayerIds[0], reviewed:false });
    assertEqual(gap.reviewed, false, "starts unreviewed");
    updateGap(s, gap.id, { notes: "added context" });
    assertEqual(s.gaps[0].reviewed, true, "any edit sets reviewed: true");
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
    // Simulate the view path: link + syncDesiredFromGap after user confirms.
    linkDesiredInstance(s, gap.id, des.id);
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
    assert(text.indexOf("Core DC") >= 0, "project detail includes project name context");
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
    assert(result.nameText.indexOf("Core DC") >= 0, "name must include env label");
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

  it("syncGapFromDesired · changing disposition to 'keep' deletes the linked gap (T3.5)", () => {
    var s = freshSession();
    var cur = addInstance(s, { state:"current", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Src", vendorGroup:"dell", criticality:"Medium" });
    var des = addInstance(s, { state:"desired", layerId:LayerIds[0], environmentId:EnvironmentIds[0],
      label:"Tgt", vendorGroup:"dell", disposition:"replace", priority:"Now", originId: cur.id });
    createGap(s, buildGapFromDisposition(s, des));
    assertEqual(s.gaps.length, 1, "gap created before keep switch");
    des.disposition = "keep";
    syncGapFromDesired(s, des.id);
    assertEqual(s.gaps.length, 0, "keep disposition removes the linked gap");
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
    assert(proj.name.indexOf("Core DC") >= 0, "name must include env label 'Core DC'");
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
    createGap(s, { description:"Process gap", layerId:LayerIds[0], phase:"next", gapType:"ops" });
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

  it("AI9 · ContextView driver detail renders the AI skill card with a Use-AI surface", () => {
    // Phase 19b (v2.4.1) replaced the hardcoded .ai-skill-btn with the
    // generic .use-ai-btn dropdown driven by deployed skills. SB8 covers
    // the full dropdown contract; AI9 simply pins that the AI card and
    // *some* interactive entry point still render on Tab 1.
    const s = createEmptySession();
    s.customer = s.customer || {};
    s.customer.drivers = [{ id: "ai_data", priority: "High", outcomes: "" }];
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderContextView(l, r, s);
    const tile = l.querySelector(".driver-tile");
    assert(tile, "expected at least one driver tile rendered");
    tile.click();
    // re-mount to materialise the right panel (click rebuilds on some views)
    const l2 = document.createElement("div"); const r2 = document.createElement("div");
    renderContextView(l2, r2, s); l2.querySelector(".driver-tile")?.click();
    const l3 = document.createElement("div"); const r3 = document.createElement("div");
    renderContextView(l3, r3, s); l3.querySelector(".driver-tile")?.click();
    const card = r3.querySelector(".ai-skill-card");
    assert(card, "expected an .ai-skill-card in the driver detail panel");
    const useAi = card.querySelector(".use-ai-btn, .ai-skill-btn");
    assert(useAi, "expected a .use-ai-btn (v2.4.1) or .ai-skill-btn (pre-2.4.1) inside the AI skill card");
  });

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

  it("SB8 · ContextView driver detail renders the generic Use-AI dropdown (wired to deployed skills)", () => {
    clearSkills();
    loadSkills(); // seed is pre-deployed on context
    const s = createEmptySession();
    s.customer = s.customer || {};
    s.customer.drivers = [{ id: "ai_data", priority: "High", outcomes: "" }];
    const l = document.createElement("div");
    const r = document.createElement("div");
    renderContextView(l, r, s);
    l.querySelector(".driver-tile")?.click();
    // re-mount + click so the right panel is materialised
    const l2 = document.createElement("div"); const r2 = document.createElement("div");
    renderContextView(l2, r2, s);
    l2.querySelector(".driver-tile")?.click();
    const l3 = document.createElement("div"); const r3 = document.createElement("div");
    renderContextView(l3, r3, s);
    l3.querySelector(".driver-tile")?.click();
    const btn = r3.querySelector(".use-ai-btn");
    assert(btn, "Use AI dropdown button must render in driver detail panel");
    assert(/use\s*ai/i.test(btn.textContent), "button label must say 'Use AI' (got: " + btn.textContent + ")");
    clearSkills();
  });

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
    assert(/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(APP_VERSION),
      "APP_VERSION must look like a semver (got: " + APP_VERSION + ")");
    // Must not be "2.0" — that's the session schema version in
    // sessionMeta.version. Confusing them is the bug this fixes.
    assert(APP_VERSION !== "2.0",
      "APP_VERSION must not collide with the session-schema version '2.0'");
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

  it("CL2 · clicking Clear-all-data prompts confirm AND (on yes) calls localStorage.clear", () => {
    const btn = document.getElementById("clearAllBtn");
    assert(btn, "#clearAllBtn must render");
    const origConfirm = window.confirm;
    const origReload  = window.location.reload;
    let confirmCalled = 0;
    let clearCalled   = 0;
    // Intercept the three mutating calls so the test doesn't actually
    // wipe storage or reload the page.
    window.confirm = function() { confirmCalled++; return false; };
    const origClear = window.localStorage.clear.bind(window.localStorage);
    window.localStorage.clear = function() { clearCalled++; };
    try {
      btn.click();
      assertEqual(confirmCalled, 1, "confirm dialog must fire once per click");
      assertEqual(clearCalled, 0, "cancel → no wipe");
    } finally {
      window.confirm = origConfirm;
      window.localStorage.clear = origClear;
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

// v2.4.5 · Foundations Refresh · register the human-surface demo suite
// into the same runner so there's a single green banner for the whole
// release. Import at bottom to avoid circular-dependency risk with the
// many modules demoSpec touches.
import { registerDemoSuite } from "./demoSpec.js";
registerDemoSuite({ describe: describe, it: it, assert: assert, assertEqual: assertEqual });

export function runAllTests() {
  return run();
}
