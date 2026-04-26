// ui/components/UseAiButton.js , Phase 19b / v2.4.1
//
// Compact "✨ Use AI ▾" button attached near a tab's header. Opens a
// dropdown listing the deployed skills for that tab. Clicking a skill
// runs it against session + tab-provided context and renders the
// result into a passed-in `resultTarget` DOM node. If no skills are
// deployed for the tab, renders nothing (returns an empty fragment).

import { skillsForTab, getSkill } from "../../core/skillStore.js";
import { runSkillById } from "../../interactions/skillCommands.js";
import { loadAiConfig } from "../../core/aiConfig.js";
import { applyProposal, applyAllProposals } from "../../interactions/aiCommands.js";
import { onSkillsChanged } from "../../core/skillsEvents.js";

export function useAiButton(tabId, opts) {
  opts = opts || {};
  var getContext  = typeof opts.getContext  === "function" ? opts.getContext  : function() { return {}; };
  var getSession  = typeof opts.getSession  === "function" ? opts.getSession  : function() { return {}; };
  var getResultEl = typeof opts.getResultEl === "function" ? opts.getResultEl : function() { return null; };

  // v2.4.12 · PR2 · always create the wrap (even on zero skills) so that
  // a later add/deploy can auto-fill it via the skills-changed bus
  // without the parent having to re-call useAiButton(...).
  var wrap = mk("span", "use-ai-wrap");
  var btn  = mkt("button", "use-ai-btn", "✨ Use AI ▾");
  btn.type = "button";
  btn.title = "Run one of your AI skills for this tab";
  wrap.appendChild(btn);

  var menu = mk("div", "use-ai-menu");
  menu.style.display = "none";

  function paintMenu() {
    var skills = skillsForTab(tabId, { onlyDeployed: true });
    menu.innerHTML = "";
    // Hide the whole component when no skills are deployed for this tab.
    // Show it again the moment one is.
    wrap.style.display = (skills.length === 0) ? "none" : "";
    skills.forEach(function(s) {
      var item = mk("button", "use-ai-menu-item");
      item.type = "button";
      item.appendChild(mkt("div", "use-ai-menu-name", s.name));
      if (s.description) item.appendChild(mkt("div", "use-ai-menu-desc", s.description));
      item.addEventListener("click", async function() {
      menu.style.display = "none";
      var resultEl = getResultEl();
      if (!resultEl) return;
      resultEl.style.display = "block";
      resultEl.className = "ai-skill-result running";
      // Provider label: skill override > active default.
      var skillRow = getSkill(s.id) || {};
      var providerLabel = skillRow.providerKey || loadAiConfig().activeProvider || "AI";
      resultEl.textContent = "Running '" + s.name + "' via " + providerLabel + "…";
      var res = await runSkillById(s.id, getSession(), getContext());
      resultEl.innerHTML = "";
      if (!res.ok) {
        resultEl.className = "ai-skill-result err";
        resultEl.textContent = "Failed: " + (res.error || "Unknown error") +
          ". Open the gear icon → provider pill to verify the AI config.";
        return;
      }
      // v2.4.4 · applyPolicy-aware rendering (SPEC §12.1 / §12.7).
      //   show-only         → render text / proposals as read-only
      //   confirm-per-field → Apply/Skip per row (default for json-scalars)
      //   confirm-all       → single "Apply all" button, no per-row
      //   auto              → apply immediately, then show the result state
      var policy = res.applyPolicy || "show-only";
      if (Array.isArray(res.proposals) && res.proposals.length > 0) {
        if (policy === "auto") {
          try {
            applyAllProposals(res.proposals, {
              label:   "AI: " + s.name + " → auto-apply (" + res.proposals.length + ")",
              context: getContext()
            });
            resultEl.className = "ai-skill-result ok has-proposals";
            resultEl.appendChild(mkt("div", "proposals-head",
              s.name + " · " + res.providerKey + " · auto-applied " + res.proposals.length + " change" + (res.proposals.length === 1 ? "" : "s")));
            resultEl.appendChild(mkt("div", "settings-help-inline",
              "Use ↶ Undo in the header if this was wrong."));
          } catch (e) {
            resultEl.className = "ai-skill-result err";
            resultEl.textContent = "Auto-apply failed: " + (e.message || String(e));
          }
          return;
        }
        resultEl.className = "ai-skill-result ok has-proposals";
        resultEl.appendChild(renderProposalsPanel(s, res, policy, getContext));
        return;
      }
      if (res.proposalsError) {
        // json-schema mode but AI returned unparseable JSON. Show the raw
        // text + the parser error so the user can see what came back.
        resultEl.className = "ai-skill-result err";
        resultEl.appendChild(mkt("div", "ai-skill-result-head",
          s.name + " · " + res.providerKey + " · JSON parse failed"));
        resultEl.appendChild(mkt("div", "proposals-error",
          "Parser: " + res.proposalsError));
        var raw = mk("pre", "ai-skill-result-body");
        raw.textContent = res.text || "(no text returned)";
        resultEl.appendChild(raw);
        return;
      }
      resultEl.className = "ai-skill-result ok";
      var head = mkt("div", "ai-skill-result-head", s.name + " · " + res.providerKey);
      resultEl.appendChild(head);
      var body = mk("pre", "ai-skill-result-body");
      body.textContent = res.text || "(no text returned)";
      resultEl.appendChild(body);
    });
    menu.appendChild(item);
    });   // skills.forEach
  }       // paintMenu
  paintMenu();
  wrap.appendChild(menu);

  // v2.4.12 · PR2 · auto-refresh the dropdown when the skill registry
  // changes (Skill Builder add / update / deploy / undeploy / delete).
  // Self-cleanup: once the wrap is detached from the DOM (tab switch
  // re-renders the toolbar), the listener unsubscribes on the next
  // event so we don't leak listeners across tab switches.
  var off = onSkillsChanged(function() {
    if (!wrap.isConnected) { off(); return; }
    paintMenu();
  });

  btn.addEventListener("click", function(e) {
    e.stopPropagation();
    menu.style.display = menu.style.display === "none" ? "block" : "none";
  });
  document.addEventListener("click", function(e) {
    if (!wrap.contains(e.target)) menu.style.display = "none";
  });

  return wrap;
}

