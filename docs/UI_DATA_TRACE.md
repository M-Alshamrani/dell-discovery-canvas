# UI_DATA_TRACE

**Document**: `docs/UI_DATA_TRACE.md`
**Revision**: r6
**Hash (FNV-1a 32-bit hex over file content, with the `__HASH_HERE__` placeholder string literal in this line)**: `4fb8b31d`
**Date**: 2026-05-11
**Author**: Claude (with user validation)
**Status**: COMPLETE — All five tabs + global shell traced and user-validated. 4 wiring bugs flagged for C10 hygiene commit.

## Purpose

Per-tab, per-element hierarchical map of every visible UI surface on the Discovery Canvas, traced to the engagement-schema data point each element reads or writes. **Authoritative reference** for:

- The v3.0 Skill Builder data-points catalog (Standard / Insights / Advanced split)
- SPEC §S25 contract-fidelity audit + the `core/dataContract.js` constitution
- Any future change to the UI surface — every new element MUST be traced here
- Cross-checking that no UI element writes a path the contract doesn't know about (constitutional violation guard)

## Constitutional anchors (do not modify those without amendment)

- `core/dataContract.js` — the canonical data contract (SPEC §S25)
- `schema/*.js` — Zod schemas referenced throughout
- `catalogs/snapshots/*.js` — FK catalogs referenced throughout

## Legend

- **[A]** authored — user types / picks the value via this element
- **[D]** displayed only — shown but not directly editable here
- **[L]** catalog-resolved label — stored field is a catalog id; UI shows the label
- **[N]** non-data — static text / visual / navigation
- **⚠** wiring bug or schema/UI gap flagged for separate work-item

---

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                       ◆  T A B   1   ◆   C O N T E X T  ◆                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

# Tab 1 · Context

Rendered by `ui/views/ContextView.js`. The Context tab is the engagement's identity card + the strategic-drivers map + the environments roster. Authors the entities that everything downstream (Current / Desired / Gaps / Reporting) depends on.

## §1 · Top banner (mutually exclusive)

```
├─ Fresh-start welcome card                          (only if engagement is empty)
│    L74  _renderFreshStartCard()
│    └─ static onboarding card                       [N]
│
└─ Demo-mode banner                                  (only if isDemo)
     L76  renderDemoBanner()
     └─ reads engagement.meta.isDemo                  [D]
          auto-flipped to false on first customer save (L139)
```

## §2 · Discovery context card  (left pane, top)

```
Title strip
  ├─ "Discovery context" title                        [N]
  └─ Help (?) button                                  [N]

Form — row 1 (2 columns)
  ├─ Customer name input          L92  → customer.name       [A]
  └─ Vertical / segment dropdown  L94  → customer.vertical   [A, options from CUSTOMER_VERTICALS catalog]

Form — row 2 (2 columns)
  ├─ Region input                 L99  → customer.region            [A]
  └─ Presales owner input         L104 → engagementMeta.presalesOwner [⚠ writes IGNORED today;
                                                        schema field + selector both real]

Action button
  └─ Save context                 L110 → commitContextEdit({customer:{...}})
                                       · also flips engagement.meta.isDemo = false (L139)
```

**⚠ MISSING INPUT IN UI:** `customer.notes` (schema has the field; migrator preserves v2.x `segment`/`industry` content into it; no textarea exists)

## §3 · Strategic Drivers card  (left pane, middle)

```
Title strip
  ├─ "Strategic Drivers" title                        [N]
  └─ hint text                                        [N]

Driver tiles row  (one tile per added driver)
  ├─ Driver tile  L220 _buildDriverTile()
  │    ├─ Tile label       L229  → BUSINESS_DRIVERS.byId[driver.businessDriverId].label    [L]
  │    ├─ Tile hint        L230  → BUSINESS_DRIVERS.byId[driver.businessDriverId].shortHint [L]
  │    ├─ Priority badge   L233  → driver.priority                                          [D]
  │    └─ × delete button  L237  → commitDriverRemove(driver.id)
  │            (confirmation modal if driver.outcomes is non-empty — L252)
  │
  └─ + Add driver button   L214 → opens driver palette overlay

Driver palette overlay  (when + Add driver clicked)
  L277 _openDriverPalette()
  ├─ Search input                                     [N]
  └─ Result rows (catalog entries not already added)
       ├─ Item name        → BUSINESS_DRIVERS[*].label                                       [L]
       ├─ Item hint        → BUSINESS_DRIVERS[*].shortHint                                   [L]
       └─ On click: commitDriverAdd({businessDriverId, priority:"Medium", outcomes:""})
```

## §4 · Driver detail panel  (right pane, when a driver tile is clicked)

```
L379 _renderDriverDetail()

Conversation-starter card (top of right pane)
  ├─ Title "Conversation starter"                     [N]
  └─ Body  L387 → BUSINESS_DRIVERS.byId[driver.businessDriverId].conversationStarter         [L]
            (catalog-derived; no schema field; pure prompting aid)

Driver form card (below)
  ├─ Card title  L393  → BUSINESS_DRIVERS.byId[driver.businessDriverId].label                [L]
  ├─ Card hint   L394  → BUSINESS_DRIVERS.byId[driver.businessDriverId].shortHint            [L]
  ├─ Priority dropdown  L399 → driver.priority   [A, enum High|Medium|Low]
  │     · NOT a rank — criticality level. Multiple drivers can all be High.
  └─ Business outcomes textarea  L425 → driver.outcomes  [A]
        · per-keystroke commit (L436)
        · this IS the per-driver free-text / "driver comment" field
          (driver schema has no separate notes/comment field; outcomes IS it)
```

## §5 · Environments card  (left pane, bottom)

```
Title strip
  ├─ "Environments" title                             [N]
  └─ hint text                                        [N]

Quick-shape preset row  (only when >1 visible env)
  L474
  ├─ "Quick shape" label                              [N]
  └─ "Single site" chip  L477
       · bulk-sets environment.hidden = true for every env where envCatalogId ≠ "coreDc"
       · with confirmation modal

Active env tiles row  (one tile per non-hidden env)
  ├─ Env tile  L569 _buildEnvTile()
  │    ├─ Tile label       L579  → environment.alias || ENV_CATALOG.byId[env.envCatalogId].label  [A or L fallback]
  │    ├─ Tile sublabel    L580  → ENV_CATALOG.byId[env.envCatalogId].label                       [L]
  │    └─ Tag row (each tag shown ONLY if value exists)
  │         ├─ Location tag   L613 → environment.location  [D]
  │         ├─ Size tag       L618 → environment.sizeKw + " MW"  [D]
  │         ├─ Area tag       L623 → environment.sqm + " m²"     [D]
  │         └─ Tier tag       L628 → environment.tier            [D]
  │
  └─ + Add environment button  L495 → opens env palette overlay

Env palette overlay  (when + Add environment clicked)
  L767 _openEnvPalette()
  ├─ Search input                                     [N]
  └─ Result rows (catalog entries not already added)
       ├─ Item name   → ENV_CATALOG[*].label                     [L]
       ├─ Item hint   → ENV_CATALOG[*].hint                      [L]
       └─ On click: commitEnvAdd({envCatalogId})

Hidden environments section  (only when any env is hidden)
  L503
  ├─ Heading "Hidden environments (N) · excluded from the report; click to restore"  [N]
  └─ Per hidden env tile
       ├─ "HIDDEN" tag                                [N]
       ├─ Instance-count meta  L589 → _countInstancesForEnv(env.id)
       │     → "N instances preserved in saved file"  [D, derived: count of engagement.instances where environmentId === env.id]
       └─ Restore button → commitEnvUnhide(env.id)  → environment.hidden = false
```

## §6 · Environment detail panel  (right pane, when an env tile is clicked)

```
L648 _renderEnvDetail()

Header
  ├─ Title  L655  → environment.alias || ENV_CATALOG.byId[env.envCatalogId].label  [A/L]
  └─ Hint   L657  → ENV_CATALOG.byId[env.envCatalogId].hint                        [L]

Detail grid — 6 inputs (L660 fields[])
  ├─ Alias input        L661  → environment.alias      [A, string, fallback to catalog label]
  ├─ Location input     L662  → environment.location   [A, string]
  ├─ Capacity (MW) num  L663  → environment.sizeKw     [A, number, min 0 / max 200 / step 0.5]
  ├─ Floor area (m²)    L665  → environment.sqm       [A, number, min 0 / max 100000 / step 50]
  ├─ Tier datalist      L667  → environment.tier       [A, string with suggestion list:
  │                              Tier I/II/III/IV, Public, Sovereign, Edge/Branch, N/A]
  └─ Notes input        L670  → environment.notes      [A, string]

Footer
  └─ Hide / Restore button  L731
       · Hide path: _startHideFlow → save-guard modal (if dirty) → confirm modal → commitEnvHide → environment.hidden=true
       · Restore path: commitEnvUnhide → environment.hidden=false
       · Disabled if only 1 visible env remains (L748)
```

## §7 · Welcome placeholder  (right pane, when nothing is selected)

```
L973 _renderWelcomePanel()
├─ Title "Select a strategic driver"                  [N]
└─ Hint text                                          [N]
```

---

## Tab 1 · Data-point summary

| Path | Class | Where authored / displayed | Notes |
|---|---|---|---|
| `customer.name` | A | §2 Form row 1 left | Required, ≥1 char |
| `customer.vertical` | A | §2 Form row 1 right | Dropdown from `CUSTOMER_VERTICALS` |
| `customer.region` | A | §2 Form row 2 left | Free text |
| `customer.notes` | — | **⚠ NO UI INPUT** | Schema field exists; migrator uses it; no textarea |
| `engagementMeta.presalesOwner` | ⚠ | §2 Form row 2 right | Input exists, writes ignored (L101 comment) |
| `engagementMeta.isDemo` | D | §1 demo banner | Auto-flips to false on first save (L139) |
| `driver.businessDriverId` | A | §3 driver palette pick | Catalog FK to `BUSINESS_DRIVERS`; never directly edited after add |
| `driver.priority` | A | §4 detail dropdown | enum High / Medium / Low — *criticality, not rank* |
| `driver.outcomes` | A | §4 detail textarea | Per-keystroke commit; the driver's free-text comment |
| `environment.envCatalogId` | A | §5 env palette pick | Catalog FK to `ENV_CATALOG`; never directly edited after add |
| `environment.alias` | A | §6 detail input | Falls back to catalog label if empty |
| `environment.location` | A | §6 detail input | |
| `environment.sizeKw` | A | §6 detail input | Number; rendered as "N MW" tag on tile |
| `environment.sqm` | A | §6 detail input | Number; rendered as "N m²" tag on tile |
| `environment.tier` | A | §6 detail datalist | Datalist suggestions: Tier I-IV / Public / Sovereign / Edge / N/A |
| `environment.notes` | A | §6 detail input | The env's free-text comment field |
| `environment.hidden` | A | §5 Hide button / §6 Hide button / §5 preset chip | Boolean; soft-delete |

