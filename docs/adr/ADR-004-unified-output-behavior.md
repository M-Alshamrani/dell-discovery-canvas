# ADR-004 · Unified output-behavior model (`responseFormat` × `applyPolicy`)

## Status

**Accepted** — shipped as Phase 19d in v2.4.4. The legacy `outputMode` enum is retained as a migration alias; new skills use the unified model.

## Context

Through v2.4.0–v2.4.3, AI skills had two overlapping fields that conspired to dispatch behaviour:

- `outputMode` ∈ {`suggest`, `apply-on-confirm`, `auto-apply`} — what the UI does after the AI returns.
- `outputSchema: [{path, label, kind}]` — what fields the AI may write to. If empty array → text-only; if non-empty → JSON-scalars.

The dispatch was implicit: "non-empty `outputSchema` and `apply-on-confirm` mode → render the per-field proposals panel; otherwise render plain text". Adding new response shapes (e.g., `json-commands` for v2.6.0) would require lacing more conditions through the dispatch.

Three signals that we needed a cleaner model:

1. The skill author shouldn't be inferring "if I set `outputSchema` it becomes JSON-mode". That's an emergent rule, not a declared one.
2. Action-commands (v2.6.0 future) wouldn't fit `outputSchema` — they're a different shape (`{commands: [...]}` not a flat scalar map).
3. The UI's "what to do with the response" is **orthogonal** to "what the response is". Show-only of a JSON object is valid; auto-apply of a text response isn't.

## Decision

Split the two concerns into orthogonal fields on every skill:

```jsonc
{
  responseFormat:  "text-brief" | "json-scalars" | "json-commands",
  applyPolicy:     "show-only"  | "confirm-per-field" | "confirm-all" | "auto"
}
```

**`responseFormat`** controls what the AI MUST return. Drives the non-removable system-prompt footer in `core/promptGuards.js`:

- `text-brief` — plain text, ≤120 words, terse bullets, no preamble. Keeps responses workshop-pace.
- `json-scalars` — single JSON object with only keys declared in `outputSchema`. Used when the AI proposes per-field updates.
- `json-commands` — single JSON object `{commands: [...]}` where each command is an op from a whitelist. v2.6.0 only.

**`applyPolicy`** controls what the UI does:

- `show-only` — render the response, no writes. Valid for any `responseFormat`.
- `confirm-per-field` — show the proposals panel with per-row Apply/Skip. Default for `json-scalars`.
- `confirm-all` — single "Apply all" button, no per-field choice. For trusted skills with consistent schemas.
- `auto` — write immediately. Requires explicit opt-in at skill-creation time.

Both fields are stored on every saved skill ([SPEC §12.1](../../SPEC.md)). Migrations from legacy `outputMode` happen in `core/skillStore.js normalizeSkill`:

- `outputMode: "suggest"` → `applyPolicy: "show-only"`
- `outputMode: "apply-on-confirm"` → `applyPolicy: "confirm-per-field"`
- `outputMode: "auto-apply"` → `applyPolicy: "auto"`
- `responseFormat` defaults: `"json-scalars"` if `outputSchema.length > 0`, else `"text-brief"`.

The `applyProposal` and `applyAllProposals` flow ([interactions/aiCommands.js](../../interactions/aiCommands.js)) routes by `responseFormat` + `applyPolicy` together.

## Alternatives considered + rejected

- **Keep `outputMode`, document the implicit dispatch better** — would make the rule clearer but doesn't solve the v2.6.0 action-commands problem. Half-fix.
- **Single combined enum** (`text-show`, `text-auto`, `json-confirm`, ...) — combinatorially explodes when adding `json-commands` × all four apply policies = 12 enum values.
- **Per-skill custom dispatch lambdas** — generic, dangerous. Skills become code; localStorage round-trip of a function is bad design.

## Consequences

### Good

- **Adding a response format is one new value + one footer template** — no UI changes if the dispatch works generically.
- **Adding an apply policy is one UI branch** — same story.
- **Composability is explicit** — `text-brief` × `auto` is now a documentable invalid combination (auto-applying a text response makes no sense), surfaced at skill-create time as a validation error rather than runtime drift.
- **Migration story is clean** — old skills round-trip through `normalizeSkill` and get the orthogonal fields. Forward-compat fields preserved.

### Bad / accepted trade-offs

- **One more field to learn** — skill authors must understand both axes. Mitigated by sensible defaults in the admin form.
- **The `outputSchema` field still matters** — it defines the writable allowlist for `json-scalars`. Couldn't be folded into `responseFormat` cleanly.
- **`json-commands` is stubbed today** — the parser is declared, the footer is functional, but `applyProposal` for json-commands skills explicitly throws. Real runtime ships in v2.6.0 (Bucket A5).

## When to revisit

1. **A genuinely new orthogonal axis appears** — e.g., "tools" (the AI invokes side-effecting MCP tools mid-response). Would need a third axis or this model becomes nested.
2. **`applyPolicy: "auto"` causes a real safety incident** — would force re-evaluation of the auto-apply pathway. Not yet observed; the undo stack ([ADR-008](ADR-008-undo-stack-hybrid.md)) is the safety net.
3. **A response format appears that doesn't fit "single message back"** — e.g., streaming with intermediate state. Would need a different lifecycle than the current `runSkill → parseProposals → applyProposal`.

See [SPEC §12.1](../../SPEC.md) for the storage contract and [SPEC §12.4](../../SPEC.md) for the proposals model.
