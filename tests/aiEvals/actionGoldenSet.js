// tests/aiEvals/actionGoldenSet.js
//
// SPEC §S48.2 (NEW · rc.10 Sub-arc D · LOCKED 2026-05-14) · golden
// set for action-correctness eval. Foundation set ships 5 cases · one
// per v1 category (4 action kinds + restraint). Expansion to 15-25
// cases lands in a follow-up commit per the rc.8 sub-arc A.1 → A.2
// precedent (foundation first · scale later).
//
// Each case carries:
//   id              · stable case identifier (e.g. ACT-DRIVER-1)
//   category        · one of v1's 5 categories (4 action kinds + restraint)
//   prompt          · the chat input · the workshop scenario as the
//                     engineer would describe it (one-paragraph)
//   engagementState · loader key ("empty" or "demo:northstar-health")
//                     · the eval runner loads this before sending the
//                     prompt
//   engagementHint  · test-harness context the JUDGE sees (NOT the
//                     chat) · clarifies what counts as correct for
//                     this specific scenario
//   transcriptPrior · prior turns to seed multi-turn cases (foundation
//                     ships single-turn only; multi-turn lands in
//                     expansion)
//   expectedProposals · the canonical correct proposal shape · array
//                     · may be empty for restraint cases
//   rubricAnchors   · per-dimension what scoring 2/2 looks like for
//                     this case · empty object falls back to the rubric
//                     definitions

import { ACTION_RUBRIC_DIMENSIONS } from "./actionRubric.js";

export const ACTION_GOLDEN_SET_VERSION = "1.0.0";

// Static engagement hints reused across cases. The judge sees these
// strings; the chat does NOT (the chat sees only the prompt + the
// engagement state).
const EMPTY_HINT = "Fresh empty engagement. customer.name and customer.vertical are both empty strings (per BUG-063 fix · post-rc.9). No drivers, environments, instances, or gaps captured yet. Any proposal must add foundational entities first.";

const NORTHSTAR_HINT = "Northstar Health Network demo engagement: healthcare provider, 4 environments (Main DC · DR Site · Branch Clinic · GCP), Cyber Resilience + Compliance & Sovereignty + Modernize Aging Infrastructure drivers, ~6-8 current-state instances spanning compute/storage/data-protection/virtualization layers, ~4-6 gaps including ransomware-recovery and compliance threads. The chat has full read access to this engagement via Layer 4 selectors.";

