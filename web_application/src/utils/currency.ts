export function formatCurrency(amount: number, currency: string = "EUR", locale?: string): string {
  const code = (currency || "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat(locale ?? undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

export function formatDualCurrency(
  amountPreferred: number,
  preferredCurrency: string,
  amountOriginal: number,
  originalCurrency: string,
  locale?: string,
): string {
  const pref = (preferredCurrency || "EUR").toUpperCase();
  const orig = (originalCurrency || "EUR").toUpperCase();
  const preferredText = formatCurrency(amountPreferred, pref, locale);

  if (pref === orig) {
    return preferredText;
  }

  const originalText = formatCurrency(amountOriginal, orig, locale);
  return `${preferredText} (${originalText})`;
}

export function formatCompactCurrency(amount: number, currency: string): string {
  const code = (currency || "EUR").toUpperCase();
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const compact = (value: number, suffix: string) => `${sign}${value.toFixed(2)}${suffix} ${code}`;

  if (abs >= 1_000_000) return compact(abs / 1_000_000, "M");
  if (abs >= 1_000) return compact(abs / 1_000, "k");
  return `${sign}${abs.toFixed(2)} ${code}`;
}
