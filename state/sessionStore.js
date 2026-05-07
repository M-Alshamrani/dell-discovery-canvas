// state/sessionStore.js — single source of truth
//
// v2.4.5 — demo session data moved to `./demoSession.js`. This module
// still re-exports `createDemoSession` so existing callers and tests
// don't break; see SPEC §12 and docs/DEMO_CHANGELOG.md for the rationale.

import { LEGACY_DRIVER_LABEL_TO_ID, ENV_CATALOG, DEFAULT_ENABLED_ENV_IDS } from "../core/config.js";
import { createDemoSession as createDemoSessionImpl } from "./demoSession.js";
import { emitSessionChanged } from "../core/sessionEvents.js";
import { clear as clearAiUndoStack } from "./aiUndoStack.js";
import { markSaved } from "../core/saveStatus.js";
// rc.7 / 7e-8 redo Step B · migrateLegacySession + its
// setPrimaryLayer/deriveProjectId/normalizeServices deps moved to
// state/runtimeMigrate.js (the canonical v2->v3 module). sessionStore
// re-imports + re-exports it for backward-compat with the live `session`
// IIFE below + the diagnostics test fixtures + diagnostics/demoSpec.js
// (those move off in a later step). The previous in-file definition
// is gone; sessionStore no longer imports from interactions/gapsCommands.
import { migrateLegacySession } from "./runtimeMigrate.js";
export { migrateLegacySession } from "./runtimeMigrate.js";

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
    // v2.4.15 . dynamic environment model. session.environments is the
    // user-managed list of envs in scope for this engagement. Each entry:
    //   { id: "coreDc", hidden: false, alias?, location?, sizeKw?, sqm?, tier?, notes? }
    // The id IS the catalog typeId (no UUID layer). Single-instance
    // enforcement: no two entries share the same id. Empty array means
    // "fall back to the default-enabled set" via getActiveEnvironments().
    // Replaces the v2.4.14 environmentAliases map (drained by migrator).
    environments: [],
    instances:  [],
    gaps:       []
  };
}

// rc.7 / 7e-8 redo Step B · `migrateLegacySession` body MOVED to
// state/runtimeMigrate.js (canonical home for v2 migration logic).
// sessionStore re-imports + re-exports it above for backward-compat
// with existing callers (live session IIFE below + diagnostics test
// consumers + diagnostics/demoSpec.js).
//
// Also dropped: the v2 setPrimaryLayer / deriveProjectId / normalizeServices
// imports that the in-file body needed. sessionStore no longer imports
// from interactions/gapsCommands or core/services.

export let session = (function() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var s = migrateLegacySession(JSON.parse(raw));
      // v2.4.13 S2A , populated localStorage means the user has saved
      // data; boot the status indicator at "saved" / "demo" instead of
      // the default "idle" so the topbar reads correctly on first paint.
      try { markSaved({ isDemo: !!s.isDemo }); } catch (e) { /* swallow */ }
      return s;
    }
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

// v2.4.12 · PR1 · ContextView "Save context" handler.
//
// Pre-v2.4.12 bug: ContextView mutated session.customer + session.sessionMeta
// directly from form inputs and then unconditionally flipped isDemo to false
// whenever customer.name had a non-empty value. That broke the workshop
// flow: load a demo session → click Save without changing anything →
// isDemo flipped → demo banner disappeared on the next refresh.
//
// Fix: only flip isDemo when the patch ACTUALLY changes a field. A no-op
// save (clicking Save with the demo's own values intact) preserves the
// demo banner across refresh. The original semantic — "user has taken
// over the session" — is preserved for the legitimate edit path.
//
// patch shape: { customer: {…subset}, sessionMeta: {…subset} }
// `customer.drivers` is excluded — it has its own save flow.
export function applyContextSave(patch) {
  var p = patch || {};
  var changed = false;
  if (p.customer && typeof p.customer === "object") {
    Object.keys(p.customer).forEach(function(k) {
      if (k === "drivers") return;   // drivers have their own save flow
      if (session.customer[k] !== p.customer[k]) {
        session.customer[k] = p.customer[k];
        changed = true;
      }
    });
  }
  if (p.sessionMeta && typeof p.sessionMeta === "object") {
    Object.keys(p.sessionMeta).forEach(function(k) {
      if (session.sessionMeta[k] !== p.sessionMeta[k]) {
        session.sessionMeta[k] = p.sessionMeta[k];
        changed = true;
      }
    });
  }
  // Only flip isDemo when the user has ACTUALLY edited a field. A no-op
  // save preserves the demo banner across refresh.
  if (changed && session.customer.name && session.customer.name.trim()) {
    session.isDemo = false;
  }
  // v2.4.13 S2A . emit BEFORE save so the markSaved snapshot from
  // saveToLocalStorage is the final state of the saveStatus bus
  // (emitSessionChanged calls markSaving as a transient pulse). No-op
  // saves do NOT emit, so the v2.4.12 PR1 isDemo-preservation contract
  // holds.
  if (changed) emitSessionChanged("context-save", "Save context");
  saveToLocalStorage();
  return session;
}

export function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    // v2.4.13 S2A , topbar save indicator. After a successful writeback,
    // mark "saved" (or "demo" when the session is a demo). renderHeaderMeta
    // subscribes via onStatusChange and repaints the secondary line.
    markSaved({ isDemo: !!session.isDemo });
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
    // v2.4.13 S2A , a successful load means the user has saved data on
    // disk; mark the indicator as saved (or demo) so the topbar doesn't
    // boot showing "Saving..." or "Empty canvas" for a populated session.
    markSaved({ isDemo: !!session.isDemo });
    return true;
  } catch(e) {
    console.warn("Load failed:", e);
    return false;
  }
}
