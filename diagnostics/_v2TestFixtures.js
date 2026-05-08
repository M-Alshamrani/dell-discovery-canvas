// diagnostics/_v2TestFixtures.js
//
// rc.7 / 7e-8b · Test-only shim that re-exports v2 fixture builders
// from the surviving v2 modules. The point of this file is to give
// `diagnostics/appSpec.js` ONE import surface for all v2 test fixtures
// so that:
//
//   1. The test suite's coupling to the v2 modules is concentrated in
//      this single file (instead of ~10 scattered import lines in
//      appSpec.js). Easier to reason about + easier to migrate.
//   2. When the v2 modules are deleted in 7e-8d, the only file we
//      need to touch is this one — INLINE the function bodies here +
//      drop the re-exports. appSpec.js requires no further edits.
//
// Why this is safe per RULES §16 CH34:
//   - V-ANTI-V2-IMPORT-1 (test source line ~12587) forbids PRODUCTION
//     files from importing `state/sessionStore.js`. Test fixtures live
//     in `diagnostics/`, not production. The grep test scopes itself
//     to production files so this re-export shim does NOT trip it.
//   - V-ANTI-V2-IMPORT-2 (test source line ~12605) forbids PRODUCTION
//     files from importing `interactions/{matrixCommands,gapsCommands,
//     desiredStateSync}`. Same scoping.
//
// Why not do this in 7e-8d directly?
//   The 7e-8 arc separates "decouple test imports" (this commit, low
//   risk) from "migrate production app.js call sites" (7e-8c, medium
//   risk) from "delete the v2 files" (7e-8d, dependent on the prior
//   two). Each commit is independently smoke-verifiable + revertible.
//
// Authority: SPEC §S40 + RULES §16 CH34 + project_v3_pure_arc.md.

// ─── from state/sessionStore.js ────────────────────────────────────
// rc.7 / 7e-8 redo Step I-B-1 · migrateLegacySession dropped from this
// shim. It lives canonically in state/runtimeMigrate.js (post-Step B);
// test consumers now import it directly. This is a pure-function symbol
// with no v2 sessionStore state coupling, so the direct path is the
// architecturally correct one.
export {
  session,
  createEmptySession,
  // rc.7 / 7e-8 redo Step I Phase I-B-8 · createDemoSession + resetToDemo
  // dropped from this shim. createDemoSession is consumed via direct
  // imports from ../state/demoSession.js (lines 5209 + 7793 in appSpec
  // pre-cleanup, aliased as createDemoSessionForSF + txCreateDemoSession).
  // resetToDemo had ZERO call sites in *.js post-audit.
  resetSession,
  // rc.7 / 7e-8 redo Step I Phase I-B-6 · replaceSession dropped.
  // V3 successor is state/engagementStore.js setActiveEngagement. The v2
  // helper's last test consumer (VT26) was rewritten v3-direct in the
  // same commit (createEmptyEngagement + commitContextEdit +
  // engagementToV2Session for renderer signatures).
  // rc.7 / 7e-8 redo Step I Phase I-B-5 · applyContextSave dropped.
  // V3 successor is state/adapter.js commitContextEdit (asserted by
  // V-FLOW-MIGRATE-TAB1-CUSTOMER-1 in §T36 source-grep). The v2 helper's
  // only test consumers (PR1.a + PR1.b) were dropped in the same commit.
  // rc.7 / 7e-8 redo Step I Phase I-B-7 · saveToLocalStorage dropped
  // (was a dead re-export; zero call sites in appSpec.js *.js).
  loadFromLocalStorage
  // rc.7 / 7e-8 redo Step I Phase I-B-3 · isFreshSession dropped.
  // V3 successor is ui/views/ContextView.js _isFreshEngagement (covered
  // end-to-end by FS3 + FS4 in appSpec).
} from "../state/sessionStore.js";

// ─── from interactions/matrixCommands.js ───────────────────────────
// rc.7 / 7e-8 redo Step I Phase I-B-11 · moveInstance dropped. Pure
// dead re-export -- own-grep (`grep -rnE "moveInstance" --include="*.js"`)
// returns only the canonical export in interactions/matrixCommands.js;
// zero call sites in *.js elsewhere. Same shape as Phase I-B-7
// (saveToLocalStorage) and Phase I-B-10 (setGapDriverId) drops.
export {
  addInstance,
  updateInstance,
  deleteInstance,
  mapAsset,
  unmapAsset,
  proposeCriticalityUpgrades
} from "../interactions/matrixCommands.js";

