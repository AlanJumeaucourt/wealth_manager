from datetime import datetime
from typing import List, Dict, Any, Optional
from app.models import InvestmentTransaction
from app.database import DatabaseManager
from app.exceptions import NoResultFoundError
from app.services.base_service import BaseService
from app.services.stock_service import StockService
from app.services.transaction_service import TransactionService

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
                asset_symbol,
                asset_name,
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
                GROUP_CONCAT(id) as transaction_ids
            FROM investment_transactions
            WHERE user_id = ? {}
            GROUP BY asset_symbol, asset_name
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
        
        params = [user_id]
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
            a.name as account_name
        FROM investment_transactions it
        JOIN accounts a ON it.account_id = a.id
        WHERE it.user_id = ? AND it.asset_symbol = ?
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
                        'account_name': trans['account_name']
                    })
            
            return result
        except NoResultFoundError:
            return {
                'buys': [],
                'sells': [],
                'deposits': [],
                'withdrawals': []
            }

    def get_portfolio_performance(self, user_id: int, period: str = '1Y') -> Dict[str, Any]:
        """Get portfolio value over time using current market prices."""
        period_map = {
            '1M': 'interval 1 month',
            '3M': 'interval 3 month',
            '6M': 'interval 6 month',
            '1Y': 'interval 1 year',
            '3Y': 'interval 3 year',
            '5Y': 'interval 5 year'
        }
        
        interval = period_map.get(period, 'interval 1 year')
        
        # First, get all positions and their quantities over time
        query = f"""
        WITH RECURSIVE dates AS (
            SELECT date('now', '-{interval}') as date
            UNION ALL
            SELECT date(date, '+1 day')
            FROM dates
            WHERE date < date('now')
        )
        SELECT 
            d.date,
            it.asset_symbol,
            SUM(CASE 
                WHEN it.activity_type = 'buy' THEN it.quantity
                WHEN it.activity_type = 'sell' THEN -it.quantity
                ELSE 0 
            END) as daily_quantity_change
        FROM dates d
        LEFT JOIN investment_transactions it 
            ON date(it.date) = d.date 
            AND it.user_id = ?
        GROUP BY d.date, it.asset_symbol
        ORDER BY d.date
        """
        
        try:
            daily_positions = self.db_manager.execute_select(query, (user_id,))
            
            # Get unique symbols
            symbols = set()
            for position in daily_positions:
                if position['asset_symbol']:
                    symbols.add(position['asset_symbol'])
            
            # Get historical prices for each symbol
            symbol_prices = {}
            for symbol in symbols:
                try:
                    historical_data = self.stock_service.get_historical_prices(symbol, period)
                    symbol_prices[symbol] = {
                        item['date']: item['close'] 
                        for item in historical_data
                    }
                except Exception as e:
                    print(f"Error fetching prices for {symbol}: {e}")
                    continue
            
            # Calculate running totals and daily values
            running_quantities = {symbol: 0 for symbol in symbols}
            performance_data = []
            current_date = None
            daily_value = 0
            
            for position in daily_positions:
                date = position['date']
                symbol = position['asset_symbol']
                
                # If new date, calculate total value and reset
                if date != current_date:
                    if current_date is not None:
                        performance_data.append({
                            'date': current_date,
                            'cumulative_value': daily_value
                        })
                    current_date = date
                    daily_value = 0
                
                if symbol:
                    # Update running quantity for this symbol
                    quantity_change = float(position['daily_quantity_change'] or 0)
                    running_quantities[symbol] += quantity_change
                    
                    # Get price for this date
                    price = symbol_prices.get(symbol, {}).get(date, 0)
                    
                    # Add to daily value
                    daily_value += running_quantities[symbol] * price
            
            # Add last day
            if current_date is not None:
                performance_data.append({
                    'date': current_date,
                    'cumulative_value': daily_value
                })
            
            return {
                'performance_data': performance_data
            }
            
        except NoResultFoundError:
            today = datetime.now().strftime('%Y-%m-%d')
            return {
                'performance_data': [{
                    'date': today,
                    'cumulative_value': 0.0
                }]
            }

    def create(self, data: Dict[str, Any]) -> Optional[InvestmentTransaction]:
        """Create investment transaction and associated transfer transaction if needed."""
        try:
            # Start transaction
            with self.db_manager.connect_to_database() as connection:
                connection.execute("BEGIN TRANSACTION")
                
                # First, find the name of the investment account from the id
                investment_account_name_query = """
                SELECT name 
                FROM accounts 
                WHERE user_id = ? AND id = ? AND type = 'investment'
                """
                investment_account_name = self.db_manager.execute_select(
                    investment_account_name_query, 
                    (data['user_id'], data['account_id'])
                )
                investment_account_name = investment_account_name[0]['name']
                
                # Then, find the id of the cash account
                cash_account_id_query = """
                SELECT id 
                FROM accounts 
                WHERE user_id = ? AND type = 'checking' AND name = ?
                """
                cash_account_id = self.db_manager.execute_select(
                    cash_account_id_query, 
                    (data['user_id'], f"{investment_account_name} cash")
                )
                cash_account_id = cash_account_id[0]['id']
                                                
                # Create investment transaction
                columns = ', '.join(data.keys())
                placeholders = ', '.join(['?' for _ in data])
                query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders}) RETURNING *"
                investment_result = self.db_manager.execute_insert_returning(query, tuple(data.values()))
                
                # For buy/sell transactions, create corresponding transfer transaction
                if data['activity_type'] in ['buy', 'sell']:
                    total_amount = (data['quantity'] * data['unit_price']) + data['fee'] + data['tax']
                    
                    # For buy: transfer from cash to stock account
                    # For sell: transfer from stock to cash account
                    from_account_id = cash_account_id if data['activity_type'] == 'buy' else data['account_id']
                    to_account_id = data['account_id'] if data['activity_type'] == 'buy' else cash_account_id
                    
                    transfer_data = {
                        'user_id': data['user_id'],
                        'date': datetime.now().isoformat(),
                        'date_accountability': data['date'],
                        'description': f"{data['activity_type'].title()} {data['quantity']} {data['asset_symbol']} @ {data['unit_price']}",
                        'amount': total_amount,
                        'from_account_id': from_account_id,
                        'to_account_id': to_account_id,
                        'type': 'transfer',
                        'category': 'Investment',
                        'subcategory': data['activity_type'].title(),
                        'related_transaction_id': investment_result['id']
                    }
                    
                    # Create transfer transaction
                    self.transaction_service.create(transfer_data)
                
                connection.commit()
                return self.model_class(**investment_result)
                
        except Exception as e:
            if 'connection' in locals():
                connection.rollback()
            print(f"Error creating investment transaction: {e}")
            raise
