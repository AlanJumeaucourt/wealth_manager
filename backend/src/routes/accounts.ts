import { Elysia, t } from "elysia";
import { db } from "../db/client.js";
import { authDerivePlugin, requireAuth } from "../middleware/auth.js";
import { listQueryDescription } from "../schemas/openapi.js";
import {
  tBalanceOverTimeQuerySchema,
  tBatchCreateBodySchema,
  tBatchDeleteBodySchema,
  tBatchUpdateBodySchema,
  tCreateAccountSchema,
  tIdParamSchema,
  tAccountsListQuerySchema,
  tDateRangeQuerySchema,
  tListResponseSchema,
  tUpdateAccountSchema,
} from "../schemas/typebox.js";
import {
  enrichAccount,
  enrichAccountsBatch,
  getAccountBalanceHistory,
  getPreferredCurrency,
  resolveBodyCurrency,
  sumAccountsBalancesOverDays,
} from "../services/account.js";
import {
  createBatchCreateHandler,
  createBatchDeleteHandler,
  createBatchUpdateHandler,
  createCreateHandler,
  createDeleteByIdHandler,
  createGetByIdHandler,
  createListHandler,
  createUpdateHandler,
  withIdParamAndDateRange,
  withIdParamAndGetById,
} from "../utils/crudHandlers.js";
import { convert } from "../utils/currency.js";
import { round2 } from "../utils/money.js";
import { withDateRange } from "../utils/query.js";

const TABLE = "accounts" as const;
const WEALTH_ACCOUNT_TYPES = new Set(["checking", "savings", "investment", "loan"]);

const accountsBase = new Elysia({ prefix: "/accounts", tags: ["accounts"] })
  .use(authDerivePlugin)
  .get(
    "/balance_over_time",
    ({ query, userId, set }) =>
      withDateRange({ query: query as Record<string, unknown>, set, userId }, (start, end) => {
        const raw = query as { include_debt?: string };
        const includeDebt = raw.include_debt !== "false";
        return sumAccountsBalancesOverDays(userId!, start, end, undefined, { includeDebt });
      }),
    { query: tBalanceOverTimeQuerySchema },
  )
  .get("/wealth", async ({ userId, set: _set }) => {
    requireAuth({ userId });
    const database = db();
    const [accounts, preferred] = await Promise.all([
      database
        .selectFrom("accounts")
        .select(["id", "type", "currency"])
        .where("user_id", "=", userId!)
        .execute(),
      getPreferredCurrency(userId!),
    ]);
    const wealthAccounts = accounts.filter((acc: { type: string }) =>
      WEALTH_ACCOUNT_TYPES.has(acc.type),
    );
    if (wealthAccounts.length === 0) {
      return {
        total_balance: 0,
        checking_balance: 0,
        savings_balance: 0,
        investment_balance: 0,
        loan_balance: 0,
        preferred_currency: preferred,
      };
    }
    const accountIds = wealthAccounts.map((a: { id: number }) => a.id);
    const balanceRows = await database
      .selectFrom("account_balances")
      .select(["account_id", "current_balance"])
      .where("account_id", "in", accountIds)
      .execute();
    const balanceByAccountId = new Map<number, number>();
    for (const row of balanceRows) {
      balanceByAccountId.set(row.account_id, Number(row.current_balance ?? 0));
    }
    const converted = await Promise.all(
      wealthAccounts.map((acc: { id: number; type: string; currency?: string | null }) =>
        convert(balanceByAccountId.get(acc.id) ?? 0, acc.currency ?? "EUR", preferred),
      ),
    );
    const totals = {
      total_balance: 0,
      checking_balance: 0,
      savings_balance: 0,
      investment_balance: 0,
      loan_balance: 0,
      preferred_currency: preferred,
    };
    wealthAccounts.forEach((acc: { type: string }, i: number) => {
      const balPref = converted[i] ?? 0;
      totals.total_balance += balPref;
      if (acc.type === "checking") totals.checking_balance += balPref;
      else if (acc.type === "savings") totals.savings_balance += balPref;
      else if (acc.type === "investment") totals.investment_balance += balPref;
      else if (acc.type === "loan") totals.loan_balance += balPref;
    });
    totals.total_balance = round2(totals.total_balance);
    totals.checking_balance = round2(totals.checking_balance);
    totals.savings_balance = round2(totals.savings_balance);
    totals.investment_balance = round2(totals.investment_balance);
    totals.loan_balance = round2(totals.loan_balance);
    return totals;
  })
  .get("/:id/balance", ({ params, userId, set }) =>
    withIdParamAndGetById({ params, userId, set }, TABLE, (id) =>
      getAccountBalanceHistory(userId!, id),
    ),
  )
  .get(
    "/:id/balance_over_time",
    ({ params, query, userId, set }) =>
      withIdParamAndDateRange({ params, query, userId, set }, TABLE, (id, start, end) =>
        sumAccountsBalancesOverDays(userId!, start, end, id),
      ),
    { query: tDateRangeQuerySchema },
  );

async function accountCreateTransform(body: Record<string, unknown>, userId: number) {
  const currency = await resolveBodyCurrency(body, userId);
  return { ...body, currency, user_id: userId };
}

/**
 * GET list / GET by id: enrichAccount(s) add balance, balance_preferred, market_value.
 * Response schema must include these or TypeBox strips them (additionalProperties: false).
 */