### Catalog-resolved labels used in display (not stored — looked up)

- `BUSINESS_DRIVERS.byId[businessDriverId].{label, shortHint, conversationStarter}`
- `ENV_CATALOG.byId[envCatalogId].{label, hint}`
- `CUSTOMER_VERTICALS[*].{label}` (dropdown options for `customer.vertical`)

### Derived / computed values (no direct schema field)

- Hidden-env instance count (§5 hidden tile) — derived from `engagement.instances` filtered by `environmentId`.

---

## Wiring bugs / schema-UI gaps surfaced in Tab 1

| ID | Surface | Field | Status | Fix scope |
|---|---|---|---|---|
| WB-1 | §2 Form row 2 right | `engagementMeta.presalesOwner` | UI input exists, writes ignored (L101 comment) | ~10 LOC to wire `commitEngagementMetaEdit({presalesOwner})` + remove stale comment |
| WB-2 | §2 Form (missing) | `customer.notes` | Schema field exists, migrator uses it, no UI input | ~5 LOC to add textarea + wire into existing Save context handler |

Both flagged for inclusion in the contract-fidelity arc (C10 hygiene commit candidate).

---

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                   ◆  T A B   2   ◆   C U R R E N T   S T A T E  ◆            ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

# Tab 2 · Current state

Rendered by `ui/views/MatrixView.js` with `opts.stateFilter = "current"`. The matrix that captures what infrastructure the customer has today — one instance tile per `(layerId, environmentId)` cell, plus the "+ Add" affordance.

## §1 · Top banner (conditional)

```
└─ Demo-mode banner                                 (only if isDemo)
     L65  renderDemoBanner(left)
     └─ reads engagement.meta.isDemo                  [D]
```

## §2 · Empty-environments card  (shown only when activeEnvs.length === 0)

```
L81  renderEmptyEnvsCenterCard()
· static empty-state. No data points. User redirected to Context tab.
```

## §3 · Card header (top of matrix)

```
L90-101
├─ Title "Current state · architecture matrix"        [N]
├─ Help (?) button                                    [N]
└─ Hint "Map technologies the customer has today.
          Click any tile to set criticality and notes.
          Use Add to browse the catalog."             [N]
```

## §4 · Matrix grid

```
L119-173

Column headers — one per visible (non-hidden) environment
  L125-142
  Per env head:
    ├─ Code "E.01" / "E.02" ...                       [N, derived from array index]
    └─ Name                                           [L, env.alias || ENV_CATALOG.byId[env.envCatalogId].label]

Row headers — 6 fixed LAYERS rows
  L145-156
  Per layer head:
    ├─ Code "L.01"–"L.06"                             [N, derived from array index]
    ├─ Layer name                                     [L, LAYERS catalog label
    │                                                       — workload / compute / storage / dataProtection / virtualization / infrastructure]
    └─ Color bar                                      [N]

Cells — 6 layers × N envs
  L158-169, renderCell L195
  Per cell — instances filtered by:
    i.state === "current" && i.layerId === <row> && i.environmentId === <col>
  Cell contents:
    ├─ One Instance tile per matching instance       (see §5)
    └─ "+ Add" button                                (see §6)
```

## §5 · Instance tile (current-state)

```
L267 buildTile()

Tile root CSS classes (derived from data):
  ├─ "vg-<vendorGroup>"          → instance.vendorGroup                      [D, class only]
  ├─ "crit-<criticality>"        → instance.criticality.toLowerCase()        [D, class only]
  ├─ "selected"                  → matches selectedInstId                    [D, UI state]
  └─ "ai-tagged"                 → instance.aiTag != null                    [D]

Tile content:
  ├─ AI tag badge "AI" (only if aiTag set)
  │   L296-303
  │   ├─ Visible chip text "AI"                                              [N]
  │   └─ Tooltip:
  │        ├─ "skill <skillId>"          → instance.aiTag.skillId           [D]
  │        └─ "<mutatedAt>"              → instance.aiTag.mutatedAt         [D]
  │
  ├─ Tile label  L306  → instance.label                                      [D]
  ├─ Criticality shape  L318  → instance.criticality (color-coded)           [D, visual indicator]
  ├─ Delete × button  L324
  │   · confirms then calls commitInstanceRemove(inst.id)
  │
  └─ On click: opens detail panel (§7)

NOTE: Tab 2 tiles NEVER show disposition-badge or priority-badge —
      those are desired-only fields (Tab 3 only).
```

## §6 · "+ Add" button + Command palette  (per-cell)

```
L224  per-cell + Add button
L471  openCommandPalette()

Palette overlay:
  ├─ Context strip                                    [N]
  │   L485  "{layerLabel} -- {envLabel}" via labelResolvers
  │
  ├─ Search input                                     [N]
  │
  └─ Result rows (grouped by vendorGroup)
      L510-547 render()
      Each result row writes (on click):
        commitInstanceAdd({
          state:         "current",        ← implicit via Tab 2
          layerId:       <row layer>,
          environmentId: <col env UUID>,
          label:         <picked label>,    [A]
          vendor:        <picked vendor>,   [A]
          vendorGroup:   "dell"|"nonDell"|"custom"  [A]
        })

      Groups:
      ├─ "Dell" section          → entries from CATALOG[layerId] where vendorGroup === "dell"
      ├─ "Non-Dell" section      → entries where vendorGroup === "nonDell"
      ├─ "Other / Custom" section → entries where vendorGroup === "custom"
      │
      └─ "Add new" section (when search term has no exact match)
          ├─ + Add "<term>" — Dell SKU         → addToCell(term, "Dell", "dell")
          ├─ + Add "<term>" — 3rd-party vendor → opens vendor chooser (§6b)
          └─ + Add "<term>" — Custom/internal  → addToCell(term, "Custom", "custom")
```

## §6b · Vendor chooser  (sub-overlay)

```
L551 openVendorChooser()
├─ Header "Pick vendor for '<name>'"                  [N]
├─ COMMON_VENDORS list (12 entries: HPE, Cisco, NetApp, Pure, IBM,
│                       Microsoft, VMware, Nutanix, Red Hat, AWS, Azure, Google)
│   → On click: addToCell(name, vendor, "nonDell")
└─ "Other (type vendor name)" row → free-text input then addToCell

Commits: instance.vendor [A] + instance.vendorGroup="nonDell" [A]
```

## §7 · Detail panel  (right pane, when a current tile is clicked)

```
L635 showDetailPanel()

Header
├─ Title         L641  → instance.label                                  [D]
├─ Sub-title     L642  → instance.vendor || instance.vendorGroup         [D]
└─ Vendor-group badge  L643  → instance.vendorGroup                      [D]
                          (rendered as "Dell" / "Non-Dell" / "Custom")

Form (current-state-specific)
├─ Criticality dropdown  L660 → instance.criticality   [A, enum: ""/Low/Medium/High]
│                              · empty default coerced to "Low" on save (L699)
│                              · criticality LEVEL of this asset/workload (not rank)
│
└─ Notes textarea         L685 → instance.notes        [A, free text]
                              · Tab 2 placeholder hint:
                                "Pain, version, end-of-life, technical debt..."

Action buttons
├─ Save changes  L688  → commitInstanceUpdate(inst.id, patch)
│                     · also calls commitSyncGapsFromCurrentCriticality(inst.id)
│                       so linked gaps re-derive urgency from new criticality
└─ Remove        L726  → commitInstanceRemove(inst.id)

Workload-only sub-section (§8, only if inst.layerId === "workload")
```

## §8 · Mapped infrastructure section  (workload tiles only)

```
L747 buildMappedAssetsSection()

Title "Mapped infrastructure"                          [N]

LINKED VARIANTS strip  (only if same workload label exists in other envs)
L762-780
├─ Eyebrow "LINKED VARIANTS"                           [N]
├─ "Same workload also runs in: " label                [N]
└─ Env chip(s)                                         [D, derived]
    · derivation: walk instances where
      label === workload.label && state === workload.state &&
      layerId === "workload" && environmentId !== workload.environmentId
    · chip text = envLabelResolver(variant.environmentId)
    · click navigates to that variant tile

Mapped asset list  L786-817
Per mapped asset row:
  ├─ Vendor-group dot                                  [D, asset.vendorGroup]
  ├─ Asset label                                       [D, asset.label]
  ├─ Sub: "<layerLabel> / <envLabel>"                  [D, both label-resolved]
  ├─ Criticality chip (if set)                         [D, asset.criticality]
  └─ Unmap × button                                    → commitWorkloadMap(workload.id, newIds[])

Action row  L820
├─ "+ Map asset" button     → opens asset picker (§8b)
└─ "↑ Propagate criticality" button
       (only if workload.criticality && mapped.length > 0)
       · runs proposeCriticalityUpgrades + commits upgrades on lower-crit mapped assets
```

## §8b · Asset picker  (overlay from + Map asset)

```
L835 openAssetPicker()
├─ Title "Map an asset to '<workload.label>'"          [N]
└─ Candidate rows: instances filtered by
      i.state === workload.state &&
      i.environmentId === workload.environmentId &&
      i.layerId !== "workload" &&
      !alreadyMapped
   · On click: commitWorkloadMap(workload.id, [...existing, picked.id])
   · This writes to instance.mappedAssetIds[]  [A]
```

## §9 · Right-pane placeholder  (default, nothing selected)

```
L1048 showHint()
└─ Static "Select a tile..." text                      [N]
```

---

## Tab 2 · Data-point summary

| Path | Class | Where authored / displayed | Notes |
|---|---|---|---|
| `instance.state` | A | Implicit — Tab 2 always writes `state="current"` | Tab choice IS the state value |
| `instance.layerId` | A | Cell row position | One of 6 LAYERS catalog ids |
| `instance.environmentId` | A | Cell column position | UUID of an environment |
| `instance.label` | A | §6 command palette pick or "+ Add new" free-text | Required, ≥1 char |
| `instance.vendor` | A | §6 catalog group pick or §6b vendor chooser | Free text once authored |
| `instance.vendorGroup` | A | §6 grouping at pick time | enum: `dell` / `nonDell` / `custom` |
| `instance.criticality` | A | §7 detail dropdown | enum: Low / Medium / High — criticality LEVEL, not rank |
| `instance.notes` | A | §7 detail textarea | Free text |
| `instance.mappedAssetIds[]` | A | §8 mapped-asset list + §8b picker (workload-only) | Array of FK to instances; cross-cutting |
| `instance.aiTag` | D | §5 "AI" badge on tile | Read-only display; cleared on next engineer save |
| `engagement.meta.isDemo` | D | §1 demo banner | |

