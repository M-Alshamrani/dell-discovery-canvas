// ui/views/V3SkillBuilder.js — v3.0 · SPEC sec S7.5
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
import { createMockLLMProvider } from "../../tests/mocks/mockLLMProvider.js";
import { buildReferenceEngagement } from "../../tests/perf/buildReferenceEngagement.js";
import { loadCatalog }         from "../../services/catalogLoader.js";
import {
  SEED_SKILL_DELL_MAPPING,
  SEED_SKILL_EXECUTIVE_SUMMARY,
  SEED_SKILL_CARE_BUILDER
} from "../../core/v3SeedSkills.js";

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
      Manifest-driven chip palette · save-time path validation · mock-LLM run · per SPEC §S7.5
    </div>
  `;
  container.appendChild(header);

  // ───── SEED SKILL PICKER ─────
  const seedPicker = document.createElement("section");
  seedPicker.className = "v3-skill-builder-seed-picker";
  seedPicker.innerHTML = `
    <label class="v3-skill-builder-seed-label" for="v3-seed-picker">
      Load production-critical seed (per <code>OPEN_QUESTIONS_RESOLVED.md</code> Q3)
    </label>
    <select id="v3-seed-picker" class="v3-skill-builder-seed-select">
      <option value="">— Build from scratch —</option>
      ${SEED_SKILLS.map(s => `<option value="${s.id}">${s.label}</option>`).join("")}
    </select>
  `;
  container.appendChild(seedPicker);
  const seedSelect = seedPicker.querySelector("#v3-seed-picker");

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

  // ───── VALIDATE + RUN BUTTONS + PANELS ─────
  const actions = document.createElement("section");
  actions.className = "v3-skill-builder-actions";
  actions.innerHTML = `
    <div class="v3-skill-builder-actions-row">
      <button type="button" class="v3-skill-builder-validate-btn">Validate template paths</button>
      <button type="button" class="v3-skill-builder-run-btn">Run skill (mock LLM)</button>
    </div>
    <div class="v3-skill-builder-validation-result" aria-live="polite"></div>
    <div class="v3-skill-builder-run-result" aria-live="polite"></div>
  `;
  container.appendChild(actions);
  const validateBtn   = actions.querySelector(".v3-skill-builder-validate-btn");
  const runBtn        = actions.querySelector(".v3-skill-builder-run-btn");
  const resultPanel   = actions.querySelector(".v3-skill-builder-validation-result");
  const runResultPanel = actions.querySelector(".v3-skill-builder-run-result");

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
      step2.querySelector(".v3-skill-builder-kind-picker").value = seed.entityKind;
    }
    textarea.value = seed.promptTemplate;
    refreshStep2Visibility();
    refreshChips();
    // Clear stale results
    resultPanel.classList.remove("v3-skill-builder-validation-result-ok",
                                 "v3-skill-builder-validation-result-error");
    resultPanel.innerHTML = "";
    runResultPanel.innerHTML = "";
  });

  // Run skill via mock LLM provider
  runBtn.addEventListener("click", async () => {
    const id = seedSelect.value;
    if (!id) {
      runResultPanel.innerHTML =
        '<div class="v3-skill-builder-run-empty">Pick a seed skill above first ' +
        '(this v3.0 demo executes seed skills against the reference engagement; ' +
        'the run path that wires real-LLM credentials is the next slice).</div>';
      return;
    }
    runBtn.disabled = true;
    runBtn.textContent = "Running…";
    try {
      const result = await runSeedSkill(id, state);
      renderRunResult(runResultPanel, id, state, result);
    } catch (e) {
      runResultPanel.innerHTML =
        '<div class="v3-skill-builder-run-error">Run failed: ' + escapeHtml(e.message) + '</div>';
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = "Run skill (mock LLM)";
    }
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

// ─────────────────────────────────────────────────────────────────
// RUN-SKILL flow against the reference engagement + mock LLM provider
// ─────────────────────────────────────────────────────────────────

async function runSeedSkill(seedId, state) {
  const seedEntry = SEED_SKILLS.find(s => s.id === seedId);
  if (!seedEntry) throw new Error("Unknown seed: " + seedId);
  const seed = seedEntry.skill;

  // Build a context that matches the seed skill's scope.
  const eng = buildReferenceEngagement();
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

  // Mock provider canned to this seed's expected response shape.
  const provider = createMockLLMProvider({
    defaultResponse: MOCK_RESPONSES_BY_SKILL_ID[seedId]
  });

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
  panel.className = "v3-skill-builder-run-result v3-skill-builder-run-result-shown";

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="v3-skill-builder-run-section">
      <div class="v3-skill-builder-run-section-label">RESOLVED PROMPT</div>
      <pre class="v3-skill-builder-run-prompt"></pre>
    </div>
    <div class="v3-skill-builder-run-section">
      <div class="v3-skill-builder-run-section-label">VALUE</div>
      <pre class="v3-skill-builder-run-value"></pre>
    </div>
    <div class="v3-skill-builder-run-section">
      <div class="v3-skill-builder-run-section-label">PROVENANCE</div>
      <div class="v3-skill-builder-run-provenance"></div>
    </div>
  `;
  panel.appendChild(wrapper);

  panel.querySelector(".v3-skill-builder-run-prompt").textContent = resolvedPrompt;
  panel.querySelector(".v3-skill-builder-run-value").textContent  =
    typeof envelope.value === "string"
      ? envelope.value
      : JSON.stringify(envelope.value, null, 2);

  const provBox = panel.querySelector(".v3-skill-builder-run-provenance");
  const p = envelope.provenance;
  provBox.innerHTML = `
    <table class="v3-skill-builder-prov-table">
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
