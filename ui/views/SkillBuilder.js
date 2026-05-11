// ui/views/SkillBuilder.js — rc.8.b / R3 (SPEC §S46 + RULES §16 CH36)
//
// Skills Builder authoring surface — Settings → Skills section.
// Clean rewrite per user direction 2026-05-10:
//   "(a) replace clean — don't have any production skills today to migrate"
//
// Replaces the legacy v3.1 SkillBuilder shape (pill editor + chip palette
// + Refine-to-CARE diff modal + outputTarget radio) with the rc.8.b form
// shape locked in SPEC §S46.3:
//
//   1. Label                  [data-skill-label]            <input text>
//   2. Description             [data-skill-description]     <input text>
//   3. Seed prompt             [data-skill-seed]            <textarea>
//   4. Data points             [data-skill-data-points]     selector + toggle
//      Standard/Advanced toggle [data-skill-data-toggle]    pill
//   5. Improved prompt         [data-skill-improved]        <textarea readonly>
//      Improve button         [data-skill-improve]          <button>
//      Edit / Re-improve      [data-skill-improve-edit] /  buttons
//                             [data-skill-improve-redo]
//   6. Parameters[]            rows of {name, type, desc, required, accepts}
//   7. Output format           [data-skill-output-format]   4 radios
//                             (text / dimensional / json-array / scalar)
//   8. Mutation policy         [data-skill-mutation-policy] 2 radios
//                             (ask / auto-tag) — visible iff
//                             outputFormat ∈ {json-array, scalar}
//
// Test + Save buttons at the bottom.
//   - Test = stub at R3 (full wiring at R6 per user direction)
//   - Save = best-effort; v3SkillStore will reject until R4 lands the
//     schema extension. No production skills exist today, so failure
//     here doesn't affect any user.
//
// Improve = real LLM call via services/aiService.js chatCompletion (per
// SPEC §S46.5 + CH36.b + feedback_no_mocks.md). On failure: inline error
// chip + Retry button. NEVER mock.
//
// Authority: docs/v3.0/SPEC.md §S46 · docs/RULES.md §16 CH36.

import {
  saveV3Skill, loadV3Skills, loadV3SkillById, deleteV3Skill
}                                          from "../../state/v3SkillStore.js";
import { generateManifest }                from "../../services/manifestGenerator.js";
import { loadAiConfig }                    from "../../core/aiConfig.js";
import { chatCompletion }                  from "../../services/aiService.js";
import {
  getStandardMutableDataPoints,
  getAllMutableDataPoints
}                                          from "../../core/dataContract.js";
import { resolveTemplate }                 from "../../services/pathResolver.js";
import { getActiveEngagement }             from "../../state/engagementStore.js";

// SPEC §S46.6 + CH36.d — output format enum locked
const OUTPUT_FORMATS = [
  { id: "text",        label: "Text reporting",           hint: "Free-form prose into a chat bubble." },
  { id: "dimensional", label: "Dimensional report",       hint: "Rows × columns into a heatmap / matrix (renderer stub at MVP)." },
  { id: "json-array",  label: "JSON-array mutation",      hint: "List of changes the engagement applies." },
  { id: "scalar",      label: "Scalar mutation",          hint: "Single-value mutation of one data point." }
];

// SPEC §S46.10 + CH36.e — mutation policy enum locked
const MUTATION_POLICIES = [
  { id: "ask",      label: "Always ask before mutate", hint: "Approval modal lists every change before commit." },
  { id: "auto-tag", label: "Mutate directly + tag as AI", hint: "Apply immediately + 'Done by AI' badge for review." }
];

// SPEC §S46.3 + §S46.8 — parameter types (file type added per CH36.j)
const PARAMETER_TYPES = [
  { id: "string",   label: "string" },
  { id: "number",   label: "number" },
  { id: "boolean",  label: "boolean" },
  { id: "entityId", label: "entityId (gap / driver / instance / environment)" },
  { id: "file",     label: "file (uploaded at run-time)" }
];

// ─── Public entry ────────────────────────────────────────────────────

export function renderSkillBuilder(container, onChange) {
  container.innerHTML = "";
  var root = mk("div", "skill-admin");

  var header = mk("div", "skill-admin-header");
  var title  = mkt("div", "skill-admin-title", "Skills builder");
  var addBtn = mkt("button", "btn-primary", "+ New skill");
  addBtn.addEventListener("click", function() {
    renderEditForm(root, list, null /* new skill */, onChange);
  });
  header.appendChild(title);
  header.appendChild(addBtn);
  root.appendChild(header);

  root.appendChild(mkt("div", "settings-help",
    "Author skills as Seed prompt + Data points; click Improve to fold them " +
    "into a CARE-structured prompt via the active LLM. Pick output format + " +
    "mutation policy. Save here; users run skills from Canvas Chat → Skills tab."));

  var list = mk("div", "skill-admin-list");
  renderList(list, onChange);
  root.appendChild(list);

  container.appendChild(root);

  // SPEC §S46.3 — auto-mount a new-skill draft form so the authoring
  // surface is visible on first open (zero-state shows what authoring
  // looks like; tests can find data-* attributes immediately).
  renderEditForm(root, list, null, onChange);
}

