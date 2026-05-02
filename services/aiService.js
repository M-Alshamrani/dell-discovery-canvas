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
    // Walk messages preserving original indices so cacheControl[] (which
    // names indices into the full message list) maps cleanly onto the
    // resulting system blocks.
    var systemBlocks = [];          // [{ type:"text", text, cache_control? }]
    var nonSystem = [];
    var cacheIdxSet = (Array.isArray(opts.cacheControl) ? opts.cacheControl : [])
      .reduce(function(acc, i) { acc[i] = true; return acc; }, {});
    messages.forEach(function(m, idx) {
      if (m.role === "system") {
        var block = { type: "text", text: m.content };
        if (cacheIdxSet[idx]) block.cache_control = { type: "ephemeral" };
        systemBlocks.push(block);
      } else {
        nonSystem.push({ role: m.role, content: m.content });
      }
    });
    var body = {
      model: model,
      max_tokens: 1024,
      messages: nonSystem
    };
    if (systemBlocks.length > 0) {
      // SPEC §S20.19 — emit content-block array when ANY block carries a
      // cache_control marker so Anthropic honors per-block caching. When
      // no markers exist (non-Anthropic dispatch path, or cacheControl
      // omitted), collapse to the legacy single-string system field for
      // smaller payloads.
      var anyCacheMarker = systemBlocks.some(function(b) { return !!b.cache_control; });
      if (anyCacheMarker) {
        body.system = systemBlocks;
      } else {
        body.system = systemBlocks.map(function(b) { return b.text; }).join("\n\n");
      }
    }
    // SPEC §S20.18 + RULES §16 CH19 — Anthropic tool-use round-trip.
    // Caller passes the wire-shape tools array (name + description +
    // input_schema only; chatService strips `invoke` before this point).
    if (Array.isArray(opts.tools) && opts.tools.length > 0) {
      body.tools = opts.tools;
    }
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

// streamCompletion(opts) — async generator over Anthropic SSE events.
//
// Yields:
//   { kind: "text",     token:  string }
//   { kind: "tool_use", id, name, input }
//   { kind: "done",     text:   string }
//
// Uses the same buildRequest('anthropic') wire shape as chatCompletion +
// adds body.stream=true. Reads response.body as a ReadableStream and
// parses SSE per Anthropic's documented event grammar (`event: <name>\n
// data: <json>\n\n` blocks). Tool-use input arrives as a sequence of
// input_json_delta partials that we accumulate and JSON.parse on
// content_block_stop. NO retry/fallback here — the stream is committed
// once headers come back; recovery from a mid-stream drop is the
// caller's problem (in v1, surfacing the error to the chat overlay).
//
// SPEC §S20.19. Anthropic-only for rc.2; OpenAI + Gemini SSE deferred.
export async function* streamCompletion(opts) {
  if ((opts.providerKey || "") !== "anthropic") {
    throw new Error("streamCompletion: only providerKey='anthropic' supported in rc.2; got " + (opts.providerKey || "(none)"));
  }
  var fetchImpl = opts.fetchImpl || (typeof window !== "undefined" ? window.fetch.bind(window) : null);
  if (!fetchImpl) throw new Error("streamCompletion: no fetch implementation available");

  var built = buildRequest("anthropic", opts);
  built.body.stream = true;

  var resp = await fetchImpl(built.url, {
    method:  "POST",
    headers: built.headers,
    body:    JSON.stringify(built.body)
  });
  if (!resp.ok) {
    var bodyText = "";
    try { bodyText = await resp.text(); } catch (_e) {}
    throw buildHttpError("anthropic", resp.status, bodyText);
  }
  if (!resp.body || typeof resp.body.getReader !== "function") {
    throw new Error("streamCompletion: Anthropic response.body is not a ReadableStream (browser-only path)");
  }

  var reader  = resp.body.getReader();
  var decoder = new TextDecoder();
  var buffer  = "";
  // Track in-flight tool_use blocks by content-block index so input_json_delta
  // partials accumulate until content_block_stop.
  var toolBlocks = {}; // index → { id, name, partialJson }
  var fullText = "";

  while (true) {
    var chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });

    // SSE events are separated by a blank line (\n\n). Drain complete
    // events; leave a trailing partial event in the buffer.
    var idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      var block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      var dataLine = "";
      var lines = block.split("\n");
      for (var li = 0; li < lines.length; li++) {
        if (lines[li].slice(0, 6) === "data: ") {
          dataLine += lines[li].slice(6);
        }
      }
      if (!dataLine) continue;
      var parsed;
      try { parsed = JSON.parse(dataLine); } catch (_e) { continue; }
      if (!parsed) continue;

      if (parsed.type === "content_block_start" && parsed.content_block) {
        var cb = parsed.content_block;
        if (cb.type === "tool_use") {
          toolBlocks[parsed.index] = {
            id: cb.id || null,
            name: cb.name || "",
            partialJson: ""
          };
        }
      } else if (parsed.type === "content_block_delta" && parsed.delta) {
        if (parsed.delta.type === "text_delta" && typeof parsed.delta.text === "string") {
          fullText += parsed.delta.text;
          yield { kind: "text", token: parsed.delta.text };
        } else if (parsed.delta.type === "input_json_delta") {
          var tb1 = toolBlocks[parsed.index];
          if (tb1) tb1.partialJson += (parsed.delta.partial_json || "");
        }
      } else if (parsed.type === "content_block_stop") {
        var tb2 = toolBlocks[parsed.index];
        if (tb2) {
          var input = {};
          try { input = JSON.parse(tb2.partialJson || "{}"); } catch (_e) { input = {}; }
          yield { kind: "tool_use", id: tb2.id, name: tb2.name, input: input };
        }
      }
      // message_start / message_delta / message_stop / ping → informational
    }
  }
  yield { kind: "done", text: fullText };
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
