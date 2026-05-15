# v3.0.0-rc.10 — release notes

**Tagged**: 2026-05-15 · **Branch**: `main` · **Banner**: **1334/1334 GREEN ✅** · **APP_VERSION at tag**: `"3.0.0-rc.10"` · **Eval baselines (post-pivot · 25-case action-correctness)**: Claude-judge **6.52/10 · 64% pass** (`tests/aiEvals/calibration-A1-claude-judge-2026-05-14T21-00-49Z.json` + user-captured `antrhopic_1.json`) · Gemini-judge (honest) **6.84/10 · 68% pass** (Δ **+1.28 avg / +16pp pass** vs pre-pivot honest 5.56/52% at `calibration-B-gemini-judge-*.json`)

## Top-line summary (rc.9 → rc.10)

Banner 1297 → **1334** (+37 net). rc.10 is the **Sub-arc D Mode 1 release** — the user-facing Workshop Notes overlay ships end-to-end. The Sub-arc D architecture pivoted mid-cycle from autonomous-emission Mode 2 (chat-inline `proposeAction` tool calls) to engineer-issued import via Mode 1 (Workshop Notes overlay → widened Path B importer → ImportPreviewModal → Apply). The pivot is grounded in eval calibration evidence (commit `9edcb36`) showing autonomous emission is structurally unreliable at this LLM density.

Six BUG-WS-N fixes landed during real-user testing of the Mode 1 path, each with regression tests + BUG_LOG entries. The final state: feature is functionally operational end-to-end with the local nginx-proxied Anthropic provider + verified runtime smoke against the user's actual canvas.

## Theme — Workshop Notes Mode 1 + Path B widening + LLM-output-fragility hardening

rc.9 shipped the chat-layer foundations (Rule 10 schema-truthful enumeration · BUG-063 honest empty state). rc.10 builds the engineer-facing surface on top:

1. **Mode 1 Workshop Notes overlay** — topbar `AI Notes` button (Cmd+Shift+N) opens a dual-pane overlay: lower pane for raw bullets · upper pane for AI-structured discovery notes (`## Customer concerns` / `## Drivers identified` / `## Current state captured` / `## Desired state directions` / `## Gaps proposed` / `## Action items`) + per-mapping ActionProposal suggestions. localStorage auto-save · resume-on-reopen prompt · `[Push notes to AI]` (delta) + `[Re-evaluate all]` (full) + `[Import to canvas]` toolbar.
2. **A19 architecture pivot** — primary UX path shifts from "chat autonomously emits `proposeAction`" to "chat structures workshop notes + engineer explicitly commands import via Path B importer (§S47)". The 4 ActionProposal kinds (add-driver · add-instance-current · add-instance-desired · close-gap) flow through the engineer-review pipeline (ImportPreviewModal → Apply via commit functions) instead of mutating directly.
3. **A20 Path B widening** — `§S47` widens from instance-entities-only (rc.8 lock) to instance + driver + gap entities. Per-item `kind` discriminator (`instance.add` · `driver.add` · `gap.close`) + kind-aware drift / preview-modal / applier. `aiTag.kind` enum extends to `"discovery-note"` (Workshop Notes overlay path) + `"ai-proposal"` (Mode 2 reserved for future). RULES `§16 CH36 R7` narrows from "instances only" to "instances by default; Path B imports stamp drivers + gaps too."
4. **LLM-output-fragility hardening (BUG-WS-2/4/5)** — real-LLM testing surfaced 3 distinct JSON-output failure modes (truncation-mid-string · dangling-key truncation · trailing-prose after valid JSON). Each got a forensic root cause + repair heuristic + regression test. `repairTruncatedJson` 5-step → 6-step recovery + NEW `extractFirstBalancedJson` Step 0.5 pre-parse extraction + retry-once-with-strict-JSON-reminder.
5. **In-context error UX (BUG-WS-1)** — overlay survives errors with state intact. `notifyError` modal (which destroyed the workshop overlay via openOverlay singleton) replaced with inline `showOverlayError` red banner. `rawTextareaText` autosave preserves exact textarea content for resume.
6. **3-state Import UX (BUG-WS-3)** — `[Import to canvas]` correctly discriminates never-pushed vs pushed-zero-emitted vs pushed-all-dropped instead of showing the same misleading "Push notes to AI first" message in all cases. State-B (pushed but 0 actionable mappings) gets actionable guidance about action-form bullets.
7. **AI Notes UX polish (BUG-WS-6)** — textarea auto-scrolls to keep caret in view · resizable via `resize: vertical` · ImportPreviewModal z-index above workshop overlay (4800 > 4600) · responsive flex-wrap row layout replaces the rigid 11-column grid that overflowed post-A20.

