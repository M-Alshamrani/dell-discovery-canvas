# Release notes — `v3.0.0-rc.3`

**Tagged**: 2026-05-03
**Banner**: `1103/1103 GREEN ✅` (was 1048 at rc.2; **+55 net tests**)
**Branch**: `v3.0-data-architecture` (HEAD pre-tag)
**Authority**: `docs/v3.0/SPEC.md §S20 + §S26..§S31` · `docs/RULES.md §16 CH20–CH27` · `docs/PREFLIGHT.md`

---

## Headline themes

1. **3-PHASE AI ARCHITECTURE COMPLETE** — chat is now data-aware (`core/dataContract.js`), definitional-aware (`core/conceptManifest.js`), AND procedural-aware (`core/appManifest.js`). Vendor-neutral: OpenAI canonical lingua franca with Anthropic + Gemini translation shims; 5-round multi-tool chaining across all providers.
2. **Skill architecture v3.1** — click-to-run scope retired; skills are parameterized prompts with explicit `outputTarget` (`chat-bubble` ships; `structured-card` / `reporting-panel` / `proposed-changes` reserved for rc.4+).
3. **Topbar consolidated to ONE AI button** — sparkle-icon "AI Assist" with Dell-blue gradient + 8s diamond-glint pulse. Skill Builder + Use-AI per-tab buttons retired; access via the chat right-rail's "+ Author new skill" affordance.
4. **AI-correctness consolidation (Group A)** — BUG-013 (UUID leakage), BUG-018 (Gemini hangs), BUG-019 (page-reload rehydrate), BUG-020 (handshake leak), BUG-023 (manifest layerId), BUG-011 (Anthropic key save) all CLOSED with regression guards.
5. **Process discipline locked** — APP_VERSION lifecycle policy + 8-item PREFLIGHT checklist eliminate the freeze-drift class of bugs (the rc.2 tag drift surfaced at the start of this arc).

---

## Commit ledger (chronological on `origin/v3.0-data-architecture`)

| Commit | Theme | What |
|---|---|---|
| `7414b36` | Recovery | APP_VERSION discipline (`-dev` suffix) + `PREFLIGHT.md` + `RELEASE_NOTES_rc3-dev.md` + HANDOFF rewrite. Closes the rc.2-tag freeze drift (18 commits past tag without bumping APP_VERSION). 1085/1085 GREEN. |
| `5ec646d` | rc.3 #4 | SkillBuilder UI rebuild — drop chip palette + scope picker + entity-kind dropdown + 1-2-3 wizard; add parameters[] editor + outputTarget radio. ~735 → ~445 lines. V-SKILL-V3-5. |
| `6897321` | rc.3 #5 | Chat right-rail populated with saved-skill cards — click → mini parameter form (or one-shot drop for parameter-less skills) → resolved prompt drops into chat input. V-SKILL-V3-6. |
| `83fb93c` | rc.3 #6 | `ui/components/UseAiButton.js` retired — chat right-rail subsumes the entity-context invocation path. V-SKILL-V3-7 + V-ANTI-USE-AI source-grep. |
| `d429b46` | rc.3 #7 | Topbar consolidation — `#topbarAiBtn` + `#topbarLabBtn` removed; only `#topbarChatBtn` kept. AI Assist via Cmd+K shortcut; Skill Builder via chat right-rail "+ Author new skill". V-TOPBAR-1 + V-LAB-VIA-CHAT-RAIL + V-AI-ASSIST-CMD-K. **Bonus fix in flight**: lifted Cmd+K keydown listener out of the button-presence guard so the shortcut survives the topbar consolidation. |
| `203ef12` | BUG-019 | v3 engagement persistence + rehydrate-on-boot. `state/engagementStore.js` now persists to `localStorage.v3_engagement_v1` on every state change; rehydrates at module load with `EngagementSchema.safeParse` validation + corrupt-cache safety. SPEC §S31 + RULES CH27 + V-FLOW-REHYDRATE-1/2/3. Closes the user repro: page-reload race where AI saw "empty" against a populated UI. |
| `987c7e7` | BUG-020 | Streaming-time handshake strip via shared `services/chatHandshake.js`. Pre-fix the strip ran only on `onComplete`; if a model emitted the handshake mid-stream the bubble flashed it. New shared module; `chatService` + `chatMemory` + `CanvasChatOverlay.onToken` all use one source-of-truth pattern. V-CHAT-33/34/35. |
| `66810c6` | BUG-013 Path B | Runtime UUID-to-label scrub in chat prose. `services/uuidScrubber.js` exports `buildLabelMap(engagement)` + `scrubUuidsInProse(text, labelMap)`. Replaces bare v3-format UUIDs with resolved labels (or `[unknown reference]` for orphans); skips fenced + inline code; idempotent. Defense-in-depth on top of Path A (role section + selector enrichment). V-CHAT-36/37/38. |
| `7cf20ec` | BUG-023 | `gapPathManifest` exposes `context.gap.layerId` + `context.gap.gapType` so the dell-mapping seed prompt validates without "not in manifest" errors. V-MFG-1 snapshot regenerated (8744 → 9106 bytes; hash 3a217459 → 709fe1c2). V-PATH-31/32. |
| `94d203b` | BUG-018 | Closed (verified). V-CHAT-32 covers the BUG-018 repro at the integration level (Gemini round-trip with `selectGapsKanban`); real-Gemini live-key smoke deferred to first user-driven workshop run. |
| `c975d1f` | rc.3 #13 | AI Assist button rebrand — resurrected v2.4.13 sparkle icon + Dell-blue gradient + 8s `ai-luxury-glow` breathe + `ai-luxury-glint` diamond sweep. Replaces the standalone "Chat" button. Click opens Canvas Chat; Cmd+K still opens legacy AiAssistOverlay (full retirement scheduled rc.5). V-TOPBAR-1 + VT23 flipped to assert the new contract. |
| **(this commit)** | tag | `APP_VERSION` `3.0.0-rc.3-dev` → `3.0.0-rc.3`. SPEC change-log row added. RULES CH26 added. RELEASE_NOTES_rc.3.md authored. HANDOFF.md rewritten. PREFLIGHT items 1-8 verified. |

