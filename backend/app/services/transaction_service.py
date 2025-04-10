from typing import Any, TypedDict

from app.exceptions import TransactionValidationError
from app.logger import get_logger
from app.models import Transaction
from app.routes.base_routes import validate_date_format
from app.services.base_service import BaseService, ListQueryParams


class TransactionData(TypedDict):
    items: list[dict[str, Any]]
    total_amount: float
    count: int
    total: int
    page: int
    per_page: int


class TransactionService(BaseService[Transaction]):
    def __init__(self) -> None:
        super().__init__(table_name="transactions", model_class=Transaction)
        self.logger = get_logger(__name__)
        # Define custom allowed filters for transactions
        self.custom_allowed_filters = [
            "account_id",
            "has_refund",
            "from_date",
            "to_date",
        ]

    def validate_transaction(self, data: dict[str, Any]) -> None:
        """Validate transaction data based on account types and transaction type."""
        # First validate dates
        validate_date_format(date_str=data["date"])
        validate_date_format(date_str=data["date_accountability"])

        try:
            # Get account types
            query = """--sql
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

    def batch_create(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        """Create multiple transactions in a batch operation with validation.

        Args:
            items: List of dictionaries containing transaction data

        Returns:
            Dictionary containing successful and failed creations

        """
        if not items:
            return {
                "successful": [],
                "failed": [],
                "total_successful": 0,
                "total_failed": 0,
            }

        # Pre-validate all transactions
        valid_items: list[dict[str, Any]] = []
        failed_items: list[dict[str, Any]] = []

        for item in items:
            try:
                # Validate each transaction
                self.validate_transaction(item)
                valid_items.append(item)
            except Exception as e:
                failed_items.append({"data": item, "error": str(e)})

        # Use parent's batch_create for valid items
        result = super().batch_create(valid_items)

        # Add pre-validation failures to the result
        result["failed"].extend(failed_items)
        result["total_failed"] += len(failed_items)

        return result

    def get_all(self, user_id: int, query_params: ListQueryParams) -> TransactionData:
        # First get filtered transactions using parent method to maintain original filtering
        base_results = super().get_all(user_id, query_params)
        transactions = base_results["items"]

        # Build count query
        total_query = (
            f"SELECT SUM(amount) as total FROM {self.table_name} WHERE user_id = ?"
        )
        total_params = [user_id]

        total_query, total_params = self._build_filter_conditions(
            total_query, total_params, query_params.filters
        )
        total_query, total_params = self._build_search_conditions(
            total_query,
            total_params,
            query_params.search,
            query_params.search_fields,
        )

        total_results = self.db_manager.execute_select(total_query, total_params)
        total_amount = total_results[0]["total"] if total_results else 0.0

        # Now enrich the transactions with refund information
        if transactions:
            transaction_ids = [str(t["id"]) for t in transactions]
            refund_query = """--sql
                SELECT t.id as transaction_id,
                    ri.id as refund_id,
                    ri.amount as refund_amount,
                    ri.description as refund_description,
                    it.date as refund_date,
                    ri.refund_group_id
                FROM transactions t
                LEFT JOIN refund_items ri ON (t.id = ri.expense_transaction_id OR t.id = ri.income_transaction_id)
                    AND ri.user_id = t.user_id
                LEFT JOIN transactions it ON ri.income_transaction_id = it.id
                WHERE t.id IN ({}) AND t.user_id = ?
            """.format(",".join(["?"] * len(transaction_ids)))  # noqa: S608

            params = [*transaction_ids, user_id]
            refund_results = self.db_manager.execute_select(refund_query, params)

            # Group refunds by transaction
            refunds_by_transaction = {}
            for refund in refund_results:
                transaction_id = refund["transaction_id"]
                if (
                    refund["refund_id"] is not None
                ):  # Only add if there's actually a refund
                    if transaction_id not in refunds_by_transaction:
                        refunds_by_transaction[transaction_id] = []
                    refunds_by_transaction[transaction_id].append(
                        {
                            "id": refund["refund_id"],
                            "amount": float(refund["refund_amount"]),
                            "date": refund["refund_date"],
                            "description": refund["refund_description"],
                            "refund_group_id": refund["refund_group_id"],
                        }
                    )

            # Add refunds to transactions
            for transaction in transactions:
                transaction["refund_items"] = refunds_by_transaction.get(
                    transaction["id"], []
                )
                # Calculate total refunded amount for each transaction
                transaction["refunded_amount"] = sum(
                    refund["amount"] for refund in transaction["refund_items"]
                )

        return {
            "items": transactions,
            "total": base_results["total"],
            "total_amount": total_amount,
            "count": len(transactions),
            "page": base_results["page"],
            "per_page": base_results["per_page"],
        }

    def _build_filter_conditions(
        self, query: str, params: list[Any], filters: dict[str, Any]
    ) -> tuple[str, list[Any]]:
        # Create a copy of filters to avoid modifying the original
        filters_copy = filters.copy()
        self.logger.debug(f"Building filter conditions with filters: {filters_copy}")

        # Handle date range filters
        if "from_date" in filters_copy:
            from_date = filters_copy.pop("from_date")
            if from_date:
                query += " AND date_accountability >= date(?)"
                params.append(from_date)

        if "to_date" in filters_copy:
            to_date = filters_copy.pop("to_date")
            if to_date:
                query += " AND date_accountability <= date(?)"
                params.append(to_date)

        # Handle account_id filter specially
        if "account_id" in filters_copy:
            account_id = filters_copy.pop("account_id")
            if account_id is not None:
                # Remove from_account_id and to_account_id filters if they exist
                filters_copy.pop("from_account_id", None)
                filters_copy.pop("to_account_id", None)
                query += " AND (from_account_id = ? OR to_account_id = ?)"
                params.extend([account_id, account_id])

        # Handle has_refund filter
        if "has_refund" in filters_copy:
            has_refund = filters_copy.pop("has_refund")
            if has_refund is not None:
                exists_subquery = """--sql
                    EXISTS (
                        SELECT 1 FROM refund_items ri
                        WHERE (transactions.id = ri.expense_transaction_id
                        OR transactions.id = ri.income_transaction_id)
                        AND ri.user_id = transactions.user_id
                    )
                """
                query += (
                    f" AND {'' if has_refund == 'true' else 'NOT'} {exists_subquery}"
                )

        # Call parent class method with the modified filters
        return super()._build_filter_conditions(query, params, filters_copy)

    # Add any other transaction-specific methods here
