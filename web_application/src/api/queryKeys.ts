export const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error("API_URL is not set")
}

// Define query key types
export type QueryKeyArray = readonly (string | number | undefined)[]

export const QueryKeys = {
  banks: ["banks"] as QueryKeyArray,
  accounts: ["accounts"] as QueryKeyArray,
  accountById: (id: number) => ["accounts", id] as QueryKeyArray,
  wealthOverTime: ["wealthOverTime"] as QueryKeyArray,
  recentTransactions: ["transactions", "recent"] as QueryKeyArray,
  transactions: ["transactions"] as QueryKeyArray,
  transactionById: (id: number) => ["transactions", id] as QueryKeyArray,
  categories: ["categories"] as QueryKeyArray,
  budgetSummary: ["budgetSummary"] as QueryKeyArray,
  allCategories: ["categories", "all"] as QueryKeyArray,
  categoryTransactions: (categoryId: string) =>
    ["categories", "transactions", categoryId] as QueryKeyArray,
  categorySummaryByDate: (startDate: string, endDate: string) =>
    ["categories", "summary", startDate, endDate] as QueryKeyArray,
  periodSummary: (startDate: string, endDate: string, period: string) =>
    [
      "budgets",
      "summary",
      "period",
      startDate,
      endDate,
      period,
    ] as QueryKeyArray,
  investments: ["investments"] as QueryKeyArray,
  investmentById: (id: number) => ["investments", id] as QueryKeyArray,
  portfolioPerformance: (period?: string) =>
    ["portfolio", "performance", period] as QueryKeyArray,
  portfolioSummary: (accountId?: number) =>
    ["portfolio", "summary", accountId] as QueryKeyArray,
  assetTransactions: (symbol: string) =>
    ["assets", symbol, "transactions"] as QueryKeyArray,
  refundGroups: ["refund_groups"] as QueryKeyArray,
  refundGroupById: (id: number) => ["refund_groups", id] as QueryKeyArray,
  refundItems: ["refund_items"] as QueryKeyArray,
  refundItemById: (id: number) => ["refund_items", id] as QueryKeyArray,
  assets: ["assets"] as QueryKeyArray,
  stockHistory: (symbol: string) =>
    ["stocks", symbol, "history"] as QueryKeyArray,
  stockSearch: (query: string) => ["stocks", "search", query] as QueryKeyArray,
  portfolioRiskMetrics: ["portfolio", "risk-metrics"] as QueryKeyArray,
  customPrices: (symbol: string) =>
    ["stocks", symbol, "custom-prices"] as QueryKeyArray,
  budgets: ["budgets"] as QueryKeyArray,
  budgetsByYearMonth: (year: number, month: number) =>
    ["budgets", year, month] as QueryKeyArray,
  budgetComparison: (year: number, month: number) =>
    ["budgets", "comparison", year, month] as QueryKeyArray,
  // Liability keys
  liabilities: ["liabilities"] as QueryKeyArray,
  liabilityById: (id: number) => ["liabilities", id] as QueryKeyArray,
  // Keep these for backward compatibility
  liabilityDetails: ["liabilities"] as QueryKeyArray, // Consider removing if truly redundant
  liabilityDetailById: (id: number) => ["liabilities", id] as QueryKeyArray, // Consider removing if truly redundant
  liabilityAmortization: (id: number) => ["liabilities", id, "amortization"] as QueryKeyArray,
  liabilityPayments: ["liability_payments"] as QueryKeyArray,
  liabilityPaymentById: (id: number) => ["liability_payments", id] as QueryKeyArray,
  liabilityPaymentsByLiability: (liabilityId: number) =>
    ["liability_payments", "liability", liabilityId] as QueryKeyArray,
} as const
