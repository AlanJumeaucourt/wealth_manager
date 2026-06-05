import { config } from "../config.js";
import { retryDelayMs, sleep } from "./retry.js";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: OpenAiToolCall[];
};

export type OpenAiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type OpenAiToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatCompletionResponse = {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAiToolCall[];
    };
    finish_reason: string | null;
  }>;
};

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

export function assertAiConfigured(): void {
  if (!config.ai.openRouterApiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY is not configured", 503, false);
  }
}

/** Map OpenRouter HTTP/body errors to short user-facing text. */
export function toUserFacingOpenRouterError(error: OpenRouterError): string {
  if (error.status === 503) {
    return "AI is not configured on the server (missing OPENROUTER_API_KEY).";
  }
  if (error.status === 429) {
    return (
      "The AI model is temporarily rate-limited on OpenRouter. Wait a moment and retry, or configure " +
      "AI_MODEL with a model your API key can access reliably."
    );
  }
  try {
    const match = error.message.match(/\{[\s\S]*\}/);
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
  return error.message.length > 400 ? `${error.message.slice(0, 400)}…` : error.message;
}

async function fetchCompletion(
  body: Record<string, unknown>,
  model: string,
): Promise<ChatCompletionResponse> {
  const res = await fetch(config.ai.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.ai.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://wealthmanager.local",
      "X-Title": "WealthManager Agent",
    },
    body: JSON.stringify({ ...body, model }),
  });

  if (!res.ok) {
    const text = await res.text();
    const retryable = res.status === 429 || res.status === 502 || res.status === 503;
    throw new OpenRouterError(
      `OpenRouter request failed (${res.status}): ${text.slice(0, 500)}`,
      res.status >= 500 ? 502 : res.status,
      retryable,
    );
  }

  return (await res.json()) as ChatCompletionResponse;
}

export async function chatCompletion(params: {
  messages: ChatMessage[];
  tools?: OpenAiToolDefinition[];
  toolChoice?: "auto" | "none";
  temperature?: number;
}): Promise<ChatCompletionResponse> {
  assertAiConfigured();

  const body: Record<string, unknown> = {
    messages: params.messages,
    temperature: params.temperature ?? 0.2,
  };
  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools;
    body.tool_choice = params.toolChoice ?? "auto";
  }

  let lastError: OpenRouterError | null = null;

  for (let attempt = 0; attempt < config.ai.retryMaxAttempts; attempt++) {
    try {
      return await fetchCompletion(body, config.ai.model);
    } catch (error) {
      if (!(error instanceof OpenRouterError)) throw error;
      lastError = error;
      if (!error.retryable || attempt >= config.ai.retryMaxAttempts - 1) {
        break;
      }
      await sleep(retryDelayMs(attempt));
    }
  }

  throw lastError ?? new OpenRouterError("OpenRouter request failed", 502, false);
}

export function getAssistantMessage(response: ChatCompletionResponse): {
  content: string | null;
  toolCalls: OpenAiToolCall[];
} {
  const choice = response.choices[0];
  if (!choice) {
    return { content: null, toolCalls: [] };
  }
  return {
    content: choice.message.content,
    toolCalls: choice.message.tool_calls ?? [],
  };
}
