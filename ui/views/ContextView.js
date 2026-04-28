// ui/views/ContextView.js , Tab 1 · Context (v2 · SPEC §7.1)
//
// UX contract:
//   1. Identity card (customer name, vertical, region, presales owner).
//   2. "Your drivers" panel , tiles of added drivers + "+ Add driver" button.
//      Click "+ Add driver" → command palette overlay of the 8 catalog drivers.
//      Select a driver → pushed into session.customer.drivers[] idempotently.
//      Click a tile → right panel shows:
//        - Conversation starter (card.coaching-card with the driver's conversationStarter)
//        - Priority select (High / Medium / Low)
//        - Business-outcomes textarea with auto-bullet-on-Enter behaviour
//      Remove control on each tile: silent if outcomes empty, confirms otherwise.
//   3. No session-level businessOutcomes or primaryDriver , those moved under drivers[].

import {
  BUSINESS_DRIVERS, CUSTOMER_VERTICALS,
  ENV_CATALOG, getActiveEnvironments, getVisibleEnvironments, getHiddenEnvironments,
  getEnvLabel
} from "../../core/config.js";
import { saveToLocalStorage, resetToDemo, isFreshSession, applyContextSave } from "../../state/sessionStore.js";
import { helpButton } from "./HelpModal.js";
import { renderDemoBanner } from "../components/DemoBanner.js";
import { emitSessionChanged } from "../../core/sessionEvents.js";
import { getStatus as getSaveStatus } from "../../core/saveStatus.js";
import { openOverlay, closeOverlay } from "../components/Overlay.js";

export function renderContextView(left, right, session) {
  left.innerHTML  = "";
  right.innerHTML = "";

  // v2.4.7 · U1 · fresh-start welcome card. Renders at the top of the
  // left panel on a brand-new session so the user has a clear path
  // between "type your customer name" and "explore with demo data".
  // Demo mode shows the pre-existing demo banner instead (isDemo flag
  // is mutually exclusive with a fresh/empty session).
  if (isFreshSession(session))      renderFreshStartCard(left);
  else if (session.isDemo)          renderDemoBanner(left);

  // ── Identity card ─────────────────────────────────────────
  var idCard = mk("div", "card");
  var titleRow = mk("div", "card-title-row");
  titleRow.appendChild(mkt("div", "card-title", "Discovery context"));
  titleRow.appendChild(helpButton("context"));
  idCard.appendChild(titleRow);
  idCard.appendChild(mkt("div", "card-hint",
    "Capture the essentials. Add the drivers that matter to the customer, then open each to map outcomes."));

  var form = mk("div", "context-form");

  var row1 = mk("div", "context-row-2");
  row1.appendChild(fg("Customer name",
    inputF("customer.name", session.customer.name || "", "e.g. Acme Financial Services")));
  row1.appendChild(fg("Vertical / segment",
    selectF("customer.vertical", session.customer.vertical || "", CUSTOMER_VERTICALS, "Select vertical...")));
  form.appendChild(row1);

  var row2 = mk("div", "context-row-2");
  row2.appendChild(fg("Region",
    inputF("customer.region", session.customer.region || "", "e.g. EMEA, North America")));
  row2.appendChild(fg("Presales owner",
    inputF("sessionMeta.presalesOwner", session.sessionMeta.presalesOwner || "", "Your name")));
  form.appendChild(row2);

  idCard.appendChild(form);

  var saveIdBtn = mk("button", "btn-primary");
  saveIdBtn.textContent = "Save context";
  saveIdBtn.style.marginTop = "8px";
  saveIdBtn.addEventListener("click", function() {
    // v2.4.12 · PR1 · build a patch from the form, hand it to applyContextSave.
    // applyContextSave compares each field to current session values and only
    // flips isDemo when something actually changed. Fixes the v2.4.11 bug
    // where any Save click flipped isDemo and the demo banner vanished on
    // refresh.
    var patch = { customer: {}, sessionMeta: {} };
    form.querySelectorAll("[data-field]").forEach(function(input) {
      var path = input.getAttribute("data-field").split(".");
      if (path.length === 2 && (path[0] === "customer" || path[0] === "sessionMeta")) {
        patch[path[0]][path[1]] = input.value;
      }
    });
    applyContextSave(patch);
    saveIdBtn.textContent = "Saved";
    setTimeout(function() { saveIdBtn.textContent = "Save context"; }, 1500);
    // v2.4.13 S2A: applyContextSave emits session-changed when anything
    // changed, which routes through app.js onSessionChanged ->
    // renderHeaderMeta to rebuild the topbar session strip with the new
    // customer name. The legacy direct-textContent hack on
    // #sessionMetaHeader is removed (it clobbered the structured strip
    // markup with a flat string).
  });
  idCard.appendChild(saveIdBtn);
  left.appendChild(idCard);

  // ── Drivers panel ─────────────────────────────────────────
  var driversCard = mk("div", "card");
  driversCard.style.marginTop = "12px";
  driversCard.appendChild(mkt("div", "card-title", "Strategic Drivers"));
  driversCard.appendChild(mkt("div", "card-hint",
    "Add the strategic drivers the customer cares about. Click any tile to open its priority and outcomes on the right."));

  var driversRow = mk("div", "drivers-row");
  driversCard.appendChild(driversRow);
  left.appendChild(driversCard);

  paintDriverTiles(driversRow, session, right);

  // v2.4.15 . Environments card . tile-and-palette UX matching the
  // driver-tile pattern above (click tile -> right-panel detail edit;
  // "+ Add environment" tile -> command-palette overlay; Hide /
  // Restore live in the right-panel detail). Replaces the v2.4.15-pre-
  // polish cramped per-row metadata grid.
  var envCard = renderEnvironmentsCard(session, right);
  left.appendChild(envCard);

  renderWelcomePanel(right);
}

