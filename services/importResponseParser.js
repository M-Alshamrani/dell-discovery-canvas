// services/importResponseParser.js — rc.8 / C1c (SPEC §S47.3 + §S47.10)
//
// Zod-validated parser for the canonical `import-subset` JSON shape that
// both ingress paths (Skills-Builder file-ingest skill + Dell-internal-LLM
// instructions workflow) produce. Same wire format, same parser, same
// downstream pipeline (drift-check -> preview modal -> applier).
//
// SHAPE (per SPEC §S47.3):
//   {
//     "schemaVersion": "1.0",
//     "kind": "instance.add",
//     "generatedAt": "<ISO instant>",
//     "engagementContextSnapshot"?: {           // Path B only (R47.3.2)
//       "customerName": "<string>",
//       "environmentSlots": [
//         { "uuid": "<string>", "label": "<string>", "envCatalogId": "<string>" },
//         ...
//       ]
//     },
//     "items": [
//       {
//         "confidence": "high" | "medium" | "low",          // R47.3.4
//         "rationale": "<string>",
//         "data": {
//           "state": "current" | "desired" | null,           // R47.3.3 - HINT only
//           "layerId": "<string>",                            // FK to LAYERS
//           "environmentId": "<string>",                      // wire-format only;
//                                                              // drift-check validates
//                                                              // membership against
//                                                              // live engagement
//           "label": "<string>",
//           "vendor": "<string>",
//           "vendorGroup": "dell" | "nonDell" | "custom",
//           "criticality": "High" | "Medium" | "Low",
//           "notes": "<string>"
//         }
//       },
//       ...
//     ]
//   }
//
// Design notes:
//   - environmentId is z.string().min(1) NOT .uuid() · the live-engagement
//     UUID membership check is the drift-check's job (importDriftCheck.js).
//     Validating UUID format here would let mismatched-but-format-valid
//     UUIDs short-circuit the drift check, leaking subtle bugs.
//   - engagementContextSnapshot is .optional() at the parser layer · the
//     Path A skill omits it (skill runs against live engagement); Path B
//     includes it (records env-slot state at instructions-generation time
//     so drift detection has a baseline). Upper layer enforces Path B
//     requirement.
//   - Not .strict() · external LLMs may emit harmless extra fields
//     (e.g. "summary" or "notes-for-engineer"); Zod silently strips them
//     rather than rejecting outright. The strict-match contract (R47.8.3)
//     applies to environmentId membership, not to schema-shape.
//
// Authority: docs/v3.0/SPEC.md §S47.3 + §S47.10 (V-FLOW-IMPORT-RESPONSE-SCHEMA-1).

import { z } from "zod";

const ImportItemDataSchema = z.object({
  state:         z.enum(["current", "desired"]).nullable(),
  layerId:       z.string().min(1),
  environmentId: z.string().min(1),
  label:         z.string().min(1),
  vendor:        z.string(),
  vendorGroup:   z.enum(["dell", "nonDell", "custom"]),
  criticality:   z.enum(["High", "Medium", "Low"]),
  notes:         z.string().default("")
});

const ImportItemSchema = z.object({
  confidence: z.enum(["high", "medium", "low"]),
  rationale:  z.string().default(""),
  data:       ImportItemDataSchema
});

const EnvironmentSlotSchema = z.object({
  uuid:         z.string().min(1),
  label:        z.string().min(1),
  envCatalogId: z.string().min(1)
});

const EngagementContextSnapshotSchema = z.object({
  customerName:     z.string().min(1),
  environmentSlots: z.array(EnvironmentSlotSchema)
});

export const ImportSubsetSchema = z.object({
  schemaVersion:             z.literal("1.0"),
  kind:                      z.literal("instance.add"),
  generatedAt:               z.string().min(1),
  engagementContextSnapshot: EngagementContextSnapshotSchema.optional(),
  items:                     z.array(ImportItemSchema).min(1)
});

// parseImportResponse(jsonString) -> { ok, parsed, errors }
//   - ok=true  · parsed is the Zod-validated object, errors is null
//   - ok=false · parsed is null, errors is a non-empty array of issues
// Errors are surfaced verbatim from Zod with the path joined into a
// dotted string so upper layers (preview modal "expand error" link)
// can render them inline.
export function parseImportResponse(jsonString) {
  let raw;
  try {
    raw = JSON.parse(jsonString);
  } catch (e) {
    return {
      ok:     false,
      parsed: null,
      errors: [{ path: "(json)", message: "Invalid JSON: " + (e && e.message || String(e)), code: "json_parse" }]
    };
  }
  const result = ImportSubsetSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok:     false,
      parsed: null,
      errors: result.error.issues.map(i => ({
        path:    i.path.join("."),
        message: i.message,
        code:    i.code
      }))
    };
  }
  return { ok: true, parsed: result.data, errors: null };
}
