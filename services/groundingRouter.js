// services/groundingRouter.js
//
// SPEC §S37.3.1 + RULES §16 CH33 · Deterministic retrieval router for the
// chat grounding contract. Maps {userMessage, transcript, engagement} →
// list of selector calls to invoke server-side BEFORE the LLM sees the
// message; selector results are then inlined into Layer 4 of the system
// prompt by services/systemPromptAssembler.js.
//
// The router NEVER calls an LLM. It is pure + deterministic + cheap.
// Heuristic intent classification: regex/keyword + phrase-pattern table
// + verb-object cues. When intent is unrecognized, returns CONTEXT_PACK
// fallback (cheap selectors that cover the most common questions).
//
// Authority:
//   - docs/v3.0/SPEC.md §S37 (Grounding contract recast)
//   - docs/RULES.md §16 CH3 (rewritten) + CH33
//   - docs/v3.0/TESTS.md §T38 V-FLOW-GROUND-1..7 + V-FLOW-GROUND-FAIL-*
//
// Forbidden (per §S37.7):
//   - LLM calls inside this module (no second grounding surface)
//   - state mutations (router is pure)
//   - any reintroduction of the ENGAGEMENT_INLINE_THRESHOLD_* constants
//
// rc.6 / 6a · RED-BY-DESIGN STUB. The function exists but returns empty
// selector lists for every input. V-FLOW-GROUND-1 expects a non-empty
// classification table; V-FLOW-GROUND-3 expects gap inlining. Both fail.
// rc.6 / 6b lands the heuristic classifier + intent table. RED → GREEN.

export const CONTEXT_PACK = [
  { selector: "selectGapsKanban",            args: {} },
  { selector: "selectVendorMix",             args: {} },
  { selector: "selectExecutiveSummaryInputs", args: {} }
];

export function route(_opts) {
  // STUB — returns no selectors. rc.6 / 6b implementation maps user
  // messages to the §S37.3.1 intent table.
  return {
    selectorCalls: [],
    rationale:     "stub-rc.6-6a",
    fallback:      null
  };
}