const tAccountResponse = t.Object({
  id: t.Number(),
  user_id: t.Number(),
  name: t.String(),
  type: t.String(),
  bank_id: t.Number(),
  currency: t.String(),
  balance: t.Number(),
  balance_preferred: t.Number(),
  market_value: t.Union([t.Number(), t.Null()]),
});

const ACCOUNTS_TABLE = "accounts" as const;

const ACCOUNTS_LIST_CONFIG: {
  searchFields: string[];
  allowedFilters: string[];
} = {
  searchFields: ["name"],
  allowedFilters: ["id", "type", "bank_id"],
};

const accountsListHandler = createListHandler(ACCOUNTS_TABLE, {
  ...ACCOUNTS_LIST_CONFIG,
  useValidatedQuery: true as const,
  enrichItems: (items, userId) => enrichAccountsBatch(items, userId),
});
const accountsCreateHandler = createCreateHandler(ACCOUNTS_TABLE, accountCreateTransform);
const accountsGetByIdHandler = createGetByIdHandler(ACCOUNTS_TABLE, {
  enrich: (row, userId) => enrichAccount(row, userId),
});
const accountsUpdateHandler = createUpdateHandler(ACCOUNTS_TABLE);
const accountsDeleteHandler = createDeleteByIdHandler(ACCOUNTS_TABLE);
const accountsBatchCreateHandler = createBatchCreateHandler(ACCOUNTS_TABLE, accountCreateTransform);
const accountsBatchUpdateHandler = createBatchUpdateHandler(ACCOUNTS_TABLE);
const accountsBatchDeleteHandler = createBatchDeleteHandler(ACCOUNTS_TABLE);

const AUTH_NOTE = " **Header:** Authorization: Bearer <token>.";
const ACCOUNT_CURRENCY_NOTE =
  " **currency:** ISO code (e.g. EUR, RON). If omitted, null, or blank, the user's preferred currency from their profile is used.";
const RETURNS_LIST = " **Returns:** { items, total, page, per_page }.";

const accountsListDescription =
  listQueryDescription(ACCOUNTS_LIST_CONFIG.allowedFilters, ACCOUNTS_LIST_CONFIG.searchFields) +
  RETURNS_LIST +
  AUTH_NOTE;

export const accountsRoutes = accountsBase
  .post(
    "/",
    (ctx) =>
      accountsCreateHandler({
        body: ctx.body as Record<string, unknown>,
        // authDerivePlugin puts userId on context; cast to any to satisfy types.
        userId: (ctx as any).userId,
        set: (ctx as any).set,
      }) as any,
    {
      body: tCreateAccountSchema,
      detail: {
        summary: "Create account",
        description: "**Body:** from schema below." + ACCOUNT_CURRENCY_NOTE + AUTH_NOTE,
      },
    },
  )
  .get(
    "/",
    (ctx) =>
      accountsListHandler({
        query: ctx.query,
        request: ctx.request,
        userId: (ctx as any).userId,
        set: (ctx as any).set,
      }) as any,
    {
      query: tAccountsListQuerySchema,
      detail: {
        summary: "List accounts",
        description: accountsListDescription,
      },
      response: {
        200: tListResponseSchema(tAccountResponse),
      },
    },
  )
  .get(
    "/:id",
    (ctx) =>
      accountsGetByIdHandler({
        params: ctx.params!,
        userId: (ctx as any).userId,
        set: (ctx as any).set,
      }) as any,
    {
      params: tIdParamSchema,
      detail: {
        summary: "Get account by ID",
        description: "Returns 404 if not found or not owned." + AUTH_NOTE,
      },
      response: {
        200: tAccountResponse,
      },
    },
  )
  .put(
    "/:id",
    (ctx) =>
      accountsUpdateHandler({
        params: ctx.params!,
        body: ctx.body as Record<string, unknown>,
        userId: (ctx as any).userId,
        set: (ctx as any).set,
      }) as any,
    {
      body: tUpdateAccountSchema,
      detail: {
        summary: "Update account",
        description: "Partial update." + AUTH_NOTE,
      },
    },
  )
  .delete(
    "/:id",
    (ctx) =>
      accountsDeleteHandler({
        params: ctx.params!,
        userId: (ctx as any).userId,
        set: (ctx as any).set,
      }) as any,
    {
      params: tIdParamSchema,
      detail: {
        summary: "Delete account",
        description: "Returns 204." + AUTH_NOTE,
      },
    },
  )
  .post(
    "/batch/create",
    (ctx) =>
      accountsBatchCreateHandler({
        body: ctx.body,
        userId: (ctx as any).userId,
        set: (ctx as any).set,
      }) as any,
    {
      body: tBatchCreateBodySchema(tCreateAccountSchema),
      detail: {
        summary: "Create multiple accounts",
        description: ACCOUNT_CURRENCY_NOTE.trim() + " " + AUTH_NOTE.trim(),
      },
    },
  )
  .post(
    "/batch/update",
    (ctx) =>
      accountsBatchUpdateHandler({
        body: ctx.body,
        userId: (ctx as any).userId,
        set: (ctx as any).set,
      }) as any,
    {
      body: tBatchUpdateBodySchema,
      detail: {
        summary: "Update multiple accounts",
        description: AUTH_NOTE.trim(),
      },
    },
  )
  .post(
    "/batch/delete",
    (ctx) =>
      accountsBatchDeleteHandler({
        body: ctx.body,
        userId: (ctx as any).userId,
        set: (ctx as any).set,
      }) as any,
    {
      body: tBatchDeleteBodySchema,
      detail: {
        summary: "Delete multiple accounts",
        description: AUTH_NOTE.trim(),
      },
    },
  );
