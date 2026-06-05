/** Generated from src/db/manifest.ts - do not edit by hand. */
import { t } from "elysia";
import { LIST_QUERY_PER_PAGE_MAX } from "./common.js";

export const tCreateBankSchema = t.Object({
  name: t.String({ minLength: 1 }),
  website: t.Optional(t.Nullable(t.String())),
});

export const tUpdateBankSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  website: t.Optional(t.Nullable(t.String())),
});

export const tCreateAccountSchema = t.Object({
  name: t.String({ minLength: 1 }),
  type: t.Union([
    t.Literal("asset"),
    t.Literal("loan"),
    t.Literal("investment"),
    t.Literal("income"),
    t.Literal("expense"),
    t.Literal("checking"),
    t.Literal("savings"),
  ]),
  bank_id: t.Number({ minimum: 1 }),
  currency: t.Optional(t.Union([t.Null(), t.String()])),
});

export const tUpdateAccountSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  type: t.Optional(
    t.Union([
      t.Literal("asset"),
      t.Literal("loan"),
      t.Literal("investment"),
      t.Literal("income"),
      t.Literal("expense"),
      t.Literal("checking"),
      t.Literal("savings"),
    ]),
  ),
  bank_id: t.Optional(t.Number({ minimum: 1 })),
  currency: t.Optional(t.Union([t.Null(), t.String()])),
});

export const tCreateAssetSchema = t.Object({
  symbol: t.String({ minLength: 1 }),
  name: t.String({ minLength: 1 }),
});

export const tUpdateAssetSchema = t.Object({
  symbol: t.Optional(t.String({ minLength: 1 })),
  name: t.Optional(t.String({ minLength: 1 })),
});

export const tCreateRefundGroupSchema = t.Object({
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.Nullable(t.String())),
});

export const tUpdateRefundGroupSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  description: t.Optional(t.Nullable(t.String())),
});

export const tCreateTransactionSchema = t.Object({
  date: t.String(),
  date_accountability: t.String(),
  description: t.String({ minLength: 1 }),
  amount: t.Number({ minimum: 0.000001 }),
  to_amount: t.Optional(t.Nullable(t.Number({ minimum: 0.000001 }))),
  to_currency: t.Optional(t.Nullable(t.String())),
  from_account_id: t.Number({ minimum: 1 }),
  to_account_id: t.Number({ minimum: 1 }),
  category: t.String({ minLength: 1 }),
  subcategory: t.Optional(t.Nullable(t.String())),
  type: t.Union([t.Literal("expense"), t.Literal("income"), t.Literal("transfer")]),
  investment_id: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
});

export const tUpdateTransactionSchema = t.Object({
  date: t.Optional(t.String()),
  date_accountability: t.Optional(t.String()),
  description: t.Optional(t.String({ minLength: 1 })),
  amount: t.Optional(t.Number({ minimum: 0.000001 })),
  to_amount: t.Optional(t.Nullable(t.Number({ minimum: 0.000001 }))),
  to_currency: t.Optional(t.Nullable(t.String())),
  from_account_id: t.Optional(t.Number({ minimum: 1 })),
  to_account_id: t.Optional(t.Number({ minimum: 1 })),
  category: t.Optional(t.String({ minLength: 1 })),
  subcategory: t.Optional(t.Nullable(t.String())),
  type: t.Optional(t.Union([t.Literal("expense"), t.Literal("income"), t.Literal("transfer")])),
  investment_id: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
});

export const tCreateBudgetSchema = t.Object({
  category: t.String({ minLength: 1 }),
  year: t.Number({ minimum: 1900, maximum: 3000 }),
  month: t.Number({ minimum: 1, maximum: 12 }),
  amount: t.Union([t.String(), t.Number()]),
});

export const tUpdateBudgetSchema = t.Object({
  category: t.Optional(t.String({ minLength: 1 })),
  year: t.Optional(t.Number({ minimum: 1900, maximum: 3000 })),
  month: t.Optional(t.Number({ minimum: 1, maximum: 12 })),
  amount: t.Optional(t.Union([t.String(), t.Number()])),
});

