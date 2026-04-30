// services/skillRunner.js — v3.0 · SPEC sec S7.4 + sec S8.1
//
// Runs a skill against an LLM provider, resolves its promptTemplate
// against a ResolverContext, and wraps the response in the provenance
// envelope per SPEC sec S8.1.
//
// Two output modes:
//   - "free-text": LLM returns a string; wrapped as { value: text, provenance }
//   - structured: TODO — when first structured-output skill lands
//
// Per SPEC sec S8.1.2, provenance is set ONLY by this module. User-
// facing edit paths produce { value, provenance: { ..., validationStatus:
// "user-edited" } } via separate action functions; never by directly
// constructing provenance objects.

import { resolveTemplate } from "./pathResolver.js";
import { generateDeterministicId } from "../migrations/helpers/deterministicId.js";
import { getOutputSchema } from "./skillOutputSchemas.js";

// Catalog-validation retry budget per SPEC sec S8.2.2.
const MAX_CATALOG_RETRIES = 2;

// runSkill(skill, ctx, llmProvider, opts?) -> Promise<{ value, provenance }>
//
// skill: { skillId, promptTemplate, outputContract, version? }
// ctx:   ResolverContext per pathResolver.js (engagement + active entity
//        + linked composition + catalogVersions)
// llmProvider: { complete({ prompt }) -> Promise<{ model, text }> }
// opts.runTimestamp: ISO string for deterministic test mode (defaults
//        to new Date().toISOString())
// opts.runIdSeed: string seed for deterministic runId (defaults to
//        crypto.randomUUID())
export async function runSkill(skill, ctx, llmProvider, opts = {}) {
  if (!skill || !skill.skillId || !skill.promptTemplate) {
    throw new Error("runSkill: skill must carry skillId + promptTemplate");
  }

  // Resolve template against context (synchronous; pure)
  const resolvedPrompt = resolveTemplate(skill.promptTemplate, ctx, {
    skillId: skill.skillId,
    logUndefined: opts.logUndefined
  });

  // Call LLM (the only async I/O in this module)
  const response = await llmProvider.complete({ prompt: resolvedPrompt });
  if (!response || typeof response.text !== "string") {
    throw new Error("runSkill: LLM provider returned malformed response");
  }

  // Build provenance
  const runId = opts.runIdSeed
    ? generateDeterministicId("skillRun", opts.runIdSeed, skill.skillId)
    : (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : generateDeterministicId("skillRun", String(Math.random()), skill.skillId));

  const provenance = {
    model:            response.model || "unknown",
    promptVersion:    "skill:" + skill.skillId + "@" + (skill.version || "1.0.0"),
    skillId:          skill.skillId,
    runId,
    timestamp:        opts.runTimestamp || new Date().toISOString(),
    catalogVersions:  ctx?.catalogVersions || {},
    validationStatus: "valid"
  };

  // Free-text mode: wrap text as-is.
  if (skill.outputContract === "free-text" || !skill.outputContract) {
    return { value: response.text, provenance };
  }

  // Structured-output mode (per SPEC S7.4.1):
  //   - LLM response.text is parsed as JSON
  //   - Parsed object validated against the registered Zod schema
  //   - Catalog membership check on relevant fields (per S8.2.2)
  //   - Retry up to MAX_CATALOG_RETRIES on miss
  //   - validationStatus="invalid" after exhaustion
  const schema = getOutputSchema(skill.outputContract.schemaRef);
  if (!schema) {
    throw new Error("runSkill: unknown schemaRef '" + skill.outputContract.schemaRef + "'");
  }

  let attempt   = 0;
  let lastValue = null;
  let lastErrors = null;
  let stricterPrompt = resolvedPrompt;

  while (attempt <= MAX_CATALOG_RETRIES) {
    const r = (attempt === 0) ? response : await llmProvider.complete({ prompt: stricterPrompt });
    let parsed;
    try {
      parsed = JSON.parse(r.text);
    } catch (e) {
      lastErrors = [{ code: "JSON_PARSE", message: e.message }];
      attempt += 1;
      stricterPrompt = resolvedPrompt + "\n\nIMPORTANT: respond with ONLY a JSON object matching the schema. No prose.";
      continue;
    }
    const schemaResult = schema.safeParse(parsed);
    if (!schemaResult.success) {
      lastValue  = parsed;
      lastErrors = schemaResult.error.issues;
      attempt += 1;
      stricterPrompt = resolvedPrompt + "\n\nIMPORTANT: previous response failed schema validation. Issues: " +
                       JSON.stringify(schemaResult.error.issues.slice(0, 3));
      continue;
    }
    const validated = schemaResult.data;

    // Catalog-membership check for dell-mapping (and any future
    // catalog-bound schema). Reject products not in the catalog
    // OR matching the SPEC sec S6.2.1 banned list.
    if (skill.outputContract.schemaRef === "DellSolutionListSchema" && Array.isArray(validated.products)) {
      const validIds = ctx?.dellTaxonomyIds || new Set();
      const banned = ["boomi","secureworks_taegis","vxrail","smartfabric_director"];
      const invalid = validated.products.filter(id =>
        banned.includes(id) || (validIds.size > 0 && !validIds.has(id))
      );
      if (invalid.length > 0) {
        lastValue  = validated;
        lastErrors = [{ code: "CATALOG_MEMBERSHIP",
                        message: "Invalid products: " + invalid.join(", ") }];
        attempt += 1;
        stricterPrompt = resolvedPrompt + "\n\nIMPORTANT: products " + JSON.stringify(invalid) +
                         " are NOT in the Dell taxonomy. Use only catalog ids.";
        continue;
      }
    }

    // Success path
    return { value: validated, provenance };
  }

  // Retry budget exhausted -> invalid envelope per SPEC sec S8.2.2
  return {
    value: lastValue,
    provenance: { ...provenance, validationStatus: "invalid" }
  };
}
