import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "../api/queryKeys";
import {
  createQuery,
  fetchWithAuth
} from "../api/apiUtils";
import type { TransactionFromCategorySummary, Transaction } from "./transaction"; // Assuming TransactionFromCategorySummary will be defined here or imported if it stays separate

// Type Definitions (Moved/Consolidated from types.ts and queries.ts)
export type CategoryType = "expense" | "income" | "transfer";

export interface CategoryMetadata {
  id: string
  name: {
    fr: string
    en: string
  }
  subcategories?: string[]
  icon?: string
  color?: string
  // Fields from types.ts original CategoryMetadata
  iconName?: string // Potentially merged with icon
  iconSet?: string
  subCategories?: Array<{ // Potentially merged with subcategories
    iconName: string
    iconSet: string
    name: {
      en: string
      fr: string
    }
  }> | null
}

// This is TransactionFromCategorySummary from queries.ts
export interface CategoryTransaction extends Omit<Transaction, 'refund_items' | 'type' > {
  type: "expense" | "income" | "transfer" // Ensure this aligns if Transaction type is broader
}

export interface CategorySummary { // From queries.ts (structure might differ slightly from types.ts version)
  count: number
  net_amount: number
  original_amount: number
  transactions: CategoryTransaction[] // Using the refined CategoryTransaction
}

// This is CategorySummaryResponse from queries.ts
export interface CategorySummaryApiResponse {
  income: {
    total: { net: number; original: number }
    by_category: Record<string, CategorySummary>
  }
  expense: {
    total: { net: number; original: number }
    by_category: Record<string, CategorySummary>
  }
  transfer: {
    total: { net: number; original: number }
    by_category: Record<string, CategorySummary>
  }
}


export interface PeriodSummaryData { // From queries.ts (structure might differ from types.ts PeriodData)
  start_date: string
  end_date: string
  income: {
    total: number
    by_category: Record<string, CategorySummary>
  }
  expense: {
    total: number
    by_category: Record<string, CategorySummary>
  }
}

export interface PeriodSummaryApiResponse { // From queries.ts (structure might differ from types.ts PeriodSummaryResponse)
  period: string
  summaries: PeriodSummaryData[]
}


// Hooks (Moved from queries.ts)
export function useCategoriesByType(type: CategoryType) {
  return createQuery<CategoryMetadata[]>({ // CategoryMetadata defined above
    queryKey: [...QueryKeys.categories, type],
    queryFn: () => fetchWithAuth(`budgets/categories/${type}`),
  });
}

export function useAllCategories() {
  return createQuery<Record<CategoryType, CategoryMetadata[]>>({
    queryKey: QueryKeys.allCategories,
    queryFn: () => fetchWithAuth("budgets/categories"),
  });
}

export function useCategorySummary(startDate: string, endDate: string) {
  return createQuery<CategorySummaryApiResponse>({ // CategorySummaryApiResponse defined above
    queryKey: QueryKeys.categorySummaryByDate(startDate, endDate),
    queryFn: () =>
      fetchWithAuth(
        `budgets/categories/summary?start_date=${startDate}&end_date=${endDate}`
      ),
  });
}

export function usePeriodSummary(
  startDate: string,
  endDate: string,
  period: "week" | "month" | "quarter" | "year"
) {
  return createQuery<PeriodSummaryApiResponse>({ // PeriodSummaryApiResponse defined above
    queryKey: QueryKeys.periodSummary(startDate, endDate, period),
    queryFn: () =>
      fetchWithAuth(
        `budgets/summary/period?start_date=${startDate}&end_date=${endDate}&period=${period}`
      ),
  });
}
