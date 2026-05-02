// services/systemPromptAssembler.js
//
// SPEC §S20.4 · 5-layer system prompt builder for Canvas Chat.
// Layers: role / data model / manifest / engagement snapshot / views.
// Layers 1+2+3+5-descriptions are the **stable prefix** — cached on
// Anthropic via cache_control: {"type":"ephemeral"} per S20.7.
// Layer 4 (engagement snapshot) is token-budgeted per S20.6.
//
// Status: STUB (rc.2 RED-first 2026-05-02).
//
// Authority: docs/v3.0/SPEC.md §S20.4 · docs/v3.0/TESTS.md §T20 V-CHAT-{1,2,10,12}.

// buildSystemPrompt({engagement, manifest, catalogs, options})
// → { messages: [...], cacheControl: [...] }
//
// `messages` is the system + tool definitions block(s) to send to the
// provider. `cacheControl` is an index array marking which message
// indices carry the cache_control marker (Anthropic-specific).
export function buildSystemPrompt(_opts) {
  // Stub: returns empty 5-layer structure. Real impl assembles
  // the role + data-model + manifest + engagement + views layers
  // per SPEC §S20.4.
  return { messages: [], cacheControl: [] };
}
