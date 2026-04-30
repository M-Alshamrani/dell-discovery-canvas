# Dell Discovery Canvas · v3.0 Implementation Specification

**Branch**: `v3.0-data-architecture` · **APP_VERSION**: `3.0.0-alpha` · **Authority**: derives from [`../../data-architecture-directive.md`](../../data-architecture-directive.md)

**Document state**: DRAFT 2026-04-30. §0 + §1 + §2 + §3 + §4 fully drafted. §5–§14 scaffolded with R-number lists + intent paragraphs (TO AUTHOR markers). §15–§18 fully drafted.

**Read order**: this SPEC after the directive. Every R-number in this SPEC traces back to a directive R-number; deviations are flagged inline. The SPEC adds **concrete file paths, function signatures, and test pointers** that the directive explicitly leaves to the spec writer.

---

## §0 · How this SPEC is consumed

Per directive §0:

1. **This SPEC** authors `MIGRATION.md` (v2.0 → v3.0 specification) and `TESTS.md` (test vectors). The SPEC is the contract; the migration spec elaborates §9 transformations; the test vectors elaborate §14 categories.
2. **Vectors → tests**: every R-number → ≥1 it() in `diagnostics/appSpec.js` Suite N (RED-first). Anti-cheat per directive §14.5: no NODE_ENV=test branches; no swallowed catches; no constant-from-stub assertions; no internal-module mocking outside the §14.4 boundaries.
3. **Tests → code**: schema layer first (§2), then in-memory shape (§4), then selectors (§5), then v2.0→v3.0 migrator (§9), then catalogs (§6), then provenance (§8), then skill builder UI (§7), then performance gates (§11), then browser smoke. Order is locked by directive §0.4 + HANDOVER §8.1.

**Numbering**: SPEC §N maps 1-to-1 to directive §N. Subsections may add letter suffixes (S2.2.1.a) without renumbering.

---

## §1 · Non-negotiable principles

Restatement of directive §1. Every later section traces back to one or more of these.

| # | Principle | SPEC sections that enforce it |
|---|---|---|
| **P1** | **Schema is the single source of truth.** One Zod artifact defines every persisted entity. Validators / migrations / chip manifest / FK checks / SQL DDL all derive. Hand-maintained parallel definitions are forbidden. | §2 (schema layer), §7.2 (manifest gen), §13.2 (DDL gen) |
| **P2** | **Storage is normalized.** Flat collections of entities indexed by `id` with FKs between them. No nested matrix-of-matrices, no env-grouped tree, no per-tab data ownership. Cross-cutting relationships are first-class FKs. | §3.7 (cross-cutting table), §4 (storage layer) |
| **P3** | **Presentation is derived, never stored.** Every UI view is a pure function over the normalized store. No view writes back. No denormalized cache. | §5 (selectors layer) |
| **P4** | **Migrations are first-class artifacts.** Every schema version has a forward migrator. Pure, idempotent, round-trippable through registered fixtures. | §9 (migration system) |
| **P5** | **AI-authored data carries provenance.** Every LLM-authored field is wrapped with model id, prompt version, timestamp, validation status, source catalog version. Plain strings in AI slots = schema violation. | §8 (provenance) |
| **P6** | **Catalogs are versioned reference data.** Catalogs have `catalogVersion`. Persisted entities reference catalog entries by `id` + `catalogVersion`. | §6 (catalogs) |
| **P7** | **Integrity is restorable, not assumed.** FK invariants stated in schema. Pure sweep on every load detects, repairs the repairable, logs the rest. | §10 (integrity) |
| **P8** | **Multi-engagement readiness is built in now.** `engagementId` + `ownerId` + audit timestamps on every record from day one. | §3 (entity model), §12 (multi-engagement) |
| **P9** | **Performance budget is enforced by test.** 100ms render + 500ms full round-trip on 200-instance reference engagement. CI-gated. | §11 (performance) |
| **P10** | **Tests verify real execution paths.** No internal-module mocks. Mock list is closed: LLM provider, network, Date/timer (per §14.4). | §14 (testing) |

**SPEC contract**: any module change must reference the principle(s) it implements. Removing a principle requires a directive change request — not a SPEC revision.

---

## §2 · Schema layer

### S2.1 · Library and structural choice

**Library locked: Zod.** Per directive §2.1 and `OPEN_QUESTIONS_RESOLVED.md` (no override on Q2 conflict). Zod runs in plain JavaScript, integrates with eventual TypeScript via `z.infer`, and has the needed derivation tooling (`drizzle-zod` for §13 DDL; `zod-to-json-schema` for §7.4 LLM structured output).

**Forbidden**: ad-hoc `validateX()` functions, JSON Schema files maintained in parallel, JSDoc as the only typing layer.

**Bundled**: Zod loaded as ESM via `<script type="importmap">` mapping `"zod"` → `https://esm.sh/zod@3.x?bundle` for the static-file deployment, OR vendored to `vendor/zod/` if offline LAN deploys can't reach the CDN. **S2.1.1**: the loader resolution is determined at v3.0.0 commit time; the SPEC does not pre-commit either path. (TO RESOLVE: pick one before §2 implementation.)

### S2.2 · Schema artifact contract

**Directory layout**:

