// interactions/aiCommands.js -- v3-pure (rc.7 / 7e-5).
//
// Per SPEC §S40 (v3-pure architecture). AI proposals dispatch through
// state/adapter.js + core/bindingResolvers.js applyResolver, which
// routes the write through commitAction so the v3 engagementStore
// commits + emits + persists atomically. The undo stack snapshots the
// v3 engagement object before each write; undoLast restores via
// setActiveEngagement.
//
// v2 paths (session.*) are RETIRED — bindingResolvers.isWritablePath
// rejects them per F40.4.6. Only context.* paths are writable.

import * as undoStack from "../state/aiUndoStack.js";
import { applyResolver, isWritablePath } from "../core/bindingResolvers.js";
import { getActiveEngagement } from "../state/engagementStore.js";
// rc.7 / 7e-8 Step K · core/sessionEvents.js DELETED. The legacy
// emitSessionChanged("ai-apply", label) call was reason-tagging a
// re-render notification that v3-pure engagementStore already emits
// via its subscriber chain on every setActiveEngagement / commitAction
// success. The only side-effect that didn't ride through the v3 path
// was the topbar Saving... pulse — kept by calling markSaving() directly.
import { markSaving } from "../core/saveStatus.js";

// Parse the AI response for a json-scalars skill. Tolerates code-fences
// around the JSON (some models add them despite instructions) and
// handles the "JSON is second half of a wordy response" case by
// extracting the first top-level {...} block found in the text.
//
// v2.4.4: before-value lookup accepts context so `context.*` proposals
// can show the correct "before" value (otherwise it would always be
// undefined because context isn't rooted at session).
export function parseProposals(responseText, outputSchema, context) {
  if (typeof responseText !== "string") return { ok: false, error: "Empty response." };
  var trimmed = responseText.trim();
  // Strip ```json ... ``` or ``` ... ``` fences if present.
  trimmed = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  // Fall back: extract first JSON object from anywhere in the text.
  if (trimmed.charAt(0) !== "{") {
    var m = trimmed.match(/\{[\s\S]*\}/);
    if (m) trimmed = m[0];
  }
  var parsed;
  try { parsed = JSON.parse(trimmed); }
  catch (e) { return { ok: false, error: "Response was not valid JSON: " + (e.message || String(e)) }; }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Response JSON must be an object." };
  }

  var allowedPaths = {};
  (outputSchema || []).forEach(function(e) { allowedPaths[e.path] = e; });

  // v3-pure: scope no longer carries `session`; `context.*` is the
  // canonical AI write namespace. session.* before-value lookups
  // resolve to undefined (acceptable: those paths are non-writable
  // post-7e-5 per F40.4.6).
  var scope = { context: context || {} };
  var proposals = [];
  Object.keys(parsed).forEach(function(key) {
    var schemaEntry = allowedPaths[key];
    if (!schemaEntry) return; // silent drop: not in the declared allowlist
    proposals.push({
      path:  key,
      label: schemaEntry.label || key,
      kind:  schemaEntry.kind  || "scalar",
      before: resolvePathFromRoot(scope, key),
      after:  parsed[key]
    });
  });
  return { ok: true, proposals: proposals };
}

// Apply a single proposal to v3 engagement state (rc.7 / 7e-5 +).
// Pushes a v3 engagement snapshot BEFORE the commit so a single
// "↶ Undo" button rolls back one click. The dispatch routes through
// core/bindingResolvers.applyResolver which wraps the action in
// commitAction -- engagementStore commits + emits + persists in one
// step. emitSessionChanged is fired explicitly with reason "ai-apply"
// AFTER the commit so v2-shape listeners (those that care about the
// reason label, not the underlying mechanism) keep observing AI work
// distinctly from user work.
//
// Path eligibility: only context.* paths registered in WRITE_RESOLVERS
// are writable. session.* paths are RETIRED (F40.4.6). Anything else
// throws.
export function applyProposal(proposal, opts) {
  opts = opts || {};
  var label = opts.label || ("AI: " + (proposal.label || proposal.path));
  if (!isWritablePath(proposal.path)) {
    throw new Error("applyProposal: path '" + proposal.path + "' is not writable (missing WRITE_RESOLVERS entry)");
  }
  // Snapshot the pre-commit engagement so undoLast restores cleanly.
  undoStack.push(label);
  var ctx = (opts && opts.context) || {};
  var result = applyResolver(proposal.path, ctx, proposal.after);
  if (result && result.ok === false) {
    // No state change actually landed; pop the no-op snapshot to keep
    // the undo stack honest.
    undoStack.undoLast();
    var msg = "applyProposal: resolver rejected: ";
    if (result.errors && result.errors[0]) msg += result.errors[0].message;
    else if (result.error) msg += result.error;
    throw new Error(msg);
  }
  markSaving(); // Step K · was: emitSessionChanged("ai-apply", label)
}

// Apply every proposal in a list under one undo entry. Each proposal
// runs through applyResolver -> commitAction so each is its own atomic
// engagement update; the bookend snapshot covers the pre-batch state
// so undoLast restores the entire batch in one click.
export function applyAllProposals(proposals, opts) {
  opts = opts || {};
  var context = (opts && opts.context) || {};
  var label = opts.label || ("AI: " + (proposals.length) + " proposals applied");
  undoStack.push(label);
  try {
    proposals.forEach(function(p) {
      if (!isWritablePath(p.path)) return;
      var r = applyResolver(p.path, context, p.after);
      if (r && r.ok === false) {
        // Surface validation errors but don't throw -- batch apply
        // tolerates per-proposal failures (the batch-bookend snapshot
        // still covers any partial commits the rest of the loop made).
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[applyAllProposals] resolver rejected proposal", p.path, r.errors);
        }
      }
    });
    markSaving(); // Step K · was: emitSessionChanged("ai-apply", label)
  } catch (e) {
    undoStack.undoLast();
    throw e;
  }
}

// ── Path helpers (exported for tests) ──

export function resolvePathFromRoot(root, path) {
  var segs = String(path).split(".");
  var cur = root;
  for (var i = 0; i < segs.length; i++) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[segs[i]];
  }
  return cur;
}

export function setPathFromRoot(root, path, value) {
  var segs = String(path).split(".");
  var cur = root;
  for (var i = 0; i < segs.length - 1; i++) {
    var seg = segs[i];
    if (cur[seg] === null || cur[seg] === undefined) cur[seg] = {};
    cur = cur[seg];
  }
  cur[segs[segs.length - 1]] = value;
}
