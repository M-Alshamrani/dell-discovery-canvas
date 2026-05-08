# Dell Discovery Canvas — Roadmap

**Single source of truth for what's shipped, what's in flight, what's open, and the release plan.**

| Field | Value |
|---|---|
| Current branch | `v3.0-data-architecture` |
| Current HEAD | `5deb05c` (or later — run `git log -1`) |
| Current APP_VERSION | `3.0.0-rc.7-dev` ([core/version.js](core/version.js)) |
| Latest tag on origin | `v3.0.0-rc.6` (2026-05-05) |
| Test banner | **1128 / 1134 GREEN** (6 RED — see §3) |

> Detailed history: [HANDOFF.md](HANDOFF.md) · [docs/BUG_LOG.md](docs/BUG_LOG.md) · [docs/V2_DELETION_ARCHITECTURE.md](docs/V2_DELETION_ARCHITECTURE.md) · [docs/RELEASE_NOTES_rc.6.md](docs/RELEASE_NOTES_rc.6.md)

---

## 1 · Released (shipped to origin)

| Version | Date | Theme | Test banner |
|---|---|---|---|
| v3.0.0-rc.3 | 2026-05-03 | AI correctness arc · UUID/ID scrub · BUG-013/15/16/18/20/23 closed | 1117/1117 ✅ |
| v3.0.0-rc.4 | 2026-05-04 | Multi-provider AI · BUG-024/26/29 closed · provider tool-use generic | 1157/1157 ✅ |
| v3.0.0-rc.5 | 2026-05-05 | UX consolidation arc · Skill Builder evolved · side-panel polish | 1169/1169 ✅ |
| **v3.0.0-rc.6** | **2026-05-05** | **Workshop-bug arc · grounding contract recast (RAG-by-construction · 2 planes) · BUG-029/030/031/033/034/035 closed** | **1187/1187 ✅** |

**Major capabilities live in rc.6:**
- v3 data architecture (engagement model · UUID-keyed collections · Zod schemas · superRefine invariants)
- 5-tab presales workshop UI (Context / Current state / Desired state / Gaps / Reporting)
- Demo session (Acme Healthcare: 3 drivers · 4 envs · 23 instances · 8 gaps)
- AI Assist with grounding (router + verifier · zero-fabrication contract per SPEC §S37)
- Multi-provider chat (Anthropic · Gemini · Local A/B vLLM · OpenAI proxy)
- Skill Builder (templated AI skill authoring · pill editor · field manifest · prompt guards)
- Save / Open `.canvas` files (round-trip with schema migrator)
- v3.0 file format with auto-migration from v2.x

---

## 2 · In flight — rc.7 / 7e-8 v2 deletion arc

**Goal**: delete v2 architecture entirely; v3 engagement is the sole source of truth.

| Step | What | Status |
|---|---|---|
| A · Test-scope expansion | V-ANTI-V2-IMPORT-1/2/3 scan ALL production files via manifest | ✅ done |
| B · sessionFile v3-native | + new `state/runtimeMigrate.js` canonical home | ✅ done |
| C · gapsService v3-native | reads via `getActiveEngagement().gaps` | ✅ done |
| D · vendorMixService v3-native | reads via `getActiveEngagement().instances` | ✅ done |
| E · DELETE `ui/views/AiAssistOverlay.js` | dormant since rc.4 · Cmd+K → openCanvasChat | ✅ done |
| F · DELETE `ui/views/SkillAdmin.js` | 608 LOC · superseded by SkillBuilder | ✅ done |
| G · DELETE `state/sessionBridge.js` | 398 LOC · listener flipped to `subscribeActiveEngagement` | ✅ done |
| **I (in progress)** · Test-fixture shim retire | `_v2TestFixtures.js` shim · 35 → 4 re-exports · 49 tests rewritten this session | 🔵 ~50% |
| H · DELETE `state/sessionStore.js` | 220 LOC · gated on Step I shim retirement | ⬜ blocked |
| J · DELETE `interactions/{matrixCommands,gapsCommands,desiredStateSync}.js` | 643 LOC · gated on Step I | ⬜ blocked |
| K · engagementStore cleanup | drop legacy `emitSessionChanged` bus | ⬜ blocked |

**Step I status (the active work):**
- Shim re-exports remaining: `session`, `createEmptySession`, `addInstance`, `createGap`
- Shim consumption: 213 call sites (down from 295 · -28% this session)
- All 213 remaining sites are in **DOM-coupled Suites** (Suites 12, 13, 14, 15, 17, 19, 23, 24, 25-30, 36-47)
- Pure-function migration paths exhausted via the v2-shape-literal pattern (HANDOFF "Phase I-B-31..34 LOCKED" section)

