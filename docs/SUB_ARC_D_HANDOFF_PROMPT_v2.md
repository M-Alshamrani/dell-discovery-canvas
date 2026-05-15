# Sub-arc D Handoff Prompt v2 · POST-PIVOT · Step 4 impl ready

**Authority**: paste-ready prompt for fresh-context Claude session to execute Sub-arc D Step 4 (Mode 1 Workshop Notes overlay + Path B adapter + topbar AI Notes button binding) at 100% fidelity to the architectural decisions locked in the 2026-05-15 pivot session.

**Supersedes**: `docs/SUB_ARC_D_HANDOFF_PROMPT.md` v1 (pre-pivot · assumed Mode-2-first · framing-doc A14 Q4 SUPERSEDED by A19). The v1 file is kept in the repo for historical reference only.

**Status**: LOCKED 2026-05-15 post-session-end (HEAD `af04ea8` · 24 commits ahead of `origin/main` · NOT pushed).

---

=== BEGIN PROMPT ===

You are resuming work on Dell Discovery Canvas (rc.10 cycle · Sub-arc D · POST-PIVOT). The prior session executed an architecture pivot for Sub-arc D · 24 commits LOCAL ONLY since rc.9 tag. Your job this session: land Step 4 impl + Step 5 wiring + Step 6 re-eval to ship Sub-arc D's Mode 1 capability (Workshop Notes overlay → Path B importer → engineer applies via ImportPreviewModal). Goal: 10/10 ship-confidence per user direction "go Y , lets make it 10/10 this time."

Before any code touches, read the following IN ORDER. Each one is essential context · do NOT skim.

## Required reads (in order, before code)

1. **HANDOFF.md** · the project entry point. Refreshed at the end of the prior session. Current state · tier-1 anchors · next-action target. THE mandatory read.

2. **docs/SESSION_LOG_2026-05-15-sub-arc-d-pivot.md** · full 23-commit narrative of the prior session. Read the Phase 8 section (Architecture Pivot) + the Open Items section for Step 4 impl specifics.

3. **docs/SUB_ARC_D_FRAMING_DECISIONS.md A19** (top section · search for "A19") · the pivot decision. SUPERSEDES A14 Q4. Captures rationale + what changed + what stayed. The architectural lock.

4. **docs/v3.0/SPEC.md §S20.4.1.5** (search for "S20.4.1.5") · Workshop Notes overlay → Path B importer flow contract. The post-pivot primary UX path. Read this BEFORE touching Step 4 impl.

5. **docs/v3.0/SPEC.md §S47** (search for "§S47 · Import Data workflow") · Path B importer · pre-existing at rc.8 LOCKED 2026-05-12 · AMENDED 2026-05-15 to accept Workshop Notes overlay as second input source. Read both the original §S47 body AND the 2026-05-15 amendment paragraph at the top.

6. **docs/v3.0/SPEC.md §S20.4.1.4 + §S20.4.1.3** · Step 3.9 chat-says-vs-chat-does guard (Mode 2 defensive UX layer · ACTIVE in chatService.streamChat) + Step 3.5 stub-emission contract (Mode 2 optional fallback · proposeAction tool stays registered). Confirms what stays at the chat layer post-pivot.

7. **docs/RULES.md §16 CH38** (search for "CH38") · structured action-proposal contract · purpose narrowed at the pivot · proposeAction tool stays · its purpose is now chat-quality measurement + Mode 2 optional fallback + defensive guard · NOT primary UX path.

8. **schema/actionProposal.js** · canonical Zod schema. 4 v1 action kinds. The Workshop Notes overlay adapter MUST import from this file (single source of truth · no parallel schema definitions).

9. **services/chatService.js** · current state at HEAD `af04ea8` · Step 3.9 chat-says-vs-chat-does guard active · HALLUCINATION_RE constant + envelope.proposalEmissionWarning field. UNTOUCHED by Step 4 impl · but read it to understand the post-Step-3.9 envelope shape.

10. **tests/aiEvals/baseline-action.json** · canonical baseline at Step 3.7 capture (3f8ff07 · Claude-judge 7.4/10 · 76% pass · 25-case). Honest Gemini-judge baseline is 5.56/52% (calibration commit `9edcb36`). DO NOT iterate prompt-text to "fix" the chat layer · the cycle is closed per A19.

11. **diagnostics/appSpec.js · V-FLOW-AI-NOTES-1/2/3 + V-ADAPTER-NOTES-1** · the 4 RED scaffolds locked at Step 4 preamble (commit `c77b8fc`). Search for "V-FLOW-AI-NOTES-1" to find the test block. These guards lock the architectural shape of Step 4 impl. Read each guard's body to understand what the impl MUST satisfy.

