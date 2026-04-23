// ui/icons.js — v2.1 inline-SVG sprite module.
// All icons are 14px outline, `currentColor` stroke so they inherit button text colour.
// Each helper returns a fresh SVG element the caller appends.

function makeSvg(inner, opts) {
  var el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.setAttribute("width",  (opts && opts.size) || "14");
  el.setAttribute("height", (opts && opts.size) || "14");
  el.setAttribute("viewBox", "0 0 16 16");
  el.setAttribute("fill", "none");
  el.setAttribute("stroke", "currentColor");
  el.setAttribute("stroke-width", "1.5");
  el.setAttribute("stroke-linecap", "round");
  el.setAttribute("stroke-linejoin", "round");
  el.setAttribute("aria-hidden", "true");
  if (opts && opts.className) el.setAttribute("class", opts.className);
  el.innerHTML = inner;
  return el;
}

/** Help ( ? ) icon in an outline circle. */
export function helpIcon() {
  return makeSvg(
    '<circle cx="8" cy="8" r="7"/>' +
    '<path d="M6 6a2 2 0 0 1 4 0c0 1 -1 1.3 -1.5 1.8 -0.3 0.3 -0.5 0.6 -0.5 1.2"/>' +
    '<circle cx="8" cy="12" r="0.6" fill="currentColor" stroke="none"/>'
  );
}

/** Solid five-point star — used for "confirmed strategic driver". */
export function starSolidIcon() {
  return makeSvg(
    '<polygon points="8,1.5 9.8,6 14.5,6.2 10.9,9.3 12.2,14 8,11.5 3.8,14 5.1,9.3 1.5,6.2 6.2,6" fill="currentColor" stroke="currentColor"/>'
  );
}

/** Outline star — used for "auto-suggested strategic driver". */
export function starOutlineIcon() {
  return makeSvg(
    '<polygon points="8,1.5 9.8,6 14.5,6.2 10.9,9.3 12.2,14 8,11.5 3.8,14 5.1,9.3 1.5,6.2 6.2,6"/>'
  );
}
