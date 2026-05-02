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

## BUG-011 · Settings modal: cannot save Anthropic API key (UNCONFIRMED — needs user repro)

**Status**: OPEN · Reported 2026-05-02 PM · v3.0.0-rc.2 · Scheduled rc.2-polish
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
