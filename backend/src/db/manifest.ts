/**
 * Single source of truth for table and API shapes.
 * Codegen uses this to generate:
 *   - src/db/schema.generated.ts (Kysely types)
 *   - src/schemas/typebox.generated.ts (Elysia create/update + list/query from `listDefaults` + `CUSTOM_LIST_QUERY_SCHEMAS`)
 *   - Optional: SQL reference (NOT NULL, types)
 *
 * Run: bun run scripts/codegen-from-manifest.ts
 */

export type SqlType = "INTEGER" | "TEXT" | "REAL" | "NUMERIC" | "BLOB";

export type ColumnKind =
  | "generated" // id, created_at, etc. – not in create body
  | "server"; // user_id – set by server, not in create body

export interface ListDefaults {
  /** Default search_fields for list endpoints (e.g. ["name"]) */
  defaultSearchFields?: readonly string[];
  /** Default allowed filters for list endpoints (validated at route level) */
  defaultFilters?: readonly string[];
  /** Default sort_by field name for list endpoints */
  defaultSortBy?: string;
  /**
   * Extra query keys for list TypeBox (e.g. transactions: account_id, has_refund, from_date, to_date).
   * Merged with `defaultFilters` for codegen `t*ListQuerySchema`.
   */
  listQueryExtraKeys?: readonly string[];
}

export interface ColumnDef {
  name: string;
  sqlType: SqlType;
  /** NOT NULL in DB and required in create body (unless kind is generated/server) */
  required: boolean;
  /** Nullable in DB (e.g. description string | null) */
  nullable?: boolean;
  /** Omit from API create body */
  kind?: ColumnKind;
  /** In API create body, field is optional (e.g. default applied in handler) */
  optionalInCreate?: boolean;
  /** For enums: TS literal union and validation */
  enumValues?: readonly string[];
  /** API/TypeBox only: use number then coerce to string in DB (e.g. amount) */
  apiNumber?: boolean;
  /** API accepts string or number (e.g. quantity, budget amount) */
  apiUnionStringNumber?: boolean;
  minLength?: number;
  min?: number;
  max?: number;
  format?: "email" | "date";
  /** Column is auto-increment primary key (INTEGER only, typically "id") */
  autoIncrement?: boolean;
  /**
   * TypeBox only: for nullable optional API fields, emit `Optional(Union(Null, T))` instead of `Optional(Nullable(T))`.
   * Use when clients send explicit JSON `null` (imports); leave unset for typical nullable columns.
   */
  typeboxExplicitJsonNull?: boolean;
}

export interface ForeignKeyDef {
  /** Local columns on this table */
  columns: string[];
  /** Referenced table name */
  refTable: string;
  /** Referenced columns on refTable */
  refColumns: string[];
  /** Optional constraint name (for readability/debugging) */
  name?: string;
  /** onDelete action – defaults to no action if omitted */
  onDelete?: "cascade" | "restrict" | "set null" | "no action";
}

export interface PrimaryKeyDef {
  /** Primary key constraint name (optional) */
  name?: string;
  /** Column(s) that form the primary key */
  columns: string[];
}

/** Property for non-table `CUSTOM_LIST_QUERY_SCHEMAS` entries (codegen). */
export type CustomQueryPropDef =
  | { kind: "string"; required: boolean; minLength?: number }
  | { kind: "number"; required: boolean; min?: number; max?: number };

/**
 * Hand-authored list/query schemas not tied 1:1 to a table `listDefaults` (codegen).
 * See `scripts/codegen-from-manifest.ts`.
 */
export interface CustomListQuerySchemaDef {
  exportName: string;
  /** Include standard page, per_page, sort, search, search_fields, fields */
  includeListBase: boolean;
  /** Optional filter keys using the same `F` union as table list filters */
  filterKeys?: readonly string[];
  /** Fixed query fields (e.g. `q`, `start_date`) */
  properties?: Record<string, CustomQueryPropDef>;
}

