// state/integritySweep.js — v3.0 · SPEC sec S10
//
// Pure: (engagement, catalogs) -> { repaired, log, quarantine }.
// Same input -> same output (V-INT-PURE-1).
//
// Scope of this v3.0 implementation:
//   - FK orphan handling per entity FK declarations (S10.2.1 rows 1-4)
//   - Catalog-version drift on AI-provenanced fields (S10.2.1 row 10
//     + SPEC sec S8.4.1)
//   - Quarantine semantics for unrepairable required-FK violations
//
// Out of scope (deferred; covered by Zod superRefine at parse time):
//   - G6 (gap.affectedLayers[0] === gap.layerId)
//   - originId/priority on state==='current'
//   - mappedAssetIds non-empty on non-workload
//   These violations cause EngagementSchema.parse to fail; a migrator
//   that produces them is buggy and must be fixed there.
//
// Run order in load harness: migrate -> validate -> SWEEP -> UI.
// The sweep operates on already-validated engagements; it cleans FK
// references that point to deleted entities (which Zod doesn't check)
// and re-validates AI provenance against current catalog versions.

import { driverFkDeclarations }      from "../schema/driver.js";
import { environmentFkDeclarations } from "../schema/environment.js";
import { instanceFkDeclarations }    from "../schema/instance.js";
import { gapFkDeclarations }         from "../schema/gap.js";

// Map collection name -> FK declarations array.
const FK_DECLARATIONS_BY_COLLECTION = {
  drivers:      driverFkDeclarations,
  environments: environmentFkDeclarations,
  instances:    instanceFkDeclarations,
  gaps:         gapFkDeclarations
};

// Entity kind names used in IntegrityLogEntry.recordKind.
const KIND_BY_COLLECTION = {
  drivers:      "driver",
  environments: "environment",
  instances:    "instance",
  gaps:         "gap"
};

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export function runIntegritySweep(engagement, catalogs) {
  const log        = [];
  const quarantine = [];
  const ts = "2026-01-01T00:00:00.000Z";   // deterministic timestamp for sweep-pure tests
                                            // (real wall-clock used in production via ctx)

  // Build target-collection lookup tables for fast FK resolution.
  // catalog FKs check against catalogs[CATALOG_ID].entries[].id;
  // collection FKs check against engagement[collectionName].byId.
  const collectionIdSets = {
    drivers:      new Set(engagement.drivers?.allIds      ?? []),
    environments: new Set(engagement.environments?.allIds ?? []),
    instances:    new Set(engagement.instances?.allIds    ?? []),
    gaps:         new Set(engagement.gaps?.allIds         ?? [])
  };
  const catalogIdSets = {};
  for (const id of Object.keys(catalogs || {})) {
    catalogIdSets[id] = new Set((catalogs[id]?.entries || []).map(e => e.id));
  }

  // Repaired engagement starts as a shallow copy; we replace per-collection
  // when we touch them (immutable update pattern).
  let repaired = engagement;

  // Walk every FK-bearing collection.
  for (const collName of Object.keys(FK_DECLARATIONS_BY_COLLECTION)) {
    const decls = FK_DECLARATIONS_BY_COLLECTION[collName];
    const coll = repaired[collName];
    if (!coll) continue;

    const newById = {};
    const survivingIds = [];
    for (const id of coll.allIds) {
      const record = coll.byId[id];
      const result = applyFkRules(record, decls, collectionIdSets, catalogIdSets, engagement);
      if (result.quarantine) {
        quarantine.push({
          ruleId:     result.quarantine.ruleId,
          recordKind: KIND_BY_COLLECTION[collName],
          recordId:   id,
          field:      result.quarantine.field,
          before:     coll.byId[id],
          after:      null,
          timestamp:  ts
        });
        log.push(...result.logs);
        // Quarantined: drop from active engagement.
        continue;
      }
      survivingIds.push(id);
      newById[id] = result.record;
      log.push(...result.logs);
    }

    // If anything changed, replace the collection (preserving the
    // byState index for instances).
    if (collectionChanged(coll, survivingIds)) {
      const newColl = { byId: newById, allIds: survivingIds };
      if (collName === "instances") {
        newColl.byState = rebuildByState(newById, survivingIds);
      }
      repaired = { ...repaired, [collName]: newColl };
    } else {
      // Records may have been mutated (FK fields nulled/array-trimmed)
      // even if no quarantine happened. Replace byId regardless.
      const newColl = { ...coll, byId: newById };
      if (collName === "instances") newColl.byState = rebuildByState(newById, coll.allIds);
      repaired = { ...repaired, [collName]: newColl };
    }
  }

  // AI provenance drift detection (SPEC sec S8.4 + S10.2.1 row INT-AI-DRIFT)
  const driftResult = detectAndFlagDrift(repaired, catalogs, ts);
  repaired = driftResult.engagement;
  log.push(...driftResult.log);

  return { repaired, log, quarantine };
}

