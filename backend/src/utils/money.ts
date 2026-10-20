/**
 * Round to 2 decimal places.
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Round up to 2 decimal places.
 */
export function roundCeiling2(value: number): number {
  return Math.ceil(value * 100) / 100;
}

/** Round to 4 decimal places (e.g. share quantities, rates). */
export function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Convert a currency amount to integer cents. */
export function toCents(n: number): number {
  return Math.round(round2(n) * 100);
}

/** Convert integer cents to a currency amount (2 decimal places). */
export function fromCents(cents: number): number {
  return round2(cents / 100);
}

/** Sum currency amounts with 2-decimal rounding. */
export function addMoney(...amounts: number[]): number {
  return round2(amounts.reduce((sum, amount) => sum + amount, 0));
}
