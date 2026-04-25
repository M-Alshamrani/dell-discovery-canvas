# Runbook

How to operate, recover, and roll back the Dell Discovery Canvas in production.

**Audience**: anyone responsible for keeping the app running. Today: the project owner running on their workstation. Future: any operator on shared LAN deployment.

---

## 1 · Deploy a clean instance

### 1.1 Localhost-only (default · safe for personal dev)

```bash
git clone https://github.com/M-Alshamrani/dell-discovery-canvas.git
cd dell-discovery-canvas
docker compose up -d --build
```

Default behaviour:
- **Port** `8080` on `127.0.0.1` (localhost-only).
- **No auth.** Safe because not reachable from the LAN.
- **HEALTHCHECK** every 30s; container marked `(healthy)` after the first pass.

Verify:
```bash
curl http://localhost:8080/health   # → ok
docker ps --filter name=dell-discovery   # → status (healthy)
```

Open in browser: `http://localhost:8080`. Wait for green test banner ("✅ All 509 tests passed").

### 1.2 LAN-exposed (shared-team workstation)

```bash
AUTH_USERNAME=<your-username> \
AUTH_PASSWORD=<strong-password> \
BIND_ADDR=0.0.0.0 \
docker compose up -d --build
```

Default behaviour:
- **Port** `8080` on **all interfaces** (LAN-reachable).
- **HTTP Basic auth** required for everything except `/health`.
- htpasswd file generated at container start by `docker-entrypoint.d/40-setup-auth.sh` using `apr1` (bcrypt-style MD5).

⚠ **Never set `AUTH_USERNAME` without `AUTH_PASSWORD`** (or vice versa) — the entrypoint warns and fails to enable auth, leaving the container exposed without protection.

⚠ **Never expose the container to the public internet** without (a) HTTP Basic auth, (b) a real TLS terminator in front (nginx-proxy-manager, Cloudflare Tunnel, etc.). The built-in auth is rate-limit-free; brute-force will succeed eventually.

### 1.3 Custom port

```bash
HOST_PORT=9090 docker compose up -d --build
# → http://localhost:9090
```

The default 8080 was chosen to avoid colliding with the Dell GB10's vLLM containers (8000 / 8001).

## 2 · Roll back

### 2.1 Roll back to a prior functional tag

```bash
docker compose down
git checkout v2.4.10        # or whichever functional tag
docker compose up -d --build
```

Test sequence after rollback:
```bash
curl http://localhost:8080/health                 # → ok
# Open http://localhost:8080 in browser
# Wait for green test banner
# Walk Tabs 1-5 with the demo session
```

⚠ **Session compatibility**: rolling back to a tag whose `migrateLegacySession` doesn't know about your current session shape may cause the migrator to silently drop fields. See [VERSION_COMPAT.md](VERSION_COMPAT.md). Export a `.canvas` workbook before rolling back if the session is critical.

### 2.2 Roll back to a `.dNN` clean clone

```bash
docker compose down
git checkout v2.4.11.d01     # SemVer-equivalent to v2.4.11
docker compose up -d --build
```

Same procedure as 2.1; clean clones are functionally identical to their source tag.

## 3 · Recover from corrupted localStorage

User reports the app loads to a blank page or crashes on startup; tests fail. Likely cause: a malformed entry in `localStorage[dell_discovery_v1]` that the migrator can't handle.

### Quick fix · let the user reset

Have the user click the **"Clear all data"** button in the footer (red-tinted, separate from "+ New session"). Wipes every `dell_discovery_*` and `ai_*` key and reloads. App starts fresh.

### Surgical fix · DevTools

If the user wants to preserve some data (e.g., their AI provider config but not session):

1. **F12** → Application → Storage → Local Storage → `http://localhost:8080`.
2. Identify the broken key (likely `dell_discovery_v1` if session is the issue).
3. **Right-click** → Delete.
4. Reload.

The remaining keys (e.g., `ai_config_v1`) survive. App starts with a fresh empty session.

### Forensic fix · export the broken state first

```javascript
// In DevTools console:
localStorage.getItem('dell_discovery_v1')   // copy + paste somewhere safe
```

Then delete + reload. If the user wants to recover later, reverse-engineer the JSON; if not, the export at least keeps the data accessible.

## 4 · Recover a wiped session

User reports they deliberately or accidentally clicked "Clear all data" and want their session back.

### From a `.canvas` file (v2.4.10+)

If the user previously clicked **"Save to file"** (footer), they have a `.canvas` workbook on disk. To restore:

1. In the app, click **"Open file"** (footer).
2. Pick the `.canvas` file.
3. The app loads the session through `migrateLegacySession` (cross-version compatible).

### From a JSON export

Older sessions used "Export JSON". To restore:

1. **F12** → Application → Local Storage → `http://localhost:8080`.
2. Add a new key `dell_discovery_v1` with the JSON-string value as `Value`.
3. Reload the app — the session is restored.

### No backup exists

Sorry. Deleted localStorage data is unrecoverable client-side. Going forward, encourage users to click **"Save to file"** at the end of every workshop.

