export interface Transaction {
  id: number;
  date: string;
  date_accountability: string;
  description: string;
  amount: number;
  to_amount?: number | null;
  type: string;
  from_account_id: number;
  to_account_id: number;
  category: string;
  subcategory: string | null;
  is_investment: boolean;

  // Enriched by backend for multi-currency display
  currency?: string;
  from_currency?: string;
  to_currency?: string;
  preferred_currency?: string;
  amount_preferred?: number;
}
