import { db } from "../db/client.js";
import { round2, round4 } from "../utils/money.js";
import * as market from "./market.js";

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
}

export interface PortfolioPerformanceResult {
  data_points: PerformanceDataPoint[];
}

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
): Promise<PortfolioPerformanceResult> {
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
    return { data_points: [] };
  }

  // Date range from first tx to "now"
  const firstDateStr = String(txRows[0]!.date).slice(0, 10);
  const startDate = new Date(firstDateStr);
  const endDate = new Date();
  const allDates: string[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().slice(0, 10));
  }

  // Pre-fetch historical prices (via Yahoo) and enrich with transaction prices as fallback.
  const uniqueSymbols = [...new Set<string>(txRows.map((r) => r.symbol))];
  const historicalPrices: Record<string, Record<string, number>> = {};
  const histResults = await Promise.all(
    uniqueSymbols.map((symbol) => market.getHistoricalPrices(symbol, "max")),
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
  let initialInvestment = 0;
  let totalWithdrawals = 0;
  let totalDividendsReceived = 0;

  type State = {
    holdings: Record<string, number>;
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
    const totalPaid = tx.total_paid != null ? Number(tx.total_paid) : quantity * unitPrice;
    const fee = Number(tx.fee ?? 0);
    const tax = Number(tx.tax ?? 0);

    if (!(symbol in ownedAssets)) ownedAssets[symbol] = 0;

    if (invType === "buy") {
      ownedAssets[symbol] = (ownedAssets[symbol] ?? 0) + quantity;
      initialInvestment += totalPaid;
    } else if (invType === "sell") {
      const proceeds = quantity * unitPrice - fee - tax;
      ownedAssets[symbol] = (ownedAssets[symbol] ?? 0) - quantity;
      totalWithdrawals += proceeds;
    } else if (invType === "dividend") {
      totalDividendsReceived += totalPaid;
    }

    if ((ownedAssets[symbol] ?? 0) <= 1e-9) {
      delete ownedAssets[symbol];
    }

    const netInvested = initialInvestment - totalWithdrawals;
    portfolioStates[txDateStr] = {
      holdings: { ...ownedAssets },
      net_invested: netInvested,
      cumulative_dividends: totalDividendsReceived,
    };
  }

  // Step 2: daily values.
  const dataPoints: PerformanceDataPoint[] = [];
  const stateChangeDates = Object.keys(portfolioStates).sort();
  let lastState: State = { holdings: {}, net_invested: 0, cumulative_dividends: 0 };
  let stateIdx = 0;

  const periodStart = computePeriodStart(periodParam);

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

    const { holdings, net_invested: netInvested, cumulative_dividends: cd } = lastState;

    let totalValue = 0;
    const assetsData: Record<string, { shares: number; price: number; total_value: number }> = {};

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
          });
        }
      }
      continue;
    }

    for (const [symbol, shares] of Object.entries(holdings)) {
      if (shares <= 1e-9) continue;
      const history = historicalPrices[symbol] ?? {};
      let price: number | undefined;

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

      if (price == null || price <= 0) {
        price = 0;
      }

      const value = shares * price;
      totalValue += value;
      assetsData[symbol] = {
        shares: round4(shares),
        price: round4(price),
        total_value: round2(value),
      };
    }

    const totalGains = totalValue + cd - netInvested;
    const totalGainsNoDiv = totalValue - netInvested;

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
      });
    }
  }

  return { data_points: dataPoints };
}
