import { useQueryClient } from "@tanstack/react-query";
import {
    createBatchCreateMutation,
    createCrudOperations,
    createPaginatedQuery
} from "../api/apiUtils";
import { QueryKeys } from "../api/queryKeys";
import type { PaginatedResponse } from "../types";

// Type Definition (Moved from types.ts)
export interface RefundGroup {
  id?: number
  name: string
  description?: string | null
}

// Filters and Query Params (Moved from queries.ts)
export interface RefundGroupFilters { // Added export
  id?: number | number[]
  name?: string | string[]
  description?: string | string[]
}

export interface RefundGroupQueryParams extends RefundGroupFilters { // Added export
  page?: number
  per_page?: number
  sort_by?: Extract<keyof RefundGroup, string>
  sort_order?: "asc" | "desc"
  search?: string
  search_fields?: Extract<keyof RefundGroup, string>[]
}

// Operations and Hooks (Moved from queries.ts)
const refundGroupOperations = createCrudOperations<RefundGroup>({
  endpoint: "refund_groups",
  queryKeysToInvalidate: ["refundGroups", "refundItems", "transactions"],
});

export const {
  useBatchDelete: useBatchDeleteRefundGroups,
  useDelete: useDeleteRefundGroup,
  useCreate: useCreateRefundGroup,
  useUpdate: useUpdateRefundGroup,
} = refundGroupOperations;

export function useBatchCreateRefundGroups() {
  const queryClient = useQueryClient();
  return createBatchCreateMutation<RefundGroup>(
    "refund_groups",
    ["refundGroups", "refundItems", "transactions"],
    queryClient
  );
}

export const useRefundGroups = createPaginatedQuery<
  RefundGroup,
  RefundGroupQueryParams,
  PaginatedResponse<RefundGroup>
>("refund_groups", params => [...QueryKeys.refundGroups, params]);
