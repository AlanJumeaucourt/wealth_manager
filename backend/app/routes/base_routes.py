import json
import re
from datetime import datetime
from logging import getLogger
from typing import Any

import sentry_sdk
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import Schema, ValidationError

from app.services.base_service import BaseService, ListQueryParams, QueryExecutionError
from app.swagger import spec

logger = getLogger(__name__)


class BaseRoutes:
    def __init__(
        self, blueprint_name: str, service: BaseService, schema: Schema
    ) -> None:
        self.bp = Blueprint(blueprint_name, __name__)
        self.service = service
        self.schema = schema

        self.register_routes()
        self.register_swagger_docs()

        """Register Swagger documentation for common endpoints"""

    def register_swagger_docs(self) -> None:
        base_path = f"/{self.bp.name}"

        # Document POST endpoint
        spec.path(
            path=f"{base_path}s/",
            operations={
                "post": {
                    "tags": [self.bp.name.capitalize()],
                    "summary": f"Create a new {self.bp.name}",
                    "security": [{"bearerAuth": []}],
                    "requestBody": {
                        "content": {"application/json": {"schema": self.schema}}
                    },
                    "responses": {
                        "201": {
                            "description": f"{self.bp.name.capitalize()} created successfully",
                            "content": {"application/json": {"schema": self.schema}},
                        },
                        "400": {"description": "Invalid input"},
                        "401": {"description": "Unauthorized"},
                        "422": {"description": "Validation error"},
                    },
                }
            },
        )

        # Document GET endpoint
        spec.path(
            path=f"{base_path}s/{{id}}",
            operations={
                "get": {
                    "tags": [self.bp.name.capitalize()],
                    "summary": f"Get a {self.bp.name} by ID",
                    "security": [{"bearerAuth": []}],
                    "parameters": [
                        {
                            "name": "id",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "integer"},
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": f"Return {self.bp.name}",
                            "content": {"application/json": {"schema": self.schema}},
                        },
                        "401": {"description": "Unauthorized"},
                        "404": {"description": "Not found"},
                    },
                },
                "put": {
                    "tags": [self.bp.name.capitalize()],
                    "summary": f"Update a {self.bp.name}",
                    "security": [{"bearerAuth": []}],
                    "parameters": [
                        {
                            "name": "id",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "integer"},
                        }
                    ],
                    "requestBody": {
                        "content": {"application/json": {"schema": self.schema}}
                    },
                    "responses": {
                        "200": {
                            "description": f"{self.bp.name.capitalize()} updated successfully",
                            "content": {"application/json": {"schema": self.schema}},
                        },
                        "400": {"description": "Invalid input"},
                        "401": {"description": "Unauthorized"},
                        "404": {"description": "Not found"},
                        "422": {"description": "Validation error"},
                    },
                },
                "delete": {
                    "tags": [self.bp.name.capitalize()],
                    "summary": f"Delete a {self.bp.name}",
                    "security": [{"bearerAuth": []}],
                    "parameters": [
                        {
                            "name": "id",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "integer"},
                        }
                    ],
                    "responses": {
                        "204": {"description": "No content"},
                        "401": {"description": "Unauthorized"},
                        "404": {"description": "Not found"},
                        "500": {"description": "Internal server error"},
                    },
                },
            },
        )

        # Document GET all endpoint
        spec.path(
            path=f"{base_path}s/",
            operations={
                "get": {
                    "tags": [self.bp.name.capitalize()],
                    "summary": f"Get all {self.bp.name}s",
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
                            "schema": {"type": "string", "enum": ["asc", "desc"]},
                            "description": "Sort order (asc or desc)",
                        },
                        {
                            "name": "fields",
                            "in": "query",
                            "schema": {"type": "string"},
                            "description": "Comma-separated list of fields to return",
                        },
                        {
                            "name": "search",
                            "in": "query",
                            "schema": {"type": "string"},
                            "description": "Search query",
                        },
                    ],
                    "responses": {
                        "200": {
                            "description": f"List of {self.bp.name}s",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "items": {
                                                "type": "array",
                                                "items": self.schema,
                                            },
                                            "total": {"type": "integer"},
                                            "page": {"type": "integer"},
                                            "per_page": {"type": "integer"},
                                            "pages": {"type": "integer"},
                                        },
                                    }
                                }
                            },
                        },
                        "401": {"description": "Unauthorized"},
                        "500": {"description": "Internal server error"},
                    },
                }
            },
        )

        # Document batch create endpoint
        spec.path(
            path=f"{base_path}s/batch/create",
            operations={
                "post": {
                    "tags": [self.bp.name.capitalize()],
                    "summary": f"Batch create multiple {self.bp.name}s",
                    "security": [{"bearerAuth": []}],
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "items": {
                                            "type": "array",
                                            "items": self.schema,
                                        }
                                    },
                                    "required": ["items"],
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Batch creation results",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "successful": {
                                                "type": "array",
                                                "items": self.schema,
                                            },
                                            "failed": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "data": {"type": "object"},
                                                        "error": {"type": "string"},
                                                    },
                                                },
                                            },
                                            "total_successful": {"type": "integer"},
                                            "total_failed": {"type": "integer"},
                                        },
                                    }
                                }
                            },
                        },
                        "400": {"description": "Invalid input"},
                        "401": {"description": "Unauthorized"},
                        "422": {"description": "Validation error"},
                    },
                }
            },
        )

        # Document batch update endpoint
        spec.path(
            path=f"{base_path}s/batch/update",
            operations={
                "post": {
                    "tags": [self.bp.name.capitalize()],
                    "summary": f"Batch update multiple {self.bp.name}s",
                    "security": [{"bearerAuth": []}],
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "items": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "id": {"type": "integer"},
                                                    **self.schema.fields,
                                                },
                                                "required": ["id"],
                                            },
                                        }
                                    },
                                    "required": ["items"],
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Batch update results",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "successful": {
                                                "type": "array",
                                                "items": self.schema,
                                            },
                                            "failed": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "id": {"type": "integer"},
                                                        "error": {"type": "string"},
                                                        "data": {"type": "object"},
                                                    },
                                                },
                                            },
                                            "total_successful": {"type": "integer"},
                                            "total_failed": {"type": "integer"},
                                        },
                                    }
                                }
                            },
                        },
                        "400": {"description": "Invalid input"},
                        "401": {"description": "Unauthorized"},
                        "422": {"description": "Validation error"},
                    },
                }
            },
        )

        # Document batch delete endpoint
        spec.path(
            path=f"{base_path}s/batch/delete",
            operations={
                "post": {
                    "tags": [self.bp.name.capitalize()],
                    "summary": f"Batch delete multiple {self.bp.name}s",
                    "security": [{"bearerAuth": []}],
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "ids": {
                                            "type": "array",
                                            "items": {"type": "integer"},
                                        }
                                    },
                                    "required": ["ids"],
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Batch deletion results",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "successful": {
                                                "type": "array",
                                                "items": {"type": "integer"},
                                            },
                                            "failed": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "id": {"type": "integer"},
                                                        "error": {"type": "string"},
                                                    },
                                                },
                                            },
                                            "total_successful": {"type": "integer"},
                                            "total_failed": {"type": "integer"},
                                        },
                                    }
                                }
                            },
                        },
                        "400": {"description": "Invalid input"},
                        "401": {"description": "Unauthorized"},
                        "422": {"description": "Validation error"},
                    },
                }
            },
        )

    def register_routes(self) -> None:
        self.bp.route("/", methods=["POST"])(self.create)
        self.bp.route("/<int:id>", methods=["GET"])(self.get)
        self.bp.route("/<int:id>", methods=["PUT"])(self.update)
        self.bp.route("/<int:id>", methods=["DELETE"])(self.delete)
        self.bp.route("/", methods=["GET"])(self.get_all)
        self.bp.route("/batch/create", methods=["POST"])(self.batch_create)
        self.bp.route("/batch/update", methods=["POST"])(self.batch_update)
        self.bp.route("/batch/delete", methods=["POST"])(self.batch_delete)

    @jwt_required()
    def create(self) -> tuple[Any, int]:
        user_id = get_jwt_identity()
        sentry_sdk.set_user({"id": str(user_id)})
        data = request.json

        # Check if data is a string and parse it
        if isinstance(data, str):
            data = json.loads(data)

        if not isinstance(data, dict):
            return jsonify({"error": "Invalid data format"}), 400

        if not data:
            return jsonify({"error": "No data provided"}), 400

        data["user_id"] = user_id

        try:
            validated_data: dict[str, Any] = self.schema.load(data)  # type: ignore[data-type]
        except ValidationError as err:
            # Changed status code from 400 to 422 for validation errors
            return jsonify({"Validation error": err.messages}), 422

        item = self.service.create(validated_data)
        if item:
            return jsonify(item)
            # TODO(Alan): verify if we really need to schema dump from marshmallow
            return jsonify(self.schema.dump(item)), 201
        return (
            jsonify({"error": f"Failed to create {self.service.table_name}"}),
            500,
        )

    @jwt_required()
    def batch_create(self) -> tuple[Any, int]:
        """Batch create multiple items."""
        user_id = get_jwt_identity()
        sentry_sdk.set_user({"id": str(user_id)})
        data = request.json

        if not isinstance(data, dict) or "items" not in data:
            return jsonify({"error": "Request must include 'items' array"}), 400

        items = data["items"]
        if not isinstance(items, list):
            return jsonify({"error": "'items' must be an array"}), 400

        if not items:
            return jsonify({"error": "No items provided"}), 400

        # Validate each item
        validated_items = []
        validation_errors = []

        for i, item in enumerate(items):
            if not isinstance(item, dict):
                validation_errors.append(
                    {"index": i, "error": "Item must be an object", "data": item}
                )
                continue

            try:
                # Add user_id to each item
                item["user_id"] = user_id
                validated_data = self.schema.load(item)
                validated_items.append(validated_data)
            except ValidationError as err:
                validation_errors.append(
                    {"index": i, "error": err.messages, "data": item}
                )

        if validation_errors:
            return jsonify({"validation_errors": validation_errors}), 422

        # Call batch_create method on the service
        result = self.service.batch_create(validated_items)
        return jsonify(result), 200

    @jwt_required()
    def get(self, id: int):
        user_id = get_jwt_identity()
        sentry_sdk.set_user({"id": str(user_id)})
        item = self.service.get_by_id(id, user_id)
        if item:
            if hasattr(item, "date"):
                item.date = datetime.fromisoformat(item.date.rstrip("Z"))
            return jsonify(item)
        return ("", 404)

    @jwt_required()
    def update(self, id: int):
        user_id = get_jwt_identity()
        sentry_sdk.set_user({"id": str(user_id)})
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        try:
            validated_data: Any = self.schema.load(data, partial=True)
        except ValidationError as err:
            # Changed status code from 400 to 422 for validation errors
            return jsonify({"Validation error": err.messages}), 422

        item = self.service.update(id, user_id, validated_data)
        if item:
            if hasattr(item, "date"):
                item.date = datetime.fromisoformat(item.date.rstrip("Z"))
            return jsonify(self.schema.dump(item))
        return (
            jsonify({"error": f"Failed to update {self.service.table_name}"}),
            500,
        )

    @jwt_required()
    def delete(self, id: int):
        user_id = get_jwt_identity()
        sentry_sdk.set_user({"id": str(user_id)})
        success = self.service.delete(id, user_id)
        return (
            ("", 204)
            if success
            else (
                jsonify({"error": f"Failed to delete {self.service.table_name}"}),
                500,
            )
        )

    @jwt_required()
    def get_all(self):
        user_id = get_jwt_identity()
        sentry_sdk.set_user({"id": str(user_id)})

        try:
            # Extract query parameters
            filters: dict[str, Any] = {}
            for field in self.schema.fields:
                if field in request.args:
                    values = request.args.getlist(field)
                    filters[field] = values[0] if len(values) == 1 else ",".join(values)

            # Add account_id to filters if it's in the request args
            if "account_id" in request.args:
                values = request.args.getlist("account_id")
                filters["account_id"] = (
                    values[0] if len(values) == 1 else ",".join(values)
                )

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
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except QueryExecutionError as e:
            return jsonify({"error": str(e)}), 500

    @jwt_required()
    def batch_update(self) -> tuple[Any, int]:
        """Batch update multiple items."""
        user_id = get_jwt_identity()
        sentry_sdk.set_user({"id": str(user_id)})
        data = request.json

        if not isinstance(data, dict) or "items" not in data:
            return jsonify({"error": "Request must include 'items' array"}), 400

        items = data["items"]
        if not isinstance(items, list):
            return jsonify({"error": "'items' must be an array"}), 400

        if not items:
            return jsonify({"error": "No items provided"}), 400

        # Validate each item
        validated_items = []
        validation_errors = []

        for i, item in enumerate(items):
            if not isinstance(item, dict):
                validation_errors.append(
                    {"index": i, "error": "Item must be an object", "data": item}
                )
                continue

            if "id" not in item:
                validation_errors.append(
                    {"index": i, "error": "Item must have an 'id' field", "data": item}
                )
                continue

            try:
                # Exclude id from validation since it's not part of the schema
                item_data = {k: v for k, v in item.items() if k != "id"}
                validated_data = self.schema.load(item_data, partial=True)
                validated_items.append({"id": item["id"], **validated_data})
            except ValidationError as err:
                validation_errors.append(
                    {"index": i, "error": err.messages, "data": item}
                )

        if validation_errors:
            return jsonify({"validation_errors": validation_errors}), 422

        result = self.service.batch_update(user_id, validated_items)
        return jsonify(result), 200

    @jwt_required()
    def batch_delete(self) -> tuple[Any, int]:
        """Batch delete multiple items."""
        user_id = get_jwt_identity()
        sentry_sdk.set_user({"id": str(user_id)})
        data = request.json

        if not isinstance(data, dict) or "ids" not in data:
            return jsonify({"error": "Request must include 'ids' array"}), 400

        ids = data["ids"]
        if not isinstance(ids, list):
            return jsonify({"error": "'ids' must be an array"}), 400

        if not ids:
            return jsonify({"error": "No ids provided"}), 400

        # Validate that all IDs are integers
        if not all(isinstance(id_, int) for id_ in ids):
            return jsonify({"error": "All ids must be integers"}), 400

        result = self.service.batch_delete(user_id, ids)
        return jsonify(result), 200


