// state/v3SkillStore.js — rc.8.b / R4 (SPEC §S46 + RULES §16 CH36)
//
// localStorage-backed storage for user-authored skills. v3.2 shape per
// SPEC §S46.3 (Seed prompt + Data points + Improved prompt + Output
// format + Mutation policy + Description + Parameters).
//
// **Clean replace** per user direction 2026-05-10 ("(b) replace, drop
// outputContract, outputFormat is canonical"). The v3.0 / v3.1 migration
// helpers (migrateSkillToV31 / migrateV2SkillToV31) are RETIRED in lock-
// step with the schema. No production users; nothing to migrate.
//
// Save path (v3.2):
//   1. Draft passed in (must already be v3.2-shaped from SkillBuilder.js)
//   2. Stamp cross-cutting fields if not present
//   3. SkillSchema.parse (v3.2 strict shape; rejects legacy fields)
//   4. Persist to localStorage under STORAGE_KEY
//
// Load path (v3.2):
//   1. Read JSON
//   2. Return raw map (no migration; clean v3.2 shape only)
//
// [S47.7 amendment 2026-05-12] · system skills distribution model
//   - Skills shipped under catalogs/skills/*.json load as kind="system"
//     at boot via loadSystemSkills().
//   - User skills with the same skillId SHADOW the system version
//     (engineer's saved edits win) but the system version stays in the
//     registry · the launcher renders both, sorted system-first with a
//     "System" chip per R47.7.3.
//   - loadAllV3Skills(): async helper that returns the merged set
//     (user + system) keyed by skillId, with user winning on collision.
//
// Authority: docs/v3.0/SPEC.md §S46.3 + §S47.7 · docs/RULES.md §16 CH36.

import { SkillSchema } from "../schema/skill.js";
import { generateDeterministicId } from "../migrations/helpers/deterministicId.js";

const STORAGE_KEY = "v3_saved_skills_v1";

// SPEC §S47.7.2 - the canonical catalog directory and the list of known
// system skill filenames. New system skills are added here as they're
// authored (the file-ingest-instances.json skill lands in C2).
const SYSTEM_SKILL_DIR = "/catalogs/skills/";
const SYSTEM_SKILL_FILES = [
  "file-ingest-instances.json"   // R47.7.4 (lands in C2)
];

// Fixed defaults stamped on system skills loaded from catalogs/skills/*.
// engagementId is the zero-UUID because system skills are not engagement-
// scoped (R47.7.1 - they ship in the catalog directory, not in a session).
const SYSTEM_ENG_ID = "00000000-0000-4000-8000-000000000000";
const SYSTEM_TS     = "2026-01-01T00:00:00.000Z";

// saveV3Skill(draft, opts) -> { ok, skill } | { ok:false, errors }
//   draft.skillId is the user-visible id; if it already exists, this
//   overwrites (treat as update). Caller is responsible for prompting
//   for confirmation.
//   opts.manifest is currently unused (kept for back-compat with the
//   SkillBuilder.js call site; the v3.2 binding declaration lives in
//   draft.dataPoints[], not derived from a placeholder grep).
export function saveV3Skill(draft, _opts = {}) {
  // Stamp cross-cutting fields if not present.
  const now = new Date().toISOString();
  const candidate = {
    id:           draft.id           || generateDeterministicId("skill", "v3-saved", draft.skillId),
    engagementId: draft.engagementId || "00000000-0000-4000-8000-000000000000",
    createdAt:    draft.createdAt    || now,
    updatedAt:    now,
    skillId:              draft.skillId,
    label:                draft.label || "Untitled skill",
    description:          draft.description || "",
    version:              draft.version || "1.0.0",
    seedPrompt:           draft.seedPrompt || "",
    dataPoints:           Array.isArray(draft.dataPoints) ? draft.dataPoints : [],
    improvedPrompt:       draft.improvedPrompt || "",
    parameters:           Array.isArray(draft.parameters) ? draft.parameters : [],
    outputFormat:         draft.outputFormat || "text",
    mutationPolicy:       draft.mutationPolicy || null,
    // S47 additive deltas (R47.6 + R47.7.1) · pass through draft values
    // so authoring-time choices (e.g. SkillBuilder marks a skill as
    // preview:"per-row" or kind:"system") survive the save round-trip.
    preview:              draft.preview        || "none",
    defaultScope:         draft.defaultScope   || "desired",
    kind:                 draft.kind           || "user",
    validatedAgainst:     "3.2",
    outdatedSinceVersion: null
  };

  // Validate via SkillSchema (v3.2 strict shape).
  const result = SkillSchema.safeParse(candidate);
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

// SPEC §S47.7.2 · system-skills loader hook
//
// loadSystemSkills() -> Promise<{[skillId]: Skill}>
//   Fetches every file in SYSTEM_SKILL_FILES from the catalogs/skills/
//   directory, validates via SkillSchema (with kind forced to "system"),
//   and returns a map keyed by skillId.
//
//   Files that 404 or fail to parse are SILENTLY SKIPPED · the loader
//   is safe to call at any point in the C1->C3 arc (before C2 ships
//   file-ingest-instances.json, the function returns an empty map).
//   This is the only place in the project where a fetch failure is
//   non-fatal: missing system skills degrade the catalog, they do not
//   break the app boot.
//
// Cross-cutting defaults: id is generated deterministically from
//   the system skill's skillId; engagementId is the zero-UUID; the
//   kind discriminator is force-stamped to "system" regardless of
//   what the source JSON declares (the shipping location IS the system
//   contract per R47.7.1).
export async function loadSystemSkills() {
  const out = {};
  for (let i = 0; i < SYSTEM_SKILL_FILES.length; i++) {
    const filename = SYSTEM_SKILL_FILES[i];
    try {
      const res = await fetch(SYSTEM_SKILL_DIR + filename);
      if (!res || !res.ok) continue;
      const raw = await res.json();
      if (!raw || typeof raw !== "object") continue;
      const candidate = Object.assign({}, raw, {
        id:           raw.id           || generateDeterministicId("skill", "system", raw.skillId || filename),
        engagementId: raw.engagementId || SYSTEM_ENG_ID,
        createdAt:    raw.createdAt    || SYSTEM_TS,
        updatedAt:    raw.updatedAt    || SYSTEM_TS,
        kind:         "system"                          // R47.7.1 force-stamp
      });
      const parsed = SkillSchema.safeParse(candidate);
      if (parsed.success) {
        out[parsed.data.skillId] = parsed.data;
      }
    } catch (e) {
      // Non-fatal · log to console for debugging but continue.
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[v3SkillStore] system skill load skipped:", filename, e && e.message);
      }
    }
  }
  return out;
}

// SPEC §S47.7 · merged-load helper for the launcher
//
// loadAllV3Skills() -> Promise<{[skillId]: Skill}>
//   Returns user + system skills merged by skillId. On collision the
//   user-authored skill wins (engineer's saved edits SHADOW the system
//   version per R47.7.2). The launcher should call this at open time
//   and sort with a system-chip per R47.7.3.
export async function loadAllV3Skills() {
  const userSkills   = loadV3Skills();
  const systemSkills = await loadSystemSkills();
  const merged = Object.assign({}, systemSkills);
  Object.keys(userSkills).forEach(function(skillId) {
    merged[skillId] = userSkills[skillId];   // user shadows system
  });
  return merged;
}
