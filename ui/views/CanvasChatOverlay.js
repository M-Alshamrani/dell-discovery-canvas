// ui/views/CanvasChatOverlay.js
//
// SPEC §S20 · Canvas Chat overlay. Dark-theme modal with monospace
// input, send affordance, scrolling transcript, token-budget meter,
// and Clear-chat affordance. Reuses ui/components/Overlay.js for the
// modal frame so it inherits Esc/X/backdrop close + persist semantics.
//
// Wires:
//   - state/engagementStore     (active engagement is the chat context)
//   - state/chatMemory          (per-engagement transcript persistence)
//   - services/chatService      (streamChat orchestration)
//   - services/realChatProvider (active provider via aiService; rc.7-arc-1
//                                removed the legacy Mock provider per
//                                feedback_no_mocks.md)
//   - core/aiConfig             (provider config)
//
// Forbidden (RULES §16 CH1+CH2):
//   - importing state/sessionState.js
//   - importing state/collections/*Actions.js (read-only v1)
//
// Authority: docs/v3.0/SPEC.md §S20.12 · docs/v3.0/TESTS.md §T20 ·
//            docs/RULES.md §16.

import { openOverlay, closeOverlay }         from "../components/Overlay.js";
import { getActiveEngagement }                from "../../state/engagementStore.js";
import {
  loadTranscript, saveTranscript, clearTranscript, summarizeIfNeeded
}                                              from "../../state/chatMemory.js";
import { streamChat }                          from "../../services/chatService.js";
import { createRealChatProvider }             from "../../services/realChatProvider.js";
import { loadAiConfig, saveAiConfig, isActiveProviderReady, PROVIDERS } from "../../core/aiConfig.js";
import { chatCompletion }                      from "../../services/aiService.js";
import { openSettingsModal }                   from "./SettingsModal.js";
import { confirmAction }                       from "../components/Notify.js";
// SPEC §S20.17 + RULES §16 CH18 — markdown rendering on assistant bubbles
// only. User bubbles stay textContent (no HTML interpretation; XSS guard).
// marked v13 escapes raw HTML by default; we add a defensive sanitize step
// for javascript: URLs after parsing.
import { marked }                              from "../../vendor/marked/marked.min.js";
// rc.3 #5 (SPEC §S29.5) — chat right-rail populated with saved v3.1 skills.
// Click a card → mini parameter form (or one-shot drop for parameter-less
// skills) → resolved prompt drops into the chat input.
// rc.3 #7 (SPEC §S29.7) — Skill Builder access lives inside the right-rail
// ("+ Author new skill" footer button) since the topbar consolidated to a
// single AI surface (Chat).
import { loadV3Skills }                        from "../../state/v3SkillStore.js";
import { resolveTemplate }                     from "../../services/pathResolver.js";
import { openSkillBuilderOverlay }             from "../skillBuilderOpener.js";
// BUG-020 (2026-05-03) — streaming-time handshake strip. Pre-fix, the
// chatService strip ran ONLY on onComplete; if a model emitted the
// handshake mid-stream (Gemini sometimes does on a subsequent turn),
// the bubble flashed it during streaming. Now onToken applies the
// shared strip to the accumulated buffer before each markdown re-parse.
import { stripHandshake }                      from "../../services/chatHandshake.js";
// BUG-013 Path B (2026-05-03) — streaming-time UUID scrub. Same
// defense-in-depth pattern as the handshake: scrub bare v3-format
// UUIDs in prose with resolved labels at every onToken so the bubble
// never flashes raw UUIDs even if a model slips one in mid-stream.
import { buildLabelMap, buildManifestLabelMap, scrubUuidsInProse } from "../../services/uuidScrubber.js";
// SPEC §S34 R34.8-R34.11 (rc.4-dev / Arc 3b) - dynamic try-asking.
import { generateTryAskingPrompts }            from "../../services/tryAskingPrompts.js";

// Module-scope state for the open overlay. Only one chat overlay is
// open at a time; Overlay.js enforces the singleton pattern.
//
// BUG-017 fix (2026-05-02 PM): the prior `providerMode: "mock"|"real"`
// toggle was removed. The chat ALWAYS uses the user's configured
// active provider from aiConfig. Mock provider stays available for
// the test suite via createMockChatProvider; not surfaced in the UI.
let state = {
  engagement:   null,
  engagementId: null,
  transcript:   { messages: [], summary: null },
  isStreaming:  false
};

// Example prompts shown when transcript is empty. Per SPEC §S34 R34.10
// + R34.11 (rc.4-dev / Arc 3) these are the FALLBACK set used when the
// engagement is empty; live empty-state painter calls
// generateTryAskingPrompts(state.engagement) and renders ITS output.
// Kept exported via the test handle so V-TRY-ASK-3 can compare against
// the canonical fallback content.
const EXAMPLE_PROMPTS = [
  "How many High-urgency gaps are open?",
  "Which environments have the most non-Dell instances?",
  "What initiatives serve our cyber resilience driver?",
  "Summarize the customer's strategic drivers in two sentences."
];

// Per SPEC §S34 R34.3 (rc.4-dev / Arc 3) - human-readable status message
// per CHAT_TOOLS entry. The chat overlay paints these in a status pill
// during tool-use rounds so the user sees what the AI is doing rather
// than a flat "thinking..." for 3-8 seconds. Unknown tool names fall
// back to TOOL_STATUS_MESSAGES.__default__.
const TOOL_STATUS_MESSAGES = {
  "selectGapsKanban":           "Reading the gaps board...",
  "selectMatrixView":           "Cross-referencing the architecture...",
  "selectVendorMix":            "Computing vendor mix...",
  "selectLinkedComposition":    "Walking entity links...",
  "selectConcept":              "Looking up the concept dictionary...",
  "selectWorkflow":             "Reading the workflow steps...",
  "selectExecutiveSummaryInputs": "Gathering executive summary...",
  "selectAnalyticalCanvas":     "Computing canvas analytics...",
  "selectProjects":             "Reading projects + roadmap...",
  "selectHealthSummary":        "Analyzing engagement health...",
  "__default__":                "Looking up data..."
};

// openCanvasChat() — entry point from app.js topbar handler.
export function openCanvasChat() {
  state.engagement = getActiveEngagement();
  state.engagementId = (state.engagement && state.engagement.meta && state.engagement.meta.engagementId) || null;
  state.transcript = state.engagementId ? loadTranscript(state.engagementId) : { messages: [], summary: null };
  // Per SPEC §S34 R34.9 (rc.4-dev / Arc 3b) - reset the per-overlay-open
  // try-asking seed so the empty-state shows fresh prompts on each open
  // (but stays stable while a single open session is on screen).
  state._tryAskingSeed = (Date.now() & 0x7FFFFFFF) || 1;

  const body   = buildBody();
  const footer = buildFooter();

  openOverlay({
    // Renamed per SPEC §S32 R32.13 (rc.4-dev / Arc 1) — user-facing string
    // changes; internal symbols (openCanvasChat, .canvas-chat-* CSS) stay.
    title:   "Canvas AI Assistant",
    lede:    "Ask anything about your discovery canvas. Grounded in the data model + your live engagement.",
    body:    body,
    footer:  footer,
    kind:    "canvas-chat",
    size:    "chat",
    persist: true
  });

  // Inject the provider toggle + Clear button into the head-extras slot.
  injectHeaderExtras();

  // Focus input on open + render initial transcript.
  setTimeout(function() {
    const input = body.querySelector(".canvas-chat-input");
    if (input) input.focus();
    paintTranscript(body);
  }, 50);
}

