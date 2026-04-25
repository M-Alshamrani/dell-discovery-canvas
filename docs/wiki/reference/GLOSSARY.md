# Glossary

Domain-specific terminology for Dell Discovery Canvas. **Terms here are project-internal definitions** — they may differ from common-industry usage.

Read this twice on Day 1. Some terms come up daily.

---

## Core domain entities

**driver** — A customer's strategic priority. One of 8 catalog entries (AI & Data Platforms, Cyber Resilience, Cost Optimization, Cloud Strategy, Modernize Aging Infrastructure, Operational Simplicity, Compliance & Sovereignty, Sustainability/ESG). See [SPEC §3.2](../../SPEC.md). Stored on `customer.drivers[]`.

**instance** — A technology in the customer's IT estate. Has a `state` (`current` | `desired`), a `layerId`, an `environmentId`, a vendor, etc. See [SPEC §2.2](../../SPEC.md). Stored on `session.instances[]`.

**gap** — An initiative bridging current → desired state. See [SPEC §2.3](../../SPEC.md). Stored on `session.gaps[]`.

**project** — A bundling of related gaps for the Roadmap. **Derived**, not stored as an entity; computed by `services/roadmapService.js buildProjects` keyed on `gap.projectId` (which IS stored). One project per `(env, layer, gapType)` tuple.

**workload** — An instance on the special `workload` layer (top of the matrix). Maps N-to-N to infrastructure assets via `mappedAssetIds[]` (Phase 16 / v2.3.1). Each workload runs in exactly ONE environment.

## Action / disposition taxonomy (post-Phase-17)

**action** — UI label (since v2.4.8). Replaces the old "disposition" label. **JSON field name stays `disposition`** — the rename is UI-only.

**disposition** — JSON field on a desired-state instance. One of 7 values: `keep`, `enhance`, `replace`, `consolidate`, `retire`, `introduce`, `ops`. See [`core/taxonomy.js`](../../../core/taxonomy.js) for the canonical table.

**gapType** — Derived from disposition via `ACTION_TO_GAP_TYPE`. One of 5 values: `enhance`, `replace`, `consolidate`, `introduce`, `ops`. (`keep` and `retire` map to `null`/`ops`.) Phase 17 dropped `rationalize`; migrator coerces it to `ops`. See [SPEC §2.3](../../SPEC.md).

**reviewed** — Boolean on every gap. `false` for auto-drafted gaps awaiting user attention; `true` after substantive edit or explicit `approveGap` call. Drives the pulsing-dot "needs review" chip on Tab 4.

## Layers + environments

**layer** — One of 6 architecture layers: `workload`, `compute`, `storage`, `data-protection`, `virtualization`, `infrastructure`. See [`core/config.js LAYERS`](../../../core/config.js).

**environment** — One of 4 deployment environments: `coreDc`, `drDc`, `publicCloud`, `edge`. See [`core/config.js ENVIRONMENTS`](../../../core/config.js).

**primary layer** — `gap.layerId`. By v2.4.9 invariant: `gap.affectedLayers[0] === gap.layerId` always. The "primary layer" concept is conceptually distinct from the "also affected" layers in `affectedLayers[1..]`.

## Severity / urgency vocabulary

**criticality** — On `current` instances only. `High | Medium | Low`. Default `Low` for new currents (v2.0). Hand-set by the user.

**urgency** — On gaps. `High | Medium | Low`. **Derived** by default from the linked current's `criticality` — see propagation rules P4/P7 in [docs/RULES.md](../../RULES.md). v2.4.11 added `urgencyOverride: boolean` so the user can pin it.

**priority** — On `desired` instances only. `Now | Next | Later`. Maps to `phase` on linked gaps via `priorityToPhase` (P1 in RULES.md). UI labels these as "Phase" since v2.0; JSON field name stays `priority`.

**phase** — On gaps. `now | next | later`. Synced bidirectionally with the linked desired tile's `priority`.

## Session state

**session** — The single mutable object held by `state/sessionStore.js`. Persisted to `localStorage[dell_discovery_v1]`. JSON-serialisable always (per [SPEC §1 invariant 4](../../SPEC.md)).

**isFreshSession(s)** — Predicate exported from `sessionStore.js`. True iff no customer name + no drivers + no instances + no gaps. Gates the welcome card on Tab 1.

**migrateLegacySession(raw)** — Idempotent additive migrator. Runs on every load. Coerces `rationalize` → `ops`/`retire`, backfills `affectedLayers[0]`, derives `projectId`, defaults `urgencyOverride: false`, etc. See [docs/RULES.md §10](../../RULES.md) for the migration rules M1-M10.

## AI platform

**skill** — A deployed AI capability bound to one tab. Schema in [SPEC §12.1](../../SPEC.md). Stored in `localStorage[ai_skills_v1]`.

**seed skill** — A built-in skill auto-deployed on first run. 6 today, in `core/seedSkills.js`.

**responseFormat** — What the AI MUST return: `text-brief` | `json-scalars` | `json-commands`. Drives the system-prompt footer.

