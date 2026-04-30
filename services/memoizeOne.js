// services/memoizeOne.js — v3.0 · SPEC sec S5.1.2
//
// Single-cache memoization. Caches the last (args, result) pair. If the
// next call's args are equal-by-the-equality-fn to the previous args,
// returns the cached result; otherwise re-computes.
//
// Behaviorally identical to the npm `memoize-one` package; vendored
// inline (~20 lines) to avoid another import-map entry. Per SPEC sec
// S5.1.3, ESLint forbids importing reselect/proxy-memoize/lodash.memoize/
// nano-memoize from selectors/ — memoize-one (or this equivalent) is
// the only sanctioned memoization tool.
//
// Default equality: shallow strict-equality across all args. Selectors
// pass a custom equality if they need to compare e.g. only the first
// arg by reference + the second arg by deep-shape (rare).
//
// Contract:
//   - First call computes + caches.
//   - Subsequent call with isEqual(args, prevArgs) === true returns
//     cached result (NEW WORK NOT DONE — selector hot-path budget).
//   - Subsequent call with isEqual === false re-computes + replaces cache.
//
// Stable-output guarantee: a function that produces different output
// for the same input on two consecutive calls violates SPEC S5.1.4.
// memoizeOne does not detect this; the V-SEL-PURE-* vectors do.

function defaultIsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function memoizeOne(fn, isEqual = defaultIsEqual) {
  let prevArgs = null;
  let prevResult = null;
  let hasCached = false;
  return function memoized(...args) {
    if (hasCached && isEqual(args, prevArgs)) {
      return prevResult;
    }
    prevResult = fn.apply(this, args);
    prevArgs = args;
    hasCached = true;
    return prevResult;
  };
}
