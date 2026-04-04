/**
 * Safe number conversion with fallback for non-finite values.
 */
export function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
