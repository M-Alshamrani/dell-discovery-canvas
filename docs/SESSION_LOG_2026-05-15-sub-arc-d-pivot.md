# Session Log · 2026-05-15 · Sub-arc D · Steps 3-3.9 + calibration + ARCHITECTURE PIVOT

**Session theme**: Sub-arc D Step 3 baseline → 4 prompt-text iterations → eval-methodology calibration → strategic architecture pivot to engineer-issued import via Path B → Step 4 preamble for the pivoted scope.

**Session boundary**: 23 commits ahead of rc.9 tag at session end. NOT pushed (per user direction `i dont want it to be puplished to git yet`). Banner 1310/1314 GREEN+RED at session end (4 Step-4 RED scaffolds locked for next-session impl).

**Headline outcome**: Sub-arc D architecture PIVOTED post-calibration. The chat-layer autonomous-emission approach proved structurally unreliable across 5 baselines + Experiments A+B; the user-surfaced architectural insight (engineer-issued import via existing Path B importer §S47) shifts Sub-arc D's primary UX path from "chat fires `proposeAction`" → "Mode 1 overlay → engineer commands import → Path B → ImportPreviewModal → engineer applies". The chat does what LLMs are good at; the engineer does what engineers are good at; deterministic code does the mutation.

---

## Session arc · chronological

### Phase 1 · Sub-arc D Step 3 USER-RUN baseline + Step 3.5 prompt-text tightening

| Commit | What | Banner | Notes |
|---|---|---|---|
| `d73ce60` | Step 3 baseline-action.json LOCKED · rc.10 FIRST action-correctness measurement bar | 1303/1303 | 3.8/10 avg · 40% pass · forensic analysis: 3 of 4 emit-cases scored 0/10 by no-emission · ACT-INST-DES-1 hallucinated "Proposal submitted ✓" |
| `5ec0a65` | Step 3.5 preamble + RED tests (V-AI-EVAL-13/14/15 + V-CHAT-D-3) | 1303/1307 (4 RED) | Rule 4 verb-strength + Example 11 + proposeAction tool description hardening + ACT-INST-CUR-1 fixture-fidelity bug fix |
| `ee42302` | Step 3.5 impl flips RED→GREEN | 1307/1307 GREEN | Rule 4 "MUST invoke" + "contract violation" framing + Example 11 (canonical add-driver) + proposeAction "MUST be invoked" + closeReason REQUIRED + ACT-INST-CUR-1 rewrite |
| `368d565` | Step 3.5 re-baseline · target HIT | data only | 3.8→7.4 avg · 40%→80% pass · per-cat add-driver 0→9 · add-instance-desired 0→8 · close-gap 9→10 · the framing-doc A14 target |

### Phase 2 · Step 3.6 attempted + reverted

| Commit | What | Banner | Notes |
|---|---|---|---|
| `fcf3b07` | Step 3.6 preamble + RED (V-AI-EVAL-16/17 + V-CHAT-D-4) | 1307/1310 (3 RED) | Rule 4 no-ask-permission sentence-append + Example 12 verbose-form + proposeAction Recommended-fields block |
| `8a6c9f8` | Step 3.6 impl flips RED→GREEN + V-AI-EVAL-14 Guard 3 future-proofed (ceiling→floor amendment) | 1310/1310 GREEN | First documented occurrence of count-guard ceiling-to-floor amendment |
| `cdd367a` | Step 3.6 re-baseline DIAGNOSTIC · REGRESSION captured | data only | 7.4→6.0 avg · 80%→60% pass · canonical NOT overwritten · root cause: Example 12 inline `*[invokes proposeAction(...)]*` notation IMITATED by LLM as prose text |
| `58b27c3` | Step 3.6 REVERT (user Option A) | 1307/1307 GREEN | Rolled back Rule 4 sentence + Example 12 + Recommended-fields block · V-AI-EVAL-16/17 + V-CHAT-D-4 RETIRED · V-AI-EVAL-14 Guard 3 future-proofing STAYS |

