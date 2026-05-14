# Dell Discovery Canvas — Session Handover Template

**Authority**: meta-discipline audit (`docs/SESSION_LOG_2026-05-14-handover-template-audit.md`).
**Purpose**: a fresh-context Claude (or human) loading this template at session start MUST end up at the same discipline level the project has reached — without reading 20+ separate feedback anchors.
**Use**: copy this file as `HANDOFF.md` at session-end; fill the `<placeholders>` with current state.
**Versioning**: every meaningful refactor to this template bumps the date stamp below + records the change in `docs/SESSION_LOG_<date>-handover-template-*.md`.

**Template version**: 1.0 · 2026-05-14

---

## 🔴 TIER-1 DISCIPLINE ANCHORS · READ FIRST · binding contract for every commit

The 5 foundational discipline layers (none can be skipped; each catches different failure modes):

| # | Layer | Anchor doc | Catches |
|---|---|---|---|
| 1 | **Architectural integrity** | `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` (R0–R11 + Philosophy section) | "test banner only" anti-pattern · scope-limited grep tests · pile-fix-don't-revert · backward-compat hacks |
| 2 | **Constitutional governance** | `feedback_5_forcing_functions.md` (Rules A–E, memory anchor) | "constitutional creep" · UI tests without DOM mount · degraded fallback · test-moves-to-match-code · hidden risks |
| 3 | **Spec-driven development** | `feedback_spec_and_test_first.md` + `docs/PREFLIGHT.md` (8 items) | impl-before-spec · skipped RULES update · banner not GREEN at tag |
| 4 | **Real-only validation** | `feedback_no_mocks.md` + `feedback_browser_smoke_required.md` + `feedback_chrome_mcp_for_smoke.md` | mocked LLMs hiding real errors · tests-pass-alone shipping silent boot breakage |
| 5 | **No patches** | `feedback_no_patches_flag_first.md` + `feedback_test_or_it_didnt_ship.md` | "loose shape" / "for now" architectural compromises · bug fixes shipping without regression test |

### The seven non-negotiable rules in plain English

1. **R0 / R10 / R11**: Before any non-trivial edit, write a visible "principal-architect lens" acknowledgment (audit-before-delete summary + smoke plan). Every commit ends with `Browser smoke evidence:` block citing screenshots + flows walked.
2. **Rule A · `[CONSTITUTIONAL TOUCH PROPOSED]`**: Any modification to a constitutional surface (see list below) requires the literal preamble header + Q&A + user explicit approval — *before* code. Per Philosophy: changes are encouraged when justified; the preamble is non-negotiable.
3. **Rule B · Test mounts the UX**: UI behavior tests MUST mount the component and assert rendered DOM. Source-grep is acceptable ONLY for: import-presence, config, file-existence, pure-function unit tests.
4. **Rule C · No degraded fallback**: Entry points with unrecoverable states (no envs / parse error / missing key) are DISABLED with inline blocking error. Never silently fall through to a guaranteed-failure path.
5. **Rule D · Tests don't move to match code**: Failing test = revert impl OR get SPEC re-confirmed. Never edit the test count / assertion to match new code.
6. **Rule E · Hidden risks at this layer**: Every commit body includes a `Hidden risks at this layer:` section listing what's untested, what callers exist, what next maintainer needs to know. Never "n/a".
7. **No push / tag without explicit approval** (`feedback_no_push_without_approval.md`): Commit locally during iterations; `git push` only when user says "push" / "ship it" / "tag it" / "go".

### Constitutional surfaces (Rule A preamble required)

These files/symbols require `[CONSTITUTIONAL TOUCH PROPOSED]` preamble + Q&A + explicit approval before any modification:

- `services/systemPromptAssembler.js` — Layer 1 Role section + behavior examples
- `services/groundingVerifier.js` — verifier behavior contract
- `services/chatService.js` — streamChat integration
- `services/chatHandshake.js` — first-turn handshake protocol
- `services/chatTools.js` — tool registry
- `ui/views/CanvasChatOverlay.js` — chat overlay rendering
- Any `schema/*.js` Zod file (enum changes, field add/remove/rename)
- `core/dataContract.js` — RELATIONSHIPS_METADATA + ENTITY_DESCRIPTIONS + STANDARD_MUTABLE_PATHS
- `state/v3EngagementStore.js` — mutation entry points (`commitX` functions)
- `state/adapter.js` — engagement read/write surface
- Any locked enum or catalog source-of-truth in `core/config.js` (LAYERS, ENVIRONMENTS, BUSINESS_DRIVERS, GAP_TYPES, DISPOSITION_ACTIONS, SERVICE_TYPES, CUSTOMER_VERTICALS, DELL_PRODUCT_TAXONOMY)
- `core/version.js` — APP_VERSION field structure (the constant value itself is non-constitutional)

