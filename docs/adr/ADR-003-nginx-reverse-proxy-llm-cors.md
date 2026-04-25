# ADR-003 · nginx reverse-proxy for LLM CORS + auth-header passthrough

## Status

**Accepted** — shipped in v2.4.0 (Phase 19a) and stable since. Reviewed at v2.4.5.1 (Anthropic browser-direct header) and v2.4.10 (cache-busting).

## Context

The AI platform needs to call three LLM upstreams from the browser:

- **Local vLLM** — OpenAI-compatible self-hosted server, typical default `host.docker.internal:8000`.
- **Anthropic Claude API** — `api.anthropic.com`, public.
- **Google Gemini API** — `generativelanguage.googleapis.com`, public.

Direct browser-to-API calls have two problems:

1. **CORS** — Anthropic and Gemini don't ship permissive `Access-Control-Allow-Origin` headers for arbitrary browser origins. Calls from a static-file SPA fail at the preflight.
2. **API-key handling** — even when CORS works, exposing the key in network logs at the browser level is a real concern.

A common pattern is to add a small server proxy. The constraint we have: [ADR-001](ADR-001-vanilla-js-no-build.md) — no Node backend in v2.

## Decision

**Use the existing `nginx:alpine` static-file container as a same-origin reverse proxy** for all three LLM endpoints.

`docker-entrypoint.d/45-setup-llm-proxy.sh` writes `/etc/nginx/snippets/llm-proxy.conf` at container start with three `location` blocks:

```nginx
location /api/llm/local/ {
  access_log off;
  proxy_pass http://${LLM_HOST}:${LLM_LOCAL_PORT}/;
  ...
}
location /api/llm/anthropic/ {
  access_log off;
  resolver 1.1.1.1 8.8.8.8 valid=300s ipv6=off;
  proxy_pass https://api.anthropic.com/;
  proxy_ssl_server_name on;
  proxy_pass_request_headers on;
  ...
}
location /api/llm/gemini/ {
  access_log off;
  resolver 1.1.1.1 8.8.8.8 valid=300s ipv6=off;
  proxy_pass https://generativelanguage.googleapis.com/;
  ...
}
```

Browser calls: `fetch('/api/llm/anthropic/v1/messages', { headers: {'x-api-key': key, ...} })`. Same-origin → no CORS. `proxy_pass_request_headers on` forwards the user's key untouched.

`access_log off` per [SPEC §12.8 invariant 5](../../SPEC.md): API keys never appear in nginx logs. Public-DNS resolvers (1.1.1.1, 8.8.8.8) are configured because nginx's default resolver is empty inside Alpine; without them `proxy_pass` to a hostname fails on first request.

**Anthropic browser-direct opt-in** (v2.4.5.1): Anthropic's API requires the header `anthropic-dangerous-direct-browser-access: true` whenever a request carries an `Origin` header (our nginx proxy preserves it). Without it Anthropic returns 401 with a message naming the header. `services/aiService.js buildRequest("anthropic", ...)` sets the header unconditionally.

## Alternatives considered + rejected

- **Direct browser-to-API calls** — fails CORS for Anthropic + Gemini. Non-starter.
- **Browser → CloudFlare Worker → upstream** — adds an external dependency (CloudFlare account). Overkill for a single-tenant tool.
- **Browser → custom Node/Express proxy in another container** — violates ADR-001's no-Node-backend constraint and adds an operational surface.
- **Per-provider browser SDK** — Anthropic + Gemini both ship SDKs but they bundle a fetch implementation that doesn't help with CORS or key-leakage at the network layer.
- **Logging proxy requests for debugging** — explicitly rejected. `access_log off` is invariant. Debugging happens in the browser DevTools network panel, where the user can see their own traffic.

## Consequences

### Good

- **One container, one image, one auth surface** — no separate proxy to deploy, monitor, or upgrade.
- **CORS solved** — same-origin, always.
- **Keys never logged server-side** — explicit policy.
- **Adding a new provider is mechanical** — add an entry to `core/aiConfig.js PROVIDERS`, a request-shape function in `services/aiService.js`, a proxy `location` in `45-setup-llm-proxy.sh`. Three small additions, zero refactor.
- **Multi-arch friendly** — `nginx:alpine` ships linux/amd64 + linux/arm64; the proxy works identically on Dell GB10 (Grace ARM64) and on x86 workstations.

### Bad / accepted trade-offs

- **The LLM upstream is reached over the host's network** — if the user's network blocks `api.anthropic.com`, the app sees a transient error rather than a clear "blocked by firewall" signal. Mitigated by [SPEC §12.4a reliability contract](../../SPEC.md) (retry + fallback chain + clear error messages on 4xx).
- **`/api/llm/local/` requires the host-gateway extra hosts mapping in `docker-compose.yml`** to reach `host.docker.internal` on Linux Docker (default works on Docker Desktop). Documented in `RUNBOOK.md`.
- **No request-rate limiting at the proxy** — relies on upstream provider rate-limiting + the in-app retry-with-backoff. Acceptable for single-user use; v3 multi-user will need its own rate-limiting tier.
- **`/api/llm/local/v1/*` doesn't restrict path** — the user could in theory issue arbitrary paths to the local vLLM. Acceptable because the local vLLM is owned by the same user.

## When to revisit

1. **A new LLM provider with non-standard auth** (e.g., AWS Sigv4 signing for Bedrock) — the simple `proxy_pass_request_headers on` model breaks down. Either add per-provider request signing inside `services/aiService.js`, or move that provider's auth into the proxy via a Lua/njs script.
2. **v3 multi-user platform** — the proxy will move to the application backend, where it can do rate-limiting + per-tenant key management.
3. **Anthropic withdraws the `anthropic-dangerous-direct-browser-access` opt-in** — flagged in [RISK_REGISTER R-006](../operations/RISK_REGISTER.md). If revoked, would force a server-side proxy.

See [SPEC §12.4a · Reliability](../../SPEC.md) for the retry-with-backoff + fallback-chain semantics that sit on top of this proxy.
