import { config } from "../config.js";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with small jitter, capped at 60s. */
export function retryDelayMs(attempt: number, baseMs = config.ai.retryBaseDelayMs): number {
  const exponential = baseMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * baseMs * 0.25);
  return Math.min(exponential + jitter, 60_000);
}

export function isRetryableLlmError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const status =
      "status" in error && typeof (error as { status: unknown }).status === "number"
        ? (error as { status: number }).status
        : "statusCode" in error && typeof (error as { statusCode: unknown }).statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : null;
    if (status === 429 || status === 502 || status === 503) {
      return true;
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    message.includes("429") ||
    lower.includes("rate-limit") ||
    lower.includes("rate limit") ||
    message.includes("502") ||
    message.includes("503") ||
    lower.includes("overloaded") ||
    lower.includes("temporarily unavailable")
  );
}

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
    isRetryable?: (error: unknown) => boolean;
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? config.ai.retryMaxAttempts;
  const baseDelayMs = options?.baseDelayMs ?? config.ai.retryBaseDelayMs;
  const isRetryable = options?.isRetryable ?? isRetryableLlmError;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt >= maxAttempts - 1) {
        throw error;
      }
      const delayMs = retryDelayMs(attempt, baseDelayMs);
      options?.onRetry?.(attempt, delayMs, error);
      await sleep(delayMs);
    }
  }
  throw lastError;
}
