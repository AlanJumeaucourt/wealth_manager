export class AiConfigurationError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

/** @deprecated Legacy OpenRouter client error shape for tests. */
export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

import { config } from "../config.js";

export function assertAiConfigured(): void {
  if (!config.ai.openRouterApiKey) {
    throw new AiConfigurationError("OPENROUTER_API_KEY is not configured");
  }
}

/** Map thrown errors to user-facing assistant messages. */
function isRateLimitMessage(message: string): boolean {
  return message.includes("429") || message.toLowerCase().includes("rate-limit");
}

export function toUserFacingAgentError(error: unknown): string {
  if (error instanceof AiConfigurationError) {
    return error.message;
  }
  const message = error instanceof Error ? error.message : String(error);
  if ((error instanceof OpenRouterError && error.status === 429) || isRateLimitMessage(message)) {
    return (
      "The AI model is temporarily rate-limited on OpenRouter. Wait a moment and retry, or set " +
      "AI_MODEL to a model your API key can access reliably."
    );
  }
  try {
    const match = message.match(/\{[\s\S]*\}/);
    if (match) {
      const body = JSON.parse(match[0]) as {
        error?: { message?: string; metadata?: { raw?: string } };
      };
      const raw = body.error?.metadata?.raw;
      if (typeof raw === "string" && raw.length > 0 && raw.length < 500) {
        return raw;
      }
      if (body.error?.message) {
        return body.error.message;
      }
    }
  } catch {
    // fall through
  }
  return message.length > 400 ? `${message.slice(0, 400)}…` : message;
}

export const toUserFacingOpenRouterError = toUserFacingAgentError;
