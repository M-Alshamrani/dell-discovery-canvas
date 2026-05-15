// ui/views/WorkshopNotesOverlay.js — v3.0 · Sub-arc D Step 4 (A20 widening)
//
// Mode 1 Workshop Notes overlay UI. Dual-pane layout per framing-doc A2:
//   - Lower pane: engineer's raw bullets (auto-bulletpoint editor ·
//     always-visible · append-only per A7 · localStorage auto-save
//     under workshopNotesDraft_v1 per A9)
//   - Upper pane: AI-structured markdown notes (per A2 canonical
//     headings: ## Customer concerns / ## Drivers identified / ## Current
//     state captured / ## Desired state directions / ## Gaps proposed /
//     ## Action items) + per-mapping suggestion rows with HIGH/MEDIUM/
//     LOW chips (per A4)
//
// AUTHORITY: SPEC §S20.4.1.5 (Workshop Notes overlay → Path B importer
// flow · primary Sub-arc D UX path) + framing-doc A1 (topbar AI Notes
// button · CH26 amendment) + A2 (dual-pane spec) + A3 (DELTA push +
// [Re-evaluate all]) + A4 (confidence tinting) + A5 (per-row + bulk
// review via Path B at Step 5) + A6 (24-hour TZ divider · v1) + A7
// (append-only) + A8 (PDF/JSON export · stub at Step 4) + A9
// (localStorage persistence) + A10 (resume prompt) + A19 (post-pivot
// [Import to canvas] feeds Path B) + A20 (widening).
//
// V-FLOW-AI-NOTES-1: this file exists + exports openWorkshopNotesOverlay
// V-FLOW-AI-NOTES-2: source contains lower-pane raw bullets + upper-pane
//                    processed notes + [Import to canvas] markers
// V-FLOW-AI-NOTES-IMPORT-1: source references workshopNotesImportAdapter
//
// USAGE:
//   import { openWorkshopNotesOverlay } from "/ui/views/WorkshopNotesOverlay.js";
//   openWorkshopNotesOverlay();   // reads engagement + provider from globals
//
// The overlay is mounted via openOverlay (ui/components/Overlay.js) so
// it inherits ESC handling + backdrop click + stack-aware sidePanel
// behavior. The dual-pane DOM is built by buildWorkshopNotesBody and
// passed as opts.body to openOverlay.

import { openOverlay, closeOverlay } from "../components/Overlay.js";
import { pushNotesToAi } from "../../services/workshopNotesService.js";
import { transformOverlayToImportPayload } from "../../services/workshopNotesImportAdapter.js";
import { parseImportResponse } from "../../services/importResponseParser.js";
import { checkImportDrift } from "../../services/importDriftCheck.js";
import { applyImportItems } from "../../services/importApplier.js";
import { renderImportPreview } from "../components/ImportPreviewModal.js";
import { getActiveEngagement, setActiveEngagement } from "../../state/engagementStore.js";
import { notifyError, notifyInfo, notifySuccess } from "../components/Notify.js";

const LOCAL_STORAGE_DRAFT_KEY = "workshopNotesDraft_v1";

// In-memory state for the open overlay (singleton per session — only
// one Workshop Notes overlay open at a time).
let overlayState = null;

// Restore draft from localStorage. Returns null when no draft or when
// JSON parsing fails (defensive).
function loadDraft() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      bullets:           Array.isArray(parsed.bullets) ? parsed.bullets : [],
      lastBulletsText:   typeof parsed.lastBulletsText === "string" ? parsed.lastBulletsText : "",
      processedMarkdown: typeof parsed.processedMarkdown === "string" ? parsed.processedMarkdown : "",
      mappings:          Array.isArray(parsed.mappings) ? parsed.mappings : [],
      savedAt:           typeof parsed.savedAt === "string" ? parsed.savedAt : null
    };
  } catch (_e) { return null; }
}

