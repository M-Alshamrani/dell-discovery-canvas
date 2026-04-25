# Dell Discovery Canvas — Session Handoff

**Last session end**: 2026-04-25, after shipping `v2.4.11` Rules Hardening (review-time enforcement + closed-vs-deleted gaps + visible auto-behaviour + Operational/Services clarity + 3 in-flight bug fixes caught by browser smoke), followed by the first hygiene-pass clone `v2.4.11+d01` (no behaviour change — code-quality + perf + security + relationship-integrity audit + doc/memory reconciliation + new [docs/MAINTENANCE_LOG.md](docs/MAINTENANCE_LOG.md)).
**File purpose**: anyone (human or a fresh Claude Code session) opening this folder should read this file first to know exactly where work stopped, what's shipped, what's queued, and how to pick up.

---

## 1 · Where you are

- `git log --oneline main` → HEAD = `v2.4.11+d01` (functional source = `v2.4.11`).
- `git tag --list 'v2.*' | sort -V` → 23 functional tags `v2.1.1` through `v2.4.11`, plus `v2.4.11+d01` hygiene-pass clone (SemVer-equivalent to `v2.4.11`, no behaviour change).
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
| v2.4.6 | 19f UX quick-wins | auto-dismiss test banner + UX polish |
| v2.4.7 | 19h Fresh-start UX | empty-canvas first-run + Load-demo welcome card |
| v2.4.8 | 17 Taxonomy unification | "Disposition" → "Action" rename, 7-term taxonomy, `rationalize` removed (migrator coerces) |
| v2.4.9 | 19i Primary-layer + projectId | `affectedLayers[0] === layerId` invariant + explicit `gap.projectId` (pre-crown-jewel rollback anchor) |
| v2.4.10 | 19j .canvas save/open | user-owned workbook file + File System Access API + PWA manifest |
| v2.4.10.1 | 19j.1 HOTFIX | test-runner localStorage isolation (`runIsolated` snapshot/restore) |
| **v2.4.11** | **19k Rules Hardening** | **review-time validation, status:closed (not delete), visible auto-behaviour, 90-rule audit in `docs/RULES.md`, 3 in-flight bug fixes from mandatory browser smoke** |

**Test count**: 509 assertions across 42+ suites in `diagnostics/appSpec.js` + `diagnostics/demoSpec.js`, all green.

## 3 · What closed in v2.4.6 → v2.4.11

Recent wins by tag:

- **v2.4.6** · auto-dismiss test banner; UX quick-wins.
- **v2.4.7** · empty-canvas first-run; "Load demo" welcome card on fresh sessions (Suite 38 FS1-FS5).
- **v2.4.8 · Phase 17** · "Disposition" → "Action" rename; 7-term taxonomy (`keep / enhance / replace / consolidate / retire / introduce / ops`); migrator coerces legacy `rationalize` values; mandatory action-link rules on reviewed gaps (Suite 39 TX1-TX10 + DS18-DS22).
- **v2.4.9** · primary-layer invariant (`affectedLayers[0] === gap.layerId`) + explicit `gap.projectId` (replaces silent `buildProjects` bucketing). Pre-crown-jewel rollback anchor.
- **v2.4.10** · user-owned `.canvas` workbook file via File System Access API; PWA manifest; save/open round-trip with migrator coverage (Suite 41 SF1-SF11).
- **v2.4.10.1 HOTFIX** · `runIsolated` snapshot/restore guard so test runs no longer pollute real `localStorage`.
- **v2.4.11 · Phase 19k** · Rules Hardening + Visible-Rules UX. Five locked design principles (Draft permissive / Review enforced; status:closed not delete; auto-behaviour visible; rules from one place; workshop flow > ideal data shape). 21 spec items + 3 in-flight bug fixes (urgency-lock silently failing, demo g-004 mis-typed Replace, Save button no feedback) — all caught by mandatory Chrome-MCP browser smoke. Codified discipline in [feedback_browser_smoke_required.md](C:/Users/Mahmo/.claude/projects/C--Users-Mahmo-OneDrive-Documents-Claud-AI-PreSales-App/memory/feedback_browser_smoke_required.md).
- **v2.4.11+d01** · first hygiene-pass clone (no behaviour change). Code-quality + perf + security + relationship-integrity audit; doc/memory reconciliation; new [docs/MAINTENANCE_LOG.md](docs/MAINTENANCE_LOG.md). See that file for the full sweep summary.

## 4 · NEXT UP — Bucket A4 · v2.4.12 Services scope (LOCKED 2026-04-25)

