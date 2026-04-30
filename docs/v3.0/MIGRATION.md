# Dell Discovery Canvas · v2.0 → v3.0 Migration Specification

**Branch**: `v3.0-data-architecture` · **Authority**: derives from [`SPEC.md`](SPEC.md) §9 + [`../../data-architecture-directive.md`](../../data-architecture-directive.md) §9.

**Document state**: DRAFT 2026-05-01. Migrator pipeline architecture + 10-step transformation rules + 8-fixture catalogue + failure-handling flow + determinism rules. Authoring fixture `.canvas` JSON content is implementation work (lands when migrator code is authored).

**Read order**: this document after SPEC.md §9 (which defines the contract); this elaborates the contract into per-step transformations a developer implements against.

---

## §M0 · How this document is consumed

This is the v2.0 → v3.0 transformation specification per directive §9.3. The migrator pipeline lives in `migrations/v2-0_to_v3-0/`; this document is the authority every commit in that directory traces back to.

Pipeline:

```
v2.0 .canvas  →  parsePersisted  →  migrate(v2→v3)  →  validate(v3.0)  →  integritySweep  →  hydrateIndexes  →  ready for UI
                                       │
                                       └── 10 ordered steps (M1-M10), each pure
```

The document is structured as:
- **§M1 · Pipeline architecture** — file layout, helper functions, run order.
- **§M2 · Determinism rules** — deterministic id generation, timestamp handling, test-mode controls.
- **§M3-§M12 · Per-step transformations** — one section per migrator step with concrete input/output examples + edge cases + test vector ids.
- **§M13 · Catalog snapshot bundling** — how the migrator references catalogs without runtime fetch.
- **§M14 · Failure handling** — error envelope shapes + recovery flow + forbidden patterns.
- **§M15 · Round-trip fixture catalogue** — 8 fixtures with shapes + coverage.
- **§M16 · Open items** — TO RESOLVE / TO CONFIRM markers.
- **§M17 · Document control** — change log.

---

## §M1 · Pipeline architecture

### M1.1 · Directory layout

```
migrations/
  index.js                              // Registry + dispatch entry point
  helpers/
    deterministicId.js                  // generateDeterministicId(kind, ...inputs)
    catalogSnapshot.js                  // loadBundledSnapshot(snapshotId)
    pipelineContext.js                  // PipelineContext factory
    collection.js                       // collection(arr) -> {byId, allIds}
  v2-0_to_v3-0/
    index.js                            // Composition root: runs all 10 steps in order
    catalogSnapshot.json                // Bundled catalogs at migrator-author time (frozen)
    step01_schemaVersion.js             // M3 step body
    step02_engagementId.js              // M4
    step03_ownerId.js                   // M5
    step04_timestamps.js                // M6
    step05_customerLegacyFields.js      // M7
    step06_extractDrivers.js            // M8
    step07_collections.js               // M9 (in-memory hydration; persistence stays flat)
    step08_dropProjectId.js             // M10
    step09_wrapAILegacyFields.js        // M11
    step10_stampEngagementId.js         // M12
  fixtures/                             // see §M15
    v2-0/
      empty.canvas
      single-env.canvas
      multi-env.canvas
      cross-env-workload.canvas
      cross-env-origin.canvas
      multi-env-gaps.canvas
      ai-provenanced.canvas
      acme-demo.canvas
    v3-0-expected/                       // result of running the migrator on each v2-0 fixture
      empty.canvas
      ...
```

### M1.2 · Registry contract

```js
// migrations/index.js
import { migrate_v2_0_to_v3_0 } from "./v2-0_to_v3-0/index.js";

const MIGRATIONS = {
  "2.0": { to: "3.0", migrate: migrate_v2_0_to_v3_0 }
  // future entries appended here
};

export function migrateToVersion(engagement, targetVersion = "3.0") {
  let current = engagement;
  let currentVersion = current.engagementMeta?.schemaVersion
    ?? current.sessionMeta?.version
    ?? "2.0";
  const ctx = makePipelineContext({ migrationTimestamp: new Date().toISOString() });

  while (currentVersion !== targetVersion) {
    const migration = MIGRATIONS[currentVersion];
    if (!migration) throw new MigrationError({
      code: "NO_PATH",
      currentVersion, targetVersion
    });
    current = migration.migrate(current, ctx);
    currentVersion = migration.to;
  }
  return current;
}
```

**M1.2.1 · Single-hop only in v3.0**: only `2.0 → 3.0` is registered. v3.0 → v3.1 will append a row when v3.1 lands. The pipeline naturally handles multi-hop chains (`2.0 → 3.0 → 3.1` runs as two passes).

**M1.2.2 · No backward migration**: per directive R2.3.3 + R9.1.1 — migrators are forward-only. Loading a v3.0 file in a v2.x build returns an "unsupported file format" error; loading a v2.0 file in v3.0 runs the migrator. There is no v3.0 → v2.0 path.

### M1.3 · Pipeline context

