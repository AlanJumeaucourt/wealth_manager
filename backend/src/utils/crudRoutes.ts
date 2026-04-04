import { Elysia } from "elysia";
import { authDerivePlugin, type AuthDerive } from "../middleware/auth.js";
import { listQueryDescription } from "../schemas/openapi.js";
import {
  tBatchCreateBodySchema,
  tBatchDeleteBodySchema,
  tBatchUpdateBodySchema,
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

/** Minimal context shape we rely on after authDerivePlugin. */
type AppContext = AuthDerive & {
  body?: unknown;
  query?: unknown;
  params?: { id: string };
  request: Request;
  set: { status?: number | string };
};

export type CrudRoutesConfig = {
  table: TableName;
  prefix: string;
  tags: string[];
  createSchema: TypeBoxObjectSchema;
  updateSchema: TypeBoxObjectSchema;
  listConfig: ListHandlerConfig;
  /** Optional TypeBox schema describing a single response item (for OpenAPI). */
  responseItemSchema?: TypeBoxObjectSchema;
  createTransform?: CreateTransform;
  updateTransform?: (body: Record<string, unknown>) => Record<string, unknown>;
  batchCreateTransform?: BatchCreateTransform;
  getByIdOptions?: GetByIdOptions;
};

function addCrudRoutes(app: unknown, config: CrudRoutesConfig, prefix: string) {
  const {
    table,
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
  return (app as Elysia)
    .post(
      "/",
      (ctx) => {
        const c = ctx as unknown as AppContext;
        return createHandler({
          body: c.body as Record<string, unknown>,
          userId: c.userId,
          set: c.set,
        });
      },
      {
        body: createSchema,
        detail: {
          summary: `Create ${name}`,
          description: "**Body:** from schema below." + AUTH_NOTE,
        },
      },
    )
    .get(
      "/",
      (ctx) => {
        const c = ctx as unknown as AppContext;
        return listHandler({ query: c.query, request: c.request, userId: c.userId, set: c.set });
      },
      {
        query:
          allowedFilters.length === 0
            ? tBaseListQuerySchema
            : tListQuerySchemaWithExtraKeys(allowedFilters),
        detail: { summary: `List ${name}s`, description: listDesc },
        ...(responseItemSchema && {
          response: {
            200: tListResponseSchema(responseItemSchema),
          },
        }),
      },
    )
    .get(
      "/:id",
      (ctx) => {
        const c = ctx as unknown as AppContext;
        return getByIdHandler({ params: c.params!, userId: c.userId, set: c.set });
      },
      {
        params: tIdParamSchema,
        detail: {
          summary: `Get ${name} by ID`,
          description: "Returns 404 if not found or not owned." + AUTH_NOTE,
        },
        ...(responseItemSchema && {
          response: {
            200: responseItemSchema,
          },
        }),
      },
    )
    .put(
      "/:id",
      (ctx) => {
        const c = ctx as unknown as AppContext;
        return updateHandler({
          params: c.params!,
          body: c.body as Record<string, unknown>,
          userId: c.userId,
          set: c.set,
        });
      },
      {
        body: updateSchema,
        detail: { summary: `Update ${name}`, description: "Partial update." + AUTH_NOTE },
      },
    )
    .delete(
      "/:id",
      (ctx) => {
        const c = ctx as unknown as AppContext;
        return deleteHandler({ params: c.params!, userId: c.userId, set: c.set });
      },
      {
        params: tIdParamSchema,
        detail: { summary: `Delete ${name}`, description: "Returns 204." + AUTH_NOTE },
      },
    )
    .post(
      "/batch/create",
      (ctx) => {
        const c = ctx as unknown as AppContext;
        return batchCreateHandler({ body: c.body, userId: c.userId, set: c.set });
      },
      {
        body: tBatchCreateBodySchema(createSchema),
        detail: { summary: `Create multiple ${name}s`, description: AUTH_NOTE.trim() },
      },
    )
    .post(
      "/batch/update",
      (ctx) => {
        const c = ctx as unknown as AppContext;
        return batchUpdateHandler({ body: c.body, userId: c.userId, set: c.set });
      },
      {
        body: tBatchUpdateBodySchema,
        detail: { summary: `Update multiple ${name}s`, description: AUTH_NOTE.trim() },
      },
    )
    .post(
      "/batch/delete",
      (ctx) => {
        const c = ctx as unknown as AppContext;
        return batchDeleteHandler({ body: c.body, userId: c.userId, set: c.set });
      },
      {
        body: tBatchDeleteBodySchema,
        detail: { summary: `Delete multiple ${name}s`, description: AUTH_NOTE.trim() },
      },
    );
}

export function createCrudRoutes(
  appOrConfig: Elysia | CrudRoutesConfig,
  config?: Omit<CrudRoutesConfig, "prefix" | "tags">,
) {
  if (config !== undefined && appOrConfig instanceof Elysia) {
    const app = appOrConfig as Elysia;
    const cfg = (app as unknown as { config?: { prefix?: string; tags?: string[] } }).config;
    const prefix = cfg?.prefix ?? "";
    const tags = cfg?.tags ?? [];
    return addCrudRoutes(app, { ...config, prefix, tags }, prefix);
  }
  const fullConfig = appOrConfig as CrudRoutesConfig;
  const { prefix, tags } = fullConfig;
  const app = new Elysia({ prefix, tags }).use(authDerivePlugin);
  return addCrudRoutes(app, fullConfig, prefix);
}
