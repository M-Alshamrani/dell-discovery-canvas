// schema/helpers/crossCuttingFields.js — v3.0 · SPEC sec S3.0
//
// Every persisted entity except engagementMeta and customer carries:
//   id, engagementId, createdAt, updatedAt.
// Per directive R4.3.1 + P8 + R12.1.

import { z } from "zod";

export const crossCuttingFieldsSchema = {
  id:           z.string().uuid(),
  engagementId: z.string().uuid(),
  createdAt:    z.string().datetime(),
  updatedAt:    z.string().datetime()
};

// Helper for default-valid factories: uses the all-zero UUID for id
// + engagementId + a fixed test-mode timestamp. Deterministic for tests.
const ZERO_UUID = "00000000-0000-4000-8000-000000000000";
const ZERO_TS   = "2026-01-01T00:00:00.000Z";

export function defaultCrossCuttingFields(overrides = {}) {
  return {
    id:           overrides.id           ?? ZERO_UUID,
    engagementId: overrides.engagementId ?? ZERO_UUID,
    createdAt:    overrides.createdAt    ?? ZERO_TS,
    updatedAt:    overrides.updatedAt    ?? ZERO_TS
  };
}
