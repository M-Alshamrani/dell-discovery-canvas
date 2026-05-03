# Dell Discovery Canvas — Session Handoff

**Last session end**: 2026-05-03 (late). **`v3.0.0-rc.3` TAGGED on `origin/v3.0-data-architecture`**. APP_VERSION = `"3.0.0-rc.3"` (no `-dev` suffix). **Banner 1103/1103 GREEN ✅**.

**State**: rc.3 closed. The 3-PHASE AI ARCHITECTURE PLAN is COMPLETE (data-aware + concept-aware + app-aware chat with vendor-neutral OpenAI canonical lingua franca). Skill architecture v3.1 is COMPLETE (parameters[] + outputTarget; click-to-run scope retired). Group A AI-correctness consolidation is COMPLETE (all OPEN BUGs that came in for rc.3 — BUG-013, BUG-018, BUG-019, BUG-020, BUG-023 — fixed with regression tests; BUG-011 closed by user confirmation). Topbar consolidated to ONE "AI Assist" button with the v2.4.13 Dell-blue + 8s diamond-glint treatment.

**Authority**: SPEC §S0..§S31 · RULES §16 CH1–CH27 · PREFLIGHT.md (8-item checklist) · MEMORY index.

---

## 1 · What just shipped (rc.3 ledger)

Full per-commit detail in `docs/RELEASE_NOTES_rc.3.md`. Per-arc summary:

| Arc | Commits | Theme |
|---|---|---|
| Recovery | `7414b36` | APP_VERSION discipline + PREFLIGHT.md (closed rc.2-tag freeze drift) |
| rc.3 implementation | `5ec646d` `6897321` `83fb93c` `d429b46` | Skill v3.1 UI rebuild + chat right-rail saved-skill cards + UseAiButton retirement + topbar consolidation |
| Group A AI-correctness | `203ef12` `987c7e7` `66810c6` `7cf20ec` `94d203b` | BUG-019 engagement rehydrate + BUG-020 streaming-time handshake strip + BUG-013 Path B UUID scrub + BUG-023 manifest layerId + BUG-018 closed |
| AI Assist rebrand | `c975d1f` | Sparkle icon + Dell-blue + 8s diamond-glint pulse |
| Tag | (this commit) | APP_VERSION drop -dev + SPEC + RULES + RELEASE_NOTES + HANDOFF + PREFLIGHT 1-8 verified |

Plus 14 commits between rc.2 and the recovery commit (Phase A1 generic LLM connector + Phase B concept dictionary + Phase C app workflow manifest + 7 BUG-010..017 fixes + Skill schema v3.1 commits).

**Test deltas**: 1048 (rc.2) → 1103 (rc.3), **+55 net tests**.

**SPEC annexes added**: §S26 + §S27 + §S28 + §S29 + §S30 + §S31.
**RULES added**: §16 CH20–CH27.

---

## 2 · Where you are right after rc.3 ships

- **Branch**: `v3.0-data-architecture` · last commit is the rc.3 tag commit · NOT pushed yet (per `feedback_no_push_without_approval.md`; user must say "push" / "tag it" / "ship it" to push).
- **APP_VERSION**: `"3.0.0-rc.3"` in `core/version.js` (matches what the tag will be).
- **Banner**: 1103/1103 GREEN.
- **Working tree**: clean after the tag commit.
- **Origin**: `origin/v3.0-data-architecture` is N commits BEHIND local. `origin/main` is on `5614f32` (v2.4.16); v2.4.17-wip-snapshot tag preserved.

---

## 3 · Architecture — what the app looks like at rc.3 tag

### Three grounding layers (chat surface)
- **Structural** — `core/dataContract.js` derives entities + relationships + invariants + FKs + catalog metadata + bindablePaths + analyticalViews from schemas at module load with FNV-1a checksum. First-turn handshake: LLM echoes `[contract-ack v3.0 sha=<8>]` to prove ingestion (V-CHAT-13..17).
- **Definitional** — `core/conceptManifest.js` carries 62 concepts × 13 categories (gap types, layers, urgencies, dispositions, drivers, environments, instances, skills + more). TOC inlined in system prompt; full bodies via `selectConcept(id)` tool (V-CONCEPT-1..5).
- **Procedural** — `core/appManifest.js` carries 16 workflows + 19 recommendations + 5 tab labels + 6 action labels. TOC + recommendations inlined; full workflow bodies via `selectWorkflow(id)` tool (V-WORKFLOW-1..5).

### Vendor-neutral connector (Phase A1)
- `services/aiService.js` `buildRequest(provider, ...)` — generic OpenAI-compatible canonical with translation shims:
  - Anthropic: `tools` array with `input_schema` + `tool_use` content blocks
  - Gemini: `functionDeclarations` + `functionCall` / `functionResponse` parts
  - OpenAI / vLLM / local / Mistral / Groq / Together / Anyscale / Dell Sales Chat: native canonical
- `services/chatService.js` runs up to 5-round multi-tool chains (`MAX_TOOL_ROUNDS=5`) across all providers (V-CHAT-18/19 + V-CHAT-30/31/32).

