import { Elysia, t } from "elysia";
import { authDerivePlugin, type AuthDerive } from "../middleware/auth.js";
import { listQueryDescription } from "../schemas/openapi.js";
import {
  tBatchCreateBodySchema,
  tBatchDeleteBodySchema,
  tBatchUpdateBodySchema,
  tCreateBankSchema,
  tIdParamSchema,
  tBanksListQuerySchema,
  tListResponseSchema,
  tUpdateBankSchema,
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

const tBankResponse = t.Object({
  id: t.Number(),
  user_id: t.Number(),
  name: t.String(),
  website: t.Nullable(t.String()),
});

type AppContext = AuthDerive & {
  body?: unknown;
  query?: unknown;
  params?: { id: string };
  request: Request;
  set: { status?: number | string };
};

const BANKS_TABLE = "banks" as const;
const BANKS_PREFIX = "/banks" as const;
const BANKS_TAGS: string[] = ["accounts"];

const BANKS_LIST_CONFIG: {
  searchFields: string[];
  allowedFilters: string[];
} = {
  searchFields: ["name"],
  allowedFilters: ["id"],
};

const banksListHandler = createListHandler(BANKS_TABLE, {
  ...BANKS_LIST_CONFIG,
  useValidatedQuery: true as const,
});
const banksCreateHandler = createCreateHandler(BANKS_TABLE);
const banksGetByIdHandler = createGetByIdHandler(BANKS_TABLE);
const banksUpdateHandler = createUpdateHandler(BANKS_TABLE);
const banksDeleteHandler = createDeleteByIdHandler(BANKS_TABLE);
const banksBatchCreateHandler = createBatchCreateHandler(BANKS_TABLE);
const banksBatchUpdateHandler = createBatchUpdateHandler(BANKS_TABLE);
const banksBatchDeleteHandler = createBatchDeleteHandler(BANKS_TABLE);

const AUTH_NOTE = " **Header:** Authorization: Bearer <token>.";
const RETURNS_LIST = " **Returns:** { items, total, page, per_page }.";

const banksListDescription =
  listQueryDescription(BANKS_LIST_CONFIG.allowedFilters, BANKS_LIST_CONFIG.searchFields) +
  RETURNS_LIST +
  AUTH_NOTE;

export const banksRoutes = new Elysia({ prefix: BANKS_PREFIX, tags: [...BANKS_TAGS] })
  .use(authDerivePlugin)
  .post(
    "/",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return banksCreateHandler({
        body: c.body as Record<string, unknown>,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tCreateBankSchema,
      detail: {
        summary: "Create bank",
        description: "**Body:** from schema below." + AUTH_NOTE,
      },
    },
  )
  .get(
    "/",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return banksListHandler({
        query: c.query,
        request: c.request,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      query: tBanksListQuerySchema,
      detail: {
        summary: "List banks",
        description: banksListDescription,
      },
      response: {
        200: tListResponseSchema(tBankResponse),
      },
    },
  )
  .get(
    "/:id",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return banksGetByIdHandler({
        params: c.params!,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      params: tIdParamSchema,
      detail: {
        summary: "Get bank by ID",
        description: "Returns 404 if not found or not owned." + AUTH_NOTE,
      },
      response: {
        200: tBankResponse,
      },
    },
  )
  .put(
    "/:id",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return banksUpdateHandler({
        params: c.params!,
        body: c.body as Record<string, unknown>,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tUpdateBankSchema,
      detail: {
        summary: "Update bank",
        description: "Partial update." + AUTH_NOTE,
      },
    },
  )
  .delete(
    "/:id",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return banksDeleteHandler({
        params: c.params!,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      params: tIdParamSchema,
      detail: {
        summary: "Delete bank",
        description: "Returns 204." + AUTH_NOTE,
      },
    },
  )
  .post(
    "/batch/create",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return banksBatchCreateHandler({
        body: c.body,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tBatchCreateBodySchema(tCreateBankSchema),
      detail: {
        summary: "Create multiple banks",
        description: AUTH_NOTE.trim(),
      },
    },
  )
  .post(
    "/batch/update",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return banksBatchUpdateHandler({
        body: c.body,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tBatchUpdateBodySchema,
      detail: {
        summary: "Update multiple banks",
        description: AUTH_NOTE.trim(),
      },
    },
  )
  .post(
    "/batch/delete",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return banksBatchDeleteHandler({
        body: c.body,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tBatchDeleteBodySchema,
      detail: {
        summary: "Delete multiple banks",
        description: AUTH_NOTE.trim(),
      },
    },
  );
