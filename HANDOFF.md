# Dell Discovery Canvas — Session Handoff

**Last session end**: 2026-05-05. **`v3.0.0-rc.4` TAGGED on `v3.0-data-architecture`**. APP_VERSION = `"3.0.0-rc.4"` (no `-dev` suffix). **Banner 1157/1157 GREEN ✅**.

**State**: rc.4 closed. Group B UX consolidation arc fully shipped (Arcs 1+2+3 reshape Canvas AI Assistant; Arc 4 consolidates skill authoring under Settings → Skills builder pill with v2.4 patterns evolved onto v3 schema). Three production-bug hotfixes from the office demo (overlay flash, local-LLM multi-turn rubbish, test-pass overlay cloak) shipped on top.

**Authority**: SPEC §S0..§S35 · RULES §16 CH1–CH31 · PREFLIGHT.md (8-item checklist) · MEMORY index.

**Not pushed**: per `feedback_no_push_without_approval.md`, the rc.4 tag commit is local only. Origin still on rc.3 tag commit (`d60efbf`); 23 commits ahead locally. User must say "push" / "tag it" / "ship it" to push.

---

## 1 · What just shipped (rc.4 ledger)

Full per-commit detail in `docs/RELEASE_NOTES_rc.4.md`. Per-arc summary:

| Arc | Commits | Theme |
|---|---|---|
| Tag close-out | `e5e9e94` | rc.3 BUG-013/020/023 statuses CLOSED |
| BUG log + APP_VERSION bump | `c8790ce` `06aecc0` | log BUG-024/025; bump APP_VERSION → `3.0.0-rc.4-dev` |
| Group B Arc 1 — window theme | `b0c7b6e` `5893e71` | SPEC §S32 + V-THEME-1..8; renamed "Canvas Chat" → "Canvas AI Assistant" |
| Group B Arc 2 — pills + Cmd+K | `90c6ecb` `68b98c4` | SPEC §S33 (+REVISION); single-pill-with-popover; BUG-025 closed; Local A + Local B |
| Group B Arc 3 — conversational affordances | `1ae60a0` `4263720` `74c7a79` `dda354d` `89f8b55` `c295e5a` | SPEC §S34; thinking-state UX; dynamic try-asking; BUG-024 closed |
| Hotfix #1 — office-demo bugs | `016bbfe` | overlay leak afterRestore + Settings save fix + Clear-chat persists |
| Hotfix #2a — Local B + nginx + absolute-URL | `58a41b5` | nginx 4-upstream; SSE-friendly proxy; absolute `http://<host>:<port>/v1` |
| Hotfix #2b — local-LLM multi-turn correctness | `a8c4b4c` | 4 defensive OpenAI canonical translations in aiService.js |
| Hotfix #3 — BUG-026 test-overlay cloak | `3938458` | `body[data-running-tests]` cloak; visibility:hidden during pass |
| Handover catch-up | `af734b0` | HANDOFF + CHANGELOG_PLAN backfill (drift since rc.2) |
| Group B Arc 4 — Skill Builder consolidation | `ace293a` `2a53be1` `1d31bb7` `8f7a90a` | SPEC §S35 + RULES CH31; evolved SkillBuilder.js (v2.4 patterns + parameters[] + outputTarget + v3 store); legacy migration; opener retired; v3SeedSkills.js DELETED |
| Tag | (this commit) | APP_VERSION drop -dev + RELEASE_NOTES + HANDOFF rewrite + PREFLIGHT 1-8 verified |

**Test deltas**: 1103 (rc.3) → 1157 (rc.4), **+54 net tests**.

**SPEC annexes added**: §S32 + §S33 (+REVISION) + §S34 + §S35.
**RULES added**: §16 CH28 + CH29 + CH30 + CH31.

---

## 2 · Where you are right after rc.4 ships