```js
// migrations/helpers/pipelineContext.js
function makePipelineContext({ migrationTimestamp, randomSeed }) {
  return Object.freeze({
    migrationTimestamp,                          // ISO 8601, set once per run
    catalogSnapshot: loadBundledSnapshot(),      // §M13
    randomSeed:      randomSeed ?? "v2-0_to_v3-0:default",
    // helper closures:
    deterministicId: (kind, ...inputs) =>
      generateDeterministicId(kind, randomSeed, ...inputs)
  });
}
```

**M1.3.1 · Frozen context**: the context is `Object.freeze`d so steps cannot mutate it. A step that needs to record state (e.g., for a later step) returns it as part of the engagement.

**M1.3.2 · Test-mode determinism**: tests pass a fixed `migrationTimestamp` + `randomSeed` so output is byte-equivalent across runs. Vector V-MIG-DETERM-1 verifies.

### M1.4 · Step composition

```js
// migrations/v2-0_to_v3-0/index.js
import step01 from "./step01_schemaVersion.js";
import step02 from "./step02_engagementId.js";
// ... step10

const PIPELINE = [step01, step02, step03, step04, step05,
                  step06, step07, step08, step09, step10];

export function migrate_v2_0_to_v3_0(oldEngagement, ctx) {
  let current = structuredClone(oldEngagement);   // never mutate input
  for (const step of PIPELINE) {
    try {
      current = step(current, ctx);
    } catch (err) {
      throw new MigrationStepError({
        step:    step.name,
        cause:   err,
        partial: current
      });
    }
  }
  return current;
}
```

**M1.4.1 · Pure steps**: each step is `(engagement, ctx) => engagement`. No I/O. No side effects. Pure data transform.

**M1.4.2 · Deep clone at entry**: `structuredClone` ensures the input is never mutated even if a step accidentally writes back. Vector V-MIG-INPUT-IMMUT-1 enforces.

**M1.4.3 · Step error envelope**: if any step throws, the loop catches + re-throws with the step name + the partial engagement so the load harness can produce the structured error envelope (§M14).

---

## §M2 · Determinism rules

### M2.1 · Id generation

**M2.1.1 · Deterministic from stable v2.0 fields**:

```js
// migrations/helpers/deterministicId.js
import { sha256Hex } from "./sha256.js";   // tiny vendored impl

export function generateDeterministicId(kind, randomSeed, ...inputs) {
  const payload = [kind, randomSeed, ...inputs.map(String)].join("\x1f");
  const hash    = sha256Hex(payload);
  // UUID v8 (custom) shape: 8-4-4-4-12 carved from the hash
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-8${hash.slice(13,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
}
```

**Stable-input choices per entity**:

| v3.0 entity | Stable inputs | Rationale |
|---|---|---|
| Engagement | `(v2_sessionId)` if present, else `(customer.name, savedAt)` | sessionId is the natural key when available |
| Driver | `(engagementId, businessDriverId, sourceArrayIndex)` | drivers are ordered in v2.0 by user intent; index preserves order |
| Environment | `(engagementId, envCatalogId, sourceArrayIndex)` | same — preserves user-visible order |
| Instance | `(engagementId, environmentId, layerId, label, state, sourceArrayIndex)` | label is mostly stable; index disambiguates duplicates |
| Gap | `(engagementId, layerId, description, sourceArrayIndex)` | description is the most-stable identifying field |

**M2.1.2 · Why not random UUIDs**: re-running the migrator on the same v2.0 input MUST produce identical v3.0 output (vector V-MIG-IDEM-1 + V-MIG-DETERM-1). Random UUIDs would break idempotency. Deterministic generation also makes fixture diffs reviewable.

**M2.1.3 · Collision handling**: SHA-256 collisions are not a real concern at our scale. The first 32 hex characters provide 128 bits of namespace per `(kind, randomSeed)` tuple. Vector V-MIG-COLLIDE-1 asserts no collisions across the 8 fixtures.

**M2.1.4 · Migration of `sourceArrayIndex`**: the migrator reads v2.0 array order (v2.0 stores entities as `Array<T>`, not `Collection<T>`), preserves index in id generation, and discards the index after collection construction. v3.0 `allIds` order matches v2.0 array order.

### M2.2 · Timestamps

**M2.2.1 · Source preference order** for `createdAt` / `updatedAt`:

