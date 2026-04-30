// tests/perf/perfHarness.js — v3.0 · SPEC sec S11
//
// Wall-clock measurement helper for V-PERF-* vectors.
//
// SPEC sec S11.2 specifies a calibration-multiplier approach with two
// baseline files (CI + local). For v3.0 browser tests we relax this to
// "raw budget × generous headroom" because:
//   - Browser tests run in the user's browser, not a known CI machine
//   - We don't have a stable cross-machine reference wall-clock
//   - Strict budgets would flake on slower machines
//
// The HEADROOM_MULTIPLIER below makes V-PERF-* vectors regression-
// guard rather than precise-perf-pinning. Real perf pinning is a v3.1
// concern when CI runs on documented hardware.

const HEADROOM_MULTIPLIER = 5;   // 5x the SPEC budget — generous for browsers

// measure(label, fn) -> { wallMs, result }
// Runs fn() once, returns wall-clock + the function's return value.
export function measure(label, fn) {
  const t0 = (typeof performance !== "undefined" && performance.now)
    ? performance.now() : Date.now();
  const result = fn();
  const t1 = (typeof performance !== "undefined" && performance.now)
    ? performance.now() : Date.now();
  return { label, wallMs: t1 - t0, result };
}

// measureMin(label, fn, runs=3) -> { wallMs, result }
// Runs fn() multiple times, returns the FASTEST run (cold-start jitter
// tolerant). Useful for selector cold/hot tests.
export function measureMin(label, fn, runs = 3) {
  let bestMs = Infinity;
  let lastResult;
  for (let i = 0; i < runs; i++) {
    const t0 = (typeof performance !== "undefined" && performance.now)
      ? performance.now() : Date.now();
    lastResult = fn();
    const t1 = (typeof performance !== "undefined" && performance.now)
      ? performance.now() : Date.now();
    const ms = t1 - t0;
    if (ms < bestMs) bestMs = ms;
  }
  return { label, wallMs: bestMs, result: lastResult };
}

// assertWithinBudget(actualMs, budgetMs, label) — throws if actualMs
// exceeds budgetMs * HEADROOM_MULTIPLIER. The headroom keeps the test
// regression-guard rather than precise-perf-pinning.
export function assertWithinBudget(actualMs, budgetMs, label) {
  const limit = budgetMs * HEADROOM_MULTIPLIER;
  if (actualMs > limit) {
    throw new Error(label + ": " + actualMs.toFixed(1) + "ms exceeded budget " +
                    budgetMs + "ms × " + HEADROOM_MULTIPLIER + "x = " + limit + "ms");
  }
}

export const PERF_BUDGETS = Object.freeze({
  // Per SPEC sec S11.1 (raw budgets; multiplied by headroom in tests)
  selectorColdStart:    50,    // R11.1.3
  selectorHotPath:       1,    // R11.1.4
  allSelectorsColdTotal: 300,  // SPEC §S11.3 V-PERF-3
  fullRoundTrip:        500,   // R11.1.2
  tabRender:            100,   // R11.1.1
  integritySweep:       100    // SPEC §S11.3 V-PERF-6
});
