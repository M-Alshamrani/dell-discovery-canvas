# Dell Discovery Canvas — Session Handoff

**Last session end**: 2026-04-26, after shipping `v2.4.12` Services Scope + Pre-flight regression fixes + post-smoke hot-patches (gap.services multi-select catalog + opt-in suggested chips + "+ Add service" picker for full catalog reach + Reporting "Services scope" sub-tab + ContextView no-op-Save isDemo fix + skillStore→AI-dropdown auto-refresh bus + Reporting Gaps Board side-panel services + Roadmap project-card chip CSS + 22 new tests).
**File purpose**: anyone (human or a fresh Claude Code session) opening this folder should read this file first to know exactly where work stopped, what's shipped, what's queued, and how to pick up.

---

## 1 · Where you are

- `git log --oneline main` → HEAD = `v2.4.12` (commit `4084a69`).
- `git tag --list 'v2.*' | sort -V` → 23 tags: `v2.1.1` through `v2.4.12` (plus the `v2.4.11.d01` + `v2.4.11.d02` hygiene-pass records on origin only).
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
| v2.4.4 | 19d Unified AI platform | SPEC §12 + responseFormat/applyPolicy + writable resolvers + undo + per-skill provider |
| v2.4.5 | 19e Foundations Refresh | session-changed bus + persistent undo + demoSession module + 6 seed skills + demoSpec (DS1-DS17) + DEMO_CHANGELOG |
| v2.4.5.1 | 19f AI reliability | Anthropic browser-direct header + retry-with-backoff on 429/5xx + per-provider fallback-model chain (Suite 36 RB1-RB7) |
| v2.4.6 | 19g UX quick-wins | app version surface + per-tab skill chip + save gate + banner auto-dismiss |
| v2.4.7 | 19h Fresh-start UX | empty-canvas default + welcome card with Load-demo CTA |
| v2.4.8 | 17 Phase 17 | 7-term Action taxonomy + link rules + rationalize coercion |
| v2.4.9 | 19i Primary-layer + projectId | invariant + explicit Gap→Project relationship (pre-crown-jewel rollback anchor) |
| v2.4.10 | 19j Save/open file | user-owned `.canvas` workbook + PWA file_handlers + Clear-all hardening |
| v2.4.10.1 | 19j.1 HOTFIX | test-runner localStorage isolation (fixes "Bus Co" pollution) |
| v2.4.11 | 19k Rules hardening | review-time enforcement + closed-vs-deleted + visible auto-behaviour + Operational/Services clarity + 3 in-flight bug fixes caught by browser smoke |
| **v2.4.12** | **19l Services scope + PR/U + post-smoke hot-patches** | **`gap.services[]` field + 10-entry `SERVICE_TYPES` catalog + Tab 4 multi-chip selector with "+ Add service" picker (full catalog) + Tab 5.5 project-card chip row + NEW Reporting "Services scope" sub-tab + PR1 ContextView no-op Save preserves `isDemo` + PR2 skillsEvents bus → AI dropdown auto-refresh + U1 removal of D2 ops-gap CTA + M11 migrator backfill + closed-gap rollup exclusion + Reporting Gaps Board side-panel services + Roadmap chip pill CSS. Suite 43 SVC1-15 + DS23 (22 new tests). Total 531/531.** |

**Test count**: 531 assertions across 44 suites in `diagnostics/appSpec.js` + `diagnostics/demoSpec.js`, all green.

## 3 · What closed in v2.4.5 + v2.4.5.1

All six UX issues from v2.4.4 are resolved, and the two reliability failure modes the user hit in live Gemini / Anthropic use are fixed:

- v2.4.5 · session-changed bus → driver tile no longer vanishes on AI apply; tab no longer blanks after undo.
- v2.4.5 · undo chip tooltip + depth badge + "↶↶ Undo all" chip.
- v2.4.5 · undo persisted to `localStorage` (`ai_undo_v1`, cap 10, cleared on reset).
- v2.4.5 · demo session refreshed (Phase 16 workload + Phase 18 multi-link + driverId on every gap); extracted to `state/demoSession.js` with 3 personas.
- v2.4.5 · seed skill library of 6 (json-scalars exercising writable fields on 4 tabs); deployed by default.
- v2.4.5 · `diagnostics/demoSpec.js` Suites 31-35 (DS1-DS17) + `docs/DEMO_CHANGELOG.md` audit trail.
- v2.4.5.1 · Anthropic `anthropic-dangerous-direct-browser-access: true` header fixes the 401 loop.
- v2.4.5.1 · retry-with-backoff on 429/5xx (3 attempts, 500ms→4s with full jitter).
- v2.4.5.1 · per-provider `fallbackModels[]` chain (Gemini defaults to `gemini-2.0-flash, gemini-1.5-flash`).
- v2.4.5.1 · Settings UI exposes the fallback chain; `Test connection` reports which model answered.

