-- Core performance indexes for high-traffic queries.
-- Safe to run multiple times thanks to IF NOT EXISTS.

-- Transactions: user-scoped lookups and listing by date / accounts / type.
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions (user_id, date);

CREATE INDEX IF NOT EXISTS idx_transactions_user_from_account
  ON transactions (user_id, from_account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_to_account
  ON transactions (user_id, to_account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_type
  ON transactions (user_id, type);

-- Balance-over-time: covers the GROUP BY query joining accounts for wealth filtering.
CREATE INDEX IF NOT EXISTS idx_transactions_bot
  ON transactions (user_id, date, type, from_account_id, to_account_id);

CREATE INDEX IF NOT EXISTS idx_accounts_user_type
  ON accounts (user_id, type);

-- Refund items: lookups for "has_refund" and enrichment by income/expense.
CREATE INDEX IF NOT EXISTS idx_refund_items_user_income_tx
  ON refund_items (user_id, income_transaction_id);

CREATE INDEX IF NOT EXISTS idx_refund_items_user_expense_tx
  ON refund_items (user_id, expense_transaction_id);

