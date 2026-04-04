import { Elysia } from "elysia";
import { authDerivePlugin, requireAuth } from "../middleware/auth.js";
import { normalizeListQuery } from "../schemas/common.js";
import { tLiabilityPaymentsListQuerySchema } from "../schemas/typebox.js";
import {
  createLiabilityPayment,
  deleteLiabilityPayment,
  getLiabilityPaymentById,
  getLiabilityPaymentsForLiability,
  listLiabilityPayments,
  recordLiabilityPayment,
  updateLiabilityPayment,
} from "../services/liability.js";
import { formatDateOnly, parseDateOnly } from "../utils/date.js";
import { parseIdParamOr400, withIdParam } from "../utils/params.js";
import { extractFiltersFromQuery } from "../utils/query.js";

const LIST_FILTER_KEYS = [
  "id",
  "liability_id",
  "payment_date",
  "amount",
  "principal_amount",
  "interest_amount",
  "extra_payment",
  "transaction_id",
] as const;

function parseRecordBody(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const liability_id = Number(b.liability_id);
  const amount = Number(b.amount);
  const principal_amount = Number(b.principal_amount);
  const interest_amount = Number(b.interest_amount);
  const extra_payment = b.extra_payment == null ? 0 : Number(b.extra_payment);
  const transaction_id = Number(b.transaction_id);
  const payment_date = typeof b.payment_date === "string" ? b.payment_date.slice(0, 10) : "";

  if (
    !Number.isInteger(liability_id) ||
    liability_id <= 0 ||
    !payment_date ||
    !Number.isFinite(amount) ||
    !Number.isFinite(principal_amount) ||
    !Number.isFinite(interest_amount) ||
    !Number.isFinite(extra_payment) ||
    !Number.isInteger(transaction_id) ||
    transaction_id <= 0
  ) {
    throw new Error(
      "liability_id, payment_date, amount, principal_amount, interest_amount, and transaction_id are required",
    );
  }
  const parsedDate = parseDateOnly(payment_date);

  return {
    liability_id,
    payment_date: formatDateOnly(parsedDate),
    amount,
    principal_amount,
    interest_amount,
    extra_payment,
    transaction_id,
  };
}

export const liabilityPaymentsRoutes = new Elysia({
  prefix: "/liability_payments",
  tags: ["liabilities"],
})
  .use(authDerivePlugin)
  .get("/liability/:liability_id", async ({ params, userId, set }) => {
    requireAuth({ userId });
    const liabilityId = parseIdParamOr400(params.liability_id, set, "liability_id");
    if (typeof liabilityId === "object") return liabilityId;
    return getLiabilityPaymentsForLiability(userId!, liabilityId);
  })
  .post("/record", async ({ body, userId, set }) => {
    requireAuth({ userId });
    const payment = await recordLiabilityPayment(userId!, parseRecordBody(body));
    set.status = 201;
    return payment;
  })
  .post("/", async ({ body, userId, set }) => {
    requireAuth({ userId });
    const payment = await createLiabilityPayment(userId!, parseRecordBody(body));
    set.status = 201;
    return payment;
  })
  .get(
    "/",
    async ({ query, userId }) => {
      requireAuth({ userId });
      const listQuery = normalizeListQuery(query as Record<string, unknown>);
      const rawQuery = (query as Record<string, unknown>) ?? {};
      const filters = extractFiltersFromQuery(rawQuery, [...LIST_FILTER_KEYS]);
      return listLiabilityPayments(userId!, {
        page: listQuery.page,
        per_page: listQuery.per_page,
        sort_by: listQuery.sort_by,
        sort_order: listQuery.sort_order,
        filters,
      });
    },
    { query: tLiabilityPaymentsListQuerySchema },
  )
  .get("/:id", ({ params, userId, set }) =>
    withIdParam({ params, userId, set }, async (id) => {
      const payment = await getLiabilityPaymentById(userId!, id);
      if (!payment) {
        set.status = 404;
        return "";
      }
      return payment;
    }),
  )
  .put("/:id", ({ params, body, userId, set }) =>
    withIdParam({ params, userId, set }, async (id) => {
      const payment = await updateLiabilityPayment(
        userId!,
        id,
        (body ?? {}) as Record<string, unknown>,
      );
      if (!payment) {
        set.status = 404;
        return "";
      }
      return payment;
    }),
  )
  .delete("/:id", ({ params, userId, set }) =>
    withIdParam({ params, userId, set }, async (id) => {
      const ok = await deleteLiabilityPayment(userId!, id);
      if (!ok) {
        set.status = 404;
        return "";
      }
      set.status = 204;
      return "";
    }),
  );
