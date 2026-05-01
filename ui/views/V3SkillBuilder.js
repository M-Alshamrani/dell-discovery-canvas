// ui/views/V3SkillBuilder.js — v3.0 · SPEC sec S7.5
//
// The 2-step Intent panel + manifest-driven chip palette + prompt
// editor + validate-on-save button. First user-visible v3.0 surface.
//
// Step 1: Scope picker  — radio: click-to-run | session-wide
// Step 2: Entity kind   — dropdown (driver / currentInstance /
//                          desiredInstance / gap / environment / project),
//                          ONLY shown when scope === click-to-run
// Chip palette          — filters dynamically based on (Step 1, Step 2)
//                          using manifest.sessionPaths + (when click-to-run)
//                          manifest.byEntityKind[entityKind].(ownPaths|linkedPaths)
// Prompt template       — textarea; click chip to insert {{path}} at cursor
// Validate button       — calls validateSkillSave; shows errors

import { generateManifest }   from "../../services/manifestGenerator.js";
import { validateSkillSave }  from "../../services/skillSaveValidator.js";
import { createEmptySkill }   from "../../schema/skill.js";

const ENTITY_KINDS = [
  { id: "driver",          label: "Driver" },
  { id: "currentInstance", label: "Current instance" },
  { id: "desiredInstance", label: "Desired instance" },
  { id: "gap",             label: "Gap" },
  { id: "environment",     label: "Environment" },
  { id: "project",         label: "Project" }
];

// Render the panel into `container`. Returns a destroy() function.
export function renderV3SkillBuilder(container) {
  // State, hoisted to the closure so chip clicks + validate button see it.
  let state = {
    skillType:      "session-wide",
    entityKind:     null,
    promptTemplate: "Hello {{customer.name}}!",
    lastValidation: null
  };
  const manifest = generateManifest();

  container.innerHTML = "";
  container.classList.add("v3-skill-builder");

  // ───── HEADER ─────
  const header = document.createElement("div");
  header.className = "v3-skill-builder-header";
  header.innerHTML = `
    <h2 class="v3-skill-builder-title">v3.0 Skill Builder</h2>
    <div class="v3-skill-builder-subtitle">
      Manifest-driven chip palette · save-time path validation · per SPEC §S7.5
    </div>
  `;
  container.appendChild(header);

  // ───── STEP 1: Scope picker ─────
  const step1 = document.createElement("section");
  step1.className = "v3-skill-builder-step";
  step1.innerHTML = `
    <div class="v3-skill-builder-step-eyebrow">STEP 1</div>
    <div class="v3-skill-builder-step-label">Scope</div>
    <div class="v3-skill-builder-radio-group" role="radiogroup" aria-label="Skill scope">
      <label class="v3-skill-builder-radio">
        <input type="radio" name="v3-scope" value="session-wide" checked />
        <span class="v3-skill-builder-radio-title">Session-wide</span>
        <span class="v3-skill-builder-radio-hint">Operates on the whole engagement</span>
      </label>
      <label class="v3-skill-builder-radio">
        <input type="radio" name="v3-scope" value="click-to-run" />
        <span class="v3-skill-builder-radio-title">Click-to-run</span>
        <span class="v3-skill-builder-radio-hint">Operates on one entity the user clicks</span>
      </label>
    </div>
  `;
  container.appendChild(step1);

  // ───── STEP 2: Entity kind picker (hidden when session-wide) ─────
  const step2 = document.createElement("section");
  step2.className = "v3-skill-builder-step v3-skill-builder-step2";
  step2.innerHTML = `
    <div class="v3-skill-builder-step-eyebrow">STEP 2</div>
    <div class="v3-skill-builder-step-label">Entity kind</div>
    <select class="v3-skill-builder-kind-picker" aria-label="Entity kind">
      ${ENTITY_KINDS.map(k => `<option value="${k.id}">${k.label}</option>`).join("")}
    </select>
  `;
  step2.style.display = "none";   // hidden until click-to-run
  container.appendChild(step2);

  // ───── CHIP PALETTE ─────
  const palette = document.createElement("section");
  palette.className = "v3-skill-builder-palette";
  palette.innerHTML = `
    <div class="v3-skill-builder-palette-label">Bindable paths (click to insert)</div>
    <div class="v3-skill-builder-chip-grid" role="list"></div>
  `;
  container.appendChild(palette);
  const chipGrid = palette.querySelector(".v3-skill-builder-chip-grid");

  // ───── PROMPT EDITOR ─────
  const editor = document.createElement("section");
  editor.className = "v3-skill-builder-editor";
  editor.innerHTML = `
    <label class="v3-skill-builder-editor-label" for="v3-prompt">Prompt template</label>
    <textarea id="v3-prompt" class="v3-skill-builder-textarea" rows="6">${state.promptTemplate}</textarea>
  `;
  container.appendChild(editor);
  const textarea = editor.querySelector("#v3-prompt");

  // ───── VALIDATE BUTTON + ERROR PANEL ─────
  const actions = document.createElement("section");
  actions.className = "v3-skill-builder-actions";
  actions.innerHTML = `
    <button type="button" class="v3-skill-builder-validate-btn">Validate template paths</button>
    <div class="v3-skill-builder-validation-result" aria-live="polite"></div>
  `;
  container.appendChild(actions);
  const validateBtn   = actions.querySelector(".v3-skill-builder-validate-btn");
  const resultPanel   = actions.querySelector(".v3-skill-builder-validation-result");

  // ───── HANDLERS ─────
  function refreshChips() {
    const paths = collectPaths(state, manifest);
    chipGrid.innerHTML = "";
    paths.forEach(p => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "v3-skill-builder-chip";
      chip.setAttribute("data-source", p.source);
      chip.setAttribute("role", "listitem");
      chip.title = p.label + " · " + p.source;
      chip.innerHTML = `
        <span class="v3-skill-builder-chip-source">${p.source}</span>
        <span class="v3-skill-builder-chip-path">${p.path}</span>
      `;
      chip.addEventListener("click", () => insertPathAtCursor(textarea, p.path));
      chipGrid.appendChild(chip);
    });
  }

  function refreshStep2Visibility() {
    step2.style.display = (state.skillType === "click-to-run") ? "" : "none";
  }

  step1.querySelectorAll('input[name="v3-scope"]').forEach(input => {
    input.addEventListener("change", e => {
      state.skillType = e.target.value;
      state.entityKind = (state.skillType === "click-to-run") ? "driver" : null;
      refreshStep2Visibility();
      refreshChips();
    });
  });
  step2.querySelector(".v3-skill-builder-kind-picker").addEventListener("change", e => {
    state.entityKind = e.target.value;
    refreshChips();
  });
  textarea.addEventListener("input", e => {
    state.promptTemplate = e.target.value;
  });
  validateBtn.addEventListener("click", () => {
    const draft = createEmptySkillDraft(state);
    const result = validateSkillSave(draft, manifest);
    state.lastValidation = result;
    renderValidationResult(resultPanel, result);
  });

  refreshChips();
  refreshStep2Visibility();

  return function destroy() {
    container.classList.remove("v3-skill-builder");
    container.innerHTML = "";
  };
}

