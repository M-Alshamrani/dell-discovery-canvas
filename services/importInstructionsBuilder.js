// services/importInstructionsBuilder.js — rc.8 / C3a (SPEC §S47.4 + §S47.10)
//
// Builds the context-aware .txt instructions file the engineer downloads
// from the "Import data" footer button (Step 1 of the 2-step modal). The
// engineer takes the file to the Dell internal LLM (separate environment;
// cannot send sensitive data via Claude API), feeds it their source data,
// and receives a JSON response in the canonical S47.3 shape. Step 2 of
// the modal uploads the JSON; the shared importer + preview modal handle
// the rest.
//
// CONTRACT (per SPEC §S47.4):
//   - R47.4.1 · output filename ends in .txt (universal; no .md viewer
//     assumed). Internal structure uses markdown conventions for
//     readability but the extension is .txt.
//   - R47.4.2 · filename convention:
//       dell-canvas-import-instructions-<customer-slug>-<YYYYMMDD>-<HHmmss>.txt
//     Multiple generations don't collide (timestamp).
//   - R47.4.3 · 11 content sections (header, customer ctx, env slots,
//     data schema, glossary, output shape, confidence guide, state-hint
//     guide, worked examples, strict-match warning, system prompt body).
//   - R47.4.4 · State-hint guidance (current vs desired vs null).
//   - R47.4.5 · CONTEXT-AWARE: regenerated against the LIVE engagement
//     at click time. If the engineer adds/removes envs between two
//     generations, the second download supersedes the first.
//   - R47.8.3 · strict-match warning text verbatim.
//
// Authority: docs/v3.0/SPEC.md §S47.4 + §S47.8.3 + §S47.10
//            (V-FLOW-IMPORT-INSTRUCTIONS-1/2/3).

import { ENV_CATALOG } from "../core/config.js";

// Slugify a customer name for the filename · lowercase + non-alphanumeric
// to hyphens + collapse runs + trim. Empty / falsy customer name yields
// "untitled" so the filename is always well-formed.
function slugify(s) {
  if (!s || typeof s !== "string") return "untitled";
  return s.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          || "untitled";
}

// UTC timestamp formatted YYYYMMDD-HHmmss for filename collision-resistance.
function utcStamp(d) {
  d = d || new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const mo = pad(d.getUTCMonth() + 1);
  const da = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return y + mo + da + "-" + hh + mm + ss;
}

// Resolve an environment's display label from its envCatalogId. Falls
// back to the raw catalog id if no catalog entry is found (defensive
// against future catalog drift).
function envLabelFor(envCatalogId) {
  const entry = ENV_CATALOG.find((c) => c.id === envCatalogId);
  return entry ? entry.label : envCatalogId;
}

// Build a markdown-style env-slot table for the instructions body. Each
// row carries UUID + resolved label + envCatalogId so the LLM has both
// the FK target (UUID) AND the human-readable hint.
function buildEnvSlotTable(engagement) {
  const allIds = (engagement && engagement.environments && Array.isArray(engagement.environments.allIds))
    ? engagement.environments.allIds : [];
  const byId   = (engagement && engagement.environments && engagement.environments.byId)   || {};
  if (allIds.length === 0) {
    return "(no environments defined in the engagement · add at least one environment in the Context tab before generating instructions)";
  }
  const lines = [];
  lines.push("| UUID | Label | Catalog ID |");
  lines.push("|---|---|---|");
  allIds.forEach((uuid) => {
    const env = byId[uuid] || {};
    const label = env.alias || envLabelFor(env.envCatalogId);
    lines.push("| `" + uuid + "` | " + label + " | " + (env.envCatalogId || "?") + " |");
  });
  return lines.join("\n");
}

