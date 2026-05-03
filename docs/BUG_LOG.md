# Dell Discovery Canvas — Bug Log

Live tracker for known regressions and outstanding bugs. New bugs land here as soon as they're observed (in the same session as the report) so they don't get lost between sessions.

**Status flow**: `OPEN → INVESTIGATING → FIX-PENDING → FIXED → CLOSED` (CLOSED is when the regression test guarding against the bug is GREEN and shipped).

**Discipline anchor**: every fix MUST ship with a regression test (V-FLOW vector or equivalent) per `feedback_test_what_to_test.md`. *Fixed without a test → not fixed.*

---

## BUG-001 · Propagation toast shows "low" when actual urgency mutation is "high"

**Status**: OPEN · Reported 2026-05-02 · v3.0.0-rc.1 · Scheduled rc.2 polish bucket
**Reporter**: User during rc.1 manual smoke
**Severity**: Medium (state is correct; user-visible feedback is wrong → trust loss)
**Regression**: Yes — was working before the v3.0 data-architecture rebuild; broke during the cutover

### Repro

1. Load demo session OR an engagement with a current-state workload tile of `criticality: "High"` (or any value that should propagate).
2. Click the propagate-criticality affordance on the workload (the "↓ propagate to gap urgency" CTA, or however it surfaces in the current UI).
3. Observe the green confirmation toast.

### Expected

Toast text reflects the actual urgency the gap was mutated to. If the workload's criticality is "High", the gap is now "High", so the toast says "Propagated to High" (or equivalent verb-tense match).

### Actual

The gap correctly mutates to "High" (state assertion would pass), but the toast text reads "low" — the wrong field is being rendered into the toast template.

### Suspected root cause

In `interactions/desiredStateSync.js` (or the toast emitter that wraps it), the toast string is being built from a stale or incorrect field reference. Possibly:
- A literal string "low" was hardcoded as a placeholder and never wired to the actual mutation result.
- The toast reads from a field that was renamed during the v3.0 cutover (e.g. read `gap.urgencyOld` instead of `gap.urgency`).
- The criticality-to-urgency mapping function returns the wrong value while the actual mutation uses a different (correct) path.

### Fix plan

1. Locate the toast emission site (grep for the green confirmation message text).
2. Trace back to the data field driving the message; assert it matches the field actually mutated by `syncGapsFromCurrentCriticality`.
3. Ship the fix WITH a V-FLOW regression test:
   ```js
   it("V-FLOW-PROP-1 · propagate-criticality toast text matches the gap.urgency mutation", () => {
     // Build engagement with workload criticality:"High"
     // Click propagate
     // Assert: gap.urgency === "High" AND toast.textContent.includes("High") AND NOT toast.textContent.includes("low")
   });
   ```

---

## BUG-002 · Propagate button non-dispatchable after add-disposition-different-layer cycle

**Status**: OPEN · Reported 2026-05-02 · v3.0.0-rc.1 · Scheduled rc.2 polish bucket
**Reporter**: User during rc.1 manual smoke
**Severity**: Medium (multi-step user flow blocked; recovery requires page reload)
**Regression**: Likely — same v3.0 cutover window

### Repro

1. Load a session with at least two layers populated (compute + storage, for example).
2. On compute, set a disposition that produces a propagate-criticality opportunity.
3. Click propagate. (Works.)
4. On storage (or any other layer), add another disposition that should also propagate.
5. Click propagate on the second disposition.

### Expected

The second propagate-button click dispatches normally — gap mutates, toast emits, button returns to ready state for any next propagate.

### Actual

The propagate button does not respond to the second click. UI gives no error; the button just appears "stuck". A page reload restores normal dispatchability.

### Suspected root cause

Likely one of:
- Stale event handler: after the first propagate completes, the click handler is detached or the DOM node is replaced without re-attaching the listener.
- Stuck state machine: an internal `isPropagating` boolean flips true on first click and never resets to false (no `finally` in the propagate handler, or an early-return that skips the reset).
- Re-render mismatch: the post-propagate re-render preserves the old DOM but the new state object lost the reference; React-style render-keyed handlers would catch this, but vanilla-DOM event-listener-loss can fail silently.

### Fix plan

1. Add a console log at the click-handler entry of the propagate button to confirm whether the click is being dispatched at all (handler-detached vs handler-runs-but-no-effect).
2. If handler-detached: identify the re-render path that's losing the listener; fix by re-binding after every render or by event-delegation on a stable parent.
3. If handler-runs-but-no-effect: trace the propagate state machine; ensure the "ready" state is restored in a `finally` block.
4. Ship the fix WITH a V-FLOW regression test:
   ```js
   it("V-FLOW-PROP-2 · propagate dispatchable after propagate → add-disposition-different-layer → propagate", () => {
     // Build engagement with two layers
     // Propagate on layer 1 → assert gap mutates
     // Add disposition on layer 2
     // Click propagate on layer 2
     // Assert: gap mutates AND toast emits (i.e. handler ran AND state machine returned to ready)
   });
   ```

---

## BUG-003 · v2 demo content invisible to Canvas Chat (CLOSED — architectural fix shipped)

**Status**: **CLOSED 2026-05-02** · Architectural fix shipped at commit `49de7a2` (`core/v3DemoEngagement.js`) + `3ce2575` (Load-demo button wires v3 path). Original patch attempt at `7dbb7ad` was REVERTED at `bacc7a0` because it bypassed the v3 schema. **Regression guards**: V-DEMO-1..7 (schema strict + content shape + cross-cutting features + provenance), V-ANTI-RUN-1 (production code does not reach into tests/).
**Reporter**: User during chunk D smoke
**Severity**: High (chat surface returns "the canvas is empty" against any v2 session — the demo and any user-loaded session both)
**Regression**: No (new feature; bridge was scoped to customer-only in rc.1 by design)

