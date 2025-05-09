import {
    Account,
    ApiResponse,
    Bank,
    Investment,
    PortfolioSummary,
    RefundGroup,
    RefundItem,
    Transaction,
} from "@/types"
import { handleTokenExpiration } from "@/utils/auth"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error("API_URL is not set")
}

// Define query key types
type QueryKeyArray = readonly (string | number | undefined)[]
type QueryKeyFn = (...args: any[]) => QueryKeyArray

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
} as const

// Common interfaces
interface PaginatedResponse<T> {
  items: T[]
  page: number
  per_page: number
  total: number
}

// Transaction-specific paginated response
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

// Add Budget interfaces here
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

// Common fetch configuration
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
    // Handle error responses
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
      // If response is not JSON, just throw a generic error
      throw new Error(
        `Failed to ${options.method || "fetch"} ${endpoint}: ${
          response.statusText
        }`
      )
    }
  }

  // For DELETE operations that return no content (204)
  // or if response body is empty
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

// Helper for invalidating queries with special cases
function invalidateQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  key: keyof typeof QueryKeys
) {
  if (typeof QueryKeys[key] === "function") {
    if (key === "portfolioSummary") {
      queryClient.invalidateQueries({ queryKey: QueryKeys[key]() })
    } else if (key === "portfolioPerformance") {
      queryClient.invalidateQueries({ queryKey: QueryKeys[key]("1Y") })
    }
  } else {
    queryClient.invalidateQueries({ queryKey: QueryKeys[key] })
  }
}

// Factory function for batch delete mutations
function createBatchDeleteMutation<T extends { id?: number }>(
  endpoint: string,
  queryKeysToInvalidate: (keyof typeof QueryKeys)[],
  queryClient: ReturnType<typeof useQueryClient>
) {
  return useMutation({
    mutationFn: async (ids: number[]) => {
      try {
        // Ensure we have a valid array of IDs
        if (!Array.isArray(ids) || ids.length === 0) {
          throw new Error("No items selected for deletion")
        }

        // The backend already returns the specific BatchDeleteResponse format
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
      // Invalidate relevant queries to refresh data
      queryKeysToInvalidate.forEach(key => invalidateQueries(queryClient, key))
    },
    onError: error => {
      console.error(`Batch delete operation failed for ${endpoint}:`, error)
    },
  })
}

// Factory function for batch create mutations
function createBatchCreateMutation<T extends { id?: number }>(
  endpoint: string,
  queryKeysToInvalidate: (keyof typeof QueryKeys)[],
  queryClient: ReturnType<typeof useQueryClient>
) {
  return useMutation({
    mutationFn: async (items: Omit<T, "id">[]) => {
      try {
        // Ensure we have a valid array of items
        if (!Array.isArray(items) || items.length === 0) {
          throw new Error("No items provided for batch creation")
        }

        // Send the batch create request
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
      // Invalidate relevant queries to refresh data
      queryKeysToInvalidate.forEach(key => invalidateQueries(queryClient, key))
    },
    onError: error => {
      console.error(`Batch create operation failed for ${endpoint}:`, error)
    },
  })
}

// Common query configuration
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

// Bank filters interface
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

// Account filters interface
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

// Investment filters interface
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

// RefundGroup filters interface
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

// RefundItem filters interface
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

// Factory for creating basic CRUD operations
interface CrudConfig {
  endpoint: string
  queryKeysToInvalidate: (keyof typeof QueryKeys)[]
}

function createCrudOperations<T extends { id?: number }>(config: CrudConfig) {
  const { endpoint, queryKeysToInvalidate } = config

  // Batch delete mutation
  const useBatchDelete = () => {
    const queryClient = useQueryClient()
    return createBatchDeleteMutation<T>(
      endpoint,
      queryKeysToInvalidate,
      queryClient
    )
  }

  // Single item delete mutation
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

  // Create mutation
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

  // Update mutation
  const useUpdate = () => {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: ({ id, data }: { id: number; data: Partial<T> }) =>
        fetchWithAuth<T>(`${endpoint}/${id}`, { method: "PUT", body: data }),
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

// Example usage of the CRUD factory for transactions
const transactionOperations = createCrudOperations<Transaction>({
  endpoint: "transactions",
  queryKeysToInvalidate: [
    "transactions",
    "accounts",
    "wealthOverTime",
    "recentTransactions",
    "budgetSummary",
    "categories",
  ],
})

export const {
  useBatchDelete: useBatchDeleteTransactions,
  useDelete: useDeleteTransaction,
  useCreate: useCreateTransaction,
  useUpdate: useUpdateTransaction,
} = transactionOperations

// Example usage for accounts
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

// Example usage for banks
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

// Example usage for refund groups
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

// Example usage for refund items
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

// Example usage for investments
const investmentOperations = createCrudOperations<Investment & { id?: number }>(
  {
    endpoint: "investments",
    queryKeysToInvalidate: [
      "investments",
      "accounts",
      "portfolioSummary",
      "portfolioPerformance",
    ],
  }
)

export const {
  useBatchDelete: useBatchDeleteInvestments,
  useDelete: useDeleteInvestment,
  useCreate: useCreateInvestment,
  useUpdate: useUpdateInvestment,
} = investmentOperations

// Example of using the new fetch utility for queries
export function useStockHistory(symbol: string | undefined) {
  return createQuery<StockPrice[]>({
    queryKey: symbol
      ? QueryKeys.stockHistory(symbol)
      : ["stocks", "history", null],
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
      if (!query || query.length < 2) return []
      return fetchWithAuth(`stocks/search?q=${encodeURIComponent(query)}`)
    },
    enabled: query.length >= 2,
  })
}

export function useCustomPrices(symbol: string) {
  return useQuery({
    queryKey: ["customPrices", symbol],
    queryFn: async () => {
      const response = await fetchWithAuth(`stocks/${symbol}/custom-prices`)
      return (response as ApiResponse<any>).data
    },
    enabled: !!symbol,
  })
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

export function useAddCustomPrice() {
  const queryClient = useQueryClient()

  return useMutation<
    AddCustomPriceResponse,
    Error,
    { symbol: string; date: string; price: CustomPriceData }
  >({
    mutationFn: async ({ symbol, date, price }) => {
      const response = await fetchWithAuth(`stocks/${symbol}/custom-prices`, {
        method: "POST",
        body: {
          date,
          ...price,
        },
      })
      return (response as ApiResponse<AddCustomPriceResponse>).data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customPrices", variables.symbol],
      })
    },
  })
}

export function useBatchAddCustomPrices() {
  const queryClient = useQueryClient()

  return useMutation<
    BatchOperationResponse,
    Error,
    {
      symbol: string
      prices: Array<{
        date: string
        price: CustomPriceData
      }>
    }
  >({
    mutationFn: async ({ symbol, prices }) => {
      // No need to reformat prices since they're already in the right format
      const response = await fetchWithAuth(`stocks/${symbol}/custom-prices`, {
        method: "POST",
        body: prices,
      })
      return (response as ApiResponse<BatchOperationResponse>).data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customPrices", variables.symbol],
      })
    },
  })
}

