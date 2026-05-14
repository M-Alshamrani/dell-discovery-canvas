// schema/engagement.js — v3.0 · SPEC sec S3.1 + sec 4.1
//
// EngagementMeta + the top-level Engagement (composition over the
// per-entity collections). The user-facing term remains "session" in
// the UI; the data term is "engagement" everywhere in code per
// directive sec 3.1.
//
// Engagement composition is `{meta, customer, drivers, environments,
// instances, gaps}` plus the transient `activeEntity` + `integrityLog`
// (stripped on save per SPEC sec S4.2.1).
//
// Collections are `{byId, allIds}` plus secondary indexes (instances
// has `.byState`). See SPEC sec S4.1.

import { z } from "zod";
import { CustomerSchema }    from "./customer.js";
import { DriverSchema }      from "./driver.js";
import { EnvironmentSchema } from "./environment.js";
import { InstanceSchema }    from "./instance.js";
import { GapSchema }         from "./gap.js";
import { sessionPath } from "./helpers/pathManifest.js";

export const CURRENT_SCHEMA_VERSION = "3.0";

// EngagementMeta — single record at engagement.meta.
export const EngagementMetaSchema = z.object({
  engagementId:    z.string().uuid(),
  schemaVersion:   z.literal("3.0"),
  isDemo:          z.boolean().default(false),
  ownerId:         z.string().min(1).default("local-user"),
  presalesOwner:   z.string().default(""),
  engagementDate:  z.string().date().nullable().default(null),
  status:          z.enum(["Draft", "In review", "Locked"]).default("Draft"),
  createdAt:       z.string().datetime(),
  updatedAt:       z.string().datetime()
}).strict();

export function createEmptyEngagementMeta(overrides = {}) {
  return EngagementMetaSchema.parse({
    engagementId:   overrides.engagementId   ?? "00000000-0000-4000-8000-000000000000",
    schemaVersion:  "3.0",
    isDemo:         overrides.isDemo         ?? false,
    ownerId:        overrides.ownerId        ?? "local-user",
    presalesOwner:  overrides.presalesOwner  ?? "",
    engagementDate: overrides.engagementDate ?? null,
    status:         overrides.status         ?? "Draft",
    createdAt:      overrides.createdAt      ?? "2026-01-01T00:00:00.000Z",
    updatedAt:      overrides.updatedAt      ?? "2026-01-01T00:00:00.000Z"
  });
}

// Transient ActiveEntity — stripped on save per S3.1.2.
export const KIND_ENUM = z.enum([
  "driver", "currentInstance", "desiredInstance", "gap", "environment", "project"
]);

export const ActiveEntitySchema = z.object({
  kind: KIND_ENUM,
  id:   z.string().uuid(),
  at:   z.string().datetime()
}).nullable();

// IntegrityLog entry shape (per SPEC sec S10.2.3).
export const IntegrityLogEntrySchema = z.object({
  ruleId:     z.string(),
  recordKind: z.enum(["driver","environment","instance","gap","customer","engagementMeta"]),
  recordId:   z.string(),
  field:      z.string(),
  before:     z.unknown(),
  after:      z.unknown(),
  timestamp:  z.string().datetime()
});

// Collection<T> wrapper. byId keys must equal allIds set (V-FK-51..56).
function collectionSchemaOf(entrySchema) {
  return z.object({
    byId:   z.record(z.string().uuid(), entrySchema),
    allIds: z.array(z.string().uuid())
  }).superRefine((col, ctx) => {
    const byIdKeys = Object.keys(col.byId).sort();
    const allIdsSorted = [...col.allIds].sort();
    if (byIdKeys.length !== allIdsSorted.length ||
        byIdKeys.some((k, i) => k !== allIdsSorted[i])) {
      ctx.addIssue({ code: "custom", path: ["byId"],
        message: "Collection.byId keys must equal Collection.allIds set" });
    }
  });
}

// Instances has the byState secondary index in addition to byId/allIds.
const InstancesCollectionSchema = z.object({
  byId:   z.record(z.string().uuid(), InstanceSchema),
  allIds: z.array(z.string().uuid()),
  byState: z.object({
    current: z.array(z.string().uuid()),
    desired: z.array(z.string().uuid())
  })
}).superRefine((col, ctx) => {
  const byIdKeys = Object.keys(col.byId).sort();
  const allIdsSorted = [...col.allIds].sort();
  if (byIdKeys.length !== allIdsSorted.length ||
      byIdKeys.some((k, i) => k !== allIdsSorted[i])) {
    ctx.addIssue({ code: "custom", path: ["byId"],
      message: "instances.byId keys must equal instances.allIds set" });
  }
  // byState partition exhaustive: every id in allIds is in current OR desired
  const currentSet = new Set(col.byState.current);
  const desiredSet = new Set(col.byState.desired);
  for (const id of col.allIds) {
    if (!currentSet.has(id) && !desiredSet.has(id)) {
      ctx.addIssue({ code: "custom", path: ["byState"],
        message: `instance ${id} is not in byState.current or byState.desired` });
    }
  }
});

export const EngagementSchema = z.object({
  meta:         EngagementMetaSchema,
  customer:     CustomerSchema,
  drivers:      collectionSchemaOf(DriverSchema),
  environments: collectionSchemaOf(EnvironmentSchema),
  instances:    InstancesCollectionSchema,
  gaps:         collectionSchemaOf(GapSchema),
  // Transient (stripped on save):
  activeEntity: ActiveEntitySchema.default(null),
  integrityLog: z.array(IntegrityLogEntrySchema).default([])
}).strict();

export function createEmptyEngagement(overrides = {}) {
  const meta = createEmptyEngagementMeta(overrides.meta);
  return EngagementSchema.parse({
    meta,
    // BUG-063 fix (rc.9 · 2026-05-14): customer defaults flipped from
    // ("New customer" / "Financial Services" / "EMEA") to "" so the
    // empty state is honest. See schema/customer.js + docs/BUG_LOG.md
    // BUG-063 for full rationale + eval evidence.
    customer:     overrides.customer ?? {
      engagementId: meta.engagementId,
      name:         "",
      vertical:     "",
      region:       "",
      notes:        ""
    },
    drivers:      overrides.drivers      ?? { byId: {}, allIds: [] },
    environments: overrides.environments ?? { byId: {}, allIds: [] },
    instances:    overrides.instances    ?? { byId: {}, allIds: [], byState: { current: [], desired: [] } },
    gaps:         overrides.gaps         ?? { byId: {}, allIds: [] },
    activeEntity: overrides.activeEntity ?? null,
    integrityLog: overrides.integrityLog ?? []
  });
}

// Engagement-level path manifest (session-scope chips).
export const engagementPathManifest = [
  sessionPath("engagementMeta.engagementDate", "date",   "Engagement date"),
  sessionPath("engagementMeta.presalesOwner",  "string", "Presales owner"),
  sessionPath("engagementMeta.status",         "enum",   "Engagement status")
];
