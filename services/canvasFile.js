// services/canvasFile.js — v3.0 · SPEC sec S4.2.4
//
// Save/load envelope for the v3.0 engagement shape. Coexists with v2.x
// services/sessionFile.js until the cutover lands; v3.0 callers route
// through this module.
//
// Two boundaries (SPEC sec S2.2.2):
//   1. Save: validate engagement against EngagementSchema, strip
//      transient fields + secondary indexes, attach save header.
//   2. Load: parse envelope header, run migrator if needed (TBD —
//      stub today), validate v3.0 result, run integrity sweep
//      (TBD — stub today), hydrate secondary indexes.
//
// Stubs for migrator + integrity sweep are explicit "not yet" markers
// so a later commit can drop in the real implementation without
// changing this module's interface.

import { APP_VERSION } from "../core/version.js";
import { EngagementSchema, CURRENT_SCHEMA_VERSION } from "../schema/engagement.js";
import { migrateToVersion, MigrationError, MigrationStepError } from "../migrations/index.js";
import { makePipelineContext } from "../migrations/helpers/pipelineContext.js";
import { loadAllCatalogs } from "./catalogLoader.js";
import { runIntegritySweep } from "../state/integritySweep.js";

export const FILE_FORMAT_VERSION = "v3-1";   // bump from v2.x's "v2-x" formats
export const FILE_MIME = "application/x-dell-discovery-canvas";

// ---------------------------------------------------------------------
// buildSaveEnvelope — v3.0 save boundary
// ---------------------------------------------------------------------
//
// Produces the on-disk shape: a wrapper carrying file format + app +
// schema versions + savedAt timestamp + the persisted engagement.
//
// Strips per SPEC sec S4.2.1:
//   - Transient fields (activeEntity, integrityLog) from the engagement
//   - Secondary indexes (instances.byState) from collections; rebuilt on load
//
// Validates per SPEC sec S2.2.2 boundary 2:
//   - The PRE-strip engagement must parse cleanly through EngagementSchema.
//     A failure is a blocking error; the caller can show the structured
//     issues to the user. The save does NOT happen on failure.

export function buildSaveEnvelope(engagement) {
  // Boundary validation: the engagement we save must be valid.
  const validation = EngagementSchema.safeParse(engagement);
  if (!validation.success) {
    return {
      ok:     false,
      errors: validation.error.issues.map(i => ({
        path:    i.path.join("."),
        message: i.message,
        code:    i.code
      }))
    };
  }

  // Strip transient + secondary indexes for the persisted shape.
  const persisted = stripForPersist(validation.data);

  return {
    ok: true,
    envelope: {
      fileFormatVersion: FILE_FORMAT_VERSION,
      appVersion:        APP_VERSION,
      schemaVersion:     CURRENT_SCHEMA_VERSION,
      savedAt:           new Date().toISOString(),
      engagement:        persisted
    }
  };
}

function stripForPersist(eng) {
  // Drop transient fields entirely.
  // eslint-disable-next-line no-unused-vars
  const { activeEntity, integrityLog, ...persisted } = eng;
  // Drop secondary indexes: instances.byState rebuilds on load from byId+state.
  const persistedInstances = {
    byId:   persisted.instances.byId,
    allIds: persisted.instances.allIds
    // byState intentionally omitted
  };
  return { ...persisted, instances: persistedInstances };
}

// ---------------------------------------------------------------------
// loadCanvas — v3.0 load boundary
// ---------------------------------------------------------------------
//
// Parses the envelope, dispatches via the migrator when the file's
// schemaVersion is older than CURRENT_SCHEMA_VERSION (per
// migrations/index.js migrateToVersion), validates the v3.0 result
// against EngagementSchema strict, runs the §S10 integrity sweep,
// hydrates secondary indexes (instances.byState rebuilt from byId.state),
// and re-attaches transient fields (activeEntity, integrityLog).
//
// Returns { ok: true, engagement } | { ok: false, error, recoveryHint }.

