from datetime import datetime
from typing import Any, cast

import sentry_sdk
from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
)
from marshmallow import ValidationError

from app.exceptions import DuplicateUserError
from app.routes.route_utils import process_request
from app.schemas.schema_registry import UserSchema
from app.services.user_service import (
    authenticate_user,
    create_user,
    delete_user,
    get_user_by_id,
    update_last_login,
    update_user,
)
from app.swagger import spec

user_bp = Blueprint("user", __name__)
user_schema = UserSchema()


def register_user_swagger_docs():
    # Document register endpoint
    spec.path(
        path="/users/register",
        operations={
            "post": {
                "tags": ["Users"],
                "summary": "Register a new user",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["name", "email", "password"],
                                "properties": {
                                    "name": {"type": "string"},
                                    "email": {"type": "string", "format": "email"},
                                    "password": {"type": "string", "format": "password"}
                                }
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "User created successfully",
                        "content": {
                            "application/json": {
                                "schema": user_schema
                            }
                        }
                    },
                    "400": {"description": "Invalid input or missing fields"},
                    "422": {"description": "User already exists"},
                    "500": {"description": "Server error"}
                }
            }
        }
    )

    # Document login endpoint
    spec.path(
        path="/users/login",
        operations={
            "post": {
                "tags": ["Users"],
                "summary": "Login user and get access token",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["email", "password"],
                                "properties": {
                                    "email": {"type": "string", "format": "email"},
                                    "password": {"type": "string", "format": "password"}
                                }
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Login successful",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "access_token": {"type": "string"},
                                        "refresh_token": {"type": "string"},
                                        "token_type": {"type": "string"},
                                        "user": {
                                            "type": "object",
                                            "properties": {
                                                "id": {"type": "integer"},
                                                "email": {"type": "string"},
                                                "name": {"type": "string"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "401": {"description": "Invalid credentials"},
                    "500": {"description": "Server error"}
                }
            }
        }
    )

    # Document refresh token endpoint
    spec.path(
        path="/users/refresh",
        operations={
            "post": {
                "tags": ["Users"],
                "summary": "Refresh access token",
                "security": [{"bearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Token refreshed successfully",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "access_token": {"type": "string"},
                                        "user": {
                                            "type": "object",
                                            "properties": {
                                                "id": {"type": "integer"},
                                                "email": {"type": "string"},
                                                "name": {"type": "string"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "401": {"description": "Invalid refresh token"},
                    "404": {"description": "User not found"},
                    "500": {"description": "Server error"}
                }
            }
        }
    )

    # Document get user endpoints
    spec.path(
        path="/users/{user_id}",
        operations={
            "get": {
                "tags": ["Users"],
                "summary": "Get user by ID",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "user_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "User ID"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "User details",
                        "content": {
                            "application/json": {
                                "schema": user_schema
                            }
                        }
                    },
                    "401": {"description": "Unauthorized"},
                    "403": {"description": "Forbidden"},
                    "404": {"description": "User not found"}
                }
            },
            "put": {
                "tags": ["Users"],
                "summary": "Update user",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "user_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "User ID"
                    }
                ],
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "email": {"type": "string", "format": "email"},
                                    "password": {"type": "string", "format": "password"}
                                }
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "User updated successfully",
                        "content": {
                            "application/json": {
                                "schema": user_schema
                            }
                        }
                    },
                    "400": {"description": "Invalid input"},
                    "401": {"description": "Unauthorized"},
                    "403": {"description": "Forbidden"},
                    "500": {"description": "Server error"}
                }
            },
            "delete": {
                "tags": ["Users"],
                "summary": "Delete user",
                "security": [{"bearerAuth": []}],
                "parameters": [
                    {
                        "name": "user_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"},
                        "description": "User ID"
                    }
                ],
                "responses": {
                    "204": {"description": "User deleted successfully"},
                    "401": {"description": "Unauthorized"},
                    "403": {"description": "Forbidden"},
                    "500": {"description": "Server error"}
                }
            }
        }
    )

    # Document verify token endpoint
    spec.path(
        path="/users/verify-token",
        operations={
            "get": {
                "tags": ["Users"],
                "summary": "Verify JWT token",
                "security": [{"bearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Token is valid",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "message": {"type": "string"}
                                    }
                                }
                            }
                        }
                    },
                    "401": {"description": "Invalid token"}
                }
            }
        }
    )

# Register Swagger documentation
register_user_swagger_docs()


@user_bp.route("/register", methods=["POST"])
def register() -> tuple[Any, int]:
    data = request.json
    required_fields = ["name", "email", "password"]

    if not data:
        return jsonify({"error": "No data provided"}), 400
    if not all(field in data for field in required_fields):
        return (
            jsonify(
                {"error": f"Missing required fields: {', '.join(required_fields)}"}
            ),
            400,
        )

    try:
        validated_data: Any = user_schema.load(data)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    try:
        user = create_user(
            name=validated_data["name"],
            email=validated_data["email"],
            password=validated_data["password"],
        )
        if user:
            sentry_sdk.set_user({"id": f"{user.id}"})
            return jsonify(user.__dict__), 201
        return jsonify({"error": "Failed to create user"}), 500
    except DuplicateUserError as e:
        return jsonify({"error": str(e)}), 422


