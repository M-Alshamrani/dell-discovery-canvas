# Invariants · always-true properties

Every entry here is a property that **must** hold across every state of the system. Each is paired with the regression-gate test (or "code review only" if no automated check exists).

If you change code that breaks an invariant: STOP, escalate. Don't add an exception; restore the invariant or document why it's no longer load-bearing.

This list is consolidated from [SPEC §1](SPEC.md), [SPEC §12.8](SPEC.md), and the foundational memory files. **It supersedes scattered references** — when SPEC and INVARIANTS disagree, this file is authoritative.

---

## Architecture invariants

### INV-A1 · Tests are the contract
**Property**: Every test in `diagnostics/appSpec.js` + `diagnostics/demoSpec.js` passes on every commit to `main`.
**Source**: [SPEC §1 invariant 1](SPEC.md).
**Regression gate**: green test banner on every page load.
**On violation**: failing test = fix the implementation, not the test. Never weaken.

### INV-A2 · Single source of truth
**Property**: Read-only / derived fields are computed at render time, not duplicated in storage.
**Source**: [SPEC §1 invariant 2](SPEC.md).
**Regression gate**: code review.
**Known partial exception**: `gap.projectId` is derived AND stored (hybrid). Documented in [ADR-009](docs/adr/ADR-009-relationship-cascade-policy.md). Recompute on structural patches keeps it consistent.

### INV-A3 · JSON-serialisable session
**Property**: `session` is JSON-round-trippable at all times. No `Date` objects, no `Map`/`Set`, no class instances.
**Source**: [SPEC §1 invariant 4](SPEC.md).
**Regression gate**: `JSON.parse(JSON.stringify(session))` round-trips byte-identically. Tested by Suite 33 DS13/DS14 via undo snapshots.
**On violation**: AI agents cannot read/write the session; undo stack breaks; localStorage persistence breaks. Triple-tier failure.

### INV-A4 · Layer discipline
**Property**: Only modules in `interactions/` mutate session state. `services/*` are pure reads. `ui/*` calls commands and reads services — never mutates directly.
**Source**: [SPEC §1 invariant 6](SPEC.md).
**Regression gate**: code review (no automated check).
**Known violation**: `ContextView.js:130` uses `session.customer.drivers.splice()` directly. Tracked R-INT-2; fix queued for v2.5.x per [ADR-009](docs/adr/ADR-009-relationship-cascade-policy.md). Don't add new violations.

### INV-A5 · Validate before save
**Property**: Every gap and instance passes `validateGap` / `validateInstance` before being persisted.
**Source**: [SPEC §1 invariant 3](SPEC.md).
**Regression gate**: Suite 03 + Suite 04 + every command-test in Suites 06/07.
**On violation**: corrupt session shapes; load-time errors; AI agents see inconsistent data.

## AI platform invariants

### INV-AI1 · Skill round-trip preservation
**Property**: Every skill stored in `localStorage[ai_skills_v1]` round-trips through `normalizeSkill` exactly. Unknown legacy fields are preserved or migrated, never silently dropped.
**Source**: [SPEC §12.8 invariant 1](SPEC.md).
**Regression gate**: Suite 26 SB1-SB8.

### INV-AI2 · Writable-path allowlist
**Property**: Every path in a skill's `outputSchema` is either a `session.*` path OR has a registered `WRITE_RESOLVERS` entry.
**Source**: [SPEC §12.8 invariant 2](SPEC.md), enforced by load-time validation.
**Regression gate**: Suite 32 DS9/DS10.
**See also**: [ADR-005](docs/adr/ADR-005-writable-path-resolver-protocol.md).

### INV-AI3 · Single-funnel mutation
**Property**: No direct `session.*` mutation from any AI-adjacent code path outside `interactions/aiCommands.js`. Every mutation goes through `applyProposal` / `applyAllProposals` / (v2.6.0) `applyCommand`.
**Source**: [SPEC §12.8 invariant 3](SPEC.md).
**Regression gate**: code review.

### INV-AI4 · Undo before mutation
**Property**: Every apply pushes an undo snapshot **before** mutation. If `aiUndoStack.push` throws, apply aborts.
**Source**: [SPEC §12.8 invariant 4](SPEC.md).
**Regression gate**: Suite 33 DS13/DS14.