function buildBody() {
  // rc.8.b / R5 redesign (per SPEC §S46.7 + RULES §16 CH36.f/g):
  //   <body>
  //     <tabs>            ← permanent Chat + permanent Skills + dynamic [Skill: <name>]
  //     <chat-tab>        ← existing chat surface (Phase 3 row layout: main + rail)
  //     <skills-tab>      ← read-only launcher list
  //     <skill-tab>       ← dynamic, ONE at a time (R5 skeleton; R6 wires run)
  //   </body>
  const body = document.createElement("div");
  body.className = "canvas-chat-body";

  // ── Tab strip (rc.8.b / R5) ────────────────────────────────────
  const tabs = document.createElement("div");
  tabs.className = "canvas-chat-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("data-canvas-chat-tabs", "");
  const chatTabBtn = _buildTabButton("chat", "Chat", true);
  const skillsTabBtn = _buildTabButton("skills", "Skills", false);
  tabs.appendChild(chatTabBtn);
  tabs.appendChild(skillsTabBtn);
  body.appendChild(tabs);

  // ── Chat tab content (existing surface · row layout) ───────────
  const chatPane = document.createElement("div");
  chatPane.className = "canvas-chat-tab-content canvas-chat-chat-pane is-active";
  chatPane.setAttribute("data-canvas-chat-tab-content", "chat");
  body.appendChild(chatPane);

  // ── Main column ─────────────────────────────────────────────────
  const main = document.createElement("div");
  main.className = "canvas-chat-main";
  chatPane.appendChild(main);

  // Transcript scroll region.
  const scroll = document.createElement("div");
  scroll.className = "canvas-chat-transcript";
  scroll.setAttribute("data-canvas-chat-transcript", "");
  main.appendChild(scroll);

  // Empty-state hint (rendered conditionally by paintTranscript).
  const empty = document.createElement("div");
  empty.className = "canvas-chat-empty";
  empty.style.display = "none";
  empty.innerHTML =
    '<div class="canvas-chat-empty-eyebrow">Try asking</div>' +
    '<div class="canvas-chat-empty-grid"></div>';
  scroll.appendChild(empty);

  // Token-budget meter (above the input).
  const meter = document.createElement("div");
  meter.className = "canvas-chat-meter";
  meter.setAttribute("data-canvas-chat-meter", "");
  meter.textContent = "ready";
  main.appendChild(meter);

  // Input row.
  const inputRow = document.createElement("div");
  inputRow.className = "canvas-chat-input-row";

  const input = document.createElement("textarea");
  input.className = "canvas-chat-input";
  input.placeholder = "Ask the canvas anything...";
  input.rows = 1;
  input.spellcheck = true;
  input.setAttribute("aria-label", "Chat input");

  const send = document.createElement("button");
  send.type = "button";
  send.className = "canvas-chat-send";
  send.setAttribute("aria-label", "Send");
  send.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<line x1="22" y1="2" x2="11" y2="13"/>' +
    '<polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  inputRow.appendChild(input);
  inputRow.appendChild(send);
  main.appendChild(inputRow);

  // Wire send + Enter keystroke.
  send.addEventListener("click", function() { handleSend(body); });
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(body);
    }
  });
  input.addEventListener("input", function() {
    // Auto-grow up to 6 rows.
    input.style.height = "auto";
    const lines = Math.min(6, Math.max(1, input.value.split("\n").length));
    input.style.height = (lines * 22 + 16) + "px";
  });

  // ── Right rail (Skills) ────────────────────────────────────────
  // rc.3 #5 (SPEC §S29.5) — populated with saved v3.1 skills. The rail
  // is hidden by default; the head-extras toggle flips .is-open. Click
  // a skill card → mini parameter form (or one-shot drop for parameter-
  // less skills) → resolved prompt populates the chat input.
  const rail = document.createElement("aside");
  rail.className = "canvas-chat-rail";
  rail.setAttribute("data-canvas-chat-rail", "");
  rail.innerHTML =
    '<div class="canvas-chat-rail-head">' +
      '<div class="canvas-chat-rail-eyebrow">Shortcuts</div>' +
      '<div class="canvas-chat-rail-title">Skills</div>' +
    '</div>' +
    '<div class="canvas-chat-rail-body" data-canvas-chat-rail-body></div>';
  chatPane.appendChild(rail);
  paintSkillRail(body);

  // ── Skills tab content (rc.8.b / R5 · read-only launcher list) ──
  const skillsPane = document.createElement("div");
  skillsPane.className = "canvas-chat-tab-content canvas-chat-skills-pane";
  skillsPane.setAttribute("data-canvas-chat-tab-content", "skills");
  skillsPane.setAttribute("data-canvas-chat-skills-content", "");
  body.appendChild(skillsPane);
  paintSkillsLauncher(skillsPane);

  // Tab click handlers
  chatTabBtn.addEventListener("click", function() { _switchCanvasChatTab(body, "chat"); });
  skillsTabBtn.addEventListener("click", function() { _switchCanvasChatTab(body, "skills"); });

  return body;
}

// ─── rc.8.b / R5 · tab system helpers (per SPEC §S46.7) ─────────────

function _buildTabButton(tabId, label, isActive) {
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "canvas-chat-tab" + (isActive ? " is-active" : "");
  btn.setAttribute("role", "tab");
  btn.setAttribute("data-canvas-chat-tab", tabId);
  btn.setAttribute("aria-selected", isActive ? "true" : "false");
  btn.textContent = label;
  return btn;
}

function _switchCanvasChatTab(body, tabId) {
  if (!body) return;
  // Update tab buttons
  body.querySelectorAll("[data-canvas-chat-tab]").forEach(function(b) {
    var match = b.getAttribute("data-canvas-chat-tab") === tabId;
    b.classList.toggle("is-active", match);
    b.setAttribute("aria-selected", match ? "true" : "false");
  });
  // Update tab content panes
  body.querySelectorAll("[data-canvas-chat-tab-content]").forEach(function(p) {
    p.classList.toggle("is-active", p.getAttribute("data-canvas-chat-tab-content") === tabId);
  });
}

// ─── rc.8.b / R5 · Skills launcher list (read-only per CH36.g) ──────

function paintSkillsLauncher(host) {
  host.innerHTML = "";
  var head = document.createElement("div");
  head.className = "canvas-chat-skills-head";
  head.innerHTML =
    '<div class="canvas-chat-skills-eyebrow">Skills launcher</div>' +
    '<div class="canvas-chat-skills-title">Run a saved skill</div>' +
    '<div class="canvas-chat-skills-help">Click Run to launch a skill in a dedicated tab. ' +
    'Author + edit skills in Settings → Skills builder.</div>';
  host.appendChild(head);

  var skills = [];
  try { skills = Object.values(loadV3Skills() || {}); } catch (_e) { skills = []; }

  if (skills.length === 0) {
    var empty = document.createElement("div");
    empty.className = "canvas-chat-skills-empty";
    empty.textContent = "No saved skills yet. Open Settings → Skills builder to author your first.";
    host.appendChild(empty);
    return;
  }

  var list = document.createElement("div");
  list.className = "canvas-chat-skills-list";
  skills.forEach(function(skill) {
    list.appendChild(_buildLauncherRow(skill));
  });
  host.appendChild(list);
}

function _buildLauncherRow(skill) {
  var row = document.createElement("div");
  row.className = "canvas-chat-skills-row";
  row.setAttribute("data-launcher-skill-id", skill.skillId);

  var info = document.createElement("div");
  info.className = "canvas-chat-skills-row-info";
  var labelEl = document.createElement("div");
  labelEl.className = "canvas-chat-skills-row-label";
  labelEl.textContent = skill.label || skill.skillId;
  info.appendChild(labelEl);
  if (skill.description) {
    var descEl = document.createElement("div");
    descEl.className = "canvas-chat-skills-row-desc";
    descEl.textContent = skill.description;
    info.appendChild(descEl);
  }
  if (skill.outputFormat) {
    var meta = document.createElement("div");
    meta.className = "canvas-chat-skills-row-meta";
    meta.textContent = skill.outputFormat + (skill.mutationPolicy ? " · " + skill.mutationPolicy : "");
    info.appendChild(meta);
  }
  row.appendChild(info);

  var runBtn = document.createElement("button");
  runBtn.type = "button";
  runBtn.className = "btn-primary canvas-chat-skills-row-run";
  runBtn.textContent = "Run";
  runBtn.addEventListener("click", function() { launchSkill(skill); });
  row.appendChild(runBtn);

  return row;
}

// paintSkillRail — renders saved-skill cards into the right rail.
// Called on overlay open and after a skill is run (so future cards
// reflect the persistent state). Empty state surfaces a friendly hint
// + a button that opens the Skill Builder. Populated state appends a
// "+ Author new skill" footer button (rc.3 #7 routes Lab access here).
function paintSkillRail(body) {
  const railBody = body.querySelector("[data-canvas-chat-rail-body]");
  if (!railBody) return;
  railBody.innerHTML = "";

  const skillsById = loadV3Skills();
  const ids = Object.keys(skillsById);

  if (ids.length === 0) {
    const empty = document.createElement("div");
    empty.className = "canvas-chat-rail-empty";
    empty.innerHTML = "Saved skills will appear here as one-click shortcuts.<br/>Author one to get started.";
    railBody.appendChild(empty);
    railBody.appendChild(buildAuthorSkillButton());
    return;
  }

  const list = document.createElement("div");
  list.className = "canvas-chat-rail-list";
  for (const id of ids) {
    list.appendChild(buildSkillCard(skillsById[id], body));
  }
  railBody.appendChild(list);
  railBody.appendChild(buildAuthorSkillButton());
}

// buildAuthorSkillButton — secondary affordance routing power-users to
// the Skill Builder overlay (rc.3 #7 demoted Lab off the topbar).
function buildAuthorSkillButton() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "canvas-chat-rail-author-btn";
  btn.setAttribute("data-canvas-chat-rail-author-btn", "");
  btn.textContent = "+ Author new skill";
  btn.title = "Open the Skill Builder to author a new AI skill";
  btn.addEventListener("click", function() { openSkillBuilderOverlay(); });
  return btn;
}

