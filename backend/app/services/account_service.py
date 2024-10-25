from app.services.base_service import BaseService
from app.models import Account
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from app.exceptions import NoResultFoundError

class AccountService(BaseService):
    def __init__(self):
        super().__init__('accounts', Account)

    def create(self, data: Dict[str, Any]) -> Optional[Account]:
        """Create account and associated cash account if it's an investment account."""
        try:
            # Start transaction
            with self.db_manager.connect_to_database() as connection:
                connection.execute("BEGIN TRANSACTION")
                
                # Create main account
                if 'tags' in data and isinstance(data['tags'], list):
                    data['tags'] = ','.join(data['tags'])
                
                columns = ', '.join(data.keys())
                placeholders = ', '.join(['?' for _ in data])
                query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders}) RETURNING *"
                result = self.db_manager.execute_insert_returning(query, tuple(data.values()))
                
                # If it's an investment account, create associated cash account
                if data['type'] == 'investment':
                    cash_account_data = {
                        'user_id': data['user_id'],
                        'name': f"{result['name']} cash",
                        'type': 'checking',
                        'currency': data['currency'],
                        'bank_id': data['bank_id'],
                        'tags': 'investment_cash'
                    }
                    
                    columns = ', '.join(cash_account_data.keys())
                    placeholders = ', '.join(['?' for _ in cash_account_data])
                    query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders})"
                    self.db_manager.execute_insert(query, tuple(cash_account_data.values()))
                
                connection.commit()
                return self.model_class(**result)
                
        except Exception as e:
            if 'connection' in locals():
                connection.rollback()
            print(f"Error creating account: {e}")
            return None

    def update(self, id: int, user_id: int, data: Dict[str, Any]) -> Optional[Account]:
        if 'tags' in data and isinstance(data['tags'], list):
            data['tags'] = ','.join(data['tags'])
        return super().update(id, user_id, data)

    def get_by_id(self, id: int, user_id: int) -> Optional[Account]:
        account = super().get_by_id(id, user_id)
        if account:
            if account.tags:
                account.tags = account.tags.split(',')
            account.balance = self.calculate_balance(id)

        return account

    def get_all(self, user_id: int, page: int, per_page: int, filters: Dict[str, Any], sort_by: Optional[str], sort_order: Optional[str], fields: Optional[List[str]], search: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all accounts with their current balances."""
        if fields:
            fields = [field for field in fields if field in self.model_class.__annotations__]
        else:
            fields = list(self.model_class.__annotations__.keys())

        # Modify the query to join with account_balances view
        fields_str = ', '.join(f'a.{field}' for field in fields)
        query = f"""
            SELECT {fields_str}, ab.current_balance as balance
            FROM {self.table_name} a
            LEFT JOIN account_balances ab ON a.id = ab.account_id
            WHERE a.user_id = ?
        """
        params = [user_id]

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
            # Process tags if present
            for result in results:
                if 'tags' in result and result['tags']:
                    result['tags'] = result['tags'].split(',')
            return results if results else []
        except Exception as e:
            print(f"Error in get_all: {e}")
            return []

    def calculate_balance(self, account_id: int) -> float:
        """Get account balance from the account_balances view."""
        query = """
        SELECT current_balance 
        FROM account_balances 
        WHERE account_id = ?
        """
        try:
            result = self.db_manager.execute_select(query, (account_id,))
            return result[0]['current_balance'] if result else 0
        except Exception as e:
            print(f"Error getting account balance: {e}")
            return 0

    def sum_accounts_balances_over_days(self, user_id: int, start_date: str, end_date: str) -> Dict[str, float]:
        query = f"""
            WITH RECURSIVE date_range AS (
                -- Start the recursion with the minimum transaction date
                SELECT MIN(date) AS date
                FROM transactions
                WHERE user_id = ?

                UNION ALL

                -- Recursively generate the next date by adding 1 day
                SELECT date(date, '+1 day')
                FROM date_range
                WHERE date < DATE(?)
            )
            SELECT 
                dr.date, 
                COALESCE(SUM(CASE
                    WHEN t.type = 'income' AND t.to_account_id IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment')) THEN t.amount
                    WHEN t.type = 'expense' AND t.from_account_id IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment')) THEN -t.amount
                    ELSE 0 
                END), 0) AS daily_balance,
                COALESCE(SUM(SUM(CASE 
                    WHEN t.type = 'income' AND t.to_account_id IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment')) THEN t.amount
                    WHEN t.type = 'expense' AND t.from_account_id IN (SELECT id FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings', 'investment')) THEN -t.amount
                    ELSE 0 
                END)) OVER (ORDER BY dr.date), 0) AS cumulative_balance
            FROM date_range dr
            LEFT JOIN transactions t 
                ON dr.date = t.date AND t.user_id = ?
            GROUP BY dr.date
            ORDER BY dr.date;
        """
        params = [user_id, end_date, user_id, user_id, user_id, user_id, user_id]
        try:
            results = self.db_manager.execute_select(query, params)
        except NoResultFoundError as e:
            print("error in sum_accounts_balances_over_days", e)
            return {}
        except Exception as e:
            print("error in sum_accounts_balances_over_days", e)
            return {}
        results = {row['date']: row['cumulative_balance'] for row in results if row['date'] >= start_date and row['date'] <= end_date}
        results.update({end_date: list(results.values())[-1]})
        return results

    def get_wealth(self, user_id: int) -> Dict[str, Any]:
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
            result = self.db_manager.execute_select(query, (user_id,))
        except NoResultFoundError as e:
            print("error in get_wealth", e)
            return {}
        except Exception as e:
            print("error in get_wealth", e)
            return {}
        return result[0] if result else {}
