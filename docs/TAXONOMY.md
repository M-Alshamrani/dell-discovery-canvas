# Data Taxonomy & Relationships · v2.4.16

**Single source of truth for the Dell Discovery Canvas data architecture.** Every entity, every link, every cardinality, every disposition rule, every asset lifecycle, every reporting derivation. Anything in source that contradicts this doc is a bug; the doc is the contract.

**Last validated against**: `v2.4.16` · 2026-04-29
**Companion docs**: `docs/RULES.md` (rules-as-built audit) · `SPEC.md §9` (phase blocks) · `docs/DEMO_CHANGELOG.md` (demo audit)

Read time: ≤30 minutes. Tables + bullet lists.

---

## Table of contents

1. [Entity Catalog](#1--entity-catalog)
2. [Relationships](#2--relationships)
3. [Cardinalities](#3--cardinalities)
4. [Per-gapType Disposition Rules](#4--per-gaptype-disposition-rules)
5. [Asset Lifecycle by Action](#5--asset-lifecycle-by-action)
6. [Reporting Derivations](#6--reporting-derivations)
7. [Validation Contract](#7--validation-contract)
8. [Presentation Rules](#8--presentation-rules)
9. [Known divergences](#9--known-divergences)
10. [Cross-reference index](#10--cross-reference-index)

---

## 1 · Entity Catalog

The eight persisted entity types. Each row points to its source-of-truth file and to the validator that gates its shape.

| # | Entity | Persisted as | Source file | Validator | Lifecycle states |
|---|---|---|---|---|---|
| 1 | **Driver** | `session.customer.drivers[]` | `core/config.js` (`BUSINESS_DRIVERS`) | none (free-form id from catalog) | active only (one priority + outcomes per driver) |
| 2 | **Layer** | constant (not persisted) | `core/config.js` (`LAYERS`) | n/a (six fixed ids) | static |
| 3 | **Environment** | `session.environments[]` | `core/config.js` (`ENV_CATALOG`) | shape via migrator (sessionStore.js) | `hidden: false` (visible) ⇄ `hidden: true` (soft-deleted) |
| 4 | **Current Instance** | `session.instances[]` (filter `state === "current"`) | `core/models.js validateInstance` | `validateInstance` | created → optionally `disposition` set → optionally retired (logically, via gap) |
| 5 | **Desired Instance** | `session.instances[]` (filter `state === "desired"`) | `core/models.js validateInstance` | `validateInstance` | created (optionally `originId` linking back to a current) → priority Now/Next/Later |
| 6 | **Gap** | `session.gaps[]` | `core/models.js validateGap` + `core/taxonomy.js validateActionLinks` | both | auto-drafted (`reviewed: false`) → reviewed (`reviewed: true`) → optionally closed (`status: "closed"`) → optionally reopened |
| 7 | **Project** (derived) | NOT persisted; derived per render | `services/roadmapService.js buildProjects` | n/a (rule-based grouping by `projectId`) | derived from constituent gaps every render |
| 8 | **Service** | catalog constant + `gap.services[]` selections | `core/services.js` (`SERVICE_TYPES`) | `validateGap` rejects unknown ids | static catalog (10 entries) + per-gap selection |

### 1.1 · Per-entity field manifest

#### Driver
```
{ id: string (catalog id), priority: "High"|"Medium"|"Low", outcomes: string }
```
Catalog: 8 entries — `ai_data` · `cyber_resilience` · `cost_optimization` · `cloud_strategy` · `modernize_infra` · `ops_simplicity` · `compliance_sovereignty` · `sustainability`. See `core/config.js BUSINESS_DRIVERS`.

#### Layer (constant)
6 layers, ordered top-to-bottom on the canvas:
1. `workload` — Workloads & Business Apps
2. `compute` — Compute
3. `storage` — Data Storage
4. `dataProtection` — Data Protection & Recovery
5. `virtualization` — Virtualization & Hypervisors
6. `infrastructure` — Infrastructure Services (networking + security + management combined)

#### Environment
```
{ id: catalog id, hidden: bool, alias?, location?, sizeKw?, sqm?, tier?, notes? }
```
Catalog: 8 entries — `coreDc` · `drDc` · `archiveSite` · `publicCloud` · `edge` · `coLo` · `managedHosting` · `sovereignCloud`. Default-enabled set: `coreDc, drDc, publicCloud, edge`. Soft-delete via `hidden: true` (≥1 active env invariant; instances stay in JSON).

#### Current Instance / Desired Instance
```
{
  id:               "inst-..." (string id),
  state:            "current" | "desired",
  layerId:          one of LAYERS,
  environmentId:    one of ENV_CATALOG ids,
  label:            string (vendor/product name),
  vendor?:          string,
  vendorGroup?:     "dell" | "nonDell" | "custom",
  criticality?:     "High" | "Medium" | "Low",     // current only (drives gap.urgency)
  priority?:        "Now" | "Next" | "Later",      // desired only (drives gap.phase)
  disposition?:     one of ACTION_IDS              // current → action chosen by user; drives auto-draft
                                                   // desired → action chosen by user; drives auto-draft
  originId?:        instance id                    // desired only — links back to a current
  mappedAssetIds?:  [instance id, ...]             // workload-layer only (W2/W3/W4/W5)
}
```

#### Gap
```
{
  id:                          "gap-..." (string id),
  description:                 non-empty trimmed string,
  layerId:                     one of LAYERS (PRIMARY layer),
  affectedLayers:              [layerId, ...]      // affectedLayers[0] === layerId (G6 invariant)
  affectedEnvironments:        [envId, ...]        // empty array means "no env scope" → counts everywhere (H3)
  gapType:                     "enhance"|"replace"|"consolidate"|"introduce"|"ops" (taxonomy.GAP_TYPES),
  urgency:                     "High"|"Medium"|"Low" (default "Medium"),
  phase:                       "now"|"next"|"later" (default "now"),
  status:                      "open"|"in_progress"|"closed"|"deferred" (default "open"),
  reviewed:                    bool (auto-drafts: false; manual + post-review: true),
  urgencyOverride?:            bool (true = pin against propagation; default false),
  driverId?:                   driver id (explicit override; absent = suggestion ladder D1-D9),
  projectId?:                  derived "envId::layerId::gapType" (PR1; auto-rebuilt on layer/env/gapType change),
  relatedCurrentInstanceIds:   [instance id, ...]  // M:N to currents; rules per AL2-AL10
  relatedDesiredInstanceIds:   [instance id, ...]  // M:N to desireds
  services?:                   [service id, ...]   // M:N facet to SERVICE_TYPES (v2.4.12)
  notes?:                      string,
  mappedDellSolutions?:        string (free-form; back-compat),
  closeReason?:                string,             // P3 auto-close trail
  closedAt?:                   ISO timestamp
}
```

#### Project (derived per render)
```
{
  id:               gap.projectId (envId::layerId::gapType),
  name:             "{EnvLabel} — {LayerLabel} {ActionVerb}",
  envId:            primary env (gap.affectedEnvironments[0] ?? "crossCutting"),
  layerId:          gap.layerId,
  gapType:          gap.gapType,
  urgency:          max urgency across constituent gaps (PR3),
  phase:            mode of constituent gaps' phase; ties → earliest (PR4),
  driverId:         mode of effectiveDriverId across gaps; ties → first in session order (PR5),
  dellSolutions:    distinct labels of linked desired instances with vendorGroup === "dell" (PR6),
  gaps:             [constituent gap, ...]
}
```

#### Service (catalog constant + per-gap reference)
```
SERVICE_TYPES: 10 entries — assessment · migration · deployment · integration · training ·
                            knowledge_transfer · runbook · managed · decommissioning · custom_dev
gap.services:  [SERVICE_IDS, ...] (validated subset of catalog ids; v2.4.12+)
```

---

## 2 · Relationships

Every link between entities, with cardinality, direction, optionality, trigger, enforcer.

| # | From | To | Card | Direction | Optional? | Trigger | Enforcer |
|---|---|---|---|---|---|---|---|
| R1 | Customer | Driver | 1:N | down | yes (empty drivers[] permitted) | user adds in ContextView | session shape (no validator) |
| R2 | Driver | Gap | M:N (logical, via id) | suggested | yes | `gap.driverId` set OR ladder D1-D9 fires | `effectiveDriverId(gap, session)` |
| R3 | Gap | Current Instance | M:N | gap → currents | yes (per AL2-AL10) | user links via Tab 4 detail panel | AL1-AL10 + L1 + L4 |
| R4 | Gap | Desired Instance | M:N | gap → desireds | yes (per AL2-AL10) | user links; auto-draft from `disposition` | AL1-AL10 + L2 + L4 + L8 |
| R5 | Current Instance | Desired Instance | 1:1 (logical) | current → desired (mirror) | yes | desired carries `originId` | n/a (free-form) |
| R6 | Workload Instance | Asset Instance | M:N | workload → assets | yes | workload-layer Phase 16 mapping UI | W1-W5 |
| R7 | Gap | Layer (primary) | 1:1 | gap → layer | required | user picks; auto-from desired in auto-draft | G4 + G6 (primary-layer invariant) |
| R8 | Gap | Layer (secondary) | M:N | gap → affected layers | yes (empty = primary only) | user multi-select | G5 + G6 (`affectedLayers[0] === layerId`) |
| R9 | Gap | Environment | M:N | gap → envs | yes (empty = "all envs" per H3) | user multi-select | G7 |
| R10 | Gap | Service | M:N | gap → service ids | yes | user multi-select chip row | `validateGap` (gap.services per v2.4.12) |
| R11 | Gap | Project | M:1 | gap → derived project | always (every gap belongs to one) | `deriveProjectId` on create/update if layer/env/gapType changed | PR1 + PR2 |
| R12 | Driver | Project | M:1 (mode) | derived | always | `effectiveDriverId` mode across project's gaps | PR5 |
| R13 | Session | Environment | 1:N | session → envs | yes (empty defaults to 4 via fallback) | ContextView env management | migrator backfill (v2.4.15) |
| R14 | Session | Driver | 1:N | session → drivers | yes (empty permitted) | ContextView "+ Add driver" flow | migrator (M1-M2) |

---

## 3 · Cardinalities

Quick scan of "how many of X can attach to Y":

| Owner | Owned | Cardinality | Notes |
|---|---|---|---|
| Session | Drivers | 0..N | catalog has 8; user picks any subset |
| Session | Environments | 1..N (≥1 active) | catalog has 8; default-4 enabled; soft-delete preserves data |
| Session | Instances (current+desired) | 0..N | unbounded |
| Session | Gaps | 0..N | unbounded |
| Layer | Instances | 0..N | per-layer count drives matrix density |
| Environment | Instances | 0..N | per-env count drives matrix column |
| Driver | Outcomes | 1 string | free-form, per-driver |
| Driver | Gaps (suggested) | 0..N | via D1-D9 ladder fallback |
| Gap | Currents (linked) | per AL2-AL10 (0/1/2+) | strict for reviewed gaps |
| Gap | Desireds (linked) | per AL2-AL10 (0/1) | strict for reviewed gaps |
| Gap | Services | 0..N (subset of 10) | facet, not gap type |
| Gap | Layers | 1 primary + N secondary | primary-layer invariant G6 |
| Gap | Environments | 0..N (empty = all) | H3 envless-counts-everywhere rule |
| Gap | Driver | 0..1 explicit + 0..1 suggested | `effectiveDriverId` resolves |
| Workload | Mapped assets | 0..N (same env) | W1-W5 |
| Project | Gaps | 1..N | derived bucket |

---

## 4 · Per-gapType Disposition Rules

**The canonical table.** This drives `validateActionLinks` (`core/taxonomy.js:229`) for reviewed gaps + the auto-draft pipeline (`interactions/desiredStateSync.js`).

| Action id | Action label | gapType | currents required | desireds required | Notes |
|---|---|---|---|---|---|
| `keep` | Keep | (none) | 1 | 0 | No gap auto-drafts (gapType=null). Used to mark "no change planned." |
| `enhance` | Enhance | `enhance` | 1 (exact) | optional | Same vendor/platform; capacity/version uplift. |
| `replace` | Replace | `replace` | 1 (exact) | 1 (exact) | One-for-one swap. Different vendor or major-rev jump. |
| `consolidate` | Consolidate | `consolidate` | 2+ (min 2) | 1 (exact) | N-to-1 merge. The single desired = consolidation target. |
| `retire` | Retire | `ops` | 1 (exact) | 0 | Decommission with no replacement. (Note: gapType is `ops`, shared with `ops` action — see T1.) |
| `introduce` | Introduce | `introduce` | 0 (exact) | 1 (exact) | Net-new capability. No current to replace. |
| `ops` | Operational/Services | `ops` | optional | optional | Process / services work. AL7 substance: ≥1 link OR ≥10-char notes. |

### 4.1 · Validator coverage

Each rule above ships with code-level enforcement:

| Rule | Where enforced | Tier | Rule id |
|---|---|---|---|
| Replace 1+1 | `core/taxonomy.js evaluateLinkRule` via `validateActionLinks` | 🔴 HARD | AL2 |
| Enhance 1+optional | same | 🔴 HARD | AL3 |
| Consolidate 2++1 | same | 🔴 HARD | AL4 |
| Introduce 0+1 | same | 🔴 HARD | AL5 |
| Ops optional+optional | same (no link rule) | 🟡 SOFT | AL6 |
| Ops substance (≥1 link OR ≥10 chars notes) | `validateActionLinks` post-link block | 🔴 HARD | AL7 |
| Auto-draft bypass (`reviewed: false` skips) | `validateActionLinks` early return | 🔵 AUTO | AL1 |
| Friendly error messages | `friendlyMessage()` in `core/taxonomy.js` | 🔵 AUTO | AL8 |
| Metadata-patch bypass | `updateGap` re-validates only on structural change | 🔵 AUTO | AL9 |
| `approveGap` always validates | `interactions/gapsCommands.js approveGap` | 🔴 HARD | AL10 |

### 4.2 · Shared-gapType ambiguity (T1)

Two actions map to gapType `ops` (`retire` and `ops` itself). When a reviewed gap has `gapType: "ops"`, `validateActionLinks` cannot deterministically pick which Action's link rules to enforce. **Behavior**: the function silently skips the per-action rule but still enforces AL7 (ops substance). `keep` action maps to `gapType: null` → no gap exists, so this only matters at the read side.

### 4.3 · Suggested services per gapType (v2.4.12)

OPT-IN suggestions; not auto-applied. User clicks to add.

| gapType | Suggested services |
|---|---|
| `replace` | migration, deployment |
| `consolidate` | migration, integration, knowledge_transfer |
| `introduce` | deployment, training |
| `enhance` | assessment |
| `ops` | runbook |
| (keep) | — (no gap) |

---

## 5 · Asset Lifecycle by Action

What happens to underlying assets in current and desired state when a gap of each type ships. **This is the contract for reporting + presentation**.

| Action | Current-state delta | Desired-state delta | Net asset count Δ | What the matrix shows post-transition |
|---|---|---|---|---|
| **Keep** | 1 stays | 0 added | 0 | Current tile persists; no desired tile |
| **Enhance** | 1 stays (same vendor) | 0 or 1 added (same vendor, uplifted) | 0 (same logical asset) | Current tile persists; desired tile (if present) carries `originId` to the same current |
| **Replace** | 1 retired (logical) | 1 added | 0 (1-for-1 swap) | Current tile renders as "to be retired" (or persists with disposition badge); desired tile carries `originId` to the retired current |
| **Consolidate** | N retired (logical) | 1 added | -(N-1) (N currents → 1 desired) | N current tiles all carry `originId` references TO the same desired; desired tile is the consolidation target |
| **Retire** | 1 retired | 0 added | -1 (no replacement) | Current tile renders as "to be retired" (no desired counterpart) |
| **Introduce** | 0 (untouched) | 1 added | +1 (net new) | No current tile; desired tile is greenfield |
| **Operational** | 0 (untouched) | 0 (untouched) | 0 (process work, no inventory change) | No tile delta; gap exists for operational tracking |

### 5.1 · `originId` semantics

A desired instance MAY carry `originId: "<currentInstanceId>"`. This is the soft-link from desired → current it replaces / consolidates / enhances. Used by:
- Auto-draft: `getCurrentSource(session, desired)` finds the current source for the gap's description (`"Replace PowerEdge → PowerStore [Compute]"`).
- Propagation P4: when source current's `originId` exists, propagate criticality → urgency on linked gaps.
- Matrix rendering: cross-tab navigation between current↔desired pairs.

**Not validated** at `validateInstance` level (no foreign-key check). Free-form by design — the migrator does not auto-rebuild broken `originId` references.

### 5.2 · Visible behavior on the matrix

The matrix (Tab 2 + Tab 3) does NOT physically remove retired currents — they persist in `session.instances[]` for audit + reporting. The "retirement" is logical and represented by:
- The gap's existence (`gapType: "ops"` for retire, plus `relatedCurrentInstanceIds`).
- The current tile's `disposition` field (when set by user: `"retire"` / `"replace"` / `"consolidate"`).
- The desired tile's `originId` referencing the current.

**Visible-presentation hint deferred to v2.4.17**: gap card on Tab 4 should show a small lifecycle indicator (`1 → 1` for replace, `2 → 1` for consolidate, `1 → ø` for retire, `ø → 1` for introduce). Doc captures intent; code lands in v2.4.17 polish pass.

---

## 6 · Reporting Derivations

Every count / score / KPI in `services/*.js` traced to its underlying data. Used as the §RA audit contract.

### 6.1 · `services/healthMetrics.js`

| Function | Purpose | Formula | Excludes hidden envs? | Excludes closed gaps? |
|---|---|---|---|---|
| `getHealthSummary(session, layers, envs)` | Tab 5 Overview header counts | Returns `{ totalBuckets, totalCurrent, totalDesired, totalGaps, highRiskGaps }`. `totalCurrent` = currents only. `totalDesired` = desireds only. `totalGaps` = total session.gaps. `highRiskGaps` = gaps with `urgency === "High"` AND `status !== "closed"` (v2.4.16 fix). | (consumes envs param via `totalBuckets` only; caller passes `getVisibleEnvironments`) | `highRiskGaps` YES (v2.4.16 fix). `totalGaps` NO (counts every gap; workshop-friendly summary). |
| `computeBucketMetrics(layerId, envId, session)` | Per-(layer, env) bucket score for heatmap | currentScore = Σ criticality scores (High:2, Medium:1, Low:0.5) of currents in (layer, env). gapScore = Σ urgency scores (High:3, Medium:2, Low:1) of gaps where `affectedLayers.includes(layerId) AND (no env filter OR env in affectedEnvironments)` | (caller filter) | NO (closed gaps still contribute to gapScore — see §9 KD2; deferred to v2.4.18). |
| `scoreToRiskLabel(total, hasData)` | Score → "Healthy"/"At risk"/"Critical" | thresholds; `hasData=false` → "no data" | n/a | n/a |
| `scoreToClass(total, hasData)` | Score → CSS class | mirror of scoreToRiskLabel | n/a | n/a |

**H3 envless-counts-everywhere rule**: a gap with empty `affectedEnvironments` counts in EVERY environment column for its layer. Documented; preserved.

### 6.2 · `services/gapsService.js`

| Function | Purpose | Formula | Excludes hidden envs? | Excludes closed gaps? |
|---|---|---|---|---|
| `getAllGaps()` | Raw list of session.gaps | unfiltered | NO | NO (caller filters) |
| `getFilteredGaps({layerIds, envId})` | Filtered list for views | layer match + env match (envId="all" → no filter) | (caller passes filter) | (caller filters) |
| `getGapsByPhase({layerIds, envId})` | Group by phase (now/next/later) | filters + groups | (caller filter) | (caller filter) |

### 6.3 · `services/vendorMixService.js`

| Function | Purpose | Formula | Excludes hidden envs? | Excludes closed gaps? |
|---|---|---|---|---|
| `computeMixByLayer({stateFilter, layerIds})` | Per-layer Dell/non-Dell/custom counts | groups instances by vendorGroup; respects state filter (current/desired/combined) | (consumes session.instances; env filter via stateFilter not directly) | n/a (instance-side) |
| `computeMixByEnv({stateFilter, layerIds, environments})` | Per-env breakdown | same group-by, dimensioned by envId; param `environments` should be `getVisibleEnvironments` | YES (caller-supplied) | n/a |
| `computeVendorTableData({layerIds})` | "All instances" detail table | flat rows of (env, layer, vendor, label, state) | (caller filter) | n/a |

**KPI tile derivations** (Tab 5 Vendor Mix headline insights, v2.4.15 §C1 Iter-3):
- **Dell density** = % of `currentState` instances where `vendorGroup === "dell"`. Currents only.
- **Most diverse layer** = layer with the highest count of distinct vendors across currents.
- **Top non-Dell concentration** = (vendor name, layer) tuple with the highest count of currents.

### 6.4 · `services/roadmapService.js`

| Function | Purpose | Formula | Excludes hidden envs? | Excludes closed gaps? |
|---|---|---|---|---|
| `groupGapsIntoInitiatives(session, opts)` | Group gaps for legacy initiative view | by `gap.initiativeId` if set, else by `gap.projectId` | (caller filter) | (caller filter) |
| `buildProjects(session, opts)` | Tab 5.5 Roadmap project cards | groups by `gap.projectId`; project urgency = max(gaps.urgency); phase = mode (PR3/PR4); driverId = mode effectiveDriverId (PR5); dellSolutions = distinct dell-tagged desired labels (PR6); name = `{EnvLabel} — {LayerLabel} {ActionVerb}` (PR7) | (audit: should exclude hidden) | (audit: should exclude closed) |
| `computeLayerImpact(session, opts)` | Per-layer gap weight | Σ urgency scores per layer | (audit) | (audit) |
| `computeDiscoveryCoverage(session)` | % discovered per layer | (current count / typical-target count) per layer | n/a | n/a |
| `computeRiskPosture(session)` | Session-wide risk score | aggregate of gap urgencies + bucket scores | (audit) | (audit) |
| `computeAccountHealthScore(session)` | Single 0-100 health number | composite formula (audit: document precisely) | (audit) | (audit) |
| `generateSessionBrief(session)` | Tab 5 right-panel briefing rows | row builders per topic | (audit) | (audit) |
| `generateExecutiveSummary(session)` | Flattened brief string | concatenation of brief rows | (audit) | (audit) |

### 6.5 · `services/programsService.js`

| Function | Purpose | Formula |
|---|---|---|
| `suggestDriverId(gap, session)` | D1-D9 ladder fallback | sequential rules (cyber from layer/text → ops from gapType → cloud from publicCloud → cost from consolidate → modernize from replace+layer → ai from text → compliance/sustainability from regex match → null) |
| `effectiveDriverId(gap, session)` | Resolved driver | `gap.driverId ?? suggestDriverId(gap, session)` |
| `effectiveDriverReason(gap, session)` | Why-this-driver explanation | `{source: "explicit"|"suggested", reason}` |
| `effectiveDellSolutions(gap, session)` | Dell-tagged labels for project rollup | distinct `linked desired.label` where `vendorGroup === "dell"` |
| `groupProjectsByProgram(projects, session)` | Group projects under driver "programs" | by `effectiveDriverId(project)` |

---

## 7 · Validation Contract

Every assert mapped to a tier. Mirrors `docs/RULES.md §1-2` (see RULES.md for the full ~90-rule index; this section is the entity-validation slice).

### 7.1 · `validateInstance` (HARD)

I1-I9 from `docs/RULES.md §1.1`. In summary:
- Object shape + non-empty id + `state ∈ {current, desired}` + `layerId ∈ LAYERS` + `environmentId ∈ ENV_CATALOG` + non-empty label + `vendorGroup ∈ {dell, nonDell, custom}` (if set) + `mappedAssetIds` array on workload-layer only.

### 7.2 · `validateGap` (HARD shape; SOFT links)

G1-G12 from `docs/RULES.md §1.2`. In summary:
- Object shape + non-empty id + non-empty description + `layerId ∈ LAYERS` + `affectedLayers[0] === layerId` (G6 invariant) + `affectedEnvironments ⊆ ENV_CATALOG` + `urgency / phase / gapType / status` enums + `urgencyOverride: bool` (if set) + `gap.services ⊆ SERVICE_IDS` (v2.4.12).

Link counts (`relatedCurrentInstanceIds` / `relatedDesiredInstanceIds`) are deliberately NOT validated here — they're soft constraints surfaced via `validateActionLinks` for reviewed gaps only (AL1-AL10).

### 7.3 · Migration (📦 MIGRATE, idempotent)

M1-M10 from `docs/RULES.md §10`. Highlights:
- M1 — derive `customer.drivers` from legacy `primaryDriver` if missing.
- M3 — default `gap.reviewed` (false if linked desireds, true otherwise).
- M4-M5 — Phase 17 coercion: `rationalize` → `ops`/`retire`.
- M6 — primary-layer invariant backfill (`affectedLayers[0] = layerId`).
- M7 — backfill `gap.projectId`.
- M10 — default `gap.urgencyOverride: false`.
- v2.4.15 — `session.environments[]` shape: build from referenced ids + drain `environmentAliases` + backfill `hidden: false`.

### 7.4 · Propagation (🔵 AUTO)

P1-P7 from `docs/RULES.md §4`. Bidirectional sync between desired tiles, gaps, and current criticality. Skips gaps where `urgencyOverride === true` (P4/P7).

---

## 8 · Presentation Rules

How each entity should appear in each surface. Drives Tab 4 gap card design, drawer detail templates, and the v2.4.17 unified `.detail-panel-v2`.

### 8.1 · Driver (Tab 1 + drawer detail)

- **Tile**: label + shortHint underneath. Click → right-panel detail.
- **Detail**: conversation starter card (top) + priority dropdown + outcomes textarea (auto-bullet on Enter).
- **Reporting reference**: driver appears as a "program" in the roadmap if any project's `effectiveDriverId` matches.

### 8.2 · Layer (Tab 2 + Tab 3 matrix headers)

- Mono-caps eyebrow `L.0X` corner code (v2.4.13 DS5).
- 4×100% color-coded left bar per layer (v2.4.13 §7 signal palette: workload neutral, compute amber, storage amber, network green, dataProtection red, virtualization Dell-blue).

### 8.3 · Environment (Tab 1 + matrix columns)

- Tab 1 active list: env name + alias + Hide button (disabled if last active env, ≥1 active invariant).
- Tab 1 hidden list: collapsed by default; `[Restore]` button.
- Matrix column header: `E.0X` corner code + label.
- Hidden envs DROP from Tab 2/3 (v2.4.15 iter-2 E1) and from Tab 5 reporting (v2.4.15 SD5).

### 8.4 · Current Instance (Tab 2 matrix tile)

- Tile shows label + vendor + criticality badge.
- Disposition badge (when set) signals action verb.
- Click → right-panel detail with action picker, criticality, vendor, free text.

### 8.5 · Desired Instance (Tab 3 matrix tile)

- Tile shows label + vendor + priority badge (Now/Next/Later).
- `originId` linkage shows "Replaces: {currentLabel}" hint.

### 8.6 · Gap (Tab 4 gap card)

Current state (v2.4.15):
- Gap card has urgency-badge + gapType chip + layer eyebrow + linked-tile-count meta + services chip row + driver row.
- "Review needed" pulsing dot when `reviewed: false`.
- Save button `.btn-with-feedback` (idle/loading/success/error).

**Deferred for v2.4.17**: action-verb badge prominence + asset-lifecycle hint (`1 → 1` / `2 → 1` / `1 → ø` / `ø → 1`) + tooltip showing actual asset labels.

### 8.7 · Project (Tab 5.5 Roadmap card)

- Project name (env + layer + action verb).
- Urgency chip + phase chip + driver pill.
- Dell solutions row.
- Services chip row (v2.4.12 P3).
- Constituent gap count + click-to-expand list.

### 8.8 · Service (Tab 4 chip + Roadmap project chip)

- Chip in gap detail panel "Services needed" row.
- Project card chip row "SERVICES NEEDED · {chips}" (v2.4.12).
- "Services scope" sub-tab DROPPED in v2.4.13 §0 (services info already on gap + project drawers).

---

## 9 · Known divergences

Divergences between this contract and current code, captured during the v2.4.16 audit. Each entry: what diverges, why, where it's fixed (v2.4.16 / v2.4.17 / by-design).

| # | Surface | Divergence | Decision | Status |
|---|---|---|---|---|
| KD1 | `services/healthMetrics.js getHealthSummary.highRiskGaps` | Closed-but-High-urgency gaps were counted as current risk; overstated the Tab 5 Overview headline urgency. | **Fixed** in v2.4.16 §RA audit. Function now filters `g.status !== "closed"` for highRiskGaps. totalGaps still INCLUDES closed (workshop summary number; intentional). | ✅ FIXED v2.4.16 |
| KD2 | `services/healthMetrics.js computeBucketMetrics.gapScore` | Closed gaps still contribute to bucket urgency score (heatmap). | **Documented** in v2.4.16; behavior fix deferred to v2.4.18 (crown-jewel reporting redesign). User should decide whether the heatmap shows "current risk only" (exclude closed) or "all open work history" (include closed). | DEFERRED v2.4.18 |
| KD3 | `services/gapsService.js getFilteredGaps / getGapsByPhase` | Does not filter by `gap.status`. | **By-design**: closed-gap exclusion is caller-side. Tab 4 GapsEditView + Tab 5 SummaryGapsView use SharedFilterBar's `showClosedGaps` toggle (state/filterState.js) + body data-attribute + CSS dim rule. These helpers stay reusable. | BY-DESIGN |
| KD4 | `services/roadmapService.js filterGaps` (internal) | Does not filter by `gap.status`. All consumers (`buildProjects`, `computeLayerImpact`, `computeRiskPosture`, `computeAccountHealthScore`, `generateExecutiveSummary`) inherit this behavior. | **Documented** in v2.4.16; behavior fix deferred to v2.4.18. Per-function decision needed: project urgency = max-of-open vs max-of-all? Risk posture = open-only vs historical? Exec summary = current vs cumulative? Same release that redesigns reporting. | DEFERRED v2.4.18 |
| KD5 | `services/roadmapService.js buildProjects` | Services rollup correctly excludes closed gaps (v2.4.12 P2 hot-patch). Other rollups (`urgency`, `phase`, `dellSolutions`, `layerIds`) include closed gaps in aggregation. | **Documented**. Inconsistent within the same function. v2.4.18 should pick a single rule (likely "exclude closed from aggregations"). | DEFERRED v2.4.18 |
| KD6 | `services/vendorMixService.js computeMixByEnv` | When `environments: []` is passed (or not passed), the function auto-creates result entries for every env id seen in `session.instances`. If caller passes only visible envs but iterates `Object.keys(result)`, hidden-env data leaks. | **Documented**. In practice no caller iterates `Object.keys(result)`; views iterate the supplied env list. Behavior preserved in v2.4.16 to avoid mid-refactor regression. v2.4.18 should change `if (!result[i.environmentId]) ...` to `if (!envIds.has(i.environmentId)) return`. | DEFERRED v2.4.18 |
| KD7 | `services/programsService.js` driver-suggestion ladder D1-D9 | Regex-on-text-fields. A user editing a gap description can change which driver the gap's project lands under. | **By-design** (RULES.md §8 + "Things to flag" item 5 from v2.4.11). Tab 4 surfaces an "AUTO-SUGGESTED driver: X because Y. [Pin this driver]" chip so the user sees + can override the resolved driver. Open question for v2.4.18: should suggested drivers require explicit user confirmation rather than auto-applying? | BY-DESIGN |
| KD8 | Gap-card asset-lifecycle visualization (per §5.2 + §8.6) | TX5 + TX8 specify a small `1 → 1` / `2 → 1` / `1 → ø` / `ø → 1` hint per gap card driven by counts. Not implemented in v2.4.15. | **Documented** + intent captured. Visible UX ships in v2.4.17 polish pass; this doc is the spec the v2.4.17 implementation reads from. | DEFERRED v2.4.17 |
| KD9 | `ui/components/PillEditor.js parseToSegments` look-behind sensitivity | When a saved template's preceding label-text doesn't exactly match the field-manifest canonical label (e.g. user typed `Customer na: {{session.customer.name}}` instead of `Customer name: {{session.customer.name}}`), the parser does NOT consume the mismatched text and renders the pill as **bare** → user sees plain text + a `{{path}}` capsule side-by-side. **Investigated v2.4.16** as the "half text / half capsule" report from iter-5 review. Synthetic + Skill Builder live tests confirmed: this is parser-by-design, not a DOM corruption bug. Suite 47 PE4 pins the current behavior. | **By-design** (current parser is correct: a mismatched label can't be silently consumed). UX clarity question DEFERRED to v2.4.17 polish pass: should the editor visually highlight bare pills next to label-like text (e.g. amber underline + tooltip "label mismatch — expected 'Customer name: '") so the user knows it's not a bug? Awaiting user direction. | INVESTIGATED v2.4.16 / UX DEFERRED v2.4.17 |

---

## 10 · Cross-reference index

Rule-id → this doc's section.

| Rule range | Source | Mirrored / referenced here |
|---|---|---|
| I1-I10 (validateInstance) | RULES §1.1 | §1.1, §7.1 |
| G1-G12 (validateGap) | RULES §1.2 | §1.1, §7.2 |
| T1, T2 (taxonomy) | RULES §2 | §4, §4.2 |
| AL1-AL10 (action links) | RULES §2.1 | §4.1 |
| AD1-AD9 (auto-draft) | RULES §3 | §5.1 |
| P1-P7 (propagation) | RULES §4 | §7.4 |
| L1-L8 (link/unlink safety) | RULES §5 | §4.1 |
| W1-W6 (workload mapping) | RULES §6 | §1.1, §3 |
| PR1-PR7 (project bucketing) | RULES §7 | §1.1, §6.4 |
| D1-D10 (driver suggestion) | RULES §8 | §6.5 |
| H1-H4 (health metrics) | RULES §9 | §6.1 |
| M1-M10 (migration) | RULES §10 | §7.3 |
| A1-A7 (AI write-side) | RULES §11 | (referenced by SPEC §12) |
| INV1-INV8 (invariants) | RULES §12 | (referenced by SPEC §12.8) |
| SVC (v2.4.12 services) | RULES §1.2 + (NEW §13 in RULES v2.4.16) | §1.1, §4.3, §8.8 |

---

## 11 · Maintenance

- **When source contradicts this doc**: file is the contract. Either fix source OR amend doc with rationale (date-stamped) in §9 Known divergences.
- **When adding a new entity / relationship / rule**: update §1-2 here AND `docs/RULES.md §N` AND `SPEC.md §9` in the same release. The three docs are coupled.
- **Reporting derivation changes**: `docs/TAXONOMY.md §6` is canonical; `services/*.js` functions carry `// Last audited` comments referencing the most recent release that traced them.
- **Last validated** stamp at the top of this file is updated each release where §6 or §7 contracts change.

---

## Appendix A — Quick reference cards

### A.1 · Disposition cheat-sheet

```
Replace      = 1 from + 1 to    (1 retired, 1 introduced)
Consolidate  = 2+ from + 1 to   (N retired, 1 introduced)
Retire       = 1 from + 0 to    (1 retired)
Introduce    = 0 from + 1 to    (0 + 1 new)
Enhance      = 1 from + ?       (1 stays + uplift)
Keep         = 1 from + 0 to    (1 stays; no gap)
Operational  = 0+ from + 0+ to  (0 asset Δ; ≥1 link OR ≥10ch notes)
```

### A.2 · Reporting touch-points

```
Tab 5 Overview         → getHealthSummary + computeBucketMetrics
Tab 5 Vendor Mix       → computeMixByLayer + computeMixByEnv + computeVendorTableData
Tab 5.5 Roadmap        → buildProjects + groupProjectsByProgram + effectiveDellSolutions
Tab 5 Heatmap          → computeBucketMetrics × LAYERS × getVisibleEnvironments
Tab 5 Risk             → computeRiskPosture + computeLayerImpact
Tab 5 Brief / Exec     → generateSessionBrief / generateExecutiveSummary
Tab 5 Coverage         → computeDiscoveryCoverage
Tab 5 Health (single)  → computeAccountHealthScore
```

### A.3 · Hide / Close / Soft-delete summary

```
Environment hidden → DROPS from Tab 2/3 + DROPS from Tab 5 reporting
                     instances + gap.affectedEnvironments PRESERVED in JSON
                     restore is one-click, no confirmation
Gap closed         → SHOWN in Tab 4 only with "Show closed gaps" filter
                     EXCLUDED from default Tab 5 rollups
                     reopen via gap detail panel button
Asset retired      → LOGICAL only (instance persists in session.instances)
                     signaled via gap (gapType: ops + relatedCurrentInstanceIds)
                     OR via instance.disposition: "retire"
```
