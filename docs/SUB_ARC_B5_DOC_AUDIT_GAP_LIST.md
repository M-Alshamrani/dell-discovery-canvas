# Sub-arc B.5 · Doc-audit gap-list artifact

**Date**: 2026-05-13
**Author**: Claude (read-only exploration)
**Authority**: BUG-062 locked plan · "C scope is data-driven from this audit, not speculation"
**Purpose**: Determine whether Sub-arc C should (a) wire-existing, (b) hybrid (wire + author bridges), or (c) author-new

## TL;DR · Recommendation: **HYBRID**

Most knowledge the chat needs is already in the codebase. Layer 3 (62-concept dictionary) + Layer 5 (16 workflows + 19 recommendations) + Layer 1 Examples 1-8 cover ~80% of presales questions. **What's missing is 4 short user-facing reference docs that clarify common conceptual confusions + one optional Layer 1 Example.**

Total Sub-arc C effort estimate: **~2-3 hours authoring + ~30 min wiring**.

---

## Part A · What the chat currently has access to

### Layer 1 (Role section, cached · ~3.5 KB)

- 10 numbered ground rules (rules 1-9 + handshake) — includes Anti-leak rule 3a (forbid UUIDs/field-names/version-markers in output), Rule 2 strengthened to MUST-call-tool-for-specific-counts (post-polish 2026-05-13)
- **8 behavior examples** (post-Sub-arc-B + B-polish):
  1. Workshop gap probing (healthcare)
  2. Customer-voice → canvas action mapping (ransomware → driver/gap/criticality)
  3. Honest refusal of out-of-scope question (revenue not in schema)
  4. Tab 2 workload-instance walkthrough
  5. Why-disabled diagnosis (Save context gated on customer.name)
  6. Badge meaning (iLLM vs AI provenance distinction)
  7. Save/persistence (auto-save to localStorage + .canvas file backup)
  8. Tool-call-then-cite data-grounding pattern

### Layer 2 (Data contract, cached · ~15-20 KB)

Auto-derived from schemas + catalogs + manifests via `core/dataContract.js getDataContract()`:
- 7 entity shapes with field cardinality + types
- FK relationships taxonomy
- Hard invariants (G6, I9, AL7, etc.)
- 8 catalogs (BUSINESS_DRIVERS, ENV_CATALOG, LAYERS, GAP_TYPES, DISPOSITION_ACTIONS, SERVICE_TYPES, CUSTOMER_VERTICALS, DELL_PRODUCT_TAXONOMY)
- 73-path bindable manifest
- 9 analytical-view tool descriptions

### Layer 3 (Concept dictionary TOC, cached · ~1.5 KB inlined)

62 concepts across categories: gap_type · phase · status · disposition · driver · env · vendor_group · layer · urgency · workload · entity · skill · service.

TOC inlines `id + label + 1-line headline`. Full bodies (definition + example + when-to-use + vsAlternatives + typical Dell solutions) fetched via `selectConcept(id)` tool on demand.

### Layer 5 (App workflow manifest, cached · ~3 KB)

- **APP_SURFACES** (10 entries): app_purpose, 5 topbar_tabs, 6 global_actions
- **Workflow TOC** (16 procedures): capture_context, matrix_current_state, draft_desired_state, manage_gaps, review_vendor_mix, review_gaps_kanban, map_gap_to_dell_solutions, generate_executive_summary, save_engagement_to_file, open_engagement_from_file, configure_ai_provider, use_canvas_chat, author_a_skill, start_a_new_engagement, +2
- **Recommendations** (19 pre-crafted answers): regex-triggered shortcuts for common patterns (add gap, save work, vendor mix poor, etc.)

Full workflow bodies via `selectWorkflow(id)` tool on demand.

### Tool surface (9 selectors)

`selectMatrixView` · `selectGapsKanban` · `selectVendorMix` · `selectHealthSummary` · `selectExecutiveSummaryInputs` · `selectLinkedComposition` · `selectProjects` · `selectConcept` · `selectWorkflow`

---

## Part B · Canonical docs outside the chat

| Doc | Purpose | Currently in prompt? | Size |
|---|---|---|---|
| `docs/UI_DATA_TRACE.md` (r6) | Per-tab UI-element-to-schema-field map | Auto-derived data in Layer 2 | ~10 KB |
| `docs/CANVAS_DATA_MAP.md` (r1) | BUG-058 audit, 73 paths · §6 anti-confusion + §8 wire-format | §8 referenced in chat priming | ~8 KB |
| `core/dataContract.js` RELATIONSHIPS_METADATA | Live constitution, Zod + ENTITY/FIELD/RELATIONSHIP descriptions | In Layer 2 via getDataContract() | ~600 lines |
| `docs/v3.0/SPEC.md` (18 sections) | Authority for §S20/S25/S27/S28/S37/S47 | Indirect (chat behavior follows it) | 200+ pages |
| `docs/RULES.md` (v2.4.15) | Rule-tags 🔴🟡🔵📦; §11 UI-surfaces; §13 disposition rules | Indirect | ~200 lines |
| `docs/TAXONOMY.md` | Entity-and-relationships view | Overlaps Layer 2 | unaudited |
| **Skills Builder Data Map** | (in-flight per user) | In CANVAS_DATA_MAP §8 + STANDARD_MUTABLE_PATHS export | — |
| **COMPONENT_META blocks** | Per-component UI contracts | **Not found** — not yet authored | — |

---

## Part C · Per-question-type gap analysis (representative sample)

