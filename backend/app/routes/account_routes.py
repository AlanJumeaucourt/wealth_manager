from datetime import datetime

from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.routes.base_routes import BaseRoutes
from app.schemas import AccountSchema
from app.services.account_service import AccountService
from app.swagger import spec

account_service = AccountService()
account_routes = BaseRoutes("account", account_service, AccountSchema())
account_bp = account_routes.bp


# Register custom Swagger documentation
def register_custom_swagger_docs():
    # Document balance_over_time endpoint
    spec.path(
        path="/accounts/balance_over_time",
        operations={
            "get": {
                "tags": ["Account"],
                "summary": "Get balance over time for all accounts",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "start_date",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "string", "format": "date"},
                        "description": "Start date in YYYY-MM-DD format",
                    },
                    {
                        "name": "end_date",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "string", "format": "date"},
                        "description": "End date in YYYY-MM-DD format",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Balance over time data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "date": {
                                                "type": "string",
                                                "format": "date",
                                            },
                                            "balance": {"type": "number"},
                                        },
                                    },
                                }
                            }
                        },
                    },
                    "400": {"description": "Invalid date format or missing parameters"},
                    "401": {"description": "Unauthorized"},
                },
            }
        },
    )

    # Document wealth endpoint
    spec.path(
        path="/accounts/wealth",
        operations={
            "get": {
                "tags": ["Account"],
                "summary": "Get total wealth information",
                "security": [{"bearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Wealth data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "total_wealth": {"type": "number"},
                                        "accounts": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "id": {"type": "integer"},
                                                    "name": {"type": "string"},
                                                    "balance": {"type": "number"},
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

    # Document account balance endpoint
    spec.path(
        path="/accounts/{id}/balance",
        operations={
            "get": {
                "tags": ["Account"],
                "summary": "Get balance for a specific account",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "Account ID",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Account balance",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {"balance": {"type": "number"}},
                                }
                            }
                        },
                    },
                    "401": {"description": "Unauthorized"},
                    "404": {"description": "Account not found"},
                },
            }
        },
    )

    # Document account balance over time endpoint
    spec.path(
        path="/accounts/{id}/balance_over_time",
        operations={
            "get": {
                "tags": ["Account"],
                "summary": "Get balance over time for a specific account",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "Account ID",
                    },
                    {
                        "name": "start_date",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "string", "format": "date"},
                        "description": "Start date in YYYY-MM-DD format",
                    },
                    {
                        "name": "end_date",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "string", "format": "date"},
                        "description": "End date in YYYY-MM-DD format",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Balance over time data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "date": {
                                                "type": "string",
                                                "format": "date",
                                            },
                                            "balance": {"type": "number"},
                                        },
                                    },
                                }
                            }
                        },
                    },
                    "400": {"description": "Invalid date format or missing parameters"},
                    "401": {"description": "Unauthorized"},
                    "404": {"description": "Account not found"},
                },
            }
        },
    )


# Register custom Swagger documentation
register_custom_swagger_docs()

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
def get_account_balance(id: int):
    user_id = get_jwt_identity()
    balance = account_service.get_account_balance(user_id, id)
    return jsonify(balance)


@account_bp.route("/<int:id>/balance_over_time", methods=["GET"])
@jwt_required()
def get_account_balance_over_time(id: int):
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
        user_id, start_date, end_date, account_id=id
    )
    return jsonify(balance_over_time)
