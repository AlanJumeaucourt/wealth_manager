from flask import jsonify

from app.exceptions import TransactionValidationError
from app.routes.base_routes import BaseRoutes
from app.schemas import TransactionSchema
from app.services.transaction_service import TransactionService

transaction_service = TransactionService()
transaction_routes = BaseRoutes("transaction", transaction_service, TransactionSchema())
transaction_bp = transaction_routes.bp


@transaction_bp.errorhandler(TransactionValidationError)
def handle_validation_error(error):
    return jsonify({"error": str(error)}), 422  # 422 Unprocessable Entity


# Add any transaction-specific routes here
