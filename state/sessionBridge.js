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
import { onSessionChanged, emitSessionChanged } from "../core/sessionEvents.js";
import { createEmptyEngagement, EngagementSchema } from "../schema/engagement.js";
import { setActiveEngagement, getActiveEngagement, subscribeActiveEngagement } from "./engagementStore.js";
// SPEC §S20.9 + RULES §16 CH9 + BUG-029 fix (rc.6 / 6d) — chat memory is
// per-engagement; on session-reset the v3 engagement-id changes and the
// prior chat transcript MUST drop so the new session opens with a clean
// chat. Without this, +New session leaves stale workshop data leaking
// across customer engagements (the BUG-029 cross-session leak).
import { clearTranscript } from "./chatMemory.js";

let _running   = false;
let _lastError = null;

// rc.7 / 7c · v3→v2 mirror loop guard per SPEC §S19.3.1.
// When the mirror writes to liveSession + emits "v3-mirror" reason,
// bridgeOnce sees the reason and skips the v2→v3 customer merge to
// prevent v2↔v3 ping-pong. Set true while a mirror write is in flight.
let _mirroring = false;

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
  // rc.7 / 7c · v3→v2 mirror loop guard. The mirror emits "v3-mirror"
  // reason after writing to liveSession; bridgeOnce skips the v2→v3
  // customer merge in that case (the merge would be a no-op but the
  // emit-from-merge would re-trigger the mirror in a loop).
  if (reason === "v3-mirror") return;
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

// ─────────────────────────────────────────────────────────────────────
// rc.7 / 7c · v3 → v2 cutover mirror per SPEC §S19.3.1.
//
// Subscribes to engagementStore changes and projects v3
// engagement.drivers (the rc.7 / 7c migrated entity) back into v2
// session.customer.drivers so non-migrated v2.x view tabs keep
// reading fresh data during the cutover window. Retires when all
// drivers consumers have migrated to read from adapter.adaptContextView.
//
// SHAPE TRANSLATION (v3 → v2):
//   v3: engagement.drivers.byId[<uuid>] = { id, engagementId,
//       businessDriverId, priority, outcomes, ownerId, createdAt,
//       updatedAt }
//   v2: session.customer.drivers[*]    = { id (= businessDriverId),
//       priority, outcomes }
//
// LOOP GUARD: writes liveSession + emits session-changed("v3-mirror");
// bridgeOnce sees "v3-mirror" reason and skips the v2→v3 merge so
// there is no v2↔v3 ping-pong. _mirroring flag wraps the in-flight
// write to belt-and-brace against re-entrance during the emit.
//
// IDEMPOTENT: the mirror computes the v2-shape array, JSON-compares
// against the current v2 array, and skips emit when nothing changed.
// This means a v3 update that doesn't touch drivers (e.g. customer
// merge) does not fire a redundant session-changed event.
// ─────────────────────────────────────────────────────────────────────

function _projectV3DriversToV2(eng) {
  if (!eng || !eng.drivers || !Array.isArray(eng.drivers.allIds)) return [];
  const out = [];
  for (const id of eng.drivers.allIds) {
    const d = eng.drivers.byId[id];
    if (!d) continue;
    out.push({
      id:       d.businessDriverId,
      priority: d.priority || "Medium",
      outcomes: typeof d.outcomes === "string" ? d.outcomes : ""
    });
  }
  return out;
}

// rc.7 / 7d-2 · v3 environments → v2 session.environments shape.
// v3 env record: { id (UUID), envCatalogId, catalogVersion, hidden,
//                  alias?, location?, sizeKw?, sqm?, tier?, notes? }
// v2 env entry:  { id (= envCatalogId), hidden, alias?, location?,
//                  sizeKw?, sqm?, tier?, notes? }
// Optional fields are only included when populated, mirroring how
// ContextView's renderEnvDetail deletes undefined keys (so the v2-shape
// after a mirror matches what direct-mutation paths produced).
function _projectV3EnvironmentsToV2(eng) {
  if (!eng || !eng.environments || !Array.isArray(eng.environments.allIds)) return [];
  const out = [];
  for (const id of eng.environments.allIds) {
    const e = eng.environments.byId[id];
    if (!e) continue;
    const entry = { id: e.envCatalogId, hidden: !!e.hidden };
    if (typeof e.alias    === "string" && e.alias.length    > 0) entry.alias    = e.alias;
    if (typeof e.location === "string" && e.location.length > 0) entry.location = e.location;
    if (typeof e.sizeKw   === "number" && !isNaN(e.sizeKw))      entry.sizeKw   = e.sizeKw;
    if (typeof e.sqm      === "number" && !isNaN(e.sqm))         entry.sqm      = e.sqm;
    if (typeof e.tier     === "string" && e.tier.length     > 0) entry.tier     = e.tier;
    if (typeof e.notes    === "string" && e.notes.length    > 0) entry.notes    = e.notes;
    out.push(entry);
  }
  return out;
}

// rc.7 / 7d-2 · v3 customer → v2 session.customer shape (name / vertical /
// region / notes). drivers stays projected by the dedicated drivers
// mirror above. Only the four scalar fields the Save-context form
// edits are mirrored; the v2 customer.drivers array is owned by the
// drivers projection.
function _projectV3CustomerToV2(eng) {
  if (!eng || !eng.customer) return null;
  const c = eng.customer;
  return {
    name:     typeof c.name     === "string" ? c.name     : "",
    vertical: typeof c.vertical === "string" ? c.vertical : "",
    region:   typeof c.region   === "string" ? c.region   : "",
    notes:    typeof c.notes    === "string" ? c.notes    : ""
  };
}

