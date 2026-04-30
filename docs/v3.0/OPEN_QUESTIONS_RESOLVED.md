# v3.0 open questions · resolutions

**Authority**: directive §17 lists 7 open questions that the spec writer must resolve before tests get vectors. This file locks the resolutions. Resolutions marked **🟡 default-with-review** were chosen as sensible defaults at branch creation (2026-04-30) per user direction *"use sensible defaults and flag in spec for review."* They are open to change before SPEC.md is finalized.

| Status | Meaning |
|---|---|
| ✅ | Locked. Decision is final unless re-litigated through a directive change request. |
| 🟡 | Default-with-review. Provisional decision; user invited to override before tests get vectors. |

---

## Q1 — Reference laptop profile for performance budget

**Directive**: §11.1 + §17 Q1. *"Which exact machine specification?"*

**Resolution** 🟡 — *Document, don't pin*. Use a calibration multiplier instead of a fixed SKU.

- The 200-instance reference engagement runs through a **performance harness** in `tests/perf/` that records the absolute wall-clock against the v2.4.16-baseline pre-rebuild numbers on the same machine.
- The performance regression test asserts `current_run / baseline_calibration <= budget_multiplier` (e.g., budget multiplier = 1.05 means a 5% regression threshold).
- The first calibration run on each machine writes `tests/perf/baseline.local.json` (gitignored). CI would run on a documented runner profile (Node 20 LTS, 4 vCPU); that calibration is checked in as `tests/perf/baseline.ci.json`.
- The Dell Latitude SKU pinning is deferred to v3.1 when CI runs on documented hardware.

**Why this default**: pinning a Dell Latitude SKU now would block local development on any machine that diverges; the multiplier approach respects directive §11.2.3's "calibration multiplier" guidance.

**Flag for review**: confirm with user that "calibration multiplier on whatever machine is at hand, formal SKU pinning deferred to v3.1" is acceptable for CI gating in v3.0.

---

## Q2 — Memoization library

**Directive**: §5.1.2 + §17 Q2. *"memoize-one vs reselect vs proxy-memoize. Picker: implementation lead. Constraint: one library across all selectors."*

**Resolution** 🟡 — **`memoize-one`** as the v3.0 default.

- Smallest bundle (~250 bytes minified+gzipped); imported per selector.
- Single-cache semantics — invalidation on any input change, which matches the directive §5.1.4 contract that "a selector that produces a different output for the same input on two consecutive calls is a defect."
- Sufficient for v3.0 selector layer; no multi-call cache needed because the engagement reference changes only on action dispatch.
- Reselect is rejected for v3.0 because its derived-selector composition pattern is overkill given the small selector count (~7 from directive §5.2). proxy-memoize is rejected because deep equality on the engagement is more expensive than the directive's reference-equality assumption.

**Flag for review**: revisit if perf tests show the selector layer is the bottleneck or if downstream needs reselect-style composition.

**Constraint enforcement**: ESLint rule `no-restricted-imports` forbids `reselect` and `proxy-memoize` in `selectors/` to prevent drift from the one-library rule.

---

## Q3 — Skill regression suite scope

**Directive**: §7.4.4 + §17 Q3. *"Which skills are 'production-critical' in v3.0? Picker: product owner with input from presales lead."*

**Resolution** 🟡 — Three skills are production-critical in v3.0; structured-output skills get strict regression vectors, free-text skills get smoke vectors.

