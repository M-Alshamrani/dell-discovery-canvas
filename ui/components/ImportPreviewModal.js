// ui/components/ImportPreviewModal.js — rc.8 / C1f (SPEC §S47.5 + §S47.10)
//                                        WIDENED 2026-05-15 (A20 · §S47.5)
//
// Shared preview modal. All ingress paths (file upload · Workshop Notes
// overlay) render through this component after parseImportResponse +
// checkImportDrift have cleared the wire payload. The engineer sees one
// row per items[] entry · can toggle each row's accept/reject state ·
// choose the modal-wide apply-scope · and commit via [Apply N selected].
//
// PRE-A20 CONTRACT (per SPEC §S47.5):
//   - R47.5.1 · component lives at ui/components/ImportPreviewModal.js
//   - R47.5.2 · apply-scope picker is AUTHORITATIVE
//   - R47.5.3 · LLM-hint disagreement indicator on instance.add rows
//   - R47.5.4 · initial scope from opts.defaultScope ?? "current"
//   - R47.5.5 · "both" semantics: 2 independent records
//
// A20 WIDENING (2026-05-15 · per SPEC §S47.5 amendment + framing-doc A20 Q2):
//   - Per-row kind chip (Instance / Driver / Gap) for visual segregation
//   - Kind-aware editable cells (instance: label/vendor/etc; driver:
//     businessDriverId/priority/outcomes; gap: gapId read-only + closeReason)
//   - Apply-scope picker renders ONLY when ≥1 instance.add row present
//     (driver + gap rows have no state semantics)
//   - Duplicate-detection indicator per A20 Q4 lock · engineer override
//     by leaving the row checked
//
// DOM HOOKS (V-FLOW-PATHB-WIDEN-MODAL-1 + legacy V-FLOW-IMPORT-PREVIEW-1/2):
//   - data-import-preview-row      (one per items[] entry)
//   - data-import-confidence       (per-row confidence chip)
//   - data-import-llm-state-hint   (per-row LLM state hint · instance only)
//   - data-import-apply-scope      (modal-wide scope picker; only when ≥1 instance row)
//   - data-import-state-disagreement (per-row warning indicator · instance only)
//   - data-import-kind             (per-row kind chip · A20 · V-FLOW-PATHB-WIDEN-MODAL-1)
//   - data-import-duplicate        (per-row duplicate indicator · A20 Q4)
//
// USAGE (unchanged from pre-A20 from the caller's POV):
//   import { renderImportPreview } from "/ui/components/ImportPreviewModal.js";
//   var ctl = renderImportPreview(document.body, parsedResponse, {
//     defaultScope: "desired",
//     drift:        driftResult,                                  // A20 · optional
//     onApply:      function(selectedItems, scope) { ... },
//     onCancel:     function() { ... }
//   });
//
// Authority: docs/v3.0/SPEC.md §S47.5 (pre-A20) + §S47.5 amendment +
// framing-doc A20 Q2 lock + V-FLOW-PATHB-WIDEN-MODAL-1.

const SCOPE_VALUES = ["current", "desired", "both"];
const CONFIDENCE_LABELS = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };

// A20 · per-kind chip labels (visible in the row chip + helper text).
const KIND_CHIP_LABELS = {
  "instance.add": "Instance",
  "driver.add":   "Driver",
  "gap.close":    "Close gap"
};

// Build the row state used to drive per-row checkbox + editable cells.
// Mutated in-place as the engineer toggles UI controls.
function initRowState(items, driftResult) {
  // Build a duplicate-set keyed by itemIndex for fast lookup.
  const dupIndexSet = new Set();
  if (driftResult && Array.isArray(driftResult.duplicates)) {
    driftResult.duplicates.forEach(d => { if (typeof d.itemIndex === "number") dupIndexSet.add(d.itemIndex); });
  }
  return items.map(function(item, idx) {
    // A20: pre-A20 items lacked an explicit `kind` field; legacy v1.0
    // payloads are normalized by parseImportResponse to inject
    // kind:"instance.add" so this branch is defensive but should be hit
    // only by direct test fixtures bypassing the parser.
    const kind = item.kind || "instance.add";
    return {
      kind:           kind,
      accepted:       true,
      data:           Object.assign({}, item.data),
      confidence:     item.confidence,
      rationale:      item.rationale || "",
      llmHintedState: (kind === "instance.add" && item.data) ? (item.data.state || null) : null,
      isDuplicate:    dupIndexSet.has(idx)
    };
  });
}

