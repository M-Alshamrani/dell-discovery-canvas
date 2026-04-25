# How to · Add a new AI provider

**Audience**: contributor extending the AI platform with a new LLM upstream (e.g., OpenAI direct, AWS Bedrock, Mistral, a local model server).
**Outcome**: users can pick the new provider in Settings, paste a key, and have skills run against it like Anthropic / Gemini / local.

This is a **mechanical extension** — no schema migrations, no UI rework, just three files + tests.

---

## Three changes

### 1. `core/aiConfig.js`

Add a new entry to `PROVIDERS` and `DEFAULT_AI_CONFIG.providers`:

```js
export const PROVIDERS = ["local", "anthropic", "gemini", "newprovider"];

export const DEFAULT_AI_CONFIG = {
  // ...
  providers: {
    // ...existing...
    newprovider: {
      label:          "New Provider",
      baseUrl:        "/api/llm/newprovider",   // proxy path; match the nginx location below
      model:          "newprovider-default-model",
      apiKey:         "",
      fallbackModels: []
    }
  }
};
```

`mergeWithDefaults` will preserve user keys + apply any deprecation migrations you declare in `DEPRECATED_MODELS[providerKey]`.

### 2. `services/aiService.js`

Add a request-shape branch in `buildRequest(providerKey, ...)` and a response-extraction branch in `extractText(providerKey, raw)`. Pattern:

```js
} else if (providerKey === "newprovider") {
  return {
    url:     baseUrl + "/v1/chat/completions",
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model:    model,
      messages: messages
      // any provider-specific fields
    })
  };
}

// in extractText:
} else if (providerKey === "newprovider") {
  return raw && raw.choices && raw.choices[0] && raw.choices[0].message
       ? (raw.choices[0].message.content || "")
       : "";
}
```

If the provider needs special browser-side opt-in headers (like Anthropic's `anthropic-dangerous-direct-browser-access`), set them in `buildRequest`.

### 3. `docker-entrypoint.d/45-setup-llm-proxy.sh`

Add a new `location` block for the proxy path:

```bash
cat >> "$LLM_INCLUDE" <<EOF
location /api/llm/newprovider/ {
  access_log off;
  resolver 1.1.1.1 8.8.8.8 valid=300s ipv6=off;
  proxy_pass https://api.newprovider.com/;
  proxy_http_version 1.1;
  proxy_set_header Host api.newprovider.com;
  proxy_ssl_server_name on;
  proxy_ssl_name api.newprovider.com;
  proxy_read_timeout 120s;
  proxy_send_timeout 120s;
  proxy_pass_request_headers on;
}
EOF
```

`access_log off` is **mandatory** per [SPEC §12.8 invariant 5](../../../SPEC.md) — keys never appear in nginx logs.

## Tests to add

- **Suite 25 (AI integration)** — extend `buildRequest` round-trip test for the new provider; verify the URL + headers + body shape match the upstream API spec.
- **Suite 25 (extractText)** — feed a representative successful response, verify text extraction.
- **Suite 36 (RB1-RB7)** — if the provider has different retriable status codes (it shouldn't; standard HTTP), add an assertion.
- **Manual smoke** — paste a real key in Settings, click Test connection, verify "✓ OK" reports the model that answered.

## Container rebuild

```bash
docker compose down
docker compose up -d --build
```

The entrypoint script re-runs at start; the new `location` is picked up. No image-internal config to bake in.

## Done · checklist

- [ ] `PROVIDERS` array includes the new key.
- [ ] `DEFAULT_AI_CONFIG.providers` has the new entry.
- [ ] `buildRequest` + `extractText` branches handle the new key.
- [ ] `45-setup-llm-proxy.sh` has the new `location`.
- [ ] At least one new test asserts the request shape.
- [ ] Manual smoke confirms a real call works end-to-end.
- [ ] Settings modal renders the new provider pill (this is automatic — `PROVIDERS` drives the UI loop).
- [ ] No localStorage migration needed (additive change to provider map).

See [adr/ADR-003](../../adr/ADR-003-nginx-reverse-proxy-llm-cors.md) for the proxy rationale and [SPEC §12.7](../../../SPEC.md) for the extension-points table this how-to instantiates.
