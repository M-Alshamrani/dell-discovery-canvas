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

## BUG-003 · v2 demo session content invisible to Canvas Chat (FIXED 2026-05-02)

**Status**: FIXED · Reported 2026-05-02 · v3.0.0-rc.2 mid-development · Resolved same-session
**Reporter**: User during chunk D smoke
**Severity**: High (chat surface unusable against demo data)
**Regression**: No (new feature; bridge was scoped to customer-only in rc.1 by design)

### Repro

1. Click "Load demo" footer button (loads the v2 demo session: 19 instances, 7 gaps, 4 envs, 3 drivers).
2. Click topbar "Chat" button.
3. Ask "How many open gaps do we have?" or any question that should surface the demo data.

### Expected

Anthropic responds with grounded answers citing actual gap descriptions, environment names, and counts from the demo session.

### Actual

Anthropic responds "the canvas is empty — there are no environments or instances currently defined" because the v3 engagement store contained only customer info; drivers/envs/instances/gaps collections were empty.

### Root cause

`state/v3SessionBridge.js` rc.1 implementation translated only `customer` fields from v2 sessionState. The drivers / environments / instances / gaps collections were left at the empty defaults from `createEmptyEngagement()`. The Canvas Chat surface read engagement data correctly, but there was nothing to read.

A secondary observation was made during diagnosis: the existing v2→v3 file migrator (`migrate_v2_0_to_v3_0`) cannot be reused as a runtime translator. Two pre-existing bugs:
1. The migrator outputs the meta record under the key `engagementMeta`, but `EngagementSchema` expects `meta`. 169 schema-validation issues per the loadCanvas attempt.
2. v2 short-string ids (`coreDc`, `drDc`, `w-001`) fail v3 schema's UUID requirement.

These migrator bugs are real but **NOT** fixed in this commit per `project_v3_no_file_migration_burden.md`: v3 architecture is not bent for file-format migration.

### Fix shipped

`state/v3SessionBridge.js` widened to translate all v2 entity collections in-line:
- v2 `customer.drivers[]` → `engagement.drivers.{byId, allIds}` with `businessDriverId` carried from v2 driver.id (the catalog ref like `cyber_resilience`).
- v2 `environments[]` → `engagement.environments.{byId, allIds}` with `envCatalogId` carried from v2 env.id (`coreDc`, `drDc`, etc).
- v2 `instances[]` → `engagement.instances.{byId, allIds, byState}` with state-keyed secondary index built from each instance's `state` field.
- v2 `gaps[]` → `engagement.gaps.{byId, allIds}` with all v3-relevant fields (`affectedLayers`, `affectedEnvironments`, `relatedCurrentInstanceIds`, `relatedDesiredInstanceIds`, `services`, `driverId`, etc.) preserved.

**Loose-shape note**: the produced engagement is NOT EngagementSchema-strict. v2 short-string ids are preserved verbatim instead of converted to UUIDs. Loose is fine because the only consumers are read-only (chat + selectors + chatTools); none validate. When (a) per-view migrations land per SPEC §S19.4 AND/OR (b) BUG-004 ships a v3-native demo, this constraint relaxes.

### Verified

End-to-end smoke: cleared chat memory, asked "How many open gaps does Acme have? Which environments are most affected?" against Anthropic. Response correctly identified 7 open gaps, mapped to environments (Riyadh DC: 6, AWS me-south-1: 1, Jeddah DR: 1 secondary), cited exact gap descriptions (immutable-backup, Unity XT capacity, VMware licensing, etc.) and business-driver categories. Anti-hallucination grounding works against real data.

Banner: 1023/1023 GREEN.

---

## BUG-004 · v2 demo not v3-shape; bridge translation is lossy by design (SCHEDULED)

**Status**: OPEN · Reported 2026-05-02 · Scheduled rc.2 polish bucket
**Reporter**: User
**Severity**: Medium (demo loads + chat works, but the v3 engagement is loose-shape; future per-view migrations will need a strict v3 source)
**Regression**: No (architectural)

### Background

Per BUG-003 fix, the bridge produces a loose-shape v3 engagement from the v2 demo. This works for the chat surface but doesn't pass `EngagementSchema.safeParse` (v2 ids aren't UUIDs; some optional fields aren't present).

User direction 2026-05-02:

> "I loaded the demo data, but it might be already old or not relevant to the new architecture, we might need to purge all demo and recreate a simpler end-to-end demo that highlights the capabilities of the app. Maybe we need to schedule it properly at some point."

### Plan

Build a v3-native demo engagement as a top-level deliverable in the rc.2 polish bucket:

1. NEW `core/v3DemoEngagement.js` — hand-curated v3-shape engagement with proper UUIDs, schema-valid throughout, 5-10 instances + 3-5 gaps + 2-3 drivers. Smaller than the current 19-instance demo; sized to highlight v3 features (provenance, manifest paths, cross-cutting workload mappings, ops-typed gaps). Schema-validated at module load.
2. Repurpose the "Load demo" footer button to call `setActiveEngagement(loadV3Demo())` directly when v3 is the active path; v2 demo retired.
3. The v3-native demo includes at least one of each gap type (enhance / replace / introduce / consolidate / ops) so the chat can answer questions about lifecycle.
4. Drop the bridge's translation path for the demo case (it stays for non-demo v2 sessions during the migration window). When all 6 view migrations land + sessionState retires, the bridge itself can be removed.

### Acceptance

- v3 demo loads via "Load demo" button.
- The loaded engagement passes `EngagementSchema.safeParse` (strict).
- Canvas Chat answers questions accurately against the v3-native demo.
- v2 demo session stops being created on demo-load (`createDemoSession` calls flow to v3 path or are stubbed if a v2 session is no longer needed).
- 1023+ tests stay GREEN; new tests cover the v3 demo schema validity.

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