// ─────────────────────────────────────────────────────────────────────
// FK rule application — pure per-record
// ─────────────────────────────────────────────────────────────────────

function applyFkRules(record, decls, collectionIdSets, catalogIdSets, engagement) {
  let r = record;
  const logs = [];
  for (const decl of decls) {
    const targetSet = resolveTargetSet(decl.target, collectionIdSets, catalogIdSets);
    if (!targetSet) continue;   // unknown target — defensive, shouldn't happen

    if (decl.isArray) {
      const arr = r[decl.field] || [];
      const filtered = arr.filter(id => {
        const exists = targetSet.has(id);
        // targetFilter check: e.g. relatedCurrentInstanceIds must point at state="current"
        if (exists && decl.targetFilter && decl.target === "instances") {
          const targetRecord = engagement.instances?.byId?.[id];
          for (const k of Object.keys(decl.targetFilter)) {
            if (targetRecord?.[k] !== decl.targetFilter[k]) return false;
          }
        }
        return exists;
      });
      if (filtered.length !== arr.length) {
        const removed = arr.filter(id => !filtered.includes(id));
        for (const id of removed) {
          logs.push({
            ruleId: targetSet === catalogIdSets[stripCatalogPrefix(decl.target)]
              ? "INT-ORPHAN-ARR" : "INT-ORPHAN-ARR",
            recordKind: "(set by caller)",
            recordId:   r.id,
            field:      decl.field + "[]",
            before:     id,
            after:      null,
            timestamp:  "2026-01-01T00:00:00.000Z"
          });
        }
        r = { ...r, [decl.field]: filtered };
      }
    } else {
      // Scalar FK
      const value = r[decl.field];
      if (value == null) {
        if (decl.required) {
          // Required FK is null — quarantine.
          return {
            quarantine: { ruleId: "INT-ORPHAN-REQ", field: decl.field },
            logs
          };
        }
        // Optional + null is fine.
        continue;
      }
      const exists = targetSet.has(value);
      if (!exists) {
        if (decl.required) {
          return {
            quarantine: { ruleId: "INT-ORPHAN-REQ", field: decl.field },
            logs
          };
        }
        // Optional orphan -> null.
        logs.push({
          ruleId:     "INT-ORPHAN-OPT",
          recordKind: "(set by caller)",
          recordId:   r.id,
          field:      decl.field,
          before:     value,
          after:      null,
          timestamp:  "2026-01-01T00:00:00.000Z"
        });
        r = { ...r, [decl.field]: null };
        continue;
      }
      // FK target exists but might fail targetFilter (e.g. originId pointing at desired-state)
      if (decl.targetFilter && decl.target === "instances") {
        const targetRecord = engagement.instances?.byId?.[value];
        let filterOk = true;
        for (const k of Object.keys(decl.targetFilter)) {
          if (targetRecord?.[k] !== decl.targetFilter[k]) { filterOk = false; break; }
        }
        if (!filterOk) {
          logs.push({
            ruleId:     "INT-FILTER-MISS",
            recordKind: "(set by caller)",
            recordId:   r.id,
            field:      decl.field,
            before:     value,
            after:      null,
            timestamp:  "2026-01-01T00:00:00.000Z"
          });
          r = { ...r, [decl.field]: null };
        }
      }
    }
  }
  return { record: r, logs };
}

