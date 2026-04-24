# Dell Discovery Canvas v2 — Implementation Spec

**Status**: Phases 0–15.3 + 16 + 18 + 19a/b/c/c.1/d.1/d SHIPPED. Phases 17 / 19e (v2.4.5 Foundations Refresh) / v2.5.0 / 20+ queued.
**Current tagged releases**: `v2.1.1`, `v2.1.2`, `v2.2.0` (Docker), `v2.2.1` (LAN auth), `v2.2.2` (Dell tokens), `v2.2.3` (visual depth), `v2.3.0` (Phase 18 gap-links), `v2.3.1` (Phase 16 Workload), `v2.4.0` (Phase 19a AI foundations), `v2.4.1` (Phase 19b Skill Builder), `v2.4.2` (Phase 19c Field-pointer + coercion + test-skill), `v2.4.2.1` (Phase 19c.1 Pill editor + error-message categorisation), `v2.4.3` (Phase 19d.1 Prompt guards + Refine-to-CARE + test-before-save gate), `v2.4.4` (Phase 19d Unified AI platform — responseFormat + applyPolicy + writable resolvers + undo)
**Predecessor**: v1.3 (legacy)
**Repo**: https://github.com/M-Alshamrani/dell-discovery-canvas (private)
**Discussion record**: [docs/CHANGELOG_PLAN.md](docs/CHANGELOG_PLAN.md) — see "Post-v2.1.2 · v2.2+ design review" section for items 2-10 decisions.

---

## 0 · North Star

**The Roadmap (Tab 5.5) is the crown jewel.** Everything else earns its place by making the Roadmap credible, clear, and executive-grade.

A Dell presales engineer runs a 30-45 min workshop. At the end, the customer's CxO sees a two-level Roadmap whose **Programs** ladder up to their own stated business drivers, whose **Projects** are bounded, fundable, and tied to real technology decisions, and whose **Phases** reflect realistic delivery timelines. Approval conversations become educated conversations because the data trail is visible and defensible.

---

## 1 · Design Invariants

1. **Tests are the contract.** Failing test = fix the implementation.
2. **Single source of truth.** Derive, never duplicate. Read-only fields are computed at render time.
3. **Visual language is unified.** One palette (H/M/L), one shape vocabulary, one tooltip pattern across all tabs.
4. **JSON-serialisable at all times.** AI agents must be able to read/write the session without special casing.
5. **Complexity is earned.** Start simple, add a field only when a concrete v1 need demands it.
6. **Layer discipline.** Only `interactions/` writes session state. Services are pure. Views call commands and services — never mutate directly.

---

## 2 · Data Model

### 2.1 Session

```
{
  sessionId:        "sess-{timestamp}-{random}",
  isDemo:           boolean,
  customer: {
    name:           string,
    vertical:       string,               // from CUSTOMER_VERTICALS
    segment:        string,               // legacy, retained for backward compat
    industry:       string,               // legacy, retained for backward compat
    region:         string,
    drivers: [                            // NEW — replaces primaryDriver
      { id, priority, outcomes }
    ]
  },
  sessionMeta: {
    date, presalesOwner, status, version
  },
  instances: Instance[],
  gaps:      Gap[]
}
```

**Removed vs v1.3**: `customer.primaryDriver` (string), `businessOutcomes` (string).

### 2.2 Instance

```
{
  id:              string,
  state:           "current" | "desired",
  layerId:         string,                // from LAYERS
  environmentId:   string,                // from ENVIRONMENTS
  label:           string,
  vendor:          string,
  vendorGroup:     "dell" | "nonDell" | "custom",
  criticality?:    "High" | "Medium" | "Low",  // current only — default "Low"
  priority?:       "Now" | "Next" | "Later",   // desired only (UI label "Phase")
  timeline?:       string,                // LEGACY — dropped from UI, ignored on re-save
  notes?:          string,
  originId?:       string,                // for mirrored desired instances
  disposition?:    "keep" | "enhance" | "replace" | "consolidate" | "retire" | "ops" | "introduce"
}
```

**Validation** (unchanged): hard-blocks on `id`, `state`, `layerId`, `environmentId`, `label`.

### 2.3 Gap

```
{
  id:                        string,
  description:               string,
  layerId:                   string,
  affectedLayers:            string[],
  affectedEnvironments:      string[],
  gapType?:                  "rationalize" | "enhance" | "replace" | "introduce" | "consolidate" | "ops",
  urgency:                   "High" | "Medium" | "Low",   // STRICT DERIVED, never user-edited
  phase:                     "now" | "next" | "later",    // BIDIRECTIONAL SYNC with linked desired instance
  mappedDellSolutions:       string,                      // DEPRECATED v2.1 — retained in JSON for legacy
                                                          //   compat + AI reads; UI no longer edits. Effective
                                                          //   solutions derived render-time from linked Dell tiles.
  notes:                     string,
  status:                    "open" | "in_progress" | "closed" | "deferred",
  relatedCurrentInstanceIds: string[],
  relatedDesiredInstanceIds: string[],
  driverId?:                 string | null,               // Optional strategic-driver assignment (Tab 4 override)
  reviewed?:                 boolean                      // v2.1 — false on auto-drafted, true on manual create
                                                          //   or any substantive edit. Drives Tab 4 "Needs review" filter.
}
```

**Derivation rules**:
- `urgency` = `relatedCurrentInstanceIds[0]`'s `criticality` if present, else `"Medium"` (for `introduce` gaps without origin). **Never set manually.**
- `phase` = synced from the linked desired instance's `priority` at mutation time.
- `gapType` = `ACTION_TO_GAP_TYPE[disposition]` for auto-drafted gaps; settable once at creation for manual gaps, then locked.

### 2.4 Driver catalog entry (config-level, not per-session)

```
{
  id:                   string,       // canonical, stable, lowercase snake_case
  label:                string,       // display name
  shortHint:            string,       // one-line plain English
  conversationStarter:  string        // coaching prompt on right panel
}
```

### 2.5 Legacy session migration (on load, before first save)

1. If `customer.primaryDriver` exists and `customer.drivers` is missing:
   - Map primaryDriver label → closest canonical driver id (see §3.2).
   - Create `customer.drivers = [{ id, priority: "High", outcomes: session.businessOutcomes || "" }]`.
   - Delete `customer.primaryDriver` and `customer.businessOutcomes`.
