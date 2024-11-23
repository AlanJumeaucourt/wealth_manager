from app.models import Bank
from app.services.base_service import BaseService


class BankService(BaseService):
    def __init__(self):
        super().__init__("banks", Bank)

    # Add any bank-specific methods here
