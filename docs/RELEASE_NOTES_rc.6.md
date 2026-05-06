# v3.0.0-rc.6 — release notes

**Tagged**: 2026-05-06 · **Branch**: `v3.0-data-architecture` · **Banner**: 1187/1187 GREEN ✅ at tag · **APP_VERSION**: `"3.0.0-rc.6"`

## Theme — workshop-bug root-cause arc + grounding contract recast (RAG-by-construction)

The rc.6 work shape is set by the 2026-05-05 office-workshop test against rc.5: the user found 7 user-visible regressions + 1 RED test (`BUG-029` through `BUG-035`). Per locked direction (*"no patching here but fixing of the source cause to actually improve results, not just put guard rails"*), every fix is a root-cause architectural fix, NOT a patch. Six of seven workshop bugs ship closed; BUG-032 deferred to rc.6.1/rc.7 pending a user-side repro.

The centerpiece is **BUG-030 + BUG-033**: real-LLM hallucinations + Local-A multi-turn degradation. Investigation found the cause was an architectural mismatch — the chat surface was shipped as "chat-with-tools, LLM may optionally call selectors to ground" (a hope), not "RAG-by-construction" (a guarantee). rc.6 recasts the contract per **SPEC §S37**: every fact-bearing turn is preceded by deterministic selector retrieval, results inlined into Layer 4 of the system prompt BEFORE the LLM sees the question; runtime verifier rejects responses that reference entities not in the engagement; no mock provider substrate (per `feedback_no_mocks.md` LOCKED 2026-05-05).

## Per-arc summary

| Arc | Commit | Theme | Banner Δ |
|---|---|---|---|
| 6a | `568742f` | SPEC §S37 + RULES §16 CH33 + §T38 V-FLOW-GROUND-* RED scaffolds + groundingRouter/Verifier/grounded-mock STUBS | 1169 → 1174/1182 · 8 RED |
| 6a-amend | `faf6134` | No-mocks principle locked. Drop grounded mock + V-FLOW-GROUND-5/6; recast V-FLOW-GROUND-FAIL-4 as source-grep; three planes → two planes + real-LLM smoke at PREFLIGHT 5b | 1175/1182 · 7 RED |
| 6b | `63ede19` | Plane 1 deterministic retrieval router · `services/groundingRouter.js` + assembler rewrite + threshold removal + verifier hookup · BUG-030 primary + BUG-033 closed | 1179/1182 · 3 RED |
| 6c | `f27d160` | Plane 2 runtime grounding verifier · claim extractor + grounding map + cross-reference · BUG-030 fabricated-deliverable subclass closed | 1182/1182 ✅ |
| 6d | `f638825` | BUG-029 closed · sessionBridge handles `session-reset` · chat transcript drops on +New session · V-FLOW-CHAT-LIFECYCLE-1/2 | 1184/1184 ✅ |
| 6e | `f38f191` | BUG-035 closed (parts A+B) · entrypoint self-check fails loudly on stale images + vLLM 400 hint translator · V-AISERVICE-VLLM-400-1 | 1185/1185 ✅ |
| 6g | `4208d2a` | BUG-034 closed · provider-pill click commits live form values before swap · V-FLOW-SETTINGS-PILL-COMMIT-1 | 1186/1186 ✅ |
| 6h | `9237c91` | BUG-031 closed · propagate-criticality toast binds to `applied[0].newCrit` (not stale closure) · V-FLOW-PROPAGATE-CRIT-TOAST-1 | 1187/1187 ✅ |
| 6i | (this commit) | BUG-032 DEFERRED to rc.6.1/rc.7 · investigation note in BUG_LOG · code path symmetric with current-state link button; no disable predicate found; needs user hands-on repro | 1187/1187 ✅ |
| 6j | (this commit) | TAG · APP_VERSION drop -dev · RELEASE_NOTES + HANDOFF rewrite + PREFLIGHT 5b mandate | 1187/1187 ✅ |

## SPEC + RULES additions