// buildSkillCard — one card per saved skill. Click → expand inline
// parameter form; "Use" submits resolved prompt to the chat input.
function buildSkillCard(skill, body) {
  const card = document.createElement("div");
  card.className = "canvas-chat-rail-card";
  card.setAttribute("data-canvas-chat-rail-card", "");
  card.setAttribute("data-skill-id", skill.skillId);

  const head = document.createElement("button");
  head.type = "button";
  head.className = "canvas-chat-rail-card-head";
  const title = document.createElement("div");
  title.className = "canvas-chat-rail-card-title";
  title.textContent = skill.label || skill.skillId;
  head.appendChild(title);
  if (skill.description) {
    const desc = document.createElement("div");
    desc.className = "canvas-chat-rail-card-desc";
    desc.textContent = skill.description;
    head.appendChild(desc);
  }
  const meta = document.createElement("div");
  meta.className = "canvas-chat-rail-card-meta";
  const paramCount = (skill.parameters || []).length;
  meta.textContent = paramCount === 0
    ? "Engagement-wide · click to use"
    : paramCount + " parameter" + (paramCount === 1 ? "" : "s");
  head.appendChild(meta);
  card.appendChild(head);

  const formHost = document.createElement("div");
  formHost.className = "canvas-chat-rail-card-form";
  formHost.style.display = "none";
  card.appendChild(formHost);

  head.addEventListener("click", function() {
    const isOpen = formHost.style.display !== "none";
    // Close every other open card so only one form is visible.
    body.querySelectorAll(".canvas-chat-rail-card-form").forEach(function(f) {
      f.style.display = "none";
      f.innerHTML = "";
    });
    body.querySelectorAll(".canvas-chat-rail-card").forEach(function(c) {
      c.classList.remove("is-open");
    });
    if (isOpen) return;   // toggle close

    if (paramCount === 0) {
      // Parameter-less skill: resolve immediately and drop into input.
      dropResolvedPromptIntoInput(skill, {}, body);
      return;
    }
    // Parameterized skill: render the inline form.
    card.classList.add("is-open");
    formHost.style.display = "";
    formHost.appendChild(buildParameterForm(skill, body, formHost));
  });

  return card;
}

function buildParameterForm(skill, body, formHost) {
  const form = document.createElement("form");
  form.className = "canvas-chat-rail-form";
  const eng = getActiveEngagement();

  const values = {};
  for (const p of (skill.parameters || [])) {
    const field = document.createElement("label");
    field.className = "canvas-chat-rail-field";
    const lbl = document.createElement("span");
    lbl.className = "canvas-chat-rail-field-label";
    lbl.textContent = p.description || p.name;
    if (p.required) {
      const req = document.createElement("span");
      req.className = "canvas-chat-rail-field-required";
      req.textContent = " *";
      lbl.appendChild(req);
    }
    field.appendChild(lbl);

    if (p.type === "entityId") {
      const sel = document.createElement("select");
      sel.className = "canvas-chat-rail-field-input";
      const kindKey = entityKindKeyFromHint(p.description) || entityKindKeyFromName(p.name);
      const collection = (kindKey && eng && eng[kindKey]) || null;
      const allIds = (collection && collection.allIds) || [];
      sel.innerHTML = '<option value="">— pick —</option>' +
        allIds.map(function(id) {
          const ent = collection.byId[id] || {};
          const text = ent.label || ent.name || ent.description || id;
          return '<option value="' + escapeAttr(id) + '">' + escapeText(String(text).slice(0, 60)) + '</option>';
        }).join("");
      if (allIds.length === 0) {
        sel.disabled = true;
        sel.innerHTML = '<option value="">no ' + (kindKey || "entities") + ' loaded</option>';
      }
      sel.addEventListener("change", function(e) { values[p.name] = e.target.value; });
      field.appendChild(sel);
    } else {
      const inp = document.createElement("input");
      inp.type = p.type === "number" ? "number" : "text";
      inp.className = "canvas-chat-rail-field-input";
      inp.placeholder = p.type === "boolean" ? "true / false" : p.type;
      inp.addEventListener("input", function(e) {
        values[p.name] = p.type === "number"
          ? (e.target.value === "" ? "" : Number(e.target.value))
          : (p.type === "boolean" ? /^true$/i.test(e.target.value) : e.target.value);
      });
      field.appendChild(inp);
    }
    form.appendChild(field);
  }

  const actions = document.createElement("div");
  actions.className = "canvas-chat-rail-form-actions";
  const useBtn = document.createElement("button");
  useBtn.type = "submit";
  useBtn.className = "btn-primary canvas-chat-rail-use-btn";
  useBtn.textContent = "Use skill";
  actions.appendChild(useBtn);
  form.appendChild(actions);

  const errEl = document.createElement("div");
  errEl.className = "canvas-chat-rail-form-error";
  errEl.style.display = "none";
  form.appendChild(errEl);

  form.addEventListener("submit", function(e) {
    e.preventDefault();
    // Validate required params filled.
    const missing = (skill.parameters || []).filter(function(p) {
      return p.required && (values[p.name] === undefined || values[p.name] === "" || values[p.name] === null);
    });
    if (missing.length > 0) {
      errEl.style.display = "";
      errEl.textContent = "Missing: " + missing.map(function(p) { return p.name; }).join(", ");
      return;
    }
    errEl.style.display = "none";
    dropResolvedPromptIntoInput(skill, values, body);
    // Close the form once dropped.
    formHost.style.display = "none";
    formHost.innerHTML = "";
    const card = formHost.closest(".canvas-chat-rail-card");
    if (card) card.classList.remove("is-open");
  });

  return form;
}

// dropResolvedPromptIntoInput — resolves the skill template against the
// active engagement + the supplied parameter values, and drops the
// resolved string into the chat input. The user clicks Send to actually
// dispatch the message; this matches the example-prompt UX so the user
// always sees what's being sent before send.
function dropResolvedPromptIntoInput(skill, paramValues, body) {
  const eng = getActiveEngagement() || {};
  const ctx = {
    engagement:     eng,
    customer:       eng.customer || {},
    engagementMeta: eng.meta || {},
    catalogVersions: eng.catalogVersions || {}
  };
  // Bind parameter primitives directly, and entityId parameters under
  // ctx.context.<name>.<field> so {{context.<name>.field}} resolves.
  for (const p of (skill.parameters || [])) {
    if (!(p.name in paramValues)) continue;
    ctx[p.name] = paramValues[p.name];
    if (p.type === "entityId") {
      const kindKey = entityKindKeyFromHint(p.description) || entityKindKeyFromName(p.name);
      const ent = kindKey && eng[kindKey] && eng[kindKey].byId && eng[kindKey].byId[paramValues[p.name]];
      if (ent) {
        if (!ctx.context) ctx.context = {};
        ctx.context[p.name] = ent;
      }
    }
  }
  const resolved = resolveTemplate(skill.promptTemplate || "", ctx, { skillId: skill.skillId });
  const input = body.querySelector(".canvas-chat-input");
  if (input) {
    input.value = resolved;
    input.dispatchEvent(new Event("input"));
    input.focus();
  }
}

// Map a parameter description hint to an engagement collection key
// (mirrors the same helper in ui/views/SkillBuilder.js so the rail
// resolves entityId parameters with the same convention).
function entityKindKeyFromHint(description) {
  if (typeof description !== "string") return null;
  const lower = description.toLowerCase();
  if (lower.includes("gap"))         return "gaps";
  if (lower.includes("driver"))      return "drivers";
  if (lower.includes("environment")) return "environments";
  if (lower.includes("instance"))    return "instances";
  return null;
}

function entityKindKeyFromName(name) {
  if (typeof name !== "string") return null;
  const lower = name.toLowerCase();
  if (lower === "gap"         || lower === "gapid")         return "gaps";
  if (lower === "driver"      || lower === "driverid")      return "drivers";
  if (lower === "environment" || lower === "environmentid") return "environments";
  if (lower === "instance"    || lower === "instanceid")    return "instances";
  return null;
}

