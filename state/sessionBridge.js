// state/sessionBridge.js
//
// SPEC §S19.3 · co-existence-window bridge.
//
// Subscribes to the v2.x session-changed bus; on every emit (and once
// at module boot), translates the live v2 session into a valid v3.0
// engagement and stores it in engagementStore. View tabs (once
// migrated per S19.4) read fresh data after every user edit through
// state/adapter.js.
//
// **Translation policy** (per project_v3_no_file_migration_burden.md):
// the bridge does NOT exercise the full v2→v3 file migrator. The
// migrator is GREEN against synthetic .canvas fixtures and stays in
// the file-load path; the bridge does in-memory translation of the
// fields v3 AI surfaces actually consume. Anything not translated
// surfaces as the empty default from createEmptyEngagement(). Each
// time a v2.x view migrates to the adapter (per S19.4), the bridge
// can be widened in lockstep — only as needed, never speculatively.
//
// One-way flow: v2 session is source-of-truth; v3 engagement is
// derived. Writes from views still hit v2.x action paths today; per
// S19.4 each view migration flips its writes over to commitContextEdit
// / commitInstanceEdit / etc. one commit at a time.
//
// Forbidden:
//   - importing state/adapter.js from here (the bridge sits BENEATH
//     the adapter: view -> adapter -> store <- bridge <- session)
//   - mutating the v2 session
//   - widening this translator to back-port v3 schema choices
//   - calling the v2→v3 migrator from runtime (file-load only)

import { session as liveSession }     from "./sessionStore.js";
import { onSessionChanged }            from "../core/sessionEvents.js";
import { createEmptyEngagement, EngagementSchema } from "../schema/engagement.js";
import { setActiveEngagement }         from "./engagementStore.js";

let _running   = false;
let _lastError = null;

function v2SessionToV3Engagement(v2) {
  // Always start from a known-valid empty v3 engagement so we inherit
  // every required default (engagementId, meta.schemaVersion, empty
  // collections, etc.). Then patch in the v2 fields we explicitly know
  // how to translate. Anything missing stays at v3 default.
  const empty = createEmptyEngagement();
  if (!v2 || typeof v2 !== "object") return empty;

  // Customer: the v3 schema keeps the same field names (name, vertical,
  // region, notes). Skip the patch when v2 customer is empty so the
  // empty default stands.
  let customer = empty.customer;
  if (v2.customer && typeof v2.customer === "object") {
    const c = v2.customer;
    customer = {
      ...empty.customer,
      // Only carry over recognized v3 fields; don't pollute with v2 noise.
      ...(typeof c.name     === "string" && c.name.trim()     ? { name:     c.name.trim() } : {}),
      ...(typeof c.vertical === "string" && c.vertical.trim() ? { vertical: c.vertical.trim() } : {}),
      ...(typeof c.region   === "string" && c.region.trim()   ? { region:   c.region.trim() } : {}),
      ...(typeof c.notes    === "string"                       ? { notes:    c.notes } : {}),
      // engagementId is authoritative on engagement.meta; preserve.
      engagementId: empty.customer.engagementId
    };
  }

  // Future widening lands here, in lockstep with view migrations
  // (S19.4): drivers, environments, instances, gaps.

  return { ...empty, customer };
}

async function bridgeOnce(reason) {
  if (_running) return;
  _running = true;
  try {
    const candidate = v2SessionToV3Engagement(liveSession);
    const validation = EngagementSchema.safeParse(candidate);
    if (validation.success) {
      setActiveEngagement(validation.data);
      _lastError = null;
    } else {
      // Fall back to a fresh empty engagement so getActiveEngagement()
      // is never null after boot. Surface the failure for diagnostics.
      _lastError = {
        code:    "BRIDGE_VALIDATION_FAILED",
        message: "v2 → v3 in-memory translator produced an invalid engagement",
        issues:  validation.error.issues
      };
      console.warn("[sessionBridge] bridge falling back to empty engagement (" +
        (reason || "boot") + "): " + _lastError.message);
      setActiveEngagement(createEmptyEngagement());
    }
  } catch (e) {
    _lastError = { code: "BRIDGE_THREW", message: e && e.message };
    console.error("[sessionBridge] bridge threw:", e);
    try { setActiveEngagement(createEmptyEngagement()); } catch (_e) { /* swallow */ }
  } finally {
    _running = false;
  }
}

// Boot: run once on module load to populate the engagement store.
bridgeOnce("boot");

// Subscribe to v2.x session-changed events.
onSessionChanged(function(reason) {
  bridgeOnce(reason);
});

// _bridgeOnceForTests · explicit handle for diagnostic tests.
export function _bridgeOnceForTests(reason) {
  return bridgeOnce(reason);
}
export function _getLastBridgeError() {
  return _lastError;
}
