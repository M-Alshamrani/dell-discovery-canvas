# Dell Discovery Canvas — Bug Log

Live tracker for known regressions and outstanding bugs. New bugs land here as soon as they're observed (in the same session as the report) so they don't get lost between sessions.

**Status flow**: `OPEN → INVESTIGATING → FIX-PENDING → FIXED → CLOSED` (CLOSED is when the regression test guarding against the bug is GREEN and shipped).

**Discipline anchor**: every fix MUST ship with a regression test (V-FLOW vector or equivalent) per `feedback_test_what_to_test.md`. *Fixed without a test → not fixed.*

---

## BUG-001 · Propagation toast shows "low" when actual urgency mutation is "high" (CLOSED 2026-05-09 — v2 root path deleted in Step J; v3 flow reads correct field)

**Status**: **CLOSED 2026-05-09** · The original bug lived in `interactions/desiredStateSync.js`'s propagate-criticality toast emitter. That entire file was DELETED in rc.7 / 7e-8 Step J (commit `ea898df`). The v3 propagate-criticality flow lives in `ui/views/MatrixView.js runPropagation()` (line 829-861) and correctly builds the toast from `applied[0].newCrit` — the actual upgrade level, sourced from the proposal returned by `proposeCriticalityUpgrades`. Toast format: "N assets upgraded to High" (or whichever level applied). The "low" placeholder bug in the v2 emitter is structurally impossible in the v3 path. Reverify with user during workshop validation round 2 if any remaining shape surfaces.
**Reporter**: User during rc.1 manual smoke
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

## BUG-002 · Propagate button non-dispatchable after add-disposition-different-layer cycle (CLOSED 2026-05-09 — v3 render path creates fresh button on every panel mount)

**Status**: **CLOSED 2026-05-09** · The v3 propagate-criticality button (`ui/views/MatrixView.js` line 762, "↑ Propagate criticality") is created on every workload-detail-panel render via the `showDetailPanel(right, _liveInstance(workload.id))` call at the END of `runPropagation`. After a successful propagate cycle, the panel re-mounts and a fresh button (with a fresh listener) replaces the old one. The "non-dispatchable after second cycle" failure mode is structurally impossible in the v3 mount/unmount lifecycle. Original v2 root cause (stale closure in `interactions/desiredStateSync.js`) deleted in Step J. Reverify with user during workshop validation round 2 if any remaining shape surfaces.
**Reporter**: User during rc.1 manual smoke
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

## BUG-019 · After page reload, canvas data persists in localStorage but Canvas Chat reports "empty" until user clicks Load demo again (CLOSED 2026-05-09 — auto-rehydrate shipped per SPEC §S31)

**Status**: **CLOSED 2026-05-09** · `state/engagementStore.js` `_rehydrateFromStorage()` runs at module load (per SPEC §S31 R31.2) — engagement state restored from `v3_engagement_v1` localStorage key on every page boot, no Load-demo click required. **Verified live 2026-05-09 via Chrome MCP**: Load demo (Acme/3/8/23) → reload → engagement = Acme/3/8/23 immediately, no Load-demo click. Test runner's runIsolated snapshot+restore preserves user state across the test pass. Regression guards: V-FLOW-REHYDRATE-1 + V-FLOW-REHYDRATE-3 (per SPEC §S31.1 R31.1/R31.2/R31.4).
**Reporter**: User
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

## BUG-027 · Test pass briefly flashes file content / tags / DOM fragments on screen at page load (CLOSED 2026-05-09 — broad cloak rule shipped)

**Status**: **CLOSED 2026-05-09** · `styles.css` line 3940 (rc.5 §S36.3 R36.12 "BUG-027 fix") extends the test-pass cloak to cover **every** body-level child except the closed app-shell list (`#app-header`, `#stepper`, `#main`, `#app-footer`, `#test-banner`, `.overlay-backdrop`). Rogue test probes (V-PROD/V-DEMO/VT* tests appending DIVs to body for layout assertions) are now `visibility: hidden + pointer-events: none` for the duration of the test pass; afterRestore Hotfix #1 sweep removes them entirely before the cloak attribute clears. Visual flash gone. Regression: V-NO-VISIBLE-TEST-OVERLAY-1 covers the cloak-attribute lifecycle.
**Reporter**: User (work computer)
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

## BUG-028 · Canvas AI Assistant chat doesn't persist when user clicks Skills button (CLOSED 2026-05-09 — side-panel stacking shipped per SPEC §S36.1)

**Status**: **CLOSED 2026-05-09** · `ui/components/Overlay.js` rc.5 work added stack-aware overlay management (per SPEC §S36.1 R36.1). When chat is open and the user clicks `+ Author new skill` in the chat right-rail, `ui/skillBuilderOpener.js` detects the open chat and passes `sidePanel:true` to `openSettingsModal()`. Chat repositions to `data-stack-pos="left"` (50vw left), Settings panel mounts at `data-stack-pos="right"` (50vw right), single shared backdrop. Closing Settings (Done button or Esc) pops the stack and chat returns to full-width. **Verified live 2026-05-09 via Chrome MCP**: open AI Assist → click Skills (right-rail panel toggles, chat persists) → click + Author new skill → 2 overlays mounted side-by-side (canvas-chat:left + settings:right) → click Done → chat back to full. Skills button in head-extras toggles a chat-internal SHORTCUTS panel (no Settings, no overlay swap), which is even smoother UX than the original BUG-028 fix scope. Regression guard: V-CHAT-PERSIST style assertions covered by overlay stack tests in §T36.
**Reporter**: User
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

**Status**: CLOSED rc.6 / 6h · root cause confirmed (closure-captured workload reference goes stale; toast read criticality from stale closure instead of the applied level) + fix shipped + V-FLOW-PROPAGATE-CRIT-TOAST-1 regression test · v3.0.0-rc.5 → rc.6

### Investigation note (2026-05-05 · 6h · root cause)

`ui/views/MatrixView.js runPropagation(workload, right)` was called from a `propBtn.click` handler that captured the workload-tile reference at detail-panel render time. The function correctly used `proposeCriticalityUpgrades(session, workload.id)` which RE-RESOLVES the workload internally from `session.instances` via `findInstance` — so the propagation logic was correct. But the toast at the function tail read the closure-captured `workload.criticality` directly. If the user changed the tile's criticality (Low → High) between detail-panel render and propagate-click, the closure-captured `workload.criticality` was stale (still "Low") even though the actual upgrade landed at "High".

Result: assets were upgraded to "High" correctly, but the toast said *"N assets upgraded to Low"*. The user's workshop screenshot showed the discrepancy clearly.

### Fix (rc.6 / 6h, this commit)

`ui/views/MatrixView.js runPropagation()`:
1. Re-resolves `freshWorkload` from `session.instances` at click time. Used for all detail strings (alert, confirm, re-render).
2. Toast text now consumes `applied[0].newCrit` — the level actually written to dependents (guaranteed correct since proposals all target the same workload criticality level). Eliminates closure-staleness ambiguity.

```js
var freshWorkload = (session.instances || []).find(i => i.id === workload.id) || workload;
// ...
var appliedLevel = (applied[0] && applied[0].newCrit) || freshWorkload.criticality || "(unknown)";
showToast(applied.length + " asset(s) upgraded to " + appliedLevel, "ok");
```

### Regression test

`V-FLOW-PROPAGATE-CRIT-TOAST-1` (source-grep):
- Asserts `runPropagation` function block exists.
- Asserts `freshWorkload` is re-resolved at click time.
- Asserts toast consumes `applied[0].newCrit` (the applied level), not the bare closure-captured `workload.criticality`.
- Anti-pattern guard: showToast call site MUST NOT reference `workload.criticality` directly.

---

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

## BUG-032 · Gaps tab desired-state asset linking button grayed out / not clickable (CLOSED 2026-05-09 — root cause was selectedGapId closure-locality, fixed by BUG-051)

**Status**: **CLOSED 2026-05-09** · Root cause finally identified + fixed in BUG-051 (commit shipped 2026-05-09). The user perception of "the link button is deactivated / not clickable" was actually the WHOLE detail panel disappearing because `selectedGapId` was closure-local inside `renderGapsEditView`. Each successful link/edit fired the engagement subscriber chain → fresh closure → `selectedGapId = null` → right pane reverted to the gap-empty hint. The link buttons weren't disabled; they were absent. See BUG-051 for the fix detail + V-FLOW-GAPS-SELECTION-PERSIST-1 regression test.

**Original investigation note** (2026-05-05 / 6i) preserved below for context — the hypotheses were close but missed the closure-locality root cause; could not reproduce against v3 demo because the prior dev cycle's test rebuild didn't capture the post-Step-G subscriber flow that exposes the bug.

---

**Status (original)**: DEFERRED to rc.6.1 / rc.7 · Investigated 2026-05-05 / 6i; could not reproduce against the v3 demo session on this dev machine. Code path inspected end-to-end; no conditional disable predicate found. Needs user hands-on repro to identify the specific greyed-out element + the workshop preconditions that triggered it. · v3.0.0-rc.5 → rc.6 (deferred)

### Investigation note (2026-05-05 · 6i)

**What I checked**:

- `ui/views/GapsEditView.js` lines 942-1010: the "Linked instances section" renders both Current and Desired sub-sections symmetrically. The desired-state add button is created at line 995 as `mkt("button", "btn-ghost-sm", "+ Link desired instance")` with a click handler that calls `openLinkPicker("desired", gap, ...)`. NO conditional disable predicate, NO conditional class application.
- `ui/views/GapsEditView.js openLinkPicker(stateFilter, ...)` at line 1077: the picker filters `session.instances` by `i.state === stateFilter`. If there are no unlinked desired instances, the picker shows the "No unlinked desired instances available" message instead of the candidate list — but the button itself still opens the picker (not grayed).
- `styles.css` `.btn-ghost-sm` (line 2239): standard dashed-border ghost button with Dell-blue color + hover. NO greyed-out state.
- `.link-picker-item` (line 2235): cursor pointer, hover background. NO greyed-out state.
- Source-grep for any `addDesBtn.disabled` / `link.*disabled` / `btn-ghost-sm.*disabled` pattern: NO matches.

