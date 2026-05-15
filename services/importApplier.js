// services/importApplier.js — rc.8 / C1e (SPEC §S47.5.5 + §S47.10)
//                            WIDENED 2026-05-15 (A20 · §S47.5 + §S47.9.5)
//
// The shared applier · all ingress paths (Skills-Builder file-ingest
// skill + Dell-internal-LLM instructions workflow + Workshop Notes
// overlay) call into this module after parseImportResponse +
// checkImportDrift have cleared the widened wire payload.
//
// PRE-A20 CONTRACT (per SPEC §S47.5 + §S47.5.5):
//   - Modal apply-scope picker is AUTHORITATIVE for instance.add (R47.5.2)
//   - For scope="current"  · creates 1 state="current" instance per item
//   - For scope="desired"  · creates 1 state="desired" instance per item
//   - For scope="both"     · creates TWO TRULY INDEPENDENT records
//                            (one current + one desired) with NO
//                            originId linkage between them (R47.5.5)
//   - Provenance envelope (aiTag) is stamped on every created instance
//
// A20 WIDENING (2026-05-15 · per SPEC §S47.5 + §S47.9.5 + framing-doc A20):
//   - Kind-aware dispatch: applier reads each items[].kind and routes:
//       "instance.add" → instanceActions.addInstance (1 or 2 records · per scope)
//       "driver.add"   → driverActions.addDriver (apply-scope IGNORED · drivers have no state)
//       "gap.close"    → gapActions.updateGap with {status: "closed", notes: existing + "\nClosed: " + closeReason}
//   - aiTag.kind is stamped per the provenance.kind passed in opts:
//       "skill"          · Skills-Builder skill run
//       "external-llm"   · Path B file upload (Dell internal LLM)
//       "discovery-note" · Workshop Notes overlay (A19 + A20 · NEW)
//       "ai-proposal"    · Mode 2 chat-inline (reserved)
//   - All 3 kinds carry aiTag at apply time (drivers + gaps gained aiTag
//     schema fields at A20 · per §S47.9.1a · RULES §16 CH36 R7 narrowing)
//
// Authority: docs/v3.0/SPEC.md §S47.5 + §S47.5.5 + §S47.8.4 + §S47.9 +
//            §S47.10 (V-FLOW-IMPORT-BOTH-1) + framing-doc A20 widening.

import { addInstance }   from "../state/collections/instanceActions.js";
import { addDriver }     from "../state/collections/driverActions.js";
import { updateGap }     from "../state/collections/gapActions.js";

// Build an aiTag envelope from the caller's provenance hint. Returns
// null if no provenance was supplied (a non-tagged import is rare but
// permitted for test fixtures + future hand-curated catalogs).
//
// POST-A20: kind enum extends to include "discovery-note" + "ai-proposal"
// per schema/helpers/aiTag.js. The default kind for file-upload Path B
// stays "external-llm" (pre-A20 behavior preserved · no regression).
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
// Adds aiTag from the buildAiTag(provenance) envelope.
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

// A20 (2026-05-15) · Build the addDriver input from a driver.add item.
// Mirrors buildInstanceInput shape but for drivers.
function buildDriverInput(itemData, provenance) {
  return {
    businessDriverId: itemData.businessDriverId,
    catalogVersion:   "2026.05",                  // A20 default · refresh per release
    priority:         itemData.priority || "Medium",
    outcomes:         itemData.outcomes || "",
    aiTag:            buildAiTag(provenance)
  };
}

