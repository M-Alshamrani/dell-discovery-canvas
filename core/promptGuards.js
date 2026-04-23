// core/promptGuards.js — Phase 19d.1 / v2.4.3
//
// Mandatory output-format directives appended to every skill's system
// prompt at run time. Non-removable by user; baked into the prompt
// pipeline so every AI response comes back in a shape that's usable
// inside a 30-45 minute Dell presales workshop.
//
// Mode-aware: each output mode gets its own directive block so we can
// add structured-output skills (v2.4.4 JSON apply-on-confirm) and
// action-command skills (v2.4.5+) later without breaking text skills.
//
// The footers are deliberately VISIBLE to the user in the skill builder
// (the help-inline line under the system-prompt field names them) so
// there's no "hidden prompt magic" — transparency beats surprise.

export var OUTPUT_MODES = ["text-brief", "json-schema", "action-commands"];

var TEXT_BRIEF_FOOTER = [
  "OUTPUT REQUIREMENTS (applied automatically to every response — not negotiable):",
  "- Maximum 120 words total.",
  "- Use numbered bullets (1. 2. 3.) or short terse lines — never paragraphs of prose.",
  "- No preamble (\"I'd be happy to...\", \"Great question!\", \"Certainly!\", \"Here are...\").",
  "- No meta-commentary (\"Based on the information provided...\", \"To address your question...\").",
  "- No disclaimer, no hedging, no \"let me know if you need more\".",
  "- Output must be directly pastable into live workshop notes. The Dell presales user will read this during a customer call — brevity and signal density are the whole point."
].join("\n");

// Declared now so the skill schema's outputMode is already mode-aware,
// but these implementations ship in their respective slices.
function notImplemented(mode, slice) {
  return function() {
    throw new Error("promptGuards: output mode '" + mode + "' ships in " + slice);
  };
}

var FOOTERS = {
  "text-brief":       function() { return TEXT_BRIEF_FOOTER; },
  "json-schema":      notImplemented("json-schema",      "v2.4.4 (apply-on-confirm)"),
  "action-commands":  notImplemented("action-commands",  "v2.4.5+ (structured action skills)")
};

// Returns the footer string for a given output mode. Unknown modes fall
// back to text-brief so a legacy skill written before output modes
// existed still gets the safe default.
export function getSystemFooter(outputMode) {
  var fn = FOOTERS[outputMode];
  if (!fn) return TEXT_BRIEF_FOOTER;
  return fn();
}

// For the skill-admin UI: a one-line summary of what the footer
// guarantees, shown under the system-prompt textarea. Keeps the user
// aware without dumping the full footer at them.
export function summaryForMode(outputMode) {
  if (outputMode === "text-brief") {
    return "Plus automatic output-format guards applied at run time: ≤120 words, terse bullets, no preamble, no prose. Non-removable.";
  }
  if (outputMode === "json-schema") {
    return "JSON-schema mode ships in v2.4.4 alongside apply-on-confirm.";
  }
  if (outputMode === "action-commands") {
    return "Action-commands mode ships in v2.4.5+.";
  }
  return "Output-format guards applied at run time.";
}

// ── Refine-to-CARE meta prompt ────────────────────────────────────────
// Sent to the AI by the "Refine prompt" button in the skill builder.
// Rewrites the user's draft skill prompt into a CARE-structured one
// (Context · Ask · Rules · Examples) while preserving {{bindings}}.

export var REFINE_META_SYSTEM =
  "You are a prompt-engineering expert helping a Dell Technologies " +
  "presales engineer design AI skills for customer-discovery workshops. " +
  "Your job is to rewrite a draft skill prompt into the CARE framework. " +
  "CARE stands for Context (one sentence on when this skill is used), " +
  "Ask (the specific request, one sentence, direct), Rules (2-4 short " +
  "bullet rules — output length, tone, exclusions), Examples (one brief " +
  "example output OR input-output pair).";

export var REFINE_META_RULES = [
  "CRITICAL RULES for the rewrite:",
  "- Preserve every {{template.binding}} verbatim — do not modify, remove, or rename.",
  "- Keep the rewritten prompt under 150 words total.",
  "- Focus on Dell presales discovery (not general-purpose assistant patterns).",
  "- Output ONLY the rewritten prompt text. No preamble, no explanation, no markdown heading markers like '# Context'. Just the prompt text ready to paste back into the skill builder."
].join("\n");
