// ui/views/SkillBuilder.js — SPEC sec S7.5 (v3.0 lineage)
//
// The 2-step Intent panel + manifest-driven chip palette + prompt
// editor + validate + RUN flow. First user-visible v3.0 surface.
//
// Step 1: Scope picker  — radio: click-to-run | session-wide
// Step 2: Entity kind   — dropdown (driver / currentInstance /
//                          desiredInstance / gap / environment / project),
//                          ONLY shown when scope === click-to-run
// Chip palette          — filters dynamically based on (Step 1, Step 2)
// Prompt template       — textarea; click chip to insert {{path}} at cursor
// Validate button       — calls validateSkillSave; shows errors
// Load seed skill       — pre-fill the form with one of the 3 production-
//                          critical seeds (SPEC sec S7.4.3 / Q3 resolution)
// Run skill (mock LLM)  — execute via skillRunner against the reference
//                          engagement; render the resulting envelope
//                          (resolved prompt + LLM response + provenance)

import { generateManifest }    from "../../services/manifestGenerator.js";
import { validateSkillSave }   from "../../services/skillSaveValidator.js";
import { createEmptySkill }    from "../../schema/skill.js";
import { runSkill }            from "../../services/skillRunner.js";
import { resolveTemplate }     from "../../services/pathResolver.js";
import { createMockLLMProvider } from "../../services/mockLLMProvider.js";
import { loadDemo } from "../../core/demoEngagement.js";
import { getActiveEngagement } from "../../state/engagementStore.js";
import { loadCatalog }         from "../../services/catalogLoader.js";
import {
  SEED_SKILL_DELL_MAPPING,
  SEED_SKILL_EXECUTIVE_SUMMARY,
  SEED_SKILL_CARE_BUILDER
} from "../../core/v3SeedSkills.js";
import {
  saveV3Skill,
  loadV3Skills,
  loadV3SkillById,
  deleteV3Skill
} from "../../state/v3SkillStore.js";
import {
  createRealLLMProvider,
  getActiveProviderStatus,
  ProviderNotConfiguredError
} from "../../services/realLLMProvider.js";

const SEED_SKILLS = [
  { id: "dell-mapping",       label: "Dell mapping (click-to-run on Gap, structured)", skill: SEED_SKILL_DELL_MAPPING },
  { id: "executive-summary",  label: "Executive summary (session-wide, free-text)",     skill: SEED_SKILL_EXECUTIVE_SUMMARY },
  { id: "care-builder",       label: "CARE prompt builder (session-wide, structured)",  skill: SEED_SKILL_CARE_BUILDER }
];

// Canned mock LLM responses keyed by seed skillId so runs are
// deterministic for demo purposes. Real LLM provider hookup is the
// next slice; this proves the runtime end-to-end.
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
    text:  [
      "Acme Financial Services is positioned for a confident modernization push. Across 200 instances",
      "spanning compute, storage, data protection, virtualization, infrastructure, and workload layers,",
      "the team has identified 12 gaps with mixed urgency. Modernization is the dominant theme, with",
      "replace and consolidate dispositions concentrated in compute.",
      "",
      "Cyber resilience is a near-term concern: open High-urgency gaps suggest a 90-day window before",
      "the next external audit. The Dell taxonomy points to PowerProtect Cyber Recovery as the canonical",
      "answer; the engagement also surfaces opportunity for PowerStore consolidation across 3 envs.",
      "",
      "Recommend a 90-day kickoff focused on the High-urgency gaps in storage and compute, with a",
      "parallel discovery track for the workload layer's cross-environment dependencies."
    ].join("\n")
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
      skillType:    "session-wide",
      entityKind:   null,
      promptTemplate:       "CONTEXT: {{customer.name}} ({{customer.vertical}}). AUDIENCE: presales.\nREQUEST: 3-paragraph exec summary.",
      bindings:             [{ path: "customer.name", source: "session" }, { path: "customer.vertical", source: "session" }],
      outputContract:       "free-text",
      validatedAgainst:     "3.0",
      outdatedSinceVersion: null
    })
  }
};

const ENTITY_KINDS = [
  { id: "driver",          label: "Driver" },
  { id: "currentInstance", label: "Current instance" },
  { id: "desiredInstance", label: "Desired instance" },
  { id: "gap",             label: "Gap" },
  { id: "environment",     label: "Environment" },
  { id: "project",         label: "Project" }
];

