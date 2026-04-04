import type {
  Account,
  Asset,
  Bank,
  Investment,
  PaginatedResponse,
  RefundGroup,
  RefundItem,
  Transaction,
} from "@/types";
import type { BalanceHistoryResponse } from "@/types/account";
import { buildListQueryParams } from "./apiUtils";
import { unwrapEden } from "./edenUnwrap";
import { wealthApi } from "./wealthApi";

const bigList = () => buildListQueryParams({ per_page: 1000 }) as never;
const hugeList = () => buildListQueryParams({ per_page: 10000 }) as never;

/** Shared Eden list helpers for export/import and bulk flows. */
export async function edenListBanks(): Promise<PaginatedResponse<Bank>> {
  return unwrapEden<PaginatedResponse<Bank>>(
    wealthApi.banks.get({ query: bigList() }) as Promise<unknown>,
  );
}

export async function edenListAccounts(): Promise<PaginatedResponse<Account>> {
  return unwrapEden<PaginatedResponse<Account>>(
    wealthApi.accounts.get({ query: bigList() }) as Promise<unknown>,
  );
}

export async function edenListAssets(): Promise<PaginatedResponse<Asset>> {
  return unwrapEden<PaginatedResponse<Asset>>(
    wealthApi.assets.get({ query: bigList() }) as Promise<unknown>,
  );
}

export async function edenListTransactions(): Promise<PaginatedResponse<Transaction>> {
  return unwrapEden<PaginatedResponse<Transaction>>(
    wealthApi.transactions.get({ query: hugeList() }) as Promise<unknown>,
  );
}

export async function edenListInvestments(): Promise<PaginatedResponse<Investment>> {
  return unwrapEden<PaginatedResponse<Investment>>(
    wealthApi.investments.get({ query: bigList() }) as Promise<unknown>,
  );
}

export async function edenListRefundGroups(): Promise<PaginatedResponse<RefundGroup>> {
  return unwrapEden<PaginatedResponse<RefundGroup>>(
    wealthApi.refund_groups.get({ query: bigList() }) as Promise<unknown>,
  );
}

export async function edenListRefundItems(): Promise<PaginatedResponse<RefundItem>> {
  return unwrapEden<PaginatedResponse<RefundItem>>(
    wealthApi.refund_items.get({ query: bigList() }) as Promise<unknown>,
  );
}

export async function edenBudgetCategories(): Promise<unknown> {
  return unwrapEden<unknown>(wealthApi.budgets.categories.get() as Promise<unknown>);
}

export async function edenBalanceOverTime(
  startDate: string,
  endDate: string,
): Promise<BalanceHistoryResponse> {
  return unwrapEden<BalanceHistoryResponse>(
    wealthApi.accounts.balance_over_time.get({
      query: { start_date: startDate, end_date: endDate },
    }) as Promise<unknown>,
  );
}

export async function edenDeleteAsset(assetId: number): Promise<unknown> {
  return unwrapEden(wealthApi.assets({ id: String(assetId) }).delete() as Promise<unknown>);
}
