# Dell Discovery Canvas · v3.0.0-rc.4 · Release Notes

**Tagged**: 2026-05-05 · **Branch**: `v3.0-data-architecture` · **APP_VERSION**: `"3.0.0-rc.4"` · **Banner**: 1157/1157 GREEN ✅

**Theme**: closing the Group B UX consolidation arc. Arcs 1+2+3 reshape the Canvas AI Assistant; Arc 4 consolidates skill authoring under a single Settings pill with the v2.4 SkillAdmin patterns evolved onto the v3 schema. Plus three production-bug hotfixes from the office demo (multi-overlay leak · local-LLM multi-turn rubbish · test-pass overlay flash).

Authoritative artifacts:
- SPEC: `docs/v3.0/SPEC.md` §S0..§S35 (LOCKED)
- RULES: `docs/RULES.md` §16 CH1..CH31
- PREFLIGHT: `docs/PREFLIGHT.md` (8-item gate)
- HANDOFF: `HANDOFF.md` (rewritten at this tag)

---

## 1 · Per-arc ledger (rc.3 → rc.4)

22 commits since `v3.0.0-rc.3` (`d60efbf` · 2026-05-03):

| Phase | Commits | Theme | Banner |
|---|---|---|---|
| Tag close-out | `e5e9e94` | rc.3 BUG-013/020/023 statuses flipped CLOSED | 1103/1103 |
| BUG log + APP_VERSION bump | `c8790ce` `06aecc0` | log BUG-024/025; bump APP_VERSION → `3.0.0-rc.4-dev` per PREFLIGHT 1a | — |
| **Group B Arc 1** — window theme (SPEC §S32) | `b0c7b6e` (DRAFT) `5893e71` (impl + LOCK) | Renamed surface "Canvas Chat" → "Canvas AI Assistant"; tokens align with GPLC reference; V-THEME-1..8; RULES CH28 | 1111/1111 |
| **Group B Arc 2** — header pills + footer breadcrumb + Cmd+K (SPEC §S33 + REVISION) | `90c6ecb` (initial) `68b98c4` (REVISION) | Single-pill-with-popover provider switcher; footer breadcrumb provenance; Cmd+K rebound (BUG-025 closed); Local A + Local B per `LLMs on GB10.docx`; head-extras chrome aligned to GPLC ghost styling; V-PILLS-1..4 + V-FOOTER-CRUMB-1 + V-CMD-K-CANVAS-1; RULES CH29 | 1117/1117 |
| **Group B Arc 3** — conversational affordances (SPEC §S34) | `1ae60a0` `4263720` `74c7a79` `dda354d` `89f8b55` `c295e5a` | Thinking-state UX (typing dots / tool-status pill / round badge / provenance slide-in) · dynamic try-asking 3-bucket mixer · BUG-024 fix (workflow.<id> + concept.<id> scrub) · V-THINK-1..5 + V-TRY-ASK-1..4 + V-SCRUB-WORKFLOW-1..3; RULES CH30 | 1129/1129 |
| **Hotfix #1** — 3 office-demo bugs | `016bbfe` | Multi-overlay leak (afterRestore sweep) · Settings save flaky during 90ms cross-fade (scope to settings panel) · Clear-chat closing chat overlay (replaced confirmAction with inline confirm); V-NO-STRAY-OVERLAY-1 + V-CLEAR-CHAT-PERSISTS + V-SETTINGS-SAVE-1 in §T35-HOTFIX1 | 1132/1132 |
| **Hotfix #2a** — Local B + nginx + absolute-URL Settings flow | `58a41b5` | nginx LLM proxy block extended (anthropic / gemini / local A 8000 / local B 8001) with `proxy_buffering off; proxy_read_timeout 600s` for SSE; absolute-URL `http://<host>:<port>/v1` form per user direction; V-PROXY-LOCAL-B-1 + V-PROVIDER-HINTS-1 | 1134/1134 |
| **Hotfix #2b** — local-LLM multi-turn correctness | `a8c4b4c` | 4 defensive OpenAI-canonical translations in `services/aiService.js` (collapse adjacent system messages; empty assistant content as `""`; tool result content always stringified; max_tokens 1024 → 4096); V-PROVIDER-OPENAI-1..5 | 1139/1139 |
| **Hotfix #3** — BUG-026 test-overlay cloak | `3938458` | `body[data-running-tests]` attribute toggled by `runAllTests`; CSS visibility:hidden on overlays during pass; preserves layout/computed styles/click dispatch; V-NO-VISIBLE-TEST-OVERLAY-1; 100-frame smoke confirmed 0 visible overlays | 1140/1140 |
| Handover catch-up | `af734b0` | HANDOFF.md rewrite (was stale at rc.3); CHANGELOG_PLAN backfill (rc.2/rc.3/rc.4-dev sections were missing); SPEC change-log rows for 4 hotfixes per PREFLIGHT 2 | 1140/1140 |
| **Group B Arc 4** — Skill Builder consolidation (SPEC §S35) | `ace293a` (DRAFT v2) `2a53be1` (LOCK + RULES CH31 + helper + RED tests) `1d31bb7` (4a impl) `8f7a90a` (4b retirement + purge) | Settings → "Skills builder" pill is the SINGLE entry point; pill renders evolved admin at `ui/views/SkillBuilder.js` (preserves v2.4 patterns: chip palette + Refine-to-CARE + Test button) + adds parameters[] editor + outputTarget radio (4 options, 3 disabled with "deferred to GA") + saves to `state/v3SkillStore.js`; legacy v2 records appear under "Legacy skills" section with opt-in per-row Migrate button; standalone `#skillBuilderOverlay` div retired (opener becomes thin redirect to Settings); `core/v3SeedSkills.js` DELETED (test fixtures inlined); v2 admin module preserved on disk as dormant per `project_v2x_admin_deferred.md`; V-SKILL-V3-8..15 + V-MIGRATE-V2-V3-1..4 + V-ANTI-V3-IN-LABEL-1 + V-ANTI-V3-SEED-1..3 + V-ANTI-OVERLAY-RETIRED-1; RULES CH31 | 1157/1157 |
| **Tag** | (this commit) | APP_VERSION drops -dev; SPEC + RULES + PREFLIGHT 1-8 verified; HANDOFF rewritten; this RELEASE_NOTES authored | 1157/1157 |

