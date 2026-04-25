# Dependency policy

When to bump every external dependency the project relies on.

The project's [ADR-001](../adr/ADR-001-vanilla-js-no-build.md) commitment: **no npm dependencies**. The dependency surface is therefore small — container base image, OS packages inside the image, browser baseline, AI provider models. This file enumerates each and the bump cadence.

---

## 1 · `nginx:1.27-alpine` base image

| | |
|---|---|
| **Pinned at** | `nginx:1.27-alpine` (Dockerfile line 3) |
| **Cadence** | Every 3 months OR on a CVE with CVSS ≥ 7.0 affecting nginx |
| **Bump procedure** | [RUNBOOK.md §6](RUNBOOK.md) |
| **Last bump** | 2026-01 (start of project) |

**Why pinned to major**: `1.27` follows the 1.27 minor series; minor bumps (`1.27.1` → `1.27.2`) come automatically on rebuild. Major bumps (`1.27` → `1.28`) are explicit decisions because of potential config-syntax changes.

**Test after bump**:
1. `docker compose down && docker compose up -d --build`.
2. `curl http://localhost:8080/health` → `ok`.
3. Browser smoke: open in incognito, confirm green test banner.
4. Walk Tabs 1-5 quickly; no console errors.

If any test fails, roll back the Dockerfile and investigate before re-attempting.

## 2 · Alpine OS packages

| | |
|---|---|
| **Installed** | `apache2-utils` (only) |
| **Cadence** | Bumps with the Alpine base image (apk-managed) |
| **Pinned at** | The Alpine version implicit in `nginx:1.27-alpine` |

**Why this package**: provides the `htpasswd` binary used by `docker-entrypoint.d/40-setup-auth.sh` to generate the bcrypt-style `.htpasswd` file when LAN auth is enabled.

**No other apk packages are installed**. Re-evaluate each `.dNN` pass to ensure no scope creep.

## 3 · AI provider models

Each provider has a default model in `core/aiConfig.js DEFAULT_AI_CONFIG.providers.<provider>.model` and an optional fallback chain.

| Provider | Default model | Fallback chain | When to bump |
|---|---|---|---|
| Anthropic | `claude-haiku-4-5` | `["claude-sonnet-4-5"]` | When the default deprecates OR a new generation lands |
| Gemini | `gemini-2.5-flash` | `["gemini-2.0-flash", "gemini-1.5-flash"]` | When the default deprecates |
| Local | `code-llm` (placeholder) | `[]` (single-model mode) | User-controlled (per their vLLM deployment) |

**Auto-migration on deprecation**: `core/aiConfig.js DEPRECATED_MODELS` maps deprecated → replacement. Currently:
```js
DEPRECATED_MODELS = {
  gemini: { "gemini-2.0-flash": "gemini-2.5-flash" }
};
```

When a vendor deprecates a model:
1. Add an entry to `DEPRECATED_MODELS[providerKey]`.
2. `mergeWithDefaults` applies it on every `loadAiConfig()` — user keys preserved, model auto-migrates.
3. No user action required.

**Monitor the changelogs**:
- [Anthropic API changelog](https://docs.anthropic.com/en/release-notes)
- [Google Gemini deprecations](https://ai.google.dev/gemini-api/docs/migrate-to-cloud)

Check at every `.dNN` pass; add deprecation entries as needed.

## 4 · Browser baseline

| | |
|---|---|
| **Supported** | Last 2 major versions of Chromium (Chrome / Edge / Brave / Opera), Firefox, Safari |
| **Not supported** | IE11 (explicit), pre-2024 mobile browsers |
| **Cadence** | Reviewed every 6 months; documented in [BROWSER_SUPPORT.md](../wiki/reference/BROWSER_SUPPORT.md) |

**Why "last 2 majors"**: ES module support, File System Access API (Chrome/Edge for `.canvas`), `localStorage` reliability, modern CSS (custom properties, hairline rendering) all stable in this baseline.

**On a baseline shift**: update [BROWSER_SUPPORT.md](../wiki/reference/BROWSER_SUPPORT.md) with the new test matrix. Mention in `RELEASE_NOTES.md`.

## 5 · No npm dependencies (the load-bearing rule)

| | |
|---|---|
| **State** | `package.json` does not exist |
| **Enforcement** | Per ADR-001; revert any commit that introduces npm deps |
| **Scope** | Includes vendored single-file libs that would normally be npm-installed |

**If a future feature needs a real library** (e.g., Mermaid for in-app diagram rendering on the planned `/knowledge` route, v2.7.0):

1. Pre-render at author-time and check in static SVG (preferred — no runtime dep).
2. Vendor the library as a single-file copy with attribution in the file header (acceptable — no npm).
3. Add npm + a build step (only with explicit approval; supersedes ADR-001).

The bar for option 3 is **very high**. The maintenance cost of a build chain over multi-year project lifecycle is the cost we explicitly avoided in v1.

## 6 · Docker BuildKit / multi-arch

| | |
|---|---|
| **Required** | `docker buildx` for multi-arch (linux/amd64 + linux/arm64) |
| **Cadence** | Bumps with Docker Desktop / Docker Engine itself |

No specific pin. Recent `docker buildx` versions have been backward-compatible with our Dockerfile syntax.

## 7 · Bumps that REQUIRE a new functional release

Some "bumps" are functional changes, not dep bumps. They require a new SemVer-strict tag (not `.dNN`):

- Adding a new AI provider (extends `PROVIDERS` array → user-visible UI change).
- Migrating a deprecated model when the migration path involves new code (not just a `DEPRECATED_MODELS` table entry).
- Bumping nginx major version if the bump requires config-syntax changes.

These are **not** dependency-policy work; they're functional releases routed through the normal phase / version process per [CONTRIBUTING.md](../../CONTRIBUTING.md).

## 8 · CVE response procedure

For a critical CVE (CVSS ≥ 7.0) affecting nginx or Alpine:

1. **Within 24h**: assess. Read the CVE; check whether the vulnerability is reachable in our config (e.g., a CVE on a feature we don't enable doesn't apply).
2. **If reachable**: schedule the bump within 1 week. Run the [RUNBOOK §6](RUNBOOK.md) procedure.
3. **If not reachable**: document the assessment in this file. No action needed.

For a critical CVE on `apache2-utils`: the bump comes with the next Alpine bump. If urgent, force-rebuild the image with `apk update && apk upgrade apache2-utils` baked into the Dockerfile.

## Refresh trigger

Update this file:
- When a new dependency is introduced (any tier).
- When a bump cadence changes.
- After every actual bump (record in the version-history of the relevant section).
- Every `.dNN` hygiene-pass — re-audit each tier.
