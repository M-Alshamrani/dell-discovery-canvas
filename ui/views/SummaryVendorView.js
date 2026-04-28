// ui/views/SummaryVendorView.js — vendor & platform mix analytics

import { LAYERS, getVisibleEnvironments } from "../../core/config.js";
import { computeMixByLayer, computeMixByEnv, computeVendorTableData } from "../../services/vendorMixService.js";
import { helpButton } from "./HelpModal.js";
import { session as moduleLiveSession } from "../../state/sessionStore.js";
import { renderDemoBanner } from "../components/DemoBanner.js";

export function renderSummaryVendorView(left, right, sessionArg) {
  // v2.4.15 . accept session as optional 3rd arg so tests can drive
  // with a fixture; default to module-scoped live session.
  var liveSession = sessionArg || moduleLiveSession;
  let stateFilter    = "combined";
  let activeLayerIds = new Set(LAYERS.map(l => l.id));

  if (liveSession && liveSession.isDemo) renderDemoBanner(left);

  const overview = mk("div", "card");
  overview.innerHTML = `
    <div class="card-title-row"><div class="card-title">Vendor and platform mix</div></div>
    <div class="card-hint">Understand where Dell, non-Dell, and custom platforms are concentrated — and how the target architecture shifts that balance.</div>
    <div class="filter-row">
      <span class="filter-label">View:</span>
      <div class="segmented-ctrl" id="vm-toggle">
        <button class="seg-btn" data-val="current">Current</button>
        <button class="seg-btn" data-val="desired">Desired</button>
        <button class="seg-btn active" data-val="combined">Combined</button>
      </div>
      <div class="legend-row">
        <span class="legend-swatch swatch-dell"></span>Dell
        <span class="legend-swatch swatch-nondell"></span>Non-Dell
        <span class="legend-swatch swatch-custom"></span>Custom
      </div>
    </div>
    <div class="filter-row" style="margin-top:8px">
      <span class="filter-label">Layers:</span>
      <div class="chips-row" id="vm-layers"></div>
    </div>
    <div class="chips-row" id="vm-chips" style="margin-top:8px"></div>`;
  overview.querySelector(".card-title-row").appendChild(helpButton("reporting_vendor"));
  left.appendChild(overview);

  // wire toggle
  overview.querySelector("#vm-toggle").querySelectorAll(".seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      overview.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      stateFilter = btn.dataset.val;
      renderAll();
    });
  });

  // layer chips
  const lc = overview.querySelector("#vm-layers");
  LAYERS.forEach(layer => {
    const chip = mk("div", "chip-filter active");
    chip.textContent = layer.label;
    chip.addEventListener("click", () => {
      chip.classList.toggle("active");
      if (chip.classList.contains("active")) activeLayerIds.add(layer.id);
      else                                    activeLayerIds.delete(layer.id);
      if (!activeLayerIds.size) {
        LAYERS.forEach(l => activeLayerIds.add(l.id));
        lc.querySelectorAll(".chip-filter").forEach(c => c.classList.add("active"));
      }
      renderAll();
    });
    lc.appendChild(chip);
  });

  // v2.4.15 . VB1-VB3 . segmented bar overview (3 stacked horizontal bars)
  // for Combined / Current / Desired. Replaces the multi-card legacy
  // table layout for top-level mix communication. Per-layer + per-env
  // detail bars remain below.
  const overviewCard = mk("div", "card");
  overviewCard.innerHTML = `<div class="card-title">Mix overview</div>
    <div class="card-hint">A 100% horizontal bar showing how Dell, non-Dell, and custom-built platforms split across the estate. Use the View toggle above to switch between Combined / Current / Desired.</div>
    <div class="vm-overview-bars"></div>
    <div class="vm-overview-legend"></div>`;
  left.appendChild(overviewCard);
  // v2.4.15 . hold direct refs (don't rely on document.getElementById,
  // which doesn't see elements until the parent is in document).
  const overviewBarsHost = overviewCard.querySelector(".vm-overview-bars");
  const overviewLegendHost = overviewCard.querySelector(".vm-overview-legend");

  const layerCard = mk("div", "card"); layerCard.innerHTML = `<div class="card-title">Mix by layer</div><div class="vm-by-layer"></div>`; left.appendChild(layerCard);
  const layerHost = layerCard.querySelector(".vm-by-layer");
  const envCard   = mk("div", "card"); envCard.innerHTML   = `<div class="card-title">Mix by environment</div><div class="vm-by-env"></div>`;   left.appendChild(envCard);
  const envHost   = envCard.querySelector(".vm-by-env");
  const tableCard = mk("div", "card");
  tableCard.innerHTML = `
    <div class="card-title">Vendor detail</div>
    <div class="table-scroll"><table class="vendor-table" id="vm-table"></table></div>`;
  left.appendChild(tableCard);

  // Phase 13 · right-panel detail: click any vendor row → instance breakdown here.
  renderVendorRight(null);

  function ids() { return [...activeLayerIds]; }

  function renderAll() {
    // summary chips
    const rows = computeVendorTableData({ layerIds: ids() });
    const d = rows.reduce((s,r) => s + (r.vendorGroup==="dell"    ? r.total : 0), 0);
    const n = rows.reduce((s,r) => s + (r.vendorGroup==="nonDell" ? r.total : 0), 0);
    const c = rows.reduce((s,r) => s + (r.vendorGroup==="custom"  ? r.total : 0), 0);
    const chips = document.getElementById("vm-chips");
    if (chips) chips.innerHTML = `
      <span class="chip-stat chip-dell">Dell: ${d}</span>
      <span class="chip-stat">Non-Dell: ${n}</span>
      <span class="chip-stat">Custom: ${c}</span>`;

    // v2.4.15 polish . ONE 100%-stacked overview bar driven by the
    // existing Combined / Current / Desired segmented control. Single
    // bar reads as one chart; the legend underneath spells out the
    // colors in plain English with counts. Per-layer mini bars stay.
    var byLayerOverview = computeMixByLayer({ stateFilter: stateFilter, layerIds: ids() });
    var totals = { dell: 0, nonDell: 0, custom: 0, total: 0 };
    Object.keys(byLayerOverview).forEach(function(lid) {
      totals.dell    += byLayerOverview[lid].dell    || 0;
      totals.nonDell += byLayerOverview[lid].nonDell || 0;
      totals.custom  += byLayerOverview[lid].custom  || 0;
      totals.total   += byLayerOverview[lid].total   || 0;
    });
    var stateLabel = stateFilter === "current"  ? "Current state"
                  : stateFilter === "desired"   ? "Desired state"
                  :                                "Combined (current + desired)";
    renderOverviewBars(overviewBarsHost, [{ label: stateLabel, counts: totals }]);
    renderOverviewLegend(overviewLegendHost, totals);

    var visibleEnvs = getVisibleEnvironments(liveSession);
    renderBars(layerHost,
      computeMixByLayer({ stateFilter, layerIds: ids() }),
      ids().map(id => ({ id, label: LAYERS.find(l=>l.id===id)?.label || id })));

    renderBars(envHost,
      computeMixByEnv({ stateFilter, layerIds: ids(), environments: visibleEnvs }),
      visibleEnvs.map(e => ({ id: e.id, label: e.label })));

    renderTable(rows);
  }

  // v2.4.15 . overview-bar renderer (VB1/VB2). Always emits exactly 3
  // .vendor-bar-segment children so the test can rely on the count;
  // empty (0%) segments render with width:0 + display:none for visual
  // cleanness but stay in DOM so JSON probes remain stable.
  function renderOverviewBars(c, items) {
    if (!c) return;
    c.innerHTML = "";
    items.forEach(function(item) {
      var counts = item.counts || { dell:0, nonDell:0, custom:0, total:0 };
      var total  = counts.total || 1;
      var dp = pct(counts.dell,    total);
      var np = pct(counts.nonDell, total);
      var cp = 100 - dp - np;
      if (cp < 0) cp = 0;

      var grp = mk("div", "vendor-bar-group vendor-bar-overview");
      var lbl = mk("div", "vendor-bar-label metric");
      lbl.textContent = item.label + " · " + counts.total + " " +
        (counts.total === 1 ? "instance" : "instances");
      grp.appendChild(lbl);

      var bar = mk("div", "vendor-bar vendor-bar-large");
      [["dell", dp], ["nonDell", np], ["custom", cp]].forEach(function(pair) {
        var seg = mk("div", "vendor-bar-segment vendor-bar-segment-" + pair[0]);
        seg.setAttribute("data-vendor-group", pair[0]);
        seg.style.width = pair[1] + "%";
        seg.title = pair[0] + ": " + pair[1] + "%";
        if (pair[1] >= 6) seg.textContent = pair[1] + "%";
        bar.appendChild(seg);
      });
      grp.appendChild(bar);
      c.appendChild(grp);
    });
  }

  // v2.4.15 polish . clean legend with color swatches + counts. Reads
  // like a key under the headline bar so users don't need to hover
  // segments to know what each color means.
  function renderOverviewLegend(c, counts) {
    if (!c) return;
    c.innerHTML = "";
    var rows = [
      { id: "dell",    label: "Dell Technologies", count: counts.dell    || 0 },
      { id: "nonDell", label: "Other vendors",     count: counts.nonDell || 0 },
      { id: "custom",  label: "Custom / in-house", count: counts.custom  || 0 }
    ];
    rows.forEach(function(r) {
      var item = mk("div", "vendor-legend-item");
      var sw = mk("span", "vendor-legend-swatch vendor-legend-swatch-" + r.id);
      item.appendChild(sw);
      var lbl = mk("span", "vendor-legend-label");
      lbl.textContent = r.label;
      item.appendChild(lbl);
      var cnt = mk("span", "vendor-legend-count metric");
      cnt.textContent = r.count;
      item.appendChild(cnt);
      c.appendChild(item);
    });
  }

  // v2.4.15 . VB3 . per-layer / per-env bars now also emit .vendor-bar
  // (alongside legacy .bar-track) so the same CSS rules + the same test
  // selectors apply across overview + breakdown sections.
  function renderBars(c, mix, items) {
    if (!c) return; c.innerHTML = "";
    items.forEach(item => {
      const counts = mix[item.id] || { dell:0, nonDell:0, custom:0, total:0 };
      const total  = counts.total || 1;
      const dp = pct(counts.dell,   total);
      const np = pct(counts.nonDell,total);
      let   cp = 100 - dp - np;
      if (cp < 0) cp = 0;

      const grp = mk("div", "bar-group");
      const lbl = mk("div", "bar-label"); lbl.textContent = item.label; grp.appendChild(lbl);
      const bar = mk("div", "bar-track vendor-bar vendor-bar-mini");
      [["dell", dp, "bar-dell"], ["nonDell", np, "bar-nondell"], ["custom", cp, "bar-custom"]].forEach(([group, w, legacyCls]) => {
        const seg = mk("div", legacyCls + " vendor-bar-segment vendor-bar-segment-" + group);
        seg.setAttribute("data-vendor-group", group);
        seg.style.width = w + "%";
        seg.title = group + ": " + w + "%";
        if (w >= 6) seg.textContent = w + "%";
        bar.appendChild(seg);
      });
      grp.appendChild(bar);
      const meta = mk("div", "bar-meta");
      meta.textContent = `Dell: ${counts.dell}  ·  Non-Dell: ${counts.nonDell}  ·  Custom: ${counts.custom}`;
      grp.appendChild(meta);
      c.appendChild(grp);
    });
  }

  function renderTable(rows) {
    const t = document.getElementById("vm-table"); if (!t) return;
    t.innerHTML = `<thead><tr>${["Vendor","Group","Current","Desired","Total"].map(h=>`<th>${h}</th>`).join("")}</tr></thead>`;
    const tbody = document.createElement("tbody");
    rows.forEach(r => {
      const tr = document.createElement("tr");
      tr.className = "vm-row";
      tr.setAttribute("data-vendor", r.vendor);
      const groupLabel = r.vendorGroup === "dell" ? "Dell" : r.vendorGroup === "nonDell" ? "Non-Dell" : "Custom";
      tr.innerHTML = `<td>${r.vendor}</td><td><span class="vg-badge vg-${r.vendorGroup}">${groupLabel}</span></td><td>${r.current}</td><td>${r.desired}</td><td><strong>${r.total}</strong></td>`;
      // Phase 13 · click → vendor detail on right panel
      tr.addEventListener("click", () => renderVendorRight(r.vendor));
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
  }

  // Phase 13 · right-panel detail for a selected vendor.
  function renderVendorRight(vendorName) {
    right.innerHTML = "";
    if (!vendorName) {
      const ph = mk("div", "detail-placeholder");
      ph.innerHTML = `
        <div class="detail-ph-title">Vendor detail</div>
        <div class="detail-ph-hint">Click any row in the Vendor table on the left to see that vendor's instances broken down by layer, environment, and state.</div>`;
      right.appendChild(ph);
      return;
    }
    const matching = (liveSession.instances || []).filter(i => (i.vendor || "") === vendorName);
    const panel = mk("div", "detail-panel");
    const title = mk("div", "detail-title"); title.textContent = vendorName;
    const sub   = mk("div", "detail-sub");   sub.textContent = `${matching.length} instance${matching.length===1?"":"s"} in session`;
    panel.appendChild(title); panel.appendChild(sub);

    if (matching.length === 0) {
      const note = mk("div", "detail-text");
      note.textContent = "No instances recorded for this vendor in the current session.";
      panel.appendChild(note);
      right.appendChild(panel);
      return;
    }

    // Breakdown by layer
    const byLayer = {};
    matching.forEach(i => {
      const key = i.layerId || "?";
      byLayer[key] = (byLayer[key] || 0) + 1;
    });
    const layerSep = mk("div", "detail-sep"); layerSep.textContent = "By layer"; panel.appendChild(layerSep);
    Object.keys(byLayer).forEach(lid => {
      const label = LAYERS.find(l => l.id === lid)?.label || lid;
      const row = mk("div", "detail-row");
      row.innerHTML = `<strong>${label}:</strong> ${byLayer[lid]}`;
      panel.appendChild(row);
    });

    // Current vs Desired
    const curCount = matching.filter(i => i.state === "current").length;
    const desCount = matching.filter(i => i.state === "desired").length;
    const stateSep = mk("div", "detail-sep"); stateSep.textContent = "State"; panel.appendChild(stateSep);
    const stateRow = mk("div", "detail-row");
    stateRow.innerHTML = `<strong>Current:</strong> ${curCount}  ·  <strong>Desired:</strong> ${desCount}`;
    panel.appendChild(stateRow);

    // Instance list
    const instSep = mk("div", "detail-sep"); instSep.textContent = "Instances"; panel.appendChild(instSep);
    matching.forEach(inst => {
      const envLabel = (getVisibleEnvironments(liveSession).find(e => e.id === inst.environmentId) || {}).label || inst.environmentId;
      const row = mk("div", "detail-row");
      row.innerHTML = `<span class="vg-badge vg-${inst.vendorGroup||'custom'}">${inst.state}</span> ${inst.label} — ${envLabel}`;
      panel.appendChild(row);
    });

    right.appendChild(panel);
  }

  function pct(v, t) { return Math.round((v / t) * 100); }
  renderAll();
}

function mk(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
