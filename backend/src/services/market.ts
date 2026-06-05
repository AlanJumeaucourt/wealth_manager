import YahooFinance from "yahoo-finance2";
import { createCache } from "../utils/cache.js";
import { stringifyUnknown } from "../utils/stringifyUnknown.js";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const quoteCache = createCache<StockInfo>({
  ttlMs: 5 * 60 * 1000,
  maxKeys: 500,
});
const historicalCache = createCache<HistoricalPrice[]>({
  ttlMs: 60 * 60 * 1000,
  maxKeys: 300,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export interface AssetSearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  currency: string;
}

export interface StockInfo {
  symbol: string;
  shortName?: string;
  quoteType?: string;
  currency?: string;
  current_price?: number;
  previous_close?: number;
  market_cap?: number;
  volume?: number;
  description?: string;
}

export interface HistoricalPrice {
  date: string;
  value: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Search for stocks and ETFs via Yahoo Finance.
 */
export async function searchAssets(query: string): Promise<AssetSearchResult[]> {
  if (!query || query.length < 2) return [];
  const result = await yf.search(query, { quotesCount: 20, newsCount: 0 });
  const quotes = (result as { quotes?: unknown[] }).quotes ?? [];
  return quotes
    .filter((q) => {
      if (!isRecord(q)) return false;
      if (q.isYahooFinance === false) return false;
      return typeof q.symbol === "string" && q.symbol.trim() !== "";
    })
    .map((q) => {
      const rec = q as Record<string, unknown>;
      return {
        symbol: stringifyUnknown(rec.symbol),
        name: stringifyUnknown(rec.longname ?? rec.shortname),
        type: stringifyUnknown(rec.quoteType),
        exchange: stringifyUnknown(rec.exchange),
        currency: stringifyUnknown(rec.currency),
      };
    });
}

/**
 * Get current quote (info) for a symbol. Used for /stocks/:symbol and current price. Cached 5 min.
 */
export async function getQuote(symbol: string): Promise<StockInfo | null> {
  const key = `quote:${symbol.toUpperCase()}`;
  const cached = quoteCache.get(key);
  if (cached != null) return cached;
  try {
    const q = await yf.quote(symbol);
    if (!isRecord(q)) return null;
    if (String(q.quoteType ?? "") === "NONE") return null;
    const price = q.regularMarketPrice ?? q.regularMarketPreviousClose;
    const info: StockInfo = {
      symbol: String(q.symbol ?? symbol),
      shortName: String(q.shortName ?? q.longName ?? ""),
      quoteType: typeof q.quoteType === "string" ? q.quoteType : undefined,
      currency: typeof q.currency === "string" ? q.currency : undefined,
      current_price: typeof price === "number" ? price : undefined,
      previous_close:
        typeof q.regularMarketPreviousClose === "number" ? q.regularMarketPreviousClose : undefined,
      market_cap: typeof q.marketCap === "number" ? q.marketCap : undefined,
      volume:
        typeof (q.regularMarketVolume ?? q.volume) === "number"
          ? Number(q.regularMarketVolume ?? q.volume)
          : undefined,
      description: typeof q.longName === "string" ? q.longName : undefined,
    };
    quoteCache.set(key, info);
    return info;
  } catch {
    return null;
  }
}

/**
 * Get current price for a symbol. Returns null if not available.
 */
export async function getCurrentPrice(symbol: string): Promise<number | null> {
  const info = await getQuote(symbol);
  if (info?.current_price != null) return info.current_price;
  return null;
}

/**
 * Get historical daily prices. period: "1mo", "3mo", "6mo", "1y", "max" or date range. Cached 1 hour.
 */
export async function getHistoricalPrices(
  symbol: string,
  period: string = "max",
): Promise<HistoricalPrice[]> {
  const cacheKey = `historical:${symbol.toUpperCase()}:${period}`;
  const cached = historicalCache.get(cacheKey);
  if (cached != null) return cached;
  try {
    let period1: string;
    let period2: string = new Date().toISOString().slice(0, 10);
    if (period === "max") {
      period1 = "1970-01-01";
    } else if (period.endsWith("d")) {
      const days = parseInt(period.slice(0, -1), 10) || 30;
      const d = new Date();
      d.setDate(d.getDate() - days);
      period1 = d.toISOString().slice(0, 10);
    } else if (period.endsWith("mo")) {
      const months = parseInt(period.slice(0, -2), 10) || 1;
      const d = new Date();
      d.setMonth(d.getMonth() - months);
      period1 = d.toISOString().slice(0, 10);
    } else if (period.endsWith("y") || period.endsWith("Y")) {
      const years = parseInt(period.slice(0, -1), 10) || 1;
      const d = new Date();
      d.setFullYear(d.getFullYear() - years);
      period1 = d.toISOString().slice(0, 10);
    } else {
      period1 = "1970-01-01";
    }
    const chartResult = await yf.chart(symbol, {
      period1,
      period2,
      interval: "1d",
    });
    const quotes = (chartResult as { quotes?: unknown[] })?.quotes ?? [];
    const result = quotes.filter(isRecord).map((r) => {
      const dateRaw = r.date;
      const date =
        dateRaw instanceof Date
          ? dateRaw.toISOString().slice(0, 10)
          : stringifyUnknown(dateRaw).slice(0, 10);
      return {
        date,
        value: Number(r.close ?? 0),
        volume: Number(r.volume ?? 0),
        open: Number(r.open ?? 0),
        high: Number(r.high ?? 0),
        low: Number(r.low ?? 0),
        close: Number(r.close ?? 0),
      };
    });
    historicalCache.set(cacheKey, result);
    return result;
  } catch {
    return [];
  }
}

/**
 * Get detailed quote summary (price, summaryDetail, summaryProfile, assetProfile).
 */
export async function getQuoteSummary(symbol: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await yf.quoteSummary(symbol, {
      modules: ["price", "summaryDetail", "summaryProfile", "assetProfile", "quoteType"],
    });
    return result as Record<string, unknown>;
  } catch {
    return null;
  }
}
