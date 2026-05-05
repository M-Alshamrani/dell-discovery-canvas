# Dell Discovery Canvas · v3.0.0-rc.5 · Release Notes

**Tagged**: 2026-05-05 · **Branch**: `v3.0-data-architecture` · **APP_VERSION**: `"3.0.0-rc.5"` · **Banner**: 1169/1169 GREEN ✅

**Theme**: UX consolidation arc + skill-library purge. Closes BUG-022 + BUG-027 + BUG-028. Side-panel pattern (ChatGPT / Claude.ai) lets users open Settings (and any future AI tool) WITHOUT losing their Canvas AI Assistant chat. AiAssistOverlay legacy tile-grid retired from production. v2 seed-skill auto-install retired (clean-slate library).

Authoritative artifacts:
- SPEC: `docs/v3.0/SPEC.md` §S0..§S36 (LOCKED)
- RULES: `docs/RULES.md` §16 CH1..CH32
- PREFLIGHT: `docs/PREFLIGHT.md` (8-item gate)
- HANDOFF: `HANDOFF.md` (rewritten at this tag)

---

## 1 · Per-arc ledger (rc.4 → rc.5)

5 commits since `v3.0.0-rc.4` (`30ff765` · 2026-05-05 earlier):

| Phase | Commit | Theme | Banner |
|---|---|---|---|
| **Hotfix #4** (post-rc.4) | `842632a` | v2 seed-library auto-install RETIRED + BUG-027/028 logged + APP_VERSION → `3.0.0-rc.5-dev` (PREFLIGHT 1a). loadSkills returns [] on fresh / corrupt / non-array. seedSkills() preserved as reference for tests. NEW V-FLOW-NO-SEEDS-1. | 1158/1158 |
| **SPEC + RULES + RED scaffold** | `3c1d4a7` | SPEC §S36 LOCKED on user "go all my recs" approval. RULES §16 CH32 added. §T37 RED-first: V-OVERLAY-STACK-1..4 + V-FLOW-CHAT-PERSIST-1..3 + V-AI-ASSIST-DORMANT-1 + V-NO-VISIBLE-TEST-FLASH-1 + V-CHAT-POLISH-1..2 (11 RED-first contracts). | 1158 + 11 RED |
| **rc.5 impl 5a+5b+5c+5d** | `302a4c4` | All 4 sub-arcs in one commit. Detail in §3 below. | 1169/1169 |
| **Tag** | (this commit) | APP_VERSION drops -dev + RELEASE_NOTES + HANDOFF rewrite + PREFLIGHT 1-8 verified | 1169/1169 |

**Test deltas**: 1157 (rc.4) → 1169 (rc.5), **+12 net tests** (V-FLOW-NO-SEEDS-1 + 11 from §T37).
**SPEC annexes added**: §S36.
**RULES added**: §16 CH32.

---

## 2 · BUG status snapshot at tag

