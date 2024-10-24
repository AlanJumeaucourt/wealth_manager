from flask_restx import Namespace, Resource, fields
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.bank_service import BankService
from app.schemas import BankSchema

bank_ns = Namespace('banks', description='Bank operations')
bank_service = BankService()
bank_schema = BankSchema()

# Define models
bank_model = bank_ns.model('Bank', {
    'name': fields.String(required=True, description='The bank name'),
    'user_id': fields.Integer(required=True, description='The user ID')
})

@bank_ns.route('/')
class BankList(Resource):
    @bank_ns.doc('list_banks')
    @jwt_required()
    def get(self):
        """List all banks"""
        user_id = get_jwt_identity()
        # Provide default values for page, per_page, filters, sort_by, sort_order, and fields
        return bank_service.get_all(user_id, 1, 1000, {}, None, None, None)

    @bank_ns.doc('create_bank')
    @bank_ns.expect(bank_model)
    @jwt_required()
    def post(self):
        """Create a new bank"""
        data = bank_ns.payload
        data['user_id'] = get_jwt_identity()
        return bank_service.create(data)

@bank_ns.route('/<int:id>')
@bank_ns.param('id', 'The bank identifier')
class Bank(Resource):
    @bank_ns.doc('get_bank')
    @jwt_required()
    def get(self, id: int):
        """Get a bank by ID"""
        return bank_service.get_by_id(id)

    @bank_ns.doc('update_bank')
    @bank_ns.expect(bank_model)
    @jwt_required()
    def put(self, id: int):
        """Update a bank"""
        return bank_service.update(id, bank_ns.payload)

    @bank_ns.doc('delete_bank')
    @jwt_required()
    def delete(self, id: int):
        """Delete a bank"""
        return bank_service.delete(id)
