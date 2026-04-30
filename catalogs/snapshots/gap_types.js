// catalogs/snapshots/gap_types.js — v3.0 · GAP_TYPES catalog
// 5 gap types. Per SPEC sec S6.2 inventory: derived from
// DISPOSITION_ACTIONS minus the `keep` (no gap) and `retire` (gap is
// "ops" type) entries — leaving the 5 gap-creating action ids:
// replace, consolidate, introduce, enhance, ops. dispositionMatch[]
// records which dispositions auto-draft this gap type.

export default Object.freeze({
  catalogId: "GAP_TYPES",
  catalogVersion: "2026.04",
  entries: [
    {
      id: "replace",
      label: "Replace",
      dispositionMatch: ["replace"]
    },
    {
      id: "consolidate",
      label: "Consolidate",
      dispositionMatch: ["consolidate"]
    },
    {
      id: "introduce",
      label: "Introduce",
      dispositionMatch: ["introduce"]
    },
    {
      id: "enhance",
      label: "Enhance",
      dispositionMatch: ["enhance"]
    },
    {
      id: "ops",
      label: "Operational",
      dispositionMatch: ["retire", "ops"]
    }
  ]
});
