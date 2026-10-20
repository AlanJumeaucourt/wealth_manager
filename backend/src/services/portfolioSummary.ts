import { db } from "../db/client.js";
import { convert } from "../utils/currency.js";
import { round2, round4 } from "../utils/money.js";
import * as market from "./market.js";
import { getUserPreferredCurrency } from "./user.js";

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

/**
 * Build portfolio summary for the frontend.
 * Mirrors legacy Python `get_portfolio_summary` behaviour.
 */
export async function getPortfolioSummary(
  userId: number,
  accountId?: number,
): Promise<PortfolioSummary> {
  const database = db();
  const preferred = await getUserPreferredCurrency(userId);

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

  const accountIds = new Set<number>();
  for (const tx of invRows ?? []) {
    if (tx.from_account_id != null) accountIds.add(Number(tx.from_account_id));
    if (tx.to_account_id != null) accountIds.add(Number(tx.to_account_id));
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

  const cashCurrencyForTx = (tx: {
    investment_type: string | null;
    from_account_id: number | null;
    to_account_id: number | null;
  }): string => {
    const t = String(tx.investment_type ?? "").toLowerCase();
    const fromId = tx.from_account_id != null ? Number(tx.from_account_id) : null;
    const toId = tx.to_account_id != null ? Number(tx.to_account_id) : null;
    if (t === "buy" || t === "deposit") {
      return (fromId != null ? accountCurrency.get(fromId) : undefined) ?? preferred;
    }
    return (
      (toId != null ? accountCurrency.get(toId) : undefined) ??
      (fromId != null ? accountCurrency.get(fromId) : undefined) ??
      preferred
    );
  };

  const toPreferred = (amount: number, fromCurrency: string) =>
    convert(amount, fromCurrency, preferred);

  let initialInvestment = 0;
  let totalWithdrawals = 0;
  let totalDividends = 0;

  for (const tx of invRows ?? []) {
    const t = String(tx.investment_type ?? "");
    const totalPaid = await toPreferred(Number(tx.total_paid ?? 0), cashCurrencyForTx(tx));
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
    const amount = await toPreferred(Number(tx.total_paid ?? 0), cashCurrencyForTx(tx));
    if (year === currentYear) currentYearDividends += amount;
    else if (year === currentYear - 1) previousYearDividends += amount;
  }

  let dividendGrowth = 0;
  if (previousYearDividends > 0) {
    dividendGrowth = ((currentYearDividends - previousYearDividends) / previousYearDividends) * 100;
  }

  const monthlyIncomeEstimate = currentMonth > 0 ? currentYearDividends / currentMonth : 0;

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
    return emptySummary(preferred);
  }

  // Aggregate quantity by symbol / asset
  const bySymbol = new Map<string, { shares: number; asset_id: number; name: string }>();
  for (const r of balanceRows) {
    const sym = String(r.symbol ?? "").trim();
    if (!sym) continue;
    const key = sym;
    const qty = Number(r.quantity ?? 0);
    if (qty <= 1e-9) continue;
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
    return emptySummary(preferred);
  }

  // --- Step 3: average-cost basis (same method as portfolioPerformance) ---
  const assetIds = [...new Set([...bySymbol.values()].map((v) => v.asset_id))];
  let costTxQ = database
    .selectFrom("investment_details")
    .innerJoin("transactions", "transactions.id", "investment_details.transaction_id")
    .innerJoin("assets", "assets.id", "investment_details.asset_id")
    .select([
      "investment_details.asset_id as asset_id",
      "assets.symbol as symbol",
      "investment_details.investment_type as investment_type",
      "investment_details.quantity as quantity",
      "investment_details.unit_price as unit_price",
      "investment_details.total_paid as total_paid",
      "investment_details.fee as fee",
      "investment_details.tax as tax",
      "transactions.date as date",
      "transactions.from_account_id as from_account_id",
      "transactions.to_account_id as to_account_id",
    ])
    .where("transactions.user_id", "=", userId)
    .where("investment_details.asset_id", "in", assetIds);
  if (accountId != null) {
    costTxQ = costTxQ.where((eb) =>
      eb.or([
        eb("transactions.from_account_id", "=", accountId),
        eb("transactions.to_account_id", "=", accountId),
      ]),
    );
  }
  const costTxRows = await costTxQ.orderBy("transactions.date", "asc").execute();

  // Ensure cash-currency map covers cost-basis transactions as well
  for (const tx of costTxRows ?? []) {
    if (tx.from_account_id != null) accountIds.add(Number(tx.from_account_id));
    if (tx.to_account_id != null) accountIds.add(Number(tx.to_account_id));
  }
  if (accountIds.size > accountCurrency.size) {
    const accountRows = await database
      .selectFrom("accounts")
      .select(["id", "currency"])
      .where("id", "in", [...accountIds])
      .execute();
    for (const a of accountRows) {
      accountCurrency.set(Number(a.id), String(a.currency ?? preferred).toUpperCase());
    }
  }

  const sharesByAssetId = new Map<number, number>();
  const costBasisByAssetId = new Map<number, number>();
  for (const tx of costTxRows ?? []) {
    const assetId = Number(tx.asset_id);
    const invType = String(tx.investment_type ?? "").toLowerCase();
    const quantity = Number(tx.quantity ?? 0);
    const unitPrice = Number(tx.unit_price ?? 0);
    const nativePaid = tx.total_paid != null ? Number(tx.total_paid) : quantity * unitPrice;
    const totalPaid = await toPreferred(nativePaid, cashCurrencyForTx(tx));

    if (invType === "buy" || invType === "deposit") {
      sharesByAssetId.set(assetId, (sharesByAssetId.get(assetId) ?? 0) + quantity);
      costBasisByAssetId.set(assetId, (costBasisByAssetId.get(assetId) ?? 0) + totalPaid);
    } else if (invType === "sell" || invType === "withdrawal") {
      const heldBefore = sharesByAssetId.get(assetId) ?? 0;
      const basisBefore = costBasisByAssetId.get(assetId) ?? 0;
      const avgCost = heldBefore > 1e-9 ? basisBefore / heldBefore : 0;
      const soldBasis = avgCost * quantity;
      sharesByAssetId.set(assetId, heldBefore - quantity);
      costBasisByAssetId.set(assetId, Math.max(0, basisBefore - soldBasis));
    }

    if ((sharesByAssetId.get(assetId) ?? 0) <= 1e-9) {
      sharesByAssetId.delete(assetId);
      costBasisByAssetId.delete(assetId);
    }
  }

  const avgByAssetId = new Map<number, number>();
  const openCostByAssetId = new Map<number, number>();
  for (const [, meta] of bySymbol) {
    const openCost = costBasisByAssetId.get(meta.asset_id) ?? 0;
    const openShares = sharesByAssetId.get(meta.asset_id) ?? meta.shares;
    const avg = openShares > 1e-9 ? openCost / openShares : 0;
    avgByAssetId.set(meta.asset_id, avg);
    openCostByAssetId.set(meta.asset_id, openCost);
  }

  // --- Step 4: price & positions, dividend yield, diversification metrics ---
  const assets: AssetSummary[] = [];
  let totalPortfolioValue = 0;
  let largestPositionValue = 0;

  const symbols = [...bySymbol.keys()];
  const quoteResults = await Promise.all(symbols.map((symbol) => market.getQuote(symbol)));
  const currentPrices: Record<string, number> = {};
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    if (symbol === undefined) continue;
    const meta = bySymbol.get(symbol)!;
    const quote = quoteResults[i];
    const avgBuy = avgByAssetId.get(meta.asset_id) ?? 0;
    const nativePrice = quote?.current_price != null ? quote.current_price : avgBuy;
    const quoteCurrency = (quote?.currency ?? preferred).toUpperCase();
    // avgBuy is already in preferred (from converted cost basis); only convert live quotes
    const priceToUse =
      quote?.current_price != null ? await toPreferred(nativePrice, quoteCurrency) : nativePrice;
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
    const costBasis = openCostByAssetId.get(meta.asset_id) ?? shares * avgBuyPrice;
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
    currency: preferred,
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

function emptySummary(currency = "EUR"): PortfolioSummary {
  return {
    assets: [],
    currency,
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
