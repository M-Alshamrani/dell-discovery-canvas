// ui/views/SkillBuilder.js — v3.1 · SPEC §S29.4 · simplified rebuild
//
// **Migration from v3.0**: this file was rewritten 2026-05-03 (rc.3 #4)
// per SPEC §S29. The previous 735-line builder assumed click-to-run +
// entityKind binding + a chip palette. v3.1 collapses to: name +
// description + prompt template + parameters[] + output_target +
// validate + mock-run preview. The Lab tab continues to host this
// surface until rc.3 #7 retires it in favor of the chat right-rail
// slide-over.
//
// Drops vs v3.0:
//   - Chip palette (engagement is auto-resolved; users don't pick paths)
//   - Scope picker (skillType: click-to-run | session-wide)
//   - Entity-kind dropdown (no click-to-run scope)
//   - 1-2-3 step wizard layout
// Keeps:
//   - Seed picker (load Dell mapping / Executive summary / CARE builder)
//   - Saved-skill picker (load + delete)
//   - Mock-run preview (deterministic, no provider call)
//   - Real-LLM run (via active provider; produces real output)
//   - Save with manifest-validate path checking
// Adds:
//   - Parameters editor (zero-or-more rows: name + type + description + required)
//   - Output target radio (chat-bubble enabled; deferred targets disabled)
//
// Authority: docs/v3.0/SPEC.md §S29.4 · docs/RULES.md §16 CH23.

import { generateManifest }      from "../../services/manifestGenerator.js";
import { validateSkillSave }     from "../../services/skillSaveValidator.js";
import { createEmptySkill, migrateSkillToV31 } from "../../schema/skill.js";
import { runSkill }              from "../../services/skillRunner.js";
import { resolveTemplate }       from "../../services/pathResolver.js";
import { createMockLLMProvider } from "../../services/mockLLMProvider.js";
import { loadDemo }              from "../../core/demoEngagement.js";
import { getActiveEngagement }   from "../../state/engagementStore.js";
import { loadCatalog }           from "../../services/catalogLoader.js";
import {
  SEED_SKILL_DELL_MAPPING,
  SEED_SKILL_EXECUTIVE_SUMMARY,
  SEED_SKILL_CARE_BUILDER
} from "../../core/v3SeedSkills.js";
import {
  saveV3Skill, loadV3Skills, loadV3SkillById, deleteV3Skill
} from "../../state/v3SkillStore.js";
import {
  createRealLLMProvider, getActiveProviderStatus, ProviderNotConfiguredError
} from "../../services/realLLMProvider.js";

// Migrate the seeds at module load so the form always sees v3.1 shape.
const SEED_SKILLS = [
  { id: "dell-mapping",       label: "Dell mapping (parameterized on Gap, structured Dell-product output)",
                              skill: migrateSkillToV31(SEED_SKILL_DELL_MAPPING) },
  { id: "executive-summary",  label: "Executive summary (engagement-wide, free-text)",
                              skill: migrateSkillToV31(SEED_SKILL_EXECUTIVE_SUMMARY) },
  { id: "care-builder",       label: "CARE prompt builder (engagement-wide, structured skill output)",
                              skill: migrateSkillToV31(SEED_SKILL_CARE_BUILDER) }
];

