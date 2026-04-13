import type { Transaction } from "@/types";
import { formatCurrency, formatDualCurrency } from "@/utils/currency";

/** Native currency for the booked amount (from account enrichment). */
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

/** Primary amount in the user's preferred currency (`amount_preferred` from API). */
export function amountPreferredOrFallback(t: Transaction): number {
  if (t.amount_preferred != null) return t.amount_preferred;
  return transactionNativeAmountAbs(t);
}

/**
 * Format main amount for lists/detail: uses server `amount_preferred` when present.
 * Cross-currency transfers show both legs in native currencies (no single preferred amount).
 */
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

/**
 * List/detail UI: `formatTransactionAmountDisplay` already includes the minus for expenses via
 * `Intl` — do not prepend another sign. Income gets an explicit "+" before the formatted string.
 */
export function formatSignedTransactionAmountDisplay(
  t: Transaction,
  userPreferred: string,
): string {
  if (t.type === "income") {
    return `+${formatTransactionAmountDisplay(t, userPreferred)}`;
  }
  return formatTransactionAmountDisplay(t, userPreferred);
}

export function refundedAmountPreferred(t: Transaction): number {
  return t.refunded_amount_preferred ?? 0;
}

export function netAmountAfterRefundsPreferred(t: Transaction): number {
  if (t.net_amount_preferred != null) return t.net_amount_preferred;
  return Math.abs(t.amount - t.refunded_amount);
}

/**
 * Total already refunded: preferred primary, native in parentheses when the account currency
 * differs from the user's preferred (same idea as `formatTransactionAmountDisplay`).
 */
export function formatRefundedAmountDisplay(t: Transaction, userPreferred: string): string {
  const pref = userPreferred.toUpperCase();
  const orig = transactionOriginalCurrency(t) || pref;
  const rp = refundedAmountPreferred(t);
  const rn = Math.abs(Number(t.refunded_amount ?? 0));
  if (orig !== pref) {
    return formatDualCurrency(rp, pref, rn, orig);
  }
  return formatCurrency(rp, pref);
}

/**
 * Net after refunds for list/refund UI: same rules as `formatTransactionAmountDisplay` (Intl sign for
 * single-currency expenses; dual-currency uses `formatDualCurrency` magnitudes, no extra prefix).
 * Avoids mixing Unicode − with Intl’s minus so strikethrough vs net lines match.
 */
export function formatNetAfterRefundsDisplay(t: Transaction, userPreferred: string): string {
  const pref = userPreferred.toUpperCase();
  const orig = transactionOriginalCurrency(t) || pref;
  const netPref = netAmountAfterRefundsPreferred(t);
  const netNative = Math.abs(Number(t.amount) - Number(t.refunded_amount ?? 0));

  if (orig !== pref) {
    return formatDualCurrency(netPref, pref, netNative, orig);
  }
  if (t.type === "income") {
    return `+${formatCurrency(netPref, pref)}`;
  }
  return formatCurrency(-netPref, pref);
}
