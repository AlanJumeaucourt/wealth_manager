import { getAgentCategoryCatalog } from "../categoryCatalog.js";
import { getLegacyCategorySummary } from "../../routes/budgets.js";
import * as budget from "../../services/budget.js";
import { getWealthSummary } from "../../services/wealthSummary.js";
import { getPortfolioSummary } from "../../services/portfolioSummary.js";
import { findDataQualityIssues } from "../dataQuality.js";
import { validateProposals, type Proposal } from "../proposals.js";
import type { OpenAiToolDefinition } from "../openrouter.js";
import type { ListToolContext } from "./listToolDispatcher.js";
import { parseDateRangeOr400 } from "../../utils/query.js";

export const SUPPLEMENTAL_OPENAI_TOOLS: OpenAiToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_category_catalog",
      description:
        "Expense/income/transfer category catalog (French parent names and subcategories only).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_budget_category_summary",
      description:
        "Category spending/income summary for a date range (start_date, end_date as YYYY-MM-DD).",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string" },
          end_date: { type: "string" },
        },
        required: ["start_date", "end_date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_budget_summary",
      description: "Budget vs actual summary for a date range.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string" },
          end_date: { type: "string" },
        },
        required: ["start_date", "end_date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_transactions_by_categories",
      description:
        "Transactions grouped by category for a date range. type: expense | income | transfer.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string" },
          end_date: { type: "string" },
          type: { type: "string", enum: ["expense", "income", "transfer"] },
        },
        required: ["start_date", "end_date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_wealth_summary",
      description: "Net wealth summary for the user (accounts, balances).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_portfolio_summary",
      description: "Investment portfolio summary. Optional account_id filter.",
      parameters: {
        type: "object",
        properties: { account_id: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_data_quality_issues",
      description:
        "Scan recent transactions and accounts for weak categories, missing subcategories, and placeholder account names.",
      parameters: {
        type: "object",
        properties: { transaction_limit: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_changes",
      description:
        "Propose mutations for the user to apply in the app (never executed on server). Pass proposals array.",
      parameters: {
        type: "object",
        properties: {
          proposals: {
            type: "array",
            items: { type: "object" },
          },
        },
        required: ["proposals"],
        additionalProperties: false,
      },
    },
  },
];

export type SupplementalToolResult = {
  data?: unknown;
  proposals?: Proposal[];
  error?: string;
};

function parseDateRange(
  params: Record<string, unknown>,
): { start: string; end: string } | { error: string } {
  const set = { status: 200 as number | string };
  const parsed = parseDateRangeOr400(params, set);
  if ("error" in parsed) {
    return {
      error: typeof parsed.error === "object" ? JSON.stringify(parsed.error) : String(parsed.error),
    };
  }
  return { start: parsed.start_date, end: parsed.end_date };
}

export async function executeSupplementalTool(
  name: string,
  rawArgs: unknown,
  ctx: ListToolContext,
): Promise<SupplementalToolResult> {
  const args =
    typeof rawArgs === "string"
      ? (JSON.parse(rawArgs) as Record<string, unknown>)
      : ((rawArgs as Record<string, unknown>) ?? {});

  switch (name) {
    case "list_category_catalog":
      return { data: getAgentCategoryCatalog() };
    case "get_budget_category_summary": {
      const range = parseDateRange(args);
      if ("error" in range) return { error: range.error };
      const data = await getLegacyCategorySummary(range.start, range.end, ctx.userId);
      return { data };
    }
    case "get_budget_summary": {
      const range = parseDateRange(args);
      if ("error" in range) return { error: range.error };
      const data = await budget.getBudgetSummary(range.start, range.end, ctx.userId);
      return { data };
    }
    case "get_transactions_by_categories": {
      const range = parseDateRange(args);
      if ("error" in range) return { error: range.error };
      const type = (args.type as string) ?? "expense";
      const data = await budget.getTransactionsByCategories(
        range.start,
        range.end,
        ctx.userId,
        type as "expense" | "income" | "transfer",
      );
      return { data };
    }
    case "get_wealth_summary":
      return { data: await getWealthSummary(ctx.userId) };
    case "get_portfolio_summary": {
      const accountId =
        args.account_id != null && args.account_id !== "" ? Number(args.account_id) : undefined;
      return { data: await getPortfolioSummary(ctx.userId, accountId) };
    }
    case "find_data_quality_issues":
      return {
        data: await findDataQualityIssues(ctx, {
          transactionLimit:
            typeof args.transaction_limit === "number" ? args.transaction_limit : undefined,
        }),
      };
    case "propose_changes": {
      const validated = validateProposals(args);
      if (!validated.ok) return { error: validated.error };
      return { proposals: validated.proposals };
    }
    default:
      return { error: `Unknown supplemental tool: ${name}` };
  }
}

export function isSupplementalToolName(name: string): boolean {
  return SUPPLEMENTAL_OPENAI_TOOLS.some((t) => t.function.name === name);
}