### Catalog-resolved labels used in display

- `LAYERS[*].{label}` — row headers + asset-row layer sub-label
- `ENV_CATALOG[*].{label}` — column headers (via `envLabelResolver`); env tile fallback when alias empty
- `CATALOG[layerId][*].{label, vendor, vendorGroup}` — command palette catalog items

### Derived / computed values (no direct schema field)

- `E.NN` env code, `L.NN` layer code — derived from array index
- LINKED VARIANTS chip set — derived from `engagement.instances` walk
- Mapped-asset count — derived from `workload.mappedAssetIds.length`

### NOT in Tab 2 (these are Tab 3 only)

- Disposition picker, ghost tiles for unreviewed currents, unreviewed-gap banner
- `instance.disposition` (desired-only)
- `instance.priority` (desired-only, the Now/Next/Later phase)
- `instance.originId` (set automatically when a disposition creates a desired counterpart)
- Auto-gap-drafting on disposition apply

---

## Wiring bugs / gaps surfaced in Tab 2

None — every UI element in Tab 2 traces cleanly to a schema field, a catalog lookup, or a derived value.

---

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                   ◆  T A B   3   ◆   D E S I R E D   S T A T E  ◆            ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

# Tab 3 · Desired state

Same `ui/views/MatrixView.js` source as Tab 2, rendered with `opts.stateFilter = "desired"`. Tab 3 carries everything Tab 2 has PLUS the desired-only surfaces: unreviewed banner, ghost tiles for unreviewed currents, disposition picker, action/phase form fields, auto-gap-drafting.

## §1 · Top banner (conditional)

```
└─ Demo-mode banner                                 (only if isDemo)
     L65 renderDemoBanner(left)
     └─ reads engagement.meta.isDemo                 [D]
```

## §2 · Empty-environments card  (only when activeEnvs.length === 0)

```
L81 renderEmptyEnvsCenterCard()
· static empty-state. No data points.
```

## §3 · Card header

```
L90-101
├─ Title "Desired state · architecture matrix"        [N]
├─ Help (?) button                                    [N]
└─ Hint "Set a disposition for each current technology
          (grey dashed tiles). Add net-new desired technologies
          using the Add button."                      [N]
```

## §4 · Unreviewed gaps banner  (DESIRED-ONLY)

```
L104-112, updateUnreviewedBanner L1001
└─ Banner text (one of two)                            [D, derived]
     · "N of M current items not yet reviewed — click the grey
       dashed tiles to set each disposition."         (when unreviewed > 0, banner-warn class)
     · "All M current items reviewed in desired state."
                                                       (when unreviewed === 0, banner-ok class)
     · counts derived: M = count(state==="current"),
                       N = count(state==="current" without any state==="desired" + originId match)
```

## §5 · Matrix grid (same column/row structure as Tab 2)

```
L119-173

Column headers — one per visible env (same as Tab 2)
  ├─ Code "E.NN"                                      [N]
  └─ Name                                             [L]

Row headers — 6 fixed LAYERS rows (same as Tab 2)
  ├─ Code "L.NN"                                      [N]
  ├─ Layer name                                       [L, LAYERS catalog label]
  └─ Color bar                                        [N]

Cells — DUAL render per cell:
  L201-213  GHOST tiles (Tab 3 only)
            · For each current instance in this cell WITHOUT a
              state==="desired" + originId === curInst.id counterpart,
              render a ghost tile.
  L216-221  Actual desired-state tiles in this cell.
  L223-233  "+ Add" button at the bottom.
```

## §6 · Ghost tile  (DESIRED-ONLY)

```
L248 buildGhostTile()
Visual: greyed dashed border, mirror-tile + ghost-tile CSS classes

├─ Tile label                  L255 → curInst.label                        [D, reads from CURRENT instance]
├─ "? Review" badge            L256                                        [N]
├─ Criticality shape (if set)  L257 → curInst.criticality (carried-over)   [D]
│     · tooltip: "Criticality carried from current: <level>"
│
└─ On click: opens DISPOSITION PICKER panel (§8) with preselected=null

Purpose: forces the author to make a disposition decision for every
current item before the desired state is "complete." Once a disposition
is chosen, the ghost converts to an actual desired-state tile (§7).
```

## §7 · Desired-state instance tile  (when disposition is set)

```
L267 buildTile()
Same CSS-class derivation as Tab 2 (vg-/crit-/selected/ai-tagged) PLUS:

├─ AI tag badge "AI" (same as Tab 2 §5)              [D, only if aiTag set]
├─ Tile label  L306  → instance.label                                      [D]
├─ Disposition badge L308 (DESIRED-ONLY when inst.disposition set)
│                       L309 → DISPOSITION_ACTIONS.byId[inst.disposition].label  [L]
│                       (CSS class "badge-<disposition>" for color coding)
│
├─ Priority/phase badge L314 (DESIRED-ONLY when inst.priority set
│                                AND inst.disposition not set yet)
│                       → instance.priority (Now / Next / Later)            [D]
│                       (CSS class "priority-<level>")
│
├─ Criticality shape  L318 (DESIRED-ONLY: inherited from origin)
│                     · resolved via inst.originId → current instance.criticality
│                     · tooltip: "Criticality: <level> — carried from '<source.label>'"
│
├─ Delete × button  L324  → commitInstanceRemove(inst.id)
│
└─ On click:
     · If inst.originId && !inst.disposition → opens DISPOSITION PICKER (§8)
     · Otherwise → opens DETAIL panel (§9)
```

## §8 · Disposition picker panel  (DESIRED-ONLY)

```
L352 showDispositionPanel()
Opened when: a ghost tile is clicked, OR a desired tile with originId
but no disposition yet is clicked.

Header
├─ Title "What happens to this?"                    [N]
├─ Sub-title  L357 → curInst.label                  [D, from CURRENT instance]
└─ Vendor-group badge  L358 → curInst.vendorGroup   [D]

Disposition grid (7 cards, one per DISPOSITION_ACTIONS entry)
L364-375
Per card:
  ├─ Action label  → DISPOSITION_ACTIONS[*].label   [L]
  ├─ Action hint   → DISPOSITION_ACTIONS[*].hint    [L]
  └─ On click: applyDisposition(curInst, action.id)

Notes textarea (optional)
L377-384
└─ "Notes (optional)" — value is captured at apply-time
     · Placeholder: "Add context about why this disposition was chosen..."
     · Commits at apply (NOT per-keystroke)

On apply (L390 applyDisposition):
  Creates OR updates a desired instance with:
    · state: "desired"                              [A, system-set]
    · layerId: curInst.layerId                       [A, mirrored from current]
    · environmentId: curInst.environmentId           [A, mirrored]
    · label: curInst.label  (+ " [RETIRE]" if action==="retire")  [A]
    · vendor / vendorGroup: mirrored                 [A]
    · disposition: <picked action>                    [A]
    · originId: curInst.id                            [A, system-set]
    · priority: "Now"  (default for new desired counterparts)  [A]
    · notes: <picker textarea value>                  [A]

  AND if ACTION_TO_GAP_TYPE[action] exists (everything except "keep"):
    Auto-drafts a gap via commitGapAdd(buildGapFromDisposition(...))
    → writes gap with derived description / gapType / urgency / phase /
      relatedCurrentInstanceIds=[curInst.id] / relatedDesiredInstanceIds=[desiredInst.id]
    → status: "open", reviewed: false, origin: "autoDraft"

  Then: commitSyncGapFromDesired(desiredInst.id) keeps linked gaps in
  line with phase/gapType/urgency drift.
```

## §9 · Detail panel  (when desired tile WITH disposition is clicked)

```
L635 showDetailPanel()

Header
├─ Title         L641  → instance.label                                  [D]
├─ Sub-title     L642  → instance.vendor || instance.vendorGroup         [D]
├─ Vendor-group badge  L643  → instance.vendorGroup                      [D]
│
└─ Origin mirror note  L647-654 (DESIRED-ONLY, when originId set)
     L652 → "Mirrors current: <source.label>"        [D, derived from originId join]

Form (desired-state-specific)
├─ Action dropdown  L665 → instance.disposition  [A, enum: ""/keep/enhance/replace/consolidate/retire/introduce/ops]
│     · empty option = "-- none --" (null in storage)
│     · labels rendered from DISPOSITION_ACTIONS catalog [L]
│
├─ Phase dropdown  L675 (HIDDEN when disposition === "keep")
│     → instance.priority  [A, enum: ""/Now/Next/Later, default "Next" for net-new]
│     · labels with months:
│         Now   "Now (0-12 months)"
│         Next  "Next (12-24 months)"
│         Later "Later (> 24 months)"
│     · tooltip: "Phase drives the roadmap column and the linked gap's phase."
│
└─ Notes textarea  L685 → instance.notes  [A]
      · Tab 3 placeholder hint: "Outcome, requirements, constraints..."

Action buttons
├─ Save changes  L688 → commitInstanceUpdate(inst.id, patch)
│                     · also calls commitSyncGapFromDesired(inst.id)
│                       to propagate desired-side changes to linked gaps
└─ Remove        L726 → commitInstanceRemove(inst.id)

Workload-only sub-section (§10, only if inst.layerId === "workload")
```

## §10 · Mapped infrastructure section  (workload tiles, identical to Tab 2 §8)

```
L747 buildMappedAssetsSection()
Same shape as Tab 2 §8 — only difference: walks i.state === "desired"
candidates when adding new mappings.

LINKED VARIANTS strip                                 [D, derived]
Mapped-asset rows                                     [D, derived]
"+ Map asset" button → §10b asset picker
"↑ Propagate criticality" button                       (if criticality + mapped > 0)
```

## §10b · Asset picker  (same shape as Tab 2 §8b, desired-state filter)

```
L835 openAssetPicker()
Writes: commitWorkloadMap(workload.id, [...existing, picked.id])
     → instance.mappedAssetIds[]  [A]
```

## §11 · "+ Add" button + Command palette  (per cell — identical to Tab 2 §6)

