// core/taxonomy.js — Phase 17 / v2.4.8
//
// Single source of truth for the 7-term Action taxonomy (user-signed-off
// 2026-04-24). Replaces the ad-hoc DISPOSITION_ACTIONS + ACTION_TO_GAP_TYPE
// that lived in interactions/desiredStateSync.js + the ["rationalize", ...]
// arrays scattered in core/models.js + gapsCommands.js.
//
// Naming note: the JSON field on instances stays `disposition` for
// back-compat (existing sessions in localStorage keep their shape; a
// rename would need a session-schema version bump). Only the UI label
// changes from "Disposition" to "Action". Everything else flows from
// this file.
//
// Each ACTION declares:
//   - id          stored in instance.disposition
//   - label       user-visible string
//   - hint        explanation shown in the Matrix picker
//   - icon        short ASCII glyph used in the Matrix
//   - gapType     which validateGap() gapType an auto-drafted gap gets
//                 (null = no gap is created — e.g. "keep" action)
//   - linksCurrent  rule for how many current-state tiles MUST link
//   - linksDesired  rule for how many desired-state tiles MUST link
//
// linksCurrent / linksDesired semantics:
//   exact integer n        → exactly n link required
//   integer n with +       → at least n links required (e.g. "2+")
//   "optional"             → zero or more permitted; no rule

export var ACTIONS = [
  {
    id: "keep",
    label: "Keep",
    hint: "No change planned. Document for completeness.",
    icon: "=",
    gapType: null,
    linksCurrent: 1,
    linksDesired: 0
  },
  {
    id: "enhance",
    label: "Enhance",
    hint: "Upgrade, expand capacity, or improve in place.",
    icon: "+",
    gapType: "enhance",
    linksCurrent: 1,
    linksDesired: "optional"
  },
  {
    id: "replace",
    label: "Replace",
    hint: "Swap one-for-one for a different platform.",
    icon: "->",
    gapType: "replace",
    linksCurrent: 1,
    linksDesired: 1
  },
  {
    id: "consolidate",
    label: "Consolidate",
    hint: "Merge two or more systems into one.",
    icon: "<<",
    gapType: "consolidate",
    linksCurrent: "2+",
    linksDesired: 1
  },
  {
    id: "retire",
    label: "Retire",
    hint: "Decommission. No replacement planned.",
    icon: "x",
    gapType: "ops",
    linksCurrent: 1,
    linksDesired: 0
  },
  {
    id: "introduce",
    label: "Introduce",
    hint: "Net-new capability. No current item to replace.",
    icon: "*",
    gapType: "introduce",
    linksCurrent: 0,
    linksDesired: 1
  },
  {
    // v2.4.11 · D1 · label changed to "Operational / Services" so the umbrella
    // captures process work AND professional-services work (DR runbooks,
    // training, governance, decommissioning, etc.). The id stays "ops" for
    // back-compat (every saved session uses "ops" already).
    id: "ops",
    label: "Operational / Services",
    hint: "Process or services work — runbooks, training, governance, integration, decommissioning.",
    icon: "~",
    gapType: "ops",
    linksCurrent: "optional",
    linksDesired: "optional"
  }
];

// Convenience lookups.
export var ACTION_IDS = ACTIONS.map(function(a) { return a.id; });

// Gap-type whitelist derived from the taxonomy (drops the legacy
// "rationalize" value). Consumed by validateGap.
export var GAP_TYPES = (function() {
  var seen = {};
  ACTIONS.forEach(function(a) {
    if (a.gapType) seen[a.gapType] = true;
  });
  return Object.keys(seen);
})();

// { actionId → gapType } for auto-draft. Rebuilt from taxonomy so a
// future table edit updates this automatically.
export var ACTION_TO_GAP_TYPE = (function() {
  var m = {};
  ACTIONS.forEach(function(a) { m[a.id] = a.gapType; });
  return m;
})();

