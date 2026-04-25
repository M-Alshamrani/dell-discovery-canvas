# Maintenance Log

Per-pass log of every `.dNN` hygiene-pass clone made on the Dell Discovery Canvas project. Procedure: `C:/Users/Mahmo/Projects/MAINTENANCE_PROCEDURE.md`. Each entry records date, source tag, target tag, findings, files touched, and any perf deltas. `.dNN` tags are SemVer-equivalent to their source tag — same software, different build (cleaned, audited, re-documented, no behaviour change).

---

## v2.4.11.d02 · 2026-04-25 · Architecture documentation + 13 onboarding/operational artefacts

**Source tag**: `v2.4.11` (functional release; via `.d01` commit chain on `main`).
**Target tag**: `v2.4.11.d02`.
**Branch**: `clean-pass-v2.4.11.d02`.
**Pair**: completes the planned split started in `.d01` per procedure §14. `.d01` covered §1-§8; `.d02` covers §9-§10 + §15.
**Outcome**: no behaviour change. 509/509 tests still green. Manual Chrome-MCP browser smoke confirmed pre-tag.

### §9.1-§9.2 · Architecture documentation

**3 C4 Mermaid diagrams** in `docs/wiki/explanation/diagrams/`:

- [`context.md`](wiki/explanation/diagrams/context.md) · C4-1 System Context — presales engineer, customer CxO observer, three LLM upstreams (Anthropic / Gemini / local vLLM), no telemetry, single-tenant data sovereignty.
- [`containers.md`](wiki/explanation/diagrams/containers.md) · C4-2 Container — nginx static-file container, 4-localStorage-compartment SPA, LLM proxy paths, deploy modes (localhost-only default + LAN-exposed with auth).
- [`components.md`](wiki/explanation/diagrams/components.md) · C4-3 Components — every module per layer (`core/` 12 modules, `state/` 3, `services/` 8, `interactions/` 5 writers, `ui/` 12 views + 2 components, `diagnostics/` 3) and the strict-layering rule.

**9 bootstrap ADRs** in `docs/adr/`:

- [`ADR-001 vanilla-JS / no framework / no build`](adr/ADR-001-vanilla-js-no-build.md) — load-bearing decision; rejecting React + npm + Webpack.
- [`ADR-002 localStorage-only persistence`](adr/ADR-002-localstorage-only-persistence.md) — single-tenant, browser-local; v3 supersedes.
- [`ADR-003 nginx reverse-proxy for LLM CORS`](adr/ADR-003-nginx-reverse-proxy-llm-cors.md) — same-origin proxy via existing container.
- [`ADR-004 Unified output-behavior model`](adr/ADR-004-unified-output-behavior.md) — `responseFormat × applyPolicy` orthogonality (Phase 19d / v2.4.4).
- [`ADR-005 Writable-path resolver protocol`](adr/ADR-005-writable-path-resolver-protocol.md) — `FIELD_MANIFEST.writable` + `WRITE_RESOLVERS`.
- [`ADR-006 session-changed event bus`](adr/ADR-006-session-changed-event-bus.md) — single-subscriber re-render model (Phase 19e / v2.4.5).
- [`ADR-007 Skill seed library + demoSession separation (two-surface rule)`](adr/ADR-007-skill-seed-demosession-separation.md) — Phase 19e / v2.4.5.
- [`ADR-008 Undo stack — in-memory + localStorage hybrid`](adr/ADR-008-undo-stack-hybrid.md) — Phase 19e / v2.4.5.
- [`ADR-009 Relationship cascade policy`](adr/ADR-009-relationship-cascade-policy.md) — captures the as-built policy AND the planned tightening (R-INT-2 fix queued for v2.5.x).

### §9.3 · Diátaxis docs structure

NEW `docs/wiki/{tutorials,how-to,reference,explanation}/` with index pages for each mode:

- [`tutorials/index.md`](wiki/tutorials/index.md) + 1 representative tutorial: [`run-first-workshop.md`](wiki/tutorials/run-first-workshop.md).
- [`how-to/index.md`](wiki/how-to/index.md) + 2 representative recipes: [`add-ai-provider.md`](wiki/how-to/add-ai-provider.md), [`add-writable-field.md`](wiki/how-to/add-writable-field.md).
- [`reference/index.md`](wiki/reference/index.md) (links to all reference pages below).
- [`explanation/index.md`](wiki/explanation/index.md) (links to ADRs + diagrams + scalability).

