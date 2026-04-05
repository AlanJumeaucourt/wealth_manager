import { Elysia } from "elysia";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { LISTABLE_FIELDS, TABLE_LIST_DEFAULTS } from "../db/manifest.js";
import { authDerivePlugin, requireAuth, type AuthDerive } from "../middleware/auth.js";
import { buildListParams, normalizeListQuery } from "../schemas/common.js";
import {
  tBatchCreateBodySchema,
  tBatchDeleteBodySchema,
  tBatchUpdateBodySchema,
  tCreateTransactionSchema,
  tIdParamSchema,
  tListResponseSchema,
  tTransactionListItemSchema,
  tTransactionsListQuerySchema,
  tUpdateTransactionSchema,
} from "../schemas/typebox.js";
import * as base from "../services/base.js";
import { attachRefundEnrichment, getRefundEnrichment } from "../services/refundEnrichment.js";
import { attachPreferredAmountFields } from "../services/transactionPreferredAmounts.js";
import {
  attachTransactionCurrencyEnrichment,
  getTransactionCurrencyEnrichment,
} from "../services/transactionCurrencyEnrichment.js";
import { getUserPreferredCurrency } from "../services/user.js";
import {
  createBatchCreateHandler,
  createBatchDeleteHandler,
  createBatchUpdateHandler,
  createCreateHandler,
  createDeleteByIdHandler,
  createGetByIdHandler,
  createUpdateHandler,
} from "../utils/crudHandlers.js";
import { coerceNumericJsonFieldsMany } from "../utils/jsonNumeric.js";
import { extractFiltersFromQuery } from "../utils/query.js";
import { stringifyUnknown } from "../utils/stringifyUnknown.js";

const TABLE = "transactions" as const;
const listDefaults = TABLE_LIST_DEFAULTS[TABLE];
const SEARCH_FIELDS = (listDefaults?.defaultSearchFields ?? []) as string[];
const TABLE_FIELDS = LISTABLE_FIELDS[TABLE]?.filter((f) => f !== "user_id") ?? [];
function transactionAmountTransform(body: Record<string, unknown>) {
  const result = { ...body };
  if (body.amount != null) result.amount = stringifyUnknown(body.amount);
  if (body.to_amount != null) result.to_amount = stringifyUnknown(body.to_amount);
  return result;
}

const createHandler = createCreateHandler(TABLE, (body, userId) => ({
  ...transactionAmountTransform(body),
  user_id: userId,
}));
const getByIdHandler = createGetByIdHandler(TABLE, {
  enrich: async (row, userId) => {
    const id = row.id as number;
    const [refundEnrichment, currencyEnrichment] = await Promise.all([
      getRefundEnrichment([id], userId),
      getTransactionCurrencyEnrichment([id], userId),
    ]);
    const ent = refundEnrichment.get(id) ?? { refund_items: [], refunded_amount: 0 };
    const curr = currencyEnrichment.get(id) ?? {
      from_currency: "EUR",
      to_currency: "EUR",
      currency: "EUR",
    };
    const merged = {
      ...row,
      ...curr,
      refund_items: ent.refund_items,
      refunded_amount: ent.refunded_amount,
    } as Record<string, unknown>;
    const userPref = await getUserPreferredCurrency(userId);
    return attachPreferredAmountFields([merged], userPref)[0];
  },
});
const updateHandler = createUpdateHandler(TABLE, (body) => transactionAmountTransform(body));
const deleteHandler = createDeleteByIdHandler(TABLE);
const batchCreateHandler = createBatchCreateHandler(TABLE, (item, userId) => ({
  ...item,
  user_id: userId,
  amount: stringifyUnknown(item.amount ?? 0),
  to_amount: item.to_amount != null ? stringifyUnknown(item.to_amount) : null,
}));
const batchUpdateHandler = createBatchUpdateHandler(TABLE);
const batchDeleteHandler = createBatchDeleteHandler(TABLE);

type TransactionsListContext = AuthDerive & {
  query: Record<string, unknown>;
  request: Request;
  set: { status?: number | string };
};

