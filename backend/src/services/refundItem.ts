import { db } from "../db/client.js";
import { ConflictError } from "../utils/error.js";

export interface RefundGroupConstraintInput {
  income_transaction_id: number;
  expense_transaction_id: number;
  refund_group_id: number | null;
}

function sameRefundGroup(left: number | null, right: number | null): boolean {
  return (left ?? null) === (right ?? null);
}

export async function assertTransactionsBelongToSingleRefundGroup(
  input: RefundGroupConstraintInput,
  userId: number,
  excludedRefundItemId?: number,
): Promise<void> {
  const database = db();
  const transactionIds = Array.from(
    new Set([Number(input.income_transaction_id), Number(input.expense_transaction_id)]),
  ).filter((id) => Number.isInteger(id) && id > 0);

  if (transactionIds.length === 0) return;

  let query = database
    .selectFrom("refund_items")
    .select(["id", "refund_group_id", "income_transaction_id", "expense_transaction_id"])
    .where("user_id", "=", userId);

  if (excludedRefundItemId != null) {
    query = query.where("id", "!=", excludedRefundItemId);
  }

  const existingItems = await query
    .where((eb) =>
      eb.or([
        eb("income_transaction_id", "in", transactionIds),
        eb("expense_transaction_id", "in", transactionIds),
      ]),
    )
    .execute();

  const targetGroupId = input.refund_group_id ?? null;
  for (const item of existingItems as Array<{
    refund_group_id: number | null;
    income_transaction_id: number;
    expense_transaction_id: number;
  }>) {
    if (sameRefundGroup(item.refund_group_id, targetGroupId)) continue;
    const conflicts =
      transactionIds.includes(Number(item.income_transaction_id)) ||
      transactionIds.includes(Number(item.expense_transaction_id));
    if (conflicts) {
      throw new ConflictError("Transaction already belongs to another refund group");
    }
  }
}

/**
 * Returns the "effective" currency of a transaction for refund matching:
 * - income: to_account.currency
 * - expense: from_account.currency
 * - transfer: from_account.currency (arbitrary but consistent)
 */
export async function getTransactionCurrency(
  transactionId: number,
  userId: number,
): Promise<string | null> {
  const database = db();
  const row = await database
    .selectFrom("transactions as t")
    .innerJoin("accounts as from_acc", "from_acc.id", "t.from_account_id")
    .innerJoin("accounts as to_acc", "to_acc.id", "t.to_account_id")
    .select(["t.type", "from_acc.currency as from_currency", "to_acc.currency as to_currency"])
    .where("t.id", "=", transactionId)
    .where("t.user_id", "=", userId)
    .executeTakeFirst();

  if (!row) return null;
  const r = row as { type: string; from_currency: string; to_currency: string };
  if (r.type === "income") return (r.to_currency ?? "EUR").toUpperCase();
  return (r.from_currency ?? "EUR").toUpperCase();
}
