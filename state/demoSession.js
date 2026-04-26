// state/demoSession.js — Phase 19e / v2.4.5 Foundations Refresh
//
// Demo-mode seed data. Extracted from sessionStore.js so the demo has
// its own audit trail (docs/DEMO_CHANGELOG.md) and its own test suite
// (diagnostics/demoSpec.js). Any data-model change landing a new field
// MUST refresh the active persona here in the same commit — see
// feedback_foundational_testing.md for the process rule.
//
// This file also defines DEMO_PERSONAS so the user can switch verticals
// from the footer without losing the refreshed Phase 16 / Phase 18
// patterns. v2.4.5 ships the Acme Financial Services persona as the
// default (matches pre-v2.4.5 behaviour) plus two stub personas
// (Healthcare, Public Sector) that future slices will flesh out.
//
// Data-model coverage asserted by diagnostics/demoSpec.js:
//   - Phase 16 · workload-layer instance with mappedAssetIds[]
//   - Phase 18 · multi-linked pattern (one instance linked by ≥2 gaps)
//   - Dell solution + non-Dell solution on the current-state matrix
//   - Gap with a driverId (Phase 14 driver → gap explicit link)
//   - Driver with a non-empty outcomes field
//   - Gap schema conforms to current validateGap (layerId, affectedLayers,
//     urgency, phase, gapType, status).

var TODAY = new Date().toISOString().slice(0, 10);

