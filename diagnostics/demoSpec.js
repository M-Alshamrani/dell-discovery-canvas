// ============================================================================
// diagnostics/demoSpec.js — Phase 19e / v2.4.5 Foundations Refresh
//
// Integration suite that asserts the "human test surfaces" stay in sync
// with the current data model (see feedback_foundational_testing.md).
// Machine tests in appSpec.js verify contracts; demoSpec.js verifies
// that the DEMO SESSION and SEED SKILLS — the things a user exercises
// by hand — still drive real code paths.
//
// Covers:
//   Suite 31  · demo session shape                        (DS1–DS7)
//   Suite 32  · seed skills against FIELD_MANIFEST        (DS8–DS12)
//   Suite 33  · apply + undo byte-identical round-trip    (DS13–DS14)
//   Suite 34  · multi-persona coverage                    (DS15)
//   Suite 35  · session-changed bus wiring                (DS16–DS17)
//
// Registered into the appSpec runner via registerDemoSuite so every
// release ships a single green banner with machine + demo assertions.
// ============================================================================

import { validateInstance, validateGap } from "../core/models.js";
import { createDemoSession, DEMO_PERSONAS } from "../state/demoSession.js";
// rc.7 / 7e-8 Step H+J+K · session + replaceSession routed through the
// inlined shim. state/sessionStore.js DELETED in this commit.
import { session as liveSession, replaceSession } from "./v2TestFixtures.js";
import { seedSkills, SEED_SKILL_IDS } from "../core/seedSkills.js";
import { loadSkills, saveSkills, RESPONSE_FORMATS } from "../core/skillStore.js";
import { FIELD_MANIFEST } from "../core/fieldManifest.js";
import { WRITE_RESOLVERS, isWritablePath } from "../core/bindingResolvers.js";
import { applyProposal, applyAllProposals } from "../interactions/aiCommands.js";
import * as aiUndoStack from "../state/aiUndoStack.js";
// rc.7 / 7e-8 Step K · onSessionChanged retired with core/sessionEvents.js;
// DS16/DS17 migrated to subscribeActiveEngagement (v3-pure bus).
import { subscribeActiveEngagement } from "../state/engagementStore.js";
import { ACTION_IDS, GAP_TYPES as DEMO_GAP_TYPES } from "../core/taxonomy.js";
import { SERVICE_TYPES } from "../core/services.js";

// Count how many gaps reference an instanceId in EITHER link list.
// A "multi-linked" instance is one referenced by ≥2 gaps — the Phase 18
// warn-but-allow signal that must appear in the demo.
function countGapsLinkingInstance(gaps, instanceId) {
  return (gaps || []).filter(function(g) {
    return ((g.relatedCurrentInstanceIds || []).indexOf(instanceId) >= 0) ||
           ((g.relatedDesiredInstanceIds || []).indexOf(instanceId) >= 0);
  }).length;
}

