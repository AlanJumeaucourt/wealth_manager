-- Schema reference (NOT NULL from manifest). Generated from src/db/manifest.ts
-- Use for documentation or to compare with migrations.

-- budgets
-- Columns: id INTEGER, user_id INTEGER, category TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL, amount TEXT NOT NULL, created_at TEXT, updated_at TEXT

-- gocardless_cache
-- Columns: cache_key TEXT NOT NULL, cache_type TEXT NOT NULL, data TEXT NOT NULL, last_updated TEXT NOT NULL

-- stock_cache
-- Columns: symbol TEXT NOT NULL, cache_type TEXT NOT NULL, data TEXT NOT NULL, last_updated TEXT NOT NULL

-- users
-- Columns: id INTEGER, name TEXT NOT NULL, email TEXT NOT NULL, password TEXT NOT NULL, last_login TEXT, preferred_currency TEXT NOT NULL

-- assets
-- Columns: id INTEGER, user_id INTEGER, symbol TEXT NOT NULL, name TEXT NOT NULL

-- banks
-- Columns: id INTEGER, user_id INTEGER, name TEXT NOT NULL, website TEXT

-- accounts
-- Columns: id INTEGER, user_id INTEGER, name TEXT NOT NULL, type TEXT NOT NULL, bank_id INTEGER NOT NULL, currency TEXT

-- custom_prices
-- Columns: id INTEGER, symbol TEXT NOT NULL, date TEXT NOT NULL, open TEXT NOT NULL, high TEXT NOT NULL, low TEXT NOT NULL, close TEXT NOT NULL, volume INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, user_id INTEGER NOT NULL

-- gocardless_accounts
-- Columns: account_id TEXT NOT NULL, created_at TEXT NOT NULL, last_accessed TEXT NOT NULL, iban TEXT, institution_id TEXT NOT NULL, status TEXT, owner_name TEXT, currency TEXT, balance REAL, account_type TEXT, user_id INTEGER NOT NULL

-- gocardless_agreements
-- Columns: agreement_id TEXT NOT NULL, institution_id TEXT NOT NULL, max_historical_days INTEGER NOT NULL, access_valid_for_days INTEGER NOT NULL, access_scope TEXT NOT NULL, user_id INTEGER NOT NULL, created_at TEXT NOT NULL

-- gocardless_requisitions
-- Columns: requisition_id TEXT NOT NULL, link TEXT NOT NULL, user_id INTEGER NOT NULL, institution_id TEXT NOT NULL, reference TEXT, agreement_id TEXT, created_at TEXT

-- liabilities
-- Columns: id INTEGER, user_id INTEGER, name TEXT NOT NULL, description TEXT, liability_type TEXT NOT NULL, principal_amount TEXT NOT NULL, interest_rate TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT, compounding_period TEXT NOT NULL, payment_frequency TEXT NOT NULL, payment_amount TEXT, deferral_period_months INTEGER NOT NULL, deferral_type TEXT, direction TEXT NOT NULL, account_id INTEGER, lender_name TEXT, currency TEXT, created_at TEXT, updated_at TEXT, capitalization_frequency TEXT, interest_calculation TEXT, first_period_days INTEGER

-- liability_schedule_overrides
-- Columns: user_id INTEGER NOT NULL, liability_id INTEGER NOT NULL, payment_number INTEGER NOT NULL, payment_date TEXT NOT NULL, scheduled_date TEXT NOT NULL, payment_amount TEXT NOT NULL, principal_amount TEXT NOT NULL, interest_amount TEXT NOT NULL, capitalized_interest TEXT NOT NULL, remaining_principal TEXT NOT NULL, is_deferred INTEGER NOT NULL, deferral_type TEXT NOT NULL, created_at TEXT, updated_at TEXT

-- refund_groups
-- Columns: id INTEGER, user_id INTEGER, name TEXT NOT NULL, description TEXT

-- transactions
-- Columns: id INTEGER, user_id INTEGER, date TEXT NOT NULL, date_accountability TEXT NOT NULL, description TEXT NOT NULL, amount TEXT NOT NULL, to_amount TEXT, to_currency TEXT, from_account_id INTEGER NOT NULL, to_account_id INTEGER NOT NULL, category TEXT NOT NULL, subcategory TEXT, type TEXT NOT NULL, investment_id INTEGER

-- dismissed_potential_refunds
-- Columns: user_id INTEGER NOT NULL, income_transaction_id INTEGER NOT NULL, created_at TEXT NOT NULL

-- investment_details
-- Columns: transaction_id INTEGER NOT NULL, asset_id INTEGER NOT NULL, quantity TEXT NOT NULL, unit_price TEXT NOT NULL, fee TEXT NOT NULL, tax TEXT NOT NULL, total_paid TEXT, investment_type TEXT NOT NULL, pl_transaction_id INTEGER, fee_transaction_id INTEGER, tax_transaction_id INTEGER, gain_loss_override TEXT, gain_loss_source TEXT, gain_loss_calculated TEXT

-- liability_generated_transactions
-- Columns: user_id INTEGER NOT NULL, liability_id INTEGER NOT NULL, transaction_id INTEGER NOT NULL, kind TEXT NOT NULL, schedule_payment_number INTEGER NOT NULL, schedule_date TEXT NOT NULL, created_at TEXT

-- liability_payment_details
-- Columns: transaction_id INTEGER NOT NULL, user_id INTEGER NOT NULL, liability_id INTEGER NOT NULL, payment_date TEXT NOT NULL, amount TEXT NOT NULL, principal_amount TEXT NOT NULL, interest_amount TEXT NOT NULL, extra_payment TEXT NOT NULL, created_at TEXT, updated_at TEXT

-- refund_items
-- Columns: id INTEGER, user_id INTEGER, income_transaction_id INTEGER NOT NULL, expense_transaction_id INTEGER NOT NULL, amount REAL NOT NULL, refund_group_id INTEGER, description TEXT
