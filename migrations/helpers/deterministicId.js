// migrations/helpers/deterministicId.js — v3.0 · MIGRATION sec M2.1
//
// Deterministic id generation. The migrator must be IDEMPOTENT (M2.1.2):
// running it twice on the same v2.0 input must produce byte-identical
// v3.0 output. This requires deterministic ids, not random UUIDs.
//
// Algorithm: FNV-1a 32-bit hash, computed 4 times with different seeds,
// concatenated into a 128-bit value carved into UUID v8 (custom) shape:
//
//   xxxxxxxx-xxxx-8xxx-xxxx-xxxxxxxxxxxx
//                ^ version 8 marker (custom)
//
// FNV-1a is sufficient for our scale (per MIGRATION M2.1.3 the directive
// noted SHA-256 collisions aren't a concern at <500 instances; FNV-1a's
// 128-bit composite is collision-safe at the same scale). Fully synchronous,
// no Web Crypto dependency, works in any environment.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME  = 0x01000193;
const SEED_BYTES = ["A", "B", "C", "D"];

function fnv1a32(str, seed) {
  let h = (FNV_OFFSET ^ seed.charCodeAt(0)) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h ^ str.charCodeAt(i)) >>> 0);
    // FNV_PRIME multiplication; Math.imul keeps it in 32-bit signed range
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h;
}

function toHex8(n) {
  return n.toString(16).padStart(8, "0");
}

// generateDeterministicId(kind, ...inputs) — every input contributes to
// the hash; same (kind, inputs) tuple always produces the same id.
export function generateDeterministicId(kind, ...inputs) {
  const payload = [kind, ...inputs.map(i => i == null ? "<null>" : String(i))].join("\x1f");
  const h0 = fnv1a32(payload, SEED_BYTES[0]);
  const h1 = fnv1a32(payload, SEED_BYTES[1]);
  const h2 = fnv1a32(payload, SEED_BYTES[2]);
  const h3 = fnv1a32(payload, SEED_BYTES[3]);
  const hex = toHex8(h0) + toHex8(h1) + toHex8(h2) + toHex8(h3);
  // Carve into UUID v8 (custom) shape with version nibble forced to 8.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "8" + hex.slice(13, 16),                    // version 8
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),  // variant 10xx
    hex.slice(20, 32)
  ].join("-");
}
