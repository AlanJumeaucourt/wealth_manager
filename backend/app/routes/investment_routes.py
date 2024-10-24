from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.investment_service import InvestmentService
from app.schemas import InvestmentTransactionSchema
from flask import request  # Add this import

investment_ns = Namespace('investments', description='Investment operations')
investment_service = InvestmentService()
investment_schema = InvestmentTransactionSchema()

# Define models
investment_model = investment_ns.model('InvestmentTransaction', {
    'account_id': fields.Integer(required=True, description='Account ID'),
    'asset_symbol': fields.String(required=True, description='Asset symbol'),
    'asset_name': fields.String(required=True, description='Asset name'),
    'activity_type': fields.String(required=True, description='Activity type', enum=['buy', 'sell', 'deposit', 'withdrawal']),
    'date': fields.DateTime(required=True, description='Transaction date'),
    'quantity': fields.Float(required=True, description='Quantity'),
    'unit_price': fields.Float(required=True, description='Unit price'),
    'fee': fields.Float(required=True, description='Transaction fee'),
    'tax': fields.Float(required=True, description='Transaction tax')
})

@investment_ns.route('/')
class InvestmentList(Resource):
    @investment_ns.doc('list_investments')
    @jwt_required()
    def get(self):
        """List all investments"""
        user_id = get_jwt_identity()
        return investment_service.get_all(user_id, 1, 1000, {}, None, None, None)

@investment_ns.route('/portfolio/summary')
class PortfolioSummary(Resource):
    @investment_ns.doc('get_portfolio_summary')
    @jwt_required()
    def get(self):
        """Get portfolio summary"""
        user_id = get_jwt_identity()
        account_id = request.args.get('account_id', type=int)  # Changed this line
        return investment_service.get_portfolio_summary(user_id, account_id)

@investment_ns.route('/portfolio/performance')
class PortfolioPerformance(Resource):
    @investment_ns.doc('get_portfolio_performance')
    @investment_ns.param('period', 'Performance period (e.g., 1Y, 6M)')
    @jwt_required()
    def get(self):
        """Get portfolio performance"""
        user_id = get_jwt_identity()
        period = request.args.get('period', '1Y')  # Changed this line
        return investment_service.get_portfolio_performance(user_id, period)

@investment_ns.route('/assets/<symbol>/transactions')
@investment_ns.param('symbol', 'The asset symbol')
class AssetTransactions(Resource):
    @investment_ns.doc('get_asset_transactions')
    @jwt_required()
    def get(self, symbol: str):
        """Get transactions for a specific asset"""
        user_id = get_jwt_identity()
        return investment_service.get_asset_transactions(user_id, symbol)
