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
  market_value: number
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

// User types
export interface User {
  name: string
  email: string
  avatar?: string
}

// GoCardless types
export interface GoCardlessInstitution {
  id: string
  name: string
  bic?: string
  transaction_total_days?: string
  max_access_valid_for_days?: string
  countries: string[]
  logo: string
  supported_features?: string[]
  identification_codes?: string[]
}

export type GoCardlessRequisitionStatus =
  | "CR" // Created
  | "ID" // Initiated
  | "LN" // Linked
  | "RJ" // Rejected
  | "ER" // Error
  | "SU" // Suspended
  | "EX" // Expired
  | "GC" // GivenConsent
  | "UA" // UserAuthenticated
  | "GA" // GrantedAuthorisation
  | "SA" // SelectingAccounts

export interface GoCardlessRequisition {
  id: string
  created?: string
  redirect: string
  status: GoCardlessRequisitionStatus
  institution_id: string
  agreement?: string
  reference?: string
  accounts: string[]
  user_language?: string
  link: string
  account_selection?: boolean
  redirect_immediate?: boolean
}

export interface GoCardlessAccount {
  id: string
  created: string
  last_accessed: string
  iban?: string
  bban?: string
  status: string
  institution_id: string
  owner_name?: string
  currency?: string
  balance?: number
  account_type?: string
}

export interface GoCardlessAccountDetail {
  account: {
    resourceId: string
    iban?: string
    bban?: string
    currency?: string
    ownerName?: string
    name?: string
    product?: string
    cashAccountType?: string
    status?: string
    bic?: string
    linkedAccounts?: string
  }
}

export interface GoCardlessBalanceAmount {
  amount: string
  currency: string
}

export interface GoCardlessBalance {
  balanceAmount: GoCardlessBalanceAmount
  balanceType: string
  referenceDate?: string
}

export interface GoCardlessAccountBalance {
  balances: GoCardlessBalance[]
}

export interface GoCardlessTransactionAmount {
  amount: string
  currency: string
}

export interface GoCardlessTransaction {
  transactionId?: string
  internalTransactionId?: string
  bookingDate?: string
  valueDate?: string
  transactionAmount: GoCardlessTransactionAmount
  debtorName?: string
  debtorAccount?: {
    iban?: string
  }
  creditorName?: string
  creditorAccount?: {
    iban?: string
  }
  remittanceInformationUnstructured?: string
  remittanceInformationUnstructuredArray?: string[]
  bankTransactionCode?: string
}

export interface GoCardlessAccountTransactions {
  transactions: {
    booked: GoCardlessTransaction[]
    pending?: GoCardlessTransaction[]
  }
}

export interface GoCardlessEndUserAgreement {
  id: string
  created: string
  institution_id: string
  max_historical_days?: number
  access_valid_for_days?: number
  access_scope?: string[]
  accepted?: string
}

export interface GoCardlessError {
  summary: string
  detail: string
  type?: string
  status_code: number
}

export interface GoCardlessToken {
  access: string
  access_expires: number
  refresh: string
  refresh_expires: number
}

export interface GoCardlessCredentials {
  secret_id: string
  secret_key: string
}

// Add StockPrice interface that was referenced in queries.ts but not defined
export interface StockPrice {
  close: number
  date: string
  high: number
  low: number
  open: number
  value: number
  volume: number
}
