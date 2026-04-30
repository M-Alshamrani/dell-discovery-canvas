// services/skillOutputSchemas.js — v3.0 · SPEC sec S7.4
//
// Registry mapping outputContract.schemaRef strings to Zod schemas.
// The skill runner consults this to validate structured LLM outputs
// before stamping provenance.
//
// New schemas are added by:
//   1. Authoring schema/aiOutputs/<name>.js with a Zod export
//   2. Importing + registering here

import { DellSolutionListSchema } from "../schema/aiOutputs/dellSolutionList.js";

const REGISTRY = Object.freeze({
  DellSolutionListSchema
  // SkillSchema (for care-builder) lands when SkillSchema is authored
  // in schema/skill.js per SPEC sec S7.1
});

export function getOutputSchema(schemaRef) {
  if (!schemaRef || typeof schemaRef !== "string") return null;
  return REGISTRY[schemaRef] || null;
}

export function listRegisteredSchemas() {
  return Object.keys(REGISTRY);
}
