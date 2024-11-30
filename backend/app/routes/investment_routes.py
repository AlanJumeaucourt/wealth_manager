from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.routes.base_routes import BaseRoutes
from app.schemas.schema_registry import InvestmentTransactionSchema
from app.services.investment_service import InvestmentService
from app.swagger import spec

investment_service = InvestmentService()
investment_routes = BaseRoutes(
    "investment", investment_service, InvestmentTransactionSchema()
)
investment_bp = investment_routes.bp


def register_investment_swagger_docs():
    # Document portfolio summary endpoint
    spec.path(
        path="/investments/portfolio/summary",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Get investment portfolio summary",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "account_id",
                        "in": "query",
                        "required": False,
                        "schema": {"type": "integer"},
                        "description": "Optional account ID to filter portfolio summary",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Portfolio summary data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "total_value": {"type": "number"},
                                        "total_cost": {"type": "number"},
                                        "total_gain_loss": {"type": "number"},
                                        "total_gain_loss_percentage": {
                                            "type": "number"
                                        },
                                        "assets": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "symbol": {"type": "string"},
                                                    "name": {"type": "string"},
                                                    "shares": {"type": "number"},
                                                    "current_price": {"type": "number"},
                                                    "current_value": {"type": "number"},
                                                    "cost_basis": {"type": "number"},
                                                    "gain_loss": {"type": "number"},
                                                    "gain_loss_percentage": {
                                                        "type": "number"
                                                    },
                                                },
                                            },
                                        },
                                    },
                                }
                            }
                        },
                    },
                    "401": {"description": "Unauthorized"},
                },
            }
        },
    )

    # Document portfolio performance endpoint
    spec.path(
        path="/investments/portfolio/performance",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Get investment portfolio performance over time",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "period",
                        "in": "query",
                        "required": False,
                        "schema": {
                            "type": "string",
                            "enum": [
                                "1D",
                                "1W",
                                "1M",
                                "3M",
                                "6M",
                                "1Y",
                                "3Y",
                                "5Y",
                                "ALL",
                            ],
                            "default": "1Y",
                        },
                        "description": "Time period for performance data",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Portfolio performance data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "period": {"type": "string"},
                                        "start_value": {"type": "number"},
                                        "end_value": {"type": "number"},
                                        "total_return": {"type": "number"},
                                        "total_return_percentage": {"type": "number"},
                                        "data_points": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "date": {
                                                        "type": "string",
                                                        "format": "date",
                                                    },
                                                    "value": {"type": "number"},
                                                },
                                            },
                                        },
                                    },
                                }
                            }
                        },
                    },
                    "401": {"description": "Unauthorized"},
                },
            }
        },
    )

    # Document asset transactions endpoint
    spec.path(
        path="/investments/assets/{symbol}/transactions",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Get transactions for a specific investment asset",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "symbol",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Asset symbol (e.g., AAPL, GOOGL)",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Asset transactions",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "id": {"type": "integer"},
                                            "date": {
                                                "type": "string",
                                                "format": "date",
                                            },
                                            "type": {
                                                "type": "string",
                                                "enum": ["buy", "sell"],
                                            },
                                            "shares": {"type": "number"},
                                            "price": {"type": "number"},
                                            "total": {"type": "number"},
                                            "fees": {"type": "number"},
                                        },
                                    },
                                }
                            }
                        },
                    },
                    "401": {"description": "Unauthorized"},
                },
            }
        },
    )


# Register Swagger documentation
register_investment_swagger_docs()


@investment_bp.route("/portfolio/summary", methods=["GET"])
@jwt_required()
def get_portfolio_summary():
    user_id = get_jwt_identity()
    account_id = request.args.get("account_id", type=int)
    summary = investment_service.get_portfolio_summary(user_id, account_id)
    return jsonify(summary)


@investment_bp.route("/portfolio/performance", methods=["GET"])
@jwt_required()
def get_portfolio_performance():
    user_id = get_jwt_identity()
    period = request.args.get("period", "1Y")
    performance = investment_service.get_portfolio_performance(user_id, period)
    return jsonify(performance)


@investment_bp.route("/assets/<symbol>/transactions", methods=["GET"])
@jwt_required()
def get_asset_transactions(symbol: str):
    user_id = get_jwt_identity()
    transactions = investment_service.get_asset_transactions(user_id, symbol)
    return jsonify(transactions)
