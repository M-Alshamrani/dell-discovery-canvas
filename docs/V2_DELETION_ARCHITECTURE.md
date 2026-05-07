# v2 Deletion Architecture · rc.7 / 7e-8 (REDO after 977bf68 revert)

**Authority**: SPEC §S40 (v3-pure architecture, LOCKED 2026-05-06) · RULES §16 CH34 · `project_v3_pure_arc.md`.

**Status**: 2026-05-08 morning · DRAFT · supersedes the 7e-8d-3..5 deletion attempt that broke app boot (reverted in commit `977bf68`).

---

## 0 · First principle

> **What would a principal architect do?**
>
> Audit the consumer graph BEFORE deleting any module. Migrate consumers FIRST. Verify each step in the actual browser, not in a test banner. Don't hide v2 logic in a test-fixture file to satisfy a grep. Don't add backward-compat emits in v3 stores to keep v2 listeners alive. Don't retire tests that assert real contracts; rewrite them in v3-native form.

This document is the contract that gates every commit in the redo. If any commit violates a gate, the commit is rejected (not "fixed up later").

---

## 1 · Why the previous attempt failed

The 7e-8d-3..5 sub-arc deleted the 5 v2 modules but missed 5 production consumers because:

1. **Scope-limited test trusted instead of own grep**. `V-ANTI-V2-IMPORT-1` source-grepped a closed list of 8 production files (`/app.js` + 4 view tabs + `aiUndoStack` + `aiCommands` + `bindingResolvers`). When that test passed GREEN, I trusted it as "no production consumers." It only meant "no consumers in 8 specific files."

2. **No own-grep before deletion**. I ran `grep -rnE "from.*sessionStore" --include="*.js" | head -10` once, then deleted. The `head -10` truncated the actual consumer list.

3. **No browser smoke between commits**. I read the test banner ("1214 GREEN") and assumed the app worked. The 5 transitive module-load failures killed boot silently.

4. **Test-fixture shim as fig leaf**. `diagnostics/_v2TestFixtures.js` re-exported v2 symbols so the test surface kept compiling without real v3 migration. The grep test passed because diagnostics/ wasn't in its scope; the v2 LOGIC stayed alive in the codebase.

5. **Backward-compat emit in v3 store**. `engagementStore._emit() → emitSessionChanged("v3-commit")` was added so legacy `onSessionChanged` listeners kept firing without the bridge. This kept v2-era event flow alive in a "v3-pure" architecture. A real fix migrates the listeners.

6. **Retired tests instead of re-implementing**. `V-FLOW-CHAT-DEMO-2` asserted that v2 customer changes flow into v3. I rewrote it as a negative file-existence assertion. The contract it asserted (file-open populates v3 with full envelope, not just customer) was abandoned.

---

## 2 · Consumer graph (current state, post-revert at 977bf68)

### 2.1 PRODUCTION consumers of v2 modules

| Consumer | v2 import | What it reads | v3 path it should use |
|---|---|---|---|
| `services/gapsService.js:12` | `session` from sessionStore | `session.gaps` for global gap reads (used by selectors) | `getActiveEngagement().gaps.allIds.map(id => engagement.gaps.byId[id])` — wrap in a v3-native selector |
| `services/sessionFile.js:38` | `migrateLegacySession` from sessionStore | Translates v2 envelope on file load | `state/runtimeMigrate.js translateV2SessionToV3Engagement` (already exists, built in the prior 7e-8d-1 attempt — restore it) OR call `migrations/index.js migrateToVersion` directly |
| `services/vendorMixService.js:16` | `session` from sessionStore | `session.instances` for vendor mix counts | `getActiveEngagement().instances.allIds.map(id => engagement.instances.byId[id])` — wrap in a v3-native selector |
| `ui/views/AiAssistOverlay.js:31` | `session` from sessionStore | Used for AI context in the legacy tile-grid AI Assist overlay | Per `project_v2x_admin_deferred.md`: this file is DORMANT (Cmd+K rebound to `openCanvasChat` in rc.4 Arc 2; no production .js imports `openAiOverlay`). Decision: **DELETE the dormant file** in this arc rather than migrate (drops dead code). Confirm with `grep openAiOverlay` first. |
| `ui/views/SkillAdmin.js:13` | `session as liveSession` from sessionStore | Used for skill admin form | Per `project_v2x_admin_deferred.md` + RULES CH31: this file is DORMANT (Settings → Skill Builder routes to the new `SkillBuilder.js`). Decision: **DELETE the dormant file** in this arc. Confirm with `grep SkillAdmin` first. |

