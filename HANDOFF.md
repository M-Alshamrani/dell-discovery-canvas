# Dell Discovery Canvas , Session Handoff

**Last session end**: 2026-04-29. **v2.4.16 SHIPPED to GitHub** (tag `v2.4.16` on `origin/main`). Foundations release: Bucket B1.5 items 1 (discipline reassertion), 4 (taxonomy + reporting derivation audit), and 2 (PillEditor investigation) — all SHIPPED in a clean spec → tests → code → smoke sequence. **NEXT UP**: v2.4.17 with Bucket B1.5 items 3 (theme + tag consistency app-wide) + 6 (right-panel utilization) + KD8 (gap-card asset-lifecycle visualization) + KD9 (PillEditor bare-pill UX clarity). v2.4.18 carries item 5 (crown-jewel reporting redesign + Executive summary sub-tab).

**Previously**: v2.4.15 SHIPPED 2026-04-29 (5 polish iters + 1 hotfix). Detail preserved below. Five polish iterations now absorbed: — Iter 1: dynamic envs + soft-delete + vendor mix segmented bar + modern FilterBar + capsule polish + footer + matrix. Iter 2 (Tier 1 + Tier 2): GPLC `.tag[data-t]` primitive, button-feedback states, AI provider Save fix, blue-dot → Lucide lock, hide-flow drops env column entirely + uses Overlay.js, FilterBar accordion with persistent collapse, vendor mix dimension picker + shimmer + click-to-cross-filter. Iter 3: Gaps filters consolidated into FilterBar (Layer/Env/Domain/Service/Urgency + Quick toggles for "Needs review only" / "Show closed gaps" + "+ Add gap" trailing CTA); Vendor mix Option A redesign (per-layer + per-env standing cards REPLACED with 3 click-to-drill KPI tiles — Dell density / Most diverse layer / Top non-Dell concentration — plus collapsible "All instances" table); AI Assist pick mode morphs overlay into a top-right heartbeat capsule (was full-transparent + separate pill), Esc restores; PICK_SELECTORS extended to include env-tile + service-tile (the v2.4.15 entities). 584 GREEN / 0 RED. **PUSHED to origin/main + tag v2.4.15**. v2.4.14 is the previous tag (now superseded).

**File purpose**: anyone (human or a fresh Claude Code session) opening this folder should read this file first to know exactly where work stopped, what's shipped, what's queued, and how to pick up.

---

## 1 · Where you are

- `git log --oneline main` , HEAD on `c0c6d77` (Spec . v2.4.15 . LOCKED 2026-04-27 . dynamic envs + UX polish bundle). **This commit is LOCAL ONLY**, ahead of `origin/main` by 1. Per `feedback_no_push_without_approval.md` the spec stays local until user explicitly says "push."
- `origin/main` HEAD on `dd6974b` (v2.4.14 . post-tag handoff updates).
- `git tag --list 'v2.*' | sort -V` , 25 tags: `v2.1.1` through `v2.4.14` (plus `v2.4.11.d01` + `v2.4.11.d02` hygiene-pass records on origin only). v2.4.14 is the latest tag.
- Working tree: clean.
- GitHub: https://github.com/M-Alshamrani/dell-discovery-canvas (private).

## 2 · What is shipped

Full chronology and commit refs live in `.claude/projects/.../memory/project_current_state.md`. One-line summary per tag:

