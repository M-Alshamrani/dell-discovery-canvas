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
  createEmptySession
  // rc.7 / 7e-8 redo Step I Phase I-B-8 · createDemoSession + resetToDemo
  // dropped from this shim.
  // rc.7 / 7e-8 redo Step I Phase I-B-6 · replaceSession dropped.
  // rc.7 / 7e-8 redo Step I Phase I-B-5 · applyContextSave dropped.
  // rc.7 / 7e-8 redo Step I Phase I-B-7 · saveToLocalStorage dropped.
  // rc.7 / 7e-8 redo Step I Phase I-B-3 · isFreshSession dropped.
  //
  // rc.7 / 7e-8 redo Step I Phase I-B-23 (Path C) · resetSession +
  // loadFromLocalStorage dropped. Their only consumer was the test-
  // runner afterRestore in appSpec.js, migrated to a v3-pure path
  // in the same commit (v3 _rehydrateEngagementFromStorage handles
  // restoration; v2 sessionStore singleton refresh is redundant
  // post-Step-G). Test-body resetSession usage was migrated in
  // Phase I-B-22 (commit 6abd74f).
} from "../state/sessionStore.js";

// ─── from interactions/matrixCommands.js ───────────────────────────
// rc.7 / 7e-8 redo Step I Phase I-B-11 · moveInstance dropped. Pure
// dead re-export -- own-grep (`grep -rnE "moveInstance" --include="*.js"`)
// returns only the canonical export in interactions/matrixCommands.js;
// zero call sites in *.js elsewhere. Same shape as Phase I-B-7
// (saveToLocalStorage) and Phase I-B-10 (setGapDriverId) drops.
//
// rc.7 / 7e-8 redo Step I Phase I-B-17 · deleteInstance dropped. Its
// only test consumer (Suite 17 "all command functions accept plain
// objects") was rewritten v3-direct in the same commit using
// commitInstanceRemove from state/adapter.js.
//
// rc.7 / 7e-8 redo Step I Phase I-B-19 · proposeCriticalityUpgrades
// dropped. Its 3 test consumers (W3 + W4 + W5 in Suite 26) were
// rewritten v3-direct in the same commit using
// proposeCriticalityUpgradesV3 (aliased import from state/
// dispositionLogic.js -- v3 signature is (engagement,
// workloadInstanceId); pure function, no engagement mutation).
//
// rc.7 / 7e-8 redo Step I Phase I-B-21 · updateInstance dropped.
// Pure dead re-export -- own-grep confirms zero updateInstance(
// call sites in *.js (the only matches were the v3-aliased
// updateInstanceV3 import in appSpec.js + its V-SEL-INVAL-4
// consumer; both unaffected).
//
// rc.7 / 7e-8 redo Step I Phase I-B-24 · mapAsset + unmapAsset
// dropped. Suite 26 high-density rewrite: W1 + W1b migrated v3-direct
// via commitInstanceAdd + InstanceSchema.superRefine; W2 + W6 RETIRED
// per Step I plan (v2 helper-layer-invariant contracts no-longer-
// applicable in v3-pure architecture; v3 mapWorkloadAssets is a thin
// updateInstance wrapper with NO enforcement). The 5 invariants
// (dedupe / self-map / workload-to-workload / cross-state / cross-
// environment) are preserved in HANDOFF "Open R8 backlog" item #2
// for the future rc.8 v3-invariant-enforcement arc -- not lost,
// just deferred.
export {
  addInstance
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
//
// rc.7 / 7e-8 redo Step I Phase I-B-17 · deleteGap dropped. Its only
// test consumer (Suite 17 "all command functions accept plain objects")
// was rewritten v3-direct in the same commit using commitGapRemove
// from state/adapter.js.
//
// rc.7 / 7e-8 redo Step I Phase I-B-25 · linkDesiredInstance +
// unlinkCurrentInstance dropped. RH11 rewritten v3-direct using
// commitGapLinkDesiredInstance (no-conflict-link contract is
// v3-applicable). RH10 + RH20 RETIRED per Step I plan -- their v2
// helper-layer invariants (PHASE_CONFLICT_NEEDS_ACK on link +
// AL-rule on unlink) are no-longer-applicable in v3-pure architecture
// (v3 _gapLinkInstance + _gapUnlinkInstance have NO enforcement;
// caller-layer is the new gate location). The 2 contracts are
// preserved in HANDOFF "Open R8 backlog" item #3 (unlink-AL-rule)
// + #4 (phase-conflict-ack) for the future rc.8 invariant arc.
export {
  createGap,
  updateGap
} from "../interactions/gapsCommands.js";

// ─── from interactions/desiredStateSync.js ─── ENTIRE BLOCK RETIRED ─
//
// rc.7 / 7e-8 redo Step I Phase I-B-20 · the desiredStateSync
// re-export block FULLY RETIRES. buildGapFromDisposition was the
// last surviving member; its 4 test consumers (T6.4 line 2300, RH16
// line 6167, RH17 line 6181, RH18 line 6192) were all rewritten
// v3-direct in this commit using buildGapFromDispositionV3 (aliased
// import from state/dispositionLogic.js). RH16 additionally uses
// engagementToV2Session at the boundary to feed the still-v2-shape
// services/roadmapService.js buildProjects (separate migration arc).
//
// Phase-by-phase ledger:
//   Phase I-B-11: getDesiredCounterpart + getCurrentSource dropped.
//   Phase I-B-13: syncGapFromDesired dropped (RH9 v3-direct).
//   Phase I-B-14: syncGapsFromCurrentCriticality dropped (RH13 v3-direct).
//   Phase I-B-15: syncDesiredFromGap dropped (T4.5 + T6.3 v3-direct).
//   Phase I-B-16: confirmPhaseOnLink dropped (T6.1 + T6.2 v3-direct).
//   Phase I-B-18: DISPOSITION_ACTIONS + ACTION_TO_GAP_TYPE dropped
//                 (import-source switch, no test rewrites).
//   Phase I-B-20: buildGapFromDisposition dropped (T6.4 + RH16/17/18
//                 v3-direct). BLOCK RETIRES.
//
// V-FLOW-V3-PURE-5 (interactions/desiredStateSync.js MUST NOT exist)
// remains expected-RED until Step J deletes the canonical file --
// every shim path consumer is now retired so Step J unblocks once
// the matrixCommands + gapsCommands consumers also clear.
