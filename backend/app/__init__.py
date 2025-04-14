import logging
import os
from datetime import timedelta

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from app.database import DatabaseManager
from app.logger import logger
from app.middleware import log_request, log_response
from app.swagger import API_URL, SWAGGER_URL, spec, swagger_ui_blueprint

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)


def create_app():
    db = DatabaseManager()
    db.create_tables()

    app = Flask(__name__)
    app.url_map.strict_slashes = False  # Add this line
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Register Swagger UI blueprint
    app.register_blueprint(swagger_ui_blueprint, url_prefix=SWAGGER_URL)

    # Create static directory if it doesn't exist
    os.makedirs(os.path.join(app.root_path, "static"), exist_ok=True)

    @app.route("/static/swagger.json")
    def create_swagger_spec():
        return jsonify(spec.to_dict())

    # Register logging middleware
    app.before_request(log_request)
    app.after_request(log_response)

    # Log application startup
    logger.info("Application starting up")

    # JWT Configuration
    app.config["JWT_SECRET_KEY"] = os.environ.get(
        "JWT_SECRET_KEY", "fallback-secret-key-for-development"
    )
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(
        seconds=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES", 3600))
    )
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(
        seconds=int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRES", 2592000))
    )
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_HEADER_NAME"] = "Authorization"
    app.config["JWT_HEADER_TYPE"] = "Bearer"

    jwt = JWTManager(app)

    app.config["JSONIFY_MIMETYPE"] = "application/json"

    # Register error handlers
    @app.errorhandler(Exception)
    def handle_exception(e):
        logger.error("Unhandled exception", exc_info=True)
        return {"error": str(e)}, 500

    # import and register blueprints
    from app.routes.account_routes import account_bp
    from app.routes.account_asset_routes import account_asset_bp
    from app.routes.asset_routes import asset_bp
    from app.routes.bank_routes import bank_bp
    from app.routes.budget_routes import budget_bp
    from app.routes.gocardless_routes import gocardless_bp
    from app.routes.investment_routes import investment_bp
    from app.routes.refund_group_routes import refund_group_bp
    from app.routes.refund_item_routes import refund_item_bp
    from app.routes.stock_routes import stock_bp
    from app.routes.transaction_routes import transaction_bp
    from app.routes.user_routes import user_bp

    app.register_blueprint(user_bp, url_prefix="/users")  # Register user routes
    app.register_blueprint(
        account_bp, url_prefix="/accounts"
    )  # Register account routes
    app.register_blueprint(bank_bp, url_prefix="/banks")  # Register bank routes
    app.register_blueprint(
        transaction_bp, url_prefix="/transactions"
    )  # Register transaction routes
    app.register_blueprint(budget_bp, url_prefix="/budgets")
    app.register_blueprint(investment_bp, url_prefix="/investments")
    app.register_blueprint(stock_bp, url_prefix="/stocks")
    app.register_blueprint(asset_bp, url_prefix="/assets")
    app.register_blueprint(account_asset_bp, url_prefix="/account_assets")
    app.register_blueprint(refund_item_bp, url_prefix="/refund_items")
    app.register_blueprint(refund_group_bp, url_prefix="/refund_groups")
    app.register_blueprint(gocardless_bp, url_prefix="/gocardless")

    @app.route("/health")
    def health():
        return jsonify({"status": "ok"}), 200

    @jwt.invalid_token_loader
    def invalid_token_callback(error_string):
        return jsonify({"msg": "Invalid token", "error": str(error_string)}), 401

    @jwt.unauthorized_loader
    def unauthorized_callback(error_string):
        return jsonify(
            {"msg": "Missing Authorization Header", "error": str(error_string)}
        ), 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_data):
        return jsonify({"msg": "Token has expired", "error": "token_expired"}), 401

    logger.info("Application initialized successfully")
    return app
