# Phase 17 · Taxonomy unification · migration plan

**Status**: SHIPPED as v2.4.8 on 2026-04-24. This document is preserved as the as-shipped audit trail; the live rules are in [core/taxonomy.js](../core/taxonomy.js) and [docs/RULES.md §2 + §10](RULES.md). Annotation added by the `v2.4.11.d01` hygiene pass.
**Predecessor**: v2.4.7 (Fresh-start UX) merged before this slice.
**Successor**: v2.4.9 primary-layer rework + explicit `gap.projectId` (also touched `validateGap`).

## 1 · What changes

| Before | After | Applies to |
|---|---|---|
| UI label "Disposition" | UI label "Action" | every view that references it: `MatrixView.js`, `GapsEditView.js`, `DesiredStateSync`, help text, CSS class names if they leak user-visible strings |
| 6 disposition values: `replace` · `enhance` · `consolidate` · `rationalize` · `introduce` · `ops` | 7 Action values: `keep` · `enhance` · `replace` · `consolidate` · `retire` · `introduce` · `operational` | `DISPOSITION_ACTIONS` in `interactions/desiredStateSync.js` + `VALID_GAP_TYPES` in `core/models.js` |
| `gapType: "rationalize"` allowed | `gapType: "rationalize"` **removed** — migrator coerces to `retire` (closest semantic) with a warning logged | `validateGap` + migrator |
| No mandatory-link rule enforcement | Link rules per table: `replace` requires 1 current + 1 desired; `consolidate` requires 2+ current + 1 desired; `keep`/`retire` require 1 current, no desired; `introduce` requires 0 current + 1 desired; `enhance`/`operational` optional | `gapsCommands.createGap` + `updateGap` |
| JSON field name `disposition` | JSON field name STAYS `disposition` (migration cost > benefit; UI label change is enough) | no change |
| `ACTION_TO_GAP_TYPE` map with 6 entries | 7 entries matching the approved table | `interactions/desiredStateSync.js` |

## 2 · The approved table (for the code's eyes)

```js
// core/taxonomy.js (NEW — single source of truth for Phase 17)
export const ACTIONS = [
  { id: "keep",        label: "Keep",        requiresCurrent: 1,      requiresDesired: 0,      gapType: "ops"         },
  { id: "enhance",     label: "Enhance",     requiresCurrent: 1,      requiresDesired: "optional", gapType: "enhance"     },
  { id: "replace",     label: "Replace",     requiresCurrent: 1,      requiresDesired: 1,      gapType: "replace"     },
  { id: "consolidate", label: "Consolidate", requiresCurrent: 2,      requiresDesired: 1,      gapType: "consolidate" },
  { id: "retire",      label: "Retire",      requiresCurrent: 1,      requiresDesired: 0,      gapType: "ops"         },
  { id: "introduce",   label: "Introduce",   requiresCurrent: 0,      requiresDesired: 1,      gapType: "introduce"   },
  { id: "operational", label: "Operational", requiresCurrent: "optional", requiresDesired: "optional", gapType: "ops" }
];
```

Interpretation of `requires*`:
- Number `n` → exactly `n` links required.
- `"optional"` → 0 or more permitted.
- Number `n` with plural semantics (2 for `consolidate`) → **at least** `n`.

## 3 · Files touched (expected)

### Core
- NEW `core/taxonomy.js` — `ACTIONS` array + helpers (`actionById`, `actionsIncludeId`).
- MOD `core/models.js` — `VALID_GAP_TYPES` drops `rationalize`; imports gap-type whitelist from taxonomy.
- MOD `core/config.js` — no change (layers/envs untouched).

### Interactions
- MOD `interactions/desiredStateSync.js` — replace local `DISPOSITION_ACTIONS` constant with re-export from `core/taxonomy.js`; rebuild `ACTION_TO_GAP_TYPE` from the taxonomy.
- MOD `interactions/gapsCommands.js` — `createGap` / `updateGap` validate link counts against the Action's rule table; throw with a user-readable message on violation.