// DISPOSITION_ACTIONS shape kept compatible with the old pre-Phase-17
// consumers (Matrix picker). Existing code that imports
// DISPOSITION_ACTIONS from desiredStateSync keeps working; the new
// taxonomy is the source of truth.
export var DISPOSITION_ACTIONS = ACTIONS.map(function(a) {
  return { id: a.id, label: a.label, icon: a.icon, hint: a.hint };
});

export function actionById(id) {
  return ACTIONS.find(function(a) { return a.id === id; }) || null;
}

// v2.4.11 · A3 · derive "does this gapType require ≥1 link on side X?" from
// the taxonomy so UI safety nets (gapsCommands.unlink*) don't drift from the
// table. Returns true when at least one Action with that gapType has a
// non-zero, non-optional rule on the requested side. False otherwise.
export function requiresAtLeastOneCurrent(gapType) {
  return ACTIONS.some(function(a) {
    if (a.gapType !== gapType) return false;
    return _ruleRequiresAtLeastOne(a.linksCurrent);
  });
}
export function requiresAtLeastOneDesired(gapType) {
  return ACTIONS.some(function(a) {
    if (a.gapType !== gapType) return false;
    return _ruleRequiresAtLeastOne(a.linksDesired);
  });
}
function _ruleRequiresAtLeastOne(rule) {
  if (rule === "optional") return false;
  if (typeof rule === "number") return rule >= 1;
  if (typeof rule === "string" && /^\d+\+$/.test(rule)) return parseInt(rule, 10) >= 1;
  return false;
}

// Evaluate a link-count rule against an actual count. Returns
// { ok: true } on pass or { ok: false, message: "..." } on fail.
export function evaluateLinkRule(rule, count, side) {
  if (rule === "optional") return { ok: true };
  if (typeof rule === "number") {
    if (count === rule) return { ok: true };
    return {
      ok: false,
      message: "requires exactly " + rule + " " + side + " link" +
        (rule === 1 ? "" : "s") + " (got " + count + ")"
    };
  }
  // String with "+" suffix (e.g. "2+") → minimum count.
  if (typeof rule === "string" && /^\d+\+$/.test(rule)) {
    var min = parseInt(rule, 10);
    if (count >= min) return { ok: true };
    return {
      ok: false,
      message: "requires at least " + min + " " + side + " link" +
        (min === 1 ? "" : "s") + " (got " + count + ")"
    };
  }
  // Unknown shape — fail-open rather than lock the user out.
  return { ok: true };
}