### Skill architecture v3.1
- `schema/skill.js` — drops `skillType` + `entityKind`; adds `parameters[]` + `outputTarget`. `migrateSkillToV31` helper applied at load + save boundaries (idempotent for v3.1 input, derives parameters from legacy click-to-run + entityKind).
- `services/skillRunner.js` — parameterized invoke (`opts.params` resolves `{{<paramName>}}` + `{{context.<paramName>.<field>}}`); `outputTarget` dispatch (only `chat-bubble` actively rendered; deferred targets throw clear "rc.4" error).
- `ui/views/SkillBuilder.js` — simplified form (~445 lines, was ~735): name + description + prompt template + parameters[] editor + outputTarget radio. NO chip palette, NO scope picker, NO entity-kind dropdown, NO 1-2-3 wizard.
- `ui/views/CanvasChatOverlay.js` — right-rail saved-skill cards (click → mini parameter form for entityId / primitive params → resolved prompt drops into chat input). "+ Author new skill" footer button opens the Skill Builder (the only entry point post-rc.3 #7).

### v3 engagement persistence (BUG-019 fix)
- `state/engagementStore.js` persists active engagement to `localStorage.v3_engagement_v1` on every `_emit()`.
- Module-load `_rehydrateFromStorage()` validates through `EngagementSchema.safeParse` + corrupt-cache safety (wipe + start fresh on malformed/invalid).
- Bridge's customer-shallow-merge unchanged: rehydrated engagement comes back, latest v2 customer patch applies on top, gaps/drivers/etc. survive across reload.

### Chat-prose anti-leakage (BUG-013 + BUG-020)
- Shared `services/chatHandshake.js` exports `HANDSHAKE_RE` + `HANDSHAKE_STRIP_RE` + `stripHandshake(text)`. chatService + chatMemory + CanvasChatOverlay all import the single source-of-truth pattern. Streaming-time strip runs on every `onToken` (defense-in-depth).
- `services/uuidScrubber.js` exports `buildLabelMap(engagement)` + `scrubUuidsInProse(text, labelMap)`. Replaces bare v3-format UUIDs with resolved labels (gap description / driver label / environment alias / instance label) or `[unknown reference]` for orphans. Skips fenced + inline code. Idempotent. Applied at chat onComplete (final pass) AND at streaming-time onToken (mirrors handshake-strip pattern).

### Topbar single-AI-surface contract
- ONE button: `#topbarAiBtn` ("AI Assist", sparkle icon, `.topbar-ai-btn` class with `ai-luxury-glow` 8s breathe + `ai-luxury-glint` diamond sweep).
- Click opens Canvas Chat. Cmd+K / Ctrl+K opens legacy AiAssistOverlay tile-grid (full retirement scheduled rc.5).
- Skill Builder access: chat right-rail "+ Author new skill" affordance ONLY.

---

## 4 · What's next (the queue)

Per the user-validated release sequence (logged 2026-05-03):

| Tag | Theme | Notes |
|---|---|---|
| **rc.4** | AI correctness Round 2 | Anything that surfaces during real-customer workshops. Currently OPEN: BUG-001 + BUG-002 propagate-criticality. May also fold real-Anthropic + real-Gemini live-key smoke if not run during rc.3 workshop. |
| **rc.5** | UX consolidation arc | **Per `feedback_group_b_spec_rewrite.md`: starts with a SPEC rewrite session capturing user expectations BEFORE any UI code lands.** Scope: window/overlay shape contract (Settings vs Chat vs Skill Builder vs AI Assist vs confirmAction inconsistencies), Skill Builder UX rethink (terminology + IA + progressive disclosure, possibly radical re-shape), BUG-022 chat polish, AiAssistOverlay retirement (Cmd+K rebound to Canvas Chat). |
| **rc.6** | View migration arc | 5 v2.x view tabs migrated to read via `state/adapter.js`. Foundation for crown-jewel polish. |
| **rc.7** | Crown-jewel polish | Per `project_crown_jewel_design.md` + `project_deferred_design_review.md` (whitespace > drawer IA > icons > tag vocab > color discipline). BUG-021 perf can fold in here. |
| **rc.8** | Pre-GA hardening | v2.x AI admin parity-gate decision (`project_v2x_admin_deferred.md`); v3-prefix purge (`feedback_no_version_prefix_in_names.md`); backlog cleanup. |
| **v3.0.0 GA** | Tag | Real workshop run logged + all gates closed. |

---

## 5 · Locked behavioral discipline (memory index)

These are non-negotiable and apply to every commit:

- `feedback_spec_and_test_first.md` — every release sequences spec → tests → code → verify. SPEC + RULES + V-* test contract authored BEFORE implementation. **Pre-flight checklist tickets every box at tag time.**
- `feedback_test_or_it_didnt_ship.md` — every BUG-NNN fix MUST add a regression test that would have caught the original incident.
- `feedback_no_patches_flag_first.md` — never ship a fix that bypasses v3 schema/validation/architecture without explicit user approval BEFORE coding.
- `feedback_browser_smoke_required.md` — every tag MUST include a manual browser smoke against the verification spec via Chrome MCP.
- `feedback_test_what_to_test.md` — V-FLOW or it didn't ship; property tests are necessary but never sufficient.
- `feedback_no_push_without_approval.md` — never `git push` without explicit user instruction. Commit locally during work iterations.
- `feedback_no_version_prefix_in_names.md` — version numbers live in git tags + APP_VERSION + changelogs only; never in filenames, exports, or UI labels.
- `feedback_dockerfile_whitelist.md` — every new top-level dir MUST be added to `Dockerfile` COPY commands in the same commit.
- `feedback_import_collision.md` — alias v3.0 imports during v2↔v3 cutover to avoid `SyntaxError: Identifier already declared`.
- `feedback_foundational_testing.md` — every data-model change ships with demo refresh + seed-skill update + demoSpec assertion + DEMO_CHANGELOG entry.
- `feedback_naming_standard.md` — AppName-vX.Y.Z naming for committed artifacts; no role labels or casual placeholders.
- `feedback_docs_inline.md` — update CHANGELOG_PLAN + SPEC in the same turn as the code, not as a backfill.
- **`feedback_group_b_spec_rewrite.md`** (NEW 2026-05-03) — when work reaches the UX consolidation arc (rc.5), expect intensive SPEC rewrite session BEFORE coding starts.

User-flagged concerns (non-blocking; rc.5 work):
- `project_skillbuilder_ux_concern.md` — Lab tab Skill Builder unintuitive
- `project_ui_ux_consolidation_concern.md` — broader UI/UX + window inconsistency

---

## 6 · How a fresh session picks this up

1. Read this `HANDOFF.md` first.
2. Read `MEMORY.md` index + the locked feedback memories.
3. Skim `docs/v3.0/SPEC.md` change log table (find the most recent annexes — §S26..§S31 are the rc.3 additions).
4. Check `docs/RULES.md §16` (CH1–CH27) for hard contracts.
5. Run the Docker container (`docker compose up -d`) and verify the banner is GREEN.
6. Pick the next arc per `§4 What's next` above; before coding, surface it to the user for confirmation (especially rc.5 which expects a SPEC-rewrite session).

---

## 7 · File pointers (post-rc.3)

| Concern | File |
|---|---|
| Active engagement source-of-truth | `state/engagementStore.js` (persists + rehydrates per SPEC §S31) |
| v2 sessionState (legacy) | `state/sessionStore.js` (still authoritative for v2.x view tabs) |
| v2→v3 bridge (customer shallow-merge) | `state/sessionBridge.js` |
| v3 engagement schema | `schema/engagement.js` |
| v3 skill schema | `schema/skill.js` (v3.1: parameters[] + outputTarget) |
| v3 demo engagement | `core/demoEngagement.js` (8 gaps / 3 drivers / 4 envs / 23 instances) |
| Data contract (LLM grounding) | `core/dataContract.js` |
| Concept dictionary | `core/conceptManifest.js` |
| App workflow manifest | `core/appManifest.js` |
| Chat orchestration | `services/chatService.js` |
| System prompt assembly | `services/systemPromptAssembler.js` |
| Tool registry | `services/chatTools.js` |
| Generic LLM connector | `services/aiService.js` |
| Real provider (anthropic / gemini / openai / vllm / dell) | `services/realChatProvider.js` |
| Mock provider (production-path) | `services/mockChatProvider.js` |
| Handshake regex + strip | `services/chatHandshake.js` |
| UUID-to-label scrub | `services/uuidScrubber.js` |
| Skill runner | `services/skillRunner.js` |
| Skill output schemas | `services/skillOutputSchemas.js` |
| Skill save validator | `services/skillSaveValidator.js` |
| Manifest generator | `services/manifestGenerator.js` |
| Path resolver | `services/pathResolver.js` |
| Skill Builder UI (v3.1) | `ui/views/SkillBuilder.js` |
| Skill Builder opener (shared) | `ui/skillBuilderOpener.js` |
| Canvas Chat overlay | `ui/views/CanvasChatOverlay.js` |
| AI Assist legacy overlay | `ui/views/AiAssistOverlay.js` (Cmd+K only post-rc.3 #7) |
| Settings modal | `ui/views/SettingsModal.js` |
| Skills storage (v3.1) | `state/v3SkillStore.js` |
| Diagnostic suite | `diagnostics/appSpec.js` (1103 tests) |
| Test runner | `diagnostics/testRunner.js` |
| BUG log | `docs/BUG_LOG.md` |
| Pre-flight checklist | `docs/PREFLIGHT.md` |
| SPEC | `docs/v3.0/SPEC.md` |
| RULES | `docs/RULES.md` |
| Release notes (latest) | `docs/RELEASE_NOTES_rc.3.md` |

---

## 8 · Push checklist (when user says "push" / "tag it" / "ship it")

```bash
git push -u origin v3.0-data-architecture
git tag v3.0.0-rc.3
git push origin v3.0.0-rc.3
```

Verify on GitHub: branch `v3.0-data-architecture` carries the rc.3 tag commit; `v3.0.0-rc.3` tag exists; `origin/main` still on `5614f32` (v2.4.16, untouched).
