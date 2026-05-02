// services/chatTools.js
//
// SPEC §S20.5.3 · Tool definitions for the §S5 selectors. The LLM
// emits tool_use blocks against these names; chatService resolves the
// call locally by invoking the dispatcher against the active
// engagement, then feeds the tool_result back to the model.
//
// One tool entry per §S5 selector — V-CHAT-3 enforces. Adding a
// selector to §S5 without adding a tool here fails V-CHAT-3.
//
// Authority: docs/v3.0/SPEC.md §S20.5 · docs/v3.0/TESTS.md §T20 V-CHAT-3 ·
//            docs/RULES.md §16 CH4.

import { selectMatrixView }             from "../selectors/matrix.js";
import { selectGapsKanban }             from "../selectors/gapsKanban.js";
import { selectVendorMix }              from "../selectors/vendorMix.js";
import { selectHealthSummary }          from "../selectors/healthSummary.js";
import { selectExecutiveSummaryInputs } from "../selectors/executiveSummary.js";
import { selectLinkedComposition }      from "../selectors/linkedComposition.js";
import { selectProjects }               from "../selectors/projects.js";
import { getConcept }                   from "../core/conceptManifest.js";

export const CHAT_TOOLS = [
  {
    name: "selectMatrixView",
    description: "Returns the env × layer matrix for the engagement, with per-cell instance ids, count, and vendor mix. Use this to answer questions about which instances live in which (env, layer) cells, and to get vendor distribution per cell.",
    input_schema: {
      type: "object",
      properties: {
        state:         { type: "string", enum: ["current","desired"], description: "Which state to view; defaults to 'current'." },
        includeHidden: { type: "boolean", description: "Include hidden envs; defaults to false." }
      }
    },
    invoke: (engagement, args) => selectMatrixView(engagement, {
      state:         (args && args.state) || "current",
      includeHidden: !!(args && args.includeHidden)
    })
  },
  {
    name: "selectGapsKanban",
    description: "Returns all gaps grouped by phase (now/next/later) and status (open/in_progress/closed/deferred), with totals. Use this for any 'how many gaps' or 'list gaps' question.",
    input_schema: { type: "object", properties: {} },
    invoke: (engagement) => selectGapsKanban(engagement)
  },
  {
    name: "selectVendorMix",
    description: "Returns vendor distribution across the engagement (dell vs nonDell vs custom) globally and per layer. Use this for vendor-density and 'how Dell are we' questions.",
    input_schema: { type: "object", properties: {} },
    invoke: (engagement) => selectVendorMix(engagement)
  },
  {
    name: "selectHealthSummary",
    description: "Returns the engagement's health rollup — global counts, per-env health, and trend signals.",
    input_schema: { type: "object", properties: {} },
    invoke: (engagement) => selectHealthSummary(engagement)
  },
  {
    name: "selectExecutiveSummaryInputs",
    description: "Returns a structured digest suitable for an executive summary — customer + drivers + headline counts.",
    input_schema: { type: "object", properties: {} },
    invoke: (engagement) => selectExecutiveSummaryInputs(engagement)
  },
  {
    name: "selectLinkedComposition",
    description: "Returns the merged record set for a specific entity — its FK-linked records across collections. Provide kind ('driver'|'currentInstance'|'desiredInstance'|'gap'|'environment'|'project') and id; without args returns a sentinel error envelope.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["driver","currentInstance","desiredInstance","gap","environment","project"] },
        id:   { type: "string" }
      }
    },
    invoke: (engagement, args) => selectLinkedComposition(engagement, args || {})
  },
  {
    name: "selectProjects",
    description: "Returns the engagement's projects (gap groupings by phase × env × gapType) in deterministic order.",
    input_schema: { type: "object", properties: {} },
    invoke: (engagement) => selectProjects(engagement)
  },
  // SPEC §S27 + RULES §16 CH21 — definitional grounding tool.
  // Fetches the full body of a concept from core/conceptManifest.js.
  // The TOC is inlined on the cached prefix; this tool is called when
  // the user asks for full definition + example + when-to-use +
  // vsAlternatives + typical Dell solutions on a specific concept.
  // Engagement-agnostic (the dictionary is static).
  {
    name: "selectConcept",
    description: "Fetch the full body of a single concept from the app's concept dictionary by id (e.g. 'gap_type.replace', 'driver.cyber_resilience', 'layer.dataProtection'). Returns {definition, example, whenToUse, vsAlternatives?, typicalDellSolutions?}. Use when the user asks for deeper explanation of a concept the prompt's TOC headline doesn't cover, or when comparing siblings (vsAlternatives requires fetching both ids).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Concept id, formatted '<category>.<member>' (e.g. 'gap_type.replace')." }
      },
      required: ["id"]
    },
    invoke: (engagement, args) => {
      const id = args && args.id;
      const c = getConcept(id);
      if (!c) {
        return { ok: false, error: "Unknown concept id: '" + (id || "(missing)") + "'. Call selectConcept with one of the ids in the TOC." };
      }
      return { ok: true, concept: c };
    }
  }
];