function escapeAttr(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
function escapeText(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// SPEC §S34 R34.1 + R34.4 + R34.5 (rc.4-dev / Arc 3) - thinking-state
// paint helpers. Each owns a small DOM region so the chat overlay's
// onToken / onToolUse / onRoundStart callbacks can paint cleanly.

function paintTypingIndicator() {
  // Clear any prior indicator before re-painting.
  clearTypingIndicator();
  const scroll = document.querySelector(".overlay[data-kind='canvas-chat'] .canvas-chat-transcript");
  if (!scroll) return;
  const ind = document.createElement("div");
  ind.className = "canvas-chat-typing-indicator";
  ind.setAttribute("aria-label", "AI is thinking");
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    dot.className = "canvas-chat-typing-dot";
    ind.appendChild(dot);
  }
  scroll.appendChild(ind);
  scroll.scrollTop = scroll.scrollHeight;
}
function clearTypingIndicator() {
  document.querySelectorAll(".overlay[data-kind='canvas-chat'] .canvas-chat-typing-indicator")
    .forEach(el => el.remove());
}

function paintToolStatus(toolName) {
  clearToolStatus();
  const scroll = document.querySelector(".overlay[data-kind='canvas-chat'] .canvas-chat-transcript");
  if (!scroll) return;
  const pill = document.createElement("div");
  pill.className = "canvas-chat-tool-status";
  pill.setAttribute("data-tool-name", toolName || "");
  pill.textContent = TOOL_STATUS_MESSAGES[toolName] || TOOL_STATUS_MESSAGES.__default__;
  scroll.appendChild(pill);
  scroll.scrollTop = scroll.scrollHeight;
}
function clearToolStatus() {
  document.querySelectorAll(".overlay[data-kind='canvas-chat'] .canvas-chat-tool-status")
    .forEach(el => el.remove());
}

function paintRoundBadge(evt) {
  // R34.5 - only paint for round >= 2 (the 1st round is implicit).
  const round = evt && evt.round;
  if (typeof round !== "number" || round < 2) return;
  const host = document.querySelector(".overlay[data-kind='canvas-chat'] .canvas-chat-meter") ||
               document.querySelector(".overlay[data-kind='canvas-chat'] .canvas-chat-transcript");
  if (!host) return;
  document.querySelectorAll(".overlay[data-kind='canvas-chat'] .canvas-chat-round-badge")
    .forEach(el => el.remove());
  const badge = document.createElement("span");
  badge.className = "canvas-chat-round-badge";
  badge.textContent = "Round " + round + (evt.totalRounds ? " of " + evt.totalRounds : "");
  host.appendChild(badge);
  setTimeout(() => {
    badge.classList.add("is-fading");
    setTimeout(() => { badge.remove(); }, 400);
  }, 2000);
}

// Test handles - synthetic invocation paths so the diagnostic suite
// can drive each painter without orchestrating a full streamChat round-
// trip. Used by V-THINK-3 / V-THINK-4 / V-THINK-5.
export function _paintTypingIndicatorForTests() { paintTypingIndicator(); }
export function _clearTypingIndicatorForTests() { clearTypingIndicator(); }
export function _paintToolStatusForTests(toolName) { paintToolStatus(toolName); }
export function _paintRoundBadgeForTests(evt) { paintRoundBadge(evt); }

// ─── rc.8.b / R5 · Skill launch + dynamic-tab system (per SPEC §S46.7) ─

// Module-level state — single skill running at a time (CH36.f).
var _activeRunningSkill = null;

// launchSkill(skill) - per SPEC §S46.7 launch flow.
// If another skill is currently active, prompts the user to cancel it
// before launching the new one (CH36.f single-skill invariant). Otherwise
// opens the dynamic [Skill: <label>] tab + the skill panel right-rail
// (R5 skeleton; R6 wires the actual run).
//
// Single-skill state (_activeRunningSkill) is tracked even when the
// Canvas Chat overlay is not currently mounted -- the cancel-confirm
// modal mounts on document.body and the test surface drives launchSkill
// directly without opening the overlay.
export function launchSkill(skill) {
  if (!skill || !skill.skillId) return;
  // CH36.f - if another skill is running, surface the cancel-confirm modal.
  if (_activeRunningSkill && _activeRunningSkill.skillId !== skill.skillId) {
    var bodyForModal = document.querySelector(".overlay[data-kind='canvas-chat'] .canvas-chat-body");
    _showCancelConfirmModal(bodyForModal, _activeRunningSkill, skill);
    return;
  }
  var body = document.querySelector(".overlay[data-kind='canvas-chat'] .canvas-chat-body");
  if (!body) {
    // Overlay not mounted -- still record the active running skill so a
    // subsequent launch trips the CH36.f cancel-confirm path.
    _activeRunningSkill = skill;
    return;
  }
  _openDynamicSkillTab(body, skill);
}

function _showCancelConfirmModal(body, currentSkill, nextSkill) {
  // Remove any existing confirm modal first (idempotent).
  var existing = document.querySelector("[data-skill-cancel-confirm]");
  if (existing) existing.remove();
  var modal = document.createElement("div");
  modal.className = "skill-cancel-confirm-modal";
  modal.setAttribute("data-skill-cancel-confirm", "");
  modal.innerHTML =
    '<div class="skill-cancel-confirm-card">' +
      '<div class="skill-cancel-confirm-title">Cancel running skill?</div>' +
      '<div class="skill-cancel-confirm-msg">Currently running: <b>' +
        escapeText(currentSkill.label || currentSkill.skillId) + '</b><br>' +
        'Launch instead: <b>' + escapeText(nextSkill.label || nextSkill.skillId) + '</b><br>' +
        'The current skill\'s output and conversation will be lost.</div>' +
      '<div class="skill-cancel-confirm-actions">' +
        '<button type="button" class="btn-secondary" data-skill-cancel-stay>Stay on current</button>' +
        '<button type="button" class="btn-primary" data-skill-cancel-and-launch>Cancel and launch new</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.querySelector("[data-skill-cancel-stay]").addEventListener("click", function() { modal.remove(); });
  modal.querySelector("[data-skill-cancel-and-launch]").addEventListener("click", function() {
    modal.remove();
    _closeDynamicSkillTab(body);
    _openDynamicSkillTab(body, nextSkill);
  });
}

function _openDynamicSkillTab(body, skill) {
  // Insert tab button into the tab strip (after Skills tab).
  var tabs = body.querySelector("[data-canvas-chat-tabs]");
  if (!tabs) return;
  // Remove any existing dynamic tab (single-skill invariant).
  var existingDynBtn = tabs.querySelector("[data-canvas-chat-tab^='skill-']");
  if (existingDynBtn) existingDynBtn.remove();
  var existingDynPane = body.querySelector("[data-canvas-chat-tab-content^='skill-']");
  if (existingDynPane) existingDynPane.remove();

  var dynTabId = "skill-" + skill.skillId;
  var dynBtn = document.createElement("button");
  dynBtn.type = "button";
  dynBtn.className = "canvas-chat-tab canvas-chat-tab-dynamic";
  dynBtn.setAttribute("role", "tab");
  dynBtn.setAttribute("data-canvas-chat-tab", dynTabId);
  dynBtn.setAttribute("aria-selected", "false");
  var dynLabel = document.createElement("span");
  dynLabel.className = "canvas-chat-tab-dynamic-label";
  dynLabel.textContent = "Skill: " + (skill.label || skill.skillId);
  dynBtn.appendChild(dynLabel);
  // Use <span role="button"> to avoid invalid nested-button HTML.
  // The dynBtn is itself a <button>; nesting another would be invalid.
  var closeX = document.createElement("span");
  closeX.className = "canvas-chat-tab-dynamic-close";
  closeX.setAttribute("role", "button");
  closeX.setAttribute("tabindex", "0");
  closeX.setAttribute("aria-label", "Close skill tab");
  closeX.textContent = "×";
  closeX.addEventListener("click", function(e) {
    e.stopPropagation();
    e.preventDefault();
    // R5: simple close (R6 will add mid-run confirm modal per SPEC §S46.7).
    _closeDynamicSkillTab(body);
    _switchCanvasChatTab(body, "chat");
  });
  dynBtn.appendChild(closeX);
  dynBtn.addEventListener("click", function() { _switchCanvasChatTab(body, dynTabId); });
  tabs.appendChild(dynBtn);

  // Build dynamic tab content: chat dialog (left) + skill panel (right).
  var dynPane = document.createElement("div");
  dynPane.className = "canvas-chat-tab-content canvas-chat-skill-pane";
  dynPane.setAttribute("data-canvas-chat-tab-content", dynTabId);
  dynPane.setAttribute("data-canvas-chat-skill-pane", skill.skillId);

  var dialog = document.createElement("div");
  dialog.className = "canvas-chat-skill-dialog";
  dialog.setAttribute("data-canvas-chat-skill-dialog", "");
  dialog.innerHTML = '<div class="canvas-chat-skill-dialog-empty">' +
    'Skill conversation will stream here when you click <b>Run</b> on the right. ' +
    '(Run wiring lands at rc.8.b R6.)</div>';
  dynPane.appendChild(dialog);

  var panel = document.createElement("aside");
  panel.className = "canvas-chat-skill-panel";
  panel.setAttribute("data-canvas-chat-skill-panel", "");
  renderSkillPanelForRun(skill, panel);
  dynPane.appendChild(panel);

  body.appendChild(dynPane);

  // Switch to the new tab + record state.
  _activeRunningSkill = skill;
  _switchCanvasChatTab(body, dynTabId);
}

function _closeDynamicSkillTab(body) {
  if (!body) return;
  var dynBtn = body.querySelector("[data-canvas-chat-tab^='skill-']");
  if (dynBtn) dynBtn.remove();
  var dynPane = body.querySelector("[data-canvas-chat-tab-content^='skill-']");
  if (dynPane) dynPane.remove();
  _activeRunningSkill = null;
}

// renderSkillPanelForRun(skill, host) - per SPEC §S46.7 right-rail.
// Renders the skill panel: description + parameters (with file slot) +
// Run button + output preview area. R5 stub: Run button is wired but
// shows "wiring lands at R6" inline; R6 hooks up real-LLM streaming +
// output renderers per outputFormat.
export function renderSkillPanelForRun(skill, host) {
  if (!host) return;
  host.innerHTML = "";

  var head = document.createElement("div");
  head.className = "canvas-chat-skill-panel-head";
  var labelEl = document.createElement("div");
  labelEl.className = "canvas-chat-skill-panel-label";
  labelEl.textContent = (skill && skill.label) || "(unnamed skill)";
  head.appendChild(labelEl);
  if (skill && skill.description) {
    var descEl = document.createElement("div");
    descEl.className = "canvas-chat-skill-panel-desc";
    descEl.textContent = skill.description;
    head.appendChild(descEl);
  }
  if (skill && skill.outputFormat) {
    var meta = document.createElement("div");
    meta.className = "canvas-chat-skill-panel-meta";
    meta.textContent = "Output: " + skill.outputFormat +
      (skill.mutationPolicy ? " · policy: " + skill.mutationPolicy : "");
    head.appendChild(meta);
  }
  host.appendChild(head);

  // Parameters section
  var paramsSection = document.createElement("div");
  paramsSection.className = "canvas-chat-skill-panel-params";
  var paramsHead = document.createElement("div");
  paramsHead.className = "canvas-chat-skill-panel-section-head";
  paramsHead.textContent = "Inputs";
  paramsSection.appendChild(paramsHead);

  var params = (skill && Array.isArray(skill.parameters)) ? skill.parameters : [];
  if (params.length === 0) {
    var noParams = document.createElement("div");
    noParams.className = "canvas-chat-skill-panel-no-params";
    noParams.textContent = "(this skill has no run-time inputs)";
    paramsSection.appendChild(noParams);
  } else {
    params.forEach(function(p) {
      paramsSection.appendChild(_buildSkillPanelParamRow(p));
    });
  }
  host.appendChild(paramsSection);

  // Run button (rc.8.b / R6 · real-LLM wiring per CH36.b · feedback_no_mocks.md)
  var runRow = document.createElement("div");
  runRow.className = "canvas-chat-skill-panel-run-row";
  var runBtn = document.createElement("button");
  runBtn.type = "button";
  runBtn.className = "btn-primary canvas-chat-skill-panel-run";
  runBtn.setAttribute("data-skill-panel-run", "");
  runBtn.textContent = "Run skill";
  runBtn.addEventListener("click", async function() {
    runBtn.disabled = true;
    var origLabel = runBtn.textContent;
    runBtn.textContent = "Running...";
    try {
      await runSkill(skill, host);
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = origLabel;
    }
  });
  runRow.appendChild(runBtn);
  host.appendChild(runRow);

  // Output preview (R6 fills this)
  var preview = document.createElement("div");
  preview.className = "canvas-chat-skill-panel-output";
  preview.setAttribute("data-skill-panel-output", "");
  host.appendChild(preview);
}

function _buildSkillPanelParamRow(p) {
  var row = document.createElement("div");
  row.className = "canvas-chat-skill-panel-param-row";

  var labelEl = document.createElement("label");
  labelEl.className = "canvas-chat-skill-panel-param-label";
  labelEl.textContent = (p.name || "(unnamed)") + (p.required ? " *" : "");
  row.appendChild(labelEl);

  if (p.description) {
    var hint = document.createElement("div");
    hint.className = "canvas-chat-skill-panel-param-hint";
    hint.textContent = p.description;
    row.appendChild(hint);
  }

  var input;
  if (p.type === "file") {
    // SPEC §S46.8 / CH36.j — file parameter; client-side reader on Run.
    input = document.createElement("input");
    input.type = "file";
    input.setAttribute("data-skill-param", p.name || "");
    input.setAttribute("data-skill-param-type", "file");
    if (p.accepts) input.setAttribute("accept", p.accepts);
  } else if (p.type === "boolean") {
    input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("data-skill-param", p.name || "");
    input.setAttribute("data-skill-param-type", "boolean");
  } else if (p.type === "number") {
    input = document.createElement("input");
    input.type = "number";
    input.className = "settings-input";
    input.setAttribute("data-skill-param", p.name || "");
    input.setAttribute("data-skill-param-type", "number");
  } else {
    // string / entityId — plain text input at R5 (R6 may upgrade entityId
    // to a picker dropdown over the active engagement).
    input = document.createElement("input");
    input.type = "text";
    input.className = "settings-input";
    input.setAttribute("data-skill-param", p.name || "");
    input.setAttribute("data-skill-param-type", p.type || "string");
  }
  row.appendChild(input);
  return row;
}

// Test helper — close the overlay cleanly (used by V-FLOW-SKILL-V32-CHAT-TAB-1/2 finally clauses).
export function _closeCanvasChatForTests() {
  try {
    _activeRunningSkill = null;
    closeOverlay();
  } catch (_e) { /* best-effort */ }
}

// ─── rc.8.b / R6 · skill run-time (real-LLM, no mocks per CH36.b) ─────

// runSkill(skill, panelHost) - per SPEC §S46.7 / §S46.5 run-time wiring.
//
// Reads parameter inputs from the skill panel right-rail (panelHost),
// substitutes them into the saved skill.improvedPrompt (LLM-generated
// CARE-structured Anthropic-XML prompt authored at R3), calls the real
// LLM via services/aiService.js chatCompletion, and renders the response
// into the dynamic Skill tab's left chat dialog.
//
// Output format dispatch (per SPEC §S46.6 / CH36.d):
//   text          → render as AI turn in the chat dialog
//   dimensional   → render as JSON in the Skill panel output area
//                   (full heatmap renderer deferred to a polish arc)
//   json-array    → render as proposed-mutation list; R7's applyMutations
//                   wires the apply-gate per skill.mutationPolicy
//   scalar        → same as json-array (single-mutation case)
//
// File parameters (SPEC §S46.8 / CH36.j) are read client-side via
// FileReader.readAsText at run-time; content NEVER persists with the
// skill.
//
// NO mock providers anywhere in this path (per feedback_no_mocks.md).
// The chatCompletion call routes through whatever provider is active in
// loadAiConfig() (Anthropic / OpenAI-compat / Gemini / Local A/B / Dell
// Sales Chat) — same transport the regular Chat tab uses.
export async function runSkill(skill, panelHost) {
  if (!skill || typeof skill !== "object") return;
  if (typeof skill.improvedPrompt !== "string" || !skill.improvedPrompt.trim()) {
    _appendSkillDialogTurn("error",
      "This skill has no improved prompt. Open Settings → Skills builder, click Improve, then Save.");
    return;
  }

  // Step 1 — collect parameter values (file params resolve via FileReader).
  var paramValues;
  try {
    paramValues = await _collectSkillParamValues(skill, panelHost);
  } catch (e) {
    _appendSkillDialogTurn("error", "Failed to read parameters: " + (e && e.message || e));
    return;
  }

  // Step 2 — substitute {{paramName}} placeholders in improvedPrompt.
  var resolvedPrompt = _substituteSkillParams(skill.improvedPrompt, paramValues);

  // Step 3 — render the user turn (the resolved prompt) in the dialog.
  _appendSkillDialogTurn("user", resolvedPrompt);

  // Step 4 — real LLM call.
  try {
    var cfg = loadAiConfig();
    var activeKey = cfg && cfg.activeProvider;
    var active = cfg && cfg.providers && cfg.providers[activeKey];
    if (!active) {
      _appendSkillDialogTurn("error",
        "No active LLM provider configured. Open Settings → AI Providers to set one up.");
      return;
    }
    var res = await chatCompletion({
      providerKey: activeKey,
      baseUrl:     active.baseUrl,
      model:       active.model,
      apiKey:      active.apiKey,
      messages: [
        { role: "system", content: "You are running a saved skill. Follow the instructions in the user message; produce output in the format the skill specifies." },
        { role: "user",   content: resolvedPrompt }
      ]
    });
    var responseText = (res && res.text) || "";
    _renderSkillRunOutput(skill, panelHost, responseText);
  } catch (e) {
    _appendSkillDialogTurn("error", "Run failed: " + (e && e.message || e) +
      ". Try again, or check Settings → AI Providers.");
  }
}

// Reads parameter values from the panel's input rows.
// File-type params resolve via FileReader.readAsText (returns "" when
// no file picked).
async function _collectSkillParamValues(skill, host) {
  var values = {};
  var params = (skill && Array.isArray(skill.parameters)) ? skill.parameters : [];
  for (var i = 0; i < params.length; i++) {
    var p = params[i];
    if (!p || !p.name) continue;
    var input = host && host.querySelector("[data-skill-param='" + p.name + "']");
    if (!input) { values[p.name] = ""; continue; }
    if (p.type === "file") {
      var f = input.files && input.files[0];
      values[p.name] = f ? await _readFileAsText(f) : "";
    } else if (p.type === "boolean") {
      values[p.name] = input.checked ? "true" : "false";
    } else if (p.type === "number") {
      var n = input.valueAsNumber;
      values[p.name] = (typeof n === "number" && !isNaN(n)) ? String(n) : "0";
    } else {
      values[p.name] = input.value || "";
    }
  }
  return values;
}

function _readFileAsText(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result || ""); };
    reader.onerror = function() { reject(reader.error || new Error("FileReader failed")); };
    reader.readAsText(file);
  });
}