interface DeleteCustomPriceResponse {
  message: string
}

export function useDeleteCustomPrice() {
  const queryClient = useQueryClient()

  return useMutation<
    DeleteCustomPriceResponse,
    Error,
    { symbol: string; date: string }
  >({
    mutationFn: async ({ symbol, date }) => {
      const response = await fetchWithAuth(
        `stocks/${symbol}/custom-prices/${date}`,
        {
          method: "DELETE",
        }
      )
      return (response as ApiResponse<DeleteCustomPriceResponse>).data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customPrices", variables.symbol],
      })
    },
  })
}

export function useBatchDeleteCustomPrices() {
  const queryClient = useQueryClient()

  return useMutation<
    BatchOperationResponse,
    Error,
    { symbol: string; dates: string[] }
  >({
    mutationFn: async ({ symbol, dates }) => {
      const response = await fetchWithAuth(
        `stocks/${symbol}/custom-prices/batch`,
        {
          method: "DELETE",
          body: dates,
        }
      )
      return (response as ApiResponse<BatchOperationResponse>).data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["customPrices", variables.symbol],
      })
    },
  })
}

export function usePortfolioRiskMetrics() {
  return createQuery<PortfolioRiskMetrics>({
    queryKey: QueryKeys.portfolioRiskMetrics,
    queryFn: () => fetchWithAuth("investments/portfolio/risk-metrics"),
  })
}

