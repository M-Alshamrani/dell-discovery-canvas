# Release notes

User-facing release notes. Different audience from [`docs/CHANGELOG_PLAN.md`](docs/CHANGELOG_PLAN.md) (engineer-facing planning trail). One section per tag. Plain language: "what got better for you, the workshop user."

For technical detail, links to the engineering changelog are at the bottom of each entry.

---

## v2.4.11 · Rules Hardening + Visible-Rules UX (2026-04-25)

**Headline**: the app now explains itself. Rules that used to be invisible are now visible chips, badges, and toasts.

What's new:
- **Lock / auto toggle on Urgency**: pin a gap's urgency so propagation doesn't overwrite it.
- **Auto-draft toast** when a Tab-3 disposition creates a gap on Tab 4 — you see the new gap appear.
- **"Review all →" button** lets you go through every auto-drafted gap in sequence.
- **"Show closed gaps" filter** on Tab 4 — closed gaps are no longer deleted; they're hidden but recoverable via a Reopen button.
- **Workshop-friendly error messages** — link-rule violations now show *"Replace needs the technology being replaced. Link a current-state tile to this gap."* instead of raw rule text.
- **Save button states** — clear "Saving / Saved ✓ / Couldn't save" feedback so you know what happened.
- **3 in-flight bug fixes** caught by mandatory browser-smoke before tag.

For engineers: see [`docs/CHANGELOG_PLAN.md § v2.4.11`](docs/CHANGELOG_PLAN.md) and [`docs/RULES.md`](docs/RULES.md) (the new 90-rule audit).

---

## v2.4.11.d01 · Hygiene-pass clone (2026-04-25)

Same software as v2.4.11, **audited and re-documented**. No behaviour change.

For users: nothing changes. Your sessions and skills work exactly the same.

For maintainers: thorough cleanup pass — dead code removed, all 4 localStorage normalizers verified, 11-field relationship inventory captured for future planning.

For technical detail, see [`docs/MAINTENANCE_LOG.md · v2.4.11.d01`](docs/MAINTENANCE_LOG.md).

---

## v2.4.10 · Save & open `.canvas` workbook files (2026-04-24)

**Headline**: workshops are now savable as `.canvas` files. Take them home, share them with a colleague, restore them on another device.

What's new:
- **"Save to file" button** in the footer — saves the entire session (and optionally provider keys + skills) as a `.canvas` file on your disk.
- **"Open file" button** — opens any `.canvas` file. The migrator handles cross-version files gracefully.
- **PWA file handler**: on Chrome/Edge with the app installed as a PWA, double-clicking a `.canvas` file opens it in the app.

The `.canvas` format is a JSON envelope. Future versions of the app will read older files cleanly.

---

## v2.4.10.1 · HOTFIX · test-runner localStorage isolation (2026-04-25)

**Bug fixed**: in v2.4.5–v2.4.10, the test runner could leak synthetic test data ("Bus Co", "Round-trip Co") into your real saved session. **Fixed.** Tests now snapshot localStorage before running and restore it afterward, so your real data survives.

If you saw weird placeholder data in your session before this release, you can safely "Clear all data" and start fresh.

---

## v2.4.9 · Primary-layer + project tracking (2026-04-24)

**Headline**: every gap now explicitly knows which project (initiative bundle) it belongs to.

What's new:
- Each gap stores a `projectId` derived from `(environment, layer, gapType)`. This makes the Roadmap auto-grouping queryable instead of silent.
- Primary-layer enforcement: a gap's primary `layerId` is always the first entry in `affectedLayers[]`. Old sessions auto-update on next load.

For users: the Roadmap looks the same; the data underneath is more legible.

---

## v2.4.8 · Phase 17 · Action taxonomy (2026-04-24)

**Headline**: "Disposition" → "Action" everywhere. Cleaner vocabulary, stricter rules.

What's new:
- The 7 actions: **Keep · Enhance · Replace · Consolidate · Retire · Operational · Introduce**. Each has a defined link rule (Replace needs 1 current + 1 desired; Consolidate needs ≥2 current + 1 desired; etc.).
- Old `rationalize` value is auto-coerced to `Operational` (gap) or `Retire` (instance) on next session load.
- Gaps that violate their action's rule show a workshop-friendly chip explaining what to fix.

For users: same workflow, clearer terminology.

---

## v2.4.7 · Fresh-start UX (2026-04-24)

**Headline**: a brand-new user no longer opens the app to someone else's data.

What's new:
- First run = empty canvas with a welcome card.
- Two clear CTAs: **"↺ Load demo session"** (loads Acme Financial Services) or **"Start fresh"** (dismiss).
- Footer "↺ Load demo" stays as a persistent shortcut.

For users: opening the app for the first time is no longer confusing.

---

## v2.4.6 · UX quick-wins (2026-04-24)