// renderImportPreview(host, parsedResponse, opts) -> { applySelected, cancel }
//   host           - DOM element to mount the modal overlay into (typically document.body)
//   parsedResponse - the validated import-subset JSON object (from parseImportResponse · widened)
//   opts.defaultScope - "current" | "desired" | "both" (default "current" post-BUG-054)
//   opts.drift        - A20 · optional drift result (per-row duplicate indicators)
//   opts.onApply(selectedItems, scope) - fired when engineer clicks [Apply N selected]
//   opts.onCancel()                    - fired when engineer clicks X or Esc or overlay click
export function renderImportPreview(host, parsedResponse, opts) {
  opts = opts || {};
  var defaultScope = opts.defaultScope && SCOPE_VALUES.indexOf(opts.defaultScope) >= 0
    ? opts.defaultScope
    : "current";
  var driftResult = opts.drift || null;
  var onApply  = typeof opts.onApply  === "function" ? opts.onApply  : function() {};
  var onCancel = typeof opts.onCancel === "function" ? opts.onCancel : function() {};

  var items = (parsedResponse && Array.isArray(parsedResponse.items)) ? parsedResponse.items : [];
  var rows  = initRowState(items, driftResult);
  var scope = defaultScope;

  // A20 · count instance.add rows · apply-scope picker only renders
  // when ≥1 present.
  var hasInstanceRows = rows.some(function(r) { return r.kind === "instance.add"; });

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

  // Top bar: apply-scope picker (R47.5.2) · A20: only renders when ≥1 instance row.
  if (hasInstanceRows) {
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
    // A20 · helper text when payload is mixed (instances + non-instances).
    var nonInstanceCount = rows.filter(function(r) { return r.kind !== "instance.add"; }).length;
    if (nonInstanceCount > 0) {
      var helper = document.createElement("span");
      helper.className = "import-preview-scope-helper";
      helper.textContent = "  · applies to instance rows only (" + nonInstanceCount + " driver/gap row(s) ignore scope)";
      scopeBar.appendChild(helper);
    }
    box.appendChild(scopeBar);
  } else {
    // No instance rows · render a small lede explaining apply-scope picker is absent.
    var noInstanceLede = document.createElement("div");
    noInstanceLede.className = "import-preview-scope-lede";
    noInstanceLede.textContent = "Driver/Gap-only import · apply-scope picker is not shown (drivers + gap closures have no current/desired distinction).";
    box.appendChild(noInstanceLede);
  }

  // Body: per-row table.
  var body = document.createElement("div");
  body.className = "import-preview-body";
  var rowEls = rows.map(function(rowState, idx) {
    var rowEl = document.createElement("div");
    rowEl.className = "import-preview-row import-preview-row-" + rowState.kind.replace(".", "-");
    rowEl.setAttribute("data-import-preview-row", String(idx));

    // Checkbox.
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = rowState.accepted;
    cb.className = "import-preview-row-accept";
    cb.addEventListener("change", function() { rowState.accepted = cb.checked; });
    rowEl.appendChild(cb);

    // A20 · Per-row kind chip · the V-FLOW-PATHB-WIDEN-MODAL-1 guard target.
    var kindChip = document.createElement("span");
    kindChip.className = "import-preview-kind-chip import-preview-kind-" + rowState.kind.replace(".", "-");
    kindChip.setAttribute("data-import-kind", rowState.kind);
    kindChip.textContent = KIND_CHIP_LABELS[rowState.kind] || rowState.kind;
    rowEl.appendChild(kindChip);

    // Confidence chip.
    var conf = document.createElement("span");
    conf.className = "import-preview-confidence import-preview-confidence-" + rowState.confidence;
    conf.setAttribute("data-import-confidence", rowState.confidence);
    conf.textContent = CONFIDENCE_LABELS[rowState.confidence] || rowState.confidence;
    rowEl.appendChild(conf);

    // LLM-state hint chip · only meaningful for instance.add rows.
    if (rowState.kind === "instance.add") {
      var hint = document.createElement("span");
      hint.className = "import-preview-llm-state-hint";
      hint.setAttribute("data-import-llm-state-hint", rowState.llmHintedState || "none");
      hint.textContent = rowState.llmHintedState ? "LLM: " + rowState.llmHintedState : "LLM: no hint";
      rowEl.appendChild(hint);
    }

    // Disagreement indicator (R47.5.3) - instance.add only.
    var disagree = document.createElement("span");
    disagree.className = "import-preview-state-disagreement";
    disagree.setAttribute("data-import-state-disagreement", "");
    disagree.style.display = "none";
    rowEl.appendChild(disagree);

    // A20 · Duplicate indicator · engineer-override per Q4 lock.
    if (rowState.isDuplicate) {
      var dup = document.createElement("span");
      dup.className = "import-preview-duplicate";
      dup.setAttribute("data-import-duplicate", "");
      dup.textContent = "⚠ already in engagement";
      dup.title = "This entity matches an existing one. Uncheck to skip, or leave checked to import anyway.";
      rowEl.appendChild(dup);
    }

    // Editable cells · kind-aware. Each kind renders the canonical
    // payload fields.
    function makeInput(field, value, opts) {
      opts = opts || {};
      var input = document.createElement("input");
      input.type = "text";
      input.value = value == null ? "" : String(value);
      input.className = "import-preview-cell import-preview-cell-" + field;
      if (opts.readOnly) { input.readOnly = true; input.title = "Read-only · this field references an existing entity"; }
      input.addEventListener("input", function() { rowState.data[field] = input.value; });
      return input;
    }
    function makeTextarea(field, value) {
      var ta = document.createElement("textarea");
      ta.value = value == null ? "" : String(value);
      ta.className = "import-preview-cell import-preview-cell-" + field + " import-preview-cell-textarea";
      ta.rows = 2;
      ta.addEventListener("input", function() { rowState.data[field] = ta.value; });
      return ta;
    }

    switch (rowState.kind) {
      case "instance.add":
        rowEl.appendChild(makeInput("label",         rowState.data.label));
        rowEl.appendChild(makeInput("vendor",        rowState.data.vendor));
        rowEl.appendChild(makeInput("vendorGroup",   rowState.data.vendorGroup));
        rowEl.appendChild(makeInput("layerId",       rowState.data.layerId));
        rowEl.appendChild(makeInput("environmentId", rowState.data.environmentId));
        rowEl.appendChild(makeInput("criticality",   rowState.data.criticality));
        rowEl.appendChild(makeInput("notes",         rowState.data.notes));
        break;
      case "driver.add":
        rowEl.appendChild(makeInput("businessDriverId", rowState.data.businessDriverId));
        rowEl.appendChild(makeInput("priority",         rowState.data.priority));
        rowEl.appendChild(makeTextarea("outcomes",      rowState.data.outcomes));
        break;
      case "gap.close":
        rowEl.appendChild(makeInput("gapId",       rowState.data.gapId, { readOnly: true }));
        rowEl.appendChild(makeTextarea("closeReason", rowState.data.closeReason));
        break;
    }

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
      // Only instance.add rows participate in scope-disagreement.
      if (r.state.kind !== "instance.add") return;
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
    // A20 · per-kind breakdown when mixed.
    var perKind = { "instance.add": 0, "driver.add": 0, "gap.close": 0 };
    rowEls.forEach(function(r) { if (r.state.accepted) perKind[r.state.kind] = (perKind[r.state.kind] || 0) + 1; });
    var breakdown = [];
    if (perKind["instance.add"]) breakdown.push(perKind["instance.add"] + " instance" + (perKind["instance.add"] === 1 ? "" : "s"));
    if (perKind["driver.add"])   breakdown.push(perKind["driver.add"] + " driver" + (perKind["driver.add"] === 1 ? "" : "s"));
    if (perKind["gap.close"])    breakdown.push(perKind["gap.close"] + " gap close" + (perKind["gap.close"] === 1 ? "" : "s"));
    countEl.textContent = n + " of " + rowEls.length + " selected" + (breakdown.length > 0 ? " · " + breakdown.join(" · ") : "");
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
        // A20 · include kind in the applied payload so applyImportItems
        // can dispatch correctly. Pre-A20 the payload was {confidence,
        // rationale, data} only; post-A20 adds `kind`.
        return { kind: r.state.kind, confidence: r.state.confidence, rationale: r.state.rationale, data: r.state.data };
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
