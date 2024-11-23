from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..services.budget_service import get_budget_summary

budget_bp = Blueprint("budget", __name__)


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