```
schema/
  index.js                      // composes engagement schema + exports current schema version
  engagement.js                 // EngagementMetaSchema + Engagement composition
  customer.js
  driver.js
  environment.js
  instance.js
  gap.js
  catalogs/
    layer.js                    // LayerSchema + LAYERS catalog snapshot
    businessDriver.js           // + BUSINESS_DRIVERS snapshot
    envCatalog.js
    serviceType.js
    gapType.js
    dispositionAction.js
    customerVertical.js
    dellProductTaxonomy.js      // NEW v3.0
  helpers/
    fkDeclaration.js            // shared FK declaration shape (R2.2)
    pathManifest.js             // shared manifest contribution shape
    provenanceWrapper.js        // §8 wrapper schema
```

**S2.2.1** · Every entity schema file (`schema/<entity>.js`) exports:
- `<EntityName>Schema` — the Zod `z.object({...})`.
- `createEmpty<EntityName>(overrides?)` — factory returning a default-valid instance.
- `<entityName>FkDeclarations` — array of `{ field, target, required, targetFilter? }` (machine-readable; consumed by §10 integrity sweep + §13 DDL gen).
- `<entityName>PathManifest` — array of `{ path, type, label, source: "schema" }` (consumed by §7.2 manifest generator).

**Trace**: maps directive R2.2.1 + R2.2.2 + R2.2.3.

**S2.2.2** · Validation boundaries (directive R2.2.4): exactly three.
1. **On load** (`services/canvasFile.js loadCanvas`): runs after migration (§9). Failures route to migration + integrity-quarantine flow.
2. **On save** (`services/canvasFile.js buildSaveEnvelope`): blocks save with structured field-path errors. Structure: `{ ok: false, errors: [{ path, message, code }] }`.
3. **On user input commit** (action functions in `interactions/*Commands.js`): rejects invalid input before mutation. Same structured-error shape.

**Forbidden**: validation calls inside selectors (S5 §5.1), inside render functions, or on every keystroke. The schema is not a runtime guard; it is a boundary contract.

### S2.3 · Schema versioning

**S2.3.1** · `engagementMeta.schemaVersion` is a `"<major>.<minor>"` string. Target: `"3.0"`. Reading an engagement without this field treats it as `"2.0"` (current production). Per directive R2.3.1 + R2.3.2.

**S2.3.2** · Versioned schemas live in `schema/v3-0/` only when a v3.1 schema is introduced. Until then, `schema/*.js` IS the v3.0 schema. Migrators (`migrations/v2-0_to_v3-0.js`) reach into the active schema via the public `schema/` exports.

**S2.3.3** · `schema/index.js` exports `CURRENT_SCHEMA_VERSION = "3.0"`. Production code never imports a versioned subdirectory; only the migrator does.

### S2.4 · Test contract for §2

Vectors land in TESTS.md §V-SCH. Every `<EntityName>Schema` must:
- Accept the corresponding `createEmpty<EntityName>()` output.
- Reject every documented invalid case (one vector per invariant from §3).
- Round-trip a fixture engagement through `parse → JSON → parse` byte-equivalently (modulo transient fields).

**Forbidden test patterns**: stubbing the Zod parser; constructing entity objects bypassing the factory.

---

## §3 · Entity model

### S3.0 · Cross-cutting fields (every entity)

Every persisted entity except `engagementMeta` and `customer` carries:

```
{
  id:           z.string().uuid(),
  engagementId: z.string().uuid(),       // FK to engagementMeta.engagementId
  createdAt:    z.string().datetime(),   // ISO 8601
  updatedAt:    z.string().datetime()    // ISO 8601
}
```

Trace: directive R4.3.1 + P8 + R12.1.

**S3.0.1** · `id` is generated client-side as UUID v4 (crypto.randomUUID()). The migrator generates ids deterministically from v2.0 data (e.g., concatenation of stable v2.0 fields + position) so re-running the migrator yields the same ids. Determinism is required by R9.1.2 idempotency.

**S3.0.2** · `createdAt` defaults to migration timestamp when v2.0 source has no equivalent; `updatedAt` = `createdAt` initially.

### S3.1 · Engagement (renamed from "session")

**S3.1.1 · Persisted shape**:

```js
const EngagementMetaSchema = z.object({
  engagementId:       z.string().uuid(),
  schemaVersion:      z.literal("3.0"),
  isDemo:             z.boolean(),
  ownerId:            z.string().min(1).default("local-user"),
  presalesOwner:      z.string().default(""),
  engagementDate:     z.string().date().nullable(),
  status:             z.enum(["Draft", "In review", "Locked"]).default("Draft"),
  createdAt:          z.string().datetime(),
  updatedAt:          z.string().datetime()
});
```

**S3.1.2 · Transient fields** (stripped on save by `buildSaveEnvelope`, regenerated on load):

```js
const EngagementTransientSchema = z.object({
  activeEntity:  z.union([
    z.object({ kind: KindEnum, id: z.string().uuid(), at: z.string().datetime() }),
    z.null()
  ]),
  integrityLog: z.array(IntegrityLogEntrySchema)  // see §10
});
```

**S3.1.3 · UI term remains "session".** Per directive §3.1, the data layer term is "engagement" everywhere in code; the UI label "session" is a presentation choice, not a schema name. No code reference to `session.X` survives v3.0 migration.

**Trace**: directive §3.1.

### S3.2 · Customer

```js
const CustomerSchema = z.object({
  engagementId:  z.string().uuid(),
  name:          z.string().min(1),
  vertical:      z.string(),       // FK to CUSTOMER_VERTICALS, validated by refinement
  region:        z.string(),
  notes:         z.string().default("")
});
```

