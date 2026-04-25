# Onboarding · Dell Discovery Canvas

**Welcome.** This document is your guided ramp-up. Three sections: **Day 1**, **Week 1**, **Month 1** — read each before tackling the next.

> **Stop-and-ask markers** (⚠) appear throughout. When you hit one, escalate to the project owner before proceeding.

---

## Day 1 · Run it · 2 hours

### Goal
Have the app running on your machine, walked the demo end-to-end, and read enough docs to understand "why this exists".

### Steps

1. **Install Docker Desktop** (Windows / macOS) or Docker Engine (Linux). Verify: `docker version` prints without error.
2. **Clone the repo**:
   ```bash
   git clone https://github.com/M-Alshamrani/dell-discovery-canvas.git
   cd dell-discovery-canvas
   ```
3. **Start the container**:
   ```bash
   docker compose up -d --build
   curl http://localhost:8080/health   # → ok
   ```
4. **Open the app**: `http://localhost:8080` in an incognito window. Wait for the green test banner ("✅ All 509 tests passed"). Auto-dismisses after 5 s.
   - ⚠ **Stop-and-ask** if you see a red banner. Either tests are failing (bug) or your environment is wrong.
5. **Walk the demo**: follow [docs/wiki/tutorials/run-first-workshop.md](docs/wiki/tutorials/run-first-workshop.md) — Tabs 1-5, Reporting Roadmap, optional AI skill.
6. **Read these in order** (Day-1 reading list):
   - [README.md](README.md) — project front door.
   - [HOW_TO_RUN.md](HOW_TO_RUN.md) — the user-facing run guide (you'll point reviewers at this).
   - [SPEC.md §0 + §1](SPEC.md) — North Star + Design Invariants. **Most important 2 minutes of your day**.
   - [docs/wiki/explanation/diagrams/context.md](docs/wiki/explanation/diagrams/context.md) — where this thing sits in the world.
7. **Stop**. Take notes on confusions; flag them tomorrow.

### Day-1 checklist

- [ ] Docker running.
- [ ] App served on `http://localhost:8080`.
- [ ] Green test banner observed.
- [ ] Walked demo through Tabs 1-5.
- [ ] Read SPEC §0-§1 + context diagram.
- [ ] Confusions noted.

---

## Week 1 · Understand it · 6-8 hours total

### Goal
By end of week, you can read any source file and recognise its layer + role; you can explain the AI platform contract; you can identify a "good first contribution".

### Reading list (in order)

1. **[SPEC.md §2](SPEC.md)** — Data Model. Every entity, every field. Refer back to this often.
2. **[SPEC.md §3 + §4](SPEC.md)** — Configuration + Visual Language.
3. **[SPEC.md §12](SPEC.md)** — AI Platform Specification. **Authoritative; load-bearing for every AI feature.**
4. **[docs/RULES.md](docs/RULES.md)** — rules-as-built audit (90+ rules tagged 🔴HARD / 🟡SOFT / 🔵AUTO / 📦MIGRATE). Skim, mark surprises.
5. **Latest 5 entries in [docs/CHANGELOG_PLAN.md](docs/CHANGELOG_PLAN.md)** — most recent shipped phases. Get a sense of pace.
6. **3 ADRs** (read these, mark which decisions you'd have made differently):
   - [ADR-001 vanilla-JS / no build](docs/adr/ADR-001-vanilla-js-no-build.md) — load-bearing.
   - [ADR-004 responseFormat × applyPolicy](docs/adr/ADR-004-unified-output-behavior.md) — AI platform spine.
   - [ADR-008 undo stack hybrid](docs/adr/ADR-008-undo-stack-hybrid.md) — illustrative trade-off.
7. **[docs/wiki/explanation/diagrams/components.md](docs/wiki/explanation/diagrams/components.md)** — module-level layout.
8. **[docs/wiki/explanation/diagrams/data-model-er.md](docs/wiki/explanation/diagrams/data-model-er.md)** — entity-relationship picture.
9. **[INVARIANTS.md](INVARIANTS.md)** — the always-true list.
10. **[docs/wiki/reference/GLOSSARY.md](docs/wiki/reference/GLOSSARY.md)** — domain vocabulary. **Read this twice**; some terms (like "primary layer", "writable path", "two-surface rule") come up daily.

### Hands-on exercises

- **Exercise 1** — read [`interactions/gapsCommands.js`](interactions/gapsCommands.js) end-to-end (~260 LOC). Identify every place that mutates `session.gaps`. Confirm the "only `interactions/*` mutates" invariant holds.
- **Exercise 2** — find a `console.warn` in the codebase. Trace why it's there. (Most are in the Phase 17 migrator; one is in the undo stack.)
- **Exercise 3** — open DevTools → Application → Local Storage. Find each of the 4 keys catalogued in [docs/wiki/reference/localStorage-keys.md](docs/wiki/reference/localStorage-keys.md). Inspect their JSON.
- **Exercise 4** — run the 509 tests and pick 3 that surprise you. Read the implementation that satisfies them.

### Identify a good first contribution

The HANDOFF backlog has Buckets A-E with locked or open scope. For Week-1, **don't pick from Bucket B** (crown-jewel UX) — too much surface area for a first contribution. Good first-issue candidates:

- A new how-to in [docs/wiki/how-to/](docs/wiki/how-to/) following the existing pattern (e.g., "Add a new disposition / Action type"). Pure docs.
- An auto-derived reference table that needs refresh post-shipped-change. Pure docs.
- A small piece of the v2.4.12 services scope (locked spec in [docs/CHANGELOG_PLAN.md § v2.4.12](docs/CHANGELOG_PLAN.md)) — pair with the project owner before starting.

⚠ **Stop-and-ask** before opening a PR if your change touches:
- Any data-model field shape (triggers the two-surface rule — see [feedback_foundational_testing.md memory](.claude/projects/...) and [ADR-007](docs/adr/ADR-007-skill-seed-demosession-separation.md)).
- The migrator chain in `state/sessionStore.js`.
- Any `interactions/*Commands.js` file.
- The nginx config or entrypoint scripts.

### Week-1 checklist

- [ ] Read SPEC §2, §3, §4, §12.
- [ ] Skimmed RULES.md and marked surprises.
- [ ] Read 3 ADRs.
- [ ] Read all 4 explanation diagrams.
- [ ] Read GLOSSARY.md twice.
- [ ] Completed exercises 1-4.
- [ ] Identified a good-first-issue candidate; discussed with project owner.

---

## Month 1 · Ship something · 4-8 hours of focused work

### Goal
By end of month, you've shipped one small backlog item end-to-end (spec → code → tests → smoke → tag). You understand the **process** as well as the codebase.

### Reading list (in order)

1. **All 9 ADRs** — every one, even the ones that look "not relevant to my work". They'll come up.
2. **All ~10 files in [.claude/projects/.../memory/](.claude/projects/...)** — auto-loaded into every Claude Code session in this project. Important for understanding the team's discipline (browser-smoke required, two-surface rule, naming standard, etc.).
3. **[CONTRIBUTING.md](CONTRIBUTING.md)** — branch / commit / PR conventions.
4. **[docs/operations/RUNBOOK.md](docs/operations/RUNBOOK.md)** — deploy + rollback + recovery procedures.
5. **[docs/operations/RISK_REGISTER.md](docs/operations/RISK_REGISTER.md)** — known risks; bearing on what's safe to change.

### Pick a backlog item from HANDOFF Buckets A-E

Match the size to your first month: ~3-4 hours of focused work, single tag, clear test criteria. Discuss the choice with the project owner before starting.

### Process

The full functional-release workflow:

1. **Spec** — write the scope into `docs/CHANGELOG_PLAN.md` BEFORE code (per `feedback_docs_inline.md`).
2. **Code** — feature branch named after the phase (e.g., `phase-19l-services-scope`).
3. **Tests** — ALL changes must have green tests. Failing test = fix the implementation, not the test ([SPEC §1 invariant 1](SPEC.md)).
4. **Two-surface treatment** if your change touches data-model fields — demo + seed + demoSpec + DEMO_CHANGELOG entry in the same commit ([ADR-007](docs/adr/ADR-007-skill-seed-demosession-separation.md)).
5. **Browser smoke** — manual Chrome MCP smoke against your verification spec (`feedback_browser_smoke_required.md`). Tests-pass-alone is NOT enough.
6. **Pause for "tag it" approval** from the project owner.
7. **Tag, push, update HANDOFF + memory + CHANGELOG_PLAN status flip** in the same wrap-up.

### Month-1 checklist

- [ ] Read all 9 ADRs.
- [ ] Read all memory files in the auto-memory tree.
- [ ] Read CONTRIBUTING + RUNBOOK + RISK_REGISTER.
- [ ] Picked a backlog item; aligned with project owner.
- [ ] Wrote scope to CHANGELOG_PLAN.
- [ ] Implemented + tested + browser-smoked.
- [ ] Got "tag it" approval.
- [ ] Tagged + pushed + updated HANDOFF + memory + CHANGELOG_PLAN.

---

## Stop-and-ask escalation

Always escalate **before** acting if:

- You're considering changing a `🔴 HARD` rule in [docs/RULES.md](docs/RULES.md).
- You'd need to remove a green test to make a change land.
- You're about to add an npm dependency or a build step (violates [ADR-001](docs/adr/ADR-001-vanilla-js-no-build.md)).
- A change crosses the "only `interactions/*` mutates" invariant.
- You're touching session-shape JSON in a way that needs a migrator entry.
- You're about to push to `origin` without explicit approval.
- Anything related to `.canvas` file format compatibility (users have saved files; back-compat is real).

When in doubt, ask. The project values discipline over velocity; a 5-minute clarification beats a 5-hour rewrite.

---

## Where to ask

- **Project owner**: open an issue on the GitHub repo (https://github.com/M-Alshamrani/dell-discovery-canvas) or message directly.
- **Architectural questions**: read the relevant ADR first; if the ADR doesn't answer it, that's a sign the ADR needs an update — flag in your question.
- **Bug reports**: GitHub issue with "bug" label, include browser + container version + steps to reproduce.

Welcome aboard.