async function listHandler(ctx: TransactionsListContext) {
  const { query, userId, set } = ctx;
  requireAuth({ userId });
  const listQuery = normalizeListQuery(query);
  const q = listQuery;
  const fields =
    typeof q.fields === "string" && q.fields.trim().length > 0
      ? q.fields
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== "")
      : undefined;
  if (fields && fields.length > 0) {
    const invalid = fields.filter((f) => !TABLE_FIELDS.includes(f));
    if (invalid.length > 0) {
      set.status = 400;
      return { error: `Invalid fields requested: ${invalid.join(", ")}` };
    }
  }
  const rawQuery = query ?? {};
  const allowedFilters = (listDefaults?.defaultFilters ?? []) as string[];
  const filters = extractFiltersFromQuery(rawQuery, allowedFilters);

  // Support legacy-style account_id filter: match transactions where the account is either source or destination.
  const accountIdRaw = rawQuery["account_id"];
  const accountId = accountIdRaw != null && accountIdRaw !== "" ? Number(accountIdRaw) : undefined;
  const hasValidAccountId = accountId != null && Number.isFinite(accountId) && accountId > 0;

  const hasRefundRaw = rawQuery["has_refund"];
  const hasRefund = hasRefundRaw === "true" ? true : hasRefundRaw === "false" ? false : undefined;

  const fromDateRaw = rawQuery["from_date"];
  const toDateRaw = rawQuery["to_date"];
  const fromDate =
    typeof fromDateRaw === "string" && fromDateRaw.trim() !== "" ? fromDateRaw.trim() : undefined;
  const toDate =
    typeof toDateRaw === "string" && toDateRaw.trim() !== "" ? toDateRaw.trim() : undefined;

  const params = buildListParams(listQuery, {
    defaultSearchFields: SEARCH_FIELDS,
    filters,
    fields: fields ?? undefined,
  });

  const useCustomQuery =
    hasValidAccountId || hasRefund !== undefined || fromDate !== undefined || toDate !== undefined;

  if (!useCustomQuery) {
    const result = await base.listAll(TABLE, userId!, { ...params, filters });
    const items = result.items as Array<{ id: number }>;
    const ids = items.map((x) => x.id);
    const [refundEnrichment, currencyEnrichment] = await Promise.all([
      getRefundEnrichment(ids, userId!),
      getTransactionCurrencyEnrichment(ids, userId!),
    ]);
    const withRefund = attachRefundEnrichment(
      result.items as Array<{ id: number }>,
      refundEnrichment,
    );
    const withCurrency = attachTransactionCurrencyEnrichment(withRefund, currencyEnrichment);
    const userPref = await getUserPreferredCurrency(userId!);
    const withPreferred = attachPreferredAmountFields(
      withCurrency as unknown as Record<string, unknown>[],
      userPref,
    );
    return {
      ...result,
      items: coerceNumericJsonFieldsMany(withPreferred, "transactions"),
    };
  }

  // Custom path: account_id and/or has_refund (EXISTS on refund_items).
  const k = db();
  const dyn = k.dynamic;

  const page = params.page ?? 1;
  const perPage = params.per_page ?? 20;
  const sortBy = params.sort_by;
  const sortOrder = params.sort_order ?? "asc";
  const search = params.search;
  const searchFields = params.search_fields ?? [];
  const fieldsParam = params.fields;

  let countQ = k
    .selectFrom(TABLE)
    .select((eb) => eb.fn.countAll().as("total"))
    .where("user_id", "=", userId!);

  let dataBaseQ = k.selectFrom(TABLE).where("user_id", "=", userId!);

  if (hasValidAccountId) {
    countQ = countQ.where((eb) =>
      eb.or([eb("from_account_id", "=", accountId), eb("to_account_id", "=", accountId)]),
    );
    dataBaseQ = dataBaseQ.where((eb) =>
      eb.or([eb("from_account_id", "=", accountId), eb("to_account_id", "=", accountId)]),
    );
  }

  if (hasRefund !== undefined) {
    if (hasRefund) {
      countQ = countQ.where(sql<boolean>`
          exists(
            select 1
            from refund_items as ri
            where
              (ri.expense_transaction_id = transactions.id
               or ri.income_transaction_id = transactions.id)
              and ri.user_id = transactions.user_id
          )
        `);
      dataBaseQ = dataBaseQ.where(sql<boolean>`
          exists(
            select 1
            from refund_items as ri
            where
              (ri.expense_transaction_id = transactions.id
               or ri.income_transaction_id = transactions.id)
              and ri.user_id = transactions.user_id
          )
        `);
    } else {
      countQ = countQ.where(sql<boolean>`
          not exists(
            select 1
            from refund_items as ri
            where
              (ri.expense_transaction_id = transactions.id
               or ri.income_transaction_id = transactions.id)
              and ri.user_id = transactions.user_id
          )
        `);
      dataBaseQ = dataBaseQ.where(sql<boolean>`
          not exists(
            select 1
            from refund_items as ri
            where
              (ri.expense_transaction_id = transactions.id
               or ri.income_transaction_id = transactions.id)
              and ri.user_id = transactions.user_id
          )
        `);
    }
  }

  if (fromDate !== undefined) {
    countQ = countQ.where("date", ">=", fromDate);
    dataBaseQ = dataBaseQ.where("date", ">=", fromDate);
  }
  if (toDate !== undefined) {
    countQ = countQ.where("date", "<=", toDate);
    dataBaseQ = dataBaseQ.where("date", "<=", toDate);
  }

  // Apply simple field filters on top (id, category, etc.)
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    const v = value as string | number;
    if (typeof v === "string" && v.includes(",")) {
      const vals = v.split(",").map((x) => x.trim());
      const ref = dyn.ref(key);
      countQ = countQ.where(ref, "in", vals as unknown as readonly unknown[]);
      dataBaseQ = dataBaseQ.where(ref, "in", vals as unknown as readonly unknown[]);
    } else {
      const ref = dyn.ref(key);
      countQ = countQ.where(ref, "=", v as unknown);
      dataBaseQ = dataBaseQ.where(ref, "=", v as unknown);
    }
  }

  // Apply search if provided
  if (search && searchFields.length > 0) {
    const like = `%${search}%`;
    countQ = countQ.where((eb) =>
      eb.or(searchFields.map((f: string) => eb(dyn.ref(f), "like", like))),
    );
    dataBaseQ = dataBaseQ.where((eb) =>
      eb.or(searchFields.map((f: string) => eb(dyn.ref(f), "like", like))),
    );
  }

  const [{ total } = { total: 0 }] = (await countQ.execute()) as Array<{
    total: number | string | bigint;
  }>;
  const totalCount = Number(total);

  let dataQ = dataBaseQ;
  if (fieldsParam && fieldsParam.length) {
    const selected = Array.from(new Set(fieldsParam.filter((f) => f && f !== "user_id")));
    if (selected.length > 0) {
      dataQ = dataQ.select(selected.map((f) => dyn.ref(f)));
    } else {
      dataQ = dataQ.selectAll();
    }
  } else {
    dataQ = dataQ.selectAll();
  }

  if (sortBy) {
    dataQ = dataQ.orderBy(dyn.ref(sortBy), sortOrder);
  }

  const items = (await dataQ
    .limit(perPage)
    .offset((page - 1) * perPage)
    .execute()) as Record<string, unknown>[];

  const ids = items
    .map((x) => Number((x as { id?: unknown }).id))
    .filter((n) => Number.isFinite(n));
  const [refundEnrichment, currencyEnrichment] = await Promise.all([
    getRefundEnrichment(ids, userId!),
    getTransactionCurrencyEnrichment(ids, userId!),
  ]);
  const withRefund = attachRefundEnrichment(items as Array<{ id: number }>, refundEnrichment);
  const withCurrency = attachTransactionCurrencyEnrichment(
    withRefund as Array<{ id: number }>,
    currencyEnrichment,
  );
  const userPref = await getUserPreferredCurrency(userId!);
  const withPreferred = attachPreferredAmountFields(
    withCurrency as unknown as Record<string, unknown>[],
    userPref,
  );

  return {
    items: coerceNumericJsonFieldsMany(withPreferred, "transactions"),
    total: totalCount,
    page,
    per_page: perPage,
  };
}

