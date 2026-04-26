// core/services.js — Phase 19l / v2.4.12
//
// Catalog of professional-services "engagement shape" categories that can
// be attached to any gap as a multi-select facet. The chips appear on the
// Tab 4 gap detail panel; rolled-up per project on the Tab 5.5 Roadmap;
// and rolled-up across the whole session on the new Reporting "Services
// scope" sub-tab.
//
// Services are NOT a separate gap type — they are a facet of any gap.
// A Replace gap implies migration + deployment. A Consolidate gap implies
// migration + integration + knowledge_transfer. SUGGESTED_SERVICES_BY_GAP_TYPE
// drives an OPT-IN "SUGGESTED" eyebrow row above the chip selector: chips
// appear greyed but are NOT auto-selected. User clicks to add. Less
// surprising than auto-applying.
//
// STUB · v2.4.12 spec-and-test-first phase: empty exports so the Suite 43
// SVC tests fail RED. Implementation phase replaces these with the full
// 10-entry catalog + suggested map per `docs/CHANGELOG_PLAN.md § v2.4.12`.

export const SERVICE_TYPES = [];

export const SUGGESTED_SERVICES_BY_GAP_TYPE = {};

// Convenience: array of all valid service ids — used by validateGap to
// reject unknown ids. Derived from SERVICE_TYPES so it stays in sync.
export const SERVICE_IDS = SERVICE_TYPES.map(function(s) { return s.id; });