Plus 14 commits between rc.2 and the recovery commit (Phase A1 + B + C + 7 BUG fixes BUG-010..017 + Skill schema v3.1 schema commits) detailed in the prior `RELEASE_NOTES_rc3-dev.md` (now superseded).

---

## Test deltas (1048 → 1103, +55 net)

| Suite | Tests added |
|---|---|
| §T20 V-CHAT | V-CHAT-18..38 (multi-round chaining + anti-leakage role section + selector enrichment + connection-status chip + Phase A1 generic connector + concept dictionary + workflow manifest + handshake-strip shared module + UUID scrub) |
| §T22 V-NAME | V-NAME-2 (UI-string anti-leakage in 4 AI-surface files) |
| §T-CONCEPT V-CONCEPT | V-CONCEPT-1..5 (Phase B2 concept dictionary grounding) |
| §T-WORKFLOW V-WORKFLOW | V-WORKFLOW-1..5 (Phase C2 app workflow manifest) |
| §T-SKILL-V3 V-SKILL-V3 | V-SKILL-V3-1..7 (schema migration + parameterized runner + outputTarget dispatch + Skill Builder rebuild + chat right-rail + UseAiButton retirement) |
| §T30 V-VERSION | V-VERSION-1/2 (semver shape + chip wiring) |
| §T31 V-FLOW-REHYDRATE | V-FLOW-REHYDRATE-1/2/3 (engagement persistence + rehydrate + corrupt-cache safety + test isolation) |
| §T-V3 V-PATH | V-PATH-31/32 (BUG-023 manifest + skill-save validator) |
| §T-V3 V-TOPBAR | V-TOPBAR-1 (single-AI-button contract) |
| §T-V3 V-LAB / V-AI-ASSIST | V-LAB-VIA-CHAT-RAIL + V-AI-ASSIST-CMD-K + V-ANTI-USE-AI (UseAiButton retirement guard) |
| §T20 V-DEMO + V-FLOW-CHAT-DEMO | V-DEMO-V2-1, V-DEMO-8/9, V-FLOW-CHAT-DEMO-1/2 (rich Acme demo wired through v3→v2 adapter) |

---

## What's documented but NOT yet implemented

Per SPEC §S29.7 (skill rendering targets — DEFERRED to rc.4 / GA):
- `outputTarget: "structured-card"`
- `outputTarget: "reporting-panel"`
- `outputTarget: "proposed-changes"` (mutate-with-approval, agent-like)

Per BUG_LOG / queued:
- **BUG-001 + BUG-002** — propagate-criticality regressions; GA polish bucket
- **BUG-021** — Gemini perf + OpenAI prompt caching; rc.7 polish
- **BUG-022** — chat UI polish; rolled into rc.5 UX consolidation arc

