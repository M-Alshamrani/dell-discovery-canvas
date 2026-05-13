// tests/aiEvals/rubric.js
//
// SPEC §S48 (NEW · queued) · AI quality evaluation rubric for the Canvas
// AI Assist chat. Defines the 5 dimensions a meta-LLM judge scores each
// chat response against, with explicit definitions of what each score
// means. Pure data · no LLM calls in this module.
//
// PRINCIPLES (per the user's 2026-05-13 direction, BUG-062 expansion):
//   - Score what the engineer would actually care about (groundedness +
//     completeness + usefulness + honesty + concision), NOT surface
//     properties like markdown formatting or response length alone.
//   - Each dimension scored 0-2 (fail / partial / full). Total max = 10.
//   - Passing threshold = 7/10 (allows partial credit on 2 dimensions
//     while still requiring the answer be substantively good).
//   - The judge LLM gets these definitions verbatim so its scoring is
//     reproducible across runs.
//
// USAGE:
//   - import { RUBRIC_DIMENSIONS, RUBRIC_PASS_THRESHOLD } from "./rubric.js"
//   - judgePrompt.js consumes RUBRIC_DIMENSIONS to build the scoring prompt
//   - evalRunner.js consumes RUBRIC_PASS_THRESHOLD to determine pass/fail
//
// EVOLUTION: each dimension can be tightened or new dimensions added
// (e.g. "action-correctness" for Sub-arc D). Each change is a versioned
// commit; baseline.json files are tagged with the rubric version they
// were scored against so cross-version comparison is meaningful.

export const RUBRIC_VERSION = "1.0.0";

export const RUBRIC_PASS_THRESHOLD = 7; // out of 10

export const RUBRIC_DIMENSIONS = [
  {
    id: "grounded",
    label: "Grounded",
    weight: 2,
    question: "Does the answer cite real engagement data without fabricating vendors, gaps, instances, dates, or relationships?",
    scoring: {
      0: "Answer fabricates entities. Names a vendor not in the engagement (and not in Dell catalog whitelist). Cites a gap, instance, or date that doesn't exist. Invents a relationship the data doesn't support.",
      1: "Answer is mostly grounded but contains one minor reference that can't be traced to engagement data or a documented Canvas concept. The hallucination is non-critical (e.g. a tangential example).",
      2: "Every claim about the engagement traces back to actual engagement data or Canvas concept documentation. Reference data (Dell product taxonomy, business driver labels) used correctly, not as engagement-specific claims."
    }
  },
  {
    id: "complete",
    label: "Complete",
    weight: 2,
    question: "Does the answer fully address the question, covering the elements a presales engineer would expect?",
    scoring: {
      0: "Answer misses the core ask entirely OR omits 2+ elements explicitly required by the rubric.expected[] list for this case.",
      1: "Answer addresses the core ask but misses 1 element from the rubric.expected[] list, OR addresses it but at insufficient depth (one-line where multi-paragraph was warranted, or vice versa).",
      2: "Answer addresses the core ask + covers all elements in rubric.expected[]. Depth matches the complexity of the question."
    }
  },
  {
    id: "useful",
    label: "Useful (actionable)",
    weight: 2,
    question: "Would a presales engineer drive better workshop conversations or use the app more effectively after reading this answer?",
    scoring: {
      0: "Answer is generic boilerplate · could apply to any customer · provides no concrete next step or app-navigation cue.",
      1: "Answer offers some practical value but stops short of explicit next steps · engineer has to infer what to do next.",
      2: "Answer ends with a concrete next step (a question to ask the customer · a tab/button to click · a driver/gap to add · a decision to make). Engineer knows exactly what to do next."
    }
  },
  {
    id: "honest",
    label: "Honest (acknowledges gaps)",
    weight: 2,
    question: "When the requested information is not in the engagement or in Canvas knowledge, does the answer say so clearly instead of fabricating?",
    scoring: {
      0: "When data is missing, the answer fabricates plausibly-sounding content (a fake number, a guessed vendor, a plausible-but-fake quote) without disclaiming.",
      1: "Answer acknowledges uncertainty but in a way that's easy to miss (single subordinate clause buried mid-paragraph) · honesty is technically present but not transparent.",
      2: "When data is missing, answer says so explicitly and prominently: 'The canvas doesn't include the customer's revenue', or 'I don't have a record of that driver yet'. Offers a path forward (e.g. 'you could add it in Tab 1')."
    }
  },
  {
    id: "concise",
    label: "Right-sized",
    weight: 2,
    question: "Is the response length appropriate for the question (not padded, not under-developed)?",
    scoring: {
      0: "Response is significantly off-size · 3+ paragraphs for a yes/no question, OR 1 sentence for a question requiring a list/walkthrough. Engineer's time is wasted parsing or filling in gaps.",
      1: "Response is somewhat off-size · slightly verbose where terse was better, or vice versa. Useful but readable only after scan-skipping or re-asking.",
      2: "Response is right-sized · terse for simple questions, structured + detailed for complex ones. Markdown used appropriately (bullets/tables for lists; prose for explanations)."
    }
  }
];

export const RUBRIC_TOTAL_MAX = RUBRIC_DIMENSIONS.reduce((sum, d) => sum + d.weight, 0); // 10

// Lookup helpers
export function getDimensionById(id) {
  return RUBRIC_DIMENSIONS.find(d => d.id === id) || null;
}

export function summarizeRubric() {
  return RUBRIC_DIMENSIONS.map(d => "- " + d.label + " (0-" + d.weight + "): " + d.question).join("\n");
}
