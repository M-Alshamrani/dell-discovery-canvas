# Session Log — 2026-05-10 — Skills Builder v3.2 reboot (rc.8.b)

**Branch**: `v3.0-data-architecture` · **Local range**: `ab2aaf5..bcde3c8` (8 commits + 1 hygiene; 9 total) · **Final banner**: 1220/1220 GREEN ✅ · **APP_VERSION**: still `3.0.0-rc.7-dev` (rc.8.b is unreleased; awaits user direction on tag)

> Live ledger. Started day with rc.7 GREEN baseline + 4 stale rc.8 commits on origin (S1.A/S1.B + S2.0..S2.3). Ended day with full Skills Builder v3.2 ship per user-rebooted SPEC §S46, 24 new tests authored RED-first then flipped GREEN progressively across 8 commits.

## Headline outcomes

1. **rc.8 (S1+S2.0..S2.3) hard-reverted** locally to `ab2aaf5` after user rejected the cascaded-rail / pill-capsule / portability architecture as "not meeting my requirements". Origin still carries the rejected commits as historical record per the v2.4.11 rollback precedent (5 commits ahead of local, intentionally diverged).
2. **rc.8.b shipped** — Skills Builder v3.2 from-scratch redesign per user verbal SPEC §3.1 (transcribed verbatim into SPEC §S46.2):
   - Settings → Skills authoring (8-field form: Label / Description / Seed / Data points + Standard/Advanced toggle / Improve→Improved / Parameters incl. file type / Output format / Mutation policy)
   - Canvas Chat overlay tabs: permanent Chat + permanent Skills launcher + dynamic `[Skill: <name>]` (single-skill invariant CH36.f)
   - Skill run-time: real-LLM via chatCompletion; parameter substitution; FileReader for file params; per-outputFormat dispatch
   - AI-mutation apply: aiTag provenance on instances; ask-policy approval modal + auto-tag immediate; v3-pure routing through commitAction; auto-clear on engineer save; "Done by AI" badge in MatrixView
3. **24 new tests** authored RED-first, all GREEN by R7 closure (V-FLOW-SKILL-V32-* family).
4. **15 legacy tests retired** in lock-step with the schema clean replace (V-PATH-3/4/5/12/13 + V-PROD-11 + V-SKILL-V3-1/2/5/11/13/14/15 + V-MIGRATE-V2-V3-1/2/3/4) — all replaced by V-FLOW-SKILL-V32-* contracts.
5. **Migration helpers retired** entirely — `migrateSkillToV31` + `migrateV2SkillToV31` both gone (no production users; clean break).
6. **Schema clean replace** — outputContract/outputTarget/promptTemplate/bindings DROPPED from `schema/skill.js`; outputFormat (text/dimensional/json-array/scalar) + mutationPolicy (ask/auto-tag) + aiTag (instance scope only) ADDED.
7. **CSS bug fix** mid-arc — output-format + mutation-policy radios were rendering inline (all 4 labels + descriptions running together in one paragraph); flex-column layout + per-row borders shipped at R5.
8. **Two regressions caught + fixed mid-arc**:
   - VT20 em-dash in MatrixView.js (R7 v1) → ASCII dash (R7 v2)
   - V-CHAT-9 forbidden-import (R7 v1: CanvasChatOverlay imported direct from state/collections/instanceActions.js) → routed through new `state/adapter.js commitAiInstanceMutation` helper (R7 v2) per CH2 + CH34
9. **Discipline reinforced**: principal-architect R0..R11 honored end-to-end; each commit ships with browser smoke evidence + screenshot + sub-arc proof block. The "no parallel rebuild" rule landed mid-R5 after the harness backgrounded multiple `docker compose up --build` commands and the smoke suite ran against stale code; user direction "single foreground sequence, no parallelism" applied for the rest of the arc.

## Banner journey