**Removed in v3.0**: `segment`, `industry` (legacy back-compat). The migrator copies any non-redundant content into `notes` (§9.3 step 5).

**S3.2.1** · Single record per engagement; nested in the engagement document (not a collection). Promotion to its own collection at v3.2 backend migration is non-breaking because all FKs point at engagement, not at customer (per `OPEN_QUESTIONS_RESOLVED.md` Q7).

**Trace**: directive §3.2.

### S3.3 · Driver (extracted from `customer.drivers[]`)

```js
const DriverSchema = z.object({
  ...crossCuttingFields,
  businessDriverId:  z.string(),                          // FK to BUSINESS_DRIVERS catalog
  catalogVersion:    z.string(),                          // pinned catalog version (§6.1.3)
  priority:          z.enum(["High", "Medium", "Low"]),
  outcomes:          z.string().default("")
});

const driverFkDeclarations = [
  { field: "businessDriverId", target: "catalog:BUSINESS_DRIVERS", required: true }
];
```

**S3.3.1** · Promoted to top-level `engagement.drivers` collection. Cross-engagement reporting (v3.2) requires this. The skill builder treats drivers as a click-to-run entity kind.

**Trace**: directive §3.3.

### S3.4 · Environment

```js
const EnvironmentSchema = z.object({
  ...crossCuttingFields,
  envCatalogId:    z.string(),                       // FK to ENV_CATALOG
  catalogVersion:  z.string(),
  hidden:          z.boolean().default(false),       // soft-delete
  alias:           z.string().nullable(),
  location:        z.string().nullable(),
  sizeKw:          z.number().nullable(),
  sqm:             z.number().nullable(),
  tier:            z.string().nullable(),
  notes:           z.string().default("")
});

const environmentFkDeclarations = [
  { field: "envCatalogId", target: "catalog:ENV_CATALOG", required: true }
];
```

**Trace**: directive §3.4.

### S3.5 · Instance (current OR desired, discriminated by `state`)

```js
const InstanceSchema = z.object({
  ...crossCuttingFields,
  state:           z.enum(["current", "desired"]),
  layerId:         z.string(),                        // FK to LAYERS
  environmentId:   z.string().uuid(),                 // FK to environments
  label:           z.string().min(1),
  vendor:          z.string(),
  vendorGroup:     z.enum(["dell", "nonDell", "custom"]),
  criticality:     z.enum(["High", "Medium", "Low"]),
  notes:           z.string().default(""),
  disposition:     z.string(),                        // FK to DISPOSITION_ACTIONS

  // State-conditional (validated by .superRefine):
  originId:        z.string().uuid().nullable(),      // only on state==="desired"; FK to instances where state==="current"
  priority:        z.enum(["Now","Next","Later"]).nullable(), // only on state==="desired"

  // Layer-conditional:
  mappedAssetIds:  z.array(z.string().uuid()).default([]),  // only non-empty on layerId==="workload"

  // AI-authored (§8):
  aiSuggestedDellMapping: provenanceWrapper(DellMappingSchema).nullable()
}).superRefine((inst, ctx) => {
  // R3.5.a: originId only on desired; priority only on desired
  if (inst.state === "current" && (inst.originId !== null || inst.priority !== null)) {
    ctx.addIssue({ code: "custom", path: ["originId"],
      message: "current-state instance must not carry originId/priority" });
  }
  // R3.5.b: mappedAssetIds only on workload layer
  if (inst.layerId !== "workload" && inst.mappedAssetIds.length > 0) {
    ctx.addIssue({ code: "custom", path: ["mappedAssetIds"],
      message: "mappedAssetIds permitted only on workload-layer instances" });
  }
});

const instanceFkDeclarations = [
  { field: "layerId",       target: "catalog:LAYERS",              required: true },
  { field: "environmentId", target: "environments",                required: true },
  { field: "disposition",   target: "catalog:DISPOSITION_ACTIONS", required: true },
  { field: "originId",      target: "instances",                   required: false,
    targetFilter: { state: "current" } },
  { field: "mappedAssetIds", target: "instances",                  required: false, isArray: true }
];
```

**S3.5.1** · Single collection (current + desired) per directive §3.5. Splitting into two would force joining for matrix view, originId resolution, mappedAssetIds resolution.

**S3.5.2** · `originId` and `mappedAssetIds` may reference instances in other environments (cross-cutting per directive §3.7). Test coverage in TESTS.md §V-XCUT.

**Trace**: directive §3.5.

### S3.6 · Gap

