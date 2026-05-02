// core/dataContract.js
//
// SPEC §S25 · Data contract — LLM grounding meta-model. THE single
// artifact that grounds every Canvas Chat turn.
//
// Derived (NEVER hand-maintained) from:
//   - schema/*.js          → entities[].fields, relationships (via fkDeclarations), invariants list
//   - services/manifestGenerator.js → bindablePaths
//   - services/catalogLoader.js     → catalogs (id + version + entries with id+label+description)
//   - services/chatTools.js          → analyticalViews
//
// Module-load contract (per SPEC §S25 R25.2 + R25.4):
//   1. Top-level `await loadAllCatalogs()` resolves catalogs before
//      the contract is built (ES-modules top-level-await).
//   2. `validateContract(c)` runs at module load and THROWS if any
//      catalog has zero entries OR any relationship's `from` references
//      an undeclared entity OR any invariant id is duplicated.
//   3. Deterministic FNV-1a checksum over the contract JSON (excluding
//      the volatile `generatedAt` + the checksum itself).
//   4. Module-cached: getDataContract() returns the SAME reference on
//      every call (per V-CONTRACT-1).
//
// Forbidden (per RULES §17 / SPEC §S23):
//   - importing from tests/
//   - hand-maintained fields/relationships/catalogs that could be derived
//   - non-deterministic checksums (no clocks; checksum excludes generatedAt)
//
// Authority: docs/v3.0/SPEC.md §S25 · docs/v3.0/TESTS.md §T25 V-CONTRACT-1..7 ·
//            docs/RULES.md §16 CH15+CH16+CH17.

import { CustomerSchema, customerFkDeclarations }                from "../schema/customer.js";
import { DriverSchema, driverFkDeclarations }                    from "../schema/driver.js";
import { EnvironmentSchema, environmentFkDeclarations }          from "../schema/environment.js";
import { InstanceSchema, instanceFkDeclarations }                from "../schema/instance.js";
import { GapSchema, gapFkDeclarations }                          from "../schema/gap.js";
import { EngagementMetaSchema, CURRENT_SCHEMA_VERSION }          from "../schema/engagement.js";
import { generateManifest }                                       from "../services/manifestGenerator.js";
import { loadAllCatalogs }                                        from "../services/catalogLoader.js";
import { CHAT_TOOLS }                                             from "../services/chatTools.js";

// ─── Hand-authored prose (descriptions, not derivable from code) ─────

const ENTITY_DESCRIPTIONS = {
  engagementMeta: "Workshop-level metadata. One per engagement. Fields: engagementId (UUID, authoritative), schemaVersion ('3.0' locked), ownerId, presalesOwner, engagementDate, status (Draft|In review|Locked), createdAt, updatedAt.",
  customer:       "Single customer record per engagement. Fields: name, vertical (FK to CUSTOMER_VERTICALS catalog), region, notes.",
  driver:         "Strategic / business driver the engagement addresses. Collection. Each driver references a BUSINESS_DRIVERS catalog entry + carries presales-captured priority + outcomes free-text.",
  environment:    "Physical or logical environment (data center, edge site, cloud region). Collection. Each references an ENV_CATALOG entry + carries alias / location / sizeKw / sqm / tier / notes / hidden.",
  instance:       "A single asset OR workload at a (state, layer, environment) cell. state is 'current' (today's reality) or 'desired' (future-state plan). layerId is one of the 6 layers. originId links a desired back to the current it replaces (replace lifecycle). mappedAssetIds (workload only) lists the underlying compute/storage/dataProtection assets. aiSuggestedDellMapping is provenance-wrapped per §S8.",
  gap:            "A discrete improvement opportunity derived from current↔desired delta + business drivers. gapType (enhance|replace|introduce|consolidate|ops). urgency (High|Medium|Low). phase (now|next|later). status (open|in_progress|closed|deferred). affectedLayers[0] === layerId (G6). aiMappedDellSolutions is provenance-wrapped per §S8."
};

