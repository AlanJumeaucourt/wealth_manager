import { Elysia } from "elysia";
import { categoriesByType } from "../categories.js";
import { db } from "../db/client.js";
import { authDerivePlugin, requireAuth } from "../middleware/auth.js";
import {
  tBaseListQuerySchema,
  tBudgetsCompareQuerySchema,
  tBudgetsDateRangeQuerySchema,
  tBudgetsLegacyListQuerySchema,
  tBudgetsSummaryPeriodQuerySchema,
  tBudgetsTransactionsByCategoriesQuerySchema,
  tBudgetUpdateSchema,
  tBudgetUpsertSchema,
} from "../schemas/typebox.js";
import * as budget from "../services/budget.js";
import {
  createCreateHandler,
  createDeleteByIdHandler,
  createGetByIdHandler,
  createListHandler,
  createUpdateHandler,
} from "../utils/crudHandlers.js";
import { round2 } from "../utils/money.js";
import { parseDateRangeOr400, parseYearMonthQuery, withDateRange } from "../utils/query.js";
import { stringifyUnknown } from "../utils/stringifyUnknown.js";

const TABLE = "budgets" as const;
const VALID_CATEGORY_TYPES = ["expense", "income", "transfer"] as const;
const VALID_PERIODS = ["week", "month", "quarter", "year"] as const;
type CategoryType = (typeof VALID_CATEGORY_TYPES)[number];
type PeriodType = (typeof VALID_PERIODS)[number];

function validateCategoryType(value: string): { error: string } | null {
  if (VALID_CATEGORY_TYPES.includes(value as CategoryType)) return null;
  return {
    error: "Invalid category type. Must be one of: expense, income, transfer",
  };
}

function budgetCreateTransform(body: Record<string, unknown>, userId: number) {
  return {
    category: body.category,
    year: body.year,
    month: body.month,
    amount: stringifyUnknown(body.amount),
    user_id: userId,
  };
}

const SEARCH_FIELDS = ["category"];

export const budgetsListHandler = createListHandler(TABLE, {
  searchFields: SEARCH_FIELDS,
  allowedFilters: [],
  useValidatedQuery: true,
});

function budgetUpdateTransform(body: Record<string, unknown>) {
  return {
    ...body,
    amount: body.amount != null ? stringifyUnknown(body.amount) : undefined,
  };
}

function sumTransactionSummary(data: Record<string, budget.TransactionSummary>) {
  const byCurrency: Record<string, { net: number; original: number }> = {};
  let preferredCurrency = "EUR";
  for (const cat of Object.values(data)) {
    if (cat.preferred_currency) preferredCurrency = cat.preferred_currency;
    const categoryByCurrency = cat.by_currency ?? {};
    for (const [currency, totals] of Object.entries(categoryByCurrency)) {
      if (!byCurrency[currency]) {
        byCurrency[currency] = { net: 0, original: 0 };
      }
      byCurrency[currency]!.net += Number(totals.net_amount ?? 0);
      byCurrency[currency]!.original += Number(totals.original_amount ?? 0);
    }
  }
  return {
    preferred_currency: preferredCurrency,
    net: Object.values(data).reduce((sum, cat) => sum + Number(cat.net_amount ?? 0), 0),
    original: Object.values(data).reduce((sum, cat) => sum + Number(cat.original_amount ?? 0), 0),
    by_currency: Object.fromEntries(
      Object.entries(byCurrency).map(([currency, totals]) => [
        currency,
        {
          net: round2(totals.net),
          original: round2(totals.original),
        },
      ]),
    ),
  };
}

function buildCategoryBlock(data: Record<string, budget.TransactionSummary>) {
  return {
    total: sumTransactionSummary(data),
    by_category: data,
  };
}