```js
const GapSchema = z.object({
  ...crossCuttingFields,
  description:              z.string().min(1),
  gapType:                  z.string(),                   // FK to GAP_TYPES
  urgency:                  z.enum(["High","Medium","Low"]),
  urgencyOverride:          z.boolean().default(false),
  phase:                    z.enum(["now","next","later"]),
  status:                   z.enum(["open","in_progress","closed","deferred"]),
  reviewed:                 z.boolean().default(false),
  notes:                    z.string().default(""),
  driverId:                 z.string().uuid().nullable(), // FK to drivers
  layerId:                  z.string(),                   // primary layer; FK to LAYERS
  affectedLayers:           z.array(z.string()).min(1),   // invariant G6: [0] === layerId
  affectedEnvironments:     z.array(z.string().uuid()).min(1),
  relatedCurrentInstanceIds: z.array(z.string().uuid()).default([]),
  relatedDesiredInstanceIds: z.array(z.string().uuid()).default([]),
  services:                 z.array(z.string()).default([]), // FKs to SERVICE_TYPES

  // AI-authored (§8):
  aiMappedDellSolutions:    provenanceWrapper(DellSolutionListSchema).nullable()
}).superRefine((gap, ctx) => {
  // R3.6.G6: affectedLayers[0] === layerId
  if (gap.affectedLayers[0] !== gap.layerId) {
    ctx.addIssue({ code: "custom", path: ["affectedLayers", 0],
      message: "affectedLayers[0] must equal layerId (invariant G6)" });
  }
});

const gapFkDeclarations = [
  { field: "gapType",                   target: "catalog:GAP_TYPES",   required: true },
  { field: "driverId",                  target: "drivers",             required: false },
  { field: "layerId",                   target: "catalog:LAYERS",      required: true },
  { field: "affectedLayers",            target: "catalog:LAYERS",      required: true,  isArray: true },
  { field: "affectedEnvironments",      target: "environments",        required: true,  isArray: true },
  { field: "relatedCurrentInstanceIds", target: "instances",           required: false, isArray: true,
    targetFilter: { state: "current" } },
  { field: "relatedDesiredInstanceIds", target: "instances",           required: false, isArray: true,
    targetFilter: { state: "desired" } },
  { field: "services",                  target: "catalog:SERVICE_TYPES", required: false, isArray: true }
];
```

**S3.6.1 · Derived, not stored**: `projectId`. The v2.0 stored field is dropped by the migrator (§9.3 step 8). `selectProjects(engagement)` (§5.2) computes project grouping at projection time.

**Trace**: directive §3.6.

### S3.7 · Cross-cutting relationships table

Reproduced from directive §3.7. Tests in TESTS.md §V-XCUT cover each row.

| Source entity | Field | Target | Cross-environment? | Test vector id |
|---|---|---|---|---|
| Instance (workload) | `mappedAssetIds[]` | Instance | yes | XCUT-1 |
| Instance (desired) | `originId` | Instance (current) | yes | XCUT-2 |
| Gap | `affectedEnvironments[]` | Environment | yes (≥2) | XCUT-3 |
| Gap | `relatedCurrentInstanceIds[]` | Instance (current) | yes | XCUT-4 |
| Gap | `relatedDesiredInstanceIds[]` | Instance (desired) | yes | XCUT-5 |

---

## §4 · Storage layer

### S4.1 · In-memory shape

```js
engagement = {
  meta:         EngagementMeta,          // S3.1
  customer:     Customer,                // S3.2 (single record)
  drivers:      Collection<Driver>,
  environments: Collection<Environment>,
  instances:    Collection<Instance> & { byState: { current: string[], desired: string[] } },
  gaps:         Collection<Gap>,
  // Transient (see S3.1.2):
  activeEntity: ActiveEntity | null,
  integrityLog: IntegrityLogEntry[]
}

// Where:
type Collection<T> = {
  byId:    Record<string, T>,
  allIds:  string[]                       // insertion order preserved
}
```

**S4.1.1** · Each collection's `byId` is canonical; `allIds` preserves insertion order; secondary indexes (e.g., `instances.byState`) are explicitly named and rebuilt on mutation.

**S4.1.2** · Mutation goes through action functions per collection in `state/collections/<entity>Actions.js`:

```
state/collections/
  driverActions.js        // addDriver, updateDriver, removeDriver
  environmentActions.js   // addEnvironment, updateEnvironment, removeEnvironment, hideEnvironment, unhideEnvironment
  instanceActions.js      // addInstance, updateInstance, removeInstance, linkOrigin, mapWorkloadAssets
  gapActions.js           // addGap, updateGap, removeGap, attachServices, attachInstances
  customerActions.js      // updateCustomer (single record; no add/remove)
```

**S4.1.3** · Action functions return a new engagement object via structural sharing (immer or hand-rolled). In-place mutation is forbidden because §5 selector memoization depends on referential change detection.

**Trace**: directive R4.1.1 + R4.1.2 + R4.1.3.

### S4.2 · Persistence shape

**S4.2.1** · `.canvas` JSON shape on disk = in-memory shape minus transient fields (`activeEntity`, `integrityLog`) and minus secondary indexes (rebuilt on load).

**S4.2.2** · Collections are serialized as `{byId, allIds}` (drop secondary indexes), NOT as flat arrays. Rationale: round-trip fidelity. Loading reconstitutes secondary indexes from `byId` + `allIds`.

**S4.2.3** · localStorage uses the same persisted shape under key `dell_discovery_canvas_v3`. Autosave debounces at 1000ms (unchanged from v2.4.16).

**S4.2.4** · `services/canvasFile.js`:
- `buildSaveEnvelope(engagement) → { ok: true, envelope } | { ok: false, errors }`. Validates against `EngagementSchema`, strips transient fields, attaches save header (`fileFormatVersion`, `appVersion`, `schemaVersion`, `savedAt`).
- `loadCanvas(envelope) → { ok: true, engagement } | { ok: false, error, recoveryHint }`. Detects schema version, runs migrator if needed, validates result, runs integrity sweep, hydrates secondary indexes.

**Trace**: directive R4.2.1 + R4.2.2 + R4.2.3.

### S4.3 · Engagement scoping (P8)

**S4.3.1** · Every record (excluding `engagementMeta` and `customer`) has `engagementId === engagementMeta.engagementId`. Enforced by integrity sweep (§10).

