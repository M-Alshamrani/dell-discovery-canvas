# File tree (auto-derived)

Generated for `v2.4.11.d02`. Excludes `.git/`, `node_modules/` (none), and `Logo/`.

```
dell-discovery/
├── app.js                          412 LOC · 5-step router + .canvas launchQueue handler
├── index.html                       SPA shell
├── manifest.json                    PWA manifest (v2.4.10 — .canvas file_handlers)
├── robots.txt
├── styles.css                       single-file design system
├── start.bat / start.sh             reviewer-handoff scripts (host-only)
├── HOW_TO_RUN.md                    end-user-facing run guide
├── HANDOFF.md                       session-handoff state — read first in fresh sessions
├── README.md                        project front door
├── SPEC.md                          authoritative implementation spec
├── Dockerfile                       nginx:1.27-alpine multi-arch
├── docker-compose.yml               port 8080, env vars, host-gateway mapping
├── .gitignore                       OS noise + IDE + (cleaned of brace pattern in .d01)
├── .gitattributes                   LF eol on container plumbing
├── .dockerignore                    build-context exclusion (cleaned in .d01)
│
├── core/                            12 modules · ~88 KB · ~1 840 LOC
│   ├── aiConfig.js                  3-provider config + DEFAULT_AI_CONFIG
│   ├── bindingResolvers.js          13 WRITE_RESOLVERS for context.* writes
│   ├── config.js                    LAYERS, ENVIRONMENTS, CATALOG, BUSINESS_DRIVERS, CUSTOMER_VERTICALS
│   ├── fieldManifest.js             per-tab bindable-field manifest (writable: true gates AI writes)
│   ├── helpContent.js               help-modal prose
│   ├── models.js                    validateInstance, validateGap (+ primary-layer invariant v2.4.9)
│   ├── promptGuards.js              responseFormat-aware system-prompt footers
│   ├── seedSkills.js                6 seed skills auto-deployed on first run
│   ├── sessionEvents.js             pub/sub bus (52 LOC)
│   ├── skillStore.js                user-defined skill CRUD (ai_skills_v1)
│   ├── taxonomy.js                  7-term Action table (Phase 17)
│   └── version.js                   APP_VERSION constant
│
├── state/                           3 modules · ~34 KB · 741 LOC
│   ├── aiUndoStack.js               persistent undo (ai_undo_v1, cap 10)
│   ├── demoSession.js               Acme FSI + Meridian HLS + Northwind Public Sector personas
│   └── sessionStore.js              singleton + migrateLegacySession + persistence
│
├── services/                        8 modules · ~62 KB · ~1 494 LOC · pure reads
│   ├── aiService.js                 chatCompletion + retry/backoff + fallback chain
│   ├── gapsService.js               gap filtering helpers
│   ├── healthMetrics.js             per-(layer, env) heatmap scoring
│   ├── programsService.js           driver-suggestion ladder (D1-D10) + effective driver/solutions
│   ├── roadmapService.js            buildProjects · Coverage · Risk · Session Brief
│   ├── sessionFile.js               .canvas envelope build/apply (v2.4.10)
│   ├── skillEngine.js               renderTemplate · runSkill · per-skill provider override
│   └── vendorMixService.js          Dell vs non-Dell aggregation
│
├── interactions/                    5 modules · ~35 KB · ~795 LOC · the ONLY writers
│   ├── aiCommands.js                parseProposals · applyProposal · applyAllProposals
│   ├── desiredStateSync.js          action → gap auto-draft + phase-sync + confirmPhaseOnLink
│   ├── gapsCommands.js              create/update/delete/approve/link/unlink + setPrimaryLayer + deriveProjectId
│   ├── matrixCommands.js            add/update/delete/move + mapAsset/unmapAsset/proposeCriticalityUpgrades
│   └── skillCommands.js             runSkillById · skillsForTab dispatch
│
├── ui/                              ~220 KB · ~4 681 LOC
│   ├── icons.js                     inline-SVG helpers (57 LOC)
│   ├── components/                  2 reusable components
│   │   ├── PillEditor.js            contenteditable binding-pill editor (v2.4.2.1)
│   │   └── UseAiButton.js           tab-agnostic "✨ Use AI ▾" dropdown
│   └── views/                       12 views, one per Tab/sub-tab
│       ├── ContextView.js           Tab 1
│       ├── GapsEditView.js          Tab 4 (largest view at 1037 LOC)
│       ├── HelpModal.js             contextual help overlay
│       ├── MatrixView.js            Tabs 2 + 3 (current/desired matrix + workload mapping)
│       ├── ReportingView.js         Tab 5 · Overview
│       ├── SettingsModal.js         gear icon · provider config + skills admin
│       ├── SkillAdmin.js            skill CRUD + pill-binding editor
│       ├── SummaryGapsView.js       Tab 5 · Gaps Board
│       ├── SummaryHealthView.js     Tab 5 · Heatmap
│       ├── SummaryRoadmapView.js    Tab 5 · Roadmap (the crown jewel)
│       └── SummaryVendorView.js     Tab 5 · Vendor Mix
│
├── diagnostics/                     ~336 KB · ~6 596 LOC
│   ├── appSpec.js                   THE CONTRACT — 487 assertions (suites 01-42)
│   ├── demoSpec.js                  human-test surface — 22 assertions (DS1-DS22)
│   └── testRunner.js                minimal in-browser test framework + runIsolated
│
├── docker-entrypoint.d/             container-start hooks
│   ├── 40-setup-auth.sh             optional Basic auth (env: AUTH_USERNAME / AUTH_PASSWORD)
│   └── 45-setup-llm-proxy.sh        LLM reverse-proxy snippet generator
│
├── nginx.conf                       MIME, CSP, cache policy, security headers
│
└── docs/                            documentation tree
    ├── CHANGELOG_PLAN.md            planning + discussion trail
    ├── DEMO_CHANGELOG.md            demo + seed-skills audit trail
    ├── MAINTENANCE_LOG.md           .dNN hygiene-pass log
    ├── PHASE_17_MIGRATION_PLAN.md   Phase 17 migration plan (shipped as v2.4.8)
    ├── RULES.md                     rules-as-built audit (90+ rules)
    ├── adr/                         9 ADRs (ADR-001 through ADR-009)
    ├── operations/                  RUNBOOK, VERSION_COMPAT, RISK_REGISTER, DEPENDENCY_POLICY, PERFORMANCE_BUDGET
    └── wiki/                        Diátaxis-organised wiki
        ├── tutorials/
        ├── how-to/
        ├── reference/               ← you are here
        └── explanation/
            └── diagrams/
```

## Roll-up

| Surface | Bytes | LOC | File count |
|---|---|---|---|
| Shipped JS (excl. tests) | ~552 KB | ~9 970 | 42 |
| Test code (`diagnostics/`) | ~336 KB | ~6 596 | 3 |
| **Total** | **~888 KB raw** | **~16 566** | **45** |

Shipped JS gzip-estimate: ~150 KB at the wire (nginx `gzip on` ≥1024 bytes for `text/css | application/javascript | application/json`).

## Refresh trigger

Re-generate this file every `.dNN` hygiene-pass and any time the directory structure changes by more than a single new file.
