from app.services.base_service import BaseService
from app.models import Asset

class AssetService(BaseService):
    def __init__(self):
        super().__init__('assets', Asset)
