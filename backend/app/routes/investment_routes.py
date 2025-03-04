from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.routes.base_routes import BaseRoutes, ListQueryParams
from app.schemas.schema_registry import (
    InvestmentDetailsSchema,
    InvestmentTransactionSchema,
)
from app.services.investment_service import InvestmentService

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
