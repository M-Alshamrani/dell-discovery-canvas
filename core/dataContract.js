// core/dataContract.js
//
// ─────────────────────────────────────────────────────────────────────
//  ACTIVE CONSTITUTION · SPEC §S25 · THE source of truth for v3 data
// ─────────────────────────────────────────────────────────────────────
//
// This is the LIVE constitution. Every code path that reads, writes,
// or surfaces engagement data MUST route through this file (via the
// exports getDataContract / getStandardMutableDataPoints /
// getAllMutableDataPoints / getInsightsDataPoints /
// getLabelResolvedPaths) or its derived consumers
// (services/labelResolvers.js, state/adapter.js, state/engagementStore.js).
//
// Direct `engagement.<collection>.byId` access outside state/adapter.js
// is a discipline violation (R12 contract-fidelity).
//
// Promoted to active 2026-05-11 from `core/dataContract.next.js` after
// the docs/UI_DATA_TRACE.md (r6) audit surfaced that the original 26-
// path STANDARD_MUTABLE_PATHS was incomplete (no catalog-resolved label
// paths, no derived Insights category). The original pre-rebuild
// contract is preserved at `core/dataContract.reference.js` (REFERENCE
// ONLY, not imported anywhere).
//
// Authority cascade (when accepted):
//   SPEC §S25 amendment → RULES §16 R12 (contract-fidelity) →
//   TESTS V-CONTRACT-* + V-FLOW-CONTRACT-FIDELITY-* + V-FLOW-INSIGHTS-* →
//   core/dataContract.js (replaces existing) →
//   _buildSkillRunCtx (consumes the new exports) →
//   Two-pane Skill Builder picker (consumes Standard / Insights / Advanced)
//
// What this rebuild changes (vs. the original):
//   1. STANDARD_MUTABLE_PATHS expanded from 26 to 34 paths, with the
//      author-meaningful set re-cut against the UI_DATA_TRACE.md audit.
//      Adds catalog-resolved label paths the schema doesn't carry but
//      every UI surface uses (driver.name, gap.driverName, etc.).
//
//   2. NEW: INSIGHTS_PATHS catalog (~15 derived/computed paths
//      sourced from §S5 selectors). These are the values Tab 5
//      Reporting actually shows (coverage %, risk level, totals,
//      project pipeline, vendor mix), made bindable for skills.
//
//   3. NEW: LABEL_RESOLVED_PATHS map declaring which paths require
//      catalog-join at runtime (so _buildSkillRunCtx knows to route
//      them through services/labelResolvers.js).
//
//   4. _NON_MUTABLE_FIELD_NAMES tightened with audit-confirmed
//      exclusions: `id`, `catalogVersion` added (truly never author-
//      meaningful). Audit/provenance fields stay excluded as before.
//
//   5. NEW: getInsightsDataPoints() + getLabelResolvedPaths() exports
//      consumed by the picker right pane (structure + relationships +
//      sample data display).
//
// What this rebuild DOES NOT change (constitutional invariants):
//   · No schema fields added or removed (schema/*.js unchanged)
//   · No catalog entries added or removed (catalogs/snapshots/* unchanged)
//   · No relationships added or removed (FK declarations unchanged)
//   · No invariants added or removed
//   · No analytical-view selectors added or removed
//   · ENTITY_DESCRIPTIONS / FIELD_DESCRIPTIONS / RELATIONSHIP_DESCRIPTIONS
//     prose preserved verbatim (these are content, not contract shape)
//
// Reference: docs/UI_DATA_TRACE.md (r6, hash 4fb8b31d) — the per-tab
// per-element audit that locks every Standard / Insights entry to a
// real surface the user authors or reads on the canvas today.
//
// ─── Constitutional anchor ───────────────────────────────────────────
//
// SPEC §S25 (still): "The data contract is THE single artifact that
// grounds every LLM turn. It's derived (never hand-maintained) from
// schemas + manifest + catalogs at module load, validates itself on
// import, carries a deterministic checksum, and gets serialized into
// the chat system prompt as the authoritative reference."
//
// R12 (PROPOSED for PRINCIPAL_ARCHITECT_DISCIPLINE.md): "Every code
// path that reads, writes, or surfaces engagement data MUST route
// through core/dataContract.js (or its derived accessors
// getDataContract / getStandardMutableDataPoints /
// getAllMutableDataPoints / getInsightsDataPoints /
// services/labelResolvers.js / state/adapter.js). Direct
// engagement.<collection>.byId access outside state/adapter.js is a
// P0 violation. Any change to this file requires an explicit SPEC
// §S25 amendment commit titled [CONSTITUTIONAL AMENDMENT]."
//
// ─────────────────────────────────────────────────────────────────────