The test banner now auto-dismisses after 5 seconds on green. Failed-test banner stays sticky until you click ✕ — you need to act on it.

---

## v2.4.5.1 · AI reliability (2026-04-24)

**Headline**: AI calls don't fail just because a model is busy.

What's new:
- **Retry-with-backoff** on 429 / 5xx errors (3 attempts, jittered).
- **Per-provider fallback chain** — Gemini defaults to `gemini-2.5-flash → gemini-2.0-flash → gemini-1.5-flash`. Configurable in Settings.
- **"Test connection"** reports which model actually answered — useful when fallbacks kicked in.
- **Anthropic browser-direct opt-in** fixes a 401-loop bug.

For users: AI just works more often.

---

## v2.4.5 · Foundations Refresh (2026-04-24)

**Headline**: The AI workflow is reliable now. Three concrete bugs from v2.4.4 are fixed.

What's new:
- **No more vanishing driver tile** when AI applies a change.
- **Tab no longer blanks** after pressing Undo.
- **Undo persists across page reload** — you can undo even after refreshing.
- **"↶↶ Undo all"** chip undoes everything in one click.
- **3 demo personas** (Acme FSI / Meridian HLS / Northwind Public Sector).
- **6 seed AI skills** ship deployed by default — every tab has at least one ready-to-use skill.

For users: AI features feel solid for the first time.

---

## v2.4.4 · Phase 19d · Unified AI platform (2026-04-24)

**Headline**: the AI platform is formalised. Skills declare what they return (`responseFormat`) and what the UI does with it (`applyPolicy`) as two orthogonal choices.

What's new:
- Apply-on-confirm proposals panel — review each AI suggestion before applying.
- Per-skill provider override — run cheap skills on Gemini, deep-reasoning skills on Claude Opus.
- Undo stack (cap 10).
- Action-commands schema declared (runtime ships in v2.6.0).

---

## v2.4.3 · Prompt quality guardrails (2026-04-19)

**Headline**: AI no longer returns long articles when you wanted bullets.

What's new:
- Mandatory output-format footer kills the "long article" pattern.
- "✨ Refine to CARE format" rewrites your prompt with side-by-side diff.
- Save button disabled until a successful test matches your draft — forces the iteration loop.

---

## v2.4.2 + v2.4.2.1 · Skill builder polish (2026-04-19)

Field-pointer mechanic: click a chip to insert a `{{path}}` binding into your prompt. Pill editor ensures bindings can't be corrupted mid-edit.

---

## v2.4.0 + v2.4.1 · AI foundations + skill builder (2026-04-19)

Three providers (local vLLM / Anthropic / Gemini). Gear icon → settings. Skill builder lets you define your own AI skills.

---

## v2.3.1 · Workload mapping (2026-04-19)

**Headline**: workloads can map to the infrastructure they run on.

What's new:
- New "Workload" layer at the top of the matrix.
- N-to-N mapping between a workload and its underlying compute / storage / network assets.
- "↑ Propagate criticality" button walks per-asset confirms — never silently downgrades.

---

## v2.3.0 · Gap-link visibility (2026-04-19)

Linked technologies on each gap are now always visible (no collapse). Yellow warning when linking to a technology already linked elsewhere.

---

## v2.2.x series · Container + visual polish (2026-04-19)

- **v2.2.0**: Docker container ship. Multi-arch (amd64 + arm64).
- **v2.2.1**: optional LAN auth via env vars.
- **v2.2.2**: Dell brand-token refresh + Inter typography.
- **v2.2.3**: visual depth — tighter radii, heading tracking, monospace metrics.

---

## v2.1.x series · Reporting + reviewer scripts (2026-04-18 → 2026-04-19)

- **v2.1**: Coverage + Risk panels (replaced single health score). Auto-drafted-gap review flow.
- **v2.1.1**: Right-panel drill-downs, Session Brief, contextual help modal.
- **v2.1.2**: Reviewer-handoff scripts (`start.bat`, `start.sh`).

---

## v2.0 · Strategic Drivers + Phases + Programs/Projects (2026-04-18)

The crown-jewel restructure. Tab 1 became Strategic Drivers. Tab 5 became Reporting with the Programs/Projects/Phases Roadmap.

---

## v1.3 (legacy)

The original 5-step flow. Predecessor to v2.0.

---

## How to read this file

- Latest first.
- Each version section: 1-3 sentences "headline", a "what's new" list, and a pointer to engineering detail.
- For full engineering detail (file paths, test counts, locked decisions), see [`docs/CHANGELOG_PLAN.md`](docs/CHANGELOG_PLAN.md).
- For the rules-as-built audit, see [`docs/RULES.md`](docs/RULES.md).
- For hygiene-pass entries (`.dNN`), see [`docs/MAINTENANCE_LOG.md`](docs/MAINTENANCE_LOG.md).

When a new release ships, add an entry at the top with the same shape.
