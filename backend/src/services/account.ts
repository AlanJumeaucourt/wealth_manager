import { sql } from "kysely";
import { db } from "../db/client.js";
import { createCache } from "../utils/cache.js";
import { convert, getExchangeRatesInRange } from "../utils/currency.js";
import * as market from "./market.js";
import { getPortfolioPerformance } from "./portfolioPerformance.js";

const preferredCurrencyCache = createCache<string>({
  ttlMs: 60 * 1000,
  maxKeys: 500,
});

/** Generate an array of YYYY-MM-DD strings from start to end (inclusive). */
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let [y, m, d] = startDate.split("-").map(Number) as [number, number, number];
  const endVal = endDate;
  const daysInMonth = (yr: number, mo: number) => new Date(yr, mo, 0).getDate();
  for (;;) {
    const key = `${y}-${m < 10 ? "0" : ""}${m}-${d < 10 ? "0" : ""}${d}`;
    if (key > endVal) break;
    dates.push(key);
    d++;
    if (d > daysInMonth(y, m)) {
      d = 1;
      m++;
    }
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return dates;
}

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
            when transactions.from_account_id = ${accountId}
              and transactions.to_account_id = ${accountId}
              and investment_details.investment_type is not null
            then
              case investment_details.investment_type
                when 'Buy' then -cast(coalesce(investment_details.total_paid, transactions.amount, '0') as real)
                when 'Sell' then cast(coalesce(nullif(transactions.to_amount, '0'), transactions.amount, '0') as real)
                when 'Dividend' then cast(coalesce(nullif(transactions.to_amount, '0'), transactions.amount, '0') as real)
                else 0
              end
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
  investment_gain: number;
};

/**
 * Balance over time: date (YYYY-MM-DD) -> { balance, balance_by_currency, investment_gain }.
 * Legacy: sum_accounts_balances_over_days. accountId optional = all accounts.
 */
export type SumAccountsBalancesOptions = {
  /**
   * When false, loan accounts are omitted (gross assets only). Default true = full net worth including debt.
   */
  includeDebt?: boolean;
};