import { CustomerSchema, customerFkDeclarations }                from "../schema/customer.js";
import { DriverSchema, driverFkDeclarations }                    from "../schema/driver.js";
import { EnvironmentSchema, environmentFkDeclarations }          from "../schema/environment.js";
import { InstanceSchema, instanceFkDeclarations }                from "../schema/instance.js";
import { GapSchema, gapFkDeclarations }                          from "../schema/gap.js";
import { EngagementMetaSchema, CURRENT_SCHEMA_VERSION }          from "../schema/engagement.js";
import { generateManifest }                                       from "../services/manifestGenerator.js";
import { loadAllCatalogs }                                        from "../services/catalogLoader.js";
import { CHAT_TOOLS }                                             from "../services/chatTools.js";

// ─── Hand-authored prose (unchanged from original) ────────────────────
// Preserved verbatim; semantics not amended in this rebuild.

const ENTITY_DESCRIPTIONS = {
  engagementMeta: "Workshop-level metadata. One per engagement.",
  customer:       "Single customer record per engagement.",
  driver:         "Strategic / business driver the engagement addresses. Collection. Each driver references a BUSINESS_DRIVERS catalog entry + carries presales-captured priority + outcomes free-text.",
  environment:    "Physical or logical environment (data center, edge site, cloud region). Collection.",
  instance:       "A single asset OR workload at a (state, layer, environment) cell. state is 'current' (today's reality) or 'desired' (future-state plan).",
  gap:            "A discrete improvement opportunity derived from current↔desired delta + business drivers."
};

const FIELD_DESCRIPTIONS = {
  engagementMeta: { engagementId:"UUID", schemaVersion:"Locked '3.0'", isDemo:"true if engagement is the v3-native demo", ownerId:"User identifier (defaults 'local-user')", presalesOwner:"Owning presales engineer", engagementDate:"ISO date or null", status:"Draft|In review|Locked", createdAt:"ISO datetime", updatedAt:"ISO datetime" },
  customer:       { engagementId:"FK to engagement.meta.engagementId", name:"Customer name (≥1 char)", vertical:"FK to CUSTOMER_VERTICALS catalog", region:"Geographic region", notes:"Free-text notes" },
  driver:         { id:"UUID", engagementId:"FK", createdAt:"ISO", updatedAt:"ISO", businessDriverId:"FK to BUSINESS_DRIVERS catalog", catalogVersion:"Pinned catalog version", priority:"High|Medium|Low — criticality LEVEL of this driver to the customer (NOT a rank). Multiple drivers may all be High.", outcomes:"Free-text bullets capturing presales-discussion outcomes (the driver's comment/discussion field)" },
  environment:    { id:"UUID", engagementId:"FK", createdAt:"ISO", updatedAt:"ISO", envCatalogId:"FK to ENV_CATALOG", catalogVersion:"Pinned", hidden:"Soft-delete flag", alias:"Human-friendly name", location:"Geographic location", sizeKw:"Power footprint kW", sqm:"Floor space m²", tier:"Resilience tier", notes:"Free-text" },
  instance:       { id:"UUID", engagementId:"FK", createdAt:"ISO", updatedAt:"ISO", state:"current|desired", layerId:"FK to LAYERS", environmentId:"FK to environment", label:"Display label", vendor:"Vendor name", vendorGroup:"dell|nonDell|custom", criticality:"High|Medium|Low — criticality LEVEL of this asset/workload (NOT a rank)", notes:"Free-text", disposition:"FK to DISPOSITION_ACTIONS", originId:"DESIRED-only: FK to current instance this replaces", priority:"DESIRED-only: Now|Next|Later — phase-of-life, NOT criticality", mappedAssetIds:"WORKLOAD-only: array of FK to instances", aiSuggestedDellMapping:"Provenance-wrapped Dell-mapping suggestion (§S8)", aiTag:"AI-mutation provenance stamp; cleared on next engineer save" },
  gap:            { id:"UUID", engagementId:"FK", createdAt:"ISO", updatedAt:"ISO", description:"Free-text gap statement", gapType:"FK to GAP_TYPES (enhance|replace|introduce|consolidate|ops)", urgency:"High|Medium|Low — urgency LEVEL (derived from linked current's criticality unless override)", urgencyOverride:"true if user manually pinned urgency", phase:"now|next|later — phase-of-life", status:"open|in_progress|closed|deferred", reviewed:"true if presales has reviewed an auto-drafted gap", origin:"manual|autoDraft (provenance flag)", notes:"Free-text", driverId:"Optional FK to driver (the 'why' of this gap)", layerId:"Primary layer (FK to LAYERS)", affectedLayers:"Array; affectedLayers[0] === layerId (G6 invariant)", affectedEnvironments:"Array of FK to environments (cross-cutting; ≥1)", relatedCurrentInstanceIds:"Array of FK to current instances", relatedDesiredInstanceIds:"Array of FK to desired instances", services:"Array of FK to SERVICE_TYPES catalog", aiMappedDellSolutions:"Provenance-wrapped Dell-solutions list (§S8) — superseded at display time by derived effectiveDellSolutions" }
};