export async function loadCanvas(envelope) {
  if (!envelope || typeof envelope !== "object") {
    return {
      ok:    false,
      error: { code: "INVALID_ENVELOPE", message: "Envelope is missing or not an object" },
      recoveryHint: "The .canvas file appears corrupted. Try downloading a fresh copy."
    };
  }

  // Schema version dispatch. v3.0 path is direct; older versions route
  // through the migrator (now wired per MIGRATION sec M1.2).
  const schemaVersion = envelope.schemaVersion ?? envelope.engagement?.meta?.schemaVersion ?? "2.0";
  let v3Engagement;
  if (schemaVersion === CURRENT_SCHEMA_VERSION) {
    v3Engagement = envelope.engagement;
  } else if (schemaVersion < CURRENT_SCHEMA_VERSION) {
    // Migrator path. Bundle a frozen catalog snapshot for the pipeline
    // context per MIGRATION sec M13.
    try {
      const catalogSnapshot = await loadAllCatalogs();
      const ctx = makePipelineContext({ catalogSnapshot });
      const migrated = migrateToVersion(envelope.engagement, CURRENT_SCHEMA_VERSION, ctx);
      v3Engagement = migrated;
    } catch (e) {
      return {
        ok: false,
        error: {
          code:             (e instanceof MigrationStepError) ? "MIGRATION_STEP_FAILED" : "MIGRATION_FAILED",
          message:          e.message,
          step:             e.step,
          migratorVersion:  "v2-0_to_v3-0",
          schemaVersion,
          originalEnvelope: envelope
        },
        recoveryHint: "Migration failed. You can download the original .canvas file or try again."
      };
    }
  } else {
    return {
      ok:    false,
      error: {
        code:    "FILE_NEWER_THAN_BUILD",
        message: `Envelope schema version ${schemaVersion} is newer than build's ${CURRENT_SCHEMA_VERSION}.`,
        schemaVersion
      },
      recoveryHint: "Open this file in a newer Canvas build."
    };
  }

  // Hydrate secondary indexes (the persisted shape doesn't carry them).
  const hydrated = hydrate(v3Engagement);

  // Boundary validation per SPEC sec S2.2.2 boundary 1.
  const validation = EngagementSchema.safeParse(hydrated);
  if (!validation.success) {
    return {
      ok:    false,
      error: {
        code:    "VALIDATION_FAILED",
        message: "Loaded engagement failed schema validation.",
        issues:  validation.error.issues
      },
      recoveryHint: "The .canvas file is malformed. Try opening a known-good backup."
    };
  }

  // Integrity sweep per SPEC sec S10. Wired here: validated engagement
  // -> sweep handles FK orphans (Zod doesn't check existence in the
  // target collection) + AI catalog-version drift detection.
  let sweptEngagement = validation.data;
  let sweepLog = [];
  let sweepQuarantine = [];
  try {
    const catalogs = await loadAllCatalogs();
    const sweep = runIntegritySweep(validation.data, catalogs);
    sweptEngagement = sweep.repaired;
    sweepLog = sweep.log;
    sweepQuarantine = sweep.quarantine;
  } catch (e) {
    // Sweep failure is non-fatal: surface but proceed with un-swept engagement.
    sweepLog = [{ ruleId: "INT-SWEEP-ERROR", message: e.message }];
  }

  return {
    ok:           true,
    engagement:   sweptEngagement,
    integrityLog: sweepLog,
    quarantine:   sweepQuarantine
  };
}

function hydrate(persisted) {
  // Rebuild instances.byState from byId.state.
  const byId    = persisted.instances?.byId   ?? {};
  const allIds  = persisted.instances?.allIds ?? [];
  const current = [];
  const desired = [];
  for (const id of allIds) {
    const inst = byId[id];
    if (inst?.state === "current") current.push(id);
    else if (inst?.state === "desired") desired.push(id);
  }
  return {
    ...persisted,
    instances: {
      byId,
      allIds,
      byState: { current, desired }
    },
    // Re-attach transient fields with empty defaults.
    activeEntity: null,
    integrityLog: []
  };
}
