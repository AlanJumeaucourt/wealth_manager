from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.routes.base_routes import BaseRoutes, ListQueryParams
from app.schemas.schema_registry import (
    InvestmentDetailsSchema,
    InvestmentTransactionSchema,
)
from app.services.investment_service import InvestmentService
from app.swagger import spec

investment_service = InvestmentService()


# Create a custom routes class to handle different schemas for different operations
class InvestmentRoutes(BaseRoutes):
    def __init__(self, blueprint_name: str, service: InvestmentService):
        super().__init__(blueprint_name, service, InvestmentDetailsSchema())
        self.list_schema = InvestmentTransactionSchema()

    @jwt_required()
    def get_all(self):
        user_id = get_jwt_identity()

        # Extract query parameters using the list schema instead of the default schema
        filters = {
            field: request.args.get(field)
            for field in self.list_schema.fields
            if field in request.args
        }

        # Create ListQueryParams object
        query_params = ListQueryParams(
            page=int(request.args.get("page", 1)),
            per_page=int(request.args.get("per_page", 10)),
            filters=filters,
            sort_by=request.args.get("sort_by"),
            sort_order=request.args.get("sort_order"),
            fields=(
                request.args.get("fields", "").split(",")
                if request.args.get("fields")
                else None
            ),
            search=request.args.get("search"),
        )

        results = self.service.get_all(user_id, query_params)
        return jsonify(results)


investment_routes = InvestmentRoutes("investment", investment_service)
investment_bp = investment_routes.bp