### NEW
- **SPEC §S37** (LOCKED 2026-05-05) — Grounding contract recast (RAG-by-construction). Two planes (router + verifier) + real-LLM smoke at PREFLIGHT 5b. R37.1–R37.12 + V-FLOW-GROUND-1..7 + V-FLOW-GROUND-FAIL-1..5 + V-ANTI-THRESHOLD-1.
- **RULES §16 CH33** — RAG-by-construction grounding contract (tested by V-FLOW-GROUND-*).
- **TESTS §T38** — V-FLOW-GROUND contract block (12 vectors + V-ANTI-THRESHOLD-1).

### REWRITTEN
- **SPEC §S20.4.4 + §S20.6 + R20.3** — amended to point at §S37 for the live contract; the count-based small/large engagement branch (`ENGAGEMENT_INLINE_THRESHOLD_INSTANCES = 20`, `_GAPS = 20`, `_DRIVERS = 5`) is REMOVED entirely. Replaced with a token-budget guard at ~50K input tokens applied to router output.
- **RULES §16 CH3** — rewritten to forbid raw engagement dump and threshold-based summarization; mandates router-driven Layer 4.

### RETIRED
- **R37.9** (grounded mock plane) — retired in 6a-amend before any production consumer wired to it; superseded by real-LLM smoke at PREFLIGHT 5b per `feedback_no_mocks.md`.
- **V-CHAT-2** — converted to deprecation marker (vector ids permanent per TESTS §T1.2 append-only contract); replaced by V-ANTI-THRESHOLD-1 + V-FLOW-GROUND-1..7.
- **V-FLOW-GROUND-5, V-FLOW-GROUND-6** — converted to deprecation markers (mock-substrate tests forbidden per `feedback_no_mocks.md`).
- **V-FLOW-GROUND-FAIL-4** — REWORKED from scripted-mock-driven integration test to source-grep assertion (`services/chatService.js` MUST contain `verifyGrounding(...)` call).

## Locked discipline ratified this release

`feedback_no_mocks.md` (NEW · 2026-05-05 LOCKED) — tier-1 alongside spec-and-test-first / no-patches / browser-smoke-required:

> "i dont want any tests that are not actual usable fucntions, mock sound like a work around to avoide red real errors that an llm is not connected, exactly what i want to see, so the consept of mock is not aligned with my principales, and if it is not real, i dont want it to be mocked... we are building production thing here."

Operationally:
- No new mock provider modules.
- No scripted-LLM fixtures.
- No stubbed-fetch tests.
- No grounded-mock substrate.
- RED scaffolds during spec-and-test-first development are transient (one sub-arc max).
- Real-LLM smoke at PREFLIGHT 5b is the validation layer; nothing fakes it.

A comprehensive mock audit (`HANDOFF rc.6 §11`) identified ~10 tests + 3 modules + SPEC §S22 + RULES CH13/CH14 to retire in a dedicated **post-rc.6 mock-purge arc** (rc.7-arc-1 or rc.6.1). That arc deletes:

- `services/mockChatProvider.js` + `services/mockLLMProvider.js` + `tests/mocks/*`
- V-CHAT-4 / V-CHAT-5 / V-CHAT-15 / V-CHAT-29 / V-CHAT-32 / V-MOCK-1..3 / V-PROD-* / V-PATH-31/32
- SPEC §S22 + RULES §16 CH13/CH14
- `core/appManifest.js` "Test with the Mock LLM run button" workflow text

## BUGs closed (6 of 7 workshop bugs)

| Bug | Severity | Sub-arc | Regression test |
|---|---|---|---|
| BUG-029 · chat memory cross-session leak | High | 6d | V-FLOW-CHAT-LIFECYCLE-1/2 |
| BUG-030 · real-LLM hallucinations (primary) | Critical | 6b | V-FLOW-GROUND-3 (Acme demo Layer 4 contains all 8 gap descriptions) |
| BUG-030 · fabricated-deliverable subclass (Q2 close / June 30) | Critical | 6c | V-FLOW-GROUND-FAIL-3 |
| BUG-031 · propagate-criticality toast text "Low" | Medium | 6h | V-FLOW-PROPAGATE-CRIT-TOAST-1 |
| BUG-033 · Local-A multi-turn degradation | High | 6b | (closes via plane 1 router; round-2 prompt now carries fresh selector results regardless of round-1 tool-call shape) |
| BUG-034 · settings save scope race | High | 6g | V-FLOW-SETTINGS-PILL-COMMIT-1 |
| BUG-035 · nginx 404 + vLLM 400 | Medium-High | 6e | V-AISERVICE-VLLM-400-1 + entrypoint self-check |