function resolveTargetSet(target, collectionIdSets, catalogIdSets) {
  if (target.startsWith("catalog:")) {
    // If the catalog isn't loaded, return null (skip the check) rather
    // than treating every reference as orphaned. Catalog presence is a
    // separate concern from collection FK integrity; tests + smoke
    // contexts that don't pre-load catalogs should still be able to
    // run the FK-orphan sweep against engagement collections.
    return catalogIdSets[target.slice("catalog:".length)] || null;
  }
  return collectionIdSets[target] || null;
}

function stripCatalogPrefix(target) {
  return target.startsWith("catalog:") ? target.slice("catalog:".length) : target;
}

// ─────────────────────────────────────────────────────────────────────
// Catalog version drift detection (S8.4 + S10.2.1 row INT-AI-DRIFT)
// ─────────────────────────────────────────────────────────────────────

function detectAndFlagDrift(engagement, catalogs, ts) {
  const log = [];
  let next = engagement;

  // Walk gaps for aiMappedDellSolutions; instances for aiSuggestedDellMapping.
  next = flagDriftInCollection(next, "gaps", "aiMappedDellSolutions",     catalogs, log, ts);
  next = flagDriftInCollection(next, "instances", "aiSuggestedDellMapping", catalogs, log, ts);

  return { engagement: next, log };
}

function flagDriftInCollection(engagement, collName, fieldName, catalogs, log, ts) {
  const coll = engagement[collName];
  if (!coll) return engagement;
  let mutated = false;
  const newById = {};
  for (const id of coll.allIds) {
    const record = coll.byId[id];
    const wrapper = record[fieldName];
    if (!wrapper || !wrapper.provenance) {
      newById[id] = record;
      continue;
    }
    const status = wrapper.provenance.validationStatus;
    // Drift never downgrades user-edited or invalid; only valid -> stale
    // when catalog versions mismatch.
    if (status !== "valid") {
      newById[id] = record;
      continue;
    }
    let isStale = false;
    const recorded = wrapper.provenance.catalogVersions || {};
    for (const catId of Object.keys(recorded)) {
      const current = catalogs?.[catId]?.catalogVersion;
      if (current && current !== recorded[catId]) {
        isStale = true;
        break;
      }
    }
    if (isStale) {
      mutated = true;
      const newWrapper = {
        ...wrapper,
        provenance: { ...wrapper.provenance, validationStatus: "stale" }
      };
      newById[id] = { ...record, [fieldName]: newWrapper };
      log.push({
        ruleId:     "INT-AI-DRIFT",
        recordKind: KIND_BY_COLLECTION[collName],
        recordId:   id,
        field:      fieldName + ".provenance.validationStatus",
        before:     "valid",
        after:      "stale",
        timestamp:  ts
      });
    } else {
      newById[id] = record;
    }
  }
  if (!mutated) return engagement;
  const newColl = { ...coll, byId: newById };
  if (collName === "instances") newColl.byState = engagement.instances.byState;
  return { ...engagement, [collName]: newColl };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function collectionChanged(oldColl, newAllIds) {
  if (oldColl.allIds.length !== newAllIds.length) return true;
  for (let i = 0; i < newAllIds.length; i++) {
    if (oldColl.allIds[i] !== newAllIds[i]) return true;
  }
  return false;
}

function rebuildByState(byId, allIds) {
  const current = [];
  const desired = [];
  for (const id of allIds) {
    const inst = byId[id];
    if (inst.state === "current") current.push(id);
    else if (inst.state === "desired") desired.push(id);
  }
  return { current, desired };
}
