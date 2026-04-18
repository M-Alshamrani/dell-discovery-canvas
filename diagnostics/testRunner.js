// diagnostics/testRunner.js — minimal in-browser test framework

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

  function run() {
    const results = { suites: [], total: 0, passed: 0, failed: 0 };
    console.group("[Tests] Dell Discovery Canvas");
    suites.forEach(suite => {
      const sr = { name: suite.name, tests: [] };
      results.suites.push(sr);
      console.group(`Suite: ${suite.name}`);
      suite.tests.forEach(test => {
        results.total++;
        try {
          test.fn();
          sr.tests.push({ name: test.name, status: "passed" });
          results.passed++;
          console.log(`  ✅  ${test.name}`);
        } catch(e) {
          sr.tests.push({ name: test.name, status: "failed", error: e });
          results.failed++;
          console.error(`  ❌  ${test.name}`, e.message);
        }
      });
      console.groupEnd();
    });
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
      color: "#111827"
    });
    banner.textContent = passed
      ? `✅  All ${results.passed} tests passed`
      : `⚠  ${results.failed} test(s) failed, ${results.passed} passed — see console for details`;
    const x = document.createElement("span");
    x.textContent = "✕"; x.style.cursor = "pointer"; x.style.marginLeft = "16px";
    x.addEventListener("click", () => banner.remove());
    banner.appendChild(x);
    document.body.appendChild(banner);
  }

  return { describe, it, assert, assertEqual, run };
}
