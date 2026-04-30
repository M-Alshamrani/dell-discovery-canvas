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
  // Structured-output mode (per SPEC S7.4.1): TODO when first
  // structured skill lands. Hook point for catalog-validation retry
  // budget per S8.2.2.
  return {
    value: response.text,
    provenance
  };
}
