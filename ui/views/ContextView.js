// ui/views/ContextView.js — Tab 1 · Context (v2 · SPEC §7.1)
//
// UX contract:
//   1. Identity card (customer name, vertical, region, presales owner).
//   2. "Your drivers" panel — tiles of added drivers + "+ Add driver" button.
//      Click "+ Add driver" → command palette overlay of the 8 catalog drivers.
//      Select a driver → pushed into session.customer.drivers[] idempotently.
//      Click a tile → right panel shows:
//        - Conversation starter (card.coaching-card with the driver's conversationStarter)
//        - Priority select (High / Medium / Low)
//        - Business-outcomes textarea with auto-bullet-on-Enter behaviour
//      Remove control on each tile: silent if outcomes empty, confirms otherwise.
//   3. No session-level businessOutcomes or primaryDriver — those moved under drivers[].

import { BUSINESS_DRIVERS, CUSTOMER_VERTICALS } from "../../core/config.js";
import { useAiButton }             from "../components/UseAiButton.js";
import { saveToLocalStorage } from "../../state/sessionStore.js";
import { helpButton } from "./HelpModal.js";

export function renderContextView(left, right, session) {
  left.innerHTML  = "";
  right.innerHTML = "";

  if (session.isDemo) renderDemoBanner(left);

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
    form.querySelectorAll("[data-field]").forEach(function(input) {
      var path = input.getAttribute("data-field").split(".");
      if (path.length === 2) session[path[0]][path[1]] = input.value;
      else                   session[path[0]]          = input.value;
    });
    if (session.customer.name && session.customer.name.trim()) session.isDemo = false;
    saveToLocalStorage();
    saveIdBtn.textContent = "Saved";
    setTimeout(function() { saveIdBtn.textContent = "Save context"; }, 1500);
    var hdr = document.getElementById("sessionMetaHeader");
    if (hdr) hdr.textContent = (session.customer.name || "New session") + "  |  " + session.sessionMeta.date + "  |  v" + session.sessionMeta.version;
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
  renderWelcomePanel(right);
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

  // Phase 19b / v2.4.1 — generic "Use AI" button driven by deployed
  // skills from the Skills admin panel. Replaces the hardcoded v2.4.0
  // demo card; the seeded driver-question skill is pre-deployed on
  // first run so this panel still works out of the box.
  var aiCard = mk("div", "card ai-skill-card");
  aiCard.style.marginTop = "12px";
  var aiHead = mk("div", "card-title-row");
  aiHead.appendChild(mkt("div", "ai-skill-title", "✨ AI assistance"));
  var resultBox = mk("div", "ai-skill-result");
  resultBox.style.display = "none";
  aiHead.appendChild(useAiButton("context", {
    getSession:   function() { return session; },
    getContext:   function() {
      return {
        selectedDriver: Object.assign({}, driver, {
          label:     meta ? meta.label     : driver.id,
          shortHint: meta ? meta.shortHint : ""
        })
      };
    },
    getResultEl:  function() { return resultBox; }
  }));
  aiCard.appendChild(aiHead);
  aiCard.appendChild(mkt("div", "card-hint",
    "Run any deployed skill for this tab. Manage skills via the gear icon → Skills section."));
  aiCard.appendChild(resultBox);
  right.appendChild(aiCard);
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
function renderDemoBanner(container) {
  var b = mk("div", "demo-mode-banner");
  b.innerHTML = "<strong>Demo mode</strong> — Edit the fields below to start your own session, then click Save.";
  container.appendChild(b);
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
