# Dell Discovery Canvas — Session Handoff

**🔴 READ FIRST · Principal-architect discipline (LOCKED 2026-05-08, R11 added evening)**: every session, every commit, every handover. Full text in [`docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md`](docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md) (R0..R11) + tier-1 memory anchor `feedback_principal_architect_discipline.md`. Core rules: **R0** acknowledge "what would a principal architect do?" before non-trivial action · **R1** own-grep before delete (no closed-list test scopes) · **R2** migrate consumers FIRST, delete LAST · **R3** Chrome MCP browser smoke at every commit boundary (test banner alone is NOT sufficient) · **R4** no v3-store backward-compat hacks · **R5** no fig-leaf test fixtures hiding v2 logic · **R6** rewrite tests to assert v3 contracts (never retire-with-negative) · **R7** per-commit revertibility (smoke fail = revert, not pile-fix) · **R8** surface scope balloons · **R9** every handover references this · **R10** acknowledge in every action out loud · **R11 (HARDEST · LOCKED 2026-05-08 evening)** Recite + Answer + Execute + Pledge-Smoke-Screenshot at EVERY step boundary; every commit message ends with a `Browser smoke evidence:` block listing standing regression flow walked + snapshot captured. **Test banner alone is a discipline violation.**

---

## Last session end · 2026-05-08 (evening) · 14 commits this session

**Branch**: `v3.0-data-architecture` · **HEAD**: `e8f2bd6` · **Banner**: **1138/1144 GREEN** with same 6 expected RED throughout (FS3, VT29, V-FLOW-V3-PURE-1/3/4/5).

**Session arc**: continued the v2 deletion REDO from where the morning left off (Step A `1abba74`). Shipped Steps B–G + Step I-A + Steps I-B-1 through I-B-8 + the R11 discipline lock. `~1670 LOC removed` across production + test code. `_v2TestFixtures.js` shim shrunk from 35 → 28 re-exports. Steps H + J still blocked on Phase I-B completion.

### Commits this session (14)

| # | Commit | Step | LOC | R11 |
|---|--------|------|-----|-----|
| 1 | `6940df2` | B · sessionFile v3-native | — | pre-R11 |
| 2 | `a1a1b8b` | C · gapsService v3-native | — | pre-R11 |
| 3 | `805bb92` | D · vendorMixService v3-native | — | pre-R11 |
| 4 | `2e9268e` | E · DELETE AiAssistOverlay.js | (1 file) | pre-R11 |
| 5 | `4789cd2` | F · DELETE SkillAdmin.js | 608 | pre-R11 |
| 6 | `ec06d34` | G · DELETE sessionBridge + listener flip | 398 | pre-R11 |
| 7 | `8705e83` | I-A · drop 71 v2-internal tests (Suites 5/6/7/18) | 633 | pre-R11 |
| 8 | `abc0767` | I-B-1 · migrateLegacySession direct import | — | pre-R11 |
| 9 | `7594613` | I-B-2 · drop PL4 + PR2 helper-unit tests | — | pre-R11 |
| 10 | `b4debe8` | I-B-3 · drop FS1 + FS2 helper-unit tests | — | pre-R11 |
| 11 | **`96e8a16`** | **🔴 R11 LOCKED · four-block ritual** | (docs) | self |
| 12 | `b348271` | I-B-4 · drop dead `liveSession` alias | — | ✅ R11 |
| 13 | `fa2ea32` | I-B-5 · drop PR1.a/b + applyContextSave | — | ✅ R11 |
| 14 | `2b28c01` | I-B-6 · VT26 rewritten v3-direct + drop replaceSession | — | ✅ R11 |
| 15 | `4eb025b` | I-B-7 · drop dead saveToLocalStorage | — | ✅ R11 |
| 16 | `e8f2bd6` | I-B-8 · drop dead createDemoSession + resetToDemo | — | ✅ R11 |

(Step E AiAssistOverlay was actually committed pre-this-session via 2e9268e; included for completeness of the rc.7 / 7e-8 redo arc.)