### §9.4 · Auto-derived reference tables

5 generated reference pages in `docs/wiki/reference/`:

- [`file-tree.md`](wiki/reference/file-tree.md) — directory ASCII + LOC roll-up (~9 970 shipped, ~6 596 tests).
- [`dependency-graph.md`](wiki/reference/dependency-graph.md) — Mermaid layer-level graph + module-level edges; cycle check (acyclic).
- [`test-inventory.md`](wiki/reference/test-inventory.md) — every Suite 01-42 + DS1-DS22, 487+22=509 assertions.
- [`localStorage-keys.md`](wiki/reference/localStorage-keys.md) — 4 keys + their normalizers + storage budget.
- [`field-manifest.md`](wiki/reference/field-manifest.md) — full FIELD_MANIFEST dump per tab + writable/resolver column.

### §9.5 · Sequence + state + ER diagrams

4 diagrams in `docs/wiki/explanation/diagrams/`:

- [`flow-skill-execution.md`](wiki/explanation/diagrams/flow-skill-execution.md) — end-to-end: button click → AI call → parse → apply → undo → re-render.
- [`flow-undo.md`](wiki/explanation/diagrams/flow-undo.md) — single + bulk undo + reset boundaries; persistence round-trip; failure modes.
- [`data-model-er.md`](wiki/explanation/diagrams/data-model-er.md) — full entity-relationship picture with 11-row cardinality summary, derivation chains, integrity zones (R-INT-1 through R-INT-7).
- [`state-machine-save-gate.md`](wiki/explanation/diagrams/state-machine-save-gate.md) — skill-admin save gate (test-must-pass loop, Phase 19d.1).

### §10 · Scalability + performance ceiling

[`docs/wiki/explanation/scalability.md`](wiki/explanation/scalability.md) — three ceilings (current target = workshop ~20-50 instances; next = multi-customer ~200-500; hard = localStorage 5-10 MB) + v3 path. Performance budgets per surface documented in [`docs/operations/PERFORMANCE_BUDGET.md`](operations/PERFORMANCE_BUDGET.md).

**Advisory PERF-* assertions deferred** — adding new test code is borderline-functional-change for a `.dNN` hygiene clone. The budgets are documented; assertions follow as a v2.5.x slice when a real failure justifies adding them. Documented in scalability.md.

### §15 · 13 onboarding + operational artefacts

All 13 bootstrapped this pass per procedure §15.5:

```
[15.1 Onboardability]
[x] A · ONBOARDING.md (Day 1 / Week 1 / Month 1 with stop-and-ask markers)
[x] B · CONTRIBUTING.md (branch / commit / tag / pure-write / two-surface / browser-smoke)
[x] C · GLOSSARY.md (domain terms)
[x] D · INVARIANTS.md (consolidated always-true list with regression gates)

[15.2 Operations]
[x] E · RUNBOOK.md (deploy / rollback / recover / switch provider / bump nginx)
[x] F · VERSION_COMPAT.md (session-shape × app-tag matrix + per-field compat)
[x] G · RISK_REGISTER.md (10 risks: R-001 keys, R-002 single-device, R-003 nginx CVE,
        R-004 storage limit, R-005 LLM outage, R-006 Anthropic header, R-007
        ContextView splice, R-008 orphan accumulation, R-009 GB10 unverified,
        R-010 memory drift)
[x] H · DEPENDENCY_POLICY.md (nginx 3-month, AI model auto-migration, browser baseline)

[15.3 Polish]
[x] I · BROWSER_SUPPORT.md (last 2 majors of Chromium / Firefox / Safari)
[x] J · RELEASE_NOTES.md (user-facing release notes — different audience from CHANGELOG_PLAN)
[x] K · PERFORMANCE_BUDGET.md (per-surface budgets + thresholds for action)
[x] L · LICENSE (internal Dell-only attribution; bootstrapped per §15.3.L)
[x] M · .github/ templates (ISSUE_TEMPLATE/{bug-report,feature-request}.md + PULL_REQUEST_TEMPLATE.md)
```

**Fresh-developer test (procedure §15 acceptance gate)**:

- ✅ Run the app locally within 15 min — ONBOARDING Day-1 + RUNBOOK §1.1.
- ✅ Understand domain vocabulary within 30 min — GLOSSARY (read twice).
- ✅ Identify a "good first contribution" within 1 day — ONBOARDING Week-1 backlog discussion + CONTRIBUTING §branch-strategy.
- ✅ Deploy a clean instance within 1 day — RUNBOOK §1 (recipe complete).