function saveDraft() {
  if (!overlayState) return;
  try {
    localStorage.setItem(LOCAL_STORAGE_DRAFT_KEY, JSON.stringify({
      bullets:           overlayState.bullets,
      lastBulletsText:   overlayState.lastBulletsText,
      processedMarkdown: overlayState.processedMarkdown,
      mappings:          overlayState.mappings,
      savedAt:           new Date().toISOString()
    }));
  } catch (e) {
    console.warn("[WorkshopNotesOverlay] localStorage save failed: " + (e.message || e));
  }
}

function clearDraft() {
  try { localStorage.removeItem(LOCAL_STORAGE_DRAFT_KEY); }
  catch (_e) { /* ignore */ }
}

// Very small markdown-to-HTML renderer for the upper pane. Scope:
// headings (#, ##, ###), bullets (-, *), bold (**), italic (*), line
// breaks. Avoids pulling in a full markdown lib for v1.
function renderMarkdownToHtml(md) {
  if (typeof md !== "string" || md.length === 0) return "";
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = escaped.split("\n");
  const out = [];
  let inList = false;
  function closeListIfOpen() {
    if (inList) { out.push("</ul>"); inList = false; }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      closeListIfOpen();
      continue;
    }
    if (trimmed.startsWith("### ")) {
      closeListIfOpen();
      out.push("<h4>" + renderInlineMd(trimmed.slice(4)) + "</h4>");
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeListIfOpen();
      out.push("<h3>" + renderInlineMd(trimmed.slice(3)) + "</h3>");
      continue;
    }
    if (trimmed.startsWith("# ")) {
      closeListIfOpen();
      out.push("<h2>" + renderInlineMd(trimmed.slice(2)) + "</h2>");
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push("<li>" + renderInlineMd(trimmed.replace(/^[-*]\s+/, "")) + "</li>");
      continue;
    }
    closeListIfOpen();
    out.push("<p>" + renderInlineMd(trimmed) + "</p>");
  }
  closeListIfOpen();
  return out.join("\n");
}

function renderInlineMd(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

// Render the per-mapping suggestion list under the markdown body.
// Each row: kind chip + label + confidence pill + rationale.
function renderMappingsList(mappings) {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return '<p class="workshop-notes-mappings-empty">No canvas mappings emitted yet. Type more workshop bullets and push again.</p>';
  }
  const html = ['<div class="workshop-notes-mappings-list">',
    '<div class="workshop-notes-mappings-head">Canvas mappings (' + mappings.length + ')</div>'];
  mappings.forEach((m, idx) => {
    const conf = (m.confidence || "MEDIUM").toUpperCase();
    const confClass = "workshop-notes-conf-" + conf.toLowerCase();
    const kindLabel = describeMappingKind(m);
    html.push('<div class="workshop-notes-mapping-row" data-workshop-mapping-idx="' + idx + '">');
    html.push('  <span class="workshop-notes-mapping-kind">' + escapeHtml(kindLabel) + '</span>');
    html.push('  <span class="workshop-notes-mapping-conf ' + confClass + '">' + escapeHtml(conf) + '</span>');
    html.push('  <span class="workshop-notes-mapping-rationale">' + escapeHtml(m.rationale || "") + '</span>');
    html.push('</div>');
  });
  html.push('</div>');
  return html.join("\n");
}