12. **tests/aiEvals/calibration-A1-claude-judge-*.json + calibration-A2-*.json + calibration-B-gemini-judge-*.json** · the 3 calibration captures (commit `9edcb36`) that motivated the pivot. Skim the per-case results to understand which categories work robustly (close-gap + restraint · both judges agree at 9-10/10) vs which have Claude-judge inflation (add-driver + add-instance-current · ~3-4 point divergence).

After all 12 reads, acknowledge using the structured template below. Do NOT skip the ack. Do NOT proceed to code until the user explicitly directs.

## Required ack structure

## Sub-arc D Step 4 impl handoff ack (POST-PIVOT)

**5 discipline layers** (each binding · cite the anchor doc):
1. <name>: <one line>
2. <name>: <one line>
3. <name>: <one line>
4. <name>: <one line>
5. <name>: <one line>

**Sub-arc D arc state** (cite commit hashes):
- PIVOT LOCKED: `662522d` framing-doc A19 + SPEC §S20.4.1.5 NEW + §S47 amendment + RULES CH38 narrowing
- Step 4 preamble LANDED: `c77b8fc` · 4 RED scaffolds (V-FLOW-AI-NOTES-1/2/3 + V-ADAPTER-NOTES-1)
- Step 3.9 guard ACTIVE: `8884e5b` · chatService HALLUCINATION_RE + proposalEmissionWarning envelope field
- Canonical baseline: `3f8ff07` Claude-judge 7.4/76% · honest baseline (Gemini) 5.56/52% per calibration `9edcb36`
- Current banner: 1310/1314 (1310 GREEN + 4 Step-4 RED captured)
- Push status: 24 commits LOCAL ONLY since rc.9 tag · NOT pushed (user direction "i dont want it to be puplished to git yet")

**LOCKED architectural decisions (POST-PIVOT · do NOT re-litigate)**:
- Mode 1 (Workshop Notes overlay → Path B importer) is the PRIMARY UX path (A19 supersedes A14 Q4)
- Mode 2 (chat-inline autonomous proposals) is OPTIONAL / DEFERRED · not load-bearing for v1
- Path B (§S47) accepts TWO input sources: file upload (original) + Workshop Notes overlay output (new · via adapter)
- ImportPreviewModal (existing · pre-shipped at rc.8) is REUSED for per-mapping review · NO new preview modal
- Apply path REUSED · `state/collections/*Actions.js` commit functions · NO new Apply UX
- ActionProposalSchema is the canonical shape (single source of truth · NO parallel definitions in the adapter)
- aiTag.kind = "discovery-note" applied via Path B importer at apply time (per §S25 extension)
- topbar carries TWO AI affordances: #topbarAiBtn (Cmd+K · existing) + #topbarAiNotesBtn (Cmd+Shift+N · NEW · CH26 amendment)
- Prompt-text iteration cycle CLOSED · do NOT attempt new Examples 13+ at Layer 1 · the architectural fix is at the UX layer
- Same-model judge contamination is real (+2 avg / +24pp pass Claude over Gemini) · future re-baselines cite BOTH judges

**Step 4 impl scope (3 surfaces · ~half-day effort)**:

1. **ui/views/WorkshopNotesOverlay.js NEW** (constitutional · ~200-500 lines)
   - Dual-pane vertical split per framing-doc A2 (60% upper / 40% lower default · drag-resizable · localStorage-persisted)
   - Lower pane: auto-bulletpoint editor · `Enter` = new bullet · `Tab` = indent · `Shift+Tab` = outdent · always-visible · append-only · localStorage `workshopNotesDraft_v1` auto-save every keystroke
   - Upper pane: rendered markdown from AI-structured notes · per-mapping expansion icons showing canvas data points (drivers/envs/instances/gaps mapped + confidence + rationale) · HIGH/MEDIUM/LOW text labels with light green/amber/gray tinting (per A4)
   - Toolbar (upper pane): `[Push notes to AI]` (also Cmd+Enter) · `[Re-evaluate all]` (per A3) · `[Import to canvas]` (per A19 pivot · feeds Path B adapter) · `[Export PDF]` · `[Export JSON]`
   - Keyboard: `Cmd+Shift+N` to open · `Esc` to dismiss (auto-save fires) · `Cmd+Enter` to push notes
   - Resume prompt on overlay reopen if draft exists (per A10): "You have unsaved notes from <timestamp>. Resume or Start fresh (discards draft)?"
   - 24-hour divider in engineer local TZ at calendar-day boundary (per A6)
   - V-FLOW-AI-NOTES-1 + V-FLOW-AI-NOTES-2 source-grep guards lock this file's existence + dual-pane structure + [Import to canvas] button hook

