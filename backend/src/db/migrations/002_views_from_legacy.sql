DROP VIEW IF EXISTS account_balances;
CREATE VIEW account_balances AS
SELECT
  a.id AS account_id,
  a.user_id,
  a.name AS account_name,
  a.type AS account_type,
  COALESCE(
    (
      SELECT SUM(
        CASE
          WHEN from_account_id = a.id AND to_account_id = a.id THEN 0
          WHEN from_account_id = a.id THEN -amount
          WHEN to_account_id = a.id THEN COALESCE(to_amount, amount)
        END
      )
      FROM transactions
      WHERE (from_account_id = a.id OR to_account_id = a.id)
        AND date <= date('now')
    ), 0
  ) AS current_balance
FROM accounts a
GROUP BY a.id, a.user_id, a.name, a.type;

CREATE VIEW IF NOT EXISTS asset_balances AS
SELECT
  t.user_id,
  i.asset_id,
  a.symbol,
  a.name AS asset_name,
  SUM(
    CASE
      WHEN i.investment_type IN ('Buy', 'Deposit') THEN i.quantity
      WHEN i.investment_type IN ('Sell', 'Withdrawal') THEN -i.quantity
      ELSE 0
    END
  ) AS quantity,
  MAX(t.date) AS last_transaction_date
FROM investment_details i
JOIN transactions t ON i.transaction_id = t.id
JOIN assets a ON i.asset_id = a.id
GROUP BY t.user_id, i.asset_id, a.symbol, a.name
HAVING quantity > 0;

CREATE VIEW IF NOT EXISTS liability_balances AS
SELECT
  l.id AS liability_id,
  l.user_id,
  l.name AS liability_name,
  l.liability_type,
  l.principal_amount,
  l.interest_rate,
  l.direction,
  l.start_date,
  l.end_date,
  COALESCE(
    (SELECT SUM(principal_amount) FROM liability_payment_details WHERE liability_id = l.id), 0
  ) AS principal_paid,
  COALESCE(
    (SELECT SUM(interest_amount) FROM liability_payment_details WHERE liability_id = l.id), 0
  ) AS interest_paid,
  l.principal_amount - COALESCE(
    (SELECT SUM(principal_amount) FROM liability_payment_details WHERE liability_id = l.id), 0
  ) AS remaining_balance,
  0 AS missed_payments_count,
  NULL AS next_payment_date
FROM liabilities l
GROUP BY l.id, l.user_id, l.name, l.liability_type, l.principal_amount, l.interest_rate, l.direction, l.start_date, l.end_date;

CREATE VIEW IF NOT EXISTS asset_balances_by_account AS
SELECT
  t.user_id,
  CASE
    WHEN i.investment_type IN ('Buy', 'Deposit') THEN t.to_account_id
    WHEN i.investment_type IN ('Sell', 'Withdrawal') THEN t.from_account_id
  END AS account_id,
  acc.name AS account_name,
  acc.type AS account_type,
  i.asset_id,
  a.symbol,
  a.name AS asset_name,
  SUM(
    CASE
      WHEN i.investment_type IN ('Buy', 'Deposit') THEN i.quantity
      WHEN i.investment_type IN ('Sell', 'Withdrawal') THEN -i.quantity
      ELSE 0
    END
  ) AS quantity,
  MAX(t.date) AS last_transaction_date
FROM investment_details i
JOIN transactions t ON i.transaction_id = t.id
JOIN assets a ON i.asset_id = a.id
JOIN accounts acc ON (
  (i.investment_type IN ('Buy', 'Deposit') AND acc.id = t.to_account_id) OR
  (i.investment_type IN ('Sell', 'Withdrawal') AND acc.id = t.from_account_id)
)
GROUP BY
  t.user_id,
  CASE
    WHEN i.investment_type IN ('Buy', 'Deposit') THEN t.to_account_id
    WHEN i.investment_type IN ('Sell', 'Withdrawal') THEN t.from_account_id
  END,
  acc.name,
  acc.type,
  i.asset_id,
  a.symbol,
  a.name
HAVING quantity > 0;

