import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { AGENT_LIST_ENDPOINTS } from "../../db/manifest.js";
import { formatDataQualityForAgent } from "../agentDataQuality.js";
import { findDataQualityIssues } from "../dataQuality.js";
import { zProposeChangesParameters } from "../proposalToolSchema.js";
import { PROPOSE_CHANGES_EXAMPLE, validateProposals, type Proposal } from "../proposals.js";
import { LIST_TOOL_DESCRIPTIONS } from "../tools/generated/listTools.descriptions.js";
import type { ListToolName } from "../tools/generated/listTools.types.js";
import {
  executeListTool,
  summarizeListToolResult,
  type ListToolContext,
} from "../tools/listToolDispatcher.js";
import { executeSupplementalTool } from "../tools/supplementalTools.js";

const listQuerySchema = z
  .object({
    page: z.number().optional(),
    per_page: z.number().optional(),
    sort_by: z.string().optional(),
    sort_order: z.enum(["asc", "desc"]).optional(),
    search: z.string().optional(),
    search_fields: z.string().optional(),
    fields: z.string().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]));

export type WealthToolCallbacks = {
  getListContext: () => ListToolContext;
  onProposals: (proposals: Proposal[]) => void;
  onDataQualityScan?: (issueCount: number) => void;
};

function listTool(name: ListToolName, description: string, callbacks: WealthToolCallbacks) {
  return new FunctionTool({
    name,
    description,
    parameters: listQuerySchema,
    execute: async (input) => {
      const result = await executeListTool(name, input, callbacks.getListContext());
      return { summary: summarizeListToolResult(name, result), result };
    },
  });
}

export function buildWealthAdkTools(callbacks: WealthToolCallbacks): FunctionTool[] {
  const listTools = AGENT_LIST_ENDPOINTS.map((ep) =>
    listTool(
      ep.toolName as ListToolName,
      LIST_TOOL_DESCRIPTIONS[ep.toolName] ?? ep.openApiPath,
      callbacks,
    ),
  );

  const supplemental = [
    new FunctionTool({
      name: "list_category_catalog",
      description: "Full expense/income/transfer category catalog (French names).",
      parameters: z.object({}),
      execute: async () => {
        const r = await executeSupplementalTool(
          "list_category_catalog",
          {},
          callbacks.getListContext(),
        );
        return r.data ?? { error: r.error };
      },
    }),
    new FunctionTool({
      name: "get_budget_category_summary",
      description: "Category summary for start_date and end_date (YYYY-MM-DD).",
      parameters: z.object({ start_date: z.string(), end_date: z.string() }),
      execute: async (input) => {
        const r = await executeSupplementalTool(
          "get_budget_category_summary",
          input,
          callbacks.getListContext(),
        );
        return r.data ?? { error: r.error };
      },
    }),
    new FunctionTool({
      name: "get_budget_summary",
      description: "Budget vs actual for a date range.",
      parameters: z.object({ start_date: z.string(), end_date: z.string() }),
      execute: async (input) => {
        const r = await executeSupplementalTool(
          "get_budget_summary",
          input,
          callbacks.getListContext(),
        );
        return r.data ?? { error: r.error };
      },
    }),
    new FunctionTool({
      name: "get_transactions_by_categories",
      description: "Transactions grouped by category for a date range.",
      parameters: z.object({
        start_date: z.string(),
        end_date: z.string(),
        type: z.enum(["expense", "income", "transfer"]).optional(),
      }),
      execute: async (input) => {
        const r = await executeSupplementalTool(
          "get_transactions_by_categories",
          input,
          callbacks.getListContext(),
        );
        return r.data ?? { error: r.error };
      },
    }),
    new FunctionTool({
      name: "get_wealth_summary",
      description: "Net wealth summary for the user.",
      parameters: z.object({}),
      execute: async () => {
        const r = await executeSupplementalTool(
          "get_wealth_summary",
          {},
          callbacks.getListContext(),
        );
        return r.data ?? { error: r.error };
      },
    }),
    new FunctionTool({
      name: "get_portfolio_summary",
      description: "Investment portfolio summary.",
      parameters: z.object({ account_id: z.number().optional() }),
      execute: async (input) => {
        const r = await executeSupplementalTool(
          "get_portfolio_summary",
          input,
          callbacks.getListContext(),
        );
        return r.data ?? { error: r.error };
      },
    }),
    new FunctionTool({
      name: "find_data_quality_issues",
      description:
        "Scan for weak/English categories, missing subcategories, placeholder account names (facts only).",
      parameters: z.object({ transaction_limit: z.number().optional() }),
      execute: async (input) => {
        const limit =
          typeof input.transaction_limit === "number" ? input.transaction_limit : undefined;
        const result = await findDataQualityIssues(callbacks.getListContext(), {
          transactionLimit: limit,
        });
        callbacks.onDataQualityScan?.(result.issues.length);
        return formatDataQualityForAgent(result);
      },
    }),
    new FunctionTool({
      name: "propose_changes",
      description:
        "REQUIRED for any mutation. Invoke this tool with a proposals array so the user gets Apply cards in the UI. " +
        "Do not paste proposal JSON in your chat message. Not executed on the server.",
      parameters: zProposeChangesParameters,
      execute: (input) => {
        const validated = validateProposals(input);
        if (!validated.ok) {
          return {
            error: validated.error,
            hint: "Fix the proposals argument and call propose_changes again (tool call, not chat text).",
            example: PROPOSE_CHANGES_EXAMPLE,
          };
        }
        callbacks.onProposals(validated.proposals);
        return { accepted: validated.proposals.length, proposals: validated.proposals };
      },
    }),
  ];

  return [...listTools, ...supplemental];
}
