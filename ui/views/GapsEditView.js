// ui/views/GapsEditView.js -- fully wired gaps & initiatives board

import { LAYERS, ENVIRONMENTS, BUSINESS_DRIVERS, getEnvLabel } from "../../core/config.js";
import { LayerIds, EnvironmentIds } from "../../core/models.js";
import { createGap, updateGap, deleteGap, setGapDriverId, approveGap,
         linkCurrentInstance, linkDesiredInstance,
         unlinkCurrentInstance, unlinkDesiredInstance } from "../../interactions/gapsCommands.js";
import { syncDesiredFromGap, confirmPhaseOnLink } from "../../interactions/desiredStateSync.js";
import { suggestDriverId, effectiveDriverId, effectiveDriverReason, driverLabel as driverLabelFor,
         effectiveDellSolutions } from "../../services/programsService.js";
import { saveToLocalStorage } from "../../state/sessionStore.js";
import { helpButton } from "./HelpModal.js";
import { validateActionLinks, actionById } from "../../core/taxonomy.js";
import { SERVICE_TYPES, SUGGESTED_SERVICES_BY_GAP_TYPE, suggestedFor, serviceLabel, serviceDomain } from "../../core/services.js";
import { renderDemoBanner } from "../components/DemoBanner.js";
import { getActiveValue as getFilter, toggleValue as toggleFilter, subscribe as subscribeFilter } from "../../state/filterState.js";

// v2.4.14 F1 . apply the active services filter to a gap card. Sets
// .filter-match-services when the card's services include the active
// filter value; otherwise the CSS dim rule (body[data-filter-services]
// .gap-card:not(.filter-match-services)) drops opacity.
function applyServicesMatch(card, gap) {
  // Read the active filter from getFilter (the imported state alias).
  // Fallback to body attribute so direct test renders that mutate
  // body[data-filter-services] without going through filterState
  // (e.g. VT17) still trigger the dim. Both sources stay in sync via
  // filterState.applyToBody() at module init.
  var active = getFilter("services");
  if (!active && typeof document !== "undefined" && document.body) {
    active = document.body.getAttribute("data-filter-services") || null;
  }
  if (!active) {
    card.classList.remove("filter-match-services");
    return;
  }
  var services = (gap && Array.isArray(gap.services)) ? gap.services : [];
  if (services.indexOf(active) >= 0) {
    card.classList.add("filter-match-services");
  } else {
    card.classList.remove("filter-match-services");
  }
}

// v2.4.14 CD3 . pick the dominant domain across a gap's services (cyber /
// ops / data / null). When multiple services map to multiple domains we
// take the most-frequent; ties resolve by the SERVICE_TYPES catalog order.
// Returns null when the gap has no services or none have a domain.
function pickGapDomain(gap) {
  if (!gap || !Array.isArray(gap.services) || gap.services.length === 0) return null;
  var counts = {};
  for (var i = 0; i < gap.services.length; i++) {
    var d = serviceDomain(gap.services[i]);
    if (d) counts[d] = (counts[d] || 0) + 1;
  }
  var best = null, bestCount = 0;
  Object.keys(counts).forEach(function(k) {
    if (counts[k] > bestCount) { best = k; bestCount = counts[k]; }
  });
  return best;
}

// Phase 18: count how many gaps reference an instance id (in either link
// list). Used for the "linked to N gaps" multi-link chip and for the
// link-picker warning row.
function countGapsLinking(session, instanceId) {
  return ((session && session.gaps) || []).filter(function(g) {
    return (g.relatedCurrentInstanceIds || []).indexOf(instanceId) >= 0
        || (g.relatedDesiredInstanceIds || []).indexOf(instanceId) >= 0;
  }).length;
}

// Phase 18: return the FIRST other gap (excluding `excludeGapId`) that
// already links the given instanceId. null if none. Used by the picker.
function findOtherGapLinking(session, instanceId, excludeGapId) {
  var hits = ((session && session.gaps) || []).filter(function(g) {
    if (g.id === excludeGapId) return false;
    return (g.relatedCurrentInstanceIds || []).indexOf(instanceId) >= 0
        || (g.relatedDesiredInstanceIds || []).indexOf(instanceId) >= 0;
  });
  return hits.length ? hits[0] : null;
}

