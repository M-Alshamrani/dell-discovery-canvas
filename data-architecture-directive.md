# Dell Discovery Canvas: Data Architecture Directive (v3.0)

**Status:** Initial Arc. Draft
**Date:** 2026-04-30
**Audience:** Implementation team, Claude Code (spec writer, test author, feature author)
**Authority:** This is the lead architect's directive. It is the canonical source from which the implementation specification, migration specification, test vectors, tests, and feature code are derived in that order. Deviations require an explicit change request against this document; silent drift is forbidden.

---

## 0. How this document is consumed

The build pipeline is:

1. **Specification step.** Claude Code reads this directive and produces (a) the implementation specification and (b) the migration specification. Anything constrained here is mandatory; anything not constrained is open to the spec writer's judgment but must be justified inline in the spec.
2. **Test vector step.** Claude Code derives test vectors from sections 2 through 14. Coverage target: every numbered requirement in this directive has at least one test vector that fails when the requirement is violated. Vectors that cannot be traced back to a numbered requirement are flagged for review.
3. **Test implementation step.** The vectors are made executable. Tests must execute the real production code paths. Bypassing the real path with mocks of internal modules is forbidden except for the boundaries explicitly listed in section 14.4.
4. **Feature implementation step.** Code is written until tests pass. A test passing through a contrived shortcut (constants returned from stubs, hardcoded responses, silent try/catch swallowing failures, conditionals that detect test mode) is treated as a regression and rejected.

Section numbers in this document are stable. Subsections may be added with letter suffixes (3.1a, 3.1b) without renumbering.

---

## 1. Non-negotiable principles

These ten principles are the constitution. Every later section is a refinement of one or more of them.

**P1. Schema is the single source of truth.** One schema artifact defines every persisted entity. Validation, migrations, the AI skill builder's chip manifest, integrity rules, eventual SQL DDL, and runtime types all derive from this one artifact. Hand-maintained parallel definitions are forbidden.

**P2. Storage is normalized.** Persisted data is stored as flat collections of entities indexed by `id`, with foreign keys between collections. There is no nested matrix-of-matrices, no env-grouped tree, no per-tab data ownership. Cross-cutting relationships (workload assets across environments, originId across environments, gaps spanning environments) are first-class foreign keys, not special cases.

**P3. Presentation is derived, never stored.** The Tab 2 matrix grid, the Tab 5 reports, the click-to-run "linked composition" view, the vendor mix, the heatmap, the executive summary inputs, and every other view are pure functions over the normalized store. No view writes back. No denormalized cache lives alongside the store.

**P4. Migrations are first-class artifacts.** Every schema version has a forward migrator. Migrators are pure, idempotent, and round-trippable through a registered test fixture for each version-pair. Schema versions are monotonic strings. The current version is encoded in every persisted engagement.

**P5. AI-authored data carries provenance.** Any field whose value originates from an LLM is stamped with model identifier, prompt version, timestamp, validation status, and source catalog version. Unprovenanced AI text is forbidden in the schema.

**P6. Catalogs are versioned reference data.** Catalogs (LAYERS, BUSINESS_DRIVERS, ENV_CATALOG, SERVICE_TYPES, GAP_TYPES, DISPOSITION_ACTIONS, CUSTOMER_VERTICALS, plus the Dell product taxonomy) are versioned. Persisted entities reference catalog entries by `id` plus `catalogVersion`. Catalogs are fetchable with a local snapshot for offline operation.

**P7. Integrity is restorable, not assumed.** Foreign-key invariants are stated in the schema. The integrity sweep runs on every load, detects violations, repairs the repairable, and logs the rest. The sweep is pure (no DOM coupling) and deterministic given the same input.

**P8. Multi-engagement readiness is built in now.** Every persisted record carries `engagementId` and `ownerId` and audit timestamps from day one, even though the v3.0 application is single-engagement and single-user. Retrofitting these later, against real customer data, is the most expensive operation we can defer.

**P9. Performance budget is enforced by test.** The 100ms render budget and the 500ms full-data round-trip budget on a 200-instance reference engagement are encoded in performance regression tests. A code change that breaches the budget fails CI. The budget is not enforced by hope or by manual benchmarking.

**P10. Tests verify real execution paths.** No internal module is mocked unless it crosses one of the boundaries in section 14.4 (LLM provider, network, storage backend). A green test suite that exercises stubs instead of code is worse than no test suite, because it produces false confidence.

---

## 2. Schema layer

### 2.1 Library choice

**Adopt Zod as the schema library.** Zod runs in plain JavaScript without TypeScript, integrates with the eventual TypeScript migration through `z.infer`, and has the largest ecosystem of derivation tooling (drizzle-zod for SQL DDL, zod-to-json-schema for LLM structured outputs, zod-to-openapi for API contracts).

Acceptable alternative on record: Valibot, if bundle size becomes a measured constraint. The decision is not Valibot today because Zod's ecosystem advantage outweighs its bundle cost at our scale.

