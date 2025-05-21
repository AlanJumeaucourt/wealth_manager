import logging
from typing import Any

from app.exceptions import NoResultFoundError
from app.models import Account
from app.services.base_service import BaseService, ListQueryParams

logger = logging.getLogger(__name__)


class AccountService(BaseService):
    def __init__(self) -> None:
        super().__init__(table_name="accounts", model_class=Account)

    def get_by_id(self, item_id: int, user_id: int) -> Account | None:
        account = super().get_by_id(item_id=item_id, user_id=user_id)
        if account:
            account.balance = self.calculate_balance(account_id=item_id)

        return account

    def get_all(
        self,
        user_id: int,
        query_params: ListQueryParams,
    ) -> dict[str, Any]:
        result = super().get_all(user_id, query_params)
        # Update balances for items
        for account in result["items"]:
            account["balance"] = self.calculate_balance(account_id=account["id"])

            # Add market value for investment accounts
            if account["type"] == "investment":
                account["market_value"] = self.calculate_market_value(
                    account_id=account["id"]
                )
            else:
                account["market_value"] = None

        return result

    def calculate_balance(self, account_id: int) -> float:
        """Get account balance from the account_balances view."""
        query = """--sql
        SELECT current_balance
        FROM account_balances
        WHERE account_id = ?
        """
        try:
            result = self.db_manager.execute_select(query=query, params=[account_id])
            return round(result[0]["current_balance"] if result else 0, 2)
        except Exception as e:
            print(f"Error getting account balance: {e}")
            return 0

    def calculate_market_value(self, account_id: int) -> float:
        """Calculate the market value of all assets in an investment account."""
        try:
            # Get all assets owned in this account using the new view
            query = """ --sql
            SELECT
                aba.asset_id,
                aba.symbol,
                aba.quantity
            FROM asset_balances_by_account aba
            WHERE aba.account_id = ?
            """

            assets = self.db_manager.execute_select(query, [account_id])

            if not assets:
                return None

            # Import here to avoid circular imports
            from app.services.stock_service import StockService

            stock_service = StockService()

            total_market_value = 0.0

            for asset in assets:
                symbol = asset["symbol"]
                quantity = float(asset["quantity"])

                # Get current price
                current_price = stock_service.get_current_price(symbol)

                if current_price:
                    market_value = quantity * current_price
                    total_market_value += market_value
            if round(total_market_value, 2) == 0.00:
                total_market_value = None
            return round(total_market_value, 2)

        except Exception as e:
            logger.warning(
                f"Error calculating market value for account {account_id}: {e}"
            )
            return None

    def sum_accounts_balances_over_days(
        self,
        user_id: int,
        start_date: str,
        end_date: str,
        account_id: int | None = None,
    ) -> dict[str, float]:
        query = """--sql
            WITH RECURSIVE date_range AS (
                -- Start the recursion with the minimum transaction date
                SELECT MIN(date) AS date
                FROM transactions
                WHERE user_id = ?
                UNION ALL

                -- Recursively generate the next date by adding 1 day
                SELECT date(date, '+1 day')
                FROM date_range
                WHERE date < (SELECT MAX(date) FROM transactions WHERE user_id = ?)
            ),
            daily_balances AS (
                SELECT
                    dr.date,
                    COALESCE(SUM(CASE
                        WHEN t.type = 'income' AND t.to_account_id IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment', 'loan')) THEN t.amount
                        WHEN t.type = 'expense' AND t.from_account_id IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment', 'loan')) THEN -t.amount
                        WHEN t.type = 'transfer' THEN (
                            CASE
                                WHEN t.to_account_id IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment', 'loan'))
                                AND t.from_account_id NOT IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment', 'loan'))
                                THEN t.amount
                                WHEN t.from_account_id IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment', 'loan'))
                                AND t.to_account_id NOT IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment', 'loan'))
                                THEN -t.amount
                                ELSE 0
                            END
                        )
                        ELSE 0
                    END), 0) AS daily_balance
                FROM date_range dr
                LEFT JOIN transactions t
                    ON dr.date = DATE(t.date) AND t.user_id = ?
                GROUP BY dr.date
            ),
            cumulative_balances AS (
                SELECT
                    db.date,
                    SUM(db.daily_balance) OVER (ORDER BY db.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_balance
                FROM daily_balances db
            )
            SELECT
                cb.date,
                cb.cumulative_balance
            FROM cumulative_balances cb
            ORDER BY cb.date;
        """
        params = [*([user_id] * 9)]

        if account_id:
            query = """--sql
                WITH RECURSIVE date_range AS (
                    -- Start the recursion with the minimum transaction date
                    SELECT MIN(date) AS date
                    FROM transactions
                    WHERE user_id = ?
                    AND (from_account_id = ? OR to_account_id = ?)
                    UNION ALL

                    -- Recursively generate the next date by adding 1 day
                    SELECT date(date, '+1 day')
                    FROM date_range
                    WHERE date < (SELECT MAX(date) FROM transactions WHERE user_id = ?)
                ),
                daily_balances AS (
                    SELECT
                        dr.date,
                        COALESCE(SUM(CASE
                            WHEN t.type = 'income' AND t.to_account_id = ? THEN t.amount
                            WHEN t.type = 'expense' AND t.from_account_id = ? THEN -t.amount
                            WHEN t.type = 'transfer' AND t.to_account_id = ? THEN t.amount
                            WHEN t.type = 'transfer' AND t.from_account_id = ? THEN -t.amount
                            ELSE 0
                        END), 0) AS daily_balance
                    FROM date_range dr
                    LEFT JOIN transactions t
                        ON dr.date = DATE(t.date) AND t.user_id = ?
                    GROUP BY dr.date
                ),
                cumulative_balances AS (
                    SELECT
                        db.date,
                        SUM(db.daily_balance) OVER (ORDER BY db.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_balance
                    FROM daily_balances db
                )
                SELECT
                    cb.date,
                    cb.cumulative_balance
                FROM cumulative_balances cb
                ORDER BY cb.date;
            """
            params = [
                user_id,
                *([account_id] * 2),
                user_id,
                *([account_id] * 4),
                user_id,
            ]

        try:
            results = self.db_manager.execute_select(query, params)
            return {
                row["date"]: round(row["cumulative_balance"], 2)
                for row in results
                if start_date <= row["date"] <= end_date
            }
        except Exception as e:
            print("error in get_accounts_balance_over_days", e)
            return {}

    def get_wealth(self, user_id: int) -> dict[str, Any]:
        query = """--sql
        SELECT
            SUM(CASE WHEN type IN ('checking', 'savings', 'investment', 'loan') THEN
                (SELECT COALESCE(SUM(CASE
                    WHEN t.type = 'income' AND t.to_account_id = a.id THEN t.amount
                    WHEN t.type = 'expense' AND t.from_account_id = a.id THEN -t.amount
                    WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN t.amount
                    WHEN t.type = 'transfer' AND t.from_account_id = a.id THEN -t.amount
                    ELSE 0
                END), 0) FROM transactions t WHERE t.from_account_id = a.id OR t.to_account_id = a.id)
            ELSE 0 END) as total_balance,
            SUM(CASE WHEN type = 'checking' THEN
                (SELECT COALESCE(SUM(CASE
                    WHEN t.type = 'income' AND t.to_account_id = a.id THEN t.amount
                    WHEN t.type = 'expense' AND t.from_account_id = a.id THEN -t.amount
                    WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN t.amount
                    WHEN t.type = 'transfer' AND t.from_account_id = a.id THEN -t.amount
                    ELSE 0
                END), 0) FROM transactions t WHERE t.from_account_id = a.id OR t.to_account_id = a.id)
            ELSE 0 END) as checking_balance,
            SUM(CASE WHEN type = 'savings' THEN
                (SELECT COALESCE(SUM(CASE
                    WHEN t.type = 'income' AND t.to_account_id = a.id THEN t.amount
                    WHEN t.type = 'expense' AND t.from_account_id = a.id THEN -t.amount
                    WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN t.amount
                    WHEN t.type = 'transfer' AND t.from_account_id = a.id THEN -t.amount
                    ELSE 0
                END), 0) FROM transactions t WHERE t.from_account_id = a.id OR t.to_account_id = a.id)
            ELSE 0 END) as savings_balance,
            SUM(CASE WHEN type = 'investment' THEN
                (SELECT COALESCE(SUM(CASE
                    WHEN t.type = 'income' AND t.to_account_id = a.id THEN t.amount
                    WHEN t.type = 'expense' AND t.from_account_id = a.id THEN -t.amount
                    WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN t.amount
                    WHEN t.type = 'transfer' AND t.from_account_id = a.id THEN -t.amount
                    ELSE 0
                END), 0) FROM transactions t WHERE t.from_account_id = a.id OR t.to_account_id = a.id)
            ELSE 0 END) as investment_balance,
            SUM(CASE WHEN type = 'loan' THEN
                (SELECT COALESCE(SUM(CASE
                    WHEN t.type = 'income' AND t.to_account_id = a.id THEN t.amount
                    WHEN t.type = 'expense' AND t.from_account_id = a.id THEN -t.amount
                    WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN t.amount
                    WHEN t.type = 'transfer' AND t.from_account_id = a.id THEN -t.amount
                    ELSE 0
                END), 0) FROM transactions t WHERE t.from_account_id = a.id OR t.to_account_id = a.id)
            ELSE 0 END) as loan_balance
        FROM accounts a
        WHERE a.user_id = ?
        """
        try:
            result = self.db_manager.execute_select(query=query, params=[user_id])
        except NoResultFoundError as e:
            print("error in get_wealth", e)
            return {}
        except Exception as e:
            print("error in get_wealth", e)
            return {}
        return result[0] if result else {}

    def get_account_balance(self, user_id: int, account_id: int) -> dict[str, float]:
        query = """--sql
            WITH RECURSIVE date_range AS (
                -- Start the recursion with the minimum transaction date
                SELECT MIN(date) AS date
                FROM transactions
                WHERE user_id = ?
                AND (from_account_id = ? OR to_account_id = ?)

                UNION ALL

                -- Recursively generate the next date by adding 1 day
                SELECT date(date, '+1 day')
                FROM date_range
                WHERE date < (SELECT MAX(date) FROM transactions WHERE user_id = ?)
            ),
            daily_balances AS (
                SELECT
                    dr.date,
                    COALESCE(SUM(CASE
                        WHEN t.type = 'income' AND t.to_account_id = ? THEN t.amount
                        WHEN t.type = 'expense' AND t.from_account_id = ? THEN -t.amount
                        WHEN t.type = 'transfer' AND t.to_account_id = ? THEN t.amount
                        WHEN t.type = 'transfer' AND t.from_account_id = ? THEN -t.amount
                        ELSE 0
                    END), 0) AS daily_balance
                FROM date_range dr
                LEFT JOIN transactions t
                    ON dr.date = DATE(t.date) AND t.user_id = ?
                GROUP BY dr.date
            ),
            cumulative_balances AS (
                SELECT
                    db.date,
                    SUM(db.daily_balance) OVER (ORDER BY db.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_balance
                FROM daily_balances db
            )
            SELECT
                cb.date,
                cb.cumulative_balance
            FROM cumulative_balances cb
            ORDER BY cb.date;
        """
        params = [
            user_id,
            account_id,
            account_id,
            user_id,
            account_id,
            account_id,
            account_id,
            account_id,
            user_id,
        ]
        try:
            results = self.db_manager.execute_select(query, params)

            # Sort results by date
            results.sort(key=lambda x: x["date"])

            return {row["date"]: round(row["cumulative_balance"], 2) for row in results}
        except Exception as e:
            print("error in get_account_balance_over_days", e)
            return {}