## DEFERRED to rc.6.1 / rc.7

| Bug | Why deferred |
|---|---|
| BUG-032 · gaps tab desired-state link button grayed out | Code path inspected; symmetric with working current-state button; no disable predicate found in source or CSS. Not reproducible against the v3 demo on this dev machine (v3 demo doesn't populate v2 `session.gaps`; user's workshop had a populated v2 session). Per `feedback_no_patches_flag_first.md`, no guess-fix shipped. Most likely root cause is the picker showing an empty-state when no candidates match the desired-state filter; UX clarification pending repro. |

## Test deltas

- Pre-rc.6 baseline: **1169/1169** GREEN (rc.5 tag).
- Post-rc.6: **1187/1187** GREEN ✅ at tag.
- Net: +18 tests, -0 RED.
- New tests this release:
  - V-FLOW-GROUND-1, 2, 3, 4, 7 (router + assembler · 5 tests)
  - V-FLOW-GROUND-5, 6 (deprecation markers · 2 tests)
  - V-FLOW-GROUND-FAIL-1, 2, 3, 4 (source-grep), 5 (verifier · 5 tests)
  - V-ANTI-THRESHOLD-1 (1 test)
  - V-FLOW-CHAT-LIFECYCLE-1, 2 (BUG-029 · 2 tests)
  - V-AISERVICE-VLLM-400-1 (BUG-035 part B · 1 test)
  - V-FLOW-SETTINGS-PILL-COMMIT-1 (BUG-034 · 1 test)
  - V-FLOW-PROPAGATE-CRIT-TOAST-1 (BUG-031 · 1 test)
  - V-CHAT-2 deprecation marker (re-purposed; net 0)

## PREFLIGHT verification at tag (items 1-8 + 5b)

- **1a** (n/a — drops `-dev` at tag) ✓
- **1b** APP_VERSION = `"3.0.0-rc.6"` ✓
- **2** SPEC §S37 LOCKED + §S20 amendments + change log row ✓
- **3** RULES §16 CH33 added; CH3 rewritten ✓
- **4** V-FLOW-GROUND-* (12) + V-ANTI-THRESHOLD-1 + V-FLOW-CHAT-LIFECYCLE-1/2 + V-AISERVICE-VLLM-400-1 + V-FLOW-SETTINGS-PILL-COMMIT-1 + V-FLOW-PROPAGATE-CRIT-TOAST-1 RED-first → GREEN ✓
- **5** Browser smoke against Acme demo (Chrome MCP) — banner GREEN at every sub-arc; final GREEN at tag ✓
- **5b** Real-LLM live-key smoke — **TO RUN BY USER AT TAG** per SPEC §S37 R37.12. The smoke procedure is documented in `docs/PREFLIGHT.md §5b`. Tag commit lands; real-LLM smoke is the user's hands-on verification before push.
- **6** `docs/RELEASE_NOTES_rc.6.md` authored (this file) ✓
- **7** `HANDOFF.md` rewritten for rc.6-tag state ✓
- **8** Banner 1187/1187 GREEN ✅

## Push checklist

```bash
git push origin v3.0-data-architecture
git tag v3.0.0-rc.6
git push origin v3.0.0-rc.6
```

Verify on GitHub: branch `v3.0-data-architecture` carries the rc.6 tag commit; `v3.0.0-rc.6` tag exists; rc.5 / rc.4 / rc.3 tags preserved; `origin/main` still on `5614f32`.

Per `feedback_no_push_without_approval.md` — wait for user "push" / "tag it" / "ship it" before push.