export const tCreateUserSchema = t.Object({
  name: t.String({ minLength: 1 }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  last_login: t.Optional(t.Nullable(t.String())),
  preferred_currency: t.String(),
});

export const tUpdateUserSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  email: t.Optional(t.String({ format: "email" })),
  password: t.Optional(t.String({ minLength: 6 })),
  last_login: t.Optional(t.Nullable(t.String())),
  preferred_currency: t.Optional(t.String()),
});

export const tCreateRefundItemSchema = t.Object({
  income_transaction_id: t.Number({ minimum: 1 }),
  expense_transaction_id: t.Number({ minimum: 1 }),
  amount: t.Number(),
  refund_group_id: t.Optional(t.Nullable(t.Number())),
  description: t.Optional(t.Nullable(t.String())),
});

export const tUpdateRefundItemSchema = t.Object({
  income_transaction_id: t.Optional(t.Number({ minimum: 1 })),
  expense_transaction_id: t.Optional(t.Number({ minimum: 1 })),
  amount: t.Optional(t.Number()),
  refund_group_id: t.Optional(t.Nullable(t.Number())),
  description: t.Optional(t.Nullable(t.String())),
});

export const tCreateLiabilitySchema = t.Object({
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.Nullable(t.String())),
  liability_type: t.String(),
  principal_amount: t.String(),
  interest_rate: t.String(),
  start_date: t.String(),
  end_date: t.Optional(t.Nullable(t.String())),
  compounding_period: t.String(),
  payment_frequency: t.String(),
  payment_amount: t.Optional(t.Nullable(t.String())),
  deferral_period_months: t.Number(),
  deferral_type: t.Optional(t.Nullable(t.String())),
  direction: t.String(),
  account_id: t.Optional(t.Nullable(t.Number())),
  lender_name: t.Optional(t.Nullable(t.String())),
  currency: t.Optional(t.Union([t.Null(), t.String()])),
  capitalization_frequency: t.Optional(t.Nullable(t.String())),
  interest_calculation: t.Optional(t.Nullable(t.String())),
  first_period_days: t.Optional(t.Nullable(t.Number())),
});

export const tUpdateLiabilitySchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  description: t.Optional(t.Nullable(t.String())),
  liability_type: t.Optional(t.String()),
  principal_amount: t.Optional(t.String()),
  interest_rate: t.Optional(t.String()),
  start_date: t.Optional(t.String()),
  end_date: t.Optional(t.Nullable(t.String())),
  compounding_period: t.Optional(t.String()),
  payment_frequency: t.Optional(t.String()),
  payment_amount: t.Optional(t.Nullable(t.String())),
  deferral_period_months: t.Optional(t.Number()),
  deferral_type: t.Optional(t.Nullable(t.String())),
  direction: t.Optional(t.String()),
  account_id: t.Optional(t.Nullable(t.Number())),
  lender_name: t.Optional(t.Nullable(t.String())),
  currency: t.Optional(t.Union([t.Null(), t.String()])),
  capitalization_frequency: t.Optional(t.Nullable(t.String())),
  interest_calculation: t.Optional(t.Nullable(t.String())),
  first_period_days: t.Optional(t.Nullable(t.Number())),
});

export const tCreateInvestmentDetailSchema = t.Object({
  transaction_id: t.Number(),
  asset_id: t.Number(),
  quantity: t.String(),
  unit_price: t.String(),
  fee: t.String(),
  tax: t.String(),
  total_paid: t.Optional(t.Nullable(t.String())),
  investment_type: t.Union([
    t.Literal("Buy"),
    t.Literal("Sell"),
    t.Literal("Dividend"),
    t.Literal("Interest"),
    t.Literal("Deposit"),
    t.Literal("Withdrawal"),
  ]),
  pl_transaction_id: t.Optional(t.Nullable(t.Number())),
  fee_transaction_id: t.Optional(t.Nullable(t.Number())),
  tax_transaction_id: t.Optional(t.Nullable(t.Number())),
  gain_loss_override: t.Optional(t.Nullable(t.String())),
  gain_loss_source: t.Optional(t.Nullable(t.String())),
  gain_loss_calculated: t.Optional(t.Nullable(t.String())),
});

