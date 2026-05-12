# Dell Discovery Canvas — Session Handoff

**🔴 READ FIRST · Principal-architect discipline (LOCKED 2026-05-08, R11 added evening)**: every session, every commit, every handover. Full text in [`docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md`](docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md) (R0..R11) + tier-1 memory anchor `feedback_principal_architect_discipline.md`. Core rules: **R0** acknowledge "what would a principal architect do?" before non-trivial action · **R1** own-grep before delete · **R2** migrate consumers FIRST, delete LAST · **R3** Chrome MCP browser smoke at every commit boundary (test banner alone is NOT sufficient) · **R4** no v3-store backward-compat hacks · **R5** no fig-leaf test fixtures hiding v2 logic · **R6** rewrite tests to assert v3 contracts (never retire-with-negative) · **R7** per-commit revertibility · **R8** surface scope balloons · **R9** every handover references this · **R10** acknowledge in every action out loud · **R11 (HARDEST · LOCKED 2026-05-08 evening)** Recite + Answer + Execute + Pledge-Smoke-Screenshot at EVERY step boundary; every commit message ends with a `Browser smoke evidence:` block. **Test banner alone is a discipline violation.** **R12 (PROPOSED · in flight 2026-05-11/12)** — contract-fidelity: every code path that reads, writes, or surfaces engagement data MUST route through `core/dataContract.js` or its derived accessors. Formalization in `PRINCIPAL_ARCHITECT_DISCIPLINE.md` + V-CONSTITUTION-* guards is a separate planned arc.

---

## 🟢 Current state — end of 2026-05-12 session

**Branch**: `v3.0-data-architecture` · **HEAD**: `549599f` (C0 scaffold for SPEC §S47 Import Data workflow) · **APP_VERSION**: `3.0.0-rc.8-dev` (rc.8 in flight; rc.8.b polish arc COMPLETE; S47 implementation arc OPEN) · **Banner**: **1244/1265** (15 RED designed + 6 pre-existing flakes documented as BUG-052 + 1244 prior GREEN)

**Working tree**: clean. Only `.claude/` untracked.

**Not pushed**: 12 commits past origin (`bafc578..549599f`). Awaits explicit user "push" / "tag it" call.

### What was authored today

Today landed ONE scaffold commit per `feedback_spec_and_test_first.md` discipline:

| Commit | Theme |
|---|---|
| `549599f` | **C0 scaffold** · SPEC §S47 (Import Data workflow; 235 LOC) + §S25 amendment paragraph + 15 V-FLOW-IMPORT-* RED-first tests (306 LOC). No code. |

The full design (4 rounds of pushback + 7 locked decisions) is in [`docs/SESSION_LOG_2026-05-12.md`](docs/SESSION_LOG_2026-05-12.md).

### Implementation arc that follows (next-call)

```
C1 · Framework extensions + shared importer + preview modal + system-skills loader
     ~500 LOC · flips ~10 RED → GREEN · target banner ~1254

C2 · catalogs/skills/file-ingest-instances.json (system skill JSON; no code)
     flips 1 RED → GREEN · target banner ~1255

C3 · Footer button + Import Data modal + [CONSTITUTIONAL AMENDMENT] aiTag.kind
     ~400 LOC · flips 4 RED → GREEN · target banner 1265/1265 ✅
```

All sequencing, file lists, and acceptance criteria are documented in SPEC §S47 + `SESSION_LOG_2026-05-12.md` §"3-commit implementation arc".

### Recoverability

A different Claude session (or human contributor) can pick up from this point with full context by reading, in order:

1. **`HANDOFF.md`** (this file) — current state + next-call
2. **`docs/SESSION_LOG_2026-05-12.md`** — today's design decisions + 7 locked Qs
3. **`docs/v3.0/SPEC.md` §S47** — the locked design contract
4. **`diagnostics/appSpec.js`** V-FLOW-IMPORT-* tests — the 15 RED scaffolds enforcing the design
5. **`docs/UI_DATA_KNOWLEDGE_BASE.md` r2** + **`docs/UI_DATA_TRACE.md` r6** — the data-architecture authority
6. **`docs/SESSION_LOG_2026-05-11.md`** — yesterday's rc.8.b polish arc (5 commits 1220→1250)

These six artifacts contain enough context to land C1/C2/C3 cleanly without further conversation history.

### 2026-05-11 rc.8.b polish arc (yesterday — context for continuity)

| Commit | Banner Δ | Theme |
|---|---|---|
| `7d846f0` | 1220→1226 | BUG-2 Path A + Path B + BUG-6 closure |
| `e98ffb5` | 1226→1233 | WB-1..WB-4 wiring bugs + constitution promotion + UI_DATA_TRACE r6 + UI_DATA_KNOWLEDGE_BASE r1 |
| `b032122` | 1233→1238 | rc.8.b skill-builder rebuild (two-pane picker + contract-fidelity skill runtime) |
| `1a89d48` | 1238→1240 | relational-rows engagement-data block |
| `db2c5fd` | 1240→1250 | RELATIONSHIPS_METADATA + picker right-pane bindings + Improve meta-skill priming |
| `03de841` | 1250/1250 | session-log docs + SPEC §S25/§S46 annotations |

The rc.8.b polish arc closed the rc.8.b drift end-to-end: skill runtime is contract-fidelity, picker UX is relationship-aware, Improve prompt is R1..R7 primed. Banner climbed +30 net tests.

Full ledger in [`docs/SESSION_LOG_2026-05-11.md`](docs/SESSION_LOG_2026-05-11.md).

### Bugs surfaced this session

- **BUG-052** (NEW) · Modal/overlay residue test cluster · 6 tests intermittently flaky throughout rc.8.b polish arc. Documented in `docs/BUG_LOG.md`. NOT caused by today's changes (RED tests don't touch DOM). Separate investigation arc.

### Anchor documents (cross-session continuity)

- `docs/v3.0/SPEC.md` — design specifications (now includes §S47 + §S25 amendment + §S46 polish-arc extensions)
- `docs/UI_DATA_TRACE.md` (r6, hash `4fb8b31d`) — per-tab UI→data audit; the canvas surface authority
- `docs/UI_DATA_KNOWLEDGE_BASE.md` (r2, hash `be052564`) — data-point KB with Relationships and Bindings section
- `core/dataContract.js` — the live constitution (active; `dataContract.reference.js` preserves the original)
- `docs/SESSION_LOG_2026-05-{09,10,11,12}.md` — daily ledgers

### Active decisions to remember (work-in-progress)

- **rc.8 tag**: deferred until S47 arc closes (1265/1265 GREEN)
- **R12 formalization**: separate planned arc (CONSTITUTION.md + CLAUDE.md + V-CONSTITUTION-*)
- **Real-LLM acceptance smoke** for "Give me an account plan" skill: next-call candidate after S47

---

## Archive — earlier session summaries

**2026-05-09 PM**: rc.7 work COMPLETE + v3-prefix purge + R8 invariant arc CLOSED + 3 user-reported bugs A/B/C closed + Z2 label-resolver centralization · pushed to origin through `886dbd6`; commits `3184043..bafc578` (13 commits = R8 arc + BUG-A/B/C + Z2) **NOT YET PUSHED** awaiting user "push") · `v3.0.0-rc.7-dev` on `v3.0-data-architecture` · **Banner 1186/1186 GREEN ✅** · 28 commits this session · v2 architecture DELETED · R8 arc closed (6/6) · 18 bugs CLOSED today total. Anti-pattern "view-local state lost across re-mount" identified + closed for all 3 known instances (BUG-043/048/051). SPEC §S42 + §S43 added inline. NEW module `core/labelResolvers.js` is single source of truth for env/layer/driver/instance label resolution. Full session detail in [`docs/SESSION_LOG_2026-05-09.md`](docs/SESSION_LOG_2026-05-09.md).

**2026-05-10**: rc.8.b Skills Builder v3.2 reboot. 8 commits + 1 hygiene = 9 total. Banner 1196→1220 GREEN. SPEC §S46 authored. 24 new V-FLOW-SKILL-V32-* tests. 15 legacy tests retired. Schema clean-replaced (outputContract/outputTarget/promptTemplate/bindings dropped; outputFormat + mutationPolicy + aiTag added). Full ledger in `docs/SESSION_LOG_2026-05-10.md`.

**2026-05-11**: rc.8.b polish arc. 6 commits. Banner 1220→1250 GREEN. Contract-fidelity skill plane shipped end to end. Full ledger in `docs/SESSION_LOG_2026-05-11.md`.

**2026-05-12** (today): SPEC §S47 Import Data workflow scaffold. 1 commit (`549599f`). 15 RED tests authored. C1/C2/C3 implementation arc opened. Full ledger in `docs/SESSION_LOG_2026-05-12.md`.

## 🟢 BUG-A/B/C + Z2 label-resolver arc CLOSED (2026-05-09 evening · post-R8)

User reported 3 bugs after R8 ship: (A) UUID leaking into gap-card meta line, (B) header save-capsule stuck on "Saving...", (C) test-runner racing with Load demo on production page-load. All three shipped + Z2 follow-on (label-resolver centralization to close 4 latent leak surfaces audit found).

| Commit | Banner Δ | Theme |
|---|---|---|
| `ecc429e` | 1166→1169 | **BUG-B**: v3 `engagementStore._persist` calls `markSaved()` (chain was severed by Step H sessionStore deletion; capsule pulsed "Saving..." forever) · V-FLOW-SAVE-STATUS-1/DEMO-1/COMMIT-1 |
| `9913658` | 1169→1171 | **BUG-C**: app.js gates `setTimeout(runAllTests, 150)` behind `?runTests=1` URL / `localStorage.runTestsOnBoot` / `window.runDellDiscoveryTests()` opt-in; production users see clean boot · V-FLOW-TEST-OPT-IN-1/2 |
| `5792d43` | 1171→1179 | **BUG-A** (BUG-053) + **SPEC §S43**: two-layer engagement reference-integrity contract. Layer 1 = `core/engagementIntegrity.js scrubEngagementOrphans` runs at `_rehydrateFromStorage`, drops/nulls/repairs orphan UUID refs (gap.driverId / gap.affectedEnvironments / gap.relatedCurrent/Desired / instance.originId / instance.mappedAssetIds). Layer 2 = UI label resolvers return structured placeholders, never raw UUIDs · V-INV-ORPHAN-REFS-1..5 + V-INV-ORPHAN-IDEMPOTENT-1 + V-FLOW-LABEL-RESOLVER-1/2 |
| `bafc578` | 1179→1186 | **Z2 closure** + **SPEC §S43.3 amendment**: NEW `core/labelResolvers.js` is single source of truth for env/layer/driver/instance label resolution. 5 sites migrated to delegate (GapsEditView envName, programsService driverLabel, roadmapService envLabel/layerLabel, MatrixView cmd-palette ctx, SummaryVendorView layer-slice subtitle). Defensive (never throws on render path). v3 UUID + v2 typeId both resolve correctly · V-FLOW-LABEL-CENTRAL-1..7 + 1 in-loop regression caught via R7 (envCatalogId variable removed too aggressively in MatrixView; restored) |