export async function getLegacyCategorySummary(startDate: string, endDate: string, userId: number) {
  const [incomeData, expenseData, transferData] = await Promise.all([
    budget.getTransactionsByCategories(startDate, endDate, userId, "income"),
    budget.getTransactionsByCategories(startDate, endDate, userId, "expense"),
    budget.getTransactionsByCategories(startDate, endDate, userId, "transfer"),
  ]);
  return {
    income: buildCategoryBlock(incomeData),
    expense: buildCategoryBlock(expenseData),
    transfer: buildCategoryBlock(transferData),
  };
}

export async function listLegacyBudgets(
  query: Record<string, unknown>,
  userId: number,
  set: { status?: number | string },
) {
  const parsed = parseYearMonthQuery(query);
  if (!parsed.success) {
    set.status = 400;
    return { error: parsed.error };
  }
  const { year, month } = parsed;

  let q = db()
    .selectFrom(TABLE)
    .select(["id", "category", "year", "month", "amount", "created_at", "updated_at"])
    .where("user_id", "=", userId);

  if (year !== undefined) q = q.where("year", "=", year);
  if (month !== undefined) q = q.where("month", "=", month);

  const rows = await q
    .orderBy("year", "desc")
    .orderBy("month", "desc")
    .orderBy("category")
    .execute();
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
  }));
}

async function compareLegacyBudgets(
  query: Record<string, unknown>,
  userId: number,
  set: { status?: number | string },
) {
  const parsed = parseYearMonthQuery(query, { required: true });
  if (!parsed.success) {
    set.status = 400;
    return { error: parsed.error };
  }
  const { year, month, start_date: startDate, end_date: endDate } = parsed;
  if (!startDate || !endDate) throw new Error("start_date and end_date required");

  const budgets = await db()
    .selectFrom(TABLE)
    .select(["category", "amount"])
    .where("user_id", "=", userId)
    .where("year", "=", year!)
    .where("month", "=", month!)
    .execute();

  const expenses = await budget.getTransactionsByCategories(startDate, endDate, userId, "expense");
  const expenseMap = new Map(
    Object.entries(expenses).map(([category, summary]) => [
      category,
      Number(summary.net_amount ?? 0),
    ]),
  );

  const result = budgets.map((row) => {
    const budgeted = Number(row.amount);
    const actual = round2(expenseMap.get(row.category) ?? 0);
    expenseMap.delete(row.category);
    return {
      category: row.category,
      budgeted,
      actual,
      difference: budgeted - actual,
      percentage: budgeted > 0 ? (actual / budgeted) * 100 : 0,
    };
  });

  for (const [category, amount] of expenseMap.entries()) {
    result.push({
      category,
      budgeted: 0,
      actual: round2(amount),
      difference: -round2(amount),
      percentage: 100,
    });
  }

  return result;
}

