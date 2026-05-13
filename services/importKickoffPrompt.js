// services/importKickoffPrompt.js — rc.8 / Path B kickoff pane (SPEC §S47.8.5)
//
// Builds the SHORT context-aware "first prompt" snippet the engineer copies
// as the very first message to their Dell internal LLM session, BEFORE
// pasting the full LLM Instructions Prompt (built by importInstructionsBuilder.js).
//
// PURPOSE (per SPEC §S47.8.5):
//   The full instructions file is long (11+ sections, ~6-8 KB). When the
//   engineer pastes it cold, the LLM can rush to "extract + emit JSON"
//   skipping the Phase A · B · C walkthrough. The kickoff snippet is a
//   short, dense priming message that (a) names the customer + env count
//   so the LLM has immediate context, (b) tells the LLM that an
//   instructions file AND a source file will follow, (c) commands the LLM
//   to follow Phase A · B · C explicitly, and (d) commands the LLM NOT to
//   emit final JSON before the engineer confirms the mapping table.
//
// CONTRACT (per SPEC §S47.8.5 + tests):
//   - Export buildKickoffPrompt(engagement) -> { content: <non-empty string> }
//   - content MUST embed customer name + env count (V-FLOW-IMPORT-KICKOFF-2)
//   - content MUST mention "Phase A", "Phase B", "Phase C" (V-FLOW-IMPORT-KICKOFF-3)
//   - content MUST tell the LLM NOT to emit JSON before approval (V-FLOW-IMPORT-KICKOFF-3)
//   - content MUST tell the engineer to upload the source file INTO the LLM
//     chat (NOT into the canvas) (V-FLOW-IMPORT-KICKOFF-3)
//   - target length ≤ 200 words (SPEC R47.8.5 · soft target, not asserted)
//
// Authority: docs/v3.0/SPEC.md §S47.8.5 + §S47.4.7 + §S47.10 (V-FLOW-IMPORT-KICKOFF-1..3).

// buildKickoffPrompt(engagement) -> { content }
//   engagement: live engagement object (passed from ImportDataModal at click time)
// Returns: { content: <string> } where content is the engineer-pastes-this-first snippet.
//
// The snippet is rendered as plain text (no markdown fences) so the engineer
// can paste it into any chat surface (web LLM, mobile, terminal) without
// formatting damage.
export function buildKickoffPrompt(engagement) {
  const customer    = (engagement && engagement.customer) || {};
  const customerName = (typeof customer.name === "string" && customer.name.trim()) || "this customer";
  const envIds      = (engagement && engagement.environments && Array.isArray(engagement.environments.allIds))
                        ? engagement.environments.allIds
                        : [];
  const envCount    = envIds.length;
  const envWord     = envCount === 1 ? "environment" : "environments";

  // The kickoff prompt body. Plain text · no markdown fences · ≤200 words.
  // Each paragraph is one focused idea so the LLM cannot conflate them.
  const lines = [
    "You are about to help me extract technology install-base data for the customer **" + customerName + "** into Dell Discovery Canvas. The customer has " + envCount + " " + envWord + " in scope.",
    "",
    "TWO INPUTS will follow this message:",
    "  1. An LLM Instructions Prompt (.txt) describing exactly how to map extracted rows to the canvas schema, including the customer's environment UUIDs.",
    "  2. A source file (CSV / XLSX / PDF / TXT) I will UPLOAD INTO THIS CHAT — this is the customer's install-base / product list / BOM. Upload the source file INTO YOUR LLM CHAT, not into the Canvas app; the Canvas app only consumes your final JSON in a later step.",
    "",
    "FOLLOW THE THREE PHASES STRICTLY:",
    "  • Phase A · Extract — read the source file silently. Identify discrete technology instances. Do not show me anything yet.",
    "  • Phase B · Confirm with engineer — present a mapping table (markdown, or CSV if you cannot render rich tables, or fixed-width plaintext as a last resort) showing every extracted row with proposed canvas mapping. STOP and ask me to approve. I may also ask you to normalize labels or correct individual rows. Iterate until I say 'looks good' or 'approved' or 'ship it'.",
    "  • Phase C · Emit final JSON — ONLY after I approve, output the JSON object matching the schema in the instructions file. No prose, no fences, no commentary around the JSON.",
    "",
    "DO NOT emit final JSON before I have approved the mapping table in Phase B. Wait for my explicit go-ahead.",
    "",
    "Reply with 'Ready — paste the instructions file and upload the source file.' when you understand these rules."
  ];

  return { content: lines.join("\n") };
}
