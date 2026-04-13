import { Elysia, t } from "elysia";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { authDerivePlugin, requireAuth } from "../middleware/auth.js";
import { normalizeListQuery } from "../schemas/common.js";
import {
  tBatchCreateBodySchema,
  tBatchUpdateBodySchema,
  tCreateInvestmentSchema,
  tIdParamSchema,
  tBaseListQuerySchema,
  tInvestmentsPortfolioPerformanceQuerySchema,
  tInvestmentsPortfolioSummaryQuerySchema,
  tUpdateInvestmentSchema,
} from "../schemas/typebox.js";
import * as investmentService from "../services/investment.js";
import * as market from "../services/market.js";
import { getPortfolioPerformance } from "../services/portfolioPerformance.js";
import { getPortfolioSummary } from "../services/portfolioSummary.js";
import type { ListResponse } from "../types/index.js";
import { extractBatchIds } from "../utils/body.js";
import { errorMessage } from "../utils/error.js";
import { coerceNumericJsonFieldsMany } from "../utils/jsonNumeric.js";
import { withIdParam } from "../utils/params.js";

export interface InvestmentListItem {
  id: number;
  date: string;
  amount: string;
  description: string;
  from_account_id: number;
  to_account_id: number;
  asset_id: number | null;
  quantity: string;
  unit_price: string;
  fee: string;
  tax: string;
  total_paid: string | null;
  activity_type: string;
  /** Same as activity_type; included for clients that expect investment_details.investment_type naming. */
  investment_type: string;
}

const tInvestmentDetailSchema = t.Object({
  transaction_id: t.Number(),
  investment_type: t.Union([
    t.Literal("Buy"),
    t.Literal("Sell"),
    t.Literal("Dividend"),
    t.Literal("Interest"),
    t.Literal("Deposit"),
    t.Literal("Withdrawal"),
  ]),
  asset_id: t.Number(),
  fee: t.Number(),
  quantity: t.Number(),
  tax: t.Number(),
  total_paid: t.Optional(t.Number()),
  unit_price: t.Number(),
  user_id: t.Number(),
  pl_transaction_id: t.Nullable(t.Number()),
  fee_transaction_id: t.Nullable(t.Number()),
  tax_transaction_id: t.Nullable(t.Number()),
  gain_loss_override: t.Nullable(t.Number()),
  gain_loss_source: t.Nullable(t.String()),
  gain_loss_calculated: t.Nullable(t.Number()),
  asset_name: t.Nullable(t.String()),
  asset_symbol: t.String(),
});

const tInvestmentDetailResponseSchema = t.Object({
  investment: tInvestmentDetailSchema,
  transactions: t.Array(
    t.Object({
      id: t.Number(),
      user_id: t.Number(),
      date: t.String(),
      date_accountability: t.String(),
      description: t.String(),
      amount: t.String(),
      to_amount: t.Nullable(t.String()),
      to_currency: t.Nullable(t.String()),
      from_account_id: t.Number(),
      to_account_id: t.Number(),
      category: t.String(),
      subcategory: t.Nullable(t.String()),
      type: t.String(),
      investment_id: t.Nullable(t.Number()),
    }),
  ),
});

const portfolioStub = async ({ userId }: { userId: number | null }) => {
  requireAuth({ userId });
  return {};
};

