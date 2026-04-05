/**
 * Fixed FX rates for converting display amounts into the user's preferred currency.
 * Keep in sync with clients that only display server-computed `amount_preferred`.
 */
const RATES: Record<string, number> = {
  "EUR->EUR": 1,
  "RON->RON": 1,
  "EUR->RON": 4.97,
  "RON->EUR": 0.2012,
};

export function convertAmount(amount: number, fromCurrency: string, toCurrency: string): number {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return amount;
  const key = `${from}->${to}`;
  const rate = RATES[key];
  if (rate == null) return amount;
  return Math.round(amount * rate * 100) / 100;
}
