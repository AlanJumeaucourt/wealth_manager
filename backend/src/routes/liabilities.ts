import { Elysia } from "elysia";
import { TABLE_LIST_DEFAULTS } from "../db/manifest.js";
import { authDerivePlugin, requireAuth } from "../middleware/auth.js";
import type { ListQuery } from "../schemas/common.js";
import { normalizeListQuery, validationErrorResponse } from "../schemas/common.js";
import {
  tLiabilitiesListQuerySchema,
  tLiabilitiesPaymentStatusQuerySchema,
  tLiabilitiesSchedulePaymentsQuerySchema,
} from "../schemas/typebox.js";
import { resolveBodyCurrency } from "../services/account.js";
import * as base from "../services/base.js";
import {
  generateAmortizationSchedule,
  generateInterestExpenseTransactions,
  getLiabilityWithDetails,
  listLiabilityScheduleStatusItems,
  regenerateInterestExpenseTransactions,
  saveLiabilityScheduleOverrideCsv,
} from "../services/liability.js";
import {
  createBatchCreateHandler,
  createBatchDeleteHandler,
  createBatchUpdateHandler,
  createDeleteByIdHandler,
  createGetByIdHandler,
  createListHandler,
} from "../utils/crudHandlers.js";
import { errorMessage } from "../utils/error.js";
import { withIdParam } from "../utils/params.js";
import { stringifyUnknown } from "../utils/stringifyUnknown.js";

const TABLE = "liabilities" as const;
const listDefaults = TABLE_LIST_DEFAULTS[TABLE];
const SEARCH_FIELDS = (listDefaults?.defaultSearchFields ?? []) as string[];
const LIABILITY_CURRENCY_NOTE =
  "**currency:** ISO code (e.g. EUR, RON). If omitted, null, or blank, the user's preferred currency from their profile is used.";
const AUTH_NOTE_LIABILITIES = " **Header:** Authorization: Bearer <token>.";
async function normalizeLiabilityBody(body: Record<string, unknown>, userId: number) {
  const currency = await resolveBodyCurrency(body, userId);
  return {
    ...body,
    user_id: userId,
    principal_amount: stringifyUnknown(body.principal_amount ?? 0),
    interest_rate: stringifyUnknown(body.interest_rate ?? 0),
    currency,
  };
}

function parsePositiveInt(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return parsed;
}

