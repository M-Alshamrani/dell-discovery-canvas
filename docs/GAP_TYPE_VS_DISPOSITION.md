# Gap type vs Disposition

These two fields look similar but capture different concepts. Mixing them up is a common source of confusion when the chat or a colleague asks *"what kind of gap is this?"*

---

## The distinction in one table

| | Captures | Lives on | Example value |
|---|---|---|---|
| **gap.gapType** | the NATURE OF THE WORK the engagement is doing | `gap` entity | "replace" — *we need to swap something* |
| **instance.disposition** | the LIFECYCLE OUTCOME for one specific desired-state tile | desired-state `instance` entity | "replace" — *this specific tile IS the replacement* |

They share several values (replace, enhance, introduce, consolidate) which is why they're easy to conflate. But they live on different entities and answer different questions:

- **gap.gapType** answers: *"what kind of work is the engagement doing to close this gap?"*
- **instance.disposition** answers: *"what role does this specific desired-state tile play in the transition?"*

---

## The full matrix

| gap.gapType | Question gap.gapType answers | Typical instance.disposition (on linked desired-state tile) |
|---|---|---|
| **enhance** | *"we need to make X better"* | enhance (same instance, uplifted variant) |
| **replace** | *"we need to swap X for something else"* | replace (new tile, originId → retired current tile) |
| **introduce** | *"we need to add a brand new capability"* | introduce (greenfield desired tile, no originId) |
| **consolidate** | *"we need to combine N things into 1"* | consolidate (1 new tile, originId → one of the N current tiles) |
| **ops** | *"we need to change operations / process / SLA"* | — (no linked desired instance; gap is operational-only) |

---

## A worked example

> Gap: *"Replace Veeam with PowerProtect"*

This is a gap with:
- `gap.gapType = "replace"` (the work is a replacement)
- `gap.relatedCurrentInstanceIds = [<veeam-uuid>]` (what's being replaced)
- `gap.relatedDesiredInstanceIds = [<powerprotect-uuid>]` (what's replacing it)

The PowerProtect instance has:
- `instance.disposition = "replace"` (its lifecycle role is "the replacement")
- `instance.originId = <veeam-uuid>` (which current-state tile it replaces)

So `gap.gapType` is "replace" AND `instance.disposition` is "replace" — but for different reasons.
- The **gap** is doing replacement work.
- The **instance** IS the replacement.

---

## When the values differ

There are cases where `gap.gapType` and the linked `instance.disposition` are NOT the same value:

### Operational gaps have no linked instance

- `gap.gapType = "ops"` (e.g., *"Establish quarterly RTO testing for clinical-systems failover"*) — no desired-state tile is added; the gap is operational-only. `gap.relatedDesiredInstanceIds` is empty.

### Consolidation has asymmetric current-side linkage

- A 3→1 consolidation has 3 current-side tiles in `gap.relatedCurrentInstanceIds[]`, but only 1 linked desired-side tile. That ONE desired tile has `disposition = "consolidate"` and `originId = <one of the 3>`. The OTHER 2 current tiles are linked-but-retired (each effectively retired by the consolidation, but the originId chain only attaches to one).

### Mixed-disposition gaps (rare)

- A complex gap like *"Modernize backup infrastructure"* might have `gap.gapType = "replace"` but link to multiple desired tiles where some have disposition=replace (the new primary backup target) and others have disposition=introduce (a new immutable-vault tier that didn't exist before).

In all these cases, the gap.gapType + instance.disposition pair carries richer semantics than either alone.

---

## Why this matters

- **For the chat**: when a presales engineer asks *"what kind of work is this gap?"* the chat reaches for `gap.gapType`. When they ask *"what is this desired-state tile's role?"* the chat reaches for `instance.disposition`. Conflating the two leads to wrong answers.
- **For the executive summary**: the report enumerates each desired-state transition by `instance.disposition`; the gap section enumerates work-streams by `gap.gapType`. Both views matter; they're not redundant.
- **For Skill authoring**: a skill targeting "replace gaps" should bind to `gap.gapType` paths; a skill targeting "replacement tiles" should bind to `instance.disposition` paths. The two surface different result sets.

---

## Cross-references

- `docs/v3.0/SPEC.md` §S25 (gap schema + disposition semantics)
- `docs/RULES.md` §13 (Per-gapType Disposition Rules) + §14 (Asset Lifecycle by Action)
- `docs/CURRENT_VS_DESIRED_STATE.md` — disposition lifecycle full table + originId mechanics
- `docs/CANVAS_CHAT_USER_GUIDE.md` — how to ask the chat about gap_type vs disposition
