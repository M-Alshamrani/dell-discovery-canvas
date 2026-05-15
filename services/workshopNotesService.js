// services/workshopNotesService.js — v3.0 · Sub-arc D Step 4 (A20 widening)
//
// Workshop-mode LLM wrapper for the Mode 1 Workshop Notes overlay.
//
// AUTHORITY: SPEC §S20.4.1.5 (Workshop Notes overlay → Path B importer
// flow · primary Sub-arc D UX path) + framing-doc A19 (the pivot) + A20
// (widening). The Mode 1 user-direction "Path Y" was selected at the
// pre-impl Q&A 2026-05-15: this module wraps services/aiService.js
// chatCompletion directly with a workshop-mode prompt; it does NOT call
// services/chatService.js streamChat (which is Mode 2's path · the chat
// overlay). Keeping the two paths separate is intentional · workshop
// notes are batched + structured · chat is conversational + grounded ·
// the two LLM-invocation styles are different and bundling them in one
// pipeline would force compromise on both.
//
// SCOPE (Step 4 impl):
//   - pushNotesToAi(opts) → { processedMarkdown, mappings, runId, mutatedAt, modelUsed }
//   - Builds a workshop-mode system prompt that instructs the LLM to:
//       (a) group raw bullets under canonical headings (per framing-doc A2):
//           ## Customer concerns
//           ## Drivers identified
//           ## Current state captured
//           ## Desired state directions
//           ## Gaps proposed
//           ## Action items / follow-ups
//       (b) emit ActionProposal-shaped mappings (per schema/actionProposal.js
//           v1 4-kind enum) for each canvas-mappable bullet
//       (c) attach HIGH/MEDIUM/LOW confidence + rationale to each mapping
//   - Validates each emitted mapping via ActionProposalSchema.safeParse
//     (single source of truth; no parallel schema definitions per Q3
//     framing-doc A20 lock)
//   - Drops invalid mappings with console.warn (chatService.js Zod-
//     validation pattern · imports stay strict-shape)
//   - Supports "delta" mode (only new bullets re-processed · upper pane
//     APPENDS) and "full" mode ([Re-evaluate all] · upper pane regenerates)
//
// NO MOCKS · NO SCRIPTED LLM · NO STUBBED FETCH (per feedback_no_mocks.md
// LOCKED 2026-05-05). Real-LLM only via the active provider configured
// in core/aiConfig.js · the same provider that powers chat + skills.
//
// Cross-references:
//   - schema/actionProposal.js · canonical ActionProposalSchema + 4-kind enum
//   - services/aiService.js · chatCompletion (the underlying provider call)
//   - core/aiConfig.js · loadAiConfig (active provider resolution)
//   - SPEC §S20.4.1.5 · the post-A19 primary Sub-arc D UX path
//   - framing-doc A19 (pivot) + A20 (widening)

import { loadAiConfig } from "../core/aiConfig.js";
import { chatCompletion } from "./aiService.js";
import { ActionProposalSchema } from "../schema/actionProposal.js";

// Build a compact engagement snapshot for the LLM. Workshop notes are
// brief by design; we don't need the full Layer 4 selector pipeline ·
// just enough context to anchor mappings against existing entities.
function buildEngagementContext(engagement) {
  if (!engagement) return "(no engagement loaded)";
  const lines = [];
  const customer = engagement.customer || {};
  const customerName = (customer.name || "").trim() || "(customer name not set)";
  const vertical = (customer.verticalLabel || customer.vertical || "").trim() || "(vertical not set)";
  lines.push("Customer: " + customerName + " · Vertical: " + vertical);

  const envs = engagement.environments && Array.isArray(engagement.environments.allIds)
    ? engagement.environments.allIds.map(id => engagement.environments.byId[id]).filter(Boolean)
    : [];
  lines.push("Environments (" + envs.length + "):");
  envs.forEach(e => {
    if (e && !e.hidden) {
      lines.push("  - " + (e.label || "(no label)") + " · uuid=" + (e.id || "?") + " · catalogId=" + (e.envCatalogId || "?"));
    }
  });

  const drivers = engagement.drivers && Array.isArray(engagement.drivers.allIds)
    ? engagement.drivers.allIds.map(id => engagement.drivers.byId[id]).filter(Boolean)
    : [];
  if (drivers.length > 0) {
    lines.push("Existing drivers (" + drivers.length + "):");
    drivers.forEach(d => {
      lines.push("  - " + (d.businessDriverId || "?") + " · priority=" + (d.priority || "?"));
    });
  }

  const gaps = engagement.gaps && Array.isArray(engagement.gaps.allIds)
    ? engagement.gaps.allIds.map(id => engagement.gaps.byId[id]).filter(Boolean)
    : [];
  if (gaps.length > 0) {
    lines.push("Existing gaps (" + gaps.length + "):");
    gaps.slice(0, 20).forEach(g => {
      lines.push("  - " + (g.id || "?") + " · " + (g.description || "(no description)").slice(0, 80));
    });
    if (gaps.length > 20) lines.push("  - … + " + (gaps.length - 20) + " more (truncated)");
  }

  return lines.join("\n");
}

