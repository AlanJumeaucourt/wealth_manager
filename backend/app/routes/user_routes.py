from datetime import datetime
from typing import Any

import sentry_sdk
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required
from marshmallow import ValidationError

from app.exceptions import DuplicateUserError
from app.routes.route_utils import process_request
from app.schemas import UserSchema
from app.services.user_service import (
    authenticate_user,
    create_user,
    delete_user,
    get_user_by_id,
    update_last_login,
    update_user,
)

user_bp = Blueprint("user", __name__)
user_schema = UserSchema()


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
            )
            refresh_token = create_refresh_token(identity=str(user_dict["id"]))

            return (
                jsonify(
                    {
                        "access_token": access_token,
                        "refresh_token": refresh_token,
                        "user": user_dict,
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
    update_last_login(user_id=user_id_from_tokens, login_time=datetime.now())
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
    success = delete_user(user_id=user_id_from_tokens)
    return ("", 204) if success else (jsonify({"error": "Failed to delete user"}), 500)


@user_bp.route("/verify-token", methods=["GET"])
@jwt_required()
def verify_token() -> tuple[Any, int]:
    user_id_from_tokens, _, error, code = process_request(type_of_request="GET")
    if error and code:
        return error, code
    update_last_login(user_id=user_id_from_tokens, login_time=datetime.now())
    return jsonify({"message": "Token is valid"}), 200
