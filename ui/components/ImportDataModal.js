// ui/components/ImportDataModal.js — rc.8 / C3b (SPEC §S47.8 + §S47.10)
//
// Path B entry-point modal. Opened from the "Import data" footer button.
// 2-step elegant layout (per user direction Q1, "single with good UI/UX
// ... I think it is elegant"):
//
//   Step 1 · Generate instructions for Dell internal LLM
//     - Apply-to picker (current / desired / both; default desired per R47.5.4)
//     - Source notes input (optional, embedded into the .txt context)
//     - Inline env chips · live list of visible engagement envs
//     - [📋 Download instructions.txt] button
//
//   Step 2 · Import Dell LLM's JSON response
//     - File picker accepting .json or .txt (LLM may emit either)
//     - On select: parseImportResponse + checkImportDrift -> ImportPreviewModal
//     - On strict-reject (drift): inline error banner with re-generate-instructions hint
//
// Authority: docs/v3.0/SPEC.md §S47.8 + §S47.10 (V-FLOW-IMPORT-FOOTER-BUTTON-1).

import { buildImportInstructions } from "../../services/importInstructionsBuilder.js";
import { parseImportResponse }     from "../../services/importResponseParser.js";
import { checkImportDrift }        from "../../services/importDriftCheck.js";
import { applyImportItems }        from "../../services/importApplier.js";
import { renderImportPreview }     from "./ImportPreviewModal.js";
import { ENV_CATALOG }             from "../../core/config.js";

const SCOPE_VALUES = ["current", "desired", "both"];

function envLabelFor(envCatalogId) {
  const entry = ENV_CATALOG.find((c) => c.id === envCatalogId);
  return entry ? entry.label : envCatalogId;
}