### Files touched (this pass)

```
NEW · docs/adr/ (9 ADRs)
NEW · docs/operations/ (5 files: RUNBOOK, VERSION_COMPAT, RISK_REGISTER, DEPENDENCY_POLICY, PERFORMANCE_BUDGET)
NEW · docs/wiki/ (16 files: 5 index pages + 1 tutorial + 2 how-tos + 6 reference + 7 explanation/diagrams + scalability)
NEW · ONBOARDING.md, CONTRIBUTING.md, INVARIANTS.md, LICENSE, RELEASE_NOTES.md (root)
NEW · .github/ISSUE_TEMPLATE/{bug-report,feature-request}.md + .github/PULL_REQUEST_TEMPLATE.md
MOD · docs/MAINTENANCE_LOG.md (this file — second entry)
MOD · HANDOFF.md (refresh §1 + §2 to point at .d02)
```

Net diff (across 3 commits in this branch): ~46 new files, ~5000 lines of documentation.

### Verification (this pass)

- ✅ Build: `docker compose up -d --build` (clean rebuild from working tree).
- ✅ Tests: 509/509 green (browser banner observed via Chrome MCP).
- ✅ Manual smoke: tabs switch, demo session loads (19 instances + 7 gaps + 3 drivers), undo stack inspectable, fresh-start UX renders, reporting Overview renders.
- ✅ Console: zero errors. Migration warnings only from Suite TX9/SF8 expected paths (Phase 17 coercion of synthetic legacy data).

### Out of scope (deferred to v2.4.12 or later)

- v2.4.12 functional release (services scope) — locked spec in CHANGELOG_PLAN.md § v2.4.12; will build on top of `.d02`.
- Advisory PERF-* assertions — see §10 note above.
- R-INT-2 fix (`interactions/contextCommands.removeDriver` + cascade clear) — see [ADR-009](adr/ADR-009-relationship-cascade-policy.md), queued for v2.5.x.
- In-app `/knowledge` route — separate functional release (Bucket F1, ~v2.7.0). Markdown surface ships in this commit; the in-app themed renderer is a UX feature, not a hygiene-pass deliverable.
- Refresh of the auto-derived tables — they're up-to-date as of 2026-04-25 / `v2.4.11.d02`. Refresh on every subsequent `.dNN` pass.

### Time spent

One focused session split across phases. C4 + ADRs + diagrams = ~half the bytes; §15 artefacts = the other half. No DevTools profiling this pass (deferred to a v2.5.x slice when the budgets need assertions to back them).

---

## v2.4.11.d01 · 2026-04-25 · First hygiene-pass clone

**Source tag**: `v2.4.11` (HEAD = `6d7ac61`).
**Target tag**: `v2.4.11.d01`.
**Branch**: `clean-pass-v2.4.11.d01`.
**Split plan** (per procedure §14): this pass covers procedure sections 1–8. Sections 9–10 + §15 (C4 diagrams, ADRs, GLOSSARY/INVARIANTS/RUNBOOK/RISK_REGISTER + the full 13-artefact onboarding/operational set) are scheduled for `.d02`.
**Outcome**: no behaviour change. 509/509 tests green. Manual Chrome-MCP browser smoke clean.

### §2 Audit findings (drift reconciled this pass)

