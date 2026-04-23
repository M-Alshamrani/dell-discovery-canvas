// services/skillEngine.js — Phase 19b / v2.4.1
//
// Template rendering + skill execution. `renderTemplate` resolves
// {{dot.path}} references against a context object; missing paths
// render as empty strings (never throws). `runSkill` composes
// system + rendered-user prompt, routes through aiService using the
// active AI provider, and returns a structured result.

import { loadAiConfig } from "../core/aiConfig.js";
import { chatCompletion } from "./aiService.js";
import { getSystemFooter } from "../core/promptGuards.js";

// {{ one.two.three }} with optional whitespace. No helpers, no
// conditionals — deliberate simplicity. If we need more later, add
// a minimal Handlebars subset rather than pulling in a library.
var TEMPLATE_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

// Pure — exported for tests.
export function renderTemplate(template, scope) {
  if (typeof template !== "string") return "";
  return template.replace(TEMPLATE_RE, function(_, path) {
    var v = resolvePath(scope || {}, path);
    return coerceForLLM(v);
  });
}

// Phase 19c v2 — coerce any bound value into a string the LLM can read.
// Previously we `String(v)`'d everything, which stringified objects as
// "[object Object]" — useless for models. Now:
//   - undefined/null → empty string
//   - primitive     → String(v)
//   - array/object  → pretty-printed JSON (2-space indent, 1200-char cap)
export function coerceForLLM(v) {
  if (v === undefined || v === null) return "";
  var t = typeof v;
  if (t === "string" || t === "number" || t === "boolean") return String(v);
  try {
    var json = JSON.stringify(v, null, 2);
    if (!json) return "";
    // Soft cap so a giant array doesn't blow the prompt budget. 1200 chars
    // is ~300 tokens which is usually plenty to give the LLM a flavour.
    if (json.length > 1200) json = json.slice(0, 1200) + "\n/* …truncated */";
    return json;
  } catch (e) {
    return "[unserializable value]";
  }
}

export function resolvePath(root, path) {
  var segs = String(path).split(".");
  var cur = root;
  for (var i = 0; i < segs.length; i++) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[segs[i]];
  }
  return cur;
}

// Extract every {{path}} reference in a template — used by the builder
// UI (highlighting) and later by the field-pointer mechanic in v2.4.2.
export function extractBindings(template) {
  var out = [];
  var m;
  var re = new RegExp(TEMPLATE_RE.source, "g");
  while ((m = re.exec(template)) !== null) {
    if (out.indexOf(m[1]) < 0) out.push(m[1]);
  }
  return out;
}

// Execute a skill. `context` is tab-specific state (e.g. the currently-
// selected driver on Tab 1, selected gap on Tab 4, etc.) so skill
// templates can reference both full session state AND local selections.
//   Returns { ok: true, text, providerKey, prompt } on success,
//           { ok: false, error, providerKey, prompt } on failure.
export async function runSkill(skill, session, context) {
  if (!skill) return { ok: false, error: "runSkill: missing skill" };

  var scope = { session: session || {}, context: context || {} };
  var userPrompt = renderTemplate(skill.promptTemplate, scope);
  var userSystem = renderTemplate(skill.systemPrompt || "", scope);

  // v2.4.3 · non-removable output-format footer, chosen by the skill's
  // output mode. Appended after the user's system prompt so it's the
  // last thing the model reads for the system role (positional priority
  // helps adherence).
  var footer = getSystemFooter(skill.outputMode || "text-brief");
  var systemPrompt = userSystem
    ? userSystem + "\n\n" + footer
    : footer;

  var config = loadAiConfig();
  var active = config.providers[config.activeProvider];

  var messages = [];
  messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userPrompt });

  try {
    var res = await chatCompletion({
      providerKey: config.activeProvider,
      baseUrl:     active.baseUrl,
      model:       active.model,
      apiKey:      active.apiKey,
      messages:    messages
    });
    return { ok: true, text: res.text, providerKey: config.activeProvider, prompt: userPrompt };
  } catch (e) {
    return { ok: false, error: e.message || String(e), providerKey: config.activeProvider, prompt: userPrompt };
  }
}
