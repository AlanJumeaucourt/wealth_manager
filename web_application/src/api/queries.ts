import {
  Account,
  AccountCreateBody,
  AccountQueryParams,
  AddCustomPriceResponse,
  AmortizationScheduleItem,
  Asset,
  AssetQueryParams,
  BalanceHistoryPoint,
  BalanceHistoryResponse,
  Bank,
  BankCreateBody,
  BankQueryParams,
  Budget,
  BudgetComparison,
  CategoryMetadata,
  CategorySummaryResponse,
  CategoryType,
  CustomPriceData,
  DeleteCustomPriceResponse,
  Investment,
  InvestmentDetail,
  InvestmentQueryParams,
  Liability,
  LiabilityFilters,
  LiabilityPayment,
  LiabilityPaymentFilters,
  PaginatedResponse,
  PeriodSummaryResponse,
  normalizePotentialRefundItem,
  PortfolioPerformance,
  PortfolioRiskMetrics,
  PortfolioSummary,
  RefundGroup,
  RefundGroupQueryParams,
  RefundItem,
  RefundItemQueryParams,
  StockPrice,
  StockSearchResult,
  Transaction,
  TransactionPaginatedResponse,
  TransactionQueryParams,
} from "@/types";
import type { PotentialRefundsListResponse } from "@/api/edenDerivedTypes";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type BatchOperationResponse,
  buildListQueryParams,
  useBatchCreateMutation,
  createCrudOperations,
  createPaginatedQuery,
  useCreateQuery,
  DEFAULT_STALE_TIME,
  fetchWithAuth,
  invalidateQueries,
} from "./apiUtils";
import { unwrapEden } from "./edenUnwrap";
import { QueryKeys } from "./queryKeys";
import { wealthApi } from "./wealthApi";
export { API_URL } from "./queryKeys";

// #region Bank Operations and Queries

const bankOperations = createCrudOperations<Bank, BankCreateBody>({
  resource: "banks",
  queryKeysToInvalidate: ["banks", "accounts", "wealthOverTime"],
});

export const {
  useBatchDelete: useBatchDeleteBanks,
  useDelete: useDeleteBank,
  useCreate: useCreateBank,
  useUpdate: useUpdateBank,
} = bankOperations;

export function useBatchCreateBanks() {
  const queryClient = useQueryClient();
  return useBatchCreateMutation<Bank, BankCreateBody>(
    "banks",
    ["banks", "accounts", "wealthOverTime"],
    queryClient,
  );
}

export const useBanks = createPaginatedQuery<Bank, BankQueryParams>(
  (params) =>
    unwrapEden(
      wealthApi.banks.get({
        query: buildListQueryParams(params as Record<string, unknown>) as never,
      }),
    ) as unknown as Promise<PaginatedResponse<Bank>>,
  (params) => [...QueryKeys.banks, params],
);
// #endregion

// #region Account Operations and Queries
const accountOperations = createCrudOperations<Account, AccountCreateBody>({
  resource: "accounts",
  queryKeysToInvalidate: ["accounts", "wealthOverTime"],
});

export const {
  useBatchDelete: useBatchDeleteAccounts,
  useDelete: useDeleteAccount,
  useCreate: useCreateAccount,
  useUpdate: useUpdateAccount,
} = accountOperations;

export function useBatchCreateAccounts() {
  const queryClient = useQueryClient();
  return useBatchCreateMutation<Account, AccountCreateBody>(
    "accounts",
    ["accounts", "wealthOverTime"],
    queryClient,
  );
}

export const useAccounts = createPaginatedQuery<Account, AccountQueryParams>(
  (params) =>
    unwrapEden(
      wealthApi.accounts.get({
        query: buildListQueryParams(params as Record<string, unknown>) as never,
      }),
    ) as unknown as Promise<PaginatedResponse<Account>>,
  (params) => [...QueryKeys.accounts, params],
);

