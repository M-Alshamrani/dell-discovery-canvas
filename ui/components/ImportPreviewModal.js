// ui/components/ImportPreviewModal.js — rc.8 / C1f (SPEC §S47.5 + §S47.10)
//
// Shared preview modal. Both ingress paths render through this component
// after parseImportResponse + checkImportDrift have cleared the wire
// payload. The engineer sees one row per items[] entry, can toggle each
// row's accept/reject state, choose the modal-wide apply-scope, and
// commit via [Apply N selected].
//
// CONTRACT (per SPEC §S47.5):
//   - R47.5.1 · component lives at ui/components/ImportPreviewModal.js
//   - R47.5.2 · apply-scope picker is AUTHORITATIVE (engineer's choice
//     overrides the LLM's per-row state hint)
//   - R47.5.3 · when items[i].data.state !== modal scope (non-null hint
//     disagrees), surface a "⚠ LLM hinted X" indicator on the row
//   - R47.5.4 · initial scope from opts.defaultScope ?? "desired"
//   - R47.5.5 · "both" semantics are the applier's responsibility; this
//     modal just emits the scope; importApplier.js handles the 2-record
//     creation
//
// DOM HOOKS (asserted by V-FLOW-IMPORT-PREVIEW-1 + PREVIEW-2 source-grep):
//   - data-import-preview-row      (one per items[] entry)
//   - data-import-confidence       (per-row confidence chip)
//   - data-import-llm-state-hint   (per-row LLM-hinted state chip)
//   - data-import-apply-scope      (modal-wide scope picker; values: current/desired/both)
//   - data-import-state-disagreement (per-row warning indicator when row.data.state !== modal scope)
//
// USAGE:
//   import { renderImportPreview } from "/ui/components/ImportPreviewModal.js";
//   var ctl = renderImportPreview(document.body, parsedResponse, {
//     defaultScope: "desired",
//     onApply: function(selectedItems, scope) { ... },   // user clicked Apply
//     onCancel: function() { ... }                        // user clicked X or Esc
//   });
//   // ctl.applySelected() and ctl.cancel() also drive the modal
//   // programmatically (e.g. tests, keyboard shortcuts).
//
// Authority: docs/v3.0/SPEC.md §S47.5 + §S47.10 (V-FLOW-IMPORT-PREVIEW-1 + PREVIEW-2).

const SCOPE_VALUES = ["current", "desired", "both"];
const CONFIDENCE_LABELS = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };

// Build the row state used to drive per-row checkbox + editable cells.
// Mutated in-place as the engineer toggles UI controls.
function initRowState(items) {
  return items.map(function(item) {
    return {
      accepted:    true,                     // default-checked per S47.5
      data:        Object.assign({}, item.data),
      confidence:  item.confidence,
      rationale:   item.rationale || "",
      // The original LLM state hint (immutable; survives modal-scope toggle
      // so the row can re-show its disagreement indicator if the engineer
      // flips scope back and forth).
      llmHintedState: item.data.state || null
    };
  });
}

