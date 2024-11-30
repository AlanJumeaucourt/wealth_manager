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

logger = getLogger(__name__)


class BaseRoutes:
    def __init__(
        self, blueprint_name: str, service: BaseService, schema: Schema
    ) -> None:
        self.bp = Blueprint(blueprint_name, __name__)
        self.service = service
        self.schema = schema

        self.register_routes()

    def register_routes(self) -> None:
        self.bp.route("/", methods=["POST"])(self.create)
        self.bp.route("/<int:id>", methods=["GET"])(self.get)
        self.bp.route("/<int:id>", methods=["PUT"])(self.update)
        self.bp.route("/<int:id>", methods=["DELETE"])(self.delete)
        self.bp.route("/", methods=["GET"])(self.get_all)

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
            return jsonify(self.schema.dump(item)), 201
        return (
            jsonify({"error": f"Failed to create {self.service.table_name}"}),
            500,
        )

    @jwt_required()
    def get(self, id: int):
        user_id = get_jwt_identity()
        sentry_sdk.set_user({"id": str(user_id)})
        item = self.service.get_by_id(id, user_id)
        if item:
            if hasattr(item, "date"):
                item.date = datetime.fromisoformat(item.date.rstrip("Z"))
            return jsonify(self.schema.dump(item))
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
            filters: dict[str, Any] = {
                field: request.args.get(field)
                for field in self.schema.fields
                if field in request.args
            }

            # Add account_id to filters if it's in the request args
            if "account_id" in request.args:
                filters["account_id"] = request.args.get("account_id")

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