### What changed at the architecture level

- **`ui/views/AiAssistOverlay.js` DELETED** (Step E). Cmd+K + topbar AI Assist route to `CanvasChatOverlay.js`.
- **`ui/views/SkillAdmin.js` DELETED** (Step F · 608 LOC). Settings → Skills builder pill mounts `SkillBuilder.js`.
- **`state/sessionBridge.js` DELETED** (Step G · 398 LOC). The cutover-window v2↔v3 bridge is gone. Listener flipped from `onSessionChanged` (legacy bus) to `subscribeActiveEngagement` (v3 store). Boot-seed inlined in `app.js` DOMContentLoaded. The session-reset chat-clear (BUG-029) handler stayed inlined at the `+New session` button (was already inlined pre-Step G).
- **R11 LOCKED**: `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` extended with full R11 four-block ritual; tier-1 memory anchor + `MEMORY.md` index updated; the rule loads in every future session before any work.

### What changed at the test level

- **Suites 5 (state/sessionStore), 6 (matrixCommands), 7 (gapsCommands), 18 (desiredStateSync) RETIRED** — 71 v2-internal tests dropped per architecture doc Step I plan ("DROP, not retired-with-negative"). V3 successors: V-ADP-* + V-FLOW-PERSIST-* + state/dispositionLogic test surfaces.
- **`_v2TestFixtures.js` shim shrinkage** — 35 → 28 re-exports. Dropped: `migrateLegacySession`, `setPrimaryLayer`, `deriveProjectId`, `isFreshSession`, `applyContextSave`, `replaceSession`, `saveToLocalStorage`, `createDemoSession`, `resetToDemo` (9 exports gone).
- **VT26 (Suite 45 demo-banner test) REWRITTEN v3-direct** — first major fixture rewrite under R11. Pattern: `setActiveEngagement(createEmptyEngagement({meta:{isDemo:true}}))` + `commitContextEdit({customer:{...}})` + `commitDriverAdd(...)` + `engagementToV2Session(getActiveEngagement())` to derive the v2-shape projection for renderer signatures that retain the session arg. Use this same pattern for remaining fixture migrations.
- **Bridge-coupled tests retired with vector-id preservation** (Step G): V-FLOW-MIGRATE-TAB1-DRIVERS-3 + ENVS-3 + CUSTOMER-2 + V-FLOW-CHAT-DEMO-2 + T1.8 + T1.9 (the v3→v2 mirror is gone with the bridge).
- **BUG-029 chat-clear regression tests** rewritten to drive the inlined +New session sequence directly (V-FLOW-CHAT-LIFECYCLE-1/2 — clearTranscript + setActiveEngagement, no bridge transport).
- **Helper-unit test drops**: PL4 (setPrimaryLayer dedupe), PR2 (deriveProjectId fallback), FS1+FS2 (isFreshSession edge cases), PR1.a+PR1.b (applyContextSave isDemo flip). All v2-only contracts; v3 integration coverage unaffected.

### Findings logged this session

- **BUG-042** · Demo-mode banner does NOT render on Tab 4 (Gaps) when meta.isDemo:true via the live demo-loader path. Pre-existing state surfaced by R11 mandatory regression walk in commit fa2ea32. VT26 still GREEN (uses direct-render path that includes the banner). Live demo-loader → renderStage → renderGapsEditView path apparently omits the banner. Logged in `docs/BUG_LOG.md` BUG-042 with full repro + suspected root cause + V-FLOW-DEMO-BANNER-GAPS-1 fix-plan test. Scheduled `rc.7 / 7e-post`. **First win for R11**: would have been missed by banner-only verification.

---

## Next-session entry plan

### Where things stand

