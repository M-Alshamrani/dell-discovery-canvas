# Handover: v2.4.17 work-in-progress → v3.0 data-architecture rebuild

**Date authored**: 2026-04-30
**From**: v2.4.17 in-progress build (this branch, 14 commits ahead of `origin/main`, none pushed)
**To**: v3.0 data-architecture rebuild per `data-architecture-directive.md`
**Authority**: this document is the bridge artifact. It captures current state of the v2.4.17 build so the v3.0 implementation team knows exactly what was attempted, what works, what doesn't, and how to roll back if needed.

---

## 1. Repository state at handover

### 1.1 Git topology

```
origin/main                                                      = 5614f32  (v2.4.16 ship, last pushed state)
local HEAD                                                       = 58660b7  (v2.4.17 in-progress, 14 commits ahead)

5614f32  v2.4.16  tag-time docs sync                             ← origin/main (last pushed)
b90b50d  v2.4.17  spec lock (docs/ai-features/ contract)         ← v2.4.17 work begins here
2d38a4e  v2.4.17  scaffold (APP_VERSION + SPEC §9 + CHANGELOG)
0184be9  v2.4.17  HANDOFF flip
671fa6a  v2.4.17  spec baseline 615 → 616 + target ~774 → ~775
d4e0bdb  v2.4.17  Suite 49 RED-first (154 placeholders)
9564032  v2.4.17  Step 2a · §INT integrity sweep
1eddecb  v2.4.17  Step 2b · data-{kind}-id rendering rule
f521598  v2.4.17  Steps 3+4 · session.activeEntity + commands + resolver
5a83cea  v2.4.17  Step 5 · setSelection wired into 5 views
1ae543a  v2.4.17  Step 6 · core/manifest.js + label refresh
98ac8f1  v2.4.17  Step 7 · skill schema scope/scopeKind/version stamps
39a9362  v2.4.17  Step 8 · seed library purge (3 seeds)
8b929b1  v2.4.17  Steps 9 + 10a · click-to-scope dispatch + sparkle marker
58660b7  v2.4.17  fix · catalog merge + AI marker pick-mode-only + capsule  ← HEAD
```

**No commits are pushed.** Origin/main remains at `5614f32` (v2.4.16). Rolling back to v2.4.16 is a single `git reset --hard origin/main`. The 14 ahead commits stay in the reflog for ~90 days and can be cherry-picked back if needed.

### 1.2 Working tree state

