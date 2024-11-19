from app.routes.base_routes import BaseRoutes
from app.services.asset_service import AssetService
from app.schemas import AssetSchema

asset_routes = BaseRoutes('asset', AssetService(), AssetSchema())
asset_bp = asset_routes.bp
