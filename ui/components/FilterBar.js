// ui/components/FilterBar.js  · v2.4.15 · §FB1-FB7 + v2.4.15-polish T2.D1
//
// Modern collapsible cross-tab filter bar. Single "Filters · N active"
// pill button with a sliders icon + count badge + an inline accordion
// panel with multi-select chip groups + an active-pill strip above the
// kanban with removable pills.
//
// Wires up four dimensions end-to-end:
//   - services (carried over from v2.4.14)
//   - layer (NEW v2.4.15)
//   - domain (NEW v2.4.15)
//   - urgency (NEW v2.4.15)
//
// v2.4.15-polish (2026-04-28):
//   - Toggle is a styled pill: sliders icon + "Filter" + count badge.
//   - Panel structures each dimension as an accordion (collapsed by
//     default unless the dimension has an active value).
//   - Panel open/closed state + per-dim expanded state persisted to
//     localStorage so the filter view survives reload.
//   - Active chips float to the top of their group with the GPLC
//     `.tag[data-t="app"]` accent so the eye finds them first.
//
// Behavior contract (per Suite 46 FB1-FB7d):
//   FB1   renderFilterBar(target, opts) -> single .filter-bar-toggle
//   FB2   click toggle -> panel visible; re-click -> panel collapsed
//   FB3   chip click sets body[data-filter-<dim>] + chip gets .is-active
//   FB4   active pill row above kanban with removable pills
//   FB5   pill X removes filter (body data attr cleared, pill gone)
//   FB6   toggle text reads "Filters · N active" with N filters selected
//   FB7a-d  layer / domain / urgency match-classes on .gap-card +
//           multi-dim AND combine via CSS :not chain.

import * as fState from "../../state/filterState.js";

const DIMS = ["services", "layer", "domain", "urgency"];
const PANEL_OPEN_KEY = "dd_filter_panel_open_v1";
const DIM_OPEN_KEY   = "dd_filter_dim_open_v1";

