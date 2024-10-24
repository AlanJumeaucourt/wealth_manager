from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.budget_service import get_budget_summary
from typing import Dict, Any
from flask import request

budget_ns = Namespace('budgets', description='Budget operations')

# Define models
budget_params = budget_ns.model('BudgetParams', {
    'start_date': fields.String(required=True, description='Start date (YYYY-MM-DD)'),
    'end_date': fields.String(required=True, description='End date (YYYY-MM-DD)')
})

budget_subcategory = budget_ns.model('BudgetSubcategory', {
    'subcategory': fields.String(description='Subcategory name'),
    'amount': fields.Float(description='Total amount for subcategory'),
    'transactions_related': fields.List(fields.String, description='Related transaction IDs')
})

budget_category = budget_ns.model('BudgetCategory', {
    'category': fields.String(description='Category name'),
    'amount': fields.Float(description='Total amount for category'),
    'subcategories': fields.List(fields.Nested(budget_subcategory), description='Subcategories')
})

budget_summary = budget_ns.model('BudgetSummary', {
    'categories': fields.List(fields.Nested(budget_category), description='Budget categories')
})

@budget_ns.route('/summary')
class BudgetSummary(Resource):
    @budget_ns.doc('get_budget_summary')
    @budget_ns.param('start_date', 'Start date (YYYY-MM-DD)')
    @budget_ns.param('end_date', 'End date (YYYY-MM-DD)')
    @budget_ns.response(200, 'Success', budget_summary)
    @budget_ns.response(400, 'Invalid parameters')
    @jwt_required()
    def get(self) -> Dict[str, Any]:
        """Get budget summary for a date range"""
        user_id = get_jwt_identity()
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        if not start_date or not end_date:
            return {"error": "Both start_date and end_date are required"}, 400

        try:
            summary = get_budget_summary(start_date, end_date, user_id)
            return {"categories": summary}, 200
        except ValueError as e:
            return {"error": str(e)}, 400
        except Exception as e:
            return {"error": "Failed to get budget summary"}, 500
