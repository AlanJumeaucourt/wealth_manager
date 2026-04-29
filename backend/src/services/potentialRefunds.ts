import { db } from "../db/client.js";
import { convertAmount } from "../utils/currencyConversion.js";
import { getUserPreferredCurrency } from "./user.js";
import { getTransactionCurrencyEnrichment } from "./transactionCurrencyEnrichment.js";

/**
 * Keywords/phrases that often appear in refund/credit transaction descriptions
 * (French banking and common EU patterns).
 */
const REFUND_DESCRIPTION_PATTERNS = [
  "avoir",
  "en votre faveur",
  "virement de",
  "virement à",
  "remboursement",
  "rembousement", // common typo
  "geste commercial",
  "crv",
  "annul",
  "avoir carte",
  "avoir /",
  "paiement envoyé",
  "paiement reçu",
  "credit",
  "refund",
  "reimbursement",
  "rebate",
];

const NORMAL_EXPENSE_LOOKBACK_DAYS = 365;
const RARE_REFUND_BEFORE_EXPENSE_DAYS = 45;
const FX_AMOUNT_TOLERANCE_RATIO = 0.03;
const FX_AMOUNT_TOLERANCE_ABSOLUTE = 0.5;

function toFiniteNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function amountInPreferredCurrency(
  tx: TransactionRow,
  preferredCurrency: string,
  txCurrency: {
    from_currency: string;
    to_currency: string;
    currency: string;
  },
): number {
  if (tx.type === "income") {
    const incomeNative =
      tx.to_amount != null ? toFiniteNumber(tx.to_amount) : toFiniteNumber(tx.amount);
    return convertAmount(Math.abs(incomeNative), txCurrency.to_currency, preferredCurrency);
  }
  return convertAmount(
    Math.abs(toFiniteNumber(tx.amount)),
    txCurrency.from_currency,
    preferredCurrency,
  );
}

