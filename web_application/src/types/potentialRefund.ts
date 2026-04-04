import type { PotentialRefundApiItem, PotentialRefundTransactionRow } from "@/api/edenDerivedTypes";
import type { Transaction, TransactionType } from "./transaction";

export type { PotentialRefundApiItem, PotentialRefundTransactionRow };

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

/** Maps API rows to `Transaction` for display and `CreateRefundModal`. */
export function normalizePotentialRefundTransaction(
  row: PotentialRefundTransactionRow,
): Transaction {
  return {
    id: row.id,
    date: row.date,
    date_accountability: row.date_accountability ?? "",
    description: row.description,
    amount: num(row.amount),
    from_account_id: row.from_account_id,
    to_account_id: row.to_account_id,
    type: row.type as TransactionType,
    category: row.category,
    subcategory: row.subcategory ?? undefined,
    refunded_amount: 0,
    investment_id: row.investment_id ?? null,
    to_amount: row.to_amount != null ? num(row.to_amount) : null,
    to_currency: row.to_currency ?? undefined,
  };
}

/** Normalized UI shape (amounts as numbers). */
export interface PotentialRefund {
  incomeTransaction: Transaction;
  suggestedExpenses: { transaction: Transaction; score: number }[];
  matchReason: string;
}

export function normalizePotentialRefundItem(raw: PotentialRefundApiItem): PotentialRefund {
  return {
    incomeTransaction: normalizePotentialRefundTransaction(raw.incomeTransaction),
    suggestedExpenses: raw.suggestedExpenses.map((s) => ({
      transaction: normalizePotentialRefundTransaction(s.transaction),
      score: s.score,
    })),
    matchReason: raw.matchReason,
  };
}
