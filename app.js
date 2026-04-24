// app.js -- main router

import { session, resetSession, resetToDemo, saveToLocalStorage } from "./state/sessionStore.js";
import { runAllTests }               from "./diagnostics/appSpec.js";
import { openSettingsModal }         from "./ui/views/SettingsModal.js";
import * as aiUndoStack              from "./state/aiUndoStack.js";
import { onSessionChanged }          from "./core/sessionEvents.js";
import { APP_VERSION }               from "./core/version.js";
import { renderContextView }         from "./ui/views/ContextView.js";
import { renderMatrixView }          from "./ui/views/MatrixView.js";
import { renderGapsEditView }        from "./ui/views/GapsEditView.js";
import { renderReportingOverview }   from "./ui/views/ReportingView.js";
import { renderSummaryHealthView }   from "./ui/views/SummaryHealthView.js";
import { renderSummaryGapsView }     from "./ui/views/SummaryGapsView.js";
import { renderSummaryVendorView }   from "./ui/views/SummaryVendorView.js";
import { renderSummaryRoadmapView }  from "./ui/views/SummaryRoadmapView.js";

var STEPS = [
  { id: "context",   label: "1  Context"       },
  { id: "current",   label: "2  Current State"  },
  { id: "desired",   label: "3  Desired State"  },
  { id: "gaps",      label: "4  Gaps"           },
  { id: "reporting", label: "5  Reporting"      }
];

var REPORTING_TABS = [
  { id: "overview", label: "Overview"    },
  { id: "health",   label: "Heatmap"     },
  { id: "gaps",     label: "Gaps Board"  },
  { id: "vendor",   label: "Vendor Mix"  },
  { id: "roadmap",  label: "Roadmap"     }
];

var currentStep         = "context";
var currentReportingTab = "overview";

window.renderStepperForTests = renderStepper;

document.addEventListener("DOMContentLoaded", function() {
  renderHeaderMeta();
  renderStepper();
  renderStage();
  wireFooter();
  wireSettingsBtn();
  wireUndoBtn();
  // v2.4.5 · every AI apply/undo + session reset routes through the
  // session-changed bus. The app shell re-renders header + current
  // tab so views pick up the live data (fixes the v2.4.4
  // "driver tile vanishes" + "tab blanks after undo" bugs).
  onSessionChanged(function() {
    renderHeaderMeta();
    renderStage();
  });
  setTimeout(runAllTests, 150);
});

function wireSettingsBtn() {
  var btn = document.getElementById("settingsBtn");
  if (btn) btn.addEventListener("click", openSettingsModal);
}

function wireUndoBtn() {
  var btn      = document.getElementById("undoBtn");
  var allBtn   = document.getElementById("undoAllBtn");
  var countEl  = document.getElementById("undoCountBadge");
  if (!btn) return;

  function refresh() {
    var depth = aiUndoStack.depth();
    if (depth === 0) {
      btn.style.display = "none";
      if (allBtn) allBtn.style.display = "none";
      return;
    }
    btn.style.display = "";
    // v2.4.5 — tooltip lists what will be reverted in order.
    var labels = aiUndoStack.recentLabels(5);
    var tooltipLines = ["Undo last (" + depth + " AI change" + (depth === 1 ? "" : "s") + " tracked):"];
    labels.forEach(function(l, i) { tooltipLines.push((i + 1) + ". " + l); });
    if (depth > labels.length) tooltipLines.push("… + " + (depth - labels.length) + " older");
    btn.title = tooltipLines.join("\n");
    if (countEl) countEl.textContent = String(depth);

    if (allBtn) {
      if (depth >= 2) {
        allBtn.style.display = "";
        allBtn.title = "Revert ALL " + depth + " tracked AI change" + (depth === 1 ? "" : "s");
      } else {
        allBtn.style.display = "none";
      }
    }
  }

  btn.addEventListener("click", function() {
    var entry = aiUndoStack.undoLast();
    if (!entry) return;
    // onSessionChanged listener re-renders; no direct render call needed.
  });

  if (allBtn) {
    allBtn.addEventListener("click", function() {
      if (aiUndoStack.depth() < 2) return;
      if (!confirm("Revert ALL " + aiUndoStack.depth() + " tracked AI changes? This cannot itself be undone.")) return;
      aiUndoStack.undoAll();
    });
  }

  aiUndoStack.onUndoChange(refresh);
  refresh();
}

function renderHeaderMeta() {
  // v2.4.6 · L4 · split the header into TWO chips:
  //   - session identity: customer | date | status
  //   - app version: "Canvas v{{APP_VERSION}}" (separate <span> so
  //     nobody confuses the session-schema version with the app build)
  var el = document.getElementById("sessionMetaHeader");
  if (el) {
    var name   = session.customer.name || "New session";
    var date   = session.sessionMeta.date;
    var status = session.sessionMeta.status;
    el.textContent = name + "  |  " + date + "  |  " + status;
  }
  var verEl = document.getElementById("appVersionChip");
  if (verEl) verEl.textContent = "Canvas v" + APP_VERSION;
}