// Render the panel into `container`. Returns a destroy() function.
export function renderSkillBuilder(container) {
  // State, hoisted to the closure so chip clicks + validate button see it.
  let state = {
    skillType:      "session-wide",
    entityKind:     null,
    promptTemplate: "Hello {{customer.name}}!",
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
    <h2 class="skill-builder-title">Skill Builder Lab</h2>
    <div class="skill-builder-subtitle">
      Manifest-driven chip palette · save-time path validation · mock-LLM run · per SPEC §S7.5
    </div>
  `;
  container.appendChild(header);

  // ───── SEED SKILL PICKER ─────
  const seedPicker = document.createElement("section");
  seedPicker.className = "skill-builder-seed-picker";
  seedPicker.innerHTML = `
    <label class="skill-builder-seed-label" for="seed-picker">
      Load production-critical seed (per <code>OPEN_QUESTIONS_RESOLVED.md</code> Q3)
    </label>
    <select id="seed-picker" class="skill-builder-seed-select">
      <option value="">— Build from scratch —</option>
      ${SEED_SKILLS.map(s => `<option value="${s.id}">${s.label}</option>`).join("")}
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
        const scope = s.skillType === "click-to-run" ? (s.entityKind || "click-to-run") : "session-wide";
        return `<option value="${id}">${escapeHtml(label)} · ${escapeHtml(scope)}</option>`;
      }).join("");
    if (ids.includes(previous)) savedSelect.value = previous;
  }
  refreshSavedList();

  // ───── STEP 1: Scope picker ─────
  const step1 = document.createElement("section");
  step1.className = "skill-builder-step";
  step1.innerHTML = `
    <div class="skill-builder-step-eyebrow">STEP 1</div>
    <div class="skill-builder-step-label">Scope</div>
    <div class="skill-builder-radio-group" role="radiogroup" aria-label="Skill scope">
      <label class="skill-builder-radio">
        <input type="radio" name="v3-scope" value="session-wide" checked />
        <span class="skill-builder-radio-title">Session-wide</span>
        <span class="skill-builder-radio-hint">Operates on the whole engagement</span>
      </label>
      <label class="skill-builder-radio">
        <input type="radio" name="v3-scope" value="click-to-run" />
        <span class="skill-builder-radio-title">Click-to-run</span>
        <span class="skill-builder-radio-hint">Operates on one entity the user clicks</span>
      </label>
    </div>
  `;
  container.appendChild(step1);

  // ───── STEP 2: Entity kind picker (hidden when session-wide) ─────
  const step2 = document.createElement("section");
  step2.className = "skill-builder-step skill-builder-step2";
  step2.innerHTML = `
    <div class="skill-builder-step-eyebrow">STEP 2</div>
    <div class="skill-builder-step-label">Entity kind</div>
    <select class="skill-builder-kind-picker" aria-label="Entity kind">
      ${ENTITY_KINDS.map(k => `<option value="${k.id}">${k.label}</option>`).join("")}
    </select>
  `;
  step2.style.display = "none";   // hidden until click-to-run
  container.appendChild(step2);

  // ───── CHIP PALETTE ─────
  const palette = document.createElement("section");
  palette.className = "skill-builder-palette";
  palette.innerHTML = `
    <div class="skill-builder-palette-label">Bindable paths (click to insert)</div>
    <div class="skill-builder-chip-grid" role="list"></div>
  `;
  container.appendChild(palette);
  const chipGrid = palette.querySelector(".skill-builder-chip-grid");

  // ───── PROMPT EDITOR ─────
  const editor = document.createElement("section");
  editor.className = "skill-builder-editor";
  editor.innerHTML = `
    <label class="skill-builder-editor-label" for="v3-prompt">Prompt template</label>
    <textarea id="v3-prompt" class="skill-builder-textarea" rows="6">${state.promptTemplate}</textarea>
  `;
  container.appendChild(editor);
  const textarea = editor.querySelector("#v3-prompt");

  // ───── SKILL META FIELDS (skillId + label) ─────
  const meta = document.createElement("section");
  meta.className = "skill-builder-meta";
  meta.innerHTML = `
    <div class="skill-builder-meta-row">
      <div class="skill-builder-meta-field">
        <label class="skill-builder-meta-label" for="v3-skill-id">skillId</label>
        <input id="v3-skill-id" class="skill-builder-meta-input" type="text"
               placeholder="skl-my-skill-1" />
      </div>
      <div class="skill-builder-meta-field skill-builder-meta-field-grow">
        <label class="skill-builder-meta-label" for="v3-skill-label">label</label>
        <input id="v3-skill-label" class="skill-builder-meta-input" type="text"
               placeholder="My new skill" />
      </div>
    </div>
  `;
  container.appendChild(meta);
  const skillIdInput    = meta.querySelector("#v3-skill-id");
  const skillLabelInput = meta.querySelector("#v3-skill-label");

  // ───── VALIDATE + RUN + SAVE BUTTONS + PROVIDER TOGGLE + PANELS ─────
  const actions = document.createElement("section");
  actions.className = "skill-builder-actions";
  const initialStatus = getActiveProviderStatus();
  actions.innerHTML = `
    <div class="skill-builder-provider-row" role="radiogroup" aria-label="LLM provider">
      <label class="skill-builder-provider-label">
        <input type="radio" name="v3-provider" value="mock" checked />
        <span class="skill-builder-provider-name">Mock LLM</span>
        <span class="skill-builder-provider-meta">canned responses, no key needed</span>
      </label>
      <label class="skill-builder-provider-label">
        <input type="radio" name="v3-provider" value="real" />
        <span class="skill-builder-provider-name">Real LLM</span>
        <span class="skill-builder-provider-meta skill-builder-provider-status">
          ${escapeHtml(initialStatus.label)} ${initialStatus.ready
              ? `<span class="prov-status prov-status-valid">READY</span>`
              : `<span class="prov-status prov-status-invalid">NOT CONFIGURED</span>`}
        </span>
      </label>
    </div>
    <div class="skill-builder-actions-row">
      <button type="button" class="skill-builder-validate-btn">Validate template paths</button>
      <button type="button" class="skill-builder-run-btn">Run skill</button>
      <button type="button" class="skill-builder-save-btn">Save skill</button>
    </div>
    <div class="skill-builder-validation-result" aria-live="polite"></div>
    <div class="skill-builder-save-result" aria-live="polite"></div>
    <div class="skill-builder-run-result" aria-live="polite"></div>
  `;
  container.appendChild(actions);
  const validateBtn    = actions.querySelector(".skill-builder-validate-btn");
  const runBtn         = actions.querySelector(".skill-builder-run-btn");
  const saveBtn        = actions.querySelector(".skill-builder-save-btn");
  const resultPanel    = actions.querySelector(".skill-builder-validation-result");
  const saveResultPanel = actions.querySelector(".skill-builder-save-result");
  const runResultPanel  = actions.querySelector(".skill-builder-run-result");
  const providerStatusEl = actions.querySelector(".skill-builder-provider-status");

  // Provider radio: switches state.providerMode. The Run handler reads
  // it; Mock path uses the canned responses, Real path uses the v2.x
  // chatCompletion adapter.
  actions.querySelectorAll('input[name="v3-provider"]').forEach(input => {
    input.addEventListener("change", e => {
      state.providerMode = e.target.value;
      // Re-fetch readiness in case the user just opened AI Settings + saved.
      const status = getActiveProviderStatus();
      providerStatusEl.innerHTML = escapeHtml(status.label) + " " + (status.ready
        ? '<span class="prov-status prov-status-valid">READY</span>'
        : '<span class="prov-status prov-status-invalid">NOT CONFIGURED</span>');
      runBtn.textContent = state.providerMode === "real" ? "Run skill (real LLM)" : "Run skill (mock LLM)";
    });
  });
  // Initial label
  runBtn.textContent = "Run skill (mock LLM)";

  // ───── HANDLERS ─────
  function refreshChips() {
    const paths = collectPaths(state, manifest);
    chipGrid.innerHTML = "";
    paths.forEach(p => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "skill-builder-chip";
      chip.setAttribute("data-source", p.source);
      chip.setAttribute("role", "listitem");
      chip.title = p.label + " · " + p.source;
      chip.innerHTML = `
        <span class="skill-builder-chip-source">${p.source}</span>
        <span class="skill-builder-chip-path">${p.path}</span>
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
  step2.querySelector(".skill-builder-kind-picker").addEventListener("change", e => {
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

  // Seed-skill picker: pre-fill state + UI from one of 3 seeds
  seedSelect.addEventListener("change", e => {
    const id = e.target.value;
    if (!id) return;
    const entry = SEED_SKILLS.find(s => s.id === id);
    if (!entry) return;
    const seed = entry.skill;
    state.skillType      = seed.skillType;
    state.entityKind     = seed.entityKind || null;
    state.promptTemplate = seed.promptTemplate;
    // Sync UI
    step1.querySelectorAll('input[name="v3-scope"]').forEach(inp => {
      inp.checked = (inp.value === seed.skillType);
    });
    if (seed.entityKind) {
      step2.querySelector(".skill-builder-kind-picker").value = seed.entityKind;
    }
    textarea.value = seed.promptTemplate;
    refreshStep2Visibility();
    refreshChips();
    // Clear stale results
    resultPanel.classList.remove("skill-builder-validation-result-ok",
                                 "skill-builder-validation-result-error");
    resultPanel.innerHTML = "";
    runResultPanel.innerHTML = "";
  });

  // Save skill: extract bindings from the template via the manifest,
  // SkillSchema-validate, persist to localStorage. Refresh saved list.
  saveBtn.addEventListener("click", () => {
    const draft = {
      skillId:        (skillIdInput.value || "").trim(),
      label:          (skillLabelInput.value || "").trim() || "Untitled skill",
      skillType:      state.skillType,
      entityKind:     state.entityKind,
      promptTemplate: state.promptTemplate,
      outputContract: "free-text"
    };
    if (!draft.skillId) {
      renderSaveResult(saveResultPanel, {
        ok: false,
        errors: [{ message: "skillId is required (e.g. \"skl-my-skill-1\")" }]
      });
      return;
    }
    const result = saveV3Skill(draft, { manifest });
    renderSaveResult(saveResultPanel, result);
    if (result.ok) refreshSavedList();
  });

  // Load a saved skill into the form
  savedSelect.addEventListener("change", e => {
    const id = e.target.value;
    if (!id) return;
    const saved = loadV3SkillById(id);
    if (!saved) return;
    state.skillType      = saved.skillType;
    state.entityKind     = saved.entityKind || null;
    state.promptTemplate = saved.promptTemplate;
    skillIdInput.value    = saved.skillId;
    skillLabelInput.value = saved.label;
    // Sync UI
    step1.querySelectorAll('input[name="v3-scope"]').forEach(inp => {
      inp.checked = (inp.value === saved.skillType);
    });
    if (saved.entityKind) {
      step2.querySelector(".skill-builder-kind-picker").value = saved.entityKind;
    }
    textarea.value = saved.promptTemplate;
    // Reset the seed picker (loaded saved -> not from seed)
    seedSelect.value = "";
    refreshStep2Visibility();
    refreshChips();
    // Clear stale results
    resultPanel.innerHTML = "";
    resultPanel.classList.remove("skill-builder-validation-result-ok",
                                 "skill-builder-validation-result-error");
    saveResultPanel.innerHTML = "";
    runResultPanel.innerHTML = "";
  });

  // Delete saved skill
  savedDeleteBtn.addEventListener("click", () => {
    const id = savedSelect.value;
    if (!id) {
      renderSaveResult(saveResultPanel, {
        ok: false,
        errors: [{ message: "Pick a saved skill from the list first." }]
      });
      return;
    }
    if (!window.confirm("Delete saved skill \"" + id + "\"?")) return;
    deleteV3Skill(id);
    refreshSavedList();
    renderSaveResult(saveResultPanel, { ok: true, deleted: id });
  });

  // Run skill: dispatch on state.providerMode
  runBtn.addEventListener("click", async () => {
    const id = seedSelect.value;
    if (!id) {
      runResultPanel.innerHTML =
        '<div class="skill-builder-run-empty">Pick a seed skill above first. ' +
        'The run path executes the selected seed against the reference engagement, ' +
        'either with the canned mock response (Mock LLM) or against your configured ' +
        'AI provider (Real LLM — see AI Settings).</div>';
      return;
    }
    runBtn.disabled = true;
    const labelDuring = state.providerMode === "real" ? "Calling real LLM…" : "Running…";
    runBtn.textContent = labelDuring;
    try {
      const result = await runSeedSkill(id, state);
      renderRunResult(runResultPanel, id, state, result);
    } catch (e) {
      const isProviderErr = e instanceof ProviderNotConfiguredError ||
                            (e && e.code === "PROVIDER_NOT_READY");
      runResultPanel.innerHTML =
        '<div class="skill-builder-run-error">' +
          '<strong>Run failed: </strong>' + escapeHtml(e.message) +
          (isProviderErr
            ? '<div style="margin-top:8px;font-size:11px;">Open <strong>AI Settings</strong> ' +
              '(gear icon in the topbar) to set your provider key + model, then re-toggle Real LLM.</div>'
            : '') +
        '</div>';
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = state.providerMode === "real" ? "Run skill (real LLM)" : "Run skill (mock LLM)";
    }
  });

  refreshChips();
  refreshStep2Visibility();

  return function destroy() {
    container.classList.remove("skill-builder");
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

// ─────────────────────────────────────────────────────────────────
// RUN-SKILL flow against the reference engagement + mock LLM provider
// ─────────────────────────────────────────────────────────────────

async function runSeedSkill(seedId, state) {
  const seedEntry = SEED_SKILLS.find(s => s.id === seedId);
  if (!seedEntry) throw new Error("Unknown seed: " + seedId);
  const seed = seedEntry.skill;

  // Use the live engagement (set by Load-demo → loadDemo() OR by
  // the bridge for non-demo v2 sessions). Falls back to the v3-native
  // demo when the engagement store is empty so the Lab always has
  // valid v3-shape data to run against — never the test fixture from
  // tests/perf (per RULES §17 + SPEC §S23).
  const eng = getActiveEngagement() || loadDemo();
  const dellCat = await loadCatalog("DELL_PRODUCT_TAXONOMY");
  const catalogVersions = {
    DELL_PRODUCT_TAXONOMY: dellCat.catalogVersion,
    BUSINESS_DRIVERS:      "2026.04",
    ENV_CATALOG:           "2026.04"
  };

  let ctx;
  if (seed.skillType === "session-wide") {
    ctx = {
      customer:        eng.customer,
      engagementMeta:  eng.meta,
      catalogVersions
    };
  } else {
    // click-to-run on the entity kind the seed declares
    const target = pickFirstEntity(eng, seed.entityKind);
    ctx = {
      customer:        eng.customer,
      engagementMeta:  eng.meta,
      catalogVersions,
      context:         { [seed.entityKind]: target },
      dellTaxonomyIds: new Set(dellCat.entries.map(e => e.id))
    };
  }

  // Override the prompt template with whatever the user has in the
  // textarea (so they can edit + re-run).
  const skillToRun = { ...seed, promptTemplate: state.promptTemplate };

  // Provider dispatch: mock OR real (per state.providerMode toggle).
  const provider = state.providerMode === "real"
    ? createRealLLMProvider()
    : createMockLLMProvider({ defaultResponse: MOCK_RESPONSES_BY_SKILL_ID[seedId] });

  // Resolve the prompt up-front so we can show it to the user.
  const resolvedPrompt = resolveTemplate(skillToRun.promptTemplate, ctx, {
    skillId: skillToRun.skillId,
    logUndefined: () => {}
  });

  // Run through the actual skillRunner — same path the real skill builder
  // UI run-button will use when the structured-output skill execution
  // runtime ships in v3.1.
  const envelope = await runSkill(skillToRun, ctx, provider, {
    runTimestamp: new Date().toISOString(),
    runIdSeed:    "v3-lab-" + seedId
  });

  return { resolvedPrompt, envelope };
}

function pickFirstEntity(eng, kind) {
  switch (kind) {
    case "driver":          return eng.drivers.byId[eng.drivers.allIds[0]];
    case "currentInstance": return eng.instances.byId[eng.instances.byState.current[0]];
    case "desiredInstance": return eng.instances.byId[eng.instances.byState.desired[0]];
    case "gap":             return eng.gaps.byId[eng.gaps.allIds[0]];
    case "environment":     return eng.environments.byId[eng.environments.allIds[0]];
    default:                return null;
  }
}

function renderRunResult(panel, seedId, state, { resolvedPrompt, envelope }) {
  panel.innerHTML = "";
  panel.className = "skill-builder-run-result skill-builder-run-result-shown";

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="skill-builder-run-section">
      <div class="skill-builder-run-section-label">RESOLVED PROMPT</div>
      <pre class="skill-builder-run-prompt"></pre>
    </div>
    <div class="skill-builder-run-section">
      <div class="skill-builder-run-section-label">VALUE</div>
      <pre class="skill-builder-run-value"></pre>
    </div>
    <div class="skill-builder-run-section">
      <div class="skill-builder-run-section-label">PROVENANCE</div>
      <div class="skill-builder-run-provenance"></div>
    </div>
  `;
  panel.appendChild(wrapper);

  panel.querySelector(".skill-builder-run-prompt").textContent = resolvedPrompt;
  panel.querySelector(".skill-builder-run-value").textContent  =
    typeof envelope.value === "string"
      ? envelope.value
      : JSON.stringify(envelope.value, null, 2);

  const provBox = panel.querySelector(".skill-builder-run-provenance");
  const p = envelope.provenance;
  provBox.innerHTML = `
    <table class="skill-builder-prov-table">
      <tr><th>validationStatus</th><td><span class="prov-status prov-status-${p.validationStatus}">${p.validationStatus}</span></td></tr>
      <tr><th>model</th>           <td>${escapeHtml(p.model)}</td></tr>
      <tr><th>skillId</th>         <td><code>${escapeHtml(p.skillId)}</code></td></tr>
      <tr><th>promptVersion</th>   <td><code>${escapeHtml(p.promptVersion)}</code></td></tr>
      <tr><th>runId</th>           <td><code>${escapeHtml(p.runId.slice(0, 18))}…</code></td></tr>
      <tr><th>timestamp</th>       <td>${escapeHtml(p.timestamp)}</td></tr>
      <tr><th>catalogVersions</th> <td><code>${escapeHtml(JSON.stringify(p.catalogVersions))}</code></td></tr>
    </table>
  `;
}

function renderSaveResult(panel, result) {
  panel.innerHTML = "";
  panel.classList.remove("skill-builder-save-result-ok",
                          "skill-builder-save-result-error");
  if (result.ok && result.deleted) {
    panel.classList.add("skill-builder-save-result-ok");
    panel.textContent = "✓ Deleted saved skill: " + result.deleted;
    return;
  }
  if (result.ok) {
    panel.classList.add("skill-builder-save-result-ok");
    const bindings = result.skill.bindings || [];
    panel.innerHTML =
      '<div>✓ Saved <code>' + escapeHtml(result.skill.skillId) + '</code> ' +
      '(' + bindings.length + ' binding' + (bindings.length === 1 ? '' : 's') + ' extracted).</div>' +
      (bindings.length > 0
        ? '<div class="skill-builder-save-bindings">' +
            bindings.map(b => '<code>' + escapeHtml(b.path) + '</code> <span class="prov-status prov-status-valid">' +
                              escapeHtml(b.source) + '</span>').join(" ") +
          '</div>'
        : "");
    return;
  }
  panel.classList.add("skill-builder-save-result-error");
  const list = document.createElement("ul");
  list.className = "skill-builder-error-list";
  (result.errors || []).forEach(err => {
    const li = document.createElement("li");
    li.className = "skill-builder-error-item";
    li.innerHTML =
      (err.path
        ? '<div class="skill-builder-error-path">' + escapeHtml(err.path) + '</div>'
        : "") +
      '<div class="skill-builder-error-message">' + escapeHtml(err.message) + '</div>';
    list.appendChild(li);
  });
  panel.appendChild(list);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderValidationResult(panel, result) {
  panel.innerHTML = "";
  if (result.ok) {
    panel.classList.remove("skill-builder-validation-result-error");
    panel.classList.add("skill-builder-validation-result-ok");
    panel.textContent = "✓ All paths in the template resolve in the manifest.";
    return;
  }
  panel.classList.remove("skill-builder-validation-result-ok");
  panel.classList.add("skill-builder-validation-result-error");
  const list = document.createElement("ul");
  list.className = "skill-builder-error-list";
  result.errors.forEach(err => {
    const li = document.createElement("li");
    li.className = "skill-builder-error-item";
    li.innerHTML = `
      <div class="skill-builder-error-path">{{${err.path}}}</div>
      <div class="skill-builder-error-message">${err.message}</div>
      ${err.validPaths && err.validPaths.length
        ? `<details class="skill-builder-error-suggestions">
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
