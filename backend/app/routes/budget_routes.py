from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from typing import TypedDict, List

from ..services.budget_service import get_budget_summary
from ..category import expense_categories, income_categories, transfer_categories

budget_bp = Blueprint("budget", __name__)

class TransactionSummary(TypedDict):
    amount: float
    count: int
    transactions: List[dict]  # You'll need to define the actual transaction structure

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
    # Extract query parameters from the request
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    # Call the service function to get the budget summary
    total_amount = get_budget_summary(start_date, end_date, user_id)

    # Return the result as a JSON response
    return jsonify(total_amount)

@budget_bp.route("/categories", methods=["GET"])
@jwt_required()
def category_summary():
    user_id = get_jwt_identity()
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

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
            "by_category": income_data
        },
        "expense": {
            "total": sum(cat["amount"] for cat in expense_data.values()),
            "by_category": expense_data
        },
        "transfer": {
            "total": sum(cat["amount"] for cat in transfer_data.values()),
            "by_category": transfer_data
        }
    }

    return jsonify(response)