**Lesson locked**: behavior examples MUST NOT use inline `*[invokes X(...)]*` notation that LLMs syntactically imitate. Recorded in CH38(a) extension + framing-doc A15.

### Phase 3 · Step 3.7 with safe-notation retry

| Commit | What | Banner | Notes |
|---|---|---|---|
| `9aea764` | Step 3.7 preamble + RED (V-AI-EVAL-18/19) | 1307/1309 (2 RED) | Example 12 retry · proven-safe short-form `*[calls X for Y: bullets]*` (Example 8 style) · V-AI-EVAL-19 NEW: negative-guard forbids `*[invokes proposeAction(` re-introduction (forward-protection) |
| `8c781ae` | Step 3.7 impl flips RED→GREEN · Example 11 ALSO rewritten | 1309/1309 GREEN | Scope-expansion documented in 9aea764 hidden-risks: V-AI-EVAL-19 caught Example 11 also used verbose form · rewrote both atomically |

### Phase 4 · D4 25-case expansion

| Commit | What | Banner | Notes |
|---|---|---|---|
| `1168ab9` | D4 golden-set expansion 5 → 25 cases | 1307/1307 (unchanged · data-only) | User-approved expansion with detailed 5-category × signal-strength × engagement-state taxonomy. 20 NEW cases authored per the user's design + the rc.8 sub-arc A.1→A.2 precedent |
| `5466ea3` | D4 25-case re-baseline · NEW canonical measurement bar | data only | 6.68/10 avg · 68% pass · BIG FINDING: add-instance-current is SYSTEMICALLY broken at 1/5 pass · 4 of 5 emit-cases scored 0/10 by no-emission · including the gold-standard ACT-INST-CUR-3 VMware vSphere 7 input · the 5-case foundation's 7.4/80% had MASKED this |

**Root cause hypothesis confirmed**: every emit-kind that fires reliably has its own canonical worked example. add-driver (Example 11) ✓ · add-instance-current (NO example) ✗ · add-instance-desired (NO example) marginal · close-gap (NO example) ✓ but structurally simpler.

### Phase 5 · Step 3.7-redux + Step 3.8 attempted + reverted

| Commit | What | Banner | Notes |
|---|---|---|---|
| (within `9aea764` + `8c781ae`) | Step 3.7 covered above · re-baseline 3f8ff07 below | | |
| `3f8ff07` | Step 3.7 re-baseline · NEW canonical · MIXED RESULT | data only | 6.68→7.4 avg · 68%→76% pass · per-cat add-driver 7.0 · add-instance-current 2.0→6.0 (PRIMARY TARGET HIT) · add-instance-desired 6.6→4.0 (NEW REGRESSION · ACT-INST-DES-1 7→0 hallucination) · close-gap 7.5→10.0 · restraint 10.0 stable |
| `9a63e8e` | Step 3.8 preamble + RED (V-AI-EVAL-20) | 1309/1310 (1 RED) | Example 13 canonical add-instance-desired pattern (replace-with-originId · PowerScale H700 ← HPE 3PAR at DR Site) |
| `abe4982` | Step 3.8 impl flips RED→GREEN + V-AI-EVAL-18 Guard 3 future-proofed (ceiling→floor amendment) | 1310/1310 GREEN | Second documented occurrence of count-guard ceiling-to-floor amendment · pattern locked: only LATEST step holds exact-count · prior steps become floor-only |
| `ae33705` | Step 3.8 re-baseline DIAGNOSTIC · REGRESSION captured | data only | 7.4→5.92 avg · 76%→56% pass · add-instance-current 6.0→2.2 (the Step 3.7 win VANISHED) · add-instance-desired stayed 2.6 (no lift) · canonical NOT overwritten |
| `9b3da8f` | Step 3.8 REVERT (user "Go B" + revert) | 1309/1309 GREEN | Prompt-text iteration cycle CLOSED · 4 iterations · 2 regressions · ±1.5 swing exceeds lift signal · diminishing returns confirmed |

