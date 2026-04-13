/** Canonical shapes from the backend (see wealth-backend-typescript `getPortfolioSummary`). */
export type { PortfolioSummary } from "wealth-backend-typescript/services/portfolioSummary";

export interface RiskMetricsByAsset {
  contribution_to_risk: number;
  max_drawdown: number;
}

export interface RollingMetric {
  date: string;
  sharpe_ratio: number;
  volatility: number;
}

export interface PortfolioRiskMetrics {
  max_drawdown: number;
  risk_metrics_by_asset: Record<string, RiskMetricsByAsset>;
  rolling_metrics: RollingMetric[] | null;
  sharpe_ratio: number;
  volatility: number;
}

/** UI-oriented performance view (may extend backend `PortfolioPerformanceResult`). */
export interface PortfolioPerformance {
  data_points: Array<{
    absolute_gain: number;
    assets: {
      [symbol: string]: {
        price: number;
        shares: number;
        total_value: number;
        cost_basis_per_share?: number;
      };
    };
    cumulative_dividends: number;
    date: string;
    net_invested: number;
    performance: number;
    total_gains: number;
    total_value: number;
    tri: number;
  }>;
  summary: {
    current_value: number;
    initial_investment: number;
    net_investment: number;
    total_return: number;
    total_withdrawals: number;
  };
}
