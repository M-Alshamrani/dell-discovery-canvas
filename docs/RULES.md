# Rules-as-built · v2.4.15

The complete inventory of every rule the app enforces today, extracted from
the source so we can read it in one place and decide what's right, what's
wrong, and what's missing. v2.4.11 incorporated the rules-hardening pass
that came out of this audit; v2.4.16 refreshed this doc to v2.4.15 baseline +
added §13 Per-gapType Disposition Rules + §14 Asset Lifecycle by Action.
Italics flag historical changes; inline `(vX.Y.Z · Tag)` notes mark
release-by-release additions.

Every rule is tagged:
- 🔴 **HARD** — throws on violation; the action is blocked.
- 🟡 **SOFT** — emits a warning or chip; action proceeds.
- 🔵 **AUTO** — silent automatic behavior the user doesn't see.
- 📦 **MIGRATE** — one-shot fix on session load; idempotent.

And by **trigger** — when in the user's flow the rule fires.

**Companion docs**: `docs/TAXONOMY.md` (entity-and-relationships-first view;
this doc is rules-first, so cross-references go both ways).

---

## Changes since v2.4.11 (rule additions per release)

### v2.4.12 (services scope · 2026-04-26)
- §1.2 G-rules: **G13** `gap.services` is an optional array of `SERVICE_IDS` (10-entry catalog from `core/services.js`). Empty array valid. Unknown ids rejected. (HARD)
- §5 L-rules: **L8** `linkDesiredInstance(...)` requires `{ acknowledged: true }` when `confirmPhaseOnLink` returns conflict; otherwise throws `PHASE_CONFLICT_NEEDS_ACK`. Closes the v2.4.10 footgun. (HARD)
- §3 AD-rules: **AD8** ops gap auto-draft pre-fills `notes` with workshop-friendly template.
- §11 UI-surfaces table: services chip row + side-panel row + (SHORT-LIVED) services-scope sub-tab — sub-tab DROPPED in v2.4.13 §0.

### v2.4.13 (intermediate UX patches · 2026-04-27)
- Reporting "Services scope" sub-tab REMOVED (services info already on gap + project drawers; sub-tab adds navigation step without value).
- App-version chip moved from header → footer mono-caps capsule (top bar reserved for functional/interactive elements).
- NEW global "AI Assist" top-right button replaces per-driver `useAiButton` mounting.
- NEW `ui/components/Overlay.js` (centered modal, backdrop blur, sticky head + scrollable body + sticky footer; backdrop / Escape / X all close).
- NEW `ui/components/AiAssistOverlay.js` (tile-grid skill picker + prompt preview + in-place result panel).
- Demo banner renders on all 5 tabs + each Reporting sub-tab when `session.isDemo === true` (was Tab 1 only).
- Stepper restyle: `01 02 03 04 05` mono leading-zero with active step indicator.
- Layer-name visual treatment in MatrixView: 14px ink 600 + 4×100% color-coded left bar per layer (signal palette).

### v2.4.14 (hygiene + filter + Lucide · 2026-04-27)
- 10 obsolete Suite 44 RED tests deleted (drawer module + per-entity AI mount + tag-primitive migration parked).
- Heading case sweep: Title Case → sentence case (Strategic Drivers retained as customer brand convention).
- Brand-alias sweep: 147 mechanical replacements `var(--brand)` → `var(--dell-blue)`.
- Gap-card domain hue bars: `pickGapDomain` helper + 2px muted-hue `::before` on `.gap-card[data-domain]`.
- `.metric` class for tabular-nums utility on count surfaces.
- Cmd+K / Ctrl+K shortcut for AI Assist.
- Browser tab title unsaved indicator (`• Dell Discovery Canvas` while saving).
- **Environment aliases** (`session.environmentAliases`) + `getEnvLabel(envId, session)` helper. **SUPERSEDED by v2.4.15 dynamic env model**; `environmentAliases` drained by v2.4.15 migrator into per-env `alias` field.
- **Filter system v1** (F1-F6 services-only chip strip on Tab 4). **SUPERSEDED by v2.4.15 FilterBar (FB1-FB7)** which generalizes to all 4 dims.
- Lucide SVG icon migration: undo / undoAll / refresh / download / upload / plus / trash / x footer + index.html chips.

### v2.4.15 (dynamic envs + UX polish · 2026-04-28 → 2026-04-29 ship)
- §1.2 / §10 — **Dynamic environment model (DE1-DE9)**: `ENV_CATALOG` 8-entry catalog. `session.environments[]` schema with per-env metadata (`alias`, `location`, `sizeKw`, `sqm`, `tier`, `notes`). `getActiveEnvironments(session)` / `getVisibleEnvironments(session)` / `getHiddenEnvironments(session)`. Migrator drains v2.4.14 `environmentAliases`.
- §10 — **Soft-delete (SD1-SD9)**: `session.environments[].hidden: bool`. Hide flow modal + ≥1-active invariant. Hidden envs DROP from Tab 2/3 (iter-2 E1) and Tab 5 reporting (SD5).
- §11 UI-surfaces — **Vendor mix segmented bar** (VB1-VB3) replaced multi-card view; **iter-3** Option A KPI tiles (Dell density / Most diverse layer / Top non-Dell concentration) replaced per-layer + per-env standing cards.
- §11 UI-surfaces — **Modern collapsible FilterBar** (FB1-FB7) with all 4 dimensions (layer, services, gap type, urgency); **iter-3** Gaps filters consolidated into FilterBar; **iter-4** multi-select dim values (Array<string>).
- §11 UI-surfaces — Session capsule polish (SC1-SC2: building-2 icon + "Updated HH:MM"). Footer alignment (FT1: right-align hint with `|` divider). Matrix tweaks (MT1-MT3: 3px column gap + invisible corner + play-circle icon).
- §11 UI-surfaces — GPLC `.tag[data-t]` primitive (A1) with `data-t="biz|app|data|tech|sec|ops|env|urg"`.
- §11 UI-surfaces — `.btn-with-feedback` button-feedback contract (idle/pressed/loading/success/error with shake animation).
- §11 UI-surfaces — **Notify.js** (`confirmAction` / `notifyError` / `notifyInfo` / `notifySuccess`) replaces 13 native `confirm()` / `alert()` sites.
- §11 UI-surfaces — **AI Assist capsule-morph**: pick-mode shrinks overlay to top-right pill with heartbeat. Esc restores.
- §11 UI-surfaces — Single-site preset chip + typed env detail fields (Capacity stepper / Floor stepper / Tier datalist).

---

## 1 · Data shape (`core/models.js`)

### 1.1 · `validateInstance` — `core/models.js:19`

| # | Rule | Tier | When it fires |
|---|---|---|---|
| I1 | Instance must be an object | 🔴 HARD | every `addInstance` / `updateInstance` |
| I2 | `instance.id` is a non-empty string | 🔴 HARD | same |
| I3 | `instance.state` ∈ `{"current","desired"}` | 🔴 HARD | same |
| I4 | `instance.layerId` ∈ the 6 LAYERS | 🔴 HARD | same |
| I5 | `instance.environmentId` ∈ the 4 ENVIRONMENTS | 🔴 HARD | same |
| I6 | `instance.label` is a non-empty string | 🔴 HARD | same |
| I7 | `instance.vendorGroup` (if set) ∈ `{"dell","nonDell","custom"}` | 🔴 HARD | same |
| I8 | `instance.mappedAssetIds` (if set) is an array of non-empty strings | 🔴 HARD | same |
| I9 | `instance.mappedAssetIds` is **only valid on workload-layer instances** | 🔴 HARD | same |
| I10 | `instance.originId`, `instance.disposition` — free-form, **no validation** | 🟡 SOFT | n/a |

### 1.2 · `validateGap` — `core/models.js:42`

| # | Rule | Tier | When it fires |
|---|---|---|---|
| G1 | Gap must be an object | 🔴 HARD | every `createGap` / `updateGap` / link / unlink |
| G2 | `gap.id` is a non-empty string | 🔴 HARD | same |
| G3 | `gap.description` is a non-empty trimmed string | 🔴 HARD | same |
| G4 | `gap.layerId` ∈ the 6 LAYERS | 🔴 HARD | same |
| G5 | Every entry in `gap.affectedLayers` ∈ LAYERS | 🔴 HARD | same |
| G6 | **`gap.affectedLayers[0] === gap.layerId`** when affectedLayers is non-empty (primary-layer invariant, v2.4.9) | 🔴 HARD | same |
| G7 | Every entry in `gap.affectedEnvironments` ∈ ENVIRONMENTS | 🔴 HARD | same |
| G8 | `gap.urgency` ∈ `{"High","Medium","Low"}` (defaults to "Medium" if absent) | 🔴 HARD | same |
| G9 | `gap.phase` ∈ `{"now","next","later"}` (defaults to "now" if absent) | 🔴 HARD | same |
| G10 | `gap.gapType` (if set) ∈ taxonomy GAP_TYPES (`enhance,replace,introduce,consolidate,ops`) | 🔴 HARD | same |
| G11 | `gap.status` (if set) ∈ `{"open","in_progress","closed","deferred"}` | 🔴 HARD | same |
| G12 | `relatedCurrentInstanceIds` / `relatedDesiredInstanceIds` link rules — **NOT** validated at this layer (soft only; see §3 for the strict version) | 🟡 SOFT | n/a |

---

## 2 · Action taxonomy (`core/taxonomy.js`)

The 7-term Action table (Phase 17, user-signed-off 2026-04-24).

| Action id | Label | gapType | linksCurrent | linksDesired |
|---|---|---|---|---|
| `keep` | Keep | `null` (no gap) | 1 | 0 |
| `enhance` | Enhance | `enhance` | 1 | optional |
| `replace` | Replace | `replace` | 1 | 1 |
| `consolidate` | Consolidate | `consolidate` | 2+ | 1 |
| `retire` | Retire | `ops` | 1 | 0 |
| `introduce` | Introduce | `introduce` | 0 | 1 |
| `ops` | Operational | `ops` | optional | optional |

Notes baked into the resolution logic:

| # | Rule | Tier | When it fires |
|---|---|---|---|
| T1 | If two Actions share a `gapType` (e.g. `keep` + `retire` + `ops` all map to `ops`/`null`), the `validateActionLinks` check **silently skips** because we can't pick a single rule | 🟡 SOFT | every `createGap` / `updateGap` of a reviewed gap |
| T2 | Action `keep` produces `gapType: null` → no auto-drafted gap | 🔵 AUTO | `buildGapFromDisposition` |

### 2.1 · `validateActionLinks(gap)` — fires from createGap + updateGap

