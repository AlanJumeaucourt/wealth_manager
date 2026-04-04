import { Elysia } from "elysia";
import { authDerivePlugin, requireAuth } from "../middleware/auth.js";
import { tRefundItemsListQuerySchema } from "../schemas/typebox.js";
import * as base from "../services/base.js";
import { assertTransactionsBelongToSingleRefundGroup } from "../services/refundItem.js";
import {
  createBatchCreateHandler,
  createBatchDeleteHandler,
  createBatchUpdateHandler,
  createDeleteByIdHandler,
  createGetByIdHandler,
  createListHandler,
} from "../utils/crudHandlers.js";
import { withIdParam } from "../utils/params.js";

const TABLE = "refund_items" as const;
const SEARCH_FIELDS = ["description"];

interface RefundItemRecord {
  id: number;
  user_id: number;
  income_transaction_id: number;
  expense_transaction_id: number;
  amount: number;
  refund_group_id: number | null;
  description: string | null;
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isRefundGroupConflictError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Transaction already belongs to another refund group");
}

export const refundItemsRoutes = new Elysia({ prefix: "/refund_items", tags: ["refunds"] })
  .use(authDerivePlugin)
  .post("/", async ({ body, userId, set }) => {
    requireAuth({ userId });
    const b = body as Record<string, unknown> | undefined;
    if (
      !b ||
      b.income_transaction_id == null ||
      b.expense_transaction_id == null ||
      b.amount == null
    ) {
      set.status = 400;
      return { error: "income_transaction_id, expense_transaction_id, amount required" };
    }
    // Multi-currency: amount is stored in income (refund) transaction's currency
    const data = {
      income_transaction_id: Number(b.income_transaction_id),
      expense_transaction_id: Number(b.expense_transaction_id),
      amount: Number(b.amount),
      refund_group_id: b.refund_group_id == null ? null : Number(b.refund_group_id),
      description: (b.description as string | null | undefined) ?? null,
      user_id: userId!,
    };
    try {
      await assertTransactionsBelongToSingleRefundGroup(data, userId!);
      const row = await base.createOne(TABLE, data);
      if (!row) throw new Error("Create refund_item: insert returned no row");
      set.status = 201;
      return row;
    } catch (error) {
      if (isRefundGroupConflictError(error)) {
        set.status = 409;
        return { error: "Transaction already belongs to another refund group" };
      }
      throw error;
    }
  })
  .get(
    "/",
    createListHandler(TABLE, {
      searchFields: SEARCH_FIELDS,
      allowedFilters: ["id", "refund_group_id", "income_transaction_id", "expense_transaction_id"],
      useValidatedQuery: true,
    }),
    { query: tRefundItemsListQuerySchema },
  )
  .get("/:id", createGetByIdHandler(TABLE))
  .put("/:id", ({ params, body, userId, set }) =>
    withIdParam({ params, userId, set }, async (id) => {
      const existing = (await base.getById(TABLE, id, userId!)) as RefundItemRecord | null;
      if (!existing) {
        set.status = 404;
        return "";
      }
      const rawPatch = ((body as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      const patch: Record<string, unknown> = { ...rawPatch };
      if (hasOwn(rawPatch, "income_transaction_id")) {
        patch.income_transaction_id = Number(rawPatch.income_transaction_id);
      }
      if (hasOwn(rawPatch, "expense_transaction_id")) {
        patch.expense_transaction_id = Number(rawPatch.expense_transaction_id);
      }
      if (hasOwn(rawPatch, "amount")) {
        patch.amount = Number(rawPatch.amount);
      }
      if (hasOwn(rawPatch, "refund_group_id")) {
        patch.refund_group_id =
          rawPatch.refund_group_id == null ? null : Number(rawPatch.refund_group_id);
      }
      if (hasOwn(rawPatch, "description")) {
        patch.description = rawPatch.description ?? null;
      }
      const data = {
        income_transaction_id: hasOwn(patch, "income_transaction_id")
          ? Number(patch.income_transaction_id)
          : existing.income_transaction_id,
        expense_transaction_id: hasOwn(patch, "expense_transaction_id")
          ? Number(patch.expense_transaction_id)
          : existing.expense_transaction_id,
        refund_group_id: hasOwn(patch, "refund_group_id")
          ? patch.refund_group_id == null
            ? null
            : Number(patch.refund_group_id)
          : existing.refund_group_id,
      };
      try {
        await assertTransactionsBelongToSingleRefundGroup(data, userId!, id);
        const row = await base.updateOne(TABLE, id, userId!, patch);
        if (!row) {
          set.status = 404;
          return "";
        }
        return row;
      } catch (error) {
        if (isRefundGroupConflictError(error)) {
          set.status = 409;
          return { error: "Transaction already belongs to another refund group" };
        }
        throw error;
      }
    }),
  )
  .delete("/:id", createDeleteByIdHandler(TABLE))
  .post("/batch/create", createBatchCreateHandler(TABLE))
  .post("/batch/update", createBatchUpdateHandler(TABLE))
  .post("/batch/delete", createBatchDeleteHandler(TABLE));
