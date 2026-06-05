/**
 * Central exports for agent list tools — same handlers as HTTP routes.
 */
import { accountsListHandler } from "../routes/accounts.js";
import { assetsListHandler } from "../routes/assets.js";
import { banksListHandler } from "../routes/banks.js";
import { budgetsListHandler, listLegacyBudgets } from "../routes/budgets.js";
import { listInvestmentsForUser } from "../routes/investments.js";
import {
  liabilitiesListHandler,
  liabilitiesMissedPaymentsHandler,
  liabilitiesPaymentStatusHandler,
  liabilitiesUpcomingPaymentsHandler,
} from "../routes/liabilities.js";
import { refundGroupsListHandler } from "../routes/refund_groups.js";
import { refundItemsListHandler } from "../routes/refund_items.js";
import { listTransactionsHandler, type TransactionsListContext } from "../routes/transactions.js";
import { requireAuth } from "../middleware/auth.js";
import { normalizeListQuery } from "../schemas/common.js";
import { getPotentialRefunds } from "./potentialRefunds.js";
import { listLiabilityPayments } from "./liability.js";
import { extractFiltersFromQuery } from "../utils/query.js";
import type { ListHandlerContext } from "../utils/crudHandlers.js";

export {
  accountsListHandler,
  assetsListHandler,
  banksListHandler,
  budgetsListHandler,
  liabilitiesListHandler,
  liabilitiesPaymentStatusHandler,
  liabilitiesUpcomingPaymentsHandler,
  liabilitiesMissedPaymentsHandler,
  listLegacyBudgets,
  listTransactionsHandler,
  refundGroupsListHandler,
  refundItemsListHandler,
};

const LIABILITY_PAYMENT_FILTER_KEYS = [
  "id",
  "liability_id",
  "payment_date",
  "amount",
  "principal_amount",
  "interest_amount",
  "extra_payment",
  "transaction_id",
] as const;

export async function liabilityPaymentsListHandler(ctx: ListHandlerContext) {
  requireAuth({ userId: ctx.userId });
  const listQuery = normalizeListQuery((ctx.query as Record<string, unknown>) ?? {});
  const rawQuery = (ctx.query as Record<string, unknown>) ?? {};
  const filters = extractFiltersFromQuery(rawQuery, [...LIABILITY_PAYMENT_FILTER_KEYS]);
  return listLiabilityPayments(ctx.userId!, {
    page: listQuery.page,
    per_page: listQuery.per_page,
    sort_by: listQuery.sort_by,
    sort_order: listQuery.sort_order,
    filters,
  });
}

export async function potentialRefundsListHandler(ctx: {
  query: unknown;
  userId: number | null;
  set: { status?: number | string };
}) {
  requireAuth({ userId: ctx.userId });
  const limit = Math.min(
    Math.max(1, parseInt(String((ctx.query as Record<string, unknown>).limit), 10) || 50),
    200,
  );
  const items = await getPotentialRefunds(ctx.userId!, limit);
  return { items, total: items.length, page: 1, per_page: limit };
}

export async function investmentsListHandler(ctx: ListHandlerContext) {
  requireAuth({ userId: ctx.userId });
  return listInvestmentsForUser(ctx.userId!, (ctx.query as Record<string, unknown>) ?? {});
}

export async function budgetsLegacyListHandler(ctx: ListHandlerContext) {
  requireAuth({ userId: ctx.userId });
  const rows = await listLegacyBudgets(
    (ctx.query as Record<string, unknown>) ?? {},
    ctx.userId!,
    ctx.set,
  );
  if (rows && typeof rows === "object" && "error" in rows) {
    return rows;
  }
  const items = Array.isArray(rows) ? rows : [];
  return { items, total: items.length, page: 1, per_page: items.length };
}

export type AgentListHandlerFn = (ctx: ListHandlerContext) => Promise<unknown>;

const transactionsListAdapter: AgentListHandlerFn = (ctx) =>
  listTransactionsHandler(ctx as TransactionsListContext);

const paymentStatusAdapter: AgentListHandlerFn = (ctx) =>
  liabilitiesPaymentStatusHandler({
    query: ctx.query as Record<string, unknown>,
    userId: ctx.userId,
    set: ctx.set,
  });

const upcomingPaymentsAdapter: AgentListHandlerFn = (ctx) =>
  liabilitiesUpcomingPaymentsHandler({
    query: ctx.query as Record<string, unknown>,
    userId: ctx.userId,
    set: ctx.set,
  });

export const AGENT_LIST_HANDLER_EXPORTS: Record<string, AgentListHandlerFn> = {
  banksListHandler,
  accountsListHandler,
  assetsListHandler,
  refundGroupsListHandler,
  refundItemsListHandler,
  listTransactionsHandler: transactionsListAdapter,
  liabilitiesListHandler,
  liabilityPaymentsListHandler,
  budgetsListHandler,
  budgetsLegacyListHandler,
  investmentsListHandler,
  potentialRefundsListHandler,
  liabilitiesPaymentStatusHandler: paymentStatusAdapter,
  liabilitiesUpcomingPaymentsHandler: upcomingPaymentsAdapter,
};
