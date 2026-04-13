import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { authDerivePlugin } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { logRequest, logResponse } from "./middleware/log";
import { accountsRoutes } from "./routes/accounts";
import { assetsRoutes } from "./routes/assets";
import { banksRoutes } from "./routes/banks";
import { budgetsRoutes } from "./routes/budgets";
import { gocardlessRoutes } from "./routes/gocardless";
import { investmentsRoutes } from "./routes/investments";
import { liabilitiesRoutes } from "./routes/liabilities";
import { liabilityPaymentsRoutes } from "./routes/liability_payments";
import { potentialRefundsRoutes } from "./routes/potential_refunds";
import { refundGroupsRoutes } from "./routes/refund_groups";
import { refundItemsRoutes } from "./routes/refund_items";
import { stocksRoutes } from "./routes/stocks";
import { transactionsRoutes } from "./routes/transactions";
import { usersRoutes } from "./routes/users";

export const app = new Elysia()
  .use(
    cors({
      origin: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  )
  .use(authDerivePlugin)
  .derive(() => ({
    _requestStart: Date.now(),
    _errorRef: { current: null as string | null },
  }))
  .onError(errorHandler)
  .onRequest(logRequest)
  .onAfterResponse(
    ({
      request,
      set,
      _requestStart,
      _errorRef,
      userId,
    }: {
      request: Request;
      set: { status?: number | string };
      _requestStart?: number;
      _errorRef?: { current: string | null };
      userId?: number | null;
    }) => {
      const status = typeof set?.status === "number" ? set.status : 200;
      const durationMs = _requestStart != null ? Date.now() - _requestStart : undefined;
      const reason = _errorRef?.current ?? undefined;
      logResponse({ request, status, durationMs, reason, userId });
    },
  )
  .get("/health", () => ({ status: "ok" }), {
    detail: { tags: ["Health"], summary: "Health check" },
  })
  .use(usersRoutes)
  .use(banksRoutes)
  .use(accountsRoutes)
  .use(transactionsRoutes)
  .use(assetsRoutes)
  .use(refundGroupsRoutes)
  .use(refundItemsRoutes)
  .use(potentialRefundsRoutes)
  .use(budgetsRoutes)
  .use(investmentsRoutes)
  .use(stocksRoutes)
  .use(liabilitiesRoutes)
  .use(liabilityPaymentsRoutes)
  .use(gocardlessRoutes)
  .use(
    openapi({
      documentation: {
        info: {
          title: "Wealth Backend API",
          version: "0.1.0",
          description:
            "API for the wealth management backend. **Authentication:** All endpoints except `/health` and `/users/register` require the header `Authorization: Bearer <access_token>`. Use **Authorize** above to set the token. **Query params** for list endpoints: `page`, `per_page`, `sort_by`, `sort_order`, `search`, `search_fields`, `fields`, plus resource-specific filters (see each endpoint description).",
        },
        tags: [
          { name: "Health", description: "Health check" },
          { name: "users", description: "Auth and user management" },
          { name: "accounts", description: "Bank accounts" },
          { name: "transactions", description: "Transactions" },
          { name: "assets", description: "Assets and account assets" },
          { name: "budgets", description: "Budgets and categories" },
          { name: "investments", description: "Investments and portfolio" },
          { name: "liabilities", description: "Liabilities and payments" },
          { name: "refunds", description: "Refund groups and items" },
        ],
        components: {
          securitySchemes: {
            bearer: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description: "JWT access token",
            },
          },
        },
        security: [{ bearer: [] }],
      },
      path: "/openapi",
    }),
  );

export type App = typeof app;
