// state/v3SessionBridge.js
//
// SPEC §S19.3 · co-existence-window bridge.
//
// Subscribes to the v2.x session-changed bus; on every emit (and once
// at module boot), translates the live v2 session into a v3.0
// engagement and stores it in v3EngagementStore. View tabs (once
// migrated per S19.4) and the Canvas Chat surface (per SPEC §S20)
// read fresh data after every user edit through state/v3Adapter.js
// and state/v3EngagementStore.js respectively.
//
// **Translation policy** (per project_v3_no_file_migration_burden.md):
// the bridge does NOT exercise the full v2→v3 file migrator at
// runtime. The migrator is GREEN against synthetic .canvas fixtures
// and stays in the file-load path; the bridge does loose in-memory
// translation of every v2 entity into v3-shape collections so the
// chat sees real session data.
//
// **Loose-shape note** (rc.2): the produced engagement is NOT
// EngagementSchema-strict. v2 short-string ids ("coreDc", "w-001",
// "g-payments") are preserved verbatim instead of converted to
// UUIDs (the v3 schema requires UUIDs for entity ids). Loose is
// fine because the only engagement consumers right now are:
//   - Canvas Chat (reads, never validates)
//   - selectors (read, never validate; memoize on reference identity)
//   - chatTools dispatcher (passes through to selectors)
// When per-view migrations land (SPEC §S19.4) AND/OR a v3-native
// demo replaces the v2 demo (BUG-003 / scheduled in CHANGELOG_PLAN
// rc.2 polish), this bridge tightens. For now the chat sees data.
//
// One-way flow: v2 session is source-of-truth; v3 engagement is
// derived. Writes from views still hit v2.x action paths today.
//
// Forbidden:
//   - importing state/v3Adapter.js from here (the bridge sits BENEATH
//     the adapter: view -> adapter -> store <- bridge <- session)
//   - mutating the v2 session
//   - calling the v2→v3 file migrator from runtime (file-load only)

import { session as liveSession }     from "./sessionStore.js";
import { onSessionChanged }            from "../core/sessionEvents.js";
import { createEmptyEngagement }       from "../schema/engagement.js";
import { setActiveEngagement }         from "./v3EngagementStore.js";

let _running   = false;
let _lastError = null;

// Translation constants. All v2 demo entities were written when these
// catalog versions were active; we stamp them so drift detection (§S6)
// has the right anchor. v3-native demo (scheduled) will set its own.
const CATALOG_VERSION = "2026.04";

