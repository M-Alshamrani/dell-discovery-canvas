# Rules-as-built · v2.4.11

The complete inventory of every rule the app enforces today, extracted from
the source so we can read it in one place and decide what's right, what's
wrong, and what's missing. v2.4.11 incorporated the rules-hardening pass
that came out of this audit; this version of the doc reflects the
post-v2.4.11 state. Italics flag changes from the v2.4.10.1 baseline.

Every rule is tagged:
- 🔴 **HARD** — throws on violation; the action is blocked.
- 🟡 **SOFT** — emits a warning or chip; action proceeds.
- 🔵 **AUTO** — silent automatic behavior the user doesn't see.
- 📦 **MIGRATE** — one-shot fix on session load; idempotent.

And by **trigger** — when in the user's flow the rule fires.

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

## v2.4.11 · UI surfaces that make rules visible

Rules without visible UI are surprises. v2.4.11 added these surfaces so users see WHY the app does what it does:

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
| "Services scope" sub-tab + summary card | Tab 5 Reporting → sub-tab bar + Overview | Always (NEW v2.4.12) |
| "Review all →" button on auto-draft notice | Tab 4 → above filter row | Any auto-drafted unreviewed gap exists |
| Save button states: Saving… / Saved ✓ (green) / Couldn't save (red+shake) | Tab 4 → gap detail Save button | On click |

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
4. From that conversation I'll draft v2.4.11 · Rules Hardening (locked scope, executable plan, no surprises).
