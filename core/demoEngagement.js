// core/demoEngagement.js
//
// SPEC §S21 · v3-native demo engagement. Hand-curated, schema-strict
// engagement that bypasses the v2 → v3 bridge entirely for the demo
// case (architectural fix for BUG-003 + BUG-004, replacing the
// reverted bridge-widening patch at commit `7dbb7ad`).
//
// ALL ids are deterministic UUIDs (hand-coded, not random). The
// content is a small healthcare-org engagement chosen to highlight v3
// features in a single glance:
//   - 2 drivers (cyber resilience + AI/data)
//   - 2 environments (Riyadh DC on-prem + AWS me-south-1 public cloud)
//   - 6 instances spanning 4 layers + 2 vendor groups + 2 envs,
//     including a workload with `mappedAssetIds` referencing assets
//     in the OTHER environment (cross-cutting per S3.7) and a
//     desired instance with `originId` referencing a current
//     (replace-lifecycle).
//   - 4 gaps demonstrating: ops with services[], multi-env affected
//     environments, AI-authored field with a full §S8 provenance
//     wrapper.
//
// Module-load contract (per SPEC §S21 R21.2): the EngagementSchema.parse
// call at the bottom of this file runs at import time. If the demo
// drifts out of compliance, the module throws and the build fails
// loudly. NOT a runtime hope — a build-time guarantee.
//
// Forbidden (per RULES §17 / SPEC §S23):
//   - importing from tests/
//   - non-deterministic UUIDs (no crypto.randomUUID at module load)
//   - reading from state/sessionStore.js (the demo is a constant)
//   - mutating the cached engagement after it's returned
//
// Authority: docs/v3.0/SPEC.md §S21 · docs/v3.0/TESTS.md §T21 V-DEMO-1..7 ·
//            docs/RULES.md §17.

import { EngagementSchema, EngagementMetaSchema } from "../schema/engagement.js";
import { createEmptyCustomer }    from "../schema/customer.js";
import { createEmptyDriver }      from "../schema/driver.js";
import { createEmptyEnvironment } from "../schema/environment.js";
import { createEmptyInstance }    from "../schema/instance.js";
import { createEmptyGap }         from "../schema/gap.js";

// ─── Deterministic UUIDs ─────────────────────────────────────────────
//
// Format: 00000000-0000-4000-8000-XXXXYYYYYYYY
//         XXXX = entity-kind tag (engagement=0001, driver=00d1,
//                env=00e1, instance=00f1, gap=00a1)
//         YYYYYYYY = sequence within kind
// Valid UUID v4 with deterministic content. Easy to grep.

const ENGAGEMENT_ID = "00000000-0000-4000-8000-000100000001";

const DRIVER_CYBER_ID = "00000000-0000-4000-8000-00d100000001";
const DRIVER_AI_ID    = "00000000-0000-4000-8000-00d100000002";

const ENV_CORE_ID  = "00000000-0000-4000-8000-00e100000001";
const ENV_CLOUD_ID = "00000000-0000-4000-8000-00e100000002";

const INST_EMR_ID         = "00000000-0000-4000-8000-00f100000001";   // workload (current, coreDc)
const INST_POWEREDGE_ID   = "00000000-0000-4000-8000-00f100000002";   // compute (current, coreDc)
const INST_UNITY_ID       = "00000000-0000-4000-8000-00f100000003";   // storage (current, coreDc)
const INST_VEEAM_ID       = "00000000-0000-4000-8000-00f100000004";   // dataProtection (current, coreDc)
const INST_AWS_ID         = "00000000-0000-4000-8000-00f100000005";   // compute (current, publicCloud)
const INST_POWERSTORE_ID  = "00000000-0000-4000-8000-00f100000006";   // storage (desired, coreDc) - replaces UNITY

const GAP_BACKUP_ID       = "00000000-0000-4000-8000-00a100000001";
const GAP_STORAGE_ID      = "00000000-0000-4000-8000-00a100000002";
const GAP_DR_AI_ID        = "00000000-0000-4000-8000-00a100000003";
const GAP_NETWORK_ID      = "00000000-0000-4000-8000-00a100000004";

const CATALOG_VERSION = "2026.04";
const TS              = "2026-05-02T00:00:00.000Z";   // deterministic timestamp for the demo

