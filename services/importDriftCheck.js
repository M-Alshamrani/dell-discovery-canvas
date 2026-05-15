// services/importDriftCheck.js — rc.8 / C1d (SPEC §S47.8.4 + §S47.10)
//
// Strict drift detection for Path B (Dell-internal-LLM file-driven
// imports). The instructions file (R47.4) embeds the LIVE engagement's
// environment UUIDs at instructions-generation time; the LLM is told to
// reference those UUIDs exactly. If the engineer adds or removes
// environments between instructions-generation and import, the imported
// JSON will reference UUIDs that are no longer in the engagement.
//
// CONTRACT (R47.8.4 · strict-reject, no partial apply):
//   - every items[].data.environmentId MUST be present in
//     engagement.environments.allIds
//   - if ANY referenced UUID is missing, the entire import is REJECTED
//   - no partial apply, no fuzzy remap, no UUID coercion
//
// The user-facing error message is the caller's responsibility (the
// preview modal renders a 1-line banner per R47.8.4: "Response references
// N environment(s) no longer in this engagement. Re-generate instructions
// and re-run."). This module returns only the structural result so the
// caller can compose its UX.
//
// SCOPE (current rev):
//   - environment UUID membership only (per R47.8.4 literal wording)
//   - customer-name drift is OUT of scope for this rev · the instructions
//     file embeds customer name for context, but drift detection on
//     customer mismatch is not specified in §S47 and would be a separate
//     amendment.
//
// Authority: docs/v3.0/SPEC.md §S47.8.4 + §S47.10 (V-FLOW-IMPORT-DRIFT-1).

