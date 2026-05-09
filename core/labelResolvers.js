// core/labelResolvers.js — v3.0 · SPEC §S43.3 (rc.7 / 7e-9 · 2026-05-09 PM)
//
// Single source of truth for UUID/typeId → human-readable label
// resolution. Every view + service that displays a label MUST import
// from here. Per SPEC §S43.3 / F43.1: NEVER fall back to displaying
// raw UUIDs in user-visible surfaces.
//
// **Why centralized**: pre-Z2 (BUG-A audit 2026-05-09 PM) discovered
// 4 latent UUID-leak surfaces across services/roadmapService,
// ui/views/MatrixView, ui/views/SummaryVendorView, plus the two
// already-fixed sites in ui/views/GapsEditView + services/programsService.
// Each had its own inline `?: rawId` fallback. Per the user's locked
// direction "scalable and maintainable structured work, not patches"
// (2026-05-09 PM): one module, one contract, one test surface. Future
// resolvers (skill labels, service labels, etc.) extend the same pattern.
//
// **Resolver contract**: each takes either a v3 UUID OR a v2 catalog
// typeId, walks both the active engagement (v3) and the static
// catalogs (v2), and returns either a real label or a structured
// placeholder string (PLACEHOLDER_*). Defensive: never throws on bad
// input; null/undefined/empty returns the placeholder. Used on the
// render path so any throw would crash the whole view.
//
// **Module dependencies**:
//   - core/config.js (LAYERS, ENV_CATALOG, ENVIRONMENTS, BUSINESS_DRIVERS) -- pure data
//   - state/engagementStore.js (getActiveEngagement) -- read-only access for v3 UUID resolution
//   No circular deps: engagementStore does NOT import from labelResolvers.
//
// Authority: docs/v3.0/SPEC.md §S43.3 · docs/RULES.md §16 CH36.

import { LAYERS, ENV_CATALOG, ENVIRONMENTS, BUSINESS_DRIVERS } from "./config.js";
import { getActiveEngagement } from "../state/engagementStore.js";

// ─── Structured placeholder strings (SPEC §S43.3) ───────────────────────
// These are user-visible. Workshop-friendly + parenthesized so they read
// as missing-data signals, not as real labels. Tests assert exact match.
export const PLACEHOLDER_ENV      = "(unknown environment)";
export const PLACEHOLDER_LAYER    = "(unknown layer)";
export const PLACEHOLDER_DRIVER   = "(unknown driver)";
export const PLACEHOLDER_INSTANCE = "(unknown instance)";

/**
 * envLabel(idOrUuid) -> human-readable env label
 *
 * Resolution order:
 *   1. "crossCutting" sentinel -> "Cross-cutting"
 *   2. v3 path: getActiveEngagement().environments.byId[uuid] →
 *      env.alias (if non-empty) → ENV_CATALOG.find(envCatalogId).label →
 *      env.envCatalogId (typeId fallback for legacy data)
 *   3. v2 path: ENV_CATALOG.find(typeId).label → ENVIRONMENTS.find(typeId).label
 *   4. PLACEHOLDER_ENV
 */
export function envLabel(idOrUuid) {
  if (!idOrUuid || typeof idOrUuid !== "string") return PLACEHOLDER_ENV;
  if (idOrUuid === "crossCutting") return "Cross-cutting";

  // v3 path: walk active engagement
  try {
    const eng = getActiveEngagement();
    if (eng && eng.environments && eng.environments.byId && eng.environments.byId[idOrUuid]) {
      const e = eng.environments.byId[idOrUuid];
      if (e.alias && typeof e.alias === "string" && e.alias.length > 0) return e.alias;
      const cat = ENV_CATALOG.find(function(c) { return c.id === e.envCatalogId; });
      if (cat) return cat.label;
      // Defensive · v3 env without a known envCatalogId is a data
      // integrity issue (scrubber should catch). Fall through.
    }
  } catch (_e) { /* defensive · resolver MUST NOT throw on render path */ }

  // v2/legacy path: try ENV_CATALOG (full 8 entries) then ENVIRONMENTS
  // (default-4 subset). BUG-049-style polish: catalog is authoritative.
  const cat = ENV_CATALOG.find(function(c) { return c.id === idOrUuid; });
  if (cat) return cat.label;
  if (typeof ENVIRONMENTS !== "undefined" && Array.isArray(ENVIRONMENTS)) {
    const env = ENVIRONMENTS.find(function(e) { return e.id === idOrUuid; });
    if (env) return env.label;
  }

  return PLACEHOLDER_ENV;
}

/**
 * layerLabel(typeId) -> human-readable layer label
 *
 * LAYERS catalog has 6 fixed entries (workload / compute / storage /
 * dataProtection / virtualization / infrastructure). typeId is always
 * a string id, never a UUID. Returns PLACEHOLDER_LAYER for any unknown
 * input rather than the typeId itself (consistent §S43.3 behavior).
 */
export function layerLabel(typeId) {
  if (!typeId || typeof typeId !== "string") return PLACEHOLDER_LAYER;
  const l = LAYERS.find(function(x) { return x.id === typeId; });
  return l ? l.label : PLACEHOLDER_LAYER;
}

/**
 * driverLabel(idOrUuid) -> human-readable driver label
 *
 * Resolution order:
 *   1. v2 path: BUSINESS_DRIVERS catalog typeId match
 *   2. v3 path: getActiveEngagement().drivers.byId[uuid].businessDriverId
 *      → BUSINESS_DRIVERS.find(typeId).label
 *   3. PLACEHOLDER_DRIVER
 */
export function driverLabel(idOrUuid) {
  if (!idOrUuid) return PLACEHOLDER_DRIVER;

  // v2 path: directly a catalog typeId
  const d = BUSINESS_DRIVERS.find(function(b) { return b.id === idOrUuid; });
  if (d) return d.label;

  // v3 path: UUID → engagement.drivers.byId resolution
  try {
    const eng = getActiveEngagement();
    const v3d = eng && eng.drivers && eng.drivers.byId && eng.drivers.byId[idOrUuid];
    if (v3d && v3d.businessDriverId) {
      const d2 = BUSINESS_DRIVERS.find(function(b) { return b.id === v3d.businessDriverId; });
      if (d2) return d2.label;
      // Defensive · v3 driver with unknown businessDriverId is a data
      // integrity issue (scrubber doesn't catch this case yet — would
      // need a catalog-membership check). Fall through.
    }
  } catch (_e) { /* defensive · resolver MUST NOT throw on render path */ }

  return PLACEHOLDER_DRIVER;
}

/**
 * instanceLabel(uuid) -> instance.label or PLACEHOLDER_INSTANCE
 *
 * Pure UUID resolution against the active engagement. No legacy v2
 * fallback (instances were always UUID-keyed; pre-rc.7 the v2 surface
 * used inst.id as a string id but the v3-pure cutover unified on UUIDs).
 */
export function instanceLabel(uuid) {
  if (!uuid || typeof uuid !== "string") return PLACEHOLDER_INSTANCE;
  try {
    const eng = getActiveEngagement();
    const inst = eng && eng.instances && eng.instances.byId && eng.instances.byId[uuid];
    if (inst && typeof inst.label === "string" && inst.label.length > 0) return inst.label;
  } catch (_e) { /* defensive */ }
  return PLACEHOLDER_INSTANCE;
}