// v2.4.4 · proposals panel , applyPolicy-aware rendering.
//   show-only         → read-only rows, no buttons
//   confirm-per-field → Apply/Skip per row (default) + Apply all footer
//   confirm-all       → per-row read-only, only Apply-all footer
function renderProposalsPanel(skill, runResult, policy, getContext) {
  var panel = mk("div", "proposals-panel");
  panel.appendChild(mkt("div", "proposals-head",
    skill.name + " · " + runResult.providerKey + " · " +
    runResult.proposals.length + " proposed update" +
    (runResult.proposals.length === 1 ? "" : "s") +
    " · policy: " + policy));

  var list = mk("div", "proposals-list");
  var remaining = runResult.proposals.slice();
  var showPerRowButtons = (policy === "confirm-per-field");

  function rerender() {
    list.innerHTML = "";
    if (remaining.length === 0) {
      list.appendChild(mkt("div", "proposals-empty",
        "All proposals processed. Use ↶ Undo in the header to roll back if needed."));
      return;
    }
    remaining.forEach(function(p) {
      var row = mk("div", "proposal-row" + (showPerRowButtons ? "" : " no-actions"));
      row.appendChild(mkt("div", "proposal-path", p.label + " · " + p.path));
      var diff = mk("div", "proposal-diff");
      diff.appendChild(mkt("span", "proposal-before", formatValue(p.before)));
      diff.appendChild(mkt("span", "proposal-arrow", "→"));
      diff.appendChild(mkt("span", "proposal-after", formatValue(p.after)));
      row.appendChild(diff);
      if (showPerRowButtons) {
        var actions = mk("div", "proposal-actions");
        var skipBtn  = mkt("button", "btn-outline", "Skip");
        skipBtn.addEventListener("click", function() {
          remaining.splice(remaining.indexOf(p), 1);
          rerender();
        });
        var applyBtn = mkt("button", "btn-primary", "Apply");
        applyBtn.addEventListener("click", function() {
          try {
            applyProposal(p, {
              label:   "AI: " + skill.name + " → " + p.label,
              context: getContext ? getContext() : {}
            });
            remaining.splice(remaining.indexOf(p), 1);
            rerender();
          } catch (e) { alert("Apply failed: " + (e.message || String(e))); }
        });
        actions.appendChild(skipBtn);
        actions.appendChild(applyBtn);
        row.appendChild(actions);
      }
      list.appendChild(row);
    });
  }
  rerender();
  panel.appendChild(list);

  // Footer: Apply-all unless policy === "show-only"
  if (policy !== "show-only") {
    var foot = mk("div", "proposals-foot");
    var applyAll = mkt("button", "btn-primary", "Apply all");
    applyAll.addEventListener("click", function() {
      if (remaining.length === 0) return;
      try {
        applyAllProposals(remaining, {
          label:   "AI: " + skill.name + " → apply all (" + remaining.length + ")",
          context: getContext ? getContext() : {}
        });
        remaining.length = 0;
        rerender();
      } catch (e) { alert("Apply-all failed: " + (e.message || String(e))); }
    });
    foot.appendChild(applyAll);
    panel.appendChild(foot);
  }
  return panel;
}

function formatValue(v) {
  if (v === undefined || v === null) return ",";
  if (typeof v === "string") return v.length > 80 ? v.slice(0, 80) + "…" : v;
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

function mk(tag, cls)        { var el = document.createElement(tag); if (cls) el.className = cls; return el; }
function mkt(tag, cls, txt)  { var el = mk(tag, cls); if (txt != null) el.textContent = txt; return el; }