```
L471 openCommandPalette()
Same UI, same flow. Difference: writes state="desired" implicitly via Tab 3.
  Adds a net-new desired tile (no originId — not a mirror of a current item).
```

---

## Tab 3 · Data-point summary (delta from Tab 2)

| Path | Class | Where authored / displayed | Notes |
|---|---|---|---|
| `instance.state` | A | Implicit — Tab 3 always writes `state="desired"` | |
| `instance.layerId` / `environmentId` | A | Cell position (same as Tab 2) | |
| `instance.label` | A | §11 + Add palette OR §8 mirrored from current + " [RETIRE]" suffix on retire | |
| `instance.vendor` / `vendorGroup` | A | §11 palette OR §8 mirrored from current | |
| **`instance.disposition`** | **A** | §8 picker grid (7 catalog actions) OR §9 detail dropdown | enum: keep / enhance / replace / consolidate / retire / introduce / ops |
| **`instance.priority`** | **A** | §9 detail dropdown (when disposition ≠ keep) | enum: Now / Next / Later — phase-of-life, NOT criticality |
| `instance.notes` | A | §8 picker textarea OR §9 detail textarea | Placeholder: "Outcome, requirements, constraints..." |
| **`instance.originId`** | **A (system-set)** | §8 disposition apply sets it to `curInst.id` | Never directly edited; link from desired → the current it replaces |
| `instance.mappedAssetIds[]` | A | §10 mapped list + §10b picker (workload-only, desired-state filter) | |
| `instance.aiTag` | D | §7 "AI" badge | Same as Tab 2 |
| `engagement.meta.isDemo` | D | §1 demo banner | |
| `instance.criticality` (display only) | D | §6 ghost tile shape + §7 desired tile shape | Carried from origin via originId; not authored in Tab 3 |

### Side-effect writes (Tab 3 actions write to OTHER entities)

When a disposition is applied in §8, the system also writes to the `gaps` collection:

| Path | Class | When | Notes |
|---|---|---|---|
| `gap.description`, `gap.gapType`, `gap.urgency`, `gap.phase`, `gap.status`, `gap.origin`, `gap.relatedCurrentInstanceIds[]`, `gap.relatedDesiredInstanceIds[]`, `gap.layerId`, `gap.affectedLayers[]`, `gap.affectedEnvironments[]` | A (auto) | §8 apply (commitGapAdd via buildGapFromDisposition) | Creates a new gap record. Author can later edit / approve in Tab 4. Origin = "autoDraft". |

### Catalog-resolved labels used in display

- `LAYERS[*].{label}` — row headers + asset-row sub-labels
- `ENV_CATALOG[*].{label}` — column headers + env name fallback
- `DISPOSITION_ACTIONS[*].{label, hint}` — §8 picker cards + §9 dropdown options
- `CATALOG[layerId][*]` — §11 command palette catalog items

### Derived / computed values (no schema field)

- Ghost tile content — sourced from CURRENT instance whose desired counterpart doesn't exist
- Unreviewed-banner counts (M, N) — walked from `engagement.instances`
- "Mirrors current: <label>" — joins `originId → current instance.label`
- Criticality shape on desired tile — carried from origin via originId
- `[RETIRE]` suffix on `instance.label` for retire-action mirrors (L407) — applied at disposition time, persisted in the label

### Same as Tab 2 (no delta)

- §10/§10b workload mapping flow (different state filter only)
- §11 command palette structure
- AI tag badge behavior

---

## Wiring bugs / gaps surfaced in Tab 3

None — every Tab 3 surface traces cleanly. The disposition→gap auto-draft mechanism is a write to the `gaps` collection, fully documented under Tab 4.

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                       ◆  T A B   4   ◆   G A P S  ◆                           ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

# Tab 4 · Gaps

Rendered by `ui/views/GapsEditView.js`. Tab 4 is the biggest authoring surface — Kanban board with drag-drop, multi-dimensional filter bar, per-gap edit panel with services + linked-instances pickers, auto-drafted gap review flow, manual add dialog.

## §1 · Top banner (conditional)

```
└─ Demo-mode banner                                 (only if isDemo)
     L216-219 renderDemoBanner(left)
     └─ reads engagement.meta.isDemo                 [D]
```

## §2 · Empty-environments card

```
L226-229 renderEmptyEnvsCenterCard()
· static empty-state. Tab 4 stepper-disabled when 0 envs (SPEC §S41.2).
```

## §3 · Card header (top of left pane)

```
L232-238
├─ Title "Gaps and initiatives"                      [N]
├─ Help (?) button                                   [N]
└─ Hint "Each gap bridges current to desired state.
          Auto-drafted gaps appear when you set a disposition
          in Desired State. Drag cards between phases to re-prioritise." [N]
```

## §4 · FilterBar (5 multi-select dims + 2 toggles + trailing "+ Add gap" CTA)

```
L243-295 renderFilterBar()

Dimensions:
  ├─ Service          → filters by gap.services[] intersection            [filter on A]
  │     options = SERVICE_TYPES catalog                                   [L source]
  ├─ Layer            → filters by gap.affectedLayers OR gap.layerId
  │     options = LAYERS catalog                                          [L source]
  ├─ Environment      → filters by gap.affectedEnvironments[]
  │     options = _v3VisibleEnvs() — value=env.uuid, label=alias||catalog [L]
  ├─ Gap type         → filters by gap.gapType
  │     options = 5 static labels                                         [L]
  │     NOTE: ⚠ "newCap" option label is "New capability" but schema enum
  │           uses "introduce" — filter chip will never match. See WB-3.
  └─ Urgency          → filters by gap.urgency
        options = ["High","Medium","Low"]

Toggles:
  ├─ "Needs review only" — filter to gap.reviewed === false
  └─ "Show closed gaps (N)" — include gap.status === "closed"
                              N = derived count of closed gaps

Trailing:
  └─ "+ Add gap" button   L249 → opens Add gap dialog (§10)
```

## §5 · Auto-gap notice banner  (only when autoGaps.length > 0)

```
L337-366
├─ Message text                                       [D, derived]
│     "N of M gaps auto-drafted from Desired State dispositions not yet reviewed."
│     N = count(gap.origin === "autoDraft" && gap.reviewed === false && gap.status === "open")
│     M = total gap count
└─ "Review all →" button   L346
      · highlights (does NOT auto-select) every unreviewed auto-drafted gap card
```

## §6 · Kanban board

```
L388-518
3 fixed columns (one per phase enum value):

├─ Now (0-12 months)     · data-phase="now"
├─ Next (12-24 months)   · data-phase="next"
└─ Later (>24 months)    · data-phase="later"

Per column:
  ├─ Title                                            [N]
  ├─ Count badge                                      [D, derived: phGaps.length]
  └─ Cards body (drop zone)
       · Drag-drop: drop on phase column writes gap.phase
       · L506 commitGapUpdate(dragGapId, { phase: phId })
       · L508 commitSyncDesiredFromGap(dragGapId) propagates to linked desired instance(s)
```

## §7 · Gap card (kanban tile)

```
L520-655 buildCard()

CSS classes (derived from data):
  ├─ "selected"                  → matches selectedGapId             [D]
  ├─ "gap-card-auto"             → derived: no notes + has desired links  [D]
  ├─ "gap-needs-review"          → gap.reviewed === false             [D]
  └─ "crit-<urgency>"            → gap.urgency.toLowerCase()          [D, CSS only]

Data attributes (filter matching + targeting):
  ├─ data-gap-id                  → gap.id
  ├─ data-domain                  → pickGapDomain(gap)  [D, derived from services dominance]
  ├─ data-layer                   → gap.affectedLayers OR gap.layerId
  ├─ data-urgency                 → gap.urgency
  ├─ data-gapType                 → gap.gapType
  ├─ data-environment             → gap.affectedEnvironments.join(" ")
  └─ data-services                → gap.services.join(" ")

Card content:
  ├─ Pulsing review dot (only if gap.reviewed === false)              [D]
  ├─ Title              L580 → gap.description                        [D]
  ├─ Meta line          L583 "<layerLabel> - <gapType>? | <envLabels>?"  [D, all L]
  └─ Badges row:
       ├─ Urgency badge      → gap.urgency                            [D]
       ├─ Criticality shape  → gap.urgency-shaped icon                 [D]
       ├─ Program (driver) chip — IF effectiveDriverId(gap) resolves   [D, derived]
       │     · "★ <label>" if gap.driverId set (confirmed)
       │     · "☆ <label>" if auto-suggested (no gap.driverId)
       ├─ "Auto-drafted" badge (derived flag)                          [D]
       ├─ Solutions badge    → effectiveDellSolutions(gap)[0]          [D, derived]
       ├─ "Closed" badge      → gap.status === "closed"                [D]
       ├─ "N current" badge  → gap.relatedCurrentInstanceIds.length    [D]
       └─ "N desired" badge  → gap.relatedDesiredInstanceIds.length    [D]

Interactions:
  ├─ On click       → selects gap, opens detail panel (§8)
  ├─ On dragstart   → captures dragGapId for the drop zone
  └─ On dragend     → clears dragGapId
```

## §8 · Detail / edit panel (right pane)

