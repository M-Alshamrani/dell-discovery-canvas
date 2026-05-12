# Session Log - 2026-05-12 - SPEC §S47 Import Data workflow + RED-first scaffold

**Branch**: `v3.0-data-architecture` · **Commits this session**: 1 (`549599f`) · **Banner**: 1250/1250 baseline → 1244/1265 (15 RED designed + 6 pre-existing flakes) · **APP_VERSION**: `3.0.0-rc.8-dev` (rc.8 still in flight; rc.8.b polish arc complete; S47 implementation arc opened)

> Process-disciplined day. User asked for two feature designs (skills + external-LLM workflow). Four rounds of design refinement pushed back on initial over-engineering, surfacing a clean convergent architecture: one shared importer + two ingress paths. 7 decisions locked. Per `feedback_spec_and_test_first.md`, SPEC + 15 RED tests landed FIRST as a scaffold commit. The 3-commit implementation arc (C1/C2/C3) is the next-call.

## Headline outcomes

1. **Two features designed end-to-end**, then converged into one architecture:
   - **Feature A skill (file ingestion)**: a Skills Builder system skill that uploads Excel/CSV/PDF/text, sends to Claude API at runtime, extracts instances into the canvas with per-row preview + confidence + accept/reject.
   - **Feature B workflow (Dell internal LLM)**: a separate non-skill workflow that downloads context-aware instructions to a `.txt` file, engineer runs them externally through Dell's internal LLM with sensitive data, pastes the JSON response back, app previews + applies.
   - **The convergence**: both produce the same canonical `import-subset` JSON shape, both go through the same shared importer + preview modal. Differentiation only at entry point + provenance tag.

2. **Four-round design refinement** with user pushback on over-engineering:
   - Round 1: I over-architected with 11 commits + add-everything scope. User pushed back: "no need to worry about drivers / auto-drafted gaps / over-scoping."
   - Round 2: Clarified Feature A skill #1 (Dell report) is a what-if NARRATIVE, not a state mutation. Deferred Skill #1 (no `gap.dellSolutions` data-point addition; that decision was wrong without justification).
   - Round 3: User raised "is file ingestion just a subset-open of save/open today?" — surfaced that the new workflow needs LLM extraction + per-row preview + provenance, which save/open doesn't do. Justified each framework extension as global-purpose.
   - Round 4: Single button vs. two buttons; LLM-state hint vs. engineer authoritative; "Both" semantics; ghost-tile collision (Option A/B/C). User picked A/single/elegant + strict drift + user authoritative + Option B ghost rule.

3. **7 decisions LOCKED** (will not re-litigate):
   - Q1 single footer button with elegant 2-step modal UI
   - Q2 `.txt` instructions file with markdown-style structure
   - Q3 strict drift handling — clean warning, not an essay
   - Q4 modal apply-scope authoritative; LLM per-row state is hint only
   - Q5 "Both" = two truly independent records (NO `originId` linkage); Option B ghost-rendering rule
   - Q6 `aiTag.kind` discriminator (`"skill"` | `"external-llm"`); badge variant by source
   - Q7 inline env chips always visible in modal; elegant UI/UX not rushed

4. **SPEC §S47 authored** — 235 LOC encoding the locked design across 11 sub-sections (R47.0..R47.11). Includes a CONSTITUTIONAL AMENDMENT note for `aiTag.kind` discriminator extension.

5. **15 V-FLOW-IMPORT-* RED-first tests authored** — 306 LOC. Each rule in SPEC §S47 has a test guarding it. All 15 RED at scaffold time; each flips GREEN as C1/C2/C3 implementation lands.

6. **Skill #1 (Dell-portfolio alignment report) DEFERRED** — user direction: focus on ingestion first, revisit Dell report later. The `gap.dellSolutions` data-point I had proposed was withdrawn (no clear global-capability justification without the dependent skill).

7. **Pre-existing modal-residue test cluster surfaced + documented** — 6 tests (Help modal Esc, V-CLEAR-CHAT-PERSISTS, V-OVERLAY-STACK-4, V-FLOW-CHAT-PERSIST-1/2, V-PILLS-4) have been intermittently failing throughout the rc.8.b polish arc on busy test runs. Logged as **BUG-052** in `docs/BUG_LOG.md` for separate investigation; not blocking the C0 scaffold commit since the 15 new V-FLOW-IMPORT-* tests don't touch DOM/overlays.

## Banner journey

| Stage | Banner | Note |
|---|---|---|
| Session start | 1250/1250 ✅ | `03de841` baseline (end of 2026-05-11) |
| After C0 scaffold | 1244/1265 | 15 RED designed (V-FLOW-IMPORT-*) + 6 pre-existing flakes (BUG-052) + 1244 prior GREEN |
| Target after C1 | ~1254/1265 | ~10 of the 15 RED flip GREEN |
| Target after C2 | ~1255/1265 | +1 RED → GREEN (file-ingest system skill JSON shipped) |
| Target after C3 | 1265/1265 ✅ | +4 RED → GREEN (footer button + workflow + aiTag.kind amendment) |

