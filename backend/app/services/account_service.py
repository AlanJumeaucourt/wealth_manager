from typing import Any

from app.exceptions import NoResultFoundError
from app.models import Account
from app.services.base_service import BaseService


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
        page: int,
        per_page: int,
        filters: dict[str, Any],
        sort_by: str | None,
        sort_order: str | None,
        fields: list[str] | None,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        """Get all accounts with their current balances."""
        if fields:
            fields = [
                field for field in fields if field in self.model_class.__annotations__
            ]
        else:
            fields = list(self.model_class.__annotations__.keys())

        # Modify the query to join with account_balances view
        fields_str = ", ".join(f"a.{field}" for field in fields)
        query = f"""
            SELECT {fields_str}, ab.current_balance as balance
            FROM {self.table_name} a
            LEFT JOIN account_balances ab ON a.id = ab.account_id
            WHERE a.user_id = ?
        """  # noqa: S608 fields are sanitized by the schema
        params: list[Any] = [user_id]

        # Handle other filters
        for key, value in filters.items():
            if value is not None:
                query += f" AND a.{key} = ?"
                params.append(value)

        # Handle search
        if search:
            search = f"%{search}%"
            query += " AND (a.name LIKE ?)"
            params.append(search)

        if sort_by and sort_order:
            query += f" ORDER BY a.{sort_by} {sort_order}"

        query += " LIMIT ? OFFSET ?"
        params.extend([per_page, (page - 1) * per_page])

        try:
            results = self.db_manager.execute_select(query, params)
        except Exception as e:
            print(f"Error in get_all: {e}")
            return []
        else:
            return results

    def calculate_balance(self, account_id: int) -> float:
        """Get account balance from the account_balances view."""
        query = """
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

    def sum_accounts_balances_over_days(
        self, user_id: int, start_date: str, end_date: str
    ) -> dict[str, float]:
        query = """
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
                        WHEN t.type = 'income' AND t.to_account_id IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment')) THEN t.amount
                        WHEN t.type = 'expense' AND t.from_account_id IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment')) THEN -t.amount
                        WHEN t.type = 'transfer' AND t.to_account_id IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment')) THEN t.amount
                        WHEN t.type = 'transfer' AND t.from_account_id IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment')) THEN -t.amount
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
        params = [user_id, user_id, user_id, user_id, user_id, user_id, user_id]
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
        query = """
        SELECT
            SUM(CASE WHEN type IN ('checking', 'savings', 'investment') THEN
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
            ELSE 0 END) as investment_balance
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
        query = """
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
