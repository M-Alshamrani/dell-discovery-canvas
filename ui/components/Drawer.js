// ui/components/Drawer.js, Phase 19m / v2.5.0
//
// Slide-in detail panel module. Used drawer-everywhere across Tabs 1-5
// per the v2.5.0 spec. Exports openDrawer + closeDrawer; owns the
// backdrop element + panel element + close-paths + content-swap on
// different-card-click.
//
// STUB, v2.5.0 spec-and-test-first phase: exports resolve so the test
// suite can import them; implementations are no-ops so VT7 fails RED.
// Implementation phase fills in DOM construction, animation, focus
// management, content-swap.
//
// API (final shape; both stubs and impl honor it):
//   openDrawer({ crumbs, title, lede, body, footer, kind })
//     crumbs : string (mono caps breadcrumb path, leaf in --dell-blue)
//     title  : string (sentence-case h3)
//     lede   : string (one-line ink-soft summary, optional)
//     body   : HTMLElement (the §4 universal template body content)
//     footer : HTMLElement (sticky footer for edit-mode, optional)
//     kind   : "gap" | "current-tile" | "desired-tile" | "project"
//              | "service" | "driver"
//
//   closeDrawer()                     idempotent close
//   _resetForTests()                  test-only reset
//   isOpen()                          boolean

export function openDrawer(opts) {
  // STUB: no DOM construction yet. VT7 fails RED until impl phase.
  return;
}

export function closeDrawer() {
  // STUB
  return;
}

export function isOpen() {
  return false;
}

export function _resetForTests() {
  // STUB
  return;
}
