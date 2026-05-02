// core/demoEngagement.js
//
// SPEC §S21 · v3-native demo engagement. Hand-curated, schema-strict
// engagement designed for executive narrative + full app-feature
// coverage. Constructed entirely through real schemas + factories;
// NO fixtures, NO mocks, NO hardcoded outputs. The matrix view, gaps
// kanban, vendor mix, health summary, executive summary, linked
// composition, and projects selectors all read this engagement
// through their normal code paths and produce rich answers.
//
// ALL ids are deterministic UUIDs (hand-coded, not random) so test
// vectors stay stable and the demo is deeply diff-able.
//
// ─── Narrative ──────────────────────────────────────────────────────
// Customer: Acme Healthcare Group (multi-site healthcare provider,
//           ~30K employees, 200 hospital sites, regulated environment).
// 3 strategic drivers, each woven into the gap → solution narrative:
//   1. Cyber Resilience (High) — survive ransomware without downtime.
//      → PPDM cyber-vault + isolated recovery zone + immutable backups.
//   2. AI & Data Platforms (High) — AI-native operating model in 18mo.
//      → PowerScale F710 unstructured + PowerEdge XE9680 GPU + CloudIQ.
//   3. Compliance & Sovereignty (Medium) — PDNS-compliant infra.
//      → APEX Cloud Services on sovereignCloud + PowerProtect Vault.
//
// 4 environments: Riyadh Core DC / Jeddah DR / 200 hospital Edge sites
//                 / Sovereign Cloud (me-central-1).
//
// 14 current instances (4 workloads + 4 compute + 3 storage + 2 data
// protection + 1 infrastructure) and 9 desired instances. Mix of Dell
// + non-Dell + custom vendor groups so the vendor-mix selector tells
// a story (current ≈ 50% Dell density → desired ≈ 95% Dell density).
//
// 8 gaps covering all 5 gap types (replace × 3, introduce × 2,
// consolidate × 1, ops × 1, enhance × 1) and all 3 drivers. Multi-env
// affectedEnvironments + cross-instance relations exercised. One gap
// carries a §S8 provenance-wrapped aiMappedDellSolutions to demo the
// AI-authored field rendering.
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
// Authority: docs/v3.0/SPEC.md §S21 · docs/v3.0/TESTS.md §T21 V-DEMO-1..9 ·
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
//   XXXX tags entity kind (engagement=0001, driver=00d1, env=00e1,
//   instance=00f1, gap=00a1). YYYYYYYY is sequence within kind.
// Valid UUID v4. Easy to grep.

const ENGAGEMENT_ID = "00000000-0000-4000-8000-000100000001";

// Drivers
const DRIVER_CYBER_ID      = "00000000-0000-4000-8000-00d100000001";
const DRIVER_AI_ID         = "00000000-0000-4000-8000-00d100000002";
const DRIVER_SOVEREIGN_ID  = "00000000-0000-4000-8000-00d100000003";

// Environments
const ENV_CORE_ID      = "00000000-0000-4000-8000-00e100000001";   // Riyadh Core DC
const ENV_DR_ID        = "00000000-0000-4000-8000-00e100000002";   // Jeddah DR
const ENV_EDGE_ID      = "00000000-0000-4000-8000-00e100000003";   // Hospital edge sites
const ENV_SOVEREIGN_ID = "00000000-0000-4000-8000-00e100000004";   // Sovereign Cloud me-central-1

// Current-state instances
const I_EMR_ID            = "00000000-0000-4000-8000-00f100000001";  // workload (EMR, coreDc)
const I_PACS_ID           = "00000000-0000-4000-8000-00f100000002";  // workload (PACS imaging, coreDc)
const I_ANALYTICS_ID      = "00000000-0000-4000-8000-00f100000003";  // workload (analytics, sovereignCloud)
const I_PATIENT_PORTAL_ID = "00000000-0000-4000-8000-00f100000004";  // workload (patient check-in, edge)

const I_R740_CORE_ID    = "00000000-0000-4000-8000-00f100000005";  // compute (PowerEdge R740, coreDc)
const I_R740_DR_ID      = "00000000-0000-4000-8000-00f100000006";  // compute (PowerEdge R740, drDc)
const I_CISCO_UCS_ID    = "00000000-0000-4000-8000-00f100000007";  // compute (Cisco UCS, coreDc)
const I_VXRAIL_EDGE_ID  = "00000000-0000-4000-8000-00f100000008";  // compute (VxRail, edge)