def register_investment_swagger_docs():
    """Register Swagger documentation for custom investment endpoints"""

    # Document portfolio summary endpoint
    spec.path(
        path="/investments/portfolio/summary",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Get portfolio summary",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "account_id",
                        "in": "query",
                        "schema": {"type": "integer"},
                        "description": "Filter by account ID",
                        "required": False,
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Portfolio summary",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "total_value": {"type": "number"},
                                        "total_cost": {"type": "number"},
                                        "total_gain": {"type": "number"},
                                        "total_gain_percent": {"type": "number"},
                                        "assets": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "symbol": {"type": "string"},
                                                    "name": {"type": "string"},
                                                    "quantity": {"type": "number"},
                                                    "current_price": {"type": "number"},
                                                    "current_value": {"type": "number"},
                                                    "cost_basis": {"type": "number"},
                                                    "gain": {"type": "number"},
                                                    "gain_percent": {"type": "number"},
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
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
                "summary": "Get portfolio performance over time",
                "security": [{"bearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Portfolio performance data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "date": {"type": "string", "format": "date"},
                                            "value": {"type": "number"},
                                            "change": {"type": "number"},
                                            "change_percent": {"type": "number"},
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )

    # Document risk metrics endpoint
    spec.path(
        path="/investments/portfolio/risk-metrics",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Get portfolio risk metrics",
                "description": "Get portfolio risk metrics including volatility, Sharpe ratio, etc.",
                "security": [{"bearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Portfolio risk metrics",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "volatility": {"type": "number"},
                                        "sharpe_ratio": {"type": "number"},
                                        "beta": {"type": "number"},
                                        "alpha": {"type": "number"},
                                        "max_drawdown": {"type": "number"},
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )

    # Document portfolio analysis endpoint
    spec.path(
        path="/investments/portfolio/analysis",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Get detailed portfolio analysis",
                "description": "Get detailed portfolio analysis including sector allocation, asset classes, etc.",
                "security": [{"bearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Portfolio analysis data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "sector_allocation": {
                                            "type": "object",
                                            "additionalProperties": {"type": "number"},
                                        },
                                        "asset_class_allocation": {
                                            "type": "object",
                                            "additionalProperties": {"type": "number"},
                                        },
                                        "geographic_allocation": {
                                            "type": "object",
                                            "additionalProperties": {"type": "number"},
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )

    # Document performance attribution endpoint
    spec.path(
        path="/investments/portfolio/attribution",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Get performance attribution analysis",
                "security": [{"bearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Performance attribution data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "asset_attribution": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "symbol": {"type": "string"},
                                                    "name": {"type": "string"},
                                                    "contribution": {"type": "number"},
                                                    "weight": {"type": "number"},
                                                },
                                            },
                                        },
                                        "sector_attribution": {
                                            "type": "object",
                                            "additionalProperties": {"type": "number"},
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
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
                "summary": "Get transactions for a specific asset",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "symbol",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Asset symbol (e.g., AAPL, GOOGL)",
                    },
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
                                            "date": {"type": "string", "format": "date"},
                                            "type": {"type": "string", "enum": ["buy", "sell"]},
                                            "shares": {"type": "number"},
                                            "price": {"type": "number"},
                                            "fees": {"type": "number"},
                                            "total": {"type": "number"},
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                },
            }
        },
    )

    # Document asset analysis endpoint
    spec.path(
        path="/investments/assets/{symbol}/analysis",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Get analysis for a specific asset",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "symbol",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"},
                        "description": "Asset symbol (e.g., AAPL, GOOGL)",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Asset analysis",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "average_cost": {"type": "number"},
                                        "current_price": {"type": "number"},
                                        "total_shares": {"type": "number"},
                                        "total_value": {"type": "number"},
                                        "total_gain": {"type": "number"},
                                        "total_gain_percent": {"type": "number"},
                                        "performance": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "date": {"type": "string", "format": "date"},
                                                    "price": {"type": "number"},
                                                    "value": {"type": "number"},
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "404": {"description": "Asset not found"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )

    # Document portfolio correlation endpoint
    spec.path(
        path="/investments/portfolio/correlation",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Get correlation matrix for portfolio assets",
                "security": [{"bearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Portfolio correlation matrix",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "assets": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                        },
                                        "correlation": {
                                            "type": "array",
                                            "items": {
                                                "type": "array",
                                                "items": {"type": "number"},
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )

    # Document benchmark comparison endpoint
    spec.path(
        path="/investments/portfolio/benchmarks",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Compare portfolio performance against benchmarks",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "benchmarks",
                        "in": "query",
                        "schema": {"type": "string"},
                        "description": "Comma-separated list of benchmark symbols (e.g., SPY,QQQ)",
                        "required": False,
                    },
                    {
                        "name": "period",
                        "in": "query",
                        "schema": {"type": "string", "enum": ["1m", "3m", "6m", "1y", "3y", "5y", "max"]},
                        "description": "Time period for comparison",
                        "required": False,
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Benchmark comparison data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "portfolio": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "date": {"type": "string", "format": "date"},
                                                    "value": {"type": "number"},
                                                },
                                            },
                                        },
                                        "benchmarks": {
                                            "type": "object",
                                            "additionalProperties": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "date": {"type": "string", "format": "date"},
                                                        "value": {"type": "number"},
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )

    # Document dividend analysis endpoint
    spec.path(
        path="/investments/portfolio/dividend-analysis",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Get dividend analysis for the portfolio",
                "security": [{"bearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Dividend analysis data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "annual_income": {"type": "number"},
                                        "yield": {"type": "number"},
                                        "payout_ratio": {"type": "number"},
                                        "growth_rate": {"type": "number"},
                                        "monthly_breakdown": {
                                            "type": "object",
                                            "additionalProperties": {"type": "number"},
                                        },
                                        "assets": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "symbol": {"type": "string"},
                                                    "name": {"type": "string"},
                                                    "annual_dividend": {"type": "number"},
                                                    "yield": {"type": "number"},
                                                    "contribution": {"type": "number"},
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )

    # Document rebalancing suggestions endpoint
    spec.path(
        path="/investments/portfolio/rebalancing",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Get portfolio rebalancing suggestions",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "target_allocation",
                        "in": "query",
                        "schema": {"type": "string"},
                        "description": "JSON string of target allocations by symbol or asset class",
                        "required": False,
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Rebalancing suggestions",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "current_allocation": {
                                            "type": "object",
                                            "additionalProperties": {"type": "number"},
                                        },
                                        "target_allocation": {
                                            "type": "object",
                                            "additionalProperties": {"type": "number"},
                                        },
                                        "suggestions": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "symbol": {"type": "string"},
                                                    "name": {"type": "string"},
                                                    "action": {"type": "string", "enum": ["buy", "sell", "hold"]},
                                                    "shares": {"type": "number"},
                                                    "amount": {"type": "number"},
                                                    "current_allocation": {"type": "number"},
                                                    "target_allocation": {"type": "number"},
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )

    # Document tax analysis endpoint
    spec.path(
        path="/investments/portfolio/tax-analysis",
        operations={
            "get": {
                "tags": ["Investment"],
                "summary": "Get tax analysis for the portfolio",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "tax_year",
                        "in": "query",
                        "schema": {"type": "integer"},
                        "description": "Tax year to analyze",
                        "required": False,
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Tax analysis data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "realized_gains": {
                                            "type": "object",
                                            "properties": {
                                                "short_term": {"type": "number"},
                                                "long_term": {"type": "number"},
                                                "total": {"type": "number"},
                                            },
                                        },
                                        "dividend_income": {"type": "number"},
                                        "tax_lots": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "symbol": {"type": "string"},
                                                    "purchase_date": {"type": "string", "format": "date"},
                                                    "shares": {"type": "number"},
                                                    "cost_basis": {"type": "number"},
                                                    "current_value": {"type": "number"},
                                                    "unrealized_gain": {"type": "number"},
                                                    "long_term": {"type": "boolean"},
                                                },
                                            },
                                        },
                                        "tax_harvesting_opportunities": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "symbol": {"type": "string"},
                                                    "name": {"type": "string"},
                                                    "loss": {"type": "number"},
                                                    "tax_benefit": {"type": "number"},
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "500": {"description": "Server error"},
                },
            }
        },
    )


