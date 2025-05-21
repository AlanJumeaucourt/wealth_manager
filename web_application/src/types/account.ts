import { useQueryClient } from "@tanstack/react-query";
import {
    createBatchCreateMutation,
    createCrudOperations,
    createPaginatedQuery,
    createQuery,
    fetchWithAuth
} from "../api/apiUtils";
import { QueryKeys } from "../api/queryKeys";
import type { PaginatedResponse } from "../types";

// Type Definition (Moved from types.ts)
export interface Account {
  id: number
  name: string
  type: "checking" | "expense" | "income" | "investment" | "savings" | "loan"
  balance: number
  bank_id: number
  market_value: number
}

// Balance History Types (Moved from queries.ts as they are closely related here)
export interface BalanceHistoryPoint {
  date: string
  value: number
}

export interface BalanceHistoryResponse {
  [date: string]: number
}

// Filters and Query Params (Moved from queries.ts)
export interface AccountFilters { // Added export
  id?: number | number[]
  name?: string | string[]
  type?: string | string[]
  balance?: number | number[]
  bank_id?: number | number[]
  user_id?: number | number[] // Assuming user_id might be part of Account type or filters
}

export interface AccountQueryParams extends AccountFilters { // Added export
  page?: number
  per_page?: number
  sort_by?: Extract<keyof Account, string>
  sort_order?: "asc" | "desc"
  search?: string
  search_fields?: Extract<keyof Account, string>[]
}

// Operations and Hooks (Moved from queries.ts)
const accountOperations = createCrudOperations<Account>({
  endpoint: "accounts",
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
  return createBatchCreateMutation<Account>(
    "accounts",
    ["accounts", "wealthOverTime"],
    queryClient
  );
}

export const useAccounts = createPaginatedQuery<Account, AccountQueryParams, PaginatedResponse<Account>>(
  "accounts",
  params => [...QueryKeys.accounts, params]
);

export function useAccountBalanceHistory(accountId: number) {
  return createQuery<BalanceHistoryPoint[]>({
    queryKey: [...QueryKeys.accountById(accountId), "balance_history"],
    queryFn: () => {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 500);
      const startDateStr = startDate.toISOString().split("T")[0];

      return fetchWithAuth<BalanceHistoryResponse>(
        `accounts/${accountId}/balance_over_time?start_date=${startDateStr}&end_date=${endDate}`
      ).then(data =>
        Object.entries(data).map(([date, value]) => ({
          date,
          value: value as number,
        }))
      );
    },
    enabled: !!accountId,
  });
}
