import { Account } from "./types"

export const ACCOUNT_TYPE_ICONS: Record<Account["type"], string> = {
  checking: "💳",
  expense: "📤",
  income: "📥",
  investment: "📈",
  savings: "🏦",
  loan: "💰",
}

export const ACCOUNT_TYPE_LABELS: Record<Account["type"], string> = {
  checking: "Checking",
  expense: "Expenses",
  income: "Income",
  investment: "Investments",
  savings: "Savings",
  loan: "Loan",
}
