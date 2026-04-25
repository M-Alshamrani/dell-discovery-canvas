# Explanation

**Audience**: anyone who wants to *understand why* the system is shaped the way it is.
**Mode**: prose, opinionated, narrative — design rationale and trade-offs.

An explanation is **not** a tutorial, how-to, or reference. It tells the *why* behind the *what*. If a reader needs to take an action, point them at a how-to. If they need to look up a fact, point them at the reference.

## The story, in three layers

### 1. C4 architecture diagrams

- **[diagrams/context.md](diagrams/context.md)** · **C4-1 System Context** — the system in its environment: presales engineer, customer CxO, three LLM upstreams, container host.
- **[diagrams/containers.md](diagrams/containers.md)** · **C4-2 Container** — runtime architecture: nginx static-file container, browser SPA module graph, four localStorage compartments, LLM proxy paths.
- **[diagrams/components.md](diagrams/components.md)** · **C4-3 Components** — the modules per layer (`core/`, `state/`, `services/`, `interactions/`, `ui/`, `diagnostics/`) and the strict layering rule.

### 2. Sequence + state + ER

- **[diagrams/data-model-er.md](diagrams/data-model-er.md)** — entity-relationship diagram. Every FK-style relationship + cardinality. Load-bearing for the open CMDB-vs-UX evaluation.
- **[diagrams/flow-skill-execution.md](diagrams/flow-skill-execution.md)** — what happens when a presales engineer clicks an AI skill. End-to-end.
- **[diagrams/flow-undo.md](diagrams/flow-undo.md)** — single + bulk undo + reset boundaries.
- **[diagrams/state-machine-save-gate.md](diagrams/state-machine-save-gate.md)** — skill-admin save gate (test-must-pass loop, Phase 19d.1).

### 3. Architecture Decision Records

The 9 load-bearing decisions, each with Status / Context / Decision / Alternatives / Consequences / When to revisit:

- **[ADR-001 · Vanilla JS · no framework · no build step](../../adr/ADR-001-vanilla-js-no-build.md)** — *the* foundational decision; rejecting React + npm + Webpack and shipping vanilla ES modules.
- **[ADR-002 · localStorage-only persistence](../../adr/ADR-002-localstorage-only-persistence.md)** — single-tenant, browser-local; v3 supersedes.
- **[ADR-003 · nginx reverse-proxy for LLM CORS](../../adr/ADR-003-nginx-reverse-proxy-llm-cors.md)** — same-origin proxy via the existing nginx container.
- **[ADR-004 · Unified output-behavior model](../../adr/ADR-004-unified-output-behavior.md)** — `responseFormat × applyPolicy` orthogonality (Phase 19d / v2.4.4).
- **[ADR-005 · Writable-path resolver protocol](../../adr/ADR-005-writable-path-resolver-protocol.md)** — `FIELD_MANIFEST.writable` + `WRITE_RESOLVERS` for AI writes.
- **[ADR-006 · `session-changed` event bus](../../adr/ADR-006-session-changed-event-bus.md)** — single-subscriber re-render model (Phase 19e / v2.4.5).
- **[ADR-007 · Skill seed library + demoSession separation (two-surface rule)](../../adr/ADR-007-skill-seed-demosession-separation.md)** — every data-model change ships demo + seed + demoSpec + DEMO_CHANGELOG in the same commit.
- **[ADR-008 · Undo stack — in-memory + localStorage hybrid](../../adr/ADR-008-undo-stack-hybrid.md)** — persistent, bounded, labelled (Phase 19e / v2.4.5).
- **[ADR-009 · Relationship cascade policy](../../adr/ADR-009-relationship-cascade-policy.md)** — current state + planned tightening for v2.5.x.

## Other explanation pieces

- **[scalability.md](scalability.md)** — current target, next ceiling, hard ceiling, v3 path.
- **[../../INVARIANTS.md](../../INVARIANTS.md)** — consolidated always-true list; cross-references the regression test for each.

## Reading order if you want to write code

1. ADR-001 (the most load-bearing).
2. C4 context + containers.
3. Components diagram + the strict layering rule.
4. ADR-002 + ADR-006 (data + events — the spine of the architecture).
5. The relevant flow diagram (skill-execution if you're touching AI; undo if you're touching mutation paths).

## Reading order if you want to evaluate the CMDB question

1. **[diagrams/data-model-er.md](diagrams/data-model-er.md)** — full entity-relationship picture.
2. **[ADR-009](../../adr/ADR-009-relationship-cascade-policy.md)** — current + planned cascade policy.
3. **[docs/MAINTENANCE_LOG.md · v2.4.11.d01 § Relationship complexity audit](../../MAINTENANCE_LOG.md)** — the 11-field inventory + 7 R-INT findings.
4. **[docs/operations/RISK_REGISTER.md](../../operations/RISK_REGISTER.md)** — risks bearing on the question (orphan accumulation, layer-discipline drift).
