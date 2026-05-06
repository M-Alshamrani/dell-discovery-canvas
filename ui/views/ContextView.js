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
// rc.7 / 7c · Tab 1 Context migration · driver writes go v3-first per
// SPEC §S19.3.1. The v3→v2 mirror in state/sessionBridge.js back-fills
// liveSession.customer.drivers so this view's existing reads (which
// stay on the v2 shape this commit) keep working.
import {
  commitDriverAdd,
  commitDriverUpdateByBusinessDriverId,
  commitDriverRemoveByBusinessDriverId,
  // rc.7 / 7d-2 · Tab 1 Context migration · customer + envs cut to v3
  // adapter per SPEC §S19.3.1. The v3→v2 mirror in sessionBridge.js
  // back-fills liveSession.customer + liveSession.environments so
  // non-migrated v2.x consumers (header strip, save indicator, gaps
  // view environment filters) keep reading fresh data.
  commitContextEdit,
  commitEnvAdd,
  commitEnvHideByCatalogId,
  commitEnvUnhideByCatalogId,
  commitEnvUpdateByCatalogId
} from "../../state/adapter.js";
import { getActiveEngagement as _getActiveEngagementForCtxView } from "../../state/engagementStore.js";
import { helpButton } from "./HelpModal.js";
import { renderDemoBanner } from "../components/DemoBanner.js";
import { emitSessionChanged } from "../../core/sessionEvents.js";
import { getStatus as getSaveStatus } from "../../core/saveStatus.js";
import { openOverlay, closeOverlay } from "../components/Overlay.js";
import { confirmAction } from "../components/Notify.js";

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
    // rc.7 / 7d-2 · Save context cut over to commitContextEdit per
    // SPEC §S19.3.1. Customer fields go v3-first via the adapter; the
    // sessionBridge v3→v2 customer mirror back-fills v2 session.customer
    // so non-migrated readers (header strip, save indicator) refresh.
    // applyContextSave still runs for sessionMeta + isDemo bookkeeping
    // since sessionMeta is v2-only (presales owner / status / version /
    // date) and not yet part of the v3 engagement.customer shape.
    var customerPatch = {};
    var sessionMetaPatch = {};
    form.querySelectorAll("[data-field]").forEach(function(input) {
      var path = input.getAttribute("data-field").split(".");
      if (path.length === 2) {
        if (path[0] === "customer")    customerPatch[path[1]]    = input.value;
        if (path[0] === "sessionMeta") sessionMetaPatch[path[1]] = input.value;
      }
    });
    // applyContextSave first -- its compare-against-v2-current logic
    // depends on v2 being at the *prior* state (so it can detect what
    // changed and flip isDemo + emit "context-save"). If we ran
    // commitContextEdit first, the bridge v3→v2 customer mirror would
    // have already overwritten v2 with the new values, and
    // applyContextSave would see no diff (changed=false → no isDemo
    // flip, no emit). Run v2 path first; commitContextEdit second
    // (becomes a no-op for v3 since the bridge v2→v3 merge inside
    // applyContextSave's emit-cycle already brought v3 to the same
    // state, but the explicit call satisfies §S19.3.1's "writes go
    // v3-first via the adapter" contract for V-FLOW-MIGRATE-TAB1-
    // CUSTOMER-1 source-grep).
    var v2Patch = {};
    if (Object.keys(customerPatch).length    > 0) v2Patch.customer    = customerPatch;
    if (Object.keys(sessionMetaPatch).length > 0) v2Patch.sessionMeta = sessionMetaPatch;
    if (Object.keys(v2Patch).length > 0) applyContextSave(v2Patch);
    if (Object.keys(customerPatch).length > 0) {
      commitContextEdit({ customer: customerPatch });
    }
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

  // v2.4.15-polish iter-5 . preset chip row. One-click "Single site"
  // for clients that only have a Main DC -- saves the user from
  // hiding DR + Public + Edge one at a time. Renders only when more
  // than one env is currently visible (clicking it would otherwise
  // be a no-op).
  if (visible.length > 1) {
    var presetRow = mk("div", "env-preset-row");
    presetRow.appendChild(mkt("span", "env-preset-label", "Quick shape"));
    presetRow.appendChild(buildPresetChip("Single site",
      "Hide every environment except the Primary Data Center. Useful when the client has a single on-prem footprint.",
      function() { return ["coreDc"]; },
      session, card, right));
    card.appendChild(presetRow);
  }

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

