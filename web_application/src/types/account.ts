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

export interface WealthSummary {
  preferred_currency: string;
  book: {
    net_with_debt: number;
    net_without_debt: number;
    gross_with_debt: number;
    gross_without_debt: number;
  };
  market: {
    net_with_debt: number;
    net_without_debt: number;
    gross_with_debt: number;
    gross_without_debt: number;
  };
  breakdown: {
    checking: number;
    savings: number;
    loans: number;
    investments_book_value: number;
    investments_market_value: number;
    investments_unrealized_pl: number;
  };
}
