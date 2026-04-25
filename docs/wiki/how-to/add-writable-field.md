# How to · Add a new writable AI field

**Audience**: contributor extending what the AI may write to.
**Outcome**: a new `context.<entity>.<field>` (or `session.<path>`) becomes a valid `outputSchema` target for skills.

---

## Two-line work

### 1. `core/fieldManifest.js`

Add an entry to the appropriate tab's array. **Set `writable: true`** if you want it eligible for `outputSchema`:

```js
gaps: SESSION_FIELDS.concat([
  // ...existing entries...
  { path: "context.selectedGap.someNewField",
    label: "Selected gap · some new field",
    kind:  "scalar",
    writable: true }
])
```

The skill admin's "outputSchema" chip palette automatically picks this up via `writableFieldsForTab(tabId)`.

### 2. `core/bindingResolvers.js`

If the path is `context.*` (most common — context is a runtime projection that needs an id-lookup to mutate), add a resolver:

```js
"context.selectedGap.someNewField": function(session, context, value) {
  var id  = context && context.selectedGap && context.selectedGap.id;
  var gap = findGapById(session, id);
  if (!gap) throw new Error("Gap '" + id + "' not found in session");
  gap.someNewField = value;
}
```

If the path is `session.*` (rare; usually for top-level customer fields), no resolver is needed — `applyProposal` does direct path-set.

## What you DON'T need to do

- Touch `interactions/aiCommands.js` — `applyProposal` is generic.
- Touch `services/skillEngine.js` — template rendering is generic.
- Touch `ui/views/SkillAdmin.js` — the chip palette reads the manifest dynamically.
- Add a UI control — the chip in the skill builder is auto-generated from the manifest entry.

## Tests that fire

The two-surface invariants ([ADR-007](../../adr/ADR-007-skill-seed-demosession-separation.md), enforced by demoSpec):

- **DS9** · every seed skill's `outputSchema` path exists in `FIELD_MANIFEST[tab]` AND is `writable: true`.
- **DS10** · every writable `context.*` path has a `WRITE_RESOLVERS` entry.

If you add a manifest entry without a resolver (or vice versa), DS9 or DS10 fails. Build is red. Fix immediately.

## Add a seed skill that exercises the new field (recommended)

If the new writable field is a meaningful new capability, the two-surface rule says you should also extend `core/seedSkills.js` with a skill that demonstrates it:

```js
{
  id:             "skill-some-new-field-tuner-seed",
  name:           "Tune some-new-field",
  description:    "AI rewrites the gap's some-new-field based on context.",
  tabId:          "gaps",
  systemPrompt:   "...",
  promptTemplate: "Customer: {{session.customer.name}}\nGap: {{context.selectedGap.description}}\n\nPropose a new value for some-new-field that...",
  responseFormat: "json-scalars",
  applyPolicy:    "confirm-per-field",
  outputSchema:   [{ path: "context.selectedGap.someNewField", label: "...", kind: "scalar" }],
  deployed:       true,
  seed:           true
}
```

And update `docs/DEMO_CHANGELOG.md` with the version + the surfaces touched.

## Done · checklist

- [ ] `FIELD_MANIFEST[tab]` has the entry with `writable: true`.
- [ ] `WRITE_RESOLVERS` has a matching resolver (for `context.*` paths).
- [ ] `validateGap` / `validateInstance` accept the new field shape if it's a new persisted field on the entity.
- [ ] `migrateLegacySession` defaults the field if absent (for legacy sessions).
- [ ] `state/demoSession.js` exercises the new field (per two-surface rule).
- [ ] A seed skill writes to it (per two-surface rule).
- [ ] `diagnostics/demoSpec.js` has an assertion pinning the new shape.
- [ ] `docs/DEMO_CHANGELOG.md` entry added.
- [ ] `SPEC.md §2` (Data Model) updated with the new field.

See [adr/ADR-005](../../adr/ADR-005-writable-path-resolver-protocol.md) for the contract this how-to instantiates and [SPEC §12.2](../../../SPEC.md) for the binding-path rules.
