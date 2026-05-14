// tests/aiEvals/evalRunner.js
//
// SPEC §S48 (NEW · queued) · Browser-runnable AI evaluation harness.
// Loads each golden case from goldenSet.js, runs it through the LIVE
// Canvas AI Assist chat (services/chatService.js streamChat), then
// scores the answer via the meta-LLM judge (judgePrompt.js).
//
// INVOCATION:
//   - window.runCanvasAiEvals() from devtools console (any time)
//   - ?runEvals=1 URL param at page load (opt-in, like ?runTests=1)
//
// REAL-LLM ONLY (per feedback_no_mocks.md):
//   - Chat under test: uses the user's active provider (anthropic /
//     local / localB / gemini) from core/aiConfig.js. Whatever's
//     configured runs.
//   - Judge: uses the SAME active provider by default. Optional
//     window.runCanvasAiEvals({ judgeProviderKey: "anthropic" }) to
//     pin the judge model (e.g. always judge with Claude even when the
//     chat runs through local LLM).
//
// COST AWARENESS:
//   - Per case: 2 LLM calls (chat + judge). 5-case A.1 run ≈ 10 calls.
//   - 25-case A.2 run ≈ 50 calls. With Claude Sonnet 4.5 (~$0.005-
//     $0.02 per call), full run costs $0.25-$1.00. Local LLM = free.
//
// OUTPUT:
//   - Prints per-case scores + aggregate to console (structured groups)
//   - Renders results in a floating panel on the page (sortable table)
//   - Click "Download baseline.json" to save the aggregate as a file
//     the user can commit to tests/aiEvals/baseline.json
//
// PRINCIPLE: this harness is the MEASUREMENT BAR for Sub-arcs B/C/D.
// Every prompt-tuning commit should re-run the eval and compare scores
// against the captured baseline. Improvements are quantified; regressions
// are caught.

import { GOLDEN_SET, GOLDEN_SET_VERSION } from "./goldenSet.js";
import { RUBRIC_DIMENSIONS, RUBRIC_VERSION, RUBRIC_PASS_THRESHOLD, RUBRIC_TOTAL_MAX } from "./rubric.js";
import { buildJudgeMessages, JUDGE_PROMPT_VERSION } from "./judgePrompt.js";
// Sub-arc D (rc.10) · action-correctness harness imports per SPEC
// §S48.3 + RULES §16 CH38(g). The runner dispatches on
// { harness: "action-correctness" } to route to these modules
// instead of the chat-quality defaults above. Both harnesses share
// the per-case dispatch + judge-call + aggregation infrastructure
// below; only the golden set + rubric + judge prompt swap.
import { ACTION_GOLDEN_SET, ACTION_GOLDEN_SET_VERSION } from "./actionGoldenSet.js";
import { ACTION_RUBRIC_DIMENSIONS, ACTION_RUBRIC_VERSION, ACTION_RUBRIC_PASS_THRESHOLD, ACTION_RUBRIC_TOTAL_MAX } from "./actionRubric.js";
import { buildActionJudgeMessages, ACTION_JUDGE_PROMPT_VERSION } from "./actionJudgePrompt.js";

import { streamChat } from "../../services/chatService.js";
import { createRealChatProvider } from "../../services/realChatProvider.js";
import { chatCompletion } from "../../services/aiService.js";
import { loadAiConfig } from "../../core/aiConfig.js";

import { loadDemo } from "../../core/demoEngagement.js";
import { setActiveEngagement } from "../../state/engagementStore.js";
import { clearTranscript } from "../../state/chatMemory.js";

// ─── Public API ─────────────────────────────────────────────────────

