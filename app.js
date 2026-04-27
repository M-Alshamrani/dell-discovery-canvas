// app.js -- main router

import { session, resetSession, resetToDemo, saveToLocalStorage, replaceSession, migrateLegacySession } from "./state/sessionStore.js";
import { runAllTests }               from "./diagnostics/appSpec.js";
import { openSettingsModal }         from "./ui/views/SettingsModal.js";
import * as aiUndoStack              from "./state/aiUndoStack.js";
import { onSessionChanged, emitSessionChanged } from "./core/sessionEvents.js";
import { APP_VERSION }               from "./core/version.js";
import { loadAiConfig, saveAiConfig } from "./core/aiConfig.js";
import { loadSkills, saveSkills }    from "./core/skillStore.js";
import { getStatus as getSaveStatus, onStatusChange as onSaveStatusChange } from "./core/saveStatus.js";
import { buildSaveEnvelope, parseFileEnvelope, applyEnvelope, suggestFilename, FILE_MIME } from "./services/sessionFile.js";
import { renderContextView }         from "./ui/views/ContextView.js";
import { renderMatrixView }          from "./ui/views/MatrixView.js";
import { renderGapsEditView }        from "./ui/views/GapsEditView.js";
import { renderReportingOverview }   from "./ui/views/ReportingView.js";
import { renderSummaryHealthView }   from "./ui/views/SummaryHealthView.js";
import { renderSummaryGapsView }     from "./ui/views/SummaryGapsView.js";
import { renderSummaryVendorView }   from "./ui/views/SummaryVendorView.js";
import { renderSummaryRoadmapView }  from "./ui/views/SummaryRoadmapView.js";
import { openAiOverlay }             from "./ui/views/AiAssistOverlay.js";

// v2.5.0 TB6: stepper steps render with mono leading-zero pattern
// (01 Context, 02 Current State, ...). The label is just the readable
// name; renderStepper builds two-span markup so the leading number can
// be styled mono Dell-blue independently of the sentence-case label.
var STEPS = [
  { id: "context",   num: "01", label: "Context"       },
  { id: "current",   num: "02", label: "Current State" },
  { id: "desired",   num: "03", label: "Desired State" },
  { id: "gaps",      num: "04", label: "Gaps"          },
  { id: "reporting", num: "05", label: "Reporting"     }
];

// v2.4.13 S0: dropped the "Services scope" sub-tab. Per-gap and per-project
// services info already lives on the gap drawer body, the Roadmap project-
// card chip row, and the Tab 4 multi-chip selector. The standalone sub-tab
// added a navigation step without earning value.
var REPORTING_TABS = [
  { id: "overview", label: "Overview"   },
  { id: "health",   label: "Heatmap"    },
  { id: "gaps",     label: "Gaps Board" },
  { id: "vendor",   label: "Vendor Mix" },
  { id: "roadmap",  label: "Roadmap"    }
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
  wireTopbarAiBtn();
  // v2.4.13 S2A . repaint the secondary line whenever the save status
  // bus emits, so "Saving..." -> "Saved just now" without a full
  // re-render. Tick a 30s interval so "Saved 2m ago" keeps incrementing.
  onSaveStatusChange(renderSessionStripStatus);
  setInterval(renderSessionStripStatus, 30 * 1000);
  // v2.4.5 · every AI apply/undo + session reset routes through the
  // session-changed bus. The app shell re-renders header + current
  // tab so views pick up the live data (fixes the v2.4.4
  // "driver tile vanishes" + "tab blanks after undo" bugs).
  onSessionChanged(function() {
    renderHeaderMeta();
    renderStage();
  });
  // v2.4.11 · E1 · cross-tab navigation event. GapsEditView dispatches
  // this when the user clicks a linked-instance row in a gap's detail
  // panel. We switch to the right tab (current → Tab 2, desired → Tab 3)
  // and scroll the matching tile into view with a brief highlight.
  document.addEventListener("dell-canvas:navigate-to-tile", function(ev) {
    var d = ev.detail || {};
    if (!d.state || !d.instanceId) return;
    currentStep = (d.state === "current") ? "current" : "desired";
    renderStepper();
    renderStage();
    // After render, scroll + highlight on the next tick.
    setTimeout(function() {
      var sel = '[data-instance-id="' + d.instanceId + '"]';
      var node = document.querySelector(sel);
      if (node) {
        node.scrollIntoView({ block: "center", behavior: "smooth" });
        node.classList.add("nav-highlight");
        setTimeout(function() { node.classList.remove("nav-highlight"); }, 1800);
      }
    }, 50);
  });
  // v2.4.10 · If the user installed Canvas as a PWA and double-clicked
  // a .canvas file, Chromium's launchQueue delivers the file handle
  // here. We reuse the same openFileInput-change pipeline by routing
  // through a synthetic File → handleOpenedFile (set up in wireFooter).
  if ("launchQueue" in window && "files" in window.LaunchParams.prototype) {
    window.launchQueue.setConsumer(async function(launchParams) {
      if (!launchParams.files || !launchParams.files.length) return;
      for (var i = 0; i < launchParams.files.length; i++) {
        try {
          var handle = launchParams.files[i];
          var file = await handle.getFile();
          // Reuse footer's handler via a dispatched change event on
          // the hidden input. Keeps one code path for file loading.
          var input = document.getElementById("openFileInput");
          if (!input) return;
          // File input .files is read-only in HTML; use DataTransfer
          // to construct a FileList.
          var dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        } catch (e) {
          console.error("[launchQueue] failed to open file:", e);
        }
      }
    });
  }
  setTimeout(runAllTests, 150);
});

