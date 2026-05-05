// core/skillStore.js — Phase 19b / v2.4.1 (seed library extracted in v2.4.5)
//
// User-defined AI skills. Each skill is bound to one tab, runs against
// the full session plus a tab-specific context object, and renders its
// result into the tab's right panel. Stored in localStorage under
// `ai_skills_v1`. Shape is intentionally MCP-compatible (name +
// description + input-schema-ish fieldBindings) so we can later expose
// skills as MCP tools to other agents without a rewrite.
//
// v2.4.5 — seed skill data moved to `core/seedSkills.js`. This module
// still exposes `seedSkills()` via re-export so existing call sites
// don't break.

import { seedSkills as seedSkillsImpl } from "./seedSkills.js";
import { emitSkillsChanged } from "./skillsEvents.js";

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

// v2.4.5 — re-exported from `core/seedSkills.js`. The seed library now
// covers all 5 tabs with text-brief + json-scalars examples and
// exercises the writable fields declared in FIELD_MANIFEST.
export function seedSkills() { return seedSkillsImpl(); }

// rc.5-dev Hotfix #4 (2026-05-05): per user direction "purge all the
// existing skills from old builds for now as we don't need them anymore"
// the auto-install of the v2 seed library on first load is RETIRED.
// Fresh install returns []; users author from scratch via the evolved
// Skill Builder under Settings (SPEC §S35 / RULES §16 CH31). The
// `seedSkills()` export is retained as a reference library so existing
// tests that explicitly import seeds (DS8-DS12 in demoSpec) keep
// working — the change is purely "don't auto-install", not "remove
// the seed records from the codebase". On corrupt-cache or non-array
// localStorage, also return [] (was: return seedSkills()) for
// consistency — empty library is safer than silently dumping seeds
// the user didn't ask for.
export function loadSkills() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSkill).filter(Boolean);
  } catch (e) {
    return [];
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

// CRUD helpers used by the admin panel. v2.4.12 · PR2 · each emits a
// skills-changed event so subscribers (per-tab AI dropdown) re-render
// without requiring a tab switch.
export function addSkill(props) {
  var skill = normalizeSkill(Object.assign({ id: uid(), createdAt: now(), updatedAt: now() }, props));
  if (!skill) throw new Error("addSkill: skill is invalid (need name + promptTemplate)");
  var list = loadSkills();
  list.push(skill);
  saveSkills(list);
  emitSkillsChanged("skill-add", skill.name);
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
  emitSkillsChanged("skill-update", next.name);
  return next;
}

export function deleteSkill(id) {
  var list = loadSkills();
  var hit  = list.find(function(s) { return s.id === id; });
  var next = list.filter(function(s) { return s.id !== id; });
  saveSkills(next);
  emitSkillsChanged("skill-delete", (hit && hit.name) || id);
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