| Stage | Banner | Sub-arc / Commit |
|---|---|---|
| rc.7 baseline | 1196/1196 ✅ | `ab2aaf5` (start of day) |
| rc.8 (revert origin) | n/a | 4 origin commits dropped from local · `ab2aaf5` restored |
| R1 scaffold | 1197/1219 (22 RED) | `f2c8749` SPEC §S46 + RULES §16 CH36 + 23 V-FLOW-SKILL-V32-* RED tests |
| R2 curation | 1199/1219 (20 RED) | `c57ce1f` dataContract STANDARD_MUTABLE_PATHS + helpers |
| R3 SkillBuilder rewrite | 1207/1219 (12 RED) | `c1e7f62` 8 author tests GREEN + 4 legacy retirements |
| R4 schema replace | 1211/1219 (8 RED) | `ce48279` 4 SCHEMA tests GREEN + 12 legacy retirements |
| R5 Chat tab system | 1215/1219 (4 RED) | `d7f4dbe` CHAT-TAB-1/2/3 + RUN-2 GREEN + CSS bug fix |
| R6 run-time wiring | 1216/1219 (3 RED) | `19888f4` RUN-1 GREEN |
| R7 mutation apply | 1220/1220 ✅ | `c93042f` MUTATE-1/2/3/4 GREEN; rc.8.b COMPLETE |
| Hygiene | 1220/1220 ✅ | `bcde3c8` modal cleanup + Test button wired to real LLM |

## Commit ledger (chronological)