**S4.3.2** · Action functions stamp `engagementId` from the engagement context on every add/update. The user never enters `engagementId` directly.

**Trace**: directive R4.3.1 + R4.3.2.

### S4.4 · Foreign key declarations

**S4.4.1** · FK declarations are exported alongside the schema (per S2.2.1). Shape:

```js
{
  field:         "environmentId",           // dot-path within entity
  target:        "environments",            // collection name OR "catalog:CATALOG_ID"
  required:      true,                       // false → null permitted
  isArray:       false,                       // true → field is array of FKs
  targetFilter:  { state: "current" }        // optional; restricts target subset
}
```

**S4.4.2** · Three consumers read FK declarations:
1. `state/integritySweep.js` (§10) — runs orphan/quarantine logic.
2. `services/manifestGenerator.js` (§7.2) — emits the linked-paths section of the chip manifest.
3. `services/ddlGenerator.js` (§13, future) — emits Postgres FK constraints + join tables.

**Forbidden**: hand-coding FK checks in any module. If a module needs to know "is this id valid?" it consults `services/fkResolver.js`, which reads declarations.

**Trace**: directive R4.4.1 + R4.4.2.

### S4.5 · Test contract for §4

Vectors in TESTS.md §V-STR (storage) + §V-FK (FK integrity).

- Action function returns new engagement reference, never mutates input. (Memoization requires this.)
- `byId` + `allIds` round-trip through save+load byte-equivalent (modulo transient fields).
- Secondary indexes are rebuilt deterministically (same input → same `instances.byState`).

---

## §5 · Derived views layer

**Status**: SCAFFOLD. R-numbers + intent below; concrete signatures TO AUTHOR after S2-S4 implementation lands.

**Intent**: every UI view reads through a pure memoized selector over the engagement. No view writes back. No denormalized cache. Memoization library: **memoize-one** (per `OPEN_QUESTIONS_RESOLVED.md` Q2). Single library across all selectors.

### S5.1 · Selector contract (TO AUTHOR)
- R5.1.1 · Pure function `(engagement, args?) => view`. No DOM / network / localStorage.
- R5.1.2 · `memoize-one` per selector at module scope. ESLint `no-restricted-imports` forbids `reselect`/`proxy-memoize`.
- R5.1.3 · Selector returns reference-equal output for reference-equal input. Two consecutive calls return `===`-equal output.
- R5.1.4 · Forbidden patterns: module-scope mutable state, side effects, hidden caches.

### S5.2 · Required selectors (TO AUTHOR — concrete shapes)

| Selector | File | Inputs | Output shape | Test vector |
|---|---|---|---|---|
| `selectMatrixView` | `selectors/matrix.js` | `(engagement, { state })` | grid by env × layer | V-SEL-1 |
| `selectGapsKanban` | `selectors/gapsKanban.js` | `(engagement)` | gaps grouped by phase + status | V-SEL-2 |
| `selectProjects` | `selectors/projects.js` | `(engagement)` | gaps grouped into projects (replaces stored projectId) | V-SEL-3 |
| `selectVendorMix` | `selectors/vendorMix.js` | `(engagement)` | per-layer + per-env vendor counts | V-SEL-4 |
| `selectHealthSummary` | `selectors/healthSummary.js` | `(engagement)` | heatmap input | V-SEL-5 |
| `selectExecutiveSummaryInputs` | `selectors/executiveSummary.js` | `(engagement)` | structured exec-summary skill inputs | V-SEL-6 |
| `selectLinkedComposition` | `selectors/linkedComposition.js` | `(engagement, { kind, id })` | merged record set for click-to-run skill | V-SEL-7 |

### S5.3 · Forbidden patterns (TO AUTHOR)
- F5.3.1 · No "denormalized cache" alongside the store.
- F5.3.2 · No view writes back to the store.
- F5.3.3 · No selector caches output outside its memoization wrapper.

**Trace**: directive §5.

---

## §6 · Catalogs subsystem

**Status**: SCAFFOLD. R-numbers + 8-catalog inventory below; full Zod schemas + Dell taxonomy entries TO AUTHOR.

### S6.1 · Catalog shape (TO AUTHOR)
- R6.1.1 · `{ catalogId, catalogVersion, entries: [{ id, label, ...catalogSpecificFields }] }`.
- R6.1.2 · Loader interface: `loadCatalog(catalogId): Promise<Catalog>`. v3.0 reads bundled JSON; v3.1 may swap to remote endpoint behind same interface.
- R6.1.3 · Persisted entities reference catalog entries by `id` + `catalogVersion` (cf. S3.3, S3.4 — `catalogVersion` field on every record that has a catalog FK).

### S6.2 · Catalog inventory (8 catalogs in v3.0)

| Catalog | Entries | Schema file | Source for v3.0 |
|---|---|---|---|
| `LAYERS` | 6 | `schema/catalogs/layer.js` | Lifted from v2.4.16 `core/config.js` |
| `BUSINESS_DRIVERS` | 8 | `schema/catalogs/businessDriver.js` | Lifted from v2.4.16 + per-driver hint/conversation starter |
| `ENV_CATALOG` | 8 | `schema/catalogs/envCatalog.js` | Lifted from v2.4.14 |
| `SERVICE_TYPES` | 10 | `schema/catalogs/serviceType.js` | Lifted from v2.4.12 |
| `GAP_TYPES` | 5 | `schema/catalogs/gapType.js` | Derived from DISPOSITION_ACTIONS minus `keep` and `retire` |
| `DISPOSITION_ACTIONS` | 7 | `schema/catalogs/dispositionAction.js` | Lifted from v2.4.8 Phase 17 |
| `CUSTOMER_VERTICALS` | alphabetised | `schema/catalogs/customerVertical.js` | Lifted from v2.4.14 |
| **`DELL_PRODUCT_TAXONOMY`** | **NEW** | `schema/catalogs/dellProductTaxonomy.js` | Authored fresh per directive R6.2.1 |

