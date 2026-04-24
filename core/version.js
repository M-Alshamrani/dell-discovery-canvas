// core/version.js — Phase 19g / v2.4.6
//
// Single source of truth for the APP version. Bump this string in the
// same commit as a new tag (e.g. "2.4.6" → "2.4.7"). UI surfaces import
// it as a named constant; never parse package.json at runtime (there
// isn't one) and never read the session schema version as a stand-in.
//
// Distinct from:
//   - session.sessionMeta.version — the *session schema* version
//     (migrator contract, currently "2.0"). Has nothing to do with
//     what build of the app is running.
//   - git tags — runtime code doesn't read git; this string is the
//     runtime-visible version.

export const APP_VERSION = "2.4.10";
