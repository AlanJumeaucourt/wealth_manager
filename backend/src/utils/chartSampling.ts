/** Chart / time-series sampling helpers for long date ranges. */

export type ChartGranularity = "day" | "week" | "month";

const DAY_MS = 86_400_000;

/** Inclusive day count between YYYY-MM-DD bounds. */
export function countDaysInclusive(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / DAY_MS) + 1;
}

/**
 * Pick a chart granularity for a range.
 * Daily below ~2y, weekly below ~8y, otherwise monthly — keeps payloads chart-sized.
 */
export function resolveChartGranularity(
  startDate: string,
  endDate: string,
  requested?: string | null,
): ChartGranularity {
  const raw = (requested ?? "").trim().toLowerCase();
  if (raw === "day" || raw === "week" || raw === "month") return raw;

  const days = countDaysInclusive(startDate, endDate);
  if (days <= 730) return "day";
  if (days <= 2920) return "week";
  return "month";
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function ymdUTC(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseYmd(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return [y, m, d];
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Advance one calendar day in YYYY-MM-DD space (no Date timezone pitfalls). */
export function addDaysYmd(date: string, delta: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + delta * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Sample dates in [startDate, endDate] at the given granularity.
 * Always includes start and end so charts retain endpoints.
 */
export function generateSampleDates(
  startDate: string,
  endDate: string,
  granularity: ChartGranularity,
): string[] {
  if (startDate > endDate) return [];
  if (granularity === "day") {
    const dates: string[] = [];
    let [y, m, d] = parseYmd(startDate);
    for (;;) {
      const key = ymdUTC(y, m, d);
      if (key > endDate) break;
      dates.push(key);
      d += 1;
      const dim = daysInMonth(y, m);
      if (d > dim) {
        d = 1;
        m += 1;
      }
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return dates;
  }

  const out: string[] = [];
  const pushUnique = (key: string) => {
    if (key < startDate || key > endDate) return;
    if (out.length === 0 || out[out.length - 1] !== key) out.push(key);
  };

  pushUnique(startDate);

  if (granularity === "week") {
    // Align to UTC Monday on/after start, then every 7 days.
    const startMs = Date.parse(`${startDate}T00:00:00Z`);
    const dow = new Date(startMs).getUTCDay(); // 0=Sun
    const daysUntilMonday = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
    let cursor = addDaysYmd(startDate, daysUntilMonday);
    if (cursor === startDate) cursor = addDaysYmd(cursor, 7);
    while (cursor < endDate) {
      pushUnique(cursor);
      cursor = addDaysYmd(cursor, 7);
    }
  } else {
    // Month: first of each month strictly after start.
    let [y, m] = parseYmd(startDate);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    while (true) {
      const key = ymdUTC(y, m, 1);
      if (key >= endDate) break;
      if (key > startDate) pushUnique(key);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }

  pushUnique(endDate);
  return out;
}

/** Mutable forward cursor over a sorted balance history. */
export type HistoryCursor = {
  keys: string[];
  values: number[];
  index: number;
  last: number;
};

export function createHistoryCursor(history: Record<string, number>): HistoryCursor {
  const keys = Object.keys(history).sort();
  return {
    keys,
    values: keys.map((k) => history[k] ?? 0),
    index: 0,
    last: 0,
  };
}

/** Advance cursor through all history points on or before `dateKey`; return balance. */
export function balanceAtCursor(cursor: HistoryCursor, dateKey: string): number {
  const { keys, values } = cursor;
  while (cursor.index < keys.length) {
    const k = keys[cursor.index]!;
    if (k > dateKey) break;
    cursor.last = values[cursor.index]!;
    cursor.index += 1;
  }
  return cursor.last;
}

/**
 * Binary-search last balance on or before dateKey (history keys must be pre-sorted).
 * Prefer {@link balanceAtCursor} when scanning chronologically.
 */
export function balanceOnOrBeforeSorted(
  sortedKeys: string[],
  history: Record<string, number>,
  dateKey: string,
): number {
  let lo = 0;
  let hi = sortedKeys.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const k = sortedKeys[mid]!;
    if (k <= dateKey) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best < 0) return 0;
  return history[sortedKeys[best]!] ?? 0;
}
