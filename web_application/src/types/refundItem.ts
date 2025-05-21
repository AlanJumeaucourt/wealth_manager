import { useQueryClient } from "@tanstack/react-query";
import {
    createBatchCreateMutation,
    createCrudOperations,
    createPaginatedQuery
} from "../api/apiUtils";
import { QueryKeys } from "../api/queryKeys";
import type { PaginatedResponse } from "../types";

// Type Definition (Moved from types.ts)
export interface RefundItem {
  id?: number
  amount: number
  description?: string | null
  expense_transaction_id: number
  income_transaction_id: number
  refund_group_id?: number | null
}

// Filters and Query Params (Moved from queries.ts)
export interface RefundItemFilters { // Added export
  id?: number | number[]
  amount?: number | number[]
  description?: string | string[]
  expense_transaction_id?: number | number[]
  income_transaction_id?: number | number[]
  refund_group_id?: number | number[]
}

export interface RefundItemQueryParams extends RefundItemFilters { // Added export
  page?: number
  per_page?: number
  sort_by?: Extract<keyof RefundItem, string>
  sort_order?: "asc" | "desc"
  search?: string
  search_fields?: Extract<keyof RefundItem, string>[]
}

// Operations and Hooks (Moved from queries.ts)
const refundItemOperations = createCrudOperations<RefundItem>({
  endpoint: "refund_items",
  queryKeysToInvalidate: ["refundItems", "transactions"],
});

export const {
  useBatchDelete: useBatchDeleteRefundItems,
  useDelete: useDeleteRefundItem,
  useCreate: useCreateRefundItem,
  useUpdate: useUpdateRefundItem,
} = refundItemOperations;

export function useBatchCreateRefundItems() {
  const queryClient = useQueryClient();
  return createBatchCreateMutation<RefundItem>(
    "refund_items",
    ["refundItems", "transactions"],
    queryClient
  );
}

export const useRefundItems = createPaginatedQuery<
  RefundItem,
  RefundItemQueryParams,
  PaginatedResponse<RefundItem>
>("refund_items", params => [...QueryKeys.refundItems, params]);
