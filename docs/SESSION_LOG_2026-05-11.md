# Session Log - 2026-05-11 - rc.8.b polish + contract-fidelity rebuild + relationships KB

**Branch**: `v3.0-data-architecture` · **Local range**: `bcde3c8..db2c5fd` (5 commits) · **Final banner**: 1250/1250 GREEN ✅ · **APP_VERSION**: `3.0.0-rc.8-dev` (rc.8 still in flight; rc.8.b in progress)

> Live ledger. Started day at 1220/1220 GREEN (rc.8.b complete from 2026-05-10) with two user-reported runtime bugs: "Find Customer Name" skill returned the CARE XML template echoed back instead of a real answer, and the Improve-meta-skill leaked concrete values into `<format>`. Ended day with a fully-rebuilt skill plane: contract-fidelity skill runtime, two-pane Skill Builder picker, row-structured engagement-data block, and a 49-path RELATIONSHIPS_METADATA catalog feeding both the picker right pane + the Improve system prompt. +30 net green tests across 5 commits.

## Headline outcomes

1. **BUG-2 closed in three layers** (commit `7d846f0`): Path A rewrote the Improve meta-skill prompt with 5 strict rules (CONCRETE DATA in `<context>`, OBVIOUSLY FAKE placeholders, no value-leakage into `<format>`); Path B injected runtime `<engagement-data>` block at skill-run; BUG-6 removed the "user turn echo" of the rendered prompt from chat dialog.

2. **4 wiring bugs fixed atomically** (commit `e98ffb5`): WB-1 wired the dead `presalesOwner` input; WB-2 added the missing `customer.notes` textarea; WB-3 swapped `newCap`→`introduce` in the gap-type filter (was matching zero gaps); WB-4 replaced legacy `gap.mappedDellSolutions` v2 read in heatmap detail with `effectiveDellSolutions`.

3. **Constitution promoted** (commit `e98ffb5`): `core/dataContract.next.js` (the rebuilt version) replaced the original at `core/dataContract.js`. Original preserved verbatim at `core/dataContract.reference.js` with "REFERENCE ONLY · NOT ACTIVE · DO NOT IMPORT" header. Asserted unimported by `V-CONSTITUTION-REFERENCE-PRESERVED`.

4. **Two anchor documents shipped** (commit `e98ffb5`):
   - `docs/UI_DATA_TRACE.md` r6 hash `4fb8b31d` — per-tab per-element audit
   - `docs/UI_DATA_KNOWLEDGE_BASE.md` r1 hash `490efc8a` — human-readable training reference

5. **Two-pane Skill Builder shipped** (commit `b032122`): ServiceNow-style picker across all three authoring steps:
   - Step 1 · Data Points — Standard/Insights/Advanced toggle + search + grouped left list + structured right detail pane (label, description, type, live sample, Add bubble)
   - Step 2 · Output Format — 4 format cards + WHEN TO USE + EXAMPLE OUTPUT right pane
   - Step 3 · Parameters — list + click-to-expand-edit (one parameter at a time)

6. **Skill runtime rewritten for contract-fidelity** (commit `b032122`): `_buildSkillRunCtx` now routes through `core/dataContract.js` + `core/labelResolvers.js` + catalog snapshots + §S5 selectors. Singular accessors (`ctx.driver.priority`, `ctx.instance.layerLabel`, `ctx.gap.driverName`) finally resolve at runtime. Insights namespace (`ctx.insights.coverage.percent`, `.totals.gaps`, etc.) wraps the 7 §S5 selectors. No direct `engagement.<collection>.byId` access — the rc.8.b drift is closed.

7. **Engagement-data block emits relational rows** (commit `1a89d48`): when 2+ fields from the same collection are selected, the block wraps them in `<entityKind>s>` + emits a markdown table with one row per record. Singletons + single-field collections stay flat. Row-binding preserved across columns; the LLM can filter / cross-reference within and across rows.