const RELATIONSHIP_DESCRIPTIONS = {
  "driver.businessDriverId":           "Driver references a CxO-priority entry in BUSINESS_DRIVERS. The catalog entry's `label` is what the user sees; the id is the FK.",
  "environment.envCatalogId":          "Environment references an ENV_CATALOG entry. The catalog entry's `label` is what the user sees.",
  "instance.layerId":                  "Instance lives at one of the 6 architectural layers. layerId is a string FK to LAYERS catalog.",
  "instance.environmentId":            "Instance lives in exactly one environment. FK to environments collection.",
  "instance.disposition":              "Disposition action verb (keep|enhance|replace|consolidate|retire|introduce). FK to DISPOSITION_ACTIONS catalog.",
  "instance.originId":                 "DESIRED-state-only: links a desired instance back to the current instance it replaces. FK to instances (state='current').",
  "instance.mappedAssetIds[]":         "WORKLOAD-layer-only: a workload's underlying compute/storage/dataProtection assets. CROSS-CUTTING.",
  "gap.gapType":                       "Gap action verb. FK to GAP_TYPES catalog.",
  "gap.driverId":                      "Optional: which strategic driver rationalizes this gap. FK to drivers collection.",
  "gap.layerId":                       "Primary layer the gap affects. FK to LAYERS.",
  "gap.affectedLayers[]":              "All layers the gap touches. Array. INVARIANT G6: affectedLayers[0] === layerId.",
  "gap.affectedEnvironments[]":        "All environments the gap touches. CROSS-CUTTING. Array of FK to environments.",
  "gap.relatedCurrentInstanceIds[]":   "Current-state instances anchoring the gap. Array of FK to instances (state='current').",
  "gap.relatedDesiredInstanceIds[]":   "Desired-state instances the gap proposes/depends on. Array of FK to instances (state='desired').",
  "gap.services[]":                    "Dell services scoped to address the gap. Array of FK to SERVICE_TYPES catalog.",
  "customer.vertical":                 "Customer industry/segment. FK to CUSTOMER_VERTICALS catalog."
};

const INVARIANTS = [
  { id: "G6",  description: "gap.affectedLayers[0] === gap.layerId." },
  { id: "I9",  description: "instance.mappedAssetIds non-empty ONLY on layerId='workload'." },
  { id: "I-state-originId", description: "instance.originId only on state='desired'." },
  { id: "I-state-priority", description: "instance.priority only on state='desired'." },
  { id: "I-no-self-origin", description: "instance.originId must not point at the instance itself." },
  { id: "AL7", description: "Ops-typed gaps require at least one of {links, notes, mappedDellSolutions}." },
  { id: "FK-byId-allIds-parity", description: "For every Collection<T>: byId keys must equal allIds set." },
  { id: "schemaVersion-locked", description: "engagement.meta.schemaVersion is the literal '3.0'." }
];

