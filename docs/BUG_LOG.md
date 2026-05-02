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