export function registerDemoSuite(api) {
  var describe    = api.describe;
  var it          = api.it;
  var assert      = api.assert;
  var assertEqual = api.assertEqual;
  // rc.7 / 7e-5 · v3 fixture helpers shared from appSpec for DS13/14/16/17
  // (apply + undo round-trip tests against the v3-pure resolver dispatch).
  var _installSessionAsV3Engagement = api._installSessionAsV3Engagement || function(_s) {};
  var _resetEngagementStoreForTests = api._resetEngagementStoreForTests || function() {};
  var getActiveEngagement = api.getActiveEngagement || function() { return null; };
  var setActiveEngagement = api.setActiveEngagement || function(_e) {};

  // ──────────────────────────────────────────────────────────────
  // Suite 31 · demo session shape
  // ──────────────────────────────────────────────────────────────
  describe("31 · Phase 19e · demo session · data-model conformance", function() {

    it("DS1 · every demo instance passes validateInstance", function() {
      var s = createDemoSession();
      assert(Array.isArray(s.instances) && s.instances.length > 0,
        "demo session must define instances");
      s.instances.forEach(function(inst, idx) {
        try { validateInstance(inst); }
        catch (e) {
          assert(false, "instances[" + idx + "] (" + inst.id + "): " + e.message);
        }
      });
    });

    it("DS2 · every demo gap passes validateGap", function() {
      var s = createDemoSession();
      assert(Array.isArray(s.gaps) && s.gaps.length > 0,
        "demo session must define gaps");
      s.gaps.forEach(function(g, idx) {
        try { validateGap(g); }
        catch (e) {
          assert(false, "gaps[" + idx + "] (" + g.id + "): " + e.message);
        }
      });
    });

    it("DS3 · Phase 16 · at least one workload-layer instance with mappedAssetIds[]", function() {
      var s = createDemoSession();
      var workloads = s.instances.filter(function(i) { return i.layerId === "workload"; });
      assert(workloads.length >= 1,
        "demo must include at least one workload-layer instance (Phase 16)");
      var withMappings = workloads.filter(function(w) {
        return Array.isArray(w.mappedAssetIds) && w.mappedAssetIds.length >= 2;
      });
      assert(withMappings.length >= 1,
        "at least one workload instance must declare ≥2 mappedAssetIds (Phase 16 N-to-N)");
      // Every mappedAssetId must point at a real instance id in the demo.
      var idSet = {}; s.instances.forEach(function(i) { idSet[i.id] = true; });
      withMappings.forEach(function(w) {
        w.mappedAssetIds.forEach(function(assetId) {
          assert(idSet[assetId],
            "workload " + w.id + ".mappedAssetIds references missing instance '" + assetId + "'");
        });
      });
    });

    it("DS4 · Phase 18 · at least one instance is multi-linked (≥2 gaps reference it)", function() {
      var s = createDemoSession();
      var multi = s.instances.filter(function(i) {
        return countGapsLinkingInstance(s.gaps, i.id) >= 2;
      });
      assert(multi.length >= 1,
        "demo must exercise the Phase 18 multi-linked pattern (≥1 instance referenced by ≥2 gaps)");
    });

    it("DS5 · demo exercises both Dell and non-Dell vendor groups", function() {
      var s = createDemoSession();
      var hasDell     = s.instances.some(function(i) { return i.vendorGroup === "dell";    });
      var hasNonDell  = s.instances.some(function(i) { return i.vendorGroup === "nonDell"; });
      assert(hasDell,    "demo must include at least one Dell-vendor instance");
      assert(hasNonDell, "demo must include at least one non-Dell-vendor instance");
    });

    it("DS6 · at least one gap carries an explicit driverId (Phase 14)", function() {
      var s = createDemoSession();
      var withDriver = s.gaps.filter(function(g) { return typeof g.driverId === "string" && g.driverId.length > 0; });
      assert(withDriver.length >= 1,
        "demo must include ≥1 gap with driverId set (surfaces the gap→driver link)");
    });

    it("DS7 · at least one driver has non-empty outcomes", function() {
      var s = createDemoSession();
      var drivers = (s.customer && s.customer.drivers) || [];
      assert(drivers.length >= 1, "demo must define ≥1 driver");
      var withOutcomes = drivers.filter(function(d) {
        return typeof d.outcomes === "string" && d.outcomes.trim().length > 0;
      });
      assert(withOutcomes.length >= 1,
        "demo must include ≥1 driver with non-empty outcomes (exercises Phase 14 outcomes editor)");
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Suite 32 · seed skills vs FIELD_MANIFEST
  // ──────────────────────────────────────────────────────────────
  describe("32 · Phase 19e · seed skills · FIELD_MANIFEST alignment", function() {

    function originalSkillsBlob() {
      try { return window.localStorage.getItem("ai_skills_v1"); }
      catch (e) { return null; }
    }
    function restoreSkillsBlob(blob) {
      try {
        if (blob === null) window.localStorage.removeItem("ai_skills_v1");
        else               window.localStorage.setItem("ai_skills_v1", blob);
      } catch (e) {}
    }

    it("DS8 · seed skills survive normalizeSkill round-trip (skillStore.loadSkills)", function() {
      var saved = originalSkillsBlob();
      try {
        window.localStorage.removeItem("ai_skills_v1");
        saveSkills(seedSkills());
        var reloaded = loadSkills();
        assertEqual(reloaded.length, SEED_SKILL_IDS.length,
          "all " + SEED_SKILL_IDS.length + " seed skills must round-trip through normalizeSkill");
        SEED_SKILL_IDS.forEach(function(id) {
          var row = reloaded.find(function(s) { return s.id === id; });
          assert(row, "seed skill '" + id + "' must survive reload");
          assert(typeof row.tabId === "string" && row.tabId.length > 0, "seed must have tabId");
          assert(typeof row.promptTemplate === "string", "seed must have promptTemplate");
          assert(Array.isArray(row.outputSchema), "seed must have outputSchema array");
          assert(RESPONSE_FORMATS.indexOf(row.responseFormat) >= 0,
            "seed responseFormat '" + row.responseFormat + "' must be in RESPONSE_FORMATS");
        });
      } finally { restoreSkillsBlob(saved); }
    });

    it("DS9 · every seed skill outputSchema path exists in FIELD_MANIFEST and is writable", function() {
      var skills = seedSkills();
      skills.forEach(function(skill) {
        var tabManifest = FIELD_MANIFEST[skill.tabId] || [];
        skill.outputSchema.forEach(function(entry) {
          var manifestHit = tabManifest.find(function(f) { return f.path === entry.path; });
          assert(manifestHit,
            "seed '" + skill.id + "' → path '" + entry.path + "' missing from FIELD_MANIFEST[" + skill.tabId + "]");
          assertEqual(manifestHit.writable, true,
            "seed '" + skill.id + "' → path '" + entry.path + "' must be writable: true in FIELD_MANIFEST");
        });
      });
    });

    it("DS10 · every writable context.* path in any seed has a WRITE_RESOLVERS entry", function() {
      var skills = seedSkills();
      skills.forEach(function(skill) {
        skill.outputSchema.forEach(function(entry) {
          if (entry.path.indexOf("context.") === 0) {
            assert(WRITE_RESOLVERS[entry.path],
              "seed '" + skill.id + "' → context path '" + entry.path + "' has no WRITE_RESOLVERS entry");
          }
          assert(isWritablePath(entry.path),
            "seed '" + skill.id + "' → path '" + entry.path + "' must be writable (session.* OR resolver-backed)");
        });
      });
    });

    it("DS11 · every tab has at least one deployed seed skill", function() {
      var skills = seedSkills().filter(function(s) { return s.deployed; });
      ["context", "current", "desired", "gaps", "reporting"].forEach(function(tabId) {
        var hit = skills.filter(function(s) { return s.tabId === tabId; });
        assert(hit.length >= 1,
          "tab '" + tabId + "' must have ≥1 deployed seed skill so Use AI ▾ is populated on first run");
      });
    });

    it("DS12 · at least one seed skill per supported responseFormat (text-brief + json-scalars)", function() {
      var skills = seedSkills();
      var hasTextBrief   = skills.some(function(s) { return s.responseFormat === "text-brief";   });
      var hasJsonScalars = skills.some(function(s) { return s.responseFormat === "json-scalars"; });
      assert(hasTextBrief,   "seed library must include ≥1 text-brief skill");
      assert(hasJsonScalars, "seed library must include ≥1 json-scalars skill (exercises writable fields)");
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Suite 33 · apply + undo round-trip byte-identical
  // ──────────────────────────────────────────────────────────────
  describe("33 · Phase 19e · apply + undo · byte-identical round-trip", function() {

    it("DS13 · applyProposal → undoLast returns v3 engagement to JSON-identical state (post-7e-5)", function() {
      aiUndoStack._resetForTests();
      var s = createDemoSession();
      // Override a minimal subset for deterministic apply target.
      s.customer = { name: "Round-trip Co", vertical: "Enterprise", region: "EMEA",
                     drivers: [{ id: "cyber_resilience", priority: "Medium", outcomes: "prev" }] };
      s.environments = [{ id: "coreDc", hidden: false }];
      s.instances = [];
      s.gaps = [{ id: "g-ds13", description: "seed gap", layerId: "compute",
                  affectedLayers: ["compute"], affectedEnvironments: ["coreDc"],
                  urgency: "Low", phase: "later", gapType: "ops",
                  relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
                  status: "open", reviewed: true }];
      _installSessionAsV3Engagement(s);
      var v3GapId = s.gaps[0].id;
      var beforeEng = JSON.stringify(getActiveEngagement());
      applyProposal(
        { path: "context.selectedGap.urgency", label: "Gap urgency", kind: "scalar",
          before: "Low", after: "High" },
        { label: "apply for DS13", context: { selectedGap: { id: v3GapId } } }
      );
      assertEqual(getActiveEngagement().gaps.byId[v3GapId].urgency, "High",
        "apply mutated the v3 gap");
      aiUndoStack.undoLast();
      var afterEng = JSON.stringify(getActiveEngagement());
      assertEqual(afterEng, beforeEng,
        "apply + undoLast must return v3 engagement to byte-identical JSON -- data-integrity regression gate");
      aiUndoStack._resetForTests();
    });

    it("DS14 · applyAllProposals → undoLast returns v3 engagement to JSON-identical state (post-7e-5)", function() {
      aiUndoStack._resetForTests();
      var s = createDemoSession();
      s.customer = { name: "Bulk Apply Co", vertical: "Enterprise", region: "APJ",
                     drivers: [{ id: "cost_optimization", priority: "High", outcomes: "prev" }] };
      s.environments = [{ id: "coreDc", hidden: false }];
      s.instances = [];
      s.gaps = [{ id: "g-ds14", description: "bulk seed", layerId: "storage",
                  affectedLayers: ["storage"], affectedEnvironments: ["coreDc"],
                  urgency: "Low", phase: "later", gapType: "enhance",
                  notes: "before-notes",
                  relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
                  status: "open", reviewed: true }];
      _installSessionAsV3Engagement(s);
      var v3GapId = s.gaps[0].id;
      var beforeEng = JSON.stringify(getActiveEngagement());
      applyAllProposals([
        { path: "context.selectedGap.urgency", label: "Gap urgency", kind: "scalar",
          before: "Low", after: "High" },
        { path: "context.selectedGap.notes",   label: "Gap notes",   kind: "scalar",
          before: "before-notes", after: "after-notes" }
      ], { label: "bulk apply for DS14", context: { selectedGap: { id: v3GapId } } });
      var midEng = getActiveEngagement();
      assertEqual(midEng.gaps.byId[v3GapId].urgency, "High", "bulk apply mutated urgency");
      assertEqual(midEng.gaps.byId[v3GapId].notes, "after-notes", "bulk apply mutated notes");
      aiUndoStack.undoLast();
      var afterEng = JSON.stringify(getActiveEngagement());
      assertEqual(afterEng, beforeEng,
        "applyAll + undoLast must return v3 engagement to byte-identical JSON");
      aiUndoStack._resetForTests();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Suite 34 · multi-persona coverage
  // ──────────────────────────────────────────────────────────────
  describe("34 · Phase 19e · demo personas · registry + validation", function() {

    it("DS15 · every DEMO_PERSONA builds a session that passes validateInstance + validateGap", function() {
      assert(Array.isArray(DEMO_PERSONAS) && DEMO_PERSONAS.length >= 2,
        "DEMO_PERSONAS must ship ≥2 personas (default + at least one alternate)");
      DEMO_PERSONAS.forEach(function(p) {
        assert(typeof p.id    === "string" && p.id.length > 0,    "persona.id required");
        assert(typeof p.label === "string" && p.label.length > 0, "persona.label required");
        assert(typeof p.build === "function",                     "persona.build() required");
        var s = p.build();
        assert(s && typeof s === "object", "persona '" + p.id + "' build must return an object");
        (s.instances || []).forEach(function(inst, idx) {
          try { validateInstance(inst); }
          catch (e) {
            assert(false, "persona '" + p.id + "' instances[" + idx + "]: " + e.message);
          }
        });
        (s.gaps || []).forEach(function(g, idx) {
          try { validateGap(g); }
          catch (e) {
            assert(false, "persona '" + p.id + "' gaps[" + idx + "]: " + e.message);
          }
        });
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Suite 35b · Phase 17 · taxonomy coverage of the demo
  // (DS18-DS21 — ride along with the existing demoSpec describes)
  // ──────────────────────────────────────────────────────────────
  describe("35b · Phase 17 · demo session · taxonomy coverage", function() {

    it("DS18 · every demo instance.disposition is a valid taxonomy id (no legacy 'rationalize')", function() {
      var s = createDemoSession();
      var seen = {};
      s.instances.forEach(function(i) {
        if (i.disposition) {
          assert(ACTION_IDS.indexOf(i.disposition) >= 0,
            "instance " + i.id + " disposition '" + i.disposition +
            "' must be in ACTION_IDS (v2.4.8)");
          seen[i.disposition] = true;
        }
      });
      // Demo should exercise multiple actions — not just the single most
      // common one. Guards against an accidental "demo uses only replace
      // forever" regression.
      assert(Object.keys(seen).length >= 3,
        "demo instances must exercise at least 3 distinct Action values");
    });

    it("DS19 · every demo gap.gapType is a valid GAP_TYPES value (no 'rationalize')", function() {
      var s = createDemoSession();
      s.gaps.forEach(function(g) {
        if (g.gapType) {
          assert(DEMO_GAP_TYPES.indexOf(g.gapType) >= 0,
            "gap " + g.id + " gapType '" + g.gapType + "' must be in GAP_TYPES");
        }
      });
    });

    it("DS20 · demo exercises 'introduce' (no-current / 1-desired) pattern", function() {
      var s = createDemoSession();
      var introduceGaps = s.gaps.filter(function(g) { return g.gapType === "introduce"; });
      assert(introduceGaps.length >= 1,
        "demo must include at least one introduce gap (exercises linksCurrent: 0 rule)");
      introduceGaps.forEach(function(g) {
        assertEqual((g.relatedCurrentInstanceIds || []).length, 0,
          "introduce gap " + g.id + " must have 0 current links");
        assert((g.relatedDesiredInstanceIds || []).length >= 1,
          "introduce gap " + g.id + " must have ≥1 desired link");
      });
    });

    it("DS21 · demo exercises 'keep' and 'retire' dispositions (taxonomy coverage)", function() {
      var s = createDemoSession();
      var keeps   = s.instances.filter(function(i) { return i.disposition === "keep";   });
      var retires = s.instances.filter(function(i) { return i.disposition === "retire"; });
      assert(keeps.length   >= 1, "demo must include at least one 'keep' instance");
      assert(retires.length >= 1, "demo must include at least one 'retire' instance");
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Suite 35c · v2.4.11 · urgencyOverride coverage in demo
  // (DS22 — rides along to keep the two-surface rule honest)
  // ──────────────────────────────────────────────────────────────
  describe("35c · Phase 19k · demo session · urgencyOverride exercised", function() {

    it("DS22 · default demo includes ≥1 gap with urgencyOverride:true (so the lock+auto UI is exercisable from Load demo)", function() {
      var s = createDemoSession();
      var pinned = s.gaps.filter(function(g) { return g.urgencyOverride === true; });
      assert(pinned.length >= 1,
        "demo must include at least one gap with urgencyOverride:true so the override toggle is visible from Load demo");
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Suite 35d · v2.4.12 · services scope coverage in demo
  // (DS23 — every actionable demo gap exposes the new services field)
  // ──────────────────────────────────────────────────────────────
  describe("35d · Phase 19l · demo session · services array exercised", function() {

    it("DS23 · every demo gap with gapType in {replace, consolidate, introduce} has services.length ≥ 1", function() {
      var s = createDemoSession();
      var actionable = s.gaps.filter(function(g) {
        return ["replace", "consolidate", "introduce"].indexOf(g.gapType) >= 0;
      });
      assert(actionable.length >= 1,
        "demo must include ≥1 actionable gap (replace/consolidate/introduce) so the services chips are exercisable from Load demo");
      actionable.forEach(function(g) {
        assert(Array.isArray(g.services) && g.services.length >= 1,
          "demo gap " + g.id + " (gapType: " + g.gapType + ") must have services.length ≥ 1 to exercise the new chip UI from Load demo");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Suite 35e · v2.5.0 · domain-mapped services in demo so layered
  // signal color (urgency × domain) renders visibly from Load demo
  // ──────────────────────────────────────────────────────────────
  describe("35e · Phase 19m · demo session · services domain coverage", function() {

    it("DS24 · every demo gap with services has at least one service mapped to domain in {cyber, ops, data}", function() {
      // Layered-signal contract for v2.5.0 §3 CD5: catalog entries each grow
      // an optional `domain: "cyber"|"ops"|"data"|null` field. Demo gaps
      // include at least one domain-mapped service so the layered signal
      // accent renders visibly from Load demo. Today (RED): no service has
      // a domain field; this test fails until §3 CD5 lands.
      var s = createDemoSession();
      var withServices = s.gaps.filter(function(g) {
        return Array.isArray(g.services) && g.services.length > 0;
      });
      assert(withServices.length >= 1,
        "demo must include ≥1 gap with services to exercise DS24");

      var KNOWN_DOMAINS = ["cyber", "ops", "data"];
      withServices.forEach(function(g) {
        var hasDomainMapped = g.services.some(function(sid) {
          var entry = SERVICE_TYPES.find(function(svc) { return svc.id === sid; });
          return entry && KNOWN_DOMAINS.indexOf(entry.domain) >= 0;
        });
        assert(hasDomainMapped,
          "DS24: demo gap " + g.id + " (services: " + JSON.stringify(g.services) + ") must include at least one service mapped to a domain in {cyber, ops, data}. The catalog needs the domain field added in §3 CD5 of the v2.5.0 spec.");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // Suite 35 · engagement-changed bus wiring (post-Step-K v3-pure)
  // rc.7 / 7e-8 Step K · core/sessionEvents.js DELETED. Reason-tagged
  // emits ("ai-apply", "ai-undo") were a v2 contract; v3-pure bus
  // (subscribeActiveEngagement) emits the new engagement reference
  // without a reason. The principal-architect rewrite asserts the
  // v3 contract: subscribers fire on apply + undo (the underlying
  // re-render guarantee). Per R6 (rewrite-not-retire-with-negative).
  // ──────────────────────────────────────────────────────────────
  describe("35 · Phase 19e · engagement-changed bus · apply & undo emit", function() {

    it("DS16 · applyProposal triggers subscribeActiveEngagement listeners (post-Step-K v3-pure)", function() {
      aiUndoStack._resetForTests();
      var s = createDemoSession();
      s.customer = { name: "Bus Co", vertical: "Enterprise", region: "EMEA", drivers: [] };
      s.environments = [{ id: "coreDc", hidden: false }];
      s.instances = [];
      s.gaps = [{ id: "g-ds16", description: "bus", layerId: "compute",
                  affectedLayers: ["compute"], affectedEnvironments: ["coreDc"],
                  urgency: "Low", phase: "later", gapType: "replace",
                  relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
                  status: "open", reviewed: true }];
      _installSessionAsV3Engagement(s);
      var v3GapId = s.gaps[0].id;
      var fireCount = 0;
      var off = subscribeActiveEngagement(function(_eng) { fireCount++; });
      try {
        applyProposal(
          { path: "context.selectedGap.urgency", label: "u", kind: "scalar",
            before: "Low", after: "High" },
          { context: { selectedGap: { id: v3GapId } } }
        );
        assert(fireCount >= 1,
          "applyProposal must trigger subscribeActiveEngagement listeners (got fireCount=" + fireCount + ")");
      } finally { off(); aiUndoStack._resetForTests(); }
    });

    it("DS17 · undoLast triggers subscribeActiveEngagement listeners (post-Step-K v3-pure)", function() {
      aiUndoStack._resetForTests();
      var s = createDemoSession();
      s.customer = { name: "Bus Co", vertical: "Enterprise", region: "EMEA", drivers: [] };
      s.environments = [{ id: "coreDc", hidden: false }];
      s.instances = [];
      s.gaps = [{ id: "g-ds17", description: "bus", layerId: "compute",
                  affectedLayers: ["compute"], affectedEnvironments: ["coreDc"],
                  urgency: "Low", phase: "later", gapType: "replace",
                  relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [],
                  status: "open", reviewed: true }];
      _installSessionAsV3Engagement(s);
      var v3GapId = s.gaps[0].id;
      applyProposal(
        { path: "context.selectedGap.urgency", label: "u", kind: "scalar",
          before: "Low", after: "High" },
        { context: { selectedGap: { id: v3GapId } } }
      );
      var fireCount = 0;
      var off = subscribeActiveEngagement(function(_eng) { fireCount++; });
      try {
        aiUndoStack.undoLast();
        assert(fireCount >= 1,
          "undoLast must trigger subscribeActiveEngagement listeners (got fireCount=" + fireCount + ")");
      } finally { off(); aiUndoStack._resetForTests(); }
    });
  });
}
