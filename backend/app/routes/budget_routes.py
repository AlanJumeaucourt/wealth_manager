from flask import Blueprint, request, jsonify
from ..services.budget_service import get_budget_summary
from flask_jwt_extended import jwt_required, get_jwt_identity
budget_bp = Blueprint('budget', __name__)

@budget_bp.route('/summary', methods=['GET'])
@jwt_required()
def budget_summary():
    user_id = get_jwt_identity()
    # Extract query parameters from the request
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    # Call the service function to get the budget summary
    total_amount = get_budget_summary(start_date, end_date, user_id)

    # Return the result as a JSON response
    return jsonify(total_amount)

