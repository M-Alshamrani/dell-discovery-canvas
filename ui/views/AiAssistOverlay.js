// ui/views/AiAssistOverlay.js, v2.4.13 S4
//
// Global AI Assist overlay. Opened by the topbar #topbarAiBtn click
// (wired in app.js wireTopbarAiBtn). Replaces the per-driver useAiButton
// mounting on Tab 1 ContextView; AI is now globally accessible from any
// tab.
//
// Body shape:
//   tab-context summary (mono caps eyebrow + sentence)
//   .ai-skill-list . tile grid of .ai-skill-tile cards
//   .ai-skill-result . inline result panel mounted below the grid
//
// Head extras: scope toggle chip ("Current tab" / "All tabs").
// Footer: "Done" CTA that closes the overlay.
//
// Persistence: openOverlay({ persist: true }) so Apply doesn't close.
// Only Escape, x, or Done close.
//
// Element-pick transparency: when a skill is flagged as needing an
// entity selection, the overlay calls setTransparent(true) and listens
// for a "dell-canvas:entity-click" event. Views can dispatch this when
// in pick mode; for v2.4.13 the listener is wired but views do not emit
// yet (placeholder for v2.5.0 drawer integration).

import { openOverlay, closeOverlay, setTransparent, isOpen } from "../components/Overlay.js";
import { loadSkills, skillsForTab, getSkill } from "../../core/skillStore.js";
import { runSkillById } from "../../interactions/skillCommands.js";
import { loadAiConfig } from "../../core/aiConfig.js";
import { applyProposal, applyAllProposals } from "../../interactions/aiCommands.js";
import { onSkillsChanged } from "../../core/skillsEvents.js";
import { session } from "../../state/sessionStore.js";

// Display labels for the AI Assist body. The first entry is what the
// user sees on the tab strip; we deliberately use a different word in
// the overlay eyebrow (ACTIVE TAB) so the overlay's "Context" tab name
// doesn't collide with the meaning of "context" as a concept.
var TAB_LABEL = {
  context:   "Tab 1 . Context",
  current:   "Tab 2 . Current State",
  desired:   "Tab 3 . Desired State",
  gaps:      "Tab 4 . Gaps",
  reporting: "Tab 5 . Reporting"
};

var state = {
  tabId:    "context",
  context:  {},
  scope:    "current",   // "current" | "all"
  unsubSkills: null,
  pickListener: null
};

export function openAiOverlay(opts) {
  opts = opts || {};
  state.tabId   = opts.tabId   || "context";
  state.context = opts.context || {};
  state.scope   = "current";

  var body   = buildBody();
  var footer = buildFooter();

  openOverlay({
    title:   "AI Assist",
    lede:    "Run a skill against your current canvas. Apply leaves the panel open so you can chain another.",
    body:    body,
    footer:  footer,
    kind:    "ai-assist",
    size:    "default",
    persist: true,
    transparent: false
  });

  // Scope toggle chip. Inject into the overlay-head-extras slot the
  // Overlay component exposes.
  injectScopeToggle();

  // Re-render the tile grid whenever the skills library changes (PR2
  // bus). Cleanup happens on close (we listen for the document keydown
  // matching the close path; simpler: install once and let the next
  // open's openOverlay->closeOverlay sequence trigger _resetForTests
  // garbage collection).
  if (state.unsubSkills) state.unsubSkills();
  state.unsubSkills = onSkillsChanged(function() {
    paintTiles(body);
  });

  // Element-pick listener. Views dispatch dell-canvas:entity-click on
  // every interactive element click; while transparent we intercept
  // the event, store the picked entity in context, and drop
  // transparency. While NOT transparent we ignore the event so normal
  // clicks aren't hijacked.
  if (state.pickListener) document.removeEventListener("dell-canvas:entity-click", state.pickListener);
  state.pickListener = function(ev) {
    if (!isOpen()) return;
    var panel = document.querySelector(".overlay.open.is-transparent");
    if (!panel) return;   // not in pick mode
    var d = ev && ev.detail || {};
    state.context.picked = d;
    exitPickMode(body, d);
  };
  document.addEventListener("dell-canvas:entity-click", state.pickListener);
}

/* Public API to enter pick mode from outside the overlay. Currently
   unused by v2.4.13 callers but exposed so tile click handlers can
   invoke it when a skill is flagged as needing entity selection. */
export { engagePickMode };