@user_bp.route("/login", methods=["POST"])
def login() -> tuple[Any, int]:
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        user = authenticate_user(email=email, password=password)
        if user:
            user_dict = {"id": user.id, "email": user.email, "name": user.name}

            access_token = create_access_token(
                identity=str(user_dict["id"]),
                additional_claims={
                    "email": user_dict["email"],
                    "name": user_dict["name"],
                },
                fresh=True,
            )
            refresh_token = create_refresh_token(identity=str(user_dict["id"]))

            # Fix type error by ensuring user.id is not None
            if user.id is not None:
                update_last_login(user_id=user.id, login_time=datetime.now())

            return (
                jsonify(
                    {
                        "access_token": access_token,
                        "refresh_token": refresh_token,
                        "user": user_dict,
                        "token_type": "bearer",
                    }
                ),
                200,
            )
        return (
            jsonify({"msg": "Invalid credentials", "error": "authentication_failed"}),
            401,
        )

    except Exception as e:
        sentry_sdk.capture_exception(e)
        return jsonify({"msg": "Login failed", "error": str(e)}), 500


@user_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh() -> tuple[Any, int]:
    """Endpoint to refresh the access token using a valid refresh token.
    Returns a new access token if the refresh token is valid.
    """
    try:
        # Get the user's identity from the refresh token
        user_id = get_jwt_identity()

        # Get the user details to include in the new access token
        user = get_user_by_id(int(user_id))
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Create new access token
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                "email": user.email,
                "name": user.name,
            },
        )

        return jsonify(
            {
                "access_token": access_token,
                "user": {"id": user.id, "email": user.email, "name": user.name},
            }
        ), 200

    except Exception as e:
        sentry_sdk.capture_exception(e)
        return jsonify({"error": "Token refresh failed", "details": str(e)}), 500


@user_bp.route("/<int:user_id>", methods=["GET"])
@jwt_required()
def get_user_admin(user_id: int) -> tuple[Any, int]:
    user_id_from_tokens, _, error, code = process_request(type_of_request="GET")

    if int(user_id_from_tokens) != user_id:
        return jsonify({"error": "Unauthorized, cannot access this user"}), 403

    if error and code:
        return error, code

    user = get_user_by_id(user_id)
    return (jsonify(user.__dict__), 200) if user else ("", 404)


@user_bp.route("/", methods=["GET"])
@jwt_required()
def get_user() -> tuple[Any, int]:
    user_id_from_tokens, _, error, code = process_request(type_of_request="GET")

    if error and code:
        return error, code

    user = get_user_by_id(user_id=user_id_from_tokens)
    # Cast to int to fix type error
    update_last_login(user_id=cast(int, user_id_from_tokens), login_time=datetime.now())
    return (jsonify(user.__dict__), 200) if user else ("", 404)


@user_bp.route("/<int:user_id>", methods=["PUT"])
@jwt_required()
def update_user_route(user_id: int) -> tuple[Any, int]:
    user_id_from_tokens, data, error, code = process_request(
        ["name", "email", "password"], type_of_request="PUT"
    )

    if error and code:
        return error, code

    if int(user_id_from_tokens) != user_id:
        return jsonify({"error": "Unauthorized, cannot update this user"}), 403

    try:
        validated_data: Any = user_schema.load(data, partial=True)  # type: ignore[data-type]
    except ValidationError as err:
        return jsonify({"Validation error": err.messages}), 400

    user = update_user(
        user_id=user_id,
        name=validated_data.get("name"),
        email=validated_data.get("email"),
        password=validated_data.get("password"),
    )
    if user:
        return jsonify(user.__dict__), 200
    return jsonify({"error": "Failed to update user"}), 500


@user_bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user_route(user_id: int) -> tuple[Any, int]:
    user_id_from_tokens, _, error, code = process_request(type_of_request="DELETE")

    if error and code:
        return error, code
    if int(user_id_from_tokens) != user_id:
        return jsonify({"error": "Unauthorized"}), 403
    success = delete_user(user_id)
    # To do: revoke token and check it in all code
    return ("", 204) if success else (jsonify({"error": "Failed to delete user"}), 500)


@user_bp.route("/", methods=["DELETE"])
@jwt_required()
def self_delete_user_route() -> tuple[Any, int]:
    user_id_from_tokens, _, error, code = process_request(type_of_request="DELETE")
    if error and code:
        return error, code
    # Cast to int to fix type error
    success = delete_user(user_id=cast(int, user_id_from_tokens))
    return ("", 204) if success else (jsonify({"error": "Failed to delete user"}), 500)


@user_bp.route("/verify-token", methods=["GET"])
@jwt_required()
def verify_token() -> tuple[Any, int]:
    user_id_from_tokens, _, error, code = process_request(type_of_request="GET")
    if error and code:
        return error, code
    # Cast to int to fix type error
    update_last_login(user_id=cast(int, user_id_from_tokens), login_time=datetime.now())
    return jsonify({"message": "Token is valid"}), 200
