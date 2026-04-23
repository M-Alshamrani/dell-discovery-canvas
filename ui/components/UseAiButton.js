// ui/components/UseAiButton.js — Phase 19b / v2.4.1
//
// Compact "✨ Use AI ▾" button attached near a tab's header. Opens a
// dropdown listing the deployed skills for that tab. Clicking a skill
// runs it against session + tab-provided context and renders the
// result into a passed-in `resultTarget` DOM node. If no skills are
// deployed for the tab, renders nothing (returns an empty fragment).

import { skillsForTab } from "../../core/skillStore.js";
import { runSkillById } from "../../interactions/skillCommands.js";
import { loadAiConfig } from "../../core/aiConfig.js";

export function useAiButton(tabId, opts) {
  opts = opts || {};
  var getContext  = typeof opts.getContext  === "function" ? opts.getContext  : function() { return {}; };
  var getSession  = typeof opts.getSession  === "function" ? opts.getSession  : function() { return {}; };
  var getResultEl = typeof opts.getResultEl === "function" ? opts.getResultEl : function() { return null; };

  var skills = skillsForTab(tabId, { onlyDeployed: true });
  if (skills.length === 0) {
    var span = document.createElement("span");
    span.className = "use-ai-empty";
    span.style.display = "none"; // truly empty — no chrome
    return span;
  }

  var wrap = mk("span", "use-ai-wrap");
  var btn  = mkt("button", "use-ai-btn", "✨ Use AI ▾");
  btn.type = "button";
  btn.title = "Run one of your AI skills for this tab";
  wrap.appendChild(btn);

  var menu = mk("div", "use-ai-menu");
  menu.style.display = "none";
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
      resultEl.textContent = "Running '" + s.name + "' via " + (loadAiConfig().activeProvider || "AI") + "…";
      var res = await runSkillById(s.id, getSession(), getContext());
      resultEl.innerHTML = "";
      if (res.ok) {
        resultEl.className = "ai-skill-result ok";
        var head = mkt("div", "ai-skill-result-head", s.name + " · " + res.providerKey);
        resultEl.appendChild(head);
        var body = mk("pre", "ai-skill-result-body");
        body.textContent = res.text || "(no text returned)";
        resultEl.appendChild(body);
      } else {
        resultEl.className = "ai-skill-result err";
        resultEl.textContent = "Failed: " + (res.error || "Unknown error") +
          ". Open the gear icon → provider pill to verify the AI config.";
      }
    });
    menu.appendChild(item);
  });
  wrap.appendChild(menu);

  btn.addEventListener("click", function(e) {
    e.stopPropagation();
    menu.style.display = menu.style.display === "none" ? "block" : "none";
  });
  document.addEventListener("click", function(e) {
    if (!wrap.contains(e.target)) menu.style.display = "none";
  });

  return wrap;
}

function mk(tag, cls)        { var el = document.createElement(tag); if (cls) el.className = cls; return el; }
function mkt(tag, cls, txt)  { var el = mk(tag, cls); if (txt != null) el.textContent = txt; return el; }