// runCanvasAiEvals(opts) → Promise<{ results, aggregate }>
//   opts.judgeProviderKey? : override for the judge LLM (defaults to
//                            same active provider as the chat-under-test)
//   opts.onProgress?       : function({ index, total, caseId, phase }) for UI updates
//   opts.cases?            : array of golden cases (defaults vary by harness)
//   opts.harness?          : "chat-quality" (default · §S48.1) or
//                            "action-correctness" (Sub-arc D · §S48.2);
//                            selects which goldenSet + rubric + judgePrompt
//                            triplet drives the run · per §S48.3 dispatch
//                            convention + RULES §16 CH38(g).
//
// Returns: { results: [...per-case...], aggregate: {...stats...} }
export async function runCanvasAiEvals(opts) {
  opts = opts || {};
  // Sub-arc D (rc.10) · harness dispatch per SPEC §S48.3. Default to
  // chat-quality for backwards compatibility (rc.8 + rc.9 baseline
  // capture flow unchanged). action-correctness harness routes to
  // ACTION_GOLDEN_SET + ACTION_RUBRIC_* + buildActionJudgeMessages.
  const harness = opts.harness || "chat-quality";
  const isActionCorrectness = harness === "action-correctness";
  const defaultCases = isActionCorrectness ? ACTION_GOLDEN_SET : GOLDEN_SET;
  const cases = opts.cases || defaultCases;
  const onProgress = opts.onProgress || function() {};

  const aiCfg = loadAiConfig();
  const activeProviderKey = aiCfg.activeProvider || "anthropic";
  const judgeProviderKey  = opts.judgeProviderKey || activeProviderKey;

  console.log("[AI Evals] starting run · harness=" + harness +
              " · cases=" + cases.length +
              " · provider=" + activeProviderKey +
              " · judge=" + judgeProviderKey +
              " · rubric v" + (isActionCorrectness ? ACTION_RUBRIC_VERSION : RUBRIC_VERSION) +
              " · goldenSet v" + (isActionCorrectness ? ACTION_GOLDEN_SET_VERSION : GOLDEN_SET_VERSION));

  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    onProgress({ index: i, total: cases.length, caseId: c.id, phase: "starting" });
    try {
      const r = await runOneCase(c, aiCfg, activeProviderKey, judgeProviderKey, onProgress, i, cases.length, isActionCorrectness);
      results.push(r);
    } catch (err) {
      console.error("[AI Evals] case " + c.id + " threw:", err);
      results.push({
        caseId: c.id,
        category: c.category,
        prompt: c.prompt,
        error: (err && err.message) || String(err),
        scored: false
      });
    }
  }

  const aggregate = aggregateResults(results, {
    rubricVersion:       isActionCorrectness ? ACTION_RUBRIC_VERSION : RUBRIC_VERSION,
    judgePromptVersion:  isActionCorrectness ? ACTION_JUDGE_PROMPT_VERSION : JUDGE_PROMPT_VERSION,
    goldenSetVersion:    isActionCorrectness ? ACTION_GOLDEN_SET_VERSION : GOLDEN_SET_VERSION,
    chatProvider:        activeProviderKey,
    judgeProvider:       judgeProviderKey,
    capturedAt:          new Date().toISOString(),
    rubricPassThreshold: isActionCorrectness ? ACTION_RUBRIC_PASS_THRESHOLD : RUBRIC_PASS_THRESHOLD,
    rubricTotalMax:      isActionCorrectness ? ACTION_RUBRIC_TOTAL_MAX : RUBRIC_TOTAL_MAX,
    harness:             harness
  }, isActionCorrectness);

  printAggregate(aggregate, results);
  renderResultsPanel(aggregate, results);

  return { results, aggregate };
}

// Convenience: install as window.runCanvasAiEvals + check URL flag.
export function installEvalsRunner() {
  if (typeof window === "undefined") return;
  window.runCanvasAiEvals = runCanvasAiEvals;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("runEvals") === "1") {
      // Defer to next tick so the rest of app boot completes first.
      setTimeout(function() {
        runCanvasAiEvals().catch(function(e) {
          console.error("[AI Evals] auto-run failed:", e);
        });
      }, 500);
    }
  } catch (e) {
    // window.location may be inaccessible in some sandboxes; swallow.
  }
}

// ─── Per-case execution ─────────────────────────────────────────────

