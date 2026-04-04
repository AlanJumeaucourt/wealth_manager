-- Drop any existing ownership/related-record triggers to avoid duplicates or mixed messages
DROP TRIGGER IF EXISTS trg_validate_account_bank_ownership_insert;
DROP TRIGGER IF EXISTS trg_validate_account_bank_ownership_update;
DROP TRIGGER IF EXISTS trg_validate_transaction_account_ownership_insert;
DROP TRIGGER IF EXISTS trg_validate_transaction_account_ownership_update;
DROP TRIGGER IF EXISTS trg_validate_transaction_investment_ownership_insert;
DROP TRIGGER IF EXISTS trg_validate_transaction_investment_ownership_update;
DROP TRIGGER IF EXISTS trg_validate_investment_details_ownership_insert;
DROP TRIGGER IF EXISTS trg_validate_investment_details_ownership_update;
DROP TRIGGER IF EXISTS trg_validate_refund_items_ownership_insert;
DROP TRIGGER IF EXISTS trg_validate_refund_items_ownership_update;
DROP TRIGGER IF EXISTS trg_validate_gocardless_requisition_agreement_ownership_insert;
DROP TRIGGER IF EXISTS trg_validate_gocardless_requisition_agreement_ownership_update;
DROP TRIGGER IF EXISTS trg_validate_liabilities_account_ownership_insert;
DROP TRIGGER IF EXISTS trg_validate_liabilities_account_ownership_update;
DROP TRIGGER IF EXISTS trg_validate_liability_payment_ownership_insert;
DROP TRIGGER IF EXISTS trg_validate_liability_payment_ownership_update;
DROP TRIGGER IF EXISTS trg_validate_dismissed_potential_refunds_ownership_insert;
DROP TRIGGER IF EXISTS trg_validate_dismissed_potential_refunds_ownership_update;

-- Ownership validation: banks/accounts
CREATE TRIGGER trg_validate_account_bank_ownership_insert
BEFORE INSERT ON accounts
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM banks
      WHERE id = NEW.bank_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: accounts.bank_id is missing or not accessible to this user')
  END;
END;

CREATE TRIGGER trg_validate_account_bank_ownership_update
BEFORE UPDATE ON accounts
WHEN NEW.bank_id != OLD.bank_id OR NEW.user_id != OLD.user_id
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM banks
      WHERE id = NEW.bank_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: accounts.bank_id is missing or not accessible to this user')
  END;
END;