1. v2.0 record's existing timestamp field if present (e.g., gap.createdAt in late-v2.4.x).
2. v2.0 `sessionMeta.savedAt` for the whole engagement.
3. `ctx.migrationTimestamp` (the run's "now") as last resort.

**M2.2.2 · `createdAt === updatedAt` initially**: at migration time, both fields are populated to the same value. Subsequent edits in v3.0 bump `updatedAt` only.

**M2.2.3 · Test-mode**: `ctx.migrationTimestamp` is fixed (e.g., `"2026-01-01T00:00:00.000Z"` in test fixtures) so output is byte-deterministic.

### M2.3 · Test mode controls

```js
// In tests:
const ctx = makePipelineContext({
  migrationTimestamp: "2026-01-01T00:00:00.000Z",
  randomSeed:         "test-fixture-v2-0_to_v3-0"
});
const v3 = migrate_v2_0_to_v3_0(v2Fixture, ctx);
// v3 is byte-deterministic
```

**M2.3.1 · No conditional code paths**: there is no `if (ctx.testMode)` branch in production code. The only difference between test and production is the `ctx` argument values. Per directive R14.5.1 + SPEC §S14.5.

---

## §M3 · Step 1 — Schema version stamp

**Module**: `step01_schemaVersion.js` · **Vector**: V-MIG-S1-*

### M3.1 · Transformation

```js
export default function step01(engagement, ctx) {
  const meta = engagement.engagementMeta ?? engagement.sessionMeta ?? {};
  return {
    ...engagement,
    engagementMeta: {
      ...meta,
      schemaVersion: "3.0"
    }
  };
}
```

### M3.2 · Edge cases

| Input | Behavior |
|---|---|
| `engagement.sessionMeta.version === "2.0"` | Set `engagementMeta.schemaVersion = "3.0"`. Do NOT delete `sessionMeta` here (step 2 handles that). |
| Already `engagementMeta.schemaVersion === "3.0"` | Idempotent — output identical to input. |
| Missing both `sessionMeta` and `engagementMeta` | Construct `engagementMeta = { schemaVersion: "3.0" }` ; later steps fill the rest. |

### M3.3 · Test vectors

- **V-MIG-S1-1**: v2.0 input with `sessionMeta.version === "2.0"` → output `engagementMeta.schemaVersion === "3.0"`.
- **V-MIG-S1-2** (idempotency): v3.0 input → output identical.
- **V-MIG-S1-3**: empty engagement (no meta at all) → output has `engagementMeta.schemaVersion === "3.0"`.

---

## §M4 · Step 2 — sessionId → engagementId

**Module**: `step02_engagementId.js` · **Vector**: V-MIG-S2-*

### M4.1 · Transformation

```js
export default function step02(engagement, ctx) {
  const sessionMeta    = engagement.sessionMeta ?? {};
  const engagementMeta = engagement.engagementMeta ?? {};
  const oldId =
    sessionMeta.sessionId ??
    engagementMeta.engagementId ??
    ctx.deterministicId("engagement", engagementMeta.customerName ?? "unknown", sessionMeta.savedAt ?? "unknown");

  const next = {
    ...engagement,
    engagementMeta: {
      ...engagementMeta,
      schemaVersion: engagementMeta.schemaVersion,   // preserved from step 1
      engagementId:  oldId
    }
  };
  delete next.sessionMeta;                           // sessionMeta retired
  return next;
}
```

### M4.2 · Edge cases

| Input | Behavior |
|---|---|
| `sessionMeta.sessionId` present | Preserve verbatim as `engagementId`. |
| Both `sessionMeta.sessionId` and `engagementMeta.engagementId` present (mid-migration relic) | Prefer `sessionMeta.sessionId` (older field) for round-trip stability; log a warning. |
| Neither present | Generate deterministic id from customer name + savedAt. |
| Already-v3.0 with `engagementId` | Idempotent. |

### M4.3 · Test vectors

- **V-MIG-S2-1**: standard v2.0 with `sessionMeta.sessionId === "abc-123"` → `engagementMeta.engagementId === "abc-123"`.
- **V-MIG-S2-2**: missing `sessionId` → deterministic id generated; same input twice → same id.
- **V-MIG-S2-3**: `sessionMeta` removed from output entirely.

---

## §M5 · Step 3 — Add `ownerId`

**Module**: `step03_ownerId.js` · **Vector**: V-MIG-S3-*

### M5.1 · Transformation

```js
export default function step03(engagement, ctx) {
  return {
    ...engagement,
    engagementMeta: {
      ...engagement.engagementMeta,
      ownerId: engagement.engagementMeta.ownerId ?? "local-user"
    }
  };
}
```

### M5.2 · Edge cases

| Input | Behavior |
|---|---|
| `ownerId` absent | Set to `"local-user"`. |
| `ownerId === ""` (empty) | Treated as absent; set to `"local-user"`. |
| `ownerId === "alice@example.com"` | Preserved verbatim. |

### M5.3 · Test vectors

- **V-MIG-S3-1**: missing → `"local-user"`.
- **V-MIG-S3-2**: empty string → `"local-user"`.
- **V-MIG-S3-3**: existing identifier preserved.

---

## §M6 · Step 4 — Timestamps

**Module**: `step04_timestamps.js` · **Vector**: V-MIG-S4-*

### M6.1 · Transformation

```js
export default function step04(engagement, ctx) {
  const meta = engagement.engagementMeta;
  const fallback = engagement.sessionMeta?.savedAt ?? ctx.migrationTimestamp;
  return {
    ...engagement,
    engagementMeta: {
      ...meta,
      createdAt: meta.createdAt ?? fallback,
      updatedAt: meta.updatedAt ?? meta.createdAt ?? fallback
    }
  };
}
```

**Note**: `step04` runs AFTER `step02`, so `sessionMeta` is already deleted. The `engagement.sessionMeta?.savedAt` reference will be `undefined` in the normal case; the cascading `??` handles it. The fallback chain reads from a pre-step-02 snapshot if needed:

```js
// More accurate (preserves pre-step-02 savedAt):
ctx.preserved = ctx.preserved ?? { v2SavedAt: engagement.sessionMeta?.savedAt };
const fallback = ctx.preserved.v2SavedAt ?? ctx.migrationTimestamp;
```

**M6.1.1 · TO RESOLVE**: the `ctx.preserved` mechanism — does the pipeline context accumulate state between steps, or do we run step01 last (after collecting the v2.0 sessionMeta first)? **Default**: capture v2.0 metadata in step01 into ctx, then steps 02+ consume from ctx. Lock this in implementation.

### M6.2 · Edge cases

| Input | Behavior |
|---|---|
| Both timestamps present | Preserved. |
| Only `createdAt` present | `updatedAt = createdAt`. |
| Neither present + `sessionMeta.savedAt` from v2.0 | Both = `savedAt`. |
| Neither present + no v2.0 timestamp | Both = `ctx.migrationTimestamp`. |

### M6.3 · Test vectors

- **V-MIG-S4-1**: standard v2.4.x with `sessionMeta.savedAt` → both timestamps populated equally from `savedAt`.
- **V-MIG-S4-2**: pre-2.4.x v2.0 with no `savedAt` → both = `ctx.migrationTimestamp`.
- **V-MIG-S4-3**: existing v3.0-shape `createdAt` + `updatedAt` preserved (idempotent).

---

## §M7 · Step 5 — Customer legacy fields

**Module**: `step05_customerLegacyFields.js` · **Vector**: V-MIG-S5-*

### M7.1 · Transformation

```js
export default function step05(engagement, ctx) {
  const { segment, industry, ...rest } = engagement.customer ?? {};
  const extras = [segment, industry]
    .filter(s => typeof s === "string" && s.trim().length > 0)
    .filter(s => s !== rest.vertical)                 // drop redundant
    .filter(s => !rest.notes?.includes(s));           // drop already-in-notes

  const notes = extras.length
    ? [rest.notes, ...extras].filter(Boolean).join(" · ").trim()
    : (rest.notes ?? "");

  return {
    ...engagement,
    customer: { ...rest, notes }
  };
}
```

### M7.2 · Edge cases

| v2.0 input | v3.0 output |
|---|---|
| `customer = { name: "Acme", vertical: "Financial Services", segment: "Banking", industry: "Finance", notes: "" }` | `customer = { name: "Acme", vertical: "Financial Services", notes: "Banking · Finance" }` |
| `customer = { vertical: "Healthcare", segment: "Healthcare" }` | redundancy: segment dropped silently; `notes = ""` |
| `customer = { vertical: "Healthcare", notes: "Healthcare", segment: "Healthcare" }` | already-in-notes: segment dropped; `notes = "Healthcare"` unchanged |
| `customer = { vertical: "Tech" }` (no segment/industry) | unchanged |
| `customer` absent | `customer = { notes: "" }` (downstream validation will fail; integrity quarantines if name missing — but that's a v2.0 data quality bug, not a migrator concern) |

### M7.3 · Test vectors

- **V-MIG-S5-1**: standard merge — segment + industry → notes.
- **V-MIG-S5-2**: redundant with vertical — dropped.
- **V-MIG-S5-3**: redundant with notes — dropped.
- **V-MIG-S5-4**: empty strings — treated as absent.

---

## §M8 · Step 6 — Extract `customer.drivers[]` → top-level `drivers` collection

**Module**: `step06_extractDrivers.js` · **Vector**: V-MIG-S6-*

### M8.1 · Transformation

```js
export default function step06(engagement, ctx) {
  const v2Drivers = engagement.customer?.drivers ?? [];
  const engagementId = engagement.engagementMeta.engagementId;
  const t = engagement.engagementMeta.createdAt;

  const drivers = v2Drivers.map((d, idx) => ({
    id:               ctx.deterministicId("driver", engagementId,
                                           d.driverId ?? d.businessDriverId ?? "unknown",
                                           idx),
    engagementId,
    businessDriverId: d.driverId ?? d.businessDriverId ?? "unknown",
    catalogVersion:   ctx.catalogSnapshot.BUSINESS_DRIVERS.catalogVersion,
    priority:         normalizePriority(d.priority),
    outcomes:         d.outcomes ?? "",
    createdAt:        t,
    updatedAt:        t
  }));

  const next = {
    ...engagement,
    drivers: { byId: byIdOf(drivers), allIds: drivers.map(x => x.id) },
    customer: { ...engagement.customer }
  };
  delete next.customer.drivers;
  return next;
}

function normalizePriority(p) {
  if (!p) return "Medium";
  const upper = String(p).trim();
  if (["High","Medium","Low"].includes(upper)) return upper;
  // Legacy values: "high", "med", "low", "1", "2", "3"
  const map = {
    high: "High", med: "Medium", medium: "Medium", low: "Low",
    "1": "High", "2": "Medium", "3": "Low"
  };
  return map[upper.toLowerCase()] ?? "Medium";
}
```

### M8.2 · Edge cases

| v2.0 input | Behavior |
|---|---|
| `customer.drivers = []` | Output `drivers = { byId: {}, allIds: [] }` ; no warnings. |
| `customer.drivers = undefined` | Same — empty collection. |
| Driver with `driverId` (v2.4.16 field) | Mapped to `businessDriverId`. |
| Driver with `businessDriverId` already (v2.4.17 WIP shape) | Preserved. |
| Driver with both fields | Prefer `driverId` (v2.4.16 was longer-lived); log warning. |
| Driver with neither | `businessDriverId = "unknown"` → integrity sweep will quarantine. |
| Priority `"high"` (lowercase) | Normalize to `"High"`. |
| Priority `"Critical"` (out of enum) | Normalize to `"Medium"` + log warning. |

### M8.3 · Test vectors

- **V-MIG-S6-1**: 3-driver v2.4.16 input → 3-driver v3.0 collection in `allIds` order.
- **V-MIG-S6-2**: priority normalization (lowercase, numeric, empty).
- **V-MIG-S6-3**: empty `drivers[]` → empty collection.
- **V-MIG-S6-4**: `customer.drivers` absent from output (key deleted).
- **V-MIG-S6-5**: `catalogVersion` stamped from `ctx.catalogSnapshot`.

---

## §M9 · Step 7 — Array → Collection on load

**Module**: `step07_collections.js` · **Vector**: V-MIG-S7-*

### M9.1 · Transformation

This step converts in-memory `Array<T>` shapes from v2.0 into v3.0 `Collection<T>` shapes for `environments`, `instances`, `gaps`. **Persistence (S4.2.1) stays flat**; this is a runtime hydration.

```js
export default function step07(engagement, ctx) {
  const eid = engagement.engagementMeta.engagementId;
  const t   = engagement.engagementMeta.createdAt;

  const environments = (engagement.environments ?? []).map((env, idx) => ({
    id:             env.id ?? ctx.deterministicId("environment", eid, env.envCatalogId ?? env.id ?? "unknown", idx),
    engagementId:   eid,
    envCatalogId:   env.envCatalogId ?? env.id,         // v2.0 `id` was catalog-keyed
    catalogVersion: ctx.catalogSnapshot.ENV_CATALOG.catalogVersion,
    hidden:         env.hidden ?? false,
    alias:          env.alias ?? null,
    location:       env.location ?? null,
    sizeKw:         env.sizeKw ?? null,
    sqm:            env.sqm ?? null,
    tier:           env.tier ?? null,
    notes:          env.notes ?? "",
    createdAt:      t,
    updatedAt:      t
  }));

  const instances = mergeAndConvertInstances(engagement, eid, t, ctx);
  const gaps      = (engagement.gaps ?? []).map((g, idx) => convertGap(g, eid, t, ctx, idx));

  const next = {
    ...engagement,
    environments: hydrate(environments),
    instances:    hydrateInstancesWithByState(instances),
    gaps:         hydrate(gaps)
  };
  return next;
}

function hydrate(arr) {
  return { byId: byIdOf(arr), allIds: arr.map(x => x.id) };
}

function hydrateInstancesWithByState(arr) {
  return {
    byId:    byIdOf(arr),
    allIds:  arr.map(x => x.id),
    byState: {
      current: arr.filter(x => x.state === "current").map(x => x.id),
      desired: arr.filter(x => x.state === "desired").map(x => x.id)
    }
  };
}
```

### M9.2 · v2.0 `instances` shape variations

The v2.0 `instances` field has had several shapes across the v2.4.x line:

| v2.0 shape | Description |
|---|---|
| `{ current: [...], desired: [...] }` | Earliest split; pre-v2.4.0 |
| `[ { state: "current", ... }, { state: "desired", ... } ] ` | Unified array; v2.4.0+ |
| `{ byState: { current, desired }, allIds }` | v2.4.17 WIP partial migration |

The migrator's `mergeAndConvertInstances` handles all three:

```js
function mergeAndConvertInstances(engagement, eid, t, ctx) {
  const raw = engagement.instances;
  let arr = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && Array.isArray(raw.current)) {
    arr = [...raw.current.map(x => ({ ...x, state: "current" })),
           ...raw.desired.map(x => ({ ...x, state: "desired" }))];
  } else if (raw && raw.byId) {
    arr = Object.values(raw.byId);
  }
  return arr.map((inst, idx) => convertInstance(inst, eid, t, ctx, idx));
}
```

### M9.3 · Test vectors

- **V-MIG-S7-1**: v2.0 unified-array instances → `Collection<Instance>` with `byState` populated correctly.
- **V-MIG-S7-2**: legacy `{current,desired}` split → unified collection.
- **V-MIG-S7-3**: empty arrays → empty collections.
- **V-MIG-S7-4**: `allIds` preserves source array order.

---

## §M10 · Step 8 — Drop `gap.projectId`

**Module**: `step08_dropProjectId.js` · **Vector**: V-MIG-S8-*

### M10.1 · Transformation

```js
export default function step08(engagement, ctx) {
  const gaps = engagement.gaps;
  // gaps is a Collection<Gap> at this point (step07 ran)
  const next = {};
  for (const id of gaps.allIds) {
    const { projectId, ...rest } = gaps.byId[id];
    next[id] = rest;
  }
  return {
    ...engagement,
    gaps: { byId: next, allIds: gaps.allIds }
  };
}
```

`projectId` was a v2.4.9-introduced stored field. It is now **derived** by `selectProjects` (SPEC §S5.2.3). Dropping it in the migrator is mandatory; carrying it through would create a drift hazard (stored value vs. computed value).

### M10.2 · Edge cases

| Input | Behavior |
|---|---|
| Gap with `projectId: "proj-123"` | Field deleted. |
| Gap without `projectId` | No-op; field stays absent. |
| All gaps without `projectId` | No-op for entire pass. |

### M10.3 · Test vectors

- **V-MIG-S8-1**: every `gap.projectId` deleted from output.
- **V-MIG-S8-2**: `gap.id` and other fields preserved.
- **V-MIG-S8-3**: idempotent (no `projectId` in v3.0 input → no change).

---

## §M11 · Step 9 — Wrap pre-existing free-text AI fields

**Module**: `step09_wrapAILegacyFields.js` · **Vector**: V-MIG-S9-*

### M11.1 · Transformation

The v2.4.x `mappedDellSolutions` field on gaps was a plain string. v3.0 `aiMappedDellSolutions` is a provenance-wrapped object.

```js
export default function step09(engagement, ctx) {
  const gaps = engagement.gaps;
  const t = ctx.migrationTimestamp;
  let wrappedCount = 0;

  const next = {};
  for (const id of gaps.allIds) {
    const gap = { ...gaps.byId[id] };
    if (typeof gap.mappedDellSolutions === "string" && gap.mappedDellSolutions.trim().length > 0) {
      gap.aiMappedDellSolutions = {
        value: {
          rawLegacy: gap.mappedDellSolutions.trim(),
          products: []                                 // empty until user re-runs the skill
        },
        provenance: {
          model:            "unknown",
          promptVersion:    "legacy:v2.4.x",
          skillId:          "unknown",
          runId:            ctx.deterministicId("provenanceRun", gap.id, "legacy"),
          timestamp:        t,
          catalogVersions:  { DELL_PRODUCT_TAXONOMY: "unknown" },
          validationStatus: "stale"
        }
      };
      wrappedCount += 1;
    }
    delete gap.mappedDellSolutions;
    next[id] = gap;
  }

  // Surface the count in integrity log on next sweep:
  const log = engagement.integrityLog ?? [];
  if (wrappedCount > 0) {
    log.push({
      ruleId:     "MIG-AI-WRAPPED",
      recordKind: "engagementMeta",
      recordId:   engagement.engagementMeta.engagementId,
      field:      "aiMappedDellSolutions",
      before:     `${wrappedCount} legacy plain-string AI fields`,
      after:      `${wrappedCount} provenance-wrapped with validationStatus=stale`,
      timestamp:  t
    });
  }

  return {
    ...engagement,
    gaps: { byId: next, allIds: gaps.allIds },
    integrityLog: log
  };
}
```

### M11.2 · Why `validationStatus: "stale"`

Per directive §9.3 step 9 + SPEC §S8.4.2: stale-flagging never silently rewrites the value. The user sees the AI suggestion they had in v2.4.x, marked stale (amber dot), and can decide to re-run the skill against the current Dell catalog or accept the legacy value. The legacy text is preserved in `value.rawLegacy` so nothing is lost.

### M11.3 · Edge cases

| v2.4.x input | v3.0 output |
|---|---|
| `gap.mappedDellSolutions = "PowerStore + PowerProtect"` | `gap.aiMappedDellSolutions = { value: { rawLegacy: "PowerStore + PowerProtect", products: [] }, provenance: { ..., validationStatus: "stale" } }` |
| `gap.mappedDellSolutions = ""` (empty) | Field deleted; no wrapper created. |
| `gap.mappedDellSolutions = "  "` (whitespace) | Field deleted; no wrapper created. |
| `gap.mappedDellSolutions` already-an-object (mid-migration weirdness) | Preserved as-is; logged for review. |

### M11.4 · Test vectors

- **V-MIG-S9-1**: plain-string field → provenance wrapper with `validationStatus === "stale"`.
- **V-MIG-S9-2**: original string preserved in `value.rawLegacy`.
- **V-MIG-S9-3**: empty string → no wrapper created.
- **V-MIG-S9-4**: integrity-log entry emitted with correct count.
- **V-MIG-S9-5**: idempotent — already-wrapped field unchanged.

---

## §M12 · Step 10 — Stamp `engagementId` on every record

**Module**: `step10_stampEngagementId.js` · **Vector**: V-MIG-S10-*

### M12.1 · Transformation

```js
export default function step10(engagement, ctx) {
  const eid = engagement.engagementMeta.engagementId;
  const stampCollection = (col) => {
    if (!col) return col;
    const next = {};
    for (const id of col.allIds) {
      next[id] = { ...col.byId[id], engagementId: eid };
    }
    return { ...col, byId: next };
  };

  return {
    ...engagement,
    customer: { ...engagement.customer, engagementId: eid },
    drivers:      stampCollection(engagement.drivers),
    environments: stampCollection(engagement.environments),
    instances:    stampCollection(engagement.instances),
    gaps:         stampCollection(engagement.gaps)
  };
}
```

### M12.2 · Edge cases

| Input | Behavior |
|---|---|
| Record already has `engagementId === eid` | No-op (idempotent). |
| Record has `engagementId` mismatch (shouldn't happen in v2.0 → v3.0; v2.0 is single-engagement) | Overwrite + log warning. |
| Record has no `engagementId` | Stamp. |

### M12.3 · Test vectors

- **V-MIG-S10-1**: every record post-step10 has `engagementId === engagementMeta.engagementId`.
- **V-MIG-S10-2**: idempotent on already-stamped engagement.

---

## §M13 · Catalog snapshot bundling

### M13.1 · Why bundle catalogs in the migrator

Per directive R9.1.3: migrators do not consult catalogs at runtime. The migrator's behavior must be reproducible against the catalog version it shipped with. Catalogs evolve on a separate cadence; coupling the migrator to whatever the latest catalog happens to be when migration runs would make migrator output non-deterministic.

### M13.2 · Snapshot file shape

```json
// migrations/v2-0_to_v3-0/catalogSnapshot.json
{
  "BUSINESS_DRIVERS":      { "catalogVersion": "2026.04", "entries": [...] },
  "ENV_CATALOG":           { "catalogVersion": "2026.04", "entries": [...] },
  "LAYERS":                { "catalogVersion": "2026.04", "entries": [...] },
  "SERVICE_TYPES":         { "catalogVersion": "2026.04", "entries": [...] },
  "GAP_TYPES":             { "catalogVersion": "2026.04", "entries": [...] },
  "DISPOSITION_ACTIONS":   { "catalogVersion": "2026.04", "entries": [...] },
  "CUSTOMER_VERTICALS":    { "catalogVersion": "2026.04", "entries": [...] },
  "DELL_PRODUCT_TAXONOMY": { "catalogVersion": "2026.04", "entries": [...] }
}
```

### M13.3 · Snapshot freeze policy

The snapshot is **frozen** at migrator commit time. When v3.0 ships, `migrations/v2-0_to_v3-0/catalogSnapshot.json` records the `"2026.04"` versions. When v3.1 ships with newer catalogs, the v2-0 → v3-0 migrator's snapshot does NOT update. Existing v2.0 files migrating in a v3.1 build still use the v3.0-frozen catalogs; the integrity sweep + drift detection (SPEC §S8.4) then flips affected fields to `"stale"` against the v3.1 current catalogs.

This keeps migration deterministic AND surfaces the drift to the user.

### M13.4 · Loader

```js
// migrations/helpers/catalogSnapshot.js
import snapshot from "../v2-0_to_v3-0/catalogSnapshot.json";

export function loadBundledSnapshot() {
  return Object.freeze(snapshot);
}
```

The import is static; bundlers tree-shake it correctly. No fetch, no DOM, no runtime side effects.

---

## §M14 · Failure handling

### M14.1 · Error envelope shapes

```js
// Thrown inside a step:
class MigrationStepError extends Error {
  constructor({ step, cause, partial }) {
    super(`Migration step "${step}" failed: ${cause.message}`);
    this.code     = "MIGRATION_STEP_FAILED";
    this.step     = step;
    this.cause    = cause;
    this.partial  = partial;
  }
}

// Returned from the load harness:
class MigrationFailure {
  constructor(err, originalEngagement) {
    this.code              = "MIGRATION_FAILED";
    this.step              = err.step ?? "unknown";
    this.migratorVersion   = "v2-0_to_v3-0";
    this.message           = err.message;
    this.causeMessage      = err.cause?.message;
    this.originalEnvelope  = originalEngagement;
    this.partialEngagement = err.partial;
  }
}
```

### M14.2 · Recovery flow

```
┌─────────────────────────────────────────────────────────────┐
│ MigrationFailedDialog.js                                    │
│                                                             │
│   Migration of "<filename>" failed at step <N>: <step name> │
│   <message>                                                 │
│                                                             │
│   [ Download original .canvas ]                             │
│   [ Try again (verbose log) ]                               │
│   [ Continue as fresh engagement (original preserved) ]     │
└─────────────────────────────────────────────────────────────┘
```

**M14.2.1 · Download original**: writes the `originalEnvelope` (the unmigrated v2.0 file) to disk for offline analysis.

**M14.2.2 · Try again**: re-runs the migrator with `ctx.verbose = true`, which makes each step log its in/out before throwing. Useful for diagnosis; not used in the normal path.

**M14.2.3 · Continue fresh**: loads an empty v3.0 engagement; the failed file is preserved as a download. User can attempt manual recovery in a text editor + re-import.

### M14.3 · Forbidden patterns

- ❌ Silent auto-recovery (e.g., dropping the failing field and continuing).
- ❌ Falling back to v2.0 mode (v3.0 is single-mode; per directive §15).
- ❌ `try { ... } catch { /* swallow */ }` — every catch logs + rethrows OR has a documented business reason.
- ❌ Default values that mask data loss (e.g., setting `customer.name = "Unknown"` when name is missing — that's quarantine territory, not migrator territory).

### M14.4 · Test vectors

- **V-MIG-FAIL-1**: a step that throws produces `MigrationFailure` with the failing step name.
- **V-MIG-FAIL-2**: `originalEnvelope` deep-equals the input (preserved).
- **V-MIG-FAIL-3**: no console errors swallowed during failure.

---

## §M15 · Round-trip fixture catalogue

### M15.1 · Fixture inventory (8 cases)

| Fixture | Coverage | Approximate size |
|---|---|---|
| `empty.canvas` | 1 customer (name + vertical only), 0 drivers, 0 envs, 0 instances, 0 gaps | <1 KB |
| `single-env.canvas` | 1 env, 5 current + 5 desired instances, 3 gaps, 2 drivers | ~6 KB |
| `multi-env.canvas` | 3 envs, 30 instances total, 8 gaps, 4 drivers | ~25 KB |
| `cross-env-workload.canvas` | 1 workload-layer current instance with `mappedAssetIds` referencing instances in 2 other envs | ~10 KB |
| `cross-env-origin.canvas` | A desired-state instance with `originId` pointing at a current instance in a different env | ~8 KB |
| `multi-env-gaps.canvas` | A gap with `affectedEnvironments.length === 3`, hitting all 3 envs | ~15 KB |
| `ai-provenanced.canvas` | v2.4.x engagement with `mappedDellSolutions` plain-string field set on 4 gaps | ~12 KB |
| `acme-demo.canvas` | The full demo engagement (lifted from v2.4.16 `state/demoSession.js`); 200 instances after expansion | ~120 KB |

### M15.2 · Append-only fixture set

Once a fixture is added, the migrator's behavior on it is locked. Vector V-MIG-1 ... V-MIG-8 run the migrator forward, validate against `EngagementSchema`, then run again to verify idempotency.

**Adding a fixture**: requires authoring (a) the v2.0 `.canvas` file in `tests/fixtures/v2-0/`, (b) the expected v3.0 `.canvas` file in `tests/fixtures/v3-0-expected/`, (c) a vector entry in TESTS.md §V-MIG.

**Modifying a fixture**: forbidden post-merge. If a fixture has a bug, ADD a new fixture; the buggy fixture stays as a regression-anchor.

### M15.3 · Reference engagement derivation

Per SPEC §S14.3, the three reference engagements (`minimal.canvas`, `acme-demo.canvas`, `cross-cutting.canvas`) live in `tests/fixtures/v3-0/`. They are produced by:

| Reference engagement | Source |
|---|---|
| `minimal.canvas` | `migrate(empty.canvas)` |
| `acme-demo.canvas` | `migrate(acme-demo.canvas)` (from §M15.1) |
| `cross-cutting.canvas` | `merge(cross-env-workload.canvas, cross-env-origin.canvas, multi-env-gaps.canvas)` (hand-merged after migration) |

**M15.3.1 · Regeneration**: a script `tests/perf/regenerate-references.js` runs the migrator on the v2-0 fixtures and writes the v3-0 references. Run on every catalog snapshot bump.

---

## §M16 · Open items

| Item | Section | Tag |
|---|---|---|
| Whether `ctx.preserved` accumulates state between steps OR step01 captures v2.0 metadata into ctx upfront | §M6.1.1 | TO RESOLVE |
| `acme-demo.canvas` 200-instance content authoring | §M15.1 | TO AUTHOR (lift + expand from v2.4.16 demoSession) |
| Catalog snapshot for migrator (frozen at migrator-commit time) | §M13 | TO AUTHOR (after SPEC §6 catalog Zod schemas land) |
| `mappedDellSolutions` on entities other than gaps (was the field ever on instances?) | §M11 | TO CONFIRM (audit v2.4.x schema; if yes, extend step09 to handle them) |
| SHA-256 implementation choice for deterministic id (vendor vs. crypto subtle) | §M2.1.1 | TO RESOLVE (default: vendored ~80-line impl for ESM-static-file compatibility) |

---

## §M17 · Document control

- **Authored**: 2026-05-01 alongside SPEC.md draft 2.
- **Owner**: spec writer (Claude Opus 4.7 1M context, this session and successors).
- **Authority cascade**: directive §9 → SPEC §9 → this MIGRATION.md → migrator code in `migrations/v2-0_to_v3-0/`.

### Change log

| Date | Section | Change |
|---|---|---|
| 2026-05-01 | All | Initial draft. 10-step transformation rules + 8-fixture catalogue + failure-handling flow + determinism rules + catalog snapshot bundling. |

End of MIGRATION.
