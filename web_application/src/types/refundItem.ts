export interface RefundItem {
  id?: number;
  amount: number;
  description?: string | null;
  expense_transaction_id: number;
  income_transaction_id: number;
  refund_group_id?: number | null;
}

export interface RefundItemFilters {
  id?: number | number[];
  amount?: number | number[];
  description?: string | string[];
  expense_transaction_id?: number | number[];
  income_transaction_id?: number | number[];
  refund_group_id?: number | number[];
}

export interface RefundItemQueryParams extends RefundItemFilters {
  page?: number;
  per_page?: number;
  sort_by?: keyof RefundItem;
  sort_order?: "asc" | "desc";
  search?: string;
  search_fields?: (keyof RefundItem)[];
}
