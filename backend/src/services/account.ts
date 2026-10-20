import { sql } from "kysely";
import { db } from "../db/client.js";
import { createCache } from "../utils/cache.js";
import {
  balanceAtCursor,
  createHistoryCursor,
  generateSampleDates,
  resolveChartGranularity,
  type ChartGranularity,
} from "../utils/chartSampling.js";
import { convert, getExchangeRatesInRange } from "../utils/currency.js";
import * as market from "./market.js";
import { getLiabilitySignedBalanceHistory, getLoanBalancesByAccountId } from "./liability.js";
import { getPortfolioPerformance } from "./portfolioPerformance.js";

const preferredCurrencyCache = createCache<string>({
  ttlMs: 60 * 1000,
  maxKeys: 500,
});

export async function getPreferredCurrency(userId: number): Promise<string> {
  const cached = preferredCurrencyCache.get(String(userId));
  if (cached != null) return cached;
  const row = await db()
    .selectFrom("users")
    .select("preferred_currency")
    .where("id", "=", userId)
    .executeTakeFirst();
  const value = (row?.preferred_currency ?? "EUR").toUpperCase();
  preferredCurrencyCache.set(String(userId), value);
  return value;
}

/** Call after updating `users.preferred_currency` so new defaults apply immediately. */
export function invalidatePreferredCurrencyCache(userId: number): void {
  preferredCurrencyCache.delete(String(userId));
}

/** If the client sends a non-empty currency, use it; otherwise use the user's preferred currency. */
export function resolveCurrencyOrPreferred(bodyCurrency: unknown, preferred: string): string {
  if (typeof bodyCurrency !== "string") return preferred;
  const trimmed = bodyCurrency.trim();
  if (trimmed === "") return preferred;
  return trimmed.toUpperCase();
}

/** Resolves `body.currency` for create/update payloads: explicit code wins, else profile preference. */
export async function resolveBodyCurrency(
  body: { currency?: unknown },
  userId: number,
): Promise<string> {
  const preferred = await getPreferredCurrency(userId);
  return resolveCurrencyOrPreferred(body.currency, preferred);
}

export async function calculateBalance(accountId: number): Promise<number> {
  const row = await db()
    .selectFrom("account_balances")
    .select("current_balance")
    .where("account_id", "=", accountId)
    .executeTakeFirst();
  const n = Number(row?.current_balance ?? 0);
  return Math.round(n * 100) / 100;
}

/**
 * Market value for investment accounts. Returns null if not investment or no assets / no price data.
 */
export async function calculateMarketValue(
  accountId: number,
  accountType: string,
): Promise<number | null> {
  if (accountType !== "investment") return null;
  try {
    const rows = await db()
      .selectFrom("asset_balances_by_account")
      .select(["asset_id", "symbol", "quantity"])
      .where("account_id", "=", accountId)
      .execute();
    if (!rows || rows.length === 0) return null;
    const values = await Promise.all(
      rows.map(async (r: { symbol: string; quantity: string | number | null }) => {
        const qty = Number(r.quantity ?? 0);
        const price = await getCurrentPrice(r.symbol);
        return price != null ? qty * price : 0;
      }),
    );
    const total = values.reduce((sum, value) => sum + value, 0);
    const rounded = Math.round(total * 100) / 100;
    return rounded === 0 ? null : rounded;
  } catch {
    return null;
  }
}

async function getCurrentPrice(symbol: string): Promise<number | null> {
  return market.getCurrentPrice(symbol);
}

/**
 * Returns date string (YYYY-MM-DD) -> cumulative balance for the account (from transaction history).
 * Legacy: get_account_balance.
 */
