# WealthManager Backend

The backend service for WealthManager, built with Flask, providing a robust API for both the web and mobile applications.

## 🏗 Architecture

The backend is structured as a modular Flask application with the following components:

```
backend/
├── app/
│   ├── routes/                 # API endpoints and route handlers
│   │   ├── account_routes.py   # Account management endpoints
│   │   ├── asset_routes.py     # Asset tracking endpoints
│   │   ├── bank_routes.py      # Banking integration endpoints
│   │   ├── budget_routes.py    # Budget management endpoints
│   │   ├── gocardless_routes.py# GoCardless integration
│   │   ├── investment_routes.py# Investment tracking endpoints
│   │   ├── stock_routes.py     # Stock market endpoints
│   │   ├── transaction_routes.py# Transaction management
│   │   └── user_routes.py      # User management endpoints
│   ├── services/               # Business logic layer
│   │   ├── account_service.py  # Account operations
│   │   ├── asset_service.py    # Asset management
│   │   ├── bank_service.py     # Banking operations
│   │   ├── base_service.py     # Base service class
│   │   ├── budget_service.py   # Budget operations
│   │   ├── gocardless_service.py# Bank integration
│   │   ├── investment_service.py# Investment operations
│   │   ├── stock_service.py    # Stock market operations
│   │   └── user_service.py     # User management
│   ├── schemas/               # Data validation schemas
│   │   └── schema_registry.py # Central schema registry
│   ├── types/                # Type definitions and hints
│   ├── utils/                # Helper functions
│   ├── database.py           # Database configuration and models
│   ├── logger.py            # Logging configuration
│   ├── middleware.py        # Request/Response middleware
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Global schema definitions
│   └── swagger.py           # API documentation
├── instance/                # Instance-specific data
│   └── wealth_manager.db    # SQLite database
├── logs/                   # Application logs
│   └── app.log            # Main log file
├── test/                   # Test suite
│   ├── add_api_fake_data.py # Test data generation
│   ├── test_api.py         # API tests
│   └── test_from_swagger/  # Swagger-based tests
├── Dockerfile              # Container configuration
├── requirements.txt        # Python dependencies
├── app.py                 # Application entry point
└── run.py                 # Development server script
```

## 🚀 Getting Started

### Prerequisites

- Python 3.12+
- pip (Python package manager)
- Virtual environment (recommended)

### Installation

1. Clone the repository and navigate to the backend directory:
```bash
cd backend
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Running the Server

Development mode:
```bash
python run.py
```

Production mode:
```bash
flask run --host=0.0.0.0
```

## 📚 API Documentation

The API documentation is available through Swagger UI when the server is running:
- Development: http://localhost:5000/api/docs
- Production: https://[your-domain]/api/docs

## 🔧 Core Dependencies

- **Flask**: Web framework
- **Flask-CORS**: Cross-Origin Resource Sharing
- **Flask-JWT-Extended**: JWT authentication
- **Marshmallow**: Object serialization/deserialization
- **YFinance**: Financial data integration
- **Sentry**: Error tracking
- **Nordigen**: Banking integration

## 🛠️ Development

### Project Structure

- `app/__init__.py`: Application factory and configuration
- `app/routes/`: API endpoints organized by domain
- `app/services/`: Business logic implementation
- `app/models.py`: SQLAlchemy models
- `app/schemas.py`: Marshmallow schemas
- `app/database.py`: Database configuration

### Testing

Run the test suite:
```bash
python -m pytest
```

### Docker Support

Build the container:
```bash
docker build -t wealthmanager-backend .
```

Run the container:
```bash
docker run -p 5000:5000 wealthmanager-backend
```

## 📝 Logging

Logs are stored in:
- `logs/`: Application logs
- `test_debug.log`: Test execution logs

## 🔐 Security

- JWT-based authentication
- CORS protection
- Environment variable configuration
- Sentry error tracking

## 🤝 Contributing

1. Create a new branch
2. Make your changes
3. Write/update tests
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
