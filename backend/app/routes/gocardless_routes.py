# from unittest.mock import Mock

import logging
from typing import Any

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.services.gocardless_service import GoCardlessService

gocardless_bp = Blueprint("gocardless", __name__)
gocardless_service = GoCardlessService()
# gocardless_service = Mock()
logger = logging.getLogger(__name__)


@gocardless_bp.route("/institutions", methods=["GET"])
@jwt_required()
def get_institutions() -> dict[str, Any] | tuple:
    """Get list of available banks."""
    try:
        country_code = request.args.get("country", "GB")
        institutions = gocardless_service.get_institutions(country_code)
        return jsonify(institutions)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/institutions/<institution_id>", methods=["GET"])
@jwt_required()
def get_institution(institution_id: str) -> dict[str, Any] | tuple:
    """Get details of a specific bank."""
    try:
        institution = gocardless_service.get_institution(institution_id)
        return jsonify(institution)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/agreements/enduser", methods=["POST"])
@jwt_required()
def create_end_user_agreement() -> dict[str, Any] | tuple:
    """Create an end user agreement."""
    try:
        data = request.get_json()
        institution_id = data.get("institution_id")
        if not institution_id:
            return jsonify({"error": "institution_id is required"}), 400

        max_historical_days = data.get("max_historical_days", 90)
        access_valid_for_days = data.get("access_valid_for_days", 90)
        access_scope = data.get("access_scope", ["balances", "details", "transactions"])

        user_id = get_jwt_identity()
        agreement = gocardless_service.create_end_user_agreement(
            institution_id,
            max_historical_days,
            access_valid_for_days,
            access_scope,
            user_id,
        )
        return jsonify(agreement)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/requisitions", methods=["POST"])
@jwt_required()
def create_requisition() -> dict[str, Any] | tuple:
    """Create a new requisition for bank connection."""
    try:
        data = request.get_json()
        institution_id = data.get("institution_id")
        redirect_url = data.get("redirect")

        if not institution_id:
            return jsonify({"error": "institution_id is required"}), 400
        if not redirect_url:
            return jsonify({"error": "redirect URL is required"}), 400

        # Optional params
        reference = data.get("reference")
        account_selection = data.get("account_selection", False)

        user_id = get_jwt_identity()
        requisition = gocardless_service.create_requisition(
            institution_id,
            redirect_url,
            user_id,
            reference,
            account_selection,
        )
        return jsonify(requisition)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/requisitions/<requisition_id>", methods=["GET"])
@jwt_required()
def get_requisition_status(requisition_id: str) -> dict[str, Any] | tuple:
    """Get status of a requisition by ID."""
    try:
        status = gocardless_service.get_requisition_status(requisition_id)
        return jsonify(status)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/requisitions/by-reference/<reference>", methods=["GET"])
@jwt_required()
def get_requisition_by_reference(reference: str) -> dict[str, Any] | tuple:
    """Get requisition by reference value and store account information."""
    try:
        user_id = get_jwt_identity()
        requisition = gocardless_service.get_requisition_by_reference(
            reference, user_id
        )

        # After successfully getting the requisition, fetch and store account information
        if requisition.get("status") == "LN" and requisition.get("accounts"):
            try:
                # Get accounts details and store them
                requisition_id = requisition.get("id")
                account_ids = requisition.get("accounts", [])
                gocardless_service.link_accounts_to_user(
                    requisition_id, account_ids, user_id
                )
            except Exception as e:
                # Log the error but don't fail the whole request
                error_str = str(e)
                if (
                    "429" in error_str
                    or "rate limit" in error_str.lower()
                    or "too many requests" in error_str.lower()
                ):
                    logger.warning(
                        f"Rate limit exceeded when linking accounts: {error_str}"
                    )
                    # Add specific warning for rate limits
                    if isinstance(requisition, dict):
                        requisition["warning"] = (
                            f"Rate limit exceeded. Please try again later: {error_str}"
                        )
                else:
                    logger.error(f"Error storing account information: {e}")
                    # Add warning to response
                    if isinstance(requisition, dict):
                        requisition["warning"] = (
                            f"Account details could not be stored: {error_str}"
                        )

        return jsonify(requisition)
    except Exception as e:
        error_str = str(e)
        if (
            "429" in error_str
            or "rate limit" in error_str.lower()
            or "too many requests" in error_str.lower()
        ):
            logger.warning(
                f"Rate limit exceeded in get_requisition_by_reference: {error_str}"
            )
            return jsonify(
                {
                    "error": "Rate limit exceeded. Please try again later.",
                    "detail": error_str,
                }
            ), 429
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/accounts/<requisition_id>", methods=["GET"])
@jwt_required()
def get_accounts(requisition_id: str) -> dict[str, Any] | tuple:
    """Get accounts for a requisition."""
    try:
        accounts = gocardless_service.get_accounts(requisition_id)
        return jsonify(accounts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/accounts/<account_id>/details", methods=["GET"])
@jwt_required()
def get_account_details(account_id: str) -> dict[str, Any] | tuple:
    """Get details for an account."""
    try:
        update_cache = request.args.get("update_cache", "false").lower() == "true"
        details = gocardless_service.get_account_details(account_id, update_cache)
        return jsonify(details)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/accounts/<account_id>/balances", methods=["GET"])
@jwt_required()
def get_account_balances(account_id: str) -> dict[str, Any] | tuple:
    """Get balances for an account."""
    try:
        update_cache = request.args.get("update_cache", "false").lower() == "true"
        balances = gocardless_service.get_account_balances(account_id, update_cache)
        return jsonify(balances)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/accounts/<account_id>/transactions", methods=["GET"])
@jwt_required()
def get_account_transactions(account_id: str) -> dict[str, Any] | tuple:
    """Get transactions for an account."""
    try:
        date_from = request.args.get("date_from")
        date_to = request.args.get("date_to")
        update_cache = request.args.get("update_cache", "false").lower() == "true"

        transactions = gocardless_service.get_account_transactions(
            account_id, date_from, date_to, update_cache
        )
        return jsonify(transactions)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/link-accounts", methods=["POST"])
@jwt_required()
def link_accounts() -> dict[str, Any] | tuple:
    """Link accounts to user."""
    try:
        data = request.get_json()
        requisition_id = data.get("requisition_id")
        account_ids = data.get("account_ids", [])

        if not requisition_id:
            return jsonify({"error": "requisition_id is required"}), 400
        if not account_ids:
            return jsonify({"error": "account_ids is required"}), 400

        user_id = get_jwt_identity()
        gocardless_service.link_accounts_to_user(requisition_id, account_ids, user_id)
        return jsonify({"message": "Accounts linked successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/token/new", methods=["POST"])
def get_token() -> dict[str, Any] | tuple:
    """Get a GoCardless API token."""
    try:
        data = request.get_json()
        secret_id = data.get("secret_id")
        secret_key = data.get("secret_key")

        if not secret_id or not secret_key:
            return jsonify({"error": "secret_id and secret_key are required"}), 400

        token = gocardless_service.get_token(secret_id, secret_key)
        return jsonify(token)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/accounts", methods=["GET"])
@jwt_required()
def get_user_accounts() -> dict[str, Any] | tuple:
    """Get all GoCardless accounts for the current user."""
    try:
        user_id = get_jwt_identity()
        accounts = gocardless_service.get_user_accounts(user_id)
        return jsonify(accounts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
