import type { Treaty } from "@elysiajs/eden";
import { wealthApi } from "./wealthApi";

/**
 * Entity types inferred from the Eden Treaty client + backend `App` schema
 * (`wealth-backend-typescript` `src/app.ts`; optional `build:types` → `dist/` for emit).
 *
 * Prefer these over hand-written duplicates in `types/` when the route has a
 * precise 200-response schema.
 */

type BanksListPayload = Treaty.Data<ReturnType<typeof wealthApi.banks.get>>;

/** Row from `GET /banks` `items[]` / `GET /banks/:id` — matches backend schema. */
export type Bank = BanksListPayload extends { items: infer Items extends readonly unknown[] }
  ? Items[number]
  : never;

/**
 * `POST /banks` body — inferred from the treaty client (`wealthApi` is typed loosely to avoid TS2344).
 */
type WealthApi = typeof wealthApi;
type BanksPost = WealthApi["banks"] extends {
  post: infer P extends (...args: never[]) => unknown;
}
  ? P
  : never;
type BanksPostFirstArg = Parameters<BanksPost>[0];
export type BankCreateBody = BanksPostFirstArg extends { body: infer B } ? B : BanksPostFirstArg;

/** Query for `GET /banks` — from the treaty client. */
type BanksGet = WealthApi["banks"] extends {
  get: infer G extends (...args: never[]) => unknown;
}
  ? G
  : never;
/** GET may use optional `options`; `query` lives inside. */
type BanksGetArgs = NonNullable<Parameters<BanksGet>[0]>;
export type BankQueryParams = BanksGetArgs extends { query?: infer Q }
  ? Q
  : BanksGetArgs extends { query: infer Q }
    ? Q
    : never;

// --- Accounts (GET list / POST / query) ---

type AccountsListPayload = Treaty.Data<ReturnType<typeof wealthApi.accounts.get>>;

/** Row from `GET /accounts` `items[]` / `GET /accounts/:id`. */
export type Account = AccountsListPayload extends { items: infer Items extends readonly unknown[] }
  ? Items[number]
  : never;

type AccountsPost = WealthApi["accounts"] extends {
  post: infer P extends (...args: never[]) => unknown;
}
  ? P
  : never;
type AccountsPostFirstArg = Parameters<AccountsPost>[0];
export type AccountCreateBody = AccountsPostFirstArg extends { body: infer B }
  ? B
  : AccountsPostFirstArg;

type AccountsGet = WealthApi["accounts"] extends {
  get: infer G extends (...args: never[]) => unknown;
}
  ? G
  : never;
type AccountsGetArgs = NonNullable<Parameters<AccountsGet>[0]>;
/** `GET /accounts` query — matches `tAccountsListQuerySchema` in the backend. */
export type AccountQueryParams = AccountsGetArgs extends { query?: infer Q }
  ? Q
  : AccountsGetArgs extends { query: infer Q }
    ? Q
    : never;

/** `GET /accounts/balance_over_time` payload (date → point). */
type AccountsBalanceOverTimeData = Treaty.Data<
  ReturnType<typeof wealthApi.accounts.balance_over_time.get>
>;
export type BalanceHistoryResponse = Exclude<AccountsBalanceOverTimeData, { error: string }>;