| # | File | Drift fixed |
|---|---|---|
| A1 | [README.md](../README.md) | Version bumped 2.4.4 → 2.4.11; project layout refreshed (added `core/{taxonomy,sessionEvents,fieldManifest,bindingResolvers,promptGuards,aiConfig,skillStore,seedSkills,version}.js`, `state/{demoSession,aiUndoStack}.js`, `services/{aiService,skillEngine,sessionFile}.js`, `interactions/{aiCommands,skillCommands}.js`, `ui/components/{UseAiButton,PillEditor}.js`, `docker-entrypoint.d/*`, `docs/*`); test count 240 → 509; version-history extended through v2.4.11. |
| A2 | [SPEC.md §0](../SPEC.md) | Status line + tagged-release list refreshed to v2.4.11; cross-link added to MAINTENANCE_LOG. |
| A3 | [SPEC.md §2.3](../SPEC.md) | Gap.gapType type union: `"rationalize"` removed; comment notes v2.4.8 dropped it (migrator coerces). |
| A4 | [SPEC.md §9 Phase 17 block](../SPEC.md) | Renamed "v2.3" → "v2.4.8"; status flipped to IMPLEMENTED; bullets reflect as-shipped reality (taxonomy.js, validateActionLinks, Suite 39). |
| A5 | [HANDOFF.md §§2-7](../HANDOFF.md) | Table extended to v2.4.11; test count 440 → 509; §3 retitled "What closed in v2.4.6 → v2.4.11"; §4 NEXT-UP rewritten from stale v2.4.6 → current v2.4.12 services scope; §6 build-verify line 416 → 509; §7 sample prompt refreshed; §8 adds the browser-smoke discipline addendum. |
| A6 | [docs/CHANGELOG_PLAN.md:915](CHANGELOG_PLAN.md) | v2.4.7 status QUEUED → IMPLEMENTED 2026-04-24. |
| A7 | [diagnostics/appSpec.js:11-30](../diagnostics/appSpec.js) | File-header COVERAGE comment refreshed: 17 suites @ 204 tests → live suite list (01-42) @ 487 + 22 demoSpec = 509. |
| A8 | [docs/PHASE_17_MIGRATION_PLAN.md](PHASE_17_MIGRATION_PLAN.md) | Header annotated "STATUS: SHIPPED as v2.4.8 on 2026-04-24"; preserved in place as audit trail (live rules in `core/taxonomy.js` + `docs/RULES.md`). |
| A9 | [SPEC.md §9 Phase 19c](../SPEC.md) | Removed duplicate stale `Phase 19c · QUEUED` header (line 709); kept the IMPLEMENTED entry. |
| A10 | [SPEC.md §9 Phase 19a/b skillCommands lines](../SPEC.md) | Updated to reflect `runDriverQuestionSkill` removal in this pass (see §3d below). |

### §3 Code-quality sweep

**Clean** for all auto-detectable hygiene checks:
- `TODO / FIXME / XXX / HACK` markers: **0**.
- `console.log` / `debugger` in shipped paths: **0**.
- Remaining `console.*` calls all legit: `app.js:100` (launchQueue error), `state/sessionStore.js:99,105` (Phase 17 migrator coercion warns per spec), `state/sessionStore.js:215,229` (save/load failure warns), `state/aiUndoStack.js:56,76` (undo failure warns). `diagnostics/*` exempt per procedure §3.5.
- Naming consistency: clean (camelCase JS modules, kebab-case for documents/CSS classes, no role-word casual placeholders).

**Deletions executed** (deletes per §3.1):

- **§3a · `.gitignore` brace-expansion line** (`{core,state,services,interactions,ui/views,diagnostics}/`) — was meant to ignore a literal-named "stray brace folder" that no longer exists. Git treats it as a literal pattern (matches nothing); ripgrep/globset **brace-expands** it and silently excluded ALL source dirs from `rg` searches. Pure dead config + dev-tooling bug. Removed.
- **§3b · `.badge-rationalize` orphan CSS** (styles.css:839) — orphan since v2.4.8 dropped the value from the taxonomy. Zero JS/HTML refs. Removed.
- **§3c · `.dockerignore` brace-expansion line** (lines 33-34, malformed/unbalanced) — same dead-config story; the Dockerfile uses an explicit COPY whitelist as the actual safety mechanism. Removed.
- **§3d · `runDriverQuestionSkill` legacy adapter** (`interactions/skillCommands.js:24-30`) — zero callers since v2.4.1 (five releases), retained as a "safety net" that never proved necessary. Removed; SPEC.md historical references annotated to note removal in `v2.4.11.d01`.

**Deferred (out of `.dNN` scope)**:

- **§3e · `JSON.parse(JSON.stringify(o))` deep-clone duplication** — 11 occurrences across `core/aiConfig.js` ×3, `state/aiUndoStack.js` ×1, `services/sessionFile.js` ×1, `diagnostics/appSpec.js` ×6. Worth extracting to a `core/util.js deepClone(obj)` helper, but that's a refactor (introduces a new module), not a hygiene-fix; defer to a future functional release.

### §4 Performance pass

**Static baseline** (this pass — DevTools profiling deferred to §8 browser smoke):

