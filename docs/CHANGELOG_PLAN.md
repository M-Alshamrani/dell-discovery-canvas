# Dell Discovery Canvas — Planned Feature Changes

Working document. Each tab's requirements are collected here as they are discussed.
Status flow: **DRAFT → PENDING APPROVAL → APPROVED → IMPLEMENTED**.
Once all tabs collected, this document will be rebuilt into a clean changelog.

---

## Tab 1 · Context — Status: **APPROVED** (2026-04-18)

### Locked decisions
- **Priority wording**: High / Medium / Low.
- **Driver list**: 8 drivers as drafted (AI & Data Platforms, Cyber Resilience, Cost Optimization, Cloud Strategy, Modernize Aging Infrastructure, Operational Simplicity, Compliance & Sovereignty, Sustainability / ESG).
- **Conversation starters**: drafted below — user to review & tweak wording.
- **`primaryDriver` field**: dropped. Reporting aggregates from `customer.drivers[]`.
- **Remove confirmation**: only confirm if outcomes text is non-empty.
- **Vertical ordering**: alphabetise the full list (Education, Energy, Enterprise, Financial Services, Government & Security, Healthcare, Public Sector, SMB, Telecommunications, Utilities).

### Draft conversation starters (for review)

| Driver | Short hint | Conversation starter |
|---|---|---|
| **AI & Data Platforms** | "We need to get real value from AI and our data, fast." | "Where would a ready-to-use AI or data platform create measurable business value in the next 12 months — and what is blocking you from starting today?" |
| **Cyber Resilience** | "We must recover from attacks without paying, and prove it." | "If ransomware hit your most critical system tomorrow, what is your recovery time — and when did you last test the full playbook end-to-end?" |
| **Cost Optimization** | "Cut infrastructure spend without breaking delivery." | "If you had to take 20% out of infrastructure spend over the next 24 months, which layer would you attack first and what is stopping you?" |
| **Cloud Strategy** | "Right workload, right place — stop cloud bills spiralling." | "Which workloads have surprised you most with their cloud bill — and are any of them candidates to come back on-prem or to a private platform?" |
| **Modernize Aging Infrastructure** | "Too much of our estate is old and fragile." | "What is the oldest piece of infrastructure that keeps your team up at night — and why hasn't it been replaced yet?" |
| **Operational Simplicity** | "The team is firefighting; we want fewer tools and less toil." | "What percentage of your team's week goes to reactive firefighting versus planned improvement work — and where does most of the noise come from?" |
| **Compliance & Sovereignty** | "Auditors and regulators are getting strict; we must be ready." | "Which compliance or data-sovereignty frameworks bite you hardest today — and where are your biggest evidence gaps if an audit landed this quarter?" |
| **Sustainability / ESG** | "Leadership is committed to measurable energy / carbon targets." | "What energy-efficiency or carbon targets has leadership committed to — and how are you measuring infrastructure's contribution today?" |