## 4 · NEXT UP — Bucket A2 · v2.4.6 Action-command skills

Scope locked in `SPEC.md §12.6`. Runtime for the `json-commands` response format already declared in the skill schema but stub-rejected today. One disciplined slice:

1. NEW `core/actionCommands.js` — whitelist of ops: `updateField`, `updateGap`, `createGap`, `deleteGap`, `linkInstance`, `setGapDriver`. Each op routes to an existing function in `interactions/*Commands.js` (no business-logic duplication).
2. Extend `interactions/aiCommands.js parseCommands(responseText)` — parse `{ commands: [...] }` shape, validate each op against the whitelist, reject unknown ops at parse time (not at apply time).
3. `applyCommands(commands, ctx)` — batches under one undo snapshot, emits `session-changed` once per batch (reason `"ai-apply"` as usual).
4. Wire `skillEngine.js` · when `responseFormat === "json-commands"`, call parser instead of `parseProposals`. `UseAiButton.js` renders a distinct "N actions proposed" panel (reuse the `applyPolicy` dispatch).
5. Remove the v2.4.4 stub that rejects json-commands outright.
6. Test vectors — Suite 37 · AC1-AC10 covering: parser rejects unknown op; each op mutates correctly; invalid args throw with a readable message; batch + undo is byte-identical; skillEngine integration returns `result.commands[]`.
7. Per `feedback_foundational_testing.md`: add at least one seed skill in `core/seedSkills.js` that uses `json-commands` (e.g., "Link these two gaps to their desired tiles" on the Gaps tab); refresh demo session if any new field is needed; update `docs/DEMO_CHANGELOG.md`.

Estimated scope: ~3 hr. Fresh session can execute directly.

## 5 · Full backlog (after v2.4.6)

Ordered for logical progression. Each bucket has locked scope in memory or SPEC.

### Bucket A — finish AI platform
- ✅ A1. v2.4.5 Foundations Refresh (shipped).
- ✅ A1.1. v2.4.5.1 AI reliability (shipped).
- ✅ A2. v2.4.6 UX quick-wins (shipped 2026-04-24).
- ✅ A2.1. v2.4.7 Fresh-start UX (shipped 2026-04-24).
- ✅ A2.2. v2.4.8 Phase 17 taxonomy (shipped 2026-04-24).
- ✅ A2.3. v2.4.9 Primary-layer + Gap→Project data model · pre-crown-jewel rollback anchor (shipped 2026-04-24).
- ✅ A2.4. v2.4.10 User-owned save/open .canvas file (shipped 2026-04-24).
- ✅ A2.5. v2.4.10.1 HOTFIX · test-runner localStorage isolation (shipped 2026-04-25).
- ✅ A3. v2.4.11 Rules hardening + Q1-Q4 fixes (shipped 2026-04-25). 21 spec items + 3 browser-smoke-discovered bugs (urgency-lock silently failed because metadata patches re-validated links · demo g-004 was mis-typed Replace with 2 currents · Save button had no dynamic feedback). 509 tests green; verified live in browser before commit per `feedback_browser_smoke_required.md`.
- ✅ **A4. v2.4.12 Services scope + PR1/PR2/U1 + P1-P3 hot-patches — IMPLEMENTED 2026-04-26.** Full spec in `docs/CHANGELOG_PLAN.md § v2.4.12`. Section S (services): `gap.services[]` field + 10-entry `SERVICE_TYPES` catalog + Tab 4 gap-detail multi-chip + Tab 5.5 project-card chip row + NEW Reporting "Services scope" sub-tab. Section PR: PR1 ContextView no-op Save no longer flips `isDemo`, PR2 skillStore CRUD emits `skills-changed`. Section U: U1 removed the v2.4.11 D2 `+ Add operational / services gap` CTA. **Hot-patches P1-P3** (folded in pre-tag after user smoke): P1 `+ Add service` picker exposes the full catalog (was: only suggested were addable), P2 integrity sweep (M11 migrator backfill + .canvas normalize + closed-gap rollup + apply/undo round-trip), P3 SummaryGapsView side-panel services chip row + Roadmap project-card chip CSS. Tests: Suite 43 SVC1-15 + PR1.a/b + PR2.a/b/c + U1 + DS23. **Issues #3/#5/#6 from user smoke deferred to v2.5.0** (sub-tab visual polish, cross-tab filters, side-panel-as-drawer dynamic UX) — see Bucket B below.
- **A4.1. v2.4.13 Demo refresh + old-schema purge + per-tab demo banner audit — DEFERRED from v2.4.12 attempt 2026-04-26.** Three items the user chose to defer: (a) demo `g-001` Phase 17 violation (`gapType: replace` with 2 desireds; same shape that was retyped on `g-004` in v2.4.11), (b) localStorage-pollution causing app to default to demo on initial open in user's browser (clean colleagues see fresh-start UX correctly), (c) per-tab demo banner audit — Tab 1 has `.demo-mode-banner` element; Tabs 2-5 do NOT. User did not catch (c) on v2.4.11 so it's gentle; (a) and (b) need a concerted demo refresh that purges any localStorage demo data created under older schemas and rebuilds demos against the v2.4.12+ data model. Opportunity to re-validate every demo gap against current taxonomy + invariants. Effort: ~3 hr.
- **A5. v2.6.0 Action-command skills** — runtime for `json-commands` response format. Was originally v2.4.6; deferred so UX + crown-jewel land first.

