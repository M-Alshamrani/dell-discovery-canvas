// services/workshopNotesImportAdapter.js — v3.0 · Sub-arc D Step 4 (A20 widening)
//
// Transforms Workshop Notes overlay output (mappings: ActionProposal[]
// emitted by services/workshopNotesService.js · validated via
// schema/actionProposal.js) into the Path B widened wire shape
// (per SPEC §S47.3 R47.3.5 + R47.3.6 · per-item kind discriminator
// `instance.add` | `driver.add` | `gap.close`).
//
// AUTHORITY: SPEC §S20.4.1.5 (Workshop Notes → Path B importer flow)
// + §S47.3 R47.3.5/6 (per-item kind discriminator · A20 widening) +
// framing-doc A19 (pivot) + A20 (widening) Q1 lock.
//
// CONTRACT (V-ADAPTER-NOTES-1 + V-ADAPTER-NOTES-WIDEN-1):
//   - Imports ActionProposalSchema from schema/actionProposal.js
//     (single source of truth · no parallel definitions · per A20 Q3
//      anti-pattern lock + V-ADAPTER-NOTES-1 Guard 1 source-grep)
//   - Maps the 4 ActionProposal kinds to 3 wire kinds:
//        add-instance-current → kind: "instance.add" + data.state="current"
//        add-instance-desired → kind: "instance.add" + data.state="desired"
//        add-driver           → kind: "driver.add"
//        close-gap            → kind: "gap.close"
//   - Validates each mapping via ActionProposalSchema.safeParse;
//     drops invalid entries with console.warn (chatService pattern)
//   - Emits schemaVersion: "1.1" (the A20-widened wire format · per
//     SPEC §S47.3 R47.3.5)
//
// USAGE:
//   import { transformOverlayToImportPayload } from "/services/workshopNotesImportAdapter.js";
//   const payload = transformOverlayToImportPayload({
//     mappings: <ActionProposal[]>,
//     runId:    <string>,
//     mutatedAt:<ISO string>
//   });
//   // payload shape: { schemaVersion: "1.1", generatedAt, runId, mutatedAt,
//   //                  source: "workshop-notes-overlay", items: [...] }
//
// Cross-references:
//   - schema/actionProposal.js · canonical ActionProposalSchema
//   - services/workshopNotesService.js · the producer of mappings[]
//   - services/importResponseParser.js · the consumer (Step 5 impl widens)
//   - ui/components/ImportPreviewModal.js · the consumer's preview UI
//   - SPEC §S47.3 R47.3.5 + R47.3.6 · per-item kind discriminator
//   - framing-doc A20 Q1 (wire shape lock) + Q3 (single-schema-source lock)

import { ActionProposalSchema } from "../schema/actionProposal.js";

// Map a single validated ActionProposal to the widened wire item shape.
// Returns null if the kind is unknown (defensive — schema validation
// upstream should catch this, but treat as belt-and-braces).
function mapProposalToWireItem(proposal) {
  if (!proposal || typeof proposal !== "object") return null;

  const sharedFields = {
    confidence: (proposal.confidence || "MEDIUM").toLowerCase(),  // schema enum is HIGH/MEDIUM/LOW; wire format uses high/medium/low per §S47.3
    rationale:  proposal.rationale || ""
  };

  switch (proposal.kind) {
    case "add-instance-current":
      return Object.assign({ kind: "instance.add" }, sharedFields, {
        data: {
          state:         "current",
          layerId:       proposal.payload.layerId,
          environmentId: proposal.payload.environmentId,
          label:         proposal.payload.label,
          vendor:        proposal.payload.vendor || "",
          vendorGroup:   proposal.payload.vendorGroup || "nonDell",
          criticality:   proposal.payload.criticality || "Medium",
          notes:         ""
        }
      });
    case "add-instance-desired":
      return Object.assign({ kind: "instance.add" }, sharedFields, {
        data: {
          state:         "desired",
          layerId:       proposal.payload.layerId,
          environmentId: proposal.payload.environmentId,
          label:         proposal.payload.label,
          vendor:        proposal.payload.vendor || "",
          vendorGroup:   proposal.payload.vendorGroup || "nonDell",
          criticality:   "Medium",         // desired-state criticality typically engineer-set post-import
          notes:         ""
        }
      });
    case "add-driver":
      return Object.assign({ kind: "driver.add" }, sharedFields, {
        data: {
          businessDriverId: proposal.payload.businessDriverId,
          priority:         proposal.payload.priority || "Medium",
          outcomes:         Array.isArray(proposal.payload.outcomes)
            ? proposal.payload.outcomes.join("; ")
            : (proposal.payload.outcomes || "")
        }
      });
    case "close-gap":
      return Object.assign({ kind: "gap.close" }, sharedFields, {
        data: {
          gapId:       proposal.payload.gapId,
          status:      "closed",
          closeReason: proposal.payload.closeReason || ""
        }
      });
    default:
      return null;
  }
}

// transformOverlayToImportPayload · main exported entry point.
//
//   opts.mappings   · ActionProposal[] (from services/workshopNotesService.js · already validated)
//   opts.runId      · string · provenance id (passed through to importApplier for aiTag stamping)
//   opts.mutatedAt  · ISO string · provenance timestamp
//
// Returns the widened Path B wire payload that flows into
// importResponseParser.js → importDriftCheck.js → ImportPreviewModal
// → importApplier.js (the existing rc.8 pipeline · widened at Step 5).
//
// Per-mapping validation: each mapping is re-validated against
// ActionProposalSchema (defensive · in case the caller bypassed the
// service-layer validation). Invalid mappings are dropped with
// console.warn rather than throwing — matches chatService.streamChat
// pattern of tolerating partial bad input rather than failing the
// whole import.
export function transformOverlayToImportPayload(opts) {
  opts = opts || {};
  const mappings = Array.isArray(opts.mappings) ? opts.mappings : [];
  const runId = opts.runId || ("wn-" + Date.now().toString(36));
  const mutatedAt = opts.mutatedAt || new Date().toISOString();

  const items = [];
  let droppedCount = 0;

  for (let i = 0; i < mappings.length; i++) {
    const raw = mappings[i];
    // Defensive re-validation. workshopNotesService.pushNotesToAi
    // already did this, but the caller could be a test fixture or
    // a future code path that bypasses the service layer.
    const validated = ActionProposalSchema.safeParse(raw);
    if (!validated.success) {
      droppedCount++;
      console.warn("[workshopNotesImportAdapter] dropping invalid ActionProposal at index " + i + ": " +
        (validated.error && validated.error.message ? validated.error.message : "(no error)"));
      continue;
    }
    const wireItem = mapProposalToWireItem(validated.data);
    if (wireItem === null) {
      droppedCount++;
      console.warn("[workshopNotesImportAdapter] dropping mapping at index " + i +
        " · unknown kind: " + validated.data.kind);
      continue;
    }
    items.push(wireItem);
  }

  return {
    schemaVersion: "1.1",                       // A20 widened format per SPEC §S47.3 R47.3.5
    generatedAt:   new Date().toISOString(),
    runId:         runId,                       // provenance · importApplier stamps aiTag.runId
    mutatedAt:     mutatedAt,                   // provenance · importApplier stamps aiTag.mutatedAt
    source:        "workshop-notes-overlay",    // importApplier reads this to stamp aiTag.kind="discovery-note"
    items:         items,
    droppedCount:  droppedCount                 // engineer-visible · surfaced in overlay toast on import-click
  };
}
