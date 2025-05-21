import { useQueryClient } from "@tanstack/react-query";
import {
    createBatchCreateMutation,
    createCrudOperations,
    createPaginatedQuery
} from "../api/apiUtils";
import { QueryKeys } from "../api/queryKeys";
import type { PaginatedResponse } from "../types"; // Or directly from './types' if that's where it is

// Type Definition (Moved from types.ts)
export interface Bank {
  id: number
  name: string
  website?: string
}

// Filters and Query Params (Moved from queries.ts)
export interface BankFilters { // Added export
  id?: number | number[]
  name?: string | string[]
  website?: string | string[]
}

export interface BankQueryParams extends BankFilters { // Added export
  page?: number
  per_page?: number
  sort_by?: Extract<keyof Bank, string>
  sort_order?: "asc" | "desc"
  search?: string
  search_fields?: Extract<keyof Bank, string>[]
}

// Operations and Hooks (Moved from queries.ts)
const bankOperations = createCrudOperations<Bank>({
  endpoint: "banks",
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
  return createBatchCreateMutation<Bank>(
    "banks",
    ["banks", "accounts", "wealthOverTime"],
    queryClient
  );
}

export const useBanks = createPaginatedQuery<Bank, BankQueryParams, PaginatedResponse<Bank>>(
  "banks",
  params => [...QueryKeys.banks, params]
);
