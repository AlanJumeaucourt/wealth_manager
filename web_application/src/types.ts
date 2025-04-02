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
