// schema/skill.js — v3.1 · SPEC sec S7.1 + §S29
//
// SkillSchema validates persisted skill records.
//
// **v3.1 architecture (per SPEC §S29, 2026-05-02 LATE EVENING)**:
// click-to-run scope is RETIRED — single skill scope, parameterized by
// optional user-supplied arguments. Output rendering is now explicit
// via `outputTarget` ("chat-bubble" ships in v3.1; "structured-card",
// "reporting-panel", "proposed-changes" are reserved for rc.4+).
//
// **Migration policy**:
// `migrateSkillToV31(raw)` translates v3.0 shape (skillType + entityKind)
// to v3.1 (outputTarget + parameters[]). Applied at the load/save
// boundaries in state/v3SkillStore.js so downstream code (Skill Builder
// UI, runner) sees only v3.1 shape after this commit lands. Per S29.3:
// click-to-run + entityKind=<X> → parameters: [{name:"entity",
// type:"entityId", description:"Pick a <X>", required:true}].
// session-wide → empty parameters.

import { z } from "zod";
import { crossCuttingFieldsSchema, defaultCrossCuttingFields } from "./helpers/crossCuttingFields.js";

const BindingSchema = z.object({
  path:   z.string().min(1),
  source: z.enum(["session", "entity", "linked", "catalog", "parameter"])  // "parameter" added in v3.1
});

const OutputContractSchema = z.union([
  z.literal("free-text"),
  z.object({ schemaRef: z.string().min(1) })
]);

// SPEC §S29.2 — output rendering target. Only "chat-bubble" is actively
// supported in v3.1; the other three are placeholders for rc.4 / GA so
// authored skills aren't blocked by future schema migration.
const OutputTargetEnum = z.enum([
  "chat-bubble", "structured-card", "reporting-panel", "proposed-changes"
]);

// SPEC §S29.2 — parameter at invocation time. The author defines zero-
// or-more parameters; the user supplies values when invoking the skill
// from the chat right-rail.
const ParameterSchema = z.object({
  name:        z.string().min(1),
  type:        z.enum(["string", "number", "boolean", "entityId"]),
  description: z.string().default(""),
  required:    z.boolean().default(false)
});

const SCHEMA_VERSION_RE = /^\d+\.\d+$/;

export const SkillSchema = z.object({
  ...crossCuttingFieldsSchema,
  skillId:              z.string().min(1),                    // user-visible id "skl-..."
  label:                z.string().min(1),
  version:              z.string().default("1.0.0"),
  // v3.1 NEW:
  outputTarget:         OutputTargetEnum.default("chat-bubble"),
  parameters:           z.array(ParameterSchema).default([]),
  // PRESERVED across v3.0 → v3.1:
  promptTemplate:       z.string().min(1),
  bindings:             z.array(BindingSchema).default([]),
  outputContract:       OutputContractSchema.default("free-text"),
  validatedAgainst:     z.string().regex(SCHEMA_VERSION_RE).default("3.1"),
  outdatedSinceVersion: z.string().regex(SCHEMA_VERSION_RE).nullable().default(null)
}).strict();

// SPEC §S29.3 — migration policy. Translates a v3.0 skill record to
// v3.1 shape. Idempotent: a v3.1 record passes through unchanged. Pure
// function (no side effects); safe at load + save boundaries.
//
//   v3.0 click-to-run + entityKind=<X>
//     → v3.1 parameters: [{name:"entity", type:"entityId",
//                           description:"Pick a <X>", required:true}]
//
//   v3.0 session-wide
//     → v3.1 parameters: []  (no user input at invocation)
//
//   outputTarget defaults to "chat-bubble" for migrated skills (the
//   only target that actually renders in v3.1).
//
//   bindings + outputContract + promptTemplate + cross-cutting fields
//   are preserved verbatim. validatedAgainst bumps to "3.1".
export function migrateSkillToV31(raw) {
  if (!raw || typeof raw !== "object") return raw;
  // True early-return: record is ALREADY in pure v3.1 shape (has new
  // fields AND no legacy fields lurking). This keeps the function
  // referentially equal for idempotent calls.
  const hasLegacy = ("skillType" in raw) || ("entityKind" in raw);
  if ("outputTarget" in raw && Array.isArray(raw.parameters) && !hasLegacy) {
    return raw;
  }

  const out = { ...raw };

  // 1. Add v3.1 fields with sensible defaults.
  out.outputTarget = out.outputTarget || "chat-bubble";
  if (!Array.isArray(out.parameters)) out.parameters = [];

  // 2. Translate legacy skillType + entityKind into parameters[].
  //    Only auto-fill parameters when none were already declared so a
  //    caller that supplies BOTH new + legacy fields keeps the new.
  if (raw.skillType === "click-to-run" && raw.entityKind && out.parameters.length === 0) {
    out.parameters = [{
      name:        "entity",
      type:        "entityId",
      description: "Pick a " + raw.entityKind,
      required:    true
    }];
  }

  // 3. Drop v3.0-only fields.
  delete out.skillType;
  delete out.entityKind;

  // 4. Bump validatedAgainst marker.
  out.validatedAgainst = "3.1";

  return out;
}

// createEmptySkill emits a v3.1-shaped skill. Callers that supply
// legacy v3.0 fields (skillType / entityKind) are auto-migrated via
// migrateSkillToV31 BEFORE schema validation, so existing call sites
// continue to work until they're rewritten in rc.3 commit #4.
export function createEmptySkill(overrides = {}) {
  const base = defaultCrossCuttingFields(overrides);
  // Build the candidate FIRST, then run migration if legacy fields present.
  let candidate = {
    ...base,
    skillId:              overrides.skillId              ?? "skl-new-001",
    label:                overrides.label                ?? "New skill",
    version:              overrides.version              ?? "1.0.0",
    promptTemplate:       overrides.promptTemplate       ?? "Hello {{customer.name}}!",
    bindings:             overrides.bindings             ?? [],
    outputContract:       overrides.outputContract       ?? "free-text",
    validatedAgainst:     overrides.validatedAgainst     ?? "3.1",
    outdatedSinceVersion: overrides.outdatedSinceVersion ?? null,
    outputTarget:         overrides.outputTarget         ?? "chat-bubble",
    parameters:           overrides.parameters           ?? []
  };
  // If the caller passed legacy fields, fold them through the migrator.
  if ("skillType" in overrides || "entityKind" in overrides) {
    candidate.skillType   = overrides.skillType;
    candidate.entityKind  = overrides.entityKind;
    candidate = migrateSkillToV31(candidate);
  }
  return SkillSchema.parse(candidate);
}