const FIELD_DESCRIPTIONS = {
  engagementMeta: { engagementId:"UUID", schemaVersion:"Locked '3.0'", isDemo:"true if engagement is the v3-native demo", ownerId:"User identifier (defaults 'local-user')", presalesOwner:"Owning presales engineer", engagementDate:"ISO date or null", status:"Draft|In review|Locked", createdAt:"ISO datetime", updatedAt:"ISO datetime" },
  customer:       { engagementId:"FK to engagement.meta.engagementId", name:"Customer name (≥1 char)", vertical:"FK to CUSTOMER_VERTICALS catalog", region:"Geographic region", notes:"Free-text notes" },
  driver:         { id:"UUID", engagementId:"FK", createdAt:"ISO", updatedAt:"ISO", businessDriverId:"FK to BUSINESS_DRIVERS catalog (e.g. 'cyber_resilience')", catalogVersion:"Pinned catalog version", priority:"High|Medium|Low", outcomes:"Free-text bullets capturing presales-discussion outcomes" },
  environment:    { id:"UUID", engagementId:"FK", createdAt:"ISO", updatedAt:"ISO", envCatalogId:"FK to ENV_CATALOG (e.g. 'coreDc')", catalogVersion:"Pinned", hidden:"Soft-delete flag", alias:"Human-friendly name (e.g. 'Riyadh DC')", location:"Geographic location", sizeKw:"Power footprint kW", sqm:"Floor space m²", tier:"Resilience tier", notes:"Free-text" },
  instance:       { id:"UUID", engagementId:"FK", createdAt:"ISO", updatedAt:"ISO", state:"current|desired", layerId:"FK to LAYERS (workload|compute|storage|dataProtection|virtualization|infrastructure)", environmentId:"FK to environment", label:"Display label", vendor:"Vendor name", vendorGroup:"dell|nonDell|custom", criticality:"High|Medium|Low", notes:"Free-text", disposition:"FK to DISPOSITION_ACTIONS (keep|enhance|replace|consolidate|retire|introduce)", originId:"DESIRED-only: FK to current instance this replaces", priority:"DESIRED-only: Now|Next|Later", mappedAssetIds:"WORKLOAD-only: array of FK to instances (cross-cutting; assets MAY span environments)", aiSuggestedDellMapping:"Provenance-wrapped Dell-mapping suggestion (§S8)" },
  gap:            { id:"UUID", engagementId:"FK", createdAt:"ISO", updatedAt:"ISO", description:"Free-text gap statement", gapType:"FK to GAP_TYPES (enhance|replace|introduce|consolidate|ops)", urgency:"High|Medium|Low", urgencyOverride:"true if user manually pinned urgency (overrides propagation)", phase:"now|next|later", status:"open|in_progress|closed|deferred", reviewed:"true if presales has reviewed an auto-drafted gap", notes:"Free-text", driverId:"Optional FK to driver (the 'why' of this gap)", layerId:"Primary layer (FK to LAYERS)", affectedLayers:"Array; affectedLayers[0] === layerId (G6 invariant)", affectedEnvironments:"Array of FK to environments (cross-cutting; ≥1)", relatedCurrentInstanceIds:"Array of FK to current instances", relatedDesiredInstanceIds:"Array of FK to desired instances", services:"Array of FK to SERVICE_TYPES catalog", aiMappedDellSolutions:"Provenance-wrapped Dell-solutions list (§S8)" }
};