- Working tree is clean (all changes committed).
- `data-architecture-directive.md` (the consultant's v3.0 directive) is at the project root, untracked. Recommend committing it before starting v3.0 work so it's part of repo history.
- `second_opinion_consultation.md` (the prompt sent to the consultant) is at the project root, untracked.

### 1.3 Container state

Docker container `dell-discovery-canvas:latest` is running on `localhost:8080`, built from HEAD `58660b7`. Health endpoint returns 200. The page banner reads `✅ All 770 tests passed` on every load. Auto-dismisses after 5s. To rebuild from a different commit, run `docker compose up -d --build --force-recreate`.

---

## 2. What v2.4.17 attempted (intent)

The v2.4.17 release goal, locked at commit `b90b50d`, was a foundational rebuild of the AI features after v2.4.16's audit revealed that the AI Assist surface was bolted on top of the data model with patches: DOM-scraping pick mode, view-internal selection state, hardcoded selector lists, transient flags on data objects.

The user's explicit direction at v2.4.17 spec lock: **"we work with foundational data models input and outputs, and that it. If something defined as a new data identifier, it has to fit the data model rules."** Plus: **"i can not accept this patching."**

The v2.4.17 contract in `docs/ai-features/SPEC.md` defines 18 sections, ~168 numbered rules, ~163 RED-first tests. Banner target: 616 → ~775 GREEN. Two non-negotiables: no patches; data-model integrity end-to-end. Two input modes for skills: click-to-scope (one entity user clicks) and session-wide (whole engagement).

This v2.4.17 contract is a **conceptual subset of v3.0**. It addresses the AI-features pain points but does not address: schema-as-source-of-truth (Zod), AI provenance wrapping, catalog versioning, Dell product taxonomy correctness, multi-engagement readiness, or performance budgets enforced by CI. The v3.0 directive supersedes it.

---

## 3. v2.4.17 implementation: what landed

### 3.1 Step-by-step inventory

| # | Step | Commit | Status | What it did |
|---|---|---|---|---|
| 1 | Suite 49 RED-first | d4e0bdb | ✅ | 154 it() placeholders pinning the contract by name. Zero failures because all bodies were empty (passes trivially). |
| 2a | §INT session integrity sweep | 9564032 | ✅ | NEW `state/sessionIntegrity.js` exporting `validateSessionIntegrity` + `repairSessionIntegrity`. Wired into `migrateLegacySession`. `services/sessionFile.js buildSaveEnvelope` strips `session.integrityLog` on serialize. INT1-INT13 tests real. Demo session passes the gate. |
| 2b | data-{kind}-id rendering rule | 1eddecb | ✅ | View renders carry `data-driver-id` / `data-instance-id` (+ `data-state`) / `data-gap-id` / `data-project-id` / `data-env-id`. CLICKABLES.md updated. VW1-7, VW14, CL4-5 tests real. |
| 3+4 | session.activeEntity + selection commands | f521598 | ✅ | `core/models.js` exports `KIND_ENUM` + `validateActiveEntity`. `state/sessionStore.js` adds `activeEntity: null` field + migrator backfill. `services/sessionFile.js` strips activeEntity on serialize. NEW `interactions/selectionCommands.js` (setSelection, clearSelection). NEW `services/entityResolver.js` (resolveActiveEntity). DM1-9, CMD1-5 tests real. |
| 5 | setSelection wired into views | 5a83cea | ✅ | All 5 entity-rendering views call `setSelection(kind, id)` on tile click alongside their legacy class-toggle/closure logic. VW8/9/10/12/13 tests real. (VW11 left placeholder — closure cleanup deferred.) |
| 6 | core/manifest.js + label refresh | 1ae543a | ✅ | NEW `core/manifest.js` exports `SESSION_PATHS` + `ENTITY_PATHS_BY_KIND` + `LEGACY_LABEL_TO_PATH` + `pathsForSkill`. Labels refreshed: "Selected driver label" → "Strategic driver", etc. `core/fieldManifest.js` deleted. 4 caller imports updated. MF1-8 + LB1-10 tests real. |
| 7 | skill schema migration | 98ac8f1 | ✅ | `core/skillStore.js` `normalizeSkill` adds `scope` + `scopeKind` strict validation, drops legacy `audience` + `disableQualityRules`. `migrateLegacySkill` infers scope from template. `validatedAgainst` + `outdatedSinceVersion` stamps. DM10-14 + VER1-9 + MG3-6 tests real. |
| 8 | seed library purge | 39a9362 | ✅ | `core/seedSkills.js` rewritten: 3 seeds (driver-questions, gap-sharpener, care-builder-system). Legacy 7 seeds gone. `skillsForTab` excludes system seeds by default. SD1-8 + MG5 tests real. |
| 9 + 10a | click-to-scope + sparkle | 8b929b1 | ✅ | `services/skillEngine.js runSkill` becomes scope-aware (synchronous needs-selection envelope when click-to-scope unmatched). `ui/views/AiAssistOverlay.js` queues skills + auto-reruns on matching click. Always-on Dell-blue dot replaced with pick-mode-only purple "AI" pill via CSS. |
| fix | catalog merge + capsule | 58660b7 | ✅ | `services/entityResolver.js` merges BUSINESS_DRIVERS + ENV_CATALOG metadata into resolved entity (fixes "different drivers produce same output" bug). Overlay morphs to capsule on needs-selection so canvas underneath is clickable. |

### 3.2 Test contract progress

- **Banner**: 770/770 GREEN, 0 RED on every page load.
- **Suite 49 placeholders flipped to real assertions**: 86 of 154 (~56%).

| Block | Coverage | Status |
|---|---|---|
| §T-INT (integrity sweep) | 13/13 | ✅ complete |
| §T-DM (data model) | 14/14 | ✅ complete |
| §T-CMD (selection commands) | 5/5 | ✅ complete |
| §T-VW (view contract) | 13/14 | partial · VW11 closure-cleanup deferred |
| §T-MF (manifest split) | 8/8 | ✅ complete |
| §T-LB (label refresh) | 10/10 | ✅ complete |
| §T-SD (seed library) | 8/8 | ✅ complete |
| §T-VER (versioning) | 7/9 | partial · VER7/8 SkillAdmin badge UI deferred |
| §T-MG (migration) | 6/6 | ✅ complete |
| §T-CL (clickables catalog) | 2/6 | partial · CL1/2/3/6 manifest-finalization |
| §T-EN (engine) | 0/8 | placeholder |
| §T-UI (AI Assist UI rebuild) | 0/11 | placeholder |
| §T-PM (pick mode) | 0/11 | placeholder |
| §T-CB (CARE prompt-builder UI) | 0/7 | placeholder |
| §T-CD (discipline rules) | 0/10 | placeholder |
| §T-VAL (skillCareValidator) | 0/6 | placeholder |
| §T-CB-RT (careBuilder runtime) | 0/8 | placeholder |

The 68 still-placeholder tests pass trivially (empty body) — the contract is captured by name only.

### 3.3 Live verified behaviors

Smoke-tested via Chrome MCP at `http://localhost:8080` against the demo session:

- **Selection flow**: click any driver/env/instance/gap/project tile → `session.activeEntity` updates to `{kind, id, at}`. Survives tab switches.
- **Click-to-scope dispatch**: open AI Assist (Ctrl+K) → click "Suggest discovery questions" → if no matching activeEntity, overlay morphs to capsule + purple "AI" pill appears on driver tiles → click any driver → skill auto-runs against that driver.
- **Catalog merge**: clicking Cyber Resilience produces a different rendered prompt than clicking AI & Data Platforms (the resolved entity has the catalog's label/hint/conversationStarter inline). Pre-fix this was broken (identical prompts).
- **Visual marker**: default state has NO indicator on tiles. Pick-mode shows purple "AI" pill on matching-kind tiles only, pulsing.
- **Drift detection**: a saved skill with template `"Selected driver label: {{context.selectedDriver.label}}"` loads with `outdatedSinceVersion: "2.4.17"` stamped.
- **Demo gate**: `validateSessionIntegrity(createDemoSession())` returns `{ ok: true, fixes: [], errors: [] }`.

---

## 4. Known challenges in v2.4.17 (unfinished work)

These are the gaps the v3.0 team should know about. Some carry over to v3.0; some become moot under the directive.

### 4.1 Skill builder UI not rebuilt

Current `ui/views/SkillAdmin.js` is the v2.4.16 single-form-per-skill UX. The user explicitly asked for a 2-step Intent panel: Step 1 picks scope (click-to-scope vs session-wide), Step 2 picks the entity kind (for click-to-scope), then the chip palette filters dynamically.

This is `docs/ai-features/SPEC.md` §8 (CB1-CB7), Step 11 of the order-of-work in the v2.4.17 contract. Not implemented.

**v3.0 directive equivalent**: §7 (Skill model, Manifest generation, Path resolution, Skill output validation). The directive's manifest is generated from Zod schemas and skills are validated against it at save time — supersedes the v2.4.17 manual approach.

### 4.2 Response panel still plain text

The user explicitly flagged this as a frustration: "ugly white textbox with rubbish and stars sometimes." The result panel renders text-brief output as plain `<pre>`-like text. No markdown rendering, no formatted card, no deterministic "Working on:" SmartTitle header.

This is `docs/ai-features/SPEC.md` §6 UI4 + UI9-11. Not implemented.

**v3.0 directive equivalent**: not explicitly in the directive, but follows naturally from the directive's §7.4 (skill output validation) + the provenance wrapper §8. v3.0 should rebuild the response panel as part of the skill output rendering.

### 4.3 SmartTitle not implemented

A deterministic header above AI output that reads (e.g.) "Working on: Cyber Resilience · Strategic driver · High priority" — built from the resolved entity, not the LLM. Promised in the v2.4.17 contract; not built.

**v3.0 directive equivalent**: §5.2 lists `selectLinkedComposition` and the directive's UI strategy implies a similar header — confirm with the spec writer.

### 4.4 CARE prompt-builder runtime not built

The system seed `skill-care-builder-system` exists in `core/seedSkills.js` with the right systemPrompt + scope/scopeKind. But `core/careBuilder.js` (the actual runtime that invokes the system seed when the user clicks "Refine with CARE") is not authored. Tests §T-CB-RT 1-8 are placeholder.

**v3.0 directive equivalent**: §7.4 covers structured output for skill suggestions. The CARE-builder is one such skill in the directive's vocabulary; implementation falls under the spec writer.

### 4.5 Discipline rules (`core/aiQualityRules.js`)

The v2.4.17 contract §9 (CD1-CD10) defines runtime-composed discipline rules: voice, calibration BEFORE/AFTER pairs, Dell anchor catalog, format overlays. No file authored; tests §T-CD 1-10 are placeholder.

**v3.0 directive equivalent**: §6.2.1 lists the Dell product taxonomy corrections (no Boomi, no Secureworks Taegis, no VxRail, SmartFabric Manager not Director, CloudIQ under APEX AIOps). v3.0's catalog-driven validation (§8.2 catalog validation at suggestion time) is structurally stronger than v2.4.17's prose-based discipline rules.

### 4.6 Skill versioning UI

Tests §T-VER7/8: SkillAdmin should render an amber "Needs update" badge on skills where `outdatedSinceVersion` is set, plus a "Re-run prompt builder" button that pre-fills the SkillIntentPanel. The data-layer (`outdatedSinceVersion` stamping) works; the UI surface is not built.

**v3.0 directive equivalent**: drift detection (§6.1.3, §8.4) and stale-flagging are first-class in the directive. The UI distinction (§8.3 "fields with validationStatus = stale flagged with warning icon") supersedes the v2.4.17 badge approach.

### 4.7 §T-VW11 closure cleanup

The v2.4.17 contract calls for views to *replace* per-view `selectedDriverId` / `selectedGapId` closures with `session.activeEntity` reads. v2.4.17 added `setSelection` calls *alongside* the legacy closures (additive, not replacing). The closures still exist; views still render based on the closure, not on `session.activeEntity`.

This is intentional (transitional). Step 10's full UI rebuild was supposed to retire the closures. Step 10 was deferred.

**v3.0 directive equivalent**: §5 (derived views layer). Selectors are pure functions over the engagement; no per-view closures. v3.0 retires this category of state entirely.

### 4.8 Browser smoke evidence not captured

Per `feedback_browser_smoke_required.md`, every tag MUST include a manual smoke evidence file at `docs/ai-features/test-logs/v2.4.17-smoke.md`. Not authored. v2.4.17 was never tagged so this is acceptable, but the file is required if v2.4.17 is tagged later.

### 4.9 Environment writable fields are read-only in the manifest

CLICKABLES.md §4.6 nominally lists `context.selectedEnvironment.{alias|location|sizeKw|sqm|tier|notes}` as writable. The actual `core/manifest.js` marks them all `writable: false` because `core/bindingResolvers.js` doesn't have write resolvers for them. CLICKABLES.md was updated to match the implementation (writable: false).

**v3.0 directive equivalent**: schema-driven (§2). If the Zod schema marks a field writable, the resolver is generated to support it. The hand-maintained-resolver gap goes away.

### 4.10 `urgencyOverride` and `mappedDellSolutions` writable: false

Same root cause as 4.9. Marked writable: false in v2.4.17 manifest pending resolver work.

**v3.0 directive equivalent**: same — solved by schema-driven resolver generation.

### 4.11 Legacy seeds purged but unverified user impact

v2.4.17 deleted the 6 legacy seeds (driver-tuner, current-tile-tuner, desired-tile-tuner, gap-rewriter, gap-services-suggester, reporting-narrator) plus the original driver-questions. New seeds: driver-questions (rebuilt), gap-sharpener, care-builder-system. **Any user who saved their own skills based on the v2.4.16 seeds still has those skills in localStorage.** They will be flagged `outdatedSinceVersion: "2.4.17"` on load (per v2.4.17's drift detection), but the user has to manually re-author them. No automatic migration of user-saved skills.

**v3.0 directive equivalent**: §9.3 step 9 covers AI-authored field migration. The directive does not cover user-saved-skill migration explicitly — flag this for the spec writer.

### 4.12 Data architecture overall

v2.4.17 did NOT address the user's explicit direction to do a "full clean data architecture as per industry data architecture and linked records practice." This is the topic the data-architecture-directive supersedes. v2.4.17 stayed within the v2.4.16 storage shape; v3.0 reshapes storage.

---

## 5. Comparison: v2.4.17 (current) vs v3.0 (consultant directive)

| Concern | v2.4.17 approach | v3.0 directive approach |
|---|---|---|
| Schema source of truth | Hand-maintained: `core/models.js` validators + `core/manifest.js` paths + tests | Single Zod artifact in `schema/`; validators / manifest / DDL all derived |
| Storage shape | Flat `session.X` arrays, unchanged from v2.4.16 | Flat `engagement.X` collections with `{byId, allIds, indexes}` in-memory |
| Driver storage | Nested under `customer.drivers[]` | Promoted to top-level `drivers` collection |
| Engagement scoping | None (single-session app) | Every record carries `engagementId` + `ownerId` from day one |
| Customer fields | Includes legacy `segment` + `industry` (back-compat) | Drops them in the v2.0 → v3.0 migrator |
| `session.activeEntity` | Implemented (kind, id, at) | Same shape, kept transient (stripped on save) |
| `integrityLog` | Implemented | Same |
| `gap.projectId` | Stored field | Dropped — derived only |
| AI-authored fields | Plain strings (`mappedDellSolutions`, etc.) | Provenance wrapper (`{value, provenance: {model, promptVersion, ...}}`) |
| Catalog versioning | None | Every catalog has `catalogVersion`; persisted entities reference both id + version |
| Dell product taxonomy | None | First-class catalog with documented corrections (no Boomi, no Taegis, etc.) |
| Skill manifest | Hand-maintained `core/manifest.js` | Generated from Zod schema; drift fails build |
| Linked-composition view | Not implemented (resolver returns shallow record) | First-class via `selectLinkedComposition` selector |
| Click-to-scope dispatch | Implemented (synchronous needs-selection + auto-rerun) | Conceptually identical; rebuilt on top of selectors + manifest |
| LLM structured output | Not implemented (free-text parsing) | Mandatory via provider function-calling + schema-derived JSON Schema |
| Skill output validation | Lightweight (parseProposals) | Schema-derived constraint at LLM call time + post-call validation |
| Migration system | `state/sessionStore.js migrateLegacySession` (M1-M11) | Versioned migrators in `migrations/v2-0_to_v3-0.js` etc., with round-trip fixtures |
| Integrity sweep | `state/sessionIntegrity.js` (INT1-13) | Same role; consumes machine-readable FK declarations |
| Performance budget | Not enforced | CI-gated on reference engagement (200 instances) |
| Test mocking | Permissive (some tests stub localStorage, etc.) | Real-execution-only; only LLM provider + Date + timer mockable |
| Backend target | Undecided | Postgres + Drizzle (document DB explicitly rejected for cross-engagement reporting) |
| TypeScript | Not used | Optional; can adopt any time after schema layer is in |

**Net**: v3.0 is a substantially fuller rewrite. Some v2.4.17 work is reusable (the v2.0 → v3.0 migrator can absorb v2.4.17's M1-M11 logic; the data-{kind}-id rendering rule survives; the integrity sweep's INT3-INT9 logic survives).

---

## 6. Reuse map: what v2.4.17 produced that v3.0 can absorb

The v3.0 team can lift these directly:

### 6.1 Direct lift (data-layer)

- **§INT integrity-sweep rules** (`state/sessionIntegrity.js` INT3-INT9): the FK orphan-drop logic, workload mappedAssetIds W4/W5 enforcement, gap.affectedLayers G6 invariant repair, services normalization. Translate into the v3.0 schema-declared FK-checks pattern, but the actual repair logic is correct.
- **`session.activeEntity` shape** (`{kind, id, at}` with `kind ∈ KIND_ENUM`): the directive uses the same shape (§3.1 transient fields).
- **Demo session content** (`state/demoSession.js`): the Acme Financial Services persona with 4 drivers including the `ai_data` driver that v2.4.17 added. The v3.0 reference engagement (`acme-demo.canvas` per directive §14.3) can be derived from this with shape transformation.
- **Migration step inventory** (`state/sessionStore.js migrateLegacySession`): M1-M11 migrator logic informs the v2.0 → v3.0 migrator (directive §9.3).

### 6.2 Direct lift (UI behaviors)

- **`data-{kind}-id` rendering rule** in all 5 views: ContextView, MatrixView, GapsEditView, SummaryGapsView, SummaryRoadmapView. The DOM contract is identical under v3.0.
- **`setSelection` + `clearSelection`** click-handler wiring: v3.0 treats this as a dispatched action; the call sites in views are identical.
- **Pick-mode purple "AI" pill CSS** in `styles.css`: visual contract is unchanged.
- **Click-to-scope queue + auto-rerun** in `AiAssistOverlay.js`: the dispatch logic is correct; needs to be rewritten on top of v3.0 selectors.

### 6.3 Conceptually correct, schema-driven in v3.0

- **Manifest split** (SESSION_PATHS + ENTITY_PATHS_BY_KIND + LEGACY_LABEL_TO_PATH): conceptually right; v3.0 generates it from the schema instead of hand-maintaining.
- **Skill schema (scope/scopeKind/validatedAgainst/outdatedSinceVersion)**: v3.0 keeps these fields; they become Zod schema entries.
- **Drift detection** (`detectLabelDrift` in `core/skillStore.js`): v3.0's catalog-version drift detection (§8.4) is broader but the same idea.
- **Catalog metadata merge** (`services/entityResolver.js` resolveActiveEntity merging BUSINESS_DRIVERS + ENV_CATALOG): v3.0's catalog-versioned references (§6.1.3) handle this structurally.

### 6.4 Discard

- **`core/fieldManifest.js` legacy compat shims** in `core/manifest.js` (FIELD_MANIFEST, fieldsForTab, writableFieldsForTab, buildPreviewScope): added during v2.4.17 to keep callers working through the manifest swap. Discard at v3.0 — Zod-generated manifest replaces both old and new.
- **Hand-maintained validators** (`validateInstance`, `validateGap`, `validateActiveEntity` in `core/models.js`): replaced by Zod-derived validators in v3.0.
- **Per-tab tabId inference** in `migrateLegacySkill`: v3.0 stores skills with explicit scope/scopeKind; tabId becomes irrelevant.

---

## 7. Rollback path if v3.0 migration fails

The user explicitly stated: *"i might come back to this build if the migration failed."* This section is the safety net.

### 7.1 Snapshot the v2.4.17 work-in-progress before starting v3.0

```bash
cd C:/Users/Mahmo/Projects/dell-discovery
git tag v2.4.17-wip-snapshot 58660b7
git tag v2.4.16-baseline    5614f32
```

This creates two named anchors:
- `v2.4.17-wip-snapshot`: the current 14-commits-ahead state.
- `v2.4.16-baseline`: the last clean shipped state.

### 7.2 If v3.0 migration is started on a new branch

Recommended:

```bash
git checkout -b v3.0-data-architecture origin/main
# v3.0 work happens on this branch from v2.4.16 ship as base
```

This leaves the v2.4.17 work intact on `main` (locally, ahead of origin) and v3.0 work on a separate branch.

### 7.3 Rollback scenarios

**Scenario A: v3.0 fails early; abandon and return to v2.4.17 work-in-progress.**

```bash
git checkout main         # main still at 58660b7 (v2.4.17 WIP)
docker compose up -d --build --force-recreate
```

The v2.4.17 work is fully recoverable. Steps 11-13 of v2.4.17 can resume if desired, OR the v2.4.17 state can be tagged + pushed as a release on its own.

**Scenario B: v3.0 fails partway; merge useful v2.4.17 work in.**

If v3.0 work has produced partial results that don't pan out:

```bash
git checkout main
# v2.4.17 work is here, intact
# cherry-pick anything useful from v3.0-data-architecture branch
git cherry-pick <commit-from-v3>
```

**Scenario C: v3.0 succeeds; v2.4.17 WIP is no longer needed.**

The 14 v2.4.17 commits stay reachable through `v2.4.17-wip-snapshot` tag indefinitely (tags are not GC'd). They can also be pushed as a `v2.4.17-attempt` branch on the remote for archival:

```bash
git push origin v2.4.17-wip-snapshot:refs/heads/v2.4.17-archive-attempt
```

**Scenario D: v3.0 fails completely; ship v2.4.17 instead.**

The v2.4.17 work is structurally sound for what it covers (Steps 1-8 + click-to-scope). The remaining steps (UI rebuild, CARE runtime, discipline rules, badge UI) can be completed and tagged as v2.4.17. The `data-architecture-directive.md` becomes a future-roadmap artifact rather than the next release.

### 7.4 What CANNOT be rolled back

- **localStorage data** in any user's browser is independent of git. If a user opens v3.0 and saves an engagement, the `.canvas` file is in v3.0 shape. Reverting code to v2.4.17 + opening the v3.0 `.canvas` will fail validation (no v3.0 → v2.4.17 backward migrator exists or is planned).
- **Same applies to docker-image cache**: a Chrome browser pointed at `localhost:8080` may cache v3.0 assets. Hard-reload or incognito after rollback.

### 7.5 Pre-rollback safety checklist

Before starting v3.0:
- [ ] `git tag v2.4.17-wip-snapshot 58660b7` (locks the recovery point)
- [ ] `git tag v2.4.16-baseline 5614f32`
- [ ] `git status` clean
- [ ] Current container running v2.4.17 (`docker compose ps` shows healthy)
- [ ] `data-architecture-directive.md` committed to repo (so it's preserved with history)
- [ ] `HANDOVER_v2.4.17_to_v3.0.md` (this file) committed to repo
- [ ] `second_opinion_consultation.md` committed (the prompt that produced the directive)

---

## 8. Recommended approach for v3.0 migration

This section is advisory. The v3.0 spec writer makes the calls; this is what the v2.4.17 author would do given full knowledge of the build.

### 8.1 Sequence

1. **Schema layer first** (directive §2): introduce Zod, author entity schemas, generate validators + manifest. No behavioral change yet; pin with tests against the existing demo session round-tripping through the new schema.
2. **In-memory shape transform** (directive §4.1): introduce `{byId, allIds, indexes}` collections. The `.canvas` persistence shape stays a flat array list for v3.0 (per directive §4.2.1); only the runtime hydrates into indexed shape.
3. **Selectors layer** (directive §5): rewrite UI consumers to read from selectors. Retire per-view closures (this is what v2.4.17 §T-VW11 was supposed to do).
4. **Migrator** (directive §9.3): the v2.0 → v3.0 migrator. Round-trip fixture tests come first.
5. **Catalog versioning + Dell product taxonomy** (directive §6): introduce the catalogs with versions. Stamp the demo session's existing fields with the current versions.
6. **AI provenance wrapper** (directive §8): rewrap any pre-existing AI-authored fields. Wire structured-output LLM calls.
7. **Skill builder UI rebuild** (directive §7): the 2-step Intent panel + scope-aware chip palette + skill output rendering.
8. **Performance regression tests** (directive §11): pin the 200-instance reference engagement to the budget.

Each step has a green-test gate; nothing advances on red.

### 8.2 Tests-first per directive §14

The directive mandates real-execution-only testing with anti-cheat checks. The v2.4.17 test suite (770 tests) is mostly compliant with this — the tests use real session-singleton, real renderTemplate, real DOM render — but a few tests do stub localStorage. Audit the suite before lifting it forward.

### 8.3 Open questions to close in spec writing

The directive's §17 lists 7 open questions. Three of them have clear v2.4.17-build inputs:

- **Q5 (realistic upper-bound on instance count)**: the v2.4.17 demo session has ~30 instances. The 200-instance reference engagement in the directive is 7x the demo. Real Dell-customer sessions likely range 50-200 instances; pin the upper-bound formally with the product owner.
- **Q6 (skill template stability)**: v2.4.17's drift detection treats skills as user-owned and never auto-rewrites templates. The directive's §8.4.2 reaffirms this. The decision is "user owns the re-author flow"; the spec writer can document this and move on.
- **Q7 (customer record at backend migration)**: v2.4.17 has `customer` embedded; the directive embeds it for v3.0 too. At backend migration, customers will probably promote to their own table because the same customer recurs across engagements (per the user's domain knowledge). Decision needs domain validation.

The other 4 questions are pure spec-writer calls.

---

## 9. Memory + persistent context the v3.0 team needs

Memory files at `C:\Users\Mahmo\.claude\projects\C--Users-Mahmo-OneDrive-Documents-Claud-AI-PreSales-App\memory\` are human-curated direction the v3.0 team should preserve:

- `feedback_spec_and_test_first.md` — spec → tests → code → smoke discipline. The v3.0 directive embraces this; nothing changes.
- `feedback_no_push_without_approval.md` — only push on explicit "tag it" / "push" / "ship it." Carry forward.
- `feedback_browser_smoke_required.md` — every tag includes Chrome MCP smoke. Carry forward.
- `feedback_foundational_testing.md` — every data-model change ships demo + seed + demoSpec + DEMO_CHANGELOG. The directive's reference engagements + provenance fixtures embody this.
- `project_current_state.md` — needs replacement at v3.0 lock; the v2.4.17 spec-lock context becomes historical.
- `project_crown_jewel_design.md` — UI design intent; survives v3.0 unless directive supersedes specific items.
- `feedback_naming_standard.md` — AppName-vX.Y.Z artifact naming; carry forward.
- `feedback_test_what_to_test.md` — interaction-completeness over element-existence; carry forward.

Update `project_current_state.md` at v3.0 lock to reflect the new architecture.

---

## 10. Final notes for the v3.0 spec writer

1. **The user has cycled through several frustration loops in this session.** The v3.0 directive is the result of careful architectural review across two AI sessions plus user pushback that surfaced real problems (entity duplication in nested structures, catalog metadata not resolving in click-to-scope, plain-text response panel). Treat the directive as the user's signed-off architecture; resist the temptation to revisit storage-shape decisions during implementation.
2. **Performance budgets are CI-gated, not aspirational.** The directive §11 is unusual in this regard for a small app; honor it. The reference engagement is 200 instances; if production engagements scale beyond that, recalibrate before shipping.
3. **The "no patches" principle is load-bearing.** The user explicitly rejected v2.4.17's earlier patch-laden attempt before this session. Every addition must fit the data model rules. Transient flags on data, view-internal state, hardcoded selector lists are forbidden.
4. **Browser smoke is mandatory.** Tag protocol per `feedback_browser_smoke_required.md`: spec → code → smoke → pause for "tag it" → tag → push. Tests-pass-alone is necessary but not sufficient.
5. **The `.canvas` file format is the unit of import/export.** The directive §13.2.4 keeps this contract intact even when the backend lands. Don't break it.
6. **Two non-negotiables from v2.4.17 carry forward.** No patches; data-model integrity end-to-end. The directive's P1-P10 principles are the v3.0 expression of these.

---

## 11. Document control

- **Authored**: 2026-04-30 by the v2.4.17 in-progress build's author (Claude Opus 4.7 1M context, this session).
- **Audience**: v3.0 spec writer + implementation team.
- **Authority**: this is a status document, not a directive. The directive is `data-architecture-directive.md` (v3.0 architectural directive).
- **Versioning**: this document is the v2.4.17 → v3.0 handover snapshot. It does not get updated; if the v2.4.17 work resumes (rollback scenario A or D), a new document supersedes it.

End of handover.
