// diagnostics/_productionFileManifest.js
//
// rc.7 / 7e-8 redo Step A · authoritative list of every production .js
// file under services/ ui/ interactions/ core/ state/ selectors/.
// Used by V-ANTI-V2-IMPORT-1/2/3 to scan ALL production code for
// forbidden imports (the closed-list scope of the prior tests was the
// root cause of the 7e-8d-3..5 boot-breaking deletion).
//
// Invariant: every file under those directories is in this list. New
// production file? Add it here. Test failing because a new file is
// added is a forcing function -- the new file goes through the
// v2-import audit on day one.
//
// Excluded by design:
//   - app.js (root-level, scanned separately by anti-import tests)
//   - schema/* (Zod schemas; pure, no v2 imports possible)
//   - migrations/* (v2->v3 migrator; intentionally references v2 shapes)
//   - vendor/* (third-party; out of scope)
//   - catalogs/* (data files; no JS logic)
//   - diagnostics/* (test surface; v2-import grep is scoped to
//     PRODUCTION code, and diagnostics/_v2TestFixtures.js is itself
//     a planned-deletion target)
//
// Authority: docs/V2_DELETION_ARCHITECTURE.md (Step A).

export const PRODUCTION_FILES = [
  // ─── core/ ─────────────────────────────────────────────────────────
  "/core/aiConfig.js",
  "/core/appManifest.js",
  "/core/bindingResolvers.js",
  "/core/conceptManifest.js",
  "/core/config.js",
  "/core/dataContract.js",
  "/core/demoEngagement.js",
  "/core/fieldManifest.js",
  "/core/helpContent.js",
  "/core/models.js",
  "/core/promptGuards.js",
  "/core/saveStatus.js",
  "/core/seedSkills.js",
  "/core/services.js",
  "/core/sessionEvents.js",
  "/core/skillStore.js",
  "/core/skillsEvents.js",
  "/core/taxonomy.js",
  "/core/version.js",

  // ─── interactions/ ─────────────────────────────────────────────────
  "/interactions/aiCommands.js",
  "/interactions/desiredStateSync.js",   // deletion target
  "/interactions/gapsCommands.js",       // deletion target
  "/interactions/matrixCommands.js",     // deletion target
  "/interactions/skillCommands.js",

  // ─── selectors/ ────────────────────────────────────────────────────
  "/selectors/executiveSummary.js",
  "/selectors/gapsKanban.js",
  "/selectors/healthSummary.js",
  "/selectors/linkedComposition.js",
  "/selectors/matrix.js",
  "/selectors/projects.js",
  "/selectors/vendorMix.js",

  // ─── services/ ─────────────────────────────────────────────────────
  "/services/aiService.js",
  "/services/canvasFile.js",
  "/services/catalogLoader.js",
  "/services/chatHandshake.js",
  "/services/chatService.js",
  "/services/chatTools.js",
  "/services/gapsService.js",
  "/services/groundingRouter.js",
  "/services/groundingVerifier.js",
  "/services/healthMetrics.js",
  "/services/manifestGenerator.js",
  "/services/memoizeOne.js",
  "/services/pathResolver.js",
  "/services/programsService.js",
  "/services/realChatProvider.js",
  "/services/realLLMProvider.js",
  "/services/roadmapService.js",
  "/services/sessionFile.js",
  "/services/skillEngine.js",
  "/services/skillOutputSchemas.js",
  "/services/skillRunner.js",
  "/services/skillSaveValidator.js",
  "/services/systemPromptAssembler.js",
  "/services/tryAskingPrompts.js",
  "/services/uuidScrubber.js",
  "/services/vendorMixService.js",

  // ─── state/ ────────────────────────────────────────────────────────
  "/state/adapter.js",
  "/state/aiUndoStack.js",
  "/state/chatMemory.js",
  "/state/collections/customerActions.js",
  "/state/collections/driverActions.js",
  "/state/collections/environmentActions.js",
  "/state/collections/gapActions.js",
  "/state/collections/instanceActions.js",
  "/state/demoSession.js",
  "/state/dispositionLogic.js",
  "/state/engagementStore.js",
  "/state/filterState.js",
  "/state/integritySweep.js",
  "/state/runtimeMigrate.js",
  // /state/sessionBridge.js DELETED in rc.7 / 7e-8 redo Step G
  // (was: SPEC §S19.3 co-existence-window bridge; v2 session-changed ->
  // v3 customer shallow-merge + v3 -> v2 mirror loop. With v2 views
  // retired post-rc.7/7e-3..7 and v2 admin retired in Steps E + F, no
  // production reader of liveSession remains; the mirror is dead weight.
  // Boot-seed inlined in app.js DOMContentLoaded; session-reset chat-
  // clear inlined at app.js newSessionBtn handler. V-FLOW-MIGRATE-TAB1-
  // DRIVERS-3 + ENVS-3 + CUSTOMER-2 retired with vector-id preservation
  // since they pinned the cutover-window mirror that no longer exists).
  "/state/sessionStore.js",      // deletion target
  "/state/v3Projection.js",
  "/state/v3SkillStore.js",
  "/state/v3ToV2DemoAdapter.js",

  // ─── ui/components/ ────────────────────────────────────────────────
  "/ui/components/DemoBanner.js",
  "/ui/components/FilterBar.js",
  "/ui/components/NoEnvsCard.js",
  "/ui/components/Notify.js",
  "/ui/components/Overlay.js",
  "/ui/components/PillEditor.js",
  "/ui/components/SharedFilterBar.js",

  // ─── ui/ (top-level) ───────────────────────────────────────────────
  "/ui/icons.js",
  "/ui/skillBuilderOpener.js",

  // ─── ui/views/ ─────────────────────────────────────────────────────
  // /ui/views/AiAssistOverlay.js DELETED in rc.7 / 7e-8 redo Step E
  // (was: dormant since rc.4 Arc 2; the v2 sessionStore import made
  // it a V-ANTI-V2-IMPORT-1 violator that the rc.7 / 7e-8 v2 deletion
  // arc retires entirely; project_v2x_admin_deferred.md "preserve as
  // dormant" contract superseded by project_v3_pure_arc.md).
  // /ui/views/SkillAdmin.js DELETED in rc.7 / 7e-8 redo Step F
  // (was: dormant since rc.4 Arc 4; SettingsModal now routes Skills
  // section through ui/views/SkillBuilder.js. The 11 v2 DOM-coupled
  // tests SB6/SB7/FP5/FP6/FP8/FP9/PG5/QW3..QW6 retired in lock-step
  // with vector-id preservation; v3 admin contracts live in
  // V-SKILL-V3-8..15 + V-MIGRATE-V2-V3-1..4 in §T36 of appSpec).
  "/ui/views/CanvasChatOverlay.js",
  "/ui/views/ContextView.js",
  "/ui/views/GapsEditView.js",
  "/ui/views/HelpModal.js",
  "/ui/views/MatrixView.js",
  "/ui/views/ReportingView.js",
  "/ui/views/SettingsModal.js",
  "/ui/views/SkillBuilder.js",
  "/ui/views/SummaryGapsView.js",
  "/ui/views/SummaryHealthView.js",
  "/ui/views/SummaryRoadmapView.js",
  "/ui/views/SummaryVendorView.js",

  // ─── root-level ────────────────────────────────────────────────────
  "/app.js"
];
