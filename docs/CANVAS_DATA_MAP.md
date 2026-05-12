# Canvas Data Map · canonical data-point + relationships definitions

> **Authority**: this document is the audited end-state of every data point
> a Dell Discovery Canvas skill or AI assistant can read, write, or reason
> about. It supersedes any prior informal description.
>
> **Provenance**: produced by the BUG-058 audit (2026-05-12). Cross-validated
> against `core/dataContract.js` (RELATIONSHIPS_METADATA, PICKER_METADATA,
> INSIGHTS_PATHS, LABEL_RESOLVED_PATHS), `docs/UI_DATA_TRACE.md` r6, and
> `docs/UI_DATA_KNOWLEDGE_BASE.md` r2. Every entry traces to a UI tab
> section + a schema/* invariant + a known UX flow.
>
> **Used by**:
> 1. **Skills Builder** — picker descriptions, mandatory-pairing rules,
>    Improve meta-skill priming.
> 2. **AI Chat assistant** (BUG-062, post-this-audit) — system-prompt
>    context priming so the LLM understands the model BEFORE responding.
>
> **Discipline anchor**: any change to `RELATIONSHIPS_METADATA` or related
> structures requires the `[CONSTITUTIONAL TOUCH PROPOSED]` Q&A flow per
> `feedback_5_forcing_functions.md` Rule A. This document IS that Q&A.

---

## Table of contents

1. [Core mental model](#1-core-mental-model)
2. [Entity classes (singleton vs collection vs derived-insight)](#2-entity-classes)
3. [Per-entity data-point definitions](#3-per-entity-data-point-definitions)
4. [Relationship taxonomy](#4-relationship-taxonomy)
5. [Schema invariants the AI/skill MUST honor](#5-schema-invariants)
6. [Anti-confusion contract (semantic distinctions)](#6-anti-confusion-contract)
7. [BUG-058 audit findings · per-entry verdicts](#7-bug-058-audit-findings)
8. [Wire-format for context priming (BUG-062 forward link)](#8-wire-format-for-context-priming)
9. [Revision log](#9-revision-log)

---

## 1. Core mental model

A Dell Discovery Canvas engagement is a **structured conversation about a customer's technology landscape** organized by a single overarching question:

> *"What does the customer have today (current state), what should they have tomorrow (desired state), and what gaps must be closed to get there?"*

The mental model is a **5-tab progressive narrative**:

| Tab | Surface | Authored entity | Output role |
|-----|---------|-----------------|-------------|
| 1   | Context | customer + drivers + environments | The "who/why/where" — the engagement's frame |
| 2   | Current state | instances (state="current") | The "what they have today" — install-base capture |
| 3   | Desired state | instances (state="desired") + disposition + auto-drafted gaps | The "what they should have" — proposal articulation |
| 4   | Gaps | gaps + driver-binding + service-binding | The "how to get there" — initiative backlog |
| 5   | Reporting | (read-only insights) | The "story to executives" — derived narrative |

A skill or AI response that doesn't honor this progression risks producing output that feels disconnected from how the engineer thinks about the workshop.

---

## 2. Entity classes

The 73 audited paths fall into 7 buckets across 3 entity classes:

### 2.1 Singletons (one-per-engagement)

| Entity | Paths | Anchor |
|--------|-------|--------|
| `customer` | 5: name, vertical, verticalLabel, region, notes | `customer.name` |
| `engagementMeta` | 1: presalesOwner | `customer.name` (only because the workshop is for that customer) |

**Singleton rule**: there is exactly one customer and one engagement meta per engagement. **No mandatory pairing is required between singleton fields** because the engagement context already implies whose data this is. (Pre-audit, every singleton field had `mandatoryWith: ["customer.name"]` — this was wrong busywork; see §7 fix list.)

### 2.2 Collections (iterable N records per engagement)

| Entity | Paths | Anchor |
|--------|-------|--------|
| `driver` | 5: name, businessDriverId, priority, outcomes, hint | `driver.name` |
| `environment` | 10: name, alias, envCatalogId, kindLabel, location, tier, sizeKw, sqm, notes, hidden | `environment.name` |
| `instance` | 15: label, vendor, vendorGroup, layerLabel, layerId, environmentName, environmentId, criticality, dispositionLabel, disposition, priority, originId, mappedAssetIds, notes, state | `instance.label` |
| `gap` | 22: description, urgency, urgencyOverride, phase, status, reviewed, origin, gapTypeLabel, gapType, layerLabel, layerId, driverName, driverId, notes, affectedEnvironmentNames, affectedEnvironments, affectedLayerLabels, affectedLayers, servicesLabels, services, relatedCurrentInstanceIds, relatedDesiredInstanceIds | `gap.description` |

**Collection rule**: every non-anchor field on a collection entity **MUST** be paired with the entity's anchor in skill output, because without the anchor you can't tell *which record* the field belongs to. ("High criticality" with no instance label is unusable.)

### 2.3 Derived insights (computed read-only aggregates)

| Class | Paths |
|-------|-------|
| Coverage | 2: percent, actions |
| Risk | 2: level, actions |
| Totals | 5: currentInstances, desiredInstances, gaps, highUrgencyGaps, unreviewedGaps |
| Dell density | 2: percent, byLayer |
| Projects | 3: names, byPhase, byDriver |
| Executive summary | 1: brief |

**Insights rule**: insights are aggregates with no anchor pairing. They're standalone scores / counts / arrays surfaced on Tab 5 (Reporting). They DO have `derivedFrom` metadata pointing at the source fields + computation service.

---

## 3. Per-entity data-point definitions

For brevity, each entry below shows the canonical shape:
- **path** · the dotted key
- **type** · scalar / enum / FK / derived / array
- **scope** · standard / advanced (which Skills Builder picker tab)
- **purpose** · why a skill or AI cares
- **authored at** · UI tab + section
- **relationships** · FK pair / multi-hop chain / state condition / mandatory pairing
- **caveat** · semantic gotchas (level vs phase, alias fallback, etc.)

### 3.1 Customer (singleton · 5 paths)

#### `customer.name` · ⭐ ANCHOR
- **type**: string, required (≥1 char)
- **scope**: standard
- **purpose**: The engagement's "who" — every chat narrative + report cover references it
- **authored at**: Tab 1 §2 Discovery context · "Customer name" input
- **relationships**: none (this IS the anchor)
- **caveat**: typing into this field on the demo session flips `engagement.meta.isDemo` to false

#### `customer.verticalLabel` · derived label
- **type**: derived string (catalog-joined)
- **scope**: standard
- **purpose**: Healthcare / Financial Services / etc. — narrative-ready label
- **authored at**: Tab 1 §2 Discovery context · "Vertical / segment" dropdown (writes `customer.vertical` raw id; label resolves at render)
- **relationships**: `customer.vertical` → `CUSTOMER_VERTICALS.byId[<id>].label`
- **caveat**: prefer this over `customer.vertical` for narrative output

#### `customer.vertical` · FK id
- **type**: string (FK to `CUSTOMER_VERTICALS` catalog)
- **scope**: advanced (raw id; most skills should use the resolved label)
- **purpose**: for id-matching skills (filter / catalog lookup)
- **authored at**: Tab 1 §2 dropdown
- **relationships**: pairs with `customer.verticalLabel` (resolved form)

#### `customer.region`
- **type**: string, free-text
- **scope**: standard
- **purpose**: geographic scope of the engagement
- **authored at**: Tab 1 §2 Discovery context · "Region" input
- **caveat**: not validated against a catalog yet

#### `customer.notes`
- **type**: string, free-text, optional (default `""`)
- **scope**: standard
- **purpose**: catch-all customer context that doesn't fit structured fields
- **authored at**: Tab 1 §2 Discovery context · "Customer notes" textarea
- **caveat**: migrator preserves legacy v2.x `segment` / `industry` content into this field

### 3.2 EngagementMeta (singleton · 1 path)

#### `engagementMeta.presalesOwner`
- **type**: string, free-text, optional (default `""`)
- **scope**: standard
- **purpose**: workshop attribution; surfaces on Reporting cover + executive summary
- **authored at**: Tab 1 §2 Discovery context · "Presales owner" input
- **caveat**: **PRE-AUDIT BUG (BUG-058 fix #1)** · previously had `mandatoryWith: ["customer.name"]` which was incorrect. Both are singletons; presales owner stands alone semantically.

### 3.3 Driver (collection · 5 paths)

> **Collection rule**: any non-anchor driver field MUST pair with `driver.name` in output.

#### `driver.name` · ⭐ ANCHOR
- **type**: derived string (catalog-joined)
- **scope**: standard
- **purpose**: the driver's customer-facing name (Cyber Resilience, AI & Data Platforms, etc.)
- **authored at**: Tab 1 §3 driver palette (author picks from 8 catalog entries; `businessDriverId` is stored, label looked up at render)
- **relationships**: `driver.businessDriverId` → `BUSINESS_DRIVERS.byId[<id>].label`
- **caveat**: with N drivers, returns N joined values (newline-separated narrative)

#### `driver.priority`
- **type**: enum `High` | `Medium` | `Low`, default `Medium`
- **scope**: standard
- **purpose**: how critical THIS driver is to the customer (criticality LEVEL, not a rank — multiple drivers can be `High`)
- **authored at**: Tab 1 §4 driver detail · "Priority" dropdown
- **caveat**: **SEMANTIC GOTCHA** (see §6) — priority here means criticality-level, NOT ranking

#### `driver.outcomes`
- **type**: string, free-text, optional (default `""`)
- **scope**: standard
- **purpose**: the per-driver discussion / comment field — what business outcomes the customer named
- **authored at**: Tab 1 §4 driver detail · "Business outcomes" textarea (per-keystroke commit)
- **caveat**: there is NO separate "driver notes" field — `outcomes` IS the comment

#### `driver.hint` · catalog hint
- **type**: derived string (catalog hint text)
- **scope**: advanced (catalog-derived; not author-content)
- **purpose**: short prompt-aid text from the catalog (e.g., "We must recover from attacks without paying")
- **relationships**: `driver.businessDriverId` → `BUSINESS_DRIVERS.byId[<id>].hint`

#### `driver.businessDriverId` · FK id
- **type**: string (FK)
- **scope**: advanced
- **purpose**: id-matching skills
- **relationships**: pairs with `driver.name` (resolved form)

### 3.4 Environment (collection · 10 paths)

> **Collection rule**: any non-anchor environment field MUST pair with `environment.name` in output.

#### `environment.name` · ⭐ ANCHOR (with alias fallback)
- **type**: derived string (alias-or-catalog-label)
- **scope**: standard
- **purpose**: the customer's name for this site (e.g., "Riyadh DC") with fallback to catalog label
- **authored at**: Tab 1 §6 env detail · "Alias" input (alias is what customizes; catalog label is the default)
- **relationships**: `environment.alias` (if set) OR `environment.envCatalogId` → `ENV_CATALOG.byId[<id>].label`
- **caveat**: a customer with two Edge sites can name them "Riyadh Edge" and "Jeddah Edge" via the alias

#### `environment.location`
- **type**: string, free-text
- **scope**: standard
- **purpose**: physical location (city, region, country, or "Multi-region")
- **authored at**: Tab 1 §6 env detail · "Location" input

#### `environment.tier`
- **type**: string (datalist suggestions: Tier I-IV / Public / Sovereign / Edge / N/A); free-text fallback
- **scope**: standard
- **purpose**: resilience-tier qualifier
- **authored at**: Tab 1 §6 env detail · "Tier" datalist

#### `environment.sizeKw`
- **type**: number (range 0-200), default null
- **scope**: standard
- **purpose**: power footprint
- **caveat**: **FIELD NAME IS MISLEADING** — internally `sizeKw` but the UI labels it "Capacity (MW)" because that's the customer-facing unit

#### `environment.sqm`
- **type**: number (range 0-100000), default null
- **scope**: standard
- **purpose**: floor area in square meters; useful for telco/colo conversations

#### `environment.notes`
- **type**: string, free-text, optional
- **scope**: standard
- **purpose**: per-site free-text comment

#### `environment.envCatalogId` · FK id
- **type**: string (FK to `ENV_CATALOG`)
- **scope**: advanced
- **purpose**: id-matching skills

#### `environment.kindLabel` · catalog label (no alias fallback)
- **type**: derived string
- **scope**: advanced (rare — most skills want `environment.name` which DOES alias-fallback)
- **purpose**: pure catalog label, ignoring custom alias

#### `environment.alias`
- **type**: string, free-text, optional
- **scope**: advanced (alias-only, no catalog fallback)
- **purpose**: skills that specifically want to know if the customer set a custom name

#### `environment.hidden`
- **type**: boolean, default false
- **scope**: advanced (system-flag, not narrative)
- **purpose**: soft-delete flag — hidden envs are excluded from reports but preserved in the saved file
- **authored at**: Tab 1 §5 Hide button / §6 Hide button / "Single site" preset chip

### 3.5 Instance (collection · 15 paths · current + desired discriminated by `state`)

> **Collection rule**: any non-anchor instance field MUST pair with `instance.label` in output. Several fields are **state-conditional** — they apply ONLY to desired-state OR ONLY to current-state instances (see field-level caveats).

#### `instance.label` · ⭐ ANCHOR
- **type**: string, required (≥1 char)
- **scope**: standard
- **purpose**: instance display name (e.g., "PowerStore 5200" or "Oracle Production DB")
- **authored at**: Tab 2/3 §6/§11 command palette pick OR "+ Add new" free-text
- **caveat**: on retire-action mirrors, the system appends " [RETIRE]" to the label at disposition time (persisted in the field)

#### `instance.vendor`
- **type**: string, free-text
- **scope**: standard
- **authored at**: Tab 2/3 §6 catalog pick OR §6b vendor chooser

#### `instance.vendorGroup`
- **type**: enum `dell` | `nonDell` | `custom`
- **scope**: standard
- **purpose**: drives the vendor-mix bar on Tab 5 + the tile color-class

#### `instance.layerLabel` · derived label
- **type**: derived string
- **scope**: standard
- **purpose**: layer name (Compute / Storage / Network / Security / Workload / Data Protection / Virtualization / Infrastructure)
- **relationships**: `instance.layerId` → `LAYERS.byId[<id>].label`

#### `instance.layerId` · FK id
- **type**: string (FK to `LAYERS`)
- **scope**: advanced
- **authored at**: Tab 2/3 matrix cell row position

#### `instance.environmentName` · derived label (alias fallback)
- **type**: derived string
- **scope**: standard
- **relationships**: `instance.environmentId` → `engagement.environments.byId[<id>].alias || ENV_CATALOG.byId[<envCatalogId>].label`

#### `instance.environmentId` · FK id
- **type**: string (FK to environments)
- **scope**: advanced
- **authored at**: Tab 2/3 matrix cell column position

#### `instance.criticality`
- **type**: enum `High` | `Medium` | `Low`, default `Low`
- **scope**: standard
- **purpose**: business criticality LEVEL of THIS asset ("if this goes down, how bad?")
- **authored at**: Tab 2 §7 detail dropdown (current-state only)
- **caveat**: **SEMANTIC GOTCHA** (see §6) — level, not rank. On desired-state instances, criticality is **carried from the originating current via originId** (no separate authoring).

#### `instance.dispositionLabel` · derived label · **state-conditional: desired**
- **type**: derived string
- **scope**: standard
- **purpose**: human-readable disposition action (Keep / Enhance / Replace / Consolidate / Retire / Introduce / Operational)
- **authored at**: Tab 3 §8 disposition picker grid OR §9 detail "Action" dropdown
- **relationships**: `instance.disposition` → `DISPOSITION_ACTIONS.byId[<id>].label`
- **caveat**: `null` on current-state instances. Setting disposition auto-drafts a gap.

#### `instance.disposition` · FK id · **state-conditional: desired**
- **type**: string (FK)
- **scope**: advanced

#### `instance.priority` · **state-conditional: desired**
- **type**: enum `Now` | `Next` | `Later`, default `Now` for system-created mirrors / `Next` for net-new
- **scope**: standard
- **purpose**: roadmap phase (Now = 0-12 mo, Next = 12-24 mo, Later = >24 mo)
- **authored at**: Tab 3 §9 detail "Phase" dropdown (hidden when disposition = "keep")
- **caveat**: **SEMANTIC GOTCHA** (see §6) — despite the name "priority", this is a PHASE ordering (Now > Next > Later). Drives the kanban column placement of the linked gap.

#### `instance.originId` · **state-conditional: desired · system-set**
- **type**: string (FK to a current instance), nullable
- **scope**: advanced
- **purpose**: replace-lifecycle anchor — the current instance this desired one replaces
- **authored at**: Tab 3 §8 disposition apply (system-set, not directly editable)

#### `instance.mappedAssetIds` · **state-conditional: workload-layer**
- **type**: array of FK to instances, default []
- **scope**: advanced
- **purpose**: workload-to-infrastructure mapping (one workload's mapped storage / compute / network assets)
- **authored at**: Tab 2 §8 / Tab 3 §10 mapped-asset list + asset picker (workload-only)
- **caveat**: **PRE-AUDIT BUG (BUG-058 fix #2)** · previously had `crossCutting: true` with comment "MAY span different environments". This is WRONG. The `mapWorkloadAssets` action enforces **I7 invariant: same environment** (`asset.environmentId === workload.environmentId`). Cross-environment mappings are forbidden. **Correct value: `crossCutting: false`.**

#### `instance.notes`
- **type**: string, free-text, optional
- **scope**: standard
- **caveat**: different placeholder per state — current placeholder hints at "pain, version, EOL"; desired hints at "outcome, requirements, constraints"

#### `instance.state`
- **type**: enum `current` | `desired`
- **scope**: standard (rarely narrative; used as a qualifier when state-conditional fields are picked)
- **caveat**: implicit at Tab 2 (always `"current"`) and Tab 3 (always `"desired"`); the tab itself IS the writer

### 3.6 Gap (collection · 22 paths)

> **Collection rule**: any non-anchor gap field MUST pair with `gap.description` in output.

#### `gap.description` · ⭐ ANCHOR
- **type**: string, free-text, required (≥1 char)
- **scope**: standard
- **purpose**: the one-line initiative statement (e.g., "Replace EOL Oracle DB with PowerStore-backed PostgreSQL")
- **authored at**: Tab 4 §8e detail textarea OR §10 add dialog OR Tab 3 §8 disposition auto-draft

#### `gap.urgency`
- **type**: enum `High` | `Medium` | `Low`
- **scope**: standard
- **purpose**: how urgent this gap is to address — pain/business-risk LEVEL (NOT rank)
- **authored at**: Tab 4 §8e urgency group (🔒 lock-to-pin OR ↺ release-to-auto)
- **relationships**: **derived** from the linked current instance(s)' `criticality` UNLESS `urgencyOverride=true`
- **caveat**: **SEMANTIC GOTCHA** — level not rank. Derivation: when current criticality changes (Tab 2 save), `syncGapsFromCurrentCriticalityAction` walks every gap whose `relatedCurrentInstanceIds` contains the changed instance and updates urgency. With multiple linked currents, the **last-changed wins** (NOT a max-aggregate; the pre-audit `derivedFrom` claim of `relatedCurrentInstanceIds[0].criticality` was imprecise).

#### `gap.urgencyOverride`
- **type**: boolean, default false
- **scope**: advanced
- **purpose**: when true, urgency is author-pinned and the auto-derivation is suppressed
- **authored at**: Tab 4 §8e 🔒 / ↺ buttons

#### `gap.phase`
- **type**: enum `now` | `next` | `later` (lowercase in storage; UI shows "Now (0-12 months)" etc.)
- **scope**: standard
- **purpose**: kanban column placement + roadmap project bucket
- **authored at**: Tab 4 §6 drag-drop · §8e dropdown · §10 dialog
- **relationships**: bidirectional sync with linked desired instance's `priority` (`commitSyncDesiredFromGap`)

#### `gap.status`
- **type**: enum `open` | `in_progress` | `closed` | `deferred`, default `open`
- **scope**: standard
- **caveat**: auto-closes when linked desired tile's disposition flips to "keep" (`commitSyncGapFromDesired`)

#### `gap.reviewed` · system-set
- **type**: boolean, default false
- **scope**: advanced
- **purpose**: auto-drafted gaps start `false` until presales approves
- **authored at**: Tab 4 §8f "Approve draft" button

#### `gap.origin` · system-set
- **type**: enum `manual` | `autoDraft`
- **scope**: advanced
- **purpose**: provenance flag — `manual` if author added via §10 dialog; `autoDraft` if created by Tab 3 §8 disposition apply

#### `gap.gapTypeLabel` · derived label
- **type**: derived string
- **scope**: standard
- **purpose**: action category (Replace / Enhance / Introduce / Consolidate / Operational)
- **authored at**: Tab 4 §8e dropdown for manual gaps; **read-only locked** for auto-drafted gaps (change the source disposition instead)
- **relationships**: `gap.gapType` → `GAP_TYPES.byId[<id>].label`
- **derivedFrom (auto-draft path)**: `instance.disposition` when `gap.origin === "autoDraft"`

#### `gap.gapType` · FK id
- **type**: string (FK)
- **scope**: advanced

#### `gap.layerLabel` · derived label
- **type**: derived string
- **scope**: standard
- **purpose**: primary architectural layer
- **relationships**: `gap.layerId` → `LAYERS.byId[<id>].label`
- **invariant G6**: `gap.affectedLayers[0] === gap.layerId` (primary at index 0)

#### `gap.layerId` · FK id
- **type**: string (FK)
- **scope**: advanced

#### `gap.driverName` · derived label (multi-hop)
- **type**: derived string (2-hop catalog lookup)
- **scope**: standard
- **purpose**: the "why" — which strategic driver this gap serves
- **authored at**: Tab 4 §8e Strategic driver dropdown OR "Pin this driver" button on the auto-suggest chip
- **relationships**: `gap.driverId` → `engagement.drivers.byId[<id>].businessDriverId` → `BUSINESS_DRIVERS.byId[<bid>].label`
- **caveat**: ★ = manually pinned (driverId set); ☆ = auto-suggested (driverId null, derived from linked instances)

#### `gap.driverId` · FK id
- **type**: string (FK to engagement.drivers), nullable
- **scope**: advanced

#### `gap.notes`
- **type**: string, free-text, optional
- **scope**: standard
- **caveat**: **AL7 invariant** — Ops-typed gaps with zero linked instances MUST have notes ≥10 chars

#### `gap.affectedEnvironmentNames` · derived array label (cross-cutting)
- **type**: derived array<string>
- **scope**: standard
- **purpose**: human names of all environments this gap touches
- **authored at**: Tab 4 §8e multi-checkbox row
- **relationships**: `gap.affectedEnvironments[]` → `engagement.environments.byId[<id>].alias || ENV_CATALOG.byId[<envCatalogId>].label`
- **caveat**: cross-cutting (one gap can affect multiple envs · cardinality 1 gap : N envs)

#### `gap.affectedEnvironments` · FK array (cross-cutting)
- **type**: array<string> (FK array)
- **scope**: advanced

#### `gap.affectedLayerLabels` · derived array label (cross-cutting)
- **type**: derived array<string>
- **scope**: standard
- **purpose**: human names of all architectural layers this gap touches; primary at index 0 (G6)
- **authored at**: Tab 4 §8e "Also affects" chips

#### `gap.affectedLayers` · FK array (cross-cutting)
- **type**: array<string> (FK array)
- **scope**: advanced

#### `gap.servicesLabels` · derived array label
- **type**: derived array<string>
- **scope**: standard
- **purpose**: Dell-services labels (Assessment / Migration / Operate / etc.)
- **relationships**: `gap.services[]` → `SERVICE_TYPES.byId[<id>].label`

#### `gap.services` · FK array
- **type**: array<string> (FK array)
- **scope**: advanced

#### `gap.relatedCurrentInstanceIds`
- **type**: array<string> (FK to current instances)
- **scope**: advanced
- **purpose**: which current-state instances this gap anchors on (drives the urgency derivation when urgencyOverride=false)
- **authored at**: Tab 4 §8g + Link / × unlink buttons

#### `gap.relatedDesiredInstanceIds`
- **type**: array<string> (FK to desired instances)
- **scope**: advanced
- **purpose**: which desired-state instances this gap proposes
- **authored at**: Tab 4 §8g + Link / × unlink buttons (with phase-conflict ack)

### 3.7 Insights (derived · read-only · 15 paths)

> **Insights rule**: no anchor pairing. Each insight has a `derivedFrom.selector` pointing at the computation service + `sourceFields` listing the underlying data. Surfaced on Tab 5 (Reporting).

| Path | Type | Source service |
|------|------|----------------|
| `insights.coverage.percent` | number 0-100 | `roadmapService.computeDiscoveryCoverage` |
| `insights.coverage.actions` | array<string> | `roadmapService.computeDiscoveryCoverage` (suggested-next-actions) |
| `insights.risk.level` | enum High/Medium/Low/Elevated | `roadmapService.computeRiskPosture` |
| `insights.risk.actions` | array<string> | `roadmapService.computeRiskPosture` (mitigation actions) |
| `insights.totals.currentInstances` | integer | `healthMetrics.getHealthSummary` |
| `insights.totals.desiredInstances` | integer | `healthMetrics.getHealthSummary` |
| `insights.totals.gaps` | integer | `healthMetrics.getHealthSummary` |
| `insights.totals.highUrgencyGaps` | integer | `healthMetrics.getHealthSummary` filtered urgency=High |
| `insights.totals.unreviewedGaps` | integer | gap walk filtered reviewed=false + status=open |
| `insights.dellDensity.percent` | number 0-100 | `vendorMixService.computeMixByLayer` |
| `insights.dellDensity.byLayer` | object<layerId,percent> | `vendorMixService.computeMixByLayer` |
| `insights.projects.names` | array<string> | `roadmapService.buildProjects` |
| `insights.projects.byPhase` | object<phase,array> | `roadmapService.buildProjects` (grouped) |
| `insights.projects.byDriver` | object<driverName,array> | `programsService.groupProjectsByProgram` |
| `insights.executiveSummary.brief` | array<{label,text}> | `roadmapService.generateSessionBrief` |

---

## 4. Relationship taxonomy

Each path's `RELATIONSHIPS_METADATA` entry can carry these dimensions:

| Field | Meaning | Example |
|-------|---------|---------|
| `isAnchor: true` | This is the entity's anchor field; all other fields on the entity pair with it | `instance.label`, `gap.description` |
| `fkPair: "<other-path>"` | This field has a paired form (id ↔ label) | `gap.gapType` ↔ `gap.gapTypeLabel` |
| `multiHop: [...]` | Resolution chain (source → join → catalog → result) | `gap.driverName` does a 2-hop join |
| `stateConditional: { onField, value, description }` | Field is meaningful ONLY when another field has a specific value | `instance.disposition` is only on `instance.state="desired"` |
| `mandatoryWith: ["<path1>", ...]` | Suggested companion paths for narrative completeness | Collection non-anchor → anchor |
| `crossCutting: true` | Cardinality > 1 — array spans the FK target | `gap.affectedEnvironments` (one gap, N envs) |
| `derivedFrom: { selector, sourceFields, description }` | Field is computed (not directly authored) | All insights |
| `provenance: "system"` | Field is set by app code, not the engineer | `instance.originId`, `gap.reviewed`, `gap.origin` |
| `ordering: { kind, note }` | How the field's values compare/sort | `_LEVEL_ORDERING` for criticality/priority/urgency; `_PHASE_ORDERING` for Now/Next/Later |

The **`mandatoryWith` rule** is the most-misused dimension. Use it ONLY for collection-anchor pairing; singletons + insights should leave it empty.

---

## 5. Schema invariants

These are enforced by `schema/*.js` `superRefine` rules + `state/collections/*.js` action helpers. A skill or AI MUST respect them when generating proposed mutations:

| ID | Surface | Rule |
|----|---------|------|
| **R3.5.a** | instance | `originId` is permitted ONLY on `state === "desired"`. Current instances MUST have `originId: null`. |
| **R3.5.a** | instance | `priority` is permitted ONLY on `state === "desired"`. Current instances MUST have `priority: null`. |
| **R3.5.b** | instance | `mappedAssetIds.length > 0` is permitted ONLY on `layerId === "workload"`. |
| **V-INV-15b** | instance | `originId !== instance.id` (no self-reference). |
| **I1** | mapWorkloadAssets | source instance MUST have `layerId === "workload"`. |
| **I3** | mapWorkloadAssets | every assetId MUST exist in `engagement.instances.byId`. |
| **I4** | mapWorkloadAssets | workload cannot map to itself. |
| **I5** | mapWorkloadAssets | mapped asset MUST have `layerId !== "workload"`. |
| **I6** | mapWorkloadAssets | mapped asset MUST share the workload's `state`. |
| **I7** | mapWorkloadAssets | mapped asset MUST share the workload's `environmentId` (same-env constraint — see Pre-audit BUG fix #2). |
| **I8** | mapWorkloadAssets | mapped asset MUST NOT have `disposition === "retire"`. |
| **G6** | gap | `affectedLayers[0] === layerId` (primary layer at index 0). |
| **AL7** | gap | Ops-typed gaps with zero linked instances MUST have `notes.length >= 10`. |
| **A6** | gap | `urgency` auto-derivation honors `urgencyOverride` (pinned values are never overwritten by sync). |
| **A1** | gap | `validateActionLinks` runs at approve-gate time; auto-drafted gaps with schema-invalid shape stay `reviewed=false`. |

---

## 6. Anti-confusion contract

The schema uses the word **"priority"** in three different semantic senses + **"criticality"** in a fourth. A skill or AI assistant that conflates them produces nonsense output.

### 6.1 Level (criticality) vs phase (ordering) vs rank (forbidden)

| Field | Semantic | Allowed framing | FORBIDDEN framing |
|-------|----------|-----------------|---------------------|
| `driver.priority` | **Level** · how critical this driver is TO THE CUSTOMER | "Which drivers are High-priority?" / "List drivers and their priority levels" | ~~"The top-priority driver"~~ ~~"Rank drivers by priority"~~ |
| `instance.criticality` | **Level** · how business-critical THIS asset is | "Which High-criticality assets need attention?" | ~~"The most critical asset"~~ ~~"Rank assets by criticality"~~ |
| `gap.urgency` | **Level** · how urgent this gap is to address | "Which High-urgency gaps land in Now?" | ~~"The most urgent gap"~~ |
| `instance.priority` | **Phase** · WHEN in the roadmap | "Now / Next / Later phase" — IS ordered (Now > Next > Later) | (no forbidden framing — phase IS an ordering) |
| `gap.phase` | **Phase** · WHEN in the roadmap | Same as instance.priority | (no forbidden framing) |

### 6.2 Carried vs authored fields

| Field | Authored where | Caveat |
|-------|----------------|--------|
| `instance.criticality` on desired | NOT directly · carried from origin via `originId` | Desired tile shape inherits criticality from the current it replaces |
| `gap.urgency` | NOT directly (default) · derived from `relatedCurrentInstanceIds[*].criticality` UNLESS `urgencyOverride=true` | The 🔒 button pins; ↺ releases back to auto |
| `gap.gapType` (auto-drafted) | NOT directly · derived from the source `instance.disposition` | Locked read-only in the UI; change the source disposition to change the gap type |
| `instance.originId` | system-set on disposition apply | Never directly editable |
| `gap.reviewed`, `gap.origin` | system-set | Provenance flags |

### 6.3 Singleton vs collection vs derived

| Class | Anchor pairing rule | Example consequence |
|-------|---------------------|---------------------|
| Singleton (customer, engagementMeta) | **None** — the engagement context implies whose data this is | Skill picking `customer.region` doesn't need to also pick `customer.name` |
| Collection (driver / env / instance / gap) | **Anchor required** — without the anchor you can't tell which record | Skill picking `instance.criticality` MUST also pick `instance.label` |
| Derived insight | **None** — aggregates are standalone | Skill picking `insights.coverage.percent` doesn't need a pairing |

### 6.4 Same-env vs cross-cutting

| Field | Cross-cutting? | Why |
|-------|----------------|-----|
| `instance.mappedAssetIds` | **NO** (corrected post-audit) | I7 invariant forces same-env mapping |
| `gap.affectedEnvironments` | **YES** | one gap can affect multiple envs (1:N) |
| `gap.affectedLayers` | **YES** | one gap can affect multiple layers (G6: primary at [0]) |

---

## 7. BUG-058 audit findings

### 7.1 Verdicts summary

| Verdict | Count | Notes |
|---------|-------|-------|
| **KEEP** | 65 | Entry is correct and traceable |
| **FIX** | 6 | Entry has a real bug (see below) |
| **CLARIFY** | 2 | Entry is correct but description is imprecise (see below) |
| **REMOVE** | 0 | No entries need to be removed entirely |

### 7.2 FIX list (6 entries) · all `RELATIONSHIPS_METADATA` changes

These changes touch `core/dataContract.js` which is a **locked constitutional surface**. Per `feedback_5_forcing_functions.md` Rule A, this Canvas Data Map document IS the constitutional Q&A; the corrections land in a follow-up commit titled `[CONSTITUTIONAL TOUCH PROPOSED]` once user confirms.

| # | Path | Field | Pre-audit | Post-audit | Rationale |
|---|------|-------|-----------|------------|-----------|
| 1 | `customer.verticalLabel` | `mandatoryWith` | `["customer.name"]` | `[]` | Singleton entity; no anchor pairing needed |
| 2 | `customer.vertical` | `mandatoryWith` | `["customer.name"]` | `[]` | Singleton entity; no anchor pairing needed |
| 3 | `customer.region` | `mandatoryWith` | `["customer.name"]` | `[]` | Singleton entity; no anchor pairing needed |
| 4 | `customer.notes` | `mandatoryWith` | `["customer.name"]` | `[]` | Singleton entity; no anchor pairing needed |
| 5 | `engagementMeta.presalesOwner` | `mandatoryWith` | `["customer.name"]` | `[]` | Singleton entity; **user-flagged in BUG-058** — both are singletons; presales owner stands alone semantically |
| 6 | `instance.mappedAssetIds` | `crossCutting` + `ordering` text | `true` + "MAY span different environments" | `false` + "Same-env per I7 invariant" | `mapWorkloadAssets` enforces I7 (same `environmentId`); pre-audit claim was contradicted by the action code |

### 7.3 CLARIFY list (2 entries) · description-only refinements

These don't touch the structured fields but the `description` strings need precision so the Improve meta-skill primes the LLM correctly.

| # | Path | Field | Pre-audit | Post-audit |
|---|------|-------|-----------|------------|
| 7 | `gap.urgency` | `derivedFrom.sourceFields` | `["gap.relatedCurrentInstanceIds[0].criticality"]` | `["gap.relatedCurrentInstanceIds[*].criticality (most-recently-changed wins)"]` — the `[0]` index was misleading; actual sync iterates all and last-changed-wins |
| 8 | `gap.gapTypeLabel` | `derivedFrom.description` | "Auto-derived from the source disposition for auto-drafted gaps" | Same text + addendum: "Field is LOCKED read-only in Tab 4 UI for auto-drafted gaps; change the source disposition in Tab 3 to change the gap type" |

### 7.4 KEEP list (excerpts of audit-verified entries)

The remaining 65 entries traced cleanly. Highlights of audit-verified relationships:

- All 8 collection anchors (`driver.name`, `environment.name`, `instance.label`, `gap.description`) correctly have `isAnchor: true` + `mandatoryWith: []`.
- All 4 stateConditional declarations on instance (`dispositionLabel`, `disposition`, `priority`, `originId`) correctly identify `state="desired"` as the qualifier.
- `instance.mappedAssetIds` stateConditional `layerId="workload"` correctly identifies the layer constraint.
- All 8 multiHop FK chains (label-resolved fields) trace correctly through their `source → catalog → result` legs.
- The G6 invariant reference in `gap.affectedLayerLabels.ordering` is accurate (`affectedLayers[0] === layerId`).
- All 15 insights entries have correct `derivedFrom.selector` pointing at the real service function.
- The cross-cutting markers on `gap.affectedEnvironments` / `gap.affectedLayers` (and their label-resolved variants) are correct (gaps genuinely affect multiple environments / layers).

---

## 8. Wire-format for context priming

(Reserved for BUG-062. This section describes the JSON shape the AI chat system prompt will embed as context.)

When BUG-062 lands the AI chat re-architecture, the system prompt will receive a **structured engagement-data block** matching this Canvas Data Map's vocabulary. The block has 3 parts:

### 8.1 Schema knowledge (static — embedded once per session)

The relationship taxonomy from §4, the anti-confusion contract from §6, the invariants from §5, and the per-entity definitions from §3 are embedded as a markdown-formatted system prompt prefix. This teaches the LLM the data model BEFORE the engagement-specific data is added.

### 8.2 Live engagement context (dynamic — refreshed per chat send)

A JSON object scoped to the currently active engagement, shaped like:

```jsonc
{
  "customer": { /* §3.1 fields, label-resolved where applicable */ },
  "engagementMeta": { /* §3.2 fields */ },
  "drivers": [ /* array of §3.3 per-driver objects, label-resolved */ ],
  "environments": [ /* array of §3.4 per-env objects, label-resolved */ ],
  "instances": {
    "current": [ /* array of §3.5 instances filtered state="current" */ ],
    "desired": [ /* array of §3.5 instances filtered state="desired" */ ]
  },
  "gaps": [ /* array of §3.6 gaps, label-resolved + derived urgency surfaced */ ],
  "insights": { /* §3.7 derived aggregates, computed at send time */ }
}
```

### 8.3 Conversation hints (light — included only when relevant)

Optional per-tab hints surface what the engineer is currently looking at:

```jsonc
{
  "viewContext": {
    "tab": "current"  | "desired" | "gaps" | "reporting" | "context",
    "focusedEntity": { "kind": "instance" | "gap" | "driver" | "environment", "id": "<uuid>" },
    "currentFilters": { /* if Tab 4 FilterBar has active dims */ }
  }
}
```

### 8.4 What the LLM does NOT receive

- Raw UUIDs (they confuse narrative; label-resolved forms are provided)
- System provenance fields (aiTag, createdAt, etc.)
- Non-active or hidden state (hidden envs, retired instances are filtered)
- Catalog raw IDs unless the skill explicitly opts into Advanced scope

This is the GUARDRAIL-BY-INTELLIGENCE pattern from BUG-062 · the LLM never sees data that would tempt fabrication; it always sees data that supports accurate narrative.

---

## 9. Revision log

| Revision | Date | Author | Changes |
|----------|------|--------|---------|
| r1 | 2026-05-12 | Claude (audit) | Initial publication · BUG-058 audit · 73 paths cataloged · 6 FIX + 2 CLARIFY findings identified · forward link to BUG-062 wire-format established |

### Hash computation rule

The hash of this document is computed by SHA-256 over the file with line endings normalized to `\n`. Quoted in HANDOFF.md and in `RELATIONSHIPS_METADATA` source comments to detect doc drift.

---

**End of Canvas Data Map r1.**

Next step (BUG-058 completion): user reviews this document → `[CONSTITUTIONAL TOUCH PROPOSED]` Q&A on the 6 FIX changes → if greenlit, code commit lands the corrections in `core/dataContract.js` + corresponding RED tests assert each fix is in place.

Step after that (BUG-062): use §8 wire-format spec to re-architect the AI chat grounding from post-hoc rejection to context-priming.