function describeMappingKind(m) {
  if (!m) return "?";
  switch (m.kind) {
    case "add-driver":           return "+Driver: " + (m.payload && m.payload.businessDriverId ? m.payload.businessDriverId : "?");
    case "add-instance-current": return "+Current: " + (m.payload && m.payload.label ? m.payload.label : "?") + (m.payload && m.payload.layerId ? " · " + m.payload.layerId : "");
    case "add-instance-desired": return "+Desired: " + (m.payload && m.payload.label ? m.payload.label : "?") + (m.payload && m.payload.layerId ? " · " + m.payload.layerId : "");
    case "close-gap":            return "Close gap: " + (m.payload && m.payload.gapId ? m.payload.gapId.slice(0, 8) + "…" : "?");
    default:                     return m.kind || "?";
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Build the dual-pane DOM body. Returns the body container element +
// references to the live nodes (upperPane, lowerTextarea, toolbar
// buttons) so the open-overlay caller can wire handlers.
function buildWorkshopNotesBody() {
  const body = document.createElement("div");
  body.className = "workshop-notes-body";
  body.innerHTML = [
    '<div class="workshop-notes-pane workshop-notes-upper-pane" data-workshop-upper-pane="">',
    '  <div class="workshop-notes-toolbar">',
    '    <button type="button" class="workshop-notes-btn workshop-notes-btn-push" data-workshop-action="push">Push notes to AI</button>',
    '    <button type="button" class="workshop-notes-btn workshop-notes-btn-reeval" data-workshop-action="reeval">Re-evaluate all</button>',
    '    <button type="button" class="workshop-notes-btn workshop-notes-btn-import" data-workshop-action="import-to-canvas">Import to canvas</button>',
    '    <button type="button" class="workshop-notes-btn workshop-notes-btn-pdf" data-workshop-action="export-pdf">Export PDF</button>',
    '    <button type="button" class="workshop-notes-btn workshop-notes-btn-json" data-workshop-action="export-json">Export JSON</button>',
    '    <span class="workshop-notes-toolbar-spacer"></span>',
    '    <span class="workshop-notes-status" data-workshop-status="">Ready</span>',
    '  </div>',
    '  <div class="workshop-notes-processed-notes" data-workshop-processed="">',
    '    <p class="workshop-notes-empty-hint">Workshop bullets go in the lower pane.<br>Click <strong>Push notes to AI</strong> to structure them here.</p>',
    '  </div>',
    '  <div class="workshop-notes-mappings" data-workshop-mappings=""></div>',
    '</div>',
    '<div class="workshop-notes-divider" aria-hidden="true"></div>',
    '<div class="workshop-notes-pane workshop-notes-lower-pane" data-workshop-lower-pane="">',
    '  <label class="workshop-notes-lower-label" for="workshop-notes-bullets">Raw bullets · workshop notes (auto-saved)</label>',
    '  <textarea id="workshop-notes-bullets" class="workshop-notes-textarea" placeholder="- Customer wants stronger backup posture&#10;- HIPAA + Texas data residency&#10;- DR site is HPE 3PAR, plans to retire&#10;- ..." spellcheck="false"></textarea>',
    '  <div class="workshop-notes-lower-hint">Enter adds a new bullet · Tab indents · Cmd+Enter pushes notes to AI · Esc closes (auto-saves)</div>',
    '</div>'
  ].join("\n");
  return body;
}

// Auto-bullet helper for the lower textarea. On Enter without modifier:
// inserts "- " at the new line if the previous line wasn't blank.
function setupAutoBullet(textarea) {
  textarea.addEventListener("keydown", function(e) {
    // Cmd+Enter or Ctrl+Enter triggers push-to-AI (delegated via the
    // overlay container's keyboard listener).
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const value = textarea.value;
      const selStart = textarea.selectionStart;
      // Find the start of the current line.
      const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
      const currentLine = value.slice(lineStart, selStart);
      // If current line begins with "- " or "* ", continue the list.
      const m = currentLine.match(/^(\s*)([-*])\s+/);
      if (m) {
        if (currentLine.replace(/^(\s*)([-*])\s+/, "").trim() === "") {
          // Empty bullet → break out of list.
          e.preventDefault();
          const before = value.slice(0, lineStart);
          const after  = value.slice(selStart);
          textarea.value = before + after;
          textarea.selectionStart = textarea.selectionEnd = lineStart;
        } else {
          e.preventDefault();
          const insertion = "\n" + m[1] + m[2] + " ";
          const before = value.slice(0, selStart);
          const after  = value.slice(selStart);
          textarea.value = before + insertion + after;
          textarea.selectionStart = textarea.selectionEnd = selStart + insertion.length;
        }
      } else {
        // No current bullet — insert "- " at the start of the new line.
        e.preventDefault();
        const insertion = "\n- ";
        const before = value.slice(0, selStart);
        const after  = value.slice(selStart);
        textarea.value = before + insertion + after;
        textarea.selectionStart = textarea.selectionEnd = selStart + insertion.length;
      }
      onBulletsChanged();
      return;
    }
    // Tab to indent · Shift+Tab to outdent
    if (e.key === "Tab" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const value = textarea.value;
      const selStart = textarea.selectionStart;
      const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
      if (e.shiftKey) {
        // Outdent: remove 2 leading spaces if present.
        if (value.slice(lineStart, lineStart + 2) === "  ") {
          textarea.value = value.slice(0, lineStart) + value.slice(lineStart + 2);
          textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, selStart - 2);
          onBulletsChanged();
        }
      } else {
        // Indent: insert 2 spaces at line start.
        textarea.value = value.slice(0, lineStart) + "  " + value.slice(lineStart);
        textarea.selectionStart = textarea.selectionEnd = selStart + 2;
        onBulletsChanged();
      }
    }
  });
  textarea.addEventListener("input", onBulletsChanged);
}