export const budgetsRoutes = new Elysia({
  prefix: "/budgets",
  tags: ["budgets"],
})
  .use(authDerivePlugin)
  // Category metadata endpoints – match legacy Python API shape
  .get("/categories", () => categoriesByType)
  .get(
    "/categories/summary",
    ({ query, userId, set }) =>
      withDateRange({ query: query as Record<string, unknown>, set, userId }, (s, e) =>
        getLegacyCategorySummary(s, e, userId!),
      ),
    { query: tBudgetsDateRangeQuerySchema },
  )
  .get(
    "/summary",
    ({ query, userId, set }) =>
      withDateRange({ query: query as Record<string, unknown>, set, userId }, (s, e) =>
        budget.getBudgetSummary(s, e, userId!),
      ),
    { query: tBudgetsDateRangeQuerySchema },
  )
  .get(
    "/summary/period",
    async ({ query, userId, set }) => {
      requireAuth({ userId });
      const q = query as Record<string, unknown>;
      const parsed = parseDateRangeOr400(q, set);
      if ("error" in parsed) return parsed.error;

      const periodRaw = typeof q.period === "string" ? q.period.trim() : "";
      if (!periodRaw) {
        set.status = 400;
        return { error: "start_date, end_date, and period are required" };
      }
      if (!VALID_PERIODS.includes(periodRaw as PeriodType)) {
        set.status = 400;
        return { error: "period must be one of: week, month, quarter, year" };
      }
      const period = periodRaw as PeriodType;

      if (parsed.start > parsed.end) {
        set.status = 400;
        return { error: "start_date must be before end_date" };
      }

      const periodSummaries: Array<{
        start_date: string;
        end_date: string;
        income: unknown;
        expense: unknown;
      }> = [];

      let [currentStart] = budget.calculatePeriodBoundaries(parsed.start, period);

      while (currentStart < parsed.end) {
        const [, currentEnd] = budget.calculatePeriodBoundaries(currentStart, period);
        const startStr = currentStart.toISOString().slice(0, 10);
        const endStr = currentEnd.toISOString().slice(0, 10);

        const [incomeData, expenseData] = await Promise.all([
          budget.getTransactionsByCategories(startStr, endStr, userId!, "income"),
          budget.getTransactionsByCategories(startStr, endStr, userId!, "expense"),
        ]);
        periodSummaries.push({
          start_date: startStr,
          end_date: endStr,
          income: buildCategoryBlock(incomeData),
          expense: buildCategoryBlock(expenseData),
        });

        currentStart = budget.getNextPeriodStart(currentStart, period);
      }

      return {
        period,
        summaries: periodSummaries,
      };
    },
    {
      query: tBudgetsSummaryPeriodQuerySchema,
    },
  )
  .get(
    "/transactions_by_categories",
    async ({ query, userId, set }) => {
      requireAuth({ userId });
      const dateParsed = parseDateRangeOr400(query as Record<string, unknown>, set);
      if ("error" in dateParsed) return dateParsed.error;
      const type =
        typeof (query as Record<string, unknown>)?.type === "string"
          ? String((query as Record<string, unknown>).type)
          : "expense";
      const typeError = validateCategoryType(type);
      if (typeError) {
        set.status = 400;
        return typeError;
      }
      return budget.getTransactionsByCategories(
        dateParsed.start_date,
        dateParsed.end_date,
        userId!,
        type as CategoryType,
      );
    },
    {
      query: tBudgetsTransactionsByCategoriesQuerySchema,
    },
  )
  // Legacy Python route aliases under /budgets/budgets (same handlers as / and /:id)
  .get(
    "/budgets",
    async ({ query, userId, set }) => {
      requireAuth({ userId });
      return listLegacyBudgets(query as Record<string, unknown>, userId!, set);
    },
    { query: tBudgetsLegacyListQuerySchema },
  )
  .post("/budgets", createCreateHandler(TABLE, budgetCreateTransform), {
    body: tBudgetUpsertSchema,
  })
  .get(
    "/budgets/compare",
    async ({ query, userId, set }) => {
      requireAuth({ userId });
      return compareLegacyBudgets(query as Record<string, unknown>, userId!, set);
    },
    { query: tBudgetsCompareQuerySchema },
  )
  .get("/categories/:category_type", ({ params, set }) => {
    const err = validateCategoryType(params.category_type);
    if (err) {
      set.status = 400;
      return err;
    }
    return categoriesByType[params.category_type as CategoryType];
  })
  .get("/", budgetsListHandler, {
    query: tBaseListQuerySchema,
  })
  .post("/", createCreateHandler(TABLE, budgetCreateTransform), {
    body: tBudgetUpsertSchema,
  })
  .put("/budgets/:id", createUpdateHandler(TABLE, budgetUpdateTransform), {
    body: tBudgetUpdateSchema,
  })
  .delete("/budgets/:id", createDeleteByIdHandler(TABLE))
  .get("/:id", createGetByIdHandler(TABLE))
  .put("/:id", createUpdateHandler(TABLE, budgetUpdateTransform), {
    body: tBudgetUpdateSchema,
  })
  .delete("/:id", createDeleteByIdHandler(TABLE));
