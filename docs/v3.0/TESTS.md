# Dell Discovery Canvas · v3.0 Test Vector Catalogue

**Branch**: `v3.0-data-architecture` · **Authority**: derives from [`SPEC.md`](SPEC.md) §14 + [`MIGRATION.md`](MIGRATION.md) + [`../../data-architecture-directive.md`](../../data-architecture-directive.md) §14.

**Document state**: DRAFT 2026-05-01. Vector catalogue across 17 categories + coverage-gate logic + anti-cheat meta-tests. Every R-number in SPEC.md has ≥1 vector listed here. Vector implementations land in `diagnostics/appSpec.js` Suite N (RED-first first; bodies fill in during the implementation steps).

**Read order**: this document after SPEC.md (the contract) and MIGRATION.md (the transformation rules).

---

## §T0 · How vectors are consumed

Per directive §0.2:
> Test vector step. Claude Code derives test vectors from sections 2 through 14. Coverage target: every numbered requirement in this directive has at least one test vector that fails when the requirement is violated. Vectors that cannot be traced back to a numbered requirement are flagged for review.

Per SPEC §S14.5:
> Coverage target: ≥90% line coverage as leading indicator. **Gate**: every R-number → ≥1 vector that fails when violated.

This document is the **vector catalogue**. Each vector has:
- A stable id (e.g., `V-SCH-1`).
- A SPEC R-number (or directive R-number) it traces back to.
- A one-line description.
- A fixture id (one of the three reference engagements OR a hand-rolled inline fixture).
- A `Notes` column for non-obvious gotchas.

Vectors land in `diagnostics/appSpec.js` Suite **49** (continuing the v2.4.x suite numbering). Suite 49 is **RED-first** at scaffold time: every vector is registered as an `it()` with an empty body that passes trivially. As implementation proceeds (per directive §0.4 ordering), vector bodies become real assertions.

---

## §T1 · Vector id pattern + numbering rules

### T1.1 · Id pattern

```
V-<CATEGORY>-<INDEX>
```

| Category | Prefix | Trace |
|---|---|---|
| Schema property | `V-SCH-*` | SPEC §S2.4 |
| FK integrity | `V-FK-*` | SPEC §S4.5 |
| Schema invariant | `V-INV-*` | SPEC §3 superRefines |
| Migration round-trip | `V-MIG-*` | MIGRATION §M3-§M12 |
| Selector correctness | `V-SEL-*` | SPEC §S5.4 |
| Selector purity | `V-SEL-PURE-*` | SPEC §S5.4 |
| Manifest generation | `V-MFG-*` | SPEC §S7.6 |
| Path resolution | `V-PATH-*` | SPEC §S7.6 |
| AI provenance | `V-PROV-*` | SPEC §S8.5 |
| Catalog drift | `V-DRIFT-*` | SPEC §S8.5 |
| Catalog snapshot | `V-CAT-*` | SPEC §S6.3 |
| Performance regression | `V-PERF-*` | SPEC §S11.3 |
| End-to-end render | `V-E2E-*` | SPEC §S14 |
| Integrity sweep | `V-INT-*` | SPEC §S10.4 |
| Cross-cutting | `V-XCUT-*` | SPEC §3.7 |
| Production-critical | `V-PROD-*` | SPEC §S7.4.3 |
| Multi-engagement | `V-MULTI-*` | SPEC §S12.4 |
| Anti-cheat meta | `V-ANTI-*` | SPEC §S14.5 |

### T1.2 · Numbering rules

- **Append-only**. A vector id, once published in this document, is permanent. Removing a vector requires explicit deprecation (struck-through entry + reason + replacement vector id).
- **No re-use**. If V-SEL-3 is removed, the index 3 is not re-used; the next selector vector is V-SEL-N where N is `max(used) + 1`.
- **Sub-vectors** carry a letter suffix (V-SEL-1a, V-SEL-1b) when one numbered vector decomposes into multiple `it()` bodies. The aggregate count for the §T19 banner target counts each sub-vector.

### T1.3 · Suite registration

The Suite 49 file structure:

```js
// diagnostics/appSpec.js — Suite 49 · v3.0 vector catalogue
describe("49 · v3.0 data architecture rebuild", () => {
  describe("§T2 · Schema property tests (V-SCH)", () => {
    it("V-SCH-1 · EngagementSchema accepts createEmptyEngagement output", () => {
      // RED-first: empty body. Filled at sec 2 implementation.
    });
    // ... etc
  });
  // ... per category
});
```

Vector ids appear verbatim in the `it()` description for grep-ability.

---

## §T2 · V-SCH — Schema property tests

**Coverage**: SPEC §2 + §3 + §S2.4. Every entity Zod schema accepts every documented valid input and rejects every documented invalid input.

**Approximate count**: 70 vectors.

### T2.1 · Per-entity acceptance (V-SCH-{1..7})

| Vector | Schema | Assertion | Fixture |
|---|---|---|---|
| V-SCH-1 | `EngagementMetaSchema` | accepts `createEmptyEngagementMeta()` output | inline |
| V-SCH-2 | `CustomerSchema` | accepts `createEmptyCustomer()` | inline |
| V-SCH-3 | `DriverSchema` | accepts `createEmptyDriver()` | inline |
| V-SCH-4 | `EnvironmentSchema` | accepts `createEmptyEnvironment()` | inline |
| V-SCH-5 | `InstanceSchema` | accepts `createEmptyInstance({state:"current"})` | inline |
| V-SCH-6 | `InstanceSchema` | accepts `createEmptyInstance({state:"desired"})` | inline |
| V-SCH-7 | `GapSchema` | accepts `createEmptyGap()` | inline |

### T2.2 · Per-entity rejection of malformed inputs (V-SCH-{8..40})

| Vector | Schema | Rejected input | Why |
|---|---|---|---|
| V-SCH-8 | `EngagementMetaSchema` | `{ schemaVersion: "2.0" }` | wrong version literal |
| V-SCH-9 | `EngagementMetaSchema` | `{ status: "Foo" }` | not in enum |
| V-SCH-10 | `EngagementMetaSchema` | `{ ownerId: "" }` | min(1) violated |
| V-SCH-11 | `CustomerSchema` | `{ name: "" }` | min(1) violated |
| V-SCH-12 | `CustomerSchema` | `{ segment: "Banking" }` | extra field rejected (no passthrough) — TO RESOLVE: `.strict()` vs `.strip()`. Default `.strict()`. |
| V-SCH-13 | `DriverSchema` | `{ priority: "Critical" }` | not in enum |
| V-SCH-14 | `DriverSchema` | `{ businessDriverId: undefined }` | required FK |
| V-SCH-15 | `DriverSchema` | `{ catalogVersion: "" }` | required |
| V-SCH-16 | `EnvironmentSchema` | `{ envCatalogId: undefined }` | required FK |
| V-SCH-17 | `EnvironmentSchema` | `{ sizeKw: "100" }` | type mismatch (string vs number) |
| V-SCH-18 | `InstanceSchema` | `{ state: "future" }` | not in enum |
| V-SCH-19 | `InstanceSchema` | `{ vendorGroup: "ibm" }` | not in enum |
| V-SCH-20 | `InstanceSchema` | `{ criticality: "Critical" }` | not in enum |
| V-SCH-21 | `InstanceSchema` | `{ state:"current", originId:"i-1" }` | superRefine: originId only on desired |
| V-SCH-22 | `InstanceSchema` | `{ state:"current", priority:"Now" }` | superRefine: priority only on desired |
| V-SCH-23 | `InstanceSchema` | `{ layerId:"compute", mappedAssetIds:["i-1"] }` | superRefine: mappedAssetIds only on workload |
| V-SCH-24 | `GapSchema` | `{ urgency: "Severe" }` | not in enum |
| V-SCH-25 | `GapSchema` | `{ phase: "soon" }` | not in enum |
| V-SCH-26 | `GapSchema` | `{ status: "wip" }` | not in enum |
| V-SCH-27 | `GapSchema` | `{ description: "" }` | min(1) violated |
| V-SCH-28 | `GapSchema` | `{ affectedLayers: [] }` | min(1) violated |
| V-SCH-29 | `GapSchema` | `{ affectedEnvironments: [] }` | min(1) violated |
| V-SCH-30 | `GapSchema` | `{ layerId:"compute", affectedLayers:["storage","compute"] }` | superRefine G6: affectedLayers[0] !== layerId |
| V-SCH-31 | `EngagementSchema` | top-level engagement missing customer | required field |
| V-SCH-32 | `EngagementSchema` | engagement missing engagementMeta | required field |
| V-SCH-33 | `EngagementSchema` | drivers collection missing `byId` | malformed collection |
| V-SCH-34 | `EngagementSchema` | drivers `byId` keys != `allIds` | invariant violated (TO ENCODE in superRefine) |
| V-SCH-35 | (any record) | `id: "not-a-uuid"` | UUID format |
| V-SCH-36 | (any record) | `engagementId: "not-a-uuid"` | UUID format |
| V-SCH-37 | (any record) | `createdAt: "yesterday"` | ISO datetime format |
| V-SCH-38 | (any record) | `updatedAt: "2026-13-32T25:99:99Z"` | invalid date |
| V-SCH-39 | `ProvenanceSchema` | `{ validationStatus: "ok" }` | not in enum |
| V-SCH-40 | `ProvenanceSchema` | `{ catalogVersions: { DELL_PRODUCT_TAXONOMY: 2026 } }` | type mismatch (number vs string) |

### T2.3 · Round-trip property tests (V-SCH-{41..50})

| Vector | Assertion | Fixture |
|---|---|---|
| V-SCH-41 | `cross-cutting.canvas` parses through `EngagementSchema` cleanly | `cross-cutting.canvas` |
| V-SCH-42 | `acme-demo.canvas` parses cleanly | `acme-demo.canvas` |
| V-SCH-43 | `minimal.canvas` parses cleanly | `minimal.canvas` |
| V-SCH-44 | `parse(JSON.stringify(parse(fixture)))` is byte-equivalent (modulo transient) | `cross-cutting.canvas` |
| V-SCH-45 | Save then load round-trips through schema validation cleanly | `acme-demo.canvas` |
| V-SCH-46 | Transient fields (`activeEntity`, `integrityLog`) are stripped on save | `cross-cutting.canvas` |
| V-SCH-47 | Secondary indexes (`instances.byState`) are NOT in persisted shape | `acme-demo.canvas` |
| V-SCH-48 | Secondary indexes ARE rebuilt on load | `acme-demo.canvas` |
| V-SCH-49 | `EngagementSchema` is read by EXACTLY 3 boundaries (load, save, action commit) — meta-test grepping for `EngagementSchema.parse` calls | code under test |
| V-SCH-50 | `EngagementSchema` is NEVER imported by `selectors/*.js` files (lint rule + meta-test) | code under test |

### T2.4 · Per-catalog acceptance (V-SCH-{51..58})

One acceptance vector per catalog snapshot.

| Vector | Catalog |
|---|---|
| V-SCH-51 | `LAYERS` |
| V-SCH-52 | `BUSINESS_DRIVERS` |
| V-SCH-53 | `ENV_CATALOG` |
| V-SCH-54 | `SERVICE_TYPES` |
| V-SCH-55 | `GAP_TYPES` |
| V-SCH-56 | `DISPOSITION_ACTIONS` |
| V-SCH-57 | `CUSTOMER_VERTICALS` |
| V-SCH-58 | `DELL_PRODUCT_TAXONOMY` |