export function renderGapsEditView(left, right, session) {
  var activeLayerIds        = new Set(LAYERS.map(function(l) { return l.id; }));
  var activeEnvId           = "all";
  var selectedGapId         = null;
  var dragGapId             = null;
  var showNeedsReviewOnly   = false;
  // v2.4.11 · A2 · "Show closed gaps" filter. Default off , closed gaps
  // (auto-closed when their tile's disposition flips to Keep) stay
  // hidden from the main board so they don't clutter active work.
  // User can flip on to see + recover them.
  var showClosedGaps        = false;

  // v2.4.13 S5 . demo banner mirrors Tab 1 styling so the colorful demo
  // signal follows the user across the workshop.
  if (session && session.isDemo) renderDemoBanner(left);

  // ---- Header ----
  var header = mk("div", "card");
  var titleRow = mk("div", "card-title-row");
  titleRow.appendChild(mkt("div", "card-title", "Gaps and initiatives"));
  titleRow.appendChild(helpButton("gaps"));
  header.appendChild(titleRow);
  header.appendChild(mkt("div", "card-hint",
    "Each gap bridges current to desired state. Auto-drafted gaps appear when you set a disposition in Desired State. Drag cards between phases to re-prioritise."));

  // v2.4.14 F1-F2 . services filter chip row. Click a chip to dim every
  // gap card whose services don't include that service id; click again
  // (or click another chip) to clear / switch.
  var filterRow = mk("div", "filter-chip-row");
  filterRow.setAttribute("data-filter-row", "services");
  var filterLabel = mkt("span", "filter-chip-label", "Filter by service");
  filterRow.appendChild(filterLabel);
  SERVICE_TYPES.forEach(function(svc) {
    var chip = mkt("button", "chip-filter filter-chip", svc.label.split(" / ")[0]);
    chip.type = "button";
    chip.setAttribute("data-filter-chip", "");
    chip.setAttribute("data-filter-dim", "services");
    chip.setAttribute("data-service-id", svc.id);
    if (getFilter("services") === svc.id) chip.classList.add("is-active", "active");
    chip.addEventListener("click", function() {
      toggleFilter("services", svc.id);
    });
    filterRow.appendChild(chip);
  });
  header.appendChild(filterRow);

  // v2.4.14 F1 . on filter change, re-paint the chip is-active state
  // and re-apply match class on every gap card. Lightweight (no full
  // re-render). Unsubscribe is fire-and-forget; filterState's listener
  // list is small + leaks are bounded.
  var unsubFilter = subscribeFilter(function(snap) {
    var serviceFilter = snap.services || null;
    filterRow.querySelectorAll(".chip-filter").forEach(function(c) {
      var sid = c.getAttribute("data-service-id");
      var active = sid && sid === serviceFilter;
      c.classList.toggle("is-active", !!active);
      c.classList.toggle("active", !!active);
    });
    document.querySelectorAll(".gap-card[data-services]").forEach(function(c) {
      var services = (c.getAttribute("data-services") || "").split(/\s+/).filter(Boolean);
      var match = !!serviceFilter && services.indexOf(serviceFilter) >= 0;
      if (!serviceFilter) c.classList.remove("filter-match-services");
      else c.classList.toggle("filter-match-services", match);
    });
  });
  // Make sure filter state lives only as long as the view; the next
  // renderGapsEditView call will install a fresh subscription.
  if (left._unsubFilter) try { left._unsubFilter(); } catch (e) {}
  left._unsubFilter = unsubFilter;

  // Auto-gap notice + v2.4.11 · C2 · "Review all" guided walkthrough button.
  var autoGaps = getAutoGaps();
  if (autoGaps.length > 0) {
    var notice = mk("div", "auto-gap-notice");
    var msg = "<strong>" + autoGaps.length + " auto-drafted gap" + (autoGaps.length > 1 ? "s" : "") +
      "</strong> from Desired State dispositions , review them in the board below.";
    notice.innerHTML = msg + " ";
    var reviewAllBtn = mkt("button", "btn-primary auto-gap-review-all", "Review all →");
    reviewAllBtn.title = "Walk through each unreviewed gap in sequence so you can approve, edit, or delete it.";
    reviewAllBtn.addEventListener("click", function() {
      // Walkthrough: select unreviewed gaps one at a time. Clicking the
      // button each time advances to the next; when none remain, it
      // auto-disables. Lightweight first cut , doesn't need a full
      // wizard chrome to be useful.
      var nextUnreviewed = (session.gaps || []).find(function(g) {
        return g.reviewed === false && g.status !== "closed";
      });
      if (nextUnreviewed) {
        selectedGapId = nextUnreviewed.id;
        renderAll();
      }
    });
    notice.appendChild(reviewAllBtn);
    header.appendChild(notice);
  }

  // Filter row
  var filterRow = mk("div", "filter-row");
  filterRow.appendChild(mkt("span", "filter-label", "Layers:"));
  var lc = mk("div", "chips-row");
  LAYERS.forEach(function(layer) {
    var chip = mkt("div", "chip-filter active", layer.label);
    chip.addEventListener("click", function() {
      chip.classList.toggle("active");
      if (chip.classList.contains("active")) activeLayerIds.add(layer.id);
      else activeLayerIds.delete(layer.id);
      if (!activeLayerIds.size) {
        LAYERS.forEach(function(l) { activeLayerIds.add(l.id); });
        lc.querySelectorAll(".chip-filter").forEach(function(c) { c.classList.add("active"); });
      }
      renderAll();
    });
    lc.appendChild(chip);
  });
  filterRow.appendChild(lc);

  var envSel = mk("select", "form-select inline-sel");
  var allOpt = document.createElement("option"); allOpt.value = "all"; allOpt.textContent = "All environments";
  envSel.appendChild(allOpt);
  ENVIRONMENTS.forEach(function(env) {
    var opt = document.createElement("option"); opt.value = env.id; opt.textContent = getEnvLabel(env.id, session);
    envSel.appendChild(opt);
  });
  envSel.addEventListener("change", function(e) { activeEnvId = e.target.value; renderAll(); });
  filterRow.appendChild(envSel);

  // v2.1 · "Needs review only" toggle (replaces unmapped-solutions filter).
  var needsReviewToggle = mk("label", "chip-filter needs-review-toggle");
  var needsReviewCb = document.createElement("input");
  needsReviewCb.type = "checkbox";
  needsReviewCb.className = "needs-review-check";
  needsReviewCb.checked = false;
  needsReviewCb.addEventListener("change", function() {
    showNeedsReviewOnly = needsReviewCb.checked;
    needsReviewToggle.classList.toggle("active", showNeedsReviewOnly);
    renderAll();
  });
  needsReviewToggle.appendChild(needsReviewCb);
  needsReviewToggle.appendChild(document.createTextNode(" Needs review only"));
  needsReviewToggle.title = "Show only gaps that still need approval or review.";
  filterRow.appendChild(needsReviewToggle);

  // v2.4.11 · A2 · "Show closed gaps" filter chip. Dynamic count badge
  // when there are closed gaps so the user knows there's something to
  // recover. Toggle re-renders the board.
  var closedCount = (session.gaps || []).filter(function(g) { return g.status === "closed"; }).length;
  var closedToggle = mk("label", "chip-filter closed-gaps-toggle");
  var closedCb = document.createElement("input");
  closedCb.type = "checkbox";
  closedCb.className = "closed-gaps-check";
  closedCb.checked = showClosedGaps;
  closedCb.addEventListener("change", function() {
    showClosedGaps = closedCb.checked;
    closedToggle.classList.toggle("active", showClosedGaps);
    renderAll();
  });
  closedToggle.appendChild(closedCb);
  closedToggle.appendChild(document.createTextNode(
    " Show closed gaps" + (closedCount > 0 ? " (" + closedCount + ")" : "")));
  closedToggle.title = "Closed gaps are hidden by default. They appear when their tile's disposition was set to Keep, or when manually closed. Tick to see + recover them.";
  filterRow.appendChild(closedToggle);

  var addBtn = mkt("button", "btn-primary", "+ Add gap");
  addBtn.style.marginLeft = "auto";
  addBtn.addEventListener("click", function() { openAddDialog(); });
  filterRow.appendChild(addBtn);

  // v2.4.12 · U1 · the v2.4.11 D2 "+ Add operational / services gap"
  // button is removed. Services attach to any gap as a multi-chip facet
  // (see "Services needed" section in the gap detail panel) , a dedicated
  // ops-typed gap CTA reinforced a wrong mental model.

  header.appendChild(filterRow);
  left.appendChild(header);

  var board = mk("div", "kanban");
  left.appendChild(board);

  showPlaceholder(right);

  // ---- Helpers ----
  // v2.4.11 · A1 · soft-chip helper. Probes the gap as if reviewed:true
  // and catches the friendly error from validateActionLinks. Returns the
  // friendly message string (or null if the gap is shape-valid).
  function computeDraftIssue(gap) {
    if (!gap || gap.status === "closed") return null;
    try {
      validateActionLinks(Object.assign({}, gap, { reviewed: true }));
      return null;
    } catch (e) {
      return e.message || String(e);
    }
  }

  function getAutoGaps() {
    return (session.gaps || []).filter(function(g) {
      return g.relatedDesiredInstanceIds && g.relatedDesiredInstanceIds.length > 0
          && g.status === "open" && !g.notes;
    });
  }

  function filteredGaps() {
    var layerIds = Array.from(activeLayerIds);
    var envId    = activeEnvId;
    // v2.4.11 · B1 · already correctly operates on `affectedLayers` (with
    // a fallback to [layerId] for legacy sessions). The v2.4.9 invariant
    // ensures affectedLayers[0] === layerId, so a primary-Compute gap
    // with affectedLayers=["compute","storage"] correctly matches the
    // Storage layer chip too.
    return (session.gaps || []).filter(function(g) {
      var layers = (g.affectedLayers && g.affectedLayers.length) ? g.affectedLayers : [g.layerId];
      var envs   = g.affectedEnvironments || [];
      var lOk = !layerIds.length || layers.some(function(l) { return layerIds.indexOf(l) >= 0; });
      var eOk = envId === "all" || envs.length === 0 || envs.indexOf(envId) >= 0;
      var nrOk = !showNeedsReviewOnly || g.reviewed === false;
      // v2.4.11 · A2 · closed gaps (status === "closed") are hidden by
      // default. Show them only when the "Show closed" filter chip is on.
      var statusOk = (g.status !== "closed") || showClosedGaps;
      return lOk && eOk && nrOk && statusOk;
    });
  }

  function renderAll() { renderBoard(); renderDetail(); }

  // ---- Kanban board with drag-and-drop ----
  function renderBoard() {
    board.innerHTML = "";
    var gaps = filteredGaps();
    var phases = [
      ["now",   "Now (0-12 months)"],
      ["next",  "Next (12-24 months)"],
      ["later", "Later (>24 months)"]
    ];

    phases.forEach(function(phaseInfo) {
      var phId    = phaseInfo[0];
      var phLabel = phaseInfo[1];
      var phGaps  = gaps.filter(function(g) { return (g.phase || "now") === phId; });

      var col  = mk("div", "kanban-col");
      col.setAttribute("data-phase", phId);

      var head = mk("div", "kanban-col-head");
      var titleSpan = mkt("span", "kanban-col-title", phLabel);
      var countSpan = mkt("span", "kanban-col-count", String(phGaps.length));
      head.appendChild(titleSpan);
      head.appendChild(countSpan);
      col.appendChild(head);

      var body = mk("div", "kanban-col-body");
      body.setAttribute("data-drop-zone", phId);

      // Drag-over styling
      body.addEventListener("dragover", function(e) {
        e.preventDefault();
        body.classList.add("drop-hover");
      });
      body.addEventListener("dragleave", function() {
        body.classList.remove("drop-hover");
      });
      body.addEventListener("drop", function(e) {
        e.preventDefault();
        body.classList.remove("drop-hover");
        if (dragGapId) {
          try {
            updateGap(session, dragGapId, { phase: phId });
            // Bidirectional phase sync: propagate gap.phase → linked desired instance(s) (T4.5).
            syncDesiredFromGap(session, dragGapId);
            saveToLocalStorage();
            renderAll();
          } catch(err) { alert("Could not move: " + err.message); }
        }
      });

      phGaps.forEach(function(gap) { body.appendChild(buildCard(gap)); });
      col.appendChild(body);
      board.appendChild(col);
    });
  }

  function buildCard(gap) {
    var isSelected = gap.id === selectedGapId;
    var isAuto     = !gap.notes && gap.relatedDesiredInstanceIds && gap.relatedDesiredInstanceIds.length > 0;
    var needsReview = gap.reviewed === false;
    var cls = "gap-card" + (isSelected ? " selected" : "") + (isAuto ? " gap-card-auto" : "");
    if (needsReview) cls += " gap-needs-review";
    // Criticality accent , derived from gap.urgency (T4.4).
    if (gap.urgency) cls += " crit-" + gap.urgency.toLowerCase();
    var card = mk("div", cls);
    card.draggable = true;
    // v2.4.14 CD3 . carry the gap's domain (derived from its services'
    // dominant domain) on a data attribute so .gap-card::before paints
    // the muted-hue left bar via CSS.
    var domain = pickGapDomain(gap);
    if (domain) card.setAttribute("data-domain", domain);
    // v2.4.14 F1 . cards declare their services as a space-separated
    // attribute so the filter system + CSS dim rule can match.
    if (Array.isArray(gap.services) && gap.services.length > 0) {
      card.setAttribute("data-services", gap.services.join(" "));
    }
    // Apply the current services filter match class so initial render
    // is consistent with body[data-filter-services] state.
    applyServicesMatch(card, gap);

    // v2.1 · pulsing review dot for unreviewed auto-drafts.
    if (needsReview) {
      var dot = mk("span", "gap-review-dot");
      dot.title = "Auto-drafted , review and approve in the detail panel.";
      card.appendChild(dot);
    }

    var layerLabel = layerName(gap.layerId);
    var envTags = (gap.affectedEnvironments || []).map(function(id) {
      return envName(id);
    }).join(", ");

    var titleEl = mkt("div", "gap-card-title", gap.description || "(no description)");
    card.appendChild(titleEl);

    var metaEl = mkt("div", "gap-card-meta",
      layerLabel + (gap.gapType ? " - " + gap.gapType : "") + (envTags ? " | " + envTags : ""));
    card.appendChild(metaEl);

    var badgesEl = mk("div", "gap-card-badges");
    var urgBadge = mkt("span", "urgency-badge " + urgClass(gap.urgency), gap.urgency);
    // Tooltip explains urgency is derived and points at source (T4.2 / T3.16).
    var srcLabel = gapOriginCriticalityHint(gap, session);
    urgBadge.title = "Urgency is derived from the linked current instance's criticality , not editable. " + srcLabel;
    badgesEl.appendChild(urgBadge);
    var shape = mk("span", "crit-shape-" + (gap.urgency || "medium").toLowerCase());
    shape.title = urgBadge.title;
    badgesEl.appendChild(shape);

    // Strategic-driver chip (effective , explicit override OR auto-suggest).
    // "★" prefix = confirmed manually; "☆" prefix = suggested (one-click confirm).
    var effDid = effectiveDriverId(gap, session);
    if (effDid) {
      var glyph = gap.driverId ? "★ " : "☆ ";
      var progBadge = mkt("span", "program-badge", glyph + (driverLabelFor(effDid) || effDid));
      progBadge.title = gap.driverId
        ? "Strategic driver (confirmed). Click a card to change in the right panel."
        : "Strategic driver (auto-suggested). Confirm or override it in the right panel.";
      if (!gap.driverId) progBadge.classList.add("program-suggested");
      badgesEl.appendChild(progBadge);
    }

    if (isAuto) {
      badgesEl.appendChild(mkt("span", "auto-badge", "Auto-drafted"));
    }
    // v2.1 · Dell solutions derive from linked Dell desired tiles, not free text.
    var derivedSolutions = effectiveDellSolutions(gap, session);
    if (derivedSolutions.length > 0) {
      badgesEl.appendChild(mkt("span", "solutions-badge", derivedSolutions[0]));
    }
    if (gap.status === "closed") {
      badgesEl.appendChild(mkt("span", "status-badge", "Closed"));
    }
    if (gap.relatedCurrentInstanceIds && gap.relatedCurrentInstanceIds.length) {
      badgesEl.appendChild(mkt("span", "link-badge",
        gap.relatedCurrentInstanceIds.length + " current"));
    }
    if (gap.relatedDesiredInstanceIds && gap.relatedDesiredInstanceIds.length) {
      badgesEl.appendChild(mkt("span", "link-badge link-badge-desired",
        gap.relatedDesiredInstanceIds.length + " desired"));
    }
    card.appendChild(badgesEl);

    card.addEventListener("click", function() {
      selectedGapId = gap.id;
      renderAll();
    });
    card.addEventListener("dragstart", function(e) {
      dragGapId = gap.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", function() {
      card.classList.remove("dragging");
      dragGapId = null;
    });

    return card;
  }

  // ---- Detail / edit panel ----
  function renderDetail() {
    right.innerHTML = "";
    var gap = (session.gaps || []).find(function(g) { return g.id === selectedGapId; });
    if (!gap) { showPlaceholder(right); return; }

    var panel = mk("div", "detail-panel");

    // Status bar at top
    var statusRow = mk("div", "gap-status-row");
    statusRow.appendChild(mkt("span", "urgency-badge " + urgClass(gap.urgency), gap.urgency));
    if (gap.gapType) statusRow.appendChild(mkt("span", "type-badge", gap.gapType));
    statusRow.appendChild(mkt("span", "status-badge", gap.status || "open"));
    panel.appendChild(statusRow);

    var titleEl = mkt("div", "detail-title", gap.description || "(no description)");
    panel.appendChild(titleEl);

    var subEl = mkt("div", "detail-sub",
      layerName(gap.layerId) + " | " + phaseLabel(gap.phase) +
      ((gap.affectedEnvironments && gap.affectedEnvironments.length)
        ? " | " + gap.affectedEnvironments.map(envName).join(", ") : ""));
    panel.appendChild(subEl);

    // v2.4.11 · A1 · soft chip when this gap's shape doesn't satisfy its
    // Action's link rules. Doesn't block editing , just surfaces what's
    // missing so the user knows what to fix before approving.
    var draftIssue = computeDraftIssue(gap);
    if (draftIssue) {
      var draftChip = mk("div", "draft-issue-chip");
      draftChip.appendChild(mkt("span", "draft-issue-eyebrow", "REVIEW NEEDED"));
      draftChip.appendChild(mkt("span", "draft-issue-msg", draftIssue));
      panel.appendChild(draftChip);
    }
    // v2.4.11 · A2 · closed-status banner when the gap is closed.
    if (gap.status === "closed") {
      var closedChip = mk("div", "closed-status-chip");
      closedChip.appendChild(mkt("span", "closed-status-eyebrow", "CLOSED"));
      closedChip.appendChild(mkt("span", "closed-status-msg",
        gap.closeReason || "manually closed"));
      var reopenBtn = mkt("button", "btn-ghost-sm", "Reopen");
      reopenBtn.title = "Reopen this gap. Status returns to 'open'.";
      reopenBtn.addEventListener("click", function() {
        try {
          updateGap(session, gap.id, { status: "open", closeReason: undefined, closedAt: undefined });
          saveToLocalStorage();
          renderAll();
        } catch(e) { showErr(panel, e.message); }
      });
      closedChip.appendChild(reopenBtn);
      panel.appendChild(closedChip);
    }

    // ---- Edit form ----
    var form = mk("div", "edit-form");
    var layerMap = {};
    LAYERS.forEach(function(l) { layerMap[l.id] = l.label; });

    form.appendChild(fg("Description",
      ta("description", gap.description || "", "One-line description of the gap or initiative")));
    // v2.4.11 · B2 · clarified label.
    form.appendChild(fg("Primary layer (drives the project bucket)",
      selEl("layerId", LayerIds, gap.layerId, layerMap)));
    // v2.4.11 · B2 · "Also affects" chips for additional layers. Excludes
    // the primary (which is always in affectedLayers[0] per the v2.4.9
    // invariant); user adds/removes layers here. Save handler stitches
    // primary back at index 0.
    var alsoGroup = mk("div", "form-group");
    alsoGroup.appendChild(mkt("label", "form-label", "Also affects (additional layers)"));
    var alsoRow = mk("div", "chips-row also-affects-chips");
    var existingAlso = (gap.affectedLayers || []).slice(1);  // skip primary at [0]
    LAYERS.forEach(function(layer) {
      if (layer.id === gap.layerId) return;  // primary not selectable here
      var chip = mkt("div", "chip-filter" + (existingAlso.indexOf(layer.id) >= 0 ? " active" : ""), layer.label);
      chip.dataset.alsoLayerId = layer.id;
      chip.addEventListener("click", function() {
        chip.classList.toggle("active");
      });
      alsoRow.appendChild(chip);
    });
    alsoGroup.appendChild(alsoRow);
    form.appendChild(alsoGroup);
    // Gap type: read-only display for auto-drafted gaps (T4.3);
    // editable ONLY when it's manual + hasn't been set yet (T4.14).
    if (isAutoDrafted(gap)) {
      form.appendChild(fg("Gap type", readOnlyField(gap.gapType || ",",
        "Gap type is derived from the source disposition. Change disposition in Desired State to change gap type.")));
    } else {
      form.appendChild(fg("Gap type",
        selEl("gapType", ["","enhance","replace","introduce","consolidate","ops"], gap.gapType || "")));
    }
    // v2.4.11 · A6 · urgency selector with override semantics.
    //   urgencyOverride: false → propagation owns urgency (P4/P7 sync from
    //                            linked current's criticality). UI shows the
    //                            value as derived + a "🔒 lock" button to pin.
    //   urgencyOverride: true  → user pinned. UI shows a real selector + an
    //                            "↺ auto" button to release back to derived.
    var urgencyGroup = mk("div", "form-group");
    urgencyGroup.appendChild(mkt("label", "form-label", "Urgency"));
    var urgencyRow = mk("div", "urgency-row");
    var isOverridden = gap.urgencyOverride === true;
    if (isOverridden) {
      // Editable selector + ↺ auto button.
      var urgSel = selEl("urgency", ["High","Medium","Low"], gap.urgency || "Medium");
      urgencyRow.appendChild(urgSel);
      var autoBtn = mkt("button", "btn-ghost-sm urg-auto-btn", "↺ auto");
      autoBtn.title = "Release urgency back to auto-derive (urgency follows the linked current's criticality).";
      autoBtn.addEventListener("click", function() {
        try {
          updateGap(session, gap.id, { urgencyOverride: false });
          // Re-derive urgency immediately from any linked current.
          var firstCur = (gap.relatedCurrentInstanceIds || []).map(function(id) {
            return (session.instances || []).find(function(i) { return i.id === id; });
          }).find(Boolean);
          if (firstCur && firstCur.criticality) {
            updateGap(session, gap.id, { urgency: firstCur.criticality });
          }
          saveToLocalStorage();
          renderAll();
        } catch(e) { showErr(panel, e.message); }
      });
      urgencyRow.appendChild(autoBtn);
      urgencyRow.appendChild(mkt("span", "urg-override-indicator", "🔒 manually set"));
    } else {
      // Read-only display + 🔒 lock button.
      urgencyRow.appendChild(mkt("span", "urg-derived-value urg-" + (gap.urgency||"Medium").toLowerCase(),
        gap.urgency || ","));
      var lockBtn = mkt("button", "btn-ghost-sm urg-lock-btn", "🔒 set manually");
      lockBtn.title = "Pin this urgency. Future propagation from criticality changes will not overwrite it.";
      lockBtn.addEventListener("click", function() {
        try {
          updateGap(session, gap.id, { urgencyOverride: true });
          saveToLocalStorage();
          renderAll();
        } catch(e) { showErr(panel, e.message); }
      });
      urgencyRow.appendChild(lockBtn);
      urgencyRow.appendChild(mkt("span", "urg-derived-indicator", "↺ auto from linked current"));
    }
    urgencyGroup.appendChild(urgencyRow);
    form.appendChild(urgencyGroup);
    form.appendChild(fg("Phase",
      selEl("phase", ["now","next","later"], gap.phase)));
    form.appendChild(fg("Status",
      selEl("status", ["open","in_progress","closed","deferred"], gap.status || "open")));

    // Program (driver) dropdown , session drivers + Unassigned. Auto-suggested
    // if no explicit driverId is set.
    var programOpts = [""].concat((session.customer.drivers || []).map(function(d) { return d.id; }));
    var programLabels = { "": "Unassigned" };
    (session.customer.drivers || []).forEach(function(d) {
      var meta = BUSINESS_DRIVERS.find(function(bd) { return bd.id === d.id; });
      programLabels[d.id] = (meta ? meta.label : d.id) + (gap.driverId === d.id ? "" : "");
    });
    var currentDriverVal = gap.driverId || "";
    var progSel = selEl("driverId", programOpts, currentDriverVal, programLabels);
    progSel.setAttribute("title",
      "Which strategic driver does this gap serve? Pick to override the auto-suggestion.");
    form.appendChild(fg("Strategic driver", progSel));
    // v2.4.11 · A5 · explicit "Auto-suggested driver: X because Y" chip
    // below the dropdown, replacing the silent ★-in-dropdown affordance.
    // Makes the suggestion logic visible and overridable.
    var driverReason = effectiveDriverReason(gap, session);
    if (driverReason && driverReason.source === "suggested" && driverReason.driverId) {
      var meta = BUSINESS_DRIVERS.find(function(d) { return d.id === driverReason.driverId; });
      var label = meta ? meta.label : driverReason.driverId;
      var hintRow = mk("div", "auto-driver-chip");
      hintRow.appendChild(mkt("span", "auto-driver-eyebrow", "AUTO-SUGGESTED"));
      hintRow.appendChild(mkt("span", "auto-driver-label", label));
      hintRow.appendChild(mkt("span", "auto-driver-reason", "because " + driverReason.reason));
      var acceptBtn = mkt("button", "btn-ghost-sm auto-driver-accept", "Pin this driver");
      acceptBtn.title = "Set this gap's driver explicitly to '" + label + "' so future heuristic changes don't reassign it.";
      acceptBtn.addEventListener("click", function() {
        try {
          setGapDriverId(session, gap.id, driverReason.driverId);
          saveToLocalStorage();
          renderAll();
        } catch(e) { showErr(panel, e.message); }
      });
      hintRow.appendChild(acceptBtn);
      form.appendChild(hintRow);
    } else if (driverReason && driverReason.source === "none") {
      var noneRow = mk("div", "auto-driver-chip auto-driver-none");
      noneRow.appendChild(mkt("span", "auto-driver-eyebrow", "AUTO-SUGGESTED"));
      noneRow.appendChild(mkt("span", "auto-driver-reason", driverReason.reason));
      form.appendChild(noneRow);
    }

    // Affected environments -- multi-check
    var envGroup = mk("div", "form-group");
    envGroup.appendChild(mkt("label", "form-label", "Affected environments"));
    var envCheckRow = mk("div", "env-check-row");
    ENVIRONMENTS.forEach(function(env) {
      var lbl = mk("label", "env-check-label");
      var cb  = document.createElement("input");
      cb.type = "checkbox"; cb.value = env.id;
      cb.className = "env-checkbox";
      cb.checked = (gap.affectedEnvironments || []).indexOf(env.id) >= 0;
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(" " + getEnvLabel(env.id, session)));
      envCheckRow.appendChild(lbl);
    });
    envGroup.appendChild(envCheckRow);
    form.appendChild(envGroup);

    // v2.1 · mappedDellSolutions input removed. Dell solutions derive render-time from
    // linked desired tiles tagged `vendorGroup: "dell"`. Here we surface the derived list
    // as a read-only field so the presales sees the result of their link choices.
    var solutions = effectiveDellSolutions(gap, session);
    var solutionsText = solutions.length === 0
      ? "None yet , link Dell-tagged desired tiles below to populate."
      : solutions.join(", ");
    form.appendChild(fg("Dell solutions (derived)",
      readOnlyField(solutionsText,
        "Derived from linked desired tiles with vendor = Dell. Manage the links below to change this list.")));

    // v2.4.12 · Services needed , multi-chip facet attached to any gap.
    // Picked chips are full-color (click to remove); suggested chips
    // appear under a SUGGESTED eyebrow (greyed, click to add). Suggested
    // is OPT-IN , never auto-applied. Suggestions re-derive on gapType
    // change but never auto-select.
    var servicesGroup = mk("div", "form-group services-group");
    servicesGroup.appendChild(mkt("label", "form-label", "Services needed"));
    var pickedServices = Array.isArray(gap.services) ? gap.services.slice() : [];
    var suggestedRow = mk("div", "services-suggested-row");
    var pickedRow    = mk("div", "services-picked-row");
    var addRow       = mk("div", "services-add-row");
    pickedRow.dataset.servicesPicked = "true";   // Save handler queries this.

    function paintServices() {
      pickedRow.innerHTML = "";
      suggestedRow.innerHTML = "";
      addRow.innerHTML = "";
      // Picked chips (full color, click to remove).
      pickedServices.forEach(function(id) {
        var lbl = serviceLabel(id) || id;
        var chip = mkt("button", "chip-filter services-chip-picked active", lbl + " ✕");
        chip.type = "button";
        chip.dataset.serviceId = id;
        chip.title = "Click to remove '" + lbl + "'";
        chip.addEventListener("click", function(ev) {
          ev.preventDefault();
          pickedServices = pickedServices.filter(function(x) { return x !== id; });
          paintServices();
        });
        pickedRow.appendChild(chip);
      });
      if (pickedServices.length === 0) {
        var hint = mkt("span", "services-empty-hint", "No services attached yet.");
        pickedRow.appendChild(hint);
      }
      // Suggested chips (greyed, click to add). Re-derive from current
      // gap.gapType minus already-picked.
      var suggestions = suggestedFor(gap.gapType, pickedServices);
      if (suggestions.length > 0) {
        suggestedRow.appendChild(mkt("span", "services-eyebrow", "SUGGESTED"));
        suggestions.forEach(function(id) {
          var lbl = serviceLabel(id) || id;
          var chip = mkt("button", "chip-filter services-chip-suggested", "+ " + lbl);
          chip.type = "button";
          chip.dataset.serviceId = id;
          chip.title = "Click to add '" + lbl + "' as a service for this gap";
          chip.addEventListener("click", function(ev) {
            ev.preventDefault();
            pickedServices.push(id);
            paintServices();
          });
          suggestedRow.appendChild(chip);
        });
      }
      // v2.4.12 · P1 · "+ Add service" picker exposes the FULL catalog so
      // service ids OUTSIDE the SUGGESTED-for-this-gapType list are reachable
      // (e.g. assessment, decommissioning, custom_dev on a Replace gap).
      // SUGGESTED ones for the current gapType get a ★ marker in the option
      // label so the user sees which are recommended without losing access
      // to the rest. Resets after each pick.
      var suggestedSet = (SUGGESTED_SERVICES_BY_GAP_TYPE[gap.gapType] || []);
      var availableForPicker = SERVICE_TYPES.filter(function(svc) {
        return pickedServices.indexOf(svc.id) < 0;
      });
      if (availableForPicker.length > 0) {
        var picker = document.createElement("select");
        picker.className = "services-add-picker";
        picker.title = "Pick any service from the catalog. ★ = suggested for this gap type.";
        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "+ Add service…";
        placeholder.selected = true;
        picker.appendChild(placeholder);
        availableForPicker.forEach(function(svc) {
          var opt = document.createElement("option");
          opt.value = svc.id;
          var star = (suggestedSet.indexOf(svc.id) >= 0) ? "★ " : "   ";
          opt.textContent = star + svc.label;
          picker.appendChild(opt);
        });
        picker.addEventListener("change", function() {
          var pickedId = picker.value;
          if (!pickedId) return;
          pickedServices.push(pickedId);
          paintServices();   // re-paints; new picker fresh-resets to placeholder
        });
        addRow.appendChild(picker);
      } else {
        addRow.appendChild(mkt("span", "services-empty-hint", "All services attached."));
      }
    }
    paintServices();
    servicesGroup.appendChild(suggestedRow);
    servicesGroup.appendChild(pickedRow);
    servicesGroup.appendChild(addRow);
    form.appendChild(servicesGroup);

    form.appendChild(fg("Notes / business context",
      ta("notes", gap.notes || "",
        "Business context, risk, regulatory drivers, assumptions, customer pain...")));
    panel.appendChild(form);

    // Save / Delete
    var actions = mk("div", "form-actions");

    // v2.1 · Approve-draft button only when this gap still needs review.
    if (gap.reviewed === false) {
      var approveBtn = mkt("button", "btn-secondary approve-draft-btn", "✓ Approve draft");
      approveBtn.title = "Accept this auto-drafted gap as-is without further changes.";
      approveBtn.addEventListener("click", function() {
        try { approveGap(session, gap.id); saveToLocalStorage(); renderAll(); }
        catch(e) { showErr(panel, e.message); }
      });
      actions.appendChild(approveBtn);
    }

    var saveBtn = mkt("button", "btn-primary save-btn", "Save changes");
    saveBtn.addEventListener("click", function() {
      // v2.4.11 · save button gets visible loading + success + error states.
      // Before: text swapped to "Saved" briefly on success only , no feedback
      // on click, no error state. User reported "save doesn't have any
      // dynamic clicking pattern". Fixing.
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      saveBtn.classList.remove("save-ok", "save-err");
      var patch = {};
      form.querySelectorAll("[data-prop]").forEach(function(el) {
        patch[el.getAttribute("data-prop")] = el.value || undefined;
      });
      // Collect environment checkboxes
      var checkedEnvs = [];
      form.querySelectorAll(".env-checkbox:checked").forEach(function(cb) {
        checkedEnvs.push(cb.value);
      });
      patch.affectedEnvironments = checkedEnvs;
      // v2.4.11 · B2 · collect Also-affects chips into affectedLayers
      // (with primary stitched at index 0 by setPrimaryLayer in updateGap).
      var alsoChips = form.querySelectorAll(".also-affects-chips .chip-filter.active");
      var alsoLayers = [];
      alsoChips.forEach(function(c) {
        if (c.dataset && c.dataset.alsoLayerId) alsoLayers.push(c.dataset.alsoLayerId);
      });
      var primaryForLayers = patch.layerId || gap.layerId;
      patch.affectedLayers = [primaryForLayers].concat(
        alsoLayers.filter(function(l) { return l !== primaryForLayers; })
      );
      // v2.4.12 · collect picked services from the chip selector.
      var pickedRowEl = form.querySelector("[data-services-picked='true']");
      if (pickedRowEl) {
        var pickedChips = pickedRowEl.querySelectorAll(".services-chip-picked");
        var pickedIds = [];
        pickedChips.forEach(function(c) {
          if (c.dataset && c.dataset.serviceId) pickedIds.push(c.dataset.serviceId);
        });
        patch.services = pickedIds;   // updateGap will normalize/dedupe
      }
      // v2.4.11 · A6 · urgency comes from the override-aware UI. If
      // gap.urgencyOverride is true, the form has a real selector; if
      // false, the form has a read-only display (no data-prop). In the
      // override=false case, preserve existing urgency. In the
      // override=true case, accept the user's choice.
      if (gap.urgencyOverride === true && patch.urgency) {
        // accept whatever the selector chose
      } else {
        patch.urgency = gap.urgency || "Medium";
      }
      patch.phase   = patch.phase   || "now";
      patch.status  = patch.status  || "open";
      // Lock gapType for auto-drafted gaps (T4.3 / T4.14 , derived from disposition).
      if (isAutoDrafted(gap)) patch.gapType = gap.gapType;
      else if (!patch.gapType) delete patch.gapType;
      // driverId is managed separately via setGapDriverId (allows delete when Unassigned)
      var driverIdChoice = patch.driverId;
      delete patch.driverId;
      try {
        updateGap(session, gap.id, patch);
        setGapDriverId(session, gap.id, driverIdChoice || null);
        // Bidirectional phase sync after manual phase edit (T4.5).
        syncDesiredFromGap(session, gap.id);
        saveToLocalStorage();
        saveBtn.textContent = "Saved ✓";
        saveBtn.classList.add("save-ok");
        setTimeout(function() {
          saveBtn.classList.remove("save-ok");
          saveBtn.textContent = "Save changes";
          saveBtn.disabled = false;
          renderAll();
        }, 900);
      } catch(e) {
        // Visible error state on the button + inline error in the panel.
        saveBtn.textContent = "Couldn't save";
        saveBtn.classList.add("save-err");
        saveBtn.disabled = false;
        showErr(panel, e.message);
        setTimeout(function() {
          saveBtn.classList.remove("save-err");
          saveBtn.textContent = "Save changes";
        }, 2000);
      }
    });
    actions.appendChild(saveBtn);

    var delBtn = mkt("button", "btn-danger", "Delete");
    delBtn.addEventListener("click", function() {
      if (!confirm("Delete this gap?")) return;
      deleteGap(session, gap.id);
      saveToLocalStorage();
      selectedGapId = null;
      renderAll();
    });
    actions.appendChild(delBtn);
    panel.appendChild(actions);

    // ---- Linked instances section (Phase 18: always-visible, no collapse) ----
    var linksWrap = mk("div", "linked-inline-wrap");

    // Current instances
    var curSection = mk("div", "link-section");
    curSection.appendChild(mkt("div", "link-section-title", "Current state"));
    var curList = mk("div", "link-list");
    var currentLinked = (gap.relatedCurrentInstanceIds || []).map(function(id) {
      return (session.instances || []).find(function(i) { return i.id === id; });
    }).filter(Boolean);

    if (currentLinked.length === 0) {
      curList.appendChild(mkt("div", "link-empty", "None linked"));
    } else {
      currentLinked.forEach(function(inst) {
        curList.appendChild(buildLinkRow(inst, function() {
          try { unlinkCurrentInstance(session, gap.id, inst.id); saveToLocalStorage(); renderAll(); }
          catch(e) { alert(e.message); }
        }));
      });
    }
    curSection.appendChild(curList);

    var addCurBtn = mkt("button", "btn-ghost-sm", "+ Link current instance");
    addCurBtn.addEventListener("click", function() {
      openLinkPicker("current", gap, function(instId) {
        try { linkCurrentInstance(session, gap.id, instId); saveToLocalStorage(); renderAll(); }
        catch(e) { alert(e.message); }
      });
    });
    curSection.appendChild(addCurBtn);
    linksWrap.appendChild(curSection);

    // Desired instances
    var desSection = mk("div", "link-section");
    desSection.appendChild(mkt("div", "link-section-title", "Desired state"));
    var desList = mk("div", "link-list");
    var desiredLinked = (gap.relatedDesiredInstanceIds || []).map(function(id) {
      return (session.instances || []).find(function(i) { return i.id === id; });
    }).filter(Boolean);

    if (desiredLinked.length === 0) {
      desList.appendChild(mkt("div", "link-empty", "None linked"));
    } else {
      desiredLinked.forEach(function(inst) {
        desList.appendChild(buildLinkRow(inst, function() {
          try { unlinkDesiredInstance(session, gap.id, inst.id); saveToLocalStorage(); renderAll(); }
          catch(e) { alert(e.message); }
        }));
      });
    }
    desSection.appendChild(desList);

    var addDesBtn = mkt("button", "btn-ghost-sm", "+ Link desired instance");
    addDesBtn.addEventListener("click", function() {
      openLinkPicker("desired", gap, function(instId) {
        // v2.1 · phase-conflict guard: if the tile's current phase differs from the gap's,
        // ask the presales before auto-reassigning. Gap wins per locked decision.
        // v2.4.11 · A4 · the function now refuses without { acknowledged: true }
        // when there's a conflict , make the confirm + acknowledged opt-in
        // explicit so no caller can accidentally bypass.
        var check = confirmPhaseOnLink(session, gap.id, instId);
        var acknowledged = false;
        if (check.status === "conflict") {
          var msg = "Linking '" + check.desiredLabel + "' will reassign its Phase from " +
                    check.currentPriority + " to " + check.targetPriority + ".\n\nProceed?";
          if (!window.confirm(msg)) return;
          acknowledged = true;
        }
        try {
          linkDesiredInstance(session, gap.id, instId, { acknowledged: acknowledged });
          syncDesiredFromGap(session, gap.id);     // gap wins → desired tile picks up gap.phase
          saveToLocalStorage();
          renderAll();
        } catch(e) { alert(e.message); }
      });
    });
    desSection.appendChild(addDesBtn);
    linksWrap.appendChild(desSection);

    panel.appendChild(linksWrap);
    right.appendChild(panel);
  }

  // buildLinkRow renders one linked-instance row in the gap detail panel.
  // Phase 18: when the instance is also linked from another gap, append a
  // red `.multi-linked-chip` so the presales sees the cross-gap link
  // implication at a glance.
  function buildLinkRow(inst, onUnlink) {
    var row = mk("div", "link-row link-row-clickable");
    var dot = mk("span", "cmd-dot cmd-dot-" + (inst.vendorGroup || "custom"));
    row.appendChild(dot);
    row.appendChild(mkt("span", "link-row-label", inst.label));
    row.appendChild(mkt("span", "link-row-sub",
      layerName(inst.layerId) + " / " + envName(inst.environmentId)));
    // v2.4.11 · E1 · clickable navigation to the linked tile. Was a
    // visual-only row before; now the dot+label area dispatches a custom
    // event that app.js listens for, switches to the right tab (Tab 2 for
    // current, Tab 3 for desired), and scrolls the tile into view.
    row.title = "Click to open this " + inst.state + "-state tile in Tab " +
      (inst.state === "current" ? "2" : "3");
    row.addEventListener("click", function(e) {
      // Don't fire when the unlink × is clicked.
      if (e.target && e.target.classList && e.target.classList.contains("link-unlink-btn")) return;
      document.dispatchEvent(new CustomEvent("dell-canvas:navigate-to-tile", {
        detail: {
          instanceId:    inst.id,
          state:         inst.state,
          layerId:       inst.layerId,
          environmentId: inst.environmentId
        }
      }));
    });
    var totalGaps = countGapsLinking(session, inst.id);
    if (totalGaps >= 2) {
      var chip = mkt("span", "multi-linked-chip", "linked to " + totalGaps + " gaps");
      chip.title = "This instance is linked to " + totalGaps + " gaps. Removing it here unlinks only this gap.";
      row.appendChild(chip);
    }
    var unlink = mkt("button", "link-unlink-btn", "x");
    unlink.title = "Unlink";
    unlink.addEventListener("click", onUnlink);
    row.appendChild(unlink);
    return row;
  }

  // ---- Instance link picker dialog ----
  function openLinkPicker(stateFilter, gap, onSelect) {
    document.getElementById("link-picker")?.remove();
    var overlay = mk("div", "dialog-overlay"); overlay.id = "link-picker";
    var box     = mk("div", "dialog-box");
    box.appendChild(mkt("div", "dialog-title",
      "Link " + (stateFilter === "current" ? "current" : "desired") + " instance"));

    var alreadyLinked = stateFilter === "current"
      ? (gap.relatedCurrentInstanceIds || [])
      : (gap.relatedDesiredInstanceIds  || []);

    var candidates = (session.instances || []).filter(function(i) {
      return i.state === stateFilter && alreadyLinked.indexOf(i.id) < 0;
    });

    if (candidates.length === 0) {
      box.appendChild(mkt("div", "detail-ph-hint",
        "No unlinked " + stateFilter + " instances available. Add technologies in the " +
        (stateFilter === "current" ? "Current" : "Desired") + " State step first."));
    } else {
      var list = mk("div", "link-picker-list");
      candidates.forEach(function(inst) {
        // Phase 18 · Item 9: warn-but-allow when linking would create a
        // double-link to another gap. Picker still proceeds on click.
        var otherGap = findOtherGapLinking(session, inst.id, gap.id);
        if (otherGap) {
          var warn = mk("div", "link-warning-row");
          var otherDesc = otherGap.description ? "'" + otherGap.description + "'" : "another gap";
          warn.textContent = "⚠ " + inst.label + " is already linked to Gap " + otherDesc +
                             ". Linking here too will count toward both initiatives.";
          list.appendChild(warn);
        }
        var item = mk("div", "link-picker-item");
        var dot  = mk("span", "cmd-dot cmd-dot-" + (inst.vendorGroup || "custom"));
        item.appendChild(dot);
        item.appendChild(mkt("span", "cmd-item-name", inst.label));
        item.appendChild(mkt("span", "cmd-item-vendor",
          layerName(inst.layerId) + " / " + envName(inst.environmentId)));
        item.addEventListener("click", function() {
          onSelect(inst.id);
          overlay.remove();
        });
        list.appendChild(item);
      });
      box.appendChild(list);
    }

    var cancelBtn = mkt("button", "btn-secondary", "Cancel");
    cancelBtn.addEventListener("click", function() { overlay.remove(); });
    var foot = mk("div", "form-actions");
    foot.appendChild(cancelBtn);
    box.appendChild(foot);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
  }

  // ---- Add gap dialog ----
  function openAddDialog(opts) {
    opts = opts || {};
    document.getElementById("gap-dialog")?.remove();
    var overlay = mk("div", "dialog-overlay"); overlay.id = "gap-dialog";
    var box     = mk("div", "dialog-box");
    box.appendChild(mkt("div", "dialog-title",
      opts.presetGapType === "ops" ? "Add operational / services gap" : "Add gap / initiative"));

    var form = mk("div", "edit-form");
    var layerMap = {};
    LAYERS.forEach(function(l) { layerMap[l.id] = l.label; });
    var descPlaceholder = opts.presetGapType === "ops"
      ? "e.g. Build DR runbook for tier-1 workloads · Train ops team on PowerProtect · Establish change-management for cloud spend"
      : "One-line description of what needs to change";
    form.appendChild(fg("Description *",      ta("description", "", descPlaceholder)));
    // v2.4.11 · B2 · primary layer label clarified.
    form.appendChild(fg("Primary layer (drives the project bucket) *",
      selEl("layerId", LayerIds, LayerIds[0], layerMap)));
    // v2.4.11 · B2 · "Also affects" multi-chip selector. User picks ANY
    // additional layers the gap touches; setPrimaryLayer keeps the
    // invariant (primary always at index 0) on save. The chip list is
    // serialized into a hidden data-prop so the existing form-collection
    // loop picks it up.
    var alsoGroup = mk("div", "form-group");
    alsoGroup.appendChild(mkt("label", "form-label", "Also affects (optional)"));
    var alsoChipRow = mk("div", "chips-row");
    var alsoSelected = new Set();
    var primarySelect = form.querySelector('[data-prop="layerId"]');
    LAYERS.forEach(function(layer) {
      var chip = mkt("div", "chip-filter", layer.label);
      chip.dataset.layerId = layer.id;
      chip.addEventListener("click", function() {
        if (chip.classList.contains("disabled")) return;
        chip.classList.toggle("active");
        if (chip.classList.contains("active")) alsoSelected.add(layer.id);
        else alsoSelected.delete(layer.id);
      });
      alsoChipRow.appendChild(chip);
    });
    function syncPrimaryDisable() {
      var pid = primarySelect ? primarySelect.value : null;
      [...alsoChipRow.querySelectorAll(".chip-filter")].forEach(function(c) {
        var disabled = c.dataset.layerId === pid;
        c.classList.toggle("disabled", disabled);
        if (disabled) {
          c.classList.remove("active");
          alsoSelected.delete(c.dataset.layerId);
          c.title = "Already the primary layer";
        } else {
          c.title = "Click to add as an affected layer";
        }
      });
    }
    if (primarySelect) {
      primarySelect.addEventListener("change", syncPrimaryDisable);
      syncPrimaryDisable();
    }
    alsoGroup.appendChild(alsoChipRow);
    alsoGroup.appendChild(mkt("div", "field-hint",
      "Only one project bucket per gap (set by Primary layer). Additional layers are listed for filtering + impact analysis."));
    form.appendChild(alsoGroup);
    form.appendChild(fg("Gap type",
      selEl("gapType", ["","enhance","replace","introduce","consolidate","ops"], opts.presetGapType || "")));
    // Manual-gap defaults (T4.13): urgency Medium (no linked current), phase Next, status open.
    form.appendChild(fg("Urgency",            selEl("urgency", ["High","Medium","Low"], "Medium")));
    form.appendChild(fg("Phase",              selEl("phase",   ["now","next","later"],  "next")));
    // v2.1 · mapped Dell solutions removed; derive from linking Dell desired tiles after creation.
    box.appendChild(form);

    var actions = mk("div", "form-actions");
    var cancelBtn = mkt("button", "btn-secondary", "Cancel");
    cancelBtn.addEventListener("click", function() { overlay.remove(); });
    var createBtn = mkt("button", "btn-primary", "Create gap");
    createBtn.addEventListener("click", function() {
      var vals = {};
      form.querySelectorAll("[data-prop]").forEach(function(el) {
        vals[el.getAttribute("data-prop")] = el.value;
      });
      if (!vals.description || !vals.description.trim()) {
        alert("Description is required."); return;
      }
      try {
        // v2.4.11 · B2 · build affectedLayers from the Also-affects chips.
        // Primary is always at index 0; setPrimaryLayer in createGap
        // reasserts that even if we forgot.
        var alsoLayers = Array.from(alsoSelected);
        var newGap = createGap(session, {
          description:    vals.description,
          layerId:        vals.layerId,
          affectedLayers: [vals.layerId].concat(alsoLayers.filter(function(l) { return l !== vals.layerId; })),
          gapType:        vals.gapType || undefined,
          urgency:        vals.urgency || "Medium",
          phase:          vals.phase   || "next",
          status:         "open"
          // reviewed defaults to true for manual creation per createGap.
        });
        saveToLocalStorage();
        selectedGapId = newGap.id;
        overlay.remove();
        renderAll();
      } catch(e) { alert("Validation error: " + e.message); }
    });
    actions.appendChild(cancelBtn); actions.appendChild(createBtn);
    box.appendChild(actions); overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
  }

  renderAll();
}