**S6.2.1 · Dell product taxonomy corrections** (locked from directive R6.2.1):
- Boomi NOT in taxonomy (divested).
- Secureworks Taegis NOT in taxonomy (divested).
- VMware referenced as partner technology, not Dell product.
- VxRail NOT a current positioning item; **Dell Private Cloud (via Dell Automation Platform with PowerFlex)** is.
- "SmartFabric Director" forbidden; current product is **"SmartFabric Manager"**.
- CloudIQ referenced under **Dell APEX AIOps** umbrella, not standalone.

**S6.2.2** · `DELL_PRODUCT_TAXONOMY.catalogVersion` follows `YYYY.MM` shape; v3.0 ships `"2026.04"`. Updateable independent of code releases starting v3.1.

**Trace**: directive §6.

---

## §7 · AI skill builder subsystem

**Status**: SCAFFOLD. Major surface area; concrete UI contracts TO AUTHOR after schema layer lands.

### S7.1 · Skill model (TO AUTHOR)
- Persisted shape: `{ skillId, skillType, entityKind?, promptTemplate, bindings, outputContract? }`.
- v3.0 stores skills in engagement; v3.1 promotes to per-owner collection (shape unchanged).

### S7.2 · Manifest generation (TO AUTHOR)
- Generated from schema at build time + runtime. Never hand-maintained.
- Generator: `services/manifestGenerator.js generateManifest()`. Walks `schema/index.js`, emits `{ sessionPaths, byEntityKind: { driver: { ownPaths, linkedPaths }, ... } }`.
- Linked compositions declared next to entity schemas (FK declarations + reverse-FK lookups).
- Drift test: regenerated manifest ≡ checked-in snapshot byte-for-byte. Drift fails build.

### S7.3 · Path resolution (TO AUTHOR)
- Save-time: every `{{path}}` checked against manifest for `(skillType, entityKind)`. Unknown path blocks save with structured error listing valid paths.
- Run-time: pure synchronous resolver. `undefined` results logged with skill id + engagement state. Silent `undefined` rendering forbidden.

### S7.4 · Skill output validation (TO AUTHOR)
- Structured-output skills: LLM call uses provider's structured-output API (function calling on Anthropic/OpenAI; equivalent on Gemini/Dell Sales Chat). Free-text parsing of structured fields forbidden.
- JSON Schema for structured output derived from field's Zod schema via `zod-to-json-schema`.
- Free-text skills (exec summary): output provenance-wrapped, never written into typed field.
- **Production-critical regression suite** per `OPEN_QUESTIONS_RESOLVED.md` Q3: `dell-mapping` (strict), `executive-summary` (smoke), `care-builder` (strict).

**Trace**: directive §7.

---

## §8 · AI provenance subsystem

**Status**: SCAFFOLD. Wrapper schema + drift detection contract below; UI integration TO AUTHOR.

### S8.1 · Provenance wrapper

```js
// schema/helpers/provenanceWrapper.js
const ProvenanceSchema = z.object({
  model:            z.string(),                              // "claude-3-5-sonnet" | "gemini-1.5-pro" | etc.
  promptVersion:    z.string(),                              // "skill:dellMap@1.4.0"
  skillId:          z.string(),
  runId:            z.string().uuid(),
  timestamp:        z.string().datetime(),
  catalogVersions:  z.record(z.string()),                    // { "DELL_PRODUCT_TAXONOMY": "2026.04", ... }
  validationStatus: z.enum(["valid","stale","invalid","user-edited"])
});

const provenanceWrapper = (valueSchema) => z.object({
  value:      valueSchema,
  provenance: ProvenanceSchema
});
```

**S8.1.1** · Plain strings in AI-authored slots (e.g., `instance.aiSuggestedDellMapping = "PowerStore"`) = schema violation. Compile-time check via Zod.

**S8.1.2** · Provenance set by skill runner only; never by user-facing code paths. Manual user edit demotes `validationStatus` to `"user-edited"` (provenance preserved as historical record).

**Trace**: directive §8.1.

### S8.2 · Catalog validation at suggestion time (TO AUTHOR)
- Catalog-constrained fields use structured output bound to catalog entry ids.
- Provider without structured output: validate text against catalog, retry up to fixed budget, set `validationStatus: "invalid"` on exhaustion.

