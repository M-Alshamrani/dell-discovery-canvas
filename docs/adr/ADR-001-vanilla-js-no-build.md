# ADR-001 · Vanilla JS · no framework · no build step

## Status

**Accepted** — has held since v1.x; recodified at every major release. Re-evaluated at every `+dNN` pass.

## Context

The Dell Discovery Canvas is an internal Dell Technologies presales tool. It runs on a presales engineer's laptop during 30-45 minute customer-discovery workshops. Constraints at inception:

- The author is a Dell presales engineer, not a frontend specialist. Friction with `npm install` / build chains / framework upgrades was a real risk for a single-author project.
- Reviewers and partners need to run the app locally with minimum tooling. Asking them to install Node + npm + run a build was a non-starter.
- The application is conceptually a 5-step interactive form with deterministic projections (heatmap, roadmap). No real-time collaboration, no streaming UIs, no exotic interactions.
- The roadmap is the crown jewel; everything else earns its place by making the roadmap credible. UX-driven, not framework-driven.

## Decision

- **No framework** — no React, no Vue, no Svelte, no Lit. Vanilla JS DOM manipulation + ES modules.
- **No build step** — files are served as-is by `nginx:alpine`. No bundler, no transpiler, no minifier.
- **No npm dependencies** — `package.json` does not exist. Every line of code in `core/`, `state/`, `services/`, `interactions/`, `ui/`, `diagnostics/` is hand-authored or copy-pasted from a permissively-licensed source with attribution in the file header.
- **ES modules** — modern browser baseline (last 2 majors of Chromium / Firefox / Safari). `import`/`export` syntax across the project.
- **Static-file deployment** — `nginx:alpine` Docker container, multi-arch (amd64 + arm64). Apache HTTP server or Python `http.server` also works for dev.
- **Tests run in the browser** — `diagnostics/appSpec.js` + `diagnostics/demoSpec.js` execute 150ms after page load via a hand-written test runner (`diagnostics/testRunner.js`). No Karma, no Jest, no Vitest.

## Alternatives considered + rejected

- **React + Vite/Webpack** — most-used baseline for SPAs. Rejected because: build step required; `npm install` adds a maintenance surface; the app's interactions don't need React's reconciliation model; the 250 KB-1 MB bundle cost on what could be a 150 KB site is wasteful.
- **Lit + Web Components** — closer to vanilla, but still a build step for production.
- **Svelte** — compiles to vanilla JS; very compelling. Rejected because the build step is real and the team scale (1 person) makes the maintenance argument fail.
- **TypeScript** — type safety would be valuable. Rejected for the same build-step reason. The codebase compensates with strict input validation in `core/models.js` and 509 assertions in `diagnostics/`.

## Consequences

### Good

- **Onboarding is trivial** — `git clone`, `python -m http.server 8000`, open browser. Done in 60 seconds.
- **No supply-chain attack surface** — no npm dependencies means no `event-stream`-style compromises, no dependabot churn, no "we have to upgrade React from 17 to 18".
- **Deployment is small + reliable** — `nginx:alpine` image is ~75MB compressed. Builds in seconds. Multi-arch works because there's no platform-specific binary in the build chain.
- **The "no frameworks" rule keeps the project legible** — anyone with browser-JS familiarity can navigate `ui/views/MatrixView.js` immediately. No hidden lifecycle, no opaque prop drilling.

### Bad / accepted trade-offs

- **DOM manipulation is verbose** — `document.createElement('div')` patterns repeat. Mitigated by small helper functions per view.
- **No type checking at the language level** — runtime validators (`validateInstance`, `validateGap`) + 509 tests catch what TypeScript would. Drift risk is real but the test surface is the safety net.
- **Some libraries we'd want require a build step** — Mermaid (~1MB rendered) for in-app diagram rendering, for example. Not a problem until it is; we'd vendor it as a single-file dependency-free copy or lazy-load it on a specific route.
- **A new contributor expecting Webpack/Vite will be confused** — addressed by `ONBOARDING.md` Day-1 explicitly calling out "no npm, no build" as a feature.

## When to revisit

Trigger conditions for reopening this decision:

1. **Multi-user platform (v3) ships** — server-side rendering, real-time sync, or streaming AI responses might warrant a framework. Even then, the BROWSER stays vanilla unless we have a hard pain point.
2. **The codebase exceeds ~30K LOC** — at that scale, the lack of static typing starts to bite. Currently ~10K LOC; not close.
3. **A second front-end developer joins full-time** — pair-programming dynamics may shift the calculus. Low priority.
4. **A killer feature requires a heavy library** (e.g., a graph-database-backed CMDB rewrite) — the dependency-management cost might tip the scale. Until then, no.

This ADR is the project's **load-bearing** architectural decision. Don't change it casually. Document any exception in a follow-up ADR that supersedes this one.
