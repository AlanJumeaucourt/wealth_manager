from typing import Any, TypedDict

from app.exceptions import TransactionValidationError
from app.models import Transaction
from app.routes.base_routes import validate_date_format
from app.services.base_service import BaseService, ListQueryParams


class TransactionData(TypedDict):
    transactions: list[dict[str, Any]]
    total_amount: float
    count: int


class TransactionService(BaseService):
    def __init__(self) -> None:
        super().__init__(table_name="transactions", model_class=Transaction)

    def validate_transaction(self, data: dict[str, Any]) -> None:
        """Validate transaction data based on account types and transaction type."""
        # First validate dates
        validate_date_format(date_str=data["date"])
        validate_date_format(date_str=data["date_accountability"])

        try:
            # Get account types
            query = """
                SELECT id, type, name FROM accounts
                WHERE id IN (?, ?) AND user_id = ?
            """
            accounts = self.db_manager.execute_select(
                query=query,
                params=[
                    data["from_account_id"],
                    data["to_account_id"],
                    data["user_id"],
                ],
            )
            number_of_accounts_for_transaction = 2
            if len(accounts) != number_of_accounts_for_transaction:
                raise TransactionValidationError(
                    "Invalid account IDs or unauthorized access"
                )

            # Create account lookup
            account_map = {acc["id"]: acc for acc in accounts}
            from_account = account_map[data["from_account_id"]]
            to_account = account_map[data["to_account_id"]]

            transaction_type = data["type"]

            # Validate based on transaction type
            if transaction_type == "income":
                # Income should go to a regular account (checking, savings, investment)
                if to_account["type"] not in ["checking", "savings", "investment"]:
                    raise TransactionValidationError(
                        f"Income cannot be received in a {to_account['type']} account"
                    )
                # Income should come from an income account
                if from_account["type"] != "income":
                    raise TransactionValidationError(
                        "Income must originate from an income account"
                    )

            elif transaction_type == "expense":
                # Expense should come from a regular account
                if from_account["type"] not in ["checking", "savings", "investment"]:
                    raise TransactionValidationError(
                        f"Expenses cannot be paid from a {from_account['type']} account"
                    )
                # Expense should go to an expense account
                if to_account["type"] != "expense":
                    raise TransactionValidationError(
                        "Expenses must go to an expense account"
                    )

            elif transaction_type == "transfer":
                # Transfers should be between regular accounts
                valid_account_types = ["checking", "savings", "investment"]
                if from_account["type"] not in valid_account_types:
                    raise TransactionValidationError(
                        f"Cannot transfer from a {from_account['type']} account"
                    )
                if to_account["type"] not in valid_account_types:
                    raise TransactionValidationError(
                        f"Cannot transfer to a {to_account['type']} account"
                    )

            else:
                raise TransactionValidationError(
                    f"Invalid transaction type: {transaction_type}"
                )

        except TransactionValidationError:
            raise
        except Exception as e:
            raise TransactionValidationError(f"Validation error: {e!s}")

    def create(self, data: dict[str, Any]) -> Transaction | None:
        """Create a transaction with validation."""
        # Validate transaction
        self.validate_transaction(data)
        return super().create(data)

    def get_all(self, user_id: int, query_params: ListQueryParams) -> dict[str, Any]:
        # Get transactions using parent method
        transactions = super().get_all(user_id, query_params)

        # Calculate total amount for the filtered transactions
        try:
            # Build the base query for total amount
            total_query = (
                "SELECT SUM(amount) as total FROM transactions WHERE user_id = ?"
            )
            total_params: list[Any] = [user_id]

            # Apply the same filters as the main query
            total_query, total_params = self._build_filter_conditions(
                total_query, total_params, query_params.filters
            )
            total_query, total_params = self._build_search_conditions(
                total_query,
                total_params,
                query_params.search,
                query_params.search_fields,
            )

            # Execute the total amount query
            result = self.db_manager.execute_select(total_query, total_params)
            total_amount = result[0]["total"] if result[0]["total"] else 0

            # Add total_amount to the response
            return {**transactions, "total_amount": float(total_amount)}

        except Exception as e:
            print(f"Error calculating total amount: {e}")
            return {**transactions, "total_amount": 0}

    def _build_filter_conditions(
        self, query: str, params: list[Any], filters: dict[str, Any]
    ) -> tuple[str, list[Any]]:
        # Create a copy of filters to avoid modifying the original
        filters_copy = filters.copy()

        # Handle account_id filter specially
        if "account_id" in filters_copy:
            account_id = filters_copy.pop("account_id")
            if account_id is not None:
                # Remove from_account_id and to_account_id filters if they exist
                filters_copy.pop("from_account_id", None)
                filters_copy.pop("to_account_id", None)
                query += " AND (from_account_id = ? OR to_account_id = ?)"
                params.extend([account_id, account_id])

        # Call parent class method with the modified filters
        return super()._build_filter_conditions(query, params, filters_copy)

    # Add any other transaction-specific methods here
