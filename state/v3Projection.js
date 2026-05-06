// state/v3Projection.js -- v3 engagement -> v2-shape session projector
// (rc.7 / 7e-6 transitional helper).
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
  const drivers = (eng.drivers && eng.drivers.allIds) ? eng.drivers.allIds.map(id => {
    const d = eng.drivers.byId[id];
    return d ? {
      id:       d.businessDriverId,
      priority: d.priority || "Medium",
      outcomes: typeof d.outcomes === "string" ? d.outcomes : ""
    } : null;
  }).filter(Boolean) : [];

  // Environments (v2 shape: { id (= envCatalogId), hidden, alias?, location?, ... }).
  const environments = (eng.environments && eng.environments.allIds) ? eng.environments.allIds.map(id => {
    const e = eng.environments.byId[id];
    if (!e) return null;
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
  const instances = (eng.instances && eng.instances.allIds) ? eng.instances.allIds.map(id => {
    const i = eng.instances.byId[id];
    if (!i) return null;
    const out = {
      id:            i.id,
      state:         i.state,
      layerId:       i.layerId,
      environmentId: i.environmentId,
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
  const gaps = (eng.gaps && eng.gaps.allIds) ? eng.gaps.allIds.map(id => {
    const g = eng.gaps.byId[id];
    return g ? { ...g } : null;
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
