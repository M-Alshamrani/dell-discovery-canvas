# Demo module changelog

Audit trail for the **human-facing test surface** — the demo session and
the seed AI skill library. Separate from the main `CHANGELOG_PLAN.md`
because the demo surface must track the data model in lockstep; drift
here is what caused v2.4.4's UX bugs (see
`feedback_foundational_testing.md`).

Every data-model change (add / rename / remove a field on instances,
gaps, drivers, or session metadata) must, in the **same commit**:

1. Update `state/demoSession.js` to exercise the new/renamed field.
2. Update or add a seed skill in `core/seedSkills.js` that demonstrates
   the new capability.
3. Update `diagnostics/demoSpec.js` with an assertion pinning the new
   shape.
4. Log the change here with version, date, and the surfaces touched.

---

## v2.4.15 · 2026-04-28 · Dynamic environments (city-named demo + metadata)

**Status**: shipped (Phase 19m / v2.4.15).

### What changed for the demo surface

The dynamic environment model lands in this release. The demo session's
4 environments are now first-class entries in `session.environments[]`
with realistic metadata so the matrix / heatmap / report read like a
customer document instead of a template.

| envId | alias | location | sizeKw | sqm | tier | notes |
|---|---|---|---|---|---|---|
| `coreDc` | Riyadh DC | Riyadh, KSA | 5 | 320 | Tier III | Primary on-prem site. Hosts core banking + most compute + storage. |
| `drDc` | Jeddah DR | Jeddah, KSA | 2 | 140 | Tier II | Warm-standby DR with replicated storage + cyber recovery vault. |
| `publicCloud` | AWS me-south-1 | Bahrain region | – | – | Public | AWS region for non-regulated burst workloads + cloud-only services. |
| `edge` | Branch sites x14 | KSA + GCC | – | – | N/A | 14 branch / retail edge sites running ruggedized infra + SD-WAN. |

All four envs ship with `hidden: false`. Existing instance / gap refs
to `coreDc` / `drDc` / `publicCloud` / `edge` are unchanged — only
the labels users see flip from the legacy "Core DC" / "DR / Secondary
DC" / "Public Cloud" / "Edge / Remote" to the cleaner v2.4.15 catalog
labels via `getEnvLabel`.

The migrator drains any v2.4.14 `environmentAliases` map into the new
per-env `alias` field on first load, so saved `.canvas` files from
v2.4.14 will display "Riyadh DC" etc. without manual intervention.

This is the **minimal §DE9 demo update** — content overhaul (new
gaps, refreshed personas, exec-grade narrative) stays scheduled for
v2.4.17 per the v2.4.15 spec.

---

## v2.4.12 · 2026-04-26 · Services scope + pre-flight regression fixes

**Status**: shipped (Phase 19l).

### What changed for the demo surface

- **NEW gap field `services: string[]`** (optional multi-select). Catalog of 10 professional-services categories in `core/services.js`: assessment, migration, deployment, integration, training, knowledge_transfer, runbook, managed, decommissioning, custom_dev. Validated by `validateGap`; normalized (drop unknowns + dedupe) by `normalizeServices` in `createGap`/`updateGap` and in the `WRITE_RESOLVERS` entry.
- **Demo gaps refreshed** with realistic `services` arrays:
  - `g-001` (replace · PowerProtect) → `["migration", "deployment", "training", "runbook"]`
  - `g-002` (replace · PowerStore) → `["migration", "deployment"]`
  - `g-003` (replace · VxRail) → `["assessment", "migration", "deployment", "training"]`
  - `g-004` (consolidate) → `["migration", "integration", "knowledge_transfer", "decommissioning"]`
  - `g-005` (ops · cloud governance) → `["assessment", "runbook", "managed"]`
  - `g-006` (enhance · DP convergence) → `["assessment"]`
  - `g-007` (introduce · AI/RAG) → `["assessment", "deployment", "training", "custom_dev"]`
- **NEW seed skill `skill-gap-services-suggester-seed`** — Tab 4 / json-scalars. Asks the AI to recommend the services scope from the fixed catalog based on gapType + notes; the WRITE_RESOLVER for `context.selectedGap.services` accepts comma-separated strings OR JSON arrays and normalizes through `normalizeServices`.
- **NEW `FIELD_MANIFEST` entry** `context.selectedGap.services` (writable, kind `array`) and matching `WRITE_RESOLVERS` entry.
- **demoSpec DS23** asserts every demo gap with `gapType ∈ {replace, consolidate, introduce}` has `services.length ≥ 1` so the chip UI is exercisable from Load demo.

### Removed from the human surface

- **`+ Add operational / services gap` CTA** (the v2.4.11 D2 button) is gone (Section U1). Services attach to any gap as a multi-chip facet — a dedicated ops-typed gap entry-point reinforced a wrong mental model.

