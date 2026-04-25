# Performance budget

Per-surface targets. Each entry: budget, current observed (where measured), and the action threshold.

The procedure §10.1 lists stress assertions (PERF-1 through PERF-5) for `demoSpec.js`. Those were considered for `v2.4.11.d02` and **deferred** — adding new test code is borderline-functional-change for a `.dNN` hygiene clone. The budgets below are documented; assertions follow when there's a real failure to catch (likely v2.5.x or v2.6.x slice).

---

## Page load

| Surface | Budget | Observed (v2.4.11) | Threshold for action |
|---|---|---|---|
| Initial paint (TTI) on localhost | < 1 s | ~300 ms | If consistently >1 s, audit module-graph + investigate critical-path |
| Initial paint on LAN (≥10 Mbps) | < 2 s | ~600-800 ms | Same |
| Test runner first assertion | < 200 ms after page load | ~150 ms (per `app.js` setTimeout) | If tests delay paint perceptibly, throttle |
| Green test banner appearance | < 500 ms after page load | ~200-300 ms | — |

## Tab switch

| Surface | Budget | Observed (v2.4.11) | Threshold |
|---|---|---|---|
| Context → Current | < 100 ms | ~30-50 ms | If >200 ms, profile MatrixView render |
| Current → Desired | < 100 ms | ~50-80 ms (matrix rebuilds) | If >200 ms, consider lazy-render |
| Desired → Gaps | < 100 ms | ~50-100 ms (kanban) | If >200 ms, consider virtual scrolling |
| Gaps → Reporting | < 200 ms | ~100-150 ms (Roadmap projects build) | If >300 ms, memoize `buildProjects` |
| Reporting sub-tab switch | < 50 ms | ~20-40 ms | — |

## Render budgets per item

| Surface | Budget | Implication |
|---|---|---|
| Matrix tile (Tabs 2 + 3) | < 4 ms | At workshop scale (~50 instances), full matrix renders in <200 ms |
| Kanban card (Tab 4) | < 2 ms | At workshop scale (~30 gaps), full kanban renders in <60 ms |
| Roadmap project card (Tab 5) | < 5 ms | At workshop scale (~10-15 projects), full grid renders in <75 ms |
| Driver tile (Tab 1) | < 5 ms | Up to 8 drivers; <40 ms total |

## AI flow

| Surface | Budget | Observed | Threshold |
|---|---|---|---|
| Skill `runSkill` until first response | depends on provider | Anthropic ~1-3 s, Gemini ~1-2 s, local ~0.5-2 s | — |
| AI call hard timeout | 30 s (configurable) | n/a | If hit regularly, investigate provider issues |
| `parseProposals` JSON-extraction | < 50 ms | <10 ms typical | If >100 ms, improve regex / parser |
| `applyProposal` (single) | < 50 ms | ~5-15 ms | If >100 ms, optimise resolver lookup |
| `applyAllProposals` (batched, 10 fields) | < 100 ms | ~30-50 ms | — |
| Retry-with-backoff (3 attempts, all 429) | up to ~12 s (4s × 3 backoff cap) | n/a | — |

## Undo

| Surface | Budget | Observed | Threshold |
|---|---|---|---|
| `aiUndoStack.push` (clone session) | < 30 ms | ~5-10 ms | If >50 ms at scale, consider delta-encoding |
| `undoLast` (full snapshot restore) | < 50 ms | ~10-20 ms | — |
| `undoAll` (restore oldest snapshot) | < 50 ms | same as undoLast | — |

## Memory

| Surface | Budget | Implication |
|---|---|---|
| Session JSON in-memory | < 500 KB | Most workshop sessions <100 KB |
| `ai_undo_v1` localStorage size | < 2 MB | At cap (10 × 50 KB), comfortably under |
| Total localStorage footprint | < 5 MB | Stays under Safari ceiling |

## How budgets are checked

Today: **manual inspection during browser smoke**. The Chrome MCP smoke against the verification spec includes a "performance vibe check" — open DevTools Performance tab, record a session, scan for tasks > 16ms.

Future (post-v2.4.11.d02): advisory PERF-* assertions in `demoSpec.js` per procedure §10.1. Tagged advisory so they don't fail CI on hardware variance; they log results and surface trend regressions.

## When to bump budgets

A budget should bump (allow more) only when:
1. Workload changes structurally (e.g., scale ceiling shifts from "workshop" to "multi-customer").
2. The new ceiling is documented in [`scalability.md`](../wiki/explanation/scalability.md).
3. The bump is the cheaper alternative to the optimisation needed to hit the original budget.

A budget should bump (allow less) only when:
1. Real users report a perceptible delay.
2. We've measured a regression and can name the cause.

## When to invest in measured optimisation

The optimisation candidates documented in [`scalability.md`](../wiki/explanation/scalability.md) (Set/Map lookups, memoisation, virtual scrolling, lazy-render) are NOT premature work. Apply them only when:

1. A budget is consistently exceeded (`Threshold for action` triggered).
2. Measurement identifies the hot path.
3. The optimisation buys more headroom than it spends in complexity.

## Refresh trigger

Update this file:
- After a perf incident.
- When a budget is renegotiated.
- When PERF-* assertions ship — link to them.
- Every `.dNN` hygiene-pass — re-audit budgets against the latest measurements.
