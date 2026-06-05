import type { AgentEvent } from "@/types/assistant";

export function agentEventKey(event: AgentEvent): string {
  return JSON.stringify(event);
}

export function mergeAgentEvents(prev: AgentEvent[], incoming: AgentEvent[]): AgentEvent[] {
  if (incoming.length === 0) return prev;
  const seen = new Set(prev.map(agentEventKey));
  const next = [...prev];
  for (const event of incoming) {
    const key = agentEventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(event);
  }
  return next;
}

/** User-facing message for assistant failures (strips raw JSON blobs when possible). */
export function formatAssistantErrorMessage(raw: string): string {
  if (raw.includes("429") || raw.toLowerCase().includes("rate-limit")) {
    return (
      "The AI provider is temporarily rate-limited. Wait a minute and try again, or set OPENROUTER_API_KEY " +
      "with your own key and optionally AI_MODEL to a paid model in the backend environment."
    );
  }
  if (raw.includes("OPENROUTER_API_KEY")) {
    return "AI is not configured on the server. Set OPENROUTER_API_KEY in the backend environment.";
  }
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as {
        error?: { message?: string; metadata?: { raw?: string } };
      };
      const meta = parsed.error?.metadata?.raw;
      if (typeof meta === "string" && meta.length > 0 && meta.length < 400) {
        return meta;
      }
      if (parsed.error?.message) {
        return parsed.error.message;
      }
    }
  } catch {
    // use trimmed raw
  }
  const trimmed = raw.replace(/^OpenRouter request failed \(\d+\):\s*/i, "").trim();
  if (trimmed.length > 280) {
    return `${trimmed.slice(0, 280)}…`;
  }
  return trimmed || "The assistant run failed. Please try again.";
}