### State
- MOD `state/sessionStore.js` — `migrateLegacySession` coerces any gap with `gapType === "rationalize"` to `gapType: "ops"` and logs a `console.warn` with the gap id. Also normalises any instance with `disposition: "rationalize"` to `disposition: "retire"`.

### UI
- MOD `ui/views/MatrixView.js` — all instances of "Disposition" label → "Action". `DISPOSITION_ACTIONS` import continues to work (re-export from `desiredStateSync`).
- MOD `ui/views/GapsEditView.js` — "Disposition" → "Action" in labels + help text; gap-type filter chips updated.
- MOD `ui/views/HelpModal.js` — any help strings mentioning "Disposition" or "rationalize".
- Grep audit required before tagging (see §6).

### Tests
- MOD `diagnostics/appSpec.js` Suite 04 (`validateGap`) — add assertions: `gapType: "rationalize"` throws; every value in `VALID_GAP_TYPES` matches the taxonomy.
- MOD `diagnostics/appSpec.js` Suite 07 (`gapsCommands`) — add assertions for each Action's link rule (replace needs both sides; consolidate needs ≥2 current; introduce needs 0 current; etc.).
- NEW Suite 38 `taxonomy` — TX1-TX10 covering: ACTIONS array shape; every action has a valid gapType; actionById resolves; migrator coerces `rationalize` gaps; migrator coerces `rationalize` instances; mandatory-link enforcement throws on createGap violations; round-trip through save/load preserves new values.

### Demo + seed + demoSpec + DEMO_CHANGELOG (two-surface rule)
- MOD `state/demoSession.js` — verify no demo gap uses `rationalize` (currently none, per DS2); add at least one gap of each remaining Action so demoSpec can exercise the rule table.
- MOD `core/seedSkills.js` — the gap-rewriter seed's outputSchema already writes `gapType`; add a `gapType` enum hint to the prompt so the AI proposes only valid values.
- MOD `diagnostics/demoSpec.js` — new suite DS18-DS22: demo exercises every Action; every demo gap's link count honours its Action's requiresCurrent / requiresDesired; AI-proposed `gapType` is always a taxonomy value.
- MOD `docs/DEMO_CHANGELOG.md` — new v2.4.8 entry listing the coercions + rule adds.

### Docs
- MOD `SPEC.md §2.5` (session migration) — note the rationalize coercion.
- MOD `SPEC.md §6` (gap model) — reference `core/taxonomy.js`.
- MOD `docs/CHANGELOG_PLAN.md` — flip v2.4.8 status from QUEUED → IMPLEMENTED.

## 4 · Migration strategy

**Single pass, single commit** (or two: first `core/taxonomy.js` + migrator; second UI + tests). Minimise the time window where the system is half-migrated in the local dev loop.

### Order of operations inside v2.4.8

1. Create `core/taxonomy.js` with the approved table + helpers. Export everything.
2. Update `core/models.js VALID_GAP_TYPES` to pull from taxonomy; drop `"rationalize"`.
3. Update `state/sessionStore.js migrateLegacySession` to coerce `rationalize` → `ops` (gap) / `retire` (instance). Idempotent on already-migrated sessions. Logs `console.warn` per coercion so user sees the migration happen at least once.
4. Update `interactions/gapsCommands.js createGap` + `updateGap` — add a `validateActionLinks(gap, taxonomy)` step that throws on rule violation. Wrap with a clear UI-friendly message.
5. Update `interactions/desiredStateSync.js` — re-export from taxonomy, rebuild `ACTION_TO_GAP_TYPE`.
6. Grep-audit the UI — every user-visible "Disposition" → "Action". Quiet code (variable names, `data-*` attributes) stays as `disposition` for back-compat.
7. Refresh demo session — add examples of `keep` and `retire` (new values).
8. Refresh seed skills — tighten the gap-rewriter's prompt to list valid gapTypes.
9. Write Suite 38 + DS18-DS22.
10. Rebuild + verify green banner.
11. Commit with message labelling the taxonomy shift + the rationalize coercion.