export const CUSTOM_LIST_QUERY_SCHEMAS: readonly CustomListQuerySchemaDef[] = [
  {
    exportName: "tLiabilityPaymentsListQuerySchema",
    includeListBase: true,
    filterKeys: [
      "id",
      "liability_id",
      "payment_date",
      "amount",
      "principal_amount",
      "interest_amount",
      "extra_payment",
      "transaction_id",
    ],
  },
  {
    exportName: "tLiabilitiesPaymentStatusQuerySchema",
    includeListBase: true,
    filterKeys: [
      "status",
      "liability_id",
      "account_id",
      "days_ahead",
      "from_date",
      "to_date",
      "direction",
      "liability_type",
    ],
  },
  {
    exportName: "tLiabilitiesSchedulePaymentsQuerySchema",
    includeListBase: true,
    filterKeys: [
      "liability_id",
      "account_id",
      "days_ahead",
      "from_date",
      "to_date",
      "direction",
      "liability_type",
    ],
  },
  {
    exportName: "tPotentialRefundsListQuerySchema",
    includeListBase: false,
    properties: {
      limit: { kind: "number", required: false, min: 1, max: 200 },
    },
  },
  {
    exportName: "tStocksSearchQuerySchema",
    includeListBase: false,
    properties: {
      q: { kind: "string", required: true, minLength: 1 },
    },
  },
  {
    exportName: "tStocksHistoryQuerySchema",
    includeListBase: false,
    properties: {
      period: { kind: "string", required: false },
    },
  },
  {
    exportName: "tInvestmentsPortfolioSummaryQuerySchema",
    includeListBase: false,
    properties: {
      account_id: { kind: "string", required: false },
    },
  },
  {
    exportName: "tInvestmentsPortfolioPerformanceQuerySchema",
    includeListBase: false,
    properties: {
      period: { kind: "string", required: false },
    },
  },
  {
    exportName: "tDateRangeQuerySchema",
    includeListBase: false,
    properties: {
      start_date: { kind: "string", required: true },
      end_date: { kind: "string", required: true },
    },
  },
  {
    exportName: "tBudgetsSummaryPeriodQuerySchema",
    includeListBase: false,
    properties: {
      start_date: { kind: "string", required: true },
      end_date: { kind: "string", required: true },
      period: { kind: "string", required: true },
    },
  },
  {
    exportName: "tBudgetsTransactionsByCategoriesQuerySchema",
    includeListBase: false,
    properties: {
      start_date: { kind: "string", required: true },
      end_date: { kind: "string", required: true },
      type: { kind: "string", required: false },
    },
  },
  {
    exportName: "tBudgetsLegacyListQuerySchema",
    includeListBase: false,
    properties: {
      year: { kind: "string", required: false },
      month: { kind: "string", required: false },
    },
  },
  {
    exportName: "tBudgetsCompareQuerySchema",
    includeListBase: false,
    properties: {
      year: { kind: "string", required: true },
      month: { kind: "string", required: true },
    },
  },
];

export interface TableDef {
  tableName: string;
  columns: ColumnDef[];
  /** If true, PATCH/PUT is allowed for this resource via generic handlers. */
  userUpdatable?: boolean;
  /** Update is always partial (all fields optional) unless overridden */
  updatePartial?: boolean;
  /** If true, only TypeBox is emitted (no Kysely, no SQL ref). Use for API-only shapes. */
  apiOnly?: boolean;
  /** Override generated TypeBox schema name (e.g. "Investment" -> tCreateInvestmentSchema). */
  typeboxName?: string;
  /** Primary key definition (single or composite). If omitted, no explicit PK is emitted. */
  primaryKey?: PrimaryKeyDef;
  /** Foreign keys emitted into migrations. */
  foreignKeys?: ForeignKeyDef[];
  /** Optional defaults for list/search/filter behaviour in routes. */
  listDefaults?: ListDefaults;
}