## Commit ledger

| # | Commit | Theme |
|---|---|---|
| 1 | `549599f` | **C0 scaffold** — SPEC §S47 + §S25 amendment + 15 V-FLOW-IMPORT-* RED-first tests |

## Design artifacts (this session)

### SPEC §S47 (NEW · 235 LOC)

11 subsections:
- §S47.0 status + authority
- §S47.1 two ingress paths converging on shared importer
- §S47.2 scope LOCKED · instances only (drivers/gaps/envs deferred)
- §S47.3 canonical `import-subset` JSON shape
- §S47.4 `.txt` instructions file (11 content sections; state-hint guidance for external LLM)
- §S47.5 shared preview modal (apply-scope authoritative + per-row LLM hints + "Both" semantics + Option B ghost rule)
- §S47.6 Skills Builder framework extensions (`import-subset` output format; `preview` field; `defaultScope` field)
- §S47.7 system skills distribution model
- §S47.8 footer button + modal layout + strict-match warning
- §S47.9 **CONSTITUTIONAL AMENDMENT** for `aiTag.kind` discriminator
- §S47.10 test contract (the 15 V-FLOW-IMPORT-* tests)
- §S47.11 trace (principles + sections + memory anchors)

### SPEC §S25 amendment paragraph
Records the upcoming `aiTag.kind` constitutional amendment. Lands as part of C3 commit with `[CONSTITUTIONAL AMENDMENT]` title per protocol.

### 15 V-FLOW-IMPORT-* RED-first tests

| Test | Verifies | Will flip GREEN at |
|---|---|---|
| V-FLOW-IMPORT-INSTRUCTIONS-1 | `services/importInstructionsBuilder.js` exports `buildImportInstructions(eng, opts) -> {filename, content}` with `.txt` filename + customer name embedded | C1 |
| V-FLOW-IMPORT-INSTRUCTIONS-2 | Instructions are CONTEXT-AWARE: live engagement env UUIDs + labels embedded | C1 |
| V-FLOW-IMPORT-INSTRUCTIONS-3 | Strict-match warning verbatim in the file (R47.8.3) | C1 |
| V-FLOW-IMPORT-RESPONSE-SCHEMA-1 | `services/importResponseParser.js` validates JSON via Zod; rejects malformed input | C1 |
| V-FLOW-IMPORT-DRIFT-1 | `services/importDriftCheck.js` strict-rejects responses referencing missing env UUIDs (R47.8.4) | C1 |
| V-FLOW-IMPORT-PREVIEW-1 | `ui/components/ImportPreviewModal.js` renders one row per `items[]` with confidence + LLM-state hint | C1 |
| V-FLOW-IMPORT-PREVIEW-2 | Modal apply-scope picker authoritative; row-state disagreement surfaces ⚠ indicator (R47.5.3) | C1 |
| V-FLOW-IMPORT-BOTH-1 | `services/importApplier.js applyImportItems({scope:"both"})` creates two truly independent records (no `originId` linkage; R47.5.5) | C1 |
| V-FLOW-IMPORT-GHOST-1 | MatrixView.js encodes Option B ghost-suppression rule (R47.5.6) | C3 |
| V-FLOW-IMPORT-AITAG-KIND-1 | InstanceSchema accepts `aiTag.kind="external-llm"` + `source="dell-internal"` (R47.9 constitutional amendment); MatrixView renders distinct iLLM badge | C3 |
| V-FLOW-IMPORT-AITAG-BACKCOMPAT-1 | Legacy `aiTag` without `kind` field defaults to `kind:"skill"` (R47.9.2 back-compat) | C3 |
| V-FLOW-IMPORT-IMPORT-SUBSET-1 | SkillSchema accepts `outputFormat:"import-subset"` + `preview:"per-row"` + `defaultScope:"desired"` + `kind:"user"` (R47.6 + R47.7.1) | C1 |
| V-FLOW-IMPORT-SYSTEM-SKILL-LOADER-1 | `state/v3SkillStore` loads `catalogs/skills/*.json` as `kind:"system"` skills at boot (R47.7.2) | C1 |
| V-FLOW-IMPORT-FILE-INGEST-SKILL-PRESENT-1 | `catalogs/skills/file-ingest-instances.json` exists + ships as kind=system + outputFormat=import-subset + preview=per-row + defaultScope=desired + parameters[].type=file (R47.7.4) | C2 |
| V-FLOW-IMPORT-FOOTER-BUTTON-1 | `index.html` declares `importDataBtn`; `app.js` wires its click to open the 2-step modal (R47.8.1, R47.8.2) | C3 |

## 3-commit implementation arc (next-call sequence)