- **`_v2TestFixtures.js` shim still has 28 re-exports** (was 35 pre-session). The remaining 4 sessionStore re-exports (`session`, `createEmptySession`, `resetSession`, `loadFromLocalStorage`) + 7 matrixCommands + 9 gapsCommands + 9 desiredStateSync are all heavy v2-singleton-state-coupled. Each requires per-test rewrite (similar magnitude to VT26 in I-B-6).
- **Steps H + J + K + rc.7 / 7e-post + rc.7 tag** all pending.
- **Test count**: 1138/1144 GREEN, 6 expected RED (FS3, VT29, V-FLOW-V3-PURE-1/3/4/5).

### Backlog (priority order)

1. **Phase I-B-9..N · per-test fixture rewrites** (multi-session arc). Each commit migrates 1-2 test sites or 1 helper symbol. Pattern: VT26-style `setActiveEngagement(createEmptyEngagement(...))` + commit-helpers + `engagementToV2Session` for renderer args. Highest-value targets:
   - Suite 12 ContextView (heavy `createEmptySession + addInstance + createGap`)
   - Suite 13 MatrixView · Suite 14 GapsEditView (view fixtures)
   - Suite 22 programsService — `approveGapCmd` (T6.7 + RH6) → either `commitGapEdit({reviewed:true})` rewrite or RETIRE per architecture doc plan
   - Suite 35e TX taxonomy tests (uses `session + sessionMeta`)
   - Scattered sites for `addInstance / createGap / etc.` v2-helper calls
2. **Step H · DELETE state/sessionStore.js** (220 LOC). Unblocked when `_v2TestFixtures.js` no longer re-exports anything from sessionStore.
3. **Step J · DELETE 3 interaction modules** (matrixCommands 143 LOC + gapsCommands 263 LOC + desiredStateSync 237 LOC = 643 LOC). Unblocked when shim drops the 7+9+9 = 25 re-exports from those modules.
4. **Step K · engagementStore architectural cleanup**. Audit remaining `onSessionChanged` callers (interactions/aiCommands.js, state/aiUndoStack.js); decide whether `core/sessionEvents.js` retires entirely.
5. **rc.7 / 7e-post · deferred fixtures**. FS3 (ContextView fresh-start card RED) + VT29 (page overflow). Now 2 entries (was 3 — OH5 fixed as a bonus in Step G).
6. **BUG-042 · Demo-mode banner on Tab 4 Gaps** (logged this session). Schedule alongside 7e-post.
7. **rc.7 tag · PREFLIGHT real-LLM smoke + GA gate**. The user's hands-on verification step per `docs/PREFLIGHT.md §5b`.

### Bugs / open findings

| ID | Severity | Status | Title | Schedule |
|----|----------|--------|-------|----------|
| BUG-042 | Low | OPEN | Demo banner missing on Tab 4 Gaps via live demo path | rc.7 / 7e-post |
| BUG-001 | Medium | OPEN | Propagation toast shows "low" when actual mutation is "high" | rc.2 polish |
| BUG-032 | Medium | DEFERRED | (rc.6 workshop bug deferred pending user-side repro) | rc.6.1 / rc.7 |
| BUG-036 | Medium | OPEN | (v2-v3 sync gap; partially closed by Step G) | re-audit |
| BUG-037 | Low | OPEN | Chat msg user/assistant visual differentiation | rc.5+ polish |
| BUG-038 | Low | OPEN | Skill Builder UI text-heavy / primitive | post-rc.3 UX arc |
| BUG-039 | Medium | OPEN | Vendor mix % is by record not deployment scale | rc.7 / 7f |
| BUG-040 | Low | OPEN | Desired state allows mapping to "retire" instance | rc.7 / 7f |

(Full repro/expected/actual/fix-plan in `docs/BUG_LOG.md`. BUG-002 through BUG-035 mostly CLOSED — see entries.)

### Specs touched this session

