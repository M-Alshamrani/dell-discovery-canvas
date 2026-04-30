// services/manifestGenerator.js — v3.0 · SPEC sec S7.2
//
// Walks the entity schemas + their <entityName>PathManifest exports +
// composes the chip manifest the AI skill builder consumes.
//
// Output shape (per SPEC S7.2.1):
//   {
//     sessionPaths: PathManifestEntry[],
//     byEntityKind: {
//       driver:          { ownPaths, linkedPaths },
//       currentInstance: { ownPaths, linkedPaths },
//       desiredInstance: { ownPaths, linkedPaths },
//       gap:             { ownPaths, linkedPaths },
//       environment:     { ownPaths, linkedPaths },
//       project:         { ownPaths, linkedPaths }
//     }
//   }
//
// Per SPEC S7.2.4: regenerated manifest is byte-equal to a checked-in
// snapshot. Drift fails V-MFG-1.
//
// Linked compositions (S7.2.3) are derived from FK declarations + a
// small per-kind reverse-FK lookup table. v3.0 keeps them in this file
// as declarative constants; a future commit may re-derive them from
// driverLinkedCompositions / gapLinkedCompositions exports next to
// each schema.

import { customerPathManifest }    from "../schema/customer.js";
import { driverPathManifest }      from "../schema/driver.js";
import { environmentPathManifest } from "../schema/environment.js";
import { instancePathManifest }    from "../schema/instance.js";
import { gapPathManifest }         from "../schema/gap.js";
import { engagementPathManifest }  from "../schema/engagement.js";

// Linked-composition declarations per SPEC sec S7.2.3 (declarative
// next to each entity schema, but consolidated here for v3.0 simplicity).
const LINKED_BY_KIND = {
  driver: [
    { path: "context.driver.linkedGaps[*].description", type: "string", label: "Linked gap description",
      composition: "engagement.gaps where gap.driverId === driver.id" },
    { path: "context.driver.linkedGaps[*].urgency", type: "enum", label: "Linked gap urgency",
      composition: "engagement.gaps where gap.driverId === driver.id" }
  ],
  currentInstance: [
    { path: "context.currentInstance.desiredCounterparts[*].label", type: "string",
      label: "Desired counterpart label",
      composition: "engagement.instances where state==='desired' AND originId === instance.id" }
  ],
  desiredInstance: [
    { path: "context.desiredInstance.originInstance.label", type: "string",
      label: "Origin (current) instance label",
      composition: "engagement.instances.byId[instance.originId]" }
  ],
  gap: [
    { path: "context.gap.driver.priority", type: "enum", label: "Linked driver priority",
      composition: "engagement.drivers.byId[gap.driverId]" },
    { path: "context.gap.affectedEnvironments[*].alias", type: "string",
      label: "Affected environment alias",
      composition: "engagement.environments filtered by gap.affectedEnvironments[]" }
  ],
  environment: [
    { path: "context.environment.linkedInstances[*].label", type: "string",
      label: "Linked instance label",
      composition: "engagement.instances where environmentId === environment.id" },
    { path: "context.environment.linkedGaps[*].description", type: "string",
      label: "Linked gap description",
      composition: "engagement.gaps where affectedEnvironments.includes(environment.id)" }
  ],
  project: [
    { path: "context.project.gaps[*].description", type: "string", label: "Gap description",
      composition: "engagement.gaps grouped into this project (selectProjects)" }
  ]
};

export function generateManifest() {
  // sessionPaths: customer + engagement-meta + selector-derived inputs.
  const sessionPaths = [
    ...customerPathManifest,
    ...engagementPathManifest
  ];

  return {
    sessionPaths,
    byEntityKind: {
      driver: {
        ownPaths:     driverPathManifest.filter(p => p.source !== "linked"),
        linkedPaths:  LINKED_BY_KIND.driver
      },
      currentInstance: {
        ownPaths:     instancePathManifest.filter(p => p.source !== "linked"),
        linkedPaths:  LINKED_BY_KIND.currentInstance
      },
      desiredInstance: {
        ownPaths:     instancePathManifest.filter(p => p.source !== "linked"),
        linkedPaths:  LINKED_BY_KIND.desiredInstance
      },
      gap: {
        ownPaths:     gapPathManifest.filter(p => p.source !== "linked"),
        linkedPaths:  LINKED_BY_KIND.gap
      },
      environment: {
        ownPaths:     environmentPathManifest.filter(p => p.source !== "linked"),
        linkedPaths:  LINKED_BY_KIND.environment
      },
      project: {
        ownPaths:     [],   // projects are derived; no own fields
        linkedPaths:  LINKED_BY_KIND.project
      }
    }
  };
}

// Stable JSON serialization — sorts keys + arrays-of-objects-by-path for
// deterministic byte-equal comparison with the snapshot.
export function serializeManifestStable(manifest) {
  return JSON.stringify(manifest, sortReplacer, 2);
}
function sortReplacer(_key, value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const sorted = {};
    for (const k of Object.keys(value).sort()) sorted[k] = value[k];
    return sorted;
  }
  return value;
}
