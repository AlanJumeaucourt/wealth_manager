import {
  Account,
  Bank,
  Investment,
  PortfolioSummary,
  RefundGroup,
  RefundItem,
  Transaction
} from "@/types"
import {
  AmortizationScheduleItem,
  Liability,
  LiabilityPayment,
} from "@/types/liability"
import { handleTokenExpiration } from "@/utils/auth"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error("API_URL is not set")
}

// Define query key types
type QueryKeyArray = readonly (string | number | undefined)[]
// type QueryKeyFn = (...args: any[]) => QueryKeyArray // Not used, can be removed if not planned for future use

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

// #region Common Interfaces
interface PaginatedResponse<T> {
  items: T[]
  page: number
  per_page: number
  total: number
}

interface TransactionPaginatedResponse extends PaginatedResponse<Transaction> {
  total_amount: number
}

interface BatchDeleteResponse {
  successful: number[]
  failed: Array<{
    id: number
    error: string
  }>
  total_successful: number
  total_failed: number
}

interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: any
}

interface BatchCreateResponse<T> {
  successful: T[]
  failed: Array<{
    data: any
    error: string
  }>
  total_successful: number
  total_failed: number
}

export interface Budget {
  id: number
  category: string
  year: number
  month: number
  amount: number
  created_at: string
  updated_at: string
}

export interface BudgetComparison {
  category: string
  budgeted: number
  actual: number
  difference: number
  percentage: number
}

interface CustomPriceData {
  close: number
  open?: number
  high?: number
  low?: number
  volume?: number
}

interface AddCustomPriceResponse {
  message: string
  price?: {
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }
}

interface BatchOperationResponse {
  message: string
  details: {
    successful: any[]
    failed: Array<{
      data?: any
      error: string
    }>
    total_successful: number
    total_failed: number
  }
}

interface DeleteCustomPriceResponse {
  message: string
}

interface StockPrice {
  close: number
  date: string
  high: number
  low: number
  open: number
  value: number // Consider if this is distinct from close or open
  volume: number
}

interface RiskMetricsByAsset {
  contribution_to_risk: number
  max_drawdown: number
}

interface RollingMetric {
  date: string
  sharpe_ratio: number
  volatility: number
}

interface PortfolioRiskMetrics {
  max_drawdown: number
  risk_metrics_by_asset: Record<string, RiskMetricsByAsset>
  rolling_metrics: RollingMetric[] | null
  sharpe_ratio: number
  volatility: number
}

export interface Asset {
  id: number
  name: string
  symbol: string
  type: string
  current_price?: number
}

export interface AssetQueryParams {
  page?: number
  per_page?: number
  sort_by?: keyof Asset
  sort_order?: "asc" | "desc"
  search?: string
  search_fields?: (keyof Asset)[]
  type?: string | string[]
  symbol?: string | string[]
}

interface PeriodSummaryData {
  start_date: string
  end_date: string
  income: {
    total: number
    by_category: Record<string, CategorySummary> // CategorySummary defined later
  }
  expense: {
    total: number
    by_category: Record<string, CategorySummary> // CategorySummary defined later
  }
}

interface PeriodSummaryResponse {
  period: string
  summaries: PeriodSummaryData[]
}

