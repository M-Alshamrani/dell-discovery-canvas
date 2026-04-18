// services/gapsService.js — pure read-side gap queries

import { session } from "../state/sessionStore.js";

export function getAllGaps() {
  return session.gaps || [];
}

export function getFilteredGaps({ layerIds = [], envId = "all" } = {}) {
  return getAllGaps().filter(g => {
    const layers = g.affectedLayers?.length ? g.affectedLayers : [g.layerId];
    const envs   = g.affectedEnvironments || [];
    const lOk = !layerIds.length || layers.some(l => layerIds.includes(l));
    const eOk = envId === "all" || envs.length === 0 || envs.includes(envId);
    return lOk && eOk;
  });
}

export function getGapsByPhase({ layerIds = [], envId = "all" } = {}) {
  const result = { now: [], next: [], later: [] };
  getFilteredGaps({ layerIds, envId }).forEach(g => {
    const ph = g.phase || "now";
    if (!result[ph]) result[ph] = [];
    result[ph].push(g);
  });
  return result;
}
