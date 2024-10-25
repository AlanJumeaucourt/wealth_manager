from app.routes.base_routes import BaseRoutes
from app.services.transaction_service import TransactionService
from app.schemas import TransactionSchema

transaction_service = TransactionService()
transaction_routes = BaseRoutes('transaction', transaction_service, TransactionSchema())
transaction_bp = transaction_routes.bp

# Add any transaction-specific routes here

