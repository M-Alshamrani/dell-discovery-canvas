// core/version.js — Phase 19g / v2.4.6 (now v3.0 pre-release)
//
// Single source of truth for the APP version. Bump this string in the
// same commit as a new tag (e.g. "2.4.6" → "2.4.7"). UI surfaces import
// it as a named constant; never parse package.json at runtime (there
// isn't one) and never read the session schema version as a stand-in.
//
// Distinct from:
//   - engagement.engagementMeta.schemaVersion — the *engagement schema*
//     version (migrator contract; "2.0" today, target "3.0"). Has
//     nothing to do with what build of the app is running.
//   - git tags — runtime code doesn't read git; this string is the
//     runtime-visible version.
//
// "3.0.0-rc.1" — release candidate. Adapter (SPEC §S19) + engagement
// store + session bridge + V-MFG-1 manifest drift gate all shipped on
// 2026-05-01. v2.x view tabs continue to read sessionState today; their
// per-view migration to state/v3Adapter.js is the rc.2 / GA arc.
//
// Per project_v3_no_file_migration_burden.md the original "real-customer
// .canvas migration smoke" gate is DROPPED. Path to non-suffix "3.0.0":
//   - 5 v2.x view tabs migrated to read via state/v3Adapter.js
//     (Context → Architecture → Heatmap → Workload → Gaps → Reporting)
//   - AI Assist surfaces v3.0 saved skills + dispatches via
//     state/v3EngagementStore.js (AI items 1+2 in the rc-arc plan)
//   - At least one real workshop run against a v3.0 engagement

export const APP_VERSION = "3.0.0-rc.1";
