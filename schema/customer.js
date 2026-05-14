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

// BUG-063 fix (rc.9 · 2026-05-14): name + vertical relaxed from
// .min(1) to z.string() (any string, including ""). Reason: the
// .min(1) constraint forced createEmptyCustomer() to pick real-
// looking placeholder values ("New customer" / "Financial Services")
// for an empty initial state, which the chat then read as actual
// customer data (eval regression DSC-4 / APP-4 in rc.9 baseline
// 2026-05-14T11-48-56-300Z.json). Empty string is the canonical
// "unset" sentinel post-fix. UI rendering of the empty state
// (placeholder text in Tab 1 inputs / dropdowns) is a separate
// follow-up arc; for the chat + eval fix, schema empty is sufficient.
export const CustomerSchema = z.object({
  engagementId: z.string().uuid(),
  name:         z.string(),                                    // BUG-063: relaxed from .min(1); "" is the unset sentinel
  vertical:     z.string(),                                    // BUG-063: relaxed from .min(1); "" is the unset sentinel · FK to CUSTOMER_VERTICALS catalog when non-empty
  region:       z.string(),
  notes:        z.string().default("")
}).strict();

// Default-valid factory. Per SPEC S2.2.1 every entity schema exports
// createEmpty<EntityName>() that returns an instance the schema accepts.
//
// BUG-063 fix (rc.9 · 2026-05-14): defaults flipped from "New customer"
// / "Financial Services" / "EMEA" to "" so the empty state is honest;
// see schema-level comment above + docs/BUG_LOG.md#BUG-063.
export function createEmptyCustomer(overrides = {}) {
  return CustomerSchema.parse({
    engagementId: overrides.engagementId ?? "00000000-0000-4000-8000-000000000000",
    name:         overrides.name         ?? "",
    vertical:     overrides.vertical     ?? "",
    region:       overrides.region       ?? "",
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