export async function sumAccountsBalancesOverDays(
  userId: number,
  startDate: string,
  endDate: string,
  accountId?: number,
  options?: SumAccountsBalancesOptions,
): Promise<Record<string, BalanceOverTimePoint>> {
  const includeDebt = options?.includeDebt ?? true;
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
    if (wealthTypes.has(accountType)) {
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

    const perfPromise =
      accountType === "investment"
        ? getPortfolioPerformance(userId, undefined, accountId).catch(() => null)
        : Promise.resolve(null);
    const ratesPromise = getExchangeRatesInRange(accountCurrency, preferred, rangeStart, rangeEnd);
    const [rates, perf] = await Promise.all([ratesPromise, perfPromise]);

    const investmentGainByDate: Record<string, number> = {};
    if (perf) {
      for (const point of perf.data_points ?? []) {
        const d = String(point.date ?? "").slice(0, 10);
        if (d >= rangeStart && d <= rangeEnd) {
          investmentGainByDate[d] = Number(point.total_gains ?? point.absolute_gain ?? 0);
        }
      }
    }

    const output: Record<string, BalanceOverTimePoint> = {};
    const startTime = new Date(rangeStart + "T00:00:00Z").getTime();
    const endTime = new Date(rangeEnd + "T00:00:00Z").getTime();
    let lastBalance = 0;

    for (let t = startTime; t <= endTime; t += 86400000) {
      const key = new Date(t).toISOString().slice(0, 10);
      if (history[key] != null) {
        lastBalance = history[key];
      }
      let signedBalance = lastBalance;
      if (accountType === "income") {
        signedBalance = -lastBalance;
      } else if (accountType === "expense") {
        signedBalance = lastBalance;
      }
      const rate = rates[key] ?? rates[rangeStart] ?? rates[rangeEnd] ?? 1;
      const balancePref = signedBalance * rate;

      output[key] = {
        balance: Math.round(balancePref * 100) / 100,
        balance_by_currency: {
          [accountCurrency]: Math.round(signedBalance * 100) / 100,
        },
        investment_gain: Math.round((investmentGainByDate[key] ?? 0) * 100) / 100,
      };
    }

    return output;
  }

  const database = db();
  const includedTypes = new Set<string>(
    includeDebt
      ? ["checking", "savings", "investment", "loan"]
      : ["checking", "savings", "investment"],
  );
  const preferredPromise = getPreferredCurrency(userId);
  const accountsPromise = database
    .selectFrom("accounts")
    .select(["id", "type", "currency"])
    .where("user_id", "=", userId)
    .execute();
  type TxRow = {
    date: string;
    type: string;
    amount: string;
    to_amount: string | null;
    from_account_id: number;
    to_account_id: number;
  };

  const accountFilter =
    accountId != null
      ? sql`and (from_account_id = ${accountId} or to_account_id = ${accountId})`
      : sql``;

  const wealthAccountTypesFilter = includeDebt
    ? sql`and type in ('checking','savings','investment','loan')`
    : sql`and type in ('checking','savings','investment')`;

  const txRowsPromise = sql<TxRow>`
    with wa_ids(id) as (
      select id from accounts
      where user_id = ${userId}
        ${wealthAccountTypesFilter}
    )
    select
      date,
      type,
      cast(sum(cast(amount as real)) as text) as amount,
      cast(sum(cast(coalesce(to_amount, amount) as real)) as text) as to_amount,
      from_account_id,
      to_account_id
    from transactions
    where user_id = ${userId}
      and date <= ${endDate}
      and (from_account_id in (select id from wa_ids)
           or to_account_id in (select id from wa_ids))
      ${accountFilter}
    group by date, type, from_account_id, to_account_id
  `
    .execute(database)
    .then((res) => res.rows as TxRow[]);
  const [preferred, accounts, txRows] = await Promise.all([
    preferredPromise,
    accountsPromise,
    txRowsPromise,
  ]);
  if (txRows.length === 0) return {};
  let minDate = "9999-12-31";
  let maxDate = "0000-01-01";
  for (const row of txRows) {
    const d = row.date;
    if (!d) continue;
    if (d < minDate) minDate = d;
    if (d > maxDate) maxDate = d;
  }
  if (minDate > maxDate) return {};
  const accountMap = new Map(
    accounts.map((a) => [a.id, { type: a.type, currency: (a.currency ?? "EUR").toUpperCase() }]),
  );

  const rangeStart = minDate > startDate ? minDate : startDate;
  const rangeEnd = maxDate < endDate ? maxDate : endDate;
  const currenciesNeeded = new Set<string>();
  for (const a of accounts) {
    if (includedTypes.has(a.type)) {
      const c = (a.currency ?? "EUR").toUpperCase();
      currenciesNeeded.add(c);
    }
  }
  const hasInvestmentAccounts = accounts.some(
    (a) => includedTypes.has(a.type) && a.type === "investment",
  );
  const perfPromise = hasInvestmentAccounts
    ? getPortfolioPerformance(userId, undefined, accountId).catch(() => null)
    : Promise.resolve(null);
  const rateByDateAndCurrency: Record<string, Record<string, number>> = {};
  await Promise.all(
    [...currenciesNeeded].map(async (c) => {
      const rates = await getExchangeRatesInRange(c, preferred, rangeStart, rangeEnd);
      rateByDateAndCurrency[c] = rates;
    }),
  );

  const dailyDeltasByCurrency: Record<string, Record<string, number>> = {};
  const dailyDeltasPref: Record<string, number> = {};
  const investmentGainByDate: Record<string, number> = {};

  for (const row of txRows) {
    const d = String(row.date).slice(0, 10);
    const tType = row.type;
    const fromAcc = accountMap.get(row.from_account_id);
    const toAcc = accountMap.get(row.to_account_id);
    const fromType = fromAcc?.type ?? "";
    const toType = toAcc?.type ?? "";
    const fromCurrency = (fromAcc?.currency ?? "EUR").toUpperCase();
    const toCurrency = (toAcc?.currency ?? "EUR").toUpperCase();
    const amountVal = Number(row.amount ?? 0);
    const creditedVal = Number(row.to_amount ?? row.amount ?? 0);
    const ratesFrom = rateByDateAndCurrency[fromCurrency];
    const ratesTo = rateByDateAndCurrency[toCurrency];
    const rateFrom = ratesFrom?.[d] ?? ratesFrom?.[rangeStart] ?? ratesFrom?.[rangeEnd] ?? 1;
    const rateTo = ratesTo?.[d] ?? ratesTo?.[rangeStart] ?? ratesTo?.[rangeEnd] ?? 1;

    if (!dailyDeltasByCurrency[d]) dailyDeltasByCurrency[d] = {};
    const byCurr = dailyDeltasByCurrency[d];

    let deltaPref = 0;
    if (tType === "income") {
      if (includedTypes.has(toType)) {
        deltaPref = creditedVal * rateTo;
        byCurr[toCurrency] = (byCurr[toCurrency] ?? 0) + creditedVal;
      }
    } else if (tType === "expense") {
      if (includedTypes.has(fromType)) {
        deltaPref = -amountVal * rateFrom;
        byCurr[fromCurrency] = (byCurr[fromCurrency] ?? 0) - amountVal;
      }
    } else if (tType === "transfer") {
      const fromIn = includedTypes.has(fromType);
      const toIn = includedTypes.has(toType);
      if (toIn && !fromIn) {
        deltaPref = creditedVal * rateTo;
        byCurr[toCurrency] = (byCurr[toCurrency] ?? 0) + creditedVal;
      } else if (fromIn && !toIn) {
        deltaPref = -amountVal * rateFrom;
        byCurr[fromCurrency] = (byCurr[fromCurrency] ?? 0) - amountVal;
      } else if (fromIn && toIn) {
        byCurr[fromCurrency] = (byCurr[fromCurrency] ?? 0) - amountVal;
        byCurr[toCurrency] = (byCurr[toCurrency] ?? 0) + creditedVal;
      }
    }
    dailyDeltasPref[d] = (dailyDeltasPref[d] ?? 0) + deltaPref;
  }

  const perf = await perfPromise;
  if (perf) {
    for (const point of perf.data_points ?? []) {
      const d = String(point.date ?? "").slice(0, 10);
      if (d >= rangeStart && d <= rangeEnd) {
        investmentGainByDate[d] = Number(point.total_gains ?? point.absolute_gain ?? 0);
      }
    }
  }

  const output: Record<string, BalanceOverTimePoint> = {};
  let cumulativePref = 0;
  const cumulativeByCurrency: Record<string, number> = {};

  const allDateKeys = generateDateRange(minDate, rangeEnd);
  const rangeStartIdx = allDateKeys.indexOf(rangeStart);
  const preRangeEnd = rangeStartIdx > 0 ? rangeStartIdx : 0;

  for (let i = 0; i < preRangeEnd; i++) {
    const key = allDateKeys[i]!;
    const dayCurr = dailyDeltasByCurrency[key];
    if (dayCurr) {
      for (const c in dayCurr) {
        cumulativeByCurrency[c] = (cumulativeByCurrency[c] ?? 0) + dayCurr[c]!;
      }
    }
    cumulativePref += dailyDeltasPref[key] ?? 0;
  }

  for (let i = preRangeEnd; i < allDateKeys.length; i++) {
    const key = allDateKeys[i]!;
    if (key > rangeEnd) break;
    const dayCurr = dailyDeltasByCurrency[key];
    if (dayCurr) {
      for (const c in dayCurr) {
        cumulativeByCurrency[c] = (cumulativeByCurrency[c] ?? 0) + dayCurr[c]!;
      }
    }
    cumulativePref += dailyDeltasPref[key] ?? 0;
    const byCurrency: Record<string, number> = {};
    for (const c in cumulativeByCurrency) {
      byCurrency[c] = Math.round(cumulativeByCurrency[c]! * 100) / 100;
    }
    output[key] = {
      balance: Math.round(cumulativePref * 100) / 100,
      balance_by_currency: byCurrency,
      investment_gain: Math.round((investmentGainByDate[key] ?? 0) * 100) / 100,
    };
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
