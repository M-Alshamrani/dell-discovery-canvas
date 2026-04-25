# Version compatibility matrix

Which session-shape versions load cleanly into which app versions.

The migrator (`state/sessionStore.js migrateLegacySession`) is **idempotent and additive** — it can read sessions from any prior shape and bring them up to current. Forward-compat is guaranteed; backward-compat is best-effort.

**Authoritative for the migration rules**: [docs/RULES.md §10](../RULES.md) M1-M10.

---

## Compat matrix

Rows = the session-shape `sessionMeta.version` field's value (or absence).
Columns = the app tag the user is loading the session into.

Cells:
- ✅ **Loads cleanly** — migrator runs, no data loss, all features work.
- ⚠ **Migrator-required** — needs `migrateLegacySession` to coerce; some informational warnings logged.
- ❌ **Incompatible** — would fail validation; needs manual intervention.
- — Combination doesn't exist in the wild.

| sessionMeta.version | v2.0 | v2.1 | v2.2.x | v2.3.x | v2.4.0–v2.4.4 | v2.4.5–v2.4.7 | v2.4.8–v2.4.10 | v2.4.11+ (incl. .dNN) |
|---|---|---|---|---|---|---|---|---|
| (absent — pre-v2.0) | ⚠ M1+M2 | ⚠ M1+M2+M3 | ⚠ + M8+M9 | ⚠ | ⚠ | ⚠ | ⚠ + M4+M5 | ⚠ + M6+M7+M10 |
| `"2.0"` | ✅ | ⚠ M3 | ⚠ + M8+M9 | ⚠ | ⚠ | ⚠ | ⚠ + M4+M5 | ⚠ + M6+M7+M10 |
| `"2.0"` (with rationalize values) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠ M4+M5 | ⚠ M4+M5+M6+M7+M10 |
| `"2.0"` (with no driverId on gaps) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## What each migrator rule does

| Rule | Purpose | Idempotent? |
|---|---|---|
| **M1** | Derive `customer.drivers[]` from legacy `customer.primaryDriver` + `businessOutcomes` | yes |
| **M2** | Strip legacy `customer.primaryDriver` and root `businessOutcomes` after migration | yes |
| **M3** | Default `gap.reviewed`: `false` if gap has linked desired (auto-drafted), `true` otherwise | yes (fires once) |
| **M4** | Coerce `gap.gapType: "rationalize"` → `"ops"` (Phase 17, v2.4.8) | yes |
| **M5** | Coerce `instance.disposition: "rationalize"` → `"retire"` (Phase 17, v2.4.8) | yes |
| **M6** | Backfill primary-layer invariant — prepend `gap.layerId` to `affectedLayers` (v2.4.9) | yes |
| **M7** | Derive + store `gap.projectId` if missing (v2.4.9) | yes |
| **M8** | Default `sessionMeta` if missing | yes |
| **M9** | Generate `sessionId` if missing | yes |
| **M10** | Default `gap.urgencyOverride: false` on every legacy gap (v2.4.11) | yes |

Every rule is idempotent — running the migrator twice produces the same result as running it once. Tested by Suite 05 ("migrateLegacySession handles an already-migrated session idempotently").

## Field-level compat

| Field | Introduced | Migrator handling | Backward-compat |
|---|---|---|---|
| `customer.drivers[]` | v2.0 | M1 derives from legacy fields | Older app reads `drivers` as unknown; ignored. |
| `gap.driverId` | Phase 14 (v2.1.x) | Computed at render time if absent | Older app ignores. |
| `instance.mappedAssetIds` | v2.3.1 | Workload-only validation | Older app: validation passes; renders are unaware of mapping. |
| `gap.affectedLayers[]` | v2.4.9 (invariant added) | M6 backfills | Older app: tolerates extra layers in array. |
| `gap.projectId` | v2.4.9 | M7 derives | Older app ignores; falls back to env::layer::gapType key. |
| `gap.urgencyOverride` | v2.4.11 | M10 defaults to false | Older app ignores. |
| `gap.closeReason` / `closedAt` | v2.4.11 | No migrator (additive) | Older app: gap appears closed (status='closed'); reopen-button doesn't render. |

## `.canvas` file format compatibility

The `.canvas` workbook file (v2.4.10) wraps a session in an envelope:

```jsonc
{
  format: "delltech.canvas",
  version: "1",
  exportedAt: "2026-04-25T12:34:56.789Z",
  appVersion: "2.4.11",
  sessionMeta: { ... },
  session: { ... },             // the inner session shape
  providerConfig: { ... },      // optional, only if user opted-in
  providerKeys: { ... },        // optional, only with explicit "include keys" checkbox
  skills: [ ... ]               // optional
}
```

On import (`services/sessionFile.js applyEnvelope`):
1. Validate envelope structure.
2. Run `migrateLegacySession` on the inner session.
3. Optionally restore provider config / keys / skills (per user-checkboxed import options).
4. Save into the live session via `replaceSession`.

The envelope `version` is "1" today. Future bumps will:
- v1 → v2: new top-level fields. Older app's `applyEnvelope` should ignore unknown fields.
- v2 → v3 (hypothetical): if we change the envelope shape itself, we add a coercion path on import.

Tested by Suite 41 SF1-SF11 (round-trip + cross-version migration).

## Schema-version bump policy

When does `sessionMeta.version` bump?

| Bump | Trigger | Example |
|---|---|---|
| Never bump just for new fields | Migrator handles it | adding `gap.urgencyOverride` |
| Bump 2.0 → 2.1 | Migrator drops or renames a field that was actively used | Phase 17 dropped `rationalize` (but didn't bump — the migrator handles it) |
| Bump 2.0 → 3.0 | Major shape break — e.g., promoting `Project` from derived to stored entity | v3 multi-user (will likely bump) |

Today: `sessionMeta.version` is "2.0" since Phase 14. **No bump has been needed for the entire v2.x series** because the migrator absorbs all the additions. v3 will likely bump.

## Forward-compat path

The migrator is **only forward-compatible** — it knows how to read older shapes and bring them current. It does NOT know how to read FUTURE shapes (a session saved on v2.5.0 won't necessarily load on v2.4.11). To roll a session forward AND back across versions:

1. Export to `.canvas` from the newer version.
2. Roll back the app.
3. Import the `.canvas` — `migrateLegacySession` may emit warnings or drop fields it doesn't recognise.
4. App may render incorrectly if the session has fields the older app needs to interpret.

**Rule of thumb**: if you're rolling back through a major-version boundary (v3 → v2), expect data loss. If you're rolling back within v2.x, expect "additive new fields are ignored" — no data loss in practice.

## Refresh trigger

Update this file:
- When a new migrator rule is added.
- When a session-shape field is added/removed/renamed.
- When the `.canvas` envelope shape evolves.
- Every `.dNN` hygiene-pass.
