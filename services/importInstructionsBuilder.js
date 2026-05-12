// services/importInstructionsBuilder.js — rc.8 / Path B (SPEC §S47.4 + §S47.10)
//
// Builds the context-aware LLM Instructions Prompt .txt file the engineer
// downloads from the "Import data" footer button (Step 1 of the 2-step
// modal). The engineer takes the file to the Dell internal LLM (separate
// environment; cannot send sensitive data via Claude API), feeds it their
// source data, and receives a JSON response in the canonical S47.3 shape.
// Step 2 of the modal uploads the JSON; the shared importer + preview
// modal handle the rest.
//
// CONTRACT (per SPEC §S47.4):
//   - R47.4.1 · output filename ends in .txt (universal; no .md viewer
//     assumed). Internal structure uses markdown conventions for
//     readability but the extension is .txt.
//   - R47.4.2 · filename convention (BUG-055 amendment):
//       dell-canvas-llm-instructions-prompt-<customer-slug>-<YYYYMMDD>-<HHmmss>.txt
//   - R47.8.3 · strict-match warning text verbatim.
//   - R2 (Rule C 0-env guard) · throws NO_ENVIRONMENTS if engagement has
//     0 envs · entry-point precondition.
//
// BUG-055 CRAFT PASS (2026-05-12):
//   The instructions content is now a craftsmanship-grade LLM prompt with
//   explicit role + goal + success criteria, 5+ worked examples across
//   compute / storage / network / security / workload layers, counter-
//   examples (what NOT to do), a verification checklist the LLM runs on
//   its own output before emitting, and chain-of-thought reasoning markers.
//   Filename + UI label renamed to "LLM Instructions Prompt" to clarify
//   the file is a prompt for an LLM, not a manual for a human.
//
// Authority: docs/v3.0/SPEC.md §S47.4 + §S47.8.3 + §S47.10 + BUG-055.

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
// back to the raw catalog id if no catalog entry is found.
function envLabelFor(envCatalogId) {
  const entry = ENV_CATALOG.find((c) => c.id === envCatalogId);
  return entry ? entry.label : envCatalogId;
}