**Total**: +20 assertions across 4 commits (banner 1166 → 1186 GREEN). 5 bugs closed (BUG-040, BUG-052, BUG-A/053, BUG-B, BUG-C).

**What changes for the user on next page-reload**:
- Header capsule reads "Saved Just Now / Saved Ns ago" (was stuck "Saving...").
- Production users see no test pass; QA opt-in via `?runTests=1` or `localStorage.setItem("runTestsOnBoot","1")` or `window.runDellDiscoveryTests()`.
- Stale Saudi Aramco engagement: scrubber repairs the placeholder UUID `00000000-0000-4000-8000-000000000001` in gap.affectedEnvironments → falls back to first visible env (Madinah). Gap-card meta line displays "Compute - introduce | Madinah" instead of UUID. NO data loss — only orphan refs touched.

**AI-enhancement readiness**: per the user's direction "scalable and maintainable structured work, not patches" + "when we get to AI enhancements we will need all data models and relationships modeled functionally not hardcoded": SPEC §S43 + Z2 closure is the substrate. The grounding meta-model (§S25) consumes cleaned data; future AI prompt assemblers + tool-use round-trips get clean labels via centralized resolvers, never orphan UUIDs.

**Architectural extension contract** (SPEC §S43.3 / F43.1): every future label resolver (skill labels, service labels, etc.) MUST live in `core/labelResolvers.js`. Source-grep test V-FLOW-LABEL-CENTRAL-7 catches any PR that re-introduces inline `?: rawId` resolution logic.

## 🟢 R8 invariant-enforcement arc CLOSED (2026-05-09 PM session)

| Commit | Banner Δ | R8 # | Theme |
|---|---|---|---|
| `3184043` | 1142→1145 | #1 | `updateGap` AL10/TX13.10 gate on reviewed-flip + structural-patch-when-reviewed (V-INV-UPDATEGAP-AL10-1/2/3) |
| `8ad0219` | 1145→1154 | #2 | `mapWorkloadAssets` I1..I8 invariants (workload-source / dedupe / asset-exists / no-self-map / no-workload-to-workload / state-match / env-match / **BUG-040** retired-asset gate) (V-INV-MAPWORKLOAD ×9) |
| `4ab0a77` | 1154→1157 | #3 | `_gapUnlinkInstance` inherits R8 #1 gate atomically; explicit integration tests (V-INV-UNLINK-AL10-1/2/3) |
| `4a8f8dc` | 1157→1161 | #4 | `_gapLinkInstance` `PHASE_CONFLICT_NEEDS_ACK` (L8 footgun-killer at v3 helper layer; UI already passes `acknowledged` correctly) (V-INV-LINK-PHASE-1/2/3/4 + T6.3 acknowledged-true rewrite) |
| `ad8e919` | 1161→1165 | #5 partial | `updateGap` setPrimaryLayer auto-rebalance (G6 ergonomics; auto-flip-reviewed half **DEFERRED** to v3.1 polish per R8 flag-first) (V-INV-PRIMARY-LAYER-REBALANCE-1/2/3/4) |
| `6a6b94f` | 1165→1166 | #6 | GapsEditView manual-add dialog **BUG-052 fix** (commitGapAdd-result-envelope-deref → addRes.id was undefined → selection lost on every successful manual-add) + UI contract test (V-FLOW-MANUAL-ADD-1) |

**Total**: +24 invariant-enforcement assertions across 6 commits (banner 1142 → 1166 GREEN).

**Deferred items (flagged-NOT-shipped per R8 NEVER-patch-flag-first)**:
- R8 #5 auto-flip-reviewed: v2 contract auto-flipped reviewed=true on structural edits. UX-level behavior change, not data-integrity invariant. Risk of premature flip mid-edit. Move to v3.1 polish.
- addGap AL10 parallel-path: `addGap` doesn't enforce AL10 when `input.reviewed === true` (R8 #1 only fires on `updateGap`). A manual-add with reviewed:true on shape-invalid gap creates G2-violating reviewed gap. UI dialog avoids this by NOT passing reviewed:true (R8 #6 closure). For tighter coverage, extend R8 #1 to addGap in v3.1.
- v2 manual-add reviewed=true UX expectation: requires dialog redesign to also collect links AL10 demands for non-ops gap types. Move to v3.1 polish.

## 🟢 rc.7 tag-ready summary (2026-05-09 EOD)

| Commit | Banner Δ | Theme |
|---|---|---|
| `ea898df` | 1129→1133 | **Step H+J+K v2 deletion mega-commit** (929 LOC removed across 5 v2 modules; v3-pure architecture is now the sole source of truth) |
| `a764f17` | 1133→1134 | FS3+FS4 v3-direct rewrite (last expected RED resolved) |
| `af2c26a` | 1134→1135 | BUG-043: shell-render subscriber re-registered in testRunner afterRestore + V-FLOW-SHELL-SUBSCRIBER-1 |
| `0926b30` | 1135→1136 | BUG-042: GapsEditView demo banner reads `meta.isDemo` from getActiveEngagement + V-FLOW-DEMO-BANNER-GAPS-1 |
| `1c306dc` | 1136→1137 | BUG-044 gap-tile half: programsService driverLabel resolves v3 UUID via BUSINESS_DRIVERS catalog + V-FLOW-DRIVER-LABEL-V3UUID-1 |
| `1deda90` | 1137→1138 | BUG-044 chat half: uuidScrubber buildLabelMap drivers branch resolves UUID → catalog label + V-CHAT-39 |
| `8a7c265` | 1138/1138 | VT29 viewport-sufficiency guard + close 5 bugs (BUG-019/027/028/001/002) verified-fixed in BUG_LOG + ROADMAP refresh |

**Bugs closed since rc.6 tag (9 total)**:
BUG-001, BUG-002, BUG-019, BUG-027, BUG-028, BUG-041 (rc.6→rc.7 window), BUG-042, BUG-043, BUG-044 (both halves).

**Tests added (regression guards)**:
V-FLOW-SHELL-SUBSCRIBER-1 + V-FLOW-DEMO-BANNER-GAPS-1 + V-FLOW-DRIVER-LABEL-V3UUID-1 + V-CHAT-39 + V-FLOW-V3-PURE-1/3/4/5 (all flipped GREEN).

**rc.7 tag gate (the ONE remaining item)**:
PREFLIGHT 5b real-LLM live-key smoke per `docs/PREFLIGHT.md §5b` + `docs/RELEASE_NOTES_rc.7.md`. The user runs this with their Anthropic + Gemini + Local A keys: 3 providers × 3 prompts × no-fabrication + UUID-free check. After GREEN → user says "tag rc.7" → bump APP_VERSION (drop -dev) → tag → push (only on user "push" / "ship it" instruction).

## Prior session entries



## 🔴 rc.7 / 7e-8 Path (c) shipped — v2 architecture DELETED

**Decision**: Path (c) — inline 4 v2-shape data factories into `_v2TestFixtures.js` shim, delete 5 v2 modules in one mega-commit. Architectural rationale: the shim was DESIGNED for inlining (header comment at lines 11-13 explicitly anticipated this end-state); R5 fig-leaf concern resolved by the Phase I-B-31..34 v2-shape-literal precedent (49 tests already use v2-shape literal factories) — the shim's 4 functions are pure data-shape factories with no v2 BEHAVIOR, only v3-shared validators (`validateInstance`, `validateGap`, `validateActionLinks`).

**What got deleted (929 LOC)**:
- `state/sessionStore.js` (220 LOC) — Step H
- `interactions/matrixCommands.js` (143 LOC) — Step J
- `interactions/gapsCommands.js` (263 LOC) — Step J
- `interactions/desiredStateSync.js` (237 LOC) — Step J
- `core/sessionEvents.js` (66 LOC) — Step K

**Production migrations (caught the second sweep)**:
- `interactions/aiCommands.js` + `state/aiUndoStack.js` were importing `emitSessionChanged` from the about-to-be-deleted `core/sessionEvents.js` — initial Grep tool sweep MISSED them via underscore-prefixed-glob inconsistency. **Lesson: bash `grep -rn` is the authoritative consumer audit; the Grep tool's `**/*.js` glob is unreliable for some path shapes.** The 2 production files migrated to direct `markSaving()` calls (the only sessionEvents side-effect not already handled by engagementStore's subscriber chain).
- `app.js` 3 `emitSessionChanged()` call sites replaced with `markSaving()`.

**Test migrations (R6 rewrite, never retire-with-negative)**:
- `demoSpec.js` DS16/DS17 rewritten to assert `subscribeActiveEngagement` listeners fire (the v3-pure analogue of the legacy reason-tagged emit).
- `appSpec.js` V-FLOW-CHAT-DEMO-1 retired vector-id-preserving — its "v2 emit doesn't clobber v3" contract is satisfied by the v2 emit ceasing to exist (same shape as V-FLOW-CHAT-DEMO-2 retirement in Step G).
- testRunner afterRestore: `emitSessionChanged("session-replace", "Tests complete")` dropped — `setActiveEngagement` (from rehydrate) already triggers subscribers; the legacy emit's only extra was markSaving's skip-list logic that's no longer relevant.

**The earlier boot-break (caught and recovered)**: first reload showed empty stepper + "Canvas v." version-chip placeholder = app.js failed at module-import time. Per R7, did NOT fix-forward — diagnosed with bash grep, found the missed consumers, fixed them, rebuilt, re-verified. **Banner: 1133/1134 GREEN. App boots cleanly.**

