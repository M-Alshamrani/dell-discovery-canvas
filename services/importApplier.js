// services/importApplier.js — rc.8 / C1e (SPEC §S47.5.5 + §S47.10)
//
// The shared applier · both ingress paths (Skills-Builder file-ingest
// skill + Dell-internal-LLM instructions workflow) call into this
// module after parseImportResponse + checkImportDrift have cleared
// the wire payload.
//
// CONTRACT (per SPEC §S47.5 + §S47.5.5):
//   - Modal apply-scope picker is AUTHORITATIVE (R47.5.2)
//   - For scope="current"  · creates 1 state="current" instance per item
//   - For scope="desired"  · creates 1 state="desired" instance per item
//   - For scope="both"     · creates TWO TRULY INDEPENDENT records
//                            (one current + one desired) with NO
//                            originId linkage between them (R47.5.5)
//   - Provenance envelope (aiTag) is stamped on every created instance
//     (kind="skill" for Path A, kind="external-llm" for Path B)
//
// IMPLEMENTATION NOTES:
//   - Disposition defaults are state-aware · "keep" for current, "introduce"
//     for desired · matches the canonical disposition for "this exists today"
//     vs "we want to bring this in". The wire format does not carry
//     disposition because §S47.2 scope is instance entities only and the
//     LLM is not expected to reason about lifecycle.
//   - originId is forced to null for ALL imported instances regardless
//     of scope · the import wire format never represents a desired<>current
//     link (the engineer creates those manually after import via the
//     existing matrix-view link flow).
//   - priority is null on import · the engineer sets priority post-import.
//   - mappedAssetIds is [] on import · workload mappings are out of scope
//     for the §S47 import flow (only the 5 standard layers are imported).
//
// AUDIT TRAIL:
//   - The applier delegates each instance creation to instanceActions.addInstance
//     so the engagementStore's normal integrity hooks (FK validation,
//     byState index rebuild, meta.updatedAt bump) fire identically to
//     a manually-added instance. Imports leave NO observable difference
//     vs hand-entry beyond the aiTag stamp.
//
// Authority: docs/v3.0/SPEC.md §S47.5 + §S47.5.5 + §S47.9 +
//            §S47.10 (V-FLOW-IMPORT-BOTH-1).

import { addInstance } from "../state/collections/instanceActions.js";

// Build an aiTag envelope from the caller's provenance hint. Returns
// null if no provenance was supplied (a non-tagged import is rare but
// permitted for test fixtures + future hand-curated catalogs).
function buildAiTag(provenance) {
  if (!provenance || typeof provenance !== "object") return null;
  const tag = {
    kind:      provenance.kind || "external-llm",
    runId:     provenance.runId,
    mutatedAt: provenance.mutatedAt
  };
  if (provenance.source)  tag.source  = provenance.source;
  if (provenance.skillId) tag.skillId = provenance.skillId;
  return tag;
}

// Disposition default per state. Wire format does not carry disposition;
// applier injects the canonical one for the target state.
function defaultDispositionFor(state) {
  return state === "current" ? "keep" : "introduce";
}

// Build the addInstance input from an item.data + a target state.
function buildInstanceInput(itemData, state, provenance) {
  return {
    state:                  state,
    layerId:                itemData.layerId,
    environmentId:          itemData.environmentId,
    label:                  itemData.label,
    vendor:                 itemData.vendor,
    vendorGroup:            itemData.vendorGroup,
    criticality:            itemData.criticality,
    notes:                  itemData.notes || "",
    disposition:            defaultDispositionFor(state),
    // R47.5.5 - no linkage between current and desired created from
    // the same item, regardless of scope.
    originId:               null,
    // R47 - priority set by engineer post-import, not by LLM.
    priority:               null,
    // §S47.2 - workload-asset mappings out of scope.
    mappedAssetIds:         [],
    aiSuggestedDellMapping: null,
    aiTag:                  buildAiTag(provenance)
  };
}

// applyImportItems(engagement, items, opts)
//   opts.scope       - "current" | "desired" | "both" (R47.5)
//   opts.provenance  - { kind, source?, skillId?, runId, mutatedAt } (R47.9)
// Returns: { engagement, addedInstanceIds, errors? }
//   - engagement       - the new engagement with all imported instances
//                        committed (or the original engagement if all
//                        items errored at the addInstance layer)
//   - addedInstanceIds - flat array of newly-created instance IDs in
//                        commit order. For scope="both" each item yields
//                        two IDs.
//   - errors           - non-null only if any item failed; each entry
//                        carries { itemIndex, state, errors[] }
export function applyImportItems(engagement, items, opts) {
  const scope      = (opts && opts.scope)      || "desired";
  const provenance = (opts && opts.provenance) || null;

  let eng = engagement;
  const addedInstanceIds = [];
  const errors           = [];

  // Inner: add one instance for a specific state, accumulate result.
  function addOne(item, state, itemIndex) {
    const input = buildInstanceInput(item.data, state, provenance);
    const res   = addInstance(eng, input);
    if (res.ok) {
      eng = res.engagement;
      // The newest instance is the last in allIds (addInstance appends).
      const ids = eng.instances.allIds;
      addedInstanceIds.push(ids[ids.length - 1]);
    } else {
      errors.push({ itemIndex: itemIndex, state: state, errors: res.errors || [] });
    }
  }

  const list = Array.isArray(items) ? items : [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || !item.data) continue;
    if (scope === "both") {
      addOne(item, "current", i);
      addOne(item, "desired", i);
    } else {
      addOne(item, scope, i);
    }
  }

  return {
    engagement:       eng,
    addedInstanceIds: addedInstanceIds,
    errors:           errors.length > 0 ? errors : null
  };
}
