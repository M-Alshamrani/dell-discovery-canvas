// ui/views/MatrixView.js -- current / desired state matrix (fixed disposition workflow)

import { LAYERS, ENVIRONMENTS, CATALOG } from "../../core/config.js";
import { addInstance, updateInstance, deleteInstance,
         mapAsset, unmapAsset, proposeCriticalityUpgrades } from "../../interactions/matrixCommands.js";
import { createGap } from "../../interactions/gapsCommands.js";
import { saveToLocalStorage } from "../../state/sessionStore.js";
import {
  DISPOSITION_ACTIONS, ACTION_TO_GAP_TYPE,
  getDesiredCounterpart, getCurrentSource, buildGapFromDisposition,
  syncGapFromDesired, syncGapsFromCurrentCriticality
} from "../../interactions/desiredStateSync.js";
import { helpButton } from "./HelpModal.js";

export function renderMatrixView(left, right, session, opts) {
  var stateFilter    = (opts && opts.stateFilter) || "current";
  var selectedInstId = null;

  // Demo banner
  if (session.isDemo) renderDemoBanner(left);

  // Header
  var header = mk("div", "card");
  var titleRow = mk("div", "card-title-row");
  var titleEl = mk("div", "card-title");
  titleEl.textContent = (stateFilter === "current" ? "Current State" : "Desired State") + " -- Architecture Matrix";
  titleRow.appendChild(titleEl);
  titleRow.appendChild(helpButton(stateFilter === "current" ? "current" : "desired"));
  header.appendChild(titleRow);
  var hintEl = mk("div", "card-hint");
  hintEl.textContent = stateFilter === "current"
    ? "Map technologies the customer has today. Click any tile to set criticality and notes. Use Add to browse the catalog."
    : "Set a disposition for each current technology (grey dashed tiles). Add net-new desired technologies using the Add button.";
  header.appendChild(hintEl);

  // Unreviewed banner (desired state only)
  if (stateFilter === "desired") {
    var unreviewedEl = mk("div", "");
    unreviewedEl.id = "unreviewed-banner-wrap";
    left.appendChild(header);
    left.appendChild(unreviewedEl);
    updateUnreviewedBanner(unreviewedEl, session);
  } else {
    left.appendChild(header);
  }

  // Grid
  var wrap = mk("div", "matrix-scroll-wrap");
  var grid = mk("div", "matrix-grid");
  grid.style.gridTemplateColumns = "160px repeat(" + ENVIRONMENTS.length + ", 1fr)";

  // Header row
  grid.appendChild(mk("div", "matrix-corner"));
  ENVIRONMENTS.forEach(function(env) {
    var h = mk("div", "matrix-env-head");
    h.textContent = env.label;
    grid.appendChild(h);
  });

  // Layer rows
  LAYERS.forEach(function(layer) {
    var ll = mk("div", "matrix-layer-label");
    ll.textContent = layer.label;
    grid.appendChild(ll);
    ENVIRONMENTS.forEach(function(env) {
      var cell = mk("div", "matrix-cell");
      cell.setAttribute("data-matrix-cell", "");
      cell.setAttribute("data-layer-id", layer.id);
      cell.setAttribute("data-env-id",   env.id);
      renderCell(cell, layer.id, env.id);
      grid.appendChild(cell);
    });
  });

  wrap.appendChild(grid);
  left.appendChild(wrap);
  showHint(right);

  // ---- Cell renderer ----
  function renderCell(cell, layerId, envId) {
    cell.innerHTML = "";

    // In desired view: show current items not yet reviewed as ghost tiles
    if (stateFilter === "desired") {
      var currentInCell = (session.instances || []).filter(function(i) {
        return i.state === "current" && i.layerId === layerId && i.environmentId === envId;
      });
      currentInCell.forEach(function(curInst) {
        var hasCounterpart = (session.instances || []).some(function(d) {
          return d.state === "desired" && d.originId === curInst.id;
        });
        if (!hasCounterpart) {
          cell.appendChild(buildGhostTile(curInst));
        }
      });
    }

    // Actual desired/current instances in this cell
    var instances = (session.instances || []).filter(function(i) {
      return i.state === stateFilter && i.layerId === layerId && i.environmentId === envId;
    });
    instances.forEach(function(inst) {
      cell.appendChild(buildTile(inst));
    });

    // Add button
    var addBtn = mk("button", "add-tile-btn");
    addBtn.setAttribute("data-add-instance", "");
    addBtn.setAttribute("data-layer-id", layerId);
    addBtn.setAttribute("data-env-id",   envId);
    addBtn.textContent = "+ Add";
    addBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      openCommandPalette(layerId, envId);
    });
    cell.appendChild(addBtn);
  }

  function refreshCell(layerId, envId) {
    var cell = grid.querySelector("[data-layer-id='" + layerId + "'][data-env-id='" + envId + "']");
    if (cell) renderCell(cell, layerId, envId);
    if (stateFilter === "desired") {
      var wrap2 = document.getElementById("unreviewed-banner-wrap");
      if (wrap2) updateUnreviewedBanner(wrap2, session);
    }
  }

  // ---- Ghost tile (unreviewed current item in desired view) ----
  function buildGhostTile(curInst) {
    var critLevel = curInst.criticality ? curInst.criticality.toLowerCase() : null;
    var cls = "instance-tile vg-" + (curInst.vendorGroup || "custom") + " ghost-tile mirror-tile";
    if (critLevel) cls += " crit-" + critLevel;

    var tile = mk("div", cls);
    tile.title = "Click to set what happens to this in the desired state";
    var lbl = mk("span", "tile-label"); lbl.textContent = curInst.label; tile.appendChild(lbl);
    var badge = mk("span", "disposition-badge badge-unreviewed"); badge.textContent = "? Review"; tile.appendChild(badge);
    if (critLevel) {
      var shape = mk("span", "crit-shape-" + critLevel);
      shape.title = "Criticality carried from current: " + curInst.criticality;
      tile.appendChild(shape);
    }
    tile.addEventListener("click", function() { showDispositionPanel(right, curInst, null); });
    return tile;
  }

  // ---- Regular tile ----
  function buildTile(inst) {
    var vg  = inst.vendorGroup || "custom";

    // Severity accent — current tiles use own criticality;
    // desired tiles with an originId inherit from the source current instance (carry-through).
    // Net-new desired tiles (introduce, no originId) get no criticality class (T2.14).
    var critLevel   = null;
    var critSourceLbl = null;
    if (stateFilter === "current" && inst.criticality) {
      critLevel = inst.criticality.toLowerCase();
      critSourceLbl = inst.criticality;
    } else if (stateFilter === "desired" && inst.originId) {
      var origin = (session.instances || []).find(function(i) { return i.id === inst.originId; });
      if (origin && origin.criticality) {
        critLevel = origin.criticality.toLowerCase();
        critSourceLbl = origin.criticality + " — carried from '" + origin.label + "'";
      }
    }

    var cls = "instance-tile vg-" + vg + (inst.id === selectedInstId ? " selected" : "");
    if (critLevel) cls += " crit-" + critLevel;

    var tile = mk("div", cls);
    tile.setAttribute("data-instance-id", inst.id);

    var lbl = mk("span", "tile-label"); lbl.textContent = inst.label; tile.appendChild(lbl);

    // Disposition badge (desired with originId)
    if (stateFilter === "desired" && inst.disposition) {
      var da = DISPOSITION_ACTIONS.find(function(a) { return a.id === inst.disposition; });
      var badge = mk("span", "disposition-badge badge-" + inst.disposition);
      badge.textContent = da ? da.label : inst.disposition;
      tile.appendChild(badge);
    }
    // Priority badge
    if (stateFilter === "desired" && inst.priority && !inst.disposition) {
      var pb = mk("span", "priority-badge priority-" + inst.priority.toLowerCase());
      pb.textContent = inst.priority; tile.appendChild(pb);
    }
    // Severity shape (dual-channel accessibility; SPEC §4.2).
    if (critLevel) {
      var shape = mk("span", "crit-shape-" + critLevel);
      shape.title = "Criticality: " + critSourceLbl;
      tile.appendChild(shape);
    }

    var del = mk("button", "tile-del"); del.textContent = "x"; del.title = "Remove";
    del.addEventListener("click", function(e) {
      e.stopPropagation();
      if (!confirm("Remove " + inst.label + "?")) return;
      deleteInstance(session, inst.id);
      saveToLocalStorage();
      if (selectedInstId === inst.id) { selectedInstId = null; showHint(right); }
      refreshCell(inst.layerId, inst.environmentId);
    });
    tile.appendChild(del);

    tile.addEventListener("click", function() {
      selectedInstId = inst.id;
      grid.querySelectorAll(".instance-tile").forEach(function(t) {
        t.classList.toggle("selected", t.getAttribute("data-instance-id") === inst.id);
      });
      if (stateFilter === "desired" && inst.originId && !inst.disposition) {
        // Has an origin but no disposition yet -- show disposition panel
        var srcInst = getCurrentSource(session, inst);
        if (srcInst) { showDispositionPanel(right, srcInst, inst.disposition); return; }
      }
      showDetailPanel(right, inst);
    });
    return tile;
  }

  // ---- Disposition picker panel ----
  function showDispositionPanel(right, curInst, preselected) {
    right.innerHTML = "";
    var panel = mk("div", "detail-panel");

    var titleEl = mk("div", "detail-title"); titleEl.textContent = "What happens to this?"; panel.appendChild(titleEl);
    var subEl   = mk("div", "detail-sub");   subEl.textContent   = curInst.label;            panel.appendChild(subEl);
    var vb      = mk("span", "vg-badge vg-" + (curInst.vendorGroup || "custom"));
    vb.textContent = curInst.vendorGroup === "dell" ? "Dell" : curInst.vendorGroup === "nonDell" ? "Non-Dell" : "Custom";
    panel.appendChild(vb);

    panel.appendChild(mkSep("Choose a disposition"));

    // Big action buttons
    var grid2 = mk("div", "disposition-grid");
    DISPOSITION_ACTIONS.forEach(function(action) {
      var btn = mk("div", "disposition-btn" + (preselected === action.id ? " disposition-btn-selected" : ""));
      var nameSpan = mk("strong"); nameSpan.textContent = action.label;
      var hintSpan = mk("span");   hintSpan.textContent = action.hint;
      btn.appendChild(nameSpan); btn.appendChild(hintSpan);
      btn.addEventListener("click", function() {
        applyDisposition(curInst, action.id);
      });
      grid2.appendChild(btn);
    });
    panel.appendChild(grid2);

    // Notes for this review
    var notesGroup = mk("div", "form-group");
    notesGroup.style.marginTop = "12px";
    var notesLabel = mk("label", "form-label"); notesLabel.textContent = "Notes (optional)";
    var notesInput = mk("textarea", "form-textarea");
    notesInput.id = "disposition-notes"; notesInput.rows = 2;
    notesInput.placeholder = "Add context about why this disposition was chosen...";
    notesGroup.appendChild(notesLabel); notesGroup.appendChild(notesInput);
    panel.appendChild(notesGroup);

    right.appendChild(panel);
  }

  // ---- Apply disposition (fixed: update vs create) ----
  function applyDisposition(curInst, actionId) {
    var notes = (document.getElementById("disposition-notes") || {}).value || "";

    // Find existing desired counterpart (may have been created before)
    var existing = getDesiredCounterpart(session, curInst.id);

    var desiredInst;
    if (existing) {
      // Update the existing desired instance instead of creating a new one
      desiredInst = updateInstance(session, existing.id, {
        disposition: actionId,
        notes:       notes || existing.notes || ""
      });
    } else {
      // First time -- create the desired counterpart
      var newLabel = actionId === "retire"
        ? curInst.label + " [RETIRE]"
        : curInst.label;

      desiredInst = addInstance(session, {
        state:         "desired",
        layerId:       curInst.layerId,
        environmentId: curInst.environmentId,
        label:         newLabel,
        vendor:        curInst.vendor,
        vendorGroup:   curInst.vendorGroup,
        disposition:   actionId,
        originId:      curInst.id,
        notes:         notes,
        priority:      "Now"
      });
    }

    // Auto-create gap draft if applicable (only if no existing gap already links these)
    if (ACTION_TO_GAP_TYPE[actionId]) {
      var alreadyLinked = (session.gaps || []).some(function(g) {
        return (g.relatedCurrentInstanceIds || []).indexOf(curInst.id) >= 0
            || (g.relatedDesiredInstanceIds  || []).indexOf(desiredInst.id) >= 0;
      });
      if (!alreadyLinked) {
        var gapProps = buildGapFromDisposition(session, desiredInst);
        if (gapProps) {
          try { createGap(session, gapProps); } catch(e) { /* soft fail */ }
        }
      }
    }

    // Sync: if disposition changed to "keep", drop any existing linked gaps (SPEC §7.3 / T3.5).
    // Also handles gapType re-derive when disposition changed between non-keep values.
    syncGapFromDesired(session, desiredInst.id);

    saveToLocalStorage();
    refreshCell(curInst.layerId, curInst.environmentId);
    // Show the detail panel with the selected disposition pre-populated
    showDetailPanel(right, desiredInst);

    // Show success notification
    showToast("Disposition set: " + actionId + (ACTION_TO_GAP_TYPE[actionId] ? " -- gap drafted automatically" : ""), "ok");
  }

  // ---- Command palette ----
  function openCommandPalette(layerId, envId) {
    document.getElementById("cmd-palette")?.remove();
    var overlay = mk("div", "cmd-overlay"); overlay.id = "cmd-palette";
    var box     = mk("div", "cmd-box");

    var layerObj = LAYERS.find(function(l) { return l.id === layerId; });
    var envObj   = ENVIRONMENTS.find(function(e) { return e.id === envId; });
    var ctx = mk("div", "cmd-context");
    ctx.textContent = (layerObj ? layerObj.label : layerId) + " -- " + (envObj ? envObj.label : envId);
    box.appendChild(ctx);

    var srch = document.createElement("input");
    srch.className = "cmd-search";
    srch.placeholder = "Search catalog or type a custom name...";
    srch.setAttribute("autocomplete", "off");
    box.appendChild(srch);

    var results = mk("div", "cmd-results");
    box.appendChild(results);
    box.appendChild(mkt("div", "cmd-hint", "Arrows navigate, Enter selects, Esc closes"));

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    srch.focus();

    // Environment-appropriate catalog: entries without an `environments`
    // whitelist are valid everywhere; entries with one must include the
    // current cell's envId (SPEC §3.4, T2.2 / T2.5).
    var catalog = (CATALOG[layerId] || []).filter(function(t) {
      return !t.environments || t.environments.indexOf(envId) >= 0;
    });
    var activeIdx = -1;

    function render(q) {
      results.innerHTML = ""; activeIdx = -1;
      var filtered = q
        ? catalog.filter(function(t) { return t.label.toLowerCase().indexOf(q.toLowerCase()) >= 0; })
        : catalog;

      var groups = { dell:[], nonDell:[], custom:[] };
      filtered.forEach(function(t) { (groups[t.vendorGroup] = groups[t.vendorGroup] || []).push(t); });

      [["dell","Dell"],["nonDell","Non-Dell"],["custom","Other / Custom"]].forEach(function(g) {
        if (!groups[g[0]] || !groups[g[0]].length) return;
        results.appendChild(mkt("div", "cmd-group-sep", g[1]));
        groups[g[0]].forEach(function(tile) {
          results.appendChild(buildItem(tile.label, tile.vendor, tile.vendorGroup, function() {
            addToCell(tile.label, tile.vendor, tile.vendorGroup);
          }));
        });
      });

      // v2.1 · Three-path add for names not in the catalog (SPEC §7.2).
      if (q && !filtered.find(function(t) { return t.label.toLowerCase() === q.toLowerCase(); })) {
        results.appendChild(mkt("div", "cmd-group-sep", "Add new"));
        // 1) Dell SKU
        results.appendChild(buildItem("+ Add \"" + q + "\" — Dell SKU", "Dell", "dell", function() {
          addToCell(q, "Dell", "dell");
        }));
        // 2) 3rd-party vendor — opens inline chooser
        var thirdParty = mk("div", "cmd-item cmd-item-3p");
        thirdParty.appendChild(mk("span", "cmd-dot cmd-dot-nonDell"));
        thirdParty.appendChild(mkt("span", "cmd-item-name", "+ Add \"" + q + "\" — 3rd-party vendor..."));
        thirdParty.appendChild(mkt("span", "cmd-item-vendor", "Non-Dell"));
        thirdParty.addEventListener("click", function() { openVendorChooser(q); });
        thirdParty.addEventListener("mouseenter", function() {
          var items = getItems();
          items.forEach(function(el, i) { el.classList.toggle("active", el === thirdParty); if (el === thirdParty) activeIdx = i; });
        });
        results.appendChild(thirdParty);
        // 3) Custom / internal
        results.appendChild(buildItem("+ Add \"" + q + "\" — Custom / internal", "Custom", "custom", function() {
          addToCell(q, "Custom", "custom");
        }));
      }
    }

    // v2.1 · 3rd-party vendor quick-picker. Known list first, "Other (type)" fallback.
    var COMMON_VENDORS = ["HPE","Cisco","NetApp","Pure","IBM","Microsoft","VMware","Nutanix","Red Hat","AWS","Azure","Google"];
    function openVendorChooser(name) {
      results.innerHTML = "";
      results.appendChild(mkt("div", "cmd-group-sep", "Pick vendor for \"" + name + "\""));
      COMMON_VENDORS.forEach(function(v) {
        results.appendChild(buildItem(v, v, "nonDell", function() {
          addToCell(name, v, "nonDell");
        }));
      });
      // Other → reveals a text input
      var otherRow = mk("div", "cmd-item");
      otherRow.appendChild(mk("span", "cmd-dot cmd-dot-nonDell"));
      otherRow.appendChild(mkt("span", "cmd-item-name", "Other (type vendor name)"));
      otherRow.appendChild(mkt("span", "cmd-item-vendor", "custom"));
      otherRow.addEventListener("click", function() {
        results.innerHTML = "";
        results.appendChild(mkt("div", "cmd-group-sep", "Type vendor name for \"" + name + "\""));
        var input = document.createElement("input");
        input.className = "cmd-search";
        input.placeholder = "e.g. Veritas, Hitachi...";
        input.style.margin = "8px 12px";
        results.appendChild(input);
        setTimeout(function() { input.focus(); }, 0);
        input.addEventListener("keydown", function(e) {
          if (e.key === "Enter" && input.value.trim()) {
            addToCell(name, input.value.trim(), "nonDell");
            close();
          }
          if (e.key === "Escape") { render(srch.value.trim()); }
        });
      });
      results.appendChild(otherRow);
    }

    function buildItem(label, vendor, vg, onClick) {
      var item = mk("div", "cmd-item");
      var dot  = mk("span", "cmd-dot cmd-dot-" + vg);
      item.appendChild(dot);
      item.appendChild(mkt("span", "cmd-item-name", label));
      item.appendChild(mkt("span", "cmd-item-vendor", vendor));
      item.addEventListener("click", function() { onClick(); close(); });
      item.addEventListener("mouseenter", function() {
        var items = getItems();
        items.forEach(function(el, i) { el.classList.toggle("active", el === item); if (el === item) activeIdx = i; });
      });
      return item;
    }

    function getItems() { return Array.from(results.querySelectorAll(".cmd-item")); }

    function addToCell(label, vendor, vg) {
      addInstance(session, { state:stateFilter, layerId:layerId, environmentId:envId, label:label, vendor:vendor, vendorGroup:vg });
      saveToLocalStorage();
      refreshCell(layerId, envId);
    }

    function close() { overlay.remove(); }

    srch.addEventListener("input", function() { render(srch.value.trim()); });
    srch.addEventListener("keydown", function(e) {
      var items = getItems();
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowDown") { activeIdx = Math.min(activeIdx + 1, items.length - 1); highlight(items); e.preventDefault(); }
      if (e.key === "ArrowUp")   { activeIdx = Math.max(activeIdx - 1, 0);                highlight(items); e.preventDefault(); }
      if (e.key === "Enter" && activeIdx >= 0 && items[activeIdx]) items[activeIdx].click();
    });
    function highlight(items) {
      items.forEach(function(el, i) { el.classList.toggle("active", i === activeIdx); });
      if (items[activeIdx]) items[activeIdx].scrollIntoView({ block:"nearest" });
    }

    overlay.addEventListener("click", function(e) { if (e.target === overlay) close(); });
    render("");
  }

  // ---- Detail panel ----
  function showDetailPanel(right, inst) {
    selectedInstId = inst.id;
    right.innerHTML = "";
    var panel = mk("div", "detail-panel");

    var titleEl = mk("div", "detail-title"); titleEl.textContent = inst.label; panel.appendChild(titleEl);
    var subEl   = mk("div", "detail-sub");   subEl.textContent   = inst.vendor || inst.vendorGroup; panel.appendChild(subEl);
    var vb = mk("span", "vg-badge vg-" + (inst.vendorGroup || "custom"));
    vb.textContent = inst.vendorGroup === "dell" ? "Dell" : inst.vendorGroup === "nonDell" ? "Non-Dell" : "Custom";
    panel.appendChild(vb);

    // Show origin link info
    if (inst.originId) {
      var src = getCurrentSource(session, inst);
      if (src) {
        var originNote = mk("div", "detail-origin");
        originNote.textContent = "Mirrors current: " + src.label;
        panel.appendChild(originNote);
      }
    }

    var form = mk("div", "edit-form");

    if (stateFilter === "current") {
      form.appendChild(fg("Criticality", selEl("criticality", ["","Low","Medium","High"], inst.criticality || "")));
    } else {
      // Disposition
      var dispOpts = [""].concat(DISPOSITION_ACTIONS.map(function(a) { return a.id; }));
      var dispLabels = {};
      DISPOSITION_ACTIONS.forEach(function(a) { dispLabels[a.id] = a.label; });
      form.appendChild(fg("Action", selEl("disposition", dispOpts, inst.disposition || "", dispLabels)));

      // Phase — hidden entirely when disposition is "keep" (no change = no schedule).
      // Label uses compound "Now (0-12 months)" etc. per SPEC §7.3; the JSON key stays `priority`.
      if (inst.disposition !== "keep") {
        // Default "Next" for net-new introduce items (no originId, no priority yet).
        var currentPhase = inst.priority || (!inst.originId ? "Next" : "");
        var phaseLabels = {
          "":      "-- choose --",
          "Now":   "Now (0-12 months)",
          "Next":  "Next (12-24 months)",
          "Later": "Later (> 24 months)"
        };
        var phaseSel = selEl("priority", ["","Now","Next","Later"], currentPhase, phaseLabels);
        phaseSel.setAttribute("title",
          "Phase drives the roadmap column and the linked gap's phase. Defaults to 'Next' for net-new items. Change it to reschedule the related project.");
        form.appendChild(fg("Phase", phaseSel));
      }
      // Timeline dropped per SPEC §7.3 — collapsed into the compound Phase label.
    }

    var notesHint = stateFilter === "current"
      ? "Pain, version, end-of-life, technical debt..."
      : "Outcome, requirements, constraints...";
    form.appendChild(fg("Notes", taEl("notes", inst.notes || "", notesHint)));
    panel.appendChild(form);

    var saveBtn = mk("button", "btn-primary"); saveBtn.textContent = "Save changes";
    saveBtn.addEventListener("click", function() {
      var patch = {};
      form.querySelectorAll("[data-prop]").forEach(function(el) {
        patch[el.getAttribute("data-prop")] = el.value || undefined;
      });
      try {
        updateInstance(session, inst.id, patch);
        // Post-save sync: keep linked gaps in line with upstream changes (SPEC §6.3).
        if (stateFilter === "desired") {
          syncGapFromDesired(session, inst.id);
        } else if (stateFilter === "current") {
          syncGapsFromCurrentCriticality(session, inst.id);
        }
        saveToLocalStorage();
        saveBtn.textContent = "Saved";
        setTimeout(function() { saveBtn.textContent = "Save changes"; refreshCell(inst.layerId, inst.environmentId); }, 800);
      } catch(e) {
        showToast(e.message, "err");
      }
    });

    var actions = mk("div", "form-actions");
    actions.appendChild(saveBtn);
    var delBtn = mk("button", "btn-danger"); delBtn.textContent = "Remove";
    delBtn.addEventListener("click", function() {
      if (!confirm("Remove " + inst.label + "?")) return;
      deleteInstance(session, inst.id);
      saveToLocalStorage();
      selectedInstId = null;
      refreshCell(inst.layerId, inst.environmentId);
      showHint(right);
    });
    actions.appendChild(delBtn);
    panel.appendChild(actions);

    // Phase 16 — Mapped infrastructure section, only on workload tiles.
    if (inst.layerId === "workload") {
      panel.appendChild(buildMappedAssetsSection(right, inst));
    }

    right.appendChild(panel);
  }

  // Phase 16 helper: render the "Mapped infrastructure" section beneath
  // the standard tile detail when the instance is a workload. Shows the
  // currently mapped asset rows, a `+ Map asset` picker button, and an
  // `↑ Propagate criticality` button gated on having both a workload
  // criticality and at least one mapped asset.
  function buildMappedAssetsSection(right, workload) {
    var section = mk("div", "mapped-assets-section");
    section.appendChild(mkt("div", "mapped-assets-title", "Mapped infrastructure"));

    var mapped = (workload.mappedAssetIds || [])
      .map(function(id) { return (session.instances || []).find(function(i) { return i.id === id; }); })
      .filter(Boolean);

    var list = mk("div", "mapped-asset-list");
    if (mapped.length === 0) {
      list.appendChild(mkt("div", "mapped-asset-empty", "No assets mapped yet. Map the infrastructure this workload runs on so its criticality can propagate down."));
    } else {
      mapped.forEach(function(asset) {
        var row = mk("div", "mapped-asset-row");
        var dot = mk("span", "cmd-dot cmd-dot-" + (asset.vendorGroup || "custom"));
        row.appendChild(dot);
        row.appendChild(mkt("span", "mapped-asset-label", asset.label));
        var layerObj = LAYERS.find(function(l) { return l.id === asset.layerId; });
        var envObj   = ENVIRONMENTS.find(function(e) { return e.id === asset.environmentId; });
        row.appendChild(mkt("span", "mapped-asset-sub",
          (layerObj ? layerObj.label : asset.layerId) + " / " + (envObj ? envObj.label : asset.environmentId)));
        if (asset.criticality) {
          row.appendChild(mkt("span", "mapped-asset-crit crit-" + asset.criticality.toLowerCase(), asset.criticality));
        }
        var unmap = mkt("button", "link-unlink-btn", "x");
        unmap.title = "Unmap this asset";
        unmap.addEventListener("click", function() {
          try { unmapAsset(session, workload.id, asset.id); saveToLocalStorage(); showDetailPanel(right, workload); }
          catch(e) { alert(e.message); }
        });
        row.appendChild(unmap);
        list.appendChild(row);
      });
    }
    section.appendChild(list);

    var btnRow = mk("div", "mapped-asset-actions");
    var addBtn = mkt("button", "btn-ghost-sm", "+ Map asset");
    addBtn.addEventListener("click", function() { openAssetPicker(workload, right); });
    btnRow.appendChild(addBtn);

    if (workload.criticality && mapped.length > 0) {
      var propBtn = mkt("button", "btn-ghost-sm propagate-btn", "↑ Propagate criticality");
      propBtn.title = "Upgrade any mapped asset whose criticality is lower than this workload's.";
      propBtn.addEventListener("click", function() { runPropagation(workload, right); });
      btnRow.appendChild(propBtn);
    }
    section.appendChild(btnRow);
    return section;
  }

  // Phase 16 helper: open a modal picker for assets to map. Scoped to the
  // workload's same state (current/desired) and to the other 5 layers.
  function openAssetPicker(workload, right) {
    document.getElementById("map-asset-picker")?.remove();
    var overlay = mk("div", "dialog-overlay"); overlay.id = "map-asset-picker";
    var box     = mk("div", "dialog-box");
    box.appendChild(mkt("div", "dialog-title", "Map an asset to '" + workload.label + "'"));

    var alreadyMapped = workload.mappedAssetIds || [];
    // v2.3.1 — restrict the picker to assets in the workload's same
    // environment. A hybrid workload is modelled as separate per-env tiles.
    var candidates = (session.instances || []).filter(function(i) {
      return i.state === workload.state
          && i.environmentId === workload.environmentId
          && i.layerId !== "workload"
          && alreadyMapped.indexOf(i.id) < 0;
    });

    var envObj = ENVIRONMENTS.find(function(e) { return e.id === workload.environmentId; });
    var envLabel = envObj ? envObj.label : workload.environmentId;
    box.appendChild(mkt("div", "detail-ph-hint",
      "Showing " + workload.state + " assets in " + envLabel +
      " only. To map a hybrid workload, create a separate workload tile in the other environment."));

    if (candidates.length === 0) {
      box.appendChild(mkt("div", "detail-ph-hint",
        "No unmapped " + workload.state + " assets available in " + envLabel +
        ". Add infrastructure tiles in this environment's column first."));
    } else {
      var list = mk("div", "link-picker-list");
      candidates.forEach(function(asset) {
        var item = mk("div", "link-picker-item");
        var dot  = mk("span", "cmd-dot cmd-dot-" + (asset.vendorGroup || "custom"));
        item.appendChild(dot);
        item.appendChild(mkt("span", "cmd-item-name", asset.label));
        var layerObj = LAYERS.find(function(l) { return l.id === asset.layerId; });
        var envObj   = ENVIRONMENTS.find(function(e) { return e.id === asset.environmentId; });
        item.appendChild(mkt("span", "cmd-item-vendor",
          (layerObj ? layerObj.label : asset.layerId) + " / " + (envObj ? envObj.label : asset.environmentId)));
        item.addEventListener("click", function() {
          try { mapAsset(session, workload.id, asset.id); saveToLocalStorage(); overlay.remove(); showDetailPanel(right, workload); }
          catch(e) { alert(e.message); }
        });
        list.appendChild(item);
      });
      box.appendChild(list);
    }
    var foot = mk("div", "form-actions");
    var cancel = mkt("button", "btn-secondary", "Cancel");
    cancel.addEventListener("click", function() { overlay.remove(); });
    foot.appendChild(cancel);
    box.appendChild(foot);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
  }

  // Phase 16 helper: walk through criticality upgrade proposals one at a
  // time, asking the presales to confirm each. Per-asset confirm matches
  // the locked decision (no silent bulk upgrades).
  function runPropagation(workload, right) {
    var proposals = proposeCriticalityUpgrades(session, workload.id);
    if (proposals.length === 0) {
      alert("All mapped assets already meet or exceed '" + workload.label + "' criticality (" + workload.criticality + "). Nothing to propagate.");
      return;
    }
    var applied = [];
    proposals.forEach(function(p) {
      var msg = "Upgrade '" + p.label + "' criticality from " +
                (p.currentCrit || "(unset)") + " to " + p.newCrit +
                " to match workload '" + workload.label + "'?";
      if (window.confirm(msg)) {
        try {
          updateInstance(session, p.assetId, { criticality: p.newCrit });
          applied.push(p);
        } catch(e) { alert("Failed to upgrade " + p.label + ": " + e.message); }
      }
    });
    saveToLocalStorage();
    // Refresh each upgraded asset's matrix cell so the new criticality colour
    // is visible immediately (without leaving + returning to the tab).
    applied.forEach(function(p) {
      var asset = (session.instances || []).find(function(i) { return i.id === p.assetId; });
      if (asset) refreshCell(asset.layerId, asset.environmentId);
    });
    // Re-render the workload detail so the mapped-asset chips reflect the new criticalities.
    showDetailPanel(right, workload);
    if (applied.length > 0) {
      try { showToast(applied.length + " asset" + (applied.length === 1 ? "" : "s") + " upgraded to " + workload.criticality, "ok"); }
      catch(e) { /* showToast is module-scoped; ignore if unreachable */ }
    }
  }
}