// Workshop-mode system prompt. Distinct from the chat layer's Rule
// 1..N system prompt (services/systemPromptAssembler.js). Workshop
// mode is batched + structured-output; chat mode is conversational +
// tool-using.
function buildWorkshopSystemPrompt(engagementContext) {
  return [
    "You are Dell Discovery Canvas's Workshop Notes Assistant.",
    "",
    "The presales engineer is in a live customer workshop and is typing rough bullets",
    "describing what the customer is saying. Your job: structure those bullets into a",
    "discovery-notes document AND emit canvas-mappable proposals as a JSON payload.",
    "",
    "OUTPUT FORMAT (strict JSON · no markdown fences · no prose preamble · no commentary outside the JSON):",
    "{",
    '  "processedMarkdown": "## Customer concerns\\n- ...\\n\\n## Drivers identified\\n- ...\\n...",',
    '  "mappings": [',
    "    {",
    '      "kind": "add-driver" | "add-instance-current" | "add-instance-desired" | "close-gap",',
    '      "payload": { ...kind-specific shape... },',
    '      "confidence": "HIGH" | "MEDIUM" | "LOW",',
    '      "rationale": "1-2 sentence reason citing the engineer bullet"',
    "    }",
    "    , ...",
    "  ]",
    "}",
    "",
    "CANONICAL HEADINGS for processedMarkdown (use exactly these section names; omit empty sections):",
    "  ## Customer concerns",
    "  ## Drivers identified",
    "  ## Current state captured",
    "  ## Desired state directions",
    "  ## Gaps proposed",
    "  ## Action items / follow-ups",
    "",
    "MAPPING PAYLOAD SHAPES per kind:",
    "  add-driver           · payload: {businessDriverId, priority?, outcomes?}",
    "                         businessDriverId is from a fixed catalog — emit your best-guess id (camelCase, e.g. 'cybersecurity', 'regulatory', 'businessAgility', 'costOptimization', 'modernization', 'dataValue', 'operationalEfficiency'). The importer validates against the live catalog.",
    "                         priority: 'High' | 'Medium' | 'Low'.",
    "                         outcomes: free-text summary of what the customer wants out of this driver.",
    "  add-instance-current · payload: {layerId, environmentId, label, vendor?, vendorGroup?, criticality?}",
    "                         layerId is one of: compute, network, storage, dataProtection, workload.",
    "                         environmentId is the UUID of an existing env (cite the engagement context above).",
    "                         vendorGroup: 'dell' | 'nonDell' | 'custom'.",
    "                         criticality: 'High' | 'Medium' | 'Low'.",
    "  add-instance-desired · payload: {layerId, environmentId, label, disposition?, originId?, vendor?, vendorGroup?}",
    "                         disposition: keep | enhance | replace | consolidate | retire | introduce.",
    "                         originId: UUID of existing current-state instance this replaces (if any).",
    "  close-gap            · payload: {gapId, status: 'closed', closeReason}",
    "                         gapId is the UUID of an existing gap (cite the engagement context above).",
    "                         status is the literal string 'closed'.",
    "                         closeReason: 1-2 sentence customer-confirmed reason for closure.",
    "",
    "RULES:",
    "  - Emit a mapping ONLY when the engineer's bullet is structurally clear and maps to one of the 4 v1 kinds.",
    "  - Cite the existing engagement context (envs, drivers, gaps) when emitting add-instance-* or close-gap mappings.",
    "  - Use HIGH confidence only when the bullet unambiguously names the action + entity. MEDIUM when interpretation is reasonable but a human should review. LOW when speculative.",
    "  - Do NOT emit mappings for engagement-meta details (customer name, vertical, environments) — those are managed on Tab 1 directly by the engineer.",
    "  - Do NOT invent gapIds or environmentIds that aren't in the engagement context. If you want to propose a NEW gap, describe it in the markdown under '## Gaps proposed' without an ActionProposal (Path B add-gap is out of v1 scope per SPEC §S47.2).",
    "  - Keep processedMarkdown TIGHT — engineer-readable bullets, no padding.",
    "",
    "ENGAGEMENT CONTEXT (live snapshot · cite UUIDs verbatim when referencing):",
    engagementContext
  ].join("\n");
}

// Build the user prompt for delta or full mode. In delta mode the LLM
// sees only the new bullets but is told the previousProcessed exists
// (so it doesn't duplicate sections). In full mode it sees ALL bullets
// and is told to regenerate.
function buildUserPrompt({ bullets, previousProcessed, mode }) {
  const lines = [];
  if (mode === "full") {
    lines.push("Mode: [Re-evaluate all] · regenerate the full processedMarkdown + complete mappings list from these bullets.");
    lines.push("");
    lines.push("ALL BULLETS:");
    bullets.forEach((b, i) => lines.push((i + 1) + ". " + b));
  } else {
    lines.push("Mode: [Push notes to AI] · DELTA-only — process only the NEW bullets below.");
    if (previousProcessed && previousProcessed.trim().length > 0) {
      lines.push("");
      lines.push("PREVIOUSLY STRUCTURED (for context · do not duplicate · APPEND new content):");
      lines.push(previousProcessed.trim());
    }
    lines.push("");
    lines.push("NEW BULLETS:");
    bullets.forEach((b, i) => lines.push((i + 1) + ". " + b));
  }
  return lines.join("\n");
}

