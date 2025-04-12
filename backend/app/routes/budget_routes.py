from datetime import datetime, timedelta
from typing import TypedDict

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.swagger import spec

from ..category import (
    expense_categories,
    income_categories,
    transfer_categories,
)
from ..database import DatabaseManager
from ..exceptions import NoResultFoundError
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
                    "400": {
                        "description": "Invalid date format, missing parameters, or start_date after end_date"
                    },
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
                "summary": "Get all available categories grouped by type",
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
                        "description": "Type of categories to retrieve",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "List of categories for the specified type",
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
                    "400": {
                        "description": "Invalid date format, missing parameters, or start_date after end_date"
                    },
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
                        "description": "Budget summary by period",
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
                                                            "total": {
                                                                "type": "object",
                                                                "properties": {
                                                                    "net": {
                                                                        "type": "number"
                                                                    },
                                                                    "original": {
                                                                        "type": "number"
                                                                    },
                                                                },
                                                            },
                                                            "by_category": {
                                                                "type": "object",
                                                                "additionalProperties": {
                                                                    "type": "object",
                                                                    "properties": {
                                                                        "net_amount": {
                                                                            "type": "number"
                                                                        },
                                                                        "original_amount": {
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
                                                            "total": {
                                                                "type": "object",
                                                                "properties": {
                                                                    "net": {
                                                                        "type": "number"
                                                                    },
                                                                    "original": {
                                                                        "type": "number"
                                                                    },
                                                                },
                                                            },
                                                            "by_category": {
                                                                "type": "object",
                                                                "additionalProperties": {
                                                                    "type": "object",
                                                                    "properties": {
                                                                        "net_amount": {
                                                                            "type": "number"
                                                                        },
                                                                        "original_amount": {
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
                    "400": {
                        "description": "Invalid parameters, date format, or start_date after end_date"
                    },
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
                "original": sum(
                    cat["original_amount"] for cat in expense_data.values()
                ),
            },
            "by_category": expense_data,
        },
        "transfer": {
            "total": {
                "net": sum(cat["net_amount"] for cat in transfer_data.values()),
                "original": sum(
                    cat["original_amount"] for cat in transfer_data.values()
                ),
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
                        "original": sum(
                            cat["original_amount"] for cat in income_data.values()
                        ),
                    },
                    "by_category": income_data,
                },
                "expense": {
                    "total": {
                        "net": sum(cat["net_amount"] for cat in expense_data.values()),
                        "original": sum(
                            cat["original_amount"] for cat in expense_data.values()
                        ),
                    },
                    "by_category": expense_data,
                },
            }
        )

        # Move to next period
        current_start = get_next_period_start(current_start, period)

    return jsonify({"period": period, "summaries": period_summaries})


@budget_bp.route("/budgets", methods=["POST"])
@jwt_required()
def create_budget():
    user_id = get_jwt_identity()
    data = request.get_json()

    # Validate required fields
    required_fields = ["category", "year", "month", "amount"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    # Validate year and month
    try:
        year = int(data["year"])
        month = int(data["month"])
        if year < 2000 or year > 3000 or month < 1 or month > 12:
            return jsonify({"error": "Invalid year or month value"}), 400
    except ValueError:
        return jsonify({"error": "Year and month must be integers"}), 400

    # Validate amount
    try:
        amount = float(data["amount"])
        if amount <= 0:
            return jsonify({"error": "Amount must be greater than zero"}), 400
    except ValueError:
        return jsonify({"error": "Amount must be a number"}), 400

    # Check if budget already exists
    db = DatabaseManager()
    check_query = """--sql
        SELECT id FROM budgets
        WHERE user_id = ? AND category = ? AND year = ? AND month = ?
    """
    try:
        existing = db.execute_select(
            query=check_query, params=[user_id, data["category"], year, month]
        )
        if existing:
            return jsonify(
                {"error": "Budget for this category and period already exists"}
            ), 409
    except NoResultFoundError:
        pass

    # Insert the new budget
    insert_query = """--sql
        INSERT INTO budgets (user_id, category, year, month, amount)
        VALUES (?, ?, ?, ?, ?)
    """
    db.execute_insert(
        query=insert_query, params=[user_id, data["category"], year, month, amount]
    )

    return jsonify({"message": "Budget created successfully"}), 201


@budget_bp.route("/budgets/<int:budget_id>", methods=["PUT"])
@jwt_required()
def update_budget(budget_id):
    user_id = get_jwt_identity()
    data = request.get_json()

    # Check if budget exists and belongs to user
    db = DatabaseManager()
    check_query = """--sql
        SELECT id FROM budgets
        WHERE id = ? AND user_id = ?
    """
    try:
        existing = db.execute_select(query=check_query, params=[budget_id, user_id])
        if not existing:
            return jsonify({"error": "Budget not found or not authorized"}), 404
    except NoResultFoundError:
        return jsonify({"error": "Budget not found or not authorized"}), 404

    # Validate amount
    if "amount" in data:
        try:
            amount = float(data["amount"])
            if amount <= 0:
                return jsonify({"error": "Amount must be greater than zero"}), 400
        except ValueError:
            return jsonify({"error": "Amount must be a number"}), 400
    else:
        return jsonify({"error": "Amount is required"}), 400

    # Update the budget
    update_query = """--sql
        UPDATE budgets
        SET amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    """
    db.execute_update(query=update_query, params=[amount, budget_id, user_id])

    return jsonify({"message": "Budget updated successfully"}), 200


@budget_bp.route("/budgets/<int:budget_id>", methods=["DELETE"])
@jwt_required()
def delete_budget(budget_id):
    user_id = get_jwt_identity()

    # Check if budget exists and belongs to user
    db = DatabaseManager()
    check_query = """--sql
        SELECT id FROM budgets
        WHERE id = ? AND user_id = ?
    """
    try:
        existing = db.execute_select(query=check_query, params=[budget_id, user_id])
        if not existing:
            return jsonify({"error": "Budget not found or not authorized"}), 404
    except NoResultFoundError:
        return jsonify({"error": "Budget not found or not authorized"}), 404

    # Delete the budget
    delete_query = """--sql
        DELETE FROM budgets
        WHERE id = ? AND user_id = ?
    """
    db.execute_delete(query=delete_query, params=[budget_id, user_id])

    return jsonify({"message": "Budget deleted successfully"}), 200


@budget_bp.route("/budgets", methods=["GET"])
@jwt_required()
def get_budgets():
    user_id = get_jwt_identity()

    # Get query parameters
    year = request.args.get("year")
    month = request.args.get("month")

    # Build query based on filters
    query = """--sql
        SELECT id, category, year, month, amount, created_at, updated_at
        FROM budgets
        WHERE user_id = ?
    """
    params = [user_id]

    if year:
        query += " AND year = ?"
        params.append(int(year))

    if month:
        query += " AND month = ?"
        params.append(int(month))

    query += " ORDER BY year DESC, month DESC, category"

    # Execute query
    db = DatabaseManager()
    try:
        budgets = db.execute_select(query=query, params=params)
    except NoResultFoundError:
        return jsonify([]), 200

    return jsonify(budgets), 200


@budget_bp.route("/budgets/compare", methods=["GET"])
@jwt_required()
def compare_budget_with_actual():
    user_id = get_jwt_identity()

    # Get query parameters
    year = request.args.get("year")
    month = request.args.get("month")

    if not year or not month:
        return jsonify({"error": "Year and month are required"}), 400

    try:
        year = int(year)
        month = int(month)
    except ValueError:
        return jsonify({"error": "Year and month must be integers"}), 400

    # Create date range for the month
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    end_date = (datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=1)).strftime(
        "%Y-%m-%d"
    )

    # Get budgets for the month
    db = DatabaseManager()
    budget_query = """--sql
        SELECT category, amount
        FROM budgets
        WHERE user_id = ? AND year = ? AND month = ?
    """

    try:
        budgets = db.execute_select(budget_query, [user_id, year, month])
    except NoResultFoundError:
        budgets = []

    # Get actual spending for the month
    expense_query = """--sql
        WITH transaction_refunds AS (
            SELECT
                t.id as transaction_id,
                COALESCE(SUM(r.amount), 0) as refunded_amount
            FROM transactions t
            LEFT JOIN refund_items r ON t.id = r.expense_transaction_id
            WHERE t.type = 'expense'
            GROUP BY t.id
        )
        SELECT
            t.category,
            SUM(t.amount - COALESCE(tr.refunded_amount, 0)) as net_amount
        FROM transactions t
        LEFT JOIN transaction_refunds tr ON t.id = tr.transaction_id
        WHERE
            t.user_id = ?
            AND t.type = 'expense'
            AND t.date_accountability BETWEEN ? AND ?
        GROUP BY t.category
    """

    try:
        expenses = db.execute_select(expense_query, [user_id, start_date, end_date])
    except NoResultFoundError:
        expenses = []

    # Create a map of expenses by category
    expense_map = {expense["category"]: expense["net_amount"] for expense in expenses}

    # Combine budget and actual data
    result = []
    for budget in budgets:
        category = budget["category"]
        actual_amount = round(expense_map.get(category, 0),2)
        result.append(
            {
                "category": category,
                "budgeted": budget["amount"],
                "actual": round(actual_amount,2),
                "difference": budget["amount"] - actual_amount,
                "percentage": (actual_amount / budget["amount"] * 100)
                if budget["amount"] > 0
                else 0,
            }
        )

    # Add categories with expenses but no budget
    for category, amount in expense_map.items():
        if not any(b["category"] == category for b in budgets):
            result.append(
                {
                    "category": category,
                    "budgeted": 0,
                    "actual": round(amount,2),
                    "difference": -round(amount,2),
                    "percentage": 100,  # Over budget by 100%
                }
            )

    return jsonify(result), 200


# Update Swagger documentation
def update_budget_swagger_docs():
    # Document create budget endpoint
    spec.path(
        path="/budgets/budgets",
        operations={
            "post": {
                "tags": ["Budget"],
                "summary": "Create a new budget",
                "security": [{"bearerAuth": []}],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["category", "year", "month", "amount"],
                                "properties": {
                                    "category": {"type": "string"},
                                    "year": {"type": "integer"},
                                    "month": {"type": "integer"},
                                    "amount": {"type": "number"},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "201": {"description": "Budget created successfully"},
                    "400": {"description": "Invalid input data"},
                    "401": {"description": "Unauthorized"},
                    "409": {"description": "Budget already exists"},
                },
            },
            "get": {
                "tags": ["Budget"],
                "summary": "Get all budgets for the user",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "year",
                        "in": "query",
                        "schema": {"type": "integer"},
                        "description": "Filter by year",
                    },
                    {
                        "name": "month",
                        "in": "query",
                        "schema": {"type": "integer"},
                        "description": "Filter by month",
                    },
                ],
                "responses": {
                    "200": {"description": "List of budgets"},
                    "401": {"description": "Unauthorized"},
                },
            },
        },
    )

    # Document update, delete budget endpoints
    spec.path(
        path="/budgets/budgets/{budget_id}",
        operations={
            "put": {
                "tags": ["Budget"],
                "summary": "Update an existing budget",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "budget_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "Budget ID",
                    }
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["amount"],
                                "properties": {
                                    "amount": {"type": "number"},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "200": {"description": "Budget updated successfully"},
                    "400": {"description": "Invalid input data"},
                    "401": {"description": "Unauthorized"},
                    "404": {"description": "Budget not found"},
                },
            },
            "delete": {
                "tags": ["Budget"],
                "summary": "Delete a budget",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "budget_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "Budget ID",
                    }
                ],
                "responses": {
                    "200": {"description": "Budget deleted successfully"},
                    "401": {"description": "Unauthorized"},
                    "404": {"description": "Budget not found"},
                },
            },
        },
    )

    # Document budget comparison endpoint
    spec.path(
        path="/budgets/budgets/compare",
        operations={
            "get": {
                "tags": ["Budget"],
                "summary": "Compare budget with actual spending",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "year",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "Year",
                    },
                    {
                        "name": "month",
                        "in": "query",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "Month",
                    },
                ],
                "responses": {
                    "200": {"description": "Budget comparison data"},
                    "400": {"description": "Invalid input parameters"},
                    "401": {"description": "Unauthorized"},
                },
            },
        },
    )


# Register additional Swagger documentation
update_budget_swagger_docs()
