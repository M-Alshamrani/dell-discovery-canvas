# Dell Discovery Canvas

**IT / Enterprise Architecture Discovery Tool for Dell Presales**
Version 2.4.11 · Vanilla JavaScript ES Modules · No build step required

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

### Docker (shared Linux hosts)

```bash
docker compose up -d --build
```

Open http://localhost:8080. Localhost-only by default. For LAN exposure with HTTP Basic auth (v2.2.1+):

```bash
AUTH_USERNAME=<your-username> AUTH_PASSWORD=<strong-password> BIND_ADDR=0.0.0.0 docker compose up -d --build
```

See [HOW_TO_RUN.md § Option C](HOW_TO_RUN.md) for full guidance.

---

## What this tool does

Runs 30–45 minute customer workshops:

1. **Context** — capture the customer's identity and the **strategic drivers** they care about (8-item Gartner-aligned catalog, per-driver priority + business outcomes).
2. **Current State** — map what the customer runs today across 5 layers × 4 environments.
3. **Desired State** — set an action per current tile (Keep / Enhance / Replace / Consolidate / Retire / Operational / Introduce) or add net-new items.
4. **Gaps** — auto-drafted initiatives bridging current → desired, organised as a phase-kanban with strategic-driver assignment and review approvals.
5. **Reporting** — Overview (Coverage + Risk posture + Session Brief) · Heatmap · Gaps Board · Vendor Mix · **Roadmap** (Programs × Phases swimlane grid — the crown jewel).

At the end: a CxO-ready roadmap with Programs (strategic drivers), Projects (auto-grouped by environment + layer + action type), and Phases (Now / Next / Later). Everything derives from data captured in Tabs 1–4.

---

## Project layout