// _lastV3*Projection · the most recent v3-derived projection per
// collection. The mirror compares the NEW v3 projection against this
// (NOT against the current v2 state) so it only fires when v3 actually
// changed. Without this, an emit that didn't touch a collection (e.g.
// a driver edit triggers an emit; the env projection is unchanged but
// would otherwise compare against v2 and clobber v2 envs that have no
// v3 origin yet) would be destructive. Tracking the prior v3
// projection makes the mirror non-destructive: v2 entries with no v3
// origin survive until v3 actually mutates that collection.
let _lastV3DriverProjection   = null;
let _lastV3EnvProjection      = null;
let _lastV3CustomerProjection = null;

function _arrShallowEqual(a, b, keys) {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (!x || !y) return false;
    for (const k of keys) {
      if (x[k] !== y[k]) return false;
    }
  }
  return true;
}

function _v3ToV2Mirror(eng) {
  if (_mirroring) return;
  if (!eng) return;
  if (!liveSession || !liveSession.customer) return;

  // ── drivers ────────────────────────────────────────────────────────
  const drvProjected = _projectV3DriversToV2(eng);
  const drvChanged   = _lastV3DriverProjection === null ||
                       !_arrShallowEqual(drvProjected, _lastV3DriverProjection,
                                         ["id", "priority", "outcomes"]);

  // ── environments ───────────────────────────────────────────────────
  const envProjected = _projectV3EnvironmentsToV2(eng);
  const envChanged   = _lastV3EnvProjection === null ||
                       !_arrShallowEqual(envProjected, _lastV3EnvProjection,
                                         ["id", "hidden", "alias", "location",
                                          "sizeKw", "sqm", "tier", "notes"]);

  // ── customer ───────────────────────────────────────────────────────
  const custProjected = _projectV3CustomerToV2(eng);
  const last          = _lastV3CustomerProjection;
  const custChanged   = last === null || !custProjected || !last
                        ? (last === null && custProjected !== null)
                        : (custProjected.name     !== last.name     ||
                           custProjected.vertical !== last.vertical ||
                           custProjected.region   !== last.region   ||
                           custProjected.notes    !== last.notes);

  if (!drvChanged && !envChanged && !custChanged) return;

  // Bootstrap-empty guard (per-collection) — applies the same principle
  // for envs + customer that drivers got in rc.7 / 7c (the
  // _lastV3*Projection===null + v3-empty case): on the very first emit
  // when v3 hasn't been written to yet, skip the projection so v2 data
  // populated outside the v3 path (legacy tests, file-load before v3
  // catches up) survives. After any first non-empty projection, the
  // baseline records the change and subsequent v3-becoming-empty-again
  // (e.g. T1.9 remove-driver) propagates normally.
  const drvBootstrapEmpty = _lastV3DriverProjection === null && drvProjected.length === 0;
  const envBootstrapEmpty = _lastV3EnvProjection    === null && envProjected.length === 0;
  const custBootstrapEmpty = _lastV3CustomerProjection === null && custProjected !== null &&
                             custProjected.name.length     === 0 &&
                             custProjected.vertical.length === 0 &&
                             custProjected.region.length   === 0 &&
                             custProjected.notes.length    === 0;

  // Drop bootstrap-empty channels from the work set; if all three are
  // bootstrap-empty there's nothing to mirror but we still want to
  // record the baseline so the next non-bootstrap emit is the source
  // of the first projection.
  let didWrite = false;

  _mirroring = true;
  try {
    if (drvChanged) {
      if (!drvBootstrapEmpty) {
        liveSession.customer.drivers = drvProjected;
        didWrite = true;
      }
      _lastV3DriverProjection = drvProjected;
    }
    if (envChanged) {
      if (!envBootstrapEmpty) {
        liveSession.environments = envProjected;
        didWrite = true;
      }
      _lastV3EnvProjection = envProjected;
    }
    if (custChanged && custProjected) {
      if (!custBootstrapEmpty) {
        liveSession.customer.name     = custProjected.name;
        liveSession.customer.vertical = custProjected.vertical;
        liveSession.customer.region   = custProjected.region;
        liveSession.customer.notes    = custProjected.notes;
        didWrite = true;
      }
      _lastV3CustomerProjection = custProjected;
    }
    if (didWrite) emitSessionChanged("v3-mirror");
  } catch (e) {
    console.warn("[sessionBridge] v3→v2 mirror failed:", e && e.message);
  } finally {
    _mirroring = false;
  }
}

subscribeActiveEngagement(_v3ToV2Mirror);

// _rearmMirrorForTests · re-subscribe the v3→v2 mirror after a
// _resetForTests() call clears engagementStore subscriptions. Test-only;
// production code must NEVER call this (the module-load self-subscribe
// covers the normal lifecycle). T1.8 / T1.9 (post-rc.7/7c) + T1.* env
// + customer migration tests (post-rc.7/7d-2) call this after
// _resetEngagementStoreForTests() so the mirror remains live.
export function _rearmMirrorForTests() {
  subscribeActiveEngagement(_v3ToV2Mirror);
}
