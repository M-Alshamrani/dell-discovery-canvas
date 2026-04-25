// interactions/skillCommands.js — Phase 19b / v2.4.1
//
// Thin adapter that bridges tab views to skillEngine. Each tab passes
// its own tab-specific `context` object; the engine handles rendering
// the template + calling the AI + returning the result.

import { runSkill } from "../services/skillEngine.js";
import { getSkill, skillsForTab } from "../core/skillStore.js";

// Execute a skill by id. Tabs call this from their "Use AI" dropdown.
export async function runSkillById(skillId, session, context) {
  var skill = getSkill(skillId);
  if (!skill) return { ok: false, error: "Skill '" + skillId + "' not found" };
  return await runSkill(skill, session, context);
}

// List helper — tabs use this to render their "Use AI" dropdown.
export { skillsForTab };
