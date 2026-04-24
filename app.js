// app.js -- main router

import { session, resetSession, resetToDemo, saveToLocalStorage } from "./state/sessionStore.js";
import { runAllTests }               from "./diagnostics/appSpec.js";
import { openSettingsModal }         from "./ui/views/SettingsModal.js";
import * as aiUndoStack              from "./state/aiUndoStack.js";
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
  setTimeout(runAllTests, 150);
});

function wireSettingsBtn() {
  var btn = document.getElementById("settingsBtn");
  if (btn) btn.addEventListener("click", openSettingsModal);
}

function wireUndoBtn() {
  var btn = document.getElementById("undoBtn");
  if (!btn) return;
  function refresh() {
    if (aiUndoStack.canUndo()) {
      btn.style.display = "";
      btn.title = "Undo: " + (aiUndoStack.peekLabel() || "last AI change");
    } else {
      btn.style.display = "none";
    }
  }
  btn.addEventListener("click", function() {
    var entry = aiUndoStack.undoLast();
    if (!entry) return;
    // Re-render the current stage so any mutated view picks up the restored state.
    renderHeaderMeta();
    renderStage();
  });
  aiUndoStack.onUndoChange(refresh);
  refresh();
}

function renderHeaderMeta() {
  var el = document.getElementById("sessionMetaHeader");
  if (!el) return;
  var name   = session.customer.name || "New session";
  var date   = session.sessionMeta.date;
  var ver    = session.sessionMeta.version;
  var status = session.sessionMeta.status;
  el.textContent = name + "  |  " + date + "  |  v" + ver + "  |  " + status;
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
}
