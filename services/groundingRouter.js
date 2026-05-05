// services/groundingRouter.js
//
// SPEC §S37.3.1 + RULES §16 CH33 · Deterministic retrieval router for
// the chat grounding contract. Maps {userMessage, transcript, engagement}
// → list of selector calls to invoke server-side BEFORE the LLM sees
// the message; selector results are then inlined into Layer 4 of the
// system prompt by services/systemPromptAssembler.js.
//
// The router NEVER calls an LLM. It is pure + deterministic + cheap.
// Heuristic intent classification: regex/keyword + phrase-pattern table
// + verb-object cues. Multiple intents may match a single message;
// selector calls are deduped by (selector, JSON.stringify(args)).
//
// When intent is unrecognized, returns CONTEXT_PACK fallback (gaps +
// vendor mix + executive-summary inputs) — cheap selectors that cover
// the most common questions. This guarantees Layer 4 carries SOMETHING
// useful even on phrasings the table doesn't anticipate.
//
// Special case · empty engagement (no instances + no gaps + no drivers):
// router returns selectorCalls=[], fallback="metadata-only"; assembler
// produces a "the canvas is empty" Layer 4 marker.
//
// Authority:
//   - docs/v3.0/SPEC.md §S37.3.1 + §S37.5 R37.4
//   - docs/RULES.md §16 CH33
//   - docs/v3.0/TESTS.md §T38 V-FLOW-GROUND-1 (intent table coverage)
//
// Forbidden (per §S37.7):
//   - LLM calls inside this module (no second grounding surface)
//   - state mutations (router is pure)
//   - any reintroduction of the ENGAGEMENT_INLINE_THRESHOLD_* constants

import { getConceptTOC } from "../core/conceptManifest.js";

// CONTEXT_PACK — the cheap-coverage fallback for unrecognized intents.
// Three selectors that together answer >80% of executive workshop
// questions: gap detail + vendor distribution + customer/drivers digest.
export const CONTEXT_PACK = [
  { selector: "selectGapsKanban",             args: {} },
  { selector: "selectVendorMix",              args: {} },
  { selector: "selectExecutiveSummaryInputs", args: {} }
];