export const investmentsRoutes = new Elysia({ prefix: "/investments", tags: ["investments"] })
  .use(authDerivePlugin)
  .post(
    "/",
    async ({ body, userId, set }) => {
      requireAuth({ userId });
      if (body.asset_id == null && (body.symbol == null || String(body.symbol).trim() === "")) {
        set.status = 400;
        return { error: "Either asset_id or symbol is required" };
      }
      const result = await investmentService.createInvestment(
        userId!,
        body as Parameters<typeof investmentService.createInvestment>[1],
      );
      set.status = 201;
      return result;
    },
    {
      body: tCreateInvestmentSchema,
    },
  )
  .get(
    "/",
    async ({ query, userId }): Promise<ListResponse<InvestmentListItem>> => {
      requireAuth({ userId });
      const q = normalizeListQuery(query as Record<string, unknown>);
      const database = db();
      const baseQ = database
        .selectFrom("transactions")
        .innerJoin("investment_details", "investment_details.transaction_id", "transactions.id")
        .where("transactions.user_id", "=", userId!);
      const [[countResult], items] = await Promise.all([
        baseQ.select((eb) => eb.fn.countAll().as("total")).execute(),
        baseQ
          .select([
            "transactions.id",
            "transactions.date",
            "transactions.amount",
            "transactions.description",
            "transactions.from_account_id",
            "transactions.to_account_id",
            "investment_details.asset_id",
            "investment_details.quantity",
            "investment_details.unit_price",
            "investment_details.fee",
            "investment_details.tax",
            "investment_details.total_paid",
            "investment_details.investment_type as activity_type",
            "investment_details.investment_type as investment_type",
          ])
          .orderBy("transactions.date", "desc")
          .orderBy("transactions.id", "desc")
          .limit(q.per_page)
          .offset((q.page - 1) * q.per_page)
          .execute(),
      ]);
      const total = Number(countResult?.total ?? 0);
      return {
        items: coerceNumericJsonFieldsMany(items as unknown as Record<string, unknown>[], [
          "transactions",
          "investment_details",
        ]) as unknown as InvestmentListItem[],
        total,
        page: q.page,
        per_page: q.per_page,
      };
    },
    {
      query: tBaseListQuerySchema,
    },
  )
  .get(
    "/portfolio/summary",
    async ({ query, userId, set }) => {
      requireAuth({ userId });
      const accountIdParam = (query as { account_id?: string }).account_id;
      const accountId =
        accountIdParam != null && accountIdParam !== "" ? parseInt(accountIdParam, 10) : undefined;
      if (accountIdParam != null && (accountId == null || !Number.isInteger(accountId))) {
        set.status = 400;
        return { error: "account_id must be a valid integer" };
      }
      const summary = await getPortfolioSummary(userId!, accountId);
      return summary;
    },
    {
      query: tInvestmentsPortfolioSummaryQuerySchema,
    },
  )
  .get(
    "/portfolio/performance",
    async ({ query, userId }) => {
      requireAuth({ userId });
      const period = (query as { period?: string }).period;
      const result = await getPortfolioPerformance(userId!, period);
      return result;
    },
    {
      query: tInvestmentsPortfolioPerformanceQuerySchema,
    },
  )
  .get("/portfolio/risk-metrics", portfolioStub)
  .get("/portfolio/analysis", portfolioStub)
  .get("/portfolio/attribution", portfolioStub)
  .get("/portfolio/dividend-analysis", portfolioStub)
  .get("/portfolio/correlation", portfolioStub)
  .get("/portfolio/rebalancing", portfolioStub)
  .get("/portfolio/tax-analysis", portfolioStub)
  .get("/portfolio/benchmarks", portfolioStub)
  .get("/assets", async ({ userId }) => {
    requireAuth({ userId });
    const database = db();
    const rows = await database
      .selectFrom("asset_balances_by_account")
      .select(["asset_id", "symbol", "asset_name"])
      .where("user_id", "=", userId!)
      .distinct()
      .execute();
    const seen = new Set<number>();
    const assets = (rows ?? []).filter((r: { asset_id: number }) => {
      if (seen.has(r.asset_id)) return false;
      seen.add(r.asset_id);
      return true;
    });
    return assets.map((r) => ({
      asset_id: r.asset_id,
      symbol: r.symbol,
      name: String(r.asset_name ?? r.symbol ?? ""),
    }));
  })
  .get("/assets/:symbol/transactions", async ({ params, userId }) => {
    requireAuth({ userId });
    const database = db();
    const symbolNorm = params.symbol.trim().toUpperCase();
    const asset = await database
      .selectFrom("assets")
      .select("id")
      .where("user_id", "=", userId!)
      .where(sql<boolean>`UPPER(TRIM(symbol)) = ${symbolNorm}`)
      .executeTakeFirst();
    if (!asset) return [];
    const rows = await database
      .selectFrom("investment_details")
      .innerJoin("transactions", "transactions.id", "investment_details.transaction_id")
      .select([
        "investment_details.transaction_id as id",
        "transactions.date",
        "investment_details.investment_type as activity_type",
        "investment_details.quantity",
        "investment_details.unit_price",
        "investment_details.total_paid as total_paid",
        "investment_details.fee",
        "investment_details.tax",
      ])
      .where("transactions.user_id", "=", userId!)
      .where("investment_details.asset_id", "=", asset.id)
      .orderBy("transactions.date", "desc")
      .execute();
    return (rows ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      activity_type: r.activity_type,
      quantity: Number(r.quantity),
      unit_price: Number(r.unit_price),
      total_paid: r.total_paid != null ? Number(r.total_paid) : null,
      fee: Number(r.fee ?? 0),
      tax: Number(r.tax ?? 0),
    }));
  })
  .get("/assets/:symbol/analysis", async ({ params, userId, set }) => {
    requireAuth({ userId });
    const symbol = params.symbol.trim();
    const quote = await market.getQuote(symbol);
    const summary = await market.getQuoteSummary(symbol);
    const history = await market.getHistoricalPrices(symbol, "1y");
    if (!quote && !summary) {
      set.status = 404;
      return { error: "Asset not found" };
    }
    return {
      quote: quote ?? null,
      summary: summary ?? null,
      history_1y: history,
    };
  })
  .get(
    "/:id",
    (({
      params,
      userId,
      set,
    }: {
      params: { id: string };
      userId: number | null;
      set: { status?: number | string };
    }) =>
      withIdParam({ params, userId, set }, async (id) => {
        const result = await investmentService.getInvestmentById(id, userId!);
        if (!result) {
          set.status = 404;
          return "";
        }
        return result;
      })) as any,
    {
      params: tIdParamSchema,
      response: {
        200: tInvestmentDetailResponseSchema,
      },
    },
  )
  .put(
    "/:id",
    ({ params, body, userId, set }) =>
      withIdParam({ params, userId, set }, async (id) => {
        const row = await investmentService.updateInvestment(
          id,
          userId!,
          body as Parameters<typeof investmentService.updateInvestment>[2],
        );
        if (!row) {
          set.status = 404;
          return "";
        }
        return row;
      }),
    {
      body: tUpdateInvestmentSchema,
    },
  )
  .delete("/:id", ({ params, userId, set }) =>
    withIdParam({ params, userId, set }, async (id) => {
      const ok = await investmentService.deleteInvestment(id, userId!);
      if (!ok) {
        set.status = 404;
        return "";
      }
      set.status = 204;
      return "";
    }),
  )
  .post(
    "/batch/create",
    async ({ body, userId }) => {
      requireAuth({ userId });
      const items =
        (body as { items?: Parameters<typeof investmentService.createInvestment>[1][] }).items ??
        [];
      const successful: Array<Awaited<ReturnType<typeof investmentService.createInvestment>>> = [];
      const failed: Array<{
        data: Parameters<typeof investmentService.createInvestment>[1];
        error: string;
      }> = [];
      for (const item of items) {
        if (item.asset_id == null && (item.symbol == null || String(item.symbol).trim() === "")) {
          failed.push({ data: item, error: "Either asset_id or symbol is required" });
          continue;
        }
        try {
          const result = await investmentService.createInvestment(
            userId!,
            item as Parameters<typeof investmentService.createInvestment>[1],
          );
          successful.push(result);
        } catch (e) {
          failed.push({
            data: item,
            error: errorMessage(e),
          });
        }
      }
      return {
        successful,
        failed,
        total_successful: successful.length,
        total_failed: failed.length,
      };
    },
    {
      body: tBatchCreateBodySchema(tCreateInvestmentSchema),
    },
  )
  .post(
    "/batch/update",
    async ({ body, userId }) => {
      requireAuth({ userId });
      const items = (body as { items?: Record<string, unknown>[] }).items ?? [];
      const successful: Array<Awaited<ReturnType<typeof investmentService.updateInvestment>>> = [];
      const failed: Array<{ id?: number; error: string; data?: Record<string, unknown> }> = [];
      for (const rawItem of items) {
        const item = rawItem as Record<string, unknown>;
        const idValue = item.id;
        const id = typeof idValue === "number" && Number.isInteger(idValue) ? idValue : undefined;
        if (id == null || id < 1) {
          failed.push({
            id: typeof idValue === "number" ? idValue : undefined,
            error: "Valid id is required",
            data: item,
          });
          continue;
        }
        // Remove id from body before passing to service
        const { id: _omit, ...rest } = item;
        try {
          const result = await investmentService.updateInvestment(
            id,
            userId!,
            rest as Parameters<typeof investmentService.updateInvestment>[2],
          );
          if (result) {
            successful.push(result);
          } else {
            failed.push({ id, error: "Not found or unauthorized", data: item });
          }
        } catch (e) {
          failed.push({ id, error: errorMessage(e), data: item });
        }
      }
      return {
        successful,
        failed,
        total_successful: successful.length,
        total_failed: failed.length,
      };
    },
    {
      body: tBatchUpdateBodySchema,
    },
  )
  .post("/batch/delete", async ({ body, userId, set }) => {
    requireAuth({ userId });
    const idNumbers = extractBatchIds(body);
    if (idNumbers.length === 0) {
      set.status = 400;
      return { error: "ids array is required and must contain positive integers" };
    }
    const successful: number[] = [];
    const failed: Array<{ id: number; error: string }> = [];
    for (const id of idNumbers) {
      try {
        const ok = await investmentService.deleteInvestment(id, userId!);
        if (ok) successful.push(id);
        else failed.push({ id, error: "Not found or unauthorized" });
      } catch (e) {
        failed.push({ id, error: errorMessage(e) });
      }
    }
    return {
      successful,
      failed,
      total_successful: successful.length,
      total_failed: failed.length,
    };
  });
