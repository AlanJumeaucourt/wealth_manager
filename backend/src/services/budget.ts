import { db } from "../db/client.js";
import { getExchangeRateAtDate, getExchangeRatesInRange } from "../utils/currency.js";
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
  currency?: string;
  amount_original?: number;
  net_amount_original?: number;
  amount_preferred?: number;
  net_amount_preferred?: number;
  amount: number;
  net_amount: number;
  refunded_amount: number;
  from_account_id: number;
  to_account_id: number;
  category: string;
  subcategory: string | null;
}

export interface TransactionSummary {
  preferred_currency?: string;
  net_amount: number;
  original_amount: number;
  by_currency?: Record<
    string,
    {
      net_amount: number;
      original_amount: number;
    }
  >;
  count: number;
  transactions: TransactionSummaryTx[];
}

interface BudgetTxRow {
  id: number;
  date: string;
  date_accountability: string;
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

async function convertAtDate(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  dateStr: string,
): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return round2(amount);
  const rate = await getExchangeRateAtDate(from, to, dateStr);
  return round2(amount * rate);
}

/** Exported for unit tests — loan financing must not inflate earned income / living expense. */
export function computeBudgetImpact(input: BudgetImpactInput): BudgetImpactResult {
  const { tx, fromAccount, toAccount, refunded } = input;
  // Financing / accrual on loan accounts is not earned income or living expense.
  // - expense from loan: interest accruals / internal loan bookkeeping
  // - income from loan: disbursements / drawdowns (cash in, but not income)
  if (
    (tx.type === "expense" && fromAccount?.type === "loan") ||
    (tx.type === "income" && fromAccount?.type === "loan")
  ) {
    return {
      include: false,
      originalAmount: 0,
      netAmount: 0,
      baseCurrency: "EUR",
    };
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
      "transactions.date",
      "transactions.date_accountability",
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
  const { txRows, accountMap, refundMap } = await loadBudgetBaseData(
    startDate,
    endDate,
    userId,
    transactionType,
  );

  if (txRows.length === 0) return {};

  const descRows = await db()
    .selectFrom("transactions")
    .select(["id", "description"])
    .where("user_id", "=", userId)
    .where(
      "id",
      "in",
      txRows.map((r) => r.id),
    )
    .execute();
  const descMap = new Map(descRows.map((r) => [r.id, r.description ?? ""]));

  const currenciesNeeded = new Set<string>();
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
    if (impact.baseCurrency.toUpperCase() !== preferred) {
      currenciesNeeded.add(impact.baseCurrency.toUpperCase());
    }
  }
  const rateByCurrency: Record<string, Record<string, number>> = {};
  await Promise.all(
    [...currenciesNeeded].map(async (c) => {
      rateByCurrency[c] = await getExchangeRatesInRange(c, preferred, startDate, endDate);
    }),
  );
  const convertPref = (amount: number, fromCurrency: string, dateStr: string): number => {
    const from = fromCurrency.toUpperCase();
    if (from === preferred) return round2(amount);
    const rates = rateByCurrency[from];
    const rate = rates?.[dateStr] ?? rates?.[startDate] ?? rates?.[endDate] ?? 1;
    return round2(amount * rate);
  };

  const categorized: Record<string, TransactionSummary> = {};

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
    if (!categorized[category]) {
      categorized[category] = {
        preferred_currency: preferred,
        net_amount: 0,
        original_amount: 0,
        by_currency: {},
        count: 0,
        transactions: [],
      };
    }
    const cat = categorized[category]!;

    const accountingDate = String(row.date_accountability ?? row.date).slice(0, 10);
    const originalPref = convertPref(impact.originalAmount, impact.baseCurrency, accountingDate);
    const netPref = convertPref(impact.netAmount, impact.baseCurrency, accountingDate);
    const refundedPref = convertPref(
      Math.max(0, impact.originalAmount - impact.netAmount),
      impact.baseCurrency,
      accountingDate,
    );
    const byCurrency = cat.by_currency ?? {};
    if (!byCurrency[impact.baseCurrency]) {
      byCurrency[impact.baseCurrency] = {
        net_amount: 0,
        original_amount: 0,
      };
    }
    byCurrency[impact.baseCurrency]!.net_amount += impact.netAmount;
    byCurrency[impact.baseCurrency]!.original_amount += impact.originalAmount;
    cat.by_currency = byCurrency;

    cat.net_amount += netPref;
    cat.original_amount += originalPref;
    cat.count += 1;
    cat.transactions.push({
      id: row.id,
      date: String(row.date),
      date_accountability: String(row.date_accountability),
      description: descMap.get(row.id) ?? "",
      currency: impact.baseCurrency,
      amount_original: round2(impact.originalAmount),
      net_amount_original: round2(impact.netAmount),
      amount_preferred: originalPref,
      net_amount_preferred: netPref,
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
    const byCurrency = c.by_currency;
    if (byCurrency) {
      for (const [currency, values] of Object.entries(byCurrency)) {
        byCurrency[currency] = {
          net_amount: round2(values.net_amount),
          original_amount: round2(values.original_amount),
        };
      }
    }
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
  // Spending summary only — exclude income and transfers.
  const { txRows, accountMap, refundMap } = await loadBudgetBaseData(
    startDate,
    endDate,
    userId,
    "expense",
  );

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

    const accountingDate = String(row.date_accountability ?? row.date).slice(0, 10);
    sub.original += await convertAtDate(
      impact.originalAmount,
      impact.baseCurrency,
      preferred,
      accountingDate,
    );
    sub.net += await convertAtDate(
      impact.netAmount,
      impact.baseCurrency,
      preferred,
      accountingDate,
    );
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

export type PeriodCategorySummary = {
  preferred_currency?: string;
  net_amount: number;
  original_amount: number;
  by_currency?: Record<string, { net_amount: number; original_amount: number }>;
  count: number;
  transactions: TransactionSummaryTx[];
};

export type PeriodSideBlock = {
  total: {
    preferred_currency?: string;
    net: number;
    original: number;
    by_currency?: Record<string, { net: number; original: number }>;
  };
  by_category: Record<string, PeriodCategorySummary>;
};

export type PeriodSummaryRow = {
  start_date: string;
  end_date: string;
  income: PeriodSideBlock;
  expense: PeriodSideBlock;
};

export type PeriodSummariesResult = {
  period: PeriodType;
  summaries: PeriodSummaryRow[];
};

type MutableCategory = {
  preferred_currency: string;
  net_amount: number;
  original_amount: number;
  by_currency: Record<string, { net_amount: number; original_amount: number }>;
  count: number;
  transactions: TransactionSummaryTx[];
};

function emptySide(preferred: string): PeriodSideBlock {
  return {
    total: {
      preferred_currency: preferred,
      net: 0,
      original: 0,
      by_currency: {},
    },
    by_category: {},
  };
}

function finalizeSide(side: PeriodSideBlock): PeriodSideBlock {
  side.total.net = round2(side.total.net);
  side.total.original = round2(side.total.original);
  const totalBy = side.total.by_currency ?? {};
  for (const [currency, values] of Object.entries(totalBy)) {
    totalBy[currency] = {
      net: round2(values.net),
      original: round2(values.original),
    };
  }
  for (const cat of Object.values(side.by_category)) {
    cat.net_amount = round2(cat.net_amount);
    cat.original_amount = round2(cat.original_amount);
    const byCurrency = cat.by_currency ?? {};
    for (const [currency, values] of Object.entries(byCurrency)) {
      byCurrency[currency] = {
        net_amount: round2(values.net_amount),
        original_amount: round2(values.original_amount),
      };
    }
  }
  return side;
}

function periodKeyForDate(dateStr: string, period: PeriodType): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const [start] = calculatePeriodBoundaries(d, period);
  return start.toISOString().slice(0, 10);
}

/**
 * Build income/expense period buckets in one DB pass.
 * Chart-oriented: omits nested transactions unless `includeTransactions` is true
 * (keeps multi-year responses small enough for mobile).
 */
export async function getPeriodSummaries(
  startDate: string,
  endDate: string,
  userId: number,
  period: PeriodType,
  options?: { includeTransactions?: boolean },
): Promise<PeriodSummariesResult> {
  const includeTransactions = options?.includeTransactions === true;
  const preferred = await getPreferredCurrency(userId);

  const periodStarts: string[] = [];
  const periodEnds = new Map<string, string>();
  let [currentStart] = calculatePeriodBoundaries(new Date(`${startDate}T00:00:00`), period);
  const rangeEnd = new Date(`${endDate}T00:00:00`);
  while (currentStart < rangeEnd) {
    const [, currentEnd] = calculatePeriodBoundaries(currentStart, period);
    const startStr = currentStart.toISOString().slice(0, 10);
    const endStr = currentEnd.toISOString().slice(0, 10);
    periodStarts.push(startStr);
    periodEnds.set(startStr, endStr);
    currentStart = getNextPeriodStart(currentStart, period);
  }

  const buckets = new Map<string, { income: PeriodSideBlock; expense: PeriodSideBlock }>();
  for (const startStr of periodStarts) {
    buckets.set(startStr, {
      income: emptySide(preferred),
      expense: emptySide(preferred),
    });
  }

  if (periodStarts.length === 0) {
    return { period, summaries: [] };
  }

  const { txRows, accountMap, refundMap } = await loadBudgetBaseData(startDate, endDate, userId);

  const currenciesNeeded = new Set<string>();
  for (const row of txRows) {
    if (row.type !== "income" && row.type !== "expense") continue;
    const fromAcc = accountMap.get(row.from_account_id);
    const toAcc = accountMap.get(row.to_account_id);
    const impact = computeBudgetImpact({
      tx: row,
      fromAccount: fromAcc,
      toAccount: toAcc,
      refunded: refundMap.get(row.id) ?? 0,
    });
    if (!impact.include) continue;
    if (impact.baseCurrency.toUpperCase() !== preferred) {
      currenciesNeeded.add(impact.baseCurrency.toUpperCase());
    }
  }

  const rateByCurrency: Record<string, Record<string, number>> = {};
  await Promise.all(
    [...currenciesNeeded].map(async (c) => {
      rateByCurrency[c] = await getExchangeRatesInRange(c, preferred, startDate, endDate);
    }),
  );

  const convertPref = (amount: number, fromCurrency: string, dateStr: string): number => {
    const from = fromCurrency.toUpperCase();
    if (from === preferred) return round2(amount);
    const rates = rateByCurrency[from];
    const rate = rates?.[dateStr] ?? rates?.[startDate] ?? rates?.[endDate] ?? 1;
    return round2(amount * rate);
  };

  for (const row of txRows) {
    if (row.type !== "income" && row.type !== "expense") continue;
    const accountingDate = String(row.date_accountability ?? row.date).slice(0, 10);
    if (accountingDate < startDate || accountingDate > endDate) continue;

    const bucketStart = periodKeyForDate(accountingDate, period);
    const bucket = buckets.get(bucketStart);
    if (!bucket) continue;

    const fromAcc = accountMap.get(row.from_account_id);
    const toAcc = accountMap.get(row.to_account_id);
    const impact = computeBudgetImpact({
      tx: row,
      fromAccount: fromAcc,
      toAccount: toAcc,
      refunded: refundMap.get(row.id) ?? 0,
    });
    if (!impact.include) continue;

    const side = row.type === "income" ? bucket.income : bucket.expense;
    const category = row.category || "Uncategorized";
    let cat = side.by_category[category] as MutableCategory | undefined;
    if (!cat) {
      cat = {
        preferred_currency: preferred,
        net_amount: 0,
        original_amount: 0,
        by_currency: {},
        count: 0,
        transactions: [],
      };
      side.by_category[category] = cat;
    }

    const originalPref = convertPref(impact.originalAmount, impact.baseCurrency, accountingDate);
    const netPref = convertPref(impact.netAmount, impact.baseCurrency, accountingDate);
    const refundedPref = convertPref(
      Math.max(0, impact.originalAmount - impact.netAmount),
      impact.baseCurrency,
      accountingDate,
    );

    if (!cat.by_currency[impact.baseCurrency]) {
      cat.by_currency[impact.baseCurrency] = { net_amount: 0, original_amount: 0 };
    }
    cat.by_currency[impact.baseCurrency]!.net_amount += impact.netAmount;
    cat.by_currency[impact.baseCurrency]!.original_amount += impact.originalAmount;

    cat.net_amount += netPref;
    cat.original_amount += originalPref;
    cat.count += 1;

    if (!side.total.by_currency) side.total.by_currency = {};
    if (!side.total.by_currency[impact.baseCurrency]) {
      side.total.by_currency[impact.baseCurrency] = { net: 0, original: 0 };
    }
    side.total.by_currency[impact.baseCurrency]!.net += impact.netAmount;
    side.total.by_currency[impact.baseCurrency]!.original += impact.originalAmount;
    side.total.net += netPref;
    side.total.original += originalPref;

    if (includeTransactions) {
      cat.transactions.push({
        id: row.id,
        date: String(row.date),
        date_accountability: String(row.date_accountability),
        description: "",
        currency: impact.baseCurrency,
        amount_original: round2(impact.originalAmount),
        net_amount_original: round2(impact.netAmount),
        amount_preferred: originalPref,
        net_amount_preferred: netPref,
        amount: originalPref,
        net_amount: netPref,
        refunded_amount: refundedPref,
        from_account_id: row.from_account_id,
        to_account_id: row.to_account_id,
        category: row.category ?? "",
        subcategory: row.subcategory ?? null,
      });
    }
  }

  // loadBudgetBaseData does not select description — fetch only when embedding txs
  if (includeTransactions) {
    const descIds = [
      ...new Set(
        [...buckets.values()].flatMap((b) =>
          [...Object.values(b.income.by_category), ...Object.values(b.expense.by_category)].flatMap(
            (c) => c.transactions.map((t) => t.id),
          ),
        ),
      ),
    ];
    if (descIds.length > 0) {
      const descRows = await db()
        .selectFrom("transactions")
        .select(["id", "description"])
        .where("user_id", "=", userId)
        .where("id", "in", descIds)
        .execute();
      const descMap = new Map(descRows.map((r) => [r.id, r.description ?? ""]));
      for (const b of buckets.values()) {
        for (const side of [b.income, b.expense]) {
          for (const cat of Object.values(side.by_category)) {
            for (const tx of cat.transactions) {
              tx.description = descMap.get(tx.id) ?? "";
            }
          }
        }
      }
    }
  }

  const summaries: PeriodSummaryRow[] = periodStarts.map((startStr) => {
    const bucket = buckets.get(startStr)!;
    return {
      start_date: startStr,
      end_date: periodEnds.get(startStr)!,
      income: finalizeSide(bucket.income),
      expense: finalizeSide(bucket.expense),
    };
  });

  return { period, summaries };
}
