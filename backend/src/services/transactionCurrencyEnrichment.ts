import { db } from "../db/client.js";

export interface TransactionCurrencyEnrichment {
  from_currency: string;
  to_currency: string;
  /** Effective currency for this transaction: income → to_account, expense/transfer → from_account */
  currency: string;
}

/**
 * Fetches from_account.currency and to_account.currency for the given transaction IDs.
 * Transactions table does not store currency; it comes from the linked accounts.
 */
export async function getTransactionCurrencyEnrichment(
  transactionIds: number[],
  userId: number,
): Promise<Map<number, TransactionCurrencyEnrichment>> {
  const map = new Map<number, TransactionCurrencyEnrichment>();
  if (transactionIds.length === 0) return map;

  const database = db();
  const rows = await database
    .selectFrom("transactions as t")
    .innerJoin("accounts as from_acc", "from_acc.id", "t.from_account_id")
    .innerJoin("accounts as to_acc", "to_acc.id", "t.to_account_id")
    .select([
      "t.id",
      "t.type",
      "from_acc.currency as from_currency",
      "to_acc.currency as to_currency",
    ])
    .where("t.id", "in", transactionIds)
    .where("t.user_id", "=", userId)
    .execute();

  for (const row of rows as Array<{
    id: number;
    type: string;
    from_currency: string;
    to_currency: string;
  }>) {
    const fromCur = (row.from_currency ?? "EUR").toUpperCase();
    const toCur = (row.to_currency ?? "EUR").toUpperCase();
    const currency = row.type === "income" ? toCur : fromCur;
    map.set(row.id, {
      from_currency: fromCur,
      to_currency: toCur,
      currency,
    });
  }

  return map;
}

/**
 * Attaches from_currency, to_currency, and currency to each transaction in the list.
 */
export function attachTransactionCurrencyEnrichment<T extends { id: number }>(
  items: T[],
  enrichment: Map<number, TransactionCurrencyEnrichment>,
): (T & TransactionCurrencyEnrichment)[] {
  return items.map((item) => {
    const ent = enrichment.get(item.id) ?? {
      from_currency: "EUR",
      to_currency: "EUR",
      currency: "EUR",
    };
    return { ...item, ...ent };
  });
}
