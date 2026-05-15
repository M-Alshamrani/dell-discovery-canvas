# Sub-arc D · rc.10 cycle · handoff prompt v1.0 · SUPERSEDED 2026-05-15

> **STATUS · SUPERSEDED 2026-05-15 by [docs/SUB_ARC_D_HANDOFF_PROMPT_v2.md](SUB_ARC_D_HANDOFF_PROMPT_v2.md)**.
>
> This v1 prompt is PRE-PIVOT. It assumes Mode 2 (chat-inline autonomous proposals) ships first by default per the original framing-doc A14 Q4. That decision was SUPERSEDED by framing-doc A19 (commit `662522d` · 2026-05-15) post-eval-methodology-calibration. The new primary UX path is Mode 1 (Workshop Notes overlay → Path B importer · §S20.4.1.5 NEW).
>
> **For fresh-context sessions resuming Sub-arc D work, use the v2 prompt instead**: `docs/SUB_ARC_D_HANDOFF_PROMPT_v2.md`. The v2 prompt reflects the pivot + the calibration findings (Claude-judge inflation · sampling-noise floor · prompt-text iteration ceiling) + the Step 4 impl scope under the pivoted architecture.
>
> This v1 file is preserved as historical reference only · DO NOT use for new-session priming.

---

Paste this prompt as the FIRST message to a fresh-context Claude (or other agent) to pick up the Sub-arc D arc cleanly at 100% fidelity.

The prompt below is **paste-ready**. Copy everything between the `=== BEGIN PROMPT ===` and `=== END PROMPT ===` markers verbatim.

---

```
=== BEGIN PROMPT ===

You are resuming work on Dell Discovery Canvas Sub-arc D (rc.10 cycle · action-proposals capability). Two arc steps are already complete; one user-run step is queued next; three more arc steps remain after that.

Before any code touches, read the following files IN ORDER. Each one is essential context; do NOT skim.

## Required reads (in order, before code)

1. **`HANDOFF.md`** · the project entry point. 5 TIER-1 discipline anchors + 7 non-negotiable rules + constitutional surfaces list + rc.10 candidate list. The single mandatory read for any session on this project.

2. **`docs/SUB_ARC_D_FRAMING_DECISIONS.md`** · the LOCKED framing-ack for Sub-arc D. Q1-Q7 base answers + A1-A13 amendments + 18 consolidated locked decisions + UI overlay sketch + action-proposal schema first cut + walkthrough scenario. Do NOT re-litigate any decision in this doc; if you think a decision needs revisiting, surface it as a question to the user BEFORE proceeding.

3. **`docs/v3.0/SPEC.md` §S20.4.1.3** · Rule 4 amendment + structured proposal emission via tool-use. Defines the chat-side contract for the proposeAction tool + envelope shape + stub scope.

4. **`docs/v3.0/SPEC.md` §S48** (and §S48.1 · §S48.2 · §S48.3 · §S48.4) · AI evaluation rubric annex. §S48.1 locks the chat-quality rubric (rc.8 contract formally LOCKED in rc.10). §S48.2 NEW · action-correctness rubric (Sub-arc D · 5 dims). §S48.3 multi-harness dispatch. §S48.4 trace.

5. **`docs/RULES.md` §16 CH37 + CH38** · CH37 = Sub-arc C schema-truthful enumeration (rc.9 baseline). CH38 NEW = structured-action-proposal contract (rc.10 Sub-arc D · 7 sub-rules a-g).

6. **`schema/actionProposal.js`** · canonical Zod schema. 4 v1 action kinds (add-driver · add-instance-current · add-instance-desired · close-gap). Discriminated union on `kind`. Per-kind strict payload schemas. Shared fields: confidence (HIGH/MEDIUM/LOW) · rationale · source (discovery-note | ai-proposal) · optional targetState.

7. **`tests/aiEvals/actionRubric.js`** + **`actionJudgePrompt.js`** + **`actionGoldenSet.js`** · the action-correctness eval harness. 5-case foundation golden set (one per v1 category: add-driver · add-instance-current · add-instance-desired · close-gap · restraint). The judge LLM scores emitted proposals against the 5-dim rubric.

8. **`tests/aiEvals/evalRunner.js`** · extended for multi-harness dispatch. `window.runCanvasAiEvals({ harness: "action-correctness" })` routes to the action-correctness modules; default `chat-quality` harness unchanged. Real-LLM at every call (no mocks).

9. **`services/chatTools.js`** · proposeAction tool registered. Input_schema imports ACTION_KINDS from schema/actionProposal.js (single source of truth · no JSON-Schema-vs-Zod drift).

10. **`services/chatService.js`** · envelope extended with `proposedActions[]` field. Tool-use loop captures proposeAction calls + validates via ActionProposalSchema.safeParse + appends valid proposals to the envelope.

11. **`services/systemPromptAssembler.js`** · Layer 1 Role section Rule 4 AMENDED. Branches on structured-action-shape vs free-text proposal. No em dash in the rule body.

12. **`tests/aiEvals/baseline.json`** · the rc.9 chat-quality measurement bar (9.32/10 avg · 100% pass rate on 25-case golden set). Sub-arc D adds a SEPARATE baseline file at `baseline-action.json` after the step 3 user-run capture.

After all 12 reads, acknowledge using the structured template below. Do NOT skip the ack. Do NOT proceed to code until the user explicitly directs.

## Required ack structure

```
## Sub-arc D handoff ack

