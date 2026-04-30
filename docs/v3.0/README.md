# v3.0 doctrine folder · entry point

**Branch**: `v3.0-data-architecture` · **Base**: v2.4.16 ship (origin/main `5614f32`)
**APP_VERSION**: `3.0.0-alpha` (in-progress; tag bumps to `3.0.0` only on real ship)

---

## What lives here

This folder is the **v3.0 contract**. Every code change on the `v3.0-data-architecture` branch derives from one of these files. Read order:

| # | File | What it is | Status |
|---|---|---|---|
| 1 | [`../../data-architecture-directive.md`](../../data-architecture-directive.md) | The lead-architect directive (706 lines, 18 sections, P1-P10 principles, R-numbered requirements). Single source of truth. | LOCKED 2026-04-30 |
| 2 | [`../../HANDOVER_v2.4.17_to_v3.0.md`](../../HANDOVER_v2.4.17_to_v3.0.md) | Bridge artifact from the v2.4.17 work-in-progress (preserved on local main + tag `v2.4.17-wip-snapshot`). Reuse map + 4 rollback scenarios. | FROZEN 2026-04-30 |
| 3 | [`../../second_opinion_consultation.md`](../../second_opinion_consultation.md) | Neutral prompt that produced the directive. Audit trail. | FROZEN 2026-04-30 |
| 4 | [`OPEN_QUESTIONS_RESOLVED.md`](OPEN_QUESTIONS_RESOLVED.md) | Resolutions for the 7 open questions in directive §17. Each resolution flagged ✅ (locked) or 🟡 (default-with-review). | DRAFT — pending user review |
| 5 | `SPEC.md` | The implementation specification (per directive §0.1). Section-by-section concrete contract. | TO AUTHOR |
| 6 | `MIGRATION.md` | The v2.0 → v3.0 migration specification (per directive §0.1). | TO AUTHOR |
| 7 | `TESTS.md` | Test vector contract (per directive §0.2). Every R-number → ≥1 vector. | TO AUTHOR |
| 8 | `test-logs/` | Browser-smoke evidence per `feedback_browser_smoke_required.md`. | TO POPULATE AT TAG TIME |

---

## Directive build pipeline (mandatory order)

Per `data-architecture-directive.md` §0:

1. **Spec** · this folder authors `SPEC.md` + `MIGRATION.md` from the directive.
2. **Test vectors** · `TESTS.md` derives vectors from directive §2-§14. Every R-number gets ≥1 vector.
3. **Test implementation** · vectors become executable tests in `diagnostics/appSpec.js` Suite N (RED-first).
4. **Feature implementation** · code is written until tests go GREEN. No bypass paths, no test-mode conditionals, no swallowed catches.

Each step has a green-test gate. Nothing advances on red.

---

## Non-negotiables (carried from `feedback_*` memory)

- **Spec → tests → code → smoke.** No code lands before its SPEC §N reference exists. No tag without browser smoke evidence in `test-logs/`.
- **No patches.** Every addition fits the data-model rules (directive P1-P10). Transient flags on data, view-internal selection state, hardcoded selector lists are forbidden.
- **No push without explicit approval.** Local commits only until the user says "tag it" / "push" / "ship it."
- **Two-surface testing.** Every data-model change ships demo + seed + demoSpec + DEMO_CHANGELOG entry in the same commit.

---

## Rollback anchors

Per HANDOVER §7.5:

| Tag | Commit | Restores |
|---|---|---|
| `v2.4.16-baseline` | `5614f32` | Last clean shipped state |
| `v2.4.17-wip-snapshot` | `58660b7` | The 14-commit v2.4.17 in-progress build (on local main, preserved) |

Both tags are local on this machine. They do not GC.

---

## Document control

- **Authored**: 2026-04-30 at v3.0 branch creation.
- **Owner**: spec writer (Claude Opus 4.7 1M context, this session and successors).
- **Authority**: this is an index. The directive (file 1 above) is the authority. SPEC.md is the implementation contract.