function wireSettingsBtn() {
  var btn = document.getElementById("settingsBtn");
  if (btn) btn.addEventListener("click", openSettingsModal);
}

// v2.4.13 S2 + S4 . global AI Assist button click handler. Statically
// imported so the click opens the overlay synchronously (VT25 contract).
// Overlay implementation lives in ui/views/AiAssistOverlay.js.
function wireTopbarAiBtn() {
  var btn = document.getElementById("topbarAiBtn");
  if (!btn) return;
  btn.addEventListener("click", function() {
    openAiOverlay({ tabId: currentStep, context: {} });
  });
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
    // v2.4.5 , tooltip lists what will be reverted in order.
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
  // v2.4.13 polish iter-2 . session strip rebuilt as a single
  // horizontal line with a vertical divider between primary identity
  // and save status. Drops the redundant "Workshop" eyebrow word; the
  // icon + name + divider + status reads cleanly without needing a
  // label. Layout:
  //   [icon] [customer name]  |  [dot] Saved 2m ago
  var el = document.getElementById("sessionMetaHeader");
  if (!el) {
    var verEl = document.getElementById("appVersionChip");
    if (verEl) verEl.textContent = "Canvas v" + APP_VERSION;
    return;
  }
  var customerName = (session.customer && session.customer.name) || "";
  var hasName      = !!customerName.trim();
  var isDemo       = !!session.isDemo;

  el.innerHTML = "";
  el.setAttribute("data-empty", hasName || isDemo ? "false" : "true");

  // Icon (briefcase / workshop glyph)
  var iconNS = "http://www.w3.org/2000/svg";
  var icon = document.createElementNS(iconNS, "svg");
  icon.setAttribute("class", "session-strip-icon");
  icon.setAttribute("width", "14");
  icon.setAttribute("height", "14");
  icon.setAttribute("viewBox", "0 0 16 16");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.5");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  var p1 = document.createElementNS(iconNS, "path");
  p1.setAttribute("d", "M2.5 5.5h11l-.5 7.5a1.5 1.5 0 0 1-1.5 1.4H4.5A1.5 1.5 0 0 1 3 13L2.5 5.5z");
  var p2 = document.createElementNS(iconNS, "path");
  p2.setAttribute("d", "M5.5 5.5V4a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 10.5 4v1.5");
  icon.appendChild(p1);
  icon.appendChild(p2);
  el.appendChild(icon);

  // Name
  var nameEl = document.createElement("span");
  nameEl.className = "session-strip-name";
  nameEl.textContent = hasName
    ? customerName
    : (isDemo ? "Demo session" : "New session");
  el.appendChild(nameEl);

  // Vertical divider
  var divider = document.createElement("span");
  divider.className = "session-strip-divider";
  divider.setAttribute("aria-hidden", "true");
  el.appendChild(divider);

  // Status (dot + text inline)
  var statusLine = document.createElement("span");
  statusLine.className = "session-strip-status";
  var dot = document.createElement("span");
  dot.className = "session-strip-dot";
  dot.setAttribute("aria-hidden", "true");
  statusLine.appendChild(dot);
  var statusText = document.createElement("span");
  statusText.className = "session-strip-status-text";
  statusLine.appendChild(statusText);
  el.appendChild(statusLine);

  renderSessionStripStatus();

  var verEl2 = document.getElementById("appVersionChip");
  if (verEl2) verEl2.textContent = "Canvas v" + APP_VERSION;
}