8. **RELATIONSHIPS_METADATA catalog shipped** (commit `db2c5fd`): 49 entries documenting anchor binding / FK pairs / multi-hop joins / state-conditional fields / cross-cutting cardinality / derived fields / provenance / ordering semantics. Feeds the picker right pane (RELATIONSHIPS + MANDATORY PAIRINGS + ORDERING sections + visual FK chain diagram for multi-hop) AND the Improve meta-skill system prompt (R1..R7 priming rules) AND the knowledge base doc (r2, hash `be052564`).

9. **R12 (proposed) contract-fidelity rule** referenced in every commit body. No new code path reads engagement data without routing through `core/dataContract.js` or its derived accessors. Formal R12 codification in `PRINCIPAL_ARCHITECT_DISCIPLINE.md` + the CONSTITUTION.md + CLAUDE.md foundation arc is the next-call candidate (not landed today).

## Banner journey

| Stage | Banner | Sub-arc / Commit |
|---|---|---|
| rc.8.b baseline | 1220/1220 ✅ | `bcde3c8` (end of 2026-05-10) |
| BUG-2/BUG-6 closure | 1226/1226 ✅ | `7d846f0` Improve prompt + runtime engagement-data block + drop user-turn echo |
| WB-1..WB-4 + constitution + docs | 1233/1233 ✅ | `e98ffb5` 4 wiring fixes + dataContract.js promotion + UI_DATA_TRACE r6 + UI_DATA_KNOWLEDGE_BASE r1 |
| Two-pane picker + contract-fidelity runtime | 1238/1238 ✅ | `b032122` PICKER_METADATA + _buildSkillRunCtx rebuild + 3-step two-pane shells |
| Relational rows | 1240/1240 ✅ | `1a89d48` `<engagement-data>` block markdown-table for multi-field collection selections |
| Relationships catalog + picker bindings + Improve priming | 1250/1250 ✅ | `db2c5fd` RELATIONSHIPS_METADATA + right-pane RELATIONSHIPS/MANDATORY-PAIRINGS/ORDERING + R1..R7 priming + 10 integrity tests |

## Commit ledger (chronological)

| # | Commit | Theme |
|---|---|---|
| 1 | `7d846f0` | **BUG-2 + BUG-6** · Improve-prompt rewrite + `<engagement-data>` block runtime injection + drop user-turn echo from chat dialog (6 new tests; rc.8.b polish) |
| 2 | `e98ffb5` | **WB-1..WB-4 + constitution promotion + 2 anchor docs** · 4 wiring bugs closed + `dataContract.next.js` promoted to active + original preserved as `.reference.js` + `docs/UI_DATA_TRACE.md` r6 (per-tab audit) + `docs/UI_DATA_KNOWLEDGE_BASE.md` r1 (data-point KB); 7 new regression tests |
| 3 | `b032122` | **rc.8.b skill-builder rebuild** · `PICKER_METADATA` catalog + `_buildSkillRunCtx` rebuild routing through contract + catalog snapshots + §S5 selectors + two-pane Data Points / Output Format / Parameters pickers; 5 new V-FLOW-CONTRACT-FIDELITY-* + V-FLOW-PICKER-METADATA + V-FLOW-SKILL-BUILDER-PICKER tests |
| 4 | `1a89d48` | **Relational-rows engagement-data block** · 2+ fields from the same collection emit `<entityKind>s>` wrapper + markdown table; singletons + single-field stay flat; row-binding preserved across columns; 2 new V-FLOW-SKILL-V32-DATA-INJECT-5/6 tests |
| 5 | `db2c5fd` | **RELATIONSHIPS_METADATA catalog + picker bindings + Improve priming** · 49 path entries with anchor / FK pair / multi-hop / state-conditional / cross-cutting / derived / provenance / ordering metadata; picker right pane gains RELATIONSHIPS + MANDATORY PAIRINGS + ORDERING sections + visual FK chain diagram for multi-hop; Improve system prompt primed with R1..R7 rules; KB doc r2; 8 integrity + 2 source-grep tests |

## Design contract additions (this session)

### `core/dataContract.js` new exports

