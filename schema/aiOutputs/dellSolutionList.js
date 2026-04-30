// schema/aiOutputs/dellSolutionList.js — v3.0 · SPEC sec S7.4.1
//
// Output shape for the dell-mapping skill. Every entry in `products`
// MUST be a valid id from the DELL_PRODUCT_TAXONOMY catalog. The
// skill runner's structured-output validation enforces this; the
// catalog enforces the SPEC sec S6.2.1 LOCKED corrections (no Boomi,
// no Taegis, no VxRail, no SmartFabric Director).

import { z } from "zod";

export const DellSolutionListSchema = z.object({
  // Optional rationale paragraph (free-text, not catalog-checked)
  rationale: z.string().optional(),
  // Required: array of catalog product ids
  products:  z.array(z.string().min(1))
});
