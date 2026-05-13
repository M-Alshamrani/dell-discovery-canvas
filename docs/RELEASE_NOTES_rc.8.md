# v3.0.0-rc.8 — release notes

**Tagged**: 2026-05-13 evening · **Branch**: `v3.0-data-architecture` (+ `main`) · **Banner**: **1292/1292 GREEN ✅** · **APP_VERSION at tag**: `"3.0.0-rc.8"` · **Eval baseline**: 9.16/10 avg · 96% pass rate on 25-case golden set

## Top-line summary (rc.7 → rc.8)

Banner 1196 → **1292** (+96 net). rc.8 is the **AI-quality release** — Skills Builder rebuilt to v3.2 (real-LLM run-time + provenance + auto-clear), Path B Import-data workflow shipped end-to-end (Dell internal LLM kickoff + Phase A·B·C walkthrough), Canvas AI Assist persona examples + soft-warn verifier landed (BUG-062 expansion), and the **first AI evaluation harness** captured a 9.16/10 baseline on a 25-case golden set.

This is also the **discipline-philosophy release**: the principal-architect discipline doc gained an explicit *"process is binary, changes are not"* section after a real-world lapse + corrective-action audit (cited as a positive example of how the process surfaces drift without freezing improvement).

## Theme — AI quality from scaffolding to measured outcome

rc.7 closed the v2-architecture deletion arc. rc.8 turns the v3-pure foundation into measured AI quality:

1. **Skills Builder v3.2** ships a real-LLM run-time with provenance + auto-clear · 24 new tests · Canvas Chat tab system permanent
2. **Path B Import-data workflow** end-to-end · 22 V-FLOW-IMPORT-* tests · iLLM badge variant · Dell internal LLM kickoff pane + Phase A·B·C walkthrough
3. **Canvas AI Assist** gains 8 persona-shaping few-shot examples in Layer 1 (implicit; no "switch mode" toggle) and the grounding verifier demotes from BLOCK to SOFT-WARN with severity-tiered annotation footers
4. **Eval harness** ships as the new measurement bar: 25 hand-authored golden cases + meta-LLM judge + 5 rubric dimensions · baseline captured at 9.16/10 avg, 96% pass rate

The release tags after the discipline-philosophy clarification + a clean Pages-deploy verification at `https://m-alshamrani.github.io/dell-discovery-canvas/`.

## Per-arc summary (rc.8 commits since rc.7 tag · 61 commits)