Forbidden alternatives: ad-hoc validators, JSON Schema hand-written and parallel to runtime checks, JSDoc as the only typing layer.

### 2.2 Schema artifact requirements

R2.2.1. The schema lives in a single directory `schema/` with one file per entity (`schema/customer.js`, `schema/instance.js`, etc.) plus a `schema/index.js` that composes the engagement schema.

R2.2.2. Every entity schema exports:
   - the Zod schema object,
   - a factory `createEmpty<EntityName>()` that returns a default-valid instance,
   - the FK declarations (machine-readable, see R4.4),
   - the path manifest contribution (machine-readable, see section 8).

R2.2.3. Entity schemas compose; the engagement schema is `z.object({...})` over the entity collections plus engagement metadata. There is no second, "richer" schema kept alongside.

R2.2.4. Validation is invoked at three boundaries and only at three boundaries: on persisted-data load, on persisted-data save, and on user input commit. Validation is not invoked on every selector evaluation.

R2.2.5. Validation failures on load route through the migration system (section 10) before being reported as errors. Validation failures on save are blocking errors with structured field paths.

### 2.3 Schema versioning

R2.3.1. The schema version is a string of the form `"<major>.<minor>"`. Version 3.0 is the target of this directive. Versions are monotonic.

R2.3.2. Every persisted engagement carries `engagementMeta.schemaVersion`. Reading an engagement without this field treats it as version `2.0` (the current production version).

R2.3.3. Each version has a directory `schema/v3-0/`, `schema/v3-1/` etc., and a migrator `migrations/v2-0_to_v3-0.js`, `migrations/v3-0_to_v3-1.js` etc. Migrators always go forward only. Backward migration is not supported.

R2.3.4. The "current" schema version is exported from `schema/index.js`. Production code never imports a versioned schema directory directly; only migrators do.

---

## 3. Entity model

The normalized entity model below is the v3.0 target. Field-level changes from v2.0 are called out in section 14.

### 3.1 Engagement (renamed from "session")

The top-level container. The user-facing term remains "session" in the UI; the data term is "engagement" everywhere in code and storage. Rationale: the multi-engagement future and the eventual backend require this distinction. Not making it now is technical debt that compounds.

Fields:
- `engagementId` (string, primary key)
- `isDemo` (boolean)
- `schemaVersion` (string, see R2.3.2)
- `ownerId` (string, presales engineer identifier; placeholder value `"local-user"` in v3.0 single-user mode)
- `createdAt` (ISO timestamp)
- `updatedAt` (ISO timestamp)
- `status` ("Draft" | "In review" | "Locked")
- `presalesOwner` (string, free text, separate from `ownerId` to allow display name vs identity)
- `engagementDate` (ISO date)

Transient fields, stripped on save:
- `activeEntity` ({ kind, id, at } | null)
- `integrityLog` (regenerated on each load)

### 3.2 Customer

Single record per engagement. Embedded in the engagement document for v3.0; promotable to its own collection at backend migration without schema drift because all FKs point at the engagement, not at the customer record.

Fields:
- `engagementId` (FK)
- `name` (string)
- `vertical` (string, FK to CUSTOMER_VERTICALS catalog)
- `region` (string)

Removed in v3.0: `segment` and `industry` (legacy back-compat strings). Migrator drops these after copying any non-redundant content into `notes` (new optional field).

### 3.3 Driver (extracted from customer.drivers[])

Promoted to its own top-level collection. Rationale: the AI skill builder treats drivers as a click-to-run entity kind with linked relationships; the skill manifest is cleaner when drivers are queryable as a collection; multi-engagement reporting requires this.

Fields:
- `id` (string, primary key in the collection)
- `engagementId` (FK)
- `businessDriverId` (FK to BUSINESS_DRIVERS catalog)
- `priority` ("High" | "Medium" | "Low")
- `outcomes` (string, free text)

### 3.4 Environment

Fields:
- `id` (string, primary key)
- `engagementId` (FK)
- `envCatalogId` (FK to ENV_CATALOG)
- `hidden` (boolean, soft-delete flag)
- `alias` (string, optional, e.g. "Riyadh DC")
- `location` (string, optional)
- `sizeKw` (number, optional)
- `sqm` (number, optional)
- `tier` (string, optional)
- `notes` (string, optional)

### 3.5 Instance

Single collection. The `state` field discriminates current vs desired. Rationale: shared columns dominate; splitting into two collections would force joining across them for the matrix view, the originId resolution, and the workload mappedAssetIds resolution.

Fields:
- `id` (string, primary key)
- `engagementId` (FK)
- `state` ("current" | "desired")
- `layerId` (FK to LAYERS)
- `environmentId` (FK to environments collection)
- `label` (string)
- `vendor` (string)
- `vendorGroup` ("dell" | "nonDell" | "custom")
- `criticality` ("High" | "Medium" | "Low")
- `notes` (string, optional)
- `disposition` (FK to DISPOSITION_ACTIONS)

