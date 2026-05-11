# UI_DATA_KNOWLEDGE_BASE — working

**Document**: `docs/UI_DATA_KNOWLEDGE_BASE.md`
**Revision**: r2
**Hash (FNV-1a 32-bit hex over file content, with the `__HASH_HERE__` placeholder string literal in this line)**: `be052564`
**Date**: 2026-05-11
**Status**: WORKING — r2 adds the Relationships and Bindings section feeding both the picker right pane + the Improve meta-skill system prompt.

## Purpose

The **machine-readable + human-readable** index of every data point a skill author can bind to. Each entry pairs the canonical path (machine ID) with:

- A short, human-friendly **label** for the picker's left pane
- A plain-English **description** for the picker's right pane
- The **canvas surface** that authors / displays it (cross-reference to `UI_DATA_TRACE.md`)
- A **sample value** drawn from the v3-native Northstar Health Network demo
- The **type**, **allowed values**, and **relationships** the LLM needs to reason about

### Why this document exists

Three downstream consumers depend on it:

1. **The Skill Builder picker** (two-pane ServiceNow-style design). Left pane lists entries grouped by category (Standard / Insights / Advanced). Right pane reads structure + sample + relationships verbatim from this file.
2. **AI training/grounding.** The chat system prompt embeds a compact summary of these definitions so the LLM understands what each path means. No more `driver.priority is a rank` confusion.
3. **Onboarding new contributors (humans + AI sessions).** A new author or a fresh Claude session can answer "what data is available?" in under five minutes by reading this file.

### How this is kept in sync with the constitution

- The constitution (`core/dataContract.js`) is the **structural** source of truth — entity shapes, FKs, invariants, catalog contents.
- This knowledge base is the **semantic + presentational** source of truth — what each path *means* in plain English and how it's surfaced in the picker.
- Every entry below cites its constitutional anchor (path in `STANDARD_MUTABLE_PATHS`, `LABEL_RESOLVED_PATHS`, or `INSIGHTS_PATHS`).
- Adding a new data point requires both: a constitutional amendment to add the path AND a new entry in this file.

### Entry shape (the schema for each data point)

Each entry below uses this shape:

```yaml
path:                # machine ID — exactly matches the constitution
label:               # human-friendly label, 2–4 words, picker left-pane
category:            # Standard | Insights | Advanced
entity:              # which entity this path lives on (or "insights" for derived)
type:                # string | number | boolean | enum | array | derived
allowed_values:      # enum list, when applicable
required:            # true | false
description:         # plain-English meaning, 1–3 sentences
authored_at:         # where on the canvas the author types/picks this value
displayed_at:        # where on the canvas this value is shown
sample_value:        # example value from the Northstar Health Network demo
relationships:       # FK joins, multi-hop catalog lookups, etc.
notes:               # critical caveats (e.g. "criticality level, not a rank")
ui_trace_ref:        # cross-reference to UI_DATA_TRACE.md section
```

---

# Category 1 · Standard data points (34 paths)

The bread-and-butter author-meaningful paths. Every Standard path:

- Maps to a real authored or displayed surface on the canvas today (audit-verified)
- Is what a skill author intuitively reaches for when describing a customer scenario
- Resolves to a human-readable string at runtime (FK ids resolve to labels)

## §1.1 · Customer (4 paths)

### `customer.name`
- **Label**: Customer Name
- **Category**: Standard
- **Entity**: customer (singleton)
- **Type**: string
- **Required**: yes (≥1 character)
- **Description**: The customer organization's name. The single most-referenced field across the whole canvas — header chip, every report, every skill that personalizes output.
- **Authored at**: Tab 1 §2 Discovery context, "Customer name" input
- **Displayed at**: Topbar session strip, Reporting cover, every Help-modal heading
- **Sample value**: `"Northstar Health Network"`
- **Relationships**: none — leaf string
- **Notes**: If the user types into this field on the demo session, `engagement.meta.isDemo` auto-flips to `false`.
- **UI trace ref**: §2 Tab 1

### `customer.vertical`
- **Label**: Vertical / Segment
- **Category**: Standard
- **Entity**: customer
- **Type**: string (FK to `CUSTOMER_VERTICALS` catalog)
- **Required**: yes
- **Description**: The customer's industry segment. Stored as the catalog id; the human label resolves via the `CUSTOMER_VERTICALS` catalog. Use `customer.verticalLabel` if you want the rendered label directly.
- **Authored at**: Tab 1 §2 Discovery context, "Vertical / segment" dropdown
- **Displayed at**: Reporting tab, vendor-mix filtering
- **Sample value**: `"healthcare"` (the FK id)
- **Relationships**: `customer.vertical` → `CUSTOMER_VERTICALS.byId[<id>].label`
- **Notes**: This returns the FK id. For the friendly label ("Healthcare"), use `customer.verticalLabel` instead.
- **UI trace ref**: §2 Tab 1

### `customer.verticalLabel`
- **Label**: Vertical (label)
- **Category**: Standard
- **Entity**: customer (label-resolved)
- **Type**: derived string (catalog-joined)
- **Required**: no (returns `[not set]` if not authored)
- **Description**: The human-readable name of the customer's vertical, looked up from the `CUSTOMER_VERTICALS` catalog. Use this in skill outputs that should read naturally.
- **Authored at**: not directly — derived from `customer.vertical`
- **Displayed at**: Tab 1 dropdown shows this label; every other reference renders via this resolver
- **Sample value**: `"Healthcare"`
- **Relationships**: derived from `customer.vertical` → `CUSTOMER_VERTICALS.byId[<id>].label`
- **Notes**: Always prefer this over `customer.vertical` for narrative skill output.
- **UI trace ref**: §2 Tab 1

### `customer.region`
- **Label**: Region
- **Category**: Standard
- **Entity**: customer
- **Type**: string
- **Required**: yes (can be empty)
- **Description**: Geographic region the engagement covers (e.g. "EMEA", "North America", "MENA"). Free-text; may become a catalog later.
- **Authored at**: Tab 1 §2 Discovery context, "Region" input
- **Displayed at**: Reporting cover
- **Sample value**: `"North America"`
- **Relationships**: none — free text
- **Notes**: Not validated against a catalog yet. Authors may use any string.
- **UI trace ref**: §2 Tab 1

### `customer.notes`
- **Label**: Customer Notes
- **Category**: Standard
- **Entity**: customer
- **Type**: string
- **Required**: no (defaults to `""`)
- **Description**: Free-text notes about the customer that don't fit into structured fields. The migrator preserves legacy v2.x `segment`/`industry` fields into this field. Authored in Tab 1 (textarea added 2026-05-11 to close WB-2).
- **Authored at**: Tab 1 §2 Discovery context, "Customer notes" textarea
- **Displayed at**: not yet displayed anywhere except the Tab 1 textarea; available for skill consumption
- **Sample value**: `"Workshop sponsored by CIO. Big focus on cyber resilience after Q3 ransomware near-miss."`
- **Relationships**: none — free text
- **Notes**: Catch-all field. Authors should use it for the "things the discovery conversation surfaced that don't fit anywhere else" content.
- **UI trace ref**: §2 Tab 1