// Deterministic mock LLM responses keyed by seed skillId (so the
// preview is reproducible without burning provider credits).
const MOCK_RESPONSES_BY_SKILL_ID = {
  "dell-mapping": {
    model: "mock-claude-sonnet",
    text:  JSON.stringify({
      rationale: "Modernize storage with Dell PowerStore + protect against ransomware with PowerProtect Cyber Recovery.",
      products: ["powerstore", "powerprotect_cyber", "smartfabric_manager"]
    })
  },
  "executive-summary": {
    model: "mock-claude-sonnet",
    text:  "Acme Healthcare Group is positioned for a confident modernization push. The team has identified 8 gaps spanning data protection, storage, compute, and infrastructure layers — with cyber resilience the dominant theme. Recommend a 90-day kickoff focused on the High-urgency gaps in data protection (PPDM + Cyber Recovery) and storage (PowerStore + PowerScale)."
  },
  "care-builder": {
    model: "mock-claude-sonnet",
    text:  JSON.stringify({
      id:           "00000000-0000-4000-8000-000000000001",
      engagementId: "00000000-0000-4000-8000-000000000001",
      createdAt:    "2026-05-01T00:00:00.000Z",
      updatedAt:    "2026-05-01T00:00:00.000Z",
      skillId:      "skl-care-output-1",
      label:        "Generated CARE prompt",
      version:      "1.0.0",
      promptTemplate:       "CONTEXT: {{customer.name}} ({{customer.vertical}}). AUDIENCE: presales.\nREQUEST: 3-paragraph exec summary.",
      bindings:             [{ path: "customer.name", source: "session" }, { path: "customer.vertical", source: "session" }],
      outputContract:       "free-text",
      outputTarget:         "chat-bubble",
      parameters:           [],
      validatedAgainst:     "3.1",
      outdatedSinceVersion: null
    })
  }
};

// Output targets — only "chat-bubble" actively renders in v3.1.
// The other three are documented placeholders per SPEC §S29.7.
const OUTPUT_TARGETS = [
  { id: "chat-bubble",       label: "Chat bubble (markdown)",      enabled: true,  hint: "Free-text or structured output rendered as a chat message." },
  { id: "structured-card",   label: "Structured card",             enabled: false, hint: "Schema-typed data + render template. Deferred to rc.4." },
  { id: "reporting-panel",   label: "Reporting panel (visual)",    enabled: false, hint: "Visualization (heatmap, chart). Deferred to rc.4." },
  { id: "proposed-changes",  label: "Proposed changes (mutate)",   enabled: false, hint: "Mutation proposals with per-item approval. Deferred to rc.4." }
];

const PARAMETER_TYPES = [
  { id: "string",   label: "String" },
  { id: "number",   label: "Number" },
  { id: "boolean",  label: "Boolean" },
  { id: "entityId", label: "Entity (gap / driver / instance / environment)" }
];

