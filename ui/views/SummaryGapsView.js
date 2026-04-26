// ui/views/SummaryGapsView.js — read-only gaps kanban with detail drill-down

import { LAYERS, ENVIRONMENTS } from "../../core/config.js";
import { getFilteredGaps, getGapsByPhase } from "../../services/gapsService.js";
import { helpButton } from "./HelpModal.js";
import { effectiveDellSolutions } from "../../services/programsService.js";
import { session as liveSession } from "../../state/sessionStore.js";
import { serviceLabel } from "../../core/services.js";

export function renderSummaryGapsView(left, right) {
  let activeLayerIds = new Set(LAYERS.map(l => l.id));
  let activeEnvId    = "all";
  let selectedGapId  = null;

  // ── header card ──────────────────────────────────────────────────────────
  const header = mk("div", "card");
  header.innerHTML = `
    <div class="card-title-row"><div class="card-title">Gaps &amp; Initiatives Board</div></div>
    <div class="card-hint">Read-only view. Use the Gaps step to create or edit initiatives.</div>
    <div class="chips-row" id="sg-chips"></div>`;
  header.querySelector(".card-title-row").appendChild(helpButton("reporting_gaps"));

  const filterRow = mk("div", "filter-row");
  filterRow.innerHTML = `<span class="filter-label">Layers:</span>`;
  const layerChips = mk("div", "chips-row");

  LAYERS.forEach(layer => {
    const chip = mk("div", "chip-filter active");
    chip.textContent = layer.label;
    chip.addEventListener("click", () => {
      chip.classList.toggle("active");
      if (chip.classList.contains("active")) activeLayerIds.add(layer.id);
      else                                    activeLayerIds.delete(layer.id);
      if (!activeLayerIds.size) {
        LAYERS.forEach(l => activeLayerIds.add(l.id));
        layerChips.querySelectorAll(".chip-filter").forEach(c => c.classList.add("active"));
      }
      renderAll();
    });
    layerChips.appendChild(chip);
  });
  filterRow.appendChild(layerChips);

  const envSel = mk("select", "form-select inline-sel");
  envSel.innerHTML = `<option value="all">All environments</option>` +
    ENVIRONMENTS.map(e => `<option value="${e.id}">${e.label}</option>`).join("");
  envSel.addEventListener("change", e => { activeEnvId = e.target.value; renderAll(); });
  filterRow.appendChild(envSel);

  header.appendChild(filterRow);
  left.appendChild(header);

  const board = mk("div", "kanban"); left.appendChild(board);

  right.innerHTML = `
    <div class="detail-placeholder">
      <div class="detail-ph-icon">◈</div>
      <div class="detail-ph-title">Select a gap</div>
      <div class="detail-ph-hint">Click any gap card to see context, mapped Dell solutions, and linked technologies.</div>
    </div>`;

  function filters() { return { layerIds: [...activeLayerIds], envId: activeEnvId }; }

  function renderAll() {
    renderChips();
    renderBoard();
    renderDetail();
  }

  function renderChips() {
    const c = document.getElementById("sg-chips"); if (!c) return;
    const gaps = getFilteredGaps(filters());
    c.innerHTML = `
      <span class="chip-stat">${gaps.length} gaps total</span>
      <span class="chip-stat chip-danger">${gaps.filter(g=>g.urgency==="High").length} High urgency</span>
      <span class="chip-stat">Now: ${gaps.filter(g=>g.phase==="now").length}</span>
      <span class="chip-stat">Next: ${gaps.filter(g=>g.phase==="next").length}</span>
      <span class="chip-stat">Later: ${gaps.filter(g=>g.phase==="later").length}</span>`;
  }

  function renderBoard() {
    board.innerHTML = "";
    const byPhase = getGapsByPhase(filters());
    [["now","Now (0–12 months)"],["next","Next (12–24 months)"],["later","Later (>24 months)"]].forEach(([id, label]) => {
      const col  = mk("div", "kanban-col");
      const head = mk("div", "kanban-col-head");
      head.innerHTML = `<span class="kanban-col-title">${label}</span><span class="kanban-col-count">${(byPhase[id]||[]).length}</span>`;
      col.appendChild(head);

      const body = mk("div", "kanban-col-body");
      (byPhase[id]||[]).forEach(gap => body.appendChild(buildCard(gap)));
      col.appendChild(body);
      board.appendChild(col);
    });
  }

  function buildCard(gap) {
    const card = mk("div", `gap-card${gap.id === selectedGapId ? " selected" : ""}`);
    const layerLabel = LAYERS.find(l => l.id === gap.layerId)?.label || gap.layerId;
    // v2.1 · derive Dell solutions chip from linked Dell desired tiles.
    const solutions = effectiveDellSolutions(gap, liveSession);
    card.innerHTML = `
      <div class="gap-card-title">${gap.description}</div>
      <div class="gap-card-meta">${layerLabel}${gap.gapType ? " · " + gap.gapType : ""}</div>
      <div class="gap-card-badges">
        <span class="urgency-badge ${urgClass(gap.urgency)}">${gap.urgency}</span>
        ${solutions.length ? `<span class="solutions-badge">${solutions[0]}</span>` : ""}
        ${gap.status === "closed" ? `<span class="status-badge">Closed</span>` : ""}
      </div>`;
    card.addEventListener("click", () => { selectedGapId = gap.id; renderAll(); });
    return card;
  }

  function renderDetail() {
    right.innerHTML = "";
    const gap = getFilteredGaps({}).find(g => g.id === selectedGapId);
    if (!gap) {
      right.innerHTML = `
        <div class="detail-placeholder">
          <div class="detail-ph-icon">◈</div>
          <div class="detail-ph-title">Select a gap</div>
          <div class="detail-ph-hint">Click any gap card to see details and mapped Dell solutions.</div>
        </div>`;
      return;
    }

    const panel = mk("div", "detail-panel");
    const layerLabel = LAYERS.find(l => l.id === gap.layerId)?.label || gap.layerId;
    const phaseLabel = { now:"Now (0–12 months)", next:"Next (12–24 months)", later:"Later (>24 months)" }[gap.phase] || gap.phase;

    const title = mk("div", "detail-title"); title.textContent = gap.description;
    const sub   = mk("div", "detail-sub");   sub.textContent   = `${phaseLabel} · ${layerLabel}`;
    panel.appendChild(title);
    panel.appendChild(sub);

    const badges = mk("div", "detail-badges");
    badges.innerHTML = `
      <span class="urgency-badge ${urgClass(gap.urgency)}">${gap.urgency}</span>
      ${gap.gapType ? `<span class="type-badge">${gap.gapType}</span>` : ""}
      <span class="status-badge">${gap.status || "open"}</span>`;
    panel.appendChild(badges);

    sep(panel, "Mapped Dell solutions");
    const sol = mk("div", "detail-text");
    const derived = effectiveDellSolutions(gap, liveSession);
    sol.textContent = derived.length ? derived.join(", ") : "No Dell solutions linked yet.";
    panel.appendChild(sol);

    // v2.4.12 · P3 · Services needed chip row on the Reporting Gaps Board
    // detail panel. Mirrors the Tab 4 gap-detail "Services needed" idea but
    // read-only here (Reporting is consumption-only, edits happen on Tab 4).
    sep(panel, "Services needed");
    const svcRow = mk("div", "detail-services-row");
    const svcs = Array.isArray(gap.services) ? gap.services : [];
    if (svcs.length === 0) {
      const empty = mk("span", "detail-text");
      empty.textContent = "No services attached yet.";
      svcRow.appendChild(empty);
    } else {
      svcs.forEach(function(sid) {
        const chip = mk("span", "services-chip");
        chip.textContent = serviceLabel(sid) || sid;
        svcRow.appendChild(chip);
      });
    }
    panel.appendChild(svcRow);

    sep(panel, "Business context & notes");
    const notes = mk("div", "detail-text");
    notes.textContent = gap.notes || "No additional context.";
    panel.appendChild(notes);

    const affLayers = gap.affectedLayers?.length
      ? gap.affectedLayers.map(id => LAYERS.find(l => l.id === id)?.label || id).join(", ")
      : layerLabel;
    sep(panel, "Affected layers");
    const al = mk("div", "detail-text"); al.textContent = affLayers; panel.appendChild(al);

    right.appendChild(panel);
  }

  renderAll();
}

function mk(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function sep(parent, title) { const s = mk("div","detail-sep"); s.textContent = title; parent.appendChild(s); }
function urgClass(u) { return u === "High" ? "urg-high" : u === "Low" ? "urg-low" : "urg-med"; }