| # | Rule | Tier | When it fires |
|---|---|---|---|
| AL1 | Reviewed-gap-only enforcement: if `gap.reviewed === false`, skip ALL action-link rules (mid-workflow auto-drafts get a free pass) | 🔵 AUTO | every `createGap` / `updateGap` |
| AL2 | Replace gap: requires exactly 1 current AND exactly 1 desired link | 🔴 HARD | reviewed gaps only |
| AL3 | Enhance gap: requires exactly 1 current; desired is optional | 🔴 HARD | reviewed gaps only |
| AL4 | Consolidate gap: requires 2+ current AND exactly 1 desired | 🔴 HARD | reviewed gaps only |
| AL5 | Introduce gap: requires 0 current AND exactly 1 desired (this is the rule you saw fire when you tried to move from Now→Next) | 🔴 HARD | reviewed gaps only |
| AL6 | Ops gap: optional/optional link counts — never blocks on links alone | 🟡 SOFT | n/a |
| AL7 | *(v2.4.11 · A9)* **Operational/Services substance rule**: a reviewed `ops` gap requires `relatedCurrentInstanceIds + relatedDesiredInstanceIds >= 1` OR `notes.trim() >= 10 chars`. Auto-drafts bypass per AL1. | 🔴 HARD | reviewed ops gaps |
| AL8 | *(v2.4.11 · F1)* All AL2–AL7 violations emit **workshop-friendly sentences**, not raw rule text (e.g. *"Replace needs the technology being replaced. Link a current-state tile to this gap."*) | 🔵 AUTO | n/a |
| AL9 | *(v2.4.11 · A1)* `updateGap` only re-runs `validateActionLinks` on STRUCTURAL patches (gapType / layerId / affectedLayers / affectedEnvironments / relatedCurrentInstanceIds / relatedDesiredInstanceIds) OR when caller explicitly sets `reviewed: true`. Metadata patches (urgencyOverride / notes / urgency / phase / status / driverId) skip link validation so users can save side notes on imperfect auto-drafts. | 🔵 AUTO | every `updateGap` |
| AL10 | *(v2.4.11 · A1)* `approveGap` always runs `validateActionLinks` (the explicit "I'm done" gate). Failure throws AND keeps `gap.reviewed: false`. | 🔴 HARD | every `approveGap` |

---

## 3 · Auto-draft (`interactions/desiredStateSync.js`)

When the user picks an Action on a desired-state tile, a gap may be auto-created via `buildGapFromDisposition` then `createGap`.

| # | Rule | Tier | When it fires |
|---|---|---|---|
| AD1 | `keep` action → no gap created (returns null) | 🔵 AUTO | user picks Action on a desired tile |
| AD2 | Other actions → gap is created with `reviewed: false` (surfaces the pulsing-dot needs-review chip on Tab 4) | 🔵 AUTO | same |
| AD3 | Auto-drafted gap's `description` = `{ActionLabel}: {sourceCurrentLabel} [{layerLabel}]` if a current source exists, else `{ActionLabel} {desiredLabel} [{layerLabel}]` | 🔵 AUTO | same |
| AD4 | Auto-drafted gap's `phase` = derived from `desiredInstance.priority` (Now→now / Next→next / Later→later) — defaults to `"next"` | 🔵 AUTO | same |
| AD5 | Auto-drafted gap's `urgency` = the linked current instance's `criticality` (mirror), or `"Medium"` if no source | 🔵 AUTO | same |
| AD6 | Auto-drafted `relatedCurrentInstanceIds` = `[sourceCurrentId]` if source exists, else `[]` | 🔵 AUTO | same |
| AD7 | Auto-drafted `relatedDesiredInstanceIds` = `[desiredId]` always | 🔵 AUTO | same |
| AD8 | Ops gap: `notes` pre-filled with `"Operational change: {description}"` | 🔵 AUTO | same |
| AD9 | Auto-drafts bypass action-link validation (per AL1) — useful for `consolidate` which only has 1 current at draft time and needs the user to add more | 🔵 AUTO | same |

---

## 4 · Propagation (`interactions/desiredStateSync.js`)

When the user mutates a desired tile, linked gaps should re-sync. When the user mutates a gap's phase, linked desired tiles should re-sync.

| # | Rule | Tier | When it fires |
|---|---|---|---|
| P1 | Changing a desired tile's `priority` (Now/Next/Later) → linked gaps' `phase` re-derives via `priorityToPhase` | 🔵 AUTO | `syncGapFromDesired` after editing a desired tile |
| P2 | Changing a desired tile's `disposition` to a non-keep action → linked gaps' `gapType` re-derives via `ACTION_TO_GAP_TYPE` | 🔵 AUTO | same |
| P3 | *(v2.4.11 · A2)* Changing a desired tile's `disposition` to `keep` → linked gaps move to `status: "closed"` with `closeReason: "auto: disposition changed to keep on {desiredLabel}"` and `closedAt` timestamp. **No longer destructive** — visible via Tab 4 "Show closed gaps" filter chip; reopen via the gap detail panel's "Reopen" button. | 🔴 HARD (visible) | same |
| P4 | When source current's `originId` exists → linked gaps' `urgency` re-derives from origin's `criticality`; otherwise reset to `"Medium"`. *(v2.4.11 · A6)* SKIPS gaps where `urgencyOverride === true`. | 🔵 AUTO | same |
| P5 | Moving a gap between phases (Tab 4 drag-drop) → every linked desired tile's `priority` re-syncs to match | 🔵 AUTO | `syncDesiredFromGap` after gap.phase change |
| P6 | Linking a desired tile to a gap whose phase doesn't match the tile's priority → returns `{status: "conflict", ...}` for the UI to raise a confirmation modal (warn-but-allow) | 🟡 SOFT | `confirmPhaseOnLink` before `linkDesiredInstance` |
| P7 | Mutating a current instance's `criticality` → every linked gap's `urgency` re-derives. *(v2.4.11 · A6)* SKIPS gaps where `urgencyOverride === true`. | 🔵 AUTO | `syncGapsFromCurrentCriticality` |

---

## 5 · Link / unlink safety nets (`interactions/gapsCommands.js`)

These are NARROWER than the action-link rules and fire on EVERY gap (reviewed or not).

| # | Rule | Tier | When it fires |
|---|---|---|---|
| L1 | Cannot unlink the LAST current instance from gaps whose `gapType` requires ≥1 current. *(v2.4.11 · A3)* Now derived from `taxonomy.requiresAtLeastOneCurrent(gapType)` instead of a hand-typed allowlist. Auto-includes `keep` and `retire` (both gapType: `null`/`ops` → require 1 current). | 🔴 HARD | `unlinkCurrentInstance` |
| L2 | Cannot unlink the LAST desired instance from gaps whose `gapType` requires ≥1 desired. *(v2.4.11 · A3)* Derived from `taxonomy.requiresAtLeastOneDesired(gapType)`. | 🔴 HARD | `unlinkDesiredInstance` |
| L8 | *(v2.4.11 · A4)* `linkDesiredInstance(session, gapId, instanceId, opts)` REFUSES the link with error code `PHASE_CONFLICT_NEEDS_ACK` when `confirmPhaseOnLink` returns conflict AND `opts.acknowledged !== true`. UI shows the confirm; on user OK, calls with `{ acknowledged: true }`. Eliminates the v2.4.10 footgun where a UI could forget the check and link silently. | 🔴 HARD | `linkDesiredInstance` |
| L3 | Linking adds the id only if absent (idempotent — no duplicates) | 🔵 AUTO | `linkCurrentInstance` / `linkDesiredInstance` |
| L4 | Linking or unlinking a gap → automatically marks `reviewed: true` (clears the pulsing dot) | 🔵 AUTO | all four link/unlink helpers |
| L5 | `setGapDriverId(driverId=null|""|undefined)` → deletes `gap.driverId` (gap falls back to suggestion) | 🔵 AUTO | UI driver picker |
| L6 | Any `setGapDriverId` call → marks `reviewed: true` | 🔵 AUTO | same |
| L7 | `approveGap` → ONLY flips `reviewed: true`; no other validation re-runs | 🔵 AUTO | UI Approve button |

---

## 6 · Workload mapping (`interactions/matrixCommands.js`)

Phase 16 N-to-N mapping between workload-layer instances and infrastructure instances.

| # | Rule | Tier | When it fires |
|---|---|---|---|
| W1 | A workload cannot map to itself | 🔴 HARD | `mapAsset` |
| W2 | The source instance must be on `workload` layer | 🔴 HARD | same |
| W3 | The target asset must NOT be on `workload` layer (workloads only map to infrastructure) | 🔴 HARD | same |
| W4 | State match: a `current` workload can only map `current` assets; `desired` only maps `desired` | 🔴 HARD | same |
| W5 | **Same-environment requirement**: a workload's mapped assets must run in the SAME environment as the workload (hybrid workloads require one workload tile per environment) | 🔴 HARD | same |
| W6 | `proposeCriticalityUpgrades` is **upward-only**: assets whose criticality already meets/exceeds the workload's are left alone; lower-criticality assets get a proposal | 🔵 AUTO | UI button on workload detail |

---

## 7 · Project bucketing (`services/roadmapService.js` + `interactions/gapsCommands.js`)

| # | Rule | Tier | When it fires |
|---|---|---|---|
| PR1 | `gap.projectId` is auto-derived as `{primaryEnv}::{layerId}::{gapType}` (default env=`crossCutting` if no `affectedEnvironments[0]`; default gapType="null" string) | 🔵 AUTO | `createGap` if no projectId provided; `updateGap` re-derives if layer/env/gapType changed |
| PR2 | `buildProjects` groups by `gap.projectId` if present; falls back to the same env::layer::gapType key for legacy gaps | 🔵 AUTO | every render of Tab 5.5 Roadmap |
| PR3 | A project's `urgency` = max urgency across constituent gaps | 🔵 AUTO | `buildProjects` |
| PR4 | A project's `phase` = mode (most common) of constituent gaps' phases; ties → earliest of (now, next, later) | 🔵 AUTO | `buildProjects` |
| PR5 | A project's `driverId` = mode of constituent gaps' `effectiveDriverId(gap)`; ties → first driver in session order | 🔵 AUTO | `buildProjects` |
| PR6 | A project's `dellSolutions` = labels of all linked desired instances with `vendorGroup === "dell"`, deduped | 🔵 AUTO | `buildProjects` via `effectiveDellSolutions` |
| PR7 | A project's `name` = `"{EnvLabel} — {LayerLabel} {ActionVerb}"` (e.g. "Core DC — Data Storage Modernization") | 🔵 AUTO | `buildProjects` |

---

## 8 · Driver-suggestion ladder (`services/programsService.js`)

When a gap has no explicit `driverId`, this 9-rule ladder runs in order to suggest one. A rule only "wins" if the proposed driver is in `session.customer.drivers[]` (no ghost programs).

| # | Rule | Tier | When it fires |
|---|---|---|---|
| D1 | `gap.layerId === "dataProtection"` → `cyber_resilience` | 🔵 AUTO | `suggestDriverId` (fallback when `gap.driverId` not set) |
| D2 | `mappedDellSolutions` text includes "cyber" → `cyber_resilience` | 🔵 AUTO | same |
| D3 | `gap.gapType === "ops"` → `ops_simplicity` | 🔵 AUTO | same |
| D4 | Touches `publicCloud` (directly or via linked instances) → `cloud_strategy` | 🔵 AUTO | same |
| D5 | `gap.gapType === "consolidate"` → `cost_optimization` | 🔵 AUTO | same |
| D6 | Replace on compute/storage/virtualization → `modernize_infra` | 🔵 AUTO | same |
| D7 | Introduce on infrastructure + AI/ML/GPU mention in description/notes → `ai_data` | 🔵 AUTO | same |
| D8 | Description/notes match `compliance|audit|nis2|gdpr|hipaa|pci` → `compliance_sovereignty` | 🔵 AUTO | same |
| D9 | Description/notes match `energy|carbon|sustainab|esg` → `sustainability` | 🔵 AUTO | same |
| D10 | Fallback → `null` (project lands in "Unassigned" swimlane on the Roadmap) | 🔵 AUTO | same |

