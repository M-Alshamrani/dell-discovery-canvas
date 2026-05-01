// state/v3SkillStore.js — v3.0 · SPEC sec S7.1.2
//
// localStorage-backed storage for user-authored skills. v3.0 stores
// skills under a top-level key (independent of the engagement) so they
// survive engagement reset; v3.1 promotes them into engagement.skills
// per SPEC sec S7.1.2.
//
// Save path:
//   1. Caller hands us a skill draft (with crossCuttingFields stamped)
//   2. We extract bindings[] from promptTemplate (one entry per
//      {{path}} placeholder) per SPEC sec S7.1.1
//   3. SkillSchema.parse to enforce shape + skillType/entityKind
//      correlation
//   4. Persist to localStorage under STORAGE_KEY
//
// Load path: read the JSON object, return values

import { SkillSchema } from "../schema/skill.js";
import { generateDeterministicId } from "../migrations/helpers/deterministicId.js";

const STORAGE_KEY = "v3_saved_skills_v1";
const PLACEHOLDER_RE = /\{\{([^{}]+?)\}\}/g;

// extractBindings(template, manifest) — walks {{path}} placeholders in
// the template and emits one binding per unique path. The source field
// is derived from where the path was found in the manifest.
export function extractBindings(template, manifest) {
  const seen = new Set();
  const bindings = [];
  PLACEHOLDER_RE.lastIndex = 0;
  let m;
  while ((m = PLACEHOLDER_RE.exec(template)) !== null) {
    const path = m[1].trim();
    if (seen.has(path)) continue;
    seen.add(path);
    bindings.push({ path, source: deriveSource(path, manifest) });
  }
  return bindings;
}

function deriveSource(path, manifest) {
  // sessionPaths -> "session"
  if ((manifest.sessionPaths || []).some(p => p.path === path)) return "session";
  // Walk byEntityKind for ownPaths/linkedPaths
  for (const kind of Object.keys(manifest.byEntityKind || {})) {
    const entry = manifest.byEntityKind[kind];
    if ((entry.ownPaths || []).some(p => p.path === path))    return "entity";
    if ((entry.linkedPaths || []).some(p => p.path === path)) return "linked";
  }
  return "session"; // default; the save validator will reject anyway if path is unknown
}

// saveV3Skill(draft, opts) -> { ok, skill } | { ok:false, errors }
//   draft.skillId is the user-visible id; if it already exists, this
//   overwrites (treat as update). Caller is responsible for prompting
//   for confirmation.
export function saveV3Skill(draft, opts = {}) {
  const manifest = opts.manifest;
  if (!manifest) return { ok: false, errors: [{ message: "saveV3Skill: manifest is required" }] };

  // Stamp cross-cutting fields if not present.
  const now = new Date().toISOString();
  const finalSkill = {
    id:           draft.id           || generateDeterministicId("skill", "v3-saved", draft.skillId),
    engagementId: draft.engagementId || "00000000-0000-4000-8000-000000000000",
    createdAt:    draft.createdAt    || now,
    updatedAt:    now,
    skillId:              draft.skillId,
    label:                draft.label || "Untitled skill",
    version:              draft.version || "1.0.0",
    skillType:            draft.skillType,
    entityKind:           draft.entityKind || null,
    promptTemplate:       draft.promptTemplate,
    bindings:             extractBindings(draft.promptTemplate, manifest),
    outputContract:       draft.outputContract || "free-text",
    validatedAgainst:     "3.0",
    outdatedSinceVersion: null
  };

  // Validate via SkillSchema (catches skillType/entityKind correlation,
  // empty fields, etc.)
  const result = SkillSchema.safeParse(finalSkill);
  if (!result.success) {
    return {
      ok:     false,
      errors: result.error.issues.map(i => ({
        path:    i.path.join("."),
        message: i.message,
        code:    i.code
      }))
    };
  }

  // Persist
  try {
    const all = readAll();
    all[result.data.skillId] = result.data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    return { ok: false, errors: [{ message: "Persistence failed: " + e.message }] };
  }
  return { ok: true, skill: result.data };
}

export function loadV3Skills() {
  try {
    return readAll();
  } catch {
    return {};
  }
}

export function loadV3SkillById(skillId) {
  return readAll()[skillId] || null;
}

export function deleteV3Skill(skillId) {
  try {
    const all = readAll();
    if (!all[skillId]) return { ok: true };
    delete all[skillId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function readAll() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch {
    return {};
  }
}
