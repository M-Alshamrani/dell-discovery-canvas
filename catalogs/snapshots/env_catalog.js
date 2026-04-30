// catalogs/snapshots/env_catalog.js — v3.0 · ENV_CATALOG snapshot
// 8 environment kinds. Lifted from v2.4.14 core/config.js ENV_CATALOG.

export default Object.freeze({
  catalogId: "ENV_CATALOG",
  catalogVersion: "2026.04",
  entries: [
    { id: "coreDc",         label: "Primary Data Center",     hint: "The main on-premises site" },
    { id: "drDc",           label: "Disaster Recovery Site",  hint: "Active or warm standby for failover" },
    { id: "archiveSite",    label: "Archive Site",            hint: "Compliance archive, immutable backups, tertiary tier" },
    { id: "publicCloud",    label: "Public Cloud",            hint: "AWS, Azure, GCP, Oracle" },
    { id: "edge",           label: "Branch & Edge Sites",     hint: "Retail, factory floor, remote offices" },
    { id: "coLo",           label: "Co-location",             hint: "Third-party data center space" },
    { id: "managedHosting", label: "Managed Hosting",         hint: "Provider-operated dedicated hosting" },
    { id: "sovereignCloud", label: "Sovereign Cloud",         hint: "In-region regulated cloud (UAE, KSA, EU)" }
  ]
});