const CATALOG_DESCRIPTIONS = {
  BUSINESS_DRIVERS:       "CxO-priority strategic drivers. Used as the 'why' on every gap (gap.driverId). 8 entries.",
  ENV_CATALOG:            "Environment archetypes. 8 entries.",
  LAYERS:                 "6 architectural layers.",
  GAP_TYPES:              "5 gap action types.",
  DISPOSITION_ACTIONS:    "7 disposition verbs an instance can carry.",
  SERVICE_TYPES:          "Dell services that can scope a gap.",
  CUSTOMER_VERTICALS:     "Industry / segment classifications for the customer.",
  DELL_PRODUCT_TAXONOMY:  "Curated Dell product list per SPEC §S6.2.1."
};

// ─── NEW: Label-resolved path declarations ────────────────────────────
//
// Paths that the schema doesn't carry as direct fields but every UI
// surface displays as the catalog-joined label. _buildSkillRunCtx
// (after the contract-fidelity arc lands) MUST route these through
// services/labelResolvers.js so a skill bound to "driver.name" sees
// "Cyber Resilience" not "cyber_resilience".
//
// Shape: { path → { entity, joinPath, joinCatalog, joinField, scope } }
//   joinPath:    the raw FK field on the record
//   joinCatalog: the catalog the FK references
//   joinField:   the catalog field to render ("label" usually)
//   scope:       "standard" or "advanced" (drives picker categorization)

export const LABEL_RESOLVED_PATHS = Object.freeze({
  "customer.verticalLabel": {
    entity: "customer", joinPath: "vertical",
    joinCatalog: "CUSTOMER_VERTICALS", joinField: "label", scope: "standard"
  },
  "driver.name": {
    entity: "driver", joinPath: "businessDriverId",
    joinCatalog: "BUSINESS_DRIVERS", joinField: "label", scope: "standard"
  },
  "driver.hint": {
    entity: "driver", joinPath: "businessDriverId",
    joinCatalog: "BUSINESS_DRIVERS", joinField: "hint", scope: "advanced"
  },
  "environment.name": {
    entity: "environment", joinPath: "envCatalogId",
    joinCatalog: "ENV_CATALOG", joinField: "label",
    fallbackField: "alias", scope: "standard"
  },
  "environment.kindLabel": {
    entity: "environment", joinPath: "envCatalogId",
    joinCatalog: "ENV_CATALOG", joinField: "label", scope: "advanced"
  },
  "instance.layerLabel": {
    entity: "instance", joinPath: "layerId",
    joinCatalog: "LAYERS", joinField: "label", scope: "standard"
  },
  "instance.environmentName": {
    entity: "instance", joinPath: "environmentId",
    joinCatalog: "environments", joinField: "alias", scope: "standard"
    // NOTE: joinCatalog="environments" signals cross-entity join to the
    // engagement's environments collection, not a static catalog. The
    // resolver computes env.alias || ENV_CATALOG.byId[env.envCatalogId].label.
  },
  "instance.dispositionLabel": {
    entity: "instance", joinPath: "disposition",
    joinCatalog: "DISPOSITION_ACTIONS", joinField: "label", scope: "standard"
  },
  "gap.gapTypeLabel": {
    entity: "gap", joinPath: "gapType",
    joinCatalog: "GAP_TYPES", joinField: "label", scope: "standard"
  },
  "gap.layerLabel": {
    entity: "gap", joinPath: "layerId",
    joinCatalog: "LAYERS", joinField: "label", scope: "standard"
  },
  "gap.driverName": {
    entity: "gap", joinPath: "driverId",
    joinCatalog: "drivers", joinField: "name", scope: "standard"
    // NOTE: multi-hop. Resolves gap.driverId → engagement.drivers.byId[id].businessDriverId
    //                 → BUSINESS_DRIVERS.byId[bid].label.
  },
  "gap.affectedLayerLabels": {
    entity: "gap", joinPath: "affectedLayers",
    joinCatalog: "LAYERS", joinField: "label", scope: "standard",
    isArray: true
  },
  "gap.affectedEnvironmentNames": {
    entity: "gap", joinPath: "affectedEnvironments",
    joinCatalog: "environments", joinField: "alias", scope: "standard",
    isArray: true
  },
  "gap.servicesLabels": {
    entity: "gap", joinPath: "services",
    joinCatalog: "SERVICE_TYPES", joinField: "label", scope: "standard",
    isArray: true
  }
});

