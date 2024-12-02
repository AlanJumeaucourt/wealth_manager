from app.models import RefundGroup
from app.services.base_service import BaseService


class RefundGroupService(BaseService):
    def __init__(self) -> None:
        super().__init__(table_name="refund_groups", model_class=RefundGroup)
