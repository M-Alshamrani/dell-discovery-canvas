// core/dataContract.js
//
// SPEC §S25 · Data contract — LLM grounding meta-model. The single
// artifact that grounds every Canvas Chat turn. Derived (NEVER hand-
// maintained) from schemas + manifest + catalogs at module load,
// validates itself on import, carries a deterministic FNV-1a checksum,
// gets serialized into the chat system prompt as the authoritative
// reference. The first-turn handshake (§S20.16) verifies the LLM has
// loaded it.
//
// Status: STUB v3.0.0-rc.2 RED-first. getDataContract() throws "not
// implemented". V-CONTRACT-1..7 fail RED until impl ships in the
// next commit (Step 2 of chat-perfection arc).
//
// Forbidden (per RULES §17 / SPEC §S23):
//   - importing from tests/
//   - hand-maintained content that could be derived
//   - non-deterministic checksums (no clocks; pure FNV-1a over canonical JSON)
//   - skipping the module-load self-validation
//
// Authority: docs/v3.0/SPEC.md §S25 · docs/v3.0/TESTS.md §T25 V-CONTRACT-* ·
//            docs/RULES.md §16 CH15+CH16+CH17.

// getDataContract() → { schemaVersion, checksum, generatedAt, entities,
//                       relationships, invariants, catalogs, bindablePaths,
//                       analyticalViews }
export function getDataContract() {
  throw new Error("getDataContract: not implemented (rc.2 RED-first; real impl ships next commit)");
}

// getContractChecksum() → 8-char lowercase hex (FNV-1a first 8 of full hash)
export function getContractChecksum() {
  throw new Error("getContractChecksum: not implemented (rc.2 RED-first)");
}
