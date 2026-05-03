# Release notes — `3.0.0-rc.3-dev` (in flight)

**Status**: NOT YET TAGGED. This document captures the state of the `-dev` period between the `v3.0.0-rc.2` tag (2026-05-02 PM at 1048/1048 GREEN) and the eventual `v3.0.0-rc.3` tag.

**Authored**: 2026-05-03 (early), as part of recovery commit R3 after the rc.2 freeze drift surfaced 2026-05-02 LATE EVENING.

**Authority**: `docs/v3.0/SPEC.md §S30` · `docs/RULES.md §16 CH24` · `docs/PREFLIGHT.md`.

---

## Banner state on this -dev period

`1085/1085 GREEN ✅` (post-recovery R1; was 1083 before V-VERSION-1/2 landed).

## What landed since rc.2 (in chronological order, all on `origin/v3.0-data-architecture`)

### Workshop-validation hotfixes (BUG-010..017)

| Commit | Fix |
|---|---|
| `7172737` | **BUG-010** — rich Acme Healthcare v3-native demo (3 drivers / 4 envs / 23 instances / 8 gaps); `state/sessionBridge.js` shallow-merge (no longer clobbers v3 entities on v2 emit); NEW `state/v3ToV2DemoAdapter.js` (single source of truth from v3 demo into v2 sessionState). Tests: V-FLOW-CHAT-DEMO-1/2, V-DEMO-V2-1, V-DEMO-8/9. |
| `ddc54fc` | **BUG-012** — multi-round tool chaining (`chatService.MAX_TOOL_ROUNDS=5`). Pre-fix the 1-round cap stuck Q1+Q2 questions on round-2 preamble. Tests: V-CHAT-18, V-CHAT-19. |
| `d324971` | **BUG-013** — anti-leakage role section (NEVER directives on UUIDs / internal field names / version markers / catalog ids); selector label enrichment (`selectGapsKanban.gapsSummary` includes description / urgencyLabel / driverLabel / layerLabel; `selectVendorMix.byEnvironment[id].envLabel` populated). Tests: V-CHAT-20/21/22. |
| `4ee35ca` | **BUG-014** — UI-string anti-leakage purge in 4 AI-surface files; mass-rename of v3-prefixed DOM ids in SkillBuilder.js. Tests: V-NAME-2 source-grep. |
| `eb2ffc8` | **Phase 3** chat shell redesign (`size:"chat"` 1180×88vh; row layout with collapsible Skills right-rail) + **BUG-015** (handshake silent-strip on subsequent turns). Tests: V-CHAT-23. |
| `7a84b72` | **BUG-016** — handshake strip is BRACKET-OPTIONAL (Gemini emits without brackets); `chatMemory.loadTranscript` heals persisted leaks at load time. Tests: V-CHAT-24/25. |
| `5052d8a` | **BUG-017** — Mock provider toggle removed; replaced with **connection-status chip** (green dot "Connected to Claude" / amber "Configure provider", click → opens Settings); chat always uses active aiConfig provider. Tests: V-CHAT-26. |

### 3-PHASE AI ARCHITECTURE PLAN (user-approved 2026-05-02 LATE EVENING; complete)

| Commit | What |
|---|---|
| `0d4d6d9` | HANDOFF + 3-phase plan capture |
| `e8d17e4` | **Phase A1** — generic OpenAI tool-use connector. Closes BUG-018 (Gemini hangs on tool-required questions). Unblocks any OpenAI-compat LLM (vLLM, local, Mistral, Groq, Together, Anyscale, Dell Sales Chat). Tests: V-CHAT-27..32. |
| `0344df7` | Phase B draft — `core/conceptManifest.js` (62 concepts × 13 categories with definition + example + whenToUse + vsAlternatives + typicalDellSolutions). Doc-only review draft. |
| `9778f25` | **Phase B2** — concept dictionary wired into chat surface. TOC inlined on cached prefix; full bodies via `selectConcept(id)` tool. Tests: V-CONCEPT-1..5. |
| `066cfc6` | BUG-019..022 logged in `docs/BUG_LOG.md` with fix plans (canvas-empty race, handshake leak streaming-time, Gemini perf + caching, chat UI polish). |
| `5a05d84` | Phase C draft — `core/appManifest.js` (16 workflows + 19 recommendations + APP_SURFACES). Doc-only review draft. |
| `5fb48f3` | **Phase C2** — workflow manifest wired into chat surface. TOC + recommendations inlined; full workflow bodies via `selectWorkflow(id)` tool. Tests: V-WORKFLOW-1..5. |
| `8a299a5` | HANDOFF rewrite (Phase A/B/C complete) |
| `a5bfdd0` | **SPEC §S29 + RULES §16 CH23** — Skill architecture v3.1 captured. Doc-only blueprint for the rc.3 implementation arc. |

### Skill architecture v3.1 (rc.3 implementation arc; in progress)

