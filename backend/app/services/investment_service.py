import logging
from collections import defaultdict
from datetime import date as datetime_date
from datetime import datetime, timedelta
from typing import Any

from app.database import DatabaseManager
from app.schemas.schema_registry import InvestmentTransactionSchema
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


class InvestmentService(BaseService):
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.schema = InvestmentTransactionSchema()

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create investment transaction and associated details."""
        # Validate data using schema
        validated_data = self.schema.load(data)

        connection = None
        try:
            # Start transaction
            connection = self.db_manager.connect_to_database()
            connection.execute("BEGIN TRANSACTION")

            # Prepare transaction data
            transaction_data = {
                "user_id": validated_data["user_id"],
                "date": validated_data["date"],
                "date_accountability": validated_data["date"],
                "description": f"{validated_data['activity_type'].title()} {validated_data['quantity']} units of asset {validated_data['asset_id']}",
                "amount": (validated_data["quantity"] * validated_data["unit_price"])
                + validated_data["fee"]
                + validated_data["tax"],
                "from_account_id": validated_data["from_account_id"],
                "to_account_id": validated_data["to_account_id"],
                "category": "Investment",
                "type": "transfer",
                "is_investment": True,
            }

            # Create transaction
            columns = ", ".join(transaction_data.keys())
            placeholders = ", ".join(["?" for _ in transaction_data])
            query = f"INSERT INTO transactions ({columns}) VALUES ({placeholders}) RETURNING *"
            transaction_result = self.db_manager.execute_insert_returning(
                query=query, params=list(transaction_data.values())
            )

            # Prepare investment details data
            investment_data = {
                "transaction_id": transaction_result["id"],
                "asset_id": validated_data["asset_id"],
                "quantity": validated_data["quantity"],
                "unit_price": validated_data["unit_price"],
                "fee": validated_data["fee"],
                "tax": validated_data["tax"],
                "total_paid": (
                    validated_data["quantity"] * validated_data["unit_price"]
                )
                + validated_data["fee"]
                + validated_data["tax"],
            }

            # Create investment details
            columns = ", ".join(investment_data.keys())
            placeholders = ", ".join(["?" for _ in investment_data])
            query = f"INSERT INTO investment_details ({columns}) VALUES ({placeholders}) RETURNING *"
            investment_result = self.db_manager.execute_insert_returning(
                query=query, params=list(investment_data.values())
            )
            print(f"query={query}")
            print(f"params={list(investment_data.values())}")
            print(f"investment_result={investment_result}")

            # Calculate quantity change based on activity type
            quantity_change = (
                validated_data["quantity"]
                if validated_data["activity_type"] == "buy"
                else -validated_data["quantity"]
                if validated_data["activity_type"] == "sell"
                else 0
            )

            # First try to update existing record
            update_query = """--sql
            UPDATE account_assets
            SET quantity = quantity + ?
            WHERE account_id = ? AND asset_id = ? AND user_id = ?
            """

            cursor = connection.cursor()
            cursor.execute(
                update_query,
                (
                    quantity_change,
                    validated_data["to_account_id"],
                    validated_data["asset_id"],
                    validated_data["user_id"],
                ),
            )

            # If no rows were updated, insert new record
            if cursor.rowcount == 0:
                insert_query = """--sql
                INSERT INTO account_assets (user_id, account_id, asset_id, quantity)
                VALUES (?, ?, ?, ?)
                """
                cursor.execute(
                    insert_query,
                    (
                        validated_data["user_id"],
                        validated_data["to_account_id"],
                        validated_data["asset_id"],
                        quantity_change,
                    ),
                )

            connection.commit()

            # Return the complete response with all IDs
            return {
                "id": transaction_result["id"],
                "transaction_id": transaction_result["id"],
                "investment_details_id": investment_result["transaction_id"],
                "activity_type": validated_data["activity_type"],
                "asset_id": validated_data["asset_id"],
                "date": validated_data["date"],
                "fee": validated_data["fee"],
                "from_account_id": validated_data["from_account_id"],
                "quantity": validated_data["quantity"],
                "tax": validated_data["tax"],
                "to_account_id": validated_data["to_account_id"],
                "total_paid": investment_data["total_paid"],
                "unit_price": validated_data["unit_price"],
                "user_id": validated_data["user_id"],
            }

        except Exception as e:
            if connection is not None:
                connection.rollback()
            logger.error(f"Error creating investment transaction: {e}")
            raise

    def get_asset_transactions(self, user_id: int, symbol: str) -> list[dict[str, Any]]:
        """Get all transactions for a specific asset symbol."""
        query = """--sql
        SELECT
            t.id,
            t.date,
            t.amount,
            i.quantity,
            i.unit_price,
            i.fee,
            i.tax,
            i.total_paid,
            CASE
                WHEN t.from_account_id = a.id THEN 'sell'
                ELSE 'buy'
            END as activity_type
        FROM transactions t
        JOIN investment_details i ON t.id = i.transaction_id
        JOIN assets ast ON i.asset_id = ast.id
        JOIN accounts a ON (t.from_account_id = a.id OR t.to_account_id = a.id)
        WHERE t.user_id = ?
        AND ast.symbol = ?
        AND t.is_investment = TRUE
        ORDER BY t.date DESC
        """
        return self.db_manager.execute_select(query=query, params=[user_id, symbol])

    def get_portfolio_summary(
        self, user_id: int, account_id: int | None = None
    ) -> dict[str, Any]:
        """Get portfolio summary with current holdings and values."""
        account_filter = "AND aa.account_id = ?" if account_id else ""
        params = [user_id]
        if account_id:
            params.append(account_id)

        query = f"""--sql
        SELECT
            a.symbol,
            a.name,
            aa.quantity as shares,
            (SELECT unit_price
             FROM investment_details i
             JOIN transactions t ON i.transaction_id = t.id
             WHERE i.asset_id = a.id
             AND t.user_id = ?
             ORDER BY t.date DESC
             LIMIT 1) as current_price,
            (SELECT AVG(i.unit_price)
             FROM investment_details i
             JOIN transactions t ON i.transaction_id = t.id
             WHERE i.asset_id = a.id
             AND t.user_id = ?
             AND t.is_investment = TRUE) as avg_price
        FROM account_assets aa
        JOIN assets a ON aa.asset_id = a.id
        WHERE aa.user_id = ? {account_filter}
        """

        params = [user_id, user_id, user_id]
        if account_id:
            params.append(account_id)

        holdings = self.db_manager.execute_select(query=query, params=params)

        summary = {
            "total_value": 0,
            "total_cost": 0,
            "total_gain_loss": 0,
            "total_gain_loss_percentage": 0,
            "assets": [],
        }

        for holding in holdings:
            current_value = holding["shares"] * holding["current_price"]
            cost_basis = holding["shares"] * holding["avg_price"]
            gain_loss = current_value - cost_basis
            gain_loss_percentage = (
                (gain_loss / cost_basis * 100) if cost_basis > 0 else 0
            )

            asset = {
                "symbol": holding["symbol"],
                "name": holding["name"],
                "shares": holding["shares"],
                "current_price": holding["current_price"],
                "current_value": current_value,
                "cost_basis": cost_basis,
                "gain_loss": gain_loss,
                "gain_loss_percentage": gain_loss_percentage,
            }

            summary["assets"].append(asset)
            summary["total_value"] += current_value
            summary["total_cost"] += cost_basis

        summary["total_gain_loss"] = summary["total_value"] - summary["total_cost"]
        summary["total_gain_loss_percentage"] = (
            (summary["total_gain_loss"] / summary["total_cost"] * 100)
            if summary["total_cost"] > 0
            else 0
        )

        return summary

    def get_portfolio_performance(
        self, user_id: int, period: str = "1Y"
    ) -> dict[str, Any]:
        """Get portfolio performance over time."""
        # Convert period to date range
        end_date = datetime.now()
        if period == "1D":
            start_date = end_date - timedelta(days=1)
        elif period == "1W":
            start_date = end_date - timedelta(weeks=1)
        elif period == "1M":
            start_date = end_date - timedelta(days=30)
        elif period == "3M":
            start_date = end_date - timedelta(days=90)
        elif period == "6M":
            start_date = end_date - timedelta(days=180)
        elif period == "1Y":
            start_date = end_date - timedelta(days=365)
        elif period == "3Y":
            start_date = end_date - timedelta(days=1095)
        elif period == "5Y":
            start_date = end_date - timedelta(days=1825)
        else:  # ALL
            start_date = datetime.min

        query = """--sql
        SELECT
            t.date,
            i.quantity,
            i.unit_price,
            i.total_paid,
            a.symbol
        FROM transactions t
        JOIN investment_details i ON t.id = i.transaction_id
        JOIN assets a ON i.asset_id = a.id
        WHERE t.user_id = ?
        AND t.date BETWEEN ? AND ?
        AND t.is_investment = TRUE
        ORDER BY t.date
        """

        transactions = self.db_manager.execute_select(
            query=query, params=[user_id, start_date.isoformat(), end_date.isoformat()]
        )

        # Calculate daily portfolio values
        daily_values = {}
        portfolio = defaultdict(float)  # symbol -> quantity

        for tx in transactions:
            date = tx["date"].date()
            if tx["activity_type"] == "buy":
                portfolio[tx["symbol"]] += tx["quantity"]
            else:
                portfolio[tx["symbol"]] -= tx["quantity"]

            # Calculate portfolio value for this day
            value = sum(
                qty * self._get_price_at_date(symbol, date)
                for symbol, qty in portfolio.items()
            )
            daily_values[date] = value

        # Prepare response
        if not daily_values:
            return {
                "period": period,
                "start_value": 0,
                "end_value": 0,
                "total_return": 0,
                "total_return_percentage": 0,
                "data_points": [],
            }

        dates = sorted(daily_values.keys())
        start_value = daily_values[dates[0]]
        end_value = daily_values[dates[-1]]
        total_return = end_value - start_value
        total_return_percentage = (
            (total_return / start_value * 100) if start_value > 0 else 0
        )

        return {
            "period": period,
            "start_value": start_value,
            "end_value": end_value,
            "total_return": total_return,
            "total_return_percentage": total_return_percentage,
            "data_points": [
                {"date": date.isoformat(), "value": value}
                for date, value in daily_values.items()
            ],
        }

    def _get_price_at_date(self, symbol: str, date: datetime_date) -> float:
        """Get the price of an asset at a specific date."""
        query = """--sql
        SELECT unit_price
        FROM investment_details i
        JOIN transactions t ON i.transaction_id = t.id
        JOIN assets a ON i.asset_id = a.id
        WHERE a.symbol = ?
        AND DATE(t.date) <= ?
        AND t.is_investment = TRUE
        ORDER BY t.date DESC
        LIMIT 1
        """
        result = self.db_manager.execute_select_single(
            query=query, params=[symbol, date.isoformat()]
        )
        return result["unit_price"] if result else 0.0