const I_UNITY_ID        = "00000000-0000-4000-8000-00f100000009";  // storage (Dell Unity XT, coreDc)
const I_NETAPP_ID       = "00000000-0000-4000-8000-00f10000000a";  // storage (NetApp AFF, coreDc)
const I_AWS_S3_ID       = "00000000-0000-4000-8000-00f10000000b";  // storage (AWS S3, sovereignCloud)

const I_VEEAM_ID        = "00000000-0000-4000-8000-00f10000000c";  // dataProtection (Veeam, coreDc)
const I_COMMVAULT_ID    = "00000000-0000-4000-8000-00f10000000d";  // dataProtection (Commvault, coreDc)

const I_CISCO_NET_ID    = "00000000-0000-4000-8000-00f10000000e";  // infrastructure (Cisco Catalyst flat VLAN, coreDc)

// Desired-state instances
const D_R760_ID         = "00000000-0000-4000-8000-00f100000101";  // compute (PowerEdge R760, coreDc)
const D_XE9680_ID       = "00000000-0000-4000-8000-00f100000102";  // compute (PowerEdge XE9680 GPU, coreDc)

const D_POWERSTORE_ID   = "00000000-0000-4000-8000-00f100000103";  // storage (PowerStore 5000T, coreDc)
const D_POWERSCALE_ID   = "00000000-0000-4000-8000-00f100000104";  // storage (PowerScale F710, coreDc)

const D_PPDM_ID         = "00000000-0000-4000-8000-00f100000105";  // dataProtection (PowerProtect Data Manager, coreDc)
const D_PPCR_VAULT_ID   = "00000000-0000-4000-8000-00f100000106";  // dataProtection (PowerProtect Cyber Recovery vault, drDc)

const D_POWERSWITCH_ID  = "00000000-0000-4000-8000-00f100000107";  // infrastructure (PowerSwitch + SmartFabric, coreDc)

const D_APEX_CLOUD_ID   = "00000000-0000-4000-8000-00f100000108";  // compute (APEX Cloud Services, sovereignCloud)
const D_CLOUDIQ_ID      = "00000000-0000-4000-8000-00f100000109";  // infrastructure (CloudIQ + APEX AIOps, coreDc)

// Gaps
const GAP_PPDM_REPLACE_ID    = "00000000-0000-4000-8000-00a100000001";   // Cyber, replace, now
const GAP_CYBER_VAULT_ID     = "00000000-0000-4000-8000-00a100000002";   // Cyber, introduce, next
const GAP_POWERSCALE_ID      = "00000000-0000-4000-8000-00a100000003";   // AI, replace, next
const GAP_GPU_INFERENCE_ID   = "00000000-0000-4000-8000-00a100000004";   // AI, introduce, next
const GAP_AIOPS_ID           = "00000000-0000-4000-8000-00a100000005";   // AI, ops, later
const GAP_SOVEREIGN_LIFT_ID  = "00000000-0000-4000-8000-00a100000006";   // Sovereign, replace, next
const GAP_COMPUTE_CONSOL_ID  = "00000000-0000-4000-8000-00a100000007";   // Sovereign, consolidate, now
const GAP_NET_SEGMENT_ID     = "00000000-0000-4000-8000-00a100000008";   // (no driver), enhance, later

const CATALOG_VERSION = "2026.04";
const TS              = "2026-05-02T00:00:00.000Z";

// ─── Build the engagement (executes once at module load) ─────────────

