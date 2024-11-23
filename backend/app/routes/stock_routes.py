from functools import wraps

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.stock_service import StockService

stock_bp = Blueprint("stock", __name__)
stock_service = StockService()


def jwt_required_wrapper(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        return f(*args, **kwargs)

    return decorated_function


@stock_bp.route("/search", methods=["GET"])
@jwt_required_wrapper
def search_stocks():
    """Search for stocks and ETFs."""
    query = request.args.get("q", "")
    if not query or len(query) < 2:
        return jsonify({"error": "Query too short"}), 400

    results = stock_service.search_assets(query)
    return jsonify(results)


@stock_bp.route("/<symbol>", methods=["GET"])
@jwt_required_wrapper
def get_stock_info(symbol: str):
    """Get detailed information about a specific stock."""
    info = stock_service.get_asset_info(symbol)
    if info is None:
        return jsonify({"error": "Stock not found"}), 404
    return jsonify(info)


@stock_bp.route("/<symbol>/history", methods=["GET"])
@jwt_required_wrapper
def get_stock_history(symbol: str):
    """Get historical price data for a stock."""
    period = request.args.get("period", "1y")
    history = stock_service.get_historical_prices(symbol, period)
    return jsonify(history)


@stock_bp.route("/<symbol>/details", methods=["GET"])
@jwt_required_wrapper
def get_stock_details(symbol: str):
    """Get comprehensive details about a stock or ETF."""
    details = stock_service.get_stock_details(symbol)
    if details is None:
        return jsonify({"error": "Failed to fetch stock details"}), 404
    return jsonify(details)
