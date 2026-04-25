# Risk register

Known risks + mitigations for Dell Discovery Canvas. Each entry: severity, likelihood, mitigation, owner, when to revisit.

**Severity**: Low / Medium / High / Critical (based on impact if realised).
**Likelihood**: Low / Medium / High (probability over the next 12 months).
**Owner**: who has accountability for the mitigation.
**Revisit**: trigger that should reopen this risk.

---

## R-001 · API keys in browser localStorage

| | |
|---|---|
| **Severity** | Medium |
| **Likelihood** | Medium |
| **Owner** | v3 multi-user platform work |
| **Revisit** | When v3 ships OR when a real key-leak incident is reported |

**Risk**: User-supplied AI provider API keys (Anthropic, Gemini) live in browser `localStorage` under `ai_config_v1`. Visible in DevTools to anyone with access to the user's browser profile.

**Mitigation today**:
- Single-user-per-browser-profile assumption (workshop tool, single presales engineer).
- nginx LLM proxy has `access_log off` — keys never reach server-side logs (INV-AI5).
- Auth-disabled localhost-only default deployment doesn't expose the app to others on the network.
- v3 multi-user platform moves keys server-side (out of browser entirely).

**Residual risk**: keys could be exfiltrated if the user's browser profile is compromised. Worker laptops with managed device security mitigate this somewhat; presales engineers running on personal devices are a higher-risk surface.

## R-002 · Single-device only · no cross-device sync

| | |
|---|---|
| **Severity** | Medium |
| **Likelihood** | High |
| **Owner** | v3 multi-user platform work |
| **Revisit** | When v3 ships OR when users report blocked workflows |

**Risk**: A workshop session on the laptop isn't visible on the desktop. If a user wants to continue a workshop on a different device, they must explicitly export.

**Mitigation today**:
- `.canvas` workbook file (v2.4.10) — user-driven save/open via the File System Access API. Any user can transfer between devices manually.
- Cloud-storage sync (OneDrive, Dropbox, Google Drive) of the saved `.canvas` file works automatically once saved.

**Residual risk**: the user must remember to save. Forgetting → losing work on device-switch.

## R-003 · `nginx:alpine` base image accumulates CVEs

| | |
|---|---|
| **Severity** | Low to Medium |
| **Likelihood** | High (regularly) |
| **Owner** | Project owner |
| **Revisit** | Every 3 months OR on CVE with CVSS ≥ 7.0 |

**Risk**: `nginx:1.27-alpine` and the Alpine base layer accumulate known vulnerabilities over time. Critical-severity CVEs in nginx itself have been ~1-2 per year historically.

**Mitigation today**:
- Pinned to a major (`nginx:1.27`); minor bumps automatic on rebuild.
- Cadence: bump every 3 months OR on critical CVE per [DEPENDENCY_POLICY.md](DEPENDENCY_POLICY.md).
- Procedure documented in [RUNBOOK.md §6](RUNBOOK.md).
- Container exposes only `/health` and the static-file surface; attack surface is small.

**Residual risk**: a zero-day in nginx exploited before our 3-month cadence kicks in.

## R-004 · localStorage hard limit (5-10 MB)

| | |
|---|---|
| **Severity** | Low |
| **Likelihood** | Low |
| **Owner** | Performance work |
| **Revisit** | When workshop sessions regularly approach 1 MB OR when quota errors are observed |

**Risk**: Browser localStorage caps at 5-10 MB per origin (varies by browser). At workshop scale, sessions are <100 KB; we're orders of magnitude under the ceiling. But cumulative undo stack + session bloat over many edits could approach the limit.

**Mitigation today**:
- Undo stack capped at 10 entries (`MAX_DEPTH`).
- "Clear all data" footer button is the user-driven escape hatch.
- `aiUndoStack` catches `QuotaExceededError` and continues in-memory.

**Residual risk**: a single very-large session × undo stack pressure could trip the quota. Mitigation: lower `MAX_DEPTH` if observed; future delta-encoding for snapshots.

**See also**: [scalability.md hard ceiling](../wiki/explanation/scalability.md).

## R-005 · LLM provider rate-limit / outage

| | |
|---|---|
| **Severity** | Low |
| **Likelihood** | Medium |
| **Owner** | Resolved by v2.4.5.1 reliability work |
| **Revisit** | When a new provider with materially different latency / rate-limit characteristics is added |

**Risk**: Anthropic / Gemini / local vLLM hit rate limits or transient errors during a workshop, breaking the AI flow.

**Mitigation today** (v2.4.5.1 / Phase 19f, [SPEC §12.4a](../../SPEC.md)):
- Retry-with-backoff on 429 / 500 / 502 / 503 / 504 (3 attempts, 500ms→4s with full jitter).
- Per-provider `fallbackModels[]` chain (Gemini defaults to `gemini-2.0-flash, gemini-1.5-flash`).
- Settings UI exposes the chain; "Test connection" reports which model answered.
- 30s hard timeout per call.
- Error messages categorised (401/403 → "fix your key"; 5xx → "upstream issue").

**Residual risk**: complete provider outage (Anthropic AND Gemini AND local all down). Workshop continues without AI; manual entry still works.

## R-006 · Anthropic browser-direct-access header revocation

