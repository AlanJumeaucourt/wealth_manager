import { config } from "../../config.js";
import type { AgentEvent, AgentRun, AgentRunSnapshot } from "./types.js";

const runs = new Map<string, AgentRun>();
const listeners = new Map<string, Set<(event: AgentEvent) => void>>();
const abortControllers = new Map<string, AbortController>();

function newId(): string {
  return crypto.randomUUID();
}

export function createAgentRun(userId: number, goal: string): AgentRun {
  const now = Date.now();
  const run: AgentRun = {
    id: newId(),
    userId,
    status: "planning",
    goal,
    plan: [],
    events: [],
    workingMemory: [],
    proposals: [],
    createdAt: now,
    updatedAt: now,
    cancelled: false,
  };
  runs.set(run.id, run);
  abortControllers.set(run.id, new AbortController());
  return run;
}

export function getRunAbortSignal(runId: string): AbortSignal | undefined {
  return abortControllers.get(runId)?.signal;
}

export function abortAgentRun(runId: string): void {
  abortControllers.get(runId)?.abort();
}

export function getAgentRun(runId: string, userId: number): AgentRun | undefined {
  const run = runs.get(runId);
  if (!run || run.userId !== userId) return undefined;
  return run;
}

export function toSnapshot(run: AgentRun): AgentRunSnapshot {
  return {
    id: run.id,
    status: run.status,
    goal: run.goal,
    plan: run.plan,
    proposals: run.proposals,
    finalMessage: run.finalMessage,
    error: run.error,
    events: run.events,
  };
}

export function pushEvent(runId: string, event: AgentEvent): void {
  const run = runs.get(runId);
  if (!run) return;
  run.events.push(event);
  run.updatedAt = Date.now();
  const subs = listeners.get(runId);
  if (subs) {
    for (const fn of subs) fn(event);
  }
}

export function subscribeRunEvents(
  runId: string,
  listener: (event: AgentEvent) => void,
): () => void {
  let set = listeners.get(runId);
  if (!set) {
    set = new Set();
    listeners.set(runId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}

export function updateRun(runId: string, patch: Partial<AgentRun>): void {
  const run = runs.get(runId);
  if (!run) return;
  Object.assign(run, patch, { updatedAt: Date.now() });
}

export function cancelAgentRun(runId: string, userId: number): boolean {
  const run = getAgentRun(runId, userId);
  if (!run) return false;
  abortControllers.get(runId)?.abort();
  run.cancelled = true;
  run.status = "cancelled";
  run.updatedAt = Date.now();
  pushEvent(runId, { type: "run_failed", error: "Cancelled by user" });
  return true;
}

export function pruneExpiredRuns(): void {
  const cutoff = Date.now() - config.ai.runTtlSec * 1000;
  for (const [id, run] of runs) {
    if (run.updatedAt < cutoff) {
      runs.delete(id);
      listeners.delete(id);
      abortControllers.delete(id);
    }
  }
}