### Migration idempotency

`migrateLegacySession` runs on every load. The coercion step must be idempotent — running twice produces the same result as running once:

```js
// Coerce gap.gapType "rationalize" → "ops" (once).
s.gaps.forEach(g => {
  if (g.gapType === "rationalize") {
    console.warn("[migrate] coercing gap.gapType rationalize → ops on gap " + g.id);
    g.gapType = "ops";
  }
});
// Coerce instance.disposition "rationalize" → "retire" (once).
s.instances.forEach(i => {
  if (i.disposition === "rationalize") {
    console.warn("[migrate] coercing instance.disposition rationalize → retire on " + i.id);
    i.disposition = "retire";
  }
});
```

After one load + save cycle, no `rationalize` values remain → subsequent migrations are no-ops.

## 5 · Known risks

| Risk | Mitigation |
|---|---|
| Existing user sessions saved before migrator runs → AI tries to write `gapType: "rationalize"` via a skill proposal | `applyProposal` routes through `validateGap` (via `updateGap`); the rejection surfaces as an error in the proposals panel. User sees a clear "rationalize is no longer a valid gap type" message. |
| Mandatory-link enforcement breaks existing auto-drafted gaps | Auto-drafted gaps come from `desiredStateSync.buildGapFromDisposition` — update it in the same commit to produce link-rule-compliant gaps. `Suite 18` regression tests cover this. |
| UI code still references `"rationalize"` somewhere → silent UI label "rationalize" appears | Grep-audit checklist (§6) — every hit must be updated or acknowledged (e.g., legacy migration log messages). |
| User creates a `replace` gap via the add-gap dialog without linking current+desired → rule throws mid-workflow | Add-gap dialog pre-validates on every link change; the Save button is disabled with the rule hint inline ("Replace requires 1 current + 1 desired link") until satisfied. |

## 6 · Grep audit checklist (run before tagging v2.4.8)

```bash
# Every hit below must either be updated or explicitly acknowledged.
grep -rn "Disposition\|disposition" --include="*.js" --include="*.css" --include="*.md" .
grep -rn "rationalize\|rationalization" --include="*.js" --include="*.css" --include="*.md" .
grep -rn "DISPOSITION_ACTIONS\|ACTION_TO_GAP_TYPE" --include="*.js" .
```

Expected post-audit state:
- Every `Disposition` user-visible string → `Action`.
- `rationalize` only appears in: migration log messages, CHANGELOG history entries, this doc. Nowhere in live code paths.
- `DISPOSITION_ACTIONS` is either renamed to `ACTIONS` or re-exported from `core/taxonomy.js` with a deprecation note for the next cleanup pass.

## 7 · Test plan

Running Suite 04 + 07 + 38 + DS18-DS22 after the migration. Expected counts:

- Suite 04 validateGap · +3 assertions (rationalize rejected; taxonomy gapTypes match; link rules present).
- Suite 07 gapsCommands · +7 assertions (one per Action × createGap path).
- Suite 38 taxonomy · 10 new (TX1-TX10).
- Suite 31-35 demoSpec · +5 (DS18-DS22).

Total new: ~25. Existing 447 stay green.

## 8 · Commit message shape

```
Phase 17 · v2.4.8 · Taxonomy unification (Action rename + 7-term link rules + rationalize coercion)

User signed off the Action table 2026-04-24. Rename "Disposition"
→ "Action" across the UI (JSON field stays `disposition` for
back-compat). Drop `rationalize` gap type — migrator coerces
existing values: gap.gapType rationalize → ops; instance.disposition
rationalize → retire. Mandatory-link rules enforced at create /
update time per the approved table.

<per-bucket file list>
```
