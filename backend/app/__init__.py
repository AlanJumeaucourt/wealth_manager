from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
import logging
from datetime import timedelta
from flask_restx import Api
from typing import Any


logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

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

def create_app() -> Flask:
    app = Flask(__name__)
    app.url_map.strict_slashes = False
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    # Configure your JWT secret key
    app.config['JWT_SECRET_KEY'] = 'your_secret_key'  # Change this to a strong secret key
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)  # Access token expiration
    jwt = JWTManager(app)
    
    app.config['JSONIFY_MIMETYPE'] = 'application/json'
    
    # Update authorizations configuration
    authorizations = {
        'Bearer': {  # Changed from 'Bearer Auth' to 'Bearer'
            'type': 'apiKey',
            'in': 'header',
            'name': 'Authorization',
            'description': 'Enter your bearer token in the format: Bearer &lt;token&gt;',
            'prefix': 'Bearer'  # Add prefix
        }
    }
    
    api = Api(
        app,
        version='1.0',
        title='WealthManager API',
        description='A simple WealthManager API. \n\n'
                   'To authorize, first get a token from /users/login, then click the Authorize button '
                   'and enter the token in the format: Bearer your-token-here',
        doc='/api/docs',
        authorizations=authorizations,
        security='Bearer'  # Changed from 'Bearer Auth' to 'Bearer'
    )

    @app.before_request
    def log_request_info() -> None:
        logging.debug(f"Request: {request.method} {request.url}")
        logging.debug(f"Headers: {request.headers}")
        logging.debug(f"Body: {request.get_data()}")

    @app.after_request
    def log_response_info(response: Response) -> Response:
        try:
            # Only try to get data if it's not a direct passthrough response
            data = response.get_data() if not response.direct_passthrough else b'<direct passthrough>'
            logging.debug(f"Response: {response.status_code} {data}")
        except Exception as e:
            logging.debug(f"Response: {response.status_code} (Could not log data: {e})")
        return response

    # Import namespaces instead of blueprints
    from app.routes.user_routes import user_ns
    from app.routes.account_routes import account_ns
    from app.routes.bank_routes import bank_ns
    from app.routes.transaction_routes import transaction_ns
    from app.routes.budget_routes import budget_ns
    from app.routes.investment_routes import investment_ns
    from app.routes.stock_routes import stock_ns

    # Register namespaces
    api.add_namespace(user_ns, path='/users')
    api.add_namespace(account_ns, path='/accounts')
    api.add_namespace(bank_ns, path='/banks')
    api.add_namespace(transaction_ns, path='/transactions')
    api.add_namespace(budget_ns, path='/budgets')
    api.add_namespace(investment_ns, path='/investments')
    api.add_namespace(stock_ns, path='/stocks')

    @jwt.invalid_token_loader
    def invalid_token_callback(error_string: str) -> tuple[Any, int]:
        return jsonify({
            'msg': 'Invalid token',
            'error': str(error_string)
        }), 401

    @jwt.unauthorized_loader
    def unauthorized_callback(error_string: str) -> tuple[Any, int]:
        return jsonify({
            'msg': 'Missing Authorization Header',
            'error': str(error_string)
        }), 401

    return app
