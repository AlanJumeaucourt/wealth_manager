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
        query = """
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
                    "t.user_id",
                ]
            else:
                select_fields = []
                for field in requested_fields:
                    if field in transaction_fields:
                        select_fields.append(f"t.{field}")
                    elif field in investment_fields:
                        select_fields.append(f"i.{field}")

            # Build count query
            count_query = """
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
                raise ValueError(f"Asset with ID {validated_data['asset_id']} not found")
            asset_symbol = result[0]["symbol"]

            # Prepare transaction data
            transaction_data = {
                "user_id": validated_data["user_id"],
                "date": validated_data["date"],
                "date_accountability": validated_data["date"],
                "description": f"{validated_data['activity_type'].title()} {validated_data['quantity']} {asset_symbol} at {validated_data['unit_price']}€",
                "amount": (validated_data["quantity"] * validated_data["unit_price"])
                + validated_data["fee"]
                + validated_data["tax"],
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
            print(f"query={query}")
            print(f"params={list(investment_data.values())}")

            investment_result = self.db_manager.execute_insert_returning(
                query=query, params=list(investment_data.values())
            )
            print(f"investment_result={investment_result}")

            # Get current price from Yahoo Finance
            cursor = connection.cursor()
            # First get the symbol for the asset
            symbol_query = "SELECT symbol FROM assets WHERE id = ?"
            cursor.execute(symbol_query, (validated_data["asset_id"],))

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
        account_filter = "AND aa.account_id = ?" if account_id else ""
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
        investment_transactions = self.db_manager.execute_select(
            investment_query, [user_id]
        )

        # Calculate initial and net investment
        initial_investment = 0
        total_withdrawals = 0
        for tx in investment_transactions:
            if tx["investment_type"] == "Buy":
                initial_investment += tx["total_paid"]
            elif tx["investment_type"] == "Sell":
                total_withdrawals += tx["total_paid"]

        net_investment = initial_investment - total_withdrawals

        query = f"""--sql
        SELECT
            a.symbol,
            a.name,
            ab.quantity as shares,
            (SELECT AVG(i.unit_price)
             FROM investment_details i
             JOIN transactions t ON i.transaction_id = t.id
             WHERE i.asset_id = a.id
             AND t.user_id = ?
             AND t.is_investment = TRUE
             AND i.investment_type = 'Buy') as avg_buy_price
        FROM asset_balances ab
        JOIN assets a ON ab.asset_id = a.id
        WHERE ab.user_id = ? {account_filter}
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
            summary["total_value"] - summary["net_investment"], 2
        )
        if summary["net_investment"] > 0:
            summary["total_gain_loss_percentage"] = round(
                (summary["total_value"] - summary["net_investment"])
                / summary["net_investment"]
                * 100,
                2,
            )
        else:
            summary["total_gain_loss_percentage"] = 0

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
        """Get portfolio performance over time."""
        # Convert period to date range
        end_date = datetime.now().date()

        query = """--sql
        SELECT
            t.date,
            i.quantity,
            i.unit_price,
            a.symbol,
            i.investment_type
        FROM transactions t
        JOIN investment_details i ON t.id = i.transaction_id
        JOIN assets a ON i.asset_id = a.id
        WHERE t.user_id = ?
        AND t.is_investment = TRUE
        ORDER BY t.date
        """

        try:
            transactions = self.db_manager.execute_select(
                query=query,
                params=[user_id],
            )
        except NoResultFoundError:
            # Handle the case where no transactions are found
            return {
                "data_points": [],
            }

        start_date = datetime.strptime(
            transactions[0]["date"].split("T")[0], "%Y-%m-%d"
        ).date()
        # Create a list of all dates in the range
        all_dates = [
            start_date + timedelta(days=i)
            for i in range((end_date - start_date).days + 1)
        ]

        # Track owned assets and their quantities
        owned_assets = {}
        initial_investment = 0  # Track total money invested
        total_withdrawals = 0  # Track total money withdrawn

        # Pre-fetch historical prices for all unique symbols
        unique_symbols = {tx["symbol"] for tx in transactions}
        historical_prices = {}

        # Convert dates to datetime for yfinance
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())

        for symbol in unique_symbols:
            symbol_prices = self._fetch_yahoo_history(
                symbol, start_datetime, end_datetime
            )
            if symbol_prices:
                historical_prices[symbol] = symbol_prices
            else:
                # If we can't get historical prices, create a price history from transactions
                historical_prices[symbol] = {}
                for tx in transactions:
                    if tx["symbol"] == symbol:
                        historical_prices[symbol][tx["date"]] = tx["unit_price"]

        data_points = []

        for i, date in enumerate(all_dates):
            date_str = date.isoformat()

            # Initialize or copy previous day's holdings
            if i > 0:
                owned_assets[date_str] = owned_assets[
                    all_dates[i - 1].isoformat()
                ].copy()
            else:
                owned_assets[date_str] = {}

            # Process transactions for this date
            for tx in transactions:
                if tx["date"] == date_str:
                    symbol = tx["symbol"]
                    if symbol not in owned_assets[date_str]:
                        owned_assets[date_str][symbol] = 0

                    transaction_value = tx["quantity"] * tx["unit_price"]
                    if tx["investment_type"] in ["Buy", "Deposit"]:
                        owned_assets[date_str][symbol] += tx["quantity"]
                        initial_investment += transaction_value
                    elif tx["investment_type"] in ["Sell", "Withdrawal"]:
                        owned_assets[date_str][symbol] -= tx["quantity"]
                        # Instead of adding to total_withdrawals, track realized gains/losses immediately
                        # Get cost basis at time of sale
                        sell_date_buys = [
                            t
                            for t in transactions
                            if t["symbol"] == tx["symbol"]
                            and t["date"] <= tx["date"]
                            and t["investment_type"] == "Buy"
                        ]
                        if sell_date_buys:
                            total_buy_cost = sum(
                                t["quantity"] * t["unit_price"] for t in sell_date_buys
                            )
                            total_buy_quantity = sum(
                                t["quantity"] for t in sell_date_buys
                            )
                            avg_cost = (
                                total_buy_cost / total_buy_quantity
                                if total_buy_quantity > 0
                                else 0
                            )
                            # Calculate realized gain/loss and adjust initial investment
                            realized_gain = (tx["unit_price"] - avg_cost) * tx[
                                "quantity"
                            ]
                            # Reduce initial investment by cost basis of sold shares
                            initial_investment -= avg_cost * tx["quantity"]
                        if owned_assets[date_str][symbol] <= 0:
                            del owned_assets[date_str][symbol]
                    elif tx["investment_type"] in ["Dividend", "Interest"]:
                        # Dividend and Interest are types of income, not affecting the quantity
                        pass

            # Create data point for this date
            assets_data = {}
            total_value = 0

            for symbol, quantity in owned_assets[date_str].items():
                # Get price for this date from historical data
                price = historical_prices[symbol].get(
                    date_str,
                    # Fallback to last known price if no price for this date
                    next(
                        (
                            p
                            for d, p in sorted(
                                historical_prices[symbol].items(), reverse=True
                            )
                            if d <= date_str
                        ),
                        0,  # Default to 0 if no earlier price found
                    ),
                )

                # Calculate cost basis per share for this asset up to this date
                buy_transactions = [
                    tx
                    for tx in transactions
                    if tx["symbol"] == symbol
                    and tx["date"] <= date_str
                    and tx["investment_type"] == "Buy"
                ]

                total_buy_cost = sum(
                    tx["quantity"] * tx["unit_price"] for tx in buy_transactions
                )
                total_buy_quantity = sum(tx["quantity"] for tx in buy_transactions)
                cost_basis_per_share = (
                    total_buy_cost / total_buy_quantity if total_buy_quantity > 0 else 0
                )

                asset_value = quantity * price
                assets_data[symbol] = {
                    "price": price,
                    "quantity": quantity,
                    "total_value": asset_value,
                    "cost_basis_per_share": cost_basis_per_share,
                }
                total_value += asset_value

            # Calculate total gains using cost basis per share
            total_gains = 0
            current_investment = 0  # Track current investment based on remaining shares
            for symbol, asset_data in assets_data.items():
                quantity = asset_data["quantity"]
                price = asset_data["price"]
                cost_basis_per_share = asset_data["cost_basis_per_share"]

                # Calculate gain/loss for this position
                position_gain = quantity * (price - cost_basis_per_share)
                total_gains += position_gain
                # Add to current investment
                current_investment += quantity * cost_basis_per_share

            # Calculate performance based on current investment value
            performance = (
                (total_gains / current_investment * 100)
                if current_investment > 0
                else 0
            )

            # Calculate TRI (Total Return Index)
            # Base TRI on initial value of 100
            if i == 0:
                tri_value = 100  # Initial TRI value
            else:
                prev_tri = data_points[i - 1]["tri"]
                prev_value = data_points[i - 1]["total_value"]
                if prev_value > 0:
                    daily_return = (total_value - prev_value) / prev_value
                    tri_value = prev_tri * (1 + daily_return)
                else:
                    tri_value = prev_tri

            data_points.append(
                {
                    "date": date_str,
                    "total_value": total_value,
                    "performance": round(performance, 2),
                    "absolute_gain": round(total_gains, 2),
                    "assets": assets_data,
                    "tri": round(tri_value, 2),
                    "net_invested": initial_investment - total_withdrawals,
                    "total_gains": total_gains,
                }
            )

        return {
            "data_points": data_points,
            "summary": {
                "initial_investment": initial_investment,
                "total_withdrawals": total_withdrawals,
                "net_investment": initial_investment - total_withdrawals,
                "current_value": data_points[-1]["total_value"] if data_points else 0,
                "total_return": data_points[-1]["performance"] if data_points else 0,
            },
        }

    def delete(self, item_id: int, user_id: int) -> bool:
        try:
            # Delete the investment details (transaction will be cascade deleted by database)
            query = "DELETE FROM investment_details WHERE transaction_id = ? and user_id = ?"
            self.db_manager.execute_delete(query, [item_id, user_id])
            return True
        except Exception as e:
            print(f"Error deleting {self.table_name}: {e}")
            return False

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
