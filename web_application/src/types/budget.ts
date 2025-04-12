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
