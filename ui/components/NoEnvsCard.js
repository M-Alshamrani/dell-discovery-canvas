// ui/components/NoEnvsCard.js -- empty-environments UX surface
// (rc.7 / 7e-8c'-impl). Per SPEC §S41 + RULES §16 CH35.
//
// Single source of truth for the "no visible environments" UX. Two
// public exports drive the contract:
//
//   visibleEnvCount(engagement) -> number
//     Pure read. Returns engagement.environments.allIds.filter(!hidden)
//     count. Equivalent forms (no envs / all hidden) collapse here.
//
//   renderEmptyEnvsCenterCard(host, viewKind, opts)
//     Centered informational card for Tabs 2/3 (Current state / Desired
//     state). Renders a self-contained .no-envs-wrap > .no-envs-center-card
//     subtree into the host -- NEVER mutates host classes (lesson learned
//     from 7e-8c'-impl: host class mutation persisted across re-renders
//     into Context tab and broke its layout, the "house of cards" bug).
//     opts: { lede }. NOT a warning -- informational tone, amber accent
//     left-border (matches §S41.2). No CTA button: Tab 1 is one click
//     away in the stepper; an inline navigation button mid-card was
//     redundant and pulled the eye away from the message.
//
// rc.7 / 7e-8c'-fix2 · the first-add acknowledgment toast (SPEC §S41.3
// in 7e-8c'-impl) is RETIRED. The information it surfaced (soft-delete
// vs. hard-delete invariant) was unnecessary noise on the user's first
// successful environment add. The bullet copy in the empty-state card
// already mentions "Environments can be hidden ... but never permanently
// removed -- your data stays safe in the saved file" so the dedicated
// toast was redundant. surfaceFirstAddAcknowledgment + the
// envFirstAddAck_v1 localStorage key + the .env-first-add-ack-banner
// CSS rule + V-FLOW-EMPTY-ENVS-6 + RULES §16 CH35 clause (e) are all
// dropped together.
//
// Authority: SPEC §S41 (LOCKED 2026-05-06) + RULES §16 CH35 + V-FLOW-
// EMPTY-ENVS-1..7 in §T41.
//
// Per F41.6.1 ("per-view inline empty-state helpers FORBIDDEN") all
// three views (MatrixView, GapsEditView, ReportingView) MUST import +
// use this module rather than ship their own helpers.

// ─── pure read helper ──────────────────────────────────────────────
//
// visibleEnvCount(engagement) — counts envs with hidden !== true.
// Treats null/undefined engagement as zero. Pure; no side effects.
export function visibleEnvCount(engagement) {
  if (!engagement || !engagement.environments || !Array.isArray(engagement.environments.allIds)) return 0;
  let n = 0;
  for (const id of engagement.environments.allIds) {
    const e = engagement.environments.byId[id];
    if (e && !e.hidden) n++;
  }
  return n;
}

// ─── centered info card (Tabs 2/3) ────────────────────────────────
//
// renderEmptyEnvsCenterCard(host, viewKind, opts) — paints a friendly
// informational card centered in the host element. viewKind drives
// the default lede + bullet copy:
//
//   "matrix-current"  -> "The current-state matrix needs at least one environment to render."
//   "matrix-desired"  -> "The desired-state matrix needs at least one environment to render."
//   "gaps"            -> "The gaps board needs at least one environment to render..."
//   "reporting"       -> "The reporting overview needs at least one environment..."
//
// opts.lede overrides the default.
//
// NEVER mutates host element classes. Renders a self-contained
// .no-envs-wrap > .no-envs-center-card subtree; CSS centering lives on
// the wrap so subsequent re-renders that swap children for non-empty
// content (e.g. user navigates to Context, adds an env, comes back) do
// not leave behind any host-level styling.
export function renderEmptyEnvsCenterCard(host, viewKind, opts) {
  if (!host) return null;
  opts = opts || {};

  const wrap = _mk("div", "no-envs-wrap");

  const card = _mk("div", "card no-envs-center-card");
  card.setAttribute("data-no-envs-state", viewKind || "unknown");

  card.appendChild(_mkt("div", "card-eyebrow muted", "ENVIRONMENTS REQUIRED"));
  card.appendChild(_mkt("div", "card-title", "Add at least one environment first"));

  const lede = opts.lede || _defaultLede(viewKind);
  card.appendChild(_mkt("div", "card-hint", lede));

  const bullets = _mk("ul", "no-envs-bullets");
  const b1 = _mk("li");
  b1.textContent = "Open Tab 1 (Context). Click \"+ Add environment\" or restore a hidden one.";
  bullets.appendChild(b1);
  const b2 = _mk("li");
  b2.textContent = "Environments can be hidden (soft-delete) but never permanently removed -- your data stays safe in the saved file.";
  bullets.appendChild(b2);
  const b3 = _mk("li");
  b3.textContent = "Once you have at least one visible environment, return here for the populated view.";
  bullets.appendChild(b3);
  card.appendChild(bullets);

  wrap.appendChild(card);
  host.appendChild(wrap);
  return card;
}

function _defaultLede(viewKind) {
  switch (viewKind) {
    case "matrix-current":
      return "The current-state matrix needs at least one environment to render.";
    case "matrix-desired":
      return "The desired-state matrix needs at least one environment to render.";
    case "gaps":
      return "The gaps board needs at least one environment to render -- gaps reference affected environments, and the filter bar offers env-scoped filtering.";
    case "reporting":
      return "The reporting overview, health heatmap, gaps board, and roadmap all need at least one environment to compute summaries from.";
    default:
      return "This tab needs at least one environment to render its data.";
  }
}

// ─── private helpers ───────────────────────────────────────────────
function _mk(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
function _mkt(tag, cls, text) {
  const e = _mk(tag, cls);
  e.textContent = text;
  return e;
}