| Tag | Phase | What it delivered |
|---|---|---|
| v2.1.x | 0-14 baseline + reviewer handoff | 5-tab discovery canvas, ~348 assertions |
| v2.2.0 | 15 Docker | nginx:alpine multi-arch, port 8080, CSP headers |
| v2.2.1 | 15.1 LAN auth | env-driven HTTP Basic auth |
| v2.2.2 | 15.2 Dell tokens | Dell palette + Inter typography |
| v2.2.3 | 15.3 visual depth | tighter radii + heading tracking + mono metrics |
| v2.3.0 | 18 Gap-link UX | always-visible + warn-but-allow + roadmap dedup |
| v2.3.1 | 16 Workload Mapping | 6th layer + N-to-N + upward propagation |
| v2.4.0 | 19a AI foundations | 3-provider client, gear settings modal |
| v2.4.1 | 19b Skill Builder | admin panel + per-tab dropdown + seed skill |
| v2.4.2 | 19c Field-pointer | bindable-field chips + JSON coercion + test-skill |
| v2.4.2.1 | 19c.1 Pill editor | contenteditable editor with binding pills |
| v2.4.3 | 19d.1 Prompt guards | text-brief footer + Refine-to-CARE + save gate |
| v2.4.4 | 19d Unified AI platform | SPEC §12 + responseFormat/applyPolicy + writable resolvers + undo + per-skill provider |
| v2.4.5 | 19e Foundations Refresh | session-changed bus + persistent undo + demoSession module + 6 seed skills + demoSpec (DS1-DS17) + DEMO_CHANGELOG |
| v2.4.5.1 | 19f AI reliability | Anthropic browser-direct header + retry-with-backoff on 429/5xx + per-provider fallback-model chain (Suite 36 RB1-RB7) |
| v2.4.6 | 19g UX quick-wins | app version surface + per-tab skill chip + save gate + banner auto-dismiss |
| v2.4.7 | 19h Fresh-start UX | empty-canvas default + welcome card with Load-demo CTA |
| v2.4.8 | 17 Phase 17 | 7-term Action taxonomy + link rules + rationalize coercion |
| v2.4.9 | 19i Primary-layer + projectId | invariant + explicit Gap→Project relationship (pre-crown-jewel rollback anchor) |
| v2.4.10 | 19j Save/open file | user-owned `.canvas` workbook + PWA file_handlers + Clear-all hardening |
| v2.4.10.1 | 19j.1 HOTFIX | test-runner localStorage isolation (fixes "Bus Co" pollution) |
| v2.4.11 | 19k Rules hardening | review-time enforcement + closed-vs-deleted + visible auto-behaviour + Operational/Services clarity + 3 in-flight bug fixes caught by browser smoke |
| v2.4.12 | 19l Services scope + PR/U + post-smoke hot-patches | `gap.services[]` field + 10-entry `SERVICE_TYPES` catalog + Tab 4 multi-chip selector with "+ Add service" picker (full catalog) + Tab 5.5 project-card chip row + NEW Reporting "Services scope" sub-tab + PR1 ContextView no-op Save preserves `isDemo` + PR2 skillsEvents bus + AI dropdown auto-refresh + U1 removal of D2 ops-gap CTA + M11 migrator backfill + closed-gap rollup exclusion + Reporting Gaps Board side-panel services + Roadmap chip pill CSS. Suite 43 SVC1-15 + DS23 (22 new tests). Total 531/531. |
| v2.4.13 | 19m Intermediate UX/UI patches | DS1 tokens + DS2 eyebrow + DS5 dash-bullet + A1 em-dash sweep + A2 Dell product accuracy + CD5 services domain + DS24 demo coverage + GPLC topbar foundation + leading-zero stepper + local Dell logo. S0-S8 + S2A: services-scope sub-tab dropped, app-version chip to footer pill, global AI Assist top-right button with Dell-blue "polished glass with quiet glint" pulse, topbar session strip with workshop name + colored save indicator, NEW Overlay.js centered modal with persist + transparent modes, AiAssistOverlay tile-grid skill picker, DemoBanner shared helper on every view, Chrome-style discrete tab-card stepper, MatrixView + SummaryHealthView L.0X / E.0X corner-code headers, brand-blue ratio ~8-10%, Dell-blue-tinted page bg. Six polish iterations: AI Assist luxury glow, settings+Skills overlay match with in-place section swap, pick-mode breathe with floating Dell-blue pill, test-connection probe bar, AI thinking orb, Dell Sales Chat as 4th provider, matrix + heatmap row-band rhythm. Total 545/12/557. |
| **v2.4.14** | **19m Hygiene + polish + filter system + Lucide + env aliases** | **(1) Test cleanup: deleted 10 obsolete Suite 44 RED tests (drawer module + per-entity AI mount + tag-primitive migration) + Drawer.js stub since drawer-everywhere is parked. (2) Heading case sweep (A3): Architecture Heatmap → Architecture heatmap, etc. Strategic Drivers retained as customer brand convention. (3) Brand-alias sweep (CD1): 147 mechanical replacements var(--brand) → var(--dell-blue) in styles.css, visual outcome unchanged. (4) Gap-card domain hue bars (CD3): pickGapDomain helper + 2px muted-hue ::before on .gap-card[data-domain] mirrors the matrix-layer-bar pattern. (5) Tabular-nums utility (DS8): .metric class + inline on count surfaces. (6) Cmd+K / Ctrl+K shortcut for AI Assist. (7) Browser tab title unsaved indicator: "• Dell Discovery Canvas" while saving. (8) Environment aliases (NEW per user direction): session.environmentAliases + getEnvLabel(envId, session) helper + Tab 1 Environments card with 4 inputs. Every site that rendered env.label now uses the helper (MatrixView + SummaryHealthView + GapsEditView). (9) Filter system (F1-F6 services dimension): NEW state/filterState.js pub/sub with localStorage persistence; chip strip on Tab 4 with 10 services chips; CSS dim rule body[data-filter-services] .gap-card:not(.filter-match-services) → opacity 0.22 grayscale. VT17 + VT18 GREEN. (10) Lucide SVG icon migration: ui/icons.js extended with undo/undoAll/refresh/download/upload/plus/trash/x; index.html undo chips + footer Save/Open/Demo/New/Clear all use inline SVG instead of emoji glyphs. Total 547/0/547 (banner now auto-dismisses on every load).** |

**Test count**: 547 assertions GREEN, 0 RED across 45 suites in `diagnostics/appSpec.js` + `diagnostics/demoSpec.js`. Banner auto-dismisses after 5s on every page load.

## 3 · What closed in v2.4.5 + v2.4.5.1

All six UX issues from v2.4.4 are resolved, and the two reliability failure modes the user hit in live Gemini / Anthropic use are fixed:

- v2.4.5 · session-changed bus → driver tile no longer vanishes on AI apply; tab no longer blanks after undo.
- v2.4.5 · undo chip tooltip + depth badge + "↶↶ Undo all" chip.
- v2.4.5 · undo persisted to `localStorage` (`ai_undo_v1`, cap 10, cleared on reset).
- v2.4.5 · demo session refreshed (Phase 16 workload + Phase 18 multi-link + driverId on every gap); extracted to `state/demoSession.js` with 3 personas.
- v2.4.5 · seed skill library of 6 (json-scalars exercising writable fields on 4 tabs); deployed by default.
- v2.4.5 · `diagnostics/demoSpec.js` Suites 31-35 (DS1-DS17) + `docs/DEMO_CHANGELOG.md` audit trail.
- v2.4.5.1 · Anthropic `anthropic-dangerous-direct-browser-access: true` header fixes the 401 loop.
- v2.4.5.1 · retry-with-backoff on 429/5xx (3 attempts, 500ms→4s with full jitter).
- v2.4.5.1 · per-provider `fallbackModels[]` chain (Gemini defaults to `gemini-2.0-flash, gemini-1.5-flash`).
- v2.4.5.1 · Settings UI exposes the fallback chain; `Test connection` reports which model answered.

## 4 · NEXT UP — Bucket A2 · v2.4.6 Action-command skills

Scope locked in `SPEC.md §12.6`. Runtime for the `json-commands` response format already declared in the skill schema but stub-rejected today. One disciplined slice:

1. NEW `core/actionCommands.js` — whitelist of ops: `updateField`, `updateGap`, `createGap`, `deleteGap`, `linkInstance`, `setGapDriver`. Each op routes to an existing function in `interactions/*Commands.js` (no business-logic duplication).
2. Extend `interactions/aiCommands.js parseCommands(responseText)` — parse `{ commands: [...] }` shape, validate each op against the whitelist, reject unknown ops at parse time (not at apply time).
3. `applyCommands(commands, ctx)` — batches under one undo snapshot, emits `session-changed` once per batch (reason `"ai-apply"` as usual).
4. Wire `skillEngine.js` · when `responseFormat === "json-commands"`, call parser instead of `parseProposals`. `UseAiButton.js` renders a distinct "N actions proposed" panel (reuse the `applyPolicy` dispatch).
5. Remove the v2.4.4 stub that rejects json-commands outright.
6. Test vectors — Suite 37 · AC1-AC10 covering: parser rejects unknown op; each op mutates correctly; invalid args throw with a readable message; batch + undo is byte-identical; skillEngine integration returns `result.commands[]`.
7. Per `feedback_foundational_testing.md`: add at least one seed skill in `core/seedSkills.js` that uses `json-commands` (e.g., "Link these two gaps to their desired tiles" on the Gaps tab); refresh demo session if any new field is needed; update `docs/DEMO_CHANGELOG.md`.

Estimated scope: ~3 hr. Fresh session can execute directly.

## 5 · Full backlog (after v2.4.6)

Ordered for logical progression. Each bucket has locked scope in memory or SPEC.

### Bucket A — finish AI platform
- ✅ A1. v2.4.5 Foundations Refresh (shipped).
- ✅ A1.1. v2.4.5.1 AI reliability (shipped).
- ✅ A2. v2.4.6 UX quick-wins (shipped 2026-04-24).
- ✅ A2.1. v2.4.7 Fresh-start UX (shipped 2026-04-24).
- ✅ A2.2. v2.4.8 Phase 17 taxonomy (shipped 2026-04-24).
- ✅ A2.3. v2.4.9 Primary-layer + Gap→Project data model · pre-crown-jewel rollback anchor (shipped 2026-04-24).
- ✅ A2.4. v2.4.10 User-owned save/open .canvas file (shipped 2026-04-24).
- ✅ A2.5. v2.4.10.1 HOTFIX · test-runner localStorage isolation (shipped 2026-04-25).
- ✅ A3. v2.4.11 Rules hardening + Q1-Q4 fixes (shipped 2026-04-25). 21 spec items + 3 browser-smoke-discovered bugs (urgency-lock silently failed because metadata patches re-validated links · demo g-004 was mis-typed Replace with 2 currents · Save button had no dynamic feedback). 509 tests green; verified live in browser before commit per `feedback_browser_smoke_required.md`.
- ✅ **A4. v2.4.12 Services scope + PR1/PR2/U1 + P1-P3 hot-patches — IMPLEMENTED 2026-04-26.** Full spec in `docs/CHANGELOG_PLAN.md § v2.4.12`. Section S (services): `gap.services[]` field + 10-entry `SERVICE_TYPES` catalog + Tab 4 gap-detail multi-chip + Tab 5.5 project-card chip row + NEW Reporting "Services scope" sub-tab. Section PR: PR1 ContextView no-op Save no longer flips `isDemo`, PR2 skillStore CRUD emits `skills-changed`. Section U: U1 removed the v2.4.11 D2 `+ Add operational / services gap` CTA. **Hot-patches P1-P3** (folded in pre-tag after user smoke): P1 `+ Add service` picker exposes the full catalog (was: only suggested were addable), P2 integrity sweep (M11 migrator backfill + .canvas normalize + closed-gap rollup + apply/undo round-trip), P3 SummaryGapsView side-panel services chip row + Roadmap project-card chip CSS. Tests: Suite 43 SVC1-15 + PR1.a/b + PR2.a/b/c + U1 + DS23. **Issues #3/#5/#6 from user smoke deferred to v2.5.0** (sub-tab visual polish, cross-tab filters, side-panel-as-drawer dynamic UX) — see Bucket B below.
- **A4.1. v2.4.13 Demo refresh + old-schema purge + per-tab demo banner audit — DEFERRED from v2.4.12 attempt 2026-04-26.** Three items the user chose to defer: (a) demo `g-001` Phase 17 violation (`gapType: replace` with 2 desireds; same shape that was retyped on `g-004` in v2.4.11), (b) localStorage-pollution causing app to default to demo on initial open in user's browser (clean colleagues see fresh-start UX correctly), (c) per-tab demo banner audit — Tab 1 has `.demo-mode-banner` element; Tabs 2-5 do NOT. User did not catch (c) on v2.4.11 so it's gentle; (a) and (b) need a concerted demo refresh that purges any localStorage demo data created under older schemas and rebuilds demos against the v2.4.12+ data model. Opportunity to re-validate every demo gap against current taxonomy + invariants. Effort: ~3 hr.
- **A5. v2.6.0 Action-command skills** — runtime for `json-commands` response format. Was originally v2.4.6; deferred so UX + crown-jewel land first.

