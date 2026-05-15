// core/version.js — APP_VERSION single source of truth
//
// Per SPEC §S30 + RULES §16 CH24, this is the runtime-visible version
// string. The topbar chip + every UI surface that wants to display the
// version MUST import APP_VERSION from this file. Hard-coded version
// strings anywhere else are FORBIDDEN.
//
// Lifecycle (per S30.1):
//   <X>.<Y>.<Z>            release tag
//   <X>.<Y>.<Z>-rc.<N>     release-candidate tag
//   <X>.<Y>.<Z>-rc.<N>-dev between rc.<N> and the next tag
//   <X>.<Y>.<Z>-dev        pre-first-rc dev
//
// **Rule R30.1**: the FIRST commit past a tag MUST add the `-dev`
// suffix. Failure to do so creates the rc.2-tag freeze drift caught
// 2026-05-03 (V-VERSION-2 source-grep is the regression guard).
// **Rule R30.2**: at tag time, the value drops the `-dev` suffix in
// the same change that creates the tag.
//
// Distinct from:
//   - engagement.engagementMeta.schemaVersion — the *engagement schema*
//     version (migrator contract; "2.0" today, target "3.0"). Has
//     nothing to do with what build of the app is running.
//   - git tags — runtime code doesn't read git; this string is the
//     runtime-visible version.
//
// ---
//
// **3.0.0-rc.10** (TAGGED 2026-05-15) — closes the rc.10 arc. Banner
// **1334/1334 GREEN ✅** (was 1297 at rc.9 tag; **+37 net tests** this
// release: V-AI-EVAL-9..20 + V-CHAT-D-1..5 + V-FLOW-AI-NOTES-1/2/3/IMPORT-1
// + V-ADAPTER-NOTES-1/WIDEN-1 + V-FLOW-PATHB-WIDEN-{PARSE,MODAL,DRIFT,APPLY}-1
// + V-AITAG-WIDEN-{DRIVER,GAP}-1 + V-AITAG-KIND-WIDEN-1 + V-FLOW-WS-* family
// for BUG-WS-1..6).
//
// Eval baselines at tag (post-pivot · 25-case action-correctness):
//   - Claude-judge: 6.52/10 · 64% pass (antrhopic_1.json · close-gap
//     slipped 10→7.5 worth one verification re-run before GA)
//   - Gemini-judge (honest): 6.84/10 · 68% pass (gimini_1.json · LIFTED
//     +1.28 avg · +16pp pass vs pre-pivot honest baseline 5.56/52%)
// Note: chat layer UNCHANGED between Step 3.9 (8884e5b) and HEAD · the
// deltas vs pre-pivot canonical 3f8ff07 reflect sampling variance +
// provider drift, NOT architectural regression. Cross-judge convergence
// flipped post-pivot (Gemini now higher than Claude · suggests calibration
// 9edcb36's Claude-judge inflation was variance, not systemic bias).
//
// Theme · Sub-arc D Mode 1 user-facing release + LLM-output-fragility
// hardening:
//
//   rc.10 ships the Workshop Notes overlay (Cmd+Shift+N · topbar AI
//   Notes button) end-to-end · engineer types raw workshop bullets ·
//   Push to AI returns structured markdown + ActionProposal mappings ·
//   click [Import to canvas] feeds the widened Path B importer →
//   ImportPreviewModal → engineer reviews + applies. The Sub-arc D
//   architecture pivoted mid-cycle (A19 framing-doc · grounded in eval
//   calibration evidence 9edcb36 showing autonomous emission is
//   structurally unreliable). A20 widens Path B from instance-only to
//   instance + driver + gap entities (per-item kind discriminator · aiTag
//   widened to drivers + gaps). 6 BUG-WS-N fixes landed during real-user
//   testing addressing every UX + correctness issue surfaced; each with
//   forensic root cause + regression test + BUG_LOG entry.
//
// Rolled into rc.10 tag (origin/main):
//
//   Sub-arc D framing + eval-build:
//     - Framing-doc with 7-question Q&A capture + A1-A20 amendments
//     - SPEC §S48 (eval rubric · NEW) + 5-case foundation + 25-case
//       expansion (V-AI-EVAL-9/10/11 + 1168ab9 + 5466ea3)
//
//   Sub-arc D stub-emission (Mode 2 foundations · 46eae3d + 4bcbf06):
//     - SPEC §S20.4.1.3 + RULES §16 CH38 NEW (action-proposal contract)
//     - schema/actionProposal.js NEW (4 v1 action kinds · Zod
//       discriminated union)
//     - proposeAction tool registered + envelope.proposedActions field
//
//   Sub-arc D Steps 3.5-3.9 (prompt-text iteration · 4 iterations ·
//   2 regressions captured as DIAGNOSTIC · canonical 3f8ff07 preserved
//   at 7.4/10 / 76% pass · cycle CLOSED 9b3da8f):
//     - Step 3.5 (ee42302): Rule 4 verb-strength + Example 11 + 7.4/80%
//     - Step 3.6 REVERTED (cdd367a → 58b27c3): notation imitation hazard
//     - Step 3.7 (8c781ae): Example 12 safe short-form + 7.4/76% on 25
//     - Step 3.8 REVERTED (ae33705 → 9b3da8f): cognitive crowding
//     - Step 3.9 (8884e5b): chat-says-vs-chat-does guard at chatService
//       layer · HALLUCINATION_RE + envelope.proposalEmissionWarning
//
//   Eval calibration (9edcb36 · Experiments A.1 + A.2 + B):
//     - Sampling-noise floor ±0.3 → revised ±1.0 avg post-Step-6
//     - Same-model judge inflation ~+2 avg / +24pp pass pre-pivot
//     - Chat-layer autonomous emission structurally unreliable at this
//       LLM density · motivated the A19 architecture pivot
//
//   A19 architecture pivot (662522d · user-approved "go Y · 10/10"):
//     - SPEC §S20.4.1.5 NEW (Workshop Notes → Path B importer flow ·
//       primary Sub-arc D UX path · supersedes A14 Q4 Mode-2-first)
//     - SPEC §S47 amendment (Path B accepts overlay as 2nd input source)
//     - RULES §16 CH38 narrowing (proposeAction tool stays · purpose
//       narrows to chat-quality measurement + Mode 2 optional fallback)
//
//   A20 Path B widening (2b5ae78 · user-approved 4-question Q&A "Go
//   with all recommendations"):
//     - SPEC §S47.2 R47.2.1 widens scope from instance-only to instance
//       + driver + gap entities
//     - SPEC §S47.3 R47.3.5 + R47.3.6: per-item kind discriminator wire
//       shape (instance.add | driver.add | gap.close)
//     - SPEC §S47.5 + §S47.8.4 + §S47.9.1a/b: kind-aware modal / drift /
//       applier · aiTag widened to drivers + gaps · kind enum extended
//       (+ discovery-note + ai-proposal)
//     - RULES §16 CH36 R7 narrowing (aiTag scope: instances by default;
//       Path B imports stamp drivers + gaps too)
//
//   Step 4 + Step 5 impl (88f6a32 + ccd23c8 · 1323/1323 GREEN):
//     - ui/views/WorkshopNotesOverlay.js NEW (dual-pane · auto-bullet ·
//       localStorage autosave · resume prompt · 5-button toolbar)
//     - services/workshopNotesService.js NEW (Path Y · wraps aiService
//       chatCompletion directly with workshop-mode system prompt ·
//       ActionProposalSchema validation · drops invalid with warn)
//     - services/workshopNotesImportAdapter.js NEW (transforms overlay
//       output to widened Path B wire shape · 3 kinds)
//     - schema/helpers/aiTag.js NEW (shared aiTag helper · single source
//       of truth for instance + driver + gap schemas)
//     - importResponseParser + importDriftCheck + importApplier widen
//       to handle 3 kinds (legacy 1.0 payloads back-compat preserved)
//     - ImportPreviewModal.js kind-aware (per-row kind chip · per-kind
//       editable cells · apply-scope picker conditional)
//
//   6 BUG-WS-N fixes (real-user testing forensic trail):
//     - BUG-WS-1 (8594288): notifyError modal destroyed workshop overlay
//       on error · replaced with inline showOverlayError banner ·
//       rawTextareaText autosave · 2-step Resume prompt
//     - BUG-WS-2 (8b845a4): Push-to-AI "Unterminated string in JSON at
//       position 3713" · max_tokens passthrough on Anthropic/OpenAI/
//       Gemini + repairTruncatedJson 5-step recovery + retry-once with
//       strict-JSON reminder · 6 regression tests
//     - BUG-WS-3 (12e178b): [Import to canvas] said "Push first" after
//       successful push · 3-state discrimination + showOverlayError
//       banner + actionable guidance · V-FLOW-WS-IMPORT-ZERO-MAPPINGS-1
//     - BUG-WS-4 (12e178b): repairTruncatedJson didn't handle dangling-
//       key truncation · Step 6 added · V-FLOW-WS-PARSE-REPAIR-1 extended
//     - BUG-WS-5 (12e178b): parseLlmResponse rejected valid JSON +
//       trailing prose · NEW extractFirstBalancedJson Step 0.5 ·
//       V-FLOW-WS-PARSE-REPAIR-1 extended to 10 guards
//     - BUG-WS-6 (b217682): AI Notes UX polish · textarea auto-scroll-
//       to-caret + resize:vertical + ImportPreviewModal z-index above
//       workshop overlay (4800>4600) + flex-wrap row layout
//
// SPEC annexes added / amended:
//   §S20.4.1.3 NEW (Sub-arc D stub-emission contract · Mode 2 layer)
//   §S20.4.1.4 NEW (chat-says-vs-chat-does guard · Mode 2 defensive)
//   §S20.4.1.5 NEW (Workshop Notes overlay → Path B flow · Mode 1 primary)
//   §S47.2/3/5/8.4/9 amended (A20 widening · 3 entity kinds)
//   §S48 NEW (action-correctness eval rubric · 5 dimensions)
//
// RULES added / amended:
//   §16 CH38 NEW (action-proposal contract · amended 4× through 3.5/3.6-
//     revert/3.7/3.8-revert/3.9/pivot/A20)
//   §16 CH36 R7 narrowing (aiTag scope: instances by default; Path B
//     imports stamp drivers + gaps too)
//
// New docs:
//   docs/SUB_ARC_D_FRAMING_DECISIONS.md (A1-A20 framing-ack)
//   docs/SUB_ARC_D_HANDOFF_PROMPT_v2.md (post-pivot priming)
//   docs/SESSION_LOG_2026-05-15-sub-arc-d-pivot.md (23-commit narrative)
//   docs/SESSION_LOG_2026-05-15-step-4-5-impl.md (Phases 1-8 · 47-commit
//     narrative · this release-close marks Phase 8)
//
// Deferred to v1.5 polish:
//   - Anthropic tool-use API migration (would eliminate BUG-WS-2/4/5 class)
//   - DOM-mounting integration test for overlay end-to-end flow
//   - aiTag chip renderer for drivers + gaps (Tab 1 + Tab 4 visual surface)
//   - Drag-resizable divider between upper/lower panes (framing-doc A2)
//   - Per-kind row layouts in ImportPreviewModal (tighter per-kind grids)
//   - Mode 2 chat-inline proposal UX surface (preview modal hook)
//   - Step 7 Mode 1 eval-build (workshop-bullets golden set)
//   - Close-gap slip verification re-run (sampling variance vs real regression)
//
// Path to non-suffix "3.0.0" GA:
//   - v1.5 polish landings (esp. tool-use API + DOM-mounting tests)
//   - At least one real-customer workshop run against Mode 1 + Mode 2
//   - Close-gap slip verification re-run
//   - Real Anthropic + Gemini live-key smoke at verification spec
//
// ---
//
// **3.0.0-rc.10-dev** (2026-05-14 evening) — between v3.0.0-rc.9
// (TAGGED 2026-05-14 at 1297/1297 GREEN, eval baseline 9.32/10 ·
// 100% pass rate on 25-case golden set) and the v3.0.0-rc.10 tag
// (2026-05-15).
//
// In flight (sequenced from HANDOFF.md rc.10 candidate list +
// docs/SUB_ARC_D_FRAMING_DECISIONS.md):
//   - Sub-arc D · AI chat action proposals with engineer-conditional
//     approval. MULTI-MODE capability: Mode 2 (Conversational · D.v1)
//     first by default · Mode 1 (Workshop Notes · D.v2) second.
//     Sequencing flips if a live workshop is scheduled within ~3
//     weeks of rc.10 start. D-Rule LOCKED · engineer-conditional
//     approval mandatory · separate constitutional flow at preamble
//     step. Action kinds in v1 scope: add-driver, add-instance-
//     current, add-instance-desired, close-gap (flip-disposition
//     deferred to v1.5). New schema/actionProposal.js + provenance
//     enum extension (aiTag.kind += "discovery-note" + "ai-proposal")
//     + new preview modal (extends ImportPreviewModal from §S47) +
//     new orthogonal eval harness (action-correctness rubric · 5
//     dims). Effort: ~3-4 weeks total for both modes.
//   - docs/DELL_SOLUTIONS_BY_GAP_TYPE_AND_LAYER.md (4th Sub-arc C
//     doc deferred from rc.9 · SME blocker)
//   - Rule 10a candidate (APP-5 residual "inventing example" pattern
//     · contingent on persistence in future re-captures)
//   - BUG-061 Save-draft vs Publish lifecycle (Rule A · new locked
//     enum on schema/skill.js)
//   - BUG-052 Modal-residue test flake cluster
//   - gap.closeReason doc-drift (UI_DATA_TRACE Tab 4 §8d · 5-min fix)
//   - ContextView.js empty-state dropdown rendering (BUG-063 UI
//     follow-up)
//   - MULTI-1 slip investigation (judge variance vs real signal)
//
// Per RULES §16 CH24 + PREFLIGHT.md item 1a: this is the FIRST commit
// past the rc.9 tag, so the `-dev` suffix is added now. V-VERSION-2
// source-grep is the regression guard.
//
// ---
//
// **3.0.0-rc.9** (TAGGED 2026-05-14) — closes the rc.9 arc. Banner
// 1297/1297 GREEN ✅ (was 1292 at rc.8 tag; +5 net tests this release:
// V-AI-EVAL-6/7/8 + V-FLOW-INIT-CLEAR-1/2). Eval baseline: **9.32/10
// avg · 100% pass rate** on 25-case golden set (25/25 · was 9.16/10 ·
// 96% at rc.8; +0.16 avg · +4pp pass rate).
//
// Theme · honest empty state + schema-truthful enumeration:
//
//   Rule 10 (Quantitative honesty) added to Layer 1 Role section of
//   the AI chat system prompt: the v3 install-base schema collects
//   names + types + descriptions but NOT quantities, so the chat
//   enumerates items by name (never percentage / weighted aggregate /
//   capacity-share across instance rows). Schema-conditional: rule
//   narrows automatically when a `quantity` field is added to a
//   layer's instance schema (future feature per docs/ROADMAP.md).
//   Sub-arc C ships the rule + Examples 9 (selectLinkedComposition
//   drilldown) + Example 10 (enumerate-by-name with inline Rule 10
//   citation for traceability) + 3 user-facing reference docs.
//
//   BUG-063 closed: schema/customer.js + schema/engagement.js relax
//   name + vertical from .min(1) to z.string(); factory defaults
//   flipped from "New customer" / "Financial Services" / "EMEA" to
//   "" so the empty engagement state is honestly empty rather than
//   carrying real-looking placeholder defaults the chat would
//   mistakenly read as real customer data.
//
// Rolled into rc.9 tag (origin/main + v3.0-data-architecture):
//
//   Session-handover infrastructure (cycle setup):
//     - docs/HANDOVER_TEMPLATE.md v1.0 NEW (meta-discipline audit
//       synthesizing 5 foundational discipline layers); commit e058c57
//     - HANDOFF.md rewritten from template (797 → 224 lines · historical
//       content into docs/SESSION_LOG_* files); commit 87fafc8
//     - docs/SESSION_PRIMING_PROMPT.md v1.0 NEW (one-shot fresh-session
//       pointer); commit d9bca36
//
//   v3.0.0-rc.8 git tag retroactively created on commit a322262
//     (the rc.8 release-close commit was pushed 2026-05-13 evening
//     but the git tag was missed in lock-step; coherence restored
//     between ledger claims + tag-graph reality).
//
//   APP_VERSION rc.8 → rc.9-dev (R30.1 + PREFLIGHT 1a); commit f70cc38.
//
//   Eval baseline JSON captured into the repo (closes the discipline
//     gap surfaced 2026-05-14 morning: HANDOFF + RELEASE_NOTES_rc.8 +
//     this ledger all cited a file that wasn't committed); commit
//     9e85543. Both tests/aiEvals/baseline.json (canonical) +
//     timestamped historical record committed.
//
//   Sub-arc C · Canvas AI Assist Rule 10 + Examples 9 + 10 + docs
//     (2026-05-14 · user-approved [CONSTITUTIONAL TOUCH PROPOSED]
//     Q&A flow per Rule A · "Go with all proposed answers"):
//     - Commit A 37356bd: SPEC §S20.4.1.2 + RULES §16 CH37 + ROADMAP.md
//       NEW + V-AI-EVAL-6/7/8 RED scaffolds
//     - Commit B 2f3176f: services/systemPromptAssembler.js Layer 1
//       Role section gains Rule 10 + Examples 9 + 10; RED → GREEN
//     - Commit C 595264f: 3 user-facing docs (CANVAS_CHAT_USER_GUIDE +
//       CURRENT_VS_DESIRED_STATE + GAP_TYPE_VS_DISPOSITION); the 4th
//       doc (DELL_SOLUTIONS_BY_GAP_TYPE_AND_LAYER) deferred to rc.10
//       (SME blocker)
//
//   rc.9 post-Sub-arc-C eval snapshot DIAGNOSTIC (0e3d0f6): 8.92/10
//     · 88% pass · 3 fails. WIN on Sub-arc C target (GRD-2 5/10 → 8/10);
//     REGRESSIONS (DSC-4 10 → 4 · APP-4 10 → 5 · APP-5 10 → 5) traced
//     to BUG-063 manifestation + adjacent honesty gap. Diagnostic-only;
//     NOT overwriting baseline.json.
//
//   BUG-063 fix (preamble b70a96d + impl 9f8436f): schema/customer.js
//     + schema/engagement.js relax name + vertical from .min(1) to
//     z.string(); factory defaults flipped to "". 3 collateral test
//     updates (V-SCH-11 retired-with-inversion · V-PATH-16 + V-SEL-6a
//     explicit-fixture flips per Rule D evaluation). V-FLOW-INIT-CLEAR-
//     1/2 NEW regression guards. Banner 1295 → 1297 GREEN.
//
//   rc.9 eval re-baseline GREEN (8aac4c5): user re-ran eval with
//     BUG-063 fix landed. Results: **9.32/10 avg · 100% pass · 25/25 ·
//     0 fails**. tests/aiEvals/baseline.json overwritten; timestamped
//     historical record at baseline-2026-05-14T12-19-31-211Z.json.
//
// New tests rolled into rc.9 (+5 net since rc.8):
//   V-AI-EVAL-6/7/8 (Rule 10 + Examples 9/10 source-grep contracts ·
//     10 guards total including the critical V-AI-EVAL-8 Guard 3
//     "Example 10 cites Rule 10 inline so engineers can trace the
//     constraint")
//   V-FLOW-INIT-CLEAR-1/2 (BUG-063 factory contract + schema-relax
//     contract regression guards)
//
// Plus 3 collateral test updates (BUG-063 fix downstream):
//   V-SCH-11 retired-with-inversion · V-PATH-16 + V-SEL-6a explicit-
//     fixture flips
//
// SPEC annexes added / amended:
//   §S20.4.1.2 NEW (Rule 10 + Examples 9 + 10 · Sub-arc C)
//
// RULES added:
//   §16 CH37 NEW (schema-truthful enumeration contract · Sub-arc C)
//
// New docs:
//   docs/CANVAS_CHAT_USER_GUIDE.md
//   docs/CURRENT_VS_DESIRED_STATE.md
//   docs/GAP_TYPE_VS_DISPOSITION.md
//   docs/ROADMAP.md (first deferred-feature entry: quantity-collection
//     at install-base layer, v3.1.0 candidate)
//
// Deferred to rc.10:
//   Sub-arc D (AI chat action proposals · D-Rule LOCKED)
//   docs/DELL_SOLUTIONS_BY_GAP_TYPE_AND_LAYER.md (SME blocker)
//   Rule 10a candidate (APP-5 residual "inventing example" pattern,
//     contingent on persistence in future re-captures)
//   BUG-061 (Save-draft vs Publish lifecycle · Rule A flow)
//   BUG-052 (modal-residue test flake cluster)
//   gap.closeReason doc-drift
//   ContextView.js empty-state dropdown rendering (BUG-063 UI follow-up)
//   MULTI-1 slip investigation (judge variance vs real signal)
//
// Path to non-suffix "3.0.0" GA:
//   - Sub-arc D action proposals (next major Canvas AI Assist arc)
//   - At least one real-customer workshop run
//   - Possibly Rule 10a (contingent on APP-5 re-capture)
//
// ---
//
// **3.0.0-rc.9-dev** (2026-05-14) — between v3.0.0-rc.8 (TAGGED
// 2026-05-13 at 1292/1292 GREEN, eval baseline 9.16/10 · 96% pass on
// 25-case golden set) and the eventual v3.0.0-rc.9 tag.
//
// In flight (sequenced from HANDOFF.md open-fix-plans table):
//   - Sub-arc C · Canvas AI Assist knowledge-base wiring per B.5
//     audit; 5 scope options on the table, awaits user direction
//     (B.5 recommends HYBRID: wire Examples 9+10 to systemPrompt-
//     Assembler + author 4 short user-facing reference docs; expected
//     eval lift 9.16 → ~9.3-9.4/10)
//   - Sub-arc D · AI chat action proposals (D-Rule LOCKED · engineer-
//     conditional approval mandatory; separate constitutional flow
//     incl. SPEC review + action-correctness eval rubric + confirma-
//     tion UX)
//   - BUG-061 Save-draft vs Publish lifecycle (Rule A · new locked
//     enum on SkillSchema)
//   - BUG-063 Engagement init residual non-clear fields (2 RED tests
//     V-FLOW-INIT-CLEAR-1/2 scaffolded)
//   - BUG-052 Modal-residue test flake cluster (investigation)
//   - gap.closeReason doc-drift (UI_DATA_TRACE Tab 4 §8d · 5-min fix)
//
// Session-handover infrastructure landed 2026-05-14 morning:
//   - docs/HANDOVER_TEMPLATE.md v1.0 NEW (meta-discipline audit
//     synthesizing 5 foundational discipline layers + optimal
//     handover skeleton); commit e058c57
//   - HANDOFF.md rewritten from template (797 → 224 lines · historical
//     content into docs/SESSION_LOG_* files); commit 87fafc8
//   - docs/SESSION_PRIMING_PROMPT.md v1.0 NEW (one-shot fresh-session
//     pointer); commit d9bca36
//   - v3.0.0-rc.8 git tag created retroactively on a322262 + pushed
//     to origin (the rc.8 release-close commit a322262 was pushed
//     2026-05-13 evening but the git tag itself was missed in lock-
//     step; APP_VERSION ledger had already claimed "TAGGED 2026-05-13",
//     so this restores ledger-reality coherence)
//
// Per RULES §16 CH24 + PREFLIGHT.md item 1a: this is the FIRST commit
// past the rc.8 tag, so the `-dev` suffix is added now. V-VERSION-2
// source-grep is the regression guard.
//
// ---
//
// **3.0.0-rc.8** (TAGGED 2026-05-13) — closes the rc.8 arc. Banner
// 1292/1292 GREEN ✅ (was 1196 at rc.7 tag; +96 net tests over rc.8).
// Eval baseline: 9.16/10 avg · 96% pass rate (24/25 on the 25-case
// golden set, post-Sub-arc-B-polish).
//
// Rolled into rc.8 tag (origin/v3.0-data-architecture):
//
//   rc.8.b Skills Builder v3.2 reboot (rc.7 → rc.8.b polish window):
//     - schema/skill.js v3.2 clean replace (drop outputContract /
//       outputTarget / promptTemplate / bindings; retire migrate
//       helpers); commits ce48279 c1e7f62 c57ce1f
//     - Canvas Chat tab system: permanent Chat + Skills launcher +
//       dynamic [Skill:<name>] tab; commit d7f4dbe
//     - Skill run-time wiring: real-LLM via chatCompletion + per-
//       outputFormat dispatch + dialog turn rendering; commit 19888f4
//     - AI-mutation apply + aiTag provenance + "Done by AI" badge +
//       auto-clear on engineer save; commit c93042f
//     - 24 new V-FLOW-SKILL-V32-* tests · 15 legacy V-* retirements
//
//   Picker rebuild + Relationships metadata:
//     - PICKER_METADATA catalog + _buildSkillRunCtx rebuild + Data
//       Points / Output Format / Parameters two-pane shells; commit
//       b032122
//     - RELATIONSHIPS_METADATA + picker right-pane bindings + Improve
//       meta-skill priming + 8 integrity audit tests; commit db2c5fd
//
//   Path B Import-data workflow (SPEC §S47 arc):
//     - SPEC §S47 + 15 V-FLOW-IMPORT-* RED scaffold; commit 549599f
//     - [CONSTITUTIONAL AMENDMENT] aiTag.kind discriminator; 30db5ca
//     - C1..C3 implementation: parser, drift, applier, preview,
//       Ghost Option B, iLLM badge variant, instructions builder,
//       footer button; commits 2d6d858..31915ed
//     - F1..F4 post-audit remediation; commits 3b83d2b..433abf4
//     - R1..R3 deeper remediation: Path A parked (BUG-053), 0-env
//       guard, apply-errors surfacing
//     - BUG-054..057 Path B polish: default scope "current",
//       LLM Instructions Prompt craft pass + filename rename,
//       source-notes textbox removed, modal overflow-y:auto
//
//   BUG-058..060 SkillBuilder + audit closure:
//     - BUG-058 audit deliverable CANVAS_DATA_MAP.md r1 (73 paths
//       audited); commit 2b3acb9
//     - [CONSTITUTIONAL TOUCH] BUG-058 audit fix · 6 FIX + 2 CLARIFY
//       in RELATIONSHIPS_METADATA; commit a53a1aa
//     - BUG-059 SkillBuilder card-style rows; commit dba24bf
//     - BUG-060 SkillBuilder action bar single row; commit 70bf8ae
//
//   GitHub Pages deploy compatibility (2026-05-13 morning):
//     - .nojekyll + relative paths for icon + manifest; commit 0914528
//     - rename underscore-prefixed diagnostic files + V-OPS-PAGES-1/2
//       regression guard; commit aeedaed
//
//   Path B kickoff pane + Phase A·B·C walkthrough (2026-05-13):
//     - [CONSTITUTIONAL TOUCH] SPEC §S47.4.6/7 + §S47.8.5/6 + 7 RED
//       tests; commit c4a93d4
//     - Impl: services/importKickoffPrompt.js (NEW) + builder Phase
//       A·B·C structure + ImportDataModal kickoff pane + CSS;
//       commit 05d1dec
//
//   Sub-arc A · Canvas AI Assist eval harness foundation (SPEC §S48
//   queued · 2026-05-13):
//     - A.1: rubric.js (5 dimensions × 0-2) + judgePrompt.js +
//       5 sample golden cases + browser-runnable evalRunner +
//       4 V-AI-EVAL-* smoke tests; commit ddf10f1
//     - A.2: golden set expanded 5 → 25 cases; commit 4d0257f
//     - 2 eval-runner bug fixes (silent field-name issues):
//       commits 5d9737b + ca10503 + V-AI-EVAL-5 regression guard
//
//   Sub-arc B · Canvas AI Assist persona examples + soft-warn
//   verifier + annotation footer (BUG-062 expansion · 2026-05-13):
//     - [CONSTITUTIONAL TOUCH] SPEC §S20.4.1.1 + §S37.3.2 + R37.6
//       + R37.13 + 6 RED tests; commit 40f55d1
//     - Impl: 6 implicit-persona few-shot examples + verifier
//       severity tiers (high/medium/low) + chatService SOFT-WARN
//       integration + CanvasChatOverlay annotation footer + CSS;
//       commit 7fcc8b6
//     - B-polish: NORTHSTAR_HINT enumerated + Example 7 (save/
//       persistence) + Example 8 (tool-call-then-cite) + rule 2
//       strengthened; commit 4e34d6e. Baseline lift: 6.72 → 9.16/10
//       avg, 60% → 96% pass rate on 25-case golden set.
//
//   Sub-arc B.5 · Doc-audit gap-list artifact (2026-05-13):
//     - docs/SUB_ARC_B5_DOC_AUDIT_GAP_LIST.md; commit 3accf22.
//       Recommendation: HYBRID (wire 1-2 examples + author 4
//       short user-facing reference docs in Sub-arc C).
//
//   Discipline + Philosophy refinement (2026-05-13):
//     - Discipline lapse audit log; commit bc00263
//     - Philosophy clarification: discipline is about PROCESS
//       not about preventing changes; commit d3f118e
//
// New tests rolled into rc.8 (+96 net since rc.7):
//   V-FLOW-SKILL-V32-* (24 new · Skills Builder v3.2 reboot)
//   V-FLOW-IMPORT-* (15 + 7 = 22 · Path B Import-data workflow
//     including the kickoff-pane + Phase A·B·C sub-arc)
//   V-OPS-PAGES-1/2 (GitHub Pages deploy regression guards)
//   V-AI-EVAL-1/2/3/4/5 (eval harness scaffold + regression guard)
//   V-FLOW-GROUND-FAIL-1/2/3 rewritten + FAIL-4 extended +
//     V-FLOW-GROUND-ANNOTATE-1/2 NEW (SOFT-WARN verifier contract)
//   Plus WB-1..WB-4 + 8 integrity audit tests +
//   the 4 RELATIONSHIPS_METADATA constitutional fix tests
//
// SPEC annexes / sections added or amended:
//   §S46 (Skills Builder v3.2 reboot · NEW + 10 sub-rules CH36 a..j)
//   §S47 (Import-data workflow · NEW · 11 subsections) plus the
//     Sub-arc B amendments §S47.4.6/7 + §S47.8.5/6 + drift fixes
//   §S20.4.1.1 (Behavior examples in Layer 1 · NEW · 8 examples)
//   §S37.3.2 + R37.6 rewrite + R37.13 NEW (BLOCK→SOFT-WARN demote +
//     severity tiers)
//   §S48 (AI evaluation rubric · QUEUED)
//   §S25 constitutional amendment (aiTag.kind discriminator)
//   §S40 v3-pure architecture decision (v2 deletion contract)
//
// RULES added: §16 CH35 (Path B import-data invariants) · CH36
//   (10 sub-rules a..j for Skills Builder v3.2)
//
// Path to non-suffix "3.0.0" GA:
//   - Sub-arc C (knowledge-base wiring) per B.5 audit recommendation
//   - Sub-arc D (action proposals · D-Rule LOCKED · engineer-
//     conditional approval mandatory)
//   - BUG-061 Save-draft vs Publish lifecycle
//   - BUG-062 AI chat re-architecture closure
//   - At least one real-customer workshop run
//
// ---
//
// **3.0.0-rc.8-dev** (2026-05-11) — between v3.0.0-rc.7 (TAGGED
// 2026-05-09 at 1196/1196 GREEN) and the v3.0.0-rc.8 tag (2026-05-13).
// Note: the rejected rc.8 / S1 architecture (capsule library +
// cascaded vertical-tab rail + pill editor) was reverted before any
// tag landed. The internal arc naming "rc.8.b" disambiguates the
// reboot from the rejected design in commit messages, SESSION_LOG,
// and SPEC §S46. The semver lifecycle is unchanged: rc.7 → rc.8
// (post-reboot content) → next.
// In flight: rc.8.b Skills Builder v3.2 reboot. SPEC §S46 + RULES §16
// CH36 (10 sub-rules a..j); 24 V-FLOW-SKILL-V32-* tests; clean replace
// of v3.0/v3.1 skill schema (drop outputContract / outputTarget /
// promptTemplate / bindings; retire migrate helpers); new authoring
// surface (Seed + Data points with Standard/Advanced toggle + Improve
// + Improved + output format + mutation policy + parameters incl.
// file type); Canvas Chat tab system (permanent Chat + permanent
// Skills launcher + dynamic [Skill:<name>] tab with single-skill
// invariant); skill run-time (real-LLM via chatCompletion with data-
// path + parameter substitution; per-outputFormat dispatch); AI-
// mutation apply with aiTag provenance (instance-only scope) + "Done
// by AI" badge in MatrixView (current state + desired state tiles) +
// auto-clear on engineer save. Banner climbed 1196/1196 → 1220/1220
// across 8 R-commits + 1 hygiene commit + 1 session-log commit.
//
// **rc.8 (no .b) was REJECTED + REVERTED** prior to rc.8.b. Local
// hard-reset to `ab2aaf5` (rc.7 tag). Origin retains the rejected
// rc.8 / S1.A + S1.B commits (capsule library + cascaded vertical-
// tab rail + pill editor + portability spec) as historical record
// per the v2.4.11 rollback precedent. SPEC §S44 and §S45 marked
// RESERVED to prevent accidental section-number reuse.
//
// BUG-1 (legacy Skills toggle in head-extras) closed inline this
// commit; replaced by the R5 tab system's permanent Skills tab.
// BUG-2 (skill run-time data-point substitution missing; LLM echoed
// CARE XML template instead of executing) closed inline this commit
// via resolveTemplate(improvedPrompt, { engagement }) + hardened
// system prompt with explicit no-echo rules. BUG-3 / BUG-4 (tab
// strip contrast + parameters editor look-and-feel) DEFERRED to the
// UX polish arc per user direction.
//
// Per RULES §16 CH24 + PREFLIGHT.md item 1a: this catches up the
// `-dev` suffix that should have been added at R1 (first commit past
// the rc.7 tag); the bump was missed in lock-step with the
// architectural revert + reboot.
//
// ---
//
// **3.0.0-rc.7-dev** (2026-05-06) — between v3.0.0-rc.6 (TAGGED
// 2026-05-06 at 1187/1187 GREEN) and the eventual v3.0.0-rc.7 tag.
// In flight: rc.7-arc-1 mock-purge per `feedback_no_mocks.md` LOCKED
// 2026-05-05. Deletes services/mockChatProvider.js +
// services/mockLLMProvider.js + tests/mocks/* + V-MOCK suite (§T22) +
// V-CHAT-4/5/15/29/32 + V-PROD-* + V-PATH-31/32 (all converted to
// deprecation markers per TESTS §T1.2 append-only contract). Retires
// SPEC §S22 + RULES §16 CH13/CH14. Updates core/appManifest.js
// workflow text removing "Mock LLM run button" mentions.
//
// Per RULES §16 CH24 + PREFLIGHT.md item 1a: this is the FIRST commit
// past the rc.6 tag, so the `-dev` suffix is added now.
//
// ---
//
// **3.0.0-rc.6-dev** (2026-05-05) — between v3.0.0-rc.5 (TAGGED
// 2026-05-05 at 1169/1169 GREEN) and the v3.0.0-rc.6 tag (2026-05-06).
// rc.6 shipped: grounding contract recast per SPEC §S37 + RULES §16
// CH33 (RAG-by-construction); deterministic retrieval router + runtime
// verifier + threshold removal; BUG-029/030/031/033/034/035 closed.
// BUG-032 deferred to rc.6.1/rc.7 pending user repro.
//
// ---
//
// **3.0.0-rc.4-dev** (2026-05-03) — between v3.0.0-rc.3 (TAGGED
// 2026-05-03 PM at 1103/1103 GREEN) and the eventual v3.0.0-rc.4 tag.
// In flight: Group B UX consolidation arc per `feedback_group_b_spec_rewrite.md`
// — SPEC rewrite first, then code. Arc 1 (window theme + text rhythm
// per GPLC sample), Arc 2 (provider pills + footer + BUG-025 Cmd+K),
// Arc 3 (thinking affordances + dynamic try-asking + BUG-024 workflow-
// ID anti-leakage), Arc 4 (Skill Builder unification under Settings +
// v3 seed-skill purge).
//
// Per RULES §16 CH24 + PREFLIGHT.md item 1a: this WAS the FIRST commit
// past the rc.3 tag at the time, so the `-dev` suffix was added then.
//
// ---
//
// **3.0.0-rc.3** (TAGGED 2026-05-03) — closes the rc.3 implementation
// arc + AI-correctness consolidation. Banner 1103/1103 GREEN ✅
// (was 1048 at rc.2 tag; +55 net tests this release).
//
// Rolled into rc.3 tag (origin/v3.0-data-architecture):
//   - Phase A1 generic LLM connector (closes BUG-018; unblocks Gemini
//     + vLLM + local + any OpenAI-compat); commit `e8d17e4`
//   - Phase B concept dictionary (62 concepts × 13 categories;
//     selectConcept tool); commits `0344df7` + `9778f25`
//   - Phase C app workflow manifest (16 workflows + 19 recommendations;
//     selectWorkflow tool); commits `5a05d84` + `5fb48f3`
//   - Skill schema v3.1 — parameters[] + outputTarget; click-to-run
//     scope retired; migration helper at load + save boundaries;
//     parameterized runner; rebuilt Skill Builder UI; chat right-rail
//     populated with saved-skill cards; UseAiButton retired; topbar
//     consolidated to one "AI Assist" button (Dell-blue + diamond-glint
//     8s breathe). Commits `f0dc37f` `da051ce` `5ec646d` `6897321`
//     `83fb93c` `d429b46` `c975d1f`
//   - APP_VERSION discipline + 8-item PREFLIGHT checklist (recovery
//     after rc.2-tag freeze drift); commit `7414b36`
//   - Group A AI-correctness consolidation (rc.3 expanded scope):
//       - BUG-019 fix · v3 engagement persistence + rehydrate-on-boot
//         (SPEC §S31 + RULES CH27); commit `203ef12`
//       - BUG-020 fix · streaming-time handshake strip + shared
//         services/chatHandshake.js; commit `987c7e7`
//       - BUG-013 Path B · runtime UUID-to-label scrub in chat prose
//         (services/uuidScrubber.js); commit `66810c6`
//       - BUG-023 fix · gapPathManifest exposes layerId + gapType;
//         commit `7cf20ec`
//       - BUG-018 verified closed by V-CHAT-32 round-trip; commit
//         `94d203b`
//       - BUG-011 closed (user confirmed Anthropic key save works)
//
// New tests rolled into rc.3 (+55 since rc.2):
//   V-FLOW-CHAT-DEMO-1/2 · V-DEMO-V2-1 · V-DEMO-8/9 · V-CHAT-18..38
//   V-NAME-2 · V-CONCEPT-1..5 · V-WORKFLOW-1..5
//   V-SKILL-V3-1..7 · V-VERSION-1..2
//   V-FLOW-REHYDRATE-1/2/3 · V-PATH-31/32
//   V-TOPBAR-1 · V-LAB-VIA-CHAT-RAIL · V-AI-ASSIST-CMD-K · V-ANTI-USE-AI
//
// SPEC annexes added: §S26 (generic connector) · §S27 (concept dict) ·
// §S28 (workflow manifest) · §S29 (skill v3.1) · §S30 (APP_VERSION
// discipline + PREFLIGHT) · §S31 (engagement persistence)
// RULES added: §16 CH20–CH27
//
// Path to non-suffix "3.0.0" GA (per project_v3_no_file_migration_burden.md):
//   - 5 v2.x view tabs migrated to read via state/adapter.js
//   - UX consolidation arc (rc.5) per `feedback_group_b_spec_rewrite.md`
//     — SPEC rewrite first, window-contract pass, Skill Builder UX
//     rethink, BUG-022 chat polish
//   - At least one real-customer workshop run against a v3.0 engagement
//   - Real-Anthropic streaming smoke against a live key

export const APP_VERSION = "3.0.0-rc.10";