State-conditional fields, validated by Zod refinements:
- `originId` (only on `state === "desired"`; FK to instances where `state === "current"`; may reference an instance in a different environment)
- `priority` (only on `state === "desired"`; "Now" | "Next" | "Later")

Layer-conditional field:
- `mappedAssetIds` (only on `layerId === "workload"`; array of FKs to other instances; may cross environments)

AI-authored fields (see section 9):
- `aiSuggestedDellMapping` (provenance-wrapped object, optional, on desired-state instances)

### 3.6 Gap

Fields:
- `id` (string, primary key)
- `engagementId` (FK)
- `description` (string)
- `gapType` (FK to GAP_TYPES)
- `urgency` ("High" | "Medium" | "Low")
- `urgencyOverride` (boolean)
- `phase` ("now" | "next" | "later")
- `status` ("open" | "in_progress" | "closed" | "deferred")
- `reviewed` (boolean)
- `notes` (string)
- `driverId` (FK to drivers collection)
- `layerId` (FK to LAYERS, primary layer)
- `affectedLayers` (array of FKs to LAYERS; invariant G6: `affectedLayers[0] === layerId`)
- `affectedEnvironments` (array of FKs to environments; may include 2 or more)
- `relatedCurrentInstanceIds` (array of FKs to current-state instances)
- `relatedDesiredInstanceIds` (array of FKs to desired-state instances)
- `services` (array of FKs to SERVICE_TYPES)

AI-authored:
- `aiMappedDellSolutions` (provenance-wrapped object, see section 9)

Derived (not stored):
- `projectId` is computed from `buildProjects(engagement)` at projection time. It is not persisted. The v2.0 stored `projectId` is dropped by the migrator.

### 3.7 Cross-cutting relationships table

These are the relationships that defeat any nested-by-environment storage shape. They are first-class FKs, not exceptions. Tests (section 14.2) cover each one explicitly.

| Source entity | Field | Target | Cross-environment? |
|---|---|---|---|
| Instance (workload) | `mappedAssetIds[]` | Instance | yes |
| Instance (desired) | `originId` | Instance (current) | yes |
| Gap | `affectedEnvironments[]` | Environment | yes (2 or more) |
| Gap | `relatedCurrentInstanceIds[]` | Instance (current) | yes |
| Gap | `relatedDesiredInstanceIds[]` | Instance (desired) | yes |

---

## 4. Storage layer

### 4.1 In-memory shape

The engagement is held in memory as:

```
engagement = {
  meta:         EngagementMeta,
  customer:     Customer,                  // 1 record
  drivers:      { byId: { id: Driver },    indexById,  allIds: [id] },
  environments: { byId: { id: Environment }, allIds: [id] },
  instances:    { byId: { id: Instance },  allIds: [id], byState: { current: [id], desired: [id] } },
  gaps:         { byId: { id: Gap },       allIds: [id] }
}
```

R4.1.1. Each collection is `{ byId, allIds, ...indexes }`. `byId` is the canonical store. `allIds` preserves insertion order. Secondary indexes are explicitly named and rebuilt by pure functions on mutation.

R4.1.2. Mutation goes through a single set of action functions per collection (`addInstance`, `updateInstance`, `removeInstance`, `addGap`, etc.). Direct mutation of `byId` outside these functions is forbidden.

R4.1.3. The action functions return a new engagement object. Structural sharing is acceptable; in-place mutation is not, because the projection layer (section 5) depends on referential change detection for memoization.

### 4.2 Persistence shape

R4.2.1. The persisted `.canvas` JSON file is the in-memory shape minus transient fields (`activeEntity`, `integrityLog`) and minus secondary indexes (which are rebuilt on load).

R4.2.2. localStorage uses the same persisted shape under a single key. The autosave debounces at 1000ms.

R4.2.3. The persisted shape is also the document-database shape for the eventual backend. One engagement per document. No further denormalization.

### 4.3 Engagement scoping (P8)

R4.3.1. Every record except `engagementMeta` and `customer` carries `engagementId`. In v3.0 this is always equal to `engagementMeta.engagementId`; the field exists to make multi-engagement migration a column addition rather than a shape change.

R4.3.2. The integrity sweep verifies that every record's `engagementId` matches the engagement it belongs to.

### 4.4 Foreign key declarations

R4.4.1. FKs are declared in the entity schemas as machine-readable annotations, not just types. Example shape:

```
fkDeclarations: [
  { field: "environmentId", target: "environments", required: true },
  { field: "originId", target: "instances", required: false,
    targetFilter: { state: "current" } }
]
```

R4.4.2. The integrity sweep, the chip manifest generator, and the eventual SQL DDL generator all consume these declarations. Hand-coding FK checks in three places is forbidden.

---

## 5. Derived views layer

### 5.1 Selector contract

R5.1.1. Every view consumed by the UI is implemented as a pure selector function: `(engagement) => view`.

