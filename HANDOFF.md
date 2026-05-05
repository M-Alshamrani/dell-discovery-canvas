# Dell Discovery Canvas — Session Handoff

**Last session end**: 2026-05-05 (late evening, post-office-workshop-test). **`v3.0.0-rc.5` TAGGED + PUSHED to origin** (`v3.0-data-architecture` HEAD = `36a87fe`). APP_VERSION = `"3.0.0-rc.5"`. **Banner 1169/1169 GREEN at tag**.

**STATE — read carefully**: rc.5 closed cleanly with 1169 GREEN tests + visual side-panel smoke recorded via Chrome MCP. **THEN the user ran a real workshop test in the office and reported 7 critical bugs + 1 RED test**. The new bugs (BUG-029 .. BUG-035) reshape the rc.6 priority: **rc.6 is now ROOT-CAUSE FIX ARC for the workshop bugs, NOT pure plumbing view migrations**. View migrations move to rc.7. Per user direction: *"no patching here but fixing of the source cause to actually improve results, not just put guard rails."*

**Authority**: SPEC §S0..§S36 · RULES §16 CH1–CH32 · PREFLIGHT.md (8-item checklist) · MEMORY index · `feedback_no_patches_flag_first.md` (LOCKED — root-cause discipline applies to every BUG-029..035 fix).

---

## 0 · 🔴 CRITICAL TESTING PROTOCOL FOR THIS SESSION

**The user has explicitly instructed: use Chrome MCP for all browser testing in this session.** This is the canonical browser-smoke tool per `feedback_browser_smoke_required.md` and is the way the user can SEE what you're verifying. Do not rely solely on Claude Preview's headless evaluator — the user wants visual confirmation alongside you.

### Setup (do this once at session start)
```
1. Verify Chrome MCP is connected: mcp__Claude_in_Chrome__list_connected_browsers
2. Select browser: mcp__Claude_in_Chrome__select_browser (use the deviceId)
3. Get tab context: mcp__Claude_in_Chrome__tabs_context_mcp { createIfEmpty: true }
4. Navigate to http://localhost:8080 (the docker compose container should already be running)
```

### Per-fix verification flow
1. After EACH code change that's user-observable, run `docker compose up -d --build`.
2. Navigate Chrome MCP to a fresh URL (cache-busting query string: `?v=<short-id>`).
3. Use `mcp__Claude_in_Chrome__browser_batch` to:
   - Wait 4 seconds (page load + auto-test)
   - Run `runAllTests()` via `javascript_tool` to confirm GREEN
   - Take a `screenshot` at the relevant UI state so the user can see the result
4. **Always include a screenshot** when the user is observing — this is what they meant by "do testing in the browser as you used to so I can see with you".

### Real-LLM live-key smoke (NEW PREFLIGHT requirement)
BUG-030 + BUG-033 surfaced because rc.4 + rc.5 PREFLIGHT 5 used MOCK-LLM smoke only. Per the workshop evidence, real-LLM smoke MUST be a tag-time PREFLIGHT item starting rc.6:
- Real-Anthropic: ask 3 turns; verify (a) `[contract-ack]` chip appears turn 1, (b) gaps/dispositions in answers exist in `engagement.gaps` / `engagement.dispositions`, (c) tool calls fire (Network panel shows `selectGapsKanban` etc.).
- Real-Gemini: same.
- Real-Local A: same + multi-turn correctness (BUG-033 specific).
- Capture wire bodies via Chrome DevTools Network panel — if the system prompt or tools array is missing on a real-LLM wire, the grounding architecture is broken in production.

---

## 1 · What just shipped (rc.5 ledger)

Full per-commit detail in `docs/RELEASE_NOTES_rc.5.md`. Per-arc summary:

| Arc | Commits | Theme |
|---|---|---|
| Hotfix #4 (post-rc.4) | `842632a` | v2 seed-library auto-install RETIRED + BUG-027/028 logged + APP_VERSION bump |
| SPEC §S36 LOCK + RED scaffold | `3c1d4a7` | SPEC §S36 + RULES CH32 + §T37 11 RED-first contracts |
| rc.5 impl 5a+5b+5c+5d | `302a4c4` | Side-panel + AiAssist retire + cloak extension + chat polish |
| Tag | `36a87fe` | APP_VERSION drop -dev + RELEASE_NOTES + HANDOFF rewrite + PREFLIGHT 1-8 verified |

**3 BUGs closed in rc.5**: BUG-022 (chat polish line-height), BUG-027 (test-pass DOM flash), BUG-028 (chat-persistent side-panel).

Test deltas: 1157 (rc.4) → 1169 (rc.5) = +12.
SPEC annexes: §S36 added.
RULES added: §16 CH32.

---

## 2 · 🔴 NEW BUGS FROM OFFICE WORKSHOP TEST (2026-05-05) — rc.6 SCOPE

The user ran a real workshop session against the rc.5 build. Found 7 issues + 1 failed test. **Full detail in `docs/BUG_LOG.md`**; summary table here:

| Bug | Severity | Theme | Locked direction |
|---|---|---|---|
| **BUG-029** | High | Canvas AI Assistant chat transcript persists across "+ New session" / "Clear all data" | ROOT CAUSE — investigate `state/chatMemory.js` × `state/sessionStore.js` cleanup wiring |
| **BUG-030** | **Critical** | Real-Anthropic + real-Gemini hallucinate gaps / dispositions / drivers not in engagement | ROOT CAUSE — verify the 3-PHASE AI ARCHITECTURE (data contract + tools + concept/workflow manifests) actually wires through to real-LLM providers in production. Could be `services/aiService.js` Anthropic+Gemini wire builders dropping context. |
| **BUG-031** | Medium | Propagate-criticality toast text always says "Low" regardless of actual level | Toast call site binds wrong arg. Tightens BUG-001/002 scope. |
| **BUG-032** | Medium | Gaps tab desired-state asset link button grayed out (regression of older fix) | Predicate audit in `ui/views/GapsEditView.js` |
| **BUG-033** | High | Local A multi-turn context loss (only first response accurate; later turns degrade to single-word echoes / empty) | rc.4 Hotfix #2b was incomplete OR regressed. ROOT CAUSE — diff turn-1 vs turn-2 wire body for tool-call round-trip on Local A. |
| **BUG-034** | High | AI Providers settings save inconsistent (rc.4 Hotfix #1 didn't fully land — saves silently fail OR persist wrong values) | Form vs handler scope race. ROOT CAUSE — verify save-button handler picks the LIVE `_settings` ref at click time. |
| **BUG-035** | Med-High | V-PROXY-LOCAL-B-1 RED in workshop deploy (404 from `/api/llm/local-b/`) + Local B vLLM `--enable-auto-tool-choice` flag missing user-side | Two-part: (A) entrypoint script may not be writing the location block; (B) friendlier error message for vLLM 400 |

**User direction (LOCKED for rc.6 — quoted)**:
- *"i think there is a more rooted implementation error that is also making the results of the chat with the local chat crappy."* (BUG-029 + BUG-033)
- *"no patching here but fixing of the source cause to actually improve results, not just put guard rails."* (applies to ALL bugs)
- *"can not validate this 100% but i got gaps that are not mentioned and obviously made up."* (BUG-030)

Per `feedback_no_patches_flag_first.md` — surface architectural alternatives to user BEFORE writing any patch-class fix.

---

## 3 · Where you are right after rc.5 ships

- **Branch**: `v3.0-data-architecture` · last commit is the rc.5 tag commit (`36a87fe`) · pushed to origin.
- **APP_VERSION**: `"3.0.0-rc.5"` in `core/version.js`.
- **Banner**: 1169/1169 GREEN at rc.5 tag time. **V-PROXY-LOCAL-B-1 reported RED on user's workshop deploy** (BUG-035) — this needs investigation; it MAY be deploy-environment-specific.
- **Working tree**: pre-handover, this session adds BUG_LOG entries + this HANDOFF rewrite. Will commit + push as the handover commit.
- **Origin**: `origin/v3.0-data-architecture` HEAD = `36a87fe`. Tags on origin: `v3.0.0-rc.5` (this commit), `v3.0.0-rc.4`, `v3.0.0-rc.3`. `origin/main` on `5614f32` (v2.4.16) — untouched.

---

## 4 · 🔴 What's next — REPRIORITIZED (rc.6)

**Old plan (HANDOFF rc.4 §4)**: rc.6 = view migration arc (5 v2.x tabs → `state/adapter.js`).
**New plan (post-workshop)**: rc.6 = root-cause fixes for BUG-029..BUG-035. View migrations slip to rc.7.

| Tag | Theme | Locked discipline |
|---|---|---|
| **rc.6** | **Workshop-bug root-cause fixes**: BUG-029 chat-cross-session persist · BUG-030 real-LLM hallucinations · BUG-031 propagate toast · BUG-032 gaps link · BUG-033 Local A multi-turn · BUG-034 settings save · BUG-035 nginx route + vLLM error message. **Per user**: ROOT CAUSE not patches. Surface architectural fix BEFORE coding. | Each bug starts with an investigation note logged to BUG_LOG.md (root-cause confirmed) — only THEN write the SPEC update + RED test + impl. No "for now" / "guardrail" workarounds. |
| **rc.7** | View migration arc (formerly rc.6) + v2 admin retirement + v3-prefix purge | 5 v2.x tabs migrate one commit each. Drops `ui/views/SkillAdmin.js` + `ui/views/AiAssistOverlay.js` + `core/skillStore.js`. Then mechanical `state/v3SkillStore.js` → `state/skillStore.js` rename. |
| **rc.8 / GA** | Pre-GA hardening + real-workshop validation (round 2) + merge to main | Real-LLM live-key smoke MUST be GREEN at GA tag. |
| **v3.1 minor** | Crown-jewel UI polish | Per `project_crown_jewel_design.md` |

### Recommended rc.6 sub-arc order (start here)

Investigate + fix in this priority order based on impact + dependency:

1. **6a · BUG-030 (real-LLM hallucinations)** — highest user-visible impact. Investigation FIRST: capture real-Anthropic + real-Gemini wire bodies, diff against mock. Surface findings to user.
2. **6b · BUG-029 (chat cross-session persist)** — root-cause investigation in chatMemory + engagementId lifecycle.
3. **6c · BUG-033 (Local A multi-turn)** — likely shares root cause with BUG-030 (wire-body grounding gap).
4. **6d · BUG-034 (Settings save)** — separate concern; race condition in form mount.
5. **6e · BUG-035 (nginx route)** — quick if entrypoint script issue; document vLLM flags.
6. **6f · BUG-031 (propagate toast)** — small wire fix.
7. **6g · BUG-032 (gaps link)** — predicate audit.

**Each sub-arc**: SPEC update + RED-first V-FLOW test + root-cause fix + Chrome MCP visual smoke + commit. No batched commits — one bug = one sub-arc = one commit.

### Real-LLM smoke as a NEW PREFLIGHT item (rc.6 +)

Add to `docs/PREFLIGHT.md` item 5: at every tag, verify with REAL keys (not just mock):
- Anthropic 3-turn chat against demo engagement → answers cite real gaps
- Gemini 3-turn → same
- Local A 3-turn → no degradation post turn-1
- Network panel inspection captures the wire body (sanity check that data is in the prompt)

---

## 5 · Locked behavioral discipline (memory index)

Non-negotiable, applies to every commit:

- `feedback_spec_and_test_first.md` — SPEC + RULES + V-* tests authored BEFORE implementation.
- `feedback_test_or_it_didnt_ship.md` — every BUG-NNN fix MUST add a regression test.
- **`feedback_no_patches_flag_first.md` — APPLIES TO EVERY BUG-029..035 FIX.** User has explicitly invoked it 2026-05-05. Investigate root cause, surface alternatives, wait for direction. No "for now" / "just this once" / guardrails.
- `feedback_browser_smoke_required.md` — every tag MUST include Chrome MCP smoke. **NEW: real-LLM live-key smoke is a tag-time PREFLIGHT item starting rc.6** (not a "deferred to first workshop run" item — that gap is what allowed BUG-030 to surface only at workshop time).
- `feedback_test_what_to_test.md` — V-FLOW or it didn't ship.
- `feedback_no_push_without_approval.md` — never `git push` without explicit user instruction.
- `feedback_no_version_prefix_in_names.md` — version numbers in tags + APP_VERSION + changelogs only.
- `feedback_dockerfile_whitelist.md` — every new top-level dir → Dockerfile COPY in same commit.
- `feedback_import_collision.md` — alias v3.0 imports during v2↔v3 cutover.
- `feedback_foundational_testing.md` — data-model changes ship with demo + seed + demoSpec + DEMO_CHANGELOG.
- `feedback_naming_standard.md` — AppName-vX.Y.Z artifact naming.
- `feedback_docs_inline.md` — SPEC + CHANGELOG_PLAN + BUG_LOG inline with code, not backfilled.
- `feedback_group_b_spec_rewrite.md` — UX consolidation arcs start with SPEC rewrite session BEFORE coding.
- `project_v2x_admin_deferred.md` — keep v2.x admin module intact during v3 GA push.

---

## 6 · How a fresh session picks this up (read-order)

1. Read this `HANDOFF.md` start to finish (especially §0 testing protocol + §2 new bugs + §4 reprioritized plan).
2. Read `MEMORY.md` index + the locked feedback memories — particularly `feedback_no_patches_flag_first.md`.
3. Read `docs/BUG_LOG.md` BUG-029 through BUG-035 in detail (each has investigation plan + suspected hot spots + repro steps).
4. Skim `docs/v3.0/SPEC.md` change log table (§S36 is the latest annex).
5. Check `docs/RULES.md §16` (CH1–CH32) for hard contracts.
6. **Set up Chrome MCP per §0 testing protocol BEFORE starting any code work.**
7. Run the Docker container (`docker compose up -d`) and verify the banner. **If V-PROXY-LOCAL-B-1 is RED, that's BUG-035 — the deploy environment may have stale entrypoint script. Investigate before assuming the test is wrong.**
8. **Pick rc.6 sub-arc 6a (BUG-030 real-LLM hallucinations)** as the first priority unless user redirects. Per `feedback_no_patches_flag_first.md`: investigate FIRST, surface architectural findings to user, then write SPEC + RED test + impl.

---

## 7 · File pointers (post-rc.5)

| Concern | File |
|---|---|
| Active engagement source-of-truth | `state/engagementStore.js` |
| v2 sessionState (legacy) | `state/sessionStore.js` |
| **Chat memory (BUG-029 hotspot)** | `state/chatMemory.js` |
| v3 engagement schema | `schema/engagement.js` |
| v3 skill schema | `schema/skill.js` |
| v3 demo engagement | `core/demoEngagement.js` |
| **Data contract (BUG-030 hotspot — verify it reaches real-LLM wire)** | `core/dataContract.js` |
| Concept dictionary | `core/conceptManifest.js` |
| App workflow manifest | `core/appManifest.js` |
| Chat orchestration | `services/chatService.js` |
| **System prompt assembly (BUG-030 hotspot)** | `services/systemPromptAssembler.js` |
| Tool registry | `services/chatTools.js` |
| **Generic LLM connector (BUG-030 + BUG-033 hotspot)** | `services/aiService.js` |
| **Real provider impl (BUG-030 + BUG-033 hotspot)** | `services/realChatProvider.js` |
| Mock provider | `services/mockChatProvider.js` |
| Handshake regex + strip | `services/chatHandshake.js` |
| UUID + workflow + concept scrub | `services/uuidScrubber.js` |
| Try-asking prompt mixer | `services/tryAskingPrompts.js` |
| Skill runner | `services/skillRunner.js` |
| Manifest generator | `services/manifestGenerator.js` |
| Path resolver | `services/pathResolver.js` |
| Evolved Skill Builder UI | `ui/views/SkillBuilder.js` |
| Dormant v2 admin (preserved) | `ui/views/SkillAdmin.js` |
| Dormant AiAssistOverlay (preserved) | `ui/views/AiAssistOverlay.js` |
| Skill Builder opener (chat-aware shim) | `ui/skillBuilderOpener.js` |
| **Canvas AI Assistant overlay (BUG-029 + BUG-030 hotspot)** | `ui/views/CanvasChatOverlay.js` |
| **Settings modal (BUG-034 hotspot)** | `ui/views/SettingsModal.js` |
| **Stack-aware Overlay component** | `ui/components/Overlay.js` |
| AI provider config | `core/aiConfig.js` |
| **nginx LLM proxy (BUG-035 hotspot)** | `docker-entrypoint.d/45-setup-llm-proxy.sh` |
| App-shell stylesheet | `styles.css` |
| v3 skill storage | `state/v3SkillStore.js` |
| v2 skill storage (read-only legacy) | `core/skillStore.js` |
| v2 seed records (reference) | `core/seedSkills.js` |
| **Gaps view (BUG-032 hotspot)** | `ui/views/GapsEditView.js` |
| **Matrix commands / propagate (BUG-031 hotspot)** | `interactions/matrixCommands.js` |
| Diagnostic suite | `diagnostics/appSpec.js` (1169 tests at rc.5) |
| Test runner | `diagnostics/testRunner.js` |
| **BUG log (BUG-029..BUG-035 detail)** | `docs/BUG_LOG.md` |
| Pre-flight checklist | `docs/PREFLIGHT.md` |
| SPEC | `docs/v3.0/SPEC.md` (through §S36) |
| RULES | `docs/RULES.md` (CH1–CH32) |
| Release notes (rc.5) | `docs/RELEASE_NOTES_rc.5.md` |
| GB10 vLLM setup reference | `LLMs on GB10.docx` |
| GPLC visual reference | `C:/Users/Mahmo/Downloads/GPLC Digital Unified Platform v1.0.html` |

---

## 8 · Push checklist (rc.6 +)

When tagging rc.6 (after the workshop bugs are root-caused + fixed + GREEN + smoked):

```bash
git push origin v3.0-data-architecture
git tag v3.0.0-rc.6
git push origin v3.0.0-rc.6
```

Verify on GitHub: branch `v3.0-data-architecture` carries the rc.6 tag commit; `v3.0.0-rc.6` tag exists; rc.5 / rc.4 / rc.3 tags preserved; `origin/main` still on `5614f32`.

Per `feedback_no_push_without_approval.md` — wait for user "push" / "tag it" / "ship it" before each push.

---

## 9 · Workshop screenshots (referenced by BUG_LOG entries)

The user attached 4 screenshots in the 2026-05-05 office-test session. They live in the user's chat history (not in repo); the BUG_LOG entries cite them by content:

- **Screenshot #1 + #2** (DevTools console): `V-PROXY-LOCAL-B-1` RED — `/api/llm/local-b/` returns 404. → BUG-035 evidence.
- **Screenshot #3** (Canvas AI Assistant after Local B chat): `Provider error: aiService localB HTTP 400 — "auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set`. → BUG-035 part B (vLLM server flag missing).
- **Screenshot #4** (Canvas AI Assistant Local A multi-turn): user asks "find current-state assets that are dell" → response is single word "current". User asks "list gaps currently defined" → empty Canvas response. Earlier turn returned a long useful answer about `mappedAssetIds`. → BUG-033 evidence.

Reference these in any rc.6 6a / 6c investigation docs. Ask the user to re-share if needed.