// Intent rules · regex/keyword/phrase-pattern table.
// Each rule fires when its `match` regex hits the lowercased message
// AND no `exclude` regex hits. Selectors are union-merged across all
// matching rules and deduped before return.
//
// IMPORTANT: gap-class rules check for "gap" early so questions like
// "list the gaps currently defined" don't get incorrectly classified
// as vendor-current ("currently" alone doesn't trigger vendor rules
// because the vendor rules require a vendor/dell/asset/instance token).
const INTENT_RULES = [
  // ─── GAPS ───────────────────────────────────────────────────────────
  {
    id: "gap-summary",
    match:   /\bgaps?\b/i,
    selectors: [{ selector: "selectGapsKanban", args: {} }]
  },
  {
    id: "disposition",
    match:   /\bdisposition|treatment\b/i,
    selectors: [
      { selector: "selectGapsKanban", args: {} },
      { selector: "selectMatrixView", args: {} }
    ]
  },
  // ─── VENDOR / ASSETS ────────────────────────────────────────────────
  {
    id: "vendor-current",
    match:   /(?:vendor|dell|non[- ]?dell|asset|instance|workload|server|storage|tool).*(?:current|today|in place|installed)/i,
    selectors: [
      { selector: "selectVendorMix",  args: {} },
      { selector: "selectMatrixView", args: { state: "current" } }
    ]
  },
  {
    id: "vendor-current-reverse",
    match:   /(?:current|today|in place).*(?:vendor|dell|non[- ]?dell|asset|instance|workload)/i,
    selectors: [
      { selector: "selectVendorMix",  args: {} },
      { selector: "selectMatrixView", args: { state: "current" } }
    ]
  },
  {
    id: "vendor-desired",
    match:   /(?:vendor|dell|non[- ]?dell|asset|instance|workload|server|storage|tool).*(?:desired|target|future|to[- ]be|planned)/i,
    selectors: [
      { selector: "selectVendorMix",  args: {} },
      { selector: "selectMatrixView", args: { state: "desired" } }
    ]
  },
  {
    id: "vendor-desired-reverse",
    match:   /(?:desired|target|future|to[- ]be|planned).*(?:vendor|dell|non[- ]?dell|asset|instance|workload)/i,
    selectors: [
      { selector: "selectVendorMix",  args: {} },
      { selector: "selectMatrixView", args: { state: "desired" } }
    ]
  },
  {
    id: "vendor-mix-general",
    match:   /vendor mix|vendor distribut|how dell|dell density|dell percent|dell ratio|vendor breakdown/i,
    selectors: [{ selector: "selectVendorMix", args: {} }]
  },
  {
    id: "find-dell",
    match:   /\bfind .*\bdell\b|\bdell\b.*\b(?:asset|instance|workload|server|storage)/i,
    selectors: [
      { selector: "selectVendorMix",  args: {} },
      { selector: "selectMatrixView", args: { state: "current" } }
    ]
  },
  // ─── MATRIX (env × layer view) ──────────────────────────────────────
  {
    id: "matrix-current",
    match:   /matrix.*current|current.*matrix|current state.*overview/i,
    selectors: [{ selector: "selectMatrixView", args: { state: "current" } }]
  },
  {
    id: "matrix-desired",
    match:   /matrix.*desired|desired.*matrix|desired state.*overview|to[- ]be.*overview/i,
    selectors: [{ selector: "selectMatrixView", args: { state: "desired" } }]
  },
  // ─── EXECUTIVE / HEALTH ─────────────────────────────────────────────
  {
    id: "executive-summary",
    match:   /executive\s*(?:summary|brief|digest)?|exec\s*sum|brief.*ci[oc]|board.*summary|c[- ]?suite/i,
    selectors: [
      { selector: "selectExecutiveSummaryInputs", args: {} },
      { selector: "selectGapsKanban",             args: {} }
    ]
  },
  {
    id: "health-summary",
    match:   /health (?:summary|status|rollup)|engagement (?:health|status overall)|how (?:are we|is the engagement) doing/i,
    selectors: [{ selector: "selectHealthSummary", args: {} }]
  },
  // ─── DRIVERS ────────────────────────────────────────────────────────
  {
    id: "driver-list",
    match:   /strategic driver|business driver|\bdriver list\b|list.*driver|what.*driver|drivers? of (?:change|the engagement)/i,
    selectors: [{ selector: "selectExecutiveSummaryInputs", args: {} }]
  },
  // ─── PROJECTS ───────────────────────────────────────────────────────
  {
    id: "project-list",
    match:   /\bproject(?:s|s list)?\b|list.*project|what.*project|projects? defined|roadmap of project/i,
    selectors: [{ selector: "selectProjects", args: {} }]
  }
];

// Concept-definition + workflow-howto patterns are handled separately
// because they need ID extraction (we look up the exact concept/workflow
// id from the user message rather than passing an empty placeholder).
const CONCEPT_DEFINITION_RE = /\bwhat (?:is|does|do)\b|\bdefine\b|\bdefinition of\b|\bmean(?:s|ing)?\b|\bexplain\b/i;
const WORKFLOW_HOWTO_RE     = /\bhow do i\b|\bhow to\b|\bwhere is\b|\bwhere do i\b|\bwalk me through\b/i;

// Returns the matching concept id if any concept's `label` appears as a
// case-insensitive substring of the user message; else null. Pre-built
// at module load to keep route() O(message-length × concept-count).
const _CONCEPT_TOC      = (function() { try { return getConceptTOC(); } catch (_e) { return []; } })();
const _CONCEPT_BY_LABEL = (function() {
  // Sort by descending label-length so multi-word labels match before
  // their single-word substrings (e.g. "cyber resilience" before "cyber").
  return _CONCEPT_TOC
    .map(function(c) { return { id: c.id, label: String(c.label).toLowerCase() }; })
    .filter(function(c) { return c.label.length >= 4; })
    .sort(function(a, b) { return b.label.length - a.label.length; });
})();