// ---------------------------------------------------------------------------
// v2.4.15 · Environments card . tile + command-palette + right-panel detail.
// ---------------------------------------------------------------------------
function renderEnvironmentsCard(session, right) {
  var card = mk("div", "card env-card");
  card.style.marginTop = "12px";
  card.appendChild(mkt("div", "card-title", "Environments"));
  card.appendChild(mkt("div", "card-hint",
    "Click any environment to edit alias, location, capacity, and tier on the right. Click \"+ Add environment\" to bring a new type into scope. Hide an environment to drop it from the report without losing its data."));

  paintEnvironmentsCard(card, session, right);
  return card;
}

function paintEnvironmentsCard(card, session, right) {
  while (card.children.length > 2) card.removeChild(card.lastChild);

  // Read-only display list (never mutates session.environments).
  var displayList = (session.environments && session.environments.length > 0)
    ? session.environments.slice()
    : getActiveEnvironments(session);
  var visible = displayList.filter(function(e) { return !e.hidden; });
  var hidden  = displayList.filter(function(e) { return e.hidden === true; });
  var canHide = visible.length > 1;

  // Active tiles row + "+ Add environment" tile at the end.
  var activeRow = mk("div", "env-tiles-row");
  visible.forEach(function(envEntry) {
    activeRow.appendChild(buildEnvTile(envEntry, session, card, right, /*isHidden*/ false, canHide));
  });
  var inSession = {};
  (session.environments || []).forEach(function(e) { inSession[e.id] = true; });
  var available = ENV_CATALOG.filter(function(c) { return !inSession[c.id]; });
  if (available.length > 0) {
    var addBtn = mk("button", "env-add-btn");
    addBtn.type = "button";
    addBtn.textContent = "+ Add environment";
    addBtn.addEventListener("click", function() {
      openEnvPalette(session, card, right);
    });
    activeRow.appendChild(addBtn);
  }
  card.appendChild(activeRow);

  // Hidden tiles row (muted) + heading. Only renders when there are any.
  if (hidden.length > 0) {
    var hiddenSection = mk("div", "env-hidden-section hidden-environments");
    hiddenSection.setAttribute("data-env-hidden-section", "true");
    hiddenSection.appendChild(mkt("div", "env-section-heading muted",
      "Hidden environments (" + hidden.length + ") . excluded from the report; click to restore."));
    var hiddenRow = mk("div", "env-tiles-row env-tiles-row-hidden");
    hidden.forEach(function(envEntry) {
      hiddenRow.appendChild(buildEnvTile(envEntry, session, card, right, /*isHidden*/ true, /*canHide*/ false));
    });
    hiddenSection.appendChild(hiddenRow);
    card.appendChild(hiddenSection);
  }
}