// ── Default persona · Acme Financial Services ─────────────────────────
// Keeps the v2.1-v2.4.4 look-and-feel (same vertical, same names the
// user is used to reviewing) but adds Phase 16 + Phase 18 coverage plus
// explicit driver→gap links (gap.driverId) for the seed AI skills.
function buildAcmeFinancialServices() {
  return {
    sessionId:  "sess-demo-fsi-001",
    isDemo:     true,
    personaId:  "acme-fsi",
    customer: {
      name:          "Acme Financial Services",
      vertical:      "Financial Services",
      segment:       "Financial Services",
      industry:      "Financial Services",
      region:        "EMEA",
      drivers: [
        {
          id:        "cyber_resilience",
          priority:  "High",
          outcomes:  "• Achieve full cyber resilience and prove recovery under NIS2 by Q3 2026.\n• Air-gapped immutable backups for tier-1 systems, tested quarterly."
        },
        {
          id:        "cost_optimization",
          priority:  "Medium",
          outcomes:  "• Contain infrastructure OpEx growth; reduce Broadcom / VMware licensing exposure.\n• Reduce TCO 20% over 24 months without downgrading SLAs."
        },
        {
          id:        "modernize_infra",
          priority:  "Medium",
          outcomes:  "• Refresh 60% of compute that is past end-of-support within 18 months."
        }
      ]
    },
    sessionMeta: {
      date:          TODAY,
      presalesOwner: "Example Presales",
      status:        "In Progress",
      version:       "2.0"
    },
    instances: [
      // ── Workload layer (Phase 16) ─────────────────────────────────
      // Core-banking workload maps N-to-N onto compute + storage + DP.
      // `mappedAssetIds` is the Phase 16 contract; workload criticality
      // propagates upward in the matrix view.
      { id:"w-001", state:"current", layerId:"workload", environmentId:"coreDc",
        label:"Core Banking / Payments", vendor:"Multi", vendorGroup:"nonDell",
        criticality:"High", notes:"Regulated tier-1 workload. RTO 4h / RPO 15m.",
        mappedAssetIds:["i-001","i-003","i-005","i-007"] },

      // ── Current state (infrastructure layers) ─────────────────────
      { id:"i-001", state:"current", layerId:"compute",        environmentId:"coreDc",
        label:"PowerEdge (current gen)", vendor:"Dell", vendorGroup:"dell",
        criticality:"Medium", notes:"~60% aged 4+ years." },
      { id:"i-002", state:"current", layerId:"compute",        environmentId:"drDc",
        label:"HPE ProLiant",            vendor:"HPE", vendorGroup:"nonDell",
        criticality:"Low",    notes:"Aging DR compute." },
      { id:"i-003", state:"current", layerId:"storage",        environmentId:"coreDc",
        label:"Unity XT",                vendor:"Dell", vendorGroup:"dell",
        criticality:"High",   notes:"90% capacity. DB performance issues." },
      { id:"i-004", state:"current", layerId:"storage",        environmentId:"coreDc",
        label:"NetApp AFF / FAS",        vendor:"NetApp", vendorGroup:"nonDell",
        criticality:"Medium", notes:"NAS tier — large unstructured data." },
      { id:"i-005", state:"current", layerId:"dataProtection", environmentId:"coreDc",
        label:"Veeam Backup & Replication", vendor:"Veeam", vendorGroup:"nonDell",
        criticality:"High",   notes:"Jobs failing 2-3x/week. No air-gap." },
      { id:"i-006", state:"current", layerId:"dataProtection", environmentId:"publicCloud",
        label:"AWS Backup",              vendor:"AWS", vendorGroup:"nonDell",
        criticality:"Medium", notes:"Cloud workloads only." },
      { id:"i-007", state:"current", layerId:"virtualization", environmentId:"coreDc",
        label:"VMware vSphere / vCenter",vendor:"VMware", vendorGroup:"nonDell",
        criticality:"High",   notes:"Broadcom licensing 3x cost increase." },
      { id:"i-008", state:"current", layerId:"infrastructure", environmentId:"coreDc",
        label:"Cisco Nexus (DC)",        vendor:"Cisco", vendorGroup:"nonDell",
        criticality:"Medium", notes:"Manual VLAN provisioning." },
      { id:"i-009", state:"current", layerId:"infrastructure", environmentId:"coreDc",
        label:"Microsoft Entra ID / AD", vendor:"Microsoft", vendorGroup:"nonDell",
        criticality:"High",   notes:"No privileged access management." },

      // ── Desired state ────────────────────────────────────────────
      { id:"d-001", state:"desired", layerId:"compute",        environmentId:"coreDc",
        label:"PowerEdge (current gen)", vendor:"Dell", vendorGroup:"dell",
        priority:"Now",  timeline:"0-12 months",  disposition:"replace",
        originId:"i-001", notes:"Refresh aging estate." },
      { id:"d-002", state:"desired", layerId:"storage",        environmentId:"coreDc",
        label:"PowerStore", vendor:"Dell", vendorGroup:"dell",
        priority:"Now",  timeline:"0-12 months",  disposition:"replace",
        originId:"i-003", notes:"Replace Unity XT. Single platform." },
      { id:"d-003", state:"desired", layerId:"storage",        environmentId:"coreDc",
        label:"PowerScale (Isilon)", vendor:"Dell", vendorGroup:"dell",
        priority:"Next", timeline:"12-24 months", disposition:"consolidate",
        originId:"i-004", notes:"Consolidate NAS." },
      { id:"d-004", state:"desired", layerId:"dataProtection", environmentId:"coreDc",
        label:"PowerProtect Data Manager", vendor:"Dell", vendorGroup:"dell",
        priority:"Now",  timeline:"0-12 months",  disposition:"replace",
        originId:"i-005", notes:"Replace Veeam." },
      { id:"d-005", state:"desired", layerId:"dataProtection", environmentId:"coreDc",
        label:"Cyber Recovery Vault", vendor:"Dell", vendorGroup:"dell",
        priority:"Now",  timeline:"0-12 months",  disposition:"enhance",
        notes:"Air-gapped vault. Board priority." },
      { id:"d-006", state:"desired", layerId:"virtualization", environmentId:"coreDc",
        label:"VxRail (VMware-based)", vendor:"Dell", vendorGroup:"dell",
        priority:"Next", timeline:"12-24 months", disposition:"replace",
        originId:"i-007", notes:"Reduce VMware licensing exposure." },
      // v2.4.8 · Phase 17 · exercise the remaining taxonomy values so
      // demoSpec DS18-DS22 can assert every Action is represented in
      // the default demo. "keep" (i-008 Cisco Nexus) + "retire"
      // (i-006 AWS Backup legacy).
      { id:"d-007", state:"desired", layerId:"infrastructure", environmentId:"coreDc",
        label:"Cisco Nexus (DC)", vendor:"Cisco", vendorGroup:"nonDell",
        priority:"Later", timeline:"24+ months", disposition:"keep",
        originId:"i-008", notes:"Keep in place through 2027 refresh window." },
      { id:"d-008", state:"desired", layerId:"dataProtection", environmentId:"publicCloud",
        label:"AWS Backup", vendor:"AWS", vendorGroup:"nonDell",
        priority:"Later", timeline:"24+ months", disposition:"retire",
        originId:"i-006", notes:"Retire in favour of PowerProtect once cutover is complete." },
      // v2.4.8 · Phase 17 · anchor for the introduce-gap g-007.
      // No originId — net-new workload with no current counterpart.
      { id:"d-009", state:"desired", layerId:"workload", environmentId:"coreDc",
        label:"Dell Validated Design — AI / RAG", vendor:"Dell", vendorGroup:"dell",
        priority:"Next", timeline:"12-24 months", disposition:"introduce",
        notes:"Board-mandated AI/RAG pilot." }
    ],
    // Gaps now carry explicit driverId (Phase 14) and the Phase 18
    // multi-linked pattern: i-005 (Veeam) is referenced by BOTH g-001
    // and g-006 — the warn-but-allow chip should surface on the gap
    // detail view.
    gaps: [
      {
        id:"g-001", description:"No immutable backup — full ransomware exposure",
        layerId:"dataProtection", affectedLayers:["dataProtection","storage"],
        affectedEnvironments:["coreDc"],
        gapType:"replace", urgency:"High", phase:"now",
        driverId:"cyber_resilience",
        mappedDellSolutions:"PowerProtect PPDM, DD9400, Cyber Recovery + CyberSense",
        notes:"Near-miss ransomware Q4 2025. Board priority. NIS2 deadline Q3 2026.",
        relatedCurrentInstanceIds:["i-005"], relatedDesiredInstanceIds:["d-004","d-005"],
        // v2.4.12 · realistic services for a PPDM/DD/CR replace engagement.
        services:["migration","deployment","training","runbook"],
        status:"open", reviewed:true
      },
      {
        id:"g-002", description:"Unity XT at 90% capacity — performance degrading",
        layerId:"storage", affectedLayers:["storage"], affectedEnvironments:["coreDc"],
        gapType:"replace", urgency:"High", phase:"now",
        driverId:"modernize_infra",
        mappedDellSolutions:"PowerStore mid-range",
        notes:"Storage SLA breaches. Cannot expand without refresh.",
        relatedCurrentInstanceIds:["i-003"], relatedDesiredInstanceIds:["d-002"],
        services:["migration","deployment"],
        status:"open", reviewed:true
      },
      {
        id:"g-003", description:"VMware licensing tripled — HCI modernisation needed",
        layerId:"virtualization", affectedLayers:["virtualization","compute"],
        affectedEnvironments:["coreDc"],
        gapType:"replace", urgency:"Medium", phase:"next",
        driverId:"cost_optimization",
        mappedDellSolutions:"VxRail (VMware-based HCI)",
        notes:"Broadcom renewal due in 18 months.",
        relatedCurrentInstanceIds:["i-007"], relatedDesiredInstanceIds:["d-006"],
        services:["assessment","migration","deployment","training"],
        status:"open", reviewed:true
      },
      {
        // v2.4.11 · was gapType:"replace" but with TWO current items
        // (PowerEdge old + HPE ProLiant) → ONE desired (PowerEdge new),
        // which is semantically Consolidate (merge two compute platforms
        // into one Dell-standard fleet). The old shape violated the
        // Replace 1-to-1 rule that v2.4.11 now enforces at review time.
        id:"g-004", description:"Aging compute — consolidate two vendor platforms onto PowerEdge",
        layerId:"compute", affectedLayers:["compute"], affectedEnvironments:["coreDc","drDc"],
        gapType:"consolidate", urgency:"Medium", phase:"now",
        driverId:"modernize_infra",
        mappedDellSolutions:"PowerEdge (current gen)",
        notes:"60% servers past end of support. Consolidating PowerEdge old + HPE ProLiant onto one Dell PowerEdge fleet for support + ops simplicity.",
        relatedCurrentInstanceIds:["i-001","i-002"], relatedDesiredInstanceIds:["d-001"],
        services:["migration","integration","knowledge_transfer","decommissioning"],
        status:"open", reviewed:true
      },
      {
        // v2.4.11 · A6 · this gap exercises urgencyOverride. Auto-derived
        // urgency from linked current would be Medium; user pinned it
        // to High because the cloud-spend trajectory is more urgent than
        // any single instance's criticality. Demonstrates the lock+auto
        // toggle in the gap detail UI.
        id:"g-005", description:"No cloud governance — uncontrolled AWS spend",
        layerId:"infrastructure", affectedLayers:["infrastructure"],
        affectedEnvironments:["publicCloud"],
        gapType:"ops", urgency:"High", urgencyOverride:true, phase:"later",
        driverId:"cost_optimization",
        mappedDellSolutions:"APEX Cloud Platform",
        notes:"AWS spend growing 30% YoY. Repatriation candidates identified.",
        relatedCurrentInstanceIds:[], relatedDesiredInstanceIds:[],
        services:["assessment","runbook","managed"],
        status:"open", reviewed:true
      },
      // Phase 18 multi-link: g-006 also references i-005 (Veeam) alongside g-001.
      // The gap detail view should render the warn-but-allow chip on this row.
      {
        id:"g-006", description:"Backup platform lock-in — Veeam roadmap diverges from Dell DP",
        layerId:"dataProtection", affectedLayers:["dataProtection"],
        affectedEnvironments:["coreDc"],
        gapType:"enhance", urgency:"Medium", phase:"next",
        driverId:"cyber_resilience",
        mappedDellSolutions:"PowerProtect Data Manager",
        notes:"Strategic shift: consolidate DP under Dell for single-vendor SLA.",
        relatedCurrentInstanceIds:["i-005"], relatedDesiredInstanceIds:["d-004"],
        services:["assessment"],
        status:"open", reviewed:true
      },
      // v2.4.8 · Phase 17 · "introduce" action gap — no current link, one
      // desired link. Exercises the Introduce rule (linksCurrent: 0,
      // linksDesired: 1). Realistic scenario: board mandate to add an
      // AI/RAG workload that didn't exist in the current estate.
      {
        id:"g-007", description:"Introduce Dell Validated Design for AI/RAG workloads",
        layerId:"workload", affectedLayers:["workload","compute"],
        affectedEnvironments:["coreDc"],
        gapType:"introduce", urgency:"Medium", phase:"next",
        driverId:"ai_data",
        mappedDellSolutions:"Dell Validated Design — AI / RAG, PowerEdge XE (GPU/AI)",
        notes:"Board-mandated GenAI pilot; no current AI workload in scope.",
        relatedCurrentInstanceIds:[],
        relatedDesiredInstanceIds:["d-009"],   // the AI/RAG desired tile
        services:["assessment","deployment","training","custom_dev"],
        status:"open", reviewed:true
      }
    ]
  };
}

