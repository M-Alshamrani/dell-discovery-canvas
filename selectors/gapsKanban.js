// selectors/gapsKanban.js — v3.0 · SPEC sec S5.2.2
//
// Pure memoized selector: engagement -> KanbanView.
//
// Output shape (per SPEC S5.2.2):
//   {
//     byPhase: {
//       now:   { open: GapId[], in_progress: GapId[], closed: GapId[], deferred: GapId[] },
//       next:  { ... },
//       later: { ... }
//     },
//     totalsByStatus: { open: n, in_progress: n, closed: n, deferred: n }
//   }
//
// Closed-gap rollup exclusion: SPEC S5.2.2 + KD8. totalsByStatus.closed
// is reported but downstream "active gaps" callers must read the OTHER
// three keys (open + in_progress + deferred). selectVendorMix and
// selectHealthSummary read this shape (not the raw gap collection)
// to ensure the closed-exclusion contract is centrally enforced.

import { memoizeOne } from "../services/memoizeOne.js";

const PHASES   = ["now", "next", "later"];
const STATUSES = ["open", "in_progress", "closed", "deferred"];

function emptyPhase() {
  return { open: [], in_progress: [], closed: [], deferred: [] };
}

function compute(engagement) {
  const byPhase = {
    now:   emptyPhase(),
    next:  emptyPhase(),
    later: emptyPhase()
  };
  const totalsByStatus = { open: 0, in_progress: 0, closed: 0, deferred: 0 };

  // Iterate gaps in allIds order (preserves user-visible ordering).
  for (const gapId of engagement.gaps.allIds) {
    const gap = engagement.gaps.byId[gapId];
    if (!PHASES.includes(gap.phase)) continue;        // defensive
    if (!STATUSES.includes(gap.status)) continue;     // defensive
    byPhase[gap.phase][gap.status].push(gap.id);
    totalsByStatus[gap.status] += 1;
  }

  return { byPhase, totalsByStatus };
}

export const selectGapsKanban = memoizeOne(compute, ([a], [b]) => a === b);
