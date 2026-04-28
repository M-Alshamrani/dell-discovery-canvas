// ui/components/FilterBar.js  · v2.4.15 · §FB1-FB7
//
// Modern collapsible cross-tab filter bar. Single "Filters · N active"
// button + an inline panel with multi-select chip groups + an
// active-pill strip above the kanban with removable pills.
//
// Wires up four dimensions end-to-end:
//   - services (carried over from v2.4.14)
//   - layer (NEW v2.4.15)
//   - domain (NEW v2.4.15)
//   - urgency (NEW v2.4.15)
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
//
// State is persisted via state/filterState.js so a refresh restores
// the filter view. The CSS rules in styles.css drive the dimming —
// JS just sets body data attributes + adds .filter-match-<dim> classes
// to gap cards based on their data-<dim> attribute.

import * as fState from "../../state/filterState.js";

const DIMS = ["services", "layer", "domain", "urgency"];

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

  // Toggle button.
  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "filter-bar-toggle";
  toggle.setAttribute("data-filter-bar-toggle", "");

  // Panel (collapsed by default).
  var panel = document.createElement("div");
  panel.className = "filter-bar-panel";
  panel.setAttribute("data-filter-bar-panel", "");
  panel.style.display = "none";

  toggle.addEventListener("click", function() {
    var isOpen = panel.style.display !== "none";
    panel.style.display = isOpen ? "none" : "";
  });

  // Build dimension groups.
  dims.forEach(function(dim) {
    var group = document.createElement("div");
    group.className = "filter-bar-dim";
    group.setAttribute("data-filter-bar-dim", dim.id);
    var heading = document.createElement("div");
    heading.className = "filter-bar-dim-heading";
    heading.textContent = dim.label;
    group.appendChild(heading);

    var chipRow = document.createElement("div");
    chipRow.className = "filter-bar-chip-row";
    (dim.options || []).forEach(function(opt) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      chip.setAttribute("data-filter-chip", "");
      chip.setAttribute("data-filter-dim", dim.id);
      chip.setAttribute("data-filter-value", opt.id);
      chip.textContent = opt.label;
      // Restore active state from filterState.
      if (fState.getActiveValue(dim.id) === opt.id) {
        chip.classList.add("is-active");
      }
      chip.addEventListener("click", function() {
        fState.toggleValue(dim.id, opt.id);
      });
      chipRow.appendChild(chip);
    });
    group.appendChild(chipRow);
    panel.appendChild(group);
  });

  // Active-pill strip (rendered above the kanban; lives outside panel).
  var pillStrip = document.createElement("div");
  pillStrip.className = "filter-active-pill-strip";

  root.appendChild(toggle);
  root.appendChild(panel);
  root.appendChild(pillStrip);
  target.appendChild(root);

  // Re-paint everything on filter state change. paint() reads the
  // current snapshot and updates: toggle label, chip active states,
  // active-pill strip, and gap-card .filter-match-<dim> classes.
  function paint() {
    var snap = fState.getSnapshot();
    var activeCount = 0;

    // Toggle label.
    var activeDims = [];
    DIMS.forEach(function(d) {
      var v = snap[d];
      if (typeof v === "string" && v.length > 0) {
        activeCount++;
        activeDims.push({ dim: d, value: v });
      }
    });
    toggle.textContent = activeCount === 0
      ? "Filters"
      : "Filters · " + activeCount + " active";

    // Chip active states.
    panel.querySelectorAll(".filter-chip[data-filter-dim]").forEach(function(chip) {
      var d = chip.getAttribute("data-filter-dim");
      var v = chip.getAttribute("data-filter-value");
      chip.classList.toggle("is-active", snap[d] === v);
    });

    // Active-pill strip.
    pillStrip.innerHTML = "";
    activeDims.forEach(function(entry) {
      var pill = document.createElement("span");
      pill.className = "active-filter-pill tag";
      pill.setAttribute("data-active-filter-pill", "");
      pill.setAttribute("data-filter-dim", entry.dim);
      pill.setAttribute("data-filter-value", entry.value);
      var label = document.createElement("span");
      label.textContent = entry.dim + ": " + entry.value;
      pill.appendChild(label);
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

    // Apply match classes on gap-cards inside scope.
    applyMatchClasses(scope, snap);
  }

  // Subscribe to filter state changes.
  var unsub = fState.subscribe(function() { paint(); });

  // Cleanup hook on the root element.
  root._unsubscribeFilterBar = unsub;

  // Initial paint.
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
        // No filter on this dim -> clear match class so it doesn't
        // accidentally satisfy a future :not selector. (Not strictly
        // needed since the dim rule only fires when body data attr is
        // set, but keeps the DOM tidy.)
        card.classList.remove(matchClass);
        return;
      }
      var attr = card.getAttribute("data-" + dim);
      var matches = false;
      if (typeof attr === "string" && attr.length > 0) {
        if (dim === "services") {
          // Multi-value attribute (space-separated).
          matches = attr.split(/\s+/).indexOf(active) >= 0;
        } else {
          matches = attr === active;
        }
      }
      card.classList.toggle(matchClass, matches);
    });
  });
}
