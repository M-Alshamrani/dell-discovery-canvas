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
  createDemoSession,
  resetSession,
  resetToDemo,
  replaceSession,
  applyContextSave,
  saveToLocalStorage,
  loadFromLocalStorage,
  isFreshSession
} from "../state/sessionStore.js";

// ─── from interactions/matrixCommands.js ───────────────────────────
export {
  addInstance,
  updateInstance,
  deleteInstance,
  moveInstance,
  mapAsset,
  unmapAsset,
  proposeCriticalityUpgrades
} from "../interactions/matrixCommands.js";

// ─── from interactions/gapsCommands.js ─────────────────────────────
export {
  setPrimaryLayer,
  deriveProjectId,
  createGap,
  approveGap,
  updateGap,
  deleteGap,
  linkCurrentInstance,
  linkDesiredInstance,
  unlinkCurrentInstance,
  unlinkDesiredInstance,
  setGapDriverId
} from "../interactions/gapsCommands.js";

// ─── from interactions/desiredStateSync.js ─────────────────────────
export {
  DISPOSITION_ACTIONS,
  ACTION_TO_GAP_TYPE,
  getDesiredCounterpart,
  getCurrentSource,
  buildGapFromDisposition,
  syncGapFromDesired,
  syncDesiredFromGap,
  confirmPhaseOnLink,
  syncGapsFromCurrentCriticality
} from "../interactions/desiredStateSync.js";
