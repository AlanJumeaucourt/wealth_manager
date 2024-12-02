from datetime import datetime
from typing import TypedDict

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.swagger import spec

from ..category import (
    expense_categories,
    income_categories,
    transfer_categories,
)
from ..services.budget_service import (
    TransactionSummary,
    calculate_period_boundaries,
    get_budget_summary,
    get_next_period_start,
    get_transactions_by_categories,
)

budget_bp = Blueprint("budget", __name__)


class CategorySummary(TypedDict):
    total: float
    by_category: dict[str, TransactionSummary]


class BudgetCategorySummary(TypedDict):
    income: CategorySummary
    expense: CategorySummary
    transfer: CategorySummary


def register_budget_swagger_docs():
    # Document budget summary endpoint
    spec.path(
        path="/budgets/summary",
        operations={
            "get": {
                "tags": ["Budget"],
                "summary": "Get budget summary for a date range",
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
                        "description": "Budget summary data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "total": {"type": "number"},
                                        "income": {"type": "number"},
                                        "expense": {"type": "number"},
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

    # Document get all categories endpoint
    spec.path(
        path="/budgets/categories",
        operations={
            "get": {
                "tags": ["Budget"],
                "summary": "Get all available categories",
                "responses": {
                    "200": {
                        "description": "Categories grouped by type",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "expense": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                        },
                                        "income": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                        },
                                        "transfer": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                        },
                                    },
                                }
                            }
                        },
                    }
                },
            }
        },
    )

    # Document get categories by type endpoint
    spec.path(
        path="/budgets/categories/{category_type}",
        operations={
            "get": {
                "tags": ["Budget"],
                "summary": "Get categories for a specific type",
                "parameters": [
                    {
                        "name": "category_type",
                        "in": "path",
                        "required": True,
                        "schema": {
                            "type": "string",
                            "enum": ["expense", "income", "transfer"],
                        },
                        "description": "Category type",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "List of categories",
                        "content": {
                            "application/json": {
                                "schema": {"type": "array", "items": {"type": "string"}}
                            }
                        },
                    },
                    "400": {"description": "Invalid category type"},
                },
            }
        },
    )

    # Document category summary endpoint
    spec.path(
        path="/budgets/categories/summary",
        operations={
            "get": {
                "tags": ["Budget"],
                "summary": "Get transaction summary by categories",
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
                        "description": "Category summary data",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "income": {
                                            "type": "object",
                                            "properties": {
                                                "total": {"type": "number"},
                                                "by_category": {
                                                    "type": "object",
                                                    "additionalProperties": {
                                                        "type": "object",
                                                        "properties": {
                                                            "amount": {
                                                                "type": "number"
                                                            },
                                                            "count": {
                                                                "type": "integer"
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                        "expense": {
                                            "type": "object",
                                            "properties": {
                                                "total": {"type": "number"},
                                                "by_category": {
                                                    "type": "object",
                                                    "additionalProperties": {
                                                        "type": "object",
                                                        "properties": {
                                                            "amount": {
                                                                "type": "number"
                                                            },
                                                            "count": {
                                                                "type": "integer"
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                        "transfer": {
                                            "type": "object",
                                            "properties": {
                                                "total": {"type": "number"},
                                                "by_category": {
                                                    "type": "object",
                                                    "additionalProperties": {
                                                        "type": "object",
                                                        "properties": {
                                                            "amount": {
                                                                "type": "number"
                                                            },
                                                            "count": {
                                                                "type": "integer"
                                                            },
                                                        },
                                                    },
                                                },
                                            },
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

    # Document budget summary by period endpoint
    spec.path(
        path="/budgets/summary/period",
        operations={
            "get": {
                "tags": ["Budget"],
                "summary": "Get budget summary broken down by time periods",
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
                    {
                        "name": "period",
                        "in": "query",
                        "required": True,
                        "schema": {
                            "type": "string",
                            "enum": ["week", "month", "quarter", "year"],
                        },
                        "description": "Time period for grouping",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Period-wise budget summary",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "period": {
                                            "type": "string",
                                            "enum": [
                                                "week",
                                                "month",
                                                "quarter",
                                                "year",
                                            ],
                                        },
                                        "summaries": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "start_date": {
                                                        "type": "string",
                                                        "format": "date",
                                                    },
                                                    "end_date": {
                                                        "type": "string",
                                                        "format": "date",
                                                    },
                                                    "income": {
                                                        "type": "object",
                                                        "properties": {
                                                            "total": {"type": "number"},
                                                            "by_category": {
                                                                "type": "object",
                                                                "additionalProperties": {
                                                                    "type": "object",
                                                                    "properties": {
                                                                        "amount": {
                                                                            "type": "number"
                                                                        },
                                                                        "count": {
                                                                            "type": "integer"
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                    "expense": {
                                                        "type": "object",
                                                        "properties": {
                                                            "total": {"type": "number"},
                                                            "by_category": {
                                                                "type": "object",
                                                                "additionalProperties": {
                                                                    "type": "object",
                                                                    "properties": {
                                                                        "amount": {
                                                                            "type": "number"
                                                                        },
                                                                        "count": {
                                                                            "type": "integer"
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                }
                            }
                        },
                    },
                    "400": {"description": "Invalid parameters or date format"},
                    "401": {"description": "Unauthorized"},
                },
            }
        },
    )


# Register Swagger documentation
register_budget_swagger_docs()


@budget_bp.route("/summary", methods=["GET"])
@jwt_required()
def budget_summary():
    user_id = get_jwt_identity()
    # Extract and validate query parameters
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date or not end_date:
        return jsonify({"error": "start_date and end_date are required"}), 400

    try:
        # Validate date format
        datetime.strptime(start_date, "%Y-%m-%d")
        datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    # Call the service function to get the budget summary
    total_amount = get_budget_summary(start_date, end_date, user_id)
    return jsonify(total_amount)


@budget_bp.route("/categories", methods=["GET"])
def get_all_categories():
    """Return all available categories grouped by type (expense, income, transfer)"""
    categories = {
        "expense": expense_categories,
        "income": income_categories,
        "transfer": transfer_categories,
    }
    return jsonify(categories)


@budget_bp.route("/categories/<category_type>", methods=["GET"])
def get_categories_by_type(category_type: str):
    """Return categories for a specific type (expense, income, or transfer)"""
    if category_type not in ["expense", "income", "transfer"]:
        return jsonify(
            {
                "error": "Invalid category type. Must be one of: expense, income, transfer"
            }
        ), 400

    category_map = {
        "expense": expense_categories,
        "income": income_categories,
        "transfer": transfer_categories,
    }

    return jsonify(category_map[category_type])


@budget_bp.route("/categories/summary", methods=["GET"])
@jwt_required()
def category_summary():
    user_id = get_jwt_identity()
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date or not end_date:
        return jsonify({"error": "start_date and end_date are required"}), 400

    try:
        datetime.strptime(start_date, "%Y-%m-%d")
        datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    income_data = get_transactions_by_categories(
        start_date, end_date, user_id, "income"
    )
    expense_data = get_transactions_by_categories(
        start_date, end_date, user_id, "expense"
    )
    transfer_data = get_transactions_by_categories(
        start_date, end_date, user_id, "transfer"
    )

    response: BudgetCategorySummary = {
        "income": {
            "total": {
                "net": sum(cat["net_amount"] for cat in income_data.values()),
                "original": sum(cat["original_amount"] for cat in income_data.values()),
            },
            "by_category": income_data,
        },
        "expense": {
            "total": {
                "net": sum(cat["net_amount"] for cat in expense_data.values()),
                "original": sum(cat["original_amount"] for cat in expense_data.values()),
            },
            "by_category": expense_data,
        },
        "transfer": {
            "total": {
                "net": sum(cat["net_amount"] for cat in transfer_data.values()),
                "original": sum(cat["original_amount"] for cat in transfer_data.values()),
            },
            "by_category": transfer_data,
        },
    }

    return jsonify(response)


@budget_bp.route("/summary/period", methods=["GET"])
@jwt_required()
def budget_summary_by_period():
    user_id = get_jwt_identity()
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    period = request.args.get("period")

    if not all([start_date, end_date, period]):
        return jsonify({"error": "start_date, end_date, and period are required"}), 400

    # Type check period before using it
    period = period if period in ("week", "month", "quarter", "year") else None
    if period is None:
        return jsonify(
            {"error": "period must be one of: week, month, quarter, year"}
        ), 400

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    if start > end:
        return jsonify({"error": "start_date must be before end_date"}), 400

    # Initialize the response data
    period_summaries = []

    # Get the aligned start date for the period
    current_start, _ = calculate_period_boundaries(start, period)

    # Generate summaries for each period
    while current_start < end:
        # Calculate period end based on the period type
        _, current_end = calculate_period_boundaries(current_start, period)

        # Get income and expense data separately
        income_data = get_transactions_by_categories(
            start_date=current_start.strftime("%Y-%m-%d"),
            end_date=current_end.strftime("%Y-%m-%d"),
            user_id=user_id,
            transaction_type="income",
        )
        expense_data = get_transactions_by_categories(
            start_date=current_start.strftime("%Y-%m-%d"),
            end_date=current_end.strftime("%Y-%m-%d"),
            user_id=user_id,
            transaction_type="expense",
        )

        period_summaries.append(
            {
                "start_date": current_start.strftime("%Y-%m-%d"),
                "end_date": current_end.strftime("%Y-%m-%d"),
                "income": {
                    "total": {
                        "net": sum(cat["net_amount"] for cat in income_data.values()),
                        "original": sum(cat["original_amount"] for cat in income_data.values()),
                    },
                    "by_category": income_data,
                },
                "expense": {
                    "total": {
                        "net": sum(cat["net_amount"] for cat in expense_data.values()),
                        "original": sum(cat["original_amount"] for cat in expense_data.values()),
                    },
                    "by_category": expense_data,
                },
            }
        )

        # Move to next period
        current_start = get_next_period_start(current_start, period)

    return jsonify({"period": period, "summaries": period_summaries})
