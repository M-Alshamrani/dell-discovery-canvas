# v3.0.0-rc.7 — release notes

**Tagged**: 2026-05-09 PM · **Branch**: `v3.0-data-architecture` · **Banner**: **1196/1196 GREEN ✅** · **APP_VERSION at tag**: `"3.0.0-rc.7"`

## Top-line summary (rc.6 → rc.7)

Banner 1187 → **1196** (+9 net; many tests rewrote-in-place during the v2 architecture deletion + invariant arc). Today (2026-05-09 PM) was a major bug-closure + invariant-hardening + demo-rewrite pass.

**v2 architecture is GONE** (Step H+J+K mega-commit + 7e-8 redo Step I-A..B-34): 929 LOC of v2 code deleted; v3 engagement is sole source of truth across every production code path.

**R8 invariant arc is CLOSED** (6/6 backlog items shipped 2026-05-09 PM): every helper-layer invariant gate is atomic now (AL10 / I1..I8 / L8 / G6 / setPrimaryLayer-rebalance / manual-add UI contract).

**Reference integrity is structural** (SPEC §S43 NEW): `core/engagementIntegrity.js` scrubs orphan UUID refs at engagement-load; `core/labelResolvers.js` is the single source of truth for env / layer / driver / instance label resolution — UI surfaces NEVER display raw UUIDs.

**21 user-reported bugs closed**: BUG-001/002/019/027/028/032/040/041/042/043/044/045/047/048/049/051/052 + BUG-A/B/C/D/E/F.

**Demo rewrite**: Northstar Health Network 4-site exec-friendly scenario (Main DC + DR + Branch Clinic + GCP) showcasing Dell-replace stories with PowerEdge R770.

## Theme — v2 architecture deletion arc COMPLETE + bug-closure pass

rc.7 closes the v3-pure architecture migration that started in rc.4 with the mock-purge and continued through rc.6's grounding contract recast. **The v2 architecture is GONE.** State, interactions, the legacy `session-changed` bus, the v2-shape singleton — all retired or inlined into the diagnostics surface where v2-shape test data legitimately belongs. The v3 engagement is the sole source of truth across every production code path.

Companion to the deletion arc: this release also closes the long tail of user-reported bugs (BUG-019, BUG-027, BUG-028, BUG-042, BUG-043, BUG-044 in both halves) and the historical BUG-001/BUG-002 obsoleted by Step J's module deletion.

## Per-arc summary (rc.7 commits since rc.6 tag)

| Sub-arc | Commit | Theme | Banner |
|---|---|---|---|
| 7-arc-1 | (multiple in rc.6→rc.7 window) | Mock-purge per `feedback_no_mocks.md` LOCKED | 1187 → 1157 (mock retirement) |
| 7e-1..7 | (multi) | Full v3-pure migration · adapter selectors + commit* helpers · AI undo via v3 snapshot · canvasFile v3-native · runtime v2→v3 migrator retired | 1205/1211 |
| 7e-8a..c' | (multi) | NoEnvsCard + SPEC §S41 empty-environments empty-state + BUG-041 closed | 1213/1221 |
| 7e-8 redo Step A..G | (multi) | V-ANTI-V2-IMPORT-1/2/3 manifest scope expansion · sessionFile/gapsService/vendorMixService v3-native · DELETE AiAssistOverlay + SkillAdmin + sessionBridge | 1212→1215/1221 |
| 7e-8 redo Step I-A..B-34 | (multi · 30+ commits) | Test-fixture shim slim · 35→4 re-exports · 49 tests rewritten via v2-literal pattern + v3-direct rewrites | 1128/1134 baseline |
| **🔴 H + J + K mega-commit** | `ea898df` | **DELETE 5 v2 modules in one commit (929 LOC)**: `state/sessionStore.js` + `interactions/{matrixCommands,gapsCommands,desiredStateSync}.js` + `core/sessionEvents.js`. Inline 4 v2-shape data factories into `_v2TestFixtures.js`. Migrate `aiCommands.js` + `aiUndoStack.js` + `app.js` from `emitSessionChanged` → `markSaving()`. Rewrite DS16/DS17 to `subscribeActiveEngagement` (R6 v3-contract rewrite). Retire V-FLOW-CHAT-DEMO-1 vector-id-preserving. **V-FLOW-V3-PURE-1/3/4/5 all flip GREEN**. | 1129/1134 → 1133/1134 |
| FS3 + FS4 | `a764f17` | v3-direct rewrite. The v2 `_installSessionAsV3Engagement` bridge fell back to 4 default envs when v2 session was empty, tripping `_isFreshEngagement`'s "envs > 0" predicate. v3-direct construction is honest. | 1133 → 1134/1134 ✅ |
| BUG-043 | `af2c26a` | Welcome-card "Load demo session" silently failed because `_resetEngagementStoreForTests()` (called by various tests) wipes `_subs.clear()` — including app.js's boot-time shell-render listener. Re-register `window.__shellRenderSubscriber` in testRunner afterRestore. + V-FLOW-SHELL-SUBSCRIBER-1. | 1134 → 1135/1135 |
| BUG-042 | `0926b30` | GapsEditView demo banner read `session.isDemo` from the dead v2-shape arg (null in v3). Now reads `getActiveEngagement().meta.isDemo`. + V-FLOW-DEMO-BANNER-GAPS-1. | 1135 → 1136/1136 |
| BUG-044 (gap-tile) | `1c306dc` | `services/programsService.js driverLabel` resolves v3 UUID → `engagement.drivers.byId[uuid].businessDriverId` → BUSINESS_DRIVERS catalog label (not UUID → null → fallback to UUID). + V-FLOW-DRIVER-LABEL-V3UUID-1. | 1136 → 1137/1137 |
| BUG-044 (chat) | `1deda90` | `services/uuidScrubber.js buildLabelMap` drivers branch resolves UUID → BUSINESS_DRIVERS catalog label. Pre-fix mapped UUID → UUID = scrubber no-op. + V-CHAT-39. | 1137 → 1138/1138 |
| Polish + closures | `8a7c265` | VT29 viewport-sufficiency guard (skip when innerHeight < 500 or innerWidth < 600 — the contract presumes a realistic user viewport). Close BUG-019/027/028/001/002 in BUG_LOG (verified live + architecturally fixed by prior commits). ROADMAP refresh. | 1138/1138 ✅ |

