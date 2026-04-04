/** Generated from src/db/manifest.ts - do not edit by hand. */
import type { Kysely } from "kysely";
import type { Database as DBSchema } from "./schema.js";

export async function runBaseSchemaMigrations(kdb: Kysely<DBSchema>): Promise<void> {
  await kdb.schema
    .createTable("budgets")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("user_id", "integer", (col) => col)
    .addColumn("category", "text", (col) => col.notNull())
    .addColumn("year", "integer", (col) => col.notNull())
    .addColumn("month", "integer", (col) => col.notNull())
    .addColumn("amount", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col)
    .addColumn("updated_at", "text", (col) => col)
    .execute();

  await kdb.schema
    .createTable("gocardless_cache")
    .ifNotExists()
    .addColumn("cache_key", "text", (col) => col.notNull())
    .addColumn("cache_type", "text", (col) => col.notNull())
    .addColumn("data", "text", (col) => col.notNull())
    .addColumn("last_updated", "text", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_gocardless_cache", ["cache_key", "cache_type"])
    .execute();

  await kdb.schema
    .createTable("stock_cache")
    .ifNotExists()
    .addColumn("symbol", "text", (col) => col.notNull())
    .addColumn("cache_type", "text", (col) => col.notNull())
    .addColumn("data", "text", (col) => col.notNull())
    .addColumn("last_updated", "text", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_stock_cache", ["symbol", "cache_type"])
    .execute();

  await kdb.schema
    .createTable("users")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("email", "text", (col) => col.notNull())
    .addColumn("password", "text", (col) => col.notNull())
    .addColumn("last_login", "text", (col) => col)
    .addColumn("preferred_currency", "text", (col) => col.notNull())
    .execute();

  await kdb.schema
    .createTable("assets")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("user_id", "integer", (col) => col)
    .addColumn("symbol", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addForeignKeyConstraint("fk_assets_user", ["user_id"], "users", ["id"], (fb) =>
      fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("banks")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("user_id", "integer", (col) => col)
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("website", "text", (col) => col)
    .addForeignKeyConstraint("fk_banks_user", ["user_id"], "users", ["id"], (fb) =>
      fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("accounts")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("user_id", "integer", (col) => col)
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("bank_id", "integer", (col) => col.notNull())
    .addColumn("currency", "text", (col) => col)
    .addForeignKeyConstraint("fk_accounts_user", ["user_id"], "users", ["id"], (fb) =>
      fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint("fk_accounts_bank", ["bank_id"], "banks", ["id"], (fb) =>
      fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("custom_prices")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("symbol", "text", (col) => col.notNull())
    .addColumn("date", "text", (col) => col.notNull())
    .addColumn("open", "text", (col) => col.notNull())
    .addColumn("high", "text", (col) => col.notNull())
    .addColumn("low", "text", (col) => col.notNull())
    .addColumn("close", "text", (col) => col.notNull())
    .addColumn("volume", "integer", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .addColumn("user_id", "integer", (col) => col.notNull())
    .addForeignKeyConstraint("fk_custom_prices_user", ["user_id"], "users", ["id"], (fb) =>
      fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("gocardless_accounts")
    .ifNotExists()
    .addColumn("account_id", "text", (col) => col.primaryKey().notNull())
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("last_accessed", "text", (col) => col.notNull())
    .addColumn("iban", "text", (col) => col)
    .addColumn("institution_id", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col)
    .addColumn("owner_name", "text", (col) => col)
    .addColumn("currency", "text", (col) => col)
    .addColumn("balance", "real", (col) => col)
    .addColumn("account_type", "text", (col) => col)
    .addColumn("user_id", "integer", (col) => col.notNull())
    .addForeignKeyConstraint("fk_gocardless_accounts_user", ["user_id"], "users", ["id"], (fb) =>
      fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("gocardless_agreements")
    .ifNotExists()
    .addColumn("agreement_id", "text", (col) => col.primaryKey().notNull())
    .addColumn("institution_id", "text", (col) => col.notNull())
    .addColumn("max_historical_days", "integer", (col) => col.notNull())
    .addColumn("access_valid_for_days", "integer", (col) => col.notNull())
    .addColumn("access_scope", "text", (col) => col.notNull())
    .addColumn("user_id", "integer", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull())
    .addForeignKeyConstraint("fk_gocardless_agreements_user", ["user_id"], "users", ["id"], (fb) =>
      fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("gocardless_requisitions")
    .ifNotExists()
    .addColumn("requisition_id", "text", (col) => col.primaryKey().notNull())
    .addColumn("link", "text", (col) => col.notNull())
    .addColumn("user_id", "integer", (col) => col.notNull())
    .addColumn("institution_id", "text", (col) => col.notNull())
    .addColumn("reference", "text", (col) => col)
    .addColumn("agreement_id", "text", (col) => col)
    .addColumn("created_at", "text", (col) => col)
    .addForeignKeyConstraint(
      "fk_gocardless_requisitions_user",
      ["user_id"],
      "users",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_gocardless_requisitions_agreement",
      ["agreement_id"],
      "gocardless_agreements",
      ["agreement_id"],
      (fb) => fb.onDelete("set null"),
    )
    .execute();

  await kdb.schema
    .createTable("liabilities")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("user_id", "integer", (col) => col)
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col)
    .addColumn("liability_type", "text", (col) => col.notNull())
    .addColumn("principal_amount", "text", (col) => col.notNull())
    .addColumn("interest_rate", "text", (col) => col.notNull())
    .addColumn("start_date", "text", (col) => col.notNull())
    .addColumn("end_date", "text", (col) => col)
    .addColumn("compounding_period", "text", (col) => col.notNull())
    .addColumn("payment_frequency", "text", (col) => col.notNull())
    .addColumn("payment_amount", "text", (col) => col)
    .addColumn("deferral_period_months", "integer", (col) => col.notNull())
    .addColumn("deferral_type", "text", (col) => col)
    .addColumn("direction", "text", (col) => col.notNull())
    .addColumn("account_id", "integer", (col) => col)
    .addColumn("lender_name", "text", (col) => col)
    .addColumn("currency", "text", (col) => col)
    .addColumn("created_at", "text", (col) => col)
    .addColumn("updated_at", "text", (col) => col)
    .addColumn("capitalization_frequency", "text", (col) => col)
    .addColumn("interest_calculation", "text", (col) => col)
    .addColumn("first_period_days", "integer", (col) => col)
    .addForeignKeyConstraint("fk_liabilities_user", ["user_id"], "users", ["id"], (fb) =>
      fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint("fk_liabilities_account", ["account_id"], "accounts", ["id"], (fb) =>
      fb.onDelete("set null"),
    )
    .execute();

  await kdb.schema
    .createTable("liability_schedule_overrides")
    .ifNotExists()
    .addColumn("user_id", "integer", (col) => col.notNull())
    .addColumn("liability_id", "integer", (col) => col.notNull())
    .addColumn("payment_number", "integer", (col) => col.notNull())
    .addColumn("payment_date", "text", (col) => col.notNull())
    .addColumn("scheduled_date", "text", (col) => col.notNull())
    .addColumn("payment_amount", "text", (col) => col.notNull())
    .addColumn("principal_amount", "text", (col) => col.notNull())
    .addColumn("interest_amount", "text", (col) => col.notNull())
    .addColumn("capitalized_interest", "text", (col) => col.notNull())
    .addColumn("remaining_principal", "text", (col) => col.notNull())
    .addColumn("is_deferred", "integer", (col) => col.notNull())
    .addColumn("deferral_type", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col)
    .addColumn("updated_at", "text", (col) => col)
    .addPrimaryKeyConstraint("pk_liability_schedule_overrides", [
      "user_id",
      "liability_id",
      "payment_number",
    ])
    .addForeignKeyConstraint(
      "fk_liability_schedule_overrides_user",
      ["user_id"],
      "users",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_liability_schedule_overrides_liability",
      ["liability_id"],
      "liabilities",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("refund_groups")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("user_id", "integer", (col) => col)
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col)
    .addForeignKeyConstraint("fk_refund_groups_user", ["user_id"], "users", ["id"], (fb) =>
      fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("transactions")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("user_id", "integer", (col) => col)
    .addColumn("date", "text", (col) => col.notNull())
    .addColumn("date_accountability", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("amount", "text", (col) => col.notNull())
    .addColumn("to_amount", "text", (col) => col)
    .addColumn("to_currency", "text", (col) => col)
    .addColumn("from_account_id", "integer", (col) => col.notNull())
    .addColumn("to_account_id", "integer", (col) => col.notNull())
    .addColumn("category", "text", (col) => col.notNull())
    .addColumn("subcategory", "text", (col) => col)
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("investment_id", "integer", (col) => col)
    .addForeignKeyConstraint("fk_transactions_user", ["user_id"], "users", ["id"], (fb) =>
      fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_transactions_from_account",
      ["from_account_id"],
      "accounts",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_transactions_to_account",
      ["to_account_id"],
      "accounts",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_transactions_investment",
      ["investment_id"],
      "transactions",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("dismissed_potential_refunds")
    .ifNotExists()
    .addColumn("user_id", "integer", (col) => col.notNull())
    .addColumn("income_transaction_id", "integer", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_dismissed_potential_refunds", ["user_id", "income_transaction_id"])
    .addForeignKeyConstraint(
      "fk_dismissed_potential_refunds_user",
      ["user_id"],
      "users",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_dismissed_potential_refunds_income_tx",
      ["income_transaction_id"],
      "transactions",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("investment_details")
    .ifNotExists()
    .addColumn("transaction_id", "integer", (col) => col.primaryKey().notNull())
    .addColumn("asset_id", "integer", (col) => col.notNull())
    .addColumn("quantity", "text", (col) => col.notNull())
    .addColumn("unit_price", "text", (col) => col.notNull())
    .addColumn("fee", "text", (col) => col.notNull())
    .addColumn("tax", "text", (col) => col.notNull())
    .addColumn("total_paid", "text", (col) => col)
    .addColumn("investment_type", "text", (col) => col.notNull())
    .addColumn("pl_transaction_id", "integer", (col) => col)
    .addColumn("fee_transaction_id", "integer", (col) => col)
    .addColumn("tax_transaction_id", "integer", (col) => col)
    .addColumn("gain_loss_override", "text", (col) => col)
    .addColumn("gain_loss_source", "text", (col) => col)
    .addColumn("gain_loss_calculated", "text", (col) => col)
    .addForeignKeyConstraint(
      "fk_investment_details_tx",
      ["transaction_id"],
      "transactions",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint("fk_investment_details_asset", ["asset_id"], "assets", ["id"], (fb) =>
      fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("liability_generated_transactions")
    .ifNotExists()
    .addColumn("user_id", "integer", (col) => col.notNull())
    .addColumn("liability_id", "integer", (col) => col.notNull())
    .addColumn("transaction_id", "integer", (col) => col.notNull())
    .addColumn("kind", "text", (col) => col.notNull())
    .addColumn("schedule_payment_number", "integer", (col) => col.notNull())
    .addColumn("schedule_date", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col)
    .addPrimaryKeyConstraint("pk_liability_generated_transactions", ["user_id", "transaction_id"])
    .addForeignKeyConstraint(
      "fk_liability_generated_transactions_user",
      ["user_id"],
      "users",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_liability_generated_transactions_liability",
      ["liability_id"],
      "liabilities",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_liability_generated_transactions_tx",
      ["transaction_id"],
      "transactions",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("liability_payment_details")
    .ifNotExists()
    .addColumn("transaction_id", "integer", (col) => col.primaryKey().notNull())
    .addColumn("user_id", "integer", (col) => col.notNull())
    .addColumn("liability_id", "integer", (col) => col.notNull())
    .addColumn("payment_date", "text", (col) => col.notNull())
    .addColumn("amount", "text", (col) => col.notNull())
    .addColumn("principal_amount", "text", (col) => col.notNull())
    .addColumn("interest_amount", "text", (col) => col.notNull())
    .addColumn("extra_payment", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col)
    .addColumn("updated_at", "text", (col) => col)
    .addForeignKeyConstraint(
      "fk_liability_payment_details_user",
      ["user_id"],
      "users",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_liability_payment_details_liability",
      ["liability_id"],
      "liabilities",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_liability_payment_details_tx",
      ["transaction_id"],
      "transactions",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .execute();

  await kdb.schema
    .createTable("refund_items")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("user_id", "integer", (col) => col)
    .addColumn("income_transaction_id", "integer", (col) => col.notNull())
    .addColumn("expense_transaction_id", "integer", (col) => col.notNull())
    .addColumn("amount", "real", (col) => col.notNull())
    .addColumn("refund_group_id", "integer", (col) => col)
    .addColumn("description", "text", (col) => col)
    .addForeignKeyConstraint("fk_refund_items_user", ["user_id"], "users", ["id"], (fb) =>
      fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_refund_items_income_tx",
      ["income_transaction_id"],
      "transactions",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_refund_items_expense_tx",
      ["expense_transaction_id"],
      "transactions",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "fk_refund_items_group",
      ["refund_group_id"],
      "refund_groups",
      ["id"],
      (fb) => fb.onDelete("cascade"),
    )
    .execute();
}
