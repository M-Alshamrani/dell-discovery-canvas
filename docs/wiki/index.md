# Dell Discovery Canvas · Wiki

This wiki is organised per the [Diátaxis framework](https://diataxis.fr/) — four modes of writing, each with a different audience and goal.

| Mode | Goal | Lives in |
|---|---|---|
| **[Tutorials](tutorials/)** | Learning · "follow these steps and you'll achieve X" | `tutorials/` |
| **[How-to guides](how-to/)** | Doing · task recipes for specific changes | `how-to/` |
| **[Reference](reference/)** | Looking up · auto-derived tables, schemas, catalogs | `reference/` |
| **[Explanation](explanation/)** | Understanding · design rationale, ADRs, diagrams | `explanation/` |

The four sub-trees are deliberately separate. If you're confused about which mode a piece belongs in, ask: *what does the reader want?* Are they learning (tutorial), doing (how-to), looking up (reference), or understanding (explanation)? One file, one mode.

---

## Living docs

| | |
|---|---|
| **`SPEC.md`** (root) | The authoritative implementation spec. Anything that contradicts SPEC is wrong. |
| **`docs/RULES.md`** | Rules-as-built audit (90+ numbered rules tagged 🔴HARD / 🟡SOFT / 🔵AUTO / 📦MIGRATE). |
| **`docs/CHANGELOG_PLAN.md`** | The discussion + planning trail. Every release has an entry. |
| **`docs/DEMO_CHANGELOG.md`** | Demo + seed surface audit trail (per the two-surface rule). |
| **`docs/MAINTENANCE_LOG.md`** | Hygiene-pass clones (`.dNN`) — one entry per pass. |
| **`docs/adr/ADR-NNN-*.md`** | Architecture Decision Records — one per significant decision. |
| **`docs/operations/*.md`** | Runbooks, version-compat matrix, risk register, dependency policy. |

## Reading order for a fresh contributor

Per `ONBOARDING.md` Day-1 / Week-1 / Month-1 — but if you're skim-reading right now:

1. **`SPEC.md §0-§2`** (north star + invariants + data model) — 10 min.
2. **`explanation/diagrams/context.md` + `containers.md`** — 5 min.
3. **`explanation/diagrams/data-model-er.md`** — 10 min.
4. **`docs/RULES.md`** — 20 min skim, mark surprises.
5. **Pick one ADR** (`ADR-001` recommended) — 5 min.
6. **Run the app**: `docker compose up -d --build` → open `http://localhost:8080` → confirm green test banner.
