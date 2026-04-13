import type { Transaction } from "./transaction";
export interface Investment extends Omit<
  Transaction,
  "id" | "type" | "category" | "subcategory" | "refunded_amount" | "amount"
> {
  transaction_id: number;
  investment_type: "Buy" | "Sell" | "Deposit" | "Withdrawal" | "Dividend";
  asset_id: number;
  fee: number;
  quantity: number;
  tax: number;
  total_paid?: number;
  unit_price: number;
  user_id: number;

  // Sell-only: related accounting entries created by backend
  pl_transaction_id?: number | null;
  fee_transaction_id?: number | null;
  tax_transaction_id?: number | null;

  // Sell-only: realized P/L (before fees & taxes)
  gain_loss_override?: number | null;
  gain_loss_source?: "manual" | "calculated" | null;
  gain_loss_calculated?: number | null;
}

export interface InvestmentDetail {
  investment: Investment & {
    total_paid: number;
    gain_loss_override?: number | null;
    gain_loss_calculated?: number | null;
    gain_loss_source?: string | null;
  };
  transactions: Transaction[];
}

export interface InvestmentFilters {
  transaction_id?: number | number[];
  investment_type?: string | string[];
  asset_id?: number | number[];
  date?: string | string[];
  fee?: number | number[];
  from_account_id?: number | number[];
  quantity?: number | number[];
  tax?: number | number[];
  to_account_id?: number | number[];
  total_paid?: number | number[];
  unit_price?: number | number[];
  user_id?: number | number[];
}

export interface InvestmentQueryParams extends InvestmentFilters {
  page?: number;
  per_page?: number;
  sort_by?: keyof Investment;
  sort_order?: "asc" | "desc";
  search?: string;
  search_fields?: (keyof Investment)[];
}