// v2.4.13 S2A . repaint just the secondary line. Called on every save-
// status emit and on a 30s interval so "Saved 2m ago" keeps incrementing.
//
// State priority (highest first):
//   isDemo=true                 -> "Demo session" / Dell-blue dot
//   status=saving (transient)   -> "Saving..."   / amber
//   status=saved + savedAt      -> "Saved Xs ago" / green
//   has customer name           -> "Not yet saved" / gray
//   nothing yet                 -> "Empty canvas" / gray
//
// isDemo precedes saving because demo state is stable (you're viewing
// example data); flipping a demo session to "Saving... -> Saved" on
// every emit would be misleading. Once the user types into Tab 1 the
// applyContextSave flips isDemo=false and the indicator normalizes.
function renderSessionStripStatus() {
  var statusLine = document.querySelector(".session-strip-status");
  if (!statusLine) return;
  var dot  = statusLine.querySelector(".session-strip-dot");
  var text = statusLine.querySelector(".session-strip-status-text");
  if (!dot || !text) return;

  var snap = getSaveStatus();
  var hasName = !!(session.customer && session.customer.name && session.customer.name.trim());
  var isDemo  = !!session.isDemo;
  var state   = "idle";
  var label   = "Empty canvas";

  if (isDemo) {
    state = "demo"; label = "Demo session";
  } else if (snap.status === "saving") {
    state = "saving"; label = "Saving...";
  } else if (snap.status === "saved" && snap.savedAt) {
    state = "saved"; label = "Saved " + relativeSavedAgo(snap.savedAt);
  } else if (hasName) {
    state = "saved"; label = "Not yet saved";
  } else {
    state = "idle"; label = "Empty canvas";
  }

  dot.setAttribute("data-state", state);
  text.textContent = label;
}

function relativeSavedAgo(ts) {
  var deltaMs = Date.now() - ts;
  if (deltaMs < 0) deltaMs = 0;
  var sec = Math.floor(deltaMs / 1000);
  if (sec < 5)   return "just now";
  if (sec < 60)  return sec + "s ago";
  var min = Math.floor(sec / 60);
  if (min < 60)  return min + "m ago";
  var hr  = Math.floor(min / 60);
  if (hr  < 24)  return hr + "h ago";
  var day = Math.floor(hr / 24);
  return day + "d ago";
}

