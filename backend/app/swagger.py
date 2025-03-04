from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from flask_swagger_ui import get_swaggerui_blueprint

from .schemas.schema_registry import register_schemas

# Create an APISpec
spec = APISpec(
    title="WealthManager API",
    version="1.0.0",
    openapi_version="3.0.2",
    plugins=[MarshmallowPlugin()],
    info={
        "description": "API documentation for the WealthManager application",
        "contact": {"email": "support@wealthmanager.com"},
        "license": {"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
    },
    servers=[
        {
            "url": "http://localhost:5000",
            "description": "Development server",
        }
    ],
)

# Swagger UI configuration
SWAGGER_URL = "/api/docs"
API_URL = "/static/swagger.json"

# Create Swagger UI blueprint
swagger_ui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL,
    API_URL,
    config={
        "app_name": "WealthManager API",
        "deepLinking": True,
        "displayOperationId": True,
    },
)

# Define your API documentation
spec.components.schema(
    "Error",
    {
        "type": "object",
        "properties": {"code": {"type": "integer"}, "message": {"type": "string"}},
    },
)

# Add basic security scheme
spec.components.security_scheme(
    "bearerAuth",
    {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Enter your JWT token in the format: Bearer <token>",
    },
)

# Register all schemas
register_schemas(spec)