// checkImportDrift(parsedResponse, engagement) -> { ok, missingEnvIds }
//   - ok=true  · missingEnvIds is [] · safe to proceed to applier
//   - ok=false · missingEnvIds is the deduplicated list of UUIDs the
//                response references that are NOT in the live engagement
//
// Both arguments are validated defensively · a missing `items` array or
// missing `environments.allIds` is treated as "no items / no live envs"
// rather than throwing. The caller is expected to have already passed
// the response through parseImportResponse (which would have rejected
// structurally-invalid input).
// A20 amendment 2026-05-15 (per SPEC §S47.8.4 widening · framing-doc A20 Q4):
// kind-aware drift checking. Pre-A20 only env UUID membership was checked
// (instance-shape rows). A20 adds:
//   - kind: "instance.add" → env UUID membership (UNCHANGED from pre-A20)
//   - kind: "driver.add"   → businessDriverId catalog membership (static catalog · NO live-engagement check)
//   - kind: "gap.close"    → gapId membership against live engagement gaps
//
// Duplicate-detection rows (per A20 Q4 second lock · "engineer override"):
// also computed here but NOT treated as drift failures · surfaced to
// the modal as per-row indicators. The engineer decides whether to
// apply or deselect.
import { BUSINESS_DRIVERS } from "../core/config.js";
export function checkImportDrift(parsedResponse, engagement) {
  const liveEnvIds = new Set(
    (engagement && engagement.environments && Array.isArray(engagement.environments.allIds))
      ? engagement.environments.allIds
      : []
  );
  const liveGapIds = new Set(
    (engagement && engagement.gaps && Array.isArray(engagement.gaps.allIds))
      ? engagement.gaps.allIds
      : []
  );
  // BUSINESS_DRIVERS catalog membership · use the id field of each entry.
  const validDriverCatalogIds = new Set(
    (Array.isArray(BUSINESS_DRIVERS) ? BUSINESS_DRIVERS : []).map(d => d && d.id).filter(Boolean)
  );
  // Existing engagement entities for duplicate detection (A20 Q4 lock).
  const existingDriverCatalogIds = new Set();
  if (engagement && engagement.drivers && Array.isArray(engagement.drivers.allIds)) {
    engagement.drivers.allIds.forEach(id => {
      const d = engagement.drivers.byId[id];
      if (d && d.businessDriverId) existingDriverCatalogIds.add(d.businessDriverId);
    });
  }
  // Per-instance dedup key: (layerId, environmentId, label).
  const existingInstanceKeys = new Set();
  if (engagement && engagement.instances && Array.isArray(engagement.instances.allIds)) {
    engagement.instances.allIds.forEach(id => {
      const inst = engagement.instances.byId[id];
      if (inst) existingInstanceKeys.add(inst.layerId + "|" + inst.environmentId + "|" + inst.label);
    });
  }

  const items = (parsedResponse && Array.isArray(parsedResponse.items))
    ? parsedResponse.items
    : [];

  const missingEnvIds         = [];
  const missingGapIds         = [];
  const invalidBusinessDriverIds = [];
  const duplicates            = [];                // per-row duplicate flags · A20 Q4 lock
  const seenEnv = new Set();
  const seenGap = new Set();
  const seenDriverInvalid = new Set();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object") continue;
    // A20 back-compat: pre-A20 legacy file-upload payloads have no
    // per-item `kind` field (the top-level kind:"instance.add" was the
    // only discriminator). Default missing kind to "instance.add" so
    // legacy callers (V-FLOW-IMPORT-DRIFT-1 + Path B file-upload smoke)
    // keep working without forcing every caller to upgrade. Workshop
    // Notes overlay payloads (Step 4 adapter) emit explicit kind.
    const kind = item.kind || "instance.add";
    // Kind-aware switch · the discriminated union guarantees `kind` is
    // one of 3 values · default-case is defensive (parser is upstream
    // gatekeeper but kind-aware code should fail visibly on unknown kind).
    switch (kind) {
      case "instance.add": {
        const envId = item.data && item.data.environmentId;
        if (typeof envId === "string" && envId.length > 0 && !liveEnvIds.has(envId) && !seenEnv.has(envId)) {
          seenEnv.add(envId);
          missingEnvIds.push(envId);
        }
        const dupKey = (item.data ? item.data.layerId : "") + "|" + (item.data ? item.data.environmentId : "") + "|" + (item.data ? item.data.label : "");
        if (existingInstanceKeys.has(dupKey)) {
          duplicates.push({ itemIndex: i, kind: "instance.add", reason: "already in engagement (same layer + environment + label)" });
        }
        break;
      }
      case "driver.add": {
        const bdId = item.data && item.data.businessDriverId;
        if (typeof bdId === "string" && bdId.length > 0 && validDriverCatalogIds.size > 0 && !validDriverCatalogIds.has(bdId) && !seenDriverInvalid.has(bdId)) {
          seenDriverInvalid.add(bdId);
          invalidBusinessDriverIds.push(bdId);
        }
        if (typeof bdId === "string" && existingDriverCatalogIds.has(bdId)) {
          duplicates.push({ itemIndex: i, kind: "driver.add", reason: "driver already in engagement (businessDriverId match)" });
        }
        break;
      }
      case "gap.close": {
        const gapId = item.data && item.data.gapId;
        if (typeof gapId === "string" && gapId.length > 0 && !liveGapIds.has(gapId) && !seenGap.has(gapId)) {
          seenGap.add(gapId);
          missingGapIds.push(gapId);
        }
        // close-gap targeting an EXISTING gap is the EXPECTED state ·
        // not a duplicate · drift only flags missing gapIds.
        break;
      }
      default:
        // Unknown kind · should never reach here if parser validated
        // upstream · but be defensive · flag in console.
        console.warn("[importDriftCheck] unknown item kind at index " + i + ": " + (item.kind || "(missing)"));
    }
  }

  return {
    ok:                       missingEnvIds.length === 0 && missingGapIds.length === 0 && invalidBusinessDriverIds.length === 0,
    missingEnvIds:            missingEnvIds,
    missingGapIds:            missingGapIds,
    invalidBusinessDriverIds: invalidBusinessDriverIds,
    duplicates:               duplicates              // not blocking · engineer-override per A20 Q4
  };
}
