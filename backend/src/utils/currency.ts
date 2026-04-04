import { createCurrency, exchanges } from "@mixxtor/currencyx-js";
import { createCache } from "./cache.js";
import { round2 } from "./money.js";

const currencyx = createCurrency({
  default: "google",
  exchanges: {
    google: exchanges.google({ base: "EUR", timeout: 5000 }),
  },
});

const rateCache = createCache<number>({ ttlMs: 5 * 60 * 1000, maxKeys: 2000 });
const rateRangeCache = createCache<Record<string, number>>({
  ttlMs: 24 * 60 * 60 * 1000,
  maxKeys: 500,
});

function normalize(currency: string): string {
  return (currency || "EUR").toUpperCase();
}

/**
 * Convert amount between currencies using @mixxtor/currencyx-js (Google Finance).
 * Uses cached getExchangeRate when possible. Throws if the provider fails (no fallback).
 */
export async function convert(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): Promise<number> {
  const from = normalize(fromCurrency);
  const to = normalize(toCurrency);
  if (from === to) return round2(amount);
  const rate = await getExchangeRate(from, to);
  return round2(amount * rate);
}

/**
 * Get current exchange rate. Cached 5 min.
 */
export async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
  const from = normalize(fromCurrency);
  const to = normalize(toCurrency);
  if (from === to) return 1;
  const key = `rate:latest:${from}:${to}`;
  const cached = rateCache.get(key);
  if (cached != null) return cached;
  const result = await currencyx.convert({
    amount: 1,
    from,
    to,
  });
  if (result.success && typeof result.result === "number") {
    const rate = round2(result.result);
    rateCache.set(key, rate);
    return rate;
  }
  const msg = result.error?.info ?? "Exchange rate unavailable";
  throw new Error(`Exchange rate failed (${from} → ${to}): ${msg}`);
}

const FRANKFURTER_BASE = "https://api.frankfurter.app";

/**
 * Fetch historical rate for one date from Frankfurter. Returns null if not available (e.g. unsupported pair).
 */
async function fetchFrankfurterRate(
  from: string,
  to: string,
  date: string,
): Promise<number | null> {
  try {
    const res = await fetch(`${FRANKFURTER_BASE}/${date}?from=${from}&to=${to}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.[to];
    return typeof rate === "number" ? round2(rate) : null;
  } catch {
    return null;
  }
}

/**
 * Fetch historical rates for a date range from Frankfurter. Fills gaps (e.g. weekends) with previous known rate.
 * Returns Record<dateStr, rate>. Empty if API fails or pair unsupported.
 */
async function fetchFrankfurterRange(
  from: string,
  to: string,
  startDate: string,
  endDate: string,
): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${FRANKFURTER_BASE}/${startDate}..${endDate}?from=${from}&to=${to}`);
    if (!res.ok) return {};
    const data = (await res.json()) as {
      rates?: Record<string, Record<string, number>>;
    };
    const byDate = data.rates ?? {};
    const out: Record<string, number> = {};
    let lastRate: number | null = null;
    const start = new Date(startDate + "T00:00:00Z").getTime();
    const end = new Date(endDate + "T00:00:00Z").getTime();
    for (let t = start; t <= end; t += 86400000) {
      const d = new Date(t).toISOString().slice(0, 10);
      const dayRates = byDate[d as keyof typeof byDate];
      const r = dayRates?.[to];
      if (typeof r === "number") {
        lastRate = round2(r);
        out[d] = lastRate;
      } else if (lastRate != null) {
        out[d] = lastRate;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Get exchange rate for a specific date (YYYY-MM-DD). Uses Frankfurter for historical; falls back to current rate.
 * Cached 24h per (date, from, to).
 */
export async function getExchangeRateAtDate(
  fromCurrency: string,
  toCurrency: string,
  dateStr: string,
): Promise<number> {
  const from = normalize(fromCurrency);
  const to = normalize(toCurrency);
  if (from === to) return 1;
  const key = `rate:${dateStr}:${from}:${to}`;
  const cached = rateCache.get(key);
  if (cached != null) return cached;
  const today = new Date().toISOString().slice(0, 10);
  if (dateStr >= today) {
    const rate = await getExchangeRate(from, to);
    rateCache.set(key, rate, 24 * 60 * 60 * 1000);
    return rate;
  }
  const rate = await fetchFrankfurterRate(from, to, dateStr);
  if (rate != null) {
    rateCache.set(key, rate, 24 * 60 * 60 * 1000);
    return rate;
  }
  const fallback = await getExchangeRate(from, to);
  rateCache.set(key, fallback, 24 * 60 * 60 * 1000);
  return fallback;
}

/**
 * Get exchange rates for every day in [startDate, endDate]. One API call per (from, to) via Frankfurter.
 * Fills missing days (e.g. weekends) with previous rate. Cached 24h. Falls back to current rate if Frankfurter fails.
 */
export async function getExchangeRatesInRange(
  fromCurrency: string,
  toCurrency: string,
  startDate: string,
  endDate: string,
): Promise<Record<string, number>> {
  const from = normalize(fromCurrency);
  const to = normalize(toCurrency);
  if (from === to) {
    const out: Record<string, number> = {};
    const start = new Date(startDate + "T00:00:00Z").getTime();
    const end = new Date(endDate + "T00:00:00Z").getTime();
    for (let t = start; t <= end; t += 86400000) {
      out[new Date(t).toISOString().slice(0, 10)] = 1;
    }
    return out;
  }
  const cacheKey = `rateRange:${from}:${to}:${startDate}:${endDate}`;
  const cached = rateRangeCache.get(cacheKey);
  if (cached != null) return cached;
  const range = await fetchFrankfurterRange(from, to, startDate, endDate);
  if (Object.keys(range).length > 0) {
    rateRangeCache.set(cacheKey, range);
    return range;
  }
  const fallbackRate = await getExchangeRate(from, to);
  const out: Record<string, number> = {};
  const start = new Date(startDate + "T00:00:00Z").getTime();
  const end = new Date(endDate + "T00:00:00Z").getTime();
  for (let t = start; t <= end; t += 86400000) {
    out[new Date(t).toISOString().slice(0, 10)] = fallbackRate;
  }
  rateRangeCache.set(cacheKey, out);
  return out;
}
