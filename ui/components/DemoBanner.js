// ui/components/DemoBanner.js, v2.4.13 S5
//
// Shared "Demo mode , Edit..." banner extracted from ContextView. Mounted
// at the top of every left-panel view when session.isDemo === true so the
// purple/colorful demo signal follows the user across the workshop
// instead of vanishing after Tab 1.
//
// Styling stays in styles.css under .demo-mode-banner (philosophy: do
// not break what users explicitly like). This module is just the render
// helper.

export function renderDemoBanner(target) {
  if (!target || typeof target.appendChild !== "function") return null;
  var b = document.createElement("div");
  b.className = "demo-mode-banner";
  b.innerHTML = "<strong>Demo mode</strong> , You're viewing example data. Edit any field across the workshop to start your own session, then save to file.";
  target.appendChild(b);
  return b;
}