export async function getAccountBalanceHistory(
  userId: number,
  accountId: number,
): Promise<Record<string, number>> {
  const database = db();

  const result = await sql<{ d: string; balance: number }>`
    with daily as (
      select
        transactions.date as d,
        sum(
          case
            -- Same-account investment trades (buy/sell/dividend) are book-neutral here, matching
            -- the account_balances view. Cash flows and P/L are tracked via transfers/income txs;
            -- portfolio performance supplies holdings value for market layers on the wealth chart.
            when transactions.from_account_id = ${accountId} and transactions.to_account_id = ${accountId}
            then 0
            when transactions.type = 'income' and transactions.to_account_id = ${accountId}
            then cast(coalesce(transactions.to_amount, transactions.amount, '0') as real)
            when transactions.type = 'expense' and transactions.from_account_id = ${accountId}
            then -cast(coalesce(transactions.amount, '0') as real)
            when transactions.type = 'transfer' and transactions.to_account_id = ${accountId}
            then cast(coalesce(transactions.to_amount, transactions.amount, '0') as real)
            when transactions.type = 'transfer' and transactions.from_account_id = ${accountId}
            then -cast(coalesce(transactions.amount, '0') as real)
            else 0
          end
        ) as daily_delta
      from transactions
      left join investment_details
        on investment_details.transaction_id = transactions.id
      where transactions.user_id = ${userId}
        and (transactions.from_account_id = ${accountId} or transactions.to_account_id = ${accountId})
      group by transactions.date
    )
    select
      d,
      round(sum(daily_delta) over (order by d rows between unbounded preceding and current row), 2) as balance
    from daily
    order by d asc
  `.execute(database);

  const out: Record<string, number> = {};
  for (const row of result.rows ?? []) {
    const d = String(row.d ?? "").slice(0, 10);
    if (!d) continue;
    out[d] = Math.round(Number(row.balance ?? 0) * 100) / 100;
  }
  return out;
}

export type BalanceOverTimePoint = {
  balance: number;
  balance_by_currency: Record<string, number>;
  /** Book + paper gain on open holdings (aligns with Accounts market value). */
  market_value: number;
  /** Total portfolio return (unrealized + realized incl. dividends). */
  investment_gain: number;
  /** Paper gain on open positions. */
  investment_gain_unrealized: number;
  /** Locked-in: realized sells + dividends (total − unrealized). */
  investment_gain_realized: number;
};

type InvestmentGainByDate = {
  total: number;
  unrealized: number;
  realized: number;
};

function investmentGainFromPerfPoint(point: {
  total_gains?: number;
  absolute_gain?: number;
  unrealized_gain?: number;
  realized_gain?: number;
}): InvestmentGainByDate {
  const total = Number(point.total_gains ?? point.absolute_gain ?? 0);
  const unrealized = Number(point.unrealized_gain ?? total);
  const realized = Number(point.realized_gain ?? total - unrealized);
  return { total, unrealized, realized };
}

/** Balance of an account on `dateKey` (last known on or before that date). */
export function balanceOnOrBefore(history: Record<string, number>, dateKey: string): number {
  const cursor = createHistoryCursor(history);
  return balanceAtCursor(cursor, dateKey);
}

export function balancePointGains(
  gainByDate: Record<string, InvestmentGainByDate>,
  dateKey: string,
): Pick<
  BalanceOverTimePoint,
  "investment_gain" | "investment_gain_unrealized" | "investment_gain_realized"
> {
  const g = gainByDate[dateKey];
  const total = g?.total ?? 0;
  const unrealized = g?.unrealized ?? total;
  const realized = g?.realized ?? total - unrealized;
  return {
    investment_gain: Math.round(total * 100) / 100,
    investment_gain_unrealized: Math.round(unrealized * 100) / 100,
    investment_gain_realized: Math.round(realized * 100) / 100,
  };
}

function buildBalanceOverTimePoint(
  balance: number,
  balanceByCurrency: Record<string, number>,
  gainByDate: Record<string, InvestmentGainByDate>,
  dateKey: string,
): BalanceOverTimePoint {
  const gains = balancePointGains(gainByDate, dateKey);
  return {
    balance,
    balance_by_currency: balanceByCurrency,
    ...gains,
    market_value: Math.round((balance + gains.investment_gain_unrealized) * 100) / 100,
  };
}