Each vector loads the snapshot file via `loadCatalog(catalogId)` and asserts it parses through `CatalogSchema` (per-catalog extension).

### T2.5 · Sample vector body (V-SCH-21)

```js
it("V-SCH-21 · InstanceSchema rejects originId on state==='current'", () => {
  const inst = createEmptyInstance({ state: "current" });
  inst.originId = "11111111-2222-3333-4444-555555555555";
  const result = InstanceSchema.safeParse(inst);
  assert(result.success === false,
    "current-state instance with originId must be rejected");
  assert(result.error.issues.some(i => i.path[0] === "originId"),
    "rejection must point at originId");
});
```

---

## §T3 · V-FK — FK integrity tests

**Coverage**: SPEC §S4.4 + §S4.5. Every FK declaration tested for valid + dangling + optional vs required + array semantics.

**Approximate count**: 50 vectors. Per-FK declaration: ~4 vectors (valid, dangling-with-optional-null, dangling-with-required-quarantine, array-element-dropped-when-orphan).

### T3.1 · FK declarations to cover

From SPEC §S3.3-§S3.6 + §S4.4:

| Source | Field | Target | Required | Array | Filter |
|---|---|---|---|---|---|
| Driver | `businessDriverId` | catalog:BUSINESS_DRIVERS | yes | no | — |
| Environment | `envCatalogId` | catalog:ENV_CATALOG | yes | no | — |
| Customer | (no FK) | — | — | — | — |
| Instance | `layerId` | catalog:LAYERS | yes | no | — |
| Instance | `environmentId` | environments | yes | no | — |
| Instance | `disposition` | catalog:DISPOSITION_ACTIONS | yes | no | — |
| Instance | `originId` | instances | no | no | state="current" |
| Instance | `mappedAssetIds[]` | instances | no | yes | — |
| Gap | `gapType` | catalog:GAP_TYPES | yes | no | — |
| Gap | `driverId` | drivers | no | no | — |
| Gap | `layerId` | catalog:LAYERS | yes | no | — |
| Gap | `affectedLayers[]` | catalog:LAYERS | yes | yes | — |
| Gap | `affectedEnvironments[]` | environments | yes | yes | — |
| Gap | `relatedCurrentInstanceIds[]` | instances | no | yes | state="current" |
| Gap | `relatedDesiredInstanceIds[]` | instances | no | yes | state="desired" |
| Gap | `services[]` | catalog:SERVICE_TYPES | no | yes | — |

### T3.2 · Per-FK vector pattern (V-FK-{1..50})

For each FK declaration, four sub-vectors:

| Suffix | Setup | Expectation |
|---|---|---|
| `a` | Valid reference (id exists in target collection) | Schema/sweep accepts |
| `b` | Dangling reference + `required: false` + scalar | Sweep nulls field; logs `INT-ORPHAN-OPT` |
| `c` | Dangling reference + `required: true` + scalar | Sweep quarantines record; logs `INT-ORPHAN-REQ` |
| `d` | Dangling element in array-of-FK | Sweep removes from array; logs `INT-ORPHAN-ARR` |

So `instance.environmentId` (required, scalar) generates V-FK-1a + V-FK-1c. `instance.mappedAssetIds[]` (optional, array) generates V-FK-1d. `instance.originId` (optional, scalar, with targetFilter) adds a `e` sub-vector for the filter:

| `e` (filter-violation only) | Reference points at right collection but wrong filter (e.g., originId points at desired-state instance) | Sweep nulls field; logs `INT-FILTER-MISS` |

### T3.3 · Sample vector body (V-FK-1c — instance.environmentId required + dangling)

```js
it("V-FK-1c · dangling required FK quarantines the holding record", () => {
  const eng = makeFixture({
    environments: [],
    instances:    [createInstance({ environmentId: "no-such-env-id" })]
  });
  const { repaired, quarantine } = runIntegritySweep(eng);
  assert(repaired.instances.allIds.length === 0,
    "instance with dangling required FK must be removed from active engagement");
  assert(quarantine.length === 1,
    "instance must be in quarantine");
  assert(quarantine[0].ruleId === "INT-ORPHAN-REQ",
    "quarantine entry must record orphan-required rule");
});
```

### T3.4 · `byId` keyset matches `allIds` (V-FK-{51..56})

Cross-cutting integrity: every collection's `byId` keys must equal its `allIds` set.

| Vector | Collection |
|---|---|
| V-FK-51 | `engagement.drivers` |
| V-FK-52 | `engagement.environments` |
| V-FK-53 | `engagement.instances` |
| V-FK-54 | `engagement.instances.byState.current` ⊆ `instances.allIds` |
| V-FK-55 | `engagement.instances.byState.desired` ⊆ `instances.allIds` |
| V-FK-56 | `engagement.gaps` |

---

## §T4 · V-INV — Schema invariant tests

**Coverage**: SPEC §3 superRefine blocks. Each invariant gets one positive (acceptance) and one negative (rejection) vector.

**Approximate count**: 30 vectors.

| Vector | Invariant | Schema | Polarity |
|---|---|---|---|
| V-INV-1a/b | G6: `gap.affectedLayers[0] === gap.layerId` | GapSchema | positive + negative |
| V-INV-2a/b | `originId` only on `state==="desired"` | InstanceSchema | positive + negative |
| V-INV-3a/b | `priority` only on `state==="desired"` | InstanceSchema | positive + negative |
| V-INV-4a/b | `mappedAssetIds[].length > 0` only on `layerId==="workload"` | InstanceSchema | positive + negative |
| V-INV-5a/b | Driver `priority` ∈ {High, Medium, Low} | DriverSchema | positive + negative |
| V-INV-6a/b | Customer record's `engagementId === engagementMeta.engagementId` | CustomerSchema + cross-validation | positive + negative |
| V-INV-7a/b | `engagementMeta.schemaVersion === "3.0"` literal | EngagementMetaSchema | positive + negative |
| V-INV-8a/b | UUID format on every `id` field | (cross-entity) | positive + negative |
| V-INV-9a/b | ISO datetime on `createdAt` and `updatedAt` | (cross-entity) | positive + negative |
| V-INV-10a/b | `updatedAt >= createdAt` (monotonicity) | (cross-entity) | positive + negative |
| V-INV-11a/b | `instance.byState.current/desired` partition is exhaustive (every instance id is in one) | EngagementSchema (custom) | positive + negative |
| V-INV-12a/b | Provenance wrapper required on AI-authored fields (rejecting plain string in `aiSuggestedDellMapping`) | InstanceSchema | positive + negative |
| V-INV-13a/b | Provenance wrapper required on `aiMappedDellSolutions` | GapSchema | positive + negative |
| V-INV-14a/b | `gap.affectedEnvironments` membership ⊆ `environments.allIds` (FK invariant overlap; runs at integrity sweep time) | (cross-entity) | positive + negative |
| V-INV-15a/b | `instance.originId !== instance.id` (no self-reference) | InstanceSchema | positive + negative |

---

## §T5 · V-MIG — Migration round-trip tests

**Coverage**: MIGRATION §M3-§M12 + SPEC §S9.5. 8 fixtures × forward + idempotency + per-step assertions.

**Approximate count**: 25 vectors.

### T5.1 · Per-fixture forward + validate (V-MIG-{1..8})

| Vector | Fixture | Assertion |
|---|---|---|
| V-MIG-1 | `empty.canvas` | migrates forward; validates clean against EngagementSchema |
| V-MIG-2 | `single-env.canvas` | migrates; 5+5 instances survive; 3 gaps survive; 2 drivers extracted |
| V-MIG-3 | `multi-env.canvas` | migrates; 30 instances; 8 gaps; 4 drivers |
| V-MIG-4 | `cross-env-workload.canvas` | migrates; mappedAssetIds preserved across envs |
| V-MIG-5 | `cross-env-origin.canvas` | migrates; originId preserved across envs |
| V-MIG-6 | `multi-env-gaps.canvas` | migrates; gap.affectedEnvironments.length === 3 preserved |
| V-MIG-7 | `ai-provenanced.canvas` | migrates; 4 plain-string mappedDellSolutions fields → 4 provenance wrappers with `validationStatus: "stale"` |
| V-MIG-8 | `acme-demo.canvas` | migrates; 200 instances; perf: full migration runs in < 200ms calibrated |

### T5.2 · Per-step assertions (V-MIG-S{1..10}-*)

Per MIGRATION §M3-§M12. Each step has 3-5 sub-vectors enumerated in MIGRATION.md.

### T5.3 · Idempotency + determinism (V-MIG-IDEM-* + V-MIG-DETERM-*)

| Vector | Assertion |
|---|---|
| V-MIG-IDEM-1 | `migrate(migrate(v2_0)) deepEquals migrate(v2_0)` for `empty.canvas` |
| V-MIG-IDEM-2 | Same for `multi-env.canvas` |
| V-MIG-IDEM-3 | Same for `acme-demo.canvas` |
| V-MIG-IDEM-4 | `migrate(v3_0)` is a no-op (deepEquals input) |
| V-MIG-DETERM-1 | Two runs of `migrate` on same input + same `ctx.randomSeed` produce byte-equal output |
| V-MIG-DETERM-2 | Generated ids do not collide across all 8 fixtures (V-MIG-COLLIDE-1) |

### T5.4 · Failure handling (V-MIG-FAIL-*)

| Vector | Assertion |
|---|---|
| V-MIG-FAIL-1 | A step that throws produces `MigrationFailure` with the failing step name + error message |
| V-MIG-FAIL-2 | `originalEnvelope` deep-equals the input (preserved) |
| V-MIG-FAIL-3 | No console errors are swallowed during failure |
| V-MIG-FAIL-4 | Recovery flow: try-again with verbose ctx logs each step's input/output |

### T5.5 · Sample vector body (V-MIG-7 — ai-provenanced fixture)

```js
it("V-MIG-7 · ai-provenanced.canvas wraps 4 plain-string mappedDellSolutions fields", () => {
  const v2  = loadFixture("v2-0/ai-provenanced.canvas");
  const ctx = makePipelineContext({ migrationTimestamp: "2026-01-01T00:00:00.000Z", randomSeed: "test" });
  const v3  = migrate_v2_0_to_v3_0(v2, ctx);

  const wrapped = v3.gaps.allIds
    .map(id => v3.gaps.byId[id])
    .filter(g => g.aiMappedDellSolutions);
  assertEqual(wrapped.length, 4, "4 gaps with plain-string mappedDellSolutions become wrapped");

  for (const g of wrapped) {
    assert(g.aiMappedDellSolutions.value.rawLegacy.length > 0,
      "rawLegacy preserves the original v2.4.x string");
    assertEqual(g.aiMappedDellSolutions.provenance.validationStatus, "stale",
      "validationStatus must be 'stale' after migration");
    assertEqual(g.aiMappedDellSolutions.provenance.model, "unknown");
    assertEqual(g.aiMappedDellSolutions.provenance.promptVersion, "legacy:v2.4.x");
    assert(g.mappedDellSolutions === undefined, "legacy plain-string field deleted");
  }
});
```

---

## §T6 · V-SEL + V-SEL-PURE — Selector tests

**Coverage**: SPEC §S5.4. Correctness + purity for each of the 7 required selectors.