function buildDemoEngagement() {
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
    notes:        "Multi-site healthcare provider; 30K employees across 200 hospital sites; KSA-regulated. Demo engagement showcasing the v3 data model + AI assistant end-to-end against three strategic drivers."
  });

  // ─── Drivers ─────────────────────────────────────────────────────
  const driverCyber = createEmptyDriver({
    ...cc(DRIVER_CYBER_ID),
    businessDriverId: "cyber_resilience",
    catalogVersion:   CATALOG_VERSION,
    priority:         "High",
    outcomes:         "• Survive a ransomware event without business interruption.\n• Air-gapped immutable backups for tier-1 systems, tested quarterly.\n• Recovery time objective <= 4 hours for clinical-critical applications.\n• NIS2 compliance evidence ready by Q3 2026."
  });
  const driverAI = createEmptyDriver({
    ...cc(DRIVER_AI_ID),
    businessDriverId: "ai_data",
    catalogVersion:   CATALOG_VERSION,
    priority:         "High",
    outcomes:         "• Become an AI-native operating model in 18 months.\n• Stand up clinical-imaging AI inference pipeline (PACS + CV models).\n• Quantify reduction in re-admission risk via ML scoring within 12 months.\n• Unstructured data tier sized for 4 years of imaging growth."
  });
  const driverSovereign = createEmptyDriver({
    ...cc(DRIVER_SOVEREIGN_ID),
    businessDriverId: "compliance_sovereignty",
    catalogVersion:   CATALOG_VERSION,
    priority:         "Medium",
    outcomes:         "• Land all regulated workloads on PDNS-compliant infrastructure.\n• Eliminate AWS dependency for patient-data processing by Q4 2026.\n• Maintain a sovereign-cloud copy of critical data with verified residency."
  });

  // ─── Environments ────────────────────────────────────────────────
  const envCore = createEmptyEnvironment({
    ...cc(ENV_CORE_ID),
    envCatalogId:   "coreDc",
    catalogVersion: CATALOG_VERSION,
    alias:          "Riyadh Core DC",
    location:       "Riyadh, KSA",
    sizeKw:         180,
    sqm:            850,
    tier:           "Tier III",
    notes:          "Primary on-prem site; hosts EMR, PACS, all production compute + storage."
  });
  const envDr = createEmptyEnvironment({
    ...cc(ENV_DR_ID),
    envCatalogId:   "drDc",
    catalogVersion: CATALOG_VERSION,
    alias:          "Jeddah DR",
    location:       "Jeddah, KSA",
    sizeKw:         90,
    sqm:            420,
    tier:           "Tier II",
    notes:          "Warm standby; async replication from Riyadh. Will host the cyber-recovery vault."
  });
  const envEdge = createEmptyEnvironment({
    ...cc(ENV_EDGE_ID),
    envCatalogId:   "edge",
    catalogVersion: CATALOG_VERSION,
    alias:          "Hospital Edge (200 sites)",
    location:       "200 hospital sites across KSA",
    sizeKw:         null,
    sqm:            null,
    tier:           null,
    notes:          "VxRail HCI nodes at every hospital for local check-in + EMR cache. Aggregate replication to Riyadh nightly."
  });
  const envSovereign = createEmptyEnvironment({
    ...cc(ENV_SOVEREIGN_ID),
    envCatalogId:   "sovereignCloud",
    catalogVersion: CATALOG_VERSION,
    alias:          "Sovereign Cloud (me-central-1)",
    location:       "UAE / KSA sovereign cloud region",
    sizeKw:         null,
    sqm:            null,
    tier:           null,
    notes:          "PDNS-compliant landing zone for analytics + patient portal; replaces incumbent AWS me-south-1 footprint."
  });

  // ─── Current-state instances ─────────────────────────────────────
  // Workloads (4) — touch infrastructure assets via mappedAssetIds.
  const instEMR = createEmptyInstance({
    ...cc(I_EMR_ID),
    state:          "current",
    layerId:        "workload",
    environmentId:  ENV_CORE_ID,
    label:          "Core EMR (electronic medical record)",
    vendor:         "Epic / Custom integration layer",
    vendorGroup:    "custom",
    criticality:    "High",
    disposition:    "keep",
    notes:          "Primary clinical system; HA-clustered Riyadh + Jeddah DR. Patient data.",
    mappedAssetIds: [I_R740_CORE_ID, I_R740_DR_ID, I_UNITY_ID, I_VEEAM_ID]
  });
  const instPACS = createEmptyInstance({
    ...cc(I_PACS_ID),
    state:          "current",
    layerId:        "workload",
    environmentId:  ENV_CORE_ID,
    label:          "PACS Imaging (radiology)",
    vendor:         "Sectra / Custom integration",
    vendorGroup:    "custom",
    criticality:    "High",
    disposition:    "keep",
    notes:          "Radiology imaging workload; unstructured data growing 35%/yr. Will benefit from PowerScale + AI inference.",
    mappedAssetIds: [I_R740_CORE_ID, I_NETAPP_ID, I_COMMVAULT_ID]
  });
  const instAnalytics = createEmptyInstance({
    ...cc(I_ANALYTICS_ID),
    state:          "current",
    layerId:        "workload",
    environmentId:  ENV_SOVEREIGN_ID,
    label:          "Clinical analytics platform",
    vendor:         "Custom (Spark + ML pipelines)",
    vendorGroup:    "custom",
    criticality:    "Medium",
    disposition:    "replace",
    notes:          "Currently running on AWS me-south-1. Sovereign-cloud migration in scope per driver 3.",
    mappedAssetIds: [I_AWS_S3_ID]
  });
  const instPatientPortal = createEmptyInstance({
    ...cc(I_PATIENT_PORTAL_ID),
    state:          "current",
    layerId:        "workload",
    environmentId:  ENV_EDGE_ID,
    label:          "Patient check-in (edge app)",
    vendor:         "Custom (web + native)",
    vendorGroup:    "custom",
    criticality:    "Medium",
    disposition:    "keep",
    notes:          "Runs on VxRail HCI at every hospital. Offline-tolerant; syncs to Riyadh nightly.",
    mappedAssetIds: [I_VXRAIL_EDGE_ID]
  });

  // Compute (4)
  const instR740Core = createEmptyInstance({
    ...cc(I_R740_CORE_ID),
    state:         "current",
    layerId:       "compute",
    environmentId: ENV_CORE_ID,
    label:         "PowerEdge R740 cluster (8 nodes)",
    vendor:        "Dell PowerEdge",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "replace",
    notes:         "End-of-warranty 2026-Q4. Hosts EMR + PACS app tier."
  });
  const instR740Dr = createEmptyInstance({
    ...cc(I_R740_DR_ID),
    state:         "current",
    layerId:       "compute",
    environmentId: ENV_DR_ID,
    label:         "PowerEdge R740 cluster (4 nodes)",
    vendor:        "Dell PowerEdge",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "keep",
    notes:         "DR cluster; mirrors Riyadh capacity at 50%."
  });
  const instCiscoUcs = createEmptyInstance({
    ...cc(I_CISCO_UCS_ID),
    state:         "current",
    layerId:       "compute",
    environmentId: ENV_CORE_ID,
    label:         "Cisco UCS B-series (12 blades)",
    vendor:        "Cisco UCS",
    vendorGroup:   "nonDell",
    criticality:   "Medium",
    disposition:   "consolidate",
    notes:         "Legacy non-Dell footprint; consolidation onto R760 in scope (vendor reduction)."
  });
  const instVxRailEdge = createEmptyInstance({
    ...cc(I_VXRAIL_EDGE_ID),
    state:         "current",
    layerId:       "compute",
    environmentId: ENV_EDGE_ID,
    label:         "VxRail HCI (200 sites x 3 nodes)",
    vendor:        "Dell VxRail",
    vendorGroup:   "dell",
    criticality:   "Medium",
    disposition:   "keep",
    notes:         "Hospital-edge HCI footprint. Hosts patient check-in + EMR cache."
  });

  // Storage (3)
  const instUnity = createEmptyInstance({
    ...cc(I_UNITY_ID),
    state:         "current",
    layerId:       "storage",
    environmentId: ENV_CORE_ID,
    label:         "Dell Unity XT 480F",
    vendor:        "Dell Unity XT",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "replace",
    notes:         "EMR primary storage. At 90% capacity; performance degrading."
  });
  const instNetApp = createEmptyInstance({
    ...cc(I_NETAPP_ID),
    state:         "current",
    layerId:       "storage",
    environmentId: ENV_CORE_ID,
    label:         "NetApp AFF A400",
    vendor:        "NetApp",
    vendorGroup:   "nonDell",
    criticality:   "High",
    disposition:   "replace",
    notes:         "PACS unstructured imaging tier. Replace with PowerScale F710 (AI-ready) per driver 2."
  });
  const instAwsS3 = createEmptyInstance({
    ...cc(I_AWS_S3_ID),
    state:         "current",
    layerId:       "storage",
    environmentId: ENV_SOVEREIGN_ID,
    label:         "AWS S3 me-south-1 archive",
    vendor:        "Amazon S3",
    vendorGroup:   "nonDell",
    criticality:   "Medium",
    disposition:   "retire",
    notes:         "Patient-data archive on AWS. Retiring as part of sovereign migration (driver 3)."
  });

  // Data protection (2)
  const instVeeam = createEmptyInstance({
    ...cc(I_VEEAM_ID),
    state:         "current",
    layerId:       "dataProtection",
    environmentId: ENV_CORE_ID,
    label:         "Veeam Backup & Replication",
    vendor:        "Veeam",
    vendorGroup:   "nonDell",
    criticality:   "High",
    disposition:   "replace",
    notes:         "No immutable / air-gapped tier; full ransomware exposure. Replace with PPDM + Cyber Recovery vault per driver 1."
  });
  const instCommvault = createEmptyInstance({
    ...cc(I_COMMVAULT_ID),
    state:         "current",
    layerId:       "dataProtection",
    environmentId: ENV_CORE_ID,
    label:         "Commvault (PACS backup)",
    vendor:        "Commvault",
    vendorGroup:   "nonDell",
    criticality:   "Medium",
    disposition:   "retire",
    notes:         "PACS-only backup; folds into PPDM coverage post-migration."
  });

  // Infrastructure (1)
  const instCiscoNet = createEmptyInstance({
    ...cc(I_CISCO_NET_ID),
    state:         "current",
    layerId:       "infrastructure",
    environmentId: ENV_CORE_ID,
    label:         "Cisco Catalyst flat VLAN",
    vendor:        "Cisco Catalyst",
    vendorGroup:   "nonDell",
    criticality:   "Medium",
    disposition:   "enhance",
    notes:         "Hospital-wide flat VLAN. Compliance liability; needs micro-segmentation for EMR + PACS isolation."
  });

  // ─── Desired-state instances ─────────────────────────────────────
  // Compute (2)
  const desR760 = createEmptyInstance({
    ...cc(D_R760_ID),
    state:         "desired",
    layerId:       "compute",
    environmentId: ENV_CORE_ID,
    label:         "PowerEdge R760 cluster (10 nodes)",
    vendor:        "Dell PowerEdge",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "consolidate",
    priority:      "Now",
    originId:      I_R740_CORE_ID,
    notes:         "Replaces both R740 Core (8 nodes) AND Cisco UCS (12 blades). Consolidation reduces vendor count + power draw + ops surface."
  });
  const desXe9680 = createEmptyInstance({
    ...cc(D_XE9680_ID),
    state:         "desired",
    layerId:       "compute",
    environmentId: ENV_CORE_ID,
    label:         "PowerEdge XE9680 (8x H100 GPU)",
    vendor:        "Dell PowerEdge",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "introduce",
    priority:      "Next",
    notes:         "GPU compute for clinical-imaging AI inference + ML training. Net-new (no current GPU footprint)."
  });

  // Storage (2)
  const desPowerStore = createEmptyInstance({
    ...cc(D_POWERSTORE_ID),
    state:         "desired",
    layerId:       "storage",
    environmentId: ENV_CORE_ID,
    label:         "PowerStore 5000T",
    vendor:        "Dell PowerStore",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "replace",
    priority:      "Now",
    originId:      I_UNITY_ID,
    notes:         "Replaces Unity XT 480F. NVMe-native + immutable snapshots. EMR primary storage."
  });
  const desPowerScale = createEmptyInstance({
    ...cc(D_POWERSCALE_ID),
    state:         "desired",
    layerId:       "storage",
    environmentId: ENV_CORE_ID,
    label:         "PowerScale F710 (NVMe scale-out)",
    vendor:        "Dell PowerScale",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "replace",
    priority:      "Next",
    originId:      I_NETAPP_ID,
    notes:         "Replaces NetApp AFF for PACS unstructured tier. Sized for 4yr imaging growth + AI inference data path."
  });

  // Data protection (2)
  const desPpdm = createEmptyInstance({
    ...cc(D_PPDM_ID),
    state:         "desired",
    layerId:       "dataProtection",
    environmentId: ENV_CORE_ID,
    label:         "PowerProtect Data Manager",
    vendor:        "Dell PowerProtect",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "replace",
    priority:      "Now",
    originId:      I_VEEAM_ID,
    notes:         "Replaces Veeam + Commvault. Single backup pane for EMR + PACS; integrates with Cyber Recovery vault."
  });
  const desPpcrVault = createEmptyInstance({
    ...cc(D_PPCR_VAULT_ID),
    state:         "desired",
    layerId:       "dataProtection",
    environmentId: ENV_DR_ID,
    label:         "PowerProtect Cyber Recovery vault + CyberSense",
    vendor:        "Dell PowerProtect Cyber Recovery",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "introduce",
    priority:      "Next",
    notes:         "Air-gapped immutable vault in Jeddah DR. CyberSense ML detects ransomware indicators in backup stream. Net-new."
  });

  // Infrastructure (1)
  const desPowerSwitch = createEmptyInstance({
    ...cc(D_POWERSWITCH_ID),
    state:         "desired",
    layerId:       "infrastructure",
    environmentId: ENV_CORE_ID,
    label:         "PowerSwitch + SmartFabric Manager",
    vendor:        "Dell PowerSwitch",
    vendorGroup:   "dell",
    criticality:   "Medium",
    disposition:   "enhance",
    priority:      "Later",
    originId:      I_CISCO_NET_ID,
    notes:         "Replaces Cisco Catalyst with micro-segmentation-ready fabric. EMR + PACS isolated VRFs for compliance."
  });

  // Sovereign cloud landing (1)
  const desApexCloud = createEmptyInstance({
    ...cc(D_APEX_CLOUD_ID),
    state:         "desired",
    layerId:       "compute",
    environmentId: ENV_SOVEREIGN_ID,
    label:         "APEX Cloud Services (sovereign landing)",
    vendor:        "Dell APEX",
    vendorGroup:   "dell",
    criticality:   "High",
    disposition:   "replace",
    priority:      "Next",
    originId:      I_ANALYTICS_ID,
    notes:         "Hosts the migrated analytics workload + patient portal on PDNS-compliant sovereign infra. Replaces AWS me-south-1 footprint."
  });

  // AIOps (1)
  const desCloudIq = createEmptyInstance({
    ...cc(D_CLOUDIQ_ID),
    state:         "desired",
    layerId:       "infrastructure",
    environmentId: ENV_CORE_ID,
    label:         "CloudIQ + APEX AIOps",
    vendor:        "Dell APEX AIOps",
    vendorGroup:   "dell",
    criticality:   "Medium",
    disposition:   "introduce",
    priority:      "Later",
    notes:         "Predictive infra ops across PowerEdge + PowerStore + PowerScale + PPDM. Net-new operational tier."
  });

  // ─── Gaps ────────────────────────────────────────────────────────
  const gapPpdmReplace = createEmptyGap({
    ...cc(GAP_PPDM_REPLACE_ID),
    description:               "Replace Veeam with PowerProtect Data Manager — establish modern backup baseline before standing up the Cyber Recovery vault.",
    gapType:                   "replace",
    urgency:                   "High",
    phase:                     "now",
    status:                    "open",
    layerId:                   "dataProtection",
    affectedLayers:            ["dataProtection"],
    affectedEnvironments:      [ENV_CORE_ID, ENV_DR_ID],
    relatedCurrentInstanceIds: [I_VEEAM_ID, I_COMMVAULT_ID],
    relatedDesiredInstanceIds: [D_PPDM_ID],
    services:                  ["assessment", "migration", "deployment", "runbook"],
    driverId:                  DRIVER_CYBER_ID,
    notes:                     "Foundation for the cyber-recovery story. PPDM unifies EMR + PACS backup; Commvault retired post-migration.",
    aiMappedDellSolutions: {
      value: {
        rawLegacy: "PowerProtect Data Manager (replacement) + PowerProtect DD storage tier.",
        products:  ["powerprotect_dm", "powerprotect_dd"]
      },
      provenance: {
        model:            "claude-opus-4-7",
        promptVersion:    "skill:dell-mapping@1.0.0",
        skillId:          "dell-mapping",
        runId:            "v3-demo-run-gap-ppdm-001",
        timestamp:        TS,
        catalogVersions:  { "DELL_PRODUCT_TAXONOMY": CATALOG_VERSION },
        validationStatus: "valid"
      }
    }
  });
  const gapCyberVault = createEmptyGap({
    ...cc(GAP_CYBER_VAULT_ID),
    description:               "Introduce PowerProtect Cyber Recovery vault + CyberSense in Jeddah DR — air-gapped immutable copy with ML-based ransomware detection.",
    gapType:                   "introduce",
    urgency:                   "High",
    phase:                     "next",
    status:                    "open",
    layerId:                   "dataProtection",
    affectedLayers:            ["dataProtection"],
    affectedEnvironments:      [ENV_DR_ID],
    relatedCurrentInstanceIds: [],
    relatedDesiredInstanceIds: [D_PPCR_VAULT_ID],
    services:                  ["assessment", "deployment", "runbook", "training"],
    driverId:                  DRIVER_CYBER_ID,
    notes:                     "Closes the cyber-resilience driver: NIS2 evidence, RTO <= 4hr, quarterly recovery test playbook."
  });
  const gapPowerScale = createEmptyGap({
    ...cc(GAP_POWERSCALE_ID),
    description:               "Replace NetApp AFF with PowerScale F710 — NVMe scale-out unstructured tier sized for PACS imaging growth and AI inference data path.",
    gapType:                   "replace",
    urgency:                   "High",
    phase:                     "next",
    status:                    "open",
    layerId:                   "storage",
    affectedLayers:            ["storage"],
    affectedEnvironments:      [ENV_CORE_ID],
    relatedCurrentInstanceIds: [I_NETAPP_ID],
    relatedDesiredInstanceIds: [D_POWERSCALE_ID],
    services:                  ["assessment", "migration", "deployment"],
    driverId:                  DRIVER_AI_ID,
    notes:                     "AI driver foundation: PowerScale F710 hosts the imaging tier that the GPU inference pipeline reads from. Same fabric as PowerEdge XE9680."
  });
  const gapGpuInference = createEmptyGap({
    ...cc(GAP_GPU_INFERENCE_ID),
    description:               "Introduce PowerEdge XE9680 GPU compute — clinical-imaging AI inference + ML training on-prem, near the imaging data tier.",
    gapType:                   "introduce",
    urgency:                   "Medium",
    phase:                     "next",
    status:                    "open",
    layerId:                   "compute",
    affectedLayers:            ["compute"],
    affectedEnvironments:      [ENV_CORE_ID],
    relatedCurrentInstanceIds: [],
    relatedDesiredInstanceIds: [D_XE9680_ID],
    services:                  ["deployment", "training", "knowledge_transfer"],
    driverId:                  DRIVER_AI_ID,
    notes:                     "8x H100 SKU. Co-located with PowerScale F710 for low-latency data path."
  });
  const gapAiops = createEmptyGap({
    ...cc(GAP_AIOPS_ID),
    description:               "Stand up CloudIQ + APEX AIOps for predictive operations across the new Dell estate.",
    gapType:                   "ops",
    urgency:                   "Low",
    phase:                     "later",
    status:                    "open",
    layerId:                   "infrastructure",
    affectedLayers:            ["infrastructure"],
    affectedEnvironments:      [ENV_CORE_ID],
    relatedCurrentInstanceIds: [],
    relatedDesiredInstanceIds: [D_CLOUDIQ_ID],
    services:                  ["deployment", "integration", "training"],
    driverId:                  DRIVER_AI_ID,
    notes:                     "Operational layer for the AI-native estate; predictive failure detection on PowerEdge + PowerStore + PowerScale + PPDM."
  });
  const gapSovereignLift = createEmptyGap({
    ...cc(GAP_SOVEREIGN_LIFT_ID),
    description:               "Migrate clinical analytics workload from AWS me-south-1 to APEX Cloud Services on the sovereign cloud landing zone — eliminate AWS dependency for patient-data processing.",
    gapType:                   "replace",
    urgency:                   "High",
    phase:                     "next",
    status:                    "open",
    layerId:                   "workload",
    affectedLayers:            ["workload"],
    affectedEnvironments:      [ENV_SOVEREIGN_ID],
    relatedCurrentInstanceIds: [I_ANALYTICS_ID, I_AWS_S3_ID],
    relatedDesiredInstanceIds: [D_APEX_CLOUD_ID],
    services:                  ["assessment", "migration", "deployment", "decommissioning"],
    driverId:                  DRIVER_SOVEREIGN_ID,
    notes:                     "Closes the sovereignty driver: PDNS-compliant landing for analytics + patient data. Decommissioning required for AWS S3 archive."
  });
  const gapComputeConsol = createEmptyGap({
    ...cc(GAP_COMPUTE_CONSOL_ID),
    description:               "Consolidate PowerEdge R740 cluster + Cisco UCS B-series onto PowerEdge R760 — vendor reduction, lower power, simpler ops.",
    gapType:                   "consolidate",
    urgency:                   "Medium",
    phase:                     "now",
    status:                    "open",
    layerId:                   "compute",
    affectedLayers:            ["compute"],
    affectedEnvironments:      [ENV_CORE_ID],
    relatedCurrentInstanceIds: [I_R740_CORE_ID, I_CISCO_UCS_ID],
    relatedDesiredInstanceIds: [D_R760_ID],
    services:                  ["assessment", "migration", "deployment", "decommissioning"],
    driverId:                  DRIVER_SOVEREIGN_ID,
    notes:                     "Supports sovereignty driver indirectly: simpler vendor surface eases auditor evidence; primary value is op simplicity + power savings."
  });
  const gapNetSegment = createEmptyGap({
    ...cc(GAP_NET_SEGMENT_ID),
    description:               "Enhance hospital-wide network with PowerSwitch + SmartFabric — micro-segmentation for EMR + PACS isolation (compliance evidence).",
    gapType:                   "enhance",
    urgency:                   "Medium",
    phase:                     "later",
    status:                    "open",
    layerId:                   "infrastructure",
    affectedLayers:            ["infrastructure"],
    affectedEnvironments:      [ENV_CORE_ID],
    relatedCurrentInstanceIds: [I_CISCO_NET_ID],
    relatedDesiredInstanceIds: [D_POWERSWITCH_ID],
    services:                  ["assessment", "deployment", "runbook"],
    driverId:                  null,
    notes:                     "Standalone infra gap. Not driver-tied; fixes a compliance liability that surfaced in the integrity sweep."
  });

  // ─── Compose collections ─────────────────────────────────────────
  const driversAllIds = [DRIVER_CYBER_ID, DRIVER_AI_ID, DRIVER_SOVEREIGN_ID];
  const envsAllIds    = [ENV_CORE_ID, ENV_DR_ID, ENV_EDGE_ID, ENV_SOVEREIGN_ID];

  const allCurrent = [
    instEMR, instPACS, instAnalytics, instPatientPortal,
    instR740Core, instR740Dr, instCiscoUcs, instVxRailEdge,
    instUnity, instNetApp, instAwsS3,
    instVeeam, instCommvault,
    instCiscoNet
  ];
  const allDesired = [
    desR760, desXe9680,
    desPowerStore, desPowerScale,
    desPpdm, desPpcrVault,
    desPowerSwitch,
    desApexCloud, desCloudIq
  ];
  const allInst = allCurrent.concat(allDesired);
  const instAllIds = allInst.map(i => i.id);
  const instById = {};
  allInst.forEach(i => { instById[i.id] = i; });

  const gapsList = [
    gapPpdmReplace, gapCyberVault,
    gapPowerScale, gapGpuInference, gapAiops,
    gapSovereignLift, gapComputeConsol,
    gapNetSegment
  ];
  const gapsAllIds = gapsList.map(g => g.id);
  const gapsById = {};
  gapsList.forEach(g => { gapsById[g.id] = g; });

  return {
    meta,
    customer,
    drivers: {
      byId: {
        [DRIVER_CYBER_ID]:     driverCyber,
        [DRIVER_AI_ID]:        driverAI,
        [DRIVER_SOVEREIGN_ID]: driverSovereign
      },
      allIds: driversAllIds
    },
    environments: {
      byId: {
        [ENV_CORE_ID]:      envCore,
        [ENV_DR_ID]:        envDr,
        [ENV_EDGE_ID]:      envEdge,
        [ENV_SOVEREIGN_ID]: envSovereign
      },
      allIds: envsAllIds
    },
    instances: {
      byId:    instById,
      allIds:  instAllIds,
      byState: {
        current: allCurrent.map(i => i.id),
        desired: allDesired.map(i => i.id)
      }
    },
    gaps: {
      byId:   gapsById,
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
