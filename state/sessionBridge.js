// state/sessionBridge.js
//
// SPEC §S19.3 · co-existence-window bridge.
//
// Subscribes to the v2.x session-changed bus; on every emit (and once
// at module boot), SHALLOW-MERGES the v2 session's customer fields
// into the active v3 engagement. View tabs (once migrated per S19.4)
// read fresh data after every user edit through state/adapter.js.
//
// **Shallow-merge invariant** (BUG-010 fix · 2026-05-02 PM):
// pre-fix, the bridge built a brand-new engagement from a customer-only
// v2→v3 translation and OVERWROTE the active engagement on every emit.
// That clobbered any v3-native data (the rich demo's drivers, envs,
// instances, gaps) on every save / edit / boot. The chat then truthfully
// reported "canvas is empty."
// Fix: the bridge ONLY patches fields it explicitly translates today
// (customer.{name,vertical,region,notes}). Drivers / environments /
// instances / gaps in the active engagement are PRESERVED across emits.
// Each future widening (per S19.4 view migration) extends the patch in
// lockstep — never overwrites anything outside its translation scope.
//
// **Translation policy** (per project_v3_no_file_migration_burden.md):
// the bridge does NOT exercise the full v2→v3 file migrator. The
// migrator is GREEN against synthetic .canvas fixtures and stays in
// the file-load path. The bridge does in-memory translation only of
// the fields v3 AI surfaces actually consume.
//
// One-way flow: v2 session is source-of-truth for the FIELDS THE BRIDGE
// TRANSLATES; v3 engagement is the source-of-truth for everything else.
// Writes from views still hit v2.x action paths today; per S19.4 each
// view migration flips its writes over to commitContextEdit /
// commitInstanceEdit / etc. one commit at a time.
//
// Forbidden:
//   - importing state/adapter.js from here (the bridge sits BENEATH
//     the adapter: view -> adapter -> store <- bridge <- session)
//   - mutating the v2 session
//   - overwriting v3 fields outside the explicit translation scope
//   - calling the v2→v3 migrator from runtime (file-load only)

import { session as liveSession }     from "./sessionStore.js";
import { onSessionChanged }            from "../core/sessionEvents.js";
import { createEmptyEngagement, EngagementSchema } from "../schema/engagement.js";
import { setActiveEngagement, getActiveEngagement } from "./engagementStore.js";
// SPEC §S20.9 + RULES §16 CH9 + BUG-029 fix (rc.6 / 6d) — chat memory is
// per-engagement; on session-reset the v3 engagement-id changes and the
// prior chat transcript MUST drop so the new session opens with a clean
// chat. Without this, +New session leaves stale workshop data leaking
// across customer engagements (the BUG-029 cross-session leak).
import { clearTranscript } from "./chatMemory.js";

let _running   = false;
let _lastError = null;

// Translate the SUBSET of v2 customer fields we know how to map. Returns
// a partial customer patch — { name?, vertical?, region?, notes? } —
// that the bridge merges into the active v3 engagement.customer.
// Anything not present in v2 (or empty string) is omitted so the merge
// preserves the prior v3 value.
function v2CustomerPatch(v2) {
  if (!v2 || !v2.customer || typeof v2.customer !== "object") return null;
  const c = v2.customer;
  const patch = {};
  if (typeof c.name     === "string" && c.name.trim().length     > 0) patch.name     = c.name.trim();
  if (typeof c.vertical === "string" && c.vertical.trim().length > 0) patch.vertical = c.vertical.trim();
  if (typeof c.region   === "string" && c.region.trim().length   > 0) patch.region   = c.region.trim();
  if (typeof c.notes    === "string")                                  patch.notes    = c.notes;
  return Object.keys(patch).length > 0 ? patch : null;
}

async function bridgeOnce(reason) {
  if (_running) return;
  _running = true;
  try {
    const customerPatch = v2CustomerPatch(liveSession);
    const current       = getActiveEngagement();

    // BUG-029 fix (rc.6 / 6d) — on +New session (`session-reset` reason),
    // the user's intent is "start fresh." That means the v3 engagement
    // ALSO resets (new engagement-id) AND the prior chat transcript
    // drops from localStorage. Without this, v2 session resets but v3
    // engagementStore stays on the old engagement-id, so the chat
    // overlay re-loads the OLD transcript on next open — the cross-
    // session leak the user flagged 2026-05-05 office workshop.
    if (reason === "session-reset" && current) {
      const priorEngagementId = current && current.meta && current.meta.engagementId;
      if (priorEngagementId) {
        try { clearTranscript(priorEngagementId); }
        catch (e) { console.warn("[sessionBridge] clearTranscript failed:", e && e.message); }
      }
      // Swap to a fresh empty v3 engagement. The default engagement-id
      // is fixed (zero UUID) per createEmptyEngagementMeta; this is OK
      // because (a) the prior transcript was just dropped, (b) on
      // re-load the bridge will re-seed if needed, (c) the engagement
      // shape is otherwise empty so the chat sees "canvas is empty"
      // until the user adds data.
      setActiveEngagement(createEmptyEngagement());
      _lastError = null;
      return;
    }

    // Boot path: no active engagement yet. Seed from a clean empty v3
    // engagement + apply any v2 customer patch we have. After this the
    // store is never null again.
    if (!current) {
      const seed = createEmptyEngagement();
      const patched = customerPatch
        ? { ...seed, customer: { ...seed.customer, ...customerPatch } }
        : seed;
      const validation = EngagementSchema.safeParse(patched);
      if (validation.success) {
        setActiveEngagement(validation.data);
        _lastError = null;
      } else {
        _lastError = {
          code:    "BRIDGE_VALIDATION_FAILED",
          message: "boot-seed engagement invalid",
          issues:  validation.error.issues
        };
        console.warn("[sessionBridge] boot-seed invalid (" + reason + "); falling back to empty");
        setActiveEngagement(createEmptyEngagement());
      }
      return;
    }

    // Steady-state path: there IS an active v3 engagement (set either by
    // a prior bridge run or by setActiveEngagement directly — e.g. the
    // v3-native demo). Shallow-merge the customer patch (if any) into
    // it; preserve everything else.
    if (!customerPatch) {
      // Nothing to merge — the v2 session has no customer fields populated.
      _lastError = null;
      return;
    }

    const merged = {
      ...current,
      customer: { ...current.customer, ...customerPatch }
    };
    const validation = EngagementSchema.safeParse(merged);
    if (validation.success) {
      setActiveEngagement(validation.data);
      _lastError = null;
    } else {
      // Validation failed (unlikely for a customer-only patch). Don't
      // clobber the active engagement; surface the issue and leave the
      // store at its prior state.
      _lastError = {
        code:    "BRIDGE_MERGE_INVALID",
        message: "customer-patch merge produced invalid engagement",
        issues:  validation.error.issues
      };
      console.warn("[sessionBridge] customer-patch merge invalid (" +
        (reason || "?") + "); active engagement preserved");
    }
  } catch (e) {
    _lastError = { code: "BRIDGE_THREW", message: e && e.message };
    console.error("[sessionBridge] bridge threw:", e);
    // Do NOT clobber the active engagement on a thrown error. Leave the
    // store at its prior state so chat / lab keep their grounding.
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
