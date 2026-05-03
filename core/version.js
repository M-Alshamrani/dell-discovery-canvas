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
// **3.0.0-rc.3** (TAGGED 2026-05-03) — closes the rc.3 implementation
// arc + AI-correctness consolidation. Banner 1103/1103 GREEN ✅
// (was 1048 at rc.2 tag; +55 net tests this release).
//
// Rolled into rc.3 tag (origin/v3.0-data-architecture):
//   - Phase A1 generic LLM connector (closes BUG-018; unblocks Gemini
//     + vLLM + local + any OpenAI-compat); commit `e8d17e4`
//   - Phase B concept dictionary (62 concepts × 13 categories;
//     selectConcept tool); commits `0344df7` + `9778f25`
//   - Phase C app workflow manifest (16 workflows + 19 recommendations;
//     selectWorkflow tool); commits `5a05d84` + `5fb48f3`
//   - Skill schema v3.1 — parameters[] + outputTarget; click-to-run
//     scope retired; migration helper at load + save boundaries;
//     parameterized runner; rebuilt Skill Builder UI; chat right-rail
//     populated with saved-skill cards; UseAiButton retired; topbar
//     consolidated to one "AI Assist" button (Dell-blue + diamond-glint
//     8s breathe). Commits `f0dc37f` `da051ce` `5ec646d` `6897321`
//     `83fb93c` `d429b46` `c975d1f`
//   - APP_VERSION discipline + 8-item PREFLIGHT checklist (recovery
//     after rc.2-tag freeze drift); commit `7414b36`
//   - Group A AI-correctness consolidation (rc.3 expanded scope):
//       - BUG-019 fix · v3 engagement persistence + rehydrate-on-boot
//         (SPEC §S31 + RULES CH27); commit `203ef12`
//       - BUG-020 fix · streaming-time handshake strip + shared
//         services/chatHandshake.js; commit `987c7e7`
//       - BUG-013 Path B · runtime UUID-to-label scrub in chat prose
//         (services/uuidScrubber.js); commit `66810c6`
//       - BUG-023 fix · gapPathManifest exposes layerId + gapType;
//         commit `7cf20ec`
//       - BUG-018 verified closed by V-CHAT-32 round-trip; commit
//         `94d203b`
//       - BUG-011 closed (user confirmed Anthropic key save works)
//
// New tests rolled into rc.3 (+55 since rc.2):
//   V-FLOW-CHAT-DEMO-1/2 · V-DEMO-V2-1 · V-DEMO-8/9 · V-CHAT-18..38
//   V-NAME-2 · V-CONCEPT-1..5 · V-WORKFLOW-1..5
//   V-SKILL-V3-1..7 · V-VERSION-1..2
//   V-FLOW-REHYDRATE-1/2/3 · V-PATH-31/32
//   V-TOPBAR-1 · V-LAB-VIA-CHAT-RAIL · V-AI-ASSIST-CMD-K · V-ANTI-USE-AI
//
// SPEC annexes added: §S26 (generic connector) · §S27 (concept dict) ·
// §S28 (workflow manifest) · §S29 (skill v3.1) · §S30 (APP_VERSION
// discipline + PREFLIGHT) · §S31 (engagement persistence)
// RULES added: §16 CH20–CH27
//
// Path to non-suffix "3.0.0" GA (per project_v3_no_file_migration_burden.md):
//   - 5 v2.x view tabs migrated to read via state/adapter.js
//   - UX consolidation arc (rc.5) per `feedback_group_b_spec_rewrite.md`
//     — SPEC rewrite first, window-contract pass, Skill Builder UX
//     rethink, BUG-022 chat polish
//   - At least one real-customer workshop run against a v3.0 engagement
//   - Real-Anthropic streaming smoke against a live key

export const APP_VERSION = "3.0.0-rc.3";
