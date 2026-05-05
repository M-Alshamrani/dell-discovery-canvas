// ui/skillBuilderOpener.js — rc.4-dev Arc 4b shim (SPEC §S35.1 R35.3)
//
// **Post-Arc-4 contract**: this is a thin redirect shim. The standalone
// `#skillBuilderOverlay` div the opener used to create is RETIRED — the
// canonical home for skill authoring is now Settings → Skills builder
// pill (per CH31 / SPEC §S35). This shim is kept as a single chokepoint
// so call sites (the chat right-rail "+ Author new skill" affordance
// in CanvasChatOverlay; topbar wiring in app.js if it ever returns)
// don't have to know the exact route — they just call
// openSkillBuilderOverlay() and we drive them to Settings.
//
// Authority: docs/v3.0/SPEC.md §S35 · docs/RULES.md §16 CH31.

import { closeOverlay } from "./components/Overlay.js";

export async function openSkillBuilderOverlay() {
  // 1. Close whatever overlay is open (likely the Canvas AI Assistant
  //    chat overlay since that's the primary call site post-rc.3).
  //    Settings will mount a fresh overlay via Overlay.js singleton.
  try { closeOverlay(); } catch (_e) { /* no-op if nothing's open */ }

  // 2. Open Settings → Skills builder. Lazy-import to keep this module
  //    cheap if it's never invoked, and so the schema/zod surface only
  //    loads when the user actually opens the builder.
  try {
    const mod = await import("./views/SettingsModal.js");
    mod.openSettingsModal({ section: "skills" });
  } catch (e) {
    // Last-resort visible fallback — should never happen in a
    // properly-built container, but if it does we want the user to
    // see SOMETHING instead of a silent no-op.
    var fallback = document.createElement("div");
    fallback.setAttribute("role", "alert");
    fallback.style.cssText = "position:fixed;top:20px;left:50%;transform:translateX(-50%);" +
                             "z-index:9999;padding:16px 24px;background:#FEE2E2;" +
                             "border:1px solid #FCA5A5;border-radius:8px;color:#7f1d1d;" +
                             "font:13px Inter,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.15);";
    fallback.textContent = "Couldn't open Settings: " + (e && e.message || e);
    document.body.appendChild(fallback);
    setTimeout(function() { try { fallback.remove(); } catch (_e2) {} }, 4000);
  }
}
