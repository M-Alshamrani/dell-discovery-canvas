// ui/views/SkillBuilder.js — v3.0.0-rc.4-dev Arc 4 (SPEC §S35 + RULES §16 CH31)
//
// Evolved Skill Builder. Replaces the rc.3-era lean v3.1 builder
// (deleted in this same arc) AND replaces ui/views/SkillAdmin.js
// (renamed/retired in this same arc). Mounted by SettingsModal under
// the "Skills builder" pill — the SINGLE entry point for skill
// authoring per CH31 (no version suffix in the label, no second pill,
// no standalone overlay).
//
// Architecture:
//   - UX BASE preserved from v2.4 SkillAdmin (list + deploy toggle +
//     edit form + chip palette + Refine-to-CARE + dual-textbox preview
//     + Test button + save gate)
//   - Storage SWITCHED to state/v3SkillStore.js (v3.1 schema). v2
//     core/skillStore.js is read-only legacy for one release; v2
//     records appear under a "Legacy (v2)" section with per-row
//     "Migrate" button (opt-in, NOT auto)
//   - parameters[] editor ADDED to the edit form (rows: name + type +
//     description + required)
//   - outputTarget radio ADDED (4 options; only chat-bubble enabled,
//     other 3 disabled with "deferred to GA" hint per SPEC §S29.7)
//   - DROPPED v2-only fields: tab, applyPolicy, deployed, outputSchema,
//     providerKey, systemPrompt (per SPEC §S35.2 R35.8)
//   - Chat-rail "+ Author new skill" routes here via the
//     skillBuilderOpener.js shim (R35.3)
//
// Authority: docs/v3.0/SPEC.md §S35 · docs/RULES.md §16 CH31 ·
// feedback_no_version_prefix_in_names.md · feedback_spec_and_test_first.md.

import {
  saveV3Skill, loadV3Skills, loadV3SkillById, deleteV3Skill
}                                          from "../../state/v3SkillStore.js";
import { loadSkills as loadV2Skills }      from "../../core/skillStore.js"; // read-only legacy
import { migrateV2SkillToV31 }             from "../../schema/skill.js";
import { generateManifest }                from "../../services/manifestGenerator.js";
import { runSkill }                        from "../../services/skillRunner.js";
import { resolveTemplate }                 from "../../services/pathResolver.js";
// rc.7-arc-1 (2026-05-06) — createMockLLMProvider import removed per
// feedback_no_mocks.md (LOCKED 2026-05-05). The Mock toggle in the
// "Test skill now" UI is removed; the test button always invokes the
// active real provider via createRealLLMProvider().
import {
  createRealLLMProvider, ProviderNotConfiguredError
}                                          from "../../services/realLLMProvider.js";
import { loadAiConfig }                    from "../../core/aiConfig.js";
import { chatCompletion }                  from "../../services/aiService.js";
import { REFINE_META_SYSTEM, REFINE_META_RULES } from "../../core/promptGuards.js";
import { createPillEditor }                from "../components/PillEditor.js";
import { getActiveEngagement }             from "../../state/engagementStore.js";
import { loadDemo }                        from "../../core/demoEngagement.js";
import { loadCatalog }                     from "../../services/catalogLoader.js";

// outputTarget options. Only chat-bubble enabled; other 3 disabled
// with "deferred to GA" hint per SPEC §S29.7 + §S35.6 decision A.
const OUTPUT_TARGETS = [
  { id: "chat-bubble",      label: "Chat bubble (markdown)",       enabled: true,
    hint: "Free-text or structured output rendered as a chat message." },
  { id: "structured-card",  label: "Structured card",              enabled: false,
    hint: "Schema-typed data + render template. Deferred to GA." },
  { id: "reporting-panel",  label: "Reporting panel (visual)",     enabled: false,
    hint: "Visualization (heatmap, chart). Deferred to GA." },
  { id: "proposed-changes", label: "Proposed changes (mutate)",    enabled: false,
    hint: "Mutation proposals with per-item approval. Deferred to GA." }
];

const PARAMETER_TYPES = [
  { id: "string",   label: "string" },
  { id: "number",   label: "number" },
  { id: "boolean",  label: "boolean" },
  { id: "entityId", label: "entityId (gap / driver / instance / environment)" }
];

