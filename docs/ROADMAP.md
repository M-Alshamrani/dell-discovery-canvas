# Dell Discovery Canvas — ROADMAP

Forward-looking enhancements explicitly deferred from the current release cycle. Each entry has a clear "what done looks like" so a future contributor can pick it up cold.

This file complements:
- `docs/BUG_LOG.md` — open bugs (things broken)
- `docs/CHANGELOG_PLAN.md` — work in-flight (things being done)
- This file — work deferred (things planned but not started)

---

## Quantity-collection at install-base layer

**Status**: deferred · scoped at rc.9 Sub-arc C decision (2026-05-14)
**Authority**: SPEC §S20.4.1.2 + RULES §16 CH37 (Rule 10 schema-conditional clause) + user direction 2026-05-14
**Candidate release**: v3.1.0 (NOT in scope for v3.0.0 GA)

**Unblocks**:
- Vendor-share percentages in chat output ("60% of compute is Dell-branded")
- Capacity-weighted reporting ("Dell carries 40 TB of the 60 TB total storage")
- Layer-distribution metrics ("data-protection is 25% of the engagement by capacity")
- Market-share comparisons ("Dell:non-Dell = 3:1 by row-count, 7:1 by capacity")

**Blocks today**: Rule 10 (schema-truthful enumeration · SPEC §S20.4.1.2 + RULES §16 CH37) forbids the chat from computing percentages or weighted aggregates because instance rows have no `quantity` field. Each row is equally weighted regardless of whether it represents 1 VM or a 40-rack cluster — so any percentage the chat invents is mass-equivalence-misleading.

**What "done" looks like**:

1. `schema/instance.js` gains a `quantity` field (number, default 1, semantically "logical-unit count or capacity-weight"). Field is OPTIONAL with sensible default so existing engagements remain valid.
2. `core/dataContract.js` exposes the field in the cached prefix's data-model section.
3. `services/systemPromptAssembler.js` Layer 1 Rule 10's schema-conditional clause activates: "for layers still missing `quantity`, enumerate by name." Chat can answer vendor-share / capacity-weighted questions for layers WITH `quantity`, while continuing to enumerate-by-name for layers without.
4. New analytical-view tool: `selectVendorShare(scope)` computing weighted shares using the `quantity` field. Returns enumerated names + per-name quantities + computed share. Honest because the share is grounded in real per-row quantity, not in row-counting.
5. New eval cases extend the golden set:
   - **GRD-6**: vendor-share percentage with quantity ("what's our Dell-vs-non-Dell vendor share by capacity?")
   - **GRD-7**: capacity-weighted layer distribution ("what's the storage layer's share of total infrastructure capacity?")
6. Rule 10's anti-pattern guard updates: the "no percentages" rule scopes to layers without `quantity`. Adding a `quantity` field does NOT remove Rule 10 — it narrows it. Schema-truthfulness still binds.

**Decision triggers** (any one is sufficient to promote this to in-scope):

- A real workshop where the customer's question is "what's our Dell-vs-non-Dell vendor share by capacity?" — and the engineer's answer is unavoidably "the canvas can't tell you yet"
- Enough engagements captured (≥10) to validate that engineers WANT this metric (vs prefer enumeration). Validation evidence: chat transcript search for percentage-shaped questions that hit Rule 10's refusal path
- SME availability to define the canonical "quantity unit" — design question pending:
  - Server count? (1 server = 1 unit · easy, but a hyperscale cluster reads as "1")
  - Capacity GB? (more honest for storage layer · awkward for compute / data-protection)
  - License count? (vendor-aligned · breaks down for open-source / commodity)
  - Cost per row? (revenue-aligned · requires customer-confidential pricing)
  - Per-layer canonical unit? (most flexible · most schema complexity)

**Sequencing**:

- NOT in scope for v3.0.0 GA (rc.9 / rc.10)
- Candidate for v3.1.0 if validated by workshop usage
- If promoted: SPEC §S20.4.1.3 (schema extension + Rule 10 narrowing) + RULES CH38 + a new Sub-arc (let's call it Sub-arc Q · "Quantity") would author the schema field, update the prompt, add the selectVendorShare tool, extend the golden set, and re-baseline. ~2-3 weeks effort estimate

**Why NOT now**:

1. Premature — no validated user demand. Today engineers are still onboarding to the engagement capture; quantitative reporting is a tier-2 use case.
2. SME-blocked — choosing the canonical quantity unit is the hard call, and it's a design decision that survives the lifetime of v3 schema. Worth getting right rather than rushing.
3. Coherent without it — Rule 10 + Examples 9-10 + enumeration-by-name is a coherent product experience. The chat is honest about what it can and can't compute, and the engineer always has the option of opening Tab 2 / Tab 4 to see the matrix or kanban directly.

**Cross-references**:

- SPEC §S20.4.1.2 — quantitative honesty rule (rc.9 Sub-arc C)
- RULES §16 CH37 — schema-truthful enumeration (rc.9 Sub-arc C)
- `tests/aiEvals/baseline-2026-05-13T20-01-50-669Z.json` — GRD-2 failing case judge verdict ("enumerated counts and layer distribution are not grounded") is the proximate evidence that the chat needed this rule
- `services/chatTools.js` — `selectVendorShare(scope)` is the queued tool name
- `core/dataContract.js` — `quantity` field would surface here in the cached prefix
- User direction 2026-05-14: *"percentage alone might not be the right way as we are collecting installbase types and details around names and descriptions, but not quantities yet. we might add that later as we need to collect more relevant metadata or parameters about the relevant layers. it could be a future feature."*

---

## (more entries will land here as features are deferred from active arcs)