// Public API: render a FilterBar inside `target`.
// opts: { dimensions: [{ id, label, options:[{id,label}] }], session, scope }
//   - scope: optional Element where the gap-cards live (defaults to target)
export function renderFilterBar(target, opts) {
  if (!target || typeof target.appendChild !== "function") return null;
  opts = opts || {};
  var dims = (opts.dimensions || []).filter(function(d) {
    return d && d.id && DIMS.indexOf(d.id) >= 0;
  });
  var scope = opts.scope || target;

  var root = document.createElement("div");
  root.className = "filter-bar-root";

  // ---- Toggle pill (sliders icon + "Filter" + count badge) ----
  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "filter-bar-toggle";
  toggle.setAttribute("data-filter-bar-toggle", "");

  var togIcon = makeIcon("sliders", 14);
  togIcon.classList.add("filter-bar-toggle-icon");
  toggle.appendChild(togIcon);

  var togLabel = document.createElement("span");
  togLabel.className = "filter-bar-toggle-label";
  toggle.appendChild(togLabel);

  var togBadge = document.createElement("span");
  togBadge.className = "filter-bar-toggle-badge";
  toggle.appendChild(togBadge);

  // ---- Panel ----
  var panel = document.createElement("div");
  panel.className = "filter-bar-panel";
  panel.setAttribute("data-filter-bar-panel", "");

  // Restore panel open state.
  var panelOpen = loadPanelOpen();
  panel.style.display = panelOpen ? "" : "none";

  toggle.addEventListener("click", function() {
    panelOpen = panel.style.display === "none";
    panel.style.display = panelOpen ? "" : "none";
    savePanelOpen(panelOpen);
  });

  // ---- Dimension accordions ----
  var dimOpenState = loadDimOpenState();
  dims.forEach(function(dim) {
    var group = document.createElement("div");
    group.className = "filter-bar-dim";
    group.setAttribute("data-filter-bar-dim", dim.id);
    var dimOpen = dimOpenState[dim.id];
    if (typeof dimOpen !== "boolean") {
      // Default: open if dim already has an active value, else closed.
      dimOpen = !!fState.getActiveValue(dim.id);
    }
    if (dimOpen) group.classList.add("is-open");

    var heading = document.createElement("button");
    heading.type = "button";
    heading.className = "filter-bar-dim-heading";
    var caret = makeIcon("chevron-down", 12);
    caret.classList.add("filter-bar-dim-caret");
    heading.appendChild(caret);
    var headingLabel = document.createElement("span");
    headingLabel.className = "filter-bar-dim-heading-label";
    headingLabel.textContent = dim.label;
    heading.appendChild(headingLabel);
    var headingCount = document.createElement("span");
    headingCount.className = "filter-bar-dim-heading-count";
    heading.appendChild(headingCount);
    heading.addEventListener("click", function() {
      var nowOpen = !group.classList.contains("is-open");
      group.classList.toggle("is-open", nowOpen);
      dimOpenState[dim.id] = nowOpen;
      saveDimOpenState(dimOpenState);
    });
    group.appendChild(heading);

    var chipRow = document.createElement("div");
    chipRow.className = "filter-bar-chip-row";
    (dim.options || []).forEach(function(opt) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip tag";
      chip.setAttribute("data-t", "tech");
      chip.setAttribute("data-filter-chip", "");
      chip.setAttribute("data-filter-dim", dim.id);
      chip.setAttribute("data-filter-value", opt.id);
      chip.textContent = opt.label;
      if (fState.getActiveValue(dim.id) === opt.id) {
        chip.classList.add("is-active");
        chip.setAttribute("data-t", "app");
      }
      chip.addEventListener("click", function() {
        fState.toggleValue(dim.id, opt.id);
      });
      chipRow.appendChild(chip);
    });
    group.appendChild(chipRow);
    panel.appendChild(group);
  });

  // ---- Active-pill strip (above the kanban) ----
  var pillStrip = document.createElement("div");
  pillStrip.className = "filter-active-pill-strip";

  root.appendChild(toggle);
  root.appendChild(panel);
  root.appendChild(pillStrip);
  target.appendChild(root);

  function paint() {
    var snap = fState.getSnapshot();
    var activeCount = 0;
    var activeDims = [];
    DIMS.forEach(function(d) {
      var v = snap[d];
      if (typeof v === "string" && v.length > 0) {
        activeCount++;
        activeDims.push({ dim: d, value: v });
      }
    });

    // Toggle label + badge. Keep "Filters · N active" in textContent
    // so Suite 46 FB6 still matches via /N\s*active/.
    if (activeCount === 0) {
      togLabel.textContent = "Filters";
      togBadge.style.display = "none";
      togBadge.textContent = "";
      toggle.classList.remove("has-active");
    } else {
      togLabel.textContent = "Filters · " + activeCount + " active";
      togBadge.style.display = "";
      togBadge.textContent = String(activeCount);
      toggle.classList.add("has-active");
    }

    // Chip active states + per-dim group counts.
    var dimCounts = {};
    DIMS.forEach(function(d) { dimCounts[d] = 0; });
    panel.querySelectorAll(".filter-chip[data-filter-dim]").forEach(function(chip) {
      var d = chip.getAttribute("data-filter-dim");
      var v = chip.getAttribute("data-filter-value");
      var isActive = snap[d] === v;
      chip.classList.toggle("is-active", isActive);
      chip.setAttribute("data-t", isActive ? "app" : "tech");
      if (isActive) dimCounts[d] = (dimCounts[d] || 0) + 1;
    });
    panel.querySelectorAll(".filter-bar-dim").forEach(function(group) {
      var dimId = group.getAttribute("data-filter-bar-dim");
      var countEl = group.querySelector(".filter-bar-dim-heading-count");
      var n = dimCounts[dimId] || 0;
      if (countEl) {
        countEl.textContent = n > 0 ? String(n) : "";
        countEl.style.display = n > 0 ? "" : "none";
      }
    });

    // Active-pill strip.
    pillStrip.innerHTML = "";
    activeDims.forEach(function(entry) {
      var pill = document.createElement("span");
      pill.className = "active-filter-pill tag";
      pill.setAttribute("data-t", "app");
      pill.setAttribute("data-active-filter-pill", "");
      pill.setAttribute("data-filter-dim", entry.dim);
      pill.setAttribute("data-filter-value", entry.value);
      var lbl = document.createElement("span");
      lbl.textContent = entry.dim + ": " + entry.value;
      pill.appendChild(lbl);
      var x = document.createElement("button");
      x.type = "button";
      x.className = "pill-remove";
      x.setAttribute("data-pill-remove", "");
      x.setAttribute("aria-label", "Remove " + entry.dim + " filter");
      x.textContent = "✕";
      x.addEventListener("click", function() {
        fState.clearDim(entry.dim);
      });
      pill.appendChild(x);
      pillStrip.appendChild(pill);
    });
    if (activeCount >= 2) {
      var clearAll = document.createElement("button");
      clearAll.type = "button";
      clearAll.className = "active-filter-clear-all btn-link";
      clearAll.textContent = "Clear all";
      clearAll.addEventListener("click", function() {
        fState.clearAll();
      });
      pillStrip.appendChild(clearAll);
    }

    applyMatchClasses(scope, snap);
  }

  var unsub = fState.subscribe(function() { paint(); });
  root._unsubscribeFilterBar = unsub;
  paint();
  return root;
}

