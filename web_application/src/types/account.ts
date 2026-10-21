export type {
  Account,
  AccountCreateBody,
  AccountQueryParams,
  BalanceHistoryResponse,
  WealthSummary,
} from "@/api/edenDerivedTypes";

/** One row from `useAccountBalanceHistory` / `useWealthOverTime` after date-key expansion. */
export interface BalanceHistoryPoint {
  date: string;
  value: number;
  balance: number;
  balance_by_currency?: Record<string, number>;
  investment_gain: number;
  investment_gain_unrealized?: number;
  investment_gain_realized?: number;
}
