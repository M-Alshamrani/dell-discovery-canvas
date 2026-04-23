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

### Item 4 · Taxonomy unification — PROPOSED, pending explicit user sign-off

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

**Pending user confirmation** before refactor starts.

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
| **15.2** | Dell-styling token adoption (palette, Inter, card vocabulary from GPLC sample) | `v2.2.2` | None |
| **16** | Workload Mapping 6th layer (Item 3) | `v2.3.0` | None |
| **17** | Taxonomy unification + "Action" rename + mandatory-link enforcement for Replace/Consolidate (Item 4) | `v2.3.1` | User sign-off on Item 4 table |
| **18** | Linked assets always visible (Item 8) + warn-but-allow double-link (Item 9) + cascade-delete regression test (Item 10) | `v2.3.2` | User confirms Item 8 |
| **19** | AI slice — Tab 1 strategic-driver question assistant (Item 7 first wave). LLM target: GB10 Code LLM on `:8000` (`model=code-llm`), VLM on `:8001` (`model=vision-vlm`), OpenAI-compatible | `v2.4.0` | None — LLM endpoint shape now known |
| **20+** | Multi-user platform (Item 2) — separate v3 work | `v3.0.0-alpha` (new branch `v3-multiuser`) | Architecture design doc, backend stack decision, auth strategy |

Items 5, 6 merged into later phases. Item 10 has no standalone phase (covered by Phase 18 test).

---

## Open decisions still needed from user (as of 2026-04-19 afternoon)

1. ~~**Phase 15 Docker target specifics**~~ — ✅ resolved 2026-04-19; see v2.2.0 entry above.
2. **Item 4 taxonomy table**: thumbs-up or edits to the 7-term Action table above.
3. **Item 8 ship confirmation**: "yes ship always-visible linked assets in Phase 18".
4. ~~**AI modules document**~~ — ✅ received 2026-04-19; `LLMs on GB10.docx`. Endpoints, model names, and OpenAI-compatible client examples captured for Phase 19 design.

Items 2 + 3 still block Phases 17 + 18. Phases 15.1 / 15.2 / 16 / 19 can execute now.
