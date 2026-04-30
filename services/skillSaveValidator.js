// services/skillSaveValidator.js — v3.0 · SPEC sec S7.3.1
//
// Save-time validation of a skill's promptTemplate against the chip
// manifest. Every {{path}} placeholder must resolve to a known path
// for the skill's (skillType, entityKind) tuple. Unknown paths block
// the save with a structured error envelope listing valid paths.
//
// Two-layer validation per SPEC sec S7:
//   1. SkillSchema parse (already enforced by callers): structural
//      shape + skillType/entityKind correlation (superRefine)
//   2. validateSkillSave (this module): semantic check that every
//      template placeholder names a known manifest path

const PLACEHOLDER_RE = /\{\{([^{}]+?)\}\}/g;

// validateSkillSave(skill, manifest) -> { ok: true } | { ok: false, errors }
// Each error: { path, message, validPaths }
export function validateSkillSave(skill, manifest) {
  const valid = collectValidPaths(skill, manifest);
  const validSet = new Set(valid);

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
        message: "Path '" + path + "' is not in the manifest for (skillType=" +
                 skill.skillType + ", entityKind=" + (skill.entityKind || "null") + ")",
        validPaths: valid.slice()
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

// Wildcard-aware match: "context.driver.linkedGaps[*].description"
// in the manifest matches "context.driver.linkedGaps[*].description"
// in the template literally. Per SPEC sec S7.2.2 the manifest entries
// already include [*] for array paths; the template uses the same
// notation. So strict equality suffices.
function isWildcardMatch(path, validSet) {
  return validSet.has(path);
}

function collectValidPaths(skill, manifest) {
  const paths = [];
  // Session-wide paths are always available
  for (const p of manifest.sessionPaths || []) paths.push(p.path);

  if (skill.skillType === "click-to-run" && skill.entityKind) {
    const kindManifest = manifest.byEntityKind?.[skill.entityKind];
    if (kindManifest) {
      for (const p of kindManifest.ownPaths    || []) paths.push(p.path);
      for (const p of kindManifest.linkedPaths || []) paths.push(p.path);
    }
  }
  return paths;
}