/**
 * Balance over time: date (YYYY-MM-DD) -> { balance, balance_by_currency, investment_gain }.
 * Legacy: sum_accounts_balances_over_days. accountId optional = all accounts.
 */
export type SumAccountsBalancesOptions = {
  /**
   * When false, loan accounts are omitted (gross assets only). Default true = full net worth including debt.
   */
  includeDebt?: boolean;
  /**
   * Chart sampling: `day` | `week` | `month`, or omit/`auto` to pick from range length.
   */
  granularity?: ChartGranularity | "auto";
};

export async function sumAccountsBalancesOverDays(
  userId: number,
  startDate: string,
  endDate: string,
  accountId?: number,
  options?: SumAccountsBalancesOptions,
): Promise<Record<string, BalanceOverTimePoint>> {
  const includeDebt = options?.includeDebt ?? true;
  const requestedGranularity = options?.granularity;
  if (accountId != null) {
    const database = db();
    const accountRow = await database
      .selectFrom("accounts")
      .select(["id", "currency", "type"])
      .where("user_id", "=", userId)
      .where("id", "=", accountId)
      .executeTakeFirst();

    if (!accountRow) {
      return {};
    }

    const accountType = (accountRow as { type?: string }).type ?? "";
    const accountCurrency = (accountRow.currency ?? "EUR").toUpperCase();
    const preferred = await getPreferredCurrency(userId);
    let history: Record<string, number> = {};

    const wealthTypes = new Set(["checking", "savings", "investment", "loan"]);
    if (accountType === "loan") {
      const liability = await database
        .selectFrom("liabilities")
        .select(["id"])
        .where("user_id", "=", userId)
        .where("account_id", "=", accountId)
        .executeTakeFirst();
      if (liability) {
        history = await getLiabilitySignedBalanceHistory(userId, liability.id);
      } else {
        history = await getAccountBalanceHistory(userId, accountId);
      }
    } else if (wealthTypes.has(accountType)) {
      history = await getAccountBalanceHistory(userId, accountId);
    } else if (accountType === "expense" || accountType === "income") {
      const rows = await database
        .selectFrom("transactions")
        .select(["date", "type", "amount", "from_account_id", "to_account_id"])
        .where("user_id", "=", userId)
        .where((eb) =>
          accountType === "expense"
            ? eb.and([eb("to_account_id", "=", accountId), eb("type", "=", "expense")])
            : eb.and([eb("from_account_id", "=", accountId), eb("type", "=", "income")]),
        )
        .execute();

      const dailyDelta: Record<string, number> = {};
      for (const row of rows) {
        const d = String(row.date).slice(0, 10);
        const amount = Number(row.amount ?? 0);
        dailyDelta[d] = (dailyDelta[d] ?? 0) + amount;
      }
      const dates = Object.keys(dailyDelta).sort();
      let cumulative = 0;
      for (const d of dates) {
        cumulative += dailyDelta[d] ?? 0;
        history[d] = Math.round(cumulative * 100) / 100;
      }
    } else {
      return {};
    }
    const historyDates = Object.keys(history).sort();

    if (historyDates.length === 0) {
      const snapshot = await calculateBalance(accountId);
      if (snapshot === 0) {
        return {};
      }
      const key = endDate;
      history[key] = snapshot;
      historyDates.push(key);
    }

    const histStart = historyDates[0]!;
    const histEnd = historyDates[historyDates.length - 1]!;
    const rangeStart: string = histStart > startDate ? histStart : startDate;
    const rangeEnd: string = histEnd < endDate ? histEnd : endDate;

    if (rangeStart > rangeEnd) {
      return {};
    }

    const granularity = resolveChartGranularity(rangeStart, rangeEnd, requestedGranularity);
    const sampleDates = generateSampleDates(rangeStart, rangeEnd, granularity);

    const perfPromise =
      accountType === "investment"
        ? getPortfolioPerformance(userId, undefined, accountId, {
            sampleDates,
            includeAssets: false,
          }).catch(() => null)
        : Promise.resolve(null);
    const ratesPromise =
      accountCurrency === preferred
        ? Promise.resolve(null as Record<string, number> | null)
        : getExchangeRatesInRange(accountCurrency, preferred, rangeStart, rangeEnd);
    const [rates, perf] = await Promise.all([ratesPromise, perfPromise]);

    const investmentGainByDate: Record<string, InvestmentGainByDate> = {};
    if (perf) {
      for (const point of perf.data_points ?? []) {
        const d = String(point.date ?? "").slice(0, 10);
        if (d >= rangeStart && d <= rangeEnd) {
          investmentGainByDate[d] = investmentGainFromPerfPoint(point);
        }
      }
    }

    const output: Record<string, BalanceOverTimePoint> = {};
    const cursor = createHistoryCursor(history);
    let lastGain: InvestmentGainByDate = { total: 0, unrealized: 0, realized: 0 };

    for (const key of sampleDates) {
      const lastBalance = balanceAtCursor(cursor, key);
      let signedBalance = lastBalance;
      if (accountType === "income") {
        signedBalance = -lastBalance;
      } else if (accountType === "expense") {
        signedBalance = lastBalance;
      }
      const rate = rates?.[key] ?? rates?.[rangeStart] ?? rates?.[rangeEnd] ?? 1;
      const balancePref = signedBalance * rate;
      if (investmentGainByDate[key]) lastGain = investmentGainByDate[key]!;
      else investmentGainByDate[key] = lastGain;

      output[key] = buildBalanceOverTimePoint(
        Math.round(balancePref * 100) / 100,
        { [accountCurrency]: Math.round(signedBalance * 100) / 100 },
        investmentGainByDate,
        key,
      );
    }

    return output;
  }

  const database = db();
  const includedTypes = new Set<string>(
    includeDebt
      ? ["checking", "savings", "investment", "loan"]
      : ["checking", "savings", "investment"],
  );

  const preferred = await getPreferredCurrency(userId);
  const accounts = await database
    .selectFrom("accounts")
    .select(["id", "type", "currency"])
    .where("user_id", "=", userId)
    .execute();

  const wealthAccounts = accounts.filter((a) => includedTypes.has(a.type));
  if (wealthAccounts.length === 0) return {};

  const loanAccounts = wealthAccounts.filter((a) => a.type === "loan");
  const liabilityRows =
    loanAccounts.length > 0
      ? await database
          .selectFrom("liabilities")
          .select(["id", "account_id"])
          .where("user_id", "=", userId)
          .where(
            "account_id",
            "in",
            loanAccounts.map((a) => a.id),
          )
          .execute()
      : [];
  const liabilityIdByAccountId = new Map<number, number>();
  for (const row of liabilityRows) {
    if (row.account_id != null) liabilityIdByAccountId.set(row.account_id, row.id);
  }
  const [loanByAccount, loanHistories] = await Promise.all([
    getLoanBalancesByAccountId(userId),
    Promise.all(
      [...liabilityIdByAccountId.entries()].map(async ([accountId, liabilityId]) => {
        const history = await getLiabilitySignedBalanceHistory(userId, liabilityId);
        return [accountId, history] as const;
      }),
    ),
  ]);
  const loanHistoryByAccountId = new Map(loanHistories);

  const accountHistories = await Promise.all(
    wealthAccounts.map(async (a) => {
      if (a.type === "loan" && loanHistoryByAccountId.has(a.id)) {
        return {
          id: a.id,
          currency: (a.currency ?? preferred).toUpperCase(),
          history: loanHistoryByAccountId.get(a.id)!,
        };
      }
      const history = await getAccountBalanceHistory(userId, a.id);
      if (Object.keys(history).length === 0) {
        const snapshot = await calculateBalance(a.id);
        if (snapshot !== 0) {
          history[endDate] = snapshot;
        }
      }
      return {
        id: a.id,
        currency: (a.currency ?? preferred).toUpperCase(),
        history,
      };
    }),
  );

  const snapshotBalances = await Promise.all(
    wealthAccounts.map(async (a) => {
      if (a.type === "loan" && loanByAccount.has(a.id)) {
        return loanByAccount.get(a.id)!;
      }
      return calculateBalance(a.id);
    }),
  );

  let minDate = endDate;
  let maxDate = startDate;
  for (const { history } of accountHistories) {
    for (const d of Object.keys(history)) {
      if (d < minDate) minDate = d;
      if (d > maxDate) maxDate = d;
    }
  }
  if (minDate > maxDate) return {};

  const rangeStart = minDate > startDate ? minDate : startDate;
  const rangeEnd = maxDate < endDate ? maxDate : endDate;

  const granularity = resolveChartGranularity(rangeStart, rangeEnd, requestedGranularity);
  const sampleDates = generateSampleDates(rangeStart, rangeEnd, granularity);

  const currenciesNeeded = new Set(
    accountHistories.map((h) => h.currency).filter((c) => c !== preferred),
  );
  const hasInvestmentAccounts = wealthAccounts.some((a) => a.type === "investment");
  const perfPromise = hasInvestmentAccounts
    ? getPortfolioPerformance(userId, undefined, accountId, {
        sampleDates,
        includeAssets: false,
      }).catch(() => null)
    : Promise.resolve(null);

  const rateByDateAndCurrency: Record<string, Record<string, number>> = {};
  await Promise.all(
    [...currenciesNeeded].map(async (c) => {
      rateByDateAndCurrency[c] = await getExchangeRatesInRange(c, preferred, rangeStart, rangeEnd);
    }),
  );

  const investmentGainByDate: Record<string, InvestmentGainByDate> = {};
  const perf = await perfPromise;
  if (perf) {
    for (const point of perf.data_points ?? []) {
      const d = String(point.date ?? "").slice(0, 10);
      if (d >= rangeStart && d <= rangeEnd) {
        investmentGainByDate[d] = investmentGainFromPerfPoint(point);
      }
    }
  }

  const output: Record<string, BalanceOverTimePoint> = {};
  // Live snapshots only when the chart ends on/after today — never for historical ends.
  const todayKey = new Date().toISOString().slice(0, 10);
  const cursors = accountHistories.map(({ history }) => createHistoryCursor(history));
  let lastGain: InvestmentGainByDate = { total: 0, unrealized: 0, realized: 0 };

  for (const key of sampleDates) {
    let balancePref = 0;
    const byCurrency: Record<string, number> = {};
    const useLiveSnapshots = key === rangeEnd && rangeEnd >= todayKey;

    for (let i = 0; i < accountHistories.length; i++) {
      const { currency } = accountHistories[i]!;
      const bal = useLiveSnapshots ? snapshotBalances[i]! : balanceAtCursor(cursors[i]!, key);
      const rates = rateByDateAndCurrency[currency];
      const rate = rates?.[key] ?? rates?.[rangeStart] ?? rates?.[rangeEnd] ?? 1;
      balancePref += bal * rate;
      byCurrency[currency] = Math.round(((byCurrency[currency] ?? 0) + bal) * 100) / 100;
    }

    if (investmentGainByDate[key]) lastGain = investmentGainByDate[key]!;
    else investmentGainByDate[key] = lastGain;

    output[key] = buildBalanceOverTimePoint(
      Math.round(balancePref * 100) / 100,
      byCurrency,
      investmentGainByDate,
      key,
    );
  }

  return output;
}