2. **services/workshopNotesImportAdapter.js NEW** (non-constitutional · ~50-150 lines)
   - Imports `ActionProposalSchema` from `schema/actionProposal.js` (single source of truth · V-ADAPTER-NOTES-1 Guard 1 source-grep)
   - Exports `transformOverlayToImportPayload(overlayState)` (or similarly named · V-ADAPTER-NOTES-1 Guard 2 source-grep)
   - Transforms overlay's mapping suggestions (per-suggestion with confidence + payload-shape) → Path B importer-compatible payload
   - Validates each suggestion via `ActionProposalSchema.safeParse` · drops invalid entries with `console.warn` (same pattern as chatService.streamChat tool-use loop)
   - Returns the validated payload array ready for Path B `ImportPreviewModal` ingestion

3. **app.js topbar binding** (constitutional per CH26 amendment · few lines)
   - Add DOM element `#topbarAiNotesBtn` next to existing `#topbarAiBtn` (CH26 amendment: topbar carries TWO AI affordances)
   - Wire onclick → `openWorkshopNotesOverlay()` import from the new ui module
   - Wire `Cmd+Shift+N` keyboard shortcut → same handler
   - V-FLOW-AI-NOTES-3 source-grep guards this · search for `topbarAiNotesBtn` string in app.js

