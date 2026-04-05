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

export {
  tUpdateBudgetSchema as tBudgetUpdateSchema,
  tCreateBudgetSchema as tBudgetUpsertSchema,
} from "./typebox.generated.js";

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

/** Refund line item attached to a transaction on GET /transactions (list/detail). */
export const tTransactionRefundItemSchema = t.Object({
  id: t.Number(),
  amount: t.Number(),
  date: t.Union([t.String(), t.Null()]),
  description: t.Union([t.String(), t.Null()]),
  refund_group_id: t.Union([t.Number(), t.Null()]),
});

/**
 * Enriched transaction row for GET /transactions and GET /transactions/:id
 * (DB row + currency + refund aggregation). `additionalProperties` allows `user_id` and rows
 * returned when `fields=` requests a column subset.
 */
export const tTransactionListItemSchema = t.Object(
  {
    id: t.Number(),
    date: t.String(),
    date_accountability: t.String(),
    description: t.String(),
    amount: t.Number(),
    from_account_id: t.Number(),
    to_account_id: t.Number(),
    type: t.Union([t.Literal("expense"), t.Literal("income"), t.Literal("transfer")]),
    category: t.String(),
    subcategory: t.Optional(t.Union([t.String(), t.Null()])),
    refunded_amount: t.Number(),
    investment_id: t.Optional(t.Nullable(t.Number())),
    to_amount: t.Optional(t.Nullable(t.Number())),
    currency: t.Optional(t.String()),
    from_currency: t.Optional(t.String()),
    to_currency: t.Optional(t.String()),
    /** Booked amount converted to the authenticated user's `users.preferred_currency` (null for cross-currency transfers with two legs). */
    amount_preferred: t.Optional(t.Nullable(t.Number())),
    refunded_amount_preferred: t.Optional(t.Number()),
    net_amount_preferred: t.Optional(t.Nullable(t.Number())),
    refund_items: t.Optional(t.Array(tTransactionRefundItemSchema)),
  },
  { additionalProperties: true },
);

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

/** Transaction row embedded in GET /potential_refunds (matches `TransactionRow` in `potentialRefunds` service). */
export const tPotentialRefundTransactionRow = t.Object(
  {
    id: t.Number(),
    date: t.String(),
    date_accountability: t.Union([t.String(), t.Null()]),
    description: t.String(),
    amount: t.Union([t.String(), t.Number()]),
    to_amount: t.Union([t.String(), t.Null()]),
    to_currency: t.Union([t.String(), t.Null()]),
    from_account_id: t.Number(),
    to_account_id: t.Number(),
    category: t.String(),
    subcategory: t.Union([t.String(), t.Null()]),
    type: t.String(),
    investment_id: t.Union([t.Number(), t.Null()]),
  },
  /** `selectAll()` may include extra columns (e.g. `user_id`); allow them at runtime. */
  { additionalProperties: true },
);

export const tPotentialRefundSuggestedExpense = t.Object(
  {
    transaction: tPotentialRefundTransactionRow,
    score: t.Number(),
  },
  { additionalProperties: false },
);

export const tPotentialRefundItem = t.Object(
  {
    incomeTransaction: tPotentialRefundTransactionRow,
    suggestedExpenses: t.Array(tPotentialRefundSuggestedExpense),
    matchReason: t.String(),
  },
  { additionalProperties: false },
);

/** GET /potential_refunds 200 body. */
export const tPotentialRefundsListResponse = t.Object(
  {
    items: t.Array(tPotentialRefundItem),
  },
  { additionalProperties: false },
);