// ---- Helpers ----
function mk(tag, cls)         { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
function mkt(tag, cls, text)  { var e = mk(tag, cls); e.textContent = text; return e; }
function fg(label, input)     { var g = mk("div","form-group"); g.appendChild(mkt("label","form-label",label)); g.appendChild(input); return g; }
function inputEl(prop, value, ph) {
  var i = mk("input","form-input"); i.setAttribute("data-prop",prop); i.value = value||""; i.placeholder = ph||""; return i;
}
function selEl(prop, options, value, labelMap) {
  var s = mk("select","form-select"); s.setAttribute("data-prop",prop);
  options.forEach(function(o) {
    var opt = document.createElement("option"); opt.value = o;
    opt.textContent = (labelMap && labelMap[o]) ? labelMap[o] : (o || "-- none --");
    if (o === value) opt.selected = true; s.appendChild(opt);
  });
  return s;
}
function ta(prop, value, ph) {
  var t = mk("textarea","form-textarea"); t.setAttribute("data-prop",prop);
  t.value = value||""; t.placeholder = ph||""; t.rows = 3; return t;
}
function urgClass(u) { return u==="High" ? "urg-high" : u==="Low" ? "urg-low" : "urg-med"; }
function showErr(parent, msg) {
  parent.querySelectorAll(".inline-err").forEach(function(e) { e.remove(); });
  parent.appendChild(mkt("div","inline-err",msg));
}
function showPlaceholder(right) {
  right.innerHTML = "";
  var ph = mk("div","detail-placeholder");
  ph.appendChild(mkt("div","detail-ph-icon","[gap]"));
  ph.appendChild(mkt("div","detail-ph-title","Select a gap"));
  ph.appendChild(mkt("div","detail-ph-hint",
    "Click any gap card to edit details and manage linked technologies. Drag cards between columns to reprioritise. Auto-drafted gaps from your Desired State dispositions appear highlighted."));
  right.appendChild(ph);
}
function layerName(id) { var l = (typeof LAYERS !== "undefined") ? LAYERS.find(function(x){return x.id===id;}) : null; return l ? l.label : id; }
function envName(id)   { var e = (typeof ENVIRONMENTS !== "undefined") ? ENVIRONMENTS.find(function(x){return x.id===id;}) : null; return e ? e.label : id; }
function phaseLabel(p) { return p==="now" ? "Now (0-12 months)" : p==="next" ? "Next (12-24 months)" : "Later (>24 months)"; }

// A gap is "auto-drafted" when it came from a Desired-State disposition, i.e.
// it has a linked desired instance. Manual gaps have no desired link at creation.
function isAutoDrafted(gap) {
  return !!(gap && gap.relatedDesiredInstanceIds && gap.relatedDesiredInstanceIds.length > 0);
}

function readOnlyField(text, titleText) {
  var el = document.createElement("div");
  el.className = "form-readonly";
  el.textContent = text;
  if (titleText) el.setAttribute("title", titleText);
  return el;
}

function gapOriginCriticalityHint(gap, session) {
  var ids = (gap && gap.relatedCurrentInstanceIds) || [];
  if (!ids.length || !session) return "No linked current instance , defaults to Medium for introduce gaps.";
  var first = (session.instances || []).find(function(i) { return i.id === ids[0]; });
  if (!first) return "";
  return "Source: '" + first.label + "' (criticality " + (first.criticality || "not set") + ").";
}
