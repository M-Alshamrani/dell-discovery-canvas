// services/canvasFile.js -- v3-pure save/load (rc.7 / 7e-7).
//
// Per SPEC §S40 (v3-pure architecture). Canvas .canvas files save +
// load through the v3 EngagementSchema directly. The v2->v3 migrator
// is RETIRED from runtime: per user direction 2026-05-06, v2 file
// migration burden is dropped from v3 GA gates. v2 .canvas files
// surface a friendly "this file is from a previous version" error
// at load; users start fresh.
//
// Two boundaries (SPEC sec S2.2.2):
//   1. Save: validate engagement against EngagementSchema, strip
//      transient fields + secondary indexes, attach save header.
//   2. Load: parse envelope header, validate v3.0 result against
//      EngagementSchema (no migrator; older versions reject), run
//      §S10 integrity sweep, hydrate secondary indexes.
//
// app.js currently routes file I/O through services/sessionFile.js (v2
// envelope with skills + provider config + API keys); migrating app.js
// to canvasFile.js is 7e-8 scope, alongside sessionFile.js retirement.

import { APP_VERSION } from "../core/version.js";
import { EngagementSchema, CURRENT_SCHEMA_VERSION } from "../schema/engagement.js";
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
// loadCanvas -- v3-pure load boundary (rc.7 / 7e-7)
// ---------------------------------------------------------------------
//
// Parses the envelope, accepts ONLY current schema version, validates
// against EngagementSchema, runs the §S10 integrity sweep, hydrates
// secondary indexes (instances.byState rebuilt from byId.state), and
// re-attaches transient fields (activeEntity, integrityLog).
//
// The runtime v2->v3 migrator is RETIRED. Older-version envelopes
// surface FILE_FROM_PREVIOUS_VERSION; users start fresh per the
// v3-pure direction.
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

  // Schema version dispatch (v3-pure post-7e-7). Only the current
  // CURRENT_SCHEMA_VERSION is accepted at load time. Older versions
  // (v2.x .canvas files) surface a friendly error per the v3-pure
  // direction "i could not care less for any data from before"
  // (user 2026-05-06). The runtime migrator is retired.
  const schemaVersion = envelope.schemaVersion ?? envelope.engagement?.meta?.schemaVersion ?? "2.0";
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    if (schemaVersion < CURRENT_SCHEMA_VERSION) {
      return {
        ok:    false,
        error: {
          code:           "FILE_FROM_PREVIOUS_VERSION",
          message:        `This .canvas file is from a previous version of Canvas (schema ${schemaVersion}). v3-pure builds (post-rc.7) only load schema ${CURRENT_SCHEMA_VERSION}.`,
          schemaVersion,
          buildSchema:    CURRENT_SCHEMA_VERSION
        },
        recoveryHint: "Start a fresh session. v2.x file migration is no longer supported."
      };
    }
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
  const v3Engagement = envelope.engagement;

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
