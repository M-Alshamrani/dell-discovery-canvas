## What this PR does

A 1-3 sentence summary. Reference the backlog item / spec entry.

## Backlog item

Link to the [`docs/CHANGELOG_PLAN.md`](../docs/CHANGELOG_PLAN.md) entry that locks the scope. If this PR is starting work that isn't yet locked, add the spec there first.

## Type

- [ ] Functional release (new SemVer tag at end — pick MAJOR/MINOR/PATCH/HOTFIX)
- [ ] Hygiene pass (`.dNN` clone — no behaviour change)
- [ ] Hotfix (urgent bug; no new features)
- [ ] Doc-only / tooling

## Two-surface treatment

If this PR adds, renames, or removes a data-model field:

- [ ] Updated `state/demoSession.js` so demo exercises the new field.
- [ ] Added or updated a seed skill in `core/seedSkills.js` that demonstrates the new capability (if writable).
- [ ] Added an assertion in `diagnostics/demoSpec.js` pinning the new shape.
- [ ] Appended an entry to `docs/DEMO_CHANGELOG.md`.

If none of the above applies (no data-model change), confirm:
- [ ] Confirmed: no data-model changes in this PR.

## Test evidence

- [ ] All 509+ tests green.
- [ ] Manual Chrome MCP browser smoke completed against the verification spec (per [`feedback_browser_smoke_required.md`](../.claude/projects/...)).
- [ ] Walked Tabs 1-5 in the demo session.
- [ ] Console errors: zero.

Paste banner screenshot or test-count output.

## Breaking-change flag

Does this PR change session-shape JSON, the `.canvas` envelope, or any user-visible contract?

- [ ] No.
- [ ] Yes — describe migration path:

If yes, the migrator must handle legacy sessions; flag for [`docs/operations/VERSION_COMPAT.md`](../docs/operations/VERSION_COMPAT.md) update.

## Invariants

Does this PR touch any [INVARIANTS.md](../INVARIANTS.md) entry?

- [ ] No.
- [ ] Yes — listed below:

If yes, confirm the regression gate still passes for each affected invariant.

## Risk

Does this PR introduce or eliminate any risk in [docs/operations/RISK_REGISTER.md](../docs/operations/RISK_REGISTER.md)?

- [ ] No.
- [ ] Yes — describe:

## Rollback plan

If this PR ships and turns out to be wrong, how do we roll back?

- [ ] Standard `git checkout <prior-tag>` is sufficient.
- [ ] Needs a special migration step (describe):

---

By submitting this PR, the contributor confirms:

- [ ] No new npm dependencies added (per [ADR-001](../docs/adr/ADR-001-vanilla-js-no-build.md)).
- [ ] No new build step introduced.
- [ ] All session mutations route through `interactions/*` (per the pure-write rule).
- [ ] Naming follows [`feedback_naming_standard.md`](../.claude/projects/...).
- [ ] CHANGELOG_PLAN updated inline with code (per [`feedback_docs_inline.md`](../.claude/projects/...)).
- [ ] Awaiting "tag it" approval from the project owner before tagging.
