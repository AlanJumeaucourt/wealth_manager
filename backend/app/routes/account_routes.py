from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.routes.base_routes import BaseRoutes
from app.services.account_service import AccountService
from app.schemas import AccountSchema
from datetime import datetime
from flask_restx import Namespace, Resource, fields

account_service = AccountService()
account_routes = BaseRoutes('account', account_service, AccountSchema())
account_bp = account_routes.bp

account_ns = Namespace('accounts', description='Account operations')

# Define models
account_model = account_ns.model('Account', {
    'name': fields.String(required=True, description='Account name'),
    'type': fields.String(required=True, description='Account type', enum=['checking', 'savings', 'investment', 'expense', 'income']),
    'bank_id': fields.Integer(required=True, description='Bank ID'),
    'currency': fields.String(required=True, description='Currency code'),
    'tags': fields.List(fields.String, description='Account tags')
})

@account_bp.route('/', methods=['POST'])
@jwt_required()
def create_account():
    return account_routes.create()  # Ensure this is correctly calling the create method

@account_bp.route('/balance_over_time', methods=['GET'])
@jwt_required()
def get_balance_over_time():
    user_id = get_jwt_identity()
    start_date = request.args.get('start_date', type=str)
    end_date = request.args.get('end_date', type=str)
    
    if not start_date or not end_date:
        return jsonify({"error": "Start and end dates are required query parameters"}), 400
    
    try:
        datetime.strptime(start_date, '%Y-%m-%d')
        datetime.strptime(end_date, '%Y-%m-%d')
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    balance_over_time = account_service.sum_accounts_balances_over_days(user_id, start_date, end_date)
    return jsonify(balance_over_time)

@account_bp.route('/wealth', methods=['GET'])
@jwt_required()
def get_wealth():
    user_id = get_jwt_identity()
    wealth_data = account_service.get_wealth(user_id)
    return jsonify(wealth_data)

@account_ns.route('/')
class AccountList(Resource):
    @account_ns.doc('list_accounts')
    @jwt_required()
    def get(self):
        """List all accounts"""
        user_id = get_jwt_identity()
        # Provide default values for page, per_page, filters, sort_by, sort_order, and fields
        return account_service.get_all(user_id, 1, 1000, {}, None, None, None)

    @account_ns.doc('create_account')
    @account_ns.expect(account_model)
    @jwt_required()
    def post(self):
        """Create a new account"""
        data = account_ns.payload
        data['user_id'] = get_jwt_identity()
        return account_service.create(data)

@account_ns.route('/balance_over_time')
class AccountBalance(Resource):
    @account_ns.doc('get_balance_over_time')
    @account_ns.param('start_date', 'Start date (YYYY-MM-DD)')
    @account_ns.param('end_date', 'End date (YYYY-MM-DD)')
    @jwt_required()
    def get(self):
        """Get account balance over time"""
        user_id = get_jwt_identity()
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not start_date or not end_date:
            return {"error": "Start and end dates are required"}, 400
        
        try:
            datetime.strptime(start_date, '%Y-%m-%d')
            datetime.strptime(end_date, '%Y-%m-%d')
        except ValueError:
            return {"error": "Invalid date format. Use YYYY-MM-DD"}, 400

        return account_service.sum_accounts_balances_over_days(user_id, start_date, end_date)

@account_ns.route('/wealth')
class AccountWealth(Resource):
    @account_ns.doc('get_wealth')
    @jwt_required()
    def get(self):
        """Get wealth summary"""
        user_id = get_jwt_identity()
        return account_service.get_wealth(user_id)
