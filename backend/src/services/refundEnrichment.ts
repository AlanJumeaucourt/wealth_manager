import { db } from "../db/client.js";

export interface RefundItemView {
  id: number;
  amount: number;
  date: string | null;
  description: string | null;
  refund_group_id: number | null;
}

export interface RefundEnrichment {
  refund_items: RefundItemView[];
  refunded_amount: number;
}

/**
 * Fetches refund items for the given transaction IDs and returns a map
 * from transaction id to { refund_items, refunded_amount }.
 * refund_items include refund_date from the income (refund receipt) transaction.
 */
export async function getRefundEnrichment(
  transactionIds: number[],
  userId: number,
): Promise<Map<number, RefundEnrichment>> {
  const map = new Map<number, RefundEnrichment>();
  if (transactionIds.length === 0) return map;

  const database = db();
  const idSet = new Set(transactionIds);

  // Get all refund_items where either expense or income side is in our transaction list.
  const refundRows = await database
    .selectFrom("refund_items")
    .select([
      "id",
      "expense_transaction_id",
      "income_transaction_id",
      "amount",
      "description",
      "refund_group_id",
    ])
    .where("user_id", "=", userId)
    .where((eb) =>
      eb.or([
        eb("expense_transaction_id", "in", transactionIds),
        eb("income_transaction_id", "in", transactionIds),
      ]),
    )
    .execute();

  const incomeIds = [
    ...new Set(
      (refundRows as Array<{ income_transaction_id: number }>).map((r) => r.income_transaction_id),
    ),
  ];
  const dateByTxId = new Map<number, string>();
  if (incomeIds.length > 0) {
    const txRows = await database
      .selectFrom("transactions")
      .select(["id", "date"])
      .where("id", "in", incomeIds)
      .where("user_id", "=", userId)
      .execute();
    for (const row of txRows as Array<{ id: number; date: string }>) {
      dateByTxId.set(row.id, row.date);
    }
  }

  for (const r of refundRows as Array<{
    id: number;
    expense_transaction_id: number;
    income_transaction_id: number;
    amount: number;
    description: string | null;
    refund_group_id: number | null;
  }>) {
    const refundDate = dateByTxId.get(r.income_transaction_id) ?? null;
    const item: RefundItemView = {
      id: r.id,
      amount: Number(r.amount),
      date: refundDate,
      description: r.description,
      refund_group_id: r.refund_group_id,
    };
    for (const tid of [r.expense_transaction_id, r.income_transaction_id]) {
      if (idSet.has(tid)) {
        if (!map.has(tid)) map.set(tid, { refund_items: [], refunded_amount: 0 });
        const ent = map.get(tid)!;
        ent.refund_items.push(item);
        ent.refunded_amount += Number(r.amount);
      }
    }
  }

  return map;
}

/**
 * Attaches refund_items and refunded_amount to each transaction in the list.
 */
export function attachRefundEnrichment<T extends { id: number }>(
  items: T[],
  enrichment: Map<number, RefundEnrichment>,
): (T & { refund_items: RefundItemView[]; refunded_amount: number })[] {
  return items.map((item) => {
    const ent = enrichment.get(item.id) ?? {
      refund_items: [],
      refunded_amount: 0,
    };
    return { ...item, refund_items: ent.refund_items, refunded_amount: ent.refunded_amount };
  });
}
