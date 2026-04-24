// state/sessionStore.js — single source of truth
//
// v2.4.5 — demo session data moved to `./demoSession.js`. This module
// still re-exports `createDemoSession` so existing callers and tests
// don't break; see SPEC §12 and docs/DEMO_CHANGELOG.md for the rationale.

import { LEGACY_DRIVER_LABEL_TO_ID } from "../core/config.js";
import { createDemoSession as createDemoSessionImpl } from "./demoSession.js";
import { emitSessionChanged } from "../core/sessionEvents.js";
import { clear as clearAiUndoStack } from "./aiUndoStack.js";

export { createDemoSession } from "./demoSession.js";

const STORAGE_KEY = "dell_discovery_v1";

export function createEmptySession() {
  return {
    sessionId:    "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    isDemo:       false,
    customer: {
      name:           "",
      vertical:       "",
      segment:        "",
      industry:       "",
      region:         "",
      drivers:        []
    },
    sessionMeta: {
      date:          new Date().toISOString().slice(0, 10),
      presalesOwner: "",
      status:        "Draft",
      version:       "2.0"
    },
    instances:  [],
    gaps:       []
  };
}

/**
 * Migrate a raw session object from any pre-v2 shape into the current shape.
 * Pure function — does not touch the live `session` export.
 * Rules (mirrors SPEC §2.5):
 *   - Ensure customer.{name,vertical,segment,industry,region} all exist (empty strings ok).
 *   - If customer.drivers is missing, derive from customer.primaryDriver + session.businessOutcomes
 *     via LEGACY_DRIVER_LABEL_TO_ID. Unknown / empty labels → drivers = [].
 *   - Always strip legacy primaryDriver and businessOutcomes keys.
 *   - instances[*].timeline preserved on read; dropped by next save's JSON round-trip only
 *     because views will no longer emit it. (We do not forcibly delete here.)
 *   - gaps[*].driverId not auto-populated here; renderer derives at display time.
 *   - Ensure arrays for instances and gaps.
 *   - Ensure sessionMeta + sessionId exist.
 */
export function migrateLegacySession(raw) {
  var s = raw || {};
  if (!s.customer || typeof s.customer !== "object") s.customer = {};
  var c = s.customer;

  if (typeof c.name     === "undefined") c.name     = "";
  if (typeof c.vertical === "undefined") c.vertical = c.segment || c.industry || "";
  if (typeof c.segment  === "undefined") c.segment  = "";
  if (typeof c.industry === "undefined") c.industry = "";
  if (typeof c.region   === "undefined") c.region   = "";

  if (!Array.isArray(c.drivers)) {
    var legacyLabel    = c.primaryDriver;
    var legacyOutcomes = s.businessOutcomes;
    if (legacyLabel && LEGACY_DRIVER_LABEL_TO_ID[legacyLabel]) {
      c.drivers = [{
        id:       LEGACY_DRIVER_LABEL_TO_ID[legacyLabel],
        priority: "High",
        outcomes: legacyOutcomes || ""
      }];
    } else {
      c.drivers = [];
    }
  }
  delete c.primaryDriver;
  delete s.businessOutcomes;

  if (!Array.isArray(s.instances)) s.instances = [];
  if (!Array.isArray(s.gaps))      s.gaps      = [];

  // v2.1 rule 6: default `reviewed` on any gap missing it.
  //   auto-drafted (has linked desired tiles) → reviewed: false (surfaces the dot)
  //   everything else                         → reviewed: true
  s.gaps.forEach(function(g) {
    if (typeof g.reviewed !== "boolean") {
      g.reviewed = !((g.relatedDesiredInstanceIds || []).length > 0);
    }
  });

  if (!s.sessionMeta || typeof s.sessionMeta !== "object") {
    s.sessionMeta = {
      date:          new Date().toISOString().slice(0, 10),
      presalesOwner: "",
      status:        "Draft",
      version:       "2.0"
    };
  }

  if (!s.sessionId) {
    s.sessionId = "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  }

  return s;
}

export let session = (function() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateLegacySession(JSON.parse(raw));
  } catch(e) {}
  // v2.4.7 · empty canvas is the honest default for a brand-new user.
  // The old "fall back to demo" behaviour on first run mis-signalled
  // "this is your session" with someone else's data; users had to hunt
  // for the Load-demo or New-session button to understand what they
  // were looking at. Demo is still one click away via ContextView's
  // welcome card + the footer "↺ Load demo" button.
  return migrateLegacySession(createEmptySession());
})();

// True iff the user hasn't started authoring anything yet. Pure
// predicate — UI code uses this to decide whether to surface the
// fresh-start welcome card. Kept here so every caller has one
// definition of "is this a blank canvas?" and nobody reimplements it
// slightly differently in each view.
//
// Argument semantics:
//   isFreshSession()          — uses the module's live session
//   isFreshSession(null)      — defensive: treated as fresh
//   isFreshSession(someObj)   — evaluates the passed-in shape
export function isFreshSession(s) {
  var x = (arguments.length === 0) ? session : s;
  if (!x || typeof x !== "object") return true;
  var c = x.customer || {};
  if (c.name && c.name.trim().length > 0) return false;
  if (Array.isArray(c.drivers) && c.drivers.length > 0) return false;
  if (Array.isArray(x.instances) && x.instances.length > 0) return false;
  if (Array.isArray(x.gaps) && x.gaps.length > 0) return false;
  return true;
}

export function resetSession() {
  var fresh = createEmptySession();
  Object.keys(session).forEach(function(k) { delete session[k]; });
  Object.assign(session, fresh);
  // v2.4.5 — a deliberate "start over" invalidates the AI undo history
  // (nothing to roll back into now). Emit so views re-render from empty.
  clearAiUndoStack();
  emitSessionChanged("session-reset", "New session");
}

export function resetToDemo() {
  var demo = migrateLegacySession(createDemoSessionImpl());
  Object.keys(session).forEach(function(k) { delete session[k]; });
  Object.assign(session, demo);
  clearAiUndoStack();
  emitSessionChanged("session-demo", "Loaded demo session");
}

// v2.4.4 — Replace live session state with a supplied snapshot (e.g. an
// undo-stack restore). Keeps the module-scoped `session` identity so
// every importer continues to see live data without re-importing.
// v2.4.5 — does NOT emit session-changed itself; the CALLER decides
// whether to emit (undo emits with reason="ai-undo", an import flow
// would emit with reason="session-replace", etc.). This keeps the helper
// usable from the undo stack without causing double-notifications.
export function replaceSession(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  Object.keys(session).forEach(function(k) { delete session[k]; });
  Object.assign(session, snapshot);
}

export function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch(e) {
    console.warn("Save failed:", e);
    return false;
  }
}

export function loadFromLocalStorage() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    var migrated = migrateLegacySession(JSON.parse(raw));
    Object.keys(session).forEach(function(k) { delete session[k]; });
    Object.assign(session, migrated);
    return true;
  } catch(e) {
    console.warn("Load failed:", e);
    return false;
  }
}
