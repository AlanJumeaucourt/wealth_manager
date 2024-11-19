from app.services.base_service import BaseService
from app.models import Transaction
from app.exceptions import NoResultFoundError, TransactionValidationError
from typing import Dict, Any, Optional, List, TypedDict, Union
from datetime import datetime
from app.routes.base_routes import validate_date_format

class TransactionData(TypedDict):
    transactions: List[Dict[str, Any]]
    total_amount: float
    count: int

class TransactionService(BaseService):
    def __init__(self):
        super().__init__('transactions', Transaction)

    def validate_transaction(self, data: Dict[str, Any]) -> None:
        """Validate transaction data based on account types and transaction type."""
        # First validate dates
        validate_date_format(data['date'])
        validate_date_format(data['date_accountability'])

        try:
            # Get account types
            query = """
                SELECT id, type, name FROM accounts
                WHERE id IN (?, ?) AND user_id = ?
            """
            accounts = self.db_manager.execute_select(
                query,
                (data['from_account_id'], data['to_account_id'], data['user_id'])
            )

            if len(accounts) != 2:
                raise TransactionValidationError("Invalid account IDs or unauthorized access")

            # Create account lookup
            account_map = {acc['id']: acc for acc in accounts}
            from_account = account_map[data['from_account_id']]
            to_account = account_map[data['to_account_id']]

            transaction_type = data['type']

            # Validate based on transaction type
            if transaction_type == 'income':
                # Income should go to a regular account (checking, savings, investment)
                if to_account['type'] not in ['checking', 'savings', 'investment']:
                    raise TransactionValidationError(
                        f"Income cannot be received in a {to_account['type']} account"
                    )
                # Income should come from an income account
                if from_account['type'] != 'income':
                    raise TransactionValidationError(
                        "Income must originate from an income account"
                    )

            elif transaction_type == 'expense':
                # Expense should come from a regular account
                if from_account['type'] not in ['checking', 'savings', 'investment']:
                    raise TransactionValidationError(
                        f"Expenses cannot be paid from a {from_account['type']} account"
                    )
                # Expense should go to an expense account
                if to_account['type'] != 'expense':
                    raise TransactionValidationError(
                        "Expenses must go to an expense account"
                    )

            elif transaction_type == 'transfer':
                # Transfers should be between regular accounts
                valid_account_types = ['checking', 'savings', 'investment']
                if from_account['type'] not in valid_account_types:
                    raise TransactionValidationError(
                        f"Cannot transfer from a {from_account['type']} account"
                    )
                if to_account['type'] not in valid_account_types:
                    raise TransactionValidationError(
                        f"Cannot transfer to a {to_account['type']} account"
                    )

            else:
                raise TransactionValidationError(f"Invalid transaction type: {transaction_type}")

        except TransactionValidationError:
            raise
        except Exception as e:
            raise TransactionValidationError(f"Validation error: {str(e)}")

    def create(self, data: Dict[str, Any]) -> Optional[Transaction]:
        """Create a transaction with validation."""
        # Validate transaction
        self.validate_transaction(data)
        return super().create(data)

    def get_all(
        self,
        user_id: int,
        page: int,
        per_page: int,
        filters: Dict[str, Any],
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
        fields: Optional[List[str]] = None,
        search: Optional[str] = None
    ) -> TransactionData:
        """Get all transactions with filtering and pagination."""
        if fields:
            fields = [field for field in fields if field in self.model_class.__annotations__]
        else:
            fields = list(self.model_class.__annotations__.keys())

        # Base query for transactions
        query = f"SELECT {', '.join(fields)} FROM {self.table_name} WHERE user_id = ?"
        # Query for total amount
        total_query = """
            SELECT
                COALESCE(SUM(CASE WHEN type = 'expense' THEN -amount
                                WHEN type = 'income' THEN amount
                                ELSE 0 END), 0) as total_amount,
                COUNT(*) as count
            FROM {table_name}
            WHERE user_id = ?
        """.format(table_name=self.table_name)

        params: List[Union[int, str]] = [user_id]
        total_params: List[Union[int, str]] = [user_id]

        # Handle the account_id filter
        account_id = filters.get('account_id')
        if account_id:
            account_condition = " AND (from_account_id = ? OR to_account_id = ?)"
            query += account_condition
            total_query += account_condition
            params.extend([account_id, account_id])
            total_params.extend([account_id, account_id])

        # Handle search
        if search:
            search_pattern = f"%{search}%"
            search_condition = " AND (description LIKE ? OR category LIKE ? OR subcategory LIKE ?)"
            query += search_condition
            total_query += search_condition
            params.extend([search_pattern, search_pattern, search_pattern])
            total_params.extend([search_pattern, search_pattern, search_pattern])

        # Handle other filters
        for key, value in filters.items():
            if value is not None and key != 'account_id':
                filter_condition = f" AND {key} = ?"
                query += filter_condition
                total_query += filter_condition
                params.append(value)
                total_params.append(value)

        if sort_by and sort_order:
            query += f" ORDER BY {sort_by} {sort_order}"

        query += " LIMIT ? OFFSET ?"
        params.extend([per_page, (page - 1) * per_page])

        try:
            # Get transactions
            transactions = self.db_manager.execute_select(query, params)
            # Get total amount and count
            total_result = self.db_manager.execute_select(total_query, total_params)

            return {
                'transactions': transactions if transactions else [],
                'total_amount': total_result[0]['total_amount'] if total_result else 0,
                'count': total_result[0]['count'] if total_result else 0
            }
        except Exception as e:
            print(f"Error in get_all: {e}")
            return {'transactions': [], 'total_amount': 0, 'count': 0}

    # Add any other transaction-specific methods here
