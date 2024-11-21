from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.routes.base_routes import BaseRoutes
from app.services.investment_service import InvestmentService
from app.schemas import InvestmentTransactionSchema

investment_service = InvestmentService()
investment_routes = BaseRoutes(
    "investment", investment_service, InvestmentTransactionSchema()
)
investment_bp = investment_routes.bp


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
