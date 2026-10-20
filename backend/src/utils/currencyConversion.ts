/**
 * Preferred-currency conversion for API display fields.
 * Delegates to the live FX module (`currency.ts`) so refund / preferred-amount
 * paths stay consistent with wealth/account enrichment.
 */
import { convert } from "./currency.js";

/** Convert amount using live/date-aware rates (Frankfurter / currencyx). */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): Promise<number> {
  return convert(amount, fromCurrency, toCurrency);
}