const RELATIONSHIP_DESCRIPTIONS = {
  // Driver
  "driver.businessDriverId":           "Driver references a CxO-priority entry in the BUSINESS_DRIVERS catalog. The catalog entry's `label` (e.g. 'Cyber Resilience') is what the user sees; the id is the FK.",
  // Environment
  "environment.envCatalogId":          "Environment references an ENV_CATALOG entry (e.g. 'coreDc' → 'Riyadh DC'). The catalog entry's `label` is what the user sees.",
  // Instance
  "instance.layerId":                  "Instance lives at one of the 6 architectural layers. layerId is a string FK to LAYERS catalog.",
  "instance.environmentId":            "Instance lives in exactly one environment. FK to environments collection.",
  "instance.disposition":              "Disposition action verb (keep|enhance|replace|consolidate|retire|introduce). FK to DISPOSITION_ACTIONS catalog.",
  "instance.originId":                 "DESIRED-state-only: links a desired instance back to the current instance it replaces. Replace-lifecycle anchor. FK to instances (state='current').",
  "instance.mappedAssetIds[]":         "WORKLOAD-layer-only: a workload's underlying compute/storage/dataProtection assets. CROSS-CUTTING per S3.7: assets MAY live in a different environment than the workload.",
  // Gap
  "gap.gapType":                       "Gap action verb (enhance|replace|introduce|consolidate|ops). FK to GAP_TYPES catalog.",
  "gap.driverId":                      "Optional: which strategic driver rationalizes this gap. FK to drivers collection.",
  "gap.layerId":                       "Primary layer the gap affects. FK to LAYERS.",
  "gap.affectedLayers[]":              "All layers the gap touches. Array. INVARIANT G6: affectedLayers[0] === layerId.",
  "gap.affectedEnvironments[]":        "All environments the gap touches. CROSS-CUTTING (multi-env gaps counted once globally, not per-env). Array of FK to environments.",
  "gap.relatedCurrentInstanceIds[]":   "Current-state instances anchoring the gap. Array of FK to instances (state='current').",
  "gap.relatedDesiredInstanceIds[]":   "Desired-state instances the gap proposes/depends on. Array of FK to instances (state='desired').",
  "gap.services[]":                    "Dell services scoped to address the gap. Array of FK to SERVICE_TYPES catalog.",
  // Customer
  "customer.vertical":                 "Customer industry/segment. FK to CUSTOMER_VERTICALS catalog (e.g. 'Healthcare', 'Financial Services')."
};

const INVARIANTS = [
  { id: "G6",  description: "gap.affectedLayers[0] === gap.layerId. The first entry in affectedLayers IS the primary layer; any others are spillover layers." },
  { id: "I9",  description: "instance.mappedAssetIds non-empty ONLY on layerId='workload'. Compute/storage/dataProtection/virtualization/infrastructure instances cannot have asset mappings." },
  { id: "I-state-originId", description: "instance.originId only on state='desired'. A current instance cannot have originId." },
  { id: "I-state-priority", description: "instance.priority only on state='desired'. Currents have null priority." },
  { id: "I-no-self-origin", description: "instance.originId must not point at the instance itself (no self-reference)." },
  { id: "AL7", description: "Ops-typed gaps require at least one of {links (related instances), notes, mappedDellSolutions} — no empty placeholder gaps." },
  { id: "FK-byId-allIds-parity", description: "For every Collection<T>: byId keys must equal allIds set (no orphans, no dangling)." },
  { id: "schemaVersion-locked", description: "engagement.meta.schemaVersion is the literal '3.0' (z.literal). Older versions go through the migrator on load; the in-memory engagement is always v3.0." }
];

const CATALOG_DESCRIPTIONS = {
  BUSINESS_DRIVERS:       "CxO-priority strategic drivers. Used as the 'why' on every gap (gap.driverId). 8 entries spanning AI/Data, Cyber Resilience, Cost Optimization, Cloud Strategy, Modernize Infrastructure, Operational Simplicity, Compliance/Sovereignty, Sustainability/ESG.",
  ENV_CATALOG:            "Environment archetypes. 4 entries: coreDc (primary on-prem), drDc (DR site), edge (branch/edge), publicCloud.",
  LAYERS:                 "6 architectural layers (workload, compute, storage, dataProtection, virtualization, infrastructure). Workload is the apex; the others are the assets a workload depends on.",
  GAP_TYPES:              "5 gap action types (enhance, replace, introduce, consolidate, ops).",
  DISPOSITION_ACTIONS:    "6 disposition verbs an instance can carry (keep, enhance, replace, consolidate, retire, introduce).",
  SERVICE_TYPES:          "Dell services that can scope a gap (assessment, design, migration, operate, etc).",
  CUSTOMER_VERTICALS:     "Industry / segment classifications for the customer.",
  DELL_PRODUCT_TAXONOMY:  "Curated Dell product list with positioning corrections per SPEC §S6.2.1 (no Boomi/Taegis/VxRail/SmartFabric Director). Every aiSuggestedDellMapping / aiMappedDellSolutions value references entries here."
};

// ─── Schema introspection helpers ─────────────────────────────────────