// String replace on {{paramName}} placeholders. Unknown names pass
// through unchanged so the user can see what didn't substitute.
function _substituteSkillParams(template, values) {
  if (typeof template !== "string") return "";
  return template.replace(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g, function(match, name) {
    return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match;
  });
}

// Append a turn into the active dynamic Skill tab's left chat dialog.
// Roles: "user" (the resolved prompt), "ai" (LLM response), "error".
function _appendSkillDialogTurn(role, content) {
  var dialog = document.querySelector("[data-canvas-chat-skill-dialog]");
  if (!dialog) return;
  var emptyHint = dialog.querySelector(".canvas-chat-skill-dialog-empty");
  if (emptyHint) emptyHint.remove();
  var turn = document.createElement("div");
  turn.className = "canvas-chat-skill-dialog-turn canvas-chat-skill-dialog-" + role;
  turn.textContent = content == null ? "" : String(content);
  dialog.appendChild(turn);
  dialog.scrollTop = dialog.scrollHeight;
}

// Per-outputFormat dispatch. R6 hands proposals + scalars off to R7 by
// rendering them into the panel output area; R7 wires applyMutations()
// + the ask/auto-tag policy gate on top.
function _renderSkillRunOutput(skill, panelHost, responseText) {
  var format = skill && skill.outputFormat;
  if (format === "text") {
    _appendSkillDialogTurn("ai", responseText);
    return;
  }
  var output = panelHost && panelHost.querySelector("[data-skill-panel-output]");
  if (format === "dimensional") {
    _appendSkillDialogTurn("ai",
      "Dimensional output produced (heatmap renderer deferred to a polish arc).");
    if (output) output.textContent = responseText;
    return;
  }
  if (format === "json-array" || format === "scalar") {
    _appendSkillDialogTurn("ai",
      "Proposed mutations (apply gate lands at rc.8.b R7 per skill.mutationPolicy='" +
      (skill.mutationPolicy || "(none)") + "'):");
    if (output) output.textContent = responseText;
    return;
  }
  // Unknown format — surface as plain AI turn so the user sees the response.
  _appendSkillDialogTurn("ai", responseText);
}

