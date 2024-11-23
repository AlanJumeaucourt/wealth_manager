from app.models import Asset
from app.services.base_service import BaseService


class AssetService(BaseService):
    def __init__(self):
        super().__init__("assets", Asset)
