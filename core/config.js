// core/config.js — single source of truth for all static configuration

// 6-layer architecture. v2.3.1 adds `workload` as the topmost layer:
// business workloads sit above the infrastructure that runs them, and a
// workload instance can map (N-to-N) to instances on the lower five layers.
export const LAYERS = [
  { id: "workload",       label: "Workloads & Business Apps" },
  { id: "compute",        label: "Compute" },
  { id: "storage",        label: "Data Storage" },
  { id: "dataProtection", label: "Data Protection & Recovery" },
  { id: "virtualization", label: "Virtualization & Hypervisors" },
  { id: "infrastructure", label: "Infrastructure Services" }
];

// infrastructure = networking + security + management combined for simplicity

export const ENVIRONMENTS = [
  { id: "coreDc",      label: "Core DC" },
  { id: "drDc",        label: "DR / Secondary DC" },
  { id: "publicCloud", label: "Public Cloud" },
  { id: "edge",        label: "Edge / Remote" }
];

// Catalog — each entry may carry an optional `environments` whitelist.
// Absence = valid in all environments (software that runs anywhere, SaaS tools, etc.).
// Presence = palette only shows this entry when the current cell's environmentId matches.
const ON_PREM = ["coreDc", "drDc", "edge"];
const CLOUD_ONLY = ["publicCloud"];

