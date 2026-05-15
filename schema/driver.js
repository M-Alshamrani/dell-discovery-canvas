// schema/driver.js — v3.0 · SPEC sec S3.3
//
// Driver entity. Promoted to its own top-level collection (extracted
// from v2.x customer.drivers[] by MIGRATION sec M8). The skill builder
// treats drivers as a click-to-run entity kind; cross-engagement
// reporting (v3.2) requires this top-level shape.

import { z } from "zod";
import { crossCuttingFieldsSchema, defaultCrossCuttingFields } from "./helpers/crossCuttingFields.js";
import { ownPath, catalogPath } from "./helpers/pathManifest.js";
// aiTag field added 2026-05-15 per SPEC §S47.9.1a (A20 widening · RULES
// §16 CH36 R7 narrowing). Path B importApplier stamps aiTag.kind =
// "discovery-note" when the source is the Workshop Notes overlay (A19).
// Pre-A20 drivers had no aiTag field per CH36 R7 original "instances ONLY"
// lock. Shape mirrors instance.aiTag via the shared helper · single
// source of truth · no parallel definitions per A20 anti-pattern lock.
import { AiTagFieldSchema } from "./helpers/aiTag.js";

export const DriverSchema = z.object({
  ...crossCuttingFieldsSchema,
  businessDriverId: z.string().min(1),                         // FK to BUSINESS_DRIVERS catalog
  catalogVersion:   z.string().min(1),                         // pinned catalog version (SPEC sec S6.1.3)
  priority:         z.enum(["High", "Medium", "Low"]),
  outcomes:         z.string().default(""),
  // A20 (2026-05-15) · AI-mutation provenance (mirrors instance.aiTag).
  // Stamped by services/importApplier.js when Path B imports a driver
  // from the Workshop Notes overlay. Optional · nullable · defaults null
  // for backward compatibility with pre-A20 persisted engagements.
  aiTag:            AiTagFieldSchema
}).strict();

export function createEmptyDriver(overrides = {}) {
  return DriverSchema.parse({
    ...defaultCrossCuttingFields(overrides),
    businessDriverId: overrides.businessDriverId ?? "ai_data",
    catalogVersion:   overrides.catalogVersion   ?? "2026.04",
    priority:         overrides.priority         ?? "Medium",
    outcomes:         overrides.outcomes         ?? "",
    aiTag:            overrides.aiTag            ?? null
  });
}

export const driverFkDeclarations = [
  { field: "businessDriverId", target: "catalog:BUSINESS_DRIVERS", required: true, isArray: false }
];

export const driverPathManifest = [
  ownPath("context.driver.priority", "enum",   "Driver priority"),
  ownPath("context.driver.outcomes", "string", "Driver outcomes"),
  catalogPath("context.driver.catalog.label",                "string", "Driver name"),
  catalogPath("context.driver.catalog.hint",                 "string", "Driver hint"),
  catalogPath("context.driver.catalog.conversationStarter", "string", "Conversation starter")
];