// ── Persona · Meridian Health (Healthcare, stub) ──────────────────────
// Lightweight second persona so the data-switch UX can be exercised in
// the foundations refresh. Deliberately smaller than the FSI persona —
// fill out in a later slice if workshop demand exists.
function buildMeridianHealth() {
  return {
    sessionId:  "sess-demo-hls-001",
    isDemo:     true,
    personaId:  "meridian-hls",
    customer: {
      name:          "Meridian Health",
      vertical:      "Healthcare",
      segment:       "Healthcare",
      industry:      "Healthcare",
      region:        "North America",
      drivers: [
        { id:"compliance_sovereignty", priority:"High",   outcomes:"• HIPAA + HITRUST evidence gaps closed ahead of Q2 audit." },
        { id:"ai_data",                priority:"Medium", outcomes:"• Clinical-imaging AI pilot on Dell Validated Design within 12 months." },
        { id:"cyber_resilience",       priority:"High",   outcomes:"• Recover EHR within 2h; ransomware-proof air-gap required." }
      ]
    },
    sessionMeta: { date:TODAY, presalesOwner:"Example Presales", status:"Draft", version:"2.0" },
    instances: [
      { id:"w-001", state:"current", layerId:"workload", environmentId:"coreDc",
        label:"EHR / Clinical Systems", vendor:"Multi", vendorGroup:"nonDell",
        criticality:"High", notes:"Regulated clinical tier-1.",
        mappedAssetIds:["i-001","i-003"] },
      { id:"i-001", state:"current", layerId:"compute", environmentId:"coreDc",
        label:"PowerEdge (current gen)", vendor:"Dell", vendorGroup:"dell",
        criticality:"High", notes:"Primary clinical compute." },
      { id:"i-003", state:"current", layerId:"storage", environmentId:"coreDc",
        label:"PowerScale (Isilon)", vendor:"Dell", vendorGroup:"dell",
        criticality:"High", notes:"Imaging archive." },
      { id:"i-005", state:"current", layerId:"dataProtection", environmentId:"coreDc",
        label:"Commvault", vendor:"Commvault", vendorGroup:"nonDell",
        criticality:"Medium", notes:"Backup scope not HIPAA-aligned." }
    ],
    gaps: [
      {
        id:"g-001", description:"Backup scope not HIPAA-aligned — evidence gaps",
        layerId:"dataProtection", affectedLayers:["dataProtection"],
        affectedEnvironments:["coreDc"],
        gapType:"replace", urgency:"High", phase:"now",
        driverId:"compliance_sovereignty",
        mappedDellSolutions:"PowerProtect Data Manager, Cyber Recovery",
        notes:"Audit Q2; missing immutable copies on clinical systems.",
        relatedCurrentInstanceIds:["i-005"], relatedDesiredInstanceIds:[],
        status:"open", reviewed:false
      }
    ]
  };
}