### S8.3 · UI distinction (TO AUTHOR)
- AI-authored fields visually distinct via icon (no text label, per user's standing UI preference).
- `validationStatus === "stale" | "invalid"` renders warning icon with hover reason.

### S8.4 · Drift detection on reopen (TO AUTHOR)
- Integrity sweep (§10) re-validates every AI-authored field against current catalog versions on engagement load.
- Catalog version mismatch flips `validationStatus` to `"stale"`.
- Stale-flagging never silently rewrites the value (per `OPEN_QUESTIONS_RESOLVED.md` Q6).
- Aggregate drift count surfaced on engagement load screen ("3 AI suggestions are stale against current Dell catalog"). User not blocked.

**Trace**: directive §8.

---

## §9 · Migration system

**Status**: SCAFFOLD. Migrator contract + v2.0→v3.0 transformation steps below; full step-by-step rules + fixture set in `MIGRATION.md`.

### S9.1 · Migrator contract (TO AUTHOR)
- R9.1.1 · Pure: `(oldEngagement) => newEngagement`. No network/DOM/storage.
- R9.1.2 · Idempotent: running v2.0→v3.0 on a v3.0 engagement is a no-op (verified by test).
- R9.1.3 · Catalog reference bundled with migrator (catalogs evolve separately).
- R9.1.4 · Migrators run on load BEFORE validation. Post-migration validation must pass.

### S9.2 · Round-trip fixtures (TO AUTHOR — listed in MIGRATION.md)
- Empty engagement.
- Single-environment.
- Multi-environment.
- Cross-environment workload mappings.
- Cross-environment originId.
- Multi-environment gaps.
- Engagement with AI-provenanced fields (v3.0 only).
- Demo engagement (lifted from `state/demoSession.js`).

### S9.3 · v2.0 → v3.0 transformation (10 steps; full detail in MIGRATION.md)
1. Set `engagementMeta.schemaVersion = "3.0"`.
2. Rename `sessionId` → `engagementId` in meta block.
3. Add `ownerId = "local-user"` if absent.
4. Add `createdAt` + `updatedAt` from existing date or migration timestamp.
5. Drop `customer.segment` + `customer.industry`. Non-redundant content → `customer.notes`.
6. Extract `customer.drivers[]` → top-level `drivers` collection. Generate ids deterministically.
7. Convert arrays → `{ byId, allIds, ...indexes }` shape on load (in-memory; persistence stays flat).
8. Drop `gap.projectId` (now derived).
9. Wrap pre-existing free-text AI fields with provenance + `validationStatus: "stale"` + `model: "unknown"`. Inform user on load.
10. Stamp every record with `engagementId`.

### S9.4 · Failure handling (TO AUTHOR)
- Throw → caught → original preserved → user sees structured error + step that failed + migrator version. Recovery flow: download unmigrated `.canvas` OR proceed.
- No silent auto-recovery. Forbidden by directive R9.4.2.

**Trace**: directive §9.

---

## §10 · Integrity subsystem

**Status**: SCAFFOLD. Sweep contract + repair/quarantine rules below; full FK rule expansion in TESTS.md §V-INT.

### S10.1 · Sweep contract (TO AUTHOR)
- R10.1.1 · Pure: `(engagement) => { repaired, log }`. Same input → same output.
- R10.1.2 · Runs on every load, after migration, before UI.
- R10.1.3 · Consumes FK declarations from §S4.4 + invariants from §3.

### S10.2 · Repair rules (TO AUTHOR — concrete table)
- Orphan FK + optional → null.
- Orphan FK in array → drop from array.
- Orphan FK + required → quarantine record (not in active engagement until user resolves).
- Schema invariant violation (G6 etc.) → mechanical repair (reorder/insert) OR quarantine.
- Repairs logged with rule id + record id + field + before/after.
- Sweep NEVER creates entities, NEVER edits user-authored content (label/notes/description).

### S10.3 · v2.4.17 reuse (per HANDOVER §6.1)
- INT3-INT9 logic (orphan-drop, workload mappedAssetIds W4/W5, gap.affectedLayers G6, services normalization) ports to v3.0 with declarations consumed from FK declarations instead of hardcoded.

**Trace**: directive §10.

---

## §11 · Performance budget

**Status**: SCAFFOLD. Budgets locked from directive; calibration mechanism per `OPEN_QUESTIONS_RESOLVED.md` Q1.

### S11.1 · Budgets (locked)
- R11.1.1 · Single tab render against 200-instance reference engagement: <100ms.
- R11.1.2 · Full round-trip (load → migrate → integrity → hydrate → render default tab): <500ms.
- R11.1.3 · Selector cold-start on 200-instance reference: <50ms.
- R11.1.4 · Memoized hot-path: <1ms.

### S11.2 · Calibration mechanism (TO AUTHOR)
- Per Q1 resolution: calibration multiplier on whatever machine is running; SKU pinning deferred to v3.1.
- `tests/perf/baseline.local.json` (gitignored) records first-run wall-clock per machine.
- `tests/perf/baseline.ci.json` records CI runner profile (Node 20 LTS, 4 vCPU); checked in.
- Regression test: `current_run / baseline ≤ budget_multiplier` (5% default).

**Trace**: directive §11.

---

## §12 · Multi-engagement readiness

**Status**: SCAFFOLD. v3.0 stamps the fields; v3.1 surfaces them.

### S12.1 (TO AUTHOR)
- v3.0 stamps `engagementId`, `ownerId`, `createdAt`, `updatedAt` on every record.
- v3.1 adds engagement registry (top-level collection) + active-engagement pointer.
- v3.1 reads `ownerId` from stub auth module; v3.2 wires real auth.
- v3.1 introduces role-tagged read filter at selector layer (data unchanged; selectors take `viewer` arg).
- v3.2+ cross-engagement reporting runs against backend (§13), not localStorage.

**Trace**: directive §12.

---

## §13 · Backend migration (v3.2+)

**Status**: SCAFFOLD. Out of scope for v3.0 code; in-scope for forward planning.

### S13.1 (TO AUTHOR)
- Target: Postgres + Drizzle ORM. Document DB explicitly rejected (cross-engagement reporting requires SQL aggregation).
- DDL generated from Zod via `drizzle-zod`. Same artifact serves client validation + server schema.
- `drizzle-zod` consumes FK declarations to emit Postgres FK constraints.
- Array-of-FK fields → join tables (e.g., `gap_affected_environments`).
- `.canvas` remains import/export unit; backend decomposes on write, recomposes on read.
- Sync: Replicache (Rocicorp) is first reference architecture for LAN-only/offline-capable deployment. REST + optimistic updates is fallback.

**Trace**: directive §13.

---

## §14 · Testing strategy

**Status**: SCAFFOLD. 12 test categories from directive §14.1; full vector list in TESTS.md.

### S14.1 · Test categories
1. Schema property tests (V-SCH-*).
2. FK integrity tests (V-FK-*).
3. Schema invariant tests (V-INV-*).
4. Migration round-trip tests (V-MIG-*).
5. Selector correctness tests (V-SEL-*).
6. Selector purity tests (V-SEL-PURE-*).
7. Manifest generation tests (V-MFG-*).
8. Path resolution tests (V-PATH-*).
9. AI provenance tests (V-PROV-*).
10. Catalog version drift tests (V-DRIFT-*).
11. Performance regression tests (V-PERF-*).
12. End-to-end tab render tests (V-E2E-*).

### S14.2 · Cross-cutting relationship coverage (V-XCUT-1..5)
Per S3.7 table; see TESTS.md.

### S14.3 · Reference engagements
- `tests/fixtures/minimal.canvas` — smallest valid (1 driver, 1 env, 0 instances, 0 gaps).
- `tests/fixtures/acme-demo.canvas` — 200 instances. Performance reference.
- `tests/fixtures/cross-cutting.canvas` — 3 envs, every cross-cutting relationship exercised.

Stored at persisted shape (S4.2.1) so they exercise full load path.

### S14.4 · Mocking boundaries (closed list)
1. LLM provider (mocks return canned structured output keyed by prompt hash).
2. Catalog fetcher (v3.1+ network call; bundled snapshot in tests).
3. `Date.now()` + timestamp generators where determinism matters.
4. Autosave debouncer's timer.

**Forbidden mock targets**: selectors, actions, schemas, migrators, integrity sweep, manifest generator, any other internal module. Tests vary the engagement fixture, not the code under test.

### S14.5 · Anti-cheat checks
- No `if (process.env.NODE_ENV === 'test')` branches in production code.
- No `try { ... } catch { /* swallow */ }` (catch must log + rethrow OR have documented business reason).
- Tests must not assert on hardcoded constants returned by stubs.
- Coverage target: ≥90%. **Gate**: every R-number → ≥1 vector that fails when the requirement is violated.

**Trace**: directive §14.

---

## §15 · Out of scope (explicit)

Per directive §15. Re-listed here for SPEC traceability:

- Real authentication and session management (v3.2+).
- Server-side persistence (v3.2).
- Cross-engagement reporting (v3.2; requires backend).
- TypeScript migration (orthogonal; any time post-v3.0 schema layer).
- CRDT collaboration (not on roadmap).
- Event sourcing (rejected: complexity exceeds benefit at our scale).
- Custom in-memory database (rejected: `{byId, allIds}` + selectors sufficient through 200x current data).
- Replacing in-browser test runner (existing harness sufficient).

**Adding to this list**: a directive change request, not a SPEC revision.

---

## §16 · Glossary

Per directive §16. Re-listed here for SPEC traceability:

- **Engagement**: data-layer term for what UI calls "session". One workshop's data.
- **Entity**: any of the six top-level record types (engagement-meta, customer, driver, environment, instance, gap).
- **Selector**: pure memoized function from engagement to derived view.
- **Manifest**: generated catalog of bindable paths consumed by the AI skill builder palette.
- **Skill**: user-composed AI prompt template + bindings, optionally constrained by entity kind.
- **Linked composition**: merged record set a click-to-run skill receives as context (selected entity + FK-linked records across collections).
- **Provenance wrapper**: `{ value, provenance }` shape on every AI-authored field.
- **Catalog**: versioned read-only reference dataset (LAYERS, BUSINESS_DRIVERS, DELL_PRODUCT_TAXONOMY, etc.).
- **Integrity sweep**: pure function detecting + repairing FK and invariant violations on every load.
- **Reference engagement**: one of three checked-in `.canvas` files used for testing (S14.3).

---

## §17 · Open questions resolved

See [`OPEN_QUESTIONS_RESOLVED.md`](OPEN_QUESTIONS_RESOLVED.md). Three locked (Q5/Q6/Q7); four default-with-review (Q1/Q2/Q3/Q4).

---

## §18 · Document control

- **Authored**: 2026-04-30 at v3.0 branch scaffold + SPEC draft commit.
- **Current state**: DRAFT. §0–§4 + §15–§18 fully drafted. §5–§14 scaffolded; bodies TO AUTHOR.
- **Owner**: spec writer (Claude Opus 4.7 1M context, this session and successors).
- **Authority cascade**: `data-architecture-directive.md` → this SPEC → `MIGRATION.md` + `TESTS.md` → Suite N tests → code.
- **Change log**: subsection-level changes append-only at end of file.

### Change log

| Date | Section | Change |
|---|---|---|
| 2026-04-30 | All | Initial draft. §0–§4 + §15–§18 complete. §5–§14 scaffolded. |

End of SPEC.
