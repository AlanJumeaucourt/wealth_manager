from app.routes.base_routes import BaseRoutes
from app.schemas.schema_registry import RefundGroupSchema
from app.services.refund_group import RefundGroupService

refund_group_routes = BaseRoutes(
    blueprint_name="refund_group",
    service=RefundGroupService(),
    schema=RefundGroupSchema(),
)
refund_group_bp = refund_group_routes.bp

# Add any refund-group-specific routes here
