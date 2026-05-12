// app.js -- main router

// rc.7 / 7e-8a · migrateLegacySession dropped from import (unused since
// 7e-7 retired the runtime v2 migrator). Remaining sessionStore imports
// (session, resetSession, resetToDemo, saveToLocalStorage, replaceSession)
// migrate to engagementStore in a subsequent v2-deletion sub-arc per
// SPEC §S40 deletion-readiness checklist.
// rc.7 / 7e-8c..d · trimmed v2 sessionStore imports.
//   - `session` dropped (7e-8c): 5 read sites + 2 buildSaveEnvelope arg
//     sites migrated to getActiveEngagement() (+ engagementToV2Session
//     at the v2-shape file boundary).
//   - `saveToLocalStorage` dropped (7e-8c): v3 engagementStore auto-
//     persists on every commit, so the explicit v2 persistence calls
//     became no-ops (stepper click, demo loader, file-open).
//   - `resetToDemo` dropped (7e-8c): was imported but never called.
//   - `replaceSession` dropped (7e-8d-1): file-open path now translates
//     the v2 session returned by applyEnvelope through the runtime
//     v2→v3 migrator (state/runtimeMigrate.js) and writes directly to
//     v3 engagementStore via setActiveEngagement. Closes the latent
//     file-open data-loss bug where the bridge's customer-only shallow
//     merge dropped instances/gaps/envs from a loaded .canvas file.
//   - `resetSession` retained for now: the bridge's session-reset
//     handler (chat memory clear + v3 engagement reset) needs inlining
//     at the call site before this can drop. Coming in 7e-8d-2.
// rc.7 / 7e-8d-2 · resetSession dropped from v2 sessionStore imports.
// The bridge's session-reset handler (chat memory clear + v3 engagement
// reset + AI undo clear + session-changed emit) is now inlined at the
// newSessionBtn click site below. v2 sessionStore now has ZERO live
// imports from app.js -- only the side-effect import of sessionBridge.js
// (line ~30) remains, which itself drops in 7e-8d-3.
import { engagementToV2Session } from "./state/legacySessionAdapter.js";
// rc.7 / 7e-8 redo Step B · translateV2SessionToV3Engagement no longer
// imported here. The translation lives inside services/sessionFile.js
// applyEnvelope, which now returns a v3 engagement directly. app.js
// stays oblivious to the file-format-on-the-wire being v2.
import { createEmptyEngagement } from "./schema/engagement.js";
import { clearTranscript } from "./state/chatMemory.js";
import { runAllTests }               from "./diagnostics/appSpec.js";
import { openSettingsModal }         from "./ui/views/SettingsModal.js";
import * as aiUndoStack              from "./state/aiUndoStack.js";
// rc.7 / 7e-8 redo Step G · onSessionChanged dropped (shell repaint
// migrated to subscribeActiveEngagement on the v3 engagementStore).
// rc.7 / 7e-8 Step K · core/sessionEvents.js DELETED. The only role
// emitSessionChanged still played in app.js was pulsing markSaving()
// on demo / reset / file-open. setActiveEngagement(eng) handles
// re-render via subscribeActiveEngagement (Step G); markSaving() is
// called directly at each of those 3 sites for the topbar pulse.
// rc.7 / 7e-8c'-impl · stepper greys Tabs 4/5 when visibleEnvCount===0 per SPEC §S41.2.
// rc.7 / 7e-8d-1 · setActiveEngagement also imported here (file-open path).
import { getActiveEngagement, setActiveEngagement, subscribeActiveEngagement } from "./state/engagementStore.js";
import { visibleEnvCount } from "./ui/components/NoEnvsCard.js";
import { APP_VERSION }               from "./core/version.js";
import { loadAiConfig, saveAiConfig } from "./core/aiConfig.js";
import { loadSkills, saveSkills }    from "./core/skillStore.js";
// rc.7 / 7e-9b · BUG-B regression fix · markSaving import dropped from
// app.js call sites (was overriding the markSaved() that engagementStore
// _persist now fires; left header capsule stuck on 'Saving...' forever).
// _persist drives the state machine end-to-end now; production code paths
// don't need to manually pulse 'saving'.
import { getStatus as getSaveStatus, onStatusChange as onSaveStatusChange } from "./core/saveStatus.js";
// v2.4.15 . eagerly load filterState so its module-init applyToBody()
// restores the user's saved body[data-filter-<dim>] attributes on app
// boot, before the user navigates to a tab that uses FilterBar.
import "./state/filterState.js";
// rc.7 / 7e-8 redo Step G · state/sessionBridge.js DELETED.
// (Was: SPEC §S19.3 co-existence bridge -- v2 session-changed -> v3
// engagement customer-only shallow merge + v3 -> v2 mirror loop for
// non-migrated v2 view tabs.) With v2 views fully migrated to v3-native
// reads (rc.7 / 7e-3..7) and v2 admin retired (Step E + Step F), no
// production reader of liveSession remains and the mirror is dead
// weight. The bridge's session-reset chat-clear contract is inlined at
// the newSessionBtn handler below; the bridge's boot-seed is inlined
// in DOMContentLoaded so the v3 store is non-null after first paint.
// Authority: SPEC §S40.4 F40.4.2 (no v2 bridge in v3-pure architecture).
import { confirmAction, notifyError, notifyInfo, notifySuccess } from "./ui/components/Notify.js";
// SPEC §S47.8 · Import data modal (Path B · Dell internal LLM workflow).
import { openImportDataModal } from "./ui/components/ImportDataModal.js";
import { buildSaveEnvelope, parseFileEnvelope, applyEnvelope, suggestFilename, FILE_MIME } from "./services/sessionFile.js";
import { renderContextView }         from "./ui/views/ContextView.js";
import { renderMatrixView }          from "./ui/views/MatrixView.js";
import { renderGapsEditView }        from "./ui/views/GapsEditView.js";
import { renderReportingOverview }   from "./ui/views/ReportingView.js";
import { renderSummaryHealthView }   from "./ui/views/SummaryHealthView.js";
import { renderSummaryGapsView }     from "./ui/views/SummaryGapsView.js";
import { renderSummaryVendorView }   from "./ui/views/SummaryVendorView.js";
import { renderSummaryRoadmapView }  from "./ui/views/SummaryRoadmapView.js";
// rc.5 §S36.2 R36.9 (V-AI-ASSIST-DORMANT-1): the legacy AiAssistOverlay
// tile-grid is RETIRED from production. Cmd+K rebound to openCanvasChat
// in rc.4 Arc 2; the file remains on disk as a dormant module per
// project_v2x_admin_deferred.md but no production .js file imports it.
// (Was: `import { openAiOverlay } from "./ui/views/AiAssistOverlay.js";`)