**Test deltas**: 1103 (rc.3) → 1157 (rc.4), **+54 net tests**.
**SPEC annexes added**: §S32 + §S33 (with REVISION) + §S34 + §S35.
**RULES added**: §16 CH28 + CH29 + CH30 + CH31.

---

## 2 · BUG status snapshot at tag

**Closed in rc.4**:
- BUG-024 (workflow.<id> / concept.<id> leak in chat prose) — closed at `89f8b55` via uuidScrubber extension + role-section directive
- BUG-025 (Cmd+K opens legacy AiAssistOverlay) — closed at `90c6ecb` via Cmd+K rebind to Canvas AI Assistant
- BUG-026 (test-pass overlays flash on slow hardware) — closed at `3938458` via `body[data-running-tests]` cloak

**Closed in rc.3** (status flips landed in rc.4 close-out commit `e5e9e94`):
- BUG-013 (Path B UUID scrub) · BUG-018 (provider correctness regression guard) · BUG-019 (engagement rehydrate) · BUG-020 (handshake silent-strip) · BUG-023 (gapPathManifest layerId)

**Still open**:
- BUG-001 + BUG-002 (propagate-criticality toast text + dispatchability) — queued for rc.5 AI correctness round 2
- BUG-021 (perf) — queued for rc.7 crown-jewel polish
- BUG-022 (chat polish) — queued for rc.5 UX consolidation

---

## 3 · Architecture additions

### Canvas AI Assistant (Arcs 1 + 2 + 3)
- **Window theme**: GPLC-aligned light chrome (canonical token set `--canvas` / `--canvas-soft` / `--rule` / `--ink` / `--dell-blue` / `--shadow-lg` / `--radius-lg`); dark "AI working area" preserved on transcript scroll + prompt input; Inter + JetBrains Mono fonts.
- **Header pills**: single click-to-open provider popover (replaces connection-status chip); provider switching via `saveAiConfig`; needs-key providers route to Settings.
- **Footer breadcrumb**: `<provider> · <model> · <N> tokens · <ms>ms` provenance after every assistant turn; empty before first turn.
- **Cmd+K**: opens Canvas AI Assistant (was legacy AiAssistOverlay; full retirement scheduled rc.5).
- **Thinking-state UX**: typing-dot indicator before first token; per-tool status pill (`TOOL_STATUS_MESSAGES` map); multi-round badge for chains > 1 round; provenance slide-in on `onComplete`.
- **Dynamic try-asking prompts**: `services/tryAskingPrompts.js` 3-bucket mixer (1 how-to + 2 insight + 1 showoff = 4 prompts); engagement-aware; deterministic per-overlay-open via Mulberry32 PRNG.
- **Local A + Local B providers**: per `LLMs on GB10.docx` — Code LLM (port 8000, `--tool-call-parser hermes`) + VLM (port 8001). nginx routes via `/api/llm/local/` + `/api/llm/local-b/`. SSE streaming with `proxy_buffering off; proxy_read_timeout 600s`.

### vLLM correctness (Hotfix #2a + #2b)
4 defensive OpenAI-canonical translations in `services/aiService.js` resolve the user-reported "first response accurate, second turn rubbish" against local vLLM:
1. Consolidate adjacent `role:"system"` messages into ONE.
2. Empty assistant content emitted as `""` not `null`.
3. Tool-result content always stringified.
4. `max_tokens` raised 1024 → 4096.