| # | Commit | Theme |
|---|---|---|
| 1 | `f2c8749` | **R1 scaffold** — SPEC §S46 (15 subsections) + RULES §16 CH36 (10 sub-rules a..j) + 23 V-FLOW-SKILL-V32-* RED-first tests; §S44/§S45 marked RESERVED for the rejected rc.8 design |
| 2 | `c57ce1f` | **R2 curation** — dataContract STANDARD_MUTABLE_PATHS frozen (26 paths) + getStandardMutableDataPoints + getAllMutableDataPoints helpers; CURATION-1/2 GREEN |
| 3 | `c1e7f62` | **R3 SkillBuilder rewrite** — clean v3.2 form: Seed + Data points (Standard/Advanced) + Improve (real-LLM) + Improved (readonly + Edit + Re-improve) + Output format + Mutation policy + Parameters[] (incl. file); 8 author/improve tests GREEN; 4 legacy V-SKILL-V3-5/11/13/15 retired |
| 4 | `ce48279` | **R4 schema clean replace** — drop outputContract/outputTarget/promptTemplate/bindings; add description + seedPrompt + dataPoints[] + improvedPrompt + outputFormat + mutationPolicy + ParameterSchema.type='file' + accepts; retire migrateSkillToV31 + migrateV2SkillToV31 + 12 legacy tests; v3.2 strict-parse only |
| 5 | `d7f4dbe` | **R5 Canvas Chat tab system** — permanent Chat + permanent Skills launcher (read-only) + dynamic [Skill:<name>] (single-skill invariant); launchSkill + renderSkillPanelForRun exports; cancel-confirm modal; CSS bug fix for output-format/mutation-policy radios |
| 6 | `19888f4` | **R6 skill run-time wiring** — runSkill export; param substitution incl. file via FileReader; chatCompletion call (real LLM, no mocks); per-outputFormat dispatch (text/dimensional/json-array/scalar); chat dialog turn rendering |
| 7 | `c93042f` | **R7 AI-mutation apply** — schema/instance.js gains optional aiTag; instanceActions.applyAiInstanceMutation (NEW) stamps aiTag; instanceActions.updateInstance auto-clears aiTag on engineer save; state/adapter.commitAiInstanceMutation routes via commitAction (CH34); CanvasChatOverlay.applyMutations (NEW) with ask-policy approval modal + auto-tag immediate; MatrixView "Done by AI" badge; MUTATE-1/2/3/4 GREEN; SPEC §S46.10 + §S46.11 + RULES CH36.h amended for tag-universal-policy-controls-gate semantics + instances-only scope + auto-clear contract; rc.8.b COMPLETE at 1220/1220 GREEN |
| 8 | `bcde3c8` | **hygiene** — cleanup leaky test modals (CHAT-TAB-3 + MUTATE-1 finally blocks remove residue) + wire SkillBuilder Test button to real LLM (R3 stub replaced; chatCompletion call against current draft's improvedPrompt) |

## What rc.8.b shipped (per SPEC §S46)

- **Authoring** in Settings → Skills (admin/write surface):
  - Label + Description + Seed prompt + Data points selector + Improve button + Improved prompt + Parameters[] + Output format + Mutation policy (conditional on mutating outputs)
  - Standard view: 26 curated paths (customer / drivers / environments / instances / gaps); Advanced toggle exposes the full 49-path schema
  - Improve = real-LLM CARE-XML rewriter; failure = inline error chip + Retry; readonly Improved field with Edit + Re-improve buttons
  - Test button wired to real LLM (chatCompletion against the draft's improvedPrompt); inline result panel
- **Run-time** in Canvas Chat overlay (run/use surface):
  - Tab strip: permanent Chat + permanent Skills launcher + dynamic [Skill:<name>] (single-skill at a time per CH36.f)
  - Skills launcher: read-only list of saved skills with per-row Run button (no edit/save/delete affordances per CH36.g)
  - Dynamic Skill tab: chat dialog (left) + Skill panel right-rail (description / parameters / file slot / Run button / output preview)
  - Real-LLM via chatCompletion; param substitution incl. file content via FileReader; per-outputFormat dispatch
- **AI-mutation provenance**:
  - aiTag = { skillId, runId, mutatedAt } on instances (scope: instances ONLY per user direction; drivers/envs/gaps/customer/engagementMeta out of scope)
  - Stamped under EITHER policy (ask-then-approved OR auto-tag); the policy controls the gate, not the tag
  - Auto-clear on engineer save (instanceActions.updateInstance strips aiTag); no explicit clear-tag operation
  - "Done by AI" badge in MatrixView tile (current state + desired state grids); dashed Dell-blue outline + "AI" chip top-right corner

## What rc.8.b deferred (post-R7 polish arcs)

1. **Author UX redesign** (per user direction 2026-05-10 "Author UX redesign deferred until after R7. Functionality first. The two-pane browser-and-detail pattern (data points, output formats, parameters) becomes a dedicated polish arc after R7 lands the mutation flow")
2. **Streaming responses** in skill runs (R6 uses chatCompletion not streamChat; multi-round / tool-use round-trips deferred)
3. **Inline clarification dialogue** (SPEC §S46.9 contract structurally wired via _appendSkillDialogTurn but the multi-round chain isn't connected)
4. **Heatmap renderer** for outputFormat='dimensional' (renders as JSON in panel output area at MVP; full heatmap deferred)
5. **Per-row mutation approval toggle** (single-batch confirm at MVP per Q-R7-2; per-row deferred)
6. **Marketplace export/import UX** (CH36.i contract preserved — saved skill JSON has no UUIDs; UX itself deferred)
7. **APP_VERSION bump** — still `3.0.0-rc.7-dev`. rc.8.b tag pending user direction.

## User-flagged for tomorrow

User noted at session close (2026-05-10): *"will pick up tomorrow, still see some bugs, but good progress"*.

**Action for next session**: capture specific repro for any visible bugs the user surfaces, log as BUG-NNN per the bug-entry → SPEC → TESTS → RULES → RED scaffold → impl → smoke discipline. Don't improvise fixes — flag first, follow the contract.

## Origin / push state

- **Local**: `bcde3c8` (8 commits ahead of `ab2aaf5`)
- **Origin**: `4a0c205` (rejected rc.8 / S1.B; 5 commits diverged from local-restored rc.7)
- **No push** has happened today. Per `feedback_no_push_without_approval.md`, awaits user "push" / "tag rc.8.b" / "ship it" direction.
- Origin retains rejected rc.8 / S1.A + S1.B as historical record per the v2.4.11 rollback precedent. User's call later whether to force-push the new lineage forward, land revert-commits to clean origin, or leave diverged.

## Discipline notes from today

- **Spec-first preserved end-to-end**: every sub-arc landed SPEC + RULES + RED tests in R1; implementation flipped them to GREEN progressively. R7 amended SPEC §S46.10 + §S46.11 + CH36.h mid-arc when scope narrowed (instance-only + tag-universal); SPEC was rewritten in lock-step, not backfilled.
- **No mocks** rule honored: Improve button + Skill run-time + Test button + applyMutations all route through `services/aiService.js chatCompletion` against the active real provider. Source-grep negation tests guard against regression.
- **No-UUID rule** preserved at the schema validator level; saved skill JSON cannot carry UUID literals (V-PORT-SKILLS-2 contract; foundation for marketplace export later).
- **Per-commit revertibility** (R7): each of the 8 commits is independently revertible. No commit depends on subsequent ones; later commits build on earlier ones cleanly.
- **R11 four-block ritual**: every code-landing turn opened with recite + answer + execute + browser-smoke pledge; every commit ended with `Browser smoke evidence:` block + Chrome MCP screenshot.
- **No parallelism for container rebuilds**: locked mid-R5 after backgrounded `docker compose up --build` commands competed and the smoke ran against stale code. Single foreground sequence (`down → up --build → wait healthy → grep verify`) for the rest of the arc.

End of session 2026-05-10.
