// tests/aiEvals/actionRubric.js
//
// SPEC §S48.2 (NEW · rc.10 Sub-arc D · LOCKED 2026-05-14) · AI
// action-correctness evaluation rubric for Sub-arc D structured
// action proposals. Defines the 5 dimensions a meta-LLM judge scores
// each emitted action proposal against. Pure data · no LLM calls in
// this module.
//
// ORTHOGONAL TO §S48.1 chat-quality rubric (`./rubric.js`): this rubric
// measures the CORRECTNESS OF EMITTED ACTION PROPOSALS, not the text
// quality of the surrounding chat. Mode 2 chat turns may emit BOTH
// chat text (scored by §S48.1) AND structured proposals (scored here);
// the two harnesses run independently and produce separate baselines.
// Cross-cutting analysis happens post-capture, not at runtime.
//
// PRINCIPLES (per docs/SUB_ARC_D_FRAMING_DECISIONS.md Q5):
//   - Score what the engineer would actually care about when reviewing
//     proposals in the preview modal (does this action make sense?
//     would I apply it? is the chat hedging appropriately?)
//   - Each dimension scored 0-2 (fail / partial / full). Total max = 10.
//   - Passing threshold = 7/10 (consistent with §S48.1).
//   - The judge LLM gets these definitions verbatim so scoring is
//     reproducible across runs.
//
// USAGE:
//   - import { ACTION_RUBRIC_DIMENSIONS, ACTION_RUBRIC_PASS_THRESHOLD }
//     from "./actionRubric.js"
//   - actionJudgePrompt.js consumes ACTION_RUBRIC_DIMENSIONS to build
//     the scoring prompt
//   - evalRunner.js (extended per §S48.3) consumes ACTION_RUBRIC_PASS_
//     THRESHOLD to determine pass/fail when running with
//     `{ harness: "action-correctness" }`.
//
// EVOLUTION: each dimension can be tightened or new dimensions added
// (e.g. action-cascade-safety when flip-disposition lands in v1.5).
// Each change bumps ACTION_RUBRIC_VERSION; baselines tagged with the
// rubric version they were scored against; cross-version baselines are
// reference-only (not directly comparable).

export const ACTION_RUBRIC_VERSION = "1.0.0";

export const ACTION_RUBRIC_PASS_THRESHOLD = 7; // out of 10 (matches §S48.1)

export const ACTION_RUBRIC_DIMENSIONS = [
  {
    id: "actionKind",
    label: "Action-kind correctness",
    weight: 2,
    question: "Did the chat pick the right action kind given the workshop context (add-driver / add-instance-current / add-instance-desired / close-gap)?",
    scoring: {
      0: "Wrong action kind. E.g., chat proposed add-instance-desired when customer described existing infrastructure (should have been add-instance-current). Or chat proposed close-gap on a gap that is still open + actively being worked. Or chat emitted no proposal when one was clearly warranted (this is restraint failure if context was clear).",
      1: "Correct kind but with a sibling-kind option that would have been equally or more appropriate. E.g., proposed add-driver when both add-driver + close-related-gap were warranted. Mostly correct but missed a co-action.",
      2: "Unambiguously correct action kind for the workshop context. The kind chosen is exactly what a presales engineer would do given the same input."
    }
  },
  {
    id: "targetState",
    label: "Target-state correctness",
    weight: 2,
    question: "For instance kinds, did the chat pick the right layer + environment + (for desired) disposition? For close-gap, did it identify the right gap? For add-driver, did it pick the right businessDriverId?",
    scoring: {
      0: "Wrong target. E.g., chat proposed adding instance at layer='compute' when customer described a storage system. Or close-gap targets a gap that doesn't match the customer's stated context. Or add-driver picks an inappropriate businessDriverId.",
      1: "Right target but with a minor sibling miss. E.g., right layer wrong environment (or right environment wrong layer). Or close-gap on the right thread but wrong specific gap among related siblings.",
      2: "Fully correct target on every dimension (layer + environment + state + disposition + or gapId + or businessDriverId as applicable)."
    }
  },
  {
    id: "payloadAccuracy",
    label: "Payload accuracy",
    weight: 2,
    question: "Are the field values (vendor, criticality, urgency, label, vendorGroup, etc.) reasonable given the workshop context and the v3 schema constraints?",
    scoring: {
      0: "Fabricated or contradictory field values. E.g., vendor field set to a vendor not mentioned in the customer conversation. Criticality set to High on a backup tier that the customer described as non-critical. Label that misrepresents what the customer actually said.",
      1: "Mostly correct with one minor mismatch. E.g., vendor + label correct but criticality is a level too high or low compared to what the customer implied. Recoverable by light engineer edit before applying.",
      2: "All required fields populated; all values support the stated workshop context; nothing requires engineer correction before apply."
    }
  },
  {
    id: "confidenceCalibration",
    label: "Confidence calibration",
    weight: 2,
    question: "Does the chat's emitted confidence (HIGH / MEDIUM / LOW per the action-proposal schema) match the actual proposal quality?",
    scoring: {
      0: "Confidence wildly miscalibrated. E.g., chat says HIGH on a proposal that the judge can see is a guess against vague input. Or LOW on a proposal that is unambiguously well-supported. Engineer cannot trust the confidence label as a triage signal.",
      1: "Confidence reasonable but slightly off. E.g., MEDIUM emitted when HIGH was warranted (chat under-confident) or HIGH when MEDIUM was warranted (chat over-confident). The signal is directional but imprecise.",
      2: "Well-calibrated. HIGH on confident proposals · MEDIUM on proposals with one significant uncertainty · LOW on proposals where multiple fields are inferred or customer context is ambiguous. Engineer can rely on the confidence label as a triage signal."
    }
  },
  {
    id: "restraint",
    label: "Restraint when uncertain",
    weight: 2,
    question: "Does the chat correctly NOT propose actions when context is insufficient? Does it surface a clarifying question instead of over-proposing from vague input?",
    scoring: {
      0: "Over-proposes from vague input. E.g., chat emits 6 action proposals from 2 lines of low-signal workshop notes. Or chat fabricates context to justify a proposal that the input did not support.",
      1: "Proposes some appropriate actions but with hedging that should have been a clarifying question. E.g., emits a LOW-confidence proposal when the right answer was 'I need more context before proposing.'",
      2: "Correctly restrained. When input is insufficient, chat emits no proposal AND surfaces a clarifying question in the chat text (or returns an empty proposal list with a note that more context is needed). When input is sufficient, chat proposes appropriately."
    }
  }
];

// Computed: total max points across all dimensions (each weight is the
// max per dim; total max = 10).
export const ACTION_RUBRIC_TOTAL_MAX = ACTION_RUBRIC_DIMENSIONS.reduce((sum, d) => sum + d.weight, 0);

// Lookup helper for the judge prompt builder.
export function findActionDimension(id) {
  return ACTION_RUBRIC_DIMENSIONS.find(d => d.id === id) || null;
}

// Short human-readable summary, used in the panel + console output.
export function formatActionRubricSummary() {
  return ACTION_RUBRIC_DIMENSIONS.map(d => "- " + d.label + " (0-" + d.weight + "): " + d.question).join("\n");
}