```
C1 · Framework extensions + shared importer + preview modal + system-skills loader
     · NEW services/importInstructionsBuilder.js (Path B Step 1; context-aware .txt generator)
     · NEW services/importResponseParser.js (Zod schema validation)
     · NEW services/importDriftCheck.js (strict env-UUID match)
     · NEW services/importApplier.js (apply per-row mutations through commitInstanceAdd; provenance stamping)
     · NEW ui/components/ImportPreviewModal.js (shared preview for Path A + Path B)
     · MOD schema/skill.js (add preview + defaultScope + kind fields)
     · MOD core/dataContract.js (PICKER_METADATA / RELATIONSHIPS_METADATA additions for import-subset metadata)
     · MOD state/v3SkillStore.js (load catalogs/skills/*.json at boot)
     · MOD ui/views/SkillBuilder.js (output-format picker offers import-subset)
     Flips ~10 RED → GREEN
     Banner target: 1244 → ~1254

C2 · catalogs/skills/file-ingest-instances.json
     · Pure JSON system skill definition (no code)
     · Authored against the C1 framework
     · Picks up the C1 system-skills loader automatically
     Flips 1 RED → GREEN
     Banner target: ~1254 → ~1255

C3 · Footer button + workflow + CONSTITUTIONAL AMENDMENT aiTag.kind
     · MOD index.html (add 📤 Import data button)
     · MOD app.js (wire button click → openImportDataModal())
     · NEW ui/views/ImportDataModal.js (the 2-step modal; reuses C1 preview)
     · MOD schema/instance.js [CONSTITUTIONAL AMENDMENT] — aiTag.kind + source fields
     · MOD ui/views/MatrixView.js (Option B ghost rule + iLLM badge variant)
     · MOD core/dataContract.js (re-checksum after aiTag.kind extension)
     Flips 4 RED → GREEN
     Banner target: ~1255 → 1265 ✅
```

## What's locked vs. what's deferred

### Locked + scaffolded (this session)
- Two-feature design + convergent architecture (1 importer + 2 ingress paths)
- Scope = instances only
- Default scope = desired (per user direction)
- All 7 design decisions Q1..Q7
- SPEC §S47 + 15 RED tests + §S25 amendment paragraph

### Deferred (explicit user direction or out-of-scope)
- **Skill #1 (Dell-portfolio alignment narrative report)** — user said: focus on ingestion first; revisit later. The `gap.dellSolutions` data-point addition is also deferred (no justification without the dependent skill).
- **Driver / gap / environment ingestion** — locked to instances only for this arc. Future arcs MAY extend.
- **Constitutional foundation arc** (CONSTITUTION.md + CLAUDE.md + R12 + V-CONSTITUTION-*) — from 2026-05-11 next-call candidates; not started this session.
- **rc.8 tag** — banner is 1244/1265 (not 1250/1250 clean) because the RED scaffold is in flight. Tag happens after the S47 arc lands GREEN.

## Bugs surfaced this session

### BUG-052 · Modal/overlay residue test cluster (intermittent flake; documented for investigation)

6 tests have been intermittently failing throughout the rc.8.b polish arc on busy test runs:
- "Help modal closes via Esc, backdrop click, and close button (T6.17)"
- "V-CLEAR-CHAT-PERSISTS · Clear-chat shows inline confirm; chat overlay stays open through confirm flow (HOTFIX #1)"
- "V-OVERLAY-STACK-4 · stacking layout — base layer occupies left half + restores to centered after pop"
- "V-FLOW-CHAT-PERSIST-1 · open Canvas AI Assistant + click '+ Author new skill' → chat overlay STILL in DOM + Settings mounted in side-panel mode (BUG-028 fix)"
- "V-FLOW-CHAT-PERSIST-2 · close Settings (top layer) → chat restores to full-width + chat input draft preserved"
- "V-PILLS-4 · Click on the active pill toggles the popover open + closed (per R33.3 REVISION); active row click goes to..."

State-dependent on overlay/modal residue from preceding tests in the suite. Cold reloads sometimes show GREEN, sometimes flaky. NOT caused by today's SPEC + RED-test additions (those don't touch DOM). See `docs/BUG_LOG.md` BUG-052 for details + investigation plan.

## R11 discipline this session

The commit (`549599f`) shipped with:
- R0..R7 + R11 + R12 recital in commit body
- Per-commit revertibility (atomic; reverting removes SPEC §S47 + 15 tests; baseline returns to 1250)
- Browser smoke evidence captured (15 RED + 1244 prior GREEN + 6 pre-existing flakes documented)
- No push without approval

## Memory anchors carried forward

This session's design contract:
- **`docs/v3.0/SPEC.md` §S47** — Import Data workflow (the canonical design)
- **`docs/UI_DATA_KNOWLEDGE_BASE.md`** r2 (hash `be052564`) — relationship rules feed the instructions file generator
- **`docs/UI_DATA_TRACE.md`** r6 (hash `4fb8b31d`) — UI surface authority for the ingestion targets
- **15 V-FLOW-IMPORT-* tests** in `diagnostics/appSpec.js` — the test vectors

## Sign-off

Locked 7 decisions across 4 rounds of design pushback; SPEC + 15 RED tests scaffolded; C0 committed as `549599f`. The 3-commit implementation arc (C1/C2/C3) is documented end-to-end in this log + SPEC §S47. The architecture is recoverable from these artifacts even without my context — anyone (human or future Claude session) can pick up from `HANDOFF.md` + the SPEC + this log + the RED tests and land C1.

— Claude
