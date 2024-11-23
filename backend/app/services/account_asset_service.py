from app.models import AccountAsset
from app.services.base_service import BaseService


class AccountAssetService(BaseService):
    def __init__(self) -> None:
        super().__init__(table_name="account_assets", model_class=AccountAsset)