// Render the panel into `container` (the settings modal body). Public
// API matches v2 renderSkillAdmin so SettingsModal call site changes
// from `renderSkillAdmin` to `renderSkillBuilder`.
export function renderSkillBuilder(container, onChange) {
  container.innerHTML = "";
  var root = mk("div", "skill-admin");

  var header = mk("div", "skill-admin-header");
  var title  = mkt("div", "skill-admin-title", "Skills builder");
  var addBtn = mkt("button", "btn-primary", "+ Add skill");
  addBtn.addEventListener("click", function() {
    renderEditForm(root, list, null /* new skill */, onChange);
  });
  header.appendChild(title);
  header.appendChild(addBtn);
  root.appendChild(header);

  root.appendChild(mkt("div", "settings-help",
    "Skills run against the active AI provider. Each skill is a parameterized prompt; " +
    "users invoke it from the AI assistant chat right-rail. Click any chip below to " +
    "insert a binding to engagement data (the customer name, a selected gap, an " +
    "environment, and so on). Add parameters for runtime user input (e.g. 'Pick a gap')."));

  var list = mk("div", "skill-admin-list");
  renderList(list, onChange);
  root.appendChild(list);

  container.appendChild(root);
  return root;
}

function renderList(list, onChange) {
  list.innerHTML = "";
  var savedMap     = loadV3Skills();
  var savedSkills  = Object.keys(savedMap).map(function(k) { return savedMap[k]; });

  if (savedSkills.length === 0) {
    list.appendChild(mkt("div", "skill-admin-empty",
      "No skills yet. Click '+ Add skill' to create one."));
  } else {
    savedSkills.forEach(function(s) {
      list.appendChild(renderRow(s, list, onChange));
    });
  }

  // Legacy section: rendered ONLY when current store is empty AND legacy
  // store has records. One-release transition window — opt-in migration
  // via per-row "Migrate" button. (SPEC + RULES references in comments.)
  var legacySkills = [];
  try { legacySkills = loadV2Skills(); } catch (e) { /* best-effort; legacy store is read-only */ }
  if (savedSkills.length === 0 && Array.isArray(legacySkills) && legacySkills.length > 0) {
    list.appendChild(renderLegacySection(legacySkills, list, onChange));
  }
}

function renderLegacySection(legacySkills, list, onChange) {
  var sec = mk("div", "skill-legacy-section");
  sec.appendChild(mkt("div", "skill-legacy-section-head", "Legacy skills"));
  sec.appendChild(mkt("div", "settings-help-inline",
    "These skills come from the previous store. They're read-only here — click 'Migrate' " +
    "on a row to translate it into the current schema and copy it to the new store. The " +
    "original record stays in place as backup until the next release."));
  legacySkills.forEach(function(legacy) {
    var row = mk("div", "skill-row skill-row-legacy");
    var nameCol = mk("div", "skill-row-name-col");
    nameCol.appendChild(mkt("div", "skill-row-name", legacy.name || "(untitled legacy skill)"));
    if (legacy.description) nameCol.appendChild(mkt("div", "skill-row-desc", legacy.description));
    var meta = mk("div", "skill-row-meta");
    if (legacy.tabId)          meta.appendChild(mkt("span", "skill-row-tab",    "tab: " + legacy.tabId));
    if (legacy.responseFormat) meta.appendChild(mkt("span", "skill-row-format", legacy.responseFormat));
    nameCol.appendChild(meta);
    row.appendChild(nameCol);

    var actions = mk("div", "skill-row-actions");
    var migrateBtn = mkt("button", "btn-secondary skill-row-migrate", "Migrate");
    migrateBtn.title = "Translate this legacy skill into the current schema and copy it to the new store. The original stays as backup.";
    migrateBtn.addEventListener("click", function() {
      var migrated = migrateV2SkillToV31(legacy);
      // Drop the audit field before saving (it's not part of the strict
      // schema). UI surfaces what was lost in a one-time confirm dialog.
      var dropped = (migrated._droppedFromV2 || []).map(function(d) { return d.field; });
      delete migrated._droppedFromV2;
      var msg = "Migrate '" + migrated.label + "' into the current schema?";
      if (dropped.length > 0) {
        msg += "\n\nThese legacy fields will be dropped (no equivalent in the current schema): " + dropped.join(", ") + ".";
      }
      msg += "\n\nThe original legacy record stays as backup.";
      if (!confirm(msg)) return;
      var manifest = generateManifest();
      var result = saveV3Skill(migrated, { manifest: manifest });
      if (result.ok) {
        renderList(list, onChange);
        if (onChange) onChange();
      } else {
        alert("Migration failed: " + (result.errors || []).map(function(e) { return e.message || e; }).join("; "));
      }
    });
    actions.appendChild(migrateBtn);
    row.appendChild(actions);
    sec.appendChild(row);
  });
  return sec;
}

