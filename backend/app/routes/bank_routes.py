from app.routes.base_routes import BaseRoutes
from app.schemas import BankSchema
from app.services.bank_service import BankService

bank_routes = BaseRoutes(
    blueprint_name="bank", service=BankService(), schema=BankSchema()
)
bank_bp = bank_routes.bp

# Add any bank-specific routes here
