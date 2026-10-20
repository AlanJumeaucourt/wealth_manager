import { Elysia, t } from "elysia";
import { authDerivePlugin } from "../middleware/auth.js";
import { listQueryDescription } from "../schemas/openapi.js";
import {
  tBatchCreateBodySchema,
  tBatchDeleteBodySchema,
  tBatchUpdateBodySchema,
  tCrudErrorResponses,
  tErrorResponse,
  tIdParamSchema,
  tBaseListQuerySchema,
  tListQuerySchemaWithExtraKeys,
  tListResponseSchema,
} from "../schemas/typebox.js";
import type { GetByIdOptions, ListHandlerConfig, TableName } from "./crudHandlers.js";
import type { BatchCreateTransform, CreateTransform } from "./crudHandlers.js";
import {
  createBatchCreateHandler,
  createBatchDeleteHandler,
  createBatchUpdateHandler,
  createCreateHandler,
  createDeleteByIdHandler,
  createGetByIdHandler,
  createListHandler,
  createUpdateHandler,
} from "./crudHandlers.js";

type TypeBoxObjectSchema = ReturnType<typeof import("elysia").t.Object>;

/** "banks" -> "bank" */
function resourceName(prefix: string): string {
  const name = prefix.replace(/^\//, "").replace(/_/g, " ");
  return name.replace(/\s*s$/, "");
}

const AUTH_NOTE = " **Header:** Authorization: Bearer <token>.";
const RETURNS_LIST = " **Returns:** { items, total, page, per_page }.";

export type CrudRoutesConfig<TItem extends TypeBoxObjectSchema = TypeBoxObjectSchema> = {
  table: TableName;
  prefix: string;
  tags: string[];
  createSchema: TypeBoxObjectSchema;
  updateSchema: TypeBoxObjectSchema;
  listConfig: ListHandlerConfig;
  /** TypeBox schema for a single response item (required for OpenAPI / Eden). */
  responseItemSchema: TItem;
  createTransform?: CreateTransform;
  updateTransform?: (body: Record<string, unknown>) => Record<string, unknown>;
  batchCreateTransform?: BatchCreateTransform;
  getByIdOptions?: GetByIdOptions;
};

/**
 * Standard CRUD routes for a table.
 *
 * Prefer this for new resources. Existing banks/assets/refund_groups stay as
 * explicit route modules so Eden Treaty keeps precise item types; migrate them
 * once handler factories type-check cleanly against Elysia InlineHandler.
 */
export function createCrudRoutes<TItem extends TypeBoxObjectSchema>(
  config: CrudRoutesConfig<TItem>,
) {
  const {
    table,
    prefix,
    tags,
    createSchema,
    updateSchema,
    listConfig,
    responseItemSchema,
    createTransform,
    updateTransform,
    batchCreateTransform,
    getByIdOptions,
  } = config;
  const name = resourceName(prefix);
  const { allowedFilters, searchFields } = listConfig;

  const listConfigWithTypebox = { ...listConfig, useValidatedQuery: true as const };
  const listHandler = createListHandler(table, listConfigWithTypebox);
  const createHandler = createCreateHandler(table, createTransform);
  const getByIdHandler = createGetByIdHandler(table, getByIdOptions);
  const updateHandler = createUpdateHandler(table, updateTransform);
  const deleteHandler = createDeleteByIdHandler(table);
  const batchCreateHandler = createBatchCreateHandler(table, batchCreateTransform);
  const batchUpdateHandler = createBatchUpdateHandler(table);
  const batchDeleteHandler = createBatchDeleteHandler(table);

  const listDesc = listQueryDescription(allowedFilters, searchFields) + RETURNS_LIST + AUTH_NOTE;
  const listQuery =
    allowedFilters.length === 0
      ? tBaseListQuerySchema
      : tListQuerySchemaWithExtraKeys(allowedFilters);

  return new Elysia({ prefix, tags })
    .use(authDerivePlugin)
    .post(
      "/",
      ({ body, userId, set }) =>
        createHandler({
          body: body as Record<string, unknown>,
          userId,
          set,
        }),
      {
        body: createSchema,
        detail: {
          summary: `Create ${name}`,
          description: "**Body:** from schema below." + AUTH_NOTE,
        },
        response: {
          201: responseItemSchema,
          ...tCrudErrorResponses,
        },
      },
    )
    .get(
      "/",
      // Handler factories are intentionally loosely typed vs Elysia's InlineHandler.
      ((ctx: {
        query: unknown;
        request: Request;
        userId: number | null;
        set: { status?: number | string };
      }) => listHandler(ctx)) as never,
      {
        query: listQuery,
        detail: { summary: `List ${name}s`, description: listDesc },
        response: {
          200: tListResponseSchema(responseItemSchema),
          400: tErrorResponse,
          401: tErrorResponse,
        },
      },
    )
    .get(
      "/:id",
      ((ctx: {
        params: { id: string };
        userId: number | null;
        set: { status?: number | string };
      }) => getByIdHandler(ctx)) as never,
      {
        params: tIdParamSchema,
        detail: {
          summary: `Get ${name} by ID`,
          description: "Returns 404 if not found or not owned." + AUTH_NOTE,
        },
        response: {
          200: responseItemSchema,
          ...tCrudErrorResponses,
        },
      },
    )
    .put(
      "/:id",
      ((ctx: {
        params: { id: string };
        body: unknown;
        userId: number | null;
        set: { status?: number | string };
      }) =>
        updateHandler({
          params: ctx.params,
          body: ctx.body as Record<string, unknown>,
          userId: ctx.userId,
          set: ctx.set,
        })) as never,
      {
        body: updateSchema,
        detail: { summary: `Update ${name}`, description: "Partial update." + AUTH_NOTE },
        response: {
          200: responseItemSchema,
          ...tCrudErrorResponses,
        },
      },
    )
    .delete(
      "/:id",
      ((ctx: {
        params: { id: string };
        userId: number | null;
        set: { status?: number | string };
      }) => deleteHandler(ctx)) as never,
      {
        params: tIdParamSchema,
        detail: { summary: `Delete ${name}`, description: "Returns 204." + AUTH_NOTE },
        response: {
          204: t.Void(),
          ...tCrudErrorResponses,
        },
      },
    )
    .post(
      "/batch/create",
      ((ctx: { body: unknown; userId: number | null; set: { status?: number | string } }) =>
        batchCreateHandler(ctx)) as never,
      {
        body: tBatchCreateBodySchema(createSchema),
        detail: { summary: `Create multiple ${name}s`, description: AUTH_NOTE.trim() },
      },
    )
    .post(
      "/batch/update",
      ((ctx: { body: unknown; userId: number | null; set: { status?: number | string } }) =>
        batchUpdateHandler(ctx)) as never,
      {
        body: tBatchUpdateBodySchema,
        detail: { summary: `Update multiple ${name}s`, description: AUTH_NOTE.trim() },
      },
    )
    .post(
      "/batch/delete",
      ((ctx: { body: unknown; userId: number | null; set: { status?: number | string } }) =>
        batchDeleteHandler(ctx)) as never,
      {
        body: tBatchDeleteBodySchema,
        detail: { summary: `Delete multiple ${name}s`, description: AUTH_NOTE.trim() },
      },
    );
}
