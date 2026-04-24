// state/sessionStore.js — single source of truth

import { LEGACY_DRIVER_LABEL_TO_ID } from "../core/config.js";

const STORAGE_KEY = "dell_discovery_v1";

export function createEmptySession() {
  return {
    sessionId:    "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    isDemo:       false,
    customer: {
      name:           "",
      vertical:       "",
      segment:        "",
      industry:       "",
      region:         "",
      drivers:        []
    },
    sessionMeta: {
      date:          new Date().toISOString().slice(0, 10),
      presalesOwner: "",
      status:        "Draft",
      version:       "2.0"
    },
    instances:  [],
    gaps:       []
  };
}

export function createDemoSession() {
  return {
    sessionId:  "sess-demo-001",
    isDemo:     true,
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
          outcomes:  "Achieve full cyber resilience and reduce infrastructure TCO by 20% over 24 months, meeting NIS2 compliance by Q3 2026."
        },
        {
          id:        "cost_optimization",
          priority:  "Medium",
          outcomes:  "Contain infrastructure OpEx growth; reduce Broadcom / VMware licensing exposure."
        }
      ]
    },
    sessionMeta: {
      date:          new Date().toISOString().slice(0, 10),
      presalesOwner: "Example Presales",
      status:        "In Progress",
      version:       "2.0"
    },
    instances: [
      // Current state
      { id:"i-001", state:"current", layerId:"compute",        environmentId:"coreDc",     label:"PowerEdge (current gen)",   vendor:"Dell",      vendorGroup:"dell",    criticality:"Medium", notes:"~60% aged 4+ years." },
      { id:"i-002", state:"current", layerId:"compute",        environmentId:"drDc",       label:"HPE ProLiant",              vendor:"HPE",       vendorGroup:"nonDell", criticality:"Low",    notes:"Aging DR compute." },
      { id:"i-003", state:"current", layerId:"storage",        environmentId:"coreDc",     label:"Unity XT",                  vendor:"Dell",      vendorGroup:"dell",    criticality:"High",   notes:"90% capacity. DB performance issues." },
      { id:"i-004", state:"current", layerId:"storage",        environmentId:"coreDc",     label:"NetApp AFF / FAS",          vendor:"NetApp",    vendorGroup:"nonDell", criticality:"Medium", notes:"NAS tier -- large unstructured data." },
      { id:"i-005", state:"current", layerId:"dataProtection", environmentId:"coreDc",     label:"Veeam Backup & Replication",vendor:"Veeam",     vendorGroup:"nonDell", criticality:"High",   notes:"Jobs failing 2-3x/week. No air-gap." },
      { id:"i-006", state:"current", layerId:"dataProtection", environmentId:"publicCloud",label:"AWS Backup",                vendor:"AWS",       vendorGroup:"nonDell", criticality:"Medium", notes:"Cloud workloads only." },
      { id:"i-007", state:"current", layerId:"virtualization", environmentId:"coreDc",     label:"VMware vSphere / vCenter",  vendor:"VMware",    vendorGroup:"nonDell", criticality:"High",   notes:"Broadcom licensing 3x cost increase." },
      { id:"i-008", state:"current", layerId:"infrastructure", environmentId:"coreDc",     label:"Cisco Nexus (DC)",          vendor:"Cisco",     vendorGroup:"nonDell", criticality:"Medium", notes:"Manual VLAN provisioning." },
      { id:"i-009", state:"current", layerId:"infrastructure", environmentId:"coreDc",     label:"Microsoft Entra ID / AD",   vendor:"Microsoft", vendorGroup:"nonDell", criticality:"High",   notes:"No privileged access management." },
      // Desired state (with dispositions)
      { id:"d-001", state:"desired", layerId:"compute",        environmentId:"coreDc",     label:"PowerEdge (current gen)",   vendor:"Dell",      vendorGroup:"dell",    priority:"Now",  timeline:"0-12 months",  disposition:"replace",     originId:"i-001", notes:"Refresh aging estate." },
      { id:"d-002", state:"desired", layerId:"storage",        environmentId:"coreDc",     label:"PowerStore",                vendor:"Dell",      vendorGroup:"dell",    priority:"Now",  timeline:"0-12 months",  disposition:"replace",     originId:"i-003", notes:"Replace Unity XT. Single platform." },
      { id:"d-003", state:"desired", layerId:"storage",        environmentId:"coreDc",     label:"PowerScale (Isilon)",       vendor:"Dell",      vendorGroup:"dell",    priority:"Next", timeline:"12-24 months", disposition:"consolidate", originId:"i-004", notes:"Consolidate NAS." },
      { id:"d-004", state:"desired", layerId:"dataProtection", environmentId:"coreDc",     label:"PowerProtect Data Manager", vendor:"Dell",      vendorGroup:"dell",    priority:"Now",  timeline:"0-12 months",  disposition:"replace",     originId:"i-005", notes:"Replace Veeam." },
      { id:"d-005", state:"desired", layerId:"dataProtection", environmentId:"coreDc",     label:"Cyber Recovery Vault",      vendor:"Dell",      vendorGroup:"dell",    priority:"Now",  timeline:"0-12 months",  disposition:"enhance",     notes:"Air-gapped vault. Board priority." },
      { id:"d-006", state:"desired", layerId:"virtualization", environmentId:"coreDc",     label:"VxRail (VMware-based)",     vendor:"Dell",      vendorGroup:"dell",    priority:"Next", timeline:"12-24 months", disposition:"replace",     originId:"i-007", notes:"Reduce VMware licensing exposure." }
    ],
    gaps: [
      {
        id:"g-001", description:"No immutable backup -- full ransomware exposure",
        layerId:"dataProtection", affectedLayers:["dataProtection","storage"],
        affectedEnvironments:["coreDc"],
        gapType:"replace", urgency:"High", phase:"now",
        mappedDellSolutions:"PowerProtect PPDM, DD9400, Cyber Recovery + CyberSense",
        notes:"Near-miss ransomware Q4 2025. Board priority. NIS2 deadline Q3 2026.",
        relatedCurrentInstanceIds:["i-005"], relatedDesiredInstanceIds:["d-004","d-005"],
        status:"open"
      },
      {
        id:"g-002", description:"Unity XT at 90% capacity -- performance degrading",
        layerId:"storage", affectedLayers:["storage"], affectedEnvironments:["coreDc"],
        gapType:"replace", urgency:"High", phase:"now",
        mappedDellSolutions:"PowerStore mid-range",
        notes:"Storage SLA breaches. Cannot expand without refresh.",
        relatedCurrentInstanceIds:["i-003"], relatedDesiredInstanceIds:["d-002"],
        status:"open"
      },
      {
        id:"g-003", description:"VMware licensing tripled -- HCI modernisation needed",
        layerId:"virtualization", affectedLayers:["virtualization","compute"],
        affectedEnvironments:["coreDc"],
        gapType:"replace", urgency:"Medium", phase:"next",
        mappedDellSolutions:"VxRail (VMware-based HCI)",
        notes:"Broadcom renewal due in 18 months.",
        relatedCurrentInstanceIds:["i-007"], relatedDesiredInstanceIds:["d-006"],
        status:"open"
      },
      {
        id:"g-004", description:"Aging compute -- 60% servers approaching end of support",
        layerId:"compute", affectedLayers:["compute"], affectedEnvironments:["coreDc","drDc"],
        gapType:"replace", urgency:"Medium", phase:"now",
        mappedDellSolutions:"PowerEdge (current gen)",
        notes:"Hardware maintenance costs increasing.",
        relatedCurrentInstanceIds:["i-001","i-002"], relatedDesiredInstanceIds:["d-001"],
        status:"open"
      },
      {
        id:"g-005", description:"No cloud governance -- uncontrolled AWS spend",
        layerId:"infrastructure", affectedLayers:["infrastructure"],
        affectedEnvironments:["publicCloud"],
        gapType:"ops", urgency:"Low", phase:"later",
        mappedDellSolutions:"APEX Cloud Platform",
        notes:"AWS spend growing 30% YoY. Repatriation candidates identified.",
        relatedCurrentInstanceIds:[], relatedDesiredInstanceIds:[],
        status:"open"
      }
    ]
  };
}