export const tUpdateInvestmentDetailSchema = t.Object({
  transaction_id: t.Optional(t.Number()),
  asset_id: t.Optional(t.Number()),
  quantity: t.Optional(t.String()),
  unit_price: t.Optional(t.String()),
  fee: t.Optional(t.String()),
  tax: t.Optional(t.String()),
  total_paid: t.Optional(t.Nullable(t.String())),
  investment_type: t.Optional(
    t.Union([
      t.Literal("Buy"),
      t.Literal("Sell"),
      t.Literal("Dividend"),
      t.Literal("Interest"),
      t.Literal("Deposit"),
      t.Literal("Withdrawal"),
    ]),
  ),
  pl_transaction_id: t.Optional(t.Nullable(t.Number())),
  fee_transaction_id: t.Optional(t.Nullable(t.Number())),
  tax_transaction_id: t.Optional(t.Nullable(t.Number())),
  gain_loss_override: t.Optional(t.Nullable(t.String())),
  gain_loss_source: t.Optional(t.Nullable(t.String())),
  gain_loss_calculated: t.Optional(t.Nullable(t.String())),
});

export const tCreateStockCacheSchema = t.Object({
  symbol: t.String(),
  cache_type: t.String(),
  data: t.String(),
  last_updated: t.String(),
});

export const tUpdateStockCacheSchema = t.Object({
  symbol: t.Optional(t.String()),
  cache_type: t.Optional(t.String()),
  data: t.Optional(t.String()),
  last_updated: t.Optional(t.String()),
});

export const tCreateGocardlessAgreementSchema = t.Object({
  agreement_id: t.String(),
  institution_id: t.String(),
  max_historical_days: t.Number(),
  access_valid_for_days: t.Number(),
  access_scope: t.String(),
  user_id: t.Number(),
  created_at: t.String(),
});

export const tUpdateGocardlessAgreementSchema = t.Object({
  agreement_id: t.Optional(t.String()),
  institution_id: t.Optional(t.String()),
  max_historical_days: t.Optional(t.Number()),
  access_valid_for_days: t.Optional(t.Number()),
  access_scope: t.Optional(t.String()),
  user_id: t.Optional(t.Number()),
  created_at: t.Optional(t.String()),
});

export const tCreateGocardlessRequisitionSchema = t.Object({
  requisition_id: t.String(),
  link: t.String(),
  user_id: t.Number(),
  institution_id: t.String(),
  reference: t.Optional(t.Nullable(t.String())),
  agreement_id: t.Optional(t.Nullable(t.String())),
  created_at: t.Optional(t.Nullable(t.String())),
});

export const tUpdateGocardlessRequisitionSchema = t.Object({
  requisition_id: t.Optional(t.String()),
  link: t.Optional(t.String()),
  user_id: t.Optional(t.Number()),
  institution_id: t.Optional(t.String()),
  reference: t.Optional(t.Nullable(t.String())),
  agreement_id: t.Optional(t.Nullable(t.String())),
  created_at: t.Optional(t.Nullable(t.String())),
});

export const tCreateGocardlessAccountSchema = t.Object({
  account_id: t.String(),
  created_at: t.String(),
  last_accessed: t.String(),
  iban: t.Optional(t.Nullable(t.String())),
  institution_id: t.String(),
  status: t.Optional(t.Nullable(t.String())),
  owner_name: t.Optional(t.Nullable(t.String())),
  currency: t.Optional(t.Union([t.Null(), t.String()])),
  balance: t.Optional(t.Nullable(t.Number())),
  account_type: t.Optional(t.Nullable(t.String())),
  user_id: t.Number(),
});