// Common interfaces
interface StockPrice {
  close: number
  date: string
  high: number
  low: number
  open: number
  value: number
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

// Using the PortfolioSummary interface from types.ts

export function usePortfolioSummary(accountId?: number) {
  return createQuery<PortfolioSummary>({
    queryKey: QueryKeys.portfolioSummary(accountId),
    queryFn: () => {
      const queryParams = new URLSearchParams(
        accountId ? { account_id: String(accountId) } : {}
      )
      return fetchWithAuth(`investments/portfolio/summary?${queryParams}`)
    },
  })
}

// Factory function for paginated queries
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
>(endpoint: string, queryKey: (params: P) => unknown[]) {
  return (params: P = {} as P) => {
    return createQuery<R>({
      queryKey: queryKey(params),
      queryFn: () => {
        const queryParams = new URLSearchParams()

        // Add pagination and sorting
        if (params.page) queryParams.append("page", params.page.toString())
        if (params.per_page)
          queryParams.append("per_page", params.per_page.toString())
        if (params.sort_by) queryParams.append("sort_by", params.sort_by)
        if (params.sort_order)
          queryParams.append("sort_order", params.sort_order)
        if (params.search) queryParams.append("search", params.search)
        if (params.search_fields)
          queryParams.append("search_fields", params.search_fields.join(","))

        // Add all filter parameters
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

// Simplified query hooks using the factory
export const useBanks = createPaginatedQuery<Bank, BankQueryParams>(
  "banks",
  params => [...QueryKeys.banks, params]
)

export const useAccounts = createPaginatedQuery<Account, AccountQueryParams>(
  "accounts",
  params => [...QueryKeys.accounts, params]
)

export const useAssets = createPaginatedQuery<Asset, AssetQueryParams>(
  "assets",
  params => [...QueryKeys.assets, params]
)

export const useRefundGroups = createPaginatedQuery<
  RefundGroup,
  RefundGroupQueryParams
>("refund_groups", params => [...QueryKeys.refundGroups, params])

export const useRefundItems = createPaginatedQuery<
  RefundItem,
  RefundItemQueryParams
>("refund_items", params => [...QueryKeys.refundItems, params])

export const useInvestments = createPaginatedQuery<
  Investment,
  InvestmentQueryParams
>("investments", params => [...QueryKeys.investments, params])

// Helper function for formatting query values
function formatQueryValue(
  value: string | number | boolean | string[] | number[] | boolean[]
): string {
  if (Array.isArray(value)) {
    return value.join(",")
  }
  return value.toString()
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

// Categories by type hook
export function useCategoriesByType(type: CategoryType) {
  return createQuery<CategoryMetadata[]>({
    queryKey: [...QueryKeys.categories, type],
    queryFn: () => fetchWithAuth(`budgets/categories/${type}`),
  })
}

// All categories hook
export function useAllCategories() {
  return createQuery<Record<CategoryType, CategoryMetadata[]>>({
    queryKey: QueryKeys.allCategories,
    queryFn: () => fetchWithAuth("budgets/categories"),
  })
}

interface BalanceHistoryPoint {
  date: string
  value: number
}

interface BalanceHistoryResponse {
  [date: string]: number
}

// Account balance history hook
export function useAccountBalanceHistory(accountId: number) {
  return createQuery<BalanceHistoryPoint[]>({
    queryKey: [...QueryKeys.accountById(accountId), "balance_history"],
    queryFn: () => {
      const endDate = new Date().toISOString().split("T")[0]
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 500)
      const startDateStr = startDate.toISOString().split("T")[0]

      return fetchWithAuth<BalanceHistoryResponse>(
        `accounts/${accountId}/balance_over_time?start_date=${startDateStr}&end_date=${endDate}`
      ).then(data =>
        // Transform the data into the format our chart expects
        Object.entries(data).map(([date, value]) => ({
          date,
          value,
        }))
      )
    },
  })
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

// Simplified query hooks using the factory
export const useTransactions = createPaginatedQuery<
  Transaction,
  TransactionQueryParams,
  TransactionPaginatedResponse
>("transactions", params => [...QueryKeys.transactions, params])

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

interface CategorySummary {
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

// Category summary hook
export function useCategorySummary(startDate: string, endDate: string) {
  return createQuery<CategorySummaryResponse>({
    queryKey: QueryKeys.categorySummaryByDate(startDate, endDate),
    queryFn: () =>
      fetchWithAuth(
        `budgets/categories/summary?start_date=${startDate}&end_date=${endDate}`
      ),
  })
}

// Wealth over time hook
export function useWealthOverTime() {
  return createQuery<BalanceHistoryPoint[]>({
    queryKey: QueryKeys.wealthOverTime,
    queryFn: () => {
      const endDate = new Date().toISOString().split("T")[0]
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 500)
      const startDateStr = startDate.toISOString().split("T")[0]

      return fetchWithAuth<BalanceHistoryResponse>(
        `accounts/balance_over_time?start_date=${startDateStr}&end_date=${endDate}`
      ).then(data =>
        // Transform the data into the format our chart expects
        Object.entries(data).map(([date, value]) => ({
          date,
          value,
        }))
      )
    },
  })
}

// Asset types and queries
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
    by_category: Record<string, CategorySummary>
  }
  expense: {
    total: number
    by_category: Record<string, CategorySummary>
  }
}

interface PeriodSummaryResponse {
  period: string
  summaries: PeriodSummaryData[]
}

// Period summary hook
export function usePeriodSummary(
  startDate: string,
  endDate: string,
  period: "week" | "month" | "quarter" | "year"
) {
  return createQuery<PeriodSummaryResponse>({
    queryKey: QueryKeys.periodSummary(startDate, endDate, period),
    queryFn: () =>
      fetchWithAuth(
        `budgets/summary/period?start_date=${startDate}&end_date=${endDate}&period=${period}`
      ),
  })
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

export function usePortfolioPerformance(period: string = "1Y") {
  return createQuery<PortfolioPerformance>({
    queryKey: QueryKeys.portfolioPerformance(period),
    queryFn: () =>
      fetchWithAuth(`investments/portfolio/performance?period=${period}`),
  })
}

// Export batch create operations for different entity types
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
      "categories"
    ],
    queryClient
  )
}

export function useBatchCreateAccounts() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<Account>(
    "accounts",
    ["accounts", "wealthOverTime"],
    queryClient
  )
}

export function useBatchCreateBanks() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<Bank>(
    "banks",
    ["banks", "accounts", "wealthOverTime"],
    queryClient
  )
}

export function useBatchCreateInvestments() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<Investment & { id?: number }>(
    "investments",
    ["investments", "accounts", "portfolioSummary", "portfolioPerformance"],
    queryClient
  )
}

