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

// ── Legacy v2.4.0 API preserved so existing ContextView call-sites
// don't break during the migration to the generic dropdown. Resolves
// to the seeded Tab 1 skill at run time. ContextView upgrades to the
// generic UseAiButton in v2.4.1 but this export stays as a safety net.
export async function runDriverQuestionSkill(session, driver) {
  var skills = skillsForTab("context", { onlyDeployed: true });
  var seed = skills.find(function(s) { return s.id === "skill-driver-questions-seed"; })
          || skills[0];
  if (!seed) return { ok: false, error: "No deployed skills on the Context tab" };
  return await runSkill(seed, session, { selectedDriver: driver });
}