export interface EnrichedAccount {
  id: number;
  user_id: number;
  name: string;
  type: string;
  bank_id: number;
  currency: string;
  balance: number;
  balance_preferred: number;
  market_value: number | null;
  [k: string]: unknown;
}

export async function enrichAccount(
  row: Record<string, unknown>,
  userId: number,
): Promise<EnrichedAccount> {
  const accountId = row.id as number;
  const balance = await calculateBalance(accountId);
  const preferred = await getPreferredCurrency(userId);
  const currency = (row.currency as string) ?? preferred;
  const balance_preferred = await convert(balance, currency, preferred);
  const market_value = await calculateMarketValue(accountId, (row.type as string) ?? "");
  return {
    ...row,
    currency,
    balance,
    balance_preferred,
    market_value,
  } as EnrichedAccount;
}

/**
 * Batch-enrich accounts for list endpoints: one preferred-currency fetch, one balance query,
 * one asset query for investment accounts, and one batch of market prices for unique symbols.
 * Use this instead of Promise.all(items.map(enrichAccount)) to avoid N+1 queries and API calls.
 */
export async function enrichAccountsBatch(
  rows: Record<string, unknown>[],
  userId: number,
): Promise<EnrichedAccount[]> {
  if (rows.length === 0) return [];
  const accountIds = rows.map((r) => r.id as number);

  const [preferred, balanceRows, assetRows] = await Promise.all([
    getPreferredCurrency(userId),
    db()
      .selectFrom("account_balances")
      .select(["account_id", "current_balance"])
      .where("account_id", "in", accountIds)
      .execute(),
    (async () => {
      const investmentIds = rows
        .filter((r) => (r.type as string) === "investment")
        .map((r) => r.id as number);
      if (investmentIds.length === 0) return [];
      return db()
        .selectFrom("asset_balances_by_account")
        .select(["account_id", "symbol", "quantity"])
        .where("account_id", "in", investmentIds)
        .execute();
    })(),
  ]);

  const balanceByAccountId = new Map<number, number>();
  for (const r of balanceRows ?? []) {
    balanceByAccountId.set(
      (r as { account_id: number }).account_id,
      Number((r as { current_balance: unknown }).current_balance ?? 0),
    );
  }

  const symbolsByAccountId = new Map<number, Array<{ symbol: string; quantity: number }>>();
  const uniqueSymbols = new Set<string>();
  for (const r of assetRows ?? []) {
    const row = r as {
      account_id: number;
      symbol: string;
      quantity: string | number | null;
    };
    const accId = row.account_id;
    const symbol = String(row.symbol ?? "").trim();
    const qty = Number(row.quantity ?? 0);
    if (!symbol) continue;
    uniqueSymbols.add(symbol);
    const list = symbolsByAccountId.get(accId) ?? [];
    list.push({ symbol, quantity: qty });
    symbolsByAccountId.set(accId, list);
  }

  const symbolList = [...uniqueSymbols];
  const prices = await Promise.all(symbolList.map((s) => market.getCurrentPrice(s)));
  const priceBySymbol = new Map<string, number>();
  for (let i = 0; i < symbolList.length; i++) {
    const symbol = symbolList[i];
    if (!symbol) continue;
    const p = prices[i];
    if (p != null) priceBySymbol.set(symbol, p);
  }

  const marketValueByAccountId = new Map<number, number>();
  for (const [accId, list] of symbolsByAccountId) {
    let total = 0;
    for (const { symbol, quantity } of list) {
      const price = priceBySymbol.get(symbol);
      if (price != null) total += quantity * price;
    }
    if (total > 0) marketValueByAccountId.set(accId, Math.round(total * 100) / 100);
  }

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const accountId = row.id as number;
      const balance = balanceByAccountId.get(accountId) ?? 0;
      const currency = (row.currency as string) ?? preferred;
      const balance_preferred = await convert(balance, currency, preferred);
      const market_value =
        (row.type as string) === "investment"
          ? (marketValueByAccountId.get(accountId) ?? null)
          : null;
      return {
        ...row,
        currency,
        balance: Math.round(balance * 100) / 100,
        balance_preferred,
        market_value,
      } as EnrichedAccount;
    }),
  );
  return enriched;
}
