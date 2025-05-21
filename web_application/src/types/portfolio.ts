import {
    createQuery,
    fetchWithAuth
} from "../api/apiUtils";
import { QueryKeys } from "../api/queryKeys";
import { useQuery } from "@tanstack/react-query";

// Moved from types.ts
export interface AssetSummary {
  avg_buy_price: number
  cost_basis: number
  current_price: number
  current_value: number
  gain_loss: number
  gain_loss_percentage: number
  name: string
  portfolio_percentage: number
  shares: number
  symbol: string
}

export interface DividendMetrics {
  current_year_dividends: number
  dividend_growth: number
  monthly_income_estimate: number
  portfolio_yield: number
  previous_year_dividends: number
  total_dividends_received: number
}

export interface PortfolioMetrics {
  diversification_score: number
  largest_position_percentage: number
  number_of_positions: number
}

// Type Definitions (Moved from types.ts and queries.ts)
export interface PortfolioSummary {
  assets: AssetSummary[] // Updated to use AssetSummary defined above
  currency: string
  dividend_metrics: DividendMetrics // Updated to use DividendMetrics defined above
  initial_investment: number
  last_update: string
  metrics: PortfolioMetrics // Updated to use PortfolioMetrics defined above
  net_investment: number
  returns_include_dividends: boolean
  total_gain_loss: number
  total_gain_loss_percentage: number
  total_value: number
  total_withdrawals: number
}

export interface RiskMetricsByAsset { // Added export (from queries.ts)
  contribution_to_risk: number
  max_drawdown: number
}

export interface RollingMetric { // Added export (from queries.ts)
  date: string
  sharpe_ratio: number
  volatility: number
}

export interface PortfolioRiskMetrics { // Added export (from queries.ts)
  max_drawdown: number
  risk_metrics_by_asset: Record<string, RiskMetricsByAsset>
  rolling_metrics: RollingMetric[] | null
  sharpe_ratio: number
  volatility: number
}

export interface PortfolioPerformance { // Added export (from queries.ts)
  data_points: Array<{
    absolute_gain: number
    assets: {
      [symbol: string]: {
        price: number
        shares: number
        total_value: number
        cost_basis_per_share?: number
      }
    }
    cumulative_dividends: number
    date: string
    net_invested: number
    performance: number
    total_gains: number
    total_value: number
    tri: number
  }>
  summary: {
    current_value: number
    initial_investment: number
    net_investment: number
    total_return: number
    total_withdrawals: number
  }
}

// Hooks (Moved from queries.ts)
export function usePortfolioRiskMetrics() {
  return createQuery<PortfolioRiskMetrics>({
    queryKey: QueryKeys.portfolioRiskMetrics,
    queryFn: () => fetchWithAuth("investments/portfolio/risk-metrics"),
  });
}

export function usePortfolioSummary(accountId?: number) {
  return createQuery<PortfolioSummary>({
    queryKey: QueryKeys.portfolioSummary(accountId),
    queryFn: () => {
      const queryParams = new URLSearchParams(
        accountId ? { account_id: String(accountId) } : {}
      );
      return fetchWithAuth(`investments/portfolio/summary?${queryParams}`);
    },
  });
}

export function usePortfolioPerformance(period: string = "1Y") {
  return createQuery<PortfolioPerformance>({
    queryKey: QueryKeys.portfolioPerformance(period),
    queryFn: () =>
      fetchWithAuth(`investments/portfolio/performance?period=${period}`),
  });
}