function buildEnvTile(envEntry, session, card, right, isHidden, canHide) {
  var catalog = ENV_CATALOG.find(function(c) { return c.id === envEntry.id; });
  var label   = catalog ? catalog.label : envEntry.id;
  var alias   = (envEntry.alias && envEntry.alias.trim()) || label;
  var meta    = [];
  if (envEntry.location)       meta.push(envEntry.location);
  if (envEntry.sizeKw != null) meta.push(envEntry.sizeKw + " MW");
  if (envEntry.tier)           meta.push(envEntry.tier);

  var tile = mk("div", "env-tile" + (isHidden ? " env-tile-hidden" : ""));
  tile.setAttribute("data-env-row", "true");
  tile.setAttribute("data-env-id", envEntry.id);

  tile.appendChild(mkt("div", "env-tile-label", alias));
  tile.appendChild(mkt("div", "env-tile-sublabel", catalog ? catalog.label : envEntry.id));
  if (meta.length > 0) {
    tile.appendChild(mkt("div", "env-tile-meta", meta.join(" . ")));
  }

  if (isHidden) {
    tile.appendChild(mkt("span", "env-tile-tag tag", "HIDDEN"));
    // One-click restore from the tile (no confirmation; low-stakes reverse).
    var restore = mk("button", "env-restore-btn btn-link");
    restore.type = "button";
    restore.textContent = "Restore";
    restore.setAttribute("data-env-restore", envEntry.id);
    restore.addEventListener("click", function(e) {
      e.stopPropagation();
      envEntry.hidden = false;
      saveToLocalStorage();
      emitSessionChanged("env-restore", "Restore environment");
      paintEnvironmentsCard(card, session, right);
    });
    tile.appendChild(restore);
  }

  // Click anywhere on the tile -> open right-panel detail editor.
  tile.addEventListener("click", function() {
    card.querySelectorAll(".env-tile").forEach(function(t) { t.classList.remove("selected"); });
    tile.classList.add("selected");
    renderEnvDetail(right, session, envEntry, card, canHide && !isHidden);
  });

  return tile;
}

function renderEnvDetail(right, session, envEntry, card, canHide) {
  var catalog = ENV_CATALOG.find(function(c) { return c.id === envEntry.id; });
  var displayName = (envEntry.alias && envEntry.alias.trim()) || (catalog ? catalog.label : envEntry.id);
  right.innerHTML = "";

  var panel = mk("div", "card env-detail-panel");
  panel.appendChild(mkt("div", "panel-eyebrow", catalog ? catalog.label : envEntry.id));
  panel.appendChild(mkt("div", "panel-title", displayName));
  if (catalog && catalog.hint) {
    panel.appendChild(mkt("div", "panel-lede muted", catalog.hint));
  }

  var fields = [
    { key: "alias",    label: "Alias",                placeholder: catalog ? catalog.label : envEntry.id, type: "text",   hint: "What the customer calls this site." },
    { key: "location", label: "Location",             placeholder: "City, region",                        type: "text",   hint: "Used in the report." },
    { key: "sizeKw",   label: "Capacity (MW)",        placeholder: "e.g. 5",                              type: "number", hint: "Power footprint, in megawatts." },
    { key: "sqm",      label: "Floor area (m²)",      placeholder: "e.g. 320",                            type: "number", hint: "Useful for telco / colo conversations." },
    { key: "tier",     label: "Tier",                 placeholder: "e.g. Tier III",                       type: "text",   hint: "Uptime / certification level." },
    { key: "notes",    label: "Notes",                placeholder: "Anything else to remember",           type: "text",   hint: "Free-form context for this site." }
  ];
  var grid = mk("div", "env-detail-grid");
  fields.forEach(function(f) {
    var grp = mk("div", "form-group env-meta-field");
    grp.appendChild(mkt("label", "form-label", f.label));
    var input = mk("input", "form-input env-meta-input");
    input.type = f.type;
    input.placeholder = f.placeholder;
    var current = envEntry[f.key];
    input.value = (current === undefined || current === null) ? "" : String(current);
    input.setAttribute("data-env-meta", f.key);
    input.addEventListener("change", function() {
      var v = (input.value || "").trim();
      if (f.type === "number") {
        var n = parseFloat(v);
        envEntry[f.key] = isNaN(n) ? undefined : n;
      } else {
        envEntry[f.key] = v.length === 0 ? undefined : v;
      }
      if (envEntry[f.key] === undefined) delete envEntry[f.key];
      saveToLocalStorage();
      paintEnvironmentsCard(card, session, right);
      // Repaint detail too so the eyebrow + title pick up new alias.
      renderEnvDetail(right, session, envEntry, card, canHide);
      // Keep this tile selected.
      var t = card.querySelector(".env-tile[data-env-id='" + envEntry.id + "']");
      if (t) {
        card.querySelectorAll(".env-tile").forEach(function(x) { x.classList.remove("selected"); });
        t.classList.add("selected");
      }
    });
    grp.appendChild(input);
    if (f.hint) grp.appendChild(mkt("div", "form-hint muted", f.hint));
    grid.appendChild(grp);
  });
  panel.appendChild(grid);

  // Hide / Restore action lives in the detail footer.
  var footer = mk("div", "env-detail-footer");
  if (envEntry.hidden) {
    var rest = mk("button", "btn-primary env-restore-btn-detail");
    rest.type = "button";
    rest.textContent = "Restore environment";
    rest.setAttribute("data-env-restore", envEntry.id);
    rest.addEventListener("click", function() {
      envEntry.hidden = false;
      saveToLocalStorage();
      emitSessionChanged("env-restore", "Restore environment");
      paintEnvironmentsCard(card, session, right);
      renderWelcomePanel(right);
    });
    footer.appendChild(rest);
  } else {
    var hide = mk("button", "btn-secondary env-hide-btn");
    hide.type = "button";
    hide.textContent = "Hide environment";
    hide.setAttribute("data-env-hide", envEntry.id);
    if (!canHide) {
      hide.disabled = true;
      hide.setAttribute("aria-disabled", "true");
      hide.title = "At least one environment must remain active";
    } else {
      hide.addEventListener("click", function() {
        startHideFlow(envEntry, session, hide, function() {
          paintEnvironmentsCard(card, session, right);
          renderWelcomePanel(right);
        });
      });
    }
    footer.appendChild(hide);
  }
  panel.appendChild(footer);

  right.appendChild(panel);
}

