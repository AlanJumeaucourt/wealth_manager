import type { BalanceHistoryResponse } from "@/api/edenDerivedTypes";
import type { WealthSummary } from "@/types/account";
import type { PortfolioSummary } from "@/types/portfolio";

export interface WealthBreakdownMetrics {
  bookNetWorth: number;
  bookGrossAssets: number;
  marketNetWorth: number;
  grossMarketAssets: number;
  cashAndSavings: number;
  loans: number;
  investmentsAtCost: number;
  investmentsAtMarket: number;
  unrealizedPl: number;
  allTimeInvestmentGain: number;
  unrealizedOnHoldings: number;
  realizedFromClosed: number;
  dividendsReceived: number;
}

export function computeWealthBreakdown(
  wealthSummary: WealthSummary | undefined,
  portfolioSummary: PortfolioSummary | undefined,
  wealthData: BalanceHistoryResponse | undefined,
): WealthBreakdownMetrics | null {
  if (!wealthSummary) return null;

  const cashAndSavings = wealthSummary.breakdown.checking + wealthSummary.breakdown.savings;
  const loans = wealthSummary.breakdown.loans;

  const sortedWealthEntries =
    wealthData && Object.keys(wealthData).length > 0
      ? Object.entries(wealthData).sort(([a], [b]) => a.localeCompare(b))
      : [];
  const latestPoint =
    sortedWealthEntries.length > 0
      ? sortedWealthEntries[sortedWealthEntries.length - 1]![1]
      : undefined;

  const assets = portfolioSummary?.assets ?? [];
  const holdingsCostBasis = assets.reduce((sum, a) => sum + (a.cost_basis ?? 0), 0);
  const holdingsMarketValue = portfolioSummary?.total_value ?? 0;
  const unrealizedOnHoldingsPortfolio = holdingsMarketValue - holdingsCostBasis;

  const allTimeInvestmentGain =
    portfolioSummary?.total_gain_loss ??
    latestPoint?.investment_gain ??
    wealthSummary.breakdown.investments_unrealized_pl;

  const dividendsReceived = portfolioSummary?.dividend_metrics?.total_dividends_received ?? 0;

  const unrealizedOnHoldings = round2(
    latestPoint?.investment_gain_unrealized ?? unrealizedOnHoldingsPortfolio,
  );
  const realizedFromClosed = round2(
    latestPoint?.investment_gain_realized ??
      allTimeInvestmentGain - unrealizedOnHoldingsPortfolio - dividendsReceived,
  );

  return {
    bookNetWorth: wealthSummary.book.net_with_debt,
    bookGrossAssets: wealthSummary.book.net_without_debt,
    marketNetWorth: wealthSummary.market.net_with_debt,
    grossMarketAssets: wealthSummary.market.net_without_debt,
    cashAndSavings,
    loans,
    investmentsAtCost: wealthSummary.breakdown.investments_book_value,
    investmentsAtMarket: wealthSummary.breakdown.investments_market_value,
    unrealizedPl: wealthSummary.breakdown.investments_unrealized_pl,
    allTimeInvestmentGain,
    unrealizedOnHoldings,
    realizedFromClosed,
    dividendsReceived,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