```
dell-discovery/
  index.html              entry point
  app.js                  5-step router + .canvas file launchQueue handler
  styles.css              design system
  manifest.json           PWA manifest (v2.4.10 — .canvas file_handlers)
  core/
    config.js             LAYERS, ENVIRONMENTS, CATALOG, BUSINESS_DRIVERS, CUSTOMER_VERTICALS
    models.js             validateInstance, validateGap (primary-layer invariant)
    taxonomy.js           7-term Action table (Phase 17) + validateActionLinks
    helpContent.js        contextual help prose
    sessionEvents.js      pub/sub bus — onSessionChanged / emitSessionChanged
    fieldManifest.js      per-tab bindable-field manifest (writable: true gating)
    bindingResolvers.js   WRITE_RESOLVERS for context.* AI writes (13 resolvers)
    promptGuards.js       responseFormat-aware system-prompt footers
    aiConfig.js           AI provider config + fallback chains
    skillStore.js         user-defined skills CRUD (ai_skills_v1)
    seedSkills.js         6 seed skills across all 5 tabs
    version.js            app version constant
  state/
    sessionStore.js       session singleton + localStorage + migration
    demoSession.js        Acme FSI demo persona + DEMO_PERSONAS
    aiUndoStack.js        persistent undo stack (ai_undo_v1, cap 10)
  services/               pure read-only
    healthMetrics.js      heatmap scoring
    gapsService.js        gap filtering
    vendorMixService.js   vendor-group aggregation
    roadmapService.js     buildProjects · Coverage · Risk · Session Brief
    programsService.js    driver suggestion ladder · effective Dell solutions
    aiService.js          chat-completion router + retry/backoff/fallback chain
    skillEngine.js        renderTemplate · runSkill · per-skill provider override
    sessionFile.js        .canvas envelope build/apply (v2.4.10)
  interactions/           the only modules that write session
    matrixCommands.js     addInstance, updateInstance, deleteInstance, mapAsset, unmapAsset
    gapsCommands.js       createGap, updateGap, deleteGap, approveGap, link/unlink
    desiredStateSync.js   action → gap auto-draft, phase-sync, confirmPhaseOnLink
    aiCommands.js         parseProposals · applyProposal · applyAllProposals
    skillCommands.js      runSkillById · skillsForTab dispatch
  ui/
    icons.js              inline-SVG helpers
    components/
      UseAiButton.js      tab-agnostic "✨ Use AI ▾" dropdown
      PillEditor.js       contenteditable binding-pill editor (v2.4.2.1)
    views/
      ContextView.js           Tab 1 · drivers + per-driver detail
      MatrixView.js            Tabs 2 + 3 · current/desired matrix + workload mapping
      GapsEditView.js          Tab 4 · gap kanban + detail + auto-draft
      ReportingView.js         Tab 5 · Overview
      SummaryHealthView.js     Tab 5 · Heatmap
      SummaryGapsView.js       Tab 5 · Gaps Board
      SummaryVendorView.js     Tab 5 · Vendor Mix
      SummaryRoadmapView.js    Tab 5 · Roadmap (the crown jewel)
      SettingsModal.js         gear icon · provider config + skills admin
      SkillAdmin.js            skill CRUD + pill-binding editor
      HelpModal.js             contextual help overlay
  diagnostics/
    testRunner.js         minimal in-browser test framework + runIsolated guard
    appSpec.js            the contract — 487 assertions across 36+ suites
    demoSpec.js           demo-surface assertions — 22 assertions (DS1-DS22)
  docker-entrypoint.d/
    40-setup-auth.sh      optional Basic auth via env vars
    45-setup-llm-proxy.sh LLM reverse-proxy snippet generator
  Logo/
    delltech-logo-stk-blue-rgb.avif
  SPEC.md                 authoritative v2 implementation spec
  HANDOFF.md              session-handoff state (read first in fresh sessions)
  docs/
    CHANGELOG_PLAN.md     planning + discussion trail (working doc)
    DEMO_CHANGELOG.md     demo-surface audit trail (per two-surface rule)
    RULES.md              rules-as-built audit (90+ rules tagged HARD/SOFT/AUTO/MIGRATE)
    PHASE_17_MIGRATION_PLAN.md  Phase 17 migration plan (shipped as v2.4.8)
    MAINTENANCE_LOG.md    .dNN hygiene-pass log (one entry per pass)
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
- **Green** = all 509 assertions passing (487 in `appSpec.js` + 22 in `demoSpec.js`).
- **Red** = check DevTools console for the failing assertion text.

Before committing any change: refresh the browser and confirm green. Never weaken a test to make it pass. Since v2.4.11, every functional tag also requires a manual Chrome-MCP browser smoke against a verification spec — see `feedback_browser_smoke_required.md` in the auto-memory tree.

---

## Data lives in the browser

Session state persists to `localStorage` under key `dell_discovery_v1`. Data stays on the user's device — no server, no cloud. Use "Export JSON" in the footer to save a session file. Reload "Load demo" to reset to the built-in demo customer (Acme Financial Services) for training.

---

## Version history

- **v2.4.11** (2026-04-25) — Phase 19k: Rules Hardening + Visible-Rules UX. Five locked design principles (Draft permissive / Review enforced; status:closed not delete; auto-behaviour visible; rules from one place; workshop flow > ideal data shape). Review-time `validateActionLinks` enforcement. STRUCTURAL-vs-METADATA distinction in `updateGap` so metadata patches no longer trip link rules on imperfect auto-drafts. `gap.urgencyOverride` boolean pins urgency against propagation rules P4/P7. Auto-draft toast + "Review all →" button + closed-vs-deleted gaps + visible "🔒 manually set / ↺ auto" indicator. Workshop-friendly error messages. New `docs/RULES.md` audit (90 rules tagged 🔴HARD/🟡SOFT/🔵AUTO/📦MIGRATE). 21 spec items + 3 in-flight bug fixes (urgency-lock silent-fail, demo g-004 mis-typed Replace, Save button feedback states) — all caught by mandatory Chrome-MCP browser smoke. Suite 42 RH1-RH20 + DS22; 509 tests green.
- **v2.4.10.1** (2026-04-25) — HOTFIX: test-runner `localStorage` isolation. `runIsolated(run, restoreCallback)` snapshots every storage key before tests, run-then-finally restores. v2.4.5 → v2.4.10 had a silent bug where test passes polluted real `localStorage` with synthetic data ("Bus Co", "Round-trip Co", etc.) that the next page load picked up.
- **v2.4.10** (2026-04-24) — Phase 19j: user-owned save/open `.canvas` workbook file. File System Access API (Chrome / Edge) with `<input type=file>` fallback elsewhere. PWA manifest registers `application/vnd.delltech.canvas+json` as a `file_handlers` association so double-click opens the app. Round-trip preserves migrator coverage (imported sessions run through `migrateLegacySession`). Suite 41 SF1-SF11.
- **v2.4.9** (2026-04-24) — primary-layer invariant + explicit `gap.projectId`. `affectedLayers[0] === gap.layerId` enforced by `validateGap`; `setPrimaryLayer` is the only safe mutator. `deriveProjectId(gap)` replaces silent `buildProjects` bucketing — every gap stores its project assignment. Migrator backfills both. Pre-crown-jewel rollback anchor.
- **v2.4.8** (2026-04-24) — Phase 17: taxonomy unification. UI label "Disposition" → "Action" across all views. 7-term Action table (`keep / enhance / replace / consolidate / retire / introduce / ops`) lives in `core/taxonomy.js`. Migrator coerces legacy `gap.gapType: rationalize` → `ops` and `instance.disposition: rationalize` → `retire` idempotently. Mandatory action-link rules enforced on reviewed gaps via `validateActionLinks`. Suite 39 TX1-TX10 + DS18-DS22.
- **v2.4.7** (2026-04-24) — Phase 19h: fresh-start UX. `createEmptySession()` is now the first-run default (was demo). `isFreshSession(s)` predicate gates the welcome card on Tab 1 with two CTAs ("↺ Load demo" / "Start fresh"). Footer "↺ Load demo" stays as the persistent affordance.
- **v2.4.6** (2026-04-24) — auto-dismiss test banner after 5s on green; failure banner stays sticky. UX quick-wins.
- **v2.4.5.1** (2026-04-24) — Phase 19f: AI reliability. Anthropic `anthropic-dangerous-direct-browser-access: true` header (fixes the 401 loop on browser-direct calls). Retry-with-backoff on 429/5xx (3 attempts, 500ms→4s with full jitter). Per-provider `fallbackModels[]` chain. Settings UI exposes the chain; "Test connection" reports which model answered (Suite 36 RB1-RB7).
- **v2.4.5** (2026-04-24) — Phase 19e: Foundations Refresh. NEW `core/sessionEvents.js` pub/sub bus → driver tile no longer vanishes on AI apply; tab no longer blanks after undo. Persistent `ai_undo_v1` (cap 10, cleared on reset). Demo session extracted to `state/demoSession.js` with 3 personas (Acme FSI, Meridian HLS, Northwind Public Sector). Seed skill library of 6 across all 5 tabs. NEW `diagnostics/demoSpec.js` Suites 31-35 + `docs/DEMO_CHANGELOG.md`. Codified the two-surface testing rule (`feedback_foundational_testing.md`).
- **v2.4.4** (2026-04-24) — Phase 19d: Unified AI platform. SPEC §12 formalises the data model: `responseFormat` (text-brief / json-scalars / json-commands) + `applyPolicy` (show-only / confirm-per-field / confirm-all / auto) replace the overlapping `outputMode` + `outputSchema` dispatch. Every writable path declared via `FIELD_MANIFEST.writable` + `core/bindingResolvers.js` (13 resolvers for drivers/instances/gaps). Apply-on-confirm proposals panel with Apply/Skip/Apply-all per `applyPolicy`. In-memory undo stack (max 10). Per-skill provider override. Action-commands schema locked for v2.6.0+. Suite 30 adds 17 OH* assertions; 416+ tests green. Known UX gaps explicitly queued for v2.4.5 Foundations Refresh.
- **v2.4.3** (2026-04-19) — Phase 19d.1: Prompt quality guardrails. Mandatory output-format footer (≤120 words, terse bullets, no preamble) appended to every skill's system prompt at run time — kills the "long article" response pattern. "✨ Refine to CARE format" button (Context / Ask / Rules / Examples) AI-rewrites user drafts with side-by-side diff (Accept / Keep / Edit). Save button disabled until a successful test matches the current draft — forces the iteration loop. Mode-aware architecture: text-brief today; json-schema (v2.4.4) and action-commands (v2.4.5+) declared ready. Suite 29 adds 6 PG* assertions; banner now 399/399 green.
- **v2.4.2.1** (2026-04-19) — Phase 19c.1: Pill-based binding editor. Template textarea in the skill builder replaced with a contenteditable editor hosting inline uneditable pill elements for each binding. Click a field chip → pill appears; Backspace → pill removed as a unit (no partial `{{path}}` corruption). Blue scalars, amber arrays, italic bare (Alt-inserted). Error messages now categorise HTTP status — 401/403 points to the API-key field, 5xx calls out upstream-transient. Suite 28 adds 7 PE* tests; banner 393/393 green.
- **v2.4.2** (2026-04-19) — Phase 19c: Field-pointer mechanic + LLM-friendly coercion + test-skill. Per-tab manifest of bindable fields; clicking a chip inserts `Label: {{path}}` at the cursor (Alt-click for bare), so presales don't have to type or memorise dot-paths. Live template preview renders against current session. "Test skill now" button dry-runs the draft for iteration. Array/object bindings now serialise as pretty-printed JSON (soft-capped at 1200 chars) so the LLM gets readable content, not `[object Object]`. Suite 27 adds 9 FP* assertions; banner now 386/386 green.
- **v2.4.1** (2026-04-19) — Phase 19b: Skill Builder. The v2.4.0 hardcoded button becomes a platform. Gear icon → Skills section lists saved skills; `+ Add skill` form lets presales define name, target tab, AI role / instructions, data template (`{{session.*}}` + `{{context.*}}` bindings), output mode. Every tab hosts a `"✨ Use AI ▾"` dropdown of its deployed skills. On first run, a seed skill (Tab 1 driver-question assistant, deployed) keeps v2.4.0 Tab 1 behaviour working unchanged. Suite 26 adds 8 SB* assertions; banner now 377/377 green.
- **v2.4.0** (2026-04-19) — Phase 19a: AI foundations. Three-provider client (local vLLM / Anthropic Claude / Google Gemini) reached via nginx reverse-proxy (avoids CORS). Gear icon in header → settings modal with per-provider endpoint/model/API-key + connection-test probe. One demo skill on Tab 1 ("Suggest discovery questions" button on each driver) that calls the active provider and renders the response. Real Anthropic + Gemini calls verified end-to-end. Deprecated Gemini model auto-migrates (`gemini-2.0-flash` → `gemini-2.5-flash`) on load. API keys live in browser localStorage for now; v3 will move them server-side. Suite 25 adds 10 AI* assertions; banner now 369/369 green.
- **v2.2.3** (2026-04-19) — Phase 15.3: Visual depth. Radii 6/10/14 → 4/6/10 (sharper corners). Global heading hardening (font-weight: 700 + letter-spacing: -0.01em). JetBrains Mono with tabular-nums on Roadmap project-card metric badges. Body antialiasing so Inter renders crisp.
- **v2.2.2** (2026-04-19) — Phase 15.2: Dell brand-token refresh. CSS variable VALUES updated to Dell official palette (Dell Blue `#0076CE`, ink `#0B2A4A`, cooler greys, ink-tinted shadows). Header gradient updated to Dell deep→blue. Typography swapped from DM Sans + DM Mono → Inter + JetBrains Mono (matches the GPLC reference). Variable NAMES preserved across all components — zero component-CSS rewrites, zero behavioural change. 359/359 tests still green.
- **v2.3.1** (2026-04-19) — Phase 16: Workload Mapping. New `workload` layer at the top of the matrix; 14 catalog entries (Dell Validated Designs, business apps, industry verticals, data/analytics, application footprints). Workload tiles get a "Mapped infrastructure" panel: map any number of other-layer assets (N-to-N), then click "↑ Propagate criticality" to walk per-asset confirms upgrading any asset with lower criticality than the workload. Upward-only by design — never silently downgrades. New W1-W5 assertions; banner now 358/358 green.
- **v2.3.0** (2026-04-19) — Phase 18: gap-link surfacing & double-link safety. Linked current + desired technologies render inline in the gap detail panel (no more `Manage links` collapse). Link picker shows a yellow warning row above any candidate already linked to another gap; selection still proceeds (warn-but-allow). Asset rows show a red `linked to N gaps` chip when shared. Roadmap project counts unique linked technologies (no double-counting from multi-linked assets). New T8.* assertions; T6.13 (Manage-links collapse) retired since the feature is gone; banner now 352/352 green. `.gitattributes` enforces LF endings on container plumbing.
- **v2.2.1** (2026-04-19) — Phase 15.1: LAN gating. Optional HTTP Basic auth driven by `AUTH_USERNAME` + `AUTH_PASSWORD` env vars; htpasswd generated at container start via `apache2-utils`. `/health` stays open for monitoring. Backward-compatible — unset env vars = no auth (same as v2.2.0).
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

*Dell Technologies Presales · Internal tool · v2.4.11*