### Anti-patterns to AVOID this session

- ❌ Touching a constitutional surface without `[CONSTITUTIONAL TOUCH PROPOSED]` preamble + user Q&A
- ❌ UI tests that source-grep instead of mounting the component
- ❌ Committing without R11 four-block ritual + screenshots
- ❌ Tagging without PREFLIGHT items 1–8 ticked
- ❌ Pushing without explicit user direction
- ❌ Any fix that bypasses schema/validation without pre-code user question
- ❌ "For now" / "loose shape" / "consumers don't validate" reasoning
- ❌ Mocks / scripted-LLM / stubbed-fetch (real-only execution)
- ❌ Editing test counts to match new code (Rule D)
- ❌ "Just this once" exceptions (all rules bind equally)
- ❌ Bug-fix authorization treated as arc authorization (always ask separately for adjacent work)

---

## 🟢 Current State · <YYYY-MM-DD · session label>

**Branch**: `<branch-name>`  ·  **HEAD**: `<commit-sha>` (`<commit-title>`)  ·  **APP_VERSION**: `"<3.0.0-rc.X[-dev]>"`  ·  **Banner**: **<X>/<X> GREEN ✅**  ·  **Eval baseline**: `<X.XX>/10` · `<Y>%` pass

**Working tree**: <clean / dirty (N staged, M unstaged)>
**Push status**: <pushed through `<sha>` / N commits unpushed>
**Tag status**: <`v3.0.0-rc.X` tagged / pending user approval / no tag pending>

---

## 🌅 Next Session First Action (resume here)

<One paragraph telling the next agent exactly what to do first.>

**Examples**:

> Past a tag (e.g., rc.8 just shipped):
> First commit MUST bump `core/version.js` `APP_VERSION` to `"3.0.0-rc.9-dev"` per S30.1 R30.1. Also add a `3.0.0-rc.9-dev` block at the top of the comment ledger noting date + in-flight scope. V-VERSION-2 source-grep guards against forgetting.

> Mid-arc (e.g., Sub-arc C scope chosen):
> Resume Sub-arc C — Wire bucket (Example 9 + 10 in `services/systemPromptAssembler.js`). `[CONSTITUTIONAL TOUCH PROPOSED]` preamble required first; user has approved the scope but not yet seen the preamble. Surface the preamble, await approval, then write the SPEC delta + RED tests + impl.

> User direction awaited:
> No work to start. Surface "what's next?" — options are: Sub-arc C scope decision (5 options in `docs/SUB_ARC_B5_DOC_AUDIT_GAP_LIST.md`), BUG-061, BUG-063, gap.closeReason doc-drift.

---

## 📌 Open Fix Plans (sequenced)

| # | Item | Status | Discipline gate | Est. effort | Anchor doc |
|---|---|---|---|---|---|
| 1 | <Item name> | <OPEN / DEFERRED / IN-FLIGHT> | <Rule A / spec-and-test-first / etc.> | <small / medium / large> | <BUG_LOG.md#BUG-XXX / SPEC §SY> |

---

## 🏗️ Constitutional Surfaces This Session Touched

| Commit | Surface | Preamble surfaced? | Q&A captured? | User approval captured? |
|---|---|---|---|---|

(If empty, no constitutional surfaces were touched this session.)

---

## 📜 Commit Ledger · this session · <N> commits

<Organized by sub-arc / theme. Each row cites: SHA · 1-line title · `Browser smoke evidence` block present (Y/N) · linked screenshots.>

### Sub-arc / Theme name

| Commit | Title | R11 Block 4 evidence | Notes |
|---|---|---|---|
| `<sha>` | <title> | <screenshot IDs + flows walked> | <discipline notes if any> |

---

## 🎯 Session Discipline Record

### Anchor compliance (this session)

- **R11 four-block ritual**: <N> / <N> commits cite Browser smoke evidence ✓
- **Rule A constitutional pre-auth**: <list each surface touched + which commit + which preamble captured the Q&A>
- **Rule B test-mounts-UX**: <N> UI tests added; all mount the component (or note exceptions with rationale)
- **Rule C no-degraded-fallback**: <N> entry-point gates audited; <list>
- **Rule D tests-don't-move**: <any test count adjustments? if yes, what SPEC re-confirmation backed them?>
- **Rule E hidden-risks**: <Y / N> all commits include the section
- **PREFLIGHT checklist** (if arc completion / tag):
  - 1a: APP_VERSION `-dev` bump at first-commit-past-tag: <status>
  - 1b: APP_VERSION drops `-dev` at tag time: <status>
  - 2: SPEC change log updated: <status>
  - 3: RULES updated: <status>
  - 4: V-* RED-first then GREEN: <status>
  - 5: Browser smoke (Chrome MCP): <status>
  - 5b: Real-LLM smoke (per `feedback_no_mocks.md`): <status / N/A>
  - 6: RELEASE_NOTES authored: <status>
  - 7: HANDOFF rewritten: <status>
  - 8: Banner GREEN: <status>