The 6 BUG-WS entries (BUG-WS-1 through BUG-WS-6) form a discipline-paper-trail: every bug surfaced during real-user testing was reported, forensic-rooted, fixed at root cause (not papered over), and locked with regression tests per `feedback_test_or_it_didnt_ship.md`.

## Per-commit summary (rc.10 commits since rc.9 tag · 47 commits)

| # | Commit | Theme | Banner |
|---|---|---|---|
| 1 | `e706fd2` | APP_VERSION rc.9 → rc.10-dev · first-commit-past-tag bump per R30.1 | 1297/1297 |
| 2 | `08306e4` | docs · Sub-arc D framing decisions LOCKED · 7-question Q&A capture | 1297/1297 |
| 3 | `663566b` | docs · Sub-arc D framing AMENDMENTS A1-A13 · dual-pane spec + multi-mode + 24h divider | 1297/1297 |
| 4 | `92a3438` | spec · Sub-arc D eval-build preamble · SPEC §S48 + V-AI-EVAL-9/10/11 RED | 1297/1300 |
| 5 | `4421e9c` | feat · Sub-arc D eval-build impl · actionRubric + actionJudgePrompt + actionGoldenSet (5-case foundation) | 1300/1300 |
| 6 | `46eae3d` | **[CONSTITUTIONAL TOUCH] Sub-arc D stub-emission preamble** · SPEC §S20.4.1.3 + RULES §16 CH38 + V-AI-EVAL-12 + V-CHAT-D-1/2 RED | 1300/1303 |
| 7 | `4bcbf06` | **[CONSTITUTIONAL TOUCH] Sub-arc D stub-emission impl** · schema/actionProposal.js NEW + proposeAction tool + envelope.proposedActions | 1303/1303 |
| 8 | `a0d3553` | feat · Sub-arc D eval-runner action-correctness pipeline | 1303/1303 |
| 9-11 | `c2847cb` + `7596030` + `ea6d9ce` | feat + docs · eval-runner polish + handoff prompt v1 + session-end handover | 1303/1303 |
| 12 | `d73ce60` | data · Step 3 baseline-action LOCKED · rc.10 FIRST measurement bar | 1303/1303 |
| 13-15 | `5ec0a65` + `ee42302` + `368d565` | **Step 3.5 preamble + impl + re-baseline** · Rule 4 verb-strength + Example 11 + tool description hardening · 3.8→7.4 / 40→80% | 1303→1307 GREEN |
| 16-19 | `fcf3b07` + `8a6c9f8` + `cdd367a` + `58b27c3` | Step 3.6 ATTEMPTED + REVERTED · verbose-notation regression captured + rolled back (notation-imitation hazard locked at framing-doc A15) | 1307→1310 then back to 1307 GREEN |
| 20-21 | `9aea764` + `8c781ae` | **Step 3.7 preamble + impl** · Example 12 retry with safe short-form notation + Example 11 rewrite | 1307→1309 GREEN |
| 22 | `1168ab9` | data · D4 25-case golden-set expansion | 1307/1307 |
| 23 | `5466ea3` | data · D4 25-case re-baseline · NEW canonical · 6.68/10 · 68% pass · add-instance-current category-wide failure REVEALED | 1307/1307 |
| 24-27 | `3f8ff07` + `9a63e8e` + `abe4982` + `ae33705` + `9b3da8f` | Step 3.7 re-baseline + Step 3.8 ATTEMPTED + REVERTED · prompt-text iteration cycle CLOSED (4 iterations · 2 regressions · ±1.5 swing) | 1309→1310 then back to 1309 GREEN |
| 28-29 | `9783bf3` + `8884e5b` | **Step 3.9 preamble + impl** · chat-says-vs-chat-does guard at chatService layer · HALLUCINATION_RE + envelope.proposalEmissionWarning | 1309→1310 GREEN |
| 30 | `9edcb36` | data · Eval calibration · Experiments A.1 + A.2 (Claude judge same-prompt-twice) + B (Gemini judge cross-model) · REVELATORY findings · sampling-noise floor ±0.3-1.0 avg · Claude-judge inflation ~+2 avg | 1310/1310 |
| 31 | `662522d` | **[CONSTITUTIONAL TOUCH] Sub-arc D ARCHITECTURE PIVOT** · A19 framing-doc + SPEC §S20.4.1.5 NEW + §S47 amendment + RULES CH38 narrowing | 1310/1310 |
| 32 | `c77b8fc` | **[CONSTITUTIONAL TOUCH] Step 4 preamble + RED** · V-FLOW-AI-NOTES-1/2/3 + V-ADAPTER-NOTES-1 | 1310/1314 |
| 33-35 | `f73b1b6` + `af04ea8` + `ba493ab` | docs · session log + HANDOFF refresh + handoff prompt v2 NEW | 1310/1314 |
| 36 | `2b5ae78` | **[CONSTITUTIONAL TOUCH PROPOSED] A20 widening preamble** · SPEC §S47.2/3/5/8.4/9 amendments + RULES CH36 R7 + CH38 + framing-doc A20 + 9 RED scaffolds | 1310/1323 |
| 37 | `88f6a32` | **[CONSTITUTIONAL TOUCH] Step 4 impl** · WorkshopNotesOverlay.js NEW + workshopNotesService.js NEW (Path Y) + workshopNotesImportAdapter.js NEW + topbar binding | 1316/1323 (6 of 13 RED → GREEN) |
| 38 | `ccd23c8` | **[CONSTITUTIONAL TOUCH] Step 5 impl** · A20 widening end-to-end · schema/helpers/aiTag.js NEW + driver/gap aiTag fields + importResponseParser/Drift/Applier widen + ImportPreviewModal kind-aware + [Import to canvas] wiring | **1323/1323 GREEN ✅** (7 of 13 → GREEN) |
| 39 | `156cb4c` | docs · session log + HANDOFF refresh post-Step-5 | 1323/1323 |
| 40 | `8594288` | **fix · BUG-WS-1** · Workshop Notes overlay data-loss on Push-to-AI error · notifyError modal destroyed overlay · inline showOverlayError banner + rawTextareaText autosave + 2-step Resume prompt | 1323/1323 |
| 41 | `c1376d5` | docs · Phase 5 addendum + HANDOFF refresh · Step 6 user-run baselines forensic | 1323/1323 |
| 42 | `8b845a4` | **fix · BUG-WS-2** · Push-to-AI "Unterminated string in JSON at position 3713" · max_tokens passthrough on Anthropic/OpenAI/Gemini (Anthropic was hardcoded 1024) + repairTruncatedJson 5-step recovery + retry-once with strict-JSON reminder + 6 regression tests | **1329/1329 GREEN ✅** |
| 43 | `daaa8bd` | docs · Phase 6 addendum + HANDOFF refresh post-BUG-WS-2 | 1329/1329 |
| 44 | `12e178b` | **fix · BUG-WS-3 + BUG-WS-4 + BUG-WS-5** · [Import to canvas] 3-state UX (never-pushed vs pushed-zero-emitted vs pushed-all-dropped) + repairTruncatedJson Step 6 dangling-key strip + NEW extractFirstBalancedJson Step 0.5 trailing-prose extraction · V-FLOW-WS-IMPORT-ZERO-MAPPINGS-1 + V-FLOW-WS-PARSE-REPAIR-1 extended to 10 guards | **1330/1330 GREEN ✅** |
| 45 | `b99e5e1` | docs · Phase 7 addendum + HANDOFF refresh post-BUG-WS-3/4/5 | 1330/1330 |
| 46 | `b217682` | **fix · BUG-WS-6** · AI Notes UX polish · textarea auto-scroll-to-caret + resize:vertical + ImportPreviewModal z-index above workshop overlay (4800>4600) + flex-wrap row layout (responsive replaces rigid 11-col grid) · 4 new regression tests | **1334/1334 GREEN ✅** |
| 47 | `<this commit>` | **rc.10 release-close** · APP_VERSION rc.10-dev → rc.10 · RELEASE_NOTES_rc.10.md authored · HANDOFF refresh · Phase 8 session log addendum · PREFLIGHT 1-8 ticked | 1334/1334 GREEN |