### Skill Builder consolidation (Arc 4)
- **One canonical home**: `Settings → Skills builder` pill renders the evolved admin at `ui/views/SkillBuilder.js`. Chat right-rail "+ Author new skill" → opener shim → Settings.
- **Evolved admin** keeps v2.4 patterns (list + deploy toggle + edit form + chip palette + Refine-to-CARE + dual-textbox preview + Test button + save gate) and adds:
  - `parameters[]` editor (rows: name + type + description + required)
  - `outputTarget` radio (4 options; only `chat-bubble` enabled, others "deferred to GA")
  - Saves to `state/v3SkillStore.js` (v3.1 schema) — v2 store now read-only legacy.
- **Legacy migration**: opt-in "Legacy skills" section with per-row Migrate button → `migrateV2SkillToV31` helper (NEW in `schema/skill.js`) translates `name → label`, `responseFormat → outputContract`, drops `tab` / `applyPolicy` / `deployed` / `outputSchema` to `_droppedFromV2` audit field.
- **`core/v3SeedSkills.js` DELETED**: 3 production seed exports retired; test fixtures inlined in `diagnostics/appSpec.js`.
- **`ui/views/SkillAdmin.js`**: dormant on disk (no longer mounted) per `project_v2x_admin_deferred.md` — preserves rc.3-era test imports until v2-admin retirement arc.
- **`ui/skillBuilderOpener.js`**: rewritten as thin redirect; no longer creates `#skillBuilderOverlay` div.

### Test-pass overlay cloak (Hotfix #3)
- `body[data-running-tests]` attribute toggled by `runAllTests` around `runIsolated`.
- CSS rule applies `visibility: hidden !important; pointer-events: none !important` to `.overlay`, `.overlay-backdrop`, `#skillBuilderOverlay` while attribute is set.
- visibility:hidden preserves layout, computed styles, getBoundingClientRect, .click() dispatch, querySelector — only paint pixels disappear.
- Attribute cleared in `afterRestore` AFTER overlay sweep (order matters — clearing first would flash an orphan visible).

---

## 4 · PREFLIGHT 1-8 at tag time

| # | Item | Status |
|---|---|---|
| 1a | First commit past rc.3 bumped APP_VERSION → `3.0.0-rc.4-dev` (`06aecc0`) | ✅ |
| 1b | At tag: APP_VERSION = `3.0.0-rc.4` (this commit) | ✅ |
| 2 | SPEC §9 + §S32 + §S33 (incl. REVISION) + §S34 + §S35 LOCKED + change-log rows for 4 hotfixes | ✅ |
| 3 | RULES §16 CH28 + CH29 + CH30 + CH31 added | ✅ |
| 4 | V-* tests RED-first → GREEN: V-THEME-1..8 + V-PILLS-1..4 + V-FOOTER-CRUMB-1 + V-CMD-K-CANVAS-1 + V-THINK-1..5 + V-TRY-ASK-1..4 + V-SCRUB-WORKFLOW-1..3 + V-NO-VISIBLE-TEST-OVERLAY-1 + V-PROVIDER-OPENAI-1..5 + V-PROXY-LOCAL-B-1 + V-PROVIDER-HINTS-1 + V-SKILL-V3-8..15 + V-MIGRATE-V2-V3-1..4 + V-ANTI-V3-IN-LABEL-1 + V-ANTI-V3-SEED-1..3 + V-ANTI-OVERLAY-RETIRED-1 | ✅ |
| 5 | Browser smoke against Acme Healthcare demo via Chrome MCP — pending final verification at this tag commit | ⏳ |
| 6 | `docs/RELEASE_NOTES_rc.4.md` authored (this file) | ✅ |
| 7 | `HANDOFF.md` rewritten | ⏳ (this commit) |
| 8 | Banner 1157/1157 GREEN | ✅ |

---

## 5 · Known issues / deferred

- **Real-Anthropic / Real-Gemini / Real-Local live-key smoke**: deferred to user-driven workshop run. V-PROVIDER-OPENAI-1..5 + V-CHAT-27..32 (mock) cover the protocol layer.
- **Legacy AiAssistOverlay full retirement**: scheduled rc.5 (per HANDOFF.md §4). Cmd+K rebind in Arc 2 was the first half; full retirement waits for the broader UX consolidation arc per `feedback_group_b_spec_rewrite.md`.
- **v2 admin module retirement**: `ui/views/SkillAdmin.js` stays on disk per `project_v2x_admin_deferred.md`. Removal decision waits until v3 demonstrably covers every v2 admin flow.
- **rc.3-era V-SKILL-V3-5..7**: V-SKILL-V3-5 was rescoped at rc.4-dev `1d31bb7` to v3.1 schema-discipline only (chip-palette removal assertion was inverted by CH31). Detailed surface contracts moved to §T36 V-SKILL-V3-8..15.

---

## 6 · Push checklist

When the user says "push" / "tag it" / "ship it":

```bash
git push -u origin v3.0-data-architecture
git tag v3.0.0-rc.4
git push origin v3.0.0-rc.4
```

Verify on GitHub: branch `v3.0-data-architecture` carries the rc.4 tag commit; `v3.0.0-rc.4` tag exists; `origin/main` still on `5614f32` (v2.4.16, untouched).

Per `feedback_no_push_without_approval.md`, this tag is committed locally only until explicit push instruction.