/**
 * Migrate a raw session object from any pre-v2 shape into the current shape.
 * Pure function — does not touch the live `session` export.
 * Rules (mirrors SPEC §2.5):
 *   - Ensure customer.{name,vertical,segment,industry,region} all exist (empty strings ok).
 *   - If customer.drivers is missing, derive from customer.primaryDriver + session.businessOutcomes
 *     via LEGACY_DRIVER_LABEL_TO_ID. Unknown / empty labels → drivers = [].
 *   - Always strip legacy primaryDriver and businessOutcomes keys.
 *   - instances[*].timeline preserved on read; dropped by next save's JSON round-trip only
 *     because views will no longer emit it. (We do not forcibly delete here.)
 *   - gaps[*].driverId not auto-populated here; renderer derives at display time.
 *   - Ensure arrays for instances and gaps.
 *   - Ensure sessionMeta + sessionId exist.
 */
export function migrateLegacySession(raw) {
  var s = raw || {};
  if (!s.customer || typeof s.customer !== "object") s.customer = {};
  var c = s.customer;

  if (typeof c.name     === "undefined") c.name     = "";
  if (typeof c.vertical === "undefined") c.vertical = c.segment || c.industry || "";
  if (typeof c.segment  === "undefined") c.segment  = "";
  if (typeof c.industry === "undefined") c.industry = "";
  if (typeof c.region   === "undefined") c.region   = "";

  if (!Array.isArray(c.drivers)) {
    var legacyLabel    = c.primaryDriver;
    var legacyOutcomes = s.businessOutcomes;
    if (legacyLabel && LEGACY_DRIVER_LABEL_TO_ID[legacyLabel]) {
      c.drivers = [{
        id:       LEGACY_DRIVER_LABEL_TO_ID[legacyLabel],
        priority: "High",
        outcomes: legacyOutcomes || ""
      }];
    } else {
      c.drivers = [];
    }
  }
  delete c.primaryDriver;
  delete s.businessOutcomes;

  if (!Array.isArray(s.instances)) s.instances = [];
  if (!Array.isArray(s.gaps))      s.gaps      = [];

  // v2.1 rule 6: default `reviewed` on any gap missing it.
  //   auto-drafted (has linked desired tiles) → reviewed: false (surfaces the dot)
  //   everything else                         → reviewed: true
  s.gaps.forEach(function(g) {
    if (typeof g.reviewed !== "boolean") {
      g.reviewed = !((g.relatedDesiredInstanceIds || []).length > 0);
    }
  });

  if (!s.sessionMeta || typeof s.sessionMeta !== "object") {
    s.sessionMeta = {
      date:          new Date().toISOString().slice(0, 10),
      presalesOwner: "",
      status:        "Draft",
      version:       "2.0"
    };
  }

  if (!s.sessionId) {
    s.sessionId = "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  }

  return s;
}

export let session = (function() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateLegacySession(JSON.parse(raw));
  } catch(e) {}
  // v2.1 · also pipe demo session through migration so it receives defaults
  // (e.g. `reviewed` on auto-drafted gaps). Pure / idempotent.
  return migrateLegacySession(createDemoSession());
})();

export function resetSession() {
  var fresh = createEmptySession();
  Object.keys(session).forEach(function(k) { delete session[k]; });
  Object.assign(session, fresh);
}

export function resetToDemo() {
  var demo = migrateLegacySession(createDemoSession());
  Object.keys(session).forEach(function(k) { delete session[k]; });
  Object.assign(session, demo);
}

// v2.4.4 — Replace live session state with a supplied snapshot (e.g. an
// undo-stack restore). Keeps the module-scoped `session` identity so
// every importer continues to see live data without re-importing.
export function replaceSession(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  Object.keys(session).forEach(function(k) { delete session[k]; });
  Object.assign(session, snapshot);
}

export function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch(e) {
    console.warn("Save failed:", e);
    return false;
  }
}

export function loadFromLocalStorage() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    var migrated = migrateLegacySession(JSON.parse(raw));
    Object.keys(session).forEach(function(k) { delete session[k]; });
    Object.assign(session, migrated);
    return true;
  } catch(e) {
    console.warn("Load failed:", e);
    return false;
  }
}