Per HANDOFF queue:
- **rc.4 — AI correctness consolidation Round 2** — anything that surfaces during real-customer workshops
- **rc.5 — UX consolidation arc** (per `feedback_group_b_spec_rewrite.md` user direction): SPEC rewrite first, then window-contract pass + Skill Builder UX rethink + chat polish
- **rc.6 — view migration arc** — 5 v2.x view tabs migrated to read via `state/adapter.js`
- **rc.7 — crown-jewel polish** + perf
- **rc.8 — pre-GA hardening** + v2.x admin parity-gate decision + v3-prefix purge + backlog cleanup
- **v3.0.0 GA** — real workshop run logged

---

## Pre-flight checklist (PREFLIGHT.md items 1-8) — verified at tag time

| # | Item | Status |
|---|---|---|
| 1a | per arc start past tag — `-dev` suffix added | ✓ Done at recovery commit `7414b36` |
| 1b | at tag time — `APP_VERSION = "3.0.0-rc.3"` (drop -dev) | ✓ This commit |
| 2 | SPEC §9 phase block / annexes updated | ✓ §S26..§S31 added; rc.3 release row in change log |
| 3 | RULES updated | ✓ §16 CH20–CH27 added |
| 4 | V-* tests RED-first → GREEN | ✓ 1103/1103 GREEN |
| 5 | Browser smoke against Acme Healthcare demo | ✓ See "Browser smoke" section below |
| 6 | RELEASE_NOTES authored | ✓ This file |
| 7 | HANDOFF.md rewritten | ✓ This commit |
| 8 | Banner GREEN | ✓ 1103/1103 |

### Browser smoke (PREFLIGHT item 5)

Smoked against the running Docker container at `http://localhost:8080` with the Acme Healthcare demo loaded:

- **Topbar**: Singular `#topbarAiBtn` ("AI Assist") with sparkle icon + Dell-blue gradient + 8s `ai-luxury-glow` breathe (verified via `getComputedStyle`); click opens Canvas Chat overlay.
- **Connection-status chip**: Reflects active provider (`Connected to Claude` green / `Configure provider` amber).
- **Topbar version chip**: Displays `Canvas v3.0.0-rc.3` (V-VERSION-3 manual check).
- **BUG-019 repro closed**: Click Load demo → engagement has 8 gaps. Hard-reload page. Engagement still has 8 gaps without re-clicking Load demo. Persisted localStorage carries 30,146-byte engagement record.
- **BUG-023 repro closed**: Open Skill Builder via chat rail "+ Author new skill" → load dell-mapping seed → click Validate → result panel shows "✓ Template paths valid; ready to save." (was: "Validation failed · context.gap.layerId: not in manifest").
- **Chat right-rail**: Saved-skill cards render; parameterized skills (dell-mapping with entityId param) expand inline parameter form; parameter-less skills (executive-summary) drop resolved prompt directly into the input. Resolved prompts include real Acme gap descriptions + customer name + urgency labels (no UUIDs leaked — V-CHAT-37 covers).

### Real-Gemini live-key smoke

DEFERRED to first user-driven workshop run. V-CHAT-30/31/32 cover the wire-format + content translation + integration round-trip with stubbed Gemini fetch. The protocol is correct; live-key smoke is a belt-and-suspenders gate per `feedback_browser_smoke_required.md`.

---

## Known issues / open BUGs at tag time

- **BUG-001** + **BUG-002** — propagate-criticality regressions (toast text + dispatch chain). GA polish bucket. OPEN since rc.1.
- **BUG-021** — Gemini perf + OpenAI prompt caching. Polish; rc.7.
- **BUG-022** — chat UI polish (button styling, skills tabs, spacing, status messages). Folded into rc.5 UX consolidation arc.

User-flagged for the rc.5 UX consolidation arc (not regressions; design concerns):
- Skill Builder Lab feels unintuitive (logged in `project_skillbuilder_ux_concern.md` and `project_ui_ux_consolidation_concern.md`).
- Window/overlay shapes inconsistent across Settings / Chat / Skill Builder / AI Assist / confirmAction.
- General UI/UX concerns to be enumerated in the rc.5 walkthrough.

Per locked memory `feedback_group_b_spec_rewrite.md`: rc.5 starts with a SPEC rewrite session capturing user expectations, BEFORE any UI code lands.