function openEnvPalette(session, card, right) {
  var existing = document.getElementById("env-palette");
  if (existing) existing.remove();

  var overlay = mk("div", "cmd-overlay");
  overlay.id = "env-palette";
  var box = mk("div", "cmd-box");
  box.appendChild(mkt("div", "cmd-context", "Add an environment"));
  var srch = document.createElement("input");
  srch.className = "cmd-search";
  srch.placeholder = "Search environment types…";
  srch.setAttribute("autocomplete", "off");
  box.appendChild(srch);
  var results = mk("div", "cmd-results");
  box.appendChild(results);
  box.appendChild(mkt("div", "cmd-hint", "Arrows navigate · Enter selects · Esc closes"));
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(function() { srch.focus(); }, 0);

  var activeIdx = -1;
  function inSessionIds() {
    var s = {};
    (session.environments || []).forEach(function(e) { s[e.id] = true; });
    return s;
  }
  function render(q) {
    results.innerHTML = ""; activeIdx = -1;
    var taken = inSessionIds();
    var qlc = (q || "").toLowerCase();
    var filtered = ENV_CATALOG.filter(function(c) {
      if (taken[c.id]) return false;
      if (!qlc) return true;
      return (c.label + " " + c.hint).toLowerCase().indexOf(qlc) >= 0;
    });
    if (filtered.length === 0) {
      results.appendChild(mkt("div", "cmd-empty",
        Object.keys(taken).length >= ENV_CATALOG.length
          ? "All catalog environments are already in this session."
          : "No environments match your search."));
      return;
    }
    filtered.forEach(function(c) {
      var item = mk("div", "cmd-item");
      item.appendChild(mkt("span", "cmd-item-name", c.label));
      item.appendChild(mkt("span", "cmd-item-vendor", c.hint));
      item.addEventListener("click", function() {
        if (!Array.isArray(session.environments)) session.environments = [];
        session.environments.push({ id: c.id, hidden: false });
        saveToLocalStorage();
        emitSessionChanged("env-add", "Add environment");
        close();
        // Auto-open the new env's detail panel.
        var newEntry = session.environments[session.environments.length - 1];
        renderEnvDetail(right, session, newEntry, card, true);
      });
      item.addEventListener("mouseenter", function() {
        var items = Array.from(results.querySelectorAll(".cmd-item"));
        items.forEach(function(el, i) {
          el.classList.toggle("active", el === item);
          if (el === item) activeIdx = i;
        });
      });
      results.appendChild(item);
    });
  }
  function close() {
    overlay.remove();
    paintEnvironmentsCard(card, session, right);
  }
  srch.addEventListener("input", function() { render(srch.value.trim()); });
  srch.addEventListener("keydown", function(e) {
    var items = Array.from(results.querySelectorAll(".cmd-item"));
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown") { activeIdx = Math.min(activeIdx + 1, items.length - 1); items.forEach(function(el, i) { el.classList.toggle("active", i === activeIdx); }); e.preventDefault(); }
    if (e.key === "ArrowUp")   { activeIdx = Math.max(activeIdx - 1, 0); items.forEach(function(el, i) { el.classList.toggle("active", i === activeIdx); }); e.preventDefault(); }
    if (e.key === "Enter" && activeIdx >= 0) { items[activeIdx].click(); }
  });
  overlay.addEventListener("click", function(e) { if (e.target === overlay) close(); });
  render("");
}

function countInstancesForEnv(session, envId) {
  var n = 0;
  (session.instances || []).forEach(function(i) {
    if (i && i.environmentId === envId) n++;
  });
  return n;
}

