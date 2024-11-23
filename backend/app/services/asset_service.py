from app.models import Asset
from app.services.base_service import BaseService


class AssetService(BaseService):
    def __init__(self) -> None:
        super().__init__(table_name="assets", model_class=Asset)