R5.1.2. Selectors are memoized at module scope keyed by the input engagement reference (and any additional arguments). The memoization implementation is the team's choice (memoize-one is the recommended baseline; reselect is acceptable; proxy-memoize is acceptable). The choice must be uniform across selectors.

R5.1.3. Selectors do not reach into `localStorage`, the DOM, the network, or any source other than the engagement passed in. A selector that does is rejected.

R5.1.4. A selector that produces a different output for the same input on two consecutive calls is a defect.

### 5.2 Required selectors

The following selectors are part of the v3.0 contract. Each has a test vector that asserts shape and a fixture-based test that asserts content.

- `selectMatrixView(engagement, { state })`: returns environments × layers grid for Tab 2 and Tab 3.
- `selectGapsKanban(engagement)`: returns gaps grouped by phase and status for Tab 4.
- `selectProjects(engagement)`: groups gaps into projects for Tab 5.
- `selectVendorMix(engagement)`: returns vendor counts and percentages.
- `selectHealthSummary(engagement)`: returns the heatmap input.
- `selectExecutiveSummaryInputs(engagement)`: returns the structured inputs the LLM consumes for the exec summary skill.
- `selectLinkedComposition(engagement, { kind, id })`: returns the click-to-run linked record set for skill builder runtime (section 8).

### 5.3 Forbidden patterns

F5.3.1. No "denormalized cache" alongside the store. If a selector is slow, the answer is to fix the selector, not to mirror its output into storage.

F5.3.2. No view writes back to the store. Tab components read selector output and dispatch actions; they do not edit projections.

F5.3.3. No selector caches its output in module state outside the memoization wrapper. Memoization keys are explicit; module-scope mutable state is forbidden.

---

## 6. Catalogs subsystem

### 6.1 Catalog shape

R6.1.1. Each catalog has the form:

```
{
  catalogId: "BUSINESS_DRIVERS",
  catalogVersion: "2026.04",
  entries: [{ id, label, ...catalogSpecificFields }]
}
```

R6.1.2. Catalogs are loaded from a static bundled snapshot in v3.0. The loader interface accepts a remote URL in v3.1 onward; the v3.0 implementation hardcodes the bundled path behind the same interface so v3.1 is a one-line swap.

R6.1.3. Persisted entities reference catalog entries by `id` plus the `catalogVersion` they were stamped against. Drift detection (section 9.4) compares persisted versions against the loaded catalog's current version.

### 6.2 Catalog inventory (v3.0)

The catalog set in v3.0:

- `LAYERS` (6 entries): workload, compute, storage, dataProtection, virtualization, infrastructure
- `BUSINESS_DRIVERS` (8 entries)
- `ENV_CATALOG` (8 entries)
- `SERVICE_TYPES` (10 entries)
- `GAP_TYPES` (5 entries, derived from DISPOSITION_ACTIONS minus `keep` and `retire`)
- `DISPOSITION_ACTIONS` (7 entries)
- `CUSTOMER_VERTICALS` (alphabetised list)
- **`DELL_PRODUCT_TAXONOMY`** (new in v3.0; the live Dell portfolio used by the AI provenance subsystem to validate `aiSuggestedDellMapping` and `aiMappedDellSolutions`)

R6.2.1. The Dell product taxonomy must be authored against current Dell positioning. Concrete corrections that must be reflected on day one of v3.0:
   - Boomi is not in the Dell taxonomy (divested).
   - Secureworks Taegis is not in the Dell taxonomy (divested).
   - VMware is referenced as a partner technology, not a Dell product.
   - VxRail is not a current positioning item; Dell Private Cloud (via Dell Automation Platform with PowerFlex) is.
   - "SmartFabric Director" is forbidden; the current product is "SmartFabric Manager".
   - CloudIQ is referenced under the Dell APEX AIOps umbrella, not as a standalone product.

R6.2.2. The Dell product taxonomy carries `catalogVersion` of the form `YYYY.MM` and is updateable independent of code releases starting v3.1.

---

## 7. AI skill builder subsystem

### 7.1 Skill model

R7.1.1. A skill is a persisted record with:
   - `skillId`
   - `skillType` ("click-to-run" | "session-wide")
   - `entityKind` (only on click-to-run; one of: driver, currentInstance, desiredInstance, gap, environment, project)
   - `promptTemplate` (string with `{{path}}` placeholders)
   - `bindings` (array of `{path, source}` derived from the template at save time)
   - `outputContract` (optional structured-output schema; see R7.4.3)

R7.1.2. Skills are stored in the engagement initially and promoted to a per-owner collection in v3.1. The shape does not change at promotion.

### 7.2 Manifest generation

R7.2.1. The chip manifest is **generated** from the schema at build time and at runtime. It is never hand-maintained.

R7.2.2. The generator walks the schema and emits a manifest of shape:

```
manifest = {
  sessionPaths: [{ path, type, label, source: "schema" }],
  byEntityKind: {
    driver: {
      ownPaths: [...],
      linkedPaths: [
        { path: "linkedGaps", composition: "gaps where gap.driverId === driver.id" },
        { path: "linkedInstances", composition: "..." }
      ]
    },
    ...
  }
}
```

R7.2.3. The "linked composition" definitions live next to each entity schema, not in a separate file. Entity schemas declare their incoming and outgoing relationships. The manifest generator composes these into the linked-paths section.

R7.2.4. A test (section 14) asserts that the manifest is recomputable: regenerating from the schema produces a byte-identical manifest. Drift between the schema and a checked-in manifest snapshot fails the build.

### 7.3 Path resolution

R7.3.1. At skill save time, every `{{path}}` in `promptTemplate` is checked against the manifest for the skill's `(skillType, entityKind)`. Unknown paths block the save with a structured error listing valid paths.

R7.3.2. At skill run time, the resolver:
   - For session-wide skills, resolves paths against the engagement plus selectors.
   - For click-to-run skills, computes `selectLinkedComposition(engagement, { kind, id })` once, then resolves paths against the merged context.

R7.3.3. A resolved path that returns `undefined` at runtime is logged with the path, the skill id, and the engagement state at resolution. Silent rendering of `undefined` into a prompt is forbidden.

R7.3.4. The resolver is pure and synchronous. Async work (the LLM call) is the layer above the resolver.

### 7.4 Skill output validation

R7.4.1. Where the skill produces structured output (e.g., `aiMappedDellSolutions`), the LLM call uses the provider's structured-output mechanism (function calling on Anthropic and OpenAI; equivalent on Gemini and Dell Sales Chat). Free-text parsing of structured fields is forbidden.

R7.4.2. The structured-output schema is derived from the field's Zod schema via `zod-to-json-schema`. The LLM cannot hallucinate a Dell product that is not in the catalog if the structured output is constrained to catalog entry ids.

R7.4.3. Skills that produce free-text output (executive summary, narrative drafts) are not constrained, but their output is provenance-wrapped (section 9) and never written into a typed field.

R7.4.4. Skill output evaluations are first-class. A regression suite of (engagement fixture, skill, expected output shape) cases runs in CI for the skills the team designates as production-critical. The reference patterns to follow are those in Hamel Husain's 2024 to 2025 writing on LLM evaluation rigor.

---

## 8. AI provenance subsystem

### 8.1 Provenance shape

Every AI-authored field has the wrapper:

```
{
  value: <typed value>,
  provenance: {
    model:           "claude-3-5-sonnet" | "gemini-1.5-pro" | "dell-sales-chat" | "local-llm" | ...,
    promptVersion:   "skill:dellMap@1.4.0",
    skillId:         "skl-...",
    runId:           "run-...",
    timestamp:       ISO timestamp,
    catalogVersions: { DELL_PRODUCT_TAXONOMY: "2026.04", ... },
    validationStatus: "valid" | "stale" | "invalid"
  }
}
```

R8.1.1. The schema for AI-authored fields is `provenanceWrapper(z.string())` or similar. Plain strings in AI-authored slots are a schema violation.

R8.1.2. The provenance is set by the skill runner, not by any user-facing code path. Manual edits to the value field by the user demote `validationStatus` to `"user-edited"` and the provenance is preserved as historical record.

### 8.2 Catalog validation at suggestion time

R8.2.1. Suggestions for fields whose values must be in a catalog (e.g., Dell product mappings) are produced via structured output constrained to catalog entry ids. This is the primary defense against hallucinated products.

R8.2.2. If structured output is unavailable on a provider, the runner validates the LLM's text output against the catalog and, on miss, retries with a stricter prompt up to a fixed retry budget. After exhaustion, the field is set with `validationStatus: "invalid"` and surfaced visibly in the UI.

### 8.3 UI distinction

R8.3.1. AI-authored fields are visually distinct from human-authored fields in the UI. Per the standing UI preference, this is communicated through icons rather than text labels.

R8.3.2. Fields with `validationStatus === "stale"` or `"invalid"` are flagged with a warning icon. Hovering reveals the reason and suggests re-running the skill.

### 8.4 Drift detection on reopen

R8.4.1. On engagement load, the integrity sweep re-validates every AI-authored field against the current catalog versions. A catalog version mismatch flips `validationStatus` to `"stale"`.

R8.4.2. Stale-flagging never silently rewrites the value. The user decides whether to re-run the skill.

R8.4.3. Aggregate drift counts are surfaced on the engagement load screen ("3 AI suggestions are stale against current Dell catalog"). The user is not blocked from working.

---

## 9. Migration system

### 9.1 Migrator contract

R9.1.1. A migrator is a pure function `(oldEngagement) => newEngagement` registered for a specific `from` and `to` schema version.

R9.1.2. Migrators are idempotent: running a `2.0 -> 3.0` migrator on a `3.0` engagement is a no-op (verified by test).

R9.1.3. Migrators do not call out to the network, the DOM, or storage. They do not consult catalogs unless the catalog reference is bundled with the migrator (catalog snapshots evolve separately from migrators).