| User question | Chat coverage today | Gap? | Wire vs Author? |
|---|---|---|---|
| "What gaps should I probe for at this healthcare customer?" | Example 1 + Layer 3 driver concepts + Layer 4 real engagement | ✅ Covered | — |
| "How do I add a workload instance in Tab 2?" | Example 4 + Layer 5 workflow TOC + selectWorkflow | ✅ Covered | — |
| "What does iLLM badge mean?" | Example 6 (1-line) | ✅ Covered | — |
| "Why is Save context disabled?" | Example 5 | ✅ Covered (current behavior) | Wire if generalized to selectUiState diagnostic tool |
| "How many High-urgency gaps?" | Example 8 + selectGapsKanban | ✅ Covered | — |
| "List Dell-branded instances by env" | Example 8 + selectMatrixView | ⚠️ **GRD-2 weakness** — chat returns counts, doesn't enumerate by name | Wire: helper `selectDellInstancesByEnvironment(state)` OR add Example 9 for enumeration pattern |
| "Tab 2 vs Tab 3 difference?" | APP_SURFACES + Example 5 contextually | ⚠️ Thin — no explicit conceptual bridge | Author: `docs/CURRENT_VS_DESIRED_STATE.md` (~0.5 KB) |
| "How do I save my work?" | Example 7 | ✅ Covered | — |
| "Map gap to Dell products?" | Example 2 + workflow.map_gap_to_dell_solutions + driver.typicalDellSolutions | ⚠️ Synthesizable but not direct | Author: `docs/DELL_SOLUTIONS_BY_GAP_TYPE_AND_LAYER.md` (~1 KB, needs SME) |
| "Show all instances affected by Replace-Veeam gap" | selectLinkedComposition exists | ⚠️ Not named in any Example | Wire: Example 9 (selectLinkedComposition pattern) |
| "What's 'consolidate' vs 'retire'?" | Layer 3 TOC + selectConcept vsAlternatives | ✅ Covered | — |
| "How do I use Canvas Chat effectively?" | workflow.use_canvas_chat + Examples 1-8 | ⚠️ No human-facing cheat sheet | Author: `docs/CANVAS_CHAT_USER_GUIDE.md` (~1 KB) |
| "Gap type vs disposition?" | Layer 3 concept entries for both | ⚠️ Common confusion point | Author: `docs/GAP_TYPE_VS_DISPOSITION.md` (~0.5 KB matrix) |

---

## Part D · Recommendation breakdown · HYBRID

### Wire (no authoring · ~30 min total)

1. **Add Example 9** to `services/systemPromptAssembler.js` Layer 1 Role section — demonstrate `selectLinkedComposition(kind='gap', id)` pattern for per-row drilldown questions. Closes the "show me everything linked to this gap" gap. **Requires `[CONSTITUTIONAL TOUCH PROPOSED]` preamble per discipline.**

2. **Optionally add Example 10** — enumerate-items-by-name pattern (vs Example 8's count-and-cite). Closes GRD-2 weakness (5/10 → ~9/10). **Same preamble requirement.**

### Author (4 new docs · ~2-3 hours total · NOT loaded into system prompt)

These are human-facing reference docs. Not bloating the chat's cached prefix; instead linked from recommendations + skill templates + Canvas-Chat user guide.

| Doc | Size | Effort | Purpose |
|---|---|---|---|
| `docs/CANVAS_CHAT_USER_GUIDE.md` | ~1 KB | 45 min | How to ask Canvas Chat effectively (6 sections by question type) |
| `docs/CURRENT_VS_DESIRED_STATE.md` | ~0.5 KB | 30 min | Anchor Tab 2 vs Tab 3 distinction + dispositions + originId linkage |
| `docs/GAP_TYPE_VS_DISPOSITION.md` | ~0.5 KB | 20 min | Matrix distinguishing gap_type (work nature) vs disposition (lifecycle action) |
| `docs/DELL_SOLUTIONS_BY_GAP_TYPE_AND_LAYER.md` | ~1 KB | 60 min | gap_type × layer matrix with typical Dell products per cell (needs SME input) |

### Verification gate (Sub-arc C completion)

After wiring + authoring, re-run `window.runCanvasAiEvals()` and confirm:
- Discovery, App-how-to, Refusal categories stay ≥9/10
- Data-grounding improves to ≥9.5/10 (with Example 10)
- New overall average: **9.16 → ~9.3-9.4/10**
- Pass rate: 96% → ~96-100%

---

## Part E · What's NOT in this audit (deliberate)

- **COMPONENT_META blocks**: not yet authored; out of scope for B.5 since they don't exist as a single artifact. Could be a future arc.
- **Skills Builder Data Map standalone**: content is distributed across `core/dataContract.js` exports + `CANVAS_DATA_MAP.md §8`. No separate file needed.
- **Full SPEC §S20/S25/S27/S28 verbatim**: too large to load into Layer 1; chat behavior already follows the spec implicitly.

---

## Cross-references

- `feedback_5_forcing_functions.md` — Rule A constitutional pre-authorization (any Layer 1 edits require preamble)
- `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` — Philosophy section (process binary, changes not)
- `docs/SESSION_LOG_2026-05-13-discipline-lapse.md` — corrective action record for commit `4e34d6e`
- `tests/aiEvals/baseline-2026-05-13T20-01-50-669Z.json` — post-polish baseline (9.16/10 · 96% pass)
- `core/conceptManifest.js` — 62-concept TOC + full bodies
- `core/appManifest.js` — 16 workflows + 19 recommendations
- `services/chatTools.js` — 9 chat tools

## Session-of-record

Audited 2026-05-13 evening, read-only exploration spawned via Explore agent against the post-push state (commit `d3f118e` philosophy clarification landed). No files modified during the audit itself. This artifact is the B.5 deliverable; Sub-arc C scope decision is data-driven from this document.
