import logging
import math
import statistics
from datetime import datetime, timedelta
from typing import Any

import pandas as pd
import yfinance as yf
from pandas import DataFrame

from app.database import DatabaseManager
from app.exceptions import NoResultFoundError, QueryExecutionError
from app.models import InvestmentTransaction
from app.schemas.schema_registry import InvestmentTransactionSchema
from app.services.base_service import BaseService, ListQueryParams
from app.services.transaction_service import TransactionService

logger = logging.getLogger(__name__)


class InvestmentService(BaseService[InvestmentTransaction]):
    def __init__(self):
        super().__init__(
            table_name="investment_details", model_class=InvestmentTransaction
        )
        self.db_manager = DatabaseManager()
        self.schema = InvestmentTransactionSchema()

    def _get_latest_transaction_price(self, asset_id: int) -> float | None:
        """Get the latest transaction price for an asset from our database."""
        query = """--sql
        SELECT i.unit_price
        FROM investment_details i
        JOIN transactions t ON i.transaction_id = t.id
        WHERE i.asset_id = ?
        ORDER BY t.date DESC
        LIMIT 1
        """
        try:
            result = self.db_manager.execute_select(query, [asset_id])
            if result:
                return float(result[0]["unit_price"])
            return None
        except Exception as e:
            logger.error(
                f"Error fetching latest transaction price for asset {asset_id}: {e}"
            )
            return None

    def _fetch_yahoo_price(self, symbol: str) -> float | None:
        """Fetch current price from Yahoo Finance."""
        if symbol == "EDF.PA":
            return 11.989
        try:
            ticker = yf.Ticker(symbol)
            price = None

            # Try fast_info first (faster and more reliable)
            try:
                if hasattr(ticker, "fast_info"):
                    price = ticker.fast_info.get("last_price")
                    if price and float(price) > 0:
                        return float(price)
            except Exception as e:
                logger.warning(f"Error getting fast_info price for {symbol}: {e}")

            # Fallback to history
            try:
                hist = ticker.history(period="1mo")
                if not hist.empty and "Close" in hist.columns:
                    last_price = hist["Close"].iloc[-1]
                    if last_price > 0:
                        return float(last_price)
            except Exception as e:
                logger.warning(f"Error getting historical price for {symbol}: {e}")

            # If we get here, Yahoo data is not available
            # Get the asset_id for this symbol
            query = "SELECT id FROM assets WHERE symbol = ?"
            result = self.db_manager.execute_select(query, [symbol])
            if result:
                asset_id = result[0]["id"]
                # Try to get the latest transaction price
                latest_price = self._get_latest_transaction_price(asset_id)
                if latest_price:
                    logger.warning(
                        f"Using latest transaction price for {symbol} as Yahoo data unavailable"
                    )
                    return latest_price

            logger.error(
                f"No price data available for {symbol} (Yahoo or transaction history)"
            )
            return None
        except Exception as e:
            logger.error(f"Error fetching price for {symbol}: {e!s}")
            return None

    def _fetch_yahoo_history(
        self, symbol: str, start_date: datetime, end_date: datetime
    ) -> dict[str, float]:
        """Fetch historical prices from Yahoo Finance."""
        if symbol == "EDF.PA":
            return {
                "2022-07-12": 8.22,
                "2022-07-25": 11.989,
            }
        try:
            ticker = yf.Ticker(symbol)
            history: DataFrame = ticker.history(start=start_date, end=end_date)
            if history.empty:
                return {}

            return {
                index.strftime("%Y-%m-%d"): float(price)
                for index, price in history["Close"].items()
                if not pd.isna(price) and price > 0
            }
        except Exception as e:
            logger.error(
                f"Error fetching historical prices for {symbol} from Yahoo Finance: {e}"
            )
            return {}

    def _get_etf_sector_weights(self, ticker: yf.Ticker) -> dict[str, float]:
        """Get ETF sector weights with proper error handling."""
        try:
            if not hasattr(ticker, "info"):
                return {}

            info = ticker.info
            if not isinstance(info, dict):
                return {}

            # Check if it's an ETF
            quote_type = info.get("quoteType", "").lower()
            if quote_type not in ["etf", "mutualfund"]:
                return {}

            # Try different ways to get sector weights
            sector_weights = {}

            # Method 1: Try holdings attribute (may not exist)
            try:
                if hasattr(ticker, "holdings"):
                    holdings = ticker.holdings
                    if isinstance(holdings, dict) and "sectorWeights" in holdings:
                        return holdings["sectorWeights"]
            except Exception as e:
                logger.debug(f"Could not get holdings for ETF: {e}")

            # Method 2: Try fund sector weightings
            try:
                weightings = info.get("fundSectorWeightings", {})
                if isinstance(weightings, dict):
                    return {
                        k.replace("_", " ").title(): float(v)
                        for k, v in weightings.items()
                    }
            except Exception as e:
                logger.debug(f"Could not get fund sector weightings: {e}")

            return {}

        except Exception as e:
            logger.error(f"Error getting ETF sector weights: {e}")
            return {}

    def get_all(
        self,
        user_id: int,
        query_params: ListQueryParams,
    ) -> dict[str, Any]:
        """Override get_all to handle sorting by date using transactions table."""
        try:
            # Determine which fields to select
            requested_fields = query_params.fields or []
            transaction_fields = {
                "date",
                "date_accountability",
                "description",
                "from_account_id",
                "to_account_id",
            }
            investment_fields = {
                "asset_id",
                "quantity",
                "unit_price",
                "fee",
                "tax",
                "total_paid",
                "transaction_id",
            }

            # If no fields specified, select all fields
            if not requested_fields:
                select_fields = [
                    "i.*",
                    "t.date",
                    "t.date_accountability",
                    "t.description",
                    "t.from_account_id",
                    "t.to_account_id",
                ]
            else:
                select_fields = []
                for field in requested_fields:
                    if field in transaction_fields:
                        select_fields.append(f"t.{field}")
                    elif field in investment_fields:
                        select_fields.append(f"i.{field}")

            # Build count query
            count_query = """--sql
                SELECT COUNT(*) as total
                FROM investment_details i
                JOIN transactions t ON i.transaction_id = t.id
                WHERE t.user_id = ? AND t.is_investment = TRUE
            """
            count_params: list[Any] = [user_id]

            # Get filters from query_params.filters
            filters = query_params.filters or {}

            # Debug log
            logger.info(f"Filters received: {filters}")

            # Add filter conditions to count query
            for key, value in filters.items():
                if value is not None and key != "user_id":
                    if key in transaction_fields:
                        count_query += f" AND t.{key} = ?"
                    elif key in investment_fields:
                        count_query += f" AND i.{key} = ?"
                    count_params.append(value)

            # Add search conditions to count query
            if query_params.search:
                search_value = f"%{query_params.search}%"
                count_query += """ AND (
                    t.description LIKE ? OR
                    CAST(i.quantity AS TEXT) LIKE ? OR
                    CAST(i.unit_price AS TEXT) LIKE ?
                )"""
                count_params.extend([search_value for _ in range(3)])

            # Debug log
            logger.info(f"Count query: {count_query}")
            logger.info(f"Count params: {count_params}")

            # Execute count query first
            total_count = self.db_manager.execute_select(count_query, count_params)[0][
                "total"
            ]

            # Debug log
            logger.info(f"Total count: {total_count}")

            # If total count is 0, return empty result
            if total_count == 0:
                return {
                    "items": [],
                    "total": 0,
                    "page": query_params.page,
                    "per_page": query_params.per_page,
                }

            # Build main query
            query = f"""
                SELECT {", ".join(select_fields)}
                FROM investment_details i
                JOIN transactions t ON i.transaction_id = t.id
                WHERE t.user_id = ? AND t.is_investment = TRUE
            """
            params: list[Any] = [user_id]

            # Add filter conditions
            for key, value in filters.items():
                if value is not None and key != "user_id":
                    if key in transaction_fields:
                        query += f" AND t.{key} = ?"
                    elif key in investment_fields:
                        query += f" AND i.{key} = ?"
                    params.append(value)

            # Add search conditions
            if query_params.search:
                search_value = f"%{query_params.search}%"
                query += """ AND (
                    t.description LIKE ? OR
                    CAST(i.quantity AS TEXT) LIKE ? OR
                    CAST(i.unit_price AS TEXT) LIKE ?
                )"""
                params.extend([search_value for _ in range(3)])

            # Add sorting
            if query_params.sort_by:
                sort_order = query_params.sort_order or "ASC"
                if query_params.sort_by in transaction_fields:
                    query += f" ORDER BY t.{query_params.sort_by} {sort_order}"
                else:
                    query += f" ORDER BY i.{query_params.sort_by} {sort_order}"

            # Add pagination
            query += " LIMIT ? OFFSET ?"
            params.extend(
                [query_params.per_page, (query_params.page - 1) * query_params.per_page]
            )

            # Debug log
            logger.info(f"Main query: {query}")
            logger.info(f"Main params: {params}")

            try:
                # Execute main query
                items = self.db_manager.execute_select(query, params)

                # Debug log
                logger.info(f"Items found: {len(items)}")

                return {
                    "items": items,
                    "total": total_count,
                    "page": query_params.page,
                    "per_page": query_params.per_page,
                }
            except Exception as e:
                logger.error(f"Error executing main query: {e}")
                # If no results found, return empty result instead of error
                if "No result found" in str(e):
                    return {
                        "items": [],
                        "total": 0,
                        "page": query_params.page,
                        "per_page": query_params.per_page,
                    }
                raise

        except Exception as e:
            logger.error(f"Error in get_all: {e}")
            raise QueryExecutionError(
                f"Database error: {e!s}",
                query=locals().get("query", "Query not built"),
                params=locals().get("params", []),
            )

    def batch_delete(self, user_id: int, item_ids: list[int]) -> dict[str, Any]:
        return TransactionService().batch_delete(user_id, item_ids)

    def batch_update(self, user_id: int, items: list[dict[str, Any]]) -> dict[str, Any]:
        return NotImplementedError

    def batch_create(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        """Create multiple investment transactions in a batch operation.

        Args:
            items: List of dictionaries containing investment transaction data

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

        successful = []
        failed = []

        for item in items:
            try:
                # Create each investment transaction using the existing create method
                result = self.create(item)
                successful.append(result)
            except Exception as e:
                failed.append({"data": item, "error": str(e)})

        return {
            "successful": successful,
            "failed": failed,
            "total_successful": len(successful),
            "total_failed": len(failed),
        }

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create investment transaction and associated details."""
        # Validate data using schema

        validated_data = self.schema.load(data)

        connection = None
        try:
            # Start transaction
            connection = self.db_manager.connect_to_database()
            connection.execute("BEGIN TRANSACTION")

            # Get asset symbol
            query = "SELECT symbol FROM assets WHERE id = ?"
            result = self.db_manager.execute_select(query, [validated_data["asset_id"]])
            if not result:
                raise ValueError(
                    f"Asset with ID {validated_data['asset_id']} not found"
                )
            asset_symbol = result[0]["symbol"]

            # Get the investment account ID (to_account_id for buys, from_account_id for sells)
            investment_account_id = (
                validated_data["to_account_id"]
                if validated_data["activity_type"] == "Buy"
                else validated_data["from_account_id"]
            )

            # Initialize to avoid reference before assignment

            try:
                pl_account_query = """--sql
                SELECT id FROM accounts
                WHERE user_id = ? AND name = 'Investment P/L' AND type = 'expense'
                """
                pl_account_expense_result = self.db_manager.execute_select(
                    pl_account_query, [validated_data["user_id"]]
                )
                pl_account_expense_id = pl_account_expense_result[0]["id"]

                pl_account_query = """--sql
                SELECT id FROM accounts
                WHERE user_id = ? AND name = 'Investment P/L' AND type = 'income'
                """
                pl_account_income_result = self.db_manager.execute_select(
                    pl_account_query, [validated_data["user_id"]]
                )
                pl_account_income_id = pl_account_income_result[0]["id"]
            except NoResultFoundError:
                # Create Investment P/L account if it doesn't exist
                # First, get a bank ID for the user
                bank_query = "SELECT id FROM banks WHERE user_id = ? LIMIT 1"
                bank_result = self.db_manager.execute_select(
                    bank_query, [validated_data["user_id"]]
                )

                if not bank_result:
                    raise ValueError(
                        "No bank found for user. Please create a bank first."
                    )

                bank_id = bank_result[0]["id"]

                # Now create the Investment P/L account
                create_pl_expense_account_query = """--sql
                INSERT INTO accounts (user_id, name, type, bank_id)
                VALUES (?, 'Investment P/L', 'expense', ?)
                RETURNING id
                """
                pl_account_expense_result = self.db_manager.execute_insert_returning(
                    create_pl_expense_account_query,
                    [validated_data["user_id"], bank_id],
                )
                pl_account_expense_id = pl_account_expense_result["id"]

                # Create Investment P/L income account
                create_pl_income_account_query = """--sql
                INSERT INTO accounts (user_id, name, type, bank_id)
                VALUES (?, 'Investment P/L', 'income', ?)
                RETURNING id
                """
                pl_account_income_result = self.db_manager.execute_insert_returning(
                    create_pl_income_account_query, [validated_data["user_id"], bank_id]
                )
                pl_account_income_id = pl_account_income_result["id"]

            if validated_data["activity_type"] == "Buy":
                description = f"Buy {validated_data['quantity']} {asset_symbol} at {validated_data['unit_price']}€"
                amount = (
                    validated_data["quantity"] * validated_data["unit_price"]
                    + validated_data["fee"]
                    + validated_data["tax"]
                )
            elif validated_data["activity_type"] == "Sell":
                # Calculate the original cost basis for this sale
                cost_basis_query = """--sql
                SELECT SUM(i.quantity * i.unit_price + i.fee + i.tax) as total_cost,
                       SUM(i.quantity) as total_quantity
                FROM investment_details i
                JOIN transactions t ON i.transaction_id = t.id
                WHERE i.asset_id = ? AND t.user_id = ? AND i.investment_type = 'Buy'
                """
                cost_basis_result = self.db_manager.execute_select(
                    cost_basis_query,
                    [validated_data["asset_id"], validated_data["user_id"]],
                )

                if not cost_basis_result or cost_basis_result[0]["total_quantity"] == 0:
                    raise ValueError("No cost basis found for this asset")

                total_cost = float(cost_basis_result[0]["total_cost"])
                total_quantity = float(cost_basis_result[0]["total_quantity"])

                # Calculate the portion of cost basis for this sale
                sale_ratio = validated_data["quantity"] / total_quantity
                cost_basis_for_sale = total_cost * sale_ratio

                # Calculate sale proceeds
                sale_proceeds = (
                    validated_data["quantity"] * validated_data["unit_price"]
                    - validated_data["fee"]
                    - validated_data["tax"]
                )

                # Calculate profit/loss
                profit_loss = sale_proceeds - cost_basis_for_sale

                description = f"Sell {validated_data['quantity']} {asset_symbol} at {validated_data['unit_price']}€"
                amount = sale_proceeds  # This is the main transaction amount

                # Create profit/loss transaction if there is a gain or loss
                if (
                    abs(profit_loss) > 0.01
                ):  # Use small threshold to avoid floating point issues
                    if profit_loss > 0:
                        pl_description = f"Investment P/L for {asset_symbol} sale: gain"
                        from_account_id = pl_account_income_id
                        to_account_id = investment_account_id
                        type = "income"
                    else:
                        pl_description = f"Investment P/L for {asset_symbol} sale: loss"
                        from_account_id = investment_account_id
                        to_account_id = pl_account_expense_id
                        type = "expense"
                    pl_transaction_data = {
                        "user_id": validated_data["user_id"],
                        "date": validated_data["date"],
                        "date_accountability": validated_data["date"],
                        "description": pl_description,
                        "amount": abs(profit_loss),
                        "from_account_id": from_account_id,
                        "to_account_id": to_account_id,
                        "category": "Investissements",
                        "type": type,
                    }

                    # Insert P/L transaction
                    pl_columns = ", ".join(pl_transaction_data.keys())
                    pl_placeholders = ", ".join(["?" for _ in pl_transaction_data])
                    pl_query = f"INSERT INTO transactions ({pl_columns}) VALUES ({pl_placeholders}) RETURNING *"
                    pl_transaction_result = self.db_manager.execute_insert_returning(
                        pl_query, params=list(pl_transaction_data.values())
                    )
            elif validated_data["activity_type"] == "Dividend":
                description = (
                    f"Dividend {asset_symbol} -> {validated_data['unit_price']}€"
                )
                amount = validated_data["unit_price"]
            else:
                description = f"{validated_data['activity_type'].title()} {validated_data['quantity']} {asset_symbol} at {validated_data['unit_price']}€"
                amount = validated_data["quantity"] * validated_data["unit_price"]

            # Prepare transaction data
            transaction_data = {
                "user_id": validated_data["user_id"],
                "date": validated_data["date"],
                "date_accountability": validated_data["date"],
                "description": description,
                "amount": amount,
                "from_account_id": validated_data["from_account_id"],
                "to_account_id": validated_data["to_account_id"],
                "category": "Investissements",
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
                "investment_type": validated_data["activity_type"].title(),
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
            i.investment_type as activity_type
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
        account_filter = "AND aba.account_id = ?" if account_id else ""
        params = [user_id]
        if account_id:
            params.append(account_id)

        # First get all investment transactions to calculate net investment and initial investment
        investment_query = """--sql
        SELECT
            i.investment_type,
            i.total_paid,
            t.date
        FROM investment_details i
        JOIN transactions t ON i.transaction_id = t.id
        WHERE t.user_id = ?
        ORDER BY t.date ASC
        """
        try:
            investment_transactions = self.db_manager.execute_select(
                investment_query, [user_id]
            )
        except NoResultFoundError:
            return "No investment transactions found, please add some investment transactions to show your portfolio summary"

        # Calculate initial and net investment
        initial_investment = 0
        total_withdrawals = 0
        total_dividends = 0
        for tx in investment_transactions:
            if tx["investment_type"] == "Buy":
                initial_investment += tx["total_paid"]
            elif tx["investment_type"] == "Sell":
                total_withdrawals += tx["total_paid"]
            elif tx["investment_type"] == "Dividend":
                total_dividends += tx["total_paid"]

        net_investment = initial_investment - total_withdrawals

        # Get additional dividend metrics
        # Calculate current year and previous year dividend totals
        current_year = datetime.now().year
        current_year_dividends = 0
        previous_year_dividends = 0

        for tx in investment_transactions:
            if tx["investment_type"] == "Dividend":
                tx_date = datetime.strptime(tx["date"].split("T")[0], "%Y-%m-%d")
                if tx_date.year == current_year:
                    current_year_dividends += tx["total_paid"]
                elif tx_date.year == current_year - 1:
                    previous_year_dividends += tx["total_paid"]

        # Calculate year-over-year dividend growth
        dividend_growth = 0
        if previous_year_dividends > 0:
            dividend_growth = (
                (current_year_dividends - previous_year_dividends)
                / previous_year_dividends
            ) * 100

        query = f"""--sql
        SELECT
            aba.symbol,
            aba.asset_name as name,
            aba.quantity as shares,
            (SELECT AVG(i.unit_price)
             FROM investment_details i
             JOIN transactions t ON i.transaction_id = t.id
             WHERE i.asset_id = aba.asset_id
             AND t.user_id = ?
             AND t.is_investment = TRUE
             AND i.investment_type = 'Buy') as avg_buy_price
        FROM asset_balances_by_account aba
        WHERE aba.user_id = ? {account_filter}
        """

        params = [user_id, user_id]
        if account_id:
            params.append(account_id)

        holdings = self.db_manager.execute_select(query=query, params=params)

        summary = {
            "total_value": 0,
            "initial_investment": initial_investment,
            "net_investment": net_investment,
            "total_withdrawals": total_withdrawals,
            "dividend_metrics": {
                "total_dividends_received": round(total_dividends, 2),
                "current_year_dividends": round(current_year_dividends, 2),
                "previous_year_dividends": round(previous_year_dividends, 2),
                "dividend_growth": round(dividend_growth, 2),
                "monthly_income_estimate": round(
                    current_year_dividends / max(datetime.now().month, 1) * (1 / 12), 2
                ),
            },
            "total_gain_loss": 0,
            "total_gain_loss_percentage": 0,
            "assets": [],
            "last_update": datetime.now().isoformat(),
            "currency": "EUR",
            "metrics": {
                "diversification_score": 0,
                "largest_position_percentage": 0,
                "number_of_positions": len(holdings),
            },
        }

        # First pass to calculate total value for percentage calculations
        total_portfolio_value = 0
        largest_position = 0
        current_prices = {}

        # Fetch all current prices first
        for holding in holdings:
            symbol = holding["symbol"]
            current_price = self._fetch_yahoo_price(symbol)
            current_prices[symbol] = (
                current_price
                if current_price is not None
                else (holding["avg_buy_price"] or 0)
            )
            position_value = holding["shares"] * current_prices[symbol]
            total_portfolio_value += position_value
            largest_position = max(largest_position, position_value)

        # Calculate dividend yield
        dividend_yield = 0
        if total_portfolio_value > 0:
            # Use 12-month trailing dividend data if available, else use current year data
            if previous_year_dividends > 0:
                # Weighted average of current and previous year for a 12-month trailing amount
                month_weight = datetime.now().month / 12
                trailing_12m_dividends = (current_year_dividends * month_weight) + (
                    previous_year_dividends * (1 - month_weight)
                )
                dividend_yield = (trailing_12m_dividends / total_portfolio_value) * 100
            else:
                # If no previous year data, annualize current year
                annualized_dividends = (
                    current_year_dividends / max(datetime.now().month, 1)
                ) * 12
                dividend_yield = (annualized_dividends / total_portfolio_value) * 100

        summary["dividend_metrics"]["portfolio_yield"] = round(dividend_yield, 2)

        # Calculate Herfindahl-Hirschman Index (HHI) for diversification
        position_weights = []

        for holding in holdings:
            symbol = holding["symbol"]
            current_price = current_prices[symbol]  # Use cached price
            shares = holding["shares"]
            avg_buy_price = holding["avg_buy_price"] or 0

            # Fetch company name from Yahoo Finance
            try:
                ticker = yf.Ticker(symbol)
                company_name = (
                    ticker.info.get("longName")
                    or ticker.info.get("shortName")
                    or symbol
                )

            except Exception as e:
                logger.error(f"Error fetching name for {symbol}: {e}")
                company_name = holding["name"]  # Fallback to stored name

            # Calculate current value using current price
            current_value = shares * current_price
            # Calculate cost basis using average buy price
            cost_basis = shares * avg_buy_price
            # Calculate gain/loss
            gain_loss = current_value - cost_basis
            gain_loss_percentage = (
                (gain_loss / cost_basis * 100) if cost_basis > 0 else 0
            )
            portfolio_percentage = (
                (current_value / total_portfolio_value * 100)
                if total_portfolio_value > 0
                else 0
            )

            position_weights.append(portfolio_percentage / 100)

            asset = {
                "symbol": holding["symbol"],
                "name": company_name,
                "shares": round(shares, 2),
                "avg_buy_price": round(avg_buy_price, 4),
                "current_price": round(current_price, 4),
                "current_value": round(current_value, 2),
                "cost_basis": round(cost_basis, 2),
                "gain_loss": round(gain_loss, 2),
                "gain_loss_percentage": round(gain_loss_percentage, 2),
                "portfolio_percentage": round(portfolio_percentage, 2),
            }

            summary["assets"].append(asset)
            summary["total_value"] += current_value

        # Calculate total gain/loss and percentage using net investment
        summary["total_gain_loss"] = round(
            summary["total_value"] + total_dividends - summary["net_investment"], 2
        )
        if summary["net_investment"] > 0:
            summary["total_gain_loss_percentage"] = round(
                (summary["total_value"] + total_dividends - summary["net_investment"])
                / summary["net_investment"]
                * 100,
                2,
            )
        else:
            summary["total_gain_loss_percentage"] = 0

        # Add a flag indicating that dividends are included in returns
        summary["returns_include_dividends"] = True

        # Calculate diversification metrics
        if position_weights:
            hhi = sum(w * w for w in position_weights)
            summary["metrics"]["diversification_score"] = round((1 - hhi) * 100, 2)
            summary["metrics"]["largest_position_percentage"] = round(
                (largest_position / total_portfolio_value * 100)
                if total_portfolio_value > 0
                else 0,
                2,
            )

        # Round total values
        summary["total_value"] = round(summary["total_value"], 2)
        summary["initial_investment"] = round(summary["initial_investment"], 2)
        summary["net_investment"] = round(summary["net_investment"], 2)
        summary["total_withdrawals"] = round(summary["total_withdrawals"], 2)

        # Sort assets by portfolio percentage (descending)
        summary["assets"].sort(key=lambda x: x["portfolio_percentage"], reverse=True)

        return summary

    def get_portfolio_performance(
        self,
        user_id: int,
    ) -> dict[str, Any]:
        """Get portfolio performance over time, optimized for speed."""
        query = """--sql
        SELECT
            t.date,
            i.quantity,
            i.unit_price,
            a.symbol,
            i.investment_type,
            i.fee,
            i.tax,
            i.total_paid  -- Ensure total_paid is fetched
        FROM transactions t
        JOIN investment_details i ON t.id = i.transaction_id
        JOIN assets a ON i.asset_id = a.id
        WHERE t.user_id = ?
        AND t.is_investment = TRUE
        ORDER BY t.date ASC -- Crucial: ensure transactions are sorted by date
        """

        try:
            transactions = self.db_manager.execute_select(
                query=query,
                params=[user_id],
            )
        except NoResultFoundError:
            return {"data_points": [], "summary": {}}  # Return empty if no transactions

        if not transactions:
            return {"data_points": [], "summary": {}}

        # Determine date range
        start_date = datetime.strptime(
            transactions[0]["date"].split("T")[0], "%Y-%m-%d"
        ).date()
        end_date = datetime.now().date()
        all_dates = [
            start_date + timedelta(days=i)
            for i in range((end_date - start_date).days + 1)
        ]

        # Pre-fetch historical prices for all unique symbols
        unique_symbols = {tx["symbol"] for tx in transactions}
        historical_prices: dict[str, dict[str, float]] = {}
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())

        for symbol in unique_symbols:
            # Fetch history first
            symbol_prices = self._fetch_yahoo_history(
                symbol, start_datetime, end_datetime
            )
            historical_prices[symbol] = symbol_prices

            # If history is sparse, fill gaps using transaction prices
            tx_prices = {}
            last_known_price = None
            for tx in transactions:
                if tx["symbol"] == symbol:
                    tx_date_str = tx["date"].split("T")[0]
                    # Use unit price only if not already in history (prefer market close)
                    if tx_date_str not in historical_prices[symbol]:
                        tx_prices[tx_date_str] = tx["unit_price"]
                    last_known_price = tx[
                        "unit_price"
                    ]  # Keep track of the very last tx price

            # Merge transaction prices into history, giving precedence to history
            historical_prices[symbol].update(tx_prices)

            # Store the last known transaction price as a fallback
            if symbol not in historical_prices or not historical_prices[symbol]:
                # If absolutely no price data, try latest db price or default to 0
                latest_db_price = self._get_latest_transaction_price_symbol(symbol)
                if latest_db_price:
                    historical_prices[symbol] = {"fallback_latest": latest_db_price}
                elif last_known_price:
                    historical_prices[symbol] = {"fallback_latest": last_known_price}
                else:
                    logger.warning(
                        f"Could not find any price for {symbol}, defaulting to 0"
                    )
                    historical_prices[symbol] = {"fallback_latest": 0}

        # --- Step 1: Process transactions chronologically ---
        owned_assets: dict[str, float] = {}
        initial_investment = 0.0
        total_withdrawals = 0.0
        total_dividends_received = 0.0  # Initialize dividend tracking
        # Store state *after* transaction on that date
        portfolio_states: dict[str, dict[str, Any]] = {}

        for tx in transactions:
            tx_date_str = tx["date"].split("T")[0]
            symbol = tx["symbol"]
            quantity = tx["quantity"]
            investment_type = tx["investment_type"].lower()
            total_paid = tx["total_paid"]  # Use total_paid from transaction
            unit_price = tx["unit_price"]  # Needed for sell proceeds calculation
            fee = tx.get("fee", 0) or 0  # Handle None from DB
            tax = tx.get("tax", 0) or 0  # Handle None from DB

            # Initialize asset if not exists
            if symbol not in owned_assets:
                owned_assets[symbol] = 0.0

            # Update holdings and investment/withdrawal tracking
            if investment_type == "buy":
                owned_assets[symbol] += quantity
                initial_investment += total_paid  # Use total_paid for cost
            elif investment_type == "sell":
                # Calculate proceeds based on sell price * quantity minus fees/taxes
                proceeds = (quantity * unit_price) - fee - tax
                owned_assets[symbol] -= quantity
                total_withdrawals += proceeds  # Track money received from sell
            elif investment_type == "dividend":
                # Accumulate total dividends received using total_paid
                total_dividends_received += total_paid
            # Other types (like 'split', 'fee', 'tax') might exist but don't directly affect holdings or net investment here

            # Remove asset if quantity drops to 0 or below
            if (
                symbol in owned_assets and owned_assets[symbol] <= 1e-9
            ):  # Use tolerance for float comparison
                del owned_assets[symbol]

            # Store a copy of the state for this date
            portfolio_states[tx_date_str] = {
                "holdings": owned_assets.copy(),
                "net_invested": initial_investment - total_withdrawals,
                "cumulative_dividends": total_dividends_received,  # Store cumulative dividends
            }

        # --- Step 2: Calculate daily portfolio values ---
        data_points = []
        # Initialize with state before first transaction (empty holdings, zero investment/dividends)
        last_known_state = {
            "holdings": {},
            "net_invested": 0.0,
            "cumulative_dividends": 0.0,
        }
        # Get sorted list of dates where state changed
        state_change_dates = sorted(portfolio_states.keys())
        state_idx = 0

        for date in all_dates:
            date_str = date.strftime("%Y-%m-%d")

            # Update to the latest known state on or before the current date
            while (
                state_idx < len(state_change_dates)
                and state_change_dates[state_idx] <= date_str
            ):
                last_known_state = portfolio_states[state_change_dates[state_idx]]
                state_idx += 1

            current_holdings = last_known_state["holdings"]
            current_net_invested = last_known_state["net_invested"]
            current_cumulative_dividends = last_known_state["cumulative_dividends"]

            # Calculate portfolio value for this date
            total_value = 0.0
            assets_data = {}

            if not current_holdings:  # Skip calculation if no holdings
                if data_points:  # Carry forward previous day's zero value if needed
                    data_points.append(
                        {
                            "date": date_str,
                            "total_value": 0.0,
                            "performance": 0.0,
                            "performance_without_dividends": 0.0,
                            "absolute_gain": 0.0,
                            "assets": {},
                            "tri": 0.0,
                            "cumulative_dividends": round(
                                current_cumulative_dividends, 2
                            ),
                            "net_invested": round(current_net_invested, 2),
                            "total_gains": round(
                                -current_net_invested, 2
                            ),  # Loss equals net invested if value is 0
                            "total_gains_without_dividends": round(
                                current_net_invested, 2
                            ),
                        }
                    )
                continue  # Move to next date

            for symbol, shares in current_holdings.items():
                if (
                    shares <= 1e-9
                ):  # Should not happen due to earlier check, but good practice
                    continue

                price = None
                symbol_price_history = historical_prices.get(symbol, {})

                # 1. Try exact date match
                if date_str in symbol_price_history:
                    price = symbol_price_history[date_str]
                else:
                    # 2. Find the closest *previous* date with a price
                    closest_date_str = None
                    for price_date_str in symbol_price_history:
                        # Skip fallback keys if they exist
                        if price_date_str == "fallback_latest":
                            continue
                        # Check if the price date is on or before the current processing date
                        if price_date_str <= date_str:
                            # If it's the first valid date found, or later than the current closest
                            if (
                                closest_date_str is None
                                or price_date_str > closest_date_str
                            ):
                                closest_date_str = price_date_str

                    if closest_date_str:
                        price = symbol_price_history[closest_date_str]

                # 3. If still no price, use the fallback latest price if available
                if price is None and "fallback_latest" in symbol_price_history:
                    price = symbol_price_history["fallback_latest"]

                # If price is still None or zero after all checks, log and skip/use 0
                if price is None or price <= 0:
                    if price is None:
                        logger.warning(
                            f"No price found for {symbol} on or before {date_str}. Using 0."
                        )
                    price = 0.0  # Default to 0 if no price could be determined

                asset_value = shares * price
                total_value += asset_value
                assets_data[symbol] = {
                    "shares": round(shares, 4),  # Increase precision for shares
                    "price": round(price, 4),
                    "total_value": round(asset_value, 2),
                }

            # Calculate performance metrics
            total_gains = (
                total_value + current_cumulative_dividends - current_net_invested
            )

            # Calculate standard performance (without dividends)
            performance_without_dividends = 0.0
            if abs(current_net_invested) > 1e-9:  # Avoid division by zero
                performance_without_dividends = (
                    (total_value - current_net_invested) / current_net_invested * 100
                )

            # Calculate performance including dividends
            performance = 0.0
            if abs(current_net_invested) > 1e-9:  # Avoid division by zero
                performance = (
                    (total_value + current_cumulative_dividends - current_net_invested)
                    / current_net_invested
                    * 100
                )

            tri_value = 0.0
            if abs(current_net_invested) > 1e-9:  # Avoid division by zero
                # TRI calculation: (Ending Value / Beginning Value) * 100
                # Here, 'Beginning Value' is represented by net_invested, and we include dividends in 'Ending Value'
                # A TRI of 100 means value equals net investment.
                tri_value = (
                    (
                        (total_value + current_cumulative_dividends)
                        / current_net_invested
                    )
                    * 100
                    if current_net_invested > 0
                    else 0
                )  # Handle cases where net investment could be negative due to large withdrawals

            # Append data point only if there's value or it's the first day
            # Avoid adding points with zero value unless net_invested is non-zero (represents loss)
            # Or if it's the very first day after the first transaction
            is_first_day_after_tx = (
                date_str >= state_change_dates[0] if state_change_dates else False
            )
            if (
                total_value > 1e-9
                or abs(current_net_invested) > 1e-9
                or (not data_points and is_first_day_after_tx)
            ):
                data_points.append(
                    {
                        "date": date_str,
                        "total_value": round(total_value, 2),
                        "performance": round(performance, 2),
                        "performance_without_dividends": round(
                            performance_without_dividends, 2
                        ),
                        "absolute_gain": round(total_gains, 2),
                        "assets": assets_data,
                        "tri": round(tri_value, 2),
                        "cumulative_dividends": round(current_cumulative_dividends, 2),
                        "net_invested": round(current_net_invested, 2),
                        "total_gains": round(total_gains, 2),
                        "total_gains_without_dividends": round(
                            total_value - current_net_invested, 2
                        ),
                    }
                )

        return {
            "data_points": data_points,
        }

    def _get_latest_transaction_price_symbol(self, symbol: str) -> float | None:
        """Helper to get latest transaction price just by symbol"""
        query = """--sql
        SELECT i.unit_price
        FROM investment_details i
        JOIN transactions t ON i.transaction_id = t.id
        JOIN assets a ON i.asset_id = a.id
        WHERE a.symbol = ?
        ORDER BY t.date DESC
        LIMIT 1
        """
        try:
            result = self.db_manager.execute_select(query, [symbol])
            if result:
                return float(result[0]["unit_price"])
            return None
        except Exception as e:
            logger.error(
                f"Error fetching latest transaction price for symbol {symbol}: {e}"
            )
            return None

    def delete(self, item_id: int, user_id: int) -> bool:
        # Use cascade delete from TransactionService
        return TransactionService().delete(item_id, user_id)

    def get_risk_metrics(self, user_id: int) -> dict[str, Any]:
        """Calculate portfolio risk metrics."""
        # Get daily returns from portfolio performance
        # TODO(Alan): Rework the whole calculation as they are not correct
        performance_data = self.get_portfolio_performance(user_id)
        data_points = performance_data["data_points"]

        if not data_points:
            return {
                "volatility": 0,
                "sharpe_ratio": 0,
                "max_drawdown": 0,
                "beta": 0,
                "alpha": 0,
                "dividend_metrics": {
                    "dividend_yield": 0,
                    "dividend_stability": 0,
                    "payout_ratio": 0,
                    "dividend_growth": 0,
                },
            }

        # Get dividend analysis
        dividend_data = self.get_dividend_analysis(user_id)

        # Calculate dividend stability and growth
        dividend_stability = 0
        dividend_growth = 0

        if dividend_data.get("dividend_assets"):
            # Calculate stability across all assets
            all_dividends = []
            current_year_total = 0
            prev_year_total = 0
            current_year = datetime.now().year
            prev_year = current_year - 1

            for asset in dividend_data["dividend_assets"]:
                # Get historical dividends
                for div in asset.get("dividend_history", []):
                    amount = div["amount"]
                    all_dividends.append(amount)

                    # Track yearly totals for growth calculation
                    div_date = datetime.strptime(div["date"], "%Y-%m-%d")
                    if div_date.year == current_year:
                        current_year_total += amount
                    elif div_date.year == prev_year:
                        prev_year_total += amount

            # Calculate stability using coefficient of variation
            if all_dividends:
                try:
                    mean_dividend = statistics.mean(all_dividends)
                    if mean_dividend > 0 and len(all_dividends) > 1:
                        dividend_stability = 100 - (
                            statistics.stdev(all_dividends) / mean_dividend * 100
                        )
                except statistics.StatisticsError:
                    dividend_stability = 0

            # Calculate year-over-year growth with proper handling of edge cases
            if prev_year_total > 0:
                dividend_growth = (
                    (current_year_total - prev_year_total) / prev_year_total * 100
                )
            elif current_year_total > 0:
                # If there were no dividends last year but there are this year,
                # this represents new dividend income (positive growth)
                dividend_growth = 100
            else:
                # If both years have no dividends, growth is 0
                dividend_growth = 0

        # Extract dates and calculate daily returns with improved validation
        dates = []
        daily_returns = []
        for i in range(1, len(data_points)):
            prev_value = data_points[i - 1]["total_value"]
            curr_value = data_points[i]["total_value"]

            # Only calculate returns if we have valid values
            if prev_value > 0 and curr_value >= 0:
                daily_return = (curr_value - prev_value) / prev_value
                # Filter out extreme values (-50% to 50% daily change)
                if abs(daily_return) <= 0.5:
                    daily_returns.append(daily_return)
                    dates.append(data_points[i]["date"])
                else:
                    logger.warning(
                        f"Filtered out extreme daily return of {daily_return * 100:.2f}% between {data_points[i - 1]['date']} and {data_points[i]['date']}"
                    )

        if not daily_returns:
            return {
                "volatility": 0,
                "sharpe_ratio": 0,
                "max_drawdown": 0,
                "beta": 0,
                "alpha": 0,
                "dividend_metrics": {
                    "dividend_yield": dividend_data["total_dividend_yield"],
                    "dividend_stability": dividend_stability,
                    "payout_ratio": 0,
                    "dividend_growth": dividend_growth,
                },
            }

        try:
            # Calculate volatility (annualized)
            daily_volatility = statistics.stdev(daily_returns)
            # Convert daily to annual volatility, but don't multiply by 100 yet
            annualized_volatility = daily_volatility * math.sqrt(252)
            # Convert to percentage and cap at a reasonable level (50%)
            volatility = min(annualized_volatility * 100, 50)

            # Calculate Sharpe Ratio (assuming 3% risk-free rate)
            risk_free_rate = 0.03
            avg_daily_return = statistics.mean(daily_returns)
            # Properly annualize the return
            logger.info(f"{avg_daily_return=}")
            annualized_return = ((1 + avg_daily_return) ** 252) - 1

            # Calculate Sharpe ratio with proper scaling
            if annualized_volatility > 0:
                sharpe_ratio = (
                    annualized_return - risk_free_rate
                ) / annualized_volatility
                # Cap Sharpe ratio at reasonable bounds
                sharpe_ratio = max(min(sharpe_ratio, 5), -5)
            else:
                sharpe_ratio = 0

            # Calculate Maximum Drawdown
            peak = data_points[0]["total_value"]
            max_drawdown = 0
            for point in data_points[1:]:
                if point["total_value"] > peak:
                    peak = point["total_value"]
                elif peak > 0:
                    drawdown = (peak - point["total_value"]) / peak
                    max_drawdown = max(max_drawdown, drawdown)

            # Convert max_drawdown to percentage
            max_drawdown = max_drawdown * 100

            # Calculate payout ratio with proper error handling
            total_earnings = annualized_return * data_points[-1]["total_value"]
            if total_earnings > 0:
                payout_ratio = min(
                    (dividend_data["annual_dividend_income"] / total_earnings * 100),
                    100,
                )
            else:
                payout_ratio = 0

            return {
                "volatility": round(volatility, 2),
                "sharpe_ratio": round(sharpe_ratio, 2),
                "max_drawdown": round(max_drawdown, 2),
                "risk_metrics_by_asset": self._get_risk_metrics_by_asset(data_points),
                "rolling_metrics": self._get_rolling_risk_metrics(
                    daily_returns, dates=dates
                ),
                "dividend_metrics": {
                    "dividend_yield": round(dividend_data["total_dividend_yield"], 2),
                    "dividend_stability": round(dividend_stability, 2),
                    "payout_ratio": round(payout_ratio, 2),
                    "dividend_growth": round(dividend_growth, 2),
                },
            }
        except (statistics.StatisticsError, ValueError, ZeroDivisionError):
            # Return safe default values if calculations fail
            return {
                "volatility": 0,
                "sharpe_ratio": 0,
                "max_drawdown": 0,
                "risk_metrics_by_asset": {},
                "rolling_metrics": [],
                "dividend_metrics": {
                    "dividend_yield": round(dividend_data["total_dividend_yield"], 2),
                    "dividend_stability": 0,
                    "payout_ratio": 0,
                    "dividend_growth": 0,
                },
            }

    def _get_risk_metrics_by_asset(
        self, data_points: list[dict[str, Any]]
    ) -> dict[str, dict[str, float]]:
        """Calculate risk metrics for individual assets."""
        asset_metrics = {}
        total_portfolio_value = 0

        # First pass: Initialize metrics and get latest portfolio value
        for point in data_points[-1:]:  # Only look at the most recent point
            total_portfolio_value = point["total_value"]
            for symbol, data in point["assets"].items():
                asset_metrics[symbol] = {
                    "returns": [],
                    "max_value": data["total_value"],
                    "min_value": data["total_value"],
                    "current_value": data["total_value"],
                }

        # Second pass: Calculate returns and track max/min values
        for i in range(1, len(data_points)):
            prev_point = data_points[i - 1]
            curr_point = data_points[i]

            for symbol in asset_metrics:
                prev_value = prev_point["assets"].get(symbol, {}).get("total_value", 0)
                curr_value = curr_point["assets"].get(symbol, {}).get("total_value", 0)

                if prev_value > 0:
                    daily_return = (curr_value - prev_value) / prev_value
                    asset_metrics[symbol]["returns"].append(daily_return)

                if curr_value > 0:
                    asset_metrics[symbol]["max_value"] = max(
                        asset_metrics[symbol]["max_value"], curr_value
                    )
                    asset_metrics[symbol]["min_value"] = min(
                        asset_metrics[symbol]["min_value"], curr_value
                    )

        # Calculate metrics for each asset
        result = {}
        total_risk_contribution = 0

        # First calculate individual volatilities
        for symbol, metrics in asset_metrics.items():
            if metrics["returns"]:
                # Calculate annualized volatility properly
                daily_volatility = statistics.stdev(metrics["returns"])
                annualized_volatility = daily_volatility * math.sqrt(252)

                weight = (
                    metrics["current_value"] / total_portfolio_value
                    if total_portfolio_value > 0
                    else 0
                )

                # Calculate max drawdown with proper error handling
                max_value = metrics["max_value"]
                min_value = metrics["min_value"]
                max_drawdown = (
                    ((max_value - min_value) / max_value * 100) if max_value > 0 else 0
                )

                result[symbol] = {
                    "max_drawdown": round(max_drawdown, 2),
                    "volatility": round(annualized_volatility * 100, 2),
                    "weight": round(weight * 100, 2),
                    "temp_risk_contribution": weight * annualized_volatility,
                }
                total_risk_contribution += weight * annualized_volatility

        # Then calculate contribution to risk as a percentage
        if total_risk_contribution > 0:
            for symbol in result:
                contribution = (
                    result[symbol]["temp_risk_contribution"] / total_risk_contribution
                ) * 100
                result[symbol]["contribution_to_risk"] = round(contribution, 2)
                del result[symbol]["temp_risk_contribution"]
                del result[symbol]["volatility"]
                del result[symbol]["weight"]

        return result

    def _get_rolling_risk_metrics(
        self, daily_returns: list[float], window: int = 30, dates: list[str] = None
    ) -> list[dict[str, Any]]:
        """Calculate rolling risk metrics using a specified window."""
        if len(daily_returns) < window or not dates:
            return []

        rolling_metrics = []
        for i in range(window, len(daily_returns) + 1):
            window_returns = daily_returns[i - window : i]
            volatility = statistics.stdev(window_returns) * math.sqrt(252)
            avg_return = statistics.mean(window_returns) * 252
            sharpe = (avg_return - 0.03) / volatility if volatility > 0 else 0

            rolling_metrics.append(
                {
                    "date": dates[i - 1],  # Use the end date of the window
                    "volatility": round(volatility * 100, 2),
                    "sharpe_ratio": round(sharpe, 2),
                }
            )

        return rolling_metrics

    def get_portfolio_analysis(self, user_id: int) -> dict[str, Any]:
        """Get detailed portfolio analysis including sector allocation, asset classes, etc."""
        # Get current portfolio holdings
        summary = self.get_portfolio_summary(user_id)
        if not summary.get("assets"):
            return {
                "sectors": {},
                "asset_classes": {},
                "geographic": {},
                "concentration": {"top_holdings": [], "concentration_ratio": 0},
            }

        # Fetch additional info for each asset
        holdings_analysis = {}
        total_value = summary["total_value"]

        for asset in summary["assets"]:
            symbol = asset["symbol"]
            try:
                # Fetch detailed info from Yahoo Finance
                ticker = yf.Ticker(symbol)
                info = ticker.info

                holdings_analysis[symbol] = {
                    "sector": info.get("sector", "Unknown"),
                    "industry": info.get("industry", "Unknown"),
                    "asset_class": info.get("quoteType", "Unknown"),
                    "country": info.get("country", "Unknown"),
                    "market_cap": info.get("marketCap", 0),
                    "value": asset["current_value"],
                    "weight": asset["portfolio_percentage"],
                }
            except Exception as e:
                logger.error(f"Error fetching info for {symbol}: {e}")
                holdings_analysis[symbol] = {
                    "sector": "Unknown",
                    "industry": "Unknown",
                    "asset_class": "Unknown",
                    "country": "Unknown",
                    "market_cap": 0,
                    "value": asset["current_value"],
                    "weight": asset["portfolio_percentage"],
                }

        # Calculate allocations
        sectors: dict[str, float] = {}
        asset_classes: dict[str, float] = {}
        geographic: dict[str, float] = {}

        for data in holdings_analysis.values():
            # Sector allocation
            sector = data["sector"]
            sectors[sector] = sectors.get(sector, 0) + data["weight"]

            # Asset class allocation
            asset_class = data["asset_class"]
            asset_classes[asset_class] = (
                asset_classes.get(asset_class, 0) + data["weight"]
            )

            # Geographic allocation
            country = data["country"]
            geographic[country] = geographic.get(country, 0) + data["weight"]

        # Calculate concentration metrics
        sorted_holdings = sorted(
            holdings_analysis.items(), key=lambda x: x[1]["weight"], reverse=True
        )
        top_holdings = [
            {
                "symbol": symbol,
                "weight": data["weight"],
                "sector": data["sector"],
                "value": data["value"],
            }
            for symbol, data in sorted_holdings[:5]  # Top 5 holdings
        ]

        # Calculate Herfindahl-Hirschman Index (HHI) for concentration
        hhi = sum(data["weight"] ** 2 for data in holdings_analysis.values()) / 100

        return {
            "sectors": {k: round(v, 2) for k, v in sectors.items()},
            "asset_classes": {k: round(v, 2) for k, v in asset_classes.items()},
            "geographic": {k: round(v, 2) for k, v in geographic.items()},
            "concentration": {
                "top_holdings": top_holdings,
                "concentration_ratio": round(hhi, 2),
                "diversification_score": round(
                    100 - hhi, 2
                ),  # Higher is more diversified
            },
            "holdings_details": holdings_analysis,
        }

    def get_dividend_analysis(self, user_id: int) -> dict[str, Any]:
        """Get dividend analysis including history, yield, and projections."""
        # Get current portfolio holdings
        summary = self.get_portfolio_summary(user_id)
        if not summary.get("assets"):
            return {
                "total_dividend_yield": 0,
                "annual_dividend_income": 0,
                "dividend_history": [],
                "dividend_assets": [],
            }

        # Calculate period dates
        end_date = datetime.now().date()

        total_value = summary["total_value"]
        total_dividend_income = 0
        dividend_assets = []

        # Analyze each asset
        for asset in summary["assets"]:
            symbol = asset["symbol"]
            try:
                # Fetch dividend info from Yahoo Finance
                ticker = yf.Ticker(symbol)
                dividends = ticker.dividends

                # Filter dividends for the period
                period_dividends = {
                    date.strftime("%Y-%m-%d"): amount
                    for date, amount in dividends.items()
                    if date.date() <= end_date
                }

                if period_dividends:
                    # Calculate dividend metrics based on payment frequency
                    payment_dates = sorted(period_dividends.keys())
                    if len(payment_dates) >= 2:
                        # Calculate average days between payments
                        days_between = []
                        for i in range(1, len(payment_dates)):
                            d1 = datetime.strptime(payment_dates[i - 1], "%Y-%m-%d")
                            d2 = datetime.strptime(payment_dates[i], "%Y-%m-%d")
                            days_between.append((d2 - d1).days)
                        avg_days = sum(days_between) / len(days_between)

                        # Determine frequency multiplier
                        if avg_days < 60:  # Monthly
                            frequency_multiplier = 12
                        elif avg_days < 100:  # Quarterly
                            frequency_multiplier = 4
                        elif avg_days < 240:  # Semi-annual
                            frequency_multiplier = 2
                        else:  # Annual
                            frequency_multiplier = 1
                    else:
                        # Default to annual if we can't determine frequency
                        frequency_multiplier = 1

                    # Calculate annual rate based on frequency
                    annual_rate = (
                        sum(period_dividends.values())
                        / len(period_dividends)
                        * frequency_multiplier
                    )
                    dividend_yield = (annual_rate / asset["current_price"]) * 100
                    projected_annual_income = annual_rate * asset["shares"]

                    dividend_assets.append(
                        {
                            "symbol": symbol,
                            "dividend_yield": round(dividend_yield, 2),
                            "annual_income": round(projected_annual_income, 2),
                            "last_dividend": list(period_dividends.values())[-1]
                            if period_dividends
                            else 0,
                            "dividend_history": [
                                {"date": date, "amount": amount}
                                for date, amount in period_dividends.items()
                            ],
                        }
                    )

                    total_dividend_income += projected_annual_income

            except Exception as e:
                logger.error(f"Error fetching dividend info for {symbol}: {e}")
                continue

        # Sort dividend assets by annual income
        dividend_assets.sort(key=lambda x: x["annual_income"], reverse=True)

        return {
            "total_dividend_yield": round(
                (total_dividend_income / total_value * 100), 2
            )
            if total_value > 0
            else 0,
            "annual_dividend_income": round(total_dividend_income, 2),
            "dividend_assets": dividend_assets,
            "monthly_income": round(total_dividend_income / 12, 2),
            "income_by_sector": self._get_dividend_income_by_sector(dividend_assets),
        }

    def _get_dividend_income_by_sector(
        self, dividend_assets: list[dict[str, Any]]
    ) -> dict[str, float]:
        """Calculate dividend income distribution by sector."""
        sector_income: dict[str, float] = {}

        for asset in dividend_assets:
            try:
                ticker = yf.Ticker(asset["symbol"])

                # First try to get ETF sector weights
                sector_weights = self._get_etf_sector_weights(ticker)
                if sector_weights:
                    # Distribute the ETF's dividend income across sectors based on weights
                    annual_income = float(asset.get("annual_income", 0))
                    for sector, weight in sector_weights.items():
                        clean_sector = sector.replace("_", " ").title()
                        sector_income[clean_sector] = sector_income.get(
                            clean_sector, 0
                        ) + (annual_income * float(weight))
                    continue

                # For stocks or if ETF sector breakdown failed
                info = ticker.info
                if not isinstance(info, dict):
                    raise ValueError("Invalid info data")

                sector = (
                    info.get("sector")
                    or info.get("industryDisp")
                    or info.get("categoryName")
                    or "Diversified"
                ).title()

                annual_income = float(asset.get("annual_income", 0))
                sector_income[sector] = sector_income.get(sector, 0) + annual_income

            except Exception as e:
                logger.error(f"Error getting sector for {asset['symbol']}: {e}")
                sector_income["Diversified"] = sector_income.get(
                    "Diversified", 0
                ) + float(asset.get("annual_income", 0))

        return {k: round(v, 2) for k, v in sector_income.items()}
