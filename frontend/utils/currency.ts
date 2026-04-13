type CurrencyCode = string;

const HARD_CODED_RATES: Record<string, number> = {
  "EUR->EUR": 1,
  "RON->RON": 1,
  "EUR->RON": 4.97,
  "RON->EUR": 0.2012,
};

export function convertAmount(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
): number {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  const key = `${from}->${to}`;
  const rate = HARD_CODED_RATES[key];
  if (rate == null) {
    // Fallback: no conversion known, return amount unchanged
    return amount;
  }
  return Math.round(amount * rate * 100) / 100;
}

export function formatCurrency(amount: number, currency: CurrencyCode, locale?: string): string {
  const code = (currency || "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Intl can be missing/limited on some RN runtimes
    return `${amount.toFixed(2)} ${code}`;
  }
}

export function formatDualCurrency(
  amountPreferred: number,
  preferredCurrency: CurrencyCode,
  amountOriginal: number,
  originalCurrency: CurrencyCode,
  locale?: string,
): string {
  const pref = preferredCurrency.toUpperCase();
  const orig = originalCurrency.toUpperCase();
  const preferredText = formatCurrency(amountPreferred, pref, locale);

  if (pref === orig) {
    return preferredText;
  }

  const originalText = formatCurrency(amountOriginal, orig, locale);
  return `${preferredText} (${originalText})`;
}

export function formatCompactCurrency(amount: number, currency: CurrencyCode): string {
  const code = currency.toUpperCase();
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  const compact = (value: number, suffix: string) => `${sign}${value.toFixed(2)}${suffix} ${code}`;

  if (abs >= 1_000_000) return compact(abs / 1_000_000, "M");
  if (abs >= 1_000) return compact(abs / 1_000, "k");
  return `${sign}${abs.toFixed(2)} ${code}`;
}
