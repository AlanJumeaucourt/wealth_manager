from typing import Any, Dict, Tuple, Union
from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from app.schemas import UserSchema
from app.services.user_service import create_user, get_user_by_id, update_user, delete_user, authenticate_user
from app.routes.route_utils import process_request
import sentry_sdk
from flask_jwt_extended import jwt_required, create_access_token
from app.exceptions import DuplicateUserError
from flask_restx import Namespace, Resource, fields

ResponseType = Union[Dict[str, Any], Tuple[Dict[str, Any], int], Tuple[str, int]]

user_ns = Namespace('users', description='User operations')
user_schema = UserSchema()

# Define models
register_model = user_ns.model('Register', {
    'name': fields.String(required=True, description='The user name'),
    'email': fields.String(required=True, description='The user email', example='user@example.com'),
    'password': fields.String(required=True, description='The user password', example='password123')
})

login_model = user_ns.model('Login', {
    'email': fields.String(required=True, description='The user email', example='user@example.com'),
    'password': fields.String(required=True, description='The user password', example='password123')
})

auth_response = user_ns.model('AuthResponse', {
    'access_token': fields.String(description='JWT access token')
})

error_response = user_ns.model('ErrorResponse', {
    'error': fields.String(description='Error message')
})

@user_ns.route('/register')
class UserRegister(Resource):
    @user_ns.doc('register_user', security=None)
    @user_ns.expect(register_model)
    @user_ns.response(201, 'User created successfully')
    @user_ns.response(400, 'Validation error', error_response)
    @user_ns.response(422, 'User already exists', error_response)
    def post(self):
        """Register a new user"""
        data = request.json
        if not isinstance(data, dict):
            return {"error": "Invalid data format"}, 400
            
        try:
            validated_data = user_schema.load(data)
            user = create_user(validated_data['name'], validated_data['email'], validated_data['password'])
            if user:
                sentry_sdk.set_user({"id": f"{user.id}"})
                return user.__dict__, 201
            return {"error": "Failed to create user"}, 500
        except ValidationError as err:
            return {"error": err.messages}, 400
        except DuplicateUserError as e:
            return {"error": str(e)}, 422

@user_ns.route('/login')
class UserLogin(Resource):
    @user_ns.doc('login_user', security=None)
    @user_ns.expect(login_model)
    @user_ns.response(200, 'Login successful', auth_response)
    @user_ns.response(400, 'Invalid request', error_response)
    @user_ns.response(401, 'Invalid credentials', error_response)
    def post(self):
        """Login a user"""
        data = request.json
        if not data:
            return {"error": "No data provided"}, 400
            
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return {"error": "Email and password are required"}, 400

        user = authenticate_user(email, password)
        if user:
            access_token = create_access_token(identity=user.id)
            sentry_sdk.set_user({"id": f"{user.id}"})
            return {"access_token": access_token}, 200
        return {"error": "Invalid credentials"}, 401

@user_ns.route('/<int:user_id>')
class UserOperations(Resource):
    @user_ns.doc('get_user')
    @jwt_required()
    def get(self, user_id: int):
        """Get user details"""
        user = get_user_by_id(user_id)
        return user.__dict__ if user else ('', 404)

    @user_ns.doc('update_user')
    @jwt_required()
    def put(self, user_id: int):
        """Update user details"""
        data = request.json
        try:
            validated_data = user_schema.load(data, partial=True)
            user = update_user(user_id, validated_data.get('name'), 
                             validated_data.get('email'), validated_data.get('password'))
            if user:
                return user.__dict__
            else:
                return {"error": "Failed to update user"}, 500
        except ValidationError as err:
            return {"Validation error": err.messages}, 400

    @user_ns.doc('delete_user')
    @jwt_required()
    def delete(self, user_id: int):
        """Delete user"""
        success = delete_user(user_id)
        return ('', 204) if success else ({"error": "Failed to delete user"}, 500)

@user_ns.route('/verify-token')
class TokenVerification(Resource):
    @user_ns.doc('verify_token')
    @jwt_required()
    def get(self):
        """Verify JWT token"""
        return {"message": "Token is valid"}, 200