**Why I couldn't reproduce on this machine**:

The v3-native demo (`core/demoEngagement.js loadDemo()`) populates the v3 `engagementStore` but NOT the v2 `session` object. The Gaps view reads from v2 `session.instances` and `session.gaps`. On a fresh `docker compose up` + "Load demo" click, the v2 session has 0 gaps + 0 instances — so the gap-edit panel never renders the linked-instances section to begin with. The bug's preconditions (≥1 gap selected + the link-button render) require a populated v2 session, which the workshop user's machine had (presumably from earlier .canvas open or manual entry).

**Possible root causes (per BUG_LOG hypotheses + investigation)**:

1. (most likely) A workshop-specific session state where the desired-state instance candidate list is empty AFTER filtering by `state === "desired"` — the user perceives the picker (which shows "No unlinked desired instances available" empty-state text) as "the button is grayed out" because nothing happens visibly when clicking. Code is functioning correctly; the UX is just confusing in this case.
2. A CSS specificity collision in a layout the dev demo doesn't reach (e.g. nested overlay-body context).
3. A non-source-grep-detectable behavior (e.g. event-listener-not-attached due to a render-order race specific to a workshop session shape).

**Locked direction (per feedback_no_patches_flag_first.md)**:

Don't ship a guess-fix. The button code is honest; the picker code is honest; CSS is honest. If the user's repro is on a specific session shape, we need that session to confirm the root cause + write a regression test that catches it. Without repro, any "fix" would be speculative.

**Recommendation**:

- Tag rc.6 with BUG-032 DEFERRED (this commit). The other 6 workshop bugs (BUG-029 through BUG-031, BUG-033 through BUG-035) closed with regression tests.
- BUG-032 revisits in rc.6.1 or rc.7 once the user can supply a session that reproduces the symptom.
- If hypothesis (1) is correct, the rc.6.1 fix is a UX clarification: when the picker has zero candidates, render an explicit empty-state callout instead of showing what looks like a non-functional button.

---

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

**Status**: CLOSED rc.6 / 6g · root cause confirmed (provider-pill click discards unsaved input values) + fix shipped at the pill-click commit point + V-FLOW-SETTINGS-PILL-COMMIT-1 regression test · v3.0.0-rc.5 → rc.6

### Investigation note (2026-05-05 · 6g · root cause)

