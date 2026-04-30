// schema/skill.js — v3.0 · SPEC sec S7.1
//
// SkillSchema validates persisted skill records. Per SPEC sec S7.1.2,
// skills live in engagement.skills (Collection<Skill>) in v3.0; v3.1
// promotes to a per-owner top-level collection without shape change.

import { z } from "zod";
import { crossCuttingFieldsSchema, defaultCrossCuttingFields } from "./helpers/crossCuttingFields.js";

const ENTITY_KIND_ENUM = z.enum([
  "driver", "currentInstance", "desiredInstance", "gap", "environment", "project"
]);

const BindingSchema = z.object({
  path:   z.string().min(1),
  source: z.enum(["session", "entity", "linked", "catalog"])
});

const OutputContractSchema = z.union([
  z.literal("free-text"),
  z.object({ schemaRef: z.string().min(1) })
]);

const SCHEMA_VERSION_RE = /^\d+\.\d+$/;

export const SkillSchema = z.object({
  ...crossCuttingFieldsSchema,
  skillId:              z.string().min(1),                    // user-visible id "skl-..."
  label:                z.string().min(1),
  version:              z.string().default("1.0.0"),
  skillType:            z.enum(["click-to-run", "session-wide"]),
  entityKind:           ENTITY_KIND_ENUM.nullable(),
  promptTemplate:       z.string().min(1),
  bindings:             z.array(BindingSchema).default([]),
  outputContract:       OutputContractSchema.default("free-text"),
  validatedAgainst:     z.string().regex(SCHEMA_VERSION_RE).default("3.0"),
  outdatedSinceVersion: z.string().regex(SCHEMA_VERSION_RE).nullable().default(null)
}).strict().superRefine((skill, ctx) => {
  // R7.1.a · click-to-run REQUIRES entityKind; session-wide FORBIDS it.
  if (skill.skillType === "click-to-run" && skill.entityKind === null) {
    ctx.addIssue({
      code: "custom", path: ["entityKind"],
      message: "click-to-run skills must declare entityKind"
    });
  }
  if (skill.skillType === "session-wide" && skill.entityKind !== null) {
    ctx.addIssue({
      code: "custom", path: ["entityKind"],
      message: "session-wide skills must NOT declare entityKind"
    });
  }
});

export function createEmptySkill(overrides = {}) {
  const base = defaultCrossCuttingFields(overrides);
  return SkillSchema.parse({
    ...base,
    skillId:              overrides.skillId              ?? "skl-new-001",
    label:                overrides.label                ?? "New skill",
    version:              overrides.version              ?? "1.0.0",
    skillType:            overrides.skillType            ?? "session-wide",
    entityKind:           overrides.entityKind           ?? null,
    promptTemplate:       overrides.promptTemplate       ?? "Hello {{customer.name}}!",
    bindings:             overrides.bindings             ?? [],
    outputContract:       overrides.outputContract       ?? "free-text",
    validatedAgainst:     overrides.validatedAgainst     ?? "3.0",
    outdatedSinceVersion: overrides.outdatedSinceVersion ?? null
  });
}