// v2.4.11 · F1 · workshop-friendly error messages. Maps the raw rule
// failure into a sentence a presales engineer can read mid-conversation
// without parsing taxonomy jargon. Falls back to the raw message for any
// edge case the table doesn't cover.
function friendlyMessage(actionLabel, side, rule, count) {
  // (action, side, rule) → friendly sentence
  if (actionLabel === "Replace") {
    if (side === "current" && count === 0) return "Replace needs the technology being replaced. Link a current-state tile to this gap.";
    if (side === "current" && count > 1)   return "Replace is a one-for-one swap — link only ONE current technology. Use Consolidate if you're merging multiple.";
    if (side === "desired" && count === 0) return "Replace needs the new technology. Link a desired-state tile to this gap.";
    if (side === "desired" && count > 1)   return "Replace pairs ONE current with ONE desired. For multiple desired tiles, split into separate Replace gaps or use Consolidate / Introduce.";
  }
  if (actionLabel === "Enhance") {
    if (side === "current" && count === 0) return "Enhance needs the technology being enhanced. Link a current-state tile to this gap.";
    if (side === "current" && count > 1)   return "Enhance is per-component — link only ONE current technology. Create separate Enhance gaps for each.";
  }
  if (actionLabel === "Consolidate") {
    if (side === "current" && count < 2)   return "Consolidate means merging multiple things into one — link AT LEAST 2 current technologies. (Use Replace if it's one-for-one.)";
    if (side === "desired" && count === 0) return "Consolidate needs the consolidation target. Link the ONE desired-state tile everything is merging into.";
    if (side === "desired" && count > 1)   return "Consolidate merges into ONE desired tile. Pick the consolidation target.";
  }
  if (actionLabel === "Introduce") {
    if (side === "current" && count > 0)   return "Introduce is for net-new capabilities — there's no current technology to link. Use Replace if you're swapping something out.";
    if (side === "desired" && count === 0) return "Introduce needs the new technology being introduced. Link a desired-state tile to this gap.";
    if (side === "desired" && count > 1)   return "Introduce is per-capability — link only ONE desired-state tile. Create separate Introduce gaps for additional capabilities.";
  }
  if (actionLabel === "Keep") {
    if (side === "current" && count === 0) return "Keep needs the technology being kept. Link a current-state tile to this gap.";
    if (side === "desired" && count > 0)   return "Keep means no change — there's no desired-state tile. (If you're upgrading or replacing, change the Action.)";
  }
  if (actionLabel === "Retire") {
    if (side === "current" && count === 0) return "Retire needs the technology being decommissioned. Link a current-state tile to this gap.";
    if (side === "desired" && count > 0)   return "Retire means no replacement — there's no desired-state tile. (If you're replacing it, use Replace.)";
  }
  // Fallback: raw message.
  return actionLabel + " action — " + (side === "current" ? "current-link rule" : "desired-link rule") +
    " not satisfied (got " + count + ").";
}

// Validate that a gap's current/desired link counts match its Action.
// Only runs when a gap has been marked reviewed OR is explicitly
// user-created (both signal "this is the final shape"). Auto-drafted
// gaps (reviewed: false) bypass validation since the user is still
// mid-workflow. Throws with a user-readable message on violation.
//
// v2.4.11 · A9 · for the "Operational / Services" action specifically,
// also require at least one of {linked instance, ≥10 chars of notes}.
// Empty-everything ops gaps are informationless and shouldn't ship.
export function validateActionLinks(gap) {
  if (!gap || typeof gap !== "object") return;
  // Bypass for auto-drafted (unreviewed) gaps — they're mid-workflow.
  if (gap.reviewed === false) return;
  // Find the action whose gapType matches. Multiple actions may share
  // a gapType (e.g. keep + retire + ops all map to "ops"/null); in that
  // case we can't pick a single rule to enforce on link counts.
  var matches = ACTIONS.filter(function(a) { return a.gapType === gap.gapType; });
  var currentCount = Array.isArray(gap.relatedCurrentInstanceIds) ? gap.relatedCurrentInstanceIds.length : 0;
  var desiredCount = Array.isArray(gap.relatedDesiredInstanceIds) ? gap.relatedDesiredInstanceIds.length : 0;

  if (matches.length === 1) {
    var action = matches[0];
    var c = evaluateLinkRule(action.linksCurrent, currentCount, "current");
    if (!c.ok) throw new Error(friendlyMessage(action.label, "current", action.linksCurrent, currentCount));
    var d = evaluateLinkRule(action.linksDesired, desiredCount, "desired");
    if (!d.ok) throw new Error(friendlyMessage(action.label, "desired", action.linksDesired, desiredCount));
  }

  // v2.4.11 · A9 · ops-substance rule. Apply to gapType: "ops" regardless
  // of which Action sourced it (could be `ops` or `retire`). Demands ≥1
  // link OR ≥10 chars of notes (after trim) so empty placeholder ops
  // gaps don't slip into the deliverable.
  if (gap.gapType === "ops") {
    var notesLen = (typeof gap.notes === "string" ? gap.notes.trim().length : 0);
    if (currentCount + desiredCount === 0 && notesLen < 10) {
      throw new Error(
        "Operational / Services gap needs context — link at least one technology (current or desired) " +
        "OR add a short description of the work needed (≥10 characters in notes)."
      );
    }
  }
}