// Build a markdown-style env-slot table for the instructions body.
// PRECONDITION: engagement has at least 1 environment (enforced upstream).
function buildEnvSlotTable(engagement) {
  const allIds = engagement.environments.allIds;
  const byId   = engagement.environments.byId;
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

// Pick the first env UUID + label for substitution into worked examples.
// Pure helper · safe on a >= 1 env engagement (precondition checked upstream).
function firstEnvFor(engagement) {
  const uuid = engagement.environments.allIds[0];
  const env  = engagement.environments.byId[uuid] || {};
  return { uuid: uuid, label: env.alias || envLabelFor(env.envCatalogId) };
}

// buildImportInstructions(engagement, opts) -> { filename, content }
//   engagement       - the LIVE engagement object (with customer + environments)
//   opts.scope       - "current" | "desired" | "both" (default "current" per BUG-054)
//   opts.now         - Date for tests (defaults to new Date())
//
// PRECONDITION (R2 guard per feedback_5_forcing_functions.md Rule C):
//   engagement.environments.allIds.length MUST be >= 1.
export function buildImportInstructions(engagement, opts) {
  const allIds = (engagement && engagement.environments && Array.isArray(engagement.environments.allIds))
    ? engagement.environments.allIds : [];
  if (allIds.length === 0) {
    const err = new Error(
      "buildImportInstructions called on an engagement with 0 environments. " +
      "Add at least one environment in the Context tab before generating instructions. " +
      "(The Dell internal LLM has nothing to map extracted rows to without environment UUIDs in the engagement.)"
    );
    err.code = "NO_ENVIRONMENTS";
    throw err;
  }

  const scope = (opts && opts.scope) || "current";
  const now   = (opts && opts.now)   || new Date();

  const customer = (engagement && engagement.customer) || {};
  const customerName = customer.name || "Untitled Customer";
  const customerVertical = customer.vertical || "(unspecified vertical)";
  const customerRegion = customer.region || "(unspecified region)";

  const engCreatedAt = (engagement && engagement.meta && engagement.meta.createdAt)
    || (engagement && engagement.meta && engagement.meta.engagementDate)
    || "(unspecified date)";

  // BUG-055 · new filename prefix.
  const filename = "dell-canvas-llm-instructions-prompt-"
                 + slugify(customerName) + "-" + utcStamp(now) + ".txt";

  const envTable = buildEnvSlotTable(engagement);
  const exampleEnv = firstEnvFor(engagement);

  const sections = [];

  // ─── HEADER ─────────────────────────────────────────────────────────
  sections.push(
    "# LLM Instructions Prompt · Dell Discovery Canvas data extraction",
    "",
    "*Generated: " + now.toISOString() + " · Customer: " + customerName + " · Apply scope: " + scope + "*",
    ""
  );

  // ─── 1 · YOUR ROLE + GOAL + SUCCESS CRITERIA (Quality Marker 1) ─────
  sections.push(
    "## 1. Your role · your task · success criteria",
    "",
    "**Your role**: you are an extraction specialist assisting a Dell Technologies presales engineer running a Discovery Canvas workshop with **" + customerName + "** (" + customerVertical + " / " + customerRegion + "). The engineer has attached a customer-provided source file (Excel install-base, CSV inventory, PDF estate diagram, or TXT memo) that describes the customer's technology landscape.",
    "",
    "**Your task**: read the source file and emit ONE structured JSON record per discrete technology instance you can identify · output ONLY a single JSON object matching the schema in §6 · no prose around it · no markdown fences · no commentary.",
    "",
    "**Definition of done · success criteria**:",
    "1. Every items[] entry references an `environmentId` that is one of the UUIDs in §2 (verbatim · no UUID inventions).",
    "2. Every items[] entry has a confidence rating (high / medium / low) backed by a one-sentence rationale citing the source row or location.",
    "3. Every items[] entry has all 8 required `data` fields: state, layerId, environmentId, label, vendor, vendorGroup, criticality, notes.",
    "4. The complete JSON validates against the schema in §6 (parses without error · all enum values exact-match).",
    "5. You ran the verification checklist in §10 BEFORE emitting your response.",
    ""
  );

  // ─── 2 · ENVIRONMENT SLOTS (CRITICAL FK TARGETS) ────────────────────
  sections.push(
    "## 2. Environment slots (CRITICAL · MUST be one of these UUIDs verbatim)",
    "",
    "Every `items[].data.environmentId` in your output MUST be one of the UUIDs in the table below — verbatim, no transformation. **Do NOT invent UUIDs. Do NOT remap UUIDs to friendly names. Do NOT use the envCatalogId in place of the UUID.** The Discovery Canvas validates strict-match on import and rejects responses that reference any UUID not in this list.",
    "",
    envTable,
    "",
    "If the source file describes a technology that doesn't clearly belong to any environment above, emit it with confidence:\"low\" and pick the closest match · explain the ambiguity in the `rationale` field.",
    ""
  );

  // ─── 3 · DATA SCHEMA ────────────────────────────────────────────────
  sections.push(
    "## 3. Data schema (per items[].data)",
    "",
    "Each `items[].data` object MUST conform to this exact shape:",
    "",
    "- `state` · enum: `\"current\"` | `\"desired\"` | `null`",
    "  - `\"current\"` if the source signals existing / in-production / today's-estate (see §8 state-hint guidance).",
    "  - `\"desired\"` if the source signals planned / proposed / target-architecture / future-state.",
    "  - `null` if the source is silent · the engineer chooses scope at apply time.",
    "- `layerId` · enum: one of `compute` | `storage` | `network` | `security` | `workload`. FK to LAYERS catalog.",
    "- `environmentId` · one of the UUIDs in §2. Verbatim. No inventions.",
    "- `label` · human-readable name, ≤ 60 characters. Example: `\"Oracle Production DB\"` or `\"PowerStore 5200 (DR)\"`.",
    "- `vendor` · vendor name as it appears in source. Example: `\"Oracle\"`, `\"Dell\"`, `\"Cisco\"`, `\"VMware\"`.",
    "- `vendorGroup` · enum: `\"dell\"` (any Dell-branded product) | `\"nonDell\"` (named non-Dell vendor) | `\"custom\"` (in-house / unknown / generic).",
    "- `criticality` · enum: `\"High\"` | `\"Medium\"` | `\"Low\"`. Business criticality, NOT technical risk.",
    "- `notes` · ≤ 200 characters. Source context (license, EOL date, version, role). Empty string `\"\"` if none.",
    ""
  );

  // ─── 4 · SEMANTIC GLOSSARY ──────────────────────────────────────────
  sections.push(
    "## 4. Semantic glossary",
    "",
    "- **Layer** is the technology plane the instance lives in.",
    "  - `compute` · servers, VMs, containers, hypervisors used as compute hosts",
    "  - `storage` · arrays (SAN/NAS), object storage, file storage, backup targets",
    "  - `network` · switches, routers, load balancers, SD-WAN",
    "  - `security` · firewalls, IDS/IPS, web proxies, identity",
    "  - `workload` · applications running on the above (databases, SaaS-like apps, business systems)",
    "- **Environment** is the SITE / location the instance physically resides in. Always a UUID; resolve via §2.",
    "- **Current** instances exist today in the customer's estate. **Desired** instances are proposed / planned / future-state.",
    "- **Criticality** measures business importance (mission-critical / important / routine), NOT technical risk or complexity.",
    ""
  );

  // ─── 5 · CHAIN-OF-THOUGHT REASONING PATTERN (Quality Marker 5) ──────
  sections.push(
    "## 5. How to reason about each row (think step by step)",
    "",
    "For each row / item / line in the source file, reason in this order before writing the JSON entry:",
    "",
    "**Step 1**: Identify the technology. What is it? Vendor name? Product? Version?",
    "**Step 2**: Classify the layer. Is this compute, storage, network, security, or workload? Use §4 glossary.",
    "**Step 3**: Determine the environment. Where is it deployed? Match to a UUID in §2.",
    "**Step 4**: Assign state hint. Is the source describing existing infrastructure (current) or proposed (desired)? Use §8 state-hint guidance. If silent, set `null`.",
    "**Step 5**: Assign confidence. How certain are you about steps 1-4? Use §7 confidence guidance.",
    "**Step 6**: Write the JSON entry. Fill all 8 data fields. Cite the source row in `rationale`.",
    "**Step 7**: Self-check against §10 verification checklist before adding to items[].",
    ""
  );

  // ─── 6 · REQUIRED OUTPUT JSON SHAPE ─────────────────────────────────
  sections.push(
    "## 6. Required output JSON shape",
    "",
    "Output ONLY this JSON object · no prose, no markdown fences, no commentary:",
    "",
    "```json",
    "{",
    "  \"schemaVersion\": \"1.0\",",
    "  \"kind\": \"instance.add\",",
    "  \"generatedAt\": \"<ISO instant when you generated this response>\",",
    "  \"items\": [",
    "    {",
    "      \"confidence\": \"high\",",
    "      \"rationale\": \"Source citation, e.g. 'Excel sheet Compute, row 14'\",",
    "      \"data\": {",
    "        \"state\": \"current\",",
    "        \"layerId\": \"compute\",",
    "        \"environmentId\": \"<one of the UUIDs in §2>\",",
    "        \"label\": \"<≤60 chars>\",",
    "        \"vendor\": \"<vendor name>\",",
    "        \"vendorGroup\": \"dell\",",
    "        \"criticality\": \"High\",",
    "        \"notes\": \"<≤200 chars or empty string>\"",
    "      }",
    "    }",
    "  ]",
    "}",
    "```",
    ""
  );

  // ─── 7 · CONFIDENCE GUIDANCE ────────────────────────────────────────
  sections.push(
    "## 7. Confidence rating · how to choose high / medium / low",
    "",
    "- **high** · the source row is explicit and unambiguous · named vendor + named product + clear environment hint. Example: \"Dell PowerStore 5200, deployed at Primary DC, production cluster\".",
    "- **medium** · partial information · vendor known but model/version inferred · environment inferred from team/region tag. Example: \"Oracle DB on the central infra team's stack\".",
    "- **low** · multiple plausible interpretations · missing fields filled with defaults · ambiguous environment / layer / criticality. Use sparingly and explain the ambiguity in `rationale`.",
    ""
  );

  // ─── 8 · STATE-HINT GUIDANCE (R47.4.4) ──────────────────────────────
  sections.push(
    "## 8. State-hint guidance (when to mark current / desired / null)",
    "",
    "**Mark `state: \"current\"`** when the source uses signals like: \"currently running\", \"in production\", \"existing\", \"today's environment\", \"EOL Q4\", \"legacy\", \"installed base\", a deployment date in the past, an inventory snapshot.",
    "",
    "**Mark `state: \"desired\"`** when the source uses signals like: \"planned\", \"proposed\", \"future\", \"TBD\", \"Q3 2027 migration\", \"target architecture\", \"to be procured\", \"recommendation\".",
    "",
    "**Mark `state: null`** when the source is silent · the engineer's modal scope picker is AUTHORITATIVE and overrides per-row hints at apply time. Setting null is honest about ambiguity; making up a state is dishonest about ambiguity.",
    ""
  );

  // ─── 9 · WORKED EXAMPLES (Quality Marker 2 · 5 examples across layers) + COUNTER-EXAMPLES (Marker 3) ─
  sections.push(
    "## 9. Worked examples (5 positives across layers + counter-examples)",
    "",
    "Synthetic data only · never reference a real customer.",
    "",
    "### Example A · COMPUTE · high confidence",
    "**Source row** (Excel install-base, row 14): \"Dell PowerEdge R760, Site A, prod cluster, 32-node, Mission-Critical\"",
    "**Reasoning**: vendor Dell + product PowerEdge R760 (explicit) → layer compute · environment Site A → " + exampleEnv.label + " · state \"current\" (existing prod) · criticality High (mission-critical signal).",
    "**JSON**:",
    "```json",
    "{ \"confidence\": \"high\", \"rationale\": \"Excel install-base row 14\", \"data\": { \"state\": \"current\", \"layerId\": \"compute\", \"environmentId\": \"" + exampleEnv.uuid + "\", \"label\": \"PowerEdge R760 (32-node prod cluster)\", \"vendor\": \"Dell\", \"vendorGroup\": \"dell\", \"criticality\": \"High\", \"notes\": \"\" } }",
    "```",
    "",
    "### Example B · STORAGE · high confidence + desired-state",
    "**Source row** (PDF estate diagram, page 7): \"Planned · 2x Dell PowerStore 5200 at DR site for Q2 2027\"",
    "**Reasoning**: vendor Dell + product PowerStore (explicit) → layer storage · environment DR site · state \"desired\" (planned signal) · criticality Medium (default for desired without explicit signal).",
    "**JSON**:",
    "```json",
    "{ \"confidence\": \"high\", \"rationale\": \"PDF estate diagram page 7\", \"data\": { \"state\": \"desired\", \"layerId\": \"storage\", \"environmentId\": \"" + exampleEnv.uuid + "\", \"label\": \"PowerStore 5200 (planned 2x)\", \"vendor\": \"Dell\", \"vendorGroup\": \"dell\", \"criticality\": \"Medium\", \"notes\": \"Q2 2027 deployment\" } }",
    "```",
    "",
    "### Example C · NETWORK · medium confidence",
    "**Source row** (CSV inventory, row 88): \"Cisco Nexus, Riyadh, datacenter\"",
    "**Reasoning**: vendor Cisco + product Nexus family (medium · model inferred) → layer network · environment Riyadh DC · state \"current\" (inventory snapshot) · criticality Medium (default for network unless explicit).",
    "**JSON**:",
    "```json",
    "{ \"confidence\": \"medium\", \"rationale\": \"CSV inventory row 88 · model family Nexus inferred\", \"data\": { \"state\": \"current\", \"layerId\": \"network\", \"environmentId\": \"" + exampleEnv.uuid + "\", \"label\": \"Cisco Nexus (DC fabric)\", \"vendor\": \"Cisco\", \"vendorGroup\": \"nonDell\", \"criticality\": \"Medium\", \"notes\": \"\" } }",
    "```",
    "",
    "### Example D · SECURITY · medium confidence + null state",
    "**Source row** (TXT memo): \"Palo Alto firewalls protect the prod DCs\"",
    "**Reasoning**: vendor Palo Alto + product firewall (explicit) → layer security · environment ambiguous (\"prod DCs\" could be multiple) · state null (source is silent on current vs desired · sentence reads descriptive) · criticality High (security devices on prod path).",
    "**JSON**:",
    "```json",
    "{ \"confidence\": \"medium\", \"rationale\": \"TXT memo · 'prod DCs' ambiguous; mapped to first DC env\", \"data\": { \"state\": null, \"layerId\": \"security\", \"environmentId\": \"" + exampleEnv.uuid + "\", \"label\": \"Palo Alto firewall (prod)\", \"vendor\": \"Palo Alto\", \"vendorGroup\": \"nonDell\", \"criticality\": \"High\", \"notes\": \"\" } }",
    "```",
    "",
    "### Example E · WORKLOAD · low confidence",
    "**Source row** (Excel, row 33): \"SAP\"",
    "**Reasoning**: vendor SAP (explicit) but product / version / environment / criticality all missing · layer workload (SAP is a business application) · state null (silent) · criticality Medium (default).",
    "**JSON**:",
    "```json",
    "{ \"confidence\": \"low\", \"rationale\": \"Excel row 33 · only vendor cited; product/version/environment all ambiguous\", \"data\": { \"state\": null, \"layerId\": \"workload\", \"environmentId\": \"" + exampleEnv.uuid + "\", \"label\": \"SAP (details TBC)\", \"vendor\": \"SAP\", \"vendorGroup\": \"nonDell\", \"criticality\": \"Medium\", \"notes\": \"Source under-specified · engineer to confirm\" } }",
    "```",
    "",
    "### Counter-examples · do NOT do these",
    "",
    "**Wrong (invented UUID)**: ",
    "```json",
    "{ \"confidence\": \"high\", \"rationale\": \"row 5\", \"data\": { \"state\": \"current\", \"layerId\": \"compute\", \"environmentId\": \"new-datacenter-uuid\", \"label\": \"...\", ... } }",
    "```",
    "→ `environmentId` MUST be from §2. Inventing UUIDs causes the entire import to reject at drift-check.",
    "",
    "**Wrong (prose around JSON)**: ",
    "> \"Here are the extracted instances:```json {...} ``` Let me know if you need more!\"",
    "→ Emit ONLY the JSON object. No greeting, no closing, no markdown fences. The Discovery Canvas parses your output directly.",
    "",
    "**Wrong (skipped confidence)**: ",
    "```json",
    "{ \"data\": { \"state\": \"current\", ... } }",
    "```",
    "→ Every items[] entry MUST have `confidence` + `rationale`. The engineer uses these to triage rows in the preview modal.",
    "",
    "**Wrong (fabricated state)**: marking `state: \"desired\"` for a row whose source clearly describes existing infrastructure.",
    "→ When the source is ambiguous, use `state: null`. Inventing a state is dishonest about ambiguity.",
    ""
  );

  // ─── 10 · VERIFICATION CHECKLIST (Quality Marker 4) ─────────────────
  sections.push(
    "## 10. Verification checklist · run BEFORE emitting your response",
    "",
    "Before you emit the JSON, self-check each item in this list:",
    "",
    "- [ ] Output is ONLY the JSON object · no prose around it, no markdown code-fence wrappers, no commentary lines.",
    "- [ ] The JSON parses · braces balance, commas correct, all strings quoted.",
    "- [ ] `schemaVersion` is exactly `\"1.0\"` and `kind` is exactly `\"instance.add\"`.",
    "- [ ] Every `items[].data.environmentId` is one of the UUIDs in §2 (verbatim · spell-check the UUID).",
    "- [ ] Every `items[].data.layerId` is one of: compute, storage, network, security, workload.",
    "- [ ] Every `items[].data.vendorGroup` is one of: dell, nonDell, custom (exact case).",
    "- [ ] Every `items[].data.criticality` is one of: High, Medium, Low (capitalized).",
    "- [ ] Every `items[].data.state` is one of: \"current\", \"desired\", null (not the string \"null\").",
    "- [ ] Every `items[]` entry has `confidence` + `rationale` set.",
    "- [ ] No `label` exceeds 60 chars · no `notes` exceeds 200 chars.",
    "- [ ] Counts are sane · if the source file has ~30 technology rows, your items[] should have roughly that count; if you emit 3 items[], you've under-extracted.",
    ""
  );

  // ─── 11 · STRICT-MATCH WARNING (R47.8.3 verbatim) ───────────────────
  sections.push(
    "## 11. Strict matching warning",
    "",
    "**Strict matching**: the JSON response must reference exactly the environments listed in §2 above. If the engineer adds or removes environments between generating these instructions and uploading the LLM's response, the Discovery Canvas will reject the response — re-generate instructions and re-run the LLM with the fresh context.",
    "",
    "There is no partial apply, no fuzzy remap, no UUID coercion. The response either fully matches the current engagement state or is rejected outright.",
    ""
  );

  // ─── 12 · READY-TO-PASTE SYSTEM PROMPT ──────────────────────────────
  sections.push(
    "## 12. System prompt body (paste verbatim to the Dell internal LLM)",
    "",
    "```",
    "You are an extraction specialist assisting a Dell Technologies presales engineer running a Discovery Canvas workshop with " + customerName + " (" + customerVertical + " · " + customerRegion + "). The engineer has attached a customer-provided source file.",
    "",
    "Your task: extract technology instances from that file and output them in the canonical Dell Discovery Canvas import-subset JSON shape (defined in §6 of the instructions document above). Apply the chain-of-thought reasoning pattern in §5 to each row. Use the worked examples in §9 as your accuracy reference. Run the verification checklist in §10 BEFORE emitting your response.",
    "",
    "Map every extracted item to one of the environment UUIDs listed in §2 (verbatim · no inventions). Set state hints per §8 guidance, confidence per §7. Never invent UUIDs, vendors, or data not in the source. If a field is missing or ambiguous, set confidence:\"low\", set state:null when the source is silent on state, and explain the ambiguity in the rationale field.",
    "",
    "Output ONLY the JSON object · no prose, no markdown fences, no commentary. The response is parsed by Zod and rejected on any deviation from §6 shape.",
    "```",
    ""
  );

  sections.push(
    "---",
    "",
    "*Generated by Dell Discovery Canvas · " + now.toISOString() + " · file: " + filename + " · BUG-055 craft pass*"
  );

  return {
    filename: filename,
    content:  sections.join("\n")
  };
}
