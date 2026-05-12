# Session Log · 2026-05-12 (remediation arc)

> Continuation of 2026-05-12. The morning arc landed the S47 Import Data
> workflow (Path A + Path B). The afternoon user audit identified discipline
> violations in Path A; this remediation arc parked Path A, hardened Path B,
> and installed forcing-function discipline rules for the future.

## Arc summary

- **Trigger**: user-driven audit after observing the file-ingest system skill not appearing in the launcher despite all 15 V-FLOW-IMPORT-* tests passing 1269/1269 GREEN
- **Finding**: Path A was implemented across 11 commits with silent constitutional creep (locked-enum extension + 3 new schema fields + system-skills distribution model) AND clone-to-edit shipped without test coverage AND 0-env case degraded silently into a guaranteed-failure path
- **Decision**: park Path A entirely; harden Path B; install 5 forcing-function rules to prevent future drift
- **Outcome**: 5 commits (R0..R4) landed; banner returned to 1265/1265 GREEN with Path B fully tested

## Commits

| Commit | Theme | Banner |
|---|---|---|
| (memory) | R0 · feedback_5_forcing_functions.md installed as TIER-1 anchor | (n/a) |
| `ec963b9` | R1 · Park Path A + BUG-053 logged + 6 Path-A tests removed | 1263/1263 |
| `e8f5a9c` | R2 · Path B 0-env guard (Rule C) + RED test FIRST | 1264/1264 |
| `b5041ea` | R3 · Path B apply-errors surfacing (Rule C) + RED test FIRST | 1265/1265 |
| (this commit) | R4 · Documentation refresh + .gitignore .claude/ | 1265/1265 |

## The 5 Forcing Functions (installed in R0)

Locked at TIER-1 in `feedback_5_forcing_functions.md` alongside R11. Read at every session start.

- **Rule A · Constitutional Pre-Authorization** — Before any code touches `z.enum`, Zod field additions, locked surfaces, or `core/dataContract.js`, STOP and ask user with the literal header `[CONSTITUTIONAL TOUCH PROPOSED]`. The SPEC text alone is NOT a substitute for the Q&A.
- **Rule B · Test-Mounts-the-UX** — Tests for user-facing behavior MUST mount the actual component into a DOM host. Source-grep is permitted ONLY for imports / configuration / file existence / pure-function unit tests. Never the sole guard for UI behavior.
- **Rule C · No-Degraded-Fallback** — User-facing entry points that can produce an unrecoverable state are DISABLED with an inline blocking error. Never silently fall through to a guaranteed-failure path.
- **Rule D · Tests-Don't-Move-to-Match-Code** — A failing test = revert implementation OR re-confirm SPEC. Never edit the assertion to make the new code pass.
- **Rule E · Hidden-Risks-At-This-Layer** — Every commit body MUST include a `Hidden risks at this layer:` section listing untested UI behavior + cross-module callers + next-maintainer context.

## R1 · Path A rip (BUG-053)

Path A code RIPPED across 8 files:
1. `catalogs/skills/file-ingest-instances.json` DELETED
2. `state/v3SkillStore.js` — removed `loadSystemSkills`, `preloadSystemSkills`, `loadAllV3SkillsSync`, `loadAllV3Skills`, system-skill constants
3. `schema/skill.js` — `OutputFormatEnum` restored to 4 values; `preview` / `defaultScope` / `kind` fields removed
4. `app.js` — `preloadSystemSkills` boot hook removed
5. `ui/views/CanvasChatOverlay.js` — `loadAllV3SkillsSync` swap reverted; System chip code removed; `_renderSkillRunOutput` `import-subset` branch + `_routeImportSubsetOutput` helper removed; test exports removed
6. `ui/views/SkillBuilder.js` — `OUTPUT_FORMATS` restored to 4 values; clone-to-edit logic removed; System chip code removed
7. `diagnostics/appSpec.js` — 6 Path-A V-FLOW-IMPORT-* tests removed; V-FLOW-SKILL-V32-AUTHOR-OUTPUT-1 restored to "EXACTLY 4 options"; V-SKILL-V3-6 regex restored to strict
8. `docs/BUG_LOG.md` — BUG-053 logged with the full parked-surface list + re-attempt protocol

**What was KEPT** (Path B-relevant, no constitutional touch):
- `aiTag.kind` constitutional amendment in `schema/instance.js` (Path B uses `kind:"external-llm"` for iLLM provenance)
- All shared pipeline modules (parser, drift, applier, instructions builder)
- `ImportPreviewModal` + `ImportDataModal` + footer button + CSS polish
- `MatrixView` Option B ghost-suppression + iLLM badge variant

## R2 · Path B 0-env guard (Rule C)

RED test authored FIRST: `V-FLOW-IMPORT-NO-ENVS-GUARD-1` asserts:
1. `buildImportInstructions` throws `NO_ENVIRONMENTS` error on 0-env engagement
2. ImportDataModal's Download button is `disabled` when 0 envs
3. ImportDataModal renders `[data-import-data-no-envs-error]` inline blocking error explaining the engineer needs to add an environment