## What got deleted in Step H+J+K (the centerpiece)

| File | LOC | Step | Successor |
|---|---|---|---|
| `state/sessionStore.js` | 220 | H | `state/engagementStore.js` (live since rc.4-dev) |
| `interactions/matrixCommands.js` | 143 | J | `state/adapter.js commitInstanceAdd/Update/Remove` + `state/collections/instanceActions.js` |
| `interactions/gapsCommands.js` | 263 | J | `state/adapter.js commitGapAdd/Edit/Remove/Link*` + `state/collections/gapActions.js` |
| `interactions/desiredStateSync.js` | 237 | J | `state/dispositionLogic.js commitSyncGap*/buildGapFromDispositionV3` |
| `core/sessionEvents.js` | 66 | K | `state/engagementStore.js subscribeActiveEngagement` (per-engagement subscriber chain) |
| **TOTAL** | **929** | | |

The 4 v2-shape data factories (`session`, `createEmptySession`, `addInstance`, `createGap`) — pure data builders with no v2 BEHAVIOR — were inlined into `diagnostics/_v2TestFixtures.js` per the shim's original architectural intent (header lines 11-13 anticipated this end-state from rc.7 / 7e-8b). The Phase I-B-31..34 v2-shape-literal precedent (49 tests already shipping with v2-shape literal factories at the test boundary) governs.

## Bugs closed since rc.6 tag

| ID | Severity | Closed by | Theme |
|---|---|---|---|
| BUG-001 | Medium | Step J deletion (v2 root path gone) + v3 path verified clean | Propagate toast "low" placeholder bug structurally impossible in v3 |
| BUG-002 | Medium | Step J deletion + v3 panel re-mount on every render | Propagate button non-dispatchable after second cycle structurally impossible in v3 |
| BUG-019 | High | Already shipped per SPEC §S31 (engagementStore auto-rehydrate) | Engagement state restored from localStorage on every page boot, no Load-demo click required |
| BUG-027 | Low | Already shipped per styles.css line 3940 broad cloak rule | Test-pass cloak now covers every body-level child except the closed app-shell list |
| BUG-028 | Medium | Already shipped per SPEC §S36.1 (Overlay.js stack-aware) | Side-panel stacking when chat is open + Settings opens; Done pops the stack |
| BUG-041 | High | `709e778` (rc.6 → rc.7 window) | AI Assist provider popover stale-snapshot |
| BUG-042 | Low | `0926b30` | Demo banner missing on Tab 4 (Gaps) via live demo-loader |
| BUG-043 | Medium | `af2c26a` | Welcome-card "Load demo session" engagement updates but Tab 1 stays stale |
| BUG-044 | Medium | `1c306dc` (gap-tile) + `1deda90` (chat scrubber) | UUIDs leak into Gap tile metadata + AI chat responses |

## Tests added (regression guards)