export function useAccountBalanceHistory(accountId: number) {
  return useCreateQuery<BalanceHistoryPoint[]>({
    queryKey: [...QueryKeys.accountById(accountId), "balance_history"],
    queryFn: async () => {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 500);
      const startDateStr = startDate.toISOString().split("T")[0];

      const data = (await unwrapEden(
        wealthApi.accounts({ id: String(accountId) }).balance_over_time.get({
          query: { start_date: startDateStr, end_date: endDate },
        }),
      )) as BalanceHistoryResponse;

      return Object.entries(data).map(([date, rawValue]) => {
        if (typeof rawValue === "number") {
          return {
            date,
            value: rawValue,
            balance: rawValue,
            investment_gain: 0,
          };
        }
        return {
          date,
          value: rawValue.balance,
          balance: rawValue.balance,
          balance_by_currency: rawValue.balance_by_currency,
          investment_gain: rawValue.investment_gain,
        };
      });
    },
    enabled: !!accountId,
  });
}

export function useWealthOverTime() {
  return useCreateQuery<BalanceHistoryPoint[]>({
    queryKey: QueryKeys.wealthOverTime,
    queryFn: async () => {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 500);
      const startDateStr = startDate.toISOString().split("T")[0];

      const data = (await unwrapEden(
        wealthApi.accounts.balance_over_time.get({
          query: { start_date: startDateStr, end_date: endDate },
        }),
      )) as BalanceHistoryResponse;

      return Object.entries(data).map(([date, value]) => ({
        date,
        value: value.balance,
        balance: value.balance,
        balance_by_currency: value.balance_by_currency,
        investment_gain: value.investment_gain,
      }));
    },
  });
}

export function useWealthOverTimeWithGains(options?: { includeDebt?: boolean }) {
  const includeDebt = options?.includeDebt ?? true;
  return useQuery<BalanceHistoryResponse>({
    queryKey: [...QueryKeys.wealthOverTime, "withGains", includeDebt],
    placeholderData: keepPreviousData,
    staleTime: DEFAULT_STALE_TIME,
    queryFn: async () => {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 500);
      const startDateStr = startDate.toISOString().split("T")[0];

      return unwrapEden(
        wealthApi.accounts.balance_over_time.get({
          query: {
            start_date: startDateStr,
            end_date: endDate,
            include_debt: includeDebt ? "true" : "false",
          },
        }),
      ) as Promise<BalanceHistoryResponse>;
    },
  });
}
// #endregion

// #region Transaction Operations and Queries
const transactionOperations = createCrudOperations<Transaction>({
  resource: "transactions",
  queryKeysToInvalidate: [
    "transactions",
    "accounts",
    "wealthOverTime",
    "recentTransactions",
    "budgetSummary",
    "categories",
  ],
});

export const {
  useBatchDelete: useBatchDeleteTransactions,
  useDelete: useDeleteTransaction,
  useCreate: useCreateTransaction,
  useUpdate: useUpdateTransaction,
} = transactionOperations;

export function useBatchCreateTransactions() {
  const queryClient = useQueryClient();
  return useBatchCreateMutation<Transaction>(
    "transactions",
    [
      "transactions",
      "accounts",
      "wealthOverTime",
      "recentTransactions",
      "budgetSummary",
      "categories",
    ],
    queryClient,
  );
}

export const useTransactions = createPaginatedQuery<
  Transaction,
  TransactionQueryParams,
  TransactionPaginatedResponse
>(
  (params) =>
    unwrapEden(
      wealthApi.transactions.get({
        query: buildListQueryParams(params as Record<string, unknown>) as never,
      }),
    ) as unknown as Promise<TransactionPaginatedResponse>,
  (params) => [...QueryKeys.transactions, params],
);
// #endregion

// #region Investment Operations and Queries
const investmentOperations = createCrudOperations<Investment & { id?: number }>({
  resource: "investments",
  queryKeysToInvalidate: ["investments", "accounts", "portfolioSummary", "portfolioPerformance"],
});

export const {
  useBatchDelete: useBatchDeleteInvestments,
  useDelete: useDeleteInvestment,
  useCreate: useCreateInvestment,
  useUpdate: useUpdateInvestment,
} = investmentOperations;

export function useBatchCreateInvestments() {
  const queryClient = useQueryClient();
  return useBatchCreateMutation<Investment & { id?: number }>(
    "investments",
    ["investments", "accounts", "portfolioSummary", "portfolioPerformance"],
    queryClient,
  );
}

export const useInvestments = createPaginatedQuery<Investment, InvestmentQueryParams>(
  (params) =>
    unwrapEden(
      wealthApi.investments.get({
        query: buildListQueryParams(params as Record<string, unknown>) as never,
      }),
    ) as unknown as Promise<PaginatedResponse<Investment>>,
  (params) => [...QueryKeys.investments, params],
);
// #endregion