function renderStepper() {
  var stepper = document.getElementById("stepper");
  if (!stepper) return;
  stepper.innerHTML = "";
  STEPS.forEach(function(step) {
    var div = document.createElement("div");
    div.className = "step" + (step.id === currentStep ? " active" : "");
    // v2.5.0 TB6: mono leading-zero number + sans sentence-case label.
    var num = document.createElement("span");
    num.className = "step-num";
    num.textContent = step.num;
    var lbl = document.createElement("span");
    lbl.className = "step-label";
    lbl.textContent = step.label;
    div.appendChild(num);
    div.appendChild(lbl);
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
    case "overview": renderReportingOverview(left, right);  break;
    case "health":   renderSummaryHealthView(left, right);  break;
    case "gaps":     renderSummaryGapsView(left, right);    break;
    case "vendor":   renderSummaryVendorView(left, right);  break;
    case "roadmap":  renderSummaryRoadmapView(left, right); break;
  }
}

function wireFooter() {
  var exportBtn    = document.getElementById("exportBtn");
  var openFileBtn  = document.getElementById("openFileBtn");
  var openFileIn   = document.getElementById("openFileInput");
  var demoBtn      = document.getElementById("demoBtn");
  var newSessionBtn= document.getElementById("newSessionBtn");
  var clearAllBtn  = document.getElementById("clearAllBtn");

  // v2.4.10 · "Save to file" (was "Export JSON"). Bundles session + skills
  // + provider config (keys opt-in) into a single .canvas file the user
  // can re-open later, back up, or hand to a colleague.
  if (exportBtn) {
    exportBtn.addEventListener("click", function() {
      openSaveDialog();
    });
  }

  // v2.4.10 · "Open file" , user selects a .canvas file, parser +
  // migrator apply the envelope, session-changed bus re-renders the app.
  if (openFileBtn && openFileIn) {
    openFileBtn.addEventListener("click", function() { openFileIn.click(); });
    openFileIn.addEventListener("change", function(ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      openFileIn.value = ""; // allow re-selecting the same file later
      handleOpenedFile(file);
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
  // which only empties the current session object , AI skills, provider
  // config, and undo history all survive resetSession. This button is
  // the deliberate "treat me like a brand-new user" escape hatch after
  // an upgrade, so users can see first-run UX changes (e.g. the v2.4.7
  // fresh-start welcome card) without reaching for DevTools.
  // v2.4.10 · Save dialog , opt-in checkbox for API keys.
  function openSaveDialog() {
    document.getElementById("save-dialog")?.remove();
    var overlay = document.createElement("div");
    overlay.id = "save-dialog";
    overlay.className = "dialog-overlay";
    var box = document.createElement("div");
    box.className = "dialog-box";
    box.innerHTML =
      '<div class="dialog-title">Save to file</div>' +
      '<p class="dialog-body">Saves your session, AI skills library, and provider settings to a <code>.canvas</code> file. Re-open it later, back it up, or share with a colleague.</p>' +
      '<label class="save-dialog-check"><input id="saveInclKeysChk" type="checkbox" /> ' +
      'Also include my AI provider API keys in the file' +
      '<span class="save-dialog-note">Default: off (keys stay on your machine). Tick only if you want the recipient to use your exact AI setup , anyone with the file can use your keys.</span>' +
      '</label>' +
      '<div class="form-actions">' +
      '<button id="saveDialogCancel" class="btn-secondary">Cancel</button>' +
      '<button id="saveDialogOk" class="btn-primary">↓ Save to file</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
    document.getElementById("saveDialogCancel").addEventListener("click", function() { overlay.remove(); });
    document.getElementById("saveDialogOk").addEventListener("click", function() {
      var includeApiKeys = document.getElementById("saveInclKeysChk").checked;
      var envelope = buildSaveEnvelope({
        session:        session,
        skills:         loadSkills(),
        providerConfig: loadAiConfig(),
        includeApiKeys: includeApiKeys
      });
      var blob = new Blob([JSON.stringify(envelope, null, 2)], { type: FILE_MIME });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement("a");
      a.href = url;
      a.download = suggestFilename(session);
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      overlay.remove();
    });
  }

  // v2.4.10 · Open-file flow. Reads the blob, parses, optionally
  // prompts the user to apply included API keys (only if file carried
  // them), migrates the session via the existing migrator chain, and
  // writes back to localStorage. Emits session-changed to refresh UI.
  function handleOpenedFile(file) {
    var reader = new FileReader();
    reader.onerror = function() { alert("Couldn't read the file. Is it readable?"); };
    reader.onload = function() {
      var env;
      try { env = parseFileEnvelope(String(reader.result || "")); }
      catch (e) { alert("Can't open this file:\n\n" + (e.message || String(e))); return; }

      var hasKeys = env.providerKeys && Object.keys(env.providerKeys).length > 0;
      var applyKeys = false;
      if (hasKeys) {
        applyKeys = confirm(
          "This file includes AI provider API keys. Apply them to your setup?\n\n" +
          "Click OK to replace your current API keys with the file's.\n" +
          "Click Cancel to keep your own keys (the file's are ignored)."
        );
      }

      var res;
      try { res = applyEnvelope(env, { applyApiKeys: applyKeys }); }
      catch (e) { alert("Can't apply this file:\n\n" + (e.message || String(e))); return; }

      // Replace the live session via sessionStore's replaceSession.
      replaceSession(res.session);
      saveToLocalStorage();
      // Replace skills.
      saveSkills(res.skills);
      // Provider config (possibly with keys merged in).
      if (res.providerConfig) saveAiConfig(res.providerConfig);

      emitSessionChanged("session-replace", "Opened " + (file.name || "file"));

      var msg = "Opened " + file.name + "\n\nSaved by: Canvas v" + res.savedAppVersion +
        (res.savedAt ? " at " + res.savedAt : "");
      if (res.warnings.length) msg += "\n\nNotes:\n  • " + res.warnings.join("\n  • ");
      // Non-blocking success , console + a brief toast would be nicer,
      // but alert is honest feedback for v2.4.10. v2.5.x can replace with
      // a toast.
      setTimeout(function() { alert(msg); }, 0);
    };
    reader.readAsText(file);
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", function() {
      if (!confirm(
        "Clear ALL app data and reload?\n\n" +
        "This wipes:\n" +
        "  • session (customer, drivers, instances, gaps)\n" +
        "  • AI skills library\n" +
        "  • AI provider config + API keys\n" +
        "  • Undo history\n\n" +
        "Cannot be undone. Use 'Save to file' first if you want a backup."
      )) return;
      try { localStorage.clear(); } catch (e) { /* private mode , ignore */ }
      // v2.4.10 · force a FRESH navigation (not just a cache-revalidating
      // reload) by appending a one-time query string. Some browsers skip
      // the module cache on location.reload() only in certain contexts;
      // a new href is unambiguous.
      window.location.href = window.location.pathname + "?cleared=" + Date.now();
    });
  }
}
