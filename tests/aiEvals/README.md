# Canvas AI Assist — Evaluation Harness

**Status**: Sub-arc A.1 (foundation) · 5 sample golden cases shipped · 25 cases + baseline.json arrives in Sub-arc A.2.

This is the **measurement bar** for every Canvas AI Assist chat improvement. Sub-arcs B (personas + soft-warn verifier), C (knowledge base), and D (action proposals) all re-run this harness to quantify whether a prompt/architecture change actually improved quality.

## What this is

A browser-runnable evaluation framework that:

1. Loads a hand-authored **golden test case** (`goldenSet.js`) — a real question a presales engineer would type.
2. Drives the live `chatService.streamChat` against the case's prompt, using the user's currently-configured LLM provider.
3. Captures the chat's actual answer.
4. Sends the answer + the case's rubric to a **meta-LLM judge** (`judgePrompt.js`) which scores it across 5 dimensions (0-2 each, max 10/case).
5. Aggregates pass rate + per-dimension averages + per-category averages.
6. Lets you **download `baseline.json`** to commit the snapshot.

Every prompt tuning commit downstream re-runs the harness and compares against the baseline — improvements are quantified, regressions are caught.

## How to run

### Option 1 · From the console

```js
// Anywhere on the running Canvas app (e.g. open devtools):
window.runCanvasAiEvals();

// Or with overrides:
window.runCanvasAiEvals({
  judgeProviderKey: "anthropic",   // pin the judge to a strong model
  cases: GOLDEN_SET.slice(0, 2)    // run a subset
});
```

### Option 2 · Auto-run via URL flag

```
http://localhost:8080/?runEvals=1
```

Starts an eval run 500ms after page boot. Results render in a floating panel bottom-right.

## How to read the output

**Per-case scoring**: each case gets 5 scores (0-2):

- **Grounded** — no fabrications · every claim traces back to engagement data or documented Canvas concepts
- **Complete** — covers the elements a presales engineer would expect
- **Useful** — ends with a concrete next step (a question, a tab, a decision)
- **Honest** — when data isn't in the canvas, says so without inventing a number
- **Right-sized** — terse for simple questions, structured for complex ones

Total ≥ 7/10 = pass. Below = fail.

**Aggregate**:
- Pass rate (e.g. `4/5 passed (80%)`)
- Avg score (e.g. `7.4/10`)
- Per-dimension avg (e.g. `grounded=1.8 · honest=2.0 · useful=1.4`) — tells you which dimension to tune next
- Per-category avg (e.g. `discovery=8.0 · refusal=9.0 · multi-turn=5.5`) — tells you which use case is weak

## Cost

**Per case**: 2 LLM calls (the chat under test + the judge).

| Provider | Approx cost per 5-case run | Notes |
|---|---|---|
| Local LLM | $0.00 | Free if you're running the proxy |
| Anthropic Claude Sonnet | $0.05-$0.20 | Reliable judge; recommended for baseline runs |
| Gemini | varies | Cheaper but judge accuracy varies |

For Sub-arc A.2's full 25-case baseline run, expect $0.25-$1.00 with a paid provider.

## Files

| File | Purpose |
|---|---|
| `rubric.js` | The 5 scoring dimensions + definitions |
| `judgePrompt.js` | The meta-LLM judge system + user prompt builder |
| `goldenSet.js` | The hand-authored test cases (5 in A.1, 25 in A.2) |
| `evalRunner.js` | The browser-runnable harness |
| `README.md` | This file |
| `baseline.json` | (Created by user after running A.2) the captured snapshot of current chat quality |

## Authoring new cases (when you add to `goldenSet.js`)

Each case is plain JavaScript object:

```js
{
  id:                "DSC-2",                            // 3-letter category prefix + sequence
  category:          "discovery",                         // one of: discovery, app-how-to, data-grounding, refusal, multi-turn
  prompt:            "What questions should I ask...",    // the engineer's actual question
  engagementState:   "demo:northstar-health",             // loader key: "empty" or "demo:northstar-health"
  engagementHint:    "1-paragraph context the JUDGE sees", // not seen by the chat
  transcriptPrior:   [{ role: "user", content: "..." }],  // for multi-turn cases
  expected: [
    "Element 1 a great answer would include",
    "Element 2",
    "..."
  ],
  disallowed: [
    "Fabricated specifics the case rejects",
    "..."
  ]
}
```

**Principles**:

- **Real questions only** — author what a presales engineer would actually type, not synthetic prompts.
- **`expected` is rubric anchors, not a reference answer** — the chat can phrase things its own way; the judge looks for substantive coverage.
- **`disallowed` is a hard rejection list** — specific fabrications or wrong-tab suggestions that should never appear.
- **Engagement context matters** — if a case requires demo data, set `engagementState` so the chat sees the same state every run. Reproducibility depends on it.

## Versions

The harness records 4 versions in every result envelope (so future cross-version comparison is honest):

- `rubricVersion` — `rubric.js RUBRIC_VERSION`
- `judgePromptVersion` — `judgePrompt.js JUDGE_PROMPT_VERSION`
- `goldenSetVersion` — `goldenSet.js GOLDEN_SET_VERSION`
- `capturedAt` — ISO timestamp

If the rubric changes, the version bumps and old baselines become reference-only (not directly comparable).

## Roadmap (post-A.2)

| Sub-arc | What lands here |
|---|---|
| **B** | Two-persona system prompt + soft-warn verifier · re-run eval, compare to baseline |
| **B.5** | Doc inventory audit (do existing docs cover the chat's knowledge needs?) |
| **C** | Knowledge-base wiring (scoped from B.5 audit) · re-run eval |
| **D** | Action proposals + engineer-conditional approval · NEW eval dimension (action-correctness) |
