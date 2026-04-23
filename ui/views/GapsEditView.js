// ui/views/GapsEditView.js -- fully wired gaps & initiatives board

import { LAYERS, ENVIRONMENTS, BUSINESS_DRIVERS } from "../../core/config.js";
import { LayerIds, EnvironmentIds } from "../../core/models.js";
import { createGap, updateGap, deleteGap, setGapDriverId, approveGap,
         linkCurrentInstance, linkDesiredInstance,
         unlinkCurrentInstance, unlinkDesiredInstance } from "../../interactions/gapsCommands.js";
import { syncDesiredFromGap, confirmPhaseOnLink } from "../../interactions/desiredStateSync.js";
import { suggestDriverId, effectiveDriverId, driverLabel as driverLabelFor,
         effectiveDellSolutions } from "../../services/programsService.js";
import { saveToLocalStorage } from "../../state/sessionStore.js";
import { helpButton } from "./HelpModal.js";

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

  // ---- Header ----
  var header = mk("div", "card");
  var titleRow = mk("div", "card-title-row");
  titleRow.appendChild(mkt("div", "card-title", "Gaps & Initiatives"));
  titleRow.appendChild(helpButton("gaps"));
  header.appendChild(titleRow);
  header.appendChild(mkt("div", "card-hint",
    "Each gap bridges current to desired state. Auto-drafted gaps appear when you set a disposition in Desired State. Drag cards between phases to re-prioritise."));

  // Auto-gap notice
  var autoGaps = getAutoGaps();
  if (autoGaps.length > 0) {
    var notice = mk("div", "auto-gap-notice");
    notice.innerHTML = "<strong>" + autoGaps.length + " auto-drafted gap" + (autoGaps.length > 1 ? "s" : "") +
      "</strong> from Desired State dispositions -- review them in the board below.";
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
    var opt = document.createElement("option"); opt.value = env.id; opt.textContent = env.label;
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

  var addBtn = mkt("button", "btn-primary", "+ Add gap");
  addBtn.style.marginLeft = "auto";
  addBtn.addEventListener("click", function() { openAddDialog(); });
  filterRow.appendChild(addBtn);
  header.appendChild(filterRow);
  left.appendChild(header);

  var board = mk("div", "kanban");
  left.appendChild(board);

  showPlaceholder(right);

  // ---- Helpers ----
  function getAutoGaps() {
    return (session.gaps || []).filter(function(g) {
      return g.relatedDesiredInstanceIds && g.relatedDesiredInstanceIds.length > 0
          && g.status === "open" && !g.notes;
    });
  }

  function filteredGaps() {
    var layerIds = Array.from(activeLayerIds);
    var envId    = activeEnvId;
    return (session.gaps || []).filter(function(g) {
      var layers = (g.affectedLayers && g.affectedLayers.length) ? g.affectedLayers : [g.layerId];
      var envs   = g.affectedEnvironments || [];
      var lOk = !layerIds.length || layers.some(function(l) { return layerIds.indexOf(l) >= 0; });
      var eOk = envId === "all" || envs.length === 0 || envs.indexOf(envId) >= 0;
      var nrOk = !showNeedsReviewOnly || g.reviewed === false;
      return lOk && eOk && nrOk;
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
    // Criticality accent — derived from gap.urgency (T4.4).
    if (gap.urgency) cls += " crit-" + gap.urgency.toLowerCase();
    var card = mk("div", cls);
    card.draggable = true;

    // v2.1 · pulsing review dot for unreviewed auto-drafts.
    if (needsReview) {
      var dot = mk("span", "gap-review-dot");
      dot.title = "Auto-drafted — review and approve in the detail panel.";
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
    urgBadge.title = "Urgency is derived from the linked current instance's criticality — not editable. " + srcLabel;
    badgesEl.appendChild(urgBadge);
    var shape = mk("span", "crit-shape-" + (gap.urgency || "medium").toLowerCase());
    shape.title = urgBadge.title;
    badgesEl.appendChild(shape);

    // Strategic-driver chip (effective — explicit override OR auto-suggest).
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

    // ---- Edit form ----
    var form = mk("div", "edit-form");
    var layerMap = {};
    LAYERS.forEach(function(l) { layerMap[l.id] = l.label; });

    form.appendChild(fg("Description",
      ta("description", gap.description || "", "One-line description of the gap or initiative")));
    form.appendChild(fg("Primary layer",
      selEl("layerId", LayerIds, gap.layerId, layerMap)));
    // Gap type: read-only display for auto-drafted gaps (T4.3);
    // editable ONLY when it's manual + hasn't been set yet (T4.14).
    if (isAutoDrafted(gap)) {
      form.appendChild(fg("Gap type", readOnlyField(gap.gapType || "—",
        "Gap type is derived from the source disposition. Change disposition in Desired State to change gap type.")));
    } else {
      form.appendChild(fg("Gap type",
        selEl("gapType", ["","rationalize","enhance","replace","introduce","consolidate","ops"], gap.gapType || "")));
    }
    // Urgency: always read-only (strict-derived per SPEC §2.3 / T4.1 / T3.16).
    form.appendChild(fg("Urgency", readOnlyField(gap.urgency || "—",
      "Urgency is derived from the linked current instance's criticality. " +
      "If you think urgency should be different, update criticality in Current State.")));
    form.appendChild(fg("Phase",
      selEl("phase", ["now","next","later"], gap.phase)));
    form.appendChild(fg("Status",
      selEl("status", ["open","in_progress","closed","deferred"], gap.status || "open")));

    // Program (driver) dropdown — session drivers + Unassigned. Auto-suggested
    // if no explicit driverId is set.
    var programOpts = [""].concat((session.customer.drivers || []).map(function(d) { return d.id; }));
    var programLabels = { "": "Unassigned" };
    (session.customer.drivers || []).forEach(function(d) {
      var meta = BUSINESS_DRIVERS.find(function(bd) { return bd.id === d.id; });
      programLabels[d.id] = (meta ? meta.label : d.id) + (gap.driverId === d.id ? "" : "");
    });
    var currentDriverVal = gap.driverId || "";
    var progSel = selEl("driverId", programOpts, currentDriverVal, programLabels);
    var autoHit = gap.driverId ? null : suggestDriverId(gap, session);
    if (autoHit && programLabels[autoHit]) {
      // Visually mark the auto-suggested option with a star + "(suggested)" so the
      // presales can spot it at a glance in the dropdown list.
      [...progSel.options].forEach(function(opt) {
        if (opt.value === autoHit) opt.textContent = "★ " + programLabels[autoHit] + " (suggested)";
      });
    }
    progSel.setAttribute("title",
      "Which strategic driver does this gap serve? Auto-suggested from gap type + layer + environment. Pick explicitly to override.");
    form.appendChild(fg("Strategic driver", progSel));

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
      lbl.appendChild(document.createTextNode(" " + env.label));
      envCheckRow.appendChild(lbl);
    });
    envGroup.appendChild(envCheckRow);
    form.appendChild(envGroup);

    // v2.1 · mappedDellSolutions input removed. Dell solutions derive render-time from
    // linked desired tiles tagged `vendorGroup: "dell"`. Here we surface the derived list
    // as a read-only field so the presales sees the result of their link choices.
    var solutions = effectiveDellSolutions(gap, session);
    var solutionsText = solutions.length === 0
      ? "None yet — link Dell-tagged desired tiles below to populate."
      : solutions.join(", ");
    form.appendChild(fg("Dell solutions (derived)",
      readOnlyField(solutionsText,
        "Derived from linked desired tiles with vendor = Dell. Manage the links below to change this list.")));
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

    var saveBtn = mkt("button", "btn-primary", "Save changes");
    saveBtn.addEventListener("click", function() {
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
      // Urgency is strict-derived; never comes from a form control. Keep existing value.
      patch.urgency = gap.urgency || "Medium";
      patch.phase   = patch.phase   || "now";
      patch.status  = patch.status  || "open";
      // Lock gapType for auto-drafted gaps (T4.3 / T4.14 — derived from disposition).
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
        saveBtn.textContent = "Saved";
        setTimeout(function() { saveBtn.textContent = "Save changes"; renderAll(); }, 800);
      } catch(e) { showErr(panel, e.message); }
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
        var check = confirmPhaseOnLink(session, gap.id, instId);
        if (check.status === "conflict") {
          var msg = "Linking '" + check.desiredLabel + "' will reassign its Phase from " +
                    check.currentPriority + " to " + check.targetPriority + ".\n\nProceed?";
          if (!window.confirm(msg)) return;
        }
        try {
          linkDesiredInstance(session, gap.id, instId);
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
    var row = mk("div", "link-row");
    var dot = mk("span", "cmd-dot cmd-dot-" + (inst.vendorGroup || "custom"));
    row.appendChild(dot);
    row.appendChild(mkt("span", "link-row-label", inst.label));
    row.appendChild(mkt("span", "link-row-sub",
      layerName(inst.layerId) + " / " + envName(inst.environmentId)));
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
  function openAddDialog() {
    document.getElementById("gap-dialog")?.remove();
    var overlay = mk("div", "dialog-overlay"); overlay.id = "gap-dialog";
    var box     = mk("div", "dialog-box");
    box.appendChild(mkt("div", "dialog-title", "Add gap / initiative"));

    var form = mk("div", "edit-form");
    var layerMap = {};
    LAYERS.forEach(function(l) { layerMap[l.id] = l.label; });
    form.appendChild(fg("Description *",      ta("description", "", "One-line description of what needs to change")));
    form.appendChild(fg("Primary layer *",    selEl("layerId", LayerIds, LayerIds[0], layerMap)));
    form.appendChild(fg("Gap type",           selEl("gapType", ["","rationalize","enhance","replace","introduce","consolidate","ops"], "")));
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
        var newGap = createGap(session, {
          description: vals.description,
          layerId:     vals.layerId,
          gapType:     vals.gapType || undefined,
          urgency:     vals.urgency || "Medium",
          phase:       vals.phase   || "next",
          status:      "open"
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
  if (!ids.length || !session) return "No linked current instance — defaults to Medium for introduce gaps.";
  var first = (session.instances || []).find(function(i) { return i.id === ids[0]; });
  if (!first) return "";
  return "Source: '" + first.label + "' (criticality " + (first.criticality || "not set") + ").";
}