### Drift incidents + corrections

<If any rule was violated mid-session, record: which rule + what happened + corrective action + go-forward lock.>

<Example>:
> 2026-05-13 · Sub-arc B-polish commit `4e34d6e` modified `services/systemPromptAssembler.js` without surfacing the `[CONSTITUTIONAL TOUCH PROPOSED]` preamble. User caught it via 4-item review. Option B accepted (keep + document via `docs/SESSION_LOG_2026-05-13-discipline-lapse.md`). Philosophy section added to discipline doc clarifying process-binary vs changes-encouraged. Locked-going-forward: all constitutional surfaces require the preamble regardless of "polish" framing.

---

## 🔗 Recoverability Anchor Chain

If a fresh-context session needs to fully reload the project's discipline state, read in this order:

1. **This file** (`HANDOFF.md`) — current state + tier-1 anchors + first action
2. **`docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md`** — R0..R11 + Philosophy section
3. **memory anchor `feedback_5_forcing_functions.md`** — Rules A–E (auto-loaded via `MEMORY.md`)
4. **`docs/PREFLIGHT.md`** — 8-item tag checklist
5. **`docs/RULES.md` §16** — CH1..CH36 per-feature rules
6. **`docs/v3.0/SPEC.md`** — change log table at bottom (most recent rows = most recent decisions)
7. **`docs/BUG_LOG.md`** — open bugs + closed-with-commit-ref entries
8. **`docs/SESSION_LOG_<latest>.md`** — most recent session narrative + decisions

(`MEMORY.md` auto-loads on every Claude session and references most of these; the chain above is the explicit human-readable path.)

---

## 🌙 Session End Checklist (use BEFORE writing this handover)

Confirm each before considering the session "ended":

- [ ] All commits have `Browser smoke evidence:` block in body
- [ ] All commits include `Hidden risks at this layer:` section
- [ ] Any constitutional-surface commits cite a captured `[CONSTITUTIONAL TOUCH PROPOSED]` Q&A
- [ ] Test banner GREEN at session end (`X/X passed ✅`)
- [ ] If past a tag: PREFLIGHT items 1–8 all ticked
- [ ] If at-tag: real-LLM smoke completed (Anthropic + Gemini + Local A 3-turn each)
- [ ] Working tree clean
- [ ] HANDOFF.md (this template, filled) committed
- [ ] Session log written (`docs/SESSION_LOG_<date>-<theme>.md`) covering: chronological narrative + drift incidents + user-direction quotes + commit ledger
- [ ] `docs/CHANGELOG_PLAN.md` updated (per `feedback_docs_inline.md`)
- [ ] `docs/BUG_LOG.md` updated (close fixed bugs with commit SHAs; log new bugs)
- [ ] Push pending? — surface to user with explicit "push?" question (per `feedback_no_push_without_approval.md`)
- [ ] Tag pending? — surface to user with explicit "tag it?" question

---

## 🧭 Template Maintenance Notes

This template is itself a constitutional artifact (any modification changes how every future session operates).

**To modify this template**:
1. Surface `[CONSTITUTIONAL TOUCH PROPOSED] HANDOVER_TEMPLATE` preamble
2. Capture user Q&A on what's changing + why
3. Update this file
4. Update its template version stamp at the top
5. Record the change in a session log entry

**Things this template deliberately does NOT include** (separation of concerns):
- Project context / what is Dell Discovery Canvas (lives in MEMORY.md + README)
- User role / user preferences (lives in MEMORY.md `user_role.md` anchor)
- v3 architecture details (lives in SPEC §S1..S40)
- Tool reference / how to use Chrome MCP (lives in feedback anchors)
- Specific bug details (lives in BUG_LOG.md)

**Things this template deliberately DOES include** (single source for new-session):
- The 5 tier-1 discipline layers (visible without 5 file reads)
- The constitutional surface list (binding context for any code change)
- The "what to avoid shortcutting" list (anti-patterns made concrete)
- The current state (branch / commit / banner / version / tag)
- The "resume here" pointer (no ambiguity about first action)
- The recoverability anchor chain (8 files in canonical order)
- The session-end checklist (forces hygiene at handoff)