`effectiveDriverId(gap, session)` = `gap.driverId` (explicit override) ?? `suggestDriverId(gap, session)`.

---

## 9 · Health metrics (`services/healthMetrics.js`)

| # | Rule | Tier | When it fires |
|---|---|---|---|
| H1 | Bucket `currentScore` = sum of (instance.criticality → High:2 / Medium:1 / Low:0.5) for current instances in that (layer, env) | 🔵 AUTO | every Heatmap render |
| H2 | Bucket `gapScore` = sum of (gap.urgency → High:3 / Medium:2 / Low:1) for gaps where `affectedLayers.includes(layerId)` AND (no env filter OR env in affectedEnvironments) | 🔵 AUTO | same |
| H3 | A gap with NO `affectedEnvironments` counts in EVERY environment column for its layer | 🔵 AUTO | same |
| H4 | `getHealthSummary` highRiskGaps count = gaps with `urgency === "High"` | 🔵 AUTO | Overview render |

---

## 10 · Migration (`state/sessionStore.js migrateLegacySession`)

Every load runs through this. Pure, idempotent, additive.

| # | Rule | Tier | When it fires |
|---|---|---|---|
| M1 | If `customer.drivers` missing AND legacy `customer.primaryDriver` present → derive a single driver via `LEGACY_DRIVER_LABEL_TO_ID`; preserve `businessOutcomes` as that driver's `outcomes` | 📦 MIGRATE | every page load + every `Open file` |
| M2 | Strip legacy `customer.primaryDriver` and root `businessOutcomes` after migration | 📦 MIGRATE | same |
| M3 | Default `gap.reviewed`: `false` if gap has linked desired instances (auto-drafted), `true` otherwise (manual) | 📦 MIGRATE | gap missing `reviewed` field |
| M4 | **Phase 17**: any `gap.gapType === "rationalize"` → coerce to `"ops"` (warns once via `console.warn`) | 📦 MIGRATE | same |
| M5 | **Phase 17**: any `instance.disposition === "rationalize"` → coerce to `"retire"` (warns once) | 📦 MIGRATE | same |
| M6 | **v2.4.9**: backfill primary-layer invariant — prepend `gap.layerId` to `affectedLayers`, dedupe | 📦 MIGRATE | every gap |
| M7 | **v2.4.9**: backfill `gap.projectId` via `deriveProjectId` if missing | 📦 MIGRATE | every gap |
| M8 | Default `sessionMeta` (with today's date / version "2.0") if missing | 📦 MIGRATE | sessions saved without sessionMeta |
| M9 | Generate `sessionId` if missing | 📦 MIGRATE | same |
| M10 | *(v2.4.11)* Default `gap.urgencyOverride: false` on every legacy gap. Idempotent. | 📦 MIGRATE | every gap |

---

## 11 · AI write-side (`core/bindingResolvers.js` + `interactions/aiCommands.js`)

| # | Rule | Tier | When it fires |
|---|---|---|---|
| A1 | An AI response value can only be applied to a path that is `session.*` OR has a registered `WRITE_RESOLVERS[path]` entry. Anything else → throws | 🔴 HARD | `applyProposal` / `applyAllProposals` |
| A2 | `session.*` paths apply via direct `setPathFromRoot` write | 🔵 AUTO | same |
| A3 | `context.*` paths apply via the registered resolver, which finds the target entity by id (from runtime context) and mutates in place | 🔵 AUTO | same |
| A4 | If the target entity (driver / instance / gap) cannot be found by id → resolver throws "X not found in session" → applyProposal rolls back the undo snapshot it just pushed and re-throws | 🔴 HARD | resolver execution |
| A5 | Every successful apply pushes ONE undo entry (one for `applyProposal`, one for the entire batch in `applyAllProposals`) | 🔵 AUTO | same |
| A6 | Every successful apply emits `session-changed` with `reason: "ai-apply"` so views re-render | 🔵 AUTO | same |
| A7 | `parseProposals` silently DROPS any AI-returned key not in the skill's `outputSchema` allowlist | 🟡 SOFT | response parsing |

---

## 12 · Cross-version invariants (SPEC §12.8)

These are the load-bearing properties the test suite asserts.

| # | Invariant | Enforced by |
|---|---|---|
| INV1 | Every saved skill round-trips through `normalizeSkill` exactly | Suite 26 SB1-SB8 |
| INV2 | Every path in a skill's `outputSchema` is `session.*` OR has a `WRITE_RESOLVERS` entry | Suite 32 DS9/DS10 |
| INV3 | No direct `session.*` mutation from any AI-adjacent code path outside `interactions/aiCommands.js` | code review (no automated check) |
| INV4 | Every apply pushes an undo snapshot before mutation | Suite 33 DS13/DS14 |
| INV5 | API keys never leave browser localStorage except via the nginx proxy to the upstream | code review + manual |
| INV6 | Every session-root mutation emits `session-changed` (ai-apply / ai-undo / session-reset / session-demo / session-replace) | Suite 35 DS16/DS17 |
| INV7 | Every seed skill's `outputSchema` path exists in `FIELD_MANIFEST[tab]` AND is `writable: true` | Suite 32 DS9 |
| INV8 | Two-surface rule: every data-model change ships demo + seed + demoSpec + DEMO_CHANGELOG entry in the same commit | code review (no automated check) |

---

## 13 · Per-gapType Disposition Rules · NEW v2.4.16

Mirror of `docs/TAXONOMY.md §4`. The canonical disposition table that drives `validateActionLinks` (`core/taxonomy.js:229`) for reviewed gaps + the auto-draft pipeline (`interactions/desiredStateSync.js`).

| Action id | Action label | gapType | currents required | desireds required | Rule id (this doc) |
|---|---|---|---|---|---|
| `keep` | Keep | (no gap; gapType: null) | 1 | 0 | T2 (no auto-draft) |
| `enhance` | Enhance | `enhance` | 1 (exact) | optional | AL3 |
| `replace` | Replace | `replace` | 1 (exact) | 1 (exact) | AL2 |
| `consolidate` | Consolidate | `consolidate` | 2+ (min) | 1 (exact) | AL4 |
| `retire` | Retire | `ops` | 1 (exact) | 0 | (subsumed by AL6/AL7; per T1 link rule skips when multiple actions share gapType) |
| `introduce` | Introduce | `introduce` | 0 (exact) | 1 (exact) | AL5 |
| `ops` | Operational/Services | `ops` | optional | optional | AL6 + AL7 (substance) |

### 13.1 · Validator coverage

| # | Rule | Tier | When it fires |
|---|---|---|---|
| TX13.1 | Replace gap requires exactly 1 current AND exactly 1 desired link | 🔴 HARD | reviewed gaps only (AL2) |
| TX13.2 | Enhance gap requires exactly 1 current; desired optional | 🔴 HARD | reviewed gaps only (AL3) |
| TX13.3 | Consolidate gap requires 2+ current AND exactly 1 desired | 🔴 HARD | reviewed gaps only (AL4) |
| TX13.4 | Introduce gap requires 0 current AND exactly 1 desired | 🔴 HARD | reviewed gaps only (AL5) |
| TX13.5 | Ops gap link counts are optional/optional (never blocks on links) | 🟡 SOFT | (AL6) |
| TX13.6 | Ops gap substance: at least 1 link OR ≥10 chars notes (after trim) | 🔴 HARD | reviewed ops gaps only (AL7) |
| TX13.7 | Auto-drafts (`reviewed: false`) bypass ALL action-link rules | 🔵 AUTO | every createGap / updateGap (AL1) |
| TX13.8 | Friendly error messages translate raw rule failures into workshop-readable sentences | 🔵 AUTO | (AL8) |
| TX13.9 | `updateGap` only re-runs `validateActionLinks` on STRUCTURAL patches; metadata patches (urgencyOverride / notes / urgency / phase / status / driverId) skip link validation | 🔵 AUTO | (AL9) |
| TX13.10 | `approveGap` always runs `validateActionLinks`; failure throws AND keeps `reviewed: false` | 🔴 HARD | (AL10) |

### 13.2 · Suggested services per gapType (v2.4.12)

OPT-IN — chips appear under "SUGGESTED" eyebrow but are NOT pre-selected.

| gapType | Suggested services |
|---|---|
| `replace` | migration, deployment |
| `consolidate` | migration, integration, knowledge_transfer |
| `introduce` | deployment, training |
| `enhance` | assessment |
| `ops` | runbook |
| (keep) | — (no gap) |

---

## 14 · Asset Lifecycle by Action · NEW v2.4.16

Mirror of `docs/TAXONOMY.md §5`. What happens to underlying assets in current and desired state when a gap of each type ships.

| Action | Current-state delta | Desired-state delta | Net asset count Δ | What the matrix shows post-transition |
|---|---|---|---|---|
| **Keep** | 1 stays | 0 added | 0 | Current tile persists; no desired tile |
| **Enhance** | 1 stays (same vendor) | 0 or 1 added (uplifted) | 0 | Current tile persists; desired tile (if present) carries `originId` to the same current |
| **Replace** | 1 retired (logical) | 1 added | 0 (1-for-1 swap) | Current tile renders as "to be retired"; desired tile carries `originId` to the retired current |
| **Consolidate** | N retired (logical) | 1 added | -(N-1) | N current tiles all carry `originId` references TO the same desired; desired tile is consolidation target |
| **Retire** | 1 retired | 0 added | -1 | Current tile renders as "to be retired" (no desired counterpart) |
| **Introduce** | 0 (untouched) | 1 added | +1 | No current tile; desired tile is greenfield |
| **Operational** | 0 (untouched) | 0 (untouched) | 0 | No tile delta; gap exists for operational tracking |

### 14.1 · `originId` semantics (RULES §14)

A desired instance MAY carry `originId: "<currentInstanceId>"` linking it to the current it replaces / consolidates / enhances. Used by:

| # | Rule | Tier | Where |
|---|---|---|---|
| TX14.1 | Auto-draft: `getCurrentSource(session, desired)` finds current source for gap description ("Replace PowerEdge → PowerStore [Compute]") | 🔵 AUTO | `interactions/desiredStateSync.js buildGapFromDisposition` |
| TX14.2 | Propagation P4: when source current's `originId` exists, propagate criticality → urgency on linked gaps | 🔵 AUTO | `services/desiredStateSync.js syncGapsFromCurrentCriticality` |
| TX14.3 | `originId` is NOT validated at `validateInstance` — free-form by design (no FK enforcement) | 🟡 SOFT | (intentional design choice) |
| TX14.4 | Migrator does NOT auto-rebuild broken `originId` references (no orphan check) | 🔵 AUTO | (current behavior) |

### 14.2 · Logical-retirement semantics (RULES §14)

Retired currents persist in `session.instances[]` for audit + reporting. The "retirement" is logical:

| # | Rule | Tier | Where |
|---|---|---|---|
| TX14.5 | A retire action does NOT delete the current instance. The instance stays; the gap (gapType: `ops`) signals retirement intent | 🔵 AUTO | `interactions/desiredStateSync.js` + Tab 4 |
| TX14.6 | A current's `disposition` field (when set) signals the action verb visually on the matrix tile | 🔵 AUTO | `MatrixView` |
| TX14.7 | Reporting (Tab 5) counts retire-marked currents in current-state metrics until they're physically removed (audit-friendly) | 🔵 AUTO | `services/healthMetrics.js` + `services/vendorMixService.js` |

### 14.3 · Visible-presentation hint (PARKED in spec; v2.4.17 implementation)

`docs/TAXONOMY.md §5.2 + §8.6` propose a small lifecycle indicator on each Tab 4 gap card driven by counts: `1 → 1` (replace), `2 → 1` (consolidate), `1 → ø` (retire), `ø → 1` (introduce). **Not implemented in v2.4.16**; intent captured in TAXONOMY.md so v2.4.17 polish pass implements rather than re-derives.

---

## 15 · v3.0 → v2.x consumption adapter (`state/v3Adapter.js`) · NEW v3.0.0-rc.1 (QUEUED 2026-05-01)

**Status**: SPEC §S19 + TESTS §T19 V-ADP-1..10 authored 2026-05-01; implementation queued. **Rules below are normative once Suite N V-ADP-1..10 lands GREEN.**

The adapter is the cutover boundary between the v2.x `state/sessionState.js` store and the v3.0 `state/v3EngagementStore.js`. View modules read engagement-derived data only through the adapter; writes go through `commitAction` wrappers that invoke §S4 action functions. The v3.0 Lab tab (Skill Builder, shipped at v3.0.0-beta) reads from `engagementStore` directly without going through `adaptXxxView`; it is its own surface, not part of the adapter migration window.

| # | Rule | Tier | When it fires |
|---|---|---|---|
| AD1 | View module imports `state/sessionState.js` after migration | 🔴 HARD | review-time (lint TO AUTHOR alongside SPEC §S5.3 F5.3.2) |
| AD2 | Adapter mutates engagement object directly (raw assignment / `Object.assign` / array push on engagement subtree) | 🔴 HARD | code review; all writes via `commitAction(actionFn, ...)` |
| AD3 | View module imports `selectors/v3.js` directly | 🔴 HARD | review-time; views go through `adaptXxxView` only |
| AD4 | Adapter caches per-view-shape outputs in its own cache | 🔴 HARD | code review (selectors §S5 already memoize on engagement-reference identity per Q2) |
| AD5 | `state/v3EngagementStore.js` exposes engagement object by deep reference for write | 🔴 HARD | engagement is read-only at the consumer; writes via `commitAction` only |
| AD6 | `adapt<View>View(eng)` is a pure function — same engagement reference → same output reference | 🔴 HARD | tested by V-ADP-1 |
| AD7 | Empty engagement (`createEmptyEngagement()`) renders all 6 view shapes without throwing | 🔴 HARD | tested by V-ADP-2 |
| AD8 | Adapter writes commit through §S4 action functions, never via raw object mutation | 🔴 HARD | tested by V-ADP-9 |
| AD9 | View migrations land in fixed order: Context → Architecture → Heatmap → Workload Mapping → Gaps → Reporting | 🔵 AUTO | sequenced commits per SPEC §S19.4; one commit + browser smoke per view |
| AD10 | The v3.0 Lab tab reads from `engagementStore` directly without going through `adaptXxxView` | 🔵 AUTO | shipped at v3.0.0-beta; the Lab is its own surface, not a v2.x view |
| AD11 | `.canvas` v3.0 file load drives `engagementStore.setActiveEngagement(loadCanvasV3(json).engagement)`; v2.x `.canvas` files run §S9 migrator first then same set | 🔴 HARD | every load (cross-ref §10 migration) |
| AD12 | While migration is in progress, the v2.x `state/sessionState.js` store and the v3.0 `state/v3EngagementStore.js` BOTH live in memory; co-existence ends when Reporting (Tab 6) lands; even then sessionState is NOT deleted (rollback anchor + v2.x AI admin still reads it per `project_v2x_admin_deferred.md`) | 🔵 AUTO | through v3.0.0 GA |

**Cross-references**: SPEC §S19 + TESTS §T19 V-ADP-1..10. Memory anchors: `feedback_spec_and_test_first.md` (this entire section is the spec-first artifact), `feedback_browser_smoke_required.md` (per-commit smoke between view migrations), `project_v2x_admin_deferred.md` (sessionState NOT deleted).

---

## 16 · Canvas Chat — context-aware AI assistant (`services/chatService.js` + friends) · NEW v3.0.0-rc.2 (QUEUED 2026-05-02)

**Status**: SPEC §S20 + TESTS §T20 V-CHAT-1..12 authored 2026-05-02; implementation queued. **Rules below are normative once Suite 51 V-CHAT-1..12 lands GREEN.**

The chat surface gives the user a conversational interface to the live engagement, with the full v3 data architecture (entities, FKs, invariants, manifest, analytical views) bound into the system prompt. The invariants in this section guard against the two failure modes the user explicitly called out: hallucination (data the model invents because we didn't ground it) and bloat (sending the entire dataset every turn instead of optimizing transmission).

| # | Rule | Tier | When it fires |
|---|---|---|---|
| CH1 | Chat layer module imports `state/sessionState.js` | 🔴 HARD | review-time + V-CHAT-9 enforcement |
| CH2 | Chat layer module imports any `state/collections/*Actions.js` (i.e. calls a §S4 action function from chat) | 🔴 HARD | read-only v1 boundary; V-CHAT-9 enforcement |
| CH3 | (REWRITTEN rc.6 per SPEC §S37) Layer 4 of the system prompt MUST be the output of the deterministic grounding router (`services/groundingRouter.js`) — selector results inlined per user message; metadata (customer + drivers + env aliases) always inlined; instances + gaps + dispositions detail comes ONLY from router-invoked selector results, never from a raw `JSON.stringify(engagement)` dump regardless of size. The legacy count-based small/large branch (`ENGAGEMENT_INLINE_THRESHOLD_INSTANCES = 20`, `_GAPS = 20`, `_DRIVERS = 5`) is REMOVED entirely. Token-budget guard at ~50K input tokens applied to router output per §S37.4; over-cap selectors degrade to TOC + tool fallback. Anti-pattern: any reintroduction of threshold constants or raw-engagement-dump in the prompt assembler violates this rule. | 🔴 HARD | tested by V-FLOW-GROUND-1..7 + V-ANTI-THRESHOLD-1 (V-CHAT-2 retired) |
| CH4 | `CHAT_TOOLS` entries diverge from §S5 selector signatures (each tool name MUST match a selector function name; each `invoke` MUST return what the selector returns directly) | 🔴 HARD | tested by V-CHAT-3 |
| CH5 | Transcript persisted with API keys, OAuth tokens, or any field tagged sensitive in `core/aiConfig.js` | 🔴 HARD | code review + lint of `state/chatMemory.js` |
| CH6 | "v3" prefix in any new chat-related module name | 🔴 HARD | per `feedback_no_version_prefix_in_names.md`; chat ships with canonical names from day one |
| CH7 | Streaming response handler swallows network errors silently | 🔴 HARD | failures MUST surface as a chat assistant message; existing `aiService.chatCompletion` retry logic still applies as the underlying transport |
| CH8 | Anthropic responses use `cache_control: {"type":"ephemeral"}` on the prefix block (layers 1+2+3+5-descriptions); other providers omit the marker | 🔵 AUTO | tested by V-CHAT-12 |
| CH9 | Chat session memory is keyed by `engagementId`; switching engagements (when v3.1 multi-engagement lands) yields a fresh transcript | 🔵 AUTO | localStorage key shape: `dell-canvas-chat::<engagementId>` |
| CH10 | Tool-call round-trip supports MULTI-ROUND chaining up to `MAX_TOOL_ROUNDS=5`. The chat service loops: stream → if `tool_use` is emitted, dispatch the named tool against the active engagement, append the assistant content blocks (preamble text + tool_use) and a user `tool_result` block to the running message list, stream the next round. Loop terminates when the model emits a text-only response (no `tool_use`) OR the safety cap is hit. On cap, the user-visible response includes a clear notice that chaining was terminated. Updated 2026-05-02 PM (was: 1-round only, v1 conservative — caused BUG-012: Q1/Q2 stuck on round-2 preamble) | 🔵 AUTO | tested by V-CHAT-5 (1-round) + V-CHAT-18 (N-round chain) |
| CH11 | Rolling-window summarization triggers when transcript exceeds CHAT_TRANSCRIPT_WINDOW (default 30 messages) OR CHAT_TRANSCRIPT_TOKEN_BUDGET (default ~12K tokens); older turns collapse into one synthetic `{role:"system", content:"PRIOR CONTEXT: <summary>"}` message | 🔵 AUTO | tested by V-CHAT-7 |
| CH12 | When the model emits a proposal (rename / re-classify / re-link), the chat surface renders an "Open in Tab N" affordance that switches tabs + pre-fills the input — but mutation happens through normal v2.x / v3.0 UI paths, NEVER from chat | 🔵 AUTO | code review; aligns with CH2 |
| CH13 | (RETIRED rc.7-arc-1 2026-05-06 per `feedback_no_mocks.md` LOCKED) — was: chat respects Mock\|Real provider toggle. The Mock toggle is REMOVED entirely; `core/aiConfig.js PROVIDERS` does not include "mock"; `services/chatService.js` no longer carries any "mock" provider-key branch. Replacement: real provider config (Anthropic / Gemini / Local A / Local B / dellSalesChat) only. | — | RETIRED |
| CH14 | (RETIRED rc.7-arc-1 2026-05-06 per `feedback_no_mocks.md` LOCKED) — was: chat layer imports mock provider from `services/mockChatProvider.js`. Both `services/mockChatProvider.js` and `services/mockLLMProvider.js` are DELETED in the same commit (along with `tests/mocks/*`). No mock provider modules exist post-rc.7-arc-1; importing one is structurally impossible. | — | RETIRED |
| CH15 | Every chat session sends the data contract (`getDataContract()`) in the system prompt. Layers 2 + 3 + 6 (data model + manifest + catalog metadata) collapse into ONE structured contract block. The role section instructs the LLM to trace every claim back to the contract; uncited claims are forbidden | 🔴 HARD | tested by V-CONTRACT-5 |
| CH16 | First-turn handshake: the role section instructs the LLM to start its FIRST response with `[contract-ack v3.0 sha=<8-char-checksum>]`. The chat overlay parses this, strips it from the rendered text, shows ✓ on match / ⚠ on mismatch (handshake-failed banner). Subsequent turns do not include the prefix | 🔴 HARD | tested by V-CONTRACT-6 + V-CONTRACT-7 |
| CH17 | Catalog refs in the engagement snapshot are wrapped `{id, label, description}` envelopes (not bare ids). The role section instructs the LLM to use the LABEL when speaking to the user, NOT the id (no `gap.driverId = "cyber_resilience"` in user prose; instead "the gap is rationalized by 'Cyber Resilience'") | 🔴 HARD | enforced by the system prompt + verified end-to-end by smoke |
| CH18 | Assistant message bubbles render their content via the vendored markdown library (`vendor/marked/marked.min.js`); user bubbles stay plain text (XSS / prompt-injection-as-render guard) | 🔴 HARD | tested by V-MD-1 |
| CH19 | Real-Anthropic provider supports tool-use round-trip: `services/realChatProvider.js` builds Anthropic-shape `tools` array from `CHAT_TOOLS`; `streamChat` orchestration handles the round-trip identically to the mock path | 🔵 AUTO | tested by V-CHAT-15 + manual real-Anthropic smoke |
| CH20 | Generic LLM connector — tool-use is wired for ALL three provider kinds (anthropic + openai-compatible + gemini) through wire-builder translation per SPEC §S26. `chatService` emits Anthropic-canonical content-block shape for round-trip; each `aiService.buildRequest('<kind>')` translates to native shape before fetch. Tools array translated per provider (anthropic: `{name,description,input_schema}`; openai-compatible: `{type:"function",function:{name,description,parameters}}` + `tool_choice:"auto"`; gemini: `{functionDeclarations:[...]}`). Tool-call extraction in `realChatProvider` dispatches by provider; emits the same `{kind:"tool_use",id,name,input}` event regardless. Closes BUG-018 (Gemini hangs) + unblocks any OpenAI-compat LLM (vLLM, local, Mistral, Groq, Together, Anyscale, Dell Sales Chat) | 🔵 AUTO | tested by V-CHAT-27..32 + V-CHAT-15 (Anthropic regression) + V-CHAT-18 (multi-round, provider-agnostic) |
| CH21 | Concept dictionary grounding — `core/conceptManifest.js` (62 entries, 13 categories per SPEC §S27) is the DEFINITIONAL layer that complements `core/dataContract.js`'s structural metadata. The system prompt INLINES only the TOC (`[<category>] <id> · <label> · <headline>`) on the cached prefix; full bodies are fetched on demand via the `selectConcept(id)` tool registered in `chatTools.js`. Role section instructs the LLM: when the user asks "what does X mean?" or "when should I use X vs Y?", favor the dictionary headline first, call selectConcept for depth. When `vsAlternatives` is needed, fetch BOTH concepts (multi-round per CH10). Token budget: TOC ≤ 3KB inline; full bodies ~150 tokens each (tool-fetched) | 🔵 AUTO | tested by V-CONCEPT-1..5 |
| CH22 | App workflow manifest grounding — `core/appManifest.js` (16 workflows, 19 recommendations, 5 tabs + 6 actions per SPEC §S28) is the PROCEDURAL layer. The system prompt INLINES the workflow TOC (`id · name · intent · app_surface`) + recommendations table (id · short-answer) + APP_SURFACES verbatim on the cached prefix; full workflow bodies (steps + relatedConcepts + typicalOutcome) are fetched on demand via the `selectWorkflow(id)` tool. Role section instructs the LLM: for "how do I..." questions, scan the workflow TOC + recommendations first; call selectWorkflow for the full step-by-step. For "where is X / what tab does Y" questions, point users at APP_SURFACES tab + action labels. Token budget: ~2.3KB inline; full bodies ~250 tokens each (tool-fetched) | 🔵 AUTO | tested by V-WORKFLOW-1..5 |
| CH23 | Skill architecture v3.1 (per SPEC §S29) — skills are PARAMETERIZED PROMPTS with explicit `outputTarget` ("chat-bubble" only in v3.1; "structured-card" / "reporting-panel" / "proposed-changes" deferred). DROPPED from v3.0: `skillType` (click-to-run / session-wide), `entityKind`, chip palette, click-to-run "Use AI" buttons. ADDED: `parameters[]` (zero or more user-supplied args at invocation), `outputTarget` enum, `outputSchema` slot. Existing v3.0 skills auto-migrate at load time per S29.3 (`skillType: "click-to-run" + entityKind: <X>` → `parameters: [{name:"entity",type:"string",description:"Pick a <X>"}]`). Skill Builder simplifies to name+description+prompt+parameters+outputTarget; lives as a slide-over in the chat right-rail. The Lab tab is RETIRED in Phase 5 | 🔵 AUTO | tested by V-SKILL-V3-1..7 (lands with rc.3 implementation) |
| CH24 | APP_VERSION discipline (per SPEC §S30) — `core/version.js` exports `APP_VERSION` as the single runtime-visible source of truth for what build is running. Lifecycle: at tag time the value equals the tag (no `-dev` suffix); the FIRST commit past a tag MUST bump APP_VERSION to add the `-dev` suffix (e.g., `3.0.0-rc.2` at tag → `3.0.0-rc.3-dev` on the next commit). Hard-coding the version string anywhere outside `core/version.js` is FORBIDDEN; the topbar version chip MUST import `APP_VERSION` and render it via `chip.textContent = "Canvas v" + APP_VERSION`. Pre-flight checklist (`docs/PREFLIGHT.md`) gates every tag — items 1 (APP_VERSION matches tag) + 5 (browser smoke verifies chip displays the same value) are tag-only; items 2-4 + 8 are per-arc | 🔴 HARD | tested by V-VERSION-1..2 + manual V-VERSION-3 (per PREFLIGHT.md item 5) |
| CH26 | Topbar single-AI-surface contract (per SPEC §S29.7) — the topbar carries EXACTLY ONE AI affordance: `#topbarAiBtn` ("AI Assist", sparkle icon, Dell-blue gradient + 8s diamond-glint + breathing-glow animation). The button click opens Canvas Chat (the unified chat surface with the right-rail saved-skill cards + "+ Author new skill" affordance). Skill Builder access lives inside Canvas Chat's right-rail (NOT a separate topbar button). Cmd+K / Ctrl+K opens the legacy AiAssistOverlay tile-grid for power users; that legacy surface is queued for retirement in rc.5 with the broader UX consolidation arc. Anti-pattern: any commit that re-adds `#topbarChatBtn` / `#topbarLabBtn` / a second AI affordance violates this rule. | 🔵 AUTO | tested by V-TOPBAR-1 + V-LAB-VIA-CHAT-RAIL + V-AI-ASSIST-CMD-K + VT23 (rewritten rc.3 #13) |
| CH27 | v3 engagement persistence + rehydrate-on-boot (per SPEC §S31) — `state/engagementStore.js` is the runtime source-of-truth for v3 collections (gaps / drivers / environments / instances). On every state change the store MUST persist the active engagement to `localStorage.v3_engagement_v1`; at module load it MUST rehydrate from that key, validating the rehydrated record through `EngagementSchema.safeParse(...)` and starting fresh on schema-invalid (corrupt-cache safety). The bridge's existing customer-shallow-merge keeps working unchanged: rehydrated engagement comes back, latest v2 customer patch applies on top, gaps/drivers/etc. survive across reload. `_resetForTests()` MUST also clear the persisted entry. Architectural fix for BUG-019 (page-reload race). | 🔴 HARD | tested by V-FLOW-REHYDRATE-1..3 (lands with rc.3 expanded scope) |
| CH28 | Canvas AI Assistant window-theme contract (per SPEC §S32) — the Canvas AI Assistant overlay's outer chrome (panel + header + right-rail + footer + backdrop) MUST match the app's GPLC-aligned light design language using the canonical token set (`--canvas` / `--canvas-soft` / `--rule` / `--ink` / `--dell-blue` / `--shadow-lg` / `--radius-lg`). The working area (transcript scroll + prompt input) MUST stay dark (`#0D1117` background) so the dark surface is the visible "AI working area" cue. User-facing strings rename "Canvas Chat" → "Canvas AI Assistant"; internal symbols (`openCanvasChat`, `.canvas-chat-*` CSS classes) MAY stay during this arc — symbol-rename pass deferred. The 6 token deltas in `styles.css :root` reconcile to GPLC values; existing surfaces stay on old token values during the migration window per R32.3, with each surface reconciling in its own arc. | 🔴 HARD | tested by V-THEME-1..8 (rc.4-dev Arc 1, GREEN at `5893e71`) |
| CH29 | Canvas AI Assistant header provider pills + footer breadcrumb + Cmd+K binding (per SPEC §S33, REVISED 2026-05-04) — the chat overlay's `head-extras` slot MUST render ONE `.canvas-chat-provider-pill` button (the active provider) + a sibling `.canvas-chat-provider-popover` listing every provider in `core/aiConfig.PROVIDERS` (mock excluded) as click-to-switch rows. Click handlers per row: inactive ready → switch via `saveAiConfig`; inactive needs-key OR active → open Settings modal. Head-extras chrome consistency: pill + Clear + Skills toggle ALL use one ghost-button family (`var(--canvas)` bg, `var(--rule-strong)` border, `var(--ink-soft)` text). The footer breadcrumb (`.canvas-chat-foot-lede`) MUST update on every assistant `onComplete` to display latest-turn provenance (`<provider> · <model> · <N> tokens · <ms>ms`) in JetBrains Mono uppercase; empty state renders empty content. The pre-revision footer Done button is RETIRED (X close in header is canonical). The Cmd+K / Ctrl+K shortcut (`wireAiAssistShortcut` in `app.js`) MUST call `openCanvasChat()`, NOT `openAiOverlay()`. The legacy AiAssistOverlay is FLAGGED for retirement in Arc 4. Architectural fix for BUG-025. | 🔴 HARD | tested by V-PILLS-1..4 + V-FOOTER-CRUMB-1 + V-CMD-K-CANVAS-1 (rc.4-dev Arc 2 + revision) |
| CH30 | Canvas AI Assistant conversational affordances (per SPEC §S34) — the chat overlay MUST surface live thinking-state cues during every assistant turn: a `.canvas-chat-typing-indicator` (3 animated dots) BEFORE the first streaming token; a `.canvas-chat-tool-status` pill (Dell-blue-soft fill + JetBrains Mono uppercase + human-readable per-tool message from the `TOOL_STATUS_MESSAGES` map) painted on each `onToolUse` callback; a `.canvas-chat-round-badge` painted on `onRoundStart` for round ≥ 2 (auto-fade 2s); a slide-in animation on the footer provenance breadcrumb after `onComplete`. The empty-state try-asking prompts MUST come from `services/tryAskingPrompts.js` `generateTryAskingPrompts(engagement)` returning exactly 4 strings from a 3-bucket mixer (1 how-to + 2 insight + 1 showoff), engagement-aware, deterministic per-overlay-open, falling back to the static `EXAMPLE_PROMPTS` set when the engagement is empty. `services/uuidScrubber.js` MUST also detect `workflow.<id>` + `concept.<id>` patterns and replace with manifest labels (or `[unknown workflow]` / `[unknown concept]` sentinels) per the same defense-in-depth shape as the UUID scrub; skips fenced + inline code. The role section MUST carry an explicit NEVER-emit directive on `workflow.*` / `concept.*` identifiers. Architectural fix for BUG-024. | 🔴 HARD | tested by V-THINK-1..5 + V-TRY-ASK-1..4 + V-SCRUB-WORKFLOW-1..3 (rc.4-dev Arc 3) |
| CH31 | Skill Builder consolidation under Settings (per SPEC §S35) — Settings → "Skills builder" pill (label neutral, NO version suffix anywhere in UI strings) is the SINGLE entry point for skill authoring. The pill renders the EVOLVED admin module at `ui/views/SkillBuilder.js` (NEW file replacing the lean v3.1 SkillBuilder.js at that path); the v2.4 `ui/views/SkillAdmin.js` is KEPT on disk as DORMANT (no longer mounted in Settings) for one release per `project_v2x_admin_deferred.md` so v2 test suites in §26 / §27 / §29 / §37 keep functioning until their parity rewrite (out of Arc 4 scope). The evolved admin keeps v2.4 SkillAdmin's UX base — list + deploy toggle + edit form + chip palette + Refine-to-CARE button + dual-textbox preview + Test button — and ADDS a `parameters[]` editor + an `outputTarget` radio (4 options; only `chat-bubble` enabled, the other 3 disabled with "deferred to GA" hint). All save/load/delete ops route through `state/v3SkillStore.js` (`saveV3Skill` / `loadV3Skills` / `loadV3SkillById` / `deleteV3Skill`). v2 store (`core/skillStore.js`) becomes READ-ONLY for one release; v2 records appear under a "Legacy (v2)" section with per-row "Migrate" button (opt-in, NOT auto). Migration runs through pure helper `migrateV2SkillToV31` in `schema/skill.js` (v2 fields `tab` / `applyPolicy` / `deployed` DROPPED with audit field `_droppedFromV2`; `responseFormat` → `outputContract`; `name` → `label`; `parameters[]` initialized empty; `outputTarget` initialized `chat-bubble`; `validatedAgainst` set `"3.1"`). `core/v3SeedSkills.js` is DELETED in this arc; the 3 v3 seed exports are removed and tests that referenced them get inline fixtures. The standalone v3.1 builder overlay path retires: `ui/skillBuilderOpener.js` becomes a thin shim that closes the chat overlay + opens Settings → Skills builder (no `#skillBuilderOverlay` div creation; `openSettingsModal({section:"skills"})` is the canonical redirect). The Canvas AI Assistant chat right-rail "+ Author new skill" affordance still works — it routes to Settings via the shim. | 🔴 HARD | tested by V-SKILL-V3-8..15 + V-ANTI-V3-IN-LABEL-1 + V-ANTI-V3-SEED-1..3 + V-ANTI-OVERLAY-RETIRED-1 + V-MIGRATE-V2-V3-1..4 (rc.4-dev Arc 4) |
| CH32 | UX consolidation arc — chat-persistent side-panel + AiAssistOverlay dormant + test-flash residual cloak + chat polish (per SPEC §S36, rc.5) — `ui/components/Overlay.js` learns a stack-aware `sidePanel: true` opt-in: when `openOverlay({ sidePanel: true })` is called while another overlay is open, the existing overlay shrinks to a 50vw left pane and the new layer renders as a 50vw right pane (single shared backdrop; click closes top-most layer only; ESC closes top-most layer only; closeOverlay pops top; if stack now has 1 layer it expands back to full-width centered). The `sidePanel` opt is INERT when the stack is empty (full-screen / centered as before). Drives the BUG-028 fix: `ui/skillBuilderOpener.js` shim + `ui/views/CanvasChatOverlay.js` needs-key provider pill click MUST pass `sidePanel: true` to `openSettingsModal()` when chat is currently open — the chat persists through the Settings open/close cycle with transcript + input draft preserved. `ui/views/AiAssistOverlay.js` retires fully: NO production .js file imports it; file stays on disk as DORMANT module per `project_v2x_admin_deferred.md` (matches the Arc 4 SkillAdmin.js pattern). `styles.css` `body[data-running-tests]` cloak extends to `body[data-running-tests] > *:not(#app-header):not(#stepper):not(#main):not(#app-footer):not(#test-banner):not(.overlay-backdrop)` (closes BUG-027 — rogue body-level test probes were flashing visibly during the pass). Chat polish residuals from BUG-022 land: Send button padding tightened to ≤ 14px horizontal; transcript bubble line-height tightened to ≤ 1.5. | 🔴 HARD | tested by V-OVERLAY-STACK-1..4 + V-FLOW-CHAT-PERSIST-1..3 + V-AI-ASSIST-DORMANT-1 + V-NO-VISIBLE-TEST-FLASH-1 + V-CHAT-POLISH-1..2 (rc.5 in §T37) |
| CH33 | Grounding contract recast — RAG-by-construction (per SPEC §S37, rc.6, AMENDED 2026-05-05 per `feedback_no_mocks.md`) — every fact-bearing chat turn is preceded by deterministic selector retrieval. (a) `services/groundingRouter.js` is a pure heuristic intent classifier (regex/keyword + phrase-pattern table); given `{userMessage, transcript, engagement}` it returns `{selectorCalls, rationale, fallback}`. The router NEVER calls an LLM. (b) `services/chatService.js streamChat(...)` MUST invoke the router before assembling the system prompt; selector results are inlined into Layer 4 by `buildSystemPrompt({engagement, providerKind, routerOutput})`. (c) After the LLM responds, `streamChat` MUST call `services/groundingVerifier.js verifyGrounding(visibleResponse, engagement)`; entity-shaped claims (gap descriptions, vendor names, driver labels, env aliases, instance labels, project names, ISO-shaped dates referenced as engagement deliverables, "Phase N" / "Q[1-4]" project-phase references) are cross-referenced against the engagement (with catalog reference data whitelisted per R37.8). On `ok: false` the visible response is REPLACED with the render-error message *"The model produced an answer with claims that don't trace to the engagement. Try rephrasing the question, switching providers, or adding the relevant data to the canvas."*; provenance still surfaces; `groundingViolations` is recorded on the assistant message envelope. (d) Validation layer = real-LLM smoke at PREFLIGHT 5b (Anthropic + Gemini + Local A 3-turn each at every tag). NO mock provider modules of any kind: no grounded mock, no scripted LLM, no stubbed-fetch substrate. Tests for router + assembler + verifier are pure-function tests. The `streamChat`→`verifyGrounding` integration is verified by source-grep (V-FLOW-GROUND-FAIL-4 reworked). Architectural fix for BUG-030 (real-LLM hallucinations) + BUG-033 (Local A multi-turn degradation). Anti-pattern: any "just-this-once" allowing a hallucinated response through the verifier; any LLM-classifier router (second LLM grounding surface); skipping the router on first-turn or empty-engagement; ANY mock/scripted/stubbed substrate for grounding tests. | 🔴 HARD | tested by V-FLOW-GROUND-1/2/3/4/7 + V-FLOW-GROUND-FAIL-1/2/3/4(source-grep)/5 + V-ANTI-THRESHOLD-1 (rc.6 in §T38) |
| CH34 | v3-pure architecture — v3 engagement is the SOLE source of truth for entity state (per SPEC §S40, rc.7 / 7e, LOCKED 2026-05-06). (a) NO production module imports `state/sessionStore.js`. (b) NO production module imports `state/sessionBridge.js`, `interactions/matrixCommands.js`, `interactions/gapsCommands.js`, or `interactions/desiredStateSync.js`. (c) ALL view modules read engagement state via `state/adapter.js` selectors (`adaptContextView`, `adaptArchitectureView`, `adaptHeatmapView`, `adaptWorkloadView`, `adaptGapsView`, `adaptReportingView`) and write via `state/adapter.js` `commit*` helpers that route through `commitAction(actionFn, ...) → engagementStore`. (d) AI proposal application (`applyProposal`, `applyAllProposals`) MUST dispatch through `commitAction` so provenance fields (`aiSuggestedDellMapping.provenance` per SPEC §S8.1) populate end-to-end. (e) Undo (`aiUndoStack.push` / `undoLast`) MUST snapshot/restore the v3 engagement object via `getActiveEngagement()` / `setActiveEngagement(snapshot)` — NOT via v2 `replaceSession(snapshot)`. (f) `services/canvasFile.js` save/load operates on `EngagementSchema` directly; no v2 envelope, no v2→v3 migrator at runtime. (g) `core/bindingResolvers.js` `WRITE_RESOLVERS` table dispatches via `commitAction`; resolvers do NOT mutate v2 instance/gap arrays. (h) Catalog-ref-keyed cutover-window adapter helpers (`commitDriverUpdateByBusinessDriverId`, `commitEnvHideByCatalogId`, etc.) introduced during the v2 deletion arc are themselves DELETED at 7e-8; v3-pure mode keys all writes by UUID. Anti-pattern: re-introducing a session-shape data layer under any name; routing writes through `setPathFromRoot({session: ...})`; allowing AI write-back to bypass `commitAction` (provenance lost); making `state/sessionStore.js` exist again. | 🔴 HARD | tested by V-FLOW-V3-PURE-1..10 + V-ANTI-V2-IMPORT-1..3 (rc.7 / 7e in §T19 + §T40) |
| CH35 | Empty-environments UX contract — when `visibleEnvCount(engagement) === 0`, every downstream tab (Current state, Desired state, Gaps, Reporting + sub-tabs) MUST surface a v3-native empty-state via the shared `ui/components/NoEnvsCard.js` component. (a) The trigger is `engagement.environments.allIds.map(id => byId[id]).filter(e => !e.hidden).length === 0` -- equivalent forms collapse here. (b) Tabs 2/3 (Current state / Desired state) render a centered informational card (NOT a warning) in the left-panel content area; the matrix grid is NOT built. The right panel shows the standard "Select a technology" hint. (c) Tabs 4/5 (Gaps / Reporting + 4 sub-tabs) are DISABLED at the stepper level: `aria-disabled="true"` + `.step-disabled` class + click is a no-op. If reached via deep-link, body is empty. (d) Tab 1 (Context) NEVER blocks itself; it's the authoring surface. (e) RETIRED in rc.7 / 7e-8c'-fix2: the original first-add acknowledgment toast (one-time on `visibleEnvCount` 0→1, dedup'd via `localStorage.envFirstAddAck_v1`) was dropped per user direction -- the empty-state card's bullet list already states the soft-delete invariant, so a second toast was redundant noise. `surfaceFirstAddAcknowledgment` MUST NOT be re-introduced in any form (export, function, banner, toast, dedup key). (f) Matrix column scaling MUST live in `styles.css` as `.matrix-grid { grid-template-columns: 160px repeat(var(--env-count, 1), 1fr); max-width: min(100%, calc(160px + var(--env-count, 1) * 320px + 24px)); }` -- views set ONLY the `--env-count` custom property; inline `grid-template-columns` overrides are forbidden. (g) Per-view inline empty-state helpers (`_renderNoEnvsCard`, `_renderNoEnvsCardGaps`, `_renderNoEnvsCardReporting`) are FORBIDDEN -- the patch shipped at `4d70dff` is RETIRED in this redo. (h) `renderEmptyEnvsCenterCard` MUST NOT mutate host element classes; it renders a self-contained `.no-envs-wrap > .no-envs-center-card` subtree (the `host.classList.add("no-envs-host")` line in 7e-8c'-impl bled flex centering into Context tab and broke its layout — the "house of cards" bug). (i) The empty-state card MUST NOT include a CTA navigation button; the stepper at the top of the page is the authoritative navigation surface. Anti-pattern: any view shipping its own empty-state copy; matrix views fighting CSS via inline grid-template-columns; Tab 1 showing the empty-env card; reintroducing the first-add acknowledgment toast or its `envFirstAddAck_v1` dedup key under any name; mutating the host element from `renderEmptyEnvsCenterCard`; adding a navigation CTA to the empty-state card. | 🔴 HARD | tested by V-FLOW-EMPTY-ENVS-1..7 (rc.7 / 7e-8c' in §T41; -6 reworked in 7e-8c'-fix2 to NEGATIVELY assert the toast is gone) |
| CH36 | Skills Builder v3.2 rebooted (per SPEC §S46, rc.8.b, LOCKED 2026-05-10) — the Skills Builder ships as TWO surfaces with one shared skill JSON model. (a) **Two-surface separation** — authoring lives in Settings → Skills section (`ui/views/SkillBuilder.js renderSkillBuilder`); runtime lives in Canvas Chat overlay tab strip; NEVER merged (no authoring affordances inside Canvas Chat; no run-tab dynamics inside Settings). (b) **Improve = real LLM** — clicking Improve calls `services/aiService.js chatCompletion` via the active real provider; NO mock provider import permitted in SkillBuilder.js (per `feedback_no_mocks.md` LOCKED 2026-05-05). On failure: inline error chip below Improve button + Retry button; the Improved-prompt textarea is NOT cleared on failure. (c) **STANDARD_MUTABLE_PATHS curation lives in `core/dataContract.js`** — exported alongside helpers `getStandardMutableDataPoints()` + `getAllMutableDataPoints()`; NO new catalog file; NO duplication of the list anywhere else. Author form Standard/Advanced toggle filters between the two helpers' outputs. (d) **Output format enum** — exactly `text \| dimensional \| json-array \| scalar`; locked at SPEC §S46.6; new formats require SPEC amendment. (e) **Mutation policy enum** — exactly `ask \| auto-tag`; locked at SPEC §S46.10; per-skill author setting (NOT per-run, NOT global Settings). Visible in author form ONLY when `outputFormat ∈ {json-array, scalar}`. (f) **Single dynamic Skill tab** — Canvas Chat tab strip carries permanent Chat + permanent Skills launcher + at most ONE dynamic `[Skill: <name>]` tab; launching skill B while A runs MUST prompt confirm-cancel-A modal `[data-skill-cancel-confirm]`; mid-run X-close on the dynamic tab MUST prompt cancel confirm with lost-output warning. (g) **Skills launcher tab is read-only** — the Skills tab in Canvas Chat is a launcher list (label + description + Run button per row); NO `[data-skill-edit]` / `[data-skill-save]` / `[data-skill-delete]` affordances inside the Skills tab DOM (those live in Settings only). (h) **AI-tagging on mutation** (AMENDED rc.8.b R7 2026-05-10) — instances mutated by AI via `applyMutations` MUST carry `aiTag: { skillId, runId, mutatedAt }`. Both `ask` and `auto-tag` policies stamp the tag (the policy controls the gate, not the tag — per user direction 2026-05-10: "any mutated by AI, whether it is auto populated by AI or approved before auto mutation, should have the [tag] on them"). MatrixView's instance tile renderer (current-state + desired-state grids) MUST surface a "Done by AI" badge for instances where `aiTag` is set. Engineer-initiated mutations on `state/collections/instanceActions.js updateInstance` paths MUST strip `aiTag` automatically (auto-clear contract per Q-R7-1 'auto-clear on save'; no explicit clear-tag operation). **Scope: instances ONLY** — drivers / environments / gaps / customer / engagementMeta have NO `aiTag` schema field, NO badge renders for them, and `applyMutations` proposals targeting those entity kinds are silently SKIPPED (logged via `console.warn`). (i) **Marketplace-portability foundation** — saved skill JSON MUST NOT contain UUID literals in `seedPrompt` / `improvedPrompt` / `parameters[].defaultValue`; Save validator enforces; export/import UX itself is deferred (no `core/skillMarketplace.js` in v3.0 GA). (j) **File parameter run-scope** — author declares `parameter:{type:"file", accepts:"<extensions>"}`; user picks file at run-time in Skill panel right-rail; file content NEVER persists with the skill. Anti-pattern: any commit that re-introduces capsule library / cascaded vertical-tab rail / pill-capsule contenteditable Action editor (rc.8 rejected design); any code that bypasses the Improve-via-real-LLM rule with a mock or scripted substrate; storing STANDARD_MUTABLE_PATHS in a separate file; making mutation policy a per-run setting; allowing two simultaneous dynamic skill tabs; reintroducing the rejected §S44/§S45 SPEC slots under any name. | 🔴 HARD | tested by V-FLOW-SKILL-V32-MODULE-1 + V-FLOW-SKILL-V32-CURATION-1/2 + V-FLOW-SKILL-V32-AUTHOR-{SEED,DATA,IMPROVE,OUTPUT,POLICY,DESC}-1 + V-FLOW-SKILL-V32-SCHEMA-1/2/3/4 + V-FLOW-SKILL-V32-IMPROVE-1/2 + V-FLOW-SKILL-V32-CHAT-TAB-1/2/3 + V-FLOW-SKILL-V32-RUN-1/2 + V-FLOW-SKILL-V32-MUTATE-1/2/3 (23 vectors in `diagnostics/appSpec.js`; RED-first scaffold flips GREEN progressively across rc.8.b R2..R7) |
| CH37 | Schema-truthful enumeration (Quantitative honesty rule, per SPEC §S20.4.1.2, rc.9 Sub-arc C, LOCKED 2026-05-14) — the system-prompt Layer 1 Role section MUST carry Rule 10: install-base / vendor / instance queries are answered by ENUMERATION BY NAME of the entities in the engagement (e.g., "PowerEdge R770, PowerStore 1200T, Veeam Backup VBR"); citing the analytical-view tool that produced the list (per Rule 2 + §S20.4.1.1 Example 8 pattern). The chat MUST NOT compute percentages, ratios, weighted aggregates, or capacity-based comparisons across instance rows — the v3 instance schema collects names + types + descriptions + relationships but NOT quantities (no `quantity`, `count`, `multiplier`, or capacity-weight field on `instance`), so any aggregation across rows is mass-equivalence-misleading (1 VM weighted equal to 1 hyperscale cluster). Row-counts are permissible ONLY when (a) the user explicitly asks "how many", AND (b) the response cites the source tool, AND (c) the response qualifies the count as a row-count, not as a capacity / market-share / vendor-share metric. Behavior Examples 9 (linked-composition drilldown via `selectLinkedComposition`) + 10 (enumerate-by-name via `selectMatrixView`) ship in the same arc; Example 10 cites Rule 10 inline so enforcement is traceable in the chat's own output. SCHEMA-CONDITIONAL: the rule narrows automatically as schema fields are added — when `quantity` lands on a layer's instance schema (planned future feature per `docs/ROADMAP.md`), Rule 10 no longer applies to that layer. Anti-pattern: any commit that adds Rule 10-bypassing examples ("60% Dell instances"); any change that removes the rule's schema-conditional clause (making it absolute) without ROADMAP discipline; computing layer-distribution percentages, vendor-share percentages, or capacity-weighted metrics in chat output for as long as the underlying instance schema has no `quantity` field; allowing Example 10 to ship without an inline citation of Rule 10 by id. | 🔴 HARD | tested by V-AI-EVAL-6 (Rule 10 source-grep) + V-AI-EVAL-7 (Example 9 source-grep) + V-AI-EVAL-8 (Example 10 source-grep + inline Rule 10 citation) + post-rc.9 eval re-capture compared against `tests/aiEvals/baseline-2026-05-13T20-01-50-669Z.json` (expectation: GRD-2 lifts 5/10 → ≥8/10; data-grounding category 8.40 → ≥9.0; overall 9.16 → ≥9.3) |

**Cross-references**: SPEC §S20 + §S25 + TESTS §T20 V-CHAT-1..12 + §T25 V-CONTRACT-1..7 + §T26 V-MD-1. Memory anchors: `feedback_spec_and_test_first.md` (this entire section is the spec-first artifact), `feedback_no_version_prefix_in_names.md` (CH6 enforcement), `feedback_browser_smoke_required.md` (per-commit smoke for chat UI changes), `feedback_test_what_to_test.md` 2026-05-02 escalation (V-CHAT vectors include interaction completeness — clicking send actually streams + tool dispatches + memory persists), `feedback_no_patches_flag_first.md` (CH15+CH16 prevent the contract layer from being silently skipped).

---

## 17 · Production code shall not import from `tests/` at runtime · NEW v3.0.0-rc.2 (QUEUED 2026-05-02)

**Status**: SPEC §S23 + TESTS §T23 V-ANTI-RUN-1 authored 2026-05-02; implementation queued. **Rule below is normative once V-ANTI-RUN-1 lands GREEN against the shipped surfaces.**

The `tests/` directory exists for the in-browser test runner and Suite 49 vectors. It is served by the Dockerfile so the test runner can fetch it, but production code paths MUST NOT depend on it. Test fixtures and test mocks have **deterministic** shapes optimized for assertions; production needs the **live** engagement and the **real** provider. Production-from-tests imports normalize "borrow whatever I need, layer be damned" — once one production module imports from `tests/`, others copy the pattern (which is exactly how BUG-007 was introduced this session by copying BUG-006).

| # | Rule | Tier | When it fires |
|---|---|---|---|
| PR1 | Modules under `services/`, `state/`, `core/`, `ui/`, `selectors/`, `interactions/`, `migrations/`, `schema/` import from `tests/` at runtime | 🔴 HARD | tested by V-ANTI-RUN-1 (source-grep) |
| PR2 | Test files (`diagnostics/appSpec.js`, `diagnostics/demoSpec.js`, `tests/...`) ARE tests; importing from `tests/` is correct (PR1 exemption) | 🔵 AUTO | scope of V-ANTI-RUN-1 |
| PR3 | When a production module needs functionality currently in `tests/` (e.g. a mock provider that powers a UX toggle), the canonical path is to MOVE the module into `services/` (or other production location) and have `tests/` thin-re-export it (or migrate consumers off `tests/`). Never the reverse | 🔵 AUTO | code review |
| PR4 | "Just for now" exemptions are forbidden. There are no exemptions. If a feature can't be built without a `tests/` runtime import, the production module gets created first | 🔵 AUTO | per `feedback_no_patches_flag_first.md` |
| PR5 | Production file paths (under `services/`, `state/`, `core/`, `ui/`, `selectors/`, `interactions/`, `migrations/`, `schema/`) MUST NOT contain `v[0-9]` or `V[0-9]` — version numbers belong in tags / APP_VERSION / changelogs only (per SPEC §S24 + `feedback_no_version_prefix_in_names.md`) | 🔴 HARD | tested by V-NAME-1 |
| PR6 | User-visible UI strings (button text, headings, topbar entries in `index.html`) MUST NOT contain `v[0-9.]+` references. The deliberate version-chip footer (`<span id="appVersionChip">`) IS the only sanctioned surface that expresses APP_VERSION | 🔴 HARD | tested by V-NAME-1 |
| PR7 | Time-bounded exceptions to PR5 are permitted ONLY when v2.x collision blocks the rename (current set: `state/v3SkillStore.js` export collision with v2 `core/skillStore.js`; `core/v3SeedSkills.js` path collision with v2 `core/seedSkills.js`). Each exception is documented in SPEC §S24.4 + has an inline TODO comment + drops in one mechanical commit when v2 retires | 🔵 AUTO | scope of V-NAME-1 |

**Cross-references**: SPEC §S23 + §S24 + TESTS §T23 V-ANTI-RUN-1 + §T24 V-NAME-1. Memory anchors: `feedback_no_patches_flag_first.md` (PR4 is a direct application; PR5–PR7 too), `feedback_test_or_it_didnt_ship.md` (V-ANTI-RUN-1 + V-NAME-1 are the regression-test guardrails for BUG-005..007 and the v3-prefix purge), `feedback_no_version_prefix_in_names.md` (PR5 + PR6 + PR7 operationalize this rule).

---

## v2.4.15 · UI surfaces that make rules visible

Rules without visible UI are surprises. v2.4.11 added the original surfaces; v2.4.12-15 extended them. Updated to reflect v2.4.15 ship state.

| Surface | Where | Triggered by |
|---|---|---|
| Soft "REVIEW NEEDED" chip on gap detail | Tab 4 → gap detail panel, between status row and edit form | Auto-draft gap (reviewed:false) AND `validateActionLinks` would throw if reviewed |
| "🔒 manually set / ↺ auto" indicator on Urgency selector | Tab 4 → gap detail panel, Urgency field | `gap.urgencyOverride === true` |
| "AUTO-SUGGESTED driver: X because Y. [Pin this driver]" chip | Tab 4 → gap detail, below Strategic Driver dropdown | `gap.driverId` absent AND `effectiveDriverReason` returns `source: "suggested"` |
| "Also affects: {env labels}" chip on project detail | Tab 5.5 → project detail panel | Project's constituent gaps span > 1 environment |
| "LINKED VARIANTS in other environments: {env chips}" on workload tile | Tab 2/3 → workload tile detail | Same `label`/`state` workload exists in another environment |
| "↳ Gap drafted on Tab 4 (N unreviewed)" toast | Tab 3 → after disposition save | Auto-draft just fired |
| "Show closed gaps (N)" filter chip with count badge | Tab 4 → filter row | Any gap has `status: "closed"` |
| "Reopen" button + closed-status banner on gap detail | Tab 4 → gap detail panel | Gap has `status: "closed"` |
| "Click to open this {state}-state tile in Tab N" tooltip + cross-tab nav | Tab 4 → gap detail panel link rows | Always |
| ~~"+ Add operational / services gap" CTA~~ — REMOVED in v2.4.12 (U1). Services attach to any gap as a multi-chip facet ("Services needed" section in detail panel); a dedicated ops-typed gap CTA reinforced a wrong mental model. | — | — |
| "Services needed" multi-chip selector + opt-in SUGGESTED eyebrow row | Tab 4 → gap detail panel (under "Dell solutions") | Any gap is selected (NEW v2.4.12) |
| Services chip row "SERVICES NEEDED · {chips}" | Tab 5.5 → project card (under Dell solutions) | Project has ≥1 constituent gap with services (NEW v2.4.12) |
| ~~"Services scope" sub-tab + summary card~~ — DROPPED in v2.4.13 §0 (services info already visible on gap + project drawers) | — | — |
| "Review all →" button on auto-draft notice | Tab 4 → above filter row | Any auto-drafted unreviewed gap exists |
| Save button states: Saving… / Saved ✓ (green) / Couldn't save (red+shake) | Tab 4 → gap detail Save button | On click |
| App-version chip in footer (mono-caps capsule) | Footer (right side) | Always (v2.4.13 §1) |
| Global "AI Assist" top-right button | Topbar (right) | Always (v2.4.13 §2; replaces per-driver `useAiButton` mounting) |
| Centered Overlay modal (sticky head + body + foot, backdrop blur, Escape/X close) | Anywhere any view opens it | Settings, AI Assist, Hide-env confirm, Notify confirm (v2.4.13 §3 + iter-2 E2) |
| Demo banner on every tab + every Reporting sub-tab | Top of view | `session.isDemo === true` (v2.4.13 §5) |
| Stepper "01 02 03 04 05" mono leading-zero with active step indicator | Topbar | Always (v2.4.13 §6) |
| Layer corner code "L.0X" + 4×100% color-coded left bar | Tab 2 + Tab 3 matrix headers | Always (v2.4.13 §7 signal palette) |
| Gap-card domain hue 2px ::before bar | Tab 4 gap card | `gap-card[data-domain]` (v2.4.14 CD3) |
| Cmd+K / Ctrl+K keyboard shortcut for AI Assist | Anywhere | Always (v2.4.14) |
| Browser tab title unsaved indicator "• Dell Discovery Canvas" | Browser tab | While saving (v2.4.14) |
| Lucide SVG icons (footer Save/Open/Demo/New/Clear all + undo chips) | Footer + index.html | Always (v2.4.14) |
| Tab 1 Environments card: Active list + Hidden list with Restore | Tab 1 ContextView | Always (v2.4.15 SD3+SD4) |
| Hidden envs DROP from Tabs 2/3 (matrix) and DROP from Tab 5 reporting | Tab 2/3 + Tab 5 | Any env has `hidden: true` (v2.4.15 SD5 + iter-2 E1) |
| Vendor mix segmented bar (3-bar Combined/Current/Desired + 6-bar per-layer) | Tab 5 Vendor Mix | Always (v2.4.15 VB1-VB3) |
| Vendor mix headline insights (3 KPI tiles: Dell density / Most diverse layer / Top non-Dell) | Tab 5 Vendor Mix | Iter-3 Option A (v2.4.15) |
| Modern collapsible FilterBar (compact pill toggle + count badge + accordion panel + active-pill strip + Clear all) | Tab 4 GapsEditView + Tab 5 SummaryGapsView | Always (v2.4.15 FB1-FB7 + iter-3 D1) |
| Multi-select chip groups within FilterBar (within-dim OR + multi-dim AND combine) | FilterBar panel | User picks ≥2 values in any dim (v2.4.15 iter-4) |
| Quick toggles "Needs review only" / "Show closed gaps" inside FilterBar | FilterBar panel | Always (v2.4.15 iter-3) |
| Session capsule (building-2 icon + alias + "Updated HH:MM") | Topbar | Always (v2.4.15 SC1-SC2) |
| Footer right-aligned hint with `\|` divider before version capsule | Footer | Always (v2.4.15 FT1) |
| Matrix 3px column gap + invisible corner cell | Tab 2/3 matrix + heatmap | Always (v2.4.15 MT1-MT3) |
| `play-circle` Lucide icon on Load demo button | Footer | Always (v2.4.15 MT3) |
| GPLC `.tag[data-t]` primitive (`data-t="biz\|app\|data\|tech\|sec\|ops\|env"` + `data-t="urg"[data-level]`) | Anywhere with chip / pill / badge | (v2.4.15 iter-2 A1; full migration → v2.4.17 item 3) |
| `.btn-with-feedback` button-feedback contract (idle/pressed/loading/success/error + shake) | All primary action buttons | On click (v2.4.15 iter-2 A3) |
| Notify modal/toasts (`confirmAction` / `notifyError` / `notifyInfo` / `notifySuccess`) | Centered Overlay or top-right toast | Replaces 13 native confirm()/alert() sites (v2.4.15 iter-4) |
| AI Assist capsule-morph: top-right pill with heartbeat in pick mode | Topbar (right) | User clicks AI Assist + enters pick mode (v2.4.15 iter-3) |
| Single-site preset chip "Quick shape" | Tab 1 Environments card | Always; one-click hides all but Primary DC (v2.4.15 iter-5) |
| Typed env detail fields: Capacity stepper / Floor stepper / Tier datalist | Tab 1 ContextView right panel | Env tile selected (v2.4.15 iter-5) |

---

## Things I want to flag for our discussion

These aren't bugs. They're judgement calls baked into the rules where I'm not sure the current behaviour is what you actually want:

1. **AL1 · auto-drafts bypass action-link rules entirely.** This means a `consolidate` auto-draft with 1 current passes silently. Pro: doesn't block the user mid-workflow. Con: a forgotten unreviewed gap can ship with bad shape. **Question**: should the user be FORCED to fix link counts before the gap can be marked reviewed?

2. **P3 · changing a tile's disposition to `keep` deletes ALL linked gaps with no confirmation.** Currently silent destructive. **Question**: should this prompt "This will delete N gap(s). Continue?" first?

3. **L1 / L2 · safety-net unlink lists are NARROWER than the action-link table.** L1 covers `enhance/replace/consolidate` (not `introduce`); L2 covers `introduce/enhance/replace/consolidate`. There's no rule for `retire` (which requires 1 current) or `keep` (which requires 1 current). **Question**: should L1/L2 derive from the taxonomy automatically instead of being a hand-typed allowlist?

4. **P6 · `confirmPhaseOnLink` is a returned-status function, not a hard-block.** It's the UI's responsibility to actually surface the confirmation. If a future view forgets to check the return value, the link goes through silently with mismatched phase/priority. **Question**: should this be a hard throw with an `{ confirmed: true }` opt-in, instead of a warn-but-allow?

5. **D1-D9 · driver suggestion ladder is regex-on-text-fields.** Brittle: a user editing a gap description can change which driver the gap appears under. **Question**: should suggested drivers be SHOWN in the UI when an explicit `driverId` is missing (so the user can confirm/override), instead of silently picked?

6. **W5 · same-environment workload mapping requires one workload tile per environment.** This works but multiplies tiles for hybrid workloads. **Question**: should a workload be allowed to declare multiple environments (an array), with the workload appearing once on the matrix at the "primary" env?

7. **PR1 · `projectId` is derived from primary env + primary layer + gapType.** A gap with `affectedEnvironments: ["coreDc", "drDc"]` lands in the coreDc project; the drDc relevance is invisible. **Question**: should multi-env gaps create one project per env (multiplicative grouping), or stay in one project (current)?

8. **Soft urgency**: a user can manually set `gap.urgency` via updateGap, but propagation rules (P4 and P7) keep overwriting it whenever the linked current's criticality changes. **Question**: should manual urgency be "sticky" (override propagation), or always derived?

9. **The desired-link-not-clickable bug you reported** — **not yet a rule violation**. It looks like a missing event handler in `GapsEditView.js`. Investigating this is the v2.4.11 bug-fix part.

10. **The 7th Action `ops` (Operational) has optional/optional link rules.** That means an `ops` gap can be created with NO links and NO additional context. It will still appear on the roadmap as a "Cross-cutting" project. **Question**: should `ops` require AT LEAST one of (links, notes, mappedDellSolutions) to prevent empty placeholder gaps?

---

## How to use this document

1. Read it in one sitting; mark every row that surprises you.
2. Tell me which "judgement call" answers above you want changed.
3. Tell me which rules you'd like to add / remove / soften / harden.
4. From that conversation I'll draft the next rules-hardening pass (locked scope, executable plan, no surprises).

**Note (v2.4.16 refresh)**: most of the v2.4.11 "Things I want to flag for our discussion" items above were addressed:
- Item 1 (auto-draft bypass) — kept; AL10 `approveGap` is the explicit gate.
- Item 2 (P3 keep-deletes-gaps) — replaced; now sets `status: "closed"` with auto reason (P3 v2.4.11 update).
- Item 3 (L1/L2 narrowness) — fixed; rules now derive from `taxonomy.requiresAtLeastOneCurrent/Desired` (v2.4.11 A3).
- Item 4 (P6 silent allow) — fixed; `linkDesiredInstance` now refuses with `PHASE_CONFLICT_NEEDS_ACK` unless `{ acknowledged: true }` (L8 v2.4.12).
- Item 8 (urgency stickiness) — fixed via `urgencyOverride: bool` (v2.4.11 A6).
- Item 10 (ops gap empty placeholder) — fixed; AL7 substance rule (v2.4.11 A9).

Items 5, 6, 7, 9 remain open for future conversations. Item 9 (desired-link-not-clickable) was a UI bug fix in v2.4.11.

**Companion**: `docs/TAXONOMY.md` is the entity-and-relationships-first view of the same contract; this doc is the rules-first view. Cross-references go both ways.
