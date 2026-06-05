import { describe, expect, test } from "bun:test";
import { formatAssistantErrorMessage, mergeAgentEvents } from "./agentEvents";
import type { AgentEvent } from "@/types/assistant";

describe("mergeAgentEvents", () => {
  test("deduplicates identical events", () => {
    const plan: AgentEvent = {
      type: "plan_created",
      plan: [{ id: "1", description: "Step", done: false }],
    };
    const once = mergeAgentEvents([], [plan]);
    const twice = mergeAgentEvents(once, [plan]);
    expect(twice).toHaveLength(1);
  });
});

describe("formatAssistantErrorMessage", () => {
  test("maps 429", () => {
    expect(formatAssistantErrorMessage("OpenRouter request failed (429): {}")).toContain(
      "rate-limited",
    );
  });
});