// ---------------------------------------------------------------------------
// Hide flow · save-guard (when a save is in flight) -> confirmation -> commit.
// ---------------------------------------------------------------------------
// v2.4.15-polish . hide flow now uses ui/components/Overlay.js so the
// confirmation reads as a proper centered modal (backdrop blur, sticky
// head/foot, focus trap, Escape closes) consistent with AI Assist and
// the rest of the app's overlay vocabulary. The body keeps the same
// copy contract Suite 46 SD3/SD4 asserts: env name + instance count +
// "Hide" / "Cancel" buttons; save-guard variant offers Save & Hide
// when status is "saving".
function startHideFlow(envEntry, session, anchorBtn, onAfterHide) {
  var status = (typeof getSaveStatus === "function") ? getSaveStatus() : null;
  var dirty = status && status.status === "saving";
  if (dirty) {
    openSaveGuardModal(envEntry, session, anchorBtn, onAfterHide);
  } else {
    openHideConfirmModal(envEntry, session, anchorBtn, onAfterHide);
  }
}

function commitHide(envEntry, session, onAfterHide) {
  envEntry.hidden = true;
  saveToLocalStorage();
  emitSessionChanged("env-hide", "Hide environment");
  closeOverlay();
  if (typeof onAfterHide === "function") onAfterHide();
}

function openSaveGuardModal(envEntry, session, anchorBtn, onAfterHide) {
  // Body copy goes into a div so Suite 46 SD3 can find the .save-guard-modal
  // root marker via data attribute on the panel.
  var body = mk("div", "save-guard-body");
  body.appendChild(mkt("div", "save-guard-lede",
    "You have unsaved changes. Save them first before hiding this environment?"));

  var saveAndHide = mkBtn("Save & Hide", "btn-primary btn-with-feedback save-and-hide",
    function() {
      saveAndHide.classList.add("is-loading");
      try {
        saveToLocalStorage();
        closeOverlay();
        openHideConfirmModal(envEntry, session, anchorBtn, onAfterHide);
      } catch (e) {
        saveAndHide.classList.remove("is-loading");
        saveAndHide.classList.add("is-error");
        saveAndHide.textContent = "Save failed";
        console.error("[ContextView] save-and-hide failed:", e);
      }
    });
  var hideOnly = mkBtn("Hide without saving", "btn-secondary btn-with-feedback hide-without-save",
    function() {
      closeOverlay();
      openHideConfirmModal(envEntry, session, anchorBtn, onAfterHide);
    });
  var cancel = mkBtn("Cancel", "btn-link btn-cancel", function() { closeOverlay(); });

  var foot = mk("div", "overlay-actions");
  foot.appendChild(cancel);
  foot.appendChild(hideOnly);
  foot.appendChild(saveAndHide);

  openOverlay({
    title: "Save before hiding?",
    lede: "Unsaved changes detected.",
    body: body,
    footer: foot,
    kind: "save-guard",
    size: "default"
  });
  // Mark on the panel + a wrapper alias so the SD3 selector
  // `.save-guard-modal, [data-save-guard='true']` resolves.
  var panel = document.querySelector(".overlay.open");
  if (panel) {
    panel.classList.add("save-guard-modal");
    panel.classList.add("hide-env-modal");
    panel.setAttribute("data-save-guard", "true");
  }
}

function openHideConfirmModal(envEntry, session, anchorBtn, onAfterHide) {
  var catalog = ENV_CATALOG.find(function(c) { return c.id === envEntry.id; });
  var displayName = (envEntry.alias && envEntry.alias.length > 0)
    ? envEntry.alias
    : (catalog ? catalog.label : envEntry.id);
  var instCount = countInstancesForEnv(session, envEntry.id);

  var body = mk("div", "hide-env-body");
  var lede = mkt("p", "hide-env-lede",
    "It will be removed from Current state, Desired state, and Reporting. " +
    instCount + " instance" + (instCount === 1 ? "" : "s") +
    " will stay in your saved file. You can restore it any time from the Context tab.");
  body.appendChild(lede);

  var confirmBtn = mkBtn("Hide environment", "btn-primary btn-with-feedback confirm-hide",
    function() {
      confirmBtn.classList.add("is-loading");
      try {
        commitHide(envEntry, session, onAfterHide);
      } catch (e) {
        confirmBtn.classList.remove("is-loading");
        confirmBtn.classList.add("is-error");
        confirmBtn.textContent = "Hide failed";
        console.error("[ContextView] hide failed:", e);
      }
    });
  confirmBtn.setAttribute("data-hide-env-confirm", "true");
  var cancelBtn = mkBtn("Cancel", "btn-link btn-cancel", function() { closeOverlay(); });
  cancelBtn.setAttribute("data-hide-env-cancel", "true");

  var foot = mk("div", "overlay-actions");
  foot.appendChild(cancelBtn);
  foot.appendChild(confirmBtn);

  openOverlay({
    title: "Hide '" + displayName + "'?",
    lede: catalog ? catalog.label : envEntry.id,
    body: body,
    footer: foot,
    kind: "hide-env",
    size: "default"
  });
  var panel = document.querySelector(".overlay.open");
  if (panel) {
    panel.classList.add("hide-env-modal");
    panel.setAttribute("data-hide-env-modal", envEntry.id);
  }
}