function unwrapZod(s) {
  // ZodEffects (.superRefine) wraps the underlying ZodObject in _def.schema.
  let cur = s;
  while (cur && cur._def && cur._def.schema) cur = cur._def.schema;
  return cur;
}

function shapeOf(s) {
  const u = unwrapZod(s);
  if (u && u._def && typeof u._def.shape === "function") return u._def.shape();
  if (u && u._def && u._def.shape) return u._def.shape;
  return {};
}

function zodTypeOf(field) {
  if (!field || !field._def) return "unknown";
  const tn = field._def.typeName || "";
  // Unwrap optional/nullable/default
  if (tn === "ZodOptional" || tn === "ZodNullable" || tn === "ZodDefault") {
    return zodTypeOf(field._def.innerType);
  }
  switch (tn) {
    case "ZodString":   return "string";
    case "ZodNumber":   return "number";
    case "ZodBoolean":  return "boolean";
    case "ZodEnum":     return "enum";
    case "ZodLiteral":  return "literal";
    case "ZodArray":    return "array";
    case "ZodObject":   return "object";
    case "ZodRecord":   return "record";
    case "ZodUnknown":  return "unknown";
    case "ZodNullable": return "nullable";
    default:            return tn || "unknown";
  }
}

function zodEnumValues(field) {
  if (!field || !field._def) return null;
  if (field._def.typeName === "ZodOptional" || field._def.typeName === "ZodNullable" || field._def.typeName === "ZodDefault") {
    return zodEnumValues(field._def.innerType);
  }
  if (field._def.typeName === "ZodEnum") return field._def.values || null;
  return null;
}

function fieldRequired(field) {
  if (!field || !field._def) return true;
  const tn = field._def.typeName;
  if (tn === "ZodOptional" || tn === "ZodDefault") return false;
  return true;
}

function deriveFields(schema, kindKey) {
  const shape = shapeOf(schema);
  const fields = [];
  const descs = FIELD_DESCRIPTIONS[kindKey] || {};
  for (const name of Object.keys(shape)) {
    const f = shape[name];
    const entry = { name, type: zodTypeOf(f), required: fieldRequired(f), description: descs[name] || "" };
    const enumValues = zodEnumValues(f);
    if (enumValues) entry.values = enumValues;
    fields.push(entry);
  }
  return fields;
}

function relationshipsFromFkDeclarations() {
  const relsByEntity = {
    customer:    customerFkDeclarations,
    driver:      driverFkDeclarations,
    environment: environmentFkDeclarations,
    instance:    instanceFkDeclarations,
    gap:         gapFkDeclarations
  };
  const out = [];
  for (const kind of Object.keys(relsByEntity)) {
    for (const fk of relsByEntity[kind]) {
      const fromKey = kind + "." + fk.field + (fk.isArray ? "[]" : "");
      out.push({
        from:        fromKey,
        to:          fk.target,
        cardinality: (fk.required ? "1" : "0") + ".." + (fk.isArray ? "n" : "1"),
        constraint:  fk.targetFilter ? JSON.stringify(fk.targetFilter) : "",
        description: RELATIONSHIP_DESCRIPTIONS[fromKey] || ""
      });
    }
  }
  // Cross-cutting non-FK relationships (originId, mappedAssetIds) — derive
  // from the schema invariants list (instance.js superRefine).
  out.push({
    from:        "instance.originId",
    to:          "instances.id (state='current')",
    cardinality: "0..1",
    constraint:  "ONLY on state='desired'; no self-reference",
    description: RELATIONSHIP_DESCRIPTIONS["instance.originId"] || ""
  });
  out.push({
    from:        "instance.mappedAssetIds[]",
    to:          "instances.id",
    cardinality: "0..n",
    constraint:  "ONLY on layerId='workload'; assets MAY span environments (cross-cutting per S3.7)",
    description: RELATIONSHIP_DESCRIPTIONS["instance.mappedAssetIds[]"] || ""
  });
  return out;
}

// ─── FNV-1a checksum ──────────────────────────────────────────────────

