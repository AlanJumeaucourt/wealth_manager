import { Elysia, t } from "elysia";
import { authDerivePlugin, type AuthDerive } from "../middleware/auth.js";
import { listQueryDescription } from "../schemas/openapi.js";
import {
  tBatchCreateBodySchema,
  tBatchDeleteBodySchema,
  tBatchUpdateBodySchema,
  tCreateAssetSchema,
  tIdParamSchema,
  tAssetsListQuerySchema,
  tListResponseSchema,
  tUpdateAssetSchema,
} from "../schemas/typebox.js";
import {
  createBatchCreateHandler,
  createBatchDeleteHandler,
  createBatchUpdateHandler,
  createCreateHandler,
  createDeleteByIdHandler,
  createGetByIdHandler,
  createListHandler,
  createUpdateHandler,
} from "../utils/crudHandlers.js";
import { stringifyUnknown } from "../utils/stringifyUnknown.js";

function assetCreateTransform(body: Record<string, unknown>, userId: number) {
  const symbol = stringifyUnknown(body.symbol).trim().toUpperCase();
  const name = (stringifyUnknown(body.name).trim() || symbol) as string;
  return { symbol, name, user_id: userId };
}

const tAssetResponse = t.Object({
  id: t.Number(),
  user_id: t.Number(),
  symbol: t.String(),
  name: t.String(),
});

type AppContext = AuthDerive & {
  body?: unknown;
  query?: unknown;
  params?: { id: string };
  request: Request;
  set: { status?: number | string };
};

const ASSETS_TABLE = "assets" as const;
const ASSETS_PREFIX = "/assets" as const;
const ASSETS_TAGS: string[] = ["assets"];

const ASSETS_LIST_CONFIG: {
  searchFields: string[];
  allowedFilters: string[];
} = {
  searchFields: ["symbol", "name"],
  allowedFilters: ["symbol"],
};

const assetsListHandler = createListHandler(ASSETS_TABLE, {
  ...ASSETS_LIST_CONFIG,
  useValidatedQuery: true as const,
  filterTransform: (_q, filters) =>
    filters.symbol && typeof filters.symbol === "string"
      ? { ...filters, symbol: (filters.symbol as string).toUpperCase() }
      : filters,
});
const assetsCreateHandler = createCreateHandler(ASSETS_TABLE, assetCreateTransform);
const assetsGetByIdHandler = createGetByIdHandler(ASSETS_TABLE);
const assetsUpdateHandler = createUpdateHandler(ASSETS_TABLE);
const assetsDeleteHandler = createDeleteByIdHandler(ASSETS_TABLE);
const assetsBatchCreateHandler = createBatchCreateHandler(ASSETS_TABLE, assetCreateTransform);
const assetsBatchUpdateHandler = createBatchUpdateHandler(ASSETS_TABLE);
const assetsBatchDeleteHandler = createBatchDeleteHandler(ASSETS_TABLE);

const AUTH_NOTE = " **Header:** Authorization: Bearer <token>.";
const RETURNS_LIST = " **Returns:** { items, total, page, per_page }.";

const assetsListDescription =
  listQueryDescription(ASSETS_LIST_CONFIG.allowedFilters, ASSETS_LIST_CONFIG.searchFields) +
  RETURNS_LIST +
  AUTH_NOTE;

export const assetsRoutes = new Elysia({ prefix: ASSETS_PREFIX, tags: [...ASSETS_TAGS] })
  .use(authDerivePlugin)
  .post(
    "/",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return assetsCreateHandler({
        body: c.body as Record<string, unknown>,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tCreateAssetSchema,
      detail: {
        summary: "Create asset",
        description: "**Body:** from schema below." + AUTH_NOTE,
      },
    },
  )
  .get(
    "/",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return assetsListHandler({
        query: c.query,
        request: c.request,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      query: tAssetsListQuerySchema,
      detail: {
        summary: "List assets",
        description: assetsListDescription,
      },
      response: {
        200: tListResponseSchema(tAssetResponse),
      },
    },
  )
  .get(
    "/:id",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return assetsGetByIdHandler({
        params: c.params!,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      params: tIdParamSchema,
      detail: {
        summary: "Get asset by ID",
        description: "Returns 404 if not found or not owned." + AUTH_NOTE,
      },
      response: {
        200: tAssetResponse,
      },
    },
  )
  .put(
    "/:id",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return assetsUpdateHandler({
        params: c.params!,
        body: c.body as Record<string, unknown>,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tUpdateAssetSchema,
      detail: {
        summary: "Update asset",
        description: "Partial update." + AUTH_NOTE,
      },
    },
  )
  .delete(
    "/:id",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return assetsDeleteHandler({
        params: c.params!,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      params: tIdParamSchema,
      detail: {
        summary: "Delete asset",
        description: "Returns 204." + AUTH_NOTE,
      },
    },
  )
  .post(
    "/batch/create",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return assetsBatchCreateHandler({
        body: c.body,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tBatchCreateBodySchema(tCreateAssetSchema),
      detail: {
        summary: "Create multiple assets",
        description: AUTH_NOTE.trim(),
      },
    },
  )
  .post(
    "/batch/update",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return assetsBatchUpdateHandler({
        body: c.body,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tBatchUpdateBodySchema,
      detail: {
        summary: "Update multiple assets",
        description: AUTH_NOTE.trim(),
      },
    },
  )
  .post(
    "/batch/delete",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return assetsBatchDeleteHandler({
        body: c.body,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tBatchDeleteBodySchema,
      detail: {
        summary: "Delete multiple assets",
        description: AUTH_NOTE.trim(),
      },
    },
  );
