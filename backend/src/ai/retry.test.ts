import { describe, expect, test } from "bun:test";
import { isRetryableLlmError, retryDelayMs } from "./retry.js";

describe("isRetryableLlmError", () => {
  test("detects 429 in message", () => {
    expect(isRetryableLlmError(new Error("OpenRouter request failed (429): rate limit"))).toBe(
      true,
    );
  });

  test("detects status on error object", () => {
    expect(isRetryableLlmError({ status: 429, message: "Too Many Requests" })).toBe(true);
  });

  test("ignores non-retryable errors", () => {
    expect(isRetryableLlmError(new Error("Invalid API key"))).toBe(false);
  });
});

describe("retryDelayMs", () => {
  test("grows with attempt", () => {
    const d0 = retryDelayMs(0, 1000);
    const d2 = retryDelayMs(2, 1000);
    expect(d2).toBeGreaterThan(d0);
    expect(d0).toBeGreaterThanOrEqual(1000);
    expect(d2).toBeLessThanOrEqual(60_000);
  });
});