function fnv1a8(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function serializeForChecksum(c) {
  // Exclude volatile fields from the checksum so it's deterministic
  // across module loads when content hasn't changed.
  const { checksum: _ck, generatedAt: _ga, ...rest } = c;
  return JSON.stringify(rest);
}

// ─── Module-load self-validation ──────────────────────────────────────

function validateContract(c) {
  // Every catalog has at least one entry; entry ids unique.
  for (const cat of c.catalogs) {
    if (!Array.isArray(cat.entries) || cat.entries.length === 0) {
      throw new Error("dataContract: catalog '" + cat.id + "' has zero entries");
    }
    const ids = cat.entries.map(e => e.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error("dataContract: catalog '" + cat.id + "' has duplicate entry ids");
    }
  }
  // Every relationship's `from` references a declared entity kind.
  const declaredKinds = new Set(c.entities.map(e => e.kind));
  for (const rel of c.relationships) {
    const fromKind = (rel.from || "").split(".")[0];
    if (!declaredKinds.has(fromKind)) {
      throw new Error("dataContract: relationship.from '" + rel.from +
        "' references undeclared entity kind '" + fromKind + "'");
    }
  }
  // Every invariant id is unique.
  const invIds = c.invariants.map(i => i.id);
  if (new Set(invIds).size !== invIds.length) {
    throw new Error("dataContract: invariant ids are not unique");
  }
}

// ─── Build the contract (top-level await for catalogs) ───────────────

const _catalogs = await loadAllCatalogs();

function buildContract() {
  const entities = [
    { kind: "engagementMeta", description: ENTITY_DESCRIPTIONS.engagementMeta, fields: deriveFields(EngagementMetaSchema, "engagementMeta") },
    { kind: "customer",       description: ENTITY_DESCRIPTIONS.customer,       fields: deriveFields(CustomerSchema,       "customer")       },
    { kind: "driver",         description: ENTITY_DESCRIPTIONS.driver,         fields: deriveFields(DriverSchema,         "driver")         },
    { kind: "environment",    description: ENTITY_DESCRIPTIONS.environment,    fields: deriveFields(EnvironmentSchema,    "environment")    },
    { kind: "instance",       description: ENTITY_DESCRIPTIONS.instance,       fields: deriveFields(InstanceSchema,       "instance")       },
    { kind: "gap",            description: ENTITY_DESCRIPTIONS.gap,            fields: deriveFields(GapSchema,            "gap")            }
  ];

  const relationships = relationshipsFromFkDeclarations();

  const catalogs = Object.entries(_catalogs).map(([id, cat]) => ({
    id,
    version:     cat.catalogVersion || "unknown",
    description: CATALOG_DESCRIPTIONS[id] || "",
    entries:     (cat.entries || []).map(e => ({
      id:          e.id,
      label:       e.label || e.name || e.id,
      description: e.description || e.shortHint || ""
    }))
  }));

  // analyticalViews surface ONLY the §S5 selectors (one per selector).
  // Definitional-grounding tools like selectConcept (per SPEC §S27) are
  // wired into CHAT_TOOLS too but are not analytical views — they fetch
  // dictionary content, not engagement data.
  const _SELECTOR_NAMES = new Set([
    "selectMatrixView", "selectGapsKanban", "selectVendorMix",
    "selectHealthSummary", "selectExecutiveSummaryInputs",
    "selectLinkedComposition", "selectProjects"
  ]);
  const analyticalViews = CHAT_TOOLS.filter(t => _SELECTOR_NAMES.has(t.name)).map(t => ({
    name:        t.name,
    description: t.description,
    inputSchema: t.input_schema || { type: "object", properties: {} },
    outputShape: ""
  }));

  const contract = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    checksum:      "",                                    // filled below
    generatedAt:   "2026-05-02T00:00:00.000Z",            // deterministic; not Date.now()
    entities,
    relationships,
    invariants:    INVARIANTS,
    catalogs,
    bindablePaths: generateManifest(),
    analyticalViews
  };

  // Self-validate (throws on drift — module load fails loudly per R25.4).
  validateContract(contract);

  // Compute checksum LAST (over content excluding the checksum + generatedAt).
  contract.checksum = fnv1a8(serializeForChecksum(contract));

  return contract;
}

const _CONTRACT = buildContract();

// ─── Public API ──────────────────────────────────────────────────────

export function getDataContract()    { return _CONTRACT; }
export function getContractChecksum() { return _CONTRACT.checksum; }