function mkBtn(text, klass, onClick) {
  var b = mk("button", klass);
  b.type = "button";
  b.textContent = text;
  if (typeof onClick === "function") b.addEventListener("click", onClick);
  return b;
}

function paintDriverTiles(row, session, right) {
  row.innerHTML = "";
  var drivers = session.customer.drivers || [];
  drivers.forEach(function(d, idx) {
    row.appendChild(buildDriverTile(d, idx, session, row, right));
  });

  var addBtn = mk("button", "driver-add-btn");
  addBtn.textContent = "+ Add driver";
  addBtn.addEventListener("click", function() { openDriverPalette(session, row, right); });
  row.appendChild(addBtn);
}

function buildDriverTile(d, idx, session, row, right) {
  var meta = BUSINESS_DRIVERS.find(function(bd) { return bd.id === d.id; });
  var label = meta ? meta.label : d.id;
  var hint  = meta ? meta.shortHint : "";

  var tile = mk("div", "driver-tile");
  tile.setAttribute("data-driver-id", d.id);

  tile.appendChild(mkt("div", "driver-tile-label", label));
  tile.appendChild(mkt("div", "driver-tile-hint",  hint));

  var pb = mk("span", "driver-priority-badge priority-" + (d.priority || "Medium").toLowerCase());
  pb.textContent = d.priority || "Medium";
  tile.appendChild(pb);

  var del = mk("button", "driver-tile-del");
  del.textContent = "×";
  del.title = "Remove driver";
  del.addEventListener("click", function(e) {
    e.stopPropagation();
    if (d.outcomes && d.outcomes.trim().length > 0) {
      if (!confirm("Remove driver '" + label + "'? Outcomes you typed will be lost.")) return;
    }
    var driverIdx = (session.customer.drivers || []).indexOf(d);
    if (driverIdx >= 0) session.customer.drivers.splice(driverIdx, 1);
    saveToLocalStorage();
    paintDriverTiles(row, session, right);
    renderWelcomePanel(right);
  });
  tile.appendChild(del);

  tile.addEventListener("click", function() {
    row.querySelectorAll(".driver-tile").forEach(function(t) { t.classList.remove("selected"); });
    tile.classList.add("selected");
    renderDriverDetail(right, session, d, function() { paintDriverTiles(row, session, right); });
  });

  return tile;
}

function openDriverPalette(session, row, right) {
  var existing = document.getElementById("driver-palette");
  if (existing) existing.remove();

  var overlay = mk("div", "cmd-overlay");
  overlay.id = "driver-palette";
  var box = mk("div", "cmd-box");

  box.appendChild(mkt("div", "cmd-context", "Add a business driver"));
  var srch = document.createElement("input");
  srch.className = "cmd-search";
  srch.placeholder = "Search drivers...";
  srch.setAttribute("autocomplete", "off");
  box.appendChild(srch);

  var results = mk("div", "cmd-results");
  box.appendChild(results);
  box.appendChild(mkt("div", "cmd-hint", "Arrows navigate · Enter selects · Esc closes"));

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(function() { srch.focus(); }, 0);

  var activeIdx = -1;

  function render(q) {
    results.innerHTML = ""; activeIdx = -1;
    var addedIds = new Set((session.customer.drivers || []).map(function(d) { return d.id; }));
    var qlc = (q || "").toLowerCase();
    var filtered = BUSINESS_DRIVERS.filter(function(bd) {
      if (addedIds.has(bd.id)) return false;
      if (!qlc) return true;
      return (bd.label + " " + bd.shortHint).toLowerCase().indexOf(qlc) >= 0;
    });

    if (filtered.length === 0) {
      var empty = mk("div", "cmd-empty");
      empty.textContent = addedIds.size >= BUSINESS_DRIVERS.length
        ? "All 8 drivers already added."
        : "No drivers match your search.";
      results.appendChild(empty);
      return;
    }

    filtered.forEach(function(bd) {
      var item = mk("div", "cmd-item");
      item.appendChild(mkt("span", "cmd-item-name", bd.label));
      item.appendChild(mkt("span", "cmd-item-vendor", bd.shortHint));
      item.addEventListener("click", function() {
        addDriver(session, bd.id);
        close();
      });
      item.addEventListener("mouseenter", function() {
        var items = Array.from(results.querySelectorAll(".cmd-item"));
        items.forEach(function(el, i) {
          el.classList.toggle("active", el === item);
          if (el === item) activeIdx = i;
        });
      });
      results.appendChild(item);
    });
  }

  function close() {
    overlay.remove();
    paintDriverTiles(row, session, right);
  }

  srch.addEventListener("input", function() { render(srch.value.trim()); });
  srch.addEventListener("keydown", function(e) {
    var items = Array.from(results.querySelectorAll(".cmd-item"));
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown") { activeIdx = Math.min(activeIdx + 1, items.length - 1); highlight(items); e.preventDefault(); }
    if (e.key === "ArrowUp")   { activeIdx = Math.max(activeIdx - 1, 0);                highlight(items); e.preventDefault(); }
    if (e.key === "Enter" && activeIdx >= 0 && items[activeIdx]) items[activeIdx].click();
  });
  function highlight(items) {
    items.forEach(function(el, i) { el.classList.toggle("active", i === activeIdx); });
    if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: "nearest" });
  }
  overlay.addEventListener("click", function(e) { if (e.target === overlay) close(); });

  render("");
}