**Approximate count**: 70 vectors total.

### T6.1 · Correctness (V-SEL-{1..N})

Each of the 7 selectors gets 3-5 correctness vectors:

| Selector | Correctness vectors | Fixture |
|---|---|---|
| `selectMatrixView` | V-SEL-1a..1e (state=current, state=desired, hidden envs, vendorMix per cell, layer ordering) | `cross-cutting.canvas` |
| `selectGapsKanban` | V-SEL-2a..2c (group by phase + status; closed-gap rollup exclusion in `totalsByStatus.closed`; sort within group) | `multi-env-gaps.canvas` |
| `selectProjects` | V-SEL-3a..3e (deterministic projectId from grouping key; gap → project assignment; unassigned gaps; phase = earliest; mostUrgent = max) | `multi-env-gaps.canvas` |
| `selectVendorMix` | V-SEL-4a..4d (totals + byLayer + byEnvironment + 3 KPI tiles) | `cross-cutting.canvas` |
| `selectHealthSummary` | V-SEL-5a..5d (byLayer scores, overall score, highRiskGaps excludes closed, mostHighRiskLayer correctness) | `cross-cutting.canvas` |
| `selectExecutiveSummaryInputs` | V-SEL-6a..6c (engagementMeta passthrough, drivers.topPriority correctness, catalogVersions populated) | `acme-demo.canvas` |
| `selectLinkedComposition` | V-SEL-7a..7g (driver kind, current/desired instance kinds, gap kind, environment kind, project kind, missing-id graceful) | `cross-cutting.canvas` |

### T6.2 · Purity (V-SEL-PURE-{1..7})

| Vector | Assertion |
|---|---|
| V-SEL-PURE-1 | `selectMatrixView(eng,args) === selectMatrixView(eng,args)` (reference-equal output) |
| V-SEL-PURE-2..7 | Same for other 6 selectors |

```js
it("V-SEL-PURE-1 · selectMatrixView returns reference-equal output for equal inputs", () => {
  const eng = loadReference("cross-cutting.canvas");
  const a = selectMatrixView(eng, { state: "current" });
  const b = selectMatrixView(eng, { state: "current" });
  assert(a === b, "memoization must return ===-equal output for ===-equal inputs");
});
```

### T6.3 · Memoization invalidation (V-SEL-INVAL-{1..7})

| Vector | Assertion |
|---|---|
| V-SEL-INVAL-1 | After action `addInstance(eng, ...)`, `selectMatrixView(newEng) !== selectMatrixView(oldEng)` (memo invalidated by reference change) |
| V-SEL-INVAL-2..7 | Same pattern for other selectors |

### T6.4 · Forbidden-pattern enforcement (V-SEL-FORBID-{1..3})

| Vector | Assertion |
|---|---|
| V-SEL-FORBID-1 | Meta-test: no `selectors/*.js` file imports `localStorage`, `document`, `window`, `fetch` |
| V-SEL-FORBID-2 | Meta-test: no `selectors/*.js` file declares module-scope mutable state outside the memoize wrapper |
| V-SEL-FORBID-3 | Meta-test: no `selectors/*.js` file imports `reselect`, `proxy-memoize`, `lodash.memoize` |

---

## §T7 · V-MFG — Manifest generation

**Coverage**: SPEC §S7.6.

**Approximate count**: 10 vectors.

| Vector | Assertion |
|---|---|
| V-MFG-1 | `generateManifest()` FNV-1a hash + per-kind ownPaths/linkedPaths counts + sessionPath count + entity-kind set match locked snapshot constants in test body (drift gate). Hash + counts chosen over a byte-equal JSON snapshot file because the JSON is ~9 KB and string-extracting through the test harness is unreliable; hash+counts catch every realistic drift. |
| V-MFG-2 | `manifest.sessionPaths` includes `customer.name`, `customer.vertical`, `engagementMeta.engagementDate` |
| V-MFG-3 | `manifest.byEntityKind.driver.ownPaths` includes `context.driver.priority`, `context.driver.outcomes` |
| V-MFG-4 | `manifest.byEntityKind.driver.linkedPaths` includes `context.driver.linkedGaps[*].description` (composition rule applied) |
| V-MFG-5 | `manifest.byEntityKind.gap.linkedPaths` covers `affectedEnvironments`, `relatedCurrentInstanceIds`, `relatedDesiredInstanceIds` |
| V-MFG-6 | Adding a field to `schema/driver.js` without re-running `generateManifest` causes V-MFG-1 to fail (drift detected) |
| V-MFG-7 | `manifest.sessionPaths` does NOT contain entity-internal paths (e.g., `gap.relatedCurrentInstanceIds`) |
| V-MFG-8 | Catalog-resolved chips (e.g., `context.driver.catalog.label`) emitted with `source: "catalog"` |
| V-MFG-9 | Manifest is deterministic: two consecutive `generateManifest()` calls return byte-equal output |
| V-MFG-10 | Manifest entry count matches the SPEC §S7.2.1 expected size table (TO LOCK at implementation time) |

---

## §T8 · V-PATH — Path resolution

**Coverage**: SPEC §S7.3 + §S7.6.

**Approximate count**: 35 vectors.

### T8.1 · Save-time validation (V-PATH-{1..15})

| Vector | Assertion |
|---|---|
| V-PATH-1 | Skill with template `"{{customer.name}}"` saves cleanly (path in sessionPaths) |
| V-PATH-2 | Skill with template `"{{context.driver.priority}}"` + `entityKind: "driver"` saves cleanly |
| V-PATH-3 | Skill with template `"{{nonsense.path}}"` blocks save with structured error |
| V-PATH-4 | Skill `entityKind: "driver"` cannot use `context.gap.*` paths (cross-kind blocked) |
| V-PATH-5 | Save error envelope includes `validPaths` list |
| V-PATH-6..15 | One vector per entity kind × valid path × invalid path |

### T8.2 · Run-time resolution (V-PATH-{16..30})

| Vector | Assertion |
|---|---|
| V-PATH-16 | `resolveTemplate("{{customer.name}}", ctx)` returns customer name |
| V-PATH-17 | `resolveTemplate("{{context.driver.outcomes}}", ctx)` returns driver outcomes from active entity |
| V-PATH-18 | Linked path `{{context.driver.linkedGaps[*].description}}` returns array joined with newlines |
| V-PATH-19 | Catalog path `{{context.driver.catalog.label}}` resolves through catalogSnapshot |
| V-PATH-20 | Undefined value substitutes `[?]` placeholder (per SPEC §S7.3.3) |
| V-PATH-21 | Undefined value logs to `services/skillRuntimeLog.js` with skillId + path + engagementSnapshot |
| V-PATH-22..30 | Edge cases: empty arrays, null FK targets, missing catalog entries |

### T8.3 · Resolver purity (V-PATH-PURE-{1..3})

| Vector | Assertion |
|---|---|
| V-PATH-PURE-1 | `resolveTemplate` is pure (same input → same output across calls) |
| V-PATH-PURE-2 | `resolveTemplate` does NOT mutate `ctx` |
| V-PATH-PURE-3 | `resolveTemplate` is synchronous (no Promise) |

---

## §T9 · V-PROV — AI provenance

**Coverage**: SPEC §S8.5.

**Approximate count**: 15 vectors.

| Vector | Assertion |
|---|---|
| V-PROV-1 | `dell-mapping` skill structured-output rejects out-of-catalog Dell product id |
| V-PROV-2 | User edit on `aiMappedDellSolutions.value` flips `validationStatus` to `"user-edited"` |
| V-PROV-3 | User edit preserves the original provenance fields (model, promptVersion, runId, timestamp) |
| V-PROV-4 | Re-running a skill on a `stale` field replaces the entire envelope; new `validationStatus === "valid"` |
| V-PROV-5 | Plain-string assignment to `instance.aiSuggestedDellMapping` is rejected by `InstanceSchema` |
| V-PROV-6 | Plain-string assignment to `gap.aiMappedDellSolutions` is rejected by `GapSchema` |
| V-PROV-7 | Provenance is set ONLY by `services/skillRunner.js` — meta-test grepping for `provenance:` writes outside skillRunner |
| V-PROV-8 | UI icon for `validationStatus === "valid"` is the default sparkle (no dot) |
| V-PROV-9 | UI icon for `"stale"` carries the amber dot |
| V-PROV-10 | UI icon for `"invalid"` carries the red dot |
| V-PROV-11 | UI icon for `"user-edited"` is the pencil-with-sparkle |
| V-PROV-12 | Tooltip on each icon includes `model`, `skillId`, `timestamp` |
| V-PROV-13 | Catalog-validation retry budget exhausts at 2 retries → `validationStatus === "invalid"` |
| V-PROV-14 | `runId` is a UUID v4 (or v8 deterministic) and unique across runs |
| V-PROV-15 | `timestamp` matches `ctx.runTimestamp` for deterministic test mode |

---

## §T10 · V-DRIFT — Catalog drift

**Coverage**: SPEC §S8.4 + §S6.3.

**Approximate count**: 8 vectors.

| Vector | Assertion |
|---|---|
| V-DRIFT-1 | Engagement stamped against `DELL_PRODUCT_TAXONOMY: "2026.04"` loaded with current `"2026.07"` flips affected `aiMappedDellSolutions.provenance.validationStatus` to `"stale"` |
| V-DRIFT-2 | Multiple drift detections (same engagement, multiple AI fields, multiple catalog mismatches) all flagged |
| V-DRIFT-3 | `validationStatus === "user-edited"` is preserved through drift (NOT downgraded to stale) |
| V-DRIFT-4 | `validationStatus === "invalid"` is preserved (NOT changed to stale) |
| V-DRIFT-5 | Drift count surfaces on engagement-load screen as a non-blocking banner |
| V-DRIFT-6 | Drift NEVER rewrites `value` field (only `validationStatus`) |
| V-DRIFT-7 | Drift detector is pure (same engagement + catalog → same flips) |
| V-DRIFT-8 | Drift detector handles `model: "unknown"` records (from migration step 9) without errors |

---

## §T11 · V-CAT — Catalog snapshot

**Coverage**: SPEC §S6.3.

**Approximate count**: 12 vectors.

| Vector | Assertion |
|---|---|
| V-CAT-1 | `loadCatalog("LAYERS")` returns a 6-entry catalog parsed through `LayerCatalogSchema` |
| V-CAT-2..7 | Same for BUSINESS_DRIVERS (8), ENV_CATALOG (8), SERVICE_TYPES (10), GAP_TYPES (5), DISPOSITION_ACTIONS (7), CUSTOMER_VERTICALS (alphabetised) |
| V-CAT-DELL-1 | `DELL_PRODUCT_TAXONOMY` does NOT contain entries with id "boomi", "secureworks-taegis", "vxrail", "smartfabric-director" |
| V-CAT-DELL-2 | `DELL_PRODUCT_TAXONOMY` DOES contain entries with id "smartfabric-manager", "dell-private-cloud", "dell-automation-platform", "powerflex" |
| V-CAT-DELL-3 | `DELL_PRODUCT_TAXONOMY` "cloudiq" entry has `umbrella: "Dell APEX AIOps"` |
| V-CAT-VER-1 | Every catalog snapshot has `catalogVersion` matching `/^\d{4}\.\d{2}$/` |
| V-CAT-VER-2 | All v3.0 catalog snapshots ship with `catalogVersion === "2026.04"` |