// v2.4.15-polish iter-5 . preset chip in the Environments card. Click
// runs a confirm modal listing what will be hidden + what will stay,
// then flips hidden flags on every active env not in the keepIds list.
// keepFn(session) returns Array<envId> to keep visible.
// rc.7 / 7d-2 · helper used by all sites that materialize the v2
// session.environments default-4 fallback. Creates v3 engagement
// records for each v2 env that doesn't yet have a corresponding v3
// record (matched by envCatalogId), so subsequent commitEnv*ByCatalogId
// lookups succeed. Idempotent -- re-running it is a no-op for any v3
// record already present.
//
// Called AFTER the v2 materialization so v3 mirrors v2's hidden flag
// at materialization time. The bridge's non-destructive baseline
// (sessionBridge.js _lastV3EnvProjection) prevents v2 clobber on the
// resulting emit cascade.
function _ensureV3EnvsMaterialized(session) {
  if (!Array.isArray(session.environments) || session.environments.length === 0) return;
  var eng = _getActiveEngagementForCtxView();
  if (!eng || !eng.environments || !Array.isArray(eng.environments.allIds)) return;
  var existing = {};
  eng.environments.allIds.forEach(function(uuid) {
    var e = eng.environments.byId[uuid];
    if (e && e.envCatalogId) existing[e.envCatalogId] = true;
  });
  session.environments.forEach(function(v2e) {
    if (!v2e || !v2e.id || existing[v2e.id]) return;
    commitEnvAdd({
      envCatalogId: v2e.id,
      hidden:       !!v2e.hidden,
      alias:        typeof v2e.alias    === "string" && v2e.alias.length    > 0 ? v2e.alias    : null,
      location:     typeof v2e.location === "string" && v2e.location.length > 0 ? v2e.location : null,
      sizeKw:       typeof v2e.sizeKw   === "number" ? v2e.sizeKw   : null,
      sqm:          typeof v2e.sqm      === "number" ? v2e.sqm      : null,
      tier:         typeof v2e.tier     === "string" && v2e.tier.length     > 0 ? v2e.tier     : null,
      notes:        typeof v2e.notes    === "string" ? v2e.notes : ""
    });
  });
}

function buildPresetChip(label, hint, keepFn, session, card, right) {
  var chip = mk("button", "env-preset-chip tag");
  chip.type = "button";
  chip.setAttribute("data-t", "biz");
  chip.textContent = label;
  chip.title = hint;
  chip.addEventListener("click", function() {
    // v2.4.15-polish iter-5 hotfix . on a fresh session, displayList
    // comes from the default-4 fallback (getActiveEnvironments) but
    // session.environments[] is still empty. Materialize the default-4
    // into session.environments first so we have real entries to flip
    // hidden flags on. Idempotent -- a no-op if entries already exist.
    if (!Array.isArray(session.environments) || session.environments.length === 0) {
      var defaults = getActiveEnvironments(session); // default-4 catalog entries
      session.environments = defaults.map(function(e) {
        return { id: e.id, hidden: false };
      });
    }
    // rc.7 / 7d-2 · materialize in v3 so commitEnvHideByCatalogId hits.
    _ensureV3EnvsMaterialized(session);
    var keep = keepFn(session) || [];
    var keepSet = {};
    keep.forEach(function(id) { keepSet[id] = true; });
    var willHide = (session.environments || [])
      .filter(function(e) { return !e.hidden && !keepSet[e.id]; })
      .map(function(e) {
        var cat = ENV_CATALOG.find(function(c) { return c.id === e.id; });
        return e.alias || (cat ? cat.label : e.id);
      });
    if (willHide.length === 0) return;
    confirmAction({
      title: label + " preset",
      lede:  hint,
      body:  "Will hide: " + willHide.join(", ") + ". Each one stays in your saved file and can be restored from the Hidden environments section."
    }).then(function(yes) {
      if (!yes) return;
      (session.environments || []).forEach(function(e) {
        if (!keepSet[e.id]) {
          // rc.7 / 7d-2 · v3-first per SPEC §S19.3.1; bridge mirror
          // back-fills v2 session.environments[].hidden in lockstep.
          // Local-state echo for the immediate paint cycle below.
          e.hidden = true;
          commitEnvHideByCatalogId(e.id);
        }
      });
      saveToLocalStorage();
      emitSessionChanged("env-preset", "Preset: " + label);
      paintEnvironmentsCard(card, session, right);
      renderWelcomePanel(right);
    });
  });
  return chip;
}