### Bucket B, Crown-jewel UI rework (v2.5.0 + v2.5.1)

Joint spec in `docs/CHANGELOG_PLAN.md § v2.5.0` (LOCKED 2026-04-26) plus the philosophy alignment from the Dell Advisory Design System document the user provided 2026-04-26 plus the GPLC reference HTML at `C:/Users/Mahmo/Downloads/GPLC Digital Unified Platform v1.0.html`. Carried forward decisions from `project_crown_jewel_design.md` and `project_deferred_design_review.md`.

**v2.5.0, LOCKED 2026-04-26** (next session, ~3 days, single tag):
- **§0** Pre-flight audit pass: em-dash sweep, Dell product accuracy (g-003 VxRail, no Boomi, no Secureworks/Taegis post-2025, SmartFabric Director → Manager, CloudIQ under APEX AIOps), heading case (Title → sentence), default classification, topbar action audit, anti-pattern sweep on `styles.css`.
- **§1** Design system foundation (DS1-DS8): tokens, eyebrow utility, ONE `.tag` primitive with `data-variant`, hairline section, card pattern, callout block (red / blue / green / amber 3px-left-border), shared band, mono tabular-nums.
- **§2** Topbar + footer (TB1-TB6): white topbar replacing blue gradient; real Dell logo from `i.dell.com`; mono uppercase doc-meta strip; no Export PDF / Share; footer 2px Dell-blue top border with 3-col grid; stepper restyle to `01 02 03 04 05` mono leading-zero.
- **§3** Color discipline (CD1-CD5): brand-blue surface area target ~5% (was ~30%); layered signal mapping (urgency level as chip color, domain as left-bar accent); single primary CTA per surface; everything else ghost / neutral.
- **§4** Detail panel restructure (DP1-DP6): sticky head with mono crumbs + sentence-case h3 + lede + circular close; hairline-divided sections with mono caps eyebrows; 6×2px Dell-blue dash bullets; 2-col tech-grid for attribute summaries; callout integration for review-needed and AI-applied notices.
- **§5** Reporting drawer pattern (DR1-DR6, Tab 5 only): NEW `ui/components/Drawer.js` module; click gap / project / service on Reporting → drawer slides in from right at 560px width; backdrop + Escape + ✕ close paths; Tabs 1-4 keep side-by-side persistent panel and adopt the drawer's INTERNAL structure only.
- **§6** Cross-tab filter system (F1-F6): body data-attribute pattern; multi-chip selectors on Tab 4 + Reporting Gaps Board for layer / gapType / services / environment / driver; non-matching items dim to opacity 0.18-0.30 + grayscale(.5); match-mode toggle (default OR); persistence to `localStorage`.
- **§7** Services scope sub-tab redesign (SR1-SR4): replace primitive table with hero summary card + per-service grid cards + DR5 click-to-drawer + concentration-risk callouts.
- **§8** Tag vocabulary migration (TV1-TV9): all 11+ chip / badge / pill classes consolidated to `.tag[data-variant=...]`.
- **§9** Tests (Suite 44 VT1-VT15 + DS24): token presence, eyebrow utility, single tag primitive, drawer module, filter behaviors, dash bullet, em-dash absence, services-scope cards.
- **§R** Regression guards: v2.4.12 R1-R10 stay green; new R1-R12 cover the visual rework + Dell product accuracy + drawer paths + color audit.
- **Hard rules baked in**: no em dashes anywhere; sentence case headings; real Dell logo; hover-only shadows; ONE `.tag` primitive; drawer scope is Tab 5 only (hybrid pattern); layered signal colors.

