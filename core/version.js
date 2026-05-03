// core/version.js — APP_VERSION single source of truth
//
// Per SPEC §S30 + RULES §16 CH24, this is the runtime-visible version
// string. The topbar chip + every UI surface that wants to display the
// version MUST import APP_VERSION from this file. Hard-coded version
// strings anywhere else are FORBIDDEN.
//
// Lifecycle (per S30.1):
//   <X>.<Y>.<Z>            release tag
//   <X>.<Y>.<Z>-rc.<N>     release-candidate tag
//   <X>.<Y>.<Z>-rc.<N>-dev between rc.<N> and the next tag
//   <X>.<Y>.<Z>-dev        pre-first-rc dev
//
// **Rule R30.1**: the FIRST commit past a tag MUST add the `-dev`
// suffix. Failure to do so creates the rc.2-tag freeze drift caught
// 2026-05-03 (V-VERSION-2 source-grep is the regression guard).
// **Rule R30.2**: at tag time, the value drops the `-dev` suffix in
// the same change that creates the tag.
//
// Distinct from:
//   - engagement.engagementMeta.schemaVersion — the *engagement schema*
//     version (migrator contract; "2.0" today, target "3.0"). Has
//     nothing to do with what build of the app is running.
//   - git tags — runtime code doesn't read git; this string is the
//     runtime-visible version.
//
// ---
//
// **3.0.0-rc.3-dev** (2026-05-03) — between v3.0.0-rc.2 (tagged
// 2026-05-02 PM at 1048/1048) and the eventual v3.0.0-rc.3 tag.
//
// In flight on this -dev period (committed but not yet tagged):
//   - Phase A1 generic LLM connector — closes BUG-018; unblocks Gemini
//     + vLLM + local + any OpenAI-compat (commit `e8d17e4`)
//   - Phase B concept dictionary — 62 concepts × 13 categories;
//     selectConcept(id) tool wired (commits `0344df7` + `9778f25`)
//   - Phase C app workflow manifest — 16 workflows + 19 recommendations;
//     selectWorkflow(id) tool wired (commits `5a05d84` + `5fb48f3`)
//   - Skill schema v3.1 (per SPEC §S29): outputTarget + parameters[];
//     migration helper at load + save boundaries; runner parameterized
//     invoke (commits `f0dc37f` + `da051ce`)
//   - 7 BUG fixes (BUG-010..017) shipped on top of rc.2; BUG-018..022
//     queued in BUG_LOG
//   - SPEC §S26 + §S27 + §S28 + §S29 + §S30 + RULES §16 CH20..24 added
//
// rc.3 tag will land when:
//   - rc.3 #4-#7 of the §S29.9 plan ships (Skill Builder UI rebuild
//     + chat right-rail population + UseAiButton retirement + top-bar
//     consolidation)
//   - PREFLIGHT.md items 1-8 verified
//   - HANDOFF.md rewritten + RELEASE_NOTES_rc.3.md authored
//
// Path to non-suffix "3.0.0" GA (per project_v3_no_file_migration_burden.md):
//   - 5 v2.x view tabs migrated to read via state/adapter.js
//   - At least one real-customer workshop run against a v3.0 engagement
//   - Real-Anthropic streaming smoke against a live key

export const APP_VERSION = "3.0.0-rc.3-dev";
