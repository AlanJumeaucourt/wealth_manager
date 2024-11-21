from typing import Any
from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from app.schemas import UserSchema
from app.services.user_service import (
    create_user,
    get_user_by_id,
    update_user,
    delete_user,
    authenticate_user,
    update_last_login,
)
from app.routes.route_utils import process_request
import sentry_sdk
from flask_jwt_extended import jwt_required, create_access_token
from app.exceptions import DuplicateUserError
from datetime import datetime

user_bp = Blueprint("user", __name__)
user_schema = UserSchema()


@user_bp.route("/register", methods=["POST"])
def register():
    data = request.json
    required_fields = ["name", "email", "password"]

    if not data:
        return jsonify({"error": "No data provided"}), 400
    elif not all(field in data for field in required_fields):
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
            validated_data["name"], validated_data["email"], validated_data["password"]
        )
        if user:
            sentry_sdk.set_user({"id": f"{user.id}"})
            return jsonify(user.__dict__), 201
        else:
            return jsonify({"error": "Failed to create user"}), 500
    except DuplicateUserError as e:
        return jsonify({"error": str(e)}), 422


@user_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    required_fields = ["email", "password"]
    if not data:
        return jsonify({"error": "No data provided"}), 400
    elif not all(field in data for field in required_fields):
        return (
            jsonify(
                {"error": f"Missing required fields: {', '.join(required_fields)}"}
            ),
            400,
        )

    user = authenticate_user(data["email"], data["password"])
    if user:
        access_token = create_access_token(identity=user.id)
        sentry_sdk.set_user({"id": f"{user.id}"})  # Set user context in Sentry
        update_last_login(user.id, datetime.now())
        return jsonify(access_token=access_token), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401


@user_bp.route("/<int:user_id>", methods=["GET"])
@jwt_required()
def get_user_admin(user_id: int):
    user_id_from_tokens, _, error, code = process_request(type_of_request="GET")

    if user_id_from_tokens != user_id:
        return jsonify({"error": "Unauthorized, cannot access this user"}), 403

    if error:
        return error, code

    user = get_user_by_id(user_id)
    return jsonify(user.__dict__) if user else ("", 404)


@user_bp.route("/", methods=["GET"])
@jwt_required()
def get_user():
    user_id_from_tokens, _, error, code = process_request(type_of_request="GET")

    if error:
        return error, code

    user = get_user_by_id(user_id_from_tokens)
    update_last_login(user_id_from_tokens, datetime.now())
    return jsonify(user.__dict__) if user else ("", 404)


@user_bp.route("/<int:user_id>", methods=["PUT"])
@jwt_required()
def update_user_route(user_id: int):
    user_id_from_tokens, data, error, code = process_request(
        ["name", "email", "password"], type_of_request="PUT"
    )

    if error:
        return error, code

    if user_id_from_tokens != user_id:
        return jsonify({"error": "Unauthorized, cannot update this user"}), 403

    try:
        validated_data: Any = user_schema.load(data, partial=True)
    except ValidationError as err:
        return jsonify({"Validation error": err.messages}), 400

    user = update_user(
        user_id,
        validated_data.get("name"),
        validated_data.get("email"),
        validated_data.get("password"),
    )
    if user:
        return jsonify(user.__dict__)
    else:
        return jsonify({"error": "Failed to update user"}), 500


@user_bp.route("/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user_route(user_id: int):
    user_id_from_tokens, _, error, code = process_request(type_of_request="DELETE")

    if error:
        return error, code

    if user_id_from_tokens != user_id:
        return jsonify({"error": "Unauthorized"}), 403
    success = delete_user(user_id)
    # To do: revoke token and check it in all code
    return ("", 204) if success else (jsonify({"error": "Failed to delete user"}), 500)


@user_bp.route("/", methods=["DELETE"])
@jwt_required()
def self_delete_user_route():
    user_id_from_tokens, _, error, code = process_request(type_of_request="DELETE")
    if error:
        return error, code
    success = delete_user(user_id_from_tokens)
    return ("", 204) if success else (jsonify({"error": "Failed to delete user"}), 500)


@user_bp.route("/verify-token", methods=["GET"])
@jwt_required()
def verify_token():
    user_id_from_tokens, _, error, code = process_request(type_of_request="GET")
    if error:
        return error, code
    update_last_login(user_id_from_tokens, datetime.now())
    return jsonify({"message": "Token is valid"}), 200