## §1.2 · EngagementMeta (1 path)

### `engagementMeta.presalesOwner`
- **Label**: Presales Owner
- **Category**: Standard
- **Entity**: engagementMeta (singleton)
- **Type**: string
- **Required**: no (defaults to `""`)
- **Description**: Name of the presales engineer running this workshop. Authored in Tab 1 (input wired through to commit 2026-05-11 to close WB-1).
- **Authored at**: Tab 1 §2 Discovery context, "Presales owner" input
- **Displayed at**: Reporting cover, executive-summary selector (`selectExecutiveSummaryInputs.engagementMeta.presalesOwner`)
- **Sample value**: `"Jane Smith"`
- **Relationships**: none — free text
- **Notes**: Pure metadata about the workshop owner; does not affect any data semantics.
- **UI trace ref**: §2 Tab 1

## §1.3 · Driver (3 paths)

### `driver.name`
- **Label**: Driver Name
- **Category**: Standard
- **Entity**: driver (collection — iterates all drivers)
- **Type**: derived string (catalog-joined)
- **Required**: yes
- **Description**: The customer-facing name of the strategic driver (e.g. "Cyber Resilience", "AI & Data Platforms"). Looked up from the `BUSINESS_DRIVERS` catalog via the driver's `businessDriverId`. **This is what a skill should use to refer to a driver in narrative output.**
- **Authored at**: Tab 1 §3 driver palette — author picks from the 8 catalog entries; their `businessDriverId` is stored, the label is looked up at render
- **Displayed at**: Tab 1 driver tiles, Tab 4 strategic-driver dropdown, Tab 5 Roadmap swimlane headers, every chat narrative
- **Sample value (joined across Northstar's 3 drivers)**: `"Cyber Resilience\nModernize Aging Infrastructure\nAI & Data Platforms"`
- **Relationships**: `driver.businessDriverId` → `BUSINESS_DRIVERS.byId[<id>].label`
- **Notes**: For a session with N drivers, this returns N values joined with newlines. Skills wanting a single driver should use `drivers[0].name` (advanced path) or filter further.
- **UI trace ref**: §3 + §4 Tab 1

### `driver.priority`
- **Label**: Driver Priority
- **Category**: Standard
- **Entity**: driver (collection)
- **Type**: enum
- **Allowed values**: `High`, `Medium`, `Low`
- **Required**: yes (default `Medium`)
- **Description**: **How critical this driver is to the customer's strategy** — the customer's care level, not a rank. Multiple drivers can simultaneously be `High`. A customer with three High drivers cares about all three equally. The word "priority" here is everyday English (how high-priority is this for you?), not an ordinal.
- **Authored at**: Tab 1 §4 driver detail panel, "Priority" dropdown
- **Displayed at**: Tab 1 driver tile priority badge, Tab 5 Roadmap swimlane priority chip, Reporting strategic-drivers row
- **Sample value (joined across Northstar's 3 drivers)**: `"High\nHigh\nHigh"`
- **Relationships**: none — enum scalar
- **Notes**: **CRITICAL semantic distinction.** Skill prompts should NOT say "the top-priority driver" or "rank by priority." The right framing is "which drivers are High-priority" or "list the drivers and their priority levels."
- **UI trace ref**: §4 Tab 1

### `driver.outcomes`
- **Label**: Driver Outcomes / Notes
- **Category**: Standard
- **Entity**: driver (collection)
- **Type**: string
- **Required**: no (defaults to `""`)
- **Description**: Free-text bullets capturing the **desired business outcomes** the customer named for this driver. This is the per-driver discussion field — when the customer says "for cyber resilience we want 14-day RTO recovery, quarterly tested DR, ransomware-proof immutable backups," that goes here. **There is no separate "driver notes" field — `outcomes` IS the driver's free-text comment.**
- **Authored at**: Tab 1 §4 driver detail panel, "Business outcomes" textarea (per-keystroke commit)
- **Displayed at**: Tab 5 Roadmap driver detail panel
- **Sample value**: `"• Recover from ransomware within 4 hours, proven quarterly.\n• Immutable backups across all tier-1 workloads.\n• Tabletop exercise with executive team every 6 months."`
- **Relationships**: none — free text
- **Notes**: Per-keystroke commit (not per-blur). Auto-bullets new lines on Enter.
- **UI trace ref**: §4 Tab 1

## §1.4 · Environment (6 paths)

### `environment.name`
- **Label**: Environment Name
- **Category**: Standard
- **Entity**: environment (collection)
- **Type**: derived string (alias-or-catalog-label)
- **Required**: yes
- **Description**: The customer's name for this site/region. Resolves to `environment.alias` if set (e.g. "Riyadh DC"); falls back to the catalog label (e.g. "Primary Data Center") otherwise. **This is what a skill should use to refer to an environment in narrative output.**
- **Authored at**: Tab 1 §6 env detail panel, "Alias" input (the alias is what customizes the name; the catalog label is the default)
- **Displayed at**: Tab 1 env tile label, Tab 2/3 matrix column header, Tab 5 heatmap column header, every chat narrative
- **Sample value (joined across Northstar's 4 envs)**: `"Primary Data Center\nDisaster Recovery Site\nPublic Cloud\nBranch & Edge Sites"`
- **Relationships**: `environment.alias` (if set) OR `environment.envCatalogId` → `ENV_CATALOG.byId[<id>].label`
- **Notes**: Workshops with multiple Edge sites can name them ("Riyadh Edge", "Jeddah Edge") via the alias.
- **UI trace ref**: §5 + §6 Tab 1

### `environment.location`
- **Label**: Environment Location
- **Category**: Standard
- **Entity**: environment
- **Type**: string
- **Required**: no
- **Description**: Where the site physically is. Free-text — city, region, country, "Multi-region" etc.
- **Authored at**: Tab 1 §6 env detail panel, "Location" input
- **Displayed at**: Tab 1 env tile location tag, Reporting (future geo-aware features)
- **Sample value**: `"Dallas, TX"`
- **Relationships**: none
- **Notes**: Not validated. Authors may use any string.
- **UI trace ref**: §6 Tab 1

### `environment.tier`
- **Label**: Environment Tier
- **Category**: Standard
- **Entity**: environment
- **Type**: string (datalist-suggested)
- **Required**: no
- **Description**: Resilience tier of the site. Datalist suggestions: `Tier I`, `Tier II`, `Tier III`, `Tier IV`, `Public`, `Sovereign`, `Edge / Branch`, `N/A`. Free-text — author may type a custom value.
- **Authored at**: Tab 1 §6 env detail panel, "Tier" datalist input
- **Displayed at**: Tab 1 env tile tier tag
- **Sample value**: `"Tier III"`
- **Relationships**: none — string with suggestions
- **Notes**: May become a catalog later. Today treated as free text.
- **UI trace ref**: §6 Tab 1

### `environment.sizeKw`
- **Label**: Environment Capacity (MW)
- **Category**: Standard
- **Entity**: environment
- **Type**: number
- **Required**: no
- **Description**: Power footprint of the site in **megawatts** (despite the field name being `sizeKw` — historical naming). Range: 0–200, step 0.5. Useful for sustainability calculations + cost models.
- **Authored at**: Tab 1 §6 env detail panel, "Capacity (MW)" number input
- **Displayed at**: Tab 1 env tile "N MW" tag
- **Sample value**: `5`
- **Relationships**: none — scalar
- **Notes**: Field name is `sizeKw` for historical reasons but the UI displays + treats it as megawatts.
- **UI trace ref**: §6 Tab 1

### `environment.sqm`
- **Label**: Environment Floor Area (m²)
- **Category**: Standard
- **Entity**: environment
- **Type**: number
- **Required**: no
- **Description**: Floor space of the site in square meters. Range: 0–100,000, step 50. Useful for telco/colo conversations.
- **Authored at**: Tab 1 §6 env detail panel, "Floor area (m²)" number input
- **Displayed at**: Tab 1 env tile "N m²" tag
- **Sample value**: `320`
- **Relationships**: none — scalar
- **Notes**: none
- **UI trace ref**: §6 Tab 1

### `environment.notes`
- **Label**: Environment Notes
- **Category**: Standard
- **Entity**: environment
- **Type**: string
- **Required**: no (defaults to `""`)
- **Description**: Free-form context for this specific site. Use for "anything else worth remembering" — vendor relationships at this DC, age of the building, lease terms, etc.
- **Authored at**: Tab 1 §6 env detail panel, "Notes" input
- **Displayed at**: not displayed elsewhere; available for skill consumption
- **Sample value**: `"Lease renews Q2 2027. Powered by Iberdrola, 100% renewable certificate."`
- **Relationships**: none
- **Notes**: Authored input, no downstream view consumes it today. Skills are the primary consumer.
- **UI trace ref**: §6 Tab 1

## §1.5 · Instance (9 paths)

### `instance.label`
- **Label**: Instance Name
- **Category**: Standard
- **Entity**: instance (collection — both states)
- **Type**: string
- **Required**: yes (≥1 character)
- **Description**: The display name of the instance / asset / workload (e.g. "Oracle Database Production", "ESXi Cluster A"). The single most-shown instance field.
- **Authored at**: Tab 2/3 §6 command palette pick (from catalog) or "+ Add new" free-text input
- **Displayed at**: Tab 2/3 matrix tiles, Tab 4 linked-instance rows, Tab 5 Heatmap detail current/desired lists
- **Sample value**: `"Oracle Production DB"`
- **Relationships**: none — leaf string
- **Notes**: Authors should use the customer's actual name for the asset, not generic terms.
- **UI trace ref**: §5 Tab 2/3

### `instance.vendor`
- **Label**: Vendor Name
- **Category**: Standard
- **Entity**: instance
- **Type**: string
- **Required**: yes (can be empty)
- **Description**: The vendor company name (e.g. "Dell", "Cisco", "NetApp", "Microsoft"). Free-text once authored; the picker offers 12 common vendors as suggestions.
- **Authored at**: Tab 2/3 §6 catalog pick or §6b vendor chooser
- **Displayed at**: Tab 2/3 matrix tile sub-title, Tab 5 vendor-mix bars + table
- **Sample value**: `"Oracle"`
- **Relationships**: none
- **Notes**: Drives the vendor-mix donut on Reporting + the Dell-mapping skill.
- **UI trace ref**: §5 + §6 Tab 2/3

### `instance.vendorGroup`
- **Label**: Vendor Group
- **Category**: Standard
- **Entity**: instance
- **Type**: enum
- **Allowed values**: `dell`, `nonDell`, `custom`
- **Required**: yes
- **Description**: Three-way vendor classification driving the vendor-mix chart. `dell` if vendor is Dell, `nonDell` for any competitor, `custom` for in-house / unbranded / open-source.
- **Authored at**: Tab 2/3 §6 grouping at pick time (catalog items pre-classified)
- **Displayed at**: Tab 2/3 matrix tile color (vg-* CSS class), Tab 5 vendor-mix segments
- **Sample value**: `"nonDell"`
- **Relationships**: none — enum scalar
- **Notes**: Used for Dell-density % calculation and Reporting's headline vendor-mix bar.
- **UI trace ref**: §5 + §6 Tab 2/3

### `instance.layerLabel`
- **Label**: Layer
- **Category**: Standard
- **Entity**: instance (label-resolved)
- **Type**: derived string (catalog-joined)
- **Required**: yes
- **Description**: The human-readable name of the architectural layer this instance lives at — "Compute", "Storage", "Data Protection & Recovery", etc. Looked up from the `LAYERS` catalog via `instance.layerId`.
- **Authored at**: not directly — set by the cell row when adding the instance (Tab 2/3 §4 grid)
- **Displayed at**: Tab 2/3 matrix row header, Tab 4 link-row sub-line, Tab 5 Heatmap row header
- **Sample value**: `"Compute"`
- **Relationships**: derived from `instance.layerId` → `LAYERS.byId[<id>].label`
- **Notes**: 6 possible values; the workload layer is the apex, the other 5 are the assets a workload depends on.
- **UI trace ref**: §4 + §5 Tab 2/3

### `instance.environmentName`
- **Label**: Environment
- **Category**: Standard
- **Entity**: instance (label-resolved)
- **Type**: derived string
- **Required**: yes
- **Description**: The human-readable name of the environment this instance lives in. Resolves to the environment's alias if set, else its catalog label.
- **Authored at**: not directly — set by the cell column when adding the instance
- **Displayed at**: Tab 2/3 matrix column header, Tab 4 link-row sub-line, Tab 5 Heatmap column header
- **Sample value**: `"Primary Data Center"`
- **Relationships**: derived from `instance.environmentId` → `engagement.environments.byId[<id>].alias || ENV_CATALOG.byId[<envCatalogId>].label`
- **Notes**: An instance lives in exactly one environment (cross-cutting links are handled via `mappedAssetIds[]`).
- **UI trace ref**: §4 + §5 Tab 2/3

### `instance.criticality`
- **Label**: Instance Criticality
- **Category**: Standard
- **Entity**: instance
- **Type**: enum
- **Allowed values**: `High`, `Medium`, `Low`
- **Required**: yes (default `Low` when empty)
- **Description**: **How business-critical this specific asset/workload is.** "If this goes down, how bad is that?" — the criticality LEVEL of THIS asset, not a rank across the estate. Multiple instances can be High.
- **Authored at**: Tab 2 §7 detail panel, "Criticality" dropdown (current-state only)
- **Displayed at**: Tab 2/3 matrix tile criticality shape, Tab 5 Heatmap detail "Current technologies" list
- **Sample value**: `"High"`
- **Relationships**: none — enum scalar
- **Notes**: **CRITICAL semantic distinction.** Same level-not-rank framing as `driver.priority`. On a desired-state tile, criticality is carried from the originating current tile via `originId`.
- **UI trace ref**: §7 Tab 2

### `instance.dispositionLabel`
- **Label**: Disposition (Action)
- **Category**: Standard
- **Entity**: instance (label-resolved, desired-state only)
- **Type**: derived string (catalog-joined)
- **Required**: only on desired-state instances
- **Description**: The human-readable name of what we propose to DO with this instance — "Keep", "Enhance", "Replace", "Consolidate", "Retire", "Introduce", "Operational / Services". Only set on desired-state instances. Looked up from the `DISPOSITION_ACTIONS` catalog.
- **Authored at**: Tab 3 §8 disposition picker grid (7 catalog cards) or Tab 3 §9 detail panel "Action" dropdown
- **Displayed at**: Tab 3 matrix tile disposition badge, Tab 5 Heatmap detail "Desired state" list
- **Sample value**: `"Replace"`
- **Relationships**: derived from `instance.disposition` → `DISPOSITION_ACTIONS.byId[<id>].label`
- **Notes**: Always `null` on current-state instances. Setting a disposition auto-drafts a gap (see Tab 3 §8 / Tab 4 §5).
- **UI trace ref**: §8 + §9 Tab 3

### `instance.priority`
- **Label**: Phase (Now/Next/Later)
- **Category**: Standard
- **Entity**: instance (desired-state only)
- **Type**: enum
- **Allowed values**: `Now`, `Next`, `Later`
- **Required**: only on desired-state instances
- **Description**: **When in the roadmap this desired item should land.** Phase-of-life, not criticality. Now = 0–12 months, Next = 12–24, Later = > 24. This is one of the few "priority" fields in the schema that IS ordered.
- **Authored at**: Tab 3 §9 detail panel, "Phase" dropdown (hidden when disposition is "keep")
- **Displayed at**: Tab 3 matrix tile priority badge (when no disposition set), Tab 5 Heatmap detail
- **Sample value**: `"Now"`
- **Relationships**: none — enum scalar
- **Notes**: **CRITICAL semantic distinction.** Despite being called `priority`, this is a phase-ordering (Now > Next > Later). Drives the Roadmap columns and the linked gap's phase.
- **UI trace ref**: §9 Tab 3

### `instance.notes`
- **Label**: Instance Notes
- **Category**: Standard
- **Entity**: instance
- **Type**: string
- **Required**: no (defaults to `""`)
- **Description**: Free-text notes about this asset. On current-state: pain points, version, end-of-life dates, technical debt. On desired-state: outcome, requirements, constraints.
- **Authored at**: Tab 2 §7 / Tab 3 §9 detail panel, "Notes" textarea
- **Displayed at**: Tab 5 Heatmap detail row notes
- **Sample value**: `"EOL Q4 2026. Performance complaints from finance team."`
- **Relationships**: none — free text
- **Notes**: Different placeholder hint per state — UI cues authors toward different content for current vs desired.
- **UI trace ref**: §7 Tab 2, §9 Tab 3

## §1.6 · Gap (11 paths)

### `gap.description`
- **Label**: Gap Description
- **Category**: Standard
- **Entity**: gap (collection)
- **Type**: string
- **Required**: yes (≥1 character)
- **Description**: Free-text one-line description of the gap or initiative (e.g. "Replace EOL Oracle DB with PowerStore-backed PostgreSQL"). The primary user-facing gap content shown on every kanban card and report.
- **Authored at**: Tab 4 §8e detail textarea (edit) OR Tab 4 §10 add-dialog (create) OR auto-drafted from a disposition apply on Tab 3 §8
- **Displayed at**: Tab 4 kanban card title, Tab 5 Reporting Gaps board card, Tab 5 Roadmap project name (derived)
- **Sample value**: `"Replace EOL Oracle DB with PowerStore-backed PostgreSQL on Primary DC"`
- **Relationships**: none — free text
- **Notes**: Auto-drafted gaps come pre-populated with a structured description; the author can edit it freely.
- **UI trace ref**: §7 + §8 Tab 4

### `gap.urgency`
- **Label**: Gap Urgency
- **Category**: Standard
- **Entity**: gap
- **Type**: enum
- **Allowed values**: `High`, `Medium`, `Low`
- **Required**: yes
- **Description**: **How urgent this gap is to address.** Pain/business-risk LEVEL — same level-not-rank framing as `driver.priority` and `instance.criticality`. By default derived from the linked current instance's criticality; user can pin manually via the 🔒 lock button.
- **Authored at**: Tab 4 §8e urgency group — read-only display + 🔒 lock to pin OR editable selector + ↺ auto to release
- **Displayed at**: Tab 4 kanban card urgency badge + criticality shape, Tab 5 Reporting Gaps board, every chat narrative
- **Sample value**: `"High"`
- **Relationships**: derived from `gap.relatedCurrentInstanceIds[0].criticality` unless `gap.urgencyOverride=true`
- **Notes**: **CRITICAL semantic distinction.** Level, not rank. The "derived from linked current's criticality" relationship is why every gap card has a tooltip explaining the source.
- **UI trace ref**: §7 + §8 Tab 4

### `gap.phase`
- **Label**: Gap Phase
- **Category**: Standard
- **Entity**: gap
- **Type**: enum
- **Allowed values**: `now`, `next`, `later`
- **Required**: yes
- **Description**: **When in the roadmap this gap should be addressed.** Phase-of-life ordering (Now → Next → Later). Drives the kanban column placement and the Roadmap project bucket.
- **Authored at**: Tab 4 §6 drag-drop between kanban columns OR Tab 4 §8e dropdown OR Tab 4 §10 add-dialog
- **Displayed at**: Tab 4 kanban column, Tab 5 Reporting pipeline + Roadmap
- **Sample value**: `"now"`
- **Relationships**: bidirectional sync with linked desired instance's `priority` field
- **Notes**: Despite being called `phase`, this is the gap's equivalent of `instance.priority` (Now/Next/Later phase-ordering). Lowercase in storage; UI shows "Now (0–12 months)" etc.
- **UI trace ref**: §6 + §8 Tab 4

### `gap.status`
- **Label**: Gap Status
- **Category**: Standard
- **Entity**: gap
- **Type**: enum
- **Allowed values**: `open`, `in_progress`, `closed`, `deferred`
- **Required**: yes (default `open`)
- **Description**: Workflow state of the gap itself. `open` = needs work, `in_progress` = under way, `closed` = done (or no longer relevant), `deferred` = parked.
- **Authored at**: Tab 4 §8e status dropdown OR Tab 4 §8d Reopen button (when closed)
- **Displayed at**: Tab 4 kanban card status badge (closed only), filter toggle count
- **Sample value**: `"open"`
- **Relationships**: none — enum scalar
- **Notes**: A gap auto-closes when its linked desired tile's disposition flips to "keep" (handled by `commitSyncGapFromDesired`).
- **UI trace ref**: §8 Tab 4

### `gap.gapTypeLabel`
- **Label**: Gap Type (Action)
- **Category**: Standard
- **Entity**: gap (label-resolved)
- **Type**: derived string (catalog-joined)
- **Required**: yes
- **Description**: The human-readable name of the gap's action category — "Replace", "Enhance", "Consolidate", "Introduce", "Operational". Looked up from the `GAP_TYPES` catalog.
- **Authored at**: Tab 4 §8e dropdown (manual-add gaps) or auto-derived from the source disposition (auto-drafted gaps)
- **Displayed at**: Tab 4 kanban card meta line, Tab 5 Reporting Gaps board
- **Sample value**: `"Replace"`
- **Relationships**: derived from `gap.gapType` → `GAP_TYPES.byId[<id>].label`
- **Notes**: Auto-drafted gaps lock this field (read-only); change the source disposition in Tab 3 to change the gap type.
- **UI trace ref**: §7 + §8 Tab 4

### `gap.layerLabel`
- **Label**: Primary Layer
- **Category**: Standard
- **Entity**: gap (label-resolved)
- **Type**: derived string (catalog-joined)
- **Required**: yes
- **Description**: The human-readable name of the gap's primary architectural layer. The "project bucket" the gap belongs to. Looked up from the `LAYERS` catalog.
- **Authored at**: Tab 4 §8e "Primary layer (drives the project bucket)" dropdown OR Tab 4 §10 add-dialog
- **Displayed at**: Tab 4 kanban card meta line, Tab 5 Reporting Gaps board, Tab 5 Roadmap project name
- **Sample value**: `"Compute"`
- **Relationships**: derived from `gap.layerId` → `LAYERS.byId[<id>].label`
- **Notes**: G6 invariant: `gap.affectedLayers[0]` MUST equal `gap.layerId`. Multi-layer gaps list other affected layers in `gap.affectedLayers[1..]`.
- **UI trace ref**: §7 + §8 Tab 4

### `gap.driverName`
- **Label**: Strategic Driver
- **Category**: Standard
- **Entity**: gap (label-resolved, multi-hop)
- **Type**: derived string (catalog-joined, 2-hop)
- **Required**: no
- **Description**: The human-readable name of the strategic driver this gap serves (the "why"). Multi-hop catalog lookup: `gap.driverId` → `engagement.drivers.byId[<id>].businessDriverId` → `BUSINESS_DRIVERS.byId[<bid>].label`. When `gap.driverId` is null, an auto-suggested driver may be derived from the linked instances (see also the auto-suggest chip in Tab 4 §8e).
- **Authored at**: Tab 4 §8e Strategic driver dropdown OR Tab 4 §8e "Pin this driver" button on the auto-suggest chip
- **Displayed at**: Tab 4 kanban card ★/☆ chip, Tab 5 Roadmap swimlane assignment
- **Sample value**: `"Modernize Aging Infrastructure"`
- **Relationships**: multi-hop, see description
- **Notes**: ★ prefix = manually confirmed (driverId set explicitly); ☆ prefix = auto-suggested (driverId null, derived).
- **UI trace ref**: §7 + §8 Tab 4

### `gap.notes`
- **Label**: Gap Notes
- **Category**: Standard
- **Entity**: gap
- **Type**: string
- **Required**: no (defaults to `""`)
- **Description**: Free-text business context for the gap — risk, regulatory drivers, assumptions, customer pain, key stakeholders.
- **Authored at**: Tab 4 §8e "Notes / business context" textarea
- **Displayed at**: Tab 5 Reporting Gaps board detail
- **Sample value**: `"Performance complaints. CIO sponsored. PowerStore POC in flight Q1 2027."`
- **Relationships**: none — free text
- **Notes**: AL7 invariant: Ops-typed gaps with zero linked instances must have at least 10 characters of notes (otherwise the gap is an empty placeholder).
- **UI trace ref**: §8 Tab 4

### `gap.affectedEnvironmentNames`
- **Label**: Affected Environments
- **Category**: Standard
- **Entity**: gap (label-resolved array)
- **Type**: derived array<string>
- **Required**: yes (≥1)
- **Description**: The human-readable names of all environments this gap touches (cross-cutting — a gap that spans Primary DC + DR is ONE gap, not two). Each entry resolved via the environments collection.
- **Authored at**: Tab 4 §8e multi-checkbox row, one checkbox per visible env
- **Displayed at**: Tab 4 kanban card meta line, Tab 5 Reporting Gaps board detail "Affected layers", Tab 5 Roadmap "Also affects" chips
- **Sample value (joined)**: `"Primary Data Center\nDisaster Recovery Site"`
- **Relationships**: derived from `gap.affectedEnvironments[]` → `engagement.environments.byId[<id>].alias || ENV_CATALOG.byId[<envCatalogId>].label`
- **Notes**: Returns a newline-joined list for narrative use. For programmatic enumeration, use the underlying `gap.affectedEnvironments[]` (Advanced).
- **UI trace ref**: §8 Tab 4

### `gap.affectedLayerLabels`
- **Label**: Affected Layers
- **Category**: Standard
- **Entity**: gap (label-resolved array)
- **Type**: derived array<string>
- **Required**: yes (≥1; primary at index 0)
- **Description**: The human-readable names of all architectural layers this gap touches. First entry is always the primary layer (G6 invariant); additional entries are spillover layers (a "replace storage" gap might also touch virtualization).
- **Authored at**: Tab 4 §8e "Also affects" chips row
- **Displayed at**: Tab 5 Reporting Gaps board detail "Affected layers"
- **Sample value (joined)**: `"Compute\nVirtualization"`
- **Relationships**: derived from `gap.affectedLayers[]` → `LAYERS.byId[<id>].label`
- **Notes**: G6 invariant enforced: index 0 == primary layer.
- **UI trace ref**: §8 Tab 4

### `gap.servicesLabels`
- **Label**: Services Needed
- **Category**: Standard
- **Entity**: gap (label-resolved array)
- **Type**: derived array<string>
- **Required**: no (defaults to `[]`)
- **Description**: The human-readable names of Dell services scoped to address this gap — e.g. "Assessment", "Migration", "Operate", "Decommissioning". Each entry resolved from the `SERVICE_TYPES` catalog.
- **Authored at**: Tab 4 §8e Services group — picked + suggested + add-picker chip surfaces
- **Displayed at**: Tab 5 Reporting Gaps board "Services needed", Tab 5 Roadmap project card services row
- **Sample value (joined)**: `"Assessment\nMigration"`
- **Relationships**: derived from `gap.services[]` → `SERVICE_TYPES.byId[<id>].label`
- **Notes**: ★ marks suggested services for the current gapType; authors can pick from anywhere in the catalog.
- **UI trace ref**: §8 Tab 4

---

# Category 2 · Insights data points (15 paths)

Derived values computed by §S5 selectors. Not stored in the engagement; recomputed every render. These are what Tab 5 Reporting shows and what an account-plan-style skill should reference for the "big picture" narrative.

## §2.1 · Coverage / Risk

### `insights.coverage.percent`
- **Label**: Discovery Coverage %
- **Category**: Insights
- **Entity**: insights (derived)
- **Type**: number (0–100)
- **Description**: How complete the discovery is. Approximately: "what fraction of (current × desired × gaps × drivers × envs) is populated."
- **Source**: `roadmapService.computeDiscoveryCoverage(session).percent`
- **Displayed at**: Tab 5 Overview §5.A.4 big number + bar fill
- **Sample value**: `78`
- **Notes**: Authors targeting "Give me an account plan" should reference this to caveat the plan's completeness.

### `insights.coverage.actions`
- **Label**: Coverage Suggestions
- **Category**: Insights
- **Type**: array<string>
- **Description**: List of "what to fill in next to improve coverage." Sourced from the same selector.
- **Source**: `roadmapService.computeDiscoveryCoverage(session).actions`
- **Displayed at**: Tab 5 Overview §5.A.4 hint list
- **Sample value**: `["Add criticality to 12 current tiles", "Set dispositions on 8 unreviewed currents"]`

### `insights.risk.level`
- **Label**: Risk Posture
- **Category**: Insights
- **Type**: enum<High|Medium|Low|Elevated>
- **Description**: Overall risk level the engagement reveals. Aggregates instance criticality + gap urgency.
- **Source**: `roadmapService.computeRiskPosture(session).level`
- **Displayed at**: Tab 5 Overview §5.A.4 pill
- **Sample value**: `"Elevated"`

### `insights.risk.actions`
- **Label**: Risk Mitigation Actions
- **Category**: Insights
- **Type**: array<string>
- **Description**: Concrete steps to lower the risk posture.
- **Source**: `roadmapService.computeRiskPosture(session).actions`
- **Displayed at**: Tab 5 Overview §5.A.4 hint list
- **Sample value**: `["3 High-urgency gaps in Now phase need owners", "DR site has no current tile in compute layer"]`

## §2.2 · Totals

### `insights.totals.currentInstances`
- **Label**: Total Current Instances
- **Category**: Insights
- **Type**: number
- **Description**: Count of instances with `state="current"`.
- **Source**: `healthMetrics.getHealthSummary`
- **Displayed at**: Tab 5 §5.A.5 + §5.B.2
- **Sample value**: `42`

### `insights.totals.desiredInstances`
- **Label**: Total Desired Instances
- **Category**: Insights
- **Type**: number
- **Description**: Count of instances with `state="desired"`.
- **Source**: same
- **Displayed at**: same
- **Sample value**: `38`

### `insights.totals.gaps`
- **Label**: Total Gaps
- **Category**: Insights
- **Type**: number
- **Description**: Total gaps count across all statuses.
- **Source**: same
- **Displayed at**: same
- **Sample value**: `17`

### `insights.totals.highUrgencyGaps`
- **Label**: High-Urgency Gaps
- **Category**: Insights
- **Type**: number
- **Description**: Count of gaps where `urgency="High"`.
- **Source**: same
- **Displayed at**: Tab 5 §5.A.5 stat chip (chip-danger when >0)
- **Sample value**: `5`

### `insights.totals.unreviewedGaps`
- **Label**: Unreviewed Gaps
- **Category**: Insights
- **Type**: number
- **Description**: Count of gaps with `reviewed=false` AND `status="open"`. These are the auto-drafted gaps still waiting for the presales engineer to approve.
- **Source**: gap-walk filter (inline in Roadmap pulse bar)
- **Displayed at**: Tab 5 Roadmap §5.E.4 pulse bar
- **Sample value**: `3`

## §2.3 · Vendor mix

### `insights.dellDensity.percent`
- **Label**: Dell Density %
- **Category**: Insights
- **Type**: number (0–100)
- **Description**: Dell instance count divided by total instance count, expressed as a percentage. The headline vendor-mix KPI.
- **Source**: `vendorMixService.computeMixByLayer`
- **Displayed at**: Tab 5 Vendor §5.D.4 KPI tile
- **Sample value**: `34`

### `insights.dellDensity.byLayer`
- **Label**: Dell Density by Layer
- **Category**: Insights
- **Type**: object<layerId → number>
- **Description**: Per-layer Dell density % — useful for "which layer is most/least Dell-concentrated."
- **Source**: same
- **Displayed at**: Tab 5 Vendor headline stacked bar (when stack-by=Layer)
- **Sample value**: `{ workload: 12, compute: 48, storage: 71, dataProtection: 25, virtualization: 5, infrastructure: 33 }`

## §2.4 · Projects (auto-derived)

### `insights.projects.names`
- **Label**: Project Names
- **Category**: Insights
- **Type**: array<string>
- **Description**: All auto-derived project names from `buildProjects`. Projects bundle gaps by (envId, layerId, gapType).
- **Source**: `roadmapService.buildProjects`
- **Displayed at**: Tab 5 Roadmap §5.E.5 cards
- **Sample value**: `["Replace Oracle on Primary DC", "Introduce PowerStore on DR", "Consolidate vSphere on Primary DC"]`

### `insights.projects.byPhase`
- **Label**: Projects by Phase
- **Category**: Insights
- **Type**: object<phase → array<projectName>>
- **Description**: Projects grouped by their phase (Now/Next/Later). For pipeline narration: "the customer has 5 Now-phase projects."
- **Source**: same
- **Displayed at**: Tab 5 Overview §5.A.7 pipeline
- **Sample value**: `{ now: ["Replace Oracle..."], next: ["Introduce PowerStore..."], later: [] }`

### `insights.projects.byDriver`
- **Label**: Projects by Driver
- **Category**: Insights
- **Type**: object<driverName → array<projectName>>
- **Description**: Projects grouped by their strategic-driver swimlane. Plus "unassigned" for projects without a driver.
- **Source**: `programsService.groupProjectsByProgram`
- **Displayed at**: Tab 5 Roadmap §5.E.5 swimlanes
- **Sample value**: `{ "Cyber Resilience": ["Introduce immutable backups..."], "Modernize Aging Infrastructure": ["Replace Oracle..."], unassigned: [] }`

## §2.5 · Executive summary

### `insights.executiveSummary.brief`
- **Label**: Session Brief
- **Category**: Insights
- **Type**: array<{label, text}>
- **Description**: Structured one-line rollups across Coverage, Risk, top drivers, pipeline, and Dell-mapped solutions. Designed for CxO consumption.
- **Source**: `roadmapService.generateSessionBrief`
- **Displayed at**: Tab 5 Overview §5.A.8 right pane
- **Sample value**: `[{label:"Coverage", text:"78% complete (6 fields to fill)"}, {label:"Risk", text:"Elevated — 3 High-urgency gaps in Now"}, ...]`

---

# Category 3 · Advanced data points

Advanced surfaces the rest of the schema for power-user skills that need direct access to FK ids, raw timestamps (no), or less-common fields. Excluded from the picker by default; toggle to "Advanced" to expose.

**Always-excluded fields** (per `_NON_MUTABLE_FIELD_NAMES` in `core/dataContract.js`):
- `id` (every record's UUID)
- `engagementId` (FK back to meta)
- `createdAt`, `updatedAt`, `validatedAgainst` (audit)
- `schemaVersion`, `checksum`, `generatedAt` (engagement-meta plumbing)
- `catalogVersion` (data-architecture plumbing)
- `aiTag`, `aiSuggestedDellMapping`, `aiMappedDellSolutions` (provenance — read via derived `effectiveDellSolutions` instead)

**Advanced fields exposed for opt-in** (selected list — full list derived from `getAllMutableDataPoints()`):

- `customer.vertical` — raw FK id (use `customer.verticalLabel` for the label)
- `driver.businessDriverId` — raw FK id (use `driver.name` for the label)
- `driver.hint` — the catalog hint text for the driver
- `environment.envCatalogId` — raw FK id (use `environment.name`)
- `environment.kindLabel` — catalog kind label (Primary DC / DR / Edge / etc.)
- `environment.alias` — author's custom name (without fallback to catalog label)
- `environment.hidden` — soft-delete flag (advanced only)
- `instance.state` — current vs desired (advanced query filter)
- `instance.layerId`, `instance.environmentId`, `instance.disposition` — raw FK ids
- `instance.originId` — FK link from desired → current (replace-lifecycle)
- `instance.mappedAssetIds[]` — workload-only asset map
- `gap.gapType`, `gap.layerId`, `gap.driverId` — raw FK ids
- `gap.urgencyOverride` — boolean for "user pinned urgency manually"
- `gap.reviewed`, `gap.origin` — workflow + provenance metadata
- `gap.relatedCurrentInstanceIds[]`, `gap.relatedDesiredInstanceIds[]` — FK arrays
- `gap.services[]`, `gap.affectedLayers[]`, `gap.affectedEnvironments[]` — raw FK arrays (use `*Labels` for narrative)

---

# Authoring conventions for skill prompts

When writing a skill prompt that references data points, follow these rules:

1. **Use label-resolved paths in narrative output.** A skill that says "the customer is in healthcare" reads wrong. "The customer is in Healthcare" — using `customer.verticalLabel` — reads right.

2. **Refer to drivers / instances / gaps as collections, not singletons.** `driver.priority` resolves to all drivers' priorities joined by newlines. Skills should say "the customer's drivers are High-priority in: Cyber Resilience, Modernize Aging Infrastructure, AI & Data Platforms" — never "the top-priority driver is X" (the framing is wrong; see semantic distinction below).

3. **NEVER treat priority/criticality/urgency as a rank.** These are LEVELS. Don't write "rank by priority." Write "list the High-priority items" or "list the items and their priority levels."

4. **Phase IS ordered.** `gap.phase` and `instance.priority` (Now/Next/Later) are phase-of-life orderings. "Show me Now-phase gaps first" is correct.

5. **Prefer Insights for whole-engagement narrative.** A "Give me an account plan" skill should reference `insights.coverage.percent`, `insights.totals.highUrgencyGaps`, `insights.dellDensity.percent` — the things Tab 5 already computes. Skills that re-derive these from raw fields are doing the LLM's job for it.

6. **Cite the contract.** When a skill prompt is being authored, leave a comment indicating which Standard/Insights paths it consumes. This makes upgrade impact analysis cheap.

---

# Critical semantic glossary

Four field names look similar and mean different things. Lock these down:

| Field | Type | Meaning | Ordered? |
|---|---|---|---|
| `driver.priority` | High/Medium/Low | **Criticality LEVEL** of this driver to the customer | NO — multiple drivers can be High |
| `instance.criticality` | High/Medium/Low | **Criticality LEVEL** of this asset | NO — multiple assets can be High |
| `gap.urgency` | High/Medium/Low | **Urgency LEVEL** of this gap | NO — multiple gaps can be High |
| `instance.priority` | Now/Next/Later | **Phase-of-life ordering** | YES — Now > Next > Later |
| `gap.phase` | now/next/later | **Phase-of-life ordering** | YES — now > next > later |

If any future contributor (human or AI) confuses these, point them to this section.

---

# Relationships and Bindings

This section is the human-readable companion to `RELATIONSHIPS_METADATA` in `core/dataContract.js`. It catalogs every binding rule the picker right pane surfaces + that the Improve meta-skill system prompt is primed with. Skills authored against these rules produce LLM output that respects entity-anchor binding, FK-pair semantics, state-conditional applicability, cross-cutting cardinality, and the level-vs-phase semantic distinction.

## The 8 relationship categories

### 1 · Anchor binding (most important)

Each collection entity has an identifying anchor field. Skills that reference any other field on that entity MUST also pick the anchor — otherwise rows in the engagement-data table have no subject and the LLM can't compose answers.

| Entity | Anchor | Why |
|---|---|---|
| customer | `customer.name` | The most-referenced field in the workshop. Without it, "Healthcare vertical" attaches to no one. |
| driver | `driver.name` | Without driver name, "High priority" attaches to no driver. |
| environment | `environment.name` | Locations / tiers / power footprints need a site name to mean anything. |
| instance | `instance.label` | Without label, criticality / disposition / notes float free. |
| gap | `gap.description` | Without description, the gap is a row of metadata with no subject. |

### 2 · FK pair bindings (raw id ↔ label-resolved)

Most catalog FKs come in pairs: a raw FK id (for id-matching skills) and a label-resolved companion (for narrative output). The picker right pane shows the pairing with a one-click swap link. **Authors should default to the label-resolved form for narrative.**

| Raw FK id | Label-resolved | Catalog |
|---|---|---|
| `customer.vertical` | `customer.verticalLabel` | CUSTOMER_VERTICALS |
| `driver.businessDriverId` | `driver.name` | BUSINESS_DRIVERS |
| `environment.envCatalogId` | `environment.kindLabel` / `environment.name` | ENV_CATALOG |
| `instance.layerId` | `instance.layerLabel` | LAYERS |
| `instance.environmentId` | `instance.environmentName` | (engagement.environments + ENV_CATALOG) |
| `instance.disposition` | `instance.dispositionLabel` | DISPOSITION_ACTIONS |
| `gap.gapType` | `gap.gapTypeLabel` | GAP_TYPES |
| `gap.layerId` | `gap.layerLabel` | LAYERS |
| `gap.driverId` | `gap.driverName` | (engagement.drivers + BUSINESS_DRIVERS) |
| `gap.affectedEnvironments[]` | `gap.affectedEnvironmentNames` | (engagement.environments + ENV_CATALOG) |
| `gap.affectedLayers[]` | `gap.affectedLayerLabels` | LAYERS |
| `gap.services[]` | `gap.servicesLabels` | SERVICE_TYPES |

### 3 · Multi-hop joins

Some labels require walking through multiple FKs. The picker shows these as a visual FK chain diagram.

| Path | Hops |
|---|---|
| `gap.driverName` | `gap.driverId` → `engagement.drivers.byId[id].businessDriverId` → `BUSINESS_DRIVERS.byId[bid].label` (3 hops) |
| `instance.environmentName` | `instance.environmentId` → `engagement.environments.byId[id]` → `.alias || ENV_CATALOG.byId[envCatalogId].label` |
| `gap.affectedEnvironmentNames` | `gap.affectedEnvironments[]` → `engagement.environments.byId[id]` → joined labels |

### 4 · State-conditional fields

Some fields only apply on certain record states. The picker right pane shows a yellow warning chip; if the author also picks the conditioning field (`instance.state`), the engagement-data table makes the empty-cell story self-explanatory.

| Field | Condition | Behavior on the other side |
|---|---|---|
| `instance.priority` | `instance.state === "desired"` | Current-state instances have `null`. Picker auto-suggests `instance.state`. |
| `instance.disposition` / `.dispositionLabel` | `instance.state === "desired"` | Current-state instances render as `-` in the table. |
| `instance.originId` | `instance.state === "desired"` | System-set when a disposition apply creates a desired counterpart. |
| `instance.mappedAssetIds[]` | `instance.layerId === "workload"` | Other layers have empty `mappedAssetIds`. |

### 5 · Cross-cutting fields

Fields where one record spans multiple categories. Skills must NOT duplicate the record per category.

| Field | Cardinality | Meaning |
|---|---|---|
| `gap.affectedEnvironments[]` | 1 gap : N envs | A gap that touches Primary DC + DR is ONE gap. |
| `gap.affectedLayers[]` | 1 gap : N layers | G6 invariant: first entry is primary; rest are spillover. |
| `instance.mappedAssetIds[]` | 1 workload : N assets | Workload's mapped assets MAY span environments. |

### 6 · Derived / computed fields

Not stored; computed every render. Always derived, never authored.

| Path | Derivation source |
|---|---|
| `gap.urgency` (when `urgencyOverride=false`) | from `gap.relatedCurrentInstanceIds[0].criticality` |
| `gap.gapType` (when `origin="autoDraft"`) | from source `instance.disposition` |
| All `insights.*` paths | from §S5 selectors (`computeDiscoveryCoverage`, `computeRiskPosture`, `getHealthSummary`, `computeMixByLayer`, `buildProjects`, `generateSessionBrief`, `groupProjectsByProgram`) |

The Improve meta-skill prompt is primed with R6: NEVER frame derived fields as author-editable in the generated prompt.

### 7 · Provenance fields (system-set, not authored)

| Path | Source |
|---|---|
| `instance.aiTag` | Stamped by AI-mutation skill `applyMutations`; cleared on next engineer save. |
| `gap.origin` | `manual` set by Add-dialog; `autoDraft` set by disposition apply. |
| `gap.reviewed` | Workflow flag set true after presales clicks Approve. |
| `instance.originId` | System-set when a Tab 3 disposition creates a desired counterpart. |

### 8 · Ordering semantics — the locked glossary

The single most important semantic distinction in the schema. The picker right pane color-codes this: yellow for LEVEL (warning — not a rank), blue for PHASE (ordered).

| Field | Type | Values | Ordered? |
|---|---|---|---|
| `driver.priority` | level | High / Medium / Low | **NO** — criticality LEVEL. Multiple drivers can all be High. |
| `instance.criticality` | level | High / Medium / Low | **NO** — LEVEL of this asset. |
| `gap.urgency` | level | High / Medium / Low | **NO** — urgency LEVEL. |
| `instance.priority` | phase | Now / Next / Later | **YES** — phase-of-life ordering. |
| `gap.phase` | phase | now / next / later | **YES** — phase-of-life ordering. |

**Forbidden in skill prompts** (R2 of the Improve priming rules): "the top-priority driver", "rank drivers by priority", "the most-critical instance" — these all imply ordering on LEVEL fields. **Allowed**: "the High-priority drivers", "the drivers and their priority levels", "Now-phase instances".

## How RELATIONSHIPS_METADATA feeds three consumers

```
core/dataContract.js
    RELATIONSHIPS_METADATA  (the source of truth)
            │
            ├──► Skill Builder picker right pane (ui/views/SkillBuilder.js)
            │       · FK pair swap link
            │       · Multi-hop chain diagram
            │       · State-conditional warning chip
            │       · Derived-from selector citation
            │       · Cross-cutting cardinality flag
            │       · Provenance flag
            │       · MANDATORY PAIRINGS section + "Add suggested set" button
            │       · ORDERING section (level / phase / categorical / etc.)
            │
            ├──► Improve meta-skill system prompt (ui/views/SkillBuilder.js Field 5)
            │       · R1 anchor binding
            │       · R2 level vs phase
            │       · R3 state-conditional fields
            │       · R4 label vs raw FK
            │       · R5 cross-cutting cardinality
            │       · R6 derived fields
            │       · R7 multi-hop labels
            │
            └──► This document (docs/UI_DATA_KNOWLEDGE_BASE.md)
                    · Human-readable companion
                    · AI training material (chat system prompt embedding)
```

## Audit guarantees

Eight integrity tests in `diagnostics/appSpec.js` lock the catalog against drift:

- **V-FLOW-RELATIONSHIPS-INTEGRITY-1** · every `mandatoryWith` reference points to a real PICKER_METADATA path (no dangling references).
- **V-FLOW-RELATIONSHIPS-INTEGRITY-2** · every `fkPair` reference is bidirectional (A.fkPair === B → B.fkPair === A).
- **V-FLOW-RELATIONSHIPS-INTEGRITY-3** · every `stateConditional.onField` is a real path that exists in PICKER_METADATA.
- **V-FLOW-RELATIONSHIPS-INTEGRITY-4** · every Standard collection-entity path's `mandatoryWith` includes the entity's anchor field.
- **V-FLOW-RELATIONSHIPS-INTEGRITY-5** · every Insights path has `derivedFrom` set with a non-empty selector.
- **V-FLOW-RELATIONSHIPS-INTEGRITY-6** · exactly 3 paths have `ordering.kind === "level"` (driver.priority / instance.criticality / gap.urgency); exactly 2 have `ordering.kind === "phase"` (instance.priority / gap.phase).
- **V-FLOW-RELATIONSHIPS-INTEGRITY-7** · every state-conditional desired-only field in the catalog matches the schema's superRefine invariants (instance.priority + instance.disposition + instance.originId).
- **V-FLOW-RELATIONSHIPS-INTEGRITY-8** · multi-hop chains all terminate in a `result` node (no broken chains).

Plus two source-grep guards:

- **V-FLOW-RELATIONSHIPS-IMPROVE-PRIMING-1** · the Improve meta-skill system prompt contains references to R1..R7 relationship rules (sourced from RELATIONSHIPS_METADATA semantics).
- **V-FLOW-RELATIONSHIPS-RIGHT-PANE-1** · SkillBuilder.js picker right pane renders RELATIONSHIPS + MANDATORY PAIRINGS + ORDERING sections (data-rel-* attributes present).

---

# Revision log

| Revision | Date | Author | Scope |
|---|---|---|---|
| r1 | 2026-05-11 | Claude | Initial knowledge base. 34 Standard + 15 Insights paths + Advanced overview + authoring conventions + semantic glossary. Cross-referenced to UI_DATA_TRACE.md r6 (hash 4fb8b31d) and core/dataContract.js. |
| r2 | 2026-05-11 PM | Claude | Added Relationships and Bindings section (8 categories: anchor / FK pair / multi-hop / state-conditional / cross-cutting / derived / provenance / ordering). Feeds RELATIONSHIPS_METADATA in dataContract.js → picker right pane (FK chain diagram + state warning + mandatory-pairings "Add suggested set") + Improve meta-skill prompt (R1..R7 priming rules). 8 integrity tests + 2 source-grep guards in appSpec.js. |

## Hash computation rule

The hash on line 4 is FNV-1a 32-bit (8-hex), computed over the **entire file content** with the literal string `__HASH_HERE__` in place of the hash value. Matches the algorithm in `core/dataContract.js fnv1a8()` and the convention in `docs/UI_DATA_TRACE.md`.