export function useBatchCreateAssets() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<Asset>(
    "assets",
    ["assets"],
    queryClient
  )
}

export function useCreateAsset() {
  const queryClient = useQueryClient()
  return useMutation<Asset, Error, { symbol: string; name: string }>({
    mutationFn: (data) => fetchWithAuth("assets", { method: "POST", body: data }),
    onSuccess: () => {
      // Invalidate all related queries to ensure UI is updated
      invalidateQueries(queryClient, "assets")
      invalidateQueries(queryClient, "investments")
      // Force a complete refetch of the assets query
      queryClient.refetchQueries({ queryKey: QueryKeys.assets })
    },
  })
}

export function useBatchCreateRefundGroups() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<RefundGroup>(
    "refund_groups",
    ["refundGroups", "refundItems", "transactions"],
    queryClient
  )
}

export function useBatchCreateRefundItems() {
  const queryClient = useQueryClient()
  return createBatchCreateMutation<RefundItem>(
    "refund_items",
    ["refundItems", "transactions"],
    queryClient
  )
}

// Budget queries
export function useBudgets(year?: number, month?: number) {
  const queryClient = useQueryClient()
  const queryParams = year && month ? `?year=${year}&month=${month}` : ''

  const fetchBudgets = useQuery({
    queryKey: year && month ? QueryKeys.budgetsByYearMonth(year, month) : QueryKeys.budgets,
    queryFn: () => fetchWithAuth<Budget[]>(`budgets/budgets${queryParams}`),
  })

  const crudOperations = createCrudOperations<Budget>({
    endpoint: 'budgets/budgets',
    queryKeysToInvalidate: ['budgets'],
  })

  return {
    ...fetchBudgets,
    ...crudOperations,
  }
}

export function useBudgetComparison(year: number, month: number) {
  return useQuery({
    queryKey: QueryKeys.budgetComparison(year, month),
    queryFn: () => fetchWithAuth<BudgetComparison[]>(`budgets/budgets/compare?year=${year}&month=${month}`),
    enabled: !!year && !!month,
  })
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
    by_category: Record<string, CategorySummary>
  }
  expense: {
    total: number
    by_category: Record<string, CategorySummary>
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
