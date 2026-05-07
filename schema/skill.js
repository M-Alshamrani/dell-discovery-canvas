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
  //    Parameter NAME = entityKind (e.g. "gap", "driver") so legacy
  //    prompt templates referencing {{context.gap.description}} keep
  //    resolving cleanly post-migration. The runner binds
  //    context.<paramName> = looked-up-entity at invocation time.
  if (raw.skillType === "click-to-run" && raw.entityKind && out.parameters.length === 0) {
    out.parameters = [{
      name:        raw.entityKind,
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

// SPEC §S35.4 / RULES §16 CH31 — translate a v2.x skill record (from
// `core/skillStore.js`) to v3.1 shape. Pure function; no side effects.
// Idempotent on v3.1 input (round-trips). Used by the evolved Skill
// Builder (rc.4-dev Arc 4) to give v2 records an opt-in migration path
// surfaced as a per-row "Migrate" button under the "Legacy (v2)"
// section of the Settings → Skills builder pill.
//
// v2.x → v3.1 field map:
//   name           → label
//   description    → description (cross-cutting passthrough; skill schema
//                    doesn't have its own `description`, so it lands on
//                    cross-cutting `description` field if helpers expose it)
//   promptTemplate → promptTemplate (verbatim)
//   bindings       → bindings (shape-compatible; both use {path, source})
//   responseFormat → outputContract:
//                      "text-brief" / undefined → "free-text"
//                      "json-scalars" / "json-commands" → { schemaRef: <hint or fallback> }
//   tab            → DROPPED (no v3 equivalent; chat-rail is engagement-wide)
//   applyPolicy    → DROPPED (structured outputs are per outputTarget in v3)
//   deployed       → DROPPED (no v3 deploy gate; all saved skills surface)
//   outputSchema   → DROPPED (replaced by outputContract.schemaRef)
//   providerKey    → DROPPED (per-skill provider override is rc.5+ scope)
//   systemPrompt   → DROPPED (folded into role-section directives in v3)
//
// New v3.1 fields default to:
//   parameters       []
//   outputTarget     "chat-bubble"
//   validatedAgainst "3.1"
//
// `_droppedFromV2` non-strict-schema field carries the audit list so the
// migrated row's UI can surface what was lost. Saved-but-non-validated;
// strip before SkillSchema.parse if needed.
export function migrateV2SkillToV31(v2Record) {
  if (!v2Record || typeof v2Record !== "object") return v2Record;

  const dropped = [];
  const out = {};

  // 1. label (v2.x `name`).
  out.label = (typeof v2Record.label === "string" && v2Record.label.length > 0)
    ? v2Record.label
    : (typeof v2Record.name === "string" ? v2Record.name : "Untitled");

  // 2. skillId — v2 uses a uid string ("skill-xxxx"); v3 uses a
  //    user-visible id. Reuse if present; else derive from label.
  out.skillId = (typeof v2Record.skillId === "string" && v2Record.skillId.length > 0)
    ? v2Record.skillId
    : (typeof v2Record.id === "string" && v2Record.id.length > 0
        ? v2Record.id
        : "skl-migrated-" + (out.label || "x").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24));

  // 3. version: preserve or default.
  out.version = (typeof v2Record.version === "string") ? v2Record.version : "1.0.0";

  // 4. promptTemplate: verbatim.
  out.promptTemplate = (typeof v2Record.promptTemplate === "string")
    ? v2Record.promptTemplate
    : "";

  // 5. bindings: passthrough ({path, source}) extracted by
  //    skillEngine.extractBindings on save in the evolved Skill Builder;
  //    empty if absent on the v2 record.
  out.bindings = Array.isArray(v2Record.bindings) ? v2Record.bindings.slice() : [];

  // 6. outputContract: derive from responseFormat + outputSchema hint.
  if (v2Record.responseFormat === "json-scalars" || v2Record.responseFormat === "json-commands") {
    // v2 schema-bearing skills carry an outputSchema array. We don't
    // have a stable schemaRef for arbitrary v2 skills; default to
    // "DellSolutionListSchema" if outputSchema looks Dell-shaped, else
    // fall back to free-text rather than emit a broken schemaRef.
    const looksDellShaped = Array.isArray(v2Record.outputSchema)
      && v2Record.outputSchema.some(e => e && typeof e.path === "string" && /products|dell|solution/i.test(e.path));
    out.outputContract = looksDellShaped
      ? { schemaRef: "DellSolutionListSchema" }
      : "free-text";
  } else {
    out.outputContract = "free-text";
  }

  // 7. New v3.1 fields with sensible defaults.
  out.outputTarget = "chat-bubble";
  out.parameters = [];

  // 8. validatedAgainst marker.
  out.validatedAgainst = "3.1";
  out.outdatedSinceVersion = null;

  // 9. Audit: record dropped-on-migration v2 fields so the UI can show
  //    "this v2 field didn't survive migration" hints. Non-schema field;
  //    strip before SkillSchema.parse if a strict path needs it.
  if (v2Record.tab != null && v2Record.tab !== "")           dropped.push({ field: "tab",          value: v2Record.tab });
  if (v2Record.applyPolicy != null && v2Record.applyPolicy !== "") dropped.push({ field: "applyPolicy",  value: v2Record.applyPolicy });
  if (v2Record.deployed != null)                              dropped.push({ field: "deployed",     value: v2Record.deployed });
  if (Array.isArray(v2Record.outputSchema) && v2Record.outputSchema.length > 0) dropped.push({ field: "outputSchema", value: v2Record.outputSchema });
  if (v2Record.providerKey != null && v2Record.providerKey !== "")   dropped.push({ field: "providerKey",  value: v2Record.providerKey });
  if (typeof v2Record.systemPrompt === "string" && v2Record.systemPrompt.length > 0) dropped.push({ field: "systemPrompt", value: v2Record.systemPrompt });
  out._droppedFromV2 = dropped;

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
