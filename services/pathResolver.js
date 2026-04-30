// services/pathResolver.js — v3.0 · SPEC sec S7.3
//
// Resolves {{path}} placeholders in a skill's promptTemplate against
// a ResolverContext. Pure + synchronous (S7.3.4). The async work
// (LLM call) is one layer up.
//
// ResolverContext shape (SPEC S7.3.2):
//   - For session-wide skills:
//       { engagement, execSummaryInputs }
//   - For click-to-run skills:
//       { engagement, activeEntity, linkedComposition, catalogs }
//
// Path conventions:
//   - "customer.name"                  -> session-level engagement field
//   - "engagementMeta.engagementDate"  -> session-level meta field
//   - "context.driver.priority"        -> active entity's own field
//   - "context.driver.catalog.label"   -> active entity's catalog metadata
//   - "context.driver.linkedGaps[*].description"
//                                      -> array path; joined with newlines
//
// Per SPEC S7.3.3: undefined results substitute the literal "[?]"
// placeholder + log via skillRuntimeLog (logger is injectable; v3.0
// uses console.warn as the default sink).

const PLACEHOLDER_RE = /\{\{([^{}]+?)\}\}/g;

// Default logger — production wires the real services/skillRuntimeLog.
function defaultLogUndefined(info) {
  // eslint-disable-next-line no-console
  console.warn("[pathResolver] undefined path:", info.path,
               "skillId:", info.skillId, "context kind:", info.contextKind);
}

export function resolveTemplate(template, ctx, opts = {}) {
  const logger = opts.logUndefined || defaultLogUndefined;
  const skillId = opts.skillId || "(unknown)";
  return template.replace(PLACEHOLDER_RE, (_match, raw) => {
    const path = raw.trim();
    const value = resolvePath(path, ctx);
    if (value === undefined) {
      logger({ path, skillId, contextKind: ctx?.activeEntity?.kind || "session-wide" });
      return "[?]";
    }
    return formatValue(value);
  });
}

// Pure path resolver. Returns the resolved value or undefined.
export function resolvePath(path, ctx) {
  // Wildcard array path: e.g. "context.driver.linkedGaps[*].description".
  // Split on [*] and recurse on the inner path for each array element.
  if (path.includes("[*]")) {
    const idx = path.indexOf("[*]");
    const head = path.slice(0, idx);
    const tail = path.slice(idx + 4);                    // skip "[*]." or "[*]"
    const arr = resolvePath(head, ctx);
    if (!Array.isArray(arr)) return undefined;
    if (tail === "" || tail === ".") return arr;         // bare array
    const innerPath = tail.startsWith(".") ? tail.slice(1) : tail;
    return arr.map(elem => resolveSegments(elem, innerPath.split(".")));
  }
  return resolveSegments(ctx, path.split("."));
}

function resolveSegments(root, segments) {
  let cur = root;
  for (const seg of segments) {
    if (cur == null) return undefined;
    cur = cur[seg];
  }
  return cur;
}

function formatValue(value) {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .map(v => (v == null ? "" : (typeof v === "object" ? JSON.stringify(v) : String(v))))
      .filter(s => s.length > 0)
      .join("\n");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