function buildFooter() {
  const foot = document.createElement("div");
  foot.className = "canvas-chat-footer";
  const lede = document.createElement("div");
  lede.className = "canvas-chat-foot-lede";
  // Per SPEC §S33 R33.6-R33.8 (rc.4-dev / Arc 2 REVISION 2026-05-04) -
  // footer breadcrumb shows the latest-turn provenance in JetBrains
  // Mono uppercase. Empty state renders nothing (footer breathes;
  // breadcrumb only appears when there's something to show). Done
  // button retired — the X close in the overlay header is the
  // canonical close affordance; a redundant Done button cluttered the
  // footer and made it feel "primitive utilitarian" (user feedback).
  paintFooterCrumb(lede, null);
  foot.appendChild(lede);
  return foot;
}

// Per SPEC §S33 R33.6-R33.8 (rc.4-dev / Arc 2) - paint the latest-turn
// provenance breadcrumb into the footer lede element. Called with the
// chat result on onComplete. R33.7 empty state reads 'Ready'. R33.8
// silently drops missing fields (e.g. no latency -> just provider
// label + model + tokens).
function paintFooterCrumb(lede, result) {
  if (!lede) return;
  // Empty state per SPEC §S33 R33.7 (rc.4-dev / Arc 2 REVISION) -
  // render nothing. Pre-revision the empty state read "Ready" which
  // shoved a placeholder word into the corner; user feedback flagged
  // it as unnecessary. Now the breadcrumb is information-only - it
  // only appears AFTER an assistant turn completes.
  if (!result || !result.provenance) {
    lede.textContent = "";
    return;
  }
  const p = result.provenance;
  const segments = [];
  if (p.providerKey) segments.push(labelForProvider(p.providerKey));
  if (p.model)       segments.push(p.model);
  if (typeof p.tokensIn === "number" || typeof p.tokensOut === "number") {
    const total = (p.tokensIn || 0) + (p.tokensOut || 0);
    segments.push(total.toLocaleString() + " tokens");
  } else if (typeof p.tokens === "number") {
    segments.push(p.tokens.toLocaleString() + " tokens");
  }
  if (typeof p.latencyMs === "number") segments.push(Math.round(p.latencyMs) + "ms");
  lede.textContent = segments.join(" · ");
}

function injectHeaderExtras() {
  const slot = document.querySelector(".overlay[data-kind='canvas-chat'] .overlay-head-extras");
  if (!slot) return;
  slot.innerHTML = "";

  // Per SPEC §S33 R33.1-R33.3 (rc.4-dev / Arc 2) - provider pill row
  // replaces the connection-status chip. One pill per PROVIDERS entry;
  // active filled --dell-blue, inactive ready outlined with green dot,
  // inactive needs-key outlined with amber dot. Click semantics:
  //   inactive ready    -> switch active provider (saveAiConfig)
  //   inactive needs-key OR active -> open Settings modal
  // Mock provider is excluded (PROVIDERS registry doesn't list it).
  paintProviderPills(slot);

  // Clear-chat button.
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "canvas-chat-clear-btn";
  clearBtn.title = "Clear this engagement's chat transcript";
  clearBtn.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2 4h12"/><path d="M5 4V2.5h6V4"/><path d="M3 4l1 10h8l1-10"/></svg>' +
    ' <span>Clear</span>';
  // HOTFIX #1 (rc.4-dev-arc3-hotfix per user report 2026-05-04 LATE):
  // Pre-fix the Clear button called confirmAction() which opens its own
  // overlay — Overlay.js is a singleton, so the chat overlay closed
  // when the confirm modal opened, and never came back. Inline the
  // confirm UI directly in the head-extras slot so the chat overlay
  // stays open throughout. Clear button morphs into "Clear chat? [Yes]
  // [No]" pill cluster on click; resolves either way back to the Clear
  // button. No overlay swap, no lost state.
  clearBtn.addEventListener("click", function() {
    confirmClearInline(slot, clearBtn);
  });
  slot.appendChild(clearBtn);

  // Skills-rail toggle (Phase 3 scaffold). Flips .is-open on the rail
  // to show/hide the right column. Phase 4 populates the rail with
  // saved-skill cards that drop a pre-filled prompt into the chat.
  const railBtn = document.createElement("button");
  railBtn.type = "button";
  railBtn.className = "canvas-chat-rail-toggle";
  railBtn.title = "Show / hide the Skills shortcut rail";
  railBtn.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="2" y="2" width="12" height="12" rx="1.5"/>' +
    '<line x1="11" y1="2" x2="11" y2="14"/></svg>' +
    ' <span>Skills</span>';
  railBtn.addEventListener("click", function() {
    const rail = document.querySelector(".overlay[data-kind='canvas-chat'] [data-canvas-chat-rail]");
    if (!rail) return;
    const open = rail.classList.toggle("is-open");
    railBtn.classList.toggle("is-active", open);
    railBtn.setAttribute("aria-pressed", open ? "true" : "false");
  });
  slot.appendChild(railBtn);

  // Ack indicator placeholder (filled by renderAckIndicator on first-turn
  // handshake completion). Empty until the LLM's first response is parsed.
  const ack = document.createElement("span");
  ack.className = "canvas-chat-ack";
  ack.setAttribute("data-canvas-chat-ack", "");
  ack.style.display = "none";
  slot.appendChild(ack);
}