---

## §T12 · V-PERF — Performance regression

**Coverage**: SPEC §S11.3.

**Approximate count**: 10 vectors.

| Vector | Limit (calibrated) | Fixture |
|---|---|---|
| V-PERF-1 | `selectMatrixView` cold start < 50ms | `acme-demo.canvas` |
| V-PERF-2 | `selectMatrixView` hot path (memoized) < 1ms | `acme-demo.canvas` |
| V-PERF-3 | All 7 selectors cold-start total < 300ms | `acme-demo.canvas` |
| V-PERF-4 | Full round-trip (load → migrate → integrity → hydrate → Tab 2 render) < 500ms | `acme-demo.canvas` |
| V-PERF-5 | Single tab render after engagement loaded < 100ms | `acme-demo.canvas` |
| V-PERF-6 | Integrity sweep on `acme-demo.canvas` < 100ms | `acme-demo.canvas` |
| V-PERF-7 | `migrate_v2_0_to_v3_0` on v2.0 acme-demo equivalent < 200ms | v2-0/`acme-demo.canvas` |
| V-PERF-8 | `generateManifest` < 50ms (cold) | (no fixture) |
| V-PERF-9 | `validateSkillSave` for a 200-character template < 5ms | (inline) |
| V-PERF-SCALE-1 | `acme-demo.canvas` has exactly 200 instances (regression guard against silent demo growth) | `acme-demo.canvas` |

All limits are multiplied by the calibration multiplier per SPEC §S11.2.

---

## §T13 · V-E2E — End-to-end tab render

**Coverage**: SPEC §14.1 (category 12).

**Approximate count**: 12 vectors.

| Vector | Assertion |
|---|---|
| V-E2E-1 | Loading `acme-demo.canvas` renders Tab 1 (Context) without console errors |
| V-E2E-2 | Loading `acme-demo.canvas` renders Tab 2 (Architecture) without console errors |
| V-E2E-3 | Tab 3 (Heatmap) renders cleanly |
| V-E2E-4 | Tab 4 (Gaps) renders cleanly |
| V-E2E-5 | Tab 5 (Reporting) renders cleanly |
| V-E2E-6 | Engagement Save → Reload round-trip preserves shape |
| V-E2E-7 | Click any driver tile → `engagement.activeEntity` updates with `kind: "driver"` |
| V-E2E-8 | Click outside any entity → `activeEntity` becomes null |
| V-E2E-9 | Open AI Assist (Ctrl+K) → overlay renders + skill list populated |
| V-E2E-10 | Run a session-wide skill → result panel renders without errors |
| V-E2E-11 | Run a click-to-run skill against the active entity → result panel renders |
| V-E2E-12 | Loading a v2.0 fixture triggers migration → migrated engagement renders Tab 1 cleanly |

---

## §T14 · V-INT — Integrity sweep

**Coverage**: SPEC §S10.4.

**Approximate count**: 25 vectors.

### T14.1 · One vector per repair rule (V-INT-{1..10})

| Vector | Rule | Setup | Expected log |
|---|---|---|---|
| V-INT-1 | INT-ORPHAN-OPT | gap.driverId points at deleted driver | field nulled; log entry |
| V-INT-2 | INT-ORPHAN-ARR | gap.affectedEnvironments[] contains deleted env | element removed; log entry |
| V-INT-3 | INT-ORPHAN-REQ | instance.environmentId points at deleted env | record quarantined; log entry |
| V-INT-4 | INT-FILTER-MISS | instance.originId points at desired-state instance (filter `state="current"`) | field nulled; log entry |
| V-INT-5 | INT-G6-REPAIR | gap.affectedLayers does NOT have layerId at index 0 | mechanical reorder; log entry |
| V-INT-6 | INT-MAP-NONWL | non-workload instance has populated mappedAssetIds | array emptied; log entry |
| V-INT-7 | INT-ORIGIN-CUR | current-state instance has originId | nulled; log entry |
| V-INT-8 | INT-PRI-CUR | current-state instance has priority | nulled; log entry |
| V-INT-9 | INT-EID-STAMP | record has `engagementId` mismatch | stamped; log entry |
| V-INT-10 | INT-AI-DRIFT | AI provenance catalog version mismatch | validationStatus → stale; log entry |

### T14.2 · Sweep contract (V-INT-{11..20})

| Vector | Assertion |
|---|---|
| V-INT-11 | Sweep is pure: `runIntegritySweep(eng) === runIntegritySweep(eng)` (deepEqual repaired output) |
| V-INT-12 | Sweep runs AFTER migration in load harness |
| V-INT-13 | Sweep runs BEFORE UI hydration |
| V-INT-14 | Sweep NEVER creates new entities (V-INT-NOCREATE-1) |
| V-INT-15 | Sweep NEVER edits user-authored content fields (V-INT-NOEDIT-1) — label, notes, description, outcomes |
| V-INT-16 | Quarantined records are NOT in `engagement.{drivers, environments, instances, gaps}` collections |
| V-INT-17 | Quarantined records ARE in `engagement.integrityLog.quarantine` |
| V-INT-18 | `integrityLog` is stripped on save (V-INT-TRANSIENT-1) |
| V-INT-19 | `quarantine` is stripped on save (V-INT-TRANSIENT-2) |
| V-INT-20 | Repair log entries have `ruleId`, `recordKind`, `recordId`, `field`, `before`, `after`, `timestamp` (V-INT-LOGSHAPE-1) |

### T14.3 · Forbidden behaviors (V-INT-FORBID-{1..5})

| Vector | Assertion |
|---|---|
| V-INT-FORBID-1 | Sweep does not call `localStorage.*` |
| V-INT-FORBID-2 | Sweep does not call `document.*` or `window.*` |
| V-INT-FORBID-3 | Sweep does not call `fetch` or any network |
| V-INT-FORBID-4 | Sweep does not write to `console.error` for repaired violations (only `console.info` for the log summary) |
| V-INT-FORBID-5 | Sweep does not throw on any input shape that passes EngagementSchema |

---

## §T15 · V-XCUT — Cross-cutting relationships

**Coverage**: SPEC §3.7 + §S14.2.

**Approximate count**: 5 vectors.

| Vector | Relationship | Fixture | Assertion |
|---|---|---|---|
| V-XCUT-1 | Workload `mappedAssetIds` across 2+ envs | `cross-env-workload.canvas` | (a) integrity sweep doesn't orphan; (b) `selectMatrixView({state:"current"})` shows workload in native env; (c) `selectVendorMix()` counts the workload once globally (not multi-counted) |
| V-XCUT-2 | Desired `originId` cross-env | `cross-env-origin.canvas` | (a) integrity sweep doesn't orphan; (b) `selectLinkedComposition({kind:"desiredInstance",id})` returns the cross-env current instance |
| V-XCUT-3 | Gap with `affectedEnvironments.length === 3` | `multi-env-gaps.canvas` | (a) gap appears in env-filtered selectors for all 3 envs; (b) `selectHealthSummary()` counts gap once globally |
| V-XCUT-4 | Gap `relatedCurrentInstanceIds` mixing envs | `multi-env-gaps.canvas` | linked composition pulls all current instances regardless of env |
| V-XCUT-5 | Gap `relatedDesiredInstanceIds` mixing envs | `multi-env-gaps.canvas` | linked composition pulls all desired instances regardless of env |

### T15.1 · Sample vector body (V-XCUT-1)

```js
it("V-XCUT-1 · workload mappedAssetIds across 2+ envs survives sweep + matrix + vendor mix", () => {
  const eng = loadReference("cross-env-workload.canvas");
  // (a) integrity sweep doesn't orphan
  const swept = runIntegritySweep(eng);
  const workload = Object.values(swept.repaired.instances.byId).find(i => i.layerId === "workload");
  assert(workload, "workload instance must survive sweep");
  assert(workload.mappedAssetIds.length === 2,
    "both cross-env mapped assets must survive");
  // (b) matrix view shows workload in its native env
  const matrix = selectMatrixView(swept.repaired, { state: "current" });
  const nativeEnvId = workload.environmentId;
  const cell = matrix.cells[nativeEnvId][workload.layerId];
  assert(cell.instanceIds.includes(workload.id), "workload appears in its native (env, layer) cell");
  // (c) vendor mix counts once globally
  const vm = selectVendorMix(swept.repaired);
  assertEqual(vm.totals.total, swept.repaired.instances.allIds.length,
    "vendor mix total === instance count (no double-counting)");
});
```

---

## §T16 · V-PROD — Production-critical regression suite

**Coverage**: SPEC §S7.4.3 + `OPEN_QUESTIONS_RESOLVED.md` Q3.

**Approximate count**: 11 vectors.

### T16.1 · `dell-mapping` (strict) — V-PROD-{1..5}

| Vector | Assertion |
|---|---|
| V-PROD-1 | Output validates against `DellSolutionListSchema` |
| V-PROD-2 | Every entry id is in `DELL_PRODUCT_TAXONOMY.entries[].id` |
| V-PROD-3 | NO entry id matches "boomi", "secureworks-taegis", "vxrail", "smartfabric-director" |
| V-PROD-4 | Provenance is fully populated: model, promptVersion, skillId, runId, timestamp, catalogVersions, validationStatus="valid" |
| V-PROD-5 | Round-trip through save+load: byte-equivalent envelope |

### T16.2 · `executive-summary` (smoke) — V-PROD-{6..8}

| Vector | Assertion |
|---|---|
| V-PROD-6 | Output is non-empty string of length ≥ 100 |
| V-PROD-7 | Output contains `customer.name` (verbatim or close-match) |
| V-PROD-8 | Provenance stamped (validationStatus="valid", catalogVersions populated) |

### T16.3 · `care-builder` (strict) — V-PROD-{9..11}

| Vector | Assertion |
|---|---|
| V-PROD-9 | Output is a save-able skill record (passes `SkillSchema` parse) |
| V-PROD-10 | Output round-trips through `validateSkillSave` without errors |
| V-PROD-11 | Output's `bindings[]` reference paths that all exist in the manifest |

### T16.4 · Determinism

All V-PROD vectors use mocked LLM responses keyed by prompt hash (per SPEC §S14.4 boundary 1). Deterministic.

---

## §T17 · V-MULTI — Multi-engagement readiness

**Coverage**: SPEC §S12.4.

**Approximate count**: 8 vectors.

| Vector | Assertion |
|---|---|
| V-MULTI-1 | Every record post-action has `engagementId === engagementMeta.engagementId` |
| V-MULTI-2 | `engagementMeta.ownerId` defaults to `"local-user"` when not set |
| V-MULTI-3 | `record.updatedAt > record.createdAt` after a single update |
| V-MULTI-4 | `record.updatedAt === record.createdAt` initially |
| V-MULTI-5 | Action `addInstance` stamps `engagementId` from engagement context (not from caller arg) |
| V-MULTI-6 | Saved `.canvas` includes `ownerId` |
| V-MULTI-7 | Saved `.canvas` includes `createdAt` + `updatedAt` on every record |
| V-MULTI-8 | Loading a v2.0 fixture without `ownerId` migrates to `"local-user"` (cross-ref V-MIG-S3-1) |

---

## §T18 · V-ANTI — Anti-cheat meta-tests