**5 discipline layers** (each one a binding contract · cite the anchor doc):
1. <name>: <one line>
2. <name>: <one line>
3. <name>: <one line>
4. <name>: <one line>
5. <name>: <one line>

**Sub-arc D arc state** (cite commit hashes from `git log --oneline`):
- Framing decisions LOCKED: docs/SUB_ARC_D_FRAMING_DECISIONS.md commits ___ + ___
- Eval-build complete: SPEC §S48 LOCKED commit ___ + action* files commit ___
- Stub-emission complete: SPEC §S20.4.1.3 + RULES §16 CH38 commit ___ + impl commit ___
- Eval-runner end-to-end pipeline + harness-aware download: commits ___ + ___
- Current banner: 1303/1303 GREEN in Docker canonical env

**Discipline-order progress**:
- Step 1 (eval framework FIRST): DONE
- Step 2 (stub action-proposal flow): DONE
- Step 3 (baseline against stub): USER-RUN PENDING
- Step 4 ([CONSTITUTIONAL TOUCH PROPOSED] preamble for user-facing impl): QUEUED
- Step 5 (implementation: preview modal + Apply button + CH26 amendment + Mode 1 surface): QUEUED
- Step 6 (re-eval verifies lift): QUEUED

**LOCKED decisions** (do NOT re-litigate · cite the framing doc Q if challenged):
- Mode 2 (chat-inline) ships first by default · flips to Mode 1 if live workshop within 3 weeks (Q4)
- Action proposals via tool-use (proposeAction), NOT free-text JSON (Q1)
- 4 v1 action kinds only · flip-disposition deferred to v1.5 (Q2)
- Schema `discovery-note` + `ai-proposal` · chips `Note` + `Prop` text-only-no-emoji (Q3)
- Orthogonal eval harnesses (chat-quality + action-correctness · separate baselines) (Q5)
- Rule 4 AMENDED at stub time (Q2-Q6) · no em dash (Tweak 3)
- No-round-trips during note-entry is SCOPED to LLM-inference · cached-locals OK (Q7)
- Mode 1 UI surface: dedicated overlay (Cmd+Shift+N + footer button + topbar AI Notes button per A1) · NOT a tab · NOT inside Canvas Chat overlay
- CH26 amendment for the topbar AI Notes button lands at Step 4 preamble (not before)

