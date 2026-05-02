// state/v3SkillStore.js — v3.1 · SPEC sec S7.1.2 + §S29.3
//
// localStorage-backed storage for user-authored skills. v3.0 stored
// skills under a top-level key; v3.1 same key but the skill SHAPE
// migrated (per SPEC §S29.3) — `skillType`/`entityKind` retired,
// `outputTarget`/`parameters[]` added.
//
// **Migration boundary** (§S29.3): both load + save apply
// migrateSkillToV31 so the storage layer is shape-agnostic. Callers
// that still pass v3.0-shaped drafts (the legacy SkillBuilder UI;
// retired in rc.3 commit #4) continue to work — saveV3Skill auto-
// migrates before validation. Round-trip preserves user intent.
//
// Save path (v3.1):
//   1. Draft passed in (may be v3.0 OR v3.1 shaped)
//   2. Stamp cross-cutting fields if not present
//   3. Run migrateSkillToV31 → uniformly v3.1
//   4. Re-extract bindings[] from promptTemplate (per SPEC sec S7.1.1)
//   5. SkillSchema.parse (now v3.1; no skillType/entityKind correlation)
//   6. Persist to localStorage under STORAGE_KEY
//
// Load path (v3.1):
//   1. Read JSON
//   2. Run migrateSkillToV31 on every entry (idempotent for new ones)
//   3. Return migrated map

import { SkillSchema, migrateSkillToV31 } from "../schema/skill.js";
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
  // Build the candidate carrying any legacy fields the caller passed.
  // migrateSkillToV31 will fold them into v3.1 shape before validation.
  const candidate = {
    id:           draft.id           || generateDeterministicId("skill", "v3-saved", draft.skillId),
    engagementId: draft.engagementId || "00000000-0000-4000-8000-000000000000",
    createdAt:    draft.createdAt    || now,
    updatedAt:    now,
    skillId:              draft.skillId,
    label:                draft.label || "Untitled skill",
    version:              draft.version || "1.0.0",
    promptTemplate:       draft.promptTemplate,
    bindings:             extractBindings(draft.promptTemplate, manifest),
    outputContract:       draft.outputContract || "free-text",
    validatedAgainst:     "3.1",
    outdatedSinceVersion: null,
    // v3.1 fields (default if caller didn't supply):
    outputTarget:         draft.outputTarget || "chat-bubble",
    parameters:           Array.isArray(draft.parameters) ? draft.parameters : [],
    // Legacy fields the migrator folds into parameters[]:
    skillType:            draft.skillType,
    entityKind:           draft.entityKind || null
  };

  // SPEC §S29.3 — migrate legacy shape to v3.1 BEFORE validation.
  // Idempotent for already-v3.1 drafts (the migrator returns unchanged).
  const finalSkill = migrateSkillToV31(candidate);

  // Validate via SkillSchema (v3.1 strict shape).
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
    const all = readAll();
    // SPEC §S29.3 — migrate every entry to v3.1 shape on read.
    // Idempotent for already-v3.1 entries.
    const out = {};
    for (const id of Object.keys(all)) {
      out[id] = migrateSkillToV31(all[id]);
    }
    return out;
  } catch {
    return {};
  }
}

export function loadV3SkillById(skillId) {
  const raw = readAll()[skillId];
  return raw ? migrateSkillToV31(raw) : null;
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