### Phase 6 · Step 3.9 chat-says-vs-chat-does guard (strategic pivot prep)

| Commit | What | Banner | Notes |
|---|---|---|---|
| `9783bf3` | Step 3.9 preamble + RED (V-CHAT-D-5) | 1309/1310 (1 RED) | Defensive UX at chatService output time · NOT prompt-text · application-layer deterministic regex detection |
| `8884e5b` | Step 3.9 impl flips RED→GREEN | 1310/1310 GREEN | HALLUCINATION_RE constant + conjunction guard logic + envelope.proposalEmissionWarning field added to chatService.streamChat |

### Phase 7 · Eval-methodology calibration (Experiments A + B)

| Commit | What | Banner | Notes |
|---|---|---|---|
| `9edcb36` | Calibration captures (Experiments A.1 + A.2 with Claude judge + B with Gemini judge) | data only · 1310/1310 unchanged | REVELATORY findings: (1) sampling-noise floor ±0.3 avg · ±8pp pass with Claude judge · (2) same-model judge inflation ~+2 avg / +24pp pass (Gemini-judge baseline is 5.56/10 · 52% pass · NOT the 7.4/76% Claude-judge canonical) · (3) chat-layer autonomous emission structurally unreliable at this Layer 1 density |

**Three calibration baselines locked**:
- A.1 (21:00:49 · Claude judge): 7.72 avg · 80% pass · per-cat add-driver 9 / current 5.6 / desired 4 / close 10 / restraint 10
- A.2 (21:08:32 · Claude judge): 7.44 avg · 72% pass · per-cat 9 / 5.4 / 3.6 / 9 / 10 (8 min apart · same prompt · Δ +0.28 avg → sampling-noise floor)
- B   (21:16:32 · Gemini judge): 5.56 avg · 52% pass · per-cat 5 / 2 / 2 / 9 / 9.67 (Δ Claude→Gemini ~2 avg · ~24pp pass)

### Phase 8 · Sub-arc D ARCHITECTURE PIVOT (user "go Y · let's make it 10/10 this time")

| Commit | What | Banner | Notes |
|---|---|---|---|
| `662522d` | Sub-arc D ARCHITECTURE PIVOT · framing-doc A19 + SPEC §S20.4.1.5 NEW + §S47 amendment + RULES CH38 narrowing | 1310/1310 unchanged · doc-only | Engineer-issued import via existing Path B importer (§S47) becomes the primary UX path. Mode 2 (chat-inline autonomous proposals) becomes optional / deferred. The chat's role narrows from autonomous mutation-proposer to structured-content-author + suggestion-source. Path B importer + ImportPreviewModal reused (no new modal · no new Apply UX). |
| `c77b8fc` | Step 4 preamble + RED scaffolds (V-FLOW-AI-NOTES-1/2/3 + V-ADAPTER-NOTES-1) | 1310/1314 (4 RED) | Mode 1 Workshop Notes overlay UI (`ui/views/WorkshopNotesOverlay.js` NEW) + Path B adapter (`services/workshopNotesImportAdapter.js` NEW) + topbar `#topbarAiNotesBtn` (CH26 amendment) · 4 RED captured at first guards |

---

## Discipline record · session-wide

### Anchor compliance