function findConceptIdInMessage(lower) {
  for (var i = 0; i < _CONCEPT_BY_LABEL.length; i++) {
    var entry = _CONCEPT_BY_LABEL[i];
    if (lower.indexOf(entry.label) >= 0) return entry.id;
  }
  return null;
}

// Engagement-empty detection: zero instances + zero gaps + zero drivers.
// On empty engagement we return selectorCalls=[] and let the assembler
// produce a "canvas is empty" Layer 4.
function isEmptyEngagement(engagement) {
  if (!engagement) return true;
  var inst = (engagement.instances    && engagement.instances.allIds    && engagement.instances.allIds.length)    || 0;
  var gap  = (engagement.gaps         && engagement.gaps.allIds         && engagement.gaps.allIds.length)         || 0;
  var drv  = (engagement.drivers      && engagement.drivers.allIds      && engagement.drivers.allIds.length)      || 0;
  return inst === 0 && gap === 0 && drv === 0;
}

// Dedupe selector calls by (selector, JSON.stringify(args)).
function dedupe(calls) {
  var seen = {};
  var out = [];
  for (var i = 0; i < calls.length; i++) {
    var c = calls[i];
    var key = c.selector + "|" + JSON.stringify(c.args || {});
    if (!seen[key]) { seen[key] = true; out.push(c); }
  }
  return out;
}

// Public: route(...) → { selectorCalls, rationale, fallback }.
//
//   selectorCalls: [{ selector: "<name>", args: {...} }, ...]
//   rationale:     "<intent-id>+<intent-id>+..." or a status string
//                  ("empty-engagement", "context-pack", etc.)
//   fallback:      "context-pack" | "metadata-only" | "selector-drop" | null
//
// Pure + deterministic — same input MUST produce same output across calls.
export function route(opts) {
  var userMessage = String((opts && opts.userMessage) || "");
  var engagement  = opts && opts.engagement;

  // Empty engagement → metadata only, no selector retrieval.
  if (isEmptyEngagement(engagement)) {
    return {
      selectorCalls: [],
      rationale:     "empty-engagement",
      fallback:      "metadata-only"
    };
  }

  var lower = userMessage.toLowerCase();
  var matched = [];
  var calls = [];

  // Pass 1 · pattern-table intent matches.
  for (var i = 0; i < INTENT_RULES.length; i++) {
    var rule = INTENT_RULES[i];
    if (!rule.match.test(userMessage)) continue;
    if (rule.exclude && rule.exclude.test(userMessage)) continue;
    matched.push(rule.id);
    for (var j = 0; j < rule.selectors.length; j++) {
      calls.push(rule.selectors[j]);
    }
  }

  // Pass 2 · concept-definition with id extraction.
  if (CONCEPT_DEFINITION_RE.test(userMessage)) {
    var conceptId = findConceptIdInMessage(lower);
    if (conceptId) {
      matched.push("concept-definition");
      calls.push({ selector: "selectConcept", args: { id: conceptId } });
    }
  }

  // Pass 3 · workflow-howto. We don't have a strong workflow-id matcher
  // for v1; the role section already directs the LLM at the workflow TOC
  // for "how do I..." questions and the LLM may emit selectWorkflow as
  // a tool_use round-trip. The router doesn't pre-fetch workflow bodies
  // because the workflow id space is small (16 entries) and the inlined
  // TOC + recommendations cover most cases. Recording the intent for
  // rationale visibility only.
  if (WORKFLOW_HOWTO_RE.test(userMessage)) {
    matched.push("workflow-howto");
  }

  // No intent fired → CONTEXT_PACK fallback.
  if (calls.length === 0) {
    return {
      selectorCalls: CONTEXT_PACK.slice(),
      rationale:     matched.length ? matched.join("+") + "+context-pack" : "context-pack",
      fallback:      "context-pack"
    };
  }

  return {
    selectorCalls: dedupe(calls),
    rationale:     matched.join("+"),
    fallback:      null
  };
}
