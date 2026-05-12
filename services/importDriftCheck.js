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
export function checkImportDrift(parsedResponse, engagement) {
  const liveEnvIds = new Set(
    (engagement && engagement.environments && Array.isArray(engagement.environments.allIds))
      ? engagement.environments.allIds
      : []
  );

  const items = (parsedResponse && Array.isArray(parsedResponse.items))
    ? parsedResponse.items
    : [];

  const missing = [];
  const seen    = new Set();

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const envId = it && it.data && it.data.environmentId;
    if (!envId || typeof envId !== "string") continue;
    if (liveEnvIds.has(envId)) continue;
    if (seen.has(envId))       continue;
    seen.add(envId);
    missing.push(envId);
  }

  return {
    ok:            missing.length === 0,
    missingEnvIds: missing
  };
}
