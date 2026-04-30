// services/catalogLoader.js — v3.0 · SPEC sec S6.1.2
//
// Loader interface. v3.0 reads bundled JS-export snapshots; v3.1 may
// swap implementation to fetch from a remote endpoint behind the same
// async-Promise interface (per OPEN_QUESTIONS_RESOLVED Q4: defer
// channel choice to v3.1).
//
// Validation: each snapshot is parsed through CatalogSchema at first
// load + cached. A malformed snapshot throws CatalogLoadError; the
// error surfaces to the loader caller.

import { catalogSchemaOf, CatalogEntrySchema, CatalogVersionSchema } from "../schema/helpers/catalog.js";

import LAYERS               from "../catalogs/snapshots/layers.js";
import BUSINESS_DRIVERS     from "../catalogs/snapshots/business_drivers.js";
import ENV_CATALOG          from "../catalogs/snapshots/env_catalog.js";
import SERVICE_TYPES        from "../catalogs/snapshots/service_types.js";
import GAP_TYPES            from "../catalogs/snapshots/gap_types.js";
import DISPOSITION_ACTIONS  from "../catalogs/snapshots/disposition_actions.js";
import CUSTOMER_VERTICALS   from "../catalogs/snapshots/customer_verticals.js";
import DELL_PRODUCT_TAXONOMY from "../catalogs/snapshots/dell_product_taxonomy.js";

const RAW_SNAPSHOTS = Object.freeze({
  LAYERS,
  BUSINESS_DRIVERS,
  ENV_CATALOG,
  SERVICE_TYPES,
  GAP_TYPES,
  DISPOSITION_ACTIONS,
  CUSTOMER_VERTICALS,
  DELL_PRODUCT_TAXONOMY
});

// Generic CatalogSchema (uses CatalogEntrySchema as the entry shape;
// per-catalog extra fields pass through as `unknown` at this layer —
// catalog-specific validation lives with the consumers).
const GenericCatalogSchema = catalogSchemaOf(CatalogEntrySchema.passthrough());

// Cache parsed catalogs so we only validate once per process.
const PARSED_CACHE = {};

export class CatalogLoadError extends Error {
  constructor(catalogId, reason) {
    super(`Catalog '${catalogId}' load failed: ${reason}`);
    this.name = "CatalogLoadError";
    this.catalogId = catalogId;
  }
}

// Per SPEC sec S6.1.2: async-Promise interface so v3.1 can swap to a
// remote fetch implementation without changing callers. v3.0 returns
// an immediately-resolved Promise.
export async function loadCatalog(catalogId) {
  if (PARSED_CACHE[catalogId]) return PARSED_CACHE[catalogId];

  const raw = RAW_SNAPSHOTS[catalogId];
  if (!raw) throw new CatalogLoadError(catalogId, "snapshot not bundled");

  const result = GenericCatalogSchema.safeParse(raw);
  if (!result.success) {
    throw new CatalogLoadError(catalogId,
      "snapshot does not parse: " + JSON.stringify(result.error.issues));
  }
  PARSED_CACHE[catalogId] = result.data;
  return result.data;
}

export async function loadAllCatalogs() {
  const ids = Object.keys(RAW_SNAPSHOTS);
  const out = {};
  for (const id of ids) {
    out[id] = await loadCatalog(id);
  }
  return out;
}

// Synchronous accessor for callers that have already loaded the catalog.
// Throws if not yet loaded. Useful in pure synchronous contexts (e.g.
// integrity sweep, manifest generator) once the boot pipeline has
// awaited loadAllCatalogs.
export function peekCatalog(catalogId) {
  if (!PARSED_CACHE[catalogId]) {
    throw new CatalogLoadError(catalogId, "not loaded; await loadCatalog first");
  }
  return PARSED_CACHE[catalogId];
}

// For tests: clear cache so each test starts fresh.
export function _resetCacheForTests() {
  for (const k of Object.keys(PARSED_CACHE)) delete PARSED_CACHE[k];
}

export const CATALOG_IDS = Object.keys(RAW_SNAPSHOTS);