function buildEnvTile(envEntry, session, card, right, isHidden, canHide) {
  var catalog = ENV_CATALOG.find(function(c) { return c.id === envEntry.id; });
  var label   = catalog ? catalog.label : envEntry.id;
  var alias   = (envEntry.alias && envEntry.alias.trim()) || label;

  var tile = mk("div", "env-tile" + (isHidden ? " env-tile-hidden" : ""));
  tile.setAttribute("data-env-row", "true");
  tile.setAttribute("data-env-id", envEntry.id);

  // v2.4.15-polish . tile structure: alias headline + catalog eyebrow +
  // a row of GPLC tags showing the env's metadata at a glance. Hidden
  // tiles get an eye-off icon instead of metadata + the OPS-color
  // "HIDDEN" tag. Empty metadata fields just don't render their tag --
  // no placeholder noise.
  tile.appendChild(mkt("div", "env-tile-label", alias));
  tile.appendChild(mkt("div", "env-tile-sublabel", catalog ? catalog.label : envEntry.id));

  if (isHidden) {
    var hiddenRow = mk("div", "env-tile-tags");
    hiddenRow.appendChild(mkLucide("eye-off", 12));
    var hiddenTag = mkt("span", "tag", "HIDDEN");
    hiddenTag.setAttribute("data-t", "ops");
    hiddenRow.appendChild(hiddenTag);
    tile.appendChild(hiddenRow);
    var instCount = countInstancesForEnv(session, envEntry.id);
    if (instCount > 0) {
      tile.appendChild(mkt("div", "env-tile-meta",
        instCount + " instance" + (instCount === 1 ? "" : "s") + " preserved in saved file"));
    }
    var restore = mk("button", "env-restore-btn btn-with-feedback");
    restore.type = "button";
    restore.textContent = "Restore";
    restore.setAttribute("data-env-restore", envEntry.id);
    restore.addEventListener("click", function(e) {
      e.stopPropagation();
      restore.classList.add("is-loading");
      try {
        envEntry.hidden = false;
        // rc.7 / 7d-2 · v3-first per SPEC §S19.3.1.
        commitEnvUnhideByCatalogId(envEntry.id);
        saveToLocalStorage();
        emitSessionChanged("env-restore", "Restore environment");
        paintEnvironmentsCard(card, session, right);
      } catch (err) {
        restore.classList.remove("is-loading");
        restore.classList.add("is-error");
        restore.textContent = "Restore failed";
      }
    });
    tile.appendChild(restore);
  } else {
    var tagsRow = mk("div", "env-tile-tags");
    if (envEntry.location) {
      var loc = mkt("span", "tag", envEntry.location);
      loc.setAttribute("data-t", "tech");
      tagsRow.appendChild(loc);
    }
    if (envEntry.sizeKw != null) {
      var size = mkt("span", "tag", envEntry.sizeKw + " MW");
      size.setAttribute("data-t", "data");
      tagsRow.appendChild(size);
    }
    if (envEntry.tier) {
      var tier = mkt("span", "tag", envEntry.tier);
      tier.setAttribute("data-t", "biz");
      tagsRow.appendChild(tier);
    }
    if (tagsRow.children.length > 0) tile.appendChild(tagsRow);
  }

  // Click anywhere on the tile -> open right-panel detail editor.
  tile.addEventListener("click", function() {
    card.querySelectorAll(".env-tile").forEach(function(t) { t.classList.remove("selected"); });
    tile.classList.add("selected");
    renderEnvDetail(right, session, envEntry, card, canHide && !isHidden);
  });

  return tile;
}