export const transactionsRoutes = new Elysia({ prefix: "/transactions", tags: ["transactions"] })
  .use(authDerivePlugin)
  .post("/", (ctx) => createHandler(ctx), {
    body: tCreateTransactionSchema,
    detail: { summary: "Create transaction" },
  })
  .get("/", (ctx: TransactionsListContext) => listHandler(ctx) as any, {
    query: tTransactionsListQuerySchema,
    detail: { summary: "List transactions" },
    response: {
      200: tListResponseSchema(tTransactionListItemSchema),
    },
  })
  .get("/:id", (ctx) => getByIdHandler(ctx) as any, {
    params: tIdParamSchema,
    detail: { summary: "Get transaction by ID" },
    response: {
      200: tTransactionListItemSchema,
    },
  })
  .put("/:id", (ctx) => updateHandler(ctx), {
    body: tUpdateTransactionSchema,
    params: tIdParamSchema,
    detail: { summary: "Update transaction (partial)" },
  })
  .delete("/:id", (ctx) => deleteHandler(ctx), {
    params: tIdParamSchema,
    detail: { summary: "Delete transaction" },
  })
  .post("/batch/create", (ctx) => batchCreateHandler(ctx), {
    body: tBatchCreateBodySchema(tCreateTransactionSchema),
    detail: { summary: "Create multiple transactions" },
  })
  .post("/batch/update", (ctx) => batchUpdateHandler(ctx), {
    body: tBatchUpdateBodySchema,
    detail: { summary: "Update multiple transactions" },
  })
  .post("/batch/delete", (ctx) => batchDeleteHandler(ctx), {
    body: tBatchDeleteBodySchema,
    detail: { summary: "Delete multiple transactions by ID" },
  });
