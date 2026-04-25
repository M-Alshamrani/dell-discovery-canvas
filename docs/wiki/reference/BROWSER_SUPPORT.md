# Browser support

Which browsers are supported, which are explicitly out, and the test matrix exercised on each release.

---

## Supported (last 2 major versions)

| Browser | Engine | Status | Notes |
|---|---|---|---|
| **Chrome** | Chromium | ✅ Primary target | All features work; File System Access API for `.canvas` is native |
| **Microsoft Edge** | Chromium | ✅ Same as Chrome | Default browser for many Dell-issued workstations |
| **Brave / Opera / other Chromium derivatives** | Chromium | ✅ Treated as Chrome equivalent | Aggressive privacy settings may need cookie/storage exception for `localhost` |
| **Firefox** | Gecko | ✅ Supported | `.canvas` save uses `<a download>` fallback (no File System Access API yet) |
| **Safari** | WebKit | ✅ Supported | macOS 14+; same fallback as Firefox for `.canvas` save |

## Not supported

| Browser | Reason |
|---|---|
| **Internet Explorer 11** | No ES module support |
| **Mobile browsers** | The 5-tab matrix UI is not designed for narrow viewports; not blocked by code, but not tested. v2 is a desktop tool. |
| **Browsers without `localStorage`** | The app needs persistent storage; private/incognito modes work but state evaporates on tab-close (acceptable for one-off review) |

## Feature support matrix

| Feature | Chromium | Firefox | Safari |
|---|---|---|---|
| ES modules + dynamic `import()` | ✅ | ✅ | ✅ |
| `localStorage` API | ✅ | ✅ | ✅ |
| File System Access API (`.canvas` native save/open) | ✅ | ❌ (download fallback) | ❌ (download fallback) |
| `<a download>` fallback for save | ✅ | ✅ | ✅ |
| Web App Manifest + `file_handlers` | ✅ Chrome/Edge | ⚠ Partial | ❌ |
| `BroadcastChannel` API (future cross-tab sync) | ✅ | ✅ | ✅ |
| `performance.now()` | ✅ | ✅ | ✅ |
| `crypto.randomUUID()` | ✅ 92+ | ✅ 95+ | ✅ 15.4+ |

## Test matrix per release

Every functional release is manually smoke-tested on **at least Chrome on the developer's primary OS**. Other browsers are spot-checked when the release touches CSS or modern JS APIs.

For a release that touches **CSS**:
- ✅ Chrome (primary)
- ✅ Firefox (rendering / hairline / variable-font fallback)
- ✅ Safari (if available; macOS-specific)

For a release that touches **File System Access API** (`.canvas` flow):
- ✅ Chrome (native FSA path)
- ✅ Firefox (`<a download>` fallback)
- ✅ Safari (`<a download>` fallback)

For a release that touches **the AI flow only**:
- ✅ Chrome (sufficient — XHR/fetch + JSON pathways are standard)

## Mobile / tablet

**Out of scope for v2.** No mobile-tested rendering. The matrix UI requires a desktop viewport (≥1280px wide).

A presales engineer may run the workshop on a laptop projecting to a customer's screen — that's the supported scenario. Tablet support is on the v3 roadmap when multi-user platform lands.

## Refresh trigger

Update this file:
- When a CSS or JS API used by the app changes browser-support semantics.
- When a release touches a feature listed in the matrix.
- Every `.dNN` hygiene-pass — re-validate the smoke matrix matches reality.
