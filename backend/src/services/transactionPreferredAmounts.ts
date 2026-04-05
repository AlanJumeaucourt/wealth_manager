import { convertAmount } from "../utils/currencyConversion.js";

type CurrencyRow = {
  from_currency: string;
  to_currency: string;
  currency: string;
};

/**
 * Computes preferred-currency amounts for API responses. No `preferred_currency` field is added;
 * only numeric fields in the user's preferred unit.
 */
export function computePreferredAmountFields(
  row: Record<string, unknown>,
  userPreferred: string,
  curr: CurrencyRow,
): {
  amount_preferred: number | null;
  refunded_amount_preferred: number;
  net_amount_preferred: number | null;
} {
  const pref = userPreferred.toUpperCase();
  const fromCur = curr.from_currency;
  const toCur = curr.to_currency;
  const type = String(row.type ?? "");
  const amount = Math.abs(Number(row.amount ?? 0));
  const toAmountRaw = row.to_amount;
  const toAmount = toAmountRaw != null && toAmountRaw !== "" ? Math.abs(Number(toAmountRaw)) : null;
  const refunded = Number(row.refunded_amount ?? 0);

  if (type === "transfer" && toAmount != null && fromCur !== toCur) {
    return {
      amount_preferred: null,
      refunded_amount_preferred: 0,
      net_amount_preferred: null,
    };
  }

  let nativeAbs: number;
  let nativeCur: string;
  if (type === "income") {
    nativeAbs = toAmount != null ? toAmount : amount;
    nativeCur = toCur;
  } else {
    nativeAbs = amount;
    nativeCur = fromCur;
  }

  const amount_preferred = convertAmount(nativeAbs, nativeCur, pref);
  const refunded_amount_preferred = convertAmount(refunded, nativeCur, pref);
  const netNative =
    type === "income"
      ? Math.abs((toAmount != null ? toAmount : amount) - refunded)
      : Math.abs(amount - refunded);
  const net_amount_preferred = convertAmount(netNative, nativeCur, pref);

  return {
    amount_preferred,
    refunded_amount_preferred,
    net_amount_preferred,
  };
}

export function attachPreferredAmountFields<T extends Record<string, unknown>>(
  items: T[],
  userPreferred: string,
): (T & {
  amount_preferred: number | null;
  refunded_amount_preferred: number;
  net_amount_preferred: number | null;
})[] {
  return items.map((row) => {
    const curr: CurrencyRow = {
      from_currency: String(row.from_currency ?? "EUR").toUpperCase(),
      to_currency: String(row.to_currency ?? "EUR").toUpperCase(),
      currency: String(row.currency ?? "EUR").toUpperCase(),
    };
    const fields = computePreferredAmountFields(row, userPreferred, curr);
    const next = { ...row, ...fields } as T & {
      amount_preferred: number | null;
      refunded_amount_preferred: number;
      net_amount_preferred: number | null;
    };
    delete (next as { preferred_currency?: unknown }).preferred_currency;
    return next;
  });
}