// Parse the lower-pane textarea into a bullets[] array. Splits by line,
// strips leading "- " / "* " / whitespace, drops empties.
function parseBullets(text) {
  return text.split("\n")
    .map(line => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter(line => line.length > 0);
}

// Compute the delta (new bullets since last push). The state tracks
// lastBulletsText (the textarea value at last push); delta = bullets
// present now that weren't present before.
function computeDelta(currentBullets, lastBulletsText) {
  const lastBullets = parseBullets(lastBulletsText);
  const lastSet = new Set(lastBullets);
  return currentBullets.filter(b => !lastSet.has(b));
}

function onBulletsChanged() {
  if (!overlayState) return;
  const textarea = overlayState.lowerTextareaEl;
  if (!textarea) return;
  overlayState.bullets = parseBullets(textarea.value);
  saveDraft();
}

function setStatus(text, kind) {
  if (!overlayState || !overlayState.statusEl) return;
  overlayState.statusEl.textContent = text;
  overlayState.statusEl.setAttribute("data-workshop-status", kind || "info");
}

function repaintUpperPane() {
  if (!overlayState) return;
  const processedEl = overlayState.processedEl;
  const mappingsEl  = overlayState.mappingsEl;
  if (overlayState.processedMarkdown && overlayState.processedMarkdown.trim().length > 0) {
    processedEl.innerHTML = renderMarkdownToHtml(overlayState.processedMarkdown);
  } else {
    processedEl.innerHTML = '<p class="workshop-notes-empty-hint">Workshop bullets go in the lower pane.<br>Click <strong>Push notes to AI</strong> to structure them here.</p>';
  }
  mappingsEl.innerHTML = renderMappingsList(overlayState.mappings || []);
}

async function handlePushToAi(mode) {
  if (!overlayState) return;
  const textareaText = overlayState.lowerTextareaEl.value;
  const allBullets   = parseBullets(textareaText);
  if (allBullets.length === 0) {
    notifyInfo({ title: "Nothing to push", body: "Type some workshop bullets in the lower pane first." });
    return;
  }

  let bulletsForLlm;
  if (mode === "full") {
    bulletsForLlm = allBullets;
  } else {
    const delta = computeDelta(allBullets, overlayState.lastBulletsText);
    if (delta.length === 0) {
      notifyInfo({ title: "Nothing new to push", body: "All bullets have already been processed. Use [Re-evaluate all] to regenerate from scratch." });
      return;
    }
    bulletsForLlm = delta;
  }

  setStatus("Pushing to AI…", "busy");
  // Disable buttons during call to prevent double-push.
  overlayState.toolbarButtons.forEach(b => { b.disabled = true; });

  let res;
  try {
    res = await pushNotesToAi({
      engagement:        getActiveEngagement(),
      bullets:           bulletsForLlm,
      previousProcessed: overlayState.processedMarkdown,
      mode:              mode
    });
  } catch (e) {
    res = { ok: false, error: e.message || String(e) };
  }

  overlayState.toolbarButtons.forEach(b => { b.disabled = false; });

  if (!res.ok) {
    setStatus("Push failed", "error");
    notifyError({ title: "Push to AI failed", body: res.error || "Unknown error" });
    return;
  }

  // Merge processed markdown.
  if (mode === "full") {
    overlayState.processedMarkdown = res.processedMarkdown || "";
    overlayState.mappings = res.mappings || [];
  } else {
    // Delta: append (separated by blank line for readability).
    const prev = (overlayState.processedMarkdown || "").trim();
    const addition = (res.processedMarkdown || "").trim();
    overlayState.processedMarkdown = prev.length > 0 ? prev + "\n\n" + addition : addition;
    // Append new mappings.
    overlayState.mappings = (overlayState.mappings || []).concat(res.mappings || []);
  }
  overlayState.lastBulletsText = textareaText;
  saveDraft();
  repaintUpperPane();

  const droppedSuffix = res.droppedCount > 0 ? " · " + res.droppedCount + " malformed dropped" : "";
  setStatus("Pushed · " + (res.mappings || []).length + " mapping" + ((res.mappings || []).length === 1 ? "" : "s") + droppedSuffix, "ok");
}

// [Import to canvas] click handler · A20 widened end-to-end flow:
//   1. workshopNotesImportAdapter.transformOverlayToImportPayload
//      converts overlay mappings → widened Path B wire payload
//      (per-item `kind` discriminator · 3 kinds)
//   2. parseImportResponse validates the widened shape against
//      WideImportSubsetSchema (services/importResponseParser.js)
//   3. checkImportDrift validates per-kind FK membership against
//      the live engagement (env UUIDs for instance.add · gapIds
//      for gap.close · businessDriverId catalog for driver.add)
//   4. renderImportPreview opens ImportPreviewModal · engineer
//      reviews each row (per-kind chip + per-kind editable cells)
//      + selects which to apply
//   5. applyImportItems dispatches per kind to the right commit
//      function (addInstance · addDriver · updateGap) · stamps
//      aiTag.kind = "discovery-note" via the provenance envelope
//   6. setActiveEngagement commits the new state to the v3 store
//      → subscribeActiveEngagement chain re-renders the matrix
//
// V-FLOW-AI-NOTES-IMPORT-1 source-grep: this handler MUST reference
// workshopNotesImportAdapter (the source-grep target). Step 5g
// additionally wires through parser/drift/modal/applier per the
// Step-5 RED scaffolds.
function handleImportToCanvas() {
  if (!overlayState) return;
  const mappings = overlayState.mappings || [];
  if (mappings.length === 0) {
    notifyInfo({ title: "Nothing to import", body: "Push notes to AI first to generate canvas mappings." });
    return;
  }

  const runId = overlayState.lastRunId || ("wn-" + Date.now().toString(36));
  const mutatedAt = new Date().toISOString();

  // Step 1: transform overlay mappings → widened Path B wire payload.
  const payload = transformOverlayToImportPayload({
    mappings:  mappings,
    runId:     runId,
    mutatedAt: mutatedAt
  });

  if (!payload.items || payload.items.length === 0) {
    notifyError({ title: "No valid mappings", body: "All " + mappings.length + " mappings were dropped by the adapter (validation failed). Check console for details." });
    return;
  }

  // Step 2: parse + validate the widened payload (defensive · the
  // adapter already validates · but parser is the canonical gate).
  const parseResult = parseImportResponse(payload);
  if (!parseResult.ok) {
    const firstError = parseResult.errors && parseResult.errors[0];
    notifyError({
      title: "Import payload rejected",
      body:  firstError ? firstError.path + ": " + firstError.message : "Unknown parse error"
    });
    return;
  }

  // Step 3: drift-check (per-kind FK membership).
  const live = getActiveEngagement();
  const drift = checkImportDrift(parseResult.parsed, live);
  if (!drift.ok) {
    const segments = [];
    if (drift.missingEnvIds.length > 0)         segments.push(drift.missingEnvIds.length + " env(s)");
    if (drift.missingGapIds.length > 0)         segments.push(drift.missingGapIds.length + " gap(s)");
    if (drift.invalidBusinessDriverIds.length > 0) segments.push(drift.invalidBusinessDriverIds.length + " driver(s)");
    notifyError({
      title: "Import rejected: drift detected",
      body:  "Response references " + segments.join(" · ") + " not in this engagement. Re-issue notes or update the engagement first."
    });
    return;
  }

  // Step 4: open the preview modal · per-row review.
  renderImportPreview(document.body, parseResult.parsed, {
    defaultScope: "desired",
    drift:        drift,
    onApply: function(selectedItems, finalScope) {
      // Step 5: dispatch through the applier · kind-aware.
      const res = applyImportItems(live, selectedItems, {
        scope:      finalScope,
        provenance: {
          kind:      "discovery-note",                  // A20 · per SPEC §S47.9.1b
          source:    "workshop-notes-overlay",          // A20 · per SPEC §S47.9.5
          runId:     runId,
          mutatedAt: mutatedAt
        }
      });
      // Step 6: commit to v3 store + notify.
      if (res.engagement) setActiveEngagement(res.engagement);

      const appliedCount = (res.addedInstanceIds || []).length + (res.addedDriverIds || []).length + (res.closedGapIds || []).length;
      const errorCount = (res.errors || []).length;
      if (errorCount > 0) {
        const failedDetail = res.errors.slice(0, 3).map(function(e) {
          const firstMsg = (e.errors && e.errors[0] && e.errors[0].message) || "validation error";
          return "row " + (e.itemIndex + 1) + " (" + e.kind + "): " + firstMsg;
        }).join("; ");
        notifyError({
          title: "Partial import: " + appliedCount + " applied, " + errorCount + " failed",
          body:  failedDetail + (res.errors.length > 3 ? " (+ " + (res.errors.length - 3) + " more)" : "")
        });
      } else {
        const breakdown = [];
        if (res.addedInstanceIds.length > 0) breakdown.push(res.addedInstanceIds.length + " instance" + (res.addedInstanceIds.length === 1 ? "" : "s"));
        if (res.addedDriverIds.length > 0)   breakdown.push(res.addedDriverIds.length + " driver" + (res.addedDriverIds.length === 1 ? "" : "s"));
        if (res.closedGapIds.length > 0)     breakdown.push(res.closedGapIds.length + " gap closure" + (res.closedGapIds.length === 1 ? "" : "s"));
        notifySuccess({
          title: "Imported " + appliedCount + " item" + (appliedCount === 1 ? "" : "s"),
          body:  breakdown.join(" · ") + " · 'Note' chip auto-clears on engineer save."
        });
      }
    },
    onCancel: function() {
      // Preview cancelled · overlay stays open · engineer can re-push or re-import.
      setStatus("Import cancelled", "info");
    }
  });
}

function handleExportJson() {
  if (!overlayState) return;
  const data = {
    exportedAt:        new Date().toISOString(),
    bullets:           overlayState.bullets,
    processedMarkdown: overlayState.processedMarkdown,
    mappings:          overlayState.mappings,
    runId:             overlayState.lastRunId
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const today = new Date().toISOString().slice(0, 10);
  a.download = "workshop-notes-" + today + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  setStatus("Exported JSON", "ok");
}

function handleExportPdf() {
  // Step 4 stub: trigger browser print dialog with the upper pane
  // visible. A proper PDF render is a v1.5 polish item (would need
  // a tiny print stylesheet + bibliographic metadata).
  setStatus("PDF export: use browser Print → Save as PDF", "info");
  notifyInfo({ title: "PDF export", body: "Use your browser's Print dialog (Cmd+P / Ctrl+P) and choose 'Save as PDF'. A polished PDF export is queued for v1.5." });
}

function handleEsc() {
  // Save draft + close. Per A10 the draft persists and the next open
  // gets a resume prompt.
  saveDraft();
  closeOverlay();
  overlayState = null;
}

// openWorkshopNotesOverlay · main exported entry point.
//
// Reads the draft from localStorage; if present, prompts the engineer
// to Resume or Start fresh (per framing-doc A10). On Resume, restores
// bullets + processedMarkdown + mappings. On Start fresh, clears the
// draft.
//
// Mounts the dual-pane DOM inside the shared Overlay component +
// wires the toolbar buttons + auto-bullet behavior + Cmd+Enter
// shortcut.
export function openWorkshopNotesOverlay(opts) {
  opts = opts || {};

  // Resume prompt (per A10). Only fired when a draft exists and the
  // caller didn't explicitly opt out (e.g. opts.skipResumePrompt for
  // test fixtures or programmatic re-open).
  const existing = loadDraft();
  let initialBullets = [];
  let initialProcessedMd = "";
  let initialMappings = [];
  let initialLastBulletsText = "";
  if (existing && (existing.bullets.length > 0 || existing.processedMarkdown.length > 0)) {
    if (!opts.skipResumePrompt) {
      const savedAt = existing.savedAt ? new Date(existing.savedAt).toLocaleString() : "earlier";
      const resume = window.confirm(
        "You have unsaved Workshop Notes from " + savedAt + ".\n\n" +
        "Resume previous notes? (Cancel = Start fresh; discards draft)"
      );
      if (!resume) {
        clearDraft();
      } else {
        initialBullets = existing.bullets;
        initialProcessedMd = existing.processedMarkdown;
        initialMappings = existing.mappings;
        initialLastBulletsText = existing.lastBulletsText || existing.bullets.map(b => "- " + b).join("\n");
      }
    } else {
      initialBullets = existing.bullets;
      initialProcessedMd = existing.processedMarkdown;
      initialMappings = existing.mappings;
      initialLastBulletsText = existing.lastBulletsText || existing.bullets.map(b => "- " + b).join("\n");
    }
  }

  const body = buildWorkshopNotesBody();

  openOverlay({
    title:       "AI Notes · Workshop Notes",
    lede:        "Type customer-workshop bullets in the lower pane. Push to AI structures them + suggests canvas mappings. Click [Import to canvas] to feed mappings into the importer.",
    body:        body,
    kind:        "workshop-notes",
    size:        "large"
  });

  // Wire references AFTER mount so DOM is live.
  const textarea  = body.querySelector("[data-workshop-lower-pane] textarea");
  const processed = body.querySelector("[data-workshop-processed]");
  const mappings  = body.querySelector("[data-workshop-mappings]");
  const status    = body.querySelector("[data-workshop-status]");
  const buttons   = Array.from(body.querySelectorAll("[data-workshop-action]"));

  overlayState = {
    lowerTextareaEl: textarea,
    processedEl:     processed,
    mappingsEl:      mappings,
    statusEl:        status,
    toolbarButtons:  buttons,
    bullets:         initialBullets,
    processedMarkdown: initialProcessedMd,
    mappings:        initialMappings,
    lastBulletsText: initialLastBulletsText,
    lastRunId:       null
  };

  // Seed the textarea with initial bullets (preserve indentation if
  // we have a lastBulletsText; otherwise reconstruct from bullets[]).
  if (initialLastBulletsText) {
    textarea.value = initialLastBulletsText;
  } else if (initialBullets.length > 0) {
    textarea.value = initialBullets.map(b => "- " + b).join("\n");
  }

  setupAutoBullet(textarea);
  textarea.focus();

  repaintUpperPane();

  // Toolbar button handlers.
  buttons.forEach(btn => {
    btn.addEventListener("click", function() {
      const action = btn.getAttribute("data-workshop-action");
      if (action === "push")               { handlePushToAi("delta"); }
      else if (action === "reeval")         { handlePushToAi("full"); }
      else if (action === "import-to-canvas") { handleImportToCanvas(); }
      else if (action === "export-json")    { handleExportJson(); }
      else if (action === "export-pdf")     { handleExportPdf(); }
    });
  });

  // Cmd+Enter / Ctrl+Enter inside the textarea triggers push-to-AI
  // (per framing-doc A3 keyboard shortcut).
  textarea.addEventListener("keydown", function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handlePushToAi("delta");
    }
  });
}
