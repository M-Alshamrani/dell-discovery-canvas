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
  }
];