```
L658-1188 renderDetail()

§8a · Status bar
├─ Urgency badge              → gap.urgency                          [D]
├─ Gap type badge             → gap.gapType                          [D]
└─ Status badge               → gap.status                           [D]

§8b · Title + sub-line
├─ Title    L672              → gap.description                      [D]
└─ Sub-line L675              → "<layerLabel> | <phaseLabel> | <envLabels>"  [D, all L]

§8c · Draft-issue chip (only if computeDraftIssue(gap) non-null)
└─ "REVIEW NEEDED" eyebrow + validateActionLinks message              [D, derived]

§8d · Closed status chip (only if gap.status === "closed")
├─ "CLOSED" eyebrow                                                  [N]
├─ Reason text                → gap.closeReason || "manually closed" [D]
└─ Reopen button → commitGapUpdate(gap.id, { status:"open", closeReason:undefined, closedAt:undefined })

§8e · Edit form

├─ Description textarea  L714  → gap.description  [A]
│
├─ Primary layer dropdown  L717  → gap.layerId  [A]
│     · options from LAYERS catalog [L]
│
├─ Also-affects chips row  L719-737  → gap.affectedLayers[]  [A]
│     · multi-toggle chips; saved as [primary, ...selectedOthers] (G6 invariant)
│
├─ Gap type field  L740-746  → gap.gapType  [A, conditional]
│     · If isAutoDrafted(gap) → READ-ONLY display
│     · Else → editable dropdown
│           options: "", enhance, replace, introduce, consolidate, ops
│
├─ Urgency group  L753-794  → gap.urgency + gap.urgencyOverride  [A, override-aware]
│     · If urgencyOverride=true → editable selector + "↺ auto" button
│     · Else → read-only display + "🔒 set manually" button + "↺ auto from linked current" indicator
│
├─ Phase dropdown  L795  → gap.phase  [A]  options: now / next / later
│
├─ Status dropdown  L797  → gap.status  [A]
│     options: open / in_progress / closed / deferred
│
├─ Strategic driver dropdown  L809  → gap.driverId  [A]
│     · options: "" (Unassigned) + each driver in engagement.drivers
│     · labels via BUSINESS_DRIVERS catalog [L]
│
├─ Auto-suggested driver chip  L817-839  (when no explicit driverId)
│     · "AUTO-SUGGESTED <label> because <reason>"                    [D, derived]
│     · "Pin this driver" button → commitGapSetDriverByBusinessDriverId
│
├─ Affected environments  L841-860  → gap.affectedEnvironments[]  [A]
│     · Multi-checkbox row; checkbox value = env.uuid
│
├─ Dell solutions (derived, read-only)  L865-871  → effectiveDellSolutions(gap)  [D, derived]
│
├─ Services group  L878-968  → gap.services[]  [A, multi-chip]
│     SUGGESTED row · greyed "+ <label>" chips, click to add (opt-in)
│     PICKED row    · full-color "<label> ✕" chips, click to remove
│     ADD picker    · dropdown of full SERVICE_TYPES (★ = suggested for current gapType)
│     · Labels via serviceLabel() from SERVICE_TYPES catalog [L]
│
└─ Notes textarea  L970  → gap.notes  [A]

§8f · Action buttons
├─ "✓ Approve draft" (only if reviewed === false)  L979
│     → commitGapUpdate(gap.id, { reviewed: true })  [A]
├─ Save changes  L989
│     → commitGapUpdate(gap.id, patch)
│     → commitGapSetDriverByBusinessDriverId(gap.id, driverIdChoice)
│     → commitSyncDesiredFromGap(gap.id)
└─ Delete  L1074  → commitGapRemove(gap.id) after confirm

§8g · Linked instances section (Phase 18: always visible)
L1099-1186

Current state sub-section
├─ Section title "Current state"                     [N]
├─ Linked rows (per gap.relatedCurrentInstanceIds[])
│   Each row L1190 buildLinkRow():
│     ├─ Vendor-group dot  → inst.vendorGroup       [D]
│     ├─ Instance label    → inst.label             [D]
│     ├─ Sub: "<layerLabel> / <envLabel>"            [D, L]
│     ├─ "linked to N gaps" chip (when N ≥ 2)        [D, derived via countGapsLinking]
│     ├─ × unlink → commitGapUnlinkCurrentInstance(gap.id, inst.id)
│     └─ On row click: dispatches "dell-canvas:navigate-to-tile" → Tab 2
│
└─ "+ Link current instance" → opens link picker (§11) for current

Desired state sub-section
├─ Section title "Desired state"                     [N]
├─ Linked rows (per gap.relatedDesiredInstanceIds[])
│   Same shape as Current; on click dispatches navigate-to-tile → Tab 3
│
└─ "+ Link desired instance" → opens link picker
      · L1160 confirmPhaseOnLink check — phase conflict triggers modal:
          "Reassign phase? Linking '<label>' will move its phase from X to Y."
      · commits with { acknowledged: true } if user confirms
```

## §9 · Right-pane placeholder

```
L1459 showPlaceholder()
└─ Static "Select a gap..." text                     [N]
```

## §10 · Add gap dialog (overlay)

```
L1291 openAddDialog()

Form fields:
  ├─ Description textarea  L1305  → gap.description           [A, required]
  ├─ Primary layer dropdown L1307 → gap.layerId               [A, required]
  ├─ Also-affects chips    L1314-1351 → gap.affectedLayers    [A]
  │     · Live-disables chip matching current primary
  ├─ Gap type dropdown     L1352  → gap.gapType                [A]
  │     · options: "", enhance, replace, introduce, consolidate, ops
  ├─ Urgency dropdown      L1355  → gap.urgency                [A, default Medium]
  └─ Phase dropdown        L1356  → gap.phase                  [A, default "next"]

Action buttons:
  ├─ Cancel
  └─ Create gap  L1363
        · commitGapAdd({ ..., status:"open", origin:"manual" })
        · reviewed defaults to false (schema)
        · selectedGapId = new gap (last in allIds)
```

## §11 · Instance link picker (overlay)

```
L1233 openLinkPicker()

Candidates: every instance in active engagement matching:
  i.state === stateFilter && !alreadyLinked

Per candidate row:
  ├─ Vendor-group dot  → inst.vendorGroup            [D]
  ├─ Instance label    → inst.label                  [D]
  ├─ Sub line          → "<layerLabel> / <envLabel>" [D, L]
  ├─ ⚠ warning row (only if already linked to ANOTHER gap)
  │     "<label> is already linked to Gap '<otherDesc>'. Linking
  │      here too will count toward both initiatives."   [D, derived]
  │
  └─ On click → onSelect(inst.id) → commit{Link}Current/Desired + close
```

---

## Tab 4 · Data-point summary

| Path | Class | Where authored / displayed | Notes |
|---|---|---|---|
| `gap.description` | A | §8e textarea (edit) · §10 dialog (create) | Required, ≥1 char |
| `gap.gapType` | A · D-when-autoDrafted | §8e dropdown (manual) · §10 dialog | Read-only when `isAutoDrafted(gap)`. Enum: enhance/replace/introduce/consolidate/ops |
| `gap.urgency` | A (when override) · D (when derived) | §8e override-aware urgency group | Derived from linked current's criticality unless override |
| `gap.urgencyOverride` | A | §8e 🔒/↺ buttons | Boolean toggle |
| `gap.phase` | A | §6 drag-drop · §8e dropdown · §10 dialog | Enum: now / next / later |
| `gap.status` | A | §8e dropdown · §8d Reopen button | Enum: open / in_progress / closed / deferred |
| `gap.reviewed` | A | §8f "Approve draft" button | Auto-drafted gaps start false |
| `gap.origin` | A (system-set) | §10 dialog "manual" · disposition apply (Tab 3) "autoDraft" | Provenance flag |
| `gap.notes` | A | §8e textarea | Free text |
| `gap.driverId` | A | §8e dropdown · §8e "Pin this driver" button | UUID FK to engagement.drivers |
| `gap.layerId` | A | §8e Primary layer · §10 dialog | Primary layer FK to LAYERS |
| `gap.affectedLayers[]` | A | §8e Also-affects chips · §10 dialog chips | Primary at index 0 (G6) |
| `gap.affectedEnvironments[]` | A | §8e env checkboxes | Array of env UUIDs |
| `gap.relatedCurrentInstanceIds[]` | A | §8g + Link / × unlink | FK array |
| `gap.relatedDesiredInstanceIds[]` | A | §8g + Link / × unlink + phase-conflict ack | FK array |
| `gap.services[]` | A | §8e picked/suggested chips + picker | FK array to SERVICE_TYPES |
| `gap.closeReason` | A (system-set) | §8d Reopen button clears | Only when status="closed" |
| `gap.aiMappedDellSolutions` | — | NOT authored in Tab 4 | Replaced by derived `effectiveDellSolutions` |

### Catalog-resolved labels used in display

- `LAYERS[*].{label}` — Primary layer dropdown, Also-affects chips, card meta, link-row sub-line, filter dim
- `ENV_CATALOG[*].{label}` (via env.alias fallback) — env checkboxes, card meta, link-row sub-line, filter dim
- `BUSINESS_DRIVERS[*].{label}` — Strategic driver dropdown, program-badge chip, auto-suggest chip
- `SERVICE_TYPES[*].{label, domain}` — Services chips, picker, filter dim, domain hue derivation

### Derived / computed values (no schema field)

- `isAutoDrafted(gap)` — from `gap.origin === "autoDraft"`
- `computeDraftIssue(gap)` — runs `validateActionLinks(gap as reviewed:true)` returns friendly error
- `effectiveDellSolutions(gap)` — walks linked desired instances filtered by vendorGroup="dell"
- `effectiveDriverId(gap)` — auto-suggested driver
- `effectiveDriverReason(gap)` — the "because <X>" auto-suggestion explanation
- `pickGapDomain(gap)` — dominant services-domain color hue
- `countGapsLinking(session, instId)` — for "linked to N gaps" multi-link chip
- `confirmPhaseOnLink` — phase-conflict detection on link
- Auto-gap notice counts — derived from gap origin + reviewed + status
- Per-column kanban counts — `phGaps.length`
- Closed badge count

### Side-effect writes (Tab 4 actions write to OTHER entities)

| Path | Class | When | Notes |
|---|---|---|---|
| `instance.priority` (desired) | A (system) | §6 drag-drop, §8g link with phase conflict, §8f Save | `commitSyncDesiredFromGap` propagates gap.phase → linked desired tile.priority |

---

## Wiring bugs / gaps surfaced in Tab 4

| ID | Surface | Field | Issue | Fix scope |
|---|---|---|---|---|
| **WB-3** | §4 FilterBar Gap-type dim | `gap.gapType` filter | L274-281 option list contains `"newCap"` but schema enum uses `"introduce"`. Filter chip "New capability" will never match any gap. The detail form's dropdown (L745) correctly uses `"introduce"`. | ~3 LOC swap "newCap" → "introduce" + label change. Add regression test. |

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                   ◆  T A B   5   ◆   R E P O R T I N G  ◆                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

# Tab 5 · Reporting

Tab 5 is a **read-only consumption surface** — every value on every sub-tab is *derived* from engagement data. Nothing is authored here. This makes it the most important reference for the Skill Builder's "Insights" data-point category, because every chip, score, and project card comes from a service computation that a skill author would want to bind to.

Rendered as a sub-tab shell with 5 sub-views, switched by `currentReportingTab` (`app.js` L673-715).

## §0 · Sub-tab bar (shared, top of left pane)

```
app.js L682-705
Five sub-tabs: Overview · Health · Gaps · Vendor · Roadmap
Click switches currentReportingTab + re-renders the chosen sub-view.
```

## §5.A · Overview sub-tab  (ReportingView.js)

