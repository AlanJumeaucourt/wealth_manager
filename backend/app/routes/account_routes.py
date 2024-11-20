from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.routes.base_routes import BaseRoutes
from app.services.account_service import AccountService
from app.schemas import AccountSchema
from datetime import datetime

account_service = AccountService()
account_routes = BaseRoutes("account", account_service, AccountSchema())
account_bp = account_routes.bp

# Add any account-specific routes here


@account_bp.route("/balance_over_time", methods=["GET"])
@jwt_required()
def get_balance_over_time():
    user_id = get_jwt_identity()
    start_date = request.args.get("start_date", type=str)
    end_date = request.args.get("end_date", type=str)

    if not start_date or not end_date:
        return (
            jsonify({"error": "Start and end dates are required query parameters"}),
            400,
        )

    try:
        datetime.strptime(start_date, "%Y-%m-%d")
        datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    balance_over_time = account_service.sum_accounts_balances_over_days(
        user_id, start_date, end_date
    )
    return jsonify(balance_over_time)


@account_bp.route("/wealth", methods=["GET"])
@jwt_required()
def get_wealth():
    user_id = get_jwt_identity()
    wealth_data = account_service.get_wealth(user_id)
    return jsonify(wealth_data)


@account_bp.route("/<int:id>/balance", methods=["GET"])
@jwt_required()
def get_account_balance(id):
    user_id = get_jwt_identity()
    balance = account_service.get_account_balance(user_id, id)
    return jsonify(balance)
