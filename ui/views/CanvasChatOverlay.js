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
//   - tests/mocks/mockChatProvider  (default Mock provider)
//   - services/realChatProvider     (Real provider via aiService)
//   - core/aiConfig             (provider config for Real path)
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
import { streamChat, providerCapabilities }   from "../../services/chatService.js";
import { createMockChatProvider }             from "../../services/mockChatProvider.js";
import { createRealChatProvider }             from "../../services/realChatProvider.js";
import { loadAiConfig }                        from "../../core/aiConfig.js";
import { confirmAction }                       from "../components/Notify.js";
// SPEC §S20.17 + RULES §16 CH18 — markdown rendering on assistant bubbles
// only. User bubbles stay textContent (no HTML interpretation; XSS guard).
// marked v13 escapes raw HTML by default; we add a defensive sanitize step
// for javascript: URLs after parsing.
import { marked }                              from "../../vendor/marked/marked.min.js";

// Module-scope state for the open overlay. Only one chat overlay is
// open at a time; Overlay.js enforces the singleton pattern.
let state = {
  engagement:   null,
  engagementId: null,
  transcript:   { messages: [], summary: null },
  providerMode: "mock",   // "mock" | "real"
  isStreaming:  false
};

// Example prompts shown when transcript is empty. Click to fill input.
const EXAMPLE_PROMPTS = [
  "How many High-urgency gaps are open?",
  "Which environments have the most non-Dell instances?",
  "What initiatives serve our cyber resilience driver?",
  "Summarize the customer's strategic drivers in two sentences."
];

// openCanvasChat() — entry point from app.js topbar handler.
export function openCanvasChat() {
  state.engagement = getActiveEngagement();
  state.engagementId = (state.engagement && state.engagement.meta && state.engagement.meta.engagementId) || null;
  state.transcript = state.engagementId ? loadTranscript(state.engagementId) : { messages: [], summary: null };

  // Default provider mode: real if user has a configured non-local
  // provider, mock otherwise. User can flip via the header chip.
  const aiCfg = loadAiConfig();
  const activeProvider = aiCfg && aiCfg.activeProvider;
  state.providerMode = (activeProvider && activeProvider !== "local") ? "real" : "mock";

  const body   = buildBody();
  const footer = buildFooter();

  openOverlay({
    title:   "Canvas Chat",
    lede:    "Ask anything about your discovery canvas. Grounded in the data model + your live engagement.",
    body:    body,
    footer:  footer,
    kind:    "canvas-chat",
    size:    "default",
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
  const body = document.createElement("div");
  body.className = "canvas-chat-body";

  // Transcript scroll region.
  const scroll = document.createElement("div");
  scroll.className = "canvas-chat-transcript";
  scroll.setAttribute("data-canvas-chat-transcript", "");
  body.appendChild(scroll);

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
  body.appendChild(meter);

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
  body.appendChild(inputRow);

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

  return body;
}

function buildFooter() {
  const foot = document.createElement("div");
  foot.className = "canvas-chat-footer";
  const lede = document.createElement("div");
  lede.className = "canvas-chat-foot-lede";
  lede.textContent = "Read-only · proposes changes only · session memory persists per engagement";
  const done = document.createElement("button");
  done.type = "button";
  done.className = "btn-primary";
  done.textContent = "Done";
  done.addEventListener("click", function() { closeOverlay(); });
  foot.appendChild(lede);
  foot.appendChild(done);
  return foot;
}

function injectHeaderExtras() {
  const slot = document.querySelector(".overlay[data-kind='canvas-chat'] .overlay-head-extras");
  if (!slot) return;
  slot.innerHTML = "";

  // Provider toggle: Mock | Real (mirroring the Lab pattern).
  const seg = document.createElement("div");
  seg.className = "canvas-chat-provider-seg";

  const aiCfg       = loadAiConfig();
  const realName    = (aiCfg && aiCfg.activeProvider) || "local";
  const realCaps    = providerCapabilities(realName);
  const realLabel   = realCaps.streaming
    ? labelForProvider(realName)
    : labelForProvider(realName) + " (no streaming)";

  const opts = [
    { val: "mock", label: "Mock",       title: "Deterministic mock — no provider call (free)" },
    { val: "real", label: realLabel,    title: "Use your active provider: " + realName }
  ];
  for (const opt of opts) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "canvas-chat-provider-btn" + (state.providerMode === opt.val ? " is-active" : "");
    btn.setAttribute("data-val", opt.val);
    btn.title = opt.title;
    btn.textContent = opt.label;
    btn.addEventListener("click", function() {
      state.providerMode = opt.val;
      seg.querySelectorAll(".canvas-chat-provider-btn").forEach(function(b) {
        b.classList.toggle("is-active", b.getAttribute("data-val") === opt.val);
      });
    });
    seg.appendChild(btn);
  }
  slot.appendChild(seg);

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
  clearBtn.addEventListener("click", async function() {
    const ok = await confirmAction({
      title: "Clear chat?",
      lede:  "Permanently removes the saved transcript for this engagement. The canvas data is unaffected.",
      confirmText: "Clear chat",
      cancelText:  "Keep"
    });
    if (!ok) return;
    if (state.engagementId) clearTranscript(state.engagementId);
    state.transcript = { messages: [], summary: null };
    const body = document.querySelector(".overlay[data-kind='canvas-chat'] .overlay-body");
    if (body) paintTranscript(body);
  });
  slot.appendChild(clearBtn);

  // Ack indicator placeholder (filled by renderAckIndicator on first-turn
  // handshake completion). Empty until the LLM's first response is parsed.
  const ack = document.createElement("span");
  ack.className = "canvas-chat-ack";
  ack.setAttribute("data-canvas-chat-ack", "");
  ack.style.display = "none";
  slot.appendChild(ack);
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
    case "local":         return "Local";
    case "gemini":        return "Gemini";
    case "dellSalesChat": return "Dell Sales Chat";
    default:              return providerKey || "Provider";
  }
}

function paintTranscript(body) {
  const scroll = body.querySelector(".canvas-chat-transcript");
  if (!scroll) return;
  // Preserve the empty-state node; replace everything else.
  const empty = scroll.querySelector(".canvas-chat-empty");
  scroll.innerHTML = "";
  if (empty) scroll.appendChild(empty);

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
        EXAMPLE_PROMPTS.forEach(function(prompt) {
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

  // Resolve provider.
  let provider;
  let providerKey;
  if (state.providerMode === "real") {
    const aiCfg = loadAiConfig();
    providerKey = aiCfg && aiCfg.activeProvider;
    const cfg = aiCfg && aiCfg.providers && aiCfg.providers[providerKey];
    if (!providerKey || !cfg) {
      assistantMsg.content = "Real provider not configured. Open Settings to set one, or use Mock.";
      state.isStreaming = false;
      input.disabled = false;
      paintTranscript(body);
      if (meter) meter.textContent = "ready";
      return;
    }
    provider = createRealChatProvider({
      providerKey:    providerKey,
      baseUrl:        cfg.baseUrl,
      model:          cfg.model,
      fallbackModels: cfg.fallbackModels || [],
      apiKey:         cfg.apiKey || ""
    });
  } else {
    providerKey = "mock";
    // Deterministic mock that echoes the question — useful for smoke
    // testing without burning the user's wallet.
    provider = createMockChatProvider({
      responses: [
        { kind: "text", text: "[mock] you asked: \"" + userMessage + "\". Switch to a Real provider in the header to dispatch this against your live LLM." }
      ]
    });
  }

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
        assistantMsg.content += token;
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
  }
}
