// services/skillOutputSchemas.js — rc.8.b / R4 (SPEC §S46 + RULES §16 CH36)
//
// Registry mapping schemaRef strings to Zod schemas. The skill runner
// consults this to validate structured LLM outputs before stamping
// provenance.
//
// **rc.8.b / R4** — migrateSkillToV31 preprocess RETIRED in lock-step
// with the schema clean-replace. SkillSchema is v3.2 strict; LLM outputs
// claiming SkillSchema must already be v3.2-shaped (no v3.0 / v3.1
// auto-migration). Per user direction 2026-05-10 ("clean replace, no
// production users to migrate").
//
// New schemas are added by:
//   1. Authoring schema/aiOutputs/<name>.js with a Zod export
//   2. Importing + registering here

import { DellSolutionListSchema } from "../schema/aiOutputs/dellSolutionList.js";
import { SkillSchema } from "../schema/skill.js";

const REGISTRY = Object.freeze({
  DellSolutionListSchema,
  SkillSchema    // care-builder generates save-able skill records (v3.2)
});

export function getOutputSchema(schemaRef) {
  if (!schemaRef || typeof schemaRef !== "string") return null;
  return REGISTRY[schemaRef] || null;
}

export function listRegisteredSchemas() {
  return Object.keys(REGISTRY);
}