R9.1.4. Migrators run on load before validation (R2.2.5). After migration, validation against the target schema must pass; failure is a migration defect, not user error.

### 9.2 Round-trip fixtures

R9.2.1. For every version pair, a checked-in fixture file contains representative engagements at the source version. The migrator runs against each fixture and the result is validated. The fixture set covers, at minimum: empty engagement, single-environment engagement, multi-environment engagement, engagement with cross-environment workload mappings, engagement with cross-environment originId, engagement with multi-environment gaps, engagement with AI-provenanced fields, demo engagement.

R9.2.2. Fixtures are append-only. When a v3.0 fixture is added, the v2.0-to-v3.0 migrator's behavior on it is locked.

### 9.3 The v2.0 to v3.0 migration

The concrete migrator the team will build first. The transformations:

1. Set `engagementMeta.schemaVersion = "3.0"`.
2. Rename `sessionId` to `engagementId` in the meta block; preserve the value.
3. Add `ownerId = "local-user"` if absent.
4. Add `createdAt` and `updatedAt` from the existing date or from the migration timestamp.
5. Drop `customer.segment` and `customer.industry`. If non-empty and not redundant with `vertical`, append into `customer.notes`.
6. Extract `customer.drivers[]` into a top-level `drivers` collection. Generate `id` for each. Move `priority` and `outcomes` across. Preserve the catalog FK as `businessDriverId`.
7. Convert `instances`, `environments`, `gaps` arrays into the `{ byId, allIds, ...indexes }` shape on load (this is in-memory; persistence remains a flat list in v3.0 for forward compatibility).
8. Drop `gap.projectId` (now derived).
9. Wrap any pre-existing free-text AI fields into the provenance wrapper with `validationStatus: "stale"` and `model: "unknown"`. The user is informed on load.
10. Stamp every record with `engagementId`.

### 9.4 Failure handling

R9.4.1. A migration that throws is caught, the original engagement is preserved, and the user is shown a structured error with the migration step that failed and the migrator version. The user can choose to download the unmigrated `.canvas` file or proceed with a recovery flow.

R9.4.2. There is no "auto-recover and continue silently" path. Silent recovery from migration failure is forbidden because it produces engagements in invalid states.

---

## 10. Integrity subsystem

### 10.1 Sweep contract

R10.1.1. The integrity sweep is a pure function `(engagement) => { repaired, log }`. Same input produces same output.

R10.1.2. The sweep runs on every load, after migration, before the engagement reaches the UI.

R10.1.3. The sweep consumes the FK declarations from R4.4 and the schema invariants from section 3.

### 10.2 Repair rules

R10.2.1. Orphan FKs (a field references an id that does not exist in the target collection) are nulled if the field is optional and dropped from arrays if the field is an array of FKs.

R10.2.2. Required-FK violations cannot be repaired. The orphaned record is marked invalid and routed to a quarantine list visible in the integrity log; it does not enter the active engagement until the user resolves it.

R10.2.3. Schema invariants (e.g., G6: `gap.affectedLayers[0] === gap.layerId`) are repaired by reordering or insertion if mechanical, otherwise quarantined.

R10.2.4. Repairs are logged with the rule id, the record id, the field, and the before/after state. The log is non-persisted (per current behavior) but accessible during the session.

### 10.3 Repair denied

R10.3.1. The sweep never creates new entities. It only deletes, nulls, or reorders.

R10.3.2. The sweep never changes user-authored content fields (label, notes, description). It only operates on structural fields.

---

## 11. Performance budget

### 11.1 Numbers

R11.1.1. View render budget: a single tab render against a 200-instance reference engagement completes in under 100ms on the reference laptop profile (defined in `perf/baseline.md`).

R11.1.2. Full-data round-trip budget: load engagement, run integrity sweep, hydrate indexes, render the default tab, all inside 500ms on the reference laptop profile.

R11.1.3. Selector cold-start budget: any single selector returns inside 50ms on the 200-instance reference engagement.

R11.1.4. Memoized selector hot-path budget: a memoized selector with unchanged input returns inside 1ms.

### 11.2 Enforcement

R11.2.1. Performance regression tests run on the reference engagement fixture. Budget breach is a CI failure.

R11.2.2. The reference engagement fixture is checked in. Increasing its size for new tests requires updating the documented budgets.

R11.2.3. The performance reference profile is documented (Node version, machine class). Local runs that diverge from the profile use a calibration multiplier.

---

## 12. Multi-engagement readiness (deferred to v3.1, prepared in v3.0)

R12.1. v3.0 stamps `engagementId` and `ownerId` on every record. v3.1 adds the engagement registry (a top-level collection of engagements indexed by id) and the active-engagement pointer.

R12.2. v3.0 stamps `createdAt` and `updatedAt`. v3.1 surfaces these in the UI.

