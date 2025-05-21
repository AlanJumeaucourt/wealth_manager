from datetime import datetime

from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.routes.base_routes import BaseRoutes
from app.schemas.schema_registry import LiabilityPaymentDetailSchema, LiabilitySchema
from app.services.liability_service import LiabilityPaymentDetailService, LiabilityService
from app.swagger import spec

# Create service instances
liability_service = LiabilityService()
liability_payment_service = LiabilityPaymentDetailService()

# Create custom routes for Liability that extends BaseRoutes
class LiabilityRoutes(BaseRoutes):
    def __init__(self, entity_name, service, schema):
        super().__init__(entity_name, service, schema)

        # Override the create endpoint to generate interest transactions automatically
        @self.bp.route("", methods=["POST"])
        @jwt_required()
        def create_with_interest_transactions():
            """Create a liability and optionally generate interest transactions."""
            user_id = get_jwt_identity()
            data = request.get_json()

            # First use the base create method to create the liability
            result = self.service.create({**data, "user_id": user_id})

            if not result:
                return jsonify({"message": "Failed to create liability"}), 400

            # If the liability is created successfully and it's a deferred loan,
            # generate interest transactions automatically
            print(result)
            liability_data = self.schema.dump(result)

            # Check if we should generate interest transactions
            # Only generate for total deferred loans by default
            should_generate = (
                data.get("liability_type") == "total_deferred_loan" or
                data.get("deferral_type") == "total"
            )

            # Check if the auto_generate_interest parameter is sent and not False
            auto_generate = data.get("auto_generate_interest", should_generate)

            if auto_generate and liability_data.get("id"):
                try:
                    self.service.generate_interest_expense_transactions(
                        liability_data["id"], user_id
                    )
                except Exception as e:
                    # Log but don't fail the creation
                    print(f"Failed to generate interest transactions: {str(e)}")

            return jsonify(liability_data), 201

# Create route instances with our custom LiabilityRoutes for liabilities
liability_routes = LiabilityRoutes("liability", liability_service, LiabilitySchema())
liability_bp = liability_routes.bp

# Standard routes for liability payments
liability_payment_routes = BaseRoutes(
    "liability_payment", liability_payment_service, LiabilityPaymentDetailSchema()
)
liability_payment_bp = liability_payment_routes.bp

# The swagger documentation function is defined below


# We've removed the separate details endpoints since they're now handled by the base routes


@liability_bp.route("/<int:id>/amortization", methods=["GET"])
@jwt_required()
def get_amortization_schedule(id):
    """Get the amortization schedule for a liability."""
    user_id = get_jwt_identity()
    schedule = liability_service.generate_amortization_schedule(id, user_id)
    return jsonify(schedule)


@liability_bp.route("/<int:id>/generate-interest-transactions", methods=["GET"])
@jwt_required()
def generate_interest_transactions(id):
    """Generate interest expense transactions for capitalized interest during deferral periods."""
    user_id = get_jwt_identity()

    # Generate the transactions
    result = liability_service.generate_interest_expense_transactions(id, user_id)

    if result:
        return jsonify({
            "success": True,
            "message": "Interest expense transactions generated successfully"
        })
    else:
        return jsonify({
            "success": False,
            "message": "Failed to generate interest expense transactions"
        }), 400


@liability_payment_bp.route("/liability/<int:liability_id>", methods=["GET"])
@jwt_required()
def get_payments_for_liability(liability_id):
    """Get all payments for a specific liability."""
    user_id = get_jwt_identity()
    payments = liability_payment_service.get_all_for_liability(liability_id, user_id)
    return jsonify({"items": payments})