**applyPolicy** — What the UI does with the response: `show-only` | `confirm-per-field` | `confirm-all` | `auto`. Orthogonal to `responseFormat` ([ADR-004](../../adr/ADR-004-unified-output-behavior.md)).

**outputSchema** — Allowlist of paths the AI may propose updates to. Each entry: `{path, label, kind}`. AI-returned keys outside the schema are silently dropped at parse time.

**writable path** — A binding path the AI may propose updates to. Marked `writable: true` in `FIELD_MANIFEST`. For `context.*` paths, also requires a `WRITE_RESOLVERS` entry. See [`core/bindingResolvers.js`](../../../core/bindingResolvers.js).

**resolver** — Function in `WRITE_RESOLVERS` that translates a `context.*` path mutation into a session-rooted write. Looks up the target entity by id and mutates in place. See [ADR-005](../../adr/ADR-005-writable-path-resolver-protocol.md).

**session.\* vs context.\* paths** — `session = persisted state`, `context = runtime tab selection`. `session.customer.name` is always available; `context.selectedGap.description` is the gap currently shown in the right panel of Tab 4. See [SPEC §12.2](../../SPEC.md).

**system-prompt footer** — Non-removable footer appended to every skill's system message at run time. Selected by `responseFormat`. Forces the AI to comply with the response format (≤120 words, JSON shape, etc.). See `core/promptGuards.js`.

## Architecture

**interactions/** — The only modules that may mutate session state (per SPEC §1 invariant 6). Five modules: `gapsCommands`, `matrixCommands`, `desiredStateSync`, `aiCommands`, `skillCommands`.

**services/** — Pure read-only modules. Take session + config, return derived data.

**session-changed event** — Pub/sub bus on `core/sessionEvents.js`. Every session-root mutation MUST emit. `app.js` is the only subscriber; views re-render via `renderStage` on every event. See [ADR-006](../../adr/ADR-006-session-changed-event-bus.md).

**FIELD_MANIFEST** — Per-tab catalog of bindable AI fields. See [reference/field-manifest.md](field-manifest.md).

**WRITE_RESOLVERS** — Map of `context.*` path → mutation function. 13 entries. See [`core/bindingResolvers.js`](../../../core/bindingResolvers.js).

## Process / discipline

**+dNN tag / .dNN tag** — Hygiene-pass build metadata; functionally identical to the source tag. Older form `+dNN` (SemVer 2.0); current form `.dNN` (Docker-tag friendly). See [`MAINTENANCE_PROCEDURE.md` §1](../../../../MAINTENANCE_PROCEDURE.md).

**two-surface testing** — Every data-model change must ship machine tests AND human-test surfaces (demo + seed) in the same commit. See [ADR-007](../../adr/ADR-007-skill-seed-demosession-separation.md) and `feedback_foundational_testing.md` memory.

**browser smoke** — Manual Chrome-MCP exercise of the live app against a verification spec. Required before every functional tag. See `feedback_browser_smoke_required.md` memory.

**three-tier rule tag** — In [docs/RULES.md](../../RULES.md), every rule is tagged 🔴HARD (throws on violation), 🟡SOFT (warns), 🔵AUTO (silent automatic), or 📦MIGRATE (one-shot fix on session load).

**stop-and-ask** — Escalation marker in [ONBOARDING.md](../../../ONBOARDING.md). Anything that would change a 🔴HARD rule, weaken a test, or modify session-shape JSON triggers a stop-and-ask.

## Versioning

**SemVer-strict** — Standard MAJOR.MINOR.PATCH. The functional release form (`v2.4.11`).

**`+dNN` / `.dNN` build-metadata** — Hygiene-pass clones. SemVer 2.0 build-metadata (`+`) was the v1 form; `.dNN` is the current form (Docker-friendly). See `CONTRIBUTING.md` for tag conventions.

**hotfix patch** — Fourth segment for urgent bug fixes (`v2.4.10.1`). Rare.

## Tabs (the 5-step flow)

| # | Tab | Job |
|---|---|---|
| 1 | **Context** | Capture customer + strategic drivers (Tab 1). |
| 2 | **Current State** | Map current IT estate on the 6×4 matrix (Tab 2). |
| 3 | **Desired State** | Set actions / introduce net-new tiles (Tab 3). |
| 4 | **Gaps** | Curate auto-drafted gaps; assign drivers (Tab 4). |
| 5 | **Reporting** | Five sub-tabs: Overview · Heatmap · Gaps Board · Vendor Mix · **Roadmap** (the crown jewel). |

## File-format

**`.canvas`** — User-owned save/open file (v2.4.10). MIME `application/vnd.delltech.canvas+json`. Wraps a session in an envelope with metadata. Round-trips through `migrateLegacySession` on import.

---

## Refresh trigger

Update this glossary:
- Whenever a new term appears that requires a 30-second explanation to a new dev.
- Whenever a renaming happens (e.g., Phase 17 "Disposition" → "Action").
- Every `.dNN` hygiene-pass — re-validate every term against current code.

If you find yourself explaining the same term twice in a session, add it here.
