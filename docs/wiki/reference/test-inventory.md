# Test inventory (auto-derived)

Generated for `v2.4.11.d02` from `describe()` / `it()` parse of `diagnostics/appSpec.js` + `diagnostics/demoSpec.js`.

**Total: 509 assertions across 42+ suites · all green** as of v2.4.11.d01 build verification.

---

## `appSpec.js` — 487 assertions

| Suite | Coverage | Assertions | Source phase / version |
|---|---|---:|---|
| 01 | core/config — layer definitions | 12 | Phase 0 baseline |
| 02 | core/config — technology catalog | 10 | Phase 0 baseline |
| 03 | core/models — validateInstance | 14 | Phase 0 + Phase 16 (W1b) |
| 04 | core/models — validateGap | 20 | Phase 0 + Phase 17 + v2.4.9 (G6 primary-layer) |
| 05 | state/sessionStore | 10 | Phase 0 + migrator updates per phase |
| 06 | interactions/matrixCommands | 18 | Phase 0 + Phase 16 (mapAsset/unmapAsset/proposeCriticalityUpgrades) |
| 07 | interactions/gapsCommands | 22 | Phase 0 + Phase 17 + Phase 18 + v2.4.9 + v2.4.11 |
| 08 | services/healthMetrics | 16 | Phase 0 |
| 09 | services/gapsService | 12 | Phase 0 |
| 10 | services/vendorMixService | 14 | Phase 0 |
| 11 | services/roadmapService | 12 | Phase 0 + v2.4.9 (PR1-PR5 projectId) |
| 12 | ui/views/ContextView — DOM contract | 10 | Phase 0 + Phase 14 (drivers) |
| 13 | ui/views/MatrixView — DOM contract | 14 | Phase 0 + Phase 16 |
| 14 | ui/views/GapsEditView — DOM contract | 10 | Phase 0 + Phase 18 + v2.4.11 |
| 15 | ui/views/Summary views — DOM contracts | 12 | Phase 0 + Phase 14 + Phase 18 |
| 16 | app shell — stepper & navigation | 8 | Phase 0 |
| 17 | AI integration readiness | 10 | Phase 0 (became real wiring in 19a) |
| 18-23 | v2.1.1-v2.3.0 (right-panel, Session Brief, gap-link visibility, etc.) | ~30 | v2.1.1 / v2.3.0 |
| 24 | Phase 16 · Workload Mapping (W1-W5) | 10 | v2.3.1 |
| 25 | Phase 19a · AI foundations (AI1-AI9) | ~10 | v2.4.0 |
| 26 | Phase 19b · Skill Builder (SB1-SB8) | 8 | v2.4.1 |
| 27 | Phase 19c · Field-pointer (FP1-FP9) | 9 | v2.4.2 |
| 28 | Phase 19c.1 · Pill editor (PE1-PE7) | 7 | v2.4.2.1 |
| 29 | Phase 19d.1 · Prompt guards (PG1-PG6) | 6 | v2.4.3 |
| 30 | Phase 19d · Output handling (OH1-OH17) | 17 | v2.4.4 |
| 31-35 | Phase 19e · demoSpec/Foundations (DS1-DS17) | (in `demoSpec.js`) | v2.4.5 |
| 36 | Phase 19f · Reliability/backoff (RB1-RB7) | 7 | v2.4.5.1 |
| 37 | reserved for v2.6.0 action-commands (AC1-AC10) | 0 (queued) | v2.6.0 |
| 38 | Phase 19h · Fresh-start UX (FS1-FS5) | 5 | v2.4.7 |
| 39 | Phase 17 · Taxonomy (TX1-TX10) | 10 | v2.4.8 |
| 40 | v2.4.9 · Primary-layer + projectId (PL1-PL5, PR1-PR5) | 10 | v2.4.9 |
| 41 | v2.4.10 · .canvas save/open (SF1-SF11) | 11 | v2.4.10 |
| 42 | Phase 19k · Rules Hardening (RH1-RH20) | 20 | v2.4.11 |
| **Total** |  | **487** |  |

## `demoSpec.js` — 22 assertions

| Suite | Coverage | Assertions | Source phase |
|---|---|---:|---|
| 31 | demo session data-model | 5 (DS1-DS5) | v2.4.5 |
| 32 | seed skills vs FIELD_MANIFEST | 4 (DS9-DS12) | v2.4.5 |
| 33 | apply + undo byte-identical | 2 (DS13-DS14) | v2.4.5 |
| 34 | personas | 1 (DS15) | v2.4.5 |
| 35 | session-changed bus | 2 (DS16-DS17) | v2.4.5 |
| 35b | post-Phase-17 demo invariants | 4 (DS18-DS21) | v2.4.8 |
| 35c | v2.4.11 urgencyOverride visible | 1 (DS22) | v2.4.11 |
| **Total** |  | **22 (DS1-DS22)** |  |

## What each suite pins

The two-surface principle ([ADR-007](../../adr/ADR-007-skill-seed-demosession-separation.md)) splits coverage into:

- **`appSpec.js`** — data contracts, validators, command behaviour, view DOM contracts. Cheap to run, catches regressions fast, doesn't prove UX.
- **`demoSpec.js`** — keeps the demo session and seed-skill library in sync with the live data model. Catches "the demo still uses v2.0 gap shape" drift that would let the human-test surface silently stop exercising real code paths.

## Test runner

`diagnostics/testRunner.js` is a 136-LOC in-browser framework — `describe()` / `it()` / `assert()` / `assertEqual()` + `runIsolated(run, restoreCallback)` localStorage snapshot/restore guard (added v2.4.10.1 to fix the test-pollution bug).

Tests fire 150ms after page load. Banner at the bottom of the page shows pass/fail count; auto-dismisses after 5 seconds on green (v2.4.6); stays sticky on red until the user clicks ✕.

## Refresh trigger

Re-generate this file every `.dNN` hygiene-pass and any time a new suite is added.
