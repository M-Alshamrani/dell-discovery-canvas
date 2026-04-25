# Contributing · Dell Discovery Canvas

This document codifies the project's development discipline. Every contributor — including future-you — is expected to follow these rules.

---

## Branch strategy

- **Feature branches** named after the phase: `phase-19l-services-scope`, `phase-20-something`. Branch from `main` HEAD.
- **Hygiene-pass branches** named `clean-pass-<source-tag>.dNN` (per [`docs/MAINTENANCE_LOG.md`](docs/MAINTENANCE_LOG.md) workflow): e.g., `clean-pass-v2.4.11.d02`.
- **Fast-forward merges only** to `main`. No merge commits. Rebase if necessary.
- **Tag at ship**, not at merge.

## Commit message convention

### Tagged commits (functional release)

```
Phase X · vY.Y.Y · <Title>

<body — sweep summary, test count, any noteworthy decisions>

Co-Authored-By: Claude ... <noreply@anthropic.com>   # if AI-pair-programmed
```

### Hygiene-pass commits

```
Maintenance · vY.Y.Y.dNN · documented clean clone (no behavior change)

<body — every finding, tweak, perf number, doc/diagram added>

Co-Authored-By: Claude ... <noreply@anthropic.com>
```

### Non-tag commits

```
<scope>: <imperative present-tense statement>

<optional body — why, not just what>
```

Examples: `gapsCommands: validate setPrimaryLayer accepts empty layerId`. `docs: refresh ADR-005 with v2.4.11+d01 audit findings`.

## Tag conventions

- **Functional releases**: SemVer-strict — `v2.4.10`, `v2.4.11`. Tag at ship, not at merge.
- **Hygiene-pass clones**: dot-separated build-metadata — `v2.4.11.d01`, `v2.4.11.d02`. SemVer-equivalent to source tag (no behaviour change). Convention details in [`MAINTENANCE_PROCEDURE.md` §1](../MAINTENANCE_PROCEDURE.md) (one level up from this repo).
- **Hotfix releases**: SemVer patch — `v2.4.10.1`.

## Versioning policy

When to bump:

| Bump | Trigger | Examples |
|---|---|---|
| MAJOR (`v2.x` → `v3.0`) | Session-shape breaking change | v3 multi-user platform |
| MINOR (`v2.4` → `v2.5`) | Significant new UX or phase milestone | v2.5.0 crown-jewel |
| PATCH (`v2.4.11` → `v2.4.12`) | Additive feature, no contract change | v2.4.12 services scope |
| HOTFIX (`v2.4.10` → `v2.4.10.1`) | Bug fix, urgent | v2.4.10.1 test-runner isolation |
| `.dNN` (`v2.4.11` → `v2.4.11.d01`) | Hygiene-pass, no behaviour change | v2.4.11.d01, .d02 |

## PR / review process

**Today** (single contributor): direct push to `main` allowed; branch protection disabled. Tag + push only after explicit "tag it" approval from the project owner.

**When the team grows**:
- All non-trivial changes via PR.
- 1 reviewer minimum.
- All checks green (509 tests + manual browser smoke).
- "Tag it" approval moves from the contributor to a reviewer.

## Code style

- **Vanilla JS, ES modules.** No framework. No build step. No npm. ([ADR-001](docs/adr/ADR-001-vanilla-js-no-build.md))
- **JSDoc on every exported helper.** Especially in `interactions/*` and `services/*`.
- **Files**: kebab-case for documents (`HOW_TO_RUN.md`, `data-model-er.md`); camelCase for JS modules (`gapsCommands.js`, `bindingResolvers.js`).
- **Existing patterns over new ones.** Don't impose ESLint, Prettier, or any tooling that isn't already there.
- **Two-space indentation** (consistent with existing files).
- **No semicolons stripped, no arrow-function-only rules** — write what's idiomatic in the surrounding file.

## The pure-write rule

**Only `interactions/*` modules mutate session state.** Services are pure reads. Views call commands and read services — never mutate directly. ([SPEC §1 invariant 6](SPEC.md))

The one known violation (`ContextView.js:130` — direct splice of `customer.drivers`) is queued for v2.5.x via [ADR-009](docs/adr/ADR-009-relationship-cascade-policy.md). Don't add new violations.

## The two-surface testing rule

**Every data-model change ships demo + seed + demoSpec + DEMO_CHANGELOG entry in the SAME commit.**

If you can't do all four, the change isn't done. ([feedback_foundational_testing.md memory](.claude/projects/...) + [ADR-007](docs/adr/ADR-007-skill-seed-demosession-separation.md) + [SPEC §12.8 invariant 8](SPEC.md))

Concretely: if you add a field to `Gap`, you MUST in the same commit:
1. Update [`state/demoSession.js`](state/demoSession.js) so at least one demo gap has the new field set to a meaningful value.
2. Add or update a seed skill in [`core/seedSkills.js`](core/seedSkills.js) that demonstrates the new capability if writable.
3. Add an assertion in [`diagnostics/demoSpec.js`](diagnostics/demoSpec.js) pinning the new shape.
4. Append an entry to [`docs/DEMO_CHANGELOG.md`](docs/DEMO_CHANGELOG.md) with version, date, surfaces touched.