- **Branch**: `v3.0-data-architecture` · last commit is the rc.4 tag commit · NOT pushed yet (per `feedback_no_push_without_approval.md`).
- **APP_VERSION**: `"3.0.0-rc.4"` in `core/version.js` (matches the tag).
- **Banner**: 1157/1157 GREEN.
- **Working tree**: clean after the tag commit (`.claude/launch.json` is local preview tooling, intentionally untracked).
- **Origin**: `origin/v3.0-data-architecture` is **23 commits BEHIND** local (still on `d60efbf` rc.3 tag commit). `origin/main` on `5614f32` (v2.4.16); `v2.4.17-wip-snapshot` tag preserved.
- **Open BUGs**: BUG-001 + BUG-002 (propagate-criticality, queued rc.5) · BUG-021 perf (queued rc.7) · BUG-022 chat polish (queued rc.5).

---

## 3 · Architecture additions in rc.4

### Canvas AI Assistant (Arcs 1 + 2 + 3)
- **Window theme** (SPEC §S32, RULES CH28): GPLC-aligned light chrome; canonical token set; Inter + JetBrains Mono fonts; surface renamed to "Canvas AI Assistant".
- **Header pills** (SPEC §S33, RULES CH29): single click-to-open provider popover replaces connection-status chip; provider switching via `saveAiConfig`; needs-key routes to Settings. Footer breadcrumb shows latest-turn provenance. Cmd+K rebound to Canvas AI Assistant (BUG-025).
- **Local A + Local B** providers per `LLMs on GB10.docx`: Code LLM (port 8000, hermes tool parser) + VLM (port 8001). nginx routes via `/api/llm/local/` + `/api/llm/local-b/` with `proxy_buffering off; proxy_read_timeout 600s`.
- **Conversational affordances** (SPEC §S34, RULES CH30): typing-dot indicator before first token; per-tool status pill; multi-round badge; provenance slide-in. Dynamic try-asking via `services/tryAskingPrompts.js` (3-bucket mixer + Mulberry32 PRNG). BUG-024 fix (`workflow.<id>` + `concept.<id>` scrub in uuidScrubber).

### vLLM correctness (Hotfix #2a + #2b)
4 defensive OpenAI-canonical translations in `services/aiService.js`: collapse adjacent system messages · `content: ""` for empty assistant turns · tool-result content always stringified · max_tokens 1024 → 4096. Closes "first response accurate, second turn rubbish" issue with local vLLM.

### Skill Builder consolidation (SPEC §S35, RULES CH31)
- One canonical home: `Settings → Skills builder` pill renders evolved admin at `ui/views/SkillBuilder.js`. Chat right-rail "+ Author new skill" routes there via thin opener shim.
- Evolved admin keeps v2.4 patterns (chip palette + Refine-to-CARE + Test button + dual-textbox + save gate) and adds `parameters[]` editor + `outputTarget` radio. Saves to `state/v3SkillStore.js`.
- Legacy v2 records appear under "Legacy skills" section with opt-in per-row Migrate button (uses NEW `migrateV2SkillToV31` helper in `schema/skill.js`).
- `ui/views/SkillAdmin.js` preserved on disk as dormant module per `project_v2x_admin_deferred.md`; tests still import it.
- `core/v3SeedSkills.js` DELETED (test fixtures inlined in `diagnostics/appSpec.js`).
- Standalone `#skillBuilderOverlay` div retired; `ui/skillBuilderOpener.js` becomes thin redirect to Settings.

### Test-pass overlay cloak (Hotfix #3 / BUG-026)
`body[data-running-tests]` attribute toggled by `runAllTests` around `runIsolated`; CSS visibility:hidden on `.overlay` + `.overlay-backdrop` + `#skillBuilderOverlay` while attribute is set; preserves layout/computed styles/click dispatch — only paint pixels disappear.

---

## 4 · What's next (the queue)

| Tag | Theme | Notes |
|---|---|---|
| **rc.5** | UX consolidation arc | **Per `feedback_group_b_spec_rewrite.md`: starts with a SPEC rewrite session capturing user expectations BEFORE any UI code lands.** Scope: window/overlay shape contract refinement, AiAssistOverlay full retirement (Cmd+K already rebound in rc.4 Arc 2), BUG-022 chat polish. May also fold in BUG-001 + BUG-002 propagate-criticality if they fit cleanly. |
| **rc.6** | View migration arc | 5 v2.x view tabs migrated to read via `state/adapter.js`. Foundation for crown-jewel polish. |
| **rc.7** | Crown-jewel polish | Per `project_crown_jewel_design.md` + `project_deferred_design_review.md` (whitespace > drawer IA > icons > tag vocab > color discipline). BUG-021 perf folds in. |
| **rc.8** | Pre-GA hardening | v2.x admin parity-gate decision (`project_v2x_admin_deferred.md`); v3-prefix purge (`feedback_no_version_prefix_in_names.md`); backlog cleanup. |
| **v3.0.0 GA** | Tag | Real workshop run logged + all gates closed. |

