import { db } from "../db/client.js";
import { createCache } from "../utils/cache.js";
import { getExchangeRatesInRange } from "../utils/currency.js";
import { round2, round4 } from "../utils/money.js";
import * as market from "./market.js";
import { getUserPreferredCurrency } from "./user.js";

export type PortfolioPerformanceOptions = {
  /** Only emit these dates (still advances holdings chronologically). */
  sampleDates?: string[];
  /** When false, omit per-symbol `assets` payload (wealth chart only needs gains). */
  includeAssets?: boolean;
};

export interface PerformanceDataPoint {
  date: string;
  total_value: number;
  performance: number;
  performance_without_dividends: number;
  absolute_gain: number;
  assets: Record<string, { shares: number; price: number; total_value: number }>;
  tri: number;
  cumulative_dividends: number;
  net_invested: number;
  total_gains: number;
  total_gains_without_dividends: number;
  /** Paper gain on open positions (market value − cost basis). */
  unrealized_gain: number;
  /** Locked-in return: total_gains − unrealized_gain (realized sells + dividends). */
  realized_gain: number;
}

export interface PortfolioPerformanceResult {
  data_points: PerformanceDataPoint[];
}

const portfolioPerfCache = createCache<PortfolioPerformanceResult>({
  ttlMs: 5 * 60 * 1000,
  maxKeys: 200,
});

/** Binary search: index of largest element <= target, or -1 if none. */
function bsearchFloor(sorted: string[], target: string): number {
  let lo = 0,
    hi = sorted.length - 1,
    result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! <= target) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

/**
 * Normalize optional period query (e.g. "1Y") into a start-date filter.
 * Legacy backend ignored period; here we only use it to trim final points.
 */
function computePeriodStart(period?: string): string | null {
  const p = (period ?? "").trim();
  if (!p) return null;
  const end = new Date();
  if (/^\d+[yY]$/.test(p)) {
    const y = parseInt(p.slice(0, -1), 10) || 1;
    end.setFullYear(end.getFullYear() - y);
  } else if (/^\d+[mM]o?$/i.test(p)) {
    const m = parseInt(p.replace(/mo?$/i, ""), 10) || 1;
    end.setMonth(end.getMonth() - m);
  } else if (/^\d+[dD]$/.test(p)) {
    const d = parseInt(p.slice(0, -1), 10) || 30;
    end.setDate(end.getDate() - d);
  } else {
    return null;
  }
  return end.toISOString().slice(0, 10);
}

/**
 * Get portfolio performance over time.
 * Mirrors legacy Python `get_portfolio_performance` logic for holdings / gains.
 */
