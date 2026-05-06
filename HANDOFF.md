# Dell Discovery Canvas — Session Handoff

**Last session end**: 2026-05-06 · **`v3.0.0-rc.6` TAGGED locally** (`v3.0-data-architecture` HEAD = this commit). APP_VERSION = `"3.0.0-rc.6"`. **Banner 1187/1187 GREEN at tag**.

**STATE**: rc.6 closes the workshop-bug arc surfaced 2026-05-05. Six of seven workshop bugs (BUG-029, 030, 031, 033, 034, 035) closed with regression tests; BUG-032 deferred to rc.6.1/rc.7 pending user-side repro. Centerpiece is the **grounding contract recast** (SPEC §S37): RAG-by-construction architecture replaces the count-based threshold + LLM-decides-to-ground hope. Two locked memories ratified this release — `feedback_no_mocks.md` (NEW · tier-1) + `project_grounding_recast.md` (NEW).

**Authority**: SPEC §S0..§S37 · RULES §16 CH1–CH33 · PREFLIGHT.md (8 items + new 5b real-LLM smoke) · MEMORY index · `feedback_no_mocks.md` (LOCKED 2026-05-05 — no mock provider modules, no scripted-LLM fixtures, no stubbed-fetch tests, no grounded-mock substrate).

---

## 0 · 🔴 CRITICAL — REAL-LLM SMOKE REQUIRED BEFORE PUSH

The rc.6 tag commit lands locally with 1187/1187 GREEN ✅, but the **PREFLIGHT 5b real-LLM live-key smoke is the user's hands-on verification step** and has not yet been executed (Claude does not have the user's API keys).

Before pushing the tag (or even before fully claiming rc.6 is "ready to ship"), run the procedure documented in `docs/PREFLIGHT.md §5b`:

1. Load Acme Healthcare demo. Open Canvas AI Assistant.
2. For each provider (Anthropic + Gemini + Local A), 3 turns:
   - **Fact-retrieval**: "summarize the gaps" — verify response paraphrases real engagement gap descriptions; no fabrication.
   - **Vendor query**: "find the dell assets in current state" — verify response cites real vendor mix; no made-up products.
   - **Multi-cut**: "what dispositions does the customer have?" — verify response cites real engagement entities only.
3. Per turn, inspect Network panel: Layer 4 carries router selector results; response has zero `groundingViolations`.

If any provider produces a violation: **tag is BLOCKED**. The verifier patterns may need tightening, or the underlying grounding flow may need fixing. Real-LLM smoke is the validation layer per SPEC §S37 R37.12; nothing replaces it.

---

## 1 · What just shipped (rc.6 ledger)

Full per-commit detail in `docs/RELEASE_NOTES_rc.6.md`. Per-arc summary:

| Arc | Commit | Theme | Banner |
|---|---|---|---|
| 6a | `568742f` | SPEC §S37 + RULES §16 CH33 + §T38 RED scaffolds + stubs | 1174/1182 · 8 RED |
| 6a-amend | `faf6134` | No-mocks principle locked; grounded mock retired | 1175/1182 · 7 RED |
| 6b | `63ede19` | Plane 1 router + threshold removal · BUG-030 primary + BUG-033 closed | 1179/1182 · 3 RED |
| 6c | `f27d160` | Plane 2 verifier · BUG-030 fabricated-deliverable subclass closed | 1182/1182 ✅ |
| 6d | `f638825` | BUG-029 closed · sessionBridge handles session-reset | 1184/1184 ✅ |
| 6e | `f38f191` | BUG-035 closed (parts A+B) · entrypoint self-check + vLLM 400 hint | 1185/1185 ✅ |
| 6g | `4208d2a` | BUG-034 closed · pill click commits live form values before swap | 1186/1186 ✅ |
| 6h | `9237c91` | BUG-031 closed · propagate toast binds to applied[0].newCrit | 1187/1187 ✅ |
| 6i+6j | (this commit) | BUG-032 DEFERRED + tag prep (RELEASE_NOTES + HANDOFF + PREFLIGHT 5b mandate + APP_VERSION drop -dev) | 1187/1187 ✅ |

Test deltas: 1169 (rc.5) → 1187 (rc.6) = +18.

SPEC annexes added: §S37.
RULES added: §16 CH33; CH3 rewritten.
TESTS added: §T38 V-FLOW-GROUND.

Memory locked: `feedback_no_mocks.md` (NEW · tier-1) + `project_grounding_recast.md` (NEW).

---

