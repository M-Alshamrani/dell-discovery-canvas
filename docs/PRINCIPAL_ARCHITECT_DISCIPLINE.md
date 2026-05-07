# Principal Architect Discipline · LOCKED 2026-05-08

**Status**: 🔴 HARD · binding contract for every commit, every session, every handover. Tier-1 alongside `feedback_spec_and_test_first.md`, `feedback_no_mocks.md`, `feedback_browser_smoke_required.md`.

**Authority**: User direction 2026-05-08 (verbatim): *"let me warn you not to patch like a weak cheap developer and act as a highest standared principal architect. from now on this is the firsti principal you akwnoladge at every pass."*

**Trigger context**: the rc.7 / 7e-8d-3..5 sub-arc shipped a deletion that broke app boot because a scope-limited grep test was trusted instead of an own audit. 5 production importers of `state/sessionStore.js` weren't on the test's closed list of 8 files; the test passed GREEN, the deletion shipped, the app died silently with empty stepper + empty main panels. The 7e-8d arc was reverted in commit `977bf68`. This document is the contract that prevents the next attempt from making the same shape of mistake.

---

## R0 · First-pass thought (MANDATORY at every action boundary)

Before any non-trivial change, write down explicitly: **"What would a principal architect do here?"**

A principal architect:
- Looks at the consumer graph, not just the module being changed.
- Refuses to ship a change whose blast radius they haven't audited.
- Treats "the test passed" as necessary, never sufficient.
- Removes dependencies; doesn't hide them in test files.
- Migrates listeners; doesn't preserve legacy emits.
- Rewrites tests to assert the new contract; doesn't retire them with file-existence negatives.
- Reverts a broken commit instead of piling a fix on top.

If the answer to "what would a principal architect do" is "they wouldn't ship this," do not ship it.

---

## R1 · Audit before delete (own-grep, not closed-list test)

Before deleting OR refactoring any file, run an explicit grep:

```bash
grep -rnE "from.*<filename>|import.*<filename>" --include="*.js"
```

**without `head` or any other truncation**. Read the FULL output. Audit every hit:
- Is the consumer expecting the v2 surface or a v3-pure equivalent?
- Does a v3 equivalent already exist? Where?
- If no v3 equivalent: STOP. Build it first as its own arc.

**Closed-list source-grep tests are a smell**. If a `V-ANTI-*` test enumerates a hard-coded list of files, it has a scope bug. Use a manifest that lists ALL production files (e.g. `diagnostics/_productionFileManifest.js`) so every consumer is in scope.

---

## R2 · Migrate before delete

The deletion of a module is the LAST step, never the first. The order is always:
1. Audit consumer graph.
2. For each consumer: migrate to v3 equivalent, smoke-verify, commit.
3. When zero importers remain (verified via own-grep AND the manifest-scoped V-ANTI-* test), delete the module.