### NEW Bucket B0 · v2.4.13 + v2.4.14 intermediate UX/UI patches · SHIPPED 2026-04-27

v2.4.13 tagged + pushed (eight spec sections + six polish iterations). v2.4.14 tagged + pushed (hygiene + polish + filter system + Lucide + env aliases). Test surface 547/0/547. Drawer-everywhere parked per user direction; v2.5.0 reduced scope folded into v2.4.14 wherever it didn't depend on drawers.

### Bucket B1 · v2.4.15 NEXT UP · dynamic envs + UX polish bundle (spec LOCKED locally, awaiting sign-off)

User reviewed v2.4.14 ship + raised 9 follow-up items (env model + vendor bar + filter UI + 4 polish tweaks). I scoped them into a single v2.4.15 release because the env model is foundational + the polish items touch the same render surfaces. Full spec committed locally at `c0c6d77` in `docs/CHANGELOG_PLAN.md § v2.4.15` (NOT pushed; per the no-push-without-approval rule).

**Sections:**
- §1 Dynamic environment model (DE1-DE9): catalog of 8 env types (Main / DR / Vault NEW / Public / Edge / Co-lo NEW / Hosted MSP NEW / Sovereign NEW), `session.environments[]` schema with per-env metadata (alias, location, sizeKw, sqm, tier, notes), migrator drains v2.4.14 `environmentAliases`, Tab 1 Environments card rebuilt as managed list, every render-site swap from `ENVIRONMENTS` constant to `getActiveEnvironments(session)`.
- §2 Vendor mix segmented bar (VB1-VB3): one horizontal stacked bar per dimension; replaces multi-card SummaryVendorView.
- §3 Modern collapsible filter bar (FB1-FB6): NEW `ui/components/FilterBar.js`; "Filters . N active" button + collapsible panel + active-pill strip above kanban.
- §4 Session capsule polish (SC1-SC2): `building-2` icon (was briefcase / shopping-bag); "Updated HH:MM" timestamp segment.
- §5 Footer alignment (FT1): right-align hint with `\|` divider before version capsule.
- §6 Matrix tweaks (MT1-MT3): 3px column-gap, invisible corner cell, Load demo icon -> `play-circle`.

**Tests:** Suite 46 with DE1-DE10 + VB1-VB3 + FB1-FB6 (RED first per spec-and-test-first protocol).

**6 open decisions awaiting user sign-off** (asked at end of last session; user paused for handoff before answering):
1. **Catalog list** , 8 entries OK as-is, or drop / add types? My picks: Main, Secondary/DR, Vault/3rd site (NEW), Public Cloud, Edge/Remote, Co-location (NEW), Hosted/MSP (NEW), Sovereign Cloud (NEW). Possible additions user might want: "Workplace / VDI" or "Network edge / 5G MEC."
2. **Default-enabled set** , the original 4 (Main / DR / Public / Edge). Existing sessions auto-enable whatever envs their data references. OK?
3. **Per-env metadata fields** , alias / location / sizeKw / sqm / tier / notes. Drop / add anything?
4. **Removing an env that has instances** , my plan: warn user "5 instances tied to this env; removing hides them but keeps them in the saved file." Confirm = remove. OK approach, or hard block?
5. **Demo metadata** , Riyadh DC . 5 MW . Tier III, Jeddah DR . 2 MW . Tier II, AWS me-south-1, Branch sites x14. Different cities / specs / vertical mix?
6. **Filter dimensions for v2.4.15 FilterBar** , only services dimension wired through to body data attribute + CSS dim rule (matches v2.4.14). Layer/Domain/Urgency render in panel but don't dim cards yet. OK to ship that way, or wire all 4 now?

Effort: ~14 hours, single tag, ~2 focused days.