/** Tables that are driven from this manifest; codegen emits Kysely + TypeBox for these. */
export const TABLE_MANIFEST: TableDef[] = [
  {
    tableName: "banks",
    userUpdatable: true,
    listDefaults: {
      defaultSearchFields: ["name"],
      defaultFilters: ["id"],
    },
    columns: [
      {
        name: "id",
        sqlType: "INTEGER",
        required: true,
        kind: "generated",
        autoIncrement: true,
      },
      { name: "user_id", sqlType: "INTEGER", required: true, kind: "server" },
      { name: "name", sqlType: "TEXT", required: true, minLength: 1 },
      { name: "website", sqlType: "TEXT", required: false, nullable: true },
    ],
    updatePartial: true,
    primaryKey: { columns: ["id"] },
    foreignKeys: [
      {
        name: "fk_banks_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  {
    tableName: "accounts",
    userUpdatable: true,
    listDefaults: {
      defaultSearchFields: ["name"],
      defaultFilters: ["id", "type", "bank_id"],
    },
    columns: [
      {
        name: "id",
        sqlType: "INTEGER",
        required: true,
        kind: "generated",
        autoIncrement: true,
      },
      { name: "user_id", sqlType: "INTEGER", required: true, kind: "server" },
      { name: "name", sqlType: "TEXT", required: true, minLength: 1 },
      {
        name: "type",
        sqlType: "TEXT",
        required: true,
        enumValues: [
          "asset",
          "loan",
          "investment",
          "income",
          "expense",
          "checking",
          "savings",
        ] as const,
      },
      { name: "bank_id", sqlType: "INTEGER", required: true, min: 1 },
      {
        name: "currency",
        sqlType: "TEXT",
        required: false,
        nullable: true,
        optionalInCreate: true,
        typeboxExplicitJsonNull: true,
      },
    ],
    updatePartial: true,
    primaryKey: { columns: ["id"] },
    foreignKeys: [
      {
        name: "fk_accounts_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_accounts_bank",
        columns: ["bank_id"],
        refTable: "banks",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  {
    tableName: "assets",
    userUpdatable: true,
    listDefaults: {
      defaultSearchFields: ["symbol", "name"],
      defaultFilters: ["symbol"],
    },
    columns: [
      {
        name: "id",
        sqlType: "INTEGER",
        required: true,
        kind: "generated",
        autoIncrement: true,
      },
      { name: "user_id", sqlType: "INTEGER", required: true, kind: "server" },
      { name: "symbol", sqlType: "TEXT", required: true, minLength: 1 },
      { name: "name", sqlType: "TEXT", required: true, minLength: 1 },
    ],
    updatePartial: true,
    primaryKey: { columns: ["id"] },
    foreignKeys: [
      {
        name: "fk_assets_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  {
    tableName: "refund_groups",
    userUpdatable: true,
    listDefaults: {
      defaultSearchFields: ["name", "description"],
      defaultFilters: ["id"],
    },
    columns: [
      {
        name: "id",
        sqlType: "INTEGER",
        required: true,
        kind: "generated",
        autoIncrement: true,
      },
      { name: "user_id", sqlType: "INTEGER", required: true, kind: "server" },
      { name: "name", sqlType: "TEXT", required: true, minLength: 1 },
      { name: "description", sqlType: "TEXT", required: false, nullable: true },
    ],
    updatePartial: true,
    primaryKey: { columns: ["id"] },
    foreignKeys: [
      {
        name: "fk_refund_groups_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  {
    tableName: "transactions",
    userUpdatable: true,
    listDefaults: {
      defaultSearchFields: ["description", "category"],
      defaultFilters: [
        "id",
        "from_account_id",
        "to_account_id",
        "category",
        "subcategory",
        "type",
        "date",
        "date_accountability",
        "amount",
        "description",
      ],
      listQueryExtraKeys: ["account_id", "has_refund", "from_date", "to_date"],
    },
    columns: [
      {
        name: "id",
        sqlType: "INTEGER",
        required: true,
        kind: "generated",
        autoIncrement: true,
      },
      { name: "user_id", sqlType: "INTEGER", required: true, kind: "server" },
      { name: "date", sqlType: "TEXT", required: true },
      { name: "date_accountability", sqlType: "TEXT", required: true },
      { name: "description", sqlType: "TEXT", required: true, minLength: 1 },
      {
        name: "amount",
        sqlType: "TEXT",
        required: true,
        apiNumber: true,
        min: 0.000001,
      },
      {
        name: "to_amount",
        sqlType: "TEXT",
        required: false,
        nullable: true,
        apiNumber: true,
        min: 0.000001,
      },
      { name: "to_currency", sqlType: "TEXT", required: false, nullable: true },
      { name: "from_account_id", sqlType: "INTEGER", required: true, min: 1 },
      { name: "to_account_id", sqlType: "INTEGER", required: true, min: 1 },
      { name: "category", sqlType: "TEXT", required: true, minLength: 1 },
      { name: "subcategory", sqlType: "TEXT", required: false, nullable: true },
      {
        name: "type",
        sqlType: "TEXT",
        required: true,
        enumValues: ["expense", "income", "transfer"] as const,
      },
      {
        name: "investment_id",
        sqlType: "INTEGER",
        required: false,
        nullable: true,
        min: 1,
      },
    ],
    updatePartial: true,
    primaryKey: { columns: ["id"] },
    foreignKeys: [
      {
        name: "fk_transactions_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_transactions_from_account",
        columns: ["from_account_id"],
        refTable: "accounts",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_transactions_to_account",
        columns: ["to_account_id"],
        refTable: "accounts",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_transactions_investment",
        columns: ["investment_id"],
        refTable: "transactions",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  {
    tableName: "budgets",
    userUpdatable: true,
    columns: [
      {
        name: "id",
        sqlType: "INTEGER",
        required: true,
        kind: "generated",
        autoIncrement: true,
      },
      { name: "user_id", sqlType: "INTEGER", required: true, kind: "server" },
      { name: "category", sqlType: "TEXT", required: true, minLength: 1 },
      {
        name: "year",
        sqlType: "INTEGER",
        required: true,
        min: 1900,
        max: 3000,
      },
      { name: "month", sqlType: "INTEGER", required: true, min: 1, max: 12 },
      {
        name: "amount",
        sqlType: "TEXT",
        required: true,
        apiUnionStringNumber: true,
      },
      {
        name: "created_at",
        sqlType: "TEXT",
        required: false,
        nullable: true,
        kind: "generated",
      },
      {
        name: "updated_at",
        sqlType: "TEXT",
        required: false,
        nullable: true,
        kind: "generated",
      },
    ],
    updatePartial: true,
    primaryKey: { columns: ["id"] },
  },
  // --- Users ---
  {
    tableName: "users",
    columns: [
      {
        name: "id",
        sqlType: "INTEGER",
        required: true,
        kind: "generated",
        autoIncrement: true,
      },
      { name: "name", sqlType: "TEXT", required: true, minLength: 1 },
      { name: "email", sqlType: "TEXT", required: true, format: "email" },
      { name: "password", sqlType: "TEXT", required: true, minLength: 6 },
      { name: "last_login", sqlType: "TEXT", required: false, nullable: true },
      { name: "preferred_currency", sqlType: "TEXT", required: true },
    ],
    updatePartial: true,
    primaryKey: { columns: ["id"] },
  },
  // --- Refund items ---
  {
    tableName: "refund_items",
    userUpdatable: true,
    listDefaults: {
      defaultSearchFields: ["description"],
      defaultFilters: ["id", "refund_group_id", "income_transaction_id", "expense_transaction_id"],
    },
    columns: [
      {
        name: "id",
        sqlType: "INTEGER",
        required: true,
        kind: "generated",
        autoIncrement: true,
      },
      { name: "user_id", sqlType: "INTEGER", required: true, kind: "server" },
      {
        name: "income_transaction_id",
        sqlType: "INTEGER",
        required: true,
        min: 1,
      },
      {
        name: "expense_transaction_id",
        sqlType: "INTEGER",
        required: true,
        min: 1,
      },
      { name: "amount", sqlType: "REAL", required: true },
      {
        name: "refund_group_id",
        sqlType: "INTEGER",
        required: false,
        nullable: true,
      },
      { name: "description", sqlType: "TEXT", required: false, nullable: true },
    ],
    updatePartial: true,
    primaryKey: { columns: ["id"] },
    foreignKeys: [
      {
        name: "fk_refund_items_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_refund_items_income_tx",
        columns: ["income_transaction_id"],
        refTable: "transactions",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_refund_items_expense_tx",
        columns: ["expense_transaction_id"],
        refTable: "transactions",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_refund_items_group",
        columns: ["refund_group_id"],
        refTable: "refund_groups",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  // --- Liabilities ---
  {
    tableName: "liabilities",
    typeboxName: "Liability",
    userUpdatable: true,
    listDefaults: {
      defaultSearchFields: ["name"],
      defaultFilters: ["id", "liability_type", "direction", "account_id"],
    },
    columns: [
      {
        name: "id",
        sqlType: "INTEGER",
        required: true,
        kind: "generated",
        autoIncrement: true,
      },
      { name: "user_id", sqlType: "INTEGER", required: true, kind: "server" },
      { name: "name", sqlType: "TEXT", required: true, minLength: 1 },
      { name: "description", sqlType: "TEXT", required: false, nullable: true },
      { name: "liability_type", sqlType: "TEXT", required: true },
      { name: "principal_amount", sqlType: "TEXT", required: true },
      { name: "interest_rate", sqlType: "TEXT", required: true },
      { name: "start_date", sqlType: "TEXT", required: true },
      { name: "end_date", sqlType: "TEXT", required: false, nullable: true },
      { name: "compounding_period", sqlType: "TEXT", required: true },
      { name: "payment_frequency", sqlType: "TEXT", required: true },
      {
        name: "payment_amount",
        sqlType: "TEXT",
        required: false,
        nullable: true,
      },
      { name: "deferral_period_months", sqlType: "INTEGER", required: true },
      {
        name: "deferral_type",
        sqlType: "TEXT",
        required: false,
        nullable: true,
      },
      { name: "direction", sqlType: "TEXT", required: true },
      {
        name: "account_id",
        sqlType: "INTEGER",
        required: false,
        nullable: true,
      },
      { name: "lender_name", sqlType: "TEXT", required: false, nullable: true },
      // API may send null/omit; normalizeLiabilityBody defaults from profile before insert (DB column stays NOT NULL).
      {
        name: "currency",
        sqlType: "TEXT",
        required: false,
        nullable: true,
        typeboxExplicitJsonNull: true,
      },
      {
        name: "created_at",
        sqlType: "TEXT",
        required: false,
        nullable: true,
        kind: "generated",
      },
      {
        name: "updated_at",
        sqlType: "TEXT",
        required: false,
        nullable: true,
        kind: "generated",
      },
      {
        name: "capitalization_frequency",
        sqlType: "TEXT",
        required: false,
        nullable: true,
      },
      {
        name: "interest_calculation",
        sqlType: "TEXT",
        required: false,
        nullable: true,
      },
      {
        name: "first_period_days",
        sqlType: "INTEGER",
        required: false,
        nullable: true,
      },
    ],
    updatePartial: true,
    primaryKey: { columns: ["id"] },
    foreignKeys: [
      {
        name: "fk_liabilities_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_liabilities_account",
        columns: ["account_id"],
        refTable: "accounts",
        refColumns: ["id"],
        onDelete: "set null",
      },
    ],
  },
  // --- Extra tables used internally (not currently exposed as API resources) ---
  {
    tableName: "investment_details",
    columns: [
      { name: "transaction_id", sqlType: "INTEGER", required: true },
      { name: "asset_id", sqlType: "INTEGER", required: true },
      { name: "quantity", sqlType: "TEXT", required: true },
      { name: "unit_price", sqlType: "TEXT", required: true },
      { name: "fee", sqlType: "TEXT", required: true },
      { name: "tax", sqlType: "TEXT", required: true },
      { name: "total_paid", sqlType: "TEXT", required: false, nullable: true },
      {
        name: "investment_type",
        sqlType: "TEXT",
        required: true,
        enumValues: ["Buy", "Sell", "Dividend", "Interest", "Deposit", "Withdrawal"] as const,
      },
      {
        name: "pl_transaction_id",
        sqlType: "INTEGER",
        required: false,
        nullable: true,
      },
      {
        name: "fee_transaction_id",
        sqlType: "INTEGER",
        required: false,
        nullable: true,
      },
      {
        name: "tax_transaction_id",
        sqlType: "INTEGER",
        required: false,
        nullable: true,
      },
      {
        name: "gain_loss_override",
        sqlType: "TEXT",
        required: false,
        nullable: true,
      },
      {
        name: "gain_loss_source",
        sqlType: "TEXT",
        required: false,
        nullable: true,
      },
      {
        name: "gain_loss_calculated",
        sqlType: "TEXT",
        required: false,
        nullable: true,
      },
    ],
    primaryKey: { columns: ["transaction_id"] },
    foreignKeys: [
      {
        name: "fk_investment_details_tx",
        columns: ["transaction_id"],
        refTable: "transactions",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_investment_details_asset",
        columns: ["asset_id"],
        refTable: "assets",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  {
    tableName: "stock_cache",
    columns: [
      { name: "symbol", sqlType: "TEXT", required: true },
      { name: "cache_type", sqlType: "TEXT", required: true },
      { name: "data", sqlType: "TEXT", required: true },
      { name: "last_updated", sqlType: "TEXT", required: true },
    ],
    primaryKey: {
      name: "pk_stock_cache",
      columns: ["symbol", "cache_type"],
    },
  },
  {
    tableName: "gocardless_agreements",
    columns: [
      { name: "agreement_id", sqlType: "TEXT", required: true },
      { name: "institution_id", sqlType: "TEXT", required: true },
      { name: "max_historical_days", sqlType: "INTEGER", required: true },
      { name: "access_valid_for_days", sqlType: "INTEGER", required: true },
      { name: "access_scope", sqlType: "TEXT", required: true },
      { name: "user_id", sqlType: "INTEGER", required: true },
      { name: "created_at", sqlType: "TEXT", required: true },
    ],
    primaryKey: {
      name: "pk_gocardless_agreements",
      columns: ["agreement_id"],
    },
    foreignKeys: [
      {
        name: "fk_gocardless_agreements_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  {
    tableName: "gocardless_requisitions",
    columns: [
      { name: "requisition_id", sqlType: "TEXT", required: true },
      { name: "link", sqlType: "TEXT", required: true },
      { name: "user_id", sqlType: "INTEGER", required: true },
      { name: "institution_id", sqlType: "TEXT", required: true },
      { name: "reference", sqlType: "TEXT", required: false, nullable: true },
      {
        name: "agreement_id",
        sqlType: "TEXT",
        required: false,
        nullable: true,
      },
      { name: "created_at", sqlType: "TEXT", required: false, nullable: true },
    ],
    primaryKey: {
      name: "pk_gocardless_requisitions",
      columns: ["requisition_id"],
    },
    foreignKeys: [
      {
        name: "fk_gocardless_requisitions_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_gocardless_requisitions_agreement",
        columns: ["agreement_id"],
        refTable: "gocardless_agreements",
        refColumns: ["agreement_id"],
        onDelete: "set null",
      },
    ],
  },
  {
    tableName: "gocardless_accounts",
    columns: [
      { name: "account_id", sqlType: "TEXT", required: true },
      { name: "created_at", sqlType: "TEXT", required: true },
      { name: "last_accessed", sqlType: "TEXT", required: true },
      { name: "iban", sqlType: "TEXT", required: false, nullable: true },
      { name: "institution_id", sqlType: "TEXT", required: true },
      { name: "status", sqlType: "TEXT", required: false, nullable: true },
      { name: "owner_name", sqlType: "TEXT", required: false, nullable: true },
      {
        name: "currency",
        sqlType: "TEXT",
        required: false,
        nullable: true,
        typeboxExplicitJsonNull: true,
      },
      { name: "balance", sqlType: "REAL", required: false, nullable: true },
      {
        name: "account_type",
        sqlType: "TEXT",
        required: false,
        nullable: true,
      },
      { name: "user_id", sqlType: "INTEGER", required: true },
    ],
    primaryKey: {
      name: "pk_gocardless_accounts",
      columns: ["account_id"],
    },
    foreignKeys: [
      {
        name: "fk_gocardless_accounts_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  {
    tableName: "gocardless_cache",
    columns: [
      { name: "cache_key", sqlType: "TEXT", required: true },
      { name: "cache_type", sqlType: "TEXT", required: true },
      { name: "data", sqlType: "TEXT", required: true },
      { name: "last_updated", sqlType: "TEXT", required: true },
    ],
    primaryKey: {
      name: "pk_gocardless_cache",
      columns: ["cache_key", "cache_type"],
    },
  },
  {
    tableName: "custom_prices",
    columns: [
      {
        name: "id",
        sqlType: "INTEGER",
        required: true,
        kind: "generated",
        autoIncrement: true,
      },
      { name: "symbol", sqlType: "TEXT", required: true },
      { name: "date", sqlType: "TEXT", required: true },
      { name: "open", sqlType: "TEXT", required: true },
      { name: "high", sqlType: "TEXT", required: true },
      { name: "low", sqlType: "TEXT", required: true },
      { name: "close", sqlType: "TEXT", required: true },
      { name: "volume", sqlType: "INTEGER", required: true },
      { name: "created_at", sqlType: "TEXT", required: true },
      { name: "updated_at", sqlType: "TEXT", required: true },
      { name: "user_id", sqlType: "INTEGER", required: true },
    ],
    primaryKey: { columns: ["id"] },
    foreignKeys: [
      {
        name: "fk_custom_prices_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  {
    tableName: "liability_payment_details",
    columns: [
      { name: "transaction_id", sqlType: "INTEGER", required: true },
      { name: "user_id", sqlType: "INTEGER", required: true },
      { name: "liability_id", sqlType: "INTEGER", required: true },
      { name: "payment_date", sqlType: "TEXT", required: true },
      { name: "amount", sqlType: "TEXT", required: true },
      { name: "principal_amount", sqlType: "TEXT", required: true },
      { name: "interest_amount", sqlType: "TEXT", required: true },
      { name: "extra_payment", sqlType: "TEXT", required: true },
      { name: "created_at", sqlType: "TEXT", required: false, nullable: true },
      { name: "updated_at", sqlType: "TEXT", required: false, nullable: true },
    ],
    primaryKey: { columns: ["transaction_id"] },
    foreignKeys: [
      {
        name: "fk_liability_payment_details_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_liability_payment_details_liability",
        columns: ["liability_id"],
        refTable: "liabilities",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_liability_payment_details_tx",
        columns: ["transaction_id"],
        refTable: "transactions",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  {
    tableName: "liability_schedule_overrides",
    columns: [
      { name: "user_id", sqlType: "INTEGER", required: true },
      { name: "liability_id", sqlType: "INTEGER", required: true },
      { name: "payment_number", sqlType: "INTEGER", required: true },
      { name: "payment_date", sqlType: "TEXT", required: true },
      { name: "scheduled_date", sqlType: "TEXT", required: true },
      { name: "payment_amount", sqlType: "TEXT", required: true },
      { name: "principal_amount", sqlType: "TEXT", required: true },
      { name: "interest_amount", sqlType: "TEXT", required: true },
      { name: "capitalized_interest", sqlType: "TEXT", required: true },
      { name: "remaining_principal", sqlType: "TEXT", required: true },
      { name: "is_deferred", sqlType: "INTEGER", required: true },
      { name: "deferral_type", sqlType: "TEXT", required: true },
      { name: "created_at", sqlType: "TEXT", required: false, nullable: true },
      { name: "updated_at", sqlType: "TEXT", required: false, nullable: true },
    ],
    primaryKey: {
      name: "pk_liability_schedule_overrides",
      columns: ["user_id", "liability_id", "payment_number"],
    },
    foreignKeys: [
      {
        name: "fk_liability_schedule_overrides_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_liability_schedule_overrides_liability",
        columns: ["liability_id"],
        refTable: "liabilities",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  {
    tableName: "liability_generated_transactions",
    columns: [
      { name: "user_id", sqlType: "INTEGER", required: true },
      { name: "liability_id", sqlType: "INTEGER", required: true },
      { name: "transaction_id", sqlType: "INTEGER", required: true },
      { name: "kind", sqlType: "TEXT", required: true },
      { name: "schedule_payment_number", sqlType: "INTEGER", required: true },
      { name: "schedule_date", sqlType: "TEXT", required: true },
      { name: "created_at", sqlType: "TEXT", required: false, nullable: true },
    ],
    primaryKey: {
      name: "pk_liability_generated_transactions",
      columns: ["user_id", "transaction_id"],
    },
    foreignKeys: [
      {
        name: "fk_liability_generated_transactions_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_liability_generated_transactions_liability",
        columns: ["liability_id"],
        refTable: "liabilities",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_liability_generated_transactions_tx",
        columns: ["transaction_id"],
        refTable: "transactions",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  {
    tableName: "dismissed_potential_refunds",
    columns: [
      { name: "user_id", sqlType: "INTEGER", required: true },
      { name: "income_transaction_id", sqlType: "INTEGER", required: true },
      { name: "created_at", sqlType: "TEXT", required: true },
    ],
    primaryKey: {
      name: "pk_dismissed_potential_refunds",
      columns: ["user_id", "income_transaction_id"],
    },
    foreignKeys: [
      {
        name: "fk_dismissed_potential_refunds_user",
        columns: ["user_id"],
        refTable: "users",
        refColumns: ["id"],
        onDelete: "cascade",
      },
      {
        name: "fk_dismissed_potential_refunds_income_tx",
        columns: ["income_transaction_id"],
        refTable: "transactions",
        refColumns: ["id"],
        onDelete: "cascade",
      },
    ],
  },
  // --- Investment (API request body only; not a direct table) ---
  {
    tableName: "investment_request",
    apiOnly: true,
    typeboxName: "Investment",
    columns: [
      { name: "date", sqlType: "TEXT", required: true },
      {
        name: "asset_id",
        sqlType: "INTEGER",
        required: false,
        nullable: true,
        min: 1,
      },
      { name: "symbol", sqlType: "TEXT", required: false, minLength: 1 },
      { name: "name", sqlType: "TEXT", required: false },
      {
        name: "activity_type",
        sqlType: "TEXT",
        required: true,
        enumValues: ["Buy", "Sell", "Dividend", "Interest", "Deposit", "Withdrawal"] as const,
      },
      { name: "quantity", sqlType: "REAL", required: true },
      { name: "unit_price", sqlType: "REAL", required: true },
      { name: "fee", sqlType: "REAL", required: true, min: 0 },
      { name: "tax", sqlType: "REAL", required: true, min: 0 },
      { name: "from_account_id", sqlType: "INTEGER", required: true, min: 1 },
      { name: "to_account_id", sqlType: "INTEGER", required: true, min: 1 },
      {
        name: "gain_loss_override",
        sqlType: "REAL",
        required: false,
        nullable: true,
      },
    ],
    updatePartial: true,
  },
];

/**
 * Views/materialized views that are queried by services/routes but not created by migrations codegen.
 * These are part of the Kysely Database type (see src/db/schema.ts), so list endpoints still need
 * a strict allowlist for identifier validation.
 */
export const VIEW_MANIFEST: ReadonlyArray<{
  tableName: string;
  columns: readonly string[];
}> = [
  {
    tableName: "account_balances",
    columns: ["account_id", "current_balance"] as const,
  },
  {
    tableName: "asset_balances_by_account",
    columns: ["user_id", "account_id", "asset_id", "symbol", "asset_name", "quantity"] as const,
  },
  {
    tableName: "liability_balances",
    columns: [
      "user_id",
      "liability_id",
      "principal_paid",
      "interest_paid",
      "remaining_balance",
      "missed_payments_count",
      "next_payment_date",
    ] as const,
  },
];

export const LISTABLE_FIELDS: Readonly<Record<string, readonly string[]>> = Object.fromEntries([
  ...TABLE_MANIFEST.filter((t) => !t.apiOnly).map(
    (t) => [t.tableName, t.columns.map((c) => c.name)] as const,
  ),
  ...VIEW_MANIFEST.map((v) => [v.tableName, v.columns] as const),
]);

export const USER_UPDATABLE_FIELDS: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    TABLE_MANIFEST.filter((t) => t.userUpdatable && !t.apiOnly).map((t) => [
      t.tableName,
      t.columns.filter((c) => c.kind !== "generated" && c.kind !== "server").map((c) => c.name),
    ]),
  );

export const TABLE_LIST_DEFAULTS: Readonly<Record<string, ListDefaults>> = Object.fromEntries(
  TABLE_MANIFEST.filter((t) => t.listDefaults && !t.apiOnly).map((t) => [
    t.tableName,
    t.listDefaults as ListDefaults,
  ]),
);

/** Agent list-tool registry metadata (codegen + runtime). */
export type AgentListExecutorKind =
  | "handler_export"
  | "budgets_legacy"
  | "liability_payments"
  | "potential_refunds"
  | "investments"
  | "liabilities_payment_status"
  | "liabilities_schedule_payments";

export interface AgentListEndpointDef {
  toolName: string;
  querySchemaExport: string;
  openApiPath: string;
  executorKind: AgentListExecutorKind;
  /** For handler_export: named export in agentListHandlers */
  handlerExport?: string;
  searchFields: readonly string[];
  allowedFilters: readonly string[];
}

function listFiltersFromTable(tableName: string): readonly string[] {
  const ld = TABLE_LIST_DEFAULTS[tableName];
  if (!ld) return [];
  return [...new Set([...(ld.defaultFilters ?? []), ...(ld.listQueryExtraKeys ?? [])])].sort();
}

export const AGENT_LIST_ENDPOINTS: readonly AgentListEndpointDef[] = [
  {
    toolName: "list_banks",
    querySchemaExport: "tBanksListQuerySchema",
    openApiPath: "GET /banks",
    executorKind: "handler_export",
    handlerExport: "banksListHandler",
    searchFields: TABLE_LIST_DEFAULTS.banks?.defaultSearchFields ?? ["name"],
    allowedFilters: listFiltersFromTable("banks"),
  },
  {
    toolName: "list_accounts",
    querySchemaExport: "tAccountsListQuerySchema",
    openApiPath: "GET /accounts",
    executorKind: "handler_export",
    handlerExport: "accountsListHandler",
    searchFields: TABLE_LIST_DEFAULTS.accounts?.defaultSearchFields ?? ["name"],
    allowedFilters: listFiltersFromTable("accounts"),
  },
  {
    toolName: "list_assets",
    querySchemaExport: "tAssetsListQuerySchema",
    openApiPath: "GET /assets",
    executorKind: "handler_export",
    handlerExport: "assetsListHandler",
    searchFields: TABLE_LIST_DEFAULTS.assets?.defaultSearchFields ?? ["name", "symbol"],
    allowedFilters: listFiltersFromTable("assets"),
  },
  {
    toolName: "list_refund_groups",
    querySchemaExport: "tRefundGroupsListQuerySchema",
    openApiPath: "GET /refund_groups",
    executorKind: "handler_export",
    handlerExport: "refundGroupsListHandler",
    searchFields: TABLE_LIST_DEFAULTS.refund_groups?.defaultSearchFields ?? ["name"],
    allowedFilters: listFiltersFromTable("refund_groups"),
  },
  {
    toolName: "list_refund_items",
    querySchemaExport: "tRefundItemsListQuerySchema",
    openApiPath: "GET /refund_items",
    executorKind: "handler_export",
    handlerExport: "refundItemsListHandler",
    searchFields: TABLE_LIST_DEFAULTS.refund_items?.defaultSearchFields ?? [],
    allowedFilters: listFiltersFromTable("refund_items"),
  },
  {
    toolName: "list_transactions",
    querySchemaExport: "tTransactionsListQuerySchema",
    openApiPath: "GET /transactions",
    executorKind: "handler_export",
    handlerExport: "listTransactionsHandler",
    searchFields: TABLE_LIST_DEFAULTS.transactions?.defaultSearchFields ?? ["description"],
    allowedFilters: listFiltersFromTable("transactions"),
  },
  {
    toolName: "list_liabilities",
    querySchemaExport: "tLiabilitiesListQuerySchema",
    openApiPath: "GET /liabilities",
    executorKind: "handler_export",
    handlerExport: "liabilitiesListHandler",
    searchFields: TABLE_LIST_DEFAULTS.liabilities?.defaultSearchFields ?? ["name"],
    allowedFilters: listFiltersFromTable("liabilities"),
  },
  {
    toolName: "list_liability_payments",
    querySchemaExport: "tLiabilityPaymentsListQuerySchema",
    openApiPath: "GET /liability_payments",
    executorKind: "liability_payments",
    searchFields: [],
    allowedFilters: [
      "id",
      "liability_id",
      "payment_date",
      "amount",
      "principal_amount",
      "interest_amount",
      "extra_payment",
      "transaction_id",
    ],
  },
  {
    toolName: "list_budgets",
    querySchemaExport: "tBaseListQuerySchema",
    openApiPath: "GET /budgets",
    executorKind: "handler_export",
    handlerExport: "budgetsListHandler",
    searchFields: ["category"],
    allowedFilters: [],
  },
  {
    toolName: "list_budgets_legacy",
    querySchemaExport: "tBudgetsLegacyListQuerySchema",
    openApiPath: "GET /budgets/budgets",
    executorKind: "budgets_legacy",
    searchFields: [],
    allowedFilters: ["year", "month"],
  },
  {
    toolName: "list_investments",
    querySchemaExport: "tBaseListQuerySchema",
    openApiPath: "GET /investments",
    executorKind: "investments",
    searchFields: [],
    allowedFilters: [],
  },
  {
    toolName: "list_potential_refunds",
    querySchemaExport: "tPotentialRefundsListQuerySchema",
    openApiPath: "GET /potential_refunds",
    executorKind: "potential_refunds",
    searchFields: [],
    allowedFilters: ["limit"],
  },
  {
    toolName: "list_liabilities_payment_status",
    querySchemaExport: "tLiabilitiesPaymentStatusQuerySchema",
    openApiPath: "GET /liabilities/payment-status",
    executorKind: "liabilities_payment_status",
    searchFields: [],
    allowedFilters: [
      "status",
      "liability_id",
      "account_id",
      "days_ahead",
      "from_date",
      "to_date",
      "direction",
      "liability_type",
    ],
  },
  {
    toolName: "list_liabilities_schedule_payments",
    querySchemaExport: "tLiabilitiesSchedulePaymentsQuerySchema",
    openApiPath: "GET /liabilities/upcoming-payments",
    executorKind: "liabilities_schedule_payments",
    searchFields: [],
    allowedFilters: [
      "liability_id",
      "account_id",
      "days_ahead",
      "from_date",
      "to_date",
      "direction",
      "liability_type",
    ],
  },
];