// #region RefundGroup Operations and Queries
const refundGroupOperations = createCrudOperations<RefundGroup>({
  resource: "refund_groups",
  queryKeysToInvalidate: ["refundGroups", "refundItems", "transactions", "potentialRefunds"],
});

export const {
  useBatchDelete: useBatchDeleteRefundGroups,
  useDelete: useDeleteRefundGroup,
  useCreate: useCreateRefundGroup,
  useUpdate: useUpdateRefundGroup,
} = refundGroupOperations;

export function useBatchCreateRefundGroups() {
  const queryClient = useQueryClient();
  return useBatchCreateMutation<RefundGroup>(
    "refund_groups",
    ["refundGroups", "refundItems", "transactions", "potentialRefunds"],
    queryClient,
  );
}

export const useRefundGroups = createPaginatedQuery<RefundGroup, RefundGroupQueryParams>(
  (params) =>
    unwrapEden(
      wealthApi.refund_groups.get({
        query: buildListQueryParams(params as Record<string, unknown>) as never,
      }),
    ) as unknown as Promise<PaginatedResponse<RefundGroup>>,
  (params) => [...QueryKeys.refundGroups, params],
);
// #endregion

// #region RefundItem Operations and Queries
const refundItemOperations = createCrudOperations<RefundItem>({
  resource: "refund_items",
  queryKeysToInvalidate: ["refundItems", "transactions", "potentialRefunds"],
});

export const {
  useBatchDelete: useBatchDeleteRefundItems,
  useDelete: useDeleteRefundItem,
  useCreate: useCreateRefundItem,
  useUpdate: useUpdateRefundItem,
} = refundItemOperations;

export function useBatchCreateRefundItems() {
  const queryClient = useQueryClient();
  return useBatchCreateMutation<RefundItem>(
    "refund_items",
    ["refundItems", "transactions", "potentialRefunds"],
    queryClient,
  );
}

export const useRefundItems = createPaginatedQuery<RefundItem, RefundItemQueryParams>(
  (params) =>
    unwrapEden(
      wealthApi.refund_items.get({
        query: buildListQueryParams(params as Record<string, unknown>) as never,
      }),
    ) as unknown as Promise<PaginatedResponse<RefundItem>>,
  (params) => [...QueryKeys.refundItems, params],
);

export function usePotentialRefunds(options?: { limit?: number }) {
  const limit = options?.limit ?? 100;
  return useQuery({
    queryKey: [...QueryKeys.potentialRefunds, limit] as const,
    staleTime: DEFAULT_STALE_TIME,
    queryFn: async () => {
      const data = (await unwrapEden(
        wealthApi.potential_refunds.get({
          query: { limit } as never,
        }),
      )) as PotentialRefundsListResponse;
      return data.items.map(normalizePotentialRefundItem);
    },
  });
}

export function useDismissPotentialRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (incomeTransactionId: number) => {
      await unwrapEden(
        wealthApi.potential_refunds.dismiss.post({
          body: { income_transaction_id: incomeTransactionId } as never,
        }),
      );
    },
    onSuccess: () => {
      invalidateQueries(queryClient, "potentialRefunds");
    },
  });
}
// #endregion

// #region Asset Operations and Queries
export const useAssets = createPaginatedQuery<Asset, AssetQueryParams>(
  (params) =>
    unwrapEden(
      wealthApi.assets.get({
        query: buildListQueryParams(params as Record<string, unknown>) as never,
      }),
    ) as unknown as Promise<PaginatedResponse<Asset>>,
  (params) => [...QueryKeys.assets, params],
);

export function useBatchCreateAssets() {
  const queryClient = useQueryClient();
  return useBatchCreateMutation<Asset>("assets", ["assets"], queryClient);
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation<Asset, Error, { symbol: string; name: string; type: string }>({
    mutationFn: (data) =>
      unwrapEden(
        wealthApi.assets.post({ body: data as never } as never),
      ) as unknown as Promise<Asset>,
    onSuccess: () => {
      invalidateQueries(queryClient, "assets");
      invalidateQueries(queryClient, "investments");
      void queryClient.refetchQueries({ queryKey: QueryKeys.assets });
    },
  });
}
// #endregion

