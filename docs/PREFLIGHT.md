# Pre-flight checklist

Authority: `docs/v3.0/SPEC.md §S30.2` · `docs/RULES.md §16 CH24` · `feedback_spec_and_test_first.md` (locked memory).

This is the durable, checkable artifact gating every tag commit. Every tag's commit message MUST cite which items were ticked + when. Authored 2026-05-03 after the v3.0.0-rc.2 freeze drift surfaced (18 commits past tag without bumping `APP_VERSION`).

---

## When to use this checklist

| Cadence | Items |
|---|---|
| **Per code commit** | Item 8 (banner GREEN). The other items aren't required per-commit. |
| **Per arc** (a chunk of related commits implementing one SPEC annex / one BUG fix) | Items 2, 3, 4, 5, 8 — SPEC + RULES updated; tests RED-first then GREEN; browser smoke. |
| **Per `-dev` arc start** (first commit past a tag) | Item 1a (bump `APP_VERSION` to add `-dev` suffix). |
| **Per tag** (e.g. tagging `v3.0.0-rc.3`) | ALL 8 items. Banner GREEN at tag time; HANDOFF rewritten; RELEASE_NOTES authored. |

---

## The 8 items

### 1. APP_VERSION discipline (per SPEC §S30 + RULES §16 CH24)

- **1a (per arc start past tag)**: After the most recent tag has shipped, the FIRST commit of the next arc MUST bump `core/version.js` `APP_VERSION` to add the `-dev` suffix.
  - Example: tag `v3.0.0-rc.2` shipped → first new commit bumps to `"3.0.0-rc.3-dev"`.
  - Test guard: V-VERSION-1 enforces semver shape; V-VERSION-2 source-greps the chip wiring.
- **1b (at tag time)**: `APP_VERSION` MUST exactly equal the tag name (no `-dev` suffix).
  - Example: tagging `v3.0.0-rc.3` → bump to `"3.0.0-rc.3"` in the same change as the tag.
  - Manual check (V-VERSION-3): browser smoke confirms the topbar chip displays the same value as `APP_VERSION`.

### 2. SPEC §9 phase block / annex updated

- For an arc that implements a NEW SPEC annex (§S20-§S30), the annex itself is the SPEC update.
- For a bug fix or refactor, add a row to the SPEC change log table at the bottom of `docs/v3.0/SPEC.md`.
- Reference the SPEC section that the change implements.

### 3. RULES updated

- New CH-rule added in `docs/RULES.md §16` for any new contract introduced by the arc.
- Existing CH-rule rewritten when the arc changes its scope.
- Rule must include: 1-line summary · 🔴 HARD or 🔵 AUTO marker · test ID(s).

### 4. V-* tests RED-first → GREEN

- Per `feedback_spec_and_test_first.md`: **tests are written BEFORE implementation, observed RED first, then GREEN after the impl lands**. No "test after code" shortcut.
- Per `feedback_test_or_it_didnt_ship.md`: **every BUG fix ships a test that would have caught the original incident** (V-FLOW-* / V-ANTI-* coverage when applicable).
- New V-* IDs slot into the appropriate §T-suite (`docs/v3.0/TESTS.md`).
- Banner XX/XX must be GREEN at the END of the arc (no RED tests left over).

### 5. Browser smoke against the Acme Healthcare demo

- Per `feedback_browser_smoke_required.md`: **tests-pass-alone is necessary but NOT sufficient.** Every tag MUST include a manual browser smoke against the verification spec via Chrome MCP.
- v2.4.11 caught 3 bugs (urgency lock, demo g-004 type, save feedback) that 488 green tests missed. Same risk applies today.
- Smoke must:
  - Load the demo (footer → Load demo).
  - Open the Canvas Chat overlay.
  - Verify the connection-status chip shows the active provider correctly.
  - Verify the topbar version chip displays the expected `APP_VERSION` value (V-VERSION-3 manual check).
  - Ask one definitional question (concept dictionary path).
  - Ask one procedural question (workflow manifest path).
  - Ask one multi-tool question (selectors + multi-round chaining).

### 5b. Real-LLM live-key smoke (NEW rc.6 per SPEC §S37 R37.12 + `feedback_no_mocks.md`)

