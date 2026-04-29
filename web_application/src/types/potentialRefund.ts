import type { PotentialRefundApiItem, PotentialRefundTransactionRow } from "@/api/edenDerivedTypes";
import type { Transaction, TransactionType } from "./transaction";

export type { PotentialRefundApiItem, PotentialRefundTransactionRow };

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

/** True for built-in `Date` and cross-realm Date objects (`instanceof` can be false there). */
function isDateObject(value: unknown): value is Date {
  return Object.prototype.toString.call(value) === "[object Date]";
}

/** API / parsers may hand back `Date`; `Transaction.date` is always an ISO date string. */
function normalizeTransactionDate(value: unknown): string {
  if (isDateObject(value)) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

/** Safe for React text: Eden/validators may revive ISO strings as `Date` at runtime. */
export function formatTransactionDateForDisplay(value: unknown): string {
  if (value == null || value === "") {
    return "";
  }
  if (isDateObject(value)) {
    return value.toLocaleDateString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  }
  return "";
}

/** Maps API rows to `Transaction` for display and `CreateRefundModal`. */
export function normalizePotentialRefundTransaction(
  row: PotentialRefundTransactionRow,
): Transaction {
  return {
    id: row.id,
    date: normalizeTransactionDate(row.date),
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
    from_currency: row.from_currency ?? undefined,
    currency: row.currency ?? undefined,
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
