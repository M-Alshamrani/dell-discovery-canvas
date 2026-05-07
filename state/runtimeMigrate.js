// state/runtimeMigrate.js
//
// rc.7 / 7e-8d-1 · runtime v2-session → v3-engagement adapter.
//
// Thin wrapper around `migrations/v2-0_to_v3-0/index.js migrate_v2_0_to_v3_0`
// + `migrations/helpers/pipelineContext.js makePipelineContext`. Lets app.js's
// file-open path translate the v2-shape session returned by
// `services/sessionFile.js applyEnvelope()` into a v3 engagement that
// state/engagementStore.js can accept directly via setActiveEngagement,
// dropping the bridge-mediated indirection on the file-open path.
//
// Why this exists:
//   Pre-7e-8d, app.js's file-open flow did:
//     replaceSession(res.session)           // v2 path
//     -> session-changed emit
//     -> sessionBridge.bridgeOnce()
//     -> v2CustomerPatch (CUSTOMER-ONLY shallow merge into v3)
//
//   The bridge's customer-only patch DROPPED instances/gaps/envs/drivers
//   from the loaded .canvas file -- the v3 engagement only got the
//   customer name. v3-native views (which all reads now go through)
//   then showed an empty canvas even though the user just opened a
//   populated file. Latent data-loss bug masked by the v2 sessionStore
//   still mirroring the data internally for the (now-retired) v2 view
//   tabs.
//
//   This runtime wrapper closes the gap by piping the WHOLE v2 session
//   through the existing 10-step v2.0 -> v3.0 migrator (the same one
//   that runs at .canvas file load via the file-load contract). The
//   resulting v3 engagement is set into engagementStore directly, so
//   the bridge is no longer needed on the file-open path.
//
// Why not just call migrateToVersion directly from app.js:
//   The migrator needs a `pipelineContext` with a catalog snapshot. This
//   wrapper bakes the catalog snapshot from the live core/config.js +
//   catalogs/snapshots/* sources so callers don't need to assemble it
//   each time. Single source of truth for "what catalog version is
//   current" stays in catalogs/snapshots/.
//
// Authority: SPEC §S40 (v3-pure architecture; v2 file-load path uses
// the v3 EngagementSchema directly) · MIGRATION sec M1.4 (10-step v2→v3
// pipeline) · `project_v3_no_file_migration_burden.md` (the file
// migrator is the single source of truth; the runtime path delegates
// to it rather than reimplementing).

import { migrateToVersion } from "../migrations/index.js";
import { makePipelineContext } from "../migrations/helpers/pipelineContext.js";
import BUSINESS_DRIVERS_SNAPSHOT from "../catalogs/snapshots/business_drivers.js";
import ENV_CATALOG_SNAPSHOT      from "../catalogs/snapshots/env_catalog.js";
// rc.7 / 7e-8 redo Step B · migrateLegacySession lives here as the
// canonical-form-finalizer that runs BEFORE the v3 pipeline. Pre-Step
// B it lived in state/sessionStore.js; moving it to state/runtimeMigrate.js
// (the v2->v3 module) is the right architectural home for pure migration
// logic. sessionStore.js's live `session` IIFE re-imports it from here.
import { LEGACY_DRIVER_LABEL_TO_ID } from "../core/config.js";
import { normalizeServices } from "../core/services.js";

// rc.7 / 7e-8 redo Step B · setPrimaryLayer + deriveProjectId
// inlined here (was: import from interactions/gapsCommands.js).
// Both are tiny pure functions; runtimeMigrate is the only production
// caller after sessionStore drops its in-file migrateLegacySession;
// interactions/gapsCommands.js is being deleted in Step J. Inlining
// here makes runtimeMigrate self-contained and removes the v2
// interaction-module import from the production graph.
function setPrimaryLayer(gap, layerId) {
  if (!gap || typeof layerId !== "string" || layerId.length === 0) return;
  gap.layerId = layerId;
  var existing = Array.isArray(gap.affectedLayers) ? gap.affectedLayers : [];
  var rest = existing.filter(function(l) { return l !== layerId; });
  gap.affectedLayers = [layerId].concat(rest);
}

function deriveProjectId(gap) {
  if (!gap) return "unknown::unknown::unknown";
  var env = (Array.isArray(gap.affectedEnvironments) && gap.affectedEnvironments[0])
    || "crossCutting";
  var layer = gap.layerId || "unknown";
  var type = gap.gapType || "null";
  return env + "::" + layer + "::" + type;
}

// migrateLegacySession(raw) -> v2-canonical session
//
// Pure function (raw is mutated in place AND returned). Applies every
// pre-v3 migration we've shipped: drivers extraction from primaryDriver,
// environments dynamic-model + alias drain, Phase 17 rationalize
// coercion, v2.4.9 primary-layer invariant + projectId backfill,
// v2.4.11 urgencyOverride default, v2.4.12 services normalization.
//
// The v3 pipeline (migrations/v2-0_to_v3-0/index.js) ASSUMES a clean
// canonical v2 shape; running this function first is the contract.
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

  // v2.4.15 dynamic environment model + alias drain.
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

  // v2.4.8 Phase 17: coerce retired "rationalize" disposition/gapType.
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

  // v2.4.9 / .11 / .12 backfills.
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

// translateV2SessionToV3Engagement(v2Session) -> v3Engagement
//
// Pure: same input → same output (modulo the migrationTimestamp which
// reflects wall-clock at call time). Throws MigrationStepError on
// malformed input -- caller (app.js handleOpenedFile) catches +
// surfaces the error to the user via notifyError.
//
// The randomSeed is derived from the v2 session's sessionId when
// present, else falls back to a stable per-runtime seed. This is best-
// effort determinism: the same .canvas file re-opened in the same
// browser session yields the same generated v3 UUIDs (which matters
// for tests + for "open the same file twice" not regenerating ids).
export function translateV2SessionToV3Engagement(v2Session) {
  if (!v2Session || typeof v2Session !== "object") {
    throw new Error("translateV2SessionToV3Engagement: requires a v2 session object");
  }

  const seed = (v2Session.sessionMeta && v2Session.sessionMeta.sessionId)
    ? "v2-to-v3:" + v2Session.sessionMeta.sessionId
    : "v2-to-v3:runtime";

  const ctx = makePipelineContext({
    migrationTimestamp: new Date().toISOString(),
    randomSeed:         seed,
    catalogSnapshot: {
      BUSINESS_DRIVERS: { catalogVersion: BUSINESS_DRIVERS_SNAPSHOT.catalogVersion },
      ENV_CATALOG:      { catalogVersion: ENV_CATALOG_SNAPSHOT.catalogVersion }
    }
  });

  // rc.7 / 7e-8 redo Step B · canonicalize v2 first (Phase 17
   // rationalize coercion, primary-layer backfill, etc.) THEN run
   // through the v3 pipeline. The v3 pipeline assumes a clean v2.0
   // shape; without this canonicalization a pre-v2.4.8 envelope
   // carrying gapType:"rationalize" would land on a v3 gap with
   // gapType:"rationalize" (invalid in v3 GAP_TYPES enum).
  var canonical = migrateLegacySession(v2Session);
  return migrateToVersion(canonical, "3.0", ctx);
}
