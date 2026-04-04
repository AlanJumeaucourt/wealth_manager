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