### Pre-flight regression fixes (bundled into the same release)

- **PR1** `state/sessionStore.js applyContextSave(patch)` — new pure helper that compares each patch field to the current session value and only flips `isDemo: false` when something actually changed. ContextView "Save context" now calls this helper instead of mutating `session` directly. **Fixes** the v2.4.11 latent bug where any Save click flipped `isDemo` and the demo banner disappeared on refresh (validated live 2026-04-26 before fix).
- **PR2** NEW `core/skillsEvents.js` (mirrors `core/sessionEvents.js`). `skillStore.addSkill / updateSkill / deleteSkill` now emit `skills-changed`. `UseAiButton.js` subscribes via `onSkillsChanged` with a self-cleanup pattern (`wrap.isConnected`-guard) so the per-tab AI dropdown auto-refreshes when skills are added / deployed / reassigned, without requiring a tab switch. Skill Builder admin panel + per-skill provider override controls are unaffected.

### Why this matters for the demo surface

The "engagement shape" question is the workshop deliverable v2.4.11 didn't capture. Customers ask "ok, how do we actually do this" and the presales engineer needed something more structured than free-text notes. v2.4.12 closes that gap with a single optional facet + a Reporting roll-up sub-tab.

PR1 and PR2 are bundled because both surfaced during the v2.4.12 attempt that was rolled back 2026-04-26. The new spec-and-test-first discipline (and the explicit Section R regression-guard smoke checklist in `docs/CHANGELOG_PLAN.md § v2.4.12`) ensures bugs caught in browser smoke don't ship.

---

## v2.4.11 · 2026-04-25 · Rules hardening + relationships polish

**Status**: shipped (Phase 19k).

### What changed for the demo surface

- **NEW gap field `urgencyOverride: boolean`** (default false). When true, propagation rules P4/P7 skip the gap so user-pinned urgency stays put. Migrator (M10) defaults all legacy gaps to `false`.
- **Demo `g-005` `urgencyOverride: true`** (and urgency raised to "High"). Exercises the lock+auto toggle in the gap detail UI from Load demo, so DS22 has a target.
- **Demo `g-004` retyped from `replace` → `consolidate`** + description updated. The original 2-current → 1-desired shape is semantically Consolidate (merging PowerEdge + HPE onto Dell PowerEdge); the rule v2.4.11 enforces (Replace = exactly 1 current) caught the mismatch.
- **demoSpec DS22** asserts at least one demo gap has `urgencyOverride: true` so the override toggle stays visible from Load demo across future refactors.

### Why this matters for the demo surface

Two pre-existing bugs surfaced once v2.4.11 enforced action-link rules at review time:
1. The lock button on urgency was silently failing (because every `updateGap` re-ran link validation, even on metadata-only patches like the urgencyOverride toggle).
2. Demo `g-004` violated the Replace 1-to-1 rule with its 2-current-1-desired shape.

Both are fixed. The lesson written into `feedback_browser_smoke_required.md` (new memory): **every tag MUST include a manual browser smoke against the verification spec before commit.** Tests pass + manual smoke = ship. Tests pass alone = NOT enough.

---

## v2.4.10 · 2026-04-24 · User-owned save/open file (.canvas workbook)

**Status**: shipped (Phase 19j). No data-model changes.

### What changed for the demo surface

- **Demo data unchanged.** `createDemoSession()` output is byte-identical.
- **New round-trip guarantee**: Suite 41 SF10 asserts that a demo session exported to a `.canvas` envelope and re-imported produces a byte-identical session. If a future slice changes the demo shape, this test fires.
- **Migrator coverage extended**: SF8 asserts that imported files run through the existing `migrateLegacySession` chain — so every Phase-17 coercion, v2.4.9 primary-layer backfill, and future migration automatically applies to imported `.canvas` files. Users who save a workbook today and open it six months from now keep their work.

### Why this matters for the demo surface

Before v2.4.10, the demo was localStorage-scoped — refreshing or clearing wiped it. Now a user can click **Load demo** → make changes → **Save to file** → keep the file as a reference workbook. Opening the demo `.canvas` file on any other machine loads the same Acme FSI scenario. The demo becomes shareable, not just ephemeral.

---

## v2.4.9 · 2026-04-24 · Primary-layer invariant + explicit gap.projectId (pre-crown-jewel rollback anchor)

**Status**: shipped. No UI changes — this slice is data-model plumbing for v2.5.0.

### What changed for the demo surface

- **No demo-data refresh required.** The default Acme FSI persona's existing gaps already conform to the new primary-layer invariant (`affectedLayers[0] === layerId` was the convention even when not enforced). Migrator will no-op on next load.
- **Every demo gap receives a `projectId` at load time** via the migrator (`${env}::${layer}::${gapType}`). Deterministic, idempotent, invisible to the user but queryable by downstream services.
- **demoSpec unchanged** — the new rules are tested directly in Suite 40 (PL1-PL5, PR1-PR5) rather than via demo fixtures. Demo coverage stays the same.