function addDriver(session, driverId) {
  if (!Array.isArray(session.customer.drivers)) session.customer.drivers = [];
  if (session.customer.drivers.some(function(d) { return d.id === driverId; })) return;
  session.customer.drivers.push({ id: driverId, priority: "Medium", outcomes: "" });
  saveToLocalStorage();
}

function renderDriverDetail(right, session, driver, onPriorityChange) {
  right.innerHTML = "";

  var meta = BUSINESS_DRIVERS.find(function(bd) { return bd.id === driver.id; });

  // Conversation-starter card (MUST carry .coaching-card class per T1.11)
  var coaching = mk("div", "card coaching-card");
  coaching.appendChild(mkt("div", "coaching-title", "Conversation starter"));
  coaching.appendChild(mkt("div", "coaching-text", meta ? meta.conversationStarter : ""));
  right.appendChild(coaching);

  // Driver form
  var formCard = mk("div", "card");
  formCard.style.marginTop = "12px";
  formCard.appendChild(mkt("div", "card-title", meta ? meta.label : driver.id));
  if (meta) formCard.appendChild(mkt("div", "card-hint", meta.shortHint));

  var prioGroup = mk("div", "form-group");
  prioGroup.style.marginTop = "12px";
  prioGroup.appendChild(mkt("label", "form-label", "Priority"));
  var prioSel = document.createElement("select");
  prioSel.className = "form-select";
  prioSel.setAttribute("data-field", "driver.priority");
  ["High", "Medium", "Low"].forEach(function(v) {
    var opt = document.createElement("option");
    opt.value = v; opt.textContent = v;
    if (v === (driver.priority || "Medium")) opt.selected = true;
    prioSel.appendChild(opt);
  });
  prioSel.addEventListener("change", function() {
    driver.priority = prioSel.value;
    saveToLocalStorage();
    if (onPriorityChange) onPriorityChange();
  });
  prioGroup.appendChild(prioSel);
  formCard.appendChild(prioGroup);

  var outGroup = mk("div", "form-group");
  outGroup.style.marginTop = "10px";
  outGroup.appendChild(mkt("label", "form-label", "Business outcomes"));
  var outHint = mkt("div", "card-hint", "Press Enter to start a new bullet.");
  outHint.style.marginBottom = "4px";
  outGroup.appendChild(outHint);
  var out = document.createElement("textarea");
  out.className = "form-textarea driver-outcomes";
  out.setAttribute("data-field", "driver.outcomes");
  out.rows = 5;
  out.value = driver.outcomes || "";
  out.placeholder = "• Example: recover from ransomware within 4 hours, proven quarterly.";
  attachAutoBullet(out);
  out.addEventListener("input", function() {
    driver.outcomes = out.value;
    saveToLocalStorage();
  });
  outGroup.appendChild(out);
  formCard.appendChild(outGroup);

  right.appendChild(formCard);

  // v2.4.13 S4E . per-driver inline AI mount removed. AI Assist is now
  // globally accessible from the topbar #topbarAiBtn; clicking it opens
  // the AI Assist overlay with skills scoped to the current tab. Removes
  // the right-panel ai-skill-card that previously lived here.
}