function buildBody() {
  var body = document.createElement("div");
  body.className = "ai-assist-body";

  // Active-tab strip. Eyebrow says ACTIVE TAB (not CONTEXT) so the
  // word doesn't collide with the Tab 1 name "Context."
  var ctx = document.createElement("div");
  ctx.className = "ai-assist-context";
  var eyebrow = document.createElement("div");
  eyebrow.className = "eyebrow eyebrow-blue";
  eyebrow.textContent = "Active tab";
  ctx.appendChild(eyebrow);
  var ctxText = document.createElement("div");
  ctxText.className = "ai-assist-context-text";
  ctxText.textContent = "You're on " + (TAB_LABEL[state.tabId] || state.tabId) +
    ". Skills below run against this tab's data. Use the segmented toggle to widen scope to every deployed skill.";
  ctx.appendChild(ctxText);
  body.appendChild(ctx);

  // Tile grid container
  var grid = document.createElement("div");
  grid.className = "ai-skill-list";
  grid.setAttribute("data-skill-list", "");
  body.appendChild(grid);

  // Inline result panel (hidden until a tile is run)
  var result = document.createElement("div");
  result.className = "ai-skill-result-panel";
  result.style.display = "none";
  body.appendChild(result);

  // Pick-mode status (hidden until pick mode active)
  var pickStatus = document.createElement("div");
  pickStatus.className = "ai-pick-status";
  pickStatus.style.display = "none";
  body.appendChild(pickStatus);

  paintTiles(body);
  return body;
}

// v2.4.13 user-feedback polish . engage transparency mode so the user
// can click a target on the page underneath. Shows a status row "Pick
// a [entity] on the page..." inside the overlay; installs a global
// capture-phase click interceptor that dispatches dell-canvas:entity-
// click for any element carrying data-instance-id / data-gap-id /
// data-driver-id / data-project-id. The pickListener inside openAi-
// Overlay catches that event and drops transparency.
var PICK_SELECTORS = "[data-instance-id], [data-gap-id], [data-driver-id], [data-project-id], .driver-tile, .instance-tile, .gap-card";

function engagePickMode(body, label) {
  setTransparent(true);

  // Inline status row inside the overlay is suppressed during pick
  // mode (the overlay itself is barely visible at 10% opacity);
  // a separate floating .pick-mode-pill is the persistent indicator.
  var status = body.querySelector(".ai-pick-status");
  if (status) status.style.display = "none";

  // Floating pill at top-center of the viewport. Persists until the
  // user picks an entity or presses Escape.
  var existing = document.querySelector(".pick-mode-pill");
  if (existing) existing.remove();
  var pill = document.createElement("div");
  pill.className = "pick-mode-pill";
  pill.innerHTML =
    '<svg class="pick-mode-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 3l4.2 11 1.5-4.5 4.5-1.5L3 3z"/>' +
    '</svg>' +
    '<span>Pick ' + (label || "a target") + ' on the page</span>' +
    '<span class="pick-mode-kbd">Esc</span>';
  document.body.appendChild(pill);

  var cancelOnEsc = function(e) {
    if (e.key !== "Escape" && e.keyCode !== 27) return;
    e.stopPropagation();
    teardown();
  };

  var clickInterceptor = function(e) {
    var panel = document.querySelector(".overlay.open.is-transparent");
    if (!panel) return;
    if (panel.contains(e.target)) return;
    if (pill && pill.contains(e.target)) return;
    var hit = e.target.closest(PICK_SELECTORS);
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    var detail = {
      id:    hit.getAttribute("data-instance-id")
          || hit.getAttribute("data-gap-id")
          || hit.getAttribute("data-driver-id")
          || hit.getAttribute("data-project-id")
          || null,
      kind:  hit.getAttribute("data-instance-id") ? "instance"
          : hit.getAttribute("data-gap-id")      ? "gap"
          : hit.getAttribute("data-driver-id")   ? "driver"
          : hit.getAttribute("data-project-id")  ? "project"
          : "entity",
      label: (hit.textContent || "").trim().slice(0, 60)
    };
    teardown();
    document.dispatchEvent(new CustomEvent("dell-canvas:entity-click", { detail: detail }));
  };

  function teardown() {
    document.removeEventListener("keydown", cancelOnEsc, true);
    document.removeEventListener("click", clickInterceptor, true);
    if (pill && pill.parentNode) pill.parentNode.removeChild(pill);
    setTransparent(false);
  }

  document.addEventListener("keydown", cancelOnEsc, true);
  document.addEventListener("click", clickInterceptor, true);
}