function renderRow(skill, list, onChange) {
  var row = mk("div", "skill-row");

  var nameCol = mk("div", "skill-row-name-col");
  nameCol.appendChild(mkt("div", "skill-row-name", skill.label || skill.skillId));
  if (skill.description) nameCol.appendChild(mkt("div", "skill-row-desc", skill.description));
  var meta = mk("div", "skill-row-meta");
  meta.appendChild(mkt("span", "skill-row-format", skill.outputTarget || "chat-bubble"));
  if (typeof skill.outputContract === "object" && skill.outputContract.schemaRef) {
    meta.appendChild(mkt("span", "skill-row-policy", "structured: " + skill.outputContract.schemaRef));
  } else {
    meta.appendChild(mkt("span", "skill-row-policy", "free-text"));
  }
  if (Array.isArray(skill.parameters) && skill.parameters.length > 0) {
    meta.appendChild(mkt("span", "skill-row-params", skill.parameters.length + " param" + (skill.parameters.length === 1 ? "" : "s")));
  }
  nameCol.appendChild(meta);
  row.appendChild(nameCol);

  var actions = mk("div", "skill-row-actions");

  var editBtn = mkt("button", "btn-outline", "Edit");
  editBtn.addEventListener("click", function() {
    var adminRoot = list.parentElement;
    if (adminRoot) renderEditForm(adminRoot, list, skill, onChange);
  });
  actions.appendChild(editBtn);

  var delBtn = mkt("button", "btn-danger", "Delete");
  delBtn.addEventListener("click", function() {
    if (!confirm("Delete skill '" + (skill.label || skill.skillId) + "'? This cannot be undone.")) return;
    deleteV3Skill(skill.skillId);
    renderList(list, onChange);
    if (onChange) onChange();
  });
  actions.appendChild(delBtn);

  row.appendChild(actions);
  return row;
}

