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
    period = request.args.get("period", "1Y")
    performance = investment_service.get_portfolio_performance(user_id, period)
    return jsonify(performance)


@investment_bp.route("/assets/<symbol>/transactions", methods=["GET"])
@jwt_required()
def get_asset_transactions(symbol: str):
    user_id = get_jwt_identity()
    transactions = investment_service.get_asset_transactions(user_id, symbol)
    return jsonify(transactions)
