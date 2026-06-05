import { Elysia, t } from "elysia";
import { tCreateRefundGroupSchema, tUpdateRefundGroupSchema } from "../schemas/typebox.js";
import { authDerivePlugin, type AuthDerive } from "../middleware/auth.js";
import { listQueryDescription } from "../schemas/openapi.js";
import {
  tBatchCreateBodySchema,
  tBatchDeleteBodySchema,
  tBatchUpdateBodySchema,
  tIdParamSchema,
  tRefundGroupsListQuerySchema,
  tListResponseSchema,
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

function refundGroupCreateTransform(body: Record<string, unknown>, userId: number) {
  return { name: body.name, description: body.description ?? null, user_id: userId };
}

const tRefundGroupResponse = t.Object({
  id: t.Number(),
  user_id: t.Number(),
  name: t.String(),
  description: t.Nullable(t.String()),
});

type AppContext = AuthDerive & {
  body?: unknown;
  query?: unknown;
  params?: { id: string };
  request: Request;
  set: { status?: number | string };
};

const REFUND_GROUPS_TABLE = "refund_groups" as const;
const REFUND_GROUPS_PREFIX = "/refund_groups" as const;
const REFUND_GROUPS_TAGS: string[] = ["refunds"];

const REFUND_GROUPS_LIST_CONFIG: {
  searchFields: string[];
  allowedFilters: string[];
} = {
  searchFields: ["name"],
  allowedFilters: ["id"],
};

export const refundGroupsListHandler = createListHandler(REFUND_GROUPS_TABLE, {
  ...REFUND_GROUPS_LIST_CONFIG,
  useValidatedQuery: true as const,
});
const refundGroupsCreateHandler = createCreateHandler(
  REFUND_GROUPS_TABLE,
  refundGroupCreateTransform,
);
const refundGroupsGetByIdHandler = createGetByIdHandler(REFUND_GROUPS_TABLE);
const refundGroupsUpdateHandler = createUpdateHandler(REFUND_GROUPS_TABLE);
const refundGroupsDeleteHandler = createDeleteByIdHandler(REFUND_GROUPS_TABLE);
const refundGroupsBatchCreateHandler = createBatchCreateHandler(
  REFUND_GROUPS_TABLE,
  refundGroupCreateTransform,
);
const refundGroupsBatchUpdateHandler = createBatchUpdateHandler(REFUND_GROUPS_TABLE);
const refundGroupsBatchDeleteHandler = createBatchDeleteHandler(REFUND_GROUPS_TABLE);

const AUTH_NOTE = " **Header:** Authorization: Bearer <token>.";
const RETURNS_LIST = " **Returns:** { items, total, page, per_page }.";

const refundGroupsListDescription =
  listQueryDescription(
    REFUND_GROUPS_LIST_CONFIG.allowedFilters,
    REFUND_GROUPS_LIST_CONFIG.searchFields,
  ) +
  RETURNS_LIST +
  AUTH_NOTE;

export const refundGroupsRoutes = new Elysia({
  prefix: REFUND_GROUPS_PREFIX,
  tags: [...REFUND_GROUPS_TAGS],
})
  .use(authDerivePlugin)
  .post(
    "/",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return refundGroupsCreateHandler({
        body: c.body as Record<string, unknown>,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tCreateRefundGroupSchema,
      detail: {
        summary: "Create refund group",
        description: "**Body:** from schema below." + AUTH_NOTE,
      },
    },
  )
  .get(
    "/",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return refundGroupsListHandler({
        query: c.query,
        request: c.request,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      query: tRefundGroupsListQuerySchema,
      detail: {
        summary: "List refund groups",
        description: refundGroupsListDescription,
      },
      response: {
        200: tListResponseSchema(tRefundGroupResponse),
      },
    },
  )
  .get(
    "/:id",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return refundGroupsGetByIdHandler({
        params: c.params!,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      params: tIdParamSchema,
      detail: {
        summary: "Get refund group by ID",
        description: "Returns 404 if not found or not owned." + AUTH_NOTE,
      },
      response: {
        200: tRefundGroupResponse,
      },
    },
  )
  .put(
    "/:id",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return refundGroupsUpdateHandler({
        params: c.params!,
        body: c.body as Record<string, unknown>,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tUpdateRefundGroupSchema,
      detail: {
        summary: "Update refund group",
        description: "Partial update." + AUTH_NOTE,
      },
    },
  )
  .delete(
    "/:id",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return refundGroupsDeleteHandler({
        params: c.params!,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      params: tIdParamSchema,
      detail: {
        summary: "Delete refund group",
        description: "Returns 204." + AUTH_NOTE,
      },
    },
  )
  .post(
    "/batch/create",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return refundGroupsBatchCreateHandler({
        body: c.body,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tBatchCreateBodySchema(tCreateRefundGroupSchema),
      detail: {
        summary: "Create multiple refund groups",
        description: AUTH_NOTE.trim(),
      },
    },
  )
  .post(
    "/batch/update",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return refundGroupsBatchUpdateHandler({
        body: c.body,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tBatchUpdateBodySchema,
      detail: {
        summary: "Update multiple refund groups",
        description: AUTH_NOTE.trim(),
      },
    },
  )
  .post(
    "/batch/delete",
    (ctx) => {
      const c = ctx as unknown as AppContext;
      return refundGroupsBatchDeleteHandler({
        body: c.body,
        userId: c.userId,
        set: c.set,
      }) as any;
    },
    {
      body: tBatchDeleteBodySchema,
      detail: {
        summary: "Delete multiple refund groups",
        description: AUTH_NOTE.trim(),
      },
    },
  );
