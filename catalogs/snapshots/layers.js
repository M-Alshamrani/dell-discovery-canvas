// catalogs/snapshots/layers.js — v3.0 · LAYERS catalog snapshot
// Authoritative source for the 6-layer taxonomy. Lifted from v2.4.16
// core/config.js LAYERS constant.

export default Object.freeze({
  catalogId: "LAYERS",
  catalogVersion: "2026.04",
  entries: [
    { id: "workload",       label: "Workloads & Business Apps" },
    { id: "compute",        label: "Compute" },
    { id: "storage",        label: "Data Storage" },
    { id: "dataProtection", label: "Data Protection & Recovery" },
    { id: "virtualization", label: "Virtualization & Hypervisors" },
    { id: "infrastructure", label: "Infrastructure Services" }
  ]
});
