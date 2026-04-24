# Dell Discovery Canvas — Session Handoff

**Last session end**: 2026-04-24 morning, after shipping `v2.4.4`.
**File purpose**: anyone (human or a fresh Claude Code session) opening this folder should read this file first to know exactly where work stopped, what's shipped, what's queued, and how to pick up.

---

## 1 · Where you are

- `git log --oneline main` → HEAD = `v2.4.4` (commit `79ec253`).
- `git tag --list 'v2.*' | sort -V` → 14 tags: `v2.1.1` through `v2.4.4`.
- Working tree: clean. Everything that was built is tagged and pushed to `origin/main`.
- GitHub: https://github.com/M-Alshamrani/dell-discovery-canvas (private).

## 2 · What is shipped

Full chronology and commit refs live in `.claude/projects/.../memory/project_current_state.md`. One-line summary per tag:

| Tag | Phase | What it delivered |
|---|---|---|
| v2.1.x | 0-14 baseline + reviewer handoff | 5-tab discovery canvas, ~348 assertions |
| v2.2.0 | 15 Docker | nginx:alpine multi-arch, port 8080, CSP headers |
| v2.2.1 | 15.1 LAN auth | env-driven HTTP Basic auth |
| v2.2.2 | 15.2 Dell tokens | Dell palette + Inter typography |
| v2.2.3 | 15.3 visual depth | tighter radii + heading tracking + mono metrics |
| v2.3.0 | 18 Gap-link UX | always-visible + warn-but-allow + roadmap dedup |
| v2.3.1 | 16 Workload Mapping | 6th layer + N-to-N + upward propagation |
| v2.4.0 | 19a AI foundations | 3-provider client, gear settings modal |
| v2.4.1 | 19b Skill Builder | admin panel + per-tab dropdown + seed skill |
| v2.4.2 | 19c Field-pointer | bindable-field chips + JSON coercion + test-skill |
| v2.4.2.1 | 19c.1 Pill editor | contenteditable editor with binding pills |
| v2.4.3 | 19d.1 Prompt guards | text-brief footer + Refine-to-CARE + save gate |
| **v2.4.4** | **19d Unified AI platform** | **SPEC §12 + responseFormat/applyPolicy + writable resolvers + undo + per-skill provider** |

**Test count**: 416+ machine assertions across 30 suites in `diagnostics/appSpec.js`, all green.

## 3 · Known UX issues in v2.4.4 (explicit — queued for v2.4.5)

Tests pass, but these are real UX gaps the user identified at ship time. Each is a symptom of the **same root cause**: views don't react to session changes from AI apply/undo, and the demo + seed surfaces are stale. v2.4.5 Foundations Refresh is the fix.

1. **Post-undo tab blanking** — after clicking the ↶ Undo chip, the current tab can appear blank. Cause: no session-changed event; views cache stale "selected" refs.
2. **Driver tile vanishes on AI apply** — changing a driver's priority via AI makes the tile appear to disappear. Same root cause as (1).
3. **Undo chip vague** — no tooltip, no indication of what will revert or how deep the stack is.
4. **Undo not persistent** — in-memory only; clears on page reload.
5. **Demo session stale** — `createDemoSession()` predates Phase 16 (no workload instances) and Phase 18 (no multi-linked patterns).
6. **Seed skill library minimal** — only one text-brief skill; doesn't demo writable-field flows.

## 4 · NEXT UP — v2.4.5 Foundations Refresh (fresh session)

**Spec is locked**. Read `feedback_foundational_testing.md` for the foundational rule, then execute the 6 items below in one disciplined pass.

Scope (est ~3 hr):
1. **Session-changed event** — emit from `applyProposal` + `undoLast`. Views subscribe in `app.js → renderStage()` so after any AI mutation, the current view re-resolves "selected" state against the live session before re-rendering. Fixes issues 1 + 2 above.
2. **Undo chip UX** — tooltip listing the last N stack entries; optional "Undo all" button; stack depth shown inline. Fixes issue 3.
3. **Persist undo to localStorage** — new key `ai_undo_v1`. Bounded to 10 entries. Clears on `resetSession` / `resetToDemo`. Fixes issue 4.
4. **Extract `state/demoSession.js`** — move the current `createDemoSession()` out of sessionStore into its own module. Refresh data to include:
   - At least one workload-layer instance with `mappedAssetIds[]` (Phase 16).
   - At least one multi-linked pattern (Phase 18 warn-but-allow with a yellow chip).
   - Gap schema aligned with current `validateGap` contract.
   - Add 2-3 demo personas (e.g., Financial Services, Healthcare, Public Sector) the user can switch between.
