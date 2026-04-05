import { Elysia } from "elysia";
import { authDerivePlugin, requireAuth } from "../middleware/auth.js";
import {
  tPotentialRefundsListQuerySchema,
  tPotentialRefundsListResponse,
} from "../schemas/typebox.js";
import {
  clearDismissedPotentialRefunds,
  dismissPotentialRefund,
  getPotentialRefunds,
} from "../services/potentialRefunds.js";

export const potentialRefundsRoutes = new Elysia({
  prefix: "/potential_refunds",
  tags: ["refunds"],
})
  .use(authDerivePlugin)
  .get(
    "/",
    async ({ query, userId }) => {
      requireAuth({ userId });
      const limit = Math.min(
        Math.max(1, parseInt(String((query as Record<string, unknown>).limit), 10) || 50),
        200,
      );
      const items = await getPotentialRefunds(userId!, limit);
      return { items };
    },
    {
      query: tPotentialRefundsListQuerySchema,
      response: {
        200: tPotentialRefundsListResponse,
      },
      detail: {
        summary: "List potential refunds",
        description:
          "Income transactions that look like refund credits, with suggested expense matches. " +
          "Requires `Authorization: Bearer`.",
      },
    },
  )
  .post("/dismiss", async ({ body, userId, set }) => {
    requireAuth({ userId });
    const b = body as { income_transaction_id?: number } | undefined;
    const incomeTransactionId =
      typeof b?.income_transaction_id === "number" ? b.income_transaction_id : undefined;
    if (incomeTransactionId == null || incomeTransactionId <= 0) {
      set.status = 400;
      return { error: "income_transaction_id required (positive number)" };
    }
    await dismissPotentialRefund(userId!, incomeTransactionId);
    set.status = 204;
    return "";
  })
  .post(
    "/reset_dismissals",
    async ({ userId, set }) => {
      requireAuth({ userId });
      await clearDismissedPotentialRefunds(userId!);
      set.status = 204;
      return "";
    },
    {
      detail: {
        summary: "Reset all dismissed potential refunds",
        description:
          "Clears every row in dismissed_potential_refunds for the current user so those " +
          "income transactions can appear again in GET /potential_refunds. Requires `Authorization: Bearer`.",
      },
    },
  );