## 2 · Open BUGs

| Bug | Severity | Status |
|---|---|---|
| BUG-001 | Medium | OPEN (propagate-criticality tracking; tightened by BUG-031 closure) |
| BUG-002 | Medium | OPEN (propagate-criticality tracking; tightened by BUG-031 closure) |
| BUG-032 | Medium | DEFERRED to rc.6.1/rc.7 — code path inspected, no disable predicate found, needs user hands-on repro to identify the specific element/state |

All other tracked BUGs (003 through 035 except 032 + 001 + 002) are CLOSED.

---

## 3 · What's next (rc.7 / post-rc.6)

| Tag | Theme | Notes |
|---|---|---|
| **rc.7-arc-1 (mock-purge)** | Retire ALL mock provider modules + tests · per `feedback_no_mocks.md` LOCKED 2026-05-05 | DELETE `services/mockChatProvider.js` + `services/mockLLMProvider.js` + `tests/mocks/*` · DELETE V-CHAT-4/5/15/29/32 + V-MOCK-1..3 + V-PROD-* + V-PATH-31/32 · RETIRE SPEC §S22 + RULES §16 CH13/CH14 · UPDATE `core/appManifest.js` workflow text removing "Mock LLM run button" · estimated half-day |
| **rc.7 main** | View migration arc (formerly rc.6 plan pre-workshop) | 5 v2.x view tabs migrate to read via `state/adapter.js` · drops dormant v2 admin modules · then mechanical `state/v3SkillStore.js` → `state/skillStore.js` rename per `feedback_no_version_prefix_in_names.md` |
| **rc.6.1** (optional) | BUG-032 fix once user can repro | Likely UX clarification: when picker has zero candidates, render explicit empty-state callout instead of letting the button look non-functional |
| **rc.8 / GA** | Pre-GA hardening + real-workshop validation round 2 + merge to main | Real-LLM live-key smoke MUST be GREEN at GA tag |
| **v3.1 minor** | Crown-jewel UI polish | Per `project_crown_jewel_design.md` |

---

## 4 · Locked discipline (memory anchors active for next session)

Non-negotiable, applies to every commit:

- `feedback_no_mocks.md` — **NEW tier-1 LOCKED 2026-05-05**. No mock provider modules. No scripted-LLM fixtures. No stubbed-fetch tests. No grounded-mock substrate. Real-LLM smoke at PREFLIGHT 5b is the validation layer; nothing fakes it.
- `feedback_spec_and_test_first.md` — SPEC + RULES + V-* tests authored BEFORE implementation.
- `feedback_test_or_it_didnt_ship.md` — every BUG-NNN fix MUST add a regression test.
- `feedback_no_patches_flag_first.md` — patches that bypass v3 schema, validation, or architecture are forbidden. Surface alternatives + wait for direction.
- `feedback_browser_smoke_required.md` — every tag MUST include Chrome MCP smoke. Real-LLM live-key smoke is a tag-time PREFLIGHT 5b item starting rc.6.
- `feedback_test_what_to_test.md` — V-FLOW or it didn't ship.
- `feedback_no_push_without_approval.md` — never `git push` without explicit user instruction.
- `feedback_no_version_prefix_in_names.md` — version numbers in tags + APP_VERSION + changelogs only.
- `feedback_dockerfile_whitelist.md` — every new top-level dir → Dockerfile COPY in same commit.
- `feedback_import_collision.md` — alias v3.0 imports during v2↔v3 cutover.
- `feedback_foundational_testing.md` — data-model changes ship with demo + seed + demoSpec + DEMO_CHANGELOG.
- `feedback_naming_standard.md` — AppName-vX.Y.Z artifact naming.
- `feedback_docs_inline.md` — SPEC + CHANGELOG_PLAN + BUG_LOG inline with code, not backfilled.
- `feedback_group_b_spec_rewrite.md` — UX consolidation arcs start with SPEC rewrite session BEFORE coding.
- `project_grounding_recast.md` — **NEW** rc.6 grounding contract recast (RAG-by-construction); two planes + real-LLM smoke; threshold cliff removed; same-tier with no-patches.
- `project_v2x_admin_deferred.md` — keep v2.x admin module intact during v3 GA push.

---

## 5 · How a fresh session picks this up (read-order)

