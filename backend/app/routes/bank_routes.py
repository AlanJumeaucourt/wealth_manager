from app.routes.base_routes import BaseRoutes
from app.services.bank_service import BankService
from app.schemas import BankSchema

bank_routes = BaseRoutes('bank', BankService(), BankSchema())
bank_bp = bank_routes.bp

# Add any bank-specific routes here