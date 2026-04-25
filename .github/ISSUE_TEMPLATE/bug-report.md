---
name: Bug report
about: Report a defect in the app
title: '[BUG] '
labels: bug
---

## Steps to reproduce

1.
2.
3.

## Expected vs actual

**Expected**:

**Actual**:

## Environment

- App tag (footer / DevTools console `APP_VERSION`):
- Browser + version:
- OS:
- Container deploy mode (localhost-only / LAN-shared / other):
- Was the test banner green BEFORE the bug appeared?

## Evidence

Paste DevTools console output, screenshots, or session JSON (export via "Save to file" if relevant).

⚠ **Don't include API keys** in pasted output. Redact `apiKey: "..."` entries from any `ai_config_v1` snapshots.

## Workshop impact

Does this bug block a real workshop, slow it down, or just look wrong? Be specific so triage can prioritise.

---

Before submitting:

- [ ] Searched existing issues; this isn't a duplicate.
- [ ] Confirmed reproducible (steps work on a fresh `Clear all data` + reload).
- [ ] If touching the AI flow, confirmed the issue isn't a transient provider-side rate-limit or 5xx (check the retry/backoff behaviour).