// Per SPEC §S33 (rc.4-dev / Arc 2 REVISION 2026-05-04) - single-pill-
// with-popover pattern. The pre-revision row of one-pill-per-provider
// didn't scale (Local A + Local B + Claude + Gemini + Dell Sales Chat
// = 5 buttons stacked side-by-side, not elegant). Industry-standard
// pattern: one compact pill in the header showing the ACTIVE provider
// + a chevron, click reveals a popover anchored below the pill listing
// every provider with status dots and click-to-switch / click-to-
// configure semantics. Same affordance, much cleaner header, scales
// to N providers without UI strain.
function paintProviderPills(slot) {
  const aiCfg      = loadAiConfig();
  const activeKey  = (aiCfg && aiCfg.activeProvider) || "local";
  const activeReady = isProviderReady(aiCfg, activeKey);

  const wrap = document.createElement("div");
  wrap.className = "canvas-chat-provider-pills";
  wrap.setAttribute("data-canvas-chat-provider", "");

  // The visible pill = active provider + chevron. Click opens popover.
  const pill = document.createElement("button");
  pill.type = "button";
  pill.className = "canvas-chat-provider-pill is-active" +
    (activeReady ? " is-ready" : " is-warn");
  pill.setAttribute("data-provider-key", activeKey);
  pill.setAttribute("data-canvas-chat-provider-pill", "");
  pill.setAttribute("aria-haspopup", "menu");
  pill.setAttribute("aria-expanded", "false");
  pill.title = "AI provider: " + labelForProvider(activeKey) +
    (activeReady ? "" : " (needs key)") + ". Click to switch.";
  pill.setAttribute("aria-label", pill.title);

  const dot = document.createElement("span");
  dot.className = "canvas-chat-provider-pill-dot";
  dot.setAttribute("aria-hidden", "true");
  pill.appendChild(dot);

  const label = document.createElement("span");
  label.className = "canvas-chat-provider-pill-label";
  label.textContent = labelForProvider(activeKey);
  pill.appendChild(label);

  // Chevron (down-arrow) signals the dropdown affordance.
  const chev = document.createElement("span");
  chev.className = "canvas-chat-provider-pill-chev";
  chev.setAttribute("aria-hidden", "true");
  chev.innerHTML =
    '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 6l4 4 4-4"/></svg>';
  pill.appendChild(chev);

  wrap.appendChild(pill);

  // Popover anchored below the pill. Hidden by default; toggled on
  // pill click. Each row = one provider (one PROVIDERS entry, mock
  // excluded by registry omission per R33.4).
  const popover = document.createElement("div");
  popover.className = "canvas-chat-provider-popover";
  popover.setAttribute("data-canvas-chat-provider-popover", "");
  popover.setAttribute("role", "menu");
  popover.style.display = "none";

  // BUG-036 fix (rc.7 / 7e-8c'-fix3): the popover's row classes + meta
  // text + click handler USED to snapshot `isActive` + `ready` at row-
  // BUILD time (i.e. once when the chat overlay opens). When the user
  // entered a key for a provider in side-panel Settings and came back
  // to chat, the popover still showed "Needs key" + the click still
  // routed to Settings (because the stale snapshot said ready=false),
  // creating an infinite loop where every click on an unlit provider
  // opened Settings even after the key was saved. Fix: rebuild row
  // state at popover-OPEN time + re-read fresh config at click-DECIDE
  // time. Both halves matter: the open-time refresh updates the visual
  // (so the user sees "Ready" once the key lands), and the click-time
  // refresh ensures the routing decision uses the same fresh state.

  // Refresh one row's class + meta text against a fresh config.
  function refreshRow(row, freshCfg) {
    const providerKey = row.getAttribute("data-provider-key");
    const isActive    = providerKey === ((freshCfg && freshCfg.activeProvider) || "local");
    const ready       = isProviderReady(freshCfg, providerKey);
    row.className = "canvas-chat-provider-row" +
      (isActive ? " is-active" : "") +
      (ready ? " is-ready" : " is-warn");
    const meta = row.querySelector(".canvas-chat-provider-row-meta");
    if (meta) {
      // BUG-047 fix · "Ready" implied connectivity but really means
      // CONFIGURED (baseUrl + apiKey present). Renamed to "Configured"
      // to be honest about what the dot signals; "Active" is the only
      // state that means "live + currently in use". True reachability
      // probing is queued for v3.1 chat polish (BUG-046 #6).
      meta.textContent = isActive
        ? "Active"
        : (ready ? "Configured" : "Needs key");
    }
  }

  for (const providerKey of PROVIDERS) {
    const row = document.createElement("button");
    row.type = "button";
    row.setAttribute("data-provider-key", providerKey);
    row.setAttribute("role", "menuitem");

    const rowDot = document.createElement("span");
    rowDot.className = "canvas-chat-provider-row-dot";
    row.appendChild(rowDot);

    const rowLabel = document.createElement("span");
    rowLabel.className = "canvas-chat-provider-row-label";
    rowLabel.textContent = labelForProvider(providerKey);
    row.appendChild(rowLabel);

    const rowMeta = document.createElement("span");
    rowMeta.className = "canvas-chat-provider-row-meta";
    row.appendChild(rowMeta);

    // Initial paint with the snapshot config; refreshed on popover open.
    refreshRow(row, aiCfg);

    row.addEventListener("click", function() {
      // Per R33.3:
      //   inactive + ready -> switch active provider, repaint
      //   inactive + warn  -> open Settings (key entry)
      //   active           -> open Settings (key management)
      // BUG-036 fix: re-read fresh config NOW so the decision uses the
      // latest saved state, not whatever was true when the row was built.
      hidePopover();
      const freshCfg     = loadAiConfig();
      const freshActive  = (freshCfg && freshCfg.activeProvider) || "local";
      const freshIsActive = providerKey === freshActive;
      const freshReady    = isProviderReady(freshCfg, providerKey);
      if (!freshIsActive && freshReady) {
        freshCfg.activeProvider = providerKey;
        saveAiConfig(freshCfg);
        const headSlot = document.querySelector(".overlay[data-kind='canvas-chat'] .overlay-head-extras");
        if (headSlot) injectHeaderExtras();
        return;
      }
      // rc.5 §S36.1 R36.7 (BUG-028 fix): keep the chat overlay mounted
      // and open Settings as a side-panel instead of replacing chat.
      // We're inside the chat right now, so chat IS open by definition.
      // Do NOT call closeOverlay(); Overlay.js stack will handle the
      // 50/50 layout via sidePanel:true.
      openSettingsModal({ section: "providers", focusProvider: providerKey, sidePanel: true });
    });

    popover.appendChild(row);
  }
  wrap.appendChild(popover);

  function showPopover() {
    // BUG-036 fix: refresh every row's ready/active state from fresh
    // config so the user sees the latest "Ready"/"Needs key" labels
    // each time they open the popover (covers the "added a key in
    // side-panel Settings, came back to chat" flow).
    const freshCfg = loadAiConfig();
    popover.querySelectorAll(".canvas-chat-provider-row").forEach(function(r) {
      refreshRow(r, freshCfg);
    });
    popover.style.display = "";
    pill.setAttribute("aria-expanded", "true");
    document.addEventListener("click", outsideClickHandler, true);
  }
  function hidePopover() {
    popover.style.display = "none";
    pill.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", outsideClickHandler, true);
  }
  function outsideClickHandler(e) {
    if (!wrap.contains(e.target)) hidePopover();
  }

  pill.addEventListener("click", function(e) {
    e.stopPropagation();
    if (popover.style.display === "none") showPopover();
    else hidePopover();
  });

  slot.appendChild(wrap);
}

// Per-provider readiness check. Mirrors isActiveProviderReady's shape
// but evaluated against ANY provider key (not just the active one).
function isProviderReady(config, providerKey) {
  const c = config || loadAiConfig();
  const p = c && c.providers && c.providers[providerKey];
  if (!p) return false;
  if (!p.baseUrl) return false;
  // Local providers (A + B) don't require a key (typical self-hosted
  // vLLM behind nginx proxy is unauth'd); public providers do. Matches
  // isActiveProviderReady. rc.4-dev / Arc 2 added Local B alongside
  // Local A.
  if (providerKey !== "local" && providerKey !== "localB" && !p.apiKey) return false;
  return true;
}

// HOTFIX #1 (rc.4-dev-arc3-hotfix) - inline confirm for Clear-chat that
// keeps the chat overlay open. Replaces the head-extras' Clear button
// with a "Clear? [Yes] [No]" pill cluster while waiting for user
// decision. Resolves either path back to the Clear button.
function confirmClearInline(slot, clearBtn) {
  if (!slot || !clearBtn) return;
  // Hide the Clear button + paint a confirm strip in its place.
  const placeholder = document.createElement("span");
  placeholder.className = "canvas-chat-clear-confirm";
  placeholder.innerHTML =
    '<span class="canvas-chat-clear-confirm-q">Clear chat?</span>' +
    '<button type="button" class="canvas-chat-clear-confirm-yes">Clear</button>' +
    '<button type="button" class="canvas-chat-clear-confirm-no">Keep</button>';
  slot.replaceChild(placeholder, clearBtn);
  const yesBtn = placeholder.querySelector(".canvas-chat-clear-confirm-yes");
  const noBtn  = placeholder.querySelector(".canvas-chat-clear-confirm-no");

  function restore() {
    if (placeholder.parentNode === slot) slot.replaceChild(clearBtn, placeholder);
  }
  yesBtn.addEventListener("click", function() {
    if (state.engagementId) clearTranscript(state.engagementId);
    state.transcript = { messages: [], summary: null };
    const body = document.querySelector(".overlay[data-kind='canvas-chat'] .overlay-body");
    if (body) paintTranscript(body);
    // Reset the per-session try-asking seed so the empty-state re-rolls
    // a fresh set of prompts (the chat is now empty again).
    state._tryAskingSeed = (Date.now() & 0x7FFFFFFF) || 1;
    restore();
  });
  noBtn.addEventListener("click", restore);
}

// SPEC §S20.16 — render the contract-ack outcome.
//   contractAck.ok === true  → green ✓ "grounded" chip in header (auto-fade 3s)
//   contractAck.ok === false → red ⚠ chip + banner above the transcript
function renderAckIndicator(contractAck) {
  const chip = document.querySelector(".overlay[data-kind='canvas-chat'] [data-canvas-chat-ack]");
  if (!chip) return;
  chip.style.display = "";
  if (contractAck.ok) {
    chip.className = "canvas-chat-ack canvas-chat-ack-ok";
    chip.title = "Data contract sha=" + contractAck.expected + " acknowledged by LLM";
    chip.textContent = "✓ grounded";
    setTimeout(function() { chip.style.display = "none"; }, 3000);
  } else {
    chip.className = "canvas-chat-ack canvas-chat-ack-warn";
    chip.title = "Expected sha=" + contractAck.expected +
                 ", received " + (contractAck.received || "(none)");
    chip.textContent = "⚠ ungrounded";
    // Also paint a banner above the transcript on first-turn mismatch.
    const scroll = document.querySelector(".overlay[data-kind='canvas-chat'] .canvas-chat-transcript");
    if (scroll && !scroll.querySelector(".canvas-chat-ack-banner")) {
      const banner = document.createElement("div");
      banner.className = "canvas-chat-ack-banner";
      banner.textContent = "Heads up: the LLM did not echo back the data-contract checksum on its first turn. " +
        "Responses may not be grounded in the live engagement.";
      scroll.insertBefore(banner, scroll.firstChild);
    }
  }
}

function labelForProvider(providerKey) {
  switch (providerKey) {
    case "anthropic":     return "Claude";
    case "openai-compatible":
    case "local":         return "Local A";
    case "localB":        return "Local B";
    case "gemini":        return "Gemini";
    case "dellSalesChat": return "Dell Sales Chat";
    default:              return providerKey || "Provider";
  }
}

