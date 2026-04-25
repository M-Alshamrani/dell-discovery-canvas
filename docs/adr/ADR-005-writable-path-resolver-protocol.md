# ADR-005 · Writable-path resolver protocol (`context.*` via `WRITE_RESOLVERS`)

## Status

**Accepted** — shipped as Phase 19d in v2.4.4. Validated by Suite 30 OH1-OH17 + Suite 32 DS9-DS10 (every seed skill's `outputSchema` paths are `writable: true` AND have a resolver).

## Context

AI skills propose updates to session state. Two namespaces:

- **`session.*`** — paths rooted at the persisted session shape (e.g., `session.customer.name`, `session.gaps[0].urgency`).
- **`context.*`** — runtime-scoped tab selection (e.g., `context.selectedGap.description` — refers to "the gap currently shown in the right panel of Tab 4").

The `session.*` paths are write-able by direct path-set: split the dot-path, walk the session tree, assign the leaf. Mechanical.

`context.*` paths can't be path-set directly because `context` is a *transient projection* — `context.selectedGap` is constructed by the view at button-press time as a reference to a session entity. To write back, we need to find the target entity in the live session by id and mutate it there.

Two failure modes to guard against:

1. **Silent ghost writes** — if the user deletes the gap mid-skill-run, the resolver can't find the entity. Throwing is the right move; silently dropping is not.
2. **Privileged writes via overlooked paths** — a skill author shouldn't be able to point `context.selectedGap.id` at a write that overwrites the gap's id (which would corrupt cross-references). The writable surface must be an explicit allowlist.

## Decision

Two structures, both in `core/`:

**`FIELD_MANIFEST`** ([core/fieldManifest.js](../../core/fieldManifest.js)) — per-tab catalog of bindable fields:

```jsonc
{
  path:     "context.selectedGap.description",
  label:    "Selected gap description",
  kind:     "scalar" | "array",
  writable: true | false   // v2.4.4 — gating field for AI writes
}
```

The skill admin UI surfaces only `kind`-correct fields as binding chips. The skill `outputSchema` may only declare paths where `writable: true`.

**`WRITE_RESOLVERS`** ([core/bindingResolvers.js](../../core/bindingResolvers.js)) — map of `context.*` path → mutation function:

```js
"context.selectedGap.description": function(session, context, value) {
  var gap = session.gaps.find(g => g.id === context.selectedGap.id);
  if (!gap) throw new Error("Gap '" + context.selectedGap.id + "' not found in session");
  gap.description = value;
}
```

`applyProposal` ([interactions/aiCommands.js](../../interactions/aiCommands.js)) routes:

```
if path.startsWith("session.")  → setPathFromRoot (direct write)
else if WRITE_RESOLVERS[path]   → resolver(session, context, value)
else                             → throw
```

**Adding a new writable `context.*` field is two-line work**: one `FIELD_MANIFEST` entry with `writable: true`, one `WRITE_RESOLVERS` entry. Test coverage in Suite 30 + DS9 is automatic — DS9 fails the build if any seed-skill `outputSchema` path lacks a resolver.

## Alternatives considered + rejected

- **Allow free-form `context.*` writes via path-set** — fails the "find by id" requirement. Whatever code constructs `context.selectedGap` knows the entity; the writer wouldn't.
- **Embed mutation logic in the view** — would require every view to import `applyProposal` and customise it. Fragmentation.
- **Single generic resolver that walks `context` and back-references to session by `id` field** — works for the simple cases but doesn't generalise to derived contexts (e.g., `context.activeProject` which doesn't have a stored id).
- **Allow `outputSchema` to declare paths that aren't in `FIELD_MANIFEST`** — opens the door to silent typos getting accepted. Strictness here costs nothing and prevents real bugs.

## Consequences

### Good

- **The writable surface is enumerable + auditable** — any reviewer can read [bindingResolvers.js](../../core/bindingResolvers.js) and know exactly what AI can write to. 13 entries today; the count grows as new writable fields are exposed.
- **Test coverage is automatic** — DS9 is the regression gate. Adding a new resolver without a manifest entry (or vice versa) fails the build.
- **Errors are user-readable** — `"Gap 'g-005' not found in session"` is a clear message, not an opaque path-walk failure.
- **Side-effecting cascades stay out** — resolvers do narrow scalar writes only. Cascading logic (e.g., "changing gap.gapType triggers a re-derivation of projectId") belongs in `interactions/*Commands.js`, called from `applyProposal` only via the action-commands runtime ([SPEC §12.6](../../SPEC.md), v2.6.0).

### Bad / accepted trade-offs

- **13 hand-authored resolver functions** — each one is short (~5 lines) but the boilerplate adds up. A code-gen approach was considered and rejected as over-engineering for the scale.
- **No bulk operations via this protocol** — a skill that wants to "update 10 gaps' urgency at once" can't. v2.6.0 action-commands runtime fixes this with batched ops + a single undo entry.
- **Writes are scalar-only** — no nested object writes via resolvers. If you need to add a nested structure (e.g., `gap.metadata.lastReviewedBy`), add a resolver for the leaf path, not the parent object. Keeps invariants simple.

## When to revisit

1. **The resolver count exceeds ~30** — at that point, the lookup boilerplate dominates. Consider a higher-level "entity-by-id + path-set" composition.
2. **A field needs cascade behaviour on write** (e.g., updating `gap.layerId` should re-derive `gap.projectId`) — that belongs in `interactions/gapsCommands.updateGap`, not in a resolver. Document the rule clearly.
3. **AI-driven writes need permissions per user role** (v3) — the current `writable: true` gate becomes inadequate; it'll need `writable: ["manager", "director"]` semantics or similar.

See [SPEC §12.2](../../SPEC.md) for the binding-path contract.
