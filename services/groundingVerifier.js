// services/groundingVerifier.js
//
// SPEC §S37.3.2 + R37.5..R37.8 + RULES §16 CH33 (c) · Runtime grounding
// verifier for chat. Scans an assistant response for entity-shaped
// claims (gap descriptions, vendor names quoted in 'vendor "X"' shape,
// project-phase references "Phase N" / "Q[1-4]", parenthesized
// month-day deliverable dates) and cross-references each against the
// live engagement (with catalog reference data whitelisted per R37.8).
//
// Pure + deterministic. No LLM calls. No state. Same input MUST yield
// same output across calls.
//
// Authority:
//   - docs/v3.0/SPEC.md §S37.3.2 + §S37.5 (R37.5..R37.8)
//   - docs/RULES.md §16 CH33 (c)
//   - docs/v3.0/TESTS.md §T38 V-FLOW-GROUND-FAIL-1..5
//
// Call site: services/chatService.js streamChat(...) calls this AFTER
// the post-stream scrubs (handshake strip + UUID scrub) but BEFORE
// returning to the overlay. On ok:false the visible response is
// REPLACED with a render-error message; provenance still surfaces;
// the violations array is recorded on the result envelope.
//
// Forbidden (per §S37.7):
//   - allowing a hallucinated response through. verifyGrounding is a
//     hard gate; bypass = bug.
//   - asserting LLM output semantics. The verifier asserts a STRUCTURAL
//     property (entity references trace to engagement); not "the model
//     gave the right answer".
//   - any mock/scripted/fake substrate. The verifier is the real check.

// Catalog whitelist · Dell product taxonomy + service families that
// commonly appear in workshop responses as reference data, not as
// engagement claims. Per R37.8: catalog data is NOT a hallucination
// even when not in the specific engagement. Lowercase, substring-match
// friendly. The list covers the families surfaced in the user's
// workshop screenshots + standard Dell-side-of-house solutions.
const DELL_PRODUCT_TAXONOMY_LOWER = [
  "powerscale", "powermax", "powerstore", "poweredge", "powerflex",
  "powerprotect", "powerswitch", "powervault",
  "cyber recovery", "cyber-recovery", "cyberrecovery", "cybersense",
  "data domain", "datadomain", "networker", "avamar", "rsa",
  "apex", "vxrail", "vxblock", "vmware tanzu",
  "ecs", "cloudiq", "isilon", "unity", "compellent",
  "ome", "omnia", "openmanage",
  "dell emc", "dell technologies"
];

// Driver-label whitelist (BUSINESS_DRIVERS catalog labels). Catalog
// reference data, not hallucination per R37.8.
const DRIVER_LABEL_WHITELIST_LOWER = [
  "cyber resilience", "ai & data platforms", "ai and data platforms",
  "compliance & sovereignty", "compliance and sovereignty",
  "cloud & cost optimization", "cloud and cost optimization",
  "operational excellence", "modernization", "consolidation",
  "edge transformation", "data sovereignty", "regulatory compliance"
];

// Months for parenthesized-date detection.
const MONTHS = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";

// Public API. Returns { ok: bool, violations: [{kind, claim, reason}] }.
export function verifyGrounding(response, engagement) {
  const text = (response == null) ? "" : String(response);
  if (text.length === 0) return { ok: true, violations: [] };

  const map = buildGroundingMap(engagement);
  const violations = [];

  // 1 · Gap-description claims · pattern: gap titled 'X' / gap "X" / gap named X
  // Also matches "another titled 'X'" when preceded by "gap" within a phrase.
  const GAP_QUOTED_RE = /\bgaps?\s+(?:titled|named|called)?\s*['"‘’“”]([^'"‘’“”]{4,200})['"‘’“”]/gi;
  let m;
  while ((m = GAP_QUOTED_RE.exec(text)) !== null) {
    const claim = m[1].trim();
    if (!gapClaimTraces(claim, map)) {
      violations.push({
        kind:   "gap-description",
        claim:  claim,
        reason: "no matching gap description in engagement"
      });
    }
  }
  // Also match "another titled 'X'" / "another gap 'X'" — companion pattern
  // for multi-gap fabrications like the V-FLOW-GROUND-FAIL-1 case.
  const ANOTHER_TITLED_RE = /\b(?:another|second|third)\s+(?:gap\s+)?(?:titled|named|called)\s+['"‘’“”]([^'"‘’“”]{4,200})['"‘’“”]/gi;
  while ((m = ANOTHER_TITLED_RE.exec(text)) !== null) {
    const claim = m[1].trim();
    if (!gapClaimTraces(claim, map)) {
      violations.push({
        kind:   "gap-description",
        claim:  claim,
        reason: "no matching gap description in engagement (companion phrase)"
      });
    }
  }

  // 2 · Vendor claims · pattern: vendor 'X' / vendor "X" (with optional
  // qualifier like fictional / unknown). Quoted vendor names are
  // strong signals of an engagement-specific claim.
  const VENDOR_QUOTED_RE = /\b(?:fictional\s+|imaginary\s+|hypothetical\s+|new\s+)?vendor\s+['"‘’“”]([^'"‘’“”]{2,100})['"‘’“”]/gi;
  while ((m = VENDOR_QUOTED_RE.exec(text)) !== null) {
    const claim = m[1].trim();
    if (!vendorClaimTraces(claim, map)) {
      violations.push({
        kind:   "vendor",
        claim:  claim,
        reason: "vendor not in engagement instances and not in DELL_PRODUCT_TAXONOMY"
      });
    }
  }

  // 3 · Project-phase claims · "Phase N" or "Q[1-4]" appearing as a
  // deliverable / planning marker. v3.0 engagements do NOT carry phase
  // metadata yet, so any such claim is unsupported. v3.1 may add an
  // engagement-projects-phase whitelist; until then, the absence of
  // phase data in the engagement is itself the contract.
  const PHASE_RE = /\bPhase\s+(\d+)\b/g;
  while ((m = PHASE_RE.exec(text)) !== null) {
    if (!map.projectPhasesLower.has("phase " + m[1])) {
      violations.push({
        kind:   "project-phase",
        claim:  m[0],
        reason: "phase number not declared in engagement"
      });
    }
  }
  const QUARTER_RE = /\bQ([1-4])\b(?!\w)/g;
  while ((m = QUARTER_RE.exec(text)) !== null) {
    if (!map.projectPhasesLower.has("q" + m[1])) {
      violations.push({
        kind:   "project-phase",
        claim:  m[0],
        reason: "quarter reference not declared in engagement"
      });
    }
  }

  // 4 · Date-deliverable claims · parenthesized "(Month Day)" patterns
  // are workshop-project-plan style and almost always fabrication on a
  // v3.0 engagement (which carries engagementDate but no per-deliverable
  // calendar dates).
  const PAREN_DATE_RE = new RegExp("\\(\\s*" + MONTHS + "\\s+\\d{1,2}\\s*\\)", "gi");
  while ((m = PAREN_DATE_RE.exec(text)) !== null) {
    if (!map.dateDeliverablesLower.has(m[0].toLowerCase())) {
      violations.push({
        kind:   "date-deliverable",
        claim:  m[0],
        reason: "deliverable date not declared in engagement"
      });
    }
  }
  // Companion: parenthesized "(Q[1-4] <verb>)" like "(Q2 close)" — already
  // caught by QUARTER_RE above, but record specifically as date-deliverable
  // when surrounded by a parenthesized hint to keep BUG-030 trace fidelity.
  const PAREN_QUARTER_RE = /\(\s*Q[1-4][^)]{0,40}\)/g;
  while ((m = PAREN_QUARTER_RE.exec(text)) !== null) {
    if (!map.dateDeliverablesLower.has(m[0].toLowerCase())) {
      violations.push({
        kind:   "date-deliverable",
        claim:  m[0],
        reason: "parenthesized quarter-deliverable not declared in engagement"
      });
    }
  }

  return { ok: violations.length === 0, violations: violations };
}