**Coverage**: SPEC §S14.5. These vectors run against the **test source code** + **production source code**, not against runtime behavior. They enforce the "real-execution-only" contract.

**Approximate count**: 5 vectors.

| Vector | Assertion |
|---|---|
| V-ANTI-1 | Source grep: no `process.env.NODE_ENV === 'test'` (or equivalent) in `core/`, `state/`, `services/`, `selectors/`, `interactions/`, `ui/` |
| V-ANTI-2 | Source grep: every `try/catch` block in production code either rethrows OR logs (no empty catches; no swallowed errors) |
| V-ANTI-3 | Test source grep: no `assert(stubReturnValue === stubReturnValue)` patterns (constant-from-stub assertion) |
| V-ANTI-4 | Manifest grep: every R-number in SPEC.md has at least one matching vector id in this document |
| V-ANTI-5 | Test source grep: no internal modules (selectors, actions, schemas, migrators, integrity sweep, manifest generator, path resolver) are mocked outside the §S14.4 closed list |

### T18.1 · V-ANTI-4 implementation sketch

```js
it("V-ANTI-4 · every R-number in SPEC.md has >=1 matching vector id in TESTS.md", () => {
  const specText = readFileSync("docs/v3.0/SPEC.md", "utf-8");
  const testsText = readFileSync("docs/v3.0/TESTS.md", "utf-8");
  // Pull all R-numbers like "R5.1.2" or "S5.1.2" or "R11.1.1"
  const rNumbers = [...specText.matchAll(/\b[RS]\d+\.\d+(?:\.\d+)?[a-z]?\b/g)].map(m => m[0]);
  const uniqueR = new Set(rNumbers);
  // Pull all vector ids
  const vectors = [...testsText.matchAll(/\bV-[A-Z]+-[A-Z0-9-]+\b/g)].map(m => m[0]);
  const uniqueV = new Set(vectors);
  // For each R-number, assert at least one vector references it (via cross-reference table).
  // The TESTS.md "Coverage" line per category is the index.
  // Implementation detail: this is a meta-test scaffold; full enforcement
  // requires the Coverage lines in each category to be machine-readable.
  // TO RESOLVE: Coverage table format vs free-text reference.
  assert(uniqueV.size >= 350, "vector count must be >= 350 (banner target floor)");
  assert(uniqueR.size >= 100, "R-number count must be >= 100 (SPEC scope minimum)");
});
```

**TO RESOLVE**: V-ANTI-4 fully strict implementation requires a machine-readable "R-number → vector" cross-reference table (e.g., a YAML index). v3.0 ships V-ANTI-4 as a smoke check (count floors); v3.1 may upgrade to per-R-number enforcement.

---

## §T19 · V-ADP — v3.0 → v2.x consumption adapter

**Coverage**: SPEC §S19.

**Approximate count**: 10 vectors.