export interface PortfolioPerformance {
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

interface BalanceHistoryPoint {
  date: string
  value: number
}

interface BalanceHistoryResponse {
  [date: string]: number
}

type CategoryType = "expense" | "income" | "transfer"

interface CategoryMetadata {
  id: string
  name: {
    fr: string
    en: string
  }
  subcategories?: string[]
  icon?: string
  color?: string
}

type TransactionType = "expense" | "income" | "transfer"

type TransactionField =
  | "id"
  | "date"
  | "date_accountability"
  | "description"
  | "amount"
  | "from_account_id"
  | "to_account_id"
  | "category"
  | "subcategory"
  | "type"

interface TransactionFilters {
  type?: TransactionType | TransactionType[]
  category?: string | string[]
  subcategory?: string | string[]
  from_account_id?: number | number[]
  to_account_id?: number | number[]
  account_id?: number | number[]
  from_date?: string
  to_date?: string
  date?: string | string[]
  date_accountability?: string | string[]
  amount?: number | number[]
  id?: number | number[]
  description?: string | string[]
  has_refund?: boolean | boolean[]
}

interface TransactionQueryParams extends TransactionFilters {
  page?: number
  per_page?: number
  sort_by?: TransactionField
  sort_order?: "asc" | "desc"
  fields?: TransactionField[]
  search?: string
  search_fields?: TransactionField[]
}

interface TransactionFromCategorySummary {
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

interface CategorySummary { // Definition for PeriodSummaryData
  count: number
  net_amount: number
  original_amount: number
  transactions: TransactionFromCategorySummary[]
}

interface CategorySummaryResponse {
  income: {
    total: {
      net: number
      original: number
    }
    by_category: Record<string, CategorySummary>
  }
  expense: {
    total: {
      net: number
      original: number
    }
    by_category: Record<string, CategorySummary>
  }
  transfer: {
    total: {
      net: number
      original: number
    }
    by_category: Record<string, CategorySummary>
  }
}
// #endregion

// #region API Fetch Utilities
async function fetchWithAuth<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const token = localStorage.getItem("access_token")
  const response = await fetch(`${API_URL}/${endpoint}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })

  if (!response.ok) {
    try {
      const error = await response.json()
      if (handleTokenExpiration(error)) {
        throw new Error("Token expired")
      }
      throw new Error(
        `Failed to ${options.method || "fetch"} ${endpoint}: ${
          error.message || "Unknown error"
        }`
      )
    } catch (jsonError) {
      throw new Error(
        `Failed to ${options.method || "fetch"} ${endpoint}: ${
          response.statusText
        }`
      )
    }
  }

  if (
    options.method === "DELETE" ||
    response.headers.get("content-length") === "0"
  ) {
    return {} as T
  }

  try {
    return await response.json()
  } catch (jsonError) {
    console.warn(`Empty or invalid JSON response from ${endpoint}`)
    return {} as T
  }
}

function invalidateQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  key: keyof typeof QueryKeys
) {
  if (typeof QueryKeys[key] === "function") {
    // Special handling for functions that might need parameters
    // This logic might need adjustment based on actual usage
    if (key === "portfolioSummary") {
      queryClient.invalidateQueries({ queryKey: (QueryKeys[key] as (id?: number) => QueryKeyArray)() })
    } else if (key === "portfolioPerformance") {
      queryClient.invalidateQueries({ queryKey: (QueryKeys[key] as (period?: string) => QueryKeyArray)("1Y") })
    } else {
       // For other function-based keys, invalidate the base key or a common pattern
       // This is a simplification; specific keys might need specific invalidation patterns
      queryClient.invalidateQueries({ queryKey: [String(QueryKeys[key].toString().split(",")[0])] })
    }
  } else {
    queryClient.invalidateQueries({ queryKey: QueryKeys[key] })
  }
}

const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes

interface QueryConfig<T> {
  queryKey: readonly unknown[]
  queryFn: () => Promise<T>
  enabled?: boolean
  staleTime?: number
}

function createQuery<T>(config: QueryConfig<T>) {
  return useQuery({
    ...config,
    staleTime: config.staleTime ?? DEFAULT_STALE_TIME,
  })
}

function formatQueryValue(
  value: string | number | boolean | string[] | number[] | boolean[]
): string {
  if (Array.isArray(value)) {
    return value.join(",")
  }
  return value.toString()
}
// #endregion

// #region Factory Functions (CRUD, Batch, Paginated)
interface CrudConfig {
  endpoint: string
  queryKeysToInvalidate: (keyof typeof QueryKeys)[]
}

function createCrudOperations<T extends { id?: number }>(config: CrudConfig) {
  const { endpoint, queryKeysToInvalidate } = config

  const useBatchDelete = () => {
    const queryClient = useQueryClient()
    return createBatchDeleteMutation<T>( // createBatchDeleteMutation defined below
      endpoint,
      queryKeysToInvalidate,
      queryClient
    )
  }

  const useDelete = () => {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (id: number) =>
        fetchWithAuth(`${endpoint}/${id}`, { method: "DELETE" }),
      onSuccess: () => {
        queryKeysToInvalidate.forEach(key =>
          invalidateQueries(queryClient, key)
        )
      },
    })
  }

  const useCreate = () => {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (data: Omit<T, "id">) =>
        fetchWithAuth<T>(endpoint, { method: "POST", body: data }),
      onSuccess: () => {
        queryKeysToInvalidate.forEach(key =>
          invalidateQueries(queryClient, key)
        )
      },
    })
  }

  const useUpdate = () => {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (data: Partial<T> & { id: number }) => {
        const { id, ...updateData } = data;
        return fetchWithAuth<T>(`${endpoint}/${id}`, { method: "PUT", body: updateData });
      },
      onSuccess: () => {
        queryKeysToInvalidate.forEach(key =>
          invalidateQueries(queryClient, key)
        )
      },
    })
  }

  return {
    useBatchDelete,
    useDelete,
    useCreate,
    useUpdate,
  }
}

function createBatchDeleteMutation<T extends { id?: number }>(
  endpoint: string,
  queryKeysToInvalidate: (keyof typeof QueryKeys)[],
  queryClient: ReturnType<typeof useQueryClient>
) {
  return useMutation({
    mutationFn: async (ids: number[]) => {
      try {
        if (!Array.isArray(ids) || ids.length === 0) {
          throw new Error("No items selected for deletion")
        }
        return await fetchWithAuth<BatchDeleteResponse>(
          `${endpoint}/batch/delete`,
          {
            method: "POST",
            body: { ids },
          }
        )
      } catch (error) {
        console.error(`Batch delete error for ${endpoint}:`, error)
        throw error
      }
    },
    onSuccess: result => {
      console.log(`Batch delete results for ${endpoint}:`, result)
      queryKeysToInvalidate.forEach(key => invalidateQueries(queryClient, key))
    },
    onError: error => {
      console.error(`Batch delete operation failed for ${endpoint}:`, error)
    },
  })
}

function createBatchCreateMutation<T extends { id?: number }>(
  endpoint: string,
  queryKeysToInvalidate: (keyof typeof QueryKeys)[],
  queryClient: ReturnType<typeof useQueryClient>
) {
  return useMutation({
    mutationFn: async (items: Omit<T, "id">[]) => {
      try {
        if (!Array.isArray(items) || items.length === 0) {
          throw new Error("No items provided for batch creation")
        }
        return await fetchWithAuth<BatchCreateResponse<T>>(
          `${endpoint}/batch/create`,
          {
            method: "POST",
            body: { items },
          }
        )
      } catch (error) {
        console.error(`Batch create error for ${endpoint}:`, error)
        throw error
      }
    },
    onSuccess: result => {
      console.log(`Batch create results for ${endpoint}:`, result)
      queryKeysToInvalidate.forEach(key => invalidateQueries(queryClient, key))
    },
    onError: error => {
      console.error(`Batch create operation failed for ${endpoint}:`, error)
    },
  })
}

function createPaginatedQuery<
  T,
  P extends {
    page?: number
    per_page?: number
    sort_by?: string
    sort_order?: "asc" | "desc"
    search?: string
    search_fields?: string[]
  },
  R = PaginatedResponse<T>,
>(endpoint: string, queryKeyFn: (params: P) => unknown[]) { // Renamed queryKey to queryKeyFn for clarity
  return (params: P = {} as P) => {
    return createQuery<R>({
      queryKey: queryKeyFn(params), // Use the function to generate the key
      queryFn: () => {
        const queryParams = new URLSearchParams()

        if (params.page) queryParams.append("page", params.page.toString())
        if (params.per_page)
          queryParams.append("per_page", params.per_page.toString())
        if (params.sort_by) queryParams.append("sort_by", params.sort_by)
        if (params.sort_order)
          queryParams.append("sort_order", params.sort_order)
        if (params.search) queryParams.append("search", params.search)
        if (params.search_fields)
          queryParams.append("search_fields", params.search_fields.join(","))

        Object.entries(params).forEach(([key, value]) => {
          if (
            value !== undefined &&
            ![
              "page",
              "per_page",
              "sort_by",
              "sort_order",
              "search",
              "search_fields",
            ].includes(key)
          ) {
            queryParams.append(key, formatQueryValue(value))
          }
        })
        return fetchWithAuth(`${endpoint}?${queryParams.toString()}`)
      },
    })
  }
}
// #endregion

// #region Bank Operations and Queries
interface BankFilters {
  id?: number | number[]
  name?: string | string[]
  website?: string | string[]
}

interface BankQueryParams extends BankFilters {
  page?: number
  per_page?: number
  sort_by?: keyof Bank
  sort_order?: "asc" | "desc"
  search?: string
  search_fields?: (keyof Bank)[]
}

const bankOperations = createCrudOperations<Bank>({
  endpoint: "banks",
  queryKeysToInvalidate: ["banks", "accounts", "wealthOverTime"],
})

export const {
  useBatchDelete: useBatchDeleteBanks,
  useDelete: useDeleteBank,
  useCreate: useCreateBank,
  useUpdate: useUpdateBank,
} = bankOperations

export function useBatchCreateBanks() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<Bank>(
    "banks",
    ["banks", "accounts", "wealthOverTime"],
    queryClient
  )
}

export const useBanks = createPaginatedQuery<Bank, BankQueryParams>(
  "banks",
  params => [...QueryKeys.banks, params]
)
// #endregion

// #region Account Operations and Queries
interface AccountFilters {
  id?: number | number[]
  name?: string | string[]
  type?: string | string[]
  balance?: number | number[]
  bank_id?: number | number[]
  user_id?: number | number[]
}

interface AccountQueryParams extends AccountFilters {
  page?: number
  per_page?: number
  sort_by?: keyof Account
  sort_order?: "asc" | "desc"
  search?: string
  search_fields?: (keyof Account)[]
}

const accountOperations = createCrudOperations<Account>({
  endpoint: "accounts",
  queryKeysToInvalidate: ["accounts", "wealthOverTime"],
})

export const {
  useBatchDelete: useBatchDeleteAccounts,
  useDelete: useDeleteAccount,
  useCreate: useCreateAccount,
  useUpdate: useUpdateAccount,
} = accountOperations

export function useBatchCreateAccounts() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<Account>(
    "accounts",
    ["accounts", "wealthOverTime"],
    queryClient
  )
}

export const useAccounts = createPaginatedQuery<Account, AccountQueryParams>(
  "accounts",
  params => [...QueryKeys.accounts, params]
)

export function useAccountBalanceHistory(accountId: number) {
  return createQuery<BalanceHistoryPoint[]>({
    queryKey: [...QueryKeys.accountById(accountId), "balance_history"],
    queryFn: () => {
      const endDate = new Date().toISOString().split("T")[0]
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 500) // Consider making this configurable
      const startDateStr = startDate.toISOString().split("T")[0]

      return fetchWithAuth<BalanceHistoryResponse>(
        `accounts/${accountId}/balance_over_time?start_date=${startDateStr}&end_date=${endDate}`
      ).then(data =>
        Object.entries(data).map(([date, value]) => ({
          date,
          value,
        }))
      )
    },
    enabled: !!accountId,
  })
}

export function useWealthOverTime() {
  return createQuery<BalanceHistoryPoint[]>({
    queryKey: QueryKeys.wealthOverTime,
    queryFn: () => {
      const endDate = new Date().toISOString().split("T")[0]
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 500) // Consider making this configurable
      const startDateStr = startDate.toISOString().split("T")[0]

      return fetchWithAuth<BalanceHistoryResponse>(
        `accounts/balance_over_time?start_date=${startDateStr}&end_date=${endDate}`
      ).then(data =>
        Object.entries(data).map(([date, value]) => ({
          date,
          value: value as number, // Explicit cast for safety
        }))
      )
    },
  })
}
// #endregion

// #region Transaction Operations and Queries
const transactionOperations = createCrudOperations<Transaction>({
  endpoint: "transactions",
  queryKeysToInvalidate: [
    "transactions",
    "accounts",
    "wealthOverTime",
    "recentTransactions",
    "budgetSummary",
    "categories", // Potentially add categorySummaryByDate if granular updates needed
  ],
})

export const {
  useBatchDelete: useBatchDeleteTransactions,
  useDelete: useDeleteTransaction,
  useCreate: useCreateTransaction,
  useUpdate: useUpdateTransaction,
} = transactionOperations

export function useBatchCreateTransactions() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<Transaction>(
    "transactions",
    [
      "transactions",
      "accounts",
      "wealthOverTime",
      "recentTransactions",
      "budgetSummary",
      "categories",
    ],
    queryClient
  )
}

export const useTransactions = createPaginatedQuery<
  Transaction,
  TransactionQueryParams,
  TransactionPaginatedResponse
>("transactions", params => [...QueryKeys.transactions, params])
// #endregion

// #region Investment Operations and Queries
interface InvestmentFilters {
  transaction_id?: number | number[]
  investment_type?: string | string[]
  asset_id?: number | number[]
  date?: string | string[]
  fee?: number | number[]
  from_account_id?: number | number[]
  quantity?: number | number[]
  tax?: number | number[]
  to_account_id?: number | number[]
  total_paid?: number | number[]
  unit_price?: number | number[]
  user_id?: number | number[]
}

interface InvestmentQueryParams extends InvestmentFilters {
  page?: number
  per_page?: number
  sort_by?: keyof Investment
  sort_order?: "asc" | "desc"
  search?: string
  search_fields?: (keyof Investment)[]
}

const investmentOperations = createCrudOperations<Investment & { id?: number }>({
  endpoint: "investments",
  queryKeysToInvalidate: [
    "investments",
    "accounts",
    "portfolioSummary",
    "portfolioPerformance",
  ],
})

export const {
  useBatchDelete: useBatchDeleteInvestments,
  useDelete: useDeleteInvestment,
  useCreate: useCreateInvestment,
  useUpdate: useUpdateInvestment,
} = investmentOperations

export function useBatchCreateInvestments() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<Investment & { id?: number }>(
    "investments",
    ["investments", "accounts", "portfolioSummary", "portfolioPerformance"],
    queryClient
  )
}

export const useInvestments = createPaginatedQuery<
  Investment,
  InvestmentQueryParams
>("investments", params => [...QueryKeys.investments, params])
// #endregion

// #region RefundGroup Operations and Queries
interface RefundGroupFilters {
  id?: number | number[]
  name?: string | string[]
  description?: string | string[]
}

interface RefundGroupQueryParams extends RefundGroupFilters {
  page?: number
  per_page?: number
  sort_by?: keyof RefundGroup
  sort_order?: "asc" | "desc"
  search?: string
  search_fields?: (keyof RefundGroup)[]
}

const refundGroupOperations = createCrudOperations<RefundGroup>({
  endpoint: "refund_groups",
  queryKeysToInvalidate: ["refundGroups", "refundItems", "transactions"],
})

export const {
  useBatchDelete: useBatchDeleteRefundGroups,
  useDelete: useDeleteRefundGroup,
  useCreate: useCreateRefundGroup,
  useUpdate: useUpdateRefundGroup,
} = refundGroupOperations

export function useBatchCreateRefundGroups() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<RefundGroup>(
    "refund_groups",
    ["refundGroups", "refundItems", "transactions"],
    queryClient
  )
}

export const useRefundGroups = createPaginatedQuery<
  RefundGroup,
  RefundGroupQueryParams
>("refund_groups", params => [...QueryKeys.refundGroups, params])
// #endregion

// #region RefundItem Operations and Queries
interface RefundItemFilters {
  id?: number | number[]
  amount?: number | number[]
  description?: string | string[]
  expense_transaction_id?: number | number[]
  income_transaction_id?: number | number[]
  refund_group_id?: number | number[]
}

interface RefundItemQueryParams extends RefundItemFilters {
  page?: number
  per_page?: number
  sort_by?: keyof RefundItem
  sort_order?: "asc" | "desc"
  search?: string
  search_fields?: (keyof RefundItem)[]
}

const refundItemOperations = createCrudOperations<RefundItem>({
  endpoint: "refund_items",
  queryKeysToInvalidate: ["refundItems", "transactions"],
})

export const {
  useBatchDelete: useBatchDeleteRefundItems,
  useDelete: useDeleteRefundItem,
  useCreate: useCreateRefundItem,
  useUpdate: useUpdateRefundItem,
} = refundItemOperations

export function useBatchCreateRefundItems() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<RefundItem>(
    "refund_items",
    ["refundItems", "transactions"],
    queryClient
  )
}

export const useRefundItems = createPaginatedQuery<
  RefundItem,
  RefundItemQueryParams
>("refund_items", params => [...QueryKeys.refundItems, params])
// #endregion

// #region Asset Operations and Queries
export const useAssets = createPaginatedQuery<Asset, AssetQueryParams>(
  "assets",
  params => [...QueryKeys.assets, params]
)

export function useBatchCreateAssets() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<Asset>(
    "assets",
    ["assets"], // Consider if other keys like investments should be invalidated
    queryClient
  )
}

export function useCreateAsset() {
  const queryClient = useQueryClient()
  return useMutation<Asset, Error, { symbol: string; name: string; type: string }>({ // Added type
    mutationFn: (data) => fetchWithAuth("assets", { method: "POST", body: data }),
    onSuccess: () => {
      invalidateQueries(queryClient, "assets")
      invalidateQueries(queryClient, "investments") // Good to keep if assets are linked
      queryClient.refetchQueries({ queryKey: QueryKeys.assets })
    },
  })
}
// #endregion

// #region Stock and Custom Price Queries/Mutations
export function useStockHistory(symbol: string | undefined) {
  return createQuery<StockPrice[]>({
    queryKey: symbol
      ? QueryKeys.stockHistory(symbol)
      : ["stocks", "history", null], // Consistent key even if symbol is undefined
    queryFn: async () => {
      if (!symbol) return []
      return fetchWithAuth(`stocks/${symbol}/history`)
    },
    enabled: !!symbol,
  })
}

export function useStockSearch(query: string) {
  return createQuery<Array<{symbol: string, name: string}>>({
    queryKey: QueryKeys.stockSearch(query),
    queryFn: async () => {
      if (!query || query.length < 2) return [] // Minimum query length
      return fetchWithAuth(`stocks/search?q=${encodeURIComponent(query)}`)
    },
    enabled: query.length >= 2,
  })
}

export function useCustomPrices(symbol: string) {
  return useQuery({ // Not using createQuery as it expects ApiResponse wrapper
    queryKey: QueryKeys.customPrices(symbol),
    queryFn: async () => {
      // Assuming the API returns data directly, not wrapped in ApiResponse.data
      return fetchWithAuth(`stocks/${symbol}/custom-prices`)
    },
    enabled: !!symbol,
  })
}

export function useAddCustomPrice() {
  const queryClient = useQueryClient()
  return useMutation<
    AddCustomPriceResponse, // Assumes direct response, not ApiResponse
    Error,
    { symbol: string; date: string; price: CustomPriceData }
  >({
    mutationFn: async ({ symbol, date, price }) => {
      return fetchWithAuth(`stocks/${symbol}/custom-prices`, {
        method: "POST",
        body: { date, ...price },
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QueryKeys.customPrices(variables.symbol),
      })
    },
  })
}

export function useBatchAddCustomPrices() {
  const queryClient = useQueryClient()
  return useMutation<
    BatchOperationResponse, // Assumes direct response
    Error,
    {
      symbol: string
      prices: Array<{ date: string; price: CustomPriceData }> // price is nested
    }
  >({
    mutationFn: async ({ symbol, prices }) => {
      const formattedPrices = prices.map(p => ({ date: p.date, ...p.price })); // Format for backend
      return fetchWithAuth(`stocks/${symbol}/custom-prices/batch`, { // Added /batch to endpoint
        method: "POST",
        body: { prices: formattedPrices }, // Send as { prices: [...] }
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QueryKeys.customPrices(variables.symbol),
      })
    },
  })
}

export function useDeleteCustomPrice() {
  const queryClient = useQueryClient()
  return useMutation<
    DeleteCustomPriceResponse, // Assumes direct response
    Error,
    { symbol: string; date: string }
  >({
    mutationFn: async ({ symbol, date }) => {
      return fetchWithAuth(
        `stocks/${symbol}/custom-prices/${date}`,
        { method: "DELETE" }
      )
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QueryKeys.customPrices(variables.symbol),
      })
    },
  })
}

export function useBatchDeleteCustomPrices() {
  const queryClient = useQueryClient()
  return useMutation<
    BatchOperationResponse, // Assumes direct response
    Error,
    { symbol: string; dates: string[] }
  >({
    mutationFn: async ({ symbol, dates }) => {
      return fetchWithAuth(
        `stocks/${symbol}/custom-prices/batch/delete`, // More specific endpoint
        {
          method: "POST", // Changed to POST as DELETE with body can be problematic
          body: { dates },
        }
      )
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QueryKeys.customPrices(variables.symbol),
      })
    },
  })
}
// #endregion

// #region Portfolio Queries
export function usePortfolioRiskMetrics() {
  return createQuery<PortfolioRiskMetrics>({
    queryKey: QueryKeys.portfolioRiskMetrics,
    queryFn: () => fetchWithAuth("investments/portfolio/risk-metrics"),
  })
}

export function usePortfolioSummary(accountId?: number) {
  return createQuery<PortfolioSummary>({ // PortfolioSummary is imported from @/types
    queryKey: QueryKeys.portfolioSummary(accountId),
    queryFn: () => {
      const queryParams = new URLSearchParams(
        accountId ? { account_id: String(accountId) } : {}
      )
      return fetchWithAuth(`investments/portfolio/summary?${queryParams}`)
    },
  })
}

export function usePortfolioPerformance(period: string = "1Y") {
  return createQuery<PortfolioPerformance>({ // PortfolioPerformance interface defined above
    queryKey: QueryKeys.portfolioPerformance(period),
    queryFn: () =>
      fetchWithAuth(`investments/portfolio/performance?period=${period}`),
  })
}
// #endregion

// #region Category and Budget Queries/Mutations
export function useCategoriesByType(type: CategoryType) {
  return createQuery<CategoryMetadata[]>({
    queryKey: [...QueryKeys.categories, type],
    queryFn: () => fetchWithAuth(`budgets/categories/${type}`),
  })
}

export function useAllCategories() {
  return createQuery<Record<CategoryType, CategoryMetadata[]>>({
    queryKey: QueryKeys.allCategories,
    queryFn: () => fetchWithAuth("budgets/categories"),
  })
}

export function useCategorySummary(startDate: string, endDate: string) {
  return createQuery<CategorySummaryResponse>({
    queryKey: QueryKeys.categorySummaryByDate(startDate, endDate),
    queryFn: () =>
      fetchWithAuth(
        `budgets/categories/summary?start_date=${startDate}&end_date=${endDate}`
      ),
  })
}

export function usePeriodSummary(
  startDate: string,
  endDate: string,
  period: "week" | "month" | "quarter" | "year"
) {
  return createQuery<PeriodSummaryResponse>({ // PeriodSummaryResponse defined above
    queryKey: QueryKeys.periodSummary(startDate, endDate, period),
    queryFn: () =>
      fetchWithAuth(
        `budgets/summary/period?start_date=${startDate}&end_date=${endDate}&period=${period}`
      ),
  })
}
// Budget CRUD and queries
export function useBudgets(year?: number, month?: number) {
  // const queryClient = useQueryClient() // queryClient not used here, consider removing
  const queryParams = year && month ? `?year=${year}&month=${month}` : ''

  const fetchBudgetsHook = useQuery({ // Renamed to avoid conflict with QueryKeys.budgets
    queryKey: year && month ? QueryKeys.budgetsByYearMonth(year, month) : QueryKeys.budgets,
    queryFn: () => fetchWithAuth<Budget[]>(`budgets/budgets${queryParams}`), // Budget interface defined above
  })

  const crudOperations = createCrudOperations<Budget>({
    endpoint: 'budgets/budgets',
    queryKeysToInvalidate: ['budgets', 'budgetsByYearMonth', 'budgetComparison'], // Added more keys
  })

  return {
    ...fetchBudgetsHook,
    ...crudOperations,
  }
}

export function useBudgetComparison(year: number, month: number) {
  return useQuery({ // Not using createQuery
    queryKey: QueryKeys.budgetComparison(year, month),
    queryFn: () => fetchWithAuth<BudgetComparison[]>(`budgets/budgets/compare?year=${year}&month=${month}`), // BudgetComparison defined above
    enabled: !!year && !!month,
  })
}
// #endregion
// #region Liability Operations and Queries
interface LiabilityFilters {
  id?: number | number[]
  name?: string | string[]
  description?: string | string[]
  liability_type?: string | string[]
  principal_amount?: number | number[]
  interest_rate?: number | number[]
  start_date?: string | string[]
  end_date?: string | string[]
  compounding_period?: string | string[]
  payment_frequency?: string | string[]
  deferral_period_months?: number | number[]
  deferral_type?: string | string[]
  direction?: string | string[]
  account_id?: number | number[]
  lender_name?: string | string[]
}

// interface LiabilityQueryParams extends LiabilityFilters { // Not used, consider removal
//   page?: number
//   per_page?: number
//   sort_by?: keyof Liability
//   sort_order?: "asc" | "desc"
//   search?: string
//   search_fields?: (keyof Liability)[]
// }

interface LiabilityPaymentFilters {
  id?: number | number[]
  liability_id?: number | number[]
  payment_date?: string | string[]
  amount?: number | number[]
  principal_amount?: number | number[]
  interest_amount?: number | number[]
  extra_payment?: number | number[]
  transaction_id?: number | number[]
  status?: string | string[]
}

// interface LiabilityPaymentQueryParams extends LiabilityPaymentFilters { // Not used
//   page?: number
//   per_page?: number
//   sort_by?: keyof LiabilityPayment
//   sort_order?: "asc" | "desc"
//   search?: string
//   search_fields?: (keyof LiabilityPayment)[]
// }

const liabilityOperations = createCrudOperations<Liability>({ // Liability is imported
  endpoint: "liabilities",
  queryKeysToInvalidate: ["liabilities", "liabilityById"], // Added liabilityById
})

export const {
  useBatchDelete: useBatchDeleteLiabilities,
  useDelete: useDeleteLiability,
  useCreate: useCreateLiability,
  useUpdate: useUpdateLiability,
} = liabilityOperations

const liabilityPaymentOperations = createCrudOperations<LiabilityPayment>({ // LiabilityPayment is imported
  endpoint: "liability_payments",
  queryKeysToInvalidate: ["liabilityPayments", "liabilities", "liabilityPaymentsByLiability"], // Added more keys
})

export const {
  useBatchDelete: useBatchDeleteLiabilityPayments,
  useDelete: useDeleteLiabilityPayment,
  useCreate: useCreateLiabilityPayment,
  useUpdate: useUpdateLiabilityPayment,
} = liabilityPaymentOperations

export function useLiabilities(params?: LiabilityFilters) {
  const queryParams = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, formatQueryValue(value)) // Use formatQueryValue
      }
    })
  }
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ''

  return createQuery<PaginatedResponse<Liability>>({
    queryKey: [...QueryKeys.liabilities, params],
    queryFn: () => fetchWithAuth(`liabilities${queryString}`),
  })
}

export function useLiabilityDetails(params?: LiabilityFilters) {
  // Consider deprecating if useLiabilities serves the same purpose
  return useLiabilities(params);
}

export function useLiability(id: number) {
  return createQuery<Liability>({
    queryKey: QueryKeys.liabilityById(id),
    queryFn: () => fetchWithAuth(`liabilities/${id}`),
    enabled: !!id,
  })
}

export function useLiabilityDetail(id: number) {
  // Consider deprecating if useLiability serves the same purpose
  return useLiability(id);
}

export function useLiabilityAmortization(id: number) {
  return createQuery<AmortizationScheduleItem[]>({ // AmortizationScheduleItem is imported
    queryKey: QueryKeys.liabilityAmortization(id),
    queryFn: () => fetchWithAuth(`liabilities/${id}/amortization`),
    enabled: !!id,
  })
}

export function useLiabilityPayments(params?: LiabilityPaymentFilters) {
  const queryParams = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, formatQueryValue(value)) // Use formatQueryValue
      }
    })
  }
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ''

  return createQuery<PaginatedResponse<LiabilityPayment>>({
    queryKey: [...QueryKeys.liabilityPayments, params],
    queryFn: () => fetchWithAuth(`liability_payments${queryString}`),
  })
}

export function useLiabilityPaymentsByLiability(liabilityId: number) {
  return createQuery<{ items: LiabilityPayment[] }>({ // Ensure backend returns { items: ... }
    queryKey: QueryKeys.liabilityPaymentsByLiability(liabilityId),
    queryFn: () => fetchWithAuth(`liability_payments/liability/${liabilityId}`),
    enabled: !!liabilityId,
  })
}

export function useRecordLiabilityPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<LiabilityPayment, "id" | "created_at" | "updated_at">) => // Removed user_id as it's usually set by backend
      fetchWithAuth<LiabilityPayment>("liability_payments/record", {
        method: "POST",
        body: data,
      }),
    onSuccess: (returnedData) => { // Use returnedData to get liability_id
      queryClient.invalidateQueries({ queryKey: QueryKeys.liabilityPayments })
      if (returnedData && returnedData.liability_id) {
        queryClient.invalidateQueries({
          queryKey: QueryKeys.liabilityPaymentsByLiability(returnedData.liability_id)
        })
        queryClient.invalidateQueries({
          queryKey: QueryKeys.liabilityById(returnedData.liability_id)
        })
      }
      queryClient.invalidateQueries({ queryKey: QueryKeys.liabilities })
      // Invalidate related transactions if a payment creates/updates one
      queryClient.invalidateQueries({ queryKey: QueryKeys.transactions})
    },
  })
}
// #endregion


