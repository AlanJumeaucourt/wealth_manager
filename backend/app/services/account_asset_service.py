from app.models import AccountAsset
from app.services.base_service import BaseService


class AccountAssetService(BaseService):
    def __init__(self):
        super().__init__("account_assets", AccountAsset)