| Doc | Change |
|-----|--------|
| `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` | R11 added (HARDEST RULE; four-block ritual; standing regression suite definition; no-exceptions language; user-quote authority anchor) |
| `~/.claude/.../memory/feedback_principal_architect_discipline.md` | R11 added to "12 rules"; How-to-apply updated to lead with R11 |
| `~/.claude/.../memory/MEMORY.md` | Index entry updated: R0..R10 → R0..R11 |
| `docs/BUG_LOG.md` | BUG-042 added (demo banner Tab 4 Gaps) |
| `docs/V2_DELETION_ARCHITECTURE.md` | Authoritative for the redo; not edited this session (plan is sound) |
| `diagnostics/_productionFileManifest.js` | AiAssistOverlay + SkillAdmin + sessionBridge entries dropped + comment blocks added |
| `diagnostics/_v2TestFixtures.js` | Shim shrunk from 35 → 28 re-exports (9 dropped over the session) |
| `diagnostics/appSpec.js` | 71 v2-internal tests dropped + 11+ test bodies retired/rewritten + multiple import-line cleanups + VT26 v3-direct rewrite |
| `app.js` | Step G changes: dropped sessionBridge import; flipped onSessionChanged → subscribeActiveEngagement; inlined boot-seed |

### Files NOT touched but may be relevant

- `docs/SPEC.md` + `docs/v3.0/SPEC.md` — no edits this session (plan was for code-level cleanup; SPEC stays frozen until rc.7 tag).
- `docs/CHANGELOG_PLAN.md` — no edits; the rc.7 / 7e-8 sub-arcs need a final summary entry pre-tag.
- `docs/PREFLIGHT.md` — no edits; PREFLIGHT 5b real-LLM smoke is the rc.7 tag-gate.

---

## Brief prompt to continue (for next session)

Copy-paste this into the next session as the opening message:

> Continue rc.7 / 7e-8 v2 deletion arc per `docs/V2_DELETION_ARCHITECTURE.md` and `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` (LOCKED R0..R11). Last session ended at HEAD `e8f2bd6` (Step I-B-8); banner 1138/1144 GREEN with 6 expected RED.
>
> **Apply R11 four-block ritual at every step boundary**:
> - Block 1 Recite: state the step's full scope
> - Block 2 Answer: 1-3 sentence concrete plan + architectural concern + blast radius + smoke pass
> - Block 3 Execute
> - Block 4 Pledge + Smoke + Screenshot: walk the standing regression flow (boot empty → "New customer", 0 collections; load demo → Acme Healthcare 3 drivers / 4 envs / 23 instances / 8 gaps; click 5 stepper tabs each renders content; AI Assist overlay opens; Settings → Skills builder mounts; +New session → engagementId rotates + chat 1→0 messages BUG-029 contract intact). Capture `mcp__Claude_Preview__preview_snapshot` inline. Every commit message ends with a `Browser smoke evidence:` block. **Test banner alone is a discipline violation per R11.**
>
> **Next concrete steps** (Phase I-B-9+ multi-session arc):
> 1. Migrate Suite 22 `approveGapCmd` consumers (T6.7 line 2271 + RH6 line 5463) — either rewrite to `commitGapEdit({reviewed:true})` w/ explicit `validateActionLinks` for shape errors, or RETIRE per architecture doc Step I plan; drop `approveGap` from shim.
> 2. Migrate Suite 12 ContextView fixture sites (heavy `createEmptySession + addInstance + createGap`) using the VT26 pattern: `setActiveEngagement(createEmptyEngagement(...))` + `commitInstanceAdd / commitGapAdd / commitDriverAdd` + `engagementToV2Session(getActiveEngagement())` for renderer args.
> 3. Continue per-test rewrites until `_v2TestFixtures.js` has zero re-exports from sessionStore + 3 interaction modules.
> 4. Then unblocks Step H (DELETE sessionStore.js · 220 LOC) + Step J (DELETE 3 interaction modules · 643 LOC) + Step K (engagementStore cleanup).
>
> **Open findings**: BUG-042 (demo banner missing on Tab 4 Gaps via live demo-loader path; logged in `docs/BUG_LOG.md`; first R11-surfaced finding). Schedule rc.7 / 7e-post alongside FS3 + VT29 deferred fixtures.
>
> **Authority files**: `docs/V2_DELETION_ARCHITECTURE.md` (Steps H/I/J/K plan) · `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` (R0..R11) · `memory/feedback_principal_architect_discipline.md` (tier-1 anchor; loads first every session) · `HANDOFF.md` (this doc).
>
> Apply principal-architect persona. Use the VT26 pattern (commit `2b28c01`) as the template for v3-direct test rewrites. Walk the standing regression flow for every commit. Capture snapshots inline.

