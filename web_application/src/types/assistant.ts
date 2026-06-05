export type Proposal =
  | {
      kind: "update_transaction";
      transactionId: number;
      patch: {
        category?: string;
        subcategory?: string | null;
        description?: string;
      };
      reason: string;
      evidence?: string;
    }
  | {
      kind: "update_account";
      accountId: number;
      patch: { name: string };
      reason: string;
      evidence?: string;
    }
  | {
      kind: "batch_update_transactions";
      updates: Array<{
        id: number;
        category?: string;
        subcategory?: string | null;
      }>;
      reason: string;
      evidence?: string;
    };

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

export type AgentRunSnapshot = {
  id: string;
  status: string;
  goal: string;
  plan: AgentPlanStep[];
  proposals: Proposal[];
  finalMessage?: string;
  error?: string;
  events: AgentEvent[];
};
