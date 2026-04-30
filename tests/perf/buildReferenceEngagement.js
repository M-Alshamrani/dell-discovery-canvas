// tests/perf/buildReferenceEngagement.js — v3.0 · SPEC sec S14.3.1
//
// Deterministically builds the acme-demo reference engagement: 200
// instances + 12 gaps + 4 drivers + 3 environments. Per V-PERF-SCALE-1
// the instance count is locked at exactly 200 — silent demo growth
// would silently relax the perf budgets.
//
// Used by:
//   - V-PERF-1..6 (selector + sweep + render budgets)
//   - V-PERF-SCALE-1 (regression guard)
//
// All ids are deterministic (generated via generateDeterministicId so
// re-running the builder produces byte-identical engagements).

import { createEmptyEngagement } from "../../schema/engagement.js";
import { addDriver }      from "../../state/collections/driverActions.js";
import { addEnvironment } from "../../state/collections/environmentActions.js";
import { addInstance }    from "../../state/collections/instanceActions.js";
import { addGap }         from "../../state/collections/gapActions.js";
import { generateDeterministicId } from "../../migrations/helpers/deterministicId.js";

const LAYERS = ["compute", "storage", "dataProtection", "virtualization", "infrastructure", "workload"];
const VENDORS = [
  ["Dell PowerEdge",     "dell"],
  ["Dell PowerStore",    "dell"],
  ["Dell PowerProtect",  "dell"],
  ["HPE ProLiant",       "nonDell"],
  ["NetApp ONTAP",       "nonDell"],
  ["Cisco UCS",          "nonDell"],
  ["Custom-built",       "custom"]
];
const ENVS = ["coreDc", "drDc", "publicCloud"];

// Patch crypto.randomUUID so addX functions produce deterministic ids.
// We rely on the action functions using crypto.randomUUID(); for deterministic
// fixture build we override globally for the duration of build().
function withDeterministicIds(fn) {
  const seed = "perf-reference-engagement";
  let counter = 0;
  const original = (typeof crypto !== "undefined") ? crypto.randomUUID?.bind(crypto) : null;
  if (typeof crypto !== "undefined") {
    crypto.randomUUID = () => generateDeterministicId("ref", seed, String(counter++));
  }
  try {
    return fn();
  } finally {
    if (original) crypto.randomUUID = original;
  }
}

export function buildReferenceEngagement() {
  return withDeterministicIds(() => {
    // Hex-only UUID (no "m"; original "acme00000000" was invalid).
    const REF_ENGAGEMENT_ID = "00000000-0000-4000-8000-ace000000000";
    let eng = createEmptyEngagement({
      meta: {
        engagementId: REF_ENGAGEMENT_ID,
        presalesOwner: "Reference Builder"
      },
      customer: {
        engagementId: REF_ENGAGEMENT_ID,
        name: "Acme Financial Services",
        vertical: "Financial Services",
        region: "EMEA",
        notes: ""
      }
    });

    // 4 drivers
    const driverIds = [];
    for (const did of ["ai_data", "cyber_resilience", "modernize_infra", "cost_optimization"]) {
      const r = addDriver(eng, { businessDriverId: did, priority: "Medium",
        catalogVersion: "2026.04", outcomes: "Outcome for " + did });
      eng = r.engagement;
      driverIds.push(eng.drivers.allIds[eng.drivers.allIds.length - 1]);
    }

    // 3 environments
    const envIds = [];
    for (const eid of ENVS) {
      const r = addEnvironment(eng, { envCatalogId: eid, catalogVersion: "2026.04" });
      eng = r.engagement;
      envIds.push(eng.environments.allIds[eng.environments.allIds.length - 1]);
    }

    // 200 instances: 100 current + 100 desired, distributed across
    // (env, layer, vendor) cells. Deterministic round-robin keeps the
    // same shape every build.
    let count = 0;
    for (let i = 0; i < 100; i++) {
      const env    = envIds[i % envIds.length];
      const layer  = LAYERS[i % LAYERS.length];
      const [vendor, group] = VENDORS[i % VENDORS.length];
      const r = addInstance(eng, {
        state: "current", layerId: layer, environmentId: env,
        label: vendor + " #" + i, vendor, vendorGroup: group,
        criticality: ["High","Medium","Low"][i % 3],
        disposition: ["keep","enhance","replace"][i % 3]
      });
      eng = r.engagement;
      count += 1;
    }
    for (let i = 0; i < 100; i++) {
      const env   = envIds[i % envIds.length];
      const layer = LAYERS[i % LAYERS.length];
      const [vendor, group] = VENDORS[i % VENDORS.length];
      const r = addInstance(eng, {
        state: "desired", layerId: layer, environmentId: env,
        label: vendor + " desired #" + i, vendor, vendorGroup: group,
        criticality: ["High","Medium","Low"][i % 3],
        disposition: ["keep","enhance","replace"][i % 3]
      });
      eng = r.engagement;
      count += 1;
    }

    // 12 gaps
    for (let i = 0; i < 12; i++) {
      const env   = envIds[i % envIds.length];
      const layer = LAYERS[i % LAYERS.length];
      const r = addGap(eng, {
        description: "Reference gap #" + i + " in " + layer,
        gapType: ["replace","enhance","introduce","ops","consolidate"][i % 5],
        urgency: ["High","Medium","Low"][i % 3],
        phase: ["now","next","later"][i % 3],
        status: ["open","in_progress"][i % 2],
        layerId: layer,
        affectedLayers: [layer],
        affectedEnvironments: [env],
        driverId: driverIds[i % driverIds.length]
      });
      eng = r.engagement;
    }

    return eng;
  });
}