- **R11 four-block ritual**: 23/23 commits cite `Browser smoke evidence:` block (or note `doc-only`) ✓
- **Rule A constitutional pre-auth**: 9 explicit `[CONSTITUTIONAL TOUCH PROPOSED]` flows captured this session (Steps 3.5 + 3.6 + 3.7 + 3.8 + 3.9 preambles · 2 reverts · pivot framing · Step 4 preamble). User Q&A captured in every preamble · all approved via "Go with all recommendations" / "go as recommended" / "Go A/B" / "go Y" / specific Q-pair overrides ✓
- **Rule B test-mounts-UX**: N/A this session · all new tests are source-grep contracts (V-AI-EVAL-13..20 + V-CHAT-D-3..5 + V-FLOW-AI-NOTES-1..3 + V-ADAPTER-NOTES-1)
- **Rule C no-degraded-fallback**: N/A · no new entry points this session
- **Rule D tests-don't-move-to-match-code**: 2 ceiling-to-floor amendments documented (V-AI-EVAL-14 Guard 3 at Step 3.6 impl · V-AI-EVAL-18 Guard 3 at Step 3.8 impl) · both SPEC-amendment-driven · NOT code-driven · pattern locked: only latest step holds exact-count guard · prior steps floor-only as count grows ✓
- **Rule E hidden-risks**: ✓ all 23 commit bodies include section

### Drift incidents

None. Every constitutional touch surfaced its preamble + Q&A before code. Every RED-first scaffold flipped GREEN at the matching impl commit (with the 2 Rule-D amendments documented in the impl commit bodies before pushing through). The 2 regression captures (cdd367a + ae33705) were committed as DIAGNOSTIC ONLY (canonical baseline preserved at last validated state · per rc.9 0e3d0f6 precedent).

### Notable scope expansions documented in-flight (not silent)

1. **Step 3.7 Example 11 rewrite** (`8c781ae` body): V-AI-EVAL-19 negative-guard at preamble time caught Example 11 also using the verbose form. Impl scope expanded to rewrite both Example 11 (existing) + add Example 12 (new) atomically. Documented in 9aea764 hidden-risks before impl landed.
2. **Step 3.6 + Step 3.8 V-* Guard 3 ceiling-to-floor amendments**: each adds an example which breaks the prior step's exact-count guard. Pattern recognized + documented + locked: latest step holds exact count · prior steps become `count >= N` floors.

### Bug fixes / lessons captured for future maintainers

- **`*[invokes proposeAction(...)]*` notation hazard** (locked at framing-doc A15 + CH38 extension): behavior examples MUST use short-form `*[calls X for Y: bullets]*` notation (Example 8 style) · NOT verbose inline-args form (LLM imitates the verbose form literally as prose output).
- **Same-model judge inflation** (calibration commit `9edcb36`): Claude-judge inflates by ~+2 avg / +24pp pass vs Gemini-judge on identical chat outputs. Future re-baselines should cite BOTH judges · use the lower (Gemini) score as the honest measurement.
- **Sampling-noise floor** (calibration commit `9edcb36`): ±0.3 avg / ±8pp pass on the 25-case set. Any iteration delta within this band is indistinguishable from sampling noise.
- **Prompt-text iteration ceiling** (locked at framing-doc A19 pivot): autonomous emission cannot be raised beyond ~52% Gemini-judge pass via prompt-text tuning at this Layer 1 density. The fix is architectural (engineer-issued import) · NOT prompt-text iteration.

---

## What lands at session end · state snapshot

### Repository state

- **Branch**: `main` · 23 commits ahead of `origin/main` since rc.9 tag (`e706fd2..c77b8fc`)
- **Push status**: **NOT pushed** per user direction "i dont want it to be puplished to git yet"
- **Tag status**: `v3.0.0-rc.9` is the latest tag · rc.10 NOT tagged (mid-cycle · Step 4 impl + Step 5 + Step 6 remain)
- **APP_VERSION**: `"3.0.0-rc.10-dev"` unchanged from session start
- **Banner**: 1310 GREEN + 4 RED (Step 4 preamble · expected · post-impl flips 1314/1314 GREEN)

### Canonical baselines

