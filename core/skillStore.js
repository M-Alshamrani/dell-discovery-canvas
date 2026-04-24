// core/skillStore.js — Phase 19b / v2.4.1
//
// User-defined AI skills. Each skill is bound to one tab, runs against
// the full session plus a tab-specific context object, and renders its
// result into the tab's right panel. Stored in localStorage under
// `ai_skills_v1`. Shape is intentionally MCP-compatible (name +
// description + input-schema-ish fieldBindings) so we can later expose
// skills as MCP tools to other agents without a rewrite.

const STORAGE_KEY = "ai_skills_v1";

export const SKILL_TABS = ["context", "current", "desired", "gaps", "reporting"];

// v2.4.4 · Unified output-behavior model. Replaces the overlapping
// `outputMode` + `outputSchema.length > 0` dispatch from v2.4.1-v2.4.3.
// See SPEC §12.1 for the full contract.
export const RESPONSE_FORMATS = ["text-brief", "json-scalars", "json-commands"];
export const APPLY_POLICIES   = ["show-only", "confirm-per-field", "confirm-all", "auto"];

// DEPRECATED — retained for the legacy-skill migration in normalizeSkill.
// Removed from new admin-UI in v2.4.4 in favour of applyPolicy.
export const OUTPUT_MODES = ["suggest", "apply-on-confirm", "auto-apply"];
var LEGACY_OUTPUT_MODE_TO_APPLY_POLICY = {
  "suggest":          "show-only",
  "apply-on-confirm": "confirm-per-field",
  "auto-apply":       "auto"
};

function uid() { return "skill-" + Math.random().toString(36).slice(2, 10); }
function now() { return new Date().toISOString(); }

// Seed skill — replaces the hardcoded Tab 1 demo from v2.4.0. Pre-deployed
// so a fresh install behaves identically: opening Tab 1 still shows a
// working AI button.
export function seedSkills() {
  return [
    {
      id:           "skill-driver-questions-seed",
      name:         "Suggest discovery questions",
      description: "Generate 3 tailored customer-discovery questions for the selected strategic driver.",
      tabId:        "context",
      systemPrompt: "You are a senior Dell Technologies presales engineer. Suggest 3 short, open-ended discovery questions a presales would ask in a 30-45 minute workshop. Each question should be 1-2 sentences.",
      promptTemplate: [
        "Customer name: {{session.customer.name}}.",
        "Customer vertical: {{session.customer.vertical}}.",
        "Strategic driver: {{context.selectedDriver.label}}.",
        "Driver hint: {{context.selectedDriver.shortHint}}.",
        "Driver priority for this customer: {{context.selectedDriver.priority}}."
      ].join("\n"),
      responseFormat: "text-brief",
      applyPolicy:    "show-only",
      outputSchema:   [],
      providerKey:    null,
      deployed:     true,
      seed:         true,
      createdAt:    now(),
      updatedAt:    now()
    }
  ];
}

export function loadSkills() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First-run: write the seed skill so users see a working example in
      // the admin panel AND so Tab 1 still works out of the box.
      var seeds = seedSkills();
      saveSkills(seeds);
      return seeds;
    }
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedSkills();
    return parsed.map(normalizeSkill).filter(Boolean);
  } catch (e) {
    return seedSkills();
  }
}

export function saveSkills(skills) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(skills || []));
    return true;
  } catch (e) { return false; }
}

// Narrow shape validation. Unknown fields are preserved so future
// versions can add metadata without breaking older saves.
function normalizeSkill(s) {
  if (!s || typeof s !== "object") return null;
  if (typeof s.name !== "string" || !s.name.trim()) return null;
  if (typeof s.promptTemplate !== "string") return null;
  var tabId = SKILL_TABS.indexOf(s.tabId) >= 0 ? s.tabId : "context";

  // v2.4.4 — output schema (allowlist the AI may propose updates to).
  var outputSchema = Array.isArray(s.outputSchema) ? s.outputSchema.filter(function(e) {
    return e && typeof e.path === "string" && e.path.length > 0;
  }) : [];

  // v2.4.4 — Unified output-behavior model. Migrate legacy outputMode
  // if present; otherwise default sensibly from outputSchema.
  var responseFormat = RESPONSE_FORMATS.indexOf(s.responseFormat) >= 0
    ? s.responseFormat
    : (outputSchema.length > 0 ? "json-scalars" : "text-brief");

  var applyPolicy;
  if (APPLY_POLICIES.indexOf(s.applyPolicy) >= 0) {
    applyPolicy = s.applyPolicy;
  } else if (typeof s.outputMode === "string" && LEGACY_OUTPUT_MODE_TO_APPLY_POLICY[s.outputMode]) {
    applyPolicy = LEGACY_OUTPUT_MODE_TO_APPLY_POLICY[s.outputMode];
  } else {
    applyPolicy = (responseFormat === "json-scalars") ? "confirm-per-field" : "show-only";
  }

  var providerKey = (typeof s.providerKey === "string" && s.providerKey.length > 0)
    ? s.providerKey : null;

  // Pass everything through Object.assign FIRST so unknown fields
  // (forward-compat metadata) survive; then override the known ones
  // with our normalised values.
  return Object.assign({}, s, {
    id:             s.id || uid(),
    tabId:          tabId,
    responseFormat: responseFormat,
    applyPolicy:    applyPolicy,
    outputSchema:   outputSchema,
    providerKey:    providerKey,
    deployed:       s.deployed !== false,
    systemPrompt:   typeof s.systemPrompt === "string" ? s.systemPrompt : "",
    description:    typeof s.description  === "string" ? s.description  : "",
    createdAt:      s.createdAt || now(),
    updatedAt:      s.updatedAt || now()
  });
}

// CRUD helpers used by the admin panel.
export function addSkill(props) {
  var skill = normalizeSkill(Object.assign({ id: uid(), createdAt: now(), updatedAt: now() }, props));
  if (!skill) throw new Error("addSkill: skill is invalid (need name + promptTemplate)");
  var list = loadSkills();
  list.push(skill);
  saveSkills(list);
  return skill;
}

export function updateSkill(id, patch) {
  var list = loadSkills();
  var idx = list.findIndex(function(s) { return s.id === id; });
  if (idx < 0) throw new Error("updateSkill: '" + id + "' not found");
  var next = normalizeSkill(Object.assign({}, list[idx], patch, { id: list[idx].id, updatedAt: now() }));
  if (!next) throw new Error("updateSkill: resulting skill is invalid");
  list[idx] = next;
  saveSkills(list);
  return next;
}

export function deleteSkill(id) {
  var list = loadSkills();
  var next = list.filter(function(s) { return s.id !== id; });
  saveSkills(next);
}

// Query helpers.
export function skillsForTab(tabId, opts) {
  var onlyDeployed = !opts || opts.onlyDeployed !== false;
  return loadSkills().filter(function(s) {
    return s.tabId === tabId && (!onlyDeployed || s.deployed);
  });
}

export function getSkill(id) {
  return loadSkills().find(function(s) { return s.id === id; }) || null;
}
