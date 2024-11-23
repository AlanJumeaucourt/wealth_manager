from typing import Any, Optional, Literal
from flask import jsonify, request, Response
from flask_jwt_extended import get_jwt_identity
import sentry_sdk


def process_request(
    required_fields: Optional[list[str]] = None,
    type_of_request: Literal["GET", "POST", "PUT", "DELETE"] = "GET",
) -> tuple[int, Optional[dict[str, Any]], Optional[Response], Optional[int]]:
    """
    Processes a request based on the specified type and required fields.

    This function handles the processing of incoming requests based on the request type (GET, POST, PUT, DELETE) and checks for required fields in the request data. It returns the user ID, processed data, an error response if any, and the error status code if any.

    Args:
        required_fields (Optional[list[str]], optional): A list of required fields in the request data. Defaults to None.
        type_of_request (Literal['get', 'post', 'put', 'delete'], optional): The type of request being processed. Defaults to 'get'.

    Returns:
        tuple[int, Optional[dict[str, Any]], Optional[Response], Optional[int]]: A tuple containing the user ID, processed data, an error response if any, and the error status code if any.
    """

    user_id = get_jwt_identity()
    sentry_sdk.set_user({"id": f"{user_id}"})

    if type_of_request in ["POST", "PUT"]:
        data = request.json if request.is_json else None
        print(f"Data: {data}")
    elif type_of_request == "GET":
        data = request.args.to_dict()
    else:
        data = None

    if required_fields:
        if not data:
            return (
                user_id,
                None,
                jsonify(
                    {"error": f"Missing required fields: {', '.join(required_fields)}"}
                ),
                400,
            )

        not_recognized_fields = [
            field for field in data.keys() if field not in required_fields
        ]
        missing_fields = [field for field in required_fields if field not in data]
        at_least_one_field = (
            len(required_fields) == len(missing_fields) and len(missing_fields) > 0
        )

        if type_of_request == "PUT":
            if at_least_one_field:
                return (
                    user_id,
                    None,
                    jsonify(
                        {
                            "error": f"Missing at least one field: {', '.join(required_fields)}"
                        }
                    ),
                    400,
                )

        elif type_of_request == "POST":
            if not_recognized_fields:
                return (
                    user_id,
                    None,
                    jsonify(
                        {
                            "error": f"Not recognized fields: {', '.join(not_recognized_fields)}"
                        }
                    ),
                    400,
                )
            if missing_fields:
                return (
                    user_id,
                    None,
                    jsonify(
                        {
                            "error": f"Missing required fields: {', '.join(missing_fields)}"
                        }
                    ),
                    400,
                )

    return user_id, data, None, None
