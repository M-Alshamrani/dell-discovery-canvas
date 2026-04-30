// diagnostics/testRunner.js — minimal in-browser test framework
//
// v2.4.10.1 · isolation guard. Tests routinely call replaceSession() +
// applyProposal() with synthetic data; applyProposal calls
// saveToLocalStorage() under the hood, which means a single test pass
// can persist test data ("Bus Co", "Round-trip Co", etc.) into the
// real localStorage. On the next page load, sessionStore's IIFE reads
// that polluted localStorage and the user sees test data instead of
// their own session. v2.4.5–v2.4.10 shipped with this bug.
//
// The fix below: any caller can wrap their `run()` call in
// `runIsolated(run, restoreCallback)`. We snapshot every localStorage
// key before tests, run them, then ALWAYS restore the original keys
// (try/finally, even if a test throws). The optional restoreCallback
// runs after the storage restore so callers can also reload in-memory
// state from the freshly-restored localStorage and emit a
// session-changed so the UI re-renders the user's REAL data.

// v3.0 · runIsolated is async because run() is now async (test bodies
// can return Promises so async features like SPEC sec S6.1 catalog
// loading can be tested directly). The `finally` block awaits run()
// before restoring localStorage, ensuring async tests see the
// pre-snapshot state until they complete.
export async function runIsolated(run, restoreCallback) {
  // Snapshot every storage key.
  var snapshot = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k != null) snapshot[k] = localStorage.getItem(k);
    }
  } catch (e) { /* private mode etc. — best-effort */ }

  try {
    return await run();
  } finally {
    // Restore: wipe any test-side keys, then re-write the snapshot.
    try {
      localStorage.clear();
      Object.keys(snapshot).forEach(function(k) {
        localStorage.setItem(k, snapshot[k]);
      });
    } catch (e) { /* best-effort */ }
    if (typeof restoreCallback === "function") {
      try { restoreCallback(); } catch (e) { /* don't let cleanup throw */ }
    }
  }
}

export function createTestRunner() {
  const suites = [];
  let current  = null;

  function describe(name, fn) {
    const suite = { name, tests: [] };
    suites.push(suite);
    const prev = current; current = suite;
    try { fn(); } finally { current = prev; }
  }

  function it(name, fn) {
    if (!current) throw new Error("it() called outside describe()");
    current.tests.push({ name, fn });
  }

  function assert(cond, msg) {
    if (!cond) throw Object.assign(new Error(msg || "Assertion failed"), {});
  }

  function assertEqual(a, b, msg) {
    if (a !== b) throw new Error(`${msg || "Expected equal"} (expected: ${b}, actual: ${a})`);
  }

  // v3.0 · async to support test bodies that return Promises (e.g.
  // SPEC sec S6.1.2's loadCatalog Promise<Catalog> contract). Sync test
  // bodies still work — `await test.fn()` on a non-Promise return value
  // is a no-op (resolves to the same value).
  async function run() {
    const results = { suites: [], total: 0, passed: 0, failed: 0 };
    console.group("[Tests] Dell Discovery Canvas");
    for (const suite of suites) {
      const sr = { name: suite.name, tests: [] };
      results.suites.push(sr);
      console.group(`Suite: ${suite.name}`);
      for (const test of suite.tests) {
        results.total++;
        try {
          await test.fn();
          sr.tests.push({ name: test.name, status: "passed" });
          results.passed++;
          console.log(`  ✅  ${test.name}`);
        } catch(e) {
          sr.tests.push({ name: test.name, status: "failed", error: e });
          results.failed++;
          console.error(`  ❌  ${test.name}`, e.message);
        }
      }
      console.groupEnd();
    }
    console.log(`\n[Tests] ${results.passed}/${results.total} passed${results.failed ? ` · ${results.failed} failed` : " ✅"}`);
    console.groupEnd();
    renderBanner(results);
    return results;
  }

  function renderBanner(results) {
    document.getElementById("test-banner")?.remove();
    const banner = document.createElement("div");
    banner.id = "test-banner";
    const passed = results.failed === 0;
    Object.assign(banner.style, {
      position:"fixed", bottom:"0", left:"0", right:"0", zIndex:"9999",
      padding:"6px 20px", fontSize:"11px", display:"flex",
      justifyContent:"space-between", alignItems:"center",
      background: passed ? "#DCFCE7" : "#FEE2E2",
      borderTop: `1px solid ${passed ? "#86EFAC" : "#FCA5A5"}`,
      color: "#111827",
      transition: "opacity 400ms ease-out, transform 400ms ease-out"
    });
    banner.textContent = passed
      ? `✅  All ${results.passed} tests passed`
      : `⚠  ${results.failed} test(s) failed, ${results.passed} passed — see console for details`;
    const x = document.createElement("span");
    x.textContent = "✕"; x.style.cursor = "pointer"; x.style.marginLeft = "16px";
    x.addEventListener("click", () => banner.remove());
    banner.appendChild(x);
    document.body.appendChild(banner);

    // v2.4.6 · U3 · auto-dismiss the green banner after 5s. Failure
    // banner stays sticky until the user clicks ✕ — they need to act
    // on it. Setter exposed on the banner so tests can cancel the
    // timer deterministically.
    if (passed) {
      banner.dataset.autoDismissMs = "5000";
      banner._autoDismissTimer = setTimeout(() => {
        if (!document.body.contains(banner)) return;
        banner.style.opacity = "0";
        banner.style.transform = "translateY(8px)";
        setTimeout(() => banner.remove(), 450);
      }, 5000);
    }
  }

  return { describe, it, assert, assertEqual, run };
}
