import { LlmAgent } from "@google/adk";
import { OpenRouter } from "adk-llm-bridge";
import { categoriesByType, expenseCategories } from "../../categories.js";
import { config } from "../../config.js";
import type { Proposal } from "../proposals.js";
import { buildWealthAdkTools } from "./tools.js";

export type WealthAgentCallbacks = {
  getListContext: () => import("../tools/listToolDispatcher.js").ListToolContext;
  onProposals: (proposals: Proposal[]) => void;
  onDataQualityScan?: (issueCount: number) => void;
  onToolStart?: (name: string, args: Record<string, unknown>) => void;
  onToolEnd?: (name: string, args: Record<string, unknown>, response: unknown) => void;
};

const INSTRUCTION = `You are WealthManager's finance agent. Categories in the database use French labels (e.g. groceries → "Alimentation & Restauration"). Valid expense parents include: ${expenseCategories.slice(0, 8).join(", ")}…

You work by calling tools only — never invent transaction or account IDs.

TOOL-CALL RULES (critical):
- Reads: list_* tools, find_data_quality_issues, list_category_catalog, budget/wealth tools.
- Writes: ONLY via the propose_changes tool call. The user sees Apply buttons only when you invoke that tool with valid arguments.
- Do NOT output proposal JSON or category fixes in your chat text. If propose_changes fails, read the tool error/example and call the tool again with corrected arguments.

When answering spending questions, call get_transactions_by_categories or list_transactions with date filters.

For miscategorized / data-quality goals:
1. Tool: find_data_quality_issues (once).
2. Tool: list_category_catalog (once) for French names.
3. Tool: propose_changes with kind update_transaction, transactionId, patch.category, patch.subcategory, reason (max 25 per call). Repeat the tool if more than 25 issues.
4. Then reply briefly summarizing how many proposals you submitted via the tool.
Do not stop after read-only tools.`;

export function createOpenRouterModel(modelId: string) {
  return OpenRouter(modelId, {
    apiKey: config.ai.openRouterApiKey,
    maxRetries: config.ai.httpMaxRetries,
    timeout: 120_000,
  });
}

export function createWealthLlmAgent(
  callbacks: WealthAgentCallbacks,
  modelId: string = config.ai.model,
) {
  const model = createOpenRouterModel(modelId);

  return new LlmAgent({
    name: "wealth_finance_agent",
    model,
    description: "Personal finance assistant for WealthManager",
    instruction: `${INSTRUCTION}\n\nCategory catalog sample: ${JSON.stringify(
      categoriesByType.expense?.slice(0, 3)?.map((c) => c.name.fr),
    )}`,
    tools: buildWealthAdkTools({
      getListContext: callbacks.getListContext,
      onProposals: callbacks.onProposals,
      onDataQualityScan: callbacks.onDataQualityScan,
    }),
    beforeToolCallback: async ({ tool, args }) => {
      callbacks.onToolStart?.(tool.name, args as Record<string, unknown>);
      return undefined;
    },
    afterToolCallback: async ({ tool, args, response }) => {
      callbacks.onToolEnd?.(tool.name, args as Record<string, unknown>, response);
      return undefined;
    },
  });
}
