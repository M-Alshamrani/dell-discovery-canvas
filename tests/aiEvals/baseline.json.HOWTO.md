# How to capture `baseline.json`

The eval harness is in place (`rubric.js` + `judgePrompt.js` + `goldenSet.js` (25 cases) + `evalRunner.js`). The **baseline** is the measurement bar — a captured snapshot of the CURRENT Canvas AI Assist chat's scores against the golden set, taken BEFORE any Sub-arc B/C/D improvements.

Capturing the baseline requires real LLM calls (per `feedback_no_mocks.md`) and so it has to be **you running the harness on your machine** with your LLM provider keys configured.

## Steps to capture

1. **Open Canvas** with the test runner already opt-in:
   ```
   http://localhost:8080/?runTests=1
   ```
   Wait for the test banner to confirm `1289/1289 GREEN` (or higher).

2. **Confirm your active provider is configured.** Click the ⚙ gear in the topbar → Settings → AI providers. Make sure at least one provider (anthropic / local / localB / gemini / dellSalesChat) has a working endpoint + model + (where needed) API key. Save settings.

3. **Run the evals** from the devtools console:
   ```js
   window.runCanvasAiEvals()
   ```
   This kicks off the full 25-case run against the LIVE chat with your active provider.

   **Or** pin the judge to a specific model (recommended: a strong model like Claude Sonnet so judging is consistent across reruns):
   ```js
   window.runCanvasAiEvals({ judgeProviderKey: "anthropic" })
   ```

4. **Wait for completion.** Per case ≈ 30-90 seconds wallclock (chat call + judge call). Full 25-case run ≈ 12-40 minutes depending on provider speed + tool-use rounds + token volume. The console will log progress (per-case verdicts as they land).

5. **Inspect the floating results panel** (bottom-right) when the run finishes. You'll see:
   - Pass rate (e.g. `18/25 passed (72%)`)
   - Avg score (e.g. `7.4/10`)
   - Per-dimension averages (which dimensions are weak? `grounded=1.9 · useful=1.4` tells you to tune for usefulness)
   - Per-category averages (`discovery=8.0 · refusal=9.0 · multi-turn=5.5` tells you multi-turn needs work)
   - Per-case details with each case's verdict

6. **Click "📥 Download baseline.json"** in the panel. The browser downloads `baseline-<timestamp>.json`.

7. **Rename + commit**:
   ```bash
   mv ~/Downloads/baseline-2026-05-13T22-30-00-000Z.json \
      C:/Users/Mahmo/Projects/dell-discovery/tests/aiEvals/baseline.json
   ```
   Then in Canvas's working tree:
   ```bash
   git add tests/aiEvals/baseline.json
   git commit -m "feat . Sub-arc A.3 . baseline.json captured against current Canvas AI Assist (provider=<X>, judge=<Y>) . pass rate=N%, avg=N.N/10"
   ```

## After committing the baseline

The baseline is the **starting line for every Sub-arc B/C/D commit**.

- After every prompt-tuning commit, re-run `window.runCanvasAiEvals()` and capture a new run snapshot.
- Compare new aggregate to `baseline.json`:
  - Did pass rate go up? (good)
  - Did avg score go up? (good)
  - Did any dimension regress? (bad — investigate before merging)
  - Did any category regress? (bad — investigate)
- Commit the new snapshot alongside the prompt change for a measurable trail of improvement.

## Cost rough estimate (25-case full run)

| Judge model | Approx cost per full run |
|---|---|
| Local LLM (proxy) | $0.00 |
| Claude Sonnet 4.5 (Anthropic) | $0.50-$2.00 |
| GPT-4-class (via openai-compat) | $0.40-$1.50 |
| Gemini 2.5 Flash | $0.05-$0.30 |

Cheap enough to run after every meaningful change. The point of the baseline is that you SEE quality trends, not guess.

## Subset runs (for fast iteration)

If you don't want to run all 25 cases each time during dev iteration, run a subset:

```js
import { GOLDEN_SET } from "/tests/aiEvals/goldenSet.js"
window.runCanvasAiEvals({ cases: GOLDEN_SET.filter(c => c.category === "discovery") })
```

That runs only the 6 discovery cases. Useful when you're focused on tuning the discovery-coach persona.

## Don't commit individual run snapshots

Each `baseline-<timestamp>.json` should be ephemeral on your machine. Only commit `baseline.json` (the official measurement bar) and the post-tuning comparison snapshots when they're meaningful (e.g. `baseline-post-sub-arc-B.json`).
