# Dell Discovery Canvas · v3.0 Implementation Specification

**Branch**: `v3.0-data-architecture` · **APP_VERSION**: `3.0.0-alpha` · **Authority**: derives from [`../../data-architecture-directive.md`](../../data-architecture-directive.md)

**Document state**: DRAFT 2026-05-01. **All 18 sections fully drafted.** Concrete file paths, function signatures, Zod sketches, FK declarations, repair tables, calibration mechanisms, and test vector ids are in place. Open items flagged inline with **TO RESOLVE** (require user decision) or **TO CONFIRM** (require external input — Dell IT contact, etc.).

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

**Bundled** ✅ LOCKED 2026-05-01: Zod loaded as ESM via `<script type="importmap">` mapping `"zod"` → `./vendor/zod/zod.mjs` (vendored copy of `zod@3.23.8/lib/index.mjs`, 149KB self-contained, zero internal imports). **S2.1.1**: vendoring chosen over CDN importmap because (a) the deployment target is Dell GB10 on LAN with no guaranteed outbound HTTP, (b) reproducibility — pinned vendor file is byte-stable; CDN endpoints can change or go down, (c) static-file harness has no bundler step where CDN-vs-vendor choice could be normalized later. Bumping Zod = update `vendor/zod/zod.mjs` + bump v3.0.x patch version.

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

Every UI view reads through a pure memoized selector over the engagement. No view writes back. No denormalized cache. **Memoization library: `memoize-one`** (per `OPEN_QUESTIONS_RESOLVED.md` Q2). Single library across all selectors.

### S5.1 · Selector contract

**S5.1.1 · Signature**: `(engagement, args?) => view`. The first argument is the **whole engagement** (not a slice). Args are optional and selector-specific (e.g., `{ state: "current" }` for matrix view). Selectors do not reach into `localStorage`, the DOM, the network, or any source other than the inputs. A selector that does is rejected at code review.

**S5.1.2 · Memoization**: each selector wraps its compute body with `memoize-one`:

```js
// selectors/matrix.js
import memoizeOne from "memoize-one";

const computeMatrix = (engagement, args) => { /* ... */ };
export const selectMatrixView = memoizeOne(computeMatrix, (a, b) =>
  a[0] === b[0] && a[1]?.state === b[1]?.state
);
```

The custom equality function compares `engagement` reference + the relevant `args` keys. Reference equality is sufficient for `engagement` because action functions (S4.1.3) always return new references.

**S5.1.3 · Library exclusivity**: ESLint rule `no-restricted-imports` forbids `reselect`, `proxy-memoize`, `lodash.memoize`, `nano-memoize` in the `selectors/` directory:

```js
// .eslintrc — restricted imports for selectors/
{
  "files": ["selectors/**/*.js"],
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [
        { "name": "reselect",       "message": "Use memoize-one (SPEC S5.1.3)" },
        { "name": "proxy-memoize",  "message": "Use memoize-one (SPEC S5.1.3)" },
        { "name": "lodash.memoize", "message": "Use memoize-one (SPEC S5.1.3)" }
      ]
    }]
  }
}
```

**S5.1.4 · Determinism**: two consecutive calls with `===`-equal inputs MUST return `===`-equal outputs. A selector that produces a different output for the same input on two consecutive calls is a defect (vector V-SEL-PURE-N).

**Trace**: directive R5.1.1–R5.1.4.

### S5.2 · Required selectors

Each selector lives in its own file under `selectors/` and is the sole source of truth for the view it produces. Output shapes are normative — UI components read these shapes directly.

#### S5.2.1 · `selectMatrixView(engagement, { state }) → MatrixView`

**File**: `selectors/matrix.js` · **Vector**: V-SEL-1

```js
// Output shape (Tab 2 + Tab 3 grid):
{
  state:    "current" | "desired",
  envIds:   string[],                            // env order (allIds; hidden envs omitted unless arg.includeHidden)
  layerIds: string[],                            // catalog order from LAYERS
  cells:    Record<envId, Record<layerId, {
    instanceIds: string[],                       // belonging to (envId, layerId, state)
    count:       number,
    vendorMix:   { dell: number, nonDell: number, custom: number }
  }>>
}
```

#### S5.2.2 · `selectGapsKanban(engagement) → KanbanView`

**File**: `selectors/gapsKanban.js` · **Vector**: V-SEL-2

```js
{
  byPhase: {
    now:   { open: GapId[], in_progress: GapId[], closed: GapId[], deferred: GapId[] },
    next:  { ... },
    later: { ... }
  },
  totalsByStatus: { open: n, in_progress: n, closed: n, deferred: n }
}
```

Closed-gap rollup exclusion is centralized here: `totalsByStatus.closed` is computed but excluded from any "active gaps" totals downstream. Selectors that need the active-only count read `totalsByStatus.open + totalsByStatus.in_progress + totalsByStatus.deferred` (NEVER recompute).

#### S5.2.3 · `selectProjects(engagement) → ProjectGrouping`

**File**: `selectors/projects.js` · **Vector**: V-SEL-3

Replaces v2.0 `gap.projectId` (dropped by §9.3 step 8). Projects are computed at projection time using deterministic grouping rules (TO ENCODE: same rules as v2.4.16 `services/projectsService.js buildProjects`, but consuming the v3.0 normalized store).

```js
{
  projects: [
    {
      projectId:    string,                       // deterministic from grouping key
      label:        string,
      gapIds:       GapId[],
      driverIds:    DriverId[],                   // unique drivers across the project's gaps
      affectedEnvironmentIds: EnvironmentId[],    // union across gaps
      phase:        "now" | "next" | "later",     // earliest-phase among constituent gaps
      mostUrgent:   "High" | "Medium" | "Low"     // max urgency among constituent gaps
    }
  ],
  unassigned: GapId[]                             // gaps that don't fit any project rule
}
```

#### S5.2.4 · `selectVendorMix(engagement) → VendorMixView`

**File**: `selectors/vendorMix.js` · **Vector**: V-SEL-4

```js
{
  totals:        { dell: n, nonDell: n, custom: n, total: n, dellPercent: n.nn },
  byLayer:       Record<layerId, { dell: n, nonDell: n, custom: n, total: n, dellPercent: n.nn }>,
  byEnvironment: Record<envId,   { dell: n, nonDell: n, custom: n, total: n, dellPercent: n.nn }>,
  kpiTiles: {
    dellDensity:           { value: n.nn, label: "Dell density" },
    mostDiverseLayer:      { layerId: string, vendorCount: n },
    topNonDellConcentration: { vendorName: string, count: n, percentOfNonDell: n.nn }
  }
}
```

`hidden: true` environments are excluded from totals (per v2.4.14 contract; preserved through v3.0).

#### S5.2.5 · `selectHealthSummary(engagement) → HealthSummary`

**File**: `selectors/healthSummary.js` · **Vector**: V-SEL-5

```js
{
  byLayer: Record<layerId, {
    bucketScore:  "green" | "amber" | "red",
    riskLabel:    string,
    counts:       { totalCurrent: n, totalDesired: n, openGaps: n, highRiskGaps: n, ... }
  }>,
  overall: {
    score:        n,                              // 0-100
    label:        "Excellent" | "Good" | "Concerning" | "Critical",
    highestRiskLayer: layerId
  }
}
```

`highRiskGaps` excludes `status === "closed"` (the v2.4.16 KD8 fix; preserved as a SPEC-level invariant, vector V-SEL-5b).

#### S5.2.6 · `selectExecutiveSummaryInputs(engagement) → ExecSummaryInputs`

**File**: `selectors/executiveSummary.js` · **Vector**: V-SEL-6

Structured input the executive-summary skill consumes via `selectLinkedComposition`. Not a UI view per se; it's the "machine-readable view of the engagement" that the LLM call reads.

```js
{
  engagementMeta:        { presalesOwner, status, engagementDate, customerName, vertical },
  drivers:               { topPriority: Driver, all: Driver[] },
  health:                HealthSummary,           // re-export
  gapHighlights:         { mostUrgent: Gap[], byPhase: { now: n, next: n, later: n } },
  vendorMixSummary:      { dellPercent: n.nn, mostDiverseLayer, topNonDellConcentration },
  catalogVersions:       { LAYERS: v, BUSINESS_DRIVERS: v, ... }   // for provenance stamping
}
```

The `catalogVersions` field is the **provenance bridge**: the executive-summary skill stamps these into its output's provenance wrapper (§8.1).

#### S5.2.7 · `selectLinkedComposition(engagement, { kind, id }) → LinkedRecord`

**File**: `selectors/linkedComposition.js` · **Vector**: V-SEL-7

The merged record set a click-to-run skill receives as context. For each entity kind, the linked composition includes the entity itself + its FK-linked records across collections.

```js
// Example: selectLinkedComposition(engagement, { kind: "driver", id: "drv-123" })
{
  kind:      "driver",
  entity:    Driver,                                 // engagement.drivers.byId[id]
  catalog:   BusinessDriverCatalogEntry,             // resolved via businessDriverId + catalogVersion
  linked: {
    gaps:               Gap[],                        // gaps where driverId === id
    affectedEnvironments: Environment[],              // union of gap.affectedEnvironments[]
    relatedInstances:   { current: Instance[], desired: Instance[] }
  }
}
```

