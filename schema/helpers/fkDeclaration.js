// schema/helpers/fkDeclaration.js — v3.0 · SPEC sec S4.4
//
// Machine-readable FK declaration shape consumed by:
//   1. state/integritySweep.js          (orphan + filter-violation rules)
//   2. services/manifestGenerator.js    (linked-paths emission per entity kind)
//   3. services/ddlGenerator.js         (Postgres FK constraints, v3.2 backend)
//
// Per directive R4.4.1 + R4.4.2: hand-coding FK checks in any of those
// modules is forbidden. The single source of truth is the per-entity
// fkDeclarations export.

import { z } from "zod";

export const FkDeclarationSchema = z.object({
  field:        z.string().min(1),                                         // dot-path within the entity
  target:       z.string().min(1),                                         // collection name OR "catalog:CATALOG_ID"
  required:     z.boolean(),                                                // false → null permitted
  isArray:      z.boolean().default(false),                                 // true → field is array of FKs
  targetFilter: z.record(z.union([z.string(), z.boolean(), z.number()])).optional()
});

export const FkDeclarationsSchema = z.array(FkDeclarationSchema);

// Convenience constructors so per-entity declarations stay readable.
export function fk(field, target, opts = {}) {
  return {
    field,
    target,
    required: opts.required ?? true,
    isArray:  opts.isArray  ?? false,
    ...(opts.targetFilter ? { targetFilter: opts.targetFilter } : {})
  };
}