# Custom routes for investment operations
@investment_bp.route("/", methods=["POST"])
@jwt_required()
def create_investment():
    user_id = get_jwt_identity()
    data = request.get_json()
    data["user_id"] = user_id
    result = investment_service.create(data)
    return jsonify(result), 201


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
    performance = investment_service.get_portfolio_performance(user_id)
    return jsonify(performance)


@investment_bp.route("/portfolio/risk-metrics", methods=["GET"])
@jwt_required()
def get_risk_metrics():
    """Get portfolio risk metrics including volatility, Sharpe ratio, etc."""
    user_id = get_jwt_identity()
    risk_metrics = investment_service.get_risk_metrics(user_id)
    return jsonify(risk_metrics)


@investment_bp.route("/portfolio/analysis", methods=["GET"])
@jwt_required()
def get_portfolio_analysis():
    """Get detailed portfolio analysis including sector allocation, asset classes, etc."""
    user_id = get_jwt_identity()
    analysis = investment_service.get_portfolio_analysis(user_id)
    return jsonify(analysis)


# Register Swagger documentation
register_investment_swagger_docs()


@investment_bp.route("/portfolio/attribution", methods=["GET"])
@jwt_required()
def get_performance_attribution():
    """Get performance attribution analysis."""
    user_id = get_jwt_identity()
    attribution = investment_service.get_performance_attribution(user_id)
    return jsonify(attribution)


@investment_bp.route("/portfolio/dividend-analysis", methods=["GET"])
@jwt_required()
def get_dividend_analysis():
    """Get dividend analysis including history, yield, and projections."""
    user_id = get_jwt_identity()
    analysis = investment_service.get_dividend_analysis(user_id)
    return jsonify(analysis)


@investment_bp.route("/portfolio/correlation", methods=["GET"])
@jwt_required()
def get_portfolio_correlation():
    """Get correlation analysis between portfolio assets."""
    user_id = get_jwt_identity()
    correlation = investment_service.get_portfolio_correlation(user_id)
    return jsonify(correlation)


@investment_bp.route("/portfolio/rebalancing", methods=["GET"])
@jwt_required()
def get_rebalancing_suggestions():
    """Get portfolio rebalancing suggestions."""
    user_id = get_jwt_identity()
    target_allocation = request.args.get(
        "target_allocation"
    )  # Optional JSON string of target allocations
    suggestions = investment_service.get_rebalancing_suggestions(
        user_id, target_allocation
    )
    return jsonify(suggestions)


@investment_bp.route("/assets/<symbol>/transactions", methods=["GET"])
@jwt_required()
def get_asset_transactions(symbol: str):
    user_id = get_jwt_identity()
    transactions = investment_service.get_asset_transactions(user_id, symbol)
    return jsonify(transactions)


@investment_bp.route("/assets/<symbol>/analysis", methods=["GET"])
@jwt_required()
def get_asset_analysis(symbol: str):
    """Get detailed analysis for a specific asset."""
    user_id = get_jwt_identity()
    period = request.args.get("period", "1Y")
    analysis = investment_service.get_asset_analysis(user_id, symbol, period)
    return jsonify(analysis)


@investment_bp.route("/portfolio/tax-analysis", methods=["GET"])
@jwt_required()
def get_tax_analysis():
    """Get tax analysis including realized/unrealized gains."""
    user_id = get_jwt_identity()
    year = request.args.get("year", type=int)  # Optional specific year
    analysis = investment_service.get_tax_analysis(user_id, year)
    return jsonify(analysis)


@investment_bp.route("/portfolio/benchmarks", methods=["GET"])
@jwt_required()
def get_benchmark_comparison():
    """Get comparison against multiple benchmarks."""
    user_id = get_jwt_identity()
    period = request.args.get("period", "1Y")
    benchmarks = request.args.get("benchmarks", "^GSPC,^DJI").split(
        ","
    )  # Default to S&P 500 and Dow Jones
    comparison = investment_service.get_benchmark_comparison(
        user_id, period, benchmarks
    )
    return jsonify(comparison)
