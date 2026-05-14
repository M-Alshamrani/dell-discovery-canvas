# Canvas AI Assist — User Guide

Canvas AI Assist is the in-app chat that helps you reason about your engagement, suggest next steps, and answer questions about your data and the Canvas app itself. This guide shows you how to ask it questions effectively.

---

## When the chat is a strong fit

- **"What gaps should I be probing for at this customer?"** — discovery coaching
- **"How do I add a workload instance in Tab 2?"** — app how-to
- **"List my Dell instances grouped by environment"** — data grounding
- **"Why is the Save context button disabled?"** — UX diagnosis
- **"What's the difference between gap_type and disposition?"** — concepts
- **"Make that shorter, top 3 points"** — multi-turn refinement

## What the chat won't do (yet)

- **Compute percentages or capacity-weighted shares** — the v3 install-base schema collects names + types but not quantities, so percentages would be schema-untruthful (1 VM weighted equal to a 40-rack cluster). See `docs/ROADMAP.md` for the future quantity-collection feature.
- **Apply changes directly** — chat is read-only in v3.0. Sub-arc D (queued for rc.10) will add Apply-button cards on chat proposals.
- **Multi-engagement comparisons** — v3.0 is single-engagement. Multi-engagement memory lands in v3.1+.

---

## How to ask effectively

### Discovery / workshop coaching

When you ask about gap probing, customer-voice translation, or qualifying scenarios, the chat uses the customer + drivers + verticals you've captured to suggest concrete next steps.

Example: *"The customer mentioned ransomware concerns in their EHR — what should I do?"*
Expected response: actionable mapping to Canvas action (driver outcome + Tab 4 gap + criticality).

**Tip**: the more context you've captured (drivers + environments + a few instances), the more specific the chat's suggestions.

### Data queries

For specific counts, vendor enumerations, gap titles, environment lists, or any engagement-specific data: just ask. The chat calls an analytical-view tool (selectGapsKanban, selectVendorMix, selectMatrixView, selectHealthSummary, selectLinkedComposition) and cites it in the answer.

Example: *"How many High-urgency gaps are in the Now phase?"*
Expected response: *"per selectGapsKanban: 4 High-urgency gaps in the Now phase…"*

**Tip — schema-truthful enumeration**: the chat ENUMERATES install-base items by name rather than computing percentages or weighted shares. This is by design (Rule 10 per `docs/v3.0/SPEC.md` §S20.4.1.2). If you want a row-count, ask "how many"; if you want a vendor share weighted by capacity, that's a future feature.

### Per-entity drilldown

To see everything linked to a specific gap or instance, name the entity: *"What gaps are tied to my Veeam Backup instance?"* The chat will call `selectLinkedComposition` and enumerate the linked entities by name.

### App how-to

For "how do I X" or "where is Y": just ask. The chat uses the App Workflow Manifest to point at the relevant tab + click sequence.

Example: *"How do I add a workload instance in Tab 2?"*
Expected response: step-by-step with tab name, layer chip, environment, + the field form.

### Conceptual

For "what does X mean" or "when do I use X vs Y": the chat uses the Concept Dictionary (62 entries across 13 categories). For headlines, just ask; for full body (definition + example + when-to-use + vsAlternatives), it'll call the `selectConcept` tool.

Example: *"What's the difference between 'replace' and 'consolidate' dispositions?"*
Expected response: contrasts the two with examples, points at the lifecycle table.

See `docs/GAP_TYPE_VS_DISPOSITION.md` for the common confusion between gap_type (the work) and disposition (the lifecycle outcome).

### Honesty / refusal

The chat refuses to fabricate data the engagement doesn't include. Common cases: revenue, contacts, workshop logs, competing proposals.

Example: *"What's the customer's annual revenue?"*
Expected response: *"The canvas doesn't include revenue or budget data — those fields aren't in the engagement schema."*

**Tip**: this is by design. If you need to capture something the schema doesn't have, use Customer notes on Tab 1 (free text).

### Multi-turn

The chat keeps transcript awareness within a session. You can say "shorter, top 3 points" or "what about the DR site?" and it references the prior turn.

Example sequence:
1. *"Which driver is most relevant for this engagement?"* → *(chat answers Cyber Resilience)*
2. *"Make that shorter, top 3 points."* → *(chat distills to 3 bullets)*

---

## Tips

- **Be specific**: *"list my Dell instances grouped by environment"* gets a better answer than *"tell me about my instances"*
- **Cite tabs by label**: *"Tab 4 (Gaps)"* reads better in the chat's response than just *"Tab 4"*
- **Don't ask for percentages on install-base data** (yet) — they're schema-untruthful; the chat will enumerate by name and qualify any row-count it gives
- **Use the chat to NAVIGATE, not to MUTATE** — chat proposes, you apply on the relevant tab (read-only is intentional in v3.0)

---

## Provider configuration

Open **Settings** (⚙ icon in topbar) → **AI providers** to configure your provider (Anthropic / OpenAI-compatible / Gemini / local). Each request streams via your configured provider; the prompt is cached on Anthropic for 5-minute TTL re-use at ~10% input-token cost.

If the chat returns *"⚠ The model produced an answer with claims that don't trace to the engagement"* — the grounding verifier caught a likely fabrication (per `docs/v3.0/SPEC.md` §S37). Try rephrasing, switching providers, or adding the relevant data to the canvas.

---

## Cross-references

- `docs/v3.0/SPEC.md` §S20 (Canvas Chat) + §S37 (grounding contract) + §S20.4.1.1 + §S20.4.1.2 (behavior examples + quantitative honesty)
- `docs/RULES.md` §16 CH37 (schema-truthful enumeration contract)
- `docs/CURRENT_VS_DESIRED_STATE.md` — Tab 2 vs Tab 3 conceptual anchor
- `docs/GAP_TYPE_VS_DISPOSITION.md` — gap_type (the work) vs disposition (the outcome)
- `docs/ROADMAP.md` — future features (e.g., quantity-collection at install-base layer)
- `tests/aiEvals/baseline-2026-05-13T20-01-50-669Z.json` — the measurement bar for chat quality (9.16/10 avg · 96% pass rate · captured rc.8 close 2026-05-13)
