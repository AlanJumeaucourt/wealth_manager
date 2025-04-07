export interface Bank {
  id: number
  name: string
  website?: string
}

export interface Account {
  id: number
  name: string
  type: "checking" | "expense" | "income" | "investment" | "savings"
  balance: number
  bank_id: number
  user_id: number

  account_number: string
}

export interface Transaction {
  id: number
  date: string
  date_accountability: string
  description: string
  amount: number
  from_account_id: number
  to_account_id: number
  type: "expense" | "income" | "transfer"
  category: string
  subcategory?: string
  refunded_amount: number
  is_investment: boolean
  refund_items?: Array<{
    amount: number;
    date: string;
    description: string
    id: number
    refund_group_id?: number | null
  }>
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
}

export interface CategoryMetadata {
  color: string
  iconName: string
  iconSet: string
  name: {
    en: string
    fr: string
  }
  subCategories: Array<{
    iconName: string
    iconSet: string
    name: {
      en: string
      fr: string
    }
  }> | null
}

export interface CategorySummary {
  count: number
  net_amount: number
  original_amount: number
  transactions: Transaction[]
}

export interface CategoryTotal {
  net: number
  original: number
}

export interface CategorySummarySection {
  by_category: Record<string, CategorySummary>
  total: CategoryTotal
}

export interface CategorySummaryResponse {
  income: CategorySummarySection
  expense: CategorySummarySection
  transfer: CategorySummarySection
}

export interface SubcategoryData {
  amount: number
  subcategory: string | null
  transactions_related: string[]
}

export interface CategoryData {
  amount: number
  category: string
  subcategories: SubcategoryData[]
}

export interface PeriodData {
  data: CategoryData[]
  start_date: string
  end_date: string
}

export interface PeriodSummaryResponse {
  period: string
  summaries: PeriodData[]
}

export interface PeriodSummary {
  period: string
  income: number
  expense: number
  net: number
}

// Refund types
export interface RefundGroup {
  id?: number
  name: string
  description?: string | null
}

export interface RefundItem {
  id?: number
  amount: number
  description?: string | null
  expense_transaction_id: number
  income_transaction_id: number
  refund_group_id?: number | null
}

export interface Investment
  extends Omit<
    Transaction,
    | "id"
    | "type"
    | "category"
    | "subcategory"
    | "refunded_amount"
    | "is_investment"
    | "amount"
  > {
  transaction_id: number
  investment_type: "Buy" | "Sell" | "Deposit" | "Withdrawal" | "Dividend"
  asset_id: number
  fee: number
  quantity: number
  tax: number
  total_paid?: number
  unit_price: number
  user_id: number
}

export type TransactionField = "date" | "description" | "category" | "amount"

export type TransactionType = "expense" | "income" | "transfer"

export type TimePeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "max"

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

export interface PortfolioSummary {
  assets: AssetSummary[]
  currency: string
  dividend_metrics: DividendMetrics
  initial_investment: number
  last_update: string
  metrics: PortfolioMetrics
  net_investment: number
  returns_include_dividends: boolean
  total_gain_loss: number
  total_gain_loss_percentage: number
  total_value: number
  total_withdrawals: number
}