**Next action** (from this prompt's "What to do right now" section):
<one paragraph paraphrasing the action you are about to take · cite the SPEC/RULES/framing-doc reference>

**Blocking questions** (if any):
<list anything ambiguous · OR "none · proceeding">
```

After the ack, STOP and wait for the user's "go" / direction. Do NOT trigger the step 3 eval yourself; that is the user's job (it requires their API key + 5-15 min real-time).

## Hard rules (override anything else · also in HANDOFF.md + applied to this arc)

1. **NEVER touch a constitutional surface** without surfacing the literal `[CONSTITUTIONAL TOUCH PROPOSED]` header + Q&A capture + user explicit approval BEFORE code. The Sub-arc D constitutional surfaces touched so far are LOCKED at commits 46eae3d (preamble) + 4bcbf06 (impl). Any further touch to `services/systemPromptAssembler.js` · `services/chatTools.js` · `services/chatService.js` · `schema/actionProposal.js` · or `docs/v3.0/SPEC.md` §S20.4.1.3 · or `docs/RULES.md` §16 CH38 requires a NEW preamble. The Step 4 user-facing impl preamble (preview modal + Apply button + CH26 amendment + Mode 1 surface) is the next constitutional flow.

2. **NEVER push or tag** without explicit user direction (`push` / `tag rc.10` / `ship it`). 9 commits since rc.9 tag are local-only at this handoff. Do NOT push during step 3 trigger; the user may want a single push after step 3 baseline lands.

3. **NEVER commit** without the R11 four-block ritual + Browser smoke evidence block + Hidden risks block in the commit body. Test banner GREEN in Docker canonical env at every commit step.

4. **NEVER use mocks / scripted-LLM / stubbed-fetch** for any eval or chat call. Per feedback_no_mocks.md (LOCKED 2026-05-05). Step 3 baseline is REAL-LLM only · against the user's configured anthropic provider.

5. **NEVER edit a test count or assertion to match new code** (Rule D · feedback_5_forcing_functions.md). Failing test = revert impl OR get SPEC re-confirmed FIRST. If a Step 4 impl breaks any existing V-* test, evaluate per Rule D before modifying the test.

6. **NEVER add a third topbar AI affordance** beyond the locked pair (AI Assist + AI Notes per CH26 amendment proposed at Step 4 preamble). Anti-pattern: collapsing the two affordances into one with sub-modes.

7. **NEVER ship the user-facing impl** (Step 5) without first completing Step 3 (baseline against stub) + Step 4 (constitutional preamble). The discipline order is the contract.

8. **NEVER auto-apply action proposals**. Engineer-conditional approval is mandatory (D-Rule LOCKED). The preview modal at Step 5 has explicit Apply/Reject affordances per proposal · NO auto-commit path at any layer.

9. **NEVER let `flip-disposition` slip into v1**. It is DEFERRED to v1.5 per framing doc Q2 (cascade risk · originId chains may break). If a Step 4/5 impl touches it · STOP and surface to user.

10. **NEVER rename** the proposeAction tool · `proposedActions` envelope field · or `discovery-note`/`ai-proposal` source enum values. They are locked in V-CHAT-D-1 + V-CHAT-D-2 + V-AI-EVAL-12 source-grep guards. Renaming requires retroactive amendment commit BEFORE the rename code lands.

## What to do RIGHT NOW (after the ack)

1. Read all 12 files in order (above) without taking any action.
2. Produce the structured ack matching the template.
3. STOP. Wait for user direction.

The user's most likely next direction is one of:

- **(a) Step 3 trigger**: user runs `window.runCanvasAiEvals({ harness: "action-correctness", judgeProviderKey: "anthropic" })` in their browser devtools. You wait. User hands back the `baseline-action-<timestamp>.json` file. You commit it as the rc.10 measurement bar with forensic analysis (matches the Sub-arc C rc.9 pattern: copy into `tests/aiEvals/baseline-action.json` canonical + timestamped historical · commit with R11 + delta-vs-empty-baseline analysis since this is the first action baseline).

- **(b) Step 4 preamble**: user authorizes the constitutional preamble for the user-facing impl. You surface `[CONSTITUTIONAL TOUCH PROPOSED]` covering: preview modal (extends `ImportPreviewModal` from §S47) · Apply button + commit-function wiring · CH26 amendment (topbar AI Notes button) · aiTag.kind enum extension (§S25 amendment to add `discovery-note` + `ai-proposal`) · Mode 1 surface (only if 3-week-workshop toggle clause has fired per Q4 · otherwise Mode 1 ships at Step 5b). Capture user Q&A · wait for "Go with all proposed answers" or per-Q overrides.

- **(c) Push first**: user says `push`. You push the 9 commits to `origin/main`. No tag (rc.10 is not done; tag only after step 6 re-eval lands).

- **(d) Pause / handoff to another session**: user says they are done for the day. You acknowledge + suggest reading `HANDOFF.md` for the rc.10-cycle entry point next session.

If the user's direction is ambiguous or unfamiliar, ask one short clarifying question before acting. Do NOT guess.

## Anti-patterns specific to this handoff

- ❌ Surfacing a new `[CONSTITUTIONAL TOUCH PROPOSED]` for Step 4 before the user explicitly authorizes proceeding past Step 3. The eval baseline result may reveal we need an intermediate refinement (e.g., adding Example 11 demonstrating proposeAction use) BEFORE the user-facing impl. Sequential discipline.

- ❌ Triggering `window.runCanvasAiEvals(...)` yourself. You do NOT have the user's API key configured. Even if you did, the cost + time is the user's call.

- ❌ Authoring a preview-modal / Apply-button stub without Step 4 preamble. Constitutional discipline gate.

- ❌ Modifying `proposedActions` field name OR proposeAction tool name OR action-kind enum values to "improve" them. They are locked across SPEC + RULES + tests + impl + framing doc + schema. Renames require full retroactive amendment.

- ❌ Skipping the structured ack to dive into work. The ack is the discipline gate; without it the agent has no signal-of-comprehension that the LOCKED decisions are understood.

- ❌ Adding new V-* tests for Step 4/5/6 work without RED-first → GREEN cycle per Sub-arc B precedent (rc.8 commit 40f55d1 spec+RED · 7fcc8b6 impl). Preamble commit captures RED; impl commit flips to GREEN. Banner deltas visible in every commit body.

- ❌ Bundling step 3 baseline-capture commit with step 4 preamble code. Two distinct discipline phases · two commits.

- ❌ Editing `docs/SUB_ARC_D_FRAMING_DECISIONS.md` to amend a locked decision without surfacing the amendment Q&A first. The doc is the source of truth for Q1-Q7 + A1-A13; downstream commits reference it.

## Cross-references (for the agent's deeper reading after ack)

- `docs/RELEASE_NOTES_rc.9.md` · rc.9 close · 9.32/10 baseline · 100% pass · the measurement bar above which Sub-arc D must not regress chat-quality
- `docs/SESSION_LOG_2026-05-14-rc.9-close.md` · full rc.9 cycle narrative · context for "what came before this handoff"
- `docs/v3.0/SPEC.md` §S37 · grounding contract recast (rc.6) · Sub-arc D builds on this for proposal honesty
- `docs/v3.0/SPEC.md` §S25 · `aiTag.kind` discriminator · Step 4 extends this enum
- `docs/v3.0/SPEC.md` §S47 · ImportPreviewModal · Step 5 preview modal EXTENDS this pattern
- `tests/aiEvals/baseline.json.HOWTO.md` · the canonical baseline capture procedure · applies identically to the action-correctness harness (substitute `baseline-action.json` for `baseline.json`)
- Memory anchors: `feedback_5_forcing_functions.md` Rule A · `feedback_principal_architect_discipline.md` R11 · `feedback_no_mocks.md` · `feedback_browser_smoke_required.md` · `feedback_chrome_mcp_for_smoke.md` · `feedback_no_push_without_approval.md`

=== END PROMPT ===
```

## Template maintenance

This handoff prompt is **arc-specific** (rc.10 Sub-arc D). When Sub-arc D ships fully (Step 6 complete · rc.10 tagged), this doc gets archived OR retired:

- Archive: rename to `docs/SUB_ARC_D_HANDOFF_PROMPT_rc.10-final.md` and tag at the rc.10 close commit
- Retire: delete + replace with a fresh `docs/SUB_ARC_E_HANDOFF_PROMPT.md` (or whichever arc is next)

The generic `docs/SESSION_PRIMING_PROMPT.md` v1.0 remains the entry point for fresh-context sessions on the project as a whole; this arc-specific prompt LAYERS on top of it.

## Cross-references

- `docs/SESSION_PRIMING_PROMPT.md` v1.0 · the generic fresh-context session priming (project-level)
- `docs/SUB_ARC_D_FRAMING_DECISIONS.md` · the LOCKED framing-ack for Sub-arc D
- `docs/HANDOVER_TEMPLATE.md` v1.0 · the canonical handover template for session-end refreshes
- `HANDOFF.md` · the filled instance of HANDOVER_TEMPLATE · current state of the project + rc.10 candidate list
