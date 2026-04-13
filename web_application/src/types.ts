import type { Transaction } from "./types/transaction";

export * from "./types/account";
export * from "./types/asset";
export * from "./types/bank";
export * from "./types/budget";
export * from "./types/category";
export * from "./types/investment";
export * from "./types/liability";
export * from "./types/potentialRefund";
export * from "./types/portfolio";
export * from "./types/refundGroup";
export * from "./types/refundItem";
export * from "./types/stock";
export * from "./types/transaction";
export * from "./types/gocardless";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface TransactionPaginatedResponse extends PaginatedResponse<Transaction> {
  /** Present when the backend includes an aggregate (optional in Eden-inferred responses). */
  total_amount?: number;
}

export type TimePeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "max";
