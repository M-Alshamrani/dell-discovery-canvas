// ui/views/SummaryServicesView.js , Phase 19l / v2.4.12
//
// Reporting → "Services scope" sub-tab. Workshop deliverable for the
// engagement-shape conversation: across the whole session, what
// professional-services work is needed, on which gaps, and across which
// projects. Roll-up is a read-only consequence of the per-gap chips
// users pick on Tab 4 + the SUGGESTED_SERVICES_BY_GAP_TYPE auto-map.

import { session } from "../../state/sessionStore.js";
import { buildProjects } from "../../services/roadmapService.js";
import { SERVICE_TYPES, serviceLabel } from "../../core/services.js";
import { helpButton } from "./HelpModal.js";

function mk(tag, cls)        { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
function mkt(tag, cls, text) { var e = mk(tag, cls); e.textContent = text; return e; }

// Build a roll-up: for each service id, the set of gap ids using it
// AND the set of project ids spanning it.
function rollupServices() {
  var gaps = (session.gaps || []).filter(function(g) { return g.status !== "closed"; });
  var projResult = buildProjects(session, {});
  var projects = projResult.projects || [];

  var rows = SERVICE_TYPES.map(function(svc) {
    var gapsUsing = gaps.filter(function(g) {
      return Array.isArray(g.services) && g.services.indexOf(svc.id) >= 0;
    });
    var projectsUsing = projects.filter(function(p) {
      return Array.isArray(p.services) && p.services.indexOf(svc.id) >= 0;
    });
    return {
      id:           svc.id,
      label:        svc.label,
      hint:         svc.hint,
      gapCount:     gapsUsing.length,
      projectCount: projectsUsing.length,
      projectNames: projectsUsing.map(function(p) { return p.name || p.label || p.projectId; })
    };
  });
  return { rows: rows, totalGaps: gaps.length, totalProjects: projects.length };
}

// Render the summary sentence: "Across N projects: X migrations · Y deployments · …"
// Only mentions services that have ≥1 gap using them, in catalog order.
function renderSummarySentence() {
  var ru = rollupServices();
  var bits = ru.rows
    .filter(function(r) { return r.gapCount > 0; })
    .map(function(r) { return r.gapCount + " " + r.label.toLowerCase().replace(/\s*\/\s*.*$/, ""); });
  if (bits.length === 0) {
    return "No services attached to any gap yet. Open a gap on Tab 4 → 'Services needed' to add chips.";
  }
  return "Across " + ru.totalProjects + " project" + (ru.totalProjects === 1 ? "" : "s") +
    ": " + bits.join(" · ") + ".";
}

export function renderSummaryServicesView(left, right) {
  // NOTE: do NOT clear left.innerHTML here , app.js appends the
  // sub-tab bar (#summary-tabs) into left BEFORE calling us, and
  // wiping left would erase the navigation. Other Summary views
  // follow the same convention (append-only on left).
  right.innerHTML = "";

  var ru = rollupServices();

  // ── Header card with summary sentence ──
  var headCard = mk("div", "card");
  var titleRow = mk("div", "card-title-row");
  titleRow.appendChild(mkt("div", "card-title", "Services scope"));
  titleRow.appendChild(helpButton("reporting_overview"));
  headCard.appendChild(titleRow);
  headCard.appendChild(mkt("div", "card-hint", renderSummarySentence()));
  left.appendChild(headCard);

  // ── Roll-up table ──
  var tableCard = mk("div", "card services-scope-table-card");
  tableCard.appendChild(mkt("div", "card-title", "Services breakdown"));

  var table = mk("table", "services-scope-table");
  var thead = mk("thead", "");
  var headRow = mk("tr", "");
  ["Service", "Gaps", "Projects", "Project names"].forEach(function(h) {
    headRow.appendChild(mkt("th", "", h));
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  var tbody = mk("tbody", "");
  // Only render rows for services that have ≥1 gap using them.
  var liveRows = ru.rows.filter(function(r) { return r.gapCount > 0; });
  if (liveRows.length === 0) {
    var emptyRow = mk("tr", "services-scope-empty-row");
    var emptyCell = mkt("td", "", "No services attached to any gap yet.");
    emptyCell.colSpan = 4;
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  } else {
    liveRows.forEach(function(r) {
      var row = mk("tr", "");
      var labelCell = mk("td", "");
      labelCell.appendChild(mkt("div", "services-scope-label", r.label));
      labelCell.appendChild(mkt("div", "services-scope-hint", r.hint));
      row.appendChild(labelCell);
      row.appendChild(mkt("td", "services-scope-num", String(r.gapCount)));
      row.appendChild(mkt("td", "services-scope-num", String(r.projectCount)));
      row.appendChild(mkt("td", "services-scope-projects", r.projectNames.join(" · ") || ","));
      tbody.appendChild(row);
    });
  }
  table.appendChild(tbody);
  tableCard.appendChild(table);
  left.appendChild(tableCard);

  // ── Right panel: hint card ──
  var hintCard = mk("div", "card");
  hintCard.appendChild(mkt("div", "card-title", "How this is computed"));
  hintCard.appendChild(mkt("div", "card-hint",
    "Each gap on Tab 4 carries an optional 'Services needed' multi-chip selector. " +
    "This table rolls those chips up across every open gap. Projects on Tab 5.5 'Roadmap' show their union of services beneath the Dell-solutions chips."));
  right.appendChild(hintCard);
}