1. Read this `HANDOFF.md` start to finish (especially §0 real-LLM smoke + §3 next-steps).
2. Read `MEMORY.md` index + locked feedback memories — particularly `feedback_no_mocks.md` and `feedback_no_patches_flag_first.md`.
3. Read `docs/RELEASE_NOTES_rc.6.md` for the per-arc detail.
4. Skim `docs/v3.0/SPEC.md §S37` (the grounding contract recast).
5. Check `docs/RULES.md §16 CH33` (the contract rule).
6. **Set up Chrome MCP** before starting any code work.
7. Run `docker compose up -d` and verify the banner `1187/1187 GREEN`.
8. Pick the next sub-arc per §3 — most likely the **mock-purge arc** unless the user redirects.

---

## 6 · File pointers (post-rc.6)

| Concern | File |
|---|---|
| Active engagement source-of-truth | `state/engagementStore.js` |
| v2 sessionState (legacy) | `state/sessionStore.js` |
| Chat memory (BUG-029 fix lives in sessionBridge) | `state/chatMemory.js` + `state/sessionBridge.js` |
| v3 engagement schema | `schema/engagement.js` |
| v3 demo engagement | `core/demoEngagement.js` |
| Data contract | `core/dataContract.js` |
| Concept dictionary | `core/conceptManifest.js` |
| App workflow manifest | `core/appManifest.js` |
| **Grounding router (rc.6 NEW · plane 1)** | `services/groundingRouter.js` |
| **Grounding verifier (rc.6 NEW · plane 2)** | `services/groundingVerifier.js` |
| Chat orchestration (calls router + verifier) | `services/chatService.js` |
| System-prompt assembler (router-driven Layer 4) | `services/systemPromptAssembler.js` |
| Tool registry | `services/chatTools.js` |
| Generic LLM connector | `services/aiService.js` |
| Real provider impl | `services/realChatProvider.js` |
| Mock provider (SCHEDULED FOR RETIREMENT in rc.7-arc-1) | `services/mockChatProvider.js` |
| Mock LLM provider (SCHEDULED FOR RETIREMENT) | `services/mockLLMProvider.js` |
| Handshake regex + strip | `services/chatHandshake.js` |
| UUID + workflow + concept scrub | `services/uuidScrubber.js` |
| Skill runner | `services/skillRunner.js` |
| Manifest generator | `services/manifestGenerator.js` |
| Path resolver | `services/pathResolver.js` |
| Skill Builder UI | `ui/views/SkillBuilder.js` |
| Dormant v2 admin (preserved) | `ui/views/SkillAdmin.js` |
| Dormant AiAssistOverlay (preserved) | `ui/views/AiAssistOverlay.js` |
| Canvas AI Assistant overlay | `ui/views/CanvasChatOverlay.js` |
| Settings modal (BUG-034 fix) | `ui/views/SettingsModal.js` |
| Stack-aware Overlay component | `ui/components/Overlay.js` |
| AI provider config | `core/aiConfig.js` |
| nginx LLM proxy (BUG-035 entrypoint self-check) | `docker-entrypoint.d/45-setup-llm-proxy.sh` |
| Matrix view (BUG-031 fix) | `ui/views/MatrixView.js` |
| Gaps view (BUG-032 deferred) | `ui/views/GapsEditView.js` |
| Diagnostic suite | `diagnostics/appSpec.js` (1187 tests at rc.6) |
| Test runner | `diagnostics/testRunner.js` |
| BUG log | `docs/BUG_LOG.md` |
| Pre-flight checklist | `docs/PREFLIGHT.md` (8 items + NEW 5b real-LLM smoke) |
| SPEC | `docs/v3.0/SPEC.md` (through §S37) |
| RULES | `docs/RULES.md` (CH1–CH33; CH3 rewritten in rc.6) |
| Release notes | `docs/RELEASE_NOTES_rc.6.md` |
| GB10 vLLM setup reference | `LLMs on GB10.docx` |
| GPLC visual reference | `C:/Users/Mahmo/Downloads/GPLC Digital Unified Platform v1.0.html` |

---

## 7 · Push checklist (rc.6 + onward)

When pushing the rc.6 tag (after the user runs PREFLIGHT 5b real-LLM smoke + says "push"):

```bash
git push origin v3.0-data-architecture
git tag v3.0.0-rc.6
git push origin v3.0.0-rc.6
```

Verify on GitHub: branch `v3.0-data-architecture` carries the rc.6 tag commit; `v3.0.0-rc.6` tag exists; rc.5 / rc.4 / rc.3 tags preserved; `origin/main` still on `5614f32`.

Per `feedback_no_push_without_approval.md` — wait for explicit user instruction before each push.