R12.3. v3.0 declares the `ownerId` field but populates it with `"local-user"`. v3.1 reads the actual user identifier from a stub authentication module. v3.2 wires real authentication.

R12.4. v3.0 does not implement role-based access. v3.1 introduces a role-tagged read filter at the selector layer (the data is unchanged; the selectors take a `viewer` argument). The schema layer does not change.

R12.5. The cross-engagement reporting feature ("all High-urgency gaps in Financial Services / EMEA across every engagement") is a v3.2+ feature. It runs against the backend (section 13), not against client-side localStorage.

---

## 13. Backend migration (v3.2 or later)

### 13.1 Target stack

R13.1. The eventual backend is Postgres plus Drizzle ORM. The decision is justified by:
   - drizzle-zod gives schema-driven DDL generation from the same Zod artifacts the client uses.
   - Cross-engagement reporting requirements demand SQL aggregation.
   - The data model is already relational (P2).

R13.2. A document database is rejected for the backend, despite the simple per-engagement document mapping, because the cross-engagement reporting requirement makes it the wrong tool. This decision is on record so it does not get re-litigated mid-implementation.

### 13.2 Mapping

R13.2.1. Each in-memory collection becomes a Postgres table. `byId` maps to rows; `allIds` ordering is preserved by an `ordering` column or by `createdAt` if order is incidental.

R13.2.2. FK-declared fields become Postgres FK constraints.

R13.2.3. Array-of-FK fields (e.g., `gap.affectedEnvironments`) become join tables (`gap_affected_environments`).

R13.2.4. The engagement document remains the unit of `.canvas` import/export. Backend storage decomposes it on write and recomposes it on read.

### 13.3 API contract

R13.3.1. The first backend API exposes engagement CRUD plus the eventual cross-engagement query endpoints. The Zod schemas double as API request/response schemas (zod-to-openapi).

R13.3.2. Sync model is to be decided in v3.2 planning. Replicache (Aaron Boodman, Rocicorp) is the first reference architecture to evaluate, given the LAN-only and offline-capable deployment requirement. Naive REST with optimistic updates is the fallback.

---

## 14. Testing strategy and test vector scaffold

### 14.1 Test categories

The test suite is organized into the following categories. Every numbered requirement above maps to at least one vector in one of these categories.

1. **Schema property tests.** The Zod schema accepts every valid fixture and rejects every invalid fixture. Generated from the schema itself plus a hand-curated set of edge cases.
2. **FK integrity tests.** Every FK declared in section 4.4 has a vector for: valid reference, dangling reference, optional vs required behavior, array-of-FK behavior.
3. **Schema invariant tests.** G6 (`gap.affectedLayers[0] === gap.layerId`) and any other invariants. Each invariant has a positive and a negative vector.
4. **Migration round-trip tests.** Section 9.2 fixtures, run forward, validated, then run again to verify idempotency.
5. **Selector correctness tests.** Each selector in section 5.2 has a fixture-based test asserting the expected projection for a known engagement.
6. **Selector purity tests.** Two consecutive calls with the same input produce reference-equal outputs (memoization) and structurally equal outputs (correctness).
7. **Manifest generation tests.** The generated manifest matches a checked-in snapshot. Drift fails the build.
8. **Path resolution tests.** Every path in the manifest resolves to a value (or a documented `undefined`) for a known reference engagement. Unknown paths in a `promptTemplate` are rejected at save time.
9. **AI provenance tests.** Provenance wrapper schema enforced; manual edits demote validation status; drift detection flips `validationStatus` to `"stale"`.
10. **Catalog version drift tests.** Engagement stamped against catalog v1 surfaces stale flags after catalog upgrade to v2.
11. **Performance regression tests.** Section 11 budgets, run against the reference engagement.
12. **End-to-end tab render tests.** Each tab loads the reference engagement and renders without console errors.

### 14.2 Cross-cutting relationship coverage (P2)

A dedicated test file covers each row of section 3.7's table:

- Workload-layer instance with `mappedAssetIds` referencing instances in two other environments. Asserts: integrity sweep does not orphan; matrix view shows the workload in its native env; report aggregations count it once.
- Desired instance with `originId` pointing at a current instance in a different environment. Asserts: integrity sweep does not orphan; the migration (if applicable) preserves the cross-env link.
- Gap with `affectedEnvironments` of length 3. Asserts: gap appears in all three env-filtered views; report counts it once globally.
- Gap with `relatedCurrentInstanceIds` and `relatedDesiredInstanceIds` mixing environments. Asserts: linked composition for the gap pulls all instances across envs.

### 14.3 Reference engagements

R14.3.1. Three reference engagements live in `tests/fixtures/`:
   - `minimal.canvas`: smallest possible valid engagement (1 driver, 1 env, 0 instances, 0 gaps).
   - `acme-demo.canvas`: the production demo, 200 instances. Used for performance tests.
   - `cross-cutting.canvas`: 3 envs, hand-crafted to exercise every cross-cutting relationship.

