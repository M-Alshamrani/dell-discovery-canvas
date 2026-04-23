// ui/views/SkillAdmin.js — Phase 19b / v2.4.1
//
// Skills admin surface inside the settings modal. Lists saved skills
// with deploy toggles, inline edit form, and a "+ Add skill" path.
// Called by SettingsModal when the user clicks the "Skills" pill.

import {
  loadSkills, addSkill, updateSkill, deleteSkill,
  SKILL_TABS, OUTPUT_MODES
} from "../../core/skillStore.js";
import { extractBindings, renderTemplate, runSkill } from "../../services/skillEngine.js";
import { fieldsForTab, buildPreviewScope } from "../../core/fieldManifest.js";
import { session as liveSession } from "../../state/sessionStore.js";
import { loadAiConfig } from "../../core/aiConfig.js";
import { createPillEditor } from "../components/PillEditor.js";

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

  // v2.4.2.1 · pill-based contenteditable editor replaces the textarea.
  // Exposes serialize() / setValue() / insertPillAtCursor() so the
  // rest of the form code doesn't care about the DOM shape.
  var tplLabelGroup = mk("div", "skill-form-field");
  tplLabelGroup.appendChild(mkt("label", "skill-form-label", "Data for the AI *"));
  tplLabelGroup.appendChild(mkt("div", "settings-help-inline",
    "Sent to the AI on every run. Click any field chip below to insert a pill; the pill is uneditable as a unit (Backspace removes it whole). Alt-click a chip for a bare-path pill."));
  form.appendChild(tplLabelGroup);
  var tplArea = createPillEditor({
    initialValue: existing ? existing.promptTemplate : "",
    manifest:     fieldsForTab(existing ? existing.tabId : "context"),
    onInput:      function() { refreshBindingsAndPreview(); }
  });
  tplLabelGroup.appendChild(tplArea);

  // Phase 19c · field-pointer chips — click to insert {{path}} at the
  // textarea cursor. Chips refresh whenever the target tab changes.
  var chipsLabel = mkt("div", "skill-form-label", "Bindable fields — click to insert");
  form.appendChild(chipsLabel);
  var chipsWrap = mk("div", "field-chip-list");
  form.appendChild(chipsWrap);

  function refreshChips() {
    chipsWrap.innerHTML = "";
    var fields = fieldsForTab(tabSel.value);
    if (fields.length === 0) {
      chipsWrap.appendChild(mkt("div", "settings-help-inline",
        "No bindable fields declared for this tab yet."));
      return;
    }
    fields.forEach(function(f) {
      var chip = mkt("button", "field-chip" + (f.kind === "array" ? " is-array" : ""), f.label);
      chip.type = "button";
      chip.title = "Click: insert labeled pill for " + f.label + ". Alt-click: insert bare {{" + f.path + "}} pill.";
      chip.addEventListener("click", function(e) {
        e.preventDefault();
        tplArea.insertPillAtCursor(f.path, e.altKey);
      });
      chip.setAttribute("data-path", f.path);
      chipsWrap.appendChild(chip);
    });
  }
  refreshChips();
  // On tab change: only refresh the chip palette + preview. DO NOT
  // re-create the editor — pills carry their own label metadata via
  // data-label attrs; re-parsing against a different tab's manifest
  // would strand the label prefix as plain text when the new tab
  // doesn't know the path. Existing pills persist correctly through
  // target-tab edits.
  tabSel.addEventListener("change", function() {
    refreshChips();
    refreshBindingsAndPreview();
  });

  // Detected-bindings readout (kept from v2.4.1).
  var bindingsEl = mkt("div", "skill-form-bindings", "");
  form.appendChild(bindingsEl);

  // Live preview of the rendered template against current session +
  // first-item fallback context. Read-only; updates on every keystroke.
  var previewLabel = mkt("div", "skill-form-label", "Preview with current session data");
  form.appendChild(previewLabel);
  var previewBox = mk("pre", "template-preview");
  form.appendChild(previewBox);

  function refreshBindingsAndPreview() {
    var serialized = tplArea.serialize();
    var found = extractBindings(serialized);
    if (found.length === 0) {
      bindingsEl.textContent = "No {{template.bindings}} detected.";
    } else {
      bindingsEl.textContent = "Detected bindings: " + found.map(function(b) { return "{{" + b + "}}"; }).join(", ");
    }
    var scope = buildPreviewScope(liveSession, tabSel.value);
    var rendered = renderTemplate(serialized, scope);
    previewBox.textContent = rendered || "(empty — write a template above, or click a field chip to insert)";
  }
  // onInput callback already wired in createPillEditor; prime the display.
  refreshBindingsAndPreview();

  // Phase 19c v2 · "Test skill now" — dry-runs the current unsaved draft
  // against real AI + live preview scope so the user can iterate on
  // prompts without save-and-switch-tab round-trips.
  var testRow = mk("div", "skill-form-test-row");
  var testBtn = mkt("button", "btn-secondary", "Test skill now");
  var testOut = mk("div", "ai-skill-result skill-form-test-out");
  testOut.style.display = "none";
  testRow.appendChild(testBtn);
  form.appendChild(testRow);
  form.appendChild(testOut);
  testBtn.addEventListener("click", async function() {
    var draftSkill = {
      name:           (nameInput.value || "Untitled").trim(),
      tabId:          tabSel.value,
      systemPrompt:   sysArea.value,
      promptTemplate: tplArea.serialize(),
      outputMode:     modeSel.value
    };
    testBtn.disabled = true;
    var originalLabel = testBtn.textContent;
    testBtn.textContent = "Testing…";
    testOut.style.display = "block";
    testOut.className = "ai-skill-result skill-form-test-out running";
    testOut.textContent = "Running with current session + " + (loadAiConfig().activeProvider || "AI") + "…";
    var scope = buildPreviewScope(liveSession, tabSel.value);
    var res = await runSkill(draftSkill, scope.session, scope.context);
    testBtn.disabled = false;
    testBtn.textContent = originalLabel;
    testOut.innerHTML = "";
    if (res.ok) {
      testOut.className = "ai-skill-result skill-form-test-out ok";
      testOut.appendChild(mkt("div", "ai-skill-result-head",
        "Test output · " + res.providerKey + " (draft — not saved)"));
      var body = mk("pre", "ai-skill-result-body");
      body.textContent = res.text || "(no text returned)";
      testOut.appendChild(body);
    } else {
      testOut.className = "ai-skill-result skill-form-test-out err";
      testOut.textContent = "Test failed: " + (res.error || "Unknown error") +
        ". Check AI Providers settings.";
    }
  });

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
    var tpl  = tplArea.serialize().trim();
    if (!name) { alert("Name is required."); return; }
    if (!tpl)  { alert("Data for the AI is required — click a field chip or type text."); return; }
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