### Repro

1. Click "Load demo" footer button (loads the v2 demo session: 19 instances, 7 gaps, 4 envs, 3 drivers).
2. Click topbar "Chat" button.
3. Ask "How many open gaps do we have?" or any question that should surface session content.

### Expected

Anthropic responds with grounded answers citing actual gap descriptions, environment names, vendor mix from session content.

### Actual

Anthropic responds "the canvas is empty — there are no environments or instances currently defined" because the v3 engagement store carries only customer info; drivers/envs/instances/gaps collections are empty.

### Root cause

`state/v3SessionBridge.js` (rc.1 design) translates **only** `customer` fields from v2 sessionState into the v3 engagement. Drivers, environments, instances, and gaps are left at the empty defaults from `createEmptyEngagement()`. Canvas Chat correctly reports an empty engagement because there's nothing in the engagement except customer.

### Why the patch was reverted

The first attempted fix (`7dbb7ad`) widened the bridge to translate the full v2 session into v3-shape collections, but produced a "loose-shape" engagement that **deliberately bypassed `EngagementSchema.safeParse`** because v2 short-string ids (`"coreDc"`, `"w-001"`, `"g-001"`) violate the v3 schema's UUID requirement. The patch was rationalized as "the chat consumers don't validate." That is exactly the architectural compromise forbidden by `feedback_no_patches_flag_first.md` (newly locked memory) and `project_v3_no_file_migration_burden.md` ("v3 is not bent for v2 conversion"). The patch:
- Hard-codes v2 entity field knowledge into a v3 module.
- Produces an engagement that fails strict schema, breaking any future strict consumer (the **Save** button via `buildSaveEnvelope` is the closest one — already reachable today).
- Sets a precedent that future "we'll just bypass validation" decisions can be normalized.

Reverted at `bacc7a0`. Tree restored to customer-only bridge. Banner: 1023/1023 GREEN.

### Architectural fix (not patch)

Build BUG-004 (v3-native demo) FIRST. Then "Load demo" loads a hand-curated, schema-strict v3 engagement directly into `engagementStore` — bypassing the v2 path entirely for the demo case. The bridge stays customer-only for non-demo v2 sessions during the migration window only; once view migrations finish, the bridge dies with sessionState.

**No translation, no patches, no v2 ids in v3 modules.** v2↔v3 conversion is permanently low-priority per user direction.

### Regression test (per `feedback_test_what_to_test.md` "V-FLOW or it didn't ship")

Once BUG-004 lands, add **V-FLOW-CHAT-DEMO-1**:
```js
it("V-FLOW-CHAT-DEMO-1 · click Load demo → Chat → ask 'how many gaps' → response cites real demo gap count", async () => {
  // Click footer Load demo. Wait for engagement to populate.
  // assert engagementStore.getActiveEngagement().gaps.allIds.length === <known v3 demo gap count>
  // open chat, send "how many open gaps", await response
  // assert response contains the count + at least one gap description from the demo
});
```

Also add **V-DEMO-1..N** schema-validity vectors (per BUG-004 fix plan).

---

## BUG-005 · V3SkillBuilder uses test fixture as production runtime engagement (CLOSED)

**Status**: **CLOSED 2026-05-02** · Architectural fix shipped at commit `3ce2575`. V3SkillBuilder now uses `getActiveEngagement()` (live engagement set by Load-demo → loadV3Demo() OR by the bridge for non-demo v2 sessions) with a `loadV3Demo()` fallback. The `tests/perf/buildReferenceEngagement` import was dropped entirely from `ui/views/V3SkillBuilder.js`. **Regression guard**: V-ANTI-RUN-1 (source-grep over production modules; FILES list includes ui/views/V3SkillBuilder.js).
**Reporter**: Codebase audit (2026-05-02 trust-rebuild)
**Severity**: Major debt (v3 production code reaches into `tests/` for runtime data; layer separation broken; no V-ANTI gate)
**Regression**: No (architectural choice from beta build)

### Repro

Open the v3.0 Skill Builder Lab via the "v3.0 Lab" topbar button. Click "Run skill (mock LLM)" on a seed.

### Expected

The skill runs against either (a) the live engagement (so the user sees their actual data resolved into the prompt), or (b) a hand-curated v3-native demo engagement.

### Actual

The skill runs against `buildReferenceEngagement()` imported from `tests/perf/buildReferenceEngagement.js` — a synthetic 200-instance fixture built for performance regression testing.

### Root cause

