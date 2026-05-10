// schema/instance.js — v3.0 · SPEC sec S3.5
//
// Instance entity. Single collection discriminated by `state` (current
// vs desired). Per directive sec 3.5, splitting into two collections
// would force joining for the matrix view, originId resolution, and
// workload mappedAssetIds resolution.
//
// Three superRefine invariants:
//   - originId only on state==='desired'
//   - priority only on state==='desired'
//   - mappedAssetIds non-empty only on layerId==='workload'
//
// AI-authored field aiSuggestedDellMapping is provenance-wrapped per
// SPEC sec S8.1.

import { z } from "zod";
import { crossCuttingFieldsSchema, defaultCrossCuttingFields } from "./helpers/crossCuttingFields.js";
import { provenanceWrapper } from "./helpers/provenanceWrapper.js";
import { ownPath, linkedPath } from "./helpers/pathManifest.js";

// Inline schema for the typed payload of aiSuggestedDellMapping. v3.0
// initial shape; refines as the dell-mapping skill matures.
const DellMappingSchema = z.object({
  rawLegacy: z.string().optional(),                    // populated by migrator from v2.x plain strings
  products:  z.array(z.string()).default([])           // FKs to DELL_PRODUCT_TAXONOMY entries
});

// rc.8.b / R7 (per SPEC §S46.10/§S46.11 + RULES §16 CH36.h) — aiTag
// provenance for AI-authored mutations. Stamped by applyMutations under
// EITHER mutation policy ('ask' approved or 'auto-tag' immediate); auto-
// cleared on the next engineer save (instanceActions.updateInstance
// strips it). Renders as a "Done by AI" badge in MatrixView tile.
// Scope: instances ONLY (drivers / environments / gaps / customer /
// engagementMeta are out of scope for v3.0 GA per user direction
// 2026-05-10).
const AiTagSchema = z.object({
  skillId:   z.string().min(1),
  runId:     z.string().min(1),
  mutatedAt: z.string().min(1)   // ISO instant
});

export const InstanceSchema = z.object({
  ...crossCuttingFieldsSchema,
  state:         z.enum(["current", "desired"]),
  layerId:       z.string().min(1),                       // FK to LAYERS
  environmentId: z.string().uuid(),                       // FK to environments
  label:         z.string().min(1),
  vendor:        z.string(),
  vendorGroup:   z.enum(["dell", "nonDell", "custom"]),
  criticality:   z.enum(["High", "Medium", "Low"]),
  notes:         z.string().default(""),
  disposition:   z.string().min(1),                       // FK to DISPOSITION_ACTIONS

  // State-conditional (validated by .superRefine):
  originId:      z.string().uuid().nullable().default(null),
  priority:      z.enum(["Now", "Next", "Later"]).nullable().default(null),

  // Layer-conditional:
  mappedAssetIds: z.array(z.string().uuid()).default([]),

  // AI-authored (SPEC sec S8.1):
  aiSuggestedDellMapping: provenanceWrapper(DellMappingSchema).nullable().default(null),

  // rc.8.b / R7 - AI-mutation provenance (SPEC §S46.10/§S46.11 / CH36.h).
  // Stamped by applyMutations; cleared on engineer save in instanceActions.
  aiTag:                 AiTagSchema.nullable().default(null)
}).strict().superRefine((inst, ctx) => {
  // R3.5.a — originId only on desired
  if (inst.state === "current" && inst.originId !== null) {
    ctx.addIssue({ code: "custom", path: ["originId"],
      message: "originId is permitted only on state==='desired' instances" });
  }
  // R3.5.a — priority only on desired
  if (inst.state === "current" && inst.priority !== null) {
    ctx.addIssue({ code: "custom", path: ["priority"],
      message: "priority is permitted only on state==='desired' instances" });
  }
  // R3.5.b — mappedAssetIds only on workload
  if (inst.layerId !== "workload" && inst.mappedAssetIds.length > 0) {
    ctx.addIssue({ code: "custom", path: ["mappedAssetIds"],
      message: "mappedAssetIds permitted only on layerId==='workload' instances" });
  }
  // No self-reference (V-INV-15b)
  if (inst.originId !== null && inst.originId === inst.id) {
    ctx.addIssue({ code: "custom", path: ["originId"],
      message: "originId must not point at the instance itself" });
  }
});

export function createEmptyInstance(overrides = {}) {
  const state = overrides.state ?? "current";
  const layerId = overrides.layerId ?? "compute";
  return InstanceSchema.parse({
    ...defaultCrossCuttingFields(overrides),
    state,
    layerId,
    environmentId: overrides.environmentId ?? "00000000-0000-4000-8000-000000000001",
    label:         overrides.label         ?? "New instance",
    vendor:        overrides.vendor        ?? "Dell",
    vendorGroup:   overrides.vendorGroup   ?? "dell",
    criticality:   overrides.criticality   ?? "Medium",
    notes:         overrides.notes         ?? "",
    disposition:   overrides.disposition   ?? "keep",
    originId:      overrides.originId      ?? null,
    priority:      overrides.priority      ?? null,
    mappedAssetIds: overrides.mappedAssetIds ?? [],
    aiSuggestedDellMapping: overrides.aiSuggestedDellMapping ?? null,
    aiTag:                  overrides.aiTag                  ?? null
  });
}

export const instanceFkDeclarations = [
  { field: "layerId",        target: "catalog:LAYERS",              required: true, isArray: false },
  { field: "environmentId",  target: "environments",                required: true, isArray: false },
  { field: "disposition",    target: "catalog:DISPOSITION_ACTIONS", required: true, isArray: false },
  { field: "originId",       target: "instances",                   required: false, isArray: false,
    targetFilter: { state: "current" } },
  { field: "mappedAssetIds", target: "instances",                   required: false, isArray: true }
];

export const instancePathManifest = [
  ownPath("context.instance.label",       "string", "Instance label"),
  ownPath("context.instance.vendor",      "string", "Vendor"),
  ownPath("context.instance.vendorGroup", "enum",   "Vendor group"),
  ownPath("context.instance.criticality", "enum",   "Criticality"),
  ownPath("context.instance.notes",       "string", "Instance notes"),
  ownPath("context.instance.disposition", "enum",   "Disposition"),
  ownPath("context.instance.priority",    "enum",   "Priority (desired only)"),
  linkedPath("context.instance.linkedGaps[*].description", "string",
    "Linked gap description",
    "engagement.gaps where gap.relatedCurrentInstanceIds OR relatedDesiredInstanceIds includes instance.id")
];
