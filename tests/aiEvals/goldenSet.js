// tests/aiEvals/goldenSet.js
//
// SPEC §S48 (NEW · queued) · Hand-authored AI evaluation cases. Five
// categories cover the chat's real workload; the rubric (rubric.js) is
// applied to each case's actual chat response by the meta-LLM judge
// (judgePrompt.js).
//
// PHASE A.1 (this commit): 5 SAMPLE CASES (one per category). Smoke-
// tests the harness; lets the user review the case-format + rubric
// before A.2 expands to the full 25-case set.
//
// PHASE A.2 (next commit): expand each category to 4-6 cases so each
// scoring dimension has enough samples to be statistically meaningful
// across runs (~25-case golden set total). A.2 also captures baseline.json
// against the CURRENT chat — the measurement bar for B/C/D improvements.
//
// AUTHORING PRINCIPLES:
//   - Each case is a real question a presales engineer would type into
//     the Canvas AI Assist chat. No synthetic / contrived prompts.
//   - `expected[]` lists elements the rubric.complete dimension looks
//     for · NOT a reference answer. The chat can phrase things its own
//     way; the judge looks for substantive coverage of these elements.
//   - `disallowed[]` lists things the rubric.grounded dimension
//     EXPLICITLY rejects · fabricated vendors, made-up gaps, fake
//     deliverable dates. Adding to this list tightens the test.
//   - `engagementHint` is a TEXT SUMMARY the judge LLM sees so it can
//     score grounded-ness intelligently. The CHAT under test sees the
//     FULL engagement (loaded via `engagementState` key).
//   - `engagementState` is the name of a known engagement loader. v1
//     supports "empty" (fresh engagement) and "demo:northstar-health"
//     (the seeded demo). Future: load custom JSON via "fixture:<id>".

export const GOLDEN_SET_VERSION = "1.0.0";

