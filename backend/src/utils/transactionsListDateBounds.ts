import { formatDateOnly } from "./date.js";

/** YYYY-MM-DD for the current UTC calendar day. */
export function todayDateOnly(): string {
  return formatDateOnly(new Date());
}

/**
 * Default date window for transaction lists that should match the main Transactions page:
 * include history through today and exclude future-dated rows.
 */
export function transactionsThroughTodayRange(): {
  from_date: string;
  to_date: string;
} {
  return {
    from_date: "1970-01-01",
    to_date: todayDateOnly(),
  };
}

export function clampDateToToday(date: string): string {
  const normalized = date.trim().slice(0, 10);
  const today = todayDateOnly();
  return normalized > today ? today : normalized;
}

/**
 * Match Transactions page / command palette: never return rows dated after today.
 * Applied to AI list_transactions tool calls only.
 */
export function clampAgentTransactionListQuery(
  query: Record<string, unknown>,
): Record<string, unknown> {
  const today = todayDateOnly();
  const result = { ...query };

  const rawTo = result.to_date;
  const toDate =
    typeof rawTo === "string" && rawTo.trim() !== "" ? rawTo.trim().slice(0, 10) : undefined;

  result.to_date = toDate && toDate <= today ? toDate : today;

  return result;
}

/** Cap an inclusive end date to today (for AI budget / category tools). */
export function clampAgentDateRangeEnd(endDate: string): string {
  return clampDateToToday(endDate);
}