RED smoke at 9:33 PM showed `1263/1264 passed · 1 failed`. After impl, GREEN at 9:37 PM showed `1264/1264 passed`.

Implementation:
- `services/importInstructionsBuilder.js` — entry-point throw with `err.code = "NO_ENVIRONMENTS"`; degraded fallback string removed from buildEnvSlotTable
- `ui/components/ImportDataModal.js` — `hasEnvs` computed at render; Download `.disabled = !hasEnvs`; inline blocking error rendered; click handler short-circuits + try/catch around builder for defense-in-depth
- `styles.css` — `.import-data-no-envs-error` amber callout + `.import-data-download-btn:disabled` state
- Two existing tests (INSTRUCTIONS-1 + INSTRUCTIONS-3) updated to add an env in setup per Rule D (correct direction of test rewrite — the precondition is constitutional; tests must respect it)

## R3 · Path B apply-errors surfacing (Rule C)

RED test authored FIRST: `V-FLOW-IMPORT-APPLY-ERRORS-1` mounts ImportDataModal, drives its INTERNAL file-pick→parse→drift→preview→apply flow via DataTransfer + dispatchEvent + Apply-button click, captures what `commitImport` receives, asserts the arg has `.engagement` + `.addedInstanceIds[]` + `.errors` keys.

RED smoke at 9:44 PM showed `1264/1265 passed · 1 failed` with `commitImport arg MUST carry .engagement; got keys: ["meta","customer","drivers","environments","instances","gaps","activeEntity","integrityLog"]` — proving the modal was passing `res.engagement` (the engagement object) instead of `res` (the envelope).

Implementation:
- `ui/components/ImportDataModal.js` — changed `commitImport(res.engagement)` to `commitImport(res)` so the wired handler receives the full applier-result envelope
- `app.js wireImportDataBtn` — `commitImport` callback signature changed from `(engagement)` to `(applierResult)`; handler reads `engagement` + `addedInstanceIds` + `errors`; switches between `notifySuccess` and `notifyError` based on `errors.length`; partial-failure message: "Partial import: M applied, N failed · row K: <validation message>"

GREEN at 9:46 PM: `1265/1265 passed ✅`.

## R4 · Documentation refresh

- `HANDOFF.md` header rewritten with both TIER-1 anchors (Principal-architect + 5 Forcing Functions); commit ledger; Path B status; Path A parked status with BUG-053 pointer; recoverability checklist
- `docs/v3.0/SPEC.md §S47` updated: status reflects Path A DEFERRED; §S47.0 carries BUG-053 reference; §S47.6 + §S47.7 prefixed with DEFERRED markers (Path A re-attempt MUST re-land these under proper Rule A flow)
- `.gitignore` adds `.claude/` (Claude Code workspace config should not be tracked)
- `.claude/launch.json` untracked (was accidentally committed in `ec963b9`)
- `docs/SESSION_LOG_2026-05-12-remediation.md` (this file) — full remediation arc record

## Bugs touched

- **BUG-053** (NEW · OPEN-DEFERRED) · Path A skill-via-launcher importer parked after constitutional-creep audit
- **BUG-052** (existing · OPEN · intermittent) · Modal-residue test cluster — not affected by today's work

## Discipline lessons captured (for future sessions)

1. **Sub-commit ledger ≠ design clarity.** Path A's 11 commits each had R11 trajectories + screenshots + Hidden-Risks blocks, but none of them flagged the constitutional weight of the OutputFormatEnum extension. The discipline rules need to be specific (Rule A) about WHICH kinds of touches require Q&A, not general "be careful".
2. **"Source-grep tests pass" ≠ "feature works".** 1269/1269 GREEN can coexist with a feature that's invisible in the UI (Path A in the launcher pre-F1). Rule B forces DOM-mount tests for behavior; the audit-remediation tests (LAUNCHER-SYSTEM-CHIP-1, SKILL-RUN-ROUTES-TO-PREVIEW-1, SKILL-BUILDER-IMPORT-SUBSET-1) demonstrated this — they caught what source-grep missed.
3. **Degraded fallbacks bury bugs.** The "(none — add an environment...)" hint in the original Path B modal was a Rule C violation — it let the workflow continue into a guaranteed-failure path. The R2 guard converts this to a blocking error and the engineer can't waste the Dell-internal-LLM round-trip.
4. **The "audit and report" exchange is a forcing function in itself.** The user's audit + my honest accounting forced specific identification of where discipline slipped. Repeat this exchange pattern at the end of every feature arc — it surfaces what the in-progress smokes hid.

## Recoverability

Anyone (Claude or human) can pick up from this point by reading, in order:
1. `HANDOFF.md` — current state
2. `feedback_5_forcing_functions.md` in user's auto-memory — TIER-1 discipline contract
3. `docs/BUG_LOG.md` BUG-053 — Path A parked surfaces + re-attempt protocol
4. `docs/v3.0/SPEC.md §S47` — Path B locked design + Path A DEFERRED markers
5. `diagnostics/appSpec.js` V-FLOW-IMPORT-* tests — 12 GREEN guards for Path B

End of session 2026-05-12 remediation arc.
