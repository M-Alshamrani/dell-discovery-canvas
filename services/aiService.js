// services/aiService.js — Phase 19 / v2.4.0
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
// (typically self-hosted vLLM with --allowed-origins '["*"]'`).

const PROVIDER_FROM_KEY = {
  local:     "openai-compatible",
  anthropic: "anthropic",
  gemini:    "gemini"
};

// Public API — single entry point.
//   chatCompletion({
//     providerKey: "local" | "anthropic" | "gemini",
//     baseUrl:     resolved URL (relative or absolute),
//     model:       string,
//     apiKey:      string (may be empty for local),
//     messages:    [{ role: "system" | "user" | "assistant", content: "..." }],
//     fetchImpl:   optional override (for tests; defaults to window.fetch)
//   }) → Promise<{ text: string, raw: any }>
//
// Throws on network or HTTP errors. Caller catches and surfaces.
export async function chatCompletion(opts) {
  var providerKey = opts.providerKey || "local";
  var providerKind = PROVIDER_FROM_KEY[providerKey] || "openai-compatible";
  var fetchImpl = opts.fetchImpl || (typeof window !== "undefined" ? window.fetch.bind(window) : null);
  if (!fetchImpl) throw new Error("aiService.chatCompletion: no fetch implementation available");

  var built = buildRequest(providerKind, opts);
  var resp = await fetchImpl(built.url, {
    method:  "POST",
    headers: built.headers,
    body:    JSON.stringify(built.body)
  });
  if (!resp.ok) {
    var bodyText = "";
    try { bodyText = await resp.text(); } catch (e) { /* swallow */ }
    throw new Error("aiService " + providerKey + " HTTP " + resp.status +
      (bodyText ? ": " + bodyText.slice(0, 240) : ""));
  }
  var json = await resp.json();
  return { text: extractText(providerKind, json), raw: json };
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
        "anthropic-version": "2023-06-01"
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
      providerKey: opts.providerKey,
      baseUrl:     opts.baseUrl,
      model:       opts.model,
      apiKey:      opts.apiKey,
      messages:    [
        { role: "system", content: "Reply with exactly 'OK' — no other words." },
        { role: "user",   content: "Probe." }
      ]
    });
    return { ok: true, sample: (res.text || "").slice(0, 80) };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}