| Skill | Output kind | Regression rigor |
|---|---|---|
| `dell-mapping` (Dell solution mapping for desired-state instances + gaps) | Structured output (catalog-constrained) | **Strict**: shape, catalog membership, no Boomi/Taegis/VxRail violation, provenance fully populated. Fixture-based pass/fail. |
| `executive-summary` (free-text exec narrative) | Free text | **Smoke**: non-empty, contains customer name, does not echo system prompt, provenance stamped. Tone evaluation deferred to manual review. |
| `care-builder` (system seed that authors other skills' CARE prompts) | Structured output (skill-shape) | **Strict**: produces a save-able skill record that round-trips through the validator without errors. |

**Why this default**: matches directive §8.2's "structured output as primary defense against hallucinated products" — strict where it matters most. exec-summary tone is subjective and is better evaluated in browser smoke than in CI.

**Flag for review**: confirm the three-skill list with user before SPEC.md §7.4 finalization. User may want to add (e.g.) gap-sharpener or driver-questions to the production-critical set.

---

## Q4 — Catalog update channel for v3.1

**Directive**: §6.1.2 + §17 Q4. *"Dell internal endpoint or git-based snapshot updates?"*

**Resolution** 🟡 — **Defer to v3.1 spec**. v3.0 ships bundled snapshots only.

- v3.0 catalog loader interface is `loadCatalog(catalogId): Promise<Catalog>` — implementation reads from a bundled JSON path.
- v3.1 swaps the implementation to fetch from the chosen channel without changing the interface.
- The loader interface is on the v3.0 critical path (directive §6.1.2 demands it); the channel choice is not.

**Flag for review**: at v3.1 spec writing, the user will need a Dell IT contact to confirm whether an internal catalog endpoint exists. If no endpoint, fallback is git-based snapshots in `catalogs/snapshots/` directory consumed via static fetch.

---

## Q5 — Realistic upper bound on real engagement instance count

**Directive**: §11 + §17 Q5. *"The 200-instance number is the demo. If real engagements run to thousands, perf budgets in §11 require recalibration before v3.0 ships."*

**Resolution** ✅ — **200 instances is the v3.0 budget ceiling**. Confirmed with v2.4.17-build inputs (per HANDOVER §8.3).

- Real Dell-customer presales engagements observed in user's experience: 50-200 instances. 200 is the upper bound.
- The reference engagement `tests/fixtures/acme-demo.canvas` fixes this at 200.
- If a real engagement exceeds 200 instances, the perf test fails ahead of any user-visible regression — the user is informed and can recalibrate budgets via a directive change request.

**Why this is locked**: the user is the product owner for v3.0 and the upper-bound is a domain-expertise decision. The HANDOVER §8.3 records the user's input; that closes the question.

---

## Q6 — Skill template stability

**Directive**: §7 + §17 Q6. *"Once a user saves a skill referencing path `context.selectedDriver.linkedGaps`, can the manifest evolve underneath them with auto-migration of skills, or are saved skills immutable until manually re-edited?"*

**Resolution** ✅ — **User owns the re-author flow**. Saved skills are flagged stale on path-drift; never auto-rewritten.

- Per directive §8.4.2: stale-flagging never silently rewrites the value.
- Per HANDOVER §3.1 + v2.4.17 implementation: drift detection sets `validationStatus: "stale"` + `outdatedSinceVersion` stamp; user clicks "Re-run prompt builder" to re-author.
- Path renames in the manifest must come with a migration entry that maps the legacy path to the new path inside the SkillIntentPanel (suggestion only; not auto-applied).

**Why this is locked**: the user explicitly framed skills as user-owned content in v2.4.17 ("the LLM picks tone from the skill prompt; we don't multiply schema dimensions"). Auto-rewrite would violate the spirit of the directive's P5 (provenance) and P10 (real execution) — it would silently change a user-authored prompt.

---

## Q7 — Customer record at backend migration

**Directive**: §13 + §17 Q7. *"The `customer` record stays embedded in the engagement document in v3.0. At backend migration, does it become its own table referenced from engagement, or stay denormalized?"*

**Resolution** ✅ — **v3.0 embeds; v3.2 backend migration promotes to its own table**. Closed with HANDOVER §8.3 input.

- v3.0 in-memory + persisted shape: customer is a single record nested in the engagement document (directive §3.2).
- v3.2 Postgres + Drizzle: customer becomes its own table, FK from engagement. The same customer record can recur across engagements (the user's domain knowledge: same Dell-customer often gets multiple workshops over time).
- The v3.0 schema makes this promotion non-breaking because:
  - All customer FKs already point at the engagement, not at any intra-customer field.
  - The customer record is shaped (engagementId, name, vertical, region, notes) — the engagementId is dropped at promotion; the rest survives unchanged.

**Why this is locked**: domain decision the user has already framed. The promotion is a v3.2 backend concern (directive §13), out of scope for v3.0 implementation but the schema accommodates it.

---

## Resolution summary

| # | Status | Default? |
|---|---|---|
| Q1 | 🟡 default-with-review | Calibration multiplier, no SKU pinning |
| Q2 | 🟡 default-with-review | memoize-one |
| Q3 | 🟡 default-with-review | dell-mapping (strict) + exec-summary (smoke) + care-builder (strict) |
| Q4 | 🟡 default-with-review | Defer channel choice to v3.1; v3.0 bundled-only |
| Q5 | ✅ locked | 200-instance ceiling |
| Q6 | ✅ locked | User-owned re-author; never auto-rewrite |
| Q7 | ✅ locked | v3.0 embed; v3.2 promote to its own table |

**Three locked, four default-with-review.** SPEC.md proceeds against this resolution set; the four 🟡 entries can be revised through a single review pass without disturbing the other directive sections.

---

## Document control

- **Authored**: 2026-04-30 at v3.0 branch scaffold.
- **Owner**: spec writer.
- **Authority**: directive §17 is the question source; this file is the resolution. Both the directive and the resolutions are referenced from `SPEC.md`.