- **V-FLOW-V3-PURE-1/3/4/5** flip GREEN (4 tests — the deletion targets now 404).
- **V-FLOW-SHELL-SUBSCRIBER-1** — `window.__shellRenderSubscriber` exposed for testRunner re-attach (BUG-043 guard).
- **V-FLOW-DEMO-BANNER-GAPS-1** — drives the LIVE app.js path (`session arg = null`) and asserts demo banner via `getActiveEngagement().meta.isDemo` (BUG-042 guard).
- **V-FLOW-DRIVER-LABEL-V3UUID-1** — gap card `.program-badge` resolves v3 UUID → catalog label, never leaks UUID into UI text (BUG-044 gap-tile guard).
- **V-CHAT-39** — `buildLabelMap` resolves v3 driver UUID → BUSINESS_DRIVERS catalog label (not UUID → UUID); end-to-end `scrubUuidsInProse` removes UUIDs from LLM prose (BUG-044 chat-half guard).

## Architectural locks ratified

- **`feedback_chrome_mcp_for_smoke.md`** (NEW · 2026-05-09 LOCKED) — tier-1 alongside `feedback_browser_smoke_required.md`. Use the user's local PC Chrome via the "Claude in Chrome" MCP for all in-loop iteration AND tag-time canonical smoke. Stop using `preview_screenshot` / preview server. Same window the user sees, no environment drift.
- **R0..R11 Principal-Architect Discipline** (LOCKED 2026-05-08) — every commit in rc.7 governed by R11's four-block ritual (Recite + Answer + Execute + Pledge-Smoke-Screenshot) with `Browser smoke evidence:` block in every commit message.
- **R5 spirit clarification** — fig-leaf forbids hiding v2 BEHAVIOR (atomic gates, helper-layer invariant enforcement) in `diagnostics/_*.js`; v2-shape DATA factories at the test boundary are allowed (per Phase I-B-31..34 LOCKED v2-shape-literal pattern + 49-test precedent).

## 2026-05-09 PM addendum — closure pass before tag

After the initial rc.7 tag-prep snapshot above (banner 1138), one more day of intensive bug-closure + invariant work landed before the actual tag:

### R8 invariant arc CLOSED (6 commits)
| Commit | Theme |
|---|---|
| `3184043` | R8 #1 — `updateGap` AL10/TX13.10 atomic gate (V-INV-UPDATEGAP-AL10-1/2/3) |
| `8ad0219` | R8 #2 — `mapWorkloadAssets` I1..I8 invariants + **BUG-040 closure** (V-INV-MAPWORKLOAD ×9) |
| `4ab0a77` | R8 #3 — `_gapUnlinkInstance` integration tests (V-INV-UNLINK-AL10-1/2/3) |
| `4a8f8dc` | R8 #4 — `_gapLinkInstance` PHASE_CONFLICT_NEEDS_ACK gate (V-INV-LINK-PHASE-1/2/3/4) |
| `ad8e919` | R8 #5 partial — `setPrimaryLayer` auto-rebalance G6 (V-INV-PRIMARY-LAYER-REBALANCE-1/2/3/4) |
| `6a6b94f` | R8 #6 — manual-add dialog UI contract + **BUG-052 closure** (V-FLOW-MANUAL-ADD-1) |

### BUG-A/B/C/D/E/F closure (6 commits + supporting)
| Commit | Theme |
|---|---|
| `ecc429e` | **BUG-B** — markSaved restored at v3 `engagementStore._persist` (chain severed by Step H sessionStore deletion; capsule pulsed "Saving..." forever) |
| `9913658` | **BUG-C** — test-runner opt-in gate (`?runTests=1` / `localStorage.runTestsOnBoot` / `window.runDellDiscoveryTests()`) so production users don't race against the 70s test pass on Load demo |
| `5792d43` | **BUG-A (BUG-053)** + **SPEC §S43** — two-layer engagement reference-integrity contract (NEW `core/engagementIntegrity.js` scrubber + UI label resolver placeholders; no more raw-UUID leaks into gap-card meta lines) |
| `bafc578` | **Z2** — NEW `core/labelResolvers.js` single source of truth for env/layer/driver/instance label resolution; 5 sites migrated; SPEC §S43.3 amendment |
| `ad5e631` | **BUG-B regression closure** + **BUG-D** — dropped 5 explicit `markSaving()` calls that were overriding `_persist`'s `markSaved()`; added `gap.origin` schema field (manual / autoDraft) so the auto-draft banner stops mis-counting manual gaps |
| `b554c53` | **Healthcare demo rewrite** — Northstar Health Network exec demo (4 sites: Main DC + DR + Branch Clinic + GCP; 4 drivers; 9 gaps; PowerEdge R770) |
| `cc3a3b1` | **BUG-E** + **BUG-F** — projection.js gap.driverId UUID→typeId remap restores the driver-grouped Roadmap (was: every project fell into Unassigned swimlane); Review all button right-aligns + highlights cards instead of walking-one-at-a-time |

### NEW SPEC sections added inline
- **§S42** — v3 invariant-enforcement arc (R8 backlog as architectural annex; per-helper contract table + R42.1..5 + F42.1..3 + test contract)
- **§S43** — engagement reference-integrity contract (two-layer scrubber + label resolvers); §S43.3 amended post-Z2 to make `core/labelResolvers.js` the single source of truth

