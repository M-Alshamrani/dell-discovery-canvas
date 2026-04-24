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

// v2.4.4 — json-schema mode. Caller passes the declared outputSchema so
// the footer can name the allowed paths and types inline. AI MUST return
// strict JSON with only those keys; the response parser rejects anything
// else.
function jsonSchemaFooter(outputSchema) {
  var schemaLines = (outputSchema || []).map(function(entry) {
    var sample = entry.kind === "array" ? "[ ... ]"
               : entry.kind === "number" ? "0"
               : entry.kind === "boolean" ? "true"
               : "\"...\"";
    return "  \"" + entry.path + "\": " + sample + "   // " + (entry.label || entry.path);
  }).join("\n");
  return [
    "OUTPUT REQUIREMENTS (applied automatically — not negotiable):",
    "- Return ONLY a single JSON object. No preamble. No explanation. No code fences.",
    "- The JSON object MUST contain only these keys (omit any you can't confidently fill):",
    "{",
    schemaLines,
    "}",
    "- String values: be pragmatic and brief (ideally under 40 words each). No prose paragraphs.",
    "- If you cannot confidently propose a value for a key, omit the key entirely rather than guess.",
    "- Your entire response must parse as valid JSON on the first attempt."
  ].join("\n");
}

// v2.4.4 stub footer for json-commands so the schema is visible to the
// model (and to anyone inspecting the wire). The response parser
// (skillEngine) refuses to execute commands until v2.4.5 wires
// core/actionCommands.js.
var JSON_COMMANDS_FOOTER_STUB = [
  "OUTPUT REQUIREMENTS (applied automatically — not negotiable):",
  "- Return ONLY a single JSON object with one key: \"commands\".",
  "- Each command is an object: { \"op\": \"<opName>\", ...args }.",
  "- Supported ops (v2.4.5+): updateField, createGap, updateGap,",
  "  deleteGap, linkInstance, setGapDriver.",
  "- Your entire response must parse as valid JSON on the first attempt.",
  "- No preamble, no explanation, no code fences."
].join("\n");

// Declared now so the skill schema's outputMode is already mode-aware.
// Remaining stubs throw with a version pointer so callers fail fast.
function notImplemented(mode, slice) {
  return function() {
    throw new Error("promptGuards: output mode '" + mode + "' ships in " + slice);
  };
}

// Returns the footer string for a given output mode. Unknown modes fall
// back to text-brief so a legacy skill written before output modes
// existed still gets the safe default.
//
// opts may carry { outputSchema } for modes that depend on skill-level
// data (json-schema). The caller from runSkill threads the active skill
// through.
export function getSystemFooter(responseFormat, opts) {
  if (responseFormat === "text-brief" || !responseFormat) return TEXT_BRIEF_FOOTER;
  // v2.4.4 · accept both the unified name 'json-scalars' and the legacy
  // 'json-schema' name for backward-compat with mid-development skills.
  if (responseFormat === "json-scalars" || responseFormat === "json-schema") {
    var schema = (opts && opts.outputSchema) || [];
    if (!Array.isArray(schema) || schema.length === 0) {
      // Caller promised structured output but didn't hand a schema —
      // fall back to text-brief rather than send a skeleton with no keys.
      return TEXT_BRIEF_FOOTER;
    }
    return jsonSchemaFooter(schema);
  }
  if (responseFormat === "json-commands") {
    // v2.4.5+ · footer declared but parser stub lives in skillEngine.
    // Return a real footer so manual tests can see the shape; the
    // parser refuses to execute until v2.4.5 wires the action whitelist.
    return JSON_COMMANDS_FOOTER_STUB;
  }
  if (responseFormat === "action-commands") {
    return notImplemented("action-commands", "v2.4.5+ (structured action skills)")();
  }
  return TEXT_BRIEF_FOOTER;
}

// For the skill-admin UI: a one-line summary of what the footer
// guarantees, shown under the system-prompt textarea. Keeps the user
// aware without dumping the full footer at them.
export function summaryForMode(responseFormat, hasSchema) {
  if ((responseFormat === "json-scalars" || responseFormat === "json-schema") && hasSchema) {
    return "json-scalars mode: AI returns a JSON object with the declared paths; applied per the skill's applyPolicy. Non-removable.";
  }
  if (responseFormat === "text-brief" || !responseFormat) {
    return "text-brief mode: ≤120 words, terse bullets, no preamble, no prose. Non-removable.";
  }
  if (responseFormat === "json-scalars" || responseFormat === "json-schema") {
    return "json-scalars mode (needs an output schema). Until you declare output fields below, text-brief rules apply.";
  }
  if (responseFormat === "json-commands") {
    return "json-commands mode: footer declared, parser ships in v2.4.5+.";
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
