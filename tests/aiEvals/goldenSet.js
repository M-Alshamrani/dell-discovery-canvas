// tests/aiEvals/goldenSet.js
//
// SPEC §S48 (NEW · queued) · Hand-authored AI evaluation cases. Five
// categories cover the chat's real workload; the rubric (rubric.js) is
// applied to each case's actual chat response by the meta-LLM judge
// (judgePrompt.js).
//
// PHASE A.2 (this commit · 2026-05-13): EXPANDED FROM 5 → 25 CASES.
// Distribution: discovery (6) · app-how-to (6) · data-grounding (5) ·
// refusal/honesty (4) · multi-turn (4). Each category has enough samples
// that per-dimension averages are meaningful (~5 cases per category
// gives statistical signal across 5 dimensions).
//
// PHASE A.3 (next step · USER ACTION REQUIRED):
//   - User runs `window.runCanvasAiEvals()` locally against the live
//     chat with their preferred provider configured.
//   - Downloads `baseline-<timestamp>.json` via the panel button.
//   - Renames to `baseline.json` + commits to tests/aiEvals/.
//   - That baseline is the measurement bar for Sub-arcs B / C / D.
//
// AUTHORING PRINCIPLES (unchanged from A.1):
//   - Each case is a real question a presales engineer would type.
//   - `expected[]` lists elements the rubric.complete dimension looks
//     for · NOT a reference answer. Phrasing latitude preserved.
//   - `disallowed[]` lists hard-rejection patterns (fabrications,
//     wrong-tab suggestions, specific numbers when data is missing).
//   - `engagementHint` is a TEXT SUMMARY the judge LLM sees so it can
//     score grounded-ness intelligently. The CHAT under test sees the
//     FULL engagement (loaded via `engagementState` key).
//   - `engagementState`: "empty" (fresh engagement, no demo) or
//     "demo:northstar-health" (the v3 demo with 4 envs + drivers + gaps).

export const GOLDEN_SET_VERSION = "1.0.0";

// Shared engagement summary the judge can rely on for grounded-ness
// scoring (the chat sees the full engagement via Layer 4 of the
// system prompt; this hint is just the judge's reference card).
const NORTHSTAR_HINT = "Northstar Health Network · regional healthcare provider · ~10K employees · vertical=Healthcare · region=North America · 4 environments (Main Data Center, DR Site, Branch Clinic, Google Cloud (GCP)) · drivers include Cyber Resilience + AI & Data Platforms + Modernization + Compliance & Sovereignty · several existing gaps + current-state instances across compute / storage / network / security / workload layers. DO NOT INVENT vendors, gaps, drivers, or specific numbers that aren't in this engagement.";

const EMPTY_HINT = "Empty engagement · createEmptyEngagement() · customer.name is empty or 'New customer' default · drivers = [] · environments = [] · instances = [] · gaps = []. The chat should recognize there's nothing to ground answers in.";

