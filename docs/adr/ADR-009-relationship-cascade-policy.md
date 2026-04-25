# ADR-009 · Relationship cascade policy (current state + planned cleanup)

## Status

**Proposed / partially-shipped** — the *current* policy is documented as-built; the *planned* tightening is queued for v2.5.x. This ADR captures the audit baseline established by [`v2.4.11.d01` MAINTENANCE_LOG entry §5 · Relationship complexity audit](../MAINTENANCE_LOG.md).

## Context

The session shape is entity-flat: gaps, instances, drivers, projects (derived). FK-style relationships live as string-id arrays on the gap and workload entities:

| Relationship | Stored on | Shape |
|---|---|---|
| Gap → current instances | `gap.relatedCurrentInstanceIds` | `string[]` |
| Gap → desired instances | `gap.relatedDesiredInstanceIds` | `string[]` |
| Workload → infrastructure assets | `workload.mappedAssetIds` | `string[]` (workload-layer instance only) |
| Gap → strategic driver | `gap.driverId` | `string` (nullable) |
| Gap → project (derived + stored) | `gap.projectId` | `string` (env::layer::gapType) |
| Desired instance → source current instance | `instance.originId` | `string` (nullable, lineage) |

Two findings from the `v2.4.11.d01` relationship-integrity sweep that this ADR addresses:

**R-INT-1 / R-INT-5**: Deletes don't cascade. `deleteInstance` removes from `session.instances` but leaves dangling IDs in every `gap.relatedCurrentInstanceIds`, `gap.relatedDesiredInstanceIds`, and other workloads' `mappedAssetIds`. Renderers tolerate gracefully (e.g., `proposeCriticalityUpgrades` `if (!asset) return;`). Validators don't enforce link integrity.

**R-INT-2 / R-INT-3**: `customer.drivers` is mutated *directly* by `ContextView.js:130` via `splice()`, violating the "only `interactions/*` writes session" architecture invariant ([SPEC §1 invariant 6](../../SPEC.md)). And driver-delete doesn't cascade to `gap.driverId` references → dead pointers fall through to the suggestion ladder D10 → "Unassigned" swimlane on Roadmap.

## Decision

### Current policy (as-built, v2.4.11.d01)

**Cascade discipline**: graceful tolerance, no enforcement.

- **Deletes leave dangling IDs.** Every renderer and service is required to tolerate dangling references (see `proposeCriticalityUpgrades`, `programsService.suggestDriverId`, `roadmapService.buildProjects`).
- **Validators don't enforce link integrity.** `core/models.js validateGap` line 96-98 explicitly states: "relationship rules are intentionally NOT validated here. They are soft constraints shown as UI warnings, not hard blocks. This prevents frustrating save failures."
- **`customer.drivers` direct splice in ContextView is a known violation** — flagged but not fixed.

The trade-off is documented and intentional: orphan IDs accumulate, but workshop save flow is never blocked by an integrity check that would frustrate the user mid-session.

### Planned tightening (v2.5.x)

Queue these for **v2.5.x crown-jewel** work or earlier opportunistic fix:

1. **NEW `interactions/contextCommands.js`** with `addDriver(session, driverId)` and `removeDriver(session, driverId)`. The latter cascades: removes the driver from `session.customer.drivers`, then iterates `session.gaps` and clears any `gap.driverId === removedDriverId`. Emits `session-changed` with reason `"driver-removed"`.

2. **`ContextView.js` migrates** from direct splice to `removeDriver(session, id)`. Eliminates the architecture-invariant violation.

3. **Optional: add a soft chip** "N gap(s) lost their driver assignment" when the cascade clears any gap's `driverId`. Fits the v2.4.11 visibility-of-rules philosophy.

4. **Optional, lower priority**: extend `deleteInstance` with the same cascade rigor — clear orphan IDs from `gap.relatedCurrentInstanceIds`, `gap.relatedDesiredInstanceIds`, and other workloads' `mappedAssetIds` at delete time. Today's graceful tolerance is fine; cascade cleanup is a "data-hygiene" nice-to-have, not a correctness fix.

## Alternatives considered + rejected

- **Hard validators that throw on dangling IDs** — would block saves on imperfect mid-workshop state. Rejected explicitly; same reasoning as for the existing soft-validation choice.
- **Periodic background cleanup of orphans** — adds a hidden mutation source, complicating reasoning. Rejected.
- **Bidirectional back-references on every entity** (e.g., `instance.linkedGapIds`) — doubles the storage cost; introduces a new "are these in sync?" invariant. Rejected.
- **CMDB-style entity normalisation with foreign-key constraints** — significant rewrite. Open question evaluated post-v2.4.11.d02 (per the user's CMDB-vs-UX evidence-based decision). The relationship-complexity audit found this is **not** forced — friction is at the cascade boundary + UX surface, both addressable without changing the entity model.

## Consequences

### Good (as-is)

- **Workshop flow is never blocked by integrity checks.** Load demo → edit → save side notes on a still-imperfect gap → continue. The save always works.
- **Dangling-ID tolerance is uniform** — every reader uses `(arr || []).indexOf` / `Array.find` patterns that gracefully skip missing entities.
- **Migration story is simple** — orphans don't break load.

### Bad (as-is) — to be addressed

- **R-INT-2 architecture violation persists** — `ContextView.js:130` still does `session.customer.drivers.splice()`. Eyes-on-the-code quality drift.
- **R-INT-3 ghost data** — gaps with deleted-driver pointers appear in "Unassigned" swimlane silently. User has no signal that "this used to have a driver before you removed Cyber Resilience".
- **Long-running sessions accumulate orphans** — over months of workshops, `gap.relatedCurrentInstanceIds` may contain dead IDs invisible to the user. Renders fine; just untidy.

### Good (planned)

- **Single helper module** `interactions/contextCommands.js` ends the architecture violation cleanly.
- **`removeDriver` cascade** prevents ghost data without changing the entity model.
- **Same-pattern optional `deleteInstance` cascade** would tidy up the relationship arrays at delete-time.

## When to revisit

1. **CMDB-vs-UX evaluation post-`v2.4.11.d02`** — the planned tightening is a UX-visualisation fix, not a structural rewrite. If after evaluating the C4 + ER diagrams (this `+d02` pass's deliverables) the team decides on CMDB normalisation, this ADR is superseded.
2. **R-INT-2 fix lands** (v2.5.x) — supersede this ADR with one that codifies the new mutation-discipline pattern.
3. **A user reports a "ghost driver" bug** — surfaces R-INT-3 as a real workshop friction. Bumps priority of `removeDriver` cascade.

See [docs/MAINTENANCE_LOG.md · v2.4.11.d01 · Relationship complexity audit](../MAINTENANCE_LOG.md) for the full inventory of FK-style fields and the integrity findings (R-INT-1 through R-INT-7).
