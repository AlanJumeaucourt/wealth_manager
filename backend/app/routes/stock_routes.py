from functools import wraps

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.services.custom_price_service import CustomPriceService
from app.services.stock_service import StockService
from app.swagger import spec

stock_bp = Blueprint("stock", __name__)
stock_service = StockService()
custom_price_service = CustomPriceService()


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
    period = request.args.get("period", "max")
    history = stock_service.get_historical_prices(symbol, period)
    return jsonify(history)


def register_stock_swagger_docs():
    """Register Swagger documentation for Stock endpoints"""

    # Document stock search endpoint
    spec.path(
        path="/stocks/search",
        operations={
            "get": {
                "tags": ["Stock"],
                "summary": "Search for stocks and ETFs",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "q",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "string", "minLength": 2},
                        "description": "Search query (minimum 2 characters)",
                        "example": "AAPL",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Search results",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "symbol": {"type": "string"},
                                            "name": {"type": "string"},
                                            "exchange": {"type": "string"},
                                            "type": {"type": "string"},
                                            "currency": {"type": "string"},
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "400": {"description": "Query too short"},
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )

    # Document stock info endpoint
    spec.path(
        path="/stocks/{symbol}",
        operations={
            "get": {
                "tags": ["Stock"],
                "summary": "Get detailed information about a specific stock",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "symbol",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Stock symbol (e.g., AAPL, MSFT)",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Stock information",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "symbol": {"type": "string"},
                                        "name": {"type": "string"},
                                        "exchange": {"type": "string"},
                                        "currency": {"type": "string"},
                                        "price": {"type": "number"},
                                        "change": {"type": "number"},
                                        "change_percent": {"type": "number"},
                                        "market_cap": {"type": "number"},
                                        "volume": {"type": "integer"},
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "404": {"description": "Stock not found"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )

    # Document stock history endpoint
    spec.path(
        path="/stocks/{symbol}/history",
        operations={
            "get": {
                "tags": ["Stock"],
                "summary": "Get historical price data for a stock",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "symbol",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Stock symbol (e.g., AAPL, MSFT)",
                    },
                    {
                        "name": "period",
                        "in": "query",
                        "schema": {"type": "string", "default": "max", "enum": ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]},
                        "description": "Time period for historical data",
                        "example": "1y",
                        "required": False,
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Historical price data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "date": {"type": "string", "format": "date"},
                                            "open": {"type": "number"},
                                            "high": {"type": "number"},
                                            "low": {"type": "number"},
                                            "close": {"type": "number"},
                                            "volume": {"type": "integer"},
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "404": {"description": "Stock not found"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )

    # Document stock details endpoint
    spec.path(
        path="/stocks/{symbol}/details",
        operations={
            "get": {
                "tags": ["Stock"],
                "summary": "Get comprehensive details about a stock or ETF",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "symbol",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Stock symbol (e.g., AAPL, MSFT)",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Comprehensive stock details",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "symbol": {"type": "string"},
                                        "name": {"type": "string"},
                                        "sector": {"type": "string"},
                                        "industry": {"type": "string"},
                                        "market_cap": {"type": "number"},
                                        "pe_ratio": {"type": "number"},
                                        "dividend_yield": {"type": "number"},
                                        "52_week_high": {"type": "number"},
                                        "52_week_low": {"type": "number"},
                                        "analyst_rating": {"type": "string"},
                                        "price_target": {"type": "number"},
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "404": {"description": "Stock not found"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )

    # Document custom prices GET endpoint
    spec.path(
        path="/stocks/{symbol}/custom-prices",
        operations={
            "get": {
                "tags": ["Stock"],
                "summary": "Get custom prices for a stock",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "symbol",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Stock symbol (e.g., AAPL, MSFT)",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Custom price data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "date": {"type": "string", "format": "date"},
                                            "open": {"type": "number"},
                                            "high": {"type": "number"},
                                            "low": {"type": "number"},
                                            "close": {"type": "number"},
                                            "volume": {"type": "integer"},
                                            "value": {"type": "number"},
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
                },
            },
            "post": {
                "tags": ["Stock"],
                "summary": "Add a custom price for a stock",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "symbol",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Stock symbol (e.g., AAPL, MSFT)",
                    },
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["date", "close"],
                                "properties": {
                                    "date": {"type": "string", "format": "date"},
                                    "open": {"type": "number"},
                                    "high": {"type": "number"},
                                    "low": {"type": "number"},
                                    "close": {"type": "number"},
                                    "volume": {"type": "integer"},
                                },
                            },
                        },
                    },
                },
                "responses": {
                    "201": {
                        "description": "Custom price added successfully",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "id": {"type": "integer"},
                                        "date": {"type": "string", "format": "date"},
                                        "open": {"type": "number"},
                                        "high": {"type": "number"},
                                        "low": {"type": "number"},
                                        "close": {"type": "number"},
                                        "volume": {"type": "integer"},
                                    },
                                },
                            },
                        },
                    },
                    "400": {"description": "Invalid input"},
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
                },
            },
        },
    )

    # Document custom prices batch delete endpoint
    spec.path(
        path="/stocks/{symbol}/custom-prices/batch",
        operations={
            "delete": {
                "tags": ["Stock"],
                "summary": "Delete multiple custom prices for a stock",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "symbol",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Stock symbol (e.g., AAPL, MSFT)",
                    },
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["dates"],
                                "properties": {
                                    "dates": {
                                        "type": "array",
                                        "items": {"type": "string", "format": "date"},
                                    },
                                },
                            },
                        },
                    },
                },
                "responses": {
                    "200": {
                        "description": "Custom prices deleted successfully",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "deleted": {"type": "integer"},
                                    },
                                },
                            },
                        },
                    },
                    "400": {"description": "Invalid input"},
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
                },
            },
        },
    )

    # Document custom price delete endpoint
    spec.path(
        path="/stocks/{symbol}/custom-prices/{date}",
        operations={
            "delete": {
                "tags": ["Stock"],
                "summary": "Delete a custom price for a stock by date",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "symbol",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Stock symbol (e.g., AAPL, MSFT)",
                    },
                    {
                        "name": "date",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string", "format": "date"},
                        "description": "Date of the custom price (YYYY-MM-DD)",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Custom price deleted successfully",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "success": {"type": "boolean"},
                                        "message": {"type": "string"},
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "404": {"description": "Custom price not found"},
                    "500": {"description": "Server error"},
                },
            },
        },
    )