function renderEditForm(adminRoot, list, existing, onChange) {
  var old = adminRoot.querySelector(".skill-form");
  if (old) old.remove();

  var form = mk("div", "skill-form");
  form.appendChild(mkt("div", "skill-form-title",
    existing ? "Edit skill" : "Add skill"));

  var nameInput = mkField(form, "Label *", "text",
    existing ? existing.label : "",
    "User-visible name shown in the chat right-rail and skill list.");
  var descInput = mkField(form, "Description", "text",
    existing ? existing.description : "",
    "One-line summary; helps users know when to invoke this skill.");

  // ─── Prompt template (pill editor) ─────────────────────────────
  var tplLabelGroup = mk("div", "skill-form-field");
  tplLabelGroup.appendChild(mkt("label", "skill-form-label", "Prompt template *"));
  tplLabelGroup.appendChild(mkt("div", "settings-help-inline",
    "Sent to the AI on every run. Click any field chip below to insert a binding pill (uneditable as a unit; " +
    "Backspace removes it whole). Reference parameters with {{paramName}} (defined below)."));
  form.appendChild(tplLabelGroup);

  // Build the pill-editor manifest from the v3 manifestGenerator (engagement-wide
  // bindable paths, NOT v2 fieldsForTab(tabId)).
  var canvasManifest        = generateManifest();
  var pillManifestList  = buildPillEditorManifest(canvasManifest);

  var tplArea = createPillEditor({
    initialValue: existing ? existing.promptTemplate : "Hello {{customer.name}}!",
    manifest:     pillManifestList,
    onInput:      function() { refreshBindingsAndPreview(); invalidateTest(); }
  });
  tplLabelGroup.appendChild(tplArea);

  // ─── Refine to CARE button ─────────────────────────────────────
  var refineRow = mk("div", "refine-row");
  var refineBtn = mkt("button", "btn-secondary", "✨ Refine to CARE format");
  refineBtn.title = "Rewrite this draft as a CARE-structured prompt (Context · Ask · Rules · Examples) using the active AI provider.";
  refineRow.appendChild(refineBtn);
  var refineStatus = mkt("span", "refine-status", "");
  refineRow.appendChild(refineStatus);
  form.appendChild(refineRow);
  var refineDiff = mk("div", "refine-diff");
  refineDiff.style.display = "none";
  form.appendChild(refineDiff);

  refineBtn.addEventListener("click", async function() {
    var draft = tplArea.serialize().trim();
    if (!draft) { alert("Write a draft first, or click a chip to insert a binding."); return; }
    refineBtn.disabled = true;
    refineStatus.textContent = " · refining via " + (loadAiConfig().activeProvider || "AI") + "…";
    refineDiff.style.display = "none";
    try {
      var cfg = loadAiConfig();
      var active = cfg.providers[cfg.activeProvider];
      var res = await chatCompletion({
        providerKey: cfg.activeProvider,
        baseUrl:     active.baseUrl,
        model:       active.model,
        apiKey:      active.apiKey,
        messages: [
          { role: "system", content: REFINE_META_SYSTEM + "\n\n" + REFINE_META_RULES },
          { role: "user",   content: "Original prompt to rewrite:\n---\n" + draft + "\n---" }
        ]
      });
      renderRefineDiff(refineDiff, draft, res.text || "", function(accepted) {
        if (accepted) { tplArea.setValue(accepted); refreshBindingsAndPreview(); invalidateTest(); }
        refineDiff.style.display = "none";
      });
      refineDiff.style.display = "block";
      refineStatus.textContent = "";
    } catch (e) {
      refineStatus.textContent = " · refine failed: " + (e.message || String(e));
    } finally {
      refineBtn.disabled = false;
    }
  });

  // ─── Chip palette (engagement-wide; replaces v2 per-tab fields) ─
  form.appendChild(mkt("div", "skill-form-label", "Bindable fields — click to insert"));
  var chipsWrap = mk("div", "field-chip-list");
  form.appendChild(chipsWrap);
  renderChipPalette(chipsWrap, pillManifestList, tplArea);

  // ─── Detected bindings + live preview ──────────────────────────
  var bindingsEl = mkt("div", "skill-form-bindings", "");
  form.appendChild(bindingsEl);
  form.appendChild(mkt("div", "skill-form-label", "Preview with current engagement data"));
  var previewBox = mk("pre", "template-preview");
  form.appendChild(previewBox);

  function refreshBindingsAndPreview() {
    var serialized = tplArea.serialize();
    var found = findPlaceholderPaths(serialized);
    bindingsEl.textContent = found.length === 0
      ? "No {{template.bindings}} detected."
      : "Detected bindings: " + found.map(function(p) { return "{{" + p + "}}"; }).join(", ");
    var ctx = buildEngagementCtxForPreview(state.parameters);
    previewBox.textContent = resolveTemplate(serialized, ctx, { skillId: existing ? existing.skillId : "skl-draft-1" })
      || "(empty — write a template above, or click a field chip to insert)";
  }

  // ─── Parameters editor (v3.1 NEW per CH31) ─────────────────────
  form.appendChild(mkt("div", "skill-form-label", "Parameters (user-supplied at invoke time)"));
  form.appendChild(mkt("div", "settings-help-inline",
    "Zero or more parameters the user fills in when running this skill from the chat. " +
    "Reference them in the template by name (paramName) wrapped in double-braces. " +
    "Pick the entityId type to bind a parameter to a real gap / driver / instance / " +
    "environment selected at run time."));
  var paramsWrap = mk("div", "skill-form-parameters");
  form.appendChild(paramsWrap);
  var addParamBtn = mkt("button", "btn-outline skill-form-add-param", "+ Add parameter");
  form.appendChild(addParamBtn);

  // ─── outputTarget radio (v3.1 NEW per CH31) ────────────────────
  form.appendChild(mkt("div", "skill-form-label", "Output target"));
  form.appendChild(mkt("div", "settings-help-inline",
    "Where the response renders. Only 'chat-bubble' is implemented in this release; the " +
    "others are surfaced for visibility and will land in a future release."));
  var outputTargetWrap = mk("div", "skill-form-output-target");
  form.appendChild(outputTargetWrap);

  // ─── Test button + result panel ────────────────────────────────
  // rc.7-arc-1 (2026-05-06): Mock|Real provider toggle removed per
  // feedback_no_mocks.md (LOCKED 2026-05-05). Test button always
  // invokes the active real provider per Settings → AI Providers.
  var testRow = mk("div", "skill-form-test-row");
  var testBtn = mkt("button", "btn-secondary", "Test skill now");
  testRow.appendChild(testBtn);
  form.appendChild(testRow);
  var testOut = mk("div", "ai-skill-result skill-form-test-out");
  testOut.style.display = "none";
  form.appendChild(testOut);

  // Form-local state — drives parameters editor + outputTarget radio.
  var state = {
    parameters:   existing && Array.isArray(existing.parameters) ? existing.parameters.slice() : [],
    outputTarget: existing && existing.outputTarget                ? existing.outputTarget       : "chat-bubble"
  };

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
    var nameG = mk("div", "skill-param-cell skill-param-name");
    nameG.appendChild(mkt("label", "skill-form-label", "Name"));
    var nameI = mk("input", "settings-input");
    nameI.type = "text"; nameI.value = p.name || "";
    nameI.placeholder = "e.g. gap";
    nameI.addEventListener("input", function() { state.parameters[idx].name = nameI.value; invalidateTest(); refreshBindingsAndPreview(); });
    nameG.appendChild(nameI);
    row.appendChild(nameG);
    // type
    var typeG = mk("div", "skill-param-cell skill-param-type");
    typeG.appendChild(mkt("label", "skill-form-label", "Type"));
    var typeS = mk("select", "settings-input");
    PARAMETER_TYPES.forEach(function(t) {
      var o = document.createElement("option");
      o.value = t.id; o.textContent = t.label;
      if (t.id === p.type) o.selected = true;
      typeS.appendChild(o);
    });
    typeS.addEventListener("change", function() { state.parameters[idx].type = typeS.value; invalidateTest(); });
    typeG.appendChild(typeS);
    row.appendChild(typeG);
    // description
    var descG = mk("div", "skill-param-cell skill-param-desc");
    descG.appendChild(mkt("label", "skill-form-label", "Description"));
    var descI = mk("input", "settings-input");
    descI.type = "text"; descI.value = p.description || "";
    descI.placeholder = "e.g. Pick a gap";
    descI.addEventListener("input", function() { state.parameters[idx].description = descI.value; invalidateTest(); });
    descG.appendChild(descI);
    row.appendChild(descG);
    // required
    var reqG = mk("div", "skill-param-cell skill-param-required");
    var reqL = mkt("label", "skill-param-required-label", "Required");
    var reqI = document.createElement("input");
    reqI.type = "checkbox"; reqI.checked = !!p.required;
    reqI.addEventListener("change", function() { state.parameters[idx].required = reqI.checked; invalidateTest(); });
    reqL.prepend(reqI);
    reqG.appendChild(reqL);
    row.appendChild(reqG);
    // remove
    var rmBtn = mkt("button", "btn-danger skill-param-remove", "Remove");
    rmBtn.addEventListener("click", function() {
      state.parameters.splice(idx, 1);
      renderParameters();
      invalidateTest(); refreshBindingsAndPreview();
    });
    row.appendChild(rmBtn);
    return row;
  }
  addParamBtn.addEventListener("click", function() {
    state.parameters.push({ name: "", type: "string", description: "", required: false });
    renderParameters();
    invalidateTest();
  });
  renderParameters();

  function renderOutputTarget() {
    outputTargetWrap.innerHTML = "";
    OUTPUT_TARGETS.forEach(function(opt) {
      var optRow = mk("label", "skill-form-output-target-row" + (opt.enabled ? "" : " is-disabled"));
      var radio = document.createElement("input");
      radio.type = "radio"; radio.name = "outputTarget";
      radio.value = opt.id;
      radio.checked = (state.outputTarget === opt.id);
      radio.disabled = !opt.enabled;
      radio.addEventListener("change", function() { state.outputTarget = opt.id; invalidateTest(); });
      optRow.appendChild(radio);
      var labelText = mk("span", "skill-form-output-target-label");
      labelText.textContent = opt.label;
      optRow.appendChild(labelText);
      var hintText = mk("span", "skill-form-output-target-hint");
      hintText.textContent = opt.enabled ? opt.hint : "(deferred to GA — " + opt.hint + ")";
      optRow.appendChild(hintText);
      outputTargetWrap.appendChild(optRow);
    });
  }
  renderOutputTarget();

  // ─── Test gate state ───────────────────────────────────────────
  var lastTestedSignature = null;
  function currentSignature() {
    return JSON.stringify([
      tplArea.serialize(),
      (nameInput.value || "").trim(),
      (descInput.value || "").trim(),
      JSON.stringify(state.parameters),
      state.outputTarget
    ]);
  }
  function invalidateTest() {
    lastTestedSignature = null;
    refreshSaveGate();
  }

  testBtn.addEventListener("click", async function() {
    var signatureAtStart = currentSignature();
    testBtn.disabled = true;
    var originalLabel = testBtn.textContent;
    testBtn.textContent = "Testing…";
    testOut.style.display = "block";
    testOut.className = "ai-skill-result skill-form-test-out running";
    testOut.textContent = "Running with current engagement…";
    try {
      var ctx = await buildRunCtx();
      var draftSkill = {
        skillId:        existing && existing.skillId      ? existing.skillId      : "skl-draft-1",
        label:          (nameInput.value || "Draft").trim(),
        version:        "1.0.0",
        promptTemplate: tplArea.serialize() || "Hello {{customer.name}}!",
        parameters:     state.parameters.slice(),
        outputContract: "free-text",
        outputTarget:   state.outputTarget
      };
      var params  = prefillParamValuesFor(state.parameters, ctx.engagement);
      // rc.7-arc-1 (2026-05-06): always-real per feedback_no_mocks.md.
      var provider = createRealLLMProvider();
      var envelope = await runSkill(draftSkill, ctx, provider, {
        params: params,
        runTimestamp: new Date().toISOString(),
        runIdSeed:    "skill-builder-test-" + draftSkill.skillId
      });
      testOut.innerHTML = "";
      testOut.className = "ai-skill-result skill-form-test-out ok";
      testOut.appendChild(mkt("div", "ai-skill-result-head",
        "Test output · " + (envelope.provenance && envelope.provenance.model || "unknown") + " (draft — not saved)"));
      var body = mk("pre", "ai-skill-result-body");
      body.textContent = typeof envelope.value === "string"
        ? envelope.value
        : JSON.stringify(envelope.value, null, 2);
      testOut.appendChild(body);
      if (currentSignature() === signatureAtStart) {
        lastTestedSignature = signatureAtStart;
        refreshSaveGate();
      }
    } catch (e) {
      testOut.innerHTML = "";
      testOut.className = "ai-skill-result skill-form-test-out err";
      testOut.textContent = (e instanceof ProviderNotConfiguredError)
        ? "Real provider not configured. Open Settings → AI Providers to set one, or switch the test selector to Mock."
        : "Test failed: " + (e.message || String(e));
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = originalLabel;
    }
  });

  // ─── Save gate + buttons ───────────────────────────────────────
  nameInput.addEventListener("input",  invalidateTest);
  descInput.addEventListener("input",  invalidateTest);

  var actions = mk("div", "form-actions");
  var cancelBtn = mkt("button", "btn-secondary", "Cancel");
  cancelBtn.addEventListener("click", function() { form.remove(); });
  var saveBtn = mkt("button", "btn-primary", existing ? "Save changes" : "Create skill");
  var saveHint = mkt("span", "save-gate-hint", "");

  function refreshSaveGate() {
    var needsTest = lastTestedSignature !== currentSignature();
    var isNewSkill = !existing;
    var gated = isNewSkill && needsTest;
    saveBtn.disabled = gated;
    if (gated) {
      saveBtn.classList.add("save-disabled");
      saveHint.textContent = lastTestedSignature === null
        ? "← New skill — click 'Test skill now' and verify the output before creating."
        : "← Changes detected — re-run the test to enable Create.";
      saveHint.className = "save-gate-hint save-gate-hint-error";
    } else if (needsTest) {
      saveBtn.classList.remove("save-disabled");
      saveHint.textContent = "⚠ Untested changes — saving without re-test is OK for tweaks; click 'Test skill now' first for behaviour changes.";
      saveHint.className = "save-gate-hint save-gate-hint-warn";
    } else {
      saveBtn.classList.remove("save-disabled");
      saveHint.textContent = lastTestedSignature === null
        ? "✓ Safe to save — run 'Test skill now' any time to verify."
        : "✓ Tested — safe to save.";
      saveHint.className = "save-gate-hint save-gate-hint-ok";
    }
  }
  refreshSaveGate();

  saveBtn.addEventListener("click", function() {
    var label = (nameInput.value || "").trim();
    var tpl   = (tplArea.serialize() || "").trim();
    if (!label) { alert("Label is required."); return; }
    if (!tpl)   { alert("Prompt template is required — click a field chip or type text."); return; }

    // skillId: existing keeps its id; new skills derive from label.
    var skillId = existing && existing.skillId
      ? existing.skillId
      : ("skl-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) + "-" + Math.floor(Math.random() * 1000));

    var draft = {
      skillId:         skillId,
      label:           label,
      description:     (descInput.value || "").trim(),
      promptTemplate:  tpl,
      parameters:      state.parameters.slice(),
      outputTarget:    state.outputTarget,
      outputContract:  "free-text"
    };
    var manifest = generateManifest();
    var result = saveV3Skill(draft, { manifest: manifest });
    if (!result.ok) {
      alert("Save failed: " + (result.errors || []).map(function(e) { return e.message || e; }).join("; "));
      return;
    }
    form.remove();
    renderList(list, onChange);
    if (onChange) onChange();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  actions.appendChild(saveHint);
  form.appendChild(actions);

  adminRoot.appendChild(form);
  nameInput.focus();
  refreshBindingsAndPreview();
}

// CARE-rewrite diff panel (preserved verbatim from v2 SkillAdmin).
function renderRefineDiff(host, draft, refined, onDecision) {
  host.innerHTML = "";
  host.appendChild(mkt("div", "refine-diff-title", "Refined with CARE framework — review before accepting"));
  var grid = mk("div", "refine-diff-grid");
  var left = mk("div", "refine-side");
  left.appendChild(mkt("div", "refine-side-head", "Your draft"));
  var leftBox = mk("pre", "refine-side-body"); leftBox.textContent = draft;
  left.appendChild(leftBox);
  grid.appendChild(left);

  var right = mk("div", "refine-side");
  right.appendChild(mkt("div", "refine-side-head", "Refined (editable)"));
  var rightBox = mk("textarea", "refine-side-body refine-side-edit");
  rightBox.value = refined;
  rightBox.rows = 10;
  right.appendChild(rightBox);
  grid.appendChild(right);
  host.appendChild(grid);

  var actions = mk("div", "form-actions");
  var keepBtn = mkt("button", "btn-secondary", "Keep my draft");
  keepBtn.addEventListener("click", function() { onDecision(null); });
  var acceptBtn = mkt("button", "btn-primary", "Replace my draft with refined");
  acceptBtn.addEventListener("click", function() { onDecision(rightBox.value); });
  actions.appendChild(keepBtn);
  actions.appendChild(acceptBtn);
  host.appendChild(actions);
}

// ─── chip palette helpers (engagement-wide v3 manifest) ─────────────
function buildPillEditorManifest(canvasManifest) {
  // Produce an array of { path, label, kind } the createPillEditor + chip
  // palette can render. Sources: sessionPaths + per-entity-kind ownPaths +
  // linkedPaths. Drop placeholder/duplicate paths.
  var out = [];
  (canvasManifest.sessionPaths || []).forEach(function(p) {
    out.push({ path: p.path, label: p.label || p.path, kind: p.type || "scalar", group: "Engagement-wide" });
  });
  Object.keys(canvasManifest.byEntityKind || {}).forEach(function(kind) {
    var entry = canvasManifest.byEntityKind[kind] || {};
    (entry.ownPaths || []).forEach(function(p) {
      out.push({ path: p.path, label: p.label || p.path, kind: p.type || "scalar", group: kind });
    });
    (entry.linkedPaths || []).forEach(function(p) {
      out.push({ path: p.path, label: (p.label || p.path) + " (linked)", kind: p.type || "scalar", group: kind + " (linked)" });
    });
  });
  return out;
}

function renderChipPalette(container, manifest, tplArea) {
  container.innerHTML = "";
  if (manifest.length === 0) {
    container.appendChild(mkt("div", "settings-help-inline",
      "No bindable paths declared — generateManifest() returned empty."));
    return;
  }
  // Group by `group` label.
  var groups = {};
  manifest.forEach(function(m) {
    if (!groups[m.group]) groups[m.group] = [];
    groups[m.group].push(m);
  });
  Object.keys(groups).forEach(function(g) {
    container.appendChild(mkt("div", "skill-chip-group-head", g));
    var groupWrap = mk("div", "skill-chip-group");
    groups[g].forEach(function(f) {
      var chip = mkt("button", "field-chip" + (f.kind === "array" ? " is-array" : ""), f.label);
      chip.type = "button";
      chip.title = "Click: insert labeled pill for " + f.label + ". Alt-click: insert bare {{" + f.path + "}} pill.";
      chip.addEventListener("click", function(e) {
        e.preventDefault();
        tplArea.insertPillAtCursor(f.path, e.altKey);
      });
      chip.setAttribute("data-path", f.path);
      groupWrap.appendChild(chip);
    });
    container.appendChild(groupWrap);
  });
}

function findPlaceholderPaths(template) {
  var seen = new Set();
  var out = [];
  var re = /\{\{([^{}]+?)\}\}/g;
  var m;
  while ((m = re.exec(template)) !== null) {
    var path = m[1].trim();
    if (seen.has(path)) continue;
    seen.add(path);
    out.push(path);
  }
  return out;
}

// Build a resolver context for the live preview / Test button. Falls back
// to the demo engagement when no active engagement exists yet.
async function buildRunCtx() {
  var eng = getActiveEngagement() || loadDemo();
  var dellCat = await loadCatalog("DELL_PRODUCT_TAXONOMY");
  return {
    engagement:      eng,
    customer:        eng.customer,
    engagementMeta:  eng.meta,
    catalogVersions: {
      DELL_PRODUCT_TAXONOMY: dellCat.catalogVersion,
      BUSINESS_DRIVERS:      "2026.04",
      ENV_CATALOG:           "2026.04"
    },
    dellTaxonomyIds: new Set(dellCat.entries.map(function(e) { return e.id; }))
  };
}

function buildEngagementCtxForPreview(parameters) {
  var eng = getActiveEngagement() || loadDemo();
  var ctx = {
    engagement:     eng,
    customer:       eng.customer,
    engagementMeta: eng.meta,
    context:        {}
  };
  // Pre-fill {{paramName}} placeholders with sensible sample values so the
  // preview reads like a real run rather than literal {{paramName}}.
  (parameters || []).forEach(function(p) {
    if (!p || !p.name) return;
    if (p.type === "entityId") {
      var key = entityKindKeyFromHint(p.description);
      if (key && eng[key] && eng[key].allIds && eng[key].allIds[0]) {
        var firstId = eng[key].allIds[0];
        ctx[p.name] = firstId;
        var entity = eng[key].byId && eng[key].byId[firstId];
        if (entity) ctx.context[p.name] = entity;
      } else {
        ctx[p.name] = "[entity-id]";
      }
    } else if (p.type === "number")  { ctx[p.name] = 0; }
      else if (p.type === "boolean") { ctx[p.name] = true; }
      else                            { ctx[p.name] = "[example]"; }
  });
  return ctx;
}

function prefillParamValuesFor(parameters, eng) {
  var out = {};
  (parameters || []).forEach(function(p) {
    if (!p || !p.name) return;
    if (p.type === "entityId") {
      var key = entityKindKeyFromHint(p.description);
      if (key && eng[key] && eng[key].allIds && eng[key].allIds[0]) {
        out[p.name] = eng[key].allIds[0];
      }
    } else if (p.type === "number")  { out[p.name] = 0; }
      else if (p.type === "boolean") { out[p.name] = true; }
      else                            { out[p.name] = "[example]"; }
  });
  return out;
}

function entityKindKeyFromHint(description) {
  if (typeof description !== "string") return null;
  var lower = description.toLowerCase();
  if (lower.indexOf("gap") >= 0)         return "gaps";
  if (lower.indexOf("driver") >= 0)      return "drivers";
  if (lower.indexOf("environment") >= 0) return "environments";
  if (lower.indexOf("instance") >= 0)    return "instances";
  return null;
}

// ─── Tiny form helpers (preserved from v2 SkillAdmin) ──────────────
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

function mkSelect(parent, label, options, value) {
  var group = mk("div", "skill-form-field");
  if (label) group.appendChild(mkt("label", "skill-form-label", label));
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