// Render the panel into `container`. Returns a destroy() function.
export function renderSkillBuilder(container) {
  // v3.1 state shape — no skillType / entityKind. Single scope: prompt
  // + zero-or-more parameters supplied at invoke time.
  let state = {
    skillId:        "skl-draft-1",
    label:          "New skill",
    description:    "",
    promptTemplate: "Hello {{customer.name}}!",
    parameters:     [],
    outputTarget:   "chat-bubble",
    lastValidation: null,
    providerMode:   "mock"   // "mock" | "real"
  };
  const manifest = generateManifest();

  container.innerHTML = "";
  container.classList.add("skill-builder");

  // ───── HEADER ─────
  const header = document.createElement("div");
  header.className = "skill-builder-header";
  header.innerHTML = `
    <h2 class="skill-builder-title">Skill Builder</h2>
    <div class="skill-builder-subtitle">
      Author AI skills with bindable canvas paths, validate them at save time, and try a mock run before deploying.
    </div>
  `;
  container.appendChild(header);

  // ───── SEED SKILL PICKER ─────
  const seedPicker = document.createElement("section");
  seedPicker.className = "skill-builder-seed-picker";
  seedPicker.innerHTML = `
    <label class="skill-builder-seed-label" for="seed-picker">
      Start from a curated seed skill
    </label>
    <select id="seed-picker" class="skill-builder-seed-select">
      <option value="">— Build from scratch —</option>
      ${SEED_SKILLS.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.label)}</option>`).join("")}
    </select>
  `;
  container.appendChild(seedPicker);
  const seedSelect = seedPicker.querySelector("#seed-picker");

  // ───── SAVED SKILLS PICKER ─────
  const savedPicker = document.createElement("section");
  savedPicker.className = "skill-builder-saved-picker";
  savedPicker.innerHTML = `
    <label class="skill-builder-saved-label" for="saved-picker">
      Your saved skills <span class="skill-builder-saved-count"></span>
    </label>
    <div class="skill-builder-saved-row">
      <select id="saved-picker" class="skill-builder-seed-select">
        <option value="">— Pick a saved skill to load —</option>
      </select>
      <button type="button" class="skill-builder-saved-delete-btn"
              title="Delete the selected saved skill">Delete</button>
    </div>
  `;
  container.appendChild(savedPicker);
  const savedSelect    = savedPicker.querySelector("#saved-picker");
  const savedCountEl   = savedPicker.querySelector(".skill-builder-saved-count");
  const savedDeleteBtn = savedPicker.querySelector(".skill-builder-saved-delete-btn");

  function refreshSavedList() {
    const all = loadV3Skills();
    const ids = Object.keys(all);
    savedCountEl.textContent = ids.length ? "(" + ids.length + ")" : "(none yet)";
    const previous = savedSelect.value;
    savedSelect.innerHTML = '<option value="">— Pick a saved skill to load —</option>' +
      ids.map(id => {
        const s = all[id];
        const label = s.label || s.skillId;
        const scope = (s.parameters && s.parameters.length > 0)
          ? "parameterized (" + s.parameters.length + ")"
          : "engagement-wide";
        return `<option value="${escapeHtml(id)}">${escapeHtml(label)} · ${escapeHtml(scope)}</option>`;
      }).join("");
    if (ids.includes(previous)) savedSelect.value = previous;
  }
  refreshSavedList();

  // ───── META (skillId + label + description) ─────
  const meta = document.createElement("section");
  meta.className = "skill-builder-meta";
  meta.innerHTML = `
    <div class="skill-builder-meta-row">
      <div class="skill-builder-meta-cell">
        <label class="skill-builder-meta-label" for="skill-builder-skill-id">Skill ID</label>
        <input id="skill-builder-skill-id" class="skill-builder-meta-input" type="text"
               placeholder="skl-my-skill-1" value="${escapeHtml(state.skillId)}" />
      </div>
      <div class="skill-builder-meta-cell">
        <label class="skill-builder-meta-label" for="skill-builder-skill-label">Label</label>
        <input id="skill-builder-skill-label" class="skill-builder-meta-input" type="text"
               placeholder="My new skill" value="${escapeHtml(state.label)}" />
      </div>
    </div>
    <div class="skill-builder-meta-row">
      <div class="skill-builder-meta-cell skill-builder-meta-cell-wide">
        <label class="skill-builder-meta-label" for="skill-builder-description">Description (optional)</label>
        <input id="skill-builder-description" class="skill-builder-meta-input" type="text"
               placeholder="One-line description shown on the skill card" value="${escapeHtml(state.description)}" />
      </div>
    </div>
  `;
  container.appendChild(meta);
  const skillIdInput    = meta.querySelector("#skill-builder-skill-id");
  const skillLabelInput = meta.querySelector("#skill-builder-skill-label");
  const descriptionInput = meta.querySelector("#skill-builder-description");
  skillIdInput.addEventListener("input",    e => { state.skillId    = e.target.value; });
  skillLabelInput.addEventListener("input", e => { state.label      = e.target.value; });
  descriptionInput.addEventListener("input", e => { state.description = e.target.value; });

  // ───── PROMPT TEMPLATE ─────
  const editor = document.createElement("section");
  editor.className = "skill-builder-editor";
  editor.innerHTML = `
    <label class="skill-builder-editor-label" for="skill-builder-prompt">Prompt template</label>
    <div class="skill-builder-editor-hint">
      Reference engagement fields with double-brace placeholders such as <code>{{customer.name}}</code> or <code>{{drivers.allIds}}</code>. Parameters can be referenced by name; entity parameters expose their fields under the same name.
    </div>
    <textarea id="skill-builder-prompt" class="skill-builder-textarea" rows="8">${escapeHtml(state.promptTemplate)}</textarea>
  `;
  container.appendChild(editor);
  const textarea = editor.querySelector("#skill-builder-prompt");
  textarea.addEventListener("input", e => { state.promptTemplate = e.target.value; });

  // ───── PARAMETERS EDITOR ─────
  const paramSection = document.createElement("section");
  paramSection.className = "skill-builder-params";
  paramSection.innerHTML = `
    <div class="skill-builder-params-head">
      <label class="skill-builder-editor-label">Parameters <span class="skill-builder-params-count"></span></label>
      <button type="button" class="skill-builder-params-add">+ Add parameter</button>
    </div>
    <div class="skill-builder-params-hint">
      Zero or more values the user supplies at invocation time. Use <code>type: entityId</code> to pick a gap / driver / instance / environment from the engagement.
    </div>
    <div class="skill-builder-params-list" data-params-list></div>
  `;
  container.appendChild(paramSection);
  const paramsList = paramSection.querySelector("[data-params-list]");
  const paramsCountEl = paramSection.querySelector(".skill-builder-params-count");
  const paramsAddBtn  = paramSection.querySelector(".skill-builder-params-add");

  function paintParameters() {
    paramsList.innerHTML = "";
    paramsCountEl.textContent = state.parameters.length === 0
      ? "(none)" : "(" + state.parameters.length + ")";
    state.parameters.forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = "skill-builder-param-row";
      row.innerHTML = `
        <input type="text" class="skill-builder-param-name" placeholder="name" value="${escapeHtml(p.name || "")}" />
        <select class="skill-builder-param-type">
          ${PARAMETER_TYPES.map(t =>
            `<option value="${t.id}"${p.type === t.id ? " selected" : ""}>${escapeHtml(t.label)}</option>`
          ).join("")}
        </select>
        <input type="text" class="skill-builder-param-desc" placeholder="description (e.g. 'Pick a gap')" value="${escapeHtml(p.description || "")}" />
        <label class="skill-builder-param-required">
          <input type="checkbox"${p.required ? " checked" : ""} /> required
        </label>
        <button type="button" class="skill-builder-param-delete" title="Remove parameter">×</button>
      `;
      const nameInp = row.querySelector(".skill-builder-param-name");
      const typeInp = row.querySelector(".skill-builder-param-type");
      const descInp = row.querySelector(".skill-builder-param-desc");
      const reqInp  = row.querySelector(".skill-builder-param-required input");
      const delBtn  = row.querySelector(".skill-builder-param-delete");
      nameInp.addEventListener("input", e => { state.parameters[idx].name        = e.target.value; });
      typeInp.addEventListener("change", e => { state.parameters[idx].type        = e.target.value; });
      descInp.addEventListener("input", e => { state.parameters[idx].description = e.target.value; });
      reqInp.addEventListener("change",  e => { state.parameters[idx].required    = e.target.checked; });
      delBtn.addEventListener("click", () => {
        state.parameters.splice(idx, 1);
        paintParameters();
      });
      paramsList.appendChild(row);
    });
  }
  paintParameters();
  paramsAddBtn.addEventListener("click", () => {
    state.parameters.push({ name: "", type: "string", description: "", required: false });
    paintParameters();
  });

  // ───── OUTPUT TARGET ─────
  const targetSection = document.createElement("section");
  targetSection.className = "skill-builder-output-target";
  targetSection.innerHTML = `
    <label class="skill-builder-editor-label">Output target</label>
    <div class="skill-builder-output-hint">
      What the skill produces. Only <strong>Chat bubble</strong> is implemented in v3.1; the others are documented placeholders for rc.4.
    </div>
    <div class="skill-builder-output-grid">
      ${OUTPUT_TARGETS.map(t => `
        <label class="skill-builder-output-option${t.enabled ? "" : " is-disabled"}" title="${escapeHtml(t.hint)}">
          <input type="radio" name="skill-builder-target" value="${t.id}"
                 ${t.id === state.outputTarget ? "checked" : ""}
                 ${t.enabled ? "" : "disabled"} />
          <span>${escapeHtml(t.label)}</span>
        </label>
      `).join("")}
    </div>
  `;
  container.appendChild(targetSection);
  targetSection.querySelectorAll('input[name="skill-builder-target"]').forEach(input => {
    input.addEventListener("change", e => { state.outputTarget = e.target.value; });
  });

  // ───── ACTIONS ─────
  const actions = document.createElement("section");
  actions.className = "skill-builder-actions";
  actions.innerHTML = `
    <div class="skill-builder-provider-row">
      <label class="skill-builder-provider-radio">
        <input type="radio" name="skill-builder-provider" value="mock" checked /> Mock LLM
      </label>
      <label class="skill-builder-provider-radio">
        <input type="radio" name="skill-builder-provider" value="real" /> Real (active provider)
      </label>
      <span class="skill-builder-provider-status" data-provider-status></span>
    </div>
    <div class="skill-builder-actions-row">
      <button type="button" class="skill-builder-validate-btn">Validate</button>
      <button type="button" class="skill-builder-run-btn">Run skill (mock LLM)</button>
      <button type="button" class="skill-builder-save-btn btn-primary">Save skill</button>
    </div>
    <div class="skill-builder-result-panel" data-result-panel></div>
    <div class="skill-builder-run-result" data-run-result></div>
    <div class="skill-builder-save-result" data-save-result></div>
  `;
  container.appendChild(actions);

  const validateBtn      = actions.querySelector(".skill-builder-validate-btn");
  const runBtn           = actions.querySelector(".skill-builder-run-btn");
  const saveBtn          = actions.querySelector(".skill-builder-save-btn");
  const resultPanel      = actions.querySelector("[data-result-panel]");
  const runResultPanel   = actions.querySelector("[data-run-result]");
  const saveResultPanel  = actions.querySelector("[data-save-result]");
  const providerStatusEl = actions.querySelector("[data-provider-status]");

  function refreshProviderStatus() {
    if (state.providerMode === "real") {
      const status = getActiveProviderStatus();
      providerStatusEl.innerHTML = escapeHtml(status.label) + " " + (status.ready
        ? '<span class="skill-builder-provider-ready">ready</span>'
        : '<span class="skill-builder-provider-warn">' + escapeHtml(status.reason || "not configured") + "</span>");
      runBtn.textContent = state.providerMode === "real" ? "Run skill (real LLM)" : "Run skill (mock LLM)";
    } else {
      providerStatusEl.textContent = "";
      runBtn.textContent = "Run skill (mock LLM)";
    }
  }
  refreshProviderStatus();
  actions.querySelectorAll('input[name="skill-builder-provider"]').forEach(input => {
    input.addEventListener("change", e => { state.providerMode = e.target.value; refreshProviderStatus(); });
  });

  // ───── SEED LOAD ─────
  seedSelect.addEventListener("change", () => {
    const seedId = seedSelect.value;
    if (!seedId) return;
    const seedEntry = SEED_SKILLS.find(s => s.id === seedId);
    if (!seedEntry) return;
    const seed = seedEntry.skill;   // already migrated to v3.1
    state.skillId        = seed.skillId;
    state.label          = seed.label;
    state.description    = seed.description || "";
    state.promptTemplate = seed.promptTemplate;
    state.parameters     = JSON.parse(JSON.stringify(seed.parameters || []));
    state.outputTarget   = seed.outputTarget || "chat-bubble";
    skillIdInput.value     = state.skillId;
    skillLabelInput.value  = state.label;
    descriptionInput.value = state.description;
    textarea.value         = state.promptTemplate;
    paintParameters();
    targetSection.querySelectorAll('input[name="skill-builder-target"]').forEach(inp => {
      inp.checked = inp.value === state.outputTarget;
    });
    resultPanel.innerHTML = ""; runResultPanel.innerHTML = ""; saveResultPanel.innerHTML = "";
  });

  // ───── SAVED SKILL LOAD ─────
  savedSelect.addEventListener("change", () => {
    const id = savedSelect.value;
    if (!id) return;
    const saved = loadV3SkillById(id);   // already migrated by the store
    if (!saved) return;
    state.skillId        = saved.skillId;
    state.label          = saved.label;
    state.description    = saved.description || "";
    state.promptTemplate = saved.promptTemplate;
    state.parameters     = JSON.parse(JSON.stringify(saved.parameters || []));
    state.outputTarget   = saved.outputTarget || "chat-bubble";
    skillIdInput.value     = state.skillId;
    skillLabelInput.value  = state.label;
    descriptionInput.value = state.description;
    textarea.value         = state.promptTemplate;
    paintParameters();
    targetSection.querySelectorAll('input[name="skill-builder-target"]').forEach(inp => {
      inp.checked = inp.value === state.outputTarget;
    });
    resultPanel.innerHTML = ""; runResultPanel.innerHTML = ""; saveResultPanel.innerHTML = "";
  });

  savedDeleteBtn.addEventListener("click", () => {
    const id = savedSelect.value;
    if (!id) return;
    const result = deleteV3Skill(id);
    refreshSavedList();
    saveResultPanel.innerHTML = result.ok
      ? '<div class="skill-builder-save-success">Deleted ' + escapeHtml(id) + "</div>"
      : '<div class="skill-builder-save-error">Delete failed: ' + escapeHtml(result.error || "") + "</div>";
  });

  // ───── VALIDATE ─────
  validateBtn.addEventListener("click", () => {
    const draft = createEmptySkill({
      skillId:        state.skillId || "skl-draft-1",
      label:          state.label || "Draft",
      promptTemplate: state.promptTemplate,
      parameters:     state.parameters,
      outputTarget:   state.outputTarget
    });
    const result = validateSkillSave(draft, manifest);
    state.lastValidation = result;
    renderValidationResult(resultPanel, result);
  });

  // ───── RUN (mock OR real) ─────
  runBtn.addEventListener("click", async () => {
    runResultPanel.innerHTML = '<div class="skill-builder-run-pending">Running…</div>';
    try {
      const eng = getActiveEngagement() || loadDemo();
      const dellCat = await loadCatalog("DELL_PRODUCT_TAXONOMY");
      const catalogVersions = {
        DELL_PRODUCT_TAXONOMY: dellCat.catalogVersion,
        BUSINESS_DRIVERS:      "2026.04",
        ENV_CATALOG:           "2026.04"
      };
      const ctx = {
        engagement:      eng,
        customer:        eng.customer,
        engagementMeta:  eng.meta,
        catalogVersions,
        dellTaxonomyIds: new Set(dellCat.entries.map(e => e.id))
      };

      // Prefill parameter values: entityId → first entity of the
      // hint kind from the engagement; primitives → "[example]".
      const params = {};
      for (const p of state.parameters) {
        if (p.type === "entityId") {
          const kindKey = entityKindKeyFromHint(p.description);
          if (kindKey && eng[kindKey]?.allIds?.length) {
            params[p.name] = eng[kindKey].allIds[0];
          }
        } else if (p.type === "number")  { params[p.name] = 0; }
          else if (p.type === "boolean") { params[p.name] = true; }
          else                            { params[p.name] = "[example]"; }
      }

      const skill = createEmptySkill({
        skillId:        state.skillId || "skl-draft-1",
        label:          state.label || "Draft",
        promptTemplate: state.promptTemplate,
        parameters:     state.parameters,
        outputTarget:   state.outputTarget
      });

      const provider = state.providerMode === "real"
        ? createRealLLMProvider()
        : createMockLLMProvider({
            defaultResponse: MOCK_RESPONSES_BY_SKILL_ID[state.skillId]
                          || { model: "mock-claude-sonnet", text: "(mock response — no canned text for skillId='" + state.skillId + "')" }
          });

      // Resolve template once for display.
      let augmentedCtx = { ...ctx };
      for (const p of state.parameters) {
        if (!(p.name in params)) continue;
        augmentedCtx[p.name] = params[p.name];
        if (p.type === "entityId" && typeof params[p.name] === "string") {
          const eKey = entityKindKeyFromHint(p.description);
          const eByCol = eKey && eng[eKey]?.byId?.[params[p.name]];
          if (eByCol) {
            if (!augmentedCtx.context) augmentedCtx.context = {};
            augmentedCtx.context[p.name] = eByCol;
          }
        }
      }
      const resolvedPrompt = resolveTemplate(state.promptTemplate, augmentedCtx, { skillId: skill.skillId });
      const envelope = await runSkill(skill, ctx, provider, {
        params,
        runTimestamp: "2026-05-03T00:00:00.000Z",
        runIdSeed:    "skill-builder-run-" + state.skillId
      });
      renderRunResult(runResultPanel, state.skillId, state, { resolvedPrompt, envelope });
    } catch (e) {
      if (e instanceof ProviderNotConfiguredError) {
        runResultPanel.innerHTML =
          '<div class="skill-builder-run-error">Real provider not configured. Open Settings → Providers to set one, or switch to Mock LLM.</div>';
      } else {
        runResultPanel.innerHTML =
          '<div class="skill-builder-run-error">' + escapeHtml(String(e && e.message || e)) + "</div>";
      }
    }
  });

  // ───── SAVE ─────
  saveBtn.addEventListener("click", () => {
    const draft = {
      skillId:        state.skillId,
      label:          state.label,
      description:    state.description,
      promptTemplate: state.promptTemplate,
      parameters:     state.parameters,
      outputTarget:   state.outputTarget,
      outputContract: "free-text"
    };
    const result = saveV3Skill(draft, { manifest });
    renderSaveResult(saveResultPanel, result);
    if (result.ok) refreshSavedList();
  });

  // ───── DESTROY ─────
  return function destroy() { container.innerHTML = ""; };
}

// Map a parameter description hint to an engagement collection key.
//   "Pick a gap" → "gaps"; "Pick a driver" → "drivers"; etc.
function entityKindKeyFromHint(description) {
  if (typeof description !== "string") return null;
  const lower = description.toLowerCase();
  if (lower.includes("gap"))         return "gaps";
  if (lower.includes("driver"))      return "drivers";
  if (lower.includes("environment")) return "environments";
  if (lower.includes("instance"))    return "instances";
  return null;
}

function renderRunResult(panel, skillId, state, { resolvedPrompt, envelope }) {
  if (!envelope) {
    panel.innerHTML = '<div class="skill-builder-run-error">Run produced no envelope.</div>';
    return;
  }
  const valueHtml = typeof envelope.value === "string"
    ? '<pre class="skill-builder-run-text">' + escapeHtml(envelope.value) + "</pre>"
    : '<pre class="skill-builder-run-text">' + escapeHtml(JSON.stringify(envelope.value, null, 2)) + "</pre>";
  panel.innerHTML = `
    <div class="skill-builder-run-head">
      Run output · validation: <strong>${escapeHtml(envelope.provenance.validationStatus)}</strong>
      · model: ${escapeHtml(envelope.provenance.model)}
    </div>
    <details class="skill-builder-run-resolved">
      <summary>Resolved prompt</summary>
      <pre class="skill-builder-run-text">${escapeHtml(resolvedPrompt)}</pre>
    </details>
    <div class="skill-builder-run-output">${valueHtml}</div>
  `;
}

function renderSaveResult(panel, result) {
  if (result.ok) {
    panel.innerHTML = '<div class="skill-builder-save-success">' +
      "✓ Saved as " + escapeHtml(result.skill.skillId) + "</div>";
  } else {
    panel.innerHTML = '<div class="skill-builder-save-error"><strong>Save blocked</strong>' +
      '<ul class="skill-builder-save-errors">' +
      result.errors.map(e =>
        "<li>" + escapeHtml(e.path || "(root)") + ": " + escapeHtml(e.message || JSON.stringify(e)) + "</li>"
      ).join("") + "</ul></div>";
  }
}

function renderValidationResult(panel, result) {
  if (result.ok) {
    panel.innerHTML = '<div class="skill-builder-validate-success">✓ Template paths valid; ready to save.</div>';
  } else {
    panel.innerHTML = '<div class="skill-builder-validate-error"><strong>Validation failed</strong>' +
      '<ul class="skill-builder-validate-errors">' +
      result.errors.map(e =>
        "<li>" + escapeHtml(e.path || "(root)") + ": " + escapeHtml(e.message || JSON.stringify(e)) +
        (Array.isArray(e.validPaths) && e.validPaths.length > 0
          ? '<details class="skill-builder-valid-paths"><summary>Valid paths</summary><pre>' +
            escapeHtml(e.validPaths.join("\n")) + "</pre></details>"
          : "") +
        "</li>"
      ).join("") + "</ul></div>";
  }
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
