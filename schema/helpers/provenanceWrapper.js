// schema/helpers/provenanceWrapper.js — v3.0 · SPEC sec S8.1
//
// Every AI-authored field is wrapped in `{ value, provenance }`. Plain
// strings in AI-authored slots are a schema violation per directive P5.
//
// The wrapper factory `provenanceWrapper(valueSchema)` composes a Zod
// object whose `value` field carries the typed payload and `provenance`
// records the LLM authorship metadata.

import { z } from "zod";

export const ProvenanceSchema = z.object({
  model:            z.string().min(1),                       // "claude-3-5-sonnet" | "gemini-1.5-pro" | "dell-sales-chat" | "local-llm" | "unknown"
  promptVersion:    z.string().min(1),                       // "skill:dellMap@1.4.0"
  skillId:          z.string().min(1),
  runId:            z.string().min(1),
  timestamp:        z.string().datetime(),
  catalogVersions:  z.record(z.string()),                    // { "DELL_PRODUCT_TAXONOMY": "2026.04", ... }
  validationStatus: z.enum(["valid", "stale", "invalid", "user-edited"])
});

export function provenanceWrapper(valueSchema) {
  return z.object({
    value:      valueSchema,
    provenance: ProvenanceSchema
  });
}
