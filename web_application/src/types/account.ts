export type {
  Account,
  AccountCreateBody,
  AccountQueryParams,
  BalanceHistoryResponse,
} from "@/api/edenDerivedTypes";

/** One row from `useAccountBalanceHistory` / `useWealthOverTime` after date-key expansion. */
export interface BalanceHistoryPoint {
  date: string;
  value: number;
  balance: number;
  balance_by_currency?: Record<string, number>;
  investment_gain: number;
}