**Decision pending (next agent picks up here):**

| Path | Approach | Estimate to Step H unlock |
|---|---|---|
| (a) DOM Suite per-Suite | Replace `_installSessionAsV3Engagement` + `freshSession` per Suite, audit-before-rewrite, snapshot+restore wrapper | 7-10 mega-commits |
| (b) `freshEng()` fixture replacement | Replace `freshSession` + `_installSessionAsV3Engagement` with one v3-native fixture helper, migrate all DOM Suites in 1-2 sweeps | 3-5 commits |

**Estimate to rc.7 tag**: Step I (~7-10 commits) → Steps H/J/K (~3-5 commits) → 7e-post (FS3 + BUG-042 + VT29 viewport) → tag (PREFLIGHT 5b real-LLM smoke gated to user).

### Standing test RED roster (6 tests · all expected · NOT regressions)

| ID | Reason | Resolves at |
|---|---|---|
| FS3 | ContextView fresh-start card on empty session | rc.7 / 7e-post |
| VT29 | App-shell layout viewport-flake (browser-window-height-dependent) | rc.7 / 7e-post (investigate) |
| V-FLOW-V3-PURE-1 | `state/sessionStore.js` MUST not exist (RED until Step H) | Step H |
| V-FLOW-V3-PURE-3 | `interactions/matrixCommands.js` MUST not exist | Step J |
| V-FLOW-V3-PURE-4 | `interactions/gapsCommands.js` MUST not exist | Step J |
| V-FLOW-V3-PURE-5 | `interactions/desiredStateSync.js` MUST not exist | Step J |

---

## 3 · Open bugs (post rc.6)

| ID | Severity | Theme | Scheduled |
|---|---|---|---|
| BUG-001 | Medium | Propagation toast wrong urgency level (tightened by closed BUG-031) | rc.7-polish or rc.8 |
| BUG-002 | Medium | Propagate button non-dispatchable after add-different-layer cycle | rc.7-polish or rc.8 |
| BUG-017 | Low | Mock provider toggle clutters chat header (UNCONFIRMED) | TBD |
| BUG-019 | Low | Canvas Chat reports "empty" after page reload until Load demo clicked | rc.8 |
| BUG-021 | Medium | AI performance — Gemini slow, OpenAI prompt caching not wired | rc.8 |
| BUG-022 | Medium | Chat UI polish (button + skills tabs + spacing + status UX) | v3.1 crown-jewel |
| BUG-025 | Low | Cmd+K shortcut opens legacy AiAssistOverlay instead of CanvasChat (deleted in Step E — re-verify) | rc.7 (auto-resolved?) |
| BUG-027 | Low | Test pass briefly flashes file content on page load (residual cloak) | rc.8 polish |
| BUG-028 | Medium | Canvas AI Assistant chat closes when user clicks Skills button | rc.7-polish |
| BUG-032 | Medium | Gaps tab desired-state asset linking button greyed-out (DEFERRED — needs user repro) | rc.6.1 / rc.7 |
| BUG-036 | High | Canvas AI reports "empty" when user entered data via v2 UI tabs (v2-v3 sync gap) | likely auto-resolves with rc.7 view migration |
| BUG-037 | Low | Chat lacks visual differentiation between user / assistant messages | v3.1 crown-jewel |
| BUG-038 | Medium | Skill Builder UI is text-heavy / primitive | v3.1 crown-jewel |
| BUG-039 | Medium | Vendor mix % misleading (counts records, not deployment scale) | v3.1+ data-model widening |
| BUG-040 | Medium | Workload can map to retired asset (relationship invariant gap) | rc.8 / GA hardening |
| BUG-042 | Low | Demo-mode banner missing on Tab 4 Gaps via live demo-loader | rc.7 / 7e-post |

**Closed since rc.6 tag**: BUG-041 (AI Assist provider popover stale snapshot · `709e778`).

---

## 4 · Backlog beyond rc.7

### rc.8 / GA hardening
- **R8 invariant arc** (6 deferred items from rc.7 / 7e-8 — see HANDOFF "Open R8 backlog" table):
  - #1 v3 `updateGap` — AL10 / `validateActionLinks` enforcement on reviewed-flip
  - #2 v3 `mapWorkloadAssets` — self-map / workload→workload / cross-state / dedupe invariants
  - #3 v3 `_gapUnlinkInstance` — AL-rule throw on unlinking last required link
  - #4 v3 `_gapLinkInstance` — PHASE_CONFLICT_NEEDS_ACK on phase-mismatched link
  - #5 v3 setPrimaryLayer-rebalance + auto-flip-reviewed contracts (T6.6 / PR5 / RH7-19 retired)
  - #6 manual-add-dialog reviewed:true UI-contract test (T6.5 retired)
