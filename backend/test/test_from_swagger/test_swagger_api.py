import json
import logging
from datetime import datetime
from pathlib import Path

import pytest
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


class TestSwaggerAPI:
    BASE_URL = "http://localhost:5000"  # Update with your actual API base URL

    @pytest.fixture(scope="class")
    def swagger_spec(self):
        """Load the Swagger specification from JSON file"""
        swagger_path = Path(__file__).parent / "swagger.json"
        logger.info(f"Loading Swagger specification from {swagger_path}")
        with open(swagger_path) as f:
            spec = json.load(f)
            logger.info(
                f"Loaded specification version: {spec.get('info', {}).get('version', 'unknown')}"
            )
            return spec

    @pytest.fixture
    def auth_headers(self):
        """Provide authentication headers for API requests"""
        logger.debug("Generating authentication headers")
        return {"Authorization": "Bearer your-test-token"}

    def generate_test_data(self, schema):
        """Generate test data based on schema definition"""
        logger.debug(
            f"Generating test data for schema: {schema.get('type', 'unknown type')}"
        )
        if not schema or "type" not in schema:
            logger.warning("Invalid or empty schema provided")
            return None

        if schema["type"] == "object":
            result = {}
            if "properties" in schema:
                for prop, prop_schema in schema["properties"].items():
                    if prop_schema.get("readOnly"):
                        logger.debug(f"Skipping readonly property: {prop}")
                        continue

                    logger.debug(f"Generating value for property: {prop}")
                    if prop in ["user_id", "bank_id", "account_id", "asset_id"]:
                        result[prop] = 1
                    elif prop_schema.get("type") == "string":
                        if prop == "email":
                            result[prop] = "test@example.com"
                        elif prop == "password":
                            result[prop] = "testpass123"
                        elif "enum" in prop_schema:
                            result[prop] = prop_schema["enum"][0]
                        else:
                            result[prop] = f"Test {prop}"
                    elif prop_schema.get("type") == "number":
                        result[prop] = 100.0
                    elif prop_schema.get("type") == "integer":
                        result[prop] = 1
                    elif prop_schema.get("type") == "boolean":
                        result[prop] = True
            logger.debug(f"Generated test data: {result}")
            return result
        return None

    def get_response_schema(self, path_item, method):
        """Extract expected response schema for a path and method"""
        logger.debug(f"Extracting response schema for {method}")
        if "responses" in path_item:
            success_response = path_item["responses"].get("200") or path_item[
                "responses"
            ].get("201")
            if success_response and "content" in success_response:
                logger.debug("Found response schema")
                return success_response["content"]["application/json"]["schema"]
        logger.debug("No response schema found")
        return None

    def validate_response(self, response_data, schema):
        """Validate response data against schema"""
        logger.debug("Validating response data against schema")
        if not schema:
            logger.warning("No schema provided for validation")
            return True

        if schema.get("type") == "object":
            if not isinstance(response_data, dict):
                logger.error("Response data is not an object as expected")
                return False
            required_props = schema.get("properties", {}).keys()
            valid = all(prop in response_data for prop in required_props)
            if not valid:
                logger.error(
                    f"Missing required properties in response: {set(required_props) - set(response_data.keys())}"
                )
            return valid

        if schema.get("type") == "array":
            if not isinstance(response_data, list):
                logger.error("Response data is not an array as expected")
                return False
            logger.debug(f"Array validation passed, found {len(response_data)} items")
            return True

        return True

    def check_endpoint_prerequisites(self, path, method):
        """Check if prerequisites are met for testing an endpoint"""
        # Skip user deletion test if no user exists
        if path == "/users/{user_id}" and method == "delete":
            try:
                # Try to create a test user first
                user_data = {
                    "email": "test@example.com",
                    "name": "Test User",
                    "password": "testpass123",
                }
                create_response = requests.post(
                    f"{self.BASE_URL}/users/",
                    json=user_data,
                    headers={"Content-Type": "application/json"},
                )
                if create_response.status_code == 201:
                    logger.info("Created test user for deletion test")
                    return True
                logger.warning("Could not create test user, skipping deletion test")
                return False
            except Exception as e:
                logger.error(f"Error setting up test user: {e!s}")
                return False
        return True

    def is_error_expected(self, operation, status_code):
        """Check if an error response is expected based on the Swagger spec"""
        if "responses" in operation:
            return str(status_code) in operation["responses"]
        return False

    @pytest.mark.parametrize(
        "path,methods",
        [
            pytest.param(path, methods, id=path)
            for path, methods in json.load(
                open(Path(__file__).parent / "swagger.json")
            )["paths"].items()
        ],
    )
    def test_endpoints(self, swagger_spec, auth_headers, path, methods):
        """Test all API endpoints defined in the Swagger specification"""
        logger.info(f"\n{'='*80}\nTesting endpoint: {path}\n{'='*80}")

        for method, operation in methods.items():
            if method not in ["get", "post", "put", "delete"]:
                logger.warning(f"Skipping unsupported method: {method}")
                continue

            # Check prerequisites
            if not self.check_endpoint_prerequisites(path, method):
                logger.warning(
                    f"Prerequisites not met for {method.upper()} {path}, skipping test"
                )
                pytest.skip(f"Prerequisites not met for {method.upper()} {path}")
                continue

            logger.info(f"Testing {method.upper()} {path}")

            # Prepare the URL
            url = f"{self.BASE_URL}{path}"
            if "{" in path:  # Path contains parameters
                url = url.replace(
                    "{id}", "1"
                )  # Replace path parameters with test values
                url = url.replace("{user_id}", "1")  # Add specific handling for user_id
                logger.info(f"Parameterized URL: {url}")

            # Prepare request data for POST/PUT
            request_data = None
            if method in ["post", "put"] and "requestBody" in operation:
                logger.info("Preparing request body")
                schema = operation["requestBody"]["content"]["application/json"][
                    "schema"
                ]
                if "$ref" in schema:
                    ref_path = schema["$ref"].split("/")[1:]
                    schema = swagger_spec
                    for part in ref_path:
                        schema = schema[part]
                request_data = self.generate_test_data(schema)
                logger.info(f"Request data: {json.dumps(request_data, indent=2)}")

            # Prepare query parameters for GET
            params = {}
            if "parameters" in operation:
                logger.info("Preparing query parameters")
                for param in operation["parameters"]:
                    if param["in"] == "query":
                        logger.debug(f"Processing query parameter: {param['name']}")
                        if (
                            param["schema"].get("type") == "string"
                            and param["schema"].get("format") == "date"
                        ):
                            params[param["name"]] = datetime.now().strftime("%Y-%m-%d")
                        elif "default" in param["schema"]:
                            params[param["name"]] = param["schema"]["default"]
                        elif param["schema"].get("type") == "integer":
                            params[param["name"]] = 1
                        elif param["schema"].get("type") == "string":
                            if "enum" in param["schema"]:
                                params[param["name"]] = param["schema"]["enum"][0]
                            else:
                                params[param["name"]] = "test"
                logger.info(f"Query parameters: {params}")

            # Make the request
            logger.info(f"Making {method.upper()} request to {url}")
            try:
                response = getattr(requests, method)(
                    url,
                    headers=auth_headers,
                    json=request_data if request_data else None,
                    params=params if params else None,
                )
                logger.info(f"Response status code: {response.status_code}")

                # Log response details for debugging
                logger.debug(f"Response headers: {dict(response.headers)}")
                try:
                    response_body = response.json() if response.text else {}
                    logger.debug(
                        f"Response body: {json.dumps(response_body, indent=2)}"
                    )
                except json.JSONDecodeError:
                    logger.debug(f"Raw response text: {response.text}")

            except Exception as e:
                logger.error(f"Request failed: {e!s}")
                raise

            # Validate response
            try:
                # Check if error response is expected
                if response.status_code >= 400 and self.is_error_expected(
                    operation, response.status_code
                ):
                    logger.info(
                        f"Received expected error response: {response.status_code}"
                    )
                    continue

                assert response.status_code in [
                    200,
                    201,
                    204,
                ], f"Failed {method.upper()} {path}: {response.status_code}"
                logger.info(
                    f"Response status code validation passed: {response.status_code}"
                )

                if response.status_code != 204:  # No content
                    response_data = response.json()
                    logger.debug(
                        f"Response data: {json.dumps(response_data, indent=2)}"
                    )
                    response_schema = self.get_response_schema(operation, method)
                    if response_schema:
                        logger.info("Validating response against schema")
                        assert self.validate_response(
                            response_data, response_schema
                        ), f"Response validation failed for {method.upper()} {path}"
                        logger.info("Response validation passed")
            except AssertionError as e:
                logger.error(f"Test failed: {e!s}")
                logger.error(f"Response status code: {response.status_code}")
                try:
                    error_body = response.json()
                    logger.error(
                        f"Error response body: {json.dumps(error_body, indent=2)}"
                    )
                except:
                    logger.error(f"Raw error response: {response.text}")
                raise
            except Exception as e:
                logger.error(f"Unexpected error during validation: {e!s}")
                raise

            logger.info(f"Successfully tested {method.upper()} {path}")
