import { requireAuth } from "../middleware/auth.js";
import type { ListQuery } from "../schemas/common.js";
import { buildListParams, normalizeListQuery } from "../schemas/common.js";
import * as base from "../services/base.js";
import type { ListResponse } from "../types/index.js";
import { extractBatchIds, extractBatchItems } from "./body.js";
import { parseIdParamOr400 } from "./params.js";
import { extractFiltersFromQuery, parseDateRangeOr400 } from "./query.js";

export type TableName = Parameters<typeof base.getById>[0];

/** Context shape for handlers that use :id param */
export type IdHandlerContext = {
  params: { id: string };
  userId: number | null;
  set: { status?: number | string };
};

/** Context shape for list handlers */
export type ListHandlerContext = {
  query: unknown;
  request: Request;
  userId: number | null;
  set: { status?: number | string };
};

/** Context shape for create/update handlers */
export type BodyHandlerContext = IdHandlerContext & { body: unknown };

/** Options for createGetByIdHandler */
export type GetByIdOptions<TItem = Record<string, unknown>> = {
  /** Optional enrichment; receives (row, userId) and returns enriched result */
  enrich?: (row: Record<string, unknown>, userId: number) => Promise<TItem>;
};

/**
 * Factory for GET /:id handler. Handles auth, id parsing, 404.
 */
export function createGetByIdHandler<TItem = Record<string, unknown>>(
  table: TableName,
  options?: GetByIdOptions<TItem>,
) {
  return async (ctx: IdHandlerContext): Promise<TItem | "" | { error: string }> => {
    requireAuth({ userId: ctx.userId });
    const id = parseIdParamOr400(ctx.params.id, ctx.set);
    if (typeof id === "object") return id;
    const row = await base.getById<Record<string, unknown>>(table, id, ctx.userId!);
    if (!row) {
      ctx.set.status = 404;
      return "";
    }
    if (options?.enrich) {
      return options.enrich(row as Record<string, unknown>, ctx.userId!);
    }
    return row as TItem;
  };
}

/**
 * Run a handler that needs a valid id param and an existing row. Handles auth, id parsing, 404.
 * The callback receives (id, row). Returns 404 if row not found.
 */
export async function withIdParamAndGetById<T>(
  ctx: IdHandlerContext,
  table: TableName,
  fn: (id: number, row: Record<string, unknown>) => Promise<T>,
): Promise<T | "" | { error: string }> {
  requireAuth({ userId: ctx.userId });
  const id = parseIdParamOr400(ctx.params.id, ctx.set);
  if (typeof id === "object") return id;
  const row = await base.getById(table, id, ctx.userId!);
  if (!row) {
    ctx.set.status = 404;
    return "";
  }
  return fn(id, row as Record<string, unknown>);
}

/** Context for handlers that need id param + date range from query */
export type IdAndDateRangeContext = IdHandlerContext & { query: unknown };

/**
 * Run a handler that needs id param, date range from query, and an existing row. Handles auth, id parsing,
 * date parsing, 404. The callback receives (id, start_date, end_date). Returns 404 if row not found.
 */
export async function withIdParamAndDateRange<T>(
  ctx: IdAndDateRangeContext,
  table: TableName,
  fn: (id: number, startDate: string, endDate: string) => Promise<T>,
): Promise<T | "" | { error: string } | { error: { error: string } }> {
  requireAuth({ userId: ctx.userId });
  const id = parseIdParamOr400(ctx.params.id, ctx.set);
  if (typeof id === "object") return id;
  const dateParsed = parseDateRangeOr400(ctx.query as Record<string, unknown>, ctx.set);
  if ("error" in dateParsed) return dateParsed.error;
  const row = await base.getById(table, id, ctx.userId!);
  if (!row) {
    ctx.set.status = 404;
    return "";
  }
  return fn(id, dateParsed.start_date, dateParsed.end_date);
}

/**
 * Factory for DELETE /:id handler. Handles auth, id parsing, 404, 204.
 */
export function createDeleteByIdHandler(table: TableName) {
  return async (ctx: IdHandlerContext) => {
    requireAuth({ userId: ctx.userId });
    const id = parseIdParamOr400(ctx.params.id, ctx.set);
    if (typeof id === "object") return id;
    const ok = await base.deleteOne(table, id, ctx.userId!);
    if (!ok) {
      ctx.set.status = 404;
      return "";
    }
    ctx.set.status = 204;
    return "";
  };
}

/** Config for createListHandler */
export type ListHandlerConfig<TItem = Record<string, unknown>> = {
  searchFields: string[];
  allowedFilters: string[];
  /** If true, use normalizeListQuery(ctx.query). Route must validate query with tListQuerySchema. */
  useValidatedQuery?: boolean;
  /** Optional transform for filters before buildListParams (e.g. uppercase symbol) */
  filterTransform?: (
    rawQuery: Record<string, unknown>,
    filters: Record<string, string | number>,
  ) => Record<string, string | number>;
  /** Optional enrichment for list items; receives (items, userId), returns enriched items */
  enrichItems?: (items: Record<string, unknown>[], userId: number) => Promise<TItem[]>;
};

/**
 * Factory for GET / list handler. Uses normalizeListQuery(ctx.query); route must use query: tListQuerySchema.
 */
