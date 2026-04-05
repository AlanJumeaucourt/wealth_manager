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

  // Enriched by backend for multi-currency display (amounts are in native account currencies)
  currency?: string;
  from_currency?: string;
  to_currency?: string;
  /** Converted to the user's preferred currency (see GET /users). */
  amount_preferred?: number | null;
  refunded_amount_preferred?: number;
  net_amount_preferred?: number | null;
}
