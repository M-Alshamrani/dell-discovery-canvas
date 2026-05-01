// state/v3Adapter.js
//
// SPEC §S19 · v3.0 → v2.x consumption adapter.
// SPEC-only annex (not in data-architecture-directive.md). Lets the existing
// 5 v2.x view tabs (Context · Architecture · Heatmap · Workload Mapping ·
// Gaps · Reporting) read v3.0 engagement data through one thin module
// instead of state/sessionState.js. The v3.0 Lab tab reads engagementStore
// directly and is not part of the adapter migration window (R19.10).
//
// Status: STUB v3.0.0-rc.1 RED-first. Suite 49 §T19 V-ADP-1..10 fails
// against these stubs by design (per feedback_spec_and_test_first.md).
// Stubs return null so the per-view shape assertions fail with real
// errors when the test reads through `.customer` / `.cells` / `.gaps`.
// Implementation lands in the next commit.
//
// Forbidden (R19.6, R19.2, R19.7, F19.5.x):
//   - importing state/sessionState.js
//   - mutating engagement objects directly
//   - caching view-shape outputs (selectors §S5 already memoize)
//
// Authority: docs/v3.0/SPEC.md §S19 · docs/v3.0/TESTS.md §T19 V-ADP-* ·
//            docs/RULES.md §15.

// ─── view-shape selectors (R19.1 read side) ──────────────────────────────────

export function adaptContextView(_eng)      { return null; }
export function adaptArchitectureView(_eng) { return null; }
export function adaptHeatmapView(_eng)      { return null; }
export function adaptWorkloadView(_eng)     { return null; }
export function adaptGapsView(_eng)         { return null; }
export function adaptReportingView(_eng)    { return null; }

// ─── write-through helpers (R19.1 write side, R19.4) ─────────────────────────

export function commitContextEdit(_patch)                            { /* stub: no-op */ }
export function commitInstanceEdit(_layerId, _envId, _instancePatch) { /* stub: no-op */ }
export function commitWorkloadMapping(_workloadId, _mappedAssetIds)  { /* stub: no-op */ }
export function commitGapEdit(_gapId, _patch)                        { /* stub: no-op */ }
