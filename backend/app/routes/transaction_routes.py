from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.exceptions import TransactionValidationError
from app.routes.base_routes import BaseRoutes, ListQueryParams
from app.schemas import TransactionSchema
from app.services.transaction_service import TransactionService
from app.swagger import spec


class TransactionRoutes(BaseRoutes):
    @jwt_required()
    def get_all(self):
        user_id = get_jwt_identity()

        # Extract query parameters
        filters = {
            field: request.args.get(field)
            for field in self.schema.fields
            if field in request.args
        }

        # Add custom filters
        if "account_id" in request.args:
            filters["account_id"] = request.args.get("account_id")

        # Add has_refund filter
        if "has_refund" in request.args:
            has_refund = request.args.get("has_refund")
            if has_refund is not None:
                filters["has_refund"] = request.args.get("has_refund")

        # Add date range filters
        if "from_date" in request.args:
            filters["from_date"] = request.args.get("from_date")
        if "to_date" in request.args:
            filters["to_date"] = request.args.get("to_date")

        # Create ListQueryParams object
        query_params = ListQueryParams(
            page=int(request.args.get("page", 1)),
            per_page=int(request.args.get("per_page", 10)),
            filters=filters,
            sort_by=request.args.get("sort_by"),
            sort_order=request.args.get("sort_order"),
            fields=(
                request.args.get("fields", "").split(",")
                if request.args.get("fields")
                else None
            ),
            search=request.args.get("search"),
        )

        results = self.service.get_all(user_id, query_params)
        return jsonify(results)

    def register_swagger_docs(self) -> None:
        """Override parent's swagger docs to add custom parameters"""
        # Call parent's method first to register base endpoints
        super().register_swagger_docs()

        base_path = f"/{self.bp.name}"

        # Document GET all endpoint with custom parameters
        spec.path(
            path=f"{base_path}s/",
            operations={
                "get": {
                    "tags": [self.bp.name.capitalize()],
                    "summary": f"Get all {self.bp.name}s",
                    "description": "Retrieve a paginated list of transactions with optional filtering, sorting, and search capabilities.",
                    "security": [{"bearerAuth": []}],
                    "parameters": [
                        {
                            "name": "page",
                            "in": "query",
                            "schema": {"type": "integer", "default": 1, "minimum": 1},
                            "description": "Page number for pagination. Starts from 1.",
                            "example": 1,
                            "required": False,
                        },
                        {
                            "name": "per_page",
                            "in": "query",
                            "schema": {
                                "type": "integer",
                                "default": 10,
                                "minimum": 1,
                            },
                            "description": "Number of items to return per page",
                            "example": 10,
                            "required": False,
                        },
                        {
                            "name": "sort_by",
                            "in": "query",
                            "schema": {
                                "type": "string",
                                "enum": [
                                    "id",
                                    "date",
                                    "date_accountability",
                                    "description",
                                    "amount",
                                    "from_account_id",
                                    "to_account_id",
                                    "category",
                                    "subcategory",
                                    "type",
                                ],
                            },
                            "description": "Field to sort the results by",
                            "example": "date",
                            "required": False,
                        },
                        {
                            "name": "sort_order",
                            "in": "query",
                            "schema": {"type": "string", "enum": ["asc", "desc"]},
                            "description": "Sort order: ascending (asc) or descending (desc)",
                            "example": "desc",
                            "required": False,
                        },
                        {
                            "name": "fields",
                            "in": "query",
                            "schema": {
                                "type": "string",
                                "enum": [
                                    "id",
                                    "date",
                                    "date_accountability",
                                    "description",
                                    "amount",
                                    "from_account_id",
                                    "to_account_id",
                                    "category",
                                    "subcategory",
                                    "type",
                                ],
                            },
                            "description": "Comma-separated list of fields to return in the response. Example: 'id,date,amount'",
                            "example": "id,date,amount,description",
                            "required": False,
                        },
                        {
                            "name": "search",
                            "in": "query",
                            "schema": {"type": "string"},
                            "description": "Search query to filter transactions by description or other text fields",
                            "example": "grocery",
                            "required": False,
                        },
                        {
                            "name": "search_fields",
                            "in": "query",
                            "schema": {
                                "type": "string",
                                "enum": [
                                    "id",
                                    "date",
                                    "date_accountability",
                                    "description",
                                    "amount",
                                    "from_account_id",
                                    "to_account_id",
                                    "category",
                                    "subcategory",
                                    "type",
                                ],
                            },
                            "description": "Comma-separated list of fields to search within",
                            "example": "description",
                            "required": False,
                        },
                        {
                            "name": "account_id",
                            "in": "query",
                            "schema": {"type": "integer"},
                            "description": "Filter transactions by account ID (matches either source or destination account)",
                            "example": 123,
                            "required": False,
                        },
                        {
                            "name": "has_refund",
                            "in": "query",
                            "schema": {"type": "string", "enum": ["true", "false"]},
                            "description": "Filter transactions by refund status. Use 'true' to show only refunded transactions, 'false' for non-refunded ones",
                            "example": "false",
                            "required": False,
                        },
                        {
                            "name": "type",
                            "in": "query",
                            "schema": {
                                "type": "array",
                                "items": {
                                    "type": "string",
                                    "enum": ["expense", "income", "transfer"],
                                },
                            },
                            "description": "Filter transactions by type(s). Multiple types can be specified as comma-separated values",
                            "example": "expense,income",
                            "required": False,
                        },
                        {
                            "name": "category",
                            "in": "query",
                            "schema": {"type": "array", "items": {"type": "string"}},
                            "description": "Filter transactions by category. Multiple categories can be specified as comma-separated values",
                            "example": "Food,Entertainment",
                            "required": False,
                        },
                        {
                            "name": "subcategory",
                            "in": "query",
                            "schema": {"type": "array", "items": {"type": "string"}},
                            "description": "Filter transactions by subcategory. Multiple subcategories can be specified as comma-separated values",
                            "example": "Groceries,Restaurants",
                            "required": False,
                        },
                        {
                            "name": "from_account_id",
                            "in": "query",
                            "schema": {"type": "array", "items": {"type": "integer"}},
                            "description": "Filter transactions by source account IDs. Multiple IDs can be specified as comma-separated values",
                            "example": "123,456",
                            "required": False,
                        },
                        {
                            "name": "to_account_id",
                            "in": "query",
                            "schema": {"type": "array", "items": {"type": "integer"}},
                            "description": "Filter transactions by destination account IDs. Multiple IDs can be specified as comma-separated values",
                            "example": "123,456",
                            "required": False,
                        },
                        {
                            "name": "date",
                            "in": "query",
                            "schema": {
                                "type": "array",
                                "items": {"type": "string", "format": "date"},
                            },
                            "description": "Filter transactions by date (YYYY-MM-DD). Multiple dates can be specified as comma-separated values",
                            "example": "2024-03-20,2024-03-21",
                            "required": False,
                        },
                        {
                            "name": "date_accountability",
                            "in": "query",
                            "schema": {
                                "type": "array",
                                "items": {"type": "string", "format": "date"},
                            },
                            "description": "Filter transactions by accountability date (YYYY-MM-DD). Multiple dates can be specified as comma-separated values",
                            "example": "2024-03-20,2024-03-21",
                            "required": False,
                        },
                        {
                            "name": "amount",
                            "in": "query",
                            "schema": {"type": "array", "items": {"type": "number"}},
                            "description": "Filter transactions by exact amounts. Multiple amounts can be specified as comma-separated values",
                            "example": "42.99,100.50",
                            "required": False,
                        },
                        {
                            "name": "id",
                            "in": "query",
                            "schema": {"type": "array", "items": {"type": "integer"}},
                            "description": "Filter transactions by IDs. Multiple IDs can be specified as comma-separated values",
                            "example": "1548,1549",
                            "required": False,
                        },
                        {
                            "name": "description",
                            "in": "query",
                            "schema": {"type": "array", "items": {"type": "string"}},
                            "description": "Filter transactions by descriptions (exact match). Multiple descriptions can be specified as comma-separated values",
                            "example": "AMAZON EU SARL,NETFLIX",
                            "required": False,
                        },
                    ],
                    "responses": {
                        "200": {
                            "description": "Successfully retrieved list of transactions",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "items": {
                                                "type": "array",
                                                "items": self.schema,
                                                "description": "List of transactions matching the query parameters",
                                            },
                                            "total": {
                                                "type": "integer",
                                                "description": "Total number of transactions matching the query",
                                            },
                                            "page": {
                                                "type": "integer",
                                                "description": "Current page number",
                                            },
                                            "per_page": {
                                                "type": "integer",
                                                "description": "Number of items per page",
                                            },
                                            "pages": {
                                                "type": "integer",
                                                "description": "Total number of pages",
                                            },
                                        },
                                    },
                                    "example": {
                                        "items": [
                                            {
                                                "amount": 40.99,
                                                "category": "Divers",
                                                "date": "2021-09-12",
                                                "date_accountability": "2021-09-12",
                                                "description": "AMAZON EU SARL PAYLI209040",
                                                "from_account_id": 141,
                                                "id": 1548,
                                                "refund_items": [
                                                    {
                                                        "amount": 40.99,
                                                        "date": "2021-09-22",
                                                        "description": "Refund: AMAZON EU SARL PAYLI209040 (100.0%)",
                                                        "id": 160,
                                                        "refund_group_id": None,
                                                    }
                                                ],
                                                "subcategory": "A catégoriser",
                                                "to_account_id": 156,
                                                "type": "expense",
                                            },
                                        ],
                                        "page": 1,
                                        "per_page": 10,
                                        "total": 50,
                                    },
                                }
                            },
                        },
                        "400": {
                            "description": "Bad Request - Invalid parameters",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {"error": {"type": "string"}},
                                    },
                                    "example": {"error": "Invalid page number"},
                                }
                            },
                        },
                        "401": {
                            "description": "Unauthorized - Invalid or missing authentication token",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {"msg": {"type": "string"}},
                                    },
                                    "example": {"msg": "Missing Authorization Header"},
                                }
                            },
                        },
                        "403": {
                            "description": "Forbidden - User doesn't have permission to access these transactions",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {"error": {"type": "string"}},
                                    },
                                    "example": {"error": "Access denied"},
                                }
                            },
                        },
                        "500": {
                            "description": "Internal Server Error",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {"error": {"type": "string"}},
                                    },
                                    "example": {
                                        "error": "An unexpected error occurred"
                                    },
                                }
                            },
                        },
                    },
                }
            },
        )


transaction_service = TransactionService()
transaction_routes = TransactionRoutes(
    "transaction", transaction_service, TransactionSchema()
)
transaction_bp = transaction_routes.bp


@transaction_bp.errorhandler(TransactionValidationError)
def handle_validation_error(error):
    return jsonify({"error": str(error)}), 422  # 422 Unprocessable Entity