// v2.4.13 user-feedback polish . called when the entity-click event
// fires (or when a click on the underlying page picks an entity).
// Drops transparency, updates the status row, and is otherwise a no-op
// (caller decides whether to re-run a skill with the new context).
function exitPickMode(body, picked) {
  setTransparent(false);
  var status = body.querySelector(".ai-pick-status");
  if (!status) return;
  if (picked && (picked.label || picked.id)) {
    status.textContent = "Picked: " + (picked.label || picked.id);
    status.style.display = "";
    setTimeout(function() { if (status) status.style.display = "none"; }, 2000);
  } else {
    status.style.display = "none";
  }
}

function buildFooter() {
  var foot = document.createElement("div");
  foot.className = "ai-assist-footer";

  var spacer = document.createElement("div");
  spacer.className = "ai-assist-foot-spacer";
  foot.appendChild(spacer);

  var doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "btn-primary";
  doneBtn.textContent = "Done";
  doneBtn.addEventListener("click", function() {
    cleanup();
    closeOverlay();
  });
  foot.appendChild(doneBtn);
  return foot;
}

function injectScopeToggle() {
  var slot = document.querySelector(".overlay[data-kind='ai-assist'] .overlay-head-extras");
  if (!slot) return;
  slot.innerHTML = "";

  // Pick-from-page button. Engages transparency mode so the user can
  // click a tile / driver / gap on the page underneath. The picked
  // entity is stored in state.context.picked and the transparency
  // drops automatically.
  var pickBtn = document.createElement("button");
  pickBtn.type = "button";
  pickBtn.className = "ai-pick-btn";
  pickBtn.title = "Click an entity on the page to pass it to the next skill run";
  pickBtn.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 3l4.2 11 1.5-4.5 4.5-1.5L3 3z"/>' +
    '</svg> <span>Pick from page</span>';
  pickBtn.addEventListener("click", function() {
    var body = document.querySelector(".overlay[data-kind='ai-assist'] .overlay-body");
    if (!body) return;
    engagePickMode(body, "an entity");
  });
  slot.appendChild(pickBtn);

  // Segmented control with both options visible; one is highlighted as
  // active. Click the inactive option to switch. Removes the toggle-
  // ambiguity of the prior single-chip ("Did the label show the
  // current state or the action?").
  var seg = document.createElement("div");
  seg.className = "ai-scope-seg";

  var setScope = function(next) {
    state.scope = next;
    seg.querySelectorAll(".ai-scope-seg-btn").forEach(function(b) {
      b.classList.toggle("is-active", b.getAttribute("data-val") === next);
      b.setAttribute("aria-pressed", b.getAttribute("data-val") === next ? "true" : "false");
    });
    var body = document.querySelector(".overlay[data-kind='ai-assist'] .overlay-body");
    if (body) paintTiles(body);
  };

  var options = [
    { val: "current", label: "Current tab", title: "Show only skills for the active tab" },
    { val: "all",     label: "All tabs",    title: "Show every deployed skill in your library" }
  ];
  options.forEach(function(opt) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ai-scope-seg-btn" + (state.scope === opt.val ? " is-active" : "");
    btn.setAttribute("data-val", opt.val);
    btn.setAttribute("aria-pressed", state.scope === opt.val ? "true" : "false");
    btn.title = opt.title;
    btn.textContent = opt.label;
    btn.addEventListener("click", function() { setScope(opt.val); });
    seg.appendChild(btn);
  });

  slot.appendChild(seg);
}

