// core/aiConfig.js — Phase 19 / v2.4.0
//
// AI provider configuration: per-provider endpoint + model + API key,
// plus the active-provider selector. Lives in localStorage under
// `ai_config_v1`. Keys are visible in browser DevTools (acceptable for
// personal/dev use); v3 multi-user platform will move keys server-side.

const STORAGE_KEY = "ai_config_v1";

// v2.4.13 polish iter-3 . dellSalesChat added per user direction. Same
// connection shape as the other providers (url + model + apiKey + fallback
// chain). Defaults model the local-LLM pattern (user-editable URL) since
// the actual proxy backend isn't wired yet; the user will paste their
// Dell Sales Chat endpoint directly.
export const PROVIDERS = ["local", "anthropic", "gemini", "dellSalesChat"];

// Defaults — every field is overridable via the Settings modal at runtime.
// Local URL is relative (uses our container's nginx proxy by default; the
// user can paste an absolute URL like "http://<gb10-ip>:8000/v1" to bypass
// the proxy and call vLLM directly when CORS allows it).
// v2.4.5.1 — each provider may declare `fallbackModels: string[]`.
// aiService walks the list if the primary model exhausts retries on a
// transient upstream error (429/5xx). Empty array = single-model mode
// (v2.4.0-v2.4.5 behaviour).
export const DEFAULT_AI_CONFIG = {
  activeProvider: "local",
  providers: {
    local: {
      label:          "Local LLM",
      baseUrl:        "/api/llm/local/v1",
      model:          "code-llm",
      apiKey:         "",                     // typical self-hosted vLLM is unauth'd behind the proxy
      fallbackModels: []
    },
    anthropic: {
      label:          "Anthropic Claude",
      baseUrl:        "/api/llm/anthropic",   // proxy path; not user-editable
      model:          "claude-haiku-4-5",
      apiKey:         "",
      fallbackModels: ["claude-sonnet-4-5"]
    },
    gemini: {
      label:          "Google Gemini",
      baseUrl:        "/api/llm/gemini",      // proxy path; not user-editable
      model:          "gemini-2.5-flash",     // gemini-2.0-flash deprecated to new users (2026-Q1)
      apiKey:         "",
      // gemini-2.5-flash is the most-used (= most-overloaded) model.
      // Default fallback chain prefers still-fast models before dropping
      // to the stable 1.5 family.
      fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"]
    },
    dellSalesChat: {
      label:          "Dell Sales Chat",
      baseUrl:        "",                     // user pastes their endpoint
      model:          "",                     // user supplies model id
      apiKey:         "",
      fallbackModels: []
    }
  }
};

export function loadAiConfig() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_AI_CONFIG));
    var parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_AI_CONFIG));
  }
}

export function saveAiConfig(config) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    return false;
  }
}

// Carry forward any keys the user has set, fill in missing ones from defaults.
// Lets us add new providers in future without breaking saved configs.
//
// Also performs one-shot migrations for model IDs that become deprecated by
// the upstream provider. The user's key + endpoint are preserved; only the
// model string shifts to the supported replacement.
var DEPRECATED_MODELS = {
  gemini: { "gemini-2.0-flash": "gemini-2.5-flash" }   // deprecated to new users 2026-Q1
};

function mergeWithDefaults(stored) {
  var merged = JSON.parse(JSON.stringify(DEFAULT_AI_CONFIG));
  if (stored && typeof stored.activeProvider === "string"
      && PROVIDERS.indexOf(stored.activeProvider) >= 0) {
    merged.activeProvider = stored.activeProvider;
  }
  if (stored && stored.providers && typeof stored.providers === "object") {
    PROVIDERS.forEach(function(p) {
      var s = stored.providers[p];
      if (!s) return;
      var d = merged.providers[p];
      if (typeof s.baseUrl === "string" && s.baseUrl.length > 0) d.baseUrl = s.baseUrl;
      if (typeof s.model   === "string" && s.model.length > 0) {
        var deprMap = DEPRECATED_MODELS[p] || {};
        d.model = deprMap[s.model] || s.model;
      }
      if (typeof s.apiKey  === "string")                          d.apiKey  = s.apiKey;
      // v2.4.5.1 — honour user-supplied fallback chain if present; keep
      // the default otherwise. Stored entries are filtered to strings
      // so a garbled save can't crash chatCompletion.
      if (Array.isArray(s.fallbackModels)) {
        d.fallbackModels = s.fallbackModels.filter(function(m) {
          return typeof m === "string" && m.trim().length > 0;
        });
      }
    });
  }
  return merged;
}

// True when the active provider has enough config to make a real call.
export function isActiveProviderReady(config) {
  var c = config || loadAiConfig();
  var p = c.providers[c.activeProvider];
  if (!p) return false;
  if (!p.baseUrl) return false;
  // Local provider doesn't require a key (vLLM unauth'd); public providers do.
  if (c.activeProvider !== "local" && !p.apiKey) return false;
  return true;
}