### The "Clear all data" footer button

v2.4.9 ships a new red-tinted "Clear all data" button in the footer (separate from "+ New session" which only resets the session object). Click → confirm → wipes every `dell_discovery_*` + `ai_*` localStorage key → page reload. Lets an existing user finally see the v2.4.7 fresh-start welcome card without DevTools — the fix for the "I upgraded but nothing looks different" complaint.

---

## v2.4.8 · 2026-04-24 · Phase 17 taxonomy (Action rename + 7-term link rules)

**Status**: shipped.

### What changed for the demo surface

- **Demo now exercises every Action.** Added two desired tiles to the
  Acme FSI persona — `d-007` (Cisco Nexus, `disposition: "keep"`) and
  `d-008` (AWS Backup, `disposition: "retire"`). Plus a new desired
  tile `d-009` (Dell Validated Design — AI / RAG,
  `disposition: "introduce"`) as the anchor for an introduce-gap.
- **New introduce-gap `g-007`** — "Introduce Dell Validated Design for
  AI/RAG workloads". Exercises the `linksCurrent: 0, linksDesired: 1`
  rule. `driverId: "ai_data"`.
- **No rationalize values anywhere** — DS18/DS19 assert this.

### Tests added — Suite 35b (DS18-DS21) + Suite 39 (TX1-TX10)

Suite 35b ride-alongs the demoSpec:
- DS18 · every demo `instance.disposition` is a taxonomy id; demo
  exercises ≥3 distinct Actions.
- DS19 · every demo `gap.gapType` is a taxonomy GAP_TYPES value.
- DS20 · demo includes ≥1 introduce-gap with 0 current / ≥1 desired.
- DS21 · demo includes ≥1 `keep` instance and ≥1 `retire` instance.

Suite 39 (appSpec) covers the taxonomy module directly:
- TX1-TX4 · ACTIONS shape + derived GAP_TYPES / ACTION_TO_GAP_TYPE.
- TX5 · `actionById` lookup.
- TX6 · `evaluateLinkRule` semantics (exact / n+ / optional).
- TX7 · `validateActionLinks` enforces on reviewed, bypasses on auto-drafts.
- TX8 · `createGap` integration enforces link rules.
- TX9 · migrator coerces rationalize idempotently (gap → ops, instance → retire).
- TX10 · `DISPOSITION_ACTIONS` export is a live re-export of the taxonomy.

### Why this matters for the demo surface

Before v2.4.8, no demo gap used `introduce` and no demo instance used
`keep` or `retire` — three of the seven Actions were pure theory. The
refresh means every rule in `core/taxonomy.js` gets exercised whenever
the user loads demo. A future "consolidate" rule tweak, for example,
will trip DS assertions if the demo becomes inconsistent.

---

## v2.4.7 · 2026-04-24 · Fresh-start UX (onboarding split)

**Status**: shipped (Phase 19h).

### What changed for the demo surface

- **Empty canvas is now the first-run default.** `state/sessionStore.js` IIFE
  falls back to `createEmptySession()` instead of `createDemoSession()` when
  localStorage is blank. Demo mode is entirely opt-in from here on.
- **New `isFreshSession(s)` predicate** exported from `sessionStore`. UI code
  uses this to decide whether to surface the fresh-start welcome card. True
  iff no customer name, no drivers, no instances, no gaps.
- **Fresh-start welcome card** on Context tab when `isFreshSession(session)`.
  Two CTAs: "↺ Load demo session" (fires `resetToDemo()` → demo persona
  loads) and "Start fresh" (local dismiss).
- **Footer "↺ Load demo" button stays** as a persistent affordance so users
  who dismiss the card can still load the demo later.
- **No data-model changes** — `createDemoSession()` and `DEMO_PERSONAS`
  unchanged. The onboarding surface changed; the demo itself didn't.

### Tests added — Suite 38, FS1-FS5

- FS1 · `isFreshSession` returns true for empty-shaped / null / undefined /
  missing-arrays sessions.
- FS2 · `isFreshSession` returns false once any of customer.name /
  drivers[] / instances[] / gaps[] is non-empty.
- FS3 · `renderContextView` on an empty session renders `.fresh-start-card`
  with both CTAs ("Load demo" + "Start fresh").
- FS4 · `renderContextView` on any populated session does NOT render the
  fresh-start card.
- FS5 · regression guard: footer `#demoBtn` still exists as the persistent
  Load-demo path.

### Why this matters for the demo surface