| Sub-arc | Commits | Theme | Banner |
|---|---|---|---|
| rc.8.b R1..R7 | `bf8bd37`..`c93042f` (8 R-commits + 1 hygiene) | Skills Builder v3.2 reboot · clean-replace schema + tab system + real-LLM run-time + AI-mutation apply + aiTag provenance | 1196 → 1220 |
| rc.8.b polish | `7d846f0`..`b78e5cb` | BUG-1..BUG-6 closure post-reboot · Improve-prompt rewrite + runtime engagement injection + UI_DATA_TRACE audit fixes | 1220 → 1233 |
| WB-1..WB-4 | `e98ffb5` | Wiring bugs from UI_DATA_TRACE audit + UI_DATA_TRACE.md + UI_DATA_KNOWLEDGE_BASE.md shipped | 1226 → 1233 |
| Picker rebuild | `b032122`..`1a89d48` | rc.8.b skill-builder rebuild · two-pane picker + contract-fidelity skill runtime · relational-rows in engagement-data block | 1233 → 1240 |
| Relationships | `db2c5fd`..`03de841` | RELATIONSHIPS_METADATA + picker right-pane bindings + Improve meta-skill priming + 8 integrity audit tests + SPEC §S25 / §S46 annotations | 1240 → 1250 |
| S47 scaffold | `549599f` | SPEC §S47 (Import Data) + 15 V-FLOW-IMPORT-* RED scaffold | 1250 → 1250 (15 RED) |
| S47 aiTag amendment | `30db5ca` | [CONSTITUTIONAL AMENDMENT] aiTag.kind discriminator (skill/external-llm) | 1244 → 1251 |
| S47 C1..C3 impl | `2d6d858`..`31915ed` | Schema v3.2 deltas · parser · drift check · applier · preview modal · ghost option B · iLLM badge · instructions builder · footer button | 1251 → 1265 |
| S47 F1..F4 post-audit | `3b83d2b`..`433abf4` | Launcher integration · skill-runner routing · SkillBuilder dropdown + System chip · CSS polish | 1265 → 1269 |
| Post-audit remediation R1..R4 | `ec963b9`..`9200b37` | Park Path A (BUG-053) · 0-env guard · apply-errors surfacing · doc refresh | 1269 → 1265 (Path A removal) → 1265 |
| 9 deferred bugs logged | `cb1a98a` | BUG-054..062 logged from user post-R3 review | 1265 → 1265 |
| BUG-054..057 Path B polish | `5e54781`..`9db5c7a` | Default scope "current" · LLM Instructions Prompt craft pass + filename rename · source-notes textbox removed · modal overflow-y:auto | 1265 → 1270 |
| BUG-058 audit + fix | `2b3acb9`..`a53a1aa` | CANVAS_DATA_MAP.md r1 (73 paths) + [CONSTITUTIONAL TOUCH] 6 FIX + 2 CLARIFY in RELATIONSHIPS_METADATA | 1270 → 1276 |
| BUG-059/060 SkillBuilder | `70bf8ae`, `dba24bf` | Action bar single row · card-style rows + pill-chip meta tags | 1270 → 1272 |
| GitHub Pages compatibility | `0914528`, `aeedaed` | `.nojekyll` + relative paths · rename `_v2TestFixtures.js` → `v2TestFixtures.js` + V-OPS-PAGES-1/2 regression guards | 1276 → 1278 |
| Path B kickoff + Phase A·B·C | `c4a93d4`, `05d1dec` | [CONSTITUTIONAL TOUCH] SPEC §S47.4.6/7 + §S47.8.5/6 · new `services/importKickoffPrompt.js` + Phase A·B·C walkthrough · 7 RED-then-GREEN | 1278 → 1285 |
| BUG_LOG bookkeeping | `21ea1df` | Close BUG-050/058/059/060 + log BUG-063 (fresh-load residual fields) | 1285 → 1285 |
| Sub-arc A · eval harness | `ddf10f1`, `4d0257f` | A.1 foundation (rubric + judge prompt + 5 sample cases + runner) · A.2 expand to 25 cases | 1285 → 1289 |
| Sub-arc B SPEC + RED | `40f55d1` | [CONSTITUTIONAL TOUCH] SPEC §S20.4.1.1 + §S37.3.2 R37.6/R37.13 · 6 RED tests captured | 1289 → 1291 (6 RED) |
| Sub-arc B impl | `7fcc8b6` | Persona examples in Layer 1 + verifier severity tiers + chatService SOFT-WARN integration + CanvasChatOverlay annotation footer + CSS | 1285/1291 → 1291/1291 |
| Eval-runner bug fixes | `5d9737b`, `ca10503` | Judge `out.text` not `out.content` · chat envelope `response` not `content` · + V-AI-EVAL-5 regression guard | 1291 → 1292 |
| Sub-arc B-polish | `4e34d6e` | NORTHSTAR_HINT enumerated + Example 7 save/persistence + Example 8 tool-call-then-cite + rule 2 strengthened · post-polish baseline 6.72 → 9.16/10 | 1292/1292 |
| Discipline + philosophy | `bc00263`, `d3f118e` | Audit log for the B-polish lapse (option B) + philosophy section ("process is binary, changes are not") | 1292/1292 |
| Sub-arc B.5 audit | `3accf22` | Doc-audit gap-list artifact · recommendation: HYBRID for Sub-arc C | 1292/1292 |

## Bugs closed since rc.7 tag