`ui/views/V3SkillBuilder.js:25` imports a test fixture for production runtime use. Convenient when the Lab was first wired (the v3 engagement store didn't exist yet), but now violates the layer separation: production code MUST NOT import from `tests/`.

### Architectural fix (not patch)

Two-part:
1. Once BUG-004 ships, the Lab uses `getActiveEngagement()` from `state/v3EngagementStore.js`. The active engagement IS the v3-native demo (after Load demo click) or the user's bridged session.
2. Remove the `import { buildReferenceEngagement } from "../../tests/perf/buildReferenceEngagement.js"` line from V3SkillBuilder. The fixture stays in `tests/perf/` for V-PERF-* + the test runner.

### Regression test

**V-ANTI-RUN-1**: source-grep production modules under `services/`, `state/`, `ui/`, `core/` for any `from "../tests/` or `from '../../tests/'` import. Should match zero. Currently matches at least V3SkillBuilder + CanvasChatOverlay (BUG-006 + BUG-007).

```js
it("V-ANTI-RUN-1 · production code does not import from tests/ at runtime", async () => {
  const FILES = [...];   // services/*.js, state/*.js, ui/views/*.js, core/*.js
  for (const f of FILES) {
    const src = await (await fetch("/" + f)).text();
    assert(!/from\s+["']\.\.+\/tests\//.test(src), f + " imports from tests/ at runtime");
  }
});
```

---

## BUG-006 · V3SkillBuilder imports test mock provider at runtime (CLOSED)

**Status**: **CLOSED 2026-05-02** · Architectural fix shipped at commits `1c792e3` (`services/mockLLMProvider.js` impl + `tests/mocks/mockLLMProvider.js` thin re-export) + `3ce2575` (V3SkillBuilder import path flipped to `services/mockLLMProvider.js`). **Regression guards**: V-MOCK-1..3 (production-path import + contract + determinism), V-ANTI-RUN-1 (source-grep).
**Reporter**: Codebase audit (2026-05-02 trust-rebuild)
**Severity**: Debt (test code at runtime; production-imports-from-tests anti-pattern)
**Regression**: No (architectural choice from beta build)

### Repro

The Lab's "Mock LLM" toggle dispatches via `createMockLLMProvider` imported from `tests/mocks/mockLLMProvider.js`.

### Architectural fix

Promote the mock to production: NEW `services/mockLLMProvider.js` exports `createMockLLMProvider`. Tests update their imports to the new path. V3SkillBuilder updates its import. The Mock toggle is a legitimate production UX feature (free, deterministic local execution) and deserves a production-located module.

### Regression test

V-ANTI-RUN-1 (shared with BUG-005 + BUG-007); V-MOCK-1: assert `services/mockLLMProvider.js` exists and exports `createMockLLMProvider`.

---

## BUG-007 · CanvasChatOverlay imports test mock provider at runtime (CLOSED)

**Status**: **CLOSED 2026-05-02** · Architectural fix shipped at commits `1c792e3` (`services/mockChatProvider.js` impl + `tests/mocks/mockChatProvider.js` thin re-export) + `3ce2575` (CanvasChatOverlay import path flipped to `services/mockChatProvider.js`). **Regression guards**: V-MOCK-1..3 + V-ANTI-RUN-1.
**Reporter**: Codebase audit (2026-05-02 trust-rebuild)
**Severity**: Debt (same anti-pattern as BUG-006; introduced this session by copying the established wrong pattern)
**Regression**: No (new feature; same architectural choice as the Lab)

### Repro

`ui/views/CanvasChatOverlay.js:29` imports `createMockChatProvider` from `tests/mocks/mockChatProvider.js`. The chat's "Mock" toggle dispatches via this provider.

### Architectural fix

Same shape as BUG-006: NEW `services/mockChatProvider.js` exports `createMockChatProvider`. CanvasChatOverlay updates its import. Tests update their imports.

### Regression test

V-ANTI-RUN-1; V-MOCK-2: assert `services/mockChatProvider.js` exists and exports `createMockChatProvider`.

---

## BUG-008 · `services/canvasFile.js` stale comment claims migrator is a stub (CLOSED)

**Status**: **CLOSED 2026-05-02** · Comment replaced at commit `0eba848` with current behavior description (parses + dispatches via migrator on older schemaVersion, validates strict, runs §S10 sweep, hydrates secondary indexes, reattaches transient fields).
**Severity**: Cosmetic
**Regression**: No

`services/canvasFile.js:91` reads "// (currently a stub — v2.0 migrator integration ships in a later commit)". Lines 110-119 actually invoke the migrator. The comment is stale documentation rot.

### Architectural fix

Replace the stale comment with the current behavior description (parses envelope, dispatches via migrator if older schemaVersion, hydrates indexes, validates). Single-line edit.

### Regression test

No specific regression test (cosmetic). Future doc-rot prevention is covered by the "spec-and-test-first" discipline (`feedback_spec_and_test_first.md`).

---

## BUG-009 · `services/skillRunner.js` stale comment claims structured output is TODO (CLOSED)

**Status**: **CLOSED 2026-05-02** · Comment replaced at commit `0eba848` with current behavior description (parses LLM response as JSON, validates against registered Zod schema, catalog-membership checks with MAX_CATALOG_RETRIES retry budget, validationStatus 'invalid' on exhaustion).
**Severity**: Cosmetic
**Regression**: No

`services/skillRunner.js:9` reads "// - structured: TODO — when first structured-output skill lands". Lines 71-104 implement the structured-output mode (with retry budget + catalog validation). The TODO is stale.

### Architectural fix

Replace the stale comment with the current behavior. Mention the `MAX_CATALOG_RETRIES` retry budget so the comment becomes a real reference.

### Regression test

No specific regression test (cosmetic).

---

## BUG-010 · Canvas Chat says "canvas is empty" against the v3 demo (CLOSED — architectural fix shipped)

**Status**: CLOSED 2026-05-02 PM · v3.0.0-rc.2 · commit `7172737`
**Reporter**: User (workshop validation against rc.2 build)
**Severity**: High (chat-perfection arc headline feature unusable against demo)
**Regression**: Yes — from rc.2 chat-perfection arc landing on top of unchanged v2/v3 demo dual-source-of-truth + bridge clobber

### Repro (pre-fix)
1. Click Load demo
2. Open Canvas Chat
3. Ask "what are my highest priority gaps?"
4. → "the canvas is empty" / "no gaps in the engagement"

### Root cause
`state/sessionBridge.js` overwrote the active engagement with a customer-only translation of the v2 session on EVERY v2 session-changed emit. The Load-demo handler's `setActiveEngagement(loadDemo())` set the rich v3 engagement, but any subsequent v2 emit (boot, save, edit) clobbered drivers/envs/instances/gaps back to 0. Chat then truthfully reported the canvas was empty.

### Fix
3 coordinated changes in commit `7172737`:
1. **Rich v3 demo** (`core/demoEngagement.js`): Acme Healthcare Group narrative with 3 drivers (cyber resilience / AI & data / sovereign cloud), 4 envs, 14 current + 9 desired instances, 8 gaps spanning all 5 GAP_TYPES with full driver→Dell-solution mapping.
2. **Bridge shallow merge** (`state/sessionBridge.js`): the bridge now patches ONLY fields it explicitly translates today (customer.{name,vertical,region,notes}). Drivers/envs/instances/gaps in the active engagement are preserved across emits.
3. **v3→v2 down-converter** (`state/v3ToV2DemoAdapter.js` NEW): pure function `engagementToV2Session(eng)`. Demo-load now derives v2 sessionState from the v3 demo so v2 view tabs see the same data as chat.

### Regression tests (in commit)
- V-FLOW-CHAT-DEMO-1: emit v2 session-changed AFTER setActiveEngagement(v3demo) does NOT clobber gaps/instances/drivers
- V-FLOW-CHAT-DEMO-2: bridge shallow-merges v2 customer changes WITHOUT clobbering v3 entities
- V-DEMO-V2-1: down-converter mirrors customer/drivers/envs/counts; envIds/driverIds re-keyed to catalog typeIds
- V-DEMO-8: rich demo carries 3 drivers + 4 envs + every driver linked by ≥1 gap
- V-DEMO-9: gap_type coverage spans all 5 types

---

## BUG-011 · Settings modal: cannot save Anthropic API key (CLOSED — user confirmed working 2026-05-03)

**Status**: **CLOSED 2026-05-03** · User confirmation during rc.3 #7 review: *"the API key for anthropic is fine."* No repro reproduced; no fix committed; no regression test added (no fix to guard). The investigation 2026-05-02 PM that probed the Save flow end-to-end (localStorage write + reopen-shows-key) was correct.
**Reporter**: User
**Severity**: High (blocks Real-Anthropic chat path) — IF reproducible; my probe shows save works
**Regression**: Unknown

### Repro (user-reported)
1. Open Settings (gear icon) → AI Providers tab
2. Click "Anthropic Claude" provider pill
3. Type API key in the password field
4. Click Save
5. → User reports key not saved (close + reopen shows empty? unclear)

### Investigation 2026-05-02 PM
- Probed Save flow in browser: clicked Anthropic pill → typed key → clicked Save → localStorage `ai_config_v1.providers.anthropic.apiKey` matched typed value → close+reopen showed the field repopulated with the saved key
- Save handler walks `.overlay-body` finding `_settings` ref, writes to `refs.config.providers[refs.activeKey].apiKey`, calls `saveAiConfig(refs.config)` → `localStorage.setItem('ai_config_v1', ...)`. All paths green.
- Possible explanations not yet verified:
  - User clicked Close (gray, left) instead of Save (blue, right) — easy to confuse in dark theme
  - "✓ Saved" feedback flashes for only 1500ms then resets — user may have missed the confirmation
  - Some specific browser / extension / private-mode interaction not in my repro
  - Bug specifically triggered by a flow path I didn't try (e.g., switch from Skills tab → Providers, then save)

### Fix plan
1. Get user repro details:
   - Was Save (blue, right) vs Close (gray, left) clicked?
   - Was the green "✓ Saved" flash visible on the button?
   - On reopen with Anthropic selected, was the key field empty/dots/something else?
   - Did "Test connection" report success after save?
2. If reproducible:
   - Likely fix: lengthen success-feedback dwell from 1500ms to 4-5s; add a persistent "Last saved at HH:MM" timestamp under the field
   - Regression test: V-FLOW-SETTINGS-SAVE-1 — drive the full open→pill→type→save→close→reopen DOM flow and assert key persists
3. If NOT reproducible after detailed probe:
   - Close as "could not reproduce after investigation"

---

## BUG-013 · Canvas Chat output leaks UUIDs / internal field names / version markers in user-facing prose

**Status**: OPEN · Reported 2026-05-02 PM · v3.0.0-rc.2 · Scheduled NEXT (Path A polish)
**Reporter**: User (workshop validation after BUG-012 fix landed)
**Severity**: Low (cosmetic — not data-correctness; explicitly flagged "non-critical" by user)
**Regression**: No (pre-existing surface from v3.0.0-rc.2 chat-perfection landing)

### Repro
1. Click Load demo
2. Open Canvas Chat
3. Ask any question that triggers tool-use
4. → Response sometimes contains:
   - Long instance UUIDs (`00000000-0000-4000-8000-00f100000005`) instead of human labels
   - Internal field names (`layerId`, `environmentId`, `affectedEnvironments`)
   - Version markers (`v3`, `engagement.meta.schemaVersion`) in user-facing prose

### Suspected root cause
- The data contract role section says "Use HUMAN-READABLE LABELS, not bare ids" but doesn't explicitly forbid UUIDs in prose or internal field names
- Selectors return UUID-keyed structures (e.g., `selectGapsKanban.byPhase.now.open` is `[gapId, gapId]` not `[gapDescription, gapDescription]`); the LLM has to manually JOIN to get labels and may forget
- No anti-leakage assertion in tests today

### Fix plan (Path A · 1-2 commits)
1. **Tighten role section** in `services/systemPromptAssembler.js`: explicit prohibition on UUID emission, internal field names, and version markers in user-facing text. Reframe "labels not ids" rule as enforced by NEVER-emit list.
2. **Enrich selector outputs** so the LLM doesn't have to manually join:
   - `selectGapsKanban`: per-gap entry includes `description` + `urgencyLabel` + `driverLabel` alongside `id`
   - `selectVendorMix.byEnvironment`: include `envAlias` alongside UUID key (mirrors `selectMatrixView.cells` which already does this)
   - `selectLinkedComposition`: ensure all linked-entity records include human labels
3. **Regression test V-CHAT-20** (anti-leakage): drive a chat turn against the rich demo with a mock provider that scripts a "leaky" response (contains UUIDs + `layerId`); assert post-processing strips them OR the role-section instruction prevents emission. Also: scripted "clean" response passes through unchanged.
4. Update RULES §16 CH3 (LLM presentation contract) to reflect the strengthened anti-leakage rule.

### Out of scope
- Refactoring all selectors to be label-first (would break 7+ existing test vectors). Limit enrichment to ADDITIVE fields (UUIDs preserved, labels added).
- Post-processing the LLM's text output to scrub UUIDs (fragile, defer to v3.1 if Path A enrichment + role section are insufficient).

---

## BUG-015 · Handshake prefix leaks on subsequent turns when LLM disobeys "first turn only" rule (CLOSED)

**Status**: CLOSED 2026-05-02 PM · v3.0.0-rc.2 · commit `eb2ffc8`
**Reporter**: User (chat workshop validation)
**Severity**: Medium (cosmetic but unprofessional in front of executives)

### Repro (pre-fix)
1. Have an active chat session (any model, more common with Gemini)
2. Ask a follow-up question (transcript non-empty)
3. → Response begins with `[contract-ack v3.0 sha=a345f849]\n\nThe answer is...`

### Root cause
`services/chatService.js` only ran the handshake parser when `transcript.length === 0`. Models that disobey the role-section "first turn only" instruction (Gemini does this intermittently) leak the prefix on every turn.

### Fix (in commit `eb2ffc8`)
- Compute `handshakeMatch` always; strip from `visibleResponse` regardless of turn
- ContractAck still ONLY populated on first turn (the truth signal only matters there)
- V-CHAT-23 regression test: subsequent-turn handshake stripped silently

---

## BUG-016 · Handshake leak: BRACKET-OPTIONAL strip + chatMemory backfill heal (CLOSED)

**Status**: CLOSED 2026-05-02 PM · v3.0.0-rc.2 · commit (this fix)
**Reporter**: User (workshop validation, "this is still showing in the chat")
**Severity**: Medium (BUG-015 was incomplete)

### Repro (pre-fix)
1. After BUG-015 fix landed, user reported still seeing `contract-ack v3.0 sha=a345f849` in responses
2. Specifically against Gemini

### Root cause
- `HANDSHAKE_RE` required literal `[...]` brackets. Gemini emits the prefix WITHOUT brackets ("contract-ack v3.0 sha=a345f849"). The regex didn't match, so no strip.
- Old transcripts persisted to localStorage carry the leak; the chatService strip only fires on NEW responses, not on load. Reloading the chat surfaces the historical leak.

### Fix (in commit this entry references)
1. `services/chatService.js`: NEW `HANDSHAKE_STRIP_RE` (global, bracket-optional, scrubs any occurrence). Applied to every response unconditionally. `HANDSHAKE_RE` (strict, anchored) still used for first-turn ack capture.
2. `state/chatMemory.js`: `loadTranscript` now strips the same handshake regex from every assistant message at load time, so old transcripts heal automatically.
3. V-CHAT-24: bracketless handshake stripped
4. V-CHAT-25: chatMemory.loadTranscript heals persisted leaks (both bracketed + bracketless)

### Out of scope
- Tightening the role section to also forbid the bracketless variant (the model should not emit it at all). Defer to Phase 4 polish; the strip is bullet-proof regardless.

---

## BUG-017 · Mock provider toggle clutters chat header (UNCONFIRMED — awaiting user direction)

**Status**: OPEN · Reported 2026-05-02 PM · v3.0.0-rc.2 · Scheduled NEXT (awaiting direction)
**Reporter**: User
**Severity**: Low (UX polish; no functional impact)

### User feedback
"What is Mock? I did not ask for it nor I think I will need it. I did not even know what it does. Can you explain it and remove it if no need for it. Don't want rubbish unused. We can use connection warning and informational messages about the AI status if not connected."

### What Mock does today
The Canvas Chat overlay header has a 2-button segmented toggle: **Mock | Real**.
- **Mock**: in-memory deterministic provider (`services/mockChatProvider.js`); responds to any question with a hard-coded "[mock] you asked: '...'. Switch to a Real provider in the header to dispatch this against your live LLM."
- **Real**: uses the user's configured provider (Anthropic / Gemini / etc. from Settings)

It exists to (a) test chat without burning provider credits, (b) demo offline. For a presales workshop tool with real providers configured, it's dead weight.

### Proposed fix paths
**Path A (recommended)**: Remove the Mock toggle from the chat header. Replace with a connection-status chip: "Connected to Claude" / "Connected to Gemini" / "No provider configured — open Settings ⚙". Click chip → opens Settings modal. Mock provider stays available to tests (`createMockChatProvider` is the test fixture; not user-facing).

**Path B**: Hide Mock behind a `?dev=1` query-param dev mode. Same UX as A for the default user; Mock still accessible for in-browser dev/debug.

### Fix plan (when scheduled)
1. Update `ui/views/CanvasChatOverlay.js` injectHeaderExtras: remove Mock|Real segmented toggle; add connection-status chip
2. Wire chip click → openSettingsModal({ section: "providers" })
3. V-CHAT-26 test: chip text reflects active provider; click opens Settings
4. Update RULES §16 CH13 (chat respects active provider; remove "Mock | Real toggle")

---

## BUG-018 · Gemini hangs / no response for tool-required questions (CLOSED 2026-05-03)

**Status**: **CLOSED 2026-05-03** · Architectural fix shipped at commit `e8d17e4` (Phase A1 generic OpenAI tool-use connector). Phase A1 wired Gemini tool-use via the `functionDeclarations` schema; multi-round chaining works exactly like Anthropic. **Regression guards**: V-CHAT-27..32 (Phase A wire-format + integration round-trip with stubbed Gemini fetch). Specifically V-CHAT-32 drives the EXACT BUG-018 repro at the integration level: a question requiring `selectGapsKanban` resolves through a 2-round Gemini round-trip and surfaces the final text. Real-Gemini live-key smoke deferred to PREFLIGHT item 5 at tag time per `feedback_browser_smoke_required.md` — the test coverage is solid; the live-key smoke is the additional belt-and-suspenders gate.
**Reporter**: User
**Severity**: High (Gemini provider broken for selector-tool questions)

### Repro (user-reported)
1. Set Gemini as active provider in Settings
2. Open Canvas Chat
3. Ask "How many High urgency gaps are open?"
4. → Spinner stuck on "thinking..."; no response ever arrives

### Suspected root cause
- The Anthropic tool-use round-trip is wired (BUG-012 fix); Gemini is NOT
- `services/aiService.js` `buildRequest('gemini')` does NOT pass the tools array
- `services/realChatProvider.js` `supportsToolUse = providerKey === "anthropic"` — Gemini gets `false`
- For a question that NEEDS a tool, Gemini sees the system prompt with selector descriptions but no native tool-use protocol. Likely Gemini either:
  - Emits text describing what it WOULD do but can't (preamble hang)
  - Hits an internal timeout or rate-limit silently
  - Returns empty content the chat overlay doesn't surface

### Investigation needed
- Browser DevTools network tab: what does the Gemini call return?
- Console: any errors from chatCompletion?
- Does Gemini respond to NON-tool questions (e.g., "Summarize the customer's drivers")?

### Fix paths
**Path A**: Wire Gemini tool-use (it has its own `functionDeclarations` schema). New `buildRequest('gemini')` adds `tools: [{ functionDeclarations: [...] }]`; `extractText` parses `functionCall` parts; multi-round chain like Anthropic.

**Path B**: Detect Gemini failure + surface clearly ("Gemini doesn't support tool-use yet — this question needs a selector. Switch to Claude or rephrase to use only the inlined snapshot.").

### Fix plan
1. Reproduce the hang in browser with DevTools open; capture network + console
2. Decide Path A or B based on root cause
3. If A: V-CHAT-27 (Gemini tools schema) + V-CHAT-28 (Gemini tool round-trip)
4. If B: V-CHAT-27 (Gemini falls back to text-only with clear message when tool needed)

### Out of scope (long-term)
- Full Gemini parity with Anthropic (streaming, caching) is rc.3 scope per CH19

---

## BUG-019 · After page reload, canvas data persists in localStorage but Canvas Chat reports "empty" until user clicks Load demo again (CONFIRMED 2026-05-03)

**Status**: **CONFIRMED 2026-05-03** (deterministic repro from user) · v3.0.0-rc.3-dev · Scheduled rc.3 (folded into Group A AI-correctness arc per user direction 2026-05-03)
**Reporter**: User
**Severity**: High (very confusing user-perceived broken state — UI shows the canvas, AI says "empty")
**Regression**: rehydration path — v3 engagement is NOT auto-rehydrated from localStorage on app boot (the Load-demo button is the only path that calls `setActiveEngagement(...)`)

### Repro (user-confirmed 2026-05-03)
1. Load demo (footer → Load demo). Canvas populates (8 gaps, 3 drivers, etc.).
2. Reload the page (F5 / Cmd+R).
3. Canvas data is still rendered in the UI from localStorage `dell_discovery_v1` (v2 sessionState).
4. Open AI Assist (Canvas Chat).
5. Ask anything → assistant says the canvas is empty.
6. Click **Load demo** again → AI now sees the data correctly.

User quote: *"the demo and data are stored in the browser when i reload the app (or in the cach), yet the app doesnt see the data in the AI chat until i load the demo again, very confusing behaviour for the user."*

### Confirmed root cause (post-investigation, rc.3 #4 smoke 2026-05-03)
Two related observations:
- After Load-demo: engagement.gaps.allIds.length = 8 ✅
- After page reload (no Load-demo click): engagement.gaps.allIds.length = 0 ❌, customer.name = "Acme Healthcare Group" ✅ (only the customer survives)

**The v3 engagement store does not rehydrate the gaps / drivers / environments / instances collections from localStorage on app boot.** The v2 sessionState rehydrates fine (the canvas tabs render with all the data) but `state/engagementStore.js` starts at the empty default until something explicitly calls `setActiveEngagement(...)`. Only the Load-demo button does that.

`state/sessionBridge.js` is supposed to translate v2→v3 on `session-changed` events, but boot-time rehydration of v2 sessionState does NOT emit `session-changed` (it loads silently into the existing in-memory v2 store). So the bridge never fires on reload.

### Fix plan (rc.3 / Group A)
1. **Wire boot-time bridge fire**: in `app.js` after v2 sessionState loads from localStorage (existing `loadFromLocalStorage()` call), emit a synthetic `session-changed` event OR call `bridgeOnce("boot-rehydrate")` so the v3 engagement rebuilds from the rehydrated v2 sessionState.
2. **Or**: have `engagementStore.js` self-rehydrate on first read by checking v2 sessionState if engagement is empty (fallback path).
3. **Regression test V-FLOW-REHYDRATE-1**: simulate the user repro — load demo, snapshot engagement, simulate reload (re-import modules / drop in-memory engagement), assert engagement gets rehydrated to the same shape WITHOUT calling Load-demo a second time.

### Why this matters
This is the kind of bug where the app appears completely broken to the user, even though state is correct on disk. Workshop trust depends on AI seeing what the user sees. Hard gate.

---

## BUG-020 · Handshake `[contract-ack v3.0 sha=...]` STILL leaks intermittently in chat (re-opened after BUG-016)

**Status**: OPEN · Reported 2026-05-02 LATE EVENING · v3.0.0-rc.2 · Scheduled NEXT
**Reporter**: User (workshop validation; third report)
**Severity**: Low (cosmetic; not data-correctness; user explicit "don't break working chat to fix this now")
**Regression**: BUG-015 + BUG-016 fixes covered: subsequent-turn strip, bracket-optional regex, chatMemory backfill heal. Some path STILL surfaces it.

### Repro (user-reported)
1. Active chat session
2. AI is "searching information" (i.e., emitting a tool_use round)
3. Handshake reappears in the rendered output

### Possible remaining vectors (hypotheses)
1. **Round-N response after N>1 tool calls**: chatService's multi-round loop may stream PARTIAL text via `onToken` BEFORE chatService strips the handshake from `finalResponse`. The chat overlay's `onToken` paints incrementally; the handshake regex only fires in `onComplete`. If the LLM emits handshake mid-stream (rare but Gemini can be wild), the bubble shows it during streaming and a glitch on paint may leave it visible.
2. **Token-by-token streaming + markdown re-parse**: `renderAssistantMarkdown` is called on every `onToken`; if the accumulated text fragment includes `[contract-ack`, marked may render it as `[link](url)`-style and we don't catch the parse-time leak.
3. **Pre-strip vs post-strip race**: visibleResponse is computed in chatService.streamChat AFTER the loop closes. The chat overlay's `onComplete` sets `assistantMsg.content = result.response`. If the user reads the bubble during streaming (while it shows un-stripped tokens), they see the leak.

### Fix plan
- Add a **streaming-time strip in CanvasChatOverlay's `onToken`**: re-apply HANDSHAKE_STRIP_RE to `assistantMsg.content` before each `renderAssistantMarkdown`. Stripping is regex-based + idempotent; cheap.
- Move the regex constant to a shared spot (`services/chatHandshake.js`?) so chatService + chatMemory + CanvasChatOverlay all use the same source-of-truth pattern.
- V-CHAT-33 regression: drive a streaming path where the LLM emits handshake mid-stream; assert the bubble's textContent never carries `contract-ack`.
- ALSO investigate: maybe the role section needs an even stronger "do not emit this prefix EVER except on first turn" instruction. We currently say "subsequent turns do NOT include this prefix; only the first turn." — some models still emit. Add an explicit penalty: "If you emit this prefix on any turn AFTER the first, your response will appear broken to the user."

### Out of scope
- Switching to a different first-turn ack mechanism (e.g., a structured field in the response) — overkill for v3.0; our regex strip is robust enough once we patch the streaming-time path.

---

## BUG-021 · Performance — Gemini slow + hits rate limits; OpenAI prompt caching not yet wired

**Status**: OPEN · Reported 2026-05-02 LATE EVENING · v3.0.0-rc.2 · Scheduled with the AI completion arc (Phase A3 + future)
**Reporter**: User (workshop validation)
**Severity**: Medium (perf + cost; user has to manually tell Gemini "continue" sometimes)

### User feedback
"The performance in exchanging data with the LLM seems to be not optimal — takes time with Gemini to respond and sometimes I need to tell it to continue because I reach the limit of hits. We need to look into that later. For example, if we can use LLM OpenAI features to cache per session... things like that to enhance LLM utilization and performance as per best practice and modern advice from the LLM vendors."

### Symptoms
1. Gemini responses are slow / occasionally hang on large prompts.
2. User hits "continue / next" prompts because Gemini truncates or rate-limits.
3. We don't yet leverage OpenAI prompt caching (announced 2024 by OpenAI; auto-applied to prompts ≥1024 tokens, ~50% input cost discount on cache hits).
4. Anthropic prompt caching IS wired (cache_control on stable prefix, 5-min ephemeral TTL), but we haven't optimized further (extended-1h caching, longer-prefix maximization).
5. Multi-round tool chaining (BUG-012 fix) compounds latency — 5 rounds × ~2s each can feel slow.

### Investigation + fix plan
1. **Gemini token budgets** — confirm we're under Gemini's per-request token cap; consider compressing engagement snapshot for Gemini specifically (smaller threshold than for Claude).
2. **OpenAI prompt caching** — automatic; no code change needed BUT verify our prompt structure (stable prefix first, volatile suffix last) maximizes cache hits. Phase A3 streaming for openai-compatible should validate this.
3. **Anthropic extended caching** — option to use 1-hour cache (Anthropic's "extended" tier) instead of ephemeral 5-min for workshop-length sessions.
4. **Token-budget visibility** — surface a "tokens used / cached / fresh" hint in the chat header so users see when the cache is hitting.
5. **Concurrent multi-round** — if Claude emits multiple parallel tool_calls in one round, dispatch in parallel (current loop is serial). Big win for "show me 3 things" questions.
6. **Streaming for openai-compatible / Gemini** — Phase A3 polish; per-token streaming feels much faster even when total time is similar.
7. **Provider-specific perf tuning** — e.g., Gemini-2.5-flash defaults to MAX_OUTPUT_TOKENS=8192 which truncates long answers; consider raising or splitting.

### Specific concrete fixes when scheduled
- [ ] Phase A3: SSE streaming for openai-compatible (OpenAI canonical `data: {...}` event grammar).
- [ ] Surface cache-hit telemetry in the chat header (e.g., "● 3.2K cached · 412 fresh tokens").
- [ ] Verify prompt structure: stable prefix (role + dataContract + concept TOC) → cacheable; volatile (engagement + transcript + user msg) → fresh.
- [ ] V-PERF-1..N regression vectors guarding the cache-hit ratio + per-provider latency budgets.

### Out of scope (long-term)
- Server-side gateway with per-customer cache + rate-limit pooling — rc.4 / GA scope; today the keys live in browser localStorage (single-user pattern).

---

## BUG-022 · Chat UI polish — modern shell incomplete (large white button, skills tabs not 2026-AI-product, large spacing, status-message UX)

**Status**: OPEN · Reported 2026-05-02 LATE EVENING · v3.0.0-rc.2 · Scheduled Phase 4-5 (already queued)
**Reporter**: User (workshop validation)
**Severity**: Low (POC works; production polish pending)

### User feedback
"The chat UI is not finished — can use some modern look. It has a large white button, the skills tabs are not up to a modern chatbot look and feel. I think this is already scheduled somewhere for later, just wanted to emphasize it. Also the text is shown with large spaces. The status messages can add very good modern look to the app. It is good now as a POC, but for production, I think we can do better."

### Specific items called out
1. **"Large white button"** — likely the Done/Send button in the footer + the Skills toggle. Need to audit + match the design language of ContextView / SkillBuilder (dark theme, tighter chrome).
2. **Skills tab design** — Phase 4 will populate the right rail with saved-skill cards; the rail eyebrow + title + empty-state look needs polish for production.
3. **Text spacing** — chat bubbles + transcript have generous margins; tighten for density.
4. **Status messages UX** — "thinking…" / "ready" / "no provider" surfaces in the meter row are flat text. Modern chatbots show animated dot loaders, typing indicators, tool-call progress. We should match that.

### Already-queued covering work
- Phase 4a: replace Mock toggle with connection chip — DONE (BUG-017).
- Phase 4b: right-rail populates with saved-skill cards.
- Phase 4c: skill editor slide-over inside chat overlay; Lab tab deprecated.
- Phase 4d: "Use AI" buttons rewired to drop prompts into chat.
- Phase 5a: top-bar consolidation — one AI button.
- Phase 5b-d: smart prompt suggestions, conversation export, better error states.

### NEW polish items from this report (added to Phase 5 scope)
- [ ] Audit + redesign the Done/Send buttons to match dark-theme density.
- [ ] Tighten transcript bubble spacing (line-height, padding).
- [ ] Animated typing/tool-call indicator (dot loader) in the meter row.
- [ ] Tool-call progress UX — "Calling selectMatrixView…" surfaced briefly per round.

### Fix plan
Track inside the existing Phase 4 + Phase 5 commits. Each polish item gets a single-purpose commit so the diff is reviewable.

---

## BUG-023 · Skill-save validator rejects `{{context.<param>.layerId}}` even though the field resolves at run time

**Status**: OPEN · Reported 2026-05-03 (rc.3 #4 smoke) · v3.0.0-rc.3-dev · Scheduled rc.3 polish bucket
**Reporter**: rc.3 #4 SkillBuilder rebuild smoke (browser smoke per PREFLIGHT.md item 5)
**Severity**: Low (run path works; only the **save-time validate** preview surfaces a false negative — same outcome user sees after rc.3 #4 lifts the chip-palette guardrail)
**Regression**: No — pre-existing manifest-generator gap. The v3.0 SkillBuilder hid this by building paths via the chip palette (which only offered manifest-allowlisted paths). The v3.1 builder lets the user (or a migrated seed) reference any field, exposing the manifest-incomplete state.

### Repro
1. Demo loaded; engagement has 8 gaps.
2. Open Skill Builder (Lab tab) → load `dell-mapping` seed.
3. The migrated v3.1 prompt template references `{{context.gap.layerId}}` (and the run path resolves it to `"dataProtection"` correctly — see V-PATH-* coverage of the resolver).
4. Click **Validate**.

### Expected
The save-time path resolver returns ✓ valid because `gap.layerId` is a real schema field that resolves at run time.

### Actual
> Validation failed
> context.gap.layerId: Path 'context.gap.layerId' is not in the manifest for (parameter entityKind=gap)
> Valid paths: customer.name, customer.vertical, customer.region, customer.notes, engagementMeta.engagementDate, engagementMeta.presalesOwner, engagementMeta.status, context.gap.description, …

`context.gap.description` is enumerated; `context.gap.layerId` is not. Yet at run time `Layer: dataProtection` resolves and the mock LLM call succeeds.

### Suspected root cause
`services/manifestGenerator.js` doesn't include all gap fields under the `(parameter entityKind=gap)` namespace it derives. Suspected miss: any gap field whose schema name ends in `Id` (foreign-key columns) is being filtered out as "not user-facing" or similar — but it's exactly the field a user would want to bind in a prompt.

### Fix plan
1. **Spec**: SPEC §S?? small annex describing the manifest-generator contract for parameter-bound entity paths (every schema field that resolves at run time must be enumerated as a valid bind path; foreign-key fields included).
2. **Test (RED first)**: V-PATH-NN saves a skill whose template references every Gap schema field in turn; assert each one validates ✓. RED today on `layerId` (and likely other `*Id` fields).
3. **Fix**: lift any field-name filter in `manifestGenerator.js` so all schema fields surface.
4. **Smoke**: Lab tab → load dell-mapping seed → Validate is ✓.

### Why it's safe to ship rc.3 #4 without this fix
- The **run** path works (resolved prompt + mock LLM both succeed) — this is the contract that rc.3 #5 (chat right-rail) will exercise.
- Save still works (it doesn't gate on the path validator's "valid paths" reachability — it gates on the schema strict-parse). Users who want to save a skill referencing `layerId` can do so.
- Validate is a **preview-time** affordance, not a save-time gate; it shows a non-blocking advisory.

---

## Format reference for new entries

```
## BUG-NNN · One-line headline

**Status**: OPEN · Reported YYYY-MM-DD · vX.Y.Z · Scheduled <bucket>
**Reporter**: who
**Severity**: Low/Medium/High/Critical
**Regression**: Yes/No (and from what)

### Repro
1. ...

### Expected
...

### Actual
...

### Suspected root cause
...

### Fix plan
1. ...
   With regression test: V-FLOW-XXX-N
```