## 5 · Switch AI providers without losing skills

User has skills built against Anthropic; they want to evaluate Gemini.

1. **Gear icon** (top-right header) → Settings → AI Providers.
2. Click the **Gemini** provider pill.
3. Paste their Gemini API key.
4. Click **Test connection** → expect `"✓ OK (model: gemini-2.5-flash)"`.
5. Close the modal.
6. Now skills run against Gemini by default. Skills with `providerKey: "anthropic"` (per-skill override) still run against Anthropic.

Skills survive provider switches. The `providerKey: null` default → use active provider; `providerKey: "<provider>"` → pin to that provider regardless of active.

## 6 · Bump the nginx base image

Cadence per [DEPENDENCY_POLICY.md §1](DEPENDENCY_POLICY.md): **every 3 months OR on a CVE with CVSS ≥ 7.0**.

Procedure:

1. Edit [`Dockerfile`](../../Dockerfile) line 3:
   ```
   FROM nginx:1.27-alpine     # → e.g., nginx:1.28-alpine
   ```
2. Build + smoke locally:
   ```bash
   docker compose down
   docker compose up -d --build
   curl http://localhost:8080/health
   # Open browser, confirm green test banner
   # Walk Tabs 1-5 quickly
   ```
3. If everything passes, commit:
   ```bash
   git checkout -b deps-bump-nginx-1.28
   git add Dockerfile
   git commit -m "deps: bump nginx 1.27 → 1.28"
   ```
4. PR / push to main per [CONTRIBUTING.md](../../CONTRIBUTING.md). No new tag needed unless the bump is part of a functional release.

## 7 · Health check + monitoring

**HEALTHCHECK** is built into the image:
```Dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
```

**External monitoring**: the `/health` endpoint is auth-free. Point any uptime monitor (Pingdom, UptimeRobot, internal Nagios, etc.) at it.

**Log inspection**:
```bash
docker compose logs -f                    # live logs
docker compose logs --tail=200            # last 200 lines
docker exec dell-discovery-canvas tail -f /var/log/nginx/error.log    # nginx errors
```

**No access logs for `/api/llm/*`** by design ([SPEC §12.8 invariant 5](../../SPEC.md)). User keys must not appear in nginx logs.

## 8 · Common failure modes

### "I see a red test banner"

→ Tests are failing. **Don't ignore.** Open DevTools console, find the failing assertion, identify the regression. If you can't fix it, escalate; do not deploy this build.

### "Anthropic returns 401 even with a valid key"

→ Likely the `anthropic-dangerous-direct-browser-access: true` header was stripped somewhere. The app sets it unconditionally in `services/aiService.js buildRequest`. If you've forked or patched, verify.

### "Gemini returns 429 too often"

→ The default fallback chain (`gemini-2.5-flash → gemini-2.0-flash → gemini-1.5-flash`) handles transient overload. The user can edit the chain in Settings. Or pin a less-popular model.

### "Local vLLM proxy fails with 502"

→ Check `LLM_HOST` env var. Default `host.docker.internal:8000` works on Docker Desktop. On Linux, ensure the `extra_hosts` mapping in `docker-compose.yml` has `host.docker.internal:host-gateway`.

### "Container starts but health check fails"

→ Likely an `entrypoint.d` script error. `docker compose logs` shows entrypoint output:
- "FATAL: htpasswd failed to write..." → `apache2-utils` not installed (image broken).
- LLM proxy errors → `45-setup-llm-proxy.sh` failed, but nginx will still start; only `/api/llm/*` routes are broken.

### "User complains 'I clicked Save and it didn't save'"

→ Likely localStorage quota exceeded. Check `localStorage` size in DevTools Application tab. If undo stack is huge, reset it via "+ New session" or clear `ai_undo_v1` directly.

## 9 · Image management

### Push to a private registry

If shipping internally:

```bash
docker tag dell-discovery-canvas:latest registry.dell.internal/dell-discovery-canvas:v2.4.11
docker push registry.dell.internal/dell-discovery-canvas:v2.4.11
```

⚠ **Note**: Docker tag rules don't allow `+`. Use `.dNN` form for hygiene clones (e.g., `:v2.4.11.d01` instead of `:v2.4.11+d01`). Already canonicalised in [CONTRIBUTING.md tag conventions](../../CONTRIBUTING.md).

### Multi-arch build

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t dell-discovery-canvas:v2.4.11 .
```

ARM64 build is required for Dell GB10 / Grace deployment. Tested at build only; live execution on real ARM64 hardware is pending verification (HANDOFF Bucket D).

## 10 · Operational invariants (see [INVARIANTS.md](../../INVARIANTS.md))

- **`/health` is always accessible without auth** (INV-O5).
- **No telemetry** on `/api/llm/*` — keys never logged (INV-AI5).
- **No build step** in the image (INV-O1).
- **No npm dependencies** at runtime (INV-O2).
- **Multi-arch** image (INV-O3).
- **Full security headers** on every response (INV-O4).

If any of these break in production, treat as a P1 incident. None of them are aspirational; they're load-bearing.