// applyImportItems(engagement, items, opts)
//   opts.scope       - "current" | "desired" | "both" (R47.5)
//                       Note (A20): scope is AUTHORITATIVE only for
//                       instance.add items · driver.add + gap.close
//                       ignore the scope picker (drivers have no state ·
//                       close-gap is a MUTATE-existing operation)
//   opts.provenance  - { kind, source?, skillId?, runId, mutatedAt } (R47.9)
//                       kind defaults to "external-llm" pre-A20 ·
//                       Workshop Notes overlay passes kind:"discovery-note"
// Returns: { engagement, addedInstanceIds, addedDriverIds, closedGapIds, errors? }
//   - engagement       - the new engagement with all imported entities
//                        committed (or the original engagement if all
//                        items errored at the per-action layer)
//   - addedInstanceIds - flat array of newly-created instance IDs in
//                        commit order. For scope="both" each instance.add
//                        item yields two IDs.
//   - addedDriverIds   - flat array of newly-created driver IDs · A20
//   - closedGapIds     - flat array of gap IDs whose status was set to
//                        "closed" via gap.close items · A20
//   - errors           - non-null only if any item failed; each entry
//                        carries { itemIndex, kind, state?, errors[] }
export function applyImportItems(engagement, items, opts) {
  const scope      = (opts && opts.scope)      || "desired";
  const provenance = (opts && opts.provenance) || null;

  let eng = engagement;
  const addedInstanceIds = [];
  const addedDriverIds   = [];                          // A20
  const closedGapIds     = [];                          // A20
  const errors           = [];

  // Inner: add one instance for a specific state, accumulate result.
  function addInstanceOne(item, state, itemIndex) {
    const input = buildInstanceInput(item.data, state, provenance);
    const res   = addInstance(eng, input);
    if (res.ok) {
      eng = res.engagement;
      const ids = eng.instances.allIds;
      addedInstanceIds.push(ids[ids.length - 1]);
    } else {
      errors.push({ itemIndex: itemIndex, kind: "instance.add", state: state, errors: res.errors || [] });
    }
  }

  // A20 · Add one driver from a driver.add item.
  function addDriverOne(item, itemIndex) {
    const input = buildDriverInput(item.data, provenance);
    const res   = addDriver(eng, input);
    if (res.ok) {
      eng = res.engagement;
      const ids = eng.drivers.allIds;
      addedDriverIds.push(ids[ids.length - 1]);
    } else {
      errors.push({ itemIndex: itemIndex, kind: "driver.add", errors: res.errors || [] });
    }
  }

  // A20 · Close one gap from a gap.close item. Mutates the existing
  // gap's status to "closed" + appends closeReason to notes. Stamps
  // aiTag on the mutated gap.
  function closeGapOne(item, itemIndex) {
    const gapId = item.data && item.data.gapId;
    const existing = eng.gaps && eng.gaps.byId && eng.gaps.byId[gapId];
    if (!existing) {
      errors.push({ itemIndex: itemIndex, kind: "gap.close", errors: [{ path: "gapId", message: "Gap not found at apply time (drift between drift-check and apply?)", code: "not_found" }] });
      return;
    }
    const closeReason = (item.data && item.data.closeReason) || "";
    // Append closeReason to notes (engineer-readable trail). Preserve
    // existing notes; add a newline + "Closed: <reason>" suffix.
    const trailedNotes = (existing.notes && existing.notes.length > 0)
      ? existing.notes + "\nClosed: " + closeReason
      : (closeReason.length > 0 ? "Closed: " + closeReason : "");
    const patch = {
      status: "closed",
      notes:  trailedNotes,
      aiTag:  buildAiTag(provenance)
    };
    const res = updateGap(eng, gapId, patch);
    if (res.ok) {
      eng = res.engagement;
      closedGapIds.push(gapId);
    } else {
      errors.push({ itemIndex: itemIndex, kind: "gap.close", errors: res.errors || [] });
    }
  }

  const list = Array.isArray(items) ? items : [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || !item.data) continue;

    // A20 · kind-aware dispatch. Pre-A20 every item was treated as
    // instance.add implicitly; A20 reads item.kind explicitly.
    // Back-compat: legacy V-FLOW-IMPORT-BOTH-1 test fixture + any direct
    // applier caller that bypasses parseImportResponse may pass items
    // without `kind`. Default to "instance.add" for these (matches
    // pre-A20 behavior · drift-check uses the same back-compat default).
    const kind = item.kind || "instance.add";
    switch (kind) {
      case "instance.add":
        if (scope === "both") {
          addInstanceOne(item, "current", i);
          addInstanceOne(item, "desired", i);
        } else {
          addInstanceOne(item, scope, i);
        }
        break;
      case "driver.add":
        addDriverOne(item, i);
        break;
      case "gap.close":
        closeGapOne(item, i);
        break;
      default:
        errors.push({ itemIndex: i, kind: kind || "(missing)", errors: [{ path: "kind", message: "Unknown item kind · expected instance.add | driver.add | gap.close", code: "unknown_kind" }] });
    }
  }

  return {
    engagement:       eng,
    addedInstanceIds: addedInstanceIds,
    addedDriverIds:   addedDriverIds,
    closedGapIds:     closedGapIds,
    errors:           errors.length > 0 ? errors : null
  };
}
