from app.models import Bank
from app.services.base_service import BaseService


class BankService(BaseService):
    def __init__(self) -> None:
        super().__init__(table_name="banks", model_class=Bank)

    # Add any bank-specific methods here