| ID | Severity | Closed by | Theme |
|---|---|---|---|
| BUG-1..BUG-6 (rc.8.b reboot bugs) | mixed | `bf8bd37`..`c93042f` | Legacy Skills toggle retired · skill run-time data-path resolution · Improve-prompt rewrite · runtime engagement injection · drop user-turn echo |
| BUG-050 | Low | CLOSED 2026-05-13 user direction | Propagate criticality button NEEDS-REPRO; closed without code change after no observable recurrence |
| BUG-053 | High | DEFERRED `ec963b9` | Path A (skill-via-launcher importer) parked after constitutional-creep audit (3 framework extensions + system-skills distribution require Rule A flow) |
| BUG-054 | Low | `5e54781` | Path B Import modal default scope flipped "desired" → "current" |
| BUG-055 | Medium | `c1f0c5e` | LLM Instructions Prompt craft pass + filename rename to `dell-canvas-llm-instructions-prompt-*` |
| BUG-056 | Low | `c1f0c5e` | Path B source-notes textbox removed (option B: drop the vague field) |
| BUG-057 | Low | `9db5c7a` | Path B modal vertical-overflow `overflow-y: auto` fix |
| BUG-058 | High | `2b3acb9` + `a53a1aa` | Skills Builder data-point binding audit (73 paths) + 6 FIX + 2 CLARIFY constitutional fix in RELATIONSHIPS_METADATA · unblocks BUG-062 |
| BUG-059 | Low | `dba24bf` | SkillBuilder skill list card-style rows + pill-chip meta tags |
| BUG-060 | Low | `70bf8ae` | SkillBuilder action bar single horizontal row |
| BUG-061 | Medium | OPEN (next arc) | Save-draft vs Publish flow · Rule A constitutional touch (new locked enum) |
| BUG-062 | High | **PARTIAL (Sub-arc B shipped)** | AI chat re-architecture · grounding-by-context-priming + soft-warn verifier · Sub-arc B + B-polish landed; Sub-arc C/D queued |
| BUG-063 | Low-Medium | OPEN (next arc) | Engagement init residual non-clear fields (`customer.vertical` defaults to "Financial Services" on fresh-load) · NEW logged 2026-05-13 |

## Tests added (regression guards)

- **V-FLOW-SKILL-V32-*** (24 new) — Skills Builder v3.2 reboot · schema clean-replace · run-time wiring · AI-mutation apply
- **V-FLOW-IMPORT-*** (22 total · 15 from C1..C3 + 7 from kickoff sub-arc) — Path B end-to-end · including KICKOFF-1/2/3 + PHASES-1/2/3 + NAMING-CONFIRM-1
- **V-OPS-PAGES-1/2** — GitHub Pages deploy regression: no underscore-prefixed `.js` in scanned dirs + critical diagnostic modules fetchable
- **V-AI-EVAL-1..5** — eval harness scaffold + regression guard for the two eval-runner field-read bug classes
- **V-FLOW-GROUND-FAIL-1/2/3 rewritten + FAIL-4 extended** — SOFT-WARN verifier contract (severity field + retired-template absence). Same vector IDs preserved per R4 (tests rewrite, never retire-with-negative).
- **V-FLOW-GROUND-ANNOTATE-1/2** (NEW) — chatService preserves response + violations in envelope; CanvasChatOverlay renders severity-tiered footer
- **V-FLOW-CONSTITUTION-*** (4 new) — RELATIONSHIPS_METADATA fix tests for BUG-058 audit closure
- **WB-1..WB-4** — wiring bug fixes from UI_DATA_TRACE audit
- 8 integrity audit tests around `RELATIONSHIPS_METADATA` constitutional source-of-truth

## SPEC sections added or amended

- **§S46** (Skills Builder v3.2 reboot · NEW · 10 sub-rules CH36 a..j) — entire arc authored + locked
- **§S47** (Import-data workflow · NEW · 11 subsections) — Path B end-to-end + iLLM badge contract
- **§S47.4.6/7 + §S47.8.5/6** (NEW Sub-arc B amendments 2026-05-13) — Phase A·B·C walkthrough + kickoff pane + mapping-confirm contract
- **§S47.4.2/5.4/8.2 drift fixes** — caught up the filename + default-scope + modal-layout drift from BUG-054/055/056 fixes that updated code but missed the SPEC
- **§S20.4.1.1** (Behavior examples in Layer 1 · NEW) — 8 implicit-persona few-shot examples
- **§S37.3.2 + R37.6 rewrite + R37.13 NEW** — grounding verifier demoted from BLOCK to SOFT-WARN + severity tiers (high/medium/low)
- **§S48** (AI evaluation rubric · QUEUED) — eval harness foundation; awaits formal LOCK in rc.9+ as the harness matures
- **§S25 constitutional amendment** — `aiTag.kind` discriminator (skill vs external-llm)
- **§S40 LOCKED** — v3-pure architecture decision · v2 deletion contract

## RULES added

- **§16 CH35** — Path B import-data invariants (drift-check strict-reject + provenance metadata + aiTag.kind discrimination)
- **§16 CH36 (a..j)** — 10 sub-rules covering Skills Builder v3.2 architectural contract

## Discipline + Philosophy

