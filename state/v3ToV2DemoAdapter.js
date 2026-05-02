// state/v3ToV2DemoAdapter.js
//
// SPEC §S21.5 · v3 engagement → v2 sessionState pure-function adapter.
//
// Purpose: at demo-load time we want a SINGLE source of truth — the v3
// engagement (`core/demoEngagement.js`). v2.x view tabs that have not
// yet migrated to `state/adapter.js` (per S19.4) need a v2-shaped
// session to read. This adapter derives that v2-shaped object from the
// v3 engagement so both surfaces show the same customer + drivers +
// environments + instances + gaps.
//
// One-way: v3 → v2. Used at demo-load only. Real workshop edits happen
// on the v3 engagement (eventually); the bridge handles v2 → v3 for the
// co-existence window per `state/sessionBridge.js`.
//
// The translation is mechanical:
//   - v3 customer → v2 customer (mirror name/vertical/region/notes;
//     v2 has segment+industry which we mirror from vertical for compat)
//   - v3 drivers (UUID-keyed) → v2 customer.drivers (catalog-typeId-keyed)
//   - v3 environments (UUID-keyed) → v2 environments (envCatalogId-keyed)
//   - v3 instances → v2 instances (UUID id preserved; environmentId
//     re-keyed from UUID to envCatalogId; mappedAssetIds preserved
//     since they reference instance UUIDs which we kept)
//   - v3 gaps → v2 gaps (same id/UUID; affectedEnvironments re-keyed
//     to catalog ids; driverId re-keyed from UUID to businessDriverId)
//
// Forbidden:
//   - mutating the input engagement
//   - emitting any side effect (this is a pure transform)
//   - importing state/sessionStore.js (the caller composes the result)
//
// Authority: docs/v3.0/SPEC.md §S21.5 · docs/v3.0/TESTS.md §T21 V-DEMO-V2-1.

// Pure: same input → same output, no side effects.
export function engagementToV2Session(eng) {
  if (!eng || typeof eng !== "object") {
    throw new Error("engagementToV2Session: requires a v3 engagement object");
  }

  const envIdToCatalogId = {};
  eng.environments.allIds.forEach(uuid => {
    const env = eng.environments.byId[uuid];
    if (env && typeof env.envCatalogId === "string") {
      envIdToCatalogId[uuid] = env.envCatalogId;
    }
  });

  const driverUuidToTypeId = {};
  eng.drivers.allIds.forEach(uuid => {
    const d = eng.drivers.byId[uuid];
    if (d && typeof d.businessDriverId === "string") {
      driverUuidToTypeId[uuid] = d.businessDriverId;
    }
  });

  const v2Drivers = eng.drivers.allIds.map(uuid => {
    const d = eng.drivers.byId[uuid];
    return {
      id:       d.businessDriverId,
      priority: d.priority,
      outcomes: d.outcomes
    };
  });

  const v2Environments = eng.environments.allIds.map(uuid => {
    const e = eng.environments.byId[uuid];
    const out = {
      id:       e.envCatalogId,
      hidden:   !!e.hidden,
      alias:    e.alias || "",
      location: e.location || "",
      tier:     e.tier || null,
      notes:    e.notes || ""
    };
    if (typeof e.sizeKw === "number") out.sizeKw = e.sizeKw;
    if (typeof e.sqm    === "number") out.sqm    = e.sqm;
    return out;
  });

  const v2Instances = eng.instances.allIds.map(uuid => {
    const i = eng.instances.byId[uuid];
    const out = {
      id:            i.id,                                                       // keep v3 UUID; v2 schema accepts any string
      state:         i.state,
      layerId:       i.layerId,
      environmentId: envIdToCatalogId[i.environmentId] || i.environmentId,
      label:         i.label,
      vendor:        i.vendor,
      vendorGroup:   i.vendorGroup,
      criticality:   i.criticality,
      disposition:   i.disposition || "keep",
      notes:         i.notes || ""
    };
    if (Array.isArray(i.mappedAssetIds) && i.mappedAssetIds.length > 0) {
      out.mappedAssetIds = i.mappedAssetIds.slice();
    }
    if (i.originId) out.originId = i.originId;
    if (i.priority) out.priority = i.priority;
    return out;
  });

  const v2Gaps = eng.gaps.allIds.map(uuid => {
    const g = eng.gaps.byId[uuid];
    return {
      id:                        g.id,
      description:               g.description,
      gapType:                   g.gapType,
      urgency:                   g.urgency,
      urgencyOverride:           !!g.urgencyOverride,
      phase:                     g.phase,
      status:                    g.status,
      reviewed:                  !!g.reviewed,
      layerId:                   g.layerId,
      affectedLayers:            (g.affectedLayers || []).slice(),
      affectedEnvironments:      (g.affectedEnvironments || []).map(uuid => envIdToCatalogId[uuid] || uuid),
      relatedCurrentInstanceIds: (g.relatedCurrentInstanceIds || []).slice(),
      relatedDesiredInstanceIds: (g.relatedDesiredInstanceIds || []).slice(),
      services:                  (g.services || []).slice(),
      driverId:                  g.driverId ? (driverUuidToTypeId[g.driverId] || null) : null,
      notes:                     g.notes || ""
    };
  });

  return {
    sessionId:  "sess-demo-v3-derived",
    isDemo:     true,
    personaId:  "v3-demo-derived",
    customer: {
      name:     eng.customer.name,
      vertical: eng.customer.vertical || "",
      segment:  eng.customer.vertical || "",
      industry: eng.customer.vertical || "",
      region:   eng.customer.region   || "",
      notes:    eng.customer.notes    || "",
      drivers:  v2Drivers
    },
    sessionMeta: {
      date:          eng.meta.engagementDate,
      presalesOwner: eng.meta.presalesOwner || "",
      status:        eng.meta.status        || "Draft",
      version:       "2.0"
    },
    environments: v2Environments,
    instances:    v2Instances,
    gaps:         v2Gaps
  };
}