-- Ownership validation: transactions <-> accounts
CREATE TRIGGER trg_validate_transaction_account_ownership_insert
BEFORE INSERT ON transactions
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM accounts
      WHERE id = NEW.from_account_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: transactions.from_account_id is missing or not accessible to this user')
    WHEN NOT EXISTS (
      SELECT 1
      FROM accounts
      WHERE id = NEW.to_account_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: transactions.to_account_id is missing or not accessible to this user')
  END;
END;

CREATE TRIGGER trg_validate_transaction_account_ownership_update
BEFORE UPDATE ON transactions
WHEN NEW.from_account_id != OLD.from_account_id
  OR NEW.to_account_id != OLD.to_account_id
  OR NEW.user_id != OLD.user_id
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM accounts
      WHERE id = NEW.from_account_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: transactions.from_account_id is missing or not accessible to this user')
    WHEN NOT EXISTS (
      SELECT 1
      FROM accounts
      WHERE id = NEW.to_account_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: transactions.to_account_id is missing or not accessible to this user')
  END;
END;

-- Ownership validation: transactions <-> investment transactions
CREATE TRIGGER trg_validate_transaction_investment_ownership_insert
BEFORE INSERT ON transactions
WHEN NEW.investment_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions
      WHERE id = NEW.investment_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: transactions.investment_id is missing or not accessible to this user')
  END;
END;

CREATE TRIGGER trg_validate_transaction_investment_ownership_update
BEFORE UPDATE ON transactions
WHEN NEW.investment_id IS NOT NULL AND (
  OLD.investment_id IS NULL OR
  NEW.investment_id != OLD.investment_id OR
  NEW.user_id != OLD.user_id
)
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions
      WHERE id = NEW.investment_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: transactions.investment_id is missing or not accessible to this user')
  END;
END;

-- Ownership validation: investment_details and related transactions/assets
CREATE TRIGGER trg_validate_investment_details_ownership_insert
BEFORE INSERT ON investment_details
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions t
      JOIN assets a ON a.id = NEW.asset_id AND a.user_id = t.user_id
      WHERE t.id = NEW.transaction_id
    )
    THEN RAISE(ABORT, 'Ownership violation: investment_details.transaction_id or asset_id is missing or not accessible to the same user')
    WHEN NEW.pl_transaction_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM transactions t
      JOIN transactions rel ON rel.id = NEW.pl_transaction_id AND rel.user_id = t.user_id
      WHERE t.id = NEW.transaction_id
    )
    THEN RAISE(ABORT, 'Ownership violation: investment_details.pl_transaction_id is missing or not accessible to the same user')
    WHEN NEW.fee_transaction_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM transactions t
      JOIN transactions rel ON rel.id = NEW.fee_transaction_id AND rel.user_id = t.user_id
      WHERE t.id = NEW.transaction_id
    )
    THEN RAISE(ABORT, 'Ownership violation: investment_details.fee_transaction_id is missing or not accessible to the same user')
    WHEN NEW.tax_transaction_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM transactions t
      JOIN transactions rel ON rel.id = NEW.tax_transaction_id AND rel.user_id = t.user_id
      WHERE t.id = NEW.transaction_id
    )
    THEN RAISE(ABORT, 'Ownership violation: investment_details.tax_transaction_id is missing or not accessible to the same user')
  END;
END;

CREATE TRIGGER trg_validate_investment_details_ownership_update
BEFORE UPDATE ON investment_details
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions t
      JOIN assets a ON a.id = NEW.asset_id AND a.user_id = t.user_id
      WHERE t.id = NEW.transaction_id
    )
    THEN RAISE(ABORT, 'Ownership violation: investment_details.transaction_id or asset_id is missing or not accessible to the same user')
    WHEN NEW.pl_transaction_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM transactions t
      JOIN transactions rel ON rel.id = NEW.pl_transaction_id AND rel.user_id = t.user_id
      WHERE t.id = NEW.transaction_id
    )
    THEN RAISE(ABORT, 'Ownership violation: investment_details.pl_transaction_id is missing or not accessible to the same user')
    WHEN NEW.fee_transaction_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM transactions t
      JOIN transactions rel ON rel.id = NEW.fee_transaction_id AND rel.user_id = t.user_id
      WHERE t.id = NEW.transaction_id
    )
    THEN RAISE(ABORT, 'Ownership violation: investment_details.fee_transaction_id is missing or not accessible to the same user')
    WHEN NEW.tax_transaction_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM transactions t
      JOIN transactions rel ON rel.id = NEW.tax_transaction_id AND rel.user_id = t.user_id
      WHERE t.id = NEW.transaction_id
    )
    THEN RAISE(ABORT, 'Ownership violation: investment_details.tax_transaction_id is missing or not accessible to the same user')
  END;
END;

-- Ownership validation: refund_items and refund_groups
CREATE TRIGGER trg_validate_refund_items_ownership_insert
BEFORE INSERT ON refund_items
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions
      WHERE id = NEW.income_transaction_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: refund_items.income_transaction_id is missing or not accessible to this user')
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions
      WHERE id = NEW.expense_transaction_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: refund_items.expense_transaction_id is missing or not accessible to this user')
    WHEN NEW.refund_group_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM refund_groups
      WHERE id = NEW.refund_group_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: refund_items.refund_group_id is missing or not accessible to this user')
  END;
END;