Full spec in [docs/CHANGELOG_PLAN.md § v2.4.12](docs/CHANGELOG_PLAN.md). Single tag, ~3-4 hr.

Key shipping:
- New `gap.services[]` field (multi-select string array).
- `core/services.js` 10-entry `SERVICE_TYPES` catalog (assessment, migration, deployment, integration, training, knowledge_transfer, runbook, managed, decommissioning, custom_dev).
- Opt-in suggested chips per `gapType` ("Suggested" eyebrow over greyed-until-clicked chips).
- Roadmap project cards roll up services (deduped union of constituent gaps' services).
- New "Services scope" sub-tab on Tab 5 Reporting (rows = service types, columns = gap count + project count + project names).
- `.canvas` save/open already passes through unknown fields — no envelope changes needed.
- Two-surface treatment: demo refresh + DS-22-style assertion + DEMO_CHANGELOG entry.

Action-command runtime (`json-commands` `responseFormat`) is now Bucket A5 → **v2.6.0** (deferred so UX + crown-jewel land first).

## 5 · Full backlog (after v2.4.11)

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
- **A4. v2.4.12 Services scope — NEXT UP (LOCKED 2026-04-25).** Full spec in `docs/CHANGELOG_PLAN.md § v2.4.12`. New `gap.services[]` field + 10-entry `SERVICE_TYPES` catalog + opt-in suggested chips per gapType + roll-up on Roadmap project cards + new "Services scope" sub-tab on Reporting. ~3-4 hr · single tag.
- **A5. v2.6.0 Action-command skills** — runtime for `json-commands` response format. Was originally v2.4.6; deferred so UX + crown-jewel land first.

### Bucket B — Crown-jewel UX rework (v2.5.0)
Locked spec in `project_deferred_design_review.md` §§ 1-5. Single big release, best done in a fresh session with full context.
- **B1.** Gaps ↔ Roadmap vocabulary unification.
- **B2.** Visible Gap → Project relationship (today's silent `buildProjects` bucketing made visible).
- **B3.** "Primary layer" semantics rework — `gap.layerId` vs `affectedLayers[]`.
- **B4.** "✨ Use AI" button placement across Tabs 2-5.
- **B5.** Whitespace + density + real SVG icon system + tag vocabulary unification + side-panel-as-drawer IA (per the GPLC sample comparison).

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
# Open http://localhost:8080 in incognito → confirm green banner (509 assertions)
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

> Resume work on the Dell Discovery Canvas project. Read, in order: `C:\Users\Mahmo\Projects\dell-discovery\HANDOFF.md`, then the memory files listed in its § 6, then `SPEC.md § 12` and `docs/RULES.md`. The last session shipped v2.4.11 (Rules Hardening + Visible-Rules UX) followed by `v2.4.11+d01` (first hygiene-pass clone, no behaviour change). NEXT UP is v2.4.12 Services scope, locked spec in `docs/CHANGELOG_PLAN.md § v2.4.12`. Before proposing anything, confirm back to me:
> 1. The current HEAD tag (functional latest = v2.4.11; hygiene-pass clone = v2.4.11+d01).
> 2. The locked v2.4.12 scope (services field + 10-entry catalog + opt-in chips + Roadmap roll-up + new sub-tab).
> 3. The full backlog buckets A-E (A4 NEXT UP, A5 → v2.6.0, B = v2.5.0/v2.5.1 crown-jewel).
> 4. Whether the local Docker build still serves 509/509 green.
>
> Then wait for my direction on which bucket to start — the default is v2.4.12 Services scope.

## 8 · Process rule for every session going forward

Per `feedback_foundational_testing.md`:

> Every phase that adds or renames a data-model field must, in the SAME commit, (1) update the demo session to exercise the new field, (2) update or add a seed skill that demonstrates the new capability, (3) update `diagnostics/demoSpec.js` with an assertion pinning the new shape, (4) log the change to `docs/DEMO_CHANGELOG.md`.

Per `feedback_browser_smoke_required.md` (locked since v2.4.11):

> Every functional tag MUST go through manual Chrome MCP browser smoke against a verification spec BEFORE commit. Tests-pass-alone is necessary but not sufficient — three v2.4.11 bugs slipped past 488 green tests and only surfaced via smoke. PAUSE for explicit "tag it" approval; no tag without it.

v2.4.5 is the first release under the two-surface rule. v2.4.11 is the first release under the browser-smoke rule. Every release after carries both forward. The 416-tests-pass-but-UX-broken pattern that caused v2.4.4's known issues is what these rules prevent.
