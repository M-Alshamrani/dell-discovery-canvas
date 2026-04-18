// services/vendorMixService.js — pure vendor composition analytics

import { session } from "../state/sessionStore.js";

function getFiltered({ stateFilter = "combined", layerIds = [] } = {}) {
  return (session.instances || []).filter(i => {
    if (stateFilter === "current" && i.state !== "current") return false;
    if (stateFilter === "desired" && i.state !== "desired") return false;
    if (layerIds.length && !layerIds.includes(i.layerId))   return false;
    return true;
  });
}

export function computeMixByLayer({ stateFilter = "combined", layerIds = [] } = {}) {
  const result = {};
  layerIds.forEach(id => { result[id] = { dell: 0, nonDell: 0, custom: 0, total: 0 }; });
  getFiltered({ stateFilter, layerIds }).forEach(i => {
    if (!result[i.layerId]) result[i.layerId] = { dell: 0, nonDell: 0, custom: 0, total: 0 };
    const b = result[i.layerId];
    if      (i.vendorGroup === "dell")    b.dell++;
    else if (i.vendorGroup === "nonDell") b.nonDell++;
    else                                  b.custom++;
    b.total++;
  });
  return result;
}

export function computeMixByEnv({ stateFilter = "combined", layerIds = [], environments = [] } = {}) {
  const result = {};
  environments.forEach(e => { result[e.id] = { dell: 0, nonDell: 0, custom: 0, total: 0 }; });
  getFiltered({ stateFilter, layerIds }).forEach(i => {
    if (!result[i.environmentId]) result[i.environmentId] = { dell: 0, nonDell: 0, custom: 0, total: 0 };
    const b = result[i.environmentId];
    if      (i.vendorGroup === "dell")    b.dell++;
    else if (i.vendorGroup === "nonDell") b.nonDell++;
    else                                  b.custom++;
    b.total++;
  });
  return result;
}

export function computeVendorTableData({ layerIds = [] } = {}) {
  const map = new Map();
  (session.instances || []).forEach(i => {
    if (layerIds.length && !layerIds.includes(i.layerId)) return;
    const key = i.vendor || i.label;
    if (!map.has(key)) map.set(key, { vendor: key, vendorGroup: i.vendorGroup || "custom", current: 0, desired: 0, total: 0 });
    const r = map.get(key);
    if (i.state === "current") r.current++;
    if (i.state === "desired") r.desired++;
    r.total = r.current + r.desired;
  });
  return [...map.values()].sort((a, b) => b.total - a.total);
}
