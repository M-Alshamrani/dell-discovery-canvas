// tests/aiEvals/actionJudgePrompt.js
//
// SPEC §S48.2 (NEW · rc.10 Sub-arc D) · meta-LLM judge prompt builder
// for scoring action proposals against the 5-dim action-correctness
// rubric. Mirrors `./judgePrompt.js` shape but operates on PROPOSALS
// (structured action objects) rather than CHAT TEXT.
//
// CONTRACT (per V-AI-EVAL-10):
//   buildActionJudgeMessages(case, proposals, providerKind) returns
//   { system: string, user: string, expectsJsonOutput: true }
//
// The judge LLM is given:
//   - The case context (prompt + engagement state + engagement hint +
//     expected proposals + rubric anchors)
//   - The chat's emitted proposals (the actual ActionProposal[] the
//     chat returned; may be empty for restraint cases)
//   - The 5-dim rubric definitions verbatim
//
// The judge returns JSON shaped as:
//   {
//     dimensions: { actionKind: 2, targetState: 1, payloadAccuracy: 2,
//                   confidenceCalibration: 2, restraint: 2 },
//     total: 9,
//     pass: true,
//     verdict: "Brief 1-3 sentence explanation of the scoring + the
//              strongest improvement opportunity for the chat."
//   }
//
// For cases with MULTIPLE emitted proposals, the judge scores each
// proposal independently; the aggregate is the average of per-proposal
// totals. For restraint cases (expectedProposals===[]), the judge
// scores the overall response (did the chat correctly NOT propose?).

import { ACTION_RUBRIC_DIMENSIONS, ACTION_RUBRIC_VERSION, ACTION_RUBRIC_PASS_THRESHOLD, ACTION_RUBRIC_TOTAL_MAX } from "./actionRubric.js";

export const ACTION_JUDGE_PROMPT_VERSION = "1.0.0";

const SYSTEM_INTRO = [
  "You are a senior presales engineering reviewer scoring AI-emitted",
  "action proposals against a 5-dimension rubric. You will see:",
  "",
  "1. A workshop scenario (the prompt the chat received + the engagement",
  "   state it had access to + any test-harness context hints).",
  "2. The list of expected proposals (what a correct response would look",
  "   like for this case · may be empty for 'restraint' cases where the",
  "   chat should NOT propose anything).",
  "3. The chat's actually emitted proposals.",
  "4. The 5 rubric dimensions with explicit 0/1/2 scoring criteria.",
  "",
  "Score the chat's response against each rubric dimension. Be strict",
  "but fair: 2 means unambiguously correct, 1 means partially correct",
  "with a noted gap, 0 means fails the dimension. Total = sum of",
  "dimension scores (max " + ACTION_RUBRIC_TOTAL_MAX + ").",
  "",
  "Pass threshold = " + ACTION_RUBRIC_PASS_THRESHOLD + "/" + ACTION_RUBRIC_TOTAL_MAX + " (the engineer would accept the response with at most light review).",
  "",
  "Important reminders:",
  "- For restraint cases (no expected proposals), score how well the chat",
  "  RESTRAINED. Emitting any proposal is a restraint failure unless the",
  "  input had a clearly inferrable single high-confidence action.",
  "- For multi-proposal cases, score each proposal individually and",
  "  report the average rounded to nearest integer for each dimension.",
  "- Be specific in the verdict text: name the dimension that scored",
  "  lowest and what would have to change to score higher.",
  "",
  "Return ONLY a valid JSON object (no markdown fences, no commentary",
  "outside the JSON). Schema:",
  "",
  "{",
  '  "dimensions": {',
  '    "actionKind": 0|1|2,',
  '    "targetState": 0|1|2,',
  '    "payloadAccuracy": 0|1|2,',
  '    "confidenceCalibration": 0|1|2,',
  '    "restraint": 0|1|2',
  "  },",
  '  "total": <sum of dimensions>,',
  '  "pass": <total >= ' + ACTION_RUBRIC_PASS_THRESHOLD + ">,",
  '  "verdict": "<1-3 sentence explanation>"',
  "}"
].join("\n");

function formatProposalForJudge(p, i) {
  if (!p || typeof p !== "object") return "(proposal #" + i + " is malformed: " + JSON.stringify(p) + ")";
  return [
    "Proposal #" + (i + 1) + ":",
    "  kind: " + p.kind,
    "  confidence: " + p.confidence,
    p.targetState ? "  targetState: " + p.targetState : null,
    p.source ? "  source: " + p.source : null,
    "  payload: " + JSON.stringify(p.payload, null, 2).split("\n").map((l, idx) => idx === 0 ? l : "    " + l).join("\n"),
    "  rationale: " + (p.rationale || "(none provided)")
  ].filter(Boolean).join("\n");
}

function formatExpectedProposalSummary(p, i) {
  if (!p || typeof p !== "object") return "  - (expected proposal #" + (i + 1) + " malformed)";
  const bits = [
    "kind=" + p.kind,
    p.targetState ? "targetState=" + p.targetState : null,
    p.confidence ? "confidence~=" + p.confidence : null,
    "payload-anchor=" + JSON.stringify(p.payload || {})
  ].filter(Boolean);
  return "  - " + bits.join(" · ");
}

function buildRubricDimensionsBlock() {
  return ACTION_RUBRIC_DIMENSIONS.map(d => {
    return [
      "## " + d.label + " (id: " + d.id + ", weight " + d.weight + ")",
      "Question: " + d.question,
      "Scoring:",
      "  0: " + d.scoring[0],
      "  1: " + d.scoring[1],
      "  2: " + d.scoring[2]
    ].join("\n");
  }).join("\n\n");
}

export function buildActionJudgeMessages(testCase, emittedProposals, providerKind) {
  const expectedList = Array.isArray(testCase.expectedProposals) && testCase.expectedProposals.length > 0
    ? testCase.expectedProposals.map(formatExpectedProposalSummary).join("\n")
    : "  (none · this is a RESTRAINT case · the chat should NOT propose anything; it should surface a clarifying question or note that more context is needed)";

  const emittedList = Array.isArray(emittedProposals) && emittedProposals.length > 0
    ? emittedProposals.map(formatProposalForJudge).join("\n\n")
    : "(chat emitted no proposals)";

  const rubricAnchors = testCase.rubricAnchors && Object.keys(testCase.rubricAnchors).length > 0
    ? Object.entries(testCase.rubricAnchors)
        .map(([dim, anchor]) => "  - " + dim + ": " + anchor)
        .join("\n")
    : "  (no per-case rubric anchors provided; use the rubric definitions above as the scoring reference)";

  const userBody = [
    "# Case to score",
    "",
    "Case id: " + testCase.id,
    "Category: " + testCase.category,
    "Engagement state at chat call: " + testCase.engagementState,
    testCase.engagementHint ? "Engagement hint: " + testCase.engagementHint : "",
    "",
    "## Chat input (the prompt the chat received)",
    "",
    testCase.prompt,
    "",
    "## Expected proposals (what a correct response looks like)",
    "",
    expectedList,
    "",
    "## Chat's emitted proposals",
    "",
    emittedList,
    "",
    "## Rubric dimensions",
    "",
    buildRubricDimensionsBlock(),
    "",
    "## Per-case rubric anchors",
    "",
    rubricAnchors,
    "",
    "Return your score as JSON per the schema in the system message."
  ].filter(Boolean).join("\n");

  return {
    system: SYSTEM_INTRO,
    user: userBody,
    expectsJsonOutput: true
  };
}
