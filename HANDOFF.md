# Dell Discovery Canvas — Session Handoff

**🔴 READ FIRST · Principal-architect discipline (LOCKED 2026-05-08, R11 added evening)**: every session, every commit, every handover. Full text in [`docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md`](docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md) (R0..R11) + tier-1 memory anchor `feedback_principal_architect_discipline.md`. Core rules: **R0** acknowledge "what would a principal architect do?" before non-trivial action · **R1** own-grep before delete · **R2** migrate consumers FIRST, delete LAST · **R3** Chrome MCP browser smoke at every commit boundary (test banner alone is NOT sufficient) · **R4** no v3-store backward-compat hacks · **R5** no fig-leaf test fixtures hiding v2 logic · **R6** rewrite tests to assert v3 contracts (never retire-with-negative) · **R7** per-commit revertibility · **R8** surface scope balloons · **R9** every handover references this · **R10** acknowledge in every action out loud · **R11 (HARDEST · LOCKED 2026-05-08 evening)** Recite + Answer + Execute + Pledge-Smoke-Screenshot at EVERY step boundary; every commit message ends with a `Browser smoke evidence:` block. **Test banner alone is a discipline violation.**

**Last session end**: 2026-05-08 (evening) · `v3.0.0-rc.7-dev` on `v3.0-data-architecture` · HEAD pending (this commit) · **Banner 1138/1144 GREEN** with 6 expected RED (FS3, VT29, V-FLOW-V3-PURE-1/3/4/5). v2 deletion arc REDO advanced through Step G + Phase I-B-8 + R11 LOCK; Steps H/J/K + rc.7 / 7e-post + tag pending. ~1670 LOC removed across the session (608 SkillAdmin + 398 sessionBridge + 633 v2-internal tests + ~30 misc). `_v2TestFixtures.js` shim shrunk 35 → 28 re-exports. **R11 LOCKED at `96e8a16`**.

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
| handover | `3fa833e → <this>` | session-end log + BUG-042 logged + next-session prompt (R9-mandated) · **refactored to terse rc.7-dev-log convention** in this commit | 1138/1144 |

## Phase I-B-9+ (next session entry point)

`_v2TestFixtures.js` shim shrunk **35 → 28 re-exports** this session (9 dropped: `migrateLegacySession`, `setPrimaryLayer`, `deriveProjectId`, `isFreshSession`, `applyContextSave`, `replaceSession`, `saveToLocalStorage`, `createDemoSession`, `resetToDemo`). Remaining 28 (4 sessionStore + 7 matrixCommands + 9 gapsCommands + 9 desiredStateSync) are heavy v2-singleton-state-coupled — each requires per-test rewrite (similar magnitude to VT26 in `2b28c01`).

**Most-actionable next**: Suite 22 `approveGapCmd` (T6.7 line 2271 + RH6 line 5463) — either rewrite to `commitGapEdit({reviewed:true})` w/ explicit `validateActionLinks` for shape errors, or RETIRE per architecture doc Step I plan; drop `approveGap` from shim. **VT26 pattern (commit `2b28c01`) is the template** for v3-direct rewrites: `setActiveEngagement(createEmptyEngagement(...))` + `commit*` helpers + `engagementToV2Session(getActiveEngagement())` for renderer args.

**Then unblocks**: Step H (DELETE `state/sessionStore.js` · 220 LOC) → Step J (DELETE 3 interaction modules · 643 LOC) → Step K (engagementStore cleanup) → rc.7 / 7e-post (FS3 + VT29 + BUG-042) → rc.7 tag (PREFLIGHT 5b real-LLM smoke + GA gate per `docs/PREFLIGHT.md §5b`).

**Open finding (this session)**: BUG-042 — demo-mode banner missing on Tab 4 Gaps via live demo-loader path; **first R11-surfaced finding** (would have been missed by banner-only verification). Full repro + fix-plan in `docs/BUG_LOG.md`.

## Brief prompt to continue (next session)

> Continue rc.7 / 7e-8 v2 deletion arc per `docs/V2_DELETION_ARCHITECTURE.md` and `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` (LOCKED R0..R11). Last session ended at HEAD `<this commit>`; banner 1138/1144 GREEN with 6 expected RED. Apply principal-architect persona + R11 four-block ritual (Recite + Answer + Execute + Pledge-Smoke-Screenshot) at every step boundary. Walk standing regression flow (boot empty → "New customer" 0 collections; load demo → Acme Healthcare 3/4/23/8; 5 stepper tabs render; AI Assist overlay opens; Settings → Skills builder mounts; +New session → engagementId rotates + chat 1→0 messages BUG-029 contract). Capture `mcp__Claude_Preview__preview_snapshot` inline. Every commit message ends with `Browser smoke evidence:` block. Test banner alone is a discipline violation per R11.
>
> Next concrete step: Suite 22 `approveGapCmd` (T6.7 line 2271 + RH6 line 5463) — rewrite to `commitGapEdit({reviewed:true})` + `validateActionLinks` OR retire per Step I plan; drop `approveGap` from shim. Use VT26 pattern (commit `2b28c01`) as the template.
>
> Authority: `docs/V2_DELETION_ARCHITECTURE.md` · `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` R0..R11 · `memory/feedback_principal_architect_discipline.md` (tier-1; loads first) · `HANDOFF.md`.

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