R14.3.2. Reference engagements are stored at the persisted shape (R4.2.1), not the in-memory shape, so they exercise the full load path.

### 14.4 Mocking boundaries

The only modules that may be mocked in tests are:

1. The LLM provider (Anthropic, Gemini, Dell Sales Chat, local LLM). Mocks return canned structured-output responses keyed by prompt hash.
2. The catalog fetcher in v3.1+ (network call). The bundled catalog snapshot is used in tests.
3. `Date.now()` and timestamp generators, where determinism matters.
4. The autosave debouncer's timer, where waiting is impractical.

R14.4.1. Mocking a selector, an action, a schema, a migrator, the integrity sweep, the manifest generator, or any other internal module is forbidden. Tests that need to vary the input vary the engagement fixture, not the code under test.

R14.4.2. A test that passes only because a mock supplied a specific value is rejected. The engagement fixture must be the source of variation.

### 14.5 Anti-cheat checks

R14.5.1. Tests that pass through `if (process.env.NODE_ENV === 'test')` code paths in production code are rejected.

R14.5.2. Code that contains `try { ... } catch { /* swallow */ }` is rejected at review unless the catch logs and rethrows or has a documented business reason.

R14.5.3. Tests that assert on a hardcoded constant returned by a stub instead of a computed value from the fixture are rejected.

R14.5.4. Coverage above 90% is targeted but not the gate. The gate is "every numbered requirement in this directive is covered by at least one vector that fails when the requirement is violated." Coverage is a leading indicator, not the contract.

---

## 15. Out of scope (explicit)

To prevent scope drift during implementation, the following are explicitly out of scope for v3.0:

- Real authentication and session management (deferred to v3.2+).
- Server-side persistence (deferred to v3.2).
- Cross-engagement reporting (deferred to v3.2; requires backend).
- TypeScript migration of the codebase (orthogonal; can happen any time after v3.0 schema layer is in).
- CRDT-based collaboration (not on the multi-year roadmap as specified).
- Event sourcing (rejected: complexity exceeds benefit at this scale).
- A custom in-memory database (rejected: the `{byId, allIds}` shape with selectors is sufficient through 200x our current data size).
- Replacing the in-browser test runner (the existing harness with extended vectors is sufficient).

---

## 16. Glossary

- **Engagement**: the data-layer term for what the UI calls a "session." One workshop's worth of customer data.
- **Entity**: any of the six top-level record types (customer, driver, environment, instance, gap, plus engagement metadata).
- **Selector**: a pure function from engagement to a derived view. Memoized.
- **Manifest**: the generated catalog of bindable paths consumed by the AI skill builder palette.
- **Skill**: a user-composed AI prompt template plus its bindings, optionally constrained by entity kind.
- **Linked composition**: the merged record set that a click-to-run skill receives as context (the selected entity plus its FK-linked records across collections).
- **Provenance wrapper**: the `{ value, provenance }` shape applied to every AI-authored field.
- **Catalog**: a versioned read-only reference dataset (LAYERS, BUSINESS_DRIVERS, DELL_PRODUCT_TAXONOMY, etc.).
- **Integrity sweep**: the pure function that detects and repairs FK and invariant violations on every load.
- **Reference engagement**: one of three checked-in `.canvas` files used for testing.

---

## 17. Open questions (resolve before spec writing)

These are decisions the architect deferred but the spec writer cannot. They must be resolved in the implementation specification, with the resolutions traceable back to whichever stakeholder closed them.

Q1. Reference laptop profile for the performance budget: which exact machine specification? Proposal: pin to a representative Dell Latitude SKU plus Node version.

Q2. Memoization library choice: memoize-one vs reselect vs proxy-memoize. Picker: implementation lead. Constraint: one library across all selectors.

Q3. Skill regression suite extent: which skills are "production-critical" in v3.0? Picker: product owner with input from presales lead.

Q4. Catalog update channel for v3.1: Dell internal endpoint (which one?) or git-based snapshot updates? Picker: Dell IT contact plus product owner.

Q5. Realistic upper bound on real engagement instance count. The 200-instance number is the demo. If real engagements run to thousands, perf budgets in section 11 require recalibration before v3.0 ships.

Q6. Skill template stability: once a user saves a skill referencing path `context.selectedDriver.linkedGaps`, can the manifest evolve underneath them with auto-migration of skills, or are saved skills immutable until manually re-edited? Affects whether path naming is a forever-stable contract.

Q7. The `customer` record stays embedded in the engagement document in v3.0. At backend migration, does it become its own table referenced from engagement, or stay denormalized into the engagement row? Decision driver: whether the same customer recurs across engagements (it usually does in real presales).

---

## 18. Document control

This document is the v3.0 architectural directive. Subsequent versions of the directive (v3.1, v3.2) will be published as separate documents. Implementation against this directive is committed to repo with a reference to this directive's version. Spec writers, test authors, and feature authors include the directive section number in commit messages where the change implements a specific requirement.

End of directive.
