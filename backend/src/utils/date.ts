/**
 * Parse YYYY-MM-DD string to Date (UTC midnight).
 */
export function parseDateOnly(value: string): Date {
  const trimmed = String(value).slice(0, 10);
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }
  return parsed;
}

/**
 * Format Date to YYYY-MM-DD.
 */
export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Normalize date string to YYYY-MM-DD (validates and reformats).
 */
export function normalizeDateOnly(value: string): string {
  return formatDateOnly(parseDateOnly(value));
}
