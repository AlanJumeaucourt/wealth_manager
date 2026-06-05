import { authFetch } from "@/api/authFetch";
import { API_URL } from "@/api/queryKeys";
import type { AgentEvent, AgentRunSnapshot } from "@/types/assistant";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function useStartAgentRun() {
  return useMutation({
    mutationFn: async (message: string) => {
      const res = await authFetch(`${API_URL}/ai/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      return parseJson<{ runId: string }>(res);
    },
  });
}

export function useAgentRun(runId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["agentRun", runId],
    queryFn: async () => {
      const res = await authFetch(`${API_URL}/ai/runs/${runId}`);
      return parseJson<AgentRunSnapshot>(res);
    },
    enabled: enabled && !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === "completed" || status === "failed" || status === "cancelled") {
        return false;
      }
      return 1000;
    },
  });
}

export function useCancelAgentRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const res = await authFetch(`${API_URL}/ai/runs/${runId}/cancel`, { method: "POST" });
      return parseJson<{ ok: boolean }>(res);
    },
    onSuccess: (_data, runId) => {
      void queryClient.invalidateQueries({ queryKey: ["agentRun", runId] });
    },
  });
}

export async function streamAgentRunEvents(
  runId: string,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await authFetch(`${API_URL}/ai/runs/${runId}/events`, { signal });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to stream events (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        onEvent(JSON.parse(json) as AgentEvent);
      } catch {
        // ignore malformed chunks
      }
    }
  }
}
