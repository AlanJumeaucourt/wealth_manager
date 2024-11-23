from app.routes.base_routes import BaseRoutes
from app.schemas import AccountAssetSchema
from app.services.account_asset_service import AccountAssetService

account_asset_routes = BaseRoutes(
    "account_asset", AccountAssetService(), AccountAssetSchema()
)
account_asset_bp = account_asset_routes.bp

# Add any bank-specific routes here