| Export | Purpose | Commit |
|---|---|---|
| `LABEL_RESOLVED_PATHS` | Declarative catalog-join semantics for paths that resolve via labelResolvers at runtime | `e98ffb5` |
| `INSIGHTS_PATHS` | 15 derived/computed paths from §S5 selectors | `e98ffb5` |
| `getInsightsDataPoints()` | Array<DataPoint> of all Insights paths | `e98ffb5` |
| `getLabelResolvedPaths()` | Shallow copy of LABEL_RESOLVED_PATHS | `e98ffb5` |
| `PICKER_METADATA` | label + description + sampleHint + category + entity per path (49 entries) | `b032122` |
| `getPickerMetadata()` | Shallow copy of PICKER_METADATA | `b032122` |
| `getPickerEntries(scope)` | Sorted entries filtered by category | `b032122` |
| `RELATIONSHIPS_METADATA` | 49 entries: isAnchor / fkPair / multiHop / stateConditional / mandatoryWith / ordering / derivedFrom / crossCutting / provenance | `db2c5fd` |
| `getRelationshipsMetadata()` | Shallow copy of RELATIONSHIPS_METADATA | `db2c5fd` |
| `getMandatorySetFor(path)` | Recursive walk of mandatoryWith for the picker "Add suggested set" button | `db2c5fd` |

`STANDARD_MUTABLE_PATHS` evolved across `e98ffb5` (`customer.notes` + `engagementMeta.presalesOwner` added) and `b032122` (`customer.vertical` raw FK demoted to Advanced).

### `ui/views/CanvasChatOverlay.js` new exports

| Export | Purpose | Commit |
|---|---|---|
| `_buildSkillRunCtx(engagement)` | Build contract-aware resolver context with singular accessors + insights namespace | `b032122` (rewrite); `e98ffb5` (extracted from previous in-file def) |
| `_buildEngagementDataBlock(dataPoints, skillCtx, skillId, engagement)` | Emits the runtime grounding block with relational rows for multi-field collection selections | `1a89d48` (relational-rows fix); originally from `7d846f0` |
| `_buildSkillUserMessage(skill, paramValues, engagement)` | Resolved improvedPrompt + parameter substitution + prepended engagement-data block | `7d846f0` |

### Test vectors added (this session)

30 new tests across 5 commits. All run on the live module graph + real engagement fixtures (no mocks per `feedback_no_mocks.md`).

