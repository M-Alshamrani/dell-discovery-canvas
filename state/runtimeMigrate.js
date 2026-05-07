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

  return migrateToVersion(v2Session, "3.0", ctx);
}
