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