// ─── from interactions/gapsCommands.js ─────────────────────────────
// rc.7 / 7e-8 redo Step I Phase I-B-2 · setPrimaryLayer + deriveProjectId
// dropped from this re-export. Their only test consumers (PL4, PR2, dead
// setPrimaryLayerRH alias) were dropped in the same commit. The helpers
// stay PRIVATE inside state/runtimeMigrate.js (where they were inlined
// during Step B); after Step J deletes interactions/gapsCommands.js,
// nothing in the codebase imports these helpers any more.
//
// rc.7 / 7e-8 redo Step I Phase I-B-9 · approveGap dropped. Its two test
// consumers (T6.7 + RH6 in Suite 22 of appSpec.js) were rewritten v3-
// direct in the same commit: validateActionLinks(probe-with-reviewed:true)
// gate + commitGapEdit({reviewed:true}) persistence. The v3 contract is
// the same AL10 "I'm done" gate (RULES TX13.10) expressed as a caller
// call-sequence rather than an atomic v2 helper. Pattern is VT26 template
// (commit 2b28c01).
//
// rc.7 / 7e-8 redo Step I Phase I-B-10 · setGapDriverId dropped. Pure
// dead re-export -- own-grep across the entire repo (`grep -rnE
// "setGapDriverId" --include="*.js"`) returns ZERO consumers (the only
// references are doc strings in README.md, SPEC.md, RULES.md). Same
// shape as Phase I-B-7's saveToLocalStorage drop.
//
// rc.7 / 7e-8 redo Step I Phase I-B-11 · unlinkDesiredInstance dropped.
// Pure dead re-export -- own-grep returns only the canonical export in
// interactions/gapsCommands.js + the appSpec.js import line that this
// commit also trimmed. Zero call sites in *.js elsewhere.
//
// rc.7 / 7e-8 redo Step I Phase I-B-12 · linkCurrentInstance dropped.
// Its only test consumer (T8.4 in Suite 24 of appSpec.js) was rewritten
// v3-direct in the same commit using commitGapLinkCurrentInstance from
// state/adapter.js (which wraps _gapLinkInstance with built-in dedupe
// per the v3-pure architecture). Pattern is the Phase I-B-9 + I-B-12
// snapshot+restore-_active wrapper.
export {
  createGap,
  updateGap,
  deleteGap,
  linkDesiredInstance,
  unlinkCurrentInstance
} from "../interactions/gapsCommands.js";

// ─── from interactions/desiredStateSync.js ─────────────────────────
// rc.7 / 7e-8 redo Step I Phase I-B-11 · getDesiredCounterpart +
// getCurrentSource dropped. Pure dead re-exports -- own-grep returns
// the canonical exports in interactions/desiredStateSync.js + the
// appSpec.js import line that this commit also trimmed + the v3
// successors in state/dispositionLogic.js (consumed by ui/views/
// MatrixView.js directly, NOT through this shim). Zero call sites in
// *.js elsewhere for the v2 shim path.
//
// rc.7 / 7e-8 redo Step I Phase I-B-13 · syncGapFromDesired dropped.
// Its only test consumer (RH9 in Suite 28 of appSpec.js) was rewritten
// v3-direct in the same commit using commitSyncGapFromDesired from
// state/dispositionLogic.js. v3 architecture explicitly drops the v2
// closeReason / closedAt fields per dispositionLogic.js line 199-203
// comment ("v3-pure drops the v2 closeReason / closedAt fields . not
// in v3 GapSchema; status:'closed' alone is the signal"); RH9's v2-only
// sub-assertions on those fields were dropped per Step I plan.
//
// rc.7 / 7e-8 redo Step I Phase I-B-14 · syncGapsFromCurrentCriticality
// dropped. Its only test consumer (RH13 in Suite 28 of appSpec.js) was
// rewritten v3-direct in the same commit using commitSyncGapsFromCurrent-
// Criticality from state/dispositionLogic.js. v3 preserves the
// urgencyOverride invariant via the filter at line 250 of
// syncGapsFromCurrentCriticalityAction; the contract holds.
//
// rc.7 / 7e-8 redo Step I Phase I-B-15 · syncDesiredFromGap dropped.
// Its 2 test consumers (T4.5 line 2066, T6.3 line 2431) were rewritten
// v3-direct in the same commit using commitSyncDesiredFromGap from
// state/dispositionLogic.js. T6.3's v2-only acknowledged-arg contract
// was scoped out (not enforced by v3 _gapLinkInstance; covered by RH10
// directly); T6.3's v3-direct form focuses on the sync-propagation
// contract (gap.phase -> linked desired.priority via phaseToPriority).
//
// rc.7 / 7e-8 redo Step I Phase I-B-16 · confirmPhaseOnLink dropped.
// Its 2 test consumers (T6.1 line 2444 + T6.2 line 2458) were
// rewritten v3-direct in the same commit using confirmPhaseOnLinkV3
// (aliased import from state/dispositionLogic.js -- v3 successor
// shares signature shape (engagement, gapId, desiredInstanceId) and
// status-return contract).
export {
  DISPOSITION_ACTIONS,
  ACTION_TO_GAP_TYPE,
  buildGapFromDisposition
} from "../interactions/desiredStateSync.js";