function paintTiles(body) {
  var grid = body.querySelector(".ai-skill-list");
  if (!grid) return;
  var skills = state.scope === "current"
    ? skillsForTab(state.tabId, { onlyDeployed: true })
    : loadSkills().filter(function(s) { return s.deployed; });

  grid.innerHTML = "";
  if (skills.length === 0) {
    var empty = document.createElement("div");
    empty.className = "ai-skill-empty";
    empty.textContent = state.scope === "current"
      ? "No skills deployed for this tab. Open the gear icon . Skills to add one, or toggle the scope chip above to see all deployed skills."
      : "No skills deployed in your library yet. Open the gear icon . Skills to add one.";
    grid.appendChild(empty);
    return;
  }

  skills.forEach(function(s) {
    var tile = document.createElement("button");
    tile.type = "button";
    tile.className = "ai-skill-tile";
    tile.setAttribute("data-skill-id", s.id);

    var icon = document.createElement("div");
    icon.className = "ai-skill-tile-icon";
    icon.textContent = "✨";
    tile.appendChild(icon);

    var name = document.createElement("div");
    name.className = "ai-skill-tile-name";
    name.textContent = s.name;
    tile.appendChild(name);

    if (s.description) {
      var desc = document.createElement("div");
      desc.className = "ai-skill-tile-desc";
      desc.textContent = s.description;
      tile.appendChild(desc);
    }

    var meta = document.createElement("div");
    meta.className = "ai-skill-tile-meta";
    meta.textContent = (TAB_LABEL[s.tabId] || s.tabId) + " . " +
      (s.responseFormat === "json-scalars" ? "Field updates" : "Brief");
    tile.appendChild(meta);

    tile.addEventListener("click", function() { runTile(body, tile, s); });
    grid.appendChild(tile);
  });
}

async function runTile(body, tile, skill) {
  // Highlight the active tile.
  body.querySelectorAll(".ai-skill-tile.active").forEach(function(el) { el.classList.remove("active"); });
  tile.classList.add("active");

  var result = body.querySelector(".ai-skill-result-panel");
  if (!result) return;
  result.style.display = "block";
  result.className = "ai-skill-result-panel running";
  var providerLabel = skill.providerKey || loadAiConfig().activeProvider || "AI";
  result.textContent = "Running '" + skill.name + "' via " + providerLabel + "...";

  var res;
  try {
    res = await runSkillById(skill.id, session, state.context || {});
  } catch (e) {
    result.className = "ai-skill-result-panel err";
    result.textContent = "Failed: " + (e && e.message || String(e));
    return;
  }
  if (!res.ok) {
    result.className = "ai-skill-result-panel err";
    result.textContent = "Failed: " + (res.error || "Unknown error") +
      ". Open the gear icon . provider pill to verify your AI config.";
    return;
  }

  result.className = "ai-skill-result-panel ok";
  result.innerHTML = "";

  // text-brief result: show the text. json-scalars result: show
  // proposals + Apply / Reject buttons (per existing applyPolicy contract).
  if (res.responseFormat === "text-brief") {
    var pre = document.createElement("div");
    pre.className = "ai-skill-result-text";
    pre.textContent = res.text || "(no output)";
    result.appendChild(pre);
  } else if (res.responseFormat === "json-scalars" && Array.isArray(res.proposals)) {
    var summary = document.createElement("div");
    summary.className = "ai-skill-result-summary";
    summary.textContent = res.proposals.length + " field update" +
      (res.proposals.length === 1 ? "" : "s") + " proposed.";
    result.appendChild(summary);

    var list = document.createElement("ul");
    list.className = "ai-skill-result-proposals";
    res.proposals.forEach(function(p) {
      var li = document.createElement("li");
      li.textContent = (p.label || p.path) + " . " + JSON.stringify(p.value);
      list.appendChild(li);
    });
    result.appendChild(list);

    var actions = document.createElement("div");
    actions.className = "ai-skill-result-actions";
    var applyAllBtn = document.createElement("button");
    applyAllBtn.type = "button";
    applyAllBtn.className = "btn-primary";
    applyAllBtn.textContent = "Apply all";
    applyAllBtn.addEventListener("click", function() {
      try { applyAllProposals(res.proposals, { skillName: skill.name, context: state.context || {} }); }
      catch (e) { console.warn("[AI Assist] applyAll failed:", e); }
      summary.textContent = "Applied " + res.proposals.length + " update(s). Run another skill or click Done.";
      list.remove();
      actions.remove();
    });
    actions.appendChild(applyAllBtn);
    result.appendChild(actions);
  } else {
    var fallback = document.createElement("pre");
    fallback.className = "ai-skill-result-text";
    fallback.textContent = JSON.stringify(res, null, 2);
    result.appendChild(fallback);
  }
}

function cleanup() {
  if (state.unsubSkills) { try { state.unsubSkills(); } catch (e) {} state.unsubSkills = null; }
  if (state.pickListener) {
    document.removeEventListener("dell-canvas:entity-click", state.pickListener);
    state.pickListener = null;
  }
}

export { isOpen as isAiOverlayOpen };