---

## 5 · Locked behavioral discipline (memory index)

Non-negotiable, applies to every commit:

- `feedback_spec_and_test_first.md` — SPEC + RULES + V-* tests authored BEFORE implementation. Pre-flight checklist tickets every box at tag time.
- `feedback_test_or_it_didnt_ship.md` — every BUG-NNN fix MUST add a regression test that would have caught the original incident.
- `feedback_no_patches_flag_first.md` — never ship a fix bypassing v3 schema/validation/architecture without explicit user approval BEFORE coding. (Caused §S35 v1 DRAFT rejection 2026-05-04.)
- `feedback_browser_smoke_required.md` — every tag MUST include manual browser smoke against the verification spec via Chrome MCP. (rc.4: smoke via Chrome MCP confirmed evolved admin renders + 1157/1157 GREEN banner.)
- `feedback_test_what_to_test.md` — V-FLOW or it didn't ship; property tests are necessary but never sufficient.
- `feedback_no_push_without_approval.md` — never `git push` without explicit user instruction. Commit locally during work iterations.
- `feedback_no_version_prefix_in_names.md` — version numbers in tags + APP_VERSION + changelogs only; never in filenames, exports, or UI labels. (Drove §S35 v1 rejection + Arc 4 evolved admin's "Skills builder" neutral label + V-NAME-2 / V-ANTI-V3-IN-LABEL-1 source-grep guardrails.)
- `feedback_dockerfile_whitelist.md` — every new top-level dir MUST be added to `Dockerfile` COPY commands in the same commit.
- `feedback_import_collision.md` — alias v3.0 imports during v2↔v3 cutover.
- `feedback_foundational_testing.md` — every data-model change ships with demo refresh + seed-skill update + demoSpec assertion + DEMO_CHANGELOG entry.
- `feedback_naming_standard.md` — AppName-vX.Y.Z naming for committed artifacts.
- `feedback_docs_inline.md` — update CHANGELOG_PLAN + SPEC in the same turn as the code, not as a backfill. (rc.4 caught + closed the rc.2/rc.3/rc.4-dev backfill drift at `af734b0`.)
- `feedback_group_b_spec_rewrite.md` — when work reaches the UX consolidation arc (rc.5), expect intensive SPEC rewrite session BEFORE coding starts.
- `project_v2x_admin_deferred.md` — keep v2.x admin module intact during v3 GA push; removal decision waits until v3 demonstrably covers every v2 admin flow. (Drove rc.4 Arc 4 decision to keep `ui/views/SkillAdmin.js` on disk as dormant module instead of deleting it.)

User-flagged concerns (non-blocking; rc.5 work):
- `project_skillbuilder_ux_concern.md` — partially addressed by Arc 4 (chip palette + Refine-to-CARE + Test button preserved in evolved admin); remaining UX concerns rc.5.
- `project_ui_ux_consolidation_concern.md` — rc.5 scope.

---

## 6 · How a fresh session picks this up

1. Read this `HANDOFF.md` first.
2. Read `MEMORY.md` index + the locked feedback memories.
3. Skim `docs/v3.0/SPEC.md` change log table (find recent annexes — §S32 + §S33 + §S34 + §S35 are the rc.4 additions).
4. Check `docs/RULES.md §16` (CH1–CH31) for hard contracts.
5. Run the Docker container (`docker compose up -d`) and verify the banner is GREEN at 1157/1157.
6. Pick the next arc per `§4 What's next`. **rc.5 expects a SPEC-rewrite session BEFORE code per `feedback_group_b_spec_rewrite.md`.**

---

## 7 · File pointers (post-rc.4)

| Concern | File |
|---|---|
| Active engagement source-of-truth | `state/engagementStore.js` (persists + rehydrates per SPEC §S31) |
| v2 sessionState (legacy) | `state/sessionStore.js` |
| v2→v3 bridge (customer shallow-merge) | `state/sessionBridge.js` |
| v3 engagement schema | `schema/engagement.js` |
| v3 skill schema | `schema/skill.js` (v3.1: parameters[] + outputTarget; NEW `migrateV2SkillToV31` helper at rc.4) |
| v3 demo engagement | `core/demoEngagement.js` |
| Data contract (LLM grounding) | `core/dataContract.js` |
| Concept dictionary | `core/conceptManifest.js` |
| App workflow manifest | `core/appManifest.js` |
| Chat orchestration | `services/chatService.js` |
| System prompt assembly | `services/systemPromptAssembler.js` |
| Tool registry | `services/chatTools.js` |
| Generic LLM connector | `services/aiService.js` (Hotfix #2b defensive translations) |
| Real provider | `services/realChatProvider.js` |
| Mock provider | `services/mockChatProvider.js` |
| Handshake regex + strip | `services/chatHandshake.js` |
| UUID + workflow + concept scrub | `services/uuidScrubber.js` |
| Try-asking prompt mixer | `services/tryAskingPrompts.js` (rc.4 Arc 3b) |
| Skill runner | `services/skillRunner.js` |
| Skill output schemas | `services/skillOutputSchemas.js` |
| Skill save validator | `services/skillSaveValidator.js` |
| Manifest generator | `services/manifestGenerator.js` |
| Path resolver | `services/pathResolver.js` |
| **Evolved Skill Builder UI** | `ui/views/SkillBuilder.js` (rc.4 Arc 4 — replaces lean rc.3 builder) |
| Dormant v2 admin module | `ui/views/SkillAdmin.js` (no longer mounted; preserved per `project_v2x_admin_deferred.md`) |
| Skill Builder opener (thin redirect) | `ui/skillBuilderOpener.js` (rc.4 Arc 4b — overlay retired) |
| Canvas AI Assistant overlay | `ui/views/CanvasChatOverlay.js` (rc.4 Arc 1+2+3 — pills + thinking-state + try-asking + theme) |
| AI Assist legacy overlay | `ui/views/AiAssistOverlay.js` (Cmd+K rebound away — full retirement scheduled rc.5) |
| Settings modal | `ui/views/SettingsModal.js` (Local B + Skills builder pill mounts evolved admin) |
| AI provider config | `core/aiConfig.js` (Local A + Local B) |
| nginx LLM proxy | `docker-entrypoint.d/45-setup-llm-proxy.sh` (4 upstreams) |
| App-shell stylesheet | `styles.css` (window theme tokens; BUG-026 cloak rule) |
| Skills storage (v3.1) | `state/v3SkillStore.js` |
| Diagnostic suite | `diagnostics/appSpec.js` (1157 tests) |
| Test runner | `diagnostics/testRunner.js` (BUG-026 cloak attribute toggle in `runAllTests`) |
| BUG log | `docs/BUG_LOG.md` |
| Pre-flight checklist | `docs/PREFLIGHT.md` |
| SPEC | `docs/v3.0/SPEC.md` (through §S35 LOCKED) |
| RULES | `docs/RULES.md` (CH1–CH31) |
| Release notes (latest) | `docs/RELEASE_NOTES_rc.4.md` |
| GB10 vLLM setup reference | `LLMs on GB10.docx` |
| GPLC visual reference | `C:/Users/Mahmo/Downloads/GPLC Digital Unified Platform v1.0.html` |

---

## 8 · Push checklist (when user says "push" / "tag it" / "ship it")

```bash
git push -u origin v3.0-data-architecture
git tag v3.0.0-rc.4
git push origin v3.0.0-rc.4
```

Verify on GitHub: branch `v3.0-data-architecture` carries the rc.4 tag commit; `v3.0.0-rc.4` tag exists; `origin/main` still on `5614f32` (v2.4.16, untouched); rc.3 tag still on `d60efbf`.