// ---- Shared helpers ----
function updateUnreviewedBanner(container, session) {
  container.innerHTML = "";
  var unreviewedCount = 0;
  (session.instances || []).forEach(function(i) {
    if (i.state !== "current") return;
    var hasCounterpart = (session.instances || []).some(function(d) {
      return d.state === "desired" && d.originId === i.id;
    });
    if (!hasCounterpart) unreviewedCount++;
  });
  var total = (session.instances || []).filter(function(i) { return i.state === "current"; }).length;
  if (total === 0) return;

  var banner = mk("div", unreviewedCount > 0 ? "unreviewed-banner banner-warn" : "unreviewed-banner banner-ok");
  if (unreviewedCount > 0) {
    banner.textContent = unreviewedCount + " of " + total + " current item" + (total > 1 ? "s" : "") +
      " not yet reviewed -- click the grey dashed tiles to set each disposition.";
  } else {
    banner.textContent = "All " + total + " current items reviewed in desired state.";
  }
  container.appendChild(banner);
}

function renderDemoBanner(container) {
  var b = mk("div", "demo-mode-banner");
  b.innerHTML = "<strong>Demo mode</strong> -- You are viewing example data. Use the Reporting tab to explore, or click <em>New Session</em> in the footer to start fresh with your own customer.";
  container.appendChild(b);
}