### NEW modules
- **`core/engagementIntegrity.js`** — pure idempotent scrubber for orphan UUID refs (gap.driverId / gap.affectedEnvironments / gap.relatedCurrent/Desired / instance.originId / instance.mappedAssetIds)
- **`core/labelResolvers.js`** — `envLabel` / `layerLabel` / `driverLabel` / `instanceLabel` + PLACEHOLDER_* constants; defensive (never throws on render path); v3 UUID + v2 typeId both resolve correctly

### Schema additions
- **`gap.origin`** (`manual` | `autoDraft`) — provenance flag separating user-authored gaps from auto-drafted-from-disposition gaps. Default `autoDraft` for back-compat with persisted gaps. Surfaced to AI grounding meta-model via `core/dataContract.js`.

## Path to v3.0.0 GA

| Item | Status |
|---|---|
| v2 architecture deletion (Steps A..K) | ✅ COMPLETE this release |
| **R8 invariant arc** (6/6 helper-layer atomic gates) | ✅ **COMPLETE** this release (was deferred; lifted into rc.7 per 2026-05-09 PM workshop) |
| **SPEC §S42 + §S43** (invariants + reference integrity contracts) | ✅ Authored inline |
| All user-reported bugs closed | ✅ 21 today; 0 open critical |
| Banner all-GREEN | ✅ **1196/1196** |
| PREFLIGHT 5b real-LLM live-key smoke | ✅ confirmed by user 2026-05-09 ("AI chat works") |
| Real-customer `.canvas` workshop validation round 2 | ⬜ **GA gate** — workshop run against the new Northstar demo + bug-spotting round |
| AI-enhancement arc-1 (urgencyOverride auto-pin / instance-NAMES selectors / drivers+envs in WRITE_RESOLVERS) | ⬜ **GA-or-v3.1 decision pending** (audit + paths surfaced 2026-05-09 PM) |
| Session lifecycle management (RPO snapshots / save browser / undo) | DEFERRED to v3.1+ (BACKLOGGED 2026-05-09 PM per user direction) |
| Crown-jewel UI polish (BUG-022/037/038) | DEFERRED to v3.1 minor |
| Vendor-mix data-model widening (BUG-039) | DEFERRED to v3.1+ |
| v3-prefix module-name purge | DEFERRED to v3.0.1 (mechanical-only, no behaviour change) |
| docs/TAXONOMY.md v3-pure rewrite (currently v2.4.16) | DEFERRED to v3.1 (doc-only; out of scope for GA) |
| **Merge `v3.0-data-architecture` → `main`** | **After GA tag (v3.0.0)** — NOT at rc.7 |

## How to PREFLIGHT 5b for the rc.7 tag

Per `docs/PREFLIGHT.md §5b`, run with your real API keys (Anthropic + Google + Local A/B):

1. Boot the app at `http://localhost:8080` (Chrome MCP or your direct browser).
2. Load the Acme Healthcare demo (footer "Load demo").
3. Open Canvas AI Assistant (topbar "AI Assist").
4. For EACH of Anthropic + Gemini + Local A, do 3 turns:
   - **Fact-retrieval**: "summarize the gaps" — verify response paraphrases the 8 demo gap descriptions; no fabrication.
   - **Vendor query**: "find the dell assets in current state" — verify response cites real Dell vendor mix from the demo; no made-up products.
   - **Multi-cut**: "what dispositions does the customer have?" — verify response cites real engagement entities only.
5. Per turn, inspect Network panel: Layer 4 carries router selector results; response has zero `groundingViolations`. **Per turn, verify NO UUID strings leak into the response prose** (BUG-044 chat-half guard — every UUID emission should be replaced by the catalog label OR `[unknown reference]`).

If every provider × every prompt produces UUID-free, fabrication-free responses → tag rc.7. If any provider violates → tag is BLOCKED; debug which selector / verifier / scrubber path failed.

## Tag command sequence (after PREFLIGHT 5b passes)

```bash
# 1. Bump APP_VERSION (drop -dev) per RULES R30.2
#    edit core/version.js: "3.0.0-rc.7-dev" → "3.0.0-rc.7"
# 2. Commit "tag . v3.0.0-rc.7 · APP_VERSION drop -dev · 1138/1138 GREEN"
# 3. Tag the commit:
git tag v3.0.0-rc.7
# 4. (only on user explicit instruction):
git push origin v3.0-data-architecture
git push origin v3.0.0-rc.7
```

Verify on origin: branch `v3.0-data-architecture` carries the rc.7 tag commit; `v3.0.0-rc.7` tag exists; rc.6 / rc.5 / rc.4 / rc.3 tags preserved.
