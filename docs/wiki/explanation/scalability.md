# Scalability profile

**Audience**: anyone evaluating "can this thing scale to N×?" or sizing the v3 multi-user platform.
**Purpose**: name the current target, the next ceiling, the hard ceiling, and the v3 path. Every optimisation decision should be checked against these budgets.

---

## Three ceilings

### Current target — workshop session (today)

| Metric | Typical | Worst observed |
|---|---|---|
| Instances (current + desired) | 20-50 | ~70 |
| Gaps | 10-30 | ~40 |
| Drivers | 3-6 (out of 8 catalog) | 8 |
| Deployed AI skills | 6-15 (incl. seeds) | ~25 |
| Undo stack | 3-8 | 10 (cap) |
| Session JSON size | 30-80 KB | ~150 KB |
| First-paint | <500 ms (localhost) | <2 s (LAN) |
| Tab switch | <100 ms | <300 ms |
| AI skill round-trip | 1-5 s (provider-dependent) | 30 s (timeout) |

**At this scale the app is fast.** No optimisation pressure. Performance budgets in [docs/operations/PERFORMANCE_BUDGET.md](../../operations/PERFORMANCE_BUDGET.md).

### Next ceiling — multi-customer presales workspace

A single presales engineer accumulating workshop output across an entire quarter or fiscal year, without resetting. Or one workshop spanning a large enterprise with many concurrent IT estates.

| Metric | Estimated upper bound |
|---|---|
| Instances | 200-500 |
| Gaps | 50-150 |
| Deployed AI skills | 30-50 |
| Session JSON size | 1-5 MB |
| First-paint | should stay <2 s |
| Tab switch | 100-500 ms (Tab 4 kanban becomes the worst case) |
| `buildProjects` (full re-render on session-changed) | 50-200 ms |

At this scale, **measurable pressure** on a few hot paths starts to show. Candidate optimisations (per the .d01 §4 deferred-list):

1. **`Set`/`Map` for instance/gap lookups by id.** Today: `Array.find(x => x.id === ...)` everywhere — O(N) per lookup. `services/programsService.js`, `services/roadmapService.js`, `interactions/gapsCommands.js` do many lookups per render. At N=500 instances + 150 gaps, lookup cost dominates.
2. **Memoize `buildProjects` + `generateExecutiveSummary`.** Pure functions of `(session, config)`; re-computed on every `session-changed`. Memoize with a sessionId-based cache key.
3. **Virtual scrolling** on Tab 4 kanban + Tab 5 Roadmap card grids. Only when card counts cross ~100.

None of these are applied in v2.x because the workshop scale doesn't justify the complexity. They wait for measurement.

### Hard ceiling — localStorage 5-10 MB

The browser's localStorage limit varies by browser (Chrome ~10 MB, Firefox ~10 MB, Safari ~5 MB per origin).

```
session JSON         ~150 KB (typical) → ~5 MB (worst)
ai_skills_v1         ~5-15 KB (small)
ai_undo_v1           10 × ~150 KB = ~1.5 MB (typical) → ~50 MB (worst, would blow ceiling)
ai_config_v1         <1 KB

Total worst-case     ~6-7 MB if undo cap is hit with large sessions
```

The undo cap (`MAX_DEPTH = 10`) is the hard limit. With typical sessions, no concern. With 5 MB sessions × 10 snapshots, we'd blow past localStorage on Safari and approach the limit on Chrome/Firefox.

**What happens at the ceiling**:
- `localStorage.setItem` throws `QuotaExceededError`.
- `aiUndoStack.push` catches it (best-effort persist; in-memory stack still works until reload).
- `saveToLocalStorage` returns `false`; the user sees no save → next reload may revert recent changes.

Mitigations available today:
- Lower `MAX_DEPTH` for users who report quota errors.
- Document in [docs/operations/RUNBOOK.md](../../operations/RUNBOOK.md) "Recover from corrupted localStorage" recipe.
- Future: per-entry compression or delta-encoding for the undo stack.

### v3 path — server-side persistence

When a real user crosses the next ceiling AND wants cross-device sync AND wants multi-user collaboration, the v3 multi-user platform supersedes localStorage entirely:

- Backend: Node/Express or FastAPI + Postgres.
- Auth: JWT + RBAC (presales / manager / director / admin).
- Sessions: server-side, per-org-tenancy, per-user-permissions.
- API keys: server-side, per-org, never visible to the browser.
- Undo: server-side per-user undo log; richer history (no 10-cap).
- Real-time: optional websocket sync for live collaboration.
- Estimated: 2-4 weeks of focused work; separate `SPEC_v3.md`.

## Performance budgets (per surface)

Codified in [docs/operations/PERFORMANCE_BUDGET.md](../../operations/PERFORMANCE_BUDGET.md):

| Surface | Budget |
|---|---|
| Initial load (TTI) | < 1 s on localhost, < 2 s on LAN |
| Tab switch | < 100 ms |
| AI call hard timeout | 30 s (configurable per provider) |
| Render budget per matrix tile | < 4 ms |
| Render budget per kanban card | < 2 ms |
| `buildProjects` (current + worst-case) | < 50 ms / < 200 ms |
| `applyProposal` (single) | < 50 ms |
| `undoLast` (full snapshot restore) | < 50 ms |

Test note: stress assertions for these (PERF-1 through PERF-5 per procedure §10.1) were considered for `v2.4.11.d02` and **deferred**. Reason: adding new test code is borderline-functional-change for a `.dNN` hygiene clone; the project's "tests pass and stay passing" discipline is better served by adding them as a v2.5.x or v2.6.x slice with explicit scope. The budgets above are documented; assertions follow when there's a failure to catch.

## Multi-arch baseline

- **linux/amd64** — primary developer + reviewer baseline.
- **linux/arm64** — Dell GB10 / Grace ARM64 hardware. **Multi-arch verified at image build only**; live execution on real ARM64 hardware is pending (Bucket D in [HANDOFF.md](../../../HANDOFF.md)). When the GB10 verification happens, this section gains an "ARM64 production observed" sub-row.

## When this profile changes

- A user reports a real performance complaint → measure the hot path; if the budget is exceeded, either optimise or document the new ceiling.
- v3 multi-user platform ships → this entire section is rewritten around the new architecture.
- A new AI provider with materially different latency characteristics → update the AI-call budget.
- A workload that pushes session size past 1 MB regularly → reconsider undo storage strategy.

See [docs/operations/RISK_REGISTER.md](../../operations/RISK_REGISTER.md) for the four risks bearing on this profile (R-001 keys, R-002 single-device, R-004 storage limit, R-005 LLM rate limit).