function renderWelcomePanel(right) {
  right.innerHTML = "";
  // v2.1 · terse placeholder only. Session content (the driver-detail coaching card)
  // still renders when a driver is picked; session tips moved into the ? help modal.
  var ph = mk("div", "detail-placeholder");
  ph.appendChild(mkt("div", "detail-ph-title", "Select a strategic driver"));
  ph.appendChild(mkt("div", "detail-ph-hint",
    "Click any driver on the left to open its conversation starter, priority, and business-outcomes editor. Or add a new driver via '+ Add driver'. Press ? for guidance."));
  right.appendChild(ph);
}

// ── Auto-bullet textarea (SPEC §7.1.1) ─────────────────────
function attachAutoBullet(textarea) {
  textarea.addEventListener("keydown", function(e) {
    // First printable keystroke into empty textarea → prepend "• "
    if (textarea.value === "" && e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      textarea.value = "• " + e.key;
      textarea.setSelectionRange(3, 3);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      var start  = textarea.selectionStart;
      var end    = textarea.selectionEnd;
      var val    = textarea.value;
      var before = val.slice(0, start);
      var after  = val.slice(end);
      var prefix = (before === "" && after === "") ? "• " : "\n• ";
      textarea.value = before + prefix + after;
      var newPos = before.length + prefix.length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if (e.key === "Backspace") {
      var s = textarea.selectionStart;
      var e2 = textarea.selectionEnd;
      if (s !== e2) return;
      var v = textarea.value;
      var beforeB = v.slice(0, s);
      var lineStart = beforeB.lastIndexOf("\n") + 1;
      var lineContent = beforeB.slice(lineStart);
      if (lineContent === "• ") {
        e.preventDefault();
        textarea.value = v.slice(0, lineStart) + v.slice(s);
        textarea.setSelectionRange(lineStart, lineStart);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  });
}

// ── Helpers ─────────────────────────────────────────────────
// v2.4.13 S5: renderDemoBanner extracted to ui/components/DemoBanner.js
// so every view can mount it; ContextView re-imports the shared helper.

// v2.4.7 · U1 · brand-new-session welcome card. Two CTAs: Load demo
// (flips to the Acme FSI persona + re-renders via the session-changed
// bus) or dismiss (just hides the card , fresh-start state remains).
function renderFreshStartCard(container) {
  var card = mk("div", "card fresh-start-card");
  card.setAttribute("data-fresh-start", "");
  card.appendChild(mkt("div", "fresh-start-eyebrow", "NEW SESSION"));
  card.appendChild(mkt("div", "fresh-start-title", "Start a workshop from scratch, or explore with demo data"));
  card.appendChild(mkt("div", "fresh-start-body",
    "Fill in the customer identity below and add the strategic drivers the customer cares about. " +
    "Or load the Acme Financial Services demo to see every tab populated with realistic data."));
  var actions = mk("div", "fresh-start-actions");
  var loadBtn = mkt("button", "btn-primary", "↺ Load demo session");
  loadBtn.type = "button";
  loadBtn.addEventListener("click", function() {
    // resetToDemo emits session-changed → app.js re-renders everything.
    // Card disappears on the re-render because isFreshSession is now false.
    resetToDemo();
  });
  var dismissBtn = mkt("button", "btn-secondary", "Start fresh");
  dismissBtn.type = "button";
  dismissBtn.addEventListener("click", function() {
    // Local dismiss only , no session mutation. User can still load demo
    // later via the footer "↺ Load demo" button.
    card.remove();
  });
  actions.appendChild(loadBtn);
  actions.appendChild(dismissBtn);
  card.appendChild(actions);
  container.appendChild(card);
}

function mk(tag, cls)       { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
function mkt(tag, cls, text){ var e = mk(tag, cls); e.textContent = text; return e; }
function fg(label, input)   { var g = mk("div","form-group"); g.appendChild(mkt("label","form-label",label)); g.appendChild(input); return g; }
function inputF(field, value, ph) {
  var i = mk("input","form-input"); i.setAttribute("data-field",field); i.value = value || ""; i.placeholder = ph || "";
  return i;
}
function selectF(field, value, options, placeholder) {
  var s = mk("select","form-select"); s.setAttribute("data-field", field);
  if (placeholder) { var o = document.createElement("option"); o.value = ""; o.textContent = placeholder; s.appendChild(o); }
  options.forEach(function(o) {
    var opt = document.createElement("option");
    opt.value = o; opt.textContent = o;
    if (o === value) opt.selected = true;
    s.appendChild(opt);
  });
  return s;
}
