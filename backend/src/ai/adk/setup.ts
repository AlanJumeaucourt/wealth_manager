import { registerOpenRouter } from "adk-llm-bridge";
import { config } from "../../config.js";

let registered = false;

/** Register OpenRouter with ADK LLM registry (idempotent). */
export function ensureAdkProvidersRegistered(): void {
  if (registered) return;
  if (!config.ai.openRouterApiKey) return;

  const baseURL = config.ai.endpoint.replace(/\/chat\/completions\/?$/, "");

  registerOpenRouter({
    apiKey: config.ai.openRouterApiKey,
    baseURL: baseURL || "https://openrouter.ai/api/v1",
    siteUrl: "https://wealthmanager.local",
    appName: "WealthManager",
  });

  registered = true;
}