// Adds / removes .filter-match-<dim> on every .gap-card inside scope
// based on the gap-card's data-<dim> attribute. The CSS dim rule then
// dims any card that does NOT carry the match class for an active
// filter dimension. Multi-dim AND combine is automatic via CSS :not.
export function applyMatchClasses(scope, snapshot) {
  if (!scope || typeof scope.querySelectorAll !== "function") return;
  var cards = scope.querySelectorAll(".gap-card");
  if (!cards || cards.length === 0) return;
  Array.prototype.forEach.call(cards, function(card) {
    DIMS.forEach(function(dim) {
      var active = snapshot[dim];
      var matchClass = "filter-match-" + dim;
      if (typeof active !== "string" || active.length === 0) {
        card.classList.remove(matchClass);
        return;
      }
      var attr = card.getAttribute("data-" + dim);
      var matches = false;
      if (typeof attr === "string" && attr.length > 0) {
        if (dim === "services") {
          matches = attr.split(/\s+/).indexOf(active) >= 0;
        } else {
          matches = attr === active;
        }
      }
      card.classList.toggle(matchClass, matches);
    });
  });
}

// ---- localStorage helpers for panel + per-dim collapse state ----
function loadPanelOpen() {
  try { return localStorage.getItem(PANEL_OPEN_KEY) === "1"; }
  catch (e) { return false; }
}
function savePanelOpen(v) {
  try { localStorage.setItem(PANEL_OPEN_KEY, v ? "1" : "0"); }
  catch (e) { /* ignore */ }
}
function loadDimOpenState() {
  try {
    var raw = localStorage.getItem(DIM_OPEN_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch (e) { return {}; }
}
function saveDimOpenState(state) {
  try { localStorage.setItem(DIM_OPEN_KEY, JSON.stringify(state)); }
  catch (e) { /* ignore */ }
}

// ---- Tiny inline-SVG icon builder for the FilterBar's own icons ----
function makeIcon(name, size) {
  var s = size || 14;
  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width",  String(s));
  svg.setAttribute("height", String(s));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("lucide-" + name);
  var paths = ICONS[name] || [];
  paths.forEach(function(d) {
    if (typeof d === "string") {
      var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
    } else if (d && d.tag) {
      var el = document.createElementNS("http://www.w3.org/2000/svg", d.tag);
      Object.keys(d).forEach(function(k) {
        if (k !== "tag") el.setAttribute(k, d[k]);
      });
      svg.appendChild(el);
    }
  });
  return svg;
}

var ICONS = {
  "sliders": [
    { tag: "line", x1: "4", x2: "4", y1: "21", y2: "14" },
    { tag: "line", x1: "4", x2: "4", y1: "10", y2: "3" },
    { tag: "line", x1: "12", x2: "12", y1: "21", y2: "12" },
    { tag: "line", x1: "12", x2: "12", y1: "8",  y2: "3" },
    { tag: "line", x1: "20", x2: "20", y1: "21", y2: "16" },
    { tag: "line", x1: "20", x2: "20", y1: "12", y2: "3" },
    { tag: "line", x1: "1", x2: "7", y1: "14", y2: "14" },
    { tag: "line", x1: "9", x2: "15", y1: "8", y2: "8" },
    { tag: "line", x1: "17", x2: "23", y1: "16", y2: "16" }
  ],
  "chevron-down": [ "m6 9 6 6 6-6" ]
};