export const CATALOG = {
  workload: [
    // Dell Validated Designs (DVD) — real Dell offerings packaged for
    // common workload patterns. Useful for Dell-led conversations.
    { label: "Dell Validated Design — SAP HANA",   vendor: "Dell",      vendorGroup: "dell"    /* multi-env */ },
    { label: "Dell Validated Design — AI / RAG",   vendor: "Dell",      vendorGroup: "dell"    /* multi-env */ },
    { label: "Dell Validated Design — VDI / EUC",  vendor: "Dell",      vendorGroup: "dell"    /* multi-env */ },
    // Business apps (vendor-packaged)
    { label: "ERP (SAP / Oracle / Dynamics)",  vendor: "Multi",     vendorGroup: "nonDell" /* multi-env */ },
    { label: "CRM (Salesforce / Dynamics)",    vendor: "Multi",     vendorGroup: "nonDell" /* multi-env */ },
    { label: "HCM / HR (Workday / SAP HR)",    vendor: "Multi",     vendorGroup: "nonDell" /* multi-env */ },
    { label: "Email & Collaboration (M365)",   vendor: "Microsoft", vendorGroup: "nonDell" /* multi-env */ },
    // Industry-vertical systems
    { label: "EHR / Clinical Systems",         vendor: "Multi",     vendorGroup: "nonDell" /* multi-env */ },
    { label: "Core Banking / Payments",        vendor: "Multi",     vendorGroup: "nonDell" /* multi-env */ },
    { label: "Billing & Revenue Management",   vendor: "Multi",     vendorGroup: "nonDell" /* multi-env */ },
    // Data & analytics workloads
    { label: "Data Warehouse / Lakehouse",     vendor: "Multi",     vendorGroup: "nonDell" /* multi-env */ },
    { label: "Business Intelligence",          vendor: "Multi",     vendorGroup: "nonDell" /* multi-env */ },
    { label: "AI / ML Inference & Training",   vendor: "Multi",     vendorGroup: "nonDell" /* multi-env */ },
    // Application footprints (often custom)
    { label: "Customer-facing Web Application",vendor: "Custom",    vendorGroup: "custom"  /* multi-env */ },
    { label: "Internal LOB Application",       vendor: "Custom",    vendorGroup: "custom"  /* multi-env */ },
    { label: "Database Service (RDBMS/NoSQL)", vendor: "Multi",     vendorGroup: "nonDell" /* multi-env */ },
    { label: "DevOps / CI-CD Platform",        vendor: "Multi",     vendorGroup: "nonDell" /* multi-env */ }
  ],
  compute: [
    // On-prem
    { label: "PowerEdge (current gen)",   vendor: "Dell",      vendorGroup: "dell",    environments: ON_PREM },
    { label: "PowerEdge MX Modular",      vendor: "Dell",      vendorGroup: "dell",    environments: ON_PREM },
    { label: "PowerEdge XE (GPU / AI)",   vendor: "Dell",      vendorGroup: "dell",    environments: ON_PREM },
    { label: "PowerEdge XR (Ruggedized)", vendor: "Dell",      vendorGroup: "dell",    environments: ["edge"] },
    { label: "HPE ProLiant",              vendor: "HPE",       vendorGroup: "nonDell", environments: ON_PREM },
    { label: "Cisco UCS",                 vendor: "Cisco",     vendorGroup: "nonDell", environments: ON_PREM },
    { label: "IBM Power",                 vendor: "IBM",       vendorGroup: "nonDell", environments: ON_PREM },
    { label: "Mainframe (IBM Z)",         vendor: "IBM",       vendorGroup: "nonDell", environments: ["coreDc"] },
    { label: "Lenovo ThinkSystem",        vendor: "Lenovo",    vendorGroup: "nonDell", environments: ON_PREM },
    { label: "Custom / Whitebox",         vendor: "Custom",    vendorGroup: "custom",  environments: ON_PREM },
    // Public cloud
    { label: "AWS EC2",                   vendor: "AWS",       vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Azure Virtual Machines",    vendor: "Microsoft", vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Google Compute Engine",     vendor: "Google",    vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "AWS Outposts",              vendor: "AWS",       vendorGroup: "nonDell", environments: CLOUD_ONLY }
  ],
  storage: [
    // On-prem
    { label: "PowerStore",                vendor: "Dell",      vendorGroup: "dell",    environments: ON_PREM },
    { label: "PowerMax",                  vendor: "Dell",      vendorGroup: "dell",    environments: ["coreDc","drDc"] },
    { label: "PowerScale (Isilon)",       vendor: "Dell",      vendorGroup: "dell",    environments: ON_PREM },
    { label: "Unity XT",                  vendor: "Dell",      vendorGroup: "dell",    environments: ON_PREM },
    { label: "ECS Object Storage",        vendor: "Dell",      vendorGroup: "dell",    environments: ["coreDc","drDc"] },
    { label: "NetApp AFF / FAS",          vendor: "NetApp",    vendorGroup: "nonDell", environments: ON_PREM },
    { label: "Pure Storage FlashArray",   vendor: "Pure",      vendorGroup: "nonDell", environments: ON_PREM },
    { label: "HPE Nimble / Primera",      vendor: "HPE",       vendorGroup: "nonDell", environments: ON_PREM },
    { label: "IBM FlashSystem",           vendor: "IBM",       vendorGroup: "nonDell", environments: ON_PREM },
    { label: "Windows File Server",       vendor: "Microsoft", vendorGroup: "nonDell", environments: ON_PREM },
    { label: "Legacy Tape / VTL",         vendor: "Legacy",    vendorGroup: "custom",  environments: ["coreDc","drDc"] },
    // Public cloud
    { label: "AWS S3",                    vendor: "AWS",       vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "AWS EBS",                   vendor: "AWS",       vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Azure Blob Storage",        vendor: "Microsoft", vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Azure Files",               vendor: "Microsoft", vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Google Cloud Storage",      vendor: "Google",    vendorGroup: "nonDell", environments: CLOUD_ONLY }
  ],
  dataProtection: [
    // On-prem (Dell appliances + physical targets)
    { label: "PowerProtect Data Manager", vendor: "Dell",      vendorGroup: "dell",    environments: ON_PREM },
    { label: "PowerProtect DD9400",       vendor: "Dell",      vendorGroup: "dell",    environments: ["coreDc","drDc"] },
    { label: "PowerProtect DD6400",       vendor: "Dell",      vendorGroup: "dell",    environments: ON_PREM },
    { label: "PowerProtect DDVE",         vendor: "Dell",      vendorGroup: "dell"     /* virtual; valid anywhere */ },
    { label: "Cyber Recovery Vault",      vendor: "Dell",      vendorGroup: "dell",    environments: ON_PREM },
    { label: "APEX Backup Services",      vendor: "Dell",      vendorGroup: "dell"     /* SaaS; valid anywhere */ },
    // Backup software (run anywhere)
    { label: "Veeam Backup & Replication",vendor: "Veeam",     vendorGroup: "nonDell" },
    { label: "Commvault",                 vendor: "Commvault", vendorGroup: "nonDell" },
    { label: "Cohesity DataProtect",      vendor: "Cohesity",  vendorGroup: "nonDell" },
    { label: "Rubrik",                    vendor: "Rubrik",    vendorGroup: "nonDell" },
    { label: "Zerto",                     vendor: "Zerto",     vendorGroup: "nonDell" },
    { label: "Legacy Tape Backup",        vendor: "Legacy",    vendorGroup: "custom",  environments: ["coreDc","drDc"] },
    // Public cloud
    { label: "AWS Backup",                vendor: "AWS",       vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Azure Backup",              vendor: "Microsoft", vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "AWS S3 Glacier",            vendor: "AWS",       vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Druva",                     vendor: "Druva",     vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Commvault Cloud",           vendor: "Commvault", vendorGroup: "nonDell", environments: CLOUD_ONLY }
  ],
  virtualization: [
    // On-prem
    { label: "VxRail (VMware-based)",          vendor: "Dell",      vendorGroup: "dell",    environments: ON_PREM },
    { label: "APEX Cloud Platform (VMware)",   vendor: "Dell",      vendorGroup: "dell",    environments: ON_PREM },
    { label: "APEX Cloud Platform (Red Hat)",  vendor: "Dell",      vendorGroup: "dell",    environments: ON_PREM },
    { label: "VMware vSphere / vCenter",       vendor: "VMware",    vendorGroup: "nonDell", environments: ON_PREM },
    { label: "Microsoft Hyper-V",              vendor: "Microsoft", vendorGroup: "nonDell", environments: ON_PREM },
    { label: "Nutanix AHV",                    vendor: "Nutanix",   vendorGroup: "nonDell", environments: ON_PREM },
    { label: "Red Hat OpenShift",              vendor: "Red Hat",   vendorGroup: "nonDell" /* multi-env */ },
    { label: "Kubernetes (upstream)",          vendor: "CNCF",      vendorGroup: "custom"  /* multi-env */ },
    { label: "Proxmox VE",                     vendor: "Proxmox",   vendorGroup: "custom",  environments: ON_PREM },
    // Public cloud
    { label: "VMware Cloud on AWS",            vendor: "VMware",    vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Azure VMware Solution",          vendor: "Microsoft", vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Google Cloud VMware Engine",     vendor: "Google",    vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "AWS ECS",                        vendor: "AWS",       vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "AWS EKS",                        vendor: "AWS",       vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Azure AKS",                      vendor: "Microsoft", vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Google GKE",                     vendor: "Google",    vendorGroup: "nonDell", environments: CLOUD_ONLY }
  ],
  infrastructure: [
    // Dell fabric + management (on-prem)
    { label: "PowerSwitch (DC fabric)",             vendor: "Dell",       vendorGroup: "dell",    environments: ON_PREM },
    { label: "SmartFabric Director",                vendor: "Dell",       vendorGroup: "dell",    environments: ON_PREM },
    { label: "Dell SD-WAN (VeloCloud)",             vendor: "Dell",       vendorGroup: "dell"     /* multi-env */ },
    { label: "OpenManage Enterprise",               vendor: "Dell",       vendorGroup: "dell",    environments: ON_PREM },
    { label: "CloudIQ",                             vendor: "Dell",       vendorGroup: "dell"     /* SaaS */ },
    { label: "APEX Console",                        vendor: "Dell",       vendorGroup: "dell"     /* SaaS */ },
    { label: "Cyber Recovery + CyberSense",         vendor: "Dell",       vendorGroup: "dell",    environments: ON_PREM },
    { label: "PowerEdge Secured Component Verif.",  vendor: "Dell",       vendorGroup: "dell",    environments: ON_PREM },
    // Non-Dell on-prem / multi-env networking & security
    { label: "Cisco Nexus (DC)",                    vendor: "Cisco",      vendorGroup: "nonDell", environments: ["coreDc","drDc"] },
    { label: "Cisco Catalyst (Campus)",             vendor: "Cisco",      vendorGroup: "nonDell", environments: ON_PREM },
    { label: "Palo Alto NGFW",                      vendor: "Palo Alto",  vendorGroup: "nonDell" /* multi-env */ },
    { label: "Zscaler ZIA / ZPA (SASE)",            vendor: "Zscaler",    vendorGroup: "nonDell" /* multi-env SaaS */ },
    { label: "Microsoft Entra ID / AD",             vendor: "Microsoft",  vendorGroup: "nonDell" /* multi-env */ },
    { label: "CrowdStrike Falcon",                  vendor: "CrowdStrike",vendorGroup: "nonDell" /* multi-env SaaS */ },
    { label: "ServiceNow ITSM",                     vendor: "ServiceNow", vendorGroup: "nonDell" /* SaaS */ },
    { label: "Datadog / Splunk Observability",      vendor: "Various",    vendorGroup: "nonDell" /* multi-env */ },
    { label: "Ansible / Terraform Automation",      vendor: "Various",    vendorGroup: "nonDell" /* multi-env */ },
    { label: "HPE Aruba Networking",                vendor: "HPE",        vendorGroup: "nonDell", environments: ON_PREM },
    // Public cloud
    { label: "Cloudflare",                          vendor: "Cloudflare", vendorGroup: "nonDell" /* SaaS */ },
    { label: "AWS Direct Connect",                  vendor: "AWS",        vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Azure ExpressRoute",                  vendor: "Microsoft",  vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "AWS IAM",                             vendor: "AWS",        vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "AWS CloudWatch",                      vendor: "AWS",        vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "Azure Monitor",                       vendor: "Microsoft",  vendorGroup: "nonDell", environments: CLOUD_ONLY },
    { label: "GCP Cloud Logging",                   vendor: "Google",     vendorGroup: "nonDell", environments: CLOUD_ONLY }
  ]
};

// ---------------------------------------------------------------------------
// Business drivers — 8 Gartner-aligned CxO priorities.
// Each driver carries its display metadata AND its conversation starter so
// views only need one source of truth.
// ---------------------------------------------------------------------------
export const BUSINESS_DRIVERS = [
  {
    id: "ai_data",
    label: "AI & Data Platforms",
    shortHint: "We need to get real value from AI and our data, fast.",
    conversationStarter: "Where would a ready-to-use AI or data platform create measurable business value in the next 12 months — and what is blocking you from starting today?"
  },
  {
    id: "cyber_resilience",
    label: "Cyber Resilience",
    shortHint: "We must recover from attacks without paying, and prove it.",
    conversationStarter: "If ransomware hit your most critical system tomorrow, what is your recovery time — and when did you last test the full playbook end-to-end?"
  },
  {
    id: "cost_optimization",
    label: "Cost Optimization",
    shortHint: "Cut infrastructure spend without breaking delivery.",
    conversationStarter: "If you had to take 20% out of infrastructure spend over the next 24 months, which layer would you attack first and what is stopping you?"
  },
  {
    id: "cloud_strategy",
    label: "Cloud Strategy",
    shortHint: "Right workload, right place — stop cloud bills spiralling.",
    conversationStarter: "Which workloads have surprised you most with their cloud bill — and are any of them candidates to come back on-prem or to a private platform?"
  },
  {
    id: "modernize_infra",
    label: "Modernize Aging Infrastructure",
    shortHint: "Too much of our estate is old and fragile.",
    conversationStarter: "What is the oldest piece of infrastructure that keeps your team up at night — and why hasn't it been replaced yet?"
  },
  {
    id: "ops_simplicity",
    label: "Operational Simplicity",
    shortHint: "The team is firefighting; we want fewer tools and less toil.",
    conversationStarter: "What percentage of your team's week goes to reactive firefighting versus planned improvement work — and where does most of the noise come from?"
  },
  {
    id: "compliance_sovereignty",
    label: "Compliance & Sovereignty",
    shortHint: "Auditors and regulators are getting strict; we must be ready.",
    conversationStarter: "Which compliance or data-sovereignty frameworks bite you hardest today — and where are your biggest evidence gaps if an audit landed this quarter?"
  },
  {
    id: "sustainability",
    label: "Sustainability / ESG",
    shortHint: "Leadership is committed to measurable energy / carbon targets.",
    conversationStarter: "What energy-efficiency or carbon targets has leadership committed to — and how are you measuring infrastructure's contribution today?"
  }
];

// Legacy label → canonical id. Used only by sessionStore migration for sessions
// saved before v2.0 that carried `customer.primaryDriver` as a free-text label.
export const LEGACY_DRIVER_LABEL_TO_ID = {
  "Cost Reduction / TCO":           "cost_optimization",
  "Resilience & Security":          "cyber_resilience",
  "Cloud Migration / Repatriation": "cloud_strategy",
  "AI / Analytics Enablement":      "ai_data",
  "Infrastructure Modernization":   "modernize_infra",
  "M&A Integration":                "modernize_infra",
  "Compliance & Governance":        "compliance_sovereignty",
  "Operational Efficiency":         "ops_simplicity"
};

// Alphabetised list. Energy + Utilities added per Tab 1 spec.
export const CUSTOMER_VERTICALS = [
  "Education",
  "Energy",
  "Enterprise",
  "Financial Services",
  "Government & Security",
  "Healthcare",
  "Public Sector",
  "SMB",
  "Telecommunications",
  "Utilities"
];

// Derived: label → conversationStarter map. Preserved for any legacy code that
// reads coaching prompts by label; authoritative data lives on BUSINESS_DRIVERS.
export const COACHING_PROMPTS = BUSINESS_DRIVERS.reduce(function(acc, d) {
  acc[d.label] = d.conversationStarter;
  return acc;
}, {});
