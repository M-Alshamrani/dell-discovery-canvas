// state/collections/engagementMetaActions.js — v3.0 · SPEC sec S3.1
//
// EngagementMeta is the workshop's identity envelope — single record at
// engagement.meta. Same pattern as customerActions.js: pure function,
// returns new engagement, validates against EngagementMetaSchema.
//
// Added 2026-05-11 to close WB-1 (presalesOwner dead input in
// Tab 1 §2 Discovery context). Pre-fix the input was a no-op
// placeholder ("v3 hasn't grown the field yet" — but it had);
// this action plus the corresponding commitContextEdit({meta})
// branch in state/adapter.js wires the input through to the schema.
//
// Authority: docs/UI_DATA_TRACE.md (r6) WB-1.

import { EngagementMetaSchema } from "../../schema/engagement.js";

export function updateEngagementMeta(engagement, patch) {
  const existing = engagement.meta;
  const merged = {
    ...existing,
    ...patch,
    // engagementId + schemaVersion are authoritative — cannot be patched
    // via this surface. createdAt is set at engagement creation and
    // never changes; updatedAt refreshes on every successful patch.
    engagementId:  existing.engagementId,
    schemaVersion: existing.schemaVersion,
    createdAt:     existing.createdAt,
    updatedAt:     new Date().toISOString()
  };
  const result = EngagementMetaSchema.safeParse(merged);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(i => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code
      }))
    };
  }
  return {
    ok: true,
    engagement: {
      ...engagement,
      meta: result.data
    }
  };
}
