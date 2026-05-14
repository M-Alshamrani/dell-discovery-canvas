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
    prompt: "Customer just told me they currently run Veeam Backup VBR in their Main Data Center for tier-1 backup. The Veeam appliance is on-prem and does not have an air-gap.",
    engagementState: "demo:northstar-health",
    engagementHint: NORTHSTAR_HINT + " · The demo has Main Data Center environment but no Veeam instance yet. The chat should propose adding Veeam Backup VBR as a current-state instance in the data-protection layer + Main DC environment.",
    transcriptPrior: [],
    expectedProposals: [
      {
        kind: "add-instance-current",
        confidence: "HIGH",
        targetState: "current",
        payload: {
          layerId: "dataProtection",
          environmentId: "<Main-DC-uuid-from-engagement>",
          label: "Veeam Backup VBR",
          vendor: "Veeam",
          vendorGroup: "nonDell",
          criticality: "High"
        },
        rationale: "Customer explicitly named Veeam Backup VBR as their current tier-1 backup in the Main Data Center; tier-1 + no air-gap indicates High criticality."
      }
    ],
    rubricAnchors: {
      actionKind: "add-instance-current is correct (customer described EXISTING infrastructure, not desired)",
      targetState: "layerId=dataProtection (backup is data protection layer) · environmentId=Main Data Center (explicit customer mention)",
      payloadAccuracy: "vendor=Veeam (named) · vendorGroup=nonDell (Veeam is not Dell) · criticality=High (tier-1 + no air-gap)",
      confidenceCalibration: "HIGH justified · every field traces to a customer statement",
      restraint: "Chat did NOT also propose a desired-state replacement (correct · customer described what they HAVE, not what they want)"
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
  }
];