function showToast(msg, type) {
  var t = document.getElementById("matrix-toast");
  if (!t) { t = mk("div", ""); t.id = "matrix-toast"; document.body.appendChild(t); }
  t.className = "matrix-toast toast-" + (type || "ok");
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.style.opacity = "0"; }, 2800);
}

function mk(tag, cls)         { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
function mkt(tag, cls, text)  { var e = mk(tag, cls); e.textContent = text; return e; }
function mkSep(text)          { return mkt("div", "detail-sep", text); }
function fg(label, input)     { var g = mk("div","form-group"); g.appendChild(mkt("label","form-label",label)); g.appendChild(input); return g; }
function selEl(prop, opts, val, lm) {
  var s = mk("select","form-select"); s.setAttribute("data-prop",prop);
  opts.forEach(function(o) { var opt = document.createElement("option"); opt.value = o; opt.textContent = (lm&&lm[o])?lm[o]:(o||"-- none --"); if(o===val)opt.selected=true; s.appendChild(opt); });
  return s;
}
function taEl(prop, val, ph) { var t = mk("textarea","form-textarea"); t.setAttribute("data-prop",prop); t.value=val; t.placeholder=ph||""; t.rows=4; return t; }
function showHint(right) {
  right.innerHTML = "";
  var ph = mk("div","detail-placeholder");
  ph.appendChild(mkt("div","detail-ph-icon","+"));
  ph.appendChild(mkt("div","detail-ph-title","Select a technology"));
  ph.appendChild(mkt("div","detail-ph-hint","Click any tile to edit it. In Desired State, click grey dashed tiles to set a disposition for each current technology."));
  right.appendChild(ph);
}
