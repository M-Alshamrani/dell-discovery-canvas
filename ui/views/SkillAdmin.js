// ui/views/SkillAdmin.js — Phase 19b / v2.4.1
//
// Skills admin surface inside the settings modal. Lists saved skills
// with deploy toggles, inline edit form, and a "+ Add skill" path.
// Called by SettingsModal when the user clicks the "Skills" pill.

import {
  loadSkills, addSkill, updateSkill, deleteSkill,
  SKILL_TABS, OUTPUT_MODES
} from "../../core/skillStore.js";
import { extractBindings } from "../../services/skillEngine.js";

var TAB_LABELS = {
  context:   "Context",
  current:   "Current State",
  desired:   "Desired State",
  gaps:      "Gaps",
  reporting: "Reporting"
};

// Render the admin surface into `container` (the settings modal body).
// Returns the root element. `onChange` fires after any CRUD op so the
// outer modal can refresh auxiliary displays if needed.
export function renderSkillAdmin(container, onChange) {
  container.innerHTML = "";
  var root = mk("div", "skill-admin");

  var header = mk("div", "skill-admin-header");
  var title = mkt("div", "skill-admin-title", "Skills");
  var addBtn = mkt("button", "btn-primary", "+ Add skill");
  addBtn.addEventListener("click", function() {
    renderEditForm(root, list, null /* new skill */, onChange);
  });
  header.appendChild(title);
  header.appendChild(addBtn);
  root.appendChild(header);

  root.appendChild(mkt("div", "settings-help",
    "Skills run against the active AI provider. Each skill is bound to one tab; " +
    "users trigger it via the '✨ Use AI' button in that tab. Reference live data " +
    "with {{session.path}} (whole session) and {{context.path}} (current tab selection). " +
    "v2.4.2 will let you click a field in the live tab to insert the binding automatically."));

  var list = mk("div", "skill-admin-list");
  renderList(list, onChange);
  root.appendChild(list);

  container.appendChild(root);
  return root;
}

function renderList(list, onChange) {
  list.innerHTML = "";
  var skills = loadSkills();
  if (skills.length === 0) {
    list.appendChild(mkt("div", "skill-admin-empty",
      "No skills yet. Click '+ Add skill' to create one."));
    return;
  }
  skills.forEach(function(s) {
    list.appendChild(renderRow(s, list, onChange));
  });
}

function renderRow(skill, list, onChange) {
  var row = mk("div", "skill-row" + (skill.deployed ? " deployed" : ""));

  var nameCol = mk("div", "skill-row-name-col");
  nameCol.appendChild(mkt("div", "skill-row-name", skill.name));
  if (skill.description) nameCol.appendChild(mkt("div", "skill-row-desc", skill.description));
  var meta = mk("div", "skill-row-meta");
  meta.appendChild(mkt("span", "skill-row-tab", TAB_LABELS[skill.tabId] || skill.tabId));
  meta.appendChild(mkt("span", "skill-row-mode", skill.outputMode));
  if (skill.seed) meta.appendChild(mkt("span", "skill-row-seed", "seed"));
  nameCol.appendChild(meta);
  row.appendChild(nameCol);

  var actions = mk("div", "skill-row-actions");

  var deployLabel = mkt("label", "skill-row-deploy", "Deployed");
  var deployCb = document.createElement("input");
  deployCb.type = "checkbox";
  deployCb.checked = !!skill.deployed;
  deployCb.addEventListener("change", function() {
    updateSkill(skill.id, { deployed: deployCb.checked });
    renderList(list, onChange);
    if (onChange) onChange();
  });
  deployLabel.prepend(deployCb);
  actions.appendChild(deployLabel);

  var editBtn = mkt("button", "btn-outline", "Edit");
  editBtn.addEventListener("click", function() {
    var adminRoot = list.parentElement;
    if (adminRoot) renderEditForm(adminRoot, list, skill, onChange);
  });
  actions.appendChild(editBtn);

  var delBtn = mkt("button", "btn-danger", "Delete");
  delBtn.addEventListener("click", function() {
    if (!confirm("Delete skill '" + skill.name + "'? This cannot be undone.")) return;
    deleteSkill(skill.id);
    renderList(list, onChange);
    if (onChange) onChange();
  });
  actions.appendChild(delBtn);

  row.appendChild(actions);
  return row;
}