| Commit | What |
|---|---|
| `f0dc37f` | **rc.3 #2** — `schema/skill.js` v3.1 (drops `skillType` + `entityKind`; adds `outputTarget` + `parameters[]`). NEW `migrateSkillToV31` helper at load + save boundaries (idempotent). `state/v3SkillStore.js` integration. Tests: V-SKILL-V3-1/2. |
| `da051ce` | **rc.3 #3** — `services/skillRunner.js` parameterized invoke (`opts.params` → resolves `{{<paramName>}}` + `{{context.<paramName>.<field>}}`). `outputTarget` dispatch (only `chat-bubble` actively rendered; deferred targets throw clear "rc.4" error). Tests: V-SKILL-V3-3/4. |

### rc.3 implementation arc — REMAINING (NOT YET LANDED)

Per SPEC §S29.9:

| # | Commit scope | Risk |
|---|---|---|
| 4 | `ui/views/SkillBuilder.js` simplified rebuild — drop chip palette + scope picker + entity-kind picker + 1-2-3 wizard; add parameters[] editor + outputTarget radio. + V-SKILL-V3-5. | Medium (heavy UI refactor, 600+ lines) |
| 5 | `ui/views/CanvasChatOverlay.js` right-rail population — saved-skill cards; click → drops resolved prompt + parameter form into chat input. + V-SKILL-V3-6. | Low |
| 6 | `ui/components/UseAiButton.js` retirement — replaced by chat right-rail; entity-context drop is via chat input. + V-SKILL-V3-7 + V-ANTI-USE-AI source-grep. | Low |
| 7 | Top-bar consolidation (one AI button) + Lab tab deprecation + final HANDOFF/RELEASE_NOTES rewrite. | Low |

### Recovery (2026-05-03)

| Commit | What |
|---|---|
| **R1** (this -dev period commit) | `APP_VERSION` bumped from `"3.0.0-rc.2"` (frozen) to `"3.0.0-rc.3-dev"` per SPEC §S30 / RULES §16 CH24. NEW V-VERSION-1 (semver shape) + V-VERSION-2 (source-grep ensures `app.js` reads APP_VERSION import; no hard-coded chip values). Closes the rc.2-tag freeze drift. |
| R2 (this commit) | NEW `docs/PREFLIGHT.md` — durable 8-item checklist artifact gating every tag commit. References SPEC §S30.2 + RULES §16 CH24. Anti-pattern history captures the rc.2 freeze drift as the lesson. |
| R3 (this commit) | This document. |
| R4 (this commit) | `HANDOFF.md` rewrite for fresh-session pickup — full state + remaining rc.3 work + APP_VERSION semantics + PREFLIGHT.md reference. |

---

## What's documented but NOT YET implemented

Per SPEC §S29.7 (skill rendering targets — DEFERRED to rc.4 / GA):

- `outputTarget: "structured-card"` — visualization with prescribed schema
- `outputTarget: "reporting-panel"` — visualization (the heatmap example user proposed; cards on the Reporting tab)
- `outputTarget: "proposed-changes"` — mutate-with-approval (agent-like, with approval gates)

Per BUG_LOG (queued):

- **BUG-001/002** — propagate-criticality regressions; GA polish bucket
- **BUG-011** — Settings can't save Anthropic API key; UNCONFIRMED in my probe; awaiting user repro
- **BUG-018** — CLOSED via Phase A1 (Gemini tool-use wired)
- **BUG-019** — canvas-empty race against populated UI; needs DevTools repro
- **BUG-020** — handshake leak streaming-time strip; surgical fix queued
- **BUG-021** — Gemini perf + OpenAI prompt caching; rc.4 polish
- **BUG-022** — chat UI polish; folded into rc.3 #4-#7

Per HANDOFF queue:

- **GA arc** — 5 view migrations to read via `state/adapter.js` (Context → Architecture → Heatmap → Workload → Gaps → Reporting)
- **Real-Anthropic streaming smoke** against a live key (mock smoke covers all paths today)

---

## Known divergences this -dev period

1. **`core/v3SeedSkills.js` still in v3.0 shape** (skillType + entityKind). Migrated at load + save boundaries per SPEC §S29.3. Re-authoring deferred to rc.3 #4 (Skill Builder UI rebuild) where the seeds get re-authored in v3.1 native shape together with the new builder.
2. **Skill Builder UI (`ui/views/SkillBuilder.js`) still has the v3.0 chip-palette + scope-picker + 1-2-3 wizard.** Schema migration shim (BOTH at saveV3Skill + skillOutputSchemas SkillSchema preprocess) ensures the legacy UI keeps working until rc.3 #4 retires it.
3. **No `selectRecommendation(question)` chat tool** — recommendations are inlined in the prompt; LLM pattern-matches naturally. Future tool wiring possible if needed.
4. **No SSE per-token streaming for OpenAI-compat / Gemini** — Phase A3 polish, deferred. Anthropic streaming works.

---

## Tag readiness (when rc.3 should land)

Per PREFLIGHT.md item 1b: tag rc.3 when:
- rc.3 #4-#7 commits land
- Banner GREEN at tag time (no RED)
- `APP_VERSION` bumped to `"3.0.0-rc.3"` (drop `-dev`) in the tag commit
- Browser smoke (item 5) confirms the redesigned Skill Builder + chat right-rail work end-to-end
- `RELEASE_NOTES_rc.3.md` authored (replacing this -dev doc)
- HANDOFF rewritten

Estimated remaining: ~3-4 hours of careful work across rc.3 #4-#7 + tag-time pre-flight verification.
