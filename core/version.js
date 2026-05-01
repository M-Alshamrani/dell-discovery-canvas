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
// "3.0.0-beta" — feature-complete v3.0 data-architecture rebuild
// on branch v3.0-data-architecture. Tagged v3.0.0-beta on 2026-05-01.
// Path to "3.0.0" (no suffix) is gated on:
//   - v3.0 -> v2.x adapter (existing tabs read from v3.0 selectors)
//   - At least one real workshop run against a v3.0 engagement
//   - Successful migration of at least one real customer .canvas file

export const APP_VERSION = "3.0.0-beta";
