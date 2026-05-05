// services/groundingVerifier.js
//
// SPEC §S37.3.2 + RULES §16 CH33 · Runtime grounding verifier for chat.
// Scans an assistant response for entity-shaped claims (gap descriptions,
// vendor names, driver labels, env aliases, instance labels, project
// names, ISO-shaped dates referenced as deliverables, "Phase N" / "Q[1-4]"
// project-phase references) and cross-references each against the live
// engagement (with catalog reference data whitelisted per R37.8).
//
// services/chatService.js streamChat(...) MUST call verifyGrounding on
// the final visible response. On ok:false the visible response is
// REPLACED with a render-error message; provenance still surfaces; the
// violations array is recorded on the assistant message envelope.
//
// Authority:
//   - docs/v3.0/SPEC.md §S37.3.2 (plane 2 — runtime verifier)
//   - docs/RULES.md §16 CH33
//   - docs/v3.0/TESTS.md §T38 V-FLOW-GROUND-FAIL-1..5
//
// Forbidden (per §S37.7):
//   - allowing a hallucinated response through. verifyGrounding is a
//     hard gate; bypass = bug.
//   - asserting LLM output semantics. The verifier asserts a STRUCTURAL
//     property (entity references trace to engagement); not "the model
//     gave the right answer".
//
// rc.6 / 6a · RED-BY-DESIGN STUB. Returns ok:true unconditionally for
// every input. V-FLOW-GROUND-FAIL-1..5 expect violations; all fail.
// rc.6 / 6c lands the claim extractor + grounding map + cross-reference.

export function verifyGrounding(_response, _engagement) {
  // STUB — accepts everything. rc.6 / 6c implementation builds the
  // grounding map from engagement + catalogs and runs the claim
  // extractor per §S37.7.
  return { ok: true, violations: [] };
}
