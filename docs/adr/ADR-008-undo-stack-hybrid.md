# ADR-008 · Undo stack — in-memory + localStorage hybrid

## Status

**Accepted** — shipped as Phase 19e in v2.4.5 (was in-memory-only in v2.4.4). Codified by [SPEC §12.5](../../SPEC.md). Tested by Suite 33 DS13-DS14 + Suite 35 DS16-DS17.

## Context

AI-applied mutations need to be reversible. Three forces:

1. **Workshop velocity** — undo must be one-click and instant. No round-trip to a server.
2. **Survives page reload** — workshops are long-running; users tab away and back; refreshes happen. v2.4.4's in-memory-only stack lost the undo trail on every reload, killing trust in the apply-on-confirm flow.
3. **Bounded memory** — full session snapshots can be ~50-100 KB. Storing 100 of them would blow the 5-10 MB localStorage ceiling. Need a cap.

The pure in-memory stack (v2.4.4) had two practical failures:
- **Lost on reload** — users who applied AI changes, refreshed for any reason, and wanted to undo were stuck.
- **No "what will this undo" surface** — the chip just said "↶ Undo last AI change". The user had to remember.

## Decision

A persistent, bounded, labelled stack: [`state/aiUndoStack.js`](../../state/aiUndoStack.js).

### Storage contract

- **localStorage key**: `ai_undo_v1`.
- **Shape**: `[{ label: string, snapshot: SessionShape, timestamp: number }]`.
- **Cap**: `MAX_DEPTH = 10`. Oldest dropped on overflow (FIFO drop, LIFO undo).
- **Cleared on**: `resetSession` / `resetToDemo` (intentional "start over" invalidates undo history).
- **Cloning**: `JSON.parse(JSON.stringify(session))` — relies on the JSON-serialisability invariant ([SPEC §1 invariant 4](../../SPEC.md)).

### Operations

```js
push(label, snapshot?)      // snapshot defaults to current session clone
undoLast()                  // pops + restores + emits "ai-undo"
undoAll()                   // restores oldest snapshot + clears + emits "ai-undo"
canUndo() / peekLabel() / depth()
recentLabels(maxCount?)     // newest-first, for the header tooltip
clear()                     // drops every entry — sessionStore calls on reset
onUndoChange(fn)            // UI subscription — header chip re-renders on every push/undo
```

### Apply contract

Every apply path pushes ONE undo entry **before** mutation:

- `applyProposal(proposal, ctx)` — one snapshot per call, label = "AI: {field-label}".
- `applyAllProposals(proposals, ctx)` — one snapshot for the entire batch, label = "AI: apply {N} proposals".
- v2.6.0 action-commands batch will follow the same one-snapshot-per-batch rule.

If `aiUndoStack.push` throws (quota exceeded, etc.), apply **aborts**. Codified as [SPEC §12.8 invariant 4](../../SPEC.md).

### UI surface

- Header chip "↶ Undo last AI change" — depth badge, tooltip lists the top 5 labels (newest-first).
- Header chip "↶↶ Undo all" — only renders when `depth() > 1`. Confirms with the user; restores to the oldest snapshot.
- Both chips visible everywhere; they belong to the app shell, not any one tab.

## Alternatives considered + rejected

- **In-memory only (v2.4.4)** — survives the apply→undo round-trip but loses on reload. Failed user trust.
- **Persistent unbounded** — would eventually blow localStorage ceiling on long sessions. Unacceptable.
- **Persistent + per-entry compression** — over-engineering at our scale. Sessions compress poorly anyway (lots of structure, little repeated text).
- **Event-sourced (delta replay)** — would store ops instead of snapshots; cheaper memory but harder to verify "this snapshot is byte-identical to the pre-mutation state". The byte-identical property is what DS13/DS14 test; deltas would erode it.
- **Server-side undo** — v3 concern.

## Consequences

### Good

- **Survives reload + container restart** — users trust the undo button.
- **One-click undo + one-click undo-all** — workshop pace preserved.
- **Bounded memory** — 10 snapshots × ~50KB = 500KB max. Well under the localStorage ceiling.
- **Labelled** — tooltip shows what each undo step would reverse. The user makes informed choices.
- **Safety net for `applyPolicy: "auto"`** — even an auto-apply skill is reversible.
- **Cleanly cleared on reset** — `resetSession` / `resetToDemo` calls `clear()` so undo doesn't leak across "I'm starting over" boundaries.

### Bad / accepted trade-offs

- **A long workshop with >10 AI changes loses the oldest** — by design. If the user needs to roll all the way back, they should use Export JSON before the session goes deep, or use the new `.canvas` save/open file flow ([sessionFile.js](../../services/sessionFile.js), v2.4.10).
- **Snapshots are full sessions** — wasteful for tiny scalar writes. Acceptable at workshop scale; consider deltas only if the cap-pressure becomes real.
- **`applyAllProposals` batch is one undo entry** — undoing it reverses all writes at once. The user can't "undo just one of the four". By design — the batch is conceptually atomic. If finer-grained control is needed, run the proposals individually.

## When to revisit

1. **localStorage quota errors observed in real use** — would force per-entry pruning or compression.
2. **Workshop sessions regularly exceed 30 AI changes** — cap might bite. Bump to 20 first; consider deltas only if 20 isn't enough.
3. **Action-commands batches (v2.6.0) need finer undo granularity** — would need a "redo within batch" semantic. Not yet asked for.
4. **Multi-user (v3) lands** — undo becomes per-user-per-session; localStorage moves to server-side per-user-undo-log.

See [SPEC §12.5](../../SPEC.md) for the storage contract and [SPEC §12.8 invariants 4 + 6](../../SPEC.md) for the regression gates.
