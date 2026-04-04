export type TransactionType = "expense" | "income" | "transfer";

export type TransactionField =
  | "id"
  | "date"
  | "date_accountability"
  | "description"
  | "amount"
  | "from_account_id"
  | "to_account_id"
  | "category"
  | "subcategory"
  | "type";

export interface Transaction {
  id: number;
  date: string;
  date_accountability: string;
  description: string;
  amount: number;
  from_account_id: number;
  to_account_id: number;
  type: TransactionType;
  category: string;
  subcategory?: string;
  refunded_amount: number;
  investment_id?: number | null;
  to_amount?: number | null;
  currency?: string;
  from_currency?: string;
  to_currency?: string;
  preferred_currency?: string;
  amount_preferred?: number;
  refund_items?: Array<{
    amount: number;
    date: string;
    description: string;
    id: number;
    refund_group_id?: number | null;
  }>;
}

export interface TransactionFilters {
  type?: TransactionType | TransactionType[];
  category?: string | string[];
  subcategory?: string | string[];
  from_account_id?: number | number[];
  to_account_id?: number | number[];
  account_id?: number | number[];
  from_date?: string;
  to_date?: string;
  date?: string | string[];
  date_accountability?: string | string[];
  amount?: number | number[];
  id?: number | number[];
  description?: string | string[];
  has_refund?: boolean | boolean[];
}

export interface TransactionQueryParams extends TransactionFilters {
  page?: number;
  per_page?: number;
  sort_by?: TransactionField;
  sort_order?: "asc" | "desc";
  fields?: TransactionField[];
  search?: string;
  search_fields?: TransactionField[];
}
