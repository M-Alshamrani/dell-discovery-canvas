# Session Priming Prompt · Dell Discovery Canvas

**Version**: 1.0 · 2026-05-14
**Use**: Paste the prompt below as the FIRST message in every new (fresh-context) Claude session working on Dell Discovery Canvas.
**Versioning**: any meaningful change to this prompt bumps the version stamp + records the change in a session log.

---

## The priming prompt (copy + paste)

```
Read C:/Users/Mahmo/Projects/dell-discovery/HANDOFF.md in full BEFORE anything else.

HANDOFF.md is the single entry point for everything you need to operate at production discipline level on Dell Discovery Canvas:

  - 5 TIER-1 discipline layers (architectural integrity, constitutional governance, spec-driven development, real-only validation, no patches)
  - 7 non-negotiable rules in plain English (R0/R10/R11, Rules A-E, no push without approval)
  - 10+ constitutional surfaces (files/symbols requiring [CONSTITUTIONAL TOUCH PROPOSED] preamble before any modification)
  - 11 anti-patterns to AVOID this session
  - Current branch, HEAD, APP_VERSION, banner, eval baseline, push status, tag status
  - The "Next Session First Action" pointer (what you're picking up)
  - Open fix plans table (sequenced with discipline gates + effort estimates)
  - Recoverability anchor chain (10 files in canonical read-order for deeper context)

After reading HANDOFF.md, acknowledge with this exact structure:

  ## Session priming ack

  **5 discipline layers**:
  1. <name>: <what it locks · one line>
  2. <name>: <what it locks · one line>
  3. <name>: <what it locks · one line>
  4. <name>: <what it locks · one line>
  5. <name>: <what it locks · one line>

  **Current state**:
  - Branch: <name>
  - HEAD: <sha> (<commit title>)
  - APP_VERSION: <value>
  - Banner: <X>/<X> GREEN
  - Eval baseline: <X.XX>/10 · <Y>% pass
  - Push status: <pushed / N unpushed>
  - Tag status: <tagged / pending user / no tag pending>

  **First action** (from HANDOFF.md "Next Session First Action" section):
  <one paragraph quoting or paraphrasing the action you're about to take · cite SPEC/RULES references>

  **Blocking questions** (if any):
  <list anything ambiguous in HANDOFF.md OR state "none — proceeding">

Then STOP and wait for my "go" / direction before any code, SPEC, or commit work. If the first action is purely "surface a decision to the user" (no code touch), do that as part of the ack — but still wait for direction before any code change.

Hard rules that override anything else (also in HANDOFF.md):

  - NEVER touch a constitutional surface (10+ files listed in HANDOFF.md) without surfacing the [CONSTITUTIONAL TOUCH PROPOSED] literal header + capturing user Q&A FIRST
  - NEVER push or tag without explicit user direction ("push" / "ship it" / "tag it" / "go")
  - NEVER commit without R11 four-block ritual + Browser smoke evidence block + Hidden risks at this layer section
  - NEVER use mocks / scripted-LLM / stubbed-fetch (real-only execution per feedback_no_mocks.md)
  - NEVER edit a test count or assertion to match new code (Rule D · failing test = revert impl OR re-confirm SPEC first)
  - NEVER take bug-fix authorization as arc authorization (each constitutional touch needs its own preamble)
  - NEVER ship a fix that bypasses schema/validation without surfacing the architectural question FIRST (feedback_no_patches_flag_first.md)

If anything in HANDOFF.md is ambiguous or seems contradictory, surface the question in your ack — do NOT guess or proceed silently.
```

---

## Why this works

This is a one-shot pointer that makes the new agent:

1. **Read the canonical source** (HANDOFF.md) instead of guessing from project name or memory anchors alone
2. **Produce a structured ack** so you (the user) immediately see whether the agent loaded the right state — mismatched banner/APP_VERSION/branch = stale state, agent goes back and re-reads
3. **Stop before any code** — even if the agent thinks it knows the first action, it waits for your "go". This catches the "I think I know what to do" failure mode that bypasses Rule A discipline.
4. **Cite the hard rules verbatim** — the priming prompt lists the 7 NEVERs in case HANDOFF.md gets stale or the agent skims past them. Belt-and-braces.

## When to update this prompt

- When the template (`docs/HANDOVER_TEMPLATE.md`) structure changes — the priming prompt's "what HANDOFF.md contains" list must match
- When a new tier-1 anchor lands (e.g., a 6th foundational discipline layer)
- When a new "NEVER" rule is added (e.g., from a new memory anchor)
- When the recoverability chain grows (new canonical doc to read)

Each change bumps the version stamp at the top + a session log entry records the rationale.

## Where to store this for easy access

Three options (pick what works for you):

1. **In the repo** (this file) — durable, versioned, agent can read it directly when you mention `docs/SESSION_PRIMING_PROMPT.md`
2. **As a saved snippet in your password manager / clipboard manager** — fastest to paste; just keep a personal copy synced from this file
3. **Both** — repo version is canonical; clipboard version is the daily-use copy

---

## Variants for specific scenarios

The default prompt above handles 90%+ of cases. For unusual scenarios:

### Variant A · Post-incident recovery (e.g., a recent revert)

Append to the default prompt:

```
NOTE: a recent commit was reverted (commit <sha>). Before any new work,
read docs/SESSION_LOG_<incident-date>.md to understand what caused the
revert and what the corrective lock is.
```

### Variant B · Mid-arc resumption (e.g., partway through Sub-arc C wire bucket)

Append to the default prompt:

```
NOTE: you're resuming Sub-arc <X> mid-flight. The prior session ended
at commit <sha> with <RED test count> RED tests captured. Resume by
reading docs/SESSION_LOG_<latest>.md AND HANDOFF.md, then check the
test banner to confirm the RED state before proceeding to impl.
```

### Variant C · Tag-time session

Append to the default prompt:

```
NOTE: this session is targeting a tag. The PREFLIGHT 8-item checklist
(docs/PREFLIGHT.md) MUST be all-ticked before tagging. Surface each
item's status in your ack. Real-LLM smoke (PREFLIGHT 5b) is mandatory
for rc.6+ tags.
```

---

## Cross-references

- `docs/HANDOVER_TEMPLATE.md` v1.0 — the template this priming prompt points to
- `HANDOFF.md` — the filled instance of the template (current session state)
- `docs/PRINCIPAL_ARCHITECT_DISCIPLINE.md` — R0..R11 + Philosophy section
- `MEMORY.md` (user's Claude memory) — auto-loaded discipline corpus
