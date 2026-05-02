// services/skillRunner.js — v3.1 · SPEC sec S7.4 + sec S8.1 + §S29
//
// Runs a skill against an LLM provider, resolves its promptTemplate
// against a ResolverContext (augmented with v3.1 parameters), and
// wraps the response in the provenance envelope per SPEC sec S8.1.
//
// **v3.1 changes (per SPEC §S29.2)**:
//   - opts.params: { <paramName>: <value> } — user-supplied at invoke
//   - Required parameters (skill.parameters[i].required=true) MUST be
//     supplied; runner throws on missing
//   - Parameters of type='entityId' get resolved to the entity object
//     and bound to ctx.context.<paramName> so legacy prompt templates
//     ({{context.gap.description}}-style) keep working
//   - Parameter values are also bound to ctx.<paramName> so simple
//     {{<paramName>}} placeholders resolve too
//   - skill.outputTarget: only "chat-bubble" actively rendered in v3.1;
//     "structured-card", "reporting-panel", "proposed-changes" throw
//     a clear "deferred to rc.4" error per SPEC §S29.7
//
// Two output content modes (orthogonal to outputTarget):
//   - "free-text": LLM returns a string; wrapped as { value: text, provenance }
//   - structured: LLM response is parsed as JSON, validated against the
//     registered Zod schema (per outputContract.schemaRef → getOutputSchema),
//     catalog-membership checked on relevant fields with up to
//     MAX_CATALOG_RETRIES (2) re-prompts on banned-id miss; on retry
//     exhaustion the envelope is returned with provenance.validationStatus
//     === "invalid" rather than thrown (per SPEC §S7.4 / S8.2.2).
//
// Per SPEC sec S8.1.2, provenance is set ONLY by this module.

import { resolveTemplate } from "./pathResolver.js";
import { generateDeterministicId } from "../migrations/helpers/deterministicId.js";
import { getOutputSchema } from "./skillOutputSchemas.js";

// Catalog-validation retry budget per SPEC sec S8.2.2.
const MAX_CATALOG_RETRIES = 2;

// SPEC §S29.7 — outputTargets DEFERRED to rc.4 / GA. Surface a clear
// error so authors don't think their skill is broken.
const DEFERRED_OUTPUT_TARGETS = new Set([
  "structured-card", "reporting-panel", "proposed-changes"
]);

// Derive the engagement-collection key for a parameter description hint.
// "Pick a gap" → "gaps"; "Pick a driver" → "drivers"; etc.
function entityKindFromHint(description) {
  if (typeof description !== "string") return null;
  const lower = description.toLowerCase();
  if (lower.includes("gap"))         return "gaps";
  if (lower.includes("driver"))      return "drivers";
  if (lower.includes("environment")) return "environments";
  if (lower.includes("instance"))    return "instances";
  return null;
}

function lookupEntityById(engagement, id, hint) {
  if (!engagement || typeof id !== "string") return null;
  const kindKey = entityKindFromHint(hint);
  // Try the hint's collection first.
  if (kindKey && engagement[kindKey]?.byId?.[id]) {
    return engagement[kindKey].byId[id];
  }
  // Fallback: scan all v3 collections.
  for (const collKey of ["gaps", "drivers", "environments", "instances"]) {
    if (engagement[collKey]?.byId?.[id]) return engagement[collKey].byId[id];
  }
  return null;
}

// runSkill(skill, ctx, llmProvider, opts?) -> Promise<{ value, provenance }>
//
// skill: { skillId, promptTemplate, outputContract, outputTarget, parameters[], version? }
// ctx:   ResolverContext per pathResolver.js (engagement + active entity
//        + linked composition + catalogVersions)
// llmProvider: { complete({ prompt }) -> Promise<{ model, text }> }
// opts.params:        { <paramName>: <value> } — v3.1 parameter values
// opts.runTimestamp:  ISO string for deterministic test mode
// opts.runIdSeed:     string seed for deterministic runId
export async function runSkill(skill, ctx, llmProvider, opts = {}) {
  if (!skill || !skill.skillId || !skill.promptTemplate) {
    throw new Error("runSkill: skill must carry skillId + promptTemplate");
  }

  // SPEC §S29.7 — guard deferred output targets.
  const outputTarget = skill.outputTarget || "chat-bubble";
  if (DEFERRED_OUTPUT_TARGETS.has(outputTarget)) {
    throw new Error("runSkill: outputTarget '" + outputTarget +
      "' is deferred to rc.4 (per SPEC §S29.7). Only 'chat-bubble' is implemented in v3.1.");
  }

  // SPEC §S29.2 — validate + bind v3.1 parameters into the resolver ctx.
  const params = (opts && opts.params) || {};
  const augmentedCtx = { ...ctx };
  if (Array.isArray(skill.parameters)) {
    for (const p of skill.parameters) {
      if (p.required && !(p.name in params)) {
        throw new Error("runSkill: missing required parameter '" + p.name +
          "' for skill '" + skill.skillId + "'");
      }
      if (!(p.name in params)) continue;
      const value = params[p.name];
      // Bind raw parameter value at top level for {{<paramName>}}
      // placeholders.
      augmentedCtx[p.name] = value;
      // For entityId parameters: resolve the entity from the engagement
      // and bind to context.<paramName> so prompt templates can use
      // {{context.<paramName>.<field>}}-style paths (the v3.0 idiom).
      if (p.type === "entityId" && typeof value === "string") {
        const eng = ctx?.engagement || ctx;
        const entity = lookupEntityById(eng, value, p.description);
        if (entity) {
          if (!augmentedCtx.context) augmentedCtx.context = { ...(ctx?.context || {}) };
          augmentedCtx.context[p.name] = entity;
        }
      }
    }
  }

  // Resolve template against (augmented) context (synchronous; pure).
  const resolvedPrompt = resolveTemplate(skill.promptTemplate, augmentedCtx, {
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