5. **NEW `core/seedSkills.js`** — pre-built skill library of 4-5 skills:
   - Text-brief / show-only skills (like today's seed, one per tab).
   - At least one `json-scalars` skill per tab that uses the new writable fields (Gaps: rewrite description + reclassify urgency; Context: propose driver priority + outcomes; Current/Desired: propose criticality + notes).
   - All skills deployed by default so `Use AI ▾` dropdown is populated on first run.
6. **NEW `diagnostics/demoSpec.js`** — integration-test suite that asserts:
   - Demo session passes `validateInstance` + `validateGap` against the CURRENT data model.
   - Every seed skill's `outputSchema` references paths that exist in the current `FIELD_MANIFEST` AND are `writable:true`.
   - Applying a seed skill's proposals + calling `undoLast()` returns the session to the byte-identical prior state (data-integrity regression gate).
   - Demo exercises at least one instance of: Dell solution, non-Dell solution, linked gap, multi-linked instance, workload mapping, driver with outcomes.
7. **NEW `docs/DEMO_CHANGELOG.md`** — audit trail for the demo module, separate from the main CHANGELOG.

**Output**: v2.4.5 ships all six items. If you can't do all six, the change isn't done — per `feedback_foundational_testing.md`.

## 5 · Full backlog (after v2.4.5)

Ordered for logical progression. Each bucket has locked scope in memory or SPEC.

### Bucket A — finish AI platform
- **A1.** v2.4.5 **Foundations Refresh** — the six items above. NEXT UP.
- **A2.** v2.4.6+ **Action-command skills** — implement the action-commands runtime. Schema is already declared in SPEC §12.6; stub footer is in `core/promptGuards.js`. v2.4.6 wires `core/actionCommands.js` with a whitelist of ops (`updateField`, `updateGap`, `createGap`, `linkInstance`, `setGapDriver`, `deleteGap`). Each op routes to an existing `interactions/*Commands.js` function. Test vectors cover parser + each op + undo.

### Bucket B — Crown-jewel UX rework (v2.5.0)
Locked spec in `project_deferred_design_review.md` §§ 1-5. Single big release, best done in a fresh session with full context.
- **B1.** Gaps ↔ Roadmap vocabulary unification.
- **B2.** Visible Gap → Project relationship (today's silent `buildProjects` bucketing made visible).
- **B3.** "Primary layer" semantics rework — `gap.layerId` vs `affectedLayers[]`.
- **B4.** "✨ Use AI" button placement across Tabs 2-5.
- **B5.** Whitespace + density + real SVG icon system + tag vocabulary unification + side-panel-as-drawer IA (per the GPLC sample comparison).

### Bucket C — User-gated
- **C1.** Phase 17 **Taxonomy unification** — drop `rationalize` gap type, rename Disposition → Action, 7-term mandatory-link table. Blocked on user sign-off of the table in `docs/CHANGELOG_PLAN.md § v2.2+ Item 4`.

### Bucket D — Deployment
- **D1.** GB10 (or any linux/arm64 host) **multi-arch verification** — the image is multi-arch-tagged but nobody has built/run it on real ARM64 hardware. Recipe in `project_current_state.md § Pending GB10 verification`.

### Bucket E — v3 multi-user
- **E1.** Backend server (Node/Express or FastAPI) + DB (SQLite → Postgres) + JWT auth + RBAC (presales/manager/director/admin) + analytics + WAF. Separate architecture doc required (`SPEC_v3.md`). AI API keys move server-side from browser localStorage. 2-4 weeks of focused work.

## 6 · How to resume (for the fresh session)

Read these files **in this order**:

1. **This file** (`HANDOFF.md`) — you're here.
2. `.claude/projects/C--Users-Mahmo-OneDrive-Documents-Claud-AI-PreSales-App/memory/MEMORY.md` — the full memory index.
3. `.claude/projects/.../memory/project_current_state.md` — exhaustive shipped-state + commit refs.
4. `.claude/projects/.../memory/feedback_foundational_testing.md` — **the rule that governs v2.4.5 and everything after**.
5. `.claude/projects/.../memory/project_deferred_design_review.md` — crown-jewel scope + v2.4.4 implementation notes that carried over.
6. `SPEC.md § 12` (lines ~775–900) — the AI Platform Specification.
7. `docs/CHANGELOG_PLAN.md` — latest entry at the top is `v2.4.4`; `v2.4.5` is declared as "QUEUED (fresh session)" with the six-item spec.

Then verify the build works locally:

```bash
cd C:/Users/Mahmo/Projects/dell-discovery
docker compose up -d --build   # image cached ~75MB; should start in <10s
curl http://localhost:8080/health   # → ok
# Open http://localhost:8080 in incognito → confirm green banner (~416 assertions)
```

Then ask the user to confirm the starting point and which bucket to tackle first. **Default next work is v2.4.5 Foundations Refresh** — the scope is locked, the tests to add are specified, the files to create are named. Execute on the spec without re-deriving.

## 7 · A suggested opening prompt for the fresh session

Paste this verbatim (or adapt) as your first message in the new session:

> Resume work on the Dell Discovery Canvas project. Read, in order: `C:\Users\Mahmo\Projects\dell-discovery\HANDOFF.md`, then the memory files listed in its § 6, then `SPEC.md § 12`. The last session ended after shipping v2.4.4 with known UX issues explicitly queued for v2.4.5 Foundations Refresh (scope locked in `feedback_foundational_testing.md`). Before proposing anything, confirm back to me:
> 1. The current HEAD tag and what was in it.
> 2. The six-item v2.4.5 scope.
> 3. The full backlog buckets A-E.
> 4. Whether the local Docker build still serves 416/416 green.
>
> Then wait for my direction on which bucket to start — the default is v2.4.5 Foundations Refresh.

## 8 · Process rule for every session going forward

Per `feedback_foundational_testing.md`:

> Every phase that adds or renames a data-model field must, in the SAME commit, (1) update the demo session to exercise the new field, (2) update or add a seed skill that demonstrates the new capability, (3) update `diagnostics/demoSpec.js` with an assertion pinning the new shape, (4) log the change to `docs/DEMO_CHANGELOG.md`.

v2.4.5 is the first release under this rule. Every release after it carries the rule forward. The 416-tests-pass-but-UX-broken pattern that caused v2.4.4's known issues is what this rule prevents.