### INV-AI5 · No telemetry on LLM proxy
**Property**: API keys never leave the user's browser localStorage except to flow through the nginx proxy to the declared upstream. No telemetry, no logging — `access_log off` on every `/api/llm/*` location.
**Source**: [SPEC §12.8 invariant 5](SPEC.md).
**Regression gate**: code review of `nginx.conf` + `docker-entrypoint.d/45-setup-llm-proxy.sh`.

### INV-AI6 · Session-changed event coverage
**Property**: Every session-root mutation emits a `session-changed` event with a reserved reason: `"ai-apply"`, `"ai-undo"`, `"session-reset"`, `"session-demo"`, `"session-replace"`.
**Source**: [SPEC §12.8 invariant 6](SPEC.md).
**Regression gate**: Suite 35 DS16/DS17.
**See also**: [ADR-006](docs/adr/ADR-006-session-changed-event-bus.md).

### INV-AI7 · Seed skill schema correctness
**Property**: Every seed skill's `outputSchema` path exists in `FIELD_MANIFEST[tab]` AND is `writable: true`.
**Source**: [SPEC §12.8 invariant 7](SPEC.md).
**Regression gate**: Suite 32 DS9.

### INV-AI8 · Two-surface rule
**Property**: Every data-model change (add / rename / remove a field on instance / gap / driver / sessionMeta) ships in the same commit as: (a) refreshed `state/demoSession.js`, (b) seed skill in `core/seedSkills.js` (if writable), (c) demoSpec assertion, (d) `docs/DEMO_CHANGELOG.md` entry.
**Source**: [SPEC §12.8 invariant 8](SPEC.md), `feedback_foundational_testing.md`.
**Regression gate**: code review (no automated check).
**See also**: [ADR-007](docs/adr/ADR-007-skill-seed-demosession-separation.md).

## Rules-hardening invariants (v2.4.11)

### INV-R1 · Draft-permissive / Review-enforced
**Property**: `validateActionLinks` only runs when the patch changes a STRUCTURAL field (gapType / layerId / affectedLayers / affectedEnvironments / relatedXxxInstanceIds) OR `patch.reviewed === true` is explicit OR the call is `approveGap`.
**Source**: [SPEC §12.8 invariant 9](SPEC.md), [docs/RULES.md AL9](docs/RULES.md).
**Regression gate**: Suite 42 RH-related tests.

### INV-R2 · Status:closed not delete
**Property**: Setting a desired tile's disposition to `keep` flips linked gaps to `status: "closed"` (with `closeReason` + `closedAt`), not delete. Reversible via the gap-detail panel's "Reopen" button.
**Source**: [SPEC §12.8 invariant 10](SPEC.md), [docs/RULES.md P3](docs/RULES.md).
**Regression gate**: Suite 42 + DS22.

### INV-R3 · Browser smoke required
**Property**: Every functional tag includes a manual Chrome-MCP browser smoke against the verification spec BEFORE the commit + tag. Tests-pass-alone is necessary but not sufficient.
**Source**: [SPEC §12.8 invariant 11](SPEC.md), `feedback_browser_smoke_required.md`.
**Regression gate**: process discipline (no automated check).

## Data-model invariants

### INV-D1 · Primary-layer
**Property**: `gap.affectedLayers[0] === gap.layerId` whenever `affectedLayers` is non-empty.
**Source**: [docs/RULES.md G6](docs/RULES.md), [`core/models.js validateGap`](core/models.js).
**Regression gate**: validateGap throws on violation.
**Migrator**: M6 backfills legacy gaps via `setPrimaryLayer`.

### INV-D2 · Workload mapping confined to workload layer
**Property**: `instance.mappedAssetIds` is only valid on `instance.layerId === "workload"`. Non-workload tiles carrying the field throw at validation.
**Source**: [docs/RULES.md I9](docs/RULES.md), [`core/models.js validateInstance`](core/models.js).
**Regression gate**: Suite 24 W1b.

