// ui/views/SummaryHealthView.js -- bold heatmap redesign

import { LAYERS, ENVIRONMENTS } from "../../core/config.js";
import { session }              from "../../state/sessionStore.js";
import { getHealthSummary, computeBucketMetrics, scoreToRiskLabel, scoreToClass } from "../../services/healthMetrics.js";
import { helpButton } from "./HelpModal.js";
import { renderDemoBanner } from "../components/DemoBanner.js";

export function renderSummaryHealthView(left, right) {
  if (session && session.isDemo) renderDemoBanner(left);
  var s = getHealthSummary(session, LAYERS, ENVIRONMENTS);

  // Overview chips
  var overview = mk("div", "card");
  var titleRow = mk("div", "card-title-row");
  titleRow.appendChild(mkt("div", "card-title", "Architecture Heatmap"));
  titleRow.appendChild(helpButton("reporting_health"));
  overview.appendChild(titleRow);
  overview.appendChild(mkt("div", "card-hint",
    "Risk derived from current technology criticality and open gap urgency. Bold numbers = risk score. Click any cell for details."));

  var chipsRow = mk("div", "chips-row");
  var stats = [
    [s.totalBuckets,   "buckets (layers x envs)"],
    [s.totalCurrent,   "current technologies"],
    [s.totalDesired,   "desired technologies"],
    [s.totalGaps,      "total gaps"],
    [s.highRiskGaps,   "High-urgency gaps"]
  ];
  stats.forEach(function(st) {
    var cls = (st[1].indexOf("High") >= 0 && st[0] > 0) ? "chip-stat chip-danger" : "chip-stat";
    chipsRow.appendChild(mkt("span", cls, st[0] + " " + st[1]));
  });
  overview.appendChild(chipsRow);

  // Legend
  var legend = mk("div", "heatmap-legend");
  legend.style.marginTop = "10px";
  [
    ["#DCFCE7","1-3: Minor"],
    ["#FEF9C3","4-6: Moderate"],
    ["#FEE2E2","7+: High risk"],
    ["#F3F4F6","No data"]
  ].forEach(function(l) {
    var item = mk("div", "heatmap-legend-item");
    var sw = mk("div", "heatmap-legend-swatch");
    sw.style.background = l[0];
    item.appendChild(sw);
    item.appendChild(mkt("span", "", l[1]));
    legend.appendChild(item);
  });
  overview.appendChild(legend);
  left.appendChild(overview);

  // Heatmap grid
  var heatCard = mk("div", "card");
  var wrap = mk("div", "matrix-scroll-wrap");
  var grid = mk("div", "heatmap-grid");
  grid.style.gridTemplateColumns = "160px repeat(" + ENVIRONMENTS.length + ", 1fr)";

  // Header row - dark background with white text
  grid.appendChild(mk("div", "hm-corner"));
  ENVIRONMENTS.forEach(function(env) {
    grid.appendChild(mkt("div", "hm-env-header", env.label));
  });

  var selectedLayer = null;
  var selectedEnv   = null;

  LAYERS.forEach(function(layer) {
    grid.appendChild(mkt("div", "hm-layer-label", layer.label));
    ENVIRONMENTS.forEach(function(env) {
      var m = computeBucketMetrics(layer.id, env.id, session);
      var cell = mk("div", "hm-cell " + scoreToClass(m.totalScore, m.hasData));
      cell.setAttribute("data-layer-id", layer.id);
      cell.setAttribute("data-env-id",   env.id);

      // Score number (primary visual)
      var scoreEl = mk("div", "hm-score");
      scoreEl.textContent = m.hasData && m.totalScore > 0 ? Math.round(m.totalScore) : "-";
      cell.appendChild(scoreEl);

      // Risk label
      cell.appendChild(mkt("div", "hm-label", scoreToRiskLabel(m.totalScore, m.hasData)));

      // Footer pills
      if (m.hasData) {
        var footer = mk("div", "hm-cell-footer");
        if (m.current.length > 0) {
          footer.appendChild(mkt("span", "hm-pill hm-pill-tech", m.current.length + " tech"));
        }
        if (m.gaps.length > 0) {
          footer.appendChild(mkt("span", "hm-pill hm-pill-gap", m.gaps.length + " gap" + (m.gaps.length > 1 ? "s" : "")));
        }
        cell.appendChild(footer);
      }

      cell.addEventListener("click", function() {
        selectedLayer = layer.id;
        selectedEnv   = env.id;
        grid.querySelectorAll(".hm-cell").forEach(function(c) {
          c.classList.toggle("selected",
            c.getAttribute("data-layer-id") === layer.id &&
            c.getAttribute("data-env-id")   === env.id);
        });
        renderDetail(right, layer.id, env.id);
      });
      grid.appendChild(cell);
    });
  });

  wrap.appendChild(grid);
  heatCard.appendChild(wrap);
  left.appendChild(heatCard);

  // Right panel default
  right.innerHTML = "";
  right.appendChild(buildPlaceholder());

  // Auto-select first non-empty cell
  for (var li = 0; li < LAYERS.length; li++) {
    for (var ei = 0; ei < ENVIRONMENTS.length; ei++) {
      var m2 = computeBucketMetrics(LAYERS[li].id, ENVIRONMENTS[ei].id, session);
      if (m2.hasData) {
        selectedLayer = LAYERS[li].id;
        selectedEnv   = ENVIRONMENTS[ei].id;
        var firstCell = grid.querySelector("[data-layer-id='" + LAYERS[li].id + "'][data-env-id='" + ENVIRONMENTS[ei].id + "']");
        if (firstCell) firstCell.classList.add("selected");
        renderDetail(right, LAYERS[li].id, ENVIRONMENTS[ei].id);
        return;
      }
    }
  }
}