| Vector | Assertion |
|---|---|
| V-ADP-1 | `adaptContextView(eng)` is a pure function: same engagement reference → same output reference (downstream of §S5 selector memoization per Q2 resolution) |
| V-ADP-2 | Empty engagement (`createEmptyEngagement()`) renders all 6 view shapes (`adapt{Context,Architecture,Heatmap,Workload,Gaps,Reporting}View`) without throwing |
| V-ADP-3 | Reference engagement → `adaptContextView` returns shape `{customer, drivers}` matching the v2.x ContextView contract (`customer.name`, `customer.vertical`, `customer.region`, `drivers[].priority`, `drivers[].outcomes`) |
| V-ADP-4 | Reference engagement → `adaptArchitectureView` returns shape consumed by today's MatrixView (env × layer cells; each cell `{instanceIds, layerId, environmentId}`); per-cell instance order matches §S5.1 `selectMatrixView` |
| V-ADP-5 | Reference engagement → `adaptHeatmapView` returns the v2.x heatmap shape (per-cell counts + health rollups derived from architecture data; identical to today's MatrixView heat layer) |
| V-ADP-6 | Reference engagement → `adaptWorkloadView` returns workload mapping with `mappedAssetIds[]` resolved to instance summaries spanning environments (cross-ref V-XCUT-1: workload counted once globally; rendered in native env) |
| V-ADP-7 | Reference engagement → `adaptGapsView` returns gaps grouped per today's GapsBoard with `affectedEnvironments[]`, `relatedCurrentInstanceIds[]`, `relatedDesiredInstanceIds[]`, `services[]`, `projectId`, `urgency` all preserved (cross-ref V-XCUT-3..5) |
| V-ADP-8 | Reference engagement → `adaptReportingView` returns aggregations consumed by SummaryHealthView (per-env health + per-driver gap counts + global counts); a gap with `affectedEnvironments.length === 3` is counted once globally (cross-ref V-XCUT-3) |
| V-ADP-9 | `commitContextEdit({customer: {name: "Acme"}})` updates `engagement.customer.name === "Acme"` AND emits exactly once to active subscribers; engagement reference changes (commit produces new immutable engagement) |
| V-ADP-10 | `loadCanvasV3(json)` → `setActiveEngagement(eng)` → all 6 `adapt<View>View(eng)` succeed without errors against an engagement freshly through §S9 migrator + §S10 integrity sweep (round-trip integration) |

### T19.1 · Sample vector body (V-ADP-9)

```js
it("V-ADP-9 · commitContextEdit updates customer.name and emits to subscribers", () => {
  const eng = createEmptyEngagement();
  setActiveEngagement(eng);
  let emittedCount = 0;
  let lastEmitted = null;
  const unsub = subscribeActiveEngagement(e => { emittedCount++; lastEmitted = e; });

  commitContextEdit({ customer: { name: "Acme Financial Services" } });

  const after = getActiveEngagement();
  assertEqual(after.customer.name, "Acme Financial Services",
    "customer.name reflects the commit");
  assertEqual(emittedCount, 1, "subscribers notified exactly once per commit");
  assert(lastEmitted === after, "subscriber received the post-commit engagement");
  assert(lastEmitted !== eng, "commit produced a new engagement reference (immutable update)");
  unsub();
});
```

### T19.2 · Sample vector body (V-ADP-1)

```js
it("V-ADP-1 · adaptContextView is identity-stable on unchanged engagement reference", () => {
  const eng = loadReference("acme-financial.canvas");
  const a = adaptContextView(eng);
  const b = adaptContextView(eng);
  assert(a === b, "same engagement reference → same output reference (memoization)");
});
```

### T19.3 · Forbidden test patterns

- **F19T.1** · Stubbing `state/v3Adapter.js` internals — purity must be observable through the pure-function interface; do not mock `subscribeActiveEngagement` or `commitAction` (cross-ref §V-ANTI-5).
- **F19T.2** · Constructing engagement objects by hand bypassing `createEmptyEngagement` / `loadCanvasV3` (cross-ref §V-SCH forbidden patterns).
- **F19T.3** · Asserting V-ADP-1 purity via `JSON.stringify(a) === JSON.stringify(b)` — that hides reference-identity bugs that the §S5 memoization contract forbids; assert `a === b` directly.
- **F19T.4** · Asserting view-shape correctness against literal expected objects (brittle); assert specific keys + cross-cutting invariants (V-ADP-6 / V-ADP-8) instead.

---

## §T20 · V-CHAT — Canvas Chat (context-aware AI assistant)

**Coverage**: SPEC §S20.

**Approximate count**: 12 vectors.

| Vector | Assertion |
|---|---|
| V-CHAT-1 | `buildSystemPrompt({engagement, manifest, catalogs})` returns the 5-layer structure with the expected section markers (role / data-model / manifest / engagement / views) in order |
| V-CHAT-2 | Layer-4 token-budget switch: small engagement (≤20 instances + ≤20 gaps + ≤5 drivers) → full inline; larger engagement → counts-only summary (~500 tokens) |
| V-CHAT-3 | `CHAT_TOOLS` enumerates one entry per §S5 selector (`selectMatrixView`, `selectGapsKanban`, `selectVendorMix`, `selectHealthSummary`, `selectExecutiveSummaryInputs`, `selectLinkedComposition`, `selectProjects`); each entry's `name` matches the selector function name; each entry's `invoke(eng, args)` returns `===`-equal output to calling the selector directly |
| V-CHAT-4 | Mock provider: `streamChat({engagement, transcript:[], userMessage:"hi", providerConfig:{providerKey:"mock"}, onToken, onComplete})` against `createMockChatProvider({responses:["hello there"]})` calls `onToken` once per token in expected order, then `onComplete` with the full text |
| V-CHAT-5 | Tool-call round-trip with mock: provider emits `tool_use {name:"selectGapsKanban"}` → dispatcher invokes `selectGapsKanban(eng)` → tool_result fed back as a user-role message → provider emits final text → `onComplete({response, provenance})` |
| V-CHAT-6 | `state/chatMemory.js` round-trip: `saveTranscript(engId, t)` → `loadTranscript(engId)` returns deep-equal transcript |
| V-CHAT-7 | `summarizeIfNeeded(transcript)` against a transcript of length > CHAT_TRANSCRIPT_WINDOW collapses older turns into one `{role:"system", content:"PRIOR CONTEXT: ..."}` message; idempotent on re-run (running it twice does not double-summarize) |
| V-CHAT-8 | `clearTranscript(engId)` removes the localStorage key; `loadTranscript(engId)` after clear returns `{messages:[], summary:null}` |
| V-CHAT-9 | V-ANTI-CHAT-1: source grep — none of `services/chatService.js`, `services/systemPromptAssembler.js`, `services/chatTools.js`, `state/chatMemory.js`, `ui/views/CanvasChatOverlay.js` import from `state/collections/` (no §S4 action calls in chat layer; read-only v1 invariant) |
| V-CHAT-10 | Empty engagement: `streamChat` against `createEmptyEngagement()` does not throw; the `buildSystemPrompt` output for an empty engagement contains the literal phrase "the canvas is empty" or equivalent (so the model is grounded to say so) |
| V-CHAT-11 | `providerCapabilities("anthropic").caching === true`; `providerCapabilities("openai-compatible").caching === false`; both return `streaming === true` and `toolUse === true`; `providerCapabilities("mock")` returns `{streaming: true, toolUse: true, caching: false}` for deterministic test paths |
| V-CHAT-12 | `buildSystemPrompt({..., providerKind:"anthropic"})` emits `cache_control: {type:"ephemeral"}` on the prefix block (layers 1+2+3+5-descriptions); `buildSystemPrompt({..., providerKind:"openai-compatible"})` produces the same content WITHOUT the cache_control marker |

### T20.1 · Sample vector body (V-CHAT-3 · selector ↔ tool consistency)

```js
it("V-CHAT-3 · CHAT_TOOLS has one entry per §S5 selector with matching invoke", () => {
  const SELECTORS = {
    selectMatrixView, selectGapsKanban, selectVendorMix, selectHealthSummary,
    selectExecutiveSummaryInputs, selectLinkedComposition, selectProjects
  };
  const toolNames = CHAT_TOOLS.map(t => t.name).sort();
  assertEqual(toolNames.join(","), Object.keys(SELECTORS).sort().join(","),
    "CHAT_TOOLS names must match §S5 selector function names exactly");

  const eng = loadReference("acme-financial.canvas");
  for (const tool of CHAT_TOOLS) {
    const direct = SELECTORS[tool.name](eng);
    const viaTool = tool.invoke(eng, {});
    assert(direct === viaTool || JSON.stringify(direct) === JSON.stringify(viaTool),
      "tool dispatcher for " + tool.name + " must return selector output verbatim");
  }
});
```

### T20.2 · Sample vector body (V-CHAT-5 · tool-call round-trip with mock)

```js
it("V-CHAT-5 · tool-call round-trip: question → tool_use → resolve → tool_result → final text", async () => {
  const eng = loadReference("acme-financial.canvas");
  setActiveEngagement(eng);

  // Mock provider script: first response is a tool_use; second response is final text.
  const provider = createMockChatProvider({
    responses: [
      { kind: "tool_use", name: "selectGapsKanban", input: {} },
      { kind: "text",     text: "There are 7 open gaps with High urgency." }
    ]
  });

  const tokens = [];
  const result = await streamChat({
    engagement:     eng,
    transcript:     [],
    userMessage:    "How many High-urgency gaps are open?",
    providerConfig: { providerKey: "mock" },
    provider,
    onToken:        t => tokens.push(t),
  });

  assertEqual(provider.callsRecorded.length, 2, "exactly 2 provider calls (initial + post-tool-result)");
  assertEqual(provider.callsRecorded[1].messages.find(m => m.role === "user" && m.content.includes("tool_result")) != null,
    true, "second call carries the tool_result back to the provider");
  assert(result.response.includes("7 open gaps"), "final text from second call surfaces");
});
```

### T20.3 · Forbidden test patterns

- **F20T.1** · Stubbing `services/systemPromptAssembler.js` internals; build prompts end-to-end against deterministic mock engagement + manifest fixtures.
- **F20T.2** · Comparing assembled prompt text byte-for-byte (brittle as wording evolves); use structural assertions (sections present, cache markers in expected positions, tool-defs match selectors).
- **F20T.3** · Asserting LLM output semantics ("the model should say X"). We can't test LLM output. Only test the assembler / dispatcher / memory layers; provider response is mocked deterministically.
- **F20T.4** · Mocking `state/v3EngagementStore.js` to bypass the bridge; tests use `setActiveEngagement(loadReference(...))` to drive the real store.

---

## §T21 · V-DEMO — v3-native demo engagement

**Coverage**: SPEC §S21.

**Approximate count**: 7 vectors.

| Vector | Assertion |
|---|---|
| V-DEMO-1 | `loadV3Demo()` returns an object that passes `EngagementSchema.safeParse(...)` strict (success === true; issues === []) |
| V-DEMO-2 | The demo module performs `EngagementSchema.parse(...)` at module load and would throw if drift is introduced (verified by inspecting source: at least one parse call at top-level scope, not inside the exported function) |
| V-DEMO-3 | Demo content shape: `meta.isDemo === true`, customer.name + customer.vertical + customer.region populated, ≥2 drivers each with `businessDriverId` resolving in `BUSINESS_DRIVERS` catalog, ≥2 environments each with `envCatalogId` resolving in `ENV_CATALOG` catalog |
| V-DEMO-4 | Cross-cutting features per S3.7: at least one workload-layer instance with `mappedAssetIds[]` referencing assets in a DIFFERENT environment AND at least one desired instance with non-null `originId` referencing a current instance |
| V-DEMO-5 | Gap diversity: at least one ops-typed gap with non-empty `services[]`, at least one gap with `affectedEnvironments.length >= 2` (multi-env), every FK reference (`relatedCurrentInstanceIds`, `relatedDesiredInstanceIds`, `affectedEnvironments`, `driverId`) resolves to an entity that exists in the demo |
| V-DEMO-6 | Provenance demonstration: at least one AI-authored field carries the full `{value, provenance:{model, promptVersion, skillId, runId, timestamp, catalogVersions, validationStatus}}` wrapper per §S8 |
| V-DEMO-7 | Determinism: `loadV3Demo() === loadV3Demo()` (referential identity; module caches the constructed engagement) |

### T21.1 · Sample vector body (V-DEMO-1)

```js
it("V-DEMO-1 · loadV3Demo() passes EngagementSchema strict parse", () => {
  const eng = loadV3Demo();
  const result = EngagementSchema.safeParse(eng);
  assert(result.success === true,
    "v3 demo must pass strict schema; issues: " +
    (result.success ? "" : JSON.stringify(result.error.issues.slice(0, 5))));
});
```

### T21.2 · Sample vector body (V-DEMO-4)

```js
it("V-DEMO-4 · cross-cutting workload mappedAssetIds + desired originId both present", () => {
  const eng = loadV3Demo();
  // Workload with cross-env mappedAssetIds
  const workloadCrossEnv = eng.instances.allIds
    .map(id => eng.instances.byId[id])
    .find(i => i.layerId === "workload" && Array.isArray(i.mappedAssetIds) && i.mappedAssetIds.length > 0
       && i.mappedAssetIds.some(aid => {
            const asset = eng.instances.byId[aid];
            return asset && asset.environmentId !== i.environmentId;
          }));
  assert(workloadCrossEnv,
    "demo must include at least one workload with mappedAssetIds spanning environments (cross-ref V-XCUT-1)");

  // Desired with originId
  const desiredWithOrigin = eng.instances.allIds
    .map(id => eng.instances.byId[id])
    .find(i => i.state === "desired" && i.originId &&
      eng.instances.byId[i.originId] && eng.instances.byId[i.originId].state === "current");
  assert(desiredWithOrigin,
    "demo must include at least one desired instance whose originId resolves to a current instance");
});
```

### T21.3 · Forbidden test patterns

- **F21T.1** · Asserting specific demo entity ids by hand-coded UUID strings — IDs are deterministic but the demo content may evolve; assert by semantic shape (e.g. "find the workload with X label") not literal id equality.
- **F21T.2** · Mocking `loadV3Demo()` to return alternate engagements; tests drive the real demo end-to-end.

---

## §T22 · V-MOCK — Mock providers as production services

**Coverage**: SPEC §S22.

**Approximate count**: 3 vectors.

| Vector | Assertion |
|---|---|
| V-MOCK-1 | `services/mockChatProvider.js` is fetchable from the production path AND exports `createMockChatProvider`; the export's behavior matches the V-CHAT-4 contract (yields `{kind:"text",token}` events for scripted text responses) |
| V-MOCK-2 | `services/mockLLMProvider.js` is fetchable AND exports `createMockLLMProvider`; behavior matches the V-PROD test contract |
| V-MOCK-3 | Both providers are deterministic — calling stream/complete with identical args yields identical event sequences (no clocks, no randomness without explicit seed) |

### T22.1 · Sample vector body (V-MOCK-1)

```js
it("V-MOCK-1 · services/mockChatProvider exports createMockChatProvider", async () => {
  const mod = await import("/services/mockChatProvider.js");
  assert(typeof mod.createMockChatProvider === "function",
    "services/mockChatProvider.js must export createMockChatProvider");
  const p = mod.createMockChatProvider({ responses: [{ kind: "text", text: "hi" }] });
  const tokens = [];
  for await (const evt of p.stream({ messages: [], tools: [] })) {
    if (evt.kind === "text") tokens.push(evt.token);
  }
  assert(tokens.join("").length > 0, "mock provider yields at least one text token");
});
```

### T22.2 · Forbidden test patterns

- **F22T.1** · Importing the providers from `tests/mocks/...` in production-shape tests — V-MOCK probes production paths to enforce S22.

---

## §T23 · V-ANTI-RUN — Production code does not import from tests/

**Coverage**: SPEC §S23. Generalizes V-ANTI-5 (internal-module mocking forbidden) into a structural lint.

**Approximate count**: 1 vector (machine-generated; expands as production surfaces grow).

| Vector | Assertion |
|---|---|
| V-ANTI-RUN-1 | Source-grep over every production module under `services/`, `state/`, `core/`, `ui/`, `selectors/`, `interactions/`, `migrations/`, `schema/` finds zero `from "../tests/..."` or `from '../../tests/...'` imports. Tests + diagnostics are exempt (they ARE tests). |

### T23.1 · Sample vector body (V-ANTI-RUN-1)

```js
it("V-ANTI-RUN-1 · production code does not import from tests/ at runtime (per SPEC §S23)", async () => {
  // Curated list of v3 production modules — extend as new ones land.
  const FILES = [
    "core/v3DemoEngagement.js",
    "services/chatService.js",
    "services/systemPromptAssembler.js",
    "services/chatTools.js",
    "services/mockChatProvider.js",
    "services/mockLLMProvider.js",
    "services/realChatProvider.js",
    "services/realLLMProvider.js",
    "services/skillRunner.js",
    "services/manifestGenerator.js",
    "services/skillSaveValidator.js",
    "services/canvasFile.js",
    "state/chatMemory.js",
    "state/v3Adapter.js",
    "state/v3EngagementStore.js",
    "state/v3SessionBridge.js",
    "state/v3SkillStore.js",
    "ui/views/CanvasChatOverlay.js",
    "ui/views/V3SkillBuilder.js"
  ];
  const TESTS_IMPORT_RE = /from\s+["'](?:\.\.?\/)+tests\//;
  for (const file of FILES) {
    let src;
    try {
      const res = await fetch("/" + file);
      if (!res.ok) continue;       // module not yet shipped
      src = await res.text();
    } catch (_e) { continue; }
    assert(!TESTS_IMPORT_RE.test(src),
      "V-ANTI-RUN-1: " + file + " imports from tests/ at runtime — forbidden by SPEC §S23");
  }
});
```

### T23.2 · Forbidden test patterns

- **F23T.1** · Testing only the surfaces that were known-bad at audit time. As production surfaces grow, the FILES list must grow with them. Adding a new production module without adding it to the V-ANTI-RUN-1 file list is a discipline failure.

---

## §T24 · V-NAME — Production code naming discipline

**Coverage**: SPEC §S24. Operationalizes `feedback_no_version_prefix_in_names.md`.

**Approximate count**: 1 vector (machine-generated; expands as production surfaces grow).

| Vector | Assertion |
|---|---|
| V-NAME-1 | Source-grep over production paths (`services/`, `state/`, `core/`, `ui/`, `selectors/`, `interactions/`, `migrations/`, `schema/`) finds zero file names containing `v[0-9]` or `V[0-9]` (with explicit time-bounded exceptions documented in SPEC §S24.4). Plus `index.html` user-visible strings (button text, headings, topbar labels) contain zero `v[0-9.]+` occurrences (the version-chip footer is the deliberate exception — that one EXPRESSES the APP_VERSION on purpose). |

### T24.1 · Sample vector body (V-NAME-1)

```js
it("V-NAME-1 · production code naming discipline (per SPEC §S24)", async () => {
  // Curated list of production directories. Test discovers files via
  // a manifest-style probe — adding a new production module without
  // adding it here is a discipline failure (per F24T.1).
  const PRODUCTION_FILES = [
    // services/
    "services/aiService.js", "services/canvasFile.js", "services/catalogLoader.js",
    "services/chatService.js", "services/chatTools.js", "services/manifestGenerator.js",
    "services/memoizeOne.js", "services/mockChatProvider.js", "services/mockLLMProvider.js",
    "services/pathResolver.js", "services/realChatProvider.js", "services/realLLMProvider.js",
    "services/skillRunner.js", "services/skillSaveValidator.js", "services/systemPromptAssembler.js",
    // state/ (new canonical names — to be in place after Step 0b rename)
    "state/adapter.js", "state/engagementStore.js", "state/sessionBridge.js",
    "state/chatMemory.js",
    // core/ (canonical)
    "core/aiConfig.js", "core/config.js", "core/demoEngagement.js",
    "core/sessionEvents.js", "core/version.js",
    // ui/views/ (canonical)
    "ui/views/CanvasChatOverlay.js", "ui/views/SkillBuilder.js"
  ];
  // Time-bounded exceptions per SPEC §S24.4 / R24.5 — documented blocked items.
  const ALLOWED_EXCEPTIONS = new Set([
    "state/v3SkillStore.js",   // v2 core/skillStore.js export collision; drops when v2 retires
    "core/v3SeedSkills.js"      // v2 core/seedSkills.js path collision; drops when v2 retires
  ]);

  const offenders = [];
  for (const file of PRODUCTION_FILES) {
    if (ALLOWED_EXCEPTIONS.has(file)) continue;
    if (/[\\/]v[0-9]/i.test(file) || /[\\/][^/]*V[0-9]/.test(file)) {
      offenders.push("FILENAME: " + file);
    }
  }

  // index.html user-visible strings probe.
  let html;
  try { html = await (await fetch("/index.html")).text(); } catch (_e) { html = ""; }
  // Strip the deliberate version-chip span (it expresses APP_VERSION).
  // We allow `<span id="appVersionChip"></span>` and the surrounding chip
  // markup but flag any other "v<digit>" reference in user-visible text.
  const VISIBLE_TEXT_RE = />([^<]*\bv[0-9][0-9.]*[^<]*)</g;
  const VERSION_CHIP_OK = /id=["']appVersionChip["']/;
  let m;
  while ((m = VISIBLE_TEXT_RE.exec(html)) !== null) {
    const before = html.slice(Math.max(0, m.index - 200), m.index);
    if (VERSION_CHIP_OK.test(before)) continue;   // legitimate version-chip surface
    offenders.push("UI_STRING: " + m[1].trim().slice(0, 80));
  }

  assertEqual(offenders.length, 0,
    "V-NAME-1: production code naming discipline; offenders: " + offenders.join(" | "));
});
```

### T24.2 · Forbidden test patterns

- **F24T.1** · Failing to add a new production module to the `PRODUCTION_FILES` list when it ships. The list is the manifest of v3 production surfaces; growing it as the codebase grows is part of the V-NAME-1 discipline.
- **F24T.2** · Loosening the `ALLOWED_EXCEPTIONS` list without a corresponding entry in SPEC §S24.4 / R24.5 (which documents WHY an item is exempt + WHEN it drops). Exceptions without rationale are forbidden.

---

## §T25 · V-CONTRACT — Data contract (LLM grounding meta-model)

**Coverage**: SPEC §S25 + §S20.16 (handshake).

**Approximate count**: 7 vectors.

| Vector | Assertion |
|---|---|
| V-CONTRACT-1 | `getDataContract()` returns the same object reference on every call (module-cached). Returned object has top-level keys: `schemaVersion`, `checksum`, `generatedAt`, `entities`, `relationships`, `invariants`, `catalogs`, `bindablePaths`, `analyticalViews` |
| V-CONTRACT-2 | Contract content is DERIVED, not hand-maintained. Per-kind: `entities[].fields` count for `gap` matches `Object.keys(GapSchema._def.shape()).length` (within ±2 for cross-cutting fields handling); every `relationships[].from` references an entity declared in `entities[]`; every `catalogs[].entries[].id` is unique within its catalog |
| V-CONTRACT-3 | `getContractChecksum()` returns an 8-char lowercase hex string. Two calls return identical strings (deterministic). Modifying any contract content (e.g. adding a synthetic catalog entry in a test fixture) yields a DIFFERENT checksum |
| V-CONTRACT-4 | Module-load self-validation: `core/dataContract.js` source contains a top-level validation block that throws if any catalog has zero entries OR any relationship's `from` references an undeclared entity OR any invariant id is duplicated (verified by source-grep) |
| V-CONTRACT-5 | `services/systemPromptAssembler.js buildSystemPrompt({...})` includes the data contract in its message block (verified by checking the concatenated content for the contract's checksum + at least one catalog entry's label) |
| V-CONTRACT-6 | The role section instructs the LLM to use catalog labels (not bare ids) in user-facing prose AND to emit the first-turn handshake `[contract-ack v3.0 sha=<8>]` (verified by string match in the assembled prompt) |
| V-CONTRACT-7 | `services/chatService.streamChat({...}).onComplete` result includes `contractAck: { ok: bool, expected: string, received: string|null }`. When the mock provider scripts a response starting with the right ack prefix → `ok: true`. When the prefix is missing or sha mismatches → `ok: false` with diagnostic detail |

### T25.1 · Sample vector body (V-CONTRACT-1)

```js
it("V-CONTRACT-1 · getDataContract returns module-cached structured contract", () => {
  const a = getDataContract();
  const b = getDataContract();
  assert(a === b, "module-cached: same reference on repeat calls");
  assert(typeof a.schemaVersion === "string" && a.schemaVersion === "3.0", "schemaVersion 3.0");
  assert(typeof a.checksum === "string" && /^[0-9a-f]{8}$/.test(a.checksum), "8-char lowercase hex checksum");
  assert(Array.isArray(a.entities) && a.entities.length >= 6, "≥6 entity kinds (engagementMeta + customer + 5 collections)");
  assert(Array.isArray(a.relationships) && a.relationships.length >= 8, "≥8 relationships");
  assert(Array.isArray(a.invariants) && a.invariants.length >= 5, "≥5 named invariants");
  assert(Array.isArray(a.catalogs) && a.catalogs.length >= 6, "≥6 catalogs");
  assert(typeof a.bindablePaths === "object" && a.bindablePaths !== null, "bindablePaths present");
  assert(Array.isArray(a.analyticalViews) && a.analyticalViews.length === 7, "7 analytical views (one per §S5 selector)");
});
```

### T25.2 · Sample vector body (V-CONTRACT-7 · handshake parser)

```js
it("V-CONTRACT-7 · streamChat onComplete carries contractAck { ok, expected, received }", async () => {
  _resetChatEnv();
  const eng = createEmptyEngagement();
  setActiveEngagement(eng);
  const expected = getContractChecksum();
  const provider = createMockChatProviderProd({
    responses: [{ kind: "text", text: "[contract-ack v3.0 sha=" + expected + "]\n\nHello, ready to chat about this empty canvas." }]
  });
  let captured = null;
  await streamChat({
    engagement:     eng,
    transcript:     [],
    userMessage:    "hi",
    providerConfig: { providerKey: "mock" },
    provider:       provider,
    onComplete:     r => { captured = r; }
  });
  assert(captured && captured.contractAck, "onComplete result includes contractAck");
  assertEqual(captured.contractAck.ok, true, "ack ok when sha matches");
  assertEqual(captured.contractAck.expected, expected, "expected sha echoed");
  assertEqual(captured.contractAck.received, expected, "received sha matches expected");
});
```

### T25.3 · Forbidden test patterns

- **F25T.1** · Mocking `getDataContract()` to return a fixture. The contract IS the production artifact under test; mock it and you erase the V-CONTRACT-2 derived-from-schemas guarantee.
- **F25T.2** · Asserting specific catalog entry labels by literal string (catalog content evolves; assert by id presence + non-empty label instead).

---

## §T26 · V-MD — Markdown rendering on assistant chat bubbles

**Coverage**: SPEC §S20.17.

**Approximate count**: 1 vector.

| Vector | Assertion |
|---|---|
| V-MD-1 | After CanvasChatOverlay renders an assistant message containing `**bold**` and a bullet list, the rendered DOM has `<strong>` elements + `<ul><li>` structure (i.e. markdown was parsed, not surfaced as raw text). User bubbles for the same content show RAW `**bold**` (no markdown render — prevents prompt-injection-as-render) |

### T26.1 · Sample vector body

```js
it("V-MD-1 · assistant bubbles render markdown; user bubbles stay plain", async () => {
  // ... drive openCanvasChat + simulate an assistant message with markdown text
  // ... assert overlay.querySelector('.canvas-chat-msg-assistant strong') exists
  // ... assert overlay.querySelector('.canvas-chat-msg-user') content is escaped (textContent === raw)
});
```

### T26.2 · Forbidden test patterns

- **F26T.1** · Asserting markdown renders by checking the assistant's `.textContent` (markdown converts to HTML structure, not content). Always assert via DOM-tree probes.

---

## §T27 · Banner target reconciliation

Per SPEC §S14.6:

| Category | Provisional count | This document's enumeration |
|---|---|---|
| V-SCH | 70 | T2 (acceptance 7 + rejection 33 + round-trip 10 + per-catalog 8 = 58, +12 for sub-vector expansions = 70) |
| V-FK | 50 | T3 (4 sub-vectors × ~13 FK declarations = 52) |
| V-INV | 30 | T4 (15 invariants × 2 polarities = 30) |
| V-MIG | 25 | T5 (8 fixtures + 10 step-* groups + 4 idem/determ + 4 fail = 26+) |
| V-SEL + V-SEL-PURE | 70 | T6 (correctness ~28 + purity 7 + invalidation 7 + forbidden 3 + sub-vector 25 = 70) |
| V-MFG | 10 | T7 (10) |
| V-PATH | 35 | T8 (15 save + 15 run + 3 purity + 2 reserve = 35) |
| V-PROV | 15 | T9 (15) |
| V-DRIFT | 8 | T10 (8) |
| V-CAT | 12 | T11 (12) |
| V-PERF | 10 | T12 (10) |
| V-E2E | 12 | T13 (12) |
| V-INT | 25 | T14 (10 rules + 10 contract + 5 forbidden = 25) |
| V-XCUT | 5 | T15 (5) |
| V-PROD | 11 | T16 (11) |
| V-MULTI | 8 | T17 (8) |
| V-ANTI | 5 | T18 (5) |
| V-ADP | 10 | T19 (10) |
| V-CHAT | 12 | T20 (12) |
| V-DEMO | 7 | T21 (7) |
| V-MOCK | 3 | T22 (3) |
| V-ANTI-RUN | 1 | T23 (1) |
| V-NAME | 1 | T24 (1) |
| V-CONTRACT | 7 | T25 (7) |
| V-MD | 1 | T26 (1) |
| **TOTAL** | **~443** | **~446** |

Final banner target after merging: **616 (v2.4.16 baseline) - obsolete (~120 v2.4.x vectors that test fields/shapes that no longer exist) + 434 new = ~930 GREEN**. Provisional pending Suite 49 land + obsolete-vector audit. v3.0.0-rc.1 currently shows 1023/1023 (post-V-CHAT) because actual implementation enumerates per-fixture / per-invariant; "approximate count" here is the planning floor, not a ceiling.

---

## §T38 · V-FLOW-GROUND — Grounding contract recast (rc.6)

**Coverage**: SPEC §S37 + RULES §16 CH33 (rewritten CH3).

**Approximate count**: 12 RED scaffolds + 1 source-grep guard = 13 vectors.

| Vector | Assertion |
|---|---|
| V-FLOW-GROUND-1 | `services/groundingRouter.js` `route({userMessage, transcript, engagement})` returns `{selectorCalls: [...], rationale, fallback}`. Classifies "summarize the gaps" → `selectGapsKanban`; "what dispositions does the customer have?" → `selectGapsKanban + selectMatrixView`; "find dell assets in current state" → `selectVendorMix({state:"current"}) + selectMatrixView({state:"current"})`; "what does cyber resilience mean?" → `selectConcept`; unknown phrasing → CONTEXT_PACK fallback (gaps + vendor mix + executive summary inputs). Pure + deterministic — same input = same output. |
| V-FLOW-GROUND-2 | `buildSystemPrompt({engagement, providerKind, routerOutput})` inlines selector results into Layer 4. Structural assertion: Layer 4 contains the gap descriptions / vendor mix data (not just counts) when router produces selectGapsKanban / selectVendorMix calls. |
| V-FLOW-GROUND-3 | Acme demo regression (the test that would have caught BUG-030): with `engagement = getDemoEngagement()` and `userMessage = "summarize the gaps"`, Layer 4 contains all 8 gap descriptions inline (loose-substring match against `engagement.gaps.byId[*].description`). |
| V-FLOW-GROUND-4 | Empty engagement: router returns `selectorCalls: []`; Layer 4 says "the canvas doesn't include data" or equivalent; no thrown exception. Existing V-CHAT-10 (empty-engagement smoke) still passes after the rewire. |
| V-FLOW-GROUND-5 | (RETIRED 2026-05-05 per `feedback_no_mocks.md`) — was: grounded-mock paraphrase. End-to-end paraphrase correctness is now verified by real-LLM live-key smoke at PREFLIGHT 5b. No mock substrate. |
| V-FLOW-GROUND-6 | (RETIRED 2026-05-05 per `feedback_no_mocks.md`) — was: grounded-mock fallback phrase. Same reason; real-LLM smoke covers it. |
| V-FLOW-GROUND-FAIL-1 | `services/groundingVerifier.js` `verifyGrounding(response, engagement)` rejects a response that references a gap description not in the engagement; populates `violations[*].kind === "gap-description"`; `ok === false`. |
| V-FLOW-GROUND-FAIL-2 | Verifier rejects a response that references a vendor name not in the engagement AND not in `DELL_PRODUCT_TAXONOMY`; populates `violations[*].kind === "vendor"`. |
| V-FLOW-GROUND-FAIL-3 | Verifier rejects a response containing the Local-B regression case: a project plan with "Procurement Initiation: Issue RFP for PowerScale F710 & XE9680 (Q2 close)" or "Executive Review (June 30): Present Phase 1 progress & Q3 roadmap" — when those dates / phases / procurement steps are not in the engagement. Populates `violations[*].kind` ∈ `{"date-deliverable", "project-phase"}`. |
| V-FLOW-GROUND-FAIL-4 | (REWORKED 2026-05-05 per `feedback_no_mocks.md`) Source-grep assertion: `services/chatService.js streamChat(...)` source MUST contain a call to `verifyGrounding(...)` on the visible response path before return. Replaces the prior scripted-mock-driven integration test. Honest, deterministic, no fakery. |
| V-FLOW-GROUND-FAIL-5 | Catalog-whitelist invariant: a response that mentions a Dell product (DELL_PRODUCT_TAXONOMY entry) NOT in the engagement does NOT trigger a violation (catalog reference data is allowed even if not in engagement). Same for BUSINESS_DRIVERS, ENV_CATALOG labels — these are reference data, not hallucination. |
| V-FLOW-GROUND-7 | Token-budget guard: a synthetic 250-instance engagement triggers selector-drop fallback when router-output JSON exceeds 50K input-token estimate. Metadata + cheapest selectors stay inlined; over-cap selectors degrade to TOC + tool fallback. Engagement metadata (customer + drivers + env aliases) always preserved in Layer 4. |
| V-ANTI-THRESHOLD-1 | Source-grep — no `ENGAGEMENT_INLINE_THRESHOLD_INSTANCES`, `ENGAGEMENT_INLINE_THRESHOLD_GAPS`, or `ENGAGEMENT_INLINE_THRESHOLD_DRIVERS` symbols exist in the tree post-rc.6. Regression guard against re-introducing the count-based small/large branch. |

### T38.1 · Sample vector body (V-FLOW-GROUND-3 · Acme gap inlining)

```js
it("V-FLOW-GROUND-3 · Acme demo: Layer 4 contains all 8 gap descriptions inline", async () => {
  const { route }              = await import("../services/groundingRouter.js");
  const { buildSystemPrompt }  = await import("../services/systemPromptAssembler.js");
  const { getDemoEngagement }  = await import("../core/demoEngagement.js");
  const eng = getDemoEngagement();
  const out = route({ userMessage: "summarize the gaps", transcript: [], engagement: eng });
  const prompt = buildSystemPrompt({ engagement: eng, routerOutput: out });
  const layer4 = prompt.messages[prompt.messages.length - 1].content;
  for (const id of eng.gaps.allIds) {
    const desc = eng.gaps.byId[id].description;
    assert(layer4.includes(desc),
      "V-FLOW-GROUND-3 · Layer 4 must inline gap description: " + desc);
  }
});
```

### T38.2 · Sample vector body (V-FLOW-GROUND-FAIL-3 · Local-B Q2/June-30 hallucination class)

```js
it("V-FLOW-GROUND-FAIL-3 · verifier rejects fabricated project-phase dates", async () => {
  const { verifyGrounding } = await import("../services/groundingVerifier.js");
  const { getDemoEngagement } = await import("../core/demoEngagement.js");
  const eng = getDemoEngagement();
  const hallucinated = [
    "Bottom line: Acme needs a single-vendor platform.",
    "Procurement Initiation: Issue RFP for PowerScale F710 & XE9680 (Q2 close).",
    "Executive Review (June 30): Present Phase 1 progress & Q3 roadmap to CIO/CISO."
  ].join("\n");
  const result = verifyGrounding(hallucinated, eng);
  assertEqual(result.ok, false, "verifier must flag fabricated deliverable dates");
  const kinds = result.violations.map(v => v.kind);
  assert(kinds.includes("date-deliverable") || kinds.includes("project-phase"),
    "violations include date-deliverable or project-phase classification; got: " + JSON.stringify(kinds));
});
```

### T38.3 · Forbidden test patterns

- **F38T.1** · Stubbing `route(...)` internals; tests dispatch through the real router against deterministic user-message fixtures.
- **F38T.2** · Asserting LLM output semantics. The verifier asserts a *structural* property (entity references trace to engagement); tests assert structural too.
- **F38T.3** · Comparing router-output text byte-for-byte (brittle as intent table evolves); use intent-id assertions or selector-list set-equality.
- **F38T.4** · (REVISED 2026-05-05 per `feedback_no_mocks.md`) Using ANY mock provider, scripted-LLM fixture, stubbed-fetch test, or grounded-mock substrate for V-FLOW-GROUND-* tests. Tests for router + assembler + verifier are pure-function tests; the streamChat→verifier integration is a source-grep assertion (V-FLOW-GROUND-FAIL-4); end-to-end behavior is covered by real-LLM live-key smoke at PREFLIGHT 5b. No fakery anywhere.

---

## §T28 · Open items

| Item | Section | Tag |
|---|---|---|
| V-SCH-12 default — `.strict()` vs `.strip()` for unknown fields | §T2.2 | TO RESOLVE (default `.strict()` for v3.0) |
| V-MFG-10 manifest entry count expected size table | §T7 | TO LOCK at SPEC §S7.2.1 implementation |
| V-ANTI-4 strict R-number → vector enforcement | §T18.1 | TO UPGRADE in v3.1 (smoke-check floors in v3.0) |
| Banner target obsolete-vector audit | §T27 | TO RUN at Suite 49 land time (count which v2.4.x vectors test fields that v3.0 removes) |
| V-PROD mock LLM response keyed by prompt hash format | §T16.4 | TO AUTHOR alongside `services/llm/mockProvider.js` |

---

## §T29 · Document control

- **Authored**: 2026-05-01 alongside MIGRATION.md.
- **Owner**: spec writer (Claude Opus 4.7 1M context, this session and successors).
- **Authority cascade**: directive §14 → SPEC §14 → this TESTS.md → Suite 49 in `diagnostics/appSpec.js`.
- **Append-only contract**: vector ids are permanent (per §T1.2).

### Change log

| Date | Section | Change |
|---|---|---|
| 2026-05-01 | All | Initial draft. 17 vector categories + ~404 vector ids enumerated. Banner target ~897 GREEN. |
| 2026-05-01 | §T19 + §T20 + §T21 + §T22 | NEW §T19 V-ADP-1..10 vectors for SPEC §S19 v3.0 → v2.x consumption adapter. Existing §T19/T20/T21 meta-sections renumbered to §T20/T21/T22. Banner target bumps from ~897 to ~907. |
| 2026-05-02 | §T20 + §T21 + §T22 + §T23 | NEW §T20 V-CHAT-1..12 vectors for SPEC §S20 Canvas Chat. Existing §T20/T21/T22 meta-sections (banner target / open items / document control) renumbered to §T21/T22/T23. Banner target bumps from ~907 to ~919. Sample bodies for V-CHAT-3 (selector ↔ tool consistency) + V-CHAT-5 (tool-call round-trip with mock). |
| 2026-05-02 | §T21 + §T22 + §T23 + §T24 + §T25 + §T26 | NEW §T21 V-DEMO-1..7 (SPEC §S21 v3-native demo). NEW §T22 V-MOCK-1..3 (SPEC §S22 mocks as production services). NEW §T23 V-ANTI-RUN-1 (SPEC §S23 production-no-tests-imports). Existing §T21/T22/T23 meta-sections (banner target / open items / document control) renumbered to §T24/T25/T26. Banner target bumps from ~919 to ~930. Sample bodies for V-DEMO-1 / V-DEMO-4 / V-MOCK-1 / V-ANTI-RUN-1. Authored as the architectural fix for the BUG-003 patch revert per `feedback_no_patches_flag_first.md` + `feedback_test_or_it_didnt_ship.md`. |
| 2026-05-02 | §T24 + §T25 + §T26 + §T27 | NEW §T24 V-NAME-1 (SPEC §S24 production code naming discipline). Existing §T24/T25/T26 meta-sections renumbered to §T25/T26/T27. Banner target +1 (~930 → ~931). V-NAME-1 source-grep enforces no version-prefix in production file names + no v3 references in user-visible UI strings (with documented time-bounded exceptions for v2-collision items). Authored as the architectural prerequisite for chat-perfection: new modules in the chat-perfection sequence land on a tree where the discipline is already enforced. |
| 2026-05-02 | §T25 + §T26 + §T27 + §T28 + §T29 | NEW §T25 V-CONTRACT-1..7 (SPEC §S25 data contract LLM grounding meta-model + §S20.16 first-turn handshake). NEW §T26 V-MD-1 (SPEC §S20.17 markdown rendering on assistant bubbles). Existing §T25/T26/T27 meta-sections renumbered to §T27/T28/T29. Banner target +8 (~931 → ~439). Sample bodies for V-CONTRACT-1 (module-cached structured contract) + V-CONTRACT-7 (handshake parser surfaces contractAck on onComplete). Centerpiece of the chat-perfection arc per user direction 2026-05-02 ("the LLM provider needs to know the binding correctly... binding handshake to confirm awareness... this is the most big win if done correctly"). |

End of TESTS.
