import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { QueryKeys } from "../api/queryKeys";
import {
  createQuery,
  fetchWithAuth
} from "../api/apiUtils";
import type { BatchOperationResponse } from "../api/apiUtils"; // For batch custom price operations

// Type Definitions (Moved/Consolidated)
export interface StockPrice {
  close: number
  date: string
  high: number
  low: number
  open: number
  value: number
  volume: number
}

export interface CustomPriceData { // Added export (from queries.ts)
  close: number
  open?: number
  high?: number
  low?: number
  volume?: number
}

export interface AddCustomPriceResponse { // Added export (from queries.ts)
  message: string
  price?: {
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }
}

export interface DeleteCustomPriceResponse { // Added export (from queries.ts)
  message: string
}

// Hooks (Moved from queries.ts)
export function useStockHistory(symbol: string | undefined) {
  return createQuery<StockPrice[]>({ // StockPrice defined above
    queryKey: symbol
      ? QueryKeys.stockHistory(symbol)
      : ["stocks", "history", null],
    queryFn: async () => {
      if (!symbol) return []
      return fetchWithAuth(`stocks/${symbol}/history`)
    },
    enabled: !!symbol,
  });
}

export function useStockSearch(query: string) {
  return createQuery<Array<{symbol: string, name: string}>>({
    queryKey: QueryKeys.stockSearch(query),
    queryFn: async () => {
      if (!query || query.length < 2) return []
      return fetchWithAuth(`stocks/search?q=${encodeURIComponent(query)}`)
    },
    enabled: query.length >= 2,
  });
}

export function useCustomPrices(symbol: string) {
  return useQuery({
    queryKey: QueryKeys.customPrices(symbol),
    queryFn: async () => {
      return fetchWithAuth(`stocks/${symbol}/custom-prices`)
    },
    enabled: !!symbol,
  });
}

export function useAddCustomPrice() {
  const queryClient = useQueryClient();
  return useMutation<
    AddCustomPriceResponse, // Defined above
    Error,
    { symbol: string; date: string; price: CustomPriceData } // CustomPriceData defined above
  >({
    mutationFn: async ({ symbol, date, price }) => {
      return fetchWithAuth(`stocks/${symbol}/custom-prices`, {
        method: "POST",
        body: { date, ...price },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QueryKeys.customPrices(variables.symbol),
      });
    },
  });
}

export function useBatchAddCustomPrices() {
  const queryClient = useQueryClient();
  return useMutation<
    BatchOperationResponse, // Imported from apiUtils
    Error,
    {
      symbol: string
      prices: Array<{ date: string; price: CustomPriceData }> // CustomPriceData defined above
    }
  >({
    mutationFn: async ({ symbol, prices }) => {
      const formattedPrices = prices.map(p => ({ date: p.date, ...p.price }));
      return fetchWithAuth(`stocks/${symbol}/custom-prices/batch`, {
        method: "POST",
        body: { prices: formattedPrices },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QueryKeys.customPrices(variables.symbol),
      });
    },
  });
}

export function useDeleteCustomPrice() {
  const queryClient = useQueryClient();
  return useMutation<
    DeleteCustomPriceResponse, // Defined above
    Error,
    { symbol: string; date: string }
  >({
    mutationFn: async ({ symbol, date }) => {
      return fetchWithAuth(
        `stocks/${symbol}/custom-prices/${date}`,
        { method: "DELETE" }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QueryKeys.customPrices(variables.symbol),
      });
    },
  });
}

export function useBatchDeleteCustomPrices() {
  const queryClient = useQueryClient();
  return useMutation<
    BatchOperationResponse, // Imported from apiUtils
    Error,
    { symbol: string; dates: string[] }
  >({
    mutationFn: async ({ symbol, dates }) => {
      return fetchWithAuth(
        `stocks/${symbol}/custom-prices/batch/delete`,
        {
          method: "POST", // Or DELETE if backend supports body with DELETE
          body: { dates },
        }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QueryKeys.customPrices(variables.symbol),
      });
    },
  });
}
