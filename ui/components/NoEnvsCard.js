// ui/components/NoEnvsCard.js -- empty-environments UX surface
// (rc.7 / 7e-8c'-impl). Per SPEC §S41 + RULES §16 CH35.
//
// Single source of truth for the "no visible environments" UX. Three
// public exports drive the contract:
//
//   visibleEnvCount(engagement) -> number
//     Pure read. Returns engagement.environments.allIds.filter(!hidden)
//     count. Equivalent forms (no envs / all hidden) collapse here.
//
//   renderEmptyEnvsCenterCard(host, viewKind, opts)
//     Centered informational card for Tabs 2/3 (Current state / Desired
//     state). Host element gets a .no-envs-center-card child + flex
//     centering applied so the card sits in the middle of the tab area
//     vertically. opts: { lede, ctaLabel, onCta }. NOT a warning --
//     informational tone, amber accent left-border (matches §S41.2).
//
//   surfaceFirstAddAcknowledgment()
//     One-time toast/banner on first visibleEnvCount 0->1 transition.
//     Idempotent: persists envFirstAddAck_v1='true' in localStorage so
//     subsequent calls (subsequent first-env-add events within the same
//     localStorage lifetime) are no-ops. Communicates the soft-delete
//     invariant: envs can be hidden but never permanently deleted.
//
// Authority: SPEC §S41 (LOCKED 2026-05-06) + RULES §16 CH35 + V-FLOW-
// EMPTY-ENVS-1..7 in §T41.
//
// Per F41.6.1 ("per-view inline empty-state helpers FORBIDDEN") all
// three views (MatrixView, GapsEditView, ReportingView) MUST import +
// use this module rather than ship their own helpers.

const ACK_STORAGE_KEY = "envFirstAddAck_v1";

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
// opts.lede overrides the default. opts.ctaLabel + opts.onCta wire a
// "Take me to Tab 1" button (defaults present).
export function renderEmptyEnvsCenterCard(host, viewKind, opts) {
  if (!host) return null;
  opts = opts || {};

  // Apply flex centering to the host so the card sits in the middle of
  // the tab area both horizontally and vertically. Set on the host
  // element directly so MatrixView's left panel becomes the center
  // container without needing extra wrappers.
  host.classList.add("no-envs-host");

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

  // Optional CTA -- defaults to a "Go to Tab 1" link that emits a
  // CustomEvent the app shell listens for. Callers can override with
  // opts.onCta to dispatch their own navigation.
  const ctaLabel = opts.ctaLabel || "Go to Tab 1 (Context)";
  const ctaBtn = _mk("button", "btn-primary no-envs-cta");
  ctaBtn.type = "button";
  ctaBtn.textContent = ctaLabel;
  ctaBtn.addEventListener("click", function() {
    if (typeof opts.onCta === "function") {
      opts.onCta();
      return;
    }
    document.dispatchEvent(new CustomEvent("dell-canvas:navigate-to-tab", {
      detail: { tabId: "context" }
    }));
  });
  card.appendChild(ctaBtn);

  host.appendChild(card);
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

// ─── first-add acknowledgment (Tab 1) ──────────────────────────────
//
// surfaceFirstAddAcknowledgment() — paints a one-time dismissible info
// banner near the top of the document body. Idempotent: localStorage
// envFirstAddAck_v1 is set to "true" on first call; subsequent calls
// short-circuit. Per F41.6.4: NEVER more than once per localStorage
// lifetime.
//
// Communicates the soft-delete invariant per SPEC §S41.3.
export function surfaceFirstAddAcknowledgment() {
  // Idempotency guard: localStorage dedup. Already shown once -> skip.
  let alreadyAcked = false;
  try { alreadyAcked = localStorage.getItem(ACK_STORAGE_KEY) === "true"; }
  catch (_e) { /* localStorage disabled / quota -- best-effort */ }
  if (alreadyAcked) return null;

  // Set the dedup key BEFORE rendering so a re-entrancy under fast
  // double-fire (rare but possible if a commit event triggers a
  // second emit before the DOM render completes) still respects the
  // once-per-lifetime invariant.
  try { localStorage.setItem(ACK_STORAGE_KEY, "true"); }
  catch (_e) { /* best-effort */ }

  // Build banner. Sits at top of body; user dismisses with a single
  // click on the close button.
  const banner = _mk("div", "env-first-add-ack-banner");
  banner.setAttribute("data-env-first-add-ack", "true");
  banner.setAttribute("role", "status");

  const eyebrow = _mkt("span", "env-first-add-ack-eyebrow", "FIRST ENVIRONMENT ADDED");
  banner.appendChild(eyebrow);

  const body = _mkt("span", "env-first-add-ack-body",
    "Environments can be hidden to drop them from reports without losing data. " +
    "They can't be permanently deleted -- your saved file always preserves the full set.");
  banner.appendChild(body);

  const close = _mk("button", "env-first-add-ack-close");
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss acknowledgment");
  close.textContent = "×";
  close.addEventListener("click", function() {
    if (banner.parentNode) banner.parentNode.removeChild(banner);
  });
  banner.appendChild(close);

  // Auto-dismiss after 12s as a backstop so the banner doesn't linger
  // forever for users who don't click the close button.
  setTimeout(function() {
    if (banner.parentNode) {
      banner.style.opacity = "0";
      setTimeout(function() {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 400);
    }
  }, 12000);

  document.body.appendChild(banner);
  return banner;
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

// Test-only reset for V-FLOW-EMPTY-ENVS-6 idempotency check + future
// tests that want a clean slate.
export function _resetForTests() {
  try { localStorage.removeItem(ACK_STORAGE_KEY); } catch (_e) { /* ignore */ }
}
