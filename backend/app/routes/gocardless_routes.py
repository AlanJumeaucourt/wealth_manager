from unittest.mock import Mock

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

# from app.services.gocardless_service import GoCardlessService

gocardless_bp = Blueprint("gocardless", __name__)
# gocardless_service = GoCardlessService()
gocardless_service = Mock()


@gocardless_bp.route("/institutions", methods=["GET"])
@jwt_required()
def get_institutions():
    """Get list of available banks."""
    try:
        institutions = gocardless_service.get_institutions()
        return jsonify(institutions)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/requisitions", methods=["POST"])
@jwt_required()
def create_requisition():
    """Create a new requisition for bank connection."""
    try:
        data = request.get_json()
        institution_id = data.get("institution_id")
        if not institution_id:
            return jsonify({"error": "institution_id is required"}), 400

        user_id = get_jwt_identity()
        requisition = gocardless_service.create_requisition(institution_id, user_id)
        return jsonify(requisition)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/requisitions/<requisition_id>", methods=["GET"])
@jwt_required()
def get_requisition_status(requisition_id):
    """Get status of a requisition."""
    try:
        status = gocardless_service.get_requisition_status(requisition_id)
        return jsonify(status)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/accounts/<requisition_id>", methods=["GET"])
@jwt_required()
def get_accounts(requisition_id):
    """Get accounts for a requisition."""
    try:
        accounts = gocardless_service.get_accounts(requisition_id)
        return jsonify(accounts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gocardless_bp.route("/link-accounts", methods=["POST"])
@jwt_required()
def link_accounts():
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
