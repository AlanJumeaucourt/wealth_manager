export interface BudgetSubcategory {
  net_amount: number;
  original_amount: number;
  subcategory: string | null;
  transactions_related: string[];
}

export interface BudgetCategory {
  category: string;
  net_amount: number;
  original_amount: number;
  subcategories: BudgetSubcategory[];
}

export type BudgetSummaryResponse = BudgetCategory[];
