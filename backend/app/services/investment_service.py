from datetime import datetime
import logging
from typing import List, Dict, Any, Optional, TypedDict
from app.models import InvestmentTransaction
from app.database import DatabaseManager
from app.exceptions import NoResultFoundError
from app.services.base_service import BaseService
from app.services.stock_service import StockService
from app.services.transaction_service import TransactionService

logger = logging.getLogger(__name__)

# Add these type definitions at the top of the file
class PerformanceDataPoint(TypedDict):
    date: str
    cumulative_value: float

class PortfolioPerformance(TypedDict):
    performance_data: List[PerformanceDataPoint]

class HistoricalPrice(TypedDict):
    date: str
    close: float

class InvestmentService(BaseService):
    def __init__(self):
        super().__init__('investment_transactions', InvestmentTransaction)
        self.db_manager = DatabaseManager()
        self.stock_service = StockService()
        self.transaction_service = TransactionService()

    def get_portfolio_summary(self, user_id: int, account_id: Optional[int] = None) -> Dict[str, Any]:
        """Get summary of current portfolio positions with average price and current market price."""
        query = """
        WITH position_summary AS (
            SELECT
                a.symbol as asset_symbol,
                a.name as asset_name,
                SUM(CASE
                    WHEN activity_type = 'buy' THEN quantity
                    WHEN activity_type = 'sell' THEN -quantity
                    ELSE 0
                END) as total_quantity,
                SUM(CASE
                    WHEN activity_type = 'buy' THEN quantity * unit_price
                    WHEN activity_type = 'sell' THEN -quantity * unit_price
                    ELSE 0
                END) as total_cost,
                SUM(CASE
                    WHEN activity_type = 'buy' THEN quantity * unit_price + fee + tax
                    WHEN activity_type = 'sell' THEN -(quantity * unit_price) + fee + tax
                    WHEN activity_type = 'deposit' THEN quantity
                    WHEN activity_type = 'withdrawal' THEN -quantity
                    ELSE 0
                END) as total_invested,
                GROUP_CONCAT(it.id) as transaction_ids
            FROM investment_transactions it
            JOIN assets a ON it.asset_id = a.id
            WHERE it.user_id = ? AND a.user_id = ? {}
            GROUP BY a.symbol, a.name
            HAVING total_quantity > 0 OR total_invested != 0
        )
        SELECT
            asset_symbol,
            asset_name,
            total_quantity,
            CASE
                WHEN total_quantity > 0 THEN total_cost / total_quantity
                ELSE 0
            END as average_price,
            total_invested,
            transaction_ids
        FROM position_summary
        """

        params = [user_id, user_id]
        if account_id:
            query = query.format("AND account_id = ?")
            params.append(account_id)
        else:
            query = query.format("")

        try:
            positions = self.db_manager.execute_select(query, tuple(params))

            # Get current market prices for all positions
            for position in positions:
                try:
                    stock_info = self.stock_service.get_asset_info(position['asset_symbol'])
                    print(f"stock_info: {stock_info}")
                    # Set default to 0 if current_price is None
                    current_price = stock_info.get('previous_close', 0) if stock_info else 0
                    position['current_price'] = float(current_price) if current_price is not None else 0
                except Exception as e:
                    print(f"Error fetching current price for {position['asset_symbol']}: {e}")
                    position['current_price'] = 0

            # Calculate additional metrics with safe type conversion
            total_invested = 0
            total_value = 0
            total_gain = 0

            for position in positions:
                # Ensure all numeric values are properly converted to float
                position['total_quantity'] = float(position['total_quantity'])
                position['average_price'] = float(position['average_price'])
                position['total_invested'] = float(position['total_quantity'] * position['average_price'])
                position['current_price'] = float(position['current_price'])
                position['total_value'] = position['total_quantity'] * position['current_price']

                # Calculate position metrics
                position['unrealized_gain'] = position['total_value'] - position['total_invested']

                # Calculate performance percentage
                if position['total_invested'] != 0:
                    position['performance'] = (position['unrealized_gain'] / abs(position['total_invested'])) * 100
                else:
                    position['performance'] = 0

                # Update totals
                total_invested += position['total_invested']
                total_value += position['total_value']
                total_gain += position['unrealized_gain']

            return {
                'positions': positions,
                'total_invested': total_invested,
                'total_value': total_value,
                'total_gain': total_gain
            }

        except NoResultFoundError:
            return {
                'positions': [],
                'total_invested': 0,
                'total_value': 0,
                'total_gain': 0
            }

    def get_asset_transactions(self, user_id: int, asset_symbol: str) -> Dict[str, List[Dict[str, Any]]]:
        """Get all transactions for a specific asset."""
        query = """
        SELECT
            it.id,
            strftime('%Y-%m-%d', it.date) as date,
            it.activity_type,
            it.quantity,
            it.unit_price,
            it.fee,
            it.tax,
            it.total_paid,
            a.name as account_name,
            it.to_account_id as account_id
        FROM investment_transactions it
        JOIN accounts a ON it.to_account_id = a.id
        JOIN assets ast ON it.asset_id = ast.id
        WHERE it.user_id = ? AND ast.symbol = ?
        ORDER BY it.date DESC
        """

        try:
            transactions = self.db_manager.execute_select(query, (user_id, asset_symbol))

            # Initialize result with empty lists for each activity type
            result = {
                'buys': [],
                'sells': [],
                'deposits': [],
                'withdrawals': []
            }

            # Process each transaction
            for trans in transactions:
                activity_type = trans['activity_type']
                # Add 's' to match the result keys (buy -> buys, sell -> sells, etc.)
                activity_list = activity_type + 's'

                if activity_list in result:
                    result[activity_list].append({
                        'id': trans['id'],
                        'date': trans['date'],
                        'quantity': float(trans['quantity']),
                        'price': float(trans['unit_price']),
                        'fee': float(trans['fee']) if trans['fee'] else 0,
                        'tax': float(trans['tax']) if trans['tax'] else 0,
                        'total_paid': float(trans['total_paid']) if trans['total_paid'] else 0,
                        'account_name': trans['account_name'],
                        'account_id': trans['account_id']
                    })

            return result
        except NoResultFoundError:
            return {
                'buys': [],
                'sells': [],
                'deposits': [],
                'withdrawals': []
            }

    def get_portfolio_performance(self, user_id: int, period: str = '1Y') -> PortfolioPerformance:
        """Get portfolio value over time using current market prices."""
        period_map = {
            '1M': '1mo',  # Match yfinance period format
            '3M': '3mo',
            '6M': '6mo',
            '1Y': '1y',
            '3Y': '3y',
            '5Y': '5y',
            'Max': 'max'
        }

        yf_period = period_map.get(period, '1y')

        # Get all transactions within the period
        query = """
        SELECT
            date(t.date) as date,
            a.symbol as asset_symbol,
            SUM(CASE
                WHEN t.activity_type = 'buy' THEN t.quantity
                WHEN t.activity_type = 'sell' THEN -t.quantity
                ELSE 0
            END) as quantity_change
        FROM investment_transactions t
        JOIN assets a ON t.asset_id = a.id
        WHERE t.user_id = ? AND a.user_id = ?
        GROUP BY date(t.date), a.symbol
        HAVING quantity_change != 0
        ORDER BY date
        """

        try:
            transactions = self.db_manager.execute_select(query, (user_id, user_id))
            logger.info(f"transactions: {transactions}")

            if not transactions:
                return {
                    'performance_data': [{
                        'date': datetime.now().strftime('%Y-%m-%d'),
                        'cumulative_value': 0.0
                    }]
                }

            # Get unique symbols and track positions
            positions: Dict[str, float] = {}  # symbol -> quantity
            daily_positions: Dict[str, Dict[str, float]] = {}  # date -> {symbol -> quantity}
            symbols = {str(t['asset_symbol']) for t in transactions}

            # Calculate positions for each day based on transactions
            for trans in transactions:
                date = str(trans['date'])
                symbol = str(trans['asset_symbol'])
                quantity_change = float(trans['quantity_change'])

                # Update running position for this symbol
                positions[symbol] = positions.get(symbol, 0.0) + quantity_change

                # Store the positions for this date
                if date not in daily_positions:
                    # Copy the previous day's positions for all symbols
                    daily_positions[date] = positions.copy()
                else:
                    # Update just this symbol's position
                    daily_positions[date][symbol] = positions[symbol]

            # Get historical prices for all symbols
            prices_by_symbol: Dict[str, Dict[str, float]] = {}
            for symbol in symbols:
                try:
                    historical_data = self.stock_service.get_historical_prices(symbol, yf_period)
                    logger.info(f"historical_data for {symbol}: {historical_data[:2]}...")  # Log first 2 entries

                    # Create a date -> price mapping for this symbol
                    prices_by_symbol[symbol] = {}
                    for item in historical_data:
                        date = str(item['date'])
                        close_price = float(item['close'])
                        prices_by_symbol[symbol][date] = close_price

                except Exception as e:
                    logger.error(f"Error fetching prices for {symbol}: {e}")
                    continue

            # Get all dates where we have either transactions or prices
            all_dates = sorted(set(
                date for dates in [
                    daily_positions.keys(),
                    *(prices.keys() for prices in prices_by_symbol.values())
                ]
                for date in dates
            ))

            # Calculate daily portfolio values
            performance_data: List[PerformanceDataPoint] = []
            current_positions = {symbol: 0.0 for symbol in symbols}

            for date in all_dates:
                # Update positions if we have transactions for this date
                if date in daily_positions:
                    current_positions.update(daily_positions[date])

                # Calculate total value for this date
                daily_value = 0.0
                for symbol, quantity in current_positions.items():
                    if symbol in prices_by_symbol and date in prices_by_symbol[symbol]:
                        price = prices_by_symbol[symbol][date]
                        position_value = quantity * price
                        daily_value += position_value

                if daily_value > 0:  # Only add points where we have a value
                    performance_data.append({
                        'date': date,
                        'cumulative_value': round(daily_value, 2)
                    })

            # Sort by date
            performance_data.sort(key=lambda x: x['date'])

            # Ensure we have at least one data point
            if not performance_data:
                return {
                    'performance_data': [{
                        'date': datetime.now().strftime('%Y-%m-%d'),
                        'cumulative_value': 0.0
                    }]
                }

            logger.info(f"Returning performance data with {len(performance_data)} points")
            return {
                'performance_data': performance_data
            }

        except Exception as e:
            logger.error(f"Error in get_portfolio_performance: {e}", exc_info=True)
            return {
                'performance_data': [{
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'cumulative_value': 0.0
                }]
            }

    def create(self, data: Dict[str, Any]) -> Optional[InvestmentTransaction]:
        """Create investment transaction and associated transfer transaction if needed."""
        try:
            # Start transaction
            with self.db_manager.connect_to_database() as connection:
                connection.execute("BEGIN TRANSACTION")

                # Prepare investment transaction data
                investment_data = {
                    'user_id': data['user_id'],
                    'from_account_id': data['from_account_id'],
                    'to_account_id': data['to_account_id'],
                    'asset_id': data['asset_id'],
                    'activity_type': data['activity_type'],
                    'date': data['date'],
                    'quantity': data['quantity'],
                    'unit_price': data['unit_price'],
                    'fee': data['fee'],
                    'tax': data['tax']
                }

                # Create investment transaction
                columns = ', '.join(investment_data.keys())
                placeholders = ', '.join(['?' for _ in investment_data])
                query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders}) RETURNING *"
                investment_result = self.db_manager.execute_insert_returning(query, tuple(investment_data.values()))

                # Calculate quantity change based on activity type
                quantity_change = (
                    data['quantity'] if data['activity_type'] == 'buy'
                    else -data['quantity'] if data['activity_type'] == 'sell'
                    else 0
                )

                # First try to update existing record
                update_query = """
                UPDATE account_assets
                SET quantity = quantity + ?
                WHERE account_id = ? AND asset_id = ? AND user_id = ?
                """

                cursor = connection.cursor()
                cursor.execute(update_query, (
                    quantity_change,
                    data['to_account_id'],
                    data['asset_id'],
                    data['user_id']
                ))

                # If no rows were updated, insert new record
                if cursor.rowcount == 0:
                    insert_query = """
                    INSERT INTO account_assets (user_id, account_id, asset_id, quantity)
                    VALUES (?, ?, ?, ?)
                    """
                    cursor.execute(insert_query, (
                        data['user_id'],
                        data['to_account_id'],
                        data['asset_id'],
                        quantity_change
                    ))

                connection.commit()
                return self.model_class(**investment_result)

        except Exception as e:
            if 'connection' in locals():
                connection.rollback()
            logger.error(f"Error creating investment transaction: {e}")
            raise
