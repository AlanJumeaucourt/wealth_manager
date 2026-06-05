import { describe, expect, test } from "bun:test";
import { OpenRouterError, toUserFacingOpenRouterError } from "./errors.js";

describe("toUserFacingOpenRouterError", () => {
  test("maps 429 to friendly message", () => {
    const err = new OpenRouterError("OpenRouter request failed (429): rate limit", 429, true);
    const msg = toUserFacingOpenRouterError(err);
    expect(msg).toContain("rate-limited");
  });

  test("extracts metadata.raw from JSON body", () => {
    const err = new OpenRouterError(
      'OpenRouter request failed (429): {"error":{"message":"Provider returned error","metadata":{"raw":"model is temporarily rate-limited"}}}',
      429,
      true,
    );
    const msg = toUserFacingOpenRouterError(err);
    expect(msg).toContain("rate-limited");
  });
});
