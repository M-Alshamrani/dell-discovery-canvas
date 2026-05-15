// schema/helpers/aiTag.js — v3.0 · Sub-arc D Step 5 (A20 widening)
//
// Shared AiTagSchema · single source of truth for the AI-mutation
// provenance envelope. Pre-A20 this was defined inline in schema/
// instance.js with scope locked to instances only (per RULES §16 CH36
// R7 original lock). A20 widening (2026-05-15) extends the schema to
// drivers + gaps too — moving the shape into a shared helper avoids
// duplicated Zod declarations across 3 entity-kind files.
//
// AUTHORITY: SPEC §S47.9.1 (original aiTag · rc.8 LOCKED 2026-05-12) +
// §S47.9.1a (A20 widening to drivers + gaps) + §S47.9.1b (kind enum
// extension · adds "discovery-note" + "ai-proposal" to the original
// "skill" + "external-llm" pair) + framing-doc A20 Q3 + RULES §16 CH36
// R7 narrowing amendment (2026-05-15).
//
// KIND ENUM (post-A20):
//   "skill"          · Skills Builder skill-mutation path (CH36 R7 ·
//                       instances only · pre-A20 default)
//   "external-llm"   · Path B file-upload import (rc.8 · instances only ·
//                       pre-A20)
//   "discovery-note" · Workshop Notes overlay path (A19 pivot + A20 ·
//                       primary Sub-arc D UX path · instances + drivers
//                       + gaps · stamped by importApplier when source =
//                       "workshop-notes-overlay")
//   "ai-proposal"    · Mode 2 chat-inline emission (reserved · Sub-arc D
//                       §S20.4.1.5 · not yet stamped by any production
//                       code path · forward compatibility)
//
// Cross-references:
//   - schema/instance.js · re-exports this schema via Aital re-import
//   - schema/driver.js   · adds optional aiTag field via this helper
//   - schema/gap.js      · adds optional aiTag field via this helper
//   - services/importApplier.js · stamps aiTag.kind = "discovery-note"
//   - ui/views/MatrixView.js · renders tile chip per kind (§S47.9.3)
//   - RULES §16 CH36 R7 narrowing (2026-05-15 amendment)

import { z } from "zod";

// Per §S47.9.1a · 4 kinds post-A20.
export const AI_TAG_KINDS = [
  "skill",
  "external-llm",
  "discovery-note",
  "ai-proposal"
];

export const AiTagSchema = z.object({
  kind:      z.enum(AI_TAG_KINDS).default("skill"),
  skillId:   z.string().optional(),   // present when kind="skill"
  source:    z.string().optional(),   // present when kind="external-llm" | "discovery-note" | "ai-proposal"
  runId:     z.string().min(1),
  mutatedAt: z.string().min(1)        // ISO instant
});

// Convenience export: nullable + default(null) form for use in entity
// schemas. Existing entities without an aiTag parse to aiTag: null.
export const AiTagFieldSchema = AiTagSchema.nullable().default(null);
