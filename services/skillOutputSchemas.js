// services/skillOutputSchemas.js — v3.1 · SPEC sec S7.4 + §S29.3
//
// Registry mapping outputContract.schemaRef strings to Zod schemas.
// The skill runner consults this to validate structured LLM outputs
// before stamping provenance.
//
// **v3.1 transition (per SPEC §S29.3)**: LLM outputs may carry v3.0
// shape (skillType + entityKind) OR v3.1 shape (parameters[] +
// outputTarget). The SkillSchema entry below is wrapped with
// z.preprocess(migrateSkillToV31, ...) so both shapes parse cleanly.
// Other registered schemas (DellSolutionListSchema, etc.) are
// unaffected.
//
// New schemas are added by:
//   1. Authoring schema/aiOutputs/<name>.js with a Zod export
//   2. Importing + registering here

import { z } from "zod";
import { DellSolutionListSchema } from "../schema/aiOutputs/dellSolutionList.js";
import { SkillSchema, migrateSkillToV31 } from "../schema/skill.js";

// Auto-migrating wrapper around SkillSchema. v3.0-shaped output passes
// through the migrator before SkillSchema's v3.1 strict parse.
const MigratedSkillSchema = z.preprocess(
  (raw) => (raw && typeof raw === "object" ? migrateSkillToV31(raw) : raw),
  SkillSchema
);

const REGISTRY = Object.freeze({
  DellSolutionListSchema,
  SkillSchema: MigratedSkillSchema    // care-builder generates save-able skill records
});

export function getOutputSchema(schemaRef) {
  if (!schemaRef || typeof schemaRef !== "string") return null;
  return REGISTRY[schemaRef] || null;
}

export function listRegisteredSchemas() {
  return Object.keys(REGISTRY);
}
