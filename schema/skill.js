// schema/skill.js — rc.8.b / R4 (SPEC §S46.3 + RULES §16 CH36)
//
// Skills Builder v3.2 schema. Clean replace per user direction 2026-05-10:
// "(b) replace, drop outputContract, outputFormat is canonical".
//
// DROPPED from the v3.1 shape (no production users, no migration):
//   outputContract  — replaced by outputFormat (CH36.d enum lock)
//   outputTarget    — replaced by outputFormat (chat-bubble was the only
//                     ever-enabled v3.1 value; v3.2 expands to 4 render
//                     targets driven by outputFormat)
//   promptTemplate  — replaced by improvedPrompt (the LLM-generated
//                     CARE-structured Anthropic-XML prompt)
//   bindings        — replaced by dataPoints (the Standard/Advanced
//                     curation list IS the binding declaration)
//
// ADDED (per SPEC §S46.3 — 8 author form fields):
//   description     — required string; surfaced in launcher description-confirm
//   seedPrompt      — required string; author's raw idea
//   dataPoints[]    — array of {path, scope}; selected schema-keyed paths
//   improvedPrompt  — string (default ""); LLM Improve-button output
//   outputFormat    — enum (text/dimensional/json-array/scalar); CH36.d
//   mutationPolicy  — nullable enum (ask/auto-tag); required-non-null iff
//                     outputFormat ∈ {json-array, scalar} (CH36.e)
//
// Migration helpers REMOVED:
//   migrateSkillToV31  — no v3.0 → v3.1 compat needed
//   migrateV2SkillToV31 — no v2 → v3.x compat needed
// All legacy migration tests retired in lock-step (V-SKILL-V3-2 + V-SKILL-V3-14
// + V-MIGRATE-V2-V3-1..4 retired in this same R4 commit).
//
// Authority: docs/v3.0/SPEC.md §S46.3 + §S46.6 + §S46.10 · docs/RULES.md §16 CH36.

import { z } from "zod";
import { crossCuttingFieldsSchema, defaultCrossCuttingFields } from "./helpers/crossCuttingFields.js";

// SPEC §S46.4 / CH36.c — DataPoint binding shape (subset of the
// dataContract DataPoint descriptor; only the path + scope are persisted
// with the skill, full descriptor is re-derived on demand).
const DataPointSchema = z.object({
  path:  z.string().min(1),
  scope: z.enum(["standard", "advanced"])
});

// SPEC §S46.6 / CH36.d — output format enum (locked).
// [S47.6.1 amendment 2026-05-12] · "import-subset" added · skills that
// produce the canonical S47.3 JSON shape (file-driven instance ingestion)
// declare this value and route their output to the shared import preview
// modal (S47.5) instead of mutating-via-commitInstanceUpdate. Distinct
// from "json-array" (which mutates existing records); "import-subset"
// ADDS new records.
const OutputFormatEnum = z.enum(["text", "dimensional", "json-array", "scalar", "import-subset"]);

// SPEC §S46.10 / CH36.e — mutation policy enum (locked).
//   nullable: required-non-null only when outputFormat ∈ {json-array, scalar};
//   for non-mutating output formats (text/dimensional) it persists as null.
const MutationPolicyEnum = z.enum(["ask", "auto-tag"]).nullable();

// SPEC §S46.3 / §S46.8 / CH36.j — parameter schema with file-type added.
//   - file type accepts client-side run-time uploads; declared with `accepts`
//     extension list (e.g. ".xlsx,.csv,.txt,.pdf"). NEVER persisted with
//     skill; consumed at run-time only (per CH36.j).
const ParameterSchema = z.object({
  name:        z.string().min(1),
  type:        z.enum(["string", "number", "boolean", "entityId", "file"]),
  description: z.string().default(""),
  required:    z.boolean().default(false),
  // Optional metadata for file-type parameters; ignored for other types.
  accepts:     z.string().optional()
});

const SCHEMA_VERSION_RE = /^\d+\.\d+$/;

// SPEC §S46.3 — the 8 author form fields + cross-cutting metadata.
export const SkillSchema = z.object({
  ...crossCuttingFieldsSchema,
  // Identity + cross-cutting
  skillId:              z.string().min(1),
  label:                z.string().min(1),
  description:          z.string().min(1),                 // §S46.3 field 2
  version:              z.string().default("1.0.0"),
  // Authoring fields (§S46.3 fields 3..5)
  seedPrompt:           z.string().min(1),                 // field 3 (required)
  dataPoints:           z.array(DataPointSchema).default([]),  // field 4
  improvedPrompt:       z.string().default(""),            // field 5 (filled by Improve)
  // Run-time inputs (§S46.3 field 6)
  parameters:           z.array(ParameterSchema).default([]),
  // Output + mutation contract (§S46.3 fields 7..8 / §S46.6 / §S46.10)
  outputFormat:         OutputFormatEnum,                  // field 7 (locked enum)
  mutationPolicy:       MutationPolicyEnum.default(null),  // field 8 (conditional)
  // [S47 additive deltas 2026-05-12] · three new fields. All have .default()
  // so existing v3.2 skills loaded from localStorage parse cleanly without
  // any migration step (R47.6.4 + R47.7.1 back-compat).
  preview:              z.enum(["none", "per-row"]).default("none"),
  defaultScope:         z.enum(["current", "desired", "both"]).default("desired"),
  kind:                 z.enum(["system", "user"]).default("user"),
  // Schema versioning
  validatedAgainst:     z.string().regex(SCHEMA_VERSION_RE).default("3.2"),
  outdatedSinceVersion: z.string().regex(SCHEMA_VERSION_RE).nullable().default(null)
}).strict();

// createEmptySkill — emits a v3.2-shaped draft. Defaults are sensible for
// a "blank" new skill the user immediately fills in.
export function createEmptySkill(overrides = {}) {
  const base = defaultCrossCuttingFields(overrides);
  const candidate = {
    ...base,
    skillId:              overrides.skillId              ?? "skl-new-001",
    label:                overrides.label                ?? "New skill",
    description:          overrides.description          ?? "(describe what this skill does)",
    version:              overrides.version              ?? "1.0.0",
    seedPrompt:           overrides.seedPrompt           ?? "(describe what you want the AI to do)",
    dataPoints:           overrides.dataPoints           ?? [],
    improvedPrompt:       overrides.improvedPrompt       ?? "",
    parameters:           overrides.parameters           ?? [],
    outputFormat:         overrides.outputFormat         ?? "text",
    mutationPolicy:       overrides.mutationPolicy       ?? null,
    // S47 additive deltas (defaults match Zod schema defaults).
    preview:              overrides.preview              ?? "none",
    defaultScope:         overrides.defaultScope         ?? "desired",
    kind:                 overrides.kind                 ?? "user",
    validatedAgainst:     overrides.validatedAgainst     ?? "3.2",
    outdatedSinceVersion: overrides.outdatedSinceVersion ?? null
  };
  return SkillSchema.parse(candidate);
}
