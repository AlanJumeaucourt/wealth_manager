import { useQuery } from "@tanstack/react-query";
import { createCrudOperations, fetchWithAuth } from "../api/apiUtils";
import { QueryKeys } from "../api/queryKeys";
import type { Budget, BudgetComparison } from "./budget"; // Self-import for clarity

export interface Budget {
  id: number
  category: string
  year: number
  month: number
  amount: number
  created_at: string
  updated_at: string
}

export interface BudgetComparison {
  category: string
  budgeted: number
  actual: number
  difference: number
  percentage: number
}

// #region Budget Queries/Mutations (Moved from queries.ts)
export function useBudgets(year?: number, month?: number) {
  const queryParams = year && month ? `?year=${year}&month=${month}` : ''

  const fetchBudgetsHook = useQuery({
    queryKey: year && month ? QueryKeys.budgetsByYearMonth(year, month) : QueryKeys.budgets,
    queryFn: () => fetchWithAuth<Budget[]>(`budgets/budgets${queryParams}`),
  })

  const crudOperations = createCrudOperations<Budget>({
    endpoint: 'budgets/budgets',
    queryKeysToInvalidate: ['budgets', 'budgetsByYearMonth', 'budgetComparison'],
  })

  return {
    ...fetchBudgetsHook,
    ...crudOperations,
  }
}

export function useBudgetComparison(year: number, month: number) {
  return useQuery({
    queryKey: QueryKeys.budgetComparison(year, month),
    queryFn: () => fetchWithAuth<BudgetComparison[]>(`budgets/budgets/compare?year=${year}&month=${month}`),
    enabled: !!year && !!month,
  })
}
// #endregion