export function createListHandler<TItem = Record<string, unknown>>(
  table: TableName,
  config: ListHandlerConfig<TItem>,
) {
  return async (ctx: ListHandlerContext): Promise<ListResponse<TItem> | { error: string }> => {
    requireAuth({ userId: ctx.userId });
    const rawQuery = (ctx.query as Record<string, unknown>) ?? {};
    if (config.useValidatedQuery !== false) {
      const allowedKeys = new Set([
        "page",
        "per_page",
        "sort_by",
        "sort_order",
        "search",
        "search_fields",
        "fields",
        ...config.allowedFilters,
      ]);
      const unknownKeys = Object.keys(rawQuery).filter((k) => !allowedKeys.has(k));
      if (unknownKeys.length > 0) {
        ctx.set.status = 400;
        return { error: `Unknown query parameters: ${unknownKeys.sort().join(", ")}` };
      }
    }
    const listQuery = normalizeListQuery(rawQuery as Partial<ListQuery> & Record<string, unknown>);
    let filters = extractFiltersFromQuery(rawQuery, config.allowedFilters);

    // Special handling for multi-valued filters like ?id=1&id=2.
    // Some runtimes collapse duplicate keys in ctx.query, but the original
    // URL still contains all values.
    try {
      const url = new URL(ctx.request.url);
      for (const key of config.allowedFilters) {
        const allValues = url.searchParams.getAll(key);
        if (allValues.length > 1) {
          const joined = allValues.map((v) => v.trim()).filter((v) => v !== "");
          if (joined.length > 0) {
            filters[key] = joined.join(",");
          }
        }
      }
    } catch {
      // If URL parsing fails for some reason, fall back to filters as-is.
    }

    if (config.filterTransform) {
      filters = config.filterTransform(rawQuery, filters);
    }
    const params = buildListParams(listQuery, {
      defaultSearchFields: config.searchFields,
      filters,
    });
    const result = await base.listAll<Record<string, unknown>, typeof table>(
      table,
      ctx.userId!,
      params,
    );
    if (config.enrichItems) {
      const items = await config.enrichItems(
        result.items as Record<string, unknown>[],
        ctx.userId!,
      );
      return { ...result, items } as ListResponse<TItem>;
    }
    return result as ListResponse<TItem>;
  };
}

export type CreateTransform = (
  body: Record<string, unknown>,
  userId: number,
) => Record<string, unknown> | Promise<Record<string, unknown>>;

/**
 * Factory for POST / create handler. Body is validated by Elysia (TypeBox); transform receives validated body.
 */
export function createCreateHandler(table: TableName, transform?: CreateTransform) {
  return async (ctx: {
    body: Record<string, unknown>;
    userId: number | null;
    set: { status?: number | string };
  }) => {
    requireAuth({ userId: ctx.userId });
    const data = transform
      ? await Promise.resolve(transform(ctx.body, ctx.userId!))
      : { ...ctx.body, user_id: ctx.userId! };
    const row = await base.createOne(table, data);
    if (!row) throw new Error(`Create ${table}: insert returned no row`);
    ctx.set.status = 201;
    return row;
  };
}

/**
 * Factory for PUT /:id update handler. Body is validated by Elysia (TypeBox); transform receives validated body.
 */
export function createUpdateHandler(
  table: TableName,
  transform?: (body: Record<string, unknown>) => Record<string, unknown>,
) {
  return async (ctx: BodyHandlerContext & { body: Record<string, unknown> }) => {
    requireAuth({ userId: ctx.userId });
    const id = parseIdParamOr400(ctx.params.id, ctx.set);
    if (typeof id === "object") return id;
    const data = transform ? transform(ctx.body) : ctx.body;
    const row = await base.updateOne(table, id, ctx.userId!, data);
    if (!row) {
      ctx.set.status = 404;
      return "";
    }
    return row;
  };
}

/** Context for batch handlers */
export type BatchHandlerContext = {
  body: unknown;
  userId: number | null;
  set?: { status?: number | string };
};

export type BatchCreateTransform = (
  item: Record<string, unknown>,
  userId: number,
) => Record<string, unknown> | Promise<Record<string, unknown>>;

/**
 * Factory for POST /batch/create handler. Items get user_id appended.
 */
export function createBatchCreateHandler(table: TableName, transform?: BatchCreateTransform) {
  return async (ctx: BatchHandlerContext) => {
    requireAuth({ userId: ctx.userId });
    const items = extractBatchItems(ctx.body) as Record<string, unknown>[];
    const withUser = await Promise.all(
      items.map((item) =>
        transform
          ? Promise.resolve(transform(item, ctx.userId!))
          : Promise.resolve({ ...item, user_id: ctx.userId! }),
      ),
    );
    return base.batchCreate(table, withUser);
  };
}

/**
 * Factory for POST /batch/update handler.
 */
export function createBatchUpdateHandler(table: TableName) {
  return async (ctx: BatchHandlerContext) => {
    requireAuth({ userId: ctx.userId });
    const items = extractBatchItems<Record<string, unknown> & { id: number }>(ctx.body);
    return base.batchUpdate(table, ctx.userId!, items);
  };
}

/**
 * Factory for POST /batch/delete handler.
 */
export function createBatchDeleteHandler(table: TableName) {
  return async (ctx: BatchHandlerContext) => {
    requireAuth({ userId: ctx.userId });
    const ids = extractBatchIds(ctx.body);
    return base.batchDelete(table, ctx.userId!, ids);
  };
}