**Next action** (from this prompt's "What to do RIGHT NOW" section):
<one paragraph paraphrasing your immediate action · cite SPEC/framing/test references>

**Blocking questions** (if any):
<list anything ambiguous · OR "none · proceeding">

After the ack, STOP and wait for the user's "go" direction. The user may want to adjust scope, defer Step 5/6, or proceed straight to impl.

## Hard rules (override anything else · also in HANDOFF.md)

1. NEVER touch a constitutional surface without surfacing the literal `[CONSTITUTIONAL TOUCH PROPOSED]` header + Q&A capture + user explicit approval BEFORE code. Step 4 impl IS pre-authorized via the pivot `662522d` + Step 4 preamble `c77b8fc` · but ANY scope expansion beyond V-FLOW-AI-NOTES-* + V-ADAPTER-NOTES-1 (e.g. touching schema/actionProposal.js · chatService.js · chatTools.js) requires a NEW preamble.

2. NEVER push or tag without explicit user direction. The 24 commits since rc.9 tag are LOCAL ONLY · keep them local · push only when user explicitly says "push" / "ship it" / "tag rc.10".

3. NEVER commit without R11 four-block ritual + `Browser smoke evidence:` block + `Hidden risks at this layer:` block in the commit body. Banner GREEN in Docker canonical env at every commit step.

4. NEVER use mocks / scripted-LLM / stubbed-fetch for any eval or chat call. Per `feedback_no_mocks.md`. Step 6 re-eval (if you run it) is REAL-LLM only against the user's configured provider.

5. NEVER edit a test count or assertion to match new code (Rule D · `feedback_5_forcing_functions.md`). If Step 4 impl breaks an existing V-* test, evaluate per Rule D · revert impl OR get SPEC re-confirmed FIRST.

6. NEVER add a third topbar AI affordance beyond the locked pair (AI Assist `#topbarAiBtn` + AI Notes `#topbarAiNotesBtn` per CH26 amendment). Anti-pattern: collapsing the two affordances into one button with sub-modes.

7. NEVER ship Step 4 impl without first running browser smoke via Chrome MCP at `localhost:8080` confirming: overlay opens · type bullets · push to AI · click [Import to canvas] · ImportPreviewModal opens · per-mapping review works · Apply commits via existing commit functions · applied entities carry `aiTag.kind = "discovery-note"`.

8. NEVER reintroduce inline `*[invokes proposeAction(...)]*` notation in Layer 1 behavior examples. V-AI-EVAL-19 negative guard locks this · violation breaks the chat layer's tool-use adherence (proven at Step 3.6 + Step 3.8 regressions). Use safe short-form `*[calls X for Y: bullets]*` if you ever need a new example.

9. NEVER let prompt-text iteration restart as a strategy for chat-layer reliability. The cycle is closed per A19. If you observe chat-quality concerns post-Step-4-impl, the answer is at the UX layer (engineer reviews via ImportPreviewModal · can correct before apply) · NOT at Layer 1 prompt-text.

10. NEVER let the adapter parallel-define ActionProposalSchema. The adapter MUST import from `schema/actionProposal.js`. V-ADAPTER-NOTES-1 Guard 1 enforces. Schema drift between overlay output and importer expectations is the silent-failure path the pivot explicitly engineered against.

11. NEVER bypass the engineer-review step at apply time. The ImportPreviewModal MUST be opened on [Import to canvas] click. No auto-apply at any layer in v1 (D-Rule LOCKED 2026-05-13 · pre-dates the pivot · still binding post-pivot).

12. NEVER skip the `aiTag.kind = "discovery-note"` stamping. Per §S25 extension · instances/gaps/drivers applied via the overlay import flow MUST carry this tag at apply time. The tile chip renderer shows `"Note"` chip text.

## What to do RIGHT NOW (after the ack)

1. Read all 12 files in order (above) without taking any action.
2. Produce the structured ack matching the template.
3. STOP. Wait for user direction.

The user's most likely next direction is one of:

- **(a) Step 4 impl · proceed**: surface a brief plan (which file you'll create first · the dual-pane structural decisions you'll make · the adapter shape). After user confirms, execute the 3 file surfaces · run browser smoke via Chrome MCP · commit as `[CONSTITUTIONAL TOUCH] Sub-arc D Step 4 impl flips RED → GREEN`. Banner target: 1314/1314 GREEN.

- **(b) Step 4 + Step 5 bundled · proceed**: Step 4 (overlay + adapter + topbar binding) AND Step 5 (Path B importer wiring + ImportPreviewModal integration · per-mapping aiTag.kind stamping at apply time) in one session. Heavier · ~6-8 hours · same browser smoke pattern. Commit as 2 separate constitutional impl commits with browser smoke each.

- **(c) Step 6 re-eval first (USER-RUN)**: capture a current-state baseline against the pivoted architecture BEFORE Step 4 impl. Costs ~$1.50 + 15 min (Claude + Gemini judges per calibration discipline). RESULT: a pre-impl reference that Step 6 post-impl will show the lift against. Not strictly necessary since `3f8ff07` is the current canonical · but adds rigor.

- **(d) Adjust scope**: user may want to change something (e.g. defer Step 5 to a later session · drop the [Re-evaluate all] button from Step 4 · simplify the overlay UI). Ask one clarifying question before proceeding.

If the user's direction is ambiguous or unfamiliar, ask one short clarifying question. Do NOT guess.

## Quick reference · key file locations

- **Repo root**: `C:\Users\Mahmo\Projects\dell-discovery\`
- **Docker container**: `localhost:8080` (canonical env · rebuild with `docker compose down && docker compose up -d --build`)
- **Test runner**: `localhost:8080/?runTests=1` (in-browser · ~22-25 sec full pass)
- **Eval runner** (USER-RUN only · Step 6): `localhost:8080` → devtools → `window.runCanvasAiEvals({ harness: "action-correctness", judgeProviderKey: "anthropic" })` (or `"gemini"` for cross-judge calibration)
- **Browser smoke**: Chrome MCP via `mcp__Claude_in_Chrome__navigate` to `localhost:8080?runTests=1` · `read_console_messages` with pattern `[Tests] \d+/\d+`

## What success looks like at session-end

- Banner: **1314/1314 GREEN** (Step 4 impl flips all 4 RED → GREEN · zero regressions)
- Working tree: clean
- New constitutional commit(s) for Step 4 impl (+ Step 5 if bundled): each with full R11 + Hidden risks + browser smoke evidence
- Engineer can open Workshop Notes overlay (Cmd+Shift+N OR topbar button) · type bullets · push to AI · review structured notes · click [Import to canvas] · review per-mapping in ImportPreviewModal · click Apply per mapping · applied entities appear on the canvas tabs with "Note" chip
- Session log written (`docs/SESSION_LOG_2026-05-15-step4-impl.md` or similar)
- HANDOFF.md refreshed for new session-end state
- Push status: still LOCAL ONLY unless user explicitly directs push

That's the bar. Make it 10/10.

=== END PROMPT ===

---

## Maintenance notes (not for paste · for repo maintainers)

- v2 supersedes v1 (`docs/SUB_ARC_D_HANDOFF_PROMPT.md` · the pre-pivot prompt). v1 is preserved for historical reference.
- If the architecture pivots again in a future session, supersede this v2 with v3 · update HANDOFF.md's anchor chain pointer · annotate the v2 header.
- The 12-file read order is intentionally aggressive · the next-session Claude must internalize the pivot before touching code. Skimming risks reintroducing Mode-2-first assumptions from the v1 framing.
- Step 5 + Step 6 are documented but DEFERRED in the most-likely-direction list. The user may choose to do them in the same session OR split them out.
