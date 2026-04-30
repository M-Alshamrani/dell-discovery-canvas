# Second-opinion consultation prompt

**Purpose**: hand this prompt to an independent AI (Anthropic, OpenAI, Google, etc.) to get a neutral architectural opinion on the data-model rebuild we're planning for Dell Discovery Canvas.

**How to use**: copy everything between the `---PROMPT-START---` and `---PROMPT-END---` markers below into the receiving AI's chat. Paste the response back here so it can be cross-referenced against the internal analysis before locking the data architecture.

**Author intent**: deliberately unbiased. The two architectural options under consideration (flat-storage + tab-views vs nested matrix-of-matrices) are presented with equal weight; the prompt asks for a specific recommendation with named reasoning, not a hedged "it depends" answer.

**Date authored**: 2026-04-30 (post v2.4.17 spec lock; pre data-architecture rebuild).

---PROMPT-START---

```
# Second-opinion request: data architecture for a presales discovery
# canvas with AI-driven skill execution

## Who we are + what this app does

We're building "Dell Discovery Canvas" — a vanilla-JS ESM single-page
web app for Dell Technologies presales engineers running customer
discovery workshops. A workshop produces ONE engagement document
("session") capturing the customer's:

  - identity (name, vertical, region) + the strategic drivers they
    care about (e.g. cyber resilience, cost optimisation)
  - environments (Riyadh DC, Jeddah DR, AWS me-south-1, branch sites)
  - current-state inventory: instances of compute / storage /
    networking / data-protection / virtualization / workload tiers
    they have today, with vendors + criticality
  - desired-state inventory: what they want to move to (specific Dell
    products usually), with disposition (replace, consolidate, retire,
    enhance, introduce, ops)
  - gaps: the deltas between current and desired, scoped by layer +
    environment + driver, with urgency + phase + linked instances
  - reports: derived per render (projects grouped from gaps, vendor
    mix, risk heatmap, executive summary)

Tech stack today:

  - Vanilla JS ES modules, no framework. ~30 source files.
  - nginx-alpine Docker container, static files only.
  - Single-user, single-engagement-at-a-time. Storage: browser
    localStorage + a `.canvas` JSON file the user can save / reopen.
  - LLM-backed AI features via configurable provider (Anthropic,
    Gemini, local LLM, Dell Sales Chat).
  - In-browser test runner with ~770 assertions enforcing data + UI
    contracts.

The UI navigates 5 tabs:

  Tab 1  Context        — set up customer + drivers + environments
  Tab 2  Current state  — map their existing inventory (matrix view)
  Tab 3  Desired state  — map the target inventory + dispositions
  Tab 4  Gaps           — kanban of deltas, with linked solutions
  Tab 5  Reporting      — derived views: projects, vendor mix, heatmap,
                          exec summary

## Today's data shape (code-verified)

Storage is currently flat under one root `session` object. Below is the
EXACT shape from our `createEmptySession()` factory + validators. I've
included field counts, types, and where catalog lookups are merged
in:

session
├── sessionId : "sess-{ts}-{random}"
├── isDemo    : boolean (true for the demo Acme persona, false for
│                user sessions)
├── activeEntity : { kind, id, at } | null
│      (transient view-state pointer; stripped on .canvas save;
│       kind ∈ {driver, current, desired, gap, project, environment,
│       service})
├── integrityLog : [...] | undefined
│      (transient repair audit, regenerated on each load)
├── customer
│   ├── name           (string)
│   ├── vertical       (string, from CUSTOMER_VERTICALS catalog)
│   ├── segment        (legacy back-compat string)
│   ├── industry       (legacy back-compat string)
│   ├── region         (string)
│   └── drivers[]      array of:
│       ├── id         (string, FK → BUSINESS_DRIVERS catalog)
│       ├── priority   ("High" | "Medium" | "Low")
│       └── outcomes   (free text)
├── sessionMeta
│   ├── date           (ISO date)
│   ├── presalesOwner  (string)
│   ├── status         ("Draft" | "In review" | ...)
│   └── version        (schema version, currently "2.0")
├── environments[]   array of:
│   ├── id           (string, FK → ENV_CATALOG)
│   ├── hidden       (boolean — soft-delete)
│   ├── alias        (optional, e.g. "Riyadh DC")
│   ├── location     (optional)
│   ├── sizeKw       (optional, capacity)
│   ├── sqm          (optional, floor area)
│   ├── tier         (optional, e.g. "Tier III")
│   └── notes        (optional)
├── instances[]    array of:
│   ├── id              (string)
│   ├── state           ("current" | "desired")
│   ├── layerId         (FK → LAYERS, 6 fixed: workload, compute,
│                         storage, dataProtection, virtualization,
│                         infrastructure)
│   ├── environmentId   (FK → environments[].id)
│   ├── label           (string)
│   ├── vendor          (string, e.g. "Dell", "VMware")
│   ├── vendorGroup     ("dell" | "nonDell" | "custom")
│   ├── criticality     ("High" | "Medium" | "Low")
│   ├── notes           (optional)
│   ├── disposition     (FK → DISPOSITION_ACTIONS, 7 fixed)
│   ├── originId        (only on state=desired; FK → state=current
│                         instance, may cross environments)
│   ├── priority        (only on state=desired: "Now"|"Next"|"Later")
│   └── mappedAssetIds[](only on layerId="workload"; FK → other
│                         instances ids; can cross environments)
└── gaps[]   array of:
    ├── id                          (string)
    ├── description                 (string)
    ├── gapType                     (FK → GAP_TYPES, 5 unique values
                                      derived from ACTIONS)
    ├── urgency                     ("High"|"Medium"|"Low")
    ├── urgencyOverride             (boolean — pins urgency against
                                      auto-propagation)
    ├── phase                       ("now"|"next"|"later")
    ├── status                      ("open"|"in_progress"|"closed"|
                                     "deferred")
    ├── reviewed                    (boolean)
    ├── notes                       (string)
    ├── driverId                    (FK → customer.drivers[].id)
    ├── layerId                     (FK → LAYERS — primary layer)
    ├── affectedLayers[]            (FKs → LAYERS, with G6 invariant:
                                     [0] === layerId)
    ├── affectedEnvironments[]      (FKs → environments[].id)
    ├── relatedCurrentInstanceIds[] (FKs → instances state=current)
    ├── relatedDesiredInstanceIds[] (FKs → instances state=desired)
    ├── services[]                  (FKs → SERVICE_TYPES, 10 fixed)
    ├── mappedDellSolutions         (free text — AI-suggested Dell
                                      product mapping)
    └── projectId                   (auto-derived; groups gaps into
                                     reporting projects)

Catalogs (read-only constants, shipped with the app, not stored in
the session):

LAYERS              6  fixed   workload | compute | storage |
                                dataProtection | virtualization |
                                infrastructure
BUSINESS_DRIVERS    8  fixed   ai_data | cyber_resilience |
                                cost_optimization | cloud_strategy |
                                modernize_infra | ops_simplicity |
                                compliance_sovereignty | sustainability
ENV_CATALOG         8  fixed   coreDc | drDc | archiveSite |
                                publicCloud | edge | coLo |
                                managedHosting | sovereignCloud
SERVICE_TYPES      10  fixed   assessment | migration | deployment |
                                integration | training |
                                knowledge_transfer | runbook |
                                managed | decommissioning | custom_dev
GAP_TYPES           5  derived enhance | replace | consolidate | ops |
                                introduce
DISPOSITION_ACTIONS 7  fixed   keep | enhance | replace | consolidate |
                                retire | introduce | ops
CUSTOMER_VERTICALS  N  fixed   alphabetised list including Energy &
                                Utilities, Financial Services, etc.

Reporting tab is purely derived: projects come from
buildProjects(session) (groups gaps by projectId); vendor mix is
computed from instances; the heatmap is from getHealthSummary;
the executive summary aggregates everything. Nothing in Reporting is
stored — every load recomputes.

## What we're designing

We're rebuilding the data architecture to be the foundation for the
next 12-24 months of feature growth. The rebuild question is the
storage shape + presentation shape boundary: where does data live,
where is it computed, how does the rest of the app (especially the AI
skill builder, see below) consume it.

The two architectures we're seriously considering — both presented
fairly:

### Option A · Flat storage (essentially what we have today, refined)

engagement
├── meta            (sessionId, isDemo, activeEntity, integrityLog,
│                    sessionMeta)
├── customer        (one record + drivers[] inline)
├── environments[]  (one list)
├── instances[]     (one list with state field)
├── gaps[]          (one list)
└── (catalogs are external constants, not in storage)

Tabs would be described as VIEWS over this data — not as data owners.
A "tab views" table maps each tab to which entities it reads + edits.
Some views (the matrix grid on Tab 2) compute a denormalized
presentation (env × layer grouping) on demand.

### Option B · Nested matrix-of-matrices storage

engagement
└── context
    ├── customer
    ├── drivers[]
    └── environments
        ├── riyadh
        │   ├── current
        │   │   ├── compute[]
        │   │   ├── storage[]
        │   │   └── ... (per-layer buckets)
        │   └── desired
        │       └── ... (per-layer buckets)
        ├── jeddah
        │   └── ... (12 buckets per env)
        └── ... (one branch per environment)

This stores the matrix view as the source of truth — instances are
pre-grouped by env × state × layer. Reads per tab feel intuitive
(walk the tree). Some entities (gaps, workloads spanning envs) need
special placement.

We'd appreciate your honest take on both.

## Constraints + concerns to think about

Cross-cutting relationships in the data:
  - workload-layer instances have mappedAssetIds[] that can
    reference instances IN OTHER ENVIRONMENTS (e.g. a Riyadh workload
    depending on AWS storage)
  - desired-state instances have originId referencing a current-
    state instance, which can be in a DIFFERENT environment (cloud
    migrations, DC consolidations are common)
  - gaps have affectedEnvironments[] array — a gap can span 2-3
    environments at once
  - reports compute aggregates that span everything (vendor mix
    across all envs/layers, urgency totals across all gaps, etc.)

Future requirements we want to be ready for (multi-year horizon):
  - move from .canvas JSON file + localStorage to a backend with a
    real database (relational or document — undecided). Single-user
    today; want multi-user, multi-engagement, role-based (presales /
    manager / director / admin) eventually.
  - global reporting across many engagements: "show me all High-urgency
    gaps in Financial Services / EMEA across every engagement my
    presales team owns this quarter"
  - search across engagements: "find every instance running PowerEdge
    R760 across all my customer sessions"
  - per-presales / per-client filtered dashboards
  - keep the same data architecture working as the UI scales (new
    tabs, new derived views, new entity types like first-class
    services or skills)
  - keep the in-browser performance budget (<100ms for view renders,
    <500ms for full-data round-trips on a 200-instance demo session)

The AI skill builder — this is the critical use case:

The app has a skill builder where users compose AI prompts using "data
chips" they pick from a palette. There are TWO skill types they choose
between at build time:

1. Click-to-run skills: the user must click a specific tile on the
   canvas (a driver, current tile, desired tile, gap, project, or
   environment) before the skill runs. The skill receives that
   selected entity's data PLUS the surrounding session-level data. The
   chip palette presented during skill-building shows: session-level
   chips + the chosen entity-kind's chips + that entity's "linked"
   chips (e.g. for a Driver: linkedGaps[], linkedInstances[], etc.).

2. Session-wide skills (fixed-data): the skill runs without any
   tile click. The chip palette presented during skill-building shows
   only session-level chips. Use cases: executive summary, top risks
   across everything, customer narrative draft.

At runtime, the skill's promptTemplate references chips like
{{context.selectedDriver.label}} or {{session.customer.name}} or
{{context.selectedDriver.linkedGaps}}. The runtime resolves these
paths against either the session JSON directly (session-wide) OR a
merged "selected entity + its linked records" view (click-to-run).

The data architecture needs to:
  - expose a manifest of all bindable paths, organized by skill type +
    entity kind, so the chip palette can render the right chips
  - resolve those paths efficiently at runtime, including any "linked
    composition" the click-to-run case needs (so a single driver-click
    pulls in the linked gaps, instances, environments, etc.)
  - stay simple enough to validate: skill saves should fail if a
    promptTemplate references a path that doesn't exist
  - scale: adding a new entity kind (or a new linked relationship for
    an existing kind) shouldn't require touching dozens of files

The current code uses two shallow surfaces: SESSION_PATHS (~11 chips,
session-wide) and ENTITY_PATHS_BY_KIND (per-kind, ~6-17 chips each).
Linked-relationship chips don't exist yet — if we go that direction,
we'd need to add them to the manifest + a resolver that produces the
linked composition at runtime.

## Other context that may matter

  - We have a single-source-of-truth doc (docs/TAXONOMY.md)
    describing entities + relationships + dispositions + lifecycles.
    A 770-test browser test suite enforces shape contracts.
  - We have an in-place migration system: each schema version has a
    migrator that idempotently transforms older session JSON into the
    current shape. We need this to keep working.
  - We have an integrity-sweep system: orphan FK detection + repair
    runs on every session load (drops references that point at
    deleted records, etc.). It's pure (no DOM coupling).
  - The user-base is workshop-driven: a single presales engineer in a
    customer meeting, often offline (LAN-only deployments are
    supported), needs the canvas to be responsive even on a laptop.
  - We have NOT moved to TypeScript. We're not opposed but it's not on
    the immediate roadmap. The existing code uses JSDoc-light + the
    test suite for type safety.

## What we want from you

Please give us your honest, direct take on:

1. Storage shape: which option (A flat / B nested / something
   else) would you recommend, given the cross-cutting relationships,
   future DB migration, multi-engagement reporting, AI skill builder
   needs, and in-browser performance budget? Why?

2. Failure modes you'd watch for: with whichever architecture you
   recommend, what mistakes have you seen other teams make that we
   should avoid up front?

3. DB-readiness: how should today's storage shape map to (a) a
   relational DB and (b) a document DB if we move backend in 12-24
   months? Are there layout decisions we should make NOW that make
   that migration trivial vs painful?

4. The AI skill builder pattern: is the manifest + resolver +
   linked-composition view the right approach for letting users
   compose dynamic prompts? Have you seen a better pattern in
   production? What about keeping the chip palette accurate as the
   data model evolves — generate from schema, hand-maintain, or
   something else?

5. Future trends: what proven 2024-2026-era best practices for
   small-medium SPA apps should we factor in NOW, especially around
   data modeling + LLM integration + global search/reporting? We
   want to avoid both (a) over-engineering for trends that won't
   pan out, and (b) cargo-culting yesterday's patterns into a
   greenfield architecture.

6. What we haven't considered: if there's an option C, D, or E we
   should be looking at instead of A vs B (e.g. event-sourced, CRDT,
   normalized + projections via something like Redux's reselect, a
   schema-first generation toolchain, …) — name it and tell us why.

7. One mistake people consistently make in this kind of app
   (presales/sales-engineering tooling with embedded LLM features)
   that we should learn from before locking the architecture.

Be opinionated. We're not looking for "it depends" — we want a
specific recommendation with named reasoning. We can handle being
told we're considering the wrong options.

We'll cross-reference your answer against the analysis we've done
internally + factor it in before locking the data architecture for
the next 12-24 months. Your second opinion is genuinely independent
input, not a rubber stamp.
```

---PROMPT-END---

## After receiving the second opinion

When you paste the response back, I'll cross-reference it against the internal analysis on these dimensions:

- **Storage-shape verdict** — flat vs nested vs option C — and reasoning quality
- **Cross-cutting scenarios** — does the receiving AI surface the same four problem cases (workloads spanning envs, originId across envs, gaps spanning envs, reports across everything) or different ones?
- **DB-readiness mapping** — relational schema + document layout proposed
- **AI skill builder pattern** — manifest + resolver + linked-composition vs an alternative
- **Trends to adopt + trends to skip** — sanity check on tech-stack evolution
- **Mistakes to avoid** — failure modes worth pre-empting
- **Convergence vs divergence** — if the second opinion converges, we have alignment for the rebuild; if it diverges, we re-examine before locking.