2. If `instances[*].timeline` exists, preserve on read; drop on next save (don't actively rewrite).
3. If `gaps[*]` has no `driverId`, leave unset (computed fallback via `suggestDriverId` at render time).
4. If a session has no `industry` or `segment` keys in `customer`, add them as empty strings on next save (appSpec.js Suite 05 test contract).
5. Existing instances with no criticality: leave as-is (no retroactive rewrite). New current instances default to `"Low"`.
6. **v2.1**: If `gaps[*]` has no `reviewed` field:
   - Auto-drafted gap (has `relatedDesiredInstanceIds` non-empty AND empty `notes`) → `reviewed: false`.
   - All other gaps → `reviewed: true`.
   - Only set on first load; any subsequent edits normal-write per §6.2.

---

## 3 · Configuration (`core/config.js`)

### 3.1 Customer verticals (alphabetised)

```
Education, Energy, Enterprise, Financial Services,
Government & Security, Healthcare, Public Sector,
SMB, Telecommunications, Utilities
```

### 3.2 Business drivers — canonical catalog (8 entries)

| id | label | shortHint |
|---|---|---|
| `ai_data` | AI & Data Platforms | "We need to get real value from AI and our data, fast." |
| `cyber_resilience` | Cyber Resilience | "We must recover from attacks without paying, and prove it." |
| `cost_optimization` | Cost Optimization | "Cut infrastructure spend without breaking delivery." |
| `cloud_strategy` | Cloud Strategy | "Right workload, right place — stop cloud bills spiralling." |
| `modernize_infra` | Modernize Aging Infrastructure | "Too much of our estate is old and fragile." |
| `ops_simplicity` | Operational Simplicity | "The team is firefighting; we want fewer tools and less toil." |
| `compliance_sovereignty` | Compliance & Sovereignty | "Auditors and regulators are getting strict; we must be ready." |
| `sustainability` | Sustainability / ESG | "Leadership is committed to measurable energy / carbon targets." |

Conversation starters: see [docs/CHANGELOG_PLAN.md § Tab 1 Draft conversation starters](docs/CHANGELOG_PLAN.md).

Legacy-label → id mapping (for migration):
- "Cost Reduction / TCO" → `cost_optimization`
- "Resilience & Security" → `cyber_resilience`
- "Cloud Migration / Repatriation" → `cloud_strategy`
- "AI / Analytics Enablement" → `ai_data`
- "Infrastructure Modernization" → `modernize_infra`
- "M&A Integration" → `modernize_infra` (closest)
- "Compliance & Governance" → `compliance_sovereignty`
- "Operational Efficiency" → `ops_simplicity`

### 3.3 Layers / Environments

Unchanged from v1.3.

### 3.4 Catalog (`CATALOG[layerId]`)

- Each entry: `{ label, vendor, vendorGroup, environments? }`.
- `environments?` optional whitelist array; absent = valid everywhere.
- **On-prem entries** (PowerEdge, Unity XT, PowerStore, VxRail, Cisco Nexus/Catalyst, SmartFabric, etc.) → `environments: ["coreDc","drDc","edge"]`.
- **Public-cloud entries** (add new): AWS EC2, Azure Virtual Machines, GCP Compute Engine, AWS Outposts; AWS EBS, Azure Blob, Azure Files, GCS; Azure Backup, AWS S3 Glacier, Druva, Commvault Cloud; VMware Cloud on AWS, Azure VMware Solution, GCVE, AWS ECS/EKS, Azure AKS, GKE; Cloudflare, AWS Direct Connect, Azure ExpressRoute, AWS IAM, AWS CloudWatch, Azure Monitor, GCP Cloud Logging. All tagged `environments: ["publicCloud"]`.
- **Universal entries** (Veeam, CrowdStrike, ServiceNow, etc.) → leave `environments` off.

---

## 4 · Visual Language

### 4.1 Severity palette (CSS custom properties on `:root`)

```
--crit-high:       #d93025   // red
--crit-medium:     #f59e0b   // amber
--crit-low:        #16a34a   // green
--crit-neutral:    #9ca3af   // grey (No data / not applicable)
```

WCAG AA against white for all three. Dell brand team can override in one place.

### 4.2 Shape language

Dual-channel (colour + shape) for accessibility. Rendered as a CSS pseudo-element with a Unicode glyph:

| Severity | Glyph | Class |
|---|---|---|
| High | ▲ | `.shape-high` |
| Medium | ● | `.shape-medium` |
| Low | ○ | `.shape-low` |

### 4.3 Tile accent

On any tile or card inheriting severity:
- **Left border** 4px solid using the matching `--crit-*` var.
- **Shape glyph** in the top-right via `.shape-*` class.
- Tooltip on the shape reveals severity reason (*"High — derived from linked current instance 'Unity XT' criticality."*).

### 4.4 Tooltip pattern

Any derived / locked field gets a `title` attribute tooltip that explains **why** it shows this value and **how** (if anywhere) to change it. Keeps the UI discoverable without adding explainer UI.

### 4.5 Badges

- Urgency / criticality: colour + shape (see 4.2).
- Phase: pill with label — "Now · 0-12 mo", "Next · 12-24 mo", "Later · >24 mo".
- Status: pill — grey/blue/green/amber tones — text-only, low visual weight.
- Gap type: pill — uppercase micro-text.
- **v2.1 Review marker**: a pulsing small dot in the top-right corner of any `.gap-card` where `reviewed === false`. Tooltip: *"Auto-drafted — review and approve in the detail panel."*

### 4.6 Icon system (v2.1)

Single `ui/icons.js` module exporting inline-SVG helpers. All icons are 14-16px, outline style, `currentColor` stroke so they inherit button text colour.

- `chainIcon()` — two interlocked links, used beside the "Manage links" label.
- `chevronIcon(open: boolean)` — 180°-rotatable; pairs with chainIcon to signal open/closed.
- `helpIcon()` — outline circle with "?" inside; placed in every main card's top-right for Help modal.
- `starSolid()` / `starOutline()` — used in gap-card strategic-driver badge (solid = manually confirmed, outline = auto-suggested).

Accessibility: every icon-only button has `aria-label`; expand/collapse controls add `aria-expanded`.

---

## 5 · Services (`services/`)

### 5.1 Preserved (may see minor updates)

- `healthMetrics.js` — bucket scoring. **No formula change.** Ensure it reads `urgency` which is now strictly derived.
- `gapsService.js` — unchanged.
- `vendorMixService.js` — unchanged.
- `roadmapService.js` — **restructured** to produce Programs + Projects hierarchy (§7.5.5). The health-score and exec-summary functions stay as sub-concerns of this module.

### 5.2 New

- **`programsService.js`**:
  - `suggestDriverId(gap, session) → string | null` — pure deterministic mapping. v2.1: rule 2 ("cyber" keyword match on mappedDellSolutions) re-grounds on linked-tile labels joined with description/notes.
  - `groupProjectsByProgram(projects, session) → { [driverId]: Project[], "unassigned": Project[] }`.
  - **v2.1** `effectiveDellSolutions(gap, session) → string[]` — derive the Dell-solution list from linked desired tiles with `vendorGroup === "dell"`, deduped.
- **`buildGapFromDisposition` extension** (in `interactions/desiredStateSync.js`):
  - Set `urgency` from linked current's criticality (or "Medium" for `introduce`).
  - Set `phase` from desired's priority at creation time.
  - Do **not** set `driverId` here — leave null; renderer calls `suggestDriverId` at read time.
  - **v2.1** — sets `reviewed: false` so auto-drafted gaps are flagged for review.
- **v2.1 health-score rework (roadmapService.js)**:
  - `computeAccountHealthScore` retained for back-compat but no longer drives Overview UI.
  - `computeDiscoveryCoverage(session) → { percent, actions: string[] }` — 4-term weighted coverage (disposition-complete, reviewed, driver-assigned, drivers-present) per CHANGELOG_PLAN § v2.1 Item 7a.
  - `computeRiskPosture(session) → { level: "Stable"|"Moderate"|"Elevated"|"High", colour, actions: string[] }` — heatmap-derived label with first-match rule ladder per Item 7b.
  - Both pure, JSON-serialisable, snapshot-accepting.

#### 5.2.1 `suggestDriverId` — v1 rule table

Evaluation is first-match; rules ordered from specific to general. Pure function, no side effects.

| # | Match (gap) | Driver |
|---|---|---|
| 1 | `layerId === "dataProtection"` | `cyber_resilience` |
| 2 | `mappedDellSolutions.toLowerCase().includes("cyber")` | `cyber_resilience` |
| 3 | `gapType === "ops"` | `ops_simplicity` |
| 4 | `affectedEnvironments.includes("publicCloud")` OR linked instances in publicCloud | `cloud_strategy` |
| 5 | `gapType === "consolidate"` | `cost_optimization` |
| 6 | `gapType === "replace"` AND `layerId in ("compute","storage","virtualization")` | `modernize_infra` |
| 7 | `gapType === "introduce"` AND `layerId === "infrastructure"` AND label matches `/ai|ml|gpu/i` | `ai_data` |
| 8 | `notes.toLowerCase().includes("compliance")` OR `/audit|nis2|gdpr|hipaa|pci/i` in description/notes | `compliance_sovereignty` |
| 9 | `notes.toLowerCase().includes("energy")` OR `/carbon|sustainability|esg/i` | `sustainability` |
| 10 | default | `null` (→ Unassigned) |

**Only proposes an id if that driver is present in `session.customer.drivers[]`.** If a rule fires but the driver isn't in the session, fall through to the next rule. This prevents "ghost programs" in the Roadmap.

---

## 6 · Interactions (`interactions/`)

### 6.1 `matrixCommands.js`

- `addInstance`: if `state === "current"` and no `criticality` provided, default to `"Low"`.

### 6.2 `gapsCommands.js`

- `createGap`: v2.1 — sets `reviewed: true` for manually-created gaps (caller passes no override) so they never trigger the review dot.
- `updateGap`: v2.1 — any substantive change (description, status, driverId, phase, links, gapType, notes) sets `reviewed: true` automatically. `mappedDellSolutions` no longer counts as substantive (field is deprecated).
- `unlinkCurrentInstance`, `unlinkDesiredInstance`: keep v1.3 throw rules.
- `setGapDriverId(session, gapId, driverId | null)` — existing v2.0 command. Setting a driverId also flips `reviewed: true`.
- **v2.1 `approveGap(session, gapId)`** — explicit review approval without other edits. Sets `reviewed: true`.

### 6.3 `desiredStateSync.js`

- `ACTION_TO_GAP_TYPE`: keep v1.3 map (includes `introduce: "introduce"`).
- `buildGapFromDisposition`: populate `urgency` from linked current's criticality; populate `phase` from desired's priority; v2.1 sets `reviewed: false` on the drafted gap.
- `syncGapFromDesired(session, desiredInstanceId)` — re-derives `phase`, `gapType`, and `urgency` on the linked gap.
- `syncDesiredFromGap(session, gapId)` — called from Tab 4 drag-drop to update the linked desired instance's `priority`.
- `syncGapsFromCurrentCriticality(session, currentInstanceId)` — propagates criticality changes into linked gap urgencies.
- **v2.1 `confirmPhaseOnLink(session, gapId, desiredInstanceId)`** — called from the link picker before `linkDesiredInstance`:
  - If gap.phase maps to the same priority the desired tile already carries → return `"ok"` (no prompt needed).
  - Otherwise return `"conflict"` with the delta, so the view can show a confirmation modal.
  - If user confirms → call `linkDesiredInstance` + `syncDesiredFromGap` (gap wins).
  - If user cancels → no link, no side effects.

---

## 7 · UI Views (`ui/views/`)

### 7.1 Tab 1 · Context

**Landing**: app defaults `currentStep = "context"`.

**Layout**:
- Card: customer name, vertical (alphabetised dropdown), region, presales owner.
- **"Your drivers"** panel with `+ Add driver` button → command-palette of 8 drivers with shortHints.
- Added drivers render as tiles. Click → right panel:
  - Conversation-starter card (driver's `conversationStarter`).
  - Priority select (High / Medium / Low).
  - Business-outcomes textarea with **auto-bullet on Enter** behaviour (§7.1.1).
  - Save button (persists via `saveToLocalStorage`).
- Driver tile remove control: silent if outcomes empty; confirm if outcomes have text.

#### 7.1.1 Auto-bullet textarea component

- On first keystroke in empty textarea: prepend `"• "`.
- On `Enter`: insert `"\n• "`.
- On `Backspace` at column 2 of a line that reads `"• "`: remove the bullet.
- Value persisted as-is (bullets are part of the text).

### 7.2 Tab 2 · Current State

**No structural change** to layout. Enhancements only:
- `+ Add` palette filters by current cell's `environmentId` (§3.4).
- New current instances default criticality "Low".
- Tiles render with left-border colour + shape glyph per criticality (§4.3).
- Current-state view has no mirror tiles (enforced).
- **v2.1** — when a typed name isn't in the catalog, the palette offers three add paths:
  1. `+ Add "{name}" — Dell SKU` → `vendor: "Dell"`, `vendorGroup: "dell"`.
  2. `+ Add "{name}" — 3rd-party vendor...` → inline picker: **HPE · Cisco · NetApp · Pure · IBM · Microsoft · VMware · Nutanix · Red Hat · AWS · Azure · Google · Other (type)**. Picked vendor → `vendor: "{Vendor}"`, `vendorGroup: "nonDell"`.
  3. `+ Add "{name}" — Custom / internal` → `vendor: "Custom"`, `vendorGroup: "custom"`.
- The same three-path chooser applies in Desired State mode (§7.3).

### 7.3 Tab 3 · Desired State

- Detail panel renames "Priority" → **"Phase"** with compound labels:
  - "Now (0-12 months)"
  - "Next (12-24 months)"
  - "Later (> 24 months)"
- Drop the separate `timeline` control.
- `disposition === "keep"` → hide Phase control and show a subtle **"✓ Keep — no change planned"** summary. Keep criticality accent from origin.
- On any change to `priority` or `disposition`: call `syncGapFromDesired`.
- Defaults for net-new `introduce`: phase = "Next". Tooltip explains the default and confirms how to change it.
- Ghost/mirror tiles inherit `.mirror-tile` class (existing — satisfies Suite 19 T2.15).
- Criticality carry-through: desired tiles with `originId` inherit the origin's `.crit-*` class and shape glyph.

### 7.4 Tab 4 · Gaps

**Layout**: phase-kanban by default; view toggle to flat list.

**Filter bar** (applies to both views):
- Layer (multi)
- Environment (multi)
- Gap type (multi)
- Urgency (multi, display only)
- Status (multi, default = `open` + `in_progress`)
- **v2.1** "Needs review only" toggle — hides gaps where `reviewed === true`. (Replaces the v2.0 "Unmapped Dell solutions only" toggle.)
- Text search on description/notes

**Gap card**:
- Left border + shape per derived urgency.
- Gap-type pill (read-only).
- Description (inline-edit).
- Affected-layer + affected-environment chips (edit via popover).
- ~~Mapped Dell Solutions~~ — **v2.1: removed input.** Displayed as a derived chip via `effectiveDellSolutions()` (from linked Dell-tagged desired tiles).
- Linked-instance chips with unlink `×` (honours §6.2 throw rules).
- Strategic-driver dropdown — options: session's drivers + "Unassigned". Auto-suggested option carries a `★` prefix and "(suggested)" suffix; explicit pick removes both and flips `reviewed: true`.
- Status pill (editable).
- `auto-drafted` badge when applicable (tooltip shows origin disposition).
- **v2.1 review dot** — pulsing marker in the top-right when `reviewed === false`. Vanishes after approval or any edit.
- `…` menu: Delete, Promote-to-manual (detaches from auto-sync).

**Drag-drop**:
- Between phase columns → updates `gap.phase` AND calls `syncDesiredFromGap`.
- Within a column → visual sort only.

**Sort within column**: urgency desc, then insertion order.

**Manual gap creation (`+ New gap`)**:
- Defaults `phase: "next"`, `urgency: "Medium"` (no linked current), `status: "open"`, `driverId: null`, `reviewed: true` (manually authored → pre-approved).
- Gap type is set at creation, then read-only.

**Empty state**: "No gaps yet — start in Tab 3 by setting a disposition on a current instance."

**v2.1 Linked-technologies collapsed summary**: The detail panel's linked-instances section starts collapsed as `"{N} linked ({C} current · {D} desired) — Manage links [chain icon][chevron]"`. Expand reveals the full current/desired lists and pickers.

**v2.1 Manual link phase-conflict modal**: The `+ Link desired instance` flow computes `confirmPhaseOnLink`. If gap.phase ≠ desired.priority, a modal asks *"Linking will change '{tile}' from {currentPhase} to {gapPhase}. Proceed?"*. Approve → link + `syncDesiredFromGap`. Cancel → abort.

**v2.1 Approve-draft button**: The detail panel for an unreviewed gap surfaces a primary-colour "Approve draft" button below the status pill. Clicking flips `reviewed: true` and removes the dot without changing anything else.

### 7.5 Tab 5 · Reporting — 5 sub-tabs

#### 7.5.1 Overview
- **v2.1 two-panel health** (replaces the single health-score card):
  - **Discovery Coverage** — `.coverage-panel`. Big % with progress bar + inline bullet list naming up to 3 outstanding actions ("4 drafts to review", "1 gap unassigned"). "See details →" links to Tab 4 Needs-review filter.
  - **Risk Posture** — `.risk-panel`. Coloured label pill (Stable / Moderate / Elevated / High) + inline bullets of 1-2 actions that would lower the level. "See Heatmap →" links to sub-tab 7.5.2.
  - Palette reuses the Heatmap scale; Elevated adds orange `#ea580c`.
- Executive summary text with **"Regenerate summary"** button calling existing `generateExecutiveSummary`.
- Pipeline stats: `{now, next, later}` gap counts + status counts.
- Strategic Driver chips: session's drivers with priority badges.
- Empty state: "No gaps yet — start in Tab 3." (shown when `gaps.length === 0`).

#### 7.5.2 Heatmap
- 5 × 4 grid, bucket score per cell.
- Colour from §4.1 palette mapped by score thresholds (§CHANGELOG_PLAN T5.4).
- Shape glyph in each cell header (§4.2).
- Cell click → navigates to sub-tab 7.5.3 with layer + env filters pre-applied.

#### 7.5.3 Gaps Board (reporting)
- Read-only mirror of Tab 4 kanban. Same filter bar. No inline edits, no drag.
- Card click opens a right-panel detail view (read-only).
- Filter state independent from Tab 4.

#### 7.5.4 Vendor Mix
- Stacked bars current + desired per layer.
- Vendor table with instance counts.
- Row indicator colour reflects max criticality of that vendor's instances.

#### 7.5 · v2.1 additions across all sub-tabs

- **`?` help button** — every sub-tab's main card gets a `.help-icon` button in its top-right. Opens `HelpModal` with prose from `core/helpContent.js[subTabId]`.
- **Right-panel trim** — tips-lists and long coaching cards removed from Heatmap, Gaps Board, Vendor Mix, Roadmap right panels. Replaced by a single terse placeholder card (`"Select a cell / gap / project"`). Tab 1 driver detail keeps `.coaching-card` — session content, not help.

#### 7.5.5 Roadmap (crown jewel)

**Structure**: swimlanes (Programs) × columns (Phases). Projects at intersections.

**Computation (pure services)**:
1. `roadmapService.buildProjects(session) → Project[]`
   - For each gap: key = `(primaryEnv, layerId, gapType)`.
   - `primaryEnv` = `gap.affectedEnvironments[0]` || linked current's `environmentId` || `"coreDc"`.
   - Group by key. Each group → one Project.
   - Project props: `{ id, name, phase, urgency, gapCount, gaps[], layerIds[], envId, dellSolutions[] }`.
   - `urgency = max` of constituent `gap.urgency`.
   - `phase = mode` of constituent `gap.phase` (ties → earliest phase).
   - Name template: `"{Environment label} — {Layer label} {ActionVerb}"` (§CHANGELOG_PLAN action-verb table).
2. `programsService.groupProjectsByProgram(projects, session) → { [driverId]: Project[], "unassigned": Project[] }`
   - Each Project's `driverId` = mode of constituent gaps' effective `driverId` (explicit override > `suggestDriverId`).
   - Projects with no driver → `unassigned`.

**Render**:
- Portfolio pulse bar: total projects, phase split, **v2.1 unreviewed-gaps count** (replaces v2.0's "unmapped" count).
- For each driver in `session.customer.drivers[]` → swimlane row.
  - Swimlane header: driver label, priority chip (from Tab 1), aggregate urgency, project count, optional % mapped.
  - Swimlane cells: 3 per row (Now / Next / Later). Project cards sorted by urgency desc, then gap count desc.
- Final swimlane: "Unassigned" (subdued, collapsible).
- No edits.

**Empty state**: "No gaps yet — start in Tab 3."

---

## 8 · Test Inventory (consolidated)

Total new / modified test assertions: **~112** (v2.0 ~95 + v2.1 ~17). Existing 21 suites remain as regression guards.

| Tab / Area | Range | Count | Reference |
|---|---|---|---|
| Tab 1 | T1.1 – T1.19 | 19 | [docs/CHANGELOG_PLAN.md § Tab 1 criteria](docs/CHANGELOG_PLAN.md) |
| Tab 2 | T2.1 – T2.16 | 16 | Tab 2 criteria |
| Tab 3 | T3.1 – T3.17 | 17 | Tab 3 criteria |
| Tab 4 | T4.1 – T4.17 | 17 | Tab 4 criteria |
| Tab 5 | T5.1 – T5.27 | 27 | Tab 5 criteria (inc. Programs T5.16-T5.26) |
| v2.1 Dell-solutions derivation | T2b.1 – T2b.3 | 3 | CHANGELOG_PLAN § v2.1 · Item 2 |
| v2.1 Review flag + phase-link + vendor picker + icons + help | T6.1 – T6.17 | 17 | CHANGELOG_PLAN § v2.1 · Items 1, 3, 4, 5, 6 |
| v2.1 Coverage + Risk panels | T6.18 – T6.25 | 8 | CHANGELOG_PLAN § v2.1 · Item 7 |
| v2.1.1 Right-panel drill-downs + Session Brief + Roadmap click unify | T7.1 – T7.6 | 6 | CHANGELOG_PLAN § v2.1.1 · Phases 13 + 14 |

**Regression guards**: all 21 pre-existing suites pass unchanged; updates in Suites 11, 15, 20, 21 are expected to reflect Programs/Projects taxonomy. **T4.15 deprecated** in v2.1 (filter semantics changed).

---

## 9 · Implementation Sequence (9 phases, dependency-ordered)

Each phase is atomic: tests in scope must pass before the next phase begins.

### Phase 0 · Local Dell logo
Swap external image URL in `index.html` for local `../Logo/delltech-logo-stk-blue-rgb.avif`. Add `<link rel="icon" href="data:,">` to silence favicon 404. *Standalone; no test impact.*

### Phase 1 · Foundation — data model & config
- `core/config.js`: alphabetise `CUSTOMER_VERTICALS` + add Energy, Utilities; replace flat `BUSINESS_DRIVERS` with the 8-entry driver catalog from §3.2; tag catalog entries with `environments` arrays per §3.4; add Public Cloud catalog additions.
- `state/sessionStore.js`: migration rules from §2.5 (run on load).
- Satisfies: **T1.2, T1.3, T1.4, T1.5, T1.18, T2.1, T2.3, T2.4, T3.3**.

### Phase 2 · Visual language
- `styles.css`: define `--crit-high|medium|low|neutral`; define `.crit-high|medium|low` (left border + background accent); define `.shape-high|medium|low` pseudo-element classes; keep `.mirror-tile` and `.ghost-tile` co-classes.
- Satisfies: **T2.9, T2.10, T2.11, T2.12**.

### Phase 3 · Tab 1 Context
- `ui/views/ContextView.js`: implement drivers catalog + add/remove flow + right-panel per-driver form + auto-bullet textarea.
- `app.js`: landing step = `"context"`.
- Satisfies: **T1.1, T1.6 – T1.17, T1.19**.

### Phase 4 · Tab 2 Current State
- `interactions/matrixCommands.js`: default criticality to "Low" on current adds.
- `ui/views/MatrixView.js`: env-filter the `+ Add` palette; render criticality accent + shape per tile.
- Satisfies: **T2.2, T2.5, T2.6, T2.7, T2.8, T2.13 – T2.16**.

### Phase 5 · Tab 3 Desired State
- `interactions/desiredStateSync.js`: `syncGapFromDesired`; urgency derivation in `buildGapFromDisposition`.
- `ui/views/MatrixView.js` (desired mode): rename "Priority" → "Phase"; compound labels; hide on keep; carry-through criticality accent.
- Satisfies: **T3.1 – T3.17**.

### Phase 6 · Tab 4 Gaps
- `interactions/gapsCommands.js`: `setGapDriverId`.
- `interactions/desiredStateSync.js`: `syncDesiredFromGap`.
- `services/programsService.js`: `suggestDriverId` (§5.2.1 rule table).
- `ui/views/GapsEditView.js`: filter bar; view toggle; gap-card rewrite with program dropdown; bidirectional drag-drop; unmapped filter.
- Satisfies: **T4.1 – T4.17**.

### Phase 7 · Tab 5 Reporting
- `services/roadmapService.js`: refactor to `buildProjects`.
- `services/programsService.js`: `groupProjectsByProgram`.
- `ui/views/ReportingView.js`: regenerable exec summary + drivers chips + empty state.
- `ui/views/SummaryHealthView.js`: palette/shape updates; cell-click drill.
- `ui/views/SummaryGapsView.js`: read-only kanban mirror + independent filter state.
- `ui/views/SummaryRoadmapView.js`: swimlane × column grid; project cards; portfolio pulse bar; unassigned swimlane.
- Satisfies: **T5.1 – T5.27**.

### Phase 8 · Regression sweep
- Update `diagnostics/appSpec.js` Suites 05, 11, 15, 20, 21 to reflect the Programs/Projects taxonomy.
- All 21 pre-existing + ~95 new assertions green.

### Phase 9 · v2.1 · Drop Dell-solutions input + `reviewed` flag + "Needs review" filter + Coverage/Risk rework
- `gapsCommands.js`: auto-set `reviewed: true` on substantive `updateGap`; new `approveGap`.
- `desiredStateSync.buildGapFromDisposition`: set `reviewed: false`.
- `programsService.effectiveDellSolutions()`: new pure helper.
- `roadmapService.js`: new `computeDiscoveryCoverage()` + `computeRiskPosture()`; keep `computeAccountHealthScore()` for back-compat.
- `sessionStore.migrateLegacySession`: add v2.1 rule 6 (default `reviewed`).
- `GapsEditView.js`: remove mappedDellSolutions input; replace filter label + logic; add pulsing review dot on unreviewed cards; add "Approve draft" button.
- `SummaryRoadmapView.js` + gap cards: switch Dell-solution chip rendering to `effectiveDellSolutions`.
- `ReportingView.js`: swap the single health-score card for Coverage + Risk two-panel layout with inline actionable hints.
- Satisfies: **T2b.1-3, T6.4-9, T6.18-25**. Replaces T4.15.

### Phase 10 · v2.1 · Manual-link phase-conflict modal
- `desiredStateSync.confirmPhaseOnLink()`: new helper.
- `GapsEditView.openLinkPicker` desired branch: calls confirmPhaseOnLink; mount `<dialog>`-style confirm; on OK → `linkDesiredInstance` + `syncDesiredFromGap`.
- Satisfies: **T6.1-3**.

### Phase 11 · v2.1 · Vendor picker on custom add
- `MatrixView.openCommandPalette`: when typed name doesn't match catalog, render three `+ Add …` paths; 3rd-party quick-picker with 12 common vendors + Other.
- Satisfies: **T6.10-12**.

### Phase 12 · v2.1 · Icon system + help modal + right-panel cleanup
- `ui/icons.js`: chain, chevron, help, star-solid, star-outline SVG helpers.
- `ui/views/HelpModal.js` + `core/helpContent.js`: 10 help blurbs keyed by tab/sub-tab.
- Wire `?` icon into every main card header; "Manage links" switched to chain+chevron.
- Trim right panels in Matrix, Gaps, Reporting sub-tabs; keep Tab 1 driver-detail coaching card.
- Satisfies: **T6.13-17**.

### Phase 13 · v2.1.1 · Reporting right-panel drill-downs
- `ReportingView.js`: move Executive Summary card to the **right** column (CxO dashboard layout).
- `SummaryGapsView.js`: switch Dell-solutions display to `effectiveDellSolutions`; existing click-to-detail retained.
- `SummaryVendorView.js`: vendor-table rows clickable; right panel shows per-vendor instance breakdown (by layer, state split, list).
- `SummaryRoadmapView.js`: swimlane headers clickable → right-panel Strategic Driver detail (label, shortHint, priority, outcomes, project list, aggregate urgency, % mapped). Unassigned swimlane gets its own detail prompting driver assignment.
- Styles: `.vm-row`, `.swimlane-clickable` hover + focus states.
- Satisfies: **T7.1 · T7.2 · T7.3 · T7.4**.

### Phase 15 · v2.2.0 · Docker containerisation for Dell GB10 — IMPLEMENTED

**Goal**: shippable container for internal testing on a Dell GB10. Frontend unchanged.

**Locked decisions (2026-04-19)**:
- **OS**: Linux (Dell GB10 is ARM/Grace; nginx:alpine ships multi-arch including linux/arm64).
- **Runtime**: Docker (Dockerfile + compose are OCI-standard — Podman pivot is near-zero cost via `podman-compose`).
- **Reachability**: localhost-only by default (`BIND_ADDR=127.0.0.1`), opt-in LAN exposure via `BIND_ADDR=0.0.0.0`. LAN auth shim (nginx `auth_basic`) deferred to **Phase 15.1 / v2.2.1**.
- **Persistence**: browser localStorage only — image is stateless. Shared-DB persistence deferred to v3 (Phase 20+ multi-user platform).
- **AI endpoint location**: out of scope for Phase 15. Wired in Phase 19 via `services/aiService.js` reading endpoint URL from localStorage / settings UI.
- **Concurrency**: nginx serves static files concurrently out of the box — no app-side work needed.
- **Host port**: **8080** by default (8000/8001 reserved on the GB10 by the vLLM containers — Code LLM and VLM respectively). Override via `HOST_PORT`.

**Deliverables (shipped)**:
- `Dockerfile` — `nginx:1.27-alpine` base, explicit COPY whitelist (avoids the OneDrive brace-expansion junk folder), `HEALTHCHECK` against `/health`.
- `nginx.conf` — explicit MIME map covering `.mjs` (ESM) + `.avif` (Dell logo); cache-busts `index.html`; 5-min cache for assets; `gzip` for text payloads; security headers (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`); CSP allow-list scoped to Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) and `i.dell.com` (logo fallback) only.
- `docker-compose.yml` — single service `dell-discovery-canvas`, `restart: unless-stopped`, port mapping `${BIND_ADDR:-127.0.0.1}:${HOST_PORT:-8080}:80`.
- `.dockerignore` — excludes `.git`, `docs/`, host scripts, the brace-expansion junk folder.
- `README.md` + `HOW_TO_RUN.md` — Docker quick-start sections added; troubleshooting rows for port collisions and stale browser cache after rebuild.

**Test (manual on GB10)**:
1. `git clone … && cd dell-discovery-canvas`
2. `docker compose up -d --build`
3. `curl http://localhost:8080/health` → `ok`
4. Open `http://localhost:8080` in a browser; confirm green test banner (all 22 suites pass) inside the container's app.
5. Logo loads from `/Logo/delltech-logo-stk-blue-rgb.avif` (no fallback to i.dell.com unless local copy 404s).
6. `docker compose down` shuts cleanly.

**Out of scope, captured for v2.2.x**:
- ~~LAN gating (auth_basic)~~ → **shipped in Phase 15.1 / v2.2.1** (see below).
- Dell-styling token adoption from the GPLC sample → **Phase 15.2 / v2.2.2**.
- AI endpoint settings page → groundwork in **Phase 19 / v2.4.0**.

### Phase 15.1 · v2.2.1 · LAN gating with HTTP Basic auth — IMPLEMENTED

**Goal**: make it safe to flip `BIND_ADDR=0.0.0.0` for shared LAN review without exposing the unauth'd vLLM endpoints alongside.

**Locked decisions (2026-04-19 afternoon)**:
- **Auth scheme**: HTTP Basic via nginx `auth_basic`. Cheap, browser-native, no app code changes. Acceptable inside Dell internal networks; not a public-internet hardening.
- **Trigger**: env-var driven, not file-mounted. `AUTH_USERNAME` + `AUTH_PASSWORD` set together = auth on; either unset = auth off (backward-compatible with v2.2.0).
- **htpasswd generator**: `htpasswd` from `apache2-utils` (~200KB). Cleaner than `openssl passwd` and openssl CLI isn't preinstalled in `nginx:1.27-alpine`.
- **Hash algorithm**: apr1 (MD5) via `htpasswd -m`. Universally supported; bcrypt would need extra build steps in alpine.
- **Healthcheck exemption**: `/health` overrides with `auth_basic off;` so the container HEALTHCHECK and any external monitor can probe without creds.
- **File ownership**: htpasswd owned `nginx:nginx 0640` so workers (run as user `nginx` per upstream config) can read it; root master process writes it from the entrypoint.

**Deliverables (shipped)**:
- `docker-entrypoint.d/40-setup-auth.sh` — POSIX-sh script invoked automatically by the upstream `nginx:alpine` entrypoint chain. Reads env vars, generates `/etc/nginx/.htpasswd` and `/etc/nginx/snippets/auth.conf`. Fails the container start (exit 1) on htpasswd-write failure rather than silently serving with broken auth.
- `Dockerfile` — `apk add --no-cache apache2-utils`; COPY + chmod +x of the entrypoint script.
- `nginx.conf` — `include /etc/nginx/snippets/auth.conf;` at server scope (snippet is empty when no auth is configured); `auth_basic off;` inside `location = /health`.
- `docker-compose.yml` — declared `AUTH_USERNAME` + `AUTH_PASSWORD` env passthroughs (default empty); inline header comment warning never to set `BIND_ADDR=0.0.0.0` without auth.
- `README.md` + `HOW_TO_RUN.md` — LAN-with-auth quick-start; troubleshooting rows for the common auth misconfigurations.

**Test (manual, local)**:
1. `docker compose up -d --build` (no env vars) → `curl http://localhost:8080/` returns 200, no challenge. Backward-compatible with v2.2.0. ✓
2. `AUTH_USERNAME=u AUTH_PASSWORD=p docker compose up -d --build` → `curl /` returns 401; `curl -u u:p /` returns 200; `curl -u u:wrong /` returns 401. ✓
3. `/health` returns "ok" without creds in both modes. ✓
4. HEALTHCHECK reaches `(healthy)` within 30s in both modes. ✓
5. Browser at `http://localhost:8080` with auth on: native login prompt, then green test banner inside the app once authenticated.

### Phase 16 · v2.3.1 · Workload Mapping — 6th layer (Item 3) — IMPLEMENTED

See CHANGELOG_PLAN § v2.3.1 entry for as-shipped detail.

- `workload` added to `LAYERS` as the **first** entry (topmost layer; renders as the top row in the matrix). Label: "Workloads & Business Apps". 14 catalog entries split across 3 Dell Validated Designs (DVD-SAP HANA, DVD-AI/RAG, DVD-VDI), 4 vendor-packaged business apps (ERP, CRM, HCM, Email/Collab), 3 industry-vertical systems (EHR, Core Banking, Billing), 3 data/analytics workloads (DW/Lakehouse, BI, AI/ML), and 4 application footprints (web app, LOB, DB service, DevOps).
- `Instance` schema gains optional `mappedAssetIds: string[]`. `validateInstance` enforces that the field is **only** present on `workload`-layer instances; non-workload tiles carrying `mappedAssetIds` are rejected at validation time.
- New `interactions/matrixCommands.js` exports:
  - `mapAsset(session, workloadId, assetId)` — adds an asset id to a workload's mapping, deduped. Throws on self-map, workload→workload, cross-state (current↔desired) mapping, or unknown ids.
  - `unmapAsset(session, workloadId, assetId)` — removes the id.
  - `proposeCriticalityUpgrades(session, workloadId)` — pure (non-mutating). Returns `[{ assetId, label, layerId, currentCrit, newCrit }]` for every mapped asset whose criticality is *strictly lower* than the workload's. Empty when the workload has no criticality set, or when all mapped assets meet/exceed it. Caller applies upgrades via `updateInstance`.
- `MatrixView.js`: workload tile detail panel renders a **Mapped infrastructure** section with the current mapped-asset rows (label · layer/env · criticality chip · unmap "x"), plus `+ Map asset` (opens picker scoped to other 5 layers in the same state) and `↑ Propagate criticality` (only when the workload has a criticality and ≥1 mapped asset). Propagation walks proposals one at a time with per-asset `confirm()` — no silent bulk upgrades.
- `styles.css`: `.mapped-assets-section`, `.mapped-asset-row`, `.mapped-asset-crit.crit-{low,medium,high}`, `.propagate-btn` (Dell-blue accent).
- N-to-N cardinality: an asset can be mapped from multiple workloads; gap-link Phase 18 multi-link patterns apply orthogonally.
- Cascade: deleting a workload removes its `mappedAssetIds` array implicitly (no back-references). Deleting an asset leaves dangling ids in workloads' `mappedAssetIds` — `proposeCriticalityUpgrades` tolerates this gracefully (skips).
- Tests: `appSpec.js` Suite 24 — W1 (layer present, accepts empty mapping), W1b (rejects mappedAssetIds on non-workload), W2 (map dedups, refuses self/workload-to-workload/cross-state, unmap removes), W3 (proposes upward upgrades, opt-in apply via updateInstance), W4 (never proposes downgrades), W5 (proposeCriticalityUpgrades is pure).

### Phase 17 · v2.3 · Taxonomy unification + "Action" rename (Item 4)

See CHANGELOG_PLAN § v2.2+ Item 4 for proposed table (pending user confirm).

- `DISPOSITION_ACTIONS` → renamed `ACTION_ITEMS` (or keep key, update labels).
- UI label "Disposition" → "Action" across ContextView / MatrixView / GapsEditView / SummaryGapsView.
- Drop `rationalize` from ACTION_TO_GAP_TYPE and the gap-type enum; migrate any legacy sessions at load time (bump migration rule).
- `createGap` and `buildGapFromDisposition` enforce mandatory linking rules from the table (throw on Replace/Consolidate without required links at create-time, symmetric with existing unlink rule).
- Tests: new assertions per table row; legacy session loads without error (migration strips rationalize).

### Phase 18 · v2.3.0 · Linked assets always visible + warn-but-allow double-link + roadmap dedup — IMPLEMENTED

See CHANGELOG_PLAN § v2.2+ Items 8, 9, 10 for the design rationale, and § v2.3.0 entry for the as-shipped detail.

**As shipped**:
- `GapsEditView.js`: Phase 12's `Manage links` collapse removed. The gap detail panel renders the current + desired link sections inline inside `.linked-inline-wrap` — always visible, no toggle. Imports of `chainIcon` / `chevronIcon` removed.
- `GapsEditView.js → openLinkPicker`: before each candidate row, scans `session.gaps` for an *other* gap that already links the candidate's id. If found, prepends a yellow `.link-warning-row` reading *"⚠ {label} is already linked to Gap '{desc}'. Linking here too will count toward both initiatives."* — user can still proceed.
- `GapsEditView.js → buildLinkRow`: when a linked instance is referenced by ≥ 2 gaps in total, appends a red `.multi-linked-chip` reading *"linked to N gaps"* with a tooltip explaining that unlinking here only affects this gap.
- `services/roadmapService.js` shape unchanged; `SummaryRoadmapView.js` linked-tech count switched from `+= length` summing to a `Set` of unique instance ids — multi-linked instances now count once per project.
- `ui/icons.js`: `chainIcon` and `chevronIcon` deleted (no remaining consumers).
- `styles.css`: `.linked-summary-row` / `.linked-manage-btn` / `.linked-manage-wrap` removed; new `.linked-inline-wrap` / `.link-warning-row` / `.multi-linked-chip`.
- New `.gitattributes` enforces LF endings on `*.sh`, `Dockerfile`, `nginx.conf`, `docker-compose.yml`, `docker-entrypoint.d/**` so the Docker image always builds correctly on Windows hosts.
- `appSpec.js` Suite 23: T8.1 (no Manage-links collapse), T8.2 (warning row in picker), T8.3 (multi-linked chip), T8.4 (deleteGap leaves instances re-linkable — Item 10 regression), T8.5 (roadmap dedup invariant).
- No strict uniqueness constraint, no reverse index, no cascade logic — gap is the sole owner of its `relatedXxxInstanceIds` arrays per the locked design.

### Phase 19 · v2.4.x · AI Agent Builder — 4-slice delivery

User's vision is an admin-configured skill platform, not a hardcoded button (captured 2026-04-19 evening). Shipping in 4 waves. See CHANGELOG_PLAN § v2.4.x entries.

#### Phase 19a · v2.4.0 · AI foundations — IMPLEMENTED

Three-provider client (OpenAI-compatible vLLM / Anthropic Claude / Google Gemini) reachable from the browser via a same-origin reverse-proxy in our nginx. Settings modal behind a gear icon in the header. One hardcoded demo skill on Tab 1 (driver discovery-question assistant) to prove end-to-end wiring.

- **`core/aiConfig.js`** — per-provider config shape (`activeProvider` + `providers.{local,anthropic,gemini}.{baseUrl,model,apiKey}`), localStorage round-trip, deprecated-model auto-migration (e.g. `gemini-2.0-flash` → `gemini-2.5-flash`).
- **`services/aiService.js`** — `chatCompletion({providerKey, baseUrl, model, apiKey, messages})`; builds the correct request shape per provider (OpenAI chat-completions, Anthropic `/v1/messages` with `x-api-key` + `anthropic-version`, Gemini `:generateContent` with `key=` query); response parsing per provider; `testConnection` helper for the settings probe.
- **`ui/views/SettingsModal.js`** — gear-icon-opened modal with three provider pills (switching persists), endpoint URL / model / API key fields (public provider URLs are read-only since they're locked to the nginx proxy), and a Test-connection probe that fires "Reply OK" and surfaces the result inline.
- **Header** — new `#settingsBtn` (gear) in `.header-right` alongside the session meta. `app.js → wireSettingsBtn()` binds the click to open the modal.
- **Tab 1 demo skill** — `ContextView.renderDriverDetail` appends an `.ai-skill-card` ("✨ AI assistance") with a "Suggest discovery questions" button that calls `runDriverQuestionSkill(session, driver)` in `interactions/skillCommands.js`. Result renders in a `.ai-skill-result` card with provider label + the raw text (monospace).
- **Container plumbing** — new `docker-entrypoint.d/45-setup-llm-proxy.sh` writes `/etc/nginx/snippets/llm-proxy.conf` at container start with three `location` blocks: `/api/llm/local/` → `http://${LLM_HOST}:${LLM_LOCAL_PORT}/` (default `host.docker.internal:8000`), `/api/llm/anthropic/` → `https://api.anthropic.com/` (with SNI + resolver), `/api/llm/gemini/` → `https://generativelanguage.googleapis.com/`. `docker-compose.yml` declares `LLM_HOST` + `LLM_LOCAL_PORT` env passthroughs and maps `host.docker.internal:host-gateway` for Linux Docker.
- **Security posture** — API keys live in browser localStorage; visible in DevTools. Acceptable for personal dev; v3 multi-user platform will move keys server-side. `/api/llm/*` paths have `access_log off` to keep keys out of nginx logs.
- **Tests** — Suite 25 AI1-AI9: loadAiConfig defaults, save/load round-trip, deprecated-model migration, `isActiveProviderReady`, `buildRequest` shape per provider (OpenAI/Anthropic/Gemini), `extractText` per provider, gear-button presence, ContextView AI card render.

#### Phase 19b · v2.4.1 · Skill Builder UI — IMPLEMENTED

Turn v2.4.0 from "one hardcoded button" into a platform. Users define, deploy, and run their own skills.

- `core/skillStore.js` — localStorage-backed CRUD. Schema: `{id, name, description, tabId, systemPrompt, promptTemplate, outputMode, deployed, seed, createdAt, updatedAt}`. Seeds the Tab 1 driver-question skill on first load so fresh installs work out of the box.
- `services/skillEngine.js` — `renderTemplate({{dot.path}})` with missing-is-empty semantics; `extractBindings()` returns unique path references for the UI readout; `runSkill(skill, session, context)` composes system + user messages and routes through `aiService.chatCompletion()`.
- `interactions/skillCommands.js` — generic `runSkillById(id, session, context)` + `skillsForTab(tabId)` exports. Legacy `runDriverQuestionSkill` wrapper preserved over the seeded skill for backward-compat.
- `ui/views/SkillAdmin.js` — list view (one row per skill with deploy toggle + edit + delete), inline add/edit form with live "detected bindings" readout. Field labels intentionally user-friendly: *"AI role / instructions"* and *"Data for the AI"* rather than the technical `systemPrompt` / `promptTemplate` names.
- `ui/views/SettingsModal.js` — new top-level section row: *AI Providers* | *Skills*. `initialSection` param routes the body to the right surface.
- `ui/components/UseAiButton.js` — tab-agnostic dropdown factory. Renders `"✨ Use AI ▾"` with a menu of deployed skills for the given `tabId`. Returns an empty hidden span when no deployed skills exist (avoids empty dropdown chrome).
- `ui/views/ContextView.js` — driver detail panel now hosts `useAiButton("context")`; output card unchanged so users see the same UX as v2.4.0.
- Suite 26 — 8 new assertions (SB1-SB8) covering seed-on-first-run, CRUD round-trip, template rendering, binding extraction, per-tab filter with `onlyDeployed` opt-out, admin row render, admin empty state, and the generic dropdown on Tab 1.

#### Phase 19c · v2.4.2 · Field-pointer mechanic — QUEUED

#### Phase 19c · v2.4.2 · Field-pointer mechanic + LLM-friendly coercion + test-skill — IMPLEMENTED

- `core/fieldManifest.js` — per-tab list of bindable fields (`path` + `label` + `kind:"scalar"|"array"`). Context / Current / Desired / Gaps / Reporting all declared. All tabs share `session.customer.name`, `session.customer.vertical`, `session.customer.region`, `session.customer.drivers`, `session.instances`, `session.gaps`. `buildPreviewScope()` synthesises plausible context for the builder preview on empty sessions.
- `ui/views/SkillAdmin.js` — below the "Data for the AI" textarea:
  - **Field-chip grid** (blue scalars, amber arrays). Click inserts `Label: {{path}}` at cursor; Alt-click inserts bare `{{path}}` for templates that describe the field inline.
  - **Live preview** panel renders the template against current session + first-item fallback context; updates on every keystroke and on tab change.
  - **"Test skill now"** button dry-runs the draft (unsaved) skill against the active AI provider and shows output inline — iterate on prompts without save-and-switch.
- `services/skillEngine.js` — `coerceForLLM()` now handles non-scalar bindings: arrays/objects serialise as pretty-printed JSON (2-space indent, 1200-char soft cap). Previously `{{session.gaps}}` rendered as `"[object Object],[object Object]"`; now it's valid JSON the LLM can actually read.
- Suite 27 FP1-FP9: manifest completeness, tab-scope isolation, preview scope, chip render count, labeled insertion (default), coercion behaviour, Alt-click bare insertion, test-button render.

#### Phase 19c.1 · v2.4.2.1 · Pill-based editor + error-message polish — IMPLEMENTED

- `ui/components/PillEditor.js` — new. `createPillEditor({initialValue, manifest, onInput})` returns a DOM element with a textarea-compatible surface (`serialize()` / `setValue()` / `insertPillAtCursor(path, bare)`). Pills are `<span class="binding-pill" contenteditable="false" data-path data-label data-bare>`. Backspace/Delete at a pill boundary removes the whole pill as a unit. `parseToSegments(template, labelByPath)` + `serializeEditor(editor)` exported pure for tests.
- `ui/views/SkillAdmin.js` — edit form uses the pill editor in place of the textarea. Save/test paths use `editor.serialize()`. Tab-change no longer rebuilds the editor (stranded-label bug fix).
- `services/aiService.js` — error-message categorisation: 401/403 "auth failed — check your API key", 429 "rate-limited", 5xx "upstream temporary error — try again or switch provider". Raw response body still included but truncated at 200 chars.
- `styles.css` — `.pill-editor` (contenteditable host with placeholder pseudo), `.binding-pill.is-scalar|is-array|is-bare`.
- Suite 28 PE1-PE7: labeled-pill detection, bare-pill fallback, serialize emission, round-trip fidelity, textarea-compatible surface, DOM attribute contract, unknown-path rendering.

#### Phase 19d.1 · v2.4.3 · Prompt guards + Refine-to-CARE + test-before-save gate — IMPLEMENTED

- `core/promptGuards.js` — mode-aware output-format footers. `text-brief` live today (≤120 words, terse bullets, no preamble); `json-schema` + `action-commands` declared as stubs that throw with a version pointer. `summaryForMode()` gives the human-readable hint shown under the system-prompt field. `REFINE_META_SYSTEM` + `REFINE_META_RULES` are the CARE-framework meta-prompt sent to the AI by the Refine button.
- `services/skillEngine.js → runSkill()` — appends the footer to the user's system prompt at run time (non-removable).
- `ui/views/SkillAdmin.js` — footer-summary hint ("Plus automatic output-format guards…"), **"✨ Refine to CARE format"** button (side-by-side diff, Accept / Keep), test-before-save gate (Save button disabled until `lastTestedSignature === currentSignature()`; any edit invalidates).
- Suite 29 — 6 new PG* assertions covering footer content, mode dispatch, summary export, admin-UI render, OUTPUT_MODES triad.

#### Phase 19d · v2.4.4 · Output handling + undo + per-skill provider — QUEUED

Three user-requested items bundled (2026-04-19 evening):

- **Output handling** — parse AI response into structured proposals (free-text → typed field updates). Apply-on-confirm per proposal (default) or auto-apply (opt-in per skill). Optional streaming for long responses.
- **Undo stack** — every skill run that mutates session pushes a snapshot; a top-level "↶ Undo last AI change" button rolls back. Scoped to AI mutations; never touches manual edits.
- **Per-skill provider assignment** — each skill gets an optional `providerKey` that overrides the active provider for this skill. Lets different skills target different models (e.g., code questions on local Code LLM, synthesis on Claude). Schema migration: null = use active, otherwise specified key.

Also queued for this slice or follow-up:
- **VLM second local provider** on `:8001` — deferred until there's a skill that sends images (no current use case). When needed: extend `fieldManifest.js` for image bindings, add `/api/llm/local-vlm/` proxy, add second "Local LLM (Vision)" provider in settings.

### Phase 20+ · v3 · Multi-user platform (Item 2)

Separate architectural workstream. Out of scope for incremental v2.x phases.

Scope (from CHANGELOG_PLAN § v2.2+ Item 2):
- Backend server (Node/Express or FastAPI) with `/api/sessions`, `/api/users`, `/api/analytics`.
- Database: SQLite → PostgreSQL.
- Auth: GitHub OAuth or email+password + JWT sessions.
- RBAC: `presales`, `manager`, `director`, `admin` roles.
- Analytics: gap trends, per-presales discovery completion, global hotspots.
- AI config and container-status surfaces in-app.
- WAF via Cloudflare or NGINX+ModSecurity at ingress.

A separate `SPEC_v3.md` will capture this architecture when work starts.

---

## Legacy phase blocks below (for reference)

### Phase 14 · v2.1.1 · Session Brief + Roadmap click unification
- `services/roadmapService.js`: new `generateSessionBrief(session)` returning `[{label, text}]` structured rows (Customer · Strategic Drivers · Risk Posture · Discovery Coverage · Pipeline · Top High-Now gaps · Dell solutions mapped · Instances). `generateExecutiveSummary` rewritten to flatten brief into a string for legacy/AI callers. Legacy narrative preserved as unreachable `_legacyNarrativeSummary`.
- `ReportingView.js`: right-panel card re-titled "Session brief"; button renamed "↻ Refresh" (honest — no pretend AI). Brief renders as labelled definition list inside `.exec-summary-text` container (legacy marker class retained).
- `SummaryRoadmapView.js`: inline `.project-expand-btn` + `.project-gap-list` removed. Project cards become keyboard-focusable buttons → right-panel project detail on click (urgency shape, Dell solutions, constituent gaps, linked-tech count). Unified click-to-detail pattern with swimlane headers, vendor rows, heatmap cells, gap cards.
- Styles: `.session-brief`, `.brief-row`, `.brief-label`, `.brief-text`; `.project-card:hover`.
- Satisfies: **T7.5 · T7.6**.

---

## 12 · AI Platform Specification (authoritative data model + extension points)

**Purpose**: every AI feature — existing or future — composes against these shapes. New provider, new tab binding, new action command, new output mode all follow the same pattern. Adding a scenario should never require rewriting earlier ones.

Shipped through **v2.4.5.1** · Phase 19a-f · enterprise-grade, vendor-neutral.

### §12.1 · Storage contracts (localStorage, `ai_*_v<n>` namespace)

Two keys today; each may bump `vN` when shape evolves. Migrators run on load, preserving user data.

#### `ai_config_v1` — provider settings

```jsonc
{
  activeProvider: "local" | "anthropic" | "gemini",    // default provider for skills without explicit override
  providers: {
    local: {
      label:          "Local LLM",
      baseUrl:        "/api/llm/local/v1",  // relative = nginx-proxied; absolute = direct browser call
      model:          "code-llm",           // e.g. OpenAI-compatible model id exposed by the local inference server
      apiKey:         "",                   // empty when upstream is unauth'd
      fallbackModels: []                    // v2.4.5.1+ — tried after primary exhausts retries
    },
    anthropic: {
      label:          "Anthropic Claude",
      baseUrl:        "/api/llm/anthropic", // proxy path; not user-editable (CORS)
      model:          "claude-haiku-4-5",
      apiKey:         "",
      fallbackModels: ["claude-sonnet-4-5"]
    },
    gemini: {
      label:          "Google Gemini",
      baseUrl:        "/api/llm/gemini",
      model:          "gemini-2.5-flash",
      apiKey:         "",
      fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"]
    }
  }
}
```

**Extension point** — adding a new provider = (a) add to `PROVIDERS` array in `core/aiConfig.js`, (b) add request/response shape to `services/aiService.js`, (c) add nginx proxy path to `docker-entrypoint.d/45-setup-llm-proxy.sh`. No schema version bump needed.

#### `ai_skills_v1` — user-defined skills

```jsonc
[{
  id:             "skill-<8-char-uid>",
  name:           "Suggest discovery questions",
  description:    "Generate 3 tailored customer-discovery questions for the selected driver.",
  tabId:          "context" | "current" | "desired" | "gaps" | "reporting",

  // What the AI may read from (template bindings {{path}} in prompts)
  systemPrompt:   "...template with {{bindings}} allowed...",
  promptTemplate: "...template with {{bindings}} allowed...",

  // What the AI MUST return — drives the non-removable system-prompt footer
  responseFormat: "text-brief"          // plain text, ≤120 words, no preamble
                | "json-scalars"        // JSON object matching outputSchema paths
                | "json-commands",      // JSON array of action commands (v2.4.5+)

  // What the UI does with the response
  applyPolicy:    "show-only"           // render only, no writes
                | "confirm-per-field"   // show proposals with per-row Apply/Skip (default for json-scalars)
                | "confirm-all"         // single "Apply all" button, no per-field choice
                | "auto",               // write immediately (requires opt-in confirmation at creation)

  // What the AI may WRITE TO — allowlist, enforced at apply time
  outputSchema: [
    { path: "session.customer.name",        label: "Customer name",       kind: "scalar" },
    { path: "context.selectedGap.urgency",  label: "Selected gap urgency", kind: "scalar" }
  ],

  // Optional provider pin — null = use active provider from aiConfig
  providerKey:    null | "local" | "anthropic" | "gemini",

  deployed:   true | false,              // appears in the tab's "✨ Use AI ▾" dropdown
  seed:       true | false,              // true = built-in; false = user-created
  createdAt:  "ISO-8601",
  updatedAt:  "ISO-8601"
}]
```

**Migration rules on load** (in `normalizeSkill`):
- Legacy `outputMode: "suggest"` → `applyPolicy: "show-only"`.
- Legacy `outputMode: "apply-on-confirm"` → `applyPolicy: "confirm-per-field"`.
- Legacy `outputMode: "auto-apply"` → `applyPolicy: "auto"`.
- `responseFormat` defaults to `"json-scalars"` if `outputSchema.length > 0`, else `"text-brief"`.
- Unknown `responseFormat` / `applyPolicy` values fall back to safe defaults.
- `providerKey` stays `null` if not set.

### §12.2 · Binding path contract

Two root namespaces. Template bindings use dot-notation.

| Root | Meaning | Read at bind-time | Writable at apply-time |
|---|---|---|---|
| `session.*` | Persisted session state (`sessionStore.js`). | Every skill run. | Only the subset declared writable in `FIELD_MANIFEST`. |
| `context.*` | Runtime-scoped tab selection (e.g. `context.selectedGap`). Built by the tab view at `useAiButton` time. | Every skill run. | Only paths with a registered resolver in `core/bindingResolvers.js`. |

**`FIELD_MANIFEST` entry shape** (`core/fieldManifest.js`):

```jsonc
{
  path:     "context.selectedGap.description",
  label:    "Selected gap description",
  kind:     "scalar" | "array",
  writable: true | false                  // v2.4.4 — must be true for outputSchema eligibility
}
```

**`WRITE_RESOLVERS` entry shape** (`core/bindingResolvers.js`):

```js
// Map<string, function(session, context, value) => void>
"context.selectedGap.description": function(session, context, value) {
  var gap = session.gaps.find(g => g.id === context.selectedGap.id);
  if (!gap) throw new Error("Target gap not found");
  gap.description = value;
}
```

**Extension point** — exposing a new writable field = (a) add `writable: true` to the `FIELD_MANIFEST` entry, (b) add a resolver in `WRITE_RESOLVERS`. `applyProposal` rejects unknown writable paths; the resolver is the only way to mutate via AI.

### §12.3 · System-prompt footer (`core/promptGuards.js`)

Non-removable footer appended to every skill's system message at run time. Selected by `responseFormat`:

- **`text-brief`** — hard constraint: ≤120 words, numbered bullets, no preamble, no disclaimer.
- **`json-scalars`** — response MUST be a single JSON object with only the keys declared in `outputSchema`.
- **`json-commands`** (v2.4.5+) — response MUST be a JSON object `{ commands: [...] }` where each command is an op from the action-commands whitelist.

Footer always wins over user-authored prompt (positional priority in the system role).

### §12.4 · Proposals model (`interactions/aiCommands.js`)

`parseProposals(responseText, outputSchema)` returns:

```jsonc
{ ok: true,  proposals: [{ path, label, kind, before, after }] }    // or:
{ ok: false, error: "...human-readable..." }
```

**Parser tolerance**: strips code-fences (```` ```json ... ``` ````), extracts the first top-level `{...}` from wordy responses. Any response whose top-level JSON has keys outside the skill's `outputSchema` has those keys silently dropped (allowlist).

`applyProposal(proposal, {session, context})`:
- If `path.startsWith("session.")` → direct `setPathFromRoot` write.
- Else if `WRITE_RESOLVERS[path]` exists → call with `(session, context, proposal.after)`.
- Else → throw (path is not declared writable).

`applyAllProposals(proposals, {session, context})` batches under one undo entry.

### §12.5 · Undo stack (`state/aiUndoStack.js`)

Max 10 entries, LIFO. Every apply path pushes a snapshot BEFORE mutation.

```js
push(label, snapshot?)   // snapshot defaults to current session clone
undoLast()               // pops + restores + emits "ai-undo"
undoAll()                // restores oldest snapshot + clears + emits "ai-undo"
canUndo() / peekLabel() / depth()
recentLabels(max?)       // newest-first label list for the header tooltip
clear()                  // drops every entry (called by resetSession / resetToDemo)
onUndoChange(fn)         // UI subscription
```

**v2.4.5 (Foundations Refresh)** — persisted to `localStorage` under `ai_undo_v1`; survives page reload; cleared on `resetSession` / `resetToDemo`. Users still have Export JSON as the durable-across-installs rollback path.

### §12.4a · Reliability: retry + fallback + browser-access opt-in (v2.4.5.1)

`chatCompletion` performs a **bounded retry with exponential-backoff + full jitter** on transient upstream errors, and walks an optional per-provider **fallback-model chain** before giving up.

| Behaviour | Value |
|---|---|
| Retriable HTTP statuses | `429, 500, 502, 503, 504` (+ network-level errors) |
| Non-retriable HTTP statuses | `401, 403`, any other `4xx`, schema errors |
| Retries per model | `RETRY_MAX_ATTEMPTS = 3` (primary + 2 retries) |
| Base backoff | `RETRY_BASE_DELAY_MS = 500ms`; doubles per attempt; capped at `RETRY_CAP_DELAY_MS = 4000ms` |
| Jitter | full-jitter: `random(0, capped)` — prevents thundering-herd |
| Fallback chain | `config.providers[p].fallbackModels: string[]`; tried in order after primary exhausts retries; each gets its own full retry budget |
| Return shape | `{ text, raw, modelUsed, attempts }` — `modelUsed` records which candidate succeeded |

**Anthropic browser-direct opt-in**: Anthropic requires the header `anthropic-dangerous-direct-browser-access: true` whenever a request carries an `Origin` (our transparent nginx proxy preserves it). `buildRequest("anthropic", ...)` sets this unconditionally; without it Anthropic responds 401 with a message naming the header.

**UI surface**: Settings modal exposes a "Fallback models (comma-separated)" input per provider. `testConnection` reports which model actually succeeded via the `modelUsed` field — the user sees e.g. `"✓ OK (fell back to gemini-2.0-flash)"`.

### §12.5a · Session-changed event bus (`core/sessionEvents.js`)

Pub/sub fired after every session-root mutation so views can re-render with live data. Introduced in v2.4.5 to fix the v2.4.4 "driver tile vanishes on AI apply" + "tab blanks after undo" bugs.

```js
emitSessionChanged(reason, label?)    // reserved reasons:
                                      //   "ai-apply", "ai-undo",
                                      //   "session-reset", "session-demo",
                                      //   "session-replace"
onSessionChanged(fn) => unsubscribe   // fn receives { reason, label }
```

`applyProposal` / `applyAllProposals` / `undoLast` / `undoAll` / `resetSession` / `resetToDemo` all emit. Subscribers MUST re-resolve any "selected" entity (driver / instance / gap / project) by id against the live session before re-rendering — the entity may have been mutated, replaced, or removed.

`app.js` is the single subscriber that calls `renderHeaderMeta() + renderStage()` on every event. Individual views don't subscribe; they get re-invoked by the shell.

### §12.6 · Action-commands schema (locked for v2.4.5+, stubbed today)

```jsonc
{
  commands: [
    { op: "updateField",  path: "session.customer.region",  value: "EMEA" },
    { op: "createGap",    props: { description, layerId, gapType, ... } },
    { op: "updateGap",    gapId: "g-005", patch: { urgency: "High", phase: "now" } },
    { op: "deleteGap",    gapId: "g-005" },
    { op: "linkInstance", gapId: "g-005", instanceId: "i-003", side: "current" | "desired" },
    { op: "setGapDriver", gapId: "g-005", driverId: "cyber_resilience" }
  ]
}
```

**Whitelist**: `core/actionCommands.js` (to be created in v2.4.5) maps each `op` to an existing `interactions/*Commands.js` function. Unknown ops rejected at parse time. Each batch produces a single undo entry.

Today (v2.4.4): parser declared but `getSystemFooter("json-commands")` returns a stubbed-but-functional footer; `applyProposal` for a json-commands skill refuses to execute with a clear error.

### §12.7 · Extension points summary

| To add… | Edit | No version bump needed |
|---|---|---|
| A new AI provider | `PROVIDERS` in `aiConfig.js`, shape in `aiService.js`, proxy path in entrypoint script | ✅ |
| A new bindable read-only field | One entry in `FIELD_MANIFEST` for the relevant tab | ✅ |
| A new writable field | `FIELD_MANIFEST` entry with `writable:true` + `WRITE_RESOLVERS` entry | ✅ |
| A new action-command op | `ACTION_COMMANDS` entry in `actionCommands.js` (v2.4.5+) | ✅ |
| A new response format | `promptGuards.js` footer + `skillEngine.js` dispatch + one test | Bump `ai_skills_v1` → `v2` if it changes persisted shape |
| A new apply policy | `UseAiButton.js` branch + one test | ✅ |

### §12.8 · Invariants (regression gates)

1. Every skill stored in localStorage round-trips through `normalizeSkill` exactly; unknown legacy fields are preserved or migrated, never dropped silently.
2. Every path in a skill's `outputSchema` is either a `session.*` path OR has a `WRITE_RESOLVERS` entry. Enforced by load-time validation in v2.4.4+.
3. No direct session mutation from any AI-adjacent code path outside `interactions/aiCommands.js`. Every mutation goes through `applyProposal` / `applyAllProposals` / (v2.4.5+) `applyCommand`.
4. Every apply pushes an undo snapshot. Fail-safe: if `aiUndoStack.push` throws, apply aborts.
5. API keys never leave the user's browser localStorage except to flow through the nginx proxy to the declared upstream. No telemetry, no logging (`access_log off` on `/api/llm/*`).
6. **(v2.4.5)** Every session-root mutation emits a `session-changed` event. `applyProposal` → `"ai-apply"`; `undoLast` / `undoAll` → `"ai-undo"`; `resetSession` → `"session-reset"`; `resetToDemo` → `"session-demo"`. Enforced by `demoSpec DS16 / DS17`.
7. **(v2.4.5)** Every seed skill's `outputSchema` path must exist in `FIELD_MANIFEST[tab]` AND be `writable: true`. Enforced by `demoSpec DS9 / DS10`.
8. **(v2.4.5 · two-surface rule — feedback_foundational_testing.md)** Every data-model change (add / rename / remove a field on instances, gaps, drivers, session metadata) MUST ship in the same commit as: (a) a refreshed `state/demoSession.js` that exercises the field, (b) a seed skill in `core/seedSkills.js` that demonstrates it (if writable), (c) a new or updated assertion in `diagnostics/demoSpec.js`, (d) an entry in `docs/DEMO_CHANGELOG.md`. Reviewers reject PRs that miss any of the four surfaces.

---

## 10 · Out of Scope for v2 (tracked for later)

- **Server-side session persistence** (Node/Express + SQLite/Postgres). Frontend stays offline-first; deferred to v3 multi-user platform. Static-file containerisation **shipped in Phase 15** (v2.2.0).
- **Dell-solutions chip catalog**. v1 stays free-text; revisit after real workshop data.
- **Manual initiative/program authoring** beyond the driver-based auto-assignment.
- **Cross-environment project bundling**. Current tuple stays `(env, layer, type)`.
- **Urgency manual override**. Designed out on purpose; re-open only if workshop data proves need.
- **AI agent integration endpoints**. Data model is already JSON-serialisable; API layer is a post-v2 concern.

---

## 11 · Acceptance

**v2.0** is shippable when:
1. All Phase 0–7 steps are complete.
2. `diagnostics/appSpec.js` reports green banner with 21 regressions + ~95 new assertions.
3. A fresh session (reset + add drivers + add current + set dispositions + save) produces a Roadmap with correctly named Programs, sorted Projects, and no Unassigned projects.
4. Demo session still loads and produces a sensible Roadmap without manual curation.
5. A 2026-vintage browser (Chrome, Firefox, Edge, Safari) renders the UI correctly including the local AVIF logo.

**v2.1** is shippable when:
1. Phases 9–12 complete.
2. All v2.0 assertions still green; new **T2b.***, **T6.*** assertions green.
3. Demo session's auto-drafted gaps start unreviewed with pulsing review dots; approving or editing any gap flips the dot off.
4. Custom-adding "HPE Nimble X" produces `vendor: "HPE"`, `vendorGroup: "nonDell"`, visible in Vendor Mix counts.
5. Right panels across Matrix, Gaps, and Summary sub-tabs are help-free — a single terse placeholder only. Tab 1 driver-detail still shows the coaching card.
6. Help modal opens for every tab/sub-tab with meaningful prose; keyboard Esc and backdrop click both close it.
7. Overview shows two panels: Coverage as a percent with progress bar and actionable bullet list; Risk as a coloured label with actionable bullet list. Old single-number "health score" card is gone from the UI (function retained in service for back-compat).

**v2.1.1** is shippable when:
1. Phases 13 + 14 complete.
2. All v2.1 assertions still green; new **T7.1 – T7.6** green.
3. Overview right panel hosts the Session Brief (labelled rows, Refresh button with transient feedback).
4. Every Reporting sub-tab's right panel hosts meaningful detail at rest or on click (no dead space).
5. Roadmap project cards open right-panel detail on click; no inline expand remains. Swimlane headers open Strategic Driver detail.
6. Vendor Mix rows open per-vendor detail on click.

**v2.2.0** is shippable when:
1. Phase 15 complete (Dockerfile + nginx.conf + docker-compose.yml + .dockerignore + docs).
2. `docker compose up -d --build` from a fresh clone produces a healthy container (HEALTHCHECK passes within 30 s).
3. `curl http://localhost:8080/health` returns `ok`.
4. Browsing to `http://localhost:8080` renders the Dell Discovery Canvas with the local AVIF logo (no fallback to `i.dell.com`), and the test banner reports green for all 22 suites inside the container's app.
5. Default bind address is `127.0.0.1` (verified via `docker port dell-discovery-canvas` showing the loopback mapping); `BIND_ADDR=0.0.0.0 docker compose up` exposes the service on the LAN at `<host-IP>:8080`.
6. Image runs unmodified on linux/arm64 (Dell GB10 / Grace) — confirmed by reviewer test on the GB10.

**v2.2.1** is shippable when:
1. Phase 15.1 complete (entrypoint script + nginx.conf include + Dockerfile apache2-utils + compose env vars + docs).
2. `docker compose up -d --build` with no env vars behaves identically to v2.2.0 (backward-compatible).
3. `AUTH_USERNAME=… AUTH_PASSWORD=… docker compose up -d --build` produces a healthy container in which:
   - `curl /` without creds returns 401 with `WWW-Authenticate: Basic`.
   - `curl -u user:wrongpass /` returns 401.
   - `curl -u user:rightpass /` returns 200.
   - `curl /health` returns `ok` regardless of creds.
   - All static assets (`/app.js`, `/styles.css`, `/Logo/...avif`, etc.) are gated identically.
4. HEALTHCHECK reaches `(healthy)` within 30 s in both auth modes.
5. Browser navigates to `http://localhost:8080`, sees the native browser login prompt when auth is on, enters credentials, sees the Dell Discovery Canvas with the green test banner (348 assertions) inside the container's app.

**v2.4.3** is shippable when:
1. Phase 19d.1 complete (promptGuards + runSkill footer injection + SkillAdmin refine/gate + Suite 29).
2. Every skill's system prompt carries the mandatory text-brief footer at run time (≤120 words, no preamble, no prose). Verified by real AI response being terse.
3. "✨ Refine to CARE format" button renders in the edit form, sends the CARE meta-prompt to the active provider, opens a side-by-side diff, lets the user Accept (replace draft) or Keep (discard refined).
4. Save button is disabled until a successful test matches the current draft signature. Any edit to template / system prompt / tab / output mode re-disables Save.
5. `appSpec.js` banner: **399 assertions** (393 prior + 6 new PG*).

**v2.4.2.1** is shippable when:
1. Phase 19c.1 complete (PillEditor module + SkillAdmin pill-editor integration + aiService error categorisation + Suite 28).
2. Template editor renders stored skills as inline pills + free text; chip click inserts a pill at the cursor; Alt-click inserts a bare pill.
3. Backspace immediately after a pill removes the pill as a unit (no partial `{{path}}` corruption). Delete before a pill does the same on the other side.
4. Tab-change in the edit form preserves editor state (pills remain pills, label info intact).
5. `editor.serialize()` emits the exact template form the engine stored — `"Label: {{path}}"` for labeled, `"{{path}}"` for bare — round-trips without drift.
6. HTTP errors render with human hints — 401/403 points to the API-key field, 429 suggests waiting, 5xx names upstream-transient status.
7. `appSpec.js` banner: **393 assertions** (386 prior + 7 new PE*; FP6/FP8 updated to pill-editor contract).

**v2.4.2** is shippable when:
1. Phase 19c complete (fieldManifest + SkillAdmin chip row + live preview + test button + coerceForLLM + Suite 27).
2. Every bindable field in the manifest renders as a clickable chip when the skill edit form is open on that target tab.
3. Chip click inserts `Label: {{path}}` at cursor by default; Alt-click inserts bare `{{path}}`.
4. `{{session.gaps}}` / `{{session.instances}}` / any array/object binding renders as pretty-printed JSON in the preview (never `[object Object]`).
5. "Test skill now" button dry-runs the unsaved draft skill against the active AI provider and shows the response inline.
6. `appSpec.js` test banner reports green for **386 assertions** (377 prior + 9 new FP*).

**v2.4.1** is shippable when:
1. Phase 19b complete (skillStore + skillEngine + skillCommands refactor + SkillAdmin + SettingsModal section routing + UseAiButton + ContextView generic integration + Suite 26).
2. Fresh install auto-seeds the Tab 1 driver-question skill (deployed by default). Opening the app for the first time gives the same Tab 1 behaviour as v2.4.0 without any user action.
3. Gear icon settings modal has two top-level pills: *AI Providers* + *Skills*. Clicking *Skills* shows the admin surface.
4. `+ Add skill` form lets the user set name, description, target tab (5 options), AI role / instructions, data template, output mode, deployed flag. Save persists to localStorage and updates the admin list.
5. Deployed skills for the current tab appear in a `"✨ Use AI ▾"` dropdown on that tab. Clicking a skill renders the result inline. Un-deploying removes it from the dropdown without deleting it.
6. Template rendering: `{{session.*}}` resolves against full session; `{{context.*}}` against the tab's passed-in context; missing paths render as empty strings (never throw).
7. `appSpec.js` test banner reports green for **377 assertions** (369 prior + 8 new SB*; AI9 retargeted to `.use-ai-btn`).

**v2.4.0** is shippable when:
1. Phase 19a complete (aiConfig + aiService + SettingsModal + gear button + ContextView demo card + skillCommands + nginx proxy + entrypoint script + compose env + Suite 25).
2. Container rebuilds clean; `45-setup-llm-proxy.sh` writes the snippet with `LLM_HOST` defaults; HEALTHCHECK reaches `(healthy)`.
3. Gear icon opens the settings modal; switching provider pills persists; Save + Test-connection both work.
4. Real AI calls succeed end-to-end against at least one public provider (Anthropic or Gemini) from the browser via the nginx proxy. User-confirmed with Gemini 2026-04-19 evening.
5. ContextView Tab 1 demo: "Suggest discovery questions" button renders on every driver's detail panel; clicking routes to the active provider and renders a real response (or a friendly error if misconfigured).
6. `appSpec.js` test banner reports green for **369 assertions** (359 prior + 10 new AI*) inside the running container.
7. Deprecated-model auto-migration works (saved `gemini-2.0-flash` → loads as `gemini-2.5-flash` while preserving the API key).

**v2.2.2** is shippable when:
1. `styles.css :root` carries Dell-aligned values for `--brand`/`--text-1`/`--surface*`/`--border*`/`--shadow*` and Inter+JetBrains Mono in `--font`/`--font-mono`.
2. `index.html` Google Fonts link loads Inter (300-800) + JetBrains Mono (400-600).
3. CSS variable NAMES are unchanged so every existing component continues to render without per-selector edits.
4. Container rebuilds clean and HEALTHCHECK reaches `(healthy)`.
5. Browser banner reports 359/359 green inside the running container — no logic-test regression.
6. Visual eyeball across Tab 1-5: header gradient now uses Dell deep→blue stack; primary buttons + accent surfaces show Dell Blue; body type renders in Inter; the test banner, Roadmap project cards, gap detail panel, mapped-assets section, and vendor strips all read coherently.

**v2.3.1** is shippable when:
1. Phase 16 complete (workload layer + catalog + Instance.mappedAssetIds + mapAsset/unmapAsset/proposeCriticalityUpgrades + MatrixView wiring + styles + Suite 24).
2. `LAYERS[0].id === "workload"`; the matrix renders 6 rows × 4 environment columns.
3. A current workload tile detail shows the **Mapped infrastructure** section with the empty-state copy when no assets are mapped.
4. `+ Map asset` opens a picker listing other-5-layers tiles in the same state; click adds the asset id; the row appears in the workload's mapped list with the asset's layer/env/criticality.
5. `↑ Propagate criticality` only renders when the workload has a criticality AND ≥ 1 mapped asset; clicking walks per-asset confirms; on accept, only lower-criticality assets get upgraded; equal/higher assets are skipped silently.
6. Cross-state mapping (current workload ↔ desired asset) is rejected at the command layer.
7. `appSpec.js` test banner reports green for **358 assertions** (352 prior + 6 new W*) inside the running container. No previously-passing assertion regresses.

**v2.3.0** is shippable when:
1. Phase 18 complete (GapsEditView always-visible + warning row + chip; SummaryRoadmapView dedup; icons cleanup; styles update; T8 suite).
2. Gap detail panel renders both link sections inline on selection — no `Manage links` collapse remains.
3. Opening the link picker for a gap shows a yellow warning row above any candidate already linked to another gap; clicking still proceeds (warn-but-allow).
4. When the same instance is linked to ≥ 2 gaps, every gap detail panel that lists it shows a red "linked to N gaps" chip on that row.
5. The Roadmap project right-panel detail reports linked-technology count as unique instance ids (no double-counting from multi-linked assets).
6. Deleting a gap with linked instances does not remove or alter the instances; they remain available for re-linking into a new gap (Item 10 regression).
7. `appSpec.js` test banner reports green for **352 assertions** (348 prior − 1 retired T6.13 + 5 new T8.*) inside the running container. No other previously-passing assertion regresses.
8. `.gitattributes` keeps `docker-entrypoint.d/40-setup-auth.sh` LF-only on every fresh checkout, so the v2.2.1 auth flow continues to build cleanly on Windows hosts.