**v2.5.1, queued after v2.5.0 sign-off** (~2 days, separate tag):
- **U4** "✨ Use AI" button placement on Tabs 2-5 (currently only Tab 1 driver detail).
- **VC** Vocabulary unification across Gaps (Tab 4) and Roadmap (Tab 5.5).
- **GV** Visible Gap → Project relationship affordances.
- **PL** Primary-layer semantics rework (`gap.layerId` vs `affectedLayers[]`). Data model touchpoint, explicit spec round before code.
- **IC** SVG icon system (Lucide library); replace all emoji with stroke icons at uniform 16/20/24px sizes.
- **EP** Edit-side panel polish refinements once v2.5.0 §4 patterns land.

**v2.4.9 remains the pre-crown-jewel rollback anchor**. v2.4.12 is now the safe state; if v2.5.0 sideways, roll to v2.4.12.

### Bucket C — Was user-gated, now done
- ✅ C1. Phase 17 Taxonomy unification — shipped as v2.4.8 (2026-04-24, sign-off in hand).

### Bucket D — Deployment
- **D1.** GB10 (or any linux/arm64 host) **multi-arch verification** — the image is multi-arch-tagged but nobody has built/run it on real ARM64 hardware. Recipe in `project_current_state.md § Pending GB10 verification`.

### Bucket E — v3 multi-user
- **E1.** Backend server (Node/Express or FastAPI) + DB (SQLite → Postgres) + JWT auth + RBAC (presales/manager/director/admin) + analytics + WAF. Separate architecture doc required (`SPEC_v3.md`). AI API keys move server-side from browser localStorage. 2-4 weeks of focused work.

## 6 · How to resume (for the fresh session)

Read these files **in this order**:

1. **This file** (`HANDOFF.md`) — you're here.
2. `.claude/projects/C--Users-Mahmo-OneDrive-Documents-Claud-AI-PreSales-App/memory/MEMORY.md` — the full memory index.
3. `.claude/projects/.../memory/project_current_state.md` — exhaustive shipped-state + commit refs.
4. `.claude/projects/.../memory/feedback_foundational_testing.md` — **the rule that governs every data-model change**.
5. `.claude/projects/.../memory/project_deferred_design_review.md` — crown-jewel scope.
6. `SPEC.md § 12` — the AI Platform Specification (including §12.4a reliability contract + §12.5a sessionEvents bus + §12.8 invariants).
7. `docs/CHANGELOG_PLAN.md` — latest entries at top: v2.4.12 (services scope, NEXT UP), v2.4.11 IMPLEMENTED (rules hardening), v2.4.10.1 hotfix, v2.4.10 save/open file, v2.4.9 rollback anchor.
8. `docs/RULES.md` — **rules-as-built audit (post-v2.4.11)**. Must read before any rule change. 12 sections, ~90 numbered rules tagged 🔴 HARD / 🟡 SOFT / 🔵 AUTO / 📦 MIGRATE, plus a "v2.4.11 UI surfaces" map.
9. `docs/DEMO_CHANGELOG.md` — demo + seed surface audit trail (read before touching `state/demoSession.js` or `core/seedSkills.js`).
10. **Memory `feedback_browser_smoke_required.md`** — locked discipline since v2.4.11: every tag MUST include a manual browser smoke against the verification spec BEFORE commit. Tests pass alone is NOT enough — three v2.4.11 bugs (urgency lock, demo g-004 type, save feedback) only surfaced via browser smoke.

Then verify the build works locally:

```bash
cd C:/Users/Mahmo/Projects/dell-discovery
docker compose up -d --build   # image cached ~75MB; should start in <10s
curl http://localhost:8080/health   # → ok
# Open http://localhost:8080 in incognito → confirm green banner (~416 assertions)
```

Then ask the user to confirm the starting point and which bucket to tackle first. **Default next work as of 2026-04-25: v2.4.12 Services scope** — the spec is locked in `docs/CHANGELOG_PLAN.md § v2.4.12`, files to touch are named, two-surface treatment included. Execute on the spec without re-deriving.

**TAG PROTOCOL (mandatory since v2.4.10.1 — written into `feedback_browser_smoke_required.md`)**:

1. Spec committed BEFORE code (locked in `docs/CHANGELOG_PLAN.md`).
2. Code execution as one coherent pass.
3. **Manual browser smoke** against the verification spec via Chrome MCP (`mcp__Claude_in_Chrome__navigate` + `javascript_tool` to simulate real user actions and inspect resulting DOM/state). Every "what you'll see" bullet checked in the live app, results reported back to user.
4. **PAUSE for explicit "tag it" approval.** No tag without it.
5. Tag, push, update memory + HANDOFF.

The browser smoke is non-negotiable: v2.4.11's three pre-tag bug fixes (urgency lock, demo g-004 type, save feedback) all came from browser smoke catching things the green test banner missed.

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