// Trigger a browser download of (filename, content) as a text file.
function triggerDownload(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// openImportDataModal(opts)
//   opts.host                   - DOM element to mount into (default document.body)
//   opts.getActiveEngagement()  - function returning the current engagement
//   opts.commitImport(engagement)
//                               - function called with the post-apply engagement
//                                 after the engineer confirms in the preview modal.
//                                 Caller is responsible for writing through
//                                 to engagementStore.setActiveEngagement().
//   opts.defaultScope (optional) - initial Step 1 scope (default "desired")
export function openImportDataModal(opts) {
  opts = opts || {};
  const host                = opts.host || document.body;
  const getActiveEngagement = opts.getActiveEngagement || (() => null);
  const commitImport        = opts.commitImport        || (() => {});
  let scope = (opts.defaultScope && SCOPE_VALUES.indexOf(opts.defaultScope) >= 0)
    ? opts.defaultScope
    : "desired";

  // --- Build overlay
  const overlay = document.createElement("div");
  overlay.id = "import-data-modal";
  overlay.className = "dialog-overlay import-data-modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const box = document.createElement("div");
  box.className = "dialog-box import-data-modal-box";

  // Head
  const head = document.createElement("div");
  head.className = "import-data-modal-head";
  const title = document.createElement("h2");
  title.className = "import-data-modal-title";
  title.textContent = "Import data";
  head.appendChild(title);
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "import-data-modal-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", dismount);
  head.appendChild(closeBtn);
  box.appendChild(head);

  // Lede
  const lede = document.createElement("p");
  lede.className = "import-data-modal-lede";
  lede.textContent = "Import technology data into your engagement using Dell's internal LLM. Generate context-aware instructions, run them through your LLM, and import the JSON response.";
  box.appendChild(lede);

  // ----- Step 1: Generate instructions -----
  const step1 = document.createElement("section");
  step1.className = "import-data-step import-data-step-1";
  step1.setAttribute("data-import-step", "1");
  step1.innerHTML = "<h3 class='import-data-step-title'>Step 1 · Generate instructions for Dell internal LLM</h3>";

  // Scope picker
  const scopeRow = document.createElement("div");
  scopeRow.className = "import-data-scope-row";
  const scopeLabel = document.createElement("span");
  scopeLabel.textContent = "Apply to: ";
  scopeRow.appendChild(scopeLabel);
  SCOPE_VALUES.forEach(function(value) {
    const labelEl = document.createElement("label");
    labelEl.className = "import-data-scope-option";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "import-data-scope";
    radio.value = value;
    radio.checked = (value === scope);
    radio.addEventListener("change", function() {
      if (radio.checked) scope = value;
    });
    labelEl.appendChild(radio);
    labelEl.appendChild(document.createTextNode(" " + value.charAt(0).toUpperCase() + value.slice(1)));
    scopeRow.appendChild(labelEl);
  });
  step1.appendChild(scopeRow);

  // Source notes textarea
  const notesLabel = document.createElement("label");
  notesLabel.className = "import-data-notes-label";
  notesLabel.textContent = "Source notes (optional)";
  step1.appendChild(notesLabel);
  const notesTa = document.createElement("textarea");
  notesTa.className = "import-data-notes";
  notesTa.placeholder = "Anything the LLM should know about the source file (e.g. 'Excel sheet 2 is current, sheet 3 is desired')...";
  notesTa.rows = 3;
  step1.appendChild(notesTa);

  // Env chips (transparent about what gets exported)
  const eng = getActiveEngagement();
  const allIds = (eng && eng.environments && Array.isArray(eng.environments.allIds)) ? eng.environments.allIds : [];
  const byId   = (eng && eng.environments && eng.environments.byId)                  || {};
  const hasEnvs = allIds.length > 0;

  const envChipsWrap = document.createElement("div");
  envChipsWrap.className = "import-data-env-chips";
  const envChipsLabel = document.createElement("span");
  envChipsLabel.className = "import-data-env-chips-label";
  envChipsLabel.textContent = "Environments embedded in the instructions: ";
  envChipsWrap.appendChild(envChipsLabel);
  if (!hasEnvs) {
    const empty = document.createElement("em");
    empty.textContent = "(none yet)";
    envChipsWrap.appendChild(empty);
  } else {
    allIds.forEach(function(uuid) {
      const e = byId[uuid] || {};
      const chip = document.createElement("span");
      chip.className = "import-data-env-chip";
      chip.textContent = e.alias || envLabelFor(e.envCatalogId);
      chip.title = uuid;
      envChipsWrap.appendChild(chip);
    });
  }
  step1.appendChild(envChipsWrap);

  // SPEC §S47 + feedback_5_forcing_functions.md Rule C · 0-env guard.
  //   Without at least 1 environment in the engagement, the generated
  //   instructions file has no UUIDs to embed in §2 · the Dell internal
  //   LLM has no FK targets to map rows to · strict-match drift-reject
  //   would reject every imported row on the way back · the engineer
  //   would waste a round-trip. The Download button is DISABLED here
  //   (Rule C: disable the entry point, never silently fall through to
  //   a guaranteed-failure path); a blocking inline error explains why.
  if (!hasEnvs) {
    const blockingError = document.createElement("div");
    blockingError.className = "import-data-no-envs-error";
    blockingError.setAttribute("data-import-data-no-envs-error", "");
    blockingError.textContent = "Add at least one environment in the Context tab before generating instructions. Without environment UUIDs, the Dell internal LLM has no target to map extracted rows to.";
    step1.appendChild(blockingError);
  }

  // Download button
  const dlBtn = document.createElement("button");
  dlBtn.type = "button";
  dlBtn.className = "import-data-download-btn primary-button";
  dlBtn.textContent = "📋 Download instructions.txt";
  dlBtn.disabled = !hasEnvs;            // R2 0-env guard (Rule C)
  if (!hasEnvs) {
    dlBtn.title = "Add an environment in the Context tab first";
  }
  dlBtn.addEventListener("click", function() {
    if (!hasEnvs) return;               // belt-and-braces: even if .disabled is bypassed
    const live = getActiveEngagement();
    if (!live) return;
    try {
      const out = buildImportInstructions(live, { scope: scope, sourceNotes: notesTa.value });
      triggerDownload(out.filename, out.content);
    } catch (e) {
      // Defense-in-depth: the builder ALSO throws on 0 envs (NO_ENVIRONMENTS).
      // If it ever throws (live engagement changed between modal-mount and
      // click), show an inline error instead of letting the exception
      // bubble up to a blank-screen state.
      var errBox = step1.querySelector(".import-data-runtime-error");
      if (!errBox) {
        errBox = document.createElement("div");
        errBox.className = "import-data-error import-data-runtime-error";
        step1.appendChild(errBox);
      }
      errBox.textContent = "Could not generate instructions: " + (e && e.message || String(e));
    }
  });
  step1.appendChild(dlBtn);

  box.appendChild(step1);

  // ----- Step 2: Import JSON response -----
  const step2 = document.createElement("section");
  step2.className = "import-data-step import-data-step-2";
  step2.setAttribute("data-import-step", "2");
  step2.innerHTML = "<h3 class='import-data-step-title'>Step 2 · Import Dell LLM's JSON response</h3>";

  const pickBtn = document.createElement("button");
  pickBtn.type = "button";
  pickBtn.className = "import-data-pick-btn primary-button";
  pickBtn.textContent = "📤 Select JSON file…";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,.txt,application/json,text/plain";
  fileInput.style.display = "none";
  pickBtn.addEventListener("click", function() { fileInput.click(); });
  step2.appendChild(pickBtn);
  step2.appendChild(fileInput);

  const errBox = document.createElement("div");
  errBox.className = "import-data-error";
  errBox.style.display = "none";
  step2.appendChild(errBox);

  function showError(text) {
    errBox.textContent = text;
    errBox.style.display = "";
  }
  function clearError() {
    errBox.textContent = "";
    errBox.style.display = "none";
  }

  fileInput.addEventListener("change", function(ev) {
    clearError();
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    fileInput.value = "";   // allow re-pick of the same file
    const reader = new FileReader();
    reader.onerror = function() { showError("Failed to read file: " + (reader.error && reader.error.message)); };
    reader.onload  = function() {
      const text = String(reader.result || "");
      // parseImportResponse handles JSON.parse + Zod validation in one step.
      const parsed = parseImportResponse(text);
      if (!parsed.ok) {
        showError("Invalid response: " + (parsed.errors[0] && parsed.errors[0].message) + (parsed.errors.length > 1 ? " (+ " + (parsed.errors.length - 1) + " more)" : ""));
        return;
      }
      const live = getActiveEngagement();
      if (!live) { showError("No active engagement."); return; }
      // R47.8.4 strict-reject on drift.
      const drift = checkImportDrift(parsed.parsed, live);
      if (!drift.ok) {
        showError("Response references " + drift.missingEnvIds.length + " environment(s) no longer in this engagement. Re-generate instructions and re-run.");
        return;
      }
      // Drift clean - open the preview modal.
      renderImportPreview(host, parsed.parsed, {
        defaultScope: scope,
        onApply: function(selectedItems, finalScope) {
          const res = applyImportItems(live, selectedItems, {
            scope:      finalScope,
            provenance: { kind: "external-llm", source: "dell-internal", runId: "run-" + Date.now(), mutatedAt: new Date().toISOString() }
          });
          // SPEC §S47 + feedback_5_forcing_functions.md Rule C · R3 · pass
          // the FULL applier result envelope (engagement + addedInstanceIds
          // + errors) to commitImport so the wired handler in app.js can
          // surface partial failures · pre-R3 we passed res.engagement here
          // which dropped errors + addedInstanceIds at the modal layer and
          // let the app handler claim notifySuccess on partial failure.
          commitImport(res);
          dismount();
        },
        onCancel: function() { /* preview closed; data modal stays open */ }
      });
    };
    reader.readAsText(file);
  });

  box.appendChild(step2);

  // Workflow card (4-step recipe)
  const workflow = document.createElement("aside");
  workflow.className = "import-data-workflow-card";
  workflow.innerHTML =
    "<strong>Workflow:</strong>" +
    "<ol>" +
    "  <li>Generate instructions (this dialog)</li>" +
    "  <li>Take the .txt file to your Dell internal LLM with the source data</li>" +
    "  <li>Save the LLM's JSON response</li>" +
    "  <li>Return here and import the JSON</li>" +
    "</ol>";
  box.appendChild(workflow);

  // R47.8.3 strict-match warning (visible up-front, not just inside the .txt)
  const warning = document.createElement("p");
  warning.className = "import-data-strict-warning";
  warning.textContent = "Strict matching: the JSON response must reference exactly the environments listed above. If you add/remove environments before importing, the response will be rejected — re-generate instructions.";
  box.appendChild(warning);

  // Mount
  overlay.appendChild(box);
  host.appendChild(overlay);

  function handleEsc(e) { if (e.key === "Escape") dismount(); }
  overlay.addEventListener("click", function(e) { if (e.target === overlay) dismount(); });
  document.addEventListener("keydown", handleEsc);

  function dismount() {
    document.removeEventListener("keydown", handleEsc);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  return { close: dismount };
}
