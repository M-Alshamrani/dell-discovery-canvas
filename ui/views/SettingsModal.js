// ui/views/SettingsModal.js — Phase 19 / v2.4.0
//
// Gear-icon-opened modal for AI provider configuration. Three tabs:
// Local LLM (GB10), Anthropic Claude, Google Gemini. Each tab exposes
// endpoint URL + model + API key (where applicable) + a "Test connection"
// probe that fires a tiny "Reply OK" prompt to verify wiring before any
// real skill runs.

import { loadAiConfig, saveAiConfig, PROVIDERS } from "../../core/aiConfig.js";
import { testConnection } from "../../services/aiService.js";

export function openSettingsModal() {
  document.getElementById("settings-modal")?.remove();

  var overlay = mk("div", "dialog-overlay settings-overlay");
  overlay.id = "settings-modal";

  var box = mk("div", "dialog-box settings-box");
  box.appendChild(mkt("div", "dialog-title", "Settings — AI Providers"));
  box.appendChild(mkt("div", "settings-help",
    "Configure where AI skills run. The active provider is used by every skill " +
    "you build (or the v2.4.0 demo button on Tab 1)."));

  var config = loadAiConfig();

  // Provider selector — radio-style list across the top.
  var sel = mk("div", "settings-provider-row");
  PROVIDERS.forEach(function(pkey) {
    var p = config.providers[pkey];
    var pill = mk("button", "settings-provider-pill" + (config.activeProvider === pkey ? " active" : ""));
    pill.type = "button";
    pill.textContent = p.label;
    pill.addEventListener("click", function() {
      config.activeProvider = pkey;
      saveAiConfig(config);
      overlay.remove();
      openSettingsModal(); // re-render with new active section
    });
    sel.appendChild(pill);
  });
  box.appendChild(sel);

  // Provider-specific fields for the ACTIVE provider.
  var activeKey = config.activeProvider;
  var active    = config.providers[activeKey];

  var form = mk("div", "settings-form");

  var urlGroup = mk("div", "settings-field");
  urlGroup.appendChild(mkt("label", "settings-label", "Endpoint URL"));
  var urlInput = mk("input", "settings-input");
  urlInput.type = "text";
  urlInput.value = active.baseUrl;
  // Public providers go through our nginx proxy at fixed paths — locking
  // the URL avoids a misconfiguration that 404s every call.
  if (activeKey === "anthropic" || activeKey === "gemini") {
    urlInput.readOnly = true;
    urlInput.title = "Locked — public providers are reached via the container's nginx reverse-proxy (avoids CORS).";
    urlGroup.appendChild(mkt("div", "settings-help-inline",
      "Routed through the container's nginx proxy. Read-only because direct browser calls would be blocked by CORS."));
  } else {
    urlGroup.appendChild(mkt("div", "settings-help-inline",
      "Default '/api/llm/local/v1' uses the container proxy (LLM_HOST env var). " +
      "Paste an absolute URL like 'http://<gb10-ip>:8000/v1' to call the GB10 directly (vLLM CORS must permit it)."));
  }
  urlGroup.appendChild(urlInput);
  form.appendChild(urlGroup);

  var modelGroup = mk("div", "settings-field");
  modelGroup.appendChild(mkt("label", "settings-label", "Model"));
  var modelInput = mk("input", "settings-input");
  modelInput.type = "text";
  modelInput.value = active.model;
  modelGroup.appendChild(modelInput);
  form.appendChild(modelGroup);

  var keyGroup = mk("div", "settings-field");
  keyGroup.appendChild(mkt("label", "settings-label",
    "API key" + (activeKey === "local" ? " (optional — vLLM is unauth'd)" : "")));
  var keyInput = mk("input", "settings-input");
  keyInput.type = "password";
  keyInput.value = active.apiKey;
  keyInput.placeholder = activeKey === "anthropic" ? "sk-ant-..."
                       : activeKey === "gemini"    ? "AIza..."
                       :                              "(blank for local vLLM)";
  keyGroup.appendChild(keyInput);
  keyGroup.appendChild(mkt("div", "settings-help-inline",
    "Stored in browser localStorage. Visible in DevTools → Application → Local Storage. " +
    "Acceptable for personal use; v3 multi-user will move keys server-side."));
  form.appendChild(keyGroup);

  box.appendChild(form);

  // Test-connection probe.
  var probeRow = mk("div", "settings-probe-row");
  var probeBtn = mkt("button", "btn-secondary", "Test connection");
  var probeOut = mk("div", "settings-probe-out");
  probeBtn.addEventListener("click", async function() {
    probeOut.textContent = "Probing…";
    probeOut.className = "settings-probe-out probing";
    var result = await testConnection({
      providerKey: activeKey,
      baseUrl:     urlInput.value.trim(),
      model:       modelInput.value.trim(),
      apiKey:      keyInput.value
    });
    if (result.ok) {
      probeOut.className = "settings-probe-out ok";
      probeOut.textContent = "✓ OK — sample reply: " + (result.sample || "(empty)");
    } else {
      probeOut.className = "settings-probe-out err";
      probeOut.textContent = "✗ " + (result.error || "Unknown error");
    }
  });
  probeRow.appendChild(probeBtn);
  probeRow.appendChild(probeOut);
  box.appendChild(probeRow);

  // Footer — Save + Close.
  var foot = mk("div", "form-actions");
  var cancelBtn = mkt("button", "btn-secondary", "Close");
  cancelBtn.addEventListener("click", function() { overlay.remove(); });
  var saveBtn = mkt("button", "btn-primary", "Save");
  saveBtn.addEventListener("click", function() {
    config.providers[activeKey].baseUrl = urlInput.value.trim();
    config.providers[activeKey].model   = modelInput.value.trim();
    config.providers[activeKey].apiKey  = keyInput.value;
    saveAiConfig(config);
    saveBtn.textContent = "Saved";
    setTimeout(function() { saveBtn.textContent = "Save"; }, 800);
  });
  foot.appendChild(cancelBtn);
  foot.appendChild(saveBtn);
  box.appendChild(foot);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
}

// Helpers — DOM tag shorthands. We don't import the project's `mk` from
// app.js (would create a circular import); inline them here.
function mk(tag, cls)        { var el = document.createElement(tag); if (cls) el.className = cls; return el; }
function mkt(tag, cls, txt)  { var el = mk(tag, cls); if (txt != null) el.textContent = txt; return el; }
