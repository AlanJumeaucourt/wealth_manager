import { db } from "../db/client.js";
import { convert } from "../utils/currency.js";
import { round2 } from "../utils/money.js";
import { getPreferredCurrency } from "./account.js";

export type PeriodType = "week" | "month" | "quarter" | "year";

export function calculatePeriodBoundaries(startDate: Date, period: PeriodType): [Date, Date] {
  const y = startDate.getFullYear();
  const m = startDate.getMonth();
  const d = startDate.getDate();

  if (period === "week") {
    const day = startDate.getDay();
    const monday = new Date(startDate);
    monday.setDate(d - (day === 0 ? 6 : day - 1));
    const periodStart = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 6);
    return [periodStart, periodEnd];
  }
  if (period === "month") {
    const periodStart = new Date(y, m, 1);
    const periodEnd = new Date(y, m + 1, 0);
    return [periodStart, periodEnd];
  }
  if (period === "quarter") {
    const qStartMonth = Math.floor(m / 3) * 3;
    const periodStart = new Date(y, qStartMonth, 1);
    const periodEnd = new Date(y, qStartMonth + 3, 0);
    return [periodStart, periodEnd];
  }
  // year
  const periodStart = new Date(y, 0, 1);
  const periodEnd = new Date(y, 11, 31);
  return [periodStart, periodEnd];
}

