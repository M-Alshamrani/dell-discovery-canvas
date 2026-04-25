# ADR-007 · Skill seed library + `demoSession` module separation (two-surface rule)

## Status

**Accepted** — shipped as Phase 19e in v2.4.5. Codified by [feedback_foundational_testing.md](../../../../.claude/projects/C--Users-Mahmo-OneDrive-Documents-Claud-AI-PreSales-App/memory/feedback_foundational_testing.md) and [SPEC §12.8 invariant 8](../../SPEC.md). Tested by `diagnostics/demoSpec.js` (Suites 31-35, DS1-DS22).

## Context

v2.4.4 shipped with 416 green assertions but multiple UX bugs that 416 tests didn't catch:

- Tab blanking after undo (no event bus then; covered by [ADR-006](ADR-006-session-changed-event-bus.md)).
- Driver tile vanishing on AI apply (same root).
- Demo session not exercising the new `gap.driverId` field (Phase 14) or the new workload layer (Phase 16).
- Seed skill writing to a path that no longer existed in `FIELD_MANIFEST`.

The unit-test surface (`diagnostics/appSpec.js`) covered data contracts, validators, and DOM presence. It did NOT cover the **interaction-completeness** loop: "the AI returned JSON, the apply path mutated session, the event bus fired, the view re-rendered, the matrix tile colour updated".

The realisation: **two orthogonal testing surfaces are needed**. Machine tests (cheap, pinned to data shapes) AND human-test surfaces (the user manually exercises every release).

## Decision

**Three new modules, three new test gates, one process rule.**

### Module structure

- **`state/demoSession.js`** — demo-mode session data lifted out of `state/sessionStore.js`. Three personas registered in `DEMO_PERSONAS`: `acme-fsi`, `meridian-hls`, `northwind-pub`. The default persona exercises every shipped feature (workload layer, multi-link, driverId on every gap, all 7 Action types, both vendor groups).
- **`core/seedSkills.js`** — pre-built AI skill library lifted out of `core/skillStore.js`. 6 skills covering all 5 tabs, both `text-brief` and `json-scalars` response formats, every writable `context.*` resolver path.
- **`diagnostics/demoSpec.js`** — Suites 31-35 + 35b/35c, asserting that the demo session and seed skills stay in sync with the current data model.

### Test gates

The procedurally-tightest assertions are:

- **DS1-DS5** · demo session validates against `validateInstance` + `validateGap`; exercises Phase 16 workload + Phase 18 multi-link patterns.
- **DS9-DS10** · every seed skill's `outputSchema` path exists in `FIELD_MANIFEST[tab]` AND is `writable: true`. Every writable `context.*` path has a `WRITE_RESOLVERS` entry.
- **DS13-DS14** · `applyProposal` then `undoLast` produces JSON-byte-identical state.
- **DS16-DS17** · `applyProposal` emits `"ai-apply"`; `undoLast` emits `"ai-undo"`.
- **DS18-DS22** · post-Phase-17 + v2.4.11 invariants: every demo gap is taxonomy-valid; ≥1 introduce-gap; ≥1 ops-gap with link or substantive notes; ≥1 gap with `urgencyOverride: true`.

### Process rule (the two-surface rule)

Every data-model change (add / rename / remove a field on instance / gap / driver / sessionMeta) **MUST** ship in the same commit:

1. Update `state/demoSession.js` to exercise the new/renamed field.
2. Update or add a seed skill in `core/seedSkills.js` that demonstrates the new capability.
3. Add or update an assertion in `diagnostics/demoSpec.js` pinning the new shape.
4. Append an entry to [`docs/DEMO_CHANGELOG.md`](../DEMO_CHANGELOG.md) with version, date, and surfaces touched.

Reviewers reject PRs that miss any of the four surfaces. The rule is enforced via [feedback_foundational_testing.md](../../../../.claude/projects/C--Users-Mahmo-OneDrive-Documents-Claud-AI-PreSales-App/memory/feedback_foundational_testing.md) — auto-loaded into every conversation in this project.

## Alternatives considered + rejected

- **Inline demo data in `sessionStore.js`** (the v2.4.4 state) — couples the demo's evolution to session-store changes; no audit trail; drift inevitable.
- **One persona only** — the three personas test orthogonal concerns: HLS persona exercises HIPAA / clinical AI workflows; Public Sector exercises sovereignty + cloud-excluded paths.
- **Manual smoke checklist instead of demoSpec** — proven insufficient by v2.4.4; humans skip the boring parts.
- **Property-based testing** (e.g., generate sessions with random shapes) — overkill for a workshop tool with a small canonical scenario set.

## Consequences

### Good

- **Demo + seed surface IS the human-test surface** — clicking "Load demo" + running every seed skill is a 5-minute manual smoke that exercises the whole pipeline.
- **Drift is structurally caught** — DS9/DS10 fail when a path is removed from `FIELD_MANIFEST` but a seed skill still writes to it. Real bug-prevention.
- **DEMO_CHANGELOG is the audit trail** — every demo refresh is logged with version + rationale. Future contributors don't have to reverse-engineer "why does the demo include this random gap".
- **Three personas catch single-persona blind spots** — testing only Acme FSI hides Public Sector's `publicCloud`-excluded edge cases.

### Bad / accepted trade-offs

- **Every data-model change is a four-file commit** — feels heavy for a one-line field add. The rule is designed to be slightly-onerous so the discipline holds.
- **The default persona (`acme-fsi`) is opinionated** — financial-services workshop scenario. Not every Dell customer fits the FSI mould. Mitigated by the two alternative personas (`meridian-hls`, `northwind-pub`); UI for switching personas is a v2.5+ nice-to-have.
- **Seed skills write to paths the user might not want** — e.g., `skill-current-tile-tuner-seed` writes to `criticality` and `notes`. Mitigated by `applyPolicy: "confirm-per-field"` (the user reviews each proposed write before commit).

## When to revisit

1. **The demo session size starts to slow down test runs** — at workshop-scale (~20 instances, ~7 gaps) it's instant. At 500+ entities it would matter.
2. **A persona's domain becomes obsolete** (e.g., HLS regulations shift) — refresh the persona's gap descriptions + driver outcomes; record in DEMO_CHANGELOG.
3. **Seed skills point at writable fields that v3 server-side moves to read-only** — would force a wholesale re-author of the seed library. Predictable; documented in [VERSION_COMPAT.md](../operations/VERSION_COMPAT.md).

See [docs/DEMO_CHANGELOG.md](../DEMO_CHANGELOG.md) for the audit trail and [SPEC §12.8 invariant 8](../../SPEC.md) for the regression gate.