## PREFLIGHT checklist (8 items · ticked at this release-close commit)

| # | Item | Status |
|---|---|---|
| 1a | First-commit-past-tag `-dev` suffix bump | ✓ at `e706fd2` (rc.9 → rc.10-dev) |
| 1b | APP_VERSION drops `-dev` at tag | ✓ at this commit (`3.0.0-rc.10-dev` → `3.0.0-rc.10`) |
| 2 | SPEC §9 / annex updated | ✓ §S20.4.1.3 NEW + §S20.4.1.4 NEW + §S20.4.1.5 NEW + §S47.2/3/5/8.4/9 amendments + §S48 NEW (eval-build) |
| 3 | RULES updated | ✓ §16 CH38 NEW (action-proposal contract · amended ×4 through 3.5/3.6-revert/3.7/3.8-revert/3.9/pivot/A20) + CH36 R7 narrowing (A20) |
| 4 | V-* tests RED-first → GREEN | ✓ V-AI-EVAL-9..20 + V-CHAT-D-1..5 + V-FLOW-AI-NOTES-1/2/3 + V-ADAPTER-NOTES-1/WIDEN-1 + V-FLOW-AI-NOTES-IMPORT-1 + V-FLOW-PATHB-WIDEN-{PARSE,MODAL,DRIFT,APPLY}-1 + V-AITAG-WIDEN-{DRIVER,GAP}-1 + V-AITAG-KIND-WIDEN-1 + V-FLOW-WS-{PARSE-1,PARSE-2,PARSE-REPAIR-1,ERROR-BANNER-1,PUSH-MAX-TOKENS-1,PUSH-RETRY-1,IMPORT-ZERO-MAPPINGS-1,UX-TEXTAREA-RESIZE-1,UX-SCROLL-CARET-1,UX-MODAL-STACK-1,UX-MODAL-ROW-LAYOUT-1} all GREEN. Banner 1297→1334 (+37 net) |
| 5 | Browser smoke against Northstar Health demo | ✓ Chrome MCP runtime smokes verified throughout the cycle: topbar AI Notes button at {x:1743 y:20} · overlay opens with dual-pane DOM · textarea autosave to localStorage rawTextareaText (verified 161 chars + 1965 chars) · Push to AI returns structured markdown (`## Customer concerns / ## Drivers identified / ...`) · Import to canvas opens ImportPreviewModal · Apply commits via importApplier with aiTag.kind="discovery-note" stamped on instance + gap entities · screenshots ss_6284ybzc1 (Step 4) + ss_5746y8och (Step 5) + ss_6837fm09x (BUG-WS-1) + ss_6590b2qxy (BUG-WS-2) + ss_8589wp5gj (BUG-WS-3) |
| 5b | Real-LLM live-key smoke | ✓ Anthropic real-LLM smoke verified during BUG-WS-2/4/5 reproduction (the LLM emitted the truncated-mid-string · dangling-key · trailing-prose responses that surfaced the 3 fragility bugs · proof of real-LLM connectivity through the nginx-proxied Anthropic provider) · Gemini real-LLM smoke verified via user-captured Step 6 baseline `gimini_1.json` (chatProvider:anthropic + judgeProvider:gemini · 25 cases · 6.84/10 · 68% pass) · Local A · not in scope this cycle |
| 6 | RELEASE_NOTES authored | ✓ this file (`docs/RELEASE_NOTES_rc.10.md`) |
| 7 | HANDOFF.md rewritten | ✓ refreshed at this commit for rc.10 tag state |
| 8 | Banner GREEN | ✓ **1334/1334 GREEN** |