export function getNextPeriodStart(currentStart: Date, period: PeriodType): Date {
  const next = new Date(currentStart);
  if (period === "week") {
    next.setDate(next.getDate() + 7);
  } else if (period === "month") {
    next.setMonth(next.getMonth() + 1);
  } else if (period === "quarter") {
    next.setMonth(next.getMonth() + 3);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

export interface TransactionSummaryTx {
  id: number;
  date: string;
  date_accountability: string;
  description: string;
  amount: number;
  net_amount: number;
  refunded_amount: number;
  from_account_id: number;
  to_account_id: number;
  category: string;
  subcategory: string | null;
}

export interface TransactionSummary {
  net_amount: number;
  original_amount: number;
  count: number;
  transactions: TransactionSummaryTx[];
}

interface BudgetTxRow {
  id: number;
  type: "income" | "expense" | "transfer";
  category: string;
  subcategory: string | null;
  amount: unknown;
  to_amount: unknown;
  from_account_id: number;
  to_account_id: number;
}

interface BudgetAccountInfo {
  type: string;
  currency: string;
}

interface BudgetImpactInput {
  tx: BudgetTxRow;
  fromAccount: BudgetAccountInfo | undefined;
  toAccount: BudgetAccountInfo | undefined;
  refunded: number;
}

interface BudgetImpactResult {
  include: boolean;
  originalAmount: number;
  netAmount: number;
  baseCurrency: string;
}

function computeBudgetImpact(input: BudgetImpactInput): BudgetImpactResult {
  const { tx, fromAccount, toAccount, refunded } = input;
  if (tx.type === "expense" && fromAccount?.type === "loan") {
    return { include: false, originalAmount: 0, netAmount: 0, baseCurrency: "EUR" };
  }

  const fromCurrency = fromAccount?.currency ?? "EUR";
  const toCurrency = toAccount?.currency ?? "EUR";
  const amountVal = Number(tx.amount ?? 0);
  const creditedVal = Number(tx.to_amount ?? tx.amount ?? 0);

  if (tx.type === "expense") {
    const originalAmount = amountVal;
    return {
      include: true,
      originalAmount,
      netAmount: Math.max(0, originalAmount - refunded),
      baseCurrency: fromCurrency,
    };
  }
  if (tx.type === "income") {
    const originalAmount = creditedVal;
    return {
      include: true,
      originalAmount,
      netAmount: Math.max(0, originalAmount - refunded),
      baseCurrency: toCurrency,
    };
  }

  return {
    include: true,
    originalAmount: amountVal,
    netAmount: amountVal,
    baseCurrency: fromCurrency,
  };
}

async function loadBudgetBaseData(
  startDate: string,
  endDate: string,
  userId: number,
  transactionType?: "income" | "expense" | "transfer",
) {
  const database = db();
  let txQuery = database
    .selectFrom("transactions")
    .select([
      "transactions.id",
      "transactions.type",
      "transactions.category",
      "transactions.subcategory",
      "transactions.amount",
      "transactions.to_amount",
      "transactions.from_account_id",
      "transactions.to_account_id",
    ])
    .where("transactions.user_id", "=", userId)
    .where("transactions.date_accountability", ">=", startDate)
    .where("transactions.date_accountability", "<=", endDate);

  if (transactionType) {
    txQuery = txQuery.where("transactions.type", "=", transactionType);
  }
  const txRows = (await txQuery.execute()) as BudgetTxRow[];
  if (txRows.length === 0) {
    return {
      txRows,
      accountMap: new Map<number, BudgetAccountInfo>(),
      refundMap: new Map<number, number>(),
    };
  }

  const accountIds = [
    ...new Set([...txRows.map((r) => r.from_account_id), ...txRows.map((r) => r.to_account_id)]),
  ];
  const accounts = await database
    .selectFrom("accounts")
    .select(["id", "type", "currency"])
    .where("user_id", "=", userId)
    .where("id", "in", accountIds)
    .execute();
  const accountMap = new Map<number, BudgetAccountInfo>(
    accounts.map((a) => [a.id, { type: a.type, currency: (a.currency ?? "EUR").toUpperCase() }]),
  );

  const txIds = txRows.map((r) => r.id);
  const refundRows = await database
    .selectFrom("refund_items")
    .select(["expense_transaction_id", "income_transaction_id", "amount"])
    .where((eb) =>
      eb.or([eb("expense_transaction_id", "in", txIds), eb("income_transaction_id", "in", txIds)]),
    )
    .execute();
  const refundMap = new Map<number, number>();
  for (const r of refundRows) {
    const expenseId = r.expense_transaction_id;
    const incomeId = r.income_transaction_id;
    const refundAmount = Number(r.amount ?? 0);
    if (expenseId != null) {
      refundMap.set(expenseId, (refundMap.get(expenseId) ?? 0) + refundAmount);
    }
    if (incomeId != null) {
      refundMap.set(incomeId, (refundMap.get(incomeId) ?? 0) + refundAmount);
    }
  }

  return { txRows, accountMap, refundMap };
}

export async function getTransactionsByCategories(
  startDate: string,
  endDate: string,
  userId: number,
  transactionType: "income" | "expense" | "transfer",
): Promise<Record<string, TransactionSummary>> {
  const preferred = await getPreferredCurrency(userId);
  const database = db();
  const txRows = await database
    .selectFrom("transactions")
    .select([
      "transactions.id",
      "transactions.date",
      "transactions.date_accountability",
      "transactions.description",
      "transactions.type",
      "transactions.category",
      "transactions.subcategory",
      "transactions.amount",
      "transactions.to_amount",
      "transactions.from_account_id",
      "transactions.to_account_id",
    ])
    .where("transactions.user_id", "=", userId)
    .where("transactions.type", "=", transactionType)
    .where("transactions.date_accountability", ">=", startDate)
    .where("transactions.date_accountability", "<=", endDate)
    .execute();

  if (txRows.length === 0) return {};

  const { accountMap, refundMap } = await loadBudgetBaseData(
    startDate,
    endDate,
    userId,
    transactionType,
  );

  const categorized: Record<string, TransactionSummary> = {};

  for (const row of txRows) {
    const fromAcc = accountMap.get(row.from_account_id);
    const toAcc = accountMap.get(row.to_account_id);
    const impact = computeBudgetImpact({
      tx: row as BudgetTxRow,
      fromAccount: fromAcc,
      toAccount: toAcc,
      refunded: refundMap.get(row.id) ?? 0,
    });
    if (!impact.include) continue;

    const category = row.category;
    if (!categorized[category]) {
      categorized[category] = {
        net_amount: 0,
        original_amount: 0,
        count: 0,
        transactions: [],
      };
    }
    const cat = categorized[category];

    const originalPref = await convert(impact.originalAmount, impact.baseCurrency, preferred);
    const netPref = await convert(impact.netAmount, impact.baseCurrency, preferred);
    const refundedPref = await convert(
      Math.max(0, impact.originalAmount - impact.netAmount),
      impact.baseCurrency,
      preferred,
    );

    cat.net_amount += netPref;
    cat.original_amount += originalPref;
    cat.count += 1;
    cat.transactions.push({
      id: row.id,
      date: String(row.date),
      date_accountability: String(row.date_accountability),
      description: row.description ?? "",
      amount: originalPref,
      net_amount: netPref,
      refunded_amount: refundedPref,
      from_account_id: row.from_account_id,
      to_account_id: row.to_account_id,
      category: row.category ?? "",
      subcategory: row.subcategory ?? null,
    });
  }

  for (const c of Object.values(categorized)) {
    c.net_amount = round2(c.net_amount);
    c.original_amount = round2(c.original_amount);
  }
  return categorized;
}

export interface BudgetSummarySubcategory {
  subcategory: string | null | undefined;
  net_amount: number;
  original_amount: number;
  transactions_related: string[];
}

export interface BudgetSummaryCategory {
  category: string | null | undefined;
  net_amount: number;
  original_amount: number;
  subcategories: BudgetSummarySubcategory[];
}

export async function getBudgetSummary(
  startDate: string,
  endDate: string,
  userId: number,
): Promise<BudgetSummaryCategory[]> {
  const preferred = await getPreferredCurrency(userId);
  const { txRows, accountMap, refundMap } = await loadBudgetBaseData(startDate, endDate, userId);

  const byCategory: Record<
    string,
    Record<string, { net: number; original: number; txIds: string[] }>
  > = {};

  for (const row of txRows) {
    const fromAcc = accountMap.get(row.from_account_id);
    const toAcc = accountMap.get(row.to_account_id);
    const impact = computeBudgetImpact({
      tx: row,
      fromAccount: fromAcc,
      toAccount: toAcc,
      refunded: refundMap.get(row.id) ?? 0,
    });
    if (!impact.include) continue;

    const category = row.category;
    const subcategory = row.subcategory ?? "";
    if (!byCategory[category]) byCategory[category] = {};
    if (!byCategory[category][subcategory]) {
      byCategory[category][subcategory] = { net: 0, original: 0, txIds: [] };
    }
    const sub = byCategory[category][subcategory];

    sub.original += await convert(impact.originalAmount, impact.baseCurrency, preferred);
    sub.net += await convert(impact.netAmount, impact.baseCurrency, preferred);
    sub.txIds.push(String(row.id));
  }

  return Object.entries(byCategory).map(([category, subcats]) => ({
    category,
    net_amount: Math.round(Object.values(subcats).reduce((s, v) => s + v.net, 0) * 100) / 100,
    original_amount:
      Math.round(Object.values(subcats).reduce((s, v) => s + v.original, 0) * 100) / 100,
    subcategories: Object.entries(subcats).map(([subcategory, v]) => ({
      subcategory,
      net_amount: round2(v.net),
      original_amount: round2(v.original),
      transactions_related: v.txIds,
    })),
  }));
}
