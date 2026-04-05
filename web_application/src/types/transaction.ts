import type {
  Transaction,
  TransactionCreateBody,
  TransactionQueryParams as EdenTransactionQueryParams,
} from "@/api/edenDerivedTypes";

export type { Transaction, TransactionCreateBody };

/**
 * List/query params for transactions — Eden-inferred from `GET /transactions`, widened so callers can
 * pass `search_fields` / `fields` as arrays; `buildListQueryParams` serializes them like URL params.
 */
export type TransactionQueryParams = Omit<
  EdenTransactionQueryParams,
  "search_fields" | "fields"
> & {
  search_fields?: string | string[];
  fields?: string | string[];
};

/** Discriminant for transaction rows — same literals as create/update bodies on the API. */
export type TransactionType = Transaction["type"];

/**
 * Sortable / searchable field names for list queries (aligns with backend listable fields for
 * `transactions`; `sort_by` / `search_fields` accept these at runtime).
 */
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