function looksLikeRefundDescription(description: string): boolean {
  const lower = (description ?? "").toLowerCase().trim();
  if (!lower) return false;
  return REFUND_DESCRIPTION_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Score for a suggested expense matching an income (potential refund).
 * Higher = more likely to be the matching expense.
 */
function scoreExpenseMatch(
  incomeAmount: number,
  incomeDate: string,
  incomeToAccountId: number,
  expenseAmount: number,
  expenseDate: string,
  expenseFromAccountId: number,
  isCrossCurrency: boolean,
): number {
  let score = 0;
  const expenseAbs = Math.abs(expenseAmount);
  const amountDelta = Math.abs(incomeAmount - expenseAbs);
  const tolerance = isCrossCurrency
    ? Math.max(FX_AMOUNT_TOLERANCE_ABSOLUTE, incomeAmount * FX_AMOUNT_TOLERANCE_RATIO)
    : 0.02;
  const amountMatch = amountDelta <= tolerance;
  if (amountMatch) score += 50;
  else if (incomeAmount > 0 && expenseAbs > 0) {
    const ratio = Math.min(incomeAmount, expenseAbs) / Math.max(incomeAmount, expenseAbs);
    if (ratio >= 0.98) score += 45;
    else if (ratio >= 0.95) score += 35;
    else if (ratio >= 0.9) score += 25;
    else if (ratio >= 0.75) score += 10;
  }

  const incomeD = new Date(incomeDate).getTime();
  const expenseD = new Date(expenseDate).getTime();
  const daysDiff = (incomeD - expenseD) / (24 * 60 * 60 * 1000);
  if (daysDiff >= 0 && daysDiff <= 365) {
    if (daysDiff <= 7) score += 30;
    else if (daysDiff <= 30) score += 20;
    else if (daysDiff <= 90) score += 10;
  } else if (daysDiff < 0 && daysDiff >= -RARE_REFUND_BEFORE_EXPENSE_DAYS) {
    // Rare edge case: refund booked before the expense settles.
    score += 5;
  }

  if (incomeToAccountId === expenseFromAccountId) score += 20;

  return score;
}

export interface TransactionRow {
  id: number;
  date: string;
  date_accountability: string | null;
  description: string;
  amount: string;
  to_amount: string | null;
  to_currency: string | null;
  from_currency?: string | null;
  currency?: string | null;
  from_account_id: number;
  to_account_id: number;
  category: string;
  subcategory: string | null;
  type: string;
  investment_id: number | null;
}

export interface SuggestedExpense {
  transaction: TransactionRow;
  score: number;
}

export interface PotentialRefund {
  incomeTransaction: TransactionRow;
  suggestedExpenses: SuggestedExpense[];
  matchReason: string;
}

/**
 * Returns income transactions that look like refunds (by description) and are
 * not yet linked as income_transaction_id in any refund_item. If a transaction
 * already has a refund (is used as the income side of a refund_item), it is not
 * a potential refund and is excluded. For each candidate, suggests expense
 * transactions (same account, date before income, amount match).
 */
export async function getPotentialRefunds(
  userId: number,
  limit: number = 100,
): Promise<PotentialRefund[]> {
  const database = db();
  const preferredCurrency = await getUserPreferredCurrency(userId);

  // Incomes that are already linked as the "refund" side of a refund_item → not potential
  const alreadyHasRefundIncomeIds = await database
    .selectFrom("refund_items")
    .select("income_transaction_id")
    .where("user_id", "=", userId)
    .distinct()
    .execute()
    .then(
      (rows: { income_transaction_id: number }[]) =>
        new Set(rows.map((r) => Number(r.income_transaction_id))),
    );

  const dismissedIncomeIds = await database
    .selectFrom("dismissed_potential_refunds")
    .select("income_transaction_id")
    .where("user_id", "=", userId)
    .execute()
    .then(
      (rows: { income_transaction_id: number }[]) =>
        new Set(rows.map((r) => Number(r.income_transaction_id))),
    );

  const incomeQuery = database
    .selectFrom("transactions")
    .selectAll()
    .where("user_id", "=", userId)
    .where("type", "=", "income")
    .orderBy("date", "desc")
    .limit(limit * 3);

  const allIncomes = (await incomeQuery.execute()) as TransactionRow[];

  const candidateIncomes = allIncomes.filter(
    (t) =>
      !alreadyHasRefundIncomeIds.has(Number(t.id)) &&
      !dismissedIncomeIds.has(Number(t.id)) &&
      looksLikeRefundDescription(t.description),
  );

  if (candidateIncomes.length === 0) return [];
  const incomeDates = new Map(candidateIncomes.map((t) => [t.id, t.date] as [number, string]));
  const incomeToAccounts = new Map(
    candidateIncomes.map((t) => [t.id, t.to_account_id] as [number, number]),
  );

  const expensesUsedAsRefund = await database
    .selectFrom("refund_items")
    .select("expense_transaction_id")
    .where("user_id", "=", userId)
    .distinct()
    .execute()
    .then(
      (rows: { expense_transaction_id: number }[]) =>
        new Set(rows.map((r) => r.expense_transaction_id)),
    );

  const minDateByIncome = new Map<number, string>();
  const maxDateByIncome = new Map<number, string>();
  for (const t of candidateIncomes) {
    const minDate = new Date(t.date);
    minDate.setDate(minDate.getDate() - NORMAL_EXPENSE_LOOKBACK_DAYS);
    minDateByIncome.set(t.id, minDate.toISOString().slice(0, 10));

    const maxDate = new Date(t.date);
    maxDate.setDate(maxDate.getDate() + RARE_REFUND_BEFORE_EXPENSE_DAYS);
    maxDateByIncome.set(t.id, maxDate.toISOString().slice(0, 10));
  }

  const expenses = (await database
    .selectFrom("transactions")
    .selectAll()
    .where("user_id", "=", userId)
    .where("type", "=", "expense")
    .execute()) as TransactionRow[];

  const allTransactionIds = [...candidateIncomes.map((t) => t.id), ...expenses.map((t) => t.id)];
  const currencyByTransactionId = await getTransactionCurrencyEnrichment(allTransactionIds, userId);

  const result: PotentialRefund[] = [];

  for (const income of candidateIncomes.slice(0, limit)) {
    const minDate = minDateByIncome.get(income.id) ?? income.date;
    const maxDate = maxDateByIncome.get(income.id) ?? income.date;
    const incomeCurrency = currencyByTransactionId.get(income.id) ?? {
      from_currency: "EUR",
      to_currency: "EUR",
      currency: "EUR",
    };
    const incomeAmt = amountInPreferredCurrency(income, preferredCurrency, incomeCurrency);
    const incomeDate = incomeDates.get(income.id) ?? income.date;
    const toAcc = incomeToAccounts.get(income.id) ?? income.to_account_id;

    const candidates = expenses.filter((e) => {
      if (expensesUsedAsRefund.has(e.id)) return false;
      const ed = e.date;
      if (ed < minDate) return false;
      if (ed > maxDate) return false;
      return true;
    });

    const suggested: SuggestedExpense[] = candidates
      .map((exp) => {
        const expenseCurrency = currencyByTransactionId.get(exp.id) ?? {
          from_currency: "EUR",
          to_currency: "EUR",
          currency: "EUR",
        };
        const isCrossCurrency = incomeCurrency.to_currency !== expenseCurrency.from_currency;
        const score = scoreExpenseMatch(
          incomeAmt,
          incomeDate,
          toAcc,
          amountInPreferredCurrency(exp, preferredCurrency, expenseCurrency),
          exp.date,
          exp.from_account_id,
          isCrossCurrency,
        );
        return { transaction: exp, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const enrichedIncome: TransactionRow = incomeCurrency
      ? {
          ...income,
          from_currency: incomeCurrency.from_currency,
          to_currency: incomeCurrency.to_currency,
          currency: incomeCurrency.currency,
        }
      : income;

    const enrichedSuggested: SuggestedExpense[] = suggested.map((s) => {
      const txCurrency = currencyByTransactionId.get(s.transaction.id);
      if (!txCurrency) return s;
      return {
        ...s,
        transaction: {
          ...s.transaction,
          from_currency: txCurrency.from_currency,
          to_currency: txCurrency.to_currency,
          currency: txCurrency.currency,
        },
      };
    });

    result.push({
      incomeTransaction: enrichedIncome,
      suggestedExpenses: enrichedSuggested,
      matchReason: suggested.length
        ? "Description looks like refund; suggested expenses by amount/date/account"
        : "Description looks like refund; no matching expenses found",
    });
  }

  // Top priority: biggest score first (best suggested-expense match)
  result.sort((a, b) => {
    const scoreA = a.suggestedExpenses[0]?.score ?? 0;
    const scoreB = b.suggestedExpenses[0]?.score ?? 0;
    return scoreB - scoreA;
  });

  return result;
}

/**
 * Mark a potential refund (income transaction) as dismissed so it no longer appears in suggestions.
 */
export async function dismissPotentialRefund(
  userId: number,
  incomeTransactionId: number,
): Promise<void> {
  const database = db();
  try {
    await database
      .insertInto("dismissed_potential_refunds")
      .values({
        user_id: userId,
        income_transaction_id: incomeTransactionId,
        created_at: new Date().toISOString(),
      })
      .execute();
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err?.code === "SQLITE_CONSTRAINT" || err?.message?.includes("UNIQUE")) {
      return; // already dismissed
    }
    throw e;
  }
}

/** Remove all dismissed-potential-refund rows for this user so suggestions can reappear. */
export async function clearDismissedPotentialRefunds(userId: number): Promise<void> {
  const database = db();
  await database.deleteFrom("dismissed_potential_refunds").where("user_id", "=", userId).execute();
}