**Closed in rc.5**:
- BUG-022 (chat polish) — closed in 5d (line-height tightened 22px → 20px; Send button density audit confirmed already compliant)
- BUG-027 (test-pass DOM flash residual) — closed in 5c (cloak extended to body-level rogue probes via `body[data-running-tests] > *:not(...)` selector with 6-element exemption list)
- BUG-028 (chat doesn't persist when Skills clicked) — closed in 5a (side-panel architecture in Overlay.js; chat shrinks to left, Settings opens as right pane)

**Closed in rc.4** (already at tag baseline):
- BUG-024 (workflow.<id> / concept.<id> leak) · BUG-025 (Cmd+K binding) · BUG-026 (test-pass overlay flash)

**Still open** (per HANDOFF.md §4 schedule):
- BUG-001 + BUG-002 (propagate-criticality) — queued for rc.6 fold-in
- BUG-021 (perf) — deferred to v3.1 minor

---

## 3 · Architecture additions

### Side-panel pattern (5a · BUG-028 fix)
- `ui/components/Overlay.js` is now stack-aware. The pre-rc.5 singleton (`openEl` slot) is replaced by an internal `_stack` array. `openOverlay({ sidePanel: true })` while another overlay is open pushes onto the stack instead of replacing.
- Layout: base layer flips to `data-stack-pos="left"` (50vw - 3vw width, anchored at 2vw left); top layer renders as `data-stack-pos="right"` (same width, anchored at 2vw right) with a slide-in-from-right animation.
- Single shared backdrop covers both layers. Backdrop click closes top-most only. ESC closes top-most only (capture-phase + stopImmediatePropagation defends against other global ESC handlers double-firing).
- closeOverlay() pops top only. If stack now has 1, the survivor flips back to `data-stack-pos="full"` (centered default). When stack empties, the backdrop + ESC handler tear down.
- Mobile graceful degradation (<900px viewport): "left" layer is hidden, "right" reverts to centered pre-rc.5 layout. Single-layer fallback on narrow screens.
- Wiring updates:
  - `ui/skillBuilderOpener.js` shim detects `document.querySelector(".overlay[data-kind='canvas-chat']")` and passes `sidePanel: true` to `openSettingsModal()` when chat is open.
  - `ui/views/CanvasChatOverlay.js` needs-key provider pill click site updated similarly: was `closeOverlay() + openSettingsModal()` (killed chat), now `openSettingsModal({ ..., sidePanel: true })`.
  - `ui/views/SettingsModal.js` `openSettingsModal({ ..., sidePanel })` propagates the opt to `openOverlay()`.

### AiAssistOverlay full retirement (5b)
- `app.js` removed the legacy `import { openAiOverlay } from "./ui/views/AiAssistOverlay.js"`. Cmd+K had been rebound to openCanvasChat in rc.4 Arc 2; rc.5 closes the loop by removing the dead production import.
- File `ui/views/AiAssistOverlay.js` STAYS on disk as a dormant module per `project_v2x_admin_deferred.md` (same pattern as the post-rc.4 SkillAdmin.js).
- Source-grep regression guard V-AI-ASSIST-DORMANT-1 source-greps all production files for actual `import ... from ".../AiAssistOverlay.js"` statements (strips comments first, so historical archaeology comments are exempt).

### BUG-027 cloak extension (5c)
- `styles.css` adds: `body[data-running-tests] > *:not(#app-header):not(#stepper):not(#main):not(#app-footer):not(#test-banner):not(.overlay-backdrop) { visibility: hidden !important; pointer-events: none !important; }`
- Closes the residual flash where rogue body-level test probes (V-PROD / V-DEMO / VT* tests append DIVs to body for layout assertions) painted visibly during the test pass on slow hardware. The rc.4 Hotfix #3 cloak only covered `.overlay` / `.overlay-backdrop` / `#skillBuilderOverlay`.
- V-NO-VISIBLE-TEST-FLASH-1: live DOM probe — appends a body-level rogue and asserts `getComputedStyle(probe).visibility === "hidden"`.

### BUG-022 chat polish (5d)
- `.canvas-chat-msg-content` line-height tightened 22px → 20px (ratio 1.57 → 1.43). Per user feedback "the text is shown with large spaces".
- Send button (`.canvas-chat-send`): audit confirmed it's already 38x38 with no explicit padding; browser-default padding is well under 14px → polish target met automatically.
- V-THEME-7 (rc.4 line-height assertion) updated in lockstep.

### Skill purge (Hotfix #4 baseline)
- `core/skillStore.js` `loadSkills()` returns `[]` on first read + on parse failures + on non-array storage. Was: dumped the v2 seed library to localStorage.
- The seed library records remain in `core/seedSkills.js` as reference data. Tests that need pre-populated rows explicitly call `saveSkills(seedSkills())`.
- User-visible: Settings → Skills builder shows a clean "No skills yet" empty state on a fresh install. The Legacy section in the evolved admin no longer appears (no v2 records to surface).

---

## 4 · PREFLIGHT 1-8 at tag time

| # | Item | Status |
|---|---|---|
| 1a | First commit past rc.4 bumped APP_VERSION → `3.0.0-rc.5-dev` (`842632a`) | ✅ |
| 1b | At tag: APP_VERSION = `3.0.0-rc.5` (this commit) | ✅ |
| 2 | SPEC §9 + §S36 LOCKED + change-log row for Hotfix #4 + change-log row for §S36 LOCK | ✅ |
| 3 | RULES §16 CH32 added | ✅ |
| 4 | V-* tests RED-first → GREEN: V-FLOW-NO-SEEDS-1 + V-OVERLAY-STACK-1..4 + V-FLOW-CHAT-PERSIST-1..3 + V-AI-ASSIST-DORMANT-1 + V-NO-VISIBLE-TEST-FLASH-1 + V-CHAT-POLISH-1..2 | ✅ |
| 5 | Browser smoke against Acme Healthcare demo via Chrome MCP — see §5 below | ✅ |
| 6 | `docs/RELEASE_NOTES_rc.5.md` authored (this file) | ✅ |
| 7 | `HANDOFF.md` rewritten | ✅ (this commit) |
| 8 | Banner 1169/1169 GREEN | ✅ |

---

## 5 · Chrome MCP browser smoke at tag

Recorded during the rc.5 impl commit verification, http://localhost:8080:

1. **Topbar version chip** displays "Canvas v3.0.0-rc.5" (V-VERSION-3 manual; will reflect at the tag commit rebuild).
2. **Canvas AI Assistant opens full-screen** with TRY ASKING prompts visible (Arc 3b try-asking mixer working).
3. **Click "+ Author new skill"** in chat footer:
   - Chat overlay PERSISTS in DOM (no longer unmounted)
   - Chat panel transitions to `data-stack-pos="left"`, occupies left half
   - Settings → Skills builder mounts as `data-stack-pos="right"`, occupies right half
   - Both visible simultaneously (Claude.ai-style)
4. **Skills builder pill**: clean empty state — "No skills yet. Click '+ Add skill' to create one." (post-Hotfix #4 skill purge — no Legacy section).
5. **runAllTests()**: 1169/1169 GREEN (1158 prior + 11 §T37 contracts flipped GREEN by 5a/5b/5c/5d).

Real-LLM live-key smoke (Anthropic + Gemini + Local A/B) deferred to first user-driven workshop run per established pattern.

---

## 6 · Known issues / deferred

- **BUG-001 + BUG-002** (propagate-criticality toast text + dispatchability) — queued for rc.6 fold-in.
- **BUG-021** (perf) — deferred to v3.1 minor.
- **5 v2.x view-tab migrations** (Context · Current state · Desired state · Gaps · Reporting → `state/adapter.js`) — rc.6 critical-path arc.
- **v2 admin retirement + v3-prefix purge** — rc.7.
- **Crown-jewel UI polish** — deferred to v3.1 minor.
- **Real-workshop validation run** — gates v3.0.0 GA tag.

---

## 7 · Push checklist

When tagging this rc.5:

```bash
# Already pushed at rc.4 push (origin tracks branch). New commits + new tag:
git push origin v3.0-data-architecture
git tag v3.0.0-rc.5
git push origin v3.0.0-rc.5
```

Verify on GitHub: branch `v3.0-data-architecture` carries the rc.5 tag commit; `v3.0.0-rc.5` tag exists; `origin/main` still on `5614f32` (v2.4.16, untouched); rc.4 tag still on `30ff765`.