@liability_payment_bp.route("/record", methods=["POST"])
@jwt_required()
def record_payment():
    """Record a payment for a liability."""
    user_id = get_jwt_identity()
    data = request.get_json()

    # Validate required fields
    required_fields = [
        "liability_id",
        "payment_date",
        "amount",
        "principal_amount",
        "interest_amount",
    ]
    for field in required_fields:
        if field not in data:
            return jsonify({"message": f"Missing required field: {field}"}), 400

    # Parse payment date
    try:
        payment_date = datetime.strptime(data["payment_date"], "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"message": "Invalid payment date format. Use YYYY-MM-DD"}), 400

    # Check if transaction_id is provided
    if "transaction_id" not in data:
        return jsonify({"message": "transaction_id is required"}), 400

    # Record the payment
    payment = liability_payment_service.record_payment(
        liability_id=data["liability_id"],
        user_id=user_id,
        payment_date=payment_date,
        amount=data["amount"],
        principal_amount=data["principal_amount"],
        interest_amount=data["interest_amount"],
        extra_payment=data.get("extra_payment", 0.0),
        transaction_id=data["transaction_id"],
    )

    return jsonify(payment)


def register_liability_swagger_docs():
    """Register Swagger documentation for liability endpoints."""
    # Document liability endpoints (now with details included)
    spec.path(
        path="/liabilities/{id}",
        operations={
            "get": {
                "tags": ["Liability"],
                "summary": "Get liability with details",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "Liability ID",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Liability with details",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/Liability"}
                            }
                        },
                    },
                    "404": {"description": "Liability not found"},
                },
            }
        },
    )

    # Document all liabilities endpoint (now with details included)
    spec.path(
        path="/liabilities",
        operations={
            "get": {
                "tags": ["Liability"],
                "summary": "Get all liabilities with details",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "page",
                        "in": "query",
                        "schema": {"type": "integer", "default": 1},
                        "description": "Page number",
                    },
                    {
                        "name": "per_page",
                        "in": "query",
                        "schema": {"type": "integer", "default": 10},
                        "description": "Items per page",
                    },
                    {
                        "name": "sort_by",
                        "in": "query",
                        "schema": {"type": "string"},
                        "description": "Field to sort by",
                    },
                    {
                        "name": "sort_order",
                        "in": "query",
                        "schema": {
                            "type": "string",
                            "enum": ["asc", "desc"],
                            "default": "asc",
                        },
                        "description": "Sort order",
                    },
                    {
                        "name": "search",
                        "in": "query",
                        "schema": {"type": "string"},
                        "description": "Search term",
                    },
                    {
                        "name": "search_fields",
                        "in": "query",
                        "schema": {"type": "string"},
                        "description": "Comma-separated list of fields to search in",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "List of liabilities with details",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "items": {
                                            "type": "array",
                                            "items": {
                                                "$ref": "#/components/schemas/Liability"
                                            },
                                        },
                                        "total": {"type": "integer"},
                                        "page": {"type": "integer"},
                                        "per_page": {"type": "integer"},
                                    },
                                }
                            }
                        },
                    }
                },
            }
        },
    )

    # We've removed the legacy endpoints documentation since they're no longer supported

    # Document amortization schedule endpoint
    spec.path(
        path="/liabilities/{id}/amortization",
        operations={
            "get": {
                "tags": ["Liability"],
                "summary": "Get amortization schedule for a liability",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "Liability ID",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Amortization schedule",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "payment_number": {"type": "integer"},
                                            "payment_date": {"type": "string"},
                                            "payment_amount": {"type": "number"},
                                            "principal_amount": {"type": "number"},
                                            "interest_amount": {"type": "number"},
                                            "remaining_principal": {"type": "number"},
                                            "transaction_id": {"type": "integer"},
                                        },
                                    },
                                }
                            }
                        },
                    },
                    "404": {"description": "Liability not found"},
                },
            }
        },
    )

    # Document generate interest transactions endpoint
    spec.path(
        path="/liabilities/{id}/generate-interest-transactions",
        operations={
            "post": {
                "tags": ["Liability"],
                "summary": "Generate expense transactions for capitalized interest",
                "description": "Creates expense transactions in the loan account for interest that gets capitalized during deferral periods",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "Liability ID",
                    },
                ],
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "force": {
                                        "type": "boolean",
                                        "default": False,
                                        "description": "Force generation even for non-deferred loans"
                                    }
                                }
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Interest transactions successfully generated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "success": {"type": "boolean"},
                                        "message": {"type": "string"}
                                    }
                                }
                            }
                        }
                    },
                    "400": {
                        "description": "Failed to generate interest transactions",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "success": {"type": "boolean"},
                                        "message": {"type": "string"}
                                    }
                                }
                            }
                        }
                    },
                    "404": {"description": "Liability not found"}
                }
            }
        }
    )

    # Document get payments for liability endpoint
    spec.path(
        path="/liability_payments/liability/{liability_id}",
        operations={
            "get": {
                "tags": ["LiabilityPayment"],
                "summary": "Get all payments for a liability",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "liability_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "Liability ID",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "List of payments",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "items": {
                                            "type": "array",
                                            "items": {
                                                "$ref": "#/components/schemas/LiabilityPayment"
                                            },
                                        }
                                    },
                                }
                            }
                        },
                    }
                },
            }
        },
    )

    # Document record payment endpoint
    spec.path(
        path="/liability_payments/record",
        operations={
            "post": {
                "tags": ["LiabilityPayment"],
                "summary": "Record a payment for a liability",
                "security": [{"bearerAuth": []}],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": [
                                    "liability_id",
                                    "payment_date",
                                    "amount",
                                    "principal_amount",
                                    "interest_amount",
                                    "transaction_id",
                                ],
                                "properties": {
                                    "liability_id": {"type": "integer"},
                                    "payment_date": {
                                        "type": "string",
                                        "format": "date",
                                    },
                                    "amount": {"type": "number"},
                                    "principal_amount": {"type": "number"},
                                    "interest_amount": {"type": "number"},
                                    "extra_payment": {"type": "number", "default": 0},
                                    "transaction_id": {"type": "integer"},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "200": {
                        "description": "Payment recorded",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/LiabilityPayment"
                                }
                            }
                        },
                    },
                    "400": {"description": "Invalid request"},
                },
            }
        },
    )
