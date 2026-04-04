/** Known account kinds for tabs / labels (API `Account["type"]` is a string). */
export type AccountType =
  | "checking"
  | "expense"
  | "income"
  | "investment"
  | "savings"
  | "loan"
  | "asset";

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  checking: "💳",
  expense: "📤",
  income: "📥",
  investment: "📈",
  savings: "🏦",
  loan: "💰",
  asset: "📊",
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  expense: "Expenses",
  income: "Income",
  investment: "Investments",
  savings: "Savings",
  loan: "Loan",
  asset: "Asset",
};