function v2SessionToV3Engagement(v2) {
  // Always start from a known-valid empty v3 engagement so we inherit
  // every required default field. Then patch in v2 collections.
  const empty = createEmptyEngagement();
  if (!v2 || typeof v2 !== "object") return empty;

  const engagementId = empty.meta.engagementId;
  const ownerId      = empty.meta.ownerId;
  const now          = (v2.sessionMeta && v2.sessionMeta.savedAt) || empty.meta.createdAt;

  // ─── Customer (already in rc.1 bridge; widened) ──────────────────
  const c = v2.customer || {};
  const customer = Object.assign({}, empty.customer, {
    name:     typeof c.name     === "string" && c.name.trim()     ? c.name.trim()     : empty.customer.name,
    vertical: typeof c.vertical === "string" && c.vertical.trim() ? c.vertical.trim() : empty.customer.vertical,
    region:   typeof c.region   === "string" && c.region.trim()   ? c.region.trim()   : empty.customer.region,
    notes:    typeof c.notes    === "string"                       ? c.notes           : empty.customer.notes,
    engagementId
  });

  // ─── Drivers (from v2 session.customer.drivers[]) ────────────────
  const driverIds = [];
  const driverById = {};
  for (const d of (c.drivers || [])) {
    if (!d || typeof d !== "object") continue;
    const id = String(d.id || ("driver-" + driverIds.length));
    if (driverById[id]) continue;
    driverIds.push(id);
    driverById[id] = {
      id,
      engagementId,
      ownerId,
      // v2 driver.id is the businessDriverId catalog ref (e.g. "cyber_resilience").
      businessDriverId: d.id || null,
      catalogVersion:   CATALOG_VERSION,
      priority:         d.priority || "Medium",
      outcomes:         typeof d.outcomes === "string" ? d.outcomes : "",
      createdAt:        now,
      updatedAt:        now
    };
  }

  // ─── Environments (from v2 session.environments[]) ──────────────
  const envIds = [];
  const envById = {};
  for (const e of (v2.environments || [])) {
    if (!e || typeof e !== "object") continue;
    const id = String(e.id || ("env-" + envIds.length));
    if (envById[id]) continue;
    envIds.push(id);
    envById[id] = {
      id,
      engagementId,
      ownerId,
      // v2 env.id is the envCatalogId (e.g. "coreDc").
      envCatalogId:   e.id || null,
      catalogVersion: CATALOG_VERSION,
      alias:          typeof e.alias    === "string" ? e.alias    : (typeof e.label === "string" ? e.label : ""),
      location:       typeof e.location === "string" ? e.location : "",
      sizeKw:         typeof e.sizeKw   === "number" ? e.sizeKw   : null,
      sqm:            typeof e.sqm      === "number" ? e.sqm      : null,
      tier:           typeof e.tier     === "string" ? e.tier     : null,
      notes:          typeof e.notes    === "string" ? e.notes    : "",
      hidden:         !!e.hidden,
      createdAt:      now,
      updatedAt:      now
    };
  }

  // ─── Instances (from v2 session.instances[]) ────────────────────
  const instIds = [];
  const instById = {};
  const stateCurrent = [];
  const stateDesired = [];
  for (const i of (v2.instances || [])) {
    if (!i || typeof i !== "object") continue;
    const id = String(i.id || ("inst-" + instIds.length));
    if (instById[id]) continue;
    instIds.push(id);
    const inst = {
      id,
      engagementId,
      ownerId,
      state:           i.state === "desired" ? "desired" : "current",
      layerId:         i.layerId || null,
      environmentId:   i.environmentId || null,
      label:           typeof i.label  === "string" ? i.label  : "",
      vendor:          typeof i.vendor === "string" ? i.vendor : "",
      vendorGroup:     i.vendorGroup || "custom",
      criticality:     i.criticality || null,
      disposition:     i.disposition || null,
      originId:        i.originId || null,
      mappedAssetIds:  Array.isArray(i.mappedAssetIds) ? i.mappedAssetIds.slice() : [],
      // v3 has more fields; preserve what v2 carries; rest stay null/default.
      priority:        i.priority || null,
      notes:           typeof i.notes === "string" ? i.notes : "",
      createdAt:       now,
      updatedAt:       now
    };
    instById[id] = inst;
    if (inst.state === "current")      stateCurrent.push(id);
    else if (inst.state === "desired") stateDesired.push(id);
  }

  // ─── Gaps (from v2 session.gaps[]) ──────────────────────────────
  const gapIds = [];
  const gapById = {};
  for (const g of (v2.gaps || [])) {
    if (!g || typeof g !== "object") continue;
    const id = String(g.id || ("gap-" + gapIds.length));
    if (gapById[id]) continue;
    gapIds.push(id);
    gapById[id] = {
      id,
      engagementId,
      ownerId,
      description:                 typeof g.description === "string" ? g.description : "",
      gapType:                     g.gapType || null,
      urgency:                     g.urgency || "Medium",
      phase:                       g.phase   || "now",
      status:                      g.status  || "open",
      layerId:                     g.layerId || null,
      affectedLayers:              Array.isArray(g.affectedLayers)             ? g.affectedLayers.slice()             : (g.layerId ? [g.layerId] : []),
      affectedEnvironments:        Array.isArray(g.affectedEnvironments)       ? g.affectedEnvironments.slice()       : [],
      relatedCurrentInstanceIds:   Array.isArray(g.relatedCurrentInstanceIds)  ? g.relatedCurrentInstanceIds.slice()  : [],
      relatedDesiredInstanceIds:   Array.isArray(g.relatedDesiredInstanceIds)  ? g.relatedDesiredInstanceIds.slice()  : [],
      services:                    Array.isArray(g.services)                   ? g.services.slice()                   : [],
      driverId:                    g.driverId || null,
      projectId:                   g.projectId || null,
      notes:                       typeof g.notes === "string" ? g.notes : "",
      mappedDellSolutions:         Array.isArray(g.mappedDellSolutions) ? g.mappedDellSolutions.slice() : [],
      reviewed:                    !!g.reviewed,
      urgencyOverride:             !!g.urgencyOverride,
      createdAt:                   now,
      updatedAt:                   now
    };
  }

  // ─── Compose ────────────────────────────────────────────────────
  return {
    meta:         Object.assign({}, empty.meta, { isDemo: !!v2.isDemo, updatedAt: now }),
    customer,
    drivers:      { byId: driverById, allIds: driverIds, indexes: { byBusinessDriverId: {} } },
    environments: { byId: envById,    allIds: envIds   },
    instances:    { byId: instById,   allIds: instIds, byState: { current: stateCurrent, desired: stateDesired } },
    gaps:         { byId: gapById,    allIds: gapIds   },
    activeEntity: null,
    integrityLog: []
  };
}

async function bridgeOnce(reason) {
  if (_running) return;
  _running = true;
  try {
    const eng = v2SessionToV3Engagement(liveSession);
    setActiveEngagement(eng);
    _lastError = null;
  } catch (e) {
    _lastError = { code: "BRIDGE_THREW", message: e && e.message };
    console.error("[v3SessionBridge] bridge threw:", e);
    try { setActiveEngagement(createEmptyEngagement()); } catch (_e) { /* swallow */ }
  } finally {
    _running = false;
  }
}

// Boot: run once on module load to populate the engagement store.
bridgeOnce("boot");

// Subscribe to v2.x session-changed events.
onSessionChanged(function(reason) {
  bridgeOnce(reason);
});

export function _bridgeOnceForTests(reason) { return bridgeOnce(reason); }
export function _getLastBridgeError()       { return _lastError; }