# Register Swagger documentation
register_stock_swagger_docs()


@stock_bp.route("/<symbol>/details", methods=["GET"])
@jwt_required_wrapper
def get_stock_details(symbol: str):
    """Get comprehensive details about a stock or ETF."""
    details = stock_service.get_stock_details(symbol)
    if details is None:
        return jsonify({"error": "Failed to fetch stock details"}), 404
    return jsonify(details)


@stock_bp.route("/<symbol>/custom-prices", methods=["GET"])
@jwt_required_wrapper
def get_custom_prices(symbol: str):
    """Get custom prices for a stock."""
    user_id = get_jwt_identity()
    prices = custom_price_service.get_by_symbol(symbol, user_id)

    # Convert to the format expected by the frontend
    result = [
        {
            "date": price.date,
            "open": price.open,
            "high": price.high,
            "low": price.low,
            "close": price.close,
            "volume": price.volume,
            "value": price.close,  # For compatibility with historical prices format
        }
        for price in prices
    ]

    return jsonify(result)


@stock_bp.route("/<symbol>/custom-prices", methods=["POST"])
@jwt_required_wrapper
def add_custom_price(symbol: str):
    """Add a custom price for a stock."""
    user_id = get_jwt_identity()
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Check if this is a batch request
    if isinstance(data, list):
        # Ensure symbol is set for all items
        for item in data:
            item["symbol"] = symbol

        result = custom_price_service.batch_add_prices(data, user_id)

        if result["total_successful"] > 0:
            return jsonify(
                {
                    "message": f"Added {result['total_successful']} custom prices for {symbol}",
                    "details": result,
                }
            ), 201
        return jsonify({"error": "Failed to add custom prices", "details": result}), 400

    # Single price entry
    date = data.get("date")
    price = data.get("price", {})

    if not date:
        return jsonify({"error": "Date is required"}), 400

    if not price or not isinstance(price, dict):
        return jsonify({"error": "Invalid price data format"}), 400

    result = custom_price_service.add_price(symbol, date, price, user_id)

    if result:
        return jsonify(
            {
                "message": f"Custom price added for {symbol} on {date}",
                "price": {
                    "date": result.date,
                    "open": result.open,
                    "high": result.high,
                    "low": result.low,
                    "close": result.close,
                    "volume": result.volume,
                },
            }
        ), 201

    return jsonify({"error": "Failed to add custom price"}), 500


@stock_bp.route("/<symbol>/custom-prices/<date>", methods=["DELETE"])
@jwt_required_wrapper
def delete_custom_price(symbol: str, date: str):
    """Delete a custom price for a stock."""
    user_id = get_jwt_identity()
    success = custom_price_service.delete_price(symbol, date, user_id)
    if success:
        return jsonify({"message": f"Custom price deleted for {symbol} on {date}"}), 200
    return jsonify({"error": "Failed to delete custom price"}), 500


@stock_bp.route("/<symbol>/custom-prices/batch", methods=["DELETE"])
@jwt_required_wrapper
def batch_delete_custom_prices(symbol: str):
    """Delete multiple custom prices for a stock."""
    user_id = get_jwt_identity()
    data = request.json

    if not data or not isinstance(data, list):
        return jsonify({"error": "Invalid request format. Expected list of dates"}), 400

    # Convert data to list of dates if it isn't already
    dates = []
    for item in data:
        if isinstance(item, str):
            # Simple date format
            dates.append(item)
        elif isinstance(item, dict) and "date" in item:
            # Object format
            dates.append(item["date"])

    if not dates:
        return jsonify({"error": "No valid dates provided"}), 400

    result = custom_price_service.batch_delete_prices_by_dates(symbol, dates, user_id)

    if result["total_successful"] > 0:
        return jsonify(
            {
                "message": f"Deleted {result['total_successful']} custom prices for {symbol}",
                "details": result,
            }
        ), 200
    return jsonify({"error": "Failed to delete custom prices", "details": result}), 400
