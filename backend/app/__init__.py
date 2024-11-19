from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
import logging
from datetime import timedelta


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

sentry_sdk.init(
    dsn="https://d12d7aa6d6edf166709997c29591227d@o4508077260996608.ingest.de.sentry.io/4508077266239568",
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,
    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,
    integrations=[FlaskIntegration()],
    spotlight=bool(True),
)

def create_app():
    app = Flask(__name__)
    app.url_map.strict_slashes = False  # Add this line
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Configure your JWT secret key
    app.config['JWT_SECRET_KEY'] = 'your_secret_key'  # Change this to a strong secret key
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)  # Access token expiration
    jwt = JWTManager(app)

    app.config['JSONIFY_MIMETYPE'] = 'application/json'

    @app.before_request
    def log_request_info():
        logging.debug(f"Request: {request.method} {request.url}")
        logging.debug(f"Headers: {request.headers}")
        logging.debug(f"Body: {request.get_data()}")

    @app.after_request
    def log_response_info(response):
        logging.debug(f"Response: {response.status_code} {response.get_data()}")
        return response

    # Import and register blueprints
    from app.routes.user_routes import user_bp
    from app.routes.account_routes import account_bp
    from app.routes.bank_routes import bank_bp
    from app.routes.transaction_routes import transaction_bp
    from app.routes.budget_routes import budget_bp
    from app.routes.investment_routes import investment_bp
    from app.routes.stock_routes import stock_bp
    from app.routes.asset_routes import asset_bp
    from app.routes.account_asset_routes import account_asset_bp

    app.register_blueprint(user_bp, url_prefix='/users')  # Register user routes
    app.register_blueprint(account_bp, url_prefix='/accounts')  # Register account routes
    app.register_blueprint(bank_bp, url_prefix='/banks')  # Register bank routes
    app.register_blueprint(transaction_bp, url_prefix='/transactions')  # Register transaction routes
    app.register_blueprint(budget_bp, url_prefix='/budgets')
    app.register_blueprint(investment_bp, url_prefix='/investments')
    app.register_blueprint(stock_bp, url_prefix='/stocks')
    app.register_blueprint(asset_bp, url_prefix='/assets')
    app.register_blueprint(account_asset_bp, url_prefix='/account_assets')

    @jwt.invalid_token_loader
    def invalid_token_callback(error_string: str):
        return jsonify({
            'msg': 'Invalid token',
            'error': str(error_string)
        }), 401

    @jwt.unauthorized_loader
    def unauthorized_callback(error_string: str):
        return jsonify({
            'msg': 'Missing Authorization Header',
            'error': str(error_string)
        }), 401

    return app
