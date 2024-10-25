from flask import Blueprint, jsonify, request
from app.services.stock_service import StockService
from flask_jwt_extended import jwt_required
from functools import wraps

stock_bp = Blueprint('stock', __name__)
stock_service = StockService()

def jwt_required_wrapper(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        return f(*args, **kwargs)
    return decorated_function

@stock_bp.route('/search', methods=['GET'])
@jwt_required_wrapper
def search_stocks():
    """Search for stocks and ETFs."""
    query = request.args.get('q', '')
    if not query or len(query) < 2:
        return jsonify({'error': 'Query too short'}), 400
        
    results = stock_service.search_assets(query)
    return jsonify(results)

@stock_bp.route('/<symbol>', methods=['GET'])
@jwt_required_wrapper
def get_stock_info(symbol: str):
    """Get detailed information about a specific stock."""
    info = stock_service.get_asset_info(symbol)
    if info is None:
        return jsonify({'error': 'Stock not found'}), 404
    return jsonify(info)

@stock_bp.route('/<symbol>/history', methods=['GET'])
@jwt_required_wrapper
def get_stock_history(symbol: str):
    """Get historical price data for a stock."""
    period = request.args.get('period', '1y')
    history = stock_service.get_historical_prices(symbol, period)
    return jsonify(history)

@stock_bp.route('/<symbol>/prices', methods=['GET'])
@jwt_required_wrapper
def get_stock_prices(symbol: str):
    """Get historical price data for a stock."""
    period = request.args.get('period', '1Y')  # Default to 1 year
    prices = stock_service.get_historical_prices(symbol, period)
    
    if not prices:
        return jsonify({'error': 'Failed to fetch stock prices'}), 404
        
    return jsonify({
        'symbol': symbol,
        'period': period,
        'prices': prices
    })

