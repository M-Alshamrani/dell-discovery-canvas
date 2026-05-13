// tests/aiEvals/judgePrompt.js
//
// SPEC §S48 (NEW · queued) · Meta-LLM judge prompt builder. Takes a
// golden case + the chat's actual answer and produces the system + user
// message a strong LLM (Claude Sonnet, GPT-4-class, or equivalent) uses
// to score the answer against the rubric.
//
// WHY META-LLM-AS-JUDGE:
//   - Programmatic scoring (regex / keyword match) is too brittle for
//     evaluating natural-language responses across discovery / app-how-to
//     / refusal / multi-turn intents.
//   - A strong LLM with a clear rubric + a structured output schema
//     produces consistent, reproducible scores within ~5% across runs
//     (proven pattern · per Anthropic's evals + OpenAI's evals frameworks).
//   - We can VERSION the judge prompt + the rubric; baseline.json files
//     record which version they were scored against so cross-version
//     comparison is honest.
//
// REAL-LLM ONLY: per feedback_no_mocks.md, the judge is a real LLM call.
// No scripted scoring, no synthetic judge. Costs ~$0.005-0.02 per case
// when judging with Claude Sonnet 4.5; ~zero when judging with the
// user's local proxy.

import { RUBRIC_DIMENSIONS, RUBRIC_VERSION } from "./rubric.js";

export const JUDGE_PROMPT_VERSION = "1.0.0";

// buildJudgeMessages(goldenCase, actualAnswer, providerKind) -> { system, user }
//
//   goldenCase: object from goldenSet.js (id, category, prompt, expected,
//               disallowed, engagementHint, ...)
//   actualAnswer: the chat's response string (markdown-stripped if needed
//                 by the caller — judge sees raw markdown is fine)
//   providerKind: "anthropic" | "openai-compatible" | "gemini" (informs
//                 output-format guidance for the judge model)
//
// Returns { system, user } message strings ready to dispatch to the judge
// LLM via the standard chatCompletion API.
export function buildJudgeMessages(goldenCase, actualAnswer, providerKind) {
  const system = buildJudgeSystem();
  const user   = buildJudgeUserMessage(goldenCase, actualAnswer);
  return { system, user, expectsJsonOutput: true };
}

function buildJudgeSystem() {
  const dimensionDefs = RUBRIC_DIMENSIONS.map(d => {
    const lines = [
      "### " + d.label + " (id: \"" + d.id + "\", scored 0-" + d.weight + ")",
      d.question,
      "",
      "Scoring guide:",
      "- 0: " + d.scoring[0],
      "- 1: " + d.scoring[1],
      "- 2: " + d.scoring[2]
    ];
    return lines.join("\n");
  }).join("\n\n");

  return [
    "== Role ==",
    "You are an AI quality evaluator scoring the Canvas AI Assist chat's responses against a rubric authored by a Dell Technologies presales engineer.",
    "",
    "Your job: read a golden test case (prompt + what a great answer would include) + the chat's actual answer, and score the actual answer against the 5 rubric dimensions below. You return your scores as a single JSON object · no prose, no markdown fences, no commentary.",
    "",
    "== Rubric dimensions (v" + RUBRIC_VERSION + ") ==",
    "",
    dimensionDefs,
    "",
    "== Output format ==",
    "Return ONLY this JSON object (no fences, no prose around it):",
    "",
    "{",
    "  \"caseId\": \"<the case id you were given>\",",
    "  \"scores\": {",
    "    \"grounded\":  0|1|2,",
    "    \"complete\":  0|1|2,",
    "    \"useful\":    0|1|2,",
    "    \"honest\":    0|1|2,",
    "    \"concise\":   0|1|2",
    "  },",
    "  \"total\": <sum of the 5 scores>,",
    "  \"pass\":  <true if total >= 7, else false>,",
    "  \"comments\": {",
    "    \"grounded\":  \"<one short sentence explaining your grounded score>\",",
    "    \"complete\":  \"<one short sentence explaining your complete score>\",",
    "    \"useful\":    \"<one short sentence explaining your useful score>\",",
    "    \"honest\":    \"<one short sentence explaining your honest score>\",",
    "    \"concise\":   \"<one short sentence explaining your concise score>\"",
    "  },",
    "  \"verdict\": \"<one-sentence overall judgment + the single most important improvement the chat could make>\"",
    "}",
    "",
    "== Evaluation principles ==",
    "1. Score the answer on its own merits · don't compare to a 'reference answer' (the engineer wrote a rubric, not a script).",
    "2. Be precise. 0 means the dimension genuinely fails; 1 means it half-works; 2 means it fully delivers. Don't be generous or stingy by habit; calibrate to the rubric definitions.",
    "3. If the chat refused to answer because the data isn't in the engagement, that is GOOD on 'honest' (likely 2) and may still be GOOD on 'useful' (if it offers a path forward).",
    "4. If the chat answered confidently but with fabricated data, that is BAD on 'grounded' (0) regardless of how complete or useful the answer reads.",
    "5. The 'comments' fields are required and inform the engineer where to tune prompts next · keep them specific (cite the exact phrase in the answer that drove the score)."
  ].join("\n");
}

function buildJudgeUserMessage(goldenCase, actualAnswer) {
  const expected = (goldenCase.expected || []).map(e => "  - " + e).join("\n");
  const disallowed = (goldenCase.disallowed || []).map(d => "  - " + d).join("\n");
  const hint = goldenCase.engagementHint || "(no engagement context provided)";

  const sections = [
    "== Case to score ==",
    "",
    "**Case id**: " + goldenCase.id,
    "**Category**: " + goldenCase.category,
    "**Prompt the engineer typed**: " + JSON.stringify(goldenCase.prompt),
    "**Engagement context summary (for your reference; the chat had the full engagement)**:",
    hint,
    ""
  ];

  if (goldenCase.transcriptPrior && goldenCase.transcriptPrior.length > 0) {
    sections.push("**Prior turns before this prompt (multi-turn case)**:");
    goldenCase.transcriptPrior.forEach((t, i) => {
      sections.push("Turn " + (i + 1) + " (" + t.role + "): " + t.content);
    });
    sections.push("");
  }

  if (expected) {
    sections.push("**What a great answer would include (rubric.expected)**:");
    sections.push(expected);
    sections.push("");
  }

  if (disallowed) {
    sections.push("**What a great answer would NOT do (rubric.disallowed)**:");
    sections.push(disallowed);
    sections.push("");
  }

  sections.push("== Actual chat answer ==");
  sections.push("");
  sections.push(actualAnswer);
  sections.push("");
  sections.push("== End of actual answer ==");
  sections.push("");
  sections.push("Score the actual answer against the 5 rubric dimensions and return the JSON object specified in the system prompt.");

  return sections.join("\n");
}