async function runOneCase(c, aiCfg, chatProviderKey, judgeProviderKey, onProgress, idx, total, isActionCorrectness) {
  const startMs = Date.now();

  // Step 1 · Load the engagement state the case wants.
  onProgress({ index: idx, total: total, caseId: c.id, phase: "loading-engagement" });
  const eng = await loadEngagementByKey(c.engagementState);
  setActiveEngagement(eng);
  clearTranscript(eng.engagementMeta && eng.engagementMeta.engagementId);

  // Step 2 · Build the chat provider from the active config.
  const chatProvider = buildProviderFromConfig(aiCfg, chatProviderKey);

  // Step 3 · Pre-seed transcript if multi-turn.
  const transcript = (c.transcriptPrior || []).slice();

  // Step 4 · Call streamChat with the case's prompt.
  // For action-correctness harness, we ALSO capture envelope.proposedActions[]
  // (Sub-arc D stub-emission · per SPEC §S20.4.1.3 + RULES §16 CH38(b)).
  onProgress({ index: idx, total: total, caseId: c.id, phase: "asking-chat" });
  const chatResult = await callChatAndCollect(chatProvider, aiCfg, chatProviderKey, eng, transcript, c.prompt);
  const chatAnswer = chatResult.text;
  const proposedActions = chatResult.proposedActions || [];

  // Step 5 · Build judge messages + call the judge LLM.
  // Action-correctness mode: use buildActionJudgeMessages with the
  // emitted proposedActions[] as the input being scored (chat-quality
  // mode scores the chat TEXT; action-correctness scores the PROPOSALS).
  onProgress({ index: idx, total: total, caseId: c.id, phase: "judging" });
  const judgeProvider = buildProviderFromConfig(aiCfg, judgeProviderKey);
  const judgeRaw = isActionCorrectness
    ? await callActionJudge(judgeProvider, aiCfg, judgeProviderKey, c, proposedActions)
    : await callJudge(judgeProvider, aiCfg, judgeProviderKey, c, chatAnswer);

  // Step 6 · Parse judge JSON output.
  const parsed = parseJudgeOutput(judgeRaw, c.id, isActionCorrectness);

  const durationMs = Date.now() - startMs;
  onProgress({ index: idx, total: total, caseId: c.id, phase: "done", scoreTotal: parsed.total, durationMs });

  return {
    caseId:          c.id,
    category:        c.category,
    prompt:          c.prompt,
    chatAnswer:      chatAnswer,
    proposedActions: proposedActions, // NEW · Sub-arc D · empty array on chat-quality runs (chatService always emits the field)
    judgeRaw:        judgeRaw,
    judgeParsed:     parsed,
    durationMs:      durationMs,
    scored:          parsed.total != null
  };
}

// ─── Engagement loaders ─────────────────────────────────────────────

async function loadEngagementByKey(key) {
  if (key === "empty") {
    const schema = await import("../../schema/engagement.js");
    return schema.createEmptyEngagement();
  }
  if (key === "demo:northstar-health" || key === "demo:default") {
    // The canonical v3 demo engagement is loaded via core/demoEngagement.js
    // loadDemo() · customer "Northstar Health Network" by default.
    return loadDemo();
  }
  if (key && key.indexOf("fixture:") === 0) {
    throw new Error("loadEngagementByKey: fixture loader not implemented yet (key=" + key + "). Use 'empty' or 'demo:northstar-health' for now.");
  }
  throw new Error("loadEngagementByKey: unknown engagementState key '" + key + "'. Supported: 'empty', 'demo:northstar-health'.");
}

// ─── Provider construction ──────────────────────────────────────────

function buildProviderFromConfig(aiCfg, providerKey) {
  const p = (aiCfg && aiCfg.providers && aiCfg.providers[providerKey]) || {};
  return createRealChatProvider({
    providerKey:    providerKey,
    baseUrl:        p.baseUrl,
    model:          p.model,
    fallbackModels: p.fallbackModels,
    apiKey:         p.apiKey,
    stream:         providerKey === "anthropic" ? true : false  // SSE only Anthropic per rc.2
  });
}

// ─── Chat invocation + answer collection ────────────────────────────

async function callChatAndCollect(provider, aiCfg, providerKey, engagement, transcript, userMessage) {
  return new Promise(function(resolve, reject) {
    let accumulated = "";
    streamChat({
      engagement:     engagement,
      transcript:     transcript,
      userMessage:    userMessage,
      providerConfig: { providerKey: providerKey },
      provider:       provider,
      onToken: function(t) { accumulated += t || ""; },
      onComplete: function(envelope) {
        // chatService.streamChat invokes onComplete with the canonical
        // envelope (chatService.js line 319, extended Sub-arc D rc.10):
        //   { response, provenance, contractAck, groundingViolations,
        //     proposedActions }
        //
        // BUG fix 2026-05-13 (caught by user post-baseline-capture):
        //   Previous code read `envelope.content` (undefined). Fallback
        //   to `accumulated` (raw stream tokens) silently bypassed:
        //     - handshake strip (per SPEC §S20.16 + chatHandshake.js)
        //     - UUID scrub (anti-leakage rule 3a)
        //     - groundingVerifier annotation (Sub-arc B SOFT-WARN)
        //   Result: baseline captured raw [contract-ack ...] prefixes
        //   inconsistently (depending on LLM non-determinism) which
        //   inflated "concise" failure rate + erased Sub-arc B
        //   annotation visibility in the eval.
        //
        // Fix: read envelope.response (canonical field, post-scrub).
        // .content kept as defensive fallback for forward-compat.
        //
        // Sub-arc D (rc.10) extension: ALSO capture
        // envelope.proposedActions[] for action-correctness harness.
        // chat-quality runs see an empty array (chatService always
        // emits the field) and ignore it in callJudge.
        const visible = (envelope && (envelope.response || envelope.content)) || accumulated;
        const proposedActions = (envelope && Array.isArray(envelope.proposedActions))
          ? envelope.proposedActions
          : [];
        resolve({ text: visible, proposedActions: proposedActions });
      }
    }).catch(reject);
  });
}

