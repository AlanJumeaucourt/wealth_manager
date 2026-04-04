/**
 * TypeBox (Elysia.t) schemas for route validation and OpenAPI.
 *
 * **Generated from `src/db/manifest.ts`** (run `bun run codegen`):
 *   - `typebox.generated.ts` — create/update bodies + list/query schemas (`listDefaults`, `CUSTOM_LIST_QUERY_SCHEMAS`)
 *
 * This file adds auth-only request shapes, `tListQuerySchemaWithExtraKeys` (for generic CRUD),
 * and batch/response helpers.
 */
import { t } from "elysia";
import { tListFilterValueSchema, tListQueryBaseProps } from "./typebox.generated.js";

export * from "./typebox.generated.js";

export { tCreateBudgetSchema as tBudgetUpsertSchema } from "./typebox.generated.js";
export { tUpdateBudgetSchema as tBudgetUpdateSchema } from "./typebox.generated.js";

// --- Users: auth-specific shapes (register/login/preferred_currency) ---

export const tRegisterSchema = t.Object({
  name: t.String({ minLength: 1 }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
});

export const tLoginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 1 }),
});

export const tPreferredCurrencySchema = t.Object({
  preferred_currency: t.String({ minLength: 1 }),
});

/**
 * Dynamic list query (extra filter keys). Runtime validation matches `createListHandler`.
 * Prefer manifest-driven `t*ListQuerySchema` / `tBaseListQuerySchema` in `typebox.generated.ts`
 * for Eden/OpenAPI types.
 */
export function tListQuerySchemaWithExtraKeys(extraKeys: readonly string[]) {
  const extraProps = Object.fromEntries(
    [...new Set(extraKeys)].map((k) => [k, t.Optional(tListFilterValueSchema)]),
  ) as Record<string, unknown>;

  return t.Object(
    {
      ...tListQueryBaseProps,
      ...extraProps,
    },
    { additionalProperties: false },
  );
}

export const tIdParamSchema = t.Object({ id: t.String() });

export function tListResponseSchema<T extends ReturnType<typeof t.Object>>(itemSchema: T) {
  return t.Object({
    items: t.Array(itemSchema),
    total: t.Number(),
    page: t.Number(),
    per_page: t.Number(),
  });
}

export function tBatchCreateBodySchema(itemSchema: ReturnType<typeof t.Object>) {
  return t.Object({ items: t.Array(itemSchema, { minItems: 1 }) });
}

export const tBatchUpdateBodySchema = t.Object({
  items: t.Array(t.Object({ id: t.Number({ minimum: 1 }) }, { additionalProperties: true }), {
    minItems: 1,
  }),
});

export const tBatchDeleteBodySchema = t.Object({
  ids: t.Array(t.Number({ minimum: 1 }), { minItems: 1 }),
});

/** Partial object for flexible updates (any extra keys allowed). */
export const tPartialUpdateSchema = t.Object({}, { additionalProperties: true });

/** GET /accounts/balance_over_time — optional `include_debt` excludes loan balances when false (gross assets). */
export const tBalanceOverTimeQuerySchema = t.Object(
  {
    start_date: t.String(),
    end_date: t.String(),
    include_debt: t.Optional(t.Union([t.Literal("true"), t.Literal("false")])),
  },
  { additionalProperties: false },
);