// ─── REBUILT: STANDARD_MUTABLE_PATHS (34 paths) ───────────────────────
//
// Each entry below is locked to a real authored or displayed surface
// on the canvas — see docs/UI_DATA_TRACE.md r6 (hash 4fb8b31d) §1–§5
// for the per-element trace. No "promised but unwired" paths. No
// hallucination potential like the original's missing driver.name.
//
// Categorization decisions:
// · Customer-meaningful authored content → Standard
// · Catalog-resolved labels for the FK fields the UI actually displays → Standard
// · Driver-, env-, gap-level "notes" / "outcomes" free-text → Standard
// · Raw FK ids → Advanced (rare; kept for skills that need ids)
// · UUIDs, audit timestamps, provenance metadata, catalog versions → excluded
//
// Status legend (UI_DATA_TRACE WB-* reference):
//   *  WB-1 — engagementMeta.presalesOwner: UI input exists, writes
//             IGNORED today; C10 hygiene wires the commit.
//   *  WB-2 — customer.notes: schema field exists, NO UI input today;
//             C10 hygiene adds the textarea.

export const STANDARD_MUTABLE_PATHS = Object.freeze([
  // ─── Customer (singleton, 4 paths) ───
  "customer.name",                   // Tab 1 §2 input
  "customer.vertical",               // Tab 1 §2 dropdown (FK id form)
  "customer.verticalLabel",          // LABEL_RESOLVED; renders "Healthcare" not "healthcare"
  "customer.region",                 // Tab 1 §2 input
  // customer.notes — WB-2 (Standard once C10 lands; schema field exists, UI input pending)

  // ─── EngagementMeta (singleton, 1 path) ───
  // engagementMeta.presalesOwner — WB-1 (Standard once C10 lands; UI input dead today)

  // ─── Driver (collection, 3 paths) ───
  "driver.name",                     // LABEL_RESOLVED from BUSINESS_DRIVERS — the customer-facing driver name
  "driver.priority",                 // Tab 1 §4 dropdown — High/Medium/Low criticality LEVEL (NOT a rank)
  "driver.outcomes",                 // Tab 1 §4 textarea — the per-driver discussion/comment field

  // ─── Environment (collection, 6 paths) ───
  "environment.name",                // alias || catalog label fallback
  "environment.location",            // Tab 1 §6 input
  "environment.tier",                // Tab 1 §6 datalist
  "environment.sizeKw",              // Tab 1 §6 number input
  "environment.sqm",                 // Tab 1 §6 number input
  "environment.notes",               // Tab 1 §6 input (was misclassified as dead-end in earlier audit pass)

  // ─── Instance (collection — current + desired, 9 paths) ───
  "instance.label",                  // Tab 2/3 §5/§7 from + Add palette
  "instance.vendor",                 // Tab 2/3 §6/§11 palette / vendor chooser
  "instance.vendorGroup",            // Tab 2/3 — dell/nonDell/custom (drives vendor-mix narration)
  "instance.layerLabel",             // LABEL_RESOLVED from LAYERS
  "instance.environmentName",        // LABEL_RESOLVED from environments collection
  "instance.criticality",            // Tab 2 §7 dropdown — criticality LEVEL (NOT a rank)
  "instance.dispositionLabel",       // LABEL_RESOLVED — DESIRED-only; renders "Replace" not "replace"
  "instance.priority",               // Tab 3 §9 — Now/Next/Later phase-of-life (NOT criticality)
  "instance.notes",                  // Tab 2/3 §7/§9 textarea

  // ─── Gap (collection, 11 paths) ───
  "gap.description",                 // Tab 4 §8e textarea + §10 add dialog
  "gap.urgency",                     // Tab 4 §8e override-aware urgency group
  "gap.phase",                       // Tab 4 §6 drag-drop + §8e dropdown
  "gap.status",                      // Tab 4 §8e dropdown — open/in_progress/closed/deferred
  "gap.gapTypeLabel",                // LABEL_RESOLVED from GAP_TYPES
  "gap.layerLabel",                  // LABEL_RESOLVED from LAYERS
  "gap.driverName",                  // LABEL_RESOLVED multi-hop (gap.driverId → driver.businessDriverId → BUSINESS_DRIVERS.label)
  "gap.notes",                       // Tab 4 §8e textarea
  "gap.affectedEnvironmentNames",    // LABEL_RESOLVED array
  "gap.affectedLayerLabels",         // LABEL_RESOLVED array
  "gap.servicesLabels"               // LABEL_RESOLVED array from SERVICE_TYPES
]);

