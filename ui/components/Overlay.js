// ui/components/Overlay.js, v2.4.13 S3
//
// Centered modal component, sister to ui/components/Drawer.js. Used for
// flows that need more workspace than the 560px right drawer:
//   - AI Assist (global top-right button click) . v2.4.13 S4
//   - "+ Add tile / + Add gap / + Add driver" flows . v2.5.0
//
// Default size: ~min(720px, 90vw) wide x ~min(640px, 80vh) tall, centered
// with backdrop blur. Close paths: backdrop click + Escape + close button
// (unless persist:true, see below).
//
// API:
//   openOverlay({ title, lede, body, footer, kind, size, persist, transparent })
//     title       string (sentence-case h3)
//     lede        string (one-line ink-soft summary, optional)
//     body        HTMLElement (the overlay body content)
//     footer      HTMLElement (sticky footer for primary CTA + cancel, optional)
//     kind        "ai-assist" | "add-current-tile" | "add-desired-tile"
//                 | "add-gap" | "add-driver"
//     size        "default" (720x640) | "wide" (1000x720) | "tall"
//                 (720x800), optional
//     persist     boolean (default false). When true, backdrop click does
//                 NOT close. Only Escape + close button + a "Done" CTA in
//                 the footer close. AI Assist uses this so the user can
//                 chain multiple skills in one session.
//     transparent boolean (default false). When true, overlay drops to
//                 ~70% opacity and backdrop is interactive (pointer-
//                 events pass through) so the user can click elements
//                 on the page underneath. Used when a skill needs an
//                 entity selection.
//
//   closeOverlay()         idempotent close. Programmatic override path,
//                          ignores persist.
//   setTransparent(bool)   toggle transparency on an open overlay
//   isOpen()               boolean
//   _resetForTests()       clears DOM + listeners for test isolation

var openEl       = null;       // .overlay panel currently in DOM, or null
var backdropEl   = null;       // .overlay-backdrop
var keydownBound = null;       // currently-bound document keydown handler

export function openOverlay(opts) {
  opts = opts || {};
  // Always close any open overlay first (programmatic override).
  closeOverlay();

  var title       = opts.title || "";
  var lede        = opts.lede || "";
  var body        = opts.body || null;
  var footer      = opts.footer || null;
  var kind        = opts.kind || "default";
  var size        = opts.size || "default";
  var persist     = !!opts.persist;
  var transparent = !!opts.transparent;

  // Backdrop element. Behind the panel; click closes (unless persist
  // OR transparent because transparent = pointer-events should pass
  // through, see setTransparent).
  backdropEl = document.createElement("div");
  backdropEl.className = "overlay-backdrop";
  backdropEl.addEventListener("click", function(e) {
    if (e.target !== backdropEl) return;
    if (persist) return;
    closeOverlay();
  });

  // Panel itself. Triple-section: head (sticky) + body (scrollable) +
  // footer (sticky, optional).
  var panel = document.createElement("div");
  panel.className = "overlay open";
  panel.setAttribute("data-kind", kind);
  panel.setAttribute("data-size", size);
  if (persist)     panel.setAttribute("data-persist", "true");
  if (transparent) panel.classList.add("is-transparent");

  // Head
  var head = document.createElement("div");
  head.className = "overlay-head";

  var headLeft = document.createElement("div");
  headLeft.className = "overlay-head-left";
  if (title) {
    var h3 = document.createElement("h3");
    h3.className = "overlay-title";
    h3.textContent = title;
    headLeft.appendChild(h3);
  }
  if (lede) {
    var ledeEl = document.createElement("div");
    ledeEl.className = "overlay-lede";
    ledeEl.textContent = lede;
    headLeft.appendChild(ledeEl);
  }
  head.appendChild(headLeft);

  // Slot for caller-provided head extras (e.g., AI Assist scope toggle
  // chip). Caller can find it via panel.querySelector(".overlay-head-extras").
  var headExtras = document.createElement("div");
  headExtras.className = "overlay-head-extras";
  head.appendChild(headExtras);

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "overlay-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "✕"; // x mark
  closeBtn.addEventListener("click", function() { closeOverlay(); });
  head.appendChild(closeBtn);

  panel.appendChild(head);

  // Body
  var bodyWrap = document.createElement("div");
  bodyWrap.className = "overlay-body";
  if (body) bodyWrap.appendChild(body);
  panel.appendChild(bodyWrap);

  // Footer (optional)
  if (footer) {
    var footWrap = document.createElement("div");
    footWrap.className = "overlay-footer";
    footWrap.appendChild(footer);
    panel.appendChild(footWrap);
  }

  // Mount
  document.body.appendChild(backdropEl);
  document.body.appendChild(panel);
  openEl = panel;

  // Escape always closes (override even persist; matches drawer pattern
  // and the v2.4.13 spec which lists Escape as a forced-close path).
  keydownBound = function(e) {
    if (e.key === "Escape" || e.keyCode === 27) {
      closeOverlay();
    }
  };
  document.addEventListener("keydown", keydownBound);

  // Focus management. Move focus into the overlay so screen readers and
  // keyboard users land in the right context.
  setTimeout(function() {
    var firstFocusable = panel.querySelector(
      "input, select, textarea, button:not(.overlay-close), [tabindex]:not([tabindex='-1'])"
    );
    if (firstFocusable && typeof firstFocusable.focus === "function") {
      try { firstFocusable.focus(); } catch (e) { /* swallow */ }
    } else {
      try { closeBtn.focus(); } catch (e) { /* swallow */ }
    }
  }, 50);

  return panel;
}

export function closeOverlay() {
  if (keydownBound) {
    document.removeEventListener("keydown", keydownBound);
    keydownBound = null;
  }
  if (backdropEl && backdropEl.parentNode) {
    backdropEl.parentNode.removeChild(backdropEl);
  }
  if (openEl && openEl.parentNode) {
    openEl.parentNode.removeChild(openEl);
  }
  backdropEl = null;
  openEl     = null;
}

export function isOpen() {
  return !!(openEl && openEl.parentNode);
}

export function setTransparent(flag) {
  if (!openEl) return;
  if (flag) {
    openEl.classList.add("is-transparent");
    if (backdropEl) backdropEl.classList.add("is-transparent");
  } else {
    openEl.classList.remove("is-transparent");
    if (backdropEl) backdropEl.classList.remove("is-transparent");
  }
}

export function _resetForTests() {
  closeOverlay();
}
