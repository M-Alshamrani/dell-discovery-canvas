// schema/gap.js — v3.0 · SPEC sec S3.6
//
// Gap entity. Carries the G6 invariant (affectedLayers[0] === layerId)
// in superRefine. Cross-cutting array fields (affectedEnvironments,
// relatedCurrentInstanceIds, relatedDesiredInstanceIds) per SPEC sec 3.7.
//
// projectId is DERIVED, not stored — selectProjects (SPEC sec S5.2.3)
// computes project grouping at projection time. Migrator drops the
// v2.x stored gap.projectId per MIGRATION sec M10.
//
// AI-authored aiMappedDellSolutions provenance-wrapped per SPEC sec S8.1.

import { z } from "zod";
import { crossCuttingFieldsSchema, defaultCrossCuttingFields } from "./helpers/crossCuttingFields.js";
import { provenanceWrapper } from "./helpers/provenanceWrapper.js";
import { ownPath, linkedPath } from "./helpers/pathManifest.js";

// Typed payload for aiMappedDellSolutions.
const DellSolutionListSchema = z.object({
  rawLegacy: z.string().optional(),                    // populated by migrator from v2.x plain strings
  products:  z.array(z.string()).default([])           // FKs to DELL_PRODUCT_TAXONOMY
});

export const GapSchema = z.object({
  ...crossCuttingFieldsSchema,
  description:               z.string().min(1),
  gapType:                   z.string().min(1),                       // FK to GAP_TYPES
  urgency:                   z.enum(["High", "Medium", "Low"]),
  urgencyOverride:           z.boolean().default(false),
  phase:                     z.enum(["now", "next", "later"]),
  status:                    z.enum(["open", "in_progress", "closed", "deferred"]),
  reviewed:                  z.boolean().default(false),
  notes:                     z.string().default(""),
  driverId:                  z.string().uuid().nullable().default(null),
  layerId:                   z.string().min(1),                       // primary layer; FK to LAYERS
  affectedLayers:            z.array(z.string().min(1)).min(1),       // invariant G6
  affectedEnvironments:      z.array(z.string().uuid()).min(1),
  relatedCurrentInstanceIds: z.array(z.string().uuid()).default([]),
  relatedDesiredInstanceIds: z.array(z.string().uuid()).default([]),
  services:                  z.array(z.string()).default([]),         // FKs to SERVICE_TYPES

  // AI-authored (SPEC sec S8.1):
  aiMappedDellSolutions:     provenanceWrapper(DellSolutionListSchema).nullable().default(null)
}).strict().superRefine((gap, ctx) => {
  // R3.6.G6 — affectedLayers[0] must equal layerId
  if (gap.affectedLayers[0] !== gap.layerId) {
    ctx.addIssue({ code: "custom", path: ["affectedLayers", 0],
      message: "affectedLayers[0] must equal layerId (invariant G6)" });
  }
});

export function createEmptyGap(overrides = {}) {
  const layerId = overrides.layerId ?? "compute";
  return GapSchema.parse({
    ...defaultCrossCuttingFields(overrides),
    description:               overrides.description               ?? "New gap",
    gapType:                   overrides.gapType                   ?? "replace",
    urgency:                   overrides.urgency                   ?? "Medium",
    urgencyOverride:           overrides.urgencyOverride           ?? false,
    phase:                     overrides.phase                     ?? "now",
    status:                    overrides.status                    ?? "open",
    reviewed:                  overrides.reviewed                  ?? false,
    notes:                     overrides.notes                     ?? "",
    driverId:                  overrides.driverId                  ?? null,
    layerId,
    affectedLayers:            overrides.affectedLayers            ?? [layerId],
    affectedEnvironments:      overrides.affectedEnvironments      ?? ["00000000-0000-4000-8000-000000000001"],
    relatedCurrentInstanceIds: overrides.relatedCurrentInstanceIds ?? [],
    relatedDesiredInstanceIds: overrides.relatedDesiredInstanceIds ?? [],
    services:                  overrides.services                  ?? [],
    aiMappedDellSolutions:     overrides.aiMappedDellSolutions     ?? null
  });
}

export const gapFkDeclarations = [
  { field: "gapType",                   target: "catalog:GAP_TYPES",     required: true,  isArray: false },
  { field: "driverId",                  target: "drivers",               required: false, isArray: false },
  { field: "layerId",                   target: "catalog:LAYERS",        required: true,  isArray: false },
  { field: "affectedLayers",            target: "catalog:LAYERS",        required: true,  isArray: true },
  { field: "affectedEnvironments",      target: "environments",          required: true,  isArray: true },
  { field: "relatedCurrentInstanceIds", target: "instances",             required: false, isArray: true,
    targetFilter: { state: "current" } },
  { field: "relatedDesiredInstanceIds", target: "instances",             required: false, isArray: true,
    targetFilter: { state: "desired" } },
  { field: "services",                  target: "catalog:SERVICE_TYPES", required: false, isArray: true }
];

export const gapPathManifest = [
  ownPath("context.gap.description",     "string", "Gap description"),
  ownPath("context.gap.urgency",         "enum",   "Gap urgency"),
  ownPath("context.gap.phase",           "enum",   "Gap phase"),
  ownPath("context.gap.status",          "enum",   "Gap status"),
  ownPath("context.gap.notes",           "string", "Gap notes"),
  // BUG-023 fix (2026-05-03) — layerId + gapType are user-meaningful
  // scalars referenced by the dell-mapping seed prompt and by any user
  // skill that wants to author per-layer / per-action prompts. Pre-fix
  // the manifest omitted them, so the skill-save validator rejected
  // `{{context.gap.layerId}}` even though the run-time path resolver
  // resolved it correctly.
  ownPath("context.gap.layerId",         "enum",   "Gap layer (primary)"),
  ownPath("context.gap.gapType",         "enum",   "Gap type (replace / augment / new / decommission / consolidate)"),
  linkedPath("context.gap.driver.priority", "enum", "Linked driver priority",
    "engagement.drivers.byId[gap.driverId]"),
  linkedPath("context.gap.relatedCurrentInstances[*].label", "string",
    "Linked current instance labels",
    "engagement.instances filtered by gap.relatedCurrentInstanceIds")
];