// v2.5.0 TB6: stepper steps render with mono leading-zero pattern
// (01 Context, 02 Current State, ...). The label is just the readable
// name; renderStepper builds two-span markup so the leading number can
// be styled mono Dell-blue independently of the sentence-case label.
var STEPS = [
  { id: "context",   num: "01", label: "Context"       },
  { id: "current",   num: "02", label: "Current state" },
  { id: "desired",   num: "03", label: "Desired state" },
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
  { id: "gaps",     label: "Gaps board" },
  { id: "vendor",   label: "Vendor mix" },
  { id: "roadmap",  label: "Roadmap"    }
];

var currentStep         = "context";
var currentReportingTab = "overview";

window.renderStepperForTests = renderStepper;

document.addEventListener("DOMContentLoaded", function() {
  // rc.7 / 7e-8 redo Step G · boot-seed the v3 engagement store. Pre-Step
  // G this was sessionBridge.bridgeOnce("boot")'s job: if no engagement
  // exists yet (cold boot, no localStorage), seed an empty v3 engagement
  // so views render against a stable shape (vs. null) from first paint.
  // engagementStore._rehydrateFromStorage runs at module load and either
  // restores a persisted engagement or leaves _active null; we close that
  // null-window here. setActiveEngagement persists the seed so subsequent
  // reloads skip this branch.
  if (!getActiveEngagement()) {
    setActiveEngagement(createEmptyEngagement());
  }
  // SPEC §S47.7 - warm the system-skills cache once so synchronous
  // launcher / SkillBuilder renderers can read the merged set via
  // loadAllV3SkillsSync(). Non-blocking: render proceeds immediately;
  // when the cache resolves the next paint picks up system skills.
  // The Canvas Chat overlay re-paints on open, so any open-after-boot
  // sees the system slice; first-paint racers are rare (the cache fills
  // within ~50ms of a 200 from /catalogs/skills/file-ingest-instances.json).
  import("./state/v3SkillStore.js").then(function(mod) {
    mod.preloadSystemSkills();
  });
  renderHeaderMeta();
  renderStepper();
  renderStage();
  wireFooter();
  wireSettingsBtn();
  wireUndoBtn();
  wireTopbarAiBtn();
  wireAiAssistShortcut();
  wireTopbarLabBtn();
  // v2.4.13 S2A . repaint the secondary line whenever the save status
  // bus emits, so "Saving..." -> "Saved just now" without a full
  // re-render. Tick a 30s interval so "Saved 2m ago" keeps incrementing.
  onSaveStatusChange(renderSessionStripStatus);
  onSaveStatusChange(updateTabTitle);
  setInterval(renderSessionStripStatus, 30 * 1000);
  updateTabTitle();
  // rc.7 / 7e-8 redo Step G · v3-pure shell-repaint listener.
  // Pre-Step G this was onSessionChanged from core/sessionEvents.js (the
  // legacy "session-changed" bus). With sessionBridge deleted and v2 views
  // retired, the v3 engagementStore IS the source of truth: every
  // commitAction success + every setActiveEngagement (demo loader, +New
  // session, file-open, AI undo) emits to subscribeActiveEngagement.
  // Subscribing here repaints header + stepper + current tab whenever
  // the v3 store mutates -- the v3-pure analogue of the prior bus.
  // This is wider than the old emitSessionChanged-only triggers (every
  // entity write now repaints the shell), but views are designed for
  // re-mount on engagement change per SPEC §S19.3.
  // rc.7 / 7e-8c'-impl carry-over · stepper re-renders so Tab 4/5
  // disabled state stays in sync with visibleEnvCount changes.
  //
  // rc.7 / 7e-8 post-Step-K · expose the shell-render function as
  // window.__shellRenderSubscriber so the testRunner afterRestore can
  // re-register it after _resetEngagementStoreForTests() has wiped
  // _subs between tests. Without this re-registration, BUG-043 surfaces:
  // welcome-card "Load demo session" click mutates engagement state,
  // but no subscriber is alive to repaint the shell, so Tab 1 shows
  // the stale empty-canvas welcome card on top of Acme demo data.
  // subscribeActiveEngagement uses a Set, so re-adding the same fn
  // reference from afterRestore is idempotent.
  window.__shellRenderSubscriber = function() {
    renderHeaderMeta();
    renderStepper();
    renderStage();
  };
  subscribeActiveEngagement(window.__shellRenderSubscriber);
  // rc.7 / 7e-8c'-fix · the original 7e-8c'-impl shipped a CTA button
  // inside the NoEnvsCard that emitted "dell-canvas:navigate-to-tab"
  // for the app shell to consume. The button was dropped (Tab 1 is one
  // click away in the stepper; an in-card button was redundant + the
  // host-class mutation it depended on broke Context layout). The
  // listener went with it.

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
  // BUG-C closure (rc.7 / 7e-9 · 2026-05-09) · test-runner opt-in gate.
  // Pre-fix tests auto-ran on every page load (~70-80s, mutates
  // engagementStore via _resetEngagementStoreForTests + setActiveEngagement).
  // Production users clicking Load demo / interacting mid-run got race
  // conditions ("2 errors during Load demo" reported 2026-05-09). Per
  // user direction "all validations can be monitored somehow without
  // disturbing production": tests now require explicit opt-in.
  //
  // Three triggers (any one suffices):
  //   1. URL query param ?runTests=1     . single-session opt-in
  //   2. localStorage.runTestsOnBoot=="1" . persistent opt-in (QA workflow)
  //   3. window.runDellDiscoveryTests()  . manual trigger from console
  //
  // Production users see no test pass; QA explicit opt-in via either
  // mechanism. window export always available so a stuck-state user can
  // run the suite from devtools without rebuilding.
  window.runDellDiscoveryTests = runAllTests;
  var _testsOptIn = false;
  try {
    var _url = new URL(location.href);
    if (_url.searchParams.get("runTests") === "1") _testsOptIn = true;
  } catch (_e) { /* defensive */ }
  try {
    if (localStorage.getItem("runTestsOnBoot") === "1") _testsOptIn = true;
  } catch (_e) { /* defensive · private-mode / disabled storage */ }
  if (_testsOptIn) {
    setTimeout(runAllTests, 150);
  } else {
    console.log("[diagnostics] tests skipped on boot. Run with ?runTests=1 in URL, or call window.runDellDiscoveryTests() from devtools, or set localStorage.setItem('runTestsOnBoot','1') to opt in persistently.");
  }
});