// ─── NEW: INSIGHTS_PATHS (15 derived paths) ───────────────────────────
//
// Derived/computed values surfaced on Tab 5 Reporting. These are NOT
// schema fields; they come from §S5 selectors (already in
// dataContract.analyticalViews) and Tab 5's renderXxx functions
// (already wired). Exposing them as bindable paths lets a skill
// author write "Give me an account plan" and reference
// {{insights.coverage.percent}} or {{insights.totals.highUrgencyGaps}}
// without re-implementing the math.

export const INSIGHTS_PATHS = Object.freeze({
  // ─── Coverage / Risk (from roadmapService) ───
  "insights.coverage.percent": {
    type: "number", source: "roadmapService.computeDiscoveryCoverage",
    description: "Discovery completeness percentage (0-100). UI: Tab 5 Overview §5.A.4 big number + bar fill."
  },
  "insights.coverage.actions": {
    type: "array<string>", source: "roadmapService.computeDiscoveryCoverage",
    description: "List of suggested next-to-fill fields. UI: Tab 5 Overview §5.A.4 hint list."
  },
  "insights.risk.level": {
    type: "enum<High|Medium|Low>", source: "roadmapService.computeRiskPosture",
    description: "Overall risk posture for the engagement. UI: Tab 5 Overview §5.A.4 pill."
  },
  "insights.risk.actions": {
    type: "array<string>", source: "roadmapService.computeRiskPosture",
    description: "Risk mitigation actions. UI: Tab 5 Overview §5.A.4 hint list."
  },

  // ─── Totals (from healthMetrics) ───
  "insights.totals.currentInstances": {
    type: "number", source: "healthMetrics.getHealthSummary",
    description: "Count of state='current' instances. UI: Tab 5 §5.A.5 + §5.B.2."
  },
  "insights.totals.desiredInstances": {
    type: "number", source: "healthMetrics.getHealthSummary",
    description: "Count of state='desired' instances. UI: Tab 5 §5.A.5 + §5.B.2."
  },
  "insights.totals.gaps": {
    type: "number", source: "healthMetrics.getHealthSummary",
    description: "Total gaps count. UI: Tab 5 §5.A.5 + §5.B.2."
  },
  "insights.totals.highUrgencyGaps": {
    type: "number", source: "healthMetrics.getHealthSummary",
    description: "Count of gaps with urgency='High'. UI: Tab 5 §5.A.5 stat chip."
  },
  "insights.totals.unreviewedGaps": {
    type: "number", source: "gap-walk filter",
    description: "Count of gaps with reviewed=false + status='open'. UI: Tab 5 Roadmap §5.E.4 pulse bar."
  },

  // ─── Vendor mix (from vendorMixService) ───
  "insights.dellDensity.percent": {
    type: "number", source: "vendorMixService.computeMixByLayer",
    description: "Dell instance count / total instance count, expressed as %. UI: Tab 5 Vendor §5.D.4 KPI."
  },
  "insights.dellDensity.byLayer": {
    type: "object<layerId, number>", source: "vendorMixService.computeMixByLayer",
    description: "Per-layer Dell density %. UI: Tab 5 Vendor §5.D.4."
  },

  // ─── Projects (from roadmapService.buildProjects) ───
  "insights.projects.names": {
    type: "array<string>", source: "roadmapService.buildProjects",
    description: "All auto-derived project names. UI: Tab 5 Roadmap §5.E.5 cards."
  },
  "insights.projects.byPhase": {
    type: "object<phase, array<projectName>>", source: "roadmapService.buildProjects",
    description: "Projects grouped by phase (now/next/later). UI: Tab 5 Overview §5.A.7 pipeline."
  },
  "insights.projects.byDriver": {
    type: "object<driverId, array<projectName>>", source: "programsService.groupProjectsByProgram",
    description: "Projects grouped by strategic driver swimlane. UI: Tab 5 Roadmap §5.E.5."
  },

  // ─── Executive Summary brief ───
  "insights.executiveSummary.brief": {
    type: "array<{label, text}>", source: "roadmapService.generateSessionBrief",
    description: "Structured brief rows for CxO consumption. UI: Tab 5 Overview §5.A.8 right pane."
  }
});