### 2.2 INTERNAL consumer

`state/sessionStore.js:11` imports `setPrimaryLayer, deriveProjectId` from `interactions/gapsCommands.js`. Both are used inside `migrateLegacySession` for legacy gap field backfill. When `migrateLegacySession` moves to its new home (test fixture or runtime migrator), this internal import comes with it.

### 2.3 TEST consumers

| Consumer | v2 import | Decision |
|---|---|---|
| `diagnostics/_v2TestFixtures.js` | re-exports from all 4 v2 modules | DELETE (the fig leaf). Tests that need v3 fixtures use v3 schema directly via `schema/engagement.js` + `state/adapter.js`. Tests asserting v2 contracts get rewritten as v3 contracts. |
| `diagnostics/demoSpec.js:23` | `session, replaceSession` from sessionStore | Rewrite to use v3 engagement fixtures (v3 demo via `core/demoEngagement.js`). |
| `diagnostics/appSpec.js:9283` | `_rearmMirrorForTests` from sessionBridge | Retire — bridge is going away; the 3 callers in appSpec.js need their own v3-native fixture replacement (or get retired alongside). |

### 2.4 V-ANTI-V2-IMPORT-1 scope bug

Current scope (from `diagnostics/appSpec.js:12609-12618`): a hard-coded list of 8 files. **Any consumer not on the list is invisible.** That's how 5 importers slipped past.

**Fix**: source-grep ALL files under `services/`, `ui/`, `interactions/`, `core/`, `state/`, `selectors/` for v2 imports. Use the existing fetch + regex pattern but enumerate the directories at test-run time (or hard-code a directory walk). Going RED everywhere v2 is still imported is the GOAL; that becomes the migration backlog.

---

## 3 · Migration order (dependency-driven)

Each step is its own commit. Each step ends with a Chrome MCP browser smoke (open `/`, screenshot main panel, verify rendering). No banner-only verification.

### Step A · Test-scope expansion (RED-first)

**Commit message**: `test . V-ANTI-V2-IMPORT-1 + V-ANTI-V2-IMPORT-2 expand to scan ALL services/ ui/ interactions/ core/ state/ selectors/ files (RED reveals real consumer graph)`

- Rewrite the two anti-import tests to enumerate via `fetch` against a manifest of directories OR via a known-paths registry generated from the actual file tree.
- Run tests. Both go RED with a list of every consumer.
- That list IS the migration backlog.

**Gate**: tests fail with a complete consumer list matching §2.1. Browser smoke confirms app still boots (no production code touched yet).

### Step B · `services/sessionFile.js` migrates to runtime translator

**Commit message**: `refactor . services/sessionFile.js v3-native · applyEnvelope returns v3 engagement via runtime translator (drops migrateLegacySession from v2 sessionStore)`

- Re-introduce `state/runtimeMigrate.js` (the file from the reverted 7e-8d-1 — copy back from git history).
- Rewrite `services/sessionFile.js applyEnvelope()` to call `translateV2SessionToV3Engagement(env.session)` and return `{ engagement, skills, providerConfig, ... }` (NOT `{ session, ... }`).
- Update `app.js handleOpenedFile` to call `setActiveEngagement(res.engagement)` (the proper way, not the bridge mediation).

**Gate**: V-ANTI-V2-IMPORT-1 list shrinks by 1. Browser smoke: open a `.canvas` file, verify Tab 1 + Tab 2 render with the loaded data (proves the latent file-open data-loss bug is also closed).

