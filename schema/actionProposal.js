// schema/actionProposal.js — v3.0 · SPEC §S20.4.1.3 + RULES §16 CH38
//
// Sub-arc D (rc.10) · canonical Zod schema for structured action proposals
// emitted by the chat via the `proposeAction` tool (services/chatTools.js).
// Authored 2026-05-14 evening per docs/SUB_ARC_D_FRAMING_DECISIONS.md Q3 +
// the user-approved [CONSTITUTIONAL TOUCH PROPOSED] flow.
//
// The chat invokes `proposeAction(actionProposal)` as a tool call; the
// args are validated against ActionProposalSchema at chatService capture
// time; valid proposals are appended to the envelope's `proposedActions[]`
// field for engineer-facing review (Sub-arc D Step 4) or eval-harness
// scoring (action-correctness rubric per SPEC §S48.2).
//
// SCOPE (v1 stub-emission):
//   - 4 action kinds: add-driver · add-instance-current · add-instance-desired · close-gap
//   - flip-disposition DEFERRED to v1.5 (cascade risk: originId chains may break)
//   - destructive kinds (delete-* · hide-* · archive-*) DEFERRED to v1.5+
//
// STRICTNESS: per-kind payload schemas are .strict() so unknown fields
// fail validation. Discriminated union on `kind` enforces per-kind
// payload shape so the chat cannot emit an add-driver proposal with an
// add-instance-current payload.
//
// SHARED FIELDS across all kinds:
//   confidence  (HIGH | MEDIUM | LOW · matches actionRubric scoring text)
//   rationale   (non-empty string · the chat's explanation for the proposal)
//   source      (discovery-note | ai-proposal · provenance for Mode 1 / Mode 2)
//   targetState (optional · current | desired · only for add-instance-*)
//
// Cross-references:
//   - SPEC §S20.4.1.3 (Rule 4 amendment + tool-use mechanism)
//   - RULES §16 CH38 (structured-action-proposal contract + 7 sub-rules)
//   - services/chatTools.js (proposeAction tool definition · imports ACTION_KINDS)
//   - services/chatService.js (envelope.proposedActions[] capture)
//   - tests/aiEvals/actionGoldenSet.js (eval cases reference these kinds)

import { z } from "zod";

// Canonical list of v1 action kinds. Exported for chatTools.js to use as
// the JSON-Schema enum (single source of truth · no manual duplication
// of the kind list between Zod + JSON Schema).
export const ACTION_KINDS = [
  "add-driver",
  "add-instance-current",
  "add-instance-desired",
  "close-gap"
];

// Confidence levels. Uppercase to match actionRubric.js scoring text.
export const ACTION_CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"];

// Source enum. Kebab-case to match existing aiTag.kind values
// ("skill" / "external-llm") + the framing doc Q3 lock.
export const ACTION_SOURCES = ["discovery-note", "ai-proposal"];

// Per-kind payload schemas. Each .strict() so unknown fields reject.

// add-driver payload
const AddDriverPayloadSchema = z.object({
  businessDriverId: z.string().min(1),
  priority:         z.enum(["High", "Medium", "Low"]).optional(),
  outcomes:         z.array(z.string()).optional()
}).strict();

// add-instance-current payload
const AddInstanceCurrentPayloadSchema = z.object({
  layerId:         z.string().min(1),
  environmentId:   z.string().min(1),
  label:           z.string().min(1),
  vendor:          z.string().optional(),
  vendorGroup:     z.enum(["dell", "nonDell", "custom"]).optional(),
  criticality:     z.enum(["High", "Medium", "Low"]).optional()
}).strict();

// add-instance-desired payload (extends current with disposition + originId)
const AddInstanceDesiredPayloadSchema = z.object({
  layerId:         z.string().min(1),
  environmentId:   z.string().min(1),
  label:           z.string().min(1),
  disposition:     z.enum(["keep", "enhance", "replace", "consolidate", "retire", "introduce"]).optional(),
  originId:        z.string().optional(),
  vendor:          z.string().optional(),
  vendorGroup:     z.enum(["dell", "nonDell", "custom"]).optional()
}).strict();

// close-gap payload
const CloseGapPayloadSchema = z.object({
  gapId:           z.string().min(1),
  status:          z.literal("closed"),
  closeReason:     z.string().optional()
}).strict();

// Discriminated union on `kind` · enforces per-kind payload shape.
// Each branch carries the shared fields (confidence + rationale + source +
// optional targetState).
export const ActionProposalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind:        z.literal("add-driver"),
    payload:     AddDriverPayloadSchema,
    confidence:  z.enum(["HIGH", "MEDIUM", "LOW"]),
    rationale:   z.string().min(1),
    source:      z.enum(["discovery-note", "ai-proposal"]),
    targetState: z.enum(["current", "desired"]).optional()
  }).strict(),
  z.object({
    kind:        z.literal("add-instance-current"),
    payload:     AddInstanceCurrentPayloadSchema,
    confidence:  z.enum(["HIGH", "MEDIUM", "LOW"]),
    rationale:   z.string().min(1),
    source:      z.enum(["discovery-note", "ai-proposal"]),
    targetState: z.enum(["current", "desired"]).optional()
  }).strict(),
  z.object({
    kind:        z.literal("add-instance-desired"),
    payload:     AddInstanceDesiredPayloadSchema,
    confidence:  z.enum(["HIGH", "MEDIUM", "LOW"]),
    rationale:   z.string().min(1),
    source:      z.enum(["discovery-note", "ai-proposal"]),
    targetState: z.enum(["current", "desired"]).optional()
  }).strict(),
  z.object({
    kind:        z.literal("close-gap"),
    payload:     CloseGapPayloadSchema,
    confidence:  z.enum(["HIGH", "MEDIUM", "LOW"]),
    rationale:   z.string().min(1),
    source:      z.enum(["discovery-note", "ai-proposal"]),
    targetState: z.enum(["current", "desired"]).optional()
  }).strict()
]);

// Convenience: array schema for the envelope's `proposedActions[]` field.
// chatService.js uses ActionProposalSchema for per-proposal validation +
// builds the array; this export lets future consumers validate the whole
// list at once.
export const ActionProposalListSchema = z.array(ActionProposalSchema);

// Schema version stamp. Bumps when any field or enum changes.
export const ACTION_PROPOSAL_SCHEMA_VERSION = "1.0.0";

// Helper for chatTools.js: returns a plain JSON-Schema-style enum
// payload-property block hint for the tool's input_schema. Keeps the
// JSON Schema in chatTools.js hand-written but the kind list canonical.
export function getActionKindsEnum() {
  return ACTION_KINDS.slice(); // defensive copy
}
