# v3.0.0-rc.9 — release notes

**Tagged**: 2026-05-14 · **Branch**: `main` (+ `v3.0-data-architecture`) · **Banner**: **1297/1297 GREEN ✅** · **APP_VERSION at tag**: `"3.0.0-rc.9"` · **Eval baseline**: **9.32/10 avg · 100% pass rate** on 25-case golden set (25/25)

## Top-line summary (rc.8 → rc.9)

Banner 1292 → **1297** (+5 net). Eval **9.16/10 · 96% pass → 9.32/10 · 100% pass** (+0.16 avg · +4pp pass rate). rc.9 is the **schema-truthful chat release** — Canvas AI Assist learns that the v3 install-base schema collects names but not quantities, so it enumerates by name (Rule 10) and refuses to compute percentages or weighted aggregates. The same arc closes BUG-063 (engagement-init residual fields) by relaxing the schema's `.min(1)` constraints so the empty state is honestly empty rather than carrying real-looking placeholder defaults the chat would mistakenly read as customer data.

## Theme — honest empty state + schema-truthful enumeration

rc.8 shipped the AI eval harness + measured the chat at 9.16/10 with one failing case (GRD-2 5/10 · *"enumerated counts and layer distribution are not grounded"*). rc.9 attacks that failure at its root:

1. **Rule 10 (Quantitative honesty)** — the v3 install-base schema collects names + types + descriptions but NOT quantities. The chat therefore enumerates items by name (never percentage / weighted aggregate / capacity-share across rows). Schema-conditional: rule narrows automatically when a `quantity` field is added to a layer's instance schema (future feature per `docs/ROADMAP.md`).
2. **Example 9** — per-entity drilldown pattern via `selectLinkedComposition` (D's force-multiplier for entity-named action proposals in rc.10).
3. **Example 10** — enumerate-by-name pattern via `selectMatrixView`, citing Rule 10 inline so enforcement is traceable in the chat's own output.
4. **BUG-063 fix** — schema relaxation + factory defaults flip so `createEmptyEngagement()` returns truly empty customer fields; the chat sees `customer.vertical = ""` and refuses fabrication where rc.8 would have read `"Financial Services"` as a real value.
5. **3 user-facing reference docs** — `CANVAS_CHAT_USER_GUIDE.md` · `CURRENT_VS_DESIRED_STATE.md` · `GAP_TYPE_VS_DISPOSITION.md` — institutional knowledge that pairs with the behavioral rules.

This is the **discipline-paper-trail release**: every commit follows the R11 four-block ritual (Recite · Answer · Execute · Pledge-Smoke-Screenshot) + Hidden risks block; every constitutional touch surfaces an explicit `[CONSTITUTIONAL TOUCH PROPOSED]` preamble with Q&A captured before code; every test flips RED-first then GREEN against the canonical Docker nginx environment.

## Per-commit summary (rc.9 commits since rc.8 tag · 11 commits)

| Commit | Theme | Banner |
|---|---|---|
| `f70cc38` | APP_VERSION rc.8 → rc.9-dev · first-commit-past-tag bump per R30.1 + retroactive rc.8 git tag created on `a322262` | 1292/1292 (no test impact; doc-only constant change) |
| `9e85543` | Eval baseline JSON captured into repo · closes discipline gap (HANDOFF / RELEASE_NOTES / version ledger cited a file that wasn't in the repo) | 1292/1292 unchanged |
| `37356bd` | **[CONSTITUTIONAL TOUCH] Sub-arc C Commit A** · SPEC §S20.4.1.2 (quantitative honesty rule + Examples 9-10) · RULES §16 CH37 · ROADMAP NEW · V-AI-EVAL-6/7/8 RED scaffolds | 1292 → 1295 (3 RED captured) |
| `2f3176f` | **[CONSTITUTIONAL TOUCH] Sub-arc C Commit B** · `systemPromptAssembler.js` Layer 1 Role gains Rule 10 + Examples 9 + 10 · V-AI-EVAL-6/7/8 RED → GREEN | 1295/1295 GREEN |
| `595264f` | **Sub-arc C Commit C** · 3 author-only docs (CHAT_USER_GUIDE + CURRENT_VS_DESIRED + GAP_TYPE_VS_DISPOSITION) · DELL_SOLUTIONS matrix deferred to rc.10 (SME blocker) | 1295/1295 GREEN unchanged |
| `0e3d0f6` | DIAGNOSTIC · rc.9 post-Sub-arc-C eval snapshot (8.92/10 · 88% pass · 3 fails); preserved as audit trail. Traced regressions to BUG-063 manifestation (DSC-4 + APP-4) + adjacent honesty gap (APP-5). | 1295/1295 unchanged |
| `b70a96d` | **fix(BUG-063) preamble + RED tests** · V-FLOW-INIT-CLEAR-1/2 RED scaffolds · BUG_LOG status OPEN → IN PROGRESS rc.9 · severity escalated Low-Medium → Medium-High given eval-honesty cost | 1295 → 1297 (2 RED captured) |
| `9f8436f` | **fix(BUG-063) impl** · `schema/customer.js` + `schema/engagement.js` relax `name` + `vertical` from `.min(1)` to `z.string()` · factory defaults flipped to `""` · 3 collateral test updates (V-SCH-11 inverted · V-PATH-16 + V-SEL-6a explicit fixtures) | 1297/1297 GREEN |
| `8aac4c5` | **rc.9 eval re-baseline GREEN** · `tests/aiEvals/baseline.json` updated to point at post-fix capture · 9.32/10 avg · 100% pass · 25/25 · all predictions validated | 1297/1297 GREEN |
| `<this commit>` | **rc.9 release-close** · APP_VERSION rc.9-dev → rc.9 · RELEASE_NOTES_rc.9.md authored · HANDOFF refresh · SPEC change log catch-up · final session log · PREFLIGHT 1-8 ticked | 1297/1297 GREEN |

Plus 3 doc-only handover-infrastructure commits at the head of the cycle: `e058c57` (HANDOVER_TEMPLATE.md v1.0 NEW) · `87fafc8` (HANDOFF.md rewrite) · `d9bca36` (SESSION_PRIMING_PROMPT.md v1.0 NEW). These landed on `main` before the rc.8 git tag was retroactively created on `a322262`; chronologically they precede the tag but semantically belong to the rc.9 cycle setup.

## PREFLIGHT checklist (8 items · ticked at this release-close commit)

| # | Item | Status |
|---|---|---|
| 1a | APP_VERSION `-dev` suffix added at first commit past rc.8 tag | ✅ `f70cc38` (rc.8-tag was retroactively created on `a322262` 2026-05-14 morning; `f70cc38` is the first commit past it semantically) |
| 1b | APP_VERSION drops `-dev` at tag time | ✅ This commit: `3.0.0-rc.9-dev` → `3.0.0-rc.9` |
| 2 | SPEC §9 change log updated | ✅ 11 new rows appended to SPEC change log table this commit |
| 3 | RULES updated | ✅ §16 CH37 NEW (schema-truthful enumeration contract · landed `37356bd`) |
| 4 | V-* tests RED-first → GREEN | ✅ V-AI-EVAL-6/7/8 RED at `37356bd` → GREEN at `2f3176f` · V-FLOW-INIT-CLEAR-1/2 RED at `b70a96d` → GREEN at `9f8436f` (per Sub-arc B precedent · the canonical RED-first cycle) |
| 5 | Browser smoke (Chrome MCP · Docker nginx per `feedback_browser_smoke_required.md` + `feedback_chrome_mcp_for_smoke.md`) | ✅ Banner 1297/1297 verified at every step against `dell-discovery-canvas:latest` Docker image · rebuilt 3 times during the rc.9 cycle |
| 6 | RELEASE_NOTES authored | ✅ `docs/RELEASE_NOTES_rc.9.md` this commit |
| 7 | HANDOFF rewritten | ✅ HANDOFF.md top section refreshed this commit |
| 8 | Banner GREEN at tag | ✅ **1297/1297** GREEN ✅ |

Plus the eval baseline (rc.9 measurement bar): `tests/aiEvals/baseline.json` overwritten 2026-05-14T12:18:36 · 9.32/10 avg · 100% pass rate (25/25) · captured 2026-05-14 by user · same provider as rc.8 (anthropic chat + anthropic judge) for apples-to-apples comparison.

## Bug closures (rc.8 → rc.9)

| Bug | Closed by | Theme |
|---|---|---|
| **BUG-063** Engagement initialization · residual non-clear fields | `b70a96d` (preamble + RED) + `9f8436f` (impl) | Schema relaxed `name` + `vertical` from `.min(1)` to `z.string()`; factory defaults flipped from `"New customer"` / `"Financial Services"` / `"EMEA"` to `""`. Eval evidence: DSC-4 4/10 → 9/10 · APP-4 5/10 → 10/10 (the chat now refuses to fabricate customer context when the engagement is honestly empty). V-FLOW-INIT-CLEAR-1/2 regression guards. UI dropdown placeholder rendering for empty vertical: deferred to UX polish pass (not rc.9 blocker). |

## New SPEC annexes / amendments

- **§S20.4.1.2 NEW** (Sub-arc C) · Rule 10 (Quantitative honesty rule) + Examples 9 + 10 in Layer 1 Role section. Schema-conditional clause activates when `quantity` field is added to a layer's instance schema.

## New RULES

- **§16 CH37 NEW** (Sub-arc C) · Schema-truthful enumeration contract: chat MUST enumerate install-base entities by name; MUST NOT compute percentages / weighted aggregates / capacity-shares across instance rows; row-counts permissible only with explicit "how many" + source-tool citation + row-count qualification.

## New tests this release (+5 net)

- **V-AI-EVAL-6** · `systemPromptAssembler.js` Layer 1 Role section carries Rule 10 (4 guards: numbered marker · schema-truth basis · percentage prohibition · schema-conditional clause)
- **V-AI-EVAL-7** · Example 9 source-grep (linked-composition drilldown · 3 guards: marker · `selectLinkedComposition` cited · drilldown question pattern)
- **V-AI-EVAL-8** · Example 10 source-grep (enumerate-by-name + inline Rule 10 citation · 3 guards · CRITICAL Guard 3 enforces the traceability assertion)
- **V-FLOW-INIT-CLEAR-1** · `createEmptyEngagement().customer` has empty `name` + `vertical` (BUG-063 factory contract)
- **V-FLOW-INIT-CLEAR-2** · `CustomerSchema` accepts empty `name` + `vertical` (BUG-063 schema-relax contract)

Plus 3 collateral test updates:
- **V-SCH-11** · retired-with-inversion (was: rejects empty name · now: accepts empty name per BUG-063 contract inversion)
- **V-PATH-16** · fixture flipped to explicit `customer.name = "Acme Test Corp"` (binding-resolution contract preserved; fixture-on-default reliance retired)
- **V-SEL-6a** · fixture flipped to explicit `customer.name` + `customer.vertical` overrides

## Eval baseline delta (rc.8 → rc.9 · same provider · same judge · same golden set)

| Metric | rc.8 | rc.9 | Δ |
|---|---:|---:|---:|
| avgTotalScore | 9.16 | **9.32** | +0.16 |
| passRate | 96% | **100%** | +4pp |
| failed | 1 | **0** | -1 |
| discovery | 9.33 | 9.50 | +0.17 |
| app-how-to | 9.00 | 9.00 | 0.00 |
| **data-grounding** | **8.40** | **9.40** | **+1.00** ← Sub-arc C target |
| refusal | 10.00 | 9.75 | -0.25 |
| multi-turn | 9.25 | 9.00 | -0.25 |
| grounded dim | 1.76 | 1.76 | 0.00 |
| complete dim | 1.84 | 1.92 | +0.08 |
| useful dim | 1.84 | 1.92 | +0.08 |
| **honest dim** | **1.92** | **1.96** | **+0.04** ← BUG-063 fix lift |
| concise dim | 1.80 | 1.76 | -0.04 |

Per-case wins: **GRD-2 5 → 7** (Sub-arc C target case · was the failing case at rc.8) · **GRD-3 7 → 10** · APP-1 7 → 8 · APP-2 7 → 8 · DSC-3 9 → 10 · DSC-6 9 → 10.

Per-case slight slips (still pass): **APP-5 10 → 8** (judge still flags "inventing example" pattern · candidate for Rule 10a in rc.10 if persistent) · **MULTI-1 9 → 7** (judge cites "driver-name discrepancy" · likely judge non-determinism · worth watching).

## Deferred to rc.10

| Item | Status | Effort |
|---|---|---|
| **Sub-arc D** · AI chat action proposals (Apply-button cards) | D-Rule LOCKED · engineer-conditional approval mandatory · separate constitutional flow with SPEC review + action-correctness eval rubric (6th dimension) + confirmation UX | large |
| **`docs/DELL_SOLUTIONS_BY_GAP_TYPE_AND_LAYER.md`** · the deferred 4th Sub-arc C doc | SME blocker · needs presales/sales-eng input to populate the gap_type × layer × Dell product matrix | medium (60 min SME + 15 min doc) |
| **Rule 10a candidate** · "Don't use engagement data as illustrative example without disclaimer" | CONTINGENT · APP-5 cleared at 8/10 in rc.9 baseline but judge still flagged the underlying pattern; if APP-5 + sibling cases consistently surface this in future re-captures, Rule 10a lands | small (constitutional touch) |
| **BUG-061** · Save-draft vs Publish lifecycle on SkillSchema | new locked enum · Rule A flow required | medium |
| **BUG-052** · Modal-residue test flake cluster (6 intermittent) | investigation arc · may converge with BUG-063 root-cause learnings | medium |
| **`gap.closeReason` doc-drift** · UI_DATA_TRACE Tab 4 §8d references non-existent field | doc-only | trivial |
| **ContextView.js empty-state dropdown rendering** for empty `customer.vertical` | UX polish pass · BUG-063 fix plan item 6 (deferred from rc.9) | small |
| **MULTI-1 slip investigation** | re-capture in next iteration; if "driver-name discrepancy" pattern persists across multiple captures, investigate chat behavior | small |

## Locked-going-forward · discipline

Per `feedback_principal_architect_discipline.md` + the Sub-arc C constitutional flow validated this release:

- **Binary on process**: `[CONSTITUTIONAL TOUCH PROPOSED]` preamble + Q&A + user explicit approval + R11 four-block ritual + Browser smoke evidence + Hidden risks block — every constitutional commit
- **RED-first then GREEN**: tests scaffold RED in the preamble/SPEC commit; impl flips them to GREEN — captured visibly in the banner at every step
- **Real-only**: every eval re-capture uses real LLM (no mocks/stubs/scripted-fixtures) per `feedback_no_mocks.md`
- **Schema-conditional rules**: Rule 10 is the first rule with an explicit "narrows automatically when schema gains X field" clause. This is the right shape for rules that exist BECAUSE of current schema limitations; they self-rescind without re-prompt-tuning when the limitation is addressed.

## Sign-off

rc.9 closes at **1297/1297 GREEN · 9.32/10 eval baseline · 100% pass rate · Canvas AI Assist schema-truthfully enumerates · empty engagement state is honest**.

Tag pending user `tag rc.9` / `tag it` call per `feedback_no_push_without_approval.md`. The release-close commit lands first; the annotated tag is the irreversible action that needs explicit go.

Good work today. 🚀