// ─── Judge invocation ───────────────────────────────────────────────

async function callJudge(provider, aiCfg, providerKey, goldenCase, actualAnswer) {
  const msgs = buildJudgeMessages(goldenCase, actualAnswer, providerKey);
  const p = aiCfg.providers[providerKey] || {};
  const out = await chatCompletion({
    providerKey:    providerKey,
    baseUrl:        p.baseUrl,
    model:          p.model,
    fallbackModels: p.fallbackModels,
    apiKey:         p.apiKey,
    messages: [
      { role: "system", content: msgs.system },
      { role: "user",   content: msgs.user   }
    ]
  });
  // aiService.chatCompletion returns { text, raw, modelUsed, attempts }.
  // BUG fix 2026-05-13: was reading .content (undefined) which made every
  // judge call return "" and produce parse-error verdicts. The chat call
  // itself uses streamChat (different code path); only the judge bug-out.
  return (out && (out.text || out.content)) || "";
}

// Sub-arc D (rc.10) · action-correctness judge call.
// Mirror of callJudge but uses buildActionJudgeMessages (which scores
// PROPOSALS against the §S48.2 5-dim action-correctness rubric) instead
// of buildJudgeMessages (which scores CHAT TEXT against the §S48.1 5-dim
// chat-quality rubric). Same underlying chatCompletion call shape;
// different prompt builder.
async function callActionJudge(provider, aiCfg, providerKey, goldenCase, emittedProposals) {
  const msgs = buildActionJudgeMessages(goldenCase, emittedProposals, providerKey);
  const p = aiCfg.providers[providerKey] || {};
  const out = await chatCompletion({
    providerKey:    providerKey,
    baseUrl:        p.baseUrl,
    model:          p.model,
    fallbackModels: p.fallbackModels,
    apiKey:         p.apiKey,
    messages: [
      { role: "system", content: msgs.system },
      { role: "user",   content: msgs.user   }
    ]
  });
  return (out && (out.text || out.content)) || "";
}

function parseJudgeOutput(raw, caseId, isActionCorrectness) {
  const text = String(raw || "").trim();
  // Strip code fences if the judge wrapped JSON in ```json ... ```
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // Sub-arc D (rc.10): action-correctness judge returns `dimensions`
  // (per actionJudgePrompt.js schema); chat-quality judge returns
  // `scores` (per judgePrompt.js schema). Normalize to `scores` field
  // on the parsed result so downstream aggregation works uniformly.
  // The active rubric is chosen by isActionCorrectness for total
  // computation + pass threshold.
  const dims = isActionCorrectness ? ACTION_RUBRIC_DIMENSIONS : RUBRIC_DIMENSIONS;
  const passThreshold = isActionCorrectness ? ACTION_RUBRIC_PASS_THRESHOLD : RUBRIC_PASS_THRESHOLD;
  try {
    const obj = JSON.parse(stripped);
    // Action-judge emits `dimensions` field; chat-quality judge emits `scores`.
    // Try both, prefer the harness-matching shape.
    const scores = isActionCorrectness
      ? (obj.dimensions || obj.scores || {})
      : (obj.scores || obj.dimensions || {});
    return {
      caseId:   obj.caseId || caseId,
      scores:   scores,
      total:    typeof obj.total === "number" ? obj.total : computeTotalForDims(scores, dims),
      pass:     typeof obj.pass === "boolean" ? obj.pass : (computeTotalForDims(scores, dims) >= passThreshold),
      comments: obj.comments || {},
      verdict:  obj.verdict || "",
      raw:      text
    };
  } catch (e) {
    return {
      caseId:   caseId,
      scores:   {},
      total:    null,
      pass:     false,
      comments: {},
      verdict:  "[parse-error] judge did not return parseable JSON: " + (e && e.message),
      raw:      text
    };
  }
}