### Bucket B1.5 · v2.4.16 user feedback backlog (CAPTURED 2026-04-29 · MUST READ before scoping next release)

User raised the following items in the iter-5 review. **They are not in v2.4.15** — captured here so the next release scopes them deliberately. Listed in the user's own ordering:

1. **Spec + tests discipline drift** · "testing cases and specifications documents don't seem to be updated and keep up to date with what we have been doing." This is a `feedback_spec_and_test_first.md` violation observed across iter-2 → iter-5. The user wants spec-and-test-first **enforced at the top of every iteration**, not as a backfill. Action for next release: mandate the pre-flight checklist (`SPEC.md §9` block + `RULES.md` updates + `Suite N` red tests committed BEFORE code; checklist box ticked at tag time). Hygiene-pass `.dNN` after v2.4.15 ships should audit the v2.4.15 polish iter-2 → iter-5 SPEC §9 coverage and pay back the gap.

2. **AI builder rendering bug** · "I see some data capsules when I click on it spits half text half capsule in the builder textbox." Pill-editor regression — clicking a binding pill in the prompt template doesn't transform cleanly; the half-text/half-pill state implies a malformed contenteditable replacement. Reproduce via Skill Builder → click any field-pointer pill in the template box. Likely culprit: `ui/components/PillEditor.js` selection range handling when the pill is at a word boundary. Logged for v2.4.16 investigation.

3. **Tag + right-panel theme inconsistency app-wide** · "the right panel of the gaps tab is not consistent with the rest of the app theme. Tags also on the tiles and in the main tabs are old style — they need to match what we did for the env styling." Concretely: gap-card tags (`.urgency-badge`, `.gap-card-meta`, etc.), MatrixView tile pills, ReportingView chips all still use pre-iter-3 chip / badge / pill classes. Migrate to the GPLC `.tag[data-t="…"]` primitive everywhere. Right-panel detail across MatrixView / GapsEditView / SummaryHealthView / SummaryRoadmapView / SkillAdmin migrates to the `.detail-panel-v2` shape used today on the env detail. **Single coherent pass** — sprinkling causes drift.

4. **Data taxonomy + relationships catalog** · "Data taxonomy, relationships, integrity, structure hierarchy, labeling — needs end-to-end catalog and validation. Reporting may be reporting wrong figures because of misconfigurations or undefined links. The definition table for the gaps how they link has to be validated, for example we need one disposition from 'as-is' and nothing when we do retire." User wants:
   - A human-readable **relationships table** (probably `docs/RULES.md §X` or a new `docs/TAXONOMY.md`) showing every entity, every link, every cardinality, every disposition rule per gap type, every "what triggers what" relationship.
   - End-to-end validation that what reporting shows matches the underlying counts. Likely an audit of `services/healthMetrics.js`, `services/gapsService.js`, `services/vendorMixService.js`, `services/roadmapService.js` against the live demo session to catch off-by-one / wrong-grouping bugs.
   - Specific ask: per-gapType disposition rules table (replace = 1 from + 1 to; retire = 1 from + 0 to; consolidate = N from + 1 to; ops = 0 + 0; enhance = 1 + same; newCap = 0 + N). Validate each in code.

5. **Crown-jewel reporting redesign (vendor mix + heatmap)** · already captured in iter-3 as items 4 + 7. The user reaffirms: "the reporting that we have not done yet has to be redesigned to provide tangible value, in both vendors mix and heatmap." Plan was Option A KPI tiles for vendor mix + new "Executive summary" sub-tab. **v2.4.16 still owns this.**

6. **Right-panel utilization optimization** · "Use of the right panel has to be optimized and utilized to provide most value for the user." Tied to item 3 (the unified detail-panel-v2). Each tab's right-panel default state should pull its weight: stats / next-best-action prompts / quick-add CTAs when nothing is selected, not just an empty placeholder.

7. **Single-site preset bug** · FIXED in iter-5 hotfix (commit cd15b53). Materialization fired at click time fixed the empty-`session.environments[]` early-return.

### Bucket B2 · v2.4.16 printable workshop report · QUEUED after v2.4.15

Continuous-page HTML/PDF deliverable for Dell exec audiences. Was originally v2.4.15 in the previous session's plan; reordered because the env model needs to land first so the report can show city-named DCs + metadata ("Riyadh DC . 5 MW . Tier III"). Browser-print-to-PDF via `@media print`. Sections: cover -> drivers -> matrix -> pipeline -> per-project -> exec summary. Visual language matches canvas. Effort: 6-8 hours.

### Bucket B3 · v2.4.17 demo refresh · QUEUED after v2.4.16

Per user direction 2026-04-27: demo content that wows Dell executives without sounding salesy or naive. Real Dell product names, drivers->pain->Dell-tech mapping, realistic-but-tangible coverage. Sequenced AFTER report so the showcase can demo report + env metadata + filters + Cmd+K together. ~3 hours.

### Bucket B4 · v2.4.18 Dell Sales Chat backend · QUEUED for when API info arrives

User to provide Dell Sales Chat API endpoint URL + auth model in coming weeks. Until then: provider entry shipped in v2.4.13 (user-pastes-URL pattern). When credentials arrive, wire `/api/llm/dell-sales-chat` proxy via nginx + update SettingsModal hint copy. ~1 hour.

