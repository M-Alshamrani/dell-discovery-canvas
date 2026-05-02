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
// "3.0.0-rc.2" — release candidate. Closes the chat-perfection arc:
// data contract (`core/dataContract.js`) → first-turn handshake →
// markdown rendering → ack chip → Real-Anthropic tool-use →
// cache_control on stable prefix → SSE per-token streaming. Cleanup
// arc completed (BUG-003..009 architectural fix; v3-prefix purged on
// 5 paths; production mock providers lifted out of tests/). Banner
// 1048/1048 GREEN at tag time. SPEC §S20 / §S25 / §S20.16-19 + RULES
// §16 CH14-CH19 + RULES §17 PR1-PR7 (production-import discipline)
// drive the contract.
//
// Per project_v3_no_file_migration_burden.md the original "real-customer
// .canvas migration smoke" gate is DROPPED. Path to non-suffix "3.0.0":
//   - 5 v2.x view tabs migrated to read via state/adapter.js
//     (Context → Architecture → Heatmap → Workload → Gaps → Reporting)
//   - AI Assist surfaces v3.0 saved skills + dispatches via
//     state/engagementStore.js (AI items 1+2 in the rc-arc plan)
//   - At least one real workshop run against a v3.0 engagement
//   - Real-Anthropic streaming smoke against live key (mock smoke
//     covers all code paths today)

export const APP_VERSION = "3.0.0-rc.2";
