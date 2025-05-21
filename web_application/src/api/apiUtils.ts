import { handleTokenExpiration } from "@/utils/auth"
import { QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { PaginatedResponse } from "../types"
import { API_URL, QueryKeyArray, QueryKeys } from "./queryKeys"

// #region Common Interfaces for API Utils
export interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: any
}

export interface BatchDeleteResponse {
  successful: number[]
  failed: Array<{
    id: number
    error: string
  }>
  total_successful: number
  total_failed: number
}

export interface BatchCreateResponse<T> {
  successful: T[]
  failed: Array<{
    data: any
    error: string
  }>
  total_successful: number
  total_failed: number
}

export interface BatchOperationResponse {
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
// #endregion

// #region API Fetch Utilities
export async function fetchWithAuth<T>(
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

export function invalidateQueries(
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
    queryClient.invalidateQueries({ queryKey: QueryKeys[key] as QueryKey })
  }
}

export const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes

export interface QueryConfig<T> {
  queryKey: readonly unknown[]
  queryFn: () => Promise<T>
  enabled?: boolean
  staleTime?: number
}

export function createQuery<T>(config: QueryConfig<T>) {
  return useQuery({
    ...config,
    staleTime: config.staleTime ?? DEFAULT_STALE_TIME,
  })
}

export function formatQueryValue(
  value: string | number | boolean | string[] | number[] | boolean[]
): string {
  if (Array.isArray(value)) {
    return value.join(",")
  }
  return value.toString()
}
// #endregion

// #region Factory Functions (CRUD, Batch, Paginated)
export interface CrudConfig {
  endpoint: string
  queryKeysToInvalidate: (keyof typeof QueryKeys)[]
}

export function createCrudOperations<T extends { id?: number }>(config: CrudConfig) {
  const { endpoint, queryKeysToInvalidate } = config

  const useBatchDelete = () => {
    const queryClient = useQueryClient()
    return createBatchDeleteMutation<T>(
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

export function createBatchDeleteMutation<T extends { id?: number }>( // Exported for direct use if needed
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

export function createBatchCreateMutation<T extends { id?: number }>( // Exported for direct use if needed
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

export function createPaginatedQuery<
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
>(endpoint: string, queryKeyFn: (params: P) => unknown[]) {
  return (params: P = {} as P) => {
    return createQuery<R>({
      queryKey: queryKeyFn(params),
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
            queryParams.append(key, formatQueryValue(value as string | number | boolean | string[] | number[] | boolean[]))
          }
        })
        return fetchWithAuth(`${endpoint}?${queryParams.toString()}`)
      },
    })
  }
}
// #endregion