function collectPaths(state, manifest) {
  const paths = [...(manifest.sessionPaths || [])];
  if (state.skillType === "click-to-run" && state.entityKind) {
    const kind = manifest.byEntityKind?.[state.entityKind];
    if (kind) {
      paths.push(...(kind.ownPaths    || []));
      paths.push(...(kind.linkedPaths || []));
    }
  }
  return paths;
}

function insertPathAtCursor(textarea, path) {
  const placeholder = "{{" + path + "}}";
  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after  = textarea.value.slice(end);
  textarea.value = before + placeholder + after;
  const cursor = start + placeholder.length;
  textarea.setSelectionRange(cursor, cursor);
  textarea.focus();
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function createEmptySkillDraft(state) {
  return createEmptySkill({
    skillId:        "skl-draft-1",
    label:          "Draft",
    skillType:      state.skillType,
    entityKind:     state.entityKind,
    promptTemplate: state.promptTemplate
  });
}

function renderValidationResult(panel, result) {
  panel.innerHTML = "";
  if (result.ok) {
    panel.classList.remove("v3-skill-builder-validation-result-error");
    panel.classList.add("v3-skill-builder-validation-result-ok");
    panel.textContent = "✓ All paths in the template resolve in the manifest.";
    return;
  }
  panel.classList.remove("v3-skill-builder-validation-result-ok");
  panel.classList.add("v3-skill-builder-validation-result-error");
  const list = document.createElement("ul");
  list.className = "v3-skill-builder-error-list";
  result.errors.forEach(err => {
    const li = document.createElement("li");
    li.className = "v3-skill-builder-error-item";
    li.innerHTML = `
      <div class="v3-skill-builder-error-path">{{${err.path}}}</div>
      <div class="v3-skill-builder-error-message">${err.message}</div>
      ${err.validPaths && err.validPaths.length
        ? `<details class="v3-skill-builder-error-suggestions">
            <summary>Available paths (${err.validPaths.length})</summary>
            <ul>
              ${err.validPaths.slice(0, 12).map(p => `<li><code>${p}</code></li>`).join("")}
              ${err.validPaths.length > 12 ? `<li>… and ${err.validPaths.length - 12} more</li>` : ""}
            </ul>
          </details>`
        : ""}
    `;
    list.appendChild(li);
  });
  panel.appendChild(list);
}