// #region Stock and Custom Price Queries/Mutations
export function useStockHistory(symbol: string | undefined) {
  return useCreateQuery<StockPrice[]>({
    queryKey: symbol ? QueryKeys.stockHistory(symbol) : ["stocks", "history", null],
    queryFn: async () => {
      if (!symbol) return [];
      return unwrapEden(
        wealthApi.stocks({ symbol }).history.get({ query: { period: "max" } }),
      ) as Promise<StockPrice[]>;
    },
    enabled: !!symbol,
  });
}

export function useStockSearch(query: string) {
  return useCreateQuery<StockSearchResult[]>({
    queryKey: QueryKeys.stockSearch(query),
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      return unwrapEden(wealthApi.stocks.search.get({ query: { q: query } })) as Promise<
        StockSearchResult[]
      >;
    },
    enabled: query.length >= 2,
  });
}

/** Custom price HTTP routes are not yet on the typed Eden `App`; uses `fetchWithAuth` (authFetch). */
export function useCustomPrices(symbol: string) {
  return useQuery({
    queryKey: QueryKeys.customPrices(symbol),
    queryFn: async () => {
      return fetchWithAuth(`stocks/${symbol}/custom-prices`);
    },
    enabled: !!symbol,
  });
}

export function useAddCustomPrice() {
  const queryClient = useQueryClient();
  return useMutation<
    AddCustomPriceResponse,
    Error,
    { symbol: string; date: string; price: CustomPriceData }
  >({
    mutationFn: async ({ symbol, date, price }) => {
      return fetchWithAuth(`stocks/${symbol}/custom-prices`, {
        method: "POST",
        body: { date, ...price },
      });
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: QueryKeys.customPrices(variables.symbol),
      });
    },
  });
}

export function useBatchAddCustomPrices() {
  const queryClient = useQueryClient();
  return useMutation<
    BatchOperationResponse,
    Error,
    {
      symbol: string;
      prices: Array<{ date: string; price: CustomPriceData }>;
    }
  >({
    mutationFn: async ({ symbol, prices }) => {
      const formattedPrices = prices.map((p) => ({ date: p.date, ...p.price }));
      return fetchWithAuth(`stocks/${symbol}/custom-prices/batch`, {
        method: "POST",
        body: { prices: formattedPrices },
      });
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: QueryKeys.customPrices(variables.symbol),
      });
    },
  });
}

