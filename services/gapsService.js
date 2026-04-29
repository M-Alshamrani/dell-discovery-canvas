// services/gapsService.js — pure read-side gap queries
//
// Last audited v2.4.16 · 2026-04-29 · per docs/TAXONOMY.md §6.2.
// Closed-gap behavior: NONE of these helpers filter by gap.status.
// Caller is responsible for closed-gap exclusion (Tab 4 GapsEditView
// applies the user's `showClosedGaps` toggle via state/filterState.js
// + body data-attribute + CSS dim rule; Tab 5 SummaryGapsView shares
// the same filter via SharedFilterBar). This is by-design — these
// functions are reusable across "show all" and "active only" contexts.
// Hidden envs: not filtered here either (envId="all" returns everything).

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