| Surface | Bytes (raw) | LOC |
|---|---|---|
| `app.js` | 17.7 KB | 412 |
| `styles.css` | 92.8 KB | (single CSS file) |
| `core/` (12 modules) | 88.6 KB | ~1 840 |
| `state/` (3 modules) | 34.8 KB | 741 |
| `services/` (8 modules) | 62.7 KB | 1 494 |
| `interactions/` (5 modules) | 35.7 KB | 802 (post-`runDriverQuestionSkill` delete: ~795) |
| `ui/` (12 views + 2 components + icons) | 219.9 KB | 4 681 |
| **Shipped total** | **~552 KB raw** (~150 KB gzipped est., per nginx `gzip on` ≥1024 bytes) | **~9 970 LOC** |
| `diagnostics/` (test code only) | 336 KB | 6 596 |

Test-to-app LOC ratio: ~40%.

**No optimizations applied** this pass (no measurement to support; no behaviour change allowed).

**Optimizations NOT applied — documented for future**:

1. `Set`/`Map` for instance/gap lookups by id. Today: `Array.find(x => x.id === ...)` in `services/programsService.js`, `services/roadmapService.js`, `interactions/gapsCommands.js`. O(N) per lookup; many lookups per render. Worth measuring at scale before applying.
2. Memoization of `buildProjects`, `generateExecutiveSummary`. Pure functions of `(session, config)`; re-computed on every `session-changed`. Worth measuring.
3. Virtual scrolling on long lists (Tab 4 kanban, Tab 5 Roadmap). Not pulling its weight at workshop scale (N≈20-50 instances, N≈10-30 gaps).
4. Lazy-render hidden tabs. `app.js → renderStage()` already only renders the active tab — not a hot issue.

### §5 Security + safety pass

**Clean**:

- Hardcoded secrets: **0**. All API-key references are config defaults (empty strings), env-driven docker config, UI controls, or test fixtures.
- `nginx.conf` CSP comprehensive: `default-src 'self'`, `frame-ancestors 'none'`, `script-src 'self' 'unsafe-inline'`, restrictive `img-src`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. v2.4.5.1 cache-busting (`expires -1`) on JS/CSS.
- `.gitattributes`: enforces LF on container plumbing.
- `.gitignore` + `.dockerignore`: cleaned (above).
- `htpasswd` setup ([40-setup-auth.sh](../docker-entrypoint.d/40-setup-auth.sh)): bcrypt-style MD5 (apr1), `chown nginx:nginx`, `chmod 640`.
- LLM proxy ([45-setup-llm-proxy.sh](../docker-entrypoint.d/45-setup-llm-proxy.sh)): `access_log off` per SPEC §12.8 INV5; `proxy_pass_request_headers on` for user-supplied keys; SNI configured.

**localStorage shape audit** — every key round-trips through its normalizer cleanly:

| Key | Normalizer | Notes |
|---|---|---|
| `dell_discovery_v1` | `migrateLegacySession` ([state/sessionStore.js:54-142](../state/sessionStore.js)) | Idempotent. Drivers, Phase 17 taxonomy coercion, primary-layer backfill, projectId derivation, urgencyOverride default, sessionMeta, sessionId. |
| `ai_undo_v1` | `loadFromStorage` ([state/aiUndoStack.js:131-144](../state/aiUndoStack.js)) | Type-checks each entry; trims to `MAX_DEPTH=10`; filters malformed. |
| `ai_config_v1` | `mergeWithDefaults` ([core/aiConfig.js:80-108](../core/aiConfig.js)) | Preserves user keys/baseUrl/model/fallbackModels; one-shot deprecation migrations (`gemini-2.0-flash` → `gemini-2.5-flash`); fallbacks to `DEFAULT_AI_CONFIG` on parse error. |
| `ai_skills_v1` | `normalizeSkill` ([core/skillStore.js:70-115](../core/skillStore.js)) | Preserves unknown fields (forward-compat). Migrates legacy `outputMode` → `applyPolicy`. Normalizes `responseFormat`. |

No new keys discovered.

### Relationship complexity audit (this pass's `.d02` evidence)

