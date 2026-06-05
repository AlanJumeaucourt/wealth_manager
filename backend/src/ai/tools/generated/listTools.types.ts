/** Generated from AGENT_LIST_ENDPOINTS — do not edit by hand. */
export type ListToolName =
  | "list_banks"
  | "list_accounts"
  | "list_assets"
  | "list_refund_groups"
  | "list_refund_items"
  | "list_transactions"
  | "list_liabilities"
  | "list_liability_payments"
  | "list_budgets"
  | "list_budgets_legacy"
  | "list_investments"
  | "list_potential_refunds"
  | "list_liabilities_payment_status"
  | "list_liabilities_schedule_payments";

export const LIST_TOOL_NAMES = [
  "list_banks",
  "list_accounts",
  "list_assets",
  "list_refund_groups",
  "list_refund_items",
  "list_transactions",
  "list_liabilities",
  "list_liability_payments",
  "list_budgets",
  "list_budgets_legacy",
  "list_investments",
  "list_potential_refunds",
  "list_liabilities_payment_status",
  "list_liabilities_schedule_payments",
] as const satisfies readonly ListToolName[];
