# localStorage key catalog

Every persistent key the app reads or writes. Owned modules listed; normalizer pointers identified. Manually maintained — update on every schema change.

---

## Live keys

### `dell_discovery_v1`

| | |
|---|---|
| **Owner** | [`state/sessionStore.js`](../../../state/sessionStore.js) |
| **Shape** | Session object (see [SPEC §2.1](../../../SPEC.md)) |
| **Normalizer** | `migrateLegacySession(raw)` — runs on every load (idempotent + additive) |
| **Migration rules** | M1-M10 in [docs/RULES.md §10](../../RULES.md) |
| **Cleared by** | "Clear all data" footer button or DevTools manual delete |
| **Survives reset?** | No — `resetSession` / `resetToDemo` overwrite |

What's inside (top-level keys): `sessionId`, `isDemo`, `customer.{name, vertical, segment, industry, region, drivers[]}`, `sessionMeta.{date, presalesOwner, status, version}`, `instances[]`, `gaps[]`.

### `ai_config_v1`

| | |
|---|---|
| **Owner** | [`core/aiConfig.js`](../../../core/aiConfig.js) |
| **Shape** | `{activeProvider, providers: {local, anthropic, gemini}}` |
| **Normalizer** | `mergeWithDefaults(stored)` — preserves user keys, fallback chain, applies one-shot deprecation migrations |
| **Migration history** | Gemini `gemini-2.0-flash` → `gemini-2.5-flash` (auto, on load); future deprecations land in `DEPRECATED_MODELS[provider]` |
| **Cleared by** | "Clear all data" only — provider config survives session reset |
| **Survives reset?** | Yes — `resetSession` / `resetToDemo` preserve provider config |

API keys live here. Visible in DevTools. Flagged as [RISK_REGISTER R-001](../../operations/RISK_REGISTER.md); v3 multi-user moves keys server-side.

### `ai_skills_v1`

| | |
|---|---|
| **Owner** | [`core/skillStore.js`](../../../core/skillStore.js) |
| **Shape** | `Skill[]` (see [SPEC §12.1](../../../SPEC.md)) |
| **Normalizer** | `normalizeSkill(s)` — preserves unknown forward-compat fields; migrates legacy `outputMode` → `applyPolicy`; defaults `responseFormat` from `outputSchema.length` |
| **Cleared by** | "Clear all data" only |
| **Survives reset?** | Yes — user skills persist across session reset |

On first run, `loadSkills()` writes the 6 seed skills from `core/seedSkills.js` into this key automatically.

### `ai_undo_v1`

| | |
|---|---|
| **Owner** | [`state/aiUndoStack.js`](../../../state/aiUndoStack.js) |
| **Shape** | `[{label: string, snapshot: SessionShape, timestamp: number}]` |
| **Cap** | `MAX_DEPTH = 10` entries (FIFO drop on overflow, LIFO undo) |
| **Normalizer** | `loadFromStorage()` — type-checks each entry; trims to MAX_DEPTH; filters malformed |
| **Cleared by** | `resetSession` / `resetToDemo` / `aiUndoStack.clear()` / "Clear all data" |
| **Survives reset?** | **No** — by design ([ADR-008](../../adr/ADR-008-undo-stack-hybrid.md)). Reset means "start over"; undo doesn't survive a deliberate boundary. |

## How to inspect / edit (DevTools)

```
F12 → Application → Storage → Local Storage → http://localhost:8080
```

Each key is JSON-encoded. Edits persist on reload but skip the normalizer (caveat — manually-edited values may fail validation; the next save round-trip would surface the error).

## Audit notes from `v2.4.11.d01`

- All four normalizers tested as round-trip-clean against the live schema in §5 of [docs/MAINTENANCE_LOG.md](../../MAINTENANCE_LOG.md).
- No new keys discovered.
- `localStorage.clear()` (full wipe) is the nuclear option; "Clear all data" footer button does this safely with a confirm.

## Storage budget

localStorage hard limit: 5-10 MB per origin (browser-dependent). Worst-case estimate at workshop scale:

- `dell_discovery_v1`: ~50-100 KB.
- `ai_skills_v1`: ~5-15 KB (6 seed skills + a few user-created).
- `ai_undo_v1`: 10 × ~50 KB = ~500 KB.
- `ai_config_v1`: <1 KB.

Total ~600-700 KB at the upper end of normal use. Well under the 5 MB ceiling. Surfacing a "session size warning" at 80% threshold is a v2.5+ nice-to-have; not yet observed in practice.

## Refresh trigger

Update this file:
- When a new key is added (immediately).
- When a normalizer changes shape (immediately).
- Every `.dNN` hygiene-pass — re-validate every entry round-trips correctly.
