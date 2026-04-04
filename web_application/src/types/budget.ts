import type { CategorySummary } from "./category";

export interface Budget {
  id: number;
  category: string;
  year: number;
  month: number;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetComparison {
  category: string;
  budgeted: number;
  actual: number;
  difference: number;
  percentage: number;
}

export interface PeriodSummaryData {
  start_date: string;
  end_date: string;
  income: {
    total: number;
    by_category: Record<string, CategorySummary>;
  };
  expense: {
    total: number;
    by_category: Record<string, CategorySummary>;
  };
}

export interface PeriodSummaryResponse {
  period: string;
  summaries: PeriodSummaryData[];
}