export async function getPortfolioPerformance(
  userId: number,
  periodParam?: string,
  accountId?: number,
  options?: PortfolioPerformanceOptions,
): Promise<PortfolioPerformanceResult> {
  const includeAssets = options?.includeAssets !== false;
  const sampleDates = options?.sampleDates;
  const sampleKey =
    sampleDates && sampleDates.length > 0
      ? `${sampleDates[0]}:${sampleDates[sampleDates.length - 1]}:${sampleDates.length}`
      : "daily";
  const cacheKey = `perf:${userId}:${accountId ?? "all"}:${periodParam ?? ""}:${sampleKey}:assets=${includeAssets}`;
  const cached = portfolioPerfCache.get(cacheKey);
  if (cached) return cached;

  const database = db();

  type TxRow = {
    date: string;
    from_account_id: number;
    to_account_id: number;
    quantity: string;
    unit_price: string;
    symbol: string;
    investment_type: string;
    fee: string | null;
    tax: string | null;
    total_paid: string | null;
  };

  let txQuery = database
    .selectFrom("transactions")
    .innerJoin("investment_details", "investment_details.transaction_id", "transactions.id")
    .innerJoin("assets", "assets.id", "investment_details.asset_id")
    .select([
      "transactions.date",
      "transactions.from_account_id",
      "transactions.to_account_id",
      "investment_details.quantity",
      "investment_details.unit_price",
      "assets.symbol",
      "investment_details.investment_type",
      "investment_details.fee",
      "investment_details.tax",
      "investment_details.total_paid",
    ])
    .where("transactions.user_id", "=", userId);

  if (accountId != null) {
    txQuery = txQuery.where((eb) =>
      eb.or([
        eb("transactions.from_account_id", "=", accountId),
        eb("transactions.to_account_id", "=", accountId),
      ]),
    );
  }

  const txRows = (await txQuery
    .orderBy("transactions.date", "asc")
    .execute()) as unknown as TxRow[];

  if (!txRows || txRows.length === 0) {
    const empty = { data_points: [] };
    portfolioPerfCache.set(cacheKey, empty);
    return empty;
  }

  const preferred = await getUserPreferredCurrency(userId);

  // Date range from first tx to "now" (or caller sample set / period window)
  const firstDateStr = String(txRows[0]!.date).slice(0, 10);
  const endDate = new Date();
  const todayKey = endDate.toISOString().slice(0, 10);
  const periodStart = computePeriodStart(periodParam);
  const evalStartStr = periodStart && periodStart > firstDateStr ? periodStart : firstDateStr;

  const allDates: string[] =
    sampleDates && sampleDates.length > 0
      ? sampleDates.filter((d) => d >= firstDateStr && (!periodStart || d >= periodStart))
      : (() => {
          const dates: string[] = [];
          // Only price/emit inside the requested period (state still built from all txs below).
          const evalStart = new Date(`${evalStartStr}T00:00:00Z`);
          for (let d = new Date(evalStart); d <= endDate; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().slice(0, 10));
          }
          return dates;
        })();

  // Account currencies for cash-leg FX into preferred
  const accountIds = new Set<number>();
  for (const tx of txRows) {
    accountIds.add(Number(tx.from_account_id));
    accountIds.add(Number(tx.to_account_id));
  }
  const accountCurrency = new Map<number, string>();
  if (accountIds.size > 0) {
    const accountRows = await database
      .selectFrom("accounts")
      .select(["id", "currency"])
      .where("id", "in", [...accountIds])
      .execute();
    for (const a of accountRows) {
      accountCurrency.set(Number(a.id), String(a.currency ?? preferred).toUpperCase());
    }
  }

  const cashCurrencyForTx = (tx: TxRow): string => {
    const t = String(tx.investment_type ?? "").toLowerCase();
    if (t === "buy" || t === "deposit") {
      return accountCurrency.get(Number(tx.from_account_id)) ?? preferred;
    }
    return (
      accountCurrency.get(Number(tx.to_account_id)) ??
      accountCurrency.get(Number(tx.from_account_id)) ??
      preferred
    );
  };

  const cashCurrencies = [...new Set(txRows.map((tx) => cashCurrencyForTx(tx)))];
  const cashRatesByCurrency: Record<string, Record<string, number>> = {};
  await Promise.all(
    cashCurrencies.map(async (c) => {
      cashRatesByCurrency[c] = await getExchangeRatesInRange(c, preferred, firstDateStr, todayKey);
    }),
  );

  const rateOnDate = (rates: Record<string, number>, dateStr: string): number => {
    if (rates[dateStr] != null) return rates[dateStr]!;
    const keys = Object.keys(rates).sort();
    let last = 1;
    for (const k of keys) {
      if (k > dateStr) break;
      last = rates[k] ?? last;
    }
    return last;
  };

  const toPreferredCash = (amount: number, tx: TxRow, dateStr: string): number => {
    const from = cashCurrencyForTx(tx);
    if (from === preferred) return amount;
    return amount * rateOnDate(cashRatesByCurrency[from] ?? {}, dateStr);
  };

  // Pre-fetch historical prices (via Yahoo) and enrich with transaction prices as fallback.
  const uniqueSymbols = [...new Set<string>(txRows.map((r) => r.symbol))];
  const quoteResults = await Promise.all(uniqueSymbols.map((symbol) => market.getQuote(symbol)));
  const livePrices: Record<string, number> = {};
  const quoteCurrencyBySymbol: Record<string, string> = {};
  for (let i = 0; i < uniqueSymbols.length; i++) {
    const symbol = uniqueSymbols[i];
    const quote = quoteResults[i];
    if (!symbol) continue;
    quoteCurrencyBySymbol[symbol] = (quote?.currency ?? preferred).toUpperCase();
    if (quote?.current_price != null && quote.current_price > 0) {
      livePrices[symbol] = quote.current_price;
    }
  }

  const quoteCurrencies = [...new Set(Object.values(quoteCurrencyBySymbol))];
  const quoteRatesByCurrency: Record<string, Record<string, number>> = {};
  await Promise.all(
    quoteCurrencies.map(async (c) => {
      quoteRatesByCurrency[c] = await getExchangeRatesInRange(c, preferred, firstDateStr, todayKey);
    }),
  );

  const toPreferredPrice = (price: number, symbol: string, dateStr: string): number => {
    const from = quoteCurrencyBySymbol[symbol] ?? preferred;
    if (from === preferred) return price;
    return price * rateOnDate(quoteRatesByCurrency[from] ?? {}, dateStr);
  };

  const historicalPrices: Record<string, Record<string, number>> = {};
  // Bound Yahoo range to the evaluation window (period), not full portfolio lifetime.
  const histFrom = new Date(`${evalStartStr}T00:00:00Z`);
  const histPeriodDays = Math.max(
    30,
    Math.ceil((Date.now() - histFrom.getTime()) / 86_400_000) + 14,
  );
  const histPeriod = `${histPeriodDays}d`;
  const histResults = await Promise.all(
    uniqueSymbols.map((symbol) => market.getHistoricalPrices(symbol, histPeriod)),
  );

  for (let si = 0; si < uniqueSymbols.length; si++) {
    const symbol = uniqueSymbols[si];
    if (symbol === undefined) continue;
    const hist = histResults[si] ?? [];
    const map: Record<string, number> = {};
    // Only store non-zero provider prices (provider sometimes returns 0 for valid dates)
    for (const h of hist) {
      if (h.close > 0) map[h.date] = h.close;
    }

    let lastTxPrice: number | null = null;
    for (const tx of txRows) {
      if (tx.symbol !== symbol) continue;
      const txDateStr = String(tx.date).slice(0, 10);
      const txPrice = Number(tx.unit_price ?? 0);
      if (!(txDateStr in map) && txPrice > 0) {
        map[txDateStr] = txPrice;
      }
      if (txPrice > 0) lastTxPrice = txPrice;
    }

    // Fill zeros and gaps with latest known price (chronological fill-forward)
    const dateKeys = Object.keys(map)
      .filter((k) => k !== "fallback_latest")
      .sort();
    let lastValidPrice: number | null = null;
    for (const d of dateKeys) {
      const v = map[d];
      if (v != null && v > 0) {
        lastValidPrice = v;
      } else if (lastValidPrice != null) {
        map[d] = lastValidPrice;
      }
    }

    if (dateKeys.length === 0) {
      map.fallback_latest = lastTxPrice ?? 0;
    } else {
      map.fallback_latest = lastValidPrice ?? lastTxPrice ?? 0;
    }

    historicalPrices[symbol] = map;
  }

  const sortedPriceDates: Record<string, string[]> = {};
  for (const symbol of uniqueSymbols) {
    sortedPriceDates[symbol] = Object.keys(historicalPrices[symbol] ?? {})
      .filter((k) => k !== "fallback_latest")
      .sort();
  }

  // Step 1: process transactions chronologically to build states.
  const ownedAssets: Record<string, number> = {};
  const costBasisBySymbol: Record<string, number> = {};
  let initialInvestment = 0;
  let totalWithdrawals = 0;
  let totalDividendsReceived = 0;

  type State = {
    holdings: Record<string, number>;
    cost_basis: Record<string, number>;
    net_invested: number;
    cumulative_dividends: number;
  };
  const portfolioStates: Record<string, State> = {};

  for (const tx of txRows) {
    const txDateStr = String(tx.date).slice(0, 10);
    const symbol = tx.symbol;
    const quantity = Number(tx.quantity ?? 0);
    const unitPrice = Number(tx.unit_price ?? 0);
    const invType = String(tx.investment_type ?? "").toLowerCase();
    const nativePaid = tx.total_paid != null ? Number(tx.total_paid) : quantity * unitPrice;
    const totalPaid = toPreferredCash(nativePaid, tx, txDateStr);
    const fee = toPreferredCash(Number(tx.fee ?? 0), tx, txDateStr);
    const tax = toPreferredCash(Number(tx.tax ?? 0), tx, txDateStr);
    const unitPricePref = toPreferredPrice(unitPrice, symbol, txDateStr);

    if (!(symbol in ownedAssets)) ownedAssets[symbol] = 0;

    if (invType === "buy") {
      ownedAssets[symbol] = (ownedAssets[symbol] ?? 0) + quantity;
      costBasisBySymbol[symbol] = (costBasisBySymbol[symbol] ?? 0) + totalPaid;
      initialInvestment += totalPaid;
    } else if (invType === "sell") {
      const heldBefore = ownedAssets[symbol] ?? 0;
      const basisBefore = costBasisBySymbol[symbol] ?? 0;
      const avgCost = heldBefore > 1e-9 ? basisBefore / heldBefore : 0;
      const soldBasis = avgCost * quantity;
      const proceeds = quantity * unitPricePref - fee - tax;
      ownedAssets[symbol] = heldBefore - quantity;
      costBasisBySymbol[symbol] = Math.max(0, basisBefore - soldBasis);
      totalWithdrawals += proceeds;
    } else if (invType === "dividend") {
      totalDividendsReceived += totalPaid;
    }

    if ((ownedAssets[symbol] ?? 0) <= 1e-9) {
      delete ownedAssets[symbol];
      delete costBasisBySymbol[symbol];
    }

    const netInvested = initialInvestment - totalWithdrawals;
    portfolioStates[txDateStr] = {
      holdings: { ...ownedAssets },
      cost_basis: { ...costBasisBySymbol },
      net_invested: netInvested,
      cumulative_dividends: totalDividendsReceived,
    };
  }

  // Step 2: daily values (evaluation window only).
  const dataPoints: PerformanceDataPoint[] = [];
  const stateChangeDates = Object.keys(portfolioStates).sort();
  let lastState: State = {
    holdings: {},
    cost_basis: {},
    net_invested: 0,
    cumulative_dividends: 0,
  };
  let stateIdx = 0;

  // Fast-forward holdings to the first evaluation date so period charts stay correct.
  const firstEval = allDates[0];
  if (firstEval) {
    while (stateIdx < stateChangeDates.length) {
      const stateKey = stateChangeDates[stateIdx];
      if (stateKey === undefined || stateKey > firstEval) break;
      const nextState = portfolioStates[stateKey];
      if (nextState !== undefined) {
        lastState = nextState;
      }
      stateIdx++;
    }
  }

  for (const dateStr of allDates) {
    while (stateIdx < stateChangeDates.length) {
      const stateKey = stateChangeDates[stateIdx];
      if (stateKey === undefined || stateKey > dateStr) break;
      const nextState = portfolioStates[stateKey];
      if (nextState !== undefined) {
        lastState = nextState;
      }
      stateIdx++;
    }

    const {
      holdings,
      cost_basis: costBasis,
      net_invested: netInvested,
      cumulative_dividends: cd,
    } = lastState;

    let openCostBasis = 0;
    for (const [symbol, shares] of Object.entries(holdings)) {
      if (shares <= 1e-9) continue;
      openCostBasis += costBasis[symbol] ?? 0;
    }

    let totalValue = 0;
    const assetsData: Record<string, { shares: number; price: number; total_value: number }> =
      includeAssets ? {} : {};

    if (Object.keys(holdings).length === 0) {
      // Mirror legacy: still allow datapoint only if there is non-zero net investment.
      if (dataPoints.length > 0 && Math.abs(netInvested) > 1e-9) {
        const totalGainsZero = -netInvested;
        const totalGainsNoDivZero = -netInvested;
        const performanceZero =
          Math.abs(netInvested) > 1e-9 ? (totalGainsZero / netInvested) * 100 : 0;
        const performanceNoDivZero =
          Math.abs(netInvested) > 1e-9 ? (totalGainsNoDivZero / netInvested) * 100 : 0;
        const triZero =
          Math.abs(netInvested) > 1e-9 && netInvested > 0 ? ((0 + cd) / netInvested) * 100 : 0;

        if (!periodStart || dateStr >= periodStart) {
          dataPoints.push({
            date: dateStr,
            total_value: 0,
            performance: round2(performanceZero),
            performance_without_dividends: round2(performanceNoDivZero),
            absolute_gain: round2(totalGainsZero),
            assets: {},
            tri: round2(triZero),
            cumulative_dividends: round2(cd),
            net_invested: round2(netInvested),
            total_gains: round2(totalGainsZero),
            total_gains_without_dividends: round2(totalGainsNoDivZero),
            unrealized_gain: 0,
            realized_gain: round2(totalGainsZero),
          });
        }
      }
      continue;
    }

    for (const [symbol, shares] of Object.entries(holdings)) {
      if (shares <= 1e-9) continue;
      const history = historicalPrices[symbol] ?? {};
      let price: number | undefined;

      // Align "today" with portfolio summary / live quotes.
      if (dateStr >= todayKey && livePrices[symbol] != null) {
        price = livePrices[symbol];
      } else {
        const sorted = sortedPriceDates[symbol] ?? [];
        const idx = bsearchFloor(sorted, dateStr);
        if (idx >= 0) {
          const priceKey = sorted[idx];
          if (priceKey !== undefined) {
            price = history[priceKey];
          }
        }

        if ((price == null || price <= 0) && "fallback_latest" in history) {
          price = history.fallback_latest;
        }
      }

      if (price == null || price <= 0) {
        price = 0;
      }

      const pricePref = toPreferredPrice(price, symbol, dateStr);
      const value = shares * pricePref;
      totalValue += value;
      if (includeAssets) {
        assetsData[symbol] = {
          shares: round4(shares),
          price: round4(pricePref),
          total_value: round2(value),
        };
      }
    }

    const totalGains = totalValue + cd - netInvested;
    const totalGainsNoDiv = totalValue - netInvested;
    const unrealizedGain = totalValue - openCostBasis;
    const realizedGain = totalGains - unrealizedGain;

    let performance = 0;
    let performanceNoDiv = 0;
    let tri = 0;

    if (Math.abs(netInvested) > 1e-9) {
      performance = ((totalValue + cd - netInvested) / netInvested) * 100;
      performanceNoDiv = ((totalValue - netInvested) / netInvested) * 100;
      if (netInvested > 0) {
        tri = ((totalValue + cd) / netInvested) * 100;
      }
    }

    const firstChangeDate = stateChangeDates[0] ?? dateStr;
    const isFirstDayAfterTx = dateStr >= firstChangeDate;
    const hasValueOrInvestment =
      totalValue > 1e-9 ||
      Math.abs(netInvested) > 1e-9 ||
      (!dataPoints.length && isFirstDayAfterTx);

    if (hasValueOrInvestment && (!periodStart || dateStr >= periodStart)) {
      dataPoints.push({
        date: dateStr,
        total_value: round2(totalValue),
        performance: round2(performance),
        performance_without_dividends: round2(performanceNoDiv),
        absolute_gain: round2(totalGains),
        assets: assetsData,
        tri: round2(tri),
        cumulative_dividends: round2(cd),
        net_invested: round2(netInvested),
        total_gains: round2(totalGains),
        total_gains_without_dividends: round2(totalGainsNoDiv),
        unrealized_gain: round2(unrealizedGain),
        realized_gain: round2(realizedGain),
      });
    }
  }

  const result = { data_points: dataPoints };
  portfolioPerfCache.set(cacheKey, result);
  return result;
}
