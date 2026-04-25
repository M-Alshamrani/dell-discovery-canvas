# ADR-002 · localStorage-only persistence (single-tenant, browser-local)

## Status

**Accepted** for v2.x. **Will be superseded by a v3 ADR** when the multi-user platform replaces this with server-side persistence + JWT auth + RBAC.

## Context

A presales engineer needs a tool to capture customer-discovery output during a 30-45 minute workshop. Common alternatives — Excel, PowerPoint, Miro — have known failure modes (file-versioning hell, no derivation logic, no testable contract). The Discovery Canvas exists to give one disciplined surface that ladders to a CxO-ready roadmap.

At v2.x scale (single user, single workstation, no shared state across devices), the operational properties we care about:

- **Zero-infrastructure deployment** — works on a laptop with Docker Desktop. No backend to run, no DB to manage.
- **Survives browser refresh + container restart** — workshop sessions can run for an hour; users tab away and back.
- **Round-trips to a portable file** — users want to keep a workshop output as an artefact (legal + record-keeping).
- **AI-platform-friendly** — every AI feature must be able to read and (selectively) write the session without special-casing.

## Decision

**All session state lives in browser `localStorage`** under four keys:

| Key | Owned by | Shape pointer | Cleared by |
|---|---|---|---|
| `dell_discovery_v1` | `state/sessionStore.js` | SPEC §2 — Session shape | "Clear all data" footer button or DevTools |
| `ai_config_v1` | `core/aiConfig.js` | `{activeProvider, providers: {local, anthropic, gemini}}` | "Clear all data" only |
| `ai_skills_v1` | `core/skillStore.js` | `Skill[]` per SPEC §12.1 | "Clear all data" only |
| `ai_undo_v1` | `state/aiUndoStack.js` | `{label, snapshot, timestamp}[]` (cap 10) | `resetSession` / `resetToDemo` / "Clear all data" |

**Every key has a normalizer** that runs on load. Normalizers are idempotent, additive, and preserve unknown forward-compat fields. The shape rules live in [SPEC §2.5](../../SPEC.md), [docs/RULES.md §10](../RULES.md), and the per-module migration code.

**Every session shape is JSON-serialisable** — no `Date` objects, no `Map`/`Set` instances, no class instances. AI agents read/write without special casing (per [SPEC §1 invariant 4](../../SPEC.md)).

**Portable file format**: `.canvas` workbook files (v2.4.10) wrap the session JSON in an envelope with metadata (`exportedAt`, `appVersion`, `sessionMeta`). Saved via the File System Access API on Chrome/Edge; downloaded as a blob elsewhere. Imports run through the same `migrateLegacySession` path so cross-version files load cleanly.

**No telemetry** — nothing leaves the browser except as part of an explicit AI-skill prompt. The nginx LLM proxy has `access_log off` per [SPEC §12.8 invariant 5](../../SPEC.md).

## Alternatives considered + rejected

- **IndexedDB** — better for large datasets (>5MB). Rejected because workshop sessions are <100KB even with full instance/gap counts; the API ceremony isn't worth it.
- **localStorage + a service worker** — would enable offline-first more cleanly. Rejected because we already work offline (everything is in localStorage); adding a service worker introduces cache-invalidation complexity for marginal gain.
- **Server-side persistence (now)** — premature for single-user use. v3 multi-user platform will revisit this with JWT + RBAC + Postgres.
- **File-only (no localStorage)** — would force "save as you go". Rejected because workshop friction matters; users shouldn't lose 20 minutes of work to an accidental tab-close.
- **Hybrid (file + localStorage with manual sync)** — too much UX for marginal benefit at this scale.

## Consequences

### Good

- **Zero infrastructure** — works on a fresh laptop in <60s.
- **Per-user data sovereignty** — never leaves the user's machine without explicit AI-skill action.
- **Cheap migrations** — schema evolves via the additive `migrateLegacySession` chain. v1 → v2 sessions still load 6 months later.
- **Trivial backup / portability** — `.canvas` file via File System Access API.

### Bad / accepted trade-offs

- **No cross-device sync** — a workshop on the laptop isn't visible on the desktop. Mitigated by `.canvas` export. v3 fixes this.
- **5-10 MB localStorage hard limit** — at projected workshop scale, sessions are <100 KB. We're orders of magnitude under the ceiling. Surfacing a "session size warning" at 80% threshold is a v2.5+ nice-to-have.
- **API keys live in the browser, visible in DevTools** — flagged in [docs/operations/RISK_REGISTER.md R-001](../operations/RISK_REGISTER.md). v3 moves these server-side.
- **Concurrent tabs can race** — two browser tabs both editing the same session can produce stale-write surprises. Mitigated by the `session-changed` event bus + `loadFromLocalStorage` re-hydration paths, but not bulletproof. Single-tab use is the documented expectation.

## When to revisit

1. **v3.0.0 multi-user platform** — supersedes this ADR. Server-side persistence, JWT auth, RBAC (presales / manager / director / admin), API keys server-side, per-org tenancy.
2. **Workshop scale crosses 500 instances or 200 gaps regularly** — at that scale, full-session JSON serialise/deserialise on every change starts to cost. Move to event-sourcing or per-entity persistence.
3. **A real "share session with another presales engineer" use case shows up** without v3 ready — would warrant a thin "shared workspace" backend ahead of full v3.

See [adr/ADR-006](ADR-006-session-changed-event-bus.md) for how the event bus makes this design AI-platform-friendly.
