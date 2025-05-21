import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    createBatchCreateMutation,
    createPaginatedQuery,
    fetchWithAuth,
    invalidateQueries // For useCreateAsset
} from "../api/apiUtils";
import { QueryKeys } from "../api/queryKeys";
import type { PaginatedResponse } from "../types";

// Type Definition (Moved from queries.ts)
export interface Asset {
  id: number
  name: string
  symbol: string
  type: string
  current_price?: number
}

// Query Params (Moved from queries.ts)
export interface AssetQueryParams { // Added export
  page?: number
  per_page?: number
  sort_by?: keyof Asset
  sort_order?: "asc" | "desc"
  search?: string
  search_fields?: (keyof Asset)[]
  type?: string | string[]
  symbol?: string | string[]
}

// Hooks (Moved from queries.ts)
export const useAssets = createPaginatedQuery<Asset, AssetQueryParams, PaginatedResponse<Asset>>(
  "assets",
  params => [...QueryKeys.assets, params]
);

export function useBatchCreateAssets() {
  const queryClient = useQueryClient();
  return createBatchCreateMutation<Asset>(
    "assets",
    ["assets"],
    queryClient
  );
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation<Asset, Error, { symbol: string; name: string; type: string }>({
    mutationFn: (data) => fetchWithAuth("assets", { method: "POST", body: data }),
    onSuccess: () => {
      invalidateQueries(queryClient, "assets");
      invalidateQueries(queryClient, "investments"); // Assets are linked to investments
      queryClient.refetchQueries({ queryKey: QueryKeys.assets });
    },
  });
}