CREATE TRIGGER trg_validate_refund_items_ownership_update
BEFORE UPDATE ON refund_items
WHEN NEW.income_transaction_id != OLD.income_transaction_id
  OR NEW.expense_transaction_id != OLD.expense_transaction_id
  OR COALESCE(NEW.refund_group_id, -1) != COALESCE(OLD.refund_group_id, -1)
  OR NEW.user_id != OLD.user_id
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions
      WHERE id = NEW.income_transaction_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: refund_items.income_transaction_id is missing or not accessible to this user')
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions
      WHERE id = NEW.expense_transaction_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: refund_items.expense_transaction_id is missing or not accessible to this user')
    WHEN NEW.refund_group_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM refund_groups
      WHERE id = NEW.refund_group_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: refund_items.refund_group_id is missing or not accessible to this user')
  END;
END;

-- Ownership validation: gocardless requisitions <-> agreements
CREATE TRIGGER trg_validate_gocardless_requisition_agreement_ownership_insert
BEFORE INSERT ON gocardless_requisitions
WHEN NEW.agreement_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM gocardless_agreements
      WHERE agreement_id = NEW.agreement_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: gocardless_requisitions.agreement_id is missing or not accessible to this user')
  END;
END;

CREATE TRIGGER trg_validate_gocardless_requisition_agreement_ownership_update
BEFORE UPDATE ON gocardless_requisitions
WHEN NEW.agreement_id IS NOT NULL AND (
  OLD.agreement_id IS NULL OR
  NEW.agreement_id != OLD.agreement_id OR
  NEW.user_id != OLD.user_id
)
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM gocardless_agreements
      WHERE agreement_id = NEW.agreement_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: gocardless_requisitions.agreement_id is missing or not accessible to this user')
  END;
END;

-- Ownership validation: liabilities <-> accounts
CREATE TRIGGER trg_validate_liabilities_account_ownership_insert
BEFORE INSERT ON liabilities
WHEN NEW.account_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM accounts
      WHERE id = NEW.account_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: liabilities.account_id is missing or not accessible to this user')
  END;
END;

CREATE TRIGGER trg_validate_liabilities_account_ownership_update
BEFORE UPDATE ON liabilities
WHEN NEW.account_id IS NOT NULL AND (
  OLD.account_id IS NULL OR
  NEW.account_id != OLD.account_id OR
  NEW.user_id != OLD.user_id
)
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM accounts
      WHERE id = NEW.account_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: liabilities.account_id is missing or not accessible to this user')
  END;
END;

-- Ownership validation: liability_payment_details <-> liabilities/transactions
CREATE TRIGGER trg_validate_liability_payment_ownership_insert
BEFORE INSERT ON liability_payment_details
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM liabilities
      WHERE id = NEW.liability_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: liability_payment_details.liability_id is missing or not accessible to this user')
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions
      WHERE id = NEW.transaction_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: liability_payment_details.transaction_id is missing or not accessible to this user')
  END;
END;

CREATE TRIGGER trg_validate_liability_payment_ownership_update
BEFORE UPDATE ON liability_payment_details
WHEN NEW.liability_id != OLD.liability_id
  OR NEW.transaction_id != OLD.transaction_id
  OR NEW.user_id != OLD.user_id
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM liabilities
      WHERE id = NEW.liability_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: liability_payment_details.liability_id is missing or not accessible to this user')
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions
      WHERE id = NEW.transaction_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: liability_payment_details.transaction_id is missing or not accessible to this user')
  END;
END;

-- Ownership validation: dismissed_potential_refunds <-> transactions
CREATE TRIGGER trg_validate_dismissed_potential_refunds_ownership_insert
BEFORE INSERT ON dismissed_potential_refunds
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions
      WHERE id = NEW.income_transaction_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: dismissed_potential_refunds.income_transaction_id is missing or not accessible to this user')
  END;
END;

CREATE TRIGGER trg_validate_dismissed_potential_refunds_ownership_update
BEFORE UPDATE ON dismissed_potential_refunds
WHEN NEW.income_transaction_id != OLD.income_transaction_id
  OR NEW.user_id != OLD.user_id
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions
      WHERE id = NEW.income_transaction_id AND user_id = NEW.user_id
    )
    THEN RAISE(ABORT, 'Ownership violation: dismissed_potential_refunds.income_transaction_id is missing or not accessible to this user')
  END;
END;