export const tUpdateGocardlessAccountSchema = t.Object({
  account_id: t.Optional(t.String()),
  created_at: t.Optional(t.String()),
  last_accessed: t.Optional(t.String()),
  iban: t.Optional(t.Nullable(t.String())),
  institution_id: t.Optional(t.String()),
  status: t.Optional(t.Nullable(t.String())),
  owner_name: t.Optional(t.Nullable(t.String())),
  currency: t.Optional(t.Union([t.Null(), t.String()])),
  balance: t.Optional(t.Nullable(t.Number())),
  account_type: t.Optional(t.Nullable(t.String())),
  user_id: t.Optional(t.Number()),
});

export const tCreateGocardlessCacheSchema = t.Object({
  cache_key: t.String(),
  cache_type: t.String(),
  data: t.String(),
  last_updated: t.String(),
});

export const tUpdateGocardlessCacheSchema = t.Object({
  cache_key: t.Optional(t.String()),
  cache_type: t.Optional(t.String()),
  data: t.Optional(t.String()),
  last_updated: t.Optional(t.String()),
});

export const tCreateCustomPriceSchema = t.Object({
  symbol: t.String(),
  date: t.String(),
  open: t.String(),
  high: t.String(),
  low: t.String(),
  close: t.String(),
  volume: t.Number(),
  created_at: t.String(),
  updated_at: t.String(),
  user_id: t.Number(),
});

export const tUpdateCustomPriceSchema = t.Object({
  symbol: t.Optional(t.String()),
  date: t.Optional(t.String()),
  open: t.Optional(t.String()),
  high: t.Optional(t.String()),
  low: t.Optional(t.String()),
  close: t.Optional(t.String()),
  volume: t.Optional(t.Number()),
  created_at: t.Optional(t.String()),
  updated_at: t.Optional(t.String()),
  user_id: t.Optional(t.Number()),
});

export const tCreateLiabilityPaymentDetailSchema = t.Object({
  transaction_id: t.Number(),
  user_id: t.Number(),
  liability_id: t.Number(),
  payment_date: t.String(),
  amount: t.String(),
  principal_amount: t.String(),
  interest_amount: t.String(),
  extra_payment: t.String(),
  created_at: t.Optional(t.Nullable(t.String())),
  updated_at: t.Optional(t.Nullable(t.String())),
});

export const tUpdateLiabilityPaymentDetailSchema = t.Object({
  transaction_id: t.Optional(t.Number()),
  user_id: t.Optional(t.Number()),
  liability_id: t.Optional(t.Number()),
  payment_date: t.Optional(t.String()),
  amount: t.Optional(t.String()),
  principal_amount: t.Optional(t.String()),
  interest_amount: t.Optional(t.String()),
  extra_payment: t.Optional(t.String()),
  created_at: t.Optional(t.Nullable(t.String())),
  updated_at: t.Optional(t.Nullable(t.String())),
});

export const tCreateLiabilityScheduleOverrideSchema = t.Object({
  user_id: t.Number(),
  liability_id: t.Number(),
  payment_number: t.Number(),
  payment_date: t.String(),
  scheduled_date: t.String(),
  payment_amount: t.String(),
  principal_amount: t.String(),
  interest_amount: t.String(),
  capitalized_interest: t.String(),
  remaining_principal: t.String(),
  is_deferred: t.Number(),
  deferral_type: t.String(),
  created_at: t.Optional(t.Nullable(t.String())),
  updated_at: t.Optional(t.Nullable(t.String())),
});

export const tUpdateLiabilityScheduleOverrideSchema = t.Object({
  user_id: t.Optional(t.Number()),
  liability_id: t.Optional(t.Number()),
  payment_number: t.Optional(t.Number()),
  payment_date: t.Optional(t.String()),
  scheduled_date: t.Optional(t.String()),
  payment_amount: t.Optional(t.String()),
  principal_amount: t.Optional(t.String()),
  interest_amount: t.Optional(t.String()),
  capitalized_interest: t.Optional(t.String()),
  remaining_principal: t.Optional(t.String()),
  is_deferred: t.Optional(t.Number()),
  deferral_type: t.Optional(t.String()),
  created_at: t.Optional(t.Nullable(t.String())),
  updated_at: t.Optional(t.Nullable(t.String())),
});