The composition rules (which collection joins on which FK) are declared next to each entity schema (S2.2.1's `<entity>PathManifest`), NOT hand-coded in this selector. The selector consumes the manifest declarations.

**Cross-environment integrity**: linked compositions for gaps with `affectedEnvironments.length >= 2` MUST include all referenced environments and all related instances regardless of their environment. Vector V-XCUT-3 + V-XCUT-4 + V-XCUT-5.

### S5.3 · Forbidden patterns

**F5.3.1 · No denormalized cache alongside the store.** If a selector is slow, fix the selector. Do not mirror its output into `engagement.X`. Vector: V-SEL-PURE-1 detects denormalized fields by walking `engagement` and asserting only schema-declared fields exist.

**F5.3.2 · No view writes back.** Tab components read selector output and dispatch action functions (S4.1.2). They never edit projections in place. Lint rule (TO AUTHOR): an AST check that flags property assignment on selector return values.

**F5.3.3 · No module-scope mutable state outside memoization wrapper.** Selectors are pure files: import → compute → memoize → export. Module-level `let` declarations in `selectors/*.js` are forbidden.

### S5.4 · Test contract for §5

Vectors land in TESTS.md §V-SEL + §V-SEL-PURE.

- **Correctness** (V-SEL-1 … V-SEL-7): each selector against `tests/fixtures/cross-cutting.canvas` produces the documented output shape.
- **Purity** (V-SEL-PURE-1 … V-SEL-PURE-7): two consecutive calls with `===`-equal inputs return `===`-equal output (memoization works).
- **Reference equality on input change**: action function on the engagement → new reference → selector re-computes (memoization invalidates).

**Trace**: directive §5.

---

## §6 · Catalogs subsystem

### S6.1 · Catalog shape

**S6.1.1 · Wrapper schema** (`schema/helpers/catalog.js`):

```js
const CatalogEntrySchema = z.object({
  id:    z.string().min(1),
  label: z.string().min(1)
}).passthrough();   // catalog-specific fields permitted

const CatalogSchema = z.object({
  catalogId:      z.string().min(1),                  // "BUSINESS_DRIVERS", etc.
  catalogVersion: z.string().regex(/^\d{4}\.\d{2}$/), // "YYYY.MM"
  entries:        z.array(CatalogEntrySchema)
});
```

Catalog-specific fields (e.g., `BUSINESS_DRIVERS` entry's `hint` + `conversationStarter`) are added per-catalog by extending `CatalogEntrySchema`:

```js
// schema/catalogs/businessDriver.js
const BusinessDriverEntrySchema = CatalogEntrySchema.extend({
  hint:                 z.string(),
  conversationStarter:  z.string()
});
```

**S6.1.2 · Loader interface** (`services/catalogLoader.js`):

```js
// Single interface; v3.0 implementation reads bundled, v3.1 may swap to remote.
async function loadCatalog(catalogId: string): Promise<Catalog>;
async function loadAllCatalogs(): Promise<Record<string, Catalog>>;
```

v3.0 implementation:

```js
async function loadCatalog(catalogId) {
  const path = `catalogs/snapshots/${catalogId.toLowerCase()}.json`;
  const res = await fetch(path);
  if (!res.ok) throw new CatalogLoadError(catalogId, res.status);
  const raw = await res.json();
  return CatalogSchema.parse(raw);   // validates shape on load
}
```

`fetch()` resolves against the static `catalogs/snapshots/` directory (bundled into the Docker image). v3.1 may swap implementation to read a remote endpoint behind the same interface — no caller change.

**Trace**: directive R6.1.2 + `OPEN_QUESTIONS_RESOLVED.md` Q4.

**S6.1.3 · Catalog version stamping**: every persisted entity that references a catalog stamps the `catalogVersion` it was authored against alongside the catalog FK. See S3.3 (driver), S3.4 (environment) — both have `catalogVersion` fields. Drift detection (§S8.4) compares the persisted `catalogVersion` against the loaded catalog's current version.

### S6.2 · Catalog inventory (8 catalogs in v3.0)

| Catalog | Entries | Schema file | Per-entry extra fields | Source |
|---|---|---|---|---|
| `LAYERS` | 6 | `schema/catalogs/layer.js` | `tone`, `iconRef` | Lifted v2.4.16 `core/config.js` |
| `BUSINESS_DRIVERS` | 8 | `schema/catalogs/businessDriver.js` | `hint`, `conversationStarter` | Lifted v2.4.16 |
| `ENV_CATALOG` | 8 | `schema/catalogs/envCatalog.js` | `defaultTier`, `iconRef` | Lifted v2.4.14 |
| `SERVICE_TYPES` | 10 | `schema/catalogs/serviceType.js` | `domain`, `description` | Lifted v2.4.12 |
| `GAP_TYPES` | 5 | `schema/catalogs/gapType.js` | `dispositionMatch[]` | Derived from DISPOSITION_ACTIONS minus `keep` + `retire` |
| `DISPOSITION_ACTIONS` | 7 | `schema/catalogs/dispositionAction.js` | `gapTypeId?`, `assetLifecycle` | Lifted v2.4.8 Phase 17 |
| `CUSTOMER_VERTICALS` | alphabetised | `schema/catalogs/customerVertical.js` | (label only) | Lifted v2.4.14 |
| **`DELL_PRODUCT_TAXONOMY`** | **NEW** | `schema/catalogs/dellProductTaxonomy.js` | `category`, `umbrella?`, `partnerOnly` | Authored fresh per R6.2.1 |

**Snapshot storage**: each catalog persists as `catalogs/snapshots/<catalog_id_lowercase>.json`. Snapshot files are versioned in git; updating a snapshot bumps `catalogVersion` and lands in the same commit.

#### S6.2.1 · Dell product taxonomy corrections (locked from directive R6.2.1)

The `DELL_PRODUCT_TAXONOMY` is authored fresh in v3.0 to address Dell positioning errors observed in v2.4.x AI suggestions. Locked corrections:

| Concern | Resolution |
|---|---|
| Boomi | NOT in taxonomy (divested) |
| Secureworks Taegis | NOT in taxonomy (divested) |
| VMware | Referenced as `partnerOnly: true` (partner technology, not Dell product) |
| VxRail | NOT a current positioning item. Use **Dell Private Cloud** (via Dell Automation Platform with PowerFlex) |
| "SmartFabric Director" | Forbidden product name. Current product is **SmartFabric Manager** |
| CloudIQ | Referenced under `umbrella: "Dell APEX AIOps"`, not standalone |

**Validation contract**: `BUSINESS_DRIVERS`-driven LLM suggestions for `aiSuggestedDellMapping` (S3.5) and `aiMappedDellSolutions` (S3.6) use structured output bound to `DELL_PRODUCT_TAXONOMY.entries[].id`. The LLM cannot output a product id that is not in the catalog. Vector V-PROV-1 enforces this.

#### S6.2.2 · Dell taxonomy versioning

`DELL_PRODUCT_TAXONOMY.catalogVersion` follows `YYYY.MM` shape; v3.0 ships `"2026.04"`. Updateable independent of code releases starting v3.1 (per Q4 resolution: channel choice deferred).

When the taxonomy version bumps:
1. Snapshot file updated, `catalogVersion` bumped.
2. Persisted engagements with `catalogVersion: "2026.04"` references load + integrity sweep flips affected `aiMappedDellSolutions.provenance.validationStatus` to `"stale"` (§S8.4).
3. User sees aggregate drift count on engagement load screen.

### S6.3 · Test contract for §6

Vectors in TESTS.md §V-CAT.
- Each catalog snapshot loads + parses cleanly via `loadCatalog`.
- Catalog `catalogVersion` matches `YYYY.MM` regex.
- Dell taxonomy snapshot does NOT contain Boomi, Secureworks Taegis, VxRail, or "SmartFabric Director" entries (V-CAT-DELL-1).
- Dell taxonomy snapshot DOES contain SmartFabric Manager, Dell Private Cloud, Dell Automation Platform, PowerFlex (V-CAT-DELL-2).
- CloudIQ entry has `umbrella: "Dell APEX AIOps"` (V-CAT-DELL-3).

**Trace**: directive §6.

---

## §7 · AI skill builder subsystem

### S7.1 · Skill model

**S7.1.1 · Persisted shape** (`schema/skill.js`):

```js
const SkillSchema = z.object({
  ...crossCuttingFields,                                         // id, engagementId, createdAt, updatedAt
  skillId:         z.string().min(1),                            // user-visible id "skl-..."
  label:           z.string().min(1),
  skillType:       z.enum(["click-to-run", "session-wide"]),
  entityKind:      z.enum(["driver","currentInstance","desiredInstance","gap","environment","project"]).nullable(),
  promptTemplate:  z.string().min(1),                            // contains {{path}} placeholders
  bindings:        z.array(z.object({                            // derived from template at save time
    path:   z.string(),
    source: z.enum(["session","entity","linked","catalog"])
  })),
  outputContract:  z.union([                                     // optional structured-output schema reference
    z.literal("free-text"),
    z.object({ schemaRef: z.string() })                          // points to a Zod schema in schema/aiOutputs/
  ]).default("free-text"),
  validatedAgainst: z.string().regex(/^\d+\.\d+$/),              // schema version at save (drift detection)
  outdatedSinceVersion: z.string().regex(/^\d+\.\d+$/).nullable() // set when manifest paths drift
}).superRefine((skill, ctx) => {
  // R7.1.a: click-to-run REQUIRES entityKind; session-wide FORBIDS it.
  if (skill.skillType === "click-to-run" && skill.entityKind === null) {
    ctx.addIssue({ code: "custom", path: ["entityKind"],
      message: "click-to-run skills must declare entityKind" });
  }
  if (skill.skillType === "session-wide" && skill.entityKind !== null) {
    ctx.addIssue({ code: "custom", path: ["entityKind"],
      message: "session-wide skills must not declare entityKind" });
  }
});
```

**S7.1.2 · Storage**: skills are stored in `engagement.skills` (Collection<Skill>) in v3.0. v3.1 promotes them to a per-owner top-level collection without shape change. Per directive R7.1.2.

**S7.1.3 · Two skill types** (directive §7.1):
- **`click-to-run`**: operates on one entity user clicked (entity in `engagement.activeEntity`). Skill declares `entityKind`. Runtime dispatches via `selectLinkedComposition(engagement, { kind, id })` (S5.2.7).
- **`session-wide`**: operates on the whole engagement. No `entityKind`. Runtime resolves paths against `selectExecutiveSummaryInputs` (S5.2.6) + selectors named in template.

The two-mode dispatch is deterministic: skill declares scope at save time, runtime selects path resolver by scope type. No DOM-scraping pick mode (which v2.4.x used; rejected per "no patches" rule).

**Trace**: directive R7.1.1 + R7.1.2.

### S7.2 · Manifest generation

**S7.2.1 · Generator**: `services/manifestGenerator.js`

```js
function generateManifest(): Manifest {
  // Walks schema/index.js exports + each entity's <entityName>PathManifest array
  // + each entity's <entityName>FkDeclarations array.
  // Returns:
  return {
    sessionPaths: [
      // Top-level engagement paths usable in any skill:
      { path: "customer.name",          type: "string", label: "Customer name",   source: "session" },
      { path: "customer.vertical",      type: "string", label: "Customer vertical", source: "session" },
      { path: "engagementMeta.engagementDate", type: "date", label: "Engagement date", source: "session" },
      // Selector-derived inputs:
      { path: "execSummaryInputs.health.overall.label", type: "string", label: "Overall health label", source: "session" }
    ],
    byEntityKind: {
      driver: {
        ownPaths: [
          { path: "context.driver.priority",       type: "enum", label: "Driver priority",       source: "entity" },
          { path: "context.driver.outcomes",       type: "string", label: "Driver outcomes",     source: "entity" },
          { path: "context.driver.catalog.label",  type: "string", label: "Driver name",         source: "catalog" },
          { path: "context.driver.catalog.hint",   type: "string", label: "Driver hint",         source: "catalog" },
          { path: "context.driver.catalog.conversationStarter", type: "string", label: "Conversation starter", source: "catalog" }
        ],
        linkedPaths: [
          // Composed from FK declarations + reverse-FK lookups:
          { path: "context.driver.linkedGaps[*].description",  type: "string", label: "Linked gap description", source: "linked",
            composition: "engagement.gaps where gap.driverId === driver.id" },
          { path: "context.driver.linkedGaps[*].urgency",      type: "enum", label: "Linked gap urgency", source: "linked", composition: "..." },
          // ... etc
        ]
      },
      currentInstance: { ownPaths: [...], linkedPaths: [...] },
      desiredInstance: { ownPaths: [...], linkedPaths: [...] },
      gap:             { ownPaths: [...], linkedPaths: [...] },
      environment:     { ownPaths: [...], linkedPaths: [...] },
      project:         { ownPaths: [...], linkedPaths: [...] }
    }
  };
}
```

**S7.2.2 · Drift gate**: a checked-in `services/manifest.snapshot.json` records the current generated manifest. A test (V-MFG-1) calls `generateManifest()` and compares against the snapshot. **Mismatch fails the build.** This forces every schema change to update the manifest snapshot in the same commit, preventing silent drift.

**S7.2.3 · Linked-composition declarations** (directive R7.2.3): each entity schema file declares its incoming + outgoing relationships next to the schema (NOT in a separate file). Example for `schema/driver.js`:

```js
// schema/driver.js
export const driverLinkedCompositions = [
  { reverseField: "driverId", from: "gaps", as: "linkedGaps",
    description: "Gaps where gap.driverId === driver.id" }
];
```

The manifest generator walks these declarations + the FK declarations to compose `linkedPaths`.

**Trace**: directive R7.2.1–R7.2.4.

### S7.3 · Path resolution

**S7.3.1 · Save time** (`services/skillSaveValidator.js`):

```js
function validateSkillSave(skill, manifest): { ok: true } | { ok: false, errors: [...] };
```

For each `{{path}}` in `skill.promptTemplate`:
- If `skill.skillType === "session-wide"`: check `path` is in `manifest.sessionPaths`.
- If `skill.skillType === "click-to-run"`: check `path` is in `manifest.byEntityKind[skill.entityKind].ownPaths` OR `linkedPaths` OR `manifest.sessionPaths`.

Unknown path → block save → return `{ ok: false, errors: [{ path, message: "Path not in manifest", validPaths: [...] }] }`. UI surfaces structured error in the SkillIntentPanel.

**S7.3.2 · Run time** (`services/pathResolver.js`):

```js
function resolveTemplate(template: string, ctx: ResolverContext): string;
```

`ResolverContext` shape:
- For session-wide: `{ engagement, execSummaryInputs }` (passed by skill runner).
- For click-to-run: `{ engagement, activeEntity, linkedComposition, catalogs }` (passed by skill runner; computed via `selectLinkedComposition` once).

The resolver walks each `{{path}}` and substitutes the resolved value. Resolution is **pure + synchronous**. Async work (LLM call) is one layer up.

**S7.3.3 · `undefined` handling** (directive R7.3.3): a resolved path returning `undefined` is logged via `services/skillRuntimeLog.js logUndefinedPath({ skillId, path, engagementSnapshot })`. Silent rendering of `undefined` into a prompt is forbidden — the resolver substitutes the literal placeholder `[?]` and logs the incident. UI shows a yellow chip on the result panel: "1 path resolved to undefined; check log."

**Trace**: directive R7.3.1–R7.3.4.

### S7.4 · Skill output validation

**S7.4.1 · Structured output for catalog-bound fields**: skills whose output contract is a structured shape (e.g., `aiSuggestedDellMapping`) MUST use the LLM provider's structured-output mechanism. Provider matrix:

| Provider | Mechanism |
|---|---|
| Anthropic Claude | Tool use with input_schema |
| OpenAI / Azure OpenAI | Function calling with parameters schema |
| Google Gemini | Function declarations + tool config |
| Dell Sales Chat | (TO CONFIRM with Dell IT contact at v3.1) |
| Local LLM (vLLM / llama.cpp) | grammar-constrained output |

JSON Schema is generated from the field's Zod schema via `zod-to-json-schema`. The LLM cannot hallucinate a Dell product not in the catalog because the schema constrains the output to `DELL_PRODUCT_TAXONOMY.entries[].id`.

**Forbidden**: parsing structured fields from free-text LLM output via regex/heuristics.

**S7.4.2 · Free-text skills** (executive summary, narrative drafts): output is not constrained at the LLM call. Output is provenance-wrapped (§8) and stored in a free-text-typed field, never written into a typed field that has a Zod constraint other than `z.string()`.

**S7.4.3 · Production-critical regression suite** (per `OPEN_QUESTIONS_RESOLVED.md` Q3):

| Skill | Output kind | Vectors | Rigor |
|---|---|---|---|
| `dell-mapping` | Structured (catalog-bound) | V-PROD-1 .. V-PROD-5 | Strict: shape validates against Zod; every entry id is in `DELL_PRODUCT_TAXONOMY`; no Boomi/Taegis/VxRail violations; provenance fully populated; round-trips through save-load |
| `executive-summary` | Free text | V-PROD-6 .. V-PROD-8 | Smoke: non-empty, contains customer name, does not echo system prompt, provenance stamped |
| `care-builder` | Structured (skill-shape) | V-PROD-9 .. V-PROD-11 | Strict: produces a save-able skill record that round-trips through `validateSkillSave` |

Mock LLM responses (per S14.4) are keyed by prompt hash so the regression suite is deterministic.

**S7.4.4 · Skill output evaluation framework** (TO CONFIRM in v3.1): regression vectors expand into a formal LLM-eval suite (Hamel Husain–style: golden expectations, drift detection, model-comparison runs). v3.0 ships the deterministic mock-based regression set; v3.1 layers a real-LLM eval pass.

### S7.5 · Skill builder UI (2-step Intent panel)

**S7.5.1 · Surface**: NEW `ui/views/SkillIntentPanel.js`. Replaces v2.4.x SkillAdmin form.

**Step 1 — Scope picker**: radio `skillType` ∈ {click-to-run, session-wide}.
**Step 2 — Entity-kind picker** (only on click-to-run): dropdown `entityKind` ∈ {driver, currentInstance, desiredInstance, gap, environment, project}.

The chip palette (binding paths) filters dynamically based on (skillType, entityKind). Available chips = `manifest.sessionPaths` ∪ `manifest.byEntityKind[entityKind].ownPaths` ∪ `manifest.byEntityKind[entityKind].linkedPaths`.

**S7.5.2 · Drift indicator**: a skill row in SkillAdmin where `outdatedSinceVersion` is set renders an amber "Needs update" badge + a "Re-run prompt builder" button that pre-fills the SkillIntentPanel with the skill's current state.

**S7.5.3 · Result panel** (replaces v2.4.x plain-text "ugly white textbox"):
- Free-text skills: rendered with markdown via a vetted parser (NOT a regex-replace).
- Structured-output skills: rendered as a structured proposal card (one card per proposed entry, with apply/discard).
- Every result has a deterministic SmartTitle header built from the resolved entity (NOT the LLM): e.g., "Working on: Cyber Resilience · Strategic driver · High priority".

**Trace**: directive §7 + HANDOVER §4.1 + §4.2 + §4.3.

### S7.6 · Test contract for §7

Vectors in TESTS.md §V-MFG (manifest gen) + §V-PATH (path resolution) + §V-PROD (production-critical regression).

**Trace**: directive §7.

---

## §8 · AI provenance subsystem

### S8.1 · Provenance wrapper

```js
// schema/helpers/provenanceWrapper.js
const ProvenanceSchema = z.object({
  model:            z.string(),                              // "claude-3-5-sonnet" | "gemini-1.5-pro" | "dell-sales-chat" | "local-llm" | "unknown"
  promptVersion:    z.string(),                              // "skill:dellMap@1.4.0" — skill id + semver
  skillId:          z.string(),
  runId:            z.string().uuid(),
  timestamp:        z.string().datetime(),
  catalogVersions:  z.record(z.string()),                    // { "DELL_PRODUCT_TAXONOMY": "2026.04", "BUSINESS_DRIVERS": "2026.04" }
  validationStatus: z.enum(["valid","stale","invalid","user-edited"])
});

const provenanceWrapper = (valueSchema) => z.object({
  value:      valueSchema,
  provenance: ProvenanceSchema
});
```

**S8.1.1 · Plain-string violation**: `instance.aiSuggestedDellMapping = "PowerStore"` is a schema violation. The slot's Zod type is `provenanceWrapper(DellMappingSchema).nullable()`. The migrator (§S9.3 step 9) wraps any pre-existing v2.0 plain strings with `validationStatus: "stale"` + `model: "unknown"`.

**S8.1.2 · Authorship boundaries**:
- **Skill runner sets provenance**: when a skill produces an AI-authored value, the runner constructs the `{value, provenance}` envelope. No user-facing code path constructs provenance.
- **User edit demotes status**: when the user edits the value field through the UI, `validationStatus` flips to `"user-edited"`. The original provenance is preserved (model, promptVersion, runId, timestamp, catalogVersions all unchanged) as a historical record.
- **Re-running a skill replaces** the entire `{value, provenance}` envelope. The old envelope is not retained (provenance is a "current state" record, not an audit log).

### S8.2 · Catalog validation at suggestion time

**S8.2.1 · Primary defense — structured output**: catalog-bound fields use the LLM provider's structured-output mechanism (§S7.4.1) bound to `<CATALOG_ID>.entries[].id`. The LLM literally cannot output a non-catalog id. Vector V-PROV-1 enforces this by mocking a provider response that violates the schema and asserting the response is rejected before persistence.

**S8.2.2 · Fallback for providers without structured output**: validate the LLM's text output against the catalog. On miss:

```js
async function validateAndRetry(skill, ctx, attempts = 0): Promise<AIValue> {
  const raw = await callLLM(skill, ctx);
  const validated = validateAgainstCatalog(raw, skill.outputContract);
  if (validated.ok) return wrapWithProvenance(validated.value, skill, ctx);
  if (attempts >= MAX_RETRIES) {
    return wrapWithProvenance(validated.bestEffortValue, skill, ctx, { validationStatus: "invalid" });
  }
  // Retry with stricter prompt (appends "ONLY use entries from this list: <ids>")
  return validateAndRetry(skill, ctx.withStricterPrompt(catalog), attempts + 1);
}
```

`MAX_RETRIES = 2` (single retry beyond the initial attempt). Beyond retries: persist with `validationStatus: "invalid"` and surface visibly in UI per §S8.3.

### S8.3 · UI distinction

**S8.3.1 · Icon-only marker**: AI-authored fields are visually distinct via a `<svg>` Lucide icon (sparkle), NEVER a text label. Per the user's standing UI preference (rejected text-label markers in v2.4.x). The icon's tooltip discloses provenance (model + skillId + timestamp) on hover.

**S8.3.2 · Status icons**:

| `validationStatus` | Icon | Tooltip |
|---|---|---|
| `valid` | sparkle (default) | "AI-suggested · valid" + provenance summary |
| `user-edited` | pencil-with-sparkle | "Edited from AI suggestion" + provenance summary |
| `stale` | sparkle-with-amber-dot | "Catalog version drifted; re-run skill to refresh" |
| `invalid` | sparkle-with-red-dot | "AI output failed validation; review and edit manually" |

CSS in `styles.css` reuses the `.tag[data-t]` primitive from v2.4.13 GPLC topbar foundation; data attribute `data-validation-status` keys the color.

### S8.4 · Drift detection on reopen

**S8.4.1 · Algorithm**: on engagement load, integrity sweep (§S10) re-validates every AI-authored field:

```js
function detectAIProvenanceDrift(engagement, currentCatalogs) {
  const stale = [];
  for (const record of allAIProvenancedFields(engagement)) {
    for (const [catalogId, recordedVersion] of Object.entries(record.provenance.catalogVersions)) {
      const currentVersion = currentCatalogs[catalogId].catalogVersion;
      if (recordedVersion !== currentVersion) {
        stale.push({ recordPath: pathTo(record), catalogId, recordedVersion, currentVersion });
      }
    }
  }
  return stale;
}
```

The integrity sweep flips `record.provenance.validationStatus` from `"valid"` to `"stale"` for each match. Already-`"user-edited"` status is preserved (user-edited fields don't go stale; they're already off the AI-authoritative track). Already-`"invalid"` stays `"invalid"`.

**S8.4.2 · No silent rewrites**: stale-flagging NEVER rewrites the `value` field. The user decides whether to re-run the skill. Per `OPEN_QUESTIONS_RESOLVED.md` Q6.

**S8.4.3 · User surface on load**: aggregate drift count rendered on engagement-load screen as a non-blocking banner: "3 AI suggestions are stale against current Dell catalog. Review in: [Tab name list]." User can dismiss + work normally; the badges per-field remain.

### S8.5 · Test contract for §8

Vectors in TESTS.md §V-PROV.

- V-PROV-1: structured-output schema rejects out-of-catalog Dell product id.
- V-PROV-2: user edit flips `validationStatus` to `"user-edited"`; provenance preserved.
- V-PROV-3: catalog version bump on reload flips `valid` → `stale` (V-DRIFT-1 in §V-DRIFT).
- V-PROV-4: invalid status field is rendered with red-dot icon + tooltip text matches.
- V-PROV-5: re-running a skill on a `stale` field replaces the whole envelope; new `validationStatus = "valid"`.

**Trace**: directive §8.

---

## §9 · Migration system

This section authoritatively defines the migrator contract and the v2.0 → v3.0 transformation steps. Full per-step rules + the 8-fixture round-trip set live in [`MIGRATION.md`](MIGRATION.md). This SPEC §9 is the contract; MIGRATION.md is the elaboration.

### S9.1 · Migrator contract

**S9.1.1 · Signature** (`migrations/v2-0_to_v3-0.js`):

```js
// Pure function. No network, no DOM, no storage. Deterministic.
function migrate_v2_0_to_v3_0(oldEngagement: V2Engagement): V3Engagement;

// Plus a registration in migrations/index.js:
const MIGRATIONS = {
  "2.0": { to: "3.0", migrate: migrate_v2_0_to_v3_0 }
  // future: "3.0": { to: "3.1", migrate: migrate_v3_0_to_v3_1 }, etc.
};
```

**S9.1.2 · Idempotency**: running `migrate_v2_0_to_v3_0` on a v3.0 engagement is a no-op (output deep-equals input). Vector V-MIG-IDEM detects regressions. Idempotency requires deterministic id generation (S3.0.1) — re-running on the same v2.0 input must produce identical v3.0 ids.

**S9.1.3 · No external deps**: migrators do not consult the loaded catalog at runtime. Catalog references are bundled with the migrator as snapshots (`migrations/v2-0_to_v3-0.catalogSnapshot.json`). Catalogs evolve on a separate cadence; migrator behavior must be reproducible against the catalog version it shipped with.

**S9.1.4 · Run order**: migrator runs on load BEFORE validation (per directive R2.2.5). Post-migration validation against the target schema MUST pass. A validation failure post-migration is a migrator defect, not a user error — bug fix in the migrator + new fixture vector.

### S9.2 · Round-trip fixtures (8 cases)

Fixtures live in `tests/fixtures/migration/v2-0/`:

| Fixture | Coverage |
|---|---|
| `empty.canvas` | Smallest valid v2.0 engagement; 1 customer, 0 drivers, 0 envs, 0 instances, 0 gaps |
| `single-env.canvas` | 1 env, 5 instances (current), 5 instances (desired), 3 gaps, 2 drivers |
| `multi-env.canvas` | 3 envs, 30 instances total, 8 gaps, 4 drivers |
| `cross-env-workload.canvas` | 1 workload-layer instance with `mappedAssetIds` referencing instances in 2 other envs |
| `cross-env-origin.canvas` | A desired-state instance with `originId` pointing at a current instance in a different env |
| `multi-env-gaps.canvas` | A gap with `affectedEnvironments.length === 3`, hitting all 3 envs |
| `ai-provenanced.canvas` | v2.4.x engagement with `mappedDellSolutions` plain-string field set on a gap (the migrator wraps this with `validationStatus: "stale"`) |
| `acme-demo.canvas` | The full demo engagement (lifted from v2.4.16 `state/demoSession.js`) |

**S9.2.1 · Append-only fixture set**: once a fixture is added, the migrator's behavior on it is locked. Vector V-MIG-1 ... V-MIG-8 run the migrator forward, validate against `EngagementSchema`, then run again to verify idempotency.

**S9.2.2 · Reference engagements** (S14.3) are produced by running these v2.0 fixtures through the migrator. The output is checked in as `tests/fixtures/v3-0/<name>.canvas`.

### S9.3 · v2.0 → v3.0 transformation (10 steps)

Each step is a pure function on the engagement; the migrator pipes them.

#### Step 1 — Schema version stamp
```js
oldEngagement.engagementMeta.schemaVersion = "3.0";
```

#### Step 2 — sessionId → engagementId
```js
const oldId = oldEngagement.sessionMeta?.sessionId
  ?? oldEngagement.engagementMeta?.engagementId
  ?? generateDeterministicId("engagement", oldEngagement);
oldEngagement.engagementMeta = {
  ...oldEngagement.engagementMeta,
  engagementId: oldId
};
delete oldEngagement.sessionMeta;
```

#### Step 3 — Add `ownerId`
```js
if (!engagementMeta.ownerId) engagementMeta.ownerId = "local-user";
```

#### Step 4 — Add `createdAt` / `updatedAt`
```js
const now = ctx.migrationTimestamp;          // set once per migration run; deterministic for tests
engagementMeta.createdAt ??= sessionMeta?.savedAt ?? now;
engagementMeta.updatedAt ??= sessionMeta?.savedAt ?? now;
```

#### Step 5 — Drop `customer.segment` / `customer.industry`
```js
const { segment, industry, ...rest } = customer;
const extras = [segment, industry].filter(s => s && s !== rest.vertical && s !== rest.notes);
const notes = extras.length ? [rest.notes, ...extras].filter(Boolean).join(" · ") : rest.notes;
return { ...rest, notes };
```

The drop is informational-only; existing `vertical` is the authoritative segment. See `OPEN_QUESTIONS_RESOLVED.md` Q7 for v3.2 backend-promotion plan.

#### Step 6 — Extract `customer.drivers[]` → top-level `drivers`
```js
const drivers = (oldEngagement.customer.drivers ?? []).map((d, i) => ({
  id:               generateDeterministicId("driver", oldEngagement.engagementMeta.engagementId, i),
  engagementId:     oldEngagement.engagementMeta.engagementId,
  businessDriverId: d.driverId ?? d.businessDriverId,
  catalogVersion:   ctx.catalogSnapshot.BUSINESS_DRIVERS.catalogVersion,
  priority:         d.priority ?? "Medium",
  outcomes:         d.outcomes ?? "",
  createdAt:        engagementMeta.createdAt,
  updatedAt:        engagementMeta.updatedAt
}));
oldEngagement.drivers = collection(drivers);    // helper that builds {byId, allIds}
delete oldEngagement.customer.drivers;
```

#### Step 7 — Array → Collection on load
For `environments`, `instances` (all states), `gaps`, the on-load step transforms `Array<T>` into `{ byId: Record<id, T>, allIds: id[] }`. The persistence shape (S4.2.1) stays flat to support backend round-trip; only the in-memory hydration is collection-shaped.

The migrator's responsibility: ensure each entity has `id` (generate deterministically if absent) before collection construction.

#### Step 8 — Drop `gap.projectId`
```js
gaps.forEach(g => { delete g.projectId; });
```

`projectId` is now computed by `selectProjects` (S5.2.3). The grouping is deterministic; existing UIs that referenced `gap.projectId` migrate to reading `selectProjects(engagement).projects[*].gapIds`.

#### Step 9 — Wrap pre-existing free-text AI fields
```js
// gaps with `mappedDellSolutions` as a plain string
gaps.forEach(g => {
  if (typeof g.mappedDellSolutions === "string" && g.mappedDellSolutions) {
    g.aiMappedDellSolutions = {
      value: { rawLegacy: g.mappedDellSolutions, products: [] },
      provenance: {
        model:            "unknown",
        promptVersion:    "legacy:v2.4.x",
        skillId:          "unknown",
        runId:            generateDeterministicId("provenanceRun", g.id),
        timestamp:        ctx.migrationTimestamp,
        catalogVersions:  { DELL_PRODUCT_TAXONOMY: "unknown" },
        validationStatus: "stale"          // forces user to re-run
      }
    };
    delete g.mappedDellSolutions;
  }
});
```

The user is informed on first load: "N AI suggestions migrated from v2.x. Re-run skills to refresh against current Dell catalog."

#### Step 10 — Stamp `engagementId` on every record
After steps 1-9, walk every record and ensure `record.engagementId === engagementMeta.engagementId`. Records missing the field get it stamped; mismatched records (shouldn't happen in v2.0 → v3.0 since v2.0 is single-engagement) raise a migrator error.

### S9.4 · Failure handling

**S9.4.1 · Catch + preserve**: any thrown exception during migration is caught by the load harness:

```js
try {
  const v3Engagement = pipeline.run(v2Engagement, ctx);
  return { ok: true, engagement: v3Engagement };
} catch (err) {
  return {
    ok: false,
    error: {
      code:           "MIGRATION_FAILED",
      step:           err.migrationStep ?? "unknown",
      migratorVersion: "v2-0_to_v3-0",
      message:        err.message,
      originalEnvelope: v2Engagement      // user can download this
    }
  };
}
```

**S9.4.2 · User recovery flow** (`ui/views/MigrationFailedDialog.js`):
- Download unmigrated `.canvas` button (saves the `originalEnvelope`).
- Try-again button (re-runs migrator with verbose logging).
- "Continue as fresh engagement" button (loads empty v3.0 engagement, original is preserved as a download).

**S9.4.3 · Forbidden**: silent auto-recovery, error swallowing, "fall back to v2.0 mode" code paths. v3.0 is single-mode.

### S9.5 · Test contract for §9

Vectors in TESTS.md §V-MIG.

- V-MIG-1 ... V-MIG-8: each fixture migrates forward + validates + round-trips.
- V-MIG-IDEM-1: running migrator on already-v3.0 engagement is a no-op (`deepEqual(input, output)`).
- V-MIG-FAIL-1: throwing migrator returns structured error envelope with the failing step.
- V-MIG-DETERM-1: running migrator twice on the same input produces identical output (id generation determinism).

**Trace**: directive §9.

---

## §10 · Integrity subsystem

### S10.1 · Sweep contract

**S10.1.1 · Signature** (`state/integritySweep.js`):

```js
function runIntegritySweep(engagement: Engagement): {
  repaired:   Engagement,
  log:        IntegrityLogEntry[],
  quarantine: QuarantineEntry[]
};
```

The sweep is **pure**: same input produces same output. Vector V-INT-PURE-1 checks this by running the sweep twice on the same engagement and asserting `deepEqual` outputs.

**S10.1.2 · Run order**: load harness runs the sweep AFTER migration (§9), AFTER schema validation, BEFORE the engagement reaches the UI:

```
file → migrate → validate → integritySweep → hydrate indexes → UI
```

**S10.1.3 · Inputs**: the sweep consumes:
- The engagement (passed by argument).
- FK declarations exported by `schema/<entity>.js` (S4.4).
- Schema invariants encoded in entity `superRefine` blocks (§3).
- Catalog snapshots (read via `services/catalogLoader.js`, cached at module scope after first load).

The sweep does NOT touch the DOM, network, or storage. It is a pure data transform.

### S10.2 · Repair rules

**S10.2.1 · Repair table** (per FK declaration / invariant):

| Violation | Source | Repair action | Logged as |
|---|---|---|---|
| Orphan FK, optional, scalar | FK declaration `required: false`, scalar field | Set to `null` | `INT-ORPHAN-OPT` |
| Orphan FK, optional, array element | FK declaration `required: false, isArray: true` | Remove from array | `INT-ORPHAN-ARR` |
| Orphan FK, required, scalar | FK declaration `required: true`, scalar field | Quarantine the holding record | `INT-ORPHAN-REQ` |
| FK targetFilter mismatch (e.g. originId pointing at `state: "desired"`) | FK declaration `targetFilter` | Set to `null` (treat as orphan-optional); log violation | `INT-FILTER-MISS` |
| `gap.affectedLayers[0] !== gap.layerId` (G6) | superRefine | Insert `gap.layerId` at index 0 (mechanical repair) | `INT-G6-REPAIR` |
| `instance.mappedAssetIds` non-empty on non-workload layer | superRefine | Empty the array; log violation | `INT-MAP-NONWL` |
| `instance.originId` set on `state === "current"` | superRefine | Set to `null` | `INT-ORIGIN-CUR` |
| `instance.priority` set on `state === "current"` | superRefine | Set to `null` | `INT-PRI-CUR` |
| `record.engagementId !== engagementMeta.engagementId` | S4.3.1 | Stamp with `engagementMeta.engagementId` | `INT-EID-STAMP` |
| Catalog version mismatch on AI-authored field | S8.4.1 | Flip `provenance.validationStatus` to `"stale"` | `INT-AI-DRIFT` |

**S10.2.2 · Quarantine semantics**: a quarantined record is removed from the active engagement collection but preserved in `engagement.integrityLog.quarantine`. The UI surfaces a "N records need review" banner with a quarantine viewer modal where the user can:
- Edit the orphan FK and re-attempt admission.
- Delete the record permanently (explicit user action; never auto-deleted).
- Restore (if the FK target reappears).

Quarantine entries are TRANSIENT (stripped on save), same as `integrityLog`. The unrepairable orphan persists in the `.canvas` file; it gets quarantined again on next load until the user resolves it.

**S10.2.3 · Repair log entry shape**:

```js
const IntegrityLogEntrySchema = z.object({
  ruleId:    z.string(),                             // "INT-G6-REPAIR" etc.
  recordKind: z.enum(["driver","environment","instance","gap","customer","engagementMeta"]),
  recordId:  z.string(),
  field:     z.string(),                             // dot-path
  before:    z.unknown(),
  after:     z.unknown(),
  timestamp: z.string().datetime()
});
```

**S10.2.4 · Forbidden operations** (directive R10.3.1 + R10.3.2):
- Sweep NEVER creates new entities. It only deletes, nulls, reorders, or quarantines.
- Sweep NEVER edits user-authored content fields (`label`, `notes`, `description`, `outcomes`). It operates only on structural fields (FK refs, ordering arrays, validation flags).

### S10.3 · v2.4.17 reuse map

The v2.4.17 work-in-progress (preserved at tag `v2.4.17-wip-snapshot`) shipped a working integrity sweep. v3.0 ports the **logic**, not the **structure**:

| v2.4.17 rule | v3.0 mapping |
|---|---|
| INT3 — orphan environment FK on instance | `INT-ORPHAN-REQ` (declarative via `instanceFkDeclarations.environmentId.required = true`) |
| INT4 — orphan layer FK on gap | `INT-ORPHAN-REQ` (declarative via `gapFkDeclarations.layerId.required = true`) |
| INT5 — workload mappedAssetIds W4 (orphan ids) | `INT-ORPHAN-ARR` (declarative via `isArray: true`) |
| INT6 — workload mappedAssetIds W5 (non-workload populated) | `INT-MAP-NONWL` (declarative via instance superRefine) |
| INT7 — gap.affectedLayers G6 invariant | `INT-G6-REPAIR` (declarative via gap superRefine) |
| INT8 — gap.services array normalization | `INT-ORPHAN-ARR` for unknown service ids |
| INT9 — gap.urgencyOverride staleness | (deferred to v3.0; treated as user-authored, not subject to integrity sweep) |

**Net**: the v2.4.17 rules survive structurally; v3.0 expresses them as data (FK declarations + superRefines) rather than as imperative code in `state/sessionIntegrity.js`. The sweep itself becomes a small declaration interpreter (~150 LoC) instead of a per-rule procedure.

### S10.4 · Test contract for §10

Vectors in TESTS.md §V-INT.

- V-INT-1 ... V-INT-N: one vector per entry in S10.2.1 table. Each vector constructs an engagement with the violation, runs the sweep, asserts the repair was applied OR the record was quarantined, asserts the log entry was emitted.
- V-INT-PURE-1: sweep is pure (deepEqual outputs on consecutive calls).
- V-INT-NOCREATE-1: sweep never adds entities to a collection.
- V-INT-NOEDIT-1: sweep never modifies `label`, `notes`, `description`, `outcomes` fields.

**Trace**: directive §10.

---

## §11 · Performance budget

### S11.1 · Budgets (locked from directive §11.1)

| Budget | Measurement | Limit |
|---|---|---|
| **Tab render** (R11.1.1) | Single tab render against 200-instance reference engagement | < 100ms |
| **Full round-trip** (R11.1.2) | Load engagement → migrate → integrity sweep → hydrate indexes → render default tab | < 500ms |
| **Selector cold start** (R11.1.3) | Any single selector returns against 200-instance reference, fresh memo cache | < 50ms |
| **Selector hot path** (R11.1.4) | Memoized selector with unchanged input | < 1ms |

Budgets apply to the **reference laptop profile** documented in `tests/perf/baseline.md`. Real-machine runs use a **calibration multiplier** (per Q1 resolution); the absolute milliseconds are not pinned to one SKU.

### S11.2 · Calibration mechanism

**S11.2.1 · Two baseline files**:

| File | Status | Purpose |
|---|---|---|
| `tests/perf/baseline.ci.json` | Checked in | Documents the CI runner's profile (Node version, CPU class, RAM, OS). Defines the budget's "1.0× multiplier" wall-clock numbers. |
| `tests/perf/baseline.local.json` | Gitignored | Generated on first local run via `npm run perf:calibrate`. Records the local machine's wall-clock for the same harness. Used to derive a per-machine multiplier. |

**S11.2.2 · Calibration multiplier**:

```js
// tests/perf/perfHarness.js
function loadCalibration() {
  const ci    = require("./baseline.ci.json");
  const local = require("./baseline.local.json");
  return {
    machineMultiplier: local.referenceRoundTrip / ci.referenceRoundTrip
    // e.g., local machine takes 600ms vs CI 500ms → multiplier 1.2
  };
}

function assertWithinBudget(actualMs, budgetMs, calibration) {
  const adjustedBudget = budgetMs * calibration.machineMultiplier * 1.05;  // 5% headroom
  if (actualMs > adjustedBudget) {
    throw new PerfRegression({ actualMs, adjustedBudget, calibration });
  }
}
```

**S11.2.3 · Calibration run**: `npm run perf:calibrate` runs the perf harness 5 times against `tests/fixtures/acme-demo.canvas`, drops the highest + lowest wall-clock, averages the middle 3, writes `baseline.local.json`. First-run takes ~30 seconds. Calibration file is regenerated when:
- Hardware changes (user runs on a different machine).
- `tests/perf/baseline.ci.json` is updated (runner profile changes).

### S11.3 · Performance regression tests

Vectors in TESTS.md §V-PERF.

| Vector | Test | Limit |
|---|---|---|
| V-PERF-1 | `selectMatrixView` cold start on `acme-demo.canvas` | <50ms × calibration |
| V-PERF-2 | `selectMatrixView` hot path (memoized) | <1ms × calibration |
| V-PERF-3 | All 7 required selectors cold-start total | <300ms × calibration |
| V-PERF-4 | Full round-trip (load + migrate + integrity + hydrate + Tab 2 render) | <500ms × calibration |
| V-PERF-5 | Single tab render after engagement loaded | <100ms × calibration |
| V-PERF-6 | Integrity sweep on `acme-demo.canvas` | <100ms × calibration |

**Gate**: V-PERF-* failures BLOCK CI (fail the build). Performance regressions are not warnings; they are bugs that ship-block.

**S11.3.1 · Reference engagement scale guard**: vector V-PERF-SCALE-1 asserts `acme-demo.canvas` has exactly 200 instances. If the demo grows, the budgets must be recalibrated via a directive change request — silent demo-size drift would silently relax the budgets.

**Trace**: directive §11 + `OPEN_QUESTIONS_RESOLVED.md` Q1.

---

## §12 · Multi-engagement readiness

**Intent**: v3.0 stamps the fields; v3.1 surfaces them; v3.2 wires the backend. The schema layer is forward-compatible from day one.

### S12.1 · v3.0 deliverables (in this release)

| Field | Where | Default |
|---|---|---|
| `engagementId` | Every record except `engagementMeta` and `customer` | Stamped from `engagementMeta.engagementId` |
| `ownerId` | `engagementMeta` | `"local-user"` |
| `createdAt` / `updatedAt` | Every record | ISO timestamp at action commit time |
| `engagementMeta.status` | `engagementMeta` | `"Draft"` |
| `engagementMeta.engagementDate` | `engagementMeta` | `null` until user sets |

The fields are **populated** but not **surfaced** in v3.0 UI beyond what was in v2.4.16 (engagement date input, presales-owner field). This is intentional: the backing data is authoritative.

### S12.2 · v3.1 surfaces (deferred)

- Engagement registry: top-level `engagements: Collection<EngagementMeta>` collection at the root of localStorage. Currently v3.0 stores one engagement per localStorage key; v3.1 promotes the registry.
- Active-engagement pointer: `localStorage.activeEngagementId`. UI shows engagement switcher.
- `ownerId` reads from a stub auth module (returns `"local-user"` until v3.2 real auth).
- Read filter at selector layer: every selector takes a `{ viewer: { ownerId, role } }` arg. Data is unchanged; selectors filter by `record.ownerId === viewer.ownerId` for non-admin viewers. Schema layer doesn't change.

### S12.3 · v3.2 deliverables (backend wire-up)

Per §13 + Q7 resolution. Customer record promotes from embedded to its own table at backend migration; client schema does NOT change because all FKs already point at engagement-level ids.

### S12.4 · Test contract for §12

Vectors in TESTS.md §V-MULTI.
- V-MULTI-1: every record has `engagementId === engagementMeta.engagementId` after action functions.
- V-MULTI-2: `ownerId` defaults to `"local-user"`.
- V-MULTI-3: timestamps strictly monotonic on update.

**Trace**: directive §12.

---

## §13 · Backend migration (v3.2+)

**Status**: out of scope for v3.0 code; in-scope for v3.0 schema design (forward-compatibility).

### S13.1 · Target stack

- **Postgres** + **Drizzle ORM**.
- DDL generated from Zod via `drizzle-zod`. Same Zod artifact serves client validation, server schema, and DDL.
- API request/response schemas derived via `zod-to-openapi`.

**Document DB explicitly rejected.** Despite the simple per-engagement document mapping, the cross-engagement reporting requirement (v3.2+ "all High-urgency gaps in Financial Services / EMEA across every engagement") makes a document DB the wrong tool. Decision is on record so it is not re-litigated mid-implementation.

### S13.2 · Mapping rules

| Client shape | Server shape |
|---|---|
| `Collection<T>` (`{byId, allIds}`) | Postgres table; rows keyed by `id` |
| `allIds` insertion order | Preserved by `ordering` column or `createdAt` if order is incidental |
| FK declaration `{field, target, required}` | Postgres FK constraint with `ON DELETE` policy per `targetFilter` |
| Array-of-FK field (e.g., `gap.affectedEnvironments[]`) | Join table (e.g., `gap_affected_environments`) |
| `engagement` document | Decomposed on write; recomposed on read |

**S13.2.1 · `.canvas` import/export contract preserved**: the file format is the unit of import/export at every release. Backend decomposes the document into rows on save, recomposes into the same shape on read. Round-trip identity (V-MIG-IDEM equivalent) holds across the backend round-trip.

### S13.3 · Sync model (TO DECIDE in v3.2 planning)

- **First reference**: Replicache (Rocicorp). Aaron Boodman / Rocicorp. Strong fit for LAN-only + offline-capable deployment.
- **Fallback**: REST endpoints + client-side optimistic updates + manual conflict resolution.

Decision deferred to v3.2 spec-writing. Client schema is sync-strategy-agnostic.

**Trace**: directive §13.

---

## §14 · Testing strategy

### S14.1 · Test categories (12)

Every R-number in this SPEC maps to ≥1 vector in one of these categories. Vector ids follow the pattern `V-<CATEGORY>-<N>`.

| # | Category | Id prefix | Coverage source |
|---|---|---|---|
| 1 | Schema property | `V-SCH-*` | Every entity Zod schema accepts valid fixtures + rejects every documented invalid case |
| 2 | FK integrity | `V-FK-*` | Every FK declaration in S4.4: valid + dangling + optional vs required + array semantics |
| 3 | Schema invariant | `V-INV-*` | Every superRefine block in §3 (G6, mappedAssetIds-on-workload, originId-on-desired, etc.) |
| 4 | Migration round-trip | `V-MIG-*` | 8 fixtures × forward + idempotency. Plus V-MIG-FAIL-1 + V-MIG-DETERM-1 |
| 5 | Selector correctness | `V-SEL-*` | Each selector in S5.2 against `cross-cutting.canvas` produces documented output shape |
| 6 | Selector purity | `V-SEL-PURE-*` | Two consecutive calls with `===`-equal inputs return `===`-equal outputs |
| 7 | Manifest generation | `V-MFG-*` | `generateManifest()` matches `services/manifest.snapshot.json` byte-for-byte |
| 8 | Path resolution | `V-PATH-*` | Every path in manifest resolves to a value (or documented `undefined`) for reference engagement; unknown paths in `promptTemplate` are rejected at save |
| 9 | AI provenance | `V-PROV-*` | Wrapper schema enforced; user edit demotes to `user-edited`; drift flips to `stale` |
| 10 | Catalog drift | `V-DRIFT-*` | Engagement stamped against catalog v1 surfaces stale flags after upgrade to v2 |
| 11 | Performance regression | `V-PERF-*` | S11.3 budgets, calibrated per machine |
| 12 | End-to-end tab render | `V-E2E-*` | Each tab loads `acme-demo.canvas` + renders without console errors |

Plus three coverage-gating bands:

| Band | Id prefix | Source |
|---|---|---|
| Cross-cutting relationships | `V-XCUT-*` | §3.7 table (5 relationships) |
| Production-critical skills | `V-PROD-*` | `OPEN_QUESTIONS_RESOLVED.md` Q3 (3 skills) |
| Multi-engagement | `V-MULTI-*` | §S12.4 |

### S14.2 · Cross-cutting relationship coverage

| Vector | Relationship | Assertion |
|---|---|---|
| V-XCUT-1 | Workload `mappedAssetIds` across 2+ envs | Integrity sweep doesn't orphan; matrix view shows workload in native env; report aggregations count it once |
| V-XCUT-2 | Desired `originId` cross-env | Integrity sweep doesn't orphan; migration preserves cross-env link |
| V-XCUT-3 | `gap.affectedEnvironments.length === 3` | Gap appears in all 3 env-filtered views; report counts it once globally |
| V-XCUT-4 | `gap.relatedCurrentInstanceIds` mixing envs | Linked composition pulls all current instances regardless of env |
| V-XCUT-5 | `gap.relatedDesiredInstanceIds` mixing envs | Linked composition pulls all desired instances regardless of env |

### S14.3 · Reference engagements

Three checked-in fixtures in `tests/fixtures/v3-0/`:

| Fixture | Shape | Used by |
|---|---|---|
| `minimal.canvas` | 1 driver, 1 env, 0 instances, 0 gaps | V-SCH baseline + smoke |
| `acme-demo.canvas` | 200 instances, 12 gaps, 8 drivers, 3 envs | V-PERF + V-E2E + V-PROD |
| `cross-cutting.canvas` | 3 envs, hand-crafted to exercise every row of S3.7 | V-XCUT + V-SEL |

Per S4.2.1, fixtures are stored at the **persisted shape** (flat lists, no transient fields, no secondary indexes). Loading the fixture exercises the full load path: parse → migrate (no-op for already-v3.0) → validate → integrity sweep → hydrate → render.

### S14.4 · Mocking boundaries (closed list of 4)

1. **LLM provider** (`services/llm/<provider>.js`): mocks return canned structured-output responses keyed by prompt hash. Ensures determinism for V-PROD-* + V-PROV-*.
2. **Catalog fetcher** in v3.1+ network mode (currently bundled, no network in v3.0).
3. **`Date.now()`** + timestamp generators where determinism matters (`V-MIG-DETERM-1`, log entry timestamps).
4. **Autosave debouncer's timer** — tests fast-forward through the 1000ms wait via fake timers.

**Forbidden mock targets**: selectors, actions, schemas, migrators, integrity sweep, manifest generator, path resolver, any other internal module. Tests vary the **engagement fixture**, not the **code under test**. Per directive R14.4.1.

### S14.5 · Anti-cheat checks

The build's worst failure mode is GREEN tests over fake code. v3.0 enforces:

| Check | How it's enforced |
|---|---|
| No `if (process.env.NODE_ENV === 'test')` in production code | Build-time grep + ESLint custom rule |
| No `try { ... } catch { /* swallow */ }` | ESLint rule `no-empty` strict + custom rule requiring `catch` blocks to log or rethrow |
| Tests don't assert on hardcoded constants returned by stubs | Code review + spot-check vector V-ANTI-1 (a meta-test that scans the test source for `assert(constant === stubReturnValue)` patterns) |
| Coverage gate | Every R-number → ≥1 vector that fails when violated. `npm run coverage:check` walks SPEC R-numbers + asserts each has a matching vector id |

**Coverage target**: ≥90% line coverage as leading indicator. **Gate**: 100% R-number coverage. The R-number gate is the contract; line coverage is a heuristic.

### S14.6 · Banner target

v3.0 banner target: **~900 GREEN** (provisional). Breakdown (provisional, finalized in TESTS.md):

| Category | Approximate vector count |
|---|---|
| V-SCH | 70 |
| V-FK | 50 |
| V-INV | 30 |
| V-MIG | 25 |
| V-SEL + V-SEL-PURE | 70 |
| V-MFG | 10 |
| V-PATH | 35 |
| V-PROV | 15 |
| V-DRIFT | 8 |
| V-PERF | 10 |
| V-E2E | 12 |
| V-XCUT | 5 |
| V-PROD | 11 |
| V-MULTI | 8 |
| V-CAT | 12 |
| V-INT | 25 |
| V-ANTI | 5 |
| **TOTAL** | **~401 new** |

Plus the v2.4.16 baseline of 616 GREEN that survives v3.0 migration (some vectors are deleted because they tested obsolete v2.4.x data shapes; net carryover ~500). Final banner: **616 + 401 - obsolete ≈ ~900 GREEN**.

**Trace**: directive §14.

---

## §S19 · v3.0 → v2.x consumption adapter (SPEC-only annex)

**Status**: NEW 2026-05-01. SPEC-only annex; not in [`data-architecture-directive.md`](../../data-architecture-directive.md). The directive §0.4 sequenced *manifest → skill builder UI → perf gates → smoke* on the implicit assumption that v3.0 ships and v2.x views are rewritten in-place. The adapter is the pragmatic bridge that ships `3.0.0` GA without rewriting every view atom in one release: existing 5 v2.x view tabs (Context · Architecture · Heatmap · Workload Mapping · Gaps · Reporting) read v3.0 data through a thin module instead of the v2.x `state/sessionState.js` store. The v3.0 Lab tab (Skill Builder, shipped at v3.0.0-beta) already reads from v3.0 selectors directly; this annex extends the same pattern to the rest of the app.

**Authority cascade**: SPEC §19 → RULES delta (`docs/RULES.md` adapter invariant) → TESTS.md §T19 V-ADP-* → Suite N RED-first → `state/v3Adapter.js` + `state/v3EngagementStore.js` → per-view migrations → browser smoke.

### S19.1 · Module shape

**`state/v3Adapter.js`** — read-mostly bridge. Exports:

```js
// View-shape adapters. Each takes the active engagement and returns the
// data shape the v2.x view component expects today (i.e. the same keys
// today's view code reads off `state/sessionState.js`).
export function adaptContextView(eng);        // Tab 1 · customer + drivers
export function adaptArchitectureView(eng);   // Tab 2 · environments + instances
export function adaptHeatmapView(eng);        // Tab 3 · derived from architecture data
export function adaptWorkloadView(eng);       // Tab 4 · workload mapping (mappedAssetIds)
export function adaptGapsView(eng);           // Tab 5 · gaps + affectedEnvs + projectId + services
export function adaptReportingView(eng);      // Tab 6 · summary health aggregations

// Write-through helpers. v2.x view "writes" call these instead of mutating
// session state directly. Each helper invokes a §S4 action function on
// the engagement store, which commits + emits.
export function commitContextEdit(patch);
export function commitInstanceEdit(layerId, envId, instancePatch);
export function commitWorkloadMapping(workloadId, mappedAssetIds);
export function commitGapEdit(gapId, patch);
```

**`state/v3EngagementStore.js`** — single in-memory engagement + pub/sub.

```js
let active = null;                // current v3.0 engagement object
const subs  = new Set();          // Set<(eng) => void>
export function getActiveEngagement();
export function setActiveEngagement(eng);
export function subscribeActiveEngagement(fn);  // returns unsubscribe
export function commitAction(actionFn, ...args);  // wraps §S4 action; emits on success
```

### S19.2 · R-numbered requirements

| R | Requirement | Trace |
|---|---|---|
| **R19.1** | Adapter exposes 6 view-shape selectors (`adapt<View>View(eng)`) and 4 write helpers (`commit<View>Edit(...)`) per S19.1 | This SPEC |
| **R19.2** | Adapter is read-mostly: zero state mutation; all derived shapes flow through §S5 selectors | P3 (presentation derived, never stored) |
| **R19.3** | Active engagement is owned by `state/v3EngagementStore.js` (single in-memory engagement + pub/sub); adapter never holds engagement state itself | P2 + future v3.1 §S12 multi-engagement |
| **R19.4** | View edits commit through §S4 action functions only (`commit<View>Edit` wraps `commitAction(actionFn, ...)`); no raw object mutation in the adapter or in views | P2 (storage normalized) |
| **R19.5** | Each `adapt<View>View(eng)` is a pure function: deterministic shape, no side effects, identity-stable when engagement reference is unchanged (downstream of §S5 memoization) | §14 testing + P9 perf |
| **R19.6** | Adapter MUST NOT import `state/sessionState.js`; adapter is the cutover boundary between the two stores | RULES delta |
| **R19.7** | Once a view is migrated, the view file MUST import only from `state/v3Adapter.js` for engagement-derived data; direct imports of `selectors/v3.js` in view modules are forbidden | §5.3 forbidden patterns extension |
| **R19.8** | `.canvas` v3.0 file load drives `engagementStore.setActiveEngagement(loadCanvasV3(json).engagement)`; v2.x `.canvas` files run §S9 migrator first, then same set | §S9 + §10 integrity sweep on every load |
| **R19.9** | View migrations land in the order: Context → Architecture → Heatmap → Workload Mapping → Gaps → Reporting; each migration is one commit + browser smoke before the next | S19.4 below |
| **R19.10** | The v3.0 Lab tab (already-shipped Skill Builder) reads from `engagementStore` directly without going through `adaptXxxView`; the Lab is its own surface, not a v2.x view | v3.0.0-beta ship state |

### S19.3 · Co-existence window

Until every view is migrated, the v2.x `state/sessionState.js` store and the v3.0 `state/v3EngagementStore.js` BOTH live in memory. Each migrated view stops reading sessionState and starts reading the adapter. Every commit boundary (one view migrated per commit per R19.9) re-runs the full browser smoke; the green banner being 1001/1001 alone is **not** sufficient (cross-ref `feedback_browser_smoke_required.md` + the empty-page regressions caught at v3.0 commits 8 and 11).

When the last view (Reporting) migrates and tests are GREEN, the v2.x sessionState store is dead code from a runtime perspective but is **NOT deleted in this release**: it stays available as a rollback anchor + because the v2.x AI admin panel still reads from it (per the `project_v2x_admin_deferred.md` decision).

### S19.4 · Migration ordering rationale

| Order | View | Why this position |
|---|---|---|
| 1 | Context (Tab 1) | Smallest data shape (customer + drivers); smallest blast radius; exercises basic adapter wiring + pub/sub re-render |
| 2 | Architecture (Tab 2) | Environments + instances matrix; exercises `selectMatrixView` integration; matrix view is the highest-traffic surface |
| 3 | Heatmap (Tab 3) | Derived from Architecture data; should be free once Tab 2 lands (same selectors + adapter) |
| 4 | Workload Mapping (Tab 4) | Cross-cutting `mappedAssetIds`; exercises P2 cross-cutting + V-XCUT integration |
| 5 | Gaps (Tab 5) | Largest field set: `affectedEnvironments`, `relatedCurrentInstanceIds`, `relatedDesiredInstanceIds`, `services[]`, `projectId`, `urgency`; full §S3 entity coverage |
| 6 | Reporting / SummaryHealth (Tab 6) | Aggregations; depends on stable upstream views; last because regressions in 1–5 surface here |

### S19.5 · Forbidden patterns

- **F19.5.1** · View module imports `state/sessionState.js` after migration: forbidden. (RULES enforces; lint rule TO AUTHOR alongside §S5.3 F5.3.2.)
- **F19.5.2** · Adapter mutates engagement object: forbidden. All writes go through `commitAction(actionFn, ...)`.
- **F19.5.3** · View module imports `selectors/v3.js` directly: forbidden. The adapter is the only consumer of `selectors/v3.js` from view code.
- **F19.5.4** · Adapter memoizes view-shape outputs in its own cache: forbidden. The §S5 selectors already memoize on engagement-reference identity per `OPEN_QUESTIONS_RESOLVED.md` Q2.
- **F19.5.5** · `state/v3EngagementStore.js` exposes the engagement object by deep reference for write: forbidden. Reads return the engagement directly (callers MUST treat it as read-only); writes go through `commitAction`.

### S19.6 · Test contract for §19

Vectors in TESTS.md §T19 V-ADP-1..10. Summary:

- **V-ADP-1**: each `adapt<View>View(eng)` returns the same output reference when called twice with the same engagement reference (purity + memoization downstream).
- **V-ADP-2**: empty engagement (`createEmptyEngagement()`) renders every view shape without throwing.
- **V-ADP-3 / 4 / 5 / 6 / 7 / 8**: per-view shape correctness against reference engagement (one vector per view).
- **V-ADP-9**: `commitContextEdit({customer: {name: "X"}})` updates `engagement.customer.name` to `"X"` and emits to subscribers.
- **V-ADP-10**: `.canvas` v3.0 file → `loadCanvasV3` → `setActiveEngagement` → all 6 view shapes derive without errors (round-trip).

**Forbidden test patterns**: stubbing `state/v3Adapter.js` internals; constructing engagement objects bypassing `createEmptyEngagement` / `loadCanvasV3`.

### S19.7 · Trace

- **Principles**: P2 (storage normalized) + P3 (presentation derived) + P9 (performance budget — adapter MUST NOT break 100ms render).
- **Sections**: §S4 (action functions consumed by write helpers) + §S5 (selectors consumed by read selectors) + §S9 (migrator drives initial engagement set) + §S10 (integrity sweep gates engagement set).
- **Memory anchors**: `feedback_spec_and_test_first.md` (this very section is the spec-first artifact) + `feedback_browser_smoke_required.md` (per-commit smoke between view migrations) + `feedback_dockerfile_whitelist.md` (no new top-level dirs in this work) + `project_v2x_admin_deferred.md` (sessionState NOT deleted).

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
- **Current state**: DRAFT 2026-05-01. **All 18 sections fully drafted.** Open items flagged inline (`TO RESOLVE` requires user decision; `TO CONFIRM` requires external input).
- **Owner**: spec writer (Claude Opus 4.7 1M context, this session and successors).
- **Authority cascade**: `data-architecture-directive.md` → this SPEC → `MIGRATION.md` + `TESTS.md` → Suite N tests → code.
- **Change log**: subsection-level changes append-only at end of file.

### Open items (in-text flags)

Items requiring resolution before tests get vectors:

| Item | Section | Tag |
|---|---|---|
| ~~Zod loader resolution: importmap CDN vs vendored~~ | §S2.1 | ✅ RESOLVED 2026-05-01: vendored `vendor/zod/zod.mjs` (zod@3.23.8) |
| Skill output evaluation framework (formal LLM eval) | §S7.4.4 | TO CONFIRM (v3.1 scope) |
| Dell Sales Chat structured-output mechanism | §S7.4 (table) | TO CONFIRM with Dell IT contact |
| Tab component "no view writes back" lint rule (AST check) | §S5.3 F5.3.2 | TO AUTHOR |
| `selectProjects` deterministic grouping rules | §S5.2.3 | TO ENCODE (port v2.4.16 logic) |

These are tractable; they do not block §1-§4 implementation.

### Change log

| Date | Section | Change |
|---|---|---|
| 2026-04-30 | All | Initial draft. §0–§4 + §15–§18 complete. §5–§14 scaffolded. |
| 2026-05-01 | §5–§9 | Filled selectors, catalogs, skill builder, provenance, migration. Concrete file paths + signatures + Zod sketches. |
| 2026-05-01 | §10–§14 | Filled integrity, performance, multi-engagement, backend, tests. Repair-rule table, calibration mechanism, vector-id pattern, banner target ~900 GREEN. |
| 2026-05-01 | §S19 | NEW SPEC-only annex · v3.0 → v2.x consumption adapter. R19.1–R19.10 + module shape (`state/v3Adapter.js` + `state/v3EngagementStore.js`) + 6-view migration order + forbidden patterns + V-ADP-1..10 test pointer. Drives non-suffix `3.0.0` GA: with adapter shipped, the existing 5 v2.x view tabs read from v3.0 selectors against the active engagement (today only the Lab does). |

End of SPEC.
