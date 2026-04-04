import { authFetch } from "@/api/authFetch";
import { handleTokenExpiration } from "@/utils/auth";
import { QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaginatedResponse } from "../types";
import { type TreatyResult, unwrapEden } from "./edenUnwrap";
import { API_URL, QueryKeyArray, QueryKeys } from "./queryKeys";
import { wealthApi } from "./wealthApi";

// #region Common Interfaces for API Utils
interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

interface BatchCreateResponse<T> {
  successful: T[];
  failed: Array<{
    data: unknown;
    error: string;
  }>;
  total_successful: number;
  total_failed: number;
}

interface BatchDeleteResponse {
  successful: number[];
  failed: Array<{
    id: number;
    error: string;
  }>;
  total_successful: number;
  total_failed: number;
}

export interface BatchOperationResponse {
  message: string;
  details: {
    successful: unknown[];
    failed: Array<{
      data?: unknown;
      error: string;
    }>;
    total_successful: number;
    total_failed: number;
  };
}

const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/** Maps list query params to Eden query objects (same semantics as legacy URLSearchParams). */
export function buildListQueryParams(
  params: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const q: Record<string, string | number | undefined> = {};
  const stdKeys = [
    "page",
    "per_page",
    "sort_by",
    "sort_order",
    "search",
    "search_fields",
    "fields",
  ] as const;

  for (const key of stdKeys) {
    const v = params[key];
    if (v === undefined || v === null || v === "") continue;
    if (key === "search_fields" || key === "fields") {
      q[key] = formatQueryValue(v as string | number | boolean | string[] | number[] | boolean[]);
    } else if (key === "page" || key === "per_page") {
      q[key] = Number(v);
    } else {
      q[key] = typeof v === "string" || typeof v === "number" ? v : formatQueryValue(v as never);
    }
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if ((stdKeys as readonly string[]).includes(key)) return;
    q[key] = formatQueryValue(value as string | number | boolean | string[] | number[] | boolean[]);
  });
  return q;
}

// #endregion

