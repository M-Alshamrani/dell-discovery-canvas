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

## BUG-013 · Canvas Chat output leaks UUIDs / internal field names / version markers in user-facing prose (CLOSED — Path A + Path B both shipped)

**Status**: **CLOSED 2026-05-03** · Path A shipped at commit `d324971` (anti-leakage role section + selector label enrichment; V-CHAT-20/21/22). Path B shipped at commit `66810c6` (rc.3 #10) as runtime UUID-to-label scrub via `services/uuidScrubber.js` applied at chat onComplete + streaming-time onToken; defense-in-depth on top of Path A. **Regression guards**: V-CHAT-20/21/22 (Path A) + V-CHAT-36/37/38 (Path B). Internal field-name + version-marker leakage covered by V-CHAT-20 role-section directives + V-NAME-2 UI-string source-grep; runtime scrub for those classes deferred (they appear too often in legitimate code blocks for a regex scrub to be safe).
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

## BUG-020 · Handshake `[contract-ack v3.0 sha=...]` STILL leaks intermittently in chat (CLOSED — streaming-time strip shipped)

**Status**: **CLOSED 2026-05-03** · Architectural fix shipped at commit `987c7e7` (rc.3 #9). NEW `services/chatHandshake.js` module exports `HANDSHAKE_RE` + `HANDSHAKE_STRIP_RE` + `stripHandshake(text)` helper as a single source-of-truth; `chatService` + `chatMemory` + `CanvasChatOverlay.onToken` all import from the shared module. The streaming-time strip (in onToken, before renderAssistantMarkdown) closes the residual leak path that Pre-fix only handled at onComplete. System-prompt role section also reinforced with a CRITICAL ANTI-LEAK RULE forbidding emission on subsequent turns. **Regression guards**: V-CHAT-33 (single-source-of-truth pattern, no inline regex copies) + V-CHAT-34 (stripHandshake idempotency + bracket-omitted + markdown-emphasis variants) + V-CHAT-35 (onToken-applies-stripHandshake-before-renderAssistantMarkdown structural test).
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

## BUG-023 · Skill-save validator rejects `{{context.<param>.layerId}}` even though the field resolves at run time (CLOSED — gapPathManifest exposes layerId + gapType)

**Status**: **CLOSED 2026-05-03** · Architectural fix shipped at commit `7cf20ec` (rc.3 #11). `schema/gap.js` `gapPathManifest` now exposes `context.gap.layerId` + `context.gap.gapType` as enum-typed own-paths, so the dell-mapping seed prompt template (and any user skill referencing layer / gap-type fields) validates without "not in the manifest" errors. V-MFG-1 locked snapshot regenerated (8744 → 9106 bytes; hash 3a217459 → 709fe1c2; gap ownPaths 5 → 7). **Regression guards**: V-PATH-31 (gapPathManifest exposes both fields with correct type tag) + V-PATH-32 (integration: skill-save validator no longer rejects the user repro template). Browser smoke verified (Validate panel: "✓ Template paths valid; ready to save.").
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
## BUG-024 · Chat assistant leaks raw workflow / concept IDs into user-facing prose (CLOSED — Arc 3c shipped 2026-05-04)

**Status**: **CLOSED 2026-05-04** · Architectural fix shipped at commit `89f8b55` (rc.4-dev / Group B Arc 3c per SPEC §S34.3 + RULES §16 CH30). Same defense-in-depth pattern as BUG-013 UUID scrub: prompt-time directive (role section explicit NEVER-emit on `workflow.<id>` / `concept.<id>` identifiers) + runtime scrub via `services/uuidScrubber.js` extension (`buildManifestLabelMap()` helper + dotted-token regex; replaces with the manifest's user-facing label wrapped in markdown bold, OR `[unknown workflow]` / `[unknown concept]` sentinels for orphans). Streaming-time scrub in CanvasChatOverlay onToken + final scrub in chatService onComplete. Skips fenced + inline code. **Regression guards**: V-SCRUB-WORKFLOW-1..3 (lookup map shape, role-section directive, integration on the actual user-reported leak text "For a full step-by-step procedure, you can refer to the workflow.identify_gaps"). Banner 1129/1129 GREEN at commit time.
**Reporter**: User (workshop validation)
**Severity**: Low (cosmetic; not data-correctness — same class as the BUG-013 UUID leakage)
**Regression**: No (pre-existing surface from Phase B + Phase C concept/workflow grounding)

### Repro (user-reported)
1. Open Canvas AI Assistant
2. Ask any procedural / definitional question
3. → Assistant sometimes ends with phrasing like "For a full step-by-step procedure, you can refer to the workflow.identify_gaps." (the `workflow.<id>` token is an internal manifest identifier, not user-facing)

### Suspected root cause
- The system-prompt role section instructs the LLM to use `selectWorkflow(id)` / `selectConcept(id)` for full bodies. But the IDs themselves (e.g. `identify_gaps`) end up in the LLM's prose because the inlined TOC + recommendations enumerate them.
- BUG-013 Path B (`services/uuidScrubber.js`) handles UUID-shaped tokens; it does NOT scrub `workflow.<id>` / `concept.<id>` patterns.

### Fix plan
- **Path A** (prompt-time discipline): tighten the role section with an explicit NEVER-emit directive on `workflow.*` / `concept.*` identifiers in user-facing prose. Reframe "use selectWorkflow(id) to fetch full bodies" as "the IDs are internal — never quote them back to the user; if the user wants a workflow, narrate the steps instead."
- **Path B** (runtime scrub, defense-in-depth): extend the existing `services/uuidScrubber.js` to also detect `workflow.<id>` + `concept.<id>` patterns and replace with the human-readable label from `core/appManifest.js` / `core/conceptManifest.js`. Idempotent + skips fenced + inline code (same shape as the UUID scrub).
- **Test V-CHAT-NN**: drive a chat turn where a stub LLM emits `workflow.identify_gaps` in its response; assert the rendered bubble shows the workflow's user-facing label, not the ID.

### Out of scope
- This is folded into the Group B / rc.5 UX consolidation arc per user direction 2026-05-03 — discuss + spec-rewrite FIRST, then fix.

---

## BUG-025 · Cmd+K / Ctrl+K opens the legacy AiAssistOverlay (tile-grid skill picker), not the new Canvas AI Assistant — UX inconsistency between button click and shortcut

**Status**: OPEN · Reported 2026-05-03 (post rc.3 tag) · v3.0.0-rc.3 · Scheduled rc.5 (UX consolidation arc · Group B)
**Reporter**: User
**Severity**: Medium (two surfaces both branded "AI Assist" with different shapes — confusing)
**Regression**: Intentional carry-over from rc.3 #13. Per the tag commit notes: "Cmd+K still opens legacy AiAssistOverlay for power users; full retirement scheduled rc.5."

### Repro (user-reported)
1. Press Cmd+K (Mac) or Ctrl+K (Windows)
2. → Legacy v2.4.13 AI Assist tile-grid overlay opens (kind="ai-assist")
3. (User expectation) → The new Canvas AI Assistant should open (the same surface the topbar AI Assist button opens)

### Suspected root cause
- `app.js` `wireAiAssistShortcut()` binds Cmd+K → `openAiOverlay({ tabId: currentStep, context: {} })`, which opens the legacy `ui/views/AiAssistOverlay.js`.
- The topbar AI Assist button (post rc.3 #13) opens Canvas Chat via `mod.openCanvasChat()`.
- Two surfaces both labelled "AI Assist" with different chrome → confusing for the user.

### Fix plan (Group B / rc.5)
1. Rebind Cmd+K to open Canvas Chat (the new unified surface).
2. Retire `ui/views/AiAssistOverlay.js` entirely OR demote to a hidden power-user tile-grid behind a different keybinding (TBD with user during SPEC rewrite).
3. Update VT25 / V-AI-ASSIST-CMD-K to assert Cmd+K opens kind="canvas-chat".

### Out of scope
- v2.x AI admin parity-gate evaluation (`project_v2x_admin_deferred.md`) — the legacy AiAssistOverlay is part of the v2.x admin surface; full retirement decision belongs to that arc, not Group B. For Group B we just rebind the keyboard shortcut to the right destination.

---

## BUG-026 · Diagnostic test pass flashes overlays in user's view during page load (incomplete fix in Hotfix #1)

**Status**: CLOSED in HOTFIX #3 (2026-05-04) — `body[data-running-tests]` cloak applied. Was: OPEN · Reported 2026-05-04 LATE (user re-tested Hotfix #1 on work laptop; bug reproduced) · v3.0.0-rc.4-dev-hotfix2 · Scheduled NEXT (immediate hotfix)
**Closed in commit**: pending v3.0.0-rc.4-dev-hotfix3 commit (regression test V-NO-VISIBLE-TEST-OVERLAY-1 in Suite §T35-HOTFIX1)
**Reporter**: User (workshop demo machine)
**Severity**: High (visible on every load; embarrassing in front of management; same class as BUG-026's parent report 2026-05-04 EARLY)
**Regression**: Partial fix in Hotfix #1 (commit `016bbfe` — `runAllTests` afterRestore force-removes overlays AFTER the test pass completes). Hotfix #1 closed the END-of-pass leak but did NOT address transient overlays VISIBLE DURING the pass.

### Repro (user-confirmed)
1. Hard-reload the app
2. Watch the screen as the diagnostic test pass runs
3. → On slow hardware, multiple overlays (chat, settings, skill builder, ai-assist, confirm-action) flash on screen in quick succession as tests open and close them
4. The flashes look like "the app is opening multiple windows by itself" to a non-developer

### Root cause
The diagnostic test pass runs in the LIVE DOM at every page load (not in an iframe / shadow DOM / separate page). Every test that exercises overlay behavior actually OPENS one in the user's view. Tests do call `closeOverlay()` between cases, but for the duration each is briefly visible. On fast hardware (~1-3s pass) this is barely noticeable; on slow hardware (~5-10s pass), the flashing is glaring.

Specific tests that open overlays include: VT24/VT25 (overlay open/close + Cmd+K), V-CHAT-* (canvas chat), V-PILLS-1..4 (provider switcher), V-FOOTER-CRUMB-1, V-THINK-3..5, V-CLEAR-CHAT-PERSISTS, V-SETTINGS-SAVE-1.

### Fix plan (immediate hotfix)
Hide overlays from the user's view DURING the test run, without breaking tests:
1. Test runner sets `document.body.dataset.runningTests = "1"` at the start of `run()` and clears it at end (via `afterRestore`).
2. CSS rule: `body[data-running-tests] .overlay-backdrop, body[data-running-tests] .overlay { visibility: hidden !important; pointer-events: none !important; }`
3. `visibility: hidden` preserves LAYOUT and COMPUTED STYLES — tests using `getComputedStyle()`, `.click()`, `.getBoundingClientRect()`, `querySelector` all keep working. Only the rendered pixels disappear.
4. `pointer-events: none` prevents accidental user interaction with mid-flight test overlays.
5. Regression test V-NO-VISIBLE-TEST-OVERLAY-1 asserts the body attribute toggles correctly + the CSS rule exists.

### Why visibility:hidden won't break tests
- DOM queries (`querySelector`, `querySelectorAll`) work on hidden elements
- `getComputedStyle()` returns the actual style values (visibility:hidden affects only paint, not the cascade)
- `.click()` synthesises events that fire correctly
- `.getBoundingClientRect()` returns layout coordinates (visibility:hidden preserves layout)
- Class checks (`.classList.contains("open")`) are unaffected
- The only test category that COULD break is screenshot/visual-regression — we don't have any

### Out of scope (deferred)
- Splitting tests into "pure-function" vs "DOM-touching" categories so only the former run at app load. Would be the architecturally correct fix but requires categorizing 1139 tests + updating test runner; multi-arc effort. The visibility-hidden approach gives the same user-visible result for ~10 lines of code.
- Moving the test pass to a separate `/diagnostics` route. Would lose the at-load reassurance the user values.

---

## BUG-027 · Test pass briefly flashes file content / tags / DOM fragments on screen at page load (residual of overlay cloak)

**Status**: OPEN · Reported 2026-05-05 by user (post-rc.4) · v3.0.0-rc.4 · Scheduled rc.5 (low priority — flagged "not a big issue for development for now")
**Reporter**: User (work computer)
**Severity**: Low (visual polish; not blocking)
**Regression**: No (pre-existing class of issue partially addressed by BUG-026 cloak)

### Repro
1. Load the app
2. Watch the screen carefully during the 1-3s test pass
3. → Briefly visible: snippets of test-injected DOM (tags, file content, partial UI fragments) flash on screen between test cases

### Suspected root cause
BUG-026 (HOTFIX #3) cloak hides `.overlay` + `.overlay-backdrop` + `#skillBuilderOverlay` while `body[data-running-tests]` is set. But other test artefacts — DOM nodes appended to body for matrix/gap/summary view rendering, fragment elements probed for `.click()` dispatch, etc. — are NOT covered by the cloak. They show up momentarily as the test pass paints them.

### Fix plan (rc.5 low-priority polish)
1. Audit which DOM-touching tests actually paint to body without parent containment. Target candidates: VT*, V-PROD-*, V-DEMO-* tests that do `document.body.appendChild(probe)`.
2. Option A (broad): extend the BUG-026 cloak to cover `body[data-running-tests] > *:not(#app-header):not(#stepper):not(#main):not(#app-footer):not(#test-banner)` — hides any rogue test probe at body level.
3. Option B (targeted): require tests to scope probes inside an off-screen test sandbox container (`#test-sandbox` with `position:absolute; top:-9999px`).
4. Regression test V-NO-VISIBLE-TEST-FLASH-1: assert no rogue body-level node accumulates during the pass (snapshot body.children before + after; only known app-shell IDs allowed).

### Out of scope
- Re-architecting test runner to use shadow-DOM sandbox (covered by BUG-026 §Out-of-scope deferred).

---

## BUG-028 · Canvas AI Assistant chat doesn't persist when user clicks Skills button (chat-rail entry routes to Settings — chat closes)

**Status**: OPEN · Reported 2026-05-05 by user (post-rc.4) · v3.0.0-rc.4 · Scheduled rc.5 (UX polish — paired with broader chat persistence concern)
**Reporter**: User
**Severity**: Medium (UX continuity gap — workshop-flow disrupted)
**Regression**: New behavior introduced by Arc 4 opener-shim retirement (`8f7a90a`). The pre-Arc-4 standalone overlay path didn't have this problem because Skills opened a separate overlay layered atop chat. Post-Arc-4, opener calls `closeOverlay()` → loses chat overlay → opens Settings.

### Repro
1. Open Canvas AI Assistant (topbar AI Assist button)
2. Type some prompts; build up a transcript
3. Click "Skills" button in chat header (head-extras slot)
4. → Settings opens with Skills builder pill ✅
5. → BUT the Canvas AI Assistant overlay is gone; clicking AI Assist again opens a fresh chat with empty transcript ❌
6. User wants the chat to STAY OPEN underneath Settings, so closing Settings returns to the still-running chat

### Expected (per user direction)
"if I am on the chat AI Assist and need to open any other AI tools, the chat AI should persist until I close it, in a good UI/UX design way."

Implementing this means: AI-tool overlays (Settings → Skills builder, future tile-grids, etc.) should stack OVER the chat (or open as a side-panel) instead of replacing it. Closing the over-stacked overlay should return the user to the still-running chat with transcript intact.

### Suspected root cause
Two architectural overlaps:
1. `ui/components/Overlay.js` is a SINGLETON — only one overlay open at a time. When Settings opens via `openSettingsModal({ section: "skills" })`, the singleton replaces the chat overlay node. The chat's transcript state lives on the DOM node that just got destroyed.
2. `ui/skillBuilderOpener.js` (rewritten in Arc 4b at `8f7a90a`) explicitly calls `closeOverlay()` before opening Settings — that's where the chat goes away.

Note: the chat transcript IS persisted to localStorage per-engagement (per SPEC §S20.6 chatMemory). Re-opening the chat does NOT restore the open-but-not-yet-sent draft + the transcript scroll position. So even with persistence, the workflow continuity loss is real.

### Fix plan (rc.5 UX consolidation arc)
This is the same architectural gap that drives the broader "AiAssistOverlay full retirement" discussion in HANDOFF rc.5 plan. Both issues come back to the singleton Overlay.js — when one AI surface opens another, the first must persist underneath, not be replaced.

Three candidate approaches (decide during rc.5 SPEC rewrite session per `feedback_group_b_spec_rewrite.md`):
1. **Stacked overlays** — extend Overlay.js to track a stack instead of a single slot; `openOverlay()` pushes, `closeOverlay()` pops. Z-index layered. Backdrop click closes top-most only.
2. **Side-panel pattern** — Settings (and other AI tools) renders as a side-panel that slides in from the right while the chat stays mounted on the left. Half-screen split. Closing the panel restores full-screen chat.
3. **Modal-over-chat** — Settings opens as a modal AT TOP of chat overlay (chat overlay receives a backdrop dim but its DOM stays mounted). Most surgical change.

Per user direction "in a good UI/UX design way" — option 2 (side-panel) is the standard ChatGPT/Claude.ai pattern for settings-while-chatting. Option 3 is fastest to ship.

Regression test V-FLOW-CHAT-PERSIST-1: open chat → type prompt (don't send) → click Skills → Settings opens → close Settings → chat is still open with the unsent prompt + transcript.

### Out of scope (deferred to rc.5 SPEC rewrite)
- Decision on which approach (1 / 2 / 3) — needs UX design pass.
- Behavior for OTHER overlays (gear settings opened from outside chat; confirmAction; etc.) — broader Overlay.js redesign.
- AiAssistOverlay (legacy tile-grid) full retirement — same architectural concern; folded into rc.5.

---

## BUG-029 · Canvas AI Assistant chat transcript persists across session boundaries (clear-all-data + new-session do not reset chat memory)

**Status**: CLOSED rc.6 / 6d · root cause confirmed + architectural fix shipped via `state/sessionBridge.js` cleanup hook on `session-reset` event · V-FLOW-CHAT-LIFECYCLE-1 + V-FLOW-CHAT-LIFECYCLE-2 added as regression tests · v3.0.0-rc.5 → rc.6

### Investigation note (2026-05-05 · 6d · root cause confirmed)

**Root cause** (architecture-class):

The v2 `state/sessionStore.js resetSession()` only clears the v2 `session` object. The v3 `state/engagementStore.js` is decoupled — its `_active` engagement (with engagement-id) is UNCHANGED on session-reset. Result: after "+ New session", `getActiveEngagement().meta.engagementId` returns the SAME id as before; chat overlay calls `loadTranscript(sameId)` and gets the OLD transcript back from localStorage.

The v2/v3 sessionBridge subscribes to session-changed events but only ever shallow-merges customer fields into the v3 engagement. It had no handler for `reason === "session-reset"` — so v3 stayed bound to the prior engagement.

"Clear all data" was already correct (it does `localStorage.clear()` + page reload — wipes everything).

### Fix (rc.6 / 6d, this commit)

`state/sessionBridge.js` `bridgeOnce(reason)` now handles `reason === "session-reset"` explicitly:
1. Captures the prior engagement-id from `getActiveEngagement().meta.engagementId`.
2. Calls `clearTranscript(priorEngagementId)` to drop the chat memory key from localStorage.
3. Calls `setActiveEngagement(createEmptyEngagement())` to swap v3 to a fresh engagement.

Why through the bridge (not sessionStore.resetSession itself):
- The sessionBridge is the v2↔v3 lifecycle owner per its module header. resetSession() emits a session-changed event; the bridge IS the subscriber that translates that event into v3 actions.
- Keeps sessionStore.js layer-pure (no direct chatMemory or engagementStore imports).
- Same place future "session-replace" / "session-import" handlers go.

### Regression tests (per feedback_test_or_it_didnt_ship.md)

- `V-FLOW-CHAT-LIFECYCLE-1` — author transcript at id1; `resetSession()` + bridge dispatch; assert `loadTranscript(id1).messages.length === 0`.
- `V-FLOW-CHAT-LIFECYCLE-2` — loadTranscript(current-engagement-id) returns empty after `+New session` regardless of whether engagement-id changed.

### Architectural alignment with §S37 grounding recast

This fix is consistent with the §S37 principle: engagement is the AUTHORITATIVE context for chat. When the user resets the engagement, EVERYTHING bound to it (including chat memory) must follow. The lifecycle is now coherent: engagement-id is the cleanup key + the binding key, and both are managed by the bridge on session-changed events.

### Out of scope (already correct)

- "Clear all data" path: `localStorage.clear()` + reload is already correct; no change.
- File open path (`session-replace`): the file's engagement (or fresh seed) takes over; prior chat transcript orphans but is harmless. The post-rc.6 mock-purge arc may add an orphan-pruner pass on app boot if storage bloat becomes an issue.

---

**Status**: OPEN · Reported 2026-05-05 by user (office workshop test) · v3.0.0-rc.5 · Scheduled rc.6 (HIGH PRIORITY — ROOT CAUSE FIX REQUIRED)
**Reporter**: User (workshop demo machine)
**Severity**: High (cross-session leak of customer data; impacts workshop reset workflow)
**Regression**: Yes — predates rc.5 chat persistence work; the side-panel BUG-028 fix was scoped to within-session UI persistence and didn't touch transcript storage scope.

### User direction (locked discipline)
*"i think there is a more rooted implemenation error that is also making the results of the chat with the local chat crappy. ... no patching here but fixing of the source cause to actually improve results, not just put guard rails."*

Per `feedback_no_patches_flag_first.md` — investigate transcript storage architecture before any code change. If a patch is the only path, surface alternatives + wait for direction.

### Repro
1. Load demo session
2. Open Canvas AI Assistant; ask 2-3 questions; build up a transcript
3. Click footer "Clear all data" OR "+ New session"
4. Re-open Canvas AI Assistant
5. → OLD chat transcript is still there (questions + answers from the previous session)

### Expected
"Clear all data" + "+ New session" should reset the chat memory along with everything else. Each engagement is a clean slate.

### Suspected root cause (ROOT CAUSE — confirm before fix)
`state/chatMemory.js` persists transcript to localStorage keyed by `engagementId` per SPEC §S20.6. The cleanup paths (`clearAllData`, `replaceSession({ ...empty })`, demo-load) likely don't enumerate + drop the chat-memory keys. So a session change creates a NEW engagement record but the OLD transcript stays in localStorage indexed by the OLD engagement's id — and the chat re-binds it on next open via the `engagementId` lookup.

Also possible: the engagement-id resolution logic may be falling back to a default/cached id that doesn't change with "+ New session", so the transcript binds to a stable-but-stale key.

### Investigation plan (root-cause discipline; no patches)
1. Map the full lifecycle: where is `engagementId` generated, persisted, swapped on new-session, and how chatMemory binds to it.
2. Identify where the cleanup gap is (most likely: `state/sessionStore.js clearAll()` or `state/engagementStore.js _resetForTests()`-equivalent for production).
3. Confirm whether the broken path is: (a) chat memory not keyed by current engagementId, OR (b) clear-all leaves chat memory orphaned in localStorage, OR (c) engagementId not actually changing on new-session.
4. Surface the architectural fix to user BEFORE writing code (per `feedback_no_patches_flag_first.md`).

### Out of scope
- Adding a "Clear chat" button as a workaround. The user explicitly rejected this approach.
- Tying chat-memory cleanup to UI buttons via add-hoc hooks.

---

## BUG-030 · AI assistant hallucinates engagement data (Anthropic + Gemini; gaps + dispositions invented out of thin air)

**Status**: ROOT CAUSE CONFIRMED 2026-05-05 · investigation+architecture commit shipped in rc.6 / 6a (SPEC §S37 + RULES §16 CH33 + §T38 V-FLOW-GROUND-* RED scaffolds + groundingRouter/Verifier/grounded-mock STUBS). Plane 1 impl in 6b will close primary; plane 2 in 6c closes the date/phase fabrication subclass · v3.0.0-rc.5 → rc.6

### Investigation note (2026-05-05 · 6a · principal-architect investigation)

**Root cause** (architecture-class, two layers):

1. **Layer 4 threshold cliff.** `services/systemPromptAssembler.js:36-38` defines `ENGAGEMENT_INLINE_THRESHOLD_INSTANCES = 20`, `_GAPS = 20`, `_DRIVERS = 5`. `buildEngagementSection` branches to "counts-only summary" when ANY threshold is exceeded (`isSmall = inst≤20 && gap≤20 && drv≤5`). The Acme Healthcare demo ships 23 instances + 8 gaps + 3 drivers: `23 > 20` → `isSmall=false` → engagement section drops gaps + instances entirely from Layer 4. Only counts + drivers + customer remain. The LLM is left with "INVOKE the appropriate analytical view tool" instruction and zero gap data in the prompt.

2. **Tool invocation is not a guarantee, it's a hope.** The architecture relied on real-Anthropic + real-Gemini reliably calling `selectGapsKanban` / `selectMatrixView` whenever they need gap data. Real LLMs are imperfect at this — `tool_choice: "auto"` lets them skip tools whenever their training-data prior is confident. Anthropic + Gemini both ship strong Dell + healthcare + IT-modernization priors and gladly fill the information-sparse prompt with plausible-sounding fabrication.

The 1169 V-CHAT GREEN test count did not catch this because `services/mockChatProvider.js createMockChatProvider` yields scripted responses without ever reading `call.messages`. Orchestration plumbing was tested; the grounding contract was not.

**Architectural recast (locked 2026-05-05 by user)**: RAG-by-construction. See SPEC §S37 + memory `project_grounding_recast.md`. Three planes (all required, all approved):
- Plane 1 — `services/groundingRouter.js` deterministic intent classifier → selector calls inlined into Layer 4 BEFORE LLM call (closes BUG-030 primary + BUG-033)
- Plane 2 — `services/groundingVerifier.js` post-response cross-reference → render-error replaces hallucinated visible response (closes BUG-030 fabricated-date subclass: the Local-B "Q2 close / June 30" workshop screenshot)
- Plane 3 — `createGroundedMockProvider` reads Layer 4 + answers from prompt only (RED-test infrastructure for the grounding contract)

Threshold removal: `ENGAGEMENT_INLINE_THRESHOLD_*` constants gone in 6b (V-ANTI-THRESHOLD-1 source-grep guard against re-introduction). Replaced with token-budget guard at ~50K input tokens applied to router output.

**SPEC + RED scaffolds in 6a · this commit**: SPEC §S37 LOCKED · RULES §16 CH33 added + CH3 rewritten · TESTS §T38 V-FLOW-GROUND-1..7 + V-FLOW-GROUND-FAIL-1..5 + V-ANTI-THRESHOLD-1 · groundingRouter.js + groundingVerifier.js + createGroundedMockProvider STUBS · APP_VERSION → 3.0.0-rc.6-dev. Tests RED by design. 6b + 6c land impl that turns them GREEN.

---

**Status**: OPEN · Reported 2026-05-05 by user (office workshop test) · v3.0.0-rc.5 · Scheduled rc.6 (HIGHEST PRIORITY — affects core value prop; ROOT CAUSE FIX REQUIRED)
**Reporter**: User (workshop demo machine)
**Severity**: Critical (the AI grounding architecture promises "no hallucinations"; user observed otherwise on real-LLM providers)
**Regression**: Possibly an architectural gap that's been latent since the rc.2 chat-perfection arc shipped Real-LLM integrations — never surfaced because earlier tests used mock fetches.

### User direction (locked discipline)
*"the results when i use claude or gemini are made up and not nessasurly interegation with actual data in the session, but someting out of thin air, like made up gaps that are not in the session, or dispositions that are not there ... again no patching here but fixing of the source cause to actually improve results, not just put guard rails."*

Per `feedback_no_patches_flag_first.md` + the 3-PHASE AI ARCHITECTURE PLAN (per HANDOFF rc.3 §3): the LLM is grounded via (a) data contract + handshake (R25/R20.16), (b) selectors-as-tools (R20.4–R20.7), (c) concept manifest + workflow manifest (R27/R28). If the LLM is hallucinating, ONE of these layers is broken in production for real-LLM providers.

### Repro
1. Load Acme Healthcare demo (8 gaps, 3 drivers, 4 envs, 23 instances per `core/demoEngagement.js`)
2. Switch active provider to real-Anthropic OR real-Gemini (with valid API keys)
3. Ask Canvas AI Assistant: "summarize the gaps" OR "what dispositions does the customer have?"
4. → Response includes gaps / dispositions / drivers that are NOT in the engagement

### Investigation plan (root-cause discipline; no patches)
1. Verify the data-contract handshake works on real-Anthropic + real-Gemini (not just mock). The `[contract-ack v3.0 sha=<8>]` chip should appear; if absent on a turn, grounding broke.
2. Verify the system prompt sent to real-Anthropic actually includes the engagement snapshot per `services/systemPromptAssembler.js` (5-layer assembly — log the wire body for ONE turn against real-Anthropic, diff against the mock-fetch wire body).
3. Verify the tool-use round-trip works on real-Anthropic + real-Gemini. If the LLM never calls `selectGapsKanban` / `selectMatrixView` etc., it's relying on its training-data prior instead of live data.
4. Verify the role section's NEVER-emit directives (BUG-013 / BUG-024 anti-leakage) are present on real-LLM provider wire — could be conditionally stripped on translation in `services/aiService.js` Anthropic / Gemini paths.
5. Check whether any of Hotfix #2b's defensive translations (collapse-system-messages, content-as-empty-string) accidentally drop critical context on the Anthropic/Gemini path. The fix targeted local OpenAI-compat; could have over-applied.

### Suspected hot spots (in priority order)
1. **`services/aiService.js` Anthropic + Gemini wire builders** — verify the system block actually carries the engagement snapshot. Anthropic uses `system:` field separately from `messages`; if the snapshot is in messages but Anthropic strips it, no grounding.
2. **`services/realChatProvider.js`** — tool-call extraction on real providers; if tools never fire, no live-data fetch.
3. **`services/chatService.js` streamChat orchestration** — multi-round chains may bail early on real providers.
4. **System-prompt token budget** — if the snapshot exceeds Anthropic / Gemini context limits, it may be silently truncated upstream.

### Real-LLM smoke missing from rc.4 + rc.5 PREFLIGHT
Per HANDOFF rc.5 §6: "Real-LLM live-key smoke (Anthropic + Gemini + Local) deferred to first user-driven workshop run". This is that workshop run. The smoke produced HARD evidence of the failure. Real-LLM smoke needs to be a tag-time PREFLIGHT item starting rc.6.

### Out of scope
- Adding "I'm not sure" guardrails to the system prompt as a band-aid. User explicitly rejected this — the root cause needs to be found.

---

## BUG-031 · Propagate-criticality toast text always says "Low" regardless of actual propagated level (visible regression on rc.5; tightens BUG-001 scope)

**Status**: OPEN · Reported 2026-05-05 by user (office workshop test) · v3.0.0-rc.5 · Scheduled rc.6 (MEDIUM)
**Reporter**: User
**Severity**: Medium (functional behavior is correct; toast string is misleading)
**Regression**: Already-OPEN BUG-001 + BUG-002 are propagate-criticality tracking; user observation now confirms the toast-text path is the specific gap.

### Repro
1. In Current state OR Desired state tab, set a workload-tier instance to "High" criticality
2. Trigger propagate (button or auto-flow)
3. → Linked-disposition / linked-instance criticality DOES upgrade upward (correct functional behavior)
4. → Toast / popup message says "Criticality level low" (always — regardless of the actual level propagated)

### Suspected root cause
`interactions/matrixCommands.js` (or wherever `propagateCriticalityUpgrades` runs) likely surfaces the toast via a function that takes the SOURCE level — or a hard-coded "low" string — instead of the EFFECTIVE upgrade level applied to dependents.

### Fix plan
Identify the toast call site; bind the message to the actual level applied. Add V-FLOW-PROPAGATE-CRITICALITY-TOAST-1 regression: synthesise a propagate from a "High" instance, capture the toast text, assert it reflects "high" (not "low").

---

## BUG-032 · Gaps tab desired-state asset linking button grayed out / not clickable (regression of an older fix)

**Status**: OPEN · Reported 2026-05-05 by user · v3.0.0-rc.5 · Scheduled rc.6 (MEDIUM)
**Reporter**: User
**Severity**: Medium
**Regression**: Yes — user notes "an old bug that was supposed to be fixed but never fixed".

### Repro
1. Open Gaps tab
2. Try to link a desired-state asset
3. → Button is grayed out / not clickable

### Investigation plan
- Check enable/disable predicate for the desired-state link button in Gaps view (likely `ui/views/GapsEditView.js` or whichever surface owns the link affordance).
- Verify dependency on engagement having ≥1 desired-state instance + ≥1 gap with a layerId match.
- The CURRENT-state link button should be working — diff the two paths to find the missing wire.

### Fix plan
After investigation: surface to user, then wire correctly + add V-FLOW-LINK-DESIRED-1 regression.

---

## BUG-033 · Local A multi-turn context loss (partial regression of rc.4 Hotfix #2b — only first response is accurate)

**Status**: ROOT CAUSE CONFIRMED 2026-05-05 (collapses into BUG-030 architectural recast — same shape) · 6a SPEC + RED scaffolds shipped; 6b plane-1 router closes the underlying cause · v3.0.0-rc.5 → rc.6

### Investigation note (2026-05-05 · 6a · principal-architect investigation)

**Same root cause as BUG-030**: the chat surface treats engagement as ambient (push, optional via tool invocation) instead of authoritative (pull, deterministic). On Local-A specifically, the failure mode is amplified by two compounding factors:
- Local-A model (Qwen3-Coder via vLLM hermes parser) has weaker instruction-following than Anthropic/Gemini, so the "INVOKE the appropriate analytical view tool" instruction gets dropped more often.
- Round-2 of the multi-turn transcript carries the round-1 tool result (when tools fired) in the messages array. Local-A is observed to misinterpret the round-1 tool-result-then-user-question shape — sometimes echoing single-word fragments from the tool result ("current"), sometimes returning empty.

**Workshop screenshot evidence (2026-05-05)**: Local-A asked *"can you find the assets from the current state that are dell?"* → returned a verbatim chunk of the `Document current state` workflow body about `mappedAssetIds`. This is intent misclassification, not pure context loss — the model preferred a documented-procedure answer to a fact-retrieval one because the prompt lacked a deterministic cue saying "this is a vendor query, look at the vendor data". Plane 1 router closes this directly: `"find dell assets in current state"` → `selectVendorMix({state:"current"}) + selectMatrixView({state:"current"})` invoked server-side, results in Layer 4 before the LLM ever sees the question.

**6b commit will resolve**: Local-A round-2 will receive a Layer 4 already containing the answer for both round-1 and round-2 questions (router runs every turn; selector results refresh per-turn). Tool round-trip is no longer the primary fact channel; the multi-turn fragility around tool-result-message-shape stops being grounding-critical.

**SPEC + RED scaffolds in 6a · this commit**: see BUG-030 entry above for the architectural recast; V-FLOW-GROUND-1 includes the *"list the gaps currently defined"* + *"find dell assets in current state"* phrasings as router-classification cases.

---

**Status**: OPEN · Reported 2026-05-05 by user (office workshop test) · v3.0.0-rc.5 · Scheduled rc.6 (HIGH)
**Reporter**: User
**Severity**: High
**Regression**: Yes — rc.4 Hotfix #2b shipped 4 defensive OpenAI-canonical translations to fix this exact class of issue. The user reports the symptom is BACK on rc.5, suggesting either: (a) the fix was incomplete; (b) something in the rc.5 changes regressed it; or (c) the fix only covered a narrow case.

### Screenshot evidence (collected by user 2026-05-05)
- Screenshot #4 (Canvas AI Assistant chat — Local A): asks "can you find the assets from the current state that are dell?" → response is the single word "current" (5:55:25 PM). Asks "list the gaps currently defined in the session" → 5:57:26 PM response is empty (Canvas response text appears to be blank). Same Local A provider. First turn returned a useful long answer about `mappedAssetIds` arrays + Document current state workflow; later turns degrade to terse / empty / single-word echoes.

### Repro
1. Switch active provider to Local A (vLLM Code-LLM at port 8000 with `--tool-call-parser hermes`)
2. Open Canvas AI Assistant
3. Send 3+ messages in a row
4. → First response is accurate. Subsequent responses are: (a) single-word echoes, (b) empty / blank, (c) tool-call only without text completion, (d) generic "current" / "ready" non-answers

### Investigation plan (root-cause discipline; no patches)
1. **Wire-body diff between turn 1 and turn 2** — capture both via Network panel (Chrome DevTools), diff what's different. The system prompt should be IDENTICAL on both. Messages array grows.
2. **Check tool-result round-trip on Local A** — the message shape after a `tool_use` → `tool_result` may be malformed for vLLM hermes parser. Hotfix #2b stringified tool result content; verify the format vLLM hermes expects (might want OpenAI's `{role:"tool", tool_call_id, content}` structure exactly).
3. **Check Anthropic-canonical → OpenAI-canonical translation for `tool_use`/`tool_result` on multi-round** — `services/aiService.js` Hotfix #2b only collapses adjacent system messages; tool-call rounds may produce two-three "assistant: tool_use" → "tool: result" messages that vLLM hermes parser may not handle correctly.
4. **Check max_tokens limit interaction with tool-call round-trip** — Hotfix #2b raised it to 4096. But if a tool_call response counts toward max_tokens AND the model also needs to emit a final text answer, the budget may exhaust before the final answer.

### Suspected hot spots (in priority order)
1. `services/aiService.js` `_buildOpenAIRequest` (or equivalent) — translation for round 2+ when tool calls occurred in round 1.
2. `services/realChatProvider.js` Local A path — tool-call extraction may emit a malformed shape that vLLM hermes can't echo back.
3. vLLM container args — `--enable-auto-tool-choice` flag mentioned in Local B 400 error (BUG-035) suggests the vLLM may need explicit tool-choice flag for Local A too.

### Real-LLM smoke
Same gap as BUG-030 — real-LLM live-key smoke missing from PREFLIGHT. rc.6 must add it.

### Out of scope
- Adding turn-count guardrails or "summarize earlier turns" patches. User rejected.

---

## BUG-034 · AI Providers settings save inconsistent (rc.4 Hotfix #1 didn't fully land — saves silently fail OR persist wrong values)

**Status**: OPEN · Reported 2026-05-05 by user (office workshop test) · v3.0.0-rc.5 · Scheduled rc.6 (HIGH)
**Reporter**: User
**Severity**: High (user can't reliably configure providers; demos break)
**Regression**: Yes — rc.4 Hotfix #1 (`016bbfe`) shipped a fix for "Settings save flaky during 90ms cross-fade (stale .overlay-body)". User reports the symptom is BACK on rc.5.

### User words (literal)
*"the save button in the AI admin is not working still, it sometimes refuse to save, or it save but it doesnt actually save the inputs i put in the configurations of the AI llm providers settings ... etc."*

### Repro
1. Open Settings → AI Providers
2. Type a new model name OR API key for any provider
3. Click Save
4. → Sometimes the save doesn't fire (button click ignored)
5. → Other times the save fires but the persisted value doesn't match what was typed (old value comes back on reopen)

### Suspected root cause (post-Hotfix-#1 still flaky)
Hotfix #1 fixed the case where `.overlay-body` was scoped against ALL overlays + picked the leaving body during 90ms cross-fade. That covered the SECTION-SWAP within Settings. But there may be a second flaky path:
1. **Settings cross-section swap (rc.4 Hotfix #1 path)** — might have been incomplete.
2. **Initial-open load** — provider config loaded into the form may not be the same record the save targets (race between `loadAiConfig()` async + form mount).
3. **Save-button handler scope** — the click handler may capture a `_settings` reference that goes stale when form re-renders due to async config load.

### Investigation plan (root-cause discipline)
1. Capture the save-button click handler in `ui/views/SettingsModal.js` — verify which `_settings` ref it picks at click time.
2. Add a console.log inside the save path — confirm whether (a) handler doesn't fire OR (b) handler fires but writes wrong values.
3. Check `core/aiConfig.js` `saveAiConfig()` — atomic write? Race-prone?
4. Test under rapid input + rapid save (the workshop scenario where user types + clicks fast).

### Fix plan
After root-cause confirmed: surface architectural fix to user. Add V-FLOW-SETTINGS-SAVE-1 + V-FLOW-SETTINGS-SAVE-RACE-1 regression tests.

---

## BUG-035 · V-PROXY-LOCAL-B-1 RED in workshop environment (404 from `/api/llm/local-b/`) + Local B vLLM `--enable-auto-tool-choice` flag missing

**Status**: CLOSED rc.6 / 6e · root cause confirmed (workshop image was stale, pre-rc.4 hotfix #2a) + defensive fix shipped (entrypoint self-check fails loudly on stale images) + part B friendly hint translator shipped + V-AISERVICE-VLLM-400-1 regression test · v3.0.0-rc.5 → rc.6

### Investigation note (2026-05-05 · 6e · root cause)

**Part A (nginx 404)**: the local-b location block was correctly added in rc.4 hotfix #2a (`58a41b5`). The workshop image was BUILT BEFORE that hotfix and not rebuilt — so the deployed `docker-entrypoint.d/45-setup-llm-proxy.sh` only knew the `local / anthropic / gemini` blocks. nginx came up without a `local-b` location → 404 on V-PROXY-LOCAL-B-1.

**Part B (vLLM 400)**: confirmed user-side vLLM server config issue — Local B vLLM was started without `--enable-auto-tool-choice` + `--tool-call-parser hermes` flags. The server is honest about the requirement; our chat overlay was just rendering the raw payload to the user, who couldn't tell it was a server-config issue from the noise.

### Fix (rc.6 / 6e, this commit)

**Part A · `docker-entrypoint.d/45-setup-llm-proxy.sh`**: after writing the snippet, the script now greps its own output for all 4 expected location blocks (`local`, `local-b`, `anthropic`, `gemini`). If any is missing, it logs a clear `[entrypoint][ERROR] LLM proxy snippet is missing 'location <X>' — image may be stale` to stderr + exits non-zero. nginx then fails to start, and the workshop sysadmin sees the failure at container start instead of mid-demo.

**Part B · `services/aiService.js buildHttpError()`**: detects HTTP 400 responses whose body mentions `tool[- ]?choice` / `enable[- ]?auto[- ]?tool[- ]?choice` / `tool[- ]?call[- ]?parser` and surfaces a friendlier hint: *"vLLM server config — start the LLM with --enable-auto-tool-choice + --tool-call-parser hermes (Code LLM) or disable tools for this provider in Settings"* instead of dumping the raw vLLM error.

`buildHttpError` is now exported so V-AISERVICE-VLLM-400-1 can assert the hint translator without round-tripping through real fetch.

### Regression tests

- `V-PROXY-LOCAL-B-1` (existing) · runtime probe; 404 on `/api/llm/local-b/v1/health` is RED.
- `V-AISERVICE-VLLM-400-1` (NEW) · BUG-035 part B regression: vLLM auto-tool-choice 400 body MUST surface the friendly server-config hint; unrelated 400 bodies fall back to generic "HTTP 400".

The entrypoint self-check itself isn't directly testable from the in-browser test runner (it runs in the container at start, not in the browser). The existing V-PROXY-LOCAL-B-1 covers the runtime outcome. If a future image regresses the script, container start fails LOUDLY; if container starts and V-PROXY-LOCAL-B-1 still RED, that means the entrypoint script's content drift is already loud at container-start time.

---

**Status**: OPEN · Reported 2026-05-05 by user with screenshot evidence · v3.0.0-rc.5 · Scheduled rc.6 (MEDIUM-HIGH; partly user-side vLLM config)
**Reporter**: User (office workshop machine)
**Severity**: Medium-High (test fails; Local B unusable for chat)
**Regression**: Yes for V-PROXY-LOCAL-B-1 — passed at rc.4 tag; user sees RED at rc.5 deploy. The vLLM flag is user-side server config, NOT app code.

### Screenshot evidence
- Screenshot #1+#2 (Browser DevTools console): `❌ V-PROXY-LOCAL-B-1 · docker-entrypoint.d/45-setup-llm-proxy.sh writes a /api/llm/local-b/ location with proxy_pass to LLM_LOCAL_B_PORT (HOTFIX #2a per LLMs on GB10.docx — VLM on 8001) V-PROXY-LOCAL-B-1: /api/llm/local-b/* MUST be a configured nginx location (got status 404 — 404 means location block missing)`
- Screenshot #3 (Canvas AI Assistant after a Local B chat attempt): `Provider error: aiService localB HTTP 400 (400): {"error":{"message":"\"auto\" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set","type":"BadRequestError","param":null,"code":400}}`

### Two distinct issues here
**Part A (app code; OUR scope)**: `/api/llm/local-b/` returns 404 in the deployed container. That means the nginx config block didn't write at container start. Possible causes:
1. `docker-entrypoint.d/45-setup-llm-proxy.sh` shipped at rc.4 Hotfix #2a is no longer being executed at container start.
2. Script writes the block but uses a stale env var path.
3. Build-cache served an OLD version of the script after the rc.4 ship.

**Part B (vLLM server config; USER scope, but app should surface meaningful error)**: vLLM Local B (port 8001 VLM) needs `--enable-auto-tool-choice` + `--tool-call-parser <name>` flags. Per `LLMs on GB10.docx` Local B is the VLM container. The user's vLLM container args don't include those flags. The 400 error is correct behavior from vLLM — but the app shouldn't even GET TO the vLLM if the nginx route is 404'd.

### Investigation plan
1. Pull HEAD on the workshop machine; verify `/api/llm/local-b/` returns NOT 404 after a clean `docker compose up -d --build`. If still 404, the entrypoint script is the bug.
2. If entrypoint script ran but route is still missing, diff `docker-entrypoint.d/45-setup-llm-proxy.sh` against rc.4 expectation.
3. For Part B (vLLM flags): document the required flags in `LLMs on GB10.docx` reference + add a friendlier error message in `services/aiService.js` for "auto tool choice requires" → "Local B vLLM container missing --enable-auto-tool-choice flag; add to your docker run args".

### Out of scope (user-side)
- Adding `--enable-auto-tool-choice` to user's vLLM Local B container — that's user's machine config.

---

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
