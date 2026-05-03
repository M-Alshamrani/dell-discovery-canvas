// services/uuidScrubber.js — SPEC §S20.16 + BUG-013 Path B (2026-05-03)
//
// Defensive runtime scrub that replaces bare v3-format UUIDs in the
// LLM's prose with human-readable labels resolved from the active
// engagement. Defense-in-depth on top of the BUG-013 Path A landings
// (commit `d324971`): the role section already instructs the LLM to
// cite labels not ids, AND the selectors carry humanized labels
// alongside their UUID keys (V-CHAT-21/22). Despite that, real-world
// model outputs sometimes still slip a UUID into prose. This scrub
// is the belt-and-suspenders pair to the prompt-time discipline.
//
// **Behavior**:
//   - Matches the 36-char UUID shape (8-4-4-4-12 hex). Case-insensitive.
//   - For each match, looks up the UUID in the engagement's entity
//     collections (gaps / drivers / environments / instances). If found,
//     replaces with the entity's user-facing label (description /
//     alias / name). If not found, replaces with `[unknown reference]`.
//   - **Skips fenced code blocks** (``` ``` ```) and inline code
//     (`...`). The LLM may legitimately quote JSON with UUIDs in code;
//     scrubbing inside code would corrupt the example.
//
// **Idempotent**: a label substituted on pass 1 has no UUID shape on
// pass 2, so re-running is a no-op. Safe to apply at every onToken.
//
// **Cheap**: O(n) over text length; the regex match is fast and the
// labelMap lookup is a hash hit.
//
// Authority: docs/v3.0/SPEC.md §S20.16 · docs/RULES.md §16 CH18.

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

// buildLabelMap(engagement) — returns { [uuid]: label } map covering
// every UUID-keyed entity reachable from the engagement. Labels are
// chosen by entity-type priority:
//   gap:         description (truncated to 60 chars at first sentence/comma)
//   driver:      label OR id (driver objects often carry both)
//   environment: alias OR envCatalogId (alias is the user-facing name)
//   instance:    label OR roleHint OR vendor + " instance"
// Returns an empty map if engagement is null/missing collections.
export function buildLabelMap(engagement) {
  const map = {};
  if (!engagement || typeof engagement !== "object") return map;

  // Gaps — description is the user-facing name; truncate so substituted
  // text stays readable.
  if (engagement.gaps && engagement.gaps.byId) {
    for (const [id, gap] of Object.entries(engagement.gaps.byId)) {
      const desc = gap && (gap.description || gap.label);
      if (typeof desc === "string" && desc.length > 0) {
        map[id] = truncateLabel(desc);
      }
    }
  }
  // Drivers — label is the user-facing name (e.g. "Cyber resilience").
  if (engagement.drivers && engagement.drivers.byId) {
    for (const [id, drv] of Object.entries(engagement.drivers.byId)) {
      const lbl = drv && (drv.label || drv.id);
      if (typeof lbl === "string" && lbl.length > 0) {
        map[id] = lbl;
      }
    }
  }
  // Environments — alias is the user-facing name; envCatalogId is the
  // catalog key (e.g. "coreDc"). Prefer alias.
  if (engagement.environments && engagement.environments.byId) {
    for (const [id, env] of Object.entries(engagement.environments.byId)) {
      const lbl = env && (env.alias || env.envCatalogId);
      if (typeof lbl === "string" && lbl.length > 0) {
        map[id] = lbl;
      }
    }
  }
  // Instances — label OR roleHint OR vendor.
  if (engagement.instances && engagement.instances.byId) {
    for (const [id, inst] of Object.entries(engagement.instances.byId)) {
      const lbl = inst && (inst.label || inst.roleHint ||
        (inst.vendor ? inst.vendor + " instance" : null));
      if (typeof lbl === "string" && lbl.length > 0) {
        map[id] = lbl;
      }
    }
  }
  return map;
}

// scrubUuidsInProse(text, labelMap) — returns text with bare UUIDs
// replaced by their resolved labels (or `[unknown reference]` for
// orphan UUIDs). Skips fenced code blocks (```...```) and inline code
// (`...`) so legitimate JSON examples in the AI's response stay intact.
export function scrubUuidsInProse(text, labelMap) {
  if (typeof text !== "string" || text.length === 0) return text;
  const map = labelMap || {};

  // Split into segments: code-block / inline-code / plain. Code regions
  // pass through unchanged; plain regions are scrubbed.
  // Order matters: match fenced code blocks first (greedy), then inline
  // code, then plain text.
  const SEGMENT_RE = /(```[\s\S]*?```|`[^`\n]+`)/g;

  let out = "";
  let lastIdx = 0;
  let m;
  while ((m = SEGMENT_RE.exec(text)) !== null) {
    // Plain segment before this code segment — scrub it.
    out += scrubPlainSegment(text.slice(lastIdx, m.index), map);
    // Code segment — pass through.
    out += m[0];
    lastIdx = m.index + m[0].length;
  }
  // Tail plain segment.
  out += scrubPlainSegment(text.slice(lastIdx), map);
  return out;
}

function scrubPlainSegment(seg, labelMap) {
  if (seg.length === 0) return seg;
  return seg.replace(UUID_RE, function(match) {
    const lower = match.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(labelMap, lower)) {
      return labelMap[lower];
    }
    // Also try the as-emitted casing (some models upper-case hex).
    if (Object.prototype.hasOwnProperty.call(labelMap, match)) {
      return labelMap[match];
    }
    return "[unknown reference]";
  });
}

function truncateLabel(text) {
  const trimmed = text.trim();
  if (trimmed.length <= 60) return trimmed;
  // Prefer break at sentence/punctuation if one is in [40, 60].
  const cut = trimmed.slice(0, 60);
  const lastBreak = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf(", "),
    cut.lastIndexOf(" — "),
    cut.lastIndexOf(" - ")
  );
  if (lastBreak >= 40) return trimmed.slice(0, lastBreak);
  return cut + "…";
}
