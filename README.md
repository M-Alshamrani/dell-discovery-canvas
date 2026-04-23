# Dell Discovery Canvas

**IT / Enterprise Architecture Discovery Tool for Dell Presales**
Version 2.2.0 · Vanilla JavaScript ES Modules · No build step required

---

## Quick start

### Easy path (reviewers & non-developers)

Windows: double-click **`start.bat`**. macOS / Linux: run **`./start.sh`** in a terminal.

The script checks for Python, launches a local server, and opens your browser. Full step-by-step with troubleshooting: **[HOW_TO_RUN.md](HOW_TO_RUN.md)**.

### Manual (developers)

```bash
python -m http.server 8000
```

Open http://localhost:8000 — that's it. No npm, no bundler, no dependencies.

> **Why a server?** ES module imports don't work on `file://` URLs. Any static server will do — Python's built-in is simplest. `npx serve .` also works if you have Node installed.

### Docker (shared hosts, Dell GB10)

```bash
docker compose up -d --build
```

Open http://localhost:8080. Localhost-only by default; opt into LAN exposure with `BIND_ADDR=0.0.0.0 docker compose up -d`. See [HOW_TO_RUN.md § Option C](HOW_TO_RUN.md) for full guidance.

---

## What this tool does

Runs 30–45 minute customer workshops:

1. **Context** — capture the customer's identity and the **strategic drivers** they care about (8-item Gartner-aligned catalog, per-driver priority + business outcomes).
2. **Current State** — map what the customer runs today across 5 layers × 4 environments.
3. **Desired State** — set a disposition per current tile (Keep / Enhance / Replace / Consolidate / Retire / Operational) or add net-new items.
4. **Gaps** — auto-drafted initiatives bridging current → desired, organised as a phase-kanban with strategic-driver assignment and review approvals.
5. **Reporting** — Overview (Coverage + Risk posture + Session Brief) · Heatmap · Gaps Board · Vendor Mix · **Roadmap** (Programs × Phases swimlane grid — the crown jewel).

At the end: a CxO-ready roadmap with Programs (strategic drivers), Projects (auto-grouped by environment + layer + action type), and Phases (Now / Next / Later). Everything derives from data captured in Tabs 1–4.

---

## Project layout

```
dell-discovery/
  index.html              entry point
  app.js                  5-step router
  styles.css              design system
  core/
    config.js             LAYERS, ENVIRONMENTS, CATALOG, BUSINESS_DRIVERS, CUSTOMER_VERTICALS
    models.js             validateInstance, validateGap
    helpContent.js        contextual help prose
  state/
    sessionStore.js       session singleton + localStorage + migration
  services/               pure read-only
    healthMetrics.js      heatmap scoring
    gapsService.js        gap filtering
    vendorMixService.js   vendor-group aggregation
    roadmapService.js     buildProjects · Coverage · Risk · Session Brief
    programsService.js    strategic driver suggestion · effective Dell solutions
  interactions/           the only modules that write session
    matrixCommands.js     addInstance, updateInstance, deleteInstance, moveInstance
    gapsCommands.js       createGap, updateGap, deleteGap, approveGap, setGapDriverId, link/unlink
    desiredStateSync.js   disposition → gap, phase-sync helpers, confirmPhaseOnLink
  ui/
    icons.js              inline-SVG helpers (chain, chevron, help, stars)
    views/
      ContextView.js           Tab 1
      MatrixView.js            Tabs 2 + 3
      GapsEditView.js          Tab 4
      ReportingView.js         Tab 5 · Overview
      SummaryHealthView.js     Tab 5 · Heatmap
      SummaryGapsView.js       Tab 5 · Gaps Board
      SummaryVendorView.js     Tab 5 · Vendor Mix
      SummaryRoadmapView.js    Tab 5 · Roadmap
      HelpModal.js             contextual help overlay
  diagnostics/
    testRunner.js         minimal in-browser test framework
    appSpec.js            the contract — ~240 assertions across 22 suites
  Logo/
    delltech-logo-stk-blue-rgb.avif
  SPEC.md                 authoritative v2 implementation spec
  docs/CHANGELOG_PLAN.md       planning + discussion trail (working doc)
```

---

## Architecture invariants

1. Only `interactions/` writes to session state.
2. `services/` are pure reads — never mutate.
3. Every gap validates before save (hard-block on required fields).
4. All state is JSON-serialisable — AI agents can read/write without special-casing.
5. `diagnostics/appSpec.js` is the contract. Failing test = fix the implementation, not the test.

Full detail: **[SPEC.md](SPEC.md)**. Discussion log: **[docs/CHANGELOG_PLAN.md](docs/CHANGELOG_PLAN.md)**.

---

## Test suite

Tests run automatically in the browser 150 ms after page load. Banner at top:
- **Green** = all ~240 assertions passing.
- **Red** = check DevTools console for the failing assertion text.

Before committing any change: refresh the browser and confirm green. Never weaken a test to make it pass.

---

## Data lives in the browser

Session state persists to `localStorage` under key `dell_discovery_v1`. Data stays on the user's device — no server, no cloud. Use "Export JSON" in the footer to save a session file. Reload "Load demo" to reset to the built-in demo customer (Acme Financial Services) for training.

---

## Version history

- **v2.2.0** (2026-04-19) — Phase 15: Docker containerisation. `nginx:alpine` static-file image with hardened headers, multi-arch (linux/amd64 + linux/arm64 for Dell GB10 / Grace), localhost-only binding by default, opt-in LAN exposure via `BIND_ADDR`, configurable host port (default 8080 to avoid the GB10's vLLM containers).
- **v2.1.2** (2026-04-19) — Reviewer-handoff scripts (`start.bat`, `start.sh`, `HOW_TO_RUN.md`) plus noindex safety net.
- **v2.1.1** (2026-04-18) — Right-panel drill-downs, Session Brief, Roadmap click unification, SVG icons, contextual help modal, review flag.
- **v2.1** (2026-04-18) — Coverage + Risk panels (replaced single health score), auto-drafted-gap review flow, vendor-picker on custom add, Dell-solutions derivation from linked tiles.
- **v2.0** (2026-04-18) — Strategic Drivers (Tab 1 rewrite), environment-aware catalog, criticality accent carry-through, Phase rename + sync, Programs/Projects hierarchy in Roadmap.
- **v1.3** (pre-cutover) — Initial shipped version with 5-step flow.

---

## Contributing

This is a private internal Dell presales tool. All non-trivial changes go through:

1. Raise the change in `docs/CHANGELOG_PLAN.md` as **PROPOSED**.
2. Get decisions locked with stakeholders.
3. Mirror any data-model / UX / test-inventory changes into `SPEC.md`.
4. Implement plus new assertions in `appSpec.js`.
5. Verify green banner before committing.

---

*Dell Technologies Presales · Internal tool · v2.2.0*
