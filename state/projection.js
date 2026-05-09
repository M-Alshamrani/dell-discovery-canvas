// state/projection.js -- engagement -> v2-shape session projector
// (transitional helper · was state/v3Projection.js · renamed in rc.7
// post-tag-prep v3-prefix purge per feedback_no_version_prefix_in_names.md).
//
// Per SPEC §S40 (v3-pure architecture). Read-only consumers (Reporting +
// 4 Summary views) need session-shape data because the services they
// call (services/healthMetrics, services/roadmapService, etc.) take
// `session` as a parameter. Rather than refactoring all those services
// in this sub-arc, we project the v3 engagement to session-shape at the
// view boundary so the view modules don't import sessionStore directly.
//
// This module is TRANSITIONAL. It retires at 7e-8 alongside the v2
// sessionStore deletion -- by then, services either accept engagement
// directly or are themselves deleted (services/gapsService etc. that
// import session would be cut over).
//
// Authority: SPEC §S40 + RULES §16 CH34. The fact that this projector
// exists in v3-only code doesn't mean v3 has shape impedance with v2;
// it means the transitional cutover preserves working services without
// rewriting their input contracts in a single commit.

import { getActiveEngagement } from "./engagementStore.js";
import { ENV_CATALOG } from "../core/config.js";

// getEngagementAsSession() -- returns a fresh v2-shape session object
// derived from the active v3 engagement. Always returns a defined
// shape (empty arrays + empty customer when v3 engagement is null).
//
// Mutating the returned object is HARMLESS but POINTLESS -- v3 is the
// source of truth; mutations don't propagate back. Callers must use
// the returned object as a read-only snapshot.
export function getEngagementAsSession() {
  const eng = getActiveEngagement();
  if (!eng) {
    return {
      sessionId:    "no-engagement",
      isDemo:       false,
      customer: {
        name:     "",
        vertical: "",
        region:   "",
        notes:    "",
        drivers:  []
      },
      sessionMeta: {
        date:          new Date().toISOString().slice(0, 10),
        presalesOwner: "",
        status:        "Draft",
        version:       "2.0"
      },
      environments: [],
      instances:    [],
      gaps:         []
    };
  }

  // Drivers (v2 shape: { id (= businessDriverId), priority, outcomes }).
  // BUG-E fix (rc.7 / 7e-9d · 2026-05-09 PM) · also build a UUID→typeId
  // map so gap.driverId can be remapped below. Pre-fix the v2-shape
  // session carried gap.driverId verbatim from v3 (a UUID), but the
  // session.customer.drivers[].id was already a typeId — so
  // services/programsService.groupProjectsByProgram (which checks Set
  // membership of session.customer.drivers ids against project.driverId)
  // missed every project, dropping all gaps into the "unassigned"
  // swimlane on the Reporting Roadmap. Sister adapter
  // state/legacySessionAdapter.js (file save) was already doing this
  // remap (line ~123); projection.js had drifted. Same shape as the
  // BUG-049 envUuidToCatalogId remap below.
  const driverUuidToTypeId = {};
  const drivers = (eng.drivers && eng.drivers.allIds) ? eng.drivers.allIds.map(id => {
    const d = eng.drivers.byId[id];
    if (!d) return null;
    if (d.id && d.businessDriverId) driverUuidToTypeId[d.id] = d.businessDriverId;
    return {
      id:       d.businessDriverId,
      priority: d.priority || "Medium",
      outcomes: typeof d.outcomes === "string" ? d.outcomes : ""
    };
  }).filter(Boolean) : [];

  // Environments (v2 shape: { id (= envCatalogId), hidden, alias?, location?, ... }).
  // BUG-049 fix · also build envUuidToCatalogId map so instance.environmentId
  // and gap.affectedEnvironments can be remapped from v3 UUID to v2 envCatalogId
  // (typeId) below. v2-shape consumers (services/roadmapService.js envLabel,
  // services/healthMetrics.js env grouping, etc) look up env labels via
  // ENVIRONMENTS catalog keyed by typeId; passing through v3 UUIDs makes
  // those lookups fail silently and leak the UUID into UI surfaces (BUG-049
  // visible repro: Initiative pipeline chips on Tab 5 Reporting Overview
  // showed "00000000-...-001 — Data Protection & Recovery Modernization (1)"
  // instead of "Riyadh Core DC — Data Protection & Recovery Modernization (1)").
  const envUuidToCatalogId = {};
  const environments = (eng.environments && eng.environments.allIds) ? eng.environments.allIds.map(id => {
    const e = eng.environments.byId[id];
    if (!e) return null;
    if (e.id && e.envCatalogId) envUuidToCatalogId[e.id] = e.envCatalogId;
    const out = { id: e.envCatalogId, hidden: !!e.hidden };
    if (typeof e.alias    === "string" && e.alias.length    > 0) out.alias    = e.alias;
    if (typeof e.location === "string" && e.location.length > 0) out.location = e.location;
    if (typeof e.sizeKw   === "number") out.sizeKw   = e.sizeKw;
    if (typeof e.sqm      === "number") out.sqm      = e.sqm;
    if (typeof e.tier     === "string" && e.tier.length     > 0) out.tier     = e.tier;
    if (typeof e.notes    === "string" && e.notes.length    > 0) out.notes    = e.notes;
    return out;
  }).filter(Boolean) : [];

  // Instances (v2 shape: pass-through with v3 IDs/UUIDs).
  // BUG-049 fix · environmentId remapped from v3 UUID to v2 envCatalogId
  // so v2-shape services group instances by typeId (the legacy expectation)
  // instead of UUID. instance.id stays UUID — gap.relatedCurrent/Desired-
  // InstanceIds are v3 UUIDs and must continue to match for downstream lookup.
  const instances = (eng.instances && eng.instances.allIds) ? eng.instances.allIds.map(id => {
    const i = eng.instances.byId[id];
    if (!i) return null;
    const out = {
      id:            i.id,
      state:         i.state,
      layerId:       i.layerId,
      environmentId: envUuidToCatalogId[i.environmentId] || i.environmentId,
      label:         i.label,
      vendor:        i.vendor,
      vendorGroup:   i.vendorGroup,
      criticality:   i.criticality,
      notes:         i.notes,
      disposition:   i.disposition
    };
    if (i.priority   !== null && i.priority   !== undefined) out.priority   = i.priority;
    if (i.originId   !== null && i.originId   !== undefined) out.originId   = i.originId;
    if (Array.isArray(i.mappedAssetIds) && i.mappedAssetIds.length > 0) out.mappedAssetIds = i.mappedAssetIds.slice();
    return out;
  }).filter(Boolean) : [];

  // Gaps (v2 shape: pass-through; v3 gaps have all v2-relevant fields).
  // BUG-049 fix · affectedEnvironments remapped from v3 UUIDs to v2 envCatalogIds.
  // BUG-E fix (rc.7 / 7e-9d) · driverId remapped from v3 UUID to v2 typeId
  // so groupProjectsByProgram can match the v2-shape session.customer.drivers
  // (which carry typeId ids per the drivers projection above). Sister adapter
  // state/legacySessionAdapter.js does the same remap; projection.js had
  // drifted, dropping all projects into the 'Unassigned' swimlane on Tab 5.
  // gap.id + relatedCurrent/DesiredInstanceIds stay UUID (downstream
  // selectors look those up against the projected instances which keep UUID id).
  const gaps = (eng.gaps && eng.gaps.allIds) ? eng.gaps.allIds.map(id => {
    const g = eng.gaps.byId[id];
    if (!g) return null;
    const out = { ...g };
    if (Array.isArray(g.affectedEnvironments)) {
      out.affectedEnvironments = g.affectedEnvironments.map(envId => envUuidToCatalogId[envId] || envId);
    }
    // BUG-E remap: driverId UUID → typeId. null preserved when gap has no driver.
    if (g.driverId && driverUuidToTypeId[g.driverId]) {
      out.driverId = driverUuidToTypeId[g.driverId];
    }
    return out;
  }).filter(Boolean) : [];

  return {
    sessionId:    (eng.meta && eng.meta.engagementId) || "v3-engagement",
    isDemo:       !!(eng.meta && eng.meta.isDemo),
    customer: {
      name:     (eng.customer && eng.customer.name)     || "",
      vertical: (eng.customer && eng.customer.vertical) || "",
      region:   (eng.customer && eng.customer.region)   || "",
      notes:    (eng.customer && eng.customer.notes)    || "",
      drivers
    },
    sessionMeta: {
      date:          new Date().toISOString().slice(0, 10),
      presalesOwner: "",
      status:        "Draft",
      version:       "2.0"
    },
    environments,
    instances,
    gaps
  };
}

// Convenience helper for views that need just visible envs (matches
// core/config.js getVisibleEnvironments contract).
export function getVisibleEnvsFromEngagement() {
  const eng = getActiveEngagement();
  if (!eng || !eng.environments || !Array.isArray(eng.environments.allIds)) return [];
  return eng.environments.allIds.map(id => {
    const e = eng.environments.byId[id];
    if (!e || e.hidden) return null;
    const cat = ENV_CATALOG.find(c => c.id === e.envCatalogId);
    return {
      id:    e.envCatalogId,
      label: cat ? cat.label : e.envCatalogId,
      hint:  cat ? cat.hint : "",
      hidden: false
    };
  }).filter(Boolean);
}
