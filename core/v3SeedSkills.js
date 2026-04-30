// core/v3SeedSkills.js — v3.0 · SPEC sec S7.1 + sec S7.4.3
//
// The 3 production-critical seed skills per OPEN_QUESTIONS_RESOLVED Q3.
// Each is a SkillSchema-shaped object minus the crossCuttingFields
// (id/engagementId/createdAt/updatedAt) — those get stamped at
// engagement-creation time when the seeds are deployed.
//
// Two output modes exercised:
//   - "free-text"  — executive-summary, smoke regression rigor
//   - structured   — dell-mapping, care-builder, strict regression
//                    rigor against catalog membership
//
// V-PROD-* regression suite (TESTS.md sec T16) tests these against
// mocked LLM responses keyed by prompt hash for determinism.

export const SEED_SKILL_DELL_MAPPING = Object.freeze({
  skillId:        "dell-mapping",
  label:          "Map gap to Dell solutions",
  version:        "1.0.0",
  skillType:      "click-to-run",
  entityKind:     "gap",
  promptTemplate: [
    "You are a Dell presales architect. Map this customer gap to Dell products.",
    "",
    "Customer: {{customer.name}} ({{customer.vertical}})",
    "Gap: {{context.gap.description}}",
    "Layer: {{context.gap.layerId}}",
    "Urgency: {{context.gap.urgency}}",
    "",
    "Return ONLY product ids from the Dell taxonomy. Do not invent products.",
    "Specifically: never include Boomi (divested), Secureworks Taegis (divested),",
    "VxRail (superseded by Dell Private Cloud), or 'SmartFabric Director'",
    "(replaced by SmartFabric Manager). For AIOps, use products under the",
    "'Dell APEX AIOps' umbrella; CloudIQ is one such product, not standalone."
  ].join("\n"),
  bindings:           [],   // populated by validateSkillSave at save time
  outputContract:     { schemaRef: "DellSolutionListSchema" },
  validatedAgainst:   "3.0",
  outdatedSinceVersion: null
});

export const SEED_SKILL_EXECUTIVE_SUMMARY = Object.freeze({
  skillId:        "executive-summary",
  label:          "Generate executive summary",
  version:        "1.0.0",
  skillType:      "session-wide",
  entityKind:     null,
  promptTemplate: [
    "Generate a 3-paragraph executive summary for the following customer engagement.",
    "Tone: confident, specific, no boilerplate. Cite specific findings from the data.",
    "",
    "Customer: {{customer.name}} ({{customer.vertical}})",
    "Region: {{customer.region}}",
    "Status: {{engagementMeta.status}}",
    "Engagement date: {{engagementMeta.engagementDate}}",
    "",
    "Use the customer's name in the summary. End with a one-sentence next-step recommendation."
  ].join("\n"),
  bindings:           [],
  outputContract:     "free-text",
  validatedAgainst:   "3.0",
  outdatedSinceVersion: null
});

export const SEED_SKILL_CARE_BUILDER = Object.freeze({
  skillId:        "care-builder",
  label:          "Build CARE-style prompt",
  version:        "1.0.0",
  skillType:      "session-wide",
  entityKind:     null,
  promptTemplate: [
    "Generate a CARE-style prompt template for a presales engagement.",
    "CARE: Context, Audience, Request, Examples.",
    "",
    "Customer: {{customer.name}}",
    "Vertical: {{customer.vertical}}",
    "",
    "Output a save-able skill record with skillId / promptTemplate / outputContract."
  ].join("\n"),
  bindings:           [],
  outputContract:     { schemaRef: "SkillSchema" },
  validatedAgainst:   "3.0",
  outdatedSinceVersion: null
});

export const V3_SEED_SKILLS = Object.freeze([
  SEED_SKILL_DELL_MAPPING,
  SEED_SKILL_EXECUTIVE_SUMMARY,
  SEED_SKILL_CARE_BUILDER
]);