Mandated starting rc.6 because BUG-030 + BUG-033 only surfaced at workshop time — mock-fetch smoke (item 5 above) was structurally incapable of catching grounding regressions.

For every tag from rc.6 onward, run a real-LLM 3-turn workshop-style smoke against the Acme Healthcare demo for **each provider**:

- **Anthropic** (claude-sonnet-4 or claude-opus-4 with valid `x-api-key`)
- **Gemini** (gemini-2.5-flash with valid API key)
- **Local A** (vLLM Code-LLM at port 8000 with `--enable-auto-tool-choice --tool-call-parser hermes`)

Per provider, run 3 turns covering:
1. **Fact-retrieval** ("summarize the gaps") — verifier-side check that no fabricated gap descriptions appear.
2. **Vendor query** ("find the dell assets in current state") — router classifies → selectVendorMix + selectMatrixView; response paraphrases the engagement's real vendor mix.
3. **Multi-cut question** ("what dispositions does the customer have?") — router calls multiple selectors; response cites real engagement entities only.

For each turn, inspect the wire body via Chrome DevTools Network panel:
- Layer 4 of the system prompt MUST contain selector results from the router's `rationale` (not raw engagement dump, not threshold-based summary).
- Response paraphrases real engagement data; no fabricated gaps / vendors / project-phase dates.
- Zero `groundingViolations` recorded on the assistant message envelope.
- `[contract-ack v3.0 sha=<8>]` chip appears on turn 1.

If any provider produces a violation: tag is BLOCKED until the verifier patterns are tightened or the underlying grounding flow is fixed. Real-LLM smoke is the validation layer; nothing replaces it.

**No mocks acceptable here** (per `feedback_no_mocks.md`). The mock provider toggle is scheduled for retirement in the post-rc.6 mock-purge arc; until then it must NOT be the path used for tag-time smoke.

### 6. RELEASE_NOTES authored

- File: `docs/RELEASE_NOTES_<tag>.md` (e.g. `RELEASE_NOTES_rc.3.md`).
- Captures: scope of the tag, list of commits + their tests, banner count at tag time, browser-smoke confirmations, any deferred items, known issues / open BUGs.
- Tag-only (not per arc).

### 7. HANDOFF.md rewritten

- The top section of `HANDOFF.md` reflects the freshly-tagged state so a brand-new session can pick up coherently.
- Contains: APP_VERSION value · banner count · what's in the tag · what's queued · architecture pointers (SPEC §, RULES §, key files).
- Tag-only (not per arc).

### 8. Banner XX/XX GREEN (no RED tests)

- At the END of the arc + at tag time, the test banner reports `All N tests passed ✅`.
- Per-arc banners may temporarily go RED (V-* tests RED-first) but MUST end GREEN before the arc commit lands.

---

## Citing the checklist in commit messages

Every tag commit + arc-final commit cites the checklist:

```
v3.0.0-rc.3 . tag . PREFLIGHT items 1-8 verified

  1a (n/a — drops -dev at tag) ✓
  1b APP_VERSION = "3.0.0-rc.3" ✓
  2  SPEC §9 phase block + §S29 (skill v3.1) updated ✓
  3  RULES §16 CH23 added ✓
  4  V-SKILL-V3-1..7 RED-first → GREEN; V-VERSION-1..2 added ✓
  5  Browser smoke against Acme Healthcare demo passed (chat,
     concepts, workflows, multi-round) ✓
  6  docs/RELEASE_NOTES_rc.3.md authored ✓
  7  HANDOFF.md rewritten ✓
  8  Banner 1095/1095 GREEN ✅
```

Per-arc commits cite the subset that applies (items 2-5 + 8).

---

## Anti-pattern history (for reference)

The drift this checklist guards against:
- 2026-05-02 LATE EVENING: 18 commits shipped past the v3.0.0-rc.2 tag without bumping `APP_VERSION`. Topbar chip displayed `Canvas v3.0.0-rc.2` while HEAD had Phase A/B/C + Skill v3.1 schema migration + 7 BUG fixes. Per-commit discipline was rigorous; cross-commit pre-flight discipline was not durable. This checklist + V-VERSION-1/2 + RULES §16 CH24 close the gap.