- `tests/aiEvals/baseline-action.json` (canonical) · md5 `38f12a900566b5cb1a73ac0ed0358c25` · points at `3f8ff07` Step 3.7 capture · Claude-judge 7.4/10 · 76% pass · 25-case
- 8 timestamped historicals in `tests/aiEvals/`:
  - `baseline-action-2026-05-14T15-51-12-201Z.json` · d73ce60 first baseline (5-case)
  - `baseline-action-2026-05-14T16-26-51-443Z.json` · 368d565 Step 3.5 post-impl (5-case)
  - `baseline-action-2026-05-14T17-44-07-909Z.json` · cdd367a Step 3.6 regression diagnostic (5-case)
  - `baseline-action-2026-05-14T18-57-14-085Z.json` · 5466ea3 D4 first 25-case
  - `baseline-action-2026-05-14T19-36-58-791Z.json` · 3f8ff07 Step 3.7 post-impl (25-case · the canonical pointer)
  - `baseline-action-2026-05-14T20-19-28-974Z.json` · ae33705 Step 3.8 regression diagnostic (25-case)
  - `calibration-A1-claude-judge-2026-05-14T21-00-49Z.json` · Experiment A.1
  - `calibration-A2-claude-judge-2026-05-14T21-08-32Z.json` · Experiment A.2
  - `calibration-B-gemini-judge-2026-05-14T21-16-32Z.json` · Experiment B

### Code state · Sub-arc D contract surfaces

- **Layer 1 prompt-text** (`services/systemPromptAssembler.js`):
  - Rule 4 amended at Step 3.5 (`ee42302`): "MUST invoke" + "contract violation" framing
  - Examples 1-12 present · "12 worked examples" header
  - Example 11 (add-driver canonical) + Example 12 (add-instance-current canonical) · both safe short-form notation post-Step-3.7 (`8c781ae`)
  - Examples 13 (add-instance-desired) REVERTED at Step 3.8 (`9b3da8f`) · prompt-text iteration cycle closed
- **`services/chatService.js`**:
  - Envelope shape: `{ response, provenance, contractAck, groundingViolations, proposedActions, proposalEmissionWarning }`
  - Step 3.9 chat-says-vs-chat-does guard active (`8884e5b`): HALLUCINATION_RE + conjunction logic
- **`services/chatTools.js`**:
  - proposeAction tool registered · description hardened at Step 3.5 (`ee42302`)
  - 4 v1 kinds: add-driver · add-instance-current · add-instance-desired · close-gap
- **`schema/actionProposal.js`**:
  - Canonical Zod schema · v1.0.0 · 4 kinds · per-kind strict payloads
- **`tests/aiEvals/`**:
  - 25-case action-correctness golden set (`actionGoldenSet.js`)
  - Rubric (5 dims) + judge prompt + evalRunner (harness-aware dispatch)

### Step 4 RED scaffolds locked (next session impl target)

- `V-FLOW-AI-NOTES-1` · `ui/views/WorkshopNotesOverlay.js` NEW · export render function · Mode 1 overlay UI
- `V-FLOW-AI-NOTES-2` · WorkshopNotesOverlay.js source dual-pane markers + `[Import to canvas]` button hook
- `V-FLOW-AI-NOTES-3` · app.js or topbar binding for `#topbarAiNotesBtn` (CH26 amendment)
- `V-ADAPTER-NOTES-1` · `services/workshopNotesImportAdapter.js` NEW · imports `ActionProposalSchema` · exports transform function

---

## Open items for next session

### High-priority · Step 4 impl

