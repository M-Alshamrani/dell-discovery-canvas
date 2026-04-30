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
// "3.0.0-alpha" is the in-progress v3.0 data-architecture rebuild on
// branch v3.0-data-architecture. Tag bumps to "3.0.0" only on real
// ship (per data-architecture-directive.md sec 0).

export const APP_VERSION = "3.0.0-alpha";