// ─── Internal helpers ───────────────────────────────────────────────

// Build the grounding map from the engagement: lowercased indexes of
// every label/string the verifier may need to cross-reference against.
function buildGroundingMap(engagement) {
  const eng = engagement || {};
  const gapDescriptionsLower = [];
  const vendorsLower         = [];
  const instanceLabelsLower  = [];
  const projectPhasesLower   = new Set();
  const dateDeliverablesLower = new Set();

  if (eng.gaps && eng.gaps.allIds) {
    for (const id of eng.gaps.allIds) {
      const g = eng.gaps.byId && eng.gaps.byId[id];
      if (g && g.description) gapDescriptionsLower.push(String(g.description).toLowerCase());
    }
  }
  if (eng.instances && eng.instances.allIds) {
    for (const id of eng.instances.allIds) {
      const i = eng.instances.byId && eng.instances.byId[id];
      if (!i) continue;
      if (i.vendor)        vendorsLower.push(String(i.vendor).toLowerCase());
      if (i.vendorGroup === "custom" && i.vendor) vendorsLower.push(String(i.vendor).toLowerCase());
      if (i.label)         instanceLabelsLower.push(String(i.label).toLowerCase());
    }
  }
  // v3.1 may surface engagement.projects[].phase; for v3.0 it's empty.
  if (eng.projects && Array.isArray(eng.projects)) {
    for (const p of eng.projects) {
      if (p && p.phase) projectPhasesLower.add(String(p.phase).toLowerCase());
      if (p && p.deliverableDate) dateDeliverablesLower.add(String(p.deliverableDate).toLowerCase());
    }
  }
  return {
    gapDescriptionsLower,
    vendorsLower,
    instanceLabelsLower,
    projectPhasesLower,
    dateDeliverablesLower
  };
}

// A gap claim traces if the claim string is a substring of any
// engagement gap description (case-insensitive) — or vice versa, to
// allow paraphrasing of long gap descriptions in shorter chat turns.
function gapClaimTraces(claim, map) {
  const c = claim.toLowerCase();
  if (c.length < 4) return true;
  for (const desc of map.gapDescriptionsLower) {
    if (desc.indexOf(c) >= 0) return true;
    // Allow long-claim-contains-short-description pattern only if the
    // description is meaningful (not a single common word). Require
    // ≥6-char overlap.
    if (c.indexOf(desc) >= 0 && desc.length >= 6) return true;
  }
  return false;
}

// A vendor claim traces if it matches a vendor in engagement instances
// OR appears in the DELL_PRODUCT_TAXONOMY whitelist. Per R37.8 the
// whitelist is a hard pass-through (catalog reference data is allowed).
function vendorClaimTraces(claim, map) {
  const c = claim.toLowerCase();
  for (const v of map.vendorsLower) {
    if (v === c || v.indexOf(c) >= 0 || c.indexOf(v) >= 0) return true;
  }
  for (const p of DELL_PRODUCT_TAXONOMY_LOWER) {
    if (c.indexOf(p) >= 0 || p.indexOf(c) >= 0) return true;
  }
  for (const d of DRIVER_LABEL_WHITELIST_LOWER) {
    if (c.indexOf(d) >= 0) return true;
  }
  return false;
}
