// services/aiService.js — Phase 19f / v2.4.5.1 (AI reliability)
//
// Provider-aware chat completion. Three shapes supported:
//   - openai-compatible  (vLLM Code LLM, VLM, OpenAI proper, etc.)
//   - anthropic          (Claude API)
//   - gemini             (Google Generative AI)
//
// All three are reached via our container's nginx reverse-proxy when
// the configured baseUrl is relative (starts with "/"). When the user
// pastes an absolute URL (http:// or https://), the call goes direct
// from the browser — only viable for upstreams whose CORS allows it
// (typically self-hosted vLLM with --allowed-origins '["*"]').
//
// v2.4.5.1 reliability additions:
//   - Anthropic browser-direct opt-in header. Anthropic demands the
//     "anthropic-dangerous-direct-browser-access: true" header whenever
//     a request carries an Origin (our nginx proxy is transparent, so
//     browser Origin reaches them). Without this, Anthropic 401s.
//   - Retry with exponential backoff + jitter on 429 / 5xx. Three
//     attempts, base 500ms, cap 4s — handles most Gemini 2.5-flash
//     "high demand" 503s transparently. 4xx (auth, bad request) are
//     NOT retried — those are the user's config to fix.
//   - Optional per-provider fallback model chain. If the primary model
//     exhausts retries with a transient upstream error, chatCompletion
//     re-issues on the next model in the chain. See core/aiConfig.js
//     for the `fallbackModels` field.

const PROVIDER_FROM_KEY = {
  local:         "openai-compatible",
  anthropic:     "anthropic",
  gemini:        "gemini",
  dellSalesChat: "openai-compatible"
};

// Retry tuning — exported for tests so suites can drive the loop
// deterministically with a custom waitImpl.
export var RETRY_MAX_ATTEMPTS  = 3;      // total tries per model (incl. first)
export var RETRY_BASE_DELAY_MS = 500;    // first backoff; doubles each attempt
export var RETRY_CAP_DELAY_MS  = 4000;   // hard ceiling per wait
export var RETRIABLE_STATUSES  = [429, 500, 502, 503, 504];

// Public API — single entry point.
//   chatCompletion({
//     providerKey:    "local" | "anthropic" | "gemini",
//     baseUrl:        resolved URL (relative or absolute),
//     model:          string (primary model id),
//     fallbackModels: optional string[] (tried in order after primary),
//     apiKey:         string (may be empty for local),
//     messages:       [{ role: "system" | "user" | "assistant", content: "..." }],
//     fetchImpl:      optional override (for tests; defaults to window.fetch)
//     waitImpl:       optional override (for tests; defaults to setTimeout)
//   }) → Promise<{ text: string, raw: any, modelUsed: string, attempts: number }>
//
// Throws on terminal failure (all models + retries exhausted, or a
// non-retriable error). Error message has the usual prefix so the UI
// can keep rendering the "fix your key / try again" hint.
export async function chatCompletion(opts) {
  var providerKey  = opts.providerKey || "local";
  var providerKind = PROVIDER_FROM_KEY[providerKey] || "openai-compatible";
  var fetchImpl    = opts.fetchImpl || (typeof window !== "undefined" ? window.fetch.bind(window) : null);
  if (!fetchImpl) throw new Error("aiService.chatCompletion: no fetch implementation available");
  var waitImpl     = opts.waitImpl || defaultWait;

  // Model candidates: primary first, then fallbacks. Duplicate entries
  // filtered so a user pasting the same model twice doesn't waste
  // attempts.
  var candidates = [opts.model || ""].concat(Array.isArray(opts.fallbackModels) ? opts.fallbackModels : [])
    .filter(function(m, i, arr) { return typeof m === "string" && m.length > 0 && arr.indexOf(m) === i; });
  if (candidates.length === 0) candidates = [""];

  var totalAttempts = 0;
  var lastError = null;

  for (var ci = 0; ci < candidates.length; ci++) {
    var model = candidates[ci];
    for (var attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
      totalAttempts++;
      var built = buildRequest(providerKind, Object.assign({}, opts, { model: model }));
      var resp;
      try {
        resp = await fetchImpl(built.url, {
          method:  "POST",
          headers: built.headers,
          body:    JSON.stringify(built.body)
        });
      } catch (networkErr) {
        // Network-level failure (DNS, TLS, connection drop). Same
        // retriability story as a 5xx: try again, then fall back.
        lastError = new Error("aiService " + providerKey + " network error: " +
          (networkErr && networkErr.message || String(networkErr)));
        if (attempt < RETRY_MAX_ATTEMPTS) {
          await waitImpl(backoffMs(attempt));
          continue;
        }
        break;   // exhausted retries on this model; try next candidate
      }

      if (resp.ok) {
        var json = await resp.json();
        return {
          text: extractText(providerKind, json),
          raw: json,
          modelUsed: model,
          attempts: totalAttempts
        };
      }

      var bodyText = "";
      try { bodyText = await resp.text(); } catch (e) { /* swallow */ }
      var err = buildHttpError(providerKey, resp.status, bodyText);

      if (RETRIABLE_STATUSES.indexOf(resp.status) >= 0) {
        lastError = err;
        if (attempt < RETRY_MAX_ATTEMPTS) {
          await waitImpl(backoffMs(attempt));
          continue;
        }
        // Exhausted retries on this model — fall through to next
        // candidate (if any). Preserve lastError for final throw.
        break;
      }

      // Non-retriable (auth, schema, bad key). Throw immediately —
      // no point asking upstream the same bad thing three more times.
      throw err;
    }
  }

  // Every candidate + every retry exhausted. Throw the last transient
  // error with the original prefix so UI hints stay consistent.
  if (lastError) throw lastError;
  throw new Error("aiService " + providerKey + " exhausted all retries");
}