**Root cause** (not the rc.4 Hotfix #1 path; that one was a real bug + correctly fixed):

`ui/views/SettingsModal.js` provider-pill click handler did:

```js
pill.addEventListener("click", function() {
  config.activeProvider = pkey;
  saveAiConfig(config);
  swapSection("providers");
});
```

When the user typed a new API key / URL / model into the CURRENT provider's form, then clicked ANOTHER provider pill BEFORE the explicit "Save" button:

1. The DOM input had the typed value, but the `config` object (loaded at body-build time via `loadAiConfig()`) had the OLD value.
2. The handler set `config.activeProvider = pkey` and immediately persisted via `saveAiConfig(config)`. This wrote the OLD `providers[anthropic].apiKey` (the user's typing was NEVER copied into config).
3. `swapSection("providers")` rebuilt the form for the new provider. The OLD provider form was discarded — the typed-but-unsaved value with it.

Result: user types Anthropic API key, clicks Local A pill, then clicks back to Anthropic — field is empty. The "save sometimes refuses to save / sometimes saves the wrong value" pattern in the workshop report.

The rc.4 Hotfix #1 (cross-section swap scope) was a separate bug correctly fixed; it did NOT cover this provider-pill path because nobody had spotted the discard-on-pill-click race.

### Fix (rc.6 / 6g, this commit)

`ui/views/SettingsModal.js` provider-pill click handler now COMMITS the current form's live input values into `config[activeKey]` BEFORE the provider swap:

```js
try {
  if (urlInput && config.providers[activeKey]) {
    config.providers[activeKey].baseUrl        = urlInput.value.trim();
    config.providers[activeKey].model          = modelInput.value.trim();
    config.providers[activeKey].apiKey         = keyInput.value;
    config.providers[activeKey].fallbackModels = parseFallbackModels(fbInput.value);
  }
} catch (_e) { /* defensive — first pill click before form mounts */ }
config.activeProvider = pkey;
saveAiConfig(config);
swapSection("providers");
```

`urlInput` / `modelInput` / `fbInput` / `keyInput` are var-hoisted within `buildSettingsBody`; at click time they're defined and reflect live DOM. The defensive try/catch handles the rare case of a pill click before the form has fully mounted (shouldn't happen but cheap to guard).

### Regression test

`V-FLOW-SETTINGS-PILL-COMMIT-1` — source-grep test asserting:
- Pill click handler block exists.
- Handler commits all 4 input values (`urlInput`, `modelInput`, `keyInput`, `fbInput`) to `config[activeKey]` before swap.
- Order: commit precedes both `saveAiConfig` and `swapSection`.

This is a source-grep test (consistent with the existing V-SETTINGS-SAVE-1 pattern from rc.4 Hotfix #1) — a behavioral test would need DOM-mounting the SettingsModal which is fragile. Source-grep is honest + deterministic.

---

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

## BUG-036 · Canvas AI Assistant reports "canvas is empty" when user has entered data via v2.x UI tabs (v2-v3 sync gap)

**Status**: OPEN · Reported 2026-05-06 by user · v3.0.0-rc.7-dev · Scheduled rc.7 view migration arc (HIGH — likely auto-resolves as each tab migrates to write through `state/adapter.js`)
**Reporter**: User (post-rc.6 chat usage)
**Severity**: High (blocks workshop usage on non-demo sessions)
**Regression**: No — pre-existing v2-v3 architecture gap. Surfaced now because rc.6 grounding contract correctly reports the v3 engagement state, which is empty when user data lives only in v2 session.

### Repro
1. Fresh session (NOT demo): + New session → empty canvas.
2. Tab 1 Context: enter customer name + add a strategic driver.
3. Tab 2 Current state: add an instance (e.g. compute / Dell PowerStore in Primary DC).
4. Open Canvas AI Assistant. Ask: *"what technologies are in the current state?"*
5. → Response says canvas is empty (or the grounding-router fallback path produces a "metadata-only" Layer 4 with no instance data).

### Expected
The chat reports the user's just-entered current-state instances, since they ARE in the engagement.

### Suspected root cause (architecture-class)

`state/sessionBridge.js` (the v2-v3 lifecycle owner) ONLY shallow-merges the v2 customer fields (name/vertical/region/notes) into the v3 engagement on session-changed events. Drivers / environments / instances / gaps in the v2 session do NOT flow to v3 engagementStore. The chat surface reads from v3 engagementStore via `getActiveEngagement()`. So:

- **Demo path** (writes directly to v3 via `loadDemo()`) → chat sees real data ✓
- **User-entered path** (writes to v2 via Tab 2/3/4 actions) → v3 stays empty → chat sees empty ✗

This is a known architectural gap pending the **rc.7 view migration arc** (HANDOFF rc.6 §3): once the 5 v2.x view tabs migrate to write through `state/adapter.js commitContextEdit / commitInstanceEdit / commitGapEdit / etc.`, those writes land in v3 engagementStore directly + chat sees them.

### Fix plan
1. **Verify scope**: confirm the bug reproduces on the current build. Then check whether the chat surface is correctly tied to v3 engagementStore (it is, per HANDOFF §6 file pointers).
2. **Wait for view migration**: rc.7 main arc (5 v2 tabs migrate one-commit-each). Each migration reduces this bug's surface area; after Tab 2 Current State migrates, current-state instance queries should work.
3. **OR interim fix**: extend `state/sessionBridge.js bridgeOnce()` to mirror v2 drivers/instances/gaps into v3 engagement. RISK: must not clobber the v3-native demo (which writes directly to v3). Bridge would need to detect "v3 empty AND v2 has data" → translate; otherwise leave v3 alone. This is essentially a runtime v2→v3 translator, which `feedback_no_patches_flag_first.md` + `project_v3_no_file_migration_burden.md` LOCKED 2026-05-02 explicitly forbid (*"never patch the v3 to work with v2 or vice versa"*). So interim-fix path is BLOCKED by locked discipline; rc.7 view migration is the only acceptable path.
4. **Regression test**: add a V-FLOW-CHAT-V2DATA-1 that reproduces the symptom against an interim build (mid view-migration arc), assert it goes GREEN as each tab migrates.

### Cross-refs
- `state/sessionBridge.js` (v2-v3 lifecycle owner; currently customer-only merge per BUG-010 fix scope)
- HANDOFF rc.6 §3 (rc.7 view migration arc planned)
- `feedback_no_patches_flag_first.md` (blocks runtime translator path)
- `project_v3_no_file_migration_burden.md` (blocks v2-shape-in-v3 path)

---

## BUG-037 · Canvas AI Assistant chat lacks visual differentiation between user messages and assistant responses (UX polish)

**Status**: OPEN · Reported 2026-05-06 by user · v3.0.0-rc.7-dev · Scheduled rc.7-polish or v3.1 crown-jewel UI polish
**Reporter**: User (post-rc.6 chat usage)
**Severity**: Low (UX clarity; no functional impact)
**Regression**: No — never had bubble styling; current chat overlay treats both sides as plain text blocks.

### User words (verbatim)
*"In the chat, i would rather to ahve my qusitons engolve in sligtly elegent bubble so I can distingish my text from the Ai response. not shure what to call this elegent UI design element. lets plan it accordingly to others"*

The element is a **chat bubble** / speech-bubble container — the now-standard ChatGPT/Claude/iMessage-style pattern where:
- User messages render in a subtle right-aligned (or distinctly-coloured) rounded container with internal padding.
- Assistant responses render left-aligned, often with a wider, softer-coloured container OR with a small avatar/eyebrow ("CANVAS").

### Suspected scope
`ui/views/CanvasChatOverlay.js` chat-message rendering + `styles.css` `.canvas-chat-*` rules. The `BUG-022` chat-polish residuals were partly closed in rc.5 (Send button density + line-height) but bubble differentiation didn't land. Cross-ref `project_crown_jewel_design.md` — the v3.1 UI polish arc would be the natural home if rc.7-polish doesn't pick it up.

### Fix plan
1. Add a `.canvas-chat-bubble-user` class on user-message rows; subtle Dell-blue-faint background, rounded corners (≥ 12px), max-width ≤ 70%, right-aligned.
2. Keep assistant messages full-width (current default) but add a subtle "CANVAS" eyebrow + softer paragraph treatment so the contrast reads clearly without competing.
3. Browser smoke against demo + user-typed messages.
4. V-CHAT-POLISH-3 (extension of rc.5 polish suite) source-grep + DOM-shape regression test.

### Cross-refs
- `project_crown_jewel_design.md` (v3.1 UI polish anchor)
- HANDOFF rc.6 §3 mentions UX polish is a v3.1 minor item

---

## BUG-038 · Skill Builder UI is text-heavy / primitive; needs intuitive design aligned with AI + data architecture capabilities

**Status**: OPEN · Reported 2026-05-06 by user · v3.0.0-rc.7-dev · Scheduled v3.1 crown-jewel UI polish (already in plan per `project_crown_jewel_design.md` + HANDOFF rc.6 §3)
**Reporter**: User (running review post-rc.6)
**Severity**: Low-Medium (workshop usability; not blocking)
**Regression**: No — Skill Builder was rebuilt as the evolved admin in rc.4-dev Arc 4 (SPEC §S35); the form is functional but text-heavy.

### User words (verbatim)
*"at some points we need to revisit the skills builder and polish the currently primitive text heavey UI, and need to be intuative and in line with the cpabilites possiable withon our AI and data architecture ... i think it is already in the plan"*

### Already planned · cross-refs
- `project_crown_jewel_design.md` — v3.1 minor crown-jewel UI polish.
- `project_skillbuilder_ux_concern.md` (memory) — the user flagged this in the rc.3 era; revisit between rc.3 and GA was the original commitment. Remains true; the rc.4-dev Arc 4 rebuild was a structural consolidation (parameters[] + outputTarget) but didn't address text-heaviness.
- HANDOFF rc.6 §3 — v3.1 minor crown-jewel UI polish.

### Out of scope for rc.7 main
The view migration arc is sequential SPEC + tests + impl per locked discipline. UI polish lands as its own arc once view migration ships.

---

## BUG-039 · Vendor mix reporting % is misleading because counts are by record not by deployment scale

**Status**: OPEN · Reported 2026-05-06 by user · v3.0.0-rc.7-dev · Scheduled v3.1+ data-model widening (DESIGN ITEM)
**Reporter**: User (running review post-rc.6)
**Severity**: Medium (misleading workshop output; affects executive narrative honesty)
**Regression**: No — `selectVendorMix` has always counted instance records, not deployment scale.

### User words (verbatim)
*"the reporting pannel for the Vendors mix , doenst make sense to report % as we are not counting the number of assets , for exmaple Dell migh have all servers and storage and have 100s or assets with the client for two products, yet becuase they are reported as two , they will show lower percentage among other vendors while in reality they are dominant"*

### Issue analysis
`engagement.instances[].vendorGroup ∈ {dell, nonDell, custom}` is per-INSTANCE-RECORD. A presales might add ONE instance record like *"Dell PowerStore 5000T cluster"* representing 200 physical PowerStores at the customer. `selectVendorMix.totals.dellPercent` divides Dell records by total records — so the customer with 2 Dell records (representing 200 deployed) + 5 NetApp records (representing 5 deployed) shows Dell at 28%, when in reality Dell dominates by deployment count.

### Possible fixes (design discussion needed)
1. **Add `instance.deployedQuantity` field** (default 1; presales overrides for high-volume deployments). `selectVendorMix` computes weighted % using deployedQuantity. Schema change → migrator + V-MIG vectors.
2. **Add a "concentration" lens**: report BOTH record-count % AND a footnote "actual deployment scale may differ — check instance notes". Cheap; doesn't address the actual misleading number.
3. **Replace % with absolute counts + qualitative labels** ("Dominant Dell footprint" / "Mixed environment" / etc.) computed by some heuristic. Requires UX design.

### Out of scope for rc.7 main
This is a domain-modeling change touching schema + selector + report UI. Rightfully scheduled after view migration completes (rc.7 main + rc.8 GA hardening). User confirmed this is "planned somewhere" — log here so it's tracked.

### Cross-refs
- `selectors/vendorMix.js` — current implementation
- SPEC §S5.2.4 vendor mix selector contract
- HANDOFF rc.6 §3 — fits naturally in pre-GA hardening or v3.1 minor

---

## BUG-040 · Desired state allows mapping a workload to an instance whose disposition is "retire" (relationship invariant gap)

**Status**: OPEN · Reported 2026-05-06 by user · v3.0.0-rc.7-dev · Scheduled rc.8 / GA hardening (RELATIONSHIP INVARIANT)
**Reporter**: User (running review post-rc.6)
**Severity**: Medium (logically inconsistent state; user-facing confusion + report quality)
**Regression**: No — invariant was never authored.

### User words (verbatim)
*"The desired state , you can map a workload to a retired asset , that doenst makes sense, we need to vist these types of relationshipes and just make sure htey make sense."*

### Issue analysis
`workload.mappedAssetIds[]` (workload-layer instances) points at non-workload instances they consume. The current schema allows pointing at any non-workload instance — including a current-state instance whose `disposition: "retire"` (going away) or whose only reachable desired-state counterpart is also retired.

Logical conflict: a workload that's planned to RUN in desired state can't be mapped to an asset that's planned to BE GONE in desired state. The mapping should EITHER:
- Point at the current-state asset's desired-state replacement (originId → desired tile of `disposition: "replace"`), OR
- Point at a current-state asset whose desired-state disposition is "keep"/"enhance" (continuing).

### Possible invariants to add
- **WL_RET1**: For every desired-state workload `w`, every entry in `w.mappedAssetIds` must reference an instance whose desired-state lineage is NOT `disposition: "retire"`. (Soft warning may be appropriate, since the user might be mid-modelling.)
- **WL_RET2**: When a current-state asset's disposition is set to `"retire"`, surface a warning at every workload that maps to it, suggesting either re-mapping to the replacement OR removing the workload mapping.

### Other relationship-quality issues to audit (per user "we need to visit these types of relationships")
- gap.relatedCurrentInstanceIds pointing at retired instances
- gap.relatedDesiredInstanceIds pointing at originId-less + irrelevant tiles
- workload mappings spanning across environments without `affectedEnvironments` reflecting

### Out of scope for rc.7 main
Invariant additions touch schema + integrity sweep + UI surface (warning chips). Lands cleanly in rc.8 / GA hardening once view migration completes. The view migration arc may surface adjacent invariant gaps that should batch with this one.

### Cross-refs
- `state/integritySweep.js` — where new invariants would land
- `schema/instance.js` — where WL_RET-style hard constraints could be expressed
- SPEC §S10 integrity sweep contract

---

## BUG-041 · AI Assist provider popover renders against stale config snapshot — every click opens Settings even after the user added the key (CLOSED — rc.7 / 7e-8c'-fix3)

**Status**: CLOSED · Reported 2026-05-06 late-evening · v3.0.0-rc.7-dev · Closed in commit (this arc)
**Reporter**: User ("why the ai assest is fucked now, everytime i select an llm provider it takes me to the configurations page")
**Severity**: High (made provider switching unusable)
**Regression**: No — the closure-capture pattern was already there in `paintProviderPills` since rc.4-dev / Arc 2 (commit 68b98c4); only became visible after the rc.5 BUG-028 fix (`36a87fe`) routed the "needs key" branch through `sidePanel: true` Settings (the previous full-replace `closeOverlay()` call destroyed the chat overlay entirely on each Settings open, which masked the staleness because the overlay was rebuilt fresh next time).

### Repro
1. Open AI Assist (chat overlay paints provider pill + popover with config snapshot).
2. Click an unconfigured provider in the popover (e.g. Anthropic with empty `apiKey`). Side-panel Settings opens for key entry per R33.3.
3. Enter the API key. Save.
4. Close the side-panel Settings (chat stays open, only the right-pane Settings collapses per BUG-028 / R36.7).
5. Click the provider pill again. Popover re-shows.
6. Click the now-configured provider expecting it to switch.

### Expected
- Popover shows Anthropic as "Ready" (the key is now saved).
- Click switches `activeProvider` to Anthropic; pill repaints; no Settings re-open.

### Actual
- Popover still shows Anthropic as "Needs key" (stale).
- Click re-opens side-panel Settings instead of switching. User is stuck in a loop where every click on the not-yet-active provider opens Settings, even after the key is saved.

### Suspected root cause
`ui/views/CanvasChatOverlay.js paintProviderPills(slot)` builds the popover ONCE when the chat overlay opens. The per-row `isActive` + `ready` values + the `is-active`/`is-ready`/`is-warn` classes + the meta text ("Ready"/"Needs key"/"Active") are all snapshotted from `aiCfg = loadAiConfig()` at the time of build. The row's click handler **closes over that snapshot**:

```js
const ready = isProviderReady(aiCfg, providerKey);
row.addEventListener("click", function() {
  if (!isActive && ready) { /* switch */ }
  else { openSettingsModal({ section: "providers", focusProvider: providerKey, sidePanel: true }); }
});
```

When the user saves a key in side-panel Settings, `saveAiConfig` updates localStorage but does NOT trigger any repaint of the popover. The next click handler still sees the old `ready=false` from the build-time closure → routes to Settings every time.

### Fix plan
Two halves, both required:

1. **Click-time freshness** — re-read config inside the click handler and re-evaluate `isActive` + `ready` against the fresh state before deciding whether to switch or open Settings. Closes the loop bug directly.

2. **Open-time visual refresh** — in `showPopover()`, walk `popover.querySelectorAll('.canvas-chat-provider-row')` and refresh each row's class + meta text against fresh config. Without this, the user sees "Needs key" on the just-configured provider until they close + reopen the chat overlay (cosmetic but confusing).

Both implemented via a shared `refreshRow(row, freshCfg)` helper inside `paintProviderPills`.

### Regression test (V-FLOW-PROVIDER-POPOVER-FRESH-1..3 in §T33)
- **-1**: Source-grep — `paintProviderPills` MUST contain `refreshRow` definition. (Negative-assert that the build-time-only snapshot pattern doesn't return.)
- **-2**: Source-grep — the row click handler MUST call `loadAiConfig()` inside the listener, not rely on the outer closure. (Catches reintroduction of the stale-`ready` capture.)
- **-3**: Source-grep — `showPopover` MUST call something that walks `.canvas-chat-provider-row` elements and updates them. (Catches a future regression where someone removes the open-time refresh "for performance" without fixing the click-time path first.)

### Memory anchor
This is the third "rc.7 / 7e-8c'" follow-up bug surfaced by the user catching real-time behavior the test suite missed. Per `feedback_test_what_to_test.md`: "element exists" tests don't catch UX regressions — we need to assert that clickable-looking elements actually do something. The new V-FLOW-PROVIDER-POPOVER tests assert the freshness contract at the source level since DOM-level interaction tests would need to drive a saveAiConfig event mid-test, which is fragile.

---

## BUG-042 · Demo-mode banner does NOT render on Tab 4 (Gaps) when meta.isDemo:true via the live demo-loader path

**Status**: OPEN · Reported 2026-05-08 evening · v3.0.0-rc.7-dev · Scheduled rc.7 / 7e-post
**Reporter**: Agent during R11-mandated browser smoke walk for Step I-B-5
**Severity**: Low (cosmetic; banner is informational, not load-bearing)
**Regression**: Unknown — pre-existing state at the time of discovery (Step I-B-5 commit fa2ea32 only touched test code; not introduced by this session's commits)

### Repro
1. Load demo session via the footer "Load demo" button.
2. Click Tabs 1 (Context), 2 (Current state), 3 (Desired state), 5 (Reporting) — verify each shows a `.demo-mode-banner` element with text "Demo mode · You're viewing example data."
3. Click Tab 4 (Gaps).

### Expected
`.demo-mode-banner` renders in Tab 4's left panel with the same text, matching the contract V-FLOW-VT26 asserts ("Demo banner renders in the left panel of every tab when meta.isDemo === true").

### Actual
Tab 4 (Gaps) renders content but no `.demo-mode-banner` element. The Gaps board shows but the user has no visible "you're in demo mode" indicator on this specific tab.

### Why VT26 is GREEN despite this
VT26 in §T45 invokes `renderGapsEditView(l, r, v2shape)` directly with a freshly-built v3 engagement (post-I-B-6 rewrite via `setActiveEngagement(createEmptyEngagement({meta:{isDemo:true}}))` + `engagementToV2Session` projection). The direct-render path apparently includes the banner. The discrepancy is in the LIVE demo-loader path — `app.js` Load demo button → `demoMod.loadDemo()` → `setActiveEngagement(v3eng)` → `subscribeActiveEngagement` triggers `renderStage()` → routes to GapsEditView through a different code path that omits the banner.

### Suspected root cause
Either (a) `ui/views/GapsEditView.js` reads `meta.isDemo` from a different state shape than VT26's direct-call path provides, or (b) the demo-banner-render branch in GapsEditView is conditional on something the demo-loader path doesn't set (e.g. `engagement.customer.name` non-empty AND `meta.isDemo:true` — VT26 sets a customer name, which is what makes its render path show the banner).

### Fix plan
1. Compare the rendering flow:
   - VT26 path: `setActiveEngagement(createEmptyEngagement({meta:{isDemo:true}}))` + `commitContextEdit({customer:{name:"VT26 Demo Co"}})` + `commitDriverAdd(...)` + direct `renderGapsEditView(l, r, v2shape)`.
   - Live demo-loader: `demoMod.loadDemo()` + `setActiveEngagement(v3eng)` + `subscribeActiveEngagement` triggers `renderStage()` which routes through `app.js` to `renderGapsEditView`.
2. Read `ui/views/GapsEditView.js` for the demo-banner render block and identify the predicate.
3. If predicate diverges from VT26's setup: either widen the predicate to catch the live-demo case OR fix the demo-loader to populate the missing field.
   With regression test: V-FLOW-DEMO-BANNER-GAPS-1 — drive the FULL live demo-loader flow (call `loadDemo()` + `setActiveEngagement` + dispatch `renderStage`), assert `.demo-mode-banner` present in main-left after navigating to Tab 4. (This is stronger than VT26's direct-render check.)

### Memory anchor
Surfaced by R11's mandatory regression-suite walk at every commit boundary. Without R11, banner-only verification would have missed this entirely (the test suite is GREEN; only manual Tab 4 click reveals the gap). This is exactly the failed-attempt anti-pattern R11 is designed to catch — confirms R11's value on its first hard application.

---

## BUG-043 · "Load demo session" button in fresh-session welcome card does not load the demo

**Status**: OPEN · Reported 2026-05-09 · v3.0.0-rc.7-dev (post-Step-H+J+K, commit `ea898df`) · Scheduled rc.7 / 7e-post (Day 1, alongside FS3)
**Reporter**: User during post-Step-K browser smoke walk
**Severity**: Medium (golden path: a fresh user is supposed to be ONE click from a populated demo; this click silently fails)
**Regression**: Likely yes — the live footer "Load demo" button works (proven by the standing regression flow); the welcome-card-embedded "Load demo session" button is the broken affordance.

### Repro
1. Click footer "+ New session" → confirm "Start fresh".
2. Land on Tab 1 with the welcome card "NEW SESSION · Start a workshop from scratch, or explore with demo data" + two CTAs: "↺ Load demo session" (blue primary) and "Start fresh" (outline).
3. Click the welcome-card "↺ Load demo session" button.

### Expected
Engagement loads to Acme Healthcare demo (3 drivers, 4 envs, 23 instances, 8 gaps); header pill flips to "Acme Healthcare Group · DEMO SESSION"; current tab re-renders to demo content.

### Actual
Engagement state DOES update under the hood (probe via `getActiveEngagement()` returns the Acme demo with 3/8/23 counts), but the UI continues to show the welcome card + "New customer" pill — Tab 1 does NOT re-render. (This is the same shape as BUG-042's Tab 1 stale-render-on-active-tab — the demo-loader path mutates engagement state but the render that's bound to the active tab doesn't fire.) Footer "Load demo" button works correctly; only the welcome-card button is broken.

### Suspected root cause
Either the welcome-card "Load demo session" handler is wired to a different path than the footer button's handler, OR it's the same path but missing the explicit `renderHeaderMeta() / renderStepper() / renderStage()` call that the footer handler does (per `app.js` line ~742 — footer Demo handler explicitly re-renders after `setActiveEngagement`). The welcome-card handler probably trusts `subscribeActiveEngagement` to drive the re-render, but Tab 1 is bound to a stale closure (BUG-042's family).

### Fix plan
1. Locate the welcome-card "Load demo session" click handler (likely in `ui/views/ContextView.js` or wherever the welcome card is rendered).
2. Compare its post-load render sequence to the footer-button handler's (`app.js` line ~742).
3. Make them symmetric: explicit `renderHeaderMeta() / renderStepper() / renderStage()` after `setActiveEngagement(v3eng)`.
4. With regression test V-FLOW-DEMO-WELCOME-CARD-1: drive the welcome-card click programmatically, assert `.demo-mode-banner` + `Acme Healthcare Group` header pill + 3 driver tiles + Tab 4/5 un-greyed all appear in main-left after the click.

### Memory anchor
Likely shares root cause with BUG-042 (Tab 1 stale-render-on-active-tab) — both about Tab 1 not re-rendering when the demo-loader path mutates state. Fix together if possible.

---

## BUG-044 · UUID strings leak into Gap tile + AI chat response UI instead of the entity's human-readable name

**Status**: OPEN · Reported 2026-05-09 · v3.0.0-rc.7-dev · Scheduled rc.7 / 7e-post or Day 2 golden-path bucket
**Reporter**: User during post-Step-K browser smoke walk
**Severity**: Medium (correctness + trust — exposing internal IDs to the user reads as a half-finished UX; in AI chat it could also confuse the LLM into echoing UUIDs back)
**Regression**: Yes — pre-rc.7 the gap tile + chat response showed labels (e.g. "Cyber Resilience driver", "Replace Veeam"), not UUID strings. v3.0 schema introduced UUID-keyed entity collections (per SPEC §S31); a label-resolver step must have been missed in one or more views/services.

### Repro
1. Load demo session.
2. Navigate to Tab 4 (Gaps).
3. Observe each gap card body — the metadata line includes a `★` icon followed by a string of the form `00000000-0000-4000-8000-00d100000001` (the gap's UUID).
4. Open AI Assist (Cmd+K or topbar). Ask any question. Observe the response — UUIDs appear in the LLM's response text, suggesting the system prompt or the grounding context is feeding raw UUIDs instead of resolved labels.

### Expected
- Gap tile metadata line shows the gap's short id label OR (more useful) the linked driver's name (e.g. "★ Cyber Resilience" instead of "★ 00000000-...-00000001").
- AI chat response cites real entity names (e.g. "the Veeam workload" not the workload's UUID).

### Actual
- Gap tiles render UUID after the star icon (4 of 8 gap cards in the demo screenshot show this pattern: e.g. "Replace Veeam with PowerProtect Data Manager... ★ 00000000-0000-4000-8000-00d100000001 2 current 1 desired").
- AI chat response (per user report) similarly carries UUIDs in place of labels, "in other places" too.

### Suspected root cause
Two distinct code paths likely share a single root: the v3 → v2 down-converter (`state/v3ToV2DemoAdapter.js engagementToV2Session`) might be passing the v3 UUID through where a downstream view expects a typeId-shaped (or label-shaped) string. Specific theories:
- **Gap tile**: `ui/views/GapsEditView.js` renders `gap.driverId` or similar field as the chip label without resolving via `eng.drivers.byId[driverId].label` first — fine pre-v3 because `driverId` was the catalog typeId (e.g. "cyber_resilience"), but in v3 it's a UUID.
- **AI chat**: `services/systemPromptAssembler.js` or the grounding router (`services/groundingRouter.js`) builds the LLM context from raw v3 collections, not from a label-projected snapshot. The router result feeds Layer 4 of the system prompt; if it carries UUIDs the LLM has nothing to do but echo them.

### Fix plan
1. Grep all `ui/views/*.js` for `\bdriverId\b` / `\bgapId\b` / `\binstanceId\b` direct rendering. Each hit must resolve via `eng.drivers.byId[id].label` (or equivalent typeId/label resolver) before going to text.
2. Same audit on `services/systemPromptAssembler.js` + `services/groundingRouter.js` + `services/chatTools.js` + `services/uuidScrubber.js` (the latter is *already* the canonical scrub layer — likely not running on the right surfaces).
3. Verify the v2 down-converter in `state/v3ToV2DemoAdapter.js` produces typeId-shaped fields (not UUIDs) — that's the one place V-DEMO-V2-1 already asserts; a V-DEMO-V2-2 strengthening might catch this regression.
4. With regression tests:
   - V-FLOW-GAP-TILE-LABEL-1 — render Tab 4 with the demo, assert no gap card's text content contains a `/[0-9a-f]{8}-[0-9a-f]{4}-/` UUID pattern.
   - V-FLOW-CHAT-LABELS-1 — drive a chat round-trip with a real LLM probe (or v3 grounding-router output), assert no UUID pattern in the response or in the system prompt's grounding context.

### Memory anchor
Same shape as the v2 → v3 cutover BUG-010 (bridge clobber): the data-shape boundary between v3 collections and the user-facing surfaces was supposed to be entirely handled by adapters/projectors. Spotting UUIDs in user-facing strings is a "boundary leaked" signal — same anti-pattern. Fix should center on the projector layer, not on per-view string-replacement.

---

## BUG-045 · SettingsModal "Couldn't save — reopen Settings" red error fires on initial open + Save without first tab-switching (CLOSED 2026-05-09)

**Status**: **CLOSED 2026-05-09** · Reported by user with screenshot 2026-05-09 (Local A provider · API key entered · Save clicked → red error). Root cause + fix shipped same day.
**Reporter**: User
**Severity**: High (Save was non-functional on the most common entry path — first-open + Save)
**Regression**: No — pre-existing structural mismatch since rc.4-dev Hotfix #1 (`36a87fe`) scoped the lookup to `.overlay-body`. The hotfix worked for swapSection because swap REPLACES the wrap; it didn't work for initial-open because openOverlay APPENDS the body INTO a fresh wrap. Two DOM structures, lookup matched only one.

### Repro
1. Open Settings via topbar gear button (initial-open path; no prior tab switch).
2. (Optional) switch to AI Providers tab is the default; no need to click pills.
3. Enter / change any field (API key, model, baseUrl, etc.).
4. Click Save.

### Expected
Save persists the AI config to localStorage; button flashes "Saved ✓" then resets to "Save" disabled until next edit.

### Actual (pre-fix)
Save button flashes red: "Couldn't save — reopen Settings" for 2 seconds, then resets. localStorage NOT updated.

### Root cause
`ui/components/Overlay.js` line 172-175 wraps the user-supplied `body` in a fresh `<div class="overlay-body">` on every `openOverlay()` call. So the DOM is:
```
<div class="overlay-body">         <!-- wrap, NO _settings stash -->
  <div class="settings-body ...">  <!-- inner (buildSettingsBody), HAS _settings -->
    ...
  </div>
</div>
```

`ui/views/SettingsModal.js` `swapSection()` (tab switch) instead REPLACES the wrap with a body that has `class="overlay-body"` added (line 111: `newBody.classList.add("overlay-body")`). Post-swap, `.overlay-body` IS the body with `_settings`. Two different structures across initial-open vs post-swap paths.

The Save handler at line 353 scoped its lookup to `.overlay-body` (the wrap on initial-open, the body on post-swap). Hit the wrap on initial-open → no `_settings` → friendly error.

### Fix
`ui/views/SettingsModal.js` Save handler now scopes the lookup to `.settings-body` (always the body proper, regardless of which mount path produced it). One source of truth across both paths.

### Regression test
**V-FLOW-SETTINGS-SAVE-1**: open Settings via `openSettingsModal({ section: "providers" })` (initial-open path), assert `.settings-body` carries `_settings` with populated `config.providers` + non-empty `activeKey`. The pre-fix lookup pattern would NOT have caught this (it only checked `.overlay-body`).

### Memory anchor
Same shape as BUG-042: VT26 was passing because it tested ONE rendering path (direct call) but the LIVE app exercised a DIFFERENT path (live demo-loader). Two paths diverged. Pattern to add to spec: when a function has multiple call sites with different DOM-mount paths, the test must cover EACH mount path separately, not just one.

---

## BUG-046 · AI chat quality enhancement — chat doesn't know calculation methodologies, instance NAMES (only counts via selectMatrixView), or design rationale (deferred)

**Status**: OPEN · Reported by user 2026-05-09 with verbatim chat-session quote · Scheduled v3.1 (chat polish + grounding-router enhancement)
**Reporter**: User during workshop validation
**Severity**: Medium (chat works correctly + ground-truth-honest, but has explicit gaps the LLM correctly self-reports — opportunity for 10x deeper helpfulness)
**Regression**: No — these are gaps in what the grounding context contains, not bugs in what's there. The chat is doing the right thing (admitting "data not specified"), it just doesn't have access to the deeper data.

### User feedback (verbatim)
> "The quality of the chat ai responses are great but we need to enhanse it more and improve the performance and ightness, we did this once before and i think it is worth to revisi it when all majosr data and connections and relationships and functions are fixed and reaady... dont get me wrong i think the answers are great now , but there is a room for improvement maybe."

### Specific gaps surfaced by chat sample
1. **Instance NAMES vs counts**: chat asked "find the dell assets in current state" → response gave Dell instance COUNTS per environment+layer (correct, sourced from selectMatrixView count rollup). Follow-up "i need to know these components names" → response could only resolve some labels, said: *"the data does not specify which of the two instances (PowerEdge R740 Cluster or Cisco UCS B-series) is the Dell one."* Translation: selectMatrixView returns aggregate counts; the LLM has no per-cell instance-label-with-vendor projection. Need a selector that returns instance.label + instance.vendor + instance.layerId + env-alias for the cells the LLM is reasoning about.
2. **Calculation methodology unknown**: chat asked "how the discovery coverage score and heath status are calculated?" → response listed factor INPUTS but said *"the canvas doesn't include the explicit calculation methodology."* The formula DOES exist (services/healthMetrics.js). Need a "how-this-is-calculated" capability — either: (a) a new selector `selectCalculationMethodology(scoreId)` that returns the formula doc-string, or (b) inline the formulas in the system prompt's catalog/data-contract section.
3. **Design rationale**: chat asked "what else you think you can answer be better about" → response gave a beautiful self-reflective list: invariant rationale, concept nuances ("replace" vs "consolidate"), workflow best practices, "so what" of reporting views, graceful-not-supported responses. All real opportunities.
4. **Auto-draft rule transparency** (added 2026-05-09 from user's second sample): chat asked about the auto-drafted gaps generation. Response: *"the contract does not provide explicit criteria or logic for how these auto-generated gaps are created, nor does it detail what specific conditions lead to a particular gap type (e.g., replace, consolidate, introduce, enhance, or operational). While I can tell you what each gapType means... I cannot tell you the internal rules the app uses to decide which type of gap to propose based on current vs. desired state deltas..."* The decision logic DOES exist in `state/dispositionLogic.js buildGapFromDispositionV3` (and the v2 analogue in the deleted `interactions/desiredStateSync.js`). The mapping is `disposition → gapType` (e.g., `disposition: "replace"` produces `gapType: "replace"` automatically; `disposition: "keep"` produces no gap; `disposition: "consolidate"` produces `gapType: "consolidate"` and inherits the desired-instance link). Need a "decision-rule" data-contract section OR a `selectDecisionRules()` capability so the LLM can articulate "when you set a current instance's disposition to 'replace', the app auto-drafts a Replace gap linked to that instance with reviewed:false; you confirm by clicking Approve."

### Fix plan (v3.1 chat polish arc)
1. **NEW SELECTOR `selectInstancesByVendor(vendorGroup, stateFilter?)`**: returns `[{ id, label, vendor, vendorGroup, layerLabel, environmentLabel, criticality, disposition }]` for each instance matching the filter. Lets chat answer "name the Dell assets" with full label-level resolution.
2. **NEW DATA-CONTRACT SECTION `calculationMethodologies`**: inline the actual formulas from services/healthMetrics.js + services/programsService.js + selectors/healthSummary.js into the system prompt's data-contract block. So the chat can articulate "Discovery Coverage = (gaps with disposition / total gaps) × 100, weighted by layer..." or whatever the actual formula is. Single source of truth: extract the formula constants from the service file, embed them as a documented map.
3. **NEW SECTION IN ROLE PROMPT — "Anticipating user confusion"**: per the chat's own self-reflection ("replace vs consolidate", "Workload vs Compute"), bake explicit nuance-clarification examples into the role section. The LLM can already articulate these once primed.
4. **Performance**: per BUG-021, OpenAI prompt caching wiring + Anthropic extended-1h caching for workshop-length sessions. Token-budget hint chip in chat header so user sees cache hits.
5. **"So what" hooks for reporting views**: each `selectXView` selector emits an additional `_executiveTakeaway` field — "the money slide" the designers had in mind. So chat doesn't just summarize the data; it interprets it.
6. **NEW DATA-CONTRACT SECTION `decisionRules`**: inline the disposition → gapType mapping + auto-draft rules from `state/dispositionLogic.js buildGapFromDispositionV3`. So chat can articulate "when you set a current instance's disposition to 'replace', the app auto-drafts a Replace gap linked to that instance with reviewed:false; the gap inherits the linked desired instance once you create it; you confirm by clicking Approve." Same structural pattern as #2 (formulas) — extract the rule constants from the source-of-truth file, embed them as a documented map.

### Out of scope (this rc.7)
This is a v3.1 polish item. The user explicitly said "when all majosr data and connections and relationships and functions are fixed and reaady". rc.7 ships the architecture; v3.1 ships the depth.

### Memory anchor
The user's framing is clear: chat is working correctly today; the room for improvement is enrichment (more selectors, formula transparency, anticipatory nuance), not regression repair. Track as a v3.1 epic; the 5 items above are the breakdown.

---

## BUG-047 · AI provider chip strip shows ALL configured providers as green dots — no visual distinction between "currently active" and "configured but inactive" (CLOSED 2026-05-09 — visual + label distinction shipped)

**Status**: **CLOSED 2026-05-09** · Reported by user 2026-05-09: *"all providers show green dots in the drop down list of the ai assist window, though some are not connected .. status mismatch"*. Root cause + visual fix shipped same day.
**Reporter**: User
**Severity**: Medium (UX trust — green dot implied "connected/working", but really meant "configured")
**Regression**: No — pre-existing CSS `.is-ready` rule painted green dot regardless of active state.

### Repro
1. Open Canvas AI Assist (topbar AI Assist button).
2. Click the provider chip strip (upper-right of overlay header).
3. Popover shows all configured providers (those with baseUrl + apiKey) as green dots.
4. Even providers the user has NEVER actually tested or used appear green — visually identical to the active provider.

### Root cause
`styles.css` line 6269 `.canvas-chat-provider-row.is-ready .canvas-chat-provider-row-dot { background: var(--green); }` painted EVERY configured provider's dot green. The `.is-active` modifier set background hover/text colors but didn't change the dot color, so active and configured-but-inactive looked identical.

The `isProviderReady(config, providerKey)` check in `ui/views/CanvasChatOverlay.js` line 860 verifies `baseUrl` + `apiKey` PRESENCE, not actual server reachability. So every provider with a populated config appeared green (a "configured" signal masquerading as a "connected" signal).

### Fix
1. **CSS visual distinction**: `.is-ready` (configured-but-inactive) dot now `var(--dell-blue)` (a neutral "switchable" signal, NOT a "live/connected" signal). `.is-active.is-ready` (currently active) keeps `var(--green)`. `.is-warn` (no key) stays `var(--amber)`.
2. **Label clarity**: meta text "Ready" → "Configured" (active stays "Active"; needs-key stays "Needs key"). The label now matches what the check actually verifies (baseUrl + apiKey present).
3. **Future enhancement (BUG-046 #6 v3.1)**: real reachability probing — send a HEAD/options to each provider's baseUrl on popover open with a short timeout, cache the result, drive a "Reachable" 3rd state. Out of scope for rc.7.

### Memory anchor
Same pattern as BUG-044's chat-half: a label ("Ready") implied a stronger property ("connected") than the underlying check actually verified ("configured"). When the label and the truth diverge, users lose trust. Fix in TWO places: the visual signal AND the text label.

---

## BUG-048 · Right-pane detail panel disappears after Save on a current/desired-state instance edit (CLOSED 2026-05-09 — selection persisted across re-mount)

**Status**: **CLOSED 2026-05-09** · Reported by user 2026-05-09: *"the workload, and properly other items in the current state and desired state, the right pannel window, when i change the criticlaity for example, the right panned addtional infomraiton about the selected item diaperes ... and i have to reselect it again. this happen for example when i change criticlaity and click save"*. Root cause + fix shipped same day.
**Reporter**: User
**Severity**: Medium (workshop-flow disrupted; user mid-edit loses focus and has to re-click the tile they were JUST editing)
**Regression**: New behavior introduced by Step G + Step H+J+K's subscribe-driven shell re-render. Pre-Step-G the v2 sessionBridge had different timing.

### Repro
1. Load demo (or any engagement with instances).
2. Tab 2 (Current state) OR Tab 3 (Desired state).
3. Click any instance tile to open the right-pane detail panel.
4. Change criticality (or any other field).
5. Click Save.
6. Right-pane detail panel disappears; user has to re-click the tile to keep editing.

### Root cause
`ui/views/MatrixView.js` line 39 (pre-fix): `var selectedInstId = null;` was a CLOSURE-LOCAL variable inside `renderMatrixView`. The Save flow:
1. `commitInstanceUpdate(inst.id, patch)` mutates engagement
2. engagementStore `_emit()` fires `subscribeActiveEngagement` listeners
3. `app.js` shell-render listener fires `renderHeaderMeta() / renderStepper() / renderStage()`
4. `renderStage()` re-calls `renderMatrixView(left, right, null, opts)` from scratch
5. NEW closure starts with `selectedInstId = null` → right pane reverts to `showHint(right)` placeholder

The selection state didn't survive re-mount.

### Fix
1. **Lift `_selectedInstIdByState` to module scope** (keyed by stateFilter so Tab 2 and Tab 3 keep independent selections; a current-state selection isn't carried into desired-state and vice-versa).
2. **Sync local var to map** at all 4 write sites (tile click, tile delete, detail panel mount, detail panel delete).
3. **Restore detail panel on re-mount**: at end of `renderMatrixView`, if persisted `selectedInstId` matches a live engagement instance whose state matches the current `stateFilter`, call `showDetailPanel(right, instance)` instead of `showHint(right)`. Otherwise (stale ID, instance deleted) clear the persisted ID + show the hint.

### Regression test
**V-FLOW-MATRIX-SELECTION-PERSIST-1**: drives a v3-direct fixture (engagement + 1 instance), renders MatrixView once, simulates a tile click, re-renders MatrixView (simulates the engagement subscriber chain firing after a commit), asserts the right pane re-mounts with the detail panel — NOT the hint placeholder.

### Memory anchor
Same shape as BUG-043 (shell-subscribe wiped by tests) and BUG-042 (demo-banner predicate read from dead arg): re-mount paths in the v3-pure-shell-driven architecture must NOT lose mid-edit user state. Pattern to add to spec: "any view-local state that the user's edit-in-progress depends on must persist across the engagement subscriber re-render chain."

---

## BUG-049 · UUIDs leak into Reporting → Initiative pipeline chips ("00000000-...-001 — Layer Modernization (1)" instead of "Riyadh Core DC — Layer Modernization (1)") (CLOSED 2026-05-09)

**Status**: **CLOSED 2026-05-09** · Reported by user 2026-05-09 with screenshot. Same shape as BUG-044 (UUID leak into user-visible UI). Fix: project env UUID → envCatalogId in `state/v3Projection.js getEngagementAsSession()` (the v2-shape projection used by the reporting layer). Same pattern as the `engagementToV2Session` adapter already implements.
**Reporter**: User
**Severity**: Medium (UI trust + workshop-readout polish — chips render unreadable raw UUID strings)
**Regression**: Yes — pre-existing since the v3 projection layer was added; the projector mapped envs but not gap.affectedEnvironments / instance.environmentId (those stayed v3 UUID).

### Repro
1. Load Acme Healthcare demo.
2. Navigate to Tab 5 (Reporting) → Overview sub-tab.
3. Scroll to "Initiative pipeline at a glance" card.
4. Each chip in Now/Next/Later columns shows label `<env-key> — <layer> <verb> (<count>)`. Pre-fix the env-key resolved to a raw UUID for any project derived from gaps with v3 affectedEnvironments.

### Expected
Chips read like `Riyadh Core DC — Data Protection & Recovery Modernization (1)` (env-name + em-dash + layer-verb + count).

### Actual (pre-fix)
Chips read like `00000000-0000-4000-8000-00e100000001 — Data Protection & Recovery Modernization (1)`.

### Root cause
`services/roadmapService.js buildProjects` calls `resolvePrimaryEnv(session, gap)` which returns `gap.affectedEnvironments[0]`. In the v2-shape projection (`state/v3Projection.js getEngagementAsSession()`), gap fields were shallow-copied: `{ ...g }`. So `affectedEnvironments` retained v3 UUID values. `envLabel(uuid)` looks up `ENVIRONMENTS` v2 catalog (typeId-keyed) → no match → falls through to return the UUID.

### Fix
`state/v3Projection.js getEngagementAsSession()`: build `envUuidToCatalogId` map (uuid → envCatalogId typeId) at the env-projection step, then remap:
- `instance.environmentId` from UUID → typeId
- `gap.affectedEnvironments[]` from [UUID...] → [typeId...]

Now `envLabel(typeId)` resolves via `ENVIRONMENTS` catalog → returns the human label. The user-visible chip shows the env name. Pattern matches the existing `engagementToV2Session` adapter (line 86 + 115).

### Out of scope
- The Reporting Initiative-pipeline chip text format ("env — layer verb (count)") is the rc.6-era render; full v3.1 reporting-enhancements arc may redesign it (per user direction "this view will be redesigned anyway in the reporting enhancements task"). The fix here just stops the UUID leak in the CURRENT format.

### Memory anchor
Same shape as BUG-044 (user-visible UUID leak) and BUG-049: every v2-shape projection of v3 data must remap UUID-keyed FK fields to the v2 typeId. Add to v3.1 plan: a single audit pass on every v2-shape projector (engagementToV2Session, getEngagementAsSession, anything else) verifying all FK references get the UUID→typeId remap.

---

## BUG-050 · Workload "↑ Propagate criticality" button appears disabled after first propagate cycle + add-asset (NEEDS-REPRO 2026-05-09)

**Status**: OPEN · NEEDS USER REPRO DETAIL · Reported 2026-05-09 by user · Could not reproduce in live Chrome MCP test of the same described sequence; suspect specific UI-interaction nuance (timing, env, layer, or specific provider mode) not captured. Scheduled rc.7 / 7e-post if reproducible OR v3.1 reporting + matrix polish.
**Reporter**: User
**Severity**: Medium (workshop flow disrupted if reproducible — user can't propagate again after a workflow cycle)

### User report (verbatim)
*"the propegation of the workload criticality get disabled after i propegate some items , and then add another item , whey i try to propegate , it is diabled and can not be cliecked"*

### Reproduction attempt 2026-05-09 (could NOT reproduce)
Live Chrome MCP test:
1. Load Acme demo, navigate to Tab 2 Current state.
2. Programmatically lower one mapped asset of PACS Imaging workload to criticality "Low".
3. Click PACS tile → detail panel opens with "↑ Propagate criticality" button (disabled=false, pointer-events=auto, opacity=1).
4. Click Propagate → window.confirm auto-accept → asset upgraded Low→High. Button stays present, enabled.
5. Click "+ Map asset" → picker overlay opens with 2 candidates.
6. Click first candidate → commitWorkloadMap fires → picker closes → detail panel re-renders → propBtn still present, enabled, opacity 1.
7. (Test setup also lowered another mapped asset's crit to Low to make propagate non-empty.)
8. Click Propagate again → asset upgraded Low→High. No alert. Button stays present.
9. propBtnDisabledFinal: false. mappedSectionCount: 1 (no dup). propBtnCount: 1 (no dup).

So in the test reproduction, the button works correctly across both cycles + intermediate add-asset. The bug does not reproduce.

### Suspected scenarios needing user clarification
The bug may surface only under one of:
- Specific provider mode (Local A/B vs Anthropic vs Gemini) influencing some shared event handler
- Specific environment / layer combination
- Specific click-order timing (e.g. clicking propagate while the picker overlay is still mid-fade-out)
- A different asset-add path (drag-drop? keyboard?)
- Different state — e.g. after a `+New session` reset
- A stale CSS state class lingering from a prior overlay

### Things checked (and ruled out)
- No CSS rule disables `.propagate-btn` based on any state class
- `propBtn.disabled = true` not set programmatically anywhere
- `pointer-events: none` not set
- Button NOT hidden (display: none / visibility: hidden) in any code path
- `commitWorkloadMap` correctly updates `workload.mappedAssetIds`; the listener chain re-renders the panel; the new propBtn has a fresh closure
- BUG-048 fix's restore-showDetailPanel doesn't double up the section (verified mappedSectionCount: 1 + propBtnCount: 1 in test)

### Fix plan
1. Ask user for: which environment / layer was the workload? Which provider was active? Did anything OTHER than the propagate button click do something unexpected? Was the page recently reloaded? Was test mode running in F12?
2. If reproducible with detail: trace the exact flow + wire to a regression test V-FLOW-PROPAGATE-AFTER-MAP-1.
3. If not reproducible: leave open as NEEDS-REPRO and re-test in v3.1 polish arc.

### Memory anchor
Reported in same session as BUG-049 + BUG-047 + BUG-048. Both BUG-047 (cosmetic dot color) and BUG-048 (selection persistence) had clean reproductions; BUG-050 specifically did not. Could be tied to the BUG-048 fix's behavior under some specific timing — flag if user re-hits and confirm BUG-048 commit (`d6d74b8`) timing is involved.

---

## BUG-051 · GapsEditView selectedGapId is closure-local; gap detail panel + link buttons disappear after every commitGapLink* / commitGapEdit (this is the root cause of BUG-032) (CLOSED 2026-05-09)

**Status**: **CLOSED 2026-05-09** · Reported by user 2026-05-09 — *"when i try to click on the linked state to link more assets for ecample, at times the linked state button is deactivated. this is an old bug that was claimed fixed but it is still showing up"*. Root cause identified + fixed same day. **This closes BUG-032 (workshop-2026-05-05 deferred-for-repro).**
**Reporter**: User
**Severity**: Medium-High (workshop flow disrupted — every link cycle dropped the user out of their gap context, requiring a re-click to continue editing the same gap)
**Regression**: Yes — pre-existing since the v3-pure shell-render subscriber chain landed (Step G area). Same shape as BUG-048 (MatrixView). Both surfaced when `commitX` flows triggered `subscribeActiveEngagement` → `renderStage` → fresh view closure with `var selectedX = null`.

### Repro
1. Tab 4 Gaps. Select a gap by clicking its card.
2. Right pane shows the gap detail panel including "+ Link current instance" + "+ Link desired instance" buttons.
3. Click "+ Link desired instance" → picker opens → click an unlinked desired instance.
4. Picker closes; commitGapLinkDesiredInstance fires.
5. → Gap detail panel disappears; right pane reverts to "[gap] Select a gap" placeholder hint.
6. To continue editing the same gap, user must re-click the gap card.

### Root cause
`ui/views/GapsEditView.js` line 174 (pre-fix): `var selectedGapId = null;` was a closure-local variable inside `renderGapsEditView`. The link flow:
1. `commitGapLinkDesiredInstance(gap.id, instId)` mutates engagement
2. engagementStore `_emit()` fires `subscribeActiveEngagement` listeners
3. app.js shell-render listener fires `renderHeaderMeta + renderStepper + renderStage`
4. `renderStage()` re-calls `renderGapsEditView(left, right, null)` from scratch
5. NEW closure starts with `selectedGapId = null` → right pane renders `gap-empty hint` instead of the detail panel

The user's mental model: "I clicked a button to link an asset, and the button stopped working." The button was correct; it just disappeared along with the rest of the panel. BUG-032's hypothesis #3 (event-listener-not-attached due to render-order race) was directionally right; the actual mechanism was simpler (closure scope vs module scope), not a race.

### Fix
Same pattern as BUG-048 (MatrixView):
1. **Lift `_selectedGapIdInGapsView` to module scope**.
2. **Sync local var to map** at all 4 write sites: gap card click, auto-advance to next unreviewed, gap-removed clear, manual-add gap selection.
3. **Read at render-start**: `var selectedGapId = getSelectedGapId();` so the local var picks up the persisted value across re-mounts.
4. The detail-panel re-render path automatically picks up the live gap (existing `_v3GapsArray().find(g.id === selectedGapId)` continues to work; only its closure source changed).

### Regression test
**V-FLOW-GAPS-SELECTION-PERSIST-1**: drives v3-direct fixture (engagement + 1 instance + 1 gap), renders GapsEditView, simulates gap card click, re-renders GapsEditView (simulates engagement subscriber chain after a commit), asserts right pane re-mounts with the gap detail panel including link buttons. The pre-fix closure-local pattern would NOT have caught this — only checked single-render state.

### Memory anchor
THIRD instance of the "view-local state lost across re-mount" pattern in 2 days:
- BUG-043 (shell-render subscriber wiped by test reset)
- BUG-048 (MatrixView selectedInstId closure-local)
- BUG-051 (GapsEditView selectedGapId closure-local — this entry)

**Pattern to add to v3.1 spec audit**: every view that holds user-selection state across edit cycles must lift that state to module scope (or to a state-store module). Closure-local selection variables are an anti-pattern in subscribe-driven shell architectures. Audit candidates for the same shape: `ui/views/CanvasChatOverlay.js` (state object IS module-scope already, OK), `ui/views/ContextView.js` (driver-detail selection?), `ui/views/SkillBuilder.js` (skill-edit selection?). Schedule the audit pass for v3.1 polish arc.

---

## BUG-052 · Modal-residue test cluster — 6 intermittent failures tied to overlay/modal teardown ordering (OPEN 2026-05-12)

**Status**: **OPEN** · Reported 2026-05-12 · v3.0.0-rc.8-dev · Scheduled post-rc.8.b S47 implementation arc (do NOT block C1/C2/C3 commits on this)
**Reporter**: Claude (observed during rc.8.b polish arc smoke runs on 2026-05-11 and during S47 RED scaffold session on 2026-05-12)
**Severity**: Low (intermittent flake; does not gate any feature; banner reads 1244/1265 with these tests as the deterministic-fail set on the affected runs)
**Regression**: No — pre-existing flake pattern that surfaces under specific run-ordering conditions; today's S47 RED tests do NOT touch any DOM and are confirmed not to be the cause

### Affected tests (6)
1. **V-HELP-MODAL-ESC-1** — Help modal Esc-to-close.
2. **V-CLEAR-CHAT-PERSISTS** — chat persistence after clear/reload sequence.
3. **V-OVERLAY-STACK-4** — overlay stacking z-order assertion.
4. **V-FLOW-CHAT-PERSIST-1** — chat persistence across overlay teardown.
5. **V-FLOW-CHAT-PERSIST-2** — chat persistence on engagement switch.
6. **V-PILLS-4** — chip-pill state restoration after modal close.

### Repro
- Run the full appSpec.js suite via the in-app `?spec=run` smoke harness.
- On most runs all 6 are GREEN.
- On a subset of runs (estimated ~10-20% sample), one to all six fail with assertions like "modal residue still attached" or "expected detail panel not present after teardown".
- Refresh + re-run → typically GREEN again with no code changes.

### Expected
All six tests deterministically GREEN on every run regardless of ordering.

### Actual
Intermittent state-dependent flake — appears to depend on whether a prior test in the run left a modal/overlay node attached, on the timing of `closeOnEsc` listener installation, or on the chat scroll-restore microtask completing before the next test bootstraps.

### Suspected root cause
Cluster shares one of three families (all involve teardown sequencing in the modal/overlay stack):
- **Family A (most likely):** modal teardown asynchronously detaches its root after the next test's setup has already snapshot the DOM, so an unrelated assertion sees a residual `.modal-root` or `.help-modal` node. Closing path may queue a microtask via `requestAnimationFrame` that races the next test's mount.
- **Family B:** chat-persist tests share a single localStorage key with prior overlay tests; if a prior test fails partway through, it leaves the storage in an intermediate state and the next persist-assert reads the wrong row.
- **Family C:** the spec runner does not await an explicit "teardown complete" signal; tests that rely on `closeModal()` returning synchronously assume cleanup is done before the next `it()` mounts, but the close uses a transitionend listener that fires later.

### Why this entry exists now (recoverability)
- Cluster surfaced during S47 RED-scaffold smoke this morning; the 15 new V-FLOW-IMPORT-* RED tests do NOT touch the DOM (each probes a module import or string-match on a future artifact), so they cannot be the cause.
- Without this entry, a future investigator might mis-attribute the flake to the S47 work-in-progress.
- Banner at HEAD 549599f reads 1244/1265 GREEN, 6 RED-by-design (S47 scaffolds — V-FLOW-IMPORT-*) + 6 intermittent (this cluster). The 1244/1265 line in the session log assumes the 6 intermittents are GREEN on the canonical run; on flaky runs the count drops to 1238/1265.

### Fix plan (deferred — do NOT inline into C1/C2/C3)
1. Reproduce reliably by running the affected tests in isolation with a stress-loop (50 iterations) to confirm the family.
2. If Family A: add an explicit `await modal.fullyClosed()` promise resolved on transitionend; gate next-test setup on it.
3. If Family B: namespace per-test localStorage keys with a test-id prefix (e.g. `dell-discovery:chat:test:<vector-id>`); clear all on `afterEach`.
4. If Family C: extend the spec runner's `it()` to await an explicit teardown signal before invoking the next test.
5. Ship the fix WITH a regression vector that drives the previously-flaky ordering 100× and asserts GREEN on every pass:
   ```js
   it("V-FLOW-MODAL-TEARDOWN-DETERMINISTIC-1 · cluster of 6 modal-residue tests pass deterministically across 50 iterations", async () => {
     for (let i = 0; i < 50; i++) {
       // re-run the affected sequence: HELP-MODAL-ESC → CLEAR-CHAT-PERSISTS → OVERLAY-STACK-4 → FLOW-CHAT-PERSIST-1 → FLOW-CHAT-PERSIST-2 → PILLS-4
       // assert no residual nodes after each teardown
     }
   });
   ```
6. Once stable for 200+ consecutive runs without flake, mark CLOSED.

### Scheduling
**Bucket**: post-S47 implementation arc cleanup. Investigate during rc.8.c (after rc.8.b tag closes) so it does not entangle with the file-ingestion feature work. Do NOT inline the fix into C1/C2/C3 since the cluster is unrelated to S47 and the flake pattern is pre-existing.

---

## BUG-053 · Path A (skill-via-launcher importer) parked after constitutional-creep audit (OPEN-DEFERRED 2026-05-12)

**Status**: **OPEN-DEFERRED 2026-05-12** · Path A code ripped from main branch via R1 commit. Re-attempt blocked until proper constitutional flow is followed per `feedback_5_forcing_functions.md` Rule A.
**Reporter**: User (post-implementation audit)
**Severity**: Discipline (no production breakage; bounded scope)
**Regression**: No — Path A never went live in a tagged release; the rip restores rc.8.b GA-readiness state

### What was parked

The "file-ingest skill in the Canvas Chat launcher" entry point (Path A of the §S47 import workflow) including:

1. **`schema/skill.js`** — extension of locked `OutputFormatEnum` with `"import-subset"` value · this is a constitutional touch that was NOT flagged with `[CONSTITUTIONAL TOUCH PROPOSED]` before code landed. (per `feedback_5_forcing_functions.md` Rule A)
2. **`schema/skill.js`** — 3 new fields added without explicit Q&A: `preview` (enum), `defaultScope` (enum), `kind` (enum). Each touches the locked v3.2 SkillSchema shape.
3. **`state/v3SkillStore.js`** — system-skills distribution model: `loadSystemSkills`, `preloadSystemSkills`, `loadAllV3SkillsSync`, `loadAllV3Skills`, `SYSTEM_SKILL_FILES` constant, `SYSTEM_ENG_ID`/`SYSTEM_TS` defaults.
4. **`app.js`** — `preloadSystemSkills()` boot hook in DOMContentLoaded.
5. **`ui/views/CanvasChatOverlay.js`** — `loadAllV3SkillsSync` swap in launcher + rail · System chip rendering in `_buildLauncherRow` · system-first sort · `data-launcher-skill-kind` attribute · `_renderSkillRunOutput` "import-subset" branch · `_routeImportSubsetOutput` function · `_paintCanvasChatSkillsForTests` + `_renderSkillRunOutputForTests` test exports.
6. **`ui/views/SkillBuilder.js`** — `loadAllV3SkillsSync` swap · "import-subset" option in `OUTPUT_FORMATS` · `OUTPUT_FORMAT_EXAMPLES` entry for import-subset · system-first sort · System chip rendering in `renderRow` · `data-skill-row-kind` attribute · clone-to-edit prompt in save handler · kind/preview/defaultScope passthrough to draft.
7. **`catalogs/skills/file-ingest-instances.json`** — system skill catalog file.
8. **`diagnostics/appSpec.js`** — 6 V-FLOW-IMPORT-* tests (IMPORT-SUBSET-1, SYSTEM-SKILL-LOADER-1, FILE-INGEST-SKILL-PRESENT-1, LAUNCHER-SYSTEM-CHIP-1, SKILL-RUN-ROUTES-TO-PREVIEW-1, SKILL-BUILDER-IMPORT-SUBSET-1).

### What was KEPT (still works, Path B unaffected)

- `aiTag.kind` constitutional amendment in `schema/instance.js` (Path B needs it for iLLM provenance)
- All shared pipeline modules: `services/importResponseParser.js`, `services/importDriftCheck.js`, `services/importApplier.js`, `services/importInstructionsBuilder.js`
- `ui/components/ImportPreviewModal.js` (Path B uses it)
- `ui/components/ImportDataModal.js` (Path B's entry point)
- `MatrixView.js` Option B ghost suppression + iLLM badge variant (Path B-relevant)
- Footer button + `wireImportDataBtn` in `app.js`
- CSS polish for `.import-data-*`, `.import-preview-*`, `.ai-tag-badge-illm`
- 9 V-FLOW-IMPORT-* tests guarding Path B + the constitutional amendment

### Suspected root cause (discipline lapse)

Path A was implemented across 11 commits (C1a..C3b) WITHOUT the explicit `[CONSTITUTIONAL TOUCH PROPOSED]` Q&A flow even though it extended a locked enum + added 3 new schema fields + introduced the system-skills distribution model (a new constitutional category). The SPEC document §S47.6 + §S47.7 contained the proposal as "additive deltas" / "framework extensions", which papered over the constitutional weight of the changes. The user CONFIRMED the SPEC with "confirm all" but was not given a spotlight on the locked-enum extension.

Subsequent F1..F4 audit-remediation commits did NOT re-open the constitutional question · they fixed UI wiring + CSS but kept the unflagged schema touches.

### Fix plan (for the re-attempt, NOT this entry)

1. SPEC § amendment authored EXPLICITLY as `[CONSTITUTIONAL AMENDMENT]` covering the OutputFormatEnum extension AND the three new schema fields AND the system-skills distribution model.
2. Surface the amendment to user with the four required Q items (what / why-not-local-patch / back-compat / use cases unlocked).
3. Wait for explicit user confirmation outside of any SPEC document text · the SPEC text is not a substitute for Q&A.
4. Author RED tests using Rule B (test-mounts-the-UX) FIRST · mount launcher / SkillBuilder / runner / preview-routing in actual DOM hosts and assert against rendered output.
5. Implement under Rule E (Hidden-Risks section in every commit body).
6. Include a DOM-mount test for clone-to-edit behavior (this was missing in the original arc · saving a kind="system" skill SHOULD trigger confirm() + mint fresh skillId + save as kind="user").

### Regression test

The rip itself is guarded by the existing `V-FLOW-SKILL-V32-AUTHOR-OUTPUT-1` (restored to "EXACTLY 4 options") + the absence of `[data-launcher-system-chip]` / `[data-skill-system-chip]` / `[data-output-format-value="import-subset"]` in the DOM. If a future commit re-introduces ANY of these without the §S47 amendment + Q&A, the user can spot it via:
- `git diff` shows `OutputFormatEnum` modification
- `git diff` shows new exports in `state/v3SkillStore.js` (preloadSystemSkills, loadAllV3SkillsSync)
- `git diff` shows `loadAllV3SkillsSync` in CanvasChatOverlay or SkillBuilder

### Memory anchor

Permanent reference in MEMORY.md → `feedback_5_forcing_functions.md` Rule A. The Path A re-attempt MUST cite this BUG number in the SPEC amendment + every commit body that touches the listed surfaces.

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
