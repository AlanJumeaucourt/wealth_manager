from app.services.base_service import BaseService
from app.models import Transaction
from app.exceptions import NoResultFoundError
from typing import Dict, Any, Optional, List

class TransactionService(BaseService):
    def __init__(self):
        super().__init__('transactions', Transaction)

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
    ) -> Dict[str, Any]:
        print("Fetching transactions for user:", user_id)  # Add this log
        print("With filters:", filters)  # Add this log
        
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
        
        params = [user_id]
        total_params = [user_id]

        # Handle the account_id filter
        account_id = filters.get('account_id')
        if account_id:
            print(f"Filtering by account_id: {account_id}")  # Add this log
            account_condition = " AND (from_account_id = ? OR to_account_id = ?)"
            query += account_condition
            total_query += account_condition
            params.extend([account_id, account_id])
            total_params.extend([account_id, account_id])

        # Handle search
        if search:
            search = f"%{search}%"
            search_condition = " AND (description LIKE ? OR category LIKE ? OR subcategory LIKE ?)"
            query += search_condition
            total_query += search_condition
            params.extend([search, search, search])
            total_params.extend([search, search, search])

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
            
            result = {
                'transactions': transactions if transactions else [],
                'total_amount': total_result[0]['total_amount'] if total_result else 0,
                'count': total_result[0]['count'] if total_result else 0
            }
            print("Returning transactions:", result)  # Add this log
            return result
        except Exception as e:
            print(f"Error in get_all: {e}")
            return {'transactions': [], 'total_amount': 0, 'count': 0}

    # Add any other transaction-specific methods here