// ─── List rendering ─────────────────────────────────────────────────

function renderList(list, onChange) {
  list.innerHTML = "";
  // loadV3Skills() returns an object map { skillId: skill }, not an array.
  // Convert to array for iteration.
  var skills = [];
  try { skills = Object.values(loadV3Skills() || {}); } catch (_e) { skills = []; }
  if (skills.length === 0) {
    list.appendChild(mkt("div", "settings-help-inline",
      "No skills yet — author your first below, then click Save."));
    return;
  }
  list.appendChild(mkt("div", "skill-admin-list-head", "Saved skills (" + skills.length + ")"));
  skills.forEach(function(s) {
    list.appendChild(renderRow(s, list, onChange));
  });
}

function renderRow(skill, list, onChange) {
  var row = mk("div", "skill-admin-row");
  var info = mk("div", "skill-admin-row-info");
  info.appendChild(mkt("div", "skill-admin-row-label", skill.label || skill.skillId));
  if (skill.description) info.appendChild(mkt("div", "skill-admin-row-desc", skill.description));
  var meta = mk("div", "skill-admin-row-meta");
  if (skill.outputFormat) meta.appendChild(mkt("span", "tag", skill.outputFormat));
  if (skill.mutationPolicy) meta.appendChild(mkt("span", "tag", "policy: " + skill.mutationPolicy));
  if (Array.isArray(skill.parameters) && skill.parameters.length > 0) {
    meta.appendChild(mkt("span", "tag", skill.parameters.length + " param(s)"));
  }
  info.appendChild(meta);

  var actions = mk("div", "skill-admin-row-actions");
  var editBtn = mkt("button", "btn-secondary", "Edit");
  editBtn.addEventListener("click", function() {
    var fresh = loadV3SkillById(skill.skillId) || skill;
    var adminRoot = list.parentElement;
    if (adminRoot) renderEditForm(adminRoot, list, fresh, onChange);
  });
  var delBtn = mkt("button", "btn-danger", "Delete");
  delBtn.addEventListener("click", function() {
    if (!confirm("Delete skill '" + (skill.label || skill.skillId) + "'? This cannot be undone.")) return;
    try { deleteV3Skill(skill.skillId); } catch (_e) {}
    renderList(list, onChange);
    if (onChange) onChange();
  });
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

// ─── Edit form ──────────────────────────────────────────────────────

function renderEditForm(adminRoot, list, existing, onChange) {
  var old = adminRoot.querySelector(".skill-form");
  if (old) old.remove();

  var form = mk("div", "skill-form");
  form.appendChild(mkt("div", "skill-form-title",
    existing ? ("Edit skill: " + (existing.label || existing.skillId)) : "Author new skill"));

  // ─── Field 1 · Label ────────────────────────────────────────────
  var labelGroup = mk("div", "skill-form-field");
  labelGroup.appendChild(mkt("label", "skill-form-label", "Label *"));
  labelGroup.appendChild(mkt("div", "settings-help-inline",
    "Short user-visible name shown in the Skills launcher tab."));
  var labelInput = mk("input", "settings-input");
  labelInput.type = "text";
  labelInput.value = existing && existing.label ? existing.label : "";
  labelInput.placeholder = "e.g. Trace environment to drivers";
  labelInput.setAttribute("data-skill-label", "");
  labelGroup.appendChild(labelInput);
  form.appendChild(labelGroup);

  // ─── Field 2 · Description ──────────────────────────────────────
  var descGroup = mk("div", "skill-form-field");
  descGroup.appendChild(mkt("label", "skill-form-label", "Description *"));
  descGroup.appendChild(mkt("div", "settings-help-inline",
    "One-line summary shown in the launcher's description-confirm before run."));
  var descInput = mk("input", "settings-input");
  descInput.type = "text";
  descInput.value = existing && existing.description ? existing.description : "";
  descInput.placeholder = "e.g. For one environment, trace each instance back to its strategic driver via gaps.";
  descInput.setAttribute("data-skill-description", "");
  descGroup.appendChild(descInput);
  form.appendChild(descGroup);

  // ─── Field 3 · Seed prompt ──────────────────────────────────────
  var seedGroup = mk("div", "skill-form-field");
  seedGroup.appendChild(mkt("label", "skill-form-label", "Seed prompt *"));
  seedGroup.appendChild(mkt("div", "settings-help-inline",
    "Your raw idea in plain English. The Improve button folds this with " +
    "the selected data points into a CARE-structured Anthropic-XML prompt."));
  var seedArea = mk("textarea", "settings-input skills-builder-textarea");
  seedArea.rows = 4;
  seedArea.value = existing && existing.seedPrompt ? existing.seedPrompt : "";
  seedArea.placeholder = "e.g. Summarize the gaps under cyber resilience as 3-5 exec bullets ordered by urgency.";
  seedArea.setAttribute("data-skill-seed", "");
  seedGroup.appendChild(seedArea);
  form.appendChild(seedGroup);

  // ─── Field 4 · Data points ──────────────────────────────────────
  // Selector with Standard/Advanced toggle. Author multi-selects which
  // schema paths the skill consumes; Improve folds these descriptions
  // into the meta-skill's CARE prompt build.
  var dataGroup = mk("div", "skill-form-field");
  dataGroup.appendChild(mkt("label", "skill-form-label", "Data points"));
  dataGroup.appendChild(mkt("div", "settings-help-inline",
    "Schema-keyed paths the skill reads or mutates. Standard view shows the " +
    "26 high-frequency paths; Advanced exposes the full mutable schema."));
  // Standard/Advanced toggle
  var toggleWrap = mk("div", "skill-form-data-toggle");
  var toggleStdBtn = mkt("button", "btn-secondary skill-form-data-toggle-btn is-active", "Standard (26)");
  toggleStdBtn.type = "button";
  toggleStdBtn.setAttribute("data-skill-data-toggle", "standard");
  var toggleAdvBtn = mkt("button", "btn-secondary skill-form-data-toggle-btn", "Advanced (full schema)");
  toggleAdvBtn.type = "button";
  toggleAdvBtn.setAttribute("data-skill-data-toggle", "advanced");
  toggleWrap.appendChild(toggleStdBtn);
  toggleWrap.appendChild(toggleAdvBtn);
  dataGroup.appendChild(toggleWrap);
  // Selector area — re-rendered when toggle flips
  var dataSelector = mk("div", "skill-form-data-points");
  dataSelector.setAttribute("data-skill-data-points", "");
  dataGroup.appendChild(dataSelector);
  form.appendChild(dataGroup);

  // ─── Field 5 · Improve button + Improved prompt ─────────────────
  var improveRow = mk("div", "skill-form-improve-row");
  var improveBtn = mkt("button", "btn-primary", "✨ Improve");
  improveBtn.type = "button";
  improveBtn.setAttribute("data-skill-improve", "");
  improveBtn.title = "Fold the seed prompt + selected data points into a CARE-structured prompt via the active LLM provider (real call; no mocks).";
  improveRow.appendChild(improveBtn);
  var improveStatus = mkt("span", "skill-form-improve-status", "");
  improveRow.appendChild(improveStatus);
  form.appendChild(improveRow);
  // Inline error chip (only rendered on failure)
  var improveError = mk("div", "skill-form-improve-error");
  improveError.style.display = "none";
  form.appendChild(improveError);
  // Improved prompt readonly textarea
  var improvedGroup = mk("div", "skill-form-field");
  improvedGroup.appendChild(mkt("label", "skill-form-label", "Improved prompt"));
  improvedGroup.appendChild(mkt("div", "settings-help-inline",
    "LLM-generated CARE-structured prompt. Readonly by default — click Edit to hand-tune; click Re-improve to regenerate from scratch."));
  var improvedArea = mk("textarea", "settings-input skills-builder-textarea");
  improvedArea.rows = 8;
  improvedArea.value = existing && existing.improvedPrompt ? existing.improvedPrompt : "";
  improvedArea.placeholder = "(empty — click Improve above to generate a CARE-structured prompt from the seed + data points)";
  improvedArea.setAttribute("data-skill-improved", "");
  improvedArea.setAttribute("readonly", "");
  improvedGroup.appendChild(improvedArea);
  // Edit + Re-improve buttons (rendered always; Edit toggles readonly)
  var improvedBtnRow = mk("div", "skill-form-improved-btn-row");
  var editBtn = mkt("button", "btn-secondary", "Edit");
  editBtn.type = "button";
  editBtn.setAttribute("data-skill-improve-edit", "");
  editBtn.title = "Unfreeze the Improved prompt for hand-editing.";
  var redoBtn = mkt("button", "btn-secondary", "Re-improve");
  redoBtn.type = "button";
  redoBtn.setAttribute("data-skill-improve-redo", "");
  redoBtn.title = "Re-run Improve with the current seed + data points (overwrites the Improved prompt).";
  improvedBtnRow.appendChild(editBtn);
  improvedBtnRow.appendChild(redoBtn);
  improvedGroup.appendChild(improvedBtnRow);
  form.appendChild(improvedGroup);

  // ─── Field 6 · Parameters[] ─────────────────────────────────────
  var paramsGroup = mk("div", "skill-form-field");
  paramsGroup.appendChild(mkt("label", "skill-form-label", "Parameters (user-supplied at run-time)"));
  paramsGroup.appendChild(mkt("div", "settings-help-inline",
    "Zero or more parameters the user fills when running the skill. " +
    "Use the file type for run-time uploads (e.g. RFP / install-base CSV)."));
  var paramsWrap = mk("div", "skill-form-parameters");
  paramsGroup.appendChild(paramsWrap);
  var addParamBtn = mkt("button", "btn-outline skill-form-add-param", "+ Add parameter");
  addParamBtn.type = "button";
  paramsGroup.appendChild(addParamBtn);
  form.appendChild(paramsGroup);

  // ─── Field 7 · Output format ────────────────────────────────────
  var outputGroup = mk("div", "skill-form-field");
  outputGroup.appendChild(mkt("label", "skill-form-label", "Output format *"));
  outputGroup.appendChild(mkt("div", "settings-help-inline",
    "How the run output renders. Mutation formats (json-array / scalar) reveal the Mutation policy choice."));
  var outputWrap = mk("div", "skill-form-output-format");
  outputGroup.appendChild(outputWrap);
  form.appendChild(outputGroup);

  // ─── Field 8 · Mutation policy (conditional) ────────────────────
  var policyGroup = mk("div", "skill-form-field");
  policyGroup.appendChild(mkt("label", "skill-form-label", "Mutation policy *"));
  policyGroup.appendChild(mkt("div", "settings-help-inline",
    "Per-skill author setting. Saved with the skill; users running it get this behavior."));
  var policyWrap = mk("div", "skill-form-mutation-policy");
  policyGroup.appendChild(policyWrap);
  // Hide until output format is mutating
  policyGroup.style.display = "none";
  form.appendChild(policyGroup);

  // ─── Form-local state ───────────────────────────────────────────
  var state = {
    parameters:     existing && Array.isArray(existing.parameters) ? existing.parameters.slice() : [],
    outputFormat:   existing && existing.outputFormat ? existing.outputFormat : "text",
    mutationPolicy: existing && existing.mutationPolicy ? existing.mutationPolicy : "ask",
    dataView:       "standard",  // "standard" | "advanced"
    dataPoints:     existing && Array.isArray(existing.dataPoints) ? existing.dataPoints.slice() : []
  };

  // ─── Renderers ──────────────────────────────────────────────────

  function renderDataPoints() {
    dataSelector.innerHTML = "";
    var points = state.dataView === "standard"
      ? getStandardMutableDataPoints()
      : getAllMutableDataPoints();
    var selectedPaths = new Set(state.dataPoints.map(function(d) { return d.path; }));
    // Group by entity for readability
    var groups = {};
    points.forEach(function(p) {
      if (!groups[p.entity]) groups[p.entity] = [];
      groups[p.entity].push(p);
    });
    Object.keys(groups).forEach(function(entityKind) {
      dataSelector.appendChild(mkt("div", "skill-form-data-group-head",
        entityKind + " (" + groups[entityKind].length + ")"));
      var groupWrap = mk("div", "skill-form-data-group");
      groups[entityKind].forEach(function(dp) {
        var label = mk("label", "skill-form-data-checkbox");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = dp.path;
        cb.checked = selectedPaths.has(dp.path);
        cb.setAttribute("data-skill-data-path", dp.path);
        cb.addEventListener("change", function() {
          if (cb.checked) {
            if (!selectedPaths.has(dp.path)) {
              state.dataPoints.push({ path: dp.path, scope: dp.scope });
              selectedPaths.add(dp.path);
            }
          } else {
            state.dataPoints = state.dataPoints.filter(function(d) { return d.path !== dp.path; });
            selectedPaths.delete(dp.path);
          }
        });
        label.appendChild(cb);
        var pathSpan = mkt("span", "skill-form-data-path", dp.path);
        label.appendChild(pathSpan);
        if (dp.note) {
          label.appendChild(mkt("span", "skill-form-data-note", "(" + dp.note + ")"));
        }
        groupWrap.appendChild(label);
      });
      dataSelector.appendChild(groupWrap);
    });
  }

  function renderOutputFormat() {
    outputWrap.innerHTML = "";
    OUTPUT_FORMATS.forEach(function(opt) {
      var optRow = mk("label", "skill-form-output-format-row");
      var radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "skill-output-format";
      radio.value = opt.id;
      radio.checked = (state.outputFormat === opt.id);
      radio.setAttribute("data-skill-output-format", "");
      radio.setAttribute("data-output-format-value", opt.id);
      radio.addEventListener("change", function() {
        state.outputFormat = opt.id;
        // Conditional mutation-policy visibility — RENDER iff mutating.
        // Per V-FLOW-SKILL-V32-AUTHOR-POLICY-1: the test asserts the
        // radios' own computed display is "none" OR they're absent from
        // DOM. Conditional rendering (NOT just style hiding) is the
        // straightforward path that matches both branches of that assertion.
        var isMutating = (opt.id === "json-array" || opt.id === "scalar");
        policyGroup.style.display = isMutating ? "" : "none";
        if (isMutating) renderMutationPolicy();
        else policyWrap.innerHTML = "";
      });
      optRow.appendChild(radio);
      var labelText = mk("span", "skill-form-output-format-label");
      labelText.textContent = opt.label;
      optRow.appendChild(labelText);
      var hintText = mk("span", "skill-form-output-format-hint");
      hintText.textContent = opt.hint;
      optRow.appendChild(hintText);
      outputWrap.appendChild(optRow);
    });
    // Set initial conditional visibility — group hidden + radios NOT rendered
    // when output is text (the default).
    var isMutating = (state.outputFormat === "json-array" || state.outputFormat === "scalar");
    policyGroup.style.display = isMutating ? "" : "none";
    if (isMutating) renderMutationPolicy();
    else policyWrap.innerHTML = "";
  }

  function renderMutationPolicy() {
    policyWrap.innerHTML = "";
    MUTATION_POLICIES.forEach(function(opt) {
      var optRow = mk("label", "skill-form-mutation-policy-row");
      var radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "skill-mutation-policy";
      radio.value = opt.id;
      radio.checked = (state.mutationPolicy === opt.id);
      radio.setAttribute("data-skill-mutation-policy", "");
      radio.setAttribute("data-policy-value", opt.id);
      radio.addEventListener("change", function() { state.mutationPolicy = opt.id; });
      optRow.appendChild(radio);
      var labelText = mk("span", "skill-form-mutation-policy-label");
      labelText.textContent = opt.label;
      optRow.appendChild(labelText);
      var hintText = mk("span", "skill-form-mutation-policy-hint");
      hintText.textContent = opt.hint;
      optRow.appendChild(hintText);
      policyWrap.appendChild(optRow);
    });
  }

  function renderParameters() {
    paramsWrap.innerHTML = "";
    if (state.parameters.length === 0) {
      paramsWrap.appendChild(mkt("div", "settings-help-inline skill-param-empty",
        "(No parameters — this skill runs without runtime input.)"));
      return;
    }
    state.parameters.forEach(function(p, idx) {
      paramsWrap.appendChild(renderParameterRow(p, idx));
    });
  }

  function renderParameterRow(p, idx) {
    var row = mk("div", "skill-param-row");
    // name
    var nameG = mk("div", "skill-param-cell");
    nameG.appendChild(mkt("label", "skill-form-label", "Name"));
    var nameI = mk("input", "settings-input");
    nameI.type = "text"; nameI.value = p.name || "";
    nameI.placeholder = "e.g. rfpBody";
    nameI.addEventListener("input", function() { state.parameters[idx].name = nameI.value; });
    nameG.appendChild(nameI);
    row.appendChild(nameG);
    // type
    var typeG = mk("div", "skill-param-cell");
    typeG.appendChild(mkt("label", "skill-form-label", "Type"));
    var typeS = mk("select", "settings-input");
    PARAMETER_TYPES.forEach(function(t) {
      var o = document.createElement("option");
      o.value = t.id; o.textContent = t.label;
      if (t.id === p.type) o.selected = true;
      typeS.appendChild(o);
    });
    typeS.addEventListener("change", function() {
      state.parameters[idx].type = typeS.value;
      renderParameters();
    });
    typeG.appendChild(typeS);
    row.appendChild(typeG);
    // description
    var descG = mk("div", "skill-param-cell");
    descG.appendChild(mkt("label", "skill-form-label", "Description"));
    var descI = mk("input", "settings-input");
    descI.type = "text"; descI.value = p.description || "";
    descI.placeholder = "e.g. Customer install-base CSV";
    descI.addEventListener("input", function() { state.parameters[idx].description = descI.value; });
    descG.appendChild(descI);
    row.appendChild(descG);
    // accepts (file type only)
    if (p.type === "file") {
      var accG = mk("div", "skill-param-cell");
      accG.appendChild(mkt("label", "skill-form-label", "Accepts"));
      var accI = mk("input", "settings-input");
      accI.type = "text"; accI.value = p.accepts || ".xlsx,.csv,.txt,.pdf";
      accI.placeholder = ".xlsx,.csv,.txt,.pdf";
      accI.addEventListener("input", function() { state.parameters[idx].accepts = accI.value; });
      accG.appendChild(accI);
      row.appendChild(accG);
    }
    // required
    var reqG = mk("div", "skill-param-cell skill-param-required");
    var reqL = mkt("label", "skill-param-required-label", "Required");
    var reqI = document.createElement("input");
    reqI.type = "checkbox"; reqI.checked = !!p.required;
    reqI.addEventListener("change", function() { state.parameters[idx].required = reqI.checked; });
    reqL.prepend(reqI);
    reqG.appendChild(reqL);
    row.appendChild(reqG);
    // remove
    var rmBtn = mkt("button", "btn-danger skill-param-remove", "Remove");
    rmBtn.type = "button";
    rmBtn.addEventListener("click", function() {
      state.parameters.splice(idx, 1);
      renderParameters();
    });
    row.appendChild(rmBtn);
    return row;
  }

  // ─── Wire toggles + buttons ─────────────────────────────────────

  toggleStdBtn.addEventListener("click", function() {
    state.dataView = "standard";
    toggleStdBtn.classList.add("is-active");
    toggleAdvBtn.classList.remove("is-active");
    renderDataPoints();
  });
  toggleAdvBtn.addEventListener("click", function() {
    state.dataView = "advanced";
    toggleAdvBtn.classList.add("is-active");
    toggleStdBtn.classList.remove("is-active");
    renderDataPoints();
  });

  addParamBtn.addEventListener("click", function() {
    state.parameters.push({ name: "", type: "string", description: "", required: false });
    renderParameters();
  });

  // Improve button — real LLM call (CH36.b · feedback_no_mocks.md)
  improveBtn.addEventListener("click", async function() {
    var seed = (seedArea.value || "").trim();
    var hasDataPoints = state.dataPoints.length > 0;
    // Pre-flight per SPEC §S46.5: seed non-empty + ≥1 data point
    if (!seed || !hasDataPoints) {
      improveError.style.display = "block";
      improveError.className = "skill-form-improve-error err";
      improveError.textContent = "Add a seed prompt and select at least one data point first.";
      return;
    }
    improveError.style.display = "none";
    improveError.textContent = "";
    improveBtn.disabled = true;
    improveStatus.textContent = " · improving via " + (loadAiConfig().activeProvider || "AI") + "…";
    try {
      var cfg = loadAiConfig();
      var active = cfg.providers[cfg.activeProvider];
      var dataPointDescriptions = state.dataPoints.map(function(d) { return d.path; }).join(", ");
      // rc.8.b BUG-2 Path A (2026-05-11 evening) — hardened Improve
      // meta-skill prompt. The previous (softer) wording let the LLM
      // produce CARE templates that:
      //   - put generic AI-assistant framing in <context> (no actual
      //     engagement data anywhere)
      //   - leaked the expected answer value into <format> as a
      //     "target reference" (e.g. 'directly correspond to
      //     `Northstar Health Network`'), which the LLM at run-time
      //     reads as a format spec, not as data
      //   - used real-looking example names like 'ACME Corporation'
      //     that the LLM at run-time confused with actual data
      // Strict rules below force grounded prompts: data embedded in
      // <context>, never in <format>; examples clearly fake.
      var systemPrompt =
        "You are a prompt-engineering assistant for a presales discovery tool. " +
        "Rewrite the user's seed prompt into a CARE-structured prompt with " +
        "Anthropic XML wire tags. Use exactly four sections: <context>, " +
        "<task>, <format>, <examples>. The result will be sent to an LLM " +
        "at run-time with engagement data substituted into {{path}} " +
        "placeholders, plus a separate <engagement-data> block prepended " +
        "with actual values from the user's engagement." +
        "\n\nSTRICT RULES:\n" +
        "  1. <context> MUST embed the user's selected data points as " +
        "CONCRETE DATA, using {{path}} placeholders that resolve to real " +
        "engagement values at run-time. Example: 'The customer is " +
        "{{customer.name}} in vertical {{customer.vertical}}.' NEVER " +
        "write generic 'You are an AI assistant' framing. NEVER describe " +
        "the assistant's role; describe the engagement data directly.\n" +
        "  2. <task> MUST be a single imperative sentence the LLM " +
        "executes (e.g. 'Identify the customer name from the context " +
        "above.' or 'Summarize the gaps under cyber resilience as 3-5 " +
        "exec bullets.'). NEVER ask the LLM to 'extract from a " +
        "conversation' unless the seed prompt is specifically about " +
        "parsing conversational input — the engagement data is the " +
        "context, not a conversation.\n" +
        "  3. <format> MUST describe ONLY the OUTPUT SHAPE (e.g. " +
        "'single line of plain text', 'JSON array of {x, y, z} objects'). " +
        "NEVER include the expected answer value as a target reference. " +
        "NEVER write 'The desired output should directly correspond to " +
        "<value>' or anything similar — that's data, not format. Data " +
        "belongs in <context>.\n" +
        "  4. <examples> MUST use 1-2 hypothetical input/output pairs. " +
        "Use OBVIOUSLY FAKE placeholder names like 'Example Corp', " +
        "'Sample Co.', or 'XYZ Inc.' — never use names that could be " +
        "real customers ('ACME Corporation', 'Global Solutions Inc.', " +
        "etc.) since the LLM may confuse them with actual data.\n" +
        "  5. Output ONLY the four XML blocks (in order: <context>, " +
        "<task>, <format>, <examples>). No preamble, no postscript, no " +
        "code fences, no explanation.";
      var res = await chatCompletion({
        providerKey: cfg.activeProvider,
        baseUrl:     active.baseUrl,
        model:       active.model,
        apiKey:      active.apiKey,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content:
              "Seed prompt:\n---\n" + seed + "\n---\n\n" +
              "Selected data points (schema-keyed paths):\n" + dataPointDescriptions
          }
        ]
      });
      improvedArea.value = (res && res.text) || "";
      improvedArea.setAttribute("readonly", "");
      improveStatus.textContent = "";
    } catch (e) {
      // Per SPEC §S46.5: inline error chip + Retry button; Improved field NOT cleared
      improveError.style.display = "block";
      improveError.className = "skill-form-improve-error err";
      improveError.innerHTML = "";
      var msg = mkt("span", "skill-form-improve-error-msg",
        "Improve failed: " + (e.message || String(e)) + ". Try again, or check Settings → LLM providers.");
      improveError.appendChild(msg);
      var retryBtn = mkt("button", "btn-secondary skill-form-improve-retry", "Retry");
      retryBtn.type = "button";
      retryBtn.addEventListener("click", function() { improveBtn.click(); });
      improveError.appendChild(retryBtn);
      improveStatus.textContent = "";
    } finally {
      improveBtn.disabled = false;
    }
  });

  // Edit button — unfreezes the Improved textarea for hand-edits
  editBtn.addEventListener("click", function() {
    improvedArea.removeAttribute("readonly");
    improvedArea.focus();
  });

  // Re-improve button — re-locks + re-runs Improve
  redoBtn.addEventListener("click", function() {
    improvedArea.setAttribute("readonly", "");
    improveBtn.click();
  });

  // ─── Test button (rc.8.b hygiene: real-LLM wiring per SPEC §S46.3) ─
  // Runs the current draft's improvedPrompt through the active LLM
  // provider via chatCompletion (same transport as Improve + the
  // Canvas Chat skill runtime). NO mocks per CH36.b /
  // feedback_no_mocks.md. {{paramName}} placeholders are NOT
  // substituted at the author surface (they pass through verbatim);
  // for full parameter substitution, save the skill + run it via
  // Canvas Chat → Skills tab where parameter inputs render in the
  // Skill panel right-rail.
  var testRow = mk("div", "skill-form-test-row");
  var testBtn = mkt("button", "btn-secondary", "Test skill now");
  testBtn.type = "button";
  testBtn.setAttribute("data-skill-test", "");
  testRow.appendChild(testBtn);
  form.appendChild(testRow);
  var testOut = mk("div", "ai-skill-result skill-form-test-out");
  testOut.style.display = "none";
  form.appendChild(testOut);
  testBtn.addEventListener("click", async function() {
    var draft = (improvedArea.value || "").trim();
    testOut.style.display = "block";
    if (!draft) {
      testOut.className = "ai-skill-result skill-form-test-out err";
      testOut.textContent = "Improved prompt is empty. Click Improve first, or hand-edit the Improved prompt textarea, then Test.";
      return;
    }
    testBtn.disabled = true;
    var origLabel = testBtn.textContent;
    testBtn.textContent = "Running...";
    testOut.className = "ai-skill-result skill-form-test-out running";
    testOut.textContent = "Running with " + (loadAiConfig().activeProvider || "active provider") + "...";
    try {
      var cfg = loadAiConfig();
      var active = cfg.providers[cfg.activeProvider];
      if (!active) {
        testOut.className = "ai-skill-result skill-form-test-out err";
        testOut.textContent = "No active LLM provider configured. Open Settings → AI Providers to set one up.";
        return;
      }
      // BUG-2 fix 2026-05-11: resolve schema-keyed data paths against
      // the active engagement BEFORE sending to the LLM. Without this,
      // {{customer.name}} etc. pass through verbatim and the LLM
      // echoes the CARE template back. Parameter placeholders
      // ({{paramName}}) still pass through verbatim at the author
      // surface — runtime substitution happens via the Skills launcher
      // flow per CH36.j.
      //
      // BUG-2 v2 (2026-05-11 same-day): pathResolver walks ctx.<path>
      // directly, NOT ctx.engagement.<path>. Build a session-wide ctx
      // with customer + engagementMeta + collection arrays exposed at
      // top level so paths like {{customer.name}} resolve correctly.
      var engagement = getActiveEngagement();
      var collFlat = function(coll) {
        if (!coll || !Array.isArray(coll.allIds) || !coll.byId) return [];
        return coll.allIds.map(function(id) { return coll.byId[id]; }).filter(Boolean);
      };
      var skillCtx = engagement ? {
        engagement:     engagement,
        customer:       engagement.customer || {},
        engagementMeta: engagement.meta || {},
        drivers:        collFlat(engagement.drivers),
        environments:   collFlat(engagement.environments),
        instances:      collFlat(engagement.instances),
        gaps:           collFlat(engagement.gaps)
      } : {};
      var resolvedDraft = resolveTemplate(draft, skillCtx,
        { skillId: existing && existing.skillId || "skl-draft" });
      var res = await chatCompletion({
        providerKey: cfg.activeProvider,
        baseUrl:     active.baseUrl,
        model:       active.model,
        apiKey:      active.apiKey,
        messages: [
          // BUG-2 fix 2026-05-11: hardened system prompt prevents the
          // LLM from echoing the CARE XML template back. See
          // CanvasChatOverlay.runSkill for the matching contract.
          { role: "system", content:
              "You are executing a saved skill DRAFT (author preview; this is a Test run, not a final " +
              "save). The user message below contains a CARE-structured prompt (<context>, <task>, " +
              "<format>, <examples>) with engagement data already inlined. Your job is to EXECUTE the " +
              "<task> using the <context> data, producing ONLY the final answer in the shape the <format> " +
              "section specifies. " +
              "\n\nSTRICT RULES:\n" +
              "  1. DO NOT echo the prompt template back. DO NOT include <context>, <task>, <format>, or " +
              "<examples> XML tags in your response.\n" +
              "  2. DO NOT explain your reasoning, restate the task, or include preamble.\n" +
              "  3. DO NOT generate hypothetical or example values. Only emit values derived from the " +
              "<context> data provided.\n" +
              "  4. If the <context> data is missing required information, output exactly: " +
              "'[insufficient data: <what is missing>]' and nothing else.\n" +
              "  5. Match the <format> exactly.\n" +
              "  6. {{paramName}} placeholders (parameters) may still appear in the prompt verbatim " +
              "(author surface skips parameter substitution); treat them as literal '[parameter value]' " +
              "placeholders when reasoning — full parameter substitution happens at run-time via the " +
              "Skills launcher flow."
          },
          { role: "user",   content: resolvedDraft }
        ]
      });
      testOut.innerHTML = "";
      testOut.className = "ai-skill-result skill-form-test-out ok";
      var head = mk("div", "ai-skill-result-head");
      head.textContent = "Test output · " + (cfg.activeProvider || "?") + " (draft — not saved)";
      testOut.appendChild(head);
      var body = mk("pre", "ai-skill-result-body");
      body.textContent = (res && res.text) || "(empty response)";
      testOut.appendChild(body);
    } catch (e) {
      testOut.className = "ai-skill-result skill-form-test-out err";
      testOut.textContent = "Test failed: " + (e && e.message || String(e)) +
        ". Try again, or check Settings → AI Providers.";
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = origLabel;
    }
  });

  // ─── Save + Cancel ───────────────────────────────────────────────
  var actions = mk("div", "form-actions");
  var cancelBtn = mkt("button", "btn-secondary", "Cancel");
  cancelBtn.type = "button";
  cancelBtn.addEventListener("click", function() { form.remove(); });
  var saveBtn = mkt("button", "btn-primary", existing ? "Save changes" : "Create skill");
  saveBtn.type = "button";
  saveBtn.setAttribute("data-skill-save", "");
  var saveHint = mkt("span", "save-gate-hint", "");
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  actions.appendChild(saveHint);
  form.appendChild(actions);

  saveBtn.addEventListener("click", function() {
    var label = (labelInput.value || "").trim();
    var description = (descInput.value || "").trim();
    var seedPrompt = (seedArea.value || "").trim();
    var improvedPrompt = (improvedArea.value || "").trim();
    if (!label) { alert("Label is required."); return; }
    if (!description) { alert("Description is required."); return; }
    if (!seedPrompt) { alert("Seed prompt is required."); return; }
    if (state.outputFormat === "json-array" || state.outputFormat === "scalar") {
      if (!state.mutationPolicy) { alert("Pick a mutation policy (output format is mutating)."); return; }
    }
    var skillId = existing && existing.skillId
      ? existing.skillId
      : ("skl-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) + "-" + Math.floor(Math.random() * 1000));
    var draft = {
      skillId:        skillId,
      label:          label,
      description:    description,
      seedPrompt:     seedPrompt,
      dataPoints:     state.dataPoints.slice(),
      improvedPrompt: improvedPrompt,
      outputFormat:   state.outputFormat,
      mutationPolicy: (state.outputFormat === "json-array" || state.outputFormat === "scalar")
                        ? state.mutationPolicy
                        : null,
      parameters:     state.parameters.slice()
    };
    var manifest = generateManifest();
    var result;
    try { result = saveV3Skill(draft, { manifest: manifest }); }
    catch (e) {
      // R3 expectation: schema/skill.js will reject the new shape until R4
      // lands. Surface the error inline rather than silently swallowing.
      alert("Save failed (schema not yet extended for the new shape — lands at R4): " + (e && e.message || e));
      return;
    }
    if (!result || !result.ok) {
      alert("Save failed: " + ((result && result.errors) || []).map(function(e) { return e.message || e; }).join("; "));
      return;
    }
    form.remove();
    renderList(list, onChange);
    if (onChange) onChange();
  });

  adminRoot.appendChild(form);

  // Initial paints — renderOutputFormat() handles conditional mutation
  // policy rendering based on state.outputFormat (default "text" → no
  // policy radios in DOM at first paint).
  renderDataPoints();
  renderOutputFormat();
  renderParameters();
  labelInput.focus();
}

// ─── Tiny form helpers (preserved from legacy) ─────────────────────
function mk(tag, cls)        { var el = document.createElement(tag); if (cls) el.className = cls; return el; }
function mkt(tag, cls, txt)  { var el = mk(tag, cls); if (txt != null) el.textContent = txt; return el; }
