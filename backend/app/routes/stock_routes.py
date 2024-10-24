from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required
from app.services.stock_service import StockService
from flask import request  # Add this import

stock_ns = Namespace('stocks', description='Stock operations')
stock_service = StockService()

# Define models
stock_search_model = stock_ns.model('StockSearch', {
    'query': fields.String(required=True, description='Search query for stocks')
})

@stock_ns.route('/search')
class StockSearch(Resource):
    @stock_ns.doc('search_stocks')
    @stock_ns.expect(stock_search_model)
    @jwt_required()
    def get(self):
        """Search for stocks and ETFs."""
        query = request.args.get('query', '')  # Changed from stock_ns.payload to request.args
        if not query or len(query) < 2:
            return {'error': 'Query too short'}, 400
        
        results = stock_service.search_assets(query)
        return results

@stock_ns.route('/<symbol>')
@stock_ns.param('symbol', 'The stock symbol')
class StockInfo(Resource):
    @stock_ns.doc('get_stock_info')
    @jwt_required()
    def get(self, symbol: str):
        """Get detailed information about a specific stock."""
        info = stock_service.get_asset_info(symbol)
        if info is None:
            return {'error': 'Stock not found'}, 404
        return info

@stock_ns.route('/<symbol>/history')
@stock_ns.param('symbol', 'The stock symbol')
class StockHistory(Resource):
    @stock_ns.doc('get_stock_history')
    @stock_ns.param('period', 'The period for historical data (e.g., 1y, 6m)')
    @jwt_required()
    def get(self, symbol: str):
        """Get historical price data for a stock."""
        period = request.args.get('period', '1y')
        history = stock_service.get_historical_prices(symbol, period)
        return history

@stock_ns.route('/<symbol>/prices')
@stock_ns.param('symbol', 'The stock symbol')
class StockPrices(Resource):
    @stock_ns.doc('get_stock_prices')
    @stock_ns.param('period', 'The period for price data (e.g., 1Y)')
    @jwt_required()
    def get(self, symbol: str):
        """Get historical price data for a stock."""
        period = request.args.get('period', '1Y')
        prices = stock_service.get_historical_prices(symbol, period)
        
        if not prices:
            return {'error': 'Failed to fetch stock prices'}, 404
        
        return {
            'symbol': symbol,
            'period': period,
            'prices': prices
        }

@stock_ns.route('/<symbol>/price')
@stock_ns.param('symbol', 'The stock symbol')
class CurrentStockPrice(Resource):
    @stock_ns.doc('get_current_stock_price')
    @jwt_required()
    def get(self, symbol: str):
        """Get current price for a stock."""
        price = stock_service.get_current_price(symbol)
        
        if price is None:
            return {'error': 'Failed to fetch stock price'}, 404
        
        return {
            'symbol': symbol,
            'price': price
        }
