import { db } from "../db/client.js";
import * as market from "./market.js";

/** Matches frontend AssetSummary (types/portfolio.ts). */
export interface AssetSummary {
  avg_buy_price: number;
  cost_basis: number;
  current_price: number;
  current_value: number;
  gain_loss: number;
  gain_loss_percentage: number;
  name: string;
  portfolio_percentage: number;
  shares: number;
  symbol: string;
}

/** Matches frontend DividendMetrics. */
export interface DividendMetrics {
  current_year_dividends: number;
  dividend_growth: number;
  monthly_income_estimate: number;
  portfolio_yield: number;
  previous_year_dividends: number;
  total_dividends_received: number;
}

/** Matches frontend PortfolioMetrics. */
export interface PortfolioMetrics {
  diversification_score: number;
  largest_position_percentage: number;
  number_of_positions: number;
}

/** Matches frontend PortfolioSummary (types/portfolio.ts). */
export interface PortfolioSummary {
  assets: AssetSummary[];
  currency: string;
  dividend_metrics: DividendMetrics;
  initial_investment: number;
  last_update: string;
  metrics: PortfolioMetrics;
  net_investment: number;
  returns_include_dividends: boolean;
  total_gain_loss: number;
  total_gain_loss_percentage: number;
  total_value: number;
  total_withdrawals: number;
}

const ZERO_DIVIDEND_METRICS: DividendMetrics = {
  current_year_dividends: 0,
  dividend_growth: 0,
  monthly_income_estimate: 0,
  portfolio_yield: 0,
  previous_year_dividends: 0,
  total_dividends_received: 0,
};

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/**
 * Build portfolio summary for the frontend.
 * Mirrors legacy Python `get_portfolio_summary` behaviour.
 */
