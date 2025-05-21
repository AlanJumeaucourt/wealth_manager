import { useQueryClient } from "@tanstack/react-query";
import {
    createBatchCreateMutation,
    createCrudOperations,
    createPaginatedQuery
} from "../api/apiUtils";
import { QueryKeys } from "../api/queryKeys";
import type { PaginatedResponse } from "../types";
import type { Transaction } from "./transaction"; // Investment extends Omit<Transaction, ...>

// Type Definition (Moved from types.ts)
export interface Investment
  extends Omit<
    Transaction,
    |"id"
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

// Filters and Query Params (Moved from queries.ts)
export interface InvestmentFilters { // Added export
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

export interface InvestmentQueryParams extends InvestmentFilters { // Added export
  page?: number
  per_page?: number
  sort_by?: Extract<keyof Investment, string>
  sort_order?: "asc" | "desc"
  search?: string
  search_fields?: Extract<keyof Investment, string>[]
}

// Operations and Hooks (Moved from queries.ts)
const investmentOperations = createCrudOperations<Investment & { id?: number }>({ // id might come from Transaction
  endpoint: "investments",
  queryKeysToInvalidate: [
    "investments",
    "accounts",
    "portfolioSummary",
    "portfolioPerformance",
  ],
});

export const {
  useBatchDelete: useBatchDeleteInvestments,
  useDelete: useDeleteInvestment,
  useCreate: useCreateInvestment,
  useUpdate: useUpdateInvestment,
} = investmentOperations;

export function useBatchCreateInvestments() {
  const queryClient = useQueryClient();
  return createBatchCreateMutation<Investment & { id?: number }>(
    "investments",
    ["investments", "accounts", "portfolioSummary", "portfolioPerformance"],
    queryClient
  );
}

export const useInvestments = createPaginatedQuery<
  Investment,
  InvestmentQueryParams,
  PaginatedResponse<Investment>
>("investments", params => [...QueryKeys.investments, params]);
