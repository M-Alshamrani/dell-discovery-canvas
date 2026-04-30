// migrations/helpers/pipelineContext.js — v3.0 · MIGRATION sec M1.3
//
// Pipeline context passed to every step. Frozen so steps cannot mutate
// it; deterministic in test mode (fixed migrationTimestamp + randomSeed
// produce byte-equal output across runs).

import { generateDeterministicId } from "./deterministicId.js";

export function makePipelineContext({ migrationTimestamp, randomSeed, catalogSnapshot } = {}) {
  const ts   = migrationTimestamp || new Date().toISOString();
  const seed = randomSeed         || "v2-0_to_v3-0:default";
  return Object.freeze({
    migrationTimestamp: ts,
    randomSeed:         seed,
    catalogSnapshot:    Object.freeze(catalogSnapshot || {}),
    // Closure that bakes the seed in. Steps call ctx.deterministicId(...)
    // without re-supplying the seed, ensuring all ids in one run share
    // the same namespace.
    deterministicId: (kind, ...inputs) =>
      generateDeterministicId(kind, seed, ...inputs)
  });
}
