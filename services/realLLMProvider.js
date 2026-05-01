// services/realLLMProvider.js — v3.0 · adapter for v2.x chatCompletion
//
// Bridges the v3.0 skillRunner's expected provider shape:
//
//   { complete({ prompt }) -> Promise<{ model, text }> }
//
// onto the v2.x services/aiService.chatCompletion API. Reads the
// active-provider config from core/aiConfig.js and dispatches.
//
// Usage:
//   const provider = createRealLLMProvider();
//   const r = await provider.complete({ prompt: "..." });
//   // r === { model: "claude-haiku-4-5", text: "..." }
//
// Throws a structured error if the active provider isn't configured
// (no api key, no model id, etc.) so the UI can show a clear message
// instead of letting an opaque 401 surface.

import { chatCompletion } from "./aiService.js";
import { loadAiConfig, isActiveProviderReady } from "../core/aiConfig.js";

export class ProviderNotConfiguredError extends Error {
  constructor(provider, reason) {
    super("Provider '" + provider + "' is not configured: " + reason);
    this.name     = "ProviderNotConfiguredError";
    this.provider = provider;
    this.code     = "PROVIDER_NOT_READY";
  }
}

// createRealLLMProvider({ systemPrompt? }) -> provider
// systemPrompt is optional; when supplied it's prepended as the first
// system message to every call.
export function createRealLLMProvider(opts = {}) {
  return {
    async complete({ prompt }) {
      const config = loadAiConfig();
      if (!isActiveProviderReady(config)) {
        const p = config.providers[config.activeProvider] || {};
        const reason = !p.model ? "missing model id"
                      : (config.activeProvider !== "local" && !p.apiKey) ? "missing API key"
                      : "incomplete configuration (open AI Settings)";
        throw new ProviderNotConfiguredError(config.activeProvider, reason);
      }

      const provider = config.providers[config.activeProvider];
      const messages = [];
      if (opts.systemPrompt) {
        messages.push({ role: "system", content: String(opts.systemPrompt) });
      }
      messages.push({ role: "user", content: String(prompt) });

      const r = await chatCompletion({
        providerKey:    config.activeProvider,
        baseUrl:        provider.baseUrl,
        model:          provider.model,
        fallbackModels: provider.fallbackModels || [],
        apiKey:         provider.apiKey || "",
        messages
      });
      // r is { text, raw, modelUsed, attempts }
      return {
        model: r.modelUsed || provider.model || config.activeProvider,
        text:  r.text
      };
    }
  };
}

// Helper for the UI: which provider is active + is it ready?
export function getActiveProviderStatus() {
  const config = loadAiConfig();
  const provider = config.providers[config.activeProvider] || {};
  return {
    activeProvider: config.activeProvider,
    label:          provider.label || config.activeProvider,
    ready:          isActiveProviderReady(config),
    model:          provider.model || ""
  };
}
