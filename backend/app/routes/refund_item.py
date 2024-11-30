from app.routes.base_routes import BaseRoutes
from app.schemas import RefundItemSchema
from app.services.refund_item import RefundItemService

refund_item_routes = BaseRoutes(
    blueprint_name="refund_item",
    service=RefundItemService(),
    schema=RefundItemSchema(),
)
refund_item_bp = refund_item_routes.bp

# Add any refund-item-specific routes here
