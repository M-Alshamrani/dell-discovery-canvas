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

export const APP_VERSION = "3.0.0-rc.9-dev";