| | |
|---|---|
| **Severity** | Medium |
| **Likelihood** | Low |
| **Owner** | Project owner |
| **Revisit** | Monitor [Anthropic API changelog](https://docs.anthropic.com/en/release-notes) at every `.dNN` pass |

**Risk**: Anthropic's API requires the header `anthropic-dangerous-direct-browser-access: true` for browser-originated requests. This is an opt-in vendor decision; could be revoked.

**Mitigation today**:
- Header is set unconditionally by `services/aiService.js buildRequest("anthropic", ...)`.
- nginx LLM proxy preserves the `Origin` header (which is what triggers Anthropic's check).
- If revoked: Anthropic returns 401 with a message naming the header — clear failure mode, not silent.

**Residual risk**: if revoked, would force a server-side proxy with origin-stripping (not feasible in v2 without a Node backend). v3 multi-user platform handles this naturally.

## R-007 · ContextView direct splice violates layer invariant (R-INT-2)

| | |
|---|---|
| **Severity** | Medium (architectural drift, not functional) |
| **Likelihood** | Realised today |
| **Owner** | v2.5.x cleanup |
| **Revisit** | After ADR-009 cascade-policy implementation |

**Risk**: [`ContextView.js:130`](../../ui/views/ContextView.js) mutates `session.customer.drivers` directly via `splice()`, violating the "only `interactions/*` mutates session" rule (INV-A4). Plus driver-delete doesn't cascade to `gap.driverId` references → ghost data on the Roadmap.

**Mitigation today**:
- Documented as R-INT-2 in [docs/MAINTENANCE_LOG.md · v2.4.11.d01 · §5](../MAINTENANCE_LOG.md).
- Tracked as ADR-009 with planned cleanup (new `interactions/contextCommands.js removeDriver` with cascade clear).

**Residual risk**: invariant erosion. If we ship more direct-mutation paths, the architectural property dilutes. Don't add new violations.

## R-008 · Dangling FK accumulation on deletes

| | |
|---|---|
| **Severity** | Low |
| **Likelihood** | High (every delete) |
| **Owner** | v2.5.x cleanup (optional) |
| **Revisit** | If a user reports a "ghost data" UX bug |

**Risk**: `deleteInstance` doesn't cascade-clean `gap.relatedCurrentInstanceIds` / `relatedDesiredInstanceIds` / other workloads' `mappedAssetIds`. Orphan IDs accumulate.

**Mitigation today**:
- Renderers tolerate gracefully (`if (!asset) return;` patterns; tested via `proposeCriticalityUpgrades`).
- Validators don't enforce link integrity — explicit UX trade-off (`core/models.js:96`).
- Documented as R-INT-1, R-INT-5 in [docs/MAINTENANCE_LOG.md](../MAINTENANCE_LOG.md).

**Residual risk**: long-running sessions accumulate untidy data. Functionally harmless; cosmetically real.

## R-009 · GB10 / linux/arm64 unverified

| | |
|---|---|
| **Severity** | Low |
| **Likelihood** | N/A (potential — not yet experienced) |
| **Owner** | Bucket D in [HANDOFF.md](../../HANDOFF.md) |
| **Revisit** | When ARM64 hardware becomes available |

**Risk**: Container image is multi-arch-tagged but never executed on real ARM64 hardware. A subtle Alpine ARM64 issue (different glibc / musl / SSL paths) could surface at runtime.

**Mitigation today**:
- `nginx:1.27-alpine` officially multi-arch; ecosystem-tested.
- `apache2-utils` available on Alpine ARM64.
- Multi-arch builds succeed at image-build time (no runtime issue at build).

**Residual risk**: production ARM64 deployment uncovers a runtime issue. Mitigation when realised: pin to amd64 fallback or contribute upstream fix.

## R-010 · Memory drift between sessions (Claude-specific)

| | |
|---|---|
| **Severity** | Low (process risk, not data risk) |
| **Likelihood** | Medium |
| **Owner** | `.dNN` hygiene-pass cadence |
| **Revisit** | Every `.dNN` pass |

**Risk**: The auto-memory tree at `.claude/projects/...` may accumulate stale claims (e.g., `project_dell_discovery.md` claimed v1.3 / 21 suites for months until `.d01` rewrote it). Future Claude sessions read stale memory and act on outdated assumptions.

**Mitigation today**:
- `.dNN` hygiene-pass §6 includes auto-memory reconciliation.
- Memory files have `point-in-time observations` system-reminder warnings on age.

**Residual risk**: between hygiene passes, a memory file may go ~3 months stale. Mitigation: read code state before acting on memory claims (the system reminder explicitly warns).

---

## Active risks summary

| ID | Title | Severity | Likelihood | Owner |
|---|---|---|---|---|
| R-001 | API keys in browser localStorage | Medium | Medium | v3 |
| R-002 | Single-device, no cross-device sync | Medium | High | v3 |
| R-003 | nginx:alpine CVEs | Low-Medium | High | Project owner |
| R-004 | localStorage hard limit | Low | Low | Performance work |
| R-005 | LLM provider outage | Low | Medium | Resolved (v2.4.5.1) |
| R-006 | Anthropic header revocation | Medium | Low | Project owner |
| R-007 | ContextView splice violation (R-INT-2) | Medium | Realised | v2.5.x |
| R-008 | Dangling FK accumulation | Low | High | v2.5.x (optional) |
| R-009 | GB10 / arm64 unverified | Low | N/A | Bucket D |
| R-010 | Memory drift between sessions | Low | Medium | `.dNN` cadence |

## Refresh trigger

Add a new risk when:
- A new attack surface appears (new dep, new external service).
- A new R-INT finding from a `.dNN` audit.
- A user reports a real near-miss.

Close (or move to "resolved") a risk when:
- The mitigation work ships.
- The risk surface disappears (e.g., a deprecated service gone).
- 24+ months of evidence shows the risk doesn't materialise.