PRs that miss any of the four are rejected.

## The browser-smoke-required rule

**Every functional tag MUST go through manual Chrome-MCP browser smoke against a verification spec BEFORE the commit + tag.**

Tests-pass-alone is necessary but not sufficient. ([feedback_browser_smoke_required.md memory](.claude/projects/...))

Three v2.4.11 bugs slipped past 488 green tests and only surfaced via manual smoke (urgency-lock silently failed; demo g-004 mis-typed Replace; Save button no feedback). The discipline is locked.

Sequence:
1. Spec committed BEFORE code (in `docs/CHANGELOG_PLAN.md`).
2. Code execution as one coherent pass.
3. Manual browser smoke via Chrome MCP — every "what you'll see" bullet checked in the live app, results reported with concrete evidence (DOM state / event payloads / banner screenshot).
4. **PAUSE** for explicit "tag it" approval from the project owner. No tag without it.
5. Tag, push, update memory + HANDOFF.

## What gets reverted

- Failing tests are fixed in the implementation, not by weakening the test ([SPEC §1 invariant 1](SPEC.md)).
- Pushing without "tag it" approval is reverted.
- A commit that adds a TODO/FIXME without an owning ticket is reverted (per `.dNN` §3.4 procedure).
- A commit that introduces an npm dependency is reverted (per [ADR-001](docs/adr/ADR-001-vanilla-js-no-build.md)).
- A commit that mutates session state outside `interactions/*` is reverted (per the pure-write rule).

## Naming standard

For committed code, docs, deployment artefacts, and credential examples ([feedback_naming_standard.md memory](.claude/projects/...)):

- **Use `AppName-vX.Y.Z[-purpose]`** for test/staging directories: `dell-discovery-canvas-2.4.11-staging`.
- **Container/image names**: keep `dell-discovery-canvas`.
- **Doc credential examples**: prefer `<your-username>` / `<strong-password>` placeholders. Concrete examples use the app name (`dell-discovery-canvas-admin`).
- **Branches**: `phase-NN-purpose` for features, `clean-pass-vX.Y.Z.dNN` for hygiene.
- **No role labels** (`manager-test`, `reviewer`, `dell-reviewer`, `staff-build`).
- **No casual placeholders** (`test-secret-2026`, `temp-pw`).

## Inline-docs discipline

Every implementation phase MUST update planning docs **in the same turn that introduces the code**, not later as backfill. ([feedback_docs_inline.md memory](.claude/projects/...))

At the end of any phase that introduces new services, UI patterns, data-model fields, tests, or acceptance criteria:
1. Add a `CHANGELOG_PLAN.md` entry with motivation + locked decisions + test numbers.
2. Update `SPEC.md` (§8 test inventory, §9 implementation sequence, §11 acceptance if relevant).
3. Update `RULES.md` if a new rule was added or an existing rule changed.
4. Update affected ADRs.

## Hygiene-pass (`.dNN`) cadence

Run a hygiene pass periodically — typically after every 2-3 functional releases, or when drift becomes visible. The procedure is in [`MAINTENANCE_PROCEDURE.md`](../MAINTENANCE_PROCEDURE.md) (one level up). Every pass:

1. Branches `clean-pass-<latest-functional>.dNN`.
2. Runs through procedure §1-§8 (audit, code-quality, perf, security, docs, agreement-trail, build-verify, tag).
3. Adds an entry to [`docs/MAINTENANCE_LOG.md`](docs/MAINTENANCE_LOG.md).
4. Tags `<latest-functional>.dNN`.
5. No behaviour change. SemVer-equivalent to source.

## Memory & auto-loaded context

The project has an auto-memory tree at `.claude/projects/...` that loads into every Claude Code session. It includes:

- The user role + project state.
- Foundational discipline rules (`feedback_*.md`).
- Domain references (`reference_*.md`).

Updates to memory happen at the end of any session that surfaces a new lesson or changes the project's established discipline. Memory is the **enforcement mechanism** for discipline — the rules above are codified in memory files so they survive Claude session boundaries.

---

## Where to look first

| Topic | Go here |
|---|---|
| North star + invariants | [SPEC.md §0-§1](SPEC.md) |
| Data model | [SPEC.md §2](SPEC.md) + [docs/wiki/explanation/diagrams/data-model-er.md](docs/wiki/explanation/diagrams/data-model-er.md) |
| AI platform | [SPEC.md §12](SPEC.md) + [ADRs 003-008](docs/adr/) |
| Rules-as-built | [docs/RULES.md](docs/RULES.md) |
| Why a decision was made | [docs/adr/](docs/adr/) |
| How to do X | [docs/wiki/how-to/](docs/wiki/how-to/) |
| What is a Y term | [docs/wiki/reference/GLOSSARY.md](docs/wiki/reference/GLOSSARY.md) |
| What's the always-true list | [INVARIANTS.md](INVARIANTS.md) |
| Operational recipes (deploy / rollback / recover) | [docs/operations/RUNBOOK.md](docs/operations/RUNBOOK.md) |
| Risks + mitigations | [docs/operations/RISK_REGISTER.md](docs/operations/RISK_REGISTER.md) |
