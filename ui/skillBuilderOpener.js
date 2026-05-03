// ui/skillBuilderOpener.js — rc.3 #7 (SPEC §S29.7)
//
// Open-Skill-Builder entry point used by both the topbar wiring (kept
// null-safe in app.js since the button was removed in rc.3 #7) and the
// Canvas Chat right-rail "+ Author new skill" affordance. Lazily
// imports SkillBuilder.js so schema/zod don't load on every page —
// only when the user actually opens the surface.
//
// Authority: docs/v3.0/SPEC.md §S29.7 · docs/RULES.md §16.

export async function openSkillBuilderOverlay() {
  const existing = document.getElementById("skillBuilderOverlay");
  if (existing) { existing.remove(); return; }
  const overlay = document.createElement("div");
  overlay.id = "skillBuilderOverlay";
  overlay.className = "skill-builder-overlay";
  overlay.innerHTML = '<button class="skill-builder-overlay-close" aria-label="Close">×</button>' +
                      '<div class="skill-builder-overlay-host" style="width:100%;"></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector(".skill-builder-overlay-close")
    .addEventListener("click", function() { overlay.remove(); });
  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape" && document.body.contains(overlay)) {
      overlay.remove();
      document.removeEventListener("keydown", escHandler);
    }
  });

  const host = overlay.querySelector(".skill-builder-overlay-host");
  try {
    const mod = await import("./views/SkillBuilder.js");
    mod.renderSkillBuilder(host);
  } catch (e) {
    host.innerHTML = '<div style="padding:24px;color:#a52a2a;background:#fff;border-radius:8px;">' +
                     'Failed to load Skill Builder: ' + (e && e.message || e) + '</div>';
  }
}