// #region Legacy fetch (routes not covered by Eden / stubs)
export async function fetchWithAuth<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  console.log("[apiUtils] fetchWithAuth (legacy Eden bypass)", options.method ?? "GET", endpoint);
  const response = await authFetch(`${API_URL}/${endpoint}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      if (handleTokenExpiration(error, response.status)) {
        throw new Error("Token expired");
      }
      throw new Error(
        `Failed to ${options.method || "fetch"} ${endpoint}: ${
          (error as { message?: string }).message || "Unknown error"
        }`,
      );
    } catch {
      throw new Error(`Failed to ${options.method || "fetch"} ${endpoint}: ${response.statusText}`);
    }
  }

  if (options.method === "DELETE" || response.headers.get("content-length") === "0") {
    return {} as T;
  }

  try {
    return await response.json();
  } catch {
    console.warn(`Empty or invalid JSON response from ${endpoint}`);
    return {} as T;
  }
}

export function invalidateQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  key: keyof typeof QueryKeys,
) {
  if (typeof QueryKeys[key] === "function") {
    if (key === "portfolioSummary") {
      void queryClient.invalidateQueries({
        queryKey: (QueryKeys[key] as (id?: number) => QueryKeyArray)(),
      });
    } else if (key === "portfolioPerformance") {
      void queryClient.invalidateQueries({
        queryKey: (QueryKeys[key] as (period?: string) => QueryKeyArray)("1Y"),
      });
    } else {
      void queryClient.invalidateQueries({
        queryKey: [String(QueryKeys[key].toString().split(",")[0])],
      });
    }
  } else {
    void queryClient.invalidateQueries({ queryKey: QueryKeys[key] as QueryKey });
  }
}

interface QueryConfig<T> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
}

/** TanStack Query wrapper — must follow Rules of Hooks at call sites. */
export function useCreateQuery<T>(config: QueryConfig<T>) {
  const { staleTime, ...rest } = config;
  return useQuery({
    ...rest,
    staleTime: staleTime ?? DEFAULT_STALE_TIME,
  });
}

function formatQueryValue(
  value: string | number | boolean | string[] | number[] | boolean[],
): string {
  if (Array.isArray(value)) {
    return value.join(",");
  }
  return value.toString();
}

// #endregion

// #region Eden CRUD (factory)
type CrudResourceKey =
  | "banks"
  | "accounts"
  | "transactions"
  | "investments"
  | "refund_groups"
  | "refund_items"
  | "liabilities"
  | "liability_payments"
  | "budgets_budgets"
  | "assets";

/** URL segments for batch endpoints (fallback when a resource has no Eden batch schema). */
const CRUD_PATH: Record<CrudResourceKey, string> = {
  banks: "banks",
  accounts: "accounts",
  transactions: "transactions",
  investments: "investments",
  refund_groups: "refund_groups",
  refund_items: "refund_items",
  liabilities: "liabilities",
  liability_payments: "liability_payments",
  budgets_budgets: "budgets/budgets",
  assets: "assets",
};

function crudResource(key: CrudResourceKey) {
  switch (key) {
    case "banks":
      return wealthApi.banks;
    case "accounts":
      return wealthApi.accounts;
    case "transactions":
      return wealthApi.transactions;
    case "investments":
      return wealthApi.investments;
    case "refund_groups":
      return wealthApi.refund_groups;
    case "refund_items":
      return wealthApi.refund_items;
    case "liabilities":
      return wealthApi.liabilities;
    case "liability_payments":
      return wealthApi.liability_payments;
    case "budgets_budgets":
      return wealthApi.budgets.budgets;
    case "assets":
      return wealthApi.assets;
    default: {
      const _exhaust: never = key;
      return _exhaust;
    }
  }
}

interface CrudConfig {
  resource: CrudResourceKey;
  queryKeysToInvalidate: (keyof typeof QueryKeys)[];
}

/**
 * @param T - Entity shape from Eden (GET/list responses).
 * @param TCreate - Body for POST when it differs from `Omit<T, "id">` (e.g. no server fields).
 */
export function createCrudOperations<T extends { id?: number }, TCreate = Omit<T, "id">>(
  config: CrudConfig,
) {
  const { resource, queryKeysToInvalidate } = config;
  const res = crudResource(resource);

  const useBatchDelete = () => {
    const queryClient = useQueryClient();
    return useBatchDeleteMutation(resource, queryKeysToInvalidate, queryClient);
  };

  const useDelete = () => {
    const queryClient = useQueryClient();
    return useMutation<T, Error, number>({
      mutationFn: (id: number) =>
        unwrapEden(res({ id: String(id) }).delete() as Promise<TreatyResult<T>>),
      onSuccess: () => {
        queryKeysToInvalidate.forEach((key) => {
          invalidateQueries(queryClient, key);
        });
      },
    });
  };

  const useCreate = () => {
    const queryClient = useQueryClient();
    return useMutation<T, Error, TCreate>({
      mutationFn: (data: TCreate) =>
        unwrapEden(
          (res.post as (args: { body: unknown }) => Promise<TreatyResult<T>>)({
            body: data,
          }),
        ),
      onSuccess: () => {
        queryKeysToInvalidate.forEach((key) => {
          invalidateQueries(queryClient, key);
        });
      },
    });
  };

  const useUpdate = () => {
    const queryClient = useQueryClient();
    return useMutation<T, Error, Partial<T> & { id: number }>({
      mutationFn: (data: Partial<T> & { id: number }) => {
        const { id, ...updateData } = data;
        const endpoint = res({ id: String(id) });
        return unwrapEden(
          (endpoint.put as (args: { body: unknown }) => Promise<TreatyResult<T>>)({
            body: updateData,
          }),
        );
      },
      onSuccess: () => {
        queryKeysToInvalidate.forEach((key) => {
          invalidateQueries(queryClient, key);
        });
      },
    });
  };

  return {
    useBatchDelete,
    useDelete,
    useCreate,
    useUpdate,
  };
}

export function useBatchCreateMutation<T extends { id?: number }, TItem = Omit<T, "id">>(
  resource: CrudResourceKey,
  queryKeysToInvalidate: (keyof typeof QueryKeys)[],
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const res = crudResource(resource) as {
    batch?: {
      create: { post: (args: { body: { items: unknown[] } }) => Promise<unknown> };
    };
  };
  return useMutation<BatchCreateResponse<T>, Error, TItem[]>({
    mutationFn: async (items: TItem[]) => {
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("No items provided for batch creation");
      }
      if (res.batch?.create?.post) {
        return unwrapEden(
          res.batch.create.post({
            body: { items: items as never[] },
          }) as Promise<TreatyResult<BatchCreateResponse<T>>>,
        );
      }
      return fetchWithAuth<BatchCreateResponse<T>>(`${CRUD_PATH[resource]}/batch/create`, {
        method: "POST",
        body: { items },
      });
    },
    onSuccess: (result) => {
      console.log(`Batch create results for ${resource}:`, result);
      queryKeysToInvalidate.forEach((key) => {
        invalidateQueries(queryClient, key);
      });
    },
    onError: (error) => {
      console.error(`Batch create operation failed for ${resource}:`, error);
    },
  });
}

function useBatchDeleteMutation(
  resource: CrudResourceKey,
  queryKeysToInvalidate: (keyof typeof QueryKeys)[],
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const res = crudResource(resource) as {
    batch?: {
      delete: { post: (args: { body: { ids: number[] } }) => Promise<unknown> };
    };
  };
  return useMutation<BatchDeleteResponse, Error, number[]>({
    mutationFn: async (ids: number[]) => {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error("No IDs provided for batch delete");
      }
      if (res.batch?.delete?.post) {
        return unwrapEden(
          res.batch.delete.post({
            body: { ids },
          }) as Promise<TreatyResult<BatchDeleteResponse>>,
        );
      }
      return fetchWithAuth<BatchDeleteResponse>(`${CRUD_PATH[resource]}/batch/delete`, {
        method: "POST",
        body: { ids },
      });
    },
    onSuccess: () => {
      queryKeysToInvalidate.forEach((key) => {
        invalidateQueries(queryClient, key);
      });
    },
  });
}

export function createPaginatedQuery<T, P extends object, R = PaginatedResponse<T>>(
  fetchPage: (params: P) => Promise<R>,
  queryKeyFn: (params: P) => unknown[],
) {
  return (params: P = {} as P, options?: { enabled?: boolean }) => {
    return useCreateQuery<R>({
      queryKey: queryKeyFn(params),
      queryFn: () => fetchPage(params),
      enabled: options?.enabled,
    });
  };
}
// #endregion
