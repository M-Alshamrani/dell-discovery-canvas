// schema/customer.js — v3.0 · SPEC sec S3.2
//
// Customer entity. Single record per engagement. Embedded in the
// engagement document for v3.0; promotable to its own collection at
// v3.2 backend migration without breaking changes (per OPEN_QUESTIONS
// _RESOLVED.md Q7).
//
// Removed in v3.0 vs v2.x: `segment`, `industry` (legacy back-compat
// fields). The migrator (MIGRATION sec M7) copies any non-redundant
// content into `notes`.

import { z } from "zod";
import { sessionPath } from "./helpers/pathManifest.js";

export const CustomerSchema = z.object({
  engagementId: z.string().uuid(),
  name:         z.string().min(1),
  vertical:     z.string().min(1),                            // FK to CUSTOMER_VERTICALS catalog
  region:       z.string(),
  notes:        z.string().default("")
}).strict();

// Default-valid factory. Per SPEC S2.2.1 every entity schema exports
// createEmpty<EntityName>() that returns an instance the schema accepts.
export function createEmptyCustomer(overrides = {}) {
  return CustomerSchema.parse({
    engagementId: overrides.engagementId ?? "00000000-0000-4000-8000-000000000000",
    name:         overrides.name         ?? "New customer",
    vertical:     overrides.vertical     ?? "Financial Services",
    region:       overrides.region       ?? "EMEA",
    notes:        overrides.notes        ?? ""
  });
}

// FK declarations consumed by integrity sweep + manifest generator + DDL.
// Customer has one FK: vertical → CUSTOMER_VERTICALS catalog.
export const customerFkDeclarations = [
  { field: "vertical", target: "catalog:CUSTOMER_VERTICALS", required: true, isArray: false }
];

// Path manifest contribution. Customer fields are addressable as
// session-level paths (no entityKind scope) per SPEC S7.2 since the
// customer record is a top-level engagement field.
export const customerPathManifest = [
  sessionPath("customer.name",     "string", "Customer name"),
  sessionPath("customer.vertical", "string", "Customer vertical"),
  sessionPath("customer.region",   "string", "Customer region"),
  sessionPath("customer.notes",    "string", "Customer notes")
];
