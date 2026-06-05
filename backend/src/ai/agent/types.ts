import type { Proposal } from "../proposals.js";

export type AgentRunStatus =
  | "planning"
  | "executing"
  | "reflecting"
  | "proposing"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentPlanStep = {
  id: string;
  description: string;
  done: boolean;
};

export type AgentEvent =
  | { type: "plan_created"; plan: AgentPlanStep[] }
  | { type: "step_started"; stepId: string; description: string }
  | { type: "step_completed"; stepId: string }
  | { type: "tool_called"; toolName: string; args: Record<string, unknown> }
  | { type: "tool_result"; toolName: string; summary: string }
  | { type: "reflection"; message: string }
  | { type: "proposal_added"; proposal: Proposal }
  | { type: "run_completed"; finalMessage: string }
  | { type: "run_failed"; error: string };

export type MemoryEntry = {
  toolName: string;
  summary: string;
  at: string;
};

export type AgentRun = {
  id: string;
  userId: number;
  status: AgentRunStatus;
  goal: string;
  plan: AgentPlanStep[];
  events: AgentEvent[];
  workingMemory: MemoryEntry[];
  proposals: Proposal[];
  finalMessage?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  cancelled: boolean;
};

export type AgentRunSnapshot = Pick<
  AgentRun,
  "id" | "status" | "goal" | "plan" | "proposals" | "finalMessage" | "error" | "events"
>;
