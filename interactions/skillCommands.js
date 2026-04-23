// interactions/skillCommands.js — Phase 19 / v2.4.0
//
// Skill execution helpers. v2.4.0 ships ONE hardcoded demo skill (Tab 1
// driver-question assistant) to prove the AI wiring end-to-end. v2.4.1+
// will replace this with the user-built skills loaded from localStorage.

import { loadAiConfig } from "../core/aiConfig.js";
import { chatCompletion } from "../services/aiService.js";

// Run the Tab 1 demo: given a strategic driver context, ask the AI to
// suggest 3 customer-discovery questions tailored to that driver and
// the customer's vertical. Returns { ok, text, error }.
export async function runDriverQuestionSkill(session, driver) {
  if (!driver || !driver.id) {
    return { ok: false, error: "runDriverQuestionSkill: missing driver" };
  }
  var cust = (session && session.customer) || {};
  var verticalLine = cust.vertical ? "Customer vertical: " + cust.vertical + "." : "";
  var customerLine = cust.name     ? "Customer name: "     + cust.name     + "." : "";

  var systemPrompt =
    "You are a senior Dell Technologies presales engineer. Suggest 3 short, " +
    "open-ended discovery questions a presales would ask in a 30-45 minute " +
    "workshop. Each question should be 1-2 sentences. Output ONLY the 3 " +
    "questions, numbered 1. 2. 3. — no preamble, no explanation.";

  var userPrompt =
    [
      customerLine,
      verticalLine,
      "Strategic driver: " + (driver.label || driver.id) + ".",
      driver.shortHint ? "Driver hint: " + driver.shortHint : "",
      driver.priority ? "Driver priority for this customer: " + driver.priority + "." : ""
    ].filter(Boolean).join("\n");

  var config = loadAiConfig();
  var active = config.providers[config.activeProvider];

  try {
    var res = await chatCompletion({
      providerKey: config.activeProvider,
      baseUrl:     active.baseUrl,
      model:       active.model,
      apiKey:      active.apiKey,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt }
      ]
    });
    return { ok: true, text: res.text, providerKey: config.activeProvider };
  } catch (e) {
    return { ok: false, error: e.message || String(e), providerKey: config.activeProvider };
  }
}
