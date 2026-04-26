// core/skillsEvents.js — Phase 19l / v2.4.12
//
// Tiny pub/sub for "skill registry has changed" notifications. The per-tab
// AI-skill dropdown subscribes so it auto-refreshes when skills are added,
// updated, deployed/undeployed, or deleted in the Skill Builder admin UI.
// Without this bus, the dropdown only re-derives on tab activation —
// users had to manually switch tabs to see new skills.
//
// Mirrors the shape of `core/sessionEvents.js` deliberately:
//   - one bus per concern (sessions vs skills are unrelated lifecycles)
//   - one well-known reason set documented at the emit call site
//   - never let a handler throw out of the bus
//
// Wired callers (filled in during implementation phase):
//   skillStore.addSkill     → emit("skill-add",      <name>)
//   skillStore.updateSkill  → emit("skill-update",   <name>)
//   skillStore.deleteSkill  → emit("skill-delete",   <id>)
//   skillStore.saveSkills   → emit("skill-replace-all", "")  (seed reset, import)

var listeners = [];

// Subscribe to skills-changed events. Returns an unsubscribe function.
export function onSkillsChanged(fn) {
  if (typeof fn !== "function") return function() {};
  listeners.push(fn);
  return function unsubscribe() {
    listeners = listeners.filter(function(l) { return l !== fn; });
  };
}

// Emit a skills-changed event. `reason` identifies the caller for
// debugging/telemetry; `label` is a human-readable identifier (e.g. the
// skill name) so a future subscriber could flash a toast.
export function emitSkillsChanged(reason, label) {
  var evt = { reason: reason || "unknown", label: label || "" };
  listeners.slice().forEach(function(fn) {
    try { fn(evt); }
    catch (e) { /* never let a handler throw out of the bus */ }
  });
}

// Test-only reset.
export function _resetForTests() { listeners = []; }