The principal-architect discipline doc gained a new **Philosophy section** (process is binary, changes are not) after a real-world lapse during Sub-arc B-polish (commit `4e34d6e` modified a constitutional surface without surfacing the `[CONSTITUTIONAL TOUCH PROPOSED]` preamble; user accepted option B = keep + document; lapse + retroactive annotation captured in `docs/SESSION_LOG_2026-05-13-discipline-lapse.md`).

The philosophy clarifies: changes to constitutional surfaces are *welcomed* when justified, traceable, and approved. The discipline is non-negotiable on PROCESS (preamble + approval + documentation + smoke + R11 Recite/Answer/Execute/Pledge) and not binary on whether changes happen. Cited positive example: commit `4e34d6e` produced a measurable 6.72 → 9.16/10 eval baseline lift, validating the change substance even as the process was corrected.

## Eval baseline (NEW measurement bar)

| Metric | Pre-polish (initial baseline) | Post-polish (locked baseline) |
|---|---|---|
| Avg score | 6.72/10 | **9.16/10** |
| Pass rate | 60% (15/25) | **96% (24/25)** |
| Grounded | 0.84/2 | **1.76/2** |
| Honest | 1.2/2 | **1.92/2** |
| Useful | 1.68/2 | 1.84/2 |
| Complete | 1.6/2 | 1.84/2 |
| Concise | 1.4/2 | 1.80/2 |
| Refusal category | 9.25/10 | **10.0/10** (perfect) |
| Discovery category | 7.0/10 | **9.33/10** |
| Data-grounding category | 5.2/10 | **8.4/10** |
| Multi-turn category | 5.75/10 | **9.25/10** |
| App-how-to category | 6.67/10 | **9.0/10** |

The locked baseline is `tests/aiEvals/baseline-2026-05-13T20-01-50-669Z.json` (user-captured). Every future commit touching the Canvas AI Assist chat surface re-runs `window.runCanvasAiEvals()` and compares against this snapshot.

## Architectural locks ratified

- **Eval-driven tuning** (foundational for rc.9+) — every prompt change to system-prompt assembler ships with a baseline re-run and a measurable delta
- **R37.6 SOFT-WARN** — grounding verifier never replaces LLM response; annotations render as severity-tiered footer
- **Discipline philosophy** — process binary; changes encouraged when justified
- **Path B Import-data Phase A·B·C** — Dell internal LLM walkthrough is now the canonical engineer-to-LLM workflow

## Live Pages

Production at `https://m-alshamrani.github.io/dell-discovery-canvas/` reflects this release verbatim. Live smoke captured at `ss_1640qwipv` (post-push, pre-tag): demo loads, all 5 tabs wire, version chip shows `CANVAS V3.0.0-RC.8`, footer actions present, no console errors.

## What ships next (rc.9 backlog)

Sequenced per the locked plan from BUG-062 expansion + B.5 audit:

1. **Sub-arc C** (knowledge-base wiring per B.5 HYBRID recommendation) — Wire bucket: 2 new Layer 1 examples (selectLinkedComposition pattern + enumerate-by-name pattern to close GRD-2 weakness; requires `[CONSTITUTIONAL TOUCH PROPOSED]` preamble). Author bucket: 4 short user-facing reference docs (Canvas Chat user guide, current-vs-desired-state, gap-type-vs-disposition, Dell-solutions-by-gap-type-and-layer; doc-only, no preamble needed).
2. **Sub-arc D** (action proposals) — LATER · D-Rule LOCKED · engineer-conditional approval mandatory (no auto-apply ever). Separate constitutional flow.
3. **BUG-061** Save-draft vs Publish lifecycle — Rule A constitutional flow required (new locked enum on SkillSchema).
4. **BUG-063** Engagement init residual non-clear fields — Schema defaults audit.
5. **BUG-052** Modal-residue test flake cluster — Investigation arc.

## Session-of-record

**Tagged 2026-05-13 evening.** Closing arc spans `bf8bd37` (rc.8.b R1 first commit past rc.7 tag) through `3accf22` (Sub-arc B.5 audit · last work commit before this release-close commit). 61 commits, +96 net tests. Banner trajectory: 1196 → 1220 → 1233 → 1240 → 1250 → 1265 → 1270 → 1276 → 1278 → 1285 → 1289 → 1291 → **1292/1292 GREEN**.

PREFLIGHT items (1-8) ticked in the release-close commit message.