function wireSettingsBtn() {
  var btn = document.getElementById("settingsBtn");
  if (btn) btn.addEventListener("click", openSettingsModal);
}

// rc.3 #7 (SPEC §S29.7) - Skill Builder access moved off the topbar
// into a "+ Author new skill" affordance inside the Canvas Chat right-
// rail. The topbar surface had three buttons (AI Assist + Skill Builder
// + Chat); the Chat surface (with its right-rail saved-skill cards from
// rc.3 #5) now subsumes both AI invocation paths. The shared open-
// Skill-Builder entry point lives in ./ui/skillBuilderOpener.js.
import { openSkillBuilderOverlay } from "./ui/skillBuilderOpener.js";

// Topbar wiring kept null-safe - the buttons are removed from index.html
// in rc.3 #7 but these functions stay defined so older bookmarks /
// integration tests that look up the elements don't blow up.
function wireTopbarLabBtn() {
  var btn = document.getElementById("topbarLabBtn");
  if (!btn) return;
  btn.addEventListener("click", openSkillBuilderOverlay);
}

// rc.3 #7 + #13 dropped wireTopbarChatBtn - the standalone "Chat" button
// is gone; the consolidated "AI Assist" button (wireTopbarAiBtn below)
// opens Canvas Chat directly.

// v2.4.13 S2 + S4 . global AI Assist button click handler.
// rc.3 #7 + #13 (SPEC §S29.7) consolidation: the topbar now carries a
// SINGLE "AI Assist" button (resurrected from v2.4.13 sparkle styling)
// that opens Canvas Chat - the unified chat surface with the right-rail
// saved-skill cards and "+ Author new skill" affordance. The legacy
// AiAssistOverlay (kind="ai-assist", tile-grid skill picker) is no
// longer reachable via the topbar; it remains accessible only via
// Cmd+K / Ctrl+K for power users (retirement scheduled rc.5 with the
// broader UX consolidation arc).
function wireTopbarAiBtn() {
  var btn = document.getElementById("topbarAiBtn");
  if (!btn) return;
  btn.addEventListener("click", async function() {
    try {
      var mod = await import("./ui/views/CanvasChatOverlay.js");
      mod.openCanvasChat();
    } catch (e) {
      console.error("[CanvasChat] failed to open from AI Assist button:", e);
    }
  });
}