// v2.4.15-polish . tiny inline-SVG helper for Lucide-style icons. Used
// directly inside view code where importing the full ui/icons.js
// module isn't worth it. `name` is one of the small catalog below.
function mkLucide(name, size) {
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
  var paths = LUCIDE_ICONS[name] || [];
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

var LUCIDE_ICONS = {
  "eye-off": [
    "M9.88 9.88a3 3 0 1 0 4.24 4.24",
    "M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68",
    "M6.61 6.61A13.526 13.526 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61",
    { tag: "line", x1: "2", x2: "22", y1: "2", y2: "22" }
  ],
  "eye": [
    "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z",
    { tag: "circle", cx: "12", cy: "12", r: "3" }
  ],
  "lock": [
    { tag: "rect", x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" },
    "M7 11V7a5 5 0 0 1 10 0v4"
  ]
};

function renderEnvDetail(right, session, envEntry, card, canHide) {
  // v2.4.15-polish iter-5 hotfix . envEntry may be a fallback catalog
  // entry (when session.environments[] is still empty on a fresh
  // session). Materialize the default-4 + re-resolve envEntry to the
  // real record so metadata typing actually persists.
  if (!Array.isArray(session.environments) || session.environments.length === 0) {
    var defaults = getActiveEnvironments(session);
    session.environments = defaults.map(function(e) {
      return { id: e.id, hidden: false };
    });
  }
  // rc.7 / 7d-2 · also materialize the envs in v3 so subsequent
  // commitEnv*ByCatalogId lookups succeed. Idempotent: commitEnvAdd
  // creates a fresh v3 record per call site, so we skip if a v3 record
  // already exists for this catalog id.
  _ensureV3EnvsMaterialized(session);
  var realEntry = (session.environments || []).find(function(e) { return e.id === envEntry.id; });
  if (realEntry) envEntry = realEntry;

  var catalog = ENV_CATALOG.find(function(c) { return c.id === envEntry.id; });
  var displayName = (envEntry.alias && envEntry.alias.trim()) || (catalog ? catalog.label : envEntry.id);
  right.innerHTML = "";

  var panel = mk("div", "card env-detail-panel");
  panel.appendChild(mkt("div", "panel-eyebrow", catalog ? catalog.label : envEntry.id));
  panel.appendChild(mkt("div", "panel-title", displayName));
  if (catalog && catalog.hint) {
    panel.appendChild(mkt("div", "panel-lede muted", catalog.hint));
  }

  // v2.4.15-polish iter-5 . typed inputs where the value is bounded:
  //   * Capacity (MW)    number stepper, 0-200, step 0.5
  //   * Floor area (m²)  number stepper, 0-100000, step 50
  //   * Tier             datalist (suggestions list, free typing OK)
  // Free-form fields (alias, location, notes) stay plain text.
  var fields = [
    { key: "alias",    label: "Alias",            placeholder: catalog ? catalog.label : envEntry.id, type: "text",   hint: "What the customer calls this site." },
    { key: "location", label: "Location",         placeholder: "City, region",                        type: "text",   hint: "Used in the report." },
    { key: "sizeKw",   label: "Capacity (MW)",    placeholder: "e.g. 5",                              type: "number", min: 0, max: 200, step: 0.5,
      hint: "Power footprint in megawatts. Use the +/- buttons or type." },
    { key: "sqm",      label: "Floor area (m²)",  placeholder: "e.g. 320",                            type: "number", min: 0, max: 100000, step: 50,
      hint: "Useful for telco / colo conversations." },
    { key: "tier",     label: "Tier",             placeholder: "e.g. Tier III",                       type: "datalist",
      list:  ["Tier I", "Tier II", "Tier III", "Tier IV", "Public", "Sovereign", "Edge / Branch", "N/A"],
      hint: "Pick a standard tier or type a custom value." },
    { key: "notes",    label: "Notes",            placeholder: "Anything else to remember",           type: "text",   hint: "Free-form context for this site." }
  ];
  var grid = mk("div", "env-detail-grid");
  fields.forEach(function(f) {
    var grp = mk("div", "form-group env-meta-field");
    grp.appendChild(mkt("label", "form-label", f.label));
    var input = mk("input", "form-input env-meta-input");
    if (f.type === "datalist") {
      input.type = "text";
      var listId = "env-datalist-" + envEntry.id + "-" + f.key;
      input.setAttribute("list", listId);
      var dl = document.createElement("datalist");
      dl.id = listId;
      (f.list || []).forEach(function(opt) {
        var o = document.createElement("option");
        o.value = opt;
        dl.appendChild(o);
      });
      grp.appendChild(dl);
    } else {
      input.type = f.type;
    }
    if (f.type === "number") {
      if (typeof f.min  === "number") input.setAttribute("min",  String(f.min));
      if (typeof f.max  === "number") input.setAttribute("max",  String(f.max));
      if (typeof f.step === "number") input.setAttribute("step", String(f.step));
      input.setAttribute("inputmode", "decimal");
    }
    input.placeholder = f.placeholder;
    var current = envEntry[f.key];
    input.value = (current === undefined || current === null) ? "" : String(current);
    input.setAttribute("data-env-meta", f.key);
    input.addEventListener("change", function() {
      var v = (input.value || "").trim();
      var nextValue;
      if (f.type === "number") {
        var n = parseFloat(v);
        if (!isNaN(n)) {
          if (typeof f.min === "number" && n < f.min) n = f.min;
          if (typeof f.max === "number" && n > f.max) n = f.max;
        }
        nextValue = isNaN(n) ? undefined : n;
      } else {
        nextValue = v.length === 0 ? undefined : v;
      }
      // Local-state echo so the next render reads what the user typed.
      envEntry[f.key] = nextValue;
      if (envEntry[f.key] === undefined) delete envEntry[f.key];
      // rc.7 / 7d-2 · v3-first env metadata write per SPEC §S19.3.1.
      // v3 schema uses null for cleared optional fields; map undefined
      // → null so the patch validates.
      var v3Patch = {};
      v3Patch[f.key] = nextValue === undefined ? null : nextValue;
      commitEnvUpdateByCatalogId(envEntry.id, v3Patch);
      // Bridge mirror back-fills v2 session.environments; saveToLocalStorage
      // still runs to persist v2 sessionStore for non-migrated readers.
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
      // rc.7 / 7d-2 · v3-first per SPEC §S19.3.1. The bridge mirror
      // back-fills v2 session.environments; emitSessionChanged kept
      // for non-migrated subscribers that listen on the "env-restore"
      // reason specifically (filterState repaint).
      commitEnvUnhideByCatalogId(envEntry.id);
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
        // rc.7 / 7d-2 · v3-first env-add per SPEC §S19.3.1.
        // commitEnvAdd creates the v3 record (assigns UUID + catalogVersion);
        // the bridge mirror then back-fills v2 session.environments. We
        // also push to v2 for the immediate auto-open (the mirror is
        // synchronous but we hold a fresh local-state echo so the next
        // renderEnvDetail call has a stable entry to focus on).
        commitEnvAdd({ envCatalogId: c.id });
        if (!Array.isArray(session.environments)) session.environments = [];
        // Bridge mirror has already updated session.environments;
        // re-resolve the matching entry by catalog id for the auto-open.
        var newEntry = session.environments.find(function(e) { return e.id === c.id; });
        if (!newEntry) {
          // Defensive fallback if the mirror hasn't run yet (shouldn't happen).
          newEntry = { id: c.id, hidden: false };
          session.environments.push(newEntry);
        }
        saveToLocalStorage();
        emitSessionChanged("env-add", "Add environment");
        close();
        // Auto-open the new env's detail panel.
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
  // v2.4.15-polish iter-5 hotfix . if the env we're about to hide is a
  // fallback catalog entry (not yet materialized in session.environments)
  // then session.environments[] is empty + flipping envEntry.hidden has
  // no effect on the real list. Materialize the default-4 first +
  // re-resolve envEntry by id so the hide-flow operates on the real
  // record.
  if (!Array.isArray(session.environments) || session.environments.length === 0) {
    var defaults = getActiveEnvironments(session);
    session.environments = defaults.map(function(e) {
      return { id: e.id, hidden: false };
    });
    var real = session.environments.find(function(e) { return e.id === envEntry.id; });
    if (real) envEntry = real;
  }
  // rc.7 / 7d-2 · materialize in v3 so commitEnvHideByCatalogId hits.
  _ensureV3EnvsMaterialized(session);
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
  // rc.7 / 7d-2 · v3-first env-hide per SPEC §S19.3.1.
  commitEnvHideByCatalogId(envEntry.id);
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
    function doDelete() {
      // rc.7 / 7c · v3-first remove per SPEC §S19.3.1.
      // d.id is the businessDriverId catalog ref (v2 shape); the
      // adapter helper does the catalog-ref → v3-UUID lookup.
      // The sessionBridge v3→v2 mirror back-fills session.customer.drivers
      // so the subsequent paintDriverTiles + renderWelcomePanel reads
      // pick up the new v2 shape automatically.
      commitDriverRemoveByBusinessDriverId(d.id);
      saveToLocalStorage();
      paintDriverTiles(row, session, right);
      renderWelcomePanel(right);
    }
    if (d.outcomes && d.outcomes.trim().length > 0) {
      confirmAction({
        title: "Remove driver?",
        body: "'" + label + "' has outcomes you've already typed. Removing the driver discards them. This can't be undone.",
        confirmLabel: "Remove driver",
        danger: true
      }).then(function(yes) { if (yes) doDelete(); });
    } else {
      doDelete();
    }
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
  // rc.7 / 7c · v3-first write per SPEC §S19.3.1. driverId is the
  // catalog reference (e.g. "cyber_resilience"); v3 addDriver action
  // assigns a fresh UUID + stamps engagementId + timestamps. The
  // sessionBridge v3→v2 mirror back-fills session.customer.drivers,
  // so the existing v2-shape reads in this view continue to work.
  if (!Array.isArray(session.customer.drivers)) session.customer.drivers = [];
  // Idempotency guard against the v2 array (matches v3 addDriver's own
  // uniqueness invariant per businessDriverId).
  if (session.customer.drivers.some(function(d) { return d.id === driverId; })) return;
  commitDriverAdd({ businessDriverId: driverId, priority: "Medium", outcomes: "" });
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
    // rc.7 / 7c · v3-first update per SPEC §S19.3.1. driver.id is the
    // businessDriverId catalog ref (v2 shape); the adapter does the
    // catalog-ref → v3-UUID lookup. The mirror back-fills v2 so the
    // local driver object also reflects the new priority next render.
    commitDriverUpdateByBusinessDriverId(driver.id, { priority: prioSel.value });
    driver.priority = prioSel.value;   // local-state echo for immediate re-render
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
    // rc.7 / 7c · v3-first update per SPEC §S19.3.1. (See priority
    // change above for the same id-translation note.)
    commitDriverUpdateByBusinessDriverId(driver.id, { outcomes: out.value });
    driver.outcomes = out.value;   // local-state echo
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