def validate_date_format(date_str: str) -> tuple[bool, str | None]:
    """Validate that the date string matches accepted formats.

    - 'YYYY-MM-DDThh:mm:ss'
    - 'YYYY-MM-DDThh:mm:ss.mmmmmm' (isoformat with microseconds)
    - 'YYYY-MM-DD'

    Args:
        date_str: The date string to validate

    Returns:
        Tuple[bool, Optional[str]]: (is_valid, error_message)

    """
    if not date_str:
        return False, "Date string cannot be empty"

    try:
        # First try to parse with isoformat (handles microseconds)
        try:
            parsed_date = datetime.fromisoformat(date_str)
            # Convert back to our accepted format without microseconds
            formatted_date = parsed_date.strftime("%Y-%m-%dT%H:%M:%S")
            return True, None
        except ValueError:
            # If isoformat fails, try our specific formats
            full_datetime_pattern = r"^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$"
            date_only_pattern = r"^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$"

            if re.match(full_datetime_pattern, date_str):
                datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S")
                return True, None
            if re.match(date_only_pattern, date_str):
                datetime.strptime(date_str, "%Y-%m-%d")
                return True, None
            return (
                False,
                "Date must be in format 'YYYY-MM-DD' or 'YYYY-MM-DDThh:mm:ss'",
            )

    except ValueError as e:
        return False, f"Invalid date values: {e!s}"
    except Exception as e:
        return False, f"Invalid date values: {e!s}"
