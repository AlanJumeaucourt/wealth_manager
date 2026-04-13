import { requireAuth } from "../middleware/auth.js";
import { stringifyUnknown } from "./stringifyUnknown.js";

/**
 * Extract filters from raw query object for allowed keys.
 */
export function extractFiltersFromQuery(
  rawQuery: Record<string, unknown>,
  allowedFilters: string[],
): Record<string, string | number> {
  const filters: Record<string, string | number> = {};
  for (const key of allowedFilters) {
    const v = rawQuery[key];
    if (v !== undefined && v !== null && v !== "") {
      // Support multiple values (e.g. ?id=1&id=2) by joining into a
      // comma-separated string, which listAll() interprets as an IN filter.
      if (Array.isArray(v)) {
        const parts = v.map((item) => stringifyUnknown(item)).filter((item) => item !== "");
        if (parts.length > 0) {
          filters[key] = parts.join(",");
        }
      } else {
        filters[key] = typeof v === "number" ? v : stringifyUnknown(v);
      }
    }
  }
  return filters;
}

export type ParseDateRangeResult =
  | { success: true; start_date: string; end_date: string; start: Date; end: Date }
  | { success: false; error: string };

/**
 * Parse start_date and end_date from query. Param names default to start_date/end_date.
 */
export function parseDateRangeQuery(
  query: Record<string, unknown>,
  paramNames: { start?: string; end?: string } = {},
): ParseDateRangeResult {
  const startKey = paramNames.start ?? "start_date";
  const endKey = paramNames.end ?? "end_date";
  const startStr = typeof query[startKey] === "string" ? String(query[startKey]).trim() : "";
  const endStr = typeof query[endKey] === "string" ? String(query[endKey]).trim() : "";

  if (!startStr || !endStr) {
    return { success: false, error: `${startKey} and ${endKey} are required` };
  }

  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { success: false, error: "Invalid date format. Use YYYY-MM-DD" };
  }

  return { success: true, start_date: startStr, end_date: endStr, start, end };
}

export type ParseYearMonthResult =
  | { success: true; year?: number; month?: number; start_date?: string; end_date?: string }
  | { success: false; error: string };

/**
 * Parse year and month from query. When required=true, returns start_date and end_date for the month.
 */
export function parseYearMonthQuery(
  query: Record<string, unknown>,
  options?: { required?: boolean },
): ParseYearMonthResult {
  const required = options?.required ?? false;
  const yearRaw = typeof query.year === "string" ? query.year : undefined;
  const monthRaw = typeof query.month === "string" ? query.month : undefined;

  if (required && (!yearRaw || !monthRaw)) {
    return { success: false, error: "Year and month are required" };
  }

  const year = yearRaw ? parseInt(yearRaw, 10) : undefined;
  const month = monthRaw ? parseInt(monthRaw, 10) : undefined;

  if ((yearRaw && Number.isNaN(year!)) || (monthRaw && Number.isNaN(month!))) {
    return { success: false, error: "Year and month must be integers" };
  }

  if (year !== undefined && month !== undefined) {
    if (month < 1 || month > 12) {
      return { success: false, error: "Invalid year or month value" };
    }
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return { success: true, year, month, start_date: startDate, end_date: endDate };
  }

  return { success: true, year, month };
}

export type ParseDateRangeOr400Result =
  | { start_date: string; end_date: string; start: Date; end: Date }
  | { error: { error: string } };

/**
 * Parse start_date/end_date from query. On failure, sets status=400 and returns error object.
 * Use in handlers: const parsed = parseDateRangeOr400(query, set); if ("error" in parsed) return parsed.error;
 */
export function parseDateRangeOr400(
  query: Record<string, unknown>,
  set: { status?: number | string },
  paramNames?: { start?: string; end?: string },
): ParseDateRangeOr400Result {
  const parsed = parseDateRangeQuery(query, paramNames);
  if (!parsed.success) {
    set.status = 400;
    return { error: { error: parsed.error } };
  }
  return {
    start_date: parsed.start_date,
    end_date: parsed.end_date,
    start: parsed.start,
    end: parsed.end,
  };
}

export type WithDateRangeContext = {
  query: Record<string, unknown>;
  set: { status?: number | string };
  userId: number | null;
};

/**
 * Run a handler that needs start_date/end_date from query. Handles requireAuth + parseDateRangeOr400.
 * Use: withDateRange({ query, set, userId }, (start_date, end_date) => ...)
 */
export async function withDateRange<T>(
  ctx: WithDateRangeContext,
  fn: (startDate: string, endDate: string) => Promise<T>,
): Promise<T | { error: string }> {
  requireAuth({ userId: ctx.userId });
  const parsed = parseDateRangeOr400(ctx.query, ctx.set);
  if ("error" in parsed) return parsed.error;
  return fn(parsed.start_date, parsed.end_date);
}