Never delete a module to "force" consumers to migrate. The build will fail invisibly (module-load errors don't appear in the test banner).

---

## R3 · Browser smoke at every commit boundary

Per `feedback_browser_smoke_required.md` (LOCKED earlier; this re-affirms it):

- After every code change that is observable in the browser preview, run the verification workflow:
  - Chrome MCP `navigate` to `/`
  - `screenshot` the result
  - `read_page` or DOM check: assert `main-left` has children, stepper has 5 tabs, header strip rendered
  - For UX changes: walk the affected flow (load demo, click tab, save file, etc.)
- The test banner is necessary but NOT sufficient. A 1214/1221 GREEN banner can co-exist with an empty-stepper boot failure.
- If the change is non-observable (pure tests, docs), say so explicitly.

---

## R4 · No backward-compat hacks in v3 code

A v3 module that fires a legacy event so v2-era subscribers keep working is a smell. The fix is to migrate the subscribers, not preserve the legacy emit.

Examples of forbidden patterns:
- `engagementStore._emit() → emitSessionChanged("v3-commit")` to keep `onSessionChanged` listeners alive after the bridge is deleted.
- `setActiveEngagement(eng)` calling `localStorage.setItem("dell_discovery_v1", ...)` to keep v2 sessionStore consumers seeing fresh data.
- Any `// for backward compat` / `// keeps legacy X working` comment that should instead be `// migrate Y to v3 first`.

---

## R5 · No fig-leaf test fixtures

Hiding v2 logic in a `diagnostics/_*.js` file so production source-grep tests pass while the v2 logic survives in the codebase is the same as keeping the v2 logic in production.

The endpoint of a deletion arc is **zero v2 logic anywhere in the repo**, not "no v2 imports under one of these 8 specific paths."

If a test needs v2-shape data:
- Construct it inline from v3 schema + a translator (e.g. `engagementToV2Session`).
- Or rewrite the test to assert the v3 contract directly.

---

## R6 · Tests assert v3 contracts (rewrite, don't retire)

A test that asserted a v2 contract (e.g. `V-FLOW-CHAT-DEMO-2 · bridge SHALL shallow-merge v2 customer changes into v3`) gets REWRITTEN to assert the v3 contract that replaced it (e.g. `customer edits via commitContextEdit propagate to engagementStore directly`).

Forbidden: replacing a real assertion with a negative file-existence assertion (`bridge file MUST NOT exist`). The negative is fine as a regression guard, but it MUST NOT be the only test of the underlying contract. Every retired test must answer: *"Where is the contract this used to assert now tested?"*

---

## R7 · Per-commit revertibility

Each commit must be:
- **Independently smoke-verifiable** (Chrome MCP screenshot + DOM check + functional walk).
- **Independently revertible** (`git revert <sha>` produces a working state).

If a commit fails smoke: **REVERT IT**. Don't pile a fix on top. The fix-on-top pattern leads to the "house of cards" failure mode where the third commit in a chain is broken because the first commit's hidden dependency was never noticed.

---

## R8 · Surface scope balloons

When a planned commit's scope grows mid-execution (e.g. "delete file X" turns out to also need "rewrite test Y" + "migrate consumer Z"), **STOP**.

Surface the new shape to the user with two paths:
1. **Original-scope path**: revert, plan the bigger arc properly.
2. **Larger-scope path**: do the bigger arc now, with explicit acknowledgment.

Never ship "fix forward" without explicit user direction. The "fix forward" shape is how patches accumulate.

---

## R9 · Handover surfaces the contract

Every `HANDOFF.md` update at session end MUST include a top-of-file reference to this document.

Every memory anchor snapshot MUST include "Principal-architect discipline is active per `feedback_principal_architect_discipline.md`."

The intent: no future session can forget. The discipline persists across compaction, session restart, model swap, or new contributor onboarding.

---

## R10 · Acknowledgment in every action

Before starting a non-trivial change, the agent writes (out loud, in user-visible text):
- "Principal architect lens: {what I'm about to do} would be considered {acceptable / concerning / a-patch} because {reasoning}."
- "Audit before delete: {grep result summary}."
- "Browser smoke plan: {what I'll verify after}."

This is not boilerplate. It's the forcing function that makes the agent stop and think instead of pattern-matching to "delete file → rebuild → check banner."

---

## Cross-references

- `feedback_spec_and_test_first.md` — spec → tests → code → smoke (LOCKED).
- `feedback_no_mocks.md` — no mock providers / scripted LLMs (LOCKED tier-1).
- `feedback_browser_smoke_required.md` — manual browser smoke required (LOCKED).
- `feedback_no_patches_flag_first.md` — flag patches before coding (LOCKED).
- `feedback_test_or_it_didnt_ship.md` — every BUG-NNN fix ships a regression test (LOCKED).
- `docs/V2_DELETION_ARCHITECTURE.md` — concrete application of these rules to the rc.7 / 7e-8 redo.

## Where this document is referenced

- `MEMORY.md` index entry → `feedback_principal_architect_discipline.md` (auto-loads in every future session).
- `HANDOFF.md` top-of-file anchor.
- `docs/RULES.md` §16 cross-reference (next session, chapter pending).
- `docs/V2_DELETION_ARCHITECTURE.md` §0 First Principle.

## Session-of-record

**Locked 2026-05-08 morning** by user direction after the rc.7 / 7e-8d-3..5 boot-breaking deletion was reverted. This document is the durable result of that lesson; the deletion redo (`docs/V2_DELETION_ARCHITECTURE.md` Steps A..K) is the first work to be governed by it.