export const tCreateLiabilityGeneratedTransactionSchema = t.Object({
  user_id: t.Number(),
  liability_id: t.Number(),
  transaction_id: t.Number(),
  kind: t.String(),
  schedule_payment_number: t.Number(),
  schedule_date: t.String(),
  created_at: t.Optional(t.Nullable(t.String())),
});

export const tUpdateLiabilityGeneratedTransactionSchema = t.Object({
  user_id: t.Optional(t.Number()),
  liability_id: t.Optional(t.Number()),
  transaction_id: t.Optional(t.Number()),
  kind: t.Optional(t.String()),
  schedule_payment_number: t.Optional(t.Number()),
  schedule_date: t.Optional(t.String()),
  created_at: t.Optional(t.Nullable(t.String())),
});

export const tCreateDismissedPotentialRefundSchema = t.Object({
  user_id: t.Number(),
  income_transaction_id: t.Number(),
  created_at: t.String(),
});

export const tUpdateDismissedPotentialRefundSchema = t.Object({
  user_id: t.Optional(t.Number()),
  income_transaction_id: t.Optional(t.Number()),
  created_at: t.Optional(t.String()),
});

export const tCreateInvestmentSchema = t.Object({
  date: t.String(),
  asset_id: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
  symbol: t.Optional(t.String({ minLength: 1 })),
  name: t.Optional(t.String()),
  activity_type: t.Union([
    t.Literal("Buy"),
    t.Literal("Sell"),
    t.Literal("Dividend"),
    t.Literal("Interest"),
    t.Literal("Deposit"),
    t.Literal("Withdrawal"),
  ]),
  quantity: t.Number(),
  unit_price: t.Number(),
  fee: t.Number({ minimum: 0 }),
  tax: t.Number({ minimum: 0 }),
  from_account_id: t.Number({ minimum: 1 }),
  to_account_id: t.Number({ minimum: 1 }),
  gain_loss_override: t.Optional(t.Nullable(t.Number())),
});

export const tUpdateInvestmentSchema = t.Object({
  date: t.Optional(t.String()),
  asset_id: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
  symbol: t.Optional(t.String({ minLength: 1 })),
  name: t.Optional(t.String()),
  activity_type: t.Optional(
    t.Union([
      t.Literal("Buy"),
      t.Literal("Sell"),
      t.Literal("Dividend"),
      t.Literal("Interest"),
      t.Literal("Deposit"),
      t.Literal("Withdrawal"),
    ]),
  ),
  quantity: t.Optional(t.Number()),
  unit_price: t.Optional(t.Number()),
  fee: t.Optional(t.Number({ minimum: 0 })),
  tax: t.Optional(t.Number({ minimum: 0 })),
  from_account_id: t.Optional(t.Number({ minimum: 1 })),
  to_account_id: t.Optional(t.Number({ minimum: 1 })),
  gain_loss_override: t.Optional(t.Nullable(t.Number())),
});

/** --- List query (from manifest listDefaults + CUSTOM_LIST_QUERY_SCHEMAS) --- */
export const tListQueryBaseProps = {
  page: t.Optional(t.Number({ minimum: 1 })),
  per_page: t.Optional(t.Number({ minimum: 1, maximum: LIST_QUERY_PER_PAGE_MAX })),
  sort_by: t.Optional(t.String()),
  sort_order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
  search: t.Optional(t.String()),
  search_fields: t.Optional(t.String()),
  fields: t.Optional(t.String()),
} as const;

export const tListFilterValueSchema = t.Union([
  t.String(),
  t.Number(),
  t.Array(t.String()),
  t.Array(t.Number()),
]);

const F = t.Optional(tListFilterValueSchema);

export const tBaseListQuerySchema = t.Object(
  { ...tListQueryBaseProps },
  { additionalProperties: false },
);