Before v2.4.7, a brand-new user opened the app and was immediately looking
at Acme Financial Services data with 6 gaps and a populated roadmap — this
was legitimately confusing (users asked "why is there a gap in my fresh
session?"). The fresh-start split preserves the demo-as-reference value
(still one click away) without pretending somebody else's session is yours.

---

## v2.4.5 · 2026-04-24 · Foundations Refresh — initial split

**Status**: shipped (Phase 19e).

### Module extraction

- NEW `state/demoSession.js` — demo-seed data lifted out of
  `state/sessionStore.js`. `sessionStore` re-exports
  `createDemoSession` for backward compatibility (existing tests and
  callers don't change).
- NEW `core/seedSkills.js` — seed skill library lifted out of
  `core/skillStore.js`. `skillStore.seedSkills()` delegates here.
- NEW `diagnostics/demoSpec.js` — integration suite registered into the
  same test runner as `appSpec.js`.

### Demo session refresh — default persona `acme-fsi`

- Added Phase 16 workload-layer instance `w-001` (Core Banking /
  Payments) with `mappedAssetIds=[i-001, i-003, i-005, i-007]`.
- Added Phase 18 multi-linked pattern: instance `i-005` (Veeam) is now
  referenced by both `g-001` and the new `g-006` (backup platform
  lock-in). Warn-but-allow chip must render on the gap detail view.
- Every gap now carries an explicit `driverId` (Phase 14 coupling) —
  `g-001/g-006` → `cyber_resilience`, `g-002/g-004` → `modernize_infra`,
  `g-003/g-005` → `cost_optimization`.
- Every gap now carries `reviewed: true` (prior demo didn't set this
  and relied on migration defaults).
- Driver outcomes expanded to bullet form so the auto-bullet Enter
  behaviour is exercised by the demo data.
- Added a third driver (`modernize_infra`) so the Tab-1 detail view
  shows three tiles instead of two.

### New demo personas (stubs)

- `meridian-hls` · Meridian Health — HIPAA / HITRUST compliance driver,
  clinical AI pilot, EHR workload.
- `northwind-pub` · Northwind Public Sector — sovereignty + cost
  drivers, no cloud workloads (tests `publicCloud`-excluded path).

Both personas are exercised by `diagnostics/demoSpec.js DS15`
(build + validate). UI surface for switching personas is deferred to a
later slice.

### Seed skill library — 6 skills across 5 tabs

| id | Tab | Response format | Exercises |
|---|---|---|---|
| `skill-driver-questions-seed` (pre-existing) | context | text-brief | — |
| `skill-context-driver-tuner-seed` | context | json-scalars | `context.selectedDriver.priority`, `.outcomes` |
| `skill-current-tile-tuner-seed` | current | json-scalars | `context.selectedInstance.criticality`, `.notes` |
| `skill-desired-tile-tuner-seed` | desired | json-scalars | `context.selectedInstance.disposition`, `.priority`, `.notes` |
| `skill-gap-rewriter-seed` | gaps | json-scalars | `context.selectedGap.description`, `.urgency`, `.notes` |
| `skill-reporting-narrator-seed` | reporting | text-brief | — |

All six ship with `deployed: true, seed: true` so every tab's
`✨ Use AI ▾` dropdown is populated on first run.

### Foundations · platform plumbing added alongside the refresh

- NEW `core/sessionEvents.js` — `onSessionChanged / emitSessionChanged`
  pub/sub. `applyProposal`, `applyAllProposals`, `undoLast`,
  `resetSession`, `resetToDemo` all emit.
- `state/aiUndoStack.js` — persisted to `localStorage` under
  `ai_undo_v1` (cap 10); survives reload; cleared on `resetSession` /
  `resetToDemo`. Added `undoAll()` + `recentLabels()` + `clear()` +
  `depth()` helpers.
- Header · new `↶↶ Undo all` chip + depth badge on `↶ Undo last`;
  tooltip lists the top 5 stack labels.

### Tests added — Suites 31-35 (demoSpec)

- **31 · demo session data-model** — validateInstance / validateGap
  pass; Phase 16 workload + mappedAssetIds; Phase 18 multi-link;
  Dell + non-Dell vendors; gap with driverId; driver with outcomes.
- **32 · seed skills vs FIELD_MANIFEST** — round-trip through
  normalizeSkill; every outputSchema path exists AND `writable: true`;
  every writable context path has a WRITE_RESOLVERS entry; every tab
  has ≥1 deployed seed; text-brief + json-scalars both represented.
- **33 · apply + undo byte-identical** — `applyProposal` → `undoLast`
  and `applyAllProposals` → `undoLast` both restore JSON-identical
  state.
- **34 · personas** — every `DEMO_PERSONAS` entry builds a session that
  validates.
- **35 · session-changed bus** — `applyProposal` emits `"ai-apply"`;
  `undoLast` emits `"ai-undo"`.
