from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.transaction_service import TransactionService
from app.schemas import TransactionSchema
from flask import request

transaction_ns = Namespace('transactions', description='Transaction operations')
transaction_service = TransactionService()
transaction_schema = TransactionSchema()

# Define models
transaction_model = transaction_ns.model('Transaction', {
    'date': fields.String(required=True, description='Transaction date'),
    'date_accountability': fields.String(required=True, description='Accountability date'),
    'description': fields.String(required=True, description='Transaction description'),
    'amount': fields.Float(required=True, description='Transaction amount'),
    'from_account_id': fields.Integer(required=True, description='Source account ID'),
    'to_account_id': fields.Integer(required=True, description='Destination account ID'),
    'type': fields.String(required=True, description='Transaction type', enum=['expense', 'income', 'transfer']),
    'category': fields.String(description='Transaction category'),
    'subcategory': fields.String(description='Transaction subcategory')
})

@transaction_ns.route('/')
class TransactionList(Resource):
    @transaction_ns.doc('list_transactions')
    @jwt_required()
    def get(self):
        """List all transactions"""
        user_id = get_jwt_identity()
        account_id = request.args.get('account_id', type=int)
        filters = {}
        if account_id:
            filters['account_id'] = account_id
            
        print(f"Getting transactions for user {user_id} with filters {filters}")  # Add this log
        result = transaction_service.get_all(user_id, 1, 1000, filters, None, None, None)
        print(f"Got transactions result: {result}")  # Add this log
        return result

    @transaction_ns.doc('create_transaction')
    @transaction_ns.expect(transaction_model)
    @jwt_required()
    def post(self):
        """Create a new transaction"""
        data = transaction_ns.payload
        data['user_id'] = get_jwt_identity()
        return transaction_service.create(data)

# Add any transaction-specific routes here

