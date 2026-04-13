import type { Transaction } from "@/types/transaction";
import { formatCurrency, formatDualCurrency } from "@/utils/currency";

export function transactionOriginalCurrency(t: Transaction): string {
  if (t.type === "income") {
    return (t.to_currency ?? t.currency ?? "").toUpperCase();
  }
  return (t.from_currency ?? t.currency ?? "").toUpperCase();
}

export function transactionNativeAmountAbs(t: Transaction): number {
  if (t.type === "income") {
    return Math.abs(t.to_amount ?? t.amount);
  }
  return Math.abs(t.amount);
}

export function amountPreferredOrFallback(t: Transaction): number {
  if (t.amount_preferred != null) return t.amount_preferred;
  return transactionNativeAmountAbs(t);
}

export function formatTransactionAmountDisplay(t: Transaction, userPreferred: string): string {
  const pref = userPreferred.toUpperCase();
  const fromCurr = (t.from_currency ?? "").toUpperCase();
  const toCurr = (t.to_currency ?? "").toUpperCase();

  if (t.type === "transfer" && t.to_amount != null && fromCurr && toCurr && fromCurr !== toCurr) {
    return `-${formatCurrency(Math.abs(t.amount), fromCurr)} (+${formatCurrency(Math.abs(t.to_amount), toCurr)})`;
  }

  const ap = t.amount_preferred;
  const orig = transactionOriginalCurrency(t) || pref;
  const nativeAbs = transactionNativeAmountAbs(t);

  if (ap == null) {
    return formatCurrency(t.type === "expense" ? -nativeAbs : nativeAbs, orig);
  }

  if (orig !== pref) {
    return formatDualCurrency(ap, pref, nativeAbs, orig);
  }
  return formatCurrency(t.type === "expense" ? -ap : ap, pref);
}