export async function getPortfolioSummary(
  userId: number,
  accountId?: number,
): Promise<PortfolioSummary> {
  const database = db();

  // --- Step 1: investment_transactions for initial/net investment & dividends ---
  let invQ = database
    .selectFrom("investment_details")
    .innerJoin("transactions", "transactions.id", "investment_details.transaction_id")
    .select([
      "investment_details.investment_type as investment_type",
      "investment_details.total_paid as total_paid",
      "transactions.date as date",
      "transactions.from_account_id as from_account_id",
      "transactions.to_account_id as to_account_id",
    ])
    .where("transactions.user_id", "=", userId);

  // When an account_id is provided, scope investment flows to transactions
  // where the account participates (either as source or destination).
  if (accountId != null) {
    invQ = invQ.where((eb) =>
      eb.or([
        eb("transactions.from_account_id", "=", accountId),
        eb("transactions.to_account_id", "=", accountId),
      ]),
    );
  }

  const invRows = await invQ.orderBy("transactions.date", "asc").execute();

  let initialInvestment = 0;
  let totalWithdrawals = 0;
  let totalDividends = 0;

  for (const tx of invRows ?? []) {
    const t = String(tx.investment_type ?? "");
    const totalPaid = Number(tx.total_paid ?? 0);
    if (t === "Buy") {
      initialInvestment += totalPaid;
    } else if (t === "Sell") {
      totalWithdrawals += totalPaid;
    } else if (t === "Dividend") {
      totalDividends += totalPaid;
    }
  }

  const netInvestment = initialInvestment - totalWithdrawals;

  // Dividend metrics: current year / previous year / growth / monthly estimate
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  let currentYearDividends = 0;
  let previousYearDividends = 0;

  for (const tx of invRows ?? []) {
    if (tx.investment_type !== "Dividend") continue;
    const rawDate = String(tx.date ?? "").slice(0, 10);
    if (!rawDate) continue;
    const year = Number(rawDate.slice(0, 4));
    const amount = Number(tx.total_paid ?? 0);
    if (year === currentYear) currentYearDividends += amount;
    else if (year === currentYear - 1) previousYearDividends += amount;
  }

  let dividendGrowth = 0;
  if (previousYearDividends > 0) {
    dividendGrowth = ((currentYearDividends - previousYearDividends) / previousYearDividends) * 100;
  }

  // Note: keep legacy formula, even if slightly odd, for parity.
  const monthlyIncomeEstimate =
    currentMonth > 0 ? (currentYearDividends / currentMonth) * (1 / 12) : 0;

  // --- Step 2: holdings from asset_balances_by_account (optionally filtered by account_id) ---
  let balancesQ = database
    .selectFrom("asset_balances_by_account")
    .select(["symbol", "asset_name", "quantity", "asset_id", "account_id"])
    .where("user_id", "=", userId);
  if (accountId != null) {
    balancesQ = balancesQ.where("account_id", "=", accountId);
  }
  const balanceRows = await balancesQ.execute();

  if (!balanceRows || balanceRows.length === 0) {
    return emptySummary();
  }

  // Aggregate quantity by symbol / asset
  const bySymbol = new Map<string, { shares: number; asset_id: number; name: string }>();
  for (const r of balanceRows) {
    const sym = String(r.symbol ?? "").trim();
    if (!sym) continue;
    const key = sym;
    const qty = Number(r.quantity ?? 0);
    const existing = bySymbol.get(key);
    if (existing) {
      existing.shares += qty;
    } else {
      bySymbol.set(key, {
        shares: qty,
        asset_id: Number(r.asset_id),
        name: String(r.asset_name ?? r.symbol ?? sym),
      });
    }
  }

  if (bySymbol.size === 0) {
    return emptySummary();
  }

  // --- Step 3: average buy price per asset (all accounts, buys only) ---
  const assetIds = [...new Set([...bySymbol.values()].map((v) => v.asset_id))];
  const avgRows = await database
    .selectFrom("investment_details")
    .innerJoin("transactions", "transactions.id", "investment_details.transaction_id")
    .select((eb) => [
      eb.ref("investment_details.asset_id").as("asset_id"),
      eb.fn.avg("investment_details.unit_price").as("avg_buy_price"),
    ])
    .where("transactions.user_id", "=", userId)
    .where("investment_details.investment_type", "=", "Buy")
    .where("investment_details.asset_id", "in", assetIds)
    .groupBy("investment_details.asset_id")
    .execute();

  const avgByAssetId = new Map<number, number>();
  for (const r of avgRows ?? []) {
    const assetId = Number((r as { asset_id: unknown }).asset_id);
    const avg = Number((r as { avg_buy_price: unknown }).avg_buy_price ?? 0);
    avgByAssetId.set(assetId, avg);
  }

  // --- Step 4: price & positions, dividend yield, diversification metrics ---
  const assets: AssetSummary[] = [];
  let totalPortfolioValue = 0;
  let largestPositionValue = 0;

  const symbols = [...bySymbol.keys()];
  const priceResults = await Promise.all(symbols.map((symbol) => market.getCurrentPrice(symbol)));
  const currentPrices: Record<string, number> = {};
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    if (symbol === undefined) continue;
    const meta = bySymbol.get(symbol)!;
    const price = priceResults[i];
    const avgBuy = avgByAssetId.get(meta.asset_id) ?? 0;
    const priceToUse = price != null ? price : avgBuy;
    currentPrices[symbol] = priceToUse;
    const positionValue = meta.shares * priceToUse;
    totalPortfolioValue += positionValue;
    if (positionValue > largestPositionValue) largestPositionValue = positionValue;
  }

  // Dividend yield (portfolio_yield) using trailing 12m approximation from legacy
  let portfolioYield = 0;
  if (totalPortfolioValue > 0) {
    if (previousYearDividends > 0) {
      const monthWeight = currentMonth / 12;
      const trailing12 =
        currentYearDividends * monthWeight + previousYearDividends * (1 - monthWeight);
      portfolioYield = (trailing12 / totalPortfolioValue) * 100;
    } else {
      const annualized = currentMonth > 0 ? (currentYearDividends / currentMonth) * 12 : 0;
      portfolioYield = (annualized / totalPortfolioValue) * 100;
    }
  }

  const positionWeights: number[] = [];

  for (const [symbol, meta] of bySymbol) {
    const shares = meta.shares;
    const avgBuyPrice = avgByAssetId.get(meta.asset_id) ?? 0;
    const currentPrice = currentPrices[symbol] ?? 0;

    const currentValue = shares * currentPrice;
    const costBasis = shares * avgBuyPrice;
    const gainLoss = currentValue - costBasis;
    const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
    const portfolioPct = totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0;

    positionWeights.push(portfolioPct / 100);

    assets.push({
      symbol,
      name: meta.name,
      shares: round2(shares),
      avg_buy_price: round4(avgBuyPrice),
      current_price: round4(currentPrice),
      current_value: round2(currentValue),
      cost_basis: round2(costBasis),
      gain_loss: round2(gainLoss),
      gain_loss_percentage: round2(gainLossPct),
      portfolio_percentage: round2(portfolioPct),
    });
  }

  // Totals & metrics
  const totalValue = totalPortfolioValue;
  const totalGainLoss = totalValue + totalDividends - netInvestment;
  const totalGainLossPct =
    netInvestment > 0 ? ((totalValue + totalDividends - netInvestment) / netInvestment) * 100 : 0;

  // Herfindahl-Hirschman Index diversification score
  let diversificationScore = 0;
  let largestPct = 0;
  if (positionWeights.length > 0 && totalPortfolioValue > 0) {
    const hhi = positionWeights.reduce((s, w) => s + w * w, 0);
    diversificationScore = (1 - hhi) * 100;
    largestPct = (largestPositionValue / totalPortfolioValue) * 100;
  }

  // Sort assets by portfolio percentage (desc) like legacy
  assets.sort((a, b) => b.portfolio_percentage - a.portfolio_percentage);

  return {
    assets,
    currency: "EUR",
    dividend_metrics: {
      total_dividends_received: round2(totalDividends),
      current_year_dividends: round2(currentYearDividends),
      previous_year_dividends: round2(previousYearDividends),
      dividend_growth: round2(dividendGrowth),
      monthly_income_estimate: round2(monthlyIncomeEstimate),
      portfolio_yield: round2(portfolioYield),
    },
    initial_investment: round2(initialInvestment),
    last_update: new Date().toISOString(),
    metrics: {
      number_of_positions: assets.length,
      largest_position_percentage: round2(largestPct),
      diversification_score: round2(diversificationScore),
    },
    net_investment: round2(netInvestment),
    returns_include_dividends: true,
    total_gain_loss: round2(totalGainLoss),
    total_gain_loss_percentage: round2(totalGainLossPct),
    total_value: round2(totalValue),
    total_withdrawals: round2(totalWithdrawals),
  };
}

function emptySummary(): PortfolioSummary {
  return {
    assets: [],
    currency: "EUR",
    dividend_metrics: ZERO_DIVIDEND_METRICS,
    initial_investment: 0,
    last_update: new Date().toISOString(),
    metrics: {
      number_of_positions: 0,
      largest_position_percentage: 0,
      diversification_score: 0,
    },
    net_investment: 0,
    returns_include_dividends: true,
    total_gain_loss: 0,
    total_gain_loss_percentage: 0,
    total_value: 0,
    total_withdrawals: 0,
  };
}
