import { db } from "../db/client.js";

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
): number {
  let score = 0;
  const expenseAbs = Math.abs(expenseAmount);
  const amountMatch = Math.abs(incomeAmount - expenseAbs) < 0.02;
  if (amountMatch) score += 50;
  else if (incomeAmount <= expenseAbs && expenseAbs > 0) {
    const ratio = incomeAmount / expenseAbs;
    if (ratio >= 0.9) score += 40;
    else if (ratio >= 0.5) score += 25;
    else score += 10;
  }

  const incomeD = new Date(incomeDate).getTime();
  const expenseD = new Date(expenseDate).getTime();
  const daysDiff = (incomeD - expenseD) / (24 * 60 * 60 * 1000);
  if (daysDiff >= 0 && daysDiff <= 365) {
    if (daysDiff <= 7) score += 30;
    else if (daysDiff <= 30) score += 20;
    else if (daysDiff <= 90) score += 10;
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
  const incomeAmounts = new Map(
    candidateIncomes.map((t) => [t.id, parseFloat(t.amount)] as [number, number]),
  );
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
  for (const t of candidateIncomes) {
    const d = new Date(t.date);
    d.setDate(d.getDate() - 365);
    minDateByIncome.set(t.id, d.toISOString().slice(0, 10));
  }

  const expenses = (await database
    .selectFrom("transactions")
    .selectAll()
    .where("user_id", "=", userId)
    .where("type", "=", "expense")
    .execute()) as TransactionRow[];

  const result: PotentialRefund[] = [];

  for (const income of candidateIncomes.slice(0, limit)) {
    const minDate = minDateByIncome.get(income.id) ?? income.date;
    const incomeAmt = incomeAmounts.get(income.id) ?? parseFloat(income.amount);
    const incomeDate = incomeDates.get(income.id) ?? income.date;
    const toAcc = incomeToAccounts.get(income.id) ?? income.to_account_id;

    const candidates = expenses.filter((e) => {
      if (expensesUsedAsRefund.has(e.id)) return false;
      const ed = e.date;
      if (ed > income.date) return false;
      if (ed < minDate) return false;
      return true;
    });

    const suggested: SuggestedExpense[] = candidates
      .map((exp) => {
        const score = scoreExpenseMatch(
          incomeAmt,
          incomeDate,
          toAcc,
          parseFloat(exp.amount),
          exp.date,
          exp.from_account_id,
        );
        return { transaction: exp, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    result.push({
      incomeTransaction: income,
      suggestedExpenses: suggested,
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