### Step C · `services/gapsService.js` migrates to v3 reads

**Commit message**: `refactor . services/gapsService.js v3-native reads via getActiveEngagement (drops session import)`

- Replace `session.gaps` reads with `getActiveEngagement().gaps.allIds.map(id => eng.gaps.byId[id])`.
- If a v3-native gap selector already exists in `state/adapter.js`, use it.
- If not, add one: `selectAllGaps(engagement)`.

**Gate**: V-ANTI-V2-IMPORT-1 list shrinks by 1. Browser smoke: load demo, navigate to Tab 4 (Gaps), verify gaps render.

### Step D · `services/vendorMixService.js` migrates to v3 reads

**Commit message**: `refactor . services/vendorMixService.js v3-native reads via getActiveEngagement (drops session import)`

- Same pattern as Step C: `session.instances` → v3 reads.

**Gate**: V-ANTI-V2-IMPORT-1 list shrinks by 1. Browser smoke: load demo, navigate to Tab 5 (Reporting) → Vendor mix sub-tab, verify charts render.

### Step E · `ui/views/AiAssistOverlay.js` DELETED

**Commit message**: `delete . ui/views/AiAssistOverlay.js (dormant since rc.4 Arc 2; Cmd+K rebound to openCanvasChat) — confirms project_v2x_admin_deferred.md retirement`

- Confirm `grep openAiOverlay` returns ZERO production callers.
- Delete the file.
- Drop any remaining import comments / dormancy notes.

**Gate**: V-ANTI-V2-IMPORT-1 list shrinks by 1. Browser smoke: Cmd+K still opens Canvas AI Assistant overlay.

### Step F · `ui/views/SkillAdmin.js` DELETED

**Commit message**: `delete . ui/views/SkillAdmin.js (dormant since rc.4 Arc 4; Settings -> Skill Builder routes to SkillBuilder.js) — confirms project_v2x_admin_deferred.md retirement`

- Confirm `grep SkillAdmin` returns ZERO production callers (the routing to the new `SkillBuilder.js` should be in place).
- Delete the file.

**Gate**: V-ANTI-V2-IMPORT-1 list shrinks by 1. Browser smoke: Settings → Skill Builder still opens the new SkillBuilder UI.

### Step G · `state/sessionBridge.js` DELETED

**Commit message**: `delete . state/sessionBridge.js (no production importer remains; the bridge's customer-only shallow merge was a cutover-window adapter, now moot) — V-FLOW-V3-PURE-2 GREEN`