// ── Persona · Northwind Public Sector (Public Sector, stub) ───────────
function buildNorthwindPublicSector() {
  return {
    sessionId:  "sess-demo-pub-001",
    isDemo:     true,
    personaId:  "northwind-pub",
    customer: {
      name:          "Northwind Public Sector",
      vertical:      "Public Sector",
      segment:       "Public Sector",
      industry:      "Public Sector",
      region:        "APJ",
      drivers: [
        { id:"compliance_sovereignty", priority:"High",   outcomes:"• Data-sovereignty mandate: citizen records never leave country." },
        { id:"cost_optimization",      priority:"High",   outcomes:"• 15% OpEx reduction in 18 months under fiscal pressure." }
      ]
    },
    sessionMeta: { date:TODAY, presalesOwner:"Example Presales", status:"Draft", version:"2.0" },
    instances: [
      { id:"i-001", state:"current", layerId:"compute", environmentId:"coreDc",
        label:"HPE ProLiant", vendor:"HPE", vendorGroup:"nonDell",
        criticality:"Medium", notes:"Sovereign DC — no cloud workloads." },
      { id:"i-003", state:"current", layerId:"storage", environmentId:"coreDc",
        label:"NetApp AFF / FAS", vendor:"NetApp", vendorGroup:"nonDell",
        criticality:"Medium", notes:"Citizen record archive." }
    ],
    gaps: [
      {
        id:"g-001", description:"No sovereign cloud — citizen records on foreign-flagged SaaS",
        layerId:"infrastructure", affectedLayers:["infrastructure","storage"],
        affectedEnvironments:["coreDc"],
        gapType:"introduce", urgency:"High", phase:"next",
        driverId:"compliance_sovereignty",
        mappedDellSolutions:"APEX Cloud Platform (sovereign)",
        notes:"Mandate published; exemption window closes mid-2026.",
        relatedCurrentInstanceIds:[], relatedDesiredInstanceIds:[],
        status:"open", reviewed:false
      }
    ]
  };
}

// ── Persona registry ─────────────────────────────────────────────────
// First entry is the default. App code that doesn't care about personas
// (createDemoSession / resetToDemo) uses [0]. Future UI can surface a
// "switch persona" control reading this list.
export var DEMO_PERSONAS = [
  { id: "acme-fsi",       label: "Acme Financial Services",   build: buildAcmeFinancialServices },
  { id: "meridian-hls",   label: "Meridian Health",           build: buildMeridianHealth       },
  { id: "northwind-pub",  label: "Northwind Public Sector",   build: buildNorthwindPublicSector }
];

// Primary export — preserves the v2.4.4 call signature used by
// sessionStore and existing callers.
export function createDemoSession() {
  return DEMO_PERSONAS[0].build();
}

// v2.4.5 — pick a persona by id. Falls back to the default if id is
// unknown so bad localStorage cannot break the demo reset.
export function createDemoSessionByPersona(personaId) {
  var p = DEMO_PERSONAS.find(function(p) { return p.id === personaId; });
  return (p || DEMO_PERSONAS[0]).build();
}