// renderImportPreview(host, parsedResponse, opts) -> { applySelected, cancel }
//   host           - DOM element to mount the modal overlay into (typically document.body)
//   parsedResponse - the validated import-subset JSON object (from parseImportResponse)
//   opts.defaultScope - "current" | "desired" | "both" (default "current" post-BUG-054)
//   opts.onApply(selectedItems, scope) - fired when engineer clicks [Apply N selected]
//   opts.onCancel()                    - fired when engineer clicks X or Esc or overlay click
export function renderImportPreview(host, parsedResponse, opts) {
  opts = opts || {};
  // BUG-054 · default to "current" not "desired" · downstream from ImportDataModal
  var defaultScope = opts.defaultScope && SCOPE_VALUES.indexOf(opts.defaultScope) >= 0
    ? opts.defaultScope
    : "current";
  var onApply  = typeof opts.onApply  === "function" ? opts.onApply  : function() {};
  var onCancel = typeof opts.onCancel === "function" ? opts.onCancel : function() {};

  var items = (parsedResponse && Array.isArray(parsedResponse.items)) ? parsedResponse.items : [];
  var rows  = initRowState(items);
  var scope = defaultScope;

  // Build overlay
  var overlay = document.createElement("div");
  overlay.id = "import-preview-modal";
  overlay.className = "dialog-overlay import-preview-modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "import-preview-modal-title");

  var box = document.createElement("div");
  box.className = "dialog-box import-preview-modal-box";

  // Header
  var head = document.createElement("div");
  head.className = "import-preview-modal-head";
  var title = document.createElement("h2");
  title.id = "import-preview-modal-title";
  title.className = "import-preview-modal-title";
  title.textContent = "Preview import";
  head.appendChild(title);
  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "import-preview-modal-close";
  closeBtn.setAttribute("aria-label", "Cancel import");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", function() { cancel(); });
  head.appendChild(closeBtn);
  box.appendChild(head);

  // Top bar: apply-scope picker (R47.5.2 — AUTHORITATIVE per SPEC).
  var scopeBar = document.createElement("div");
  scopeBar.className = "import-preview-scope-bar";
  scopeBar.setAttribute("data-import-apply-scope", "");
  var scopeLabel = document.createElement("span");
  scopeLabel.className = "import-preview-scope-label";
  scopeLabel.textContent = "Apply as: ";
  scopeBar.appendChild(scopeLabel);
  SCOPE_VALUES.forEach(function(value) {
    var labelEl = document.createElement("label");
    labelEl.className = "import-preview-scope-option";
    var radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "import-apply-scope";
    radio.value = value;
    radio.checked = (value === scope);
    radio.addEventListener("change", function() {
      if (radio.checked) {
        scope = value;
        refreshRowDisagreements();
      }
    });
    labelEl.appendChild(radio);
    labelEl.appendChild(document.createTextNode(" " + value.charAt(0).toUpperCase() + value.slice(1)));
    scopeBar.appendChild(labelEl);
  });
  box.appendChild(scopeBar);

  // Body: per-row table.
  var body = document.createElement("div");
  body.className = "import-preview-body";
  var rowEls = rows.map(function(rowState, idx) {
    var rowEl = document.createElement("div");
    rowEl.className = "import-preview-row";
    rowEl.setAttribute("data-import-preview-row", String(idx));

    // Checkbox.
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = rowState.accepted;
    cb.className = "import-preview-row-accept";
    cb.addEventListener("change", function() { rowState.accepted = cb.checked; });
    rowEl.appendChild(cb);

    // Confidence chip.
    var conf = document.createElement("span");
    conf.className = "import-preview-confidence import-preview-confidence-" + rowState.confidence;
    conf.setAttribute("data-import-confidence", rowState.confidence);
    conf.textContent = CONFIDENCE_LABELS[rowState.confidence] || rowState.confidence;
    rowEl.appendChild(conf);

    // LLM-state hint chip.
    var hint = document.createElement("span");
    hint.className = "import-preview-llm-state-hint";
    hint.setAttribute("data-import-llm-state-hint", rowState.llmHintedState || "none");
    hint.textContent = rowState.llmHintedState
      ? "LLM: " + rowState.llmHintedState
      : "LLM: no hint";
    rowEl.appendChild(hint);

    // Disagreement indicator (R47.5.3) - hidden by default; surfaced
    // when row's LLM hint disagrees with the modal-wide scope.
    var disagree = document.createElement("span");
    disagree.className = "import-preview-state-disagreement";
    disagree.setAttribute("data-import-state-disagreement", "");
    disagree.style.display = "none";
    rowEl.appendChild(disagree);

    // Editable cells (label / vendor / vendorGroup / layer / env / crit / notes).
    function makeInput(field, value) {
      var input = document.createElement("input");
      input.type = "text";
      input.value = value == null ? "" : String(value);
      input.className = "import-preview-cell import-preview-cell-" + field;
      input.addEventListener("input", function() { rowState.data[field] = input.value; });
      return input;
    }
    rowEl.appendChild(makeInput("label",         rowState.data.label));
    rowEl.appendChild(makeInput("vendor",        rowState.data.vendor));
    rowEl.appendChild(makeInput("vendorGroup",   rowState.data.vendorGroup));
    rowEl.appendChild(makeInput("layerId",       rowState.data.layerId));
    rowEl.appendChild(makeInput("environmentId", rowState.data.environmentId));
    rowEl.appendChild(makeInput("criticality",   rowState.data.criticality));
    rowEl.appendChild(makeInput("notes",         rowState.data.notes));

    body.appendChild(rowEl);
    return { state: rowState, el: rowEl, disagree: disagree };
  });
  box.appendChild(body);

  // Footer: row count + apply button.
  var foot = document.createElement("div");
  foot.className = "import-preview-foot";
  var countEl = document.createElement("span");
  countEl.className = "import-preview-count";
  foot.appendChild(countEl);
  var applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.className = "import-preview-apply primary-button";
  applyBtn.addEventListener("click", function() { applySelected(); });
  foot.appendChild(applyBtn);
  box.appendChild(foot);

  function refreshRowDisagreements() {
    rowEls.forEach(function(r) {
      var hint = r.state.llmHintedState;
      var disagrees = hint && hint !== scope && scope !== "both";
      if (disagrees) {
        r.disagree.style.display = "";
        r.disagree.textContent = "⚠ LLM hinted \"" + hint + "\"";
      } else {
        r.disagree.style.display = "none";
        r.disagree.textContent = "";
      }
    });
  }
  function refreshCount() {
    var n = rowEls.filter(function(r) { return r.state.accepted; }).length;
    countEl.textContent = n + " of " + rowEls.length + " selected";
    applyBtn.textContent = "Apply " + n + " selected";
    applyBtn.disabled = n === 0;
  }
  rowEls.forEach(function(r) {
    r.el.querySelector(".import-preview-row-accept").addEventListener("change", refreshCount);
  });
  refreshRowDisagreements();
  refreshCount();

  // Mount.
  overlay.appendChild(box);
  (host || document.body).appendChild(overlay);

  // Overlay click + Esc handlers.
  function handleEsc(e) { if (e.key === "Escape") cancel(); }
  overlay.addEventListener("click", function(e) { if (e.target === overlay) cancel(); });
  document.addEventListener("keydown", handleEsc);

  function dismount() {
    document.removeEventListener("keydown", handleEsc);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function applySelected() {
    var selected = rowEls
      .filter(function(r) { return r.state.accepted; })
      .map(function(r) {
        return { confidence: r.state.confidence, rationale: r.state.rationale, data: r.state.data };
      });
    dismount();
    onApply(selected, scope);
  }
  function cancel() {
    dismount();
    onCancel();
  }

  return { applySelected: applySelected, cancel: cancel };
}