```
§5.A.1 · Demo banner  (conditional)
  L22-23 → reads engagement.meta.isDemo                    [D]

§5.A.2 · Empty-environments card (when no visible envs)
  L30-33 renderEmptyEnvsCenterCard()
  · static empty-state — Tab 5 stepper-disabled when 0 envs.

§5.A.3 · Reporting overview header
  L42-49
  ├─ "Reporting overview" title                           [N]
  ├─ Help (?) button                                       [N]
  └─ Hint                                                  [N]

§5.A.4 · Two-panel health row  (left pane)
  L52-85

  Coverage panel
  ├─ "Discovery Coverage" eyebrow                          [N]
  ├─ Percent big number     → coverage.percent             [I] · computeDiscoveryCoverage(session).percent
  ├─ Bar fill width %        → coverage.percent             [I]
  └─ Hint list                → coverage.actions[]          [I]

  Risk panel
  ├─ "Risk Posture" eyebrow                                [N]
  ├─ Risk level pill         → risk.level (High/Medium/Low) [I] · computeRiskPosture(session).level
  └─ Hint list                → risk.actions[]              [I]

§5.A.5 · Stats strip  (4 raw counts, derived)
  L88-101
  ├─ summary.totalCurrent    "Current technologies"        [I] · getHealthSummary().totalCurrent
  ├─ summary.totalDesired    "Desired technologies"        [I]
  ├─ summary.totalGaps       "Total gaps"                  [I]
  └─ summary.highRiskGaps    "High-urgency gaps"           [I]

§5.A.6 · Strategic Drivers chips card  (only when drivers.length > 0)
  L130-146
  Per chip:
  ├─ Driver name → BUSINESS_DRIVERS.byId[driver.id].label  [L]
  └─ Priority chip → driver.priority                        [D]

§5.A.7 · Initiative pipeline card
  L149-173
  3 columns (Now / Next / Later):
    ├─ Initiative count        → sum(phProjects.initiatives.length)  [I]
    ├─ Project-group count     → phProjects.length          [I]
    └─ Per-project chip        → project.label + count      [I]

§5.A.8 · Session brief card  (RIGHT PANE)
  L106-126 (renders to RIGHT)
  ├─ "Session brief" title                                  [N]
  ├─ "↻ Refresh" button — re-runs generateSessionBrief(session) [N]
  └─ Brief body — per row from generateSessionBrief(session)
       ├─ Row label                                          [I]
       └─ Row text                                           [I]
```

## §5.B · Health sub-tab  (SummaryHealthView.js — heatmap)

```
§5.B.1 · Demo banner (conditional)
§5.B.2 · Overview card with chips + legend
  L33-72
  └─ Stats chips (5): totalBuckets / totalCurrent / totalDesired / totalGaps / highRiskGaps  [I]
  Legend swatches (4 static bands): No data / 1-3 Minor / 4-6 Moderate / 7+ High risk  [N]

§5.B.3 · Heatmap grid (left pane)
  L75-153
  Column headers (per visible env):
    ├─ E.NN code                                           [N]
    └─ Env name → getEnvLabel(env.id, session)              [L]
  Row headers (per LAYERS — 6 fixed):
    ├─ L.NN code                                           [N]
    ├─ Layer name                                           [L]
    └─ Color bar                                            [N]
  Cells (6 × N):
    Each cell shows computeBucketMetrics(layerId, envId, session):
    ├─ Score number    → Math.round(m.totalScore)          [I]
    ├─ Risk label      → scoreToRiskLabel(m.totalScore)     [I]
    └─ Footer pills (when hasData):
         ├─ "N tech" → m.current.length                     [I]
         └─ "N gap" → m.gaps.length                         [I]
    On click: opens detail panel (§5.B.4)

§5.B.4 · Cell detail panel (right pane)
  L179-263
  ├─ Title (layer label)                                    [L]
  ├─ Sub (env label)                                        [L]
  ├─ Risk badge → scoreToRiskLabel + score                  [I]
  ├─ Score breakdown → currentScore.toFixed(1) / gapScore   [I]
  ├─ Current technologies list (per inst):
  │     ├─ Vendor-group dot → instance.vendorGroup          [D]
  │     ├─ Label → instance.label                            [D]
  │     ├─ Criticality badge → instance.criticality           [D]
  │     └─ Notes (if present) → instance.notes                [D]
  ├─ Active gaps list (per gap):
  │     ├─ Urgency badge → gap.urgency                       [D]
  │     ├─ Description → gap.description                      [D]
  │     └─ Dell solutions → gap.mappedDellSolutions          [D] ⚠ legacy v2 field — see WB-4
  └─ Desired state list (per inst):
        ├─ Vendor-group dot → instance.vendorGroup           [D]
        ├─ Label → instance.label                             [D]
        └─ Disposition OR priority badge                      [D]
```

## §5.C · Gaps sub-tab  (SummaryGapsView.js — read-only kanban)

```
§5.C.1 · Demo banner (conditional)
§5.C.2 · Header card + FilterBar (mirrors Tab 4 vocabulary)
  L46-79
  Stats chips row (5):
    ├─ "N gaps total"                                       [I]
    ├─ "N High urgency"                                     [I]
    ├─ "Now: N"                                             [I]
    ├─ "Next: N"                                            [I]
    └─ "Later: N"                                           [I]
  SharedFilterBar — subscribes to global filterState (selections persist from Tab 4)

§5.C.3 · Read-only kanban
  L117-131
  3 columns (Now / Next / Later)
  Card per gap (simpler than Tab 4):
    ├─ Title → gap.description                               [D]
    ├─ Meta → "<layerLabel> · <gapType>"                     [D, L]
    └─ Badges: urgency + solutionsBadge[0] + Closed (when status)  [D + I]

§5.C.4 · Gap detail panel (right pane)
  L152-218
  ├─ Title → gap.description                                [D]
  ├─ Sub → "<phaseLabel> · <layerLabel>"                    [D, L]
  ├─ Badges: urgency + gapType + status                      [D]
  ├─ Mapped Dell solutions → effectiveDellSolutions          [I]
  ├─ Services needed → gap.services[] labels                  [L]
  ├─ Business context → gap.notes                            [D]
  └─ Affected layers → gap.affectedLayers[] labels            [L]
```

## §5.D · Vendor sub-tab  (SummaryVendorView.js — vendor mix analytics)

```
§5.D.1 · Demo banner (conditional)
§5.D.2 · Overview card (left pane top)
  L50-73
  ├─ Title "Vendor and platform mix"                       [N]
  ├─ View segmented ctrl — Current/Desired/Combined (stateFilter UI state)
  ├─ Legend (Dell / Non-Dell / Custom)                      [N]
  ├─ Layer chips row (multi-toggle)                         [UI state]
  └─ Stats chips: "Dell: N" / "Non-Dell: N" / "Custom: N"   [I]

§5.D.3 · Mix overview card (headline stacked bar)
  L107-141
  ├─ "Stack by" chips (Vendor / Layer / Environment)        [UI state]
  ├─ 100% stacked horizontal bar
  │     · segments from computeStackData(dim, state, layers, envs)  [I]
  │     · click-to-filter
  └─ Legend                                                 [I]

§5.D.4 · Headline insights KPI grid (3 tiles)
  L150-154 renderKpis()
    ├─ Dell density %                                       [I]
    ├─ Most diverse layer                                   [I]
    └─ Top non-Dell concentration                           [I]
  Click any → vendor detail in right pane

§5.D.5 · Collapsible "All instances by vendor" table
  L158-176
  Rows from computeVendorTableData:
    ├─ Vendor name (distinct instance.vendor)               [I]
    ├─ Per-layer counts                                     [I]
    └─ Total                                                [I]
  Click row → instance breakdown in right pane

§5.D.6 · Right pane vendor drill (when row/KPI clicked)
  Per instance row:
    ├─ Label → instance.label                               [D]
    ├─ Layer/env sub → resolved labels                       [L]
    └─ Vendor → instance.vendor                              [D]
```

## §5.E · Roadmap sub-tab  (SummaryRoadmapView.js — crown jewel)

```
§5.E.1 · Demo banner (conditional)
§5.E.2 · Header card "Roadmap"                              [N]
§5.E.3 · Empty-state card (when no gaps)                    [N]

§5.E.4 · Portfolio pulse bar
  L110-128 buildPulseBar()
  Five stats:
    ├─ projects.length         "projects"                    [I]
    ├─ counts.now              "Now"                         [I]
    ├─ counts.next             "Next"                        [I]
    ├─ counts.later            "Later"                       [I]
    └─ unreviewedCount         "unreviewed gaps"             [I]

§5.E.5 · Swimlane × phase grid (main left-pane)
  L62-104
  Header: blank corner + 3 phase columns                    [N]
  Per swimlane (driver row + Unassigned lane):
    Swimlane header:
      ├─ Driver label → BUSINESS_DRIVERS.byId[d.id].label   [L]
      ├─ Priority chip → driver.priority                      [D]
      ├─ Aggregate urgency shape (max across lane's projects) [I]
      └─ Project count                                       [I]
      click → §5.E.7 driver detail
    Cells (3 per row, sorted urgency desc + gapCount desc):
      Per project card (buildProjectCard):
        ├─ Project name → proj.name                          [I]
        ├─ Urgency badge → proj.urgency                       [I]
        ├─ Criticality shape                                  [I]
        ├─ Gap count badge → proj.gapCount                    [I]
        ├─ Dell solutions chips → proj.dellSolutions[]        [I]
        └─ Services needed chips → proj.services[] labels     [L, derived]
      click → §5.E.6 project detail

§5.E.6 · Project detail panel (right pane)
  L244-321
  ├─ Title → proj.name                                      [I]
  ├─ Sub → "<gapCount> gap(s) · phase <phase>"               [I]
  ├─ Badges → urgency + criticality shape                    [I]
  ├─ "Also affects" envs (when envs > 1)                     [I, derived from constituent gaps]
  ├─ Dell solutions mapped → proj.dellSolutions[]            [I]
  ├─ Constituent gaps list                                   [D, per gap]
  └─ Linked technologies count (unique instance ids across gaps)  [I]

§5.E.7 · Driver detail panel (right pane, swimlane head click)
  L337-392
  ├─ Title → BUSINESS_DRIVERS.byId[d.id].label              [L]
  ├─ Sub → BUSINESS_DRIVERS.byId[d.id].shortHint             [L]
  ├─ Badges → priority + project count                       [D + I]
  ├─ Business outcomes → driver.outcomes                     [D]
  ├─ Program snapshot:
  │     · Aggregate urgency                                  [I]
  │     · % with Dell solutions mapped                       [I]
  └─ Projects in this program list                          [D]

§5.E.8 · Unassigned detail panel (right pane)
  L395-424
  ├─ Title "Unassigned projects"                            [N]
  ├─ Project count                                          [I]
  └─ Per-project rows                                        [D]
```