export const tListQuerySchema = tBaseListQuerySchema;

export const tBanksListQuerySchema = t.Object(
  {
    ...tListQueryBaseProps,
    id: F,
  },
  { additionalProperties: false },
);

export const tAccountsListQuerySchema = t.Object(
  {
    ...tListQueryBaseProps,
    bank_id: F,
    id: F,
    type: F,
  },
  { additionalProperties: false },
);

export const tAssetsListQuerySchema = t.Object(
  {
    ...tListQueryBaseProps,
    symbol: F,
  },
  { additionalProperties: false },
);

export const tRefundGroupsListQuerySchema = t.Object(
  {
    ...tListQueryBaseProps,
    id: F,
  },
  { additionalProperties: false },
);

export const tTransactionsListQuerySchema = t.Object(
  {
    ...tListQueryBaseProps,
    account_id: F,
    amount: F,
    category: F,
    date: F,
    date_accountability: F,
    description: F,
    from_account_id: F,
    from_date: F,
    has_refund: F,
    id: F,
    subcategory: F,
    to_account_id: F,
    to_date: F,
    type: F,
  },
  { additionalProperties: false },
);

export const tRefundItemsListQuerySchema = t.Object(
  {
    ...tListQueryBaseProps,
    expense_transaction_id: F,
    id: F,
    income_transaction_id: F,
    refund_group_id: F,
  },
  { additionalProperties: false },
);

export const tLiabilitiesListQuerySchema = t.Object(
  {
    ...tListQueryBaseProps,
    account_id: F,
    direction: F,
    id: F,
    liability_type: F,
  },
  { additionalProperties: false },
);

export const tLiabilityPaymentsListQuerySchema = t.Object(
  {
    ...tListQueryBaseProps,
    id: F,
    liability_id: F,
    payment_date: F,
    amount: F,
    principal_amount: F,
    interest_amount: F,
    extra_payment: F,
    transaction_id: F,
  },
  { additionalProperties: false },
);

export const tLiabilitiesPaymentStatusQuerySchema = t.Object(
  {
    ...tListQueryBaseProps,
    status: F,
    liability_id: F,
    account_id: F,
    days_ahead: F,
    from_date: F,
    to_date: F,
    direction: F,
    liability_type: F,
  },
  { additionalProperties: false },
);

export const tLiabilitiesSchedulePaymentsQuerySchema = t.Object(
  {
    ...tListQueryBaseProps,
    liability_id: F,
    account_id: F,
    days_ahead: F,
    from_date: F,
    to_date: F,
    direction: F,
    liability_type: F,
  },
  { additionalProperties: false },
);

export const tPotentialRefundsListQuerySchema = t.Object(
  {
    limit: t.Optional(t.Number({ minimum: 1, maximum: 200 })),
  },
  { additionalProperties: false },
);

export const tStocksSearchQuerySchema = t.Object(
  {
    q: t.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const tStocksHistoryQuerySchema = t.Object(
  {
    period: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export const tInvestmentsPortfolioSummaryQuerySchema = t.Object(
  {
    account_id: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export const tInvestmentsPortfolioPerformanceQuerySchema = t.Object(
  {
    period: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export const tDateRangeQuerySchema = t.Object(
  {
    start_date: t.String(),
    end_date: t.String(),
  },
  { additionalProperties: false },
);

export const tBudgetsSummaryPeriodQuerySchema = t.Object(
  {
    start_date: t.String(),
    end_date: t.String(),
    period: t.String(),
  },
  { additionalProperties: false },
);

export const tBudgetsTransactionsByCategoriesQuerySchema = t.Object(
  {
    start_date: t.String(),
    end_date: t.String(),
    type: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export const tBudgetsLegacyListQuerySchema = t.Object(
  {
    year: t.Optional(t.String()),
    month: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export const tBudgetsCompareQuerySchema = t.Object(
  {
    year: t.String(),
    month: t.String(),
  },
  { additionalProperties: false },
);

export const tBudgetsDateRangeQuerySchema = tDateRangeQuerySchema;