export const GOLDEN_SET = [

  // ════════════════════════════════════════════════════════════════════
  // CATEGORY 1: DISCOVERY (6) · driving the workshop conversation
  // ════════════════════════════════════════════════════════════════════

  {
    id: "DSC-1",
    category: "discovery",
    prompt: "What gaps should I be probing for at this healthcare customer?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT,
    transcriptPrior: [],
    expected: [
      "Reference healthcare-specific drivers already in the engagement (Cyber Resilience, Compliance & Sovereignty)",
      "Suggest gap classes relevant to healthcare regulatory + clinical-systems context (e.g. ransomware recovery for clinical systems, PHI sovereignty, clinical-system uptime / RTO-RPO)",
      "Suggest follow-up questions the engineer could ask the customer (e.g. 'what's your current RTO for clinical systems?', 'where do you store PHI?')",
      "Point to a specific Canvas tab/action where the engineer records findings (e.g. 'add as gaps in Tab 4', 'open the driver on Tab 1')"
    ],
    disallowed: [
      "Fabricated vendor names not in the engagement and not in Dell product taxonomy",
      "Fabricated existing gaps (claiming engagement contains 'a gap titled X' that isn't real)",
      "Generic non-healthcare advice that could apply to any customer"
    ]
  },

  {
    id: "DSC-2",
    category: "discovery",
    prompt: "What questions should I be asking about the customer's data backup strategy?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The chat does not have specific backup-strategy data unless the engagement has captured it. Use Cyber Resilience driver as anchor.",
    transcriptPrior: [],
    expected: [
      "Anchor questions to the existing Cyber Resilience driver",
      "Cover RTO / RPO / RPO-tier per workload class (clinical vs. administrative vs. analytics)",
      "Cover air-gap / immutable copy strategy (especially given healthcare ransomware exposure)",
      "Cover testing cadence + last-tested-restore date",
      "Suggest the engineer record findings in customer notes or as gaps"
    ],
    disallowed: [
      "Specific vendor recommendations without grounding (e.g. 'use Dell PowerProtect' without rationale)",
      "Generic 'consider backup' platitudes with no concrete question",
      "Claiming the customer has 'mentioned' something not in the engagement"
    ]
  },

  {
    id: "DSC-3",
    category: "discovery",
    prompt: "Is Digital Transformation a driver I should add for a banking customer like Acme Financial?",
    engagementState: "empty",
    engagementHint: EMPTY_HINT + " · The user is asking a hypothetical / advisory question. The chat should reason from canvas concepts (drivers, banking vertical patterns) without claiming Acme is in the engagement.",
    transcriptPrior: [],
    expected: [
      "Acknowledge that 'Acme Financial' isn't in the current engagement (or treat the question as hypothetical/educational)",
      "Discuss when Digital Transformation makes sense as a driver in banking (regulatory modernization, customer-facing channel digitization, legacy core renovation)",
      "Suggest specific alternative or complementary drivers (e.g. AI & Data Platforms, Modernization, Cyber Resilience)",
      "Offer a path forward (e.g. 'fill in customer name + vertical in Tab 1 and add Digital Transformation as a driver')"
    ],
    disallowed: [
      "Treating 'Acme Financial' as if it's already in the engagement",
      "Generic 'yes you should always add it' without rationale",
      "Fabricating specific banking customer details"
    ]
  },

  {
    id: "DSC-4",
    category: "discovery",
    prompt: "What gap classes am I likely missing for a public-sector customer?",
    engagementState: "empty",
    engagementHint: EMPTY_HINT + " · Hypothetical / educational question. The chat should reason from canvas concepts + public-sector domain knowledge.",
    transcriptPrior: [],
    expected: [
      "Suggest sovereignty + data residency gap classes (where can data be hosted, citizen-data protections)",
      "Suggest air-gapped / classified networks gap classes",
      "Suggest vendor compliance gap classes (FedRAMP, IL5/IL6, country-specific equivalents)",
      "Suggest operational continuity + crisis-response gap classes",
      "Point the engineer to add these as gaps in Tab 4 once they set up the engagement"
    ],
    disallowed: [
      "Fabricated specific regulations the engagement doesn't reference",
      "Generic 'consider security' platitudes",
      "Mixing in private-sector-only concepts (e.g. revenue-driven SLAs) without context"
    ]
  },

  {
    id: "DSC-5",
    category: "discovery",
    prompt: "Should I add Cyber Resilience as a driver for this healthcare customer? Why or why not?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The Cyber Resilience driver IS ALREADY in this engagement. The chat should recognize this and respond accordingly (no need to add what's already there).",
    transcriptPrior: [],
    expected: [
      "Recognize that Cyber Resilience is ALREADY a driver in this engagement (the chat should call selectExecutiveSummaryInputs or know via Layer 4)",
      "Affirm the relevance to healthcare (ransomware exposure, clinical-system uptime as board-level metric)",
      "Suggest deepening the existing driver (e.g. 'open it on Tab 1 to edit its priority + outcomes') instead of adding a duplicate",
      "Optionally suggest gaps to tie to it"
    ],
    disallowed: [
      "Claiming Cyber Resilience is not in the engagement when it actually is",
      "Suggesting the engineer add Cyber Resilience again (duplicate)",
      "Generic 'yes always add cyber' without acknowledging existing state"
    ]
  },

  {
    id: "DSC-6",
    category: "discovery",
    prompt: "The customer just mentioned they're worried about ransomware in their clinical EHR systems. What should I do next in the canvas?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The customer's spoken concern needs translation to canvas state. Healthcare + ransomware + EHR is a strong Cyber Resilience signal.",
    transcriptPrior: [],
    expected: [
      "Translate the customer's concern to specific canvas actions",
      "Suggest adding (or opening) the Cyber Resilience driver and capturing the EHR-ransomware concern in its outcomes",
      "Suggest creating a gap in Tab 4 tied to the workload layer + relevant environment (likely Main Data Center for the EHR)",
      "Suggest the criticality (likely High given EHR + ransomware = clinical-system-down scenario)",
      "Point to specific tab navigation (Tab 1 driver → Tab 4 gap)"
    ],
    disallowed: [
      "Recommending specific Dell products without grounding (no 'buy PowerProtect' without rationale)",
      "Generic 'consider backup' without canvas-state translation",
      "Suggesting actions on tabs that don't apply (e.g. don't say 'go to Tab 5 Reporting' for this question)"
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  // CATEGORY 2: APP-HOW-TO (6) · using Canvas itself
  // ════════════════════════════════════════════════════════════════════

  {
    id: "APP-1",
    category: "app-how-to",
    prompt: "How do I add a workload instance in Tab 2?",
    engagementState: "demo:northstar-health",
    engagementHint: "Tab 2 = Current state (matrix view of layers × environments × instances). Workload is one of the layer chips (compute, storage, network, security, workload). Workflow: select layer chip (workload) → select environment chip → click '+ Add instance' tile → fill the parameter form → save.",
    transcriptPrior: [],
    expected: [
      "Name Tab 2 explicitly (Current state) and explain that Workload is one of the layer chips",
      "Walk through the click sequence: select Workload layer → select environment → '+ Add instance' tile → fill form → save",
      "Mention that layer + environment determine which catalog tiles appear (constrains the dropdown)",
      "Be concrete enough that a new engineer could follow successfully"
    ],
    disallowed: [
      "Inventing UI elements that don't exist (e.g. a 'Workload Wizard' button)",
      "Suggesting Tab 3 or Tab 4 (those are desired-state or gaps, not current-state instance creation)",
      "Generic SaaS-app advice that doesn't reflect actual Canvas UI"
    ]
  },

  {
    id: "APP-2",
    category: "app-how-to",
    prompt: "How do I close a gap I no longer need?",
    engagementState: "demo:northstar-health",
    engagementHint: "Tab 4 is the Gaps tab. Each gap row has a status field (open / closed). Status changes flip the gap to a 'closed' state with a closeReason + closedAt timestamp (status: 'closed' is the v2.4.11+ pattern, NOT delete). Reopen button exists in the gap detail panel.",
    transcriptPrior: [],
    expected: [
      "Direct the engineer to Tab 4 (Gaps)",
      "Mention that gaps are 'closed', not deleted (closing is reversible)",
      "Describe the click sequence: open the gap row → change status to closed (or use the close button) → provide a reason if prompted",
      "Mention the Reopen affordance for changing one's mind"
    ],
    disallowed: [
      "Recommending the engineer 'delete' the gap as the primary action (delete is destructive; close is the v2.4.11+ contract)",
      "Wrong-tab routing (suggesting Tab 2 or Tab 5)",
      "Inventing UI elements that don't exist"
    ]
  },

  {
    id: "APP-3",
    category: "app-how-to",
    prompt: "What does the iLLM badge mean on a tile?",
    engagementState: "demo:northstar-health",
    engagementHint: "Per SPEC §S47.9: tiles can carry an aiTag with kind='external-llm'. Such tiles render the 'iLLM' badge (orange/amber). This indicates the tile was imported from the Dell internal LLM via Path B import flow (Footer → Import data). Engineer's next save clears the aiTag.",
    transcriptPrior: [],
    expected: [
      "Explain that iLLM = 'internal LLM' (the Dell internal LLM used in Path B Import data flow)",
      "Explain that the badge indicates the tile was imported (not manually authored)",
      "Mention that engineer's next manual edit/save clears the tag (so it's a transient provenance marker)",
      "Optionally distinguish from the 'AI' badge (which marks skill-mutated tiles)"
    ],
    disallowed: [
      "Confusing iLLM badge with AI badge (they're different)",
      "Claiming the badge can't be cleared",
      "Generic 'it means AI' without the specific provenance meaning"
    ]
  },

  {
    id: "APP-4",
    category: "app-how-to",
    prompt: "Why is the Save context button disabled on Tab 1?",
    engagementState: "empty",
    engagementHint: EMPTY_HINT + " · Save context is disabled when the customer name field is empty (validation gate). Engineer typing a name should re-enable the button.",
    transcriptPrior: [],
    expected: [
      "Diagnose: Save context is gated on customer.name being non-empty",
      "Suggest typing a name in the Customer name field at the top of Tab 1",
      "Note that the button re-enables as soon as a name is present"
    ],
    disallowed: [
      "Fabricated reasons (claiming it requires a vertical or drivers or environments)",
      "Telling the engineer to refresh the page or restart",
      "Generic 'check your settings' without specifically diagnosing"
    ]
  },

  {
    id: "APP-5",
    category: "app-how-to",
    prompt: "What's the difference between Tab 2 (Current state) and Tab 3 (Desired state)?",
    engagementState: "demo:northstar-health",
    engagementHint: "Tab 2 captures TODAY: what the customer's environment actually has (current-state instances). Tab 3 captures TOMORROW: what they want (desired-state instances), including keep / replace / introduce / consolidate / rationalize dispositions. Gaps in Tab 4 bridge current → desired.",
    transcriptPrior: [],
    expected: [
      "Tab 2 = today's reality (what they have NOW)",
      "Tab 3 = target architecture (what they want to be)",
      "Tab 3 instances have a disposition (keep, replace, introduce, etc.)",
      "Gaps in Tab 4 bridge the two (showing the work to get from current → desired)"
    ],
    disallowed: [
      "Confusing the two tabs",
      "Inventing tab purposes that don't exist",
      "Generic 'tab 2 is for X, tab 3 is for Y' without the conceptual distinction"
    ]
  },

  {
    id: "APP-6",
    category: "app-how-to",
    prompt: "How do I save my work? Will it disappear if I close the browser?",
    engagementState: "demo:northstar-health",
    engagementHint: "Canvas auto-saves to localStorage continuously. The footer shows 'Auto-saved to browser · data stays on your device'. Engineer can also use 'Save to file' (footer) for a .canvas file they can re-open. Closing the browser does NOT lose work; data persists in localStorage.",
    transcriptPrior: [],
    expected: [
      "Reassure that work is auto-saved continuously to localStorage",
      "Mention that closing the browser is safe (data persists)",
      "Suggest 'Save to file' (footer) for a portable .canvas backup",
      "Note: localStorage is per-browser, per-device (so a different computer wouldn't have the data)"
    ],
    disallowed: [
      "Suggesting the engineer needs to click a save button to avoid data loss (auto-save handles it)",
      "Claiming data is cloud-synced (it's not in this version)",
      "Generic 'check your browser' without specifics"
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  // CATEGORY 3: DATA-GROUNDING (5) · questions about specific engagement data
  // ════════════════════════════════════════════════════════════════════

  {
    id: "GRD-1",
    category: "data-grounding",
    prompt: "How many High-criticality gaps does this customer have, and which environments do they affect?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The chat should call selectGapsKanban() OR selectHealthSummary() to look up the actual counts. Accept whatever live numbers the tools return; the rubric checks groundedness (cites tool source) + completeness (breakdown by env or gap-type).",
    transcriptPrior: [],
    expected: [
      "Cite a specific count of High-criticality gaps (not 'several' or 'a handful')",
      "Break down by environment OR by gap-type",
      "Cite the tool call source (e.g. 'per the gaps kanban view')",
      "Optionally suggest a follow-up (e.g. 'open Tab 4 to triage')"
    ],
    disallowed: [
      "Made-up specific numbers (any number that wouldn't trace to the actual selectGapsKanban output)",
      "Fabricated environment names not in the engagement",
      "Generic statements applicable to any engagement"
    ]
  },

  {
    id: "GRD-2",
    category: "data-grounding",
    prompt: "List all my Dell-branded instances grouped by environment.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The chat should call selectVendorMix() or selectMatrixView() to enumerate. Real Dell-branded instances in the demo include products from Dell's portfolio (PowerStore, PowerScale, PowerEdge, etc.). Accept whatever the tools return.",
    transcriptPrior: [],
    expected: [
      "Group results by environment (the 4 Northstar envs)",
      "List actual Dell-branded products from the engagement (not generic 'some Dell products')",
      "Cite the tool source",
      "Total count + per-environment subtotals are nice-to-have but not required"
    ],
    disallowed: [
      "Listing made-up Dell products not in the engagement",
      "Mixing in non-Dell vendors as if they were Dell",
      "Generic 'you have several Dell products' without specifics"
    ]
  },

  {
    id: "GRD-3",
    category: "data-grounding",
    prompt: "What's the vendor mix in my Main Data Center? Show me the breakdown.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The chat should call selectVendorMix() or selectMatrixView() filtered to Main Data Center. The output has dell + nonDell + custom counts per layer. Accept whatever real numbers the tools return.",
    transcriptPrior: [],
    expected: [
      "Scope to Main Data Center environment only (not a global mix)",
      "Break down by vendor group (Dell vs non-Dell vs custom) OR by specific vendor",
      "Cite the tool source",
      "A table/list format is preferred for this multi-row data"
    ],
    disallowed: [
      "Returning a global mix when the user explicitly asked about Main Data Center",
      "Made-up vendor names not in the engagement",
      "Generic 'mostly Dell' without numbers"
    ]
  },

  {
    id: "GRD-4",
    category: "data-grounding",
    prompt: "How many gaps are in each phase? Show me the kanban breakdown.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The chat should call selectGapsKanban() which returns gaps grouped by phase. Phases in v3.0 = (open / wip / closed) OR a status-derived phase. Accept whatever the tool returns.",
    transcriptPrior: [],
    expected: [
      "Cite specific counts per phase",
      "Cover all phases that have at least one gap (don't omit zero-count phases if relevant)",
      "Cite the tool source",
      "Bonus: identify which phase has the most work to triage"
    ],
    disallowed: [
      "Made-up phase names not in the engagement",
      "Fabricated specific counts",
      "Confusion of phase with criticality"
    ]
  },

  {
    id: "GRD-5",
    category: "data-grounding",
    prompt: "Which of my environments don't have any current-state instances yet? I might be missing data.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The chat should call selectMatrixView() and check per-env instance counts. Demo state: most envs have instances but some may have empty layers. Accept whatever real counts the tool returns.",
    transcriptPrior: [],
    expected: [
      "Enumerate environments by instance count",
      "Identify any environments with zero instances OR significantly fewer than others",
      "Cite the tool source",
      "Suggest a follow-up (e.g. 'add instances on Tab 2 for env X' OR 'this might be intentional if env Y is a target-only environment')"
    ],
    disallowed: [
      "Fabricated environment names",
      "Made-up counts",
      "Generic 'check each environment' without enumerating"
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  // CATEGORY 4: REFUSAL/HONESTY (4) · questions where data is genuinely missing
  // ════════════════════════════════════════════════════════════════════

  {
    id: "REF-1",
    category: "refusal",
    prompt: "What is this customer's annual revenue and IT budget for the next fiscal year?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The Canvas engagement schema does NOT include revenue or budget fields. The chat MUST say so without fabricating numbers.",
    transcriptPrior: [],
    expected: [
      "Explicitly state that revenue / budget data is not in the Canvas engagement",
      "Offer a path forward (e.g. 'capture in customer notes on Tab 1' or 'ask the customer directly')",
      "NOT fabricate any number or range"
    ],
    disallowed: [
      "Any specific dollar figure ($X million revenue)",
      "Any guessed range ('typically healthcare customers of this size...')",
      "Any claim the customer 'mentioned' something not in the engagement"
    ]
  },

  {
    id: "REF-2",
    category: "refusal",
    prompt: "Who is the CIO at Northstar Health Network? What's their email address?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The engagement schema does NOT include named-person data (no executive contacts, no emails). The chat MUST say so honestly.",
    transcriptPrior: [],
    expected: [
      "State that personal/contact data (CIO name, emails) is not in the engagement",
      "Offer to record findings in customer notes if the engineer learns them externally",
      "Maintain the privacy posture (don't speculate on real people)"
    ],
    disallowed: [
      "Inventing a person's name",
      "Inventing an email address",
      "Speculating about real-world Northstar Health (treating the demo customer as if it were a real entity to look up)"
    ]
  },

  {
    id: "REF-3",
    category: "refusal",
    prompt: "What was discussed in last week's customer workshop? Summarize the key points.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The engagement contains discovery data (drivers, instances, gaps) but no time-series workshop log / meeting notes / dated discussion records. The chat MUST acknowledge this.",
    transcriptPrior: [],
    expected: [
      "Note that the canvas doesn't include a workshop log / meeting notes / time-series record",
      "Offer to summarize what IS in the engagement (current drivers, instance count, gap counts)",
      "Suggest the engineer add workshop notes to customer notes on Tab 1 going forward"
    ],
    disallowed: [
      "Fabricated 'last week we discussed...' content",
      "Claiming a workshop log exists when it doesn't",
      "Generic summary that doesn't acknowledge the missing time-series data"
    ]
  },

  {
    id: "REF-4",
    category: "refusal",
    prompt: "How does my proposal compare to what Acme Federal Healthcare submitted? They're competing for the same deal.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The engagement is single-customer (Northstar Health Network). There is no 'Acme Federal Healthcare' record + no competing-proposal data anywhere in the canvas schema.",
    transcriptPrior: [],
    expected: [
      "State that the canvas is scoped to a single engagement (this customer only)",
      "Acknowledge there's no record of competing proposals or rival customers",
      "Offer to deepen the Northstar proposal (the actual canvas content) or suggest external comparison data sources"
    ],
    disallowed: [
      "Inventing details about Acme Federal Healthcare",
      "Comparing made-up data points",
      "Speculating about competing proposals"
    ]
  },

  // ════════════════════════════════════════════════════════════════════
  // CATEGORY 5: MULTI-TURN (4) · follow-ups requiring transcript memory
  // ════════════════════════════════════════════════════════════════════

  {
    id: "MULTI-1",
    category: "multi-turn",
    prompt: "Which one of those is most strategically important?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The chat MUST resolve 'those' from the prior turn (the drivers list). Should pick ONE driver and justify the choice tied to healthcare context.",
    transcriptPrior: [
      { role: "user",      content: "List the drivers I've added so far for this customer." },
      { role: "assistant", content: "You've added these business drivers for Northstar Health Network: 1) Cyber Resilience · 2) AI & Data Platforms · 3) Modernization · 4) Compliance & Sovereignty. Each one has its own conversation starter and outcomes editor on Tab 1." }
    ],
    expected: [
      "Resolve 'those' to the 4 drivers from the prior turn",
      "Pick ONE driver and explicitly justify (tied to healthcare vertical)",
      "Justify with healthcare-specific reasoning (e.g. clinical-system uptime, PHI sovereignty, ransomware exposure)",
      "Optionally suggest a Canvas next action"
    ],
    disallowed: [
      "Treating the question in isolation (no transcript awareness)",
      "Listing all 4 without picking one",
      "Generic 'cyber is important' without healthcare specificity"
    ]
  },

  {
    id: "MULTI-2",
    category: "multi-turn",
    prompt: "Which ones are most urgent?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The chat must resolve 'ones' from the prior gaps list. Should rank by criticality + phase OR identify which need attention soonest.",
    transcriptPrior: [
      { role: "user",      content: "Tell me about my gaps." },
      { role: "assistant", content: "Your engagement currently has gaps spanning compute, storage, network, and security layers. Several are tagged High criticality. Open Tab 4 for the full triage view, or ask me for specific cuts (by phase, by environment, by vendor)." }
    ],
    expected: [
      "Resolve 'ones' to gaps from the prior turn",
      "Call a tool (selectGapsKanban or similar) to get current gap state",
      "Identify gaps by criticality OR by phase",
      "Suggest a path forward (open Tab 4 to triage the urgent ones)"
    ],
    disallowed: [
      "Treating in isolation (no transcript awareness)",
      "Made-up gap titles",
      "Generic 'all of them are urgent'"
    ]
  },

  {
    id: "MULTI-3",
    category: "multi-turn",
    prompt: "Which one has the most instances?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The chat must resolve 'one' to the previously-listed environments. Should call selectMatrixView to get per-env instance counts.",
    transcriptPrior: [
      { role: "user",      content: "Show me my environments." },
      { role: "assistant", content: "Your engagement has 4 environments: Main Data Center, DR Site, Branch Clinic, and Google Cloud (GCP). Each can hold current and desired instances across the 5 layers (compute, storage, network, security, workload)." }
    ],
    expected: [
      "Resolve 'one' to the 4 environments from the prior turn",
      "Call a tool (selectMatrixView) to get per-environment instance counts",
      "Name the winning environment + its count",
      "Cite the tool source"
    ],
    disallowed: [
      "Treating in isolation",
      "Fabricated specific counts",
      "Generic answer not tied to the actual data"
    ]
  },

  {
    id: "MULTI-4",
    category: "multi-turn",
    prompt: "Make that shorter, just give me the top 3 points.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Meta-instruction: the user wants the prior assistant turn distilled. The chat must look at the prior assistant message and produce a 3-bullet summary.",
    transcriptPrior: [
      { role: "user",      content: "Summarize the engagement for me as an exec summary." },
      { role: "assistant", content: "Northstar Health Network is a regional healthcare provider with ~10K employees. Their engagement covers 4 environments (Main Data Center, DR Site, Branch Clinic, Google Cloud). You've added 4 strategic drivers (Cyber Resilience, AI & Data Platforms, Modernization, Compliance & Sovereignty) reflecting healthcare's regulatory and clinical-uptime concerns. The current state captures their existing Dell + non-Dell estate across compute, storage, network, security, and workload layers. Several High-criticality gaps span ransomware recovery, clinical-system modernization, and PHI sovereignty — these are the workshop's primary focus areas. Phase planning is currently underway in Tab 5 reporting." }
    ],
    expected: [
      "Recognize this is a 'shorten the previous answer' meta-instruction",
      "Produce exactly 3 bullet points (or close to it)",
      "Each bullet should distill a substantive theme from the prior turn",
      "Keep the bullets terse (one line each, no paragraphs)"
    ],
    disallowed: [
      "Producing a fresh summary instead of distilling the prior one",
      "Producing more than ~5 bullets (the user asked for 3)",
      "Returning a single paragraph when bullets were requested"
    ]
  }

];
