import { Elysia } from "elysia";
import { authDerivePlugin, requireAuth } from "../middleware/auth.js";
import {
  tCustomPriceBatchBodySchema,
  tCustomPriceBatchDeleteBodySchema,
  tCustomPriceBodySchema,
  tStocksHistoryQuerySchema,
  tStocksSearchQuerySchema,
} from "../schemas/typebox.js";
import * as customPrices from "../services/customPrices.js";
import * as market from "../services/market.js";

export const stocksRoutes = new Elysia({ prefix: "/stocks", tags: ["investments"] })
  .use(authDerivePlugin)
  .get(
    "/search",
    async ({ query, userId }) => {
      requireAuth({ userId });
      const q = (query as { q: string }).q.trim();
      return market.searchAssets(q);
    },
    { query: tStocksSearchQuerySchema },
  )
  .get("/:symbol/custom-prices", async ({ params, userId, set }) => {
    requireAuth({ userId });
    const symbol = (params.symbol ?? "").trim();
    if (!symbol) {
      set.status = 400;
      return { error: "Missing symbol" };
    }
    return customPrices.listCustomPrices(userId!, symbol);
  })
  .post(
    "/:symbol/custom-prices",
    async ({ params, body, userId, set }) => {
      requireAuth({ userId });
      const symbol = (params.symbol ?? "").trim();
      if (!symbol) {
        set.status = 400;
        return { error: "Missing symbol" };
      }
      const result = await customPrices.upsertCustomPrice(userId!, symbol, body);
      set.status = 201;
      return result;
    },
    { body: tCustomPriceBodySchema },
  )
  .post(
    "/:symbol/custom-prices/batch",
    async ({ params, body, userId, set }) => {
      requireAuth({ userId });
      const symbol = (params.symbol ?? "").trim();
      if (!symbol) {
        set.status = 400;
        return { error: "Missing symbol" };
      }
      return customPrices.batchUpsertCustomPrices(userId!, symbol, body.prices);
    },
    { body: tCustomPriceBatchBodySchema },
  )
  .post(
    "/:symbol/custom-prices/batch/delete",
    async ({ params, body, userId, set }) => {
      requireAuth({ userId });
      const symbol = (params.symbol ?? "").trim();
      if (!symbol) {
        set.status = 400;
        return { error: "Missing symbol" };
      }
      return customPrices.batchDeleteCustomPrices(userId!, symbol, body.dates);
    },
    { body: tCustomPriceBatchDeleteBodySchema },
  )
  .delete("/:symbol/custom-prices/:date", async ({ params, userId, set }) => {
    requireAuth({ userId });
    const symbol = (params.symbol ?? "").trim();
    if (!symbol) {
      set.status = 400;
      return { error: "Missing symbol" };
    }
    const date = (params.date ?? "").trim();
    if (!date) {
      set.status = 400;
      return { error: "Missing date" };
    }
    return customPrices.deleteCustomPrice(userId!, symbol, date);
  })
  .get("/:symbol", async ({ params, userId, set }) => {
    requireAuth({ userId });
    const symbol = (params.symbol ?? "").trim();
    if (!symbol) {
      set.status = 400;
      return { error: "Missing symbol" };
    }
    const info = await market.getQuote(symbol);
    if (!info) {
      set.status = 404;
      return "";
    }
    return info;
  })
  .get(
    "/:symbol/history",
    async ({ params, query, userId, set }) => {
      requireAuth({ userId });
      const symbol = (params.symbol ?? "").trim();
      if (!symbol) {
        set.status = 400;
        return { error: "Missing symbol" };
      }
      const periodRaw = (query as { period?: string }).period;
      const period = typeof periodRaw === "string" && periodRaw.trim() ? periodRaw.trim() : "max";
      return market.getHistoricalPrices(symbol, period);
    },
    { query: tStocksHistoryQuerySchema },
  )
  .get("/:symbol/summary", async ({ params, userId, set }) => {
    requireAuth({ userId });
    const symbol = (params.symbol ?? "").trim();
    if (!symbol) {
      set.status = 400;
      return { error: "Missing symbol" };
    }
    const summary = await market.getQuoteSummary(symbol);
    if (!summary) {
      set.status = 404;
      return "";
    }
    return summary;
  });