---

## Pre-existing handover content (rc.7 / 7e-8 morning state, kept for archeology)

**Original morning entry**: `v3.0.0-rc.7-dev` in progress on `v3.0-data-architecture` · HEAD pending after Step A · **Banner 1212/1221 GREEN** · v2 deletion arc REDO under way after the 7e-8d-3..5 attempt was reverted (`977bf68`); plan in [`docs/V2_DELETION_ARCHITECTURE.md`](docs/V2_DELETION_ARCHITECTURE.md). Steps A done; Steps B..K pending.

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
| **7e-8c** | `02f94ed` | **Trim app.js v2 sessionStore call sites** — 5 read sites (`session.X` → `getActiveEngagement().X`) + 3 redundant `saveToLocalStorage()` drops (v3 auto-persists) + 2 demo-loader v2 mirror lines retired + save flow now derives v2 shape via `engagementToV2Session()` at the file boundary. Imports trimmed to `{ resetSession, replaceSession }`. **`resetSession` + `replaceSession`-in-file-open retained** (need v3-native canvasFile or v2→v3 runtime translator first — see 7e-8d blocker below). Mid-arc fix: `session`-undefined ReferenceError in `renderStage` was halting boot before wire* handlers; fixed by passing `null` explicitly to view renderers. | **1212/1221** ✅ |

## 7e-8d BLOCKER (next session entry point)

`state/sessionStore.js` + `state/sessionBridge.js` cannot be deleted yet because two production callers in `app.js` still need them:

1. **`resetSession()`** (line ~712) — the bridge's session-reset handler clears chat memory + resets v3 engagement-id. Inlining the bridge logic at the call site is doable but couples `app.js` to `state/chatMemory.clearTranscript` + `schema/engagement.createEmptyEngagement` + `state/aiUndoStack.clear` + `core/sessionEvents.emitSessionChanged`.

2. **`replaceSession(res.session)`** (line ~808 in file-open) — `services/sessionFile.js applyEnvelope()` returns a v2-shape session via `migrateLegacySession`. Without a v2→v3 runtime translator, there's no way to put that into v3 directly. **The bridge currently does customer-only shallow merge — instances/gaps/envs from a loaded `.canvas` file silently DON'T appear in v3 today.** That's a real bug the file-open path masks.

**Three ways to unblock**:

| Option | Effort | Tradeoff |
|---|---|---|
| **A** · Inline bridge logic in app.js + build full v2→v3 runtime translator | 2-3h | Translator already partially exists in `state/sessionBridge.js v2CustomerPatch` (customer-only); needs full instances/gaps/envs. Lets us delete bridge + sessionStore in one commit. Also fixes the latent file-open data-loss bug. |
| **B** · Make `services/sessionFile.js` v3-native | 3-4h | Cleanest long-term. `applyEnvelope` returns v3 engagement; file format may need versioning. |
| **C** · Defer 7e-8d to its own dedicated session | 0h | Push the 2 commits we have; let 7e-8d wait. |

User chose Path A as the cleaner, more complete approach to the v2 deletion arc; we executed 7e-8b + 7e-8c tonight. **7e-8d is the next sub-arc on the same path** but needs the v2→v3 runtime translator to land first.

**Smoke (Chrome MCP, fix2 verification on user's actual browser)**: fresh-start session → "+ Add environment" → Primary Data Center → 0→1 transition complete → NO banner appears anywhere · localStorage `envFirstAddAck_v1` = null · all 5 stepper tabs un-disabled (Tabs 4/5 properly un-grey when first env arrives).

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
