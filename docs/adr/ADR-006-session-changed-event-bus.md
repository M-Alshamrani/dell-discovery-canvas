# ADR-006 · `session-changed` event bus (single-subscriber re-render model)

## Status

**Accepted** — shipped as Phase 19e in v2.4.5. Codified by [SPEC §12.5a](../../SPEC.md) and [SPEC §12.8 invariant 6](../../SPEC.md). Tested by demoSpec DS16/DS17.

## Context

Through v2.4.4, the SPA had no formal mutation-notification pathway. Views read `session` directly; mutations happened in `interactions/*Commands.js`; views re-rendered when the user clicked a tab. Three classes of bugs surfaced under that model:

1. **Driver tile vanishing on AI apply** — Tab 1's driver list was re-read at render time, but the right-panel detail held a closed-over reference to the pre-mutation entity. After AI write, the detail panel rendered against a stale ghost.
2. **Tab 4 blanking after undo** — `undoLast` replaced the live `session` object's keys; views that had cached references to the previous session shape rendered nothing.
3. **No way for "selected" entities to recover** — when AI mutated a gap, any view holding `var selectedGap = ss.session.gaps[3]` had a reference that might no longer point at the same gap.

## Decision

Introduce `core/sessionEvents.js` — a tiny pub/sub:

```js
emitSessionChanged(reason, label?)  // reserved reasons:
                                    //   "ai-apply", "ai-undo",
                                    //   "session-reset", "session-demo",
                                    //   "session-replace"
onSessionChanged(fn) => unsubscribe  // fn receives { reason, label }
```

**Every session-root mutation MUST emit.** Codified as [SPEC §12.8 invariant 6](../../SPEC.md). The mutators currently emitting:

- `applyProposal` / `applyAllProposals` ([interactions/aiCommands.js](../../interactions/aiCommands.js)) → `"ai-apply"`
- `undoLast` / `undoAll` ([state/aiUndoStack.js](../../state/aiUndoStack.js)) → `"ai-undo"`
- `resetSession` ([state/sessionStore.js](../../state/sessionStore.js)) → `"session-reset"`
- `resetToDemo` ([state/sessionStore.js](../../state/sessionStore.js)) → `"session-demo"`
- `replaceSession` does NOT emit (the caller decides — undo emits; envelope-import emits with `"session-replace"`).

**Single-subscriber re-render model**: `app.js` is the **only** subscriber. On every event, it calls `renderHeaderMeta() + renderStage()` which re-invokes the active view from scratch.

Individual views do **not** subscribe. They get re-invoked by the shell. They must re-resolve any "selected" entity by id against the live session before rendering — the entity may have been mutated, replaced, or removed.

## Alternatives considered + rejected

- **Per-view subscribers** — each view subscribes to `session-changed` and re-renders selectively. Considered for performance. Rejected because: (a) the active view re-render is cheap (~5-15ms per measurement), (b) the discipline of "every view must re-resolve by id" survives this scaling consideration, (c) per-view subscriptions create a cleanup burden (unsubscribe on view-tear-down) that is easy to miss.
- **Reactive frameworks** (signals, observables) — would require either a framework adoption (violates [ADR-001](ADR-001-vanilla-js-no-build.md)) or hand-rolling a non-trivial dependency-tracking system.
- **Direct view re-render on mutation** (mutator calls into view code) — couples writers to readers; ugly inversion.
- **Polling** — wasteful; misses cause UX bugs.

## Consequences

### Good

- **Bus is one file, ~50 LOC** — trivial to read, trivial to test (DS16/DS17 cover it).
- **Single rendering subscriber simplifies reasoning** — `app.js` is the only place that decides "re-render now". Views are pure render functions.
- **The "re-resolve by id" rule is the safety net** — every `selectedGap.id`, `selectedInstance.id`, `selectedDriver.id` lookup happens fresh on render. Stale references can't survive a mutation.
- **AI undo + apply work cleanly** — both flows emit, both views re-render against the live session. The driver-tile-vanish and tab-blanking bugs from v2.4.4 are structurally impossible.

### Bad / accepted trade-offs

- **Every mutation triggers a full active-view re-render** — at the current scale (workshop session, ~20-50 instances), this is sub-frame. At 500+ instances it would start to bite. Performance ceiling documented in [scalability.md](../wiki/explanation/scalability.md).
- **The "must re-resolve by id" rule is convention, not enforcement** — a view that holds a closed-over reference would still drift. Mitigated by: (a) the rule is documented, (b) views are short, (c) tests would surface the regression at the manual-smoke step.
- **Unrelated subscribers get every event** — unsubscribe-by-id pattern is supported via `onSessionChanged` returning an unsubscribe function. App.js doesn't unsubscribe (it lives the lifetime of the page); other modules using the bus must unsubscribe explicitly.

## When to revisit

1. **Active-view re-render exceeds 16ms regularly** — performance budget for matrix-tab specifically. At that point, selective per-view subscription becomes worth the complexity.
2. **Multi-tab sync needed** (e.g., via `BroadcastChannel`) — would need to extend the event bus to cross-tab events. Not on the v3 roadmap explicitly but plausible.
3. **A new mutator path forgets to emit** — gets caught by DS16/DS17 if it's an AI path. Other paths rely on the convention; promote to runtime check if drift surfaces.

See [SPEC §12.5a](../../SPEC.md) for the contract; [SPEC §12.8 invariant 6](../../SPEC.md) for the regression gate.
