# Dell Discovery Canvas — Session Handoff

**Last session end**: 2026-05-04 (late). **Branch**: `v3.0-data-architecture` · **HEAD**: `3938458` · **APP_VERSION**: `"3.0.0-rc.4-dev"` · **Banner 1140/1140 GREEN ✅**.

**State**: rc.4-dev is mid-arc. Group B Arcs 1 + 2 + 3 SHIPPED (window-theme + provider pills + conversational affordances). Three hotfix waves SHIPPED on top (#1 office-demo bugs · #2a Local B + nginx · #2b multi-turn local-LLM hardening · #3 BUG-026 test-overlay cloak). **Arc 4 (Skill Builder consolidation) is BLOCKED** — SPEC §S35 DRAFT REJECTED 2026-05-04 because R35.1 used a "Skills (v3)" UI label, violating `feedback_no_version_prefix_in_names.md`. Arc 4 must restart from a fresh SPEC §S35 once the user picks Option A / B / C below.

**Authority**: SPEC §S0..§S34 (LOCKED) + §S35 (DRAFT REJECTED, awaiting rewrite) · RULES §16 CH1–CH30 · PREFLIGHT.md (8-item checklist) · MEMORY index.

**Not pushed**: per `feedback_no_push_without_approval.md`, every rc.4-dev commit is local only. Origin still on the rc.3 tag commit (`d60efbf`). User must say "push" / "tag it" / "ship it" to push.

---

## 1 · What just shipped (rc.4-dev ledger)

19 commits since the rc.3 tag (`d60efbf` · 2026-05-03). Per-arc summary:

| Arc | Commits | Theme |
|---|---|---|
| Tag close-out | `e5e9e94` | rc.3 tag-time log close-out (BUG-013/020/023 statuses flipped CLOSED) |
| BUG-024/025 log + APP_VERSION bump | `c8790ce` `06aecc0` | Log new BUG entries from rc.3 demo + APP_VERSION → `3.0.0-rc.4-dev` per PREFLIGHT 1a |
| **Group B Arc 1 — window theme** | `b0c7b6e` `5893e71` | SPEC §S32 LOCKED + V-THEME-1..8 GREEN (1111/1111). Renamed "Canvas Chat" → "Canvas AI Assistant"; tokens align with GPLC sample HTML. |
| **Group B Arc 2 — pills + Cmd+K** | `90c6ecb` `68b98c4` | SPEC §S33 LOCKED + V-PILLS-1..4 + V-FOOTER-CRUMB-1 + V-CMD-K-CANVAS-1 GREEN. Cmd+K rebound to Canvas AI Assistant (BUG-025). REVISION at `68b98c4` — single-pill-with-popover provider switcher (was per-provider row, didn't scale); footer Done retired; head-extras buttons aligned to GPLC ghost styling; Local B added (Local relabeled "Local A"). 1117/1117 GREEN. |
| **Group B Arc 3 — conversational affordances** | `1ae60a0` `4263720` `74c7a79` `dda354d` `89f8b55` `c295e5a` | SPEC §S34 LOCKED + V-THINK-1..5 + V-TRY-ASK-1..4 + V-SCRUB-WORKFLOW-1..3 GREEN. Three sub-arcs: 3a thinking-state UX (`74c7a79`) · 3b dynamic try-asking prompts (`dda354d`) · 3c BUG-024 fix (`89f8b55` — workflow.id + concept.id scrub + role-section directive). 1129/1129 GREEN. |
| **Group B Arc 4 — Skill Builder consolidation** | `165dc03` `fa85ca8` | DRAFT then REJECTED. Awaiting Option A/B/C decision. NO impl shipped. |
| **Hotfix #1** | `016bbfe` | 3 office-demo bugs: multiple-overlay leak afterRestore sweep · Settings save flaky during 90ms cross-fade · Clear-chat closing chat overlay (replaced confirmAction with inline confirm). 1132/1132 GREEN. |
| **Hotfix #2a** | `58a41b5` | nginx Local B proxy (port 8001 per `LLMs on GB10.docx`) · absolute-URL `http://<host>:<port>/v1` Settings flow · streaming-friendly `proxy_buffering off; proxy_read_timeout 600s` on all 4 LLM proxy locations. 1134/1134 GREEN. |
| **Hotfix #2b** | `a8c4b4c` | 4 defensive OpenAI-canonical translations in `services/aiService.js` for multi-turn local-vLLM correctness: consolidate adjacent system messages · empty assistant content as `""` (not null) · tool result content always string · max_tokens 1024 → 4096. V-PROVIDER E2E tests added. 1139/1139 GREEN. |
| **Hotfix #3** | `3938458` (HEAD) | BUG-026 fix · `body[data-running-tests]` cloak hides overlays during test pass on slow hardware (visibility:hidden preserves layout/computed styles/click dispatch — only paint pixels disappear). V-NO-VISIBLE-TEST-OVERLAY-1 added in §T35-HOTFIX1. 100-frame smoke confirmed 0 visible overlays during the pass. 1140/1140 GREEN. |

**Test deltas**: 1103 (rc.3) → 1140 (HEAD), **+37 net tests**.
**SPEC annexes added**: §S32 + §S33 (incl. REVISION) + §S34. §S35 DRAFT REJECTED.
**RULES added**: §16 CH28 (window theme) + CH29 (pills + breadcrumb + Cmd+K) + CH30 (conversational affordances).

---

## 2 · Where you are right after Hotfix #3 ships

- **Branch**: `v3.0-data-architecture` · last commit `3938458` (BUG-026 fix) · NOT pushed.
- **APP_VERSION**: `"3.0.0-rc.4-dev"` (in `core/version.js`).
- **Banner**: 1140/1140 GREEN.
- **Working tree**: clean (`.claude/launch.json` is local preview tooling, intentionally untracked).
- **Origin**: `origin/v3.0-data-architecture` is **19 commits BEHIND** local (still on `d60efbf` rc.3 tag commit). `origin/main` on `5614f32` (v2.4.16); `v2.4.17-wip-snapshot` tag preserved.
- **Open BUGs**: BUG-001 + BUG-002 (propagate-criticality, queued for rc.4 AI correctness round 2) · BUG-021 perf (queued for rc.7 crown-jewel) · BUG-022 chat polish (queued for rc.5 UX consolidation) · BUG-025 (Cmd+K) **CLOSED** in Arc 2 · BUG-024 (workflow/concept ID leak) **CLOSED** in Arc 3c · BUG-026 (test-overlay flash) **CLOSED** in Hotfix #3.

---

## 3 · Architecture additions in rc.4-dev (on top of §3 from rc.3)

### Canvas AI Assistant window theme (Arc 1)
- Renamed surface from "Canvas Chat" to "Canvas AI Assistant" everywhere user-facing.
- Visual tokens align with `C:/Users/Mahmo/Downloads/GPLC Digital Unified Platform v1.0.html` reference (whitespace, --canvas-soft, --rule, --ink, 3px/5px/8px radii, Inter + JetBrains Mono).
- See SPEC §S32 R32.1–R32.14, RULES §16 CH28, V-THEME-1..8.

### Header pills + footer breadcrumb + Cmd+K (Arc 2 + REVISION)
- **Header**: single provider pill with click-to-open popover (replaces connection-status chip; popover lists all providers with ready/needs-key dots; click switches active provider).
- **Footer breadcrumb**: shows latest-turn provenance (model · provider · token usage). Empty before first turn.
- **Cmd+K / Ctrl+K** now opens Canvas AI Assistant (was legacy AiAssistOverlay, BUG-025).
- **Local B provider** added per `LLMs on GB10.docx`: Local A (port 8000, Code LLM with `--tool-call-parser hermes`), Local B (port 8001, VLM). Both routed via nginx (`/api/llm/local/` + `/api/llm/local-b/`). Settings accepts absolute-URL form (`http://<host>:<port>/v1`).
- See SPEC §S33 + REVISION row, RULES §16 CH29, V-PILLS-1..4 + V-FOOTER-CRUMB-1 + V-CMD-K-CANVAS-1.

### Conversational affordances (Arc 3)
- **Thinking state**: typing-dot indicator before first token; per-tool status pill during tool-use rounds (TOOL_STATUS_MESSAGES map maps tool name → human-readable label); multi-round badge when chains exceed 1 round.
- **Dynamic try-asking prompts**: `services/tryAskingPrompts.js` 3-bucket mixer (1 how-to + 2 insight + 1 showoff = 4 prompts). Mulberry32 PRNG seeded per session for stable-during-session, fresh-on-reload behavior. Empty-engagement fallback to FALLBACK_PROMPTS.
- **BUG-024 fix**: `services/uuidScrubber.js` extended to scrub `workflow.<id>` + `concept.<id>` identifiers. `buildManifestLabelMap()` resolves to workflow `name` / concept `label`. Defense-in-depth: also a "NEVER emit" directive in role section of system prompt.
- See SPEC §S34, RULES §16 CH30, V-THINK-1..5 + V-TRY-ASK-1..4 + V-SCRUB-WORKFLOW-1..3.

### vLLM correctness (Hotfix #2a + #2b)
- nginx proxy: 4 LLM upstream blocks (anthropic / gemini / local A / local B), all with `proxy_buffering off; proxy_read_timeout 600s` for SSE streaming.
- `services/aiService.js` defensive OpenAI canonical: collapse adjacent system messages (some local vLLMs reject multiple `role:"system"` entries) · `content: ""` for empty assistant turns (null fails Mistral-style strict validators) · tool-result content always stringified · max_tokens 1024 → 4096 (lifts the truncation that was making 2nd+ turns return rubbish).

### Test-pass overlay cloak (Hotfix #3 / BUG-026)
- `body[data-running-tests]` attribute toggled by `runAllTests` around the `runIsolated` call.
- CSS rule in `styles.css`: `body[data-running-tests] .overlay-backdrop, body[data-running-tests] .overlay, body[data-running-tests] #skillBuilderOverlay { visibility: hidden !important; pointer-events: none !important; }`
- visibility:hidden preserves layout + computed styles + getBoundingClientRect + `.click()` + querySelector — tests keep working, only paint pixels disappear.
- Attribute cleared in `afterRestore` AFTER the overlay sweep (order matters: clearing first would flash an orphan visible).

---

## 4 · What's next (the queue)

**Immediate blocker — Group B Arc 4 (Skill Builder consolidation).** SPEC §S35 DRAFT REJECTED. Three options on the table; user pick required before any code:

| Option | Description | Trade-off |
|---|---|---|
| **A** | Retire v2.x admin entirely. One Skill Builder, neutrally labeled. | Cleanest. Gated by `project_v2x_admin_deferred.md` parity check (does v3 cover every v2 admin flow?). Probably not yet. |
| **B** | Replace the existing v2 Skills... pill content with the new v3 builder UI. Same pill, different inside. Neutral label ("Skill Builder" or similar), no v3 in name. | Most likely path. Avoids Option A's parity gate. Builder writes to v3 store; v2 surfaces fall back to v2 store. |
| **C** | Backend-agnostic builder. Reads + writes whichever store the open engagement uses. v2→v3 migrate-on-read. | Most flexible but most engineering. Probably not the right call given v2-retirement is the long-term goal. |

User direction recorded in prior session: *"keep v2.4 SkillAdmin base + add parameters[] additions, save to v3 store"* — that maps closest to Option B.

After Arc 4 lands:
- **rc.4 tag**: PREFLIGHT 1-8 + RELEASE_NOTES_rc.4.md + this HANDOFF.md rewrite.
- **rc.5** (UX consolidation): per `feedback_group_b_spec_rewrite.md`, **starts with a SPEC rewrite session** capturing user expectations BEFORE any UI code lands. Scope: window/overlay shape contract, broader UI/UX consistency, AiAssistOverlay full retirement. BUG-022 chat polish folds in.
- **rc.6** (view migration): 5 v2.x tabs migrated to read via `state/adapter.js`.
- **rc.7** (crown-jewel polish): per `project_crown_jewel_design.md` + `project_deferred_design_review.md`. BUG-021 perf folds in.
- **rc.8** (pre-GA hardening): v2.x AI admin parity-gate decision (`project_v2x_admin_deferred.md`); v3-prefix purge (`feedback_no_version_prefix_in_names.md`); backlog cleanup.
- **v3.0.0 GA**: real workshop run logged + all gates closed.

---

## 5 · Locked behavioral discipline (memory index)

Non-negotiable, applies to every commit:

- `feedback_spec_and_test_first.md` — every release sequences spec → tests → code → verify. SPEC + RULES + V-* test contract authored BEFORE implementation. **Pre-flight checklist tickets every box at tag time.**
- `feedback_test_or_it_didnt_ship.md` — every BUG-NNN fix MUST add a regression test that would have caught the original incident.
- `feedback_no_patches_flag_first.md` — never ship a fix that bypasses v3 schema/validation/architecture without explicit user approval BEFORE coding.
- `feedback_browser_smoke_required.md` — every tag MUST include a manual browser smoke against the verification spec via Chrome MCP.
- `feedback_test_what_to_test.md` — V-FLOW or it didn't ship; property tests are necessary but never sufficient.
- `feedback_no_push_without_approval.md` — never `git push` without explicit user instruction. Commit locally during work iterations.
- `feedback_no_version_prefix_in_names.md` — version numbers live in git tags + APP_VERSION + changelogs only; never in filenames, exports, or UI labels. **Caused §S35 DRAFT rejection.**
- `feedback_dockerfile_whitelist.md` — every new top-level dir MUST be added to `Dockerfile` COPY commands in the same commit.
- `feedback_import_collision.md` — alias v3.0 imports during v2↔v3 cutover to avoid `SyntaxError: Identifier already declared`.
- `feedback_foundational_testing.md` — every data-model change ships with demo refresh + seed-skill update + demoSpec assertion + DEMO_CHANGELOG entry.
- `feedback_naming_standard.md` — AppName-vX.Y.Z naming for committed artifacts; no role labels or casual placeholders.
- `feedback_docs_inline.md` — update CHANGELOG_PLAN + SPEC in the same turn as the code, not as a backfill. **Drift identified 2026-05-04: rc.2/rc.3/rc.4-dev sections were missing from CHANGELOG_PLAN; backfilled in this commit.**
- `feedback_group_b_spec_rewrite.md` — when work reaches the UX consolidation arc (rc.5), expect intensive SPEC rewrite session BEFORE coding starts.

User-flagged concerns (non-blocking; rc.5 work):
- `project_skillbuilder_ux_concern.md` — Lab-tab Skill Builder unintuitive
- `project_ui_ux_consolidation_concern.md` — broader UI/UX + window inconsistency

---

## 6 · How a fresh session picks this up

1. Read this `HANDOFF.md` first.
2. Read `MEMORY.md` index + the locked feedback memories.
3. Skim `docs/v3.0/SPEC.md` change log table (find recent additions — §S32 + §S33 + §S34 are the rc.4-dev annexes; §S35 is REJECTED).
4. Check `docs/RULES.md §16` (CH1–CH30) for hard contracts.
5. Run the Docker container (`docker compose up -d`) and verify the banner is GREEN at 1140/1140.
6. Decide Arc 4 (Option A/B/C) with the user before any Skill Builder code. After Arc 4 lands, drive rc.4 tag per PREFLIGHT 1-8.

---

## 7 · File pointers (post-rc.4-dev hotfix #3)

| Concern | File |
|---|---|
| Active engagement source-of-truth | `state/engagementStore.js` (persists + rehydrates per SPEC §S31) |
| v2 sessionState (legacy) | `state/sessionStore.js` (still authoritative for v2.x view tabs) |
| v2→v3 bridge (customer shallow-merge) | `state/sessionBridge.js` |
| v3 engagement schema | `schema/engagement.js` |
| v3 skill schema | `schema/skill.js` (v3.1: parameters[] + outputTarget) |
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
| UUID + workflow + concept scrub | `services/uuidScrubber.js` (Arc 3c BUG-024 extension) |
| Try-asking prompt mixer | `services/tryAskingPrompts.js` (Arc 3b NEW) |
| Skill runner | `services/skillRunner.js` |
| Skill output schemas | `services/skillOutputSchemas.js` |
| Skill save validator | `services/skillSaveValidator.js` |
| Manifest generator | `services/manifestGenerator.js` |
| Path resolver | `services/pathResolver.js` |
| Skill Builder UI (v3.1) | `ui/views/SkillBuilder.js` (Arc 4 will rewrite/relocate) |
| Skill Builder opener (shared) | `ui/skillBuilderOpener.js` |
| Canvas AI Assistant overlay | `ui/views/CanvasChatOverlay.js` (renamed surface; pills + thinking + try-asking) |
| AI Assist legacy overlay | `ui/views/AiAssistOverlay.js` (Cmd+K rebound away — full retirement scheduled rc.5) |
| Settings modal | `ui/views/SettingsModal.js` (Local B + absolute-URL flow per Hotfix #2a) |
| AI provider config | `core/aiConfig.js` (Local A + Local B) |
| nginx LLM proxy | `docker-entrypoint.d/45-setup-llm-proxy.sh` (4 upstreams) |
| App-shell stylesheet | `styles.css` (window theme tokens; BUG-026 cloak rule) |
| Skills storage (v3.1) | `state/v3SkillStore.js` |
| Diagnostic suite | `diagnostics/appSpec.js` (1140 tests) |
| Test runner | `diagnostics/testRunner.js` (BUG-026 cloak attribute toggle in `runAllTests`) |
| BUG log | `docs/BUG_LOG.md` |
| Pre-flight checklist | `docs/PREFLIGHT.md` |
| SPEC | `docs/v3.0/SPEC.md` (through §S34 LOCKED; §S35 REJECTED) |
| RULES | `docs/RULES.md` (CH1–CH30) |
| Release notes (rc.3) | `docs/RELEASE_NOTES_rc.3.md` (rc.4 will be authored at tag time) |
| GB10 vLLM setup reference | `LLMs on GB10.docx` (Code LLM port 8000 + VLM port 8001) |
| GPLC visual reference | `C:/Users/Mahmo/Downloads/GPLC Digital Unified Platform v1.0.html` |

---

## 8 · Push checklist (when user says "push" / "tag it" / "ship it")

When tagging rc.4 (after Arc 4 ships):

```bash
# 1. Verify PREFLIGHT 1-8
# 2. Bump APP_VERSION 3.0.0-rc.4-dev → 3.0.0-rc.4 in same commit as tag
# 3. Author docs/RELEASE_NOTES_rc.4.md
# 4. Rewrite this HANDOFF.md to "rc.4 closed" state
# 5. Then:

git push -u origin v3.0-data-architecture
git tag v3.0.0-rc.4
git push origin v3.0.0-rc.4
```

For just pushing the local rc.4-dev branch state without tagging:

```bash
git push origin v3.0-data-architecture
```

Verify on GitHub: branch `v3.0-data-architecture` carries the new commits; `v3.0.0-rc.3` tag still on `d60efbf`; `origin/main` still on `5614f32`.