function renderDetail(right, layerId, envId) {
  right.innerHTML = "";
  var layer   = LAYERS.find(function(l) { return l.id === layerId; });
  var env     = ENVIRONMENTS.find(function(e) { return e.id === envId; });
  var m       = computeBucketMetrics(layerId, envId, session);
  var desired = (session.instances || []).filter(function(i) {
    return i.state === "desired" && i.layerId === layerId && i.environmentId === envId;
  });

  var panel = mk("div", "detail-panel");

  // Header with risk badge
  panel.appendChild(mkt("div", "detail-title", (layer && layer.label) || layerId));
  panel.appendChild(mkt("div", "detail-sub",   (env   && env.label)   || envId));

  if (m.hasData) {
    var riskBadge = mk("span", "urgency-badge " + riskBadgeClass(m.totalScore));
    riskBadge.textContent = scoreToRiskLabel(m.totalScore, m.hasData) + " (score: " + Math.round(m.totalScore) + ")";
    panel.appendChild(riskBadge);
  }

  // Score breakdown
  if (m.hasData) {
    var breakdown = mk("div", "score-breakdown");
    breakdown.innerHTML = "Criticality score: <strong>" + m.currentScore.toFixed(1) + "</strong>  |  Gap urgency score: <strong>" + m.gapScore.toFixed(1) + "</strong>";
    panel.appendChild(breakdown);
  }

  sep(panel, "Current technologies");
  if (!m.current.length) {
    note(panel, "None mapped.");
  } else {
    var sorted = m.current.slice().sort(function(a,b) {
      var order = {High:0, Medium:1, Low:2};
      return (order[a.criticality||"Low"]||2) - (order[b.criticality||"Low"]||2);
    });
    sorted.forEach(function(i) {
      var row = mk("div", "detail-row");
      var dot = mk("span", "tile-dot " + (i.vendorGroup || "custom")); row.appendChild(dot);
      row.appendChild(mkt("span", "detail-row-label", i.label));
      if (i.criticality) {
        row.appendChild(mkt("span", "urgency-badge " + critClass(i.criticality), i.criticality));
      }
      if (i.notes) row.appendChild(mkt("div", "detail-note", i.notes));
      panel.appendChild(row);
    });
  }

  sep(panel, "Active gaps");
  if (!m.gaps.length) {
    note(panel, "No gaps for this area.");
  } else {
    m.gaps.forEach(function(g) {
      var row = mk("div", "detail-row");
      row.appendChild(mkt("span", "urgency-badge " + urgClass(g.urgency), g.urgency));
      row.appendChild(mkt("span", "detail-row-label", g.description));
      if (g.mappedDellSolutions) {
        row.appendChild(mkt("div", "detail-solutions", "Dell: " + g.mappedDellSolutions));
      }
      panel.appendChild(row);
    });
  }

  sep(panel, "Desired state");
  if (!desired.length) {
    note(panel, "None mapped yet.");
  } else {
    desired.forEach(function(i) {
      var row = mk("div", "detail-row");
      var dot = mk("span", "tile-dot " + (i.vendorGroup || "custom")); row.appendChild(dot);
      row.appendChild(mkt("span", "detail-row-label", i.label));
      if (i.disposition) {
        row.appendChild(mkt("span", "disposition-badge badge-" + i.disposition, i.disposition));
      } else if (i.priority) {
        row.appendChild(mkt("span", "priority-badge priority-" + i.priority.toLowerCase(), i.priority));
      }
      panel.appendChild(row);
    });
  }

  right.appendChild(panel);
}

function buildPlaceholder() {
  var ph = mk("div", "detail-placeholder");
  ph.appendChild(mkt("div", "detail-ph-icon", "[]"));
  ph.appendChild(mkt("div", "detail-ph-title", "Select a cell"));
  ph.appendChild(mkt("div", "detail-ph-hint", "Click any coloured cell to see current technologies, active gaps, and the desired state for that layer and environment."));
  return ph;
}

function mk(tag,cls)        { var e=document.createElement(tag); if(cls)e.className=cls; return e; }
function mkt(tag,cls,text)  { var e=mk(tag,cls); e.textContent=text; return e; }
function sep(p,t)           { p.appendChild(mkt("div","detail-sep",t)); }
function note(p,t)          { p.appendChild(mkt("div","detail-note muted",t)); }
function urgClass(u)        { return u==="High"?"urg-high":u==="Low"?"urg-low":"urg-med"; }
function critClass(c)       { return c==="High"?"urg-high":c==="Low"?"urg-low":"urg-med"; }
function riskBadgeClass(sc) { return sc>6?"urg-high":sc>3?"urg-med":"urg-low"; }