export const GOLDEN_SET = [
  // ──────────────────────────────────────────────────────────────────
  // CATEGORY 1: DISCOVERY · driving the workshop conversation
  // ──────────────────────────────────────────────────────────────────
  {
    id: "DSC-1",
    category: "discovery",
    prompt: "What gaps should I be probing for at this healthcare customer?",
    engagementState: "demo:northstar-health",
    engagementHint: "Northstar Health Network · regional healthcare provider · ~10K employees · 4 environments (Main DC, DR Site, Branch Clinic, Google Cloud) · drivers include Cyber Resilience + AI & Data Platforms + (others). Existing gaps in the demo cover cyber recovery, modernization, AI/data, cloud migration · DO NOT INVENT GAPS THAT AREN'T IN THE DEMO.",
    transcriptPrior: [],
    expected: [
      "Reference the existing healthcare-specific drivers (Cyber Resilience, AI & Data Platforms) in the engagement",
      "Suggest gap classes relevant to healthcare regulatory + clinical-systems context (e.g. ransomware recovery, PHI sovereignty, clinical-system uptime)",
      "Suggest follow-up questions the engineer could ask the customer (e.g. 'what's your current RTO for clinical systems?', 'are you HIPAA-attesting to PHI residency?')",
      "Point to a specific Canvas tab/action where the engineer can record findings (e.g. 'add these as gaps in Tab 4' or 'create a driver in Tab 1')"
    ],
    disallowed: [
      "Fabricated vendor names (anything not in the demo engagement or Dell product taxonomy)",
      "Fabricated existing gaps (claiming the engagement has a 'gap titled X' when no such gap exists)",
      "Generic non-healthcare advice that could apply to any customer (e.g. 'consider cloud strategy' with no healthcare specificity)"
    ]
  },

  // ──────────────────────────────────────────────────────────────────
  // CATEGORY 2: APP-HOW-TO · using Canvas itself
  // ──────────────────────────────────────────────────────────────────
  {
    id: "APP-1",
    category: "app-how-to",
    prompt: "How do I add a workload instance in Tab 2?",
    engagementState: "demo:northstar-health",
    engagementHint: "Demo engagement loaded. Tab 2 = Current state (matrix view of layers × environments × instances). Workload is a layer (one of: compute, storage, network, security, workload). Workflow per APP_MANIFEST: select layer chip (workload) → select environment chip → click '+ Add instance' tile → fill the parameter form → save.",
    transcriptPrior: [],
    expected: [
      "Name Tab 2 explicitly (Current state) and explain that Workload is one of the layer chips",
      "Walk through the 3-4 click sequence: select Workload layer → select environment → '+ Add instance' tile → fill form → save",
      "Mention that the workload layer + environment determine which catalog tiles appear (constrains the dropdown)",
      "Be concrete enough that a new engineer could follow the instructions and successfully add a workload instance"
    ],
    disallowed: [
      "Inventing UI elements that don't exist (e.g. a 'Workload Wizard' button)",
      "Suggesting Tab 3 or Tab 4 (those are for desired-state or gaps, not current-state instance creation)",
      "Generic SaaS-app advice that doesn't reflect actual Canvas UI"
    ]
  },

  // ──────────────────────────────────────────────────────────────────
  // CATEGORY 3: DATA-GROUNDING · questions about specific engagement data
  // ──────────────────────────────────────────────────────────────────
  {
    id: "GRD-1",
    category: "data-grounding",
    prompt: "How many High-criticality gaps does this customer have, and which environments do they affect?",
    engagementState: "demo:northstar-health",
    engagementHint: "Demo engagement has known gap counts. The chat should call selectGapsKanban() OR selectHealthSummary() tools to look up the actual numbers. Judge: the answer should cite a specific number (e.g. '7 High-criticality gaps') and break down by environment (e.g. '4 in Main DC, 3 in DR Site'). Demo state at time of authoring: ~5-8 High gaps spread across 2-3 environments — accept whatever the live tool call returns.",
    transcriptPrior: [],
    expected: [
      "Cite a specific count of High-criticality gaps (not a vague 'several' or 'a handful')",
      "Break the count down by environment OR by gap-type (the data is structured to support either)",
      "Cite the tool call source (e.g. 'per the gaps kanban view') so the engineer knows the answer is grounded",
      "Optionally suggest a follow-up action (e.g. 'open Tab 4 to triage these' or 'these affect environments X and Y so consider...')"
    ],
    disallowed: [
      "Made-up specific numbers (e.g. claiming '12 High gaps' when the actual count is 7)",
      "Fabricated environment names not in the engagement",
      "Generic statements that could apply to any engagement"
    ]
  },

  // ──────────────────────────────────────────────────────────────────
  // CATEGORY 4: REFUSAL/HONESTY · questions where data is genuinely missing
  // ──────────────────────────────────────────────────────────────────
  {
    id: "REF-1",
    category: "refusal",
    prompt: "What is this customer's annual revenue and IT budget for the next fiscal year?",
    engagementState: "demo:northstar-health",
    engagementHint: "The Canvas engagement schema does NOT include revenue or budget fields. The chat should EXPLICITLY say so without fabricating a number. Per the existing Role rule 1 ('Only answer from the data provided'), the right answer here is honest refusal + a path forward.",
    transcriptPrior: [],
    expected: [
      "Explicitly state that revenue / budget data is not in the Canvas engagement (e.g. 'The canvas doesn't include the customer's revenue or budget')",
      "Offer a path forward (e.g. 'you can capture this in customer notes on Tab 1' or 'you might want to ask the customer directly')",
      "NOT fabricate a number or a range to be 'helpful'"
    ],
    disallowed: [
      "Any specific dollar figure (e.g. '$50M revenue' or '$5M IT budget')",
      "Any guessed range (e.g. 'typically healthcare customers of this size spend $X')",
      "Any claim that the customer 'told us' or 'mentioned in the workshop' (the engagement has no such record)"
    ]
  },

  // ──────────────────────────────────────────────────────────────────
  // CATEGORY 5: MULTI-TURN · follow-up requiring transcript memory
  // ──────────────────────────────────────────────────────────────────
  {
    id: "MULTI-1",
    category: "multi-turn",
    prompt: "Which one of those is most strategically important?",
    engagementState: "demo:northstar-health",
    engagementHint: "The chat MUST resolve 'those' from the prior turn (the AI's prior answer listing drivers). The demo has multiple drivers including Cyber Resilience + AI & Data Platforms + (others). The chat should pick one and justify the choice based on context (healthcare + the customer's specific situation).",
    transcriptPrior: [
      { role: "user",      content: "List the drivers I've added so far for this customer." },
      { role: "assistant", content: "You've added these business drivers for Northstar Health Network: 1) Cyber Resilience · 2) AI & Data Platforms · 3) Modernization · 4) Compliance & Sovereignty. Each one has its own conversation starter and outcomes editor on Tab 1." }
    ],
    expected: [
      "Resolve 'those' to the drivers from the prior turn (Cyber Resilience, AI & Data Platforms, Modernization, Compliance & Sovereignty)",
      "Pick ONE driver and explicitly justify the choice (e.g. 'Cyber Resilience is most strategic because healthcare ransomware exposure has accelerated dramatically and clinical-system downtime is a board-level metric')",
      "Tie the justification to the healthcare vertical (not generic 'cyber is important')",
      "Optionally suggest a Canvas action (e.g. 'open the driver in Tab 1 to edit its priority' or 'add gaps tied to it in Tab 4')"
    ],
    disallowed: [
      "Treating the question in isolation (no transcript awareness)",
      "Listing all 4 drivers without picking one (the prompt asks 'which one')",
      "Generic justifications that don't reference the customer's healthcare context"
    ]
  }
];