// buildImportInstructions(engagement, opts) -> { filename, content }
//   engagement       - the LIVE engagement object (with customer + environments)
//   opts.scope       - "current" | "desired" | "both" (default "desired")
//                      embedded into the state-hint guidance so the engineer's
//                      modal-scope choice surfaces in the instructions too.
//   opts.now         - Date for tests (defaults to new Date())
export function buildImportInstructions(engagement, opts) {
  const scope = (opts && opts.scope) || "desired";
  const now   = (opts && opts.now)   || new Date();

  const customer = engagement && engagement.customer || {};
  const customerName = customer.name || "Untitled Customer";
  const customerVertical = customer.vertical || "(unspecified vertical)";
  const customerRegion = customer.region || "(unspecified region)";

  const engCreatedAt = (engagement && engagement.meta && engagement.meta.createdAt)
    || (engagement && engagement.meta && engagement.meta.engagementDate)
    || "(unspecified date)";

  const filename = "dell-canvas-import-instructions-"
                 + slugify(customerName) + "-" + utcStamp(now) + ".txt";

  const envTable = buildEnvSlotTable(engagement);

  // R47.4.3 content sections - assembled in the order specified.
  const sections = [];

  // 1. Header
  sections.push(
    "# Dell Discovery Canvas — data extraction instructions",
    "",
    "These instructions are auto-generated against the LIVE engagement at the moment you clicked \"Generate instructions\". Take this file to the Dell internal LLM and feed it the customer's source data (Excel install-base, CSV inventory, PDF estate diagram, etc). Return the LLM's JSON response to the Discovery Canvas via Step 2 of the Import data modal.",
    ""
  );

  // 2. Customer context
  sections.push(
    "## 1. Customer context",
    "",
    "- **Customer**: " + customerName,
    "- **Vertical**: " + customerVertical,
    "- **Region**: " + customerRegion,
    "- **Engagement date**: " + engCreatedAt,
    "- **Apply scope (engineer's intent)**: " + scope,
    ""
  );

  // 3. Environment slots (CRITICAL · the LLM MUST map every row to a UUID below)
  sections.push(
    "## 2. Environment slots (CRITICAL · the LLM MUST map every extracted row to one of these UUIDs)",
    "",
    "Every `items[].data.environmentId` in your JSON response MUST be one of the UUIDs in the table below — verbatim. Do NOT invent UUIDs; do NOT remap to friendly names; do NOT use the envCatalogId in place of the UUID. The Discovery Canvas validates strict-match on import and rejects responses that reference any UUID not in this list.",
    "",
    envTable,
    ""
  );

  // 4. Data schema for instance entity
  sections.push(
    "## 3. Data schema (instance entity)",
    "",
    "Each `items[].data` MUST conform to this shape:",
    "",
    "- `state`: `\"current\"` | `\"desired\"` | `null` (HINT — see §6 state-hint guidance)",
    "- `layerId`: one of `compute` | `storage` | `network` | `security` | `workload` (FK to LAYERS catalog)",
    "- `environmentId`: one of the UUIDs in §2 above",
    "- `label`: human-readable name (≤ 60 chars)",
    "- `vendor`: vendor name as it appears in source",
    "- `vendorGroup`: `\"dell\"` | `\"nonDell\"` | `\"custom\"`",
    "- `criticality`: `\"High\"` | `\"Medium\"` | `\"Low\"`",
    "- `notes`: any relevant context (license, EOL, version) ≤ 200 chars; \"\" if none",
    ""
  );

  // 5. Semantic glossary
  sections.push(
    "## 4. Semantic glossary",
    "",
    "- **Layer** is the technology plane the instance lives in (compute = servers/VMs/containers; storage = arrays/object/file; network = switches/routers/load-balancers; security = firewalls/IDS/IPS; workload = applications running on the above).",
    "- **Environment** is the SITE (Primary DC, DR Site, Public Cloud, Edge etc.) the instance physically resides in. Always a UUID; resolve via §2.",
    "- **Current** instances exist today in the customer's estate. **Desired** instances are proposed / planned / future-state. See §6.",
    "- **Criticality** is the instance's business importance (mission-critical / important / routine), NOT its technical risk.",
    ""
  );

  // 6. Required output JSON shape
  sections.push(
    "## 5. Required output JSON shape",
    "",
    "Output ONLY this JSON object · no prose, no markdown fences, no commentary:",
    "",
    "```json",
    "{",
    "  \"schemaVersion\": \"1.0\",",
    "  \"kind\": \"instance.add\",",
    "  \"generatedAt\": \"<ISO instant of when you generated this response>\",",
    "  \"items\": [",
    "    {",
    "      \"confidence\": \"high\",",
    "      \"rationale\": \"Excel sheet 'Compute', row 12\",",
    "      \"data\": {",
    "        \"state\": \"desired\",",
    "        \"layerId\": \"compute\",",
    "        \"environmentId\": \"<one of the UUIDs in §2>\",",
    "        \"label\": \"Oracle Production DB\",",
    "        \"vendor\": \"Oracle\",",
    "        \"vendorGroup\": \"nonDell\",",
    "        \"criticality\": \"High\",",
    "        \"notes\": \"\"",
    "      }",
    "    }",
    "  ]",
    "}",
    "```",
    ""
  );

  // 7. Confidence-rating guidance
  sections.push(
    "## 6. Confidence-rating guidance",
    "",
    "- **high** · the source row is explicit and unambiguous (named vendor, named product, clear environment hint)",
    "- **medium** · partial information (vendor known but model inferred from context; environment inferred from team/region tag)",
    "- **low** · multiple plausible interpretations or missing fields filled with defaults",
    ""
  );

  // 8. State-hint guidance (R47.4.4)
  sections.push(
    "## 7. State-hint guidance (R47.4.4)",
    "",
    "Mark `state: \"current\"` for rows with explicit signals: \"currently running\", \"in production\", \"EOL\", \"legacy\", \"today's environment\".",
    "",
    "Mark `state: \"desired\"` for rows with explicit signals: \"planned\", \"proposed\", \"future\", \"TBD\", \"Q3 2027 migration\", \"target architecture\".",
    "",
    "Mark `state: null` when no signal is present. The engineer applies modal scope at preview time; modal scope is AUTHORITATIVE and overrides per-row hints.",
    ""
  );

  // 9. Worked examples (synthetic data only · never a real customer)
  sections.push(
    "## 8. Worked examples (synthetic data — Example Corp & Acme Industries)",
    "",
    "**Example A · Excel install-base row** · row 14: \"PowerStore 5200, Site A, prod cluster, Mission-Critical\":",
    "",
    "```json",
    "{ \"confidence\": \"high\", \"rationale\": \"Excel row 14\", \"data\": { \"state\": \"current\", \"layerId\": \"storage\", \"environmentId\": \"<Site A UUID from §2>\", \"label\": \"PowerStore 5200\", \"vendor\": \"Dell\", \"vendorGroup\": \"dell\", \"criticality\": \"High\", \"notes\": \"prod cluster\" } }",
    "```",
    "",
    "**Example B · PDF estate diagram callout** · \"future: 4× PowerEdge R760 for new VDI farm in Riyadh DC\":",
    "",
    "```json",
    "{ \"confidence\": \"medium\", \"rationale\": \"PDF page 7, VDI section\", \"data\": { \"state\": \"desired\", \"layerId\": \"compute\", \"environmentId\": \"<Riyadh DC UUID from §2>\", \"label\": \"PowerEdge R760 (4×, VDI)\", \"vendor\": \"Dell\", \"vendorGroup\": \"dell\", \"criticality\": \"Medium\", \"notes\": \"new VDI farm\" } }",
    "```",
    ""
  );

  // 10. Strict-match warning (R47.8.3 verbatim)
  sections.push(
    "## 9. Strict matching warning",
    "",
    "**Strict matching**: the JSON response must reference exactly the environments listed in §2 above. If you (the engineer) add or remove environments between generating these instructions and uploading the LLM's response, the Discovery Canvas will reject the response — re-generate instructions and re-run the LLM with the fresh context.",
    "",
    "There is no partial apply, no fuzzy remap, no UUID coercion. The response either fully matches the current engagement state or is rejected outright.",
    ""
  );

  // 11. System prompt body (ready-to-paste for the Dell internal LLM)
  sections.push(
    "## 10. System prompt body (paste this verbatim to the Dell internal LLM)",
    "",
    "```",
    "You are an extraction assistant for a Dell presales engineer running a Discovery Canvas workshop with " + customerName + ". The engineer has attached a customer-provided source file. Your job is to extract technology instances from that file and output them in the canonical Dell Discovery Canvas import-subset JSON shape (defined in §5 of the instructions document).",
    "",
    "Map every extracted item to one of the environment UUIDs listed in §2 of the instructions. Set state, confidence, and rationale per §6/§7/§8 guidance. Never invent data not in the source; if a field is missing, set confidence:\"low\" and use sensible defaults.",
    "",
    "Output ONLY the JSON object — no prose, no markdown fences, no commentary. The response will be validated by Zod and rejected on any deviation from §5 shape.",
    "```",
    ""
  );

  // 12. Footer
  sections.push(
    "---",
    "",
    "*Generated by Dell Discovery Canvas · " + now.toISOString() + " · file: " + filename + "*"
  );

  return {
    filename: filename,
    content:  sections.join("\n")
  };
}