### Summary of requested changes
1. App landing page should be the Context tab (currently lands on Reporting).
2. Add **Energy** and **Utilities** to the Vertical / Segment dropdown.
3. Rework the Business Drivers: replace the single dropdown with a Gartner-aligned, plain-language driver catalog that the presales can **add multiple drivers from** (like the Current-State tile-add pattern). Each added driver is removable.
4. Each driver, when clicked after being added, shows on the right panel:
   - The **conversation starter** mapped to that driver (replacing today's single static starter).
   - A **form** capturing per-driver **priority** (dropdown) and **business outcomes** (free-text, auto-bulleting on Enter).
5. Business outcomes move from a session-level field to a **per-driver** field.

---

### My understanding (data + UX contract)

#### 1. Landing page
- On first DOM-ready, `currentStep` must default to `"context"` (not `"reporting"`).
- Pre-existing sessions that already have data can still open on Context — no special migration case.

#### 2. Vertical / Segment list
- Add `"Energy"` and `"Utilities"` to `CUSTOMER_VERTICALS` in [core/config.js](dell-discovery/core/config.js).
- Order preserved; append at the end (or grouped if you prefer — open question).

#### 3. Business Drivers catalog (Gartner-aligned, plain English)
- Replace the current 8-item list with a curated CxO-priority set. **Proposed** (you approve / edit):
  - **AI & Data Platforms** — "We need to get real value from AI and our data, fast."
  - **Cyber Resilience** — "We must recover from attacks without paying, and prove it."
  - **Cost Optimization** — "Cut infrastructure spend without breaking delivery."
  - **Cloud Strategy** — "Right workload, right place — stop cloud bills spiralling."
  - **Modernize Aging Infrastructure** — "Too much of our estate is old and fragile."
  - **Operational Simplicity** — "The team is firefighting; we want fewer tools and less toil."
  - **Compliance & Sovereignty** — "Auditors and regulators are getting strict; we must be ready."
  - **Sustainability / ESG** — "Leadership is committed to measurable energy / carbon targets."
- Each driver needs: `id`, `label`, `shortHint` (the plain-English one-liner above), `conversationStarter` (the existing `COACHING_PROMPTS` pattern, expanded to match the new list).

#### 4. Driver-add UX (mirrors Current-State "+ Add" tile flow)
- The Context tab gets a **"Your drivers"** area with a `+ Add driver` button.
- Clicking `+ Add driver` opens a catalog picker (same command-palette pattern as tile-add in MatrixView — keyboard nav with ↑/↓/Enter, Esc to close, search-filterable) listing the driver catalog.
- Selecting a driver adds it as a **driver-tile** in the "Your drivers" area.
- Each driver-tile has:
  - Label + short hint beneath it.
  - An `×` remove button (confirm before remove? — open question; I'd say yes if it has outcomes entered, skip confirm if empty).
- Clicking a driver-tile selects it and renders its detail on the **right panel**:
  - **Conversation starter** (top card, same styling as today).
  - **Priority** dropdown: `High | Medium | Low` (open question — do you want "Now / Next / Later" to match the rest of the app, or the business-style High / Medium / Low?).
  - **Business outcomes** textarea — auto-bulleting: when the user presses Enter, a new line starts with `• `. Backspacing the bullet removes it. If the field is empty on first keystroke, a `• ` is inserted automatically. Save happens on blur or Save-button click.

#### 5. Data model changes (session shape)
Current:
```
customer.primaryDriver: string
businessOutcomes:       string  // session-level
```
New:
```
customer.drivers: [
  {
    id:        string,     // e.g. "ai_data"
    priority:  "High" | "Medium" | "Low",    // (or Now/Next/Later — pending your call)
    outcomes:  string      // free text with "• " bullets
  },
  ...
]
```
- Keep `customer.primaryDriver` as a **derived / optional** convenience field (highest-priority driver) — or remove entirely (open question; affects Reporting if it reads `primaryDriver`).
- **Migration**: on load, if `customer.primaryDriver` exists and `customer.drivers` is missing, create `drivers = [{ id: <mapped id>, priority: "High", outcomes: session.businessOutcomes || "" }]`. Then drop the old fields on next save.

---

### Functional test criteria (to become Suite 12 additions and new assertions)

Each item below maps to an assertion I'd add to `diagnostics/appSpec.js`:

**Landing**
- T1.1 On page load with no URL hash, the stepper's active step is "Context".

**Vertical list**
- T1.2 `CUSTOMER_VERTICALS` includes `"Energy"` and `"Utilities"`.
- T1.3 The Vertical `<select>` in ContextView renders options matching `CUSTOMER_VERTICALS` length.

**Driver catalog**
- T1.4 `BUSINESS_DRIVERS` (renamed structure) exports an array of objects, each having `{ id, label, shortHint, conversationStarter }`.
- T1.5 Every driver has a non-empty `conversationStarter` (no dangling blanks).

**Add / remove flow**
- T1.6 Rendering ContextView with an empty session shows zero driver-tiles and a visible `+ Add driver` control.
- T1.7 Clicking `+ Add driver` opens a `.cmd-overlay` element populated with all catalog drivers.
- T1.8 Selecting a driver pushes it into `session.customer.drivers` with default priority and empty outcomes.
- T1.9 Driver-tile contains a remove control; triggering it removes the driver from `session.customer.drivers`.
- T1.10 Adding the same driver twice is a no-op (no duplicates in `session.customer.drivers`).

**Right-panel detail**
- T1.11 Clicking a driver-tile renders the right panel with `.coaching-card` showing that driver's `conversationStarter`.
- T1.12 Right panel includes a `<select>` for priority with the agreed option set.
- T1.13 Right panel includes a `<textarea>` for outcomes bound to `session.customer.drivers[x].outcomes`.

**Bullet-on-Enter**
- T1.14 Simulating an Enter keydown in an empty outcomes textarea yields content starting with `"• "`.
- T1.15 After a line of text, pressing Enter inserts `"\n• "` at the caret.
- T1.16 Pressing Backspace at the start of a line that contains only `"• "` removes the bullet.

**Persistence**
- T1.17 After adding a driver and entering outcomes, calling `saveToLocalStorage()` then reloading the session preserves `customer.drivers[*].outcomes` and `priority`.

**Migration**
- T1.18 Loading a session with legacy `customer.primaryDriver` + `businessOutcomes` produces a `customer.drivers` array with one mapped entry and the outcomes carried across.

**Regression guard**
- T1.19 `runAllTests()` still passes all 21 pre-existing suites (no existing test broken).

---

### Open questions for you
1. **Priority vocabulary**: `High / Medium / Low` (business-y) or `Now / Next / Later` (matches rest of app)?
2. **Driver list** I proposed — edits? additions? deletions?
3. **Conversation starters** — shall I draft them for the 8 proposed drivers and let you review each, or do you want to write them?
4. **Primary driver compatibility**: keep a derived "primary" field for Reporting, or drop it and let Reporting aggregate per driver?
5. **Remove confirmation**: always confirm, or only if the driver has outcomes text entered?
6. **Vertical ordering**: append Energy + Utilities at the end, or group verticals alphabetically?

---

## Tab 2 · Current State — Status: **APPROVED** (2026-04-18)

### Locked decisions
- **Catalog filtering**: tag-based (Option A). Optional `environments: string[]` on catalog entries; absence = valid everywhere. Single flat catalog.
- **Public Cloud catalog additions**: ship the drafted list; refine from workshop feedback.
- **Criticality default**: `"Low"` for every new `state:"current"` instance.
- **Colour palette**: `--crit-high: #d93025`, `--crit-medium: #f59e0b`, `--crit-low: #16a34a`. Exposed as CSS variables so Dell brand can override in one place.
- **Shape language**: High = filled triangle ▲, Medium = filled circle ●, Low = outline circle ○. Dual-channel with colour for accessibility.
- **Carry-through visual**: ghost / mirror / disposition tiles in Desired State inherit the same left-border + shape accent as their origin current instance.
- **Accent on retire / consolidate**: retained — origin criticality is preserved as a planning signal regardless of disposition.


### Summary of requested changes
1. Existing overall UX and matrix logic are fine — keep as-is.
2. **Environment-appropriate catalog**: filter the `+ Add` palette so that each environment only offers technologies that make sense there. In particular, **Public Cloud** should not list on-prem hardware (PowerEdge, Unity XT, etc.) and should list cloud-native equivalents (EC2, Azure VMs, S3, Blob, etc.). Core DC, DR / Secondary DC, and Edge look OK today — review only for polish.
3. **Criticality default**: when a current-state instance is added, default `criticality` to `"Low"` rather than blank (`-- none --`).
4. **Criticality color coding** using human-factors / Gestalt UX principles so critical items are visually prioritised:
   - High → red (alarm hue, high saturation)
   - Medium → amber (attention hue)
   - Low → green / neutral (safe, low saturation)
   - Accessibility: colour must be paired with shape or icon (not colour-only) so colour-blind users can distinguish.
5. **Carry-through to Desired State**: the same criticality signal of the *source* current instance must also be visible in Step 3 (Desired State) — on the ghost / mirror tile and on the disposition-set tile — so the presales never loses sight of what started as critical.

---

### My understanding (data + UX contract)

#### 2.1 Environment-appropriate catalog
Two implementation options; I recommend **Option A** (tag-based, one flat catalog):

- **Option A — tag each catalog entry with an `environments: string[]` whitelist.** Default "all" when omitted; the `+ Add` palette filters entries whose `environments` array is missing OR includes the current cell's `environmentId`.
- Option B — nested structure `CATALOG[layerId][envId] = [...]`. More code, more duplication.

Public Cloud additions proposed (you approve / edit):
- **Compute**: AWS EC2, Azure Virtual Machines, Google Compute Engine, AWS Outposts
- **Storage**: AWS S3 (already there), AWS EBS, Azure Blob Storage, Azure Files, Google Cloud Storage
- **Data Protection**: AWS Backup (already there), Azure Backup, AWS S3 Glacier, Commvault Cloud, Druva
- **Virtualization**: VMware Cloud on AWS, Azure VMware Solution, Google Cloud VMware Engine, AWS ECS/EKS, Azure AKS, Google GKE
- **Infrastructure**: Zscaler (already there), Cloudflare, AWS Direct Connect, Azure ExpressRoute, AWS IAM, Azure Entra ID (already there), AWS CloudWatch, Azure Monitor, GCP Cloud Logging

Existing catalog items that should be tagged with `environments: ["coreDc", "drDc", "edge"]` (not cloud): all PowerEdge variants, Unity XT, PowerStore, VxRail, Cisco Nexus/Catalyst, etc.

#### 2.2 Criticality default = "Low"
- `addInstance(session, props)` for `state === "current"`: if `props.criticality` is unset, default to `"Low"`.
- Existing items keep whatever they have (no migration rewrite).
- The detail-panel `criticality` select keeps its empty option for manual clearing — but new items never start blank.

#### 2.3 Color palette (human-factors informed)
- `--crit-high`   : red   (suggested `#d93025` base, with `!important` on border so colour survives vendor-group theming)
- `--crit-medium` : amber (suggested `#f59e0b`)
- `--crit-low`    : green (suggested `#16a34a`)
- Applied as: left border stripe (4px) + a small shape inside the tile (circle=Low, triangle=Medium, exclamation=High). Shape + colour = dual-channel signal.
- Tile text remains fully readable — colour is **accent**, not background fill.

#### 2.4 Carry-through to Desired State
When viewing Step 3 (Desired State):
- **Ghost / mirror tiles** (unreviewed current items): inherit the same left-border colour and shape of their origin instance.
- **Disposition-set tiles** (current item with counterpart): if the `originId` current instance had criticality, the desired counterpart tile also displays the same criticality accent — communicating that *this originated from something critical*.
- Net-new desired tiles (no `originId`) have no criticality accent — they use priority badges (Now/Next/Later) instead.

---

### Functional test criteria (Tab 2)

**Environment-appropriate catalog**
- T2.1 Each catalog entry has an optional `environments` array. Absence = valid in all environments.
- T2.2 Opening `+ Add` on a Public Cloud cell (Compute layer) shows **no** PowerEdge variants in the palette.
- T2.3 Opening `+ Add` on a Public Cloud cell (Compute layer) shows **at least** AWS EC2 and Azure Virtual Machines.
- T2.4 Opening `+ Add` on a Core DC cell (Compute layer) still shows PowerEdge (current gen).
- T2.5 For every layer, the Public Cloud palette has ≥1 cloud-native item.

**Criticality default**
- T2.6 `addInstance(session, { state:"current", layerId, environmentId, label, vendorGroup })` produces an instance with `criticality === "Low"` when caller did not supply one.
- T2.7 `addInstance(session, { state:"desired", ... })` does **not** inject a criticality default (desired uses priority, not criticality).
- T2.8 Existing test `validateInstance` still passes unchanged (regression guard).

**Colour + shape**
- T2.9 A High-criticality current tile rendered by MatrixView has a DOM marker class like `.crit-high` on the tile root.
- T2.10 A High-criticality tile includes a non-text marker element (e.g. `.crit-shape-high`) — asserted via `querySelector`.
- T2.11 Low criticality produces `.crit-low`; Medium produces `.crit-medium`.
- T2.12 CSS custom properties `--crit-high`, `--crit-medium`, `--crit-low` are defined (checked via `getComputedStyle(document.body)`).

**Carry-through**
- T2.13 A current instance with criticality "High" and a counterpart desired instance produces a desired tile carrying `.crit-high` when rendered in Step 3.
- T2.14 A net-new desired instance (no `originId`) has no `.crit-*` class.
- T2.15 A ghost / mirror tile (unreviewed current) carries its origin's `.crit-*` class.

**Regression guard**
- T2.16 All existing suites (including the new Tab 1 assertions once locked) remain green.

---

### Open questions for you (Tab 2)
1. **Option A (tag) vs Option B (nested)** for catalog environment filtering — I recommend A. OK?
2. **Public Cloud catalog additions** — draft list above is a starting point. Want me to add/remove anything?
3. **Colour hexes** — the values I suggested meet WCAG AA against white. Override with brand-exact Dell red/amber/green if you have them.
4. **Shape choice** — circle=Low, triangle=Medium, exclamation=High. Swap for different icons / Unicode glyphs if you prefer.
5. **Carry-through visual** — same accent as origin (what I proposed), or something subtler like a small "from critical" badge in the top-right of the desired tile?
6. **Criticality on `retire` / `consolidate` dispositions** — if the origin was High but the action is "retire", should the critical accent still show on the desired tile? I'd say yes (the origin's criticality still matters for planning). Confirm?

---

## Tab 3 · Desired State — Status: **APPROVED** (2026-04-18)

### Locked decisions
- **Rename**: UI label "Priority" → **"Phase"**. JSON key stays `priority` (zero-risk backward compat). Options: **Now (0-12 months)**, **Next (12-24 months)**, **Later (> 24 months)** — timeline becomes a subtle hint beside each option, `timeline` field is dropped from forms.
- **`keep` disposition**: phase control is hidden. No gap, no roadmap entry, no heatmap contribution. Tile still displays the origin's **criticality accent** (shape + border) so the presales keeps sight of critical assets even when leaving them alone.
- **Phase sync** (structural fix): when a desired instance's phase changes, its auto-drafted gap's phase re-syncs. Same for disposition → `gapType` changes. This removes the root cause of the current Roadmap "later" column bug.
- **Urgency on gaps**: strict auto-derived, **no manual override anywhere in the app**. Rule: `gap.urgency = linkedCurrent.criticality` (for mirrors) or `Medium` (for net-new `introduce`). One less UI control; one less source of drift.
- **Net-new (`introduce`) defaults**: `phase = "Next"`, `urgency = "Medium"`. On hover, a tooltip explains *why* the default is what it is, and confirms phase can be changed on the desired instance (urgency is locked to criticality by design).
- **Inheritance**: Tab 1-2 colour / shape / H-M-L language re-used. No new visual vocabulary introduced.

### End-to-end parameter model (source of truth)

| Object | Field | Set by | Feeds |
|---|---|---|---|
| current instance | `criticality` (H/M/L, default Low) | presales in Tab 2 | Heatmap + carry-through accent |
| desired instance | `disposition` (keep / enhance / replace / consolidate / retire / ops / introduce) | presales in Tab 3 | Gap type (or no gap if `keep`) |
| desired instance | `phase` (Now/Next/Later) — only when disposition requires action | presales in Tab 3 | Gap.phase → Roadmap column |
| gap | `gapType` | derived from disposition | Gaps board + Roadmap grouping |
| gap | `phase` | **synced** from linked desired instance | Roadmap column |
| gap | `urgency` | **derived** (read-only) from linked current's criticality, or `Medium` for introduce | Heatmap weight |

### Functional test criteria (Tab 3)

**Phase / timeline collapse**
- T3.1 Desired-state detail panel shows a single "Phase" select with options labelled "Now (0-12 months)", "Next (12-24 months)", "Later (> 24 months)".
- T3.2 No separate `timeline` field renders in the desired-state form.
- T3.3 Legacy sessions with `timeline` set still load without error; the field is ignored on re-save.

**Keep disposition UX**
- T3.4 Setting disposition to `keep` hides the phase control in the detail panel.
- T3.5 Setting disposition to `keep` does **not** create a gap.
- T3.6 A `keep` tile still displays the origin's criticality accent (border + shape class).

**Phase sync structural fix (Roadmap "later" bug)**
- T3.7 Changing a desired instance's phase from `Now` to `Later` updates the linked gap's `phase` to `later` in the same tick.
- T3.8 Changing a desired instance's disposition from `enhance` to `retire` updates the linked gap's `gapType` to `replace` (per ACTION_TO_GAP_TYPE).
- T3.9 The Roadmap `Later` column renders gaps whose linked desired instance has phase `Later`.

**Urgency auto-derivation**
- T3.10 A gap auto-drafted from a disposition on a current instance with `criticality: "High"` has `urgency: "High"`.
- T3.11 A gap auto-drafted from an `introduce` (no origin) has `urgency: "Medium"`.
- T3.12 No urgency `<select>` / input appears in the Gaps tab UI.
- T3.13 Updating a current instance's criticality propagates to the linked gap's urgency.

**Defaults + tooltip**
- T3.14 Rendering a net-new `introduce` desired instance shows phase preset to "Next".
- T3.15 Hovering the phase control shows a tooltip explaining the default and how to change it.
- T3.16 Hovering a gap's urgency label shows a tooltip explaining it is derived from the linked current criticality and cannot be edited manually.

**Regression guard**
- T3.17 All pre-existing suites and approved Tab 1/2 assertions remain green.

## Tab 4 · Gaps — Status: **APPROVED** (2026-04-18)

### Design thesis
Because Tabs 1-3 locked in auto-derivation, **Tab 4 stops being a data-entry screen and becomes the "control tower" — exploratory curation, not data entry.** The Gaps tab answers *"what needs to change and why?"*; the Roadmap (Tab 5) answers *"when and bundled how?"*. Same data, different lenses — **no shared grouping**: Tab 4 uses phase-kanban + filters (flexible slicing); Tab 5 uses auto-derived initiatives on a time axis (canonical story).

### Inherited rules (non-editable here, set upstream)
- `gap.gapType` → derived from disposition; **read-only** display.
- `gap.urgency` → derived from linked current's criticality (or Medium for `introduce`); **read-only** display with hover tooltip explaining the rule.
- `gap.phase` → synced bidirectionally with the linked desired instance (moving the gap also moves its desired instance's phase — single source of truth preserved either way).
- Criticality accent (H/M/L colour + shape) inherited onto each gap card from its linked current.
- `keep` dispositions produce no gap (expected absence).

### Locked UX decisions
- **Primary structure**: no fixed grouping beyond phase. Filters are the power tool.
- **View toggle**: Kanban ↔ flat list (kanban for workshop discussion; flat list for bulk editing). Same filters apply in both views.
- **Dell Solutions field**: free-text v1 (chip-catalog deferred to v2).
- **Drag-drop**: bidirectional — moving a card between phase columns also updates the linked desired instance's phase.
- **Status vocabulary**: keep all four (`open` / `in_progress` / `closed` / `deferred`).
- **Manual gap creation**: retained (for organisational gaps with no linked instances).
- **Column sort**: urgency desc, then insertion order.
- **Urgency**: stays locked read-only — if presales feels urgency is "off", the fix is to correct criticality in Tab 2; don't add a second mutable field that drifts.

### Proposed UX

**Kanban layout** — three columns labelled:
- **Now** (0-12 months)
- **Next** (12-24 months)
- **Later** (> 24 months)

**Gap card anatomy** (top to bottom):
1. Left-border urgency accent (red / amber / green) + urgency shape ▲ ● ○. Hover: *"Urgency: High — derived from linked current instance 'Unity XT' criticality."*
2. Gap-type pill (`replace`, `enhance`, `consolidate`, `retire→replace`, `ops`, `introduce`). Non-editable.
3. **Description** — editable inline click-to-edit.
4. Affected layer chips + environment chips (editable via a small multi-select popover).
5. **Mapped Dell Solutions** — editable free-text field. Placeholder coaches: *"Which Dell products close this gap? e.g. PowerProtect PPDM, Cyber Recovery Vault."*
6. Linked instances row: small chips for each linked current + desired instance. `×` to unlink (respects the existing typed-unlink throw rule).
7. Footer: status pill (`open` / `in_progress` / `closed` / `deferred`), an `auto-drafted` badge when applicable with tooltip showing the originating disposition, and a `…` menu for Delete + "Promote to manual" (detaches it from auto-sync).

**Drag / drop**:
- Dragging a card between columns updates `gap.phase` **and** the linked desired instance's `phase` in the same action. No drift.
- Drag within a column is a visual sort only (no persisted ordering field — keeps the data model flat).

**Filters (single row at top)**:
- Layer (multi-select)
- Status (multi-select, default = open + in_progress)
- "Unmapped Dell solutions only" toggle — surfaces the cards that still need solution-mapping work
- Clearing all filters returns to everything.

**Manual gap creation** — kept. Use case: organisational / process gaps that have no tied-in instances (e.g. "No DR runbook exists"). Defaults: `phase = Next`, `urgency = Medium`, `status = open`, no linked instances. Tooltip explains these are default values.

### What gets deleted / simplified vs today
- Urgency `<select>` — **removed** (now read-only derived).
- Gap-type `<select>` — **removed** on auto-drafted gaps (still settable on manually created ones at creation time only).
- Duplicate hints and confirmation modals for phase changes — **removed** (drag is the action, undo is re-drag).

### Functional test criteria (Tab 4)

**Derivation & display**
- T4.1 A gap card renders `urgency` as text/shape but has **no** editable control for it.
- T4.2 Hovering the urgency element reveals a tooltip containing the source criticality and the linked current instance label.
- T4.3 A gap card renders `gapType` as a non-editable pill.
- T4.4 Each card's left-border class matches `.crit-{high|medium|low}` based on its derived urgency.

**Bidirectional phase sync**
- T4.5 Dragging a card from "Now" to "Later" sets `gap.phase = "later"` **and** the linked desired instance's `priority = "Later"`.
- T4.6 Dragging occurs optimistically in the DOM then persists to localStorage; refresh preserves the position.
- T4.7 If the drag fails validation (defensive: shouldn't happen with current rules), the card returns to its original column and shows a toast.

**Editable-field persistence**
- T4.8 Editing `description` inline and blurring updates `gap.description` in state.
- T4.9 Editing `mappedDellSolutions` inline and blurring updates the field.
- T4.10 Changing status via the pill updates `gap.status` and cards filter out when status filter excludes it.

**Linked-instance management**
- T4.11 Removing a linked current instance via the chip `×` respects the typed-unlink throw rule (Suite 07).
- T4.12 The UI shows a toast when an unlink would violate a type rule, instead of silently failing.

**Manual gap creation**
- T4.13 "+ New gap" creates a gap with `phase: "next"`, `urgency: "Medium"`, `status: "open"`.
- T4.14 A manually created gap can have its `gapType` set at creation, after which it becomes read-only like auto-drafted gaps.

**Filters**
- T4.15 Toggling "Unmapped Dell solutions only" hides cards whose `mappedDellSolutions` is non-empty.
- T4.16 Layer and status filters combine with AND logic.

**Regression guard**
- T4.17 Suite 07 (gapsCommands), Suite 14 (GapsEditView DOM contract), and Suite 09 (gapsService) all pass. Tab 3 assertions (T3.7 / T3.8 / T3.9 phase sync) all pass.

---

## Tab 5 · Reporting — Status: **APPROVED** (2026-04-18, including Roadmap v2 hierarchy)

### Design thesis
Tab 5 is the **storytelling surface for executive consumption.** Everything is derived from upstream state — no new editable fields. Five sub-tabs, each with one clear job. The Roadmap sub-tab gets the biggest restructure; the others gain consistency with the new visual/data language but no functional overhaul.

### Sub-tab 5.1 · Overview
**Job**: one-screen health summary for the exec opener.
- **Health score** (existing `roadmapService.computeHealthScore`) — rolled up from current criticality + gap urgency + coverage. Visible as a big number + label (Stable / Minor / Moderate / High risk).
- **Executive summary** (existing `generateExecutiveSummary`) — regenerable via a "Regenerate summary" button (completes Task 4c from the original transfer prompt).
- **Pipeline stats**: counts of gaps per phase (Now / Next / Later) + counts by status.
- **Primary drivers** (from Tab 1) — shows the session's added drivers as chips with priority badge.

### Sub-tab 5.2 · Heatmap
**Job**: show architectural risk hotspots at a glance.
- Grid: **Layer × Environment** (5 × 4).
- Cell score = existing formula: `Σ criticality weights + Σ gap-urgency weights` for instances/gaps in that bucket. No formula change — just ensure the new crit/urgency colour variables feed it.
- **Cell colour** now uses the locked palette: red (High risk) / amber (Moderate) / green (Minor / Stable) / grey (No data). Dual-channel: number + colour + shape in the cell header.
- Cell click → drills into the Gaps board sub-tab filtered to that layer + environment.

### Sub-tab 5.3 · Gaps Board
**Job**: read-only mirror of Tab 4 kanban for stakeholders who shouldn't edit.
- Same filters row as Tab 4 (layer, environment, type, urgency, status, unmapped).
- Cards are non-editable (no drag, no inline edit). Click opens a modal with full detail + link chain.

### Sub-tab 5.4 · Vendor Mix
**Job**: show current vs desired vendor concentration (Dell / non-Dell / custom).
- Stacked bar per layer — current state.
- Stacked bar per layer — desired state.
- Table of vendors with instance counts and criticality mix.
- No structural change; just inherits Tab 2 criticality colouring for row indicators.

### Sub-tab 5.5 · Roadmap (v2 — two-level hierarchy)
**Job**: canonical plan of action for executive approval. **The crown-jewel view.**

**Hierarchy** (PMI-aligned):
- **Programs** (horizontal swimlanes) = Tab 1 business drivers. One swimlane per driver added to the session, plus an "Unassigned" swimlane at the bottom for anything that didn't match.
- **Projects** (cards) = auto-grouped gaps by the tuple `(environmentId, layerId, gapType)`.
- **Phases** (columns) = Now / Next / Later.

Projects live at the intersection of a program swimlane and a phase column.

**Project grouping rule** (same as v1):
- Each gap contributes to one project identified by `(environmentId, layerId, gapType)`.
- Primary environment: `gap.affectedEnvironments[0]` if set, else the first linked current's `environmentId`, else `"coreDc"` fallback.
- Gaps with no environment and no linked instances fall into a **"Cross-cutting"** project per layer + gapType.

**Project name template**: `"{Environment label} — {Layer label} {ActionVerb}"`. Action-verb mapping:

| gapType | ActionVerb |
|---|---|
| replace | Modernization |
| enhance | Enhancement |
| consolidate | Consolidation |
| retire | Retirement |
| ops | Operational Improvement |
| introduce | Introduction |
| rationalize | Rationalization |

**Program (driver) assignment** — new rule:
- One new optional field on gap: `driverId: string | null`.
- Populated two ways:
  1. **Auto-suggest** via pure function `programsService.suggestDriverId(gap)` — deterministic mapping of `(gapType, layerId, environmentId)` → driverId. Examples:
     - `dataProtection + any + any` → Cyber Resilience
     - `any + ops + any` → Operational Simplicity
     - `any + any + publicCloud` → Cloud Strategy
     - `replace + compute + (coreDc|drDc|edge)` → Modernize Aging Infrastructure
     - (full table shipped with implementation; starts minimal, refined as workshop patterns emerge)
     - Unmatched → `null` (lands in "Unassigned")
  2. **Manual override** via a small dropdown on the Tab 4 gap card. If set, it wins.
- **Project's program** = mode (most common) of its constituent gaps' `driverId`. Ties go to the first driver (stable ordering).

**Portfolio pulse bar** (above the swimlane grid):
- Total projects count.
- Split by phase (e.g. *"5 Now · 3 Next · 2 Later"*).
- Total unmapped gaps count (prompts curation in Tab 4).

**Swimlane header** shows:
- Driver label (matches Tab 1 wording).
- Aggregate urgency badge (max across the swimlane's projects).
- Project count.
- Priority chip from Tab 1 (H/M/L).
- Optional: a compact "% mapped" micro-indicator showing how many projects in this program have Dell solutions mapped.

**Project card** shows:
- Project name (auto-generated).
- Aggregate urgency badge (max of constituent gaps).
- Gap count.
- Aggregated Dell-solutions chips (deduped). Empty-state prompt if none: *"No Dell solutions mapped yet — see Tab 4."*
- Expand toggle → inline expansion revealing individual gaps with their current/desired link chains.
- Sorted within each swimlane-column cell by aggregate urgency desc, then gap count desc.

**"Unassigned" swimlane** — always rendered at the bottom, visually subdued (lower contrast, collapsible). Signals *"these gaps need a program — set a driver in Tab 4."*

**No editing on this tab.** Edits happen in Tab 4 (including the driver override). The Roadmap is a frozen derivation — stakeholder-safe.

### Test criteria (Tab 5)

**Overview**
- T5.1 "Regenerate summary" button triggers `generateExecutiveSummary` and updates the DOM text in place.
- T5.2 Primary drivers from `session.customer.drivers[]` render as chips with priority badges.
- T5.3 Pipeline counts match sum of gaps across phases.

**Heatmap**
- T5.4 Colour class on each cell maps: score > 6 → `crit-high`, 4-6 → `crit-medium`, 1-3 → `crit-low`, 0-with-data → neutral-stable, 0-no-data → neutral-empty.
- T5.5 Clicking a cell navigates to Gaps Board with layer + environment filters pre-applied.

**Gaps Board (reporting)**
- T5.6 Cards render with no `contenteditable`, no drag handles, no inline edit controls.
- T5.7 Filter state is independent from Tab 4's filter state (each tab tracks its own).

**Vendor Mix**
- T5.8 Stacked-bar totals match `vendorMixService` output.

**Roadmap — projects**
- T5.9 Two gaps with the same `(environmentId, layerId, gapType)` group into a single **project** card.
- T5.10 Two gaps with different `environmentId` but same `(layerId, gapType)` produce **two** project cards.
- T5.11 Project name contains the environment label, layer label, and action verb.
- T5.12 Project aggregate urgency equals the max urgency among its constituent gaps.
- T5.13 Project cards within a swimlane-column cell are ordered by aggregate urgency desc, then gap count desc.
- T5.14 A gap with no linked instances and no affected environments appears under a "Cross-cutting" project for its layer+type.
- T5.15 A project with no mapped Dell solutions shows the empty-state prompt.

**Roadmap — programs (swimlanes)**
- T5.16 `programsService.suggestDriverId(gap)` returns a driverId for a gap where `gapType === "ops"` → `"operational_simplicity"` (or session's operational-simplicity driver id).
- T5.17 `programsService.suggestDriverId(gap)` returns `null` when no rule matches.
- T5.18 A gap with an explicit `driverId` takes precedence over the auto-suggest result.
- T5.19 A project's program = mode of constituent gaps' `driverId`; ties resolved by first driver in session order.
- T5.20 The Roadmap renders one swimlane per driver present in `session.customer.drivers[]`.
- T5.21 Projects whose aggregated `driverId` is `null` (or unresolved) render under an "Unassigned" swimlane.
- T5.22 Swimlane header shows driver label, aggregate urgency, and project count.
- T5.23 Adding a driver in Tab 1 makes the swimlane appear in Tab 5 without refresh.
- T5.24 Removing a driver in Tab 1 re-routes its projects to "Unassigned" (gaps keep their `driverId` for auditability but no swimlane exists to render under).

**Portfolio pulse bar**
- T5.25 Pulse bar totals match sum of projects across all swimlanes.
- T5.26 Pulse bar "unmapped gaps count" equals the number of gaps whose `mappedDellSolutions` is empty.

**Regression guard**
- T5.27 Suites 08 (healthMetrics), 10 (vendorMix), 11 (roadmapService), 15 (summary-view DOM contracts), 20 (project grouping), 21 (ReportingView) all pass — some will be updated in lockstep to reflect the new grouping rule and Programs hierarchy.

### Locked decisions (recap)
- **Hierarchy**: Programs (Tab 1 drivers) → Projects (`env + layer + gapType`) → Phases (Now/Next/Later).
- **Naming**: "Programs" (PMI-standard) and "Projects" (PMI-standard). Dropping "Initiative" from user-facing wording to keep taxonomy crisp.
- **Driver assignment**: auto-suggest + manual override on the Tab 4 gap card.
- **Unassigned swimlane**: always rendered, visually subdued, collapsible.
- **Action verb mapping**: as drafted.
- **Cross-cutting bucket**: retained for gaps without environment.
- **Heatmap drill-down**: into read-only Gaps Board sub-tab with filters pre-applied.
- **Roadmap card expand**: inline (preserves swimlane layout).
- **Empty states**: "No gaps yet — start in Tab 3" on Roadmap and Overview when session has zero gaps.

### Tab 4 addition (carries from this decision)
- Gap card gets one new control: **Program** dropdown (options = session's drivers + "Unassigned"). Populates `gap.driverId`. Default value shown = auto-suggested driver (italicised "suggested"); selecting explicitly persists the choice. Hover tooltip: *"Which business driver does this gap serve? Auto-suggested from gap type + layer + environment."*

---

---

## Cross-cutting — TBD
- Local Dell logo swap ([Logo/delltech-logo-stk-blue-rgb.avif](../Logo/delltech-logo-stk-blue-rgb.avif)) — **DONE (Phase 0)**
- Containerisation (Node + Express + SQLite) — still v2.x
- AI integration readiness — still post-v2

---

## v2.1 Follow-up · Status: **APPROVED** (2026-04-18)

Raised after Phase 7 during hands-on review of the live app. Six items grouped into four follow-on phases.

### Locked decisions

| # | Item | Decision |
|---|---|---|
| 1 | Phase conflict on manual link | **Gap wins.** Confirmation modal before auto-applying desired-tile phase to match gap. |
| 2 | Drop mappedDellSolutions text input | **Approved.** Derive from linked Dell-tagged desired tiles. Keep JSON field for back-compat. |
| 3 | Needs-review flag on auto-drafted gaps | **Both triggers:** explicit "Approve" button + any substantive edit flips `reviewed: true`. Filter renamed to "Needs review only". |
| 4 | Vendor picker on custom `+ Add` | **Three-path split** in palette: Dell SKU / 3rd-party vendor quick-pick + Other / Custom / internal. Captures specific vendor for Vendor Mix reporting. |
| 5 | "Manage links" icon polish | **Inline SVG** chain-link + rotating chevron. |
| 6 | `?` help button + right-panel cleanup | **Approved.** Reusable `HelpModal` + per-tab help copy. Strip tips-lists and verbose coaching from right panels. Keep session-content (like driver conversation starters) as-is. |

### Detail — Item 1 · Phase conflict on manual link

- Manual `linkDesiredInstance(session, gapId, desiredId)` currently runs no sync — gap.phase and desired.priority can drift.
- **New flow**: when linking, if gap.phase maps to a different desired.priority than the desired tile currently carries:
  - Show a confirmation modal: *"Linking this tile to the gap will change its Phase from {current} to {gap.phase-mapped}. Proceed?"*
  - On OK → update desired.priority to match gap.phase (gap wins).
  - On Cancel → abort the link entirely.
- If phases already match → link silently.

**Test criteria (new T6.1 – T6.3)**:
- T6.1 Linking a gap to a desired tile with matching phase does not prompt.
- T6.2 Linking when phases differ raises a confirmation (mockable); accepting updates desired.priority; cancelling leaves both unchanged.
- T6.3 After confirm, linked gap's phase and desired tile's phase are in sync.

### Detail — Item 2 · Drop Dell-solutions input

- Remove the `<input data-prop="mappedDellSolutions">` from the gap detail panel and the manual-gap creation dialog.
- Keep `gap.mappedDellSolutions` in the JSON schema (for legacy sessions + AI reads); stop writing to it from the UI.
- **Derivation rule** (render-time, not stored):
  ```
  effectiveDellSolutions(gap, session) =
    unique labels of instances where
      i.state === "desired" AND
      i.vendorGroup === "dell" AND
      i.id ∈ gap.relatedDesiredInstanceIds
  ```
- **Consumers updated**:
  - Gap card's existing `solutions-badge` → pulls from derived set.
  - Roadmap project card's `dellSolutions` chips → aggregates derived sets across constituent gaps, deduped.
  - Pulse-bar "unmapped gaps count" → renamed conceptually to "unreviewed gaps count" (see Item 3).
  - `programsService.suggestDriverId` rule 2 (`mappedLower.includes("cyber")`) → re-ground on linked-tile labels + gap description text.

**Test criteria (updates)**:
- T4.9 (edit mappedDellSolutions inline) deprecated.
- New T2b.1: Given a gap linked to a Dell-tagged desired tile, `effectiveDellSolutions` returns that tile's label.
- New T2b.2: A gap with no linked Dell tiles returns an empty array.
- New T2b.3: Duplicates across multiple linked tiles are deduped.

### Detail — Item 3 · Needs-review flag

- New optional field on gap: `reviewed: boolean` (default `false` when auto-drafted via disposition; default `true` when manually created).
- **Trigger (C) — both**:
  1. Any substantive edit to the gap (description, status, driverId pick, link/unlink, phase drag) flips `reviewed = true`.
  2. An explicit **"Approve draft"** button in the detail panel flips `reviewed = true` without needing other edits.
- **Visual indication** on the Tab 4 gap card:
  - A soft pulsing dot in the top-right corner when `reviewed === false`.
  - Subtle "Review me" caption on hover (tooltip).
- **Filter rename**: "Unmapped Dell solutions only" → **"Needs review only"**. Toggle shows gaps where `reviewed === false`. Replaces the Phase 6 unmapped-filter entirely.
- **Migration**: existing auto-drafted gaps in localStorage get `reviewed: false` on next load; manually-created ones get `reviewed: true`.

**Test criteria (new T6.4 – T6.9)**:
- T6.4 Auto-drafted gaps (via disposition) start with `reviewed === false`.
- T6.5 Manually-created gaps (via + Add gap) start with `reviewed === true`.
- T6.6 Any edit to description / status / driverId / phase sets `reviewed = true`.
- T6.7 Clicking "Approve draft" flips `reviewed = true` without other edits.
- T6.8 "Needs review only" filter hides cards where `reviewed === true`.
- T6.9 Unreviewed gap card carries a DOM marker class `.gap-needs-review` with the pulsing dot element inside it.

### Detail — Item 4 · Vendor picker on custom add

- Command palette, when a typed name doesn't match any catalog entry, offers **three add paths** (replacing the single "+ Add custom"):
  1. `+ Add "{name}" — Dell SKU` → `vendor: "Dell"`, `vendorGroup: "dell"`.
  2. `+ Add "{name}" — 3rd-party vendor...` → inline expands to a short chooser: **HPE · Cisco · NetApp · Pure · IBM · Microsoft · VMware · Nutanix · Red Hat · AWS · Azure · Google · Other (type)**. Selected vendor → `vendor: "{Vendor}"`, `vendorGroup: "nonDell"`.
  3. `+ Add "{name}" — Custom / internal` → `vendor: "Custom"`, `vendorGroup: "custom"`.
- Benefit: Vendor Mix sub-tab can now report specific vendor counts for non-catalog entries.

**Test criteria (new T6.10 – T6.12)**:
- T6.10 Typing a custom name exposes exactly three add options (Dell / 3rd-party / Custom).
- T6.11 Selecting "3rd-party vendor…" and picking HPE creates an instance with `vendor: "HPE"`, `vendorGroup: "nonDell"`.
- T6.12 Selecting "Other" in the 3rd-party chooser opens a text input that persists the typed vendor name.

### Detail — Item 5 · Manage-links icon

- Replace text triangles on the "Manage links" collapse/expand control with an **inline SVG**: a chain-link glyph next to a chevron that rotates 180° on expand.
- Accessible: `role="button"`, keyboard-toggleable, `aria-expanded` attribute.
- Reusable SVG sprite lives in a small `ui/icons.js` module so Item 6's `?` icon can reuse the same pattern.

**Test criteria (new T6.13)**:
- T6.13 The Manage-links control renders an `<svg>` child with `aria-expanded` reflecting its state.

### Detail — Item 6 · Help modal + right-panel cleanup

- **Component**: `ui/views/HelpModal.js` with a generic `showHelp(tabId, subTabId)` entry point. Reads prose from a tiny `core/helpContent.js` map.
- **Icon placement**: every main tab's header card gains a `?` icon (same SVG sprite as Item 5) in its top-right, with `title="Help"`. Each reporting sub-tab gets its own `?` too.
- **Help content** (10 blurbs to draft): Context, Current State, Desired State, Gaps, Reporting-Overview, Reporting-Heatmap, Reporting-Gaps-Board, Reporting-Vendor-Mix, Reporting-Roadmap, plus a global "How this app works" entry point from the header.
- **Right-panel cleanup**:
  - Drop tips-lists from Context, Matrix, Gaps, Reporting placeholders.
  - Replace with the terse `[gap] Select a gap` pattern everywhere.
  - **Exception**: Tab 1 driver-detail right panel keeps the `.coaching-card` with the conversation starter — that's session content, not help.

**Test criteria (new T6.14 – T6.17)**:
- T6.14 Every main tab's header card renders a `.help-icon` button.
- T6.15 Clicking the help icon opens a modal with a non-empty body keyed by the current tab/sub-tab.
- T6.16 Right panels in Matrix, Gaps, and Reporting sub-tabs (except Tab 1 driver detail) contain ≤1 card at rest (terse placeholder only).
- T6.17 Modal closes on Esc, backdrop click, and close button.

### Implementation sequence

Pairs ship together (shared component, shared data-model change):

- **Phase 9** — Items 2 + 3 paired
  - Remove Dell-solutions input; add `effectiveDellSolutions` derivation in programsService or similar helper.
  - Add `gap.reviewed` field + migration; "Approve draft" button + any-edit trigger; pulsing dot on cards.
  - Rename filter to "Needs review only"; recalibrate pulse-bar count.
  - Update tests: replace T4.15, add T2b.1-3, T6.4-9.
- **Phase 10** — Item 1
  - Add phase-sync confirmation modal in `openLinkPicker` desired branch.
  - Add test T6.1-3.
- **Phase 11** — Item 4
  - Split command-palette custom add into 3 paths; embed 3rd-party quick-picker.
  - Add test T6.10-12.
- **Phase 12** — Items 5 + 6 paired
  - Create `ui/icons.js` with chain + chevron + question-mark SVGs.
  - Rewrite "Manage links" control with icon + aria.
  - Create `HelpModal.js` + `helpContent.js`; wire `?` button into each tab's header card.
  - Trim right panels; replace tips-lists with terse placeholders.
  - Add test T6.13-17.

### Item 7 · Account Health Score rework — split into Coverage + Risk (LOCKED)

Replaces the single `computeAccountHealthScore()` vibes-number with two complementary panels on the Overview.

#### 7a. Discovery Coverage (0-100%)

Weighted average of observable, countable facts:

```
Coverage (%) =
  0.40 × (current tiles with a disposition set       / total current tiles)
+ 0.30 × (auto-drafted gaps where reviewed === true   / total auto-drafted gaps)
+ 0.20 × (gaps with explicit gap.driverId set         / total gaps)
+ 0.10 × (1 if session.customer.drivers.length ≥ 1 else 0)
× 100 → integer rounded
```

If a denominator is 0 (e.g. zero current tiles), that term contributes its full weight (treat as "N/A → pass"). If the whole session is empty, Coverage = 0.

**Inline hint** lists up to 3 outstanding actions:
- `"{N} drafts to review"` → Tab 4 with Needs-review filter
- `"{N} gaps unassigned to a driver"` → Tab 4 where program = Unassigned
- `"{N} current tiles without a disposition"` → Tab 3 unreviewed banner

#### 7b. Risk Posture (labeled level, not a number)

Four labels with Heatmap-derived rules. Palette reuses `--crit-*`.

| Label | Colour | Rule (first match wins) |
|---|---|---|
| **High** | `--crit-high` (red) | ≥2 heatmap buckets score > 6 · OR ≥3 High-urgency open gaps in phase `now` · OR a High-criticality current tile with no disposition yet |
| **Elevated** | `#ea580c` (orange) | at least one bucket > 6 · OR one High-urgency open gap in phase `now` |
| **Moderate** | `--crit-medium` (amber) | at least one bucket in 4-6 · OR ≥2 Medium-urgency open gaps in phase `now` |
| **Stable** | `--crit-low` (green) | none of the above |

**Inline hint** names 1-2 specific actions that would lower the level:
- `"Close the {urgency} gap in {layer} × {env}"` → Tab 4 filtered
- `"Review {N} critical unreviewed tiles"` → Tab 3

Clicking **See Heatmap →** drills to the Heatmap sub-tab.

#### 7c. Deprecation

- `computeAccountHealthScore()` retained as a pass-through for AI/legacy readers but no longer drives UI.
- New: `computeDiscoveryCoverage(session) → { percent, actions }`.
- New: `computeRiskPosture(session) → { level, colour, actions }`.
- Both pure, JSON-serialisable, session-snapshot accepting.

#### 7d. Visual presentation

Two equal-width stacked panels on Overview replace today's single health card:

```
┌ DISCOVERY COVERAGE ┐    ┌ RISK POSTURE ┐
│ 82%                │    │ ● Elevated    │
│ ████████████░░     │    │ (orange pill) │
│ ↑ 4 items ...      │    │ ↑ 1 action... │
│ [See details →]    │    │ [See Heatmap→]│
└────────────────────┘    └───────────────┘
```

#### 7e. Test criteria (T6.18 – T6.25)

- T6.18 `computeDiscoveryCoverage(emptySession)` → `{ percent: 0, actions: [...] }`.
- T6.19 Coverage = 100 when all four fractions are 1 (or N/A).
- T6.20 Adding a disposition to a current tile raises Coverage; removing one lowers it.
- T6.21 `computeRiskPosture(empty)` → `{ level: "Stable" }`.
- T6.22 Adding a High-urgency gap in Now phase raises Risk to at least Elevated.
- T6.23 Two buckets > 6 forces level to High.
- T6.24 Risk-posture object includes at least one action string when level ≠ Stable.
- T6.25 Overview renders both panels with `.coverage-panel` and `.risk-panel` class hooks.

**Deprecated**: Suite 20/21 "computeAccountHealthScore" assertions may stay as regression guards (function still exists for back-compat), but the Overview health-score-number element check is replaced by the Coverage + Risk panel checks above.

### Acceptance (v2.1)

Shippable when:
1. Phases 9-12 complete.
2. All Phase 1-8 assertions still green; new T2b.*, T6.* green.
3. Auto-drafted gaps in the demo session show as unreviewed until user interacts; approving flips the dot off.
4. Custom-adding "HPE Nimble X" in any cell produces an instance tagged `vendor: "HPE"`, visible in Vendor Mix counts.
5. Right panels across Matrix, Gaps, and Summary sub-tabs are help-free — a single terse placeholder card.
6. Help modal opens for every tab/sub-tab with meaningful prose.
7. Overview shows two panels: Coverage % with progress bar and actionable hint; Risk as a coloured label with actionable hint. Old single-number health card removed from the UI (function retained for back-compat).

---

## v2.1.1 Follow-up · Phases 13 + 14 — Status: **IMPLEMENTED** (2026-04-18)

Post-v2.1 refinements raised during hands-on review. Both phases shipped inline and are captured here for audit.

### Phase 13 · Reporting right-panel drill-downs

**Motivation**: three of five Reporting sub-tabs had empty right panels at rest — wasted real estate. User feedback: "not good use of space".

**Changes** (5 locked decisions):
1. **Overview** — Executive Summary card moved from left to right column. CxO-dashboard layout: metrics on left (Coverage + Risk + Stats + Drivers + Pipeline), narrative on right.
2. **Heatmap** — unchanged (already had cell-detail on click).
3. **Gaps Board** — switched Dell-solutions rendering to `effectiveDellSolutions` (deprecates the free-text `mappedDellSolutions` display path).
4. **Vendor Mix** — vendor-table rows made clickable (`.vm-row`). Click → right-panel detail: instance count by layer, state split (current/desired), instance list.
5. **Roadmap** — swimlane headers clickable (`.swimlane-clickable`, role="button", keyboard-focusable). Click → right-panel Strategic Driver detail: label, shortHint, priority chip, project count, outcomes, aggregate urgency, % Dell-solutions mapped, project list. Unassigned swimlane gets its own click-detail prompting driver assignment.

**New tests**: T7.1 · T7.2 · T7.3 · T7.4 (4 assertions).

### Phase 14 · Session Brief + Roadmap click unification

**Motivation (Session Brief)**: The auto-generated "Executive Summary" was a template masquerading as prose — referenced the deprecated account-health score, carried a misleading "solutions mapped across N layers" line, surfaced only the top driver, contradicted the Coverage + Risk panels next to it, and the "Regenerate" button re-ran a deterministic function.

**Motivation (Roadmap click)**: Project cards used an inline "View gaps" expand; swimlane headers, vendor rows, and heatmap cells all used click-to-right-panel. Inconsistent.

**Changes**:
1. **`generateSessionBrief(session)`** — new pure service returning `[{label, text}]`. Uses the v2.1 data honestly: Coverage + Risk + all drivers + Pipeline + Top-High-Now + derived Dell solutions + instance footprint.
2. **`generateExecutiveSummary(session)`** — rewritten to delegate to the brief + flatten as `"Label: text | …"` string. Back-compat preserved for Suite 20 tests. Legacy narrative preserved as unreachable `_legacyNarrativeSummary`.
3. **`ReportingView.js`** — renders the brief as a labelled definition list inside the `.exec-summary-text` container (legacy marker class kept). Card title: **"Session brief"**. Button: **"↻ Refresh"** (honest affordance).
4. **`SummaryRoadmapView.js`** — inline `.project-expand-btn` and `.project-gap-list` removed. Project cards get `role="button"` + `tabindex="0"` + click → `renderProjectDetail(right, session, proj)` showing urgency shape, Dell solutions, constituent gaps, linked-tech count, pointer to Tab 4.

**CSS additions**: `.session-brief` grid, `.brief-row` / `.brief-label` / `.brief-text`, `.project-card:hover`.

**New tests**: T7.5 (Session Brief ≥3 labelled rows) · T7.6 (project card → right-panel detail). 2 assertions.

### Phase 14b · Session Brief layout fix (2026-04-18)

**Symptom**: Session Brief rendered in the right panel used a `grid-template-columns: 160px 1fr` layout. With the right panel being narrow, labels claimed ~50% of the width and the text column wrapped to 2-3 words per line — unreadable.

**Fix**: `.brief-row` switched from 2-column grid to vertical flex stack. Label sits on top (small caps eyebrow), text below (body). Uses full column width; wraps cleanly at any viewport.

**Affected**: `styles.css` only. No view or service changes. No tests affected (T7.5 checks row count + labels, both still satisfied).

### Acceptance (v2.1.1)

- All v2.0 + v2.1 assertions still green.
- T7.1 – T7.6 green.
- Overview Session Brief shows labelled rows; Refresh button toggles feedback state.
- Roadmap project cards open right-panel detail on click; no inline expand remains.
- Every Reporting sub-tab's right panel hosts something meaningful at rest or on click.
- Session Brief rows render comfortably in the narrow right column — labels stacked above text.

---

## v2.1.2 · Reviewer handoff scripts (2026-04-18)

Small non-app-surface release:
- `start.bat` (Windows) + `start.sh` (macOS/Linux) — one-click local runners that check for Python, launch `python -m http.server 8000`, auto-open the browser.
- `HOW_TO_RUN.md` — 2-minute setup guide for non-developer reviewers (ZIP or git, both covered).
- `README.md` — links to HOW_TO_RUN from the Quick Start section.

Tagged `v2.1.2`. No code or test changes.

---

## v2.4.4 · Phase 19d · Unified AI platform — IMPLEMENTED (2026-04-24)

**Goal**: Stop organic accretion of AI shapes. Lock a coherent data model (SPEC §12) that every future scenario composes against without rework. Three big deliverables bundled:

1. Unified output-behavior model — `responseFormat` × `applyPolicy`.
2. Writable-path resolvers — `context.*` paths declared `writable:true` in `FIELD_MANIFEST` must have a matching function in `core/bindingResolvers.js`. applyProposal dispatches session.* vs context.* automatically.
3. Apply-on-confirm UI + in-memory undo stack + per-skill provider override.

### What shipped

- `SPEC.md §12` — full AI platform specification (authoritative data model, extension points, invariants).
- `core/skillStore.js` — unified schema with `responseFormat`, `applyPolicy`, `outputSchema`, `providerKey`; legacy `outputMode` migrates on load.
- `core/fieldManifest.js` — `writable: true|false` on every entry; `writableFieldsForTab()` helper for the admin chip palette.
- `core/bindingResolvers.js` — NEW. 13 resolvers: drivers (priority/outcomes), instances (criticality/notes/disposition/priority), gaps (description/gapType/urgency/phase/status/notes/driverId).
- `core/promptGuards.js` — `getSystemFooter(responseFormat, opts)`; json-commands stub footer declared.
- `services/skillEngine.js` — derives effective responseFormat; returns proposals + applyPolicy so UseAiButton can branch.
- `interactions/aiCommands.js` — applyProposal dispatches session.* vs context.* + uses WRITE_RESOLVERS; rolls back undo snapshot on apply-failure.
- `state/aiUndoStack.js` — NEW. In-memory stack (max 10) with onUndoChange listeners.
- `state/sessionStore.js` — `replaceSession(snapshot)` helper preserves module-scoped identity.
- `ui/views/SkillAdmin.js` — Response Format + Apply Policy dropdowns replace single Output Mode.
- `ui/components/UseAiButton.js` — branches on applyPolicy; feeds context into applyProposal for resolvers.
- `index.html + app.js` — header Undo chip wired to aiUndoStack.
- `styles.css` — proposals panel, undo chip, output-schema toggle chips.
- `diagnostics/appSpec.js Suite 30` — OH1-OH17 covering schema round-trip, parser tolerance, undo contracts, writable-path invariant, resolver-based apply, legacy migration, enum locks, json-commands stub.

### KNOWN UX ISSUES — queued for v2.4.5 Foundations Refresh

Tests (416 machine assertions) all pass, but the following UX polish is incomplete. Explicit list so nothing gets lost:

1. **Post-undo tab blanking** — after clicking the ↶ Undo chip, the current tab can appear blank until the user navigates away and back. Root cause: views don't subscribe to a "session-changed" signal; the cached "selected" reference stays stale. Fix: emit session-changed event from applyProposal + undoLast; views re-resolve selection on receipt.
2. **Driver disappears on AI apply** — same root cause as (1). Changing driver priority via AI makes the tile appear gone until navigation.
3. **Undo chip vague** — generic "Undo last AI change" label; no tooltip showing what will revert. v2.4.5 surfaces stack depth + last-change label.
4. **Undo not persistent** — stack is in-memory, clears on page reload. v2.4.5 persists to localStorage.
5. **Demo session stale** — `createDemoSession()` predates Phase 16 (no workload-layer instances) and Phase 18 (no multi-linked patterns). Demo is supposed to be the human-test surface for every feature; it's drifted. v2.4.5 extracts to `state/demoSession.js` + refreshes data + adds `diagnostics/demoSpec.js` integration tests + `DEMO_CHANGELOG.md`.
6. **Seed skill library minimal** — only one text-brief skill. v2.4.5 adds 4-5 seeds covering text + json-scalars + each tab.

Per `feedback_foundational_testing.md` (saved this session): every future data-model change ships with demo refresh + seed update + demoSpec assertion in the SAME turn. v2.4.5 is the first release under this rule.

---

## Release re-sequence · 2026-04-24 afternoon

The original v2.4.7 polish bundle + v2.4.6 action-commands are re-ordered. Capability slices (action-commands) move *after* UX, because action-commands is a capability without a user-scenario today; polish fixes friction on every app open. The original v2.4.7 7-item bundle is split across v2.4.6 / v2.4.7 / v2.5.0. Updated running order:

| Tag | Slice | Source items | Gating |
|---|---|---|---|
| **v2.4.6** | UX quick-wins | L4 version · L5 empty chip · L6 save button · U3 auto-dismiss banner | none |
| **v2.4.7** | Fresh-start UX | U1 empty-canvas default + Load-demo CTA | none |
| **v2.4.8** | Phase 17 taxonomy | L1 drop `rationalize` + rename Disposition→Action + 7-term link table | Phase 17 table **APPROVED 2026-04-24** |
| **v2.4.9** | Primary-layer + Gap→Project data model | L2 + L3 — `affectedLayers[0] === layerId` invariant + explicit `projectId`; no UI changes | v2.4.8 done |
| **v2.5.0** | Crown-jewel (renames + AI routing) | U5 vocab · U4 AI on Tabs 2-5 · U2 AI conversation starter | v2.4.9 done |
| **v2.5.1** | Crown-jewel (structural) | U6 drawer IA · SVG icons · tag-vocab primitives · color discipline | v2.5.0 done |
| **v2.6.0** | Action-commands runtime | C1 (json-commands) | v2.5.1 done |
| **v2.7.0** | GB10 arm64 verification | D1 | hardware access |
| **v3.0.0** | Multi-user platform | Bucket E | stakeholder sign-off, separate SPEC_v3 |

**v2.4.9 is the pre-crown-jewel rollback anchor** — commit message must name it "AI platform complete + relationships fixed + old look" so the `git checkout` target is explicit if v2.5.x sideways.

---

## v2.4.6 · UX quick-wins · IMPLEMENTED (2026-04-24)

Four small independently-mergeable fixes. Each item in its own commit; one tag at the end.

1. **L4 · App version surface** — NEW `core/version.js` exporting `APP_VERSION`. `app.js renderHeaderMeta` splits into two chips: session identity (`customer.name | date | status`) and `Canvas v{{APP_VERSION}}`. Today's "v2.0" next to customer name was the session schema, not the app — confusing. `DEMO_CHANGELOG` process rule extends to bump `APP_VERSION` alongside any tag.
2. **L5 · Empty chip on skill rows** — `ui/views/SkillAdmin.js:79` renders deprecated `skill.outputMode`; seed skills don't set it → empty span. Replace with `responseFormat` + `applyPolicy` chips. Update Suite 26 SB6 assertion to pin the new chip set.
3. **L6 · Save button active on edit, test-gated on create** — today the Save button is disabled until `lastTestedSignature === currentSignature` for both flows. Change: disabled for CREATE until tested; active on EDIT even without re-test (show a non-blocking warning when signatures differ).
4. **U3 · Auto-dismiss green test banner** — `diagnostics/testRunner.js renderBanner` fades out after 5s when `results.failed === 0`. Failure banner stays sticky — user needs to act on it.

---

## v2.4.7 · Fresh-start UX · QUEUED

U1 · empty-canvas default + visible "↺ Load demo" button in the empty-state placeholder. Today's auto-load-demo on first run confuses real users. Estimated ~30 min.

---

## v2.4.8 · Phase 17 taxonomy · IMPLEMENTED 2026-04-24 (sign-off in hand)

User signed off the 7-term Action table on 2026-04-24 afternoon. See Item 4 below — status flipped from PROPOSED to APPROVED. Scope:

- Rename UI label "Disposition" → "Action" everywhere.
- Drop `rationalize` gap type (migrator coerces existing `rationalize` gaps to closest remaining term per the rules; `validateGap` rejects `rationalize` after migration).
- Enforce mandatory linking at create-time for Replace and Consolidate per the table.
- `ACTION_TO_GAP_TYPE` consolidates to 7 entries.
- Demo + seed + demoSpec + DEMO_CHANGELOG refreshed per `feedback_foundational_testing.md`.

Est ~2 hr. Detailed migration plan drafted alongside v2.4.6.

---

## v2.4.16 · Foundations: Taxonomy + Reporting Audit + PillEditor fix · IMPLEMENTED + TAGGED 2026-04-29

**Status**: SHIPPED. Tag `v2.4.16` on origin/main. 616/616 GREEN ✅. Sequenced spec → tests → code → smoke per `feedback_spec_and_test_first.md`. Backlog source: `HANDOFF.md` Bucket B1.5 items 1 + 4 + 2.

### Outcomes shipped

- **Discipline reassertion (item 1)**: spec-lock-before-code demonstrator. 5-commit sequence enforces pre-flight checklist at every step. Locked at `e21f36f` BEFORE any audit code; tests RED-first at `0fd8d47`; audit + real-bug fix at `053647f`; PillEditor investigation at `7935b30`; tag-time docs sync at this commit.
- **Foundational doc (item 4)**: NEW `docs/TAXONOMY.md` (single source of truth, 8 sections, ≤30-min readable). Cross-referenced by RULES.md by rule id.
- **Per-gapType disposition table + asset lifecycle table (item 4)**: canonical in TAXONOMY §4-5; mirrored in RULES §13-14.
- **Reporting derivation audit (item 4)**: 5 service files marked `// Last audited v2.4.16`. 9 divergences logged in TAXONOMY §9 (KD1-KD9). One real bug fixed: `getHealthSummary.highRiskGaps` now excludes closed gaps (live-verified at tag time).
- **PillEditor user concern (item 2)**: investigated. Half-text/half-pill is by-design parser behavior when template label-text doesn't match field-manifest exactly (Suite 47 PE4 pins). UX clarity question (highlight bare-pills with amber underline + tooltip) DEFERRED to v2.4.17 awaiting user direction.

### Banner: 584/0/584 (v2.4.15 ship) → 616/616 GREEN (v2.4.16 ship; +32 net assertions)

**Goal**: foundations release — single-source-of-truth taxonomy + relationships catalog + per-gapType disposition rules table + asset lifecycle by action + reporting derivation audit + pill-editor bug. Visible UX change is intentionally minimal; the payoff is that v2.4.17 (theme + right-panel pass) and v2.4.18 (crown-jewel reporting redesign) ride on a validated data architecture.

**Rationale for the split** (user-approved 2026-04-29): items 3 (theme), 5 (reporting redesign), 6 (right-panel) all rest on a locked taxonomy + audited counts. Doing them on top of drifted docs / unvalidated services would amplify any latent bugs into the visible redesign. v2.4.16 = foundations; v2.4.17 = visible polish; v2.4.18 = reporting redesign.

### Sections

**§DR · Discipline reassertion (DR1-DR5)** — spec-lock commit BEFORE code; Suite 47 RED commit BEFORE service audit; pre-flight checklist box-by-box at tag; `.dNN` post-tag hygiene pass on v2.4.15 iter-2-5 SPEC §9 coverage.

**§TX · Taxonomy + relationships catalog (TX1-TX12)** — NEW `docs/TAXONOMY.md`. Eight sections: Entity Catalog (Driver / Layer / Environment / Current / Desired / Gap / Project / Service) · Relationships · Cardinalities · **Per-gapType Disposition Rules** · **Asset Lifecycle by Action** · Reporting Derivations · Validation Contract · Presentation Rules. Cross-references RULES.md by rule id. ≤30-min readable.

| Action | gapType | currents | desireds | Asset lifecycle |
|---|---|---|---|---|
| Keep | (no gap) | 1 | 0 | 1 stays |
| Enhance | enhance | 1 | optional | 1 stays + uplift |
| Replace | replace | 1 | 1 | 1 retired + 1 introduced (1-for-1 swap) |
| Consolidate | consolidate | 2+ | 1 | N retired + 1 introduced (N-to-1 merge) |
| Retire | ops | 1 | 0 | 1 retired (no replacement) |
| Introduce | introduce | 0 | 1 | 0 + 1 introduced (net new) |
| Operational/Services | ops | optional | optional | 0 asset change · ≥10 chars notes OR ≥1 link required |

**§RU · `docs/RULES.md` refresh (RU1-RU8)** — header v2.4.11 → v2.4.15. Add v2.4.12 SVC + v2.4.13 §0 + v2.4.14 + v2.4.15 numbered rules. Annotate every superseded rule. NEW §13 Per-gapType Disposition Rules + NEW §14 Asset Lifecycle by Action (mirror TX4 + TX5).

**§RA · Reporting derivation audit (RA1-RA10)** — line-by-line audit of every count across:
- `services/healthMetrics.js` (54 LOC) — bucket scores, risk labels, summary counts.
- `services/gapsService.js` (27 LOC) — phase swimlane filtering, closed-gap exclusion, envless-gap inclusion.
- `services/vendorMixService.js` (54 LOC) — Dell density / Most diverse layer / Top non-Dell KPI tile derivations + hidden-env exclusion.
- `services/roadmapService.js` (554 LOC) — buildProjects, computeLayerImpact, computeDiscoveryCoverage, computeRiskPosture, computeAccountHealthScore, generateExecutiveSummary.
- `services/programsService.js` — driver-suggestion ladder D1-D9 + effective driver/Dell solutions.

Each function gets a `// Last audited v2.4.16 · {date}` marker. Hidden envs uniformly excluded (`getVisibleEnvironments`). Closed gaps uniformly excluded from default rollups. Bug fixes ride this release; unfixable items deferred with explicit note in TAXONOMY.md § Known divergences.

**§DC · Disposition rule code-level validation (Suite 47, DC1-DC7)** — RED-first: Replace 1+1 / Consolidate 2++1 / Retire 1+0 / Introduce 0+1 contracts; auto-draft bypass (AL1); ops-substance rule (AL7); metadata-patch bypass (AL9); `requiresAtLeastOneCurrent` / `requiresAtLeastOneDesired` derivation (positive + negative cases).

**§PE · Pill-editor bug (PE1-PE5)** — reproduce → root-cause → isolated fix in `ui/components/PillEditor.js` (224 LOC) → regression test → browser-smoke verify (click each pill, type between pills, Backspace at boundary, save+reopen round-trip).

**§T · Tests (Suite 47 RED-first)** — `Foundations: Taxonomy + Reporting + PillEditor`. Target: ~30-40 new assertions. Banner 584/0/584 → ~620/0/620.

**§R · Regression guards** — all 584 existing GREEN; APP_VERSION = "2.4.16" at spec-lock; SPEC.md flips PENDING → IMPLEMENTED at tag; HANDOFF backlog items 1, 2, 4 → SHIPPED, items 3, 5, 6 stay queued.

### Out-of-scope (explicitly deferred)

- Item 3 (theme + tag consistency app-wide) → **v2.4.17**.
- Item 6 (right-panel utilization) → **v2.4.17** (coupled with item 3).
- Item 5 (crown-jewel reporting redesign — Executive summary sub-tab + KPI mix + heatmap) → **v2.4.18**.
- Gap-card asset-lifecycle visualization (`1 → 1` / `2 → 1` / `ø → 1` hint per TX8) → **v2.4.17** polish pass; doc captures intent, code lands later.

### Files touched

| Artifact | Action | Notes |
|---|---|---|
| `docs/TAXONOMY.md` | NEW | Single source of truth; eight sections per §TX. |
| `docs/RULES.md` | UPDATE | Header bump + v2.4.12-15 rules + NEW §13 + §14. |
| `SPEC.md` | UPDATE | Phase 19n block (PENDING → IMPLEMENTED at tag). |
| `docs/CHANGELOG_PLAN.md` | UPDATE | This entry (QUEUED → IMPLEMENTED at tag). |
| `core/version.js` | UPDATE | 2.4.15 → 2.4.16 (spec-lock commit). |
| `ui/components/PillEditor.js` | UPDATE | One isolated fix per §PE. |
| `services/healthMetrics.js` | AUDIT | + fix if drift found. |
| `services/gapsService.js` | AUDIT | + fix if drift found. |
| `services/vendorMixService.js` | AUDIT | + fix if drift found. |
| `services/roadmapService.js` | AUDIT | + fix if drift found. |
| `services/programsService.js` | AUDIT | + fix if drift found. |
| `diagnostics/appSpec.js` | UPDATE | NEW Suite 47, ~30-40 assertions. |
| `docs/DEMO_CHANGELOG.md` | UPDATE | v2.4.16 no-data-model-change entry. |
| `HANDOFF.md` | UPDATE | Backlog status flip at tag. |
| `RELEASE_NOTES.md` | UPDATE | User-facing entry at tag. |

### Order of work after spec-lock commit

1. Author `docs/TAXONOMY.md` (foundation; everything else cites it).
2. Refresh `docs/RULES.md` (§1-12 + new §13 + §14).
3. Write Suite 47 RED in `diagnostics/appSpec.js`.
4. Audit `services/*.js` line-by-line; fix any drift; mark each function `// Last audited v2.4.16`.
5. Fix `ui/components/PillEditor.js` per §PE.
6. Browser smoke via Chrome MCP per `feedback_browser_smoke_required.md`.
7. PAUSE for explicit "tag it" approval per `feedback_no_push_without_approval.md`.
8. On approval: flip SPEC §9 status, flip CHANGELOG_PLAN status, update DEMO_CHANGELOG / HANDOFF / RELEASE_NOTES, tag `v2.4.16`, push tag + main.

---

## v2.4.15 · Dynamic environments + UX polish bundle · IMPLEMENTED + TAGGED 2026-04-29 (5 polish iterations + 1 hotfix)

**Status**: SHIPPED. Tag `v2.4.15` on origin/main. 584/0/584 GREEN.

**Iterations from spec-lock to tag** (full as-shipped detail in `SPEC.md §9 Phase 19m / v2.4.15 As-shipped addendum`):
- **Iter-1** · core implementation . dynamic env model + soft-delete + vendor segmented bar + collapsible FilterBar + capsule polish + footer + matrix tweaks. Suite 46 RED-first then GREEN.
- **Iter-2** · Tier 1 (bugs/regressions) + Tier 2 (design system): blue-dot glitch → Lucide lock; AI provider Save robustness + visible feedback; hidden envs DROP from Tab 2/3 (was greyed); Hide modal moves to Overlay.js; capsule scaling; right-panel auto-fit grid; GPLC `.tag[data-t]` primitive; `.btn-with-feedback` button-feedback contract; FilterBar accordion with persistent collapse; vendor-mix dimension picker + slow shimmer + click-to-cross-filter.
- **Iter-3** · Gaps filters consolidated (legacy filter-row → FilterBar Quick toggles); vendor-mix Option A KPI tiles (3 click-to-drill insights replace per-layer + per-env standing cards); AI Assist capsule-morph (overlay shrinks to top-right pill with heartbeat in pick mode); env-tile pick-selector bug fix.
- **Iter-4** · multi-select filters (filterState dim values become arrays, within-dim OR + multi-dim AND combine); Domain dim retired, Gap type added; AI Assist envelope enrichment (`context.picked.entity` carries the full session record so skill templates can reference structured fields); SharedFilterBar mounted on Tab 5 Gaps board for cross-tab filter consistency; Notify.js (confirmAction / notifyError / notifyInfo / notifySuccess) sweeps every native `confirm()` / `alert()` (13 sites).
- **Iter-5 + hotfix** · Single-site preset chip (one-click hide all but Primary DC); typed env detail fields (Capacity stepper, Floor stepper, Tier datalist); HOTFIX for fresh-session preset that materializes default-4 envs into `session.environments` on first user interaction.

**Backlog captured for v2.4.16** (`HANDOFF.md` Bucket B1.5): spec/tests discipline reassertion · AI builder pill-editor bug · tag + right-panel consistency app-wide · data taxonomy + relationships catalog · crown-jewel reporting redesign · right-panel utilization optimization.

---

## v2.4.15 · Dynamic environments + UX polish bundle · LOCKED 2026-04-27 / RE-LOCKED 2026-04-28 (originally-locked spec, kept below for audit trail)

### Post-decision amendments · 2026-04-28

User signed off on 5 of the 6 open decisions, with two material spec changes vs. the 2026-04-27 lock:

1. **Catalog labels**: cleaner, exec-readable labels (drop consultancy jargon). IDs stay backward-compat with v2.4.14 instance references.
   | id | label (NEW · v2 lock) | hint |
   |---|---|---|
   | `coreDc` | Primary Data Center | The main on-premises site |
   | `drDc` | Disaster Recovery Site | Active or warm standby for failover |
   | `archiveSite` | Archive Site | Compliance archive, immutable backups, tertiary tier |
   | `publicCloud` | Public Cloud | AWS, Azure, GCP, Oracle |
   | `edge` | Branch & Edge Sites | Retail, factory floor, remote offices |
   | `coLo` | Co-location | Third-party data center space |
   | `managedHosting` | Managed Hosting | Provider-operated dedicated hosting |
   | `sovereignCloud` | Sovereign Cloud | In-region regulated cloud (UAE, KSA, EU) |
2. **Default-enabled set**: original 4 (`coreDc`, `drDc`, `publicCloud`, `edge`) — confirmed.
3. **Metadata fields**: keep simple, no jargon — `alias`, `location`, `sizeKw`, `sqm`, `tier`, `notes`. No additions. Confirmed.
4. **Removal behaviour**: REPLACED hard-warn-and-remove with **soft-delete (hide pattern)**. Adds `session.environments[].hidden: boolean` (default `false`). Save-guard + confirmation modal + grey-out on Tabs 2/3, exclude from Tab 5 Reporting, restore from Tab 1. New section §SD below; supersedes prior §DE5 remove-button + §R4 guard.
5. **Demo scope**: minimal §DE9 only (metadata for the existing 4 envs); full demo refresh stays in v2.4.17. Confirmed.
6. **Filter dimensions**: wire ALL 4 dimensions (Layer, Service, Domain, Urgency) end-to-end in v2.4.15 (was: services only). Adds 3 body data attributes + 3 CSS dim rules. New §FB7 below; supersedes prior FB5 "services only" caveat.

### Section SD · Soft-delete (hide) pattern (SD1-SD9) · NEW 2026-04-28

Replaces the previous "warn-and-remove" model. The standard pattern in enterprise tools (Trello / Notion / GitHub archive): **Hide is reversible; data is never lost.**

| # | Item | Files |
|---|---|---|
| **SD1** | Schema: add `hidden: boolean` (default `false`) to every entry in `session.environments[]`. Migrator backfills `hidden: false` on every legacy entry. | `state/sessionStore.js`, `core/config.js` |
| **SD2** | NEW `getVisibleEnvironments(session)` helper · returns `getActiveEnvironments(session).filter(e => !e.hidden)`. NEW `getHiddenEnvironments(session)` · returns the inverse. | `core/config.js` |
| **SD3** | Hide button per env in Tab 1 ContextView "Active environments" sub-section. Click flow: (a) save-guard if `getSaveStatus().dirty === true` → modal "Save unsaved changes before hiding [env]?" with `[Save & Hide]` `[Hide without saving]` `[Cancel]`; (b) confirmation modal "Hide '[alias \|\| label]'? It will be greyed out on Current/Desired tabs and excluded from Reporting. [N] instances will stay in your saved file. You can restore it any time from the Context tab." with `[Hide]` `[Cancel]`. | `ui/views/ContextView.js`, NEW `ui/components/HideEnvDialog.js` (or inline modal) |
| **SD4** | Tab 1 Context renders TWO sub-sections: **Active environments** (editable list with metadata fields + Hide button) and **Hidden environments** (collapsed by default; one-line entry per hidden env with mono-caps "HIDDEN" tag, "[N] instances tied · saved file preserved" pill, and a `[Restore]` button). Restore is one-click (no confirmation; low-stakes reverse). | `ui/views/ContextView.js` |
| **SD5** | Render rules for hidden envs across canvas tabs: |  |
|     | • **Tab 2 Current state · Tab 3 Desired state**: column renders, full top-to-bottom grey-out (`opacity: 0.35`, `filter: grayscale(1)`, `pointer-events: none`, dashed border, header tag "hidden"). Cells inside are non-interactive. | `ui/views/MatrixView.js`, `styles.css` |
|     | • **Tab 4 GapsEditView**: env-select dropdown for new gaps excludes hidden envs; existing gaps with hidden env in `affectedEnvironments` show a greyed env chip (read-only). | `ui/views/GapsEditView.js` |
|     | • **Tab 5 Reporting (all sub-tabs)**: SummaryHealthView, vendor mix, services scope, roadmap project cards — hidden envs **excluded entirely** (use `getVisibleEnvironments`). | `ui/views/SummaryHealthView.js`, `ui/views/SummaryVendorView.js`, `ui/views/SummaryGapsView.js`, etc. |
| **SD6** | Hide invariant: ≥1 active (non-hidden) env at all times. Hide button is disabled (with tooltip "At least one environment must remain active") if hiding would leave zero. | `ui/views/ContextView.js` |
| **SD7** | `.canvas` save/load round-trip: `hidden` field persists. Existing v2.4.14 `.canvas` files load with all envs `hidden: false` (backfill). | `state/sessionStore.js` (saveToFile / loadFromFile) |
| **SD8** | Demo session `state/demoSession.js` has zero hidden envs (`hidden: false` for all 4). | `state/demoSession.js` |
| **SD9** | Data-integrity tests: see Suite 46 DE-INT1-6 in the test section. Cover instance-preservation, save round-trip, restore-after-hide, taxonomy preservation across `gap.affectedEnvironments`, ≥1 active invariant, migrator backfill. | `diagnostics/appSpec.js` |

### Section FB7 · Filter dimensions wired in v2.4.15 (full set) · NEW 2026-04-28

Supersedes the prior FB5 "services only" caveat. All 4 dimensions get full body-data-attribute + CSS-dim-rule treatment.

| # | Dimension | body data attr | filter-state key | Card class match attribute |
|---|---|---|---|---|
| **FB7a** | Service | `data-filter-services` | `services` | `data-services` (already in v2.4.14) |
| **FB7b** | Layer | `data-filter-layer` | `layer` | `data-layer` (already on `.gap-card`) |
| **FB7c** | Domain | `data-filter-domain` | `domain` | `data-domain` (added in v2.4.14 CD3) |
| **FB7d** | Urgency | `data-filter-urgency` | `urgency` | `data-urgency` (NEW: add to `.gap-card` render in this release) |

CSS pattern (single rule per dim, mirrors v2.4.14 services rule):
```css
body[data-filter-services] .gap-card:not(.filter-match-services),
body[data-filter-layer] .gap-card:not(.filter-match-layer),
body[data-filter-domain] .gap-card:not(.filter-match-domain),
body[data-filter-urgency] .gap-card:not(.filter-match-urgency) {
  opacity: 0.22;
  filter: grayscale(0.5);
  transition: opacity 200ms, filter 200ms;
}
```

`filterState.js` API extended: `setActiveFilters(dimension, valuesArray)`, `getActiveFilters(dimension)`, persisted to `localStorage`.

`FilterBar.js` `applyFilters(scope)`: for each active dimension, sets body data attribute + computes match class on each card. Multi-dim AND combine (a card must match ALL active dimensions).



### Theme

Two threads bundled into one tag because they share the same render surfaces:
1. **Dynamic environment model** , move from a fixed 4-entry `ENVIRONMENTS` constant to a user-managed list sourced from a catalog. Each env carries metadata (alias, location, size, power, tier, notes) so the v2.4.16 report can say "Riyadh DC . 5 MW . Tier III" instead of "Core DC."
2. **UX polish stack** , vendor mix segmented bar, modern collapsible filter bar, session capsule polish (better icon + last-updated), footer alignment, matrix column-gap + invisible corner, Load demo icon.

The structural change (item 1) lands first; the polish items follow in the same release because they touch overlapping render sites.

### Locked decisions (do not re-litigate during implementation)

| Decision | Why |
|---|---|
| **Environment catalog** with these 8 entries: Main / Core DC, Secondary / DR DC, Vault / 3rd site (NEW), Public Cloud, Edge / Remote, Co-location (NEW), Hosted / MSP (NEW), Sovereign Cloud (NEW). User enables which apply via Tab 1; each can only be enabled once. | Industry-standard list with 3 new types covering MEA enterprise + regulated verticals. Single-instance enforcement keeps schema simple. |
| **Default enabled set for new sessions** = the 4 v2.4.14 envs (Main, DR, Public, Edge). Existing sessions auto-enable whatever envs their instances/gaps reference. | Backward-compat with every existing session + matches the historical default. |
| **Schema**: `session.environments: [{ id: "coreDc", alias?, location?, sizeKw?, sqm?, tier?, notes? }]`. The `id` IS the catalog typeId (no UUID complexity); single-instance enforcement = no two entries share the same id. | Keeps existing `instance.environmentId === "coreDc"` references unchanged. Simpler than a UUID + typeId split. |
| **`environmentAliases` map (v2.4.14) drains into `session.environments[N].alias`** during migration; the legacy field is deleted post-migrate. | One source of truth for alias; no two-system drift. |
| **Vendor mix uses ONE horizontal stacked bar per dimension** (Combined / Current / Desired), not per-layer + per-env tables. Dell-blue / ink-mute / amber segments with inline percentages on segments large enough. | "github languages" pattern; cleaner than the v2.4.14 multi-card layout. |
| **Modern filter UI** = single "Filters . N active" button with chevron count badge. Click expands an inline panel with multi-select chips per dimension. Active filters render as removable pills above the kanban. | Hick's Law: collapse what's not active. Scales as we add dimensions. |
| **Session capsule icon** = Lucide `building-2` (corporate office tower). The v2.4.14 briefcase reads as a shopping bag. | User feedback 2026-04-27. |
| **Session capsule adds "Updated HH:MM" segment** after the save indicator, separated by a second `\|` divider. | Polish: glance-readable + verifiable last-edit time. |
| **Footer hint right-aligned** with `\|` divider before the version capsule. | User feedback: hint felt out of place centered. |
| **Matrix column-gap = 3px**, less than the 6px row-gap, so rows remain the dominant scan direction. Corner cell (`.matrix-corner`, `.hm-corner`) goes visually invisible (transparent + no border). | Eye prefers ONE dominant scan direction in a matrix. Empty corner cell drew unnecessary attention. |
| **Load demo icon** = Lucide `play-circle` (triangle-in-circle) instead of `rotate-cw`. | The v2.4.14 rotate-cw read as "deformed circular arrow that closed on itself." play-circle matches the "start the demo" semantic. |

### Section 1 · Dynamic environment model (DE1-DE9)

| # | Item | Files |
|---|---|---|
| **DE1** | NEW `ENV_CATALOG` constant in `core/config.js` (8 entries: id, label, hint). Replaces the prior `ENVIRONMENTS` constant as the source of truth for available types. Old `ENVIRONMENTS` kept as a deprecated alias resolving to `ENV_CATALOG.filter(c => DEFAULT_ENABLED_ENV_IDS.includes(c.id))` so legacy imports keep resolving until migration is complete. NEW `DEFAULT_ENABLED_ENV_IDS = ["coreDc", "drDc", "publicCloud", "edge"]`. | `core/config.js` |
| **DE2** | NEW `getActiveEnvironments(session)` helper in `core/config.js`. Returns `session.environments` if non-empty, else returns the DEFAULT_ENABLED_ENV_IDS list as catalog entries (so a fresh session that hasn't been migrated still renders sensibly). | same |
| **DE3** | Schema change in `state/sessionStore.js createEmptySession`: `environments: []` (empty default; populated either by demo or by migrator on first load of a legacy session). Drop the `environmentAliases` field from createEmptySession (replaced by per-env `alias`). | `state/sessionStore.js` |
| **DE4** | Migrator (`migrateLegacySession`) auto-enables environments referenced by any instance.environmentId or gap.affectedEnvironments. For each enabled env, drains `session.environmentAliases[envId]` into `environments[N].alias`. Old field deleted post-migrate. Idempotent. | same |
| **DE5** | **(SUPERSEDED 2026-04-28 by §SD3 + §SD4)** Originally: Tab 1 ContextView Environments card with per-env Remove button. Now: "Active environments" + "Hidden environments" sub-sections with Hide/Restore actions per §SD. Metadata fields (alias, location, sizeKw, sqm, tier, notes) save on blur via saveToLocalStorage; "+ Add environment" picker shows only catalog entries that are not yet in `session.environments` (regardless of hidden state). | `ui/views/ContextView.js` |
| **DE6** | Every render site that loops `ENVIRONMENTS` swaps to `getActiveEnvironments(session)`: MatrixView (env headers + cell loops), SummaryHealthView (env headers + heatmap cells), GapsEditView (env-select dropdown + env-checkbox row), services / roadmap / vendor mix services. | all view files + services |
| **DE7** | `getEnvLabel(envId, session)` (v2.4.14) updated to read alias from `session.environments[].alias` instead of `session.environmentAliases[envId]`. | `core/config.js` |
| **DE8** | Tests update: Suite 5 sessionStore migrator tests cover the auto-enable + alias drain. Suite 12 ContextView DOM tests include the new metadata fields. Suite 15 summary-view tests reflect dynamic env count (where they assumed exactly 4). | `diagnostics/appSpec.js` |
| **DE9** | Demo session (`state/demoSession.js`) populates `session.environments` with 4 entries that have realistic metadata (Riyadh DC . 5 MW . Tier III, Jeddah DR . 2 MW . Tier II, AWS me-south-1, Branch sites x14). DEMO_CHANGELOG entry per the foundational-testing rule. | `state/demoSession.js`, `docs/DEMO_CHANGELOG.md` |

### Section 2 · Vendor mix segmented bar (VB1-VB3)

| # | Item | Files |
|---|---|---|
| **VB1** | NEW `.vendor-bar` component in styles.css: horizontal flex container with proportional segments (Dell, non-Dell, custom). 16px tall, 10px radius, no internal dividers (CSS gap:0). Each segment has min-width:6% with text-overflow:ellipsis on inline percentage label; smaller segments collapse to colored stripe with tooltip. | `styles.css` |
| **VB2** | `SummaryVendorView` rewritten: drops the per-layer + per-env table cards. Renders 3 stacked bars (Combined, Current state, Desired state) with shared legend strip. Total counts displayed above each bar in mono tabular-nums. | `ui/views/SummaryVendorView.js` |
| **VB3** | Per-layer breakdown collapses to ONE bar per layer (6 bars stacked vertically). Inline mini-bars at 12px tall instead of the 16px main bar. | same |

### Section 3 · Modern filter bar (FB1-FB6)

| # | Item | Files |
|---|---|---|
| **FB1** | NEW `ui/components/FilterBar.js` exporting `renderFilterBar(target, opts)`. opts: `{ dimensions: [{id, label, options}], session, scope }`. Renders a single "Filters . N active" button with chevron + count badge. | NEW file |
| **FB2** | Click button -> expands inline panel (smooth 200ms cubic-bezier). Panel groups dimensions: Layer, Service, Domain, Urgency. Each dimension is a multi-select chip group. Selected chips have check-icon + Dell-blue-soft background. | same |
| **FB3** | Active filter strip above the kanban: removable chip pills (`.tag[data-variant="filled"]` style with ✕ button). Click ✕ removes that filter. "Clear all" link at the right end of the strip when 2+ filters active. | same + `ui/views/GapsEditView.js` |
| **FB4** | Underlying state stays in `state/filterState.js` (v2.4.14). FilterBar reads/writes via existing API. localStorage persistence stays. | `state/filterState.js` (no change), FilterBar.js |
| **FB5** | **(SUPERSEDED 2026-04-28 by §FB7)** Replace the v2.4.14 services chip-row in GapsEditView with the new FilterBar. ALL 4 dimensions (Service / Layer / Domain / Urgency) wired end-to-end per §FB7 (was: services only). | `ui/views/GapsEditView.js` |
| **FB6** | Same FilterBar mounted in SummaryGapsView (Tab 5 Gaps Board) read-only kanban. Same dimension set. | `ui/views/SummaryGapsView.js` |

### Section 4 · Session capsule polish (SC1-SC2)

| # | Item | Files |
|---|---|---|
| **SC1** | Replace briefcase SVG (which reads as a shopping bag) with Lucide `building-2` (corporate office tower). Inline SVG in `index.html` + the `app.js renderHeaderMeta` SVG construction. | `index.html`, `app.js` |
| **SC2** | Add a "Updated HH:MM" segment after the save indicator, separated by a second `\|` divider. Format: `HH:MM` if `savedAt` is today, `MMM DD HH:MM` otherwise. Rendered by `renderSessionStripStatus` from `getSaveStatus().savedAt`. | `app.js` |

### Section 5 · Footer alignment (FT1)

| # | Item | Files |
|---|---|---|
| **FT1** | Footer hint right-aligned, with a 1px `\|` divider before the version capsule. Layout: `[footer-actions] ... flex spacer ... [hint][divider][version]`. CSS: `.footer-hint` removes `flex:1` + `text-align:center`, gets `margin-left:auto` instead. | `index.html`, `styles.css` |

### Section 6 · Matrix tweaks (MT1-MT3)

| # | Item | Files |
|---|---|---|
| **MT1** | `.matrix-grid` and `.heatmap-grid` get `column-gap: 3px` (was 1px). Less than the existing 6px `row-gap` so rows remain dominant. | `styles.css` |
| **MT2** | `.matrix-corner` and `.hm-corner` go visually invisible: `background: transparent; border: none;`. Cell stays in the grid for layout alignment but no longer draws as an empty box. | `styles.css` |
| **MT3** | Load demo button icon swap: replace `rotate-cw` (read as "deformed circular arrow") with Lucide `play-circle` (triangle inside a circle). | `index.html` (footer button SVG) |

### Tests · Suite 46 (DE1-DE10 + DE-INT1-6 + SD1-SD8 + VB1-VB3 + FB1-FB6 + FB7a-d)

| # | Test | Asserts |
|---|---|---|
| **DE1** | ENV_CATALOG present with 8 entries (new labels) | `core/config.js` exports ENV_CATALOG with id+label+hint shape; length === 8. Labels: "Primary Data Center", "Disaster Recovery Site", "Archive Site", "Public Cloud", "Branch & Edge Sites", "Co-location", "Managed Hosting", "Sovereign Cloud". |
| **DE2** | getActiveEnvironments fallback | Empty session.environments returns the 4 default-enabled entries (`coreDc`, `drDc`, `publicCloud`, `edge`). |
| **DE3** | createEmptySession schema | New empty session has `environments: []`, no `environmentAliases` field. |
| **DE4** | Migrator auto-enables referenced envs | Legacy session with instances pointing at coreDc + edge migrates to environments containing those two ids only. |
| **DE5** | Migrator drains aliases | Legacy session.environmentAliases.coreDc = "Riyadh DC" lands as session.environments[i].alias = "Riyadh DC"; environmentAliases field is deleted. |
| **DE6** | ContextView Environments card lists enabled + offers picker | Render returns >= one .env-row element per active env; + Add picker excludes already-in-session types (regardless of hidden state). |
| **DE7** | Add new env via picker | Click "+ Add" -> select Archive Site from dropdown -> session.environments includes an archiveSite entry with `hidden: false`. Picker no longer offers Archive Site. |
| **DE8** | Hide env via Hide button (replaces prior Remove) | Click hide on coreDc -> session.environments[i].hidden becomes true. coreDc still present in session.environments (NOT spliced out). Picker still does not offer coreDc (already in session). |
| **DE9** | MatrixView env headers reflect dynamic count | Session with environments=[coreDc{hidden:false}, edge{hidden:false}] renders exactly 2 .matrix-env-head elements. |
| **DE10** | getEnvLabel reads from session.environments | Set session.environments[0].alias = "Riyadh DC" -> getEnvLabel("coreDc", session) returns "Riyadh DC". |
| **DE-INT1** | Hide preserves instance count | Before hide: session.instances.length = N. Hide an env that has linked instances. After hide: session.instances.length === N (zero data loss). |
| **DE-INT2** | Hide round-trips through .canvas | Hide env, exportToCanvas, importFromCanvas -> hidden state preserved. |
| **DE-INT3** | Restore restores rendering | Hide env, restore env -> getVisibleEnvironments returns the env again; MatrixView re-renders the column. |
| **DE-INT4** | Hide preserves gap.affectedEnvironments taxonomy | Gap with `affectedEnvironments: ["coreDc", "publicCloud"]` -> hide coreDc -> gap.affectedEnvironments still contains "coreDc" (unchanged). |
| **DE-INT5** | ≥1 active env invariant | Session with one non-hidden env: attempt to hide it -> hide rejected (button disabled) and session.environments unchanged. |
| **DE-INT6** | Migrator backfills hidden:false | Legacy v2.4.14 session migrated -> every entry in session.environments has `hidden: false`. |
| **SD1** | getVisibleEnvironments helper | Session with 3 envs (1 hidden) -> getVisibleEnvironments returns 2; getHiddenEnvironments returns 1. |
| **SD2** | Tab 1 renders Active + Hidden sub-sections | ContextView with 2 active + 1 hidden env -> 2 .env-row.active elements + 1 .env-row.hidden element + a `.hidden-section` heading. |
| **SD3** | Hide button save-guard fires when dirty | Mock `getSaveStatus` returns dirty -> click Hide -> save-prompt modal appears with "Save & Hide" button. |
| **SD4** | Hide confirmation modal copy | Modal contains the env alias/label + the "[N] instances will stay in your saved file" line + Hide + Cancel buttons. |
| **SD5** | Confirmed hide flips hidden flag + dispatches session-changed | Click Hide on confirmation -> session.environments[i].hidden = true + session-changed event emitted with reason "env-hide". |
| **SD6** | Restore button restores | Click Restore on hidden env -> session.environments[i].hidden = false + session-changed emitted with reason "env-restore". No confirmation modal. |
| **SD7** | Tab 2/3 hidden env column greyed out | Render MatrixView with one hidden env -> `.matrix-env-head[data-env-hidden="true"]` exists with computed opacity ≤ 0.5 + pointer-events: none. |
| **SD8** | Tab 5 reporting excludes hidden envs | SummaryHealthView render with hidden coreDc -> zero `.heatmap-env-head[data-env="coreDc"]` cells. |
| **VB1** | Vendor bar renders with proportional segments | SummaryVendorView with mixed Dell/non-Dell/custom data renders 3 .vendor-bar-segment children with width sum >= 99%. |
| **VB2** | Vendor bar inline percentages | Segments wider than 6% have visible percentage label inside. |
| **VB3** | Per-layer bars stack vertically | At least 6 .vendor-bar elements in the per-layer breakdown (one per layer). |
| **FB1** | FilterBar renders single button | renderFilterBar produces one .filter-bar-toggle element with text matching /Filters/. |
| **FB2** | FilterBar expands on click | Click toggle -> .filter-bar-panel becomes display !== "none". Re-click collapses. |
| **FB3** | Multi-select chip toggles (services) | Click a service chip in the panel -> body[data-filter-services] set + chip gets is-active class. |
| **FB4** | Active filter strip renders pills | One active filter -> one .active-filter-pill element with the value text + ✕ button. |
| **FB5** | Pill ✕ removes filter | Click ✕ -> body data attr cleared + pill removed from DOM. |
| **FB6** | Filter count badge | "Filters . 2 active" text appears when 2 filters active. |
| **FB7a** | Layer dim wired | Click a layer chip -> body[data-filter-layer] set + matching `.gap-card[data-layer="X"]` gets `.filter-match-layer` class + non-matching cards get computed opacity ≤ 0.3. |
| **FB7b** | Domain dim wired | Click a domain chip -> body[data-filter-domain] set + matching cards get `.filter-match-domain`. |
| **FB7c** | Urgency dim wired | Click an urgency chip -> body[data-filter-urgency] set + `.gap-card[data-urgency]` attribute present + matching cards get `.filter-match-urgency`. |
| **FB7d** | Multi-dim AND combine | Activate Layer=compute AND Urgency=high -> only cards matching BOTH stay un-dimmed. Cards matching only one are dimmed. |

### Section R · Regression guards (smoke checklist)

| Guard | Check |
|---|---|
| **R1** | v2.4.14 tests stay GREEN. 547 -> ~590+ (Suite 46 lands DE1-DE10 + DE-INT1-6 + SD1-SD8 + VB1-3 + FB1-6 + FB7a-d = ~37 new tests, minus any deletions from updated Suite 12/15). |
| **R2** | Load demo -> 4 envs render with city aliases + metadata. Tab 2 + Tab 3 + Heatmap show "Riyadh DC", "Jeddah DR", "AWS me-south-1", "Branch sites x14". |
| **R3** | Add new env via Tab 1 (e.g. Archive Site) -> immediately shows up as a 5th column in MatrixView + Heatmap + GapsEditView env-select. New labels read on screen exactly as catalog: "Primary Data Center", "Disaster Recovery Site", etc. |
| **R4** | **(REPLACED 2026-04-28 by SD-flow)** Hide env via Tab 1: (a) save-guard fires when dirty; (b) confirmation modal lists env + instance count; (c) on confirm, env column on Tab 2/3 greys out top-to-bottom (opacity ≤ 0.5, not editable, dashed border, "hidden" tag in header); (d) Tab 5 Reporting (heatmap, vendor bars) excludes the env entirely; (e) Tab 1 Hidden envs sub-section shows the env with a Restore button; (f) click Restore -> env reverts to active everywhere with one click, no confirmation. |
| **R4b** | ≥1 active env invariant: in a session with one active + one hidden env, the Hide button on the active env is disabled with tooltip. |
| **R4c** | Hide preserves data: hide an env with linked instances + gaps -> session.instances and session.gaps counts unchanged; gap.affectedEnvironments still references the hidden env id. |
| **R5** | Vendor mix shows 3 stacked horizontal bars (Combined / Current / Desired) + per-layer mini bars stacked. No tables. |
| **R6** | Filter button on Tab 4 says "Filters" when nothing active, "Filters . 1 active" when 1 chip selected. Click ✕ on the active pill above kanban -> filter clears. |
| **R7** | Session capsule shows building-2 icon + workshop name + "Updated HH:MM" timestamp. |
| **R8** | Footer reads `[buttons] ... [hint] \| [version]` with hint right-aligned. |
| **R9** | Matrix has visible 3px column-gaps + 6px row-gaps. Corner cell invisible. Load demo button icon is play-circle. |
| **R10** | Hard refresh -> filters preserved (FilterBar reads filterState localStorage) + envs preserved (session.environments survives JSON round-trip). |
| **R11** | No em dashes in any source file (re-run VT20 sweep). |
| **R12** | No console errors during the full tour. |

### Effort: ~17 hours, single tag (2026-04-28 revision: +3 hr for soft-delete + all-4-filter-dims)

- **Stage 1** (~2 hr): Suite 46 RED tests written first (DE1-10 + DE-INT1-6 + SD1-8 + VB1-3 + FB1-6 + FB7a-d). All assertions defined; many fail RED until code lands.
- **Stage 2** (~3 hr): DE1-DE4 schema + ENV_CATALOG + getActiveEnvironments + getVisibleEnvironments + getHiddenEnvironments + migrator (auto-enable + alias drain + hidden-backfill).
- **Stage 3** (~3 hr): SD3-SD4 ContextView Environments card with Active + Hidden sub-sections + Hide flow (save-guard + confirmation modal) + Restore flow + DE5/DE6 metadata fields + "+ Add" picker.
- **Stage 4** (~2 hr): SD5 render rules across MatrixView/Heatmap/GapsEditView/SummaryHealthView/SummaryVendorView + DE7 getEnvLabel update + DE9 demo metadata.
- **Stage 5** (~2 hr): VB1-VB3 vendor mix segmented bar.
- **Stage 6** (~3 hr): FB1-FB6 + FB7a-d full-dim FilterBar (Service/Layer/Domain/Urgency wired).
- **Stage 7** (~1 hr): SC1-SC2 session capsule (building-2 + Updated HH:MM) + FT1 footer + MT1-MT3 matrix tweaks.
- **Stage 8** (~1 hr): APP_VERSION bump + SPEC.md §9 phase block + RULES.md updates + DEMO_CHANGELOG entry + RELEASE_NOTES entry + HANDOFF refresh.
- **Stage 9** (~1 hr): Browser smoke vs §R guards via Chrome MCP. Pause for "tag it" approval.

### Tag protocol (per locked discipline)

1. Spec committed (this entry). Wait for user "spec looks right" sign-off.
2. Tests committed (Suite 46 DE/VB/FB). Fail RED at first.
3. Code execution: §1 first (foundational schema), then §2-§6 in any order.
4. Browser smoke against §R guards. Report results.
5. Pause for explicit "tag it" approval.
6. Tag, push, update memory + HANDOFF.

---

## v2.4.14 · Hygiene + polish + filter system + Lucide + env aliases · IMPLEMENTED 2026-04-27 (tagged + pushed)

**Status:** drawer-everywhere parked per user direction; the v2.5.0-residual polish that doesn't depend on drawers shipped here, plus three additive features (env aliases, filter system, Lucide migration). Test surface flipped from yellow `545/12/557` to fully green `547/0/547` by deleting 10 obsolete tests + landing the filter system. Tag `v2.4.14` at `9c9e5eb`.

**Highlights:**
- Test cleanup: deleted 10 Suite 44 RED tests (drawer + per-entity AI + tag-primitive migration) + Drawer.js stub.
- Heading case sweep (A3): sentence-case across views; "Strategic Drivers" retained as customer brand convention.
- Brand-alias sweep (CD1): 147 mechanical replacements `var(--brand)` → `var(--dell-blue)`.
- Gap-card domain hue bars (CD3): 2px muted-hue left bar via `data-domain` attribute.
- Tabular-nums utility (DS8): `.metric` class + inline application on counts.
- Cmd+K shortcut for AI Assist.
- Browser tab title unsaved indicator.
- Environment aliases (NEW): `session.environmentAliases` + Tab 1 Environments card + `getEnvLabel(envId, session)` helper.
- Filter system (F1-F6 services dimension): `state/filterState.js` + 10-chip strip on Tab 4 + body-attribute-driven CSS dim.
- Lucide SVG icons: undo / undo-all chips + footer Save/Open/Demo/New/Clear.

---

## v2.4.13 · Intermediate UX/UI patches · IMPLEMENTED 2026-04-27 (tagged + pushed)

**Status:** all 8 spec sections (S0-S8 + S2A) shipped. Six user-feedback polish iterations folded in (P1-P8, Q1-Q6, R1-R4, F1-F6, G1-G2, iter-6 row-band rhythm). Test surface 545 GREEN / 12 RED / 557 total; remaining RED was the v2.5.0-deferred Suite 44 set (later cleaned up in v2.4.14). Tag `v2.4.13` at `ff09f32`. Browser smoke against R1-R12 verified before tag.



### Theme

User feedback after v2.5.0 chunks 1-3 ("starting to worry about the UI fix all together"): pull a focused set of visible-improvement quick wins into an intermediate v2.4.13 release before the v2.5.0 structural rework lands. v2.4.13 ships the visible "feels finished" wins; v2.5.0 ships the deeper drawer-everywhere + universal detail-panel template + filters.

v2.4.13 builds on top of the Phase 19m foundation work already shipped to main (chunks 1, 2, 2.1, 2.2, 3): DS1 design tokens, DS2 eyebrow utility, DS5 dash-bullet pattern, A1 em-dash sweep, A2 Dell product accuracy, CD5 services domain field, DS24 demo gap domain coverage, GPLC-pattern topbar, leading-zero stepper, local Dell logo. Those chunks were originally tagged v2.5.0 in commit messages but they constitute the foundation for both v2.4.13 and v2.5.0; the next tag will be v2.4.13 incorporating that foundation plus this intermediate scope.

### Locked decisions (do not re-litigate during implementation)

| Decision | Why |
|---|---|
| **Drop the Reporting "Services scope" sub-tab entirely.** Remove it from REPORTING_TABS in `app.js`. Either delete `SummaryServicesView.js` or leave it as a vestigial orphan module (cheaper to delete). | The sub-tab adds a navigation step without earning value: services are a facet of gaps and projects, and the v2.4.12 work + v2.5.0 detail-panel template already surface services on the gap drawer body, the project drawer body, and the Roadmap project-card chip row. The standalone sub-tab is redundant. User decision 2026-04-27. |
| **AI assistance becomes a global top-right button, not per-tab.** "✨ AI Assist" or similarly attractive label, replacing the current app-version chip position in the topbar. Solid Dell-blue accent so it reads as the visible primary action in the topbar. Clicking opens a properly-sized overlay (NEW Overlay.js component, similar interaction-language to drawer but centered modal with more workspace). **AI Assist is for SKILL EXECUTION (user-facing portal); AI Builder remains separate inside the gear icon → Skills admin (will eventually become part of a broader control panel).** | Single source of truth for AI is more discoverable than today's buried per-driver button. The overlay gives AI assistance the workspace it needs. Replaces, does not augment, the existing per-driver `useAiButton` mounting on Tab 1. |
| **AI Assist overlay UX (refined 2026-04-27)**: tile-based grid of skill cards (not a list), each tile shows icon + name + description + applicable targets. **Persistence**: clicking "Apply" on a skill result does NOT close the overlay; the user runs multiple skills in one session and clicks outside or "Done" to dismiss. **Transparency mode**: when a skill needs the user to click an element on the page (e.g. "select a gap to apply this skill to"), the overlay drops to 40% opacity and the backdrop becomes interactive so the user can pick beneath; the active skill tile stays highlighted. **Skill scope**: defaults to current-tab skills, with a small "All tabs" toggle that surfaces every deployed skill. | Tile UI > list because skills are visual entities the user picks among, not a sequential agenda. Persistence > one-shot because workshop AI use is iterative (run a skill, see result, run another, chain). Transparency > opaque because the AI sometimes needs context only available by clicking the underlying surface. User explicit design direction 2026-04-27. |
| **App version chip moves to footer**, rendered as a small mono caps capsule in the bottom bar. Top bar reserved for functional/interactive elements (brand block + doc-meta + AI Assist + Undo + gear). | Metadata belongs in the footer; functional elements belong in the topbar. User decision 2026-04-27. |
| **Demo banner renders on all 5 tabs when `session.isDemo === true`** (currently only Tab 1 ContextView). Existing colorful styling kept; user explicitly likes it. | The colorful demo signal should follow the user across the workshop, not vanish after Tab 1. User said: "the demo purple, colorful, I like it, easy on the eye to notice; let's add it for all tabs when working with demo." |
| **Color contrast and visual ergonomics calibrated** to research baselines: WCAG 2.1 contrast (4.5:1 body text, 3:1 UI elements), Treisman feature-integration (color/size/shape pop-out), Norman affordance theory (interactive things must look interactive), Fitts's Law (bigger targets faster + more confident), 60-30-10 color rule with Dell-blue ratio bumped from current ~3% to target ~8-10%. Specific visible fixes: stepper clickability cues, layer-name visual treatment in matrix views, single-CTA-per-surface discipline, hover signals across all interactive elements. | User feedback: "everything is grayish and all same color, my eyes can not see where to click or enjoy looking at the screen, isn't there a UI/UX colors best practices as per science and research?" Yes there is, and I was under-applying it. Specific user pain points named: stepper not obviously clickable + layer names look unfinished. |
| **Open clarification ANSWERED 2026-04-27 next session**: user said "the top bar becomes for functional things. we might need to..." (sentence cut off in prior session, picked up at session start). Resolution: **the doc-meta center column is reworked into a functional session strip carrying (a) the workshop / customer name as the primary line and (b) a save-status indicator as the secondary line**, replacing the static mono caps `CUSTOMER . DATE . STATUS` strip. Date and status are demoted to optional drawer detail (no longer earn topbar real estate). | Topbar = interactive things; the prior strip was passive metadata. The user already wants the version chip to leave the topbar (S1); the center column should follow the same rule by carrying live, functional content (always-visible save state + workshop identity). |
| **Hard rule for save indicator copy**: states are exactly `New session` / `Saving...` / `Saved just now` / `Saved Xm ago` / `Demo session`. NO em dashes, NO ellipsis character; literal three dots `...` for `Saving...`. | Copy must satisfy the no-em-dash sweep (VT20) and stay scannable. |

### Section 0 · Services-scope sub-tab removal

| # | Item | Files |
|---|---|---|
| **A** | Remove "Services scope" entry from `REPORTING_TABS` array in `app.js` (between "Vendor Mix" and "Roadmap"). Remove the corresponding `case "services":` from `renderReportingTab` switch. Remove the `import { renderSummaryServicesView }` line. | `app.js` |
| **B** | Delete `ui/views/SummaryServicesView.js` since no caller remains. | view file |
| **C** | Remove the v2.4.12 "Services scope preview card" block from `ui/views/ReportingView.js` `renderReportingOverview` (the §0 services-scope-preview card). The services preview is unnecessary now that the sub-tab is gone; gap and project drawers carry the per-entity info. | `ui/views/ReportingView.js` |
| **D** | Suite 44 VT19 (asserts SummaryServicesView renders `.service-card` grid) is OBSOLETE; delete from `diagnostics/appSpec.js`. | `diagnostics/appSpec.js` |

### Section 1 · Footer version capsule

| # | Item | Files |
|---|---|---|
| **A** | Move `<div class="header-app-version" id="appVersionChip">` from `<header>` to `<footer>` in `index.html`. Keep the same id so `app.js renderHeaderMeta` still sets the text. | `index.html` |
| **B** | Restyle `.header-app-version` rule in `styles.css`: rename to `.footer-version-capsule` (or keep `.header-app-version` for stability, just adjust inside-footer styling). Mono caps 10.5px ink-mute, canvas-soft fill, rule-strong border, 999px radius. Sits at the right edge of the footer, gap auto-pushed by flex. | `styles.css` |

### Section 2 · NEW global AI Assist top-right button

| # | Item | Files |
|---|---|---|
| **A** | NEW `<button id="topbarAiBtn" class="topbar-ai-btn">` in `<header>` `.topbar-actions`, replacing the position vacated by the app-version chip. Label: "✨ AI Assist". | `index.html` |
| **B** | `.topbar-ai-btn` CSS: solid Dell-blue background, white text, subtle hover (Dell-blue-deep). 6px×14px padding, 5px radius, 12.5px font-weight 600. The single most prominent action in the topbar. Click handler attached in `app.js wireTopbarAiBtn()`. | `styles.css`, `app.js` |
| **C** | Click handler calls `openAiOverlay({ tabId, context })`, where `tabId` is `currentStep` and `context` carries the selected entity (driver / instance / gap) if any. | `app.js` |

### Section 2A · Topbar center column rework (answers the "we might need to..." clarification)

| # | Item | Files |
|---|---|---|
| **A** | Restructure `.doc-meta` into a two-line `.session-strip` with id `sessionMetaHeader` (keep id for `renderHeaderMeta` continuity). Line 1: `.session-strip-name` carries the workshop / customer name in Inter 600 14px `--ink` (sentence case, NO mono-caps treatment). Line 2: `.session-strip-status` carries the save indicator in mono caps 10.5px `--ink-mute` 0.06em letter-spacing, with a small leading colored dot (`.session-strip-dot`) that flips green / amber / blue per state. Center column gets `text-align: center`, the two lines stacked. | `index.html`, `styles.css` |
| **B** | NEW `core/saveStatus.js` module exporting `markSaved()`, `markSaving()`, `getStatus()`, `onStatusChange(fn)`, `_resetForTests()`. Status is one of: `idle` (no session yet), `saving` (transient ~250ms pulse), `saved` (with `savedAt: timestamp`), `demo` (when `session.isDemo === true`). Wire `state/sessionStore.saveToLocalStorage()` to call `markSaved()` after the writeback. Wire `core/sessionEvents.emitSessionChanged()` to call `markSaving()` immediately and `markSaved()` after `saveToLocalStorage` completes. | NEW `core/saveStatus.js`, `state/sessionStore.js`, `core/sessionEvents.js` |
| **C** | `app.js renderHeaderMeta()` rebuilt: line 1 reads `session.customer.name || "New session"`. Line 2 reads from `getStatus()` and formats: `idle → "New session"`, `saving → "Saving..."`, `saved → "Saved " + relativeTime(savedAt)`, `demo → "Demo session"`. Subscribe to `onStatusChange(renderSessionStrip)` so the line updates without a full re-render. Tick a 30s interval that re-renders only the secondary line so `Saved 2m ago` keeps incrementing. | `app.js` |
| **D** | Remove the prior `<span><b>LABEL</b> value</span>` markup. Date + status are no longer displayed in the topbar; they remain on the `session.sessionMeta` object and surface in Tab 1 ContextView form (already does). | `app.js`, `index.html` |
| **E** | When no session is loaded (fresh state), show `New session` line 1 + `Empty canvas` line 2 (mono caps), `--ink-faint` color so it reads as "intentionally blank." | `app.js` |

### Section 3 · NEW Overlay component

| # | Item | Files |
|---|---|---|
| **A** | NEW `ui/components/Overlay.js` exporting `openOverlay({ title, lede, body, footer, kind, size, persist, transparent })` and `closeOverlay()` and `isOpen()` and `setTransparent(bool)` and `_resetForTests()`. Module owns the backdrop + panel elements; backdrop click + Escape + ✕ all close (unless `persist: true`, see D). | NEW `ui/components/Overlay.js` |
| **B** | Default size: `~min(720px, 90vw) wide × min(640px, 80vh) tall`. Centered with backdrop blur. Sticky head with title + lede + close. Scrollable body. Sticky footer for primary CTA right + cancel left. `kind` attribute for entity-specific styling hooks (`ai-assist`, `add-current-tile`, `add-desired-tile`, `add-gap`, `add-driver`). | same |
| **C** | `--shadow-panel` token used for the overlay drop-shadow (already in DS1). Animation: `transform: scale(0.96) translateY(8px)` → `scale(1) translateY(0)` with backdrop fade. 200ms cubic-bezier. | `styles.css` for `.overlay`/`.overlay-backdrop` rules |
| **D** | **Persistence mode** (`persist: true`): backdrop click and Apply-style buttons inside the body do NOT close the overlay. Only Escape, the explicit close ✕ button, or a "Done" CTA in the footer close it. Used by AI Assist so the user can run multiple skills in one session. Default `persist: false` for "+ Add" flows where Save closes naturally. | `Overlay.js` close-path guard; `.overlay[data-persist="true"]` styling cue (subtle persistent indicator near close button). |
| **E** | **Transparency mode** (`transparent: true` or `setTransparent(true)`): backdrop drops to ~40% opacity, the overlay panel itself goes to ~70% opacity, `pointer-events` pass through to the page underneath everywhere except over the visible skill tile or status row. The user can click an element on the page (gap card, tile, driver) while the overlay stays "alive in the background." Used by AI Assist when a skill needs an element selection (e.g., "click a gap to run the rewriter on it"). Toggle off (`setTransparent(false)`) to return to opaque modal mode. | `Overlay.js` mode toggle, `.overlay.is-transparent` CSS class. |

### Section 4 · AI Assist overlay wiring (refined 2026-04-27)

| # | Item | Files |
|---|---|---|
| **A** | NEW `ui/views/AiAssistOverlay.js` exporting `openAiOverlay({ tabId, context })` that builds the overlay body and calls `Overlay.openOverlay({ persist: true, transparent: false, ... })`. The body contains: tab-context summary at top, **tile grid of skill cards** (not a list), inline result panel that mounts when a tile is clicked, "Done" CTA in the footer (closes the overlay), "All tabs" toggle chip in the head to widen the skill scope. | NEW view file |
| **B** | **Skill tile pattern**. NEW CSS class `.ai-skill-tile`: 200×120px (or grid-auto), white card with hairline border, hover lift, 32×32px icon square in `--dell-blue-soft`, skill name (Inter 600 14px), one-line description (12px ink-soft), small target chip footer ("Tab 4 · Gap"). Click a tile → tile becomes the active selection (Dell-blue border + 3px Dell-blue left bar), result panel mounts below the grid showing the prompt preview + "Run" button. After Run + Apply: result stays in panel, tile stays selected, user can run another skill OR pick a different tile. Persistence (Overlay `persist: true`) ensures Apply doesn't close the overlay. | `styles.css` + `AiAssistOverlay.js` |
| **C** | **Skill scope toggle**. Default skill list filtered by `currentStep` via `skillsForTab(tabId, { onlyDeployed: true })`. A small chip in the overlay head reads "Current tab" / "All tabs". Click to flip; "All tabs" calls `loadSkills().filter(s => s.deployed)` regardless of tab. | `AiAssistOverlay.js` |
| **D** | **Element-pick / transparency flow**. Some skills need the user to pick an entity from the page (e.g., "Suggest services for selected gap" needs a gap selected). When the user clicks Run on such a skill and `context.selectedGap` (or the relevant entity) is missing, the overlay calls `Overlay.setTransparent(true)`. The overlay tile + status row remain visible at ~70% opacity; the rest of the page accepts clicks. The user clicks the desired entity on the page; the click handler emits a custom event that the overlay catches, sets the context, calls `Overlay.setTransparent(false)`, and runs the skill. | `Overlay.js` + `AiAssistOverlay.js` + view click handlers (need to dispatch a `dell-canvas:entity-click` event when in pick-mode) |
| **E** | Remove the existing `useAiButton` mount inside ContextView's right-panel driver detail. AI Assist is now globally accessible from the topbar; per-driver mounting is replaced. Keep the `core/skillStore.js` + `core/skillsEvents.js` infrastructure (PR2 from v2.4.12) untouched; the overlay subscribes via `onSkillsChanged` so the skill tiles refresh when the user adds/edits skills via the gear icon → Skills section. | `ui/views/ContextView.js` (remove inline AI mount) |
| **F** | **Future direction (NOT v2.4.13)**: the gear icon currently opens AI settings + has Skills admin section inline. v2.5.0 or later will make this a proper "control panel" surface. AI Assist (this section) is the user-facing portal; AI Builder (gear → Skills) is the admin surface. Keep separation explicit. | future spec |

### Section 5 · Demo banner on all 5 tabs

| # | Item | Files |
|---|---|---|
| **A** | Extract the existing `renderDemoBanner` from `ContextView.js` into a shared helper module: NEW `ui/components/DemoBanner.js` exporting `renderDemoBanner(target)`. Keeps the existing colorful styling intact (CSS class `.demo-mode-banner` + copy text). | NEW `ui/components/DemoBanner.js` |
| **B** | Mount the helper at top of every view's left panel when `session.isDemo === true`: `ContextView`, `MatrixView` (Tabs 2 + 3), `GapsEditView` (Tab 4), Reporting sub-tab views (`ReportingView`, `SummaryHealthView`, `SummaryGapsView`, `SummaryVendorView`, `SummaryRoadmapView`). | each view file |
| **C** | Banner styling stays as-is (philosophy hard rule: don't break what user explicitly likes). | `styles.css` (no changes needed) |

### Section 6 · Stepper clickability cues

| # | Item | Files |
|---|---|---|
| **A** | Hover state: `.step:hover` gets `background: var(--canvas)` (subtle but visible cursor-feedback against the canvas-soft stepper band) + `.step-num` color shifts to `--dell-blue` so the cursor-over signals "I will activate this." | `styles.css` |
| **B** | Active step: keep dell-blue-faint background tint, bump the `.step-label` weight from 500 to 600 + `.step-num` weight from 600 to 700 + `.step-num` color stays Dell-blue + add a small `▸` chevron prefix before the step number on the active step (or a 3px Dell-blue left vertical mark) so active reads as "you are here." | `styles.css`, `app.js renderStepper` |
| **C** | Slightly bigger labels: `.step-label` font-size 13 → 14px, `.step-num` 11 → 12px. Bigger Fitts target. | `styles.css` |

### Section 7 · Layer-name visual treatment in matrix views

| # | Item | Files |
|---|---|---|
| **A** | Layer headers in MatrixView (Tabs 2 + 3) currently render as plain ink-mute small text. Bump to 14px ink 600 + Inter, with a 4×100% left bar color-coded by layer (signal palette). Mapping: workload = dell-blue-soft (neutral lead), compute = amber, storage = amber, network/infrastructure = green, data protection = red, virtualization = dell-blue. | `ui/views/MatrixView.js`, `styles.css` (`.matrix-layer-header` + `.matrix-layer-bar`) |
| **B** | Mono caps eyebrow above each layer header: `LAYER · COMPUTE` etc., using the `.eyebrow` utility class. Aids scanning across layer groups. | view file |
| **C** | Consistent treatment in any other place that lists layers (filter chips already use chip-filter; this targets the layer-grouped HEADERS only). | view files |

### Section 8 · Brand-blue ratio calibration

| # | Item | Files |
|---|---|---|
| **A** | Calibrated audit pass on `styles.css`: target Dell-blue surface coverage ~8-10% (was ~3% post-chunk-3). | `styles.css` |
| **B** | Apply Dell-blue accent to: active stepper step background + label (already done chunk 3), filter-chip active state (background `--dell-blue-soft` + text `--dell-blue-deep`), hover states across `.btn-ghost` (already in CSS), card hover left-bar accent (NEW class `.card-hover-bar`), section eyebrow rules (`.eyebrow-rule::before` 36px line). | `styles.css` |
| **C** | Single primary CTA per surface in solid Dell-blue (`.btn-primary`). Save buttons, Approve, Run skill, Add. Everything else demoted to ghost. | view files |

### Tests · Suite 45 (VT21-VT28)

| # | Test | Asserts |
|---|---|---|
| **VT21** | Services-scope sub-tab REMOVED from REPORTING_TABS | `app.js REPORTING_TABS` array has no entry with `id: "services"`. `renderReportingTab` switch has no `case "services"`. |
| **VT22** | App version chip in FOOTER, not topbar | `<header>` does NOT contain `#appVersionChip`. `<footer>` DOES contain `#appVersionChip` with text matching `/^Canvas v/`. |
| **VT23** | Global AI Assist button in topbar | `.topbar-actions` contains `#topbarAiBtn` with class `.topbar-ai-btn`. Visible (not display:none). Background resolves to Dell-blue. |
| **VT24** | Overlay.js module open/close | `openOverlay({...})` adds `.overlay.open` to DOM. `closeOverlay()` removes it. Escape closes. Backdrop click closes. Click inside panel does NOT close. `isOpen()` returns boolean. |
| **VT25** | AI button click opens overlay | Click `#topbarAiBtn` → `.overlay.open` appears with kind="ai-assist" + a skill list element. |
| **VT26** | Demo banner on all 5 tabs when isDemo=true | Render each view with a demo session; assert each renders a `.demo-mode-banner` element in the left panel. |
| **VT27** | Stepper hover affordance | Programmatic hover on a step: `getComputedStyle(step:hover)` background changes. Cursor stays pointer. |
| **VT28** | Layer name visual treatment | Render MatrixView with multiple layers; assert each `.matrix-layer-header` has font-size >= 14px, font-weight >= 600, ink color, plus a `.matrix-layer-bar` left-bar element with a non-transparent background-color. |

### Section R · Regression guards (smoke checklist)

| Guard | Check |
|---|---|
| **R1** | v2.4.12 R1-R10 all stay GREEN (services chips on gap drawer + AI dropdown auto-refresh on skill changes + ContextView no-op Save preserves isDemo + Roadmap project-card chip pills + everything from the v2.4.12 final smoke) |
| **R2** | Phase 19m chunks 1-3 wins preserved (white topbar with hairline + leading-zero stepper + local Dell logo + design tokens + eyebrow utility + dash-bullet pattern + em-dash absence + services domain mapping) |
| **R3** | Top-right shows AI Assist button as the visible primary action (not the version chip) |
| **R4** | Footer shows version capsule at the right edge |
| **R5** | Click AI Assist in any tab → overlay opens centered with backdrop blur + skill list scoped to that tab. Esc + backdrop + ✕ all close. |
| **R6** | Load demo → banner visible on Tab 1, 2, 3, 4, 5 (and on each Reporting sub-tab) |
| **R7** | Hover any stepper step → cursor pointer + background tint shows. Active step has clear "you are here" signal (chevron prefix + bolder weight + Dell-blue tint). |
| **R8** | Tab 2 + 3 layer headers render with bigger ink type + a color-coded left bar per layer + mono caps eyebrow above |
| **R9** | Brand-blue coverage visible without being loud: active stepper, AI Assist button, primary CTAs, hover states, eyebrow rules. Estimate ~8-10% surface area. |
| **R10** | Hard refresh on every tab → no console errors |
| **R11** | No em dashes in any source file (re-run VT20 sweep) |
| **R12** | Topbar center column shows the workshop / customer name as line 1 (Inter ink) + save indicator as line 2 (mono caps with colored leading dot). State transitions: open fresh → "New session" + "Empty canvas"; load demo → "Demo session" + "Demo session"; type into Tab 1 customer field → "Saving..." pulse, then "Saved just now"; wait 30s → "Saved 1m ago". |

### Effort: ~2 focused days · single tag

Day breakdown:
- **Day 1**: §0 services-scope removal + §1 footer version capsule + §2 + §3 + §4 (AI Assist top button + Overlay.js + AI overlay wiring).
- **Day 2**: §5 demo banner everywhere + §6 stepper clickability + §7 layer-name treatment + §8 brand-blue calibration + Suite 45 tests + §R smoke + tag.

### Tag protocol (per locked discipline)

1. Spec committed (this entry). Wait for sign-off before tests/code.
2. Tests committed (Suite 45 VT21-VT28). Fail RED at first.
3. Code execution: §0 → §8 in order.
4. Browser smoke against §R guards. Report results.
5. Pause for explicit "tag it" approval.
6. Tag, push, update memory + HANDOFF.

### What rolls forward to v2.5.0 (after v2.4.13 ships)

v2.5.0 reduces in scope. The intermediate items absorbed by v2.4.13:
- Services-scope sub-tab removal (was v2.5.0 §7)
- Overlay component (introduced in v2.4.13 §3, v2.5.0 just uses it for "+ Add" flows)
- Global AI Assist (replaces v2.5.0 §AI per-tab mounting)
- Demo banner everywhere (was v2.4.13 backlog A4.1)
- Stepper clickability + layer-name treatment + brand-blue calibration (parts of v2.5.0 §3 color discipline)

v2.5.0 retains:
- Drawer module + per-tab drawer wiring (click-existing-entity flows)
- Detail panel universal template across all 5 entity types (DP1-DP10)
- Cross-tab filter system (F1-F6)
- Tag vocabulary migration (TV1-TV9)
- + Add flows wired to the overlay component (NEW; "+ Add" in current/desired/gaps/drivers opens overlay)

---

## v2.5.0 · Crown-jewel UI rework · LOCKED 2026-04-26 (REDUCED SCOPE 2026-04-27 after v2.4.13 carved out)

### Scope reduction notice (2026-04-27)

After Phase 19m chunks 1-3 visual-foundation work shipped, user feedback led to pulling a focused set of intermediate UX/UI patches into a NEW v2.4.13 release that ships first. This v2.5.0 spec is now reduced. The following items moved out:

| Was in v2.5.0 | Now in | Status |
|---|---|---|
| §7 Services scope sub-tab redesign (SR1-SR4) | v2.4.13 §0 | Sub-tab being REMOVED entirely (not redesigned). Services info already on gap and project drawers. |
| §AI per-entity AI mounting (AI1-AI5) | v2.4.13 §2 + §4 | Replaced by v2.4.13 single global "AI Assist" top-right button + overlay. Per-entity drawer-inline AI dropped. |
| Overlay component for "+ Add" flows | v2.4.13 §3 | NEW Overlay.js shipped in v2.4.13 (used initially for AI Assist). v2.5.0 then uses the same Overlay.js for "+ Add tile / + Add gap / + Add driver" flows. |
| §3 Color discipline pass partial: stepper clickability + layer-name treatment + brand-blue ratio bump 3% to 8-10% | v2.4.13 §6, §7, §8 | Visible quick-wins land first; the rest of §3 (single-CTA-per-surface discipline + layered signal mapping) stays in v2.5.0. |
| Demo banner on all 5 tabs | v2.4.13 §5 | User explicitly likes the existing colorful demo banner styling; lives in v2.4.13. |
| Suite 44 VT19 (services-scope grid) | DELETED | Sub-tab removed; test obsolete. |
| Suite 44 VT16 (per-entity AI mount) | TO BE REVISED | Will be retargeted at the global AI Assist button in v2.4.13 (re-tested as VT25 in Suite 45). |

What v2.5.0 retains (after reduction):
- §1 Design system foundation (DS1-DS8): mostly already shipped in chunks 1-3; remaining DS6 callout block + DS7 shared band + DS3 single .tag primitive
- §2 Topbar + footer (TB1-TB6): mostly already shipped in chunks 2-3; remaining TB5 footer rework (other than the version capsule v2.4.13 ships)
- §3 Color discipline (CD1-CD5) RESIDUAL: single-CTA-per-surface + layered signal-color mapping (the parts not in v2.4.13)
- §4 Detail panel universal template (DP1-DP10): the big one. Sticky head with crumbs + STATUS STRIP + KEY ATTRIBUTES tech-grid + hairline-divided sections + dash-bullets + sticky footer + per-entity body adaptations across gap / current-tile / desired-tile / project / driver. Project drawer body absorbs the services scope info that previously needed a sub-tab.
- §5 Drawer pattern (DR1-DR9): drawer-everywhere on Tabs 1-5 for click-existing-entity flows, using the existing Drawer.js stub
- §6 Cross-tab filter system (F1-F6): body data-attribute pattern, multi-chip selectors, opacity dim
- §7 Services scope redesign · DROPPED (moved to v2.4.13 §0 as removal)
- §8 Tag vocabulary migration (TV1-TV9): consolidating 11+ chip / badge classes to one .tag primitive
- §AI · DROPPED (moved to v2.4.13 §2 + §4 as global AI Assist)
- NEW §+Add (v2.5.0 addition): wire "+ Add tile / + Add gap / + Add driver" buttons to open the v2.4.13 Overlay.js component instead of the current inline form. Adds a 2-column overlay layout: form fields left + AI assist panel right. Per-entity overlay bodies follow the same structural template as drawer bodies but at the larger overlay size.

Effort estimate revised: ~3 days (was ~4) since the topbar + stepper + audit + design-system foundation work already landed in chunks 1-3 and v2.4.13 absorbed the AI mounting and overlay component construction.

---

### Theme

Discovery Canvas at v2.4.12 has the right tokens (Inter, JetBrains Mono, Dell palette, radii 4/6/10) but the wrong structure. Phase 15.3 swapped values; v2.5.0 swaps the visual language and information architecture. The goal is to take the same data the app already manages (drivers, gaps, projects, services) and make it read as an executive-grade artifact: scannable on the surface, complete on demand, restrained in chrome, considered in detail.

### Sources of design truth (single canonical reference set)

1. The Dell Advisory Design System philosophy document (provided by the user 2026-04-26). Five principles: ONE signature color, whitespace as a design element, typography does heavy lifting, details compound into perceived quality, interactivity must serve the story. Anti-pattern list and writing rules treated as hard constraints.
2. The GPLC Digital Unified Platform v1.0 reference HTML (`C:/Users/Mahmo/Downloads/GPLC Digital Unified Platform v1.0.html`). The component vocabulary patterns adopted verbatim where they fit (eyebrow, slide-out panel, tag, callout, shared band) and rejected where they conflict with the workshop tool's interaction model (chapter TOC, document-width column, hero per page).
3. Memory `project_crown_jewel_design.md` (the previous-session ranking and split decisions). Stays load-bearing.

### Locked decisions (do not re-litigate during implementation)

| Decision | Why |
|---|---|
| **Drawer-everywhere on Tabs 1-5**: every entity opens in the slide-in drawer pattern. Click a driver tile, current tile, desired tile, gap card, project card, or service row, the drawer slides in from the right at 560px width. Tabs 1-4 lose the persistent right panel; the left panel takes the full viewport width. The drawer carries the visual meat (sections, signal chips, edit fields, AI assist, save/cancel actions). Click another card while a drawer is open: the body content transitions in place, no close-then-open. Click backdrop / press Escape / click ✕: drawer closes. | The user reviewed the GPLC sample and confirmed the drawer pattern is the desired interaction model across the whole app. Edit-flow concerns are mitigated because the kanban / matrix is still ~75% visible behind the drawer on standard monitors, and clicking another card transitions the drawer content rather than forcing close-then-reopen. |
| **No view/edit-mode toggle**: edit-heavy entities (gaps, current and desired tiles, drivers) keep edit-by-default; click a card, drawer opens with form fields focused. Read-only entities (projects, services scope) are read-by-default by virtue of being computed. The "view first, click Edit" pattern from mainstream SaaS adds a click per tile across hundreds of tiles in a workshop session, with no offsetting benefit because the panels are already short and the app is single-user. | User decision 2026-04-26 after weighing the workflow cost. Locked: do not add view/edit toggle in v2.5.0 or v2.5.1. |
| **Local Dell logo**: keep the current local `Logo/` asset. No `i.dell.com` CDN dependency. The philosophy's "brand divider + two-line brand text" pattern wraps the local asset. | User decision 2026-04-26: offline-safe testing, no broken-image risk, local logo already correct. |
| **Layered signal colors**: urgency level (High / Medium / Low) renders red / amber / green respectively as chip color. Domain (cyber resilience driver, ops gap type, data-protection layer, etc.) renders red / green / amber as a left-bar accent or icon background. Blue is reserved for Dell-mapped solutions and the single primary CTA per surface. Two layers do not collide because they apply to different visual roles (chip color vs accent line vs icon background). | Honors "ONE signature color" while still using the philosophy's signal palette where it carries real meaning. |
| **No em dashes anywhere**: UI copy, comments, docs, demo session text, seed-skill prompts. Use commas, periods, parentheses, colons. | Philosophy hard rule. Em dashes read AI-generated and the user catches them. |
| **Sentence case for headings**, Title Case reserved for proper nouns. | Philosophy rule. |
| **Real Dell logo from `i.dell.com` CDN**. No "D" placeholder. | Philosophy rule. |
| **Hover-only shadows** (default state has none). | Philosophy + GPLC pattern. |
| **One `.tag` primitive** with `data-variant` attribute, replacing all 11+ existing chip / badge / pill classes. | Vocabulary unification. Lower CSS surface area, clearer mental model. |
| **Drawer scope (Tab 5)** uses 560px width, translateX slide, 300ms cubic-bezier ease, backdrop blur 2px + 32% ink-blue dim, sticky head with crumbs + close, scrollable body, hairline-divided sections, mono uppercase eyebrow per section. | GPLC sample exactly. |
| **Filter implementation** uses body data attributes (`body[data-filter-services="migration deployment"]`). Non-matching items dim to opacity 0.18-0.30 with grayscale(.5). Re-clicking active filter clears it. Default match mode is OR (any chip in selection matches); a small toggle exposes AND for power users. | Philosophy + GPLC pattern. |
| **No "Export PDF" or "Share" buttons** in the topbar by default. | Philosophy anti-pattern. |
| **No emoji as functional icons**. Replace `↶ ↶↶ ✨ + ↺ ✕ ★ ↳` etc. with a single SVG icon library (Lucide, deferred to v2.5.1). v2.5.0 keeps existing emoji in place but flags every site for v2.5.1 replacement. | Philosophy anti-pattern; SVG migration is a mechanical pass that warrants its own slice. |

### Section 0 · Pre-flight audit pass (audit + fix in same pass; mechanical)

Each item is a grep, a read, a small fix. No structural risk. Done first to reset the project to the philosophy baseline before structural work lands on top.

| # | Audit | Fix |
|---|---|---|
| **A1** | Em-dash sweep across `app.js`, `core/`, `state/`, `interactions/`, `services/`, `ui/`, `diagnostics/`, `docs/`, `index.html`, `styles.css`. | Replace with commas, periods, parens, colons. UI copy first; comments + docs second. |
| **A2** | Dell product accuracy in demo session + seed-skill prompts. Specifically: `g-003` says "VxRail (VMware-based HCI)"; reposition to lead with **Dell Private Cloud on PowerFlex via Dell Automation Platform** with VxRail as a still-supported alternative if customer is committed to VMware. Verify no Boomi (sold 2021), no Secureworks/Taegis (sold to Sophos 2025), SmartFabric Director referenced as SmartFabric Manager, CloudIQ referenced under APEX AIOps, VMware framed as a partner not a Dell brand. | Update `state/demoSession.js` strings; update any seed-skill `systemPrompt` or `promptTemplate` that names a sold or renamed product. |
| **A3** | Heading case audit. Anything in Title Case that is not a proper noun becomes sentence case. Examples to check: "Discovery context", "Strategic Drivers" (the brand-name "Strategic Drivers" stays per customer convention), "Mapped Dell solutions", "Services scope", view titles in Reporting sub-tabs. | One-by-one review; flag ambiguous cases for user. |
| **A4** | Default classification text. Session status default is currently "Draft"; verify it reads "Draft" or "Initial Arc. Draft" everywhere it surfaces. Confirm "Client Confidential" appears nowhere. | Adjust copy if any drift. |
| **A5** | Topbar action audit. List every button / link / chip currently rendered in the topbar (`renderHeaderMeta`, the gear icon, etc.). Confirm there is no Export PDF, no Share, no marketing copy. | Remove offenders. Keep gear (settings), Undo, version chip. |
| **A6** | Real Dell logo verification. Check `index.html` and `app.js renderHeaderMeta` for the brand mark. If absent or placeholder, plan inclusion of `i.dell.com` CDN URL (TB2 in §2). | Lookup canonical CDN URL during implementation; fall back to a local SVG asset only if CDN unavailable. |
| **A7** | Anti-pattern sweep on `styles.css`: drop shadows on default states (move to `:hover` only); bold colored backgrounds for layers / sections (replace with hairline + soft tint); decorative gradients (kill except for the hero-strip and shared-band patterns). | Mechanical CSS edit. Tests catch breakage. |

### Section 1 · Design system foundation (DS1-DS8)

Foundation that everything else builds on. Pure CSS plus a tiny utility class set.

| # | Item | Effort |
|---|---|---|
| **DS1** | CSS token layer in `styles.css`. 4-tier ink (`--ink`, `--ink-soft`, `--ink-mute`, `--ink-faint`). 3-tier surface (`--canvas`, `--canvas-soft`, `--canvas-alt`). Hairline scale (`--rule` light, `--rule-strong` dividers). Signal palette (`--red / --red-soft`, `--green / --green-soft`, `--amber / --amber-soft`). Hover-only shadow scale (`--shadow-sm`, `--shadow-md`, `--shadow-lg`). Brand: `--dell-blue`, `--dell-blue-deep`, `--dell-blue-dark`, `--dell-blue-ink`, `--dell-blue-soft`, `--dell-blue-faint`. Verify against the philosophy doc verbatim. | 30 min |
| **DS2** | Eyebrow utility. CSS class `.eyebrow` (mono 10.5px, uppercase, 0.18-0.22em letter-spacing, color `--ink-mute` by default, `--dell-blue` variant via `.eyebrow-blue`, optional 36-60px blue accent line via `::before` on `.eyebrow-rule`). | 20 min |
| **DS3** | ONE `.tag` primitive with `data-variant`. Variants: `neutral` (default, `--ink-mute` border + text), `emphasis` (Dell blue border + ink text), `filled` (Dell-blue-soft fill + Dell-blue-deep text), `state` (dashed border, lower opacity, used for closed gaps), `signal-r` / `signal-a` / `signal-g` (red / amber / green border + matching color text + soft-fill background). All variants share: mono 9.5-10.5px, uppercase, 0.12em letter-spacing, 2px radius, 2px×6px padding. | 30 min |
| **DS4** | Hairline section pattern. CSS class `.section` with optional eyebrow above + 1px hairline rule + 22-24px top padding. First-child `.section` has no rule. Replaces most "card-in-card" nesting. | 20 min |
| **DS5** | Card primitive aligned to GPLC. White background, 1px `--rule` border, 5px radius (`--radius-md`), generous padding. Hover: 1px lift via `translateY(-1px)`, border switches to `--dell-blue` (or signal color via `data-pillar`), `--shadow-md`, optional 3px Dell-blue left bar via `::before` opacity transition. Cursor pointer only when card is clickable. | 30 min |
| **DS6** | Callout block pattern. Four variants (red / blue / green / amber), each 3px colored left border, 1px hairline border, soft-tint background, mono caps label inside, body copy. Used to highlight critical notes inside detail panels. | 20 min |
| **DS7** | Shared band pattern. Full-width band, 2px Dell-blue top border, soft Dell-blue-faint gradient background, floating mono caps label on the top edge. Used for "Demo mode" announcement and "Auto-drafted gaps need review" notice (replacing today's `.demo-mode-banner` and `.auto-gap-notice`). | 30 min |
| **DS8** | Mono tabular-nums on every numeric surface. Driver priorities, gap counts, vendor mix percentages, urgency badges, services scope counts. CSS rule `font-variant-numeric: tabular-nums` applied to a `.metric` utility class plus inline on the relevant render sites. | 15 min |

### Section 2 · Topbar and footer rework (TB1-TB6)

Header is the most visible "this is the new design" surface. Get this right and the rest signals correctly.

| # | Item | Effort |
|---|---|---|
| **TB1** | White topbar with bottom hairline, replacing the blue-gradient `.app-header`. Sticky, 72px tall, `backdrop-filter: saturate(180%) blur(8px)`. | 30 min |
| **TB2** | Keep current local Dell logo asset. 44px tall, locally hosted, offline-safe. Wrap with brand divider (1px × 32px `--rule-strong`) and brand text (two-line: Inter 600 13px application name + JetBrains Mono 10.5px uppercase mute subtitle "DISCOVERY CANVAS · DELL TECHNOLOGIES"). No CDN dependency. | 20 min |
| **TB3** | Doc-meta strip in the centre column: mono 10.5px uppercase 0.06em letter-spacing, customer name + date + status + canvas version, separated by 1px × 14px vertical rules. Replaces today's pipe-delimited string. | 30 min |
| **TB4** | Topbar actions on the right column. Keep: gear (settings), Undo button (when applicable). Verify: no Export PDF, no Share, no marketing copy. | 15 min |
| **TB5** | Footer rework. 2px Dell-blue top border, 3-column grid (about / prepared by / classification stamp). Matches the philosophy footer pattern at lower density (no register / contact info needed for an internal workshop tool). | 30 min |
| **TB6** | Stepper restyle to match the philosophy "L.01 leading-digit-blue" idiom. Each step renders mono `01` `02` `03` `04` `05` (leading zero, blue) followed by sentence-case label in Inter 500. Active step gets a Dell-blue 2px bottom rule, not a filled background. | 30 min |

### Section 3 · Color discipline pass (CD1-CD5)

Brings brand-blue surface area from ~30% to ~5% of pixels.

| # | Item | Files |
|---|---|---|
| **CD1** | Audit + replace blue chrome. Active tab background, button fills, chip borders, kanban-column accents, summary tab active state. Replace with neutral defaults; reserve blue for accent rules, hover, active border-only states, single-CTA fills. | `styles.css`, all `ui/views/*` |
| **CD2** | Active states use blue accent only (border or 2px bottom rule), not filled background, except for the single primary CTA per surface. | same |
| **CD3** | Layered signal mapping. Urgency level renders as chip color (`.tag[data-variant="signal-{r,a,g}"]`). Domain accents render as left-bar (`.card[data-domain="cyber"]::before` etc.) or icon background (`.card-icon[data-domain="ops"]`). Both layers can apply to the same card without color collision. | `styles.css`, `ui/views/GapsEditView.js`, `ui/views/SummaryGapsView.js`, `ui/views/SummaryRoadmapView.js` |
| **CD4** | Single primary CTA per surface in solid Dell-blue. Everything else is `.btn-ghost` (border only, ink-soft text, hover changes border + text to blue). Audit: "Save context", "Save changes", "Approve draft", "Load demo", "+ Add gap", "↻ Refresh", "✓ Apply", "Skip", etc. Identify the ONE primary per view; demote the rest. | view files |
| **CD5** | Color-coded domain mapping baked into `core/services.js` (or a new `core/domains.js` if cleaner). Each catalog id has an optional `domain: "cyber" \| "ops" \| "data" \| null` so the chip can pick its accent automatically. Migration / deployment / training default to null. Runbook + managed → "ops". Decommissioning → "ops". Assessment → null. | `core/services.js`, `ui/views/GapsEditView.js` |

### Section 4 · Detail panel restructure (DP1-DP10)

Universal template applied to every detail panel across all five tabs. Same shell, body sections vary by entity. The template grounds in three cognitive-psychology principles:

- **Miller's Law (~7±2 chunks in working memory)**: chunk attributes into 4-6 visual units via the tech-grid 2-col mini-cards. Sections of 5-6 lines max.
- **Hick's Law (decision time scales with log of options)**: collapse non-essential sections by default. Sections render only when relevant data exists.
- **Gestalt principles** (proximity, similarity, closure): hairline rules group sections without heavy borders. Repeating chip / eyebrow / link patterns aid recognition over recall.
- **Fitts's Law**: primary CTA in sticky footer at bottom-right (canonical). Cancel left, demoted.

#### Universal template (every drawer body renders this shell)

```
┌─ Sticky head ──────────────────────────────┐
│ MONO CRUMBS · CONTEXT · LEAF          ✕   │  orientation
│ Sentence case title (26px)                 │  what is this
│ One-line lede (14.5px ink-soft)            │  why it matters in one breath
└────────────────────────────────────────────┘
┌─ Body (scrollable) ────────────────────────┐
│ STATUS STRIP (signal chips, optional)       │  ≤3 chips, at-a-glance
│ ───hairline─────────────────────────────── │
│ KEY ATTRIBUTES (tech-grid 2-col × N rows)   │  Miller chunk
│ ───hairline─────────────────────────────── │
│ ENTITY-SPECIFIC SECTIONS (vary)             │
│   • each with mono caps blue eyebrow        │  similarity / closure
│   • hairline between sections               │
│   • dash-bullet lists, chip rows, tech-grid │
│ ───hairline─────────────────────────────── │
│ AI ASSIST (always last, before footer)      │  predictable location
│   [✨ Use AI ▾] (skills filtered by entity) │
└────────────────────────────────────────────┘
┌─ Sticky footer (actions, edit-mode only) ──┐
│ [Cancel]  [secondary]    [Save] (primary)  │  Fitts: bottom-right
└────────────────────────────────────────────┘
```

#### Per-entity body adaptations (shell stays, sections vary)

| Entity | Where it lives | Body sections in order |
|---|---|---|
| **Gap** | Tab 4 click any gap card · Tab 5 Gaps Board click any gap card | STATUS STRIP / KEY ATTRIBUTES / MAPPED DELL SOLUTIONS / SERVICES NEEDED / BUSINESS CONTEXT / AFFECTED LAYERS / LINKED INSTANCES / AI ASSIST |
| **Current tile** | Tab 2 click any tile | STATUS STRIP / KEY ATTRIBUTES / MAPPED ASSETS (Phase 16 workload mapping) / BUSINESS CONTEXT / LINKED GAPS / AI ASSIST |
| **Desired tile** | Tab 3 click any tile | STATUS STRIP / KEY ATTRIBUTES / DELL SOLUTION FAMILY (matched, optional) / DISPOSITION + ORIGIN / BUSINESS CONTEXT / LINKED GAPS / AI ASSIST |
| **Project** | Tab 5 Roadmap click any project card | STATUS STRIP / KEY ATTRIBUTES (env, layer, gapType, phase, urgency, gap-count) / DRIVER / CONSTITUENT GAPS (list with click-to-navigate) / DELL SOLUTIONS / SERVICES SCOPE / AI ASSIST |
| **Service** | Tab 5 Services scope click any per-service row | KEY ATTRIBUTES (id, gap-count, project-count) / TYPICAL SCOPE (catalog hint expanded into one paragraph) / GAPS USING THIS SERVICE / PROJECTS / AI ASSIST |
| **Driver** | Tab 1 click any driver tile | KEY ATTRIBUTES (priority, gap count, project count) / CONVERSATION STARTER (the strategic question text) / OUTCOMES (textarea) / LINKED GAPS / AI ASSIST |

Five entity types, one structural template. Once a presales engineer has used one drawer they know how to navigate every other drawer.

#### DP items

| # | Item | Files |
|---|---|---|
| **DP1** | Sticky head pattern. Mono uppercase breadcrumbs (`GAP · CYBER RESILIENCE · REPLACE · DATA PROTECTION` for a gap; `DRIVER · CYBER RESILIENCE` for a driver; etc.), 26px sentence-case h3 title, 14.5px lede (one breath of context), 32px circular close button. | all detail-panel renders |
| **DP2** | STATUS STRIP. Up to 3 signal chips (urgency, gapType, status, priority) rendered as `.tag[data-variant="signal-r/a/g"]` or `.tag[data-variant="emphasis"]`. Sits above tech-grid; absent when no signals apply (Hick's Law: don't show empty rows). | all renders |
| **DP3** | KEY ATTRIBUTES tech-grid (2-col × N rows). 12-14px padding per cell, soft Dell-blue-faint background, 3px Dell-blue left border, mono uppercase 10px label + 13px Inter 500 value. 4-6 cells per panel (Miller chunk). | `styles.css`, all renders |
| **DP4** | Hairline-divided sections in the body. Each section has a mono uppercase blue eyebrow (`MAPPED DELL SOLUTIONS`, `SERVICES NEEDED`, `BUSINESS CONTEXT`, `LINKED INSTANCES`, `AI ASSIST`). 1px top hairline + 22-24px top padding between sections. First section has no hairline. | `styles.css`, all renders |
| **DP5** | Dash-bullet list pattern. Replace `•` and default `<ul>` styling with the GPLC dash-bullet: 6×2px Dell-blue rectangle 9px from top of each `<li>`. 13.5px Inter, ink color, 1.5 line-height. Used for solutions lists, linked instances, constituent gaps. | `styles.css` (`.panel-section li::before`) |
| **DP6** | Sticky footer for edit-heavy entity types (gap, tile, driver). Cancel left, secondary middle (e.g. "Approve draft"), primary "Save" right per Fitts. Read-only entities (project, service) have no footer; the drawer has only a close button in the head. | view renders |
| **DP7** | Sections render only when their data exists (Hick's Law). Examples: "Affected layers" hidden when only one layer; "Linked instances" hidden when zero; "Mapped Dell solutions" shows "None mapped yet" inline rather than the section heading when empty (better than hiding, because the absence is informative for a Dell-mapping workshop). | per-entity view renders |
| **DP8** | Callout integration. Inside drawer bodies, the DS6 callout block surfaces: red callout for "Review needed" notices on auto-drafted gaps, blue callout for AI-applied changes (cite the skill name + the count), amber callout for recently-closed gaps, blue callout for the auto-suggested-driver chip when the driver is inferred. Replaces today's inline `.review-needed-banner` and `.auto-driver-chip` styles. | view renders, `styles.css` |
| **DP9** | First field auto-focus on drawer open for edit-heavy entities. Adding a new gap: focus the description input. Editing an existing gap: leave focus off (read mode), require user to tab into a field. Adding a new tile: focus the label input. Reduces clicks for the common workshop entry path. | drawer wiring in views |
| **DP10** | Migrate every existing detail-panel render to the new template. Sites: `ui/views/ContextView.js` (driver detail), `ui/views/MatrixView.js` (current + desired tile detail), `ui/views/GapsEditView.js renderGapDetail`, `ui/views/SummaryGapsView.js renderGapDetail`, `ui/views/SummaryRoadmapView.js renderProjectDetail`, `ui/views/SummaryServicesView.js` (NEW per-service drawer body, see SR1). Keep functional contracts (save buttons, link navigation, AI button mounting) intact; only restructure markup + styling. | all view files |

### Section 5 · Drawer pattern, drawer-everywhere on Tabs 1-5 (DR1-DR9)

Universal interaction model. Click any entity card / tile / row on any tab, drawer slides in from the right at 560px width, body renders per the §4 universal template. The right panel as a fixed half-viewport disappears entirely; the left panel takes the full viewport width on every tab. Free-win extra real estate for the kanban (Tab 4), matrix grid (Tabs 2-3), context form + driver tiles (Tab 1), and reporting sub-tabs (Tab 5).

| # | Item | Files |
|---|---|---|
| **DR1** | Drawer container module. NEW `ui/components/Drawer.js` exporting `openDrawer({ crumbs, title, lede, body, footer, kind })` and `closeDrawer()`. The module owns the backdrop element + panel element, handles slide-in / slide-out animation (300ms cubic-bezier .4 0 .2 1), sticky head construction, body scroll, focus management, Escape key handler. `kind` parameter is one of `gap / current-tile / desired-tile / project / service / driver` so the module can apply entity-specific styling hooks. | NEW `ui/components/Drawer.js` |
| **DR2** | Close paths. Click anywhere on backdrop → close. Escape key → close. ✕ button → close. Click inside panel body or head → no propagation. Body gets `overflow: hidden` while drawer is open to prevent background scroll. Save button click on edit-mode footer triggers save then close. | same |
| **DR3** | Tab 1 Context wiring. ContextView's left panel shows the customer identity form + driver tiles full-width. Click a driver tile → drawer opens with driver body (KEY ATTRIBUTES / CONVERSATION STARTER / OUTCOMES textarea / LINKED GAPS / AI ASSIST). The right panel as a fixed half-viewport is removed. | `ui/views/ContextView.js` |
| **DR4** | Tabs 2 + 3 Current and Desired State wiring. MatrixView's left panel shows the matrix grid full-width (more columns visible at once, larger cells, easier scanning). Click a tile → drawer opens with tile body (STATUS STRIP / KEY ATTRIBUTES / MAPPED ASSETS or DELL SOLUTION FAMILY / BUSINESS CONTEXT / LINKED GAPS / AI ASSIST). | `ui/views/MatrixView.js` |
| **DR5** | Tab 4 Gaps wiring. GapsEditView's left panel shows the kanban full-width (3 columns visible without compression, gap cards larger, easier triage). Click a gap card → drawer opens with gap body (full universal template). | `ui/views/GapsEditView.js` |
| **DR6** | Tab 5 Reporting wiring. Sub-tab content takes full width. Click a gap card on Gaps Board → drawer with gap body. Click a project card on Roadmap → drawer with project body. Click a per-service row on Services scope → drawer with service body (NEW affordance the v2.4.12 sub-tab did not have). | `ui/views/SummaryGapsView.js`, `ui/views/SummaryRoadmapView.js`, `ui/views/SummaryServicesView.js` |
| **DR7** | Content-swap on different-card-click. While drawer A is open, clicking another card transitions the drawer body in place: head crumbs + title + lede update, body sections fade-swap (160ms ease), no close-then-reopen. Edit-mode entities prompt for unsaved-changes confirmation before swap. | `ui/components/Drawer.js`, view click handlers |
| **DR8** | Add-new-entity flow. Click "+ Add gap" / "+ Add tile" / "+ Add driver" → drawer opens with empty form, first field auto-focused (DP9). Add-mode footer has Cancel + Save (no Approve etc.). Save closes the drawer + revalidates the left-panel list. | view click handlers |
| **DR9** | Drawer state on hard refresh. Drawer closes by default after refresh; the user returns to the left-panel list. Optional future enhancement: persist last-opened entity id to deep-link back, deferred to v2.5.1 if requested. | `state/sessionStore.js` (no change in v2.5.0; documented for v2.5.1) |

### Section AI · AI assist mounting on every entity drawer (AI1-AI5)

Pulled forward from v2.5.1 U4 per user direction 2026-04-26. Rationale: today's `useAiButton` only mounts inside ContextView's driver-detail right panel, a residual v2.4.0 prototype. Every entity has at least one seed skill targeting it; every drawer body should expose the affordance in the same place.

Predictable location: the AI ASSIST section is always the last body section before the sticky footer (per §4 universal template). User scans any drawer top-to-bottom and finds AI in the same spot every time. Recognition over recall.

| # | Item | Files |
|---|---|---|
| **AI1** | Mount `useAiButton("context", { ... })` in the driver drawer body (Tab 1). Replaces the current ContextView right-panel mounting which goes away with drawer-everywhere. Skill list filters to context-tab skills (`skill-driver-questions-seed`, `skill-context-driver-tuner-seed`). | `ui/views/ContextView.js` |
| **AI2** | Mount `useAiButton("current", { ... })` in the current-tile drawer body (Tab 2). Skill list filters to current-tab skills (`skill-current-tile-tuner-seed`). | `ui/views/MatrixView.js` |
| **AI3** | Mount `useAiButton("desired", { ... })` in the desired-tile drawer body (Tab 3). Skill list filters to desired-tab skills (`skill-desired-tile-tuner-seed`). | same |
| **AI4** | Mount `useAiButton("gaps", { ... })` in the gap drawer body (Tab 4 + Tab 5 Gaps Board). Skill list filters to gaps-tab skills (`skill-gap-rewriter-seed`, `skill-gap-services-suggester-seed`). | `ui/views/GapsEditView.js`, `ui/views/SummaryGapsView.js` |
| **AI5** | Mount `useAiButton("reporting", { ... })` in the project drawer body (Tab 5 Roadmap). Skill list filters to reporting-tab skills (`skill-reporting-narrator-seed`). Service drawer (Services scope) mounts the same context with the service entity passed via `getContext()` so a future service-narrator skill can target it without code change. | `ui/views/SummaryRoadmapView.js`, `ui/views/SummaryServicesView.js` |

Style: AI ASSIST eyebrow renders mono caps blue per §4 DP4. Below the eyebrow, the `useAiButton` instance + a 12px Inter ink-soft hint ("Run any deployed skill targeting this {entity-type}. Manage skills via the gear icon → Skills section.") matches the philosophy's "considered, restrained" copy convention.

PR2 wiring from v2.4.12 (skill-registry change bus + auto-refresh) carries forward unchanged. Adding a skill via Skill Builder while a drawer is open auto-refreshes the dropdown without close-then-reopen.

### Section 6 · Cross-tab filter system (F1-F6)

Multi-dimensional filtering pattern lifted from the philosophy.

| # | Item | Files |
|---|---|---|
| **F1** | Filter state lives on body element as data attributes. `body[data-filter-layer="compute storage"]`, `body[data-filter-services="migration training"]`, `body[data-filter-environment="coreDc"]`, `body[data-filter-driver="cyber_resilience"]`, `body[data-filter-gap-type="replace consolidate"]`. Multi-value via space-separated tokens. | NEW `state/filterState.js` (or extend an existing module) |
| **F2** | Filter chip row on Tab 4 (Gaps) and Reporting Gaps Board (Tab 5 → Gaps Board). Five dimensions: layer, gapType, services, environment, driver. Chips render via `.tag[data-variant="neutral"]` with `.active` state on click. Re-click clears that chip. | `ui/views/GapsEditView.js`, `ui/views/SummaryGapsView.js` |
| **F3** | Match-mode toggle (default OR, optional AND). Single toggle button "Match all chips" (off = OR, on = AND). | same |
| **F4** | Visual dim pattern. Non-matching gap cards drop to opacity 0.18-0.30 + grayscale(.5) via CSS rules keyed on `body[data-filter-*]`. Cards stay in DOM (no reflow churn). | `styles.css` |
| **F5** | Filter persistence. Save active filter state to `localStorage` under `dd_filter_state_v1` so a refresh preserves the user's view. Cleared by the existing "Clear all data" button. | `state/filterState.js`, `state/sessionStore.js` (clear hook) |
| **F6** | Filter visibility on Tab 5 Roadmap is OUT OF SCOPE for v2.5.0 (project cards are an aggregation, not a list of items to filter). May be revisited in v2.5.1 if user requests. | n/a |

### Section 7 · Services scope sub-tab redesign (SR1-SR4)

Replace the v2.4.12 placeholder table with the philosophy's grid + card pattern.

| # | Item | Files |
|---|---|---|
| **SR1** | Hero summary card at top of sub-tab. Eyebrow "SERVICES SCOPE", 26px sentence-case h3 title ("Engagement shape"), one-line lede ("Across N projects, M services drive workshop scope. Click any service for the full list of gaps and projects it touches."). | `ui/views/SummaryServicesView.js` |
| **SR2** | Per-service cards in a `.grid-2` (2-column) layout, each card shaped per DS5 (white, hairline, hover state). Card content: 32px Dell-blue-soft icon square (icon TBD; emoji acceptable in v2.5.0, SVG in v2.5.1), mono caps service id (e.g., `MIG.01`), 14px Inter 600 label, 12px ink-soft hint, footer chip row showing `N gaps`, `M projects` as tabular-num metrics. Click → opens drawer (DR5) with the gap + project list. | same |
| **SR3** | Empty-state card (when no gap has any services attached): centred message + CTA "Open Tab 4 → click a gap → Services needed". Uses DS6 amber callout. | same |
| **SR4** | Below the grid: per-service overlay alerts (DS6 callouts) when a service appears on >= 5 gaps (signals concentration risk worth flagging) or zero projects (signals an orphan service). | same |

### Section 8 · Tag vocabulary migration (TV1-TV9)

Mechanical migration. Find every existing chip / badge / pill class, replace with `.tag[data-variant=...]`, delete the old class. Tests catch any miss.

| # | From (existing class) | To (`.tag[data-variant=...]`) | Site |
|---|---|---|---|
| **TV1** | `.urgency-badge`, `.urg-high`, `.urg-med`, `.urg-low` | `.tag[data-variant="signal-r/a/g"]` | gap card, gap detail, summary gaps |
| **TV2** | `.type-badge` | `.tag[data-variant="emphasis"]` | gap card, gap detail |
| **TV3** | `.status-badge`, `.status-closed-pill` | `.tag[data-variant="state"]` | gap card, gap detail, summary gaps |
| **TV4** | `.services-chip`, `.services-chip-picked`, `.services-chip-suggested` | `.tag[data-variant="filled"]` (picked), `.tag[data-variant="neutral"]` (suggested), with `.is-active` modifier | gap detail, project card, summary gaps |
| **TV5** | `.solutions-chip` | `.tag[data-variant="filled"]` with `.is-dell` modifier (small Dell prefix dot) | project card, gap detail derived list |
| **TV6** | `.chip-filter`, `.chip-filter.active` | `.tag[data-variant="neutral"]`, `.tag.is-active` | filter rows, also-affects layers |
| **TV7** | `.priority-chip`, `.priority-high`, `.priority-medium`, `.priority-low` | `.tag[data-variant="signal-r/a/g"]` | reporting drivers, exec strip |
| **TV8** | `.dell-tag` | `.tag[data-variant="emphasis"]` with prefix slot | scattered |
| **TV9** | `.env-also-chip`, `.also-affects-chip` | `.tag[data-variant="neutral"]` | gap detail "Affected environments" + "Also affects" rows |

After migration, none of the From-classes appear in any rendered DOM. Suite 44 enforces this.

### Section 9 · Tests (Suite 44)

| # | Test | Asserts |
|---|---|---|
| **VT1** | DS1 token presence | `getComputedStyle(document.body)` resolves all named CSS variables (--ink, --canvas, --rule, --dell-blue, --shadow-sm, …) |
| **VT2** | DS2 eyebrow utility | A test fixture with `<span class="eyebrow">label</span>` resolves to mono font, uppercase text-transform, letter-spacing >= 0.18em |
| **VT3** | DS3 single tag primitive | Render any view with chips; assert NO element has class `.urgency-badge` / `.type-badge` / `.status-badge` / `.priority-chip` / `.chip-filter` (non-tag) / `.solutions-chip` etc. Every chip-like element has class `.tag` and a valid `data-variant`. |
| **VT4** | TB1 white topbar | `getComputedStyle(.topbar).backgroundColor` matches `--canvas` (or `rgb(255,255,255)` equivalent). No linear-gradient on header. |
| **VT5** | TB2 local Dell logo | `<img>` or `<svg>` in topbar with src referencing the local `Logo/` asset path. NOT pulled from `i.dell.com` CDN. NOT a placeholder text "D". |
| **VT6** | TB6 stepper leading-zero | Each step element renders text matching `/^0[1-5]\b/` (mono leading-zero) followed by sentence-case label. |
| **VT7** | DR1-DR2 drawer module | `openDrawer({...})` adds `.panel.open` to DOM; `closeDrawer()` removes it; Escape key triggers close; backdrop click triggers close; click inside panel does NOT close. |
| **VT8** | DR3 Tab 1 driver tile click → drawer | Render ContextView, click a driver tile, assert `.panel.open` present and contains the driver title and CONVERSATION STARTER section eyebrow. |
| **VT9** | DR4 Tab 2 + 3 tile click → drawer | Render MatrixView for current state, click any tile, assert drawer opens with KEY ATTRIBUTES tech-grid. Same for desired state. |
| **VT10** | DR5 Tab 4 gap card click → drawer | Render GapsEditView, click any gap card, assert drawer opens with the gap title in the head and a SERVICES NEEDED section in the body. |
| **VT11** | DR6 Tab 5 click paths → drawer | SummaryGapsView gap-card click + SummaryRoadmapView project-card click + SummaryServicesView per-service-row click each open the drawer with the entity's title. |
| **VT12** | DR7 content swap on different-card-click | While drawer A is open, click another card; assert drawer remains `.panel.open` (no close-then-open) and the title text updates to the new entity. Edit-mode entities prompt unsaved-changes confirm before swap (asserted via mock confirm). |
| **VT13** | DP1 sticky head shape | Every entity drawer body (gap / current-tile / desired-tile / project / service / driver) has a `<div class="panel-head">` with `.panel-crumbs` + `<h3>` + `.panel-lede` (lede may be empty for entities without a lede). |
| **VT14** | DP3 KEY ATTRIBUTES tech-grid | Every drawer body for an entity that has key attributes contains a `<div class="tech-grid">` with at least 4 `.tech-item` cells (each with mono caps label + value). |
| **VT15** | DP5 dash bullet | `.panel-section li::before` resolves to a 6×2px element with background `--dell-blue`. |
| **VT16** | AI1-AI5 AI ASSIST mounted on every entity drawer | Every drawer body has an `AI ASSIST` eyebrow followed by a `.use-ai-wrap` element. Wired with the correct tabId per entity (driver → context, current tile → current, desired tile → desired, gap → gaps, project / service → reporting). |
| **VT17** | F1 filter body data attributes | Setting `body[data-filter-services="migration"]` causes `.gap-card` lacking `data-services~="migration"` to receive opacity < 0.4 via the CSS rule. |
| **VT18** | F2-F4 filter chip behaviors | Click chip → adds to `body[data-filter-*]`; re-click → removes; toggle "Match all" flips OR to AND on the dim selector. |
| **VT19** | SR1-SR2 services-scope cards | `renderSummaryServicesView` renders >= 1 `.service-card` element with mono id, label, hint, gap-count, project-count when a session has services attached. |
| **VT20** | A1 em-dash absence | Test runner scans every served `.js` and `.css` file plus selected `.md` paths for U+2014 em-dash. Assert zero. (Implemented via `fetch()` of file paths from a curated allow-list and string scan.) |

Plus DS24 in `demoSpec.js`: every demo gap's services array has at least one entry with a known `domain` mapping (cyber / ops / data) so the layered signal color renders visibly from Load demo.

### Section R · Regression guards (smoke checklist)

v2.5.0 must not break the v2.4.12 functional surface. Every existing test stays green. Plus the following live-app behaviors verified by hand:

| Guard | Check |
|---|---|
| **R1** v2.4.12 R1-R10 | All ten v2.4.12 regression guards still pass (banner persistence, skill bus, services chips, project rollup, sub-tab render, JSON round-trip, no console errors). |
| **R2** Picker (P1) survives migration | Tab 4 gap detail "+ Add service" picker still exposes the full catalog after the chip / DS3 / DP migrations. |
| **R3** Tab 1 driver tile click → drawer | ContextView renders driver tiles full-width on the left; clicking any tile slides the drawer in with the driver detail body. Right panel as a fixed half-viewport is gone. |
| **R4** Tab 2 + 3 tile click → drawer | MatrixView renders the matrix grid full-width; clicking any tile opens the drawer. Add-tile flow: click "+ Add tile" → drawer opens with empty form, label field auto-focused. |
| **R5** Tab 4 gap-card click → drawer | GapsEditView renders the kanban full-width with 3 columns visibly larger; clicking any gap card opens the drawer with the gap detail. The previous side-by-side layout is gone. |
| **R6** Tab 5 sub-tab clicks → drawer | Reporting sub-tabs render content full-width. Gaps Board gap click + Roadmap project click + Services scope per-service row click each open the drawer with the entity-specific body. |
| **R7** Drawer close + content-swap paths | Backdrop click + Escape + ✕ all close the drawer (reverse-slide). While drawer is open, clicking another card transitions content in place (no close-then-open); for edit-mode entities with unsaved changes, an in-app confirmation appears before swap. |
| **R8** AI ASSIST visible in every drawer | Every entity drawer body has an AI ASSIST eyebrow + `useAiButton` instance near the bottom (just before the sticky footer for edit-heavy entities, or just before the close handle for read-only entities). |
| **R9** Filter re-render | Activating a `services: migration` filter dims non-matching gap cards on Tab 4 + Reporting Gaps Board to opacity 0.18-0.30 + grayscale(.5). Re-click clears. Match-all toggle flips OR to AND. |
| **R10** Topbar version chip | Reads `Canvas v2.5.0` after version bump. |
| **R11** Local Dell logo loads | Topbar logo `<img>` src points at the local `Logo/` asset and resolves without 404. |
| **R12** Dell product accuracy in demo | Load demo session, navigate to Tab 3 / Tab 4 / Reporting drawers; verify no "VxRail (VMware-based HCI)" lead positioning, verify no "Boomi", no "Secureworks", no "Taegis". |
| **R13** Hard refresh on every tab | No console errors. Filters preserved (F5). Drawer closed by default after refresh. |
| **R14** Color audit (visual) | Capture screenshots of every tab + several open drawers; estimate brand-blue surface area. Visibly lower than v2.4.12 (target ~5%, was ~30%). |
| **R15** Mono tabular-nums | Driver priority counts, gap counts, services counts, vendor mix percentages render in mono with tabular-nums (digits aligned vertically). |
| **R16** No emoji in critical action buttons | Save / Cancel / Approve buttons render text only, no emoji prefix. Other emoji in the app (Undo `↶`, Load demo `↺`, AI `✨`) are flagged for v2.5.1 SVG migration but stay in v2.5.0. |
| **R17** No em dashes | Manual sweep of every drawer body, every section, every error message, every prompt, every demo gap description. Zero U+2014 characters in any user-visible text. |
| **R18** Edit-by-default still works | Click an existing tile / gap / driver: drawer opens with form fields ready to type. No extra "Edit" click required. The user decision to keep edit-by-default (no view/edit toggle) is honored. |

### Effort estimate

~4 days focused work, single tag. Extra day vs the original 3-day estimate covers drawer-everywhere (was Tab 5 only) + AI mounting per tab + the expanded §4 universal template.

- **Day 1**: §0 audit pass + §1 design system + §2 topbar / footer.
- **Day 2**: §3 color discipline + §4 detail panel restructure (universal template + per-entity body adaptations).
- **Day 3**: §5 drawer-everywhere wiring across Tabs 1-5 + §AI mounting + §8 tag migration.
- **Day 4**: §6 filter system + §7 services scope redesign + §9 Suite 44 tests + §R smoke + commit + tag.

### Tag protocol (per locked discipline)

1. Spec committed (this entry). Wait for user "spec looks right" sign-off.
2. Tests committed (Suite 44 + DS24). Fail RED at first.
3. Code execution: §0 audit first (resets baseline), then §1-§8 in order. §9 tests go GREEN as each section lands.
4. Browser smoke against §R guards. Report results.
5. Pause for explicit "tag it" approval.
6. Tag, push (force-with-lease no longer needed; main is in sync), update memory + HANDOFF.

### Deferred to v2.5.1 (after v2.5.0 sign-off, scope reduced 2026-04-26)

Three items were pulled forward into v2.5.0 per user direction 2026-04-26: drawer-everywhere across Tabs 1-5 (was Tab 5 only), AI button mounting on every entity drawer (U4), edit-side panel polish absorbed into §4 universal template. v2.5.1 is now lighter.

| | Item | Why deferred |
|---|---|---|
| **VC** | Vocabulary unification across Gaps (Tab 4) and Roadmap (Tab 5.5) | Rename pass needs spec-level discussion of which terms become canonical. Not a v2.5.0 visual concern. |
| **GV** | Visible Gap → Project relationship (today's silent `buildProjects` bucketing made visible) | Data-model touchpoint. The drawer pattern in v2.5.0 makes the ATTRIBUTE visible; the FLOW affordances ("trace this gap to its project", "show me the gaps in this project") are a v2.5.1 slice. |
| **PL** | Primary-layer semantics rework (`gap.layerId` vs `affectedLayers[]`) | Data-model change. High risk. Explicit spec round needed. |
| **IC** | SVG icon system (Lucide library; replace all emoji) | Mechanical pass. Cleanest as standalone slice. v2.5.0 flags every site for migration but defers the swap. |
| **A4.1 (still open)** | Demo refresh + old-schema purge (g-001 Phase 17 violation, default-demo localStorage, per-tab demo banner audit) | v2.5.0 §0 A2 covers the Dell product accuracy slice but not the broader schema hygiene; that lives in v2.4.13 demo-refresh OR rolls into v2.5.1 demo work. |

Explicitly **NOT** added to v2.5.1: view/edit-mode toggle. User decision 2026-04-26 (in light of edit-by-default working well for the workshop entry path). Locked closed.

---

## v2.4.12 · Services scope + Pre-flight regression fixes + hot-patches · IMPLEMENTED 2026-04-26 (P1-P3 folded in pre-tag)

### Hot-patch addendum (caught in user smoke before tag)

User smoke against the v2.4.12 implementation surfaced three real issues; all folded back into v2.4.12 (no separate tag). Three issues from the same smoke (Services scope sub-tab visual quality, side-panel-as-drawer UX, cross-tab filters) are deferred to v2.5.0 crown-jewel where they belong with the broader visual rework.

| # | Issue | Severity | Resolution |
|---|---|---|---|
| **P1** | Services chips on a gap can only be REMOVED — there's no way to ADD a service that isn't in the SUGGESTED list for that gapType (e.g. `assessment` on a Replace gap is unreachable). The headline feature is half-broken. | 🔴 functional | NEW "+ Add service ▾" picker shows all 10 catalog entries with a `★` marker on the SUGGESTED ones for the current gapType. Click → adds to pickedServices → repaints. Reset on selection. SVC11 enforces "any catalog id is reachable regardless of gapType." |
| **P2** | Data-model + relationship integrity unverified across all paths (legacy `.canvas` files saved pre-v2.4.12, closed-gap exclusion in roll-ups, apply/undo round-trips). | 🟡 latent | M11 migrator default: any gap loaded without a `services` field gets `services: []`. `.canvas` open path normalizes services through `normalizeServices` (drops legacy unknowns + dedupes). SVC12 covers M11. SVC13 covers closed-gap exclusion from project rollup. SVC14 covers apply/undo round-trip preserves byte-identical session JSON. |
| **P3** | Two related UX issues: (a) Reporting → Gaps Board → click a gap → right-panel detail does NOT show `gap.services`; (b) Roadmap project-card "SERVICES NEEDED" chips render as plain unstyled spans. | 🟠 UX quality | SummaryGapsView's `renderGapDetail` (or equivalent) gets a "Services needed" chip row when the selected gap has services. Roadmap project-card chips get `solutions-chip`-class equivalent CSS pill styling (rounded background pill, padding, gap). SVC15 enforces SummaryGapsView surfaces services in the detail panel. |

### Tests added (SVC11-15) — RED first, then GREEN

- **SVC11** · `+ Add service` picker exposes all 10 catalog entries + the new entry persists into `gap.services` after click
- **SVC12** · Migrator M11 backfills `services: []` on a legacy gap (no `services` key); existing gaps with a services array are preserved unchanged
- **SVC13** · `buildProjects` rollup excludes services from gaps with `status: "closed"` (the project services array reflects only OPEN gaps)
- **SVC14** · `applyProposal({ path: "context.selectedGap.services", ... })` then `undoLast()` returns session to byte-identical JSON (services round-trip is undo-safe)
- **SVC15** · SummaryGapsView right-panel detail surfaces selected gap's services as a chip row when present

### Effort: ~3 hr · single tag (folded into v2.4.12; no separate v2.4.12.1)

### Deferred to v2.5.0 crown-jewel (per user smoke)

Three issues NOT fixed in v2.4.12 — they belong with the broader visual rework:
- **Issue #3** Services scope sub-tab is visually primitive (plain HTML table, no chip pills, jammed text). v2.5.0 redesign per GPLC sample HTML.
- **Issue #5** No filter chips for `gap.services`, `gap.affectedEnvironments`, or `gap.driverId` on Tab 4 / Reporting Gaps Board. v2.5.0 cross-tab filter system.
- **Issue #6** Side-panel detail UX feels static — sample HTML uses dynamic, animated, hierarchical card patterns. v2.5.0 side-panel-as-drawer redesign.

These three are tracked in HANDOFF.md §5 Bucket B (B6, B7, B8 added to the existing crown-jewel scope).

---

## v2.4.12 · Services scope + Pre-flight regression fixes · IMPLEMENTED 2026-04-26

**History**: v2.4.12 was attempted 2026-04-25 then rolled back per user direction; the rolled-back attempt's services UI (chip selector on each gap) was kept, but two add-on choices proved wrong:
1. The v2.4.12 attempt **kept** the v2.4.11 D2 `+ Add operational / services gap` CTA — re-evaluated on 2026-04-26: services are a *facet* of any gap, not a standalone gap type, so the dedicated CTA is redundant. Removed in this re-scope.
2. The v2.4.12 attempt **surfaced** a latent v2.4.11 ContextView Save bug (`isDemo` flips to false on no-op save → demo banner disappears on refresh) but didn't fix it. Bundled into this re-scope as PR1.

A separate session-during bug (AI dropdown didn't auto-refresh on skill add/deploy/reassign) is also bundled as PR2 per user direction. Validation 2026-04-26: PR1 confirmed live (`isDemoBefore: true` → click Save context with no changes → `isDemoAfter: false`).

**Theme**: surface professional-services scope on every gap. Services aren't a separate gap type — they're a **facet of nearly every gap** (a Replace gap implies migration + deployment; Consolidate implies migration + integration; Introduce implies deployment + training; Retire implies decommissioning; Operational gaps usually ARE services). Without this, the workshop deliverable is incomplete: customers ask "ok how do we actually do this" and the presales engineer doesn't have it captured.

### Section S · Services scope (data + UI)

#### Data model addition (one new field)

```js
gap.services = ["migration", "deployment", "training"]   // optional; multi-select
```

Two-surface treatment per `feedback_foundational_testing.md`:
- Demo session refresh: a few demo gaps get appropriate `services` arrays (e.g., g-001 PowerProtect replace gets `["migration", "deployment", "training"]`).
- Seed skill update: at least one seed skill writable to `context.selectedGap.services` (multi-value writes need a small `bindingResolver` extension).
- demoSpec assertion: DS22 — "every demo gap with `gapType: replace|consolidate|introduce|retire` has a `services` array (may be empty if user explicitly cleared)".
- DEMO_CHANGELOG entry.

#### NEW `core/services.js` — catalog (mirrors `BUSINESS_DRIVERS` shape)

```js
export const SERVICE_TYPES = [
  { id: "assessment",         label: "Assessment / Health check",   hint: "Pre-engagement audit before the work starts" },
  { id: "migration",          label: "Migration",                   hint: "Move data / workloads from current to desired platform" },
  { id: "deployment",         label: "Deployment / Install",        hint: "Build out the desired-state system" },
  { id: "integration",        label: "Integration",                 hint: "Connect to existing systems, APIs, identity, monitoring" },
  { id: "training",           label: "Training",                    hint: "Skill the customer's ops team on the new platform" },
  { id: "knowledge_transfer", label: "Knowledge transfer",          hint: "Hand-off documentation + walkthroughs" },
  { id: "runbook",            label: "Runbook authoring",           hint: "Operational playbooks (DR, incident response, change-mgmt)" },
  { id: "managed",            label: "Managed services",            hint: "Ongoing operational support contract" },
  { id: "decommissioning",    label: "Decommissioning",             hint: "Safe removal + data archive of retired systems" },
  { id: "custom_dev",         label: "Custom development",          hint: "Bespoke connectors, scripts, tooling" }
];

// Auto-suggest map (gapType → suggested services). UX is OPT-IN per
// approved pick: chips appear under a "Suggested" eyebrow but are NOT
// pre-selected. User clicks to add. Less surprising than auto-applying.
export const SUGGESTED_SERVICES_BY_GAP_TYPE = {
  replace:     ["migration", "deployment"],
  consolidate: ["migration", "integration", "knowledge_transfer"],
  introduce:   ["deployment", "training"],
  // retire-action gaps have gapType: "ops" — distinguish via a fallback
  // map keyed on action when needed (handled in the UI helper).
  enhance:     ["assessment"],
  ops:         ["runbook"],
  // null gapType (Keep) → no suggestions
};
```

#### UI surfaces (additive only — no rearrangement of existing layout)

1. **Gap detail panel** (Tab 4 right side, GapsEditView):
   - New "Services needed" section under "Mapped Dell solutions"
   - Multi-chip selector reading from `SERVICE_TYPES`
   - Above the selector, an eyebrow row labelled **SUGGESTED** showing greyed chips for `SUGGESTED_SERVICES_BY_GAP_TYPE[gap.gapType]` minus already-selected ones; click-to-add
   - Selected chips are full-color; clickable to remove
   - When `gapType` changes, the SUGGESTED row re-derives but never auto-selects
2. **Project card** (Tab 5.5 SummaryRoadmapView):
   - Below the dell-solutions chips, a "Services needed" chip row showing the union of services across constituent gaps (deduped)
3. **NEW Reporting sub-tab "Services scope"** (REPORTING_TABS gets a 6th entry between "Vendor Mix" and "Roadmap"):
   - Roll-up table: rows = service types from catalog, columns = (count of gaps needing it, count of projects spanning it, list of project names)
   - At the top: a "Services scope summary" sentence: "Across N projects: X migrations · Y deployments · Z trainings · W runbooks"
   - This is the workshop deliverable for "engagement shape"

### Section PR · Pre-flight regression fixes

| # | Item | File(s) | Effort |
|---|---|---|---|
| **PR1** | ContextView "Save context" must not touch `session.isDemo` when the saved context is unchanged from the loaded value (or when the only change is `customer.name` matching the existing value). Today, every Save unconditionally re-derives `isDemo: false` because the persisted shape no longer matches the demo template byte-for-byte. Fix: compare the persisted context payload against the *current* in-memory pre-save state; if no semantic field changed, treat as no-op and skip the `isDemo` flip. Validated live 2026-04-26: bug confirmed in v2.4.11 rolled-back state. | `state/sessionStore.js saveContextDraft` (or wherever ContextView's Save handler routes) | 20 min |
| **PR2** | AI dropdown (per-tab `<select>` populated from skill registry) must subscribe to a `skills-changed` event so adding / deploying / reassigning a skill re-renders the dropdown without requiring a tab switch. Today the dropdown only re-derives on tab activation. Fix: emit `skills-changed` from `state/skillsStore.js` on add/update/delete/deploy/undeploy; the dropdown's render function subscribes via the existing `sessionEvents.js` bus pattern (or a new `skillsEvents.js` if cleaner). Note: be specifically careful not to break the Skill Builder admin panel re-render or the per-skill provider override controls — both already share state with the dropdown. | `state/skillsStore.js`; new `state/skillsEvents.js` (or extend `sessionEvents.js`); `interactions/aiCommands.js` (or wherever `<select>` is rendered) | 30 min |

### Section U · UI subtractions

| # | Item | File(s) | Effort |
|---|---|---|---|
| **U1** | Remove the v2.4.11 D2 `+ Add operational / services gap` button on Tab 4. Services now attach to any gap as a multi-chip facet — a dedicated ops-gap entry-point is redundant and reinforces a wrong mental model. The generic `+ Add gap` button stays. Update RULES.md §D entry to reflect the removal. | `ui/views/GapsEditView.js`; `docs/RULES.md` §D | 10 min |

### Section T · Tests — Suite 43 · SVC + PR + U

#### Services (SVC1-SVC10)
- SVC1 · `SERVICE_TYPES` is a 10-entry array with id+label+hint shape
- SVC2 · `gap.services` persists round-trip through `createGap` + `updateGap`
- SVC3 · `gap.services` dedupes on `createGap` (same id twice → one)
- SVC4 · `SUGGESTED_SERVICES_BY_GAP_TYPE` returns the right chips per gapType
- SVC5 · changing `gap.gapType` does NOT auto-mutate `gap.services` (opt-in confirmed)
- SVC6 · empty array is a valid services value (not undefined)
- SVC7 · invalid id in services array (e.g., "foo") drops on `normalizeGap` or fails `validateGap` (decide which during impl)
- SVC8 · Roadmap project services chip = union of constituent gap services, deduped
- SVC9 · "Services scope" sub-tab renders one row per service that has ≥1 gap
- SVC10 · `.canvas` file save/open round-trips `gap.services` (sessionFile envelope already passes through unknown fields)

#### Pre-flight (PR1-PR2)
- PR1.a · After loading demo session, calling `saveContextDraft` with the unchanged context payload leaves `session.isDemo === true`
- PR1.b · After loading demo session, calling `saveContextDraft` with a changed `customer.name` flips `session.isDemo` to `false` (the original intent — only changes mean "user has taken over")
- PR2.a · `state/skillsStore.js add(skill)` emits `skills-changed`
- PR2.b · `state/skillsStore.js deploy/undeploy/remove` emit `skills-changed`
- PR2.c · The per-tab AI dropdown's render function is registered as a subscriber and re-renders when the event fires (without requiring a tab switch)

#### UI subtraction (U1)
- U1 · Tab 4 contains exactly ONE add-gap CTA labelled `+ Add gap`. The string `+ Add operational / services gap` does NOT appear anywhere in the Tab 4 DOM. Any pre-existing test in Suite 42 that asserts the dedicated CTA must be deleted in the same commit.

#### Demo refresh (DS22)
- DS22 · Demo gaps `g-001` (replace · PowerProtect) gets `services: ["migration", "deployment", "training"]`; `g-002`, `g-003`, etc. get appropriate arrays per `SUGGESTED_SERVICES_BY_GAP_TYPE`. Assertion: every demo gap with `gapType ∈ {replace, consolidate, introduce}` has `services.length >= 1`.

### Section R · Hard regression guards (smoke checklist)

These specifically guard against the failure modes from the rolled-back attempt:

| Guard | Check |
|---|---|
| **R1** | Tab 1: load demo → click "Save context" without changing anything → hard-refresh page → demo banner still visible (PR1 effective) |
| **R2** | Tab 1: load demo → change customer name → Save → hard-refresh → demo banner gone, customer name preserved (PR1 didn't break the legitimate flip) |
| **R3** | Skill Builder: add a new skill while parked on Tab 4 with the AI panel open → dropdown shows the new skill without a tab switch (PR2 effective) |
| **R4** | Skill Builder: deploy a skill to a different tab → that tab's dropdown updates immediately (PR2 effective on the deploy path) |
| **R5** | Tab 4: gap detail "Services needed" chips persist across hard refresh |
| **R6** | Tab 5.5: project card services chip row updates when a constituent gap's services change |
| **R7** | Tab 4: there is no `+ Add operational / services gap` button (U1 effective) |
| **R8** | NEW Reporting sub-tab "Services scope" renders without console errors |
| **R9** | `.canvas` file save → re-open → `gap.services` survives the round-trip |
| **R10** | Page hard-refresh on Tab 4 with services-populated demo session → no console errors, no missing fields, no banner disappearing |

### What you'll see post-v2.4.12 (verification spec)

- **Tab 4 gap detail** → "Services needed" section appears with a greyed "SUGGESTED" eyebrow row (click-to-add) and full-color selected chips (click-to-remove)
- **Tab 4** → no more "+ Add operational / services gap" button (only the generic "+ Add gap" remains)
- **Tab 5.5 Roadmap** → each project card shows its services scope in a chip row beneath the Dell-solutions chips
- **New "Services scope" sub-tab in Reporting** → a clean roll-up of every service type and which projects need it, with a "Across N projects: X migrations · …" summary sentence
- **Tab 1 Save context (no-op)** → demo banner survives a hard refresh (the v2.4.11 latent bug is fixed)
- **AI skill add / deploy / reassign** → the per-tab dropdown updates without requiring a tab switch
- **Demo session** → g-001 + others have realistic `services` arrays as per the demo refresh
- **`.canvas` file save/open** → services round-trip cleanly

### Effort: ~5 hr · single tag (Section S ~3-4 hr; PR + U + R guards ~1-1.5 hr)

### Tag protocol (per the locked discipline)

1. Spec committed (this entry rewrite) — gates everything else.
2. Tests committed (Suite 43 + DS22 + U1 deletion + PR1/PR2 cases) — fail RED at first.
3. Code execution — single coherent pass, all sections (S + PR + U + demo refresh).
4. Tests go GREEN; full suite still 509+ passing.
5. **Browser smoke** against Section R guards (R1-R10) — every box checked, results reported back.
6. **Pause for explicit "tag it" approval.** No tag without it.
7. Tag, force-push (`git push --force-with-lease` per Q3 decision 2026-04-26), update memory + HANDOFF.

---

## v2.4.11 · Rules hardening + Q1-Q4 fixes · IMPLEMENTED 2026-04-25

### Bug-fixes addendum (caught in browser smoke before tag)

- Lock button on urgency selector silently failed because `updateGap` ran `validateActionLinks` on EVERY edit including metadata-only patches (urgencyOverride toggle). Demo `g-004` was mis-typed as `replace` but had 2 currents (semantically Consolidate). Two fixes:
  1. **`updateGap` now only runs `validateActionLinks` when STRUCTURAL fields change** (gapType / layerId / affectedLayers / affectedEnvironments / relatedCurrentInstanceIds / relatedDesiredInstanceIds) OR when caller explicitly sets `reviewed: true`. Metadata-only patches (urgencyOverride / notes / urgency / phase / status / driverId) skip link validation. The soft chip on the gap detail still shows the violation — user is informed but not blocked from saving side notes.
  2. **Demo `g-004` retyped to `consolidate`** (correct: 2 current PowerEdge old + HPE ProLiant → 1 desired PowerEdge new). Description updated to "Aging compute — consolidate two vendor platforms onto PowerEdge".
- **Save button visible feedback** — was just a text swap. Now shows: idle "Save changes" → click → disabled "Saving…" → success → green "Saved ✓" + 900ms revert; error → red "Couldn't save" + shake animation + 2s revert + inline error in panel.
- **2 pre-existing tests revised to match the new contract**:
  - T6.6 (any-edit-flips-reviewed) — was "any substantive edit"; now correctly asserts only structural edits auto-flip + metadata edits don't (workshop-flow protection).
  - RH8 (implicit reviewed-flip on valid shape) — updated to use a structural patch (relatedCurrentInstanceIds) instead of a metadata patch (notes).

**Theme**: lock the rules so the live workshop stays permissive but review enforces shape. Surface the silent magic. Fix the desired-link bug. Make Operational/Services first-class.

**Reference**: `docs/RULES.md` (the full rules-as-built audit, committed alongside this entry).

### Design principles applied across every item below

1. **Draft mode permissive, Review mode enforced.** Every "force the user to fix" rule fires at the `reviewed: true` transition, NOT at workshop-time. The `reviewed` flag becomes meaningful: it asserts "I've checked this".
2. **Destructive ops use `status: closed`, not delete.** Reversible. Visible. Auditable.
3. **Automatic behaviour is visible.** Suggested drivers show their reason. Auto-drafts announce themselves. Manual overrides have indicators.
4. **Rules derive from one place.** `core/taxonomy.js` is the source. UI safety nets call taxonomy helpers, not literal arrays.
5. **Workshop flow > ideal data shape.** Soft chip first; hard block only at the "I'm done" moment.

### Section A · Rules hardening

| # | Item | File(s) | Effort |
|---|---|---|---|
| A1 | `validateActionLinks` runs at the `reviewed: true` transition (in `approveGap` and any `updateGap` patch flipping `reviewed` from false to true). Emit a soft chip during draft if shape is wrong. | `interactions/gapsCommands.js`; new chip in `GapsEditView.js` | 20 min |
| A2 | Changing a desired tile's disposition to `keep` switches its linked gaps to `status: "closed"` with `closeReason: "auto: disposition changed to keep"`, **not delete**. Add a "Closed gaps" filter chip on Tab 4 so users can see them. | `interactions/desiredStateSync.js` (replace splice with status mutation); `GapsEditView.js` (filter chip + badge) | 30 min |
| A3 | NEW helpers `taxonomy.requiresAtLeastOneCurrent(gapType)` and `requiresAtLeastOneDesired(gapType)`. `unlinkCurrentInstance` + `unlinkDesiredInstance` use them instead of literal arrays. Auto-includes `keep` and `retire` (currently missing from the L1 list). | `core/taxonomy.js`; `interactions/gapsCommands.js` | 15 min |
| A4 | `linkDesiredInstance(session, gapId, instanceId, opts)` refuses to link if `confirmPhaseOnLink` returns conflict AND `opts.acknowledged !== true`. `GapsEditView.js` link picker calls `confirmPhaseOnLink` first; on user confirm, passes `acknowledged: true`. | `interactions/gapsCommands.js`; `GapsEditView.js` link picker | 25 min |
| A5 | NEW helper `effectiveDriverReason(gap, session)` returns `{ driverId, source: "explicit"|"suggested", reason: "matched layer dataProtection" }`. Gap detail panel renders an "Auto-suggested driver: X (because Y). [Override]" chip when source === "suggested". | `services/programsService.js`; `GapsEditView.js` | 30 min |
| A6 | NEW field `gap.urgencyOverride: boolean` (default false). Propagation rules P4 (`syncGapFromDesired` → urgency mirror) and P7 (`syncGapsFromCurrentCriticality`) skip gaps where `urgencyOverride === true`. UI shows "🔒 manually set / ↺ auto" toggle on the urgency selector. Migrator: existing gaps default to `urgencyOverride: false`. | `core/models.js` (validate optional); `state/sessionStore.js migrateLegacySession` (M10); `interactions/desiredStateSync.js`; `GapsEditView.js`; demoSpec DS22 | 30 min |
| A7 | Project detail panel shows an "Also affects: {env labels}" chip row when the project's constituent gaps span more than one environment. | `ui/views/SummaryRoadmapView.js` | 15 min |
| A8 | Workload detail panel shows a "Linked variants in other environments" chip row when another workload tile shares the same `label` field but lives in a different env. | `ui/views/MatrixView.js` workload detail | 20 min |
| A9 | `validateActionLinks` extended: ops gaps require `relatedCurrentInstanceIds.length + relatedDesiredInstanceIds.length >= 1` OR `(notes||"").trim().length >= 10`. Soft chip during draft, hard block at review. | `core/taxonomy.js validateActionLinks`; copy update | 15 min |

### Section B · Filter + form fixes (Q1)

| # | Item | File(s) | Effort |
|---|---|---|---|
| B1 | Tab 4 layer-chip filter changes from `gap.layerId === selectedLayer` to `gap.affectedLayers.includes(selectedLayer)`. Multi-layer gaps now appear under EVERY layer chip they touch. | `ui/views/GapsEditView.js` filter logic | 15 min |
| B2 | Gap form: rename "Primary layer *" → **"Primary layer (drives the project bucket) *"**. Add a multi-chip selector below labelled "Also affects" (writes `gap.affectedLayers` minus the primary; setPrimaryLayer keeps the invariant). | `ui/views/GapsEditView.js` add/edit form | 30 min |

### Section C · Auto-draft visibility + UX (Q2)

| # | Item | File(s) | Effort |
|---|---|---|---|
| C1 | Post-draft toast on Tab 3 when an auto-draft fires: `"↳ Gap drafted on Tab 4 (N unreviewed)"`. Auto-dismisses after 4s. | `ui/views/MatrixView.js` (toast on disposition save); `state/sessionEvents.js` (no change) | 20 min |
| C2 | Tab 4 banner upgrade: "N unreviewed auto-drafted gaps" gets a "**Review all →**" button that opens each unreviewed gap in sequence. | `ui/views/GapsEditView.js` auto-gap-notice block | 30 min |
| C3 | `buildGapFromDisposition` description template: `"{ActionVerb} {sourceLabel} → {desiredLabel} [{layerLabel}]"`. Falls back to current template if either side missing. | `interactions/desiredStateSync.js` | 15 min |
| C4 | `buildGapFromDisposition` pre-fills `notes` for ALL action types, not just ops. Format: `"From workshop: {ActionLabel} {sourceLabel}"` for tile-bound; `"Net-new: {desiredLabel}"` for introduce. | same | 10 min |

### Section D · Operational / Services clarity (Q4)

| # | Item | File(s) | Effort |
|---|---|---|---|
| D1 | Rename label "Operational" → "Operational / Services" in `core/taxonomy.js ACTIONS[6].label`. UI auto-picks up via `DISPOSITION_ACTIONS` re-export. | `core/taxonomy.js` (one-line label change) | 15 min |
| D2 | New "+ Add operational / services gap" button on Tab 4, distinct from the generic "+ Add gap". Pre-fills `gapType: "ops"`, opens the form with placeholder note: `"e.g., Build DR runbook for tier-1 workloads · Train ops team on PowerProtect · Establish change-management for cloud spend"`. | `ui/views/GapsEditView.js` | 25 min |
| D3 | Project card label: when ALL constituent gaps are `disposition === "retire"`, show project name suffix "Retirement" instead of `ACTION_VERBS.ops` "Operational Improvement". Edge case: mixed retire+ops projects still say "Operational Improvement". | `services/roadmapService.js` (verb override after grouping) | 10 min |

### Section E · The bug (Q reported)

| # | Item | File(s) | Effort |
|---|---|---|---|
| E1 | Investigate why the desired-link in the gap detail panel isn't clickable. Likely a missing event handler in `GapsEditView.js renderGapDetail` link rendering. Fix to make the link navigate to / highlight the linked desired tile on Tab 3 (or open it in a side panel — pick during impl). | `ui/views/GapsEditView.js` | 15 min (estimate) |

### Section F · Friendly errors (cross-cutting)

| # | Item | File(s) | Effort |
|---|---|---|---|
| F1 | Replace `validateActionLinks` raw error messages with workshop-friendly prose. Examples: `"Replace needs the technology being replaced. Link a current-state tile to this gap."` instead of `"Action 'Replace' requires exactly 1 current link (got 0)"`. Same for every other action. | `core/taxonomy.js validateActionLinks` (message generator) | 20 min |

### Section G · Tests + docs

| # | Item | Effort |
|---|---|---|
| G1 | NEW Suite 42 · RH1-RH20 covering A1-A9, B1-B2, C1-C4, D1-D3, E1, F1. Plus demoSpec DS22 for `gap.urgencyOverride`. | 60 min |
| G2 | Manual smoke checklist: incognito → fresh state OK · "Bus Co" never appears · Clear all data wipes · Save/Open round-trip · auto-draft toast appears · suggested-driver chip visible · desired-link clickable · "+ Add operational / services gap" present · review-time validation fires. APP_VERSION 2.4.10.1 → 2.4.11. RULES.md committed (already drafted). CHANGELOG_PLAN entry flips to IMPLEMENTED. | 30 min |

### Total · ~7 hours · single tag

### What you'll see post-v2.4.11 (verification spec)

- **Tab 4 layer filter** — clicking "Compute" now shows gaps with Compute as primary AND gaps where Compute is in `affectedLayers`.
- **Gap form** — "Primary layer (drives the project bucket)" label + a separate "Also affects" multi-chip selector.
- **Tab 4 unreviewed banner** — has a "Review all →" button that walks you through unreviewed gaps one by one.
- **Tab 3 disposition save** — brief toast appears: "↳ Gap drafted on Tab 4 (N unreviewed)".
- **Gap detail** — "Auto-suggested driver: Cyber Resilience (because: data-protection layer). [Override]" chip when no explicit driver.
- **Gap urgency selector** — "🔒 manually set" indicator + "↺ auto" reset link when user has overridden propagation.
- **Tab 4 "+ Add operational / services gap"** — new prominent button with placeholder examples in the description field.
- **Tab 5.5 project card** — "Also affects: DR DC, Public Cloud" chip when the project spans multiple envs.
- **Validation messages** — workshop-friendly: "Replace needs the technology being replaced..." instead of raw rule text.
- **Approving an unreviewed gap with bad shape** — blocks with the friendly message; user must fix before approval succeeds.
- **Setting a tile to "Keep" with linked gaps** — gaps move to `status: closed` and a "Closed gaps" filter chip appears on Tab 4.
- **Desired-state link in gap detail** — clickable now (the bug).

### Tag protocol (per the discipline established 2026-04-25)

1. Spec committed (this doc + RULES.md) — DONE before code.
2. Code execution — single coherent pass.
3. **Manual smoke against the verification spec** — every bullet above checked in the live app, results reported back to user.
4. **Pause for user approval** — no tag without explicit "tag it".
5. Tag, push, update HANDOFF.

---

## v2.4.10.1 · Phase 19j.1 · HOTFIX · test-runner localStorage isolation · IMPLEMENTED 2026-04-25

**Bug**: Every release v2.4.5 → v2.4.10 silently shipped a regression where the auto-running test suite POLLUTED the user's real localStorage on every page load. Symptoms: incognito-fresh-load showed "Bus Co" + a test-data gap; clicking Clear all data appeared to do nothing because tests re-polluted on the reload.

**Root cause**: tests like DS13/DS14/DS16/DS17 in demoSpec.js call `replaceSession({customer: {name: "Bus Co", ...}})` then `applyProposal(...)`. `applyProposal` calls `saveToLocalStorage()`. The test session ends up persisted as `dell_discovery_v1`. Next page load: sessionStore IIFE reads polluted localStorage and renders test data instantly.

**Why missed**: green test banner + `localStorage.clear()` before every Chrome MCP nav masked the pollution during verification.

**Fix**: NEW `runIsolated(run, restoreCallback)` helper in `diagnostics/testRunner.js`. Snapshots every localStorage key, runs tests, restores keys in finally. The callback re-loads in-memory `session` from restored localStorage and emits `session-changed`.

**Verified live before commit**: incognito-fresh load shows "New session" + fresh-start card + `lsKeys: []`. Clear all data wipes + reloads cleanly.

**Files**: `diagnostics/testRunner.js` (new helper) · `diagnostics/appSpec.js` (`runAllTests` wraps via `runIsolated`).

---

## v2.4.10 · User-owned save/open file (.canvas workbook) · IMPLEMENTED 2026-04-24

**Goal**: give volunteer test users a real data-durability lifeline. Before this tag, a user's work existed only in browser localStorage — a reinstall, a Clear-all, or a version upgrade that broke migrations would lose everything. After this tag, the user owns their work as a `.canvas` file they can save, open, back up, or hand to a colleague.

### What shipped

1. **`↓ Save to file`** (renamed from `Export JSON`) — opens a small dialog with an **opt-in checkbox "Also include my AI provider API keys in the file"**. Default OFF. File is downloaded as `{customer-slug}-{date}.canvas` with MIME `application/vnd.delltech.canvas+json`.
2. **`↑ Open file`** (new) — opens native file picker, parses the envelope, runs the session through the existing `migrateLegacySession` chain (so cross-version migrations apply to imported files — Phase 17 rationalize coercions, v2.4.9 primary-layer backfills, all of it). Replaces live session + skills + provider config (keys only if user opts in per confirm prompt).
3. **File envelope v1**: `{ fileFormatVersion, appVersion, schemaVersion, savedAt, session, skills, providerConfig, providerKeys? }`. API keys are stripped unless `includeApiKeys: true`. Tolerates unknown future top-level keys (forward-compat). Rejects files from newer versions with a clear message.
4. **PWA manifest + file_handlers** — registered for `.canvas` MIME. When user installs the webapp as a PWA (Chrome/Edge three-dot menu → Install app), `.canvas` files associate with the Canvas icon in the OS, and double-clicking a `.canvas` file opens it directly in the app via `launchQueue`.
5. **SVG icon** (`Logo/canvas-icon.svg`) — a brand-blue plate with three ascending rows and an upward-trending path, evoking current → desired → roadmap progression. Used both as favicon and as the OS file-type icon (when PWA is installed).
6. **Clear-all reliability fixes**:
   - Fixed CL2 test pollution: previous test did `window.localStorage.clear = fn` which, for the Storage interface, calls `setItem("clear", fnString)` — polluting storage with a `"clear"` key that got re-written on every page load. Now uses a canary-key approach with no `.clear` assignment.
   - Hardened the Clear-all click handler: uses `location.href = path + "?cleared=ts"` for guaranteed fresh navigation across all browsers (some block `location.reload()` mocking which masked test issues).
7. **Confirm dialog text updated**: "Use 'Save to file' first if you want a backup" (was "Export JSON").

### What you'll see

- **Footer** now reads: `↓ Save to file` · `↑ Open file` · `↺ Load demo` · `+ New session` · `Clear all data`.
- **Click Save to file** → dialog opens with the opt-in API-keys checkbox + help text. Click "↓ Save to file" button inside the dialog → `.canvas` file downloads with your customer name in the filename.
- **Click Open file** → native file picker. Pick a `.canvas` file → imports it. If the file included API keys, a confirm prompt asks whether to apply them. Post-load alert shows "Opened filename.canvas" + which Canvas version saved it + any warnings.
- **If you install Canvas as a PWA** (Chrome/Edge: address-bar → Install app icon), `.canvas` files get the Canvas icon in Finder/Explorer and double-clicking opens them in the app.
- **Title bar favicon** now shows the Canvas icon instead of the blank data-uri fallback.
- **Clear all data** now produces a visibly fresh state after reload (previously polluted with a stale `"clear"` test key).

### Why this feature and why now

User raised this point: "test users might lose their work when we upgrade, and export-JSON alone doesn't tell them they can re-open it." The answer is the Word-document pattern: save a file, open a file, file carries its version inside, migrator knows every version shift. This becomes the durable layer that outlasts localStorage, outlasts browser reinstalls, and stays valid when v3 multi-user moves data server-side — users never lose control of their workbook.

### Tests — Suite 41 · SF1-SF10

- SF1 · API keys stripped by default
- SF2 · API keys included only on opt-in; Local's empty-string key correctly not included
- SF3 · envelope carries fileFormatVersion + appVersion + schemaVersion + savedAt
- SF4 · suggestFilename produces safe OS-portable filenames ending in `.canvas`
- SF5 · garbage JSON / non-object / missing-session files rejected with readable errors
- SF6 · files from newer Canvas versions rejected with upgrade hint
- SF7 · unknown top-level keys tolerated (forward-compat)
- SF8 · applyEnvelope runs migrateLegacySession — a pre-v2.4.8 rationalize gap in an imported file gets coerced to ops
- SF9 · applyEnvelope warns about bundled API keys but keeps user's own by default
- SF10 · full round-trip (save → parse → apply) yields byte-identical session JSON

Tests: 488 total (up from 478 + 10 SF).

### Files

- NEW · `services/sessionFile.js` (envelope builder + parser + applyEnvelope + suggestFilename)
- NEW · `manifest.json` (PWA manifest + file_handlers)
- NEW · `Logo/canvas-icon.svg` (SVG icon for favicon + PWA + file-type)
- MOD · `index.html` (Save/Open buttons; manifest link; SVG favicon)
- MOD · `app.js` (openSaveDialog + handleOpenedFile + launchQueue consumer + hardened Clear-all)
- MOD · `styles.css` (save-dialog + note styling)
- MOD · `nginx.conf` (MIME for webmanifest + canvas)
- MOD · `Dockerfile` (copies manifest.json)
- MOD · `core/version.js` (APP_VERSION 2.4.9 → 2.4.10)
- MOD · `diagnostics/appSpec.js` (Suite 41 SF1-SF10; CL2 rewritten to avoid storage pollution)

---

## v2.4.9 · Primary-layer + Gap→Project data model · IMPLEMENTED 2026-04-24 (rollback anchor)

**"AI platform complete + relationships fixed + old look"** — the `git checkout v2.4.9` target if v2.5.x crown-jewel regresses.

### What shipped

- **Primary-layer invariant** · `affectedLayers[0] === gap.layerId` enforced by `validateGap`. `setPrimaryLayer(gap, layerId)` helper in `interactions/gapsCommands.js` prepends + dedupes. `createGap` + `updateGap` call it internally so UI callers don't need to remember the rule. Migrator backfills every pre-v2.4.9 gap idempotently.
- **Explicit gap.projectId** · new string field, populated by `deriveProjectId(gap)` from `env::layer::gapType` — same rule as the historical silent bucketing. `buildProjects` groups by the field; legacy fallback to the computed key preserved as a safety net. `updateGap` re-derives on layer/env/gapType change unless the caller explicitly sets `projectId`.
- **"Clear all data" footer button** · wipes every `dell_discovery_*` + `ai_*` key and reloads. Separate from "+ New session" (which only resets the session object — AI skills + provider config + undo history survive). Lets existing users see first-run UX (v2.4.7 welcome card) without DevTools.
- **Tests** · Suite 40 PL1-PL5 (primary-layer) + PR1-PR5 (project relationship) + CL1-CL3 (clear-data button).

### What you'll see

- Header still shows `Canvas v2.4.9`.
- Footer has a new red-tinted **"Clear all data"** button on the right. Click → confirm dialog listing what gets wiped → `localStorage.clear()` + page reload.
- After the reload (or after clicking "+ New session"), the fresh-start welcome card from v2.4.7 finally becomes visible.
- **No other visible changes** — primary-layer + projectId are data-model plumbing. Existing gaps work identically. The payoff is v2.5.0 crown-jewel (vocabulary unification + Gap→Project visibility) which relies on these fields being explicit.
- Console on first load after upgrade may show `[migrate · Phase 17]` warnings if you had pre-v2.4.8 data — one-time, idempotent.

---

## v2.5.0 / v2.5.1 · Crown-jewel · QUEUED (split confirmed 2026-04-24)

Split per `project_crown_jewel_design.md`:

- **v2.5.0**: U5 Gaps↔Roadmap vocabulary unification + U4 "✨ Use AI" on Tabs 2-5 + U2 AI-powered conversation starter. Low-medium risk: mechanical renames + routing + one two-surface change (new writable field + resolver + seed skill + demo + demoSpec + DEMO_CHANGELOG).
- **v2.5.1**: U6 structural rework — side-panel-as-drawer IA + SVG icon system + tag-vocabulary primitives (6+ variants → 2-3) + color discipline (brand blue 30% → 5%). High risk: drawer IA touches every view render. Isolated so v2.5.0 stays bisectable.

Reference: `C:/Users/Mahmo/Downloads/GPLC Digital Unified Platform v1.0.html` (see `reference_gplc_sample.md` + `project_crown_jewel_design.md` in memory).

**Vocabulary audit gate** (v2.5.0 before tag): grep for every pre-unification term across codebase + CSS + tests; verify each call site updated.

---

## v2.6.0 · Action-commands runtime · QUEUED

Formerly v2.4.6. Runtime for the `json-commands` response format declared in SPEC §12.6 but stub-rejected today. Scope unchanged from earlier filing: `core/actionCommands.js` whitelist (`updateField`, `updateGap`, `createGap`, `deleteGap`, `linkInstance`, `setGapDriver`), Suite 37 AC1-AC10, plus a new json-commands seed skill (two-surface rule). Est ~3 hr.

---

## v2.4.5.1 · Phase 19f · AI reliability (Anthropic header + retry + fallback chain) — IMPLEMENTED (2026-04-24)

**Goal**: Close two concrete user-reported failure modes surfacing in live Gemini + Anthropic use:

1. **Anthropic 401** · "CORS requests must set 'anthropic-dangerous-direct-browser-access' header". Anthropic flags any request that carries an `Origin` (our transparent nginx proxy preserves it) and demands an explicit opt-in header. Without it every Claude call fails at auth.
2. **Gemini 503** · "This model is currently experiencing high demand." The Gemini 2.5-flash endpoint serves a lot of traffic; a single-shot client turns every transient blip into a hard stop for the user.

Neither is an architecture problem — both are client-side implementation gaps.

### What shipped

1. **Anthropic browser-direct opt-in header** — `services/aiService.js buildRequest("anthropic", ...)` now always sets `anthropic-dangerous-direct-browser-access: true` alongside `x-api-key` and `anthropic-version`. Matches Anthropic's literal error-message requirement.
2. **Retry with exponential backoff + full jitter** — `chatCompletion` retries `429, 500, 502, 503, 504` (and raw network errors) up to `RETRY_MAX_ATTEMPTS = 3` times per model. Backoff doubles from 500ms, capped at 4s, jittered to avoid thundering-herd. Non-retriable statuses (`401`, `403`, other `4xx`) throw immediately.
3. **Per-provider fallback-model chain** — new `config.providers[p].fallbackModels: string[]` field. When the primary model exhausts its retry budget on a transient error, `chatCompletion` re-issues on the next model in the chain with its own fresh retry budget. Defaults shipped:
   - Gemini: `["gemini-2.0-flash", "gemini-1.5-flash"]`
   - Anthropic: `["claude-sonnet-4-5"]`
   - Local: `[]` (self-hosted; if it fails, it fails)
4. **Settings UI** — new "Fallback models (comma-separated)" input in the gear-icon modal. `parseFallbackModels()` trims + dedupes + filters empties. `Test connection` reports `"✓ OK (fell back to gemini-2.0-flash)"` when the fallback kicked in, so the user can see the chain working.
5. **Result shape upgrade** — `chatCompletion` now returns `{ text, raw, modelUsed, attempts }`. `skillEngine` forwards these so the UI (future) can surface "ran on model X after N attempts".

### Tests — Suite 36, RB1–RB7

- **RB1** · Anthropic request carries the required `anthropic-dangerous-direct-browser-access: true` header.
- **RB2** · chatCompletion retries on 503 and succeeds when upstream recovers (scripted fetch queue: `[503, 503, 200]` → 3 calls, `modelUsed = primary`).
- **RB3** · chatCompletion does NOT retry on 401 (exactly 1 call, error thrown, message preserves the "auth failed" hint).
- **RB4** · Fallback-model chain engages when the primary exhausts retries (queue: `[503×MAX, 200]` → last call targets the first fallback, `modelUsed = fallback`).
- **RB5** · Chain exhaustion throws the last transient error with the 5xx prefix intact.
- **RB6** · `backoffMs` stays in `[0, cap]` for all attempts; `RETRIABLE_STATUSES` includes 429/503 and excludes 401/400.
- **RB7** · `DEFAULT_AI_CONFIG` ships non-empty fallback chains for the public providers; `parseFallbackModels()` round-trips through save/load correctly.

### Files

- MOD · `services/aiService.js` (retry loop + fallback chain + Anthropic header + exported `backoffMs`, `RETRY_MAX_ATTEMPTS`, `RETRIABLE_STATUSES`)
- MOD · `core/aiConfig.js` (added `fallbackModels: []` to every provider default; `mergeWithDefaults` honours user-supplied chain)
- MOD · `ui/views/SettingsModal.js` (fallback-models input + `parseFallbackModels` export)
- MOD · `services/skillEngine.js` (threads `fallbackModels` through to `chatCompletion`; forwards `modelUsed` + `attempts`)
- MOD · `diagnostics/appSpec.js` (Suite 36 · RB1–RB7)
- MOD · `SPEC.md §12.1` + new §12.4a
- MOD · `docs/CHANGELOG_PLAN.md` (this entry)

### Why not MCP / server-side API gateway (asked)

- **MCP** is a protocol for letting an LLM call external tools (filesystem, databases, etc.). It does nothing for provider reliability.
- **Server-side API gateway** is v3-platform territory (see Bucket E). It hides keys from end users and centralises rate-limiting — useful when multiple presales share one backend. For a single-user workshop tool where the presales owns the keys, it's pure deployment overhead and wouldn't fix either of today's errors.

---

## v2.4.5 · Phase 19e · Foundations Refresh — IMPLEMENTED (2026-04-24)

**Goal**: Fix the four known UX bugs in v2.4.4 (driver tile vanishes on AI apply, tab blanks after undo, undo chip is vague, undo doesn't persist) AND establish the two-surface testing discipline (`feedback_foundational_testing.md`) so demo + seed skills + demoSpec never drift from the live data model again.

### What shipped — six items, one release

1. **Session-changed event bus** — new `core/sessionEvents.js` · `onSessionChanged / emitSessionChanged`. `applyProposal`, `applyAllProposals`, `undoLast`, `undoAll`, `resetSession`, `resetToDemo` all emit. `app.js` subscribes once and re-renders `renderHeaderMeta() + renderStage()` on every event. Fixes "driver tile vanishes" + "tab blanks after undo" without any per-view surgery.
2. **Undo chip UX** — tooltip lists stack depth + top 5 labels newest-first; depth badge on the chip; new `↶↶ Undo all` chip appears when `depth >= 2` and reverts every tracked change in one confirmed click. Wiring in `app.js`, markup in `index.html`, styles in `styles.css`.
3. **Persistent undo** — `state/aiUndoStack.js` serialises to localStorage under `ai_undo_v1`, bounded to 10 entries, cleared on `resetSession` / `resetToDemo`. Added `undoAll()`, `recentLabels()`, `clear()`, `depth()` helpers.
4. **Extract `state/demoSession.js`** — demo data lifted out of `sessionStore.js`. Default persona `acme-fsi` refreshed to exercise Phase 16 workloads (workload-layer instance with `mappedAssetIds`) + Phase 18 multi-linked pattern (`i-005` referenced by both `g-001` and `g-006`) + explicit `driverId` on every gap (Phase 14) + `reviewed` fields. Two new stub personas (`meridian-hls`, `northwind-pub`) registered in `DEMO_PERSONAS` for future switch-persona UX.
5. **NEW `core/seedSkills.js`** — 6 seed skills, one per tab plus an extra on the Context tab. Four are `json-scalars` + `confirm-per-field` and exercise writable fields added in v2.4.4 (driver priority/outcomes, instance criticality/notes, disposition/phase/notes, gap description/urgency/notes). All deployed on first run so every tab has a populated `✨ Use AI ▾` dropdown. `skillStore.seedSkills()` delegates here.
6. **NEW `diagnostics/demoSpec.js`** — Suites 31-35 registered into the appSpec runner via `registerDemoSuite()`. Asserts: demo session passes `validateInstance` + `validateGap`; Phase 16 workload mapping present; Phase 18 multi-link present; Dell + non-Dell vendors; gap with driverId; driver with outcomes; every seed skill round-trips `normalizeSkill`; every seed `outputSchema` path exists in `FIELD_MANIFEST` AND is `writable: true`; every writable context path has a `WRITE_RESOLVERS` entry; every tab has ≥1 deployed seed; text-brief + json-scalars both represented; `applyProposal → undoLast` and `applyAll → undoLast` are byte-identical round-trips; all `DEMO_PERSONAS` build valid sessions; `applyProposal` emits `"ai-apply"` and `undoLast` emits `"ai-undo"`.
7. **NEW `docs/DEMO_CHANGELOG.md`** — audit trail for the demo + seed surfaces, separate from this file. Process rule: every future data-model change touches demo + seed + demoSpec + this log in the same commit.

### Files touched

- NEW · `core/sessionEvents.js`, `core/seedSkills.js`, `state/demoSession.js`, `diagnostics/demoSpec.js`, `docs/DEMO_CHANGELOG.md`.
- MOD · `state/sessionStore.js` (re-exports `createDemoSession`, emits on reset flows, clears undo stack), `state/aiUndoStack.js` (persistence + undoAll + clear + recentLabels), `interactions/aiCommands.js` (emit `ai-apply`), `core/skillStore.js` (delegates `seedSkills()` to new module), `app.js` (subscribes to session-changed bus, upgraded undo chip), `index.html` (undo-all chip + count badge), `styles.css` (chip styles), `diagnostics/appSpec.js` (registers demoSpec), `SPEC.md` (§12.5 persistent undo, §12.5a sessionEvents, §12.8 invariants 6-8).

### Tests

416 assertions in `appSpec.js` (unchanged) + 17 new assertions (DS1–DS17) in `demoSpec.js` = **433 total**, green banner required.

### Known issues from v2.4.4 — now resolved

1. ✅ Post-undo tab blanking — fixed by session-changed bus.
2. ✅ Driver tile vanishes on AI apply — fixed by session-changed bus.
3. ✅ Undo chip vague — fixed (tooltip + depth badge + Undo all).
4. ✅ Undo not persistent — fixed (`ai_undo_v1`).
5. ✅ Demo session stale — refreshed default persona + 2 new personas.
6. ✅ Seed skill library minimal — 6 skills, json-scalars on 4 tabs.

---

## v2.4.3 · Phase 19d.1 · Prompt guards + Refine-to-CARE + test-before-save gate — IMPLEMENTED (2026-04-19)

**Goal**: Enforce output quality across every skill. User was getting long-article AI responses unsuitable for live workshop use. Also: give users an AI-powered "rewrite my messy prompt into CARE format" button, and force a test-before-save discipline so broken skills never ship.

### Locked decisions

- Output-format footer is **mode-aware from day one**. Today only `text-brief` is wired; `json-schema` + `action-commands` are declared as stubs that throw with a version pointer. Prevents the universal-footer trap that would break structured-output skills when v2.4.4 introduces them.
- `text-brief` footer is **non-removable**: ≤120 words, numbered bullets, no preamble / meta / disclaimer. Appended AFTER the user's system prompt so positional priority favours it.
- **CARE** (Context / Ask / Rules / Examples) is for the **user's own prompt structure**, not the output format. Used by the Refine button as a scaffold, not by the mandatory footer.
- Refine always shows a **side-by-side diff**. User accepts (replace), keeps (discard refined), or edits the refined side first. No silent AI-on-AI overwrites.
- **Save-before-test gate** is mandatory. `lastTestedSignature` tracks the last draft that successfully tested; Save disables until current draft signature matches it. Any edit invalidates.

### What shipped

- `core/promptGuards.js` — `getSystemFooter(mode)` + `summaryForMode(mode)` + `REFINE_META_SYSTEM` + `REFINE_META_RULES` + `OUTPUT_MODES` triad.
- `services/skillEngine.js → runSkill()` — footer injection.
- `ui/views/SkillAdmin.js` — footer hint, Refine button + diff panel, save-gate logic.
- `styles.css` — `.skill-form-footer-hint`, `.refine-row`, `.refine-diff`, `.save-gate-hint`.
- Suite 29 PG1-PG6 (6 new assertions).

### Bugs caught + fixed in flight

1. **`var`-hoisting trap**: three listener attachments (`sysArea`, `tabSel`, `modeSel`) were above `modeSel`'s declaration. `var` hoists the name but not the value, so `modeSel` was undefined when `addEventListener` ran. Fix: moved the wires to after all fields are declared. Five tests (FP5/6/8/9, PG5) were failing from the aborted render; all pass after the fix.
2. **Browser cache (nginx max-age=300 on JS)** hid the fix on first rebuild. Not a code bug — future sanity: incognito window is the fastest way to confirm a JS change during active development.

### Out of scope, queued

- **v2.4.4** — json-schema mode footer + apply-on-confirm + undo stack + per-skill provider.
- **v2.4.5+** — action-commands mode (structured session manipulations).
- **v2.5.0 crown-jewel** — UX/IA/styling review.

---

## v2.4.2.1 · Phase 19c.1 · Pill-based binding editor + error-message polish — IMPLEMENTED (2026-04-19)

**Goal**: Replace the template textarea with a contenteditable editor hosting inline uneditable pill elements for each binding. Error-proof (no partial `{{path}}` corruption), colour-discriminated (blue scalar / amber array / italic bare), delete-as-unit via Backspace.

### What shipped

- `ui/components/PillEditor.js` — `createPillEditor({initialValue, manifest, onInput})` returns a DOM element with textarea-compatible API. `parseToSegments` + `serializeEditor` exported pure.
- `ui/views/SkillAdmin.js` — edit form swaps the textarea for the pill editor; save/test/preview paths route through `editor.serialize()`.
- `services/aiService.js` — error-message categorisation: 401/403 → API-key hint, 429 → rate-limited hint, 5xx → upstream-transient hint.
- `styles.css` — `.pill-editor`, `.binding-pill.is-scalar|is-array|is-bare`.
- Suite 28 PE1-PE7 (7 new assertions); FP6/FP8 updated to the pill-editor contract.

### Bugs caught + fixed in flight

1. **Tab-change rebuilt the editor** against the new tab's manifest, stranding labels from tab-specific bindings as plain text next to bare pills (user saw "text instead of pills" on Desired/Current). Fix: tab-change now only refreshes chips + preview; editor state persists.
2. **Gemini 403 vs 503 looked identical** in the UI. Error categorisation now distinguishes auth failures (user-fixable) from upstream transients (retry-or-switch).

### Out of scope, queued

- **v2.4.3** — output handling + undo stack + per-skill provider assignment (3-item bundle).
- **v2.5.0 crown-jewel** — "Use AI" button placement on Tabs 2-5, right-panel drill-down interactivity, whitespace/density pass.

---

## v2.4.2 · Phase 19c · Field-pointer mechanic + LLM-friendly coercion + test-skill — IMPLEMENTED (2026-04-19)

**Goal**: Make the skill builder point-and-click instead of type-from-memory. Plus two correctness fixes that became visible when we started exercising the pipeline with non-scalar bindings.

### Locked decisions

- **Labeled insertion by default.** Chip click inserts `Label: {{path}}` so the LLM sees e.g. *"Customer name: Acme Corp"* on the rendered side — self-documenting for the model. Alt-click to override with bare `{{path}}` when the template describes the field inline.
- **JSON coercion for non-scalars.** Arrays and objects pretty-print via `JSON.stringify(v, null, 2)` with a 1200-char soft cap. Previous `String(v)` produced `"[object Object]"` which was useless.
- **Live preview uses first-item fallback context.** Empty session still shows a usable preview (placeholder selected-driver/gap/instance) so users can build skills before data exists.
- **"Test skill now" dry-runs the unsaved draft.** Doesn't persist anything; doesn't apply anywhere. Pure prompt-iteration loop. Uses the active AI provider.
- **Pill-based editor deferred** to v2.4.2.1. User-proposed mid-build; the rework is meaningful (contenteditable with inline uneditable spans + cursor handling + serialize/deserialize) and deserves its own focused slice.

### What shipped

- `core/fieldManifest.js` — per-tab bindable-field list. Each entry `{path, label, kind}`. 6 shared `session.*` fields appear on every tab; `context.*` fields are tab-specific. `fieldsForTab(tabId)` + `buildPreviewScope(session, tabId)` exported.
- `ui/views/SkillAdmin.js` — below the template textarea:
  - **Field chips** (blue scalars, amber arrays). Tooltip shows click vs Alt-click behaviour.
  - **Live preview** panel. Updates on textarea input + tab change.
  - **Test skill now** button + `.skill-form-test-out` target.
- `services/skillEngine.js` — `coerceForLLM(v)` exported. `renderTemplate()` now calls it per binding.
- `styles.css` — `.field-chip-list` / `.field-chip` / `.field-chip.is-array` / `.template-preview` / `.skill-form-test-row` / `.skill-form-test-out`.
- `diagnostics/appSpec.js` — Suite 27 FP1-FP9.

### Test (manual)

| Verification | Result |
|---|---|
| Container HEALTHCHECK | `(healthy)` ✅ |
| Served appSpec carries 10 `FP*` markers | ✅ |
| Browser banner: 386/386 green | ✅ user-confirmed |
| Click-to-insert with Customer name chip | ✅ inserts `Customer name: {{session.customer.name}}` |
| Alt-click inserts bare binding | ✅ |
| `{{session.gaps}}` in preview renders JSON | ✅ |
| "Test skill now" runs against Gemini 2.5-flash | ✅ |

### Out of scope, queued

- **v2.4.2.1 pill-based editor** — user-proposed UX refinement; locked spec saved to `project_deferred_design_review.md`.
- **v2.4.3** — output parsing, apply-on-confirm, undo stack, per-skill provider assignment.
- **VLM (:8001)** — no current skill needs images; re-open when a use case appears.

---

## v2.4.1 · Phase 19b · Skill Builder (admin panel + per-tab dropdown + templated prompts) — IMPLEMENTED (2026-04-19)

**Goal**: Turn v2.4.0's hardcoded Tab-1 button into an AI *platform*. Presales define and deploy their own skills per tab; the runtime surfaces them via a `"✨ Use AI ▾"` dropdown. No code changes required to add a new skill — it's admin-panel-driven.

### Locked decisions (Phase 19 wave 2 of 4)

- Skills live in browser localStorage under `ai_skills_v1`. Same shape contract as the AI provider config from v2.4.0; revisit at v3 when we move user state server-side.
- Each skill is bound to exactly one target tab; reads `{ session, context }` where `context` is tab-local state passed in by the view.
- Template syntax: `{{dot.path}}` against the scope object. Missing paths render as empty strings (deliberate — skills must be robust to partial session data during a live workshop).
- Seeded on first load: the Tab 1 driver-question skill is auto-created and deployed so fresh installs keep the v2.4.0 UX working unchanged.
- Output modes declared today: `suggest` (functional), `apply-on-confirm` + `auto-apply` (persisted but no-op; wired in v2.4.3).
- Settings modal now has two top-level sections: **AI Providers** | **Skills**.
- UI-friendly labels: fields renamed from technical `systemPrompt` / `promptTemplate` to **"AI role / instructions"** and **"Data for the AI"**.

### What shipped

- `core/skillStore.js` — schema + localStorage CRUD + `seedSkills()`. `normalizeSkill()` pins required fields and coerces unknown `tabId` / `outputMode` to safe defaults so future saves survive.
- `services/skillEngine.js` — `renderTemplate()` (pure, missing-is-empty), `extractBindings()` (returns unique `{{path}}` references for the UI readout, also used by v2.4.2's field-pointer mechanic), `runSkill(skill, session, context)` composes system + user messages and routes through `aiService.chatCompletion`.
- `interactions/skillCommands.js` — generic `runSkillById()` + `skillsForTab()` exports. Legacy `runDriverQuestionSkill` wrapper retained over the seeded skill so any existing call site stays functional.
- `ui/views/SkillAdmin.js` — list view (one row per skill; deploy toggle + edit + delete) + inline edit form with live "detected bindings" readout beneath the data textarea. Empty state when no skills persist.
- `ui/views/SettingsModal.js` — top-level section row switches the modal body between AI Providers and Skills. `openSettingsModal({ section: "skills" })` opens direct to the admin.
- `ui/components/UseAiButton.js` — tab-agnostic dropdown factory. `useAiButton(tabId, { getSession, getContext, getResultEl })` renders `"✨ Use AI ▾"` with a menu of deployed skills for that tab. Returns an empty hidden span if no deployed skills (no empty dropdown chrome).
- `ui/views/ContextView.js` — driver detail panel now uses `useAiButton("context", …)` instead of the v2.4.0 hardcoded button. Output card identical to keep the UX stable.
- `styles.css` — `.settings-section-*`, `.skill-admin-*`, `.skill-row*`, `.skill-form*`, `.use-ai-*`.
- `appSpec.js` — Suite 26 SB1-SB8. Also retargeted AI9 from Suite 25 to look for `.use-ai-btn` (the v2.4.1 replacement for the v2.4.0 `.ai-skill-btn`).

### Test (manual, local on Windows host)

| Verification | Result |
|---|---|
| Container HEALTHCHECK after rebuild | `(healthy)` ✅ |
| Browser banner | 377/377 green (369 prior + 8 new SB + 1 AI9 retargeted) ✅ user-confirmed |
| Tab 1 driver detail → Use AI dropdown lists seeded skill; clicking runs real Gemini | ✅ user-confirmed |
| Settings modal → *AI Providers* / *Skills* pills → Skills admin renders seed row | ✅ user-confirmed |
| `+ Add skill` form persists; deploy toggle flips visibility in the Tab 1 dropdown | ✅ user-confirmed |

### Bugs caught + fixed in flight

1. **AI9 test failure after Phase 19b refactor** — v2.4.0's `.ai-skill-btn` was replaced by `.use-ai-btn` in the new UseAiButton component; old AI9 assertion still looked for the retired class. Retargeted with a `.use-ai-btn, .ai-skill-btn` fallback selector so the test stays meaningful without churning every time the component is refactored.

### Out of scope, queued

- **v2.4.2 click-to-bind field-pointer mechanic** — the biggest UX win still outstanding. v2.4.1 requires users to type `{{session.customer.name}}` by hand, which means they need to know the data shape. v2.4.2 will make the target tab's form fields clickable in a design mode; clicking inserts the right path at the prompt-textarea cursor.
- **v2.4.3 output handling** — parse, propose, apply-on-confirm. Today skills display raw response text only.

---

## v2.4.0 · Phase 19a · AI foundations (3-provider client + settings + demo skill) — IMPLEMENTED (2026-04-19)

**Goal**: Prove the AI wiring end-to-end against real public endpoints before building the admin skill builder on top. Ship the smallest slice that gives the user a real-feedback loop.

### Locked decisions (recap)

- **Not a hardcoded button** — the canvas is building toward an AI Agent Builder. v2.4.0 is the foundation layer; v2.4.1 will add the skill-building UI; v2.4.2 the field-pointer mechanic; v2.4.3 output application.
- **Three providers, same architecture** — local vLLM (GB10), Anthropic Claude, Google Gemini. Reached via a same-origin nginx reverse-proxy so public providers don't trip browser CORS.
- **Keys in browser localStorage, keys flow through our nginx** — acceptable for personal dev; v3 multi-user will move keys server-side.
- **Local-LLM URL is editable**; public-provider URLs are locked to the proxy path (editing would 404).
- **Output mode = suggest** for the demo skill (v2.4.0); apply-on-confirm semantics ship in v2.4.3.

### What shipped

- `core/aiConfig.js` — config schema + localStorage round-trip + deprecated-model auto-migration (`gemini-2.0-flash` → `gemini-2.5-flash`) so a saved stale model repairs itself without touching the user's API key.
- `services/aiService.js` — provider-aware `chatCompletion()`. Exported `buildRequest()` is pure so tests assert per-provider request shape without a real network call. Handles:
  - OpenAI-compatible: `POST /chat/completions` with `Authorization: Bearer` header.
  - Anthropic: `POST /v1/messages` with `x-api-key` + `anthropic-version: 2023-06-01` headers; system message collapsed into body `system` field.
  - Gemini: `POST /v1beta/models/<model>:generateContent?key=…`; system into `systemInstruction`; `assistant` role renamed to `model` in `contents[]`.
- `ui/views/SettingsModal.js` — gear-icon-opened modal. Three provider pills (active persists). Endpoint/model/key fields with contextual help. `Test connection` probe fires "Reply OK" and surfaces the result inline (green on success, red on failure).
- `ui/icons.js` — added `gearIcon()` and `sparkleIcon()`.
- `index.html` — new `.header-right` container with `#sessionMetaHeader` + `#settingsBtn` (SVG gear).
- `styles.css` — `.gear-btn`, `.settings-overlay`, `.settings-box`, `.settings-provider-pill`, `.settings-field`, `.settings-probe-out`, `.ai-skill-card`, `.ai-skill-result`.
- `app.js` — `wireSettingsBtn()` binds the gear click.
- `interactions/skillCommands.js` — `runDriverQuestionSkill(session, driver)` builds a prompt from driver + customer context, routes through `chatCompletion()`, returns `{ok, text, providerKey}` or `{ok: false, error}`.
- `ui/views/ContextView.js` — `buildAiDemoCard()` appended to every driver-detail panel. Shows status text during call, re-runs idempotently.
- **Container plumbing:**
  - `docker-entrypoint.d/45-setup-llm-proxy.sh` generates `/etc/nginx/snippets/llm-proxy.conf` at container start with all three proxy locations. Env-driven: `LLM_HOST` (default `host.docker.internal`) + `LLM_LOCAL_PORT` (default `8000`).
  - `nginx.conf` — `include /etc/nginx/snippets/llm-proxy.conf;` at server scope, just after the auth snippet include.
  - `docker-compose.yml` — declares `LLM_HOST` + `LLM_LOCAL_PORT` env passthroughs; adds `extra_hosts: host.docker.internal:host-gateway` so Linux Docker 20.10+ can resolve the special hostname (no-op on Mac/Windows).
  - `Dockerfile` — COPY + chmod +x of the new entrypoint script alongside the existing auth script.
- `appSpec.js` Suite 25 (AI1-AI9 + AI2b) — 10 new assertions covering config defaults, save/load round-trip, deprecated-model migration, `isActiveProviderReady` semantics, request shape per provider, response extraction per provider, gear-button presence, and ContextView AI card render.

### Test (manual, local on Windows host)

| Verification | Result |
|---|---|
| Container HEALTHCHECK after rebuild | `(healthy)` ✅ |
| `45-setup-llm-proxy.sh` entrypoint log: "LLM proxy snippet written…" | ✅ |
| Served `appSpec.js` carries 10 `AI*` markers | ✅ |
| Browser: banner 369/369 green | ✅ user-confirmed |
| Browser: gear icon opens settings modal with 3 provider pills | ✅ |
| Browser: Test-connection against real Gemini 2.5-flash returns 200 + "OK" sample | ✅ user-confirmed |
| Browser: Tab 1 "Suggest discovery questions" renders real Gemini response | ✅ user-confirmed with real output |

### Bugs caught + fixed in flight

1. **Gemini 2.0-flash 404'd** — deprecated to new users in 2026-Q1. Default updated to `gemini-2.5-flash`; auto-migration added so saved configs with the old value repair themselves without user action. New AI2b test pins the migration behaviour.

### Out of scope, queued for v2.4.x

- **v2.4.1** — skill builder UI (admin list + add/edit form + per-tab "Use AI" dropdown).
- **v2.4.2** — field-pointer mechanic (click a form field while editing a skill → insert `{{field.path}}` at cursor).
- **v2.4.3** — output handling (parse → propose → apply-on-confirm; streaming optional).

---

## v2.2.3 · Phase 15.3 · Visual depth — tighter radii + heading tracking + monospace metrics (2026-04-19)

Small targeted tightening on top of v2.2.2:
- Radii 6/10/14 → 4/6/10 (halfway between prior and the GPLC reference's 3/5/8).
- Global heading hardening: `h1-h5 + .card-title + .detail-title + .dialog-title + .header-title` get `font-weight:700` + `letter-spacing:-0.01em`. Body gets `-webkit-font-smoothing: antialiased`.
- Roadmap project-card `.link-badge` switches to JetBrains Mono + `tabular-nums`. Reads like a financial-report metric line rather than a chat bubble.

359/359 tests green; user-confirmed visual delta.

---

## v2.2.2 · Phase 15.2 · Dell brand-token refresh + Inter typography — IMPLEMENTED (2026-04-19)

**Goal**: Bring the app's visual tokens in line with the Dell brand reference design (the GPLC sample HTML the user shared). Token-only swap so we get a brand-aligned look without risking layout regressions across the 359-test surface.

### Locked decisions

1. **Variable NAMES preserved, VALUES refreshed.** Every existing component (`.btn-primary`, `.card`, `.kanban-col`, `.gap-card`, the new `.linked-inline-wrap` and `.mapped-assets-section`, etc.) continues to reference `var(--brand)`, `var(--text-1)`, `var(--surface-2)`, `var(--shadow)`, etc. — only the values changed. Zero per-component edits, zero behaviour change, zero test fallout.
2. **Radii NOT changed** (kept 6/10/14). The GPLC sample uses sharper 3/5/8 radii, but tightening would visibly shrink rounded corners across thousands of elements and is out of scope for a token swap. Re-open if a future polish pass calls for it.
3. **Component-pattern adoption (cards, eyebrows, monospace nums) NOT pulled in.** The GPLC sample is a static document with a heavier visual vocabulary; the Discovery Canvas is interactive and benefits from the lighter touch already in place. Adopt selectively if user calls it out.

### What shipped

- `styles.css :root` — every brand/ink/surface/shadow value refreshed to Dell tokens. Highlights:
  - `--brand` `#007DB8` → **`#0076CE`** (Dell Blue official)
  - `--brand-dark` `#005F8E` → `#0063AE` (deep)
  - `--brand-light` `#E0F2FC` → `#E8F2FB` (soft)
  - `--text-1` `#0F1729` → **`#0B2A4A`** (Dell ink — bluer than generic grey)
  - `--text-2`, `--text-3` shifted to Dell ink scale
  - `--bg`, `--surface-2`, `--border`, `--border-mid` aligned to Dell cooler greys
  - `--shadow*` switched from `rgba(0,0,0,…)` → `rgba(11, 42, 74, …)` so depth reads as Dell ink rather than generic darkness
  - `--dell-strip` updated to `#0076CE`
  - `--font` `"DM Sans"` → **`"Inter"`** (300-800)
  - `--font-mono` `"DM Mono"` → **`"JetBrains Mono"`** (400-600)
- `styles.css #app-header` — gradient updated from `#005F8E → #007DB8 → #0099DB` to `#00447C → #0063AE → #0076CE` (Dell deep → Dell blue).
- `index.html` — Google Fonts `<link>` swapped from DM Sans + DM Mono to Inter + JetBrains Mono. CSP allow-list already covers `fonts.googleapis.com` + `fonts.gstatic.com` (set in v2.2.0); no nginx changes needed.

### Test (manual, local on Windows host)

| Verification | Result |
|---|---|
| Container HEALTHCHECK after rebuild | `(healthy)` ✅ |
| Served `styles.css` carries Dell Blue (`#0076CE`) and Inter | ✅ (3 hits each) |
| Browser banner: 359/359 still green (no logic touched) | ✅ user-confirmed |
| Visual regression eyeball across all tabs | ✅ "looks very similar to before" — token swap was conservative by design |

### Out of scope (queued or not planned)

- **Tighter radii** (3/5/8) — would shrink corners app-wide; revisit if next workshop feedback prefers sharper.
- **Adopt GPLC card vocabulary** (eyebrow text, monospace nums, 1px hairline rules) — the sample is a document, the canvas is interactive; bring across only when a specific surface needs it.
- **Type hierarchy uplift** (heading sizes, weight 800 for the cover, monospace for metrics) — pair with the deferred crown-jewel review where Reporting overview gets its own attention.

---

## v2.3.1 · Phase 16 · Workload Mapping (6th layer + N-to-N + upward propagation) — IMPLEMENTED (2026-04-19)

**Goal**: Give presales a way to capture *what the customer actually does* (workloads, business apps) on top of *what they run on* (compute / storage / network etc.), and let workload criticality flow down to the underlying infrastructure on explicit confirm. This is foundational for the "crown-jewel alignment" review later — once workloads exist as first-class citizens, the Gaps and Roadmap views can speak the customer's language.

### Locked decisions (recap)

- **Workload is a 6th layer** in `LAYERS`, placed **first** (top row in the matrix; highest abstraction).
- **Cardinality**: N-to-N. A workload maps to many assets; an asset can be mapped from many workloads.
- **Criticality propagation**: upward only, on explicit confirm. Per-asset confirmation, no silent bulk upgrades. Never auto-downgrades.
- **Mapping is a property of the workload** (`workload.mappedAssetIds[]`). Assets carry no back-reference — same model as gap-link, same cascade safety.

### What shipped

- `core/config.js` — `LAYERS` extended with `{ id: "workload", label: "Workloads & Business Apps" }` as the first entry. `CATALOG.workload` populated with **14 entries** in 5 groups:
  - **Dell Validated Designs** (3): DVD-SAP HANA, DVD-AI/RAG, DVD-VDI/EUC. Real Dell offerings; satisfies the existing test that every layer has a Dell tile.
  - **Vendor-packaged business apps** (4): ERP (SAP/Oracle/Dynamics), CRM (Salesforce/Dynamics), HCM (Workday/SAP HR), M365.
  - **Industry-vertical systems** (3): EHR/Clinical, Core Banking/Payments, Billing.
  - **Data & analytics** (3): DW/Lakehouse, BI, AI/ML.
  - **Application footprints** (4): Customer-facing web app (Custom), Internal LOB (Custom), DB service, DevOps platform.
- `core/models.js` — `validateInstance` accepts optional `mappedAssetIds: string[]`, **strictly enforced** to be present only on `workload`-layer instances. Non-workload tiles carrying the field throw at validation time (a non-workload tile with mappedAssetIds is a bug, never a feature).
- `interactions/matrixCommands.js` — three new exports:
  - `mapAsset(session, workloadId, assetId)` — adds id to `workload.mappedAssetIds` (deduped). Throws on self-map, workload→workload, cross-state (current ↔ desired), unknown ids, or non-workload source.
  - `unmapAsset(session, workloadId, assetId)` — removes id; idempotent.
  - `proposeCriticalityUpgrades(session, workloadId)` — **pure / non-mutating**. Returns `[{ assetId, label, layerId, currentCrit, newCrit }]` for every mapped asset with criticality strictly below the workload's. Empty when workload has no criticality, or when all assets meet/exceed it. Caller applies upgrades via existing `updateInstance` — keeps the mutation surface narrow.
- `ui/views/MatrixView.js` — workload tiles render an extra **Mapped infrastructure** section in the detail panel (only when `inst.layerId === "workload"`):
  - List of mapped-asset rows: vendor dot, label, layer/env subtitle, criticality chip (color-coded), unmap "x" button.
  - `+ Map asset` button opens a modal picker scoped to other 5 layers + same state as the workload.
  - `↑ Propagate criticality` button (Dell-blue accent) appears only when workload has criticality + ≥ 1 mapped asset. Walks proposals one at a time with `confirm()`; on accept, calls `updateInstance(session, p.assetId, { criticality: p.newCrit })`. Toast on completion.
- `styles.css` — `.mapped-assets-section` (panel), `.mapped-asset-row` (compact row, gap-link cousin), `.mapped-asset-crit.crit-{low,medium,high}` (criticality chip), `.propagate-btn` (Dell-blue outlined).
- `diagnostics/appSpec.js` — Suite 24 with **6 W-tests**:
  - W1 — workload is `LAYERS[0]`; addInstance accepts mappedAssetIds=[].
  - W1b — validateInstance throws if mappedAssetIds appears on a non-workload instance.
  - W2 — mapAsset dedups; refuses self-map, workload→workload, and cross-state mapping; unmapAsset removes.
  - W3 — proposeCriticalityUpgrades returns lower-criticality assets when workload is High; updateInstance applies the upgrade.
  - W4 — proposeCriticalityUpgrades returns nothing when all mapped assets meet or exceed the workload's criticality.
  - W5 — proposeCriticalityUpgrades is pure; repeated calls don't mutate any instance.
- `appSpec.js` — also updated existing test "LAYERS contains the 5 required architecture groups" → "5 required infrastructure groups (plus workload as the 6th)" with an explicit assertion that the workload layer exists. Logic unchanged for the original 5 ids.

### Test (manual, local on Windows host)

| Verification | Result |
|---|---|
| Container HEALTHCHECK after rebuild | `(healthy)` ✅ |
| Served `appSpec.js` carries 6 `W*` markers + 4 DVD references | ✅ |
| Browser banner inside running app: 358/358 green | (awaiting user confirm) |

### Foundational link to the deferred crown-jewel review

This phase deliberately introduces *workloads* as a first-class concept. The deferred design review (`project_deferred_design_review.md`) flagged that the Gaps tab and Roadmap currently use vendor-/layer-centric vocabulary that doesn't read as "what the customer's CxO cares about". Once workloads exist on the matrix, the next obvious move (queued for v2.5.0) is to surface workload-anchored views in Gaps and Roadmap — e.g., *"Initiatives that protect the EHR workload"* rather than *"Compute-layer replace projects in coreDc"*. Phase 16 doesn't do that surfacing yet — it only ships the layer + the data model + the criticality-propagation primitive — but it gets the foundation in place so the alignment pass becomes mostly UI work.

### Out of scope, queued

- **Workload appears in Gaps + Roadmap views** — still scoped to the v2.5.0 alignment pass.
- **Cross-workload dependency mapping** (workload-to-workload "calls") — explicitly NOT shipped; workloads only map to infrastructure layers per locked decision.
- **Workload-state migration helpers** — old sessions saved before v2.3.1 simply have no workload instances; no migration needed.
- **Workload roadmap aggregation pattern** — the existing buildProjects bucket key `envKey::layerId::gapTypeKey` will naturally include workload-layer gaps as their own projects. Whether that's the right roadmap shape for workload-anchored thinking is part of the v2.5.0 review.

---

## v2.3.0 · Phase 18 · Gap-link surfacing + double-link safety + roadmap dedup — IMPLEMENTED (2026-04-19)

**Goal**: make cross-gap links visible and safe. With Phase 12's "Manage links" collapse, presales had to click before they could see what was linked. The locked Item 9 decision (warn-but-allow on double-linking) means the same instance can intentionally appear in multiple gaps — so the UI needed both *visibility at rest* and *visibility at the point of decision*, plus a roadmap-side dedup so multi-linked assets don't inflate project counts.

### Locked decisions (recap)

- **Item 8** — Always-visible inline link sections in the gap detail panel. No toggle, no chevron, no "Manage links" button. Confirmed for ship 2026-04-19 evening.
- **Item 9** — Warn-but-allow on double-linking. No strict uniqueness constraint, no reverse index. Yellow warning row in the picker; red "linked to N gaps" chip on the asset row in the gap detail.
- **Item 10** — Cascade safety is already a structural property of the data model (gap owns the link arrays; instances carry no back-references). Documented as a regression test rather than as code change.

### What shipped

- `GapsEditView.js` — Removed `linkedSummaryRow` + `manageBtn` + `manageWrap` collapse machinery. Two `.link-section`s render inline inside a new `.linked-inline-wrap`, always expanded. New helpers `countGapsLinking(session, instanceId)` and `findOtherGapLinking(session, instanceId, excludeGapId)` drive the multi-linked chip and the picker warning row respectively. `openLinkPicker` prepends `.link-warning-row` above any candidate already linked to another gap. `buildLinkRow` appends `.multi-linked-chip` when the count ≥ 2.
- `SummaryRoadmapView.js` — Project right-panel "Linked technologies" count switched from summing `length` (which double-counted multi-linked assets) to a `Set` of unique instance ids. Copy updated to *"N unique technologies across M gaps"*.
- `ui/icons.js` — `chainIcon` and `chevronIcon` deleted (no remaining consumers after the Manage-links removal). `helpIcon`, `starSolidIcon`, `starOutlineIcon` retained.
- `styles.css` — Dropped `.linked-summary-row`, `.linked-manage-btn`, `.linked-manage-wrap`. Added `.linked-inline-wrap` (panel container), `.link-warning-row` (yellow), `.multi-linked-chip` (red, uppercase, small).
- `.gitattributes` (NEW) — Forces LF endings on shell scripts and container plumbing files (`*.sh`, `docker-entrypoint.d/**`, `Dockerfile`, `nginx.conf`, `docker-compose.yml`). Without this, git on Windows checks out `40-setup-auth.sh` with CRLF and the container loops with `/bin/sh\r: not found` — exactly what bit us in this phase before the fix.
- `appSpec.js` — New Suite 23: 5 T8.* assertions covering Items 8 (no collapse), 9a (warning row), 9b (multi-linked chip), 10 (cascade-safe deleteGap), and the roadmap dedup invariant.

### Bugs caught + fixed in flight

1. **CRLF in entrypoint script after fresh checkout** — On the new branch, git auto-converted `docker-entrypoint.d/40-setup-auth.sh` from LF to CRLF on the working tree, which broke the shebang and put the container in a restart loop with exit code 127 ("Launching ... not found"). Fixed by adding `.gitattributes` to enforce LF on all container plumbing files and re-normalising. Same root cause would have hit any future Windows-host contributor; now nailed down for the project lifetime.
2. **Superseded T6.13 still asserting on a removed feature** — The Phase 12 test "Manage-links control renders an SVG with aria-expanded attr" was still in the suite, asserting the existence of the very element Phase 18 deletes. Test correctly went red on first browser run; retired (T8.1 in Suite 23 asserts the inverse contract).
3. **T8.5 used invalid `affectedEnvironments: ["prod"]`** — `validateGap` rejected it because valid env ids are `coreDc`, `drDc`, `publicCloud`, `edge`. Fixed to `EnvironmentIds[0]` so the test stays correct if env labels evolve.

### Test (manual, local on Windows host)

| Verification | Result |
|---|---|
| Container HEALTHCHECK after rebuild | `(healthy)` ✅ |
| `/health` returns `ok` | ✅ |
| `appSpec.js` served from container with 6 `T8.*` markers (5 tests + 1 suite) | ✅ |
| Browser banner inside the running app: 352/352 green | ✅ (after retiring superseded T6.13 + fixing T8.5 env id) |

### Out of scope, queued

- **Strict uniqueness mode** — explicit decision to NOT ship; warn-but-allow is the locked semantic.
- **Reverse-index** (instance → gap ids) — not needed because the picker scan is O(N gaps) and N is small in workshop sessions. Re-evaluate only if a workshop produces 10k+ gaps, which is not a realistic shape.
- **Roadmap aggregate de-overlap visualisation** — beyond the count fix, we don't currently visualise *which* assets are shared between projects. Could be a v2.3.x add-on if presales feedback asks for it.

---

## v2.2.1 · Phase 15.1 · LAN gating with HTTP Basic auth — IMPLEMENTED (2026-04-19)

**Goal**: make it safe to set `BIND_ADDR=0.0.0.0` for shared LAN review without exposing the unauth'd vLLM endpoints alongside the app. Manager and partner reviewers should hit a credential challenge before the canvas loads.

### Locked decisions

1. **Auth scheme — HTTP Basic via nginx `auth_basic`**. Cheap, browser-native, no app code changes. Acceptable inside a Dell internal network; this is *not* a public-internet hardening (no rate-limit, no MFA, no session token rotation) — those belong in the v3 multi-user platform.
2. **Trigger — env vars, not file mounts**. `AUTH_USERNAME` + `AUTH_PASSWORD` in compose env. Both set = auth on; either unset = auth off (preserves the v2.2.0 zero-config localhost path).
3. **Generator — `htpasswd` from apache2-utils**. Adds ~200KB to the image. Cleaner than rolling our own with `openssl passwd` (and `openssl` CLI isn't preinstalled in `nginx:1.27-alpine`).
4. **Hash — apr1 (MD5)** via `htpasswd -m`. Universally supported by `auth_basic`. Bcrypt would need extra build steps in alpine.
5. **Healthcheck exemption — `/health` overrides with `auth_basic off;`**. The container HEALTHCHECK and any external monitor stay credential-free.
6. **File ownership — `chown nginx:nginx 0640`** on the generated htpasswd. Required because nginx workers run as `nginx` user (not root) per upstream image config. Skipping this manifests as a 500 even with correct credentials, because the worker can't read the file.
7. **Failure mode — entrypoint exits non-zero** if `htpasswd` write fails. Better than silently serving with broken auth.

### What shipped

- `docker-entrypoint.d/40-setup-auth.sh` — POSIX-sh script invoked automatically by the upstream `nginx:alpine` entrypoint chain (any executable in `/docker-entrypoint.d/` runs before nginx). Reads env vars, generates the htpasswd + auth snippet, sets ownership, exits cleanly.
- `Dockerfile` — `apk add --no-cache apache2-utils`; COPY + chmod +x of the entrypoint script.
- `nginx.conf` — `include /etc/nginx/snippets/auth.conf;` at server scope (snippet is empty when no auth is configured); `auth_basic off;` inside `location = /health`.
- `docker-compose.yml` — declared `AUTH_USERNAME` + `AUTH_PASSWORD` env passthroughs (default empty); added inline header comment warning never to set `BIND_ADDR=0.0.0.0` without auth.
- `README.md` + `HOW_TO_RUN.md` — LAN-with-auth quick-start command; troubleshooting rows for the two common misconfig modes (forgot to rebuild after env change; only one env var set).

### Test (manual, local on Windows host with Docker Desktop 29.4.0)

| Mode | Curl | Expected | Got |
|---|---|---|---|
| No env vars | `/` | 200, no challenge | ✅ |
| No env vars | `/health` | 200 "ok" | ✅ |
| Auth on | `/health` | 200 "ok" (no creds) | ✅ |
| Auth on | `/` no creds | 401 + WWW-Authenticate | ✅ |
| Auth on | `/` wrong creds | 401 | ✅ |
| Auth on | `/` right creds | 200 + full headers | ✅ |
| Auth on | `/app.js` no creds | 401 | ✅ |
| Auth on | `/app.js` right creds | 200 + `application/javascript` | ✅ |
| Both modes | HEALTHCHECK | `(healthy)` within 30s | ✅ |

Browser verification: native auth prompt → enter creds → green banner (348/348) inside the app.

### Bugs caught + fixed in flight

1. **Initial implementation used `openssl passwd`** — `openssl` CLI not in `nginx:alpine`. Switched to `htpasswd` from `apache2-utils`.
2. **Initial chmod left htpasswd as `root:root 0640`** — nginx workers (user `nginx`) couldn't read it, so correct creds returned 500. Added `chown nginx:nginx`.

Both caught by the local smoke-test loop before any push to origin (per the test-before-push rule established 2026-04-19).

### Out of scope

- **Per-reviewer credentials** — current shape is a single shared user/password. Multi-user RBAC is v3 work.
- **Credential rotation UX** — today is "down + new env vars + up". Acceptable for the v2.2.x review window; a settings UI is a v3 multi-user concern.
- **TLS termination** — Basic auth credentials cross the wire base64-encoded, not encrypted. For internal Dell network use that's acceptable; for any external exposure, terminate TLS at a reverse proxy in front (Cloudflare, nginx-with-Let's-Encrypt, etc.). v3 will include this.

---

## v2.2.0 · Phase 15 · Docker for Dell GB10 — IMPLEMENTED (2026-04-19)

**Goal**: shippable container image so the app can be served from a Dell GB10 (NVIDIA Grace, ARM64) for shared internal review, without changing the frontend.

### Locked decisions

Captured from the morning Q&A; binding for the v2.2.x series:

1. **OS** — Linux (the GB10 is ARM/Grace; nginx:alpine ships multi-arch including linux/arm64, no `--platform` needed).
2. **Runtime** — Docker. The Dockerfile + compose file are OCI-standard. Pivoting to Podman later is `podman-compose up` with the same files; Kubernetes would require a manifest/Helm chart but the image itself is portable. **No lock-in.**
3. **Reachability** — localhost-only by default (`BIND_ADDR=127.0.0.1`), opt-in LAN exposure via `BIND_ADDR=0.0.0.0`. **LAN gating (auth_basic shim) deferred to Phase 15.1 / v2.2.1** — until that lands, never bind to 0.0.0.0 on a network where the LLM endpoints are reachable.
4. **Persistence** — none server-side. Image is stateless; reviewer sessions stay in their own browser localStorage. Shared-DB persistence belongs to v3 (Phase 20+ multi-user platform).
5. **AI endpoint** — out of scope for Phase 15. The vLLM containers on the GB10 (Code LLM on :8000, VLM on :8001 per the *LLMs on GB10* doc) will be addressed in Phase 19 via `services/aiService.js` reading `baseUrl` from localStorage / a future settings UI.
6. **Concurrency** — nginx serves static files concurrently out of the box. No app-side work. MVP single-reviewer assumption is automatically satisfied; multi-reviewer falls out for free.
7. **Host port** — **8080** by default, because the GB10 already binds **:8000** (Code LLM) and **:8001** (VLM). Configurable via `HOST_PORT` env var (`HOST_PORT=8888 docker compose up`).

### What shipped

- `Dockerfile` — `nginx:1.27-alpine` base; explicit COPY whitelist of source folders (avoids dragging in `.git`, docs, the OneDrive brace-expansion junk folder, host-only `start.sh`/`start.bat`); built-in `HEALTHCHECK` polling `/health`.
- `nginx.conf` — explicit MIME map (default alpine list lacks `.mjs` and `.avif`); `/health` endpoint returning `ok`; cache-busts `index.html`, 5-min cache for everything else; gzip for text payloads; `.dotfile` deny rule; security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` zeroing camera/mic/geo); CSP allow-list scoped to Google Fonts + `i.dell.com` (logo fallback) only.
- `docker-compose.yml` — single service `dell-discovery-canvas`, `restart: unless-stopped`, port mapping `${BIND_ADDR:-127.0.0.1}:${HOST_PORT:-8080}:80`, healthcheck wired to `/health`.
- `.dockerignore` — keeps the build context lean.
- `README.md` + `HOW_TO_RUN.md` — Docker quick-start sections; troubleshooting rows for port collisions and stale browser cache after rebuild.

### Test (manual on GB10)

1. Clone, `cd`, `docker compose up -d --build`.
2. `curl http://localhost:8080/health` → `ok`.
3. Browser to `http://localhost:8080`; logo loads from `/Logo/...avif` (no fallback); test banner reports green for all 22 suites.
4. `BIND_ADDR=0.0.0.0 docker compose up -d` exposes the service on the LAN at `<host-IP>:8080`.
5. `docker compose down` shuts cleanly.

### Out of scope (queued)

- **Phase 15.1 / v2.2.1** — LAN gating: nginx `auth_basic` block + hashed password file mounted via compose secret, so we can flip `BIND_ADDR=0.0.0.0` safely.
- **Phase 15.2 / v2.2.2** — Dell-styling token adoption from the GPLC reference HTML (palette tokens, Inter font, card vocabulary). Distinct PR so visual-regression review is bisectable from the Docker plumbing.
- **Phase 19 / v2.4.0** — AI endpoint settings page + `services/aiService.js` for the GB10 Code LLM / VLM.

---

## Post-v2.1.2 · v2.2+ design review (2026-04-19)

Ten items raised in morning review. Triaged into near-term phases vs v3. Decisions captured here as living reference for any future session picking up this project.

### Item 1 · dropped (no longer relevant)

### Item 2 · Multi-user platform — DEFERRED to v3

**Scope**: user registration, login, per-presales data isolation, manager/director global-view role, analytics dashboards, container/AI-config management UI, WAF layer.

**Why v3, not v2.x**: requires a backend server, database, auth, RBAC — none of which exist in the current client-only localStorage model. Estimate 2–4 weeks focused work.

**Architecture direction for v3** (draft, not locked):
- Keep the existing browser app essentially unchanged — it remains AI-ready, JSON-serialisable, modular.
- Add a thin Node/Express or FastAPI server that exposes `/api/sessions/{id}` CRUD + `/api/users` + `/api/analytics` endpoints.
- Database: start with SQLite (single file, Docker volume), migrate to PostgreSQL if concurrency demands it.
- Auth: GitHub OAuth or email+password with bcrypt + JWT sessions.
- RBAC: roles `presales`, `manager`, `director`, `admin`. Managers see their team's sessions; directors see all.
- WAF: Cloudflare in front of the server (free tier covers OWASP Top 10). Alternatively NGINX + ModSecurity at the Docker ingress.
- Deployment: Docker Compose → VPS / internal Dell infrastructure.

### Item 3 · Workload Mapping layer — LOCKED (Phase 16)

**Locked decisions**:
- Workload is a **6th layer** in `LAYERS` array (appears as its own row in the matrix).
- Cardinality: **N-to-N** — a workload maps to multiple asset instances; an asset can appear in multiple workloads.
- Criticality propagation: **upward only, on explicit confirm**. If a workload is High-criticality and a mapped asset is Low, a confirmation dialog prompts *"This will upgrade {asset} criticality from Low to High to match workload {W}. Proceed?"* — presales confirms, asset criticality gets upgraded. Downward: never auto-demote.
- UI: workload tile detail panel gets a `+ Map asset` button that opens a picker (scoped to the other 5 layers) to add mapped-asset references.
- Data model: workload instances carry `mappedAssetIds: string[]` — each entry is an instance id from any other layer.

### Item 4 · Taxonomy unification — APPROVED 2026-04-24 (user sign-off in hand)

**Proposed unified Action table** (Phase 17):

| Term | Meaning | Requires current link? | Requires desired link? |
|---|---|---|---|
| Keep | No change | Yes | No |
| Enhance | Upgrade in place | Yes (one) | Optional |
| Replace | One-for-one swap | Yes (one) | Yes (one) |
| Consolidate | Many-to-one merge | Yes (2+) | Yes (one) |
| Retire | Decommission, no replacement | Yes (one) | No |
| Introduce | Net-new capability | No | Yes (one) |
| Operational | Process/ops change | Optional | Optional |

**Proposed changes**:
- Rename UI label "Disposition" → **"Action"** everywhere. JSON field name may stay `disposition` for back-compat, or migrate to `action` at refactor time.
- Drop `rationalize` gap type (rationalization is a business outcome, not a technical action).
- Enforce mandatory linking at create-time for Replace and Consolidate (symmetric with existing unlink throw rule).
- `ACTION_TO_GAP_TYPE` map consolidates to 7 entries matching the table.

**APPROVED 2026-04-24** — table locked as-is. Refactor lands in v2.4.8 (see release re-sequence at top of file).

### Item 5 · merged into Item 4

### Item 6 · AI auto-drafted gaps — DEFERRED to v2.4 or later

Dependent on Item 7 infrastructure (AI API client). Concept: AI reads current + desired + sales-play catalog → suggests gap props that flow into `createGap(session, { ...props, reviewed: false })`. Out of scope for near-term phases.

### Item 7 · AI integration — slice for Phase 19, larger waves later

**Phase 19 target** (one concrete entry point): **Tab 1 strategic-driver question assistant**.
- Presales clicks a driver → button "Suggest discovery questions".
- App calls `aiService.suggestQuestions(driver, customer)` which hits user's manager's deployed AI modules (OpenAI-compatible endpoint per user note).
- Returns 3 tailored discovery questions; presales picks one, appends to notes or conversation starter.

**Required infrastructure**:
- `services/aiService.js` wrapper — configurable endpoint URL + auth, OpenAI-compatible protocol (`chat.completions.create`).
- Endpoint configuration — Phase 19 stores in localStorage or env; migrates to the v3 settings UI later.
- User-provided AI modules document — NOT YET RECEIVED; user will upload.

**Future AI waves (v2.4+)**:
- Criticality suggestions from current-tile label + notes.
- Gap description summarisation.
- Roadmap executive summary via Claude / GPT.
- Voice-to-text note capture on mobile (Phase 20+).

### Item 8 · Linked assets always visible — PENDING confirm, small (Phase 18)

Reverse Phase 12's `Manage links` collapse. In gap detail panel, render current + desired linked-instance lists inline, always expanded. `+ Link current instance` and `+ Link desired instance` buttons stay. Remove the chain+chevron collapse control.

Awaiting explicit "ship" confirmation from user.

### Item 9 · One-to-one asset→gap link — LOCKED (Phase 18)

**Locked decisions**: **warn-but-allow**, not strict enforcement.
- Link picker checks all gaps for existing link to the same instance.
- If already linked: show yellow warning row *"⚠ {asset} is already linked to Gap '{description}'. Linking here too will count toward both initiatives."* — user can still proceed.
- Asset tiles in gap detail show a red "multi-linked" chip if linked to 2+ gaps (visibility aid).
- Roadmap aggregation (existing `buildProjects`) may need a dedup pass for multi-linked assets — design call when we get there.

No strict uniqueness constraint. No reverse index needed.

### Item 10 · Cascade delete on gap deletion — ALREADY SAFE

Current model: `gap.relatedCurrentInstanceIds[]` and `gap.relatedDesiredInstanceIds[]` live on the gap only. Deleting the gap removes those arrays automatically. Instances don't carry back-references. No cascade logic needed.

**Action**: add a regression test in Phase 17 or Phase 18 when we touch `gapsCommands.js` — assert "deleting a gap leaves its previously-linked instances intact and available for re-linking".

**Future risk**: if we ever add a reverse index (instance → gap id) for performance, we'd need explicit sync logic. With the warn-but-allow pattern (Item 9), we avoid needing that index at all — link-picker scans existing gaps each open (O(N), fine for N ≤ thousands).

---

## Phase roadmap (post-v2.1.2)

Resuming numbering from where we stopped. Tagged releases: `v2.1.1`, `v2.1.2` on GitHub.

| Phase | Scope | Tag on completion | Dependencies |
|---|---|---|---|
| **15** | Docker containerisation for Dell GB10 deployment | `v2.2.0` ✅ SHIPPED | — (decisions captured 2026-04-19) |
| **15.1** | LAN gating: env-driven HTTP Basic auth via apache2-utils + nginx snippet | `v2.2.1` ✅ SHIPPED | — (env-driven; no host-side setup needed) |
| **15.2** | Dell-styling token adoption (palette + Inter typography; conservative token-only swap) | `v2.2.2` ✅ SHIPPED | — |
| **18** | Linked assets always visible (Item 8) + warn-but-allow double-link (Item 9) + cascade-delete regression test (Item 10) + roadmap dedup | `v2.3.0` ✅ SHIPPED | — (Item 8 ship-confirmed 2026-04-19 evening) |
| **16** | Workload Mapping 6th layer (Item 3) — N-to-N, upward propagation on explicit confirm | `v2.3.1` ✅ SHIPPED | — |
| **17** | Taxonomy unification + "Action" rename + mandatory-link enforcement for Replace/Consolidate (Item 4) | `v2.3.x` | User sign-off on Item 4 table |
| **19a** | AI foundations — 3-provider client (local vLLM / Anthropic / Gemini) + settings modal + demo skill on Tab 1 | `v2.4.0` ✅ SHIPPED | — |
| **19b** | Skill builder UI — admin list + add/edit form + per-tab dropdown + seeded skill | `v2.4.1` ✅ SHIPPED | — |
| **19c** | Field-pointer mechanic + LLM coercion + test button | `v2.4.2` ✅ SHIPPED | — |
| **19c.1** | Pill-based editor + error-message polish | `v2.4.2.1` ✅ SHIPPED | — |
| **19d.1** | Prompt guards (text-brief footer) + Refine-to-CARE + test-before-save gate | `v2.4.3` ✅ SHIPPED | — |
| **19d** | Unified AI platform (SPEC §12) — responseFormat + applyPolicy + writable resolvers + undo + per-skill provider | `v2.4.4` ✅ SHIPPED with known issues | — |
| **19e** | Foundations Refresh — bug-fixes + demo module + seed skill library + integration tests + persistent undo | `v2.4.5` | 19d |
| **19f** | Action-command skills (structured session manipulations) | `v2.4.6+` | 19e |
| **20+** | Multi-user platform (Item 2) — separate v3 work | `v3.0.0-alpha` (new branch `v3-multiuser`) | Architecture design doc, backend stack decision, auth strategy |

Items 5, 6 merged into later phases. Item 10 has no standalone phase (covered by Phase 18 test).

---

## Open decisions still needed from user (as of 2026-04-19 afternoon)

1. ~~**Phase 15 Docker target specifics**~~ — ✅ resolved 2026-04-19; see v2.2.0 entry above.
2. **Item 4 taxonomy table**: thumbs-up or edits to the 7-term Action table above.
3. **Item 8 ship confirmation**: "yes ship always-visible linked assets in Phase 18".
4. ~~**AI modules document**~~ — ✅ received 2026-04-19; `LLMs on GB10.docx`. Endpoints, model names, and OpenAI-compatible client examples captured for Phase 19 design.

Items 2 + 3 still block Phases 17 + 18. Phases 15.1 / 15.2 / 16 / 19 can execute now.