function parsePaymentStatusQuery(
  listQuery: ListQuery,
  rawQuery: Record<string, unknown>,
  forcedStatus?: "upcoming" | "missed",
) {
  const status =
    forcedStatus ??
    (rawQuery.status === "upcoming" || rawQuery.status === "missed" ? rawQuery.status : undefined);

  if (!status) {
    return {
      success: false as const,
      error: "status must be 'upcoming' or 'missed'",
      details: [{ path: "status", message: "status must be 'upcoming' or 'missed'" }],
    };
  }

  try {
    const liability_id = parsePositiveInt(rawQuery.liability_id, "liability_id");
    const account_id = parsePositiveInt(rawQuery.account_id, "account_id");
    const days_ahead = parsePositiveInt(rawQuery.days_ahead, "days_ahead");

    return {
      success: true as const,
      data: {
        status,
        page: listQuery.page,
        per_page: listQuery.per_page,
        sort_order: listQuery.sort_order as "asc" | "desc" | undefined,
        search: listQuery.search,
        from_date: typeof rawQuery.from_date === "string" ? rawQuery.from_date : undefined,
        to_date: typeof rawQuery.to_date === "string" ? rawQuery.to_date : undefined,
        days_ahead,
        filters: {
          liability_id,
          direction: typeof rawQuery.direction === "string" ? rawQuery.direction : undefined,
          account_id,
          liability_type:
            typeof rawQuery.liability_type === "string" ? rawQuery.liability_type : undefined,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false as const,
      error: message,
      details: [{ path: "query", message }],
    };
  }
}

function createPaymentStatusHandler(forcedStatus?: "upcoming" | "missed") {
  return async ({
    query,
    userId,
    set,
  }: {
    query: Record<string, unknown>;
    userId: number | null;
    set: { status?: number | string };
  }) => {
    requireAuth({ userId });
    const listQuery = normalizeListQuery(query);
    const rawQuery = query ?? {};
    const parsed = parsePaymentStatusQuery(listQuery, rawQuery, forcedStatus);
    if (!parsed.success) {
      set.status = 400;
      return validationErrorResponse(parsed);
    }
    return listLiabilityScheduleStatusItems(userId!, parsed.data);
  };
}

export const liabilitiesRoutes = new Elysia({ prefix: "/liabilities", tags: ["liabilities"] })
  .use(authDerivePlugin)
  .post(
    "/",
    async ({ body, userId, set }) => {
      requireAuth({ userId });
      const b = body as Record<string, unknown> | undefined;
      if (!b || !b.name || !b.liability_type) {
        set.status = 400;
        return { error: "name, liability_type required" };
      }
      const data = await normalizeLiabilityBody(b, userId!);
      const row = await base.createOne(TABLE, data);
      if (!row) throw new Error("Create liability: insert returned no row");
      const createdLiabilityId =
        typeof (row as { id?: unknown }).id === "number" ? (row as { id: number }).id : undefined;
      const shouldGenerate =
        b.auto_generate_interest ??
        (b.liability_type === "total_deferred_loan" || b.deferral_type === "total");
      if (shouldGenerate && createdLiabilityId) {
        try {
          await generateInterestExpenseTransactions(createdLiabilityId, userId!);
        } catch {
          // Do not fail liability creation if interest generation fails.
        }
      }
      set.status = 201;
      return createdLiabilityId
        ? ((await getLiabilityWithDetails(userId!, createdLiabilityId)) ?? row)
        : row;
    },
    {
      detail: {
        tags: ["liabilities"],
        summary: "Create liability",
        description: LIABILITY_CURRENCY_NOTE + AUTH_NOTE_LIABILITIES,
      },
    },
  )
  .get(
    "/",
    createListHandler(TABLE, {
      searchFields: SEARCH_FIELDS,
      allowedFilters: (listDefaults?.defaultFilters ?? []) as string[],
      useValidatedQuery: true,
      enrichItems: (items, userId) =>
        Promise.all(
          items.map(async (item) => {
            const enriched = await getLiabilityWithDetails(userId, (item as { id: number }).id);
            return (enriched ?? item) as Record<string, unknown>;
          }),
        ),
    }),
    { query: tLiabilitiesListQuerySchema },
  )
  .get("/payment-status", createPaymentStatusHandler(undefined), {
    query: tLiabilitiesPaymentStatusQuerySchema,
  })
  .get("/upcoming-payments", createPaymentStatusHandler("upcoming"), {
    query: tLiabilitiesSchedulePaymentsQuerySchema,
  })
  .get("/missed-payments", createPaymentStatusHandler("missed"), {
    query: tLiabilitiesSchedulePaymentsQuerySchema,
  })
  .get(
    "/:id",
    createGetByIdHandler(TABLE, {
      enrich: async (row, userId) =>
        (await getLiabilityWithDetails(userId, row.id as number)) ?? row,
    }),
  )
  .get("/:id/amortization", ({ params, userId, set }) =>
    withIdParam({ params, userId, set }, (id) => generateAmortizationSchedule(id, userId!)),
  )
  .put("/:id/amortization-override", async ({ params, body, userId, set }) => {
    const idResult = await withIdParam({ params, userId, set }, async (id) => {
      const b = (body ?? {}) as Record<string, unknown>;
      if (!b || typeof b.csv !== "string") {
        set.status = 400;
        return { error: "csv is required" };
      }
      return saveLiabilityScheduleOverrideCsv(userId!, id, b.csv);
    });
    return idResult;
  })
  .get("/:id/generate-interest-transactions", ({ params, userId, set }) =>
    withIdParam({ params, userId, set }, async (id) => {
      const result = await generateInterestExpenseTransactions(id, userId!);
      if (!result.success) {
        set.status = result.message === "Liability not found" ? 404 : 400;
      }
      return { success: result.success, message: result.message };
    }),
  )
  .post("/:id/regenerate-interest-transactions", ({ params, userId, set }) =>
    withIdParam({ params, userId, set }, async (id) => {
      try {
        return await regenerateInterestExpenseTransactions(id, userId!);
      } catch (e) {
        const message = errorMessage(e);
        set.status = 400;
        return { error: message };
      }
    }),
  )
  .put("/:id", ({ params, body, userId, set }) =>
    withIdParam({ params, userId, set }, async (id) => {
      const row = await base.updateOne(TABLE, id, userId!, (body as Record<string, unknown>) ?? {});
      if (!row) {
        set.status = 404;
        return "";
      }
      return (await getLiabilityWithDetails(userId!, id)) ?? row;
    }),
  )
  .delete("/:id", createDeleteByIdHandler(TABLE))
  .post("/batch/create", createBatchCreateHandler(TABLE, normalizeLiabilityBody), {
    detail: {
      summary: "Create multiple liabilities",
      description: LIABILITY_CURRENCY_NOTE + AUTH_NOTE_LIABILITIES.trim(),
    },
  })
  .post("/batch/update", createBatchUpdateHandler(TABLE))
  .post("/batch/delete", createBatchDeleteHandler(TABLE));
