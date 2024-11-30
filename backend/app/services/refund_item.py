from app.models import RefundItem
from app.services.base_service import BaseService


class RefundItemService(BaseService):
    def __init__(self) -> None:
        super().__init__(table_name="refund_items", model_class=RefundItem)