---

## Tab 5 · Data-point summary

| Path | Class | Where displayed | Notes |
|---|---|---|---|
| (no authored fields) | — | — | Tab 5 is purely read-only |

### Derived insights (the most important class for Tab 5)

| Insight path | Source service | Used in |
|---|---|---|
| `coverage.percent` | `roadmapService.computeDiscoveryCoverage` | §5.A.4 big number + bar fill |
| `coverage.actions[]` | same | §5.A.4 hint list |
| `risk.level` | `roadmapService.computeRiskPosture` | §5.A.4 pill |
| `risk.actions[]` | same | §5.A.4 hint list |
| `summary.totalCurrent` | `healthMetrics.getHealthSummary` | §5.A.5, §5.B.2 |
| `summary.totalDesired` | same | §5.A.5, §5.B.2 |
| `summary.totalGaps` | same | §5.A.5, §5.B.2 |
| `summary.highRiskGaps` | same | §5.A.5, §5.B.2 |
| `summary.totalBuckets` | same | §5.B.2 |
| `bucketMetrics(layer,env).totalScore` | `healthMetrics.computeBucketMetrics` | §5.B.3 cell score |
| `bucketMetrics.currentScore` | same | §5.B.4 |
| `bucketMetrics.gapScore` | same | §5.B.4 |
| `bucketMetrics.current[]` / `.gaps[]` | same | §5.B.4 lists |
| `projects[*].name / .phase / .urgency / .gapCount / .dellSolutions[] / .services[] / .gaps[] / .initiatives[]` | `roadmapService.buildProjects` | §5.A.7, §5.E.5, §5.E.6 |
| `groupedByProgram` | `programsService.groupProjectsByProgram` | §5.E.5 swimlanes |
| `unreviewedGapsCount` | inline gap-walk | §5.E.4 pulse bar |
| `effectiveDellSolutions(gap)` | `programsService.effectiveDellSolutions` | §5.C, §5.E.5, §5.E.6 |
| `vendorMix.dellDensity` / `.mostDiverseLayer` / `.topNonDellConcentration` | `vendorMixService` | §5.D.4 KPIs |
| `vendorTableData[]` | `vendorMixService.computeVendorTableData` | §5.D.5 table |
| `stackData(dim, state, layers, envs)` | inline (computeStackData) | §5.D.3 headline bar |
| `generateSessionBrief(session)` | `roadmapService.generateSessionBrief` | §5.A.8 brief rows |
| `scoreToRiskLabel(score, hasData)` | `healthMetrics.scoreToRiskLabel` | §5.B.3, §5.B.4 |

### Catalog-resolved labels used in display

- `LAYERS[*].{label}` — heatmap rows, swimlane grid, instance/gap meta
- `ENV_CATALOG[*].{label}` (via env.alias fallback) — heatmap columns, env chips, "Also affects" chips
- `BUSINESS_DRIVERS[*].{label, shortHint}` — driver chips, swimlane headers, driver detail
- `SERVICE_TYPES[*].{label}` — services chips on gap detail + project card
- `DISPOSITION_ACTIONS[*].{label}` — §5.B.4 desired list disposition badges

### Side-effect writes

**None.** Tab 5 is read-only.

---

## Wiring bugs / gaps surfaced in Tab 5

| ID | Surface | Field | Issue | Fix scope |
|---|---|---|---|---|
| **WB-4** | §5.B.4 cell-detail Active-gaps row | `gap.mappedDellSolutions` (legacy v2 field) | SummaryHealthView.js L238 reads the legacy v2 field name `gap.mappedDellSolutions` which doesn't exist in the v3 schema (v3 uses `gap.aiMappedDellSolutions` or the derived `effectiveDellSolutions(gap, session)`). This row will always render empty in v3 sessions. | ~2 LOC swap to `effectiveDellSolutions(gap, session).join(", ")`. Add regression test V-SUMMARY-HEALTH-1. |

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║          ◆  G L O B A L   S H E L L   ◆   topbar / footer / overlays  ◆      ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

# Global shell · Topbar / footer / Canvas Chat overlay / Settings / Help

The shell wraps every tab — topbar, stepper, footer, plus three overlays (Canvas Chat / Settings / Help) and one save-status broadcaster. Most of the shell is non-data UI plumbing; the few authored data points are flagged.

## §G.1 · Topbar header  (`index.html` L38-118 + `app.js` renderHeaderMeta L392-484)

```
Brand block (left, fixed)
├─ Dell Technologies logo                              [N]
├─ 1px vertical divider                                [N]
├─ "Discovery Canvas" title (T1)                       [N]
└─ "Solutions architecture workshop" sub (T2)          [N]

Session strip (center)
· sessionMetaHeader · L399 renderHeaderMeta()
├─ Building icon                                       [N, SVG]
├─ Customer name line                                  [D]
│     · engagement.customer.name OR
│     · "Demo session" when meta.isDemo
│     · "New session" when neither set
├─ Vertical divider                                    [N]
├─ Status line (renderSessionStripStatus L500)
│   ├─ Status dot (color by state)                     [D]
│   └─ Status text                                      [D, derived]
│       Priority:
│         · isDemo=true                 → "Demo session" / Dell-blue dot
│         · status=saving (transient)   → "Saving…"      / amber
│         · status=saved + savedAt      → "Saved Xs ago" / green
│         · has customer.name           → "Not yet saved" / gray
│         · nothing yet                 → "Empty canvas" / gray
├─ Vertical divider (only when savedAt exists)         [N]
└─ "Updated HH:MM" eyebrow + value                      [D, formatted savedAt]
     · HH:MM if today; "MMM DD HH:MM" otherwise

Topbar actions (right)
├─ AI Assist button (sparkle icon + glow animation)     [N]
│     · click → opens Canvas Chat overlay (§G.6)
│     · Cmd+K / Ctrl+K shortcut
├─ Undo chip (only when aiUndoStack.depth > 0)
│     · Count badge                                     [D, derived from aiUndoStack]
│     · click → reverts last AI mutation
├─ Undo all chip (only when depth > 1)
│     · click → confirm modal + reverts entire undo stack
└─ Settings gear button                                 [N]
      · click → opens Settings modal (§G.7)
```

## §G.2 · Stepper navigation  (`index.html <nav id="stepper">`, `app.js` renderStepper L616-660)

```
5 STEPS array — each gets a clickable pill:
├─ "01 Context"                                         [N]
├─ "02 Current state"                                   [N]
├─ "03 Desired state"                                   [N]
├─ "04 Gaps"           (disabled when 0 visible envs)   [I, derived]
└─ "05 Reporting"      (disabled when 0 visible envs)   [I, derived]

Per pill:
├─ Mono leading number "01"–"05"                        [N]
├─ Sentence-case label                                  [N]
├─ "active" class on the matching currentStep           [D, UI state]
└─ click → switches currentStep + renderStage()

Tabs 4 + 5 are STEPPER-DISABLED when visibleEnvCount === 0 (SPEC §S41.2).
```

## §G.3 · Main render area  (`<div id="main">`)

```
Two-pane split:
├─ #main-left   — populated by current tab's render fn
└─ #main-right  — populated by current tab's render fn

Each tab's renderXxxView function takes (left, right) and writes
its content into these two DOM nodes. The shell never paints
inside #main itself.
```

## §G.4 · Footer  (`index.html` L127-175 + `app.js` wireFooter L718)

```
Left action group:
├─ "Save to file" (download icon)
│     · buildSaveEnvelope → file download
│     · Default: API keys STRIPPED (SPEC §S26)
├─ "Open file" (upload icon)
│     · Opens hidden #openFileInput
│     · Parses .canvas → applyEnvelope → migrator → engagementStore
├─ "Load demo" (play-circle)
│     · Writes v3-native Northstar Health Network demo + meta.isDemo=true
├─ "New session" (plus icon)
│     · setActiveEngagement(createEmptyEngagement())
└─ "Clear all data" (trash icon, destructive)
      · Wipes every dell_discovery_* + ai_* localStorage key + reloads

Center: "Auto-saved to browser · data stays on your device"  [N]

Right: APP_VERSION chip                                  [D, "Canvas v3.0.0-rc.8-dev"]
       · Reads APP_VERSION from core/version.js
```

## §G.5 · Demo banner component  (`ui/components/DemoBanner.js`)

```
Conditional banner above any tab's content when meta.isDemo=true.
├─ Eyebrow "Demo mode"                                  [N]
└─ Body "You're viewing example data..."                 [N]

Reads engagement.meta.isDemo                            [D]
Auto-flips off when the user authors a non-empty customer.name.
```

## §G.6 · Canvas Chat overlay  (`ui/views/CanvasChatOverlay.js`)