export function useDeleteCustomPrice() {
  const queryClient = useQueryClient();
  return useMutation<DeleteCustomPriceResponse, Error, { symbol: string; date: string }>({
    mutationFn: async ({ symbol, date }) => {
      return fetchWithAuth(`stocks/${symbol}/custom-prices/${date}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: QueryKeys.customPrices(variables.symbol),
      });
    },
  });
}

export function useBatchDeleteCustomPrices() {
  const queryClient = useQueryClient();
  return useMutation<BatchOperationResponse, Error, { symbol: string; dates: string[] }>({
    mutationFn: async ({ symbol, dates }) => {
      return fetchWithAuth(`stocks/${symbol}/custom-prices/batch/delete`, {
        method: "POST",
        body: { dates },
      });
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: QueryKeys.customPrices(variables.symbol),
      });
    },
  });
}
// #endregion

// #region Portfolio Queries
export function usePortfolioRiskMetrics() {
  return useCreateQuery<PortfolioRiskMetrics>({
    queryKey: QueryKeys.portfolioRiskMetrics,
    queryFn: () =>
      unwrapEden(
        wealthApi.investments.portfolio["risk-metrics"].get(),
      ) as unknown as Promise<PortfolioRiskMetrics>,
  });
}

export function usePortfolioSummary(accountId?: number) {
  return useCreateQuery<PortfolioSummary>({
    queryKey: QueryKeys.portfolioSummary(accountId),
    queryFn: () =>
      unwrapEden(
        wealthApi.investments.portfolio.summary.get({
          query: accountId != null ? { account_id: String(accountId) } : ({} as never),
        }),
      ) as unknown as Promise<PortfolioSummary>,
  });
}

export function usePortfolioPerformance(period: string = "1Y") {
  return useCreateQuery<PortfolioPerformance>({
    queryKey: QueryKeys.portfolioPerformance(period),
    queryFn: () =>
      unwrapEden(
        wealthApi.investments.portfolio.performance.get({
          query: { period },
        }),
      ) as unknown as Promise<PortfolioPerformance>,
  });
}
// #endregion

export function useInvestmentDetail(investmentId: number | undefined) {
  return useCreateQuery<InvestmentDetail>({
    queryKey: investmentId
      ? QueryKeys.investmentById(investmentId)
      : ["investments", "detail", null],
    queryFn: () =>
      unwrapEden(
        wealthApi.investments({ id: String(investmentId) }).get(),
      ) as unknown as Promise<InvestmentDetail>,
    enabled: !!investmentId,
  });
}

// #region Category and Budget Queries/Mutations
export function useCategoriesByType(type: CategoryType) {
  return useCreateQuery<CategoryMetadata[]>({
    queryKey: [...QueryKeys.categories, type],
    queryFn: () =>
      unwrapEden(wealthApi.budgets.categories({ category_type: type }).get()) as unknown as Promise<
        CategoryMetadata[]
      >,
  });
}

export function useAllCategories() {
  return useCreateQuery<Record<CategoryType, CategoryMetadata[]>>({
    queryKey: QueryKeys.allCategories,
    queryFn: () =>
      unwrapEden(wealthApi.budgets.categories.get()) as unknown as Promise<
        Record<CategoryType, CategoryMetadata[]>
      >,
  });
}

export function useCategorySummary(startDate: string, endDate: string) {
  return useCreateQuery<CategorySummaryResponse>({
    queryKey: QueryKeys.categorySummaryByDate(startDate, endDate),
    queryFn: () =>
      unwrapEden(
        wealthApi.budgets.categories.summary.get({
          query: { start_date: startDate, end_date: endDate },
        }),
      ) as unknown as Promise<CategorySummaryResponse>,
  });
}

export function usePeriodSummary(
  startDate: string,
  endDate: string,
  period: "week" | "month" | "quarter" | "year",
) {
  return useCreateQuery<PeriodSummaryResponse>({
    queryKey: QueryKeys.periodSummary(startDate, endDate, period),
    queryFn: () =>
      unwrapEden(
        wealthApi.budgets.summary.period.get({
          query: { start_date: startDate, end_date: endDate, period },
        }),
      ) as unknown as Promise<PeriodSummaryResponse>,
  });
}

export function useBudgets(year?: number, month?: number) {
  const fetchBudgetsHook = useQuery({
    queryKey: year && month ? QueryKeys.budgetsByYearMonth(year, month) : QueryKeys.budgets,
    queryFn: async () => {
      const q: Record<string, string | number | undefined> = {};
      if (year != null && month != null) {
        q.year = year;
        q.month = month;
      }
      return unwrapEden(wealthApi.budgets.budgets.get({ query: q as never })) as unknown as Promise<
        Budget[]
      >;
    },
  });

  const crudOperations = createCrudOperations<Budget>({
    resource: "budgets_budgets",
    queryKeysToInvalidate: ["budgets", "budgetsByYearMonth", "budgetComparison"],
  });

  return {
    ...fetchBudgetsHook,
    ...crudOperations,
  };
}

export function useBudgetComparison(year: number, month: number) {
  return useQuery({
    queryKey: QueryKeys.budgetComparison(year, month),
    queryFn: () =>
      unwrapEden(
        wealthApi.budgets.budgets.compare.get({
          query: { year: String(year), month: String(month) },
        }),
      ) as unknown as Promise<BudgetComparison[]>,
    enabled: !!year && !!month,
  });
}
// #endregion

// #region Liability Operations and Queries
const liabilityOperations = createCrudOperations<Liability>({
  resource: "liabilities",
  queryKeysToInvalidate: ["liabilities", "liabilityById"],
});

export const {
  useBatchDelete: useBatchDeleteLiabilities,
  useDelete: useDeleteLiability,
  useCreate: useCreateLiability,
  useUpdate: useUpdateLiability,
} = liabilityOperations;

const liabilityPaymentOperations = createCrudOperations<LiabilityPayment>({
  resource: "liability_payments",
  queryKeysToInvalidate: ["liabilityPayments", "liabilities", "liabilityPaymentsByLiability"],
});

export const {
  useBatchDelete: useBatchDeleteLiabilityPayments,
  useDelete: useDeleteLiabilityPayment,
  useCreate: useCreateLiabilityPayment,
  useUpdate: useUpdateLiabilityPayment,
} = liabilityPaymentOperations;

export function useLiabilities(params?: LiabilityFilters, options?: { enabled?: boolean }) {
  const q = params ? buildListQueryParams(params as Record<string, unknown>) : {};
  return useCreateQuery<PaginatedResponse<Liability>>({
    queryKey: [...QueryKeys.liabilities, params],
    queryFn: () =>
      unwrapEden(wealthApi.liabilities.get({ query: q as never })) as unknown as Promise<
        PaginatedResponse<Liability>
      >,
    enabled: options?.enabled ?? true,
  });
}

export function useLiabilityDetails(params?: LiabilityFilters, options?: { enabled?: boolean }) {
  return useLiabilities(params, options);
}

export function useLiability(id: number) {
  return useCreateQuery<Liability>({
    queryKey: QueryKeys.liabilityById(id),
    queryFn: () =>
      unwrapEden(wealthApi.liabilities({ id: String(id) }).get()) as unknown as Promise<Liability>,
    enabled: !!id,
  });
}

export function useLiabilityDetail(id: number) {
  return useLiability(id);
}

export function useLiabilityAmortization(id: number) {
  return useCreateQuery<AmortizationScheduleItem[]>({
    queryKey: QueryKeys.liabilityAmortization(id),
    queryFn: () =>
      unwrapEden(
        wealthApi.liabilities({ id: String(id) }).amortization.get(),
      ) as unknown as Promise<AmortizationScheduleItem[]>,
    enabled: !!id,
  });
}

export function useLiabilityPayments(params?: LiabilityPaymentFilters) {
  const q = params ? buildListQueryParams(params as Record<string, unknown>) : {};
  return useCreateQuery<PaginatedResponse<LiabilityPayment>>({
    queryKey: [...QueryKeys.liabilityPayments, params],
    queryFn: () =>
      unwrapEden(wealthApi.liability_payments.get({ query: q as never })) as unknown as Promise<
        PaginatedResponse<LiabilityPayment>
      >,
  });
}

export function useLiabilityPaymentsByLiability(liabilityId: number) {
  return useCreateQuery<{ items: LiabilityPayment[] }>({
    queryKey: QueryKeys.liabilityPaymentsByLiability(liabilityId),
    queryFn: () =>
      unwrapEden(
        wealthApi.liability_payments.liability({ liability_id: String(liabilityId) }).get(),
      ) as unknown as Promise<{ items: LiabilityPayment[] }>,
    enabled: !!liabilityId,
  });
}

export function useRecordLiabilityPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<LiabilityPayment, "id" | "created_at" | "updated_at">) =>
      unwrapEden(
        wealthApi.liability_payments.record.post({ body: data as never } as never),
      ) as unknown as Promise<LiabilityPayment>,
    onSuccess: (returnedData) => {
      void queryClient.invalidateQueries({ queryKey: QueryKeys.liabilityPayments });
      if (returnedData && returnedData.liability_id) {
        void queryClient.invalidateQueries({
          queryKey: QueryKeys.liabilityPaymentsByLiability(returnedData.liability_id),
        });
        void queryClient.invalidateQueries({
          queryKey: QueryKeys.liabilityById(returnedData.liability_id),
        });
      }
      void queryClient.invalidateQueries({ queryKey: QueryKeys.liabilities });
      void queryClient.invalidateQueries({ queryKey: QueryKeys.transactions });
    },
  });
}

export function useUpdatePreferredCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferred_currency: string) =>
      unwrapEden(
        wealthApi.users.preferred_currency.put({
          body: { preferred_currency: preferred_currency.toUpperCase() } as never,
        } as never),
      ) as unknown as Promise<{ preferred_currency: string }>,
    onSuccess: (_, preferred_currency) => {
      void queryClient.invalidateQueries({ queryKey: QueryKeys.user });
      void queryClient.invalidateQueries({ queryKey: QueryKeys.accounts });
      void queryClient.invalidateQueries({ queryKey: QueryKeys.wealthOverTime });
      void queryClient.invalidateQueries({ queryKey: QueryKeys.transactions });
      void queryClient.invalidateQueries({ queryKey: QueryKeys.budgetSummary });
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          user.preferred_currency = preferred_currency;
          localStorage.setItem("user", JSON.stringify(user));
        } catch {
          // ignore
        }
      }
    },
  });
}
// #endregion