- BUG-040 relationship-invariant audit (workload → retire asset; gap.related* → orphans)
- BUG-001/002 propagate-criticality root-cause closure
- BUG-021 AI performance (OpenAI prompt caching wiring)
- Real-LLM live-key smoke at PREFLIGHT 5b · GA gate
- Real-customer `.canvas` migration smoke · GA gate
- Pre-GA hardening + workshop validation round 2
- Merge `v3.0-data-architecture` → `main`

### v3.1 crown-jewel UI polish
- BUG-022 modern chat shell
- BUG-037 user / assistant message differentiation
- BUG-038 Skill Builder UX redesign
- GPLC-aligned visual polish (per `project_crown_jewel_design.md`)
- Whitespace · drawer IA · icons · tag vocab · color discipline (5 ranked factors)
- v2.5.0 / v2.5.1 split per `project_crown_jewel_design.md`

### v3.1+ data-model widening
- BUG-039 vendor mix deployment-scale field (`instance.deployedQuantity` schema change → migrator + V-MIG vectors)
- Possible: relationship-strength typing for gap.related* edges
- Possible: cross-environment workload mapping with explicit affectedEnvironments

### v3.x naming pass (after v2 fully retired)
- Drop `v3` prefix from module / symbol / UI names per `feedback_no_version_prefix_in_names.md`
- Mechanical rename only — no behaviour change

---

## 5 · Locked discipline (binding for every commit)

These are the non-negotiable rules every session and every commit must follow. Full text in [docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md](docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md).

- **R0** acknowledge "what would a principal architect do?" before non-trivial action
- **R1** own-grep before delete (no closed-list scope)
- **R2** migrate consumers FIRST · delete LAST
- **R3** Chrome MCP browser smoke at every commit boundary
- **R4** no v3-store backward-compat hacks
- **R5** no fig-leaf test fixtures hiding v2 logic
- **R6** rewrite tests to assert v3 contracts (never retire-with-negative)
- **R7** per-commit revertibility (REVERT, don't fix forward when smoke fails)
- **R8** surface scope balloons (don't ship "fix forward" without user direction)
- **R9** every handover references this discipline
- **R10** acknowledge in every action out loud
- **R11** Recite + Answer + Execute + Pledge-Smoke-Screenshot at every step boundary · `Browser smoke evidence:` block in every commit message · test banner alone is a discipline violation

Companion locks (memory anchors auto-loaded each session):
- `feedback_no_mocks.md` — no mock providers, no scripted-LLM fixtures, real-LLM smoke is validation
- `feedback_spec_and_test_first.md` — SPEC + RULES + V-* tests authored BEFORE implementation
- `feedback_test_or_it_didnt_ship.md` — every BUG-NNN fix MUST add a regression test
- `feedback_no_patches_flag_first.md` — patches that bypass schema/validation/architecture are forbidden; surface alternatives first
- `feedback_browser_smoke_required.md` — every tag MUST include Chrome MCP smoke + real-LLM smoke at PREFLIGHT 5b
- `feedback_no_push_without_approval.md` — never `git push` without explicit user instruction
- `feedback_dockerfile_whitelist.md` — every new top-level dir → Dockerfile COPY in the same commit

---

## 6 · How a fresh session picks this up

1. Read this `ROADMAP.md` first for the big picture.
2. Read [HANDOFF.md](HANDOFF.md) for operational detail (current HEAD, last commits, the active strategic fork).
3. Read [memory/feedback_principal_architect_discipline.md](memory/feedback_principal_architect_discipline.md) — tier-1 anchor; loads first via MEMORY.md.
4. Run `docker compose up -d --build` and verify banner matches §0 above.
5. Pick up where HANDOFF's "Brief prompt to continue" leaves off — DO NOT pick the (a)/(b) strategic fork unilaterally; wait for user direction.

---

## 7 · Update protocol for this document

This file is the single canonical roadmap. Update it when:
- A new release ships (move row from §2 In flight to §1 Released)
- A bug is closed (remove row from §3, add to release notes)
- A new bug is reported (add row to §3 with severity + scheduled bucket)
- A scope decision changes (update §2 estimates or §4 backlog)
- The R8 backlog table in HANDOFF.md grows (mirror to §4 rc.8)

Detail belongs in source-of-truth docs (HANDOFF for operational, BUG_LOG for bug detail, RELEASE_NOTES for shipped detail). This roadmap stays under ~250 lines so it's actually scannable.