function buildHttpError(providerKey, status, bodyText) {
  var prefix;
  if (status === 401 || status === 403) {
    prefix = "auth failed — check your API key in gear icon → " + providerKey;
  } else if (status === 429) {
    prefix = "rate-limited — wait a moment or switch provider";
  } else if (status >= 500 && status < 600) {
    prefix = "upstream temporary error — try again or switch provider";
  } else {
    prefix = "HTTP " + status;
  }
  return new Error("aiService " + providerKey + " " + prefix +
    " (" + status + ")" + (bodyText ? ": " + bodyText.slice(0, 200) : ""));
}

// Exponential backoff with jitter. attempt is 1-based. Returns
// milliseconds to wait before the NEXT try (after this attempt failed).
// Exported so tests can assert the schedule.
export function backoffMs(attempt) {
  var base = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
  var capped = Math.min(base, RETRY_CAP_DELAY_MS);
  // Full-jitter: pick a random point in [0, capped]. Prevents the
  // thundering-herd retry synchronisation that collapses overloaded
  // upstreams further.
  return Math.floor(Math.random() * capped);
}

function defaultWait(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// Pure builder — exported for unit tests so we can assert request shape
// per provider without a real network call.
export function buildRequest(providerKind, opts) {
  var baseUrl = opts.baseUrl || "";
  var model   = opts.model   || "";
  var apiKey  = opts.apiKey  || "";
  var messages = opts.messages || [];

  if (providerKind === "openai-compatible") {
    return {
      url: joinUrl(baseUrl, "/chat/completions"),
      headers: openAiHeaders(apiKey),
      body: { model: model, messages: messages, max_tokens: 1024, temperature: 0.3 }
    };
  }
  if (providerKind === "anthropic") {
    var sys = "";
    var nonSystem = [];
    messages.forEach(function(m) {
      if (m.role === "system") { sys = (sys ? sys + "\n\n" : "") + m.content; }
      else                     { nonSystem.push({ role: m.role, content: m.content }); }
    });
    var body = {
      model: model,
      max_tokens: 1024,
      messages: nonSystem
    };
    if (sys) body.system = sys;
    return {
      url: joinUrl(baseUrl, "/v1/messages"),
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        // v2.4.5.1 — Anthropic requires this explicit opt-in whenever
        // the request carries an Origin (browser-direct or transparent
        // reverse-proxy). Without it the API responds 401 with a
        // message naming this header literally. Acceptable because our
        // architecture already puts the key in the user's localStorage
        // (single-user workshop tool); v3 server-side gateway is the
        // longer-term answer.
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: body
    };
  }
  if (providerKind === "gemini") {
    // Gemini's Generative Language API expects a contents[] array; system
    // messages collapse into a leading systemInstruction.
    var systemContent = "";
    var contents = [];
    messages.forEach(function(m) {
      if (m.role === "system") {
        systemContent = (systemContent ? systemContent + "\n\n" : "") + m.content;
      } else {
        contents.push({
          role:  m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        });
      }
    });
    var body2 = { contents: contents };
    if (systemContent) body2.systemInstruction = { parts: [{ text: systemContent }] };
    return {
      url: joinUrl(baseUrl, "/v1beta/models/" + encodeURIComponent(model) +
                            ":generateContent?key=" + encodeURIComponent(apiKey)),
      headers: { "Content-Type": "application/json" },
      body: body2
    };
  }
  throw new Error("aiService.buildRequest: unknown provider kind '" + providerKind + "'");
}

function openAiHeaders(apiKey) {
  var h = { "Content-Type": "application/json" };
  if (apiKey) h["Authorization"] = "Bearer " + apiKey;
  return h;
}

function joinUrl(base, path) {
  if (!base) return path;
  if (base.charAt(base.length - 1) === "/") base = base.slice(0, -1);
  if (path.charAt(0) !== "/") path = "/" + path;
  // For Gemini we sometimes already include the full path; check for a
  // collision with `/v1beta`.
  return base + path;
}

// Extract the assistant text from a provider's response shape.
export function extractText(providerKind, json) {
  if (!json) return "";
  if (providerKind === "openai-compatible") {
    var c0 = json.choices && json.choices[0];
    if (!c0) return "";
    var msg = c0.message;
    if (msg && typeof msg.content === "string") return msg.content;
    return "";
  }
  if (providerKind === "anthropic") {
    var blocks = json.content || [];
    var text = "";
    blocks.forEach(function(b) {
      if (b && b.type === "text" && typeof b.text === "string") text += b.text;
    });
    return text;
  }
  if (providerKind === "gemini") {
    var cand = (json.candidates || [])[0];
    if (!cand || !cand.content) return "";
    var parts = cand.content.parts || [];
    var t = "";
    parts.forEach(function(p) { if (typeof p.text === "string") t += p.text; });
    return t;
  }
  return "";
}

// Convenience: run a tiny "Reply OK" probe to verify wiring. Returns
// { ok: true, sample: "..." } or { ok: false, error: "..." }.
export async function testConnection(opts) {
  try {
    var res = await chatCompletion({
      providerKey:    opts.providerKey,
      baseUrl:        opts.baseUrl,
      model:          opts.model,
      fallbackModels: opts.fallbackModels,
      apiKey:         opts.apiKey,
      messages:       [
        { role: "system", content: "Reply with exactly 'OK' — no other words." },
        { role: "user",   content: "Probe." }
      ]
    });
    return { ok: true, sample: (res.text || "").slice(0, 80), modelUsed: res.modelUsed };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}
