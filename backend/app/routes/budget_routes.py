from datetime import datetime
from typing import TypedDict

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..category import (
    expense_categories,
    income_categories,
    transfer_categories,
)
from ..services.budget_service import (
    TransactionSummary,
    get_budget_summary,
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

    # You'll need to implement these service functions
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
            "total": sum(cat["amount"] for cat in income_data.values()),
            "by_category": income_data,
        },
        "expense": {
            "total": sum(cat["amount"] for cat in expense_data.values()),
            "by_category": expense_data,
        },
        "transfer": {
            "total": sum(cat["amount"] for cat in transfer_data.values()),
            "by_category": transfer_data,
        },
    }

    return jsonify(response)
