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
// Parses the envelope, runs migrator if schema version is older
// (currently a stub — v2.0 migrator integration ships in a later
// commit), validates the v3.0 result against EngagementSchema,
// hydrates secondary indexes, attaches transient fields back.
//
// Returns { ok: true, engagement } | { ok: false, error, recoveryHint }.

export function loadCanvas(envelope) {
  if (!envelope || typeof envelope !== "object") {
    return {
      ok:    false,
      error: { code: "INVALID_ENVELOPE", message: "Envelope is missing or not an object" },
      recoveryHint: "The .canvas file appears corrupted. Try downloading a fresh copy."
    };
  }

  // Schema version dispatch. v3.0 path is direct; older versions route
  // through the migrator (not yet wired).
  const schemaVersion = envelope.schemaVersion ?? envelope.engagement?.meta?.schemaVersion ?? "2.0";
  let v3Engagement;
  if (schemaVersion === CURRENT_SCHEMA_VERSION) {
    v3Engagement = envelope.engagement;
  } else if (schemaVersion < CURRENT_SCHEMA_VERSION) {
    // Migrator stub — replace when migrations/v2-0_to_v3-0/ lands.
    return {
      ok:    false,
      error: {
        code:    "MIGRATOR_NOT_WIRED",
        message: `Loaded v${schemaVersion} envelope but the v${schemaVersion} -> v${CURRENT_SCHEMA_VERSION} migrator is not yet wired in this build.`,
        schemaVersion
      },
      recoveryHint: "Re-save this engagement in a newer build, or wait for migrator integration."
    };
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

  // Integrity sweep — stub today. Real implementation (state/integritySweep.js)
  // ships per SPEC sec S10. Until then, we return the engagement as-is.
  return {
    ok:         true,
    engagement: validation.data
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
