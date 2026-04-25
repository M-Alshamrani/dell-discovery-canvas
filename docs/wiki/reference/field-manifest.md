# FIELD_MANIFEST dump (auto-derived)

Generated for `v2.4.11.d02` from [`core/fieldManifest.js`](../../../core/fieldManifest.js).

The manifest is the **enumerable AI-binding surface**. Every entry declares a dot-path, a human label, a kind (`scalar` | `array`), and a `writable` flag. Skill admins surface only matching entries as binding chips. The `outputSchema` of any skill MUST only contain paths where `writable: true`.

---

## `SESSION_FIELDS` (shared across every tab)

| Path | Label | Kind | Writable |
|---|---|---|---|
| `session.customer.name` | Customer name | scalar | ✅ |
| `session.customer.vertical` | Customer vertical | scalar | ✅ |
| `session.customer.region` | Customer region | scalar | ✅ |
| `session.customer.drivers` | All drivers (array) | array | — |
| `session.instances` | All instances (array) | array | — |
| `session.gaps` | All gaps (array) | array | — |

Every tab's manifest extends `SESSION_FIELDS` with tab-specific `context.*` entries.

## `context` tab (Tab 1 · Drivers)

| Path | Label | Kind | Writable | Resolver? |
|---|---|---|---|---|
| `context.selectedDriver.id` | Selected driver id | scalar | — | n/a |
| `context.selectedDriver.label` | Selected driver label | scalar | — | n/a |
| `context.selectedDriver.shortHint` | Selected driver hint | scalar | — | n/a |
| `context.selectedDriver.priority` | Selected driver priority | scalar | ✅ | yes |
| `context.selectedDriver.outcomes` | Selected driver outcomes | scalar | ✅ | yes |

## `current` tab (Tab 2)

| Path | Label | Kind | Writable | Resolver? |
|---|---|---|---|---|
| `context.selectedInstance.label` | Selected tile label | scalar | — | n/a |
| `context.selectedInstance.vendor` | Selected tile vendor | scalar | — | n/a |
| `context.selectedInstance.vendorGroup` | Selected tile vendor group | scalar | — | n/a |
| `context.selectedInstance.criticality` | Selected tile criticality | scalar | ✅ | yes |
| `context.selectedInstance.notes` | Selected tile notes | scalar | ✅ | yes |
| `context.selectedInstance.layerId` | Selected tile layer | scalar | — | n/a |
| `context.selectedInstance.environmentId` | Selected tile environment | scalar | — | n/a |

## `desired` tab (Tab 3)

| Path | Label | Kind | Writable | Resolver? |
|---|---|---|---|---|
| `context.selectedInstance.label` | Selected tile label | scalar | — | n/a |
| `context.selectedInstance.vendor` | Selected tile vendor | scalar | — | n/a |
| `context.selectedInstance.disposition` | Selected tile disposition | scalar | ✅ | yes |
| `context.selectedInstance.priority` | Selected tile phase (priority) | scalar | ✅ | yes |
| `context.selectedInstance.notes` | Selected tile notes | scalar | ✅ | yes |
| `context.selectedInstance.layerId` | Selected tile layer | scalar | — | n/a |
| `context.selectedInstance.environmentId` | Selected tile environment | scalar | — | n/a |
| `context.selectedInstance.originId` | Selected tile current origin | scalar | — | n/a |

## `gaps` tab (Tab 4)

| Path | Label | Kind | Writable | Resolver? |
|---|---|---|---|---|
| `context.selectedGap.description` | Selected gap description | scalar | ✅ | yes |
| `context.selectedGap.gapType` | Selected gap type | scalar | ✅ | yes |
| `context.selectedGap.urgency` | Selected gap urgency | scalar | ✅ | yes |
| `context.selectedGap.phase` | Selected gap phase | scalar | ✅ | yes |
| `context.selectedGap.status` | Selected gap status | scalar | ✅ | yes |
| `context.selectedGap.notes` | Selected gap notes | scalar | ✅ | yes |
| `context.selectedGap.driverId` | Selected gap driver id | scalar | ✅ | yes |
| `context.selectedGap.layerId` | Selected gap primary layer | scalar | — | n/a |
| `context.selectedGap.affectedLayers` | Selected gap affected layers | array | — | n/a |
| `context.selectedGap.affectedEnvironments` | Selected gap affected envs | array | — | n/a |
| `context.selectedGap.relatedCurrentInstanceIds` | Selected gap linked current | array | — | n/a |
| `context.selectedGap.relatedDesiredInstanceIds` | Selected gap linked desired | array | — | n/a |

**Note**: relationship-array writes (`relatedXxxInstanceIds`) are deliberately NOT exposed to AI. Cascade logic belongs in `interactions/*Commands.js`, not in resolvers ([ADR-005](../../adr/ADR-005-writable-path-resolver-protocol.md)). The v2.6.0 action-commands runtime ([SPEC §12.6](../../../SPEC.md)) will close this loop via the function whitelist.

## `reporting` tab (Tab 5)

| Path | Label | Kind | Writable | Resolver? |
|---|---|---|---|---|
| `context.selectedProject.name` | Selected project name | scalar | — | n/a |
| `context.selectedProject.gapCount` | Selected project gap count | scalar | — | n/a |
| `context.selectedProject.urgency` | Selected project urgency | scalar | — | n/a |
| `context.selectedProject.phase` | Selected project phase | scalar | — | n/a |
| `context.selectedProject.driverId` | Selected project driver id | scalar | — | n/a |
| `context.selectedProject.dellSolutions` | Selected project Dell solutions | array | — | n/a |

All Tab-5 `context.*` fields are read-only — projects are derived, not stored. Mutating a project means mutating its constituent gaps; that flow belongs to Tab 4.

## Roll-up

| Tab | Total entries | Writable scalars |
|---|---:|---:|
| context | 11 | 5 (3 session + 2 context) |
| current | 13 | 5 (3 session + 2 context) |
| desired | 14 | 6 (3 session + 3 context) |
| gaps | 18 | 10 (3 session + 7 context) |
| reporting | 12 | 3 (3 session + 0 context) |

**13 `WRITE_RESOLVERS` entries total** in [`core/bindingResolvers.js`](../../../core/bindingResolvers.js) — one per writable `context.*` path (the 2+2+3+7+0 = 14 above includes shared scalars; the 13 unique resolver paths are: `selectedDriver.priority/outcomes`, `selectedInstance.criticality/notes/disposition/priority`, `selectedGap.description/gapType/urgency/phase/status/notes/driverId`).

Tested by **Suite 32 DS9 / DS10** — every seed skill's outputSchema path exists in FIELD_MANIFEST AND has a resolver.

## Refresh trigger

Re-generate this file:
- When a new entry is added or removed from `core/fieldManifest.js`.
- When a `writable` flag flips.
- Every `.dNN` hygiene-pass.