```
Opens via topbar "AI Assist" button OR Cmd+K / Ctrl+K shortcut.
Modal overlay, full-height right-side drawer.

Header strip
├─ "Canvas AI Assistant" title                          [N]
├─ Provider dropdown (Claude / OpenAI-compat)           [A, settings-level]
│     · Reads/writes ai.provider in localStorage
├─ Clear button                                         [N, clears chat history]
├─ Lock icon (provider key status)                      [D]
└─ ✕ close                                              [N]

Tab strip (R5 system per SPEC §S46.7 + RULES §16 CH36.f)
· Permanent tabs:
  ├─ Chat tab           — conversational surface
  └─ Skills tab         — saved-skills launcher
· Dynamic tab (single-skill invariant per CH36.g):
  └─ [Skill: <name>]    — appears when a skill is launched;
                          replaces any prior skill tab

─── Chat tab ──────────────────────────────────────────
  ├─ Message bubbles (user / assistant)                 [D, ephemeral]
  │     · NOT persisted to engagement schema
  │     · Browser session memory only
  ├─ Streaming indicator                                [N]
  └─ Composer
       ├─ Multi-line textarea                           [N, ephemeral]
       ├─ Send button                                   [N]
       └─ Enter-to-send / Shift+Enter for newline       [N]

  System-prompt assembly (services/systemPromptAssembler.js):
  Every chat turn is grounded in core/dataContract.js — the
  constitution. First-turn handshake (SPEC §S20.16) verifies the
  LLM loaded the contract.

─── Skills tab ────────────────────────────────────────
  L915-1003 renderSkillsLauncher()
  ├─ "Saved skills" eyebrow                             [N]
  ├─ Per-skill row card:
  │   ├─ Skill name                                     [D, skill.name]
  │   ├─ Skill description                              [D, skill.description]
  │   ├─ Output-format badge                            [D, skill.outputFormat]
  │   └─ "Run" button → opens dynamic [Skill: <name>] tab
  ├─ "+ Author new skill" CTA → opens Skill Builder
  └─ Source: v3SkillStore (schema/skill.js v3.2)

─── [Skill: <name>] tab (dynamic, single-skill invariant) ─
  L1050+ renderSkillPanelForRun()
  Right rail
  ├─ Skill metadata (name + description + output format)
  ├─ Parameters editor (per-skill params)
  │     · Per parameter type: string / number / boolean / file
  │     · Field [A] value is EPHEMERAL run-time input
  └─ "Run skill" button

  Center pane
  ├─ Pre-run: empty / instructions                       [N]
  └─ Post-run:
       · AI response rendered via _appendSkillDialogTurn  [D, ephemeral]
       · For mutation skills (SPEC §S46.10):
            Mutation preview cards · per-instance proposed change
            · "Approve" + "Reject" buttons (ask policy)
            · OR auto-applied (auto-tag policy)
            · On apply: applyMutations writes instance.aiTag + target field
            · Shows "Done by AI" badge on affected MatrixView tiles
            · aiTag cleared on next engineer save of the same instance

Data points authored via overlay:
  · None directly — chat is ephemeral, skill params are ephemeral.
  · Side-effect via mutation skills: writes instance.aiTag + target
    field on instance (SPEC §S46.11). Routed through state/adapter.js.

⚠ Constitutional anchor: the entire chat plane (system prompt + tool
calls + skill runtime) MUST read from core/dataContract.js. This is
the surface the rc.8.b drift broke and the constitutional arc (R12)
reinstates.
```

## §G.7 · Settings modal  (`ui/views/SettingsModal.js`)

```
Opens via topbar gear button.

Provider configuration tabs:
├─ Claude tab
│     ├─ API key input (password)                        [A, localStorage `ai_claude_key`]
│     │     · NEVER stored in engagement schema; runtime-only
│     └─ Model selector                                  [A, localStorage]
└─ OpenAI-compat tab (Gemini / vLLM / local)
      ├─ Base URL input                                  [A, localStorage]
      ├─ API key input                                   [A, localStorage]
      └─ Model selector                                  [A, localStorage]

Test connection button                                  [N, probes provider]
Save / Close                                            [N]

Path: localStorage keys with `ai_*` prefix. NOT part of the engagement
schema. Cleared by "Clear all data" footer button.
```

## §G.8 · Help modal  (`ui/views/HelpModal.js`)

```
Opens via per-tab "(?)" button (every card-title-row has one).
Each tab calls helpButton("<topic_id>"); modal renders the matching topic.

Topics indexed today:
· context, current, desired, gaps
· reporting_overview, reporting_health, reporting_gaps,
  reporting_vendor, reporting_roadmap

Content: static prose + hints. No engagement-data binding.
```

## §G.9 · Toast / Notify  (matrix-toast, notifyError, confirmAction)

```
Three transient surfaces:
├─ matrix-toast — bottom toast (success / error), 2.8s auto-fade
├─ notifyError({ title, body }) — error overlay
└─ confirmAction({ title, body, confirmLabel, danger? }) — promise-returning
      · Used for: remove driver with outcomes, hide env, delete gap,
        load demo over existing work, etc.

None bind to engagement-schema fields.
```

## §G.10 · Save-status broadcaster  (`services/saveStatus.js`)

```
Module-level event bus:
├─ status: "idle" / "saving" / "saved"                   [I, UI state]
├─ savedAt: ISO timestamp of last successful persist      [I]
└─ Subscribers:
     · renderSessionStripStatus (§G.1 status line)
     · updateTabTitle (browser tab title prefix)
     · 30s interval re-renders ("Saved 2m ago" → "Saved 3m ago")

Every commitAction success calls _persist + markSaved(); broadcaster emits.
Topbar status updates in < 300ms.
```

## §G.11 · PWA file launchQueue  (`app.js` L209)

```
When Canvas is installed as a PWA + user double-clicks a .canvas file,
Chromium's launchQueue delivers the file handle. Routes through the
same #openFileInput change pipeline used by the footer "Open file"
button. One code path for file loading.

No data points authored directly — runs the apply-envelope flow.
```

## §G.12 · Cross-tab navigation event  (`dell-canvas:navigate-to-tile`)

```
Dispatched by:
· Tab 4 §8g linked-instance row click → "navigate to tile"
· Tab 2/3 §8 LINKED VARIANTS chip click → same
Listened by:
· app.js L188 → switches currentStep to "current" or "desired" +
  scrolls the matching tile into view with brief highlight

Pure UI plumbing — no data writes.
```

---

## Global shell · Data-point summary

| Path | Class | Where authored / displayed | Notes |
|---|---|---|---|
| Settings localStorage keys (`ai.provider`, `ai_claude_key`, etc.) | A | §G.7 Settings modal | Runtime config, NOT in engagement schema |
| `engagement.meta.isDemo` | D | §G.1 status text + §G.5 demo banner | Read across many shells |
| `engagement.customer.name` | D | §G.1 customer name strip | Read-only here; authored on Tab 1 §2 |
| (save status from `saveStatus.js`) | I | §G.1 status dot + text | Derived from commitAction lifecycle |
| `APP_VERSION` (constant) | D | §G.4 version chip | From `core/version.js` |
| (aiUndoStack depth) | I | §G.1 undo chips visibility | Derived from undo-stack mutation history |
| (ephemeral chat messages) | A | §G.6 chat composer | NOT persisted in engagement schema |
| (ephemeral skill parameters) | A | §G.6 skill run pane | NOT persisted; one-time run inputs |
| `instance.aiTag` | A (system) | §G.6 mutation skill apply | Written via applyMutations; cleared on next save |
| (target field of mutation skill) | A (system) | §G.6 mutation skill apply | Per-skill — whatever the skill is licensed to mutate |

### Catalogs used in display

None directly in the shell. Per-tab views consume catalogs.

### Side-effect writes

| Path | When | Notes |
|---|---|---|
| `engagement.*` (whole-engagement replacement) | §G.4 "Open file" / "Load demo" / "New session" | Full document write via setActiveEngagement |
| `engagement.*` | §G.4 "Clear all data" | localStorage wipe + reload |
| `instance.aiTag` + target field | §G.6 mutation skill apply (R7) | Via state/adapter.js |
| (everything) | Auto-persist on every commitAction success | `engagementStore._persist()` after each successful commit |

---

## Wiring bugs surfaced in Global shell

None — the shell traces cleanly. Notable observations (not bugs):

- The chat conversation is ephemeral by design. If you want chat history persisted per engagement, that's a v3.1 schema amendment.
- Skill parameter values are ephemeral by design (one-time run inputs).
- Settings (`ai_*` localStorage keys) are deliberately OUTSIDE the engagement file — keys never travel with a `.canvas` file unless the user explicitly opts in.

---

# Consolidated wiring-bug summary (all tabs + shell)

These four are the candidates for the **C10 hygiene commit** during the constitutional/contract-fidelity arc.

| ID | Location | Field | Issue | Fix scope |
|---|---|---|---|---|
| **WB-1** | Tab 1 §2 (`ContextView.js` L101-105) | `engagementMeta.presalesOwner` | UI input exists, writes ignored (stale "v3 hasn't grown the field" comment) | ~10 LOC to wire commitEngagementMetaEdit + remove the comment |
| **WB-2** | Tab 1 §2 (missing) | `customer.notes` | Schema field exists, migrator uses it, no UI input today | ~5 LOC to add a textarea inside the Context card form |
| **WB-3** | Tab 4 §4 (`GapsEditView.js` L274-281) | `gap.gapType` filter option | Filter option uses `"newCap"` but schema enum is `"introduce"` — chip "New capability" never matches | ~3 LOC swap "newCap" → "introduce" + label change + regression test |
| **WB-4** | Tab 5 §5.B.4 (`SummaryHealthView.js` L238) | `gap.mappedDellSolutions` (legacy v2 field) | Reads a v2 field that doesn't exist in v3; row always empty in v3 sessions | ~2 LOC swap to `effectiveDellSolutions(gap, session).join(", ")` + regression test |

---

## Revision log

| Revision | Date | Author | Scope |
|---|---|---|---|
| r1 | 2026-05-11 | Claude | Initial document. Tab 1 (Context) complete. Tabs 2–5 + shell pending. Two wiring bugs flagged (WB-1, WB-2). |
| r2 | 2026-05-11 | Claude | Added Tab 2 (Current state). ASCII banner dividers added per tab. Tabs 3–5 + shell still pending. No new wiring bugs surfaced in Tab 2. |
| r3 | 2026-05-11 | Claude | Added Tab 3 (Desired state). Ghost-tile + disposition-picker + auto-gap-drafting flow documented. Tabs 4–5 + shell still pending. No new wiring bugs surfaced. |
| r4 | 2026-05-11 | Claude | Added Tab 4 (Gaps). Kanban + filter bar + 8-section detail panel + linked-instances pickers + Add gap dialog + link picker documented. Tab 5 + shell still pending. WB-3 surfaced (`newCap` filter mismatch vs schema `introduce`). |
| r5 | 2026-05-11 | Claude | Added Tab 5 (Reporting) with 5 sub-views (Overview / Health / Gaps / Vendor / Roadmap). Comprehensive derived-insights catalog compiled — the foundation for the Skill Builder "Insights" data-point category. Shell still pending. WB-4 surfaced (`gap.mappedDellSolutions` legacy v2 field in SummaryHealthView). |
| r6 | 2026-05-11 | Claude | Added Global shell (topbar / stepper / footer / Canvas Chat overlay / Settings / Help / Toast / save-status / PWA launchQueue / navigate-to-tile event). Consolidated wiring-bug summary table (WB-1..WB-4). Document **COMPLETE** — ready to anchor the constitutional/contract-fidelity arc. |

## Hash computation rule

The hash on line 4 is FNV-1a 32-bit (8-hex), computed over the **entire file content** with the literal string `__HASH_HERE__` in place of the hash value. This makes the hash deterministic and reproducible: any revision recomputes by resetting the value to `__HASH_HERE__`, hashing the file, then replacing the placeholder with the computed value.

Algorithm reference: matches `fnv1a8()` in `core/dataContract.js` (the constitutional checksum function).