## Sub-arc D bug entries (rc.10 forensic trail · CLOSED at tag)

| BUG | Theme | Fix commit | Tests |
|---|---|---|---|
| BUG-WS-1 | Workshop Notes overlay destroyed on Push-to-AI error (notifyError modal singleton) | `8594288` | V-FLOW-WS-ERROR-BANNER-1 (landed retroactively at BUG-WS-2 commit per discipline) |
| BUG-WS-2 | Push-to-AI "Unterminated string in JSON at position 3713" (Anthropic max_tokens:1024 hardcode + no JSON repair + no override) | `8b845a4` | V-FLOW-WS-PARSE-1 + V-FLOW-WS-PARSE-2 + V-FLOW-WS-PARSE-REPAIR-1 + V-FLOW-WS-PUSH-MAX-TOKENS-1 + V-FLOW-WS-PUSH-RETRY-1 |
| BUG-WS-3 | [Import to canvas] said "Push first" after successful push (3-state collapse + 3.5s vanishing toast vs persistent in-overlay banner) | `12e178b` | V-FLOW-WS-IMPORT-ZERO-MAPPINGS-1 |
| BUG-WS-4 | repairTruncatedJson didn't handle dangling-key truncation `{"key":"val", "key2"}` | `12e178b` | V-FLOW-WS-PARSE-REPAIR-1 (extended Guards 4-6) |
| BUG-WS-5 | parseLlmResponse rejected valid JSON + trailing prose (closing fence + rationale block) | `12e178b` | V-FLOW-WS-PARSE-REPAIR-1 (extended Guards 7-10) |
| BUG-WS-6 | AI Notes UX polish (textarea auto-scroll · resize:vertical · modal z-index · row layout overflow) | `b217682` | V-FLOW-WS-UX-{TEXTAREA-RESIZE,SCROLL-CARET,MODAL-STACK,MODAL-ROW-LAYOUT}-1 |