function paintTranscript(body) {
  const scroll = body.querySelector(".canvas-chat-transcript");
  if (!scroll) return;
  // Preserve the empty-state node + any thinking-state surfaces
  // (per SPEC §S34 R34.1 + R34.4 - typing indicator + tool-status pill
  // are transient elements that must survive a paintTranscript that
  // fires mid-turn or just after openCanvasChat's setTimeout).
  const empty       = scroll.querySelector(".canvas-chat-empty");
  const typing      = scroll.querySelector(".canvas-chat-typing-indicator");
  const toolStatus  = scroll.querySelector(".canvas-chat-tool-status");
  scroll.innerHTML = "";
  if (empty)      scroll.appendChild(empty);
  if (typing)     scroll.appendChild(typing);
  if (toolStatus) scroll.appendChild(toolStatus);

  const visibleMessages = state.transcript.messages.filter(function(m) {
    // System-role messages are internal (prior context summaries); only
    // user + assistant messages render.
    return m.role === "user" || m.role === "assistant";
  });

  if (visibleMessages.length === 0) {
    if (empty) {
      empty.style.display = "";
      const grid = empty.querySelector(".canvas-chat-empty-grid");
      if (grid) {
        grid.innerHTML = "";
        // Per SPEC §S34 R34.11 (rc.4-dev / Arc 3b) - empty-state prompts
        // come from the dynamic try-asking generator, NOT the static
        // EXAMPLE_PROMPTS const. Pinned to a per-session seed so the
        // 4 prompts don't reshuffle while the user is reading them.
        if (!state._tryAskingSeed) state._tryAskingSeed = (Date.now() & 0x7FFFFFFF) || 1;
        const dynamicPrompts = generateTryAskingPrompts(state.engagement, { seed: state._tryAskingSeed });
        dynamicPrompts.forEach(function(prompt) {
          const tile = document.createElement("button");
          tile.type = "button";
          tile.className = "canvas-chat-example";
          tile.textContent = prompt;
          tile.addEventListener("click", function() {
            const input = body.querySelector(".canvas-chat-input");
            if (input) {
              input.value = prompt;
              input.dispatchEvent(new Event("input"));
              input.focus();
            }
          });
          grid.appendChild(tile);
        });
      }
    }
    return;
  }

  if (empty) empty.style.display = "none";

  for (const msg of visibleMessages) {
    scroll.appendChild(buildMessageBubble(msg));
  }

  // Auto-scroll to bottom.
  scroll.scrollTop = scroll.scrollHeight;
}

function buildMessageBubble(msg) {
  const bubble = document.createElement("div");
  bubble.className = "canvas-chat-msg canvas-chat-msg-" + msg.role;

  const role = document.createElement("div");
  role.className = "canvas-chat-msg-role";
  role.textContent = msg.role === "user" ? "you" : "canvas";
  bubble.appendChild(role);

  const content = document.createElement("div");
  content.className = "canvas-chat-msg-content";
  if (msg.role === "assistant") {
    renderAssistantMarkdown(content, msg.content || "");
  } else {
    content.textContent = msg.content || "";
  }
  bubble.appendChild(content);

  if (msg.provenance) {
    const prov = document.createElement("div");
    prov.className = "canvas-chat-msg-prov";
    prov.textContent = "via " + (msg.provenance.model || "?") +
      " · " + new Date(msg.provenance.timestamp || Date.now()).toLocaleTimeString();
    bubble.appendChild(prov);
  }

  return bubble;
}

// Assistant bubbles only. marked v13 escapes raw HTML by default; we add a
// belt-and-braces sanitize for `javascript:` URLs that some renderers miss.
// Keep this surface narrow: user bubbles never go through here.
function renderAssistantMarkdown(node, text) {
  let html;
  try {
    html = marked.parse(text || "", { gfm: true, breaks: true });
  } catch (_e) {
    node.textContent = text || "";
    return;
  }
  html = String(html).replace(/\sjavascript:/gi, " ").replace(/^javascript:/gi, "");
  node.innerHTML = html;
}

async function handleSend(body) {
  if (state.isStreaming) return;
  const input = body.querySelector(".canvas-chat-input");
  if (!input) return;
  const userMessage = (input.value || "").trim();
  if (userMessage.length === 0) return;

  // Refresh engagement reference (user may have edited the canvas
  // since open). The bridge keeps engagementStore current; we just
  // re-read.
  state.engagement = getActiveEngagement();

  // Append user message + an empty assistant bubble for streaming.
  state.transcript.messages.push({
    role:    "user",
    content: userMessage,
    at:      new Date().toISOString()
  });
  const assistantMsg = {
    role:    "assistant",
    content: "",
    at:      new Date().toISOString()
  };
  state.transcript.messages.push(assistantMsg);
  paintTranscript(body);

  // Mark streaming + repaint to show typing indicator.
  state.isStreaming = true;
  const meter = body.querySelector(".canvas-chat-meter");
  if (meter) meter.textContent = "thinking…";
  input.disabled = true;
  input.value = "";
  input.style.height = "auto";
  // SPEC §S34 R34.1 (rc.4-dev / Arc 3) - paint the typing-dot indicator
  // BEFORE streamChat fires. First onToken call clears it (the assistant
  // is now actively producing text).
  paintTypingIndicator();

  // Resolve provider — always the user's active aiConfig provider
  // (BUG-017 fix: Mock is no longer surfaced in the chat header).
  // If the active provider isn't configured, surface a clear chat-bubble
  // message + repaint the connection-status chip in warning state.
  const aiCfg = loadAiConfig();
  const providerKey = (aiCfg && aiCfg.activeProvider) || "local";
  const cfg = aiCfg && aiCfg.providers && aiCfg.providers[providerKey];
  if (!cfg || !isActiveProviderReady(aiCfg)) {
    assistantMsg.content = "**No AI provider configured.** Open Settings (gear icon) to add an API key for " +
      labelForProvider(providerKey) + ", or pick a different provider.";
    state.isStreaming = false;
    input.disabled = false;
    paintTranscript(body);
    if (meter) meter.textContent = "no provider";
    return;
  }
  const provider = createRealChatProvider({
    providerKey:    providerKey,
    baseUrl:        cfg.baseUrl,
    model:          cfg.model,
    fallbackModels: cfg.fallbackModels || [],
    apiKey:         cfg.apiKey || ""
  });

  // Summarize if the rolling-window threshold tripped.
  state.transcript = summarizeIfNeeded(state.transcript);

  // The transcript we send to the provider EXCLUDES the empty
  // assistant placeholder we just pushed for the UI streaming target.
  const transcriptForProvider = state.transcript.messages.slice(0, -1);

  try {
    await streamChat({
      engagement:     state.engagement,
      transcript:     transcriptForProvider,
      userMessage:    userMessage,
      providerConfig: { providerKey: providerKey },
      provider:       provider,
      onToken: function(token) {
        // SPEC §S34 R34.1 (rc.4-dev / Arc 3) - on first token, clear
        // the typing-dot indicator (the AI is now actively producing
        // text; the placeholder dots are no longer needed).
        if (!assistantMsg.content) clearTypingIndicator();
        assistantMsg.content += token;
        // BUG-020 fix · streaming-time handshake strip. If the model
        // emits `[contract-ack v3.0 sha=<8>]` mid-stream (subsequent
        // turn disobedience seen in Gemini), strip it BEFORE the
        // markdown re-parse so the bubble never displays the artifact.
        // stripHandshake is idempotent + cheap; safe to run on every token.
        assistantMsg.content = stripHandshake(assistantMsg.content);
        // BUG-013 + BUG-024 fix · streaming-time scrub of UUIDs +
        // workflow.<id> + concept.<id> identifiers in prose. Same
        // defense-in-depth pattern; both replaced with resolved labels
        // (or [unknown reference] / [unknown workflow] / [unknown concept]
        // sentinels for orphans). Idempotent. Skips fenced + inline code.
        // Merge the engagement-derived UUID map with the manifest-
        // derived workflow/concept map so a single scrub pass covers
        // both classes.
        const fullLabelMap = Object.assign({}, buildManifestLabelMap(), buildLabelMap(state.engagement));
        assistantMsg.content = scrubUuidsInProse(assistantMsg.content, fullLabelMap);
        // Re-parse via marked progressively on the last assistant bubble.
        const bubbles = body.querySelectorAll(".canvas-chat-msg-assistant .canvas-chat-msg-content");
        const last = bubbles[bubbles.length - 1];
        if (last) renderAssistantMarkdown(last, assistantMsg.content);
        const scroll = body.querySelector(".canvas-chat-transcript");
        if (scroll) scroll.scrollTop = scroll.scrollHeight;
      },
      onComplete: function(result) {
        assistantMsg.content    = result.response;
        assistantMsg.provenance = result.provenance;
        // SPEC §S20.16 — first-turn handshake outcome surfaces in the header
        // ack chip + (on mismatch) a banner above the transcript.
        if (result && result.contractAck) {
          renderAckIndicator(result.contractAck);
        }
        // SPEC §S33 R33.6 (rc.4-dev / Arc 2) - update the footer
        // breadcrumb with the latest-turn provenance.
        const ledeEl = document.querySelector(".overlay[data-kind='canvas-chat'] .canvas-chat-foot-lede");
        if (ledeEl) paintFooterCrumb(ledeEl, result);
        // SPEC §S34 R34.6 - footer breadcrumb slide-in animation. Toggle
        // the .is-fresh class for one cycle so the CSS keyframe fires.
        if (ledeEl) {
          ledeEl.classList.remove("is-fresh");
          // force reflow so the animation re-triggers next frame
          // eslint-disable-next-line no-unused-expressions
          void ledeEl.offsetWidth;
          ledeEl.classList.add("is-fresh");
        }
      },
      // SPEC §S34 R34.2 (rc.4-dev / Arc 3) - thinking-state callbacks.
      onToolUse: function(evt) {
        paintToolStatus(evt && evt.name);
      },
      onRoundStart: function(evt) {
        paintRoundBadge(evt);
      }
    });
  } catch (e) {
    assistantMsg.content = "Error: " + (e && e.message || String(e));
  } finally {
    state.isStreaming = false;
    input.disabled = false;
    input.focus();
    if (meter) meter.textContent = "ready";
    if (state.engagementId) saveTranscript(state.engagementId, state.transcript);
    paintTranscript(body);
    // SPEC §S34 R34.1 + R34.4 - clean up any thinking-state surfaces
    // that may still be on screen if the chain ended mid-state.
    clearTypingIndicator();
    clearToolStatus();
  }
}