1. **`ui/views/WorkshopNotesOverlay.js` NEW** (~200-500 lines · constitutional surface · `[CONSTITUTIONAL TOUCH]` impl commit)
   - Dual-pane vertical split layout (per framing-doc A2)
   - Lower pane: auto-bulletpoint editor · always-visible · append-only · localStorage `workshopNotesDraft_v1`
   - Upper pane: rendered markdown from AI-structured notes
   - Toolbar: `[Push notes to AI]` (Cmd+Enter) · `[Re-evaluate all]` (per A3) · `[Import to canvas]` (per A19 pivot) · `[Export PDF]` / `[Export JSON]` (per A8)
   - Keyboard: `Cmd+Shift+N` to open · `Esc` to dismiss · auto-save on every keystroke
   - Resume prompt on overlay reopen if draft exists (per A10)
   - Per-mapping confidence display (HIGH/MEDIUM/LOW + tint per A4)
   - 24-hour divider per A6
2. **`services/workshopNotesImportAdapter.js` NEW** (~50-150 lines · non-constitutional · same impl commit)
   - Takes overlay output (mapping suggestions array with confidence + payload-shape)
   - Validates each via `ActionProposalSchema.safeParse`
   - Constructs Path B importer-compatible payload
   - Drops invalid entries with console.warn (per the established Zod-validation pattern in chatService.streamChat)
