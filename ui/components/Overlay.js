// ui/components/Overlay.js, Phase 19m / v2.4.13
//
// Centered modal component, sister to ui/components/Drawer.js. Used for
// flows that need more workspace than the 560px right drawer:
//   - AI Assist (global top-right button click) . v2.4.13
//   - "+ Add tile / + Add gap / + Add driver" flows . v2.5.0
//
// Default size: ~min(720px, 90vw) wide x ~min(640px, 80vh) tall, centered
// with backdrop blur. Close paths: backdrop click + Escape + close button.
//
// API (final shape; both stubs and impl honor it):
//   openOverlay({ title, lede, body, footer, kind, size, persist, transparent })
//     title       : string (sentence-case h3)
//     lede        : string (one-line ink-soft summary, optional)
//     body        : HTMLElement (the overlay body content)
//     footer      : HTMLElement (sticky footer for primary CTA + cancel, optional)
//     kind        : "ai-assist" | "add-current-tile" | "add-desired-tile"
//                 | "add-gap" | "add-driver"
//     size        : "default" (720x640) | "wide" (1000x720) | "tall"
//                    (720x800), optional
//     persist     : boolean (default false). When true, backdrop click and
//                   Apply-style buttons do NOT close. Only Escape, the
//                   close button, or a "Done" CTA close. Used by AI
//                   Assist for multi-skill chained sessions.
//     transparent : boolean (default false). When true, overlay drops to
//                   ~70% opacity and backdrop is interactive (pointer-
//                   events pass through) so the user can click an
//                   element on the page underneath. Used by AI Assist
//                   when a skill needs an entity selection.
//
//   closeOverlay()                     idempotent close (ignores `persist`
//                                      since this is the programmatic
//                                      override path)
//   setTransparent(bool)               toggle transparency mode on an
//                                      already-open overlay
//   _resetForTests()                   test-only reset
//   isOpen()                           boolean
//
// STUB, v2.4.13 spec-and-test-first phase: exports resolve so Suite 45
// tests can import them; implementations are no-ops so VT24 fails RED
// until v2.4.13 implementation lands.

export function openOverlay(opts) {
  // STUB: no DOM construction yet. VT24 fails RED until implementation phase.
  return;
}

export function closeOverlay() {
  // STUB
  return;
}

export function isOpen() {
  return false;
}

export function setTransparent(flag) {
  // STUB . AI Assist transparency toggle. Implementation phase 4 D adds
  // .overlay.is-transparent class with backdrop pointer-events:none and
  // overlay opacity: 0.7.
  return;
}

export function _resetForTests() {
  // STUB
  return;
}