// ─── Non-mutable field exclusion list (TIGHTENED) ─────────────────────
// Schema fields excluded from getAllMutableDataPoints() because they're
// computed / provenance / migration metadata and never user-mutable.

const _NON_MUTABLE_FIELD_NAMES = new Set([
  // Provenance wrappers (§S8) — populated by AI dispatch, not author-set.
  "aiSuggestedDellMapping",
  "aiMappedDellSolutions",
  "aiTag",

  // Audit + cross-cutting metadata.
  "engagementId",
  "createdAt",
  "updatedAt",
  "validatedAgainst",

  // Engagement-meta plumbing.
  "schemaVersion",
  "checksum",
  "generatedAt",

  // NEW exclusions per UI_DATA_TRACE audit:
  "id",                     // every record's UUID — system-set, never author-meaningful
  "catalogVersion"          // pinned catalog version — data-architecture plumbing
]);

// ─── Schema introspection helpers (unchanged from original) ───────────

function unwrapZod(s) {
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

// ─── DataPoint builder ────────────────────────────────────────────────

function _scopeNote(entity, field) {
  if (entity === "instance" && field === "disposition") return "desired-state only";
  if (entity === "instance" && field === "originId")    return "desired-state only; FK to current";
  if (entity === "instance" && field === "priority")    return "desired-state only";
  if (entity === "instance" && field === "mappedAssetIds") return "workload-layer only";
  return null;
}

function _buildDataPoint(entityKind, field) {
  var path = entityKind + "." + field.name;
  var dp = {
    path:        path,
    entity:      entityKind,
    field:       field.name,
    type:        field.type,
    required:    !!field.required,
    description: field.description || "",
    scope:       STANDARD_MUTABLE_PATHS.indexOf(path) >= 0 ? "standard" : "advanced"
  };
  if (Array.isArray(field.values)) dp.values = field.values.slice();
  var note = _scopeNote(entityKind, field.name);
  if (note) dp.note = note;
  return dp;
}

function deriveFields(schema, kindKey) {
  const shape = shapeOf(schema);
  const fields = [];
  const descs = FIELD_DESCRIPTIONS[kindKey] || {};
  for (const name of Object.keys(shape)) {
    if (_NON_MUTABLE_FIELD_NAMES.has(name)) continue;     // skip excluded fields
    const f = shape[name];
    const entry = { name, type: zodTypeOf(f), required: fieldRequired(f), description: descs[name] || "" };
    const enumValues = zodEnumValues(f);
    if (enumValues) entry.values = enumValues;
    fields.push(entry);
  }
  return fields;
}

// ─── Public API: getAllMutableDataPoints + curated getters ────────────

export function getAllMutableDataPoints() {
  const out = [];
  out.push(...deriveFields(EngagementMetaSchema, "engagementMeta").map(f => _buildDataPoint("engagementMeta", f)));
  out.push(...deriveFields(CustomerSchema,       "customer").map(f => _buildDataPoint("customer", f)));
  out.push(...deriveFields(DriverSchema,         "driver").map(f => _buildDataPoint("driver", f)));
  out.push(...deriveFields(EnvironmentSchema,    "environment").map(f => _buildDataPoint("environment", f)));
  out.push(...deriveFields(InstanceSchema,       "instance").map(f => _buildDataPoint("instance", f)));
  out.push(...deriveFields(GapSchema,            "gap").map(f => _buildDataPoint("gap", f)));

  // Append label-resolved synthetic paths.
  Object.keys(LABEL_RESOLVED_PATHS).forEach(function(path) {
    var meta = LABEL_RESOLVED_PATHS[path];
    out.push({
      path:         path,
      entity:       meta.entity,
      field:        path.split(".").pop(),
      type:         meta.isArray ? "array<string>" : "string",
      required:     false,
      description:  "Label-resolved from " + meta.joinCatalog + "." + meta.joinField,
      scope:        meta.scope,
      labelResolved: true,
      joinPath:     meta.joinPath,
      joinCatalog:  meta.joinCatalog,
      joinField:    meta.joinField
    });
  });

  return out;
}

export function getStandardMutableDataPoints() {
  var all = getAllMutableDataPoints();
  var standardSet = new Set(STANDARD_MUTABLE_PATHS);
  return all.filter(function(dp) { return standardSet.has(dp.path); });
}

// NEW exports

export function getInsightsDataPoints() {
  return Object.keys(INSIGHTS_PATHS).map(function(path) {
    var meta = INSIGHTS_PATHS[path];
    return {
      path:        path,
      entity:      "insights",
      field:       path.split(".").slice(1).join("."),
      type:        meta.type,
      required:    false,
      description: meta.description,
      scope:       "insights",
      source:      meta.source
    };
  });
}

export function getLabelResolvedPaths() {
  return Object.assign({}, LABEL_RESOLVED_PATHS);
}

// ─── Relationship + invariant + contract assembly (unchanged shape) ───

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
  out.push({ from: "instance.originId", to: "instances.id (state='current')", cardinality: "0..1", constraint: "ONLY on state='desired'; no self-reference", description: RELATIONSHIP_DESCRIPTIONS["instance.originId"] || "" });
  out.push({ from: "instance.mappedAssetIds[]", to: "instances.id", cardinality: "0..n", constraint: "ONLY on layerId='workload'", description: RELATIONSHIP_DESCRIPTIONS["instance.mappedAssetIds[]"] || "" });
  return out;
}