// ─── Build the engagement (executes once at module load) ─────────────

function buildDemoEngagement() {
  // Cross-cutting helper: every entity gets these 4 fields.
  const cc = (id) => ({
    id,
    engagementId: ENGAGEMENT_ID,
    createdAt:    TS,
    updatedAt:    TS
  });

  const meta = EngagementMetaSchema.parse({
    engagementId:   ENGAGEMENT_ID,
    schemaVersion:  "3.0",
    isDemo:         true,
    ownerId:        "local-user",
    presalesOwner:  "Dell Discovery Demo",
    engagementDate: "2026-05-02",
    status:         "Draft",
    createdAt:      TS,
    updatedAt:      TS
  });

  const customer = createEmptyCustomer({
    engagementId: ENGAGEMENT_ID,
    name:         "Acme Healthcare Group",
    vertical:     "Healthcare",
    region:       "EMEA",
    notes:        "Healthcare org evaluating consolidated infrastructure with cyber-resilience focus. Demo engagement showcasing v3 features end-to-end."
  });

  // ─── Drivers ─────────────────────────────────────────────────────
  const driverCyber = createEmptyDriver({
    ...cc(DRIVER_CYBER_ID),
    businessDriverId: "cyber_resilience",
    catalogVersion:   CATALOG_VERSION,
    priority:         "High",
    outcomes:         "• Achieve full ransomware recovery + NIS2 compliance by Q3 2026.\n• Air-gapped immutable backups for tier-1 systems, tested quarterly.\n• Recovery time objective ≤ 4 hours for clinical-critical applications."
  });
  const driverAI = createEmptyDriver({
    ...cc(DRIVER_AI_ID),
    businessDriverId: "ai_data",
    catalogVersion:   CATALOG_VERSION,
    priority:         "Medium",
    outcomes:         "• Stand up a clinical-analytics AI platform integrated with the EMR.\n• Quantify reduction in re-admission risk via ML scoring within 12 months."
  });

  // ─── Environments ────────────────────────────────────────────────
  const envCore = createEmptyEnvironment({
    ...cc(ENV_CORE_ID),
    envCatalogId:   "coreDc",
    catalogVersion: CATALOG_VERSION,
    alias:          "Riyadh DC",
    location:       "Riyadh, KSA",
    sizeKw:         5,
    sqm:            320,
    tier:           "Tier III",
    notes:          "Primary on-prem site; hosts core EMR, compute, and storage."
  });
  const envCloud = createEmptyEnvironment({
    ...cc(ENV_CLOUD_ID),
    envCatalogId:   "publicCloud",
    catalogVersion: CATALOG_VERSION,
    alias:          "AWS me-south-1",
    location:       "Bahrain (AWS Middle East region)",
    sizeKw:         null,
    sqm:            null,
    tier:           null,
    notes:          "Public cloud footprint for AI/ML analytics workloads."
  });

  // ─── Instances ────────────────────────────────────────────────────
  // Workload at coreDc that maps cross-environment to a publicCloud
  // compute asset (cross-cutting per S3.7 + V-DEMO-4).
  const instEMR = createEmptyInstance({
    ...cc(INST_EMR_ID),
    state:          "current",
    layerId:        "workload",
    environmentId:  ENV_CORE_ID,
    label:          "Core EMR (electronic medical record)",
    vendor:         "Epic / Custom integration layer",
    vendorGroup:    "custom",
    criticality:    "High",
    disposition:    "keep",
    notes:          "Primary clinical system; HA-clustered. Touches both core DC compute + cloud analytics nodes for read-only reporting.",
    mappedAssetIds: [INST_POWEREDGE_ID, INST_UNITY_ID, INST_AWS_ID]   // INST_AWS_ID lives in publicCloud → cross-env
  });
  const instPowerEdge = createEmptyInstance({
    ...cc(INST_POWEREDGE_ID),
    state:         "current",
    layerId:       "compute",
    environmentId: ENV_CORE_ID,
    label:         "PowerEdge R760 cluster (4 nodes)",
    vendor:        "Dell PowerEdge",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "keep",
    notes:         "Hosts EMR DB + app tier."
  });
  const instUnity = createEmptyInstance({
    ...cc(INST_UNITY_ID),
    state:         "current",
    layerId:       "storage",
    environmentId: ENV_CORE_ID,
    label:         "Unity XT 480F",
    vendor:        "Dell Unity XT",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "replace",
    notes:         "At 90% capacity; performance degrading on EMR workload."
  });
  const instVeeam = createEmptyInstance({
    ...cc(INST_VEEAM_ID),
    state:         "current",
    layerId:       "dataProtection",
    environmentId: ENV_CORE_ID,
    label:         "Veeam Backup & Replication",
    vendor:        "Veeam",
    vendorGroup:   "nonDell",
    criticality:   "High",
    disposition:   "replace",
    notes:         "No immutable / air-gapped tier; full ransomware exposure."
  });
  const instAws = createEmptyInstance({
    ...cc(INST_AWS_ID),
    state:         "current",
    layerId:       "compute",
    environmentId: ENV_CLOUD_ID,
    label:         "AWS EC2 m6i analytics nodes",
    vendor:        "Amazon EC2",
    vendorGroup:   "nonDell",
    criticality:   "Medium",
    disposition:   "keep",
    notes:         "Analytics-side compute for clinical reporting; consumes EMR read replicas."
  });
  // Desired instance with originId referencing a current — replace lifecycle.
  const instPowerStore = createEmptyInstance({
    ...cc(INST_POWERSTORE_ID),
    state:         "desired",
    layerId:       "storage",
    environmentId: ENV_CORE_ID,
    label:         "PowerStore 5000T",
    vendor:        "Dell PowerStore",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "replace",
    priority:      "Now",
    originId:      INST_UNITY_ID,                        // replace lifecycle (V-DEMO-4)
    notes:         "Replaces Unity XT 480F. NVMe + native immutable snapshots align with cyber-resilience driver."
  });

  // ─── Gaps ────────────────────────────────────────────────────────
  // Gap 1: ops gap with services[] AND aiMappedDellSolutions provenance
  // wrapper (V-DEMO-5 ops requirement + V-DEMO-6 provenance demo).
  const gapBackup = createEmptyGap({
    ...cc(GAP_BACKUP_ID),
    description:               "No immutable backup tier; full ransomware exposure on tier-1 EMR data.",
    gapType:                   "ops",
    urgency:                   "High",
    phase:                     "now",
    status:                    "open",
    layerId:                   "dataProtection",
    affectedLayers:            ["dataProtection"],
    affectedEnvironments:      [ENV_CORE_ID],
    relatedCurrentInstanceIds: [INST_VEEAM_ID],
    relatedDesiredInstanceIds: [],
    services:                  ["resilience_review", "backup_modernization"],
    driverId:                  DRIVER_CYBER_ID,
    notes:                     "Owner-flagged. NIS2 explicitly requires immutable + air-gapped recovery tier.",
    aiMappedDellSolutions: {
      value: {
        rawLegacy: "PowerProtect Data Manager + PowerProtect Cyber Recovery (vault).",
        products:  ["powerprotect-data-manager", "powerprotect-cyber-recovery"]
      },
      provenance: {
        model:            "claude-3-5-sonnet",
        promptVersion:    "skill:dell-mapping@1.0.0",
        skillId:          "dell-mapping",
        runId:            "v3-demo-run-gap-backup-001",
        timestamp:        TS,
        catalogVersions:  { "DELL_PRODUCT_TAXONOMY": CATALOG_VERSION },
        validationStatus: "valid"
      }
    }
  });
  // Gap 2: replace gap with current + desired link (replace lifecycle).
  const gapStorage = createEmptyGap({
    ...cc(GAP_STORAGE_ID),
    description:               "Unity XT 480F at 90% capacity; performance degrading. PowerStore 5000T replacement scoped.",
    gapType:                   "replace",
    urgency:                   "High",
    phase:                     "now",
    status:                    "open",
    layerId:                   "storage",
    affectedLayers:            ["storage"],
    affectedEnvironments:      [ENV_CORE_ID],
    relatedCurrentInstanceIds: [INST_UNITY_ID],
    relatedDesiredInstanceIds: [INST_POWERSTORE_ID],
    services:                  [],
    driverId:                  null
  });
  // Gap 3: introduce gap, multi-env affectedEnvironments (V-DEMO-5 multi-env).
  const gapDrAi = createEmptyGap({
    ...cc(GAP_DR_AI_ID),
    description:               "Cross-region DR coverage missing for AI workload; analytics-side has no failover path.",
    gapType:                   "introduce",
    urgency:                   "Medium",
    phase:                     "next",
    status:                    "open",
    layerId:                   "workload",
    affectedLayers:            ["workload"],
    affectedEnvironments:      [ENV_CORE_ID, ENV_CLOUD_ID],   // multi-env (V-DEMO-5)
    services:                  ["dr_assessment"],
    driverId:                  DRIVER_AI_ID
  });
  // Gap 4: enhance gap, infrastructure layer.
  const gapNetwork = createEmptyGap({
    ...cc(GAP_NETWORK_ID),
    description:               "Network segmentation needs micro-services upgrade for EMR. Hospital-wide flat VLAN is a compliance liability.",
    gapType:                   "enhance",
    urgency:                   "Medium",
    phase:                     "later",
    status:                    "open",
    layerId:                   "infrastructure",
    affectedLayers:            ["infrastructure"],
    affectedEnvironments:      [ENV_CORE_ID],
    services:                  ["network_design_assessment"]
  });

  // ─── Compose collections ─────────────────────────────────────────
  const driversAllIds = [DRIVER_CYBER_ID, DRIVER_AI_ID];
  const envsAllIds    = [ENV_CORE_ID, ENV_CLOUD_ID];
  const instAllIds    = [INST_EMR_ID, INST_POWEREDGE_ID, INST_UNITY_ID, INST_VEEAM_ID, INST_AWS_ID, INST_POWERSTORE_ID];
  const gapsAllIds    = [GAP_BACKUP_ID, GAP_STORAGE_ID, GAP_DR_AI_ID, GAP_NETWORK_ID];

  const instCurrentIds = instAllIds.filter(id => {
    const i = [instEMR, instPowerEdge, instUnity, instVeeam, instAws, instPowerStore].find(x => x.id === id);
    return i.state === "current";
  });
  const instDesiredIds = instAllIds.filter(id => {
    const i = [instEMR, instPowerEdge, instUnity, instVeeam, instAws, instPowerStore].find(x => x.id === id);
    return i.state === "desired";
  });

  return {
    meta,
    customer,
    drivers: {
      byId: {
        [DRIVER_CYBER_ID]: driverCyber,
        [DRIVER_AI_ID]:    driverAI
      },
      allIds: driversAllIds
    },
    environments: {
      byId: {
        [ENV_CORE_ID]:  envCore,
        [ENV_CLOUD_ID]: envCloud
      },
      allIds: envsAllIds
    },
    instances: {
      byId: {
        [INST_EMR_ID]:        instEMR,
        [INST_POWEREDGE_ID]:  instPowerEdge,
        [INST_UNITY_ID]:      instUnity,
        [INST_VEEAM_ID]:      instVeeam,
        [INST_AWS_ID]:        instAws,
        [INST_POWERSTORE_ID]: instPowerStore
      },
      allIds: instAllIds,
      byState: {
        current: instCurrentIds,
        desired: instDesiredIds
      }
    },
    gaps: {
      byId: {
        [GAP_BACKUP_ID]:  gapBackup,
        [GAP_STORAGE_ID]: gapStorage,
        [GAP_DR_AI_ID]:   gapDrAi,
        [GAP_NETWORK_ID]: gapNetwork
      },
      allIds: gapsAllIds
    },
    activeEntity: null,
    integrityLog: []
  };
}

// ─── Module-load build + strict validation ───────────────────────────
//
// SPEC §S21 R21.2 build-time guarantee: any drift in this file fails
// the import. The test runner won't even load if the demo is invalid.
const _DEMO_ENGAGEMENT = EngagementSchema.parse(buildDemoEngagement());

// ─── Public API ──────────────────────────────────────────────────────

export function loadDemo() {
  return _DEMO_ENGAGEMENT;
}

export function describeDemo() {
  const e = _DEMO_ENGAGEMENT;
  return {
    customerName: e.customer.name,
    vertical:     e.customer.vertical,
    region:       e.customer.region,
    counts: {
      drivers:      e.drivers.allIds.length,
      environments: e.environments.allIds.length,
      instances:    e.instances.allIds.length,
      gaps:         e.gaps.allIds.length
    }
  };
}
