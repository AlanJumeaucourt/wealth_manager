import { useQueryClient } from "@tanstack/react-query";
import {
    createBatchCreateMutation,
    createCrudOperations,
    createPaginatedQuery
} from "../api/apiUtils";
import { QueryKeys } from "../api/queryKeys";
import type { PaginatedResponse } from "../types"; // Assuming PaginatedResponse is in types.ts or types/index.ts

// Type Definition (Moved from types.ts)
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

// Related Types (Moved from queries.ts / types.ts - consolidated here)
export type TransactionType = "expense" | "income" | "transfer";

export type TransactionField =
  | "id"
  | "date"
  | "date_accountability"
  | "description"
  | "amount"
  | "from_account_id"
  | "to_account_id"
  | "category"
  | "subcategory"
  | "type";

export interface TransactionFilters { // Added export (from queries.ts)
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

export interface TransactionQueryParams extends TransactionFilters { // Added export (from queries.ts)
  page?: number
  per_page?: number
  sort_by?: TransactionField
  sort_order?: "asc" | "desc"
  fields?: TransactionField[]
  search?: string
  search_fields?: TransactionField[]
}

export interface TransactionPaginatedResponse extends PaginatedResponse<Transaction> { // Added export (from queries.ts)
  total_amount: number
}

// Operations and Hooks (Moved from queries.ts)
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
});

export const {
  useBatchDelete: useBatchDeleteTransactions,
  useDelete: useDeleteTransaction,
  useCreate: useCreateTransaction,
  useUpdate: useUpdateTransaction,
} = transactionOperations;

export function useBatchCreateTransactions() {
  const queryClient = useQueryClient();
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
  );
}

export const useTransactions = createPaginatedQuery<
  Transaction,
  TransactionQueryParams,
  TransactionPaginatedResponse
>("transactions", params => [...QueryKeys.transactions, params]);
