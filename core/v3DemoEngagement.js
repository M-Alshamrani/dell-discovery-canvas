// core/v3DemoEngagement.js
//
// SPEC §S21 · v3-native demo engagement. Hand-curated, schema-strict
// engagement that bypasses the v2 → v3 bridge entirely for the demo
// case (per BUG-003 architectural fix and BUG-004 schedule).
//
// Status: STUB v3.0.0-rc.2 RED-first. Throws "not implemented" so
// V-DEMO-1..7 fail RED-first against the stub. Real impl ships in
// the next commit per `feedback_test_or_it_didnt_ship.md` cadence.
//
// Forbidden (per RULES §17 / SPEC §S23):
//   - importing from tests/ at runtime (this is production code)
//   - non-deterministic UUIDs (no crypto.randomUUID at module load)
//   - reading from state/sessionStore.js (the demo is a constant)
//
// Authority: docs/v3.0/SPEC.md §S21 · docs/v3.0/TESTS.md §T21 V-DEMO-* ·
//            docs/RULES.md §17.

// loadV3Demo() → Engagement (schema-strict)
// Returns the curated v3 demo engagement. Idempotent (returns the
// same module-cached engagement object on repeat calls so the §S5
// memoization holds).
export function loadV3Demo() {
  throw new Error("loadV3Demo: not implemented (rc.2 RED-first; real impl ships next commit)");
}

// describeV3Demo() → { isStub, ... }
// Returns metadata about the demo for UI display.
export function describeV3Demo() {
  return { isStub: true, message: "v3 demo not yet implemented (rc.2 RED-first)" };
}