// Sub-arc D · dim-set-aware total computation. The old computeTotal
// hardcoded RUBRIC_DIMENSIONS (chat-quality dims). For action-correctness
// runs we pass ACTION_RUBRIC_DIMENSIONS. computeTotal kept as a thin
// alias for backwards compatibility.
function computeTotalForDims(scores, dims) {
  if (!scores || typeof scores !== "object") return null;
  let t = 0;
  (dims || RUBRIC_DIMENSIONS).forEach(function(d) {
    if (typeof scores[d.id] === "number") t += scores[d.id];
  });
  return t;
}

function computeTotal(scores) {
  if (!scores || typeof scores !== "object") return null;
  let t = 0;
  RUBRIC_DIMENSIONS.forEach(function(d) {
    if (typeof scores[d.id] === "number") t += scores[d.id];
  });
  return t;
}

// ─── Aggregation + display ──────────────────────────────────────────

function aggregateResults(results, meta, isActionCorrectness) {
  const totalCases = results.length;
  const scoredOk   = results.filter(r => r.scored && r.judgeParsed && typeof r.judgeParsed.total === "number");
  const passed     = scoredOk.filter(r => r.judgeParsed.pass);
  const failed     = scoredOk.filter(r => !r.judgeParsed.pass);
  const errors     = results.filter(r => !r.scored);

  const sumTotal = scoredOk.reduce((s, r) => s + r.judgeParsed.total, 0);
  const avgTotal = scoredOk.length ? +(sumTotal / scoredOk.length).toFixed(2) : null;

  // Per-dimension average · Sub-arc D · iterate over the active rubric
  // dimensions (chat-quality vs action-correctness). The dim ids are
  // disjoint so cross-rubric mixing is impossible.
  const activeDims = isActionCorrectness ? ACTION_RUBRIC_DIMENSIONS : RUBRIC_DIMENSIONS;
  const dims = {};
  activeDims.forEach(d => {
    const scores = scoredOk.map(r => r.judgeParsed.scores[d.id]).filter(x => typeof x === "number");
    dims[d.id] = scores.length ? +(scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(2) : null;
  });

  // Per-category average
  const catGroups = {};
  scoredOk.forEach(r => {
    catGroups[r.category] = catGroups[r.category] || [];
    catGroups[r.category].push(r.judgeParsed.total);
  });
  const perCategory = {};
  Object.keys(catGroups).forEach(cat => {
    const arr = catGroups[cat];
    perCategory[cat] = +(arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(2);
  });

  return {
    meta:           meta,
    totalCases:     totalCases,
    scored:         scoredOk.length,
    errors:         errors.length,
    passed:         passed.length,
    failed:         failed.length,
    avgTotalScore:  avgTotal,
    perDimension:   dims,
    perCategory:    perCategory,
    passRate:       scoredOk.length ? +((passed.length / scoredOk.length) * 100).toFixed(1) : null
  };
}

function printAggregate(agg, results) {
  // Sub-arc D · Pull pass threshold + total max from agg.meta so the
  // print is harness-aware (chat-quality vs action-correctness · though
  // currently both use 7/10).
  const passThreshold = (agg.meta && agg.meta.rubricPassThreshold) || RUBRIC_PASS_THRESHOLD;
  const totalMax = (agg.meta && agg.meta.rubricTotalMax) || RUBRIC_TOTAL_MAX;
  const harnessLabel = (agg.meta && agg.meta.harness) || "chat-quality";
  console.group("[AI Evals] Results summary · harness=" + harnessLabel);
  console.log("Total cases:    ", agg.totalCases);
  console.log("Scored:         ", agg.scored, "(errors:", agg.errors + ")");
  console.log("Passed (≥" + passThreshold + "/" + totalMax + "):", agg.passed, "/", agg.scored, "(" + agg.passRate + "%)");
  console.log("Avg score:      ", agg.avgTotalScore, "/", totalMax);
  console.log("Per-dimension:  ", agg.perDimension);
  console.log("Per-category:   ", agg.perCategory);
  console.groupEnd();

  console.group("[AI Evals] Per-case detail");
  results.forEach(r => {
    if (r.scored) {
      const p = r.judgeParsed;
      console.log("[" + r.caseId + "] " + r.category + " · " + p.total + "/" + RUBRIC_TOTAL_MAX + (p.pass ? " ✅" : " ❌") + " · " + p.verdict);
    } else {
      console.log("[" + r.caseId + "] " + r.category + " · ERROR: " + r.error);
    }
  });
  console.groupEnd();
}

function renderResultsPanel(agg, results) {
  if (typeof document === "undefined") return;
  // Remove any prior panel
  const prior = document.getElementById("ai-evals-results-panel");
  if (prior) prior.remove();

  const panel = document.createElement("div");
  panel.id = "ai-evals-results-panel";
  panel.style.cssText = "position:fixed;right:24px;bottom:24px;z-index:99999;background:#0B2A4A;color:#fff;border-radius:8px;padding:16px;max-width:520px;max-height:70vh;overflow-y:auto;font-family:Inter,system-ui,sans-serif;font-size:13px;box-shadow:0 4px 24px rgba(0,0,0,0.4);";

  const head = document.createElement("div");
  head.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;";
  head.innerHTML = "<strong style='font-size:14px'>[AI Evals] " + agg.passed + "/" + agg.scored + " passed · avg " + agg.avgTotalScore + "/" + RUBRIC_TOTAL_MAX + "</strong>";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = "background:transparent;color:#fff;border:0;font-size:18px;cursor:pointer;padding:0 4px";
  closeBtn.onclick = function() { panel.remove(); };
  head.appendChild(closeBtn);
  panel.appendChild(head);

  const summary = document.createElement("div");
  summary.style.cssText = "margin-bottom:12px;line-height:1.5;";
  summary.innerHTML =
    "<div>Provider: " + agg.meta.chatProvider + " · Judge: " + agg.meta.judgeProvider + "</div>" +
    "<div>Per-dim: " + Object.keys(agg.perDimension).map(k => k + "=" + agg.perDimension[k]).join(" · ") + "</div>" +
    "<div>Per-cat: " + Object.keys(agg.perCategory).map(k => k + "=" + agg.perCategory[k]).join(" · ") + "</div>";
  panel.appendChild(summary);

  const list = document.createElement("ul");
  list.style.cssText = "list-style:none;padding:0;margin:0 0 12px 0;";
  results.forEach(r => {
    const li = document.createElement("li");
    li.style.cssText = "padding:6px 0;border-top:1px solid rgba(255,255,255,0.15);";
    if (r.scored) {
      const p = r.judgeParsed;
      const badge = p.pass ? "✅" : "❌";
      li.innerHTML = "<strong>[" + r.caseId + "] " + badge + " " + p.total + "/" + RUBRIC_TOTAL_MAX + "</strong> · " +
                     "<em style='opacity:0.7'>" + r.category + "</em><br>" +
                     "<span style='opacity:0.85'>" + escapeHtml(p.verdict || "") + "</span>";
    } else {
      li.innerHTML = "<strong>[" + r.caseId + "] ❌ ERROR</strong><br><span style='opacity:0.85'>" + escapeHtml(r.error || "") + "</span>";
    }
    list.appendChild(li);
  });
  panel.appendChild(list);

  // Sub-arc D (rc.10) · download-button label + filename are harness-
  // aware so action-correctness baselines do not visually conflate with
  // chat-quality baselines in the user's Downloads folder. Per SPEC
  // §S48.2 baseline file convention: chat-quality canonical at
  // `tests/aiEvals/baseline.json` + timestamped historical; action-
  // correctness canonical at `tests/aiEvals/baseline-action.json` +
  // timestamped historical with `baseline-action-` prefix.
  const harnessLabel = (agg.meta && agg.meta.harness) || "chat-quality";
  const isAction = harnessLabel === "action-correctness";
  const baselineFilename = isAction ? "baseline-action.json" : "baseline.json";
  const dlBtn = document.createElement("button");
  dlBtn.textContent = "📥 Download " + baselineFilename;
  dlBtn.style.cssText = "background:#0078D4;color:#fff;border:0;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;";
  dlBtn.onclick = function() { downloadBaseline(agg, results, isAction); };
  panel.appendChild(dlBtn);

  document.body.appendChild(panel);
}

function downloadBaseline(agg, results, isAction) {
  const payload = { aggregate: agg, results: results };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  // Sub-arc D · prefix action-correctness baselines with `baseline-action-`
  // so the timestamped historical naming does not collide with chat-
  // quality `baseline-*` files in the user's Downloads folder. The
  // canonical (non-timestamped) commit-time rename convention is per
  // SPEC §S48.2 + tests/aiEvals/baseline.json.HOWTO.md.
  const prefix = isAction ? "baseline-action-" : "baseline-";
  a.download = prefix + (new Date()).toISOString().replace(/[:.]/g, "-") + ".json";
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