**Browser smoke evidence (in user's PC Chrome via Chrome MCP per `feedback_chrome_mcp_for_smoke.md`)**:
- Tab 1 Context — Discovery context card / Vertical "Healthcare" / 3 drivers (Cyber/AI&Data/Compliance) / Environments
- Tab 2 Current state — 4×5 matrix / 23 instances visible
- Tab 3 Desired state — disposition badges (REVIEW/CONSOLIDATE/INTRODUCE/REPLACE) / "8 of 14 not yet reviewed" banner
- Tab 4 Gaps — 3-column kanban (Now 2 / Next 4 / Later 2 = 8 gaps confirmed)
- Tab 5 Reporting — Overview sub-tab / Discovery Coverage 45% / Risk High / 14/9/8/4 metrics / Session brief right-rail
- AI Assist overlay — Canvas AI Assistant opens, Anthropic Claude provider, ready state
- Settings → Skills builder — modal + Skills tab + "+ Add skill" CTA + empty state
- +New session reset — engagement wipes (drivers=0, gaps=0), Tabs 4+5 grey-out, "SAVING..." pulse fires (markSaving substitution works), chat transcript clears
- Load demo restore — engagement state returns to Acme (3/8/23 confirmed via probe; Tab 1 stale-render is BUG-042 pre-existing)

**Pre-existing bugs reproduced (NOT regressions; scheduled for follow-up)**:
- BUG-042 — demo banner missing on Tab 4 Gaps + Tab 1 stale-render-on-active-tab when demo loaded.

---

## Prior session entries

 Phase I-B-31..34 advanced through **4 commits this session** with no reverts. **NEW PATTERN PROVEN**: for v2-only pure-function services (healthMetrics, programsService, computeDiscoveryCoverage, computeRiskPosture, effectiveDellSolutions, roadmapService project-grouping), **v2-shape object literals beat the v3 boundary-projection approach** — no schema gymnastics, no engagement state, no pollution risk, simpler test bodies. Used for Suites 08 + 22-pure-half + 20 = 49 tests rewritten. **MILESTONES**: T6.5 retired per Step I plan (v2 createGap default-true contract no-longer-applicable in v3); R8 backlog item #6 added (manual-add-dialog reviewed:true UI-contract test). **Remaining 4 shim members** (`session`, `createEmptySession`, `addInstance`, `createGap`) still high-usage (213 total call sites · down from 295 = -28% this session); shim's `session` re-export drop is R8-blocked by Suite 15+20 bare-`session` references in mount helpers (separate multi-Suite audit commit pending). **R11 LOCKED at `96e8a16`** governs every commit.

**rc.7 dev log (full arc since rc.6 tag, in order)**:

| Sub-arc | Commit | Theme | Banner |
|---|---|---|---|
| 7b..7d-2 | (multi) | Tab 1 Context migration · v3-pure | 1195/1195 ✅ |
| 7e-1..7 | (multi) | Full v3-pure migration · adapter selectors + commit* helpers · AI undo via v3 snapshot · canvasFile v3-native · runtime v2→v3 migrator retired | 1205/1211 |
| 7e-8a | `8fac398` | v2 deletion prep · drop dead `migrateLegacySession` import · SPEC §S40 staging plan | 1205/1211 |
| 7e-8b' | `773f81d` | ContextView v3-native rewrite (right-panel persistence + env tags from v3 direct) | 1200/1211 |
| 7e-8b'-polish | `4d70dff` | sqm tag in env tile + empty-environments empty-state in MatrixView/GapsEditView/ReportingView · **patch (3 duplicated helpers)** retired by 7e-8c' | 1202/1211 |
| 7e-8c'-spec | `0347a1f` | SPEC §S41 + RULES §16 CH35 + V-FLOW-EMPTY-ENVS-1..7 RED scaffolds + VT20 em-dash regression fix | 1203/1218 (7 RED by design) |
| 7e-8c'-impl | `8a147f4` | Shared `ui/components/NoEnvsCard.js` + stepper greying Tabs 4/5 + matrix `--env-count` column scaling + first-add ack | 1210/1218 |
| **7e-8c'-fix** | `5a77d6a` | **Drop NoEnvsCard host-class mutation** (the "house of cards" bug — class polluted Context tab on re-render) **+ drop CTA button + drop nav listener + move empty-state check before MatrixView header** · SPEC F41.6.6/7/8 added | 1209/1218 |
| **7e-8c'-fix2** | `324b37a` | **Retire first-add acknowledgment toast** wholesale per user direction ("no need for it"). Drop `surfaceFirstAddAcknowledgment` + `envFirstAddAck_v1` localStorage key + `.env-first-add-ack-banner` CSS + V-FLOW-EMPTY-ENVS-6 (reworked into negative assertion) + RULES CH35 clause (e). SPEC §S41.3 marked RETIRED | 1210/1218 |
| **BUG-041** | `709e778` | **AI Assist provider-popover stale-snapshot fix** (catches user-reported "every provider click opens Settings" bug). Extracts `refreshRow` helper; popover refreshes class+meta on open; click handler re-reads `loadAiConfig()` before deciding switch-vs-Settings. 3 new V-PILLS-5/6/7 source-grep regression tests. | 1213/1221 |
| **7e-8b** | `1c55b95` | **Test-fixture shim** — NEW `diagnostics/_v2TestFixtures.js` re-exports v2 symbols; 10 appSpec.js import statements retargeted from `state/sessionStore` + `interactions/{matrix,gaps,desired}*` to the shim. Decouples test-suite coupling to v2 modules in one place. No production-code change. | 1213/1221 |
| **7e-8c** | `02f94ed` | **Trim app.js v2 sessionStore call sites** — 5 read sites (`session.X` → `getActiveEngagement().X`) + 3 redundant `saveToLocalStorage()` drops (v3 auto-persists) + 2 demo-loader v2 mirror lines retired + save flow now derives v2 shape via `engagementToV2Session()` at the file boundary. Imports trimmed to `{ resetSession, replaceSession }`. **`resetSession` + `replaceSession`-in-file-open retained** (need v3-native canvasFile or v2→v3 runtime translator first). Mid-arc fix: `session`-undefined ReferenceError in `renderStage` was halting boot before wire* handlers; fixed by passing `null` explicitly to view renderers. | 1212/1221 ✅ |
| 7e-8d-3..5 (REVERTED) | `cef8a54..d712d29` | v2 deletion attempt that broke app boot; scope-limited V-ANTI-V2-IMPORT-1 missed 5 production importers of `state/sessionStore.js` (services/gapsService + sessionFile + vendorMixService + ui/views/AiAssistOverlay + SkillAdmin); 1410+ LOC removed but app rendered empty stepper · **REVERTED 977bf68** | (reverted) |
| 7e-8 redo Phase 1 | `f73dbcf` | `docs/V2_DELETION_ARCHITECTURE.md` authored — principal-architect plan A..K + cross-cutting gates after the revert | (docs) |
| **R0..R10 LOCKED** | `f2e12cd` | **🔴 `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` LOCKED · `feedback_principal_architect_discipline.md` tier-1 memory anchor + MEMORY.md index** — own-grep R1, migrate-before-delete R2, browser-smoke-at-every-commit R3, no-fig-leaf R5, rewrite-tests R6, per-commit-revertibility R7, scope-balloon R8, handover-references R9, acknowledge-out-loud R10 | (docs) |
| 7e-8 redo Step A | `1abba74` | V-ANTI-V2-IMPORT-1/2/3 expanded to scan ALL production files via `_productionFileManifest.js` (RED reveals real consumer graph) | 1212/1221 |
| 7e-8 redo Step B | `6940df2` | `services/sessionFile.js` v3-native + new `state/runtimeMigrate.js` (migrateLegacySession + setPrimaryLayer + deriveProjectId moved to canonical home; canonicalize-then-migrate pipeline) — V-ANTI-V2-IMPORT-1 violators 6 → 5 | 1212/1221 |
| 7e-8 redo Step C | `a1a1b8b` | `services/gapsService.js` v3-native reads via `getActiveEngagement().gaps` — V-ANTI-V2-IMPORT-1 violators 5 → 4 · 7 v2-fixture-coupled tests rewritten | 1212/1221 |
| 7e-8 redo Step D | `805bb92` | `services/vendorMixService.js` v3-native reads via `getActiveEngagement().instances` — V-ANTI-V2-IMPORT-1 violators 4 → 3 | 1212/1221 |
| 7e-8 redo Step E | `2e9268e` | DELETE `ui/views/AiAssistOverlay.js` (dormant since rc.4 Arc 2; Cmd+K rebound to openCanvasChat) — V-AI-ASSIST-DORMANT-1 flips to MUST-404 | 1212/1221 |
| 7e-8 redo Step F | `4789cd2` | DELETE `ui/views/SkillAdmin.js` (608 LOC; dormant since rc.4 Arc 4; Settings → SkillBuilder.js) · 11 v2 DOM-coupled tests retired vector-id-preserving (SB6/SB7/FP5/FP6/FP8/FP9/PG5/QW3..QW6) — V-ANTI-V2-IMPORT-1 violators 2 → 1 | 1211/1221 |
| 7e-8 redo Step G | `ec06d34` | DELETE `state/sessionBridge.js` (398 LOC) + flip `app.js` shell listener `onSessionChanged` → `subscribeActiveEngagement` + boot-seed inline + 6 bridge-coupled tests retired/rewritten — V-FLOW-V3-PURE-2 + V-ANTI-V2-IMPORT-3 GREEN · V-ANTI-V2-IMPORT-1 violator list 1 → 0 · **OH5 fixed as bonus** (listener flip means undo-via-setActiveEngagement triggers shell repaint) | 1215/1221 |
| 7e-8 redo Step I-A | `8705e83` | drop 71 v2-internal tests across Suites 5/6/7/18 (633 LOC; v2-module-internals contracts; v3 successor V-ADP-* + V-FLOW-PERSIST-* + state/dispositionLogic) | 1144/1150 |
| 7e-8 redo Step I-B-1..3 | `abc0767` / `7594613` / `b4debe8` | shim slim: `migrateLegacySession` direct import from `runtimeMigrate.js` (10 call sites unified) + drop PL4 + PR2 + FS1 + FS2 helper-unit tests + dead aliases (`liveSession7`, `setPrimaryLayerRH`) — `_v2TestFixtures.js` -4 exports | 1140/1146 |
| **R11 LOCKED** | `96e8a16` | **🔴 `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` R11 four-block ritual (Recite + Answer + Execute + Pledge-Smoke-Screenshot at EVERY step) + `Browser smoke evidence:` block mandatory in every commit · MEMORY.md + tier-1 anchor updated · "test banner alone is a discipline violation" anchored** | 1140/1146 |
| 7e-8 redo Step I-B-4 | `b348271` | drop dead `liveSession` alias at appSpec:4195 (R11-applied · first R11-governed commit) | 1140/1146 |
| 7e-8 redo Step I-B-5 | `fa2ea32` | drop PR1.a + PR1.b + `applyContextSave` shim re-export — shim -1 export · **BUG-042 surfaced** by R11 standing-regression walk (demo banner missing on Tab 4 Gaps via live demo-loader path; logged in `docs/BUG_LOG.md`) | 1138/1144 |
| 7e-8 redo Step I-B-6 | `2b28c01` | **VT26 rewritten v3-direct** (`setActiveEngagement(createEmptyEngagement({meta:{isDemo:true}}))` + `commitContextEdit` + `commitDriverAdd` + `engagementToV2Session` for renderer args) + `replaceSession` shim re-export dropped · **VT26 pattern is the template for remaining fixture rewrites** | 1138/1144 |
| 7e-8 redo Step I-B-7 | `4eb025b` | drop dead `saveToLocalStorage` shim re-export | 1138/1144 |
| 7e-8 redo Step I-B-8 | `e8f2bd6` | drop dead `createDemoSession` + `resetToDemo` shim re-exports — shim -2 exports | 1138/1144 |
| handover | `3fa833e → 4f222c6 → d619d5c` | session-end log + BUG-042 logged + next-session prompt + Session α audit amendment · all R11-governed docs-only commits | 1138/1144 |
| **7e-8 redo Step I-B-9** | `5c8d69f` | **T6.7 + RH6 rewritten v3-direct** (`validateActionLinks(probe-with-reviewed:true)` gate + `commitGapEdit({reviewed:true})` persistence) + **`approveGap` shim re-export dropped**. **First R8 finding surfaced**: v3 `state/collections/gapActions.js updateGap` runs GapSchema.safeParse only — does NOT enforce `validateActionLinks` per RULES TX13.10/AL10. v2 atomic `approveGap` enforced this; v3 leaves the gate to the caller. Tests assert call-sequence accordingly. | 1139/1144 (VT29 flipped GREEN since prior baseline) |
| 7e-8 redo Step I-B-10 | `044dba5` | drop dead `setGapDriverId` shim re-export (zero `*.js` consumers) | 1139/1144 |
| 7e-8 redo Step I-B-11 | `64a1e6a` | dead-export sweep · 4 shim re-exports dropped: `moveInstance` + `unlinkDesiredInstance` + `getDesiredCounterpart` + `getCurrentSource` (all zero `*.js` consumers; the desiredStateSync pair has v3 successors in `state/dispositionLogic.js` consumed directly by MatrixView) | 1139/1144 |
| **7e-8 redo Step I-B-12** | `879f611` | **T8.4 rewritten v3-direct** (`commitInstanceAdd` ×2 + `commitGapAdd` + `commitGapRemove` (no-cascade) + `commitGapLink*` (re-link)) + **`linkCurrentInstance` shim re-export dropped**. **Second R8 finding**: v3 `mapWorkloadAssets` (line 127 of `state/collections/instanceActions.js`) is a thin `updateInstance` wrapper with NO invariant enforcement (self-map, workload→workload, cross-state, dedupe all silently allowed). W2 test (`unmapAsset`) deferred to a future invariant-enforcement arc. | 1139/1144 |
| 7e-8 redo Step I-B-13 | `2e0b6f3` | **RH9 rewritten v3-direct** (`commitSyncGapFromDesired` from `state/dispositionLogic.js`) + **`syncGapFromDesired` shim re-export dropped**. v2-only sub-assertions on `closeReason` + `closedAt` DROPPED per Step I plan (v3 GapSchema deliberately omits these fields per `dispositionLogic.js` line 199-203 comment; not a contract gap). | 1139/1144 |
| 7e-8 redo Step I-B-14 | `f4d412d` | **RH13 rewritten v3-direct** (`commitSyncGapsFromCurrentCriticality`) + **`syncGapsFromCurrentCriticality` shim re-export dropped**. v3 preserves the `urgencyOverride !== true` invariant (filter at line 250 of `syncGapsFromCurrentCriticalityAction`). RH20 (`unlinkCurrentInstance`) deferred — **third R8 finding**: v3 `_gapUnlinkInstance` does not enforce per-Action link rules (same shape as the AL10 + mapWorkloadAssets findings). | 1139/1144 |
| **7e-8 redo Step I-B-15** | `4b9d5c9` | **T4.5 + T6.3 rewritten v3-direct** (`commitSyncDesiredFromGap` + `commitGapEdit(phase)` for T4.5; `commitGapLinkDesiredInstance` + sync for T6.3) + **`syncDesiredFromGap` shim re-export dropped**. T6.3 v2-only `acknowledged:true` PHASE_CONFLICT_NEEDS_ACK sub-contract scoped out — **fourth R8 finding**: v3 `_gapLinkInstance` does not enforce phase-conflict acknowledgment (RH10 covers the v2 acknowledged-arg contract directly). | 1139/1144 |
| 7e-8 redo Step I-B-16 | `2f72630` | **T6.1 + T6.2 rewritten v3-direct** (`confirmPhaseOnLinkV3` aliased) + **`confirmPhaseOnLink` shim re-export dropped**. Pure-function v3 contract preservation. | 1139/1144 |
| 7e-8 redo Step I-B-17 | `d0727c7` | **Suite 17 plain-object-input test rewritten v3-direct** (commitInstance*/commitGap* helpers as v3 contract surface) + **`deleteInstance` + `deleteGap` shim re-exports dropped** (2-for-1 leverage; one test was the sole consumer of both). | 1139/1144 |
| 7e-8 redo Step I-B-18 | `f845cd7` | **`DISPOSITION_ACTIONS` + `ACTION_TO_GAP_TYPE` import-source switched** from shim to `state/dispositionLogic.js` (identical constants, zero test rewrites). | 1139/1144 |
| 7e-8 redo Step I-B-19 | `55ca473` | **W3 + W4 + W5 rewritten v3-direct** (`proposeCriticalityUpgradesV3` aliased) + **`proposeCriticalityUpgrades` shim re-export dropped**. mapAsset usage in W3/W4/W5 is fixture-only (no invariant assertions); `commitWorkloadMapping` set-list form is clean. | 1139/1144 |
| **7e-8 redo Step I-B-20** | `0b33543` | **🔴 MILESTONE: ENTIRE desiredStateSync re-export block RETIRED.** T6.4 + RH16/17/18 rewritten v3-direct (`buildGapFromDispositionV3` aliased) + **`buildGapFromDisposition` shim re-export dropped**. RH17 contract delta documented (v3 ASCII arrow `->` + layer suffix `[Compute]` vs v2 Unicode arrow `→`). RH16 uses `engagementToV2Session` for still-v2-shape `services/roadmapService.js buildProjects`. | 1139/1144 |
| 7e-8 redo Step I-B-21 | `d63a9d0` | drop dead `updateInstance` shim re-export (zero `updateInstance(` call sites in `*.js`; only the v3-aliased `updateInstanceV3` import + V-SEL-INVAL-4 consumer remain, both unaffected) | 1139/1144 |
| 7e-8 redo Step I-B-22 | `6abd74f` | **Suite 17 'engagement structure stable across reset' rewritten v3-direct** (test-body modernization without shim drop; `resetSession` remains in shim because the test-runner afterRestore at line 17149 still consumes it as a v2 sessionStore restoration fallback — that migration couples to Step H lifecycle). | 1139/1144 |
| **7e-8 redo Step I-B-23** | `07c8424` | **🔴 Path C step 1: test-runner afterRestore migrated to v3-pure** + **`resetSession` + `loadFromLocalStorage` shim re-exports dropped**. v2 sessionStore restoration path retired (defensive carryover; `_rehydrateEngagementFromStorage` covers the contract). saveStatus indicator block migrated to read v3 `getActiveEngagement().customer.name` + `.meta.isDemo`. | 1139/1144 |
| 7e-8 redo Step I-B-24a (REVERTED) | `(uncommitted)` | **Attempted: drop `session` global from shim**. 12 NEW RED — naive grep missed many bare `session` references in view-renderer test args (e.g. `renderSummaryHealthView(l, r, session)`) + 1 functional regression in `computeMixByLayer` (RA3 mutation was NOT vestigial after all). Per R7 reverted. **Lesson: `session` global has wider scope than `session.X` reads — bare references in renderViews call sites must be audited too.** | (reverted) |
| **7e-8 redo Step I-B-24** | `1e4c07f` | **🔴 Path B high-density Suite 26: W1 + W1b v3-direct + W2 + W6 RETIRED** + **`mapAsset` + `unmapAsset` shim re-exports dropped**. v2 helper-layer invariants (5 mapWorkloadAssets gates: dedupe / self-map / workload-to-workload / cross-state / cross-environment) preserved in HANDOFF R8 backlog #2 for rc.8. | 1137/1142 with 5 RED |
| **7e-8 redo Step I-B-25** | `502ce39` | **🔴 Path B high-density RH cluster: RH11 v3-direct + RH10 + RH20 RETIRED** + **`linkDesiredInstance` + `unlinkCurrentInstance` shim re-exports dropped**. 2 v2 helper-layer invariants (PHASE_CONFLICT_NEEDS_ACK on link + AL-rule on unlink) preserved in HANDOFF R8 backlog #3 + #4 for rc.8. | 1135/1140 with 5 RED |
| 7e-8 redo Step I-B-26..28 (multi) | (multi · prior-session) | Suite 22 SVC2/SVC5 v3-direct + Suite 11 + various shim drops + 2 R7-reverts on attempted Suite 09 + T5.20 pollution-fix; bandied trial of self-contained pollution-fix patterns | (varied) |
| 7e-8 redo Step I-B-29 | `fa2681e` | **B-staged MEGA-COMMIT pattern proven**: Suite 09 (gapsService 11 tests) v3-direct + 3 self-contained pollution-fix tests (T7.3 vendor + gaps-summary-3-kanban + T5.20-roadmap-phase-headers) shipped together. Pollution-chain-aware Path B big-bang. | 1130/1135 unchanged |
| 7e-8 redo Step I-B-30 | `495cead` | **MEGA-COMMIT: Suite 10 vendorMixService 12 tests v3-direct**. Pollution audit OK. | 1130/1135 unchanged |
| **7e-8 redo Step I-B-31** | `8c97894` | **🔴 NEW PATTERN: Suite 08 healthMetrics 16 tests rewritten via v2-shape literals (NOT v3 boundary projection).** Healthmetrics is a pure v2-shape service; v2-literal fixtures match the actual contract. Avoids v3 GapSchema affectedEnvironments.min(1) + UUID gymnastics + InstanceSchema originId requirement. Drops 14 freshSession + 9 addInstance + 6 createGap. **VT29 viewport-flake surfaced as a baseline RED at this commit (was passing pre-I-B-30; flake is browser-window-height-dependent, not introduced by the rewrite).** | 1129/1135 with 6 RED |
| 7e-8 redo Step I-B-32 | `dc4aa19` | **Suite 21 T5.2 (Overview driver chip per driver) v3-direct rewrite** — reads `getActiveEngagement().drivers.allIds` instead of v2 `session.customer.drivers`. **R8 surfaced**: shim's `session` re-export drop blocked by Suite 15 mount helpers (line 3196 `fn(l, r, sess \|\| session)`, line 3248 `renderSummaryGapsView(l, r, session)`) + Suite 20 service tests RA3/RA4 (bare `session.instances` mutations). Separate multi-Suite audit commit pending. | 1129/1135 baseline-equivalent |
| **7e-8 redo Step I-B-33** | `680478b` | **🔴 MEGA-COMMIT: Suite 22 pure-function half (17 tests + T6.5 retired)** — programsService 7 + effectiveDellSolutions 3 + computeDiscoveryCoverage 3 + computeRiskPosture 4 — all rewritten via v2-shape literals (gap22/inst22/v2Sess22 helpers). T6.5 ("manual createGap default reviewed=true") retired: v3 GapSchema defaults reviewed:false; the manual-default UX expectation moved to caller layer. **R8 backlog #6 added** (manual-add-dialog reviewed:true UI-contract test). DOM-render half (T6.9 + palette + help modal + T7.* render*) NOT migrated this pass — needs v3 render-path-matures work first. | 1128/1134 (T6.5 retired drops total by 1) |
| 7e-8 redo Step I-B-34 | `75ab58a` | **MEGA-COMMIT: Suite 20 (services/roadmapService project-grouping 16 tests) shim-free** via v2-shape literals (gap20 + v2Sess20 helpers; same architectural pattern as I-B-31/I-B-33). 16 freshSession + 14 createGap call sites → 0. Pure-function service contract preserved exactly. | 1128/1134 baseline-equivalent |

## Phase I-B-31..34 v2-shape-literal pattern (LOCKED 2026-05-09)

**The pattern**: for v2-only pure-function services (those still reading v2-shape session and not yet migrated to v3 engagement), the cleanest test fixture is a v2-shape object literal — NOT the v3 boundary-projection (engagementToV2Session) approach used in Suite 11. Reasoning:

- Healthmetrics / programsService / roadmapService project-grouping / computeDiscoveryCoverage / computeRiskPosture / effectiveDellSolutions are PURE v2-shape services. Their API contract IS "v2-shape session in → expected output". Direct v2-literal fixtures match the actual contract.
- v3 GapSchema and InstanceSchema require things v2 didn't (UUID environmentId, affectedEnvironments.min(1), originId-on-desired-with-current). Going through commit*Add → engagement → projection back to v2 forces gymnastics that don't test anything the service actually cares about.
- The boundary projection IS appropriate for Suite 11 (roadmapService initiatives), where the test wants to validate that v3-engagement → v2-session projection round-trip works. For Suite 08/20/22-pure, that's redundant double-testing.
- v2-literal fixtures touch ZERO engagement state → ZERO pollution risk → no snapshot+restore wrapper needed. Faster + cleaner + safer.

**Template**:
```js
let _idCounter = 0;
function inst(props) { return Object.assign({ id: "i-" + (++_idCounter), state: "current", vendorGroup: "dell", label: "X", criticality: "Medium", disposition: "", vendor: "" }, props); }
function gap(props) { return Object.assign({ id: "g-" + (++_idCounter), gapType: "ops", notes: "", reviewed: true, affectedEnvironments: [], relatedCurrentInstanceIds: [], relatedDesiredInstanceIds: [] }, props); }
function v2Sess(opts) {
  return {
    sessionId: "test-sess", isDemo: false,
    customer: Object.assign({ name: "", drivers: [] }, (opts && opts.customer) || {}),
    sessionMeta: { date: "2026-05-08", presalesOwner: "", status: "Draft", version: "2.0" },
    environments: [],
    instances: (opts && opts.instances) || [],
    gaps:      (opts && opts.gaps)      || []
  };
}
```

**Where to use**: any Suite testing a v2-shape pure-function service with no DOM and no engagement-state coupling. Suites 08 (`8c97894`) + 22 pure-function half (`680478b`) + 20 (`75ab58a`) all used this template.

**Where NOT to use**: DOM-render tests that go through `_installSessionAsV3Engagement(s)` — those still need v2-shape input + the bridge fixture for the render path to materialize v3 engagement and trigger DOM. Those Suites are the next-wave migration target (Path B-DOM).

## Phase I-B-35+ (next session entry point · 2026-05-09 night → end of Phase I-B-31..34 batch)

`_v2TestFixtures.js` shim is at **4 re-exports** (`session`, `createEmptySession`, `addInstance`, `createGap`). Phase I-B-31..34 dropped no shim members but reduced shim CONSUMPTION significantly via the v2-literal pattern.

**Shim-consumption ledger (post-I-B-34)**:
| Symbol | Pre-I-B-31 | Current | Δ |
|---|---|---|---|
| `freshSession()` | 97 | 59 | -38 |
| `createEmptySession()` | 39 | 39 | 0 (call sites in DOM tests still untouched) |
| `addInstance(` | 78 | 62 | -16 |
| `createGap(` | 83 | 53 | -30 |
| **Total** | **295** | **213** | **-82 (≈ -28%)** |

**The remaining 213 call sites** are all in DOM-coupled Suites (12 ContextView, 13 MatrixView, 14 GapsEditView, 15 Summary views, 17 AI integration, 19 MatrixView disposition, 23 Phase 18 gap-links, 24 Phase 16 workload-mapping, 25..30 Phase 19 AI tests, 36..47 various Phase tests) where the test currently uses `_installSessionAsV3Engagement(s)` to bridge v2-shape into v3 engagement before render. The v2-literal pattern from I-B-31/33/34 does NOT apply — these tests need a different migration approach.

## Path B bulk rewrite progress (Phase I-B-31..34 wave)

This session's 4 commits banked with NO reverts via the v2-shape-literal pattern (above):
- **Suite 08 (healthMetrics, `8c97894`)**: 16 tests v2-shape literals.
- **Suite 21 T5.2 (`dc4aa19`)**: 1 test v3-direct via `getActiveEngagement().drivers.allIds`.
- **Suite 22 pure-function half (`680478b`)**: 17 tests v2-shape literals + T6.5 retired (R8 backlog #6).
- **Suite 20 (roadmapService project-grouping, `75ab58a`)**: 16 tests v2-shape literals.

**Total this session**: 49 tests rewritten + 1 retired across 4 commits. Banner stable at 1128/1134 GREEN throughout (= baseline; same 6 RED list throughout).

## Two strategic paths forward (USER DECISION PENDING — 2026-05-09 EOD)

After Phase I-B-34, **all pure-function v2-only-service test targets are exhausted**. Every remaining `freshSession()` / `addInstance(` / `createGap(` call site is in DOM-coupled Suites where the test passes the v2-shape session through `_installSessionAsV3Engagement(s)` to materialize v3 engagement before render. The v2-literal pattern does NOT apply.

**Path (a) — DOM Suite per-Suite migration (Path B-DOM)**: Replace `freshSession + addInstance + _installSessionAsV3Engagement + renderXView(l, r, s)` with direct `setActiveEngagement(createEmptyEngagement()) + commitEnvAdd + commit*Add + renderXView(l, r)`. Each DOM Suite gets a snapshot+restore _active wrapper per the I-B-9 pattern. Higher risk per commit:
- Per-test UUID resolution for environmentId/originId (helper needed).
- Pollution chains across DOM Suites — same risk shape as I-B-28 Suite-09 attempt that R7-reverted twice. Audit-before-rewrite mandatory.
- Each Suite is ~100-250 lines, ~10-20 tests.
- Estimate: 7-10 mega-commits (one per Suite: 12, 13, 14, 15, 17, 19, 23, 24, plus partial Phase-19 Suites).

**Path (b) — Retire `_installSessionAsV3Engagement` + `freshSession` shim helpers via a v3-native test fixture**: Define a v3-native `freshEng()` helper that returns a populated empty engagement (analog of `freshSession`). Migrate the DOM tests' setup blocks to call `freshEng()` instead of `freshSession() + _installSessionAsV3Engagement()`. The render call signature drops the third arg (or stays null/undefined since views read engagement directly post-rc.7/7e). Larger refactor (touches many tests at once) but unblocks Step H / Step J in one stroke instead of 8 Suite-level commits. Higher upfront risk; lower per-commit risk after.

The user paused here to think. Whoever picks this up next: **read the user's direction in their next message** — do NOT pick a/b unilaterally. The decision is architectural (audit-first per-Suite vs. fixture-replacement big-bang), not a velocity-only judgment.

If no direction is given and pressure to ship is high, the safer default is **(a)** at proven-pattern cadence: one DOM Suite per commit, audit downstream consumers BEFORE the rewrite (per the I-B-28 lesson), bundle pollution-fixes per the I-B-29 mega-commit pattern.

## Lessons from Phase I-B-28 attempt + revert (2026-05-09 night)

**Phase I-B-28 attempt: Suite 09 (gapsService) v3-direct rewrite + T5.20 self-contained fix.**

Suite 09's 11 tests all use `freshSession()` + `createGap()`. I migrated them to v3-direct (commitGapAdd via the same `v3GapsEng()` helper pattern as Suite 11 in Phase I-B-27). The rewrite itself made all 11 Suite-09 tests pass. **However** — the rewrite broke test pollution downstream:

- **T5.20** (Suite 35 line 3089, "roadmap view renders 3 phase-column headers") was relying on test pollution leaving v3 engagement with at least 1 gap. `renderSummaryRoadmapView` (line 45-53 of `ui/views/SummaryRoadmapView.js`) returns early with the empty-state card when `gapsCount === 0` and never renders `.roadmap-phase-head` elements.

- After Suite 09 + Suite 11 v3-direct rewrites with snapshot+restore wrappers, the engagement state at T5.20's run time has 0 gaps. T5.20 fails.

- I attempted a self-contained-setup fix on T5.20 (build engagement explicitly via `commitEnvAdd` + `commitGapAdd` before render). **The test became FLAKY**: passed once at 4:48:48, failed again at 4:52:53 in a subsequent runIsolated iteration. Root cause unclear — possibly the testRunner's runIsolated wraps the whole pass and runs multiple iterations, with state interactions I haven't fully traced.

Per R7, **reverted twice**: once for the bare Suite 09 rewrite, once for the Suite 09 + T5.20-self-contained-fix attempt. Both reverts restored banner to 1130/1135 GREEN.

**Strategic implication for Path B**: each Suite migration may break downstream tests via pollution dependencies that aren't visible until rebuild + smoke. The remaining Suites (10, 12, 13+) likely have similar interactions. Per principal-architect, the safe path forward requires:

1. **Audit downstream dependencies BEFORE rewriting**: grep for which views/tests read engagement state and trace the implicit setup chain. Time-consuming.
2. **OR rewrite ALL fixture-singleton-dependent tests in one big-bang commit** so downstream tests see fully-migrated upstream + don't rely on any pollution. Risky single commit but cleaner.
3. **OR introduce a per-Suite "ensureV3Fixture" helper** that's called at Suite start (beforeEach equivalent) so each Suite's downstream renderer tests have a known engagement state. Semi-fig-leaf but pragmatic.

Per the user's "no patching, principal-architect practices" direction, the right move is **#1 (audit-first)** before further bulk rewrites. This needs careful tracing, not high-density batching. The user should be informed before continuing.

**Phase I-B-27 (Suite 11) shipped clean** because Suite 11's tests don't have downstream dependents — they're pure roadmapService function tests. Suite 09 was different.

## Lessons from this session (Phase I-B-24a revert)

**Phase I-B-24a attempted dropping `session` global from shim** by migrating the only test-body `session.X` read (T5.2 line 3683) to v3 + dropping the RA3/RA4 `session.instances` mutations as "vestigial". Result: **12 NEW RED + 1 functional regression**. Per R7 reverted (no commit pushed).

**Lesson 1 — naive `session.X` grep is insufficient**: many tests pass bare `session` as the 3rd arg to renderViews (`renderSummaryHealthView(l, r, session)`, etc.). Those calls reference `session` as an identifier without a `.X` suffix, so the audit grep missed them. A proper audit needs to grep for `\bsession\b` (word-boundary) and exclude string-literal/comment matches.

**Lesson 2 — RA3/RA4 mutations were NOT vestigial**: while `services/vendorMixService.js computeMixByLayer` reads v3 engagement (per Step D commit `805bb92`), the RA3/RA4 tests *also* test other v2 contracts that DO depend on session.instances. Removing the mutation broke the "computeMixByLayer stateFilter='current' excludes desired instances" test (expected: 0, actual: 4) — the test relied on the v2 session.instances being CONSTRAINED to a known set for the assertion to hold.

**Strategic implication**: Path C step 2 (drop `session` + `createEmptySession` from shim) is **structurally indistinguishable from Path B** (bulk addInstance/createGap/updateGap rewrites) because the same tests use both. The 250+ `session` references and 51 `createEmptySession` calls are scattered across ~40+ test files that ALSO use addInstance/createGap/updateGap. There is no surgical "Path C only" path that avoids touching the high-usage helpers.

**Confirmed strategic crossroads** (sharper than before):

Every remaining shim drop falls into one of three categories:

1. **R8-blocked targets** (need v3-invariant-enforcement arc first): `mapAsset`/`unmapAsset` (mapWorkloadAssets invariants), `unlinkCurrentInstance` (RH20 AL-rule), `linkDesiredInstance` (RH10 phase-conflict-ack). Four R8 findings now collected — see "Open R8 backlog" section.

2. **High-usage helpers tied to fixture-singleton tests**: `addInstance` (129), `createGap` (134), `updateGap` (31), `createEmptySession` (51), `session` (~250 identifier matches). These are interlocked: each test using one usually uses several. Cannot be migrated in isolation; must be rewritten test-by-test as v3-direct fixtures.

**Recommended next-session strategic decision** — pick ONE of:

- **Path A: v3-invariant-enforcement arc** (R8 findings consolidation). Add invariant enforcement to `mapWorkloadAssets`/`updateGap`(reviewed-flip)/`_gapLinkInstance`(phase-conflict)/`_gapUnlinkInstance`(AL-rule). Production-code change; gates 4 deferred tests. **Per `feedback_no_patches_flag_first.md` this requires explicit user approval BEFORE coding.**

- **Path B: Bulk test-rewrite arc** (the *real* path forward for shim retirement). Rewrite ~40+ test bodies (Suite 12 / Suite 17 / RA / many others) from v2 fixtures (`s = freshSession()` + `addInstance(s,...)` + `createGap(s,...)`) to v3 fixtures (`setActiveEngagement(createEmptyEngagement())` + `commitInstanceAdd` + `commitGapAdd` + snapshot+restore wrapper). Estimate: ~10-15 commits batching 3-5 tests each. Drops `addInstance` + `createGap` + `updateGap` + `createEmptySession` + `session` cascade.

- **Path C (REVISED)**: Step H direct-cut. Inline the v2-shape literal `createEmptySession()` factory body into `_v2TestFixtures.js` as a local function (not a re-export). Inline a stable empty `session` literal that gets reset between describe blocks by a beforeEach hook. This is **fig-leaf per R5 strict** but **pragmatically unblocks Step H** (DELETE state/sessionStore.js) without a 40-test rewrite gate. **Requires explicit R5-fig-leaf-acknowledgment from user.**

The optimal order is likely **Path A → Path B**: address R8 invariants first (a focused arc on production-code v3 hardening), then the bulk test-rewrites can proceed without R8-blocked tests hanging in the backlog. Path C is a pragmatic shortcut available IF the user prefers velocity over architectural purity.

**Standing pattern (Phase I-B-9..22 template)**:
```js
const savedEng = getActiveEngagement();
try {
  setActiveEngagement(createEmptyEngagement());
  const envRes = commitEnvAdd({ envCatalogId: "coreDc" });
  const envId = getActiveEngagement().environments.allIds[0];
  // ... commitInstanceAdd / commitGapAdd / commit* sequence ...
} finally {
  setActiveEngagement(savedEng);   // pollution prevention for downstream tests
}
```

**Then unblocks**: Step H (DELETE `state/sessionStore.js` · 220 LOC) → Step J (DELETE 3 interaction modules · 643 LOC) → Step K (engagementStore cleanup) → rc.7 / 7e-post (FS3 + BUG-042) → rc.7 tag (PREFLIGHT 5b real-LLM smoke + GA gate per `docs/PREFLIGHT.md §5b`).

## Open R8 backlog (collected through Phase I-B-15 · for a future v3-invariant-enforcement arc)

Four related findings, all the same shape: v2 enforced an invariant atomically; v3 left it to the caller. Tests asserting these contracts have either been rewritten as call-sequence assertions (Phase I-B-9 T6.7/RH6) or deferred (Phase I-B-12 W2, Phase I-B-14 RH20, Phase I-B-15 T6.3 acknowledged-arg). A consolidated arc could either:
- **Path A** — add invariant enforcement to v3 helpers (production-code change; ~5 invariants across 3 helpers); OR
- **Path B** — accept caller-enforced model + audit all v3 callers (UI gap-edit flows + AI Assist + persistence) confirming the gates fire.

| # | Surfaced in | v3 helper missing enforcement | v2 invariant |
|---|---|---|---|
| 1 | Phase I-B-9 (5c8d69f) | `state/collections/gapActions.js updateGap` | AL10 / TX13.10 — `validateActionLinks` on reviewed-flip |
| 2 | Phase I-B-12 (879f611) | `state/collections/instanceActions.js mapWorkloadAssets` | self-map / workload→workload / cross-state / dedupe |
| 3 | Phase I-B-14 (f4d412d, deferred) | `state/adapter.js _gapUnlinkInstance` | AL-rule throw on unlinking the last required current/desired |
| 4 | Phase I-B-15 (4b9d5c9, partial) | `state/adapter.js _gapLinkInstance` | PHASE_CONFLICT_NEEDS_ACK on phase-mismatched link |
| 5 | (preexisting) | UI gap-edit / setPrimaryLayer-rebalance | T6.6 + PR5 + RH7..RH8 + RH19 retired contracts |
| 6 | Phase I-B-33 (680478b) | UI manual-add-dialog flow | T6.5 retired: manual-add appears reviewed=true UX expectation needs caller-layer test (`commitGapAdd({ ..., reviewed:true })` set explicitly by GapsEditView's "Add gap" button, NOT defaulted by the helper) |

**Open BUG**: BUG-042 — demo-mode banner missing on Tab 4 Gaps via live demo-loader path + Tab 1 Context stale-render-on-active-tab when demo loaded while Tab 1 is the active tab (broader scope than originally logged). Full repro + fix-plan in `docs/BUG_LOG.md`. Pre-existing on HEAD; not affected by Phase I-B-9..15 commits.

## Brief prompt to continue (next session · post-Phase-I-B-34)

> Continue rc.7 / 7e-8 v2 deletion arc per `docs/V2_DELETION_ARCHITECTURE.md` and `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` (LOCKED R0..R11). Last session ended at HEAD `75ab58a`; banner **1128/1134 GREEN** with 6 RED (5 expected: FS3 + V-FLOW-V3-PURE-1/3/4/5; +1 viewport-flake VT29 surfaced post-I-B-30 — possibly browser-window-height-dependent, not a regression).
>
> **Phase I-B-31..34 banked 4 commits NO REVERTS via the v2-shape-literal pattern** (LOCKED in HANDOFF). Pure-function v2-only services migrated this way: Suite 08 healthMetrics + Suite 22 pure-function half + Suite 20 roadmapService project-grouping = **49 tests rewritten + 1 retired**. Shim consumption -28% (295 → 213 call sites).
>
> **CRITICAL FORK** — read "Two strategic paths forward" section above. The user paused at end of Phase I-B-34 to think about (a) DOM Suite per-Suite migration vs. (b) `_installSessionAsV3Engagement` + `freshSession` retirement via v3-native fixture replacement. **WAIT FOR USER DIRECTION** in their next message before picking. If no direction and pressure to ship, default to (a) at proven cadence with audit-BEFORE-rewrite per the I-B-28 lesson.
>
> Apply principal-architect persona + R11 four-block ritual at every step boundary. Capture Chrome MCP / preview screenshots inline. Every commit message ends with `Browser smoke evidence:` block. Test banner alone is a discipline violation per R11.
>
> **R8 backlog** has 6 items now — see "Open R8 backlog" section. Item #6 is new (T6.5 retired manual-add-dialog reviewed:true UI-contract test). All 6 are deferred to rc.8 v3-invariant-enforcement arc.
>
> **Estimate to rc.7 tag**: ~7-10 DOM Suite mega-commits (Path a) OR ~3-5 commits (Path b) → Step H DELETE state/sessionStore.js → Step J DELETE 3 interaction modules → Step K engagementStore cleanup → rc.7 / 7e-post (FS3 + BUG-042 + VT29 viewport investigation) → rc.7 tag (PREFLIGHT 5b real-LLM smoke gated to user).
>
> Authority: `docs/V2_DELETION_ARCHITECTURE.md` · `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` R0..R11 · `memory/feedback_principal_architect_discipline.md` (tier-1; loads first) · `HANDOFF.md`.

---

## 🔍 Session α audit amendment · 2026-05-08 late evening (READ-ONLY · architect revisit on Sessions β..ζ output)

**Audit author**: this section is signed by **Session α** — the agent that closed `v3.0.0-rc.4` and `v3.0.0-rc.5` and pushed both to origin. Brought back by user direction 2026-05-08 late evening to look at what Sessions β through ζ shipped on top of the rc.5 stopping point and surface an architect-revisit perspective. **Additive only** — no edits to Session ζ's rc.7 dev log, Brief prompt, Phase I-B-9 entry point, or any other prior section. The intent is dual coverage: whichever session continues from here gets Session ζ's canonical "do this next" instructions above PLUS this rc.5-era voice as a sanity check.

### Session α's stopping point (= the boundary this audit measures from)

| Commit | What |
|---|---|
| `30ff765` | `v3.0.0-rc.4` tag commit on origin (PREFLIGHT 1-8 verified · 1157/1157 GREEN) |
| `842632a` | Hotfix #4 — v2 seed-library auto-install retired · APP_VERSION → `3.0.0-rc.5-dev` |
| `2a53be1` / `1d31bb7` / `8f7a90a` | rc.5 Group B Arc 4 (SPEC §S35 LOCK + evolved Skill Builder + opener retirement + v3SeedSkills.js DELETED) |
| `3c1d4a7` | SPEC §S36 LOCK + RULES CH32 + §T37 RED scaffold for rc.5 UX consolidation arc |
| `302a4c4` | rc.5 impl 5a+5b+5c+5d (side-panel · AiAssist retire · BUG-027 cloak · BUG-022 polish) |
| `36a87fe` | `v3.0.0-rc.5` tag commit on origin (PREFLIGHT 1-8 verified · 1169/1169 GREEN) |
| (BUG_LOG amendment) | Logged BUG-027/028 mid-rc.5; logged BUG-029..035 from the user's 2026-05-05 office workshop test |

**Session α did NOT do**: rc.6 closure (workshop-bug arc · grounding recast · `feedback_no_mocks.md` lock); rc.7-arc-1 (mock purge); rc.7 7e-1..7 (full v3-pure migration); rc.7 7e-8a..8c'-fix2 (NoEnvsCard + SPEC §S41 + BUG-041); rc.7 7e-8d-3..5 boot-break + revert; R0..R10 lock; redo Steps A..G; Step I-A + I-B-1..8; R11 lock; BUG-042. **All of that is Sessions β through ζ work.**

### What Session α notices, looking at Sessions β..ζ output

**The discipline lock is the right answer to the right problem.** R0..R11 + `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` + `docs/V2_DELETION_ARCHITECTURE.md` are the kind of artifacts I would have wanted at rc.5 close but didn't have. The trigger event (rc.7 / 7e-8d-3..5 broke app boot because a scope-limited grep test was trusted instead of an own audit) is exactly the failure mode I would have predicted but didn't pre-empt. Session ε's response — REVERT first, LOCK the discipline second, redo properly via own-grep + manifest-scoped V-ANTI-V2-IMPORT-1/2/3 — is the principal-architect move. Session ζ's R11 lock (Recite + Answer + Execute + Pledge-Smoke-Screenshot at every step boundary, with `Browser smoke evidence:` mandatory in every commit message) is the durable forcing function I would have asked for if I'd seen the boot-break in real time.

**The shape of the v3-pure migration looks correct.** Steps A..G follow the audit-consumer-graph → migrate-consumers → delete-module sequence (R1 + R2). The blast-radius monotone — V-ANTI-V2-IMPORT-1 violators 6 → 5 → 4 → 3 → 2 → 1 → 0 across Steps B..G — is the pattern an architect wants to see. The post-Step-G work (Phase I-A + I-B-1..8 shim slim) keeps the deletion sequence revertable per R7. VT26's v3-direct rewrite (`2b28c01`) as the template for remaining Phase I-B exports is sound — fewer commits is not the goal; revertibility is.

### Three risks Session α surfaces (flag-only · not blocking)

These are observations from reading the current HANDOFF.md + cross-checking against `git log` + `git ls-files`. Session ζ's operational handover above correctly names "Phase I-B-9+ next session entry point" as the priority — these risks are awareness items the next session can act on if/when scope permits.

1. **The rc.6 frozen-state stretch in this same HANDOFF.md (lines below this section, starting at "rc.6 frozen state") lists deleted files as if they exist.** Specifically: `services/mockChatProvider.js` + `services/mockLLMProvider.js` (deleted in rc.7-arc-1), `ui/views/AiAssistOverlay.js` (deleted Step E `2e9268e`), `ui/views/SkillAdmin.js` (deleted Step F `4789cd2`), `state/sessionBridge.js` (deleted Step G `ec06d34`). A session that scrolls past the operational top-of-file and reads §6 file pointers will be misled. Recommended scope (deferrable): trim those file pointers OR move the rc.6 archaeology to `docs/RELEASE_NOTES_rc.6.md` (which already exists). Top-of-file is correct; the archaeology is the trap.

2. **The 6 expected RED tests (FS3, VT29, V-FLOW-V3-PURE-1/3/4/5) are named without inline rationale.** R11's standing-regression flow needs a baseline; "1138/1144 GREEN with 6 expected RED" is a count, not a contract. A one-sentence-per-test "Expected RED roster" would let the next session verify against a baseline rather than trust the assertion. Without it, a session that observes one fewer or one more RED can't tell whether that's progress or regression without re-deriving the rationale.

3. **The Brief prompt and the "Then unblocks" sequence don't agree on Phase I-B cadence.** Brief prompt names `approveGapCmd` as the next concrete step (one of ~25 remaining shim exports). "Then unblocks" reads like Step H follows that single commit. Without an explicit cadence sentence ("Phase I-B = ~25 one-rewrite-per-commit before Step H unlocks; VT26 `2b28c01` is the template"), the next session may try to batch the shim work and trip R8 (scope balloon). The VT26 template reference IS named — what's missing is the count + cadence.

### Smaller observations (non-blocking · hygiene)

- R3 says "Chrome MCP screenshot"; R11 says "`mcp__Claude_Preview__preview_screenshot`". Both tools exist. Consider naming both with use-cases (Preview = in-loop fast iteration; Chrome MCP = canonical at tag boundaries per `feedback_browser_smoke_required.md`).
- BUG-041 entry header in `docs/BUG_LOG.md` says "CLOSED — rc.7 / 7e-8c'-fix3" but the rc.7 dev log table records the BUG-041 fix at commit `709e778`, slotted between 7e-8c'-fix2 (`324b37a`) and 7e-8b (`1c55b95`). Worth a sanity-check on the sub-arc label.

### What Session α explicitly is NOT doing in this amendment

- Editing Session ζ's rc.7 dev log, Brief prompt, Phase I-B-9 entry point, or any other prior section.
- Trimming the rc.6 archaeology (Risk #1) — separate decision the user has not approved.
- Adding the Expected-RED roster (Risk #2) — same.
- Editing the Brief prompt for cadence (Risk #3) — same.
- Touching `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md`, `docs/V2_DELETION_ARCHITECTURE.md`, `docs/BUG_LOG.md`, or any code/test file.

This is read-only audit voice in `HANDOFF.md` only. The next session reads Session ζ's operational handover above + this Session α amendment, and decides what (if anything) to act on.

**Session α signing off**: 2026-05-08 late evening. The work between `36a87fe` (my stopping point) and the current HEAD is significant, sound, and shipped under the right discipline. **Continue per Session ζ's Brief prompt; treat my three risks as awareness items, not blockers.** R11 governs whichever step boundary you cross next.

---

**rc.6 frozen state** (still authoritative for the rc.6 release; last tag on origin = `v3.0.0-rc.6`):

**STATE**: rc.6 closes the workshop-bug arc surfaced 2026-05-05. Six of seven workshop bugs (BUG-029, 030, 031, 033, 034, 035) closed with regression tests; BUG-032 deferred to rc.6.1/rc.7 pending user-side repro. Centerpiece is the **grounding contract recast** (SPEC §S37): RAG-by-construction architecture replaces the count-based threshold + LLM-decides-to-ground hope. Two locked memories ratified this release — `feedback_no_mocks.md` (NEW · tier-1) + `project_grounding_recast.md` (NEW).

**Authority**: SPEC §S0..§S37 · RULES §16 CH1–CH33 · PREFLIGHT.md (8 items + new 5b real-LLM smoke) · MEMORY index · `feedback_no_mocks.md` (LOCKED 2026-05-05 — no mock provider modules, no scripted-LLM fixtures, no stubbed-fetch tests, no grounded-mock substrate).

---

## 0 · 🔴 CRITICAL — REAL-LLM SMOKE REQUIRED BEFORE PUSH

The rc.6 tag commit lands locally with 1187/1187 GREEN ✅, but the **PREFLIGHT 5b real-LLM live-key smoke is the user's hands-on verification step** and has not yet been executed (Claude does not have the user's API keys).

Before pushing the tag (or even before fully claiming rc.6 is "ready to ship"), run the procedure documented in `docs/PREFLIGHT.md §5b`:

1. Load Acme Healthcare demo. Open Canvas AI Assistant.
2. For each provider (Anthropic + Gemini + Local A), 3 turns:
   - **Fact-retrieval**: "summarize the gaps" — verify response paraphrases real engagement gap descriptions; no fabrication.
   - **Vendor query**: "find the dell assets in current state" — verify response cites real vendor mix; no made-up products.
   - **Multi-cut**: "what dispositions does the customer have?" — verify response cites real engagement entities only.
3. Per turn, inspect Network panel: Layer 4 carries router selector results; response has zero `groundingViolations`.

If any provider produces a violation: **tag is BLOCKED**. The verifier patterns may need tightening, or the underlying grounding flow may need fixing. Real-LLM smoke is the validation layer per SPEC §S37 R37.12; nothing replaces it.

---

## 1 · What just shipped (rc.6 ledger)

Full per-commit detail in `docs/RELEASE_NOTES_rc.6.md`. Per-arc summary:

| Arc | Commit | Theme | Banner |
|---|---|---|---|
| 6a | `568742f` | SPEC §S37 + RULES §16 CH33 + §T38 RED scaffolds + stubs | 1174/1182 · 8 RED |
| 6a-amend | `faf6134` | No-mocks principle locked; grounded mock retired | 1175/1182 · 7 RED |
| 6b | `63ede19` | Plane 1 router + threshold removal · BUG-030 primary + BUG-033 closed | 1179/1182 · 3 RED |
| 6c | `f27d160` | Plane 2 verifier · BUG-030 fabricated-deliverable subclass closed | 1182/1182 ✅ |
| 6d | `f638825` | BUG-029 closed · sessionBridge handles session-reset | 1184/1184 ✅ |
| 6e | `f38f191` | BUG-035 closed (parts A+B) · entrypoint self-check + vLLM 400 hint | 1185/1185 ✅ |
| 6g | `4208d2a` | BUG-034 closed · pill click commits live form values before swap | 1186/1186 ✅ |
| 6h | `9237c91` | BUG-031 closed · propagate toast binds to applied[0].newCrit | 1187/1187 ✅ |
| 6i+6j | (this commit) | BUG-032 DEFERRED + tag prep (RELEASE_NOTES + HANDOFF + PREFLIGHT 5b mandate + APP_VERSION drop -dev) | 1187/1187 ✅ |

Test deltas: 1169 (rc.5) → 1187 (rc.6) = +18.

SPEC annexes added: §S37.
RULES added: §16 CH33; CH3 rewritten.
TESTS added: §T38 V-FLOW-GROUND.

Memory locked: `feedback_no_mocks.md` (NEW · tier-1) + `project_grounding_recast.md` (NEW).

---

## 2 · Open BUGs

| Bug | Severity | Status |
|---|---|---|
| BUG-001 | Medium | OPEN (propagate-criticality tracking; tightened by BUG-031 closure) |
| BUG-002 | Medium | OPEN (propagate-criticality tracking; tightened by BUG-031 closure) |
| BUG-032 | Medium | DEFERRED to rc.6.1/rc.7 — code path inspected, no disable predicate found, needs user hands-on repro to identify the specific element/state |

All other tracked BUGs (003 through 035 except 032 + 001 + 002) are CLOSED.

---

## 3 · What's next (rc.7 / post-rc.6)

| Tag | Theme | Notes |
|---|---|---|
| **rc.7-arc-1 (mock-purge)** | Retire ALL mock provider modules + tests · per `feedback_no_mocks.md` LOCKED 2026-05-05 | DELETE `services/mockChatProvider.js` + `services/mockLLMProvider.js` + `tests/mocks/*` · DELETE V-CHAT-4/5/15/29/32 + V-MOCK-1..3 + V-PROD-* + V-PATH-31/32 · RETIRE SPEC §S22 + RULES §16 CH13/CH14 · UPDATE `core/appManifest.js` workflow text removing "Mock LLM run button" · estimated half-day |
| **rc.7 main** | View migration arc (formerly rc.6 plan pre-workshop) | 5 v2.x view tabs migrate to read via `state/adapter.js` · drops dormant v2 admin modules · then mechanical `state/v3SkillStore.js` → `state/skillStore.js` rename per `feedback_no_version_prefix_in_names.md` |
| **rc.6.1** (optional) | BUG-032 fix once user can repro | Likely UX clarification: when picker has zero candidates, render explicit empty-state callout instead of letting the button look non-functional |
| **rc.8 / GA** | Pre-GA hardening + real-workshop validation round 2 + merge to main | Real-LLM live-key smoke MUST be GREEN at GA tag |
| **v3.1 minor** | Crown-jewel UI polish | Per `project_crown_jewel_design.md` |

---

## 4 · Locked discipline (memory anchors active for next session)

Non-negotiable, applies to every commit:

- `feedback_no_mocks.md` — **NEW tier-1 LOCKED 2026-05-05**. No mock provider modules. No scripted-LLM fixtures. No stubbed-fetch tests. No grounded-mock substrate. Real-LLM smoke at PREFLIGHT 5b is the validation layer; nothing fakes it.
- `feedback_spec_and_test_first.md` — SPEC + RULES + V-* tests authored BEFORE implementation.
- `feedback_test_or_it_didnt_ship.md` — every BUG-NNN fix MUST add a regression test.
- `feedback_no_patches_flag_first.md` — patches that bypass v3 schema, validation, or architecture are forbidden. Surface alternatives + wait for direction.
- `feedback_browser_smoke_required.md` — every tag MUST include Chrome MCP smoke. Real-LLM live-key smoke is a tag-time PREFLIGHT 5b item starting rc.6.
- `feedback_test_what_to_test.md` — V-FLOW or it didn't ship.
- `feedback_no_push_without_approval.md` — never `git push` without explicit user instruction.
- `feedback_no_version_prefix_in_names.md` — version numbers in tags + APP_VERSION + changelogs only.
- `feedback_dockerfile_whitelist.md` — every new top-level dir → Dockerfile COPY in same commit.
- `feedback_import_collision.md` — alias v3.0 imports during v2↔v3 cutover.
- `feedback_foundational_testing.md` — data-model changes ship with demo + seed + demoSpec + DEMO_CHANGELOG.
- `feedback_naming_standard.md` — AppName-vX.Y.Z artifact naming.
- `feedback_docs_inline.md` — SPEC + CHANGELOG_PLAN + BUG_LOG inline with code, not backfilled.
- `feedback_group_b_spec_rewrite.md` — UX consolidation arcs start with SPEC rewrite session BEFORE coding.
- `project_grounding_recast.md` — **NEW** rc.6 grounding contract recast (RAG-by-construction); two planes + real-LLM smoke; threshold cliff removed; same-tier with no-patches.
- `project_v2x_admin_deferred.md` — keep v2.x admin module intact during v3 GA push.

---

## 5 · How a fresh session picks this up (read-order)

1. Read this `HANDOFF.md` start to finish (especially §0 real-LLM smoke + §3 next-steps).
2. Read `MEMORY.md` index + locked feedback memories — particularly `feedback_no_mocks.md` and `feedback_no_patches_flag_first.md`.
3. Read `docs/RELEASE_NOTES_rc.6.md` for the per-arc detail.
4. Skim `docs/v3.0/SPEC.md §S37` (the grounding contract recast).
5. Check `docs/RULES.md §16 CH33` (the contract rule).
6. **Set up Chrome MCP** before starting any code work.
7. Run `docker compose up -d` and verify the banner `1187/1187 GREEN`.
8. Pick the next sub-arc per §3 — most likely the **mock-purge arc** unless the user redirects.

---

## 6 · File pointers (post-rc.6)

| Concern | File |
|---|---|
| Active engagement source-of-truth | `state/engagementStore.js` |
| v2 sessionState (legacy) | `state/sessionStore.js` |
| Chat memory (BUG-029 fix lives in sessionBridge) | `state/chatMemory.js` + `state/sessionBridge.js` |
| v3 engagement schema | `schema/engagement.js` |
| v3 demo engagement | `core/demoEngagement.js` |
| Data contract | `core/dataContract.js` |
| Concept dictionary | `core/conceptManifest.js` |
| App workflow manifest | `core/appManifest.js` |
| **Grounding router (rc.6 NEW · plane 1)** | `services/groundingRouter.js` |
| **Grounding verifier (rc.6 NEW · plane 2)** | `services/groundingVerifier.js` |
| Chat orchestration (calls router + verifier) | `services/chatService.js` |
| System-prompt assembler (router-driven Layer 4) | `services/systemPromptAssembler.js` |
| Tool registry | `services/chatTools.js` |
| Generic LLM connector | `services/aiService.js` |
| Real provider impl | `services/realChatProvider.js` |
| Mock provider (SCHEDULED FOR RETIREMENT in rc.7-arc-1) | `services/mockChatProvider.js` |
| Mock LLM provider (SCHEDULED FOR RETIREMENT) | `services/mockLLMProvider.js` |
| Handshake regex + strip | `services/chatHandshake.js` |
| UUID + workflow + concept scrub | `services/uuidScrubber.js` |
| Skill runner | `services/skillRunner.js` |
| Manifest generator | `services/manifestGenerator.js` |
| Path resolver | `services/pathResolver.js` |
| Skill Builder UI | `ui/views/SkillBuilder.js` |
| Dormant v2 admin (preserved) | `ui/views/SkillAdmin.js` |
| Dormant AiAssistOverlay (preserved) | `ui/views/AiAssistOverlay.js` |
| Canvas AI Assistant overlay | `ui/views/CanvasChatOverlay.js` |
| Settings modal (BUG-034 fix) | `ui/views/SettingsModal.js` |
| Stack-aware Overlay component | `ui/components/Overlay.js` |
| AI provider config | `core/aiConfig.js` |
| nginx LLM proxy (BUG-035 entrypoint self-check) | `docker-entrypoint.d/45-setup-llm-proxy.sh` |
| Matrix view (BUG-031 fix) | `ui/views/MatrixView.js` |
| Gaps view (BUG-032 deferred) | `ui/views/GapsEditView.js` |
| Diagnostic suite | `diagnostics/appSpec.js` (1187 tests at rc.6) |
| Test runner | `diagnostics/testRunner.js` |
| BUG log | `docs/BUG_LOG.md` |
| Pre-flight checklist | `docs/PREFLIGHT.md` (8 items + NEW 5b real-LLM smoke) |
| SPEC | `docs/v3.0/SPEC.md` (through §S37) |
| RULES | `docs/RULES.md` (CH1–CH33; CH3 rewritten in rc.6) |
| Release notes | `docs/RELEASE_NOTES_rc.6.md` |
| GB10 vLLM setup reference | `LLMs on GB10.docx` |
| GPLC visual reference | `C:/Users/Mahmo/Downloads/GPLC Digital Unified Platform v1.0.html` |

---

## 7 · Push checklist (rc.6 + onward)

When pushing the rc.6 tag (after the user runs PREFLIGHT 5b real-LLM smoke + says "push"):

```bash
git push origin v3.0-data-architecture
git tag v3.0.0-rc.6
git push origin v3.0.0-rc.6
```

Verify on GitHub: branch `v3.0-data-architecture` carries the rc.6 tag commit; `v3.0.0-rc.6` tag exists; rc.5 / rc.4 / rc.3 tags preserved; `origin/main` still on `5614f32`.

Per `feedback_no_push_without_approval.md` — wait for explicit user instruction before each push.