### INV-D3 · Same-environment workload mapping
**Property**: A workload's `mappedAssetIds` must reference instances in the **same** `environmentId` as the workload. Hybrid workloads create one workload tile per environment.
**Source**: [docs/RULES.md W5](docs/RULES.md), [`interactions/matrixCommands.js mapAsset`](interactions/matrixCommands.js).
**Regression gate**: Suite 24 W2 (rejects cross-env mappings).

### INV-D4 · Action-link rules on reviewed gaps
**Property**: A reviewed gap's link counts honour its Action's rule:
- `replace`: 1 current AND 1 desired
- `enhance`: 1 current; desired optional
- `consolidate`: ≥2 current AND 1 desired
- `introduce`: 0 current AND 1 desired
- `keep` / `retire`: 1 current
- `ops`: optional/optional, BUT requires `notes ≥10 chars` OR ≥1 link (substance rule, v2.4.11)

**Source**: [docs/RULES.md AL2-AL7](docs/RULES.md), [`core/taxonomy.js validateActionLinks`](core/taxonomy.js).
**Regression gate**: Suite 39 + DS18-DS22.

## Migration invariants

### INV-M1 · Idempotency
**Property**: `migrateLegacySession(migrateLegacySession(s)) === migrateLegacySession(s)` (deep-equality byte-identical).
**Source**: [docs/RULES.md §10](docs/RULES.md).
**Regression gate**: Suite 05 ("migrateLegacySession handles an already-migrated session idempotently").

### INV-M2 · Additive-only
**Property**: Migrators never remove user-authored fields. They may rename (e.g., `rationalize` → `ops`) and backfill, but unknown fields are preserved (forward-compat).
**Source**: code review of `state/sessionStore.js migrateLegacySession`.
**Regression gate**: code review.

## Operational invariants

### INV-O1 · No build step
**Property**: The shipped Docker image contains no transpiled, bundled, or minified output. Source files are served as-is.
**Source**: [ADR-001](docs/adr/ADR-001-vanilla-js-no-build.md).
**Regression gate**: code review of Dockerfile.

### INV-O2 · No npm dependencies
**Property**: `package.json` does not exist. Every line of code in the project is hand-authored or vendored with attribution.
**Source**: [ADR-001](docs/adr/ADR-001-vanilla-js-no-build.md).
**Regression gate**: `find . -name package.json` returns empty.

### INV-O3 · Multi-arch image
**Property**: Container image builds for both `linux/amd64` and `linux/arm64` (Dell GB10 / Grace ARM64 ready).
**Source**: [`Dockerfile`](Dockerfile) `FROM nginx:1.27-alpine` (Alpine ships multi-arch).
**Regression gate**: `docker buildx build --platform linux/amd64,linux/arm64` succeeds.

### INV-O4 · Container security headers
**Property**: Every response carries the full set of security headers — comprehensive CSP, `X-Content-Type-Options nosniff`, `X-Frame-Options DENY`, `Referrer-Policy no-referrer`, `Permissions-Policy camera=(), microphone=(), geolocation=()`.
**Source**: [`nginx.conf`](nginx.conf).
**Regression gate**: `curl -I http://localhost:8080/` shows headers.

### INV-O5 · Health endpoint always accessible
**Property**: `/health` is reachable without auth even when `AUTH_USERNAME` + `AUTH_PASSWORD` are set. Used by HEALTHCHECK + external monitoring.
**Source**: [`nginx.conf`](nginx.conf) `auth_basic off` in `location = /health`.
**Regression gate**: with auth enabled, `curl http://localhost:8080/health` still returns `ok`.

---

## How to use this list

1. **Before changing code** — search this file for the area you're about to touch. If an invariant applies, satisfy its regression gate.
2. **When reviewing a PR** — check that no invariant is silently violated.
3. **When designing a new feature** — list which invariants the feature interacts with.
4. **When you find a new always-true property worth codifying** — add it here. Don't let invariants live in tribal memory.

## When this list changes

- New rule hardening (like v2.4.11) → new INV-R*.
- New ADR that codifies a property → cross-link to the ADR.
- v3 multi-user platform → entire OPERATIONAL section changes; INV-A* mostly survives.
- A field becomes derived where it was stored (or vice versa) → review INV-A2.
