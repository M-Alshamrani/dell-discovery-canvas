// interactions/aiCommands.js — Phase 19d / v2.4.4
//
// Apply AI proposals to session state. Every mutation MUST go through
// here so the undo stack gets a snapshot and the outputSchema allowlist
// is enforced. Direct session.* writes from UI code are out of bounds.

import { session, saveToLocalStorage } from "../state/sessionStore.js";
import * as undoStack from "../state/aiUndoStack.js";
import { WRITE_RESOLVERS, isWritablePath } from "../core/bindingResolvers.js";
import { emitSessionChanged } from "../core/sessionEvents.js";

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

  var scope = { session: session, context: context || {} };
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

// Apply a single proposal to session state. Pushes an undo snapshot
// BEFORE mutation so a single "↶ Undo" button rolls back one click.
//
// Dispatch:
//   - `session.*` paths → direct setPathFromRoot write
//   - `context.*` paths → lookup resolver in WRITE_RESOLVERS, call with
//     (session, context, value). Resolver finds the target by id and
//     mutates session state in place.
//   - Anything else → reject (path not declared writable).
export function applyProposal(proposal, opts) {
  opts = opts || {};
  var label = opts.label || ("AI: " + (proposal.label || proposal.path));
  if (!isWritablePath(proposal.path)) {
    throw new Error("applyProposal: path '" + proposal.path + "' is not writable (missing WRITE_RESOLVERS entry)");
  }
  undoStack.push(label);
  try {
    if (proposal.path.indexOf("session.") === 0) {
      setPathFromRoot({ session: session }, proposal.path, proposal.after);
    } else {
      var resolver = WRITE_RESOLVERS[proposal.path];
      resolver(session, (opts && opts.context) || {}, proposal.after);
    }
    saveToLocalStorage();
    emitSessionChanged("ai-apply", label);
  } catch (e) {
    // Roll back the snapshot we just pushed since nothing actually
    // changed. Leaving it would create a no-op undo entry.
    undoStack.undoLast();
    throw e;
  }
}

// Apply every proposal in a list under one undo entry.
export function applyAllProposals(proposals, opts) {
  opts = opts || {};
  var context = (opts && opts.context) || {};
  var label = opts.label || ("AI: " + (proposals.length) + " proposals applied");
  undoStack.push(label);
  try {
    proposals.forEach(function(p) {
      if (!isWritablePath(p.path)) return;
      if (p.path.indexOf("session.") === 0) {
        setPathFromRoot({ session: session }, p.path, p.after);
      } else {
        var resolver = WRITE_RESOLVERS[p.path];
        if (resolver) resolver(session, context, p.after);
      }
    });
    saveToLocalStorage();
    emitSessionChanged("ai-apply", label);
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