// FNV-1a 32-bit checksum (matches the algorithm in core/dataContract.js + docs/UI_DATA_TRACE.md hash rule).

function fnv1a8(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function serializeForChecksum(c) {
  const { checksum: _ck, generatedAt: _ga, ...rest } = c;
  return JSON.stringify(rest);
}

function validateContract(c) {
  for (const cat of c.catalogs) {
    if (!Array.isArray(cat.entries) || cat.entries.length === 0) {
      throw new Error("dataContract.next: catalog '" + cat.id + "' has zero entries");
    }
    const ids = cat.entries.map(e => e.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error("dataContract.next: catalog '" + cat.id + "' has duplicate entry ids");
    }
  }
  const declaredKinds = new Set(c.entities.map(e => e.kind));
  for (const rel of c.relationships) {
    const fromKind = (rel.from || "").split(".")[0];
    if (!declaredKinds.has(fromKind)) {
      throw new Error("dataContract.next: relationship.from '" + rel.from + "' references undeclared entity kind");
    }
  }
  const invIds = c.invariants.map(i => i.id);
  if (new Set(invIds).size !== invIds.length) {
    throw new Error("dataContract.next: invariant ids are not unique");
  }
}

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
      description: e.description || e.shortHint || e.hint || ""
    }))
  }));

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
    checksum:      "",
    generatedAt:   "2026-05-02T00:00:00.000Z",   // deterministic
    entities,
    relationships,
    invariants:    INVARIANTS,
    catalogs,
    bindablePaths: generateManifest(),
    analyticalViews,
    // NEW exports added at top-level for picker consumption:
    standardPaths:        STANDARD_MUTABLE_PATHS,
    labelResolvedPaths:   LABEL_RESOLVED_PATHS,
    insightsPaths:        INSIGHTS_PATHS
  };

  validateContract(contract);
  contract.checksum = fnv1a8(serializeForChecksum(contract));

  return contract;
}

const _CONTRACT = buildContract();

export function getDataContract()     { return _CONTRACT; }
export function getContractChecksum() { return _CONTRACT.checksum; }
