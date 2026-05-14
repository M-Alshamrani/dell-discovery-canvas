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
import { getWorkflow }                  from "../core/appManifest.js";
// Sub-arc D (rc.10) · proposeAction tool · imports the canonical
// kind enum from schema/actionProposal.js for single-source-of-truth
// in the input_schema below. Per RULES §16 CH38(a).
import { ACTION_KINDS, ACTION_CONFIDENCE_LEVELS, ACTION_SOURCES } from "../schema/actionProposal.js";

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
  },
  // SPEC §S20.4.1.3 + RULES §16 CH38 — Sub-arc D stub-emission tool.
  // The chat invokes proposeAction when a workshop scenario maps to a
  // known action-kind (4 v1 kinds: add-driver / add-instance-current /
  // add-instance-desired / close-gap). The handler does NOT mutate
  // engagement state; chatService.js captures the tool input into the
  // envelope.proposedActions[] array for engineer-facing review at
  // Sub-arc D Step 4 (preview modal + Apply button). At stub stage
  // there is no Apply UI; proposals just sit in the envelope.
  // flip-disposition + destructive kinds are DEFERRED to v1.5.
  // Per feedback_no_mocks.md: every tool invocation is a real-LLM
  // round-trip; no scripted substrate. input_schema enum on `kind`
  // uses ACTION_KINDS (single source of truth from schema/
  // actionProposal.js · no manual duplication of the kind list).
  {
    name: "proposeAction",
    description: "Propose a structured canvas action for engineer review. MUST be invoked whenever the workshop input names a v1 action kind (add-driver, add-instance-current, add-instance-desired, close-gap). Describing the action in chat prose is NOT a substitute for invoking this tool — the engineer-facing UI only renders proposals emitted via this tool call. Required fields per kind: add-driver requires payload.businessDriverId; add-instance-current/desired require payload.{layerId, environmentId, label}; close-gap requires payload.{gapId, status:'closed', closeReason}. The closeReason field is REQUIRED on close-gap — put your evidence-of-closure citation (e.g. deployment + RTO validation + customer agreement) in payload.closeReason, NOT in the rationale field. Use confidence=HIGH only when the input unambiguously names the entity + supports every payload field; use MEDIUM when one field is inferred; use LOW when multiple fields are inferred or the customer context is ambiguous. Do NOT invoke this tool for free-text suggestions, multi-step plans without clear single-action decomposition, or destructive actions (delete/hide/archive are deferred to v1.5+).",
    input_schema: {
      type: "object",
      properties: {
        kind:        { type: "string", enum: ACTION_KINDS, description: "The action kind (one of 4 v1 kinds). flip-disposition is deferred to v1.5." },
        targetState: { type: "string", enum: ["current", "desired"], description: "Optional · only for add-instance-* kinds. Identifies which state the new tile lands in." },
        payload:     { type: "object", description: "Polymorphic per-kind payload. Shape varies by kind. See schema/actionProposal.js for per-kind structure. Required fields per kind: add-driver:{businessDriverId}; add-instance-current:{layerId,environmentId,label}; add-instance-desired:{layerId,environmentId,label}; close-gap:{gapId,status:'closed'}." },
        confidence:  { type: "string", enum: ACTION_CONFIDENCE_LEVELS, description: "Chat-emitted confidence about this proposal. HIGH/MEDIUM/LOW. Use HIGH only when input unambiguously supports every field." },
        rationale:   { type: "string", description: "Natural-language explanation of why this proposal makes sense given the workshop input. The engineer reads this in the preview modal to decide whether to apply." },
        source:      { type: "string", enum: ACTION_SOURCES, description: "Which mode emitted this proposal. discovery-note (Mode 1 note-taking batch) or ai-proposal (Mode 2 conversational chat-inline · this stub)." }
      },
      required: ["kind", "payload", "confidence", "rationale", "source"]
    },
    invoke: (engagement, args) => {
      // Stub handler: acknowledge receipt. Per CH38(c) this tool does
      // NOT mutate engagement state and does NOT invoke commit-functions.
      // chatService.js captures the args into envelope.proposedActions[]
      // via runtime Zod validation against ActionProposalSchema. The
      // return value here is what the LLM sees in its next round (so it
      // knows the proposal landed; the chat can continue conversation).
      const kind = args && args.kind;
      if (!kind || !ACTION_KINDS.includes(kind)) {
        return { ok: false, error: "proposeAction received invalid or missing kind. Valid kinds: " + ACTION_KINDS.join(", ") };
      }
      return { ok: true, recorded: true, kind: kind, message: "Proposal recorded for engineer review. Continue the conversation as needed." };
    }
  },
  // SPEC §S28 + RULES §16 CH22 — procedural-grounding tool. Fetches
  // the full body of a workflow (steps + relatedConcepts +
  // typicalOutcome) from core/appManifest.js. The TOC is inlined on
  // the cached prefix; this tool surfaces the depth.
  // Engagement-agnostic (workflows are static).
  {
    name: "selectWorkflow",
    description: "Fetch the full step-by-step body of a single workflow from the app manifest by id (e.g. 'workflow.identify_gaps', 'workflow.configure_ai_provider'). Returns {name, intent, appSurface, steps[], relatedConcepts[], typicalOutcome}. Use when the user asks a procedural 'how do I X' question and the inlined TOC headline isn't enough.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Workflow id, formatted 'workflow.<name>' (e.g. 'workflow.identify_gaps')." }
      },
      required: ["id"]
    },
    invoke: (engagement, args) => {
      const id = args && args.id;
      const w = getWorkflow(id);
      if (!w) {
        return { ok: false, error: "Unknown workflow id: '" + (id || "(missing)") + "'. Call selectWorkflow with one of the ids in the TOC." };
      }
      return { ok: true, workflow: w };
    }
  }
];