### v2.5.0 (parked indefinitely)

Drawer-everywhere + universal detail panel + remaining tag-vocab migration parked per user 2026-04-27. The right-panel detail model stays. May revisit if a real friction surfaces.

**Locked decisions** (do NOT re-litigate during implementation):

- §0 Drop the Reporting "Services scope" sub-tab entirely. Services info already on gap and project drawers; sub-tab adds a navigation step without earning value.
- §1 Move app-version chip from header to footer as a small mono caps capsule. Top bar reserved for functional/interactive elements; metadata in footer.
- §2 NEW global "AI Assist" top-right button replaces the existing per-driver `useAiButton` mounting. Single source of truth, more discoverable. Solid Dell-blue accent so it reads as the visible primary action in the topbar.
- §3 NEW `ui/components/Overlay.js` component. Centered modal at `~min(720px, 90vw) wide × min(640px, 80vh) tall`. Backdrop blur. Sticky head + scrollable body + sticky footer. Backdrop / Escape / X all close. Used by AI Assist immediately; v2.5.0 reuses for "+ Add" flows.
- §4 AI Assist click opens overlay with context-aware skill list (filtered by `currentStep`), prompt preview, in-place result panel.
- §5 Demo banner renders on all 5 tabs (Tab 1, 2, 3, 4, 5 plus each Reporting sub-tab) when `session.isDemo === true`. Currently only Tab 1. Existing colorful styling kept; user explicitly likes it.
- §6 Stepper clickability cues: hover background + `.step-num` color shift to Dell-blue + bigger labels (Fitts's Law) + active step gets a `▸` chevron prefix or 3px Dell-blue left mark + bolder weights so "you are here" reads clearly.
- §7 Layer-name visual treatment in MatrixView (Tabs 2 + 3): bump 11px ink-mute to 14px ink 600, add 4×100% color-coded left bar per layer (signal palette: workload neutral, compute amber, storage amber, network green, dataProtection red, virtualization Dell-blue), mono caps eyebrow above each layer block.
- §8 Brand-blue ratio calibrated 3% to 8-10%. Specific accent moves on active stepper, primary CTAs, hover states, filter-chip active, card-hover left bars, eyebrow rules.
- One open clarification deferred to next session: user message ended "the top bar becomes for functional things. we might need to" (sentence cut off). Spec proceeds without the missing piece; flag for next-session pickup.

**Tests**: Suite 45 VT21-VT28 (RED first; covers services-tab removed, version in footer, AI button in topbar, Overlay module, AI overlay open, demo banner all-tabs, stepper hover, layer-name treatment).

**Effort**: ~2 days, single tag.

### Bucket B · Crown-jewel UI rework (v2.5.0 + v2.5.1) · REDUCED SCOPE 2026-04-27

Joint spec in `docs/CHANGELOG_PLAN.md § v2.5.0` (LOCKED 2026-04-26) plus the philosophy alignment from the Dell Advisory Design System document the user provided 2026-04-26 plus the GPLC reference HTML at `C:/Users/Mahmo/Downloads/GPLC Digital Unified Platform v1.0.html`. Carried forward decisions from `project_crown_jewel_design.md` and `project_deferred_design_review.md`.

**v2.5.0, LOCKED 2026-04-26 (revised after user feedback)** (next session, ~4 days, single tag):
- **§0** Pre-flight audit pass: em-dash sweep, Dell product accuracy (g-003 VxRail, no Boomi, no Secureworks / Taegis post-2025, SmartFabric Director → Manager, CloudIQ under APEX AIOps, VMware as partner not Dell), heading case (Title → sentence), default classification, topbar action audit, anti-pattern sweep on `styles.css`.
- **§1** Design system foundation (DS1-DS8): tokens (4-tier ink, 3-tier surface, hairline scale, signal palette, hover-only shadows), eyebrow utility, ONE `.tag` primitive with `data-variant`, hairline section, card pattern, callout block (red / blue / green / amber 3px-left-border), shared band, mono tabular-nums.
- **§2** Topbar + footer (TB1-TB6): white topbar replacing blue gradient; **local Dell logo** (current asset, no CDN dependency, offline-safe); mono uppercase doc-meta strip; no Export PDF / Share; footer 2px Dell-blue top border with 3-col grid; stepper restyle to `01 02 03 04 05` mono leading-zero.
- **§3** Color discipline (CD1-CD5): brand-blue surface area target ~5% (was ~30%); layered signal mapping (urgency level as chip color, domain as left-bar accent); single primary CTA per surface; everything else ghost / neutral.
- **§4** Detail panel restructure (DP1-DP10): research-grounded universal template covering all five entity types (gap, current tile, desired tile, project, service, driver). Sticky head with mono crumbs + sentence-case h3 + lede; STATUS STRIP signal chips; KEY ATTRIBUTES tech-grid 2-col mini-cards (Miller chunk); hairline-divided sections each with mono caps blue eyebrow; 6×2px Dell-blue dash bullets; sections render only when relevant data exists (Hick's Law); first-field auto-focus on add-mode; sticky footer with primary CTA bottom-right (Fitts's Law); callout integration for review-needed + AI-applied + closed + auto-driver notices.
- **§5** Drawer pattern (DR1-DR9), **drawer-everywhere on Tabs 1-5** (was Tab 5 only): NEW `ui/components/Drawer.js` module; click any entity (driver, current tile, desired tile, gap, project, service) opens the drawer slide-in from right at 560px width; backdrop + Escape + ✕ close paths; content-swap on different-card-click; add-new-entity flow with auto-focused first field; left panel takes the FULL viewport width on every tab (free-win extra real estate for kanban / matrix / context form / sub-tabs).
- **§AI** AI assist mounting (AI1-AI5), **pulled forward from v2.5.1 U4**: every entity drawer body has an AI ASSIST section as the last body section (predictable location, recognition over recall). `useAiButton` mounted in driver / current-tile / desired-tile / gap / project / service drawers, each filtered to the relevant tab's seed-skill list.
- **§6** Cross-tab filter system (F1-F6): body data-attribute pattern; multi-chip selectors on Tab 4 + Reporting Gaps Board for layer / gapType / services / environment / driver; non-matching items dim to opacity 0.18-0.30 + grayscale(.5); match-mode toggle (default OR); persistence to `localStorage`.
- **§7** Services scope sub-tab redesign (SR1-SR4): replace primitive table with hero summary card + per-service grid cards + drawer click-to-detail + concentration-risk callouts.
- **§8** Tag vocabulary migration (TV1-TV9): all 11+ chip / badge / pill classes consolidated to `.tag[data-variant=...]`.
- **§9** Tests (Suite 44 VT1-VT20 + DS24): token presence, eyebrow utility, single tag primitive, drawer module, content-swap, AI mount on every entity, filter behaviors, dash bullet, em-dash absence, services-scope cards.
- **§R** Regression guards: v2.4.12 R1-R10 stay green; new R1-R18 cover drawer-everywhere + AI mount + edit-by-default + Dell product accuracy + color audit + em-dash sweep.
- **Hard rules baked in**: no em dashes anywhere; sentence case headings; **local Dell logo** (no CDN); hover-only shadows; ONE `.tag` primitive; **drawer-everywhere on Tabs 1-5** (the full GPLC interaction model, not hybrid); AI ASSIST on every entity drawer; layered signal colors; **edit-by-default stays** (no view/edit toggle, ever).

**v2.5.1, queued after v2.5.0 sign-off, scope reduced 2026-04-26** (~1.5 days, separate tag):
- **VC** Vocabulary unification across Gaps (Tab 4) and Roadmap (Tab 5.5).
- **GV** Visible Gap → Project relationship affordances ("trace this gap to its project", "show me the gaps in this project").
- **PL** Primary-layer semantics rework (`gap.layerId` vs `affectedLayers[]`). Data model touchpoint, explicit spec round before code.
- **IC** SVG icon system (Lucide library); replace all emoji with stroke icons at uniform 16 / 20 / 24px sizes.

Pulled into v2.5.0 from the original v2.5.1 list: U4 (AI button placement on Tabs 2-5), drawer-everywhere (was hybrid Tab 5 only), edit-side panel polish (absorbed into §4 universal template). Explicitly NOT added to v2.5.1: view/edit-mode toggle (locked closed per user decision 2026-04-26).

**v2.4.9 remains the pre-crown-jewel rollback anchor**. v2.4.12 is now the safe state; if v2.5.0 sideways, roll to v2.4.12.

### Bucket C — Was user-gated, now done
- ✅ C1. Phase 17 Taxonomy unification — shipped as v2.4.8 (2026-04-24, sign-off in hand).

### Bucket D — Deployment
- **D1.** GB10 (or any linux/arm64 host) **multi-arch verification** — the image is multi-arch-tagged but nobody has built/run it on real ARM64 hardware. Recipe in `project_current_state.md § Pending GB10 verification`.

### Bucket E — v3 multi-user
- **E1.** Backend server (Node/Express or FastAPI) + DB (SQLite → Postgres) + JWT auth + RBAC (presales/manager/director/admin) + analytics + WAF. Separate architecture doc required (`SPEC_v3.md`). AI API keys move server-side from browser localStorage. 2-4 weeks of focused work.

## 6 · How to resume (for the fresh session)

Read these files **in this order**:

1. **This file** (`HANDOFF.md`) — you're here.
2. `.claude/projects/C--Users-Mahmo-OneDrive-Documents-Claud-AI-PreSales-App/memory/MEMORY.md` — the full memory index.
3. `.claude/projects/.../memory/project_current_state.md` — exhaustive shipped-state + commit refs.
4. `.claude/projects/.../memory/feedback_foundational_testing.md` — **the rule that governs every data-model change**.
5. `.claude/projects/.../memory/project_deferred_design_review.md` — crown-jewel scope.
6. `SPEC.md § 12` — the AI Platform Specification (including §12.4a reliability contract + §12.5a sessionEvents bus + §12.8 invariants).
7. `docs/CHANGELOG_PLAN.md` — latest entries at top: v2.4.12 (services scope, NEXT UP), v2.4.11 IMPLEMENTED (rules hardening), v2.4.10.1 hotfix, v2.4.10 save/open file, v2.4.9 rollback anchor.
8. `docs/RULES.md` — **rules-as-built audit (post-v2.4.11)**. Must read before any rule change. 12 sections, ~90 numbered rules tagged 🔴 HARD / 🟡 SOFT / 🔵 AUTO / 📦 MIGRATE, plus a "v2.4.11 UI surfaces" map.
9. `docs/DEMO_CHANGELOG.md` — demo + seed surface audit trail (read before touching `state/demoSession.js` or `core/seedSkills.js`).
10. **Memory `feedback_browser_smoke_required.md`** — locked discipline since v2.4.11: every tag MUST include a manual browser smoke against the verification spec BEFORE commit. Tests pass alone is NOT enough — three v2.4.11 bugs (urgency lock, demo g-004 type, save feedback) only surfaced via browser smoke.

Then verify the build works locally:

```bash
cd C:/Users/Mahmo/Projects/dell-discovery
docker compose up -d --build   # image cached ~75MB; should start in <10s
curl http://localhost:8080/health   # → ok
# Open http://localhost:8080 in incognito → confirm green banner (~416 assertions)
```

Then ask the user to confirm the starting point and which bucket to tackle first. **Default next work as of 2026-04-25: v2.4.12 Services scope** — the spec is locked in `docs/CHANGELOG_PLAN.md § v2.4.12`, files to touch are named, two-surface treatment included. Execute on the spec without re-deriving.

**TAG PROTOCOL (mandatory since v2.4.10.1 — written into `feedback_browser_smoke_required.md`)**:

1. Spec committed BEFORE code (locked in `docs/CHANGELOG_PLAN.md`).
2. Code execution as one coherent pass.
3. **Manual browser smoke** against the verification spec via Chrome MCP (`mcp__Claude_in_Chrome__navigate` + `javascript_tool` to simulate real user actions and inspect resulting DOM/state). Every "what you'll see" bullet checked in the live app, results reported back to user.
4. **PAUSE for explicit "tag it" approval.** No tag without it.
5. Tag, push, update memory + HANDOFF.

The browser smoke is non-negotiable: v2.4.11's three pre-tag bug fixes (urgency lock, demo g-004 type, save feedback) all came from browser smoke catching things the green test banner missed.

## 7 · A suggested opening prompt for the fresh session

Paste this verbatim (or adapt) as your first message in the new session:

> Resume work on the Dell Discovery Canvas project at `C:\Users\Mahmo\Projects\dell-discovery\`. Read, in this exact order, before proposing anything:
>
> 1. `HANDOFF.md` (this folder).
> 2. The memory index `.claude/projects/.../memory/MEMORY.md` , then specifically `feedback_no_push_without_approval.md`, `feedback_browser_smoke_required.md`, `feedback_spec_and_test_first.md`, `feedback_foundational_testing.md`, `project_current_state.md`.
> 3. `docs/CHANGELOG_PLAN.md § v2.4.15` (the spec entry that's already drafted + locked).
>
> Quick state on resume:
> - **Latest tag**: `v2.4.15` on `origin/main` (584 GREEN, 0 RED, 584 total).
> - **Local-only commit** ahead of origin: `c0c6d77` (Spec . v2.4.15 . LOCKED). Do NOT push it on your own; user holds the push trigger per the no-push-without-approval rule.
> - **v2.4.15 spec is locked but implementation has not started** , awaiting user sign-off on 6 spec decisions (catalog list, default-enabled set, metadata fields, env-removal behaviour, demo metadata, filter dimensions wired in this release). The 6 questions are listed verbatim in HANDOFF.md § Bucket B1.
> - **Drawer-everywhere is parked** indefinitely. Right-panel detail model stays.
>
> Before doing any work, confirm back:
> 1. Current HEAD (should be `c0c6d77` local; `dd6974b` on origin) and that the local-only spec commit is intact.
> 2. The 6 open spec decisions awaiting sign-off (read them out so user can answer in order).
> 3. Whether `docker compose up -d --build` still serves 547/0/547 with the auto-dismissing green banner.
>
> Then wait for the user's answers to the 6 questions before writing any tests or code. Once they answer, follow the locked tag protocol: Suite 46 RED tests committed first, then code execution §1 -> §6, then browser smoke against §R guards, then pause for explicit "tag it" approval.
>
> If the user wants to redirect away from v2.4.15 (e.g., do the report first, or split the bundle), they'll say so. Don't assume.

## 8 · Process rule for every session going forward

Per `feedback_foundational_testing.md`:

> Every phase that adds or renames a data-model field must, in the SAME commit, (1) update the demo session to exercise the new field, (2) update or add a seed skill that demonstrates the new capability, (3) update `diagnostics/demoSpec.js` with an assertion pinning the new shape, (4) log the change to `docs/DEMO_CHANGELOG.md`.

v2.4.5 is the first release under this rule. Every release after it carries the rule forward. The 416-tests-pass-but-UX-broken pattern that caused v2.4.4's known issues is what this rule prevents.