function renderEditForm(adminRoot, list, existing, onChange) {
  // Remove any previously-open form (only one open at a time).
  var old = adminRoot.querySelector(".skill-form");
  if (old) old.remove();

  var form = mk("div", "skill-form");
  form.appendChild(mkt("div", "skill-form-title",
    existing ? "Edit skill" : "Add skill"));

  var nameInput   = mkField(form, "Name *", "text",
    existing ? existing.name : "");
  var descInput   = mkField(form, "Description", "text",
    existing ? existing.description : "",
    "One-line summary shown to the presales");

  var tabSel = mkSelect(form, "Target tab *", SKILL_TABS.map(function(t) {
    return { value: t, label: TAB_LABELS[t] || t };
  }), existing ? existing.tabId : "context");

  var sysArea = mkTextarea(form, "AI role / instructions (optional)", 3,
    existing ? existing.systemPrompt : "",
    "What the AI is and what it should do. Constant per skill — no live-data bindings needed.");

  var tplArea = mkTextarea(form, "Data for the AI *", 7,
    existing ? existing.promptTemplate : "",
    "Sent to the AI on every run. Use {{session.customer.name}}, {{context.selectedDriver.label}} etc. to pull live values. Missing paths render as empty strings.");

  var bindingsEl = mkt("div", "skill-form-bindings", "");
  form.appendChild(bindingsEl);
  function refreshBindings() {
    var found = extractBindings(tplArea.value);
    if (found.length === 0) {
      bindingsEl.textContent = "No {{template.bindings}} detected.";
    } else {
      bindingsEl.textContent = "Detected bindings: " + found.map(function(b) { return "{{" + b + "}}"; }).join(", ");
    }
  }
  tplArea.addEventListener("input", refreshBindings);
  refreshBindings();

  var modeSel = mkSelect(form, "Output mode", OUTPUT_MODES.map(function(m) {
    var label = m === "suggest"          ? "Suggest (show response)"
             :  m === "apply-on-confirm" ? "Apply on confirm (v2.4.3)"
             :                             "Auto-apply (v2.4.3)";
    return { value: m, label: label };
  }), existing ? existing.outputMode : "suggest");

  var depLabel = mkt("label", "skill-form-deploy-label", "Deployed");
  var depCb = document.createElement("input");
  depCb.type = "checkbox";
  depCb.checked = existing ? existing.deployed !== false : true;
  depLabel.prepend(depCb);
  form.appendChild(depLabel);

  var actions = mk("div", "form-actions");
  var cancelBtn = mkt("button", "btn-secondary", "Cancel");
  cancelBtn.addEventListener("click", function() { form.remove(); });
  var saveBtn = mkt("button", "btn-primary", existing ? "Save changes" : "Create skill");
  saveBtn.addEventListener("click", function() {
    var name = (nameInput.value || "").trim();
    var tpl  = (tplArea.value   || "").trim();
    if (!name) { alert("Name is required."); return; }
    if (!tpl)  { alert("Prompt template is required."); return; }
    var props = {
      name:           name,
      description:    (descInput.value || "").trim(),
      tabId:          tabSel.value,
      systemPrompt:   sysArea.value,
      promptTemplate: tpl,
      outputMode:     modeSel.value,
      deployed:       depCb.checked
    };
    try {
      if (existing) updateSkill(existing.id, props);
      else          addSkill(props);
      form.remove();
      renderList(list, onChange);
      if (onChange) onChange();
    } catch (e) { alert("Save failed: " + e.message); }
  });
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  form.appendChild(actions);

  adminRoot.appendChild(form);
  nameInput.focus();
}

// ── Tiny form helpers. Duplicated (not imported) so SkillAdmin has
//    no cross-file coupling to app.js-level DOM shorthands.
function mk(tag, cls)        { var el = document.createElement(tag); if (cls) el.className = cls; return el; }
function mkt(tag, cls, txt)  { var el = mk(tag, cls); if (txt != null) el.textContent = txt; return el; }

function mkField(parent, label, type, value, hint) {
  var group = mk("div", "skill-form-field");
  group.appendChild(mkt("label", "skill-form-label", label));
  if (hint) group.appendChild(mkt("div", "settings-help-inline", hint));
  var input = mk("input", "settings-input");
  input.type = type;
  input.value = value || "";
  group.appendChild(input);
  parent.appendChild(group);
  return input;
}

function mkTextarea(parent, label, rows, value, hint) {
  var group = mk("div", "skill-form-field");
  group.appendChild(mkt("label", "skill-form-label", label));
  if (hint) group.appendChild(mkt("div", "settings-help-inline", hint));
  var ta = mk("textarea", "settings-input skill-form-textarea");
  ta.rows = rows || 4;
  ta.value = value || "";
  group.appendChild(ta);
  parent.appendChild(group);
  return ta;
}

function mkSelect(parent, label, options, value) {
  var group = mk("div", "skill-form-field");
  group.appendChild(mkt("label", "skill-form-label", label));
  var sel = mk("select", "settings-input");
  options.forEach(function(o) {
    var opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.value === value) opt.selected = true;
    sel.appendChild(opt);
  });
  group.appendChild(sel);
  parent.appendChild(group);
  return sel;
}