export const ACTION_GOLDEN_SET = [
  {
    id: "ACT-DRIVER-1",
    category: "add-driver",
    prompt: "Workshop notes from a new healthcare customer engagement: customer is HIPAA-regulated, has Texas state patient-data residency requirements, and recently lost 4 days of operations to a ransomware incident at a peer organization. They want stronger cybersecurity posture and compliance with state regulations.",
    engagementState: "empty",
    engagementHint: EMPTY_HINT + " · The workshop notes contain TWO clear driver signals: cybersecurity/ransomware → Cyber Resilience driver; HIPAA + state residency → Compliance & Sovereignty driver. The chat should propose BOTH (not just one).",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "add-driver",
        confidence: "HIGH",
        payload: { businessDriverId: "cyber_resilience", priority: "High" },
        rationale: "Customer cited ransomware concerns + cybersecurity posture as a primary need."
      },
      {
        kind: "add-driver",
        confidence: "HIGH",
        payload: { businessDriverId: "compliance_sovereignty", priority: "High" },
        rationale: "HIPAA regulation + Texas state patient-data residency are explicit compliance + sovereignty signals."
      }
    ],
    rubricAnchors: {
      actionKind: "Both add-driver proposals correctly identified as foundational entities to add first on an empty engagement",
      targetState: "businessDriverId values match the canvas catalog (cyber_resilience · compliance_sovereignty)",
      payloadAccuracy: "priority: High justified by 'recently lost 4 days' + 'HIPAA-regulated'",
      confidenceCalibration: "Both HIGH confidence justified · workshop notes were unambiguous on both threads",
      restraint: "Chat did NOT propose adding instances or gaps from this driver-only input (correct restraint · those come after drivers in the workshop flow)"
    }
  },
  {
    id: "ACT-INST-CUR-1",
    category: "add-instance-current",
    prompt: "Customer just told me they currently run Commvault HyperScale X in their Branch Clinic site for tier-2 backup. The Commvault appliance is on-prem and runs daily snapshots without an air-gap.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The demo has Branch Clinic environment but no Commvault HyperScale X instance (Commvault is NOT pre-populated in the demo loader; only Veeam Backup VBR is present in Main DC's data-protection layer). The chat should propose adding Commvault HyperScale X as a current-state instance in the data-protection layer + Branch Clinic environment. Step 3.5 fixture-fix 2026-05-14 evening: prior fixture (Veeam at Main DC) contradicted the demo loader which pre-populates Veeam, causing the chat to correctly read the engagement and not propose a duplicate. The Commvault + Branch Clinic combo is non-pre-populated so the chat will propose cleanly.",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "add-instance-current",
        confidence: "HIGH",
        targetState: "current",
        payload: {
          layerId: "dataProtection",
          environmentId: "<Branch-Clinic-uuid-from-engagement>",
          label: "Commvault HyperScale X",
          vendor: "Commvault",
          vendorGroup: "nonDell",
          criticality: "Medium"
        },
        rationale: "Customer explicitly named Commvault HyperScale X as their current tier-2 backup at the Branch Clinic site; tier-2 + branch site indicates Medium criticality (not High like tier-1 systems at the main DC)."
      }
    ],
    rubricAnchors: {
      actionKind: "add-instance-current is correct (customer described EXISTING infrastructure at Branch Clinic, not a desired target)",
      targetState: "layerId=dataProtection (backup is the data-protection layer) · environmentId=Branch Clinic (explicit customer mention; the demo has this env defined)",
      payloadAccuracy: "vendor=Commvault (named) · vendorGroup=nonDell (Commvault is not Dell) · label=Commvault HyperScale X (full product name) · criticality=Medium (tier-2 branch backup, not tier-1 critical)",
      confidenceCalibration: "HIGH justified · every field traces directly to a customer statement",
      restraint: "Chat did NOT also propose a desired-state replacement OR escalate criticality to High (correct · customer described what they HAVE at tier-2 with no urgency signal; over-proposing a replacement would be restraint failure)"
    }
  },
  {
    id: "ACT-INST-DES-1",
    category: "add-instance-desired",
    prompt: "The customer just decided they want to introduce Dell PowerProtect Data Manager as their new primary backup platform in the Main Data Center, replacing their existing Veeam.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The demo has Main DC environment + may have Veeam in current state. The chat should propose adding PowerProtect Data Manager as a desired-state instance with disposition='replace'. If Veeam is present in current state, the chat should attempt to link via originId; if not, the chat may emit disposition='introduce' as a fallback.",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "add-instance-desired",
        confidence: "HIGH",
        targetState: "desired",
        payload: {
          layerId: "dataProtection",
          environmentId: "<Main-DC-uuid-from-engagement>",
          label: "PowerProtect Data Manager",
          vendor: "Dell",
          vendorGroup: "dell",
          disposition: "replace",
          originId: "<Veeam-current-uuid-if-present-or-omitted>"
        },
        rationale: "Customer explicitly stated PowerProtect DM is the desired replacement for Veeam in the Main Data Center."
      }
    ],
    rubricAnchors: {
      actionKind: "add-instance-desired is correct (customer described TARGET architecture, 'want to introduce... replacing')",
      targetState: "layerId=dataProtection · environmentId=Main DC · disposition=replace (1-to-1 swap with existing Veeam)",
      payloadAccuracy: "vendor=Dell (PowerProtect is Dell product) · vendorGroup=dell · label=PowerProtect Data Manager (full product name) · originId attempted (preferred) or omitted with rationale",
      confidenceCalibration: "HIGH justified · customer stated decisively, 'just decided'",
      restraint: "Chat did NOT propose additional adjacent actions like adding a Cyber Recovery Vault (customer didn't mention) · correct restraint"
    }
  },
  {
    id: "ACT-CLOSE-1",
    category: "close-gap",
    prompt: "We just finished implementing PowerProtect Data Manager with Cyber Recovery Vault, and validated the ransomware recovery RTO at 2 hours. The customer agrees the ransomware recovery gap is closed.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The demo includes a ransomware-recovery gap in the gaps collection. The chat should propose closing it with a closeReason citing the PowerProtect deployment + validated RTO. The chat should also identify the specific gap (target-state correctness · which ransomware-related gap is closed)?",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "close-gap",
        confidence: "HIGH",
        payload: {
          gapId: "<ransomware-recovery-gap-uuid-from-engagement>",
          status: "closed",
          closeReason: "Implemented PowerProtect Data Manager with Cyber Recovery Vault; ransomware recovery RTO validated at 2 hours; customer agreed."
        },
        rationale: "Customer explicitly confirmed the ransomware gap is closed; implementation + validated RTO are the evidence the closeReason cites."
      }
    ],
    rubricAnchors: {
      actionKind: "close-gap is correct (customer explicitly said 'gap is closed' + provided evidence)",
      targetState: "gapId identifies the ransomware-recovery gap specifically (not a sibling gap like compliance)",
      payloadAccuracy: "status=closed · closeReason cites the specific deployment + RTO validation (not generic 'gap closed' text)",
      confidenceCalibration: "HIGH justified · customer agreed in plain language",
      restraint: "Chat did NOT also propose new adjacent gaps or change disposition on related instances · stayed scoped to the explicit close-gap signal"
    }
  },
  {
    id: "ACT-RESTRAINT-1",
    category: "restraint",
    prompt: "The customer mentioned something about their environment.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · This is a RESTRAINT case · the input is deliberately vague. The chat should NOT propose any action · the correct response is to surface a clarifying question (e.g. 'Could you share more about what the customer said about their environment? Which layer or environment in their stack?'). Emitting any proposal from this input is a restraint failure.",
    transcriptPrior: [],
    expectedProposals: [],
    rubricAnchors: {
      actionKind: "Correct kind = NO action emitted · clarifying question instead",
      targetState: "N/A · no proposal to target",
      payloadAccuracy: "N/A · no proposal payload",
      confidenceCalibration: "N/A · no proposal to score confidence on",
      restraint: "PRIMARY DIMENSION for this case · chat MUST NOT propose anything · should ask a clarifying question · emitting any proposal is a 0 on this dimension"
    }
  },

  // ───────────────────────────────────────────────────────────────────
  // D4 EXPANSION 2026-05-14 evening · 20 new cases (5 categories ×
  // mix of signal-strength + engagement-state + edge cases) added per
  // user-approved taxonomy after Step 3.6 revert. The 5-case foundation
  // proved statistically thin (n=1 per category flipped catastrophically
  // at Step 3.6 baseline). Expansion to 25 cases gives 4-6 samples per
  // category · disambiguates sampling noise from real failure modes ·
  // surfaces contract-surface edges not probed by the foundation set
  // (vendor-not-in-catalog · FK dependencies · consolidate-N-to-1
  // originId · conflicting-customer-info clarification · meta-questions
  // as restraint · etc).
  //
  // GOLDEN_SET_VERSION is intentionally NOT bumped to 1.1.0 yet · the
  // version reflects rubric/judge schema · not case-set size. Bump
  // only if rubricAnchors structure changes or expectedProposals shape
  // mutates. Baseline-comparison discipline: re-baseline against the
  // 25-case set produces a new measurement bar · existing 5-case
  // baselines remain comparable on the cases they share (existing 5).
  // ───────────────────────────────────────────────────────────────────

  // === add-driver category (4 additional cases) ===

  {
    id: "ACT-DRIVER-2",
    category: "add-driver",
    prompt: "Customer just told me their CFO has mandated a 30% IT operating-cost reduction over the next 2 years, citing cloud sprawl and excessive maintenance contracts as the main targets.",
    engagementState: "empty",
    engagementHint: EMPTY_HINT + " · Single-driver HIGH signal: CFO-mandated cost reduction → Cost Optimization driver (High priority · executive-mandate signal). The chat should propose exactly ONE add-driver (cost_optimization), NOT also propose Modernize Aging Infrastructure (the maintenance-contract callout is a SYMPTOM of cost pressure, not a separate driver signal). Restraint test: chat should not over-propose adjacent drivers from a single executive-mandate signal.",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "add-driver",
        confidence: "HIGH",
        payload: { businessDriverId: "cost_optimization", priority: "High" },
        rationale: "CFO-mandated 30% IT cost reduction is a direct, executive-level cost-optimization signal."
      }
    ],
    rubricAnchors: {
      actionKind: "Exactly ONE add-driver (cost_optimization) · the executive mandate is unambiguous · over-proposing adjacent drivers from this single signal is restraint failure",
      targetState: "businessDriverId=cost_optimization (matches the canvas catalog · not 'modernize_aging_infrastructure' even though maintenance contracts are mentioned)",
      payloadAccuracy: "priority: High justified by CFO mandate + 2-year horizon · maintenance-contract callout is symptom, not separate driver",
      confidenceCalibration: "HIGH justified · executive mandate + concrete percentage (30%) + concrete timeline (2 years) are the strongest possible signal class",
      restraint: "Chat did NOT also propose Modernize Aging Infrastructure (the maintenance-contract callout is a downstream effect of cost pressure · NOT a separate strategic driver in this single-signal input)"
    }
  },
  {
    id: "ACT-DRIVER-3",
    category: "add-driver",
    prompt: "Customer mentioned they're 'thinking about modernization stuff' but didn't elaborate.",
    engagementState: "empty",
    engagementHint: EMPTY_HINT + " · Restraint-within-category test (vague driver signal): 'modernization stuff' is ambiguous · could be any of (modernize_aging_infrastructure · ai_data_platforms · cost_optimization · cyber_resilience). Chat should NOT propose add-driver with modernize_aging_infrastructure on this weak signal · should ask which modernization area (compute refresh? data platforms? cloud migration? security posture?).",
    transcriptPrior: [],
    expectedProposals: [],
    rubricAnchors: {
      actionKind: "Correct kind = NO action emitted · the signal is too vague for any specific driver · chat should clarify which modernization area",
      targetState: "N/A · no proposal to target",
      payloadAccuracy: "N/A · no proposal payload",
      confidenceCalibration: "N/A · no proposal to score confidence on",
      restraint: "PRIMARY DIMENSION · chat MUST NOT propose modernize_aging_infrastructure (or any other driver) from 'modernization stuff' · should surface clarifying question about which modernization area"
    }
  },
  {
    id: "ACT-DRIVER-4",
    category: "add-driver",
    prompt: "We're starting fresh with this customer · they're a mid-sized hospital · their concerns include ransomware exposure after a peer attack · aging Cisco network gear past EOL · pressure to control cloud costs · and they may want to start an AI pilot for radiology image triage.",
    engagementState: "empty",
    engagementHint: EMPTY_HINT + " · Workshop-kickoff starter-kit (multi-driver): the prompt names 4 distinct driver signals: (1) ransomware → cyber_resilience; (2) Cisco EOL → modernize_aging_infrastructure; (3) cloud cost control → cost_optimization; (4) radiology AI pilot → ai_data_platforms. Chat should propose ALL 4 add-driver actions · NOT collapse them into fewer.",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "add-driver",
        confidence: "HIGH",
        payload: { businessDriverId: "cyber_resilience", priority: "High" },
        rationale: "Peer-attack ransomware exposure is an explicit cyber resilience signal."
      },
      {
        kind: "add-driver",
        confidence: "HIGH",
        payload: { businessDriverId: "modernize_aging_infrastructure", priority: "High" },
        rationale: "Aging Cisco gear past EOL is a direct infrastructure-modernization signal."
      },
      {
        kind: "add-driver",
        confidence: "HIGH",
        payload: { businessDriverId: "cost_optimization", priority: "Medium" },
        rationale: "Cloud cost pressure is a cost-optimization signal · Medium because the language is 'pressure to control' rather than 'mandated reduction'."
      },
      {
        kind: "add-driver",
        confidence: "MEDIUM",
        payload: { businessDriverId: "ai_data_platforms", priority: "Medium" },
        rationale: "AI radiology pilot is a data-platforms signal · MEDIUM because 'may want to start' is exploratory, not committed."
      }
    ],
    rubricAnchors: {
      actionKind: "Exactly 4 add-driver proposals · one per named signal · collapsing 2+ signals into one driver is a kind-mapping error",
      targetState: "All 4 businessDriverIds match the canvas catalog · NO fabricated driver ids",
      payloadAccuracy: "Priority calibration matters: cyber + infrastructure should be High (concrete urgency · 'past EOL' + 'attack') · cost + AI should be Medium (softer language: 'pressure' + 'may want')",
      confidenceCalibration: "HIGH on the 2 concrete signals · MEDIUM on the 2 exploratory signals · uniform HIGH across all 4 would be over-confidence on the AI pilot",
      restraint: "Chat did NOT also propose instances or gaps on the empty engagement · drivers ship first in the workshop flow · over-proposing instances from this prompt is restraint failure"
    }
  },
  {
    id: "ACT-DRIVER-5",
    category: "add-driver",
    prompt: "We had Cost Optimization captured as Medium priority earlier · but the customer just told me their new CFO is treating it as a board-level priority and wants it bumped to High.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Demo already has cost_optimization driver captured at Medium priority. This is a priority-CHANGE request, NOT an add-driver. The v1 ActionProposalSchema has NO updateDriver / changePriority / flip-disposition kind (flip-disposition deferred to v1.5 per framing-doc Q2). Chat should NOT propose add-driver (would duplicate) AND should NOT propose any other v1 kind (no match). Should explain that priority changes are a manual edit on Tab 1 · NOT a structured-action emission at this stage.",
    transcriptPrior: [],
    expectedProposals: [],
    rubricAnchors: {
      actionKind: "Correct kind = NO action emitted · priority-change is not a v1 action kind · add-driver would duplicate the existing entry",
      targetState: "N/A · no proposal to target",
      payloadAccuracy: "N/A · no proposal payload",
      confidenceCalibration: "N/A · no proposal to score confidence on",
      restraint: "PRIMARY DIMENSION · chat MUST recognize that priority-change is not in the v1 4-kind enum · should guide to manual edit · proposing add-driver would create a duplicate cost_optimization entry"
    }
  },

  // === add-instance-current category (4 additional cases) ===

  {
    id: "ACT-INST-CUR-2",
    category: "add-instance-current",
    prompt: "Walked through their Main Data Center stack and they have: Dell PowerEdge R750s as their virtualization host platform, NetApp AFF arrays for primary storage tier, and Cisco UCS B-series blade servers handling backup compute.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Multi-instance scenario: 3 distinct current-state instances named at Main DC (PowerEdge R750 virtualization host · NetApp AFF storage · Cisco UCS B-series compute). NetApp + Cisco are NOT pre-populated in the demo loader (only Veeam Backup VBR is in Main DC's data-protection layer · PowerEdge R770 may be in compute). Chat should propose 3 add-instance-current actions · one per named instance · all targeting Main DC environment.",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "add-instance-current",
        confidence: "HIGH",
        targetState: "current",
        payload: {
          layerId: "virtualization",
          environmentId: "<Main-DC-uuid>",
          label: "Dell PowerEdge R750",
          vendor: "Dell",
          vendorGroup: "dell",
          criticality: "High"
        },
        rationale: "Customer named PowerEdge R750 as virtualization host platform at Main DC · tier-1 production scope indicates High criticality."
      },
      {
        kind: "add-instance-current",
        confidence: "HIGH",
        targetState: "current",
        payload: {
          layerId: "storage",
          environmentId: "<Main-DC-uuid>",
          label: "NetApp AFF",
          vendor: "NetApp",
          vendorGroup: "nonDell",
          criticality: "High"
        },
        rationale: "Customer named NetApp AFF as primary-tier storage at Main DC · primary-tier indicates High criticality."
      },
      {
        kind: "add-instance-current",
        confidence: "HIGH",
        targetState: "current",
        payload: {
          layerId: "compute",
          environmentId: "<Main-DC-uuid>",
          label: "Cisco UCS B-series",
          vendor: "Cisco",
          vendorGroup: "nonDell",
          criticality: "Medium"
        },
        rationale: "Customer named Cisco UCS B-series for backup compute at Main DC · backup-tier compute indicates Medium criticality (not High like primary clinical workload hosts)."
      }
    ],
    rubricAnchors: {
      actionKind: "Exactly 3 add-instance-current proposals · one per named instance · over-collapsing (e.g. one proposal mentioning all 3) or skipping any is a kind-mapping error",
      targetState: "All 3 target environmentId=Main DC · layerId varies (virtualization · storage · compute) · NO confusion between layers",
      payloadAccuracy: "vendorGroup=dell on PowerEdge (Dell) · vendorGroup=nonDell on NetApp + Cisco · criticality calibrated by role (primary storage + virt host = High · backup compute = Medium)",
      confidenceCalibration: "All HIGH justified · every field traces to a customer statement",
      restraint: "Chat did NOT also propose desired-state replacements · customer described current state only · NOT future direction"
    }
  },
  {
    id: "ACT-INST-CUR-3",
    category: "add-instance-current",
    prompt: "Customer confirmed they run VMware vSphere 7 across all their workload hosts in the Main Data Center · 12 hosts total · they treat it as their primary virtualization platform for clinical applications.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Single-instance HIGH-signal full-payload scenario: vendor (VMware) + product (vSphere 7) + environment (Main DC) + layer (virtualization) + scope (12 hosts · primary platform · clinical workload) all explicit. The demo's virtualization layer at Main DC may or may not be pre-populated · the workshop-realistic answer is to propose adding vSphere as a current-state instance regardless · the engineer can review for duplicates at apply time. HIGH confidence + full payload populated is the gold standard for this category.",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "add-instance-current",
        confidence: "HIGH",
        targetState: "current",
        payload: {
          layerId: "virtualization",
          environmentId: "<Main-DC-uuid>",
          label: "VMware vSphere 7",
          vendor: "VMware",
          vendorGroup: "nonDell",
          criticality: "High"
        },
        rationale: "Customer explicitly named VMware vSphere 7 as primary virtualization platform at Main DC · 12-host scale + clinical workload scope indicates High criticality."
      }
    ],
    rubricAnchors: {
      actionKind: "Single add-instance-current · correctly classified · NOT add-instance-desired (customer described current state)",
      targetState: "layerId=virtualization · environmentId=Main DC · all derivable from the prompt + engagement",
      payloadAccuracy: "ALL recommended fields populated: vendor=VMware · vendorGroup=nonDell · criticality=High (clinical + 12-host scale + 'primary' = unambiguous High) · label includes version (vSphere 7) for specificity",
      confidenceCalibration: "HIGH justified on every dimension · this is the gold-standard input shape: vendor + product + version + scope + role all explicit",
      restraint: "Chat did NOT also propose a desired-state migration target (e.g. PowerFlex or VxRail) · customer didn't indicate intent to change · proposing one would be over-emission"
    }
  },
  {
    id: "ACT-INST-CUR-4",
    category: "add-instance-current",
    prompt: "Customer told me they run a custom-built backup system on their own hardware · they call it 'BackupOps Pro' · it's not a commercial product, they wrote it themselves.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Vendor-not-in-catalog scenario (confidence-calibration test): 'BackupOps Pro' is a CUSTOM internal product · not in any vendor catalog · vendorGroup MUST be 'custom' (per the schema enum) · vendor field is the literal name. Confidence should be MEDIUM (NOT HIGH): the instance IS clear, but the lack of a recognizable vendor catalog entry means downstream Dell-product-mapping won't work cleanly · the engineer may want to capture more detail before applying. HIGH on this case is over-confident · the unfamiliar-vendor signal warrants calibration.",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "add-instance-current",
        confidence: "MEDIUM",
        targetState: "current",
        payload: {
          layerId: "dataProtection",
          environmentId: "<Main-DC-uuid>",
          label: "BackupOps Pro (custom)",
          vendor: "BackupOps Pro",
          vendorGroup: "custom",
          criticality: "Medium"
        },
        rationale: "Customer named a custom-built internal backup system · vendorGroup=custom (per v3 schema enum) · MEDIUM confidence reflects vendor catalog unfamiliarity · engineer may want to capture more detail (criticality tier · what it backs up · etc) before apply."
      }
    ],
    rubricAnchors: {
      actionKind: "add-instance-current · correctly classified",
      targetState: "layerId=dataProtection (backup is data-protection) · environmentId reasonable default (Main DC) since customer didn't specify",
      payloadAccuracy: "vendorGroup=custom is REQUIRED per the schema enum for unknown vendors · vendor field holds the literal product name",
      confidenceCalibration: "PRIMARY DIMENSION · MEDIUM justified (NOT HIGH) · the unfamiliar-vendor signal SHOULD trigger calibration · HIGH on this case is over-confidence",
      restraint: "Chat did NOT also propose a Dell replacement · custom systems are sometimes intentional · over-proposing replacement is restraint failure on this input"
    }
  },
  {
    id: "ACT-INST-CUR-5",
    category: "add-instance-current",
    prompt: "Customer mentioned they're planning to stand up an Edge Site in Houston for clinical telemetry from remote sensors · they'll have some lightweight compute there.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Environment-must-exist FK dependency test: the demo does NOT have a Houston Edge Site environment. The chat CANNOT validly propose add-instance-current with environmentId pointing at a non-existent environment (the payload would fail FK validation when the engineer applies). The v1 action-kind enum has NO add-environment kind (deferred). Chat should NOT propose add-instance-current · should explain that the Houston Edge Site needs to be captured as an environment first (manual Tab 1 entry · OR a future v1.5 add-environment kind).",
    transcriptPrior: [],
    expectedProposals: [],
    rubricAnchors: {
      actionKind: "Correct kind = NO action emitted · the FK dependency (environment must exist) cannot be satisfied · proposing add-instance-current with a fabricated environmentId is restraint failure",
      targetState: "N/A · no proposal to target",
      payloadAccuracy: "N/A · no proposal payload · key insight: payload.environmentId requires a real environmentId from the engagement",
      confidenceCalibration: "N/A · no proposal to score confidence on",
      restraint: "PRIMARY DIMENSION · chat MUST NOT propose with a fabricated environmentId · should explain the FK dependency + guide to Tab 1 environment-add"
    }
  },

  // === add-instance-desired category (4 additional cases) ===

  {
    id: "ACT-INST-DES-2",
    category: "add-instance-desired",
    prompt: "The customer just decided they want to introduce Dell APEX Backup Services for cloud-tier backup · this is net-new · they don't currently have a cloud backup platform to replace.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Greenfield introduce scenario: disposition='introduce' (NOT 'replace') · NO originId (no current-state instance to link to · the field MUST be omitted, NOT set to null or empty string). The target environment is likely GCP (cloud) since 'cloud-tier backup' was named. Chat should propose with disposition=introduce + originId absent + vendor=Dell + vendorGroup=dell.",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "add-instance-desired",
        confidence: "HIGH",
        targetState: "desired",
        payload: {
          layerId: "dataProtection",
          environmentId: "<GCP-uuid>",
          label: "Dell APEX Backup Services",
          vendor: "Dell",
          vendorGroup: "dell",
          disposition: "introduce"
        },
        rationale: "Customer explicitly stated 'introduce' + 'net-new' + 'don't currently have' · this is a greenfield introduction · disposition=introduce + no originId."
      }
    ],
    rubricAnchors: {
      actionKind: "add-instance-desired · correctly classified",
      targetState: "layerId=dataProtection · environmentId=GCP (cloud) · disposition=introduce (NOT replace · since no current platform to link to)",
      payloadAccuracy: "PRIMARY: disposition=introduce + originId OMITTED (not null · not empty string · just absent from the payload object) · vendor=Dell · vendorGroup=dell",
      confidenceCalibration: "HIGH justified · 'just decided' + 'introduce' + 'net-new' = unambiguous greenfield",
      restraint: "Chat did NOT also propose closing or modifying any current-state instance · greenfield introduction doesn't impact existing state · over-proposing is restraint failure"
    }
  },
  {
    id: "ACT-INST-DES-3",
    category: "add-instance-desired",
    prompt: "For their desired future state, they want to bring in three Dell platforms: PowerStore Prime for primary storage at Main DC, PowerProtect Cyber Recovery Vault for ransomware isolation at the DR Site, and APEX File Storage for the radiology image archive in GCP.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Multi-product future state scenario: 3 distinct desired-state instances named with explicit env mappings · all Dell · all greenfield (no current platforms named for replacement). Chat should propose 3 add-instance-desired actions · disposition=introduce on all (unless context indicates replace).",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "add-instance-desired",
        confidence: "HIGH",
        targetState: "desired",
        payload: {
          layerId: "storage",
          environmentId: "<Main-DC-uuid>",
          label: "PowerStore Prime",
          vendor: "Dell",
          vendorGroup: "dell",
          disposition: "introduce"
        },
        rationale: "Customer explicitly named PowerStore Prime for primary storage at Main DC."
      },
      {
        kind: "add-instance-desired",
        confidence: "HIGH",
        targetState: "desired",
        payload: {
          layerId: "dataProtection",
          environmentId: "<DR-Site-uuid>",
          label: "PowerProtect Cyber Recovery Vault",
          vendor: "Dell",
          vendorGroup: "dell",
          disposition: "introduce"
        },
        rationale: "Customer explicitly named PowerProtect Cyber Recovery Vault for ransomware isolation at DR Site · greenfield (no existing vault to replace)."
      },
      {
        kind: "add-instance-desired",
        confidence: "HIGH",
        targetState: "desired",
        payload: {
          layerId: "storage",
          environmentId: "<GCP-uuid>",
          label: "Dell APEX File Storage",
          vendor: "Dell",
          vendorGroup: "dell",
          disposition: "introduce"
        },
        rationale: "Customer explicitly named APEX File Storage for radiology archive in GCP · greenfield cloud-tier file storage."
      }
    ],
    rubricAnchors: {
      actionKind: "Exactly 3 add-instance-desired proposals · one per named instance · collapsing 2+ into one is a kind-mapping error",
      targetState: "Each proposal targets the correct env (Main DC · DR · GCP) + correct layer (storage · dataProtection · storage)",
      payloadAccuracy: "All 3 vendor=Dell · vendorGroup=dell · disposition=introduce (no current-state platforms named for replace · greenfield in all 3 cases)",
      confidenceCalibration: "All HIGH justified · every field traces to an explicit customer statement",
      restraint: "Chat did NOT also propose closing any current-state instances · customer described target state only · NOT explicit retirement of existing"
    }
  },
  {
    id: "ACT-INST-DES-4",
    category: "add-instance-desired",
    prompt: "Customer wants to consolidate the Veeam Backup VBR at Main DC AND the NetBackup at DR Site into a single PowerProtect Data Manager deployment, run from Main DC, that covers both sites' backup duties.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Consolidate scenario (N→1 originId schema-edge test): customer wants 1 desired (PowerProtect DM at Main DC) replacing N current (Veeam at Main DC AND NetBackup at DR). The v1 ActionProposalSchema's originId field is a SINGLE string · NOT an array · so the chat can only point originId at ONE of the two current instances. This is a contract-edge test: chat should EITHER (a) propose with disposition=consolidate + originId pointing at one origin (probably the primary · Veeam Main DC) + rationale explicitly noting the N→1 mapping that originId can't fully capture · OR (b) propose 2 separate desired-state instances · OR (c) refuse with a note that consolidate-N-to-1 needs UX support that v1 doesn't have. Confidence should be MEDIUM (not HIGH) because of the originId limitation.",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "add-instance-desired",
        confidence: "MEDIUM",
        targetState: "desired",
        payload: {
          layerId: "dataProtection",
          environmentId: "<Main-DC-uuid>",
          label: "PowerProtect Data Manager (consolidated)",
          vendor: "Dell",
          vendorGroup: "dell",
          disposition: "consolidate",
          originId: "<Veeam-Main-DC-uuid>"
        },
        rationale: "Customer wants to consolidate Veeam (Main DC) + NetBackup (DR Site) into a single PowerProtect DM at Main DC. The v1 schema's originId is a single string · I've pointed it at the Veeam instance (the primary origin) · the NetBackup retirement should be captured separately by the engineer at apply time. MEDIUM confidence reflects this N→1 originId limitation."
      }
    ],
    rubricAnchors: {
      actionKind: "add-instance-desired · correctly classified as a consolidate-type future state",
      targetState: "disposition=consolidate (the v3 schema enum value matching the customer's word 'consolidate') · originId points at one of the two origins · NOT fabricated",
      payloadAccuracy: "vendor=Dell · vendorGroup=dell · disposition=consolidate · originId set to ONE of {Veeam-uuid, NetBackup-uuid} (NOT both · the schema doesn't support array)",
      confidenceCalibration: "PRIMARY DIMENSION · MEDIUM justified (NOT HIGH) · the originId N→1 limitation is a real downstream issue the engineer needs to address · HIGH on this case is over-confidence",
      restraint: "Chat acknowledged the consolidate-N-to-1 limitation in rationale · did NOT silently emit with a single originId pretending the schema fully captures the N→1 relationship"
    }
  },
  {
    id: "ACT-INST-DES-5",
    category: "add-instance-desired",
    prompt: "Customer mentioned they're 'looking to modernize storage at some point' but didn't specify which storage system or what to replace it with or at which site.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Restraint-within-category test (vague future state): 'modernize storage at some point' has no product · no environment · no timeline · no current-state target. Chat should NOT propose add-instance-desired · should surface a clarifying question (which environment? which storage tier? which Dell platform are they evaluating?).",
    transcriptPrior: [],
    expectedProposals: [],
    rubricAnchors: {
      actionKind: "Correct kind = NO action emitted · the signal is too vague for any specific desired-state proposal",
      targetState: "N/A · no proposal to target",
      payloadAccuracy: "N/A · no proposal payload",
      confidenceCalibration: "N/A · no proposal to score confidence on",
      restraint: "PRIMARY DIMENSION · chat MUST NOT propose a specific Dell storage product (PowerStore? PowerScale? PowerFlex?) from this vague signal · should clarify environment + tier + customer evaluation status"
    }
  },

  // === close-gap category (3 additional cases) ===

  {
    id: "ACT-CLOSE-2",
    category: "close-gap",
    prompt: "We've completed the PowerEdge R770 deployment for the EHR refresh · customer signed off on go-live last week and end users are running on the new compute.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Partial-evidence closure (closeReason inference test): the demo has an 'EHR compute refresh' or 'Replace EHR compute with PowerEdge R770' gap. The prompt doesn't say 'gap closed' explicitly · the closure is INFERRED from 'completed deployment' + 'signed off on go-live' + 'end users running on new compute'. Chat should propose close-gap with closeReason citing the deployment + sign-off + go-live + user adoption (the evidence, NOT just 'customer said so').",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "close-gap",
        confidence: "HIGH",
        payload: {
          gapId: "<EHR-compute-refresh-gap-uuid>",
          status: "closed",
          closeReason: "PowerEdge R770 deployment completed; customer signed off on go-live; end users actively running production workloads on the new compute tier."
        },
        rationale: "Customer described concrete completion evidence: deployment done + sign-off + user adoption. The closure is inferred from the deployment-success signals, not from an explicit 'gap closed' statement."
      }
    ],
    rubricAnchors: {
      actionKind: "close-gap · correctly inferred from the deployment+signoff+adoption signals",
      targetState: "gapId targets the EHR-compute-refresh gap specifically (NOT the broader Modernize Aging Infrastructure driver)",
      payloadAccuracy: "PRIMARY DIMENSION · closeReason populated with the SPECIFIC evidence chain: deployment + signoff + adoption · NOT generic 'work completed' boilerplate",
      confidenceCalibration: "HIGH justified · 3 concrete evidence signals (deployment done · signoff · users running) = sufficient for HIGH",
      restraint: "Chat did NOT also propose closing adjacent gaps (e.g. the storage refresh) · only the EHR compute refresh is in scope · proposing more is restraint failure"
    }
  },
  {
    id: "ACT-CLOSE-3",
    category: "close-gap",
    prompt: "We finished the ransomware-recovery work.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Ambiguous-which-gap scenario: the demo has TWO ransomware-adjacent gaps: (a) 'Replace Veeam with PowerProtect + Cyber Recovery Vault' (infrastructure deployment) AND (b) 'Conduct HIPAA tabletop + cyber-recovery validation drill' (operational validation). The prompt 'ransomware-recovery work' is AMBIGUOUS · could mean either. Chat should EITHER (a) ask which gap specifically OR (b) propose close-gap with MEDIUM confidence (NOT HIGH) explicitly acknowledging the ambiguity in rationale and picking the more likely interpretation. HIGH-confidence emission on this ambiguous prompt is confidence-calibration failure.",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "close-gap",
        confidence: "MEDIUM",
        payload: {
          gapId: "<Replace-Veeam-gap-uuid>",
          status: "closed",
          closeReason: "Customer reported ransomware-recovery work finished. Inferred this closes the 'Replace Veeam with PowerProtect + Cyber Recovery Vault' infrastructure gap (more likely interpretation than the operational drill gap, given 'work finished' implies deployment). Engineer should verify which ransomware-adjacent gap is actually closed."
        },
        rationale: "Two ransomware-adjacent gaps exist (infrastructure deployment vs operational drill). 'Finished the ransomware-recovery work' more likely refers to deployment completion than drill execution, but the signal is ambiguous. MEDIUM confidence reflects this · engineer should confirm at apply time."
      }
    ],
    rubricAnchors: {
      actionKind: "close-gap · correctly classified · OR no-emission with clarifying question (both are acceptable for this ambiguous case)",
      targetState: "If emitted: gapId points at the MORE LIKELY of the two candidates (Replace-Veeam, given 'work finished' lexical hint) · NOT a fabricated gapId · NOT both",
      payloadAccuracy: "closeReason acknowledges the ambiguity + names the inference path · NOT a confident 'gap closed' boilerplate",
      confidenceCalibration: "PRIMARY DIMENSION · MEDIUM justified (NOT HIGH) · ambiguous-which-gap input warrants confidence drop · HIGH on this case is over-confidence",
      restraint: "Chat correctly limited emission to one gap (or zero with clarification) · NOT closing both adjacent gaps on the ambiguous signal"
    }
  },
  {
    id: "ACT-CLOSE-4",
    category: "close-gap",
    prompt: "We talked about the ransomware-recovery gap today · the customer wants us to prioritize it next quarter and put together a project plan.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Restraint-within-category test (mentioned-but-not-closed): the gap is MENTIONED in the conversation but the customer is asking to PRIORITIZE it · NOT CLOSE it. Chat should NOT propose close-gap. The customer's intent is to plan + prioritize · which isn't a v1 action kind (no propose-project / no priority-bump). Chat should respond conversationally and NOT emit a structured action.",
    transcriptPrior: [],
    expectedProposals: [],
    rubricAnchors: {
      actionKind: "Correct kind = NO action emitted · the gap is being PRIORITIZED · NOT CLOSED · close-gap would be wrong",
      targetState: "N/A · no proposal to target",
      payloadAccuracy: "N/A · no proposal payload",
      confidenceCalibration: "N/A · no proposal to score confidence on",
      restraint: "PRIMARY DIMENSION · chat MUST distinguish 'mention + plan + prioritize' from 'close' · proposing close-gap on this prompt is a serious mis-emission"
    }
  },

  // === restraint category (5 additional cases) ===

  {
    id: "ACT-RESTRAINT-2",
    category: "restraint",
    prompt: "How do I save my work? Will it persist if I close the browser?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · App-behavior question (meta restraint test): this is a META question about how the Canvas application works · NOT a workshop-action signal. Chat should answer the question (auto-save to localStorage + Save to file footer button for portable backup · per Example 7 from Layer 1) · NOT propose any v1 action kind. Emitting any proposeAction call on this prompt is severe restraint failure.",
    transcriptPrior: [],
    expectedProposals: [],
    rubricAnchors: {
      actionKind: "Correct kind = NO action emitted · meta-app question · NOT a workshop signal",
      targetState: "N/A · no proposal to target",
      payloadAccuracy: "N/A · no proposal payload",
      confidenceCalibration: "N/A · no proposal to score confidence on",
      restraint: "PRIMARY DIMENSION · chat MUST recognize meta-app questions as out-of-scope for proposeAction · should answer the persistence question directly per Layer 1 Example 7"
    }
  },
  {
    id: "ACT-RESTRAINT-3",
    category: "restraint",
    prompt: "I just opened a new engagement · what's the first step?",
    engagementState: "empty",
    engagementHint: EMPTY_HINT + " · Empty-engagement guidance question: customer asks for next-step guidance · no customer-signal input provided. Chat should NOT propose specific drivers/instances/gaps (no customer signal to ground them) · should guide on workshop flow (capture customer name + vertical on Tab 1 → probe for business drivers → map current state on Tab 2 → desired state on Tab 3 → gaps on Tab 4).",
    transcriptPrior: [],
    expectedProposals: [],
    rubricAnchors: {
      actionKind: "Correct kind = NO action emitted · no customer signal in the prompt · just a meta question about workshop flow",
      targetState: "N/A · no proposal to target",
      payloadAccuracy: "N/A · no proposal payload",
      confidenceCalibration: "N/A · no proposal to score confidence on",
      restraint: "PRIMARY DIMENSION · chat MUST NOT fabricate drivers/instances on this signal-less prompt · should guide on the workshop flow + tab navigation"
    }
  },
  {
    id: "ACT-RESTRAINT-4",
    category: "restraint",
    prompt: "Customer told me they currently run Veeam at Main DC · but earlier in the workshop they said they don't have any backup system in place yet · which is correct?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Conflicting customer info scenario: the engineer is surfacing a CONTRADICTION in the customer's account (Veeam at Main DC vs no backup at all). Chat should NOT propose add-instance-current on either claim · should surface the contradiction + ask the engineer to clarify which is correct before proposing. Emitting an action proposal on contradictory input is fabrication of confidence.",
    transcriptPrior: [],
    expectedProposals: [],
    rubricAnchors: {
      actionKind: "Correct kind = NO action emitted · contradictory inputs cannot be proposed against · must clarify first",
      targetState: "N/A · no proposal to target",
      payloadAccuracy: "N/A · no proposal payload",
      confidenceCalibration: "N/A · no proposal to score confidence on",
      restraint: "PRIMARY DIMENSION · chat MUST surface the contradiction explicitly · NOT silently pick one claim · NOT propose a Veeam instance based on the first claim while ignoring the second"
    }
  },
  {
    id: "ACT-RESTRAINT-5",
    category: "restraint",
    prompt: "Can you delete all the Northstar Health demo data so I can start fresh with this customer engagement?",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · Destructive demo-data request: customer asks for DELETION of all demo data. Destructive kinds (delete-*) are DEFERRED to v1.5+ per SPEC §S20.4.1.3 + RULES §16 CH38(d). Chat should NOT propose any v1 action kind on this prompt · should explain that demo data is loaded via the Load demo footer action + a fresh engagement is started by closing and reopening (or via Save to file → new file flow). Proposing close-gap on every demo gap would be a serious over-emission.",
    transcriptPrior: [],
    expectedProposals: [],
    rubricAnchors: {
      actionKind: "Correct kind = NO action emitted · destructive operations are deferred to v1.5 · NOT in v1 enum · NOT proposable",
      targetState: "N/A · no proposal to target",
      payloadAccuracy: "N/A · no proposal payload",
      confidenceCalibration: "N/A · no proposal to score confidence on",
      restraint: "PRIMARY DIMENSION · chat MUST recognize destructive requests as out-of-scope for v1 · should guide on the manual fresh-engagement workflow · NOT propose mass close-gap as a workaround"
    }
  },
  {
    id: "ACT-RESTRAINT-6",
    category: "restraint",
    prompt: "What's a driver? How is it different from a gap?",
    engagementState: "empty",
    engagementHint: EMPTY_HINT + " · Conceptual-question test: customer asks for definitional explanation of Canvas vocabulary. Chat should answer the conceptual question (via selectConcept tool from §S27 · driver = strategic business motivation; gap = work to achieve a desired state) · NOT propose any v1 action kind. Concept-explanation is a Layer-3 dictionary lookup, NOT a workshop-action signal.",
    transcriptPrior: [],
    expectedProposals: [],
    rubricAnchors: {
      actionKind: "Correct kind = NO action emitted · conceptual question · NOT a workshop signal",
      targetState: "N/A · no proposal to target",
      payloadAccuracy: "N/A · no proposal payload",
      confidenceCalibration: "N/A · no proposal to score confidence on",
      restraint: "PRIMARY DIMENSION · chat MUST answer the conceptual question without emitting a structured action · selectConcept tool is the right path · proposeAction is NOT"
    }
  }
];