function renderStepper() {
  var stepper = document.getElementById("stepper");
  if (!stepper) return;
  stepper.innerHTML = "";
  STEPS.forEach(function(step) {
    var div = document.createElement("div");
    div.className = "step" + (step.id === currentStep ? " active" : "");
    div.textContent = step.label;
    div.addEventListener("click", function() {
      saveToLocalStorage();
      currentStep = step.id;
      renderStepper();
      renderStage();
    });
    stepper.appendChild(div);
  });
}
export { renderStepper };

function renderStage() {
  var left  = document.getElementById("main-left");
  var right = document.getElementById("main-right");
  if (!left || !right) return;
  left.innerHTML  = "";
  right.innerHTML = "";

  switch (currentStep) {
    case "context":   renderContextView(left, right, session);                          break;
    case "current":   renderMatrixView(left, right, session, { stateFilter:"current"}); break;
    case "desired":   renderMatrixView(left, right, session, { stateFilter:"desired"}); break;
    case "gaps":      renderGapsEditView(left, right, session);                         break;
    case "reporting": renderReportingStep(left, right);                                 break;
  }
}

function renderReportingStep(left, right) {
  // Sub-tab bar
  var tabBar = document.createElement("div");
  tabBar.id = "summary-tabs";

  REPORTING_TABS.forEach(function(tab) {
    var btn = document.createElement("div");
    btn.className = "summary-tab" + (tab.id === currentReportingTab ? " active" : "");
    btn.textContent = tab.label;
    btn.addEventListener("click", function() {
      currentReportingTab = tab.id;
      left.innerHTML  = "";
      right.innerHTML = "";
      left.appendChild(tabBar);
      tabBar.querySelectorAll(".summary-tab").forEach(function(b) {
        b.classList.toggle("active", b.textContent === tab.label);
      });
      renderReportingTab(left, right);
    });
    tabBar.appendChild(btn);
  });

  left.appendChild(tabBar);
  renderReportingTab(left, right);
}

function renderReportingTab(left, right) {
  switch (currentReportingTab) {
    case "overview": renderReportingOverview(left, right); break;
    case "health":   renderSummaryHealthView(left, right); break;
    case "gaps":     renderSummaryGapsView(left, right);   break;
    case "vendor":   renderSummaryVendorView(left, right); break;
    case "roadmap":  renderSummaryRoadmapView(left, right);break;
  }
}

function wireFooter() {
  var exportBtn    = document.getElementById("exportBtn");
  var demoBtn      = document.getElementById("demoBtn");
  var newSessionBtn= document.getElementById("newSessionBtn");
  var clearAllBtn  = document.getElementById("clearAllBtn");

  if (exportBtn) {
    exportBtn.addEventListener("click", function() {
      var blob = new Blob([JSON.stringify(session, null, 2)], { type:"application/json" });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement("a");
      a.href = url;
      a.download = (session.customer.name || "session").replace(/\s+/g, "-").toLowerCase()
        + "-" + session.sessionId + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });
  }

  if (demoBtn) {
    demoBtn.addEventListener("click", function() {
      if (!confirm("Reset to demo session? Current data will be lost.")) return;
      resetToDemo();
      currentStep = "reporting"; currentReportingTab = "overview";
      renderHeaderMeta(); renderStepper(); renderStage();
    });
  }

  if (newSessionBtn) {
    newSessionBtn.addEventListener("click", function() {
      if (!confirm("Start a fresh session? Current data will be lost.")) return;
      resetSession();
      currentStep = "context"; currentReportingTab = "overview";
      renderHeaderMeta(); renderStepper(); renderStage();
    });
  }

  // v2.4.9 · "Clear all data" · wipes every dell_discovery_* and ai_*
  // localStorage key and reloads the page. Distinct from "+ New session",
  // which only empties the current session object — AI skills, provider
  // config, and undo history all survive resetSession. This button is
  // the deliberate "treat me like a brand-new user" escape hatch after
  // an upgrade, so users can see first-run UX changes (e.g. the v2.4.7
  // fresh-start welcome card) without reaching for DevTools.
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", function() {
      if (!confirm(
        "Clear ALL app data and reload?\n\n" +
        "This wipes:\n" +
        "  • session (customer, drivers, instances, gaps)\n" +
        "  • AI skills library\n" +
        "  • AI provider config + API keys\n" +
        "  • Undo history\n\n" +
        "Cannot be undone. Use 'Export JSON' first if you want a backup."
      )) return;
      try { localStorage.clear(); } catch (e) { /* private mode — ignore */ }
      location.reload();
    });
  }
}