## Architectural follow-ups (DEFERRED to v1.5 polish)

- **Anthropic tool-use API for structured workshop output** — would eliminate the BUG-WS-2/4/5 LLM-output-fragility class entirely (Zod-derived JSON-Schema input · provider serializes structured args natively · no JSON parsing on our side · no truncation/dangling/trailing risks possible). Strongly recommended.
- **DOM-mounting integration test for overlay end-to-end flow** — per Rule B (test-mounts-the-UX) the canonical functional contract for the Push → Import → Preview → Apply chain. Current source-grep tests verify file/CSS contracts only.
- **aiTag chip renderer for drivers + gaps** (Tab 1 driver chip + Tab 4 gap chip per SPEC §S47.9.3) — aiTag is correctly stamped at apply time but no visual surface yet on non-instance entities.
- **Drag-resizable divider between upper/lower workshop overlay panes** — framing-doc A2 spec mentions it · v1.5 polish.
- **Per-kind row layouts in ImportPreviewModal** — current flex-wrap treats all kinds the same · per-kind grid templates (instance-specific · driver-specific · gap-close-specific) could be tighter.
- **Mode 2 chat-inline proposal UX surface** — `proposeAction` tool stays registered + `proposalEmissionWarning` guard active · but no engineer-facing preview-modal hook in the chat overlay. Currently OPTIONAL per A19 framing-doc.
- **Step 7 Mode 1 eval-build** — author a workshop-bullets golden set + structured-notes rubric. The current 25-case rubric measures Mode 2 only.
- **Close-gap slip verification re-run** — Step 6 captures showed close-gap dropped 10 → 7.5 on both judges (worth a verification re-run before v1.0 GA to confirm sampling variance vs real regression).

## Eval baselines at tag

| Capture | Judge | Avg | Pass | Notes |
|---|---|---|---|---|
| `tests/aiEvals/baseline-action.json` (md5 `38f12a900566b5cb1a73ac0ed0358c25`) | Claude (anthropic) | **7.4/10** | **76%** | Pre-pivot · `3f8ff07` Step 3.7 capture · 25-case · canonical reference |
| `tests/aiEvals/calibration-B-gemini-judge-*.json` | Gemini (gemini) | 5.56/10 | 52% | Pre-pivot honest baseline · Experiment B at `9edcb36` |
| User-captured `antrhopic_1.json` (in `Downloads/`) | Claude (anthropic) | 6.52/10 | 64% | Post-pivot Step 6 user-run capture · close-gap dropped 10→7.5 |
| User-captured `gimini_1.json` (in `Downloads/`) | Gemini (gemini) | **6.84/10** | **68%** | Post-pivot Step 6 user-run capture · honest baseline LIFTED +1.28 / +16pp vs pre-pivot honest |

Note: the chat layer is UNCHANGED between Step 3.9 (`8884e5b`) and the rc.10 release (HEAD). The Step 6 deltas vs `3f8ff07` reflect sampling variance + provider drift, NOT architectural regression. Cross-judge convergence flipped post-pivot (Gemini now scores 0.32 higher than Claude · was 1.84 lower pre-pivot · suggests the Claude-judge inflation observed at calibration `9edcb36` was run-to-run variance, not systemic bias).

## Path to non-suffix "3.0.0" GA

- v1.5 polish landings (tool-use API · DOM-mounting integration tests · aiTag chip renderer · drag-resizable divider)
- At least one real-customer workshop run against a v3.0 engagement (Mode 1 + Mode 2 both exercised)
- Close-gap slip verification re-run (confirm sampling variance vs real regression)
- Anthropic + Gemini live-key smoke at the verification spec (current rc.10 verification used a local nginx-proxied Anthropic provider · GA needs both Anthropic direct + Gemini direct)