- At this point, only `app.js` imports the bridge as a side effect. App.js's `onSessionChanged` listener still expects the bus to fire — but that needs to be migrated, not preserved.
- **THIS IS WHERE THE SUBSCRIBER MIGRATION HAPPENS** (Step G's pre-requisite).
- Migrate `app.js onSessionChanged(...)` to `subscribeActiveEngagement(...)`. Drop `import "./state/sessionBridge.js"` side effect.
- Delete the bridge file.

**Gate**: V-FLOW-V3-PURE-2 flips GREEN. Browser smoke: load demo, click +New session, verify the page resets cleanly.

### Step H · `state/sessionStore.js` DELETED

**Commit message**: `delete . state/sessionStore.js (zero importers; v3 engagementStore is the sole source of truth for engagement state) — V-FLOW-V3-PURE-1 + V-ANTI-V2-IMPORT-1 GREEN`

- All 5 production importers have migrated (Steps B, C, D, E, F).
- All test importers have migrated (Steps I-J below).
- Delete the file.

**Gate**: V-FLOW-V3-PURE-1 + V-ANTI-V2-IMPORT-1 flip GREEN. Browser smoke: full UX walkthrough (load demo, edit driver, save file, reload, open file, switch tab, edit env).

### Step I · `diagnostics/_v2TestFixtures.js` DELETED

**Commit message**: `delete . diagnostics/_v2TestFixtures.js (the fig leaf) -- tests that built v2-shape fixtures rewrite to v3-direct via schema/engagement.js + state/adapter.js`

- Audit every test that imports from `_v2TestFixtures.js`. Each gets rewritten to use:
  - `createEmptyEngagement()` from `schema/engagement.js` (instead of `createEmptySession()`)
  - `commitInstanceAdd / commitGapAdd / commitDriverAdd` from `state/adapter.js` (instead of `addInstance / createGap`)
  - v3 engagement reads (instead of v2 `session.X`)
- Tests that asserted v2 contracts (sessionStore.saveToLocalStorage round-trip, etc.) get rewritten to assert v3 contracts (engagementStore persistence round-trip).
- Tests that asserted no longer-applicable contracts (e.g. v3→v2 customer mirror) DROP, not "retired with negative assertion."

**Gate**: zero `_v2TestFixtures.js` references in `diagnostics/`. Browser smoke: full test pass + UX.

### Step J · `interactions/{matrixCommands,gapsCommands,desiredStateSync}.js` DELETED

**Commit message**: `delete . interactions/{matrixCommands,gapsCommands,desiredStateSync}.js (zero importers post Step I; v3 adapter.js + dispositionLogic.js are the sole sources) -- V-FLOW-V3-PURE-3/4/5 GREEN`

- All 3 modules' production references already routed to v3 (rc.7 / 7e-3..7 work).
- All test references migrated in Step I.
- Delete the 3 files.

**Gate**: V-FLOW-V3-PURE-3/4/5 flip GREEN. Browser smoke: full UX.

### Step K · engagementStore architectural cleanup

**Commit message**: `refactor . state/engagementStore.js drop the legacy session-changed bus emit -- v3-pure subscribers via subscribeActiveEngagement only`

- After Step G, `app.js` is on `subscribeActiveEngagement`. Audit all remaining `onSessionChanged(...)` callers.
- Each caller migrates to `subscribeActiveEngagement` OR retires.
- Drop the `emitSessionChanged("v3-commit")` line from `engagementStore._emit()`.
- If `core/sessionEvents.js` has zero production callers, delete that too.

**Gate**: NO production module imports `core/sessionEvents.js onSessionChanged` (new V-ANTI-LEGACY-BUS-1 test). Browser smoke: full UX.

---

## 4 · Cross-cutting gates (apply to EVERY commit in this arc)

1. **Own-grep first**. Before deleting/refactoring any file, run `grep -rnE "from.*<filename>"` and audit ALL hits. Don't trust scope-limited tests.
2. **Browser smoke at commit boundary**. Chrome MCP `screenshot + read main-left children + assert >0 cards`. Banner alone does not count.
3. **No backward-compat hacks**. If a v3 store needs to fire a legacy emit, the legacy subscriber needs migration instead.
4. **No test-fixture file hiding v2 logic**. The endpoint of this arc is zero v2 logic anywhere in the repo (production or diagnostics).
5. **Tests assert v3 contracts**. Tests that asserted v2 contracts get rewritten, not retired.
6. **Per-commit smoke verifiable + revertible**. If smoke fails, REVERT the commit, don't pile a fix on top.

---

## 5 · Out of scope for this arc

- Renaming the `v3` prefix in module/symbol names (per `feedback_no_version_prefix_in_names.md` — that's its own pass after v3 is the only architecture).
- The 3 deferred test failures (FS3, VT29, V-CLEAR-CHAT-PERSISTS) — separate `7e-post` arc.
- PREFLIGHT real-LLM smoke — runs at rc.7 tag.

---

## 6 · Resume order for next session

1. Read this doc end-to-end.
2. Verify state: `git status` clean, `docker compose up -d --build`, browser smoke confirms 1214/1221 GREEN + Tab 1 renders.
3. Start at Step A (test-scope expansion).
4. Each subsequent step in order. No skipping. No combining.

If a step's smoke fails: revert that commit, post-mortem in this doc as a new "Lessons" section, then retry.
