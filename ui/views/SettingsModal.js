// ui/views/SettingsModal.js — Phase 19 / v2.4.0
//
// Gear-icon-opened modal for AI provider configuration. Three tabs:
// Local LLM (self-hosted on the deployment host), Anthropic Claude,
// Google Gemini. Each tab exposes endpoint URL + model + API key
// (where applicable) + a "Test connection" probe that fires a tiny
// "Reply OK" prompt to verify wiring before any real skill runs.

import { loadAiConfig, saveAiConfig, PROVIDERS } from "../../core/aiConfig.js";
import { testConnection } from "../../services/aiService.js";
import { renderSkillAdmin } from "./SkillAdmin.js";

export function openSettingsModal(opts) {
  document.getElementById("settings-modal")?.remove();
  var initialSection = (opts && opts.section) || "providers";

  var overlay = mk("div", "dialog-overlay settings-overlay");
  overlay.id = "settings-modal";

  var box = mk("div", "dialog-box settings-box");
  box.appendChild(mkt("div", "dialog-title", "Settings"));

  // Top-level section selector: Providers vs Skills.
  var sectionRow = mk("div", "settings-section-row");
  var providersPill = mkt("button", "settings-section-pill" + (initialSection === "providers" ? " active" : ""), "AI Providers");
  providersPill.type = "button";
  var skillsPill    = mkt("button", "settings-section-pill" + (initialSection === "skills"    ? " active" : ""), "Skills");
  skillsPill.type   = "button";
  providersPill.addEventListener("click", function() {
    overlay.remove(); openSettingsModal({ section: "providers" });
  });
  skillsPill.addEventListener("click", function() {
    overlay.remove(); openSettingsModal({ section: "skills" });
  });
  sectionRow.appendChild(providersPill);
  sectionRow.appendChild(skillsPill);
  box.appendChild(sectionRow);

  // Body container swaps between the two sections.
  var body = mk("div", "settings-body");
  box.appendChild(body);

  if (initialSection === "skills") {
    renderSkillAdmin(body);
    var foot = mk("div", "form-actions");
    var closeBtn = mkt("button", "btn-secondary", "Close");
    closeBtn.addEventListener("click", function() { overlay.remove(); });
    foot.appendChild(closeBtn);
    box.appendChild(foot);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
    return;
  }

  // ── Providers section (default) ──
  body.appendChild(mkt("div", "settings-help",
    "Configure where AI skills run. The active provider is used by every " +
    "skill you've built and deployed via the Skills tab."));

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
      openSettingsModal({ section: "providers" }); // re-render with new active section
    });
    sel.appendChild(pill);
  });
  body.appendChild(sel);

  // Provider-specific fields for the ACTIVE provider.
  var activeKey = config.activeProvider;
  var active    = config.providers[activeKey];

  var form = mk("div", "settings-form");
  body.appendChild(form);

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
      "Paste an absolute URL like 'http://<host-ip>:8000/v1' to call the inference host directly (upstream CORS must permit it)."));
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
  body.appendChild(probeRow);

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