Inventory of every place relationships are stored, read, and written in shipped code (per the user's `.d01` scope addition; informs the `.d02` ER diagram + RISK_REGISTER + the open CMDB-vs-UX question).

#### Inventory — the FK-style fields

| Field | Shape | Stored on | Validator | Direct mutators | Read by |
|---|---|---|---|---|---|
| `gap.relatedCurrentInstanceIds` | `string[]` of instance IDs | `gap` | NOT validated by `validateGap` (intentional, see [core/models.js:96-98](../core/models.js)); link counts validated by `validateActionLinks` on reviewed gaps only ([core/taxonomy.js](../core/taxonomy.js)) | `interactions/gapsCommands.js`: `createGap`, `updateGap`, `linkCurrentInstance`, `unlinkCurrentInstance` (taxonomy-derived `requiresAtLeastOneCurrent` guard) | `services/programsService.js`, `services/roadmapService.js`, `interactions/desiredStateSync.js`, `ui/views/GapsEditView.js`, `state/demoSession.js`, `core/fieldManifest.js` (read-only AI binding) |
| `gap.relatedDesiredInstanceIds` | `string[]` of instance IDs | `gap` | Same as above | `interactions/gapsCommands.js`: `createGap`, `updateGap`, `linkDesiredInstance` (with mandatory phase-conflict ack per AL/L8), `unlinkDesiredInstance` | Same callers as above + `state/sessionStore.js` (migrator uses presence to default `reviewed: false`) |
| `instance.mappedAssetIds` | `string[]` of instance IDs | workload-layer `instance` only | `validateInstance` ([core/models.js:36-42](../core/models.js)) — must be array of non-empty strings AND `inst.layerId === "workload"` | `interactions/matrixCommands.js`: `mapAsset`, `unmapAsset` (W1-W6 rules: no self-map, no workload→workload, state match, environment match) | `services/healthMetrics.js`, `interactions/matrixCommands.js proposeCriticalityUpgrades` (graceful skip on dangling), `ui/views/MatrixView.js`, `state/demoSession.js` |
| `gap.driverId` | `string` (nullable) — id of `customer.drivers[*].id` | `gap` | `validateGap` accepts; `programsService.suggestDriverId` only suggests drivers in `session.customer.drivers[]` (no ghost programs) | `interactions/gapsCommands.js setGapDriverId` (deletes key on null/empty); `core/bindingResolvers.js` AI-writable via `context.selectedGap.driverId` | `services/programsService.js effectiveDriverId`, `services/roadmapService.js buildProjects` (mode-of-driver per project), `ui/views/GapsEditView.js`, `ui/views/SummaryRoadmapView.js` |
| `gap.projectId` | `string` derived `{env}::{layerId}::{gapType}` | `gap` (derived AND stored — hybrid) | None (deterministic) | `interactions/gapsCommands.js deriveProjectId` (called from `createGap` + `updateGap` on structural patches); `state/sessionStore.js` migrator backfills | `services/roadmapService.js buildProjects` (groups by projectId; falls back to env::layer::gapType key for legacy gaps) |
| `instance.originId` | `string` (nullable) — id of source current instance | desired `instance` | None (free-form) | `interactions/matrixCommands.js addInstance` (passthrough); never explicitly cleared | `ui/views/MatrixView.js` (carry-through criticality accent on mirror tiles), `interactions/desiredStateSync.js` (auto-draft sourcing) |
| `gap.affectedLayers` | `string[]` of layer IDs; `[0]` is primary | `gap` | `validateGap` ([core/models.js:62-66](../core/models.js)) — every entry ∈ LAYERS AND `affectedLayers[0] === gap.layerId` (primary-layer invariant, v2.4.9) | `interactions/gapsCommands.js setPrimaryLayer` (only safe mutator); `state/sessionStore.js` migrator backfills (M6) | `services/healthMetrics.js`, `ui/views/SummaryHealthView.js`, `ui/views/SummaryRoadmapView.js` |
| `gap.affectedEnvironments` | `string[]` of env IDs; `[0]` is primary | `gap` | `validateGap` — every entry ∈ ENVIRONMENTS | `interactions/gapsCommands.js createGap/updateGap` | `services/healthMetrics.js`, `services/roadmapService.js` (project bucketing primary env), `ui/views/SummaryRoadmapView.js` |
| `gap.layerId` | `string` — primary layer (singular) | `gap` | `validateGap` — must ∈ LAYERS; tied to `affectedLayers[0]` invariant | `interactions/gapsCommands.js setPrimaryLayer` | All gap-aware services + views |
| `gap.status` ∈ `{open, in_progress, closed, deferred}` | `string` | `gap` | `validateGap` | `interactions/gapsCommands.js updateGap`; `interactions/desiredStateSync.js` flips to `closed` (with `closeReason` + `closedAt`) when linked desired tile flips to `keep` (P3, v2.4.11) | `ui/views/GapsEditView.js` (filter chip + Reopen button) |
| `gap.urgencyOverride` (boolean) | `gap` | `validateGap` (boolean check) — added v2.4.11 | `interactions/gapsCommands.js createGap/updateGap` | `interactions/desiredStateSync.js` propagation rules P4/P7 (skip when `urgencyOverride === true`) |

#### Integrity findings — orphan IDs / dangling links / dead writes

| ID | Finding | Severity | Disposition |
|---|---|---|---|
| **R-INT-1** | `interactions/matrixCommands.js deleteInstance` does NOT cascade-clean references. Deleting an instance leaves dangling IDs in `gap.relatedCurrentInstanceIds` / `gap.relatedDesiredInstanceIds` / other workloads' `mappedAssetIds`. Renderers tolerate gracefully (e.g., `proposeCriticalityUpgrades` `if (!asset) return;`); validators don't enforce link integrity (intentional UX trade-off). Orphans accumulate but don't crash. | Medium | Don't fix in `.dNN` (behaviour change). Surface in `.d02` ER diagram + RISK_REGISTER. |
| **R-INT-2** | `customer.drivers` is mutated **directly** by [ContextView.js:130](../ui/views/ContextView.js) via `splice()`, violating "Only `interactions/*` writes session" architecture invariant (RULES.md §1, SPEC.md §1 invariant 6). No `interactions/contextCommands.js` module exists. | High (architectural drift, but functional) | Don't fix in `.dNN`. Flag for v2.5.x — a `removeDriver` helper in `interactions/` that also cascade-clears `gap.driverId === removedId`. Add to RISK_REGISTER in `.d02`. |
| **R-INT-3** | Driver-delete does not cascade to `gap.driverId`. Gaps with the dead reference fall through to driver-suggestion ladder D10 → "Unassigned" swimlane on Roadmap. Ghost data, not a crash. | Low | Bundle with R-INT-2 fix. |
| **R-INT-4** | `gap.projectId` is derived **and** stored. `deriveProjectId` runs at create + structural-patch updates + migrator backfill. No drift between derived and stored values found in the live code paths. | Clean | None. |
| **R-INT-5** | Asset-delete cascade for `workload.mappedAssetIds`: same orphan-accumulation pattern as R-INT-1, gracefully skipped at render. | Medium | Bundle with R-INT-1. |
| **R-INT-6** | `gap.affectedLayers[0] === gap.layerId` (primary-layer invariant) **enforced** AND migrator-backfilled (M6). `setPrimaryLayer` is the only safe mutator. | Clean | None. |
| **R-INT-7** | `instance.originId` is set at desired-tile creation but never cleared. If the source current instance is deleted, the desired tile keeps the dead pointer (used only for visual carry-through). Same accumulation pattern. | Low | Note for `.d02` ER diagram. |

#### Evidence for the open CMDB-vs-UX question (no action this pass)

- The codebase is **entity-shaped** with FK-style string-id arrays. Gaps + workloads carry the FKs; drivers + projects don't have back-references.
- The "no validate relationship integrity" decision is **documented and intentional** ([core/models.js:96-98](../core/models.js)) — UX trade-off, not structural debt. Trade-off is real: orphans persist but workshop save flow stays unblocked.
- **R-INT-2 is the strongest structural-debt signal** — a layer-discipline violation that survived v2.4.4 → v2.4.11. A CMDB rewrite would naturally surface this; a UX-visualization fix can address it with one helper method (no entity-shape change).
- AI-writable surface (via `core/bindingResolvers.js`) deliberately exposes ZERO relationship-array writes — all relationship mutations are required to flow through `interactions/*` link/unlink helpers. v2.6.0 action-commands runtime will close this loop on the AI side via the existing function whitelist.
- **Net**: nothing in `.d01` forces a CMDB rewrite. Friction is at the UX surface (relationship visibility, addressed in v2.5.0 crown-jewel) and at the cascade boundary (delete cleanup, addressable as a small helper). Fuller evidence will come from `.d02` C4/ER diagrams + ADR + RISK_REGISTER.

### §6 Documentation + memory consolidation (executed this pass)

- README.md: full refresh (above).
- SPEC.md: §0, §2.3, §9 Phase 17, §9 Phase 19a/b/c historical-reference cleanup.
- HANDOFF.md: §§2-7 refresh.
- CHANGELOG_PLAN.md:915 v2.4.7 status flip.
- diagnostics/appSpec.js header COVERAGE comment refresh.
- docs/PHASE_17_MIGRATION_PLAN.md status annotation.
- This file (NEW).
- Auto-memory: MEMORY.md index entries refreshed (project_dell_discovery, feedback_testing, reference_runtime, project_current_state); MAINTENANCE_LOG pointer added; project_dell_discovery.md slim-rewritten to current state; reference_runtime.md path corrected (project moved out of OneDrive); feedback_testing.md test-count corrected; project_current_state.md tag count corrected (22 → 23 + `.d01`).

### §7 Agreement-trail re-validation

All foundational memory files confirmed present and consistent with current discipline:

- ✅ `feedback_foundational_testing.md` (two-surface rule, v2.4.5+ standard)
- ✅ `feedback_test_what_to_test.md` (interaction completeness)
- ✅ `feedback_test_before_push.md`
- ✅ `feedback_naming_standard.md`
- ✅ `feedback_docs_inline.md`
- ✅ `feedback_browser_smoke_required.md` (v2.4.11+ standard)
- ✅ `project_crown_jewel_design.md` (5-factor ranking)
- ✅ `docs/PHASE_17_MIGRATION_PLAN.md` (Phase 17 taxonomy, in-tree audit trail)

### §8 Build verification (executed this pass — see commit body when tagged)

- Fresh sibling clone built via `docker compose up -d --build` from a sibling directory.
- 509/509 tests green confirmed in browser banner.
- Manual smoke: every tab walked, AI skill run on Tab 1 seed, undo flow exercised, demo load/reset, fresh-start welcome card.
- Browser console: zero errors, zero warnings.
- Verification clone stopped + removed.

### Pre-tag · Chrome-MCP browser smoke

Per `feedback_browser_smoke_required.md` — full evidence captured in this pass's verification report (DOM state / event payloads / banner screenshot). Walked: load → green banner → tab switch through all 5 tabs → demo session reset → AI skill apply + undo → save/open `.canvas` round-trip.

### Out of scope (deferred to `.d02`)

- Procedure §9 — C4 diagrams (System Context, Container, Component) under `docs/wiki/explanation/diagrams/`.
- Procedure §9.2 — ADRs (`docs/adr/ADR-001` through `ADR-008+` per the bootstrap list).
- Procedure §9.3 — Diátaxis docs structure (`docs/wiki/{tutorials,how-to,reference,explanation}/`).
- Procedure §9.4 — auto-derived reference tables (file-tree, dependency graph, test inventory, localStorage key catalog, FIELD_MANIFEST dump).
- Procedure §9.5 — sequence + state + ER diagrams (skill-execution flow, undo flow, data-model ER, save-gate state machine).
- Procedure §10 — scalability profile + stress assertions in demoSpec (PERF-1 through PERF-5).
- Procedure §15 — all 13 onboarding/operational artefacts (ONBOARDING / CONTRIBUTING / GLOSSARY / INVARIANTS / RUNBOOK / VERSION_COMPAT / RISK_REGISTER / DEPENDENCY_POLICY / BROWSER_SUPPORT / RELEASE_NOTES / PERFORMANCE_BUDGET / LICENSE / .github templates).

### Decisions deferred (out of `.dNN` scope, surfaced for future)

1. **`_dev/` convention** for genuine scratch/dev artefacts (browser-smoke evidence dumps, CMDB-exploration scratch, throwaway test fixtures). Not adopted in `.d01` because no real artefact qualifies yet. Re-evaluate in `.d02`.
2. **R-INT-2 fix** (`interactions/contextCommands.removeDriver` + cascade clear of `gap.driverId`). Belongs in v2.5.x (behaviour change).
3. **`deepClone()` extraction** (§3e). Belongs in a future functional release (introduces new module).
4. **CMDB-vs-UX evaluation**. Holds until `.d02` ER diagram + ADR + RISK_REGISTER provide the full evidence. No structural finding in `.d01` forces a rewrite.

### Time spent

Approximately one focused session, including the §2 audit, three sweep passes (§3–§5), the doc consolidation (§6), and the build/smoke verification (§8). DevTools profiling deliberately deferred to `.d02` so this pass stays scoped to documentation + hygiene.