// Cmd+K / Ctrl+K shortcut. Registered unconditionally so it survives
// the rc.3 #7 topbar-button retirement. Industry-standard "command
// palette" pattern. Per SPEC §S33 R33.9 (rc.4-dev / Arc 2) the shortcut
// rebound from openAiOverlay (legacy v2.x AiAssistOverlay tile-grid)
// to openCanvasChat (the Canvas AI Assistant). BUG-025 fix: previously
// pressing Cmd+K opened a different surface than clicking the topbar
// AI Assist button, both branded "AI Assist" - confusing.
function wireAiAssistShortcut() {
  document.addEventListener("keydown", async function(e) {
    var isMod = e.metaKey || e.ctrlKey;
    if (!isMod || (e.key !== "k" && e.key !== "K")) return;
    // Don't fire if the user is mid-typing in an input + the OS shortcut
    // would otherwise navigate (forms still get Cmd+K behaviour because
    // browsers don't bind it natively, but we're polite anyway).
    e.preventDefault();
    try {
      var mod = await import("./ui/views/CanvasChatOverlay.js");
      mod.openCanvasChat();
    } catch (err) {
      console.error("[CanvasChat] failed to open from Cmd+K:", err);
    }
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
      var depth = aiUndoStack.depth();
      confirmAction({
        title: "Revert all AI changes?",
        body: "This rolls back " + depth + " tracked AI mutation" + (depth === 1 ? "" : "s") +
              ". The undo stack itself can't be reversed.",
        confirmLabel: "Revert " + depth,
        danger: true
      }).then(function(yes) { if (yes) aiUndoStack.undoAll(); });
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
  // rc.7 / 7e-8c · v3-pure read. v3 engagement.customer.name + meta.isDemo.
  var _engHdr = getActiveEngagement();
  var customerName = (_engHdr && _engHdr.customer && _engHdr.customer.name) || "";
  var hasName      = !!customerName.trim();
  var isDemo       = !!(_engHdr && _engHdr.meta && _engHdr.meta.isDemo);

  el.innerHTML = "";
  el.setAttribute("data-empty", hasName || isDemo ? "false" : "true");

  // v2.4.15 . SC1 . Lucide building-2 (corporate office tower) replaces
  // the v2.4.14 briefcase, which read as a shopping bag.
  var iconNS = "http://www.w3.org/2000/svg";
  var icon = document.createElementNS(iconNS, "svg");
  icon.setAttribute("class", "session-strip-icon");
  icon.setAttribute("width", "14");
  icon.setAttribute("height", "14");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.6");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  [
    "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z",
    "M6 12H4a2 2 0 0 0-2 2v8h4",
    "M18 9h2a2 2 0 0 1 2 2v11h-4",
    "M10 6h4",
    "M10 10h4",
    "M10 14h4",
    "M10 18h4"
  ].forEach(function(d) {
    var p = document.createElementNS(iconNS, "path");
    p.setAttribute("d", d);
    icon.appendChild(p);
  });
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

  // v2.4.15 . SC2 . "Updated HH:MM" segment after the save indicator.
  // Rendered by renderSessionStripStatus once the session has a savedAt.
  var divider2 = document.createElement("span");
  divider2.className = "session-strip-divider session-strip-divider-2";
  divider2.setAttribute("aria-hidden", "true");
  el.appendChild(divider2);
  var updatedEl = document.createElement("span");
  updatedEl.className = "session-strip-updated";
  updatedEl.setAttribute("data-empty", "true");
  el.appendChild(updatedEl);

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
  // rc.7 / 7e-8c · v3-pure read.
  var _engStr = getActiveEngagement();
  var hasName = !!(_engStr && _engStr.customer && _engStr.customer.name && _engStr.customer.name.trim());
  var isDemo  = !!(_engStr && _engStr.meta && _engStr.meta.isDemo);
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

  // v2.4.15 . SC2 . "Updated HH:MM" segment after the save indicator.
  // Format: HH:MM if savedAt is today; "MMM DD HH:MM" otherwise. Hidden
  // when there's no savedAt (idle / fresh canvas).
  var updatedEl = document.querySelector(".session-strip-updated");
  if (updatedEl) {
    if (snap.savedAt) {
      // Compact eyebrow + value pattern matches the rest of the topbar
      // capsule (mono caps for the meta label, regular weight for value).
      updatedEl.innerHTML = "";
      var lbl = document.createElement("span");
      lbl.className = "session-strip-updated-label";
      lbl.textContent = "Updated";
      var val = document.createElement("span");
      val.className = "session-strip-updated-value";
      val.textContent = formatUpdatedAt(snap.savedAt);
      updatedEl.appendChild(lbl);
      updatedEl.appendChild(val);
      updatedEl.setAttribute("title", "Last saved " + formatUpdatedAtFull(snap.savedAt));
      updatedEl.setAttribute("data-empty", "false");
    } else {
      updatedEl.textContent = "";
      updatedEl.removeAttribute("title");
      updatedEl.setAttribute("data-empty", "true");
    }
  }
}

// v2.4.15-polish . SC2 helper. Formats a timestamp into the session
// strip's "Updated …" segment. Same-day saves show only the time so
// the line doesn't get noisy; older saves spell out the date in
// human-readable form. Hover (title) always shows the full date+time
// for precise reference.
function formatUpdatedAt(ts) {
  var d = new Date(ts);
  var now = new Date();
  var sameDay = d.getFullYear() === now.getFullYear() &&
                d.getMonth()    === now.getMonth() &&
                d.getDate()     === now.getDate();
  var hh = String(d.getHours()).padStart(2, "0");
  var mm = String(d.getMinutes()).padStart(2, "0");
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (sameDay) return "Today " + hh + ":" + mm;
  var thisYear = d.getFullYear() === now.getFullYear();
  if (thisYear) return months[d.getMonth()] + " " + d.getDate() + " · " + hh + ":" + mm;
  return months[d.getMonth()] + " " + d.getDate() + " " + d.getFullYear() + " · " + hh + ":" + mm;
}

function formatUpdatedAtFull(ts) {
  var d = new Date(ts);
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var hh = String(d.getHours()).padStart(2, "0");
  var mm = String(d.getMinutes()).padStart(2, "0");
  return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() + " at " + hh + ":" + mm;
}

// v2.4.14 . browser tab title carries a `•` prefix while the canvas is
// in an unsaved/saving state, reverting to the plain title on saved.
// Pairs with the topbar session strip so users juggling browser tabs
// can spot which canvas needs attention.
function updateTabTitle() {
  var snap = getSaveStatus();
  var base = "Dell Discovery Canvas";
  var prefix = "";
  // rc.7 / 7e-8c · v3-pure read for tab-title.
  var _engTab = getActiveEngagement();
  if (snap.status === "saving") prefix = "• ";
  else if (snap.status === "idle" && _engTab && _engTab.customer && _engTab.customer.name && _engTab.customer.name.trim()) {
    prefix = "• ";
  }
  document.title = prefix + base;
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
  // rc.7 / 7e-8c'-impl · per SPEC §S41.2 + RULES §16 CH35:
  // Tabs 4 (gaps) + 5 (reporting) are DISABLED when the engagement
  // has zero visible environments. Tabs 2 + 3 (current/desired) stay
  // active because they show a friendly center info-card pointing
  // back to Tab 1 (per §S41.2 access matrix).
  var visibleEnvs = visibleEnvCount(getActiveEngagement());
  var DISABLED_WHEN_NO_ENVS = { gaps: true, reporting: true };
  STEPS.forEach(function(step) {
    var div = document.createElement("div");
    var isDisabled = visibleEnvs === 0 && DISABLED_WHEN_NO_ENVS[step.id] === true;
    div.className = "step"
      + (step.id === currentStep ? " active" : "")
      + (isDisabled ? " step-disabled" : "");
    if (isDisabled) {
      div.setAttribute("aria-disabled", "true");
      div.setAttribute("title", "Add at least one environment in Tab 1 (Context) first.");
    }
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
      // Disabled steps are non-interactive (per §S41.2).
      if (isDisabled) return;
      // rc.7 / 7e-8c · explicit saveToLocalStorage() retired -- v3
      // engagementStore.setActiveEngagement auto-persists on every
      // commit, so the pre-tab-switch v2 persistence call is a no-op
      // in v3-pure mode.
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

  // rc.7 / 7e-8c · view renderers' signature is (left, right, _legacySession);
  // the third arg is ignored (v3-pure, every read goes through getActiveEngagement).
  // Pass null so we don't trip the `session` ReferenceError now that we dropped
  // the v2 sessionStore import.
  switch (currentStep) {
    case "context":   renderContextView(left, right, null);                          break;
    case "current":   renderMatrixView(left, right, null, { stateFilter:"current"}); break;
    case "desired":   renderMatrixView(left, right, null, { stateFilter:"desired"}); break;
    case "gaps":      renderGapsEditView(left, right, null);                         break;
    case "reporting": renderReportingStep(left, right);                              break;
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
  var importDataBtn= document.getElementById("importDataBtn");
  var demoBtn      = document.getElementById("demoBtn");
  var newSessionBtn= document.getElementById("newSessionBtn");
  var clearAllBtn  = document.getElementById("clearAllBtn");

  // SPEC §S47.8 · Import data button - Path B Dell internal LLM workflow.
  // Clicking opens the 2-step modal (generate instructions + import JSON
  // response). The modal handles all downstream pipeline calls
  // (parseImportResponse + checkImportDrift + ImportPreviewModal +
  // applyImportItems); we just hand it getActiveEngagement +
  // setActiveEngagement.
  wireImportDataBtn(importDataBtn);

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
      confirmAction({
        title: "Load demo session?",
        body: "This replaces the current canvas with the Acme Healthcare / Riyadh + Jeddah + Sovereign Cloud demo. Anything you've typed is lost (use Save to file first if you want to keep it).",
        confirmLabel: "Load demo",
        danger: true
      }).then(async function(yes) {
        if (!yes) return;
        // SPEC §S21.5 · single-source-of-truth demo dispatch.
        // The v3 demo (`core/demoEngagement.js`) is the authoritative
        // dataset; v2 sessionState is DERIVED from it via the down-
        // converter (`state/legacySessionAdapter.js`) so v2 view tabs
        // and the v3 Canvas Chat see the same customer + drivers +
        // environments + instances + gaps.
        // BUG-010 fix: replaces the prior v2-resetToDemo() + v3-
        // setActiveEngagement() double-load that surfaced two
        // diverging customer narratives (Acme Financial in v2 vs
        // Acme Healthcare in v3).
        try {
          var demoMod    = await import("./core/demoEngagement.js");
          var storeMod   = await import("./state/engagementStore.js");
          var v3eng    = demoMod.loadDemo();
          // rc.7 / 7e-8c · v2-mirror RETIRED. Pre-7e-8c the demo loader
          // wrote a v3→v2 down-converted session into liveSession via
          // replaceSession + saveToLocalStorage so the now-retired v2
          // view tabs would see the demo. With v2 views fully migrated
          // (per rc.7 / 7e-3..7), nothing reads liveSession in production
          // anymore -- the v2 mirror is dead weight. v3 engagementStore.
          // setActiveEngagement IS the authoritative write.
          storeMod.setActiveEngagement(v3eng);
          // BUG-B regression fix (rc.7 / 7e-9b · 2026-05-09 PM) · pre-fix
          // an explicit markSaving() ran AFTER setActiveEngagement, which
          // overrode the markSaved() that _persist now fires inside the
          // store (BUG-B closure ecc429e). The result: header pulsed to
          // 'Saving...' and stayed there forever because nothing followed.
          // The Step K comment below is now obsolete: _persist drives the
          // state machine end-to-end, so the explicit pulse is redundant
          // AND actively harmful. Dropped per BUG-B regression report.
        } catch (e) {
          console.error("[demo] v3-native demo failed to load:", e);
        }
        currentStep = "reporting"; currentReportingTab = "overview";
        renderHeaderMeta(); renderStepper(); renderStage();
      });
    });
  }

  if (newSessionBtn) {
    newSessionBtn.addEventListener("click", function() {
      confirmAction({
        title: "Start fresh?",
        body: "This wipes the canvas and starts a brand-new session. Anything you've typed is lost (use Save to file first to keep it).",
        confirmLabel: "Start fresh",
        danger: true
      }).then(function(yes) {
        if (!yes) return;
        // rc.7 / 7e-8d-2 · v3-pure session reset. Replaces v2
        // resetSession() + sessionBridge's session-reset handler.
        // Order matters: clear chat memory FIRST while we still
        // have the prior engagementId, THEN swap engagement, THEN
        // clear AI undo, THEN emit so subscribers see the fully
        // coherent post-reset state.
        try {
          var _priorEng = getActiveEngagement();
          var _priorEngId = _priorEng && _priorEng.meta && _priorEng.meta.engagementId;
          if (_priorEngId) {
            try { clearTranscript(_priorEngId); }
            catch (_e) { console.warn("[reset] clearTranscript failed:", _e && _e.message); }
          }
        } catch (_e) { /* defensive -- never let chat-memory cleanup block reset */ }
        setActiveEngagement(createEmptyEngagement());
        try { aiUndoStack.clear(); } catch (_e) { /* AI undo not loaded -- harmless */ }
        // BUG-B regression fix · markSaving() dropped (was overriding the
        // markSaved() that _persist fires inside setActiveEngagement).
        currentStep = "context"; currentReportingTab = "overview";
        renderHeaderMeta(); renderStepper(); renderStage();
      });
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
      // rc.7 / 7e-8c · save flow now derives the v2-shape session at the
      // file boundary from v3 via engagementToV2Session(). The .canvas
      // file format is still v2 (services/sessionFile.js is the
      // boundary; a v3-native canvasFile rewrite is a follow-up arc).
      var v2sessForSave = engagementToV2Session(getActiveEngagement());
      var envelope = buildSaveEnvelope({
        session:        v2sessForSave,
        skills:         loadSkills(),
        providerConfig: loadAiConfig(),
        includeApiKeys: includeApiKeys
      });
      var blob = new Blob([JSON.stringify(envelope, null, 2)], { type: FILE_MIME });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement("a");
      a.href = url;
      a.download = suggestFilename(v2sessForSave);
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
    reader.onerror = function() {
      notifyError({ title: "Couldn't read the file", body: "The file may not be readable. Try downloading it again." });
    };
    reader.onload = function() {
      var env;
      try { env = parseFileEnvelope(String(reader.result || "")); }
      catch (e) {
        notifyError({ title: "Can't open this file", body: e.message || String(e) });
        return;
      }

      var hasKeys = env.providerKeys && Object.keys(env.providerKeys).length > 0;
      function continueOpen(applyKeys) {
        var res;
        try { res = applyEnvelope(env, { applyApiKeys: applyKeys }); }
        catch (e) {
          notifyError({ title: "Can't apply this file", body: e.message || String(e) });
          return;
        }
        // rc.7 / 7e-8 redo Step B · applyEnvelope now returns a v3
        // engagement directly (translation lives inside sessionFile.js
        // via state/runtimeMigrate.js). The previous shape returned a
        // v2-shape session and made app.js do its own translation; that
        // leaked the v2-shape boundary into the consumer. Encapsulating
        // the translation at the file-boundary module is the v3-pure
        // architecture: app.js doesn't know the file format is v2.
        setActiveEngagement(res.engagement);
        saveSkills(res.skills);
        if (res.providerConfig) saveAiConfig(res.providerConfig);
        // BUG-B regression fix · markSaving() dropped (override harm).
        var body = "Saved by Canvas v" + res.savedAppVersion +
          (res.savedAt ? " at " + res.savedAt : "");
        if (res.warnings.length) body += " · " + res.warnings.length + " note" + (res.warnings.length === 1 ? "" : "s");
        notifySuccess({ title: "Opened " + (file.name || "file"), body: body });
      }
      if (hasKeys) {
        confirmAction({
          title: "Apply included API keys?",
          body: "This file includes AI provider API keys. Confirm to replace your current keys with the file's. Cancel to keep your own (the file's keys are ignored).",
          confirmLabel: "Apply file's keys",
          cancelLabel:  "Keep my keys"
        }).then(function(yes) { continueOpen(!!yes); });
      } else {
        continueOpen(false);
      }
    };
    reader.readAsText(file);
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", function() {
      confirmAction({
        title: "Clear ALL app data?",
        body: "This wipes the session (customer, drivers, instances, gaps), the AI skills library, AI provider config and API keys, and the undo history. Cannot be undone. Save to file first if you want a backup.",
        confirmLabel: "Clear everything",
        danger: true
      }).then(function(yes) {
        if (!yes) return;
        try { localStorage.clear(); } catch (e) { /* private mode , ignore */ }
        window.location.href = window.location.pathname + "?cleared=" + Date.now();
      });
    });
  }
}

// SPEC §S47.8 · Import data button wiring · opens the 2-step modal that
// drives the Path B Dell-internal-LLM workflow (generate context-aware
// instructions .txt + import JSON response). The modal owns the full
// downstream pipeline (parseImportResponse + checkImportDrift + render
// ImportPreviewModal + applyImportItems); this wrapper just bridges the
// engagement getter/setter.
function wireImportDataBtn(importDataBtn) {
  if (!importDataBtn) return;
  importDataBtn.addEventListener("click", function() {
    openImportDataModal({
      host:                document.body,
      getActiveEngagement: getActiveEngagement,
      commitImport:        function(updatedEngagement) {
        // Commit the post-applier engagement through the v3 store; the
        // subscribeActiveEngagement chain re-renders the matrix view with
        // the new instances + their iLLM badges.
        setActiveEngagement(updatedEngagement);
        notifySuccess({
          title: "Imported",
          body:  "Instances added · click any tile to edit or save to lock in the engineer-confirmed values (the iLLM badge auto-clears on save)."
        });
      },
      defaultScope: "desired"
    });
  });
}
