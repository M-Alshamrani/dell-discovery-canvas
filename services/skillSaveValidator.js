// services/skillSaveValidator.js — v3.1 · SPEC sec S7.3.1 + §S29
//
// Save-time validation of a skill's promptTemplate against the chip
// manifest. Every {{path}} placeholder must resolve to a known path
// for the skill's invocation context. v3.1 derives the context from
// `parameters[]` (per SPEC §S29.2): a parameter of type='entityId'
// whose description hints at an entity-kind (e.g. "Pick a gap")
// adds that entity-kind's manifest paths to the valid set.
//
// **Legacy compat (during rc.3 transition)**: callers may still pass
// drafts carrying `skillType` + `entityKind` (the old SkillBuilder UI,
// retired in commit #4). When these fields are present, they take
// precedence over parameters-derivation — preserves old test vectors
// + saves until the UI catches up.
//
// Two-layer validation per SPEC sec S7:
//   1. SkillSchema parse (v3.1 strict)
//   2. validateSkillSave (this module): semantic check that every
//      template placeholder names a known manifest path

const PLACEHOLDER_RE = /\{\{([^{}]+?)\}\}/g;
const ENTITY_KINDS   = ["driver", "currentInstance", "desiredInstance", "gap", "environment", "project"];

// validateSkillSave(skill, manifest) -> { ok: true } | { ok: false, errors }
// Each error: { path, message, validPaths }
export function validateSkillSave(skill, manifest) {
  const valid = collectValidPaths(skill, manifest);
  const validSet = new Set(valid);
  const ctx = describeSkillContext(skill);

  const errors = [];
  const seen = new Set();
  let m;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(skill.promptTemplate)) !== null) {
    const path = m[1].trim();
    if (seen.has(path)) continue;
    seen.add(path);
    if (!validSet.has(path) && !isWildcardMatch(path, validSet)) {
      errors.push({
        path,
        message: "Path '" + path + "' is not in the manifest for (" + ctx + ")",
        validPaths: valid.slice()
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

function isWildcardMatch(path, validSet) {
  return validSet.has(path);
}

// Derive an entity-kind from a v3.1 skill's parameters[] when the
// caller didn't supply legacy fields. Looks for the FIRST parameter
// of type='entityId' whose description names a known entity-kind.
// Returns null when there's no entity-kind context (session-wide skill
// in v3.1 lingo).
function deriveEntityKindFromParameters(parameters) {
  if (!Array.isArray(parameters)) return null;
  for (const p of parameters) {
    if (p && p.type === "entityId" && typeof p.description === "string") {
      // Match "Pick a <kind>" or "<kind>" anywhere in the description.
      for (const kind of ENTITY_KINDS) {
        if (p.description.toLowerCase().includes(kind.toLowerCase())) return kind;
      }
    }
  }
  return null;
}

function collectValidPaths(skill, manifest) {
  const paths = [];
  // Session-wide paths are always available.
  for (const p of manifest.sessionPaths || []) paths.push(p.path);

  // Determine entity-kind context: legacy fields first (if present
  // during rc.3 transition), else derive from v3.1 parameters[].
  let entityKind = null;
  if (skill.skillType === "click-to-run" && skill.entityKind) {
    entityKind = skill.entityKind;
  } else if (Array.isArray(skill.parameters)) {
    entityKind = deriveEntityKindFromParameters(skill.parameters);
  }

  if (entityKind) {
    const kindManifest = manifest.byEntityKind?.[entityKind];
    if (kindManifest) {
      for (const p of kindManifest.ownPaths    || []) paths.push(p.path);
      for (const p of kindManifest.linkedPaths || []) paths.push(p.path);
    }
  }
  return paths;
}

// Diagnostic-friendly context label for error messages.
function describeSkillContext(skill) {
  if (skill.skillType === "click-to-run" && skill.entityKind) {
    return "skillType=click-to-run, entityKind=" + skill.entityKind;
  }
  if (skill.skillType === "session-wide") {
    return "skillType=session-wide, entityKind=null";
  }
  // v3.1 native:
  const derived = deriveEntityKindFromParameters(skill.parameters);
  if (derived) return "parameter entityKind=" + derived;
  return "no entity context (session-wide v3.1)";
}