| Family | Count | Purpose |
|---|---|---|
| `V-FLOW-SKILL-V32-DATA-INJECT-1..4` | 4 | (Yesterday's) `<engagement-data>` block construction; format + sample value resolution |
| `V-FLOW-SKILL-V32-OUTPUT-CLEAN-1` | 1 | (Yesterday's, this session adds:) `V-FLOW-SKILL-V32-IMPROVE-3` source-grep on Improve prompt |
| `V-WB-1..WB-4` | 4 | Each wiring-bug fix has a source-grep regression guard |
| `V-CONTRACT-EXTENDED-EXPORTS` + `V-CONTRACT-EXTENDED-STANDARD-PATHS` | 2 | New contract exports + Standard catalog expansion |
| `V-CONSTITUTION-REFERENCE-PRESERVED` | 1 | dataContract.reference.js exists + unimported |
| `V-FLOW-SKILL-V32-DATA-INJECT-5..6` | 2 | Multi-field collection rows produce markdown table; singletons + single-field stay flat |
| `V-FLOW-CONTRACT-FIDELITY-STANDARD-1` + `INSIGHTS-1` + `LABEL-RESOLVED-1` | 3 | Every Standard + Insights path resolves through `_buildSkillRunCtx`; label-resolved paths return human labels not raw FK ids |
| `V-FLOW-PICKER-METADATA-1` + `V-FLOW-SKILL-BUILDER-PICKER-1` | 2 | PICKER_METADATA aligned with STANDARD + INSIGHTS; picker uses two-pane shell with category toggles |
| `V-FLOW-RELATIONSHIPS-INTEGRITY-1..8` | 8 | mandatoryWith no orphans · fkPair bidirectional · stateConditional onField real · anchors in mandatoryWith for collection paths · Insights have derivedFrom · exact 3 level + 2 phase paths · state-conditional matches schema invariants · multi-hop chains terminate |
| `V-FLOW-RELATIONSHIPS-IMPROVE-PRIMING-1` + `V-FLOW-RELATIONSHIPS-RIGHT-PANE-1` | 2 | Improve prompt cites R1..R7 + forbidden framings; picker renders the three new sections with data-rel-* attributes |

### Documentation artifacts

| Document | Revision | Hash | Status |
|---|---|---|---|
| `docs/UI_DATA_TRACE.md` | r6 | `4fb8b31d` | Per-tab per-element UI→data audit. Authoritative for the Skill Builder catalog. |
| `docs/UI_DATA_KNOWLEDGE_BASE.md` | r2 | `be052564` | Human + AI training reference. r2 added the Relationships and Bindings section (8 categories). |
| `core/dataContract.reference.js` | n/a (preserved) | n/a | Historical reference of pre-rebuild contract; not imported anywhere. |
| `docs/SESSION_LOG_2026-05-11.md` | r1 | this file | Today's design contract + test-vector ledger. |

## SPEC references touched (this session)

- **§S25 · Data contract (LLM grounding meta-model)** — extended by the new exports (PICKER_METADATA, RELATIONSHIPS_METADATA, INSIGHTS_PATHS, LABEL_RESOLVED_PATHS). No structural amendment to §S25 required; the new exports are additive helpers. The original §S25 invariants (top-level await on catalogs, deterministic checksum, validateContract throws on drift, module-cached) are all preserved by the rebuilt `core/dataContract.js`. See `SESSION_LOG_2026-05-11.md` for the export inventory.
- **§S46 · Skills Builder v3.2** — the rc.8.b polish completed today. §S46.4 data-points curation extended with PICKER_METADATA + RELATIONSHIPS_METADATA structured runtime data; §S46.5 skill run-time extended with contract-fidelity `_buildSkillRunCtx` rebuild routing through catalog snapshots + §S5 selectors; §S46.6 output formats now show in two-pane picker with WHEN TO USE + EXAMPLE OUTPUT; §S46.3 picker UX rebuilt as ServiceNow-style two-pane across all three authoring steps.

## Critical semantic glossary (locked this session)

| Field | Type | Ordered? | Rule for prompt authoring |
|---|---|---|---|
| `driver.priority` | High / Med / Low | **NO** | LEVEL. Multiple drivers can be High. Never "top-priority driver"; use "High-priority drivers". |
| `instance.criticality` | High / Med / Low | **NO** | LEVEL. Never "most-critical instance"; use "High-criticality instances". |
| `gap.urgency` | High / Med / Low | **NO** | LEVEL. Derived from linked current's criticality unless override. |
| `instance.priority` | Now / Next / Later | **YES** | PHASE-of-life ordering. "Now-phase instances" is valid. |
| `gap.phase` | now / next / later | **YES** | PHASE-of-life ordering. Drives kanban column placement. |

Encoded in the Improve meta-skill prompt as R2 (LEVEL vs PHASE). Asserted by `V-FLOW-RELATIONSHIPS-INTEGRITY-6` (exact count: 3 LEVEL + 2 PHASE).

## R12 (proposed) contract-fidelity rule

Every commit body this session recited the proposed R12: "Every code path that reads, writes, or surfaces engagement data MUST route through `core/dataContract.js` or its derived accessors (`getDataContract()`, `getStandardMutableDataPoints()`, `getAllMutableDataPoints()`, `getInsightsDataPoints()`, `getLabelResolvedPaths()`, `getPickerMetadata()`, `getRelationshipsMetadata()`, `services/labelResolvers.js`, `state/adapter.js`)."

Formal R12 codification in `PRINCIPAL_ARCHITECT_DISCIPLINE.md` + `CONSTITUTION.md` + `CLAUDE.md` foundation arc + V-CONSTITUTION-* source-grep guards is the next-call candidate; not landed today.

## Key learnings

1. **The rc.8.b drift root cause was bypassing the contract.** Yesterday's `_buildSkillRunCtx` walked the engagement directly and exposed plural collections (`drivers`, `gaps`) but the catalog promised singular paths (`driver.priority`, `gap.urgency`). The fix isn't "add singular fallbacks" — it's "the catalog IS the runtime, everything else is implementation detail." Today's rebuild routes through the catalog as the single source of truth.

2. **Audit-before-architecture.** The `docs/UI_DATA_TRACE.md` r6 per-tab audit (commit `e98ffb5`) caught 4 latent wiring bugs (WB-1..WB-4) that had been quietly shipping for weeks. The audit took ~3 hours but prevented landing a Skill Builder rebuild that would have inherited those bugs as exposed Standard paths.

3. **Row-binding is the contract.** The flat-list block (4 parallel newline-joined fields with no row alignment) was *technically* surfacing all the data but semantically broken — the LLM couldn't compose "disposition of desired instances in Primary DC" because the four lists had no row binding. The markdown-table fix (commit `1a89d48`) was small structurally but architecturally critical. Authors picking fields they can't logically relate IS worse than no picker at all.

4. **Improve priming closes the loop.** Building the picker right pane to show relationships isn't enough — the Improve LLM still generates skill prompts without those rules unless we prime it. R1..R7 in the system prompt (commit `db2c5fd`) ensures generated CARE prompts honor the same rules the picker surfaces.

5. **Soft warnings beat hard blocks.** Mandatory pairings could have been a hard Save-block ("can't save without the anchor"). Instead, soft yellow-tinted warning + one-click "Add suggested set" button. Author keeps agency; system informs without paternalism.

6. **Visual FK chain diagram > textual chain notation.** The color-coded pill flow (white sources → blue catalogs → green results, with arrow separators) reads in 0.5 seconds vs. parsing a prose sentence. Multi-hop joins like `gap.driverName` (3 hops) become intuitive at a glance.

## Next-call candidates (NOT in this session)

1. **Real-LLM acceptance smoke** · author a multi-field skill via the new picker, click Improve against a live Claude key, verify the generated prompt cites the entity anchor + respects level-vs-phase + doesn't write "top-priority". This is the test that proves the user's original Find-Customer-Name failure is fixed end-to-end.

2. **Constitutional foundation arc** · formal R12 codification:
   - `CONSTITUTION.md` at repo root (TIER-0)
   - `CLAUDE.md` boot directive forcing every Claude session to read CONSTITUTION.md before any tool call
   - R12 entry in `PRINCIPAL_ARCHITECT_DISCIPLINE.md`
   - V-CONSTITUTION-1..8 source-grep guards forbidding direct `engagement.<collection>.byId` access outside `state/adapter.js`
   - `getContractChecksum()` pin in test to catch unauthorized contract mutations
   - PREFLIGHT.md item 0 (constitution check) above existing items

3. **Two-pane shell extraction** · if other surfaces (Settings provider list, Tab 4 filter UX) want the same shell, extract `ui/components/TwoPanePicker.js`.

4. **`presalesOwner` UI polish** · the Tab 1 input still has the dead-comment removed but no styling reset; visual polish.

5. **Tag rc.8.b** · banner at 1250/1250 GREEN; the arc is complete enough that a `v3.0.0-rc.8` tag is reasonable. User direction pending.

## R11 discipline (every commit this session)

Each of the 5 commits shipped with:
- Browser smoke at green banner (cold load), screenshot ID captured in commit body
- Regression test per fix (feedback_test_or_it_didnt_ship.md compliance)
- R0..R7 + R11 + R12 recital in commit body
- Per-commit revertibility (atomic; `git revert <sha>` restores prior state)
- No push without approval (all 5 commits local; awaiting user "push" / "tag" call)

## Sign-off

User said "good work" at end of session. Banner GREEN at 1250/1250. Working tree clean except `.claude/` (Claude's local session dir, untracked). All design specifications + test vectors documented per project standards. Ready to pick up tomorrow.

— Claude