// Parse the LLM's strict-JSON response. Tolerant of leading/trailing
// whitespace + accidental markdown code fences (some providers wrap
// JSON in ```json blocks despite the "no fences" instruction).
function parseLlmResponse(text) {
  if (typeof text !== "string") return { ok: false, error: "Empty LLM response" };
  let body = text.trim();
  // Strip markdown code fences if present.
  if (body.startsWith("```")) {
    body = body.replace(/^```(?:json|javascript|js)?\s*/i, "");
    body = body.replace(/```\s*$/, "");
    body = body.trim();
  }
  let parsed;
  try { parsed = JSON.parse(body); }
  catch (e) {
    return { ok: false, error: "JSON parse failed: " + (e.message || String(e)) + " · raw response head: " + body.slice(0, 200) };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Parsed JSON is not an object" };
  }
  const processedMarkdown = typeof parsed.processedMarkdown === "string" ? parsed.processedMarkdown : "";
  const rawMappings = Array.isArray(parsed.mappings) ? parsed.mappings : [];
  return { ok: true, processedMarkdown, rawMappings };
}

// pushNotesToAi · main exported entry point.
//
//   opts.engagement          · v3 engagement object (the live state)
//   opts.bullets             · string[] of raw bullet text (delta: only new · full: all)
//   opts.previousProcessed   · string · last upper-pane content (delta mode context)
//   opts.mode                · "delta" | "full"
//   opts.providerOverride    · optional · use a specific provider key (defaults to active)
//   opts.fetchImpl           · optional · test override
//   opts.waitImpl            · optional · test override
//
// Returns:
//   { ok: true,  processedMarkdown, mappings, runId, mutatedAt, modelUsed, providerKey, droppedCount }
//   { ok: false, error, providerKey }
export async function pushNotesToAi(opts) {
  opts = opts || {};
  const engagement = opts.engagement;
  const bullets = Array.isArray(opts.bullets) ? opts.bullets.filter(b => typeof b === "string" && b.trim().length > 0) : [];
  const previousProcessed = typeof opts.previousProcessed === "string" ? opts.previousProcessed : "";
  const mode = opts.mode === "full" ? "full" : "delta";

  if (bullets.length === 0) {
    return { ok: false, error: "No bullets to process" };
  }

  const config = loadAiConfig();
  const providerKey = opts.providerOverride || config.activeProvider;
  const active = config.providers && config.providers[providerKey];
  if (!active || !active.baseUrl) {
    return { ok: false, error: "No active provider configured · set up a provider in Settings before pushing notes to AI", providerKey };
  }

  const runId = "wn-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const mutatedAt = new Date().toISOString();

  const systemPrompt = buildWorkshopSystemPrompt(buildEngagementContext(engagement));
  const userPrompt = buildUserPrompt({ bullets, previousProcessed, mode });

  let res;
  try {
    res = await chatCompletion({
      providerKey:    providerKey,
      baseUrl:        active.baseUrl,
      model:          active.model,
      fallbackModels: Array.isArray(active.fallbackModels) ? active.fallbackModels : [],
      apiKey:         active.apiKey,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt }
      ],
      fetchImpl: opts.fetchImpl,
      waitImpl:  opts.waitImpl
    });
  } catch (e) {
    return { ok: false, error: "LLM call failed: " + (e.message || String(e)), providerKey };
  }

  const parsed = parseLlmResponse(res.text || "");
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, providerKey, modelUsed: res.modelUsed };
  }

  // Validate each raw mapping via ActionProposalSchema · drop invalid
  // entries with console.warn (same pattern as chatService.streamChat
  // tool-use validation loop · no silent acceptance · no parallel-shape
  // tolerance per A20 Q3 anti-pattern lock).
  const mappings = [];
  let droppedCount = 0;
  for (let i = 0; i < parsed.rawMappings.length; i++) {
    const raw = parsed.rawMappings[i];
    // Inject required shared fields if the LLM omitted them.
    const enriched = Object.assign({}, raw, {
      source: "discovery-note"  // Mode 1 overlay path · per schema/actionProposal.js ACTION_SOURCES
    });
    const result = ActionProposalSchema.safeParse(enriched);
    if (result.success) {
      mappings.push(result.data);
    } else {
      droppedCount++;
      console.warn("[workshopNotesService] dropped invalid mapping at index " + i + ": " +
        (result.error && result.error.message ? result.error.message : "(no error message)") +
        " · raw=" + JSON.stringify(raw).slice(0, 200));
    }
  }

  return {
    ok: true,
    processedMarkdown: parsed.processedMarkdown,
    mappings:          mappings,
    runId:             runId,
    mutatedAt:         mutatedAt,
    modelUsed:         res.modelUsed,
    providerKey:       providerKey,
    droppedCount:      droppedCount
  };
}