3. **`app.js` topbar binding** (`[CONSTITUTIONAL TOUCH]` per HANDOFF.md L34's app.js mention · though app.js is not on the surface list · the binding is constitutional in intent per CH26 amendment)
   - Add `#topbarAiNotesBtn` next to existing `#topbarAiBtn`
   - Wire onclick → `openWorkshopNotesOverlay()` from the new ui module
   - Wire `Cmd+Shift+N` keyboard shortcut → same handler
4. **Browser smoke**: Chrome MCP at `localhost:8080` · verify overlay opens · type bullets · push to AI · click `[Import to canvas]` · ImportPreviewModal opens · per-mapping review works · Apply commits via existing commit functions

Expected post-impl banner: **1314/1314 GREEN** (4 Step-4 RED scaffolds flipped GREEN).

### Medium-priority · Step 5 (Path B importer wiring · post-Step-4-impl)

1. Wire `WorkshopNotesOverlay` `[Import to canvas]` click handler → `workshopNotesImportAdapter.transformOverlayToImportPayload(overlayState)` → Path B importer entry point (which opens ImportPreviewModal)
2. ImportPreviewModal renders the per-mapping list · engineer reviews + selects · Apply runs commit functions · applied entities carry `aiTag.kind = "discovery-note"` (per §S25 extension)
3. New V-* tests at Step 5 preamble · source-grep the wiring path

### Low-priority · Step 6 (re-eval against pivoted architecture · USER-RUN)

1. The 25-case action-correctness rubric INTERPRETATION shifts per A19 (chat structures notes vs chat autonomously emits)
2. Two measurement axes:
   - Chat-layer: 25-case action-correctness rubric · cite BOTH Claude + Gemini judges (per calibration findings)
   - Adapter-layer: deterministic · transform success rate (per-mapping validation pass-through) · should be 100% if adapter is correctly written
   - Apply-layer: deterministic · commit-function success rate · should be 100% per existing Path B (rc.8 tested)
3. Workshop-realism qualitative test: engineer enters real workshop notes · checks that the import flow produces correct mutations

### Deferred · not blocking rc.10

- Mode 2 chat-inline autonomous proposals UX surface (preview-modal at chat overlay) · OPTIONAL · not load-bearing for v1
- ACT-DRIVER-5 priority-shift edge case · engineer-manual-edit workaround via Tab 1 (no v1 action kind exists for priority-change)
- ACT-INST-DES-4 consolidate N→1 · would need schema amendment (originId: string → string | string[]) · v1.5 candidate
- ACT-INST-CUR-1 Commvault carryover · less critical post-pivot (engineer can override "already in engagement" judgment by issuing the import command anyway)
- Expand the 25-case golden set further if needed for additional edge coverage · v1.5 candidate

---

## Session ledger · 23 commits ahead of rc.9 tag

| # | Commit | Title | Phase |
|---|---|---|---|
| 1 | `e706fd2` | release · APP_VERSION rc.9 → rc.10-dev | (prior session) |
| 2 | `08306e4` | docs · Sub-arc D framing decisions LOCKED | (prior session) |
| 3 | `663566b` | docs · Sub-arc D framing AMENDMENTS A1-A13 | (prior session) |
| 4 | `92a3438` | spec · Sub-arc D eval-build preamble + RED | (prior session) |
| 5 | `4421e9c` | feat · Sub-arc D eval-build impl flips RED → GREEN | (prior session) |
| 6 | `46eae3d` | `[CONSTITUTIONAL TOUCH]` Sub-arc D stub-emission preamble + RED | (prior session) |
| 7 | `4bcbf06` | `[CONSTITUTIONAL TOUCH]` Sub-arc D stub-emission impl flips RED → GREEN | (prior session) |
| 8 | `a0d3553` | feat · Sub-arc D eval-runner action-correctness pipeline | (prior session) |
| 9 | `c2847cb` | feat · Sub-arc D eval-runner polish · download filename harness-aware | (prior session) |
| 10 | `7596030` | docs · Sub-arc D handoff prompt v1.0 NEW | (prior session) |
| 11 | `ea6d9ce` | docs · prior-session-end handover refresh | (prior session) |
| 12 | `d73ce60` | data · Sub-arc D Step 3 baseline-action LOCKED · rc.10 FIRST | **Phase 1** |
| 13 | `5ec0a65` | `[CONSTITUTIONAL TOUCH]` Step 3.5 preamble + RED | Phase 1 |
| 14 | `ee42302` | `[CONSTITUTIONAL TOUCH]` Step 3.5 impl flips RED → GREEN | Phase 1 |
| 15 | `368d565` | data · Step 3.5 re-baseline · target HIT (3.8→7.4 / 40→80%) | Phase 1 |
| 16 | `fcf3b07` | `[CONSTITUTIONAL TOUCH]` Step 3.6 preamble + RED | **Phase 2** |
| 17 | `8a6c9f8` | `[CONSTITUTIONAL TOUCH]` Step 3.6 impl flips RED → GREEN | Phase 2 |
| 18 | `cdd367a` | diagnostic · Step 3.6 re-baseline · REGRESSION captured (verbose-notation imitation) | Phase 2 |
| 19 | `58b27c3` | revert · Step 3.6 ROLLED BACK | Phase 2 |
| 20 | `9aea764` | `[CONSTITUTIONAL TOUCH]` Step 3.7 preamble + RED (safe-notation retry) | **Phase 3** |
| 21 | `8c781ae` | `[CONSTITUTIONAL TOUCH]` Step 3.7 impl flips RED → GREEN · Example 11 ALSO rewritten | Phase 3 |
| 22 | `1168ab9` | data · D4 golden-set expansion 5 → 25 cases | **Phase 4** |
| 23 | `5466ea3` | data · D4 25-case re-baseline · NEW canonical (add-instance-current category-wide failure REVEALED) | Phase 4 |
| 24 | `3f8ff07` | data · Step 3.7 re-baseline against 25-case · NEW canonical · MIXED RESULT | **Phase 5** |
| 25 | `9a63e8e` | `[CONSTITUTIONAL TOUCH]` Step 3.8 preamble + RED | Phase 5 |
| 26 | `abe4982` | `[CONSTITUTIONAL TOUCH]` Step 3.8 impl flips RED → GREEN · V-AI-EVAL-18 G3 future-proofed | Phase 5 |
| 27 | `ae33705` | diagnostic · Step 3.8 re-baseline · REGRESSION captured (7.4→5.92) | Phase 5 |
| 28 | `9b3da8f` | revert · Step 3.8 ROLLED BACK · prompt-text cycle CLOSED | Phase 5 |
| 29 | `9783bf3` | `[CONSTITUTIONAL TOUCH]` Step 3.9 preamble + RED (chat-says-vs-chat-does guard) | **Phase 6** |
| 30 | `8884e5b` | `[CONSTITUTIONAL TOUCH]` Step 3.9 impl flips RED → GREEN | Phase 6 |
| 31 | `9edcb36` | data · calibration captures (Experiments A.1 + A.2 + B) · REVELATORY findings | **Phase 7** |
| 32 | `662522d` | `[CONSTITUTIONAL TOUCH]` Sub-arc D ARCHITECTURE PIVOT · framing-doc A19 + SPEC §S20.4.1.5 NEW + §S47 amendment | **Phase 8** |
| 33 | `c77b8fc` | `[CONSTITUTIONAL TOUCH]` Step 4 preamble + RED (Mode 1 overlay + Path B adapter) | Phase 8 |
| 34 | (this commit) | docs · session log NEW · 2026-05-15 Sub-arc D pivot session | doc-only |

Items 12-34 (the 23 commits of this session) are NOT pushed to origin per user direction. Pushing them is a future session decision · the user-direction was explicit ("i dont want it to be puplished to git yet").

---

## Recoverability anchor chain (specific to Sub-arc D post-pivot)

Read in this order to fully reload Sub-arc D's state next session:

1. **`HANDOFF.md`** (refreshed in next commit · the entry point)
2. **`docs/SUB_ARC_D_FRAMING_DECISIONS.md` A19** (the pivot decision · supersedes A14 Q4)
3. **`docs/v3.0/SPEC.md` §S20.4.1.5**  (Workshop Notes → Path B importer flow contract)
4. **`docs/v3.0/SPEC.md` §S47** (Path B importer · pre-existing · amended at pivot)
5. **`docs/v3.0/SPEC.md` §S20.4.1.3 + §S20.4.1.4** (Mode 2 stub-emission contract + Step 3.9 guard · optional / defensive layers)
6. **`docs/RULES.md` §16 CH38** (action-proposal contract · purpose narrowed at pivot)
7. **`tests/aiEvals/calibration-A1/A2/B-*.json`** (calibration evidence motivating the pivot)
8. **`tests/aiEvals/baseline-action.json`** (canonical 3f8ff07 · pre-pivot · Claude-judge biased reference)
9. **`diagnostics/appSpec.js`** V-FLOW-AI-NOTES-1/2/3 + V-ADAPTER-NOTES-1 (Step 4 RED scaffolds locked for impl)
10. **This session log** (`docs/SESSION_LOG_2026-05-15-sub-arc-d-pivot.md`)
11. **Memory file `MEMORY.md`** (auto-loaded · references the project's discipline anchors)

---

## Strategic note for next-session Claude

The pivot at `662522d` LOCKS the architectural direction. Step 4 impl commit should:

1. **Create `ui/views/WorkshopNotesOverlay.js`** — the dual-pane Mode 1 overlay UI per framing-doc A2 + A1 + A10
2. **Create `services/workshopNotesImportAdapter.js`** — the bridge from overlay output to Path B input · uses `ActionProposalSchema`
3. **Add `#topbarAiNotesBtn` to `app.js`** — CH26 amendment · second AI affordance alongside existing chat button
4. **All 4 RED scaffolds flip GREEN** at impl commit (`c77b8fc`'s RED tests + the implied assertion that Path B importer entry point accepts the adapter output)

Do NOT pursue further prompt-text iteration on Sub-arc D. The cycle is closed per the pivot. If add-instance-desired or add-instance-current scoring is a concern, the answer is at the UX layer (engineer reviews via ImportPreviewModal · can adjust before apply) · NOT at the prompt-text layer.

**The "10/10 this time" goal**: achievable because each layer plays to its strength. LLM structures + suggests (good at this · close-gap + restraint score 9-10 across both judges). Engineer reviews + decides (deterministic UX · ImportPreviewModal already shipped). Code mutates (deterministic · commit functions already tested in rc.8). Sub-arc D ships when the overlay UI + adapter are landed.
